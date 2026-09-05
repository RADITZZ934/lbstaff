require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

// Body parser aman yang menangani JSON dan form data tanpa crash 400 HTML
app.use((req, res, next) => {
    express.json({ limit: '50mb' })(req, res, (err) => {
        if (err) {
            console.error('⚠️ [JSON Parse Warning]:', err.message);
        }
        next();
    });
});
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mengekspos folder fisik agar bisa diakses browser lewat awalan /uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR || (process.platform === 'win32' ? 'D:/lbstaff_uploads' : path.join(process.cwd(), 'uploads'));
app.use('/uploads', express.static(UPLOADS_DIR));

// 1. Konfigurasi Koneksi PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'lbstaff',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Cek koneksi awal PostgreSQL & inisialisasi tabel otomatis
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE,
                role VARCHAR(50) DEFAULT 'karyawan',
                nik VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS time_entries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                end_time TIMESTAMP WITH TIME ZONE,
                total_duration_seconds INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                time_entry_id INTEGER NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                screenshot_url TEXT,
                keyboard_clicks INTEGER DEFAULT 0,
                mouse_moves INTEGER DEFAULT 0,
                app_and_urls JSONB DEFAULT '[]'::jsonb
            );

            CREATE INDEX IF NOT EXISTS idx_users_nik ON users(nik);
            CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
            CREATE INDEX IF NOT EXISTS idx_time_entries_active ON time_entries(user_id, start_time DESC) WHERE end_time IS NULL;
            CREATE INDEX IF NOT EXISTS idx_activity_logs_time_entry ON activity_logs(time_entry_id, recorded_at DESC);
        `);
        console.log('✅ [Database Schema] Struktur tabel (users, time_entries, activity_logs) siap digunakan.');
    } catch (error) {
        console.error('❌ [Database Schema Error] Gagal membuat tabel otomatis:', error.message);
    }
}

pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ [Database Error] Gagal terkoneksi ke PostgreSQL:', err.message);
        console.error(`⚙️ [Config Terpakai] Host: ${process.env.DB_HOST || 'localhost'}, Port: ${process.env.DB_PORT || 5432}, User: ${process.env.DB_USER || 'postgres'}, Database: ${process.env.DB_NAME || 'lbstaff'}`);
    } else {
        console.log('✅ [Database OK] Berhasil terhubung ke database PostgreSQL');
        release();
        initDB();
    }
});

// 2. Konfigurasi Multer untuk Penyimpanan Dinamis
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ambil user_id dari body request (dikirim dari klien)
        const userId = req.body.user_id;

        // Format folder berdasarkan bulan di D:\lbstaff_uploads (contoh: D:\lbstaff_uploads\karyawan_uuid\2026-08)
        const date = new Date();
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const dir = path.join('D:', 'lbstaff_uploads', `karyawan_${userId}`, monthYear);

        // Buat folder secara otomatis jika belum ada
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Beri nama unik pada file gambar
        cb(null, `screenshot_${Date.now()}.jpg`);
    }
});

const upload = multer({ storage: storage });

// --- API OTENTIKASI (LOGIN DENGAN NIK) ---
app.post('/api/login', async (req, res) => {
    const nik = req.body?.nik || req.query?.nik;

    if (!nik) {
        return res.status(400).json({ success: false, message: 'NIK tidak boleh kosong' });
    }

    try {
        // Cek database hanya berdasarkan NIK
        let userResult = await pool.query(
            'SELECT id, name, email, role, nik FROM users WHERE nik = $1',
            [nik]
        );

        let user;

        // Jika NIK belum terdaftar, buat user baru secara otomatis
        if (userResult.rows.length === 0) {
            console.log(`[Pendaftaran Otomatis] NIK ${nik} tidak ditemukan. Membuat user baru...`);
            const insertUserQuery = `
                INSERT INTO users (name, email, role, nik, password_hash)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, name, email, role, nik;
            `;
            const newUserResult = await pool.query(insertUserQuery, [
                `Karyawan ${nik}`,
                `karyawan_${nik}@lbstaff.local`,
                'karyawan',
                nik,
                'auto-generated'
            ]);
            user = newUserResult.rows[0];
            console.log(`✅ [User Baru Terdaftar] ID: ${user.id}, Nama: ${user.name}`);
        } else {
            user = userResult.rows[0];
        }

        // Buat Sesi Kerja baru
        const sessionResult = await pool.query(
            'INSERT INTO time_entries (user_id, start_time) VALUES ($1, NOW()) RETURNING id',
            [user.id]
        );

        res.json({
            success: true,
            message: 'Login berhasil',
            user: user,
            time_entry_id: sessionResult.rows[0].id
        });
    } catch (error) {
        console.error('Error saat login:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
    }
});

// --- API OTENTIKASI (LOGOUT / STOP SESI) ---
app.post('/api/stop-session', async (req, res) => {
    const time_entry_id = req.body?.time_entry_id || req.query?.time_entry_id;

    if (!time_entry_id) {
        return res.status(400).json({ success: false, message: 'ID Sesi tidak ditemukan' });
    }

    try {
        // Update end_time dan kalkulasi otomatis total_duration_seconds
        const updateQuery = `
            UPDATE time_entries 
            SET end_time = NOW(),
                total_duration_seconds = ROUND(EXTRACT(EPOCH FROM (NOW() - start_time)))::INTEGER
            WHERE id = $1 
            RETURNING *;
        `;

        const result = await pool.query(updateQuery, [time_entry_id]);

        if (result.rows.length > 0) {
            res.json({
                success: true,
                message: 'Sesi kerja berhasil diakhiri',
                data: result.rows[0]
            });
        } else {
            res.status(404).json({ success: false, message: 'Sesi tidak ditemukan' });
        }
    } catch (error) {
        console.error('Error saat menutup sesi:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
    }
});

// 3. Endpoint Endpoint API untuk Menerima Data
app.post('/api/track', upload.single('screenshot'), async (req, res) => {
    try {
        const { user_id, time_entry_id, keyboard_clicks, mouse_moves, app_and_urls } = req.body;

        // Dapatkan path gambar yang baru saja diupload (jika ada file yang dikirim)
        // Format path untuk disimpan di database
        let screenshot_url = null;
        if (req.file) {
            screenshot_url = req.file.path.replace(/\\/g, '/');
            console.log(`[BERHASIL] File screenshot tersimpan di: ${req.file.path}`);
        }

        // Insert data ke PostgreSQL (tabel activity_logs)
        const query = `
            INSERT INTO activity_logs 
            (user_id, time_entry_id, recorded_at, screenshot_url, keyboard_clicks, mouse_moves, app_and_urls) 
            VALUES ($1, $2, NOW(), $3, $4, $5, $6) 
            RETURNING id;
        `;

        const values = [
            user_id,
            time_entry_id,
            screenshot_url,
            keyboard_clicks || 0,
            mouse_moves || 0,
            app_and_urls || '[]' // JSONB
        ];

        const result = await pool.query(query, values);

        res.status(201).json({
            message: 'Data aktivitas berhasil disimpan',
            log_id: result.rows[0].id
        });

    } catch (error) {
        console.error('Error saat menyimpan log:', error);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
});

// --- API LIVE MONITORING (KARYAWAN AKTIF) ---
app.get('/api/live-monitoring', async (req, res) => {
    try {
        // Query untuk mengambil HANYA sesi paling baru dari setiap karyawan beserta status aktivitasnya
        const query = `
            SELECT DISTINCT ON (u.nik)
                u.name, 
                u.nik, 
                t.start_time,
                t.end_time,
                CASE 
                    WHEN t.end_time IS NOT NULL THEN 999999
                    ELSE EXTRACT(EPOCH FROM (NOW() - COALESCE(
                        (SELECT MAX(recorded_at) FROM activity_logs WHERE time_entry_id = t.id),
                        t.start_time
                    )))::INTEGER
                END as seconds_since_last_activity
            FROM users u
            JOIN time_entries t ON u.id = t.user_id
            ORDER BY u.nik, t.start_time DESC;
        `;

        const result = await pool.query(query);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error mengambil data live monitoring:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
    }
});

// --- API DETAIL AKTIVITAS KARYAWAN BERDASARKAN NIK ---
app.get('/api/user-activity/:nik', async (req, res) => {
    const { nik } = req.params;

    try {
        // 1. Cari data user dan sesi aktifnya
        const sessionQuery = `
            SELECT u.name, u.nik, t.id as time_entry_id, t.start_time
            FROM users u
            JOIN time_entries t ON u.id = t.user_id
            WHERE u.nik = $1 AND t.end_time IS NULL
            ORDER BY t.start_time DESC   -- <-- TAMBAHKAN BARIS INI
            LIMIT 1;
        `;
        const sessionResult = await pool.query(sessionQuery, [nik]);

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan atau tidak ada sesi aktif.' });
        }

        const activeSession = sessionResult.rows[0];

        // 2. Ambil log aktivitas (screenshot & app/urls) untuk sesi tersebut
        const logsQuery = `
            SELECT id, screenshot_url, screenshot_url AS screenshot_path, app_and_urls, recorded_at, recorded_at AS created_at, keyboard_clicks, mouse_moves
            FROM activity_logs
            WHERE time_entry_id = $1
            ORDER BY recorded_at DESC
            LIMIT 50; -- Membatasi 50 aktivitas terbaru agar ringan
        `;
        const logsResult = await pool.query(logsQuery, [activeSession.time_entry_id]);

        res.json({
            success: true,
            user: activeSession,
            logs: logsResult.rows
        });
    } catch (error) {
        console.error('Error mengambil detail aktivitas:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
    }
});

// --- API CEK JUMLAH LOG BARU (POLLING) ---
app.get('/api/user-activity/:nik/check-new', async (req, res) => {
    const { nik } = req.params;
    const { last_time } = req.query; // Waktu dari screenshot teratas di browser

    try {
        // 1. Cari sesi aktif karyawan
        const sessionQuery = `
            SELECT t.id as time_entry_id, t.start_time
            FROM users u
            JOIN time_entries t ON u.id = t.user_id
            WHERE u.nik = $1 AND t.end_time IS NULL
            ORDER BY t.start_time DESC   -- <-- TAMBAHKAN BARIS INI
            LIMIT 1;
        `;
        const sessionResult = await pool.query(sessionQuery, [nik]);

        // Jika tidak ada sesi aktif atau waktu tidak dikirim
        if (sessionResult.rows.length === 0 || !last_time) {
            return res.json({ success: true, new_count: 0 });
        }

        const timeEntryId = sessionResult.rows[0].time_entry_id;

        // 2. Hitung jumlah log yang masuk setelah 'last_time'
        const countQuery = `
            SELECT COUNT(*) 
            FROM activity_logs 
            WHERE time_entry_id = $1 AND recorded_at > $2;
        `;
        const countResult = await pool.query(countQuery, [timeEntryId, last_time]);

        res.json({
            success: true,
            new_count: parseInt(countResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error saat mengecek log baru:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
    }
});

// --- API SERVE SCREENSHOT GAMBAR ---
app.get('/api/screenshot', (req, res) => {
    const filePath = req.query.path;
    if (filePath && fs.existsSync(filePath)) {
        res.sendFile(path.resolve(filePath));
    } else {
        res.status(404).send('Gambar tidak ditemukan');
    }
});

// Jalankan Server
const PORT = process.env.PORT || 10002;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan di http://0.0.0.0:${PORT}`);
});
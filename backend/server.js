const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Konfigurasi Koneksi PostgreSQL
const pool = new Pool({
    user: 'postgres', // Sesuaikan dengan user DB Anda
    host: 'localhost',
    database: 'lbstaff',
    password: 'postgres', // Sesuaikan password
    port: 5432,
});

// 2. Konfigurasi Multer untuk Penyimpanan Dinamis
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ambil user_id dari body request (dikirim dari klien)
        const userId = req.body.user_id;

        // Format folder berdasarkan bulan (contoh: uploads/karyawan_uuid/2026-08)
        const date = new Date();
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const dir = path.join(__dirname, 'uploads', `karyawan_${userId}`, monthYear);

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

// 3. Endpoint Endpoint API untuk Menerima Data
app.post('/api/track', upload.single('screenshot'), async (req, res) => {
    try {
        const { user_id, time_entry_id, keyboard_clicks, mouse_moves, app_and_urls } = req.body;

        // Dapatkan path gambar yang baru saja diupload (jika ada file yang dikirim)
        // Format relative path untuk disimpan di database
        let screenshot_url = null;
        if (req.file) {
            screenshot_url = req.file.path.replace(__dirname, '').replace(/\\/g, '/');
        }

        // Insert data ke PostgreSQL (tabel activity_logs)
        const query = `
            INSERT INTO activity_logs 
            (user_id, time_entry_id, recorded_at, screenshot_url, keyboards_cicks, mouse_moves, app_and_urls) 
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

        // --- TAMBAHKAN BARIS INI ---
        console.log(`[BERHASIL] Menerima data dari User: ${user_id}`);
        console.log(`>> Gambar disimpan di: ${screenshot_url}`);
        // ---------------------------

        res.status(201).json({
            message: 'Data aktivitas berhasil disimpan',
            log_id: result.rows[0].id
        });

    } catch (error) {
        console.error('Error saat menyimpan log:', error);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
});

// Jalankan Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
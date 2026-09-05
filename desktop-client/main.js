const { app, BrowserWindow, desktopCapturer, powerMonitor, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

// Konfigurasi URL Server Utama
const SERVER_URL = process.env.SERVER_URL || 'http://lbstaff.u-u.my.id';

let mainWindow;
let tray = null;
let aktivitasAplikasi = {};

// Variabel dinamis untuk menampung data karyawan dan sesi yang sedang aktif
let currentUser = null;
let currentTimeEntryId = null;

// Batas waktu menganggur sebelum perekaman dijeda (contoh: 300 detik = 5 menit)
// Untuk keperluan TESTING saat ini, mari kita set ke 15 detik saja agar cepat terlihat hasilnya
const IDLE_THRESHOLD_SECONDS = 15; 
let isIdle = false; // Penanda status saat ini

// Tentukan lokasi file txt yang aman di sistem Windows
const nikFilePath = path.join(app.getPath('userData'), 'nik_tersimpan.txt');

function createWindow() {
    mainWindow = new BrowserWindow({
        title: 'Onestaff',
        width: 380,
        height: 480,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Mengarahkan tampilan ke file login di folder views
    mainWindow.loadFile(path.join(__dirname, 'views', 'index.html'));

    // --- FITUR SYSTEM TRAY (MODE SENYAP) ---
    mainWindow.on('close', function (event) {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
            console.log("Aplikasi disembunyikan ke System Tray.");
        }
    });

    mainWindow.on('minimize', function (event) {
        event.preventDefault();
        mainWindow.hide();
    });
}

// Dijalankan saat aplikasi siap
app.whenReady().then(() => {
    createWindow();

    // Setup System Tray...
    const iconPath = path.join(__dirname, 'icon.png');
    tray = new Tray(iconPath);
    
    const contextMenu = Menu.buildFromTemplate([
        { 
            label: 'Ganti NIK / Logout', 
            click: async () => { 
                await hentikanSesi(); 
                currentUser = null; 
                // Hapus file txt saat logout
                if (fs.existsSync(nikFilePath)) {
                    fs.unlinkSync(nikFilePath);
                }
                mainWindow.show(); // Munculkan form login
            } 
        }
    ]);
    tray.setToolTip('Onestaff');
    tray.setContextMenu(contextMenu);

    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true, path: app.getPath('exe') });

    // --- LOGIKA AUTO-LOGIN LATAR BELAKANG ---
    if (fs.existsSync(nikFilePath)) {
        // Jika file txt ada, baca isinya
        const savedNik = fs.readFileSync(nikFilePath, 'utf8').trim();
        if (savedNik) {
            console.log(`[Auto-Login] Menemukan NIK di file txt: ${savedNik}. Menghubungi server...`);
            loginDariLatarBelakang(savedNik);
        } else {
            mainWindow.show(); // File ada tapi kosong, tampilkan form
        }
    } else {
        // Jika file txt tidak ada (belum pernah login), tampilkan form
        mainWindow.show();
    }

    setInterval(rekamDanKirim, 15000);
    setInterval(pantauJendelaAktif, 1000);
});

// --- FUNGSI LOGIN LANGSUNG DARI MAIN.JS ---
async function loginDariLatarBelakang(nik) {
    try {
        const response = await axios.post(`${SERVER_URL}/api/login`, { nik });
        
        if (response.data.success) {
            currentUser = response.data.user;
            currentTimeEntryId = response.data.time_entry_id;
            console.log(`✅ [Auto-Login Sukses] Masuk sebagai: ${currentUser.name}`);
            // Karena sukses, jendela tetap tersembunyi.
        } else {
            console.log('❌ [Auto-Login Gagal] NIK tidak valid. Menampilkan form.');
            mainWindow.show();
        }
    } catch (error) {
        console.error('❌ [Auto-Login Error] Server mati atau tidak ada internet.');
        mainWindow.show();
    }
}

// --- MENERIMA DATA DARI FORM LOGIN MANUAL (index.html) ---
ipcMain.on('login-sukses', (event, data) => {
    currentUser = data.user;
    currentTimeEntryId = data.time_entry_id;

    // SIMPAN NIK KE FILE TXT
    fs.writeFileSync(nikFilePath, data.nik, 'utf8');

    console.log(`✅ [Login Manual Sukses] Berhasil masuk sebagai: ${currentUser.name}`);
    mainWindow.hide(); // Sembunyikan jendela
});

// Mencegat proses aplikasi keluar (termasuk saat laptop di-shutdown OS)
app.on('before-quit', async (event) => {
    if (currentTimeEntryId && !app.isSessionClosed) {
        event.preventDefault();
        
        await hentikanSesi();
        
        app.isSessionClosed = true;
        app.quit();
    }
});

// Fungsi untuk memantau jendela aktif secara real-time
async function pantauJendelaAktif() {
    // Kunci perekam: Jangan pantau jika belum ada karyawan yang login
    if (!currentUser) return;

    try {
        const { default: activeWin } = await import('active-win');
        const window = await activeWin();

        if (window) {
            const appName = window.owner.name;
            const windowTitle = window.title;

            const key = `${appName}|${windowTitle}`;

            if (!aktivitasAplikasi[key]) {
                aktivitasAplikasi[key] = {
                    app_name: appName,
                    window_title: windowTitle,
                    duration_seconds: 0
                };
            }

            aktivitasAplikasi[key].duration_seconds += 1;
        }
    } catch (err) {
        console.error("❌ Gagal membaca jendela:", err.message);
    }
}

// Fungsi inti untuk mengambil screenshot dan mengirim payload
async function rekamDanKirim() {
    // Kunci perekam: Jangan rekam dan jangan kirim apapun jika karyawan belum login
    if (!currentUser || !currentTimeEntryId) return;

    // --- 1. LOGIKA DETEKSI IDLE (MENGANGGUR) ---
    // Dapatkan waktu (dalam detik) sejak terakhir kali mouse/keyboard disentuh
    const idleTime = powerMonitor.getSystemIdleTime();
    
    if (idleTime >= IDLE_THRESHOLD_SECONDS) {
        if (!isIdle) {
            console.log(`⏸️ [Idle] Tidak ada aktivitas selama ${idleTime} detik. Perekaman dijeda...`);
            isIdle = true;
        }
        // Return (berhenti) di sini, jangan jalankan kode screenshot di bawahnya!
        return; 
    } else {
        if (isIdle) {
            console.log('▶️ [Active] Karyawan kembali aktif. Melanjutkan perekaman...');
            isIdle = false;
        }
    }

    // --- 2. KODE SCREENSHOT & UPLOAD ---
    try {
        console.log("Sedang mengambil screenshot layar...");

        // 1. Ambil sumber layar dengan resolusi yang dioptimalkan
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 854, height: 480 }
        });
        const screen = sources[0];

        // 2. Ubah gambar menjadi format JPG Buffer
        const imageBuffer = screen.thumbnail.toJPEG(60);

        // 3. Siapkan form data dengan ID dinamis
        const form = new FormData();
        form.append('user_id', currentUser.id);
        form.append('time_entry_id', currentTimeEntryId);
        form.append('keyboard_clicks', '20');
        form.append('mouse_moves', '15');

        const appAndUrlsPayload = Object.values(aktivitasAplikasi);
        aktivitasAplikasi = {};

        form.append('app_and_urls', JSON.stringify(appAndUrlsPayload));

        form.append('screenshot', imageBuffer, {
            filename: `capture_${Date.now()}.jpg`,
            contentType: 'image/jpeg'
        });

        // 4. Kirim ke Server Backend
        console.log("Mengirim data ke server...");
        const response = await axios.post(`${SERVER_URL}/api/track`, form, {
            headers: {
                ...form.getHeaders()
            }
        });

        console.log("✅ Berhasil Terkirim! Log ID:", response.data.log_id);
        console.log("-----------------------------------------");

    } catch (error) {
        console.error("❌ Gagal mengirim data:", error.message);
    }
}

// --- FUNGSI UNTUK MENUTUP SESI KERJA DI DATABASE ---
async function hentikanSesi() {
    if (!currentTimeEntryId) return;

    try {
        console.log("Menghentikan sesi kerja di database...");
        await axios.post(`${SERVER_URL}/api/stop-session`, {
            time_entry_id: currentTimeEntryId
        });
        console.log("✅ Sesi kerja berhasil ditutup.");
    } catch (err) {
        console.error("❌ Gagal menutup sesi kerja:", err.message);
    }
}
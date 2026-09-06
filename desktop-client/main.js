const { app, BrowserWindow, desktopCapturer, powerMonitor, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Konfigurasi URL Server Utama
const SERVER_URL = process.env.SERVER_URL || 'https://lbstaff.u-u.my.id';

let mainWindow;
let tray = null;
let aktivitasAplikasi = {};

// --- MONITORING INPUT GLOBAL (KEYBOARD & MOUSE) ---
let uIOhook = null;
let keyboardClicksCount = 0;
let mouseMovesCount = 0;
let lastMouseMoveTime = 0;

try {
    const napi = require('uiohook-napi');
    uIOhook = napi.uIOhook;

    // Catat setiap kali tombol keyboard ditekan
    uIOhook.on('keydown', () => {
        keyboardClicksCount++;
    });

    // Catat setiap klik mouse
    uIOhook.on('click', () => {
        mouseMovesCount++;
    });

    // Catat setiap scroll roda mouse
    uIOhook.on('wheel', () => {
        mouseMovesCount++;
    });

    // Catat pergerakan kursor mouse (sampling 1 tick per 100ms agar proporsional dan sangat ringan CPU)
    uIOhook.on('mousemove', () => {
        const now = Date.now();
        if (now - lastMouseMoveTime >= 100) {
            lastMouseMoveTime = now;
            mouseMovesCount++;
        }
    });

    uIOhook.start();
    console.log('✅ [Input Hook] Global keyboard & mouse listener aktif.');
} catch (err) {
    console.warn('⚠️ [Input Hook] Gagal mengaktifkan listener keyboard/mouse:', err.message);
}

// Variabel dinamis untuk menampung data karyawan dan sesi yang sedang aktif
let currentUser = null;
let currentTimeEntryId = null;
let isOfflineMode = false;

// Batas waktu menganggur sebelum perekaman dijeda (300 detik = 5 menit)
const IDLE_THRESHOLD_SECONDS = 300; 
let isIdle = false; // Penanda status saat ini

// Konfigurasi Interval Waktu
const SCREENSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 menit sekali
const RETRY_LOGIN_INTERVAL_MS = 30 * 1000;    // Coba lagi setiap 30 detik jika offline
const MAX_QUEUE_ITEMS = 200;                  // Batas maksimum file antrean lokal (~15-20MB)

let isLoggingIn = false;
let retryLoginTimeout = null;
let isSyncingQueue = false;

// Lokasi penyimpanan data lokal
const userDataPath = app.getPath('userData');
const nikFilePath = path.join(userDataPath, 'nik_tersimpan.txt');
const userCachePath = path.join(userDataPath, 'user_cache.json');
const offlineQueueDir = path.join(userDataPath, 'offline_queue');

// Pastikan direktori antrean offline selalu ada
if (!fs.existsSync(offlineQueueDir)) {
    try {
        fs.mkdirSync(offlineQueueDir, { recursive: true });
    } catch (e) {
        console.error('Gagal membuat folder offline_queue:', e.message);
    }
}

// --- FUNGSI MIGRASI OTOMATIS DARI FOLDER LAMA ---
function migratePreviousDataIfNeeded() {
    try {
        if (!fs.existsSync(nikFilePath)) {
            const legacyDir = path.join(app.getPath('appData'), 'desktop-client');
            const legacyNikPath = path.join(legacyDir, 'nik_tersimpan.txt');
            const legacyCachePath = path.join(legacyDir, 'user_cache.json');

            if (fs.existsSync(legacyNikPath)) {
                const oldNik = fs.readFileSync(legacyNikPath, 'utf8');
                fs.writeFileSync(nikFilePath, oldNik, 'utf8');
                console.log(`[Migration] Sukses memindahkan NIK lama dari desktop-client: ${oldNik.trim()}`);
            }
            if (fs.existsSync(legacyCachePath) && !fs.existsSync(userCachePath)) {
                const oldCache = fs.readFileSync(legacyCachePath, 'utf8');
                fs.writeFileSync(userCachePath, oldCache, 'utf8');
                console.log(`[Migration] Sukses memindahkan cache user lama dari desktop-client.`);
            }
        }
    } catch (err) {
        console.error('[Migration Error]', err.message);
    }
}

// --- HELPER CACHE PENGGUNA ---
function saveUserCache(user) {
    try {
        if (user && user.id) {
            fs.writeFileSync(userCachePath, JSON.stringify(user, null, 2), 'utf8');
        }
    } catch (err) {
        console.error('Gagal menyimpan cache user:', err.message);
    }
}

function loadUserCache() {
    try {
        if (fs.existsSync(userCachePath)) {
            const content = fs.readFileSync(userCachePath, 'utf8').trim();
            if (content) {
                return JSON.parse(content);
            }
        }
    } catch (err) {
        console.error('Gagal membaca cache user:', err.message);
    }
    return null;
}

function clearUserCache() {
    try {
        if (fs.existsSync(nikFilePath)) fs.unlinkSync(nikFilePath);
        if (fs.existsSync(userCachePath)) fs.unlinkSync(userCachePath);
    } catch (err) {
        console.error('Gagal membersihkan file lokal saat logout:', err.message);
    }
}

// --- UPDATE STATUS DI SYSTEM TRAY ---
function updateTrayStatus() {
    if (!tray) return;
    if (!currentUser) {
        tray.setToolTip('Onestaff - Belum Login');
    } else if (isOfflineMode) {
        tray.setToolTip(`Onestaff (Mode Offline) - ${currentUser.name}`);
    } else {
        tray.setToolTip(`Onestaff (Online) - ${currentUser.name}`);
    }
}

// --- MANAJEMEN ANTREAN OFFLINE (OFFLINE BUFFER QUEUE) ---
function saveToOfflineQueue(payload) {
    try {
        if (!fs.existsSync(offlineQueueDir)) {
            fs.mkdirSync(offlineQueueDir, { recursive: true });
        }

        const files = fs.readdirSync(offlineQueueDir).filter(f => f.endsWith('.json')).sort();
        // Proteksi kuota disk: jika antrean melebihi batas, hapus 10 file terlama
        if (files.length >= MAX_QUEUE_ITEMS) {
            for (let i = 0; i < 10 && i < files.length; i++) {
                try { fs.unlinkSync(path.join(offlineQueueDir, files[i])); } catch (e) {}
            }
        }

        const filename = `queue_${Date.now()}_${Math.floor(Math.random() * 1000)}.json`;
        const filePath = path.join(offlineQueueDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
        console.log(`💾 [Offline Queue] Data tersimpan di lokal: ${filename} (Total antrean: ${files.length + 1})`);
    } catch (err) {
        console.error('❌ Gagal menyimpan data ke antrean offline:', err.message);
    }
}

async function flushOfflineQueue() {
    if (isSyncingQueue || !currentUser) return;
    if (!fs.existsSync(offlineQueueDir)) return;

    isSyncingQueue = true;
    try {
        const files = fs.readdirSync(offlineQueueDir).filter(f => f.endsWith('.json')).sort();
        if (files.length === 0) return;

        console.log(`🔄 [Sync Engine] Memeriksa ${files.length} data aktivitas offline untuk dikirim...`);

        for (const file of files) {
            const filePath = path.join(offlineQueueDir, file);
            let payload;
            try {
                payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch (e) {
                // File rusak, hapus
                try { fs.unlinkSync(filePath); } catch (delErr) {}
                continue;
            }

            // Jika sesi online resmi sudah aktif, gantikan id sesi offline
            if (currentTimeEntryId && !String(currentTimeEntryId).startsWith('offline_')) {
                payload.time_entry_id = currentTimeEntryId;
            } else if (String(payload.time_entry_id).startsWith('offline_')) {
                delete payload.time_entry_id;
            }

            try {
                await axios.post(`${SERVER_URL}/api/track`, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 15000
                });
                // Hapus item dari antrean jika server berhasil mencatat
                try { fs.unlinkSync(filePath); } catch (delErr) {}
                console.log(`✅ [Sync Engine] File antrean ${file} berhasil disinkronkan ke server.`);
            } catch (syncErr) {
                console.warn(`⚠️ [Sync Engine] Gagal mengirim ${file} (${syncErr.message}). Sinkronisasi dijeda.`);
                break; // Hentikan loop jika server kembali offline
            }
        }
    } catch (err) {
        console.error('❌ Kesalahan pada mesin sinkronisasi:', err.message);
    } finally {
        isSyncingQueue = false;
    }
}

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

    mainWindow.loadFile(path.join(__dirname, 'views', 'index.html'));

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
    // Jalankan migrasi jika pengguna baru saja upgrade dari versi sebelumnya
    migratePreviousDataIfNeeded();

    createWindow();

    // Setup System Tray
    const iconPath = path.join(__dirname, 'icon.png');
    tray = new Tray(iconPath);
    
    const contextMenu = Menu.buildFromTemplate([
        { 
            label: 'Ganti NIK / Logout', 
            click: async () => { 
                if (retryLoginTimeout) {
                    clearTimeout(retryLoginTimeout);
                    retryLoginTimeout = null;
                }
                await hentikanSesi(); 
                currentUser = null; 
                currentTimeEntryId = null;
                isOfflineMode = false;
                
                // Hapus data tersimpan
                clearUserCache();
                updateTrayStatus();
                mainWindow.show(); // Munculkan form login
            } 
        }
    ]);
    tray.setContextMenu(contextMenu);
    updateTrayStatus();

    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true, path: app.getPath('exe') });

    // --- LOGIKA STARTUP: AUTO-LOGIN & OFFLINE-FIRST ---
    if (fs.existsSync(nikFilePath)) {
        const savedNik = fs.readFileSync(nikFilePath, 'utf8').trim();
        const cachedUser = loadUserCache();

        if (savedNik) {
            if (cachedUser && (cachedUser.nik === savedNik || !cachedUser.nik)) {
                // SANGAT PENTING: Jika ada cache user, langsung aktifkan sesi kerja offline seketika!
                // Aplikasi tidak perlu menunggu koneksi internet dan jendela TIDAK PERLU muncul.
                currentUser = cachedUser;
                currentTimeEntryId = `offline_${Date.now()}`;
                isOfflineMode = true;
                console.log(`⚡ [Offline-First] Memulai sesi offline untuk: ${currentUser.name} (NIK: ${savedNik}). Mulai tracking.`);
                updateTrayStatus();

                // Di latar belakang, hubungi server untuk mendapatkan sesi resmi dan sinkronisasi antrean
                loginDariLatarBelakang(savedNik);
            } else {
                console.log(`[Auto-Login] NIK tersimpan: ${savedNik}. Menghubungi server...`);
                loginDariLatarBelakang(savedNik);
            }
        } else {
            mainWindow.show();
        }
    } else {
        mainWindow.show();
    }

    // Timer Interval Perekaman & Pemantauan
    setInterval(rekamDanKirim, SCREENSHOT_INTERVAL_MS);
    setInterval(pantauJendelaAktif, 1000);
    // Cek berkala flush antrean setiap 60 detik jika online
    setInterval(() => {
        if (currentUser && !isOfflineMode) {
            flushOfflineQueue();
        }
    }, 60 * 1000);
});

// --- FUNGSI LOGIN DARI MAIN.JS (BACKGROUND & OFFLINE RESILIENT) ---
async function loginDariLatarBelakang(nik) {
    if (isLoggingIn) return;
    isLoggingIn = true;

    if (retryLoginTimeout) {
        clearTimeout(retryLoginTimeout);
        retryLoginTimeout = null;
    }

    const cachedUser = loadUserCache();

    try {
        console.log(`[Auto-Login] Menghubungi server (${SERVER_URL})...`);
        const response = await axios.post(`${SERVER_URL}/api/login`, { nik }, { timeout: 10000 });
        
        if (response.data && response.data.success) {
            currentUser = response.data.user;
            currentTimeEntryId = response.data.time_entry_id;
            isOfflineMode = false;

            // Simpan cache user profil & pastikan file NIK ada
            saveUserCache(currentUser);
            fs.writeFileSync(nikFilePath, nik, 'utf8');

            console.log(`✅ [Online-Login Sukses] Terhubung ke server sebagai: ${currentUser.name} (Sesi: ${currentTimeEntryId})`);
            updateTrayStatus();

            // Kirim data offline yang sempat tersimpan saat laptop belum ada internet
            flushOfflineQueue();
        } else {
            console.log(`❌ [Auto-Login Ditolak] Server: ${response.data ? response.data.message : 'Ditolak'}`);
            if (!currentUser) {
                mainWindow.show();
            }
        }
    } catch (error) {
        console.warn(`⚠️ [Auto-Login] Koneksi ke server belum siap atau offline (${error.message}).`);
        
        // Jika belum ada user aktif yang berjalan, coba pakai cache user
        if (!currentUser) {
            if (cachedUser && (cachedUser.nik === nik || !cachedUser.nik)) {
                currentUser = cachedUser;
                currentTimeEntryId = `offline_${Date.now()}`;
                isOfflineMode = true;
                console.log(`⚡ [Offline-First] Sesi lokal aktif untuk: ${currentUser.name}`);
                updateTrayStatus();
            } else {
                console.log('⚠️ Belum ada profil lokal tersimpan. Form login ditampilkan.');
                mainWindow.show();
            }
        } else {
            isOfflineMode = true;
            updateTrayStatus();
        }

        // Jadwalkan coba lagi tiap 30 detik
        retryLoginTimeout = setTimeout(() => {
            loginDariLatarBelakang(nik);
        }, RETRY_LOGIN_INTERVAL_MS);
    } finally {
        isLoggingIn = false;
    }
}

// --- IPC HANDLER: PROSES LOGIN DARI FORM (views/index.html) ---
ipcMain.handle('get-saved-nik', async () => {
    try {
        if (fs.existsSync(nikFilePath)) {
            return fs.readFileSync(nikFilePath, 'utf8').trim();
        }
    } catch (e) {}
    return '';
});

ipcMain.handle('attempt-login', async (event, { nik }) => {
    if (!nik) {
        return { success: false, message: 'NIK tidak boleh kosong' };
    }

    if (retryLoginTimeout) {
        clearTimeout(retryLoginTimeout);
        retryLoginTimeout = null;
    }

    try {
        const response = await axios.post(`${SERVER_URL}/api/login`, { nik }, { timeout: 10000 });

        if (response.data && response.data.success) {
            currentUser = response.data.user;
            currentTimeEntryId = response.data.time_entry_id;
            isOfflineMode = false;

            saveUserCache(currentUser);
            fs.writeFileSync(nikFilePath, nik, 'utf8');

            console.log(`✅ [Login Manual Sukses] Berhasil masuk sebagai: ${currentUser.name}`);
            updateTrayStatus();
            mainWindow.hide();

            flushOfflineQueue();
            return { success: true, offline: false, user: currentUser };
        } else {
            return { success: false, message: response.data ? response.data.message : 'NIK tidak ditemukan di server.' };
        }
    } catch (err) {
        console.warn(`⚠️ [Login Manual Offline] Gagal terhubung ke server (${err.message})`);

        // Cek apakah ada data cache user sebelumnya
        const cachedUser = loadUserCache();
        if (cachedUser && (cachedUser.nik === nik || cachedUser.nik == nik)) {
            currentUser = cachedUser;
            currentTimeEntryId = `offline_${Date.now()}`;
            isOfflineMode = true;

            fs.writeFileSync(nikFilePath, nik, 'utf8');
            console.log(`⚡ [Login Manual Offline] Masuk dengan cache user: ${currentUser.name}`);
            updateTrayStatus();
            mainWindow.hide();

            retryLoginTimeout = setTimeout(() => {
                loginDariLatarBelakang(nik);
            }, RETRY_LOGIN_INTERVAL_MS);

            return { 
                success: true, 
                offline: true, 
                message: 'Masuk dalam mode offline. Data aktivitas akan otomatis disinkronkan saat koneksi internet kembali.', 
                user: currentUser 
            };
        } else {
            return { 
                success: false, 
                message: 'Gagal terhubung ke server. Untuk login pertama kali, perangkat harus memiliki koneksi internet.' 
            };
        }
    }
});

// Backward-compatibility: Jika masih ada event 'login-sukses' lama
ipcMain.on('login-sukses', (event, data) => {
    if (retryLoginTimeout) {
        clearTimeout(retryLoginTimeout);
        retryLoginTimeout = null;
    }
    currentUser = data.user;
    currentTimeEntryId = data.time_entry_id;
    isOfflineMode = false;

    if (currentUser) saveUserCache(currentUser);
    if (data.nik) fs.writeFileSync(nikFilePath, data.nik, 'utf8');

    console.log(`✅ [Login Manual Sukses] Berhasil masuk sebagai: ${currentUser ? currentUser.name : data.nik}`);
    updateTrayStatus();
    mainWindow.hide();
});

// Mencegat proses aplikasi keluar (termasuk saat laptop di-shutdown OS)
app.on('before-quit', async (event) => {
    if (uIOhook) {
        try {
            uIOhook.stop();
        } catch (e) {}
    }
    if (currentTimeEntryId && !app.isSessionClosed) {
        event.preventDefault();
        
        await hentikanSesi();
        
        app.isSessionClosed = true;
        app.quit();
    }
});

// Fungsi untuk memantau jendela aktif secara real-time
async function pantauJendelaAktif() {
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
        // Abaikan error pembacaan jendela agar tidak membanjiri log
    }
}

// Fungsi inti untuk mengambil screenshot dan mengirim payload
async function rekamDanKirim() {
    if (!currentUser) return;

    // --- 1. LOGIKA DETEKSI IDLE (MENGANGGUR) ---
    const idleTime = powerMonitor.getSystemIdleTime();
    
    if (idleTime >= IDLE_THRESHOLD_SECONDS) {
        if (!isIdle) {
            console.log(`⏸️ [Idle] Tidak ada aktivitas selama ${idleTime} detik. Perekaman dijeda...`);
            isIdle = true;
        }
        return; 
    } else {
        if (isIdle) {
            console.log('▶️ [Active] Karyawan kembali aktif. Melanjutkan perekaman...');
            isIdle = false;
        }
    }

    // --- 2. KODE SCREENSHOT & PAYLOAD ---
    try {
        console.log("Sedang mengambil screenshot layar...");

        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 854, height: 480 }
        });
        const screen = sources[0];

        const imageBuffer = screen.thumbnail.toJPEG(60);
        const screenshot_base64 = imageBuffer.toString('base64');

        const appAndUrlsPayload = Object.values(aktivitasAplikasi);
        aktivitasAplikasi = {};

        // Ambil metrik riil keyboard & mouse, lalu reset untuk interval berikutnya
        const currentKeyboardClicks = keyboardClicksCount;
        const currentMouseMoves = mouseMovesCount;
        keyboardClicksCount = 0;
        mouseMovesCount = 0;

        console.log(`📊 [Metrik Aktivitas] Keyboard: ${currentKeyboardClicks} ketikan | Mouse: ${currentMouseMoves} gerakan/klik`);

        const payload = {
            user_id: currentUser.id,
            time_entry_id: currentTimeEntryId,
            keyboard_clicks: currentKeyboardClicks,
            mouse_moves: currentMouseMoves,
            app_and_urls: appAndUrlsPayload,
            screenshot_base64: screenshot_base64,
            recorded_at: new Date().toISOString()
        };

        // Jika sedang mode offline atau sesi offline, langsung simpan ke antrean lokal
        if (isOfflineMode || String(currentTimeEntryId).startsWith('offline_')) {
            console.log("⚡ [Offline Mode] Menyimpan hasil rekam ke antrean lokal...");
            saveToOfflineQueue(payload);
            return;
        }

        // Coba kirim langsung ke server online
        try {
            console.log("Mengirim data ke server...");
            const response = await axios.post(`${SERVER_URL}/api/track`, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            });

            console.log("✅ Berhasil Terkirim! Log ID:", response.data.log_id);
            console.log("-----------------------------------------");

            // Kuras antrean lama jika ada
            flushOfflineQueue();

        } catch (sendError) {
            console.warn(`⚠️ Gagal mengirim data ke server (${sendError.message}). Mengalihkan ke antrean lokal.`);
            isOfflineMode = true;
            updateTrayStatus();
            saveToOfflineQueue(payload);

            const savedNik = fs.existsSync(nikFilePath) ? fs.readFileSync(nikFilePath, 'utf8').trim() : (currentUser.nik || '');
            if (savedNik && !retryLoginTimeout) {
                retryLoginTimeout = setTimeout(() => {
                    loginDariLatarBelakang(savedNik);
                }, RETRY_LOGIN_INTERVAL_MS);
            }
        }

    } catch (error) {
        console.error("❌ Gagal memproses perekaman:", error.message);
    }
}

// --- FUNGSI UNTUK MENUTUP SESI KERJA DI DATABASE ---
async function hentikanSesi() {
    if (!currentTimeEntryId) return;

    if (String(currentTimeEntryId).startsWith('offline_')) {
        console.log("Sesi offline dihentikan secara lokal.");
        return;
    }

    try {
        console.log("Menghentikan sesi kerja di database...");
        await axios.post(`${SERVER_URL}/api/stop-session`, {
            time_entry_id: currentTimeEntryId
        }, { timeout: 10000 });
        console.log("✅ Sesi kerja berhasil ditutup.");
    } catch (err) {
        console.error("❌ Gagal menutup sesi kerja online:", err.message);
    }
}
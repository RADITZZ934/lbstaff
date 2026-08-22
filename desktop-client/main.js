const { app, BrowserWindow, desktopCapturer } = require('electron');
const axios = require('axios');
const FormData = require('form-data');

let mainWindow;
let aktivitasAplikasi = {};

function createWindow() {
    // Membuat jendela aplikasi dasar (nantinya bisa diatur show: false agar tersembunyi)
    mainWindow = new BrowserWindow({
        width: 400,
        height: 300,
        show: true,
        webPreferences: {
            nodeIntegration: true
        }
    });

    // Tampilan sederhana agar kita tahu aplikasi sedang jalan
    mainWindow.loadURL('data:text/html,<h2 style="font-family:sans-serif; text-align:center;">Perekam Karyawan Aktif</h2><p style="text-align:center;">Berjalan di latar belakang...</p>');
}

// Dijalankan saat aplikasi siap
app.whenReady().then(() => {
    createWindow();
    console.log("Aplikasi Desktop Berjalan...");

    // PENTING: Untuk keperluan uji coba, kita atur jedanya menjadi 15 DETIK
    // (Nantinya diubah menjadi 10 menit / 600000 ms)
    setInterval(rekamDanKirim, 15000);

    // Pantau jendela aktif setiap 1 detik
    setInterval(pantauJendelaAktif, 1000);
});

// Fungsi untuk memantau jendela aktif secara real-time
async function pantauJendelaAktif() {
    try {
        const { default: activeWin } = await import('active-win');
        const window = await activeWin();
        
        if (window) {
            const appName = window.owner.name; 
            const windowTitle = window.title;  
            
            // --- TAMBAHKAN BARIS LOG INI ---
            console.log(`[Pendeteksi] Membaca: ${appName} | ${windowTitle}`);
            // -------------------------------

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
    try {
        console.log("Sedang mengambil screenshot layar...");

        // 1. Ambil sumber layar (Layar utama) dengan resolusi HD
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1280, height: 720 }
        });
        const screen = sources[0];

        // 2. Ubah gambar menjadi format JPG (Buffer) dengan kualitas 80%
        const imageBuffer = screen.thumbnail.toJPEG(80);

        // 3. Siapkan keranjang data (Form-Data) persis seperti di Postman
        const form = new FormData();

        // ID ini adalah ID Dummy dari database Anda yang sudah berhasil diuji sebelumnya
        form.append('user_id', '123e4567-e89b-12d3-a456-426614174000');
        form.append('time_entry_id', '123e4567-e89b-12d3-a456-426614174001');

        // Data aktivitas tiruan (nantinya diganti dengan deteksi riil)
        form.append('keyboard_clicks', '20');
        form.append('mouse_moves', '15');
        
        // Ambil data snapshot aktivitas saat ini untuk dikirim, lalu reset untuk periode berikutnya
        const appAndUrlsPayload = Object.values(aktivitasAplikasi);
        aktivitasAplikasi = {};
        
        form.append('app_and_urls', JSON.stringify(appAndUrlsPayload));

        // Masukkan file gambar yang baru saja ditangkap
        form.append('screenshot', imageBuffer, {
            filename: `capture_${Date.now()}.jpg`,
            contentType: 'image/jpeg'
        });

        // 4. Kirim ke Server Backend Anda (Pastikan server node server.js sedang menyala!)
        console.log("Mengirim data ke server...");
        const response = await axios.post('http://localhost:3000/api/track', form, {
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
<template>
  <div class="detail-page">
    <!-- Tombol Refresh Melayang (Hanya muncul jika ada log baru) -->
    <div v-if="newLogsCount > 0" class="floating-refresh">
      <button @click="handleRefresh" class="btn-refresh">
        Update {{ newLogsCount }} latest record &uarr;
      </button>
    </div>

    <!-- Header Navigasi -->
    <div class="header-nav">
      <NuxtLink to="/" class="btn-back">
        &larr; Kembali ke Dashboard
      </NuxtLink>
    </div>

    <!-- Tampilkan loading atau pesan error -->
    <div v-if="pending" class="loading-state">Memuat data aktivitas...</div>
    <div v-else-if="error" class="error-state">Gagal mengambil data atau karyawan sedang offline.</div>
    
    <!-- Konten Utama -->
    <div v-else-if="apiResponse?.success">
      <div class="user-profile">
        <div class="avatar-huge">{{ apiResponse.user.name.charAt(0).toUpperCase() }}</div>
        <div>
          <h1>{{ apiResponse.user.name }}</h1>
          <p class="subtitle">NIK: {{ apiResponse.user.nik }} | Mulai Shift: {{ formatWaktu(apiResponse.user.start_time) }}</p>
        </div>
      </div>

      <h2 class="section-title">Timeline Pekerjaan Terbaru</h2>
      
      <div v-if="!apiResponse.logs || apiResponse.logs.length === 0" class="empty-state">
        <p>Belum ada aktivitas terekam. Aplikasi merekam setiap 15 detik.</p>
      </div>

      <!-- Galeri & Log List -->
      <div v-else class="timeline-grid">
        <div v-for="log in apiResponse.logs" :key="log.id" class="log-card">
          <!-- Thumbnail Screenshot (Dapat diklik untuk Zoom) -->
          <div 
            class="screenshot-wrapper" 
            @click="openModal(resolveImage(log.screenshot_path || log.screenshot_url), formatWaktu(log.created_at || log.recorded_at))"
          >
            <img 
              v-if="log.screenshot_path || log.screenshot_url" 
              :src="resolveImage(log.screenshot_path || log.screenshot_url)" 
              alt="Screenshot" 
              class="screenshot-img"
              loading="lazy"
            />
            <div v-else class="no-image">Tidak ada gambar</div>
            <div class="timestamp">{{ formatWaktu(log.created_at || log.recorded_at) }}</div>
            <div class="zoom-hint">🔍 Klik untuk perbesar</div>
          </div>
          
          <!-- Daftar Aplikasi yang Dibuka -->
          <div class="app-list">
            <h4>Aplikasi Aktif:</h4>
            <ul>
              <li v-for="(appItem, index) in parseAppList(log.app_and_urls)" :key="index">
                {{ formatApp(appItem) }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Modal Preview Screenshot Resolusi Penuh -->
      <div v-if="previewImage" class="modal-overlay" @click="closeModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <span>Screenshot Layar - {{ previewTimestamp }}</span>
            <button class="close-btn" @click="closeModal">&times;</button>
          </div>
          <img :src="previewImage" alt="Preview Penuh" class="modal-img"/>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const route = useRoute()
const nikKaryawan = route.params.nik

// Variabel penyimpan jumlah data baru & waktu terakhir refresh
const newLogsCount = ref(0)
const lastRefreshTime = ref(new Date().toISOString())
let pollingInterval = null

// Modal Zoom State
const previewImage = ref(null)
const previewTimestamp = ref('')

const openModal = (url, timestamp) => {
  if (!url) return
  previewImage.value = url
  previewTimestamp.value = timestamp
}

const closeModal = () => {
  previewImage.value = null
  previewTimestamp.value = ''
}

// Panggil API ke backend Node.js
const { data: apiResponse, pending, error, refresh } = await useFetch(`http://192.168.110.57:3001/api/user-activity/${nikKaryawan}`, {
  lazy: true
})

// Fungsi untuk diam-diam mengecek data baru ke server
const checkForNewLogs = async () => {
  if (!apiResponse.value?.success) return

  try {
    const res = await $fetch(`http://192.168.110.57:3001/api/user-activity/${nikKaryawan}/check-new?last_time=${encodeURIComponent(lastRefreshTime.value)}`)
    if (res.success) {
      newLogsCount.value = res.new_count
    }
  } catch (e) {
    console.error('Gagal mengecek data baru', e)
  }
}

// Fungsi helper untuk mendapatkan waktu log paling baru dari database
const getLatestLogTime = () => {
  if (apiResponse.value?.logs && apiResponse.value.logs.length > 0) {
    return apiResponse.value.logs[0].recorded_at || apiResponse.value.logs[0].created_at
  }
  return apiResponse.value?.user?.start_time || new Date().toISOString()
}

// Mulai pengecekan otomatis saat halaman dibuka
onMounted(async () => {
  await refresh()
  // Gunakan timestamp database sebagai baseline (menghindari perbedaan timezone local/UTC)
  lastRefreshTime.value = getLatestLogTime()
  newLogsCount.value = 0
  // Baru mulai polling setelah data terbaru dimuat
  pollingInterval = setInterval(checkForNewLogs, 15000)
})

// Hentikan pengecekan jika HRD pindah ke halaman lain
onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval)
})

// Fungsi saat tombol "Refresh" diklik
const handleRefresh = async () => {
  // 1. Hentikan polling dulu agar tidak menimpa count saat refresh
  if (pollingInterval) clearInterval(pollingInterval)
  newLogsCount.value = 0
  // 2. Tarik data terbaru
  await refresh()
  // 3. Reset baseline ke waktu database teratas yang baru masuk
  lastRefreshTime.value = getLatestLogTime()
  // 4. Nyalakan polling kembali
  pollingInterval = setInterval(checkForNewLogs, 15000)
}

const resolveImage = (path) => {
  if (!path) return ''
  let cleanPath = path.replace(/\\/g, '/')
  if (cleanPath.startsWith('http')) return cleanPath
  if (cleanPath.includes('lbstaff_uploads/')) cleanPath = cleanPath.split('lbstaff_uploads/')[1]
  if (cleanPath.startsWith('uploads/')) cleanPath = cleanPath.replace('uploads/', '')
  return `http://192.168.110.57:3001/uploads/${cleanPath}`
}

const formatWaktu = (waktuISO) => {
  if (!waktuISO) return '-'
  const date = new Date(waktuISO)
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const parseAppList = (appData) => {
  if (!appData) return ['Aplikasi tidak terdeteksi']
  let list = appData
  if (typeof appData === 'string') {
    try {
      list = JSON.parse(appData)
    } catch (e) {
      return [appData]
    }
  }
  if (!Array.isArray(list) || list.length === 0) {
    return ['Aplikasi tidak terdeteksi']
  }
  return list
}

const formatApp = (app) => {
  if (!app) return 'Aplikasi tidak terdeteksi'
  if (typeof app === 'object') {
    const name = app.app_name || ''
    const title = app.window_title ? ` (${app.window_title})` : ''
    return `${name}${title}` || 'Aplikasi tidak terdeteksi'
  }
  return app
}
</script>

<style scoped>
/* Styling Tombol Melayang */
.floating-refresh {
  position: fixed;
  top: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  animation: slideDown 0.3s ease-out;
}

.btn-refresh {
  background: #2563eb;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 30px;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-refresh:hover {
  background: #1d4ed8;
  transform: translateY(-2px);
  box-shadow: 0 12px 20px -3px rgba(37, 99, 235, 0.5);
}

@keyframes slideDown {
  from { top: -50px; opacity: 0; }
  to { top: 32px; opacity: 1; }
}

.header-nav { margin-bottom: 24px; }
.btn-back { display: inline-block; padding: 8px 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; text-decoration: none; color: #475569; font-weight: 500; transition: all 0.2s; }
.btn-back:hover { background: #f8fafc; color: #0f172a; }

.user-profile { display: flex; align-items: center; gap: 24px; margin-bottom: 40px; background: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; }
.avatar-huge { width: 72px; height: 72px; border-radius: 16px; background: #e0e7ff; color: #4f46e5; font-size: 32px; font-weight: bold; display: flex; align-items: center; justify-content: center; }
.user-profile h1 { margin: 0 0 8px 0; color: #0f172a; }
.subtitle { margin: 0; color: #64748b; font-size: 15px; }

.section-title { font-size: 18px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 24px; }

.timeline-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; }

.log-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: transform 0.2s ease; }
.log-card:hover { transform: translateY(-2px); }

.screenshot-wrapper { position: relative; height: 200px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #e2e8f0; cursor: pointer; overflow: hidden; }
.screenshot-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
.screenshot-wrapper:hover .screenshot-img { transform: scale(1.04); }

.zoom-hint { position: absolute; bottom: 8px; left: 8px; background: rgba(15, 23, 42, 0.75); color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 6px; backdrop-filter: blur(4px); opacity: 0; transition: opacity 0.2s; }
.screenshot-wrapper:hover .zoom-hint { opacity: 1; }

.no-image { color: #94a3b8; font-size: 14px; }
.timestamp { position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.7); color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; backdrop-filter: blur(4px); }

.app-list { padding: 16px; }
.app-list h4 { margin: 0 0 12px 0; font-size: 14px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
.app-list ul { margin: 0; padding-left: 20px; color: #1e293b; font-size: 14px; line-height: 1.6; }
.app-list li { margin-bottom: 4px; word-break: break-all; }

.empty-state, .loading-state, .error-state { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 48px; text-align: center; color: #64748b; }
.error-state { color: #ef4444; background: #fef2f2; border-color: #fca5a5; }

/* Modal Lightbox */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 24px; box-sizing: border-box; }
.modal-content { background: #1e293b; border-radius: 16px; overflow: hidden; max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #0f172a; color: #f8fafc; font-size: 14px; font-weight: 600; }
.close-btn { background: transparent; border: none; color: #94a3b8; font-size: 24px; cursor: pointer; line-height: 1; transition: color 0.2s; }
.close-btn:hover { color: #fff; }
.modal-img { max-width: 85vw; max-height: calc(85vh - 50px); object-fit: contain; display: block; }
</style>

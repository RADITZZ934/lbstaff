<template>
  <div class="detail-page">
    <!-- Tombol Refresh Melayang (Hanya muncul jika ada log baru) -->
    <div v-if="newLogsCount > 0" class="floating-refresh">
      <button @click="handleRefresh" class="btn-refresh">
        Update {{ newLogsCount }} record terbaru &uarr;
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

      <!-- Toolbar Pilihan Tampilan Grid / Layout -->
      <div class="layout-selector-card">
        <span class="selector-label">Pilihan Tampilan:</span>
        <div class="selector-buttons">
          <button 
            :class="['btn-layout', { active: currentLayout === 'split' }]" 
            @click="currentLayout = 'split'"
            title="Tampilan Split ala YouTube"
          >
            Split
          </button>
          <button 
            :class="['btn-layout', { active: currentLayout === 'grid' }]" 
            @click="currentLayout = 'grid'"
            title="Tampilan Grid Grid Asli"
          >
            Grid
          </button>
          <button 
            :class="['btn-layout', { active: currentLayout === 'list' }]" 
            @click="currentLayout = 'list'"
            title="Tampilan List Kompak"
          >
            List
          </button>
        </div>
      </div>

      <div v-if="!apiResponse.logs || apiResponse.logs.length === 0" class="empty-state">
        <p>Belum ada aktivitas terekam. Aplikasi merekam setiap 15 detik.</p>
      </div>

      <div v-else>
        <!-- 1. YouTube Style Split Layout -->
        <div v-if="currentLayout === 'split'" class="youtube-container">
          <!-- Left Side: Main View (Big Screen) -->
          <div class="main-view">
            <div class="large-screen-card">
              <div class="large-screenshot-wrapper">
                <img 
                  v-if="selectedLog?.screenshot_path || selectedLog?.screenshot_url" 
                  :src="resolveImage(selectedLog.screenshot_path || selectedLog.screenshot_url)" 
                  alt="Screenshot Layar" 
                  class="large-screenshot"
                />
                <div v-else class="no-image-large">Tidak ada gambar untuk aktivitas ini</div>
                <div class="large-timestamp">Terekam: {{ formatWaktu(selectedLog?.created_at || selectedLog?.recorded_at) }}</div>
              </div>
              
              <div class="large-details-panel">
                <div class="details-header">
                  <h2>{{ getPrimaryAppTitle(selectedLog) }}</h2>
                  <div class="activity-metrics">
                    <span class="metric-badge keyboard"><i class="fa-solid fa-keyboard"></i> Keyboard: {{ selectedLog?.keyboard_clicks || 0 }} klik</span>
                    <span class="metric-badge mouse"><i class="fa-solid fa-mouse"></i> Mouse: {{ selectedLog?.mouse_moves || 0 }} gerak</span>
                  </div>
                </div>
                
                <div class="app-details-list">
                  <h3>Aplikasi yang Terbuka dalam Sesi Ini:</h3>
                  <ul class="clean-app-list">
                    <li v-for="(appItem, idx) in parseAppList(selectedLog?.app_and_urls)" :key="idx" class="app-detail-item">
                      <span class="app-bullet">▪</span> {{ formatApp(appItem) }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Side: Playlist Sidebar (List of logs) -->
          <div class="playlist-sidebar">
            <div class="sidebar-header">
              <h3>Timeline Aktivitas</h3>
              <span class="records-count">{{ apiResponse.logs.length }} rekaman</span>
            </div>
            <div class="playlist-items-container">
              <div 
                v-for="(log, index) in apiResponse.logs" 
                :key="log.id" 
                :class="['playlist-item', { active: index === selectedIndex }]"
                @click="selectedIndex = index"
              >
                <div class="playlist-thumb-wrapper">
                  <img 
                    v-if="log.screenshot_path || log.screenshot_url" 
                    :src="resolveImage(log.screenshot_path || log.screenshot_url)" 
                    alt="Thumbnail" 
                    class="playlist-thumb"
                    loading="lazy"
                  />
                  <div v-else class="playlist-no-image">No Image</div>
                  <div class="playlist-time">{{ formatWaktu(log.created_at || log.recorded_at) }}</div>
                </div>
                <div class="playlist-info">
                  <h4 class="playlist-title">{{ getPrimaryAppTitle(log) }}</h4>
                  <div class="playlist-meta">
                    <span><i class="fa-solid fa-keyboard"></i> {{ log.keyboard_clicks || 0 }} | <i class="fa-solid fa-mouse"></i> {{ log.mouse_moves || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Original Grid Layout -->
        <div v-else-if="currentLayout === 'grid'" class="timeline-grid">
          <div v-for="log in apiResponse.logs" :key="log.id" class="log-card">
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
              <div class="zoom-hint"><i class="fa-solid fa-magnifying-glass-plus"></i> Klik untuk perbesar</div>
            </div>
            
            <div class="app-list">
              <div class="card-stats">
                <span class="badge-mini keyboard"><i class="fa-solid fa-keyboard"></i> {{ log.keyboard_clicks || 0 }}</span>
                <span class="badge-mini mouse"><i class="fa-solid fa-mouse"></i> {{ log.mouse_moves || 0 }}</span>
              </div>
              <h4>Aplikasi Aktif:</h4>
              <ul>
                <li v-for="(appItem, idx) in parseAppList(log.app_and_urls)" :key="idx">
                  {{ formatApp(appItem) }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 3. List / Compact Layout -->
        <div v-else-if="currentLayout === 'list'" class="list-container">
          <div v-for="log in apiResponse.logs" :key="log.id" class="list-row">
            <div 
              class="list-thumb-wrapper"
              @click="openModal(resolveImage(log.screenshot_path || log.screenshot_url), formatWaktu(log.created_at || log.recorded_at))"
            >
              <img 
                v-if="log.screenshot_path || log.screenshot_url" 
                :src="resolveImage(log.screenshot_path || log.screenshot_url)" 
                alt="Thumbnail" 
                class="list-thumb"
                loading="lazy"
              />
              <div v-else class="list-no-image">No Image</div>
              <div class="zoom-hint-mini"><i class="fa-solid fa-magnifying-glass-plus"></i></div>
            </div>
            
            <div class="list-content">
              <div class="list-header">
                <span class="list-time">Terekam: {{ formatWaktu(log.created_at || log.recorded_at) }}</span>
                <div class="list-stats">
                  <span class="badge-mini keyboard"><i class="fa-solid fa-keyboard"></i> Keyboard: {{ log.keyboard_clicks || 0 }}</span>
                  <span class="badge-mini mouse"><i class="fa-solid fa-mouse"></i> Mouse: {{ log.mouse_moves || 0 }}</span>
                </div>
              </div>
              <div class="list-apps">
                <strong>Aplikasi Aktif:</strong>
                <div class="list-app-tags">
                  <span v-for="(appItem, idx) in parseAppList(log.app_and_urls)" :key="idx" class="app-tag">
                    {{ formatApp(appItem) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Preview Screenshot Resolusi Penuh (Untuk mode Grid dan List) -->
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const route = useRoute()
const nikKaryawan = computed(() => route.params.nik)

// Variabel penyimpan jumlah data baru & waktu terakhir refresh
const newLogsCount = ref(0)
const lastRefreshTime = ref(new Date().toISOString())
let pollingInterval = null

// Pilihan Layout Aktif: 'split', 'grid', 'list'
const currentLayout = ref('split')

// Indeks log yang sedang dipilih (untuk Split Layout)
const selectedIndex = ref(0)

// Modal Zoom State (untuk Grid & List Layout)
const previewImage = ref(null)
const previewTimestamp = ref('')

// Panggil API untuk log aktivitas karyawan yang aktif saat ini
const { data: apiResponse, pending, error, refresh } = await useFetch(() => `http://192.168.110.57:3001/api/user-activity/${nikKaryawan.value}`, {
  lazy: true
})

// Watcher untuk mendeteksi perubahan parameter NIK (Navigasi Karyawan)
watch(nikKaryawan, async (newNik) => {
  if (newNik) {
    selectedIndex.value = 0
    await refresh()
  }
})

// Log yang sedang aktif dipilih (untuk Split Layout)
const selectedLog = computed(() => {
  const logs = apiResponse.value?.logs || []
  if (logs.length === 0) return null
  if (selectedIndex.value >= logs.length) {
    selectedIndex.value = 0
  }
  return logs[selectedIndex.value]
})

// Ambil judul aplikasi utama dari log
const getPrimaryAppTitle = (log) => {
  if (!log) return 'Mengambil data...'
  const apps = parseAppList(log.app_and_urls)
  if (apps.length > 0 && apps[0] !== 'Aplikasi tidak terdeteksi') {
    return formatApp(apps[0])
  }
  return 'Aktivitas Tidak Diketahui'
}

// Fungsi untuk diam-diam mengecek data baru ke server
const checkForNewLogs = async () => {
  if (!apiResponse.value?.success) return

  try {
    const res = await $fetch(`http://192.168.110.57:3001/api/user-activity/${nikKaryawan.value}/check-new?last_time=${encodeURIComponent(lastRefreshTime.value)}`)
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
  lastRefreshTime.value = getLatestLogTime()
  newLogsCount.value = 0
  pollingInterval = setInterval(checkForNewLogs, 15000)
})

// Hentikan pengecekan jika HRD pindah ke halaman lain
onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval)
})

// Fungsi saat tombol "Refresh" diklik
const handleRefresh = async () => {
  if (pollingInterval) clearInterval(pollingInterval)
  newLogsCount.value = 0
  await refresh()
  selectedIndex.value = 0 
  lastRefreshTime.value = getLatestLogTime()
  pollingInterval = setInterval(checkForNewLogs, 15000)
}

const openModal = (url, timestamp) => {
  if (!url) return
  previewImage.value = url
  previewTimestamp.value = timestamp
}

const closeModal = () => {
  previewImage.value = null
  previewTimestamp.value = ''
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

.user-profile { display: flex; align-items: center; gap: 24px; margin-bottom: 20px; background: #ffffff; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; }
.avatar-huge { width: 64px; height: 64px; border-radius: 16px; background: #e0e7ff; color: #4f46e5; font-size: 28px; font-weight: bold; display: flex; align-items: center; justify-content: center; }
.user-profile h1 { margin: 0 0 4px 0; color: #0f172a; font-size: 22px; }
.subtitle { margin: 0; color: #64748b; font-size: 14px; }

/* Layout Selector Card styling */
.layout-selector-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 28px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
}

.selector-label {
  font-size: 14px;
  font-weight: 600;
  color: #475569;
}

.selector-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-layout {
  padding: 10px 18px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background-color: #f8fafc;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-layout:hover {
  background-color: #f1f5f9;
  color: #0f172a;
}

.btn-layout.active {
  background-color: #eff6ff;
  border-color: #3b82f6;
  color: #2563eb;
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1);
}

/* --- 1. Split Layout (YouTube Container) --- */
.youtube-container {
  display: flex;
  gap: 28px;
  align-items: flex-start;
}

@media (max-width: 1024px) {
  .youtube-container {
    flex-direction: column;
  }
}

.main-view {
  flex: 1;
  min-width: 0;
}

.large-screen-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
}

.large-screenshot-wrapper {
  position: relative;
  background: #0f172a;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #e2e8f0;
}

.large-screenshot {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.no-image-large {
  color: #64748b;
  font-size: 16px;
}

.large-timestamp {
  position: absolute;
  bottom: 16px;
  right: 16px;
  background: rgba(15, 23, 42, 0.8);
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  backdrop-filter: blur(4px);
}

.large-details-panel {
  padding: 24px;
}

.details-header {
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 18px;
  margin-bottom: 18px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.details-header h2 {
  margin: 0;
  font-size: 20px;
  color: #0f172a;
  font-weight: 700;
  line-height: 1.4;
  word-break: break-word;
}

.activity-metrics {
  display: flex;
  gap: 12px;
}

.metric-badge {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 20px;
}

.metric-badge.keyboard {
  background-color: #eff6ff;
  color: #2563eb;
}

.metric-badge.mouse {
  background-color: #f0fdf4;
  color: #16a34a;
}

.app-details-list h3 {
  margin: 0 0 14px 0;
  font-size: 14px;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.clean-app-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.app-detail-item {
  font-size: 14px;
  color: #334155;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  word-break: break-all;
}

.app-bullet {
  color: #94a3b8;
  font-size: 12px;
  margin-top: 1px;
}

/* Playlist Sidebar styling */
.playlist-sidebar {
  width: 380px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
}

@media (max-width: 1024px) {
  .playlist-sidebar {
    width: 100%;
  }
}

.sidebar-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background-color: #f8fafc;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.records-count {
  font-size: 12px;
  color: #64748b;
  background-color: #f1f5f9;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 600;
}

.playlist-items-container {
  max-height: 600px;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.playlist-items-container::-webkit-scrollbar {
  width: 6px;
}
.playlist-items-container::-webkit-scrollbar-track {
  background: #f8fafc;
}
.playlist-items-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.playlist-item {
  display: flex;
  gap: 12px;
  padding: 8px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.playlist-item:hover {
  background-color: #f1f5f9;
}

.playlist-item.active {
  background-color: #eff6ff;
  border-color: #bfdbfe;
}

.playlist-thumb-wrapper {
  position: relative;
  width: 120px;
  aspect-ratio: 16 / 9;
  background-color: #0f172a;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.playlist-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-no-image {
  color: #94a3b8;
  font-size: 11px;
}

.playlist-time {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.75);
  color: #ffffff;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.playlist-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.playlist-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-meta {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
}


/* --- 2. Original Grid Layout styling --- */
.timeline-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.log-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.log-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
}

.screenshot-wrapper {
  position: relative;
  height: 180px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  overflow: hidden;
}

.screenshot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.screenshot-wrapper:hover .screenshot-img {
  transform: scale(1.04);
}

.zoom-hint {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(15, 23, 42, 0.75);
  color: #fff;
  font-size: 11px;
  padding: 3.5px 8px;
  border-radius: 6px;
  backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 0.2s;
}

.screenshot-wrapper:hover .zoom-hint { opacity: 1; }
.no-image { color: #94a3b8; font-size: 14px; }
.timestamp { position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.7); color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; backdrop-filter: blur(4px); }

.app-list {
  padding: 16px;
}

.card-stats {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.badge-mini {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
}

.badge-mini.keyboard { background-color: #eff6ff; color: #2563eb; }
.badge-mini.mouse { background-color: #f0fdf4; color: #16a34a; }

.app-list h4 {
  margin: 0 0 10px 0;
  font-size: 13px;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.app-list ul {
  margin: 0;
  padding-left: 18px;
  color: #1e293b;
  font-size: 13.5px;
  line-height: 1.5;
}

.app-list li {
  margin-bottom: 4px;
  word-break: break-all;
}


/* --- 3. Compact List Layout styling --- */
.list-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.list-row {
  display: flex;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
  gap: 20px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
  transition: transform 0.2s, box-shadow 0.2s;
}

.list-row:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 12px -3px rgba(0, 0, 0, 0.04);
}

.list-thumb-wrapper {
  position: relative;
  width: 140px;
  aspect-ratio: 16 / 9;
  background-color: #f1f5f9;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.list-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.list-no-image {
  color: #94a3b8;
  font-size: 12px;
}

.zoom-hint-mini {
  position: absolute;
  bottom: 4px;
  left: 4px;
  background: rgba(15, 23, 42, 0.75);
  color: white;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 10px;
  opacity: 0;
  transition: opacity 0.2s;
}

.list-thumb-wrapper:hover .zoom-hint-mini {
  opacity: 1;
}

.list-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.list-time {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.list-stats {
  display: flex;
  gap: 8px;
}

.list-apps {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.list-apps strong {
  font-size: 12px;
  color: #475569;
  text-transform: uppercase;
}

.list-app-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.app-tag {
  font-size: 12px;
  background-color: #f1f5f9;
  color: #334155;
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  word-break: break-all;
}


/* General Helpers */
.empty-state, .loading-state, .error-state {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 48px;
  text-align: center;
  color: #64748b;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
}

.error-state {
  color: #ef4444;
  background: #fef2f2;
  border-color: #fca5a5;
}

/* Modal Lightbox styling */
.modal-overlay { 
  position: fixed; 
  top: 0; 
  left: 0; 
  width: 100vw; 
  height: 100vh; 
  background: rgba(15, 23, 42, 0.85); 
  backdrop-filter: blur(6px); 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  z-index: 9999; 
  padding: 24px; 
  box-sizing: border-box; 
}

.modal-content { 
  background: #1e293b; 
  border-radius: 16px; 
  overflow: hidden; 
  max-width: 90vw; 
  max-height: 90vh; 
  display: flex; 
  flex-direction: column; 
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); 
}

.modal-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 14px 20px; 
  background: #0f172a; 
  color: #f8fafc; 
  font-size: 14px; 
  font-weight: 600; 
}

.close-btn { 
  background: transparent; 
  border: none; 
  color: #94a3b8; 
  font-size: 24px; 
  cursor: pointer; 
  line-height: 1; 
  transition: color 0.2s; 
}

.close-btn:hover { color: #fff; }
.modal-img { max-width: 85vw; max-height: calc(85vh - 50px); object-fit: contain; display: block; }
</style>

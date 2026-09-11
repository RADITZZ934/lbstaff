<template>
  <div class="location-page">
    <div class="page-header">
      <div class="header-left">
        <h1>📍 Peta Lokasi Karyawan</h1>
        <p class="subtitle">Pantau sebaran lokasi real-time sesi kerja karyawan.</p>
      </div>
      <div class="header-actions">
        <button @click="refreshData" class="btn-refresh" :disabled="pending">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          {{ pending ? 'Memuat...' : 'Refresh Peta' }}
        </button>
      </div>
    </div>

    <!-- Ringkasan Statistik -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Total Karyawan</span>
        <span class="stat-value">{{ activeUsers.length }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Terdeteksi Lokasi</span>
        <span class="stat-value text-blue">{{ usersWithLocation.length }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Sedang Merekam</span>
        <span class="stat-value text-green">{{ onlineCount }}</span>
      </div>
    </div>

    <!-- Main Map Container -->
    <div class="map-layout">
      <!-- Container Peta Leaflet -->
      <div class="map-wrapper">
        <div id="leaflet-map" class="map-container"></div>
        <div v-if="pending" class="map-overlay-loading">
          <span>Memuat data peta & titik lokasi...</span>
        </div>
      </div>

      <!-- Side List Karyawan -->
      <div class="location-sidebar">
        <h3>Daftar Lokasi Karyawan</h3>

        <div v-if="activeUsers.length === 0" class="empty-list">
          Belum ada data karyawan.
        </div>

        <div v-else class="staff-location-list">
          <div 
            v-for="user in activeUsers" 
            :key="user.nik" 
            class="staff-loc-card"
            :class="{ active: selectedUserNik === user.nik }"
            @click="focusUserOnMap(user)"
          >
            <div class="card-top">
              <div class="avatar-small">{{ (user.alias || user.name).charAt(0).toUpperCase() }}</div>
              <div class="staff-meta">
                <h4>{{ user.alias || user.name }}</h4>
                <span class="nik-tag">NIK: {{ user.nik }}</span>
              </div>
              <span v-if="user.seconds_since_last_activity <= 60" class="status-dot online" title="Sedang Merekam"></span>
              <span v-else class="status-dot offline" title="Offline"></span>
            </div>

            <div class="card-loc-body">
              <div class="loc-text">
                <span class="loc-icon">📍</span>
                <span class="loc-name">{{ user.location_name || (user.ip_address ? `IP: ${user.ip_address}` : 'Lokasi Belum Terdeteksi') }}</span>
              </div>
              <div v-if="user.latitude && user.longitude" class="coords">
                {{ user.latitude.toFixed(4) }}, {{ user.longitude.toFixed(4) }}
              </div>
            </div>

            <div class="card-actions">
              <button 
                v-if="user.latitude && user.longitude" 
                class="btn-focus"
                @click.stop="focusUserOnMap(user)"
              >
                Fokus di Peta &rarr;
              </button>
              <NuxtLink :to="`/user/${user.nik}`" class="btn-detail" @click.stop>
                Detail Sesi
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useApi } from '~/composables/api'

const { getApiUrl } = useApi()

const { data: apiResponse, pending, refresh } = await useFetch(() => getApiUrl('/api/live-monitoring'), {
  lazy: true
})

const activeUsers = computed(() => apiResponse.value?.data || [])
const usersWithLocation = computed(() => activeUsers.value.filter(u => u.latitude && u.longitude))
const onlineCount = computed(() => activeUsers.value.filter(u => u.seconds_since_last_activity <= 60).length)

const selectedUserNik = ref(null)
let mapInstance = null
let markersGroup = null
let L = null
let autoRefreshTimer = null

// Fungsi memuat Leaflet JS & CSS via CDN secara dinamis
const loadLeafletScript = () => {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L)
      return
    }

    // Inject CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    // Inject JS
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => resolve(window.L)
    script.onerror = (err) => reject(err)
    document.head.appendChild(script)
  })
}

// Inisialisasi Peta Leaflet
const initMap = async () => {
  try {
    L = await loadLeafletScript()

    const mapElement = document.getElementById('leaflet-map')
    if (!mapElement) return

    // Inisialisasi Peta (Pusat awal: Indonesia [-2.5489, 118.0149])
    mapInstance = L.map('leaflet-map', {
      zoomControl: true
    }).setView([-2.5489, 118.0149], 5)

    // Layer OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance)

    markersGroup = L.layerGroup().addTo(mapInstance)

    updateMarkers()
  } catch (err) {
    console.error('Gagal menginisialisasi Leaflet Map:', err)
  }
}

// Perbarui Marker di Peta
const updateMarkers = () => {
  if (!mapInstance || !L || !markersGroup) return

  markersGroup.clearLayers()

  const bounds = []

  usersWithLocation.value.forEach(user => {
    const lat = user.latitude
    const lng = user.longitude

    bounds.push([lat, lng])

    const isOnline = user.seconds_since_last_activity <= 60
    const statusColor = isOnline ? '#10b981' : '#64748b'
    const statusText = isOnline ? 'Sedang Merekam' : 'Offline / Terputus'

    // Icon Custom Marker dengan Avatar
    const customIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div class="marker-pin-wrapper" style="border-color: ${statusColor}">
          <div class="marker-avatar">${(user.alias || user.name).charAt(0).toUpperCase()}</div>
          <span class="marker-dot" style="background-color: ${statusColor}"></span>
        </div>
      `,
      iconSize: [36, 44],
      iconAnchor: [18, 44],
      popupAnchor: [0, -40]
    })

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(markersGroup)

    const popupHtml = `
      <div class="leaflet-popup-card">
        <div class="popup-header">
          <strong>${user.alias || user.name}</strong>
          ${user.alias ? `<span class="popup-alias-tag">Alias (${user.name})</span>` : ''}
        </div>
        <div class="popup-meta">
          <div><b>NIK:</b> ${user.nik}</div>
          <div><b>Status:</b> <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span></div>
          <div><b>Versi:</b> v${user.app_version || '1.0.1'}</div>
          <div><b>Lokasi:</b> ${user.location_name || '-'}</div>
          ${user.ip_address ? `<div><b>IP:</b> ${user.ip_address}</div>` : ''}
        </div>
        <div class="popup-footer">
          <a href="/user/${user.nik}" class="popup-btn">Buka Detail Sesi &rarr;</a>
        </div>
      </div>
    `

    marker.bindPopup(popupHtml)

    marker.on('click', () => {
      selectedUserNik.value = user.nik
    })
  })

  // Fit map bounds jika ada lokasi
  if (bounds.length > 0) {
    mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 })
  }
}

// Fokus ke titik lokasi karyawan tertentu
const focusUserOnMap = (user) => {
  selectedUserNik.value = user.nik
  if (!mapInstance || !user.latitude || !user.longitude) return

  mapInstance.flyTo([user.latitude, user.longitude], 14, { duration: 1.5 })

  // Cari marker dan buka popup
  if (markersGroup) {
    markersGroup.eachLayer(layer => {
      const latLng = layer.getLatLng()
      if (Math.abs(latLng.lat - user.latitude) < 0.0001 && Math.abs(latLng.lng - user.longitude) < 0.0001) {
        layer.openPopup()
      }
    })
  }
}

const refreshData = () => {
  refresh()
}

watch(activeUsers, () => {
  updateMarkers()
})

onMounted(() => {
  initMap()
  autoRefreshTimer = setInterval(refresh, 15000)
})

onUnmounted(() => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer)
})
</script>

<style>
/* Style global untuk leaflet marker custom */
.custom-leaflet-marker {
  background: none;
  border: none;
}
.marker-pin-wrapper {
  width: 34px;
  height: 34px;
  background: #ffffff;
  border: 3px solid #2563eb;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.25);
  position: relative;
}
.marker-avatar {
  transform: rotate(45deg);
  font-weight: bold;
  font-size: 14px;
  color: #1e293b;
}
.marker-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #ffffff;
}

.leaflet-popup-card {
  padding: 4px;
  font-family: inherit;
  min-width: 200px;
}
.popup-header {
  font-size: 14px;
  margin-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 4px;
}
.popup-alias-tag {
  font-size: 10px;
  color: #2563eb;
  background: #dbeafe;
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 4px;
}
.popup-meta {
  font-size: 12px;
  color: #475569;
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 10px;
}
.popup-footer {
  text-align: right;
}
.popup-btn {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  background: #2563eb;
  padding: 4px 10px;
  border-radius: 4px;
  text-decoration: none;
}
</style>

<style scoped>
.location-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: calc(100vh - 100px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h1 {
  margin: 0 0 4px 0;
  font-size: 24px;
  color: #0f172a;
}

.subtitle {
  color: #64748b;
  margin: 0;
  font-size: 14px;
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

.text-blue { color: #0284c7; }
.text-green { color: #10b981; }

/* Map Layout */
.map-layout {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.map-wrapper {
  flex: 1;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.map-container {
  width: 100%;
  height: 100%;
}

.map-overlay-loading {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.85);
  color: #ffffff;
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 13px;
  z-index: 1000;
}

/* Sidebar List */
.location-sidebar {
  width: 320px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.location-sidebar h3 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
  padding-bottom: 10px;
  border-bottom: 1px solid #f1f5f9;
}

.staff-location-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.staff-loc-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.staff-loc-card:hover,
.staff-loc-card.active {
  background: #eff6ff;
  border-color: #93c5fd;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.08);
}

.card-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.avatar-small {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #e0e7ff;
  color: #4f46e5;
  font-size: 14px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.staff-meta {
  flex: 1;
}

.staff-meta h4 {
  margin: 0;
  font-size: 13px;
  color: #0f172a;
}

.nik-tag {
  font-size: 11px;
  color: #64748b;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-dot.online { background: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2); }
.status-dot.offline { background: #94a3b8; }

.card-loc-body {
  font-size: 12px;
  margin-bottom: 10px;
}

.loc-text {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  color: #334155;
  font-weight: 500;
}

.loc-name {
  line-height: 1.3;
}

.coords {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
  margin-left: 18px;
}

.card-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px dashed #cbd5e1;
  padding-top: 8px;
}

.btn-focus {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  padding: 0;
  cursor: pointer;
}

.btn-detail {
  font-size: 11px;
  color: #64748b;
  text-decoration: none;
}
.btn-detail:hover { color: #0f172a; text-decoration: underline; }

.empty-list {
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
  padding: 20px;
}
</style>

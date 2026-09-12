<template>
  <div class="dashboard-page">
    <div class="page-header">
      <div>
        <h1>Live Monitoring</h1>
        <p class="subtitle">Pantau aktivitas sesi kerja seluruh karyawan secara real-time.</p>
      </div>
      <div class="header-stat-badge">
        <span class="pulse-dot"></span>
        <span>{{ activeUsers.filter(u => u.seconds_since_last_activity <= 60 && u.end_time === null).length }} Aktif Merekam</span>
      </div>
    </div>
    
    <!-- Tampilkan loading jika data sedang diambil -->
    <div v-if="pending" class="empty-state">
      <p>Mengambil data dari server...</p>
    </div>

    <!-- Tampilkan pesan jika tidak ada karyawan -->
    <div v-else-if="!activeUsers || activeUsers.length === 0" class="empty-state">
      <p>Belum ada karyawan yang memulai sesi kerja saat ini.</p>
    </div>

    <!-- Grid Kartu Karyawan -->
    <div v-else class="user-grid">
      <NuxtLink 
        v-for="user in activeUsers" 
        :key="user.nik" 
        :to="`/user/${user.nik}`" 
        class="user-card"
        style="text-decoration: none; color: inherit;"
      >
        <div class="card-header">
          <div class="avatar-large" :style="getAvatarStyle(user)">
            {{ getInitials(user.alias || user.name) }}
          </div>
          <div class="user-info">
            <div class="user-title-row">
              <h3 :title="user.alias || user.name">{{ formatDisplayName(user.alias || user.name) }}</h3>
              <span v-if="user.alias" class="badge-alias">Alias</span>
            </div>
            <span class="badge">NIK: {{ user.nik }} <span v-if="user.alias" class="badge-realname">({{ formatDisplayName(user.name) }})</span></span>
          </div>
        </div>
        <div class="card-body">
          <div class="time-info">
            <span class="label">Mulai Shift:</span>
            <strong>{{ formatWaktu(user.start_time) }}</strong>
            <span v-if="user.location_name || user.ip_address" class="location-badge" :title="`IP: ${user.ip_address || '-'} | Coords: ${user.latitude || '-'}, ${user.longitude || '-'}`">
              📍 {{ user.location_name || user.ip_address }}
            </span>
          </div>
          <div class="status-wrapper">
            <span class="card-version-tag" :title="`Versi Onestaff: v${user.app_version || '1.0.3'}`">v{{ user.app_version || '1.0.3' }}</span>
            <div v-if="user.seconds_since_last_activity <= 60 && user.end_time === null" class="status active">
              <span class="pulse-dot"></span> Sedang Merekam
            </div>
            <div v-else class="status offline">
              <span class="offline-dot"></span> Offline / Terputus
            </div>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useApi } from '~/composables/api'

const { getApiUrl } = useApi()
const { data: apiResponse, pending, refresh } = await useFetch(() => getApiUrl('/api/live-monitoring'), {
  lazy: true
})

let refreshInterval = null

onMounted(() => {
  refreshInterval = setInterval(() => {
    refresh()
  }, 15000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

const activeUsers = computed(() => apiResponse.value?.data || [])

const formatDisplayName = (name) => {
  if (!name) return ''
  return name.replace(/^Karyawan\s+/i, '').trim()
}

const getInitials = (text) => {
  if (!text) return '?'
  const clean = text.replace(/^Karyawan\s+/i, '').replace(/[^a-zA-Z0-9\s]/g, '').trim()
  const parts = clean.split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return clean.slice(0, 2).toUpperCase() || '?'
}

const avatarPalette = [
  { bg: '#e0f2fe', color: '#0284c7' },
  { bg: '#ede9fe', color: '#7c3aed' },
  { bg: '#dcfce7', color: '#16a34a' },
  { bg: '#fef3c7', color: '#d97706' },
  { bg: '#ffe4e6', color: '#e11d48' },
  { bg: '#f1f5f9', color: '#475569' },
  { bg: '#ccfbf1', color: '#0d9488' }
]

const getAvatarStyle = (user) => {
  const str = user.alias || user.name || user.nik || ''
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % avatarPalette.length
  return {
    backgroundColor: avatarPalette[index].bg,
    color: avatarPalette[index].color
  }
}

const formatWaktu = (waktuISO) => {
  if (!waktuISO) return '-'
  const date = new Date(waktuISO)
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 6px 0;
  font-size: 22px;
  color: #0f172a;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.subtitle {
  color: #64748b;
  margin: 0;
  font-size: 13.5px;
}

.header-stat-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12.5px;
  font-weight: 600;
}

.empty-state {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 48px;
  text-align: center;
  color: #94a3b8;
}

/* Grid & Card Styles */
.user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 18px;
}

.user-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.user-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.08);
  border-color: #cbd5e1;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.avatar-large {
  width: 44px;
  height: 44px;
  border-radius: 11px;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
  min-width: 0;
}

.user-title-row h3 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-alias {
  font-size: 9px;
  font-weight: 700;
  background: #e0f2fe;
  color: #0284c7;
  border: 1px solid #bae6fd;
  padding: 1px 5px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  flex-shrink: 0;
}

.badge {
  font-size: 11.5px;
  color: #64748b;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-realname {
  color: #94a3b8;
  font-style: italic;
  font-weight: 400;
}

.card-body {
  border-top: 1px solid #f1f5f9;
  padding-top: 14px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
}

.time-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.time-info .label {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-weight: 600;
}

.time-info strong {
  font-size: 13.5px;
  color: #1e293b;
  font-weight: 600;
}

.location-badge {
  font-size: 10.5px;
  color: #0284c7;
  background: #f0f9ff;
  border: 1px solid #e0f2fe;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-weight: 500;
  margin-top: 2px;
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.card-version-tag {
  font-size: 10px;
  font-weight: 600;
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
  padding: 1px 6px;
  border-radius: 4px;
}

.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}

.status.active {
  color: #10b981;
}

.status.offline {
  color: #94a3b8;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  background-color: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulse-dot-anim 1.5s infinite;
}

.offline-dot {
  width: 7px;
  height: 7px;
  background-color: #cbd5e1;
  border-radius: 50%;
}

@keyframes pulse-dot-anim {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 5px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}
</style>
<template>
  <div class="dashboard-page">
    <div class="page-header">
      <h1>Live Monitoring</h1>
      <p class="subtitle">Pantau aktivitas sesi kerja karyawan saat ini.</p>
    </div>
    
    <!-- Tampilkan loading jika data sedang diambil -->
    <div v-if="pending" class="empty-state">
      <p>Mengambil data dari server...</p>
    </div>

    <!-- Tampilkan pesan jika tidak ada karyawan yang sedang online -->
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
          <div class="avatar-large">{{ user.name.charAt(0).toUpperCase() }}</div>
          <div class="user-info">
            <h3>{{ user.name }}</h3>
            <span class="badge">NIK: {{ user.nik }}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="time-info">
            <span class="label">Mulai Shift:</span>
            <strong>{{ formatWaktu(user.start_time) }}</strong>
          </div>
          <div v-if="user.seconds_since_last_activity <= 60" class="status active">
            <span class="pulse-dot"></span> Sedang Merekam
          </div>
          <div v-else class="status offline">
            <span class="offline-dot"></span> Offline / Terputus
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'

// Mengambil data dari backend Node.js (Pastikan portnya 3001)
const { data: apiResponse, pending, refresh } = await useFetch('http://192.168.110.57:3001/api/live-monitoring', {
  lazy: true // Membiarkan halaman dimuat dulu sambil menunggu data
})

let refreshInterval = null

onMounted(() => {
  // Refresh otomatis live monitoring setiap 15 detik
  refreshInterval = setInterval(() => {
    refresh()
  }, 15000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

// Menyaring array data dari respon API
const activeUsers = computed(() => apiResponse.value?.data || [])

// Fungsi untuk merapikan format jam
const formatWaktu = (waktuISO) => {
  if (!waktuISO) return '-'
  const date = new Date(waktuISO)
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.page-header h1 { margin: 0 0 8px 0; font-size: 24px; color: #1e293b; }
.subtitle { color: #64748b; margin-top: 0; margin-bottom: 32px; }
.empty-state { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 48px; text-align: center; color: #94a3b8; }

/* Grid & Card Styles */
.user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.user-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s;
}

.user-card:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }

.card-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.avatar-large { width: 48px; height: 48px; border-radius: 12px; background: #e0e7ff; color: #4f46e5; font-size: 20px; font-weight: bold; display: flex; align-items: center; justify-content: center; }
.user-info h3 { margin: 0 0 4px 0; font-size: 16px; color: #0f172a; }
.badge { font-size: 12px; background: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 6px; font-weight: 500; }

.card-body { border-top: 1px solid #f1f5f9; padding-top: 16px; display: flex; justify-content: space-between; align-items: center; }
.time-info { display: flex; flex-direction: column; gap: 4px; }
.time-info .label { font-size: 12px; color: #64748b; }
.time-info strong { font-size: 14px; color: #1e293b; }

.status { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
.status.active { color: #10b981; }
.status.offline { color: #64748b; }
.pulse-dot { width: 8px; height: 8px; background-color: #10b981; border-radius: 50%; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); animation: pulse 1.5s infinite; }
.offline-dot { width: 8px; height: 8px; background-color: #64748b; border-radius: 50%; }

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}
</style>
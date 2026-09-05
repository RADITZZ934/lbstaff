<template>
  <div class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="brand">
        <h2>LB Tracker</h2>
      </div>
      <nav class="menu">
        <NuxtLink to="/" class="menu-item">Live Monitoring</NuxtLink>
      </nav>

      <!-- Employee List Section inside Sidebar -->
      <div class="employee-section">
        <div class="employee-header">
          <span>Karyawan</span>
          <span class="count-badge">{{ filteredEmployees.length }}</span>
        </div>
        
        <!-- Search Input -->
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass search-icon"></i>
          <input 
            type="text" 
            v-model="employeeSearchQuery" 
            placeholder="Cari NIK atau Nama..." 
            class="search-input"
          />
        </div>

        <!-- Scrollable List of Employees -->
        <div class="employee-list">
          <NuxtLink 
            v-for="emp in filteredEmployees" 
            :key="emp.nik" 
            :to="`/user/${emp.nik}`" 
            :class="['employee-item', { active: route.params.nik === emp.nik }]"
          >
            <div class="avatar-small">{{ emp.name.charAt(0).toUpperCase() }}</div>
            <div class="emp-info">
              <span class="emp-name">{{ emp.name }}</span>
              <div class="emp-meta">
                <span class="emp-nik">NIK: {{ emp.nik }}</span>
                <span v-if="emp.seconds_since_last_activity <= 60 && emp.end_time === null" class="status online">
                  <span class="dot animate-pulse"></span>
                </span>
                <span v-else class="status offline">
                  <span class="dot"></span>
                </span>
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="main-wrapper">
      <header class="topbar">
        <div class="header-title">Admin Dashboard</div>
        <div class="theme-toggle">
          <div class="avatar">HR</div>
        </div>
      </header>
      
      <main class="content-area">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useApi } from '~/composables/api'

const route = useRoute()
const { getApiUrl } = useApi()
const employeeSearchQuery = ref('')

// Fetch employee directory (live-monitoring)
const { data: employeesResponse, refresh } = await useFetch(() => getApiUrl('/api/live-monitoring'), {
  lazy: true
})

// Automatically poll for updates on the sidebar employee list every 15s
let refreshInterval = null
onMounted(() => {
  refreshInterval = setInterval(() => {
    refresh()
  }, 15000)
})
onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

const allEmployees = computed(() => employeesResponse.value?.data || [])

const filteredEmployees = computed(() => {
  if (!employeeSearchQuery.value) return allEmployees.value
  const query = employeeSearchQuery.value.toLowerCase()
  return allEmployees.value.filter(emp => 
    emp.name.toLowerCase().includes(query) || 
    emp.nik.toLowerCase().includes(query)
  )
})
</script>

<style scoped>
/* Estetika SaaS: Bersih, Soft UI, Transisi Halus */
.app-layout {
  display: flex;
  height: 100vh;
  background-color: #f8fafc; /* Latar belakang abu-abu sangat muda */
  font-family: 'Segoe UI', system-ui, sans-serif;
  color: #334155;
}

.sidebar {
  width: 260px;
  background-color: #ffffff;
  border-right: 1px solid #e2e8f0; /* Subtle border */
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.brand {
  padding: 24px;
  border-bottom: 1px solid #f1f5f9;
}

.brand h2 {
  margin: 0;
  font-size: 20px;
  color: #0f172a;
  font-weight: 700;
}

.menu {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu-item {
  text-decoration: none;
  color: #64748b;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.menu-item:hover {
  background-color: #f1f5f9;
  color: #0f172a;
}

/* NuxtLink otomatis menambahkan class ini saat di halaman aktif */
.router-link-exact-active {
  background-color: #eff6ff;
  color: #2563eb;
}

.employee-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-top: 1px solid #f1f5f9;
  overflow: hidden;
  padding: 16px 0;
}

.employee-header {
  padding: 0 16px 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.count-badge {
  background-color: #f1f5f9;
  color: #475569;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.search-box {
  position: relative;
  margin: 0 16px 14px 16px;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  font-size: 12px;
  color: #94a3b8;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 28px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 12.5px;
  color: #334155;
  outline: none;
  background-color: #f8fafc;
  transition: all 0.2s ease;
}

.search-input:focus {
  border-color: #3b82f6;
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.employee-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.employee-list::-webkit-scrollbar {
  width: 4px;
}
.employee-list::-webkit-scrollbar-track {
  background: transparent;
}
.employee-list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}

.employee-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  text-decoration: none;
  color: #475569;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.employee-item:hover {
  background-color: #f1f5f9;
  color: #0f172a;
}

.employee-item.active {
  background-color: #eff6ff;
  border-color: #bfdbfe;
  color: #2563eb;
}

.avatar-small {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background-color: #f1f5f9;
  color: #475569;
  font-size: 12.5px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.employee-item.active .avatar-small {
  background-color: #2563eb;
  color: #ffffff;
}

.emp-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.emp-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.emp-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 1px;
}

.employee-item.active .emp-meta {
  color: #93c5fd;
}

.status .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.status.online .dot {
  background-color: #16a34a;
  box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
}

.status.offline .dot {
  background-color: #cbd5e1;
}

.animate-pulse {
  animation: pulse-dot-layout 1.5s infinite;
}

@keyframes pulse-dot-layout {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 3px rgba(22, 163, 74, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
}

.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topbar {
  height: 70px;
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
}

.content-area {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
}
</style>
<template>
  <div class="app-layout" @click="handleGlobalClick">
    <!-- Sidebar -->
    <aside class="sidebar">
      <!-- Brand Header -->
      <div class="brand">
        <div class="brand-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
        </div>
        <div class="brand-text">
          <h2>LBStaff</h2>
          <span class="brand-badge">Tracker</span>
        </div>
      </div>

      <!-- Main Navigation -->
      <nav class="menu">
        <NuxtLink to="/" class="menu-item" active-class="active">
          <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <span>Live Monitoring</span>
        </NuxtLink>
        <NuxtLink to="/location" class="menu-item" active-class="active">
          <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>Peta Lokasi</span>
        </NuxtLink>
      </nav>

      <!-- Employee Directory Section -->
      <div class="employee-section">
        <div class="employee-header">
          <div class="header-title-group">
            <span class="header-label">KARYAWAN</span>
            <span class="count-badge">{{ filteredEmployees.length }}</span>
          </div>
        </div>
        
        <!-- Search Input -->
        <div class="search-box">
          <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            v-model="employeeSearchQuery" 
            placeholder="Cari NIK, Nama, Alias..." 
            class="search-input"
          />
          <button 
            v-if="employeeSearchQuery" 
            @click="employeeSearchQuery = ''" 
            class="search-clear-btn"
            type="button"
            title="Hapus pencarian"
          >
            ✕
          </button>
        </div>

        <!-- Scrollable List of Employees with Clean Cards -->
        <div class="employee-list">
          <div v-if="filteredEmployees.length === 0" class="empty-search-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
            <p>Tidak ada karyawan ditemukan</p>
          </div>

          <div 
            v-for="emp in filteredEmployees" 
            :key="emp.nik"
            class="employee-row"
          >
            <!-- Background Action Layer (Swipe Left Delete) -->
            <div class="swipe-action-layer">
              <button 
                type="button"
                @click.stop="openDeleteModal(emp)" 
                class="swipe-delete-btn" 
                title="Hapus Pengguna"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                <span>Hapus</span>
              </button>
            </div>

            <!-- Foreground Swipeable Item -->
            <div 
              class="swipeable-front"
              :style="{ transform: `translateX(${getItemTranslateX(emp.nik)}px)` }"
              @touchstart="handleTouchStart($event, emp)"
              @touchmove="handleTouchMove($event, emp)"
              @touchend="handleTouchEnd($event, emp)"
              @mousedown="handleMouseDown($event, emp)"
            >
              <NuxtLink 
                :to="`/user/${emp.nik}`" 
                :class="['employee-item', { active: route.params.nik === emp.nik }]"
                @click="handleClickLink($event, emp)"
              >
                <!-- Avatar with initials -->
                <div class="avatar-box" :style="getAvatarStyle(emp)">
                  {{ getInitials(emp.alias || emp.name) }}
                </div>

                <!-- Info Column -->
                <div class="emp-info">
                  <div class="emp-name-row">
                    <span class="emp-name" :title="emp.alias || emp.name">
                      {{ formatDisplayName(emp.alias || emp.name) }}
                    </span>
                    <span v-if="emp.alias" class="alias-pill">ALIAS</span>
                  </div>

                  <div class="emp-meta-row">
                    <span class="emp-nik-text">
                      NIK: {{ emp.nik }}
                      <span v-if="emp.alias" class="emp-subname">· {{ formatDisplayName(emp.name) }}</span>
                    </span>

                    <div class="emp-badge-group">
                      <span class="version-tag">v{{ emp.app_version || '1.0.3' }}</span>
                      
                      <!-- Status Indicator -->
                      <span 
                        v-if="emp.seconds_since_last_activity <= 60 && emp.end_time === null" 
                        class="status-indicator online" 
                        title="Sedang Aktif Merekam"
                      >
                        <span class="pulse-ring"></span>
                        <span class="status-core"></span>
                      </span>
                      <span 
                        v-else 
                        class="status-indicator offline" 
                        title="Offline / Terputus"
                      >
                        <span class="status-core"></span>
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Desktop Hover Delete Button -->
                <button 
                  type="button" 
                  class="desktop-delete-btn" 
                  @click.prevent.stop="openDeleteModal(emp)"
                  title="Hapus Karyawan"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                  </svg>
                </button>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="main-wrapper">
      <header class="topbar">
        <div class="header-left">
          <h1 class="header-title">Admin Dashboard</h1>
        </div>
        <div class="header-right">
          <div class="user-profile-badge">
            <div class="admin-avatar">HR</div>
            <div class="admin-meta">
              <span class="admin-name">Super Admin</span>
              <span class="admin-role">Human Resources</span>
            </div>
          </div>
        </div>
      </header>
      
      <main class="content-area">
        <slot />
      </main>
    </div>

    <!-- Modal Dialog Konfirmasi Hapus User -->
    <Transition name="fade">
      <div v-if="showDeleteModal" class="modal-backdrop" @click.self="closeDeleteModal">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-icon-danger">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">Hapus Data Karyawan?</h3>
              <p class="modal-desc">Tindakan ini permanen dan tidak dapat dibatalkan.</p>
            </div>
          </div>

          <div class="user-summary-box">
            <div class="summary-row">
              <span class="summary-label">Nama Karyawan:</span>
              <span class="summary-value font-bold">{{ employeeToDelete?.name }}</span>
            </div>
            <div v-if="employeeToDelete?.alias" class="summary-row">
              <span class="summary-label">Alias:</span>
              <span class="summary-value text-blue">{{ employeeToDelete?.alias }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">NIK:</span>
              <span class="summary-value font-mono">{{ employeeToDelete?.nik }}</span>
            </div>
          </div>

          <div class="modal-warning">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>Semua riwayat shift, log aktivitas, dan screenshot dari karyawan ini akan dihapus permanen.</span>
          </div>

          <div class="modal-actions">
            <button 
              type="button" 
              class="btn-modal-cancel" 
              @click="closeDeleteModal"
              :disabled="isDeleting"
            >
              Batal
            </button>
            <button 
              type="button" 
              class="btn-modal-delete" 
              @click="confirmDeleteUser"
              :disabled="isDeleting"
            >
              <span v-if="isDeleting">Menghapus...</span>
              <span v-else>Ya, Hapus Pengguna</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useApi } from '~/composables/api'

const route = useRoute()
const router = useRouter()
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
  const query = employeeSearchQuery.value.toLowerCase().trim()
  return allEmployees.value.filter(emp => 
    (emp.name && emp.name.toLowerCase().includes(query)) || 
    (emp.alias && emp.alias.toLowerCase().includes(query)) || 
    (emp.nik && emp.nik.toLowerCase().includes(query))
  )
})

// Helper untuk membersihkan prefix nama "Karyawan "
const formatDisplayName = (name) => {
  if (!name) return ''
  return name.replace(/^Karyawan\s+/i, '').trim()
}

// Helper untuk mendapatkan inisial avatar (2 huruf)
const getInitials = (text) => {
  if (!text) return '?'
  const clean = text.replace(/^Karyawan\s+/i, '').replace(/[^a-zA-Z0-9\s]/g, '').trim()
  const parts = clean.split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return clean.slice(0, 2).toUpperCase() || '?'
}

// Warna avatar unik berdasarkan nama
const avatarPalette = [
  { bg: '#e0f2fe', color: '#0284c7' }, // Blue
  { bg: '#ede9fe', color: '#7c3aed' }, // Purple
  { bg: '#dcfce7', color: '#16a34a' }, // Green
  { bg: '#fef3c7', color: '#d97706' }, // Amber
  { bg: '#ffe4e6', color: '#e11d48' }, // Rose
  { bg: '#f1f5f9', color: '#475569' }, // Slate
  { bg: '#ccfbf1', color: '#0d9488' }  // Teal
]

const getAvatarStyle = (emp) => {
  const str = emp.alias || emp.name || emp.nik || ''
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

// --- SWIPE LEFT & GESTURE LOGIC ---
const swipedEmpNik = ref(null)
const startX = ref(0)
const currentDeltaX = ref(0)
const isDragging = ref(false)
const activeDragNik = ref(null)
let hadSignificantDrag = false

const getItemTranslateX = (nik) => {
  if (activeDragNik.value === nik && currentDeltaX.value !== 0) {
    return currentDeltaX.value
  }
  if (swipedEmpNik.value === nik) {
    return -70
  }
  return 0
}

const handleGlobalClick = (e) => {
  if (!e.target.closest('.swipe-action-layer') && !e.target.closest('.desktop-delete-btn')) {
    if (swipedEmpNik.value && !hadSignificantDrag) {
      swipedEmpNik.value = null
    }
  }
}

const handleClickLink = (e, emp) => {
  if (hadSignificantDrag) {
    e.preventDefault()
    hadSignificantDrag = false
    return
  }
  if (swipedEmpNik.value === emp.nik) {
    e.preventDefault()
    swipedEmpNik.value = null
  }
}

// Touch events
const handleTouchStart = (e, emp) => {
  startX.value = e.touches[0].clientX
  currentDeltaX.value = swipedEmpNik.value === emp.nik ? -70 : 0
  activeDragNik.value = emp.nik
  hadSignificantDrag = false
}

const handleTouchMove = (e, emp) => {
  if (activeDragNik.value !== emp.nik) return
  const diff = e.touches[0].clientX - startX.value
  if (Math.abs(diff) > 8) {
    hadSignificantDrag = true
  }
  const base = swipedEmpNik.value === emp.nik ? -70 : 0
  const target = base + diff
  currentDeltaX.value = Math.max(Math.min(target, 0), -80)
}

const handleTouchEnd = (e, emp) => {
  if (activeDragNik.value !== emp.nik) return
  if (currentDeltaX.value < -35) {
    swipedEmpNik.value = emp.nik
  } else {
    swipedEmpNik.value = null
  }
  currentDeltaX.value = 0
  activeDragNik.value = null
  setTimeout(() => { hadSignificantDrag = false }, 100)
}

// Mouse drag events
const handleMouseDown = (e, emp) => {
  if (e.target.closest('.desktop-delete-btn') || e.target.closest('.swipe-delete-btn')) return
  startX.value = e.clientX
  currentDeltaX.value = swipedEmpNik.value === emp.nik ? -70 : 0
  isDragging.value = true
  activeDragNik.value = emp.nik
  hadSignificantDrag = false

  const onMouseMove = (ev) => {
    if (!isDragging.value) return
    const diff = ev.clientX - startX.value
    if (Math.abs(diff) > 8) {
      hadSignificantDrag = true
    }
    const base = swipedEmpNik.value === emp.nik ? -70 : 0
    const target = base + diff
    currentDeltaX.value = Math.max(Math.min(target, 0), -80)
  }

  const onMouseUp = () => {
    if (isDragging.value) {
      if (currentDeltaX.value < -35) {
        swipedEmpNik.value = emp.nik
      } else {
        swipedEmpNik.value = null
      }
      isDragging.value = false
      activeDragNik.value = null
      currentDeltaX.value = 0
      setTimeout(() => { hadSignificantDrag = false }, 100)
    }
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// --- DELETE MODAL & API LOGIC ---
const showDeleteModal = ref(false)
const employeeToDelete = ref(null)
const isDeleting = ref(false)

const openDeleteModal = (emp) => {
  employeeToDelete.value = emp
  showDeleteModal.value = true
  swipedEmpNik.value = null
}

const closeDeleteModal = () => {
  if (isDeleting.value) return
  showDeleteModal.value = false
  employeeToDelete.value = null
}

const confirmDeleteUser = async () => {
  if (!employeeToDelete.value || isDeleting.value) return
  isDeleting.value = true

  const targetNik = employeeToDelete.value.nik
  try {
    await $fetch(getApiUrl(`/api/user/${targetNik}`), {
      method: 'DELETE'
    })

    if (route.params.nik === targetNik) {
      await router.push('/')
    }

    await refresh()
    closeDeleteModal()
  } catch (err) {
    console.error('Gagal menghapus user:', err)
    alert('Gagal menghapus pengguna: ' + (err.data?.message || err.message))
  } finally {
    isDeleting.value = false
  }
}
</script>

<style scoped>
/* Modern Premium SaaS Layout */
.app-layout {
  display: flex;
  height: 100vh;
  background-color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
  user-select: none;
  overflow: hidden;
}

/* Sidebar Styling */
.sidebar {
  width: 290px;
  background-color: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  flex-shrink: 0;
  box-shadow: 2px 0 8px -2px rgba(0, 0, 0, 0.03);
  z-index: 10;
}

/* Brand Header */
.brand {
  padding: 18px 20px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 6px -1px rgba(37, 99, 235, 0.3);
}

.brand-text {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-text h2 {
  margin: 0;
  font-size: 17px;
  color: #0f172a;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.brand-badge {
  font-size: 10px;
  font-weight: 700;
  background-color: #eff6ff;
  color: #2563eb;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #dbeafe;
  letter-spacing: 0.3px;
}

/* Menu Navigation */
.menu {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-bottom: 1px solid #f1f5f9;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: #64748b;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.menu-icon {
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.menu-item:hover {
  background-color: #f8fafc;
  color: #0f172a;
}

.menu-item:hover .menu-icon {
  transform: translateX(2px);
}

.menu-item.active,
.menu-item.router-link-exact-active {
  background-color: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}

/* Employee Section */
.employee-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-top: 14px;
}

.employee-header {
  padding: 0 16px 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.6px;
}

.count-badge {
  background-color: #f1f5f9;
  color: #475569;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
}

/* Search Box */
.search-box {
  position: relative;
  margin: 0 14px 12px 14px;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: #94a3b8;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 7px 28px 7px 30px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  font-size: 12.5px;
  color: #1e293b;
  outline: none;
  background-color: #f8fafc;
  transition: all 0.15s ease;
}

.search-input::placeholder {
  color: #94a3b8;
}

.search-input:focus {
  border-color: #3b82f6;
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.search-clear-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}

.search-clear-btn:hover {
  color: #475569;
}

/* Employee Scrollable List */
.employee-list {
  flex: 1;
  overflow-y: auto;
  padding: 2px 12px 24px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.employee-list::-webkit-scrollbar {
  width: 4px;
}
.employee-list::-webkit-scrollbar-track {
  background: transparent;
}
.employee-list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.employee-list::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Empty Search State */
.empty-search-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: #94a3b8;
  gap: 8px;
  text-align: center;
}

.empty-search-state p {
  margin: 0;
  font-size: 12.5px;
}

/* Row & Swipe Wrapper */
.employee-row {
  position: relative;
  overflow: hidden;
  border-radius: 9px;
  background-color: #fee2e2;
  flex-shrink: 0;
}

.swipe-action-layer {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.swipe-delete-btn {
  width: 100%;
  height: 100%;
  background-color: #ef4444;
  color: #ffffff;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.swipe-delete-btn:hover {
  background-color: #dc2626;
}

.swipeable-front {
  position: relative;
  background-color: #ffffff;
  z-index: 2;
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  border-radius: 9px;
  width: 100%;
}

/* Employee Item Card */
.employee-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border-radius: 9px;
  text-decoration: none;
  color: #334155;
  transition: all 0.15s ease;
  border: 1px solid #eef2f6;
  background-color: #ffffff;
  position: relative;
  box-sizing: border-box;
}

.employee-item:hover {
  background-color: #f8fafc;
  border-color: #cbd5e1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

/* Active State */
.employee-item.active {
  background-color: #f0f7ff;
  border-color: #93c5fd;
  box-shadow: 0 2px 6px -1px rgba(37, 99, 235, 0.1);
}

.employee-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  background-color: #2563eb;
  border-radius: 0 3px 3px 0;
}

/* Avatar Initials Box */
.avatar-box {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: -0.2px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.employee-item.active .avatar-box {
  background-color: #2563eb !important;
  color: #ffffff !important;
  box-shadow: 0 2px 5px rgba(37, 99, 235, 0.3);
}

/* Info Column */
.emp-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.emp-name-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.emp-name {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.employee-item.active .emp-name {
  color: #1d4ed8;
}

.alias-pill {
  font-size: 8.5px;
  font-weight: 700;
  background: #e0f2fe;
  color: #0284c7;
  border: 1px solid #bae6fd;
  padding: 0 4px;
  border-radius: 3px;
  letter-spacing: 0.4px;
  flex-shrink: 0;
  line-height: 14px;
}

.emp-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.emp-nik-text {
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}

.emp-subname {
  color: #94a3b8;
  font-size: 10.5px;
}

.employee-item.active .emp-nik-text {
  color: #3b82f6;
}

.emp-badge-group {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.version-tag {
  font-size: 9.5px;
  font-weight: 600;
  background-color: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
  padding: 1px 4px;
  border-radius: 4px;
}

.employee-item.active .version-tag {
  background-color: #ffffff;
  border-color: #bfdbfe;
  color: #2563eb;
}

/* Status Pulse Indicator */
.status-indicator {
  position: relative;
  width: 8px;
  height: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-indicator .status-core {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #94a3b8;
}

.status-indicator.online .status-core {
  background-color: #10b981;
}

.status-indicator.online .pulse-ring {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: rgba(16, 185, 129, 0.4);
  animation: pulse-ring-anim 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-ring-anim {
  0% { transform: scale(0.6); opacity: 1; }
  100% { transform: scale(1.6); opacity: 0; }
}

/* Hover Delete Button */
.desktop-delete-btn {
  opacity: 0;
  visibility: hidden;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 5px;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.employee-item:hover .desktop-delete-btn {
  opacity: 1;
  visibility: visible;
}

.desktop-delete-btn:hover {
  background-color: #fee2e2;
  color: #ef4444;
}

/* Main Layout & Topbar */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topbar {
  height: 64px;
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  flex-shrink: 0;
}

.header-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.3px;
  margin: 0;
}

.user-profile-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px 4px 6px;
  border-radius: 20px;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
}

.admin-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: #2563eb;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 11px;
}

.admin-meta {
  display: flex;
  flex-direction: column;
}

.admin-name {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.2;
}

.admin-role {
  font-size: 10px;
  color: #64748b;
}

.content-area {
  flex: 1;
  padding: 28px;
  overflow-y: auto;
}

/* Modal Dialog */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal-card {
  background: #ffffff;
  border-radius: 16px;
  max-width: 440px;
  width: 100%;
  padding: 24px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid #e2e8f0;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}

.modal-icon-danger {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background-color: #fee2e2;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-title {
  margin: 0 0 4px 0;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
}

.modal-desc {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.user-summary-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.summary-label {
  color: #64748b;
}

.summary-value {
  color: #1e293b;
}

.font-bold {
  font-weight: 700;
}

.font-mono {
  font-family: monospace;
}

.text-blue {
  color: #2563eb;
  font-weight: 600;
}

.modal-warning {
  margin: 0 0 20px 0;
  font-size: 12px;
  color: #991b1b;
  background-color: #fef2f2;
  border-left: 3px solid #ef4444;
  padding: 10px 12px;
  border-radius: 0 6px 6px 0;
  line-height: 1.4;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-modal-cancel {
  padding: 9px 16px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-modal-cancel:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
}

.btn-modal-delete {
  padding: 9px 18px;
  border-radius: 8px;
  border: none;
  background: #ef4444;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-modal-delete:hover:not(:disabled) {
  background: #dc2626;
}

.btn-modal-delete:disabled,
.btn-modal-cancel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
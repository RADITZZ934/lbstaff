<template>
  <div class="app-layout" @click="handleGlobalClick">
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
            placeholder="Cari NIK, Nama, Alias..." 
            class="search-input"
          />
        </div>

        <!-- Scrollable List of Employees with Swipe Left Support -->
        <div class="employee-list">
          <div 
            v-for="emp in filteredEmployees" 
            :key="emp.nik"
            class="employee-row"
          >
            <!-- Background Action Layer (Revealed on Swipe Left) -->
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
                <div class="avatar-small">{{ (emp.alias || emp.name).charAt(0).toUpperCase() }}</div>
                <div class="emp-info">
                  <div class="emp-name-row">
                    <span class="emp-name">{{ emp.alias || emp.name }}</span>
                    <span v-if="emp.alias" class="alias-tag" title="Memiliki Alias">Alias</span>
                  </div>
                  <div class="emp-meta">
                    <span class="emp-nik">
                      NIK: {{ emp.nik }} 
                      <span v-if="emp.alias" class="emp-realname">({{ emp.name }})</span>
                    </span>
                    <div class="emp-meta-right">
                      <span class="emp-version-pill" :title="`Versi Onestaff: v${emp.app_version || '1.0.1'}`">v{{ emp.app_version || '1.0.1' }}</span>
                      <span v-if="emp.seconds_since_last_activity <= 60 && emp.end_time === null" class="status online">
                        <span class="dot animate-pulse"></span>
                      </span>
                      <span v-else class="status offline">
                        <span class="dot"></span>
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Subtle delete icon for desktop mouse users -->
                <button 
                  type="button" 
                  class="desktop-hover-delete" 
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
        <div class="header-title">Admin Dashboard</div>
        <div class="theme-toggle">
          <div class="avatar">HR</div>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
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
              <span class="summary-value">{{ employeeToDelete?.nik }}</span>
            </div>
          </div>

          <p class="modal-warning">
            ⚠️ Semua riwayat sesi kerja, log aktivitas, dan screenshot dari karyawan ini akan dihapus secara permanen dari server.
          </p>

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
  const query = employeeSearchQuery.value.toLowerCase()
  return allEmployees.value.filter(emp => 
    (emp.name && emp.name.toLowerCase().includes(query)) || 
    (emp.alias && emp.alias.toLowerCase().includes(query)) || 
    (emp.nik && emp.nik.toLowerCase().includes(query))
  )
})

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
  if (!e.target.closest('.swipe-action-layer') && !e.target.closest('.desktop-hover-delete')) {
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
  if (e.target.closest('.desktop-hover-delete') || e.target.closest('.swipe-delete-btn')) return
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

    // Jika sedang melihat halaman user yang dihapus, alihkan ke dashboard utama
    if (route.params.nik === targetNik) {
      await router.push('/')
    }

    // Refresh daftar karyawan
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
/* Estetika SaaS: Bersih, Soft UI, Transisi Halus */
.app-layout {
  display: flex;
  height: 100vh;
  background-color: #f8fafc;
  font-family: 'Segoe UI', system-ui, sans-serif;
  color: #334155;
  user-select: none;
}

.sidebar {
  width: 270px;
  background-color: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  flex-shrink: 0;
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
  padding: 0 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
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

/* SWIPE WRAPPER STYLES */
.employee-row {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background-color: #fee2e2; /* Background merah saat tergeser */
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
  border-radius: 8px;
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
  border: 1px solid #f1f5f9;
  position: relative;
}

.employee-item:hover {
  background-color: #f8fafc;
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

.emp-name-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.emp-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alias-tag {
  font-size: 9px;
  font-weight: 700;
  background: #dbeafe;
  color: #1d4ed8;
  padding: 1px 4px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

.emp-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 1px;
}

.emp-meta-right {
  display: flex;
  align-items: center;
  gap: 5px;
}

.emp-version-pill {
  font-size: 9.5px;
  font-weight: 600;
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
  padding: 0 4px;
  border-radius: 4px;
}

.employee-item.active .emp-version-pill {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: #ffffff;
}

.emp-realname {
  color: #94a3b8;
  font-size: 10.5px;
  font-style: italic;
}

.employee-item.active .emp-meta {
  color: #93c5fd;
}

.employee-item.active .emp-realname {
  color: #bfdbfe;
}

/* Hover delete button on desktop */
.desktop-hover-delete {
  opacity: 0;
  visibility: hidden;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 2px;
}

.employee-item:hover .desktop-hover-delete {
  opacity: 1;
  visibility: visible;
}

.desktop-hover-delete:hover {
  background-color: #fee2e2;
  color: #ef4444;
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

/* MODAL STYLES */
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
  width: 44px;
  height: 44px;
  border-radius: 12px;
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

.text-blue {
  color: #2563eb;
  font-weight: 600;
}

.modal-warning {
  margin: 0 0 20px 0;
  font-size: 12px;
  color: #b91c1c;
  background-color: #fef2f2;
  border-left: 3px solid #ef4444;
  padding: 8px 12px;
  border-radius: 0 6px 6px 0;
  line-height: 1.4;
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
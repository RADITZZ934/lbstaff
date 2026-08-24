<template>
  <div class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="brand">
        <h2>LB Tracker</h2>
      </div>
      <nav class="menu">
        <NuxtLink to="/" class="menu-item">Live Monitoring</NuxtLink>
        <NuxtLink to="/laporan" class="menu-item">Laporan & Payroll</NuxtLink>
      </nav>
    </aside>

    <!-- Main Content Area -->
    <div class="main-wrapper">
      <header class="topbar">
        <div class="header-title">Admin Dashboard</div>
        <div class="theme-toggle">
          <!-- Tempat tombol light/dark mode nanti -->
          <div class="avatar">HR</div>
        </div>
      </header>
      
      <main class="content-area">
        <slot />
      </main>
    </div>
  </div>
</template>

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
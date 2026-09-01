<?php
/**
 * Liga Metropolitana de Béisbol (LMB) Buenos Aires
 * Mobile 100% Web Application (Max Width 768px)
 */
session_start();
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>LMB Béisbol - Liga Metropolitana de Buenos Aires</title>
  <meta name="description" content="Estadísticas oficiales en vivo, calendario, posiciones y anotador de partidos de la Liga Metropolitana de Béisbol de Buenos Aires.">
  <link rel="manifest" href="assets/manifest.json">
  <meta name="theme-color" content="#0A192F">
  
  <link rel="stylesheet" href="assets/css/material-theme.css">
</head>
<body>

  <!-- Max 768px Mobile/Tablet Outer Wrapper -->
  <div id="app-container">
    
    <!-- Top Material App Bar -->
    <header class="md-top-app-bar">
      <div class="brand-wrapper" onclick="App.showView('home')" style="cursor:pointer;">
        <img id="brand-site-logo" src="assets/images/lmb_logo.png" class="brand-logo" alt="Logo LMB">
        <div class="brand-title">
          <h1 id="brand-site-title">LMB BÉISBOL</h1>
          <span>Buenos Aires</span>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:8px;">
        <div id="network-badge" class="online-status-badge">
          <span class="status-dot"></span> EN VIVO
        </div>
        <button id="user-action-btn" class="md-btn md-btn-outlined" style="padding:4px 10px; font-size:0.75rem;">
          <span class="material-icons-round">login</span> Acceder
        </button>
      </div>
    </header>

    <!-- Scorebug Ticker Carousel (MLB Style) -->
    <div id="scorebug-carousel" class="scorebug-container">
      <!-- Populated dynamically by app.js -->
    </div>

    <!-- Category Division Filter Chips -->
    <div style="padding: 10px 16px 0 16px;">
      <div id="global-category-chips" class="md-chip-group">
        <!-- Populated dynamically by app.js -->
      </div>
    </div>

    <!-- Main Dynamic SPA View Container -->
    <main id="view-container">
      <!-- Views rendered by app.js -->
    </main>

    <!-- Bottom Navigation Bar -->
    <nav class="md-bottom-nav">
      <button id="nav-home" class="nav-item active" onclick="App.showView('home')">
        <span class="material-icons-round">home</span>
        <span>Inicio</span>
      </button>

      <button id="nav-calendar" class="nav-item" onclick="App.showView('calendar')">
        <span class="material-icons-round">calendar_month</span>
        <span>Partidos</span>
      </button>

      <button id="nav-leaders" class="nav-item" onclick="App.showView('leaders')">
        <span class="material-icons-round">military_tech</span>
        <span>Líderes</span>
      </button>

      <button id="nav-teams" class="nav-item" onclick="App.showView('teams')">
        <span class="material-icons-round">groups</span>
        <span>Equipos</span>
      </button>

      <button id="nav-admin" class="nav-item" onclick="App.showView('admin')">
        <span class="material-icons-round">settings</span>
        <span>Admin</span>
      </button>
    </nav>

    <!-- Snackbar Notification Toast -->
    <div id="snackbar" style="display:none; position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#1E293B; border:1px solid #3B82F6; color:#FFFFFF; padding:10px 18px; border-radius:99px; font-size:0.85rem; font-weight:700; z-index:400; box-shadow:0 6px 20px rgba(0,0,0,0.4);">
      Notificación
    </div>

  </div>

  <!-- Scripts -->
  <script src="assets/js/offline-sync.js"></script>
  <script src="assets/js/live-scorer.js"></script>
  <script src="assets/js/app.js"></script>

  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('ServiceWorker error:', err));
      });
    }
  </script>
</body>
</html>

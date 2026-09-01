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
  <meta name="theme-color" content="#070D1B">
  
  <link rel="stylesheet" href="assets/css/material-theme.css">
</head>
<body>

  <!-- Max 768px Mobile/Tablet Outer Wrapper -->
  <div id="app-container">
    
    <!-- Top Material App Bar -->
    <header class="md-top-app-bar">
      <div class="brand-wrapper" onclick="App.showView('home')">
        <img id="brand-site-logo" src="assets/images/lmb_logo.png" class="brand-logo" alt="Logo LMB">
        <div class="brand-title">
          <h1 id="brand-site-title">LMB BÉISBOL</h1>
          <span>Buenos Aires</span>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:8px;">
        <button id="user-action-btn" class="md-btn md-btn-outlined" style="padding:6px 12px; font-size:0.78rem;">
          <span class="material-icons-round">account_circle</span> Acceder
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
    <div id="snackbar" style="display:none; position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#0F172A; border:1px solid #3B82F6; color:#FFFFFF; padding:10px 20px; border-radius:99px; font-size:0.85rem; font-weight:700; z-index:400; box-shadow:0 8px 24px rgba(0,0,0,0.6);">
      Notificación
    </div>

  </div>

  <!-- Auth Dialog Modal Bottom Sheet -->
  <div id="auth-modal" class="md-modal-backdrop" onclick="if(event.target===this) App.closeAuthModal()">
    <div class="md-bottom-sheet">
      <div class="sheet-handle"></div>
      
      <!-- Tab Selector -->
      <div style="display:flex; gap:8px; border-bottom:1px solid var(--md-sys-color-outline); padding-bottom:12px;">
        <button id="auth-tab-login-btn" class="md-btn md-btn-primary" style="flex:1;" onclick="App.switchAuthTab('login')">Iniciar Sesión</button>
        <button id="auth-tab-register-btn" class="md-btn md-btn-outlined" style="flex:1;" onclick="App.switchAuthTab('register')">Crear Cuenta</button>
      </div>

      <!-- Login Form -->
      <form id="login-form" onsubmit="App.handleLogin(event)" style="display:flex; flex-direction:column; gap:12px;">
        <div class="form-group">
          <label>Usuario o Correo Electrónico</label>
          <input type="text" id="login-username" class="form-control" placeholder="ej. admin@lmb.org.ar" required>
        </div>
        <div class="form-group">
          <label>Contraseña</label>
          <input type="password" id="login-password" class="form-control" placeholder="••••••••" required>
        </div>
        <button type="submit" class="md-btn md-btn-primary" style="margin-top:8px;">🚀 Entrar</button>
      </form>

      <!-- Register Form -->
      <form id="register-form" onsubmit="App.handleRegister(event)" style="display:none; flex-direction:column; gap:12px;">
        <div id="first-user-banner" class="md-card" style="display:none; background: linear-gradient(135deg, #D97706 0%, #B45309 100%); color:#FFFFFF; padding:10px 14px; font-size:0.8rem; text-align:center;">
          🌟 <strong>¡Serás el primer usuario registrado!</strong> Se te otorgará el rol de <strong>Super Administrador</strong> automáticamente.
        </div>

        <div class="form-group">
          <label>Nombre Completo</label>
          <input type="text" id="reg-name" class="form-control" placeholder="ej. Juan Pérez" required>
        </div>
        <div class="form-group">
          <label>Correo Electrónico</label>
          <input type="email" id="reg-email" class="form-control" placeholder="ej. juan@lmb.org.ar" required>
        </div>
        <div class="form-group">
          <label>Nombre de Usuario</label>
          <input type="text" id="reg-username" class="form-control" placeholder="ej. juanperez" required>
        </div>
        <div class="form-group">
          <label>Contraseña</label>
          <input type="password" id="reg-password" class="form-control" placeholder="••••••••" required>
        </div>
        <button type="submit" class="md-btn md-btn-gold" style="margin-top:8px;">✨ Registrarse</button>
      </form>
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

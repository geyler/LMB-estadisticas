<?php
/**
 * Main Web Application Entry Point
 * Liga Metropolitana de Béisbol (LMB)
 * Responsive PWA & SPA Engine
 */
session_start();
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>LMB Béisbol | Liga Metropolitana Bs. As.</title>
  
  <meta name="description" content="Plataforma oficial de la Liga Metropolitana de Béisbol de Buenos Aires. Estadísticas en vivo, posiciones y resultados.">
  <meta name="theme-color" content="#070D1B">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="LMB Stats">
  <link rel="apple-touch-icon" href="assets/images/lmb_logo.png">
  
  <link rel="manifest" href="assets/manifest.json">
  <link rel="icon" type="image/png" href="assets/images/lmb_logo.png">
  <link rel="stylesheet" href="assets/css/material-theme.css?v=2.2">
</head>
<body>

  <!-- App Shell Container (Max 768px Fluid) -->
  <div id="app-container">

    <!-- Sticky PWA Installation Alert Banner -->
    <div id="pwa-install-banner" class="md-card" style="display:none; position:fixed; bottom:74px; left:50%; transform:translateX(-50%); width: calc(100% - 24px); max-width: 744px; z-index: 250; background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); border: 1px solid var(--lmb-blue-primary); box-shadow: 0 8px 32px rgba(0,0,0,0.6); padding: 12px 14px; border-radius: 16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <img src="assets/images/lmb_logo.png" style="width:40px; height:40px; min-width:40px; border-radius:50%; border:2px solid #F59E0B; object-fit:cover;" alt="LMB">
          <div style="min-width:0;">
            <div style="font-weight:800; font-size:0.88rem; color:#FFFFFF;" class="text-truncate">¡Instala LMB Stats App!</div>
            <div style="font-size:0.75rem; color:#94A3B8; line-height:1.2;" class="text-truncate">Acceso directo, alertas en vivo y uso sin conexión.</div>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="md-btn md-btn-primary" style="padding:6px 12px; font-size:0.78rem;" onclick="App.installPwa()">Instalar</button>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.dismissPwaBanner()">✕</button>
        </div>
      </div>
    </div>
    
    <!-- Top Sticky Header -->
    <header class="md-top-app-bar">
      <div class="brand-wrapper" onclick="App.showView('home')">
        <img id="brand-site-logo" src="assets/images/lmb_logo.png" alt="LMB Logo" class="brand-logo">
        <div class="brand-title">
          <h1 id="brand-site-title" class="text-truncate">LMB BÉISBOL</h1>
          <span>Bs. As.</span>
        </div>
      </div>

      <button id="user-action-btn" class="md-btn md-btn-outlined" style="padding: 4px 10px; font-size: 0.75rem;">
        <span class="material-icons-round" style="font-size: 16px;">login</span> Acceder
      </button>
    </header>

    <!-- Scorebug Ticker Carousel -->
    <div id="scorebug-carousel" class="scorebug-container">
      <!-- Dynamic ticker cards inserted by App.renderScorebugCarousel -->
    </div>

    <!-- Category Filter Chips -->
    <div id="global-category-chips" class="md-chip-group">
      <!-- Dynamic chips loaded by App.loadLeagues -->
    </div>

    <!-- Dynamic SPA View Mount -->
    <main id="view-container">
      <div class="view-content" style="text-align: center; padding: 40px 16px;">
        <div style="font-size: 1.1rem; font-weight: 700; color: #F59E0B;">Cargando LMB Béisbol...</div>
      </div>
    </main>

    <!-- Bottom Floating Navigation Bar -->
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
        <span class="material-icons-round">admin_panel_settings</span>
        <span>Admin</span>
      </button>
    </nav>

    <!-- Snackbar Notification Toast -->
    <div id="snackbar" style="display:none; position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#3B82F6; color:#FFF; padding:10px 18px; border-radius:99px; font-size:0.8rem; font-weight:700; box-shadow:0 4px 16px rgba(0,0,0,0.5); z-index:400; white-space:nowrap;"></div>

    <!-- Auth Bottom Sheet Modal Dialog (Login & Register) -->
    <div id="auth-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet">
        <div class="sheet-handle" onclick="App.closeAuthModal()"></div>
        
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; gap:8px;">
            <button id="auth-tab-login-btn" class="md-btn md-btn-primary" style="padding:6px 14px; font-size:0.8rem;" onclick="App.switchAuthTab('login')">Iniciar Sesión</button>
            <button id="auth-tab-register-btn" class="md-btn md-btn-outlined" style="padding:6px 14px; font-size:0.8rem;" onclick="App.switchAuthTab('register')">Crear Cuenta</button>
          </div>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeAuthModal()">❌</button>
        </div>

        <div id="first-user-banner" class="md-card" style="display:none; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color:#000; padding:10px;">
          <div style="font-weight:800; font-size:0.82rem;">🌟 ¡Serás el primer usuario registrado y tomarás el control como Super Administrador!</div>
        </div>

        <!-- Login Form -->
        <form id="login-form" style="display:flex; flex-direction:column; gap:10px;" onsubmit="App.handleLogin(event)">
          <div class="form-group">
            <label>Usuario o Correo Electrónico</label>
            <input type="text" id="login-username" class="form-control" required placeholder="admin o correo@ejemplo.com">
          </div>
          <div class="form-group">
            <label>Contraseña</label>
            <input type="password" id="login-password" class="form-control" required placeholder="••••••••">
          </div>
          <button type="submit" class="md-btn md-btn-primary" style="width:100%; margin-top:6px;">Acceder a la Cuenta</button>
        </form>

        <!-- Register Form -->
        <form id="register-form" style="display:none; flex-direction:column; gap:10px;" onsubmit="App.handleRegister(event)">
          <div class="form-group">
            <label>Nombre y Apellido</label>
            <input type="text" id="reg-name" class="form-control" required placeholder="Ej. Juan Pérez">
          </div>
          <div class="form-group">
            <label>Correo Electrónico</label>
            <input type="email" id="reg-email" class="form-control" required placeholder="correo@ejemplo.com">
          </div>
          <div class="form-group">
            <label>Nombre de Usuario (Login)</label>
            <input type="text" id="reg-username" class="form-control" required placeholder="juanperez">
          </div>
          <div class="form-group">
            <label>Contraseña (mínimo 6 caracteres)</label>
            <input type="password" id="reg-password" class="form-control" required minlength="6" placeholder="••••••••">
          </div>
          <div class="form-group">
            <label>Confirmar Contraseña</label>
            <input type="password" id="reg-password-confirm" class="form-control" required minlength="6" placeholder="••••••••">
          </div>
          <button type="submit" class="md-btn md-btn-gold" style="width:100%; margin-top:6px;">Crear Cuenta de Usuario</button>
        </form>
      </div>
    </div>

    <!-- Logged In User Profile & Account Settings Modal -->
    <div id="user-profile-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet">
        <div class="sheet-handle" onclick="App.closeUserProfileModal()"></div>
        
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:1.05rem; font-weight:800; color:#FFFFFF; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="color:#F59E0B;">account_circle</span> Mi Perfil de Usuario
          </h3>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeUserProfileModal()">❌</button>
        </div>

        <div id="user-profile-details">
          <!-- Dynamic Profile Data injected by App.showUserModal -->
        </div>
      </div>
    </div>

  </div>

  <!-- Scripts -->
  <script src="assets/js/offline-sync.js?v=2.1"></script>
  <script src="assets/js/live-scorer.js?v=2.1"></script>
  <script src="assets/js/app.js?v=2.1"></script>

  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js?v=2.1').then(reg => {
          console.log('ServiceWorker registrado:', reg.scope);
        }).catch(err => console.error('Error ServiceWorker:', err));
      });
    }
  </script>
</body>
</html>

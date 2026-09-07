<?php
/**
 * Main Web Application Entry Point
 * Liga Metropolitana de Béisbol (LMB)
 * Responsive PWA & SPA Engine
 */
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: 0");
session_start();
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>LMB Béisbol | Liga Metropolitana Bs. As.</title>
  
  <meta name="description" content="Plataforma oficial de la Liga Metropolitana de Béisbol de Buenos Aires. Estadísticas en vivo, posiciones, calendarios y perfiles de jugadores.">
  <meta name="theme-color" content="#070D1B">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="LMB Stats">
  <link rel="apple-touch-icon" href="assets/images/lmb_logo.png">

  <!-- Open Graph & Social SEO -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="LMB Béisbol - Liga Metropolitana de Béisbol">
  <meta property="og:description" content="Estadísticas oficiales, partidos en vivo, tablas de posiciones y líderes de bateo y pitcheo de la LMB Buenos Aires.">
  <meta property="og:image" content="assets/images/lmb_logo.png">
  <meta property="og:site_name" content="LMB Béisbol">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="LMB Béisbol - Liga Metropolitana">
  <meta name="twitter:description" content="Sigue las estadísticas oficiales y anotación en vivo de la Liga Metropolitana de Béisbol de Buenos Aires.">
  <meta name="twitter:image" content="assets/images/lmb_logo.png">

  <!-- Structured Data JSON-LD Schema.org -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    "name": "Liga Metropolitana de Béisbol",
    "alternateName": "LMB",
    "url": "https://lmb.cubasoft.net",
    "logo": "https://lmb.cubasoft.net/assets/images/lmb_logo.png",
    "sport": "Baseball",
    "location": {
      "@type": "Place",
      "name": "Buenos Aires",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Buenos Aires",
        "addressCountry": "AR"
      }
    },
    "description": "Estadísticas oficiales, calendario de partidos, posiciones y anotación en vivo de la Liga Metropolitana de Béisbol de Buenos Aires."
  }
  </script>
  
  <link rel="manifest" href="assets/manifest.json">
  <link rel="icon" type="image/png" href="assets/images/lmb_logo.png">
  <link rel="stylesheet" href="assets/css/material-theme.css?v=<?= time() ?>">
</head>
<body>

  <!-- App Shell Container (Max 768px Fluid) -->
  <div id="app-container">

    <!-- Sticky PWA Installation Alert Banner -->
    <div id="pwa-install-banner" class="md-card" style="display:none; position:fixed; bottom:74px; left:50%; transform:translateX(-50%); width: calc(100% - 24px); max-width: 744px; z-index: 250; background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); border: 1px solid var(--lmb-blue-primary); box-shadow: 0 8px 32px rgba(0,0,0,0.6); padding: 12px 14px; border-radius: 16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <img src="assets/images/lmb_logo.png" style="width:40px; height:40px; min-width:40px; border-radius:50%; border:2px solid #1A73E8; object-fit:cover;" alt="LMB">
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
        <img id="brand-site-logo" src="assets/images/lmb_logo.png" alt="LMB Logo" class="brand-logo" onerror="this.src='assets/images/lmb_logo.png'">
        <div class="brand-title">
          <h1 id="brand-site-title" class="text-truncate">LMB</h1>
          <span>BS. AS.</span>
        </div>
      </div>

      <div class="header-actions">
        <button class="md-btn md-btn-outlined header-btn" onclick="App.showView('onboarding')" title="Guía Paso a Paso">
          📖 <span class="hide-mobile">Guía</span>
        </button>
        <button id="user-action-btn" class="md-btn md-btn-outlined user-badge-btn">
          <span class="material-icons-round" style="font-size: 16px;">login</span> Acceder
        </button>
      </div>
    </header>

    <!-- Scorebug Ticker Carousel -->
    <div id="scorebug-carousel" class="scorebug-container">
      <!-- Dynamic ticker cards inserted by App.renderScorebugCarousel -->
    </div>

    <!-- Google Sports Main Sub-Navigation Pills -->
    <div id="google-main-pills" class="google-nav-pills">
      <button id="pill-home" class="google-pill active" onclick="App.showView('home')">Información general</button>
      <button id="pill-calendar" class="google-pill" onclick="App.showView('calendar')">Partidos</button>
      <button id="pill-standings" class="google-pill" onclick="App.showView('standings')">Posiciones</button>
      <button id="pill-leaders" class="google-pill" onclick="App.showView('leaders')">Estadísticas</button>
      <button id="pill-teams" class="google-pill" onclick="App.showView('teams')">Jugadores y Equipos</button>
    </div>

    <!-- Category Filter Chips -->
    <div id="global-category-chips" class="md-chip-group">
      <!-- Dynamic chips loaded by App.loadLeagues -->
    </div>

    <!-- Dynamic SPA View Mount -->
    <main id="view-container">
      <div class="view-content" style="text-align: center; padding: 40px 16px;">
        <div style="font-size: 1.1rem; font-weight: 700; color: #1A73E8;">Cargando LMB Béisbol...</div>
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
      <button id="nav-standings" class="nav-item" onclick="App.showView('standings')">
        <span class="material-icons-round">leaderboard</span>
        <span>Posiciones</span>
      </button>
      <button id="nav-leaders" class="nav-item" onclick="App.showView('leaders')">
        <span class="material-icons-round">workspace_premium</span>
        <span>Líderes</span>
      </button>
      <button id="nav-admin" class="nav-item" onclick="App.showView('admin')">
        <span class="material-icons-round">admin_panel_settings</span>
        <span>Admin</span>
      </button>
    </nav>

    <!-- Snackbar Notification Toast -->
    <div id="snackbar" style="display:none; position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#3B82F6; color:#FFF; padding:10px 18px; border-radius:99px; font-size:0.8rem; font-weight:700; box-shadow:0 4px 16px rgba(0,0,0,0.5); z-index:400; white-space:nowrap;"></div>

    <!-- Global Auth / Login Sheet Modal -->
    <div id="auth-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet">
        <div class="sheet-handle" onclick="App.closeAuthModal()"></div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div id="auth-modal-tabs" style="display:flex; gap:8px;">
            <button id="tab-login" class="md-btn md-btn-primary" style="padding:6px 14px; font-size:0.85rem;" onclick="App.switchAuthTab('login')">Ingresar</button>
            <button id="tab-register" class="md-btn md-btn-outlined" style="padding:6px 14px; font-size:0.85rem;" onclick="App.switchAuthTab('register')">Registrarse</button>
          </div>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeAuthModal()">❌</button>
        </div>

        <div id="first-user-banner" class="md-card" style="display:none; background: #E8F0FE; color:#1A73E8; border: 1px solid #AECBFA; padding:10px; border-radius:12px;">
          <div style="font-weight:800; font-size:0.82rem;">🌟 ¡Serás el primer usuario registrado y tomarás el control como Super Administrador!</div>
        </div>

        <!-- Dynamic Auth Error Alert Banner -->
        <div id="auth-error-alert" style="display:none; background: rgba(239, 68, 68, 0.15); border: 1px solid #EF4444; border-radius: 12px; padding: 10px 14px; color: #FCA5A5; font-size: 0.82rem; margin-bottom: 6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-icons-round" style="color:#EF4444; font-size:20px;">error_outline</span>
            <div id="auth-error-alert-msg" style="flex:1;">Error mensaje</div>
          </div>
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
          <h3 style="font-size:1.05rem; font-weight:800; color:#202124; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="color:#1A73E8;">account_circle</span> Mi Perfil de Usuario
          </h3>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeUserProfileModal()">❌</button>
        </div>

        <div id="user-profile-details">
          <!-- Dynamic Profile Data injected by App.showUserModal -->
        </div>
      </div>
    </div>

    <!-- Direct Match Result & Status Modal -->
    <div id="game-result-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet">
        <div class="sheet-handle" onclick="App.closeGameResultModal()"></div>
        
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:1.05rem; font-weight:800; color:#202124; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="color:#1A73E8;">edit_note</span> Cargar Resultado y Estado del Partido
          </h3>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeGameResultModal()">✕</button>
        </div>

        <form id="game-result-form" onsubmit="App.handleSaveGameResult(event)" style="display:flex; flex-direction:column; gap:10px;">
          <input type="hidden" id="gr-game-id">
          
          <div class="form-group">
            <label style="color:#202124; font-weight:800;">Estado del Partido</label>
            <select id="gr-status" class="form-control" style="font-weight:700;">
              <option value="scheduled">📅 Programado</option>
              <option value="live">🔴 En Vivo</option>
              <option value="delayed">⏳ Retrasado</option>
              <option value="awaiting_data">📝 Esperando datos</option>
              <option value="finished">🏁 Finalizado</option>
              <option value="cancelled">❌ Cancelado</option>
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; background:#F8F9FA; border:1px solid #DADCE0; padding:10px; border-radius:12px;">
            <div style="text-align:center;">
              <div id="gr-away-team-label" style="font-weight:800; color:#202124; font-size:0.85rem;" class="text-truncate">Visitante</div>
              <div class="form-group" style="margin-top:6px;">
                <label>Carreras (C)</label>
                <input type="number" id="gr-away-score" class="form-control" min="0" value="0" style="text-align:center; font-size:1.1rem; font-weight:800;">
              </div>
              <div class="form-group" style="margin-top:4px;">
                <label>Hits (H)</label>
                <input type="number" id="gr-away-hits" class="form-control" min="0" value="0" style="text-align:center;">
              </div>
              <div class="form-group" style="margin-top:4px;">
                <label>Errores (E)</label>
                <input type="number" id="gr-away-errors" class="form-control" min="0" value="0" style="text-align:center;">
              </div>
            </div>

            <div style="text-align:center;">
              <div id="gr-home-team-label" style="font-weight:800; color:#3B82F6; font-size:0.85rem;" class="text-truncate">Local</div>
              <div class="form-group" style="margin-top:6px;">
                <label>Carreras (C)</label>
                <input type="number" id="gr-home-score" class="form-control" min="0" value="0" style="text-align:center; font-size:1.1rem; font-weight:800;">
              </div>
              <div class="form-group" style="margin-top:4px;">
                <label>Hits (H)</label>
                <input type="number" id="gr-home-hits" class="form-control" min="0" value="0" style="text-align:center;">
              </div>
              <div class="form-group" style="margin-top:4px;">
                <label>Errores (E)</label>
                <input type="number" id="gr-home-errors" class="form-control" min="0" value="0" style="text-align:center;">
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Notas / Resumen del Partido</label>
            <textarea id="gr-recap-notes" class="form-control" rows="2" placeholder="Comentarios del partido, incidencias o motivo de retraso..."></textarea>
          </div>

          <button type="submit" class="md-btn md-btn-primary" style="width:100%; margin-top:4px;">💾 Guardar Resultado y Estado</button>
        </form>
      </div>
    </div>

    <!-- Manual Player Stats Entry Modal -->
    <div id="manual-stats-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-height: 92vh;">
        <div class="sheet-handle" onclick="App.closeManualStatsModal()"></div>
        
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:1.05rem; font-weight:800; color:#202124; display:flex; align-items:center; gap:6px;" class="text-truncate">
            <span class="material-icons-round" style="color:#1A73E8;">groups</span> Estadísticas Individuales de Jugadores
          </h3>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeManualStatsModal()">✕</button>
        </div>

        <!-- Team Selector Tabs for Manual Stats -->
        <div style="display:flex; gap:8px; margin-bottom:4px;">
          <button id="ms-tab-away" class="md-btn md-btn-primary" style="flex:1; font-size:0.8rem;" onclick="App.switchManualStatsTeam('away')">Visitante</button>
          <button id="ms-tab-home" class="md-btn md-btn-outlined" style="flex:1; font-size:0.8rem;" onclick="App.switchManualStatsTeam('home')">Local</button>
        </div>

        <div id="manual-stats-body" style="display:flex; flex-direction:column; gap:12px;">
          <!-- Injected dynamically by App.renderManualStatsContent -->
        </div>
      </div>
    </div>

    <!-- User Role & Team Assignment Modal (Replaces Browser Prompt) -->
    <div id="role-edit-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet">
        <div class="sheet-handle" onclick="App.closeRoleEditModal()"></div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:1.05rem; font-weight:800; color:#202124; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="color:#1A73E8;">manage_accounts</span> Asignar Rol y Equipo de Usuario
          </h3>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeRoleEditModal()">✕</button>
        </div>
        <form id="role-edit-form" onsubmit="App.handleSaveUserRole(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:8px;">
          <input type="hidden" id="re-user-id">
          <div style="font-size:0.85rem; font-weight:700; color:#1A73E8;" id="re-user-info">Usuario</div>
          <div class="form-group">
            <label style="color:#202124; font-weight:800;">Rol de Administración</label>
            <select id="re-user-role" class="form-control" style="font-weight:700;">
              <option value="super_admin">👑 Super Administrador</option>
              <option value="admin">🛡️ Administrador de Liga</option>
              <option value="team_admin">🧢 Administrador de Equipo</option>
              <option value="scorekeeper">⚾ Anotador / Scorekeeper</option>
              <option value="viewer">👁️ Espectador / Usuario</option>
            </select>
          </div>
          <div class="form-group">
            <label>Equipo Asignado (opcional)</label>
            <select id="re-user-team" class="form-control">
              <option value="">- Sin equipo específico -</option>
            </select>
          </div>
          <button type="submit" class="md-btn md-btn-primary" style="width:100%;">💾 Guardar Cambios de Rol</button>
        </form>
      </div>
    </div>

    <!-- Create Player / Staff Modal (Replaces Browser Prompts) -->
    <div id="create-player-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet">
        <div class="sheet-handle" onclick="App.closeCreatePlayerModal()"></div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:1.05rem; font-weight:800; color:#202124; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="color:#10B981;">person_add</span> Registrar en Plantel del Equipo
          </h3>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeCreatePlayerModal()">✕</button>
        </div>
        <form id="create-player-form" onsubmit="App.handleSaveNewPlayer(event)" style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
          <input type="hidden" id="cp-team-id">
          
          <div class="form-group">
            <label style="color:#202124; font-weight:800;">Tipo de Integrante</label>
            <select id="cp-role-type" class="form-control" style="font-weight:700;">
              <option value="player">⚾ Jugador Activo</option>
              <option value="manager">🧢 Manager / Mánager Principal</option>
              <option value="pitching_coach">⚾ Coach de Pitcheo</option>
              <option value="batting_coach">🏏 Coach de Bateo</option>
              <option value="delegado">📋 Delegado / Representante de Club</option>
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="form-group">
              <label>Nombre</label>
              <input type="text" id="cp-first-name" class="form-control" required placeholder="Ej. Juan">
            </div>
            <div class="form-group">
              <label>Apellido</label>
              <input type="text" id="cp-last-name" class="form-control" required placeholder="Ej. Pérez">
            </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="form-group">
              <label>Nº de Camiseta (#)</label>
              <input type="number" id="cp-jersey" class="form-control" required min="0" max="99" value="10">
            </div>
            <div class="form-group">
              <label>Posición Principal</label>
              <select id="cp-position" class="form-control">
                <option value="P">P - Lanzador / Pitcher</option>
                <option value="C">C - Receptor / Catcher</option>
                <option value="1B">1B - Primera Base</option>
                <option value="2B">2B - Segunda Base</option>
                <option value="3B">3B - Tercera Base</option>
                <option value="SS">SS - Torpedero / Shortstop</option>
                <option value="LF">LF - Jardinero Izquierdo</option>
                <option value="CF">CF - Jardinero Central</option>
                <option value="RF">RF - Jardinero Derecho</option>
                <option value="OF">OF - Jardinero General</option>
                <option value="DH">DH - Bateador Designado</option>
              </select>
            </div>
          </div>
          <button type="submit" class="md-btn md-btn-primary" style="width:100%;">➕ Guardar en Plantel</button>
        </form>
      </div>
    </div>

    <!-- Edit Player / Staff & Team Reassignment Modal -->
    <div id="edit-player-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:480px; max-height:90vh; overflow-y:auto;">
        <div class="sheet-handle" onclick="App.closeEditPlayerModal()"></div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:1.05rem; font-weight:800; color:#202124; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="color:#1A73E8;">person_edit</span> Editar Integrante del Plantel
          </h3>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeEditPlayerModal()">✕</button>
        </div>
        <form id="edit-player-form" onsubmit="App.handleSavePlayerEdit(event)" style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
          <input type="hidden" id="ep-player-id">

          <div class="form-group">
            <label style="color:#202124; font-weight:800;">⚾ Equipo Asignado (Mover a)</label>
            <select id="ep-team-id" class="form-control" style="font-weight:700;"></select>
          </div>

          <div class="form-group">
            <label style="color:#1A73E8; font-weight:800;">Tipo de Integrante / Rol</label>
            <select id="ep-role-type" class="form-control" style="font-weight:700;">
              <option value="player">⚾ Jugador Activo</option>
              <option value="manager">🧢 Manager / Mánager Principal</option>
              <option value="pitching_coach">⚾ Coach de Pitcheo</option>
              <option value="batting_coach">🏏 Coach de Bateo</option>
              <option value="delegado">📋 Delegado / Representante de Club</option>
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="form-group">
              <label>Nombre</label>
              <input type="text" id="ep-first-name" class="form-control" required placeholder="Ej. Juan">
            </div>
            <div class="form-group">
              <label>Apellido</label>
              <input type="text" id="ep-last-name" class="form-control" required placeholder="Ej. Pérez">
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="form-group">
              <label>Nº de Camiseta (#)</label>
              <input type="number" id="ep-jersey" class="form-control" required min="0" max="99" value="10">
            </div>
            <div class="form-group">
              <label>Posición Principal</label>
              <select id="ep-position-primary" class="form-control">
                <option value="P">P - Lanzador / Pitcher</option>
                <option value="C">C - Receptor / Catcher</option>
                <option value="1B">1B - Primera Base</option>
                <option value="2B">2B - Segunda Base</option>
                <option value="3B">3B - Tercera Base</option>
                <option value="SS">SS - Torpedero / Shortstop</option>
                <option value="LF">LF - Jardinero Izquierdo</option>
                <option value="CF">CF - Jardinero Central</option>
                <option value="RF">RF - Jardinero Derecho</option>
                <option value="OF">OF - Jardinero General</option>
                <option value="DH">DH - Bateador Designado</option>
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="form-group">
              <label>Batea</label>
              <select id="ep-bats" class="form-control">
                <option value="R">Derecho (R)</option>
                <option value="L">Zurdo (L)</option>
                <option value="S">Ambidextro (S)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Lanza</label>
              <select id="ep-throws" class="form-control">
                <option value="R">Derecho (R)</option>
                <option value="L">Zurdo (L)</option>
              </select>
            </div>
          </div>

          <div style="display:flex; gap:10px; margin-top:6px;">
            <button type="button" class="md-btn md-btn-outlined" style="flex:1;" onclick="App.closeEditPlayerModal()">Cancelar</button>
            <button type="submit" class="md-btn md-btn-primary" style="flex:1;">💾 Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Match Roster & Lineup Selection Modal -->
    <div id="game-lineup-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:540px; max-height:92vh; overflow-y:auto;">
        <div class="sheet-handle" onclick="App.closeGameLineupModal()"></div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:1.05rem; font-weight:800; color:#202124; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="color:#1A73E8;">checklist</span> Configurar Lineup de Partido
          </h3>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeGameLineupModal()">✕</button>
        </div>

        <div style="display:flex; gap:8px; margin:10px 0 6px 0;">
          <button id="gl-tab-away" class="md-btn md-btn-primary" style="flex:1; font-size:0.8rem;" onclick="App.switchGameLineupTeam('away')">Visitante</button>
          <button id="gl-tab-home" class="md-btn md-btn-outlined" style="flex:1; font-size:0.8rem;" onclick="App.switchGameLineupTeam('home')">Local</button>
        </div>

        <div id="game-lineup-body" style="display:flex; flex-direction:column; gap:12px;">
          <!-- Dynamically rendered -->
        </div>
      </div>
    </div>

    <!-- Single File / Photo Upload Modal -->
    <div id="file-upload-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:480px;">
        <div class="sheet-handle" onclick="App.closeFileUploadModal()"></div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:1.05rem; font-weight:800; color:#202124; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="color:#1A73E8;">cloud_upload</span> Subir Logo / Foto
          </h3>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeFileUploadModal()">✕</button>
        </div>
        <form id="file-upload-form" onsubmit="App.handleUploadFile(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">
          <input type="hidden" id="upload-type" value="logo">
          <input type="hidden" id="upload-target-id" value="0">
          <div class="form-group">
            <label style="font-weight:700; color:#202124;" id="upload-label-title">Seleccionar Archivo de Imagen</label>
            <input type="file" id="upload-file-input" class="form-control" accept="image/*" required style="padding:8px;">
          </div>
          <button type="submit" class="md-btn md-btn-primary" style="width:100%;">📤 Cargar Imagen</button>
        </form>
      </div>
    </div>

    <!-- Multi-Entity Photo Gallery Modal (Up to 10 photos) -->
    <div id="entity-gallery-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:600px; max-height:90vh; overflow-y:auto;">
        <div class="sheet-handle" onclick="App.closeEntityGalleryModal()"></div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:1.05rem; font-weight:800; color:#202124; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="color:#1A73E8;">photo_library</span> Galería de Postales e Imágenes (Máx. 10)
          </h3>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeEntityGalleryModal()">✕</button>
        </div>
        
        <div id="gallery-upload-section" style="margin-top:10px; padding:10px; background:#F8F9FA; border:1px solid #DADCE0; border-radius:12px;">
          <form id="gallery-upload-form" onsubmit="App.handleUploadGalleryPhoto(event)" style="display:flex; flex-direction:column; gap:8px;">
            <input type="hidden" id="gallery-entity-type">
            <input type="hidden" id="gallery-entity-id">
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <input type="file" id="gallery-file-input" class="form-control" accept="image/*" required style="flex:1; font-size:0.8rem; padding:4px;">
              <input type="text" id="gallery-caption-input" class="form-control" placeholder="Descripción / Leyenda" style="flex:1; font-size:0.8rem;">
              <button type="submit" class="md-btn md-btn-primary" style="padding:6px 12px; font-size:0.8rem; flex-shrink:0;">➕ Subir</button>
            </div>
          </form>
        </div>

        <div id="gallery-photos-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:10px; margin-top:12px;">
          <!-- Loaded dynamically -->
        </div>
      </div>
    </div>

    <!-- Post-Game Manual Player Stats Entry Modal -->
    <div id="game-stats-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:540px; max-height:92vh; overflow-y:auto;">
        <div class="sheet-handle" onclick="App.closeGameStatsModal()"></div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:1.05rem; font-weight:800; color:#202124; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="color:#1A73E8;">analytics</span> Cargar / Editar Estadísticas Post-Partido
          </h3>
          <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.75rem;" onclick="App.closeGameStatsModal()">✕</button>
        </div>
        <form id="game-stats-form" onsubmit="App.handleSaveManualPlayerStats(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">
          <input type="hidden" id="gs-game-id">
          <input type="hidden" id="gs-team-id">

          <div class="form-group">
            <label style="color:#1A73E8; font-weight:800;">Seleccionar Jugador del Partido</label>
            <select id="gs-player-id" class="form-control" style="font-weight:700;" onchange="App.onManualStatPlayerChange(this.value)">
              <!-- Loaded dynamically -->
            </select>
          </div>

          <div style="background:#F8F9FA; border:1px solid #DADCE0; border-radius:10px; padding:10px;">
            <div style="font-size:0.85rem; font-weight:800; color:#1A73E8; margin-bottom:8px;">🏏 ESTADÍSTICAS DE BATEO</div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px;">
              <div>
                <label style="font-size:0.7rem;">Turnos (AB)</label>
                <input type="number" id="gs-ab" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Hits (H)</label>
                <input type="number" id="gs-h" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Carreras (R)</label>
                <input type="number" id="gs-r" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Dobles (2B)</label>
                <input type="number" id="gs-2b" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Triples (3B)</label>
                <input type="number" id="gs-3b" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Jonrones (HR)</label>
                <input type="number" id="gs-hr" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Impulsadas (RBI)</label>
                <input type="number" id="gs-rbi" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Boletos (BB)</label>
                <input type="number" id="gs-bb" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Ponches (SO)</label>
                <input type="number" id="gs-so" class="form-control" min="0" value="0">
              </div>
            </div>
          </div>

          <div style="background:#F8F9FA; border:1px solid #DADCE0; border-radius:10px; padding:10px;">
            <div style="font-size:0.85rem; font-weight:800; color:#1A73E8; margin-bottom:8px;">⚾ ESTADÍSTICAS DE PITCHEO (Si lanzó)</div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px;">
              <div>
                <label style="font-size:0.7rem;">Outs (IP: 3 outs = 1 Inn)</label>
                <input type="number" id="gs-p-ipouts" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Hits (H)</label>
                <input type="number" id="gs-p-h" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Carreras (R)</label>
                <input type="number" id="gs-p-r" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Limpias (ER)</label>
                <input type="number" id="gs-p-er" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Boletos (BB)</label>
                <input type="number" id="gs-p-bb" class="form-control" min="0" value="0">
              </div>
              <div>
                <label style="font-size:0.7rem;">Ponches (SO)</label>
                <input type="number" id="gs-p-so" class="form-control" min="0" value="0">
              </div>
              <div style="grid-column: span 3;">
                <label style="font-size:0.7rem;">Decisión de Lanzador</label>
                <select id="gs-p-decision" class="form-control">
                  <option value="NONE">Ninguna / Relevo Normal</option>
                  <option value="W">W - Lanzador Ganador</option>
                  <option value="L">L - Lanzador Perdedor</option>
                  <option value="SV">SV - Juego Salvado</option>
                </select>
              </div>
            </div>
          </div>

          <button type="submit" class="md-btn md-btn-primary" style="width:100%;">💾 Guardar Estadísticas de Jugador</button>
        </form>
      </div>
    </div>

    <!-- Custom System Alert & Confirm Dialog Modal -->
    <div id="custom-alert-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:440px;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <span id="custom-alert-icon" class="material-icons-round" style="font-size:28px; color:#1A73E8;">info</span>
          <div style="font-weight:800; font-size:1.1rem; color:#202124;" id="custom-alert-title">Atención</div>
        </div>
        <div style="font-size:0.88rem; color:#5F6368; margin-bottom:16px; line-height:1.4;" id="custom-alert-message">Mensaje del sistema</div>
        <div style="display:flex; gap:10px;">
          <button class="md-btn md-btn-outlined" style="flex:1; display:none;" id="custom-alert-cancel-btn">Cancelar</button>
          <button class="md-btn md-btn-primary" style="flex:1;" id="custom-alert-ok-btn">Aceptar</button>
        </div>
      </div>
    </div>

    <!-- Custom Prompt Dialog Modal -->
    <div id="custom-prompt-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:440px;">
        <div style="font-weight:800; font-size:1.1rem; color:#202124;" id="prompt-modal-title">Ingresar Valor</div>
        <p style="font-size:0.82rem; color:#5F6368; margin:4px 0 8px 0;" id="prompt-modal-msg">Ingrese el valor requerido:</p>
        <input type="text" id="prompt-modal-input" class="form-control" style="margin-bottom:14px;">
        <div style="display:flex; gap:10px;">
          <button class="md-btn md-btn-outlined" style="flex:1;" id="prompt-modal-cancel">Cancelar</button>
          <button class="md-btn md-btn-primary" style="flex:1;" id="prompt-modal-ok">Aceptar</button>
        </div>
      </div>
    <!-- Full Create Team Modal -->
    <div id="create-team-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:480px; max-height:90vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:1.1rem; font-weight:800; color:#202124;">🛡️ Registrar Nuevo Equipo</h3>
          <button class="md-btn md-btn-outlined" style="padding:2px 8px; font-size:0.75rem;" onclick="App.closeCreateTeamModal()">✕</button>
        </div>
        <form onsubmit="App.handleSaveNewTeam(event);">
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Nombre del Equipo</label>
            <input type="text" id="ct-team-name" class="form-control" placeholder="Ej. Criollos de Buenos Aires" required>
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Abreviatura (3-4 letras)</label>
            <input type="text" id="ct-team-short" class="form-control" maxlength="10" placeholder="Ej. CRIO" required>
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Categoría / División</label>
            <select id="ct-team-category" class="form-control"></select>
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">📍 Sede Deportiva / Campo Local</label>
            <select id="ct-team-stadium" class="form-control"></select>
          </div>
          <div style="display:flex; gap:10px; margin-top:14px;">
            <button type="button" class="md-btn md-btn-outlined" style="flex:1;" onclick="App.closeCreateTeamModal()">Cancelar</button>
            <button type="submit" class="md-btn md-btn-primary" style="flex:1;">➕ Guardar Equipo</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Full Edit Team Modal -->
    <div id="edit-team-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:480px; max-height:90vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:1.1rem; font-weight:800; color:#202124;">✏️ Editar Equipo Completo</h3>
          <button class="md-btn md-btn-outlined" style="padding:2px 8px; font-size:0.75rem;" onclick="App.closeEditTeamModal()">✕</button>
        </div>
        <form onsubmit="App.handleSaveTeamEdit(event);">
          <input type="hidden" id="edit-team-id">
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Nombre del Equipo</label>
            <input type="text" id="edit-team-name" class="form-control" required>
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Abreviatura (3 letras)</label>
            <input type="text" id="edit-team-short" class="form-control" maxlength="10" required>
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Categoría / División</label>
            <select id="edit-team-category" class="form-control"></select>
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">📍 Sede Deportiva / Campo Local</label>
            <select id="edit-team-stadium" class="form-control"></select>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
            <div>
              <label style="font-size:0.75rem;">Color Primario</label>
              <input type="color" id="edit-team-color1" class="form-control" style="height:38px; padding:2px;">
            </div>
            <div>
              <label style="font-size:0.75rem;">Color Secundario</label>
              <input type="color" id="edit-team-color2" class="form-control" style="height:38px; padding:2px;">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
            <div>
              <label style="font-size:0.75rem;">Año de Fundación</label>
              <input type="number" id="edit-team-foundation" class="form-control" placeholder="1950">
            </div>
            <div>
              <label style="font-size:0.75rem;">URL del Logo (Opcional)</label>
              <input type="text" id="edit-team-logo" class="form-control" placeholder="assets/images/logo.png">
            </div>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="md-btn md-btn-outlined" style="flex:1;" onclick="App.closeEditTeamModal()">Cancelar</button>
            <button type="submit" class="md-btn md-btn-primary" style="flex:1;">💾 Guardar Todos los Cambios</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Category CRUD Modals -->
    <div id="create-category-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:440px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:1.1rem; font-weight:800; color:#202124;">🏆 Nueva Categoría / División</h3>
          <button class="md-btn md-btn-outlined" style="padding:2px 8px; font-size:0.75rem;" onclick="App.closeCreateCategoryModal()">✕</button>
        </div>
        <form onsubmit="App.handleSaveNewCategory(event);">
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Nombre de la Categoría</label>
            <input type="text" id="cc-name" class="form-control" placeholder="Ej. Primera División A1" required>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label style="font-size:0.78rem; font-weight:700;">Código / Abreviatura</label>
            <input type="text" id="cc-code" class="form-control" placeholder="Ej. A1" required>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="md-btn md-btn-outlined" style="flex:1;" onclick="App.closeCreateCategoryModal()">Cancelar</button>
            <button type="submit" class="md-btn md-btn-primary" style="flex:1;">💾 Guardar Categoría</button>
          </div>
        </form>
      </div>
    </div>

    <div id="edit-category-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:440px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:1.1rem; font-weight:800; color:#202124;">✏️ Editar Categoría</h3>
          <button class="md-btn md-btn-outlined" style="padding:2px 8px; font-size:0.75rem;" onclick="App.closeEditCategoryModal()">✕</button>
        </div>
        <form onsubmit="App.handleSaveCategoryEdit(event);">
          <input type="hidden" id="ec-id">
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Nombre de la Categoría</label>
            <input type="text" id="ec-name" class="form-control" required>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label style="font-size:0.78rem; font-weight:700;">Código / Abreviatura</label>
            <input type="text" id="ec-code" class="form-control" required>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="md-btn md-btn-outlined" style="flex:1;" onclick="App.closeEditCategoryModal()">Cancelar</button>
            <button type="submit" class="md-btn md-btn-primary" style="flex:1;">💾 Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Stadium CRUD Modals -->
    <div id="create-stadium-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:440px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:1.1rem; font-weight:800; color:#202124;">📍 Nueva Sede Deportiva</h3>
          <button class="md-btn md-btn-outlined" style="padding:2px 8px; font-size:0.75rem;" onclick="App.closeCreateStadiumModal()">✕</button>
        </div>
        <form onsubmit="App.handleSaveNewStadium(event);">
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Nombre de la Sede / Predio</label>
            <input type="text" id="cs-name" class="form-control" placeholder="Ej. Estadio Ezeiza, Predio DAOM" required>
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Identificador de Cancha / Campo</label>
            <input type="text" id="cs-field" class="form-control" placeholder="Ej. Cancha 1" value="Cancha 1">
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label style="font-size:0.78rem; font-weight:700;">Dirección / Ubicación</label>
            <input type="text" id="cs-address" class="form-control" placeholder="Ej. Av. Ezeiza 1200, Buenos Aires">
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="md-btn md-btn-outlined" style="flex:1;" onclick="App.closeCreateStadiumModal()">Cancelar</button>
            <button type="submit" class="md-btn md-btn-primary" style="flex:1;">💾 Guardar Sede</button>
          </div>
        </form>
      </div>
    </div>

    <div id="edit-stadium-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:440px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:1.1rem; font-weight:800; color:#202124;">✏️ Editar Sede Deportiva</h3>
          <button class="md-btn md-btn-outlined" style="padding:2px 8px; font-size:0.75rem;" onclick="App.closeEditStadiumModal()">✕</button>
        </div>
        <form onsubmit="App.handleSaveStadiumEdit(event);">
          <input type="hidden" id="es-id">
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Nombre de la Sede</label>
            <input type="text" id="es-name" class="form-control" required>
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Cancha / Campo</label>
            <input type="text" id="es-field" class="form-control">
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label style="font-size:0.78rem; font-weight:700;">Dirección / Ubicación</label>
            <input type="text" id="es-address" class="form-control">
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="md-btn md-btn-outlined" style="flex:1;" onclick="App.closeEditStadiumModal()">Cancelar</button>
            <button type="submit" class="md-btn md-btn-primary" style="flex:1;">💾 Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Create Season Modal -->
    <div id="create-season-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:440px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:1.1rem; font-weight:800; color:#202124;">🗓️ Nueva Temporada Oficial</h3>
          <button class="md-btn md-btn-outlined" style="padding:2px 8px; font-size:0.75rem;" onclick="App.closeCreateSeasonModal()">✕</button>
        </div>
        <form onsubmit="App.handleSaveNewSeason(event);">
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Nombre de la Temporada</label>
            <input type="text" id="cn-season-name" class="form-control" placeholder="Ej. Temporada Oficial 2026" required>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label style="font-size:0.78rem; font-weight:700;">Año</label>
            <input type="number" id="cn-season-year" class="form-control" value="2026" required>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="md-btn md-btn-outlined" style="flex:1;" onclick="App.closeCreateSeasonModal()">Cancelar</button>
            <button type="submit" class="md-btn md-btn-primary" style="flex:1;">🚀 Crear e Iniciar Temporada</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Full Schedule Game Modal -->
    <div id="create-game-modal" class="md-modal-backdrop">
      <div class="md-bottom-sheet" style="max-width:480px; max-height:90vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:1.1rem; font-weight:800; color:#202124;">⚾ Programar Partido</h3>
          <button class="md-btn md-btn-outlined" style="padding:2px 8px; font-size:0.75rem;" onclick="App.closeCreateGameModal()">✕</button>
        </div>
        <form onsubmit="App.handleSaveNewGame(event);">
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">Categoría / División</label>
            <select id="schedule-game-category" class="form-control" onchange="App.onGameCategoryChange()"></select>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
            <div>
              <label style="font-size:0.75rem; font-weight:700;">Equipo Local</label>
              <select id="schedule-game-home" class="form-control"></select>
            </div>
            <div>
              <label style="font-size:0.75rem; font-weight:700;">Equipo Visitante</label>
              <select id="schedule-game-away" class="form-control"></select>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">📍 Sede / Campo Deportivo</label>
            <select id="schedule-game-stadium" class="form-control"></select>
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.78rem; font-weight:700;">🏆 Etapa / Rol de Partido</label>
            <select id="schedule-game-stage" class="form-control"></select>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label style="font-size:0.78rem; font-weight:700;">📅 Fecha y Hora del Encuentro</label>
            <input type="datetime-local" id="schedule-game-date" class="form-control" required>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="md-btn md-btn-outlined" style="flex:1;" onclick="App.closeCreateGameModal()">Cancelar</button>
            <button type="submit" class="md-btn md-btn-primary" style="flex:1;">🗓️ Programar Partido</button>
          </div>
        </form>
      </div>
    </div>

  </div>


  <!-- Scripts -->
  <script src="assets/js/offline-sync.js?v=<?= time() ?>"></script>
  <script src="assets/js/live-scorer.js?v=<?= time() ?>"></script>
  <script src="assets/js/app.js?v=<?= time() ?>"></script>

  <script>
    // Enforce 100% Real-Time Database Mode: Purge all local cache storage & unregister stale workers
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
  </script>
</body>
</html>

/**
 * Main Single-Page Application (SPA) Engine for Liga Metropolitana de Béisbol (LMB)
 * Controls navigation, views, API requests, dynamic statistics renderers, standings & administration tabs
 */

const App = {
  currentView: 'home',
  currentCategory: 0,
  currentUser: null,
  activeSeason: null,
  categories: [],
  settings: { site_name: 'LMB BÉISBOL', site_logo: 'assets/images/lmb_logo.png' },
  adminTab: 'categories',
  authTab: 'login',

  deferredPwaPrompt: null,

  async init() {
    try {
      this.initTheme();
      await this.loadSettings();
      await this.checkAuth();
      await this.loadLeagues();
      this.setupEventListeners();
      this.initPwaInstaller();
    } catch (e) {
      console.error("Error en inicialización App:", e);
    } finally {
      this.showView('home');
    }
  },

  initTheme() {
    const savedTheme = localStorage.getItem('lmb_theme_preference') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    this.updateThemeButtonIcon();
  },

  toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    const newTheme = isLight ? 'light' : 'dark';
    localStorage.setItem('lmb_theme_preference', newTheme);
    this.updateThemeButtonIcon();
    this.showSnackbar(`Tema ${isLight ? 'Claro ☀️' : 'Oscuro 🌙'} activado.`);
  },

  updateThemeButtonIcon() {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      const isLight = document.body.classList.contains('light-theme');
      btn.innerHTML = isLight ? '☀️' : '🌙';
    }
  },

  showPrompt(title, message, defaultValue = '') {
    return new Promise((resolve) => {
      const modal = document.getElementById('custom-prompt-modal');
      if (!modal) { resolve(prompt(message, defaultValue)); return; }
      document.getElementById('prompt-modal-title').textContent = title;
      document.getElementById('prompt-modal-msg').innerText = message;
      const input = document.getElementById('prompt-modal-input');
      input.value = defaultValue;
      modal.classList.add('open');
      setTimeout(() => input.focus(), 100);

      const okBtn = document.getElementById('prompt-modal-ok');
      const cancelBtn = document.getElementById('prompt-modal-cancel');

      const cleanup = () => {
        modal.classList.remove('open');
        okBtn.onclick = null;
        cancelBtn.onclick = null;
      };

      okBtn.onclick = () => { const val = input.value.trim(); cleanup(); resolve(val); };
      cancelBtn.onclick = () => { cleanup(); resolve(null); };
    });
  },

  setupInfiniteScroll(containerId, itemSelector, pageSize = 8) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const items = Array.from(container.querySelectorAll(itemSelector));
    if (items.length <= pageSize) return;

    items.forEach((item, index) => {
      if (index >= pageSize) item.style.display = 'none';
    });

    let currentVisible = pageSize;

    const sentinel = document.createElement('div');
    sentinel.className = 'infinite-scroll-sentinel';
    sentinel.style.cssText = 'text-align:center; padding:12px; font-size:0.75rem; color:#94A3B8; font-weight:700; width:100%; grid-column: 1 / -1;';
    sentinel.innerHTML = `⬇️ Mostrando ${currentVisible} de ${items.length}. Desplaza para ver más...`;
    container.appendChild(sentinel);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && currentVisible < items.length) {
          const nextBatch = currentVisible + pageSize;
          for (let i = currentVisible; i < Math.min(nextBatch, items.length); i++) {
            items[i].style.display = '';
          }
          currentVisible = Math.min(nextBatch, items.length);
          if (currentVisible >= items.length) {
            sentinel.style.display = 'none';
            observer.disconnect();
          } else {
            sentinel.innerHTML = `⬇️ Mostrando ${currentVisible} de ${items.length}. Desplaza para ver más...`;
          }
        }
      });
    }, { rootMargin: '80px' });

    observer.observe(sentinel);
  },

  initPwaInstaller() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPwaPrompt = e;
      this.checkPwaInstallState();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPwaPrompt = null;
      this.hidePwaBanner();
      this.showSnackbar('¡App LMB Estadísticas instalada con éxito!');
    });

    setTimeout(() => this.checkPwaInstallState(), 1000);
  },

  checkPwaInstallState() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || document.referrer.includes('android-app://');
    if (isStandalone) {
      this.hidePwaBanner();
      return;
    }

    const dismissedTime = localStorage.getItem('lmb_pwa_dismissed');
    if (!dismissedTime || (Date.now() - parseInt(dismissedTime)) > (2 * 24 * 60 * 60 * 1000)) {
      this.showPwaBanner();
    }
  },

  showPwaBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'block';
  },

  hidePwaBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'none';
  },

  dismissPwaBanner() {
    localStorage.setItem('lmb_pwa_dismissed', Date.now().toString());
    this.hidePwaBanner();
  },

  // Custom HTML Alert & Confirm Dialogs (NO native browser alerts)
  showAlert(title, message, icon = 'info', iconColor = '#F59E0B') {
    return new Promise((resolve) => {
      const modal = document.getElementById('custom-alert-modal');
      const titleEl = document.getElementById('custom-alert-title');
      const msgEl = document.getElementById('custom-alert-message');
      const iconEl = document.getElementById('custom-alert-icon');
      const cancelBtn = document.getElementById('custom-alert-cancel-btn');
      const okBtn = document.getElementById('custom-alert-ok-btn');

      if (!modal) { alert(message); resolve(true); return; }

      if (titleEl) titleEl.innerText = title;
      if (msgEl) msgEl.innerHTML = message;
      if (iconEl) {
        iconEl.innerText = icon;
        iconEl.style.color = iconColor;
      }

      if (cancelBtn) cancelBtn.style.display = 'none';
      if (okBtn) {
        okBtn.className = 'md-btn md-btn-primary';
        okBtn.innerText = 'Aceptar';
      }

      modal.classList.add('open');

      const cleanup = () => {
        modal.classList.remove('open');
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        resolve(true);
      };

      okBtn.onclick = () => cleanup();
    });
  },

  showConfirm(title, message, icon = 'help', iconColor = '#EF4444') {
    return new Promise((resolve) => {
      const modal = document.getElementById('custom-alert-modal');
      const titleEl = document.getElementById('custom-alert-title');
      const msgEl = document.getElementById('custom-alert-message');
      const iconEl = document.getElementById('custom-alert-icon');
      const cancelBtn = document.getElementById('custom-alert-cancel-btn');
      const okBtn = document.getElementById('custom-alert-ok-btn');

      if (!modal) { resolve(confirm(message)); return; }

      if (titleEl) titleEl.innerText = title;
      if (msgEl) msgEl.innerHTML = message;
      if (iconEl) {
        iconEl.innerText = icon;
        iconEl.style.color = iconColor;
      }

      if (cancelBtn) cancelBtn.style.display = 'block';
      if (okBtn) {
        okBtn.className = 'md-btn md-btn-danger';
        okBtn.innerText = 'Confirmar';
      }

      modal.classList.add('open');

      const cleanup = (result) => {
        modal.classList.remove('open');
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        resolve(result);
      };

      okBtn.onclick = () => cleanup(true);
      cancelBtn.onclick = () => cleanup(false);
    });
  },

  showAuthError(message) {
    const errorBox = document.getElementById('auth-error-alert');
    const errorMsg = document.getElementById('auth-error-alert-msg');
    if (errorBox && errorMsg) {
      errorMsg.innerHTML = message;
      errorBox.style.display = 'block';
    } else {
      this.showAlert('Atención', message, 'error_outline', '#EF4444');
    }
  },

  clearAuthError() {
    const errorBox = document.getElementById('auth-error-alert');
    if (errorBox) errorBox.style.display = 'none';
  },

  async installPwa() {
    if (this.deferredPwaPrompt) {
      this.deferredPwaPrompt.prompt();
      const choiceResult = await this.deferredPwaPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        this.showSnackbar('Instalando aplicación...');
      }
      this.deferredPwaPrompt = null;
      this.hidePwaBanner();
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        this.showAlert("Instalar en iOS (iPhone/iPad)", "📱 Para instalar en iOS:<br>1. Toca el botón <b>Compartir</b> en Safari (icono ⎘).<br>2. Selecciona <b>'Agregar a inicio'</b> ( ➕ ).", "get_app", "#3B82F6");
      } else {
        this.showSnackbar("Presione 'Agregar a pantalla principal' en las opciones de su navegador.");
      }
      this.dismissPwaBanner();
    }
  },

  async loadSettings() {
    try {
      const res = await fetch('api/auth.php?action=settings');
      const data = await res.json();
      if (data.success && data.settings) {
        this.settings = data.settings;
        this.applyBranding();
      }
    } catch (e) {
      console.error("Error al cargar ajustes", e);
    }
  },

  applyBranding() {
    const titleEl = document.getElementById('brand-site-title');
    const logoEl = document.getElementById('brand-site-logo');
    const subtitleEl = document.querySelector('.brand-title span');
    if (titleEl && this.settings.site_name) {
      titleEl.innerText = this.settings.site_name;
      document.title = `${this.settings.site_name} | LMB`;
    }
    if (subtitleEl && this.settings.site_subtitle) {
      subtitleEl.innerText = this.settings.site_subtitle;
    }
    if (logoEl && this.settings.site_logo) {
      logoEl.src = this.settings.site_logo;
    }
  },

  async checkAuth() {
    try {
      const res = await fetch('api/auth.php?action=me');
      const data = await res.json();
      if (data.success && data.user) {
        this.currentUser = data.user;
      } else {
        this.currentUser = null;
      }
      this.renderUserBadge();
    } catch (e) {
      console.error("Error al consultar sesión", e);
    }
  },

  async loadLeagues() {
    try {
      const res = await fetch('api/leagues.php?action=list');
      const data = await res.json();
      if (data.success) {
        this.activeSeason = data.active_season;
        this.categories = data.categories || [];
        this.renderCategoryChips();
      }
    } catch (e) {
      console.error("Error al cargar ligas", e);
    }
  },

  renderUserBadge() {
    const userBtn = document.getElementById('user-action-btn');
    if (!userBtn) return;
    if (this.currentUser) {
      const roleTag = this.currentUser.role === 'super_admin' ? 'SUPER' : (this.currentUser.role === 'team_admin' ? 'DELEGADO' : this.currentUser.role.toUpperCase());
      
      let teamBtnHtml = '';
      if (this.currentUser.role === 'team_admin' && this.currentUser.assigned_team_id) {
        teamBtnHtml = `<button class="md-btn md-btn-gold" style="padding:4px 8px; font-size:0.72rem; margin-right:6px;" onclick="event.stopPropagation(); App.showView('team_detail', ${this.currentUser.assigned_team_id})">🧢 Mi Club</button>`;
      }

      userBtn.parentElement.innerHTML = `
        <div style="display:flex; align-items:center;">
          ${teamBtnHtml}
          <button id="user-action-btn" class="md-btn md-btn-outlined" style="display:flex; align-items:center; gap:6px; padding:4px 10px; font-size:0.78rem;" onclick="App.showUserModal()">
            <span class="material-icons-round" style="color:#F59E0B; font-size:18px;">account_circle</span>
            <span class="user-badge-name text-truncate">${this.currentUser.name}</span>
            <span class="user-badge-role">${roleTag}</span>
          </button>
        </div>
      `;
    } else {
      userBtn.innerHTML = `<span class="material-icons-round" style="font-size:18px;">login</span> Acceder`;
      userBtn.onclick = () => this.openAuthModal('login');
    }
  },

  openAuthModal(defaultTab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    this.clearAuthError();
    modal.classList.add('open');
    this.switchAuthTab(defaultTab);
  },

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('open');
    this.clearAuthError();
  },

  async switchAuthTab(tab) {
    this.authTab = tab;
    this.clearAuthError();

    const loginBtn = document.getElementById('auth-tab-login-btn');
    const regBtn = document.getElementById('auth-tab-register-btn');
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const banner = document.getElementById('first-user-banner');

    if (tab === 'login') {
      if (loginBtn) loginBtn.className = 'md-btn md-btn-primary';
      if (regBtn) regBtn.className = 'md-btn md-btn-outlined';
      if (loginForm) loginForm.style.display = 'flex';
      if (regForm) regForm.style.display = 'none';
      if (banner) banner.style.display = 'none';
      
      const input = document.getElementById('login-username');
      if (input) setTimeout(() => input.focus(), 100);
    } else {
      if (loginBtn) loginBtn.className = 'md-btn md-btn-outlined';
      if (regBtn) regBtn.className = 'md-btn md-btn-gold';
      if (loginForm) loginForm.style.display = 'none';
      if (regForm) regForm.style.display = 'flex';

      try {
        const res = await fetch('api/auth.php?action=check_first_user');
        const data = await res.json();
        if (banner) {
          banner.style.display = (data.success && data.is_first_user) ? 'block' : 'none';
        }
      } catch (e) {
        if (banner) banner.style.display = 'none';
      }

      const input = document.getElementById('reg-name');
      if (input) setTimeout(() => input.focus(), 100);
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    this.clearAuthError();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
      this.showAuthError('Por favor complete usuario/correo y contraseña.');
      return;
    }

    try {
      const res = await fetch('api/auth.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        this.currentUser = data.user;
        this.renderUserBadge();
        this.closeAuthModal();
        this.showSnackbar(data.message || `Bienvenido/a, ${data.user.name}`);
        this.refreshCurrentView();
      } else {
        this.showAuthError(data.message || 'Usuario o contraseña incorrectos.');
      }
    } catch (err) {
      this.showAuthError('Error de conexión con el servidor.');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    this.clearAuthError();

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const confirmPassword = document.getElementById('reg-password-confirm').value.trim();

    if (!name || !email || !username || !password || !confirmPassword) {
      this.showAuthError('Por favor complete todos los campos obligatorios.');
      return;
    }

    if (name.length < 3) {
      this.showAuthError('El nombre debe tener al menos 3 caracteres.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showAuthError('El correo electrónico ingresado no tiene un formato válido.');
      return;
    }

    if (username.length < 3) {
      this.showAuthError('El usuario debe tener al menos 3 caracteres.');
      return;
    }

    if (password.length < 6) {
      this.showAuthError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      this.showAuthError('Las contraseñas no coinciden.');
      return;
    }

    try {
      const res = await fetch('api/auth.php?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, username, password, confirm_password: confirmPassword })
      });
      const data = await res.json();

      if (data.success) {
        this.currentUser = data.user;
        this.renderUserBadge();
        this.closeAuthModal();
        this.showAlert('¡Cuenta Creada!', data.message || `¡Cuenta registrada exitosamente!`, 'check_circle', '#10B981');
        this.refreshCurrentView();
      } else {
        this.showAuthError(data.message || 'Error al registrar la cuenta.');
      }
    } catch (err) {
      this.showAuthError('Error de conexión al procesar el registro.');
    }
  },

  renderCategoryChips() {
    const chipContainer = document.getElementById('global-category-chips');
    if (!chipContainer) return;

    if (!this.categories.length) {
      chipContainer.innerHTML = `<span style="font-size:0.75rem; color:#94A3B8;">Sin divisiones registradas</span>`;
      return;
    }

    let html = `<button class="md-chip ${this.currentCategory === 0 ? 'active' : ''}" onclick="App.setCategory(0)">Todas las Ligas</button>`;
    this.categories.forEach(c => {
      html += `<button class="md-chip ${this.currentCategory === c.id ? 'active' : ''}" onclick="App.setCategory(${c.id})">${c.name}</button>`;
    });
    chipContainer.innerHTML = html;
  },

  setCategory(catId) {
    this.currentCategory = catId;
    this.renderCategoryChips();
    this.refreshCurrentView();
  },

  refreshCurrentView() {
    this.showView(this.currentView);
  },

  showView(viewName, param = null) {
    this.currentView = viewName;

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${viewName}`);
    if (activeNav) activeNav.classList.add('active');

    const container = document.getElementById('view-container');
    if (!container) return;

    switch (viewName) {
      case 'home':
        this.renderHomeView(container);
        break;
      case 'onboarding':
        this.renderOnboardingView(container);
        break;
      case 'calendar':
        this.renderCalendarView(container);
        break;
      case 'teams':
        this.renderTeamsView(container);
        break;
      case 'team_detail':
        this.renderTeamDetailView(container, param);
        break;
      case 'player_detail':
        this.renderPlayerDetailView(container, param);
        break;
      case 'game_detail':
        this.renderGameDetailView(container, param);
        break;
      case 'leaders':
        this.renderLeadersView(container);
        break;
      case 'admin':
        this.renderAdminView(container);
        break;
      case 'users':
        this.renderUsersManagementView(container);
        break;
      default:
        this.renderHomeView(container);
    }
  },

  // ONBOARDING & GUIDED SETUP TUTORIAL VIEW
  async renderOnboardingView(container) {
    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando Guía de Inicio...</div></div>`;

    const [resCat, resTeams, resStadia, resPlayers, resGames] = await Promise.all([
      fetch('api/leagues.php?action=categories'),
      fetch('api/teams.php?action=list'),
      fetch('api/leagues.php?action=stadiums'),
      fetch('api/players.php?action=list'),
      fetch('api/games.php?action=list')
    ]);

    const cats = (await resCat.json()).categories || [];
    const teams = (await resTeams.json()).teams || [];
    const stadia = (await resStadia.json()).stadiums || [];
    const players = (await resPlayers.json()).players || [];
    const games = (await resGames.json()).games || [];

    const isAuth = (this.currentUser && ['super_admin', 'admin'].includes(this.currentUser.role));

    let html = `
      <div class="view-content">
        <div class="md-card" style="background: linear-gradient(135deg, #1E3A8A 0%, #070D1B 100%); text-align:center;">
          <div style="font-size:2rem; margin-bottom:4px;">📖</div>
          <h2 style="font-size:1.3rem; font-weight:800; color:#FFFFFF; margin:0;" class="text-truncate">Guía Paso a Paso de Inicio de Liga</h2>
          <p style="font-size:0.8rem; color:#94A3B8; margin-top:4px;">Sigue este flujo guiado e intuitivo para completar la base de datos de tu liga desde cero.</p>
        </div>

        <!-- Paso 1 -->
        <div class="md-card" style="margin-top:12px; border-left:4px solid ${cats.length ? '#10B981' : '#F59E0B'};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:0.95rem; color:#FFFFFF;">Paso 1: Temporadas y Categorías</div>
            <span class="md-chip ${cats.length ? 'active' : ''}">${cats.length ? `✅ ${cats.length} Categorías` : '⚠️ Requerido'}</span>
          </div>
          <p style="font-size:0.8rem; color:#94A3B8; margin:6px 0;">Crea las divisiones de la liga (ej. A1 Primera División, A2 Segunda División, Infantiles).</p>
          ${isAuth ? `<button class="md-btn md-btn-outlined" style="font-size:0.75rem; padding:4px 12px;" onclick="App.showView('admin')">⚙️ Gestionar Categorías</button>` : ''}
        </div>

        <!-- Paso 2 -->
        <div class="md-card" style="margin-top:10px; border-left:4px solid ${stadia.length ? '#10B981' : '#F59E0B'};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:0.95rem; color:#FFFFFF;">Paso 2: Sedes y Campos Deportivos</div>
            <span class="md-chip ${stadia.length ? 'active' : ''}">${stadia.length ? `✅ ${stadia.length} Sedes` : '⚠️ Requerido'}</span>
          </div>
          <p style="font-size:0.8rem; color:#94A3B8; margin:6px 0;">Registra los estadios y canchas donde se disputarán los partidos oficializados de la temporada.</p>
          ${isAuth ? `<button class="md-btn md-btn-primary" style="font-size:0.75rem; padding:4px 12px;" onclick="App.showCreateStadiumModal()">📍 Registrar Nueva Sede</button>` : ''}
        </div>

        <!-- Paso 3 -->
        <div class="md-card" style="margin-top:10px; border-left:4px solid ${teams.length >= 2 ? '#10B981' : '#F59E0B'};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:0.95rem; color:#FFFFFF;">Paso 3: Registro de Equipos</div>
            <span class="md-chip ${teams.length >= 2 ? 'active' : ''}">${teams.length ? `✅ ${teams.length} Equipos` : '⚠️ Mínimo 2 equipos'}</span>
          </div>
          <p style="font-size:0.8rem; color:#94A3B8; margin:6px 0;">Registra los clubes participantes y asócialos a su categoría y sede correspondiente.</p>
          ${isAuth ? `<button class="md-btn md-btn-primary" style="font-size:0.75rem; padding:4px 12px;" onclick="App.showCreateTeamModal()">🛡️ Registrar Equipo</button>` : ''}
        </div>

        <!-- Paso 4 -->
        <div class="md-card" style="margin-top:10px; border-left:4px solid ${players.length >= 14 ? '#10B981' : '#F59E0B'};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:0.95rem; color:#FFFFFF;">Paso 4: Jugadores y Cuerpo Técnico</div>
            <span class="md-chip ${players.length >= 14 ? 'active' : ''}">${players.length ? `✅ ${players.length} Integrantes` : '⚠️ 7-9 jugadores por equipo'}</span>
          </div>
          <p style="font-size:0.8rem; color:#94A3B8; margin:6px 0;">Carga los planteles (jugadores activos, managers y cuerpo técnico). Se exigen al menos 7 a 9 jugadores por equipo.</p>
          ${teams.length ? `<button class="md-btn md-btn-outlined" style="font-size:0.75rem; padding:4px 12px;" onclick="App.showView('teams')">👥 Ver Equipos para Cargar Plantel</button>` : ''}
        </div>

        <!-- Paso 5 -->
        <div class="md-card" style="margin-top:10px; border-left:4px solid ${games.length ? '#10B981' : '#F59E0B'};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:0.95rem; color:#FFFFFF;">Paso 5: Programación de Partidos</div>
            <span class="md-chip ${games.length ? 'active' : ''}">${games.length ? `✅ ${games.length} Partidos` : '⚠️ Pendiente'}</span>
          </div>
          <p style="font-size:0.8rem; color:#94A3B8; margin:6px 0;">Programa los juegos fijando la sede, horario y contendientes.</p>
          ${isAuth ? `<button class="md-btn md-btn-gold" style="font-size:0.75rem; padding:4px 12px;" onclick="App.showCreateGameModal()">➕ Programar Partido</button>` : ''}
        </div>

        <!-- Paso 6 -->
        <div class="md-card" style="margin-top:10px; border-left:4px solid #3B82F6;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:0.95rem; color:#FFFFFF;">Paso 6: Anotación en Vivo o Carga Directa</div>
            <span class="md-chip active">📊 Sistema Preparado</span>
          </div>
          <p style="font-size:0.8rem; color:#94A3B8; margin:6px 0;">Anota jugada por jugada en tiempo real o ingresa resultados y planillas una vez finalizados los encuentros.</p>
          <button class="md-btn md-btn-outlined" style="font-size:0.75rem; padding:4px 12px;" onclick="App.showView('calendar')">📅 Ir al Calendario</button>
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  // 1. RICH HOME LANDING VIEW (CLEAN REAL DATA MODE)
  async renderHomeView(container) {
    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando Liga Metropolitana...</div></div>`;

    try {
      const safeFetch = async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return {};
          return await res.json();
        } catch (e) {
          return {};
        }
      };

      const [dataGames, dataBatLeaders, dataPitchLeaders, dataStandings, dataStadia, dataChamps] = await Promise.all([
        safeFetch(`api/games.php?action=list&category_id=${this.currentCategory}`),
        safeFetch(`api/leaderboards.php?type=batting&stat=avg&category_id=${this.currentCategory}&limit=3`),
        safeFetch(`api/leaderboards.php?type=pitching&stat=era&category_id=${this.currentCategory}&limit=3`),
        safeFetch(`api/teams.php?action=standings&category_id=${this.currentCategory}`),
        safeFetch(`api/leagues.php?action=stadiums`),
        safeFetch(`api/leagues.php?action=champions`)
      ]);

      const games = dataGames.games || [];
      const batLeaders = dataBatLeaders.leaders || [];
      const pitchLeaders = dataPitchLeaders.leaders || [];
      const standings = dataStandings.standings || [];
      const stadia = dataStadia.stadiums || [];
      const champions = dataChamps.champions || [];

      this.renderScorebugCarousel(games);

      let html = `
        <div class="view-content">
          <!-- Hero Header -->
          <div class="md-card" style="background: linear-gradient(135deg, #070D1B 0%, #1E3A8A 100%); text-align:center;">
            <div style="font-size:0.75rem; font-weight:700; color:#F59E0B; text-transform:uppercase; letter-spacing:1px;">LIGA METROPOLITANA DE BÉISBOL</div>
            <h2 style="font-size:1.4rem; font-weight:800; color:#FFFFFF; margin:4px 0;" class="text-truncate">${this.settings.site_name || 'Buenos Aires'}</h2>
            <p style="font-size:0.8rem; color:#94A3B8;">Estadísticas oficiales, calendario de partidos, tablas de posiciones y anotación en vivo.</p>

            ${!this.currentUser ? `
              <div style="margin-top:10px;">
                <button class="md-btn md-btn-gold" style="font-size:0.8rem; padding:6px 16px;" onclick="App.openAuthModal('register')">📝 Registrarse</button>
              </div>
            ` : ''}
          </div>

          ${champions.length ? `
            <!-- Section: Reigning Champions -->
            <div class="view-section" style="margin-top:12px;">
              <div class="section-header">
                <h3 class="section-title"><span class="material-icons-round" style="color:#F59E0B;">workspace_premium</span> Campeones Vigentes LMB</h3>
              </div>
              <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:6px;">
                ${champions.map(c => `
                  <div class="md-card" style="min-width:210px; padding:12px; background:linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border:1px solid #F59E0B40; border-radius:10px;">
                    <div style="font-size:0.68rem; font-weight:800; color:#F59E0B; text-transform:uppercase;">🏆 ${c.category_name} (${c.season_name})</div>
                    <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
                      <img src="${c.team_logo || 'assets/images/lmb_logo.png'}" style="width:28px; height:28px; object-fit:contain;" onerror="this.src='assets/images/lmb_logo.png'">
                      <div style="font-size:0.9rem; font-weight:800; color:#F8FAFC;" class="text-truncate">${c.team_name}</div>
                    </div>
                    <div style="font-size:0.7rem; color:#94A3B8; margin-top:4px;">👑 ${c.title_name || 'Campeón Oficial'}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Section: Live / Simultaneous Matches -->
          <div class="view-section">
            <div class="section-header">
              <h3 class="section-title"><span class="material-icons-round" style="color:#EF4444;">sports_baseball</span> Partidos en Vivo / Recientes</h3>
              <button class="md-btn md-btn-outlined" style="padding:4px 12px; font-size:0.75rem;" onclick="App.showView('calendar')">Ver Calendario</button>
            </div>

            ${games.length ? games.slice(0, 3).map(g => `
              <div class="md-card md-card-interactive" onclick="App.showView('game_detail', ${g.id})">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#94A3B8;">
                  <span class="text-truncate">${g.category_name} • 📍 ${g.stadium_name ? g.stadium_name + ' (' + (g.stadium_field || 'Cancha Principal') + ')' : g.field_location}</span>
                  ${App.getStatusBadge(g.status)}
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                  <div style="display:flex; align-items:center; gap:8px;" class="text-truncate">
                    <img src="${g.away_logo || 'assets/images/lmb_logo.png'}" style="width:32px; height:32px; border-radius:50%;">
                    <div style="font-weight:700; font-size:0.95rem;" class="text-truncate">${g.away_team_name}</div>
                  </div>
                  <div style="font-size:1.3rem; font-weight:800; color:#F59E0B;">${['scheduled', 'delayed', 'awaiting_data'].includes(g.status) && g.away_score === 0 && g.home_score === 0 ? '-' : g.away_score}</div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="display:flex; align-items:center; gap:8px;" class="text-truncate">
                    <img src="${g.home_logo || 'assets/images/lmb_logo.png'}" style="width:32px; height:32px; border-radius:50%;">
                    <div style="font-weight:700; font-size:0.95rem;" class="text-truncate">${g.home_team_name}</div>
                  </div>
                  <div style="font-size:1.3rem; font-weight:800; color:#F59E0B;">${['scheduled', 'delayed', 'awaiting_data'].includes(g.status) && g.away_score === 0 && g.home_score === 0 ? '-' : g.home_score}</div>
                </div>
              </div>
            `).join('') : `
              <div class="md-card" style="text-align:center; padding:24px;">
                <span class="material-icons-round" style="font-size:36px; color:#3B82F6;">event_available</span>
                <div style="font-weight:700; font-size:0.95rem; margin-top:6px;">No hay partidos programados aún</div>
                <div style="font-size:0.8rem; color:#94A3B8;">Los nuevos partidos aparecerán aquí en tiempo real una vez creados en el calendario.</div>
              </div>
            `}
          </div>

          <!-- Section: Standings Table (Tabla de Posiciones) -->
          <div class="view-section">
            <div class="section-header">
              <h3 class="section-title"><span class="material-icons-round" style="color:#F59E0B;">format_list_numbered</span> Tabla de Posiciones</h3>
            </div>

            <div class="md-table-wrapper">
              <table class="md-table" style="text-align:center;">
                <thead>
                  <tr>
                    <th style="text-align:left;">Equipo</th>
                    <th>PJ</th>
                    <th>PG</th>
                    <th>PP</th>
                    <th>PCT</th>
                    <th>DIF</th>
                    <th class="highlight-val">CF</th>
                    <th>CC</th>
                  </tr>
                </thead>
                <tbody>
                  ${standings.length ? standings.map((s, idx) => `
                    <tr onclick="App.showView('team_detail', ${s.team_id})" style="cursor:pointer;">
                      <td style="text-align:left; font-weight:700; display:flex; align-items:center; gap:6px;" class="text-truncate">
                        <span style="color:#94A3B8; font-size:0.75rem;">${idx + 1}</span>
                        <img src="${s.logo_url || 'assets/images/lmb_logo.png'}" style="width:20px; height:20px; border-radius:50%;">
                        <span class="text-truncate">${s.short_name}</span>
                      </td>
                      <td>${s.gp}</td>
                      <td style="color:#10B981; font-weight:700;">${s.wins}</td>
                      <td style="color:#EF4444; font-weight:700;">${s.losses}</td>
                      <td class="highlight-val">${s.pct}</td>
                      <td style="font-size:0.75rem; color:#94A3B8;">${s.gb}</td>
                      <td>${s.cf}</td>
                      <td>${s.cc}</td>
                    </tr>
                  `).join('') : '<tr><td colspan="8" style="text-align:center; padding:16px;">Sin equipos registrados en la tabla de posiciones.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Section: Leaders Showcase (Bateo y Pitcheo) -->
          <div class="view-section">
            <div class="section-header">
              <h3 class="section-title"><span class="material-icons-round" style="color:#F59E0B;">military_tech</span> Líderes de la Liga</h3>
              <button class="md-btn md-btn-outlined" style="padding:4px 12px; font-size:0.75rem;" onclick="App.showView('leaders')">Ver Todos</button>
            </div>

            <!-- Bateo Top 3 -->
            <div class="md-card">
              <div style="font-weight:800; font-size:0.85rem; color:#F59E0B; text-transform:uppercase;">🥇 Top Bateadores (AVG)</div>
              <div class="md-table-wrapper" style="border:none;">
                <table class="md-table">
                  <tbody>
                    ${batLeaders.length ? batLeaders.map((p, idx) => `
                      <tr onclick="App.showView('player_detail', ${p.player_id})" style="cursor:pointer;">
                        <td style="font-weight:800; color:#F59E0B;">#${idx + 1}</td>
                        <td style="font-weight:700;" class="text-truncate">#${p.jersey_number} ${p.first_name} ${p.last_name}</td>
                        <td><span class="md-chip" style="padding:2px 6px; font-size:0.65rem;">${p.team_short}</span></td>
                        <td class="highlight-val">${p.avg}</td>
                      </tr>
                    `).join('') : '<tr><td colspan="4" style="text-align:center; padding:8px;">Sin estadísticas registradas.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Pitcheo Top 3 -->
            <div class="md-card">
              <div style="font-weight:800; font-size:0.85rem; color:#3B82F6; text-transform:uppercase;">⚾ Top Lanzadores / Pitchers (ERA)</div>
              <div class="md-table-wrapper" style="border:none;">
                <table class="md-table">
                  <tbody>
                    ${pitchLeaders.length ? pitchLeaders.map((p, idx) => `
                      <tr onclick="App.showView('player_detail', ${p.player_id})" style="cursor:pointer;">
                        <td style="font-weight:800; color:#3B82F6;">#${idx + 1}</td>
                        <td style="font-weight:700;" class="text-truncate">#${p.jersey_number} ${p.first_name} ${p.last_name}</td>
                        <td><span class="md-chip" style="padding:2px 6px; font-size:0.65rem;">${p.team_short}</span></td>
                        <td class="highlight-val">${p.era} ERA</td>
                      </tr>
                    `).join('') : '<tr><td colspan="4" style="text-align:center; padding:8px;">Sin estadísticas de pitcheo registradas.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Section: Sedes & Stadium Venues Overview -->
          <div class="view-section">
            <div class="section-header">
              <h3 class="section-title"><span class="material-icons-round" style="color:#3B82F6;">stadium</span> Sedes Deportivas Activas</h3>
            </div>

            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px;">
              ${stadia.length ? stadia.map(st => `
                <div class="md-card" style="padding:12px; font-size:0.8rem;">
                  <div style="font-weight:800; color:#FFFFFF;" class="text-truncate">📍 ${st.name}</div>
                  <div style="color:#F59E0B; font-weight:700; font-size:0.75rem; margin-top:2px;" class="text-truncate">${st.field_name || 'Campo Principal'}</div>
                  <div style="color:#94A3B8; font-size:0.7rem; margin-top:4px;" class="text-truncate">${st.city} • ${st.address}</div>
                </div>
              `).join('') : '<div style="grid-column:span 2; font-size:0.85rem; color:#94A3B8; padding:12px; text-align:center;">Sin sedes registradas. El administrador puede agregarlas en el panel.</div>'}
            </div>
          </div>
        </div>
      `;
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = `<div class="view-content">Error al cargar la página de inicio.</div>`;
    }
  },

  getStatusBadge(status) {
    switch (status) {
      case 'scheduled':
        return `<span class="md-badge badge-scheduled">📅 Programado</span>`;
      case 'live':
        return `<span class="md-badge badge-live">🔴 EN VIVO</span>`;
      case 'delayed':
        return `<span class="md-badge badge-delayed">⏳ Retrasado</span>`;
      case 'awaiting_data':
        return `<span class="md-badge badge-awaiting">📝 Esperando datos</span>`;
      case 'finished':
        return `<span class="md-badge badge-finished">🏁 Finalizado</span>`;
      case 'cancelled':
        return `<span class="md-badge badge-cancelled">❌ Cancelado</span>`;
      default:
        return `<span class="md-badge badge-scheduled">${(status || 'programado').toUpperCase()}</span>`;
    }
  },

  renderScorebugCarousel(games) {
    const scorebug = document.getElementById('scorebug-carousel');
    if (!scorebug) return;

    if (!games || !games.length) {
      scorebug.innerHTML = `<div style="padding:4px 12px; font-size:0.75rem; color:#94A3B8;">Liga Metropolitana de Béisbol - Buenos Aires</div>`;
      return;
    }

    scorebug.innerHTML = games.map(g => `
      <div class="scorebug-card ${g.status === 'live' ? 'live' : ''}" onclick="App.showView('game_detail', ${g.id})">
        <div class="scorebug-status">
          <span class="text-truncate">${g.category_code} • ${g.stadium_field || 'Cancha 1'}</span>
          ${App.getStatusBadge(g.status)}
        </div>
        <div class="scorebug-team-row">
          <div class="scorebug-team-name text-truncate">
            <img src="${g.away_logo || 'assets/images/lmb_logo.png'}" class="scorebug-logo">
            <span class="text-truncate">${g.away_short}</span>
          </div>
          <div class="scorebug-score">${['scheduled', 'delayed', 'awaiting_data'].includes(g.status) && g.away_score === 0 && g.home_score === 0 ? '-' : g.away_score}</div>
        </div>
        <div class="scorebug-team-row">
          <div class="scorebug-team-name text-truncate">
            <img src="${g.home_logo || 'assets/images/lmb_logo.png'}" class="scorebug-logo">
            <span class="text-truncate">${g.home_short}</span>
          </div>
          <div class="scorebug-score">${['scheduled', 'delayed', 'awaiting_data'].includes(g.status) && g.away_score === 0 && g.home_score === 0 ? '-' : g.home_score}</div>
        </div>
      </div>
    `).join('');
  },

  // 2. CALENDAR & SCHEDULE VIEW
  async renderCalendarView(container) {
    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando calendario...</div></div>`;

    const res = await fetch(`api/games.php?action=list&category_id=${this.currentCategory}`);
    const data = await res.json();
    const games = data.games || [];
    const canEdit = (this.currentUser && ['super_admin', 'admin', 'scorekeeper', 'team_admin'].includes(this.currentUser.role));

    let html = `
      <div class="view-content">
        <div class="section-header">
          <h2 class="section-title"><span class="material-icons-round" style="color:#3B82F6;">calendar_month</span> Calendario de Partidos</h2>
          ${canEdit ? 
            `<button class="md-btn md-btn-primary" style="padding:6px 14px; font-size:0.8rem;" onclick="App.showCreateGameModal()">➕ Programar Partido</button>` : ''}
        </div>

        ${games.length ? games.map(g => `
          <div class="md-card md-card-interactive">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#94A3B8;">
              <div style="display:flex; gap:6px; align-items:center;" class="text-truncate">
                <span class="md-chip" style="font-size:0.65rem; background:rgba(245, 158, 11, 0.15); color:#F59E0B; border:none; padding:1px 6px;">⚾ ${g.game_stage || 'Temporada Regular'}</span>
                <span class="text-truncate">${g.category_name} • ${new Date(g.game_date).toLocaleDateString('es-AR')}</span>
              </div>
              ${App.getStatusBadge(g.status)}
            </div>

            <div style="display:flex; justify-content:space-around; align-items:center; margin:12px 0;" onclick="App.showView('game_detail', ${g.id})">
              <div style="text-align:center;" class="text-truncate">
                <img src="${g.away_logo || 'assets/images/lmb_logo.png'}" style="width:40px; height:40px; border-radius:50%;">
                <div style="font-weight:800; font-size:1rem; margin-top:4px;" class="text-truncate">${g.away_team_name}</div>
                <div style="font-size:1.6rem; font-weight:800; color:#F59E0B;">${['scheduled', 'delayed', 'awaiting_data'].includes(g.status) && g.away_score === 0 && g.home_score === 0 ? '-' : g.away_score}</div>
              </div>
              <div style="font-size:1.1rem; font-weight:800; color:#64748B;">VS</div>
              <div style="text-align:center;" class="text-truncate">
                <img src="${g.home_logo || 'assets/images/lmb_logo.png'}" style="width:40px; height:40px; border-radius:50%;">
                <div style="font-weight:800; font-size:1rem; margin-top:4px;" class="text-truncate">${g.home_team_name}</div>
                <div style="font-size:1.6rem; font-weight:800; color:#F59E0B;">${['scheduled', 'delayed', 'awaiting_data'].includes(g.status) && g.away_score === 0 && g.home_score === 0 ? '-' : g.home_score}</div>
              </div>
            </div>

            <div style="font-size:0.75rem; color:#94A3B8; text-align:center;" class="text-truncate">📍 Sede: ${g.stadium_name ? g.stadium_name + ' (' + (g.stadium_field || 'Cancha Principal') + ')' : g.field_location}</div>

            ${canEdit ? `
              <div style="display:flex; gap:6px; margin-top:10px; border-top:1px solid rgba(255,255,255,0.08); padding-top:8px;">
                <button class="md-btn md-btn-outlined" style="flex:1; padding:4px 8px; font-size:0.72rem;" onclick="event.stopPropagation(); App.openGameResultModal(${JSON.stringify(g).replace(/"/g, '&quot;')})">✏️ Cargar Resultado / Estado</button>
                <button class="md-btn md-btn-outlined" style="flex:1; padding:4px 8px; font-size:0.72rem;" onclick="event.stopPropagation(); App.openManualStatsModal(${JSON.stringify(g).replace(/"/g, '&quot;')})">🧢 Estadísticas Jugadores</button>
              </div>
            ` : ''}
          </div>
        `).join('') : `
          <div class="md-card" style="text-align:center; padding:24px;">
            <div style="font-weight:700; font-size:0.95rem;">No hay partidos programados en esta categoría</div>
          </div>
        `}
      </div>
    `;
    container.innerHTML = html;
  },

  // 3. GAME DETAIL VIEW
  async renderGameDetailView(container, gameId) {
    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando resumen del partido...</div></div>`;

    const res = await fetch(`api/games.php?action=detail&id=${gameId}`);
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<div class="view-content">Partido no encontrado.</div>`;
      return;
    }

    const g = data.game;
    const lines = data.line_scores;
    const hBat = data.home_batters || [];
    const aBat = data.away_batters || [];
    const pbp = data.play_by_play || [];
    const photos = data.photos || [];

    const canEdit = (this.currentUser && ['super_admin', 'admin', 'scorekeeper', 'team_admin'].includes(this.currentUser.role));

    let html = `
      <div class="view-content">
        <!-- Match Header Box -->
        <div class="md-card" style="background: linear-gradient(135deg, #070D1B 0%, #1E3A8A 100%); text-align:center;">
          <div style="font-size:0.75rem; color:#F59E0B; font-weight:700;" class="text-truncate">🏆 ${g.game_stage || 'Temporada Regular'} • ${g.category_name} • 📍 ${g.stadium_name ? g.stadium_name + ' (' + (g.stadium_field || 'Cancha Principal') + ')' : g.field_location}</div>

          <div style="display:flex; justify-content:space-around; align-items:center; margin:16px 0;">
            <div style="text-align:center;" onclick="App.showView('team_detail', ${g.away_team_id})">
              <img src="${g.away_logo || 'assets/images/lmb_logo.png'}" style="width:50px; height:50px; border-radius:50%;">
              <div style="font-weight:800; font-size:1.1rem; margin-top:4px;">${g.away_short}</div>
              <div style="font-size:2.2rem; font-weight:800; color:#FFFFFF;">${g.away_score}</div>
            </div>

            <div>
              ${App.getStatusBadge(g.status)}
            </div>

            <div style="text-align:center;" onclick="App.showView('team_detail', ${g.home_team_id})">
              <img src="${g.home_logo || 'assets/images/lmb_logo.png'}" style="width:50px; height:50px; border-radius:50%;">
              <div style="font-weight:800; font-size:1.1rem; margin-top:4px;">${g.home_short}</div>
              <div style="font-size:2.2rem; font-weight:800; color:#FFFFFF;">${g.home_score}</div>
            </div>
          </div>

          ${g.recap_notes ? `
            <div style="background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; font-size:0.8rem; color:#94A3B8; margin-bottom:8px;" class="text-wrap-safe">
              📝 ${g.recap_notes}
            </div>
          ` : ''}

          ${canEdit ? `
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
              <div style="display:flex; gap:6px;">
                <button class="md-btn md-btn-outlined" style="flex:1; font-size:0.75rem;" onclick="App.openGameResultModal(${JSON.stringify(g).replace(/"/g, '&quot;')})">
                  ✏️ Editar Resultado y Estado
                </button>
                <button class="md-btn md-btn-outlined" style="flex:1; font-size:0.75rem;" onclick="App.openManualStatsModal(${JSON.stringify(g).replace(/"/g, '&quot;')})">
                  🧢 Cargar Stats Jugadores
                </button>
              </div>
              <button class="md-btn md-btn-gold" style="width:100%; font-size:0.8rem;" onclick="LiveScorer.init(${JSON.stringify(data).replace(/"/g, '&quot;')})">
                ⚾ Abrir Anotador en Vivo (Jugada por Jugada)
              </button>
            </div>
          ` : ''}
        </div>


        <!-- Inning Line Score Table -->
        <div class="view-section">
          <h3 class="section-title">Anotación por Entradas (Line Score)</h3>
          <div class="md-table-wrapper">
            <table class="md-table" style="text-align:center;">
              <thead>
                <tr>
                  <th style="text-align:left;">Equipo</th>
                  <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th>
                  <th class="highlight-val">C</th><th>H</th><th>E</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="text-align:left; font-weight:800;">${g.away_short}</td>
                  ${[1,2,3,4,5,6,7,8,9].map(i => `<td>${lines.away[i] !== undefined ? lines.away[i] : '-'}</td>`).join('')}
                  <td class="highlight-val">${g.away_score}</td>
                  <td>${g.away_hits}</td>
                  <td>${g.away_errors}</td>
                </tr>
                <tr>
                  <td style="text-align:left; font-weight:800;">${g.home_short}</td>
                  ${[1,2,3,4,5,6,7,8,9].map(i => `<td>${lines.home[i] !== undefined ? lines.home[i] : '-'}</td>`).join('')}
                  <td class="highlight-val">${g.home_score}</td>
                  <td>${g.home_hits}</td>
                  <td>${g.home_errors}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Batting Box Score -->
        <div class="view-section">
          <h3 class="section-title">Estadísticas de Bateo</h3>
          <div style="font-weight:700; color:#F59E0B; margin-bottom:4px;" class="text-truncate">Visitante: ${g.away_team_name}</div>
          <div class="md-table-wrapper">
            <table class="md-table">
              <thead>
                <tr><th>Bateador</th><th>AB</th><th>C</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>CI</th><th>BB</th><th>SO</th></tr>
              </thead>
              <tbody>
                ${aBat.length ? aBat.map(b => `
                  <tr onclick="App.showView('player_detail', ${b.player_id})" style="cursor:pointer;">
                    <td style="font-weight:700;" class="text-truncate">#${b.jersey_number} ${b.first_name} ${b.last_name} (${b.position})</td>
                    <td>${b.ab}</td><td>${b.r}</td><td class="highlight-val">${b.h}</td>
                    <td>${b.doubles}</td><td>${b.triples}</td><td>${b.hr}</td><td>${b.rbi}</td><td>${b.bb}</td><td>${b.so}</td>
                  </tr>
                `).join('') : '<tr><td colspan="10" style="text-align:center; padding:12px;">Sin turnos al bate registrados.</td></tr>'}
              </tbody>
            </table>
          </div>

          <div style="font-weight:700; color:#F59E0B; margin-top:12px; margin-bottom:4px;" class="text-truncate">Local: ${g.home_team_name}</div>
          <div class="md-table-wrapper">
            <table class="md-table">
              <thead>
                <tr><th>Bateador</th><th>AB</th><th>C</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>CI</th><th>BB</th><th>SO</th></tr>
              </thead>
              <tbody>
                ${hBat.length ? hBat.map(b => `
                  <tr onclick="App.showView('player_detail', ${b.player_id})" style="cursor:pointer;">
                    <td style="font-weight:700;" class="text-truncate">#${b.jersey_number} ${b.first_name} ${b.last_name} (${b.position})</td>
                    <td>${b.ab}</td><td>${b.r}</td><td class="highlight-val">${b.h}</td>
                    <td>${b.doubles}</td><td>${b.triples}</td><td>${b.hr}</td><td>${b.rbi}</td><td>${b.bb}</td><td>${b.so}</td>
                  </tr>
                `).join('') : '<tr><td colspan="10" style="text-align:center; padding:12px;">Sin turnos al bate registrados.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Play by Play Log -->
        <div class="view-section">
          <h3 class="section-title">Registro Jugada a Jugada</h3>
          <div class="md-card">
            ${pbp.length ? pbp.map(p => `
              <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding:8px 0;">
                <div style="font-size:0.75rem; font-weight:700; color:#F59E0B;">
                  ${p.half_inning === 'top' ? '▲' : '▼'} Inning ${p.inning} • Outs: ${p.outs_before}
                </div>
                <div style="font-size:0.9rem; font-weight:600; color:#FFFFFF; margin-top:2px;">
                  ${p.description}
                </div>
              </div>
            `).join('') : '<div style="font-size:0.85rem; color:#94A3B8;">No hay jugadas registradas en el historial.</div>'}
          </div>
        </div>

        <!-- Postcards Gallery -->
        <div class="view-section">
          <div class="section-header">
            <h3 class="section-title">📸 Postales del Partido (${photos.length}/10)</h3>
            ${(canEdit && photos.length < 10) ? 
              `<button class="md-btn md-btn-outlined" style="padding:4px 12px; font-size:0.75rem;" onclick="App.showUploadPhotoModal(${g.id})">📷 Subir Foto</button>` : ''}
          </div>

          <div class="photo-gallery-grid">
            ${photos.length ? photos.map(p => `
              <img src="${p.image_url}" class="photo-gallery-item" alt="${p.caption}">
            `).join('') : '<div style="grid-column: span 3; font-size:0.85rem; color:#94A3B8;">Sin fotografías aún de este partido.</div>'}
          </div>
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  // 4. TEAMS VIEW
  async renderTeamsView(container) {
    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando equipos...</div></div>`;

    const res = await fetch(`api/teams.php?action=list&category_id=${this.currentCategory}`);
    const data = await res.json();
    const teams = data.teams || [];

    const canCreate = (this.currentUser && ['super_admin', 'admin'].includes(this.currentUser.role));

    let html = `
      <div class="view-content">
        <div class="section-header">
          <h2 class="section-title"><span class="material-icons-round" style="color:#F59E0B;">groups</span> Equipos de la Liga</h2>
          ${canCreate ? `<button class="md-btn md-btn-primary" style="padding:6px 14px; font-size:0.8rem;" onclick="App.showCreateTeamModal()">➕ Crear Equipo</button>` : ''}
        </div>

        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">
          ${teams.length ? teams.map(t => `
            <div class="md-card md-card-interactive" onclick="App.showView('team_detail', ${t.id})" style="text-align:center; align-items:center;">
              <img src="${t.logo_url || 'assets/images/lmb_logo.png'}" style="width:60px; height:60px; border-radius:50%; border:2px solid ${t.color_primary};">
              <div style="font-weight:800; font-size:0.95rem; margin-top:4px;" class="text-truncate">${t.name}</div>
              <span class="md-chip" style="padding:2px 8px; font-size:0.65rem;">${t.category_name}</span>
              <div style="font-size:0.7rem; color:#94A3B8; margin-top:4px;" class="text-truncate">📍 Sede: ${t.home_stadium_name || 'Neutral'}</div>
            </div>
          `).join('') : '<div style="grid-column:span 2; text-align:center; padding:24px; color:#94A3B8;">No hay equipos registrados en esta categoría.</div>'}
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  // 5. TEAM DETAIL VIEW
  async renderTeamDetailView(container, teamId) {
    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando plantel del equipo...</div></div>`;

    const res = await fetch(`api/teams.php?action=detail&id=${teamId}`);
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<div class="view-content">Equipo no encontrado.</div>`;
      return;
    }

    const t = data.team;
    const allMembers = data.players || [];
    const stats = t.stats || {};

    const activePlayers = allMembers.filter(p => !p.role_type || p.role_type === 'player');
    const coachingStaff = allMembers.filter(p => p.role_type && p.role_type !== 'player');

    const roleLabels = {
      'manager': '🧢 Mánager Principal',
      'pitching_coach': '⚾ Coach de Pitcheo',
      'batting_coach': '🏏 Coach de Bateo',
      'delegado': '📋 Delegado de Club'
    };

    const isAuthorizedForTeam = (this.currentUser && (
      ['super_admin', 'admin'].includes(this.currentUser.role) ||
      (this.currentUser.role === 'team_admin' && this.currentUser.assigned_team_id == t.id)
    ));

    let html = `
      <div class="view-content">
        <div class="md-card" style="background: linear-gradient(135deg, ${t.color_primary} 0%, #070D1B 100%); text-align:center; align-items:center;">
          <img src="${t.logo_url || 'assets/images/lmb_logo.png'}" style="width:74px; height:74px; border-radius:50%; border:3px solid #F59E0B; object-fit:cover;">
          <h2 style="font-size:1.4rem; font-weight:800; color:#FFFFFF; margin-top:6px;" class="text-truncate">${t.name}</h2>
          <span class="md-chip active">${t.category_name} • Sede: ${t.home_stadium_name || 'Sin Sede Fija'}</span>

          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; justify-content:center;">
            ${isAuthorizedForTeam ? `
              <button class="md-btn md-btn-outlined" style="padding:4px 10px; font-size:0.75rem;" onclick="App.showFileUploadModal('logo', ${t.id}, 'Subir Logo de ${t.name}')">📷 Logo</button>
            ` : ''}
            <button class="md-btn md-btn-gold" style="padding:4px 10px; font-size:0.75rem;" onclick="App.showEntityGalleryModal('team', ${t.id}, 'Galería de ${t.name}')">🖼️ Galería (Postales)</button>
          </div>

          <div style="display:flex; justify-content:space-around; width:100%; margin-top:16px; border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;">
            <div><div style="font-size:0.75rem; color:#94A3B8;">PJ</div><div style="font-size:1.2rem; font-weight:800;">${stats.games_played}</div></div>
            <div><div style="font-size:0.75rem; color:#94A3B8;">PG</div><div style="font-size:1.2rem; font-weight:800; color:#10B981;">${stats.wins}</div></div>
            <div><div style="font-size:0.75rem; color:#94A3B8;">PP</div><div style="font-size:1.2rem; font-weight:800; color:#EF4444;">${stats.losses}</div></div>
            <div><div style="font-size:0.75rem; color:#94A3B8;">PCT</div><div style="font-size:1.2rem; font-weight:800; color:#F59E0B;">${stats.pct}</div></div>
          </div>
        </div>

        <!-- Cuerpo Técnico -->
        ${coachingStaff.length ? `
          <div class="view-section" style="margin-top:14px;">
            <h3 class="section-title"><span class="material-icons-round" style="color:#F59E0B;">engineering</span> Cuerpo Técnico y Dirección</h3>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:10px; margin-top:8px;">
              ${coachingStaff.map(c => `
                <div class="md-card" style="padding:8px; text-align:center;">
                  <div style="font-size:0.75rem; color:#F59E0B; font-weight:800;">${roleLabels[c.role_type] || c.role_type}</div>
                  <div style="font-weight:700; font-size:0.85rem; color:#FFF;" class="text-truncate">${c.first_name} ${c.last_name}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Plantel Activo -->
        <div class="view-section" style="margin-top:14px;">
          <div class="section-header">
            <h3 class="section-title">Jugadores Activos (${activePlayers.length})</h3>
            ${isAuthorizedForTeam ? `
              <button class="md-btn md-btn-primary" style="padding:4px 12px; font-size:0.75rem;" onclick="App.showCreatePlayerModal(${t.id})">➕ Agregar Integrante</button>
            ` : ''}
          </div>

          <div class="md-table-wrapper">
            <table class="md-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>Posición</th>
                  <th>Batea/Lanza</th>
                  ${isAuthorizedForTeam ? `<th>Acciones</th>` : ''}
                </tr>
              </thead>
              <tbody>
                ${activePlayers.length ? activePlayers.map(p => `
                  <tr>
                    <td style="font-weight:800; color:#F59E0B; cursor:pointer;" onclick="App.showView('player_detail', ${p.id})">#${p.jersey_number}</td>
                    <td style="font-weight:700; cursor:pointer;" class="text-truncate" onclick="App.showView('player_detail', ${p.id})">${p.first_name} ${p.last_name}</td>
                    <td><span class="md-chip" style="padding:2px 6px; font-size:0.65rem;">${p.position_primary}</span></td>
                    <td style="font-size:0.8rem; color:#94A3B8;">B: ${p.bats} / L: ${p.throws}</td>
                    ${isAuthorizedForTeam ? `
                      <td>
                        <div style="display:flex; gap:4px;">
                          <button class="md-btn md-btn-outlined" style="padding:2px 6px; font-size:0.7rem;" onclick="App.showEditPlayerModal(${p.id}, '${p.first_name}', '${p.last_name}', ${p.jersey_number}, '${p.position_primary}')">✏️ Editar</button>
                          <button class="md-btn md-btn-danger" style="padding:2px 6px; font-size:0.7rem;" onclick="App.deletePlayer(${p.id}, '${p.first_name} ${p.last_name}')">🗑️ Baja</button>
                        </div>
                      </td>
                    ` : ''}
                  </tr>
                `).join('') : `<tr><td colspan="${isAuthorizedForTeam ? 5 : 4}" style="text-align:center; padding:16px;">Sin jugadores activos registrados.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  // 6. PLAYER DETAIL VIEW (Batting & Pitching Stats)
  async renderPlayerDetailView(container, playerId) {
    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando tarjeta del jugador...</div></div>`;

    const res = await fetch(`api/players.php?action=detail&id=${playerId}`);
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<div class="view-content">Jugador no encontrado.</div>`;
      return;
    }

    const p = data.player;
    const b = p.batting_stats || {};
    const pi = p.pitching_stats || {};

    const isAuthorized = (this.currentUser && (
      ['super_admin', 'admin'].includes(this.currentUser.role) ||
      (this.currentUser.role === 'team_admin' && this.currentUser.assigned_team_id == p.team_id)
    ));

    let html = `
      <div class="view-content">
        <div class="md-card" style="background: linear-gradient(135deg, #1E3A8A 0%, #070D1B 100%); text-align:center; align-items:center;">
          <img src="${p.photo_url || 'assets/images/lmb_logo.png'}" style="width:80px; height:80px; border-radius:50%; border:3px solid #F59E0B; object-fit:cover;">
          <div style="font-size:1.6rem; font-weight:800; color:#FFFFFF; margin-top:4px;" class="text-truncate">#${p.jersey_number} ${p.first_name} ${p.last_name}</div>
          <div style="font-size:0.9rem; font-weight:700; color:#F59E0B;" class="text-truncate">${p.team_name} • ${p.category_name}</div>

          <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; justify-content:center;">
            <span class="md-chip active">Pos: ${p.position_primary}</span>
            <span class="md-chip">Batea: ${p.bats === 'R' ? 'Derecho' : (p.bats === 'L' ? 'Zurdo' : 'Ambidextro')}</span>
            <span class="md-chip">Lanza: ${p.throws === 'R' ? 'Derecho' : 'Zurdo'}</span>
          </div>

          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; justify-content:center;">
            ${isAuthorized ? `
              <button class="md-btn md-btn-outlined" style="padding:4px 10px; font-size:0.75rem;" onclick="App.showEditPlayerModal(${p.id}, '${p.first_name}', '${p.last_name}', ${p.jersey_number}, '${p.position_primary}')">✏️ Editar Perfil</button>
              <button class="md-btn md-btn-outlined" style="padding:4px 10px; font-size:0.75rem;" onclick="App.showFileUploadModal('player', ${p.id}, 'Subir Foto de ${p.first_name}')">📷 Cambiar Foto</button>
              <button class="md-btn md-btn-danger" style="padding:4px 10px; font-size:0.75rem;" onclick="App.deletePlayer(${p.id}, '${p.first_name} ${p.last_name}')">🗑️ Dar de Baja</button>
            ` : ''}
            <button class="md-btn md-btn-gold" style="padding:4px 10px; font-size:0.75rem;" onclick="App.showEntityGalleryModal('player', ${p.id}, 'Galería de ${p.first_name}')">🖼️ Galería (Postales)</button>
          </div>
        </div>

        <!-- Batting Stats Table -->
        <div class="view-section">
          <h3 class="section-title"><span class="material-icons-round" style="color:#F59E0B;">sports_baseball</span> Tabla de Estadísticas de Bateo (Ofensiva)</h3>
          <div class="md-table-wrapper">
            <table class="md-table" style="text-align:center; font-size:0.8rem;">
              <thead>
                <tr>
                  <th>JJ</th><th>AB</th><th>C</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>CI</th><th>BB</th><th>SO</th><th>BR</th><th>AVG</th><th>OBP</th><th>SLG</th><th>OPS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${b.gp || 0}</td><td>${b.ab || 0}</td><td>${b.r || 0}</td><td style="font-weight:800; color:#3B82F6;">${b.h || 0}</td>
                  <td>${b.doubles || 0}</td><td>${b.triples || 0}</td><td style="font-weight:800; color:#EF4444;">${b.hr || 0}</td><td style="font-weight:800;">${b.rbi || 0}</td>
                  <td>${b.bb || 0}</td><td>${b.so || 0}</td><td>${b.sb || 0}</td>
                  <td style="font-weight:800; color:#F59E0B;">${b.avg || '.000'}</td><td>${b.obp || '.000'}</td><td>${b.slg || '.000'}</td><td style="font-weight:800; color:#10B981;">${b.ops || '.000'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pitching Stats Table -->
        <div class="view-section" style="margin-top:16px;">
          <h3 class="section-title"><span class="material-icons-round" style="color:#3B82F6;">sports</span> Tabla de Estadísticas de Pitcheo (Lanzador)</h3>
          <div class="md-table-wrapper">
            <table class="md-table" style="text-align:center; font-size:0.8rem;">
              <thead>
                <tr>
                  <th>JJ</th><th>G-P</th><th>SV</th><th>IP</th><th>H</th><th>C</th><th>CL</th><th>BB</th><th>SO</th><th>ERA</th><th>WHIP</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${pi.gp || 0}</td><td>${pi.wins || 0}-${pi.losses || 0}</td><td style="color:#F59E0B; font-weight:800;">${pi.saves || 0}</td>
                  <td style="font-weight:800;">${pi.ip_display || '0.0'}</td><td>${pi.h || 0}</td><td>${pi.r || 0}</td><td>${pi.er || 0}</td>
                  <td>${pi.bb || 0}</td><td style="font-weight:800; color:#EF4444;">${pi.so || 0}</td>
                  <td style="font-weight:800; color:#3B82F6;">${pi.era || '0.00'}</td><td style="font-weight:700;">${pi.whip || '0.00'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  // 7. LEADERS VIEW (Batting & Pitching Departmental Lists)
  async renderLeadersView(container, type = 'batting', stat = 'avg') {
    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando líderes de estadísticas...</div></div>`;

    const res = await fetch(`api/leaderboards.php?type=${type}&stat=${stat}&category_id=${this.currentCategory}`);
    const data = await res.json();
    const leaders = data.leaders || [];

    let html = `
      <div class="view-content">
        <div class="section-header">
          <h2 class="section-title"><span class="material-icons-round" style="color:#F59E0B;">military_tech</span> Líderes Departamentales</h2>
        </div>

        <div class="md-card">
          <!-- Type Toggle Buttons (Bateo vs Pitcheo) -->
          <div style="display:flex; gap:8px;">
            <button class="md-btn ${type === 'batting' ? 'md-btn-primary' : 'md-btn-outlined'}" style="flex:1;" onclick="App.renderLeadersView(document.getElementById('view-container'), 'batting', 'avg')">🥇 Bateo</button>
            <button class="md-btn ${type === 'pitching' ? 'md-btn-primary' : 'md-btn-outlined'}" style="flex:1;" onclick="App.renderLeadersView(document.getElementById('view-container'), 'pitching', 'era')">⚾ Pitcheo</button>
          </div>

          <!-- Department Selector Chips -->
          <div class="form-group" style="margin-top:10px;">
            <label style="font-weight:800; color:#F59E0B;">Seleccionar Departamento:</label>
            <div class="md-chip-group" style="padding:4px 0;">
              ${type === 'batting' ? `
                <button class="md-chip ${stat==='avg'?'active':''}" onclick="App.renderLeadersView(document.getElementById('view-container'), 'batting', 'avg')">Average (AVG)</button>
                <button class="md-chip ${stat==='hr'?'active':''}" onclick="App.renderLeadersView(document.getElementById('view-container'), 'batting', 'hr')">Jonrones (HR)</button>
                <button class="md-chip ${stat==='rbi'?'active':''}" onclick="App.renderLeadersView(document.getElementById('view-container'), 'batting', 'rbi')">Impulsadas (RBI)</button>
                <button class="md-chip ${stat==='h'?'active':''}" onclick="App.renderLeadersView(document.getElementById('view-container'), 'batting', 'h')">Hits (H)</button>
                <button class="md-chip ${stat==='ops'?'active':''}" onclick="App.renderLeadersView(document.getElementById('view-container'), 'batting', 'ops')">OPS</button>
              ` : `
                <button class="md-chip ${stat==='era'?'active':''}" onclick="App.renderLeadersView(document.getElementById('view-container'), 'pitching', 'era')">Efectividad (ERA)</button>
                <button class="md-chip ${stat==='so'?'active':''}" onclick="App.renderLeadersView(document.getElementById('view-container'), 'pitching', 'so')">Ponches (SO)</button>
                <button class="md-chip ${stat==='wins'?'active':''}" onclick="App.renderLeadersView(document.getElementById('view-container'), 'pitching', 'wins')">Victorias (W)</button>
                <button class="md-chip ${stat==='saves'?'active':''}" onclick="App.renderLeadersView(document.getElementById('view-container'), 'pitching', 'saves')">Salvados (SV)</button>
                <button class="md-chip ${stat==='whip'?'active':''}" onclick="App.renderLeadersView(document.getElementById('view-container'), 'pitching', 'whip')">WHIP</button>
              `}
            </div>
          </div>
        </div>

        <div class="md-table-wrapper">
          <table class="md-table">
            <thead>
              <tr>
                <th>Lugar</th>
                <th>Jugador</th>
                <th>Equipo</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              ${leaders.length ? leaders.map((l, idx) => `
                <tr onclick="App.showView('player_detail', ${l.player_id})" style="cursor:pointer;">
                  <td style="font-weight:800; color:${idx === 0 ? '#F59E0B' : '#94A3B8'};">#${idx + 1}</td>
                  <td style="font-weight:700;" class="text-truncate">#${l.jersey_number} ${l.first_name} ${l.last_name}</td>
                  <td><span class="md-chip" style="padding:2px 6px; font-size:0.65rem;">${l.team_short}</span></td>
                  <td class="highlight-val" style="font-size:1rem;">
                    ${type === 'batting' ? (l[stat] || l.avg) : (stat === 'era' ? l.era : (stat === 'so' ? l.so : (stat === 'wins' ? l.wins : (stat === 'saves' ? l.saves : l.whip))))}
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="4" style="text-align:center; padding:16px;">Sin líderes registrados en este departamento.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  // 8. FULL AUTONOMOUS ADMIN SUITE
  async renderAdminView(container) {
    if (!this.currentUser || !['super_admin', 'admin'].includes(this.currentUser.role)) {
      container.innerHTML = `
        <div class="view-content">
          <div class="md-card" style="text-align:center; padding:24px;">
            <span class="material-icons-round" style="font-size:40px; color:#EF4444;">lock</span>
            <div style="font-weight:800; font-size:1.1rem; margin-top:8px;">Acceso Restringido</div>
            <p style="font-size:0.85rem; color:#94A3B8;">Debes iniciar sesión con tu cuenta de usuario o registrarte.</p>
            <button class="md-btn md-btn-gold" style="margin-top:12px;" onclick="App.openAuthModal('register')">📝 Registrarse</button>
          </div>
        </div>
      `;
      return;
    }

    let html = `
      <div class="view-content">
        <div class="section-header">
          <h2 class="section-title"><span class="material-icons-round" style="color:#EF4444;">admin_panel_settings</span> Panel de Control Autónomo</h2>
        </div>

        <!-- Admin Navigation Tabs -->
        <div class="admin-tab-bar">
          <button class="admin-tab-chip ${this.adminTab === 'categories' ? 'active' : ''}" onclick="App.switchAdminTab('categories')">🏆 Ligas y Categorías</button>
          <button class="admin-tab-chip ${this.adminTab === 'stadiums' ? 'active' : ''}" onclick="App.switchAdminTab('stadiums')">📍 Sedes y Campos</button>
          <button class="admin-tab-chip ${this.adminTab === 'teams' ? 'active' : ''}" onclick="App.switchAdminTab('teams')">🛡️ Equipos</button>
          <button class="admin-tab-chip ${this.adminTab === 'unassigned' ? 'active' : ''}" style="${this.adminTab === 'unassigned' ? '' : 'border-color:#F59E0B;'}" onclick="App.switchAdminTab('unassigned')">⚠️ Sin Asignación</button>
          <button class="admin-tab-chip ${this.adminTab === 'stages' ? 'active' : ''}" onclick="App.switchAdminTab('stages')">⚾ Etapas / Tipos</button>
          <button class="admin-tab-chip ${this.adminTab === 'audit' ? 'active' : ''}" onclick="App.switchAdminTab('audit')">📜 Auditoría</button>
          <button class="admin-tab-chip ${this.adminTab === 'users' ? 'active' : ''}" onclick="App.switchAdminTab('users')">👥 Usuarios y Roles</button>
          <button class="admin-tab-chip ${this.adminTab === 'branding' ? 'active' : ''}" onclick="App.switchAdminTab('branding')">🎨 Branding Web</button>
        </div>

        <div id="admin-tab-content">
          <!-- Dynamic Tab Content Rendered Below -->
        </div>
      </div>
    `;
    container.innerHTML = html;
    this.renderAdminTabContent(document.getElementById('admin-tab-content'));
  },

  switchAdminTab(tabName) {
    this.adminTab = tabName;
    this.renderAdminView(document.getElementById('view-container'));
  },

  async renderAdminTabContent(tabContainer) {
    if (!tabContainer) return;

    if (this.adminTab === 'categories') {
      tabContainer.innerHTML = `
        <div class="md-card">
          <div class="md-card-header">
            <h3 style="font-size:1rem; font-weight:800;">Temporadas y Divisiones</h3>
            <div class="md-card-header-actions">
              <button class="md-btn md-btn-gold" style="padding:4px 10px; font-size:0.75rem;" onclick="App.runSeedDemo()">⚡ Cargar Demo LMB</button>
              <button class="md-btn md-btn-primary" style="padding:4px 10px; font-size:0.75rem;" onclick="App.showCreateCategoryModal()">➕ Nueva Categoría</button>
              <button class="md-btn md-btn-outlined" style="padding:4px 10px; font-size:0.75rem;" onclick="App.showCreateSeasonModal()">➕ Nueva Temporada</button>
            </div>
          </div>
          <p style="font-size:0.8rem; color:#94A3B8; margin-top:4px;">Temporada Activa: <strong>${this.activeSeason ? this.activeSeason.name : '2026'}</strong></p>
        </div>

        <div class="md-table-wrapper" style="margin-top:12px;">
          <table class="md-table">
            <thead>
              <tr><th>Categoría / División</th><th>Código</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              ${this.categories.length ? this.categories.map(c => `
                <tr>
                  <td style="font-weight:700;">${c.name}</td>
                  <td><span class="md-chip" style="padding:2px 6px;">${c.code}</span></td>
                  <td>
                    <div style="display:flex; gap:4px;">
                      <button class="md-btn md-btn-gold" style="padding:2px 6px; font-size:0.7rem;" onclick="App.showCrownChampionModal(${c.id}, '${c.name}')">👑 Coronar</button>
                      <button class="md-btn md-btn-outlined" style="padding:2px 6px; font-size:0.7rem;" onclick="App.showEditCategoryModal(${c.id}, '${c.name}', '${c.code}')">✏️ Editar</button>
                      <button class="md-btn md-btn-danger" style="padding:2px 6px; font-size:0.7rem;" onclick="App.deleteCategory(${c.id}, '${c.name}')">🗑️ Borrar</button>
                    </div>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="3" style="text-align:center; padding:16px; color:#94A3B8;">Sin categorías registradas. Puedes crear las tuyas de 0.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.adminTab === 'stadiums') {
      const res = await fetch('api/leagues.php?action=stadiums');
      const data = await res.json();
      const stadia = data.stadiums || [];

      tabContainer.innerHTML = `
        <div class="md-card">
          <div class="md-card-header">
            <h3 style="font-size:1rem; font-weight:800;">Gestor de Sedes y Campos</h3>
            <button class="md-btn md-btn-primary" style="padding:4px 10px; font-size:0.75rem;" onclick="App.showCreateStadiumModal()">➕ Nueva Sede / Cancha</button>
          </div>
          <p style="font-size:0.8rem; color:#94A3B8;">Configura predios principales (ej. Ezeiza Canchas 1, 2, 3, 4) o campos propios de clubes.</p>
        </div>

        <div class="md-table-wrapper" style="margin-top:12px;">
          <table class="md-table">
            <thead>
              <tr><th>Sede</th><th>Ubicación</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              ${stadia.length ? stadia.map(s => `
                <tr>
                  <td style="font-weight:800;">📍 ${s.name}</td>
                  <td style="font-size:0.8rem; color:#94A3B8;">${s.city} • ${s.address}</td>
                  <td>
                    <div style="display:flex; gap:4px;">
                      <button class="md-btn md-btn-outlined" style="padding:2px 6px; font-size:0.7rem;" onclick="App.showEditStadiumModal(${s.id}, '${s.name}', '${s.address}')">✏️ Editar</button>
                      <button class="md-btn md-btn-danger" style="padding:2px 6px; font-size:0.7rem;" onclick="App.deleteStadium(${s.id}, '${s.name}')">🗑️ Borrar</button>
                    </div>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="3" style="text-align:center; padding:16px;">Sin sedes registradas.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.adminTab === 'teams') {
      const res = await fetch('api/teams.php?action=list');
      const data = await res.json();
      const teams = data.teams || [];

      tabContainer.innerHTML = `
        <div class="md-card">
          <div class="md-card-header">
            <h3 style="font-size:1rem; font-weight:800;">Equipos de la Liga</h3>
            <button class="md-btn md-btn-primary" style="padding:4px 10px; font-size:0.75rem;" onclick="App.showCreateTeamModal()">➕ Registrar Equipo</button>
          </div>
          <button class="md-btn md-btn-gold" style="width:100%; margin-top:8px;" onclick="App.showMoveTeamModal()">🔄 Mover Equipo (Ascenso / Descenso)</button>
        </div>

        <div class="md-table-wrapper" style="margin-top:12px;">
          <table class="md-table">
            <thead>
              <tr><th>Equipo</th><th>Categoría</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              ${teams.length ? teams.map(t => `
                <tr>
                  <td style="font-weight:800; cursor:pointer;" onclick="App.showView('team_detail', ${t.id})">${t.name} (${t.short_name})</td>
                  <td><span class="md-chip">${t.category_name}</span></td>
                  <td>
                    <div style="display:flex; gap:4px;">
                      <button class="md-btn md-btn-outlined" style="padding:2px 6px; font-size:0.7rem;" onclick="App.showEditTeamModal(${t.id}, '${t.name}', '${t.short_name}', ${t.home_stadium_id || 0})">✏️ Editar</button>
                      <button class="md-btn md-btn-danger" style="padding:2px 6px; font-size:0.7rem;" onclick="App.deleteTeam(${t.id}, '${t.name}')">🗑️ Borrar</button>
                    </div>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="3" style="text-align:center; padding:16px;">Sin equipos registrados.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.adminTab === 'unassigned') {
      const res = await fetch('api/leagues.php?action=unassigned');
      const data = await res.json();
      const uTeams = data.unassigned_teams || [];
      const uPlayers = data.unassigned_players || [];

      tabContainer.innerHTML = `
        <div class="md-card" style="border:1px solid #F59E0B;">
          <h3 style="font-size:1rem; font-weight:800; color:#F59E0B;">⚠️ Listado de Elementos Sin Asignación</h3>
          <p style="font-size:0.8rem; color:#94A3B8;">Aquí convergen automáticamente los equipos cuya categoría fue eliminada o los jugadores que quedaron huérfanos al borrar un equipo. Puedes reasignarlos fácilmente.</p>
        </div>

        <!-- Equipos Sin Categoría -->
        <div class="view-section" style="margin-top:12px;">
          <h4 style="font-size:0.9rem; font-weight:800; color:#FFFFFF; margin-bottom:6px;">🛡️ Equipos Sin Categoría / División (${uTeams.length})</h4>
          <div class="md-table-wrapper">
            <table class="md-table">
              <thead>
                <tr><th>Equipo</th><th>Abreviatura</th><th>Acción</th></tr>
              </thead>
              <tbody>
                ${uTeams.length ? uTeams.map(t => `
                  <tr>
                    <td style="font-weight:800;">${t.name}</td>
                    <td><span class="md-chip">${t.short_name}</span></td>
                    <td>
                      <button class="md-btn md-btn-gold" style="padding:2px 8px; font-size:0.75rem;" onclick="App.reassignTeamModal(${t.id}, '${t.name}')">🔄 Asignar Categoría</button>
                    </td>
                  </tr>
                `).join('') : '<tr><td colspan="3" style="text-align:center; padding:12px; color:#10B981;">✅ Todos los equipos están asignados a una categoría.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Jugadores Sin Equipo (Agentes Libres) -->
        <div class="view-section" style="margin-top:16px;">
          <h4 style="font-size:0.9rem; font-weight:800; color:#FFFFFF; margin-bottom:6px;">🧢 Jugadores Sin Equipo / Agentes Libres (${uPlayers.length})</h4>
          <div class="md-table-wrapper">
            <table class="md-table">
              <thead>
                <tr><th>#</th><th>Jugador</th><th>Posición</th><th>Acción</th></tr>
              </thead>
              <tbody>
                ${uPlayers.length ? uPlayers.map(p => `
                  <tr>
                    <td style="font-weight:800; color:#F59E0B;">#${p.jersey_number}</td>
                    <td style="font-weight:700;">${p.first_name} ${p.last_name}</td>
                    <td><span class="md-chip" style="padding:2px 6px;">${p.position_primary}</span></td>
                    <td>
                      <button class="md-btn md-btn-primary" style="padding:2px 8px; font-size:0.75rem;" onclick="App.reassignPlayerModal(${p.id}, '${p.first_name} ${p.last_name}')">🧢 Asignar a Equipo</button>
                    </td>
                  </tr>
                `).join('') : '<tr><td colspan="4" style="text-align:center; padding:12px; color:#10B981;">✅ Todos los jugadores activos están integrados en un equipo.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (this.adminTab === 'stages') {
      const res = await fetch('api/leagues.php?action=stages');
      const data = await res.json();
      const stages = data.stages || [];

      tabContainer.innerHTML = `
        <div class="md-card">
          <div class="md-card-header">
            <h3 style="font-size:1rem; font-weight:800;">🏆 Etapas y Tipos de Partido</h3>
            <button class="md-btn md-btn-primary" style="padding:4px 10px; font-size:0.75rem;" onclick="App.showCreateStageModal()">➕ Nueva Etapa / Rol</button>
          </div>
          <p style="font-size:0.8rem; color:#94A3B8; margin-top:4px;">Crea etiquetas personalizadas para el calendario de partidos (ej. 8vos de final, Comodín, Amistoso Internacional, Juego de Exhibición).</p>
        </div>

        <div class="md-table-wrapper" style="margin-top:12px;">
          <table class="md-table">
            <thead>
              <tr><th>Etapa / Tipo</th><th>Código</th><th>Acción</th></tr>
            </thead>
            <tbody>
              ${stages.length ? stages.map(s => `
                <tr>
                  <td style="font-weight:800; color:#F59E0B;">⚾ ${s.name}</td>
                  <td><span class="md-chip">${s.code}</span></td>
                  <td>
                    <button class="md-btn md-btn-danger" style="padding:2px 6px; font-size:0.7rem;" onclick="App.deleteStage(${s.id}, '${s.name}')">🗑️ Eliminar</button>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="3" style="text-align:center; padding:16px;">Sin etapas registradas.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.adminTab === 'audit') {
      const res = await fetch('api/leagues.php?action=audit_logs');
      const data = await res.json();
      const logs = data.logs || [];

      tabContainer.innerHTML = `
        <div class="md-card">
          <h3 style="font-size:1rem; font-weight:800; color:#3B82F6;">📜 Histórico de Cambios y Auditoría</h3>
          <p style="font-size:0.8rem; color:#94A3B8;">Registro cronológico de todas las acciones administrativas críticas realizadas en el sistema.</p>
        </div>

        <div class="md-table-wrapper" style="margin-top:12px;">
          <table class="md-table" style="font-size:0.8rem;">
            <thead>
              <tr><th>Fecha</th><th>Acción</th><th>Detalle / Descripción</th><th>Usuario</th></tr>
            </thead>
            <tbody>
              ${logs.length ? logs.map(l => `
                <tr>
                  <td style="white-space:nowrap; color:#94A3B8;">${l.created_at}</td>
                  <td><span class="md-chip" style="font-size:0.65rem;">${l.action}</span></td>
                  <td style="font-weight:600;">${l.description}</td>
                  <td style="color:#F59E0B;">${l.user_name || 'Admin'}</td>
                </tr>
              `).join('') : '<tr><td colspan="4" style="text-align:center; padding:16px;">Sin registros en la auditoría.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.adminTab === 'users') {
      this.renderUsersManagementView(tabContainer);
    } else if (this.adminTab === 'branding') {
      tabContainer.innerHTML = `
        <div class="md-card">
          <h3 style="font-size:1rem; font-weight:800; color:#3B82F6; margin-bottom:8px;">🎨 Personalización Total de Marca y Branding</h3>
          <p style="font-size:0.8rem; color:#94A3B8; margin-bottom:12px;">Modifica el nombre de la liga, eslogan visual, logotipo oficial, esquema de colores y descripción SEO.</p>
          
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div class="form-group">
              <label style="font-size:0.78rem; font-weight:700;">Nombre Principal de la Liga / Sitio Web</label>
              <input type="text" id="setting-site-name" class="form-control" value="${this.settings.site_name || 'Liga Metropolitana de Béisbol'}">
            </div>

            <div class="form-group">
              <label style="font-size:0.78rem; font-weight:700;">Eslogan / Subtítulo Visual</label>
              <input type="text" id="setting-site-subtitle" class="form-control" value="${this.settings.site_subtitle || 'Buenos Aires'}" placeholder="ej. Buenos Aires">
            </div>

            <div class="form-group">
              <label style="font-size:0.78rem; font-weight:700;">Ruta o URL del Logotipo Oficial</label>
              <input type="text" id="setting-site-logo" class="form-control" value="${this.settings.site_logo || 'assets/images/lmb_logo.png'}">
            </div>

            <div class="form-group">
              <label style="font-size:0.78rem; font-weight:700;">Color Primario de la Marca (Hex / RGB)</label>
              <div style="display:flex; gap:8px;">
                <input type="color" id="setting-site-color-picker" value="${this.settings.site_primary_color || '#3B82F6'}" style="width:40px; height:38px; padding:2px; border-radius:6px;" onchange="document.getElementById('setting-site-color').value=this.value">
                <input type="text" id="setting-site-color" class="form-control" value="${this.settings.site_primary_color || '#3B82F6'}">
              </div>
            </div>

            <div class="form-group">
              <label style="font-size:0.78rem; font-weight:700;">Descripción Meta para Motores de Búsqueda (SEO)</label>
              <textarea id="setting-site-desc" class="form-control" rows="2">${this.settings.site_description || 'Plataforma oficial de la Liga Metropolitana de Béisbol de Buenos Aires.'}</textarea>
            </div>

            <button class="md-btn md-btn-primary" style="margin-top:6px;" onclick="App.updateSettings()">💾 Guardar Ajustes de Branding</button>
          </div>
        </div>
      `;
    }
  },

  // 9. SUPER ADMIN USERS LIST & SEARCH VIEW
  async renderUsersManagementView(container) {
    if (!this.currentUser || !['super_admin', 'admin'].includes(this.currentUser.role)) {
      container.innerHTML = `<div class="view-content"><div class="md-card">Acceso restringido.</div></div>`;
      return;
    }

    const q = document.getElementById('user-search-input')?.value || '';
    const res = await fetch(`api/auth.php?action=users_list&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const users = data.users || [];

    let html = `
      <div class="md-card">
        <h3 style="font-size:1rem; font-weight:800; color:#F59E0B;">👥 Gestión de Usuarios y Roles</h3>
        <p style="font-size:0.8rem; color:#94A3B8;">Filtra por correo electrónico para asignar permisos por club o rol de administración.</p>

        <div class="form-group" style="margin-top:8px;">
          <input type="text" id="user-search-input" class="form-control" placeholder="Buscar correo electrónico..." value="${q}" oninput="App.renderUsersManagementView(document.getElementById('admin-tab-content'))">
        </div>
      </div>

      <div class="md-table-wrapper" style="margin-top:12px;">
        <table class="md-table">
          <thead>
            <tr>
              <th>Usuario / Correo</th>
              <th>Rol</th>
              <th>Equipo Asignado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${users.length ? users.map(u => `
              <tr>
                <td>
                  <div style="font-weight:800;">${u.name}</div>
                  <div style="font-size:0.75rem; color:#94A3B8;">${u.email}</div>
                </td>
                <td><span class="md-chip active" style="padding:2px 6px; font-size:0.65rem;">${u.role.toUpperCase()}</span></td>
                <td style="font-size:0.8rem; color:#F59E0B;">${u.assigned_team_name || 'Ninguno (Global)'}</td>
                <td>
                  <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.7rem;" onclick="App.showEditUserModal(${u.id}, '${u.name}', '${u.role}', ${u.assigned_team_id || 0})">✏️ Permisos</button>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="4" style="text-align:center; padding:16px;">No se encontraron usuarios.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    container.innerHTML = html;
  },

  showUserModal() {
    if (!this.currentUser) return;
    const modal = document.getElementById('user-profile-modal');
    const container = document.getElementById('user-profile-details');
    if (!modal || !container) return;

    const u = this.currentUser;
    const roleLabels = {
      'super_admin': '👑 Super Administrador',
      'admin': '🛡️ Administrador Liga',
      'team_admin': '🧢 Delegado de Club',
      'scorekeeper': '📊 Planillero Oficial',
      'viewer': '👁️ Espectador'
    };
    const roleTitle = roleLabels[u.role] || u.role.toUpperCase();

    let html = `
      <div class="md-card" style="background: linear-gradient(135deg, #070D1B 0%, #1E3A8A 100%); text-align:center; padding:16px;">
        <div style="width:64px; height:64px; border-radius:50%; background:#F59E0B; color:#000; font-size:1.8rem; font-weight:800; display:flex; align-items:center; justify-content:center; margin:0 auto 8px auto; border:3px solid #FFFFFF;">
          ${u.name ? u.name.charAt(0).toUpperCase() : 'U'}
        </div>
        <h2 style="font-size:1.2rem; font-weight:800; color:#FFFFFF; margin:0;" class="text-truncate">${u.name}</h2>
        <div style="font-size:0.8rem; color:#94A3B8; margin-top:2px;">@${u.username} • ${u.email}</div>
        
        <div style="margin-top:8px;">
          <span class="md-chip active" style="font-size:0.75rem; padding:4px 12px;">${roleTitle}</span>
        </div>

        ${u.assigned_team_name ? `
          <div style="font-size:0.8rem; color:#F59E0B; font-weight:700; margin-top:8px;" class="text-truncate">
            🛡️ Club Asignado: ${u.assigned_team_name}
          </div>
        ` : ''}
      </div>

      <!-- Quick Action Buttons -->
      <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
        <button class="md-btn md-btn-gold" style="width:100%; justify-content:flex-start;" onclick="App.closeUserProfileModal(); App.installPwa();">
          <span class="material-icons-round">get_app</span> Instalar App Oficial (PWA)
        </button>

        <button class="md-btn md-btn-outlined" style="width:100%; justify-content:flex-start;" onclick="App.toggleChangePasswordForm()">
          <span class="material-icons-round" style="color:#F59E0B;">key</span> Cambiar Mi Contraseña
        </button>

        <!-- Change Password Form (Accordion) -->
        <form id="change-pass-form" style="display:none; flex-direction:column; gap:8px; background:rgba(7,13,27,0.6); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);" onsubmit="App.handleChangePassword(event)">
          <div class="form-group">
            <label>Contraseña Actual</label>
            <input type="password" id="cp-current" class="form-control" required placeholder="••••••••">
          </div>
          <div class="form-group">
            <label>Nueva Contraseña</label>
            <input type="password" id="cp-new" class="form-control" required minlength="6" placeholder="••••••••">
          </div>
          <div class="form-group">
            <label>Confirmar Nueva Contraseña</label>
            <input type="password" id="cp-confirm" class="form-control" required minlength="6" placeholder="••••••••">
          </div>
          <button type="submit" class="md-btn md-btn-primary" style="width:100%; margin-top:4px;">Guardar Nueva Contraseña</button>
        </form>

        ${['super_admin', 'admin'].includes(u.role) ? `
          <button class="md-btn md-btn-outlined" style="width:100%; justify-content:flex-start;" onclick="App.closeUserProfileModal(); App.showView('admin');">
            <span class="material-icons-round" style="color:#3B82F6;">admin_panel_settings</span> Ir al Panel de Administración
          </button>
        ` : ''}

        <button class="md-btn md-btn-danger" style="width:100%; margin-top:6px;" onclick="App.handleLogout()">
          <span class="material-icons-round">logout</span> Cerrar Sesión
        </button>
      </div>
    `;

    container.innerHTML = html;
    modal.classList.add('open');
  },

  closeUserProfileModal() {
    const modal = document.getElementById('user-profile-modal');
    if (modal) modal.classList.remove('open');
  },

  toggleChangePasswordForm() {
    const form = document.getElementById('change-pass-form');
    if (form) {
      form.style.display = (form.style.display === 'none' || !form.style.display) ? 'flex' : 'none';
      if (form.style.display === 'flex') {
        const input = document.getElementById('cp-current');
        if (input) input.focus();
      }
    }
  },

  async handleChangePassword(e) {
    e.preventDefault();
    const current_password = document.getElementById('cp-current').value.trim();
    const new_password = document.getElementById('cp-new').value.trim();
    const confirm_password = document.getElementById('cp-confirm').value.trim();

    if (!current_password || !new_password || !confirm_password) {
      this.showSnackbar('Complete todos los campos de contraseña.');
      return;
    }

    if (new_password.length < 6) {
      this.showSnackbar('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (new_password !== confirm_password) {
      this.showSnackbar('Las contraseñas no coinciden.');
      return;
    }

    try {
      const res = await fetch('api/auth.php?action=change_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password, new_password, confirm_password })
      });
      const data = await res.json();

      if (data.success) {
        this.showSnackbar(data.message || 'Contraseña actualizada.');
        this.toggleChangePasswordForm();
      } else {
        this.showSnackbar(data.message || 'Error al cambiar contraseña.');
      }
    } catch (err) {
      this.showSnackbar('Error de conexión.');
    }
  },

  async handleLogout() {
    try {
      await fetch('api/auth.php?action=logout');
      this.currentUser = null;
      this.renderUserBadge();
      this.closeUserProfileModal();
      this.showSnackbar('Sesión cerrada correctamente.');
      this.refreshCurrentView();
    } catch (e) {
      this.showSnackbar('Error al cerrar sesión.');
    }
  },

  showEditUserModal(userId, userName, currentRole, currentTeamId) {
    this.showRoleEditModal({ id: userId, name: userName, username: userName, role: currentRole, assigned_team_id: currentTeamId });
  },

  async showRoleEditModal(user) {
    const modal = document.getElementById('role-edit-modal');
    if (!modal) return;
    document.getElementById('re-user-id').value = user.id;
    document.getElementById('re-user-info').textContent = `Usuario: ${user.name} (${user.role || 'viewer'})`;
    document.getElementById('re-user-role').value = user.role || 'viewer';

    const teamSelect = document.getElementById('re-user-team');
    teamSelect.innerHTML = '<option value="">- Sin equipo específico -</option>';
    try {
      const res = await fetch('api/teams.php?action=list');
      const data = await res.json();
      if (data.success && data.teams) {
        data.teams.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = `${t.name} (${t.category_name || 'Sin categoría'})`;
          if (user.assigned_team_id == t.id) opt.selected = true;
          teamSelect.appendChild(opt);
        });
      }
    } catch(e){}

    modal.classList.add('open');
  },

  closeRoleEditModal() {
    const modal = document.getElementById('role-edit-modal');
    if (modal) modal.classList.remove('open');
  },

  async handleSaveUserRole(e) {
    e.preventDefault();
    const userId = document.getElementById('re-user-id').value;
    const role = document.getElementById('re-user-role').value;
    const assignedTeamId = document.getElementById('re-user-team').value;

    try {
      const res = await fetch('api/auth.php?action=user_update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: role, assigned_team_id: assignedTeamId ? parseInt(assignedTeamId) : null })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar('✅ Permisos y equipo de usuario actualizados correctamente.');
        this.closeRoleEditModal();
        this.refreshCurrentView();
      } else {
        this.showAlert("Error", data.message || "No se pudo actualizar.", "error", "#EF4444");
      }
    } catch(err) {
      this.showAlert("Error", "Error de conexión.", "wifi_off", "#EF4444");
    }
  },

  async showCreateStadiumModal() {
    const name = await this.showPrompt("Nueva Sede / Predio", "Nombre del estadio o complejo deportivo (ej. Estadio Ezeiza, Predio DAOM):");
    if (!name) return;
    const fieldName = await this.showPrompt("Nombre del Campo / Cancha", "Identificador de la cancha (ej. Cancha 1, Campo Principal):", "Cancha 1");
    const address = await this.showPrompt("Dirección de la Sede", "Dirección física:");
    const city = await this.showPrompt("Ciudad", "Ciudad o Municipio:", "Buenos Aires");

    fetch('api/leagues.php?action=create_stadium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, field_name: fieldName, address, city })
    }).then(res => res.json()).then(data => {
      this.showSnackbar(data.message || 'Sede registrada exitosamente.');
      this.refreshCurrentView();
    });
  },

  async showCreateSeasonModal() {
    const name = await this.showPrompt("Nueva Temporada Oficial", "Nombre de la temporada (ej. Temporada Oficial 2026):");
    if (!name) return;
    const year = await this.showPrompt("Año de la Temporada", "Año de la temporada:", new Date().getFullYear().toString());

    fetch('api/leagues.php?action=create_season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, year })
    }).then(res => res.json()).then(data => {
      this.showSnackbar(data.message || 'Temporada registrada.');
      this.loadLeagues();
      this.refreshCurrentView();
    });
  },

  async showCreateTeamModal() {
    if (!this.categories || !this.categories.length) {
      const go = await this.showConfirm("Configuración Requerida", "Para registrar un equipo primero se debe crear al menos 1 Temporada y Categoría en la liga.\n\n¿Deseas ir a la Guía de Inicio?", "help", "#F59E0B");
      if (go) this.showView('onboarding');
      return;
    }

    const catId = this.currentCategory || (this.categories[0] ? this.categories[0].id : 1);
    const name = await this.showPrompt("Nuevo Equipo", "Nombre completo del equipo de béisbol:");
    if (!name) return;
    const shortName = await this.showPrompt("Abreviatura (4 Letras)", "Identificador corto:", name.substring(0, 4).toUpperCase());

    fetch('api/leagues.php?action=stadiums').then(res => res.json()).then(async data => {
      const stadia = data.stadiums || [];
      let stPrompt = `Seleccionar ID de Sede Fija (0 = Neutral):\n0: Neutral\n`;
      stadia.forEach(s => { stPrompt += `${s.id}: ${s.name} (${s.field_name || 'Principal'})\n`; });

      const stadiumId = await this.showPrompt("Sede Deportiva del Equipo", stPrompt, "0");

      fetch('api/teams.php?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: catId, name, short_name: shortName, home_stadium_id: parseInt(stadiumId || 0) })
      }).then(res => res.json()).then(resData => {
        this.showSnackbar(resData.message || 'Equipo creado exitosamente.');
        this.refreshCurrentView();
      });
    });
  },

  async showMoveTeamModal() {
    fetch('api/teams.php?action=list').then(res => res.json()).then(async data => {
      const teams = data.teams || [];
      if (!teams.length) {
        return this.showAlert("Atención", "No hay equipos registrados para reubicar.", "warning", "#F59E0B");
      }
      let teamPrompt = `Seleccionar ID de Equipo a mover:\n` + teams.map(t => `${t.id}: ${t.name} (${t.category_name || 'Sin Categoría'})`).join('\n');
      const teamId = await this.showPrompt("Reubicación de Equipo", teamPrompt);
      if (!teamId) return;

      let catPrompt = `Seleccionar ID de Nueva Categoría:\n` + this.categories.map(c => `${c.id}: ${c.name}`).join('\n');
      const newCatId = await this.showPrompt("Categoría Destino", catPrompt);
      if (!newCatId) return;

      fetch('api/leagues.php?action=move_team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: parseInt(teamId), category_id: parseInt(newCatId), notes: 'Ascenso/Descenso' })
      }).then(res => res.json()).then(resData => {
        this.showSnackbar(resData.message || 'Equipo reubicado.');
        this.loadLeagues();
        this.refreshCurrentView();
      });
    });
  },

  async showCreateGameModal() {
    try {
      const [resCat, resStadia, resStages] = await Promise.all([
        fetch('api/leagues.php?action=categories'),
        fetch('api/leagues.php?action=stadiums'),
        fetch('api/leagues.php?action=stages')
      ]);
      const dataCat = await resCat.json();
      const dataStadia = await resStadia.json();
      const dataStages = await resStages.json();

      const categories = dataCat.categories || [];
      const stadia = dataStadia.stadiums || [];
      const stages = dataStages.stages || [];

      if (!stadia.length) {
        const go = await this.showConfirm("Sedes Requeridas", "No hay sedes deportivas registradas. ¿Ir a configurarlas?", "help", "#F59E0B");
        if (go) this.showView('admin');
        return;
      }

      const catSelect = document.getElementById('schedule-game-category');
      if (catSelect) {
        catSelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.name} (${c.code})</option>`).join('');
      }

      const stadSelect = document.getElementById('schedule-game-stadium');
      if (stadSelect) {
        stadSelect.innerHTML = stadia.map(s => `<option value="${s.id}">📍 ${s.name} (${s.field_name || 'Principal'})</option>`).join('');
      }

      const stageSelect = document.getElementById('schedule-game-stage');
      if (stageSelect) {
        stageSelect.innerHTML = stages.length 
          ? stages.map(s => `<option value="${s.name}">🏆 ${s.name}</option>`).join('')
          : `<option value="Temporada Regular">🏆 Temporada Regular</option><option value="Amistoso">🏆 Amistoso</option>`;
      }

      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      const dateInput = document.getElementById('schedule-game-date');
      if (dateInput) {
        dateInput.value = now.toISOString().slice(0, 16);
      }

      await this.onGameCategoryChange();
      const modal = document.getElementById('create-game-modal');
      if (modal) modal.classList.add('open');
    } catch(e) {
      console.error("Error al abrir modal de programar partido", e);
    }
  },

  async onGameCategoryChange() {
    const catSelect = document.getElementById('schedule-game-category');
    const catId = catSelect ? catSelect.value : 0;
    const resTeams = await fetch(`api/teams.php?action=list${catId ? `&category_id=${catId}` : ''}`);
    const dataTeams = await resTeams.json();
    const teams = dataTeams.teams || [];

    const homeSelect = document.getElementById('schedule-game-home');
    const awaySelect = document.getElementById('schedule-game-away');

    if (!teams.length) {
      if (homeSelect) homeSelect.innerHTML = `<option value="">Sin equipos en esta categoría</option>`;
      if (awaySelect) awaySelect.innerHTML = `<option value="">Sin equipos en esta categoría</option>`;
      return;
    }

    if (homeSelect) homeSelect.innerHTML = teams.map(t => `<option value="${t.id}">🏠 ${t.name} (${t.short_name})</option>`).join('');
    if (awaySelect) awaySelect.innerHTML = teams.map((t, idx) => `<option value="${t.id}" ${idx === 1 ? 'selected' : ''}>✈️ ${t.name} (${t.short_name})</option>`).join('');
  },

  closeCreateGameModal() {
    const modal = document.getElementById('create-game-modal');
    if (modal) modal.classList.remove('open');
  },

  async handleSaveNewGame(e) {
    e.preventDefault();
    const catId = document.getElementById('schedule-game-category').value;
    const homeId = document.getElementById('schedule-game-home').value;
    const awayId = document.getElementById('schedule-game-away').value;
    const stadiumId = document.getElementById('schedule-game-stadium').value;
    const gameStage = document.getElementById('schedule-game-stage').value;
    const gameDate = document.getElementById('schedule-game-date').value;

    if (!homeId || !awayId || homeId === awayId) {
      this.showAlert("Atención", "Debes seleccionar 2 equipos distintos para programar el partido.", "warning", "#F59E0B");
      return;
    }

    try {
      const res = await fetch('api/games.php?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: parseInt(catId),
          home_team_id: parseInt(homeId),
          away_team_id: parseInt(awayId),
          stadium_id: parseInt(stadiumId || 1),
          game_stage: gameStage || "Temporada Regular",
          game_date: gameDate.replace('T', ' ') + ':00'
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar(data.message || 'Partido programado exitosamente.');
        this.closeCreateGameModal();
        this.showView('calendar');
      } else {
        this.showAlert("Error", data.message || 'Error al programar el partido.', "error", "#EF4444");
      }
    } catch(e) {
      console.error("Error al programar partido", e);
    }
  },

  async showCreatePlayerModal(teamId = null) {
    if (!teamId) {
      const res = await fetch('api/teams.php?action=list');
      const data = await res.json();
      const teams = data.teams || [];
      if (!teams.length) {
        const go = await this.showConfirm("Configuración Requerida", "Para registrar jugadores o cuerpo técnico primero debes crear un equipo.\n\n¿Deseas ir a la Guía de Inicio?", "help", "#F59E0B");
        if (go) this.showView('onboarding');
        return;
      }
      teamId = teams[0].id;
    }

    const modal = document.getElementById('create-player-modal');
    if (!modal) return;
    document.getElementById('cp-team-id').value = teamId;
    if (document.getElementById('cp-role-type')) document.getElementById('cp-role-type').value = 'player';
    document.getElementById('cp-first-name').value = '';
    document.getElementById('cp-last-name').value = '';
    document.getElementById('cp-jersey').value = '10';
    document.getElementById('cp-position').value = 'OF';
    modal.classList.add('open');
  },

  closeCreatePlayerModal() {
    const modal = document.getElementById('create-player-modal');
    if (modal) modal.classList.remove('open');
  },

  async handleSaveNewPlayer(e) {
    e.preventDefault();
    const teamId = document.getElementById('cp-team-id').value;
    const roleType = document.getElementById('cp-role-type') ? document.getElementById('cp-role-type').value : 'player';
    const firstName = document.getElementById('cp-first-name').value.trim();
    const lastName = document.getElementById('cp-last-name').value.trim();
    const jersey = document.getElementById('cp-jersey').value;
    const position = document.getElementById('cp-position').value;

    try {
      const res = await fetch('api/players.php?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: parseInt(teamId),
          role_type: roleType,
          first_name: firstName,
          last_name: lastName,
          jersey_number: jersey,
          position_primary: position
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar('✅ Integrante registrado exitosamente en el equipo.');
        this.closeCreatePlayerModal();
        if (this.currentView === 'team_detail') this.renderTeamDetailView(document.getElementById('view-container'), teamId);
      } else {
        this.showAlert('Error', data.message || 'No se pudo registrar al integrante.', 'error', '#EF4444');
      }
    } catch(err) {
      this.showAlert('Error', 'Error de conexión.', 'wifi_off', '#EF4444');
    }
  },

  // SINGLE FILE UPLOAD MODAL
  showFileUploadModal(type, targetId, titleText = 'Subir Imagen') {
    const modal = document.getElementById('file-upload-modal');
    if (!modal) return;
    document.getElementById('upload-type').value = type;
    document.getElementById('upload-target-id').value = targetId;
    document.getElementById('upload-label-title').textContent = titleText;
    document.getElementById('upload-file-input').value = '';
    modal.classList.add('open');
  },

  closeFileUploadModal() {
    const modal = document.getElementById('file-upload-modal');
    if (modal) modal.classList.remove('open');
  },

  async handleUploadFile(e) {
    e.preventDefault();
    const type = document.getElementById('upload-type').value;
    const targetId = document.getElementById('upload-target-id').value;
    const fileInput = document.getElementById('upload-file-input');

    if (!fileInput.files || !fileInput.files[0]) {
      this.showSnackbar('Por favor selecciona una imagen.');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('upload_type', type);
    if (type === 'logo') formData.append('team_id', targetId);
    if (type === 'player') formData.append('player_id', targetId);

    try {
      const res = await fetch('api/media.php', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar('✅ Imagen subida y actualizada exitosamente.');
        this.closeFileUploadModal();
        this.refreshCurrentView();
      } else {
        this.showAlert('Error', data.message || 'Error al subir archivo.', 'error', '#EF4444');
      }
    } catch(err) {
      this.showAlert('Error', 'Error de conexión al subir imagen.', 'wifi_off', '#EF4444');
    }
  },

  // MULTI-ENTITY PHOTO GALLERY MODAL (UP TO 10 PHOTOS)
  async showEntityGalleryModal(entityType, entityId, title = '') {
    const modal = document.getElementById('entity-gallery-modal');
    if (!modal) return;
    document.getElementById('gallery-entity-type').value = entityType;
    document.getElementById('gallery-entity-id').value = entityId;
    document.getElementById('gallery-file-input').value = '';
    document.getElementById('gallery-caption-input').value = '';
    
    modal.classList.add('open');
    this.loadEntityGalleryPhotos(entityType, entityId);
  },

  closeEntityGalleryModal() {
    const modal = document.getElementById('entity-gallery-modal');
    if (modal) modal.classList.remove('open');
  },

  async loadEntityGalleryPhotos(entityType, entityId) {
    const container = document.getElementById('gallery-photos-container');
    if (!container) return;
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:12px;">Cargando postales...</div>';

    try {
      const res = await fetch(`api/media.php?action=gallery&entity_type=${entityType}&entity_id=${entityId}`);
      const data = await res.json();
      const photos = data.photos || [];

      if (!photos.length) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#94A3B8; padding:16px;">Sin postales registradas aún. ¡Agrega la primera postal (Máximo 10)!</div>';
        return;
      }

      const isAuth = (this.currentUser && ['super_admin', 'admin', 'team_admin'].includes(this.currentUser.role));

      container.innerHTML = photos.map(p => `
        <div style="position:relative; background:#0F172A; border-radius:8px; overflow:hidden; border:1px solid rgba(255,255,255,0.08);">
          <img src="${p.image_url}" style="width:100%; height:110px; object-fit:cover; display:block; cursor:pointer;" onclick="window.open('${p.image_url}', '_blank')">
          ${p.caption ? `<div style="padding:4px; font-size:0.7rem; color:#94A3B8;" class="text-truncate">${p.caption}</div>` : ''}
          ${isAuth ? `<button style="position:absolute; top:4px; right:4px; background:rgba(239,68,68,0.85); color:#fff; border:none; border-radius:50%; width:22px; height:22px; font-size:0.7rem; cursor:pointer;" onclick="App.deleteEntityGalleryPhoto(${p.id}, '${entityType}', ${entityId})">✕</button>` : ''}
        </div>
      `).join('');
    } catch(e) {
      container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#EF4444;">Error al cargar galería.</div>';
    }
  },

  async handleUploadGalleryPhoto(e) {
    e.preventDefault();
    const entityType = document.getElementById('gallery-entity-type').value;
    const entityId = document.getElementById('gallery-entity-id').value;
    const fileInput = document.getElementById('gallery-file-input');
    const caption = document.getElementById('gallery-caption-input').value.trim();

    if (!fileInput.files || !fileInput.files[0]) {
      this.showSnackbar('Por favor selecciona una imagen.');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('upload_type', 'entity_gallery');
    formData.append('entity_type', entityType);
    formData.append('entity_id', entityId);
    formData.append('caption', caption || 'Postal informativa');

    try {
      const res = await fetch('api/media.php', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar('✅ Postal subida a la galería exitosamente.');
        document.getElementById('gallery-file-input').value = '';
        document.getElementById('gallery-caption-input').value = '';
        this.loadEntityGalleryPhotos(entityType, entityId);
        this.refreshCurrentView();
      } else {
        this.showAlert('Atención', data.message || 'No se pudo subir la postal.', 'warning', '#F59E0B');
      }
    } catch(err) {
      this.showAlert('Error', 'Error de conexión al subir la postal.', 'wifi_off', '#EF4444');
    }
  },

  async deleteEntityGalleryPhoto(photoId, entityType, entityId) {
    const confirmDelete = await this.showConfirm("Eliminar Postal", "¿Deseas eliminar esta postal de la galería?", "delete", "#EF4444");
    if (confirmDelete) {
      try {
        const res = await fetch('api/media.php?action=delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo_id: photoId, entity_type: entityType })
        });
        const data = await res.json();
        if (data.success) {
          this.showSnackbar('Postal eliminada.');
          this.loadEntityGalleryPhotos(entityType, entityId);
        }
      } catch(e){}
    }
  },

  updateSettings() {
    const siteName = document.getElementById('setting-site-name')?.value;
    const siteSubtitle = document.getElementById('setting-site-subtitle')?.value;
    const siteLogo = document.getElementById('setting-site-logo')?.value;
    const sitePrimaryColor = document.getElementById('setting-site-color')?.value;
    const siteDescription = document.getElementById('setting-site-desc')?.value;

    fetch('api/auth.php?action=settings_update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_name: siteName,
        site_subtitle: siteSubtitle,
        site_logo: siteLogo,
        site_primary_color: sitePrimaryColor,
        site_description: siteDescription
      })
    }).then(res => res.json()).then(data => {
      this.showAlert("Ajustes de Marca", data.message || 'Branding actualizado.', "palette", "#3B82F6");
      this.loadSettings();
    });
  },

  uploadTeamLogo(teamId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_type', 'logo');
      formData.append('team_id', teamId);

      fetch('api/media.php', {
        method: 'POST',
        body: formData
      }).then(res => res.json()).then(data => {
        this.showAlert("Emblema de Equipo", data.message, "image", "#10B981");
        this.showView('team_detail', teamId);
      });
    };
    input.click();
  },

  showSnackbar(msg) {
    const bar = document.getElementById('snackbar');
    if (!bar) return;
    bar.innerText = msg;
    bar.style.display = 'block';
    setTimeout(() => { bar.style.display = 'none'; }, 3000);
  },

  openGameResultModal(game) {
    this.editingGame = game;
    document.getElementById('gr-game-id').value = game.id;
    document.getElementById('gr-status').value = game.status || 'finished';
    document.getElementById('gr-away-team-label').innerText = game.away_team_name || 'Visitante';
    document.getElementById('gr-home-team-label').innerText = game.home_team_name || 'Local';
    document.getElementById('gr-away-score').value = game.away_score || 0;
    document.getElementById('gr-home-score').value = game.home_score || 0;
    document.getElementById('gr-away-hits').value = game.away_hits || 0;
    document.getElementById('gr-home-hits').value = game.home_hits || 0;
    document.getElementById('gr-away-errors').value = game.away_errors || 0;
    document.getElementById('gr-home-errors').value = game.home_errors || 0;
    document.getElementById('gr-recap-notes').value = game.recap_notes || '';

    const modal = document.getElementById('game-result-modal');
    if (modal) modal.classList.add('open');
  },

  closeGameResultModal() {
    const modal = document.getElementById('game-result-modal');
    if (modal) modal.classList.remove('open');
  },

  async handleSaveGameResult(e) {
    e.preventDefault();
    const gameId = document.getElementById('gr-game-id').value;
    const status = document.getElementById('gr-status').value;
    const awayScore = document.getElementById('gr-away-score').value;
    const homeScore = document.getElementById('gr-home-score').value;
    const awayHits = document.getElementById('gr-away-hits').value;
    const homeHits = document.getElementById('gr-home-hits').value;
    const awayErrors = document.getElementById('gr-away-errors').value;
    const homeErrors = document.getElementById('gr-home-errors').value;
    const recapNotes = document.getElementById('gr-recap-notes').value;

    try {
      const res = await fetch('api/games.php?action=update_result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: gameId,
          status,
          away_score: awayScore,
          home_score: homeScore,
          away_hits: awayHits,
          home_hits: homeHits,
          away_errors: awayErrors,
          home_errors: homeErrors,
          recap_notes: recapNotes
        })
      });
      const data = await res.json();
      if (data.success) {
        this.closeGameResultModal();
        this.showSnackbar(data.message || 'Resultado guardado correctamente.');
        this.refreshCurrentView();
      } else {
        this.showAlert('Atención', data.message || 'Error al guardar resultado.', 'error', '#EF4444');
      }
    } catch (err) {
      this.showAlert('Error', 'Error de conexión al guardar resultado.', 'wifi_off', '#EF4444');
    }
  },

  async openManualStatsModal(game) {
    this.currentManualGame = game;
    this.currentManualTeamKey = 'away';

    try {
      const [resAway, resHome, resDetail] = await Promise.all([
        fetch(`api/players.php?action=list&team_id=${game.away_team_id}`),
        fetch(`api/players.php?action=list&team_id=${game.home_team_id}`),
        fetch(`api/games.php?action=detail&id=${game.id}`)
      ]);

      const dataAway = await resAway.json();
      const dataHome = await resHome.json();
      const dataDetail = await resDetail.json();

      this.awayRoster = dataAway.players || [];
      this.homeRoster = dataHome.players || [];
      this.manualGameDetail = dataDetail;

      const modal = document.getElementById('manual-stats-modal');
      if (modal) modal.classList.add('open');

      this.switchManualStatsTeam('away');
    } catch (e) {
      this.showAlert('Error', 'No se pudieron obtener las plantillas para estadísticas.', 'warning', '#EF4444');
    }
  },

  closeManualStatsModal() {
    const modal = document.getElementById('manual-stats-modal');
    if (modal) modal.classList.remove('open');
  },

  switchManualStatsTeam(teamKey) {
    this.currentManualTeamKey = teamKey;
    const tabAway = document.getElementById('ms-tab-away');
    const tabHome = document.getElementById('ms-tab-home');

    if (teamKey === 'away') {
      if (tabAway) { tabAway.className = 'md-btn md-btn-primary'; tabAway.innerText = `Visitante: ${this.currentManualGame.away_short || 'Visitante'}`; }
      if (tabHome) { tabHome.className = 'md-btn md-btn-outlined'; tabHome.innerText = `Local: ${this.currentManualGame.home_short || 'Local'}`; }
    } else {
      if (tabAway) { tabAway.className = 'md-btn md-btn-outlined'; tabAway.innerText = `Visitante: ${this.currentManualGame.away_short || 'Visitante'}`; }
      if (tabHome) { tabHome.className = 'md-btn md-btn-primary'; tabHome.innerText = `Local: ${this.currentManualGame.home_short || 'Local'}`; }
    }

    this.renderManualStatsContent();
  },

  renderManualStatsContent() {
    const body = document.getElementById('manual-stats-body');
    if (!body || !this.currentManualGame) return;

    const isAway = (this.currentManualTeamKey === 'away');
    const teamId = isAway ? this.currentManualGame.away_team_id : this.currentManualGame.home_team_id;
    const teamName = isAway ? this.currentManualGame.away_team_name : this.currentManualGame.home_team_name;
    const roster = isAway ? this.awayRoster : this.homeRoster;
    const existingBat = isAway ? (this.manualGameDetail?.away_batters || []) : (this.manualGameDetail?.home_batters || []);
    const existingPitch = isAway ? (this.manualGameDetail?.away_pitchers || []) : (this.manualGameDetail?.home_pitchers || []);

    if (!roster || !roster.length) {
      body.innerHTML = `
        <div class="md-card" style="text-align:center; padding:16px;">
          <div style="font-weight:700;">No hay jugadores registrados en el plantel de ${teamName}</div>
          <div style="font-size:0.8rem; color:#94A3B8; margin-top:4px;">Agrega jugadores al equipo desde la vista Equipos para cargar sus estadísticas.</div>
        </div>
      `;
      return;
    }

    let html = `
      <div style="font-size:0.85rem; font-weight:800; color:#F59E0B;" class="text-truncate">
        Plantel: ${teamName} (${roster.length} jugadores)
      </div>

      <!-- BATTING STATS FORM TABLE -->
      <div class="md-card">
        <div style="font-weight:800; font-size:0.85rem; color:#FFFFFF; margin-bottom:6px;">📊 Estadísticas de Bateo (Ofensiva)</div>
        <div class="md-table-wrapper" style="border:none;">
          <table class="md-table">
            <thead>
              <tr>
                <th>Jugador</th>
                <th>AB</th><th>C</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>CI</th><th>BB</th><th>SO</th><th>BR</th><th>E</th>
              </tr>
            </thead>
            <tbody>
              ${roster.map(p => {
                const ex = existingBat.find(b => b.player_id == p.id) || {};
                return `
                  <tr>
                    <td style="font-weight:700;" class="text-truncate">
                      #${p.jersey_number} ${p.first_name} ${p.last_name}
                      <input type="hidden" class="ms-bat-player-id" value="${p.id}">
                    </td>
                    <td><input type="number" min="0" class="form-control ms-bat-ab" style="padding:4px; width:45px; text-align:center;" value="${ex.ab || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-bat-r" style="padding:4px; width:45px; text-align:center;" value="${ex.r || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-bat-h" style="padding:4px; width:45px; text-align:center;" value="${ex.h || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-bat-doubles" style="padding:4px; width:40px; text-align:center;" value="${ex.doubles || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-bat-triples" style="padding:4px; width:40px; text-align:center;" value="${ex.triples || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-bat-hr" style="padding:4px; width:40px; text-align:center;" value="${ex.hr || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-bat-rbi" style="padding:4px; width:45px; text-align:center;" value="${ex.rbi || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-bat-bb" style="padding:4px; width:40px; text-align:center;" value="${ex.bb || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-bat-so" style="padding:4px; width:40px; text-align:center;" value="${ex.so || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-bat-sb" style="padding:4px; width:40px; text-align:center;" value="${ex.sb || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-bat-e" style="padding:4px; width:40px; text-align:center;" value="${ex.e || 0}"></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- PITCHING STATS FORM TABLE -->
      <div class="md-card">
        <div style="font-weight:800; font-size:0.85rem; color:#3B82F6; margin-bottom:6px;">⚾ Estadísticas de Pitcheo (Lanzadores)</div>
        <div class="md-table-wrapper" style="border:none;">
          <table class="md-table">
            <thead>
              <tr>
                <th>Lanzador</th>
                <th>Outs (3=1IP)</th><th>H</th><th>C</th><th>CL (ER)</th><th>BB</th><th>SO</th><th>Decisión</th>
              </tr>
            </thead>
            <tbody>
              ${roster.map(p => {
                const ex = existingPitch.find(pt => pt.player_id == p.id) || {};
                return `
                  <tr>
                    <td style="font-weight:700;" class="text-truncate">
                      #${p.jersey_number} ${p.first_name} ${p.last_name}
                      <input type="hidden" class="ms-pitch-player-id" value="${p.id}">
                    </td>
                    <td><input type="number" min="0" class="form-control ms-pitch-outs" style="padding:4px; width:50px; text-align:center;" value="${ex.ip_outs || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-pitch-h" style="padding:4px; width:45px; text-align:center;" value="${ex.h || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-pitch-r" style="padding:4px; width:45px; text-align:center;" value="${ex.r || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-pitch-er" style="padding:4px; width:45px; text-align:center;" value="${ex.er || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-pitch-bb" style="padding:4px; width:40px; text-align:center;" value="${ex.bb || 0}"></td>
                    <td><input type="number" min="0" class="form-control ms-pitch-so" style="padding:4px; width:40px; text-align:center;" value="${ex.so || 0}"></td>
                    <td>
                      <select class="form-control ms-pitch-decision" style="padding:4px; width:70px; font-size:0.75rem;">
                        <option value="NONE" ${ex.decision === 'NONE' ? 'selected' : ''}>-</option>
                        <option value="W" ${ex.decision === 'W' ? 'selected' : ''}>G (W)</option>
                        <option value="L" ${ex.decision === 'L' ? 'selected' : ''}>P (L)</option>
                        <option value="SV" ${ex.decision === 'SV' ? 'selected' : ''}>S (SV)</option>
                        <option value="H" ${ex.decision === 'H' ? 'selected' : ''}>H (Hold)</option>
                      </select>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <button class="md-btn md-btn-gold" style="width:100%; margin-top:4px;" onclick="App.handleSaveManualStats()">
        💾 Guardar Estadísticas del Equipo ${teamName}
      </button>
    `;

    body.innerHTML = html;
  },

  async handleSaveManualStats() {
    if (!this.currentManualGame) return;

    const isAway = (this.currentManualTeamKey === 'away');
    const teamId = isAway ? this.currentManualGame.away_team_id : this.currentManualGame.home_team_id;

    // Collect Batting Stats
    const battingStats = [];
    document.querySelectorAll('.ms-bat-player-id').forEach(el => {
      const row = el.closest('tr');
      const pId = el.value;
      const ab = parseInt(row.querySelector('.ms-bat-ab')?.value || 0);
      const r = parseInt(row.querySelector('.ms-bat-r')?.value || 0);
      const h = parseInt(row.querySelector('.ms-bat-h')?.value || 0);
      const doubles = parseInt(row.querySelector('.ms-bat-doubles')?.value || 0);
      const triples = parseInt(row.querySelector('.ms-bat-triples')?.value || 0);
      const hr = parseInt(row.querySelector('.ms-bat-hr')?.value || 0);
      const rbi = parseInt(row.querySelector('.ms-bat-rbi')?.value || 0);
      const bb = parseInt(row.querySelector('.ms-bat-bb')?.value || 0);
      const so = parseInt(row.querySelector('.ms-bat-so')?.value || 0);
      const sb = parseInt(row.querySelector('.ms-bat-sb')?.value || 0);
      const e = parseInt(row.querySelector('.ms-bat-e')?.value || 0);

      if (ab > 0 || r > 0 || h > 0 || rbi > 0 || bb > 0 || so > 0 || e > 0) {
        battingStats.push({
          player_id: pId,
          ab, r, h, singles: Math.max(0, h - doubles - triples - hr), doubles, triples, hr, rbi, bb, so, sb, e
        });
      }
    });

    // Collect Pitching Stats
    const pitchingStats = [];
    document.querySelectorAll('.ms-pitch-player-id').forEach(el => {
      const row = el.closest('tr');
      const pId = el.value;
      const ip_outs = parseInt(row.querySelector('.ms-pitch-outs')?.value || 0);
      const h = parseInt(row.querySelector('.ms-pitch-h')?.value || 0);
      const r = parseInt(row.querySelector('.ms-pitch-r')?.value || 0);
      const er = parseInt(row.querySelector('.ms-pitch-er')?.value || 0);
      const bb = parseInt(row.querySelector('.ms-pitch-bb')?.value || 0);
      const so = parseInt(row.querySelector('.ms-pitch-so')?.value || 0);
      const decision = row.querySelector('.ms-pitch-decision')?.value || 'NONE';

      if (ip_outs > 0 || h > 0 || r > 0 || er > 0 || bb > 0 || so > 0 || decision !== 'NONE') {
        pitchingStats.push({
          player_id: pId,
          ip_outs, h, r, er, bb, so, decision
        });
      }
    });

    try {
      const res = await fetch('api/games.php?action=save_manual_stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: this.currentManualGame.id,
          team_id: teamId,
          batting_stats: battingStats,
          pitching_stats: pitchingStats
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar(data.message || 'Estadísticas guardadas con éxito.');
        const resDetail = await fetch(`api/games.php?action=detail&id=${this.currentManualGame.id}`);
        this.manualGameDetail = await resDetail.json();
        this.renderManualStatsContent();
      } else {
        this.showAlert('Atención', data.message || 'Error al guardar estadísticas.', 'error', '#EF4444');
      }
    } catch (err) {
      this.showAlert('Error', 'Error de conexión al guardar estadísticas.', 'wifi_off', '#EF4444');
    }
  },

  // CATEGORY CRUD
  async showCreateCategoryModal() {
    const name = await this.showPrompt("Nueva Categoría / División", "Nombre de la categoría (Ej. Primera A, Segunda B, Senior):");
    if (!name) return;
    const code = await this.showPrompt("Código Corto", "Abreviatura (Ej. DIV1, SEN, A2):", name.substring(0, 4).toUpperCase());
    if (!code) return;

    try {
      const res = await fetch('api/leagues.php?action=create_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, season_id: this.activeSeason ? this.activeSeason.id : 1 })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar('✅ Categoría creada exitosamente.');
        await this.loadLeagues();
        this.refreshCurrentView();
      } else {
        this.showAlert('Error', data.message || 'No se pudo crear.', 'error', '#EF4444');
      }
    } catch(e) {
      this.showAlert('Error', 'Error de conexión.', 'wifi_off', '#EF4444');
    }
  },

  async showEditCategoryModal(catId, currentName, currentCode) {
    const name = await this.showPrompt("Editar Categoría", "Nuevo nombre:", currentName);
    if (!name) return;
    const code = await this.showPrompt("Editar Código", "Nuevo código:", currentCode);
    if (!code) return;

    try {
      const res = await fetch('api/leagues.php?action=update_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: catId, name, code })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar('Categoría actualizada.');
        await this.loadLeagues();
        this.refreshCurrentView();
      } else {
        this.showAlert('Error', data.message || 'No se pudo actualizar.', 'error', '#EF4444');
      }
    } catch(e) {}
  },

  async deleteCategory(catId, catName) {
    const confirmDelete = await this.showConfirm("Eliminar Categoría", `¿Deseas eliminar la categoría "${catName}"?`, "delete", "#EF4444");
    if (confirmDelete) {
      try {
        const res = await fetch('api/leagues.php?action=delete_category', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: catId })
        });
        const data = await res.json();
        if (data.success) {
          this.showSnackbar('Categoría eliminada.');
          await this.loadLeagues();
          this.refreshCurrentView();
        } else {
          this.showAlert('Error', data.message || 'No se pudo eliminar la categoría.', 'warning', '#F59E0B');
        }
      } catch(e) {}
    }
  },

  async runSeedDemo() {
    const confirmSeed = await this.showConfirm("Cargar Demostración", "¿Deseas cargar la demostración completa con las Temporadas 2025 y 2026, 7 equipos, 73 jugadores y estadísticas reales?", "bolt", "#F59E0B");
    if (!confirmSeed) return;

    try {
      this.showSnackbar("Cargando datos de demostración...");
      const res = await fetch('api/seed_demo.php?key=lmb2026');
      const data = await res.json();
      if (data.success) {
        this.showAlert("¡Demostración Cargada!", data.message, "success", "#10B981");
        window.location.reload();
      } else {
        this.showAlert("Atención", data.message, "error", "#EF4444");
      }
    } catch(e) {
      console.error("Error al activar demo", e);
    }
  },

  async showCrownChampionModal(categoryId, categoryName) {
    try {
      const resTeams = await fetch(`api/teams.php?action=list&category_id=${categoryId}`);
      const dataTeams = await resTeams.json();
      const teams = dataTeams.teams || [];

      if (!teams.length) {
        this.showAlert("Atención", "No hay equipos registrados en esta categoría.", "warning", "#F59E0B");
        return;
      }

      let teamOptionsText = teams.map(t => `[ID ${t.id}]: ${t.name} (${t.short_name})`).join('\n');
      const teamIdInput = await this.showPrompt(`Coronar Campeón - ${categoryName}`, `Ingresa el ID del equipo Campeón:\n\n${teamOptionsText}`, teams[0].id.toString());
      if (!teamIdInput) return;

      const teamId = parseInt(teamIdInput);
      if (!teamId) return;

      const titleName = await this.showPrompt("Título del Campeón", "Nombre del título honorífico:", "Campeón Oficial");
      if (!titleName) return;

      const seasonId = this.activeSeason ? this.activeSeason.id : 1;

      const res = await fetch('api/leagues.php?action=set_champion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: seasonId,
          category_id: categoryId,
          team_id: teamId,
          title_name: titleName,
          notes: 'Coronación manual en panel administrativo'
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar(data.message || '¡Campeón registrado exitosamente!');
        this.refreshCurrentView();
      } else {
        this.showAlert('Error', data.message || 'No se pudo registrar el campeón.', 'error', '#EF4444');
      }
    } catch(e) {
      console.error("Error al coronar campeón", e);
    }
  },

  // STADIUM CRUD
  async showEditStadiumModal(stadiumId, currentName, currentAddress) {
    const name = await this.showPrompt("Editar Sede Deportiva", "Nombre de la sede:", currentName);
    if (!name) return;
    const address = await this.showPrompt("Editar Ubicación", "Dirección / Cancha:", currentAddress || '');

    try {
      const res = await fetch('api/leagues.php?action=update_stadium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stadiumId, name, address })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar('Sede actualizada.');
        this.refreshCurrentView();
      }
    } catch(e) {}
  },

  async deleteStadium(stadiumId, stadiumName) {
    const confirmDelete = await this.showConfirm("Eliminar Sede", `¿Deseas eliminar la sede "${stadiumName}"?`, "delete", "#EF4444");
    if (confirmDelete) {
      try {
        const res = await fetch('api/leagues.php?action=delete_stadium', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: stadiumId })
        });
        const data = await res.json();
        if (data.success) {
          this.showSnackbar('Sede eliminada.');
          this.refreshCurrentView();
        }
      } catch(e) {}
    }
  },

  // TEAM CRUD & MODALS
  async showEditTeamModal(teamId, currentName = '', currentShort = '', currentStadiumId = 0, currentCategoryId = 0) {
    try {
      document.getElementById('edit-team-id').value = teamId;
      document.getElementById('edit-team-name').value = currentName || '';
      document.getElementById('edit-team-short').value = currentShort || '';

      let categories = [];
      let stadia = [];
      let team = { name: currentName, short_name: currentShort, category_id: currentCategoryId, home_stadium_id: currentStadiumId };

      try {
        const resCat = await fetch('api/leagues.php?action=categories');
        if (resCat.ok) {
          const dataCat = await resCat.json();
          categories = dataCat.categories || [];
        }
      } catch (e) {
        console.warn("Could not fetch categories list", e);
      }

      try {
        const resStadia = await fetch('api/leagues.php?action=stadiums');
        if (resStadia.ok) {
          const dataStadia = await resStadia.json();
          stadia = dataStadia.stadiums || [];
        }
      } catch (e) {
        console.warn("Could not fetch stadiums list", e);
      }

      try {
        const resDetail = await fetch(`api/teams.php?action=detail&id=${teamId}`);
        if (resDetail.ok) {
          const dataDetail = await resDetail.json();
          if (dataDetail.success && dataDetail.team) {
            team = dataDetail.team;
          }
        }
      } catch (e) {
        console.warn("Could not fetch team detail", e);
      }

      document.getElementById('edit-team-name').value = team.name || currentName || '';
      document.getElementById('edit-team-short').value = team.short_name || currentShort || '';
      document.getElementById('edit-team-color1').value = team.color_primary || '#0A192F';
      document.getElementById('edit-team-color2').value = team.color_secondary || '#D32F2F';

      const catSelect = document.getElementById('edit-team-category');
      if (catSelect) {
        catSelect.innerHTML = `<option value="0">Sin Asignación (Orfano)</option>` + 
          categories.map(c => `<option value="${c.id}" ${c.id == (team.category_id || currentCategoryId) ? 'selected' : ''}>${c.name} (${c.code || ''})</option>`).join('');
      }

      const stadSelect = document.getElementById('edit-team-stadium');
      if (stadSelect) {
        stadSelect.innerHTML = `<option value="0">Sin Sede Fija (Neutral)</option>` + 
          stadia.map(s => `<option value="${s.id}" ${s.id == (team.home_stadium_id || currentStadiumId) ? 'selected' : ''}>${s.name} (${s.field_name || 'Principal'})</option>`).join('');
      }

      const modal = document.getElementById('edit-team-modal');
      if (modal) modal.classList.add('open');
    } catch(e) {
      console.error("Error al abrir modal de edición de equipo", e);
      this.showAlert("Atención", "Ocurrió un inconveniente al cargar el equipo.", "warning", "#F59E0B");
    }
  },

  closeEditTeamModal() {
    const modal = document.getElementById('edit-team-modal');
    if (modal) modal.classList.remove('open');
  },

  async handleSaveTeamEdit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-team-id').value;
    const name = document.getElementById('edit-team-name').value;
    const short_name = document.getElementById('edit-team-short').value;
    const category_id = document.getElementById('edit-team-category').value;
    const home_stadium_id = document.getElementById('edit-team-stadium').value;
    const color_primary = document.getElementById('edit-team-color1').value;
    const color_secondary = document.getElementById('edit-team-color2').value;

    try {
      const res = await fetch('api/teams.php?action=update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, short_name, category_id, home_stadium_id, color_primary, color_secondary })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar(data.message || 'Equipo actualizado.');
        this.closeEditTeamModal();
        this.refreshCurrentView();
      } else {
        this.showAlert("Error", data.message || 'No se pudo actualizar.', "error", "#EF4444");
      }
    } catch(e) {
      console.error("Error al guardar edición de equipo", e);
    }
  },

  async deleteTeam(teamId, teamName) {
    const confirmDelete = await this.showConfirm("Eliminar Equipo", `¿Deseas eliminar definitivamente el equipo "${teamName}"?`, "delete", "#EF4444");
    if (confirmDelete) {
      try {
        const res = await fetch('api/teams.php?action=delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: teamId })
        });
        const data = await res.json();
        if (data.success) {
          this.showSnackbar('Equipo eliminado.');
          this.refreshCurrentView();
        }
      } catch(e) {}
    }
  },

  // PLAYER CRUD
  async showEditPlayerModal(playerId, currentFirst, currentLast, currentJersey, currentPos) {
    const firstName = await this.showPrompt("Editar Jugador", "Nombre:", currentFirst);
    if (!firstName) return;
    const lastName = await this.showPrompt("Editar Apellido", "Apellido:", currentLast);
    if (!lastName) return;
    const jersey = await this.showPrompt("Número de Camiseta", "Número (#):", (currentJersey || 10).toString());

    try {
      const res = await fetch('api/players.php?action=update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: playerId,
          first_name: firstName,
          last_name: lastName,
          jersey_number: parseInt(jersey || currentJersey),
          position_primary: currentPos || 'OF'
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar('Jugador actualizado.');
        this.refreshCurrentView();
      }
    } catch(e) {}
  },

  async deletePlayer(playerId, playerName) {
    const confirmDelete = await this.showConfirm("Dar de Baja Jugador", `¿Deseas eliminar a "${playerName}" del plantel?`, "delete", "#EF4444");
    if (confirmDelete) {
      try {
        const res = await fetch('api/players.php?action=delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: playerId })
        });
        const data = await res.json();
        if (data.success) {
          this.showSnackbar('Jugador dado de baja.');
          this.refreshCurrentView();
        }
      } catch(e) {}
    }
  },

  async reassignTeamModal(teamId, teamName) {
    if (!this.categories.length) {
      this.showAlert('Atención', 'Primero debes crear al menos una categoría.', 'warning', '#F59E0B');
      return;
    }
    const catOptions = this.categories.map(c => `${c.id}: ${c.name}`).join('\n');
    const input = await this.showPrompt("Asignar Categoría a " + teamName, "Ingresa el ID de la Categoría:\n" + catOptions);
    if (!input) return;
    const categoryId = parseInt(input);

    try {
      const res = await fetch('api/leagues.php?action=reassign_team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, category_id: categoryId })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar('Equipo reasignado exitosamente.');
        this.refreshCurrentView();
      } else {
        this.showAlert('Error', data.message || 'No se pudo reasignar.', 'error', '#EF4444');
      }
    } catch(e) {}
  },

  async reassignPlayerModal(playerId, playerName) {
    const res = await fetch('api/teams.php?action=list');
    const data = await res.json();
    const teams = data.teams || [];
    if (!teams.length) {
      this.showAlert('Atención', 'Primero debes registrar al menos un equipo.', 'warning', '#F59E0B');
      return;
    }
    const teamOptions = teams.map(t => `${t.id}: ${t.name} (${t.category_name})`).join('\n');
    const input = await this.showPrompt("Asignar Equipo a " + playerName, "Ingresa el ID del Equipo:\n" + teamOptions);
    if (!input) return;
    const teamId = parseInt(input);

    try {
      const res = await fetch('api/leagues.php?action=reassign_player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, team_id: teamId })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar('Jugador asignado al equipo.');
        this.refreshCurrentView();
      } else {
        this.showAlert('Error', data.message || 'No se pudo asignar.', 'error', '#EF4444');
      }
    } catch(e) {}
  },

  async showCreateStageModal() {
    const name = await this.showPrompt("Nueva Etapa / Tipo de Partido", "Nombre de la etapa (Ej. 8vos de Final, Comodín, Amistoso Internacional):");
    if (!name) return;

    try {
      const res = await fetch('api/leagues.php?action=create_stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        this.showSnackbar('Etapa creada exitosamente.');
        this.refreshCurrentView();
      } else {
        this.showAlert('Error', data.message || 'No se pudo crear.', 'error', '#EF4444');
      }
    } catch(e) {}
  },

  async deleteStage(stageId, stageName) {
    const confirmDelete = await this.showConfirm("Eliminar Etapa", `¿Deseas eliminar la etapa "${stageName}"?`, "delete", "#EF4444");
    if (confirmDelete) {
      try {
        const res = await fetch('api/leagues.php?action=delete_stage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: stageId })
        });
        const data = await res.json();
        if (data.success) {
          this.showSnackbar('Etapa eliminada.');
          this.refreshCurrentView();
        }
      } catch(e) {}
    }
  },

  setupEventListeners() {}

};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

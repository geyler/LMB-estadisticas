/**
 * Main Single-Page Application (SPA) Engine for Liga Metropolitana de Béisbol (LMB)
 * Controls navigation, views, API requests, dynamic statistics renderers & modals
 */

const App = {
  currentView: 'home',
  currentCategory: 0,
  currentUser: null,
  activeSeason: null,
  categories: [],
  settings: { site_name: 'LMB BÉISBOL', site_logo: 'assets/images/lmb_logo.png' },

  async init() {
    await this.loadSettings();
    await this.checkAuth();
    await this.loadLeagues();
    this.setupEventListeners();
    this.showView('home');
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
    if (titleEl && this.settings.site_name) {
      titleEl.innerText = this.settings.site_name;
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
      const roleTag = this.currentUser.role === 'super_admin' ? 'SUPER ADMIN' : this.currentUser.role.toUpperCase();
      userBtn.innerHTML = `<span class="material-icons-round">account_circle</span> ${this.currentUser.name} (${roleTag})`;
      userBtn.onclick = () => this.showUserModal();
    } else {
      userBtn.innerHTML = `<span class="material-icons-round">login</span> Acceder`;
      userBtn.onclick = () => this.showAuthChoiceModal();
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

  // 1. HOME LANDING VIEW
  async renderHomeView(container) {
    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando Liga Metropolitana...</div></div>`;

    try {
      const [resGames, resLeaders] = await Promise.all([
        fetch(`api/games.php?action=list&category_id=${this.currentCategory}`),
        fetch(`api/leaderboards.php?type=batting&stat=avg&category_id=${this.currentCategory}&limit=5`)
      ]);
      const dataGames = await resGames.json();
      const dataLeaders = await resLeaders.json();

      const games = dataGames.games || [];
      const leaders = dataLeaders.leaders || [];

      this.renderScorebugCarousel(games);

      let html = `
        <div class="view-content">
          <!-- Banner LMB -->
          <div class="md-card" style="background: linear-gradient(135deg, #0A192F 0%, #1E3A8A 100%); text-align:center; position:relative; overflow:hidden;">
            <div style="font-size:0.75rem; font-weight:700; color:#FFC107; text-transform:uppercase; letter-spacing:1px;">LIGA METROPOLITANA DE BÉISBOL</div>
            <h2 style="font-size:1.4rem; font-weight:800; color:#FFFFFF; margin:4px 0;">${this.settings.site_name || 'Buenos Aires'} - ${this.activeSeason ? this.activeSeason.name : '2026'}</h2>
            <p style="font-size:0.8rem; color:#94A3B8;">Estadísticas oficiales en vivo, sedes deportivas y seguimiento de partidos.</p>
          </div>

          <!-- Section: Live / Recent Matches -->
          <div class="view-section">
            <div class="section-header">
              <h3 class="section-title"><span class="material-icons-round" style="color:#D32F2F;">sports_baseball</span> Partidos Destacados</h3>
              <button class="md-btn md-btn-outlined" style="padding:4px 12px; font-size:0.75rem;" onclick="App.showView('calendar')">Ver Todos</button>
            </div>

            ${games.length ? games.slice(0, 3).map(g => `
              <div class="md-card md-card-interactive" onclick="App.showView('game_detail', ${g.id})">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#94A3B8;">
                  <span>${g.category_name} • 📍 ${g.stadium_name || g.field_location}</span>
                  <span class="md-chip ${g.status === 'live' ? 'active' : ''}" style="padding:2px 8px; font-size:0.65rem;">
                    ${g.status === 'live' ? '🔴 EN VIVO' : (g.status === 'finished' ? 'FINAL' : 'PROGRAMADO')}
                  </span>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <img src="${g.away_logo || 'assets/images/lmb_logo.png'}" style="width:32px; height:32px; border-radius:50%;">
                    <div style="font-weight:700; font-size:0.95rem;">${g.away_team_name}</div>
                  </div>
                  <div style="font-size:1.3rem; font-weight:800; color:#FFC107;">${g.status !== 'scheduled' ? g.away_score : '-'}</div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <img src="${g.home_logo || 'assets/images/lmb_logo.png'}" style="width:32px; height:32px; border-radius:50%;">
                    <div style="font-weight:700; font-size:0.95rem;">${g.home_team_name}</div>
                  </div>
                  <div style="font-size:1.3rem; font-weight:800; color:#FFC107;">${g.status !== 'scheduled' ? g.home_score : '-'}</div>
                </div>
              </div>
            `).join('') : '<div class="md-card">No hay partidos registrados.</div>'}
          </div>

          <!-- Section: Top Leaders Preview -->
          <div class="view-section">
            <div class="section-header">
              <h3 class="section-title"><span class="material-icons-round" style="color:#FFC107;">emoji_events</span> Líderes en Bateo (AVG)</h3>
              <button class="md-btn md-btn-outlined" style="padding:4px 12px; font-size:0.75rem;" onclick="App.showView('leaders')">Ver Departamentos</button>
            </div>

            <div class="md-table-wrapper">
              <table class="md-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jugador</th>
                    <th>Equipo</th>
                    <th>AB</th>
                    <th>H</th>
                    <th>HR</th>
                    <th>AVG</th>
                  </tr>
                </thead>
                <tbody>
                  ${leaders.length ? leaders.map((p, idx) => `
                    <tr onclick="App.showView('player_detail', ${p.player_id})" style="cursor:pointer;">
                      <td style="font-weight:700; color:#94A3B8;">${idx + 1}</td>
                      <td style="font-weight:700;">#${p.jersey_number} ${p.first_name} ${p.last_name}</td>
                      <td><span class="md-chip" style="padding:2px 6px; font-size:0.65rem;">${p.team_short}</span></td>
                      <td>${p.ab}</td>
                      <td>${p.h}</td>
                      <td>${p.hr}</td>
                      <td class="highlight-val">${p.avg}</td>
                    </tr>
                  `).join('') : '<tr><td colspan="7">No hay datos suficientes aún.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = `<div class="view-content">Error al cargar la página de inicio.</div>`;
    }
  },

  renderScorebugCarousel(games) {
    const scorebug = document.getElementById('scorebug-carousel');
    if (!scorebug) return;

    if (!games || !games.length) {
      scorebug.innerHTML = `<div style="padding:4px 12px; font-size:0.75rem; color:#94A3B8;">Liga Metropolitana de Béisbol - Sin partidos activos</div>`;
      return;
    }

    scorebug.innerHTML = games.map(g => `
      <div class="scorebug-card ${g.status === 'live' ? 'live' : ''}" onclick="App.showView('game_detail', ${g.id})">
        <div class="scorebug-status">
          <span>${g.category_code}</span>
          ${g.status === 'live' ? '<span class="live-tag">● EN VIVO</span>' : (g.status === 'finished' ? 'FINAL' : 'PROX')}
        </div>
        <div class="scorebug-team-row">
          <div class="scorebug-team-name">
            <img src="${g.away_logo || 'assets/images/lmb_logo.png'}" class="scorebug-logo">
            <span>${g.away_short}</span>
          </div>
          <div class="scorebug-score">${g.status !== 'scheduled' ? g.away_score : '-'}</div>
        </div>
        <div class="scorebug-team-row">
          <div class="scorebug-team-name">
            <img src="${g.home_logo || 'assets/images/lmb_logo.png'}" class="scorebug-logo">
            <span>${g.home_short}</span>
          </div>
          <div class="scorebug-score">${g.status !== 'scheduled' ? g.home_score : '-'}</div>
        </div>
      </div>
    `).join('');
  },

  // 2. CALENDAR & SCHEDULE VIEW WITH SEDES
  async renderCalendarView(container) {
    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando calendario...</div></div>`;

    const res = await fetch(`api/games.php?action=list&category_id=${this.currentCategory}`);
    const data = await res.json();
    const games = data.games || [];

    let html = `
      <div class="view-content">
        <div class="section-header">
          <h2 class="section-title"><span class="material-icons-round" style="color:#2563EB;">calendar_month</span> Calendario y Sedes</h2>
          ${(this.currentUser && ['super_admin', 'admin', 'scorekeeper', 'team_admin'].includes(this.currentUser.role)) ? 
            `<button class="md-btn md-btn-primary" style="padding:6px 14px; font-size:0.8rem;" onclick="App.showCreateGameModal()">➕ Programar Partido</button>` : ''}
        </div>

        ${games.length ? games.map(g => `
          <div class="md-card md-card-interactive" onclick="App.showView('game_detail', ${g.id})">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#94A3B8;">
              <span>${g.category_name} • ${new Date(g.game_date).toLocaleDateString('es-AR')}</span>
              <span class="md-chip ${g.status === 'live' ? 'active' : ''}">${g.status === 'live' ? '🔴 EN VIVO' : (g.status === 'finished' ? 'FINAL' : 'PROGRAMADO')}</span>
            </div>

            <div style="display:flex; justify-content:space-around; align-items:center; margin:12px 0;">
              <div style="text-align:center;">
                <img src="${g.away_logo || 'assets/images/lmb_logo.png'}" style="width:40px; height:40px; border-radius:50%;">
                <div style="font-weight:800; font-size:1rem; margin-top:4px;">${g.away_team_name}</div>
                <div style="font-size:1.6rem; font-weight:800; color:#FFC107;">${g.status !== 'scheduled' ? g.away_score : '-'}</div>
              </div>
              <div style="font-size:1.1rem; font-weight:800; color:#64748B;">VS</div>
              <div style="text-align:center;">
                <img src="${g.home_logo || 'assets/images/lmb_logo.png'}" style="width:40px; height:40px; border-radius:50%;">
                <div style="font-weight:800; font-size:1rem; margin-top:4px;">${g.home_team_name}</div>
                <div style="font-size:1.6rem; font-weight:800; color:#FFC107;">${g.status !== 'scheduled' ? g.home_score : '-'}</div>
              </div>
            </div>

            <div style="font-size:0.75rem; color:#94A3B8; text-align:center;">📍 Sede: ${g.stadium_name || g.field_location}</div>
          </div>
        `).join('') : '<div class="md-card">No hay partidos programados en esta categoría.</div>'}
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
        <div class="md-card" style="background: linear-gradient(135deg, #0A192F 0%, #1E3A8A 100%); text-align:center;">
          <div style="font-size:0.75rem; color:#FFC107; font-weight:700;">${g.category_name} • 📍 ${g.stadium_name || g.field_location}</div>

          <div style="display:flex; justify-content:space-around; align-items:center; margin:16px 0;">
            <div style="text-align:center;" onclick="App.showView('team_detail', ${g.away_team_id})">
              <img src="${g.away_logo || 'assets/images/lmb_logo.png'}" style="width:50px; height:50px; border-radius:50%;">
              <div style="font-weight:800; font-size:1.1rem; margin-top:4px;">${g.away_short}</div>
              <div style="font-size:2.2rem; font-weight:800; color:#FFFFFF;">${g.away_score}</div>
            </div>

            <div>
              <span class="md-chip ${g.status === 'live' ? 'active' : ''}">${g.status === 'live' ? '🔴 EN VIVO' : 'FINAL'}</span>
            </div>

            <div style="text-align:center;" onclick="App.showView('team_detail', ${g.home_team_id})">
              <img src="${g.home_logo || 'assets/images/lmb_logo.png'}" style="width:50px; height:50px; border-radius:50%;">
              <div style="font-weight:800; font-size:1.1rem; margin-top:4px;">${g.home_short}</div>
              <div style="font-size:2.2rem; font-weight:800; color:#FFFFFF;">${g.home_score}</div>
            </div>
          </div>

          ${canEdit ? `
            <button class="md-btn md-btn-gold" style="width:100%; margin-top:8px;" onclick="LiveScorer.init(${JSON.stringify(data).replace(/"/g, '&quot;')})">
              ⚾ Ir al Anotador en Vivo (Momento a Momento)
            </button>
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
          <div style="font-weight:700; color:#FFC107; margin-bottom:4px;">Visitante: ${g.away_team_name}</div>
          <div class="md-table-wrapper">
            <table class="md-table">
              <thead>
                <tr><th>Bateador</th><th>AB</th><th>C</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>CI</th><th>BB</th><th>SO</th></tr>
              </thead>
              <tbody>
                ${aBat.length ? aBat.map(b => `
                  <tr onclick="App.showView('player_detail', ${b.player_id})" style="cursor:pointer;">
                    <td style="font-weight:700;">#${b.jersey_number} ${b.first_name} ${b.last_name} (${b.position})</td>
                    <td>${b.ab}</td><td>${b.r}</td><td class="highlight-val">${b.h}</td>
                    <td>${b.doubles}</td><td>${b.triples}</td><td>${b.hr}</td><td>${b.rbi}</td><td>${b.bb}</td><td>${b.so}</td>
                  </tr>
                `).join('') : '<tr><td colspan="10">Sin turnos al bate registrados.</td></tr>'}
              </tbody>
            </table>
          </div>

          <div style="font-weight:700; color:#FFC107; margin-top:12px; margin-bottom:4px;">Local: ${g.home_team_name}</div>
          <div class="md-table-wrapper">
            <table class="md-table">
              <thead>
                <tr><th>Bateador</th><th>AB</th><th>C</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>CI</th><th>BB</th><th>SO</th></tr>
              </thead>
              <tbody>
                ${hBat.length ? hBat.map(b => `
                  <tr onclick="App.showView('player_detail', ${b.player_id})" style="cursor:pointer;">
                    <td style="font-weight:700;">#${b.jersey_number} ${b.first_name} ${b.last_name} (${b.position})</td>
                    <td>${b.ab}</td><td>${b.r}</td><td class="highlight-val">${b.h}</td>
                    <td>${b.doubles}</td><td>${b.triples}</td><td>${b.hr}</td><td>${b.rbi}</td><td>${b.bb}</td><td>${b.so}</td>
                  </tr>
                `).join('') : '<tr><td colspan="10">Sin turnos al bate registrados.</td></tr>'}
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
                <div style="font-size:0.75rem; font-weight:700; color:#FFC107;">
                  ${p.half_inning === 'top' ? '▲' : '▼'} Inning ${p.inning} • Outs: ${p.outs_before}
                </div>
                <div style="font-size:0.9rem; font-weight:600; color:#FFFFFF; margin-top:2px;">
                  ${p.description}
                </div>
              </div>
            `).join('') : '<div>No hay jugadas registradas en el historial.</div>'}
          </div>
        </div>

        <!-- Postcards Gallery (Max 10) -->
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
          <h2 class="section-title"><span class="material-icons-round" style="color:#FFC107;">groups</span> Equipos de la Liga</h2>
          ${canCreate ? `<button class="md-btn md-btn-primary" style="padding:6px 14px; font-size:0.8rem;" onclick="App.showCreateTeamModal()">➕ Crear Equipo</button>` : ''}
        </div>

        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">
          ${teams.length ? teams.map(t => `
            <div class="md-card md-card-interactive" onclick="App.showView('team_detail', ${t.id})" style="text-align:center; align-items:center;">
              <img src="${t.logo_url || 'assets/images/lmb_logo.png'}" style="width:60px; height:60px; border-radius:50%; border:2px solid ${t.color_primary};">
              <div style="font-weight:800; font-size:0.95rem; margin-top:4px;">${t.name}</div>
              <span class="md-chip" style="padding:2px 8px; font-size:0.65rem;">${t.category_name}</span>
            </div>
          `).join('') : '<div style="grid-column:span 2;">No hay equipos creados en esta división.</div>'}
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  // 5. TEAM DETAIL VIEW (ROSTER & PERMISSION ENFORCED)
  async renderTeamDetailView(container, teamId) {
    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando plantel del equipo...</div></div>`;

    const res = await fetch(`api/teams.php?action=detail&id=${teamId}`);
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<div class="view-content">Equipo no encontrado.</div>`;
      return;
    }

    const t = data.team;
    const players = data.players || [];
    const stats = t.stats || {};

    const isAuthorizedForTeam = (this.currentUser && (
      ['super_admin', 'admin'].includes(this.currentUser.role) ||
      (this.currentUser.role === 'team_admin' && this.currentUser.assigned_team_id == t.id)
    ));

    let html = `
      <div class="view-content">
        <div class="md-card" style="background: linear-gradient(135deg, ${t.color_primary} 0%, #0A192F 100%); text-align:center; align-items:center;">
          <img src="${t.logo_url || 'assets/images/lmb_logo.png'}" style="width:70px; height:70px; border-radius:50%; border:3px solid #FFC107;">
          <h2 style="font-size:1.4rem; font-weight:800; color:#FFFFFF; margin-top:6px;">${t.name}</h2>
          <span class="md-chip active">${t.category_name} • Est. ${t.foundation_year}</span>

          ${isAuthorizedForTeam ? `
            <button class="md-btn md-btn-outlined" style="padding:4px 12px; font-size:0.75rem; margin-top:8px;" onclick="App.uploadTeamLogo(${t.id})">📷 Cambiar Logo de Equipo</button>
          ` : ''}

          <div style="display:flex; justify-content:space-around; width:100%; margin-top:16px; border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;">
            <div><div style="font-size:0.75rem; color:#94A3B8;">PJ</div><div style="font-size:1.2rem; font-weight:800;">${stats.games_played}</div></div>
            <div><div style="font-size:0.75rem; color:#94A3B8;">PG</div><div style="font-size:1.2rem; font-weight:800; color:#10B981;">${stats.wins}</div></div>
            <div><div style="font-size:0.75rem; color:#94A3B8;">PP</div><div style="font-size:1.2rem; font-weight:800; color:#EF4444;">${stats.losses}</div></div>
            <div><div style="font-size:0.75rem; color:#94A3B8;">PCT</div><div style="font-size:1.2rem; font-weight:800; color:#FFC107;">${stats.pct}</div></div>
          </div>
        </div>

        <div class="view-section">
          <div class="section-header">
            <h3 class="section-title">Plantel de Jugadores (Roster)</h3>
            ${isAuthorizedForTeam ? `
              <button class="md-btn md-btn-primary" style="padding:4px 12px; font-size:0.75rem;" onclick="App.showCreatePlayerModal(${t.id})">➕ Registrar Jugador</button>
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
                </tr>
              </thead>
              <tbody>
                ${players.length ? players.map(p => `
                  <tr onclick="App.showView('player_detail', ${p.id})" style="cursor:pointer;">
                    <td style="font-weight:800; color:#FFC107;">#${p.jersey_number}</td>
                    <td style="font-weight:700;">${p.first_name} ${p.last_name}</td>
                    <td><span class="md-chip" style="padding:2px 6px; font-size:0.65rem;">${p.position_primary}</span></td>
                    <td style="font-size:0.8rem; color:#94A3B8;">B: ${p.bats} / L: ${p.throws}</td>
                  </tr>
                `).join('') : '<tr><td colspan="4">Sin jugadores registrados en el plantel.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  // 6. PLAYER DETAIL VIEW
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
    const pit = p.pitching_stats || {};

    let html = `
      <div class="view-content">
        <div class="md-card" style="background: linear-gradient(135deg, #1E3A8A 0%, #0A192F 100%); text-align:center; align-items:center;">
          <img src="${p.photo_url || 'assets/images/lmb_logo.png'}" style="width:80px; height:80px; border-radius:50%; border:3px solid #FFC107; object-fit:cover;">
          <div style="font-size:1.6rem; font-weight:800; color:#FFFFFF; margin-top:4px;">#${p.jersey_number} ${p.first_name} ${p.last_name}</div>
          <div style="font-size:0.9rem; font-weight:700; color:#FFC107;">${p.team_name} • ${p.category_name}</div>

          <div style="display:flex; gap:8px; margin-top:8px;">
            <span class="md-chip active">Pos: ${p.position_primary}</span>
            <span class="md-chip">Batea: ${p.bats === 'R' ? 'Derecho' : (p.bats === 'L' ? 'Zurdo' : 'Ambidextro')}</span>
            <span class="md-chip">Lanza: ${p.throws === 'R' ? 'Derecho' : 'Zurdo'}</span>
          </div>
        </div>

        <div class="view-section">
          <h3 class="section-title">Estadísticas de Bateo</h3>
          <div class="md-card">
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; text-align:center;">
              <div><div style="font-size:0.7rem; color:#94A3B8;">AVG</div><div style="font-size:1.3rem; font-weight:800; color:#FFC107;">${b.avg || '.000'}</div></div>
              <div><div style="font-size:0.7rem; color:#94A3B8;">HR</div><div style="font-size:1.3rem; font-weight:800;">${b.hr || 0}</div></div>
              <div><div style="font-size:0.7rem; color:#94A3B8;">CI</div><div style="font-size:1.3rem; font-weight:800;">${b.rbi || 0}</div></div>
              <div><div style="font-size:0.7rem; color:#94A3B8;">OPS</div><div style="font-size:1.3rem; font-weight:800; color:#3B82F6;">${b.ops || '.000'}</div></div>
            </div>
          </div>
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  // 7. LEADERS VIEW
  async renderLeadersView(container, type = 'batting', stat = 'avg') {
    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando líderes de estadísticas...</div></div>`;

    const res = await fetch(`api/leaderboards.php?type=${type}&stat=${stat}&category_id=${this.currentCategory}`);
    const data = await res.json();
    const leaders = data.leaders || [];

    let html = `
      <div class="view-content">
        <div class="section-header">
          <h2 class="section-title"><span class="material-icons-round" style="color:#FFC107;">military_tech</span> Líderes Departamentales</h2>
        </div>

        <div class="md-card">
          <div style="display:flex; gap:8px;">
            <button class="md-btn ${type === 'batting' ? 'md-btn-primary' : 'md-btn-outlined'}" style="flex:1;" onclick="App.renderLeadersView(document.getElementById('view-container'), 'batting', 'avg')">Bateo</button>
            <button class="md-btn ${type === 'pitching' ? 'md-btn-primary' : 'md-btn-outlined'}" style="flex:1;" onclick="App.renderLeadersView(document.getElementById('view-container'), 'pitching', 'era')">Pitcheo</button>
          </div>

          <div class="form-group" style="margin-top:8px;">
            <label>Departamento</label>
            <select class="form-control" onchange="App.renderLeadersView(document.getElementById('view-container'), '${type}', this.value)">
              ${type === 'batting' ? `
                <option value="avg" ${stat==='avg'?'selected':''}>Average de Bateo (AVG)</option>
                <option value="hr" ${stat==='hr'?'selected':''}>Jonrones (HR)</option>
                <option value="rbi" ${stat==='rbi'?'selected':''}>Carreras Impulsadas (RBI)</option>
                <option value="h" ${stat==='h'?'selected':''}>Hits Conectados (H)</option>
                <option value="ops" ${stat==='ops'?'selected':''}>OPS</option>
              ` : `
                <option value="era" ${stat==='era'?'selected':''}>Efectividad (ERA)</option>
                <option value="so" ${stat==='so'?'selected':''}>Ponches (SO)</option>
                <option value="wins" ${stat==='wins'?'selected':''}>Victorias (W)</option>
              `}
            </select>
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
                  <td style="font-weight:800; color:${idx === 0 ? '#FFC107' : '#94A3B8'};">#${idx + 1}</td>
                  <td style="font-weight:700;">#${l.jersey_number} ${l.first_name} ${l.last_name}</td>
                  <td><span class="md-chip" style="padding:2px 6px; font-size:0.65rem;">${l.team_short}</span></td>
                  <td class="highlight-val" style="font-size:1rem;">${l[stat] || l.avg || l.era}</td>
                </tr>
              `).join('') : '<tr><td colspan="4">Sin líderes en este departamento.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  // 8. ADMIN & USER ROLES CONTROL VIEW
  async renderAdminView(container) {
    if (!this.currentUser || !['super_admin', 'admin'].includes(this.currentUser.role)) {
      container.innerHTML = `<div class="view-content"><div class="md-card">Acceso denegado. Se requieren permisos de Administrador.</div></div>`;
      return;
    }

    const isSuperAdmin = (this.currentUser.role === 'super_admin');

    let html = `
      <div class="view-content">
        <div class="section-header">
          <h2 class="section-title"><span class="material-icons-round" style="color:#EF4444;">admin_panel_settings</span> Panel de Administración</h2>
        </div>

        <!-- Super Admin User Management Button -->
        ${isSuperAdmin ? `
          <div class="md-card" style="background: linear-gradient(135deg, #1E3A8A 0%, #0A192F 100%);">
            <h3 style="font-size:1rem; font-weight:800; color:#FFC107;">👥 Gestión de Usuarios y Permisos</h3>
            <p style="font-size:0.8rem; color:#94A3B8;">Busca usuarios por correo para asignar roles y vincularlos a equipos (Lanús, Berazategui, DAOM, etc.).</p>
            <button class="md-btn md-btn-gold" onclick="App.showView('users')">Gestionar Usuarios</button>
          </div>

          <div class="md-card">
            <h3 style="font-size:1rem; font-weight:800;">🎨 Branding y Personalización Web</h3>
            <div class="form-group">
              <label>Nombre de la Aplicación / Liga</label>
              <input type="text" id="setting-site-name" class="form-control" value="${this.settings.site_name || 'Liga Metropolitana de Béisbol'}">
            </div>
            <button class="md-btn md-btn-primary" onclick="App.updateSettings()">Guardar Ajustes Web</button>
          </div>
        ` : ''}

        <!-- Stadium Sedes Management -->
        <div class="md-card">
          <h3 style="font-size:1rem; font-weight:800;">📍 Sedes Deportivas (Campos de Juego)</h3>
          <p style="font-size:0.8rem; color:#94A3B8;">Registra sedes para enlazar los partidos y que nadie se pierda.</p>
          <button class="md-btn md-btn-primary" onclick="App.showCreateStadiumModal()">➕ Nueva Sede</button>
        </div>

        <!-- Ascenso y Descenso -->
        <div class="md-card">
          <h3 style="font-size:1rem; font-weight:800;">🔄 Sistema de Ascenso y Descenso</h3>
          <p style="font-size:0.8rem; color:#94A3B8;">Mueve equipos entre divisiones en cada temporada.</p>
          <button class="md-btn md-btn-gold" onclick="App.showMoveTeamModal()">Confirmar Cambio de División</button>
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  // 9. SUPER ADMIN USERS LIST & SEARCH VIEW
  async renderUsersManagementView(container) {
    if (!this.currentUser || !['super_admin', 'admin'].includes(this.currentUser.role)) {
      container.innerHTML = `<div class="view-content"><div class="md-card">Acceso restringido.</div></div>`;
      return;
    }

    container.innerHTML = `<div class="view-content"><div style="text-align:center; padding:20px;">Cargando usuarios...</div></div>`;

    const q = document.getElementById('user-search-input')?.value || '';
    const res = await fetch(`api/auth.php?action=users_list&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const users = data.users || [];

    const resTeams = await fetch('api/teams.php?action=list');
    const dataTeams = await resTeams.json();
    const teams = dataTeams.teams || [];

    let html = `
      <div class="view-content">
        <div class="section-header">
          <h2 class="section-title"><span class="material-icons-round" style="color:#FFC107;">manage_accounts</span> Usuarios de la Plataforma</h2>
          <button class="md-btn md-btn-outlined" style="padding:4px 12px; font-size:0.75rem;" onclick="App.showView('admin')">⬅️ Volver</button>
        </div>

        <!-- Search Bar -->
        <div class="md-card">
          <div class="form-group">
            <label>Buscar por correo electrónico o nombre</label>
            <input type="text" id="user-search-input" class="form-control" placeholder="Ej: correo@dominio.com..." value="${q}" oninput="App.renderUsersManagementView(document.getElementById('view-container'))">
          </div>
        </div>

        <!-- Users Table -->
        <div class="md-table-wrapper">
          <table class="md-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol Actual</th>
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
                  <td style="font-size:0.8rem; color:#FFC107;">${u.assigned_team_name || 'Ninguno (Global)'}</td>
                  <td>
                    <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.7rem;" onclick="App.showEditUserModal(${u.id}, '${u.name}', '${u.role}', ${u.assigned_team_id || 0})">✏️ Editar Permisos</button>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="4">No se encontraron usuarios.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  // AUTH MODALS & USER ACTIONS
  showAuthChoiceModal() {
    const isLogin = confirm("¿Ya tienes una cuenta? Haz clic en Aceptar para Iniciar Sesión, o Cancelar para Crear Cuenta Nueva.");
    if (isLogin) {
      this.showLoginModal();
    } else {
      this.showRegisterModal();
    }
  },

  showRegisterModal() {
    const name = prompt("Nombre completo:");
    if (!name) return;
    const email = prompt("Correo electrónico:");
    if (!email) return;
    const username = prompt("Nombre de usuario:");
    if (!username) return;
    const password = prompt("Contraseña:");
    if (!password) return;

    fetch('api/auth.php?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, username, password })
    }).then(res => res.json()).then(data => {
      alert(data.message);
      if (data.success) {
        this.currentUser = data.user;
        this.renderUserBadge();
        this.refreshCurrentView();
      }
    });
  },

  showLoginModal() {
    const username = prompt("Usuario o Correo electrónico:", "admin");
    if (!username) return;
    const password = prompt("Contraseña:", "admin123");
    if (!password) return;

    fetch('api/auth.php?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(res => res.json()).then(data => {
      if (data.success) {
        this.currentUser = data.user;
        this.renderUserBadge();
        this.showSnackbar(`Bienvenido, ${data.user.name}`);
        this.refreshCurrentView();
      } else {
        alert(data.message);
      }
    });
  },

  showUserModal() {
    if (confirm(`Sesión iniciada como ${this.currentUser.name} (${this.currentUser.role}). ¿Cerrar sesión?`)) {
      fetch('api/auth.php?action=logout').then(() => {
        this.currentUser = null;
        this.renderUserBadge();
        this.refreshCurrentView();
      });
    }
  },

  showEditUserModal(userId, userName, currentRole, currentTeamId) {
    const newRole = prompt(`Editar Rol para ${userName}:\n(super_admin, admin, team_admin, scorekeeper, viewer)`, currentRole);
    if (!newRole) return;

    fetch('api/teams.php?action=list').then(res => res.json()).then(data => {
      const teams = data.teams || [];
      let teamPrompt = `Seleccionar Equipo Asignado (0 = Ninguno/Global):\n0: Ninguno\n`;
      teams.forEach(t => { teamPrompt += `${t.id}: ${t.name}\n`; });

      const assignedTeamId = prompt(teamPrompt, currentTeamId);

      fetch('api/auth.php?action=user_update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: newRole, assigned_team_id: assignedTeamId })
      }).then(res => res.json()).then(resData => {
        alert(resData.message);
        this.renderUsersManagementView(document.getElementById('view-container'));
      });
    });
  },

  showCreateStadiumModal() {
    const name = prompt("Nombre de la Sede Deportiva / Campo:");
    if (!name) return;
    const address = prompt("Dirección de la Sede:");
    const city = prompt("Ciudad:", "Buenos Aires");

    fetch('api/leagues.php?action=create_stadium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address, city })
    }).then(res => res.json()).then(data => {
      alert(data.message);
    });
  },

  async showCreateGameModal() {
    const catId = this.currentCategory || (this.categories[0] ? this.categories[0].id : 1);
    const [resTeams, resStadia] = await Promise.all([
      fetch(`api/teams.php?action=list&category_id=${catId}`),
      fetch(`api/leagues.php?action=stadiums`)
    ]);
    const dataTeams = await resTeams.json();
    const dataStadia = await resStadia.json();

    const teams = dataTeams.teams || [];
    const stadia = dataStadia.stadiums || [];

    if (teams.length < 2) return alert("Se requieren al menos 2 equipos en la categoría.");

    const awayId = prompt(`Seleccione ID Equipo Visitante:\n` + teams.map(t => `${t.id}: ${t.name}`).join('\n'), teams[0].id);
    const homeId = prompt(`Seleccione ID Equipo Local:\n` + teams.map(t => `${t.id}: ${t.name}`).join('\n'), teams[1] ? teams[1].id : teams[0].id);
    const stadiumId = prompt(`Seleccione ID Sede Deportiva:\n` + stadia.map(s => `${s.id}: ${s.name}`).join('\n'), stadia[0] ? stadia[0].id : 1);

    if (homeId && awayId) {
      fetch('api/games.php?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: catId,
          home_team_id: homeId,
          away_team_id: awayId,
          stadium_id: stadiumId,
          game_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
        })
      }).then(res => res.json()).then(resData => {
        alert(resData.message);
        this.showView('calendar');
      });
    }
  },

  updateSettings() {
    const siteName = document.getElementById('setting-site-name')?.value;
    fetch('api/auth.php?action=settings_update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_name: siteName })
    }).then(res => res.json()).then(data => {
      alert(data.message);
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
        alert(data.message);
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

  setupEventListeners() {}
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

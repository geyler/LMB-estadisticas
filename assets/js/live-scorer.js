/**
 * Live Match Scorekeeper Engine ("En Partido" / "Piloto Automático")
 * Liga Metropolitana de Béisbol (LMB)
 * Automated Lineup Rotation, Real-Time Score Sync & Offline Queue Resilience
 */

const LiveScorer = {
  game: null,
  homeBatters: [],
  awayBatters: [],
  homePitchers: [],
  awayPitchers: [],

  awayLineupIndex: 0,
  homeLineupIndex: 0,

  activeBatterId: null,
  activePitcherId: null,
  outsCount: 0,

  baseRunners: { b1: false, b2: false, b3: false },
  isSyncing: false,
  autoSyncTimer: null,

  init(gameDetailData) {
    this.game = gameDetailData.game;
    this.homeRoster = gameDetailData.home_roster || [];
    this.awayRoster = gameDetailData.away_roster || [];

    let homeActive = this.homeRoster.filter(p => !p.role_type || p.role_type === 'player' || p.role_type === 'jugador');
    if (!homeActive.length && this.homeRoster.length) homeActive = this.homeRoster;

    let awayActive = this.awayRoster.filter(p => !p.role_type || p.role_type === 'player' || p.role_type === 'jugador');
    if (!awayActive.length && this.awayRoster.length) awayActive = this.awayRoster;

    if (!gameDetailData.home_batters || gameDetailData.home_batters.length === 0) {
      this.homeBatters = homeActive.map((p, idx) => ({
        player_id: p.player_id || p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        jersey_number: p.jersey_number,
        bats: p.bats,
        batting_order: idx + 1
      }));
    } else {
      this.homeBatters = gameDetailData.home_batters.map(p => ({
        ...p,
        player_id: p.player_id || p.id
      }));
    }

    if (!gameDetailData.away_batters || gameDetailData.away_batters.length === 0) {
      this.awayBatters = awayActive.map((p, idx) => ({
        player_id: p.player_id || p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        jersey_number: p.jersey_number,
        bats: p.bats,
        batting_order: idx + 1
      }));
    } else {
      this.awayBatters = gameDetailData.away_batters.map(p => ({
        ...p,
        player_id: p.player_id || p.id
      }));
    }

    if (!gameDetailData.home_pitchers || gameDetailData.home_pitchers.length === 0) {
      this.homePitchers = homeActive.map(p => ({
        player_id: p.player_id || p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        jersey_number: p.jersey_number
      }));
    } else {
      this.homePitchers = gameDetailData.home_pitchers.map(p => ({
        ...p,
        player_id: p.player_id || p.id
      }));
    }

    if (!gameDetailData.away_pitchers || gameDetailData.away_pitchers.length === 0) {
      this.awayPitchers = awayActive.map(p => ({
        player_id: p.player_id || p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        jersey_number: p.jersey_number
      }));
    } else {
      this.awayPitchers = gameDetailData.away_pitchers.map(p => ({
        ...p,
        player_id: p.player_id || p.id
      }));
    }

    if (this.homeBatters.length === 0 || this.awayBatters.length === 0) {
      const container = document.getElementById('view-container');
      if (container) {
        container.innerHTML = `
          <div class="view-content">
            <div class="md-card" style="background:#FFFFFF; border:1px solid #DADCE0; text-align:center;">
              <div style="font-size:2.5rem; margin-bottom:8px;">⚠️</div>
              <h2 style="font-size:1.3rem; font-weight:800; color:#202124; margin:0;">Plantel Sin Jugadores Registrados</h2>
              <p style="font-size:0.85rem; color:#5F6368; margin-top:8px;">
                Para poder iniciar la consola de anotación en vivo, debes registrar al menos un jugador activo en el plantel de cada club.<br><br>
                • <strong>${this.game.away_short}</strong>: ${this.awayBatters.length} jugadores<br>
                • <strong>${this.game.home_short}</strong>: ${this.homeBatters.length} jugadores
              </p>
              <div style="display:flex; gap:10px; justify-content:center; margin-top:16px; flex-wrap:wrap;">
                <button class="md-btn md-btn-primary" onclick="App.showView('team_detail', ${this.game.away_team_id})">👥 Plantel ${this.game.away_short}</button>
                <button class="md-btn md-btn-primary" onclick="App.showView('team_detail', ${this.game.home_team_id})">👥 Plantel ${this.game.home_short}</button>
                <button class="md-btn md-btn-outlined" onclick="App.showView('onboarding')">📖 Guía de Inicio</button>
              </div>
            </div>
          </div>
        `;
      }
      return;
    }

    this.outsCount = 0;
    this.awayLineupIndex = 0;
    this.homeLineupIndex = 0;
    this.baseRunners = { b1: false, b2: false, b3: false };

    this.autoSelectActivePlayers();
    this.renderScorerInterface();

    // Start auto-sync loop for offline queue
    if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);
    this.autoSyncTimer = setInterval(() => this.processOfflineQueue(), 4000);
    window.addEventListener('online', () => this.processOfflineQueue());
    this.processOfflineQueue();
  },

  // --- OFFLINE QUEUE MANAGEMENT (Resilience on High Latency / Connection Loss) ---
  async sendDirectPlay(payload) {
    try {
      const res = await fetch('api/live_score.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) {
        App.showAlert("Error al Anotar", data.message || "No se pudo guardar la jugada en el servidor.", "error", "#EF4444");
        return false;
      }
      return true;
    } catch(err) {
      console.error("Error de red enviando jugada al servidor", err);
      App.showAlert("Error de Conexión", "No se pudo conectar con el servidor. Verifica tu conexión a internet para continuar guardando en vivo.", "wifi_off", "#EF4444");
      return false;
    }
  },

  toggleRunner(base) {
    this.baseRunners[base] = !this.baseRunners[base];
    this.renderScorerInterface();
  },

  clearRunners() {
    this.baseRunners = { b1: false, b2: false, b3: false };
    this.renderScorerInterface();
  },

  autoSelectActivePlayers() {
    const isTop = this.game.half_inning === 'top';
    const battingList = isTop ? this.awayBatters : this.homeBatters;
    const pitchingList = isTop ? this.homePitchers : this.awayPitchers;
    const activeIndex = isTop ? this.awayLineupIndex : this.homeLineupIndex;

    if (battingList.length > 0) {
      this.activeBatterId = battingList[activeIndex % battingList.length].player_id;
    } else {
      this.activeBatterId = null;
    }

    if (pitchingList.length > 0) {
      this.activePitcherId = pitchingList[0].player_id;
    } else {
      this.activePitcherId = null;
    }
  },

  advanceBatterLineup() {
    if (this.game.half_inning === 'top') {
      if (this.awayBatters.length > 0) {
        this.awayLineupIndex = (this.awayLineupIndex + 1) % this.awayBatters.length;
      }
    } else {
      if (this.homeBatters.length > 0) {
        this.homeLineupIndex = (this.homeLineupIndex + 1) % this.homeBatters.length;
      }
    }
    this.autoSelectActivePlayers();
  },

  renderScorerInterface() {
    const container = document.getElementById('view-container');
    if (!container || !this.game) return;

    const isTop = this.game.half_inning === 'top';
    const battingList = isTop ? this.awayBatters : this.homeBatters;
    const pitchingList = isTop ? this.homePitchers : this.awayPitchers;

    const currentBatter = battingList.find(b => b.player_id == this.activeBatterId);
    const currentPitcher = pitchingList.find(p => p.player_id == this.activePitcherId);

    const batterName = currentBatter ? `#${currentBatter.jersey_number} ${currentBatter.first_name} ${currentBatter.last_name}` : 'Sin Bateador Seleccionado';
    const pitcherName = currentPitcher ? `#${currentPitcher.jersey_number} ${currentPitcher.first_name} ${currentPitcher.last_name}` : 'Sin Lanzador Seleccionado';

    let html = `
      <div class="view-content">
        <!-- Live Header Box (Light Theme) -->
        <div class="md-card" style="background:#FFFFFF; border:1px solid #DADCE0; text-align:center; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <span id="live-queue-badge" class="md-chip active" style="background:#E8F0FE; color:#1A73E8; font-weight:800; border:1px solid #1A73E8; font-size:0.75rem; white-space:normal; text-align:left;">🔴 ANOTADOR EN VIVO</span>
            <div style="display:flex; gap:6px; flex-shrink:0; white-space:nowrap;">
              <button class="md-btn md-btn-primary" style="padding:4px 10px; font-size:0.75rem; white-space:nowrap; flex-shrink:0;" onclick="App.showGameLineupModal()">📋 Lineup</button>
              <button class="md-btn md-btn-outlined" style="padding:4px 10px; font-size:0.75rem; white-space:nowrap; flex-shrink:0;" onclick="App.showView('game_detail', ${this.game.id})">❌ Salir</button>
            </div>
          </div>

          <!-- Scoreboard Header -->
          <div style="display:flex; justify-content:space-around; align-items:center; margin:14px 0;">
            <div style="text-align:center; flex:1;">
              <div style="font-weight:800; font-size:1.1rem; color:#202124;">${this.game.away_short}</div>
              <div style="font-size:2.4rem; font-weight:900; color:#1A73E8;" id="live-away-score">${this.game.away_score}</div>
            </div>

            <div style="text-align:center; flex:1; border-left:1px solid #DADCE0; border-right:1px solid #DADCE0; padding:0 8px;">
              <div style="font-size:1.1rem; font-weight:900; color:#202124;">${isTop ? '▲ Top' : '▼ Bot'} ${this.game.current_inning}°</div>
              <div style="font-size:1.05rem; font-weight:900; color:#EA4335; margin-top:4px;">
                OUTS: <span style="font-size:1.4rem;">${'●'.repeat(this.outsCount)}</span><span style="color:#DADCE0; font-size:1.4rem;">${'○'.repeat(Math.max(0, 3 - this.outsCount))}</span>
              </div>
            </div>

            <div style="text-align:center; flex:1;">
              <div style="font-weight:800; font-size:1.1rem; color:#202124;">${this.game.home_short}</div>
              <div style="font-size:2.4rem; font-weight:900; color:#1A73E8;" id="live-home-score">${this.game.home_score}</div>
            </div>
          </div>

          <!-- Base Runner Diamond Graphic -->
          <div style="background:#F8F9FA; border:1px solid #DADCE0; border-radius:12px; padding:10px; margin-top:10px;">
            <div style="font-size:0.72rem; font-weight:800; color:#5F6368; margin-bottom:4px;">CORREDORES EN BASE</div>
            <div style="display:flex; justify-content:center; align-items:center; gap:16px;">
              <div style="position:relative; width:120px; height:100px;">
                <svg viewBox="0 0 100 80" style="width:100%; height:100%;">
                  <!-- Base Paths -->
                  <polygon points="50,65 80,40 50,15 20,40" fill="#E8F0FE" stroke="#1A73E8" stroke-width="2" />
                  <!-- Home Plate -->
                  <polygon points="50,65 47,68 53,68" fill="#5F6368" />
                  
                  <!-- 1B -->
                  <polygon points="80,40 84,36 80,32 76,36" fill="${this.baseRunners.b1 ? '#188038' : '#FFFFFF'}" stroke="${this.baseRunners.b1 ? '#188038' : '#5F6368'}" stroke-width="2.5" cursor="pointer" onclick="LiveScorer.toggleRunner('b1')" />
                  <!-- 2B -->
                  <polygon points="50,15 54,11 50,7 46,11" fill="${this.baseRunners.b2 ? '#188038' : '#FFFFFF'}" stroke="${this.baseRunners.b2 ? '#188038' : '#5F6368'}" stroke-width="2.5" cursor="pointer" onclick="LiveScorer.toggleRunner('b2')" />
                  <!-- 3B -->
                  <polygon points="20,40 24,36 20,32 16,36" fill="${this.baseRunners.b3 ? '#188038' : '#FFFFFF'}" stroke="${this.baseRunners.b3 ? '#188038' : '#5F6368'}" stroke-width="2.5" cursor="pointer" onclick="LiveScorer.toggleRunner('b3')" />
                </svg>
              </div>

              <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-start;">
                <button class="md-chip" style="padding:4px 8px; font-size:0.75rem; font-weight:800; background:${this.baseRunners.b1 ? '#E6F4EA' : '#FFFFFF'}; color:${this.baseRunners.b1 ? '#188038' : '#5F6368'}; border:1px solid ${this.baseRunners.b1 ? '#188038' : '#DADCE0'};" onclick="LiveScorer.toggleRunner('b1')">
                  1ª Base: ${this.baseRunners.b1 ? '🏃 SI' : '○ NO'}
                </button>
                <button class="md-chip" style="padding:4px 8px; font-size:0.75rem; font-weight:800; background:${this.baseRunners.b2 ? '#E6F4EA' : '#FFFFFF'}; color:${this.baseRunners.b2 ? '#188038' : '#5F6368'}; border:1px solid ${this.baseRunners.b2 ? '#188038' : '#DADCE0'};" onclick="LiveScorer.toggleRunner('b2')">
                  2ª Base: ${this.baseRunners.b2 ? '🏃 SI' : '○ NO'}
                </button>
                <button class="md-chip" style="padding:4px 8px; font-size:0.75rem; font-weight:800; background:${this.baseRunners.b3 ? '#E6F4EA' : '#FFFFFF'}; color:${this.baseRunners.b3 ? '#188038' : '#5F6368'}; border:1px solid ${this.baseRunners.b3 ? '#188038' : '#DADCE0'};" onclick="LiveScorer.toggleRunner('b3')">
                  3ª Base: ${this.baseRunners.b3 ? '🏃 SI' : '○ NO'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Active Batter & Pitcher Cards -->
        <div class="md-card" style="background:#FFFFFF; border:1px solid #DADCE0;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #F1F3F4; padding-bottom:8px;">
            <div>
              <div style="font-size:0.72rem; font-weight:700; color:#1A73E8; text-transform:uppercase;">⚡ Bateador Actual (Turno ${(isTop ? this.awayLineupIndex : this.homeLineupIndex) + 1}/9)</div>
              <div style="font-size:1rem; font-weight:800; color:#202124;" class="text-truncate">${batterName}</div>
            </div>
            <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.72rem;" onclick="LiveScorer.showSubstitutionModal('batter')">🔄 Cambiar</button>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px;">
            <div>
              <div style="font-size:0.72rem; font-weight:700; color:#1A73E8; text-transform:uppercase;">⚾ Lanzador Actual</div>
              <div style="font-size:1rem; font-weight:800; color:#202124;" class="text-truncate">${pitcherName}</div>
            </div>
            <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.72rem;" onclick="LiveScorer.showSubstitutionModal('pitcher')">🔄 Cambiar Pitcher</button>
          </div>
        </div>

        <!-- Categorized Action Buttons -->
        <div class="view-section">
          <!-- POSITIVE / OFFENSIVE PLAYS (GREEN #188038) -->
          <div style="font-size:0.8rem; font-weight:800; color:#188038; margin-bottom:6px; display:flex; align-items:center; gap:4px;">
            <span class="material-icons-round" style="font-size:16px;">trending_up</span> JUGADAS DE HIT & OFENSIVA (VERDE)
          </div>
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px; margin-bottom:12px;">
            <button class="md-btn" style="background:#188038; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('1B', '1B Sencillo', 0)">1B Sencillo</button>
            <button class="md-btn" style="background:#188038; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('2B', '2B Doble', 0)">2B Doble</button>
            <button class="md-btn" style="background:#188038; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('3B', '3B Triple', 0)">3B Triple</button>
            <button class="md-btn" style="background:#0F9D58; color:#FFFFFF; font-weight:900;" onclick="LiveScorer.confirmPlay('HR', '💥 JONRÓN (HR)', 0)">💥 JONRÓN (HR)</button>
            <button class="md-btn" style="background:#188038; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('BB', 'Base por Bolas (BB)', 0)">BB (Base)</button>
            <button class="md-btn" style="background:#188038; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('SB', 'Robo de Base (SB)', 0)">🏃 SB (Robo)</button>
            
            <button class="md-btn" style="grid-column: span 2; background:#188038; color:#FFFFFF; font-weight:900; font-size:0.9rem;" onclick="LiveScorer.showRunScoredModal()">⚽ +1 Carrera Anotada / Impulsada</button>
          </div>

          <!-- OUTS & DEFENSIVE PLAYS (RED #EA4335) -->
          <div style="font-size:0.8rem; font-weight:800; color:#EA4335; margin-bottom:6px; display:flex; align-items:center; gap:4px;">
            <span class="material-icons-round" style="font-size:16px;">do_not_disturb_on</span> OUTS Y DEFENSIVA (ROJO)
          </div>
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px;">
            <button class="md-btn" style="background:#EA4335; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('SO', 'Ponche (SO / K)', 1)">SO (Ponche)</button>
            <button class="md-btn" style="background:#EA4335; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('FO', 'Fly Out (Elevado)', 1)">Fly Out (F)</button>
            <button class="md-btn" style="background:#EA4335; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('GO', 'Ground Out (Rodado)', 1)">Ground Out (G)</button>
            <button class="md-btn" style="background:${(this.baseRunners.b1 || this.baseRunners.b2 || this.baseRunners.b3) && this.outsCount < 2 ? '#C5221F' : '#94A3B8'}; color:#FFFFFF; font-weight:900; ${!(this.baseRunners.b1 || this.baseRunners.b2 || this.baseRunners.b3) || this.outsCount >= 2 ? 'opacity:0.6;' : ''}" onclick="LiveScorer.confirmPlay('DP', 'Double Play (2 Outs)', 2)">Double Play (DP)</button>
          </div>
        </div>

        <!-- Change Inning Button -->
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button class="md-btn md-btn-outlined" style="flex:1;" onclick="LiveScorer.toggleHalfInning()">🔁 Cambiar de Entrada / Inning</button>
          <button class="md-btn md-btn-primary" style="flex:1;" onclick="LiveScorer.finishGame()">🏁 Finalizar Partido</button>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.updateQueueBadgeUI();
  },

  async confirmPlay(code, label, outsAdded = 0) {
    if (!this.activeBatterId || !this.activePitcherId) {
      App.showAlert("Anotación en Vivo", "Por favor asegúrate de tener seleccionados un bateador y un lanzador activos.", "warning", "#EF4444");
      return;
    }

    if (code === 'DP') {
      const hasRunners = (this.baseRunners.b1 || this.baseRunners.b2 || this.baseRunners.b3);
      if (!hasRunners || this.outsCount >= 2) {
        App.showAlert(
          "Doble Play No Válido",
          "No se puede registrar Double Play: Se requiere al menos 1 corredor en base y menos de 2 outs en la entrada.",
          "warning",
          "#EA4335"
        );
        return;
      }
    }

    const isTop = (this.game.half_inning === 'top');
    const battingList = isTop ? this.awayBatters : this.homeBatters;
    const currentBatter = battingList.find(b => b.player_id == this.activeBatterId);
    const batterName = currentBatter ? `#${currentBatter.jersey_number} ${currentBatter.first_name} ${currentBatter.last_name}` : 'Bateador Actual';

    const isPositive = ['1B', '2B', '3B', 'HR', 'BB', 'RUN', 'SB'].includes(code);
    const icon = isPositive ? 'check_circle' : 'do_not_disturb_on';
    const color = isPositive ? '#188038' : '#EA4335';

    const confirmed = await App.showConfirm(
      `Confirmar Jugada (${code})`,
      `¿Registrar "${label}" para el bateador ${batterName}?`,
      icon,
      color
    );

    if (confirmed) {
      if (code === 'RUN') {
        this.showRunScoredModal();
      } else {
        await this.recordPlay(code, label, outsAdded);
      }
    }
  },

  async recordPlay(code, label, outsAdded = 0) {
    let runs = 0;
    let rbiCount = 0;

    if (!this.currentInningRunners) this.currentInningRunners = [];
    const activePid = parseInt(this.activeBatterId || 0);
    if (activePid > 0 && ['1B', '2B', '3B', 'HR', 'BB', 'HBP'].includes(code)) {
      if (!this.currentInningRunners.includes(activePid)) {
        this.currentInningRunners.push(activePid);
      }
    }

    if (code === 'HR') {
      const runnersOnBase = (this.baseRunners.b1 ? 1 : 0) + (this.baseRunners.b2 ? 1 : 0) + (this.baseRunners.b3 ? 1 : 0);
      runs = 1 + runnersOnBase;
      rbiCount = runs;
      label = `Jonrón (HR) - ${runs} Carrera(s)`;
      this.baseRunners = { b1: false, b2: false, b3: false };
    } else if (code === '1B') {
      this.baseRunners = { b1: true, b2: this.baseRunners.b1, b3: this.baseRunners.b2 };
    } else if (code === '2B') {
      this.baseRunners = { b1: false, b2: true, b3: this.baseRunners.b1 };
    } else if (code === '3B') {
      this.baseRunners = { b1: false, b2: false, b3: true };
    } else if (code === 'BB' || code === 'HBP') {
      if (this.baseRunners.b1) {
        if (this.baseRunners.b2) this.baseRunners.b3 = true;
        this.baseRunners.b2 = true;
      }
      this.baseRunners.b1 = true;
    } else if (code === 'SB') {
      if (this.baseRunners.b2) this.baseRunners.b3 = true;
      if (this.baseRunners.b1) this.baseRunners.b2 = true;
    }

    const payload = {
      action: 'record_play',
      game_id: this.game.id,
      inning: this.game.current_inning,
      half_inning: this.game.half_inning,
      batter_id: this.activeBatterId,
      pitcher_id: this.activePitcherId,
      outs_before: this.outsCount,
      outs_added: outsAdded,
      result_code: code,
      description: label,
      runs_scored: runs,
      rbi_count: rbiCount,
      b1: this.baseRunners.b1 ? 1 : 0,
      b2: this.baseRunners.b2 ? 1 : 0,
      b3: this.baseRunners.b3 ? 1 : 0
    };

    const ok = await this.sendDirectPlay(payload);
    if (!ok) return;

    if (runs > 0) {
      const isTop = this.game.half_inning === 'top';
      if (isTop) this.game.away_score += runs;
      else this.game.home_score += runs;
    }

    if (outsAdded > 0) {
      this.outsCount += outsAdded;
      if (this.outsCount >= 3) {
        App.showSnackbar("¡3 Outs completados! Cambio automático de media entrada.");
        this.outsCount = 0;
        this.baseRunners = { b1: false, b2: false, b3: false };
        await this.toggleHalfInning();
        return;
      }
    }

    App.showSnackbar(`✓ Jugada guardada en servidor: ${label}`);
    if (code !== 'SB') {
      this.advanceBatterLineup();
    }
    this.renderScorerInterface();
  },

  closeRunModal() {
    const modal = document.getElementById('live-run-modal');
    if (modal) modal.classList.remove('open');
  },

  showRunScoredModal() {
    const isTop = this.game.half_inning === 'top';
    const battingList = isTop ? this.awayBatters : this.homeBatters;
    const currentBatter = battingList.find(b => (b.player_id || b.id) == this.activeBatterId);
    
    if (!battingList || !battingList.length) {
      App.showAlert("Carrera Anotada", "Debes configurar la nómina del equipo al bate.", "info", "#F59E0B");
      return;
    }

    const body = document.getElementById('live-run-body');
    if (!body) return;

    const embasados = [];
    const rest = [];

    battingList.forEach(p => {
      const pid = p.player_id || p.id;
      if (this.currentInningRunners && this.currentInningRunners.includes(pid)) {
        embasados.push(p);
      } else {
        rest.push(p);
      }
    });

    let html = `
      <div style="font-size:0.8rem; font-weight:700; color:#5F6368;">
        Equipo al bate: <strong style="color:#188038;">${isTop ? this.game.away_team_name : this.game.home_team_name}</strong>
      </div>

      <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
        <label style="font-size:0.82rem; font-weight:800; color:#202124;">
          🏃 Jugador que Anota la Carrera (R):
        </label>
        <select id="run-scorer-select" class="form-control" style="font-weight:700; font-size:0.88rem;">
          ${embasados.length ? `
            <optgroup label="🔥 Jugadores Embasados esta Entrada (${embasados.length})">
              ${embasados.map(p => {
                const pid = p.player_id || p.id;
                return `<option value="${pid}" ${pid == this.activeBatterId ? 'selected' : ''}>#${p.jersey_number || 0} ${p.first_name} ${p.last_name} (${p.position || 'Jugador'})</option>`;
              }).join('')}
            </optgroup>
          ` : ''}
          <optgroup label="📋 Todos los Jugadores del Plantel (${rest.length})">
            ${rest.map(p => {
              const pid = p.player_id || p.id;
              return `<option value="${pid}" ${pid == this.activeBatterId ? 'selected' : ''}>#${p.jersey_number || 0} ${p.first_name} ${p.last_name} (${p.position || 'Jugador'})</option>`;
            }).join('')}
          </optgroup>
        </select>
      </div>

      <div style="display:flex; flex-direction:column; gap:6px; margin-top:10px;">
        <label style="font-size:0.82rem; font-weight:800; color:#137333;">
          ⚾ Carrera Impulsada por (CI / RBI):
        </label>
        <select id="run-rbi-select" class="form-control" style="font-weight:700; font-size:0.88rem;">
          <option value="${currentBatter ? (currentBatter.player_id || currentBatter.id) : 0}">
            ⚡ ${currentBatter ? '#' + currentBatter.jersey_number + ' ' + currentBatter.first_name + ' ' + currentBatter.last_name : 'Bateador Actual'} (Bateador en Turno)
          </option>
          <option value="0">❌ Sin Impulsada (Error / Wild Pitch / Passed Ball / etc.)</option>
          <optgroup label="👥 Otro Jugador del Plantel">
            ${battingList.filter(p => (p.player_id || p.id) != this.activeBatterId).map(p => {
              const pid = p.player_id || p.id;
              return `<option value="${pid}">#${p.jersey_number || 0} ${p.first_name} ${p.last_name}</option>`;
            }).join('')}
          </optgroup>
        </select>
      </div>

      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="md-btn md-btn-outlined" style="flex:1;" onclick="LiveScorer.closeRunModal()">Cancelar</button>
        <button class="md-btn md-btn-primary" style="flex:1; background:#188038; border-color:#188038; font-weight:800;" onclick="LiveScorer.applyRunScored()">
          ⚽ Registrar Carrera
        </button>
      </div>
    `;

    body.innerHTML = html;
    const modal = document.getElementById('live-run-modal');
    if (modal) modal.classList.add('open');
  },

  async applyRunScored() {
    const runnerSelect = document.getElementById('run-scorer-select');
    const rbiSelect = document.getElementById('run-rbi-select');
    if (!runnerSelect) return;

    const runnerId = parseInt(runnerSelect.value || 0);
    const rbiBatterId = rbiSelect ? parseInt(rbiSelect.value || 0) : 0;

    if (!runnerId) {
      App.showSnackbar("Por favor selecciona el jugador que anotó la carrera.");
      return;
    }

    const payload = {
      action: 'record_run',
      game_id: this.game.id,
      inning: this.game.current_inning,
      half_inning: this.game.half_inning,
      runner_id: runnerId,
      rbi_batter_id: rbiBatterId,
      b1: this.baseRunners.b1 ? 1 : 0,
      b2: this.baseRunners.b2 ? 1 : 0,
      b3: this.baseRunners.b3 ? 1 : 0
    };

    const ok = await this.sendDirectPlay(payload);
    if (!ok) return;

    const isTop = this.game.half_inning === 'top';
    if (isTop) {
      this.game.away_score++;
    } else {
      this.game.home_score++;
    }

    if (this.baseRunners.b3) {
      this.baseRunners.b3 = false;
    } else if (this.baseRunners.b2) {
      this.baseRunners.b2 = false;
    } else if (this.baseRunners.b1) {
      this.baseRunners.b1 = false;
    }

    const battingList = isTop ? this.awayBatters : this.homeBatters;
    const runnerObj = battingList.find(b => (b.player_id || b.id) == runnerId);
    const runnerName = runnerObj ? `#${runnerObj.jersey_number} ${runnerObj.first_name}` : 'Jugador';

    App.showSnackbar(`✓ Carrera guardada en servidor: ${runnerName}${rbiBatterId > 0 ? ' (Impulsada)' : ''}`);
    this.closeRunModal();
    this.renderScorerInterface();
  },

  async toggleHalfInning() {
    this.currentInningRunners = [];
    let nextInning = this.game.current_inning;
    let nextHalf = this.game.half_inning;

    if (nextHalf === 'top') {
      nextHalf = 'bottom';
    } else {
      nextHalf = 'top';
      nextInning++;
    }

    const payload = {
      action: 'change_inning',
      game_id: this.game.id,
      current_inning: nextInning,
      half_inning: nextHalf
    };

    const ok = await this.sendDirectPlay(payload);
    if (!ok) return;

    this.game.current_inning = nextInning;
    this.game.half_inning = nextHalf;
    this.outsCount = 0;
    this.baseRunners = { b1: false, b2: false, b3: false };

    this.autoSelectActivePlayers();
    this.renderScorerInterface();
  },

  closeSubstitutionModal() {
    const modal = document.getElementById('live-substitution-modal');
    if (modal) modal.classList.remove('open');
  },

  async showSubstitutionModal(type) {
    const isTop = this.game.half_inning === 'top';
    const isBatter = (type === 'batter');
    const teamId = isBatter ? (isTop ? this.game.away_team_id : this.game.home_team_id) : (isTop ? this.game.home_team_id : this.game.away_team_id);
    const teamName = isBatter ? (isTop ? this.game.away_team_name : this.game.home_team_name) : (isTop ? this.game.home_team_name : this.game.away_team_name);
    
    try {
      const res = await fetch(`api/players.php?team_id=${teamId}`);
      const data = await res.json();
      const players = data.players || [];

      if (!players.length) {
        App.showAlert("Rotación de Jugadores", "No hay jugadores registrados en el plantel de este equipo.", "info", "#F59E0B");
        return;
      }

      this.currentSubPlayers = players;
      this.currentSubTeamName = teamName;
      this.currentSubType = type;

      const titleEl = document.getElementById('sub-modal-title');
      if (titleEl) {
        titleEl.innerHTML = `<span class="material-icons-round" style="color:#1A73E8;">published_with_changes</span> ${isBatter ? 'Sustitución de Bateador (PH/PR)' : 'Cambio de Lanzador / Defensa'}`;
      }

      this.renderSubstitutionModalContent();

      const modal = document.getElementById('live-substitution-modal');
      if (modal) modal.classList.add('open');
    } catch(e) {
      App.showSnackbar("Error al obtener el plantel del equipo.");
    }
  },

  renderSubstitutionModalContent() {
    const body = document.getElementById('live-substitution-body');
    if (!body || !this.currentSubPlayers) return;

    const isTop = this.game.half_inning === 'top';
    const isBatter = (this.currentSubType === 'batter');
    
    // For batter substitution: team currently AT BAT (isTop -> away, !isTop -> home)
    // For pitcher substitution: team currently IN FIELD (isTop -> home, !isTop -> away)
    const teamLineup = isBatter ? (isTop ? (this.awayBatters || []) : (this.homeBatters || [])) : (isTop ? (this.homeBatters || []) : (this.awayBatters || []));
    const activeList = isBatter ? (isTop ? this.awayBatters : this.homeBatters) : (isTop ? this.homePitchers : this.awayPitchers);
    
    const currentActiveId = isBatter ? this.activeBatterId : this.activePitcherId;
    const currentActivePlayer = activeList.find(p => (p.player_id == currentActiveId || p.id == currentActiveId)) || teamLineup.find(p => (p.player_id == currentActiveId || p.id == currentActiveId));

    const positionsList = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'PH', 'PR', 'OF', 'IF'];

    const benchPlayers = [];
    const lineupPlayers = [];

    this.currentSubPlayers.forEach(p => {
      const activeEntry = teamLineup.find(d => (d.player_id == p.id || d.id == p.id));
      if (activeEntry) {
        lineupPlayers.push({ roster: p, active: activeEntry });
      } else {
        benchPlayers.push({ roster: p });
      }
    });

    let html = `
      <div class="md-card" style="background:#F8F9FA; border:1px solid #DADCE0; margin-bottom:4px;">
        <div style="font-size:0.75rem; font-weight:800; color:#5F6368; text-transform:uppercase;">
          ${isBatter ? '⚡ Bateador Actual en Turno' : '⚾ Lanzador (Pitcher) Actual en Juego'}
        </div>
        <div style="font-size:1rem; font-weight:800; color:#1A73E8; margin-top:2px;">
          ${currentActivePlayer ? `#${currentActivePlayer.jersey_number} ${currentActivePlayer.first_name} ${currentActivePlayer.last_name} (${currentActivePlayer.position || (isBatter ? 'Bateador' : 'P')})` : 'Sin asignar'}
        </div>
      </div>

      <!-- NEW PLAYER SELECT -->
      <div style="display:flex; flex-direction:column; gap:6px;">
        <label style="font-size:0.82rem; font-weight:800; color:#202124;">
          Selecciona el Nuevo ${isBatter ? 'Bateador (PH)' : 'Lanzador (P)'}:
        </label>
        <select id="sub-player-select" class="form-control" style="font-weight:700; font-size:0.85rem;" onchange="LiveScorer.handleSubPlayerChange(this.value)">
          <optgroup label="📋 Banca / Suplentes (${benchPlayers.length})">
            ${benchPlayers.map(b => {
              const p = b.roster;
              return `<option value="${p.id}">#${p.jersey_number} ${p.first_name} ${p.last_name} (${p.position_primary || 'Suplente'}) [BANCA]</option>`;
            }).join('')}
          </optgroup>
          <optgroup label="🏟️ Jugadores Activos en Alineación / Campo (${lineupPlayers.length})">
            ${lineupPlayers.map(b => {
              const p = b.roster;
              const a = b.active;
              const isCurrent = (p.id == currentActiveId);
              return `<option value="${p.id}" ${isCurrent ? 'selected' : ''}>#${p.jersey_number} ${p.first_name} ${p.last_name} (${a.position || 'Campo'}) ${isCurrent ? '← ACTUAL' : '[EN ALINEACIÓN]'}</option>`;
            }).join('')}
          </optgroup>
        </select>
      </div>

      ${!isBatter ? `
        <!-- FORMER PITCHER NEW POSITION SELECT -->
        <div id="former-pitcher-container" style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
          <label style="font-size:0.82rem; font-weight:800; color:#202124;">
            ¿A qué posición pasa el Lanzador Anterior (${currentActivePlayer ? '#' + currentActivePlayer.jersey_number + ' ' + currentActivePlayer.first_name : 'Anterior'})?
          </label>
          <select id="sub-former-pitcher-pos" class="form-control" style="font-weight:700; font-size:0.85rem;">
            <option value="OUT">❌ Sale del Juego (Remplazado / A la banca)</option>
            ${positionsList.filter(pos => pos !== 'P').map(pos => `
              <option value="${pos}">Pasa a jugar defensivamente en ${pos}</option>
            `).join('')}
          </select>
        </div>
      ` : ''}

      <div style="display:flex; gap:10px; margin-top:12px;">
        <button class="md-btn md-btn-outlined" style="flex:1;" onclick="LiveScorer.closeSubstitutionModal()">Cancelar</button>
        <button class="md-btn md-btn-primary" style="flex:1; font-weight:800;" onclick="LiveScorer.applySubstitution()">
          ✅ Aplicar Sustitución
        </button>
      </div>
    `;

    body.innerHTML = html;
  },

  handleSubPlayerChange(selectedId) {
    // Interactive handler if needed
  },

  async applySubstitution() {
    const selEl = document.getElementById('sub-player-select');
    if (!selEl) return;

    const newPlayerId = selEl.value;
    const foundPlayer = this.currentSubPlayers.find(p => p.id == newPlayerId);
    if (!foundPlayer) {
      App.showSnackbar("Jugador no válido.");
      return;
    }

    const payload = {
      action: 'substitution',
      game_id: this.game.id,
      type: this.currentSubType,
      player_id: foundPlayer.id,
      inning: this.game.current_inning,
      half_inning: this.game.half_inning
    };

    const ok = await this.sendDirectPlay(payload);
    if (!ok) return;

    const isTop = this.game.half_inning === 'top';
    const isBatter = (this.currentSubType === 'batter');

    if (isBatter) {
      this.activeBatterId = foundPlayer.id;
      const battingList = isTop ? this.awayBatters : this.homeBatters;
      const existingInList = battingList.find(b => (b.player_id == foundPlayer.id || b.id == foundPlayer.id));
      if (!existingInList) {
        const activeIdx = isTop ? this.awayLineupIndex : this.homeLineupIndex;
        battingList[activeIdx % Math.max(1, battingList.length)] = {
          player_id: foundPlayer.id,
          first_name: foundPlayer.first_name,
          last_name: foundPlayer.last_name,
          jersey_number: foundPlayer.jersey_number,
          position: 'PH',
          bats: foundPlayer.bats || 'R'
        };
      }
      App.showSnackbar(`✓ Cambio de Bateador guardado: #${foundPlayer.jersey_number} ${foundPlayer.first_name} ${foundPlayer.last_name}`);
    } else {
      const pitchingList = isTop ? this.homePitchers : this.awayPitchers;
      const defenseList = isTop ? this.homeBatters : this.awayBatters;
      
      const oldPitcherId = this.activePitcherId;
      const formerPosEl = document.getElementById('sub-former-pitcher-pos');
      const formerPos = formerPosEl ? formerPosEl.value : 'OUT';

      this.activePitcherId = foundPlayer.id;

      const newPitcherInField = defenseList.find(d => (d.player_id == foundPlayer.id || d.id == foundPlayer.id));
      const oldPitcherInField = defenseList.find(d => (d.player_id == oldPitcherId || d.id == oldPitcherId));

      if (newPitcherInField) {
        newPitcherInField.position = 'P';
      }
      if (oldPitcherInField && formerPos !== 'OUT') {
        oldPitcherInField.position = formerPos;
      }

      if (!pitchingList.some(p => (p.player_id == foundPlayer.id || p.id == foundPlayer.id))) {
        pitchingList.unshift({
          player_id: foundPlayer.id,
          first_name: foundPlayer.first_name,
          last_name: foundPlayer.last_name,
          jersey_number: foundPlayer.jersey_number,
          position: 'P'
        });
      }

      App.showSnackbar(`✓ Cambio de Lanzador guardado: #${foundPlayer.jersey_number} ${foundPlayer.first_name} ${foundPlayer.last_name}`);
    }

    this.closeSubstitutionModal();
    this.renderScorerInterface();
  },

  async finishGame() {
    const confirmed = await App.showConfirm("Finalizar Partido", `¿Está seguro de finalizar el partido con marcador ${this.game.away_short} ${this.game.away_score} - ${this.game.home_score} ${this.game.home_short}?`, "sports_baseball", "#EF4444");
    if (confirmed) {
      const payload = {
        action: 'finalize',
        game_id: this.game.id,
        away_score: this.game.away_score,
        home_score: this.game.home_score,
        current_inning: this.game.current_inning,
        half_inning: this.game.half_inning
      };

      const ok = await this.sendDirectPlay(payload);
      if (ok) {
        this.game.status = 'finished';
        App.showAlert("Partido Finalizado", `El resultado final (${this.game.away_score} - ${this.game.home_score}) ha sido registrado exitosamente.`, "check_circle", "#10B981");
        App.showView('game_detail', this.game.id);
      }
    }
  }
};

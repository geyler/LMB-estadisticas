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
        player_id: p.player_id,
        first_name: p.first_name,
        last_name: p.last_name,
        jersey_number: p.jersey_number,
        bats: p.bats,
        batting_order: idx + 1
      }));
    } else {
      this.homeBatters = gameDetailData.home_batters;
    }

    if (!gameDetailData.away_batters || gameDetailData.away_batters.length === 0) {
      this.awayBatters = awayActive.map((p, idx) => ({
        player_id: p.player_id,
        first_name: p.first_name,
        last_name: p.last_name,
        jersey_number: p.jersey_number,
        bats: p.bats,
        batting_order: idx + 1
      }));
    } else {
      this.awayBatters = gameDetailData.away_batters;
    }

    if (!gameDetailData.home_pitchers || gameDetailData.home_pitchers.length === 0) {
      this.homePitchers = homeActive.map(p => ({
        player_id: p.player_id,
        first_name: p.first_name,
        last_name: p.last_name,
        jersey_number: p.jersey_number
      }));
    } else {
      this.homePitchers = gameDetailData.home_pitchers;
    }

    if (!gameDetailData.away_pitchers || gameDetailData.away_pitchers.length === 0) {
      this.awayPitchers = awayActive.map(p => ({
        player_id: p.player_id,
        first_name: p.first_name,
        last_name: p.last_name,
        jersey_number: p.jersey_number
      }));
    } else {
      this.awayPitchers = gameDetailData.away_pitchers;
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
  getOfflineQueueKey() {
    return `lmb_offline_queue_${this.game ? this.game.id : 0}`;
  },

  getOfflineQueue() {
    try {
      return JSON.parse(localStorage.getItem(this.getOfflineQueueKey()) || '[]');
    } catch(e) {
      return [];
    }
  },

  setOfflineQueue(queue) {
    try {
      localStorage.setItem(this.getOfflineQueueKey(), JSON.stringify(queue));
    } catch(e) {}
  },

  enqueueOfflineAction(payload) {
    const queue = this.getOfflineQueue();
    queue.push({
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      payload
    });
    this.setOfflineQueue(queue);
    this.updateQueueBadgeUI();
    this.processOfflineQueue();
  },

  async processOfflineQueue() {
    if (this.isSyncing) return;
    const queue = this.getOfflineQueue();
    if (!queue.length) {
      this.updateQueueBadgeUI();
      return;
    }

    this.isSyncing = true;
    this.updateQueueBadgeUI();

    while (queue.length > 0) {
      const item = queue[0];
      try {
        const res = await fetch('api/live_score.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload)
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success || data.message) {
            queue.shift(); // Remove processed action
            this.setOfflineQueue(queue);
          } else {
            console.warn("Error retrying offline play action:", data.message);
            break; // Stop loop on server business logic rejection
          }
        } else {
          break; // Stop loop on HTTP failure
        }
      } catch (err) {
        // Network connection error
        break;
      }
    }

    this.isSyncing = false;
    this.updateQueueBadgeUI();
  },

  updateQueueBadgeUI() {
    const badgeEl = document.getElementById('live-queue-badge');
    if (!badgeEl) return;

    const queue = this.getOfflineQueue();
    if (queue.length > 0) {
      badgeEl.style.display = 'inline-flex';
      badgeEl.style.background = '#FEF3C7';
      badgeEl.style.color = '#B45309';
      badgeEl.style.borderColor = '#F59E0B';
      badgeEl.innerHTML = `⚠️ ${queue.length} jugada(s) guardadas en local (${this.isSyncing ? 'Sincronizando...' : 'Retomando red'})`;
    } else {
      badgeEl.style.display = 'inline-flex';
      badgeEl.style.background = '#E8F0FE';
      badgeEl.style.color = '#1A73E8';
      badgeEl.style.borderColor = '#1A73E8';
      badgeEl.innerHTML = `🔴 ANOTADOR EN VIVO (En Línea)`;
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
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span id="live-queue-badge" class="md-chip active" style="background:#E8F0FE; color:#1A73E8; font-weight:800; border:1px solid #1A73E8;">🔴 ANOTADOR EN VIVO</span>
            <div style="display:flex; gap:6px;">
              <button class="md-btn md-btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="App.showGameLineupModal()">📋 Lineup</button>
              <button class="md-btn md-btn-outlined" style="padding:4px 10px; font-size:0.75rem;" onclick="App.showView('game_detail', ${this.game.id})">❌ Salir</button>
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
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:12px;">
            <button class="md-btn" style="background:#188038; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('1B', '1B Sencillo', 0)">1B Sencillo</button>
            <button class="md-btn" style="background:#188038; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('2B', '2B Doble', 0)">2B Doble</button>
            <button class="md-btn" style="background:#188038; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('3B', '3B Triple', 0)">3B Triple</button>

            <button class="md-btn" style="grid-column: span 2; background:#0F9D58; color:#FFFFFF; font-weight:900;" onclick="LiveScorer.confirmPlay('HR', '💥 JONRÓN (HR)', 0)">💥 JONRÓN (HR)</button>
            <button class="md-btn" style="background:#188038; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('BB', 'Base por Bolas (BB)', 0)">BB (Base)</button>
            
            <button class="md-btn" style="grid-column: span 3; background:#188038; color:#FFFFFF; font-weight:900; font-size:0.9rem;" onclick="LiveScorer.confirmPlay('RUN', '+1 Carrera Anotada', 0)">⚽ +1 Carrera Anotada</button>
          </div>

          <!-- OUTS & DEFENSIVE PLAYS (RED #EA4335) -->
          <div style="font-size:0.8rem; font-weight:800; color:#EA4335; margin-bottom:6px; display:flex; align-items:center; gap:4px;">
            <span class="material-icons-round" style="font-size:16px;">do_not_disturb_on</span> OUTS Y DEFENSIVA (ROJO)
          </div>
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px;">
            <button class="md-btn" style="background:#EA4335; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('SO', 'Ponche (SO / K)', 1)">SO (Ponche)</button>
            <button class="md-btn" style="background:#EA4335; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('FO', 'Fly Out (Elevado)', 1)">Fly Out (F)</button>
            <button class="md-btn" style="background:#EA4335; color:#FFFFFF; font-weight:800;" onclick="LiveScorer.confirmPlay('GO', 'Ground Out (Rodado)', 1)">Ground Out (G)</button>
            <button class="md-btn" style="background:#C5221F; color:#FFFFFF; font-weight:900;" onclick="LiveScorer.confirmPlay('DP', 'Double Play (2 Outs)', 2)">Double Play (DP - 2 Outs)</button>
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

    const isTop = (this.game.half_inning === 'top');
    const battingList = isTop ? this.awayBatters : this.homeBatters;
    const currentBatter = battingList.find(b => b.player_id == this.activeBatterId);
    const batterName = currentBatter ? `#${currentBatter.jersey_number} ${currentBatter.first_name} ${currentBatter.last_name}` : 'Bateador Actual';

    const isPositive = ['1B', '2B', '3B', 'HR', 'BB', 'RUN'].includes(code);
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
        this.recordRunScored();
      } else {
        this.recordPlay(code, label, outsAdded);
      }
    }
  },

  recordPlay(code, label, outsAdded = 0) {
    const runs = (code === 'HR') ? 1 : 0;
    if (runs > 0) {
      const isTop = this.game.half_inning === 'top';
      if (isTop) this.game.away_score += runs;
      else this.game.home_score += runs;
    }
    
    // Automatic Base Runner Progression
    if (code === '1B') {
      this.baseRunners = { b1: true, b2: this.baseRunners.b1, b3: this.baseRunners.b2 };
    } else if (code === '2B') {
      this.baseRunners = { b1: false, b2: true, b3: this.baseRunners.b1 };
    } else if (code === '3B') {
      this.baseRunners = { b1: false, b2: false, b3: true };
    } else if (code === 'HR') {
      this.baseRunners = { b1: false, b2: false, b3: false };
    } else if (code === 'BB') {
      if (this.baseRunners.b1) {
        if (this.baseRunners.b2) this.baseRunners.b3 = true;
        this.baseRunners.b2 = true;
      }
      this.baseRunners.b1 = true;
    }

    if (outsAdded > 0) {
      this.outsCount += outsAdded;
      if (this.outsCount >= 3) {
        App.showSnackbar("¡3 Outs completados! Cambio automático de media entrada.");
        this.outsCount = 0;
        this.baseRunners = { b1: false, b2: false, b3: false };
        this.toggleHalfInning();
        return;
      }
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
      runs_scored: runs
    };

    this.enqueueOfflineAction(payload);
    App.showSnackbar(`Jugada registrada: ${label}`);
    this.advanceBatterLineup();
    this.renderScorerInterface();
  },

  recordRunScored() {
    const isTop = this.game.half_inning === 'top';
    if (isTop) {
      this.game.away_score++;
    } else {
      this.game.home_score++;
    }

    const payload = {
      action: 'record_run',
      game_id: this.game.id,
      inning: this.game.current_inning,
      half_inning: this.game.half_inning
    };

    this.enqueueOfflineAction(payload);
    App.showSnackbar("+1 Carrera sumada al marcador");
    this.renderScorerInterface();
  },

  toggleHalfInning() {
    if (this.game.half_inning === 'top') {
      this.game.half_inning = 'bottom';
    } else {
      this.game.half_inning = 'top';
      this.game.current_inning++;
    }
    this.outsCount = 0;
    this.baseRunners = { b1: false, b2: false, b3: false };
    
    const payload = {
      action: 'change_inning',
      game_id: this.game.id,
      current_inning: this.game.current_inning,
      half_inning: this.game.half_inning
    };

    this.enqueueOfflineAction(payload);
    this.autoSelectActivePlayers();
    this.renderScorerInterface();
  },

  async showSubstitutionModal(type) {
    const isTop = this.game.half_inning === 'top';
    const isBatter = (type === 'batter');
    const teamId = isBatter ? (isTop ? this.game.away_team_id : this.game.home_team_id) : (isTop ? this.game.home_team_id : this.game.away_team_id);
    
    try {
      const res = await fetch(`api/players.php?team_id=${teamId}`);
      const data = await res.json();
      const players = data.players || [];

      if (!players.length) {
        App.showAlert("Rotación de Jugadores", "No hay jugadores registrados en el plantel de este equipo.", "info", "#F59E0B");
        return;
      }

      let optionsList = players.map(p => `${p.id}: #${p.jersey_number} ${p.first_name} ${p.last_name} (${p.position_primary})`).join('\n');
      const inputVal = await App.showPrompt(
        `Rotación / Cambio de ${isBatter ? 'Bateador' : 'Lanzador (Pitcher)'}`,
        `Cualquier jugador de la nómina puede pitchar o ingresar al campo.\nIngresa el ID del jugador:\n${optionsList}`,
        isBatter ? (this.activeBatterId ? this.activeBatterId.toString() : '') : (this.activePitcherId ? this.activePitcherId.toString() : '')
      );

      if (inputVal) {
        const found = players.find(p => p.id == inputVal || p.jersey_number == inputVal);
        if (found) {
          if (isBatter) {
            this.activeBatterId = found.id;
          } else {
            this.activePitcherId = found.id;
          }
          App.showSnackbar(`🔄 Cambio registrado: #${found.jersey_number} ${found.first_name} ${found.last_name} como ${isBatter ? 'Bateador' : 'Lanzador'}.`);
          this.renderScorerInterface();
        } else {
          App.showSnackbar("ID o número de camiseta no encontrado.");
        }
      }
    } catch(e) {
      App.showSnackbar("Error al obtener el plantel del equipo.");
    }
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

      this.enqueueOfflineAction(payload);
      await this.processOfflineQueue();

      App.showAlert("Partido Finalizado", `El resultado final (${this.game.away_score} - ${this.game.home_score}) ha sido registrado exitosamente.`, "check_circle", "#10B981");
      App.showView('game_detail', this.game.id);
    }
  }
};

/**
 * Live Match Scorekeeper Engine ("En Partido" / "Piloto Automático")
 * Liga Metropolitana de Béisbol (LMB)
 * Automated Lineup Rotation & Fast One-Tap Play-by-Play Recording
 */

const LiveScorer = {
  game: null,
  homeBatters: [],
  awayBatters: [],
  homePitchers: [],
  awayPitchers: [],

  // Automated Lineup Index Pointers
  awayLineupIndex: 0,
  homeLineupIndex: 0,

  activeBatterId: null,
  activePitcherId: null,
  outsCount: 0,

  init(gameDetailData) {
    this.game = gameDetailData.game;
    this.homeRoster = gameDetailData.home_roster || [];
    this.awayRoster = gameDetailData.away_roster || [];

    let homeActive = this.homeRoster.filter(p => !p.role_type || p.role_type === 'player' || p.role_type === 'jugador');
    if (!homeActive.length && this.homeRoster.length) homeActive = this.homeRoster;

    let awayActive = this.awayRoster.filter(p => !p.role_type || p.role_type === 'player' || p.role_type === 'jugador');
    if (!awayActive.length && this.awayRoster.length) awayActive = this.awayRoster;

    // If homeBatters / awayBatters from game_batting_stats are empty, populate from team rosters
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

    // Check if either team has ZERO players in roster
    if (this.homeBatters.length === 0 || this.awayBatters.length === 0) {
      const container = document.getElementById('view-container');
      if (container) {
        container.innerHTML = `
          <div class="view-content">
            <div class="md-card" style="background: linear-gradient(135deg, #7F1D1D 0%, #070D1B 100%); text-align:center;">
              <div style="font-size:2.5rem; margin-bottom:8px;">⚠️</div>
              <h2 style="font-size:1.3rem; font-weight:800; color:#FFFFFF; margin:0;">Plantel Sin Jugadores Registrados</h2>
              <p style="font-size:0.85rem; color:#94A3B8; margin-top:8px;">
                Para poder iniciar la consola de anotación en vivo, debes registrar al menos un jugador activo en el plantel de cada club.<br><br>
                • <strong>${this.game.away_short}</strong>: ${this.awayBatters.length} jugadores<br>
                • <strong>${this.game.home_short}</strong>: ${this.homeBatters.length} jugadores
              </p>
              <div style="display:flex; gap:10px; justify-content:center; margin-top:16px; flex-wrap:wrap;">
                <button class="md-btn md-btn-gold" onclick="App.showView('team_detail', ${this.game.away_team_id})">👥 Plantel ${this.game.away_short}</button>
                <button class="md-btn md-btn-gold" onclick="App.showView('team_detail', ${this.game.home_team_id})">👥 Plantel ${this.game.home_short}</button>
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

    this.autoSelectActivePlayers();
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
        <!-- Live Header Box -->
        <div class="md-card" style="background: linear-gradient(135deg, #070D1B 0%, #1E3A8A 100%); text-align:center;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="md-chip active">🔴 ANOTADOR EN VIVO</span>
            <div style="display:flex; gap:6px;">
              <button class="md-btn md-btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="App.showGameLineupModal()">📋 Lineup de Partido</button>
              <button class="md-btn md-btn-outlined" style="padding:4px 10px; font-size:0.75rem;" onclick="App.showView('game_detail', ${this.game.id})">❌ Salir</button>
            </div>
          </div>

          <div style="display:flex; justify-content:space-around; align-items:center; margin:14px 0;">
            <div style="text-align:center;">
              <div style="font-weight:800; font-size:1.1rem; color:#202124;">${this.game.away_short}</div>
              <div style="font-size:2.4rem; font-weight:800; color:#1A73E8;" id="live-away-score">${this.game.away_score}</div>
            </div>

            <div style="text-align:center;">
              <div style="font-size:1.1rem; font-weight:800; color:#202124;">${isTop ? '▲ Top' : '▼ Bot'} ${this.game.current_inning}°</div>
              <div style="font-size:0.85rem; font-weight:700; color:#EA4335; margin-top:4px;">Outs: ${'●'.repeat(this.outsCount)}${'○'.repeat(3 - this.outsCount)}</div>
            </div>

            <div style="text-align:center;">
              <div style="font-weight:800; font-size:1.1rem; color:#202124;">${this.game.home_short}</div>
              <div style="font-size:2.4rem; font-weight:800; color:#1A73E8;" id="live-home-score">${this.game.home_score}</div>
            </div>
          </div>

          <div style="font-size:0.78rem; color:#5F6368; margin-top:4px;">📍 ${this.game.stadium_name ? this.game.stadium_name + ' (' + (this.game.stadium_field || 'Cancha Principal') + ')' : this.game.field_location}</div>
        </div>

        <!-- Active Batter & Pitcher Cards (Automated) -->
        <div class="md-card" style="background: #F8F9FA; border: 1px solid #DADCE0;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #DADCE0; padding-bottom:8px;">
            <div>
              <div style="font-size:0.72rem; font-weight:700; color:#1A73E8; text-transform:uppercase;">⚡ Bateador Actual (Turno ${(isTop ? this.awayLineupIndex : this.homeLineupIndex) + 1}/9)</div>
              <div style="font-size:1rem; font-weight:800; color:#202124;" class="text-truncate">${batterName}</div>
            </div>
            <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.72rem;" onclick="LiveScorer.showSubstitutionModal('batter')">🔄 Sustituir</button>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px;">
            <div>
              <div style="font-size:0.72rem; font-weight:700; color:#1A73E8; text-transform:uppercase;">⚾ Lanzador Actual</div>
              <div style="font-size:1rem; font-weight:800; color:#202124;" class="text-truncate">${pitcherName}</div>
            </div>
            <button class="md-btn md-btn-outlined" style="padding:4px 8px; font-size:0.72rem;" onclick="LiveScorer.showSubstitutionModal('pitcher')">🔄 Cambiar Pitcher</button>
          </div>
        </div>

        <!-- One-Tap Action Buttons -->
        <div class="view-section">
          <div class="section-header">
            <h3 class="section-title">⚡ Registrar Jugada (Avanza Bateador Automáticamente)</h3>
          </div>

          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
            <button class="md-btn md-btn-primary" onclick="LiveScorer.recordPlay('1B', 'Sencillo (1B)')">1B Sencillo</button>
            <button class="md-btn md-btn-primary" onclick="LiveScorer.recordPlay('2B', 'Doble (2B)')">2B Doble</button>
            <button class="md-btn md-btn-primary" onclick="LiveScorer.recordPlay('3B', 'Triple (3B)')">3B Triple</button>

            <button class="md-btn md-btn-primary" style="grid-column: span 3;" onclick="LiveScorer.recordPlay('HR', '¡JONRÓN! Quadrangular (HR)')">💥 JONRÓN (HR)</button>

            <button class="md-btn md-btn-outlined" onclick="LiveScorer.recordPlay('BB', 'Base por Bolas (BB)')">BB (Base)</button>
            <button class="md-btn md-btn-outlined" onclick="LiveScorer.recordPlay('K', 'Ponche (SO)')">SO (Ponche)</button>
            <button class="md-btn md-btn-outlined" onclick="LiveScorer.recordPlay('OUT', 'Out en elevación/rodado')">Out (F/G)</button>

            <button class="md-btn md-btn-danger" style="grid-column: span 3;" onclick="LiveScorer.recordRunScored()">⚽ +1 Carrera Anotada</button>
          </div>
        </div>

        <!-- Change Inning Button -->
        <div style="display:flex; gap:10px;">
          <button class="md-btn md-btn-outlined" style="flex:1;" onclick="LiveScorer.toggleHalfInning()">🔁 Cambiar de Entrada / Inning</button>
          <button class="md-btn md-btn-primary" style="flex:1;" onclick="LiveScorer.finishGame()">🏁 Finalizar Partido</button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  recordPlay(code, label) {
    if (!this.activeBatterId || !this.activePitcherId) {
      App.showAlert("Anotación en Vivo", "Por favor asegúrate de tener seleccionados un bateador y un lanzador activos.", "warning", "#EF4444");
      return;
    }

    const runs = (code === 'HR') ? 1 : 0;
    if (code === 'OUT' || code === 'K') {
      this.outsCount++;
      if (this.outsCount >= 3) {
        App.showSnackbar("¡3 Outs completados! Cambio automático de media entrada.");
        this.outsCount = 0;
        this.toggleHalfInning();
        return;
      }
    }

    const payload = {
      game_id: this.game.id,
      inning: this.game.current_inning,
      half_inning: this.game.half_inning,
      batter_id: this.activeBatterId,
      pitcher_id: this.activePitcherId,
      outs_before: this.outsCount,
      result_code: code,
      description: label,
      runs_scored: runs
    };

    fetch('api/live_score.php?action=record_play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(res => res.json()).then(data => {
      if (data.success) {
        App.showSnackbar(`Jugada registrada: ${label}`);
        // PILOTO AUTOMÁTICO: Avanza al siguiente bateador del lineup automáticamente
        this.advanceBatterLineup();
        this.renderScorerInterface();
      } else {
        App.showSnackbar(data.message || 'Error al registrar la jugada.');
      }
    });
  },

  recordRunScored() {
    const isTop = this.game.half_inning === 'top';
    if (isTop) {
      this.game.away_score++;
    } else {
      this.game.home_score++;
    }
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
    const confirmed = await App.showConfirm("Finalizar Partido", "¿Está seguro de que desea dar por finalizado oficialmente este partido?", "sports_baseball", "#EF4444");
    if (confirmed) {
      fetch('api/games.php?action=update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.game.id,
          status: 'finished',
          stadium_id: this.game.stadium_id,
          game_date: this.game.game_date
        })
      }).then(res => res.json()).then(data => {
        App.showAlert("Partido Finalizado", "El resultado final ha sido registrado exitosamente.", "check_circle", "#10B981");
        App.showView('game_detail', this.game.id);
      });
    }
  }
};

/**
 * Interactive Baseball Live Scorer for Liga Metropolitana de Béisbol (LMB)
 * Handles play-by-play scoring, runner diamond, pitch counts & substitutions
 */

const LiveScorer = {
  gameData: null,
  currentOuts: 0,
  runner1B: null,
  runner2B: null,
  runner3B: null,

  init(gameDetail) {
    this.gameData = gameDetail;
    this.currentOuts = 0;
    this.runner1B = null;
    this.runner2B = null;
    this.runner3B = null;
    this.renderScorerUI();
  },

  renderScorerUI() {
    const container = document.getElementById('view-container');
    if (!container || !this.gameData) return;

    const game = this.gameData.game;
    const isHome = (game.half_inning === 'bottom');
    const battingTeamName = isHome ? game.home_team_name : game.away_team_name;
    const pitchingTeamName = isHome ? game.away_team_name : game.home_team_name;
    const batters = isHome ? this.gameData.home_batters : this.gameData.away_batters;
    const pitchers = isHome ? this.gameData.away_pitchers : this.gameData.home_pitchers;

    container.innerHTML = `
      <div class="view-content">
        <!-- Live Header Bar -->
        <div class="md-card" style="background: linear-gradient(135deg, #1E3A8A 0%, #0A192F 100%);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="md-chip active" style="background:#D32F2F;">🔴 EN VIVO - ${game.half_inning === 'top' ? '▲' : '▼'} Inning ${game.current_inning}</span>
            <span style="font-size:0.8rem; font-weight:700; color:#FFC107;">Outs: ${'⚫'.repeat(this.currentOuts)}${'⚪'.repeat(3 - this.currentOuts)}</span>
          </div>

          <div style="display:flex; justify-content:space-around; align-items:center; margin-top:8px;">
            <div style="text-align:center;">
              <img src="${game.away_logo || 'assets/images/lmb_logo.png'}" style="width:36px; height:36px; border-radius:50%;">
              <div style="font-weight:800; font-size:0.9rem;">${game.away_short}</div>
              <div style="font-size:1.8rem; font-weight:800; color:#FFFFFF;">${game.away_score}</div>
            </div>
            <div style="font-size:1.2rem; font-weight:800; color:#64748B;">VS</div>
            <div style="text-align:center;">
              <img src="${game.home_logo || 'assets/images/lmb_logo.png'}" style="width:36px; height:36px; border-radius:50%;">
              <div style="font-weight:800; font-size:0.9rem;">${game.home_short}</div>
              <div style="font-size:1.8rem; font-weight:800; color:#FFFFFF;">${game.home_score}</div>
            </div>
          </div>
        </div>

        <!-- Baseball Diamond Graphic -->
        <div class="baseball-diamond-wrapper">
          <div class="diamond-base base-home"></div>
          <div class="diamond-base base-1b ${this.runner1B ? 'active' : ''}"></div>
          <div class="diamond-base base-2b ${this.runner2B ? 'active' : ''}"></div>
          <div class="diamond-base base-3b ${this.runner3B ? 'active' : ''}"></div>
        </div>

        <!-- Active Batter & Pitcher Selectors -->
        <div class="md-card">
          <div style="font-size:0.85rem; font-weight:800; color:#FFC107;">BATEANDO: ${battingTeamName}</div>
          <div class="form-group">
            <label>Bateador Actual</label>
            <select id="select-batter" class="form-control">
              ${batters.length ? batters.map(b => `<option value="${b.player_id}">#${b.jersey_number} ${b.first_name} ${b.last_name} (${b.position || 'DH'})</option>`).join('') : '<option value="0">Seleccionar Jugador...</option>'}
            </select>
          </div>

          <div style="font-size:0.85rem; font-weight:800; color:#3B82F6; margin-top:8px;">LANZANDO: ${pitchingTeamName}</div>
          <div class="form-group">
            <label>Lanzador Actual</label>
            <select id="select-pitcher" class="form-control">
              ${pitchers.length ? pitchers.map(p => `<option value="${p.player_id}">#${p.jersey_number} ${p.first_name} ${p.last_name} (Lanzador)</option>`).join('') : '<option value="0">Seleccionar Lanzador...</option>'}
            </select>
          </div>
        </div>

        <!-- Scoring Action Buttons Grid -->
        <div class="md-card">
          <div style="font-size:0.9rem; font-weight:800; color:#FFFFFF;">REGISTRAR ACCIÓN DE BATEO</div>
          
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
            <button class="md-btn md-btn-primary" onclick="LiveScorer.recordPlay('1B', 'Sencillo (1B)', 0, 0, false)">Sencillo (1B)</button>
            <button class="md-btn md-btn-primary" onclick="LiveScorer.recordPlay('2B', 'Doblete (2B)', 0, 0, false)">Doblete (2B)</button>
            <button class="md-btn md-btn-primary" onclick="LiveScorer.recordPlay('3B', 'Triplete (3B)', 0, 0, false)">Triplete (3B)</button>
            
            <button class="md-btn md-btn-gold" onclick="LiveScorer.recordPlay('HR', '¡JONRÓN (HR)!', 1, 1, false)">Jonrón (HR)</button>
            <button class="md-btn md-btn-outlined" onclick="LiveScorer.recordPlay('BB', 'Base por Bolas (BB)', 0, 0, false)">Bases (BB)</button>
            <button class="md-btn md-btn-danger" onclick="LiveScorer.recordPlay('SO', 'Ponche (SO/K)', 0, 0, true)">Ponche (SO)</button>
            
            <button class="md-btn md-btn-outlined" onclick="LiveScorer.recordPlay('FO', 'Out de Fly (FO)', 0, 0, true)">Fly Out</button>
            <button class="md-btn md-btn-outlined" onclick="LiveScorer.recordPlay('GO', 'Out de Rola (GO)', 0, 0, true)">Rola Out</button>
            <button class="md-btn md-btn-outlined" onclick="LiveScorer.recordPlay('E', 'Llegó por Error (E)', 0, 0, false)">Error (E)</button>
          </div>

          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="md-btn md-btn-outlined" style="flex:1;" onclick="LiveScorer.promptRunnersAndRBI()">➕ Anotar Carrera / RBI</button>
            <button class="md-btn md-btn-outlined" style="flex:1;" onclick="LiveScorer.changeInningHalf()">🔄 Cambiar Inning</button>
          </div>
        </div>

        <!-- Controls: Finalize Game -->
        <div style="display:flex; justify-content:space-between; margin-top:8px;">
          <button class="md-btn md-btn-outlined" onclick="App.showView('game_detail', ${game.id})">⬅️ Volver a Resumen</button>
          <button class="md-btn md-btn-danger" onclick="LiveScorer.finalizeGame()">🏁 Finalizar Partido</button>
        </div>
      </div>
    `;
  },

  recordPlay(code, desc, defaultRuns = 0, defaultRbi = 0, isOut = false) {
    const batterId = document.getElementById('select-batter')?.value;
    const pitcherId = document.getElementById('select-pitcher')?.value;

    if (!batterId || !pitcherId) {
      alert("Por favor seleccione el bateador y lanzador actual.");
      return;
    }

    let runs = defaultRuns;
    let rbi = defaultRbi;

    if (code === 'HR' && (this.runner1B || this.runner2B || this.runner3B)) {
      let countOnBase = (this.runner1B ? 1 : 0) + (this.runner2B ? 1 : 0) + (this.runner3B ? 1 : 0);
      runs += countOnBase;
      rbi += countOnBase;
      this.runner1B = null; this.runner2B = null; this.runner3B = null;
    } else if (code === '1B') {
      this.runner1B = true;
    } else if (code === '2B') {
      this.runner2B = true;
    } else if (code === '3B') {
      this.runner3B = true;
    }

    if (isOut) {
      this.currentOuts++;
      if (this.currentOuts >= 3) {
        alert("¡3 Outs! Cambio de media entrada.");
        this.currentOuts = 0;
        this.runner1B = null; this.runner2B = null; this.runner3B = null;
        this.changeInningHalf();
        return;
      }
    }

    const payload = {
      game_id: this.gameData.game.id,
      action: 'record_play',
      batter_id: batterId,
      pitcher_id: pitcherId,
      result_code: code,
      description: desc,
      runs_scored: runs,
      rbi_count: rbi,
      is_out: isOut,
      outs_before: this.currentOuts
    };

    if (navigator.onLine) {
      fetch('api/live_score.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(res => res.json()).then(data => {
        if (data.success) {
          App.showSnackbar('✅ Jugada registrada.');
          this.refreshScorerState();
        }
      });
    } else {
      OfflineSync.enqueue('api/live_score.php', payload);
      App.showSnackbar('💾 Guardado offline localmente.');
      this.renderScorerUI();
    }
  },

  promptRunnersAndRBI() {
    const runs = prompt("¿Cuántas carreras se anotaron en esta jugada?", "1");
    if (runs !== null) {
      const rbi = prompt("¿Cuántas carreras impulsadas (RBI)?", runs);
      this.recordPlay('RUN', `Carrera anotada (${runs} R, ${rbi} RBI)`, parseInt(runs) || 0, parseInt(rbi) || 0, false);
    }
  },

  changeInningHalf() {
    const game = this.gameData.game;
    const nextHalf = (game.half_inning === 'top') ? 'bottom' : 'top';
    const nextInning = (game.half_inning === 'bottom') ? parseInt(game.current_inning) + 1 : game.current_inning;

    fetch('api/live_score.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_id: game.id,
        action: 'change_inning',
        current_inning: nextInning,
        half_inning: nextHalf
      })
    }).then(res => res.json()).then(() => {
      this.refreshScorerState();
    });
  },

  finalizeGame() {
    if (!confirm("¿Desea finalizar oficialmente este partido?")) return;

    fetch('api/live_score.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_id: this.gameData.game.id,
        action: 'finalize'
      })
    }).then(res => res.json()).then(data => {
      alert("Partido finalizado exitosamente.");
      App.showView('game_detail', this.gameData.game.id);
    });
  },

  refreshScorerState() {
    fetch(`api/games.php?action=detail&id=${this.gameData.game.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          this.gameData = data;
          this.renderScorerUI();
        }
      });
  }
};

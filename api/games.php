<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? 'list';

if ($action === 'list') {
    $categoryId = intval($_GET['category_id'] ?? 0);
    $status = trim($_GET['status'] ?? '');

    $sql = "SELECT g.*, 
                   COALESCE(ht.name, 'Equipo Local') as home_team_name, COALESCE(ht.short_name, 'LOC') as home_short, ht.logo_url as home_logo, ht.color_primary as home_color,
                   COALESCE(at.name, 'Equipo Visitante') as away_team_name, COALESCE(at.short_name, 'VIS') as away_short, at.logo_url as away_logo, at.color_primary as away_color,
                   COALESCE(c.name, 'Sin Categoría') as category_name, COALESCE(c.code, 'GEN') as category_code,
                   s.name as stadium_name, s.field_name as stadium_field, s.address as stadium_address
            FROM games g
            LEFT JOIN teams ht ON g.home_team_id = ht.id
            LEFT JOIN teams at ON g.away_team_id = at.id
            LEFT JOIN categories c ON g.category_id = c.id
            LEFT JOIN stadiums s ON g.stadium_id = s.id";

    $where = [];
    if ($categoryId > 0) $where[] = "g.category_id = {$categoryId}";
    if (!empty($status)) $where[] = "g.status = '{$status}'";

    if (!empty($where)) {
        $sql .= " WHERE " . implode(' AND ', $where);
    }
    $sql .= " ORDER BY g.game_date DESC";

    $stmt = $pdo->query($sql);
    $games = $stmt->fetchAll();

    echo json_encode(['success' => true, 'games' => $games]);
    exit;
}

if ($action === 'detail') {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID de partido requerido.']);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT g.*, 
               COALESCE(ht.name, 'Equipo Local') as home_team_name, COALESCE(ht.short_name, 'LOC') as home_short, ht.logo_url as home_logo, ht.color_primary as home_color,
               COALESCE(at.name, 'Equipo Visitante') as away_team_name, COALESCE(at.short_name, 'VIS') as away_short, at.logo_url as away_logo, at.color_primary as away_color,
               COALESCE(c.name, 'Sin Categoría') as category_name,
               s.name as stadium_name, s.field_name as stadium_field, s.address as stadium_address, s.maps_url as stadium_maps,
               u.name as lock_user_name
        FROM games g
        LEFT JOIN teams ht ON g.home_team_id = ht.id
        LEFT JOIN teams at ON g.away_team_id = at.id
        LEFT JOIN categories c ON g.category_id = c.id
        LEFT JOIN stadiums s ON g.stadium_id = s.id
        LEFT JOIN users u ON g.lock_user_id = u.id
        WHERE g.id = ?
    ");
    $stmt->execute([$id]);
    $game = $stmt->fetch();

    if (!$game) {
        echo json_encode(['success' => false, 'message' => 'Partido no encontrado.']);
        exit;
    }

    // Line Scores
    $stmtLine = $pdo->prepare("SELECT * FROM game_line_scores WHERE game_id = ? ORDER BY team_id, inning ASC");
    $stmtLine->execute([$id]);
    $lines = $stmtLine->fetchAll();

    $lineScores = [
        'home' => [],
        'away' => []
    ];

    if (!empty($lines)) {
        foreach ($lines as $l) {
            $key = ($l['team_id'] == $game['home_team_id']) ? 'home' : 'away';
            $lineScores[$key][intval($l['inning'])] = intval($l['runs']);
        }
    }

    // Batting Box Scores
    $stmtBatHome = $pdo->prepare("
        SELECT bs.*, p.first_name, p.last_name, p.jersey_number, p.bats
        FROM game_batting_stats bs
        JOIN players p ON bs.player_id = p.id
        WHERE bs.game_id = ? AND bs.team_id = ?
        ORDER BY bs.batting_order ASC
    ");
    $stmtBatHome->execute([$id, $game['home_team_id']]);
    $homeBatters = $stmtBatHome->fetchAll();

    $stmtBatAway = $pdo->prepare("
        SELECT bs.*, p.first_name, p.last_name, p.jersey_number, p.bats
        FROM game_batting_stats bs
        JOIN players p ON bs.player_id = p.id
        WHERE bs.game_id = ? AND bs.team_id = ?
        ORDER BY bs.batting_order ASC
    ");
    $stmtBatAway->execute([$id, $game['away_team_id']]);
    $awayBatters = $stmtBatAway->fetchAll();

    // Pitching Box Scores
    $stmtPitchHome = $pdo->prepare("
        SELECT ps.*, p.first_name, p.last_name, p.jersey_number
        FROM game_pitching_stats ps
        JOIN players p ON ps.player_id = p.id
        WHERE ps.game_id = ? AND ps.team_id = ?
        ORDER BY ps.is_starter DESC, ps.id ASC
    ");
    $stmtPitchHome->execute([$id, $game['home_team_id']]);
    $homePitchers = $stmtPitchHome->fetchAll();

    $stmtPitchAway = $pdo->prepare("
        SELECT ps.*, p.first_name, p.last_name, p.jersey_number
        FROM game_pitching_stats ps
        JOIN players p ON ps.player_id = p.id
        WHERE ps.game_id = ? AND ps.team_id = ?
        ORDER BY ps.is_starter DESC, ps.id ASC
    ");
    $stmtPitchAway->execute([$id, $game['away_team_id']]);
    $awayPitchers = $stmtPitchAway->fetchAll();

    // Play-by-play logs
    $stmtPbp = $pdo->prepare("
        SELECT pbp.*, 
               b.first_name as batter_first, b.last_name as batter_last, b.jersey_number as batter_num,
               p.first_name as pitcher_first, p.last_name as pitcher_last, p.jersey_number as pitcher_num
        FROM game_play_by_play pbp
        JOIN players b ON pbp.batter_id = b.id
        JOIN players p ON pbp.pitcher_id = p.id
        WHERE pbp.game_id = ?
        ORDER BY pbp.id DESC
    ");
    $stmtPbp->execute([$id]);
    $playByPlay = $stmtPbp->fetchAll();

    // Game Postcards (Max 10)
    $stmtPhotos = $pdo->prepare("SELECT * FROM game_photos WHERE game_id = ? ORDER BY id ASC LIMIT 10");
    $stmtPhotos->execute([$id]);
    $photos = $stmtPhotos->fetchAll();

    // Active Team Rosters from players table
    $stmtRosterHome = $pdo->prepare("SELECT id as player_id, team_id, first_name, last_name, jersey_number, position_primary as position, bats, throws, role_type FROM players WHERE team_id = ? AND is_active = 1 ORDER BY jersey_number ASC");
    $stmtRosterHome->execute([$game['home_team_id']]);
    $homeRoster = $stmtRosterHome->fetchAll();

    $stmtRosterAway = $pdo->prepare("SELECT id as player_id, team_id, first_name, last_name, jersey_number, position_primary as position, bats, throws, role_type FROM players WHERE team_id = ? AND is_active = 1 ORDER BY jersey_number ASC");
    $stmtRosterAway->execute([$game['away_team_id']]);
    $awayRoster = $stmtRosterAway->fetchAll();

    echo json_encode([
        'success' => true,
        'game' => $game,
        'line_scores' => $lineScores,
        'home_batters' => $homeBatters,
        'away_batters' => $awayBatters,
        'home_pitchers' => $homePitchers,
        'away_pitchers' => $awayPitchers,
        'home_roster' => $homeRoster,
        'away_roster' => $awayRoster,
        'play_by_play' => $playByPlay,
        'photos' => $photos
    ]);
    exit;
}

// Create Game
if ($action === 'create' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin', 'scorekeeper', 'team_admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $categoryId = intval($input['category_id'] ?? 0);
    $homeTeamId = intval($input['home_team_id'] ?? 0);
    $awayTeamId = intval($input['away_team_id'] ?? 0);
    $stadiumId = !empty($input['stadium_id']) ? intval($input['stadium_id']) : null;
    $gameDate = trim($input['game_date'] ?? date('Y-m-d H:i:s'));
    $gameStage = trim($input['game_stage'] ?? 'Temporada Regular');

    if (!$categoryId || !$homeTeamId || !$awayTeamId) {
        echo json_encode(['success' => false, 'message' => 'Categoría, equipo local y visitante requeridos.']);
        exit;
    }

    $stmtCat = $pdo->prepare("SELECT season_id FROM categories WHERE id = ?");
    $stmtCat->execute([$categoryId]);
    $cat = $stmtCat->fetch();
    $seasonId = $cat['season_id'] ?? 1;

    $stmtSt = $pdo->prepare("SELECT name, field_name FROM stadiums WHERE id = ?");
    $stmtSt->execute([$stadiumId]);
    $stInfo = $stmtSt->fetch();
    $fieldLocation = $stInfo ? "{$stInfo['name']} ({$stInfo['field_name']})" : 'Sede Principal LMB';

    $stmt = $pdo->prepare("INSERT INTO games (season_id, category_id, home_team_id, away_team_id, stadium_id, game_date, field_location, status, game_stage) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)");
    $stmt->execute([$seasonId, $categoryId, $homeTeamId, $awayTeamId, $stadiumId, $gameDate, $fieldLocation, $gameStage]);
    $gameId = $pdo->lastInsertId();

    logAuditAction($pdo, 'CREATE_GAME', "Programó un nuevo partido ({$gameStage}) para la fecha {$gameDate}.");

    echo json_encode(['success' => true, 'game_id' => $gameId, 'message' => 'Partido programado en el calendario.']);
    exit;
}

// Update Game (Reschedule / Edit Date / Change Venue / Edit Status / Stage)
if ($action === 'update' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin', 'scorekeeper'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $gameId = intval($input['id'] ?? 0);
    $stadiumId = !empty($input['stadium_id']) ? intval($input['stadium_id']) : null;
    $gameDate = trim($input['game_date'] ?? '');
    $status = trim($input['status'] ?? 'scheduled');
    $gameStage = trim($input['game_stage'] ?? 'Temporada Regular');

    if (!$gameId) {
        echo json_encode(['success' => false, 'message' => 'ID de partido requerido.']);
        exit;
    }

    $stmtSt = $pdo->prepare("SELECT name, field_name FROM stadiums WHERE id = ?");
    $stmtSt->execute([$stadiumId]);
    $stInfo = $stmtSt->fetch();
    $fieldLocation = $stInfo ? "{$stInfo['name']} ({$stInfo['field_name']})" : 'Sede LMB';

    $stmt = $pdo->prepare("UPDATE games SET stadium_id = ?, game_date = ?, field_location = ?, status = ?, game_stage = ? WHERE id = ?");
    $stmt->execute([$stadiumId, $gameDate, $fieldLocation, $status, $gameStage, $gameId]);

    logAuditAction($pdo, 'UPDATE_GAME', "Actualizó los datos del partido ID {$gameId} (Etapa: {$gameStage}, Estado: {$status}).");

    echo json_encode(['success' => true, 'message' => 'Datos del partido actualizados exitosamente.']);
    exit;
}

// Update Direct Game Result & Status
if ($action === 'update_result' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin', 'scorekeeper', 'team_admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $gameId = intval($input['id'] ?? 0);
    $status = trim($input['status'] ?? 'finished');
    $homeScore = intval($input['home_score'] ?? 0);
    $awayScore = intval($input['away_score'] ?? 0);
    $homeHits = intval($input['home_hits'] ?? 0);
    $awayHits = intval($input['away_hits'] ?? 0);
    $homeErrors = intval($input['home_errors'] ?? 0);
    $awayErrors = intval($input['away_errors'] ?? 0);
    $recapNotes = trim($input['recap_notes'] ?? '');
    $winningPitcherId = !empty($input['winning_pitcher_id']) ? intval($input['winning_pitcher_id']) : null;
    $losingPitcherId = !empty($input['losing_pitcher_id']) ? intval($input['losing_pitcher_id']) : null;
    $savingPitcherId = !empty($input['saving_pitcher_id']) ? intval($input['saving_pitcher_id']) : null;
    $mvpPlayerId = !empty($input['mvp_player_id']) ? intval($input['mvp_player_id']) : null;

    if (!$gameId) {
        echo json_encode(['success' => false, 'message' => 'ID de partido requerido.']);
        exit;
    }

    $allowedStatuses = ['scheduled', 'live', 'delayed', 'awaiting_data', 'finished', 'cancelled'];
    if (!in_array($status, $allowedStatuses)) {
        $status = 'finished';
    }

    $stmt = $pdo->prepare("UPDATE games SET 
        status = ?, 
        home_score = ?, 
        away_score = ?, 
        home_hits = ?, 
        away_hits = ?, 
        home_errors = ?, 
        away_errors = ?, 
        recap_notes = ?, 
        winning_pitcher_id = ?, 
        losing_pitcher_id = ?, 
        saving_pitcher_id = ?, 
        mvp_player_id = ? 
        WHERE id = ?");
    $stmt->execute([
        $status, 
        $homeScore, 
        $awayScore, 
        $homeHits, 
        $awayHits, 
        $homeErrors, 
        $awayErrors, 
        $recapNotes, 
        $winningPitcherId, 
        $losingPitcherId, 
        $savingPitcherId, 
        $mvpPlayerId, 
        $gameId
    ]);

    // Save line_scores if provided
    if (isset($input['line_scores_away']) || isset($input['line_scores_home'])) {
        try {
            $stmtG = $pdo->prepare("SELECT home_team_id, away_team_id FROM games WHERE id = ?");
            $stmtG->execute([$gameId]);
            $gData = $stmtG->fetch();
            if ($gData) {
                $pdo->prepare("DELETE FROM game_line_scores WHERE game_id = ?")->execute([$gameId]);
                $stmtLS = $pdo->prepare("INSERT INTO game_line_scores (game_id, team_id, inning, runs) VALUES (?, ?, ?, ?)");
                if (!empty($input['line_scores_away']) && is_array($input['line_scores_away'])) {
                    foreach ($input['line_scores_away'] as $inn => $runs) {
                        if ($runs !== '' && $runs !== null) {
                            $stmtLS->execute([$gameId, $gData['away_team_id'], (int)$inn, (int)$runs]);
                        }
                    }
                }
                if (!empty($input['line_scores_home']) && is_array($input['line_scores_home'])) {
                    foreach ($input['line_scores_home'] as $inn => $runs) {
                        if ($runs !== '' && $runs !== null) {
                            $stmtLS->execute([$gameId, $gData['home_team_id'], (int)$inn, (int)$runs]);
                        }
                    }
                }
            }
        } catch(Exception $e){}
    }

    // Auto-crown champion if game_stage contains "Final" and status is "finished"
    if ($status === 'finished') {
        try {
            $stmtG = $pdo->prepare("SELECT season_id, category_id, home_team_id, away_team_id, game_stage FROM games WHERE id = ?");
            $stmtG->execute([$gameId]);
            $gData = $stmtG->fetch();

            if ($gData && stripos($gData['game_stage'], 'Final') !== false) {
                $winningTeamId = ($homeScore > awayScore) ? $gData['home_team_id'] : (($awayScore > homeScore) ? $gData['away_team_id'] : 0);
                if ($winningTeamId > 0) {
                    $pdo->prepare("DELETE FROM season_champions WHERE season_id = ? AND category_id = ?")->execute([$gData['season_id'], $gData['category_id']]);
                    $pdo->prepare("INSERT INTO season_champions (season_id, category_id, team_id, title_name, notes) VALUES (?, ?, ?, ?, ?)")
                        ->execute([$gData['season_id'], $gData['category_id'], $winningTeamId, 'Campeón Oficial', 'Ganador de la Final (' . $gData['game_stage'] . ')']);
                }
            }
        } catch(Exception $e){}
    }

    echo json_encode(['success' => true, 'message' => 'Resultado y estado del partido guardados exitosamente.']);
    exit;
}

// Save Player Stats Separately (Manual Boxscore Entry)
if ($action === 'save_manual_stats' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin', 'scorekeeper', 'team_admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $gameId = intval($input['game_id'] ?? 0);
    $teamId = intval($input['team_id'] ?? 0);
    $battingStats = $input['batting_stats'] ?? [];
    $pitchingStats = $input['pitching_stats'] ?? [];

    if (!$gameId || !$teamId) {
        echo json_encode(['success' => false, 'message' => 'ID de partido y equipo requeridos.']);
        exit;
    }

    // Process Batting Stats
    if (!empty($battingStats) && is_array($battingStats)) {
        foreach ($battingStats as $b) {
            $playerId = intval($b['player_id'] ?? 0);
            if (!$playerId) continue;

            $ab = intval($b['ab'] ?? 0);
            $r = intval($b['r'] ?? 0);
            $h = intval($b['h'] ?? 0);
            $singles = intval($b['singles'] ?? 0);
            $doubles = intval($b['doubles'] ?? 0);
            $triples = intval($b['triples'] ?? 0);
            $hr = intval($b['hr'] ?? 0);
            $rbi = intval($b['rbi'] ?? 0);
            $bb = intval($b['bb'] ?? 0);
            $so = intval($b['so'] ?? 0);
            $sb = intval($b['sb'] ?? 0);
            $e = intval($b['e'] ?? 0);
            $pos = trim($b['position'] ?? 'DH');

            // Check existing
            $stmtCheck = $pdo->prepare("SELECT id FROM game_batting_stats WHERE game_id = ? AND player_id = ?");
            $stmtCheck->execute([$gameId, $playerId]);
            $existing = $stmtCheck->fetch();

            if ($existing) {
                $pdo->prepare("UPDATE game_batting_stats SET team_id = ?, position = ?, ab = ?, r = ?, h = ?, singles = ?, doubles = ?, triples = ?, hr = ?, rbi = ?, bb = ?, so = ?, sb = ?, e = ? WHERE id = ?")
                    ->execute([$teamId, $pos, $ab, $r, $h, $singles, $doubles, $triples, $hr, $rbi, $bb, $so, $sb, $e, $existing['id']]);
            } else {
                $pdo->prepare("INSERT INTO game_batting_stats (game_id, team_id, player_id, position, ab, r, h, singles, doubles, triples, hr, rbi, bb, so, sb, e) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                    ->execute([$gameId, $teamId, $playerId, $pos, $ab, $r, $h, $singles, $doubles, $triples, $hr, $rbi, $bb, $so, $sb, $e]);
            }
        }
    }

    // Process Pitching Stats
    if (!empty($pitchingStats) && is_array($pitchingStats)) {
        foreach ($pitchingStats as $p) {
            $playerId = intval($p['player_id'] ?? 0);
            if (!$playerId) continue;

            $ipOuts = intval($p['ip_outs'] ?? 0);
            $h = intval($p['h'] ?? 0);
            $r = intval($p['r'] ?? 0);
            $er = intval($p['er'] ?? 0);
            $bb = intval($p['bb'] ?? 0);
            $so = intval($p['so'] ?? 0);
            $hr = intval($p['hr'] ?? 0);
            $isStarter = !empty($p['is_starter']) ? 1 : 0;
            $decision = trim($p['decision'] ?? 'NONE');

            // Check existing
            $stmtCheck = $pdo->prepare("SELECT id FROM game_pitching_stats WHERE game_id = ? AND player_id = ?");
            $stmtCheck->execute([$gameId, $playerId]);
            $existing = $stmtCheck->fetch();

            if ($existing) {
                $pdo->prepare("UPDATE game_pitching_stats SET team_id = ?, ip_outs = ?, h = ?, r = ?, er = ?, bb = ?, so = ?, hr = ?, is_starter = ?, decision = ? WHERE id = ?")
                    ->execute([$teamId, $ipOuts, $h, $r, $er, $bb, $so, $hr, $isStarter, $decision, $existing['id']]);
            } else {
                $pdo->prepare("INSERT INTO game_pitching_stats (game_id, team_id, player_id, ip_outs, h, r, er, bb, so, hr, is_starter, decision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                    ->execute([$gameId, $teamId, $playerId, $ipOuts, $h, $r, $er, $bb, $so, $hr, $isStarter, $decision]);
            }
        }
    }

    // Auto-update game status to finished if stats were entered for a scheduled or awaiting game
    $pdo->prepare("UPDATE games SET status = 'finished' WHERE id = ? AND status IN ('scheduled', 'awaiting_data')")->execute([$gameId]);

    echo json_encode(['success' => true, 'message' => 'Estadísticas de jugadores guardadas correctamente.']);
    exit;
}

// Delete Game
if ($action === 'delete' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $gameId = intval($input['id'] ?? 0);

    if (!$gameId) {
        echo json_encode(['success' => false, 'message' => 'ID de partido requerido.']);
        exit;
    }

    $pdo->prepare("DELETE FROM game_photos WHERE game_id = ?")->execute([$gameId]);
    $pdo->prepare("DELETE FROM game_play_by_play WHERE game_id = ?")->execute([$gameId]);
    $pdo->prepare("DELETE FROM game_batting_stats WHERE game_id = ?")->execute([$gameId]);
    $pdo->prepare("DELETE FROM game_pitching_stats WHERE game_id = ?")->execute([$gameId]);
    $pdo->prepare("DELETE FROM game_line_scores WHERE game_id = ?")->execute([$gameId]);
    $pdo->prepare("DELETE FROM games WHERE id = ?")->execute([$gameId]);

    echo json_encode(['success' => true, 'message' => 'Partido eliminado del calendario.']);
    exit;
}


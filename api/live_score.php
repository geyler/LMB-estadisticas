<?php
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
    exit;
}

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'message' => 'Debe iniciar sesión para anotar partidos.']);
    exit;
}

$currentUser = $_SESSION['user'];
$input = json_decode(file_get_contents('php://input'), true);

$gameId = intval($input['game_id'] ?? 0);
$action = trim($input['action'] ?? 'record_play');

if (!$gameId) {
    echo json_encode(['success' => false, 'message' => 'ID de partido requerido.']);
    exit;
}

// Fetch game info
$stmt = $pdo->prepare("SELECT * FROM games WHERE id = ?");
$stmt->execute([$gameId]);
$game = $stmt->fetch();

if (!$game) {
    echo json_encode(['success' => false, 'message' => 'Partido no encontrado.']);
    exit;
}

// Check team-level permission if user has assigned_team_id
if ($currentUser['role'] === 'team_admin' && !empty($currentUser['assigned_team_id'])) {
    if ($currentUser['assigned_team_id'] != $game['home_team_id'] && $currentUser['assigned_team_id'] != $game['away_team_id']) {
        echo json_encode(['success' => false, 'message' => 'Solo puedes anotar partidos de tu equipo asignado.']);
        exit;
    }
}

// Check Scorekeeper Single Lock ("una sola persona a la vez llevando el momento a momento del partido")
$lockTimeThreshold = date('Y-m-d H:i:s', strtotime('-15 minutes'));
if (!empty($game['lock_user_id']) && $game['lock_user_id'] != $currentUser['id'] && $game['lock_timestamp'] > $lockTimeThreshold) {
    // Fetch lock user name
    $stmtLock = $pdo->prepare("SELECT name FROM users WHERE id = ?");
    $stmtLock->execute([$game['lock_user_id']]);
    $lockUser = $stmtLock->fetch();
    $lockName = $lockUser ? $lockUser['name'] : 'otro anotador';

    echo json_encode([
        'success' => false,
        'message' => "🔒 Partido bloqueado: {$lockName} está anotando este partido actualmente. Solo 1 persona a la vez puede anotar en vivo."
    ]);
    exit;
}

// Acquire/Renew lock
$pdo->prepare("UPDATE games SET lock_user_id = ?, lock_timestamp = ? WHERE id = ?")
    ->execute([$currentUser['id'], date('Y-m-d H:i:s'), $gameId]);

// Action 1: Record Play (At-Bat Action)
if ($action === 'record_play') {
    $batterId = intval($input['batter_id'] ?? 0);
    $pitcherId = intval($input['pitcher_id'] ?? 0);
    $resultCode = trim($input['result_code'] ?? '1B');
    $description = trim($input['description'] ?? '');
    $runsScored = intval($input['runs_scored'] ?? 0);
    $rbiCount = intval($input['rbi_count'] ?? 0);
    $isOut = !empty($input['is_out']);
    $outsBefore = intval($input['outs_before'] ?? 0);

    if (!$batterId || !$pitcherId) {
        echo json_encode(['success' => false, 'message' => 'Bateador y lanzador requeridos.']);
        exit;
    }

    $isHomeBatting = ($game['half_inning'] === 'bottom');
    $battingTeamId = $isHomeBatting ? $game['home_team_id'] : $game['away_team_id'];
    $pitchingTeamId = $isHomeBatting ? $game['away_team_id'] : $game['home_team_id'];

    // Update status to live if scheduled
    if ($game['status'] === 'scheduled') {
        $pdo->prepare("UPDATE games SET status = 'live' WHERE id = ?")->execute([$gameId]);
    }

    // Insert Play-by-Play record
    $stmtPbp = $pdo->prepare("INSERT INTO game_play_by_play (game_id, inning, half_inning, batter_id, pitcher_id, outs_before, result_code, description, runs_scored) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtPbp->execute([$gameId, $game['current_inning'], $game['half_inning'], $batterId, $pitcherId, $outsBefore, $resultCode, $description, $runsScored]);

    // Upsert Batting Stats
    $stmtBCheck = $pdo->prepare("SELECT * FROM game_batting_stats WHERE game_id = ? AND player_id = ?");
    $stmtBCheck->execute([$gameId, $batterId]);
    $bStat = $stmtBCheck->fetch();

    $isAB = !in_array($resultCode, ['BB', 'HBP', 'SF']);
    $isH = in_array($resultCode, ['1B', '2B', '3B', 'HR']);
    $is1B = ($resultCode === '1B') ? 1 : 0;
    $is2B = ($resultCode === '2B') ? 1 : 0;
    $is3B = ($resultCode === '3B') ? 1 : 0;
    $isHR = ($resultCode === 'HR') ? 1 : 0;
    $isBB = ($resultCode === 'BB') ? 1 : 0;
    $isSO = ($resultCode === 'SO') ? 1 : 0;
    $isSB = ($resultCode === 'SB') ? 1 : 0;
    $isHBP = ($resultCode === 'HBP') ? 1 : 0;
    $isSF = ($resultCode === 'SF') ? 1 : 0;

    if ($bStat) {
        $pdo->prepare("UPDATE game_batting_stats SET 
            ab = ab + ?, r = r + ?, h = h + ?, singles = singles + ?, doubles = doubles + ?, 
            triples = triples + ?, hr = hr + ?, rbi = rbi + ?, bb = bb + ?, so = so + ?, 
            sb = sb + ?, hbp = hbp + ?, sf = sf + ? WHERE id = ?")
        ->execute([$isAB?1:0, $runsScored, $isH?1:0, $is1B, $is2B, $is3B, $isHR, $rbiCount, $isBB, $isSO, $isSB, $isHBP, $isSF, $bStat['id']]);
    } else {
        $pdo->prepare("INSERT INTO game_batting_stats (game_id, team_id, player_id, ab, r, h, singles, doubles, triples, hr, rbi, bb, so, sb, hbp, sf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([$gameId, $battingTeamId, $batterId, $isAB?1:0, $runsScored, $isH?1:0, $is1B, $is2B, $is3B, $isHR, $rbiCount, $isBB, $isSO, $isSB, $isHBP, $isSF]);
    }

    // Upsert Pitching Stats
    $stmtPCheck = $pdo->prepare("SELECT * FROM game_pitching_stats WHERE game_id = ? AND player_id = ?");
    $stmtPCheck->execute([$gameId, $pitcherId]);
    $pStat = $stmtPCheck->fetch();

    $ipOut = $isOut ? 1 : 0;

    if ($pStat) {
        $pdo->prepare("UPDATE game_pitching_stats SET 
            ip_outs = ip_outs + ?, h = h + ?, r = r + ?, er = er + ?, bb = bb + ?, so = so + ?, hr = hr + ?, pitches_count = pitches_count + 1 WHERE id = ?")
        ->execute([$ipOut, $isH?1:0, $runsScored, $runsScored, $isBB, $isSO, $isHR, $pStat['id']]);
    } else {
        $pdo->prepare("INSERT INTO game_pitching_stats (game_id, team_id, player_id, ip_outs, h, r, er, bb, so, hr, pitches_count, is_starter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)")
        ->execute([$gameId, $pitchingTeamId, $pitcherId, $ipOut, $isH?1:0, $runsScored, $runsScored, $isBB, $isSO, $isHR]);
    }

    // Update Game Score & Hits
    if ($runsScored > 0 || $isH) {
        $scoreCol = $isHomeBatting ? 'home_score' : 'away_score';
        $hitsCol = $isHomeBatting ? 'home_hits' : 'away_hits';
        $pdo->prepare("UPDATE games SET {$scoreCol} = {$scoreCol} + ?, {$hitsCol} = {$hitsCol} + ? WHERE id = ?")
            ->execute([$runsScored, $isH?1:0, $gameId]);

        // Update Line Score
        $stmtL = $pdo->prepare("SELECT id FROM game_line_scores WHERE game_id = ? AND team_id = ? AND inning = ?");
        $stmtL->execute([$gameId, $battingTeamId, $game['current_inning']]);
        $lineRow = $stmtL->fetch();

        if ($lineRow) {
            $pdo->prepare("UPDATE game_line_scores SET runs = runs + ? WHERE id = ?")->execute([$runsScored, $lineRow['id']]);
        } else {
            $pdo->prepare("INSERT INTO game_line_scores (game_id, team_id, inning, runs) VALUES (?, ?, ?, ?)")
                ->execute([$gameId, $battingTeamId, $game['current_inning'], $runsScored]);
        }
    }

    echo json_encode(['success' => true, 'message' => 'Jugada registrada en vivo.']);
    exit;
}

// Action 2: Inning Half Change
if ($action === 'change_inning') {
    $nextInning = intval($input['current_inning'] ?? $game['current_inning']);
    $nextHalf = trim($input['half_inning'] ?? ($game['half_inning'] === 'top' ? 'bottom' : 'top'));

    $pdo->prepare("UPDATE games SET current_inning = ?, half_inning = ? WHERE id = ?")
        ->execute([$nextInning, $nextHalf, $gameId]);

    echo json_encode(['success' => true, 'message' => "Cambio a entrada {$nextHalf} inning {$nextInning}."]);
    exit;
}

// Action 3: Finalize Match
if ($action === 'finalize') {
    $pdo->prepare("UPDATE games SET status = 'finished', lock_user_id = NULL WHERE id = ?")->execute([$gameId]);
    echo json_encode(['success' => true, 'message' => 'Partido finalizado oficialmente.']);
    exit;
}

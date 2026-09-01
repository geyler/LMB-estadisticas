<?php
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$gameId = intval($input['game_id'] ?? 0);
$action = trim($input['action'] ?? 'record_play');

if (!$gameId) {
    echo json_encode(['success' => false, 'message' => 'ID de partido requerido.']);
    exit;
}

// Fetch active game details
$stmtG = $pdo->prepare("SELECT * FROM games WHERE id = ?");
$stmtG->execute([$gameId]);
$game = $stmtG->fetch();

if (!$game) {
    echo json_encode(['success' => false, 'message' => 'Partido no encontrado.']);
    exit;
}

if ($action === 'record_play') {
    $batterId = intval($input['batter_id'] ?? 0);
    $pitcherId = intval($input['pitcher_id'] ?? 0);
    $resultCode = trim($input['result_code'] ?? '1B');
    $description = trim($input['description'] ?? '');
    $runsScored = intval($input['runs_scored'] ?? 0);
    $rbiCount = intval($input['rbi_count'] ?? 0);
    $isOut = !empty($input['is_out']);
    $outCount = intval($input['outs_before'] ?? 0);

    $isHomeBatting = ($game['half_inning'] === 'bottom');
    $battingTeamId = $isHomeBatting ? $game['home_team_id'] : $game['away_team_id'];
    $pitchingTeamId = $isHomeBatting ? $game['away_team_id'] : $game['home_team_id'];

    // 1. Log play-by-play
    $stmtPbp = $pdo->prepare("INSERT INTO game_play_by_play (game_id, inning, half_inning, batter_id, pitcher_id, outs_before, result_code, description, runs_scored) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtPbp->execute([$gameId, $game['current_inning'], $game['half_inning'], $batterId, $pitcherId, $outCount, $resultCode, $description, $runsScored]);

    // 2. Update Batting Stats for Player
    $ab = in_array($resultCode, ['1B', '2B', '3B', 'HR', 'SO', 'GO', 'FO', 'E']) ? 1 : 0;
    $h = in_array($resultCode, ['1B', '2B', '3B', 'HR']) ? 1 : 0;
    $singles = ($resultCode === '1B') ? 1 : 0;
    $doubles = ($resultCode === '2B') ? 1 : 0;
    $triples = ($resultCode === '3B') ? 1 : 0;
    $hr = ($resultCode === 'HR') ? 1 : 0;
    $bb = ($resultCode === 'BB') ? 1 : 0;
    $so = ($resultCode === 'SO') ? 1 : 0;
    $sb = ($resultCode === 'SB') ? 1 : 0;
    $hbp = ($resultCode === 'HBP') ? 1 : 0;
    $sf = ($resultCode === 'SF') ? 1 : 0;
    $e = ($resultCode === 'E') ? 1 : 0;

    // Check if player batting stat row exists
    $stmtCheckB = $pdo->prepare("SELECT id FROM game_batting_stats WHERE game_id = ? AND player_id = ?");
    $stmtCheckB->execute([$gameId, $batterId]);
    $bRow = $stmtCheckB->fetch();

    if ($bRow) {
        $stmtUpB = $pdo->prepare("
            UPDATE game_batting_stats 
            SET ab = ab + ?, r = r + ?, h = h + ?, singles = singles + ?, doubles = doubles + ?, 
                triples = triples + ?, hr = hr + ?, rbi = rbi + ?, bb = bb + ?, so = so + ?, 
                sb = sb + ?, hbp = hbp + ?, sf = sf + ?, e = e + ?
            WHERE id = ?
        ");
        $stmtUpB->execute([$ab, $runsScored, $h, $singles, $doubles, $triples, $hr, $rbiCount, $bb, $so, $sb, $hbp, $sf, $e, $bRow['id']]);
    } else {
        $stmtInsB = $pdo->prepare("
            INSERT INTO game_batting_stats (game_id, team_id, player_id, ab, r, h, singles, doubles, triples, hr, rbi, bb, so, sb, hbp, sf, e)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmtInsB->execute([$gameId, $battingTeamId, $batterId, $ab, $runsScored, $h, $singles, $doubles, $triples, $hr, $rbiCount, $bb, $so, $sb, $hbp, $sf, $e]);
    }

    // 3. Update Pitching Stats for Pitcher
    $pitchOuts = $isOut ? 1 : 0;
    $stmtCheckP = $pdo->prepare("SELECT id FROM game_pitching_stats WHERE game_id = ? AND player_id = ?");
    $stmtCheckP->execute([$gameId, $pitcherId]);
    $pRow = $stmtCheckP->fetch();

    if ($pRow) {
        $stmtUpP = $pdo->prepare("
            UPDATE game_pitching_stats
            SET ip_outs = ip_outs + ?, h = h + ?, r = r + ?, er = er + ?, bb = bb + ?, so = so + ?, hr = hr + ?, pitches_count = pitches_count + 4
            WHERE id = ?
        ");
        $stmtUpP->execute([$pitchOuts, $h, $runsScored, $runsScored, $bb, $so, $hr, $pRow['id']]);
    } else {
        $stmtInsP = $pdo->prepare("
            INSERT INTO game_pitching_stats (game_id, team_id, player_id, ip_outs, h, r, er, bb, so, hr, pitches_count, is_starter)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4, 1)
        ");
        $stmtInsP->execute([$gameId, $pitchingTeamId, $pitcherId, $pitchOuts, $h, $runsScored, $runsScored, $bb, $so, $hr]);
    }

    // 4. Update Game Summary Scores & Line Scores
    if ($isHomeBatting) {
        $newHomeScore = $game['home_score'] + $runsScored;
        $newHomeHits = $game['home_hits'] + $h;
        $newAwayErrors = $game['away_errors'] + $e;

        $pdo->prepare("UPDATE games SET home_score = ?, home_hits = ?, away_errors = ?, status = 'live' WHERE id = ?")
            ->execute([$newHomeScore, $newHomeHits, $newAwayErrors, $gameId]);

        // Line score update
        $stmtL = $pdo->prepare("INSERT INTO game_line_scores (game_id, team_id, inning, runs) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE runs = runs + ?");
        try {
            $stmtL->execute([$gameId, $game['home_team_id'], $game['current_inning'], $runsScored, $runsScored]);
        } catch (Exception $ex) {
            // SQLite fallback
            $pdo->prepare("UPDATE game_line_scores SET runs = runs + ? WHERE game_id = ? AND team_id = ? AND inning = ?")
                ->execute([$runsScored, $gameId, $game['home_team_id'], $game['current_inning']]);
        }
    } else {
        $newAwayScore = $game['away_score'] + $runsScored;
        $newAwayHits = $game['away_hits'] + $h;
        $newHomeErrors = $game['home_errors'] + $e;

        $pdo->prepare("UPDATE games SET away_score = ?, away_hits = ?, home_errors = ?, status = 'live' WHERE id = ?")
            ->execute([$newAwayScore, $newAwayHits, $newHomeErrors, $gameId]);

        $stmtL = $pdo->prepare("INSERT INTO game_line_scores (game_id, team_id, inning, runs) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE runs = runs + ?");
        try {
            $stmtL->execute([$gameId, $game['away_team_id'], $game['current_inning'], $runsScored, $runsScored]);
        } catch (Exception $ex) {
            $pdo->prepare("UPDATE game_line_scores SET runs = runs + ? WHERE game_id = ? AND team_id = ? AND inning = ?")
                ->execute([$runsScored, $gameId, $game['away_team_id'], $game['current_inning']]);
        }
    }

    echo json_encode(['success' => true, 'message' => 'Jugada registrada correctamente.']);
    exit;
}

if ($action === 'change_inning') {
    $nextInning = intval($input['current_inning'] ?? $game['current_inning']);
    $nextHalf = trim($input['half_inning'] ?? ($game['half_inning'] === 'top' ? 'bottom' : 'top'));
    if ($game['half_inning'] === 'bottom' && $nextHalf === 'top') {
        $nextInning = $game['current_inning'] + 1;
    }

    $pdo->prepare("UPDATE games SET current_inning = ?, half_inning = ? WHERE id = ?")
        ->execute([$nextInning, $nextHalf, $gameId]);

    echo json_encode(['success' => true, 'current_inning' => $nextInning, 'half_inning' => $nextHalf]);
    exit;
}

if ($action === 'finalize') {
    $winningPitcherId = intval($input['winning_pitcher_id'] ?? 0);
    $losingPitcherId = intval($input['losing_pitcher_id'] ?? 0);
    $savingPitcherId = intval($input['saving_pitcher_id'] ?? 0);

    $stmtFinal = $pdo->prepare("UPDATE games SET status = 'finished', winning_pitcher_id = ?, losing_pitcher_id = ?, saving_pitcher_id = ? WHERE id = ?");
    $stmtFinal->execute([$winningPitcherId ?: null, $losingPitcherId ?: null, $savingPitcherId ?: null, $gameId]);

    if ($winningPitcherId) {
        $pdo->prepare("UPDATE game_pitching_stats SET decision = 'W' WHERE game_id = ? AND player_id = ?")->execute([$gameId, $winningPitcherId]);
    }
    if ($losingPitcherId) {
        $pdo->prepare("UPDATE game_pitching_stats SET decision = 'L' WHERE game_id = ? AND player_id = ?")->execute([$gameId, $losingPitcherId]);
    }
    if ($savingPitcherId) {
        $pdo->prepare("UPDATE game_pitching_stats SET decision = 'SV' WHERE game_id = ? AND player_id = ?")->execute([$gameId, $savingPitcherId]);
    }

    echo json_encode(['success' => true, 'message' => 'Partido finalizado correctamente.']);
    exit;
}

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
$queue = $input['queue'] ?? [];

if (empty($queue)) {
    echo json_encode(['success' => true, 'processed' => 0, 'message' => 'Cola de sincronización vacía.']);
    exit;
}

$processed = 0;
$errors = [];

$pdo->beginTransaction();
try {
    foreach ($queue as $item) {
        $endpoint = $item['endpoint'] ?? '';
        $payload = $item['payload'] ?? [];

        if (strpos($endpoint, 'live_score.php') !== false) {
            $gameId = intval($payload['game_id'] ?? 0);
            $action = trim($payload['action'] ?? 'record_play');

            if ($action === 'record_play') {
                $batterId = intval($payload['batter_id'] ?? 0);
                $pitcherId = intval($payload['pitcher_id'] ?? 0);
                $resultCode = trim($payload['result_code'] ?? '1B');
                $description = trim($payload['description'] ?? '');
                $runsScored = intval($payload['runs_scored'] ?? 0);
                $rbiCount = intval($payload['rbi_count'] ?? 0);
                $outCount = intval($payload['outs_before'] ?? 0);

                // Fetch game
                $stmtG = $pdo->prepare("SELECT * FROM games WHERE id = ?");
                $stmtG->execute([$gameId]);
                $game = $stmtG->fetch();

                if ($game) {
                    // Log PBP
                    $stmtPbp = $pdo->prepare("INSERT INTO game_play_by_play (game_id, inning, half_inning, batter_id, pitcher_id, outs_before, result_code, description, runs_scored) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    $stmtPbp->execute([$gameId, $game['current_inning'], $game['half_inning'], $batterId, $pitcherId, $outCount, $resultCode, $description, $runsScored]);

                    // Batting stats
                    $ab = in_array($resultCode, ['1B', '2B', '3B', 'HR', 'SO', 'GO', 'FO', 'E']) ? 1 : 0;
                    $h = in_array($resultCode, ['1B', '2B', '3B', 'HR']) ? 1 : 0;
                    $hr = ($resultCode === 'HR') ? 1 : 0;

                    $stmtCheckB = $pdo->prepare("SELECT id FROM game_batting_stats WHERE game_id = ? AND player_id = ?");
                    $stmtCheckB->execute([$gameId, $batterId]);
                    $bRow = $stmtCheckB->fetch();

                    if ($bRow) {
                        $pdo->prepare("UPDATE game_batting_stats SET ab = ab + ?, r = r + ?, h = h + ?, hr = hr + ?, rbi = rbi + ? WHERE id = ?")
                            ->execute([$ab, $runsScored, $h, $hr, $rbiCount, $bRow['id']]);
                    } else {
                        $isHomeBatting = ($game['half_inning'] === 'bottom');
                        $bTeamId = $isHomeBatting ? $game['home_team_id'] : $game['away_team_id'];
                        $pdo->prepare("INSERT INTO game_batting_stats (game_id, team_id, player_id, ab, r, h, hr, rbi) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                            ->execute([$gameId, $bTeamId, $batterId, $ab, $runsScored, $h, $hr, $rbiCount]);
                    }
                    $processed++;
                }
            }
        }
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'processed' => $processed, 'message' => "Sincronizados {$processed} eventos correctamente."]);
} catch (Exception $e) {
    $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => 'Error durante sincronización: ' . $e->getMessage()]);
}

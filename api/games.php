<?php
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';

if ($action === 'list') {
    $categoryId = intval($_GET['category_id'] ?? 0);
    $status = trim($_GET['status'] ?? '');

    $sql = "SELECT g.*, 
                   ht.name as home_team_name, ht.short_name as home_short, ht.logo_url as home_logo, ht.color_primary as home_color,
                   at.name as away_team_name, at.short_name as away_short, at.logo_url as away_logo, at.color_primary as away_color,
                   c.name as category_name, c.code as category_code
            FROM games g
            JOIN teams ht ON g.home_team_id = ht.id
            JOIN teams at ON g.away_team_id = at.id
            JOIN categories c ON g.category_id = c.id";

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
               ht.name as home_team_name, ht.short_name as home_short, ht.logo_url as home_logo, ht.color_primary as home_color,
               at.name as away_team_name, at.short_name as away_short, at.logo_url as away_logo, at.color_primary as away_color,
               c.name as category_name
        FROM games g
        JOIN teams ht ON g.home_team_id = ht.id
        JOIN teams at ON g.away_team_id = at.id
        JOIN categories c ON g.category_id = c.id
        WHERE g.id = ?
    ");
    $stmt->execute([$id]);
    $game = $stmt->fetch();

    if (!$game) {
        echo json_encode(['success' => false, 'message' => 'Partido no encontrado.']);
        exit;
    }

    // Get Line Scores (runs per inning)
    $stmtLine = $pdo->prepare("SELECT * FROM game_line_scores WHERE game_id = ? ORDER BY team_id, inning ASC");
    $stmtLine->execute([$id]);
    $lines = $stmtLine->fetchAll();

    $lineScores = [
        'home' => array_fill(1, 9, 0),
        'away' => array_fill(1, 9, 0)
    ];

    foreach ($lines as $l) {
        $key = ($l['team_id'] == $game['home_team_id']) ? 'home' : 'away';
        $lineScores[$key][$l['inning']] = intval($l['runs']);
    }

    // Get Batting Box Scores (Home & Away)
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

    // Get Pitching Box Scores (Home & Away)
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

    // Get Play-by-play logs
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

    // Get Game Postcards / Photos (max 10)
    $stmtPhotos = $pdo->prepare("SELECT * FROM game_photos WHERE game_id = ? ORDER BY id ASC LIMIT 10");
    $stmtPhotos->execute([$id]);
    $photos = $stmtPhotos->fetchAll();

    echo json_encode([
        'success' => true,
        'game' => $game,
        'line_scores' => $lineScores,
        'home_batters' => $homeBatters,
        'away_batters' => $awayBatters,
        'home_pitchers' => $homePitchers,
        'away_pitchers' => $awayPitchers,
        'play_by_play' => $playByPlay,
        'photos' => $photos
    ]);
    exit;
}

if ($action === 'create' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $categoryId = intval($input['category_id'] ?? 0);
    $homeTeamId = intval($input['home_team_id'] ?? 0);
    $awayTeamId = intval($input['away_team_id'] ?? 0);
    $gameDate = trim($input['game_date'] ?? date('Y-m-d H:i:s'));
    $fieldLocation = trim($input['field_location'] ?? 'Estadio LMB Ezeiza');

    if (!$categoryId || !$homeTeamId || !$awayTeamId) {
        echo json_encode(['success' => false, 'message' => 'Categoría, equipo local y visitante requeridos.']);
        exit;
    }

    $stmtCat = $pdo->prepare("SELECT season_id FROM categories WHERE id = ?");
    $stmtCat->execute([$categoryId]);
    $cat = $stmtCat->fetch();
    $seasonId = $cat['season_id'] ?? 1;

    $stmt = $pdo->prepare("INSERT INTO games (season_id, category_id, home_team_id, away_team_id, game_date, field_location, status) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')");
    $stmt->execute([$seasonId, $categoryId, $homeTeamId, $awayTeamId, $gameDate, $fieldLocation]);
    $gameId = $pdo->lastInsertId();

    echo json_encode(['success' => true, 'game_id' => $gameId, 'message' => 'Partido programado exitosamente.']);
    exit;
}

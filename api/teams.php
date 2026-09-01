<?php
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';

if ($action === 'list') {
    $categoryId = intval($_GET['category_id'] ?? 0);
    
    $sql = "SELECT t.*, c.name as category_name, c.code as category_code 
            FROM teams t 
            JOIN categories c ON t.category_id = c.id";
    
    if ($categoryId > 0) {
        $sql .= " WHERE t.category_id = {$categoryId}";
    }
    $sql .= " ORDER BY c.level ASC, t.name ASC";

    $stmt = $pdo->query($sql);
    $teams = $stmt->fetchAll();

    echo json_encode(['success' => true, 'teams' => $teams]);
    exit;
}

if ($action === 'detail') {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID de equipo requerido.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT t.*, c.name as category_name, c.code as category_code FROM teams t JOIN categories c ON t.category_id = c.id WHERE t.id = ?");
    $stmt->execute([$id]);
    $team = $stmt->fetch();

    if (!$team) {
        echo json_encode(['success' => false, 'message' => 'Equipo no encontrado.']);
        exit;
    }

    // Get team roster
    $stmtP = $pdo->prepare("SELECT * FROM players WHERE team_id = ? AND is_active = 1 ORDER BY jersey_number ASC, last_name ASC");
    $stmtP->execute([$id]);
    $players = $stmtP->fetchAll();

    // Get team win/loss stats
    $stmtGames = $pdo->prepare("SELECT home_team_id, away_team_id, home_score, away_score, status FROM games WHERE (home_team_id = ? OR away_team_id = ?) AND status = 'finished'");
    $stmtGames->execute([$id, $id]);
    $games = $stmtGames->fetchAll();

    $wins = 0; $losses = 0; $runsScored = 0; $runsAllowed = 0;
    foreach ($games as $g) {
        if ($g['home_team_id'] == $id) {
            $runsScored += $g['home_score'];
            $runsAllowed += $g['away_score'];
            if ($g['home_score'] > $g['away_score']) $wins++; else $losses++;
        } else {
            $runsScored += $g['away_score'];
            $runsAllowed += $g['home_score'];
            if ($g['away_score'] > $g['home_score']) $wins++; else $losses++;
        }
    }

    $team['stats'] = [
        'games_played' => count($games),
        'wins' => $wins,
        'losses' => $losses,
        'pct' => (count($games) > 0) ? number_format($wins / count($games), 3) : '.000',
        'runs_scored' => $runsScored,
        'runs_allowed' => $runsAllowed
    ];

    echo json_encode(['success' => true, 'team' => $team, 'players' => $players]);
    exit;
}

if ($action === 'create' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $categoryId = intval($input['category_id'] ?? 0);
    $name = trim($input['name'] ?? '');
    $shortName = trim($input['short_name'] ?? '');
    $colorPrimary = trim($input['color_primary'] ?? '#0A192F');
    $colorSecondary = trim($input['color_secondary'] ?? '#D32F2F');
    $logoUrl = trim($input['logo_url'] ?? 'assets/images/lmb_logo.png');

    if (!$categoryId || empty($name)) {
        echo json_encode(['success' => false, 'message' => 'Categoría y nombre de equipo requeridos.']);
        exit;
    }

    if (empty($shortName)) {
        $shortName = strtoupper(substr($name, 0, 4));
    }

    $stmt = $pdo->prepare("INSERT INTO teams (category_id, name, short_name, logo_url, color_primary, color_secondary) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$categoryId, $name, $shortName, $logoUrl, $colorPrimary, $colorSecondary]);
    $teamId = $pdo->lastInsertId();

    echo json_encode(['success' => true, 'team_id' => $teamId, 'message' => 'Equipo creado exitosamente.']);
    exit;
}

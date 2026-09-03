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

// 1. Standings Table Calculation per Category
if ($action === 'standings') {
    $categoryId = intval($_GET['category_id'] ?? 0);

    $sqlTeams = "SELECT t.*, COALESCE(c.name, 'Sin Asignación') as category_name, s.name as home_stadium_name 
                 FROM teams t 
                 LEFT JOIN categories c ON t.category_id = c.id
                 LEFT JOIN stadiums s ON t.home_stadium_id = s.id";
    if ($categoryId > 0) {
        $sqlTeams .= " WHERE t.category_id = {$categoryId}";
    }
    $sqlTeams .= " ORDER BY t.name ASC";

    $teams = $pdo->query($sqlTeams)->fetchAll();

    // Calculate standings from finished games
    $standings = [];
    foreach ($teams as $t) {
        $tId = $t['id'];

        $stmtGames = $pdo->prepare("
            SELECT 
                COUNT(*) as gp,
                SUM(CASE WHEN (home_team_id = ? AND home_score > away_score) OR (away_team_id = ? AND away_score > home_score) THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN (home_team_id = ? AND home_score < away_score) OR (away_team_id = ? AND away_score < home_score) THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN home_team_id = ? THEN home_score ELSE away_score END) as cf,
                SUM(CASE WHEN home_team_id = ? THEN away_score ELSE home_score END) as cc
            FROM games
            WHERE (home_team_id = ? OR away_team_id = ?) AND status = 'finished'
        ");
        $stmtGames->execute([$tId, $tId, $tId, $tId, $tId, $tId, $tId, $tId]);
        $res = $stmtGames->fetch();

        $gp = intval($res['gp'] ?? 0);
        $w = intval($res['wins'] ?? 0);
        $l = intval($res['losses'] ?? 0);
        $cf = intval($res['cf'] ?? 0);
        $cc = intval($res['cc'] ?? 0);
        $diff = $cf - $cc;
        $pct = ($gp > 0) ? number_format($w / $gp, 3) : '.000';

        $standings[] = [
            'team_id' => $tId,
            'name' => $t['name'],
            'short_name' => $t['short_name'],
            'logo_url' => $t['logo_url'],
            'category_name' => $t['category_name'],
            'home_stadium_name' => $t['home_stadium_name'] ?: 'Sin Sede Fija',
            'color_primary' => $t['color_primary'],
            'gp' => $gp,
            'wins' => $w,
            'losses' => $l,
            'pct_val' => ($gp > 0) ? ($w / $gp) : 0,
            'pct' => $pct,
            'cf' => $cf,
            'cc' => $cc,
            'diff' => ($diff > 0 ? "+{$diff}" : "{$diff}")
        ];
    }

    // Sort by Win PCT descending, then run diff
    if (!empty($standings)) {
        usort($standings, function($a, $b) {
            if ($a['pct_val'] === $b['pct_val']) {
                return $b['diff'] <=> $a['diff'];
            }
            return $b['pct_val'] <=> $a['pct_val'];
        });

        // Calculate Games Behind (GB) relative to leader
        $leaderWins = $standings[0]['wins'] ?? 0;
        $leaderLosses = $standings[0]['losses'] ?? 0;

        foreach ($standings as $idx => &$st) {
            if ($idx === 0) {
                $st['gb'] = '-';
            } else {
                $gbVal = (($leaderWins - $st['wins']) + ($st['losses'] - $leaderLosses)) / 2;
                $st['gb'] = ($gbVal == 0) ? '-' : $gbVal;
            }
        }
    }

    echo json_encode(['success' => true, 'standings' => $standings]);
    exit;
}

// 2. Teams List
if ($action === 'list') {
    $categoryId = intval($_GET['category_id'] ?? 0);

    $sql = "SELECT t.*, COALESCE(c.name, 'Sin Asignación') as category_name, COALESCE(c.code, 'S/A') as category_code, s.name as home_stadium_name
            FROM teams t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN stadiums s ON t.home_stadium_id = s.id";
    if ($categoryId > 0) {
        $sql .= " WHERE t.category_id = {$categoryId}";
    }
    $sql .= " ORDER BY c.level ASC, t.name ASC";

    $stmt = $pdo->query($sql);
    $teams = $stmt->fetchAll();

    echo json_encode(['success' => true, 'teams' => $teams]);
    exit;
}

// 3. Team Detail
if ($action === 'detail') {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID de equipo requerido.']);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT t.*, COALESCE(c.name, 'Sin Asignación') as category_name, COALESCE(c.code, 'S/A') as category_code, s.name as home_stadium_name
        FROM teams t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN stadiums s ON t.home_stadium_id = s.id
        WHERE t.id = ?
    ");
    $stmt->execute([$id]);
    $team = $stmt->fetch();

    if (!$team) {
        echo json_encode(['success' => false, 'message' => 'Equipo no encontrado.']);
        exit;
    }

    // Players Roster
    $stmtP = $pdo->prepare("SELECT * FROM players WHERE team_id = ? AND is_active = 1 ORDER BY jersey_number ASC, last_name ASC");
    $stmtP->execute([$id]);
    $players = $stmtP->fetchAll();

    // Stats Summary
    $stmtGames = $pdo->prepare("
        SELECT 
            COUNT(*) as gp,
            SUM(CASE WHEN (home_team_id = ? AND home_score > away_score) OR (away_team_id = ? AND away_score > home_score) THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN (home_team_id = ? AND home_score < away_score) OR (away_team_id = ? AND away_score < home_score) THEN 1 ELSE 0 END) as losses
        FROM games
        WHERE (home_team_id = ? OR away_team_id = ?) AND status = 'finished'
    ");
    $stmtGames->execute([$id, $id, $id, $id, $id, $id]);
    $gStats = $stmtGames->fetch();

    $gp = intval($gStats['gp'] ?? 0);
    $w = intval($gStats['wins'] ?? 0);
    $l = intval($gStats['losses'] ?? 0);
    $pct = ($gp > 0) ? number_format($w / $gp, 3) : '.000';

    $team['stats'] = [
        'games_played' => $gp,
        'wins' => $w,
        'losses' => $l,
        'pct' => $pct
    ];

    echo json_encode(['success' => true, 'team' => $team, 'players' => $players]);
    exit;
}

// 4. Create Team
if ($action === 'create' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $categoryId = intval($input['category_id'] ?? 0);
    $name = trim($input['name'] ?? '');
    $shortName = trim($input['short_name'] ?? strtoupper(substr($name, 0, 4)));
    $homeStadiumId = !empty($input['home_stadium_id']) ? intval($input['home_stadium_id']) : null;
    $colorPrimary = trim($input['color_primary'] ?? '#0A192F');

    if (!$categoryId || empty($name)) {
        echo json_encode(['success' => false, 'message' => 'Categoría y nombre de equipo requeridos.']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO teams (category_id, name, short_name, home_stadium_id, color_primary) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$categoryId, $name, $shortName, $homeStadiumId, $colorPrimary]);
    $teamId = $pdo->lastInsertId();

    echo json_encode(['success' => true, 'team_id' => $teamId, 'message' => 'Equipo registrado exitosamente.']);
    exit;
}

// 5. Update Team
if ($action === 'update' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin', 'team_admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $name = trim($input['name'] ?? '');
    $shortName = trim($input['short_name'] ?? '');
    $homeStadiumId = isset($input['home_stadium_id']) ? intval($input['home_stadium_id']) : null;
    $categoryId = isset($input['category_id']) ? intval($input['category_id']) : null;
    $foundationYear = intval($input['foundation_year'] ?? 1950);
    $colorPrimary = trim($input['color_primary'] ?? '#0A192F');
    $colorSecondary = trim($input['color_secondary'] ?? '#D32F2F');
    $logoUrl = trim($input['logo_url'] ?? '');

    if (!$id || empty($name)) {
        echo json_encode(['success' => false, 'message' => 'ID y nombre de equipo requeridos.']);
        exit;
    }

    // Enforce team ownership for team_admin
    $userRole = $_SESSION['user']['role'];
    $userAssignedTeam = $_SESSION['user']['assigned_team_id'] ?? null;
    if ($userRole === 'team_admin' && $userAssignedTeam != $id) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado: Solo puedes editar los datos de tu propio equipo asignado.']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE teams SET name = ?, short_name = ?, home_stadium_id = ?, category_id = ?, foundation_year = ?, color_primary = ?, color_secondary = ?" . (!empty($logoUrl) ? ", logo_url = ?" : "") . " WHERE id = ?");
    
    $params = [$name, $shortName, $homeStadiumId, $categoryId, $foundationYear, $colorPrimary, $colorSecondary];
    if (!empty($logoUrl)) {
        $params[] = $logoUrl;
    }
    $params[] = $id;

    $stmt->execute($params);

    echo json_encode(['success' => true, 'message' => 'Datos del equipo actualizados correctamente.']);
    exit;
}

// 6. Delete Team
if ($action === 'delete' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);

    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID de equipo requerido.']);
        exit;
    }

    $stmtTeam = $pdo->prepare("SELECT name FROM teams WHERE id = ?");
    $stmtTeam->execute([$id]);
    $teamName = $stmtTeam->fetchColumn() ?: "Equipo #{$id}";

    // Move players to unassigned (team_id = 0)
    $pdo->prepare("UPDATE players SET team_id = 0 WHERE team_id = ?")->execute([$id]);

    $stmt = $pdo->prepare("DELETE FROM teams WHERE id = ?");
    $stmt->execute([$id]);

    logAuditAction($pdo, 'DELETE_TEAM', "Eliminó el equipo '{$teamName}'. Sus jugadores integran ahora la lista de 'Sin Asignación'.");

    echo json_encode(['success' => true, 'message' => 'Equipo eliminado. Sus jugadores pasaron a "Sin Asignación".']);
    exit;
}

<?php
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';

if ($action === 'list') {
    $teamId = intval($_GET['team_id'] ?? 0);
    $sql = "SELECT p.*, t.name as team_name, t.short_name as team_short, t.color_primary 
            FROM players p 
            JOIN teams t ON p.team_id = t.id 
            WHERE p.is_active = 1";
    if ($teamId > 0) {
        $sql .= " AND p.team_id = {$teamId}";
    }
    $sql .= " ORDER BY p.last_name ASC, p.first_name ASC";

    $stmt = $pdo->query($sql);
    $players = $stmt->fetchAll();

    echo json_encode(['success' => true, 'players' => $players]);
    exit;
}

if ($action === 'detail') {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID de jugador requerido.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT p.*, t.name as team_name, t.short_name as team_short, t.logo_url as team_logo, c.name as category_name 
                           FROM players p 
                           JOIN teams t ON p.team_id = t.id 
                           JOIN categories c ON t.category_id = c.id 
                           WHERE p.id = ?");
    $stmt->execute([$id]);
    $player = $stmt->fetch();

    if (!$player) {
        echo json_encode(['success' => false, 'message' => 'Jugador no encontrado.']);
        exit;
    }

    // Calculate Batting Aggregates
    $stmtBat = $pdo->prepare("
        SELECT 
            COUNT(DISTINCT game_id) as gp,
            SUM(ab) as ab, SUM(r) as r, SUM(h) as h,
            SUM(singles) as singles, SUM(doubles) as doubles, SUM(triples) as triples, SUM(hr) as hr,
            SUM(rbi) as rbi, SUM(bb) as bb, SUM(so) as so, SUM(sb) as sb, SUM(hbp) as hbp, SUM(sf) as sf
        FROM game_batting_stats
        WHERE player_id = ?
    ");
    $stmtBat->execute([$id]);
    $bat = $stmtBat->fetch() ?: [];

    $ab = intval($bat['ab'] ?? 0);
    $h = intval($bat['h'] ?? 0);
    $bb = intval($bat['bb'] ?? 0);
    $hbp = intval($bat['hbp'] ?? 0);
    $sf = intval($bat['sf'] ?? 0);
    $d2 = intval($bat['doubles'] ?? 0);
    $d3 = intval($bat['triples'] ?? 0);
    $hr = intval($bat['hr'] ?? 0);

    $avg = ($ab > 0) ? number_format($h / $ab, 3) : '.000';
    $obpDenominator = ($ab + $bb + $hbp + $sf);
    $obp = ($obpDenominator > 0) ? number_format(($h + $bb + $hbp) / $obpDenominator, 3) : '.000';
    
    $totalBases = ($h - $d2 - $d3 - $hr) + ($d2 * 2) + ($d3 * 3) + ($hr * 4);
    $slg = ($ab > 0) ? number_format($totalBases / $ab, 3) : '.000';
    $ops = number_format(floatval($obp) + floatval($slg), 3);

    $player['batting_stats'] = [
        'gp' => intval($bat['gp'] ?? 0),
        'ab' => $ab,
        'r' => intval($bat['r'] ?? 0),
        'h' => $h,
        'doubles' => $d2,
        'triples' => $d3,
        'hr' => $hr,
        'rbi' => intval($bat['rbi'] ?? 0),
        'bb' => $bb,
        'so' => intval($bat['so'] ?? 0),
        'sb' => intval($bat['sb'] ?? 0),
        'avg' => $avg,
        'obp' => $obp,
        'slg' => $slg,
        'ops' => $ops
    ];

    // Calculate Pitching Aggregates
    $stmtPitch = $pdo->prepare("
        SELECT 
            COUNT(DISTINCT game_id) as gp,
            SUM(ip_outs) as ip_outs,
            SUM(h) as h, SUM(r) as r, SUM(er) as er,
            SUM(bb) as bb, SUM(so) as so, SUM(hr) as hr,
            SUM(pitches_count) as pitches,
            SUM(CASE WHEN decision = 'W' THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN decision = 'L' THEN 1 ELSE 0 END) as losses,
            SUM(CASE WHEN decision = 'SV' THEN 1 ELSE 0 END) as saves
        FROM game_pitching_stats
        WHERE player_id = ?
    ");
    $stmtPitch->execute([$id]);
    $pitch = $stmtPitch->fetch() ?: [];

    $ipOuts = intval($pitch['ip_outs'] ?? 0);
    $ipFull = floor($ipOuts / 3);
    $ipRem = $ipOuts % 3;
    $ipDisplay = $ipFull . '.' . $ipRem;
    $ipFloat = $ipFull + ($ipRem / 3);

    $er = intval($pitch['er'] ?? 0);
    $pHits = intval($pitch['h'] ?? 0);
    $pBB = intval($pitch['bb'] ?? 0);

    $era = ($ipFloat > 0) ? number_format(($er * 9) / $ipFloat, 2) : '0.00';
    $whip = ($ipFloat > 0) ? number_format(($pHits + $pBB) / $ipFloat, 2) : '0.00';

    $player['pitching_stats'] = [
        'gp' => intval($pitch['gp'] ?? 0),
        'wins' => intval($pitch['wins'] ?? 0),
        'losses' => intval($pitch['losses'] ?? 0),
        'saves' => intval($pitch['saves'] ?? 0),
        'ip' => $ipDisplay,
        'h' => $pHits,
        'r' => intval($pitch['r'] ?? 0),
        'er' => $er,
        'bb' => $pBB,
        'so' => intval($pitch['so'] ?? 0),
        'hr' => intval($pitch['hr'] ?? 0),
        'era' => $era,
        'whip' => $whip,
        'pitches' => intval($pitch['pitches'] ?? 0)
    ];

    echo json_encode(['success' => true, 'player' => $player]);
    exit;
}

if ($action === 'create' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin', 'team_admin', 'scorekeeper'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado. Se requieren permisos de administración o delegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $teamId = intval($input['team_id'] ?? 0);
    $firstName = trim($input['first_name'] ?? '');
    $lastName = trim($input['last_name'] ?? '');
    $jerseyNumber = intval($input['jersey_number'] ?? 0);
    $positionPrimary = trim($input['position_primary'] ?? 'OF');
    $positionSecondary = trim($input['position_secondary'] ?? '');
    $bats = trim($input['bats'] ?? 'R');
    $throws = trim($input['throws'] ?? 'R');
    $photoUrl = trim($input['photo_url'] ?? '');

    if (!$teamId || empty($firstName) || empty($lastName)) {
        echo json_encode(['success' => false, 'message' => 'Equipo, nombre y apellido requeridos.']);
        exit;
    }

    // Role team check for team_admin
    $user = $_SESSION['user'];
    if ($user['role'] === 'team_admin' && !empty($user['assigned_team_id']) && $user['assigned_team_id'] != $teamId) {
        echo json_encode(['success' => false, 'message' => 'Solo puedes agregar jugadores a tu club asignado.']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO players (team_id, first_name, last_name, jersey_number, position_primary, position_secondary, bats, throws, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$teamId, $firstName, $lastName, $jerseyNumber, $positionPrimary, $positionSecondary, $bats, $throws, $photoUrl]);
    $playerId = $pdo->lastInsertId();

    echo json_encode(['success' => true, 'player_id' => $playerId, 'message' => 'Jugador registrado exitosamente.']);
    exit;
}

if ($action === 'update' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin', 'team_admin', 'scorekeeper'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $firstName = trim($input['first_name'] ?? '');
    $lastName = trim($input['last_name'] ?? '');
    $jerseyNumber = intval($input['jersey_number'] ?? 0);
    $positionPrimary = trim($input['position_primary'] ?? 'OF');
    $positionSecondary = trim($input['position_secondary'] ?? '');
    $bats = trim($input['bats'] ?? 'R');
    $throws = trim($input['throws'] ?? 'R');

    if (!$id || empty($firstName) || empty($lastName)) {
        echo json_encode(['success' => false, 'message' => 'ID, nombre y apellido requeridos.']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE players SET first_name = ?, last_name = ?, jersey_number = ?, position_primary = ?, position_secondary = ?, bats = ?, throws = ? WHERE id = ?");
    $stmt->execute([$firstName, $lastName, $jerseyNumber, $positionPrimary, $positionSecondary, $bats, $throws, $id]);

    echo json_encode(['success' => true, 'message' => 'Datos del jugador actualizados correctamente.']);
    exit;
}

if ($action === 'delete' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin', 'team_admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);

    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID de jugador requerido.']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE players SET is_active = 0 WHERE id = ?");
    $stmt->execute([$id]);

    echo json_encode(['success' => true, 'message' => 'Jugador dado de baja del plantel.']);
    exit;
}

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

    $stmt = $pdo->prepare("SELECT p.*, COALESCE(t.name, 'Sin Equipo') as team_name, COALESCE(t.short_name, 'S/E') as team_short, t.logo_url as team_logo, COALESCE(c.name, 'Sin Categoría') as category_name 
                           FROM players p 
                           LEFT JOIN teams t ON p.team_id = t.id 
                           LEFT JOIN categories c ON t.category_id = c.id 
                           WHERE p.id = ?");
    $stmt->execute([$id]);
    $player = $stmt->fetch();

    if (!$player) {
        echo json_encode(['success' => false, 'message' => 'Jugador no encontrado.']);
        exit;
    }

    // Helper function for batting stats
    $calcBatting = function($whereExtra = '') use ($pdo, $id) {
        $stmtBat = $pdo->prepare("
            SELECT 
                COUNT(DISTINCT bs.game_id) as gp,
                SUM(bs.ab) as ab, SUM(bs.r) as r, SUM(bs.h) as h,
                SUM(bs.singles) as singles, SUM(bs.doubles) as doubles, SUM(bs.triples) as triples, SUM(bs.hr) as hr,
                SUM(bs.rbi) as rbi, SUM(bs.bb) as bb, SUM(bs.so) as so, SUM(bs.sb) as sb, SUM(bs.hbp) as hbp, SUM(bs.sf) as sf
            FROM game_batting_stats bs
            JOIN games g ON bs.game_id = g.id
            WHERE bs.player_id = ? AND g.status = 'finished' AND bs.ab > 0 {$whereExtra}
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

        return [
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
    };

    // Helper function for pitching stats
    $calcPitching = function($whereExtra = '') use ($pdo, $id) {
        $stmtPitch = $pdo->prepare("
            SELECT 
                COUNT(DISTINCT ps.game_id) as gp,
                SUM(ps.ip_outs) as ip_outs,
                SUM(ps.h) as h, SUM(ps.r) as r, SUM(ps.er) as er,
                SUM(ps.bb) as bb, SUM(ps.so) as so, SUM(ps.hr) as hr,
                SUM(ps.pitches_count) as pitches,
                SUM(CASE WHEN ps.decision = 'W' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN ps.decision = 'L' THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN ps.decision = 'SV' THEN 1 ELSE 0 END) as saves
            FROM game_pitching_stats ps
            JOIN games g ON ps.game_id = g.id
            WHERE ps.player_id = ? AND g.status = 'finished' AND (ps.ip_outs > 0 OR ps.pitches_count > 0) {$whereExtra}
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

        return [
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
    };

    // Official Season Stats (excludes friendly/exhibitions)
    $officialWhere = " AND (g.game_stage IS NULL OR g.game_stage NOT IN ('Amistoso', 'Juego Amistoso / Preparación', 'Exhibición', 'Juego de Exhibición')) ";
    $player['batting_stats'] = $calcBatting($officialWhere);
    $player['pitching_stats'] = $calcPitching($officialWhere);

    // Lifetime / De Por Vida Stats (includes all games: regular + friendly + exhibitions + playoffs)
    $player['lifetime_batting_stats'] = $calcBatting('');
    $player['lifetime_pitching_stats'] = $calcPitching('');

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
    $roleType = trim($input['role_type'] ?? 'player');
    $bats = trim($input['bats'] ?? 'R');
    $throws = trim($input['throws'] ?? 'R');
    $photoUrl = trim($input['photo_url'] ?? '');

    if (empty($firstName) || empty($lastName)) {
        echo json_encode(['success' => false, 'message' => 'Nombre y apellido requeridos.']);
        exit;
    }

    // Role team check for team_admin
    $user = $_SESSION['user'];
    if ($user['role'] === 'team_admin' && !empty($user['assigned_team_id']) && $user['assigned_team_id'] != $teamId) {
        echo json_encode(['success' => false, 'message' => 'Solo puedes agregar integrantes a tu club asignado.']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO players (team_id, first_name, last_name, jersey_number, position_primary, position_secondary, role_type, bats, throws, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$teamId, $firstName, $lastName, $jerseyNumber, $positionPrimary, $positionSecondary, $roleType, $bats, $throws, $photoUrl]);
    $playerId = $pdo->lastInsertId();

    echo json_encode(['success' => true, 'player_id' => $playerId, 'message' => 'Integrante registrado exitosamente en el plantel.']);
    exit;
}

if ($action === 'update' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin', 'team_admin', 'scorekeeper'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $teamId = intval($input['team_id'] ?? 0);
    $roleType = trim($input['role_type'] ?? 'player');
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

    // Enforce team ownership for team_admin
    $user = $_SESSION['user'];
    if ($user['role'] === 'team_admin' && !empty($user['assigned_team_id'])) {
        $stmtChk = $pdo->prepare("SELECT team_id FROM players WHERE id = ?");
        $stmtChk->execute([$id]);
        $playerTeam = $stmtChk->fetchColumn();
        if ($playerTeam && $playerTeam != $user['assigned_team_id']) {
            echo json_encode(['success' => false, 'message' => 'Acceso denegado: Solo puedes modificar integrantes de tu propio club.']);
            exit;
        }
        $teamId = $user['assigned_team_id'];
    }

    $stmt = $pdo->prepare("UPDATE players SET team_id = ?, role_type = ?, first_name = ?, last_name = ?, jersey_number = ?, position_primary = ?, position_secondary = ?, bats = ?, throws = ? WHERE id = ?");
    $stmt->execute([$teamId, $roleType, $firstName, $lastName, $jerseyNumber, $positionPrimary, $positionSecondary, $bats, $throws, $id]);

    echo json_encode(['success' => true, 'message' => 'Datos del integrante y asignación de equipo actualizados correctamente.']);
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

    // Enforce team ownership for team_admin
    $user = $_SESSION['user'];
    if ($user['role'] === 'team_admin' && !empty($user['assigned_team_id'])) {
        $stmtChk = $pdo->prepare("SELECT team_id FROM players WHERE id = ?");
        $stmtChk->execute([$id]);
        $playerTeam = $stmtChk->fetchColumn();
        if ($playerTeam != $user['assigned_team_id']) {
            echo json_encode(['success' => false, 'message' => 'Acceso denegado: Solo puedes dar de baja integrantes de tu propio club.']);
            exit;
        }
    }

    $stmt = $pdo->prepare("UPDATE players SET is_active = 0 WHERE id = ?");
    $stmt->execute([$id]);

    echo json_encode(['success' => true, 'message' => 'Jugador dado de baja del plantel.']);
    exit;
}

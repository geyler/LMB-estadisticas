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
    // Get active season
    $stmtSeason = $pdo->query("SELECT * FROM seasons ORDER BY year DESC, id DESC");
    $seasons = $stmtSeason->fetchAll();

    $activeSeason = null;
    foreach ($seasons as $s) {
        if ($s['is_active'] == 1) {
            $activeSeason = $s;
            break;
        }
    }
    if (!$activeSeason && !empty($seasons)) {
        $activeSeason = $seasons[0];
    }

    $categories = [];
    if ($activeSeason) {
        $stmtCat = $pdo->prepare("SELECT * FROM categories WHERE season_id = ? ORDER BY level ASC, id ASC");
        $stmtCat->execute([$activeSeason['id']]);
        $categories = $stmtCat->fetchAll();
    }

    echo json_encode([
        'success' => true,
        'seasons' => $seasons,
        'active_season' => $activeSeason,
        'categories' => $categories
    ]);
    exit;
}

// Stadiums / Sedes API
if ($action === 'stadiums') {
    $stmt = $pdo->query("SELECT * FROM stadiums ORDER BY name ASC");
    $stadiums = $stmt->fetchAll();
    echo json_encode(['success' => true, 'stadiums' => $stadiums]);
    exit;
}

if ($action === 'create_stadium' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $name = trim($input['name'] ?? '');
    $address = trim($input['address'] ?? '');
    $city = trim($input['city'] ?? 'Buenos Aires');

    if (empty($name)) {
        echo json_encode(['success' => false, 'message' => 'Nombre de sede requerido.']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO stadiums (name, address, city) VALUES (?, ?, ?)");
    $stmt->execute([$name, $address, $city]);
    $stadiumId = $pdo->lastInsertId();

    echo json_encode(['success' => true, 'stadium_id' => $stadiumId, 'message' => 'Sede deportiva registrada exitosamente.']);
    exit;
}

if ($action === 'update_stadium' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $name = trim($input['name'] ?? '');
    $address = trim($input['address'] ?? '');

    if (!$id || empty($name)) {
        echo json_encode(['success' => false, 'message' => 'ID y Nombre de sede requeridos.']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE stadiums SET name = ?, address = ? WHERE id = ?");
    $stmt->execute([$name, $address, $id]);

    echo json_encode(['success' => true, 'message' => 'Sede deportiva actualizada.']);
    exit;
}

if ($action === 'delete_stadium' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);

    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID de sede requerido.']);
        exit;
    }

    $stmt = $pdo->prepare("DELETE FROM stadiums WHERE id = ?");
    $stmt->execute([$id]);

    echo json_encode(['success' => true, 'message' => 'Sede deportiva eliminada.']);
    exit;
}

if ($action === 'create_season' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $name = trim($input['name'] ?? '');
    $year = intval($input['year'] ?? date('Y'));

    if (empty($name)) {
        echo json_encode(['success' => false, 'message' => 'Nombre de temporada requerido.']);
        exit;
    }

    $pdo->exec("UPDATE seasons SET is_active = 0");

    $stmt = $pdo->prepare("INSERT INTO seasons (name, year, is_active) VALUES (?, ?, 1)");
    $stmt->execute([$name, $year]);
    $seasonId = $pdo->lastInsertId();

    echo json_encode(['success' => true, 'season_id' => $seasonId, 'message' => 'Temporada creada exitosamente.']);
    exit;
}

if ($action === 'create_category' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $name = trim($input['name'] ?? '');
    $code = trim($input['code'] ?? strtoupper(substr($name, 0, 4)));
    $seasonId = intval($input['season_id'] ?? 0);

    if (empty($name)) {
        echo json_encode(['success' => false, 'message' => 'Nombre de categoría requerido.']);
        exit;
    }

    if (!$seasonId) {
        $stmtSeason = $pdo->query("SELECT id FROM seasons WHERE is_active = 1 ORDER BY id DESC LIMIT 1");
        $seasonId = $stmtSeason->fetchColumn() ?: 1;
    }

    $stmt = $pdo->prepare("INSERT INTO categories (season_id, name, code, level) VALUES (?, ?, ?, 1)");
    $stmt->execute([$seasonId, $name, $code]);
    $catId = $pdo->lastInsertId();

    echo json_encode(['success' => true, 'category_id' => $catId, 'message' => 'Categoría / División creada.']);
    exit;
}

if ($action === 'update_category' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $name = trim($input['name'] ?? '');
    $code = trim($input['code'] ?? '');

    if (!$id || empty($name)) {
        echo json_encode(['success' => false, 'message' => 'ID y Nombre de categoría requeridos.']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE categories SET name = ?, code = ? WHERE id = ?");
    $stmt->execute([$name, $code, $id]);

    echo json_encode(['success' => true, 'message' => 'Categoría actualizada exitosamente.']);
    exit;
}

if ($action === 'delete_category' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);

    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID de categoría requerido.']);
        exit;
    }

    // Fetch category info for audit log
    $stmtCat = $pdo->prepare("SELECT name FROM categories WHERE id = ?");
    $stmtCat->execute([$id]);
    $catName = $stmtCat->fetchColumn() ?: "Categoría #{$id}";

    // Move teams in this category to unassigned (category_id = 0)
    $pdo->prepare("UPDATE teams SET category_id = 0 WHERE category_id = ?")->execute([$id]);

    // Delete category
    $stmt = $pdo->prepare("DELETE FROM categories WHERE id = ?");
    $stmt->execute([$id]);

    logAuditAction($pdo, 'DELETE_CATEGORY', "Eliminó la categoría '{$catName}'. Los equipos asociados pasaron al listado 'Sin Asignación'.");

    echo json_encode(['success' => true, 'message' => 'Categoría eliminada. Los equipos asociados pasaron a "Sin Asignación".']);
    exit;
}

// ----------------------------------------------------
// GAME STAGES / ROLES ENDPOINTS
// ----------------------------------------------------
if ($action === 'stages') {
    try {
        $stmt = $pdo->query("SELECT * FROM game_stages ORDER BY id ASC");
        $stages = $stmt->fetchAll();
    } catch (Exception $e) {
        initDatabaseSchemaAndSeed($pdo);
        $stmt = $pdo->query("SELECT * FROM game_stages ORDER BY id ASC");
        $stages = $stmt->fetchAll();
    }
    echo json_encode(['success' => true, 'stages' => $stages]);
    exit;
}

if ($action === 'create_stage' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $name = trim($input['name'] ?? '');
    $code = strtoupper(trim($input['code'] ?? preg_replace('/[^A-Z0-9]/', '', strtoupper($name))));

    if (empty($name)) {
        echo json_encode(['success' => false, 'message' => 'Nombre de etapa o rol de partido requerido.']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO game_stages (name, code) VALUES (?, ?)");
    $stmt->execute([$name, $code]);

    logAuditAction($pdo, 'CREATE_GAME_STAGE', "Creó la nueva etapa de partido: '{$name}' ({$code})");

    echo json_encode(['success' => true, 'message' => 'Etapa / Tipo de partido creado exitosamente.']);
    exit;
}

if ($action === 'delete_stage' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);

    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID de etapa requerido.']);
        exit;
    }

    $stmt = $pdo->prepare("DELETE FROM game_stages WHERE id = ?");
    $stmt->execute([$id]);

    logAuditAction($pdo, 'DELETE_GAME_STAGE', "Eliminó la etapa de partido ID: {$id}");

    echo json_encode(['success' => true, 'message' => 'Etapa de partido eliminada.']);
    exit;
}

// ----------------------------------------------------
// UNASSIGNED ITEMS (SIN ASIGNACIÓN) & REASSIGNMENT HUB
// ----------------------------------------------------
if ($action === 'unassigned') {
    // 1. Teams without valid category
    $stmtTeams = $pdo->query("
        SELECT t.* 
        FROM teams t 
        LEFT JOIN categories c ON t.category_id = c.id 
        WHERE t.category_id = 0 OR t.category_id IS NULL OR c.id IS NULL
        ORDER BY t.name ASC
    ");
    $unassignedTeams = $stmtTeams->fetchAll();

    // 2. Players without valid team
    $stmtPlayers = $pdo->query("
        SELECT p.* 
        FROM players p 
        LEFT JOIN teams t ON p.team_id = t.id 
        WHERE (p.team_id = 0 OR p.team_id IS NULL OR t.id IS NULL) AND p.is_active = 1
        ORDER BY p.last_name ASC, p.first_name ASC
    ");
    $unassignedPlayers = $stmtPlayers->fetchAll();

    echo json_encode([
        'success' => true,
        'unassigned_teams' => $unassignedTeams,
        'unassigned_players' => $unassignedPlayers
    ]);
    exit;
}

if ($action === 'reassign_team' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $teamId = intval($input['team_id'] ?? 0);
    $categoryId = intval($input['category_id'] ?? 0);

    if (!$teamId || !$categoryId) {
        echo json_encode(['success' => false, 'message' => 'Equipo y Categoría destino requeridos.']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE teams SET category_id = ? WHERE id = ?");
    $stmt->execute([$categoryId, $teamId]);

    logAuditAction($pdo, 'REASSIGN_TEAM', "Reasignó el equipo ID {$teamId} a la categoría ID {$categoryId}.");

    echo json_encode(['success' => true, 'message' => 'Equipo reasignado exitosamente a la categoría.']);
    exit;
}

if ($action === 'reassign_player' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin', 'team_admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $playerId = intval($input['player_id'] ?? 0);
    $teamId = intval($input['team_id'] ?? 0);

    if (!$playerId || !$teamId) {
        echo json_encode(['success' => false, 'message' => 'Jugador y Equipo destino requeridos.']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE players SET team_id = ? WHERE id = ?");
    $stmt->execute([$teamId, $playerId]);

    logAuditAction($pdo, 'REASSIGN_PLAYER', "Reasignó el jugador ID {$playerId} al equipo ID {$teamId}.");

    echo json_encode(['success' => true, 'message' => 'Jugador asignado al equipo exitosamente.']);
    exit;
}

// ----------------------------------------------------
// AUDIT LOGS / HISTÓRICO DE AUDITORÍA
// ----------------------------------------------------
if ($action === 'audit_logs') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    try {
        $stmt = $pdo->query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100");
        $logs = $stmt->fetchAll();
    } catch (Exception $e) {
        initDatabaseSchemaAndSeed($pdo);
        $stmt = $pdo->query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100");
        $logs = $stmt->fetchAll();
    }

    echo json_encode(['success' => true, 'logs' => $logs]);
    exit;
}

if ($action === 'move_team' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $teamId = intval($input['team_id'] ?? 0);
    $newCategoryId = intval($input['category_id'] ?? 0);
    $notes = trim($input['notes'] ?? 'Cambio de categoría');

    if (!$teamId || !$newCategoryId) {
        echo json_encode(['success' => false, 'message' => 'Equipo y nueva categoría requeridos.']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE teams SET category_id = ? WHERE id = ?");
    $stmt->execute([$newCategoryId, $teamId]);

    $stmtCat = $pdo->prepare("SELECT season_id, name FROM categories WHERE id = ?");
    $stmtCat->execute([$newCategoryId]);
    $catInfo = $stmtCat->fetch();

    if ($catInfo) {
        $stmtHist = $pdo->prepare("INSERT INTO team_history (team_id, season_id, category_id, notes) VALUES (?, ?, ?, ?)");
        $stmtHist->execute([$teamId, $catInfo['season_id'], $newCategoryId, $notes . " -> " . $catInfo['name']]);
    }

    echo json_encode(['success' => true, 'message' => 'Categoría de equipo actualizada (Ascenso/Descenso registrado).']);
    exit;
}

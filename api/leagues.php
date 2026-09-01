<?php
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
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
        // Dynamic visibility gating: Only return categories that have teams or games, unless admin!
        $isAdmin = (isset($_SESSION['user']) && in_array($_SESSION['user']['role'], ['super_admin', 'admin']));

        if ($isAdmin) {
            $stmtCat = $pdo->prepare("SELECT * FROM categories WHERE season_id = ? ORDER BY level ASC");
            $stmtCat->execute([$activeSeason['id']]);
            $categories = $stmtCat->fetchAll();
        } else {
            // Public view: only show categories with at least 1 team or game
            $stmtCat = $pdo->prepare("
                SELECT DISTINCT c.* 
                FROM categories c 
                LEFT JOIN teams t ON c.id = t.category_id 
                LEFT JOIN games g ON c.id = g.category_id 
                WHERE c.season_id = ? AND (t.id IS NOT NULL OR g.id IS NOT NULL)
                ORDER BY c.level ASC
            ");
            $stmtCat->execute([$activeSeason['id']]);
            $categories = $stmtCat->fetchAll();
        }
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

    $defaultCategories = [
        ['name' => 'A1 - Primera División', 'code' => 'A1', 'level' => 1],
        ['name' => 'A2 - Segunda División', 'code' => 'A2', 'level' => 2],
        ['name' => 'A3 - Tercera División', 'code' => 'A3', 'level' => 3],
        ['name' => 'Infantiles', 'code' => 'INF', 'level' => 4],
        ['name' => 'Little League', 'code' => 'LTL', 'level' => 5],
    ];

    $stmtCat = $pdo->prepare("INSERT INTO categories (season_id, name, code, level) VALUES (?, ?, ?, ?)");
    foreach ($defaultCategories as $cat) {
        $stmtCat->execute([$seasonId, $cat['name'], $cat['code'], $cat['level']]);
    }

    echo json_encode(['success' => true, 'season_id' => $seasonId, 'message' => 'Temporada creada exitosamente con sus categorías.']);
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

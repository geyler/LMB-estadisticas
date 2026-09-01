<?php
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();

// Allow reset if SuperAdmin or if 0 users exist
$stmtCount = $pdo->query("SELECT COUNT(*) as total FROM users");
$totalUsers = $stmtCount->fetch()['total'];

if ($totalUsers > 0) {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'super_admin') {
        echo json_encode(['success' => false, 'message' => 'Solo el Super Administrador puede reiniciar la base de datos.']);
        exit;
    }
}

$tables = [
    'game_photos', 'game_play_by_play', 'game_pitching_stats', 'game_batting_stats',
    'game_line_scores', 'games', 'players', 'team_history', 'teams', 'stadiums',
    'categories', 'seasons', 'users', 'site_settings'
];

foreach ($tables as $tbl) {
    try {
        $pdo->exec("DROP TABLE IF EXISTS {$tbl}");
    } catch (Exception $e) {}
}

initDatabaseSchemaAndSeed($pdo);

echo json_encode([
    'success' => true, 
    'message' => 'Base de datos reiniciada a cero para producción. ¡El próximo usuario registrado será el Super Administrador!'
]);

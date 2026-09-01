<?php
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$mode = trim($input['mode'] ?? 'reseed'); // 'reset_clean' or 'reseed'

$tables = ['game_photos', 'game_play_by_play', 'game_pitching_stats', 'game_batting_stats', 'game_line_scores', 'games', 'players', 'team_history', 'teams', 'categories', 'seasons', 'users'];

foreach ($tables as $tbl) {
    try {
        $pdo->exec("TRUNCATE TABLE {$tbl}");
    } catch (Exception $e) {
        $pdo->exec("DELETE FROM {$tbl}");
    }
}

if ($mode === 'reseed') {
    seedInitialLMBData($pdo);
    echo json_encode(['success' => true, 'message' => 'Sistema reiniciado con datos de prueba de la Liga Metropolitana de Béisbol.']);
} else {
    // 100% Clean state with Admin User only
    $adminPassword = password_hash('admin123', PASSWORD_BCRYPT);
    $pdo->exec("INSERT INTO users (username, password_hash, name, email, role) VALUES ('admin', '{$adminPassword}', 'Administrador LMB', 'admin@lmb.org.ar', 'admin')");

    echo json_encode(['success' => true, 'message' => 'Sistema limpiado al 100%. Ahora puede crear su liga desde cero.']);
}

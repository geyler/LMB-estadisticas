<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
    exit;
}

$type = trim($_POST['upload_type'] ?? 'game_photo');

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'Error o archivo no enviado.']);
    exit;
}

$file = $_FILES['file'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

if (!in_array($ext, $allowed)) {
    echo json_encode(['success' => false, 'message' => 'Formato no permitido. Use JPG, PNG o WEBP.']);
    exit;
}

$uploadDir = __DIR__ . '/../uploads/';
$webDir = 'uploads/';

if ($type === 'logo') {
    $targetFolder = $uploadDir . 'logos/';
    $webFolder = $webDir . 'logos/';
} else if ($type === 'player') {
    $targetFolder = $uploadDir . 'players/';
    $webFolder = $webDir . 'players/';
} else {
    $targetFolder = $uploadDir . 'matches/';
    $webFolder = $webDir . 'matches/';
}

if (!is_dir($targetFolder)) {
    mkdir($targetFolder, 0777, true);
}

$filename = $type . '_' . time() . '_' . rand(1000, 9999) . '.' . $ext;
$targetPath = $targetFolder . $filename;
$webPath = $webFolder . $filename;

if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    if ($type === 'logo') {
        $teamId = intval($_POST['team_id'] ?? 0);
        if ($teamId > 0) {
            $pdo->prepare("UPDATE teams SET logo_url = ? WHERE id = ?")->execute([$webPath, $teamId]);
        }
    } else if ($type === 'player') {
        $playerId = intval($_POST['player_id'] ?? 0);
        if ($playerId > 0) {
            $pdo->prepare("UPDATE players SET photo_url = ? WHERE id = ?")->execute([$webPath, $playerId]);
        }
    } else if ($type === 'game_photo') {
        $gameId = intval($_POST['game_id'] ?? 0);
        $caption = trim($_POST['caption'] ?? 'Postal del partido');
        if ($gameId > 0) {
            // Check count limit (max 10)
            $stmtC = $pdo->prepare("SELECT COUNT(*) as cnt FROM game_photos WHERE game_id = ?");
            $stmtC->execute([$gameId]);
            $cnt = $stmtC->fetch()['cnt'];

            if ($cnt >= 10) {
                echo json_encode(['success' => false, 'message' => 'Límite de 10 postales alcanzado para este partido.']);
                exit;
            }

            $pdo->prepare("INSERT INTO game_photos (game_id, image_url, caption) VALUES (?, ?, ?)")
                ->execute([$gameId, $webPath, $caption]);
        }
    }

    echo json_encode(['success' => true, 'url' => $webPath, 'message' => 'Imagen subida exitosamente.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Error al guardar la imagen en el servidor.']);
}

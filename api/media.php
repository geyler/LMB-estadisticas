<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'gallery') {
    $entityType = trim($_GET['entity_type'] ?? 'team');
    $entityId = intval($_GET['entity_id'] ?? 0);

    if ($entityId <= 0) {
        echo json_encode(['success' => true, 'photos' => []]);
        exit;
    }

    if ($entityType === 'game') {
        $stmt = $pdo->prepare("SELECT id, image_url, caption, created_at FROM game_photos WHERE game_id = ? ORDER BY id DESC");
        $stmt->execute([$entityId]);
    } else {
        $stmt = $pdo->prepare("SELECT id, image_url, caption, created_at FROM entity_photos WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC");
        $stmt->execute([$entityType, $entityId]);
    }

    $photos = $stmt->fetchAll();
    echo json_encode(['success' => true, 'photos' => $photos]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'delete') {
    $input = json_decode(file_get_contents('php_input'), true) ?? $_POST;
    $photoId = intval($input['photo_id'] ?? 0);
    $entityType = trim($input['entity_type'] ?? 'team');

    if ($photoId > 0) {
        if ($entityType === 'game') {
            $pdo->prepare("DELETE FROM game_photos WHERE id = ?")->execute([$photoId]);
        } else {
            $pdo->prepare("DELETE FROM entity_photos WHERE id = ?")->execute([$photoId]);
        }
        echo json_encode(['success' => true, 'message' => 'Imagen eliminada exitosamente.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'ID de imagen inválido.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
    exit;
}

$type = trim($_POST['upload_type'] ?? 'entity_gallery');

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
    $targetFolder = $uploadDir . 'galleries/';
    $webFolder = $webDir . 'galleries/';
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
            $stmtC = $pdo->prepare("SELECT COUNT(*) as cnt FROM game_photos WHERE game_id = ?");
            $stmtC->execute([$gameId]);
            $cnt = $stmtC->fetch()['cnt'];

            if ($cnt >= 10) {
                echo json_encode(['success' => false, 'message' => 'Límite máximo de 10 postales por partido alcanzado.']);
                exit;
            }

            $pdo->prepare("INSERT INTO game_photos (game_id, image_url, caption) VALUES (?, ?, ?)")
                ->execute([$gameId, $webPath, $caption]);
        }
    } else if ($type === 'entity_gallery') {
        $entityType = trim($_POST['entity_type'] ?? 'team');
        $entityId = intval($_POST['entity_id'] ?? 0);
        $caption = trim($_POST['caption'] ?? 'Postal informativa');

        if ($entityId > 0) {
            $stmtC = $pdo->prepare("SELECT COUNT(*) as cnt FROM entity_photos WHERE entity_type = ? AND entity_id = ?");
            $stmtC->execute([$entityType, $entityId]);
            $cnt = $stmtC->fetch()['cnt'];

            if ($cnt >= 10) {
                echo json_encode(['success' => false, 'message' => 'Límite máximo de 10 postales alcanzado para esta entidad.']);
                exit;
            }

            $pdo->prepare("INSERT INTO entity_photos (entity_type, entity_id, image_url, caption) VALUES (?, ?, ?, ?)")
                ->execute([$entityType, $entityId, $webPath, $caption]);
        }
    }

    echo json_encode(['success' => true, 'url' => $webPath, 'message' => 'Imagen subida exitosamente.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Error al guardar la imagen en el servidor.']);
}

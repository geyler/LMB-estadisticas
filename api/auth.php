<?php
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? ($method === 'POST' ? 'login' : 'me');

if ($action === 'login' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = trim($input['username'] ?? '');
    $password = trim($input['password'] ?? '');

    if (empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Ingrese usuario y contraseña.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        unset($user['password_hash']);
        $_SESSION['user'] = $user;
        echo json_encode(['success' => true, 'user' => $user]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Usuario o contraseña incorrectos.']);
    }
    exit;
}

if ($action === 'logout') {
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Sesión cerrada.']);
    exit;
}

if ($action === 'me') {
    if (isset($_SESSION['user'])) {
        echo json_encode(['success' => true, 'user' => $_SESSION['user']]);
    } else {
        echo json_encode(['success' => false, 'user' => null, 'role' => 'viewer']);
    }
    exit;
}

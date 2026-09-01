<?php
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? ($method === 'POST' ? 'login' : 'me');

// Check Session User
if ($action === 'me') {
    if (isset($_SESSION['user'])) {
        // Refresh latest user record
        $stmt = $pdo->prepare("SELECT u.id, u.username, u.name, u.email, u.role, u.assigned_team_id, t.name as assigned_team_name 
                               FROM users u 
                               LEFT JOIN teams t ON u.assigned_team_id = t.id 
                               WHERE u.id = ? LIMIT 1");
        $stmt->execute([$_SESSION['user']['id']]);
        $user = $stmt->fetch();

        if ($user) {
            $_SESSION['user'] = $user;
            echo json_encode(['success' => true, 'user' => $user]);
            exit;
        }
    }
    echo json_encode(['success' => false, 'user' => null, 'role' => 'viewer']);
    exit;
}

// Login
if ($action === 'login' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $usernameOrEmail = trim($input['username'] ?? '');
    $password = trim($input['password'] ?? '');

    if (empty($usernameOrEmail) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Ingrese usuario/email y contraseña.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1");
    $stmt->execute([$usernameOrEmail, $usernameOrEmail]);
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

// Public Registration (First User = Super Admin)
if ($action === 'register' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $name = trim($input['name'] ?? '');
    $email = trim($input['email'] ?? '');
    $username = trim($input['username'] ?? '');
    $password = trim($input['password'] ?? '');

    if (empty($name) || empty($email) || empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Todos los campos son obligatorios.']);
        exit;
    }

    // Check if email or username exists
    $stmtCheck = $pdo->prepare("SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1");
    $stmtCheck->execute([$email, $username]);
    if ($stmtCheck->fetch()) {
        echo json_encode(['success' => false, 'message' => 'El correo o nombre de usuario ya está registrado.']);
        exit;
    }

    // Count total users
    $stmtCount = $pdo->query("SELECT COUNT(*) as total FROM users");
    $totalUsers = $stmtCount->fetch()['total'];

    // First user to register becomes Super Admin!
    $role = ($totalUsers == 0) ? 'super_admin' : 'viewer';

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmtIns = $pdo->prepare("INSERT INTO users (username, password_hash, name, email, role) VALUES (?, ?, ?, ?, ?)");
    $stmtIns->execute([$username, $hash, $name, $email, $role]);
    $userId = $pdo->lastInsertId();

    $stmtUser = $pdo->prepare("SELECT id, username, name, email, role FROM users WHERE id = ?");
    $stmtUser->execute([$userId]);
    $newUser = $stmtUser->fetch();

    $_SESSION['user'] = $newUser;
    echo json_encode([
        'success' => true, 
        'user' => $newUser, 
        'message' => ($role === 'super_admin') ? '¡Felicidades! Eres el primer usuario registrado y has sido asignado como Super Administrador.' : 'Cuenta registrada exitosamente.'
    ]);
    exit;
}

// Logout
if ($action === 'logout') {
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Sesión cerrada.']);
    exit;
}

// Super Admin / Admin Search & Manage Users
if ($action === 'users_list') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $q = trim($_GET['q'] ?? '');
    $sql = "SELECT u.id, u.username, u.name, u.email, u.role, u.assigned_team_id, t.name as assigned_team_name, u.created_at
            FROM users u
            LEFT JOIN teams t ON u.assigned_team_id = t.id";

    if (!empty($q)) {
        $sql .= " WHERE u.email LIKE :q OR u.name LIKE :q OR u.username LIKE :q";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['q' => "%{$q}%"]);
    } else {
        $stmt = $pdo->query($sql);
    }
    $users = $stmt->fetchAll();

    echo json_encode(['success' => true, 'users' => $users]);
    exit;
}

// Super Admin / Admin Update User Role or Assigned Team
if ($action === 'user_update' && $method === 'POST') {
    if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['super_admin', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $userId = intval($input['user_id'] ?? 0);
    $role = trim($input['role'] ?? 'viewer');
    $assignedTeamId = !empty($input['assigned_team_id']) ? intval($input['assigned_team_id']) : null;

    if (!$userId) {
        echo json_encode(['success' => false, 'message' => 'ID de usuario requerido.']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE users SET role = ?, assigned_team_id = ? WHERE id = ?");
    $stmt->execute([$role, $assignedTeamId, $userId]);

    echo json_encode(['success' => true, 'message' => 'Permisos y asignación de equipo actualizados correctamente.']);
    exit;
}

// Site Settings (App Name, Logo, Branding)
if ($action === 'settings') {
    $stmt = $pdo->query("SELECT setting_key, setting_value FROM site_settings");
    $rows = $stmt->fetchAll();
    $settings = [];
    foreach ($rows as $r) {
        $settings[$r['setting_key']] = $r['setting_value'];
    }
    echo json_encode(['success' => true, 'settings' => $settings]);
    exit;
}

if ($action === 'settings_update' && $method === 'POST') {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'super_admin') {
        echo json_encode(['success' => false, 'message' => 'Solo el Super Administrador puede modificar los ajustes globales.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $siteName = trim($input['site_name'] ?? 'Liga Metropolitana de Béisbol');
    $siteLogo = trim($input['site_logo'] ?? 'assets/images/lmb_logo.png');

    $stmt = $pdo->prepare("INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?");
    try {
        $stmt->execute(['site_name', $siteName, $siteName]);
        $stmt->execute(['site_logo', $siteLogo, $siteLogo]);
    } catch (Exception $e) {
        // SQLite fallback
        $pdo->prepare("UPDATE site_settings SET setting_value = ? WHERE setting_key = ?")->execute([$siteName, 'site_name']);
        $pdo->prepare("UPDATE site_settings SET setting_value = ? WHERE setting_key = ?")->execute([$siteLogo, 'site_logo']);
    }

    echo json_encode(['success' => true, 'message' => 'Ajustes del sistema guardados exitosamente.']);
    exit;
}

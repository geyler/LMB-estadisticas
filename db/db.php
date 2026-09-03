<?php
/**
 * PDO Database Manager & Auto-Provisioner (Clean Production Setup)
 * Liga Metropolitana de Béisbol (LMB)
 */

require_once __DIR__ . '/config.php';

function getDBConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $driver = DB_DRIVER;
    $host = DB_HOST;
    $dbName = DB_NAME;
    $user = DB_USER;
    $pass = DB_PASS;
    $port = DB_PORT;

    try {
        if ($driver === 'mysql') {
            try {
                // 1. Primary: Hostinger Credentials
                $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
                $pdo = new PDO($dsn, $user, $pass, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            } catch (Exception $me) {
                // 2. Fallback: Local root MySQL
                $dsnRoot = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
                $pdo = new PDO($dsnRoot, 'root', '', [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            }
        } else {
            throw new Exception("Force SQLite fallback");
        }
    } catch (Exception $e) {
        try {
            $sqlitePath = SQLITE_FILE;
            $pdo = new PDO("sqlite:" . $sqlitePath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            $pdo->exec("PRAGMA foreign_keys = ON;");
        } catch (PDOException $se) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos: ' . $se->getMessage()]);
            exit;
        }
    }

    autoInitTables($pdo);

    return $pdo;
}

function autoInitTables($pdo) {
    try {
        $pdo->query("SELECT 1 FROM site_settings LIMIT 1");
        $pdo->query("SELECT 1 FROM game_stages LIMIT 1");
        $pdo->query("SELECT 1 FROM audit_logs LIMIT 1");
    } catch (Exception $e) {
        initDatabaseSchemaAndSeed($pdo);
    }
}

function initDatabaseSchemaAndSeed($pdo) {
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $autoInc = ($driver === 'sqlite') ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';

    $statements = [
        "CREATE TABLE IF NOT EXISTS site_settings (
            id {$autoInc},
            setting_key VARCHAR(50) UNIQUE NOT NULL,
            setting_value TEXT NOT NULL
        );",

        "CREATE TABLE IF NOT EXISTS users (
            id {$autoInc},
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'viewer',
            assigned_team_id INT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS seasons (
            id {$autoInc},
            name VARCHAR(100) NOT NULL,
            year INT NOT NULL,
            is_active TINYINT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS categories (
            id {$autoInc},
            season_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            code VARCHAR(20) NOT NULL,
            level INT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS stadiums (
            id {$autoInc},
            name VARCHAR(100) NOT NULL,
            field_name VARCHAR(100) DEFAULT '',
            address VARCHAR(255) DEFAULT '',
            city VARCHAR(100) DEFAULT 'Buenos Aires',
            maps_url VARCHAR(255) DEFAULT '',
            notes VARCHAR(255) DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS teams (
            id {$autoInc},
            category_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            short_name VARCHAR(20) NOT NULL,
            logo_url VARCHAR(255) DEFAULT '',
            home_stadium_id INT DEFAULT NULL,
            city VARCHAR(100) DEFAULT 'Buenos Aires',
            foundation_year INT DEFAULT 1950,
            color_primary VARCHAR(20) DEFAULT '#0A192F',
            color_secondary VARCHAR(20) DEFAULT '#D32F2F',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS team_history (
            id {$autoInc},
            team_id INT NOT NULL,
            season_id INT NOT NULL,
            category_id INT NOT NULL,
            notes VARCHAR(255) DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS players (
            id {$autoInc},
            team_id INT NOT NULL,
            first_name VARCHAR(50) NOT NULL,
            last_name VARCHAR(50) NOT NULL,
            jersey_number INT NOT NULL DEFAULT 0,
            position_primary VARCHAR(10) NOT NULL DEFAULT 'OF',
            position_secondary VARCHAR(10) DEFAULT '',
            bats VARCHAR(5) NOT NULL DEFAULT 'R',
            throws VARCHAR(5) NOT NULL DEFAULT 'R',
            photo_url VARCHAR(255) DEFAULT '',
            birth_date DATE DEFAULT NULL,
            is_active TINYINT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS games (
            id {$autoInc},
            season_id INT NOT NULL,
            category_id INT NOT NULL,
            home_team_id INT NOT NULL,
            away_team_id INT NOT NULL,
            stadium_id INT DEFAULT NULL,
            game_date DATETIME NOT NULL,
            field_location VARCHAR(100) DEFAULT 'Sede LMB',
            status VARCHAR(20) DEFAULT 'scheduled',
            current_inning INT DEFAULT 1,
            half_inning VARCHAR(10) DEFAULT 'top',
            home_score INT DEFAULT 0,
            away_score INT DEFAULT 0,
            home_hits INT DEFAULT 0,
            away_hits INT DEFAULT 0,
            home_errors INT DEFAULT 0,
            away_errors INT DEFAULT 0,
            winning_pitcher_id INT DEFAULT NULL,
            losing_pitcher_id INT DEFAULT NULL,
            saving_pitcher_id INT DEFAULT NULL,
            mvp_player_id INT DEFAULT NULL,
            lock_user_id INT DEFAULT NULL,
            lock_timestamp DATETIME DEFAULT NULL,
            recap_notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS game_line_scores (
            id {$autoInc},
            game_id INT NOT NULL,
            team_id INT NOT NULL,
            inning INT NOT NULL,
            runs INT NOT NULL DEFAULT 0
        );",

        "CREATE TABLE IF NOT EXISTS game_batting_stats (
            id {$autoInc},
            game_id INT NOT NULL,
            team_id INT NOT NULL,
            player_id INT NOT NULL,
            batting_order INT DEFAULT 1,
            position VARCHAR(10) DEFAULT 'DH',
            ab INT DEFAULT 0,
            r INT DEFAULT 0,
            h INT DEFAULT 0,
            singles INT DEFAULT 0,
            doubles INT DEFAULT 0,
            triples INT DEFAULT 0,
            hr INT DEFAULT 0,
            rbi INT DEFAULT 0,
            bb INT DEFAULT 0,
            so INT DEFAULT 0,
            sb INT DEFAULT 0,
            cs INT DEFAULT 0,
            hbp INT DEFAULT 0,
            sf INT DEFAULT 0,
            e INT DEFAULT 0
        );",

        "CREATE TABLE IF NOT EXISTS game_pitching_stats (
            id {$autoInc},
            game_id INT NOT NULL,
            team_id INT NOT NULL,
            player_id INT NOT NULL,
            ip_outs INT DEFAULT 0,
            h INT DEFAULT 0,
            r INT DEFAULT 0,
            er INT DEFAULT 0,
            bb INT DEFAULT 0,
            so INT DEFAULT 0,
            hr INT DEFAULT 0,
            pitches_count INT DEFAULT 0,
            is_starter TINYINT DEFAULT 0,
            decision VARCHAR(10) DEFAULT 'NONE'
        );",

        "CREATE TABLE IF NOT EXISTS game_play_by_play (
            id {$autoInc},
            game_id INT NOT NULL,
            inning INT NOT NULL,
            half_inning VARCHAR(10) NOT NULL,
            batter_id INT NOT NULL,
            pitcher_id INT NOT NULL,
            outs_before INT DEFAULT 0,
            result_code VARCHAR(20) NOT NULL,
            description VARCHAR(255) NOT NULL,
            runs_scored INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS game_photos (
            id {$autoInc},
            game_id INT NOT NULL,
            image_url VARCHAR(255) NOT NULL,
            caption VARCHAR(255) DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS entity_photos (
            id {$autoInc},
            entity_type VARCHAR(20) NOT NULL,
            entity_id INT NOT NULL,
            image_url VARCHAR(255) NOT NULL,
            caption VARCHAR(255) DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS audit_logs (
            id {$autoInc},
            action VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            user_id INT DEFAULT NULL,
            user_name VARCHAR(100) DEFAULT 'Sistema',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS game_stages (
            id {$autoInc},
            name VARCHAR(100) NOT NULL,
            code VARCHAR(30) NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",

        "CREATE TABLE IF NOT EXISTS season_champions (
            id {$autoInc},
            season_id INT NOT NULL,
            category_id INT NOT NULL,
            team_id INT NOT NULL,
            title_name VARCHAR(100) DEFAULT 'Campeón Oficial',
            notes VARCHAR(255) DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );"
    ];

    foreach ($statements as $sql) {
        $pdo->exec($sql);
    }

    // Dynamic Column Migrations for Existing Tables
    try {
        $pdo->exec("ALTER TABLE players ADD COLUMN role_type VARCHAR(20) DEFAULT 'player';");
    } catch (Exception $ex) {}

    try {
        $pdo->exec("ALTER TABLE games ADD COLUMN game_stage VARCHAR(100) DEFAULT 'Temporada Regular';");
    } catch (Exception $ex) {}

    seedProductionBase($pdo);
}

function logAuditAction($pdo, $action, $description) {
    try {
        $userId = $_SESSION['user']['id'] ?? null;
        $userName = $_SESSION['user']['name'] ?? ($_SESSION['user']['username'] ?? 'Sistema/Admin');
        $stmt = $pdo->prepare("INSERT INTO audit_logs (action, description, user_id, user_name) VALUES (?, ?, ?, ?)");
        $stmt->execute([$action, $description, $userId, $userName]);
    } catch (Exception $e) {}
}

function seedProductionBase($pdo) {
    // 1. Initial Site Settings
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $insertCmd = ($driver === 'sqlite') ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
    $pdo->exec("{$insertCmd} INTO site_settings (setting_key, setting_value) VALUES
        ('site_name', 'Liga Metropolitana de Béisbol'),
        ('site_logo', 'assets/images/lmb_logo.png')
    ");

    // 2. Initial Season 2026 if empty
    $stmtSeasonCheck = $pdo->query("SELECT COUNT(*) FROM seasons");
    if ($stmtSeasonCheck->fetchColumn() == 0) {
        $pdo->exec("INSERT INTO seasons (name, year, is_active) VALUES ('Temporada Oficial 2026', 2026, 1)");
        $seasonId = $pdo->lastInsertId();

        $stmtCatCheck = $pdo->query("SELECT COUNT(*) FROM categories");
        if ($stmtCatCheck->fetchColumn() == 0) {
            $pdo->prepare("INSERT INTO categories (season_id, name, code, level) VALUES (?, ?, ?, ?)")
                ->execute([$seasonId, 'Primera División', 'DIV1', 1]);
        }
    }

    // 3. Initial Game Stages / Roles if empty
    $stmtStageCheck = $pdo->query("SELECT COUNT(*) FROM game_stages");
    if ($stmtStageCheck->fetchColumn() == 0) {
        $defaultStages = [
            ['name' => 'Temporada Regular', 'code' => 'REGULAR'],
            ['name' => 'Comodín (Wild Card)', 'code' => 'WILDCARD'],
            ['name' => 'Octavos de Final', 'code' => 'OCTAVOS'],
            ['name' => 'Cuartos de Final', 'code' => 'CUARTOS'],
            ['name' => 'Semifinal', 'code' => 'SEMIFINAL'],
            ['name' => 'Serie Final / Campeonato', 'code' => 'FINAL'],
            ['name' => 'Juego de Exhibición', 'code' => 'EXHIBICION'],
            ['name' => 'Amistoso', 'code' => 'AMISTOSO'],
            ['name' => 'Amistoso Internacional', 'code' => 'INTERNACIONAL']
        ];
        $stmtStg = $pdo->prepare("{$insertCmd} INTO game_stages (name, code) VALUES (?, ?)");
        foreach ($defaultStages as $ds) {
            $stmtStg->execute([$ds['name'], $ds['code']]);
        }
    }
}

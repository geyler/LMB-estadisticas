<?php
/**
 * PDO Database Manager & Auto-Provisioner
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
            $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
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
            die("Error de conexión a la base de datos: " . $se->getMessage());
        }
    }

    autoInitTables($pdo);

    return $pdo;
}

function autoInitTables($pdo) {
    try {
        $pdo->query("SELECT 1 FROM site_settings LIMIT 1");
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
            field_location VARCHAR(100) DEFAULT 'Estadio Ezeiza Cancha 1',
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
        );"
    ];

    foreach ($statements as $sql) {
        $pdo->exec($sql);
    }

    seedInitialLMBData($pdo);
}

function seedInitialLMBData($pdo) {
    // 1. Site Settings
    $pdo->exec("INSERT INTO site_settings (setting_key, setting_value) VALUES
        ('site_name', 'Liga Metropolitana de Béisbol'),
        ('site_logo', 'assets/images/lmb_logo.png')
    ");

    // 2. Users (First User = Super Admin)
    $superAdminPass = password_hash('admin123', PASSWORD_BCRYPT);
    $teamAdminPass = password_hash('delegado123', PASSWORD_BCRYPT);

    $pdo->exec("INSERT INTO users (username, password_hash, name, email, role, assigned_team_id) VALUES
        ('admin', '{$superAdminPass}', 'Super Administrador LMB', 'admin@lmb.org.ar', 'super_admin', NULL),
        ('delegado_daom', '{$teamAdminPass}', 'Delegado DAOM', 'daom@lmb.org.ar', 'team_admin', 1),
        ('delegado_berazategui', '{$teamAdminPass}', 'Delegado Berazategui', 'berazategui@lmb.org.ar', 'team_admin', 3),
        ('anotador', '{$teamAdminPass}', 'Planillero Oficial LMB', 'anotador@lmb.org.ar', 'scorekeeper', NULL)
    ");

    // 3. Season 2026
    $pdo->exec("INSERT INTO seasons (name, year, is_active) VALUES ('Temporada Oficial 2026', 2026, 1)");
    $seasonId = $pdo->lastInsertId();

    // 4. Categories (Divisions)
    $categories = [
        ['name' => 'A1 - Primera División', 'code' => 'A1', 'level' => 1],
        ['name' => 'A2 - Segunda División', 'code' => 'A2', 'level' => 2],
        ['name' => 'A3 - Tercera División', 'code' => 'A3', 'level' => 3],
        ['name' => 'Infantiles', 'code' => 'INF', 'level' => 4],
        ['name' => 'Little League', 'code' => 'LTL', 'level' => 5],
    ];

    $catIds = [];
    $stmtCat = $pdo->prepare("INSERT INTO categories (season_id, name, code, level) VALUES (?, ?, ?, ?)");
    foreach ($categories as $cat) {
        $stmtCat->execute([$seasonId, $cat['name'], $cat['code'], $cat['level']]);
        $catIds[$cat['code']] = $pdo->lastInsertId();
    }

    // 5. Stadiums & Fields / Sedes (Ezeiza 1, 2, 3, 4 + Club Fields)
    $stadiums = [
        ['name' => 'Estadio Ezeiza', 'field' => 'Cancha 1 (Principal)', 'address' => 'Autopista Riccheri Km 24', 'city' => 'Ezeiza'],
        ['name' => 'Estadio Ezeiza', 'field' => 'Cancha 2', 'address' => 'Autopista Riccheri Km 24', 'city' => 'Ezeiza'],
        ['name' => 'Estadio Ezeiza', 'field' => 'Cancha 3', 'address' => 'Autopista Riccheri Km 24', 'city' => 'Ezeiza'],
        ['name' => 'Estadio Ezeiza', 'field' => 'Cancha 4', 'address' => 'Autopista Riccheri Km 24', 'city' => 'Ezeiza'],
        ['name' => 'Predio DAOM Béisbol', 'field' => 'Campo Central DAOM', 'address' => 'Av. Castañares y Lafuente', 'city' => 'Buenos Aires'],
        ['name' => 'Campo Berazategui', 'field' => 'Cancha Principal Berazategui', 'address' => 'Calle 14 y Av. Mitre', 'city' => 'Berazategui'],
        ['name' => 'Polideportivo Lanús', 'field' => 'Campo Lanús Béisbol', 'address' => 'Av. 9 de Julio 1680', 'city' => 'Lanús'],
        ['name' => 'Estadio Ferro Béisbol', 'field' => 'Campo Ferro Caballito', 'address' => 'Av. Avellaneda 1240', 'city' => 'Buenos Aires'],
    ];

    $stadiumIds = [];
    $stmtSt = $pdo->prepare("INSERT INTO stadiums (name, field_name, address, city) VALUES (?, ?, ?, ?)");
    foreach ($stadiums as $st) {
        $stmtSt->execute([$st['name'], $st['field'], $st['address'], $st['city']]);
        $stadiumIds[] = $pdo->lastInsertId();
    }

    // 6. Teams (Including Lanús and Berazategui)
    $teamsData = [
        ['cat' => 'A1', 'name' => 'DAOM Béisbol', 'short' => 'DAOM', 'logo' => 'assets/images/team_daom.png', 'home_st' => $stadiumIds[4], 'color1' => '#0A192F', 'color2' => '#D32F2F'],
        ['cat' => 'A1', 'name' => 'Ferrocarril Oeste', 'short' => 'FERRO', 'logo' => 'assets/images/team_ferro.png', 'home_st' => $stadiumIds[7], 'color1' => '#0F5132', 'color2' => '#FFFFFF'],
        ['cat' => 'A1', 'name' => 'Berazategui B.C.', 'short' => 'BERAZ', 'logo' => 'assets/images/lmb_logo.png', 'home_st' => $stadiumIds[5], 'color1' => '#1D4ED8', 'color2' => '#F59E0B'],
        ['cat' => 'A1', 'name' => 'Lanús Béisbol', 'short' => 'LANUS', 'logo' => 'assets/images/lmb_logo.png', 'home_st' => $stadiumIds[6], 'color1' => '#7F1D1D', 'color2' => '#FFFFFF'],
        ['cat' => 'A2', 'name' => 'Júpiter Béisbol', 'short' => 'JUP', 'logo' => 'assets/images/lmb_logo.png', 'home_st' => null, 'color1' => '#4C1D95', 'color2' => '#FBBF24'],
        ['cat' => 'A2', 'name' => 'C.A. Vélez Sarsfield', 'short' => 'VEL', 'logo' => 'assets/images/lmb_logo.png', 'home_st' => null, 'color1' => '#1E3A8A', 'color2' => '#FFFFFF'],
        ['cat' => 'A3', 'name' => 'Comunicaciones B.C.', 'short' => 'COM', 'logo' => 'assets/images/lmb_logo.png', 'home_st' => null, 'color1' => '#047857', 'color2' => '#F3F4F6'],
        ['cat' => 'INF', 'name' => 'Patriotas Infantiles', 'short' => 'PAT-I', 'logo' => 'assets/images/lmb_logo.png', 'home_st' => null, 'color1' => '#DC2626', 'color2' => '#1D4ED8'],
    ];

    $stmtTeam = $pdo->prepare("INSERT INTO teams (category_id, name, short_name, logo_url, home_stadium_id, city, foundation_year, color_primary, color_secondary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtHist = $pdo->prepare("INSERT INTO team_history (team_id, season_id, category_id, notes) VALUES (?, ?, ?, ?)");

    $teamIds = [];
    foreach ($teamsData as $td) {
        $cId = $catIds[$td['cat']];
        $stmtTeam->execute([$cId, $td['name'], $td['short'], $td['logo'], $td['home_st'], 'Buenos Aires', 1965, $td['color1'], $td['color2']]);
        $tId = $pdo->lastInsertId();
        $teamIds[] = $tId;
        $stmtHist->execute([$tId, $seasonId, $cId, "Participación en categoría {$td['cat']}"]);
    }

    // 7. Players for DAOM and Ferro
    $daomPlayers = [
        ['first' => 'Carlos', 'last' => 'Martínez', 'num' => 10, 'pos1' => 'SS', 'pos2' => '2B', 'bats' => 'R', 'throws' => 'R'],
        ['first' => 'Gustavo', 'last' => 'Gómez', 'num' => 24, 'pos1' => 'CF', 'pos2' => 'LF', 'bats' => 'L', 'throws' => 'L'],
        ['first' => 'Matías', 'last' => 'Ríos', 'num' => 7, 'pos1' => '3B', 'pos2' => '1B', 'bats' => 'R', 'throws' => 'R'],
        ['first' => 'Alejandro', 'last' => 'Valdez', 'num' => 34, 'pos1' => '1B', 'pos2' => 'DH', 'bats' => 'R', 'throws' => 'R'],
        ['first' => 'Marcos', 'last' => 'Pérez', 'num' => 45, 'pos1' => 'P', 'pos2' => 'DH', 'bats' => 'R', 'throws' => 'R'],
    ];

    $ferroPlayers = [
        ['first' => 'Sebastián', 'last' => 'García', 'num' => 2, 'pos1' => '2B', 'pos2' => 'SS', 'bats' => 'R', 'throws' => 'R'],
        ['first' => 'Federico', 'last' => 'Nakamura', 'num' => 11, 'pos1' => 'SS', 'pos2' => '3B', 'bats' => 'L', 'throws' => 'R'],
        ['first' => 'Gonzalo', 'last' => 'Benítez', 'num' => 21, 'pos1' => '1B', 'pos2' => 'DH', 'bats' => 'L', 'throws' => 'L'],
        ['first' => 'Facundo', 'last' => 'Torres', 'num' => 51, 'pos1' => 'P', 'pos2' => 'DH', 'bats' => 'R', 'throws' => 'R'],
    ];

    $stmtPlayer = $pdo->prepare("INSERT INTO players (team_id, first_name, last_name, jersey_number, position_primary, position_secondary, bats, throws) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

    $daomPlayerIds = [];
    foreach ($daomPlayers as $p) {
        $stmtPlayer->execute([1, $p['first'], $p['last'], $p['num'], $p['pos1'], $p['pos2'], $p['bats'], $p['throws']]);
        $daomPlayerIds[] = $pdo->lastInsertId();
    }

    $ferroPlayerIds = [];
    foreach ($ferroPlayers as $p) {
        $stmtPlayer->execute([2, $p['first'], $p['last'], $p['num'], $p['pos1'], $p['pos2'], $p['bats'], $p['throws']]);
        $ferroPlayerIds[] = $pdo->lastInsertId();
    }

    // 8. Sample Games linked to Stadium Sedes (Simultaneous Weekend Matches in Ezeiza fields 1 & 2)
    $stmtGame = $pdo->prepare("INSERT INTO games (season_id, category_id, home_team_id, away_team_id, stadium_id, game_date, field_location, status, current_inning, half_inning, home_score, away_score, home_hits, away_hits, home_errors, away_errors, winning_pitcher_id, losing_pitcher_id, recap_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    // Finished game DAOM vs FERRO
    $stmtGame->execute([
        $seasonId, $catIds['A1'], 1, 2, $stadiumIds[4], date('Y-m-d H:i:s', strtotime('-1 day')),
        'Predio DAOM Béisbol', 'finished', 9, 'end', 6, 4, 10, 7, 1, 2,
        $daomPlayerIds[4], $ferroPlayerIds[3],
        'Gran victoria de DAOM en el clásico con cuadrangular decisivo de 2 carreras de Carlos Martínez.'
    ]);
    $gameId1 = $pdo->lastInsertId();

    // Simultaneous Live Game in Ezeiza Cancha 1: Berazategui vs Lanús
    $stmtGame->execute([
        $seasonId, $catIds['A1'], 3, 4, $stadiumIds[0], date('Y-m-d H:i:s'),
        'Ezeiza - Cancha 1', 'live', 5, 'bottom', 3, 2, 6, 4, 0, 1,
        NULL, NULL, 'Partido en desarrollo en simultáneo en Ezeiza Cancha 1.'
    ]);

    $stmtLine = $pdo->prepare("INSERT INTO game_line_scores (game_id, team_id, inning, runs) VALUES (?, ?, ?, ?)");
    foreach ([0, 1, 0, 2, 0, 0, 2, 1, 0] as $inn => $r) { $stmtLine->execute([$gameId1, 1, $inn + 1, $r]); }
    foreach ([1, 0, 0, 0, 2, 1, 0, 0, 0] as $inn => $r) { $stmtLine->execute([$gameId1, 2, $inn + 1, $r]); }

    $stmtBat = $pdo->prepare("INSERT INTO game_batting_stats (game_id, team_id, player_id, batting_order, position, ab, r, h, singles, doubles, triples, hr, rbi, bb, so, sb) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtBat->execute([$gameId1, 1, $daomPlayerIds[0], 1, 'SS', 4, 2, 3, 2, 0, 0, 1, 2, 1, 0, 1]);
    $stmtBat->execute([$gameId1, 1, $daomPlayerIds[1], 2, 'CF', 4, 1, 2, 1, 1, 0, 0, 1, 0, 1, 0]);

    $stmtPitch = $pdo->prepare("INSERT INTO game_pitching_stats (game_id, team_id, player_id, ip_outs, h, r, er, bb, so, hr, pitches_count, is_starter, decision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtPitch->execute([$gameId1, 1, $daomPlayerIds[4], 21, 5, 3, 2, 2, 7, 0, 95, 1, 'W']);
}

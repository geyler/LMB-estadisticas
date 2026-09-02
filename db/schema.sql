-- Base de Datos Liga Metropolitana de Béisbol (LMB) Buenos Aires
-- Exportable para Hostinger phpMyAdmin

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    assigned_team_id INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS seasons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    year INT NOT NULL,
    is_active TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    level INT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(20) NOT NULL,
    logo_url VARCHAR(255) DEFAULT '',
    city VARCHAR(100) DEFAULT 'Buenos Aires',
    foundation_year INT DEFAULT 1950,
    color_primary VARCHAR(20) DEFAULT '#0A192F',
    color_secondary VARCHAR(20) DEFAULT '#D32F2F',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS team_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    season_id INT NOT NULL,
    category_id INT NOT NULL,
    notes VARCHAR(255) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_id INT NOT NULL,
    category_id INT NOT NULL,
    home_team_id INT NOT NULL,
    away_team_id INT NOT NULL,
    game_date DATETIME NOT NULL,
    field_location VARCHAR(100) DEFAULT 'Estadio LMB Ezeiza',
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
    recap_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_line_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    team_id INT NOT NULL,
    inning INT NOT NULL,
    runs INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_batting_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_pitching_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_play_by_play (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    caption VARCHAR(255) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

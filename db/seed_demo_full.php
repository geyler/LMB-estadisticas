<?php
// Script to generate a complete, high-quality Demo Dataset for LMB Statistics Platform
require_once __DIR__ . '/db.php';

$pdo = getDBConnection();

echo "Iniciando generación de datos de demostración para la LMB...\n";

// 1. Clean existing tables
$tables = [
    'season_champions', 'game_photos', 'game_play_by_play', 'game_pitching_stats', 'game_batting_stats',
    'game_line_scores', 'games', 'players', 'team_history', 'teams', 'stadiums',
    'categories', 'seasons', 'users', 'audit_logs', 'game_stages', 'site_settings'
];

foreach ($tables as $tbl) {
    try {
        $pdo->exec("DROP TABLE IF EXISTS {$tbl}");
    } catch (Exception $e) {}
}

initDatabaseSchemaAndSeed($pdo);

// Clear auto-created default rows for fresh demo seeding
$pdo->exec("DELETE FROM season_champions");
$pdo->exec("DELETE FROM games");
$pdo->exec("DELETE FROM players");
$pdo->exec("DELETE FROM teams");
$pdo->exec("DELETE FROM stadiums");
$pdo->exec("DELETE FROM categories");
$pdo->exec("DELETE FROM seasons");
$pdo->exec("DELETE FROM users");

echo "Tablas reiniciadas con éxito.\n";

// 2. Create Users
$passHash = password_hash('admin123', PASSWORD_DEFAULT);
$stmtUser = $pdo->prepare("INSERT INTO users (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)");

$stmtUser->execute(['admin', 'Super Admin LMB', 'admin@lmb.com', $passHash, 'super_admin']);
$stmtUser->execute(['gestor', 'Gestor Anotador', 'gestor@lmb.com', $passHash, 'scorekeeper']);

// 3. Create 7 Stadiums (1 per team)
$stadiumsData = [
    ['Estadio Nacional Ezeiza', 'Campo Principal #1', 'Ezeiza, Prov. Buenos Aires', 'https://maps.google.com'],
    ['Polideportivo Belgrano', 'Diamante Central A', 'Belgrano, CABA', 'https://maps.google.com'],
    ['Parque Chacabuco Béisbol', 'Cancha Principal', 'Chacabuco, CABA', 'https://maps.google.com'],
    ['Club San Martín Béisbol', 'Estadio de San Martín', 'San Martín, Prov. Buenos Aires', 'https://maps.google.com'],
    ['Complejo Villa Domínico', 'Cancha Sur #2', 'Avellaneda, Prov. Buenos Aires', 'https://maps.google.com'],
    ['Estadio La Plata Béisbol', 'Diamante Olímpico', 'La Plata, Prov. Buenos Aires', 'https://maps.google.com'],
    ['Campo Deportivo Lanús', 'Diamante #1', 'Lanús, Prov. Buenos Aires', 'https://maps.google.com']
];

$stadiumIds = [];
$stmtStad = $pdo->prepare("INSERT INTO stadiums (name, field_name, address, city) VALUES (?, ?, ?, 'Buenos Aires')");
foreach ($stadiumsData as $st) {
    $stmtStad->execute([$st[0], $st[1], $st[2]]);
    $stadiumIds[] = $pdo->lastInsertId();
}

// 4. Create Seasons
$stmtSeason = $pdo->prepare("INSERT INTO seasons (name, year, is_active) VALUES (?, ?, ?)");
$stmtSeason->execute(['Temporada 2025', 2025, 0]);
$season2025Id = $pdo->lastInsertId();

$stmtSeason->execute(['Temporada 2026', 2026, 1]);
$season2026Id = $pdo->lastInsertId();

// 5. Create Categories for 2025 & 2026
$stmtCat = $pdo->prepare("INSERT INTO categories (season_id, name, code, level) VALUES (?, ?, ?, ?)");

// 2025 Categories
$stmtCat->execute([$season2025Id, 'Primera División A1 (2025)', 'A1-25', 1]);
$cat2025A1 = $pdo->lastInsertId();

$stmtCat->execute([$season2025Id, 'Segunda División A2 (2025)', 'A2-25', 2]);
$cat2025A2 = $pdo->lastInsertId();

// 2026 Categories
$stmtCat->execute([$season2026Id, 'Primera División A1', 'A1', 1]);
$cat2026A1 = $pdo->lastInsertId();

$stmtCat->execute([$season2026Id, 'Segunda División A2', 'A2', 2]);
$cat2026A2 = $pdo->lastInsertId();

// 6. Create Teams (4 in A1, 3 in A2)
$teamsData = [
    // A1 Teams
    ['Criollos de Buenos Aires', 'CRI', $stadiumIds[0], '#0F172A', '#3B82F6', $cat2026A1],
    ['Cardenales LMB', 'CAR', $stadiumIds[1], '#991B1B', '#F59E0B', $cat2026A1],
    ['Águilas del Sur', 'AGU', $stadiumIds[2], '#1E3A8A', '#10B981', $cat2026A1],
    ['Vaqueros de Ezeiza', 'VAQ', $stadiumIds[3], '#78350F', '#F59E0B', $cat2026A1],

    // A2 Teams
    ['Tigres de Belgrano', 'TIG', $stadiumIds[4], '#EA580C', '#1E293B', $cat2026A2],
    ['Gigantes de San Martín', 'GIG', $stadiumIds[5], '#4338CA', '#F43F5E', $cat2026A2],
    ['Leones de La Plata', 'LEO', $stadiumIds[6], '#15803D', '#FACC15', $cat2026A2]
];

$teamIds = [];
$stmtTeam = $pdo->prepare("INSERT INTO teams (name, short_name, home_stadium_id, color_primary, color_secondary, category_id) VALUES (?, ?, ?, ?, ?, ?)");
foreach ($teamsData as $td) {
    $stmtTeam->execute([$td[0], $td[1], $td[2], $td[3], $td[4], $td[5]]);
    $tId = $pdo->lastInsertId();
    $teamIds[] = $tId;

    // Create Team Admin User
    $email = strtolower($td[1]) . '@lmb.com';
    $username = strtolower($td[1]);
    $stmtUser->execute([$username, "Delegado " . $td[0], $email, $passHash, 'team_admin']);
    $uId = $pdo->lastInsertId();
    $pdo->exec("UPDATE users SET assigned_team_id = {$tId} WHERE id = {$uId}");
}

// 7. Create Players for Each Team (10 to 12 players per team)
$firstNames = ['Carlos', 'Mateo', 'Gabriel', 'Santiago', 'Alejandro', 'Diego', 'Leonardo', 'Javier', 'Rodrigo', 'Nicolás', 'Matías', 'Lucas', 'Tomás', 'Fernando', 'Ezekiel', 'Gonzalo', 'Maximiliano', 'Agustín', 'Joaquín', 'Ignacio'];
$lastNames = ['González', 'Rodríguez', 'Fernández', 'Martínez', 'López', 'Pérez', 'Silva', 'Morales', 'Benítez', 'Gómez', 'Romero', 'Peralta', 'Herrera', 'Castro', 'Acosta', 'Vargas', 'Ríos', 'Medina', 'Suárez', 'Blanco'];
$positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P', 'P'];

$playersByTeam = []; // team_id => [player_ids]

$stmtPlayer = $pdo->prepare("INSERT INTO players (team_id, first_name, last_name, jersey_number, position_primary, bats, throws, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)");

$usedJersey = [];
foreach ($teamIds as $tId) {
    $playersByTeam[$tId] = [];
    $numPlayers = rand(10, 12);
    for ($i = 0; $i < $numPlayers; $i++) {
        $fn = $firstNames[array_rand($firstNames)];
        $ln = $lastNames[array_rand($lastNames)];
        $num = rand(1, 99);
        $pos = $positions[$i % count($positions)];
        $bats = (rand(1, 10) > 3) ? 'R' : ((rand(1, 10) > 5) ? 'L' : 'S');
        $throws = (rand(1, 10) > 2) ? 'R' : 'L';

        $stmtPlayer->execute([$tId, $fn, $ln, $num, $pos, $bats, $throws]);
        $pId = $pdo->lastInsertId();
        $playersByTeam[$tId][] = [
            'id' => $pId,
            'name' => "{$fn} {$ln}",
            'pos' => $pos
        ];
    }
}

echo "Equipos (" . count($teamIds) . ") y Jugadores creados con éxito.\n";

// Helper function to simulate and record a complete baseball game
function createFinishedGame($pdo, $seasonId, $catId, $homeTeamId, $awayTeamId, $stadiumId, $dateStr, $stageStr, $playersByTeam) {
    $homeScore = rand(2, 9);
    $awayScore = rand(1, 8);
    if ($homeScore === $awayScore) $homeScore++; // No ties in baseball demo

    $homeHits = $homeScore + rand(2, 6);
    $awayHits = $awayScore + rand(2, 5);
    $homeErrors = rand(0, 3);
    $awayErrors = rand(0, 3);

    $stmtG = $pdo->prepare("INSERT INTO games (season_id, category_id, home_team_id, away_team_id, stadium_id, game_date, status, game_stage, home_score, away_score, home_hits, away_hits, home_errors, away_errors, recap_notes) VALUES (?, ?, ?, ?, ?, ?, 'finished', ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtG->execute([$seasonId, $catId, $homeTeamId, $awayTeamId, $stadiumId, $dateStr, $stageStr, $homeScore, $awayScore, $homeHits, $awayHits, $homeErrors, $awayErrors, "Excelente encuentro de demostración entre ambas novenas."]);
    $gameId = $pdo->lastInsertId();

    // Line scores (9 innings)
    $stmtLS = $pdo->prepare("INSERT INTO game_line_scores (game_id, team_id, inning, runs) VALUES (?, ?, ?, ?)");
    $hRunsLeft = $homeScore;
    $aRunsLeft = $awayScore;

    for ($inn = 1; $inn <= 9; $inn++) {
        $hr = ($inn === 9) ? $hRunsLeft : rand(0, min(2, $hRunsLeft));
        $hRunsLeft -= $hr;
        $stmtLS->execute([$gameId, $homeTeamId, $inn, $hr]);

        $ar = ($inn === 9) ? $aRunsLeft : rand(0, min(2, $aRunsLeft));
        $aRunsLeft -= $ar;
        $stmtLS->execute([$gameId, $awayTeamId, $inn, $ar]);
    }

    // Insert Batting & Pitching Stats for both teams
    $stmtBat = $pdo->prepare("INSERT INTO game_batting_stats (game_id, team_id, player_id, batting_order, position, ab, r, h, singles, doubles, triples, hr, rbi, bb, so, sb) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtPitch = $pdo->prepare("INSERT INTO game_pitching_stats (game_id, team_id, player_id, ip_outs, h, r, er, bb, so, hr, is_starter, decision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    foreach ([$homeTeamId, $awayTeamId] as $isHome => $tId) {
        $isWin = ($isHome && $homeScore > $awayScore) || (!$isHome && $awayScore > $homeScore);
        $tPlayers = $playersByTeam[$tId];
        $order = 1;

        $pitcherAssigned = false;
        foreach ($tPlayers as $p) {
            if ($p['pos'] !== 'P' && $order <= 9) {
                $ab = rand(3, 5);
                $h = rand(0, min($ab, 3));
                $d = ($h > 1 && rand(0,1)) ? 1 : 0;
                $t = ($h > 2 && rand(0,1)) ? 1 : 0;
                $hr = ($h > 2 && rand(0,1)) ? 1 : 0;
                $s = max(0, $h - $d - $t - $hr);
                $r = rand(0, $h);
                $rbi = rand(0, $h + 1);
                $bb = rand(0, 2);
                $so = rand(0, 2);
                $sb = rand(0, 1);

                $stmtBat->execute([$gameId, $tId, $p['id'], $order, $p['pos'], $ab, $r, $h, $s, $d, $t, $hr, $rbi, $bb, $so, $sb]);
                $order++;
            } else if ($p['pos'] === 'P' && !$pitcherAssigned) {
                $pitcherAssigned = true;
                $ipOuts = rand(15, 27); // 5 to 9 innings
                $runs = $isHome ? $awayScore : $homeScore;
                $er = max(0, $runs - rand(0, 2));
                $h = $isHome ? $awayHits : $homeHits;
                $bb = rand(1, 4);
                $so = rand(3, 10);
                $decision = $isWin ? 'W' : 'L';

                $stmtPitch->execute([$gameId, $tId, $p['id'], $ipOuts, $h, $runs, $er, $bb, $so, rand(0, 2), 1, $decision]);
            }
        }
    }

    return $gameId;
}

// 8. Generate Temporada 2025 Games (100% Finished)
echo "Generando partidos y estadísticas de la Temporada 2025 (Histórico)...\n";

// A1 2025 Games (Criollos, Cardenales, Águilas, Vaqueros)
$a1Teams = [$teamIds[0], $teamIds[1], $teamIds[2], $teamIds[3]];
$gDate = new DateTime('2025-03-01 15:00:00');

for ($r = 1; $r <= 3; $r++) {
    for ($i = 0; $i < count($a1Teams); $i++) {
        for ($j = $i + 1; $j < count($a1Teams); $j++) {
            $gDate->modify('+7 days');
            createFinishedGame($pdo, $season2025Id, $cat2025A1, $a1Teams[$i], $a1Teams[$j], $stadiumIds[$i], $gDate->format('Y-m-d H:i:s'), 'Temporada Regular', $playersByTeam);
        }
    }
}

// 2025 Final A1 -> Criollos Champion
$gDate->modify('+7 days');
$finalGame2025A1 = createFinishedGame($pdo, $season2025Id, $cat2025A1, $teamIds[0], $teamIds[1], $stadiumIds[0], $gDate->format('Y-m-d H:i:s'), 'Gran Final A1', $playersByTeam);

// Register Champion 2025 A1
$stmtChamp = $pdo->prepare("INSERT INTO season_champions (season_id, category_id, team_id, title_name, notes) VALUES (?, ?, ?, ?, ?)");
$stmtChamp->execute([$season2025Id, $cat2025A1, $teamIds[0], 'Campeón Oficial A1', 'Ganador de la Gran Final 2025']);

// A2 2025 Games (Tigres, Gigantes, Leones)
$a2Teams = [$teamIds[4], $teamIds[5], $teamIds[6]];
for ($r = 1; $r <= 2; $r++) {
    for ($i = 0; $i < count($a2Teams); $i++) {
        for ($j = $i + 1; $j < count($a2Teams); $j++) {
            $gDate->modify('+7 days');
            createFinishedGame($pdo, $season2025Id, $cat2025A2, $a2Teams[$i], $a2Teams[$j], $stadiumIds[$i+4], $gDate->format('Y-m-d H:i:s'), 'Temporada Regular', $playersByTeam);
        }
    }
}
// 2025 Final A2 -> Tigres Champion
$gDate->modify('+7 days');
createFinishedGame($pdo, $season2025Id, $cat2025A2, $teamIds[4], $teamIds[5], $stadiumIds[4], $gDate->format('Y-m-d H:i:s'), 'Gran Final A2', $playersByTeam);
$stmtChamp->execute([$season2025Id, $cat2025A2, $teamIds[4], 'Campeón Oficial A2', 'Ganador de la Serie Final 2025']);


// 9. Generate Temporada 2026 Games (Active Season - ~60% finished, ~40% scheduled / live)
echo "Generando partidos y estadísticas de la Temporada 2026 (En Curso)...\n";

$gDate2026 = new DateTime('2026-03-01 14:00:00');

// A1 2026 Matches: 7 Finished, 1 Live, 4 Scheduled
for ($i = 0; $i < count($a1Teams); $i++) {
    for ($j = $i + 1; $j < count($a1Teams); $j++) {
        $gDate2026->modify('+7 days');
        createFinishedGame($pdo, $season2026Id, $cat2026A1, $a1Teams[$i], $a1Teams[$j], $stadiumIds[$i], $gDate2026->format('Y-m-d H:i:s'), 'Temporada Regular', $playersByTeam);
    }
}

// 1 Live Game
$gDate2026->modify('+7 days');
$stmtG = $pdo->prepare("INSERT INTO games (season_id, category_id, home_team_id, away_team_id, stadium_id, game_date, status, game_stage, current_inning, half_inning, home_score, away_score, home_hits, away_hits) VALUES (?, ?, ?, ?, ?, ?, 'live', 'Temporada Regular', 5, 'bottom', 4, 3, 6, 5)");
$stmtG->execute([$season2026Id, $cat2026A1, $teamIds[1], $teamIds[2], $stadiumIds[1], $gDate2026->format('Y-m-d H:i:s')]);

// 4 Scheduled Games
for ($k = 0; $k < 4; $k++) {
    $gDate2026->modify('+7 days');
    $hT = $a1Teams[$k % count($a1Teams)];
    $aT = $a1Teams[($k + 1) % count($a1Teams)];
    $stmtG = $pdo->prepare("INSERT INTO games (season_id, category_id, home_team_id, away_team_id, stadium_id, game_date, status, game_stage) VALUES (?, ?, ?, ?, ?, ?, 'scheduled', 'Temporada Regular')");
    $stmtG->execute([$season2026Id, $cat2026A1, $hT, $aT, $stadiumIds[$k], $gDate2026->format('Y-m-d H:i:s')]);
}

// A2 2026 Matches: 4 Finished, 3 Scheduled
for ($i = 0; $i < count($a2Teams); $i++) {
    for ($j = $i + 1; $j < count($a2Teams); $j++) {
        $gDate2026->modify('+7 days');
        createFinishedGame($pdo, $season2026Id, $cat2026A2, $a2Teams[$i], $a2Teams[$j], $stadiumIds[$i+4], $gDate2026->format('Y-m-d H:i:s'), 'Temporada Regular', $playersByTeam);
    }
}
for ($k = 0; $k < 3; $k++) {
    $gDate2026->modify('+7 days');
    $hT = $a2Teams[$k % count($a2Teams)];
    $aT = $a2Teams[($k + 1) % count($a2Teams)];
    $stmtG = $pdo->prepare("INSERT INTO games (season_id, category_id, home_team_id, away_team_id, stadium_id, game_date, status, game_stage) VALUES (?, ?, ?, ?, ?, ?, 'scheduled', 'Temporada Regular')");
    $stmtG->execute([$season2026Id, $cat2026A2, $hT, $aT, $stadiumIds[$k+4], $gDate2026->format('Y-m-d H:i:s')]);
}

// 10. Register Audit Logs
$pdo->exec("INSERT INTO audit_logs (action, description, user_name) VALUES ('SEED_DEMO', 'Generación completa del conjunto de datos de demostración (Temporadas 2025 y 2026).', 'Sistema LMB')");

echo "¡Demostración generada exitosamente!\n";
echo "Temporadas: 2025 (Histórico) y 2026 (Activa)\n";
echo "Categorías: A1 (4 equipos) y A2 (3 equipos)\n";
echo "Estadios: 7 sedes deportivas creadas\n";
echo "Credenciales de Acceso Demo:\n";
echo " - Super Admin: admin@lmb.com / admin123\n";
echo " - Gestor / Anotador: gestor@lmb.com / admin123\n";
echo " - Delegados de Clubes: cri@lmb.com, car@lmb.com, agu@lmb.com, vaq@lmb.com, tig@lmb.com, gig@lmb.com, leo@lmb.com / admin123\n";

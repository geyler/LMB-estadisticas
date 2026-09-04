<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');
session_start();
require_once __DIR__ . '/../db/db.php';

$pdo = getDBConnection();

$type = trim($_GET['type'] ?? 'batting'); // 'batting' or 'pitching'
$stat = trim($_GET['stat'] ?? ($type === 'batting' ? 'avg' : 'era'));
$categoryId = intval($_GET['category_id'] ?? 0);
$seasonId = intval($_GET['season_id'] ?? 0);
$limit = intval($_GET['limit'] ?? 10);

if ($type === 'batting') {
    $whereCond = " WHERE p.is_active = 1 AND g.status = 'finished' AND bs.ab > 0 ";
    if ($categoryId > 0) {
        $whereCond .= " AND t.category_id = {$categoryId} ";
    } elseif ($seasonId > 0) {
        $whereCond .= " AND c.season_id = {$seasonId} ";
    }

    $sql = "
        SELECT 
            p.id as player_id, p.first_name, p.last_name, p.jersey_number, p.photo_url, p.bats,
            t.name as team_name, t.short_name as team_short, t.logo_url as team_logo,
            COUNT(DISTINCT bs.game_id) as gp,
            SUM(bs.ab) as ab, SUM(bs.r) as r, SUM(bs.h) as h,
            SUM(bs.doubles) as doubles, SUM(bs.triples) as triples, SUM(bs.hr) as hr,
            SUM(bs.rbi) as rbi, SUM(bs.bb) as bb, SUM(bs.so) as so, SUM(bs.sb) as sb, SUM(bs.hbp) as hbp, SUM(bs.sf) as sf
        FROM game_batting_stats bs
        JOIN games g ON bs.game_id = g.id
        JOIN players p ON bs.player_id = p.id
        JOIN teams t ON p.team_id = t.id
        LEFT JOIN categories c ON t.category_id = c.id
        {$whereCond}
        GROUP BY p.id
        HAVING SUM(bs.ab) >= 1
    ";

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$r) {
        $ab = intval($r['ab']);
        $h = intval($r['h']);
        $bb = intval($r['bb']);
        $hbp = intval($r['hbp']);
        $sf = intval($r['sf']);
        $d2 = intval($r['doubles']);
        $d3 = intval($r['triples']);
        $hr = intval($r['hr']);

        $r['avg_val'] = ($ab > 0) ? ($h / $ab) : 0;
        $r['avg'] = number_format($r['avg_val'], 3);

        $obpDen = ($ab + $bb + $hbp + $sf);
        $obpVal = ($obpDen > 0) ? (($h + $bb + $hbp) / $obpDen) : 0;
        $r['obp'] = number_format($obpVal, 3);

        $tb = ($h - $d2 - $d3 - $hr) + ($d2 * 2) + ($d3 * 3) + ($hr * 4);
        $slgVal = ($ab > 0) ? ($tb / $ab) : 0;
        $r['slg'] = number_format($slgVal, 3);
        $r['ops_val'] = $obpVal + $slgVal;
        $r['ops'] = number_format($r['ops_val'], 3);
    }
    unset($r);

    // Sort by requested stat
    usort($rows, function($a, $b) use ($stat) {
        switch ($stat) {
            case 'avg': return $b['avg_val'] <=> $a['avg_val'];
            case 'hr': return $b['hr'] <=> $a['hr'];
            case 'rbi': return $b['rbi'] <=> $a['rbi'];
            case 'h': return $b['h'] <=> $a['h'];
            case 'ops': return $b['ops_val'] <=> $a['ops_val'];
            case 'sb': return $b['sb'] <=> $a['sb'];
            case 'r': return $b['r'] <=> $a['r'];
            default: return $b['avg_val'] <=> $a['avg_val'];
        }
    });

    $leaders = array_slice($rows, 0, $limit);
    echo json_encode(['success' => true, 'type' => 'batting', 'stat' => $stat, 'leaders' => $leaders]);
    exit;

} else {
    // Pitching Leaders
    $whereCond = " WHERE p.is_active = 1 AND g.status = 'finished' AND (ps.ip_outs > 0 OR ps.pitches_count > 0) ";
    if ($categoryId > 0) {
        $whereCond .= " AND t.category_id = {$categoryId} ";
    } elseif ($seasonId > 0) {
        $whereCond .= " AND c.season_id = {$seasonId} ";
    }

    $sql = "
        SELECT 
            p.id as player_id, p.first_name, p.last_name, p.jersey_number, p.photo_url, p.throws,
            t.name as team_name, t.short_name as team_short, t.logo_url as team_logo,
            COUNT(DISTINCT ps.game_id) as gp,
            SUM(ps.ip_outs) as ip_outs,
            SUM(ps.h) as h, SUM(ps.r) as r, SUM(ps.er) as er,
            SUM(ps.bb) as bb, SUM(ps.so) as so, SUM(ps.hr) as hr,
            SUM(CASE WHEN ps.decision = 'W' THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN ps.decision = 'L' THEN 1 ELSE 0 END) as losses,
            SUM(CASE WHEN ps.decision = 'SV' THEN 1 ELSE 0 END) as saves
        FROM game_pitching_stats ps
        JOIN games g ON ps.game_id = g.id
        JOIN players p ON ps.player_id = p.id
        JOIN teams t ON p.team_id = t.id
        LEFT JOIN categories c ON t.category_id = c.id
        {$whereCond}
        GROUP BY p.id
        HAVING SUM(ps.ip_outs) >= 1
    ";

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$r) {
        $ipOuts = intval($r['ip_outs']);
        $ipFull = floor($ipOuts / 3);
        $ipRem = $ipOuts % 3;
        $r['ip_display'] = $ipFull . '.' . $ipRem;
        $ipFloat = $ipFull + ($ipRem / 3);

        $er = intval($r['er']);
        $h = intval($r['h']);
        $bb = intval($r['bb']);

        $r['era_val'] = ($ipFloat > 0) ? (($er * 9) / $ipFloat) : 999.00;
        $r['era'] = number_format($r['era_val'], 2);

        $r['whip_val'] = ($ipFloat > 0) ? (($h + $bb) / $ipFloat) : 999.00;
        $r['whip'] = number_format($r['whip_val'], 2);
    }
    unset($r);

    usort($rows, function($a, $b) use ($stat) {
        switch ($stat) {
            case 'era': return $a['era_val'] <=> $b['era_val']; // Ascending
            case 'so': return $b['so'] <=> $a['so'];
            case 'wins': return $b['wins'] <=> $a['wins'];
            case 'saves': return $b['saves'] <=> $a['saves'];
            case 'whip': return $a['whip_val'] <=> $b['whip_val']; // Ascending
            case 'ip': return $b['ip_outs'] <=> $a['ip_outs'];
            default: return $a['era_val'] <=> $b['era_val'];
        }
    });

    $leaders = array_slice($rows, 0, $limit);
    echo json_encode(['success' => true, 'type' => 'pitching', 'stat' => $stat, 'leaders' => $leaders]);
    exit;
}

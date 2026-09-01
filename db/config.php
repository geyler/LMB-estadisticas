<?php
/**
 * Database Configuration for Hostinger & Local XAMPP
 * Liga Metropolitana de Béisbol (LMB) Buenos Aires
 */

define('DB_DRIVER', 'mysql'); // 'mysql' or 'sqlite'
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'lmb_estadisticas');
define('DB_USER', 'root');
define('DB_PASS', '');

// Path to SQLite fallback file when MySQL is unavailable
define('SQLITE_FILE', __DIR__ . '/lmb_database.sqlite');

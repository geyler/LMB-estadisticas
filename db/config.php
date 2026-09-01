<?php
/**
 * Database Configuration for Hostinger & Local XAMPP
 * Liga Metropolitana de Béisbol (LMB) Buenos Aires
 */

define('DB_DRIVER', 'mysql'); // 'mysql' or 'sqlite'
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'u798603604_lmb');
define('DB_USER', 'u798603604_lmb');
define('DB_PASS', 'Del1Al9#');

// Path to SQLite fallback file when MySQL is unavailable
define('SQLITE_FILE', __DIR__ . '/lmb_database.sqlite');

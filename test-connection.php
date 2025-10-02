<?php
/**
 * Archivo de prueba de conexión a PostgreSQL
 * Acceder a: http://localhost:8080/insumos/api/test-connection.php
 */

require_once 'config/database.php';
require_once 'utils/helpers.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    // Probar query simple
    $stmt = $conn->query("SELECT COUNT(*) as total FROM usuarios");
    $result = $stmt->fetch();
    
    // Obtener versión de PostgreSQL
    $versionStmt = $conn->query("SELECT version()");
    $version = $versionStmt->fetch();
    
    // Listar todas las tablas
    $tablesStmt = $conn->query("
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    ");
    $tables = $tablesStmt->fetchAll(PDO::FETCH_COLUMN);
    
    sendResponse(true, [
        'message' => 'Conexión exitosa a PostgreSQL',
        'database' => 'sistema_insumos',
        'usuarios_count' => $result['total'],
        'postgres_version' => $version['version'],
        'tables_count' => count($tables),
        'tables' => $tables,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
} catch(Exception $e) {
    logError('Error en test de conexión: ' . $e->getMessage());
    
    sendResponse(false, null, [
        'message' => 'Error de conexión',
        'details' => $e->getMessage()
    ], 500);
}
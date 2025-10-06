<?php
/**
 * Endpoint de usuarios
 * Maneja actualización de tokens y consultas de usuarios
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../utils/helpers.php';

setupCORS();

$requestData = getRequestData();
$action = $requestData['action'] ?? '';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    switch($action) {
        
        case 'update':
            handleUpdateUsuario($conn, $requestData);
            break;
            
        case 'get':
            handleGetUsuario($conn, $requestData);
            break;
            
        default:
            sendResponse(false, null, 'Acción no válida', 400);
    }
    
} catch(Exception $e) {
    logError('Error en usuarios.php: ' . $e->getMessage());
    sendResponse(false, null, 'Error del servidor: ' . $e->getMessage(), 500);
}

/**
 * Actualizar datos de usuario (principalmente tokens)
 */
function handleUpdateUsuario($conn, $requestData) {
    SessionManager::requireAuth();
    
    $data = $requestData['data'] ?? null;
    $filters = $requestData['filters'] ?? [];
    
    if (!$data) {
        sendResponse(false, null, 'Datos de actualización requeridos', 400);
    }
    
    // Construir SQL dinámicamente según los campos a actualizar
    $setClauses = [];
    $params = [];
    
    $allowedFields = [
        'token_disponible',
        'token_papeleria_ordinario', 
        'token_papeleria_extraordinario',
        'fecha_ultimo_login'
    ];
    
    foreach ($data as $field => $value) {
        if (in_array($field, $allowedFields)) {
            $setClauses[] = "$field = :$field";
            $params[$field] = $value;
        }
    }
    
    if (empty($setClauses)) {
        sendResponse(false, null, 'No hay campos válidos para actualizar', 400);
    }
    
    // Construir WHERE clause
    $whereClause = '1=1';
    if (isset($filters['id'])) {
        $whereClause .= ' AND id = :id';
        $params['id'] = $filters['id']['value'];
    }
    
    $sql = "
        UPDATE usuarios 
        SET " . implode(', ', $setClauses) . "
        WHERE $whereClause
        RETURNING *
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    
    $usuario = $stmt->fetch();
    
    // Actualizar sesión si es el usuario actual
    if ($usuario && $usuario['id'] === SessionManager::getCurrentUser()['id']) {
        SessionManager::updateTokens([
            'token_disponible' => $usuario['token_disponible'],
            'token_papeleria_ordinario' => $usuario['token_papeleria_ordinario'],
            'token_papeleria_extraordinario' => $usuario['token_papeleria_extraordinario']
        ]);
    }
    
    sendResponse(true, [$usuario]);
}

/**
 * Obtener datos de usuario
 */
function handleGetUsuario($conn, $requestData) {
    SessionManager::requireAuth();
    
    $filters = $requestData['filters'] ?? [];
    
    $sql = "
        SELECT u.id, u.username, u.nombre, u.email, u.departamento, 
               u.rol_id, u.token_disponible, u.token_papeleria_ordinario,
               u.token_papeleria_extraordinario, u.activo,
               r.nombre as rol_nombre
        FROM usuarios u
        LEFT JOIN roles r ON u.rol_id = r.id
        WHERE u.activo = true
    ";
    
    $params = [];
    
    if (isset($filters['id'])) {
        $sql .= " AND u.id = :id";
        $params['id'] = $filters['id']['value'];
    }
    
    if (isset($filters['username'])) {
        $sql .= " AND u.username = :username";
        $params['username'] = $filters['username']['value'];
    }
    
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    
    $usuarios = $stmt->fetchAll();
    
    sendResponse(true, $usuarios);
}
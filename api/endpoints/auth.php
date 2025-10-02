<?php
/**
 * Endpoint de autenticación
 * Reemplaza las funciones de Supabase Auth
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
        
        case 'login':
            handleLogin($conn, $requestData);
            break;
            
        case 'logout':
            handleLogout();
            break;
            
        case 'check-session':
            handleCheckSession();
            break;
            
        case 'get-profile':
            handleGetProfile($conn);
            break;
            
        default:
            sendResponse(false, null, 'Acción no válida', 400);
    }
    
} catch(Exception $e) {
    logError('Error en auth.php: ' . $e->getMessage());
    sendResponse(false, null, 'Error del servidor: ' . $e->getMessage(), 500);
}

/**
 * Manejar login
 */
function handleLogin($conn, $data) {
    error_log("=== DEBUG LOGIN INICIO ===");
    error_log("Data recibida: " . json_encode($data));
    
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    
    error_log("Username: " . $username);
    error_log("Password recibido: " . ($password ? 'SÍ' : 'NO'));
    
    // Validar campos requeridos
    $missing = validateRequired($data, ['username', 'password']);
    if (!empty($missing)) {
        error_log("Campos faltantes: " . json_encode($missing));
        sendResponse(false, null, 'Campos requeridos: ' . implode(', ', $missing), 400);
    }
    
    error_log("Antes de buscar usuario en BD");
    
    // Buscar usuario
    $stmt = $conn->prepare("
        SELECT u.*, r.nombre as rol_nombre, r.descripcion as rol_descripcion
        FROM usuarios u
        LEFT JOIN roles r ON u.rol_id = r.id
        WHERE u.username = :username AND u.activo = true
    ");
    
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch();
    
    error_log("Usuario encontrado: " . ($user ? 'SÍ' : 'NO'));
    
    if (!$user) {
        error_log("Usuario no encontrado o inactivo");
        sendResponse(false, null, 'Usuario no encontrado o inactivo', 401);
    }
    
    // ... resto del código
    
    // Verificar contraseña (compatibilidad con passwords sin hash)
    if (!verifyPassword($password, $user['password_hash'])) {
        sendResponse(false, null, 'Contraseña incorrecta', 401);
    }
    
    // Actualizar última fecha de login
    $updateStmt = $conn->prepare("
        UPDATE usuarios 
        SET fecha_ultimo_login = NOW() 
        WHERE id = :id
    ");
    $updateStmt->execute(['id' => $user['id']]);
    
    // Preparar datos de sesión
    $userData = [
        'id' => $user['id'],
        'username' => $user['username'],
        'nombre' => $user['nombre'],
        'rol' => $user['rol_nombre'],
        'rol_id' => $user['rol_id'],
        'departamento' => $user['departamento'],
        'token_disponible' => $user['token_disponible'],
        'token_papeleria_ordinario' => $user['token_papeleria_ordinario'],
        'token_papeleria_extraordinario' => $user['token_papeleria_extraordinario']
    ];
    
    // Crear sesión
    SessionManager::login($userData);
    
    // Responder sin incluir password_hash
    unset($user['password_hash']);
    
    sendResponse(true, [
        'user' => $userData,
        'message' => 'Login exitoso'
    ]);
}

/**
 * Manejar logout
 */
function handleLogout() {
    SessionManager::logout();
    sendResponse(true, ['message' => 'Sesión cerrada correctamente']);
}

/**
 * Verificar sesión activa
 */
function handleCheckSession() {
    if (SessionManager::isLoggedIn()) {
        $user = SessionManager::getCurrentUser();
        sendResponse(true, [
            'logged_in' => true,
            'user' => $user
        ]);
    } else {
        sendResponse(true, [
            'logged_in' => false,
            'user' => null
        ]);
    }
}

/**
 * Obtener perfil del usuario actual
 */
function handleGetProfile($conn) {
    SessionManager::requireAuth();
    
    $userId = $_SESSION['user_id'];
    
    $stmt = $conn->prepare("
        SELECT u.*, r.nombre as rol_nombre, r.descripcion as rol_descripcion
        FROM usuarios u
        LEFT JOIN roles r ON u.rol_id = r.id
        WHERE u.id = :id
    ");
    
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();
    
    if (!$user) {
        sendResponse(false, null, 'Usuario no encontrado', 404);
    }
    
    unset($user['password_hash']);
    
    sendResponse(true, ['user' => $user]);
}
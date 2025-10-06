<?php
/**
 * Endpoint de gestión de usuarios
 * Solo accesible para super_admin
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
    
    // Verificar que sea super_admin para todas las operaciones
    SessionManager::requireAuth();
    $currentUser = SessionManager::getCurrentUser();
    
    if ($currentUser['rol'] !== 'super_admin') {
        sendResponse(false, null, 'Solo super administradores pueden gestionar usuarios', 403);
    }
    
    switch($action) {
        case 'get-all':
            handleGetAllUsuarios($conn);
            break;
            
        case 'get-roles':
            handleGetRoles($conn);
            break;
            
        case 'create':
            handleCreateUsuario($conn, $requestData);
            break;
            
        case 'update':
            handleUpdateUsuario($conn, $requestData);
            break;
            
        case 'toggle-estado':
            handleToggleEstado($conn, $requestData);
            break;
            
        case 'reset-token':
            handleResetToken($conn, $requestData);
            break;
            
        default:
            sendResponse(false, null, 'Acción no válida', 400);
    }
    
} catch(Exception $e) {
    logError('Error en usuarios.php: ' . $e->getMessage());
    sendResponse(false, null, 'Error del servidor: ' . $e->getMessage(), 500);
}

/**
 * Obtener todos los usuarios con información de roles
 */
function handleGetAllUsuarios($conn) {
    try {
        $sql = "
            SELECT 
                u.*,
                r.nombre as rol_nombre,
                r.descripcion as rol_descripcion,
                r.permisos as rol_permisos
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            ORDER BY u.created_at DESC
        ";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $usuarios = $stmt->fetchAll();
        
        // Formatear respuesta para que coincida con estructura de Supabase
        foreach ($usuarios as &$usuario) {
            // Crear objeto anidado 'roles' como en Supabase
            $usuario['roles'] = [
                'nombre' => $usuario['rol_nombre'],
                'descripcion' => $usuario['rol_descripcion'],
                'permisos' => $usuario['rol_permisos'] ? json_decode($usuario['rol_permisos'], true) : null
            ];
            
            // Limpiar campos redundantes
            unset($usuario['password_hash']);
            unset($usuario['rol_nombre']);
            unset($usuario['rol_descripcion']);
            unset($usuario['rol_permisos']);
        }
        
        sendResponse(true, $usuarios);
        
    } catch(Exception $e) {
        logError('Error en handleGetAllUsuarios: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Obtener roles disponibles
 */
function handleGetRoles($conn) {
    try {
        $sql = "SELECT id, nombre, descripcion FROM roles ORDER BY nombre";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $roles = $stmt->fetchAll();
        
        sendResponse(true, $roles);
        
    } catch(Exception $e) {
        logError('Error en handleGetRoles: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Crear nuevo usuario
 */
function handleCreateUsuario($conn, $requestData) {
    try {
        $data = $requestData['data'] ?? null;
        
        if (!$data) {
            sendResponse(false, null, 'Datos de usuario requeridos', 400);
        }
        
        // Validar campos requeridos
        $required = ['username', 'nombre', 'departamento', 'password_hash', 'rol_id'];
        $missing = validateRequired($data, $required);
        
        if (!empty($missing)) {
            sendResponse(false, null, 'Campos requeridos: ' . implode(', ', $missing), 400);
        }
        
        // Verificar que el username no exista
        $stmtCheck = $conn->prepare("SELECT id FROM usuarios WHERE username = :username");
        $stmtCheck->execute(['username' => $data['username']]);
        
        if ($stmtCheck->fetch()) {
            sendResponse(false, null, 'El username ya existe', 400);
        }
        
        // Insertar usuario
        $sql = "
            INSERT INTO usuarios (
                username,
                nombre,
                departamento,
                password_hash,
                rol_id,
                activo,
                token_disponible,
                token_papeleria_ordinario,
                token_papeleria_extraordinario,
                created_at,
                updated_at
            ) VALUES (
                :username,
                :nombre,
                :departamento,
                :password_hash,
                :rol_id,
                :activo,
                :token_disponible,
                :token_papeleria_ordinario,
                :token_papeleria_extraordinario,
                NOW(),
                NOW()
            )
            RETURNING *
        ";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute([
            'username' => strtoupper($data['username']),
            'nombre' => $data['nombre'],
            'departamento' => $data['departamento'],
            'password_hash' => $data['password_hash'], // Ya viene del frontend
            'rol_id' => $data['rol_id'],
            'activo' => isset($data['activo']) ? ($data['activo'] ? 1 : 0) : 1,
            'token_disponible' => isset($data['token_disponible']) ? $data['token_disponible'] : 1,
            'token_papeleria_ordinario' => 1,
            'token_papeleria_extraordinario' => 1
        ]);
        
        $usuario = $stmt->fetch();
        
        // Quitar password_hash de la respuesta
        unset($usuario['password_hash']);
        
        sendResponse(true, [$usuario]);
        
    } catch(Exception $e) {
        logError('Error en handleCreateUsuario: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Actualizar usuario existente
 */
function handleUpdateUsuario($conn, $requestData) {
    try {
        $usuarioId = $requestData['usuario_id'] ?? null;
        $data = $requestData['data'] ?? null;
        
        if (!$usuarioId || !$data) {
            sendResponse(false, null, 'ID de usuario y datos requeridos', 400);
        }
        
        // Construir update dinámico
        $setClauses = [];
        $params = ['id' => $usuarioId];
        
        $allowedFields = [
            'username',
            'nombre',
            'departamento',
            'rol_id',
            'activo',
            'token_disponible',
            'token_papeleria_ordinario',
            'token_papeleria_extraordinario',
            'password_hash'
        ];
        
        foreach ($data as $field => $value) {
            if (in_array($field, $allowedFields)) {
                // Convertir booleanos
                if ($field === 'activo' && is_bool($value)) {
                    $value = $value ? 1 : 0;
                }
                
                $setClauses[] = "$field = :$field";
                $params[$field] = $value;
            }
        }
        
        if (empty($setClauses)) {
            sendResponse(false, null, 'No hay campos para actualizar', 400);
        }
        
        // Agregar updated_at
        $setClauses[] = "updated_at = NOW()";
        
        $sql = "
            UPDATE usuarios 
            SET " . implode(', ', $setClauses) . "
            WHERE id = :id
            RETURNING *
        ";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $usuario = $stmt->fetch();
        
        if (!$usuario) {
            sendResponse(false, null, 'Usuario no encontrado', 404);
        }
        
        // Quitar password_hash de la respuesta
        unset($usuario['password_hash']);
        
        sendResponse(true, [$usuario]);
        
    } catch(Exception $e) {
        logError('Error en handleUpdateUsuario: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Activar/Desactivar usuario
 */
function handleToggleEstado($conn, $requestData) {
    try {
        $usuarioId = $requestData['usuario_id'] ?? null;
        $nuevoEstado = $requestData['nuevo_estado'] ?? null;
        
        if (!$usuarioId || $nuevoEstado === null) {
            sendResponse(false, null, 'Usuario ID y nuevo estado requeridos', 400);
        }
        
        $sql = "
            UPDATE usuarios 
            SET activo = :activo, updated_at = NOW()
            WHERE id = :id
            RETURNING *
        ";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute([
            'activo' => $nuevoEstado ? 1 : 0,
            'id' => $usuarioId
        ]);
        
        $usuario = $stmt->fetch();
        
        if (!$usuario) {
            sendResponse(false, null, 'Usuario no encontrado', 404);
        }
        
        unset($usuario['password_hash']);
        sendResponse(true, $usuario);
        
    } catch(Exception $e) {
        logError('Error en handleToggleEstado: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Resetear tokens de usuario
 */
function handleResetToken($conn, $requestData) {
    try {
        $usuarioId = $requestData['usuario_id'] ?? null;
        $tipoToken = $requestData['tipo_token'] ?? 'todos';
        
        if (!$usuarioId) {
            sendResponse(false, null, 'Usuario ID requerido', 400);
        }
        
        // Determinar qué actualizar
        $updateFields = [];
        
        switch ($tipoToken) {
            case 'todos':
                $updateFields = [
                    'token_disponible = 1',
                    'token_papeleria_ordinario = 1',
                    'token_papeleria_extraordinario = 1'
                ];
                break;
            case 'insumo':
                $updateFields = ['token_disponible = 1'];
                break;
            case 'papeleria_ordinario':
                $updateFields = ['token_papeleria_ordinario = 1'];
                break;
            case 'papeleria_extraordinario':
                $updateFields = ['token_papeleria_extraordinario = 1'];
                break;
            default:
                sendResponse(false, null, 'Tipo de token inválido', 400);
        }
        
        $sql = "
            UPDATE usuarios 
            SET " . implode(', ', $updateFields) . ", updated_at = NOW()
            WHERE id = :id
            RETURNING *
        ";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute(['id' => $usuarioId]);
        $usuario = $stmt->fetch();
        
        if (!$usuario) {
            sendResponse(false, null, 'Usuario no encontrado', 404);
        }
        
        unset($usuario['password_hash']);
        sendResponse(true, $usuario);
        
    } catch(Exception $e) {
        logError('Error en handleResetToken: ' . $e->getMessage());
        throw $e;
    }
}
?>
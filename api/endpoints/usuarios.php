<?php
/**
 * Endpoint de gestión de usuarios - VERSIÓN HÍBRIDA
 * - Super Admin: CRUD completo de usuarios
 * - Usuarios normales: Actualizar sus propios tokens
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
    
    // Verificar autenticación para todas las operaciones
    SessionManager::requireAuth();
    $currentUser = SessionManager::getCurrentUser();
    
    switch($action) {
        // ============================================
        // OPERACIONES QUE REQUIEREN SUPER_ADMIN
        // ============================================
        
        case 'get-all':
            requireSuperAdmin($currentUser);
            handleGetAllUsuarios($conn);
            break;
            
        case 'get-roles':
            requireSuperAdmin($currentUser);
            handleGetRoles($conn);
            break;
            
        case 'create':
            requireSuperAdmin($currentUser);
            handleCreateUsuario($conn, $requestData);
            break;
            
        case 'update-admin':
            requireSuperAdmin($currentUser);
            handleUpdateUsuarioAdmin($conn, $requestData);
            break;
            
        case 'toggle-estado':
            requireSuperAdmin($currentUser);
            handleToggleEstado($conn, $requestData);
            break;
            
        case 'reset-token':
            requireSuperAdmin($currentUser);
            handleResetToken($conn, $requestData);
            break;
        
        // ============================================
        // OPERACIONES PARA CUALQUIER USUARIO
        // ============================================
        
        case 'update':
            // Usuarios pueden actualizar sus propios tokens
            handleUpdateUsuario($conn, $requestData, $currentUser);
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
 * Helper: Verificar que el usuario sea super_admin
 */
function requireSuperAdmin($currentUser) {
    if ($currentUser['rol'] !== 'super_admin') {
        sendResponse(false, null, 'Solo super administradores pueden realizar esta operación', 403);
    }
}

// ============================================
// FUNCIONES PARA SUPER_ADMIN
// ============================================

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
 * Crear nuevo usuario (SOLO SUPER_ADMIN)
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
            'password_hash' => $data['password_hash'],
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
 * Actualizar usuario existente (SOLO SUPER_ADMIN)
 * Permite actualizar TODOS los campos
 */
function handleUpdateUsuarioAdmin($conn, $requestData) {
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
        logError('Error en handleUpdateUsuarioAdmin: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Activar/Desactivar usuario (SOLO SUPER_ADMIN)
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
 * Resetear tokens de usuario (SOLO SUPER_ADMIN)
 */
/**
 * Resetear tokens de usuario (SOLO SUPER_ADMIN)
 * MODIFICADO: Ahora verifica si marcó "recibido" antes de renovar token de insumos
 */
function handleResetToken($conn, $requestData) {
    try {
        $usuarioId = $requestData['usuario_id'] ?? null;
        $tipoToken = $requestData['tipo_token'] ?? 'todos';
        $forzarRenovacion = $requestData['forzar'] ?? false; // Nuevo parámetro
        
        if (!$usuarioId) {
            sendResponse(false, null, 'Usuario ID requerido', 400);
        }
        
        // Determinar qué tokens actualizar
        $tokensARenovar = [];
        
        switch ($tipoToken) {
            case 'todos':
                $tokensARenovar = ['insumo', 'papeleria_ordinario', 'papeleria_extraordinario'];
                break;
            case 'insumo':
                $tokensARenovar = ['insumo'];
                break;
            case 'papeleria_ordinario':
                $tokensARenovar = ['papeleria_ordinario'];
                break;
            case 'papeleria_extraordinario':
                $tokensARenovar = ['papeleria_extraordinario'];
                break;
            default:
                sendResponse(false, null, 'Tipo de token inválido', 400);
        }
        
        $updateFields = [];
        $mensajesAdvertencia = [];
        
        foreach ($tokensARenovar as $token) {
            if ($token === 'insumo' && !$forzarRenovacion) {
                // ⚠️ VERIFICAR SI MARCÓ RECIBIDO ANTES DE RENOVAR
                $puedeRenovar = verificarPuedeRenovarInsumo($conn, $usuarioId);
                
                if ($puedeRenovar['puede_renovar']) {
                    $updateFields[] = 'token_disponible = 1';
                } else {
                    $mensajesAdvertencia[] = $puedeRenovar['mensaje'];
                }
            } else {
                // Tokens de papelería o renovación forzada
                if ($token === 'insumo') {
                    $updateFields[] = 'token_disponible = 1';
                } elseif ($token === 'papeleria_ordinario') {
                    $updateFields[] = 'token_papeleria_ordinario = 1';
                } elseif ($token === 'papeleria_extraordinario') {
                    $updateFields[] = 'token_papeleria_extraordinario = 1';
                }
            }
        }
        
        if (empty($updateFields)) {
            sendResponse(false, null, implode('. ', $mensajesAdvertencia), 400);
        }
        
        // Actualizar tokens
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
        
        $response = [
            'usuario' => $usuario,
            'tokens_renovados' => count($updateFields)
        ];
        
        if (!empty($mensajesAdvertencia)) {
            $response['advertencias'] = $mensajesAdvertencia;
        }
        
        sendResponse(true, $response);
        
    } catch(Exception $e) {
        logError('Error en handleResetToken: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Verificar si un usuario puede renovar su token de insumos
 * Retorna true solo si no tiene solicitudes pendientes o si marcó todas como recibidas
 */
function verificarPuedeRenovarInsumo($conn, $usuarioId) {
    try {
        // Buscar la última solicitud ordinaria de insumos cerrada
        $stmt = $conn->prepare("
            SELECT s.id, s.fecha_solicitud
            FROM solicitudes s
            WHERE s.usuario_id = :usuario_id
            AND s.tipo = 'ordinaria'
            AND (s.recurso_tipo = 'insumo' OR s.recurso_tipo IS NULL)
            AND s.estado = 'cerrado'
            AND s.token_usado = true
            ORDER BY s.fecha_solicitud DESC
            LIMIT 1
        ");
        
        $stmt->execute(['usuario_id' => $usuarioId]);
        $ultimaSolicitud = $stmt->fetch();
        
        if (!$ultimaSolicitud) {
            // No tiene solicitudes pendientes, puede renovar
            return [
                'puede_renovar' => true,
                'mensaje' => 'No tiene solicitudes pendientes'
            ];
        }
        
        // Verificar si marcó como recibido
        $stmtRecibido = $conn->prepare("
            SELECT id, fecha_marcado_recibido
            FROM solicitudes_recibidos
            WHERE solicitud_id = :solicitud_id
            AND usuario_id = :usuario_id
        ");
        
        $stmtRecibido->execute([
            'solicitud_id' => $ultimaSolicitud['id'],
            'usuario_id' => $usuarioId
        ]);
        
        $recibido = $stmtRecibido->fetch();
        
        if ($recibido && $recibido['fecha_marcado_recibido']) {
            return [
                'puede_renovar' => true,
                'mensaje' => 'Usuario marcó recibido su última solicitud'
            ];
        } else {
            return [
                'puede_renovar' => false,
                'mensaje' => 'Usuario NO ha marcado como recibida su última solicitud. Debe marcarla primero o usar renovación forzada'
            ];
        }
        
    } catch (Exception $e) {
        logError('Error en verificarPuedeRenovarInsumo: ' . $e->getMessage());
        return [
            'puede_renovar' => false,
            'mensaje' => 'Error al verificar estado: ' . $e->getMessage()
        ];
    }
}

// ============================================
// FUNCIONES PARA CUALQUIER USUARIO AUTENTICADO
// ============================================

/**
 * Actualizar datos de usuario (principalmente tokens)
 * Usuarios normales: Solo pueden actualizar sus propios tokens
 * Admins: Pueden actualizar tokens de cualquier usuario
 */
function handleUpdateUsuario($conn, $requestData, $currentUser) {
    try {
        $data = $requestData['data'] ?? null;
        $filters = $requestData['filters'] ?? [];
        
        if (!$data) {
            sendResponse(false, null, 'Datos de actualización requeridos', 400);
        }
        
        // Determinar el ID del usuario a actualizar
        $targetUserId = null;
        
        if (isset($filters['id'])) {
            $targetUserId = $filters['id']['value'];
        } else {
            // Si no se especifica ID, actualizar el usuario actual
            $targetUserId = $currentUser['id'];
        }
        
        // Verificar permisos: usuarios normales solo pueden actualizar sus propios datos
        $isAdmin = in_array($currentUser['rol'], ['admin', 'super_admin']);
        
        if (!$isAdmin && $targetUserId !== $currentUser['id']) {
            sendResponse(false, null, 'No tienes permiso para actualizar este usuario', 403);
        }
        
        // Construir SQL dinámicamente según los campos a actualizar
        $setClauses = [];
        $params = [];
        
        // Campos permitidos para actualización de tokens
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
        
        $params['target_user_id'] = $targetUserId;
        
        $sql = "
            UPDATE usuarios 
            SET " . implode(', ', $setClauses) . "
            WHERE id = :target_user_id
            RETURNING *
        ";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        
        $usuario = $stmt->fetch();
        
        if (!$usuario) {
            sendResponse(false, null, 'Usuario no encontrado', 404);
        }
        
        // Actualizar sesión si es el usuario actual
        if ($usuario['id'] === $currentUser['id']) {
            SessionManager::updateTokens([
                'token_disponible' => $usuario['token_disponible'],
                'token_papeleria_ordinario' => $usuario['token_papeleria_ordinario'],
                'token_papeleria_extraordinario' => $usuario['token_papeleria_extraordinario']
            ]);
        }
        
        sendResponse(true, [$usuario]);
        
    } catch(Exception $e) {
        logError('Error en handleUpdateUsuario: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Obtener datos de usuario
 */
function handleGetUsuario($conn, $requestData) {
    try {
        $filters = $requestData['filters'] ?? [];
        
        $sql = "SELECT * FROM usuarios WHERE 1=1";
        $params = [];
        
        if (isset($filters['id'])) {
            $sql .= " AND id = :id";
            $params['id'] = $filters['id']['value'];
        }
        
        if (isset($filters['username'])) {
            $sql .= " AND username = :username";
            $params['username'] = $filters['username']['value'];
        }
        
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $usuarios = $stmt->fetchAll();
        
        sendResponse(true, $usuarios);
        
    } catch(Exception $e) {
        logError('Error en handleGetUsuario: ' . $e->getMessage());
        throw $e;
    }
}
?>
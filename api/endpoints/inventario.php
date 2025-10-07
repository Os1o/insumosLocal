<?php
/**
 * Endpoint de inventario polimórfico
 * Maneja operaciones de stock para insumos y papelería
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
        
        case 'crear-item':
            handleCrearItem($conn, $requestData);
            break;
            
        case 'actualizar-item':
            handleActualizarItem($conn, $requestData);
            break;
            
        case 'actualizar-stock':
            handleActualizarStock($conn, $requestData);
            break;
            
        case 'registrar-movimiento':
            handleRegistrarMovimiento($conn, $requestData);
            break;
            
        case 'get-movimientos':
            handleGetMovimientos($conn, $requestData);
            break;
            
        case 'get-movimientos-item':
            handleGetMovimientosItem($conn, $requestData);
            break;
            
        default:
            sendResponse(false, null, 'Acción no válida', 400);
    }
    
} catch(Exception $e) {
    logError('Error en inventario.php: ' . $e->getMessage());
    sendResponse(false, null, 'Error del servidor: ' . $e->getMessage(), 500);
}

/**
 * Crear nuevo item (insumo o papelería)
 */
function handleCrearItem($conn, $requestData) {
    SessionManager::requireAuth();
    SessionManager::requireRole(['super_admin', 'admin']);
    
    $data = $requestData['data'] ?? null;
    
    if (!$data) {
        sendResponse(false, null, 'Datos de item requeridos', 400);
    }
    
    $tipoTabla = $data['tipo_tabla'] ?? 'insumos'; // 'insumos' o 'papeleria'
    
    // Validar campos requeridos
    $required = ['nombre', 'categoria_id', 'unidad_medida', 'cantidad_warning'];
    $missing = validateRequired($data, $required);
    
    if (!empty($missing)) {
        sendResponse(false, null, 'Campos requeridos: ' . implode(', ', $missing), 400);
    }
    
    // Insertar item
    $sql = "
        INSERT INTO $tipoTabla (
            nombre, descripcion, categoria_id, stock_actual, 
            cantidad_warning, unidad_medida, acceso_tipo, activo, creado_por
        ) VALUES (
            :nombre, :descripcion, :categoria_id, :stock_actual,
            :cantidad_warning, :unidad_medida, :acceso_tipo, true, :creado_por
        )
        RETURNING *
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute([
        'nombre' => $data['nombre'],
        'descripcion' => $data['descripcion'] ?? null,
        'categoria_id' => $data['categoria_id'],
        'stock_actual' => $data['stock_actual'] ?? 0,
        'cantidad_warning' => $data['cantidad_warning'],
        'unidad_medida' => $data['unidad_medida'],
        'acceso_tipo' => $data['acceso_tipo'] ?? 'todos',
        'creado_por' => $_SESSION['user_id']
    ]);
    
    $item = $stmt->fetch();
    
    sendResponse(true, [$item]);
}

/**
 * Actualizar item existente
 */
function handleActualizarItem($conn, $requestData) {
    SessionManager::requireAuth();
    SessionManager::requireRole(['super_admin', 'admin']);
    
    $data = $requestData['data'] ?? null;
    
    if (!$data || !isset($data['id'])) {
        sendResponse(false, null, 'ID de item requerido', 400);
    }
    
    $tipoTabla = $data['tipo_tabla'] ?? 'insumos';
    $itemId = $data['id'];
    
    // Construir SQL dinámicamente
    $setClauses = [];
    $params = ['id' => $itemId];
    
    $allowedFields = ['nombre', 'descripcion', 'categoria_id', 'unidad_medida', 
                      'cantidad_warning', 'acceso_tipo', 'activo'];
    
    foreach ($data as $field => $value) {
        if (in_array($field, $allowedFields)) {
            $setClauses[] = "$field = :$field";
            $params[$field] = $value;
        }
    }
    
    if (empty($setClauses)) {
        sendResponse(false, null, 'No hay campos para actualizar', 400);
    }
    
    $sql = "
        UPDATE $tipoTabla 
        SET " . implode(', ', $setClauses) . ", updated_at = NOW()
        WHERE id = :id
        RETURNING *
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    
    $item = $stmt->fetch();
    
    if (!$item) {
        sendResponse(false, null, 'Item no encontrado', 404);
    }
    
    sendResponse(true, [$item]);
}

/**
 * Actualizar stock de un item
 */
function handleActualizarStock($conn, $requestData) {
    SessionManager::requireAuth();
    SessionManager::requireRole(['super_admin', 'admin']);
    
    $data = $requestData['data'] ?? null;
    
    if (!$data || !isset($data['id']) || !isset($data['stock_nuevo'])) {
        sendResponse(false, null, 'ID y stock_nuevo requeridos', 400);
    }
    
    $tipoTabla = $data['tipo_tabla'] ?? 'insumos';
    $itemId = $data['id'];
    $stockNuevo = $data['stock_nuevo'];
    
    $sql = "
        UPDATE $tipoTabla 
        SET stock_actual = :stock_nuevo, updated_at = NOW()
        WHERE id = :id
        RETURNING *
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute([
        'stock_nuevo' => $stockNuevo,
        'id' => $itemId
    ]);
    
    $item = $stmt->fetch();
    
    if (!$item) {
        sendResponse(false, null, 'Item no encontrado', 404);
    }
    
    sendResponse(true, [$item]);
}

/**
 * Registrar movimiento de inventario
 */
function handleRegistrarMovimiento($conn, $requestData) {
    SessionManager::requireAuth();
    SessionManager::requireRole(['super_admin', 'admin']);
    
    $data = $requestData['data'] ?? null;
    
    if (!$data) {
        sendResponse(false, null, 'Datos de movimiento requeridos', 400);
    }
    
    // Validar que tenga insumo_id O papeleria_id (polimórfico)
    if (!isset($data['insumo_id']) && !isset($data['papeleria_id'])) {
        sendResponse(false, null, 'Se requiere insumo_id o papeleria_id', 400);
    }
    
    $sql = "
        INSERT INTO inventario_movimientos (
            insumo_id, papeleria_id, tipo_movimiento, cantidad,
            stock_anterior, stock_nuevo, motivo, admin_id
        ) VALUES (
            :insumo_id, :papeleria_id, :tipo_movimiento, :cantidad,
            :stock_anterior, :stock_nuevo, :motivo, :admin_id
        )
        RETURNING *
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute([
        'insumo_id' => $data['insumo_id'] ?? null,
        'papeleria_id' => $data['papeleria_id'] ?? null,
        'tipo_movimiento' => $data['tipo_movimiento'],
        'cantidad' => $data['cantidad'],
        'stock_anterior' => $data['stock_anterior'],
        'stock_nuevo' => $data['stock_nuevo'],
        'motivo' => $data['motivo'] ?? null,
        'admin_id' => $_SESSION['user_id']
    ]);
    
    $movimiento = $stmt->fetch();
    
    sendResponse(true, [$movimiento]);
}

/**
 * Obtener movimientos recientes (últimos 10)
 */
function handleGetMovimientos($conn, $requestData) {
    SessionManager::requireAuth();
    
    $sql = "
        SELECT 
            m.*,
            i.nombre as insumo_nombre,
            i.unidad_medida as insumo_unidad,
            p.nombre as papeleria_nombre,
            p.unidad_medida as papeleria_unidad,
            u.nombre as admin_nombre
        FROM inventario_movimientos m
        LEFT JOIN insumos i ON m.insumo_id = i.id
        LEFT JOIN papeleria p ON m.papeleria_id = p.id
        LEFT JOIN usuarios u ON m.admin_id = u.id
        ORDER BY m.fecha DESC
        LIMIT 10
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $movimientos = $stmt->fetchAll();
    
    // Formatear respuesta polimórfica
    foreach ($movimientos as &$mov) {
        $mov['insumos'] = $mov['insumo_nombre'] ? [
            'nombre' => $mov['insumo_nombre'],
            'unidad_medida' => $mov['insumo_unidad']
        ] : null;
        
        $mov['papeleria'] = $mov['papeleria_nombre'] ? [
            'nombre' => $mov['papeleria_nombre'],
            'unidad_medida' => $mov['papeleria_unidad']
        ] : null;
        
        $mov['usuarios'] = $mov['admin_nombre'] ? [
            'nombre' => $mov['admin_nombre']
        ] : null;
        
        // Limpiar campos temporales
        unset($mov['insumo_nombre'], $mov['insumo_unidad'], 
              $mov['papeleria_nombre'], $mov['papeleria_unidad'], 
              $mov['admin_nombre']);
    }
    
    sendResponse(true, $movimientos);
}

/**
 * Obtener historial de movimientos de un item específico
 */
function handleGetMovimientosItem($conn, $requestData) {
    SessionManager::requireAuth();
    
    $filters = $requestData['filters'] ?? [];
    
    if (!isset($filters['item_id']) || !isset($filters['tipo_tabla'])) {
        sendResponse(false, null, 'item_id y tipo_tabla requeridos', 400);
    }
    
    $itemId = $filters['item_id'];
    $tipoTabla = $filters['tipo_tabla']; // 'insumo' o 'papeleria'
    
    $campo = $tipoTabla === 'papeleria' ? 'papeleria_id' : 'insumo_id';
    
    $sql = "
        SELECT 
            m.*,
            u.nombre as admin_nombre
        FROM inventario_movimientos m
        LEFT JOIN usuarios u ON m.admin_id = u.id
        WHERE m.$campo = :item_id
        ORDER BY m.fecha DESC
        LIMIT 50
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute(['item_id' => $itemId]);
    $movimientos = $stmt->fetchAll();
    
    // Formatear respuesta
    foreach ($movimientos as &$mov) {
        $mov['usuarios'] = $mov['admin_nombre'] ? [
            'nombre' => $mov['admin_nombre']
        ] : null;
        
        unset($mov['admin_nombre']);
    }
    
    sendResponse(true, $movimientos);
}

?>
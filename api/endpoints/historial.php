<?php
/**
 * Endpoint para el historial de solicitudes
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
        case 'get-historial':
            handleGetHistorial($conn, $requestData);
            break;
            
        case 'get-recibidos':
            handleGetRecibidos($conn, $requestData);
            break;
            
        case 'marcar-recibido':
            handleMarcarRecibido($conn, $requestData);
            break;
            
        default:
            sendResponse(false, null, 'Acción no válida', 400);
    }
    
} catch(Exception $e) {
    logError('Error en historial.php: ' . $e->getMessage());
    sendResponse(false, null, 'Error del servidor', 500);
}

/**
 * Obtener historial de solicitudes del usuario
 */
function handleGetHistorial($conn, $requestData) {
    SessionManager::requireAuth();
    
    $userId = $_SESSION['user_id'];
    $filters = $requestData['filters'] ?? [];
    
    // Construir consulta base
    $sql = "
        SELECT 
            s.id,
            s.tipo,
            s.recurso_tipo,
            s.token_tipo_usado,
            s.estado,
            s.fecha_solicitud,
            s.total_items,
            s.token_usado,
            s.admin_asignado,
            s.fecha_cerrado,
            s.notas_admin,
            s.datos_junta
        FROM solicitudes s
        WHERE s.usuario_id = :usuario_id
    ";
    
    $params = ['usuario_id' => $userId];
    
    // Aplicar filtros
    if (isset($filters['tipo']) && $filters['tipo'] !== '') {
        $sql .= " AND s.tipo = :tipo";
        $params['tipo'] = $filters['tipo'];
    }
    
    if (isset($filters['estado']) && $filters['estado'] !== '') {
        $sql .= " AND s.estado = :estado";
        $params['estado'] = $filters['estado'];
    }
    
    if (isset($filters['recurso_tipo']) && $filters['recurso_tipo'] !== 'todos') {
        $sql .= " AND s.recurso_tipo = :recurso_tipo";
        $params['recurso_tipo'] = $filters['recurso_tipo'];
    }
    
    $sql .= " ORDER BY s.fecha_solicitud DESC";
    
    // Ejecutar consulta de solicitudes
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $solicitudes = $stmt->fetchAll();
    
    // Obtener detalles para cada solicitud
    foreach ($solicitudes as &$solicitud) {
        $solicitud['solicitud_detalles'] = obtenerDetallesSolicitud($conn, $solicitud['id']);
        
        // Parsear datos_junta si existe
        if ($solicitud['datos_junta']) {
            $solicitud['datos_junta'] = json_decode($solicitud['datos_junta'], true);
        }
    }
    
    sendResponse(true, $solicitudes);
}

/**
 * Obtener detalles de una solicitud
 */
function obtenerDetallesSolicitud($conn, $solicitudId) {
    $sql = "
        SELECT 
            sd.cantidad_solicitada,
            sd.cantidad_aprobada,
            sd.insumo_id,
            sd.papeleria_id,
            COALESCE(i.nombre, p.nombre) as nombre,
            COALESCE(i.unidad_medida, p.unidad_medida) as unidad_medida
        FROM solicitud_detalles sd
        LEFT JOIN insumos i ON sd.insumo_id = i.id
        LEFT JOIN papeleria p ON sd.papeleria_id = p.id
        WHERE sd.solicitud_id = :solicitud_id
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute(['solicitud_id' => $solicitudId]);
    return $stmt->fetchAll();
}

/**
 * Obtener lista de solicitudes marcadas como recibidas
 */
function handleGetRecibidos($conn, $requestData) {
    SessionManager::requireAuth();
    
    $userId = $_SESSION['user_id'];
    
    $sql = "
        SELECT solicitud_id 
        FROM solicitudes_recibidos 
        WHERE usuario_id = :usuario_id
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute(['usuario_id' => $userId]);
    $recibidos = $stmt->fetchAll();
    
    // Devolver solo los IDs para fácil verificación
    $ids = array_column($recibidos, 'solicitud_id');
    sendResponse(true, $ids);
}

/**
 * Marcar solicitud como recibida
 */
function handleMarcarRecibido($conn, $requestData) {
    SessionManager::requireAuth();
    
    $userId = $_SESSION['user_id'];
    $solicitudId = $requestData['solicitud_id'] ?? null;
    
    if (!$solicitudId) {
        sendResponse(false, null, 'ID de solicitud requerido', 400);
    }
    
    // Verificar que la solicitud existe y pertenece al usuario
    $stmt = $conn->prepare("
        SELECT id FROM solicitudes 
        WHERE id = :id AND usuario_id = :usuario_id AND estado = 'cerrado'
    ");
    $stmt->execute(['id' => $solicitudId, 'usuario_id' => $userId]);
    $solicitud = $stmt->fetch();
    
    if (!$solicitud) {
        sendResponse(false, null, 'Solicitud no encontrada o no disponible', 404);
    }
    
    // Verificar que no esté ya marcada como recibida
    $stmt = $conn->prepare("
        SELECT id FROM solicitudes_recibidos 
        WHERE solicitud_id = :solicitud_id AND usuario_id = :usuario_id
    ");
    $stmt->execute(['solicitud_id' => $solicitudId, 'usuario_id' => $userId]);
    $existente = $stmt->fetch();
    
    if ($existente) {
        sendResponse(false, null, 'Esta solicitud ya fue marcada como recibida', 400);
    }
    
    // Insertar registro de recibido
    $sql = "
        INSERT INTO solicitudes_recibidos (
            solicitud_id, usuario_id, fecha_marcado_recibido
        ) VALUES (
            :solicitud_id, :usuario_id, NOW()
        )
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute([
        'solicitud_id' => $solicitudId,
        'usuario_id' => $userId
    ]);
    
    sendResponse(true, ['message' => 'Solicitud marcada como recibida']);
}
?>
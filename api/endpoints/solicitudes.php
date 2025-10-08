<?php

/**
 * Endpoint de solicitudes
 * Maneja creación, lectura y actualización de solicitudes
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

    switch ($action) {

        case 'insert':
            handleInsertSolicitud($conn, $requestData);
            break;

        case 'insert-detalles':
            handleInsertDetalles($conn, $requestData);
            break;

        case 'get-recibidos':
            handleGetRecibidos($conn, $requestData);
            break;

        case 'insert-token-renovacion':
            handleInsertTokenRenovacion($conn, $requestData);
            break;

        default:
            sendResponse(false, null, 'Acción no válida', 400);
    }
} catch (Exception $e) {
    logError('Error en solicitudes.php: ' . $e->getMessage());
    sendResponse(false, null, 'Error del servidor: ' . $e->getMessage(), 500);
}

/**
 * Crear nueva solicitud
 */
/**
 * Crear nueva solicitud
 */
function handleInsertSolicitud($conn, $requestData) {
    SessionManager::requireAuth();
    
    $data = $requestData['data'] ?? null;
    
    if (!$data) {
        sendResponse(false, null, 'Datos de solicitud requeridos', 400);
    }
    
    // Validar campos requeridos
    $required = ['usuario_id', 'tipo', 'estado', 'total_items'];
    $missing = validateRequired($data, $required);
    
    if (!empty($missing)) {
        sendResponse(false, null, 'Campos requeridos: ' . implode(', ', $missing), 400);
    }
    
    // ⭐ CORRECCIÓN: Convertir token_usado a boolean real
    $tokenUsado = false;
    if (isset($data['token_usado'])) {
        if (is_bool($data['token_usado'])) {
            $tokenUsado = $data['token_usado'];
        } else if (is_string($data['token_usado'])) {
            $tokenUsado = ($data['token_usado'] === 'true' || $data['token_usado'] === '1');
        } else {
            $tokenUsado = (bool)$data['token_usado'];
        }
    }
    
    // ⭐ CORRECCIÓN CRÍTICA: token_tipo_usado debe ser NULL si es vacío o "ninguno"
    $tokenTipoUsado = null;
    if (isset($data['token_tipo_usado'])) {
        $valor = trim($data['token_tipo_usado']);
        // Solo aceptar valores válidos: ordinario, extraordinario
        if ($valor !== '' && $valor !== 'ninguno' && $valor !== null) {
            $tokenTipoUsado = $valor;
        }
    }
    
    // Preparar datos para inserción
    $sql = "
        INSERT INTO solicitudes (
            id, usuario_id, tipo, recurso_tipo, estado, total_items,
            token_usado, token_tipo_usado, datos_junta, datos_extraordinaria,
            fecha_solicitud
        ) VALUES (
            gen_random_uuid(), :usuario_id, :tipo, :recurso_tipo, :estado, :total_items,
            :token_usado, :token_tipo_usado, :datos_junta, :datos_extraordinaria,
            NOW()
        )
        RETURNING *
    ";
    
    $stmt = $conn->prepare($sql);
    
    // ⭐ BIND EXPLÍCITO para token_tipo_usado
    $stmt->bindValue(':usuario_id', $data['usuario_id']);
    $stmt->bindValue(':tipo', $data['tipo']);
    $stmt->bindValue(':recurso_tipo', $data['recurso_tipo'] ?? 'insumo');
    $stmt->bindValue(':estado', $data['estado']);
    $stmt->bindValue(':total_items', (int)$data['total_items'], PDO::PARAM_INT);
    $stmt->bindValue(':token_usado', $tokenUsado, PDO::PARAM_BOOL);
    
    // ⭐ CRÍTICO: Si es NULL, usar PDO::PARAM_NULL
    if ($tokenTipoUsado === null) {
        $stmt->bindValue(':token_tipo_usado', null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue(':token_tipo_usado', $tokenTipoUsado, PDO::PARAM_STR);
    }
    
    $stmt->bindValue(':datos_junta', isset($data['datos_junta']) ? json_encode($data['datos_junta']) : null);
    $stmt->bindValue(':datos_extraordinaria', isset($data['datos_extraordinaria']) ? json_encode($data['datos_extraordinaria']) : null);
    
    $stmt->execute();
    
    $solicitud = $stmt->fetch();
    
    sendResponse(true, [$solicitud]);
}

/**
 * Insertar detalles de solicitud (items del carrito)
 */
function handleInsertDetalles($conn, $requestData)
{
    SessionManager::requireAuth();

    $data = $requestData['data'] ?? null;

    if (!$data || !is_array($data)) {
        sendResponse(false, null, 'Datos de detalles requeridos como array', 400);
    }

    // Preparar statement para inserción múltiple
    $sql = "
        INSERT INTO solicitud_detalles (
            solicitud_id, insumo_id, papeleria_id, cantidad_solicitada
        ) VALUES (
            :solicitud_id, :insumo_id, :papeleria_id, :cantidad_solicitada
        )
    ";

    $stmt = $conn->prepare($sql);

    $conn->beginTransaction();

    try {
        foreach ($data as $detalle) {
            $stmt->execute([
                'solicitud_id' => $detalle['solicitud_id'],
                'insumo_id' => $detalle['insumo_id'] ?? null,
                'papeleria_id' => $detalle['papeleria_id'] ?? null,
                'cantidad_solicitada' => $detalle['cantidad_solicitada']
            ]);
        }

        $conn->commit();
        sendResponse(true, ['inserted' => count($data)]);
    } catch (Exception $e) {
        $conn->rollBack();
        throw $e;
    }
}

/**
 * Obtener solicitudes recibidas
 */
function handleGetRecibidos($conn, $requestData)
{
    SessionManager::requireAuth();

    $filters = $requestData['filters'] ?? [];

    $sql = "
        SELECT * FROM solicitudes_recibidos
        WHERE 1=1
    ";

    $params = [];

    if (isset($filters['solicitud_id'])) {
        $sql .= " AND solicitud_id = :solicitud_id";
        $params['solicitud_id'] = $filters['solicitud_id']['value'];
    }

    if (isset($filters['usuario_id'])) {
        $sql .= " AND usuario_id = :usuario_id";
        $params['usuario_id'] = $filters['usuario_id']['value'];
    }

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $recibidos = $stmt->fetchAll();

    sendResponse(true, $recibidos);
}

/**
 * Insertar registro de renovación de token
 */
function handleInsertTokenRenovacion($conn, $requestData)
{
    SessionManager::requireAuth();

    $data = $requestData['data'] ?? null;

    if (!$data) {
        sendResponse(false, null, 'Datos de renovación requeridos', 400);
    }

    $sql = "
        INSERT INTO tokens_renovacion (
            usuario_id, mes_ano, recurso_tipo, token_tipo,
            tenia_solicitud, marco_recibido, token_renovado,
            fecha_verificacion
        ) VALUES (
            :usuario_id, :mes_ano, :recurso_tipo, :token_tipo,
            :tenia_solicitud, :marco_recibido, :token_renovado,
            NOW()
        )
    ";

    $stmt = $conn->prepare($sql);

    $stmt->execute([
        'usuario_id' => $data['usuario_id'],
        'mes_ano' => $data['mes_ano'],
        'recurso_tipo' => $data['recurso_tipo'],
        'token_tipo' => $data['token_tipo'],
        'tenia_solicitud' => $data['tenia_solicitud'] ?? false,
        'marco_recibido' => $data['marco_recibido'] ?? false,
        'token_renovado' => $data['token_renovado'] ?? false
    ]);

    sendResponse(true, ['success' => true]);
}

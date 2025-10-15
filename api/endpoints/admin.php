<?php

/**
 * Endpoint de administración
 * Maneja todas las operaciones del panel administrativo
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../utils/helpers.php';

// CONFIGURACIÓN CORS ESPECÍFICA PARA ADMIN
header('Access-Control-Allow-Origin: http://11.254.27.18');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Iniciar sesión si no está iniciada
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}


setupCORS();

$requestData = getRequestData();
$action = $requestData['action'] ?? '';

try {
    $database = new Database();
    $conn = $database->getConnection();

    // DEBUG: Ver qué hay en la sesión
    error_log("=== DEBUG SESSION ===");
    error_log("Session ID: " . session_id());
    error_log("Session Status: " . session_status());
    error_log("Session Data: " . print_r($_SESSION, true));
    error_log("Cookies: " . print_r($_COOKIE, true));
    error_log("=====================");

    // Verificar que el usuario sea admin o super_admin
    SessionManager::requireAuth();
    $currentUser = SessionManager::getCurrentUser();

    error_log("=== CURRENT USER ===");
    error_log("User data: " . print_r($currentUser, true));
    error_log("Rol: " . ($currentUser['rol'] ?? 'NO DEFINIDO'));
    error_log("====================");

    if ($currentUser['rol'] !== 'admin' && $currentUser['rol'] !== 'super_admin') {
        error_log("ERROR: Rol no válido - " . $currentUser['rol']);
        sendResponse(false, null, 'No tienes permisos de administrador', 403);
    }

    switch ($action) {

        case 'get-solicitudes':
            handleGetSolicitudes($conn, $requestData);
            break;

        case 'get-solicitud-detalle':
            handleGetSolicitudDetalle($conn, $requestData);
            break;

        case 'update-solicitud':
            handleUpdateSolicitud($conn, $requestData);
            break;

        case 'update-detalle':
            handleUpdateDetalle($conn, $requestData);
            break;

        case 'descontar-inventario':
            handleDescontarInventario($conn, $requestData);
            break;

        default:
            sendResponse(false, null, 'Acción no válida', 400);
    }
} catch (Exception $e) {
    logError('Error en admin.php: ' . $e->getMessage());
    sendResponse(false, null, 'Error del servidor: ' . $e->getMessage(), 500);
}

/**
 * Obtener todas las solicitudes con información del usuario
 */
function handleGetSolicitudes($conn, $requestData)
{
    try {
        $filters = $requestData['filters'] ?? [];

        // Construir query base con JOIN para obtener info del usuario
        $sql = "
            SELECT 
                s.*,
                u.nombre as usuario_nombre,
                u.departamento as usuario_departamento,
                admin.nombre as admin_nombre
            FROM solicitudes s
            INNER JOIN usuarios u ON s.usuario_id = u.id
            LEFT JOIN usuarios admin ON s.admin_asignado = admin.id
            WHERE 1=1
        ";

        $params = [];

        // Aplicar filtros opcionales
        if (isset($filters['estado']) && $filters['estado'] !== '') {
            $sql .= " AND s.estado = :estado";
            $params['estado'] = $filters['estado'];
        }

        if (isset($filters['tipo']) && $filters['tipo'] !== '') {
            $sql .= " AND s.tipo = :tipo";
            $params['tipo'] = $filters['tipo'];
        }

        if (isset($filters['recurso_tipo']) && $filters['recurso_tipo'] !== '' && $filters['recurso_tipo'] !== 'todos') {
            $sql .= " AND s.recurso_tipo = :recurso_tipo";
            $params['recurso_tipo'] = $filters['recurso_tipo'];
        }

        $sql .= " ORDER BY s.fecha_solicitud DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $solicitudes = $stmt->fetchAll();

        // Parsear datos_junta si existen
        foreach ($solicitudes as &$solicitud) {
            if ($solicitud['datos_junta']) {
                $solicitud['datos_junta'] = json_decode($solicitud['datos_junta'], true);
            }
        }

        sendResponse(true, $solicitudes);
    } catch (Exception $e) {
        logError('Error en handleGetSolicitudes: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Obtener detalle completo de una solicitud específica
 */
function handleGetSolicitudDetalle($conn, $requestData)
{
    try {
        $solicitudId = $requestData['solicitud_id'] ?? null;

        if (!$solicitudId) {
            sendResponse(false, null, 'ID de solicitud requerido', 400);
        }

        // Obtener solicitud con info del usuario y admin
        $sql = "
            SELECT 
                s.*,
                u.nombre as usuario_nombre,
                u.departamento as usuario_departamento,
                admin.nombre as admin_nombre
            FROM solicitudes s
            INNER JOIN usuarios u ON s.usuario_id = u.id
            LEFT JOIN usuarios admin ON s.admin_asignado = admin.id
            WHERE s.id = :id
        ";

        $stmt = $conn->prepare($sql);
        $stmt->execute(['id' => $solicitudId]);
        $solicitud = $stmt->fetch();

        if (!$solicitud) {
            sendResponse(false, null, 'Solicitud no encontrada', 404);
        }

        // Parsear datos_junta
        if ($solicitud['datos_junta']) {
            $solicitud['datos_junta'] = json_decode($solicitud['datos_junta'], true);
        }

        // Obtener detalles con información de insumos o papelería
        $sqlDetalles = "
            SELECT 
                sd.id,
                sd.cantidad_solicitada,
                sd.cantidad_aprobada,
                sd.insumo_id,
                sd.papeleria_id,
                sd.notas,
                COALESCE(i.nombre, p.nombre) as nombre,
                COALESCE(i.unidad_medida, p.unidad_medida) as unidad_medida,
                COALESCE(i.stock_actual, p.stock_actual) as stock_actual
            FROM solicitud_detalles sd
            LEFT JOIN insumos i ON sd.insumo_id = i.id
            LEFT JOIN papeleria p ON sd.papeleria_id = p.id
            WHERE sd.solicitud_id = :solicitud_id
            ORDER BY sd.id
        ";

        $stmtDetalles = $conn->prepare($sqlDetalles);
        $stmtDetalles->execute(['solicitud_id' => $solicitudId]);
        $detalles = $stmtDetalles->fetchAll();

        $solicitud['solicitud_detalles'] = $detalles;

        sendResponse(true, $solicitud);
    } catch (Exception $e) {
        logError('Error en handleGetSolicitudDetalle: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Actualizar estado de una solicitud
 */
function handleUpdateSolicitud($conn, $requestData)
{
    try {
        $solicitudId = $requestData['solicitud_id'] ?? null;
        $data = $requestData['data'] ?? null;

        if (!$solicitudId || !$data) {
            sendResponse(false, null, 'Datos incompletos', 400);
        }

        // Construir SQL dinámicamente
        $setClauses = [];
        $params = ['id' => $solicitudId];

        $allowedFields = [
            'estado',
            'admin_asignado',
            'fecha_revision',
            'fecha_cerrado',
            'notas_admin'
        ];

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
            UPDATE solicitudes 
            SET " . implode(', ', $setClauses) . "
            WHERE id = :id
            RETURNING *
        ";

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $solicitud = $stmt->fetch();

        sendResponse(true, $solicitud);
    } catch (Exception $e) {
        logError('Error en handleUpdateSolicitud: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Actualizar un detalle de solicitud (cantidad aprobada)
 */
function handleUpdateDetalle($conn, $requestData)
{
    try {
        $detalleId = $requestData['detalle_id'] ?? null;
        $cantidadAprobada = $requestData['cantidad_aprobada'] ?? null;

        if (!$detalleId || $cantidadAprobada === null) {
            sendResponse(false, null, 'Datos incompletos', 400);
        }

        $sql = "
            UPDATE solicitud_detalles 
            SET cantidad_aprobada = :cantidad_aprobada
            WHERE id = :id
            RETURNING *
        ";

        $stmt = $conn->prepare($sql);
        $stmt->execute([
            'id' => $detalleId,
            'cantidad_aprobada' => $cantidadAprobada
        ]);

        $detalle = $stmt->fetch();

        sendResponse(true, $detalle);
    } catch (Exception $e) {
        logError('Error en handleUpdateDetalle: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Descontar inventario cuando se cierra una solicitud
 */
function handleDescontarInventario($conn, $requestData)
{
    try {
        $solicitudId = $requestData['solicitud_id'] ?? null;
        $adminId = SessionManager::getCurrentUser()['id'];

        if (!$solicitudId) {
            sendResponse(false, null, 'ID de solicitud requerido', 400);
        }

        // Iniciar transacción
        $conn->beginTransaction();

        // Obtener solicitud con tipo de recurso
        $sqlSolicitud = "
            SELECT recurso_tipo
            FROM solicitudes
            WHERE id = :id
        ";

        $stmtSolicitud = $conn->prepare($sqlSolicitud);
        $stmtSolicitud->execute(['id' => $solicitudId]);
        $solicitud = $stmtSolicitud->fetch();

        if (!$solicitud) {
            $conn->rollBack();
            sendResponse(false, null, 'Solicitud no encontrada', 404);
        }

        // Obtener detalles
        $sqlDetalles = "
            SELECT 
                id,
                cantidad_aprobada,
                insumo_id,
                papeleria_id
            FROM solicitud_detalles
            WHERE solicitud_id = :solicitud_id
        ";

        $stmtDetalles = $conn->prepare($sqlDetalles);
        $stmtDetalles->execute(['solicitud_id' => $solicitudId]);
        $detalles = $stmtDetalles->fetchAll();

        $movimientos = [];

        foreach ($detalles as $detalle) {
            $cantidadAprobada = $detalle['cantidad_aprobada'] ?? 0;

            if ($cantidadAprobada <= 0) continue;

            $esInsumo = $detalle['insumo_id'] !== null;
            $tabla = $esInsumo ? 'insumos' : 'papeleria';
            $itemId = $esInsumo ? $detalle['insumo_id'] : $detalle['papeleria_id'];

            // Obtener stock actual
            $sqlStock = "SELECT stock_actual FROM $tabla WHERE id = :id";
            $stmtStock = $conn->prepare($sqlStock);
            $stmtStock->execute(['id' => $itemId]);
            $item = $stmtStock->fetch();

            if (!$item) {
                $conn->rollBack();
                sendResponse(false, null, "Item no encontrado: $itemId en $tabla", 404);
            }

            $stockAnterior = $item['stock_actual'];
            $stockNuevo = $stockAnterior - $cantidadAprobada;

            // Actualizar stock
            $sqlUpdate = "
                UPDATE $tabla 
                SET stock_actual = :stock_nuevo,
                    updated_at = NOW()
                WHERE id = :id
            ";

            $stmtUpdate = $conn->prepare($sqlUpdate);
            $stmtUpdate->execute([
                'stock_nuevo' => $stockNuevo,
                'id' => $itemId
            ]);

            // Preparar datos del movimiento
            $movimiento = [
                'tipo_movimiento' => 'entrega',
                'cantidad' => -$cantidadAprobada,
                'stock_anterior' => $stockAnterior,
                'stock_nuevo' => $stockNuevo,
                'motivo' => 'Entrega por solicitud cerrada',
                'referencia_id' => $solicitudId,
                'admin_id' => $adminId,
                'fecha' => date('Y-m-d H:i:s')
            ];

            if ($esInsumo) {
                $movimiento['insumo_id'] = $itemId;
                $movimiento['papeleria_id'] = null;
            } else {
                $movimiento['papeleria_id'] = $itemId;
                $movimiento['insumo_id'] = null;
            }

            // Registrar movimiento
            $sqlMovimiento = "
                INSERT INTO inventario_movimientos (
                    insumo_id,
                    papeleria_id,
                    tipo_movimiento,
                    cantidad,
                    stock_anterior,
                    stock_nuevo,
                    motivo,
                    referencia_id,
                    admin_id,
                    fecha
                ) VALUES (
                    :insumo_id,
                    :papeleria_id,
                    :tipo_movimiento,
                    :cantidad,
                    :stock_anterior,
                    :stock_nuevo,
                    :motivo,
                    :referencia_id,
                    :admin_id,
                    :fecha
                )
            ";

            $stmtMovimiento = $conn->prepare($sqlMovimiento);
            $stmtMovimiento->execute($movimiento);

            $movimientos[] = [
                'tabla' => $tabla,
                'item_id' => $itemId,
                'stock_anterior' => $stockAnterior,
                'stock_nuevo' => $stockNuevo,
                'cantidad' => $cantidadAprobada
            ];
        }

        // Commit de la transacción
        $conn->commit();

        sendResponse(true, [
            'message' => 'Inventario descontado exitosamente',
            'movimientos' => $movimientos
        ]);
    } catch (Exception $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        logError('Error en handleDescontarInventario: ' . $e->getMessage());
        throw $e;
    }
}

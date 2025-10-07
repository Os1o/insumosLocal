<?php
/**
 * Endpoint de reportes
 * Maneja la generación de reportes mensuales y anuales
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
    
    // Verificar que sea admin o super_admin
    SessionManager::requireAuth();
    $currentUser = SessionManager::getCurrentUser();
    
    if ($currentUser['rol'] !== 'admin' && $currentUser['rol'] !== 'super_admin') {
        sendResponse(false, null, 'Solo administradores pueden generar reportes', 403);
    }
    
    switch($action) {
        case 'get-areas':
            handleGetAreas($conn);
            break;
            
        case 'generar-mensual':
            handleGenerarMensual($conn, $requestData);
            break;
            
        case 'generar-anual':
            handleGenerarAnual($conn, $requestData);
            break;
            
        default:
            sendResponse(false, null, 'Acción no válida', 400);
    }
    
} catch(Exception $e) {
    logError('Error en reportes.php: ' . $e->getMessage());
    sendResponse(false, null, 'Error del servidor: ' . $e->getMessage(), 500);
}

/**
 * Obtener áreas/departamentos disponibles
 */
function handleGetAreas($conn) {
    try {
        $sql = "
            SELECT DISTINCT departamento 
            FROM usuarios 
            WHERE departamento IS NOT NULL 
            AND activo = true
            ORDER BY departamento
        ";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $areas = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        sendResponse(true, $areas);
        
    } catch(Exception $e) {
        logError('Error en handleGetAreas: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Generar reporte mensual
 */
function handleGenerarMensual($conn, $requestData) {
    try {
        $mes = $requestData['mes'] ?? null;
        $ano = $requestData['ano'] ?? null;
        $area = $requestData['area'] ?? null;
        $recursoTipo = $requestData['recurso_tipo'] ?? null;
        
        if (!$mes || !$ano) {
            sendResponse(false, null, 'Mes y año requeridos', 400);
        }
        
        // Obtener datos del período actual
        $datosActual = obtenerSolicitudesMensual($conn, $mes, $ano, $area, $recursoTipo);
        
        // Obtener datos del período anterior para comparación
        $mesAnterior = $mes - 1;
        $anoAnterior = $ano;
        
        if ($mesAnterior == 0) {
            $mesAnterior = 12;
            $anoAnterior = $ano - 1;
        }
        
        $datosAnterior = obtenerSolicitudesMensual($conn, $mesAnterior, $anoAnterior, $area, $recursoTipo);
        
        sendResponse(true, [
            'actual' => $datosActual,
            'anterior' => $datosAnterior
        ]);
        
    } catch(Exception $e) {
        logError('Error en handleGenerarMensual: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Generar reporte anual
 */
function handleGenerarAnual($conn, $requestData) {
    try {
        $ano = $requestData['ano'] ?? null;
        $area = $requestData['area'] ?? null;
        $recursoTipo = $requestData['recurso_tipo'] ?? null;
        
        if (!$ano) {
            sendResponse(false, null, 'Año requerido', 400);
        }
        
        // Obtener datos del año actual
        $datosActual = obtenerSolicitudesAnual($conn, $ano, $area, $recursoTipo);
        
        // Obtener datos del año anterior para comparación
        $datosAnterior = obtenerSolicitudesAnual($conn, $ano - 1, $area, $recursoTipo);
        
        sendResponse(true, [
            'actual' => $datosActual,
            'anterior' => $datosAnterior
        ]);
        
    } catch(Exception $e) {
        logError('Error en handleGenerarAnual: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Obtener solicitudes de un mes específico
 */
function obtenerSolicitudesMensual($conn, $mes, $ano, $area = null, $recursoTipo = null) {
    try {
        // Construir fechas del período
        $primerDia = new DateTime("$ano-$mes-01");
        $ultimoDia = clone $primerDia;
        $ultimoDia->modify('last day of this month')->setTime(23, 59, 59);
        
        $fechaInicio = $primerDia->format('Y-m-d H:i:s');
        $fechaFin = $ultimoDia->format('Y-m-d H:i:s');
        
        // Construir query base
        $sql = "
            SELECT 
                s.id,
                s.tipo,
                s.estado,
                s.fecha_solicitud,
                s.token_usado,
                s.recurso_tipo,
                s.token_tipo_usado,
                u.departamento as usuario_departamento
            FROM solicitudes s
            INNER JOIN usuarios u ON s.usuario_id = u.id
            WHERE s.fecha_solicitud >= :fecha_inicio
            AND s.fecha_solicitud <= :fecha_fin
        ";
        
        $params = [
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin
        ];
        
        // Filtro por área
        if ($area) {
            $sql .= " AND u.departamento = :area";
            $params['area'] = $area;
        }
        
        // Filtro por tipo de recurso
        if ($recursoTipo) {
            $sql .= " AND s.recurso_tipo = :recurso_tipo";
            $params['recurso_tipo'] = $recursoTipo;
        }
        
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $solicitudes = $stmt->fetchAll();
        
        // Procesar estadísticas
        return procesarEstadisticas($conn, $solicitudes);
        
    } catch(Exception $e) {
        logError('Error en obtenerSolicitudesMensual: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Obtener solicitudes de un año completo
 */
function obtenerSolicitudesAnual($conn, $ano, $area = null, $recursoTipo = null) {
    try {
        $fechaInicio = "$ano-01-01 00:00:00";
        $fechaFin = "$ano-12-31 23:59:59";
        
        $sql = "
            SELECT 
                s.id,
                s.tipo,
                s.estado,
                s.fecha_solicitud,
                s.token_usado,
                s.recurso_tipo,
                s.token_tipo_usado,
                u.departamento as usuario_departamento
            FROM solicitudes s
            INNER JOIN usuarios u ON s.usuario_id = u.id
            WHERE s.fecha_solicitud >= :fecha_inicio
            AND s.fecha_solicitud <= :fecha_fin
        ";
        
        $params = [
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin
        ];
        
        if ($area) {
            $sql .= " AND u.departamento = :area";
            $params['area'] = $area;
        }
        
        if ($recursoTipo) {
            $sql .= " AND s.recurso_tipo = :recurso_tipo";
            $params['recurso_tipo'] = $recursoTipo;
        }
        
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $solicitudes = $stmt->fetchAll();
        
        return procesarEstadisticas($conn, $solicitudes);
        
    } catch(Exception $e) {
        logError('Error en obtenerSolicitudesAnual: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Procesar estadísticas de solicitudes
 */
function procesarEstadisticas($conn, $solicitudes) {
    $estadisticas = [
        'total' => count($solicitudes),
        'porArea' => [],
        'porTipo' => ['ordinaria' => 0, 'extraordinaria' => 0, 'juntas' => 0],
        'porEstado' => ['pendiente' => 0, 'en_revision' => 0, 'cerrado' => 0, 'cancelado' => 0],
        'porRecurso' => ['insumo' => 0, 'papeleria' => 0],
        'porTipoToken' => ['ordinario' => 0, 'extraordinario' => 0, 'juntas' => 0],
        'insumosSolicitados' => [],
        'papeleriaSolicitada' => [],
        'recursosSolicitados' => [],
        'tokenUsados' => 0,
        'tokensPorTipo' => [
            'insumo_ordinario' => 0,
            'papeleria_ordinario' => 0,
            'papeleria_extraordinario' => 0
        ]
    ];
    
    $solicitudIds = [];
    
    foreach ($solicitudes as $solicitud) {
        $solicitudIds[] = $solicitud['id'];
        
        // Contar por área
        $area = $solicitud['usuario_departamento'] ?? 'Sin área';
        if (!isset($estadisticas['porArea'][$area])) {
            $estadisticas['porArea'][$area] = 0;
        }
        $estadisticas['porArea'][$area]++;
        
        // Contar por tipo
        $tipo = $solicitud['tipo'] ?? 'ordinaria';
        if (isset($estadisticas['porTipo'][$tipo])) {
            $estadisticas['porTipo'][$tipo]++;
        }
        
        // Contar por estado
        $estado = $solicitud['estado'] ?? 'pendiente';
        if (isset($estadisticas['porEstado'][$estado])) {
            $estadisticas['porEstado'][$estado]++;
        }
        
        // Contar por recurso
        $recursoTipo = $solicitud['recurso_tipo'] ?? 'insumo';
        if (isset($estadisticas['porRecurso'][$recursoTipo])) {
            $estadisticas['porRecurso'][$recursoTipo]++;
        }
        
        // Contar tokens
        if ($solicitud['token_usado']) {
            $estadisticas['tokenUsados']++;
            
            $tokenTipo = $solicitud['token_tipo_usado'] ?? 'ordinario';
            
            if ($tipo === 'juntas') {
                $estadisticas['porTipoToken']['juntas']++;
            } else if ($recursoTipo === 'insumo') {
                $estadisticas['tokensPorTipo']['insumo_ordinario']++;
                $estadisticas['porTipoToken']['ordinario']++;
            } else if ($recursoTipo === 'papeleria') {
                if ($tokenTipo === 'extraordinario') {
                    $estadisticas['tokensPorTipo']['papeleria_extraordinario']++;
                    $estadisticas['porTipoToken']['extraordinario']++;
                } else {
                    $estadisticas['tokensPorTipo']['papeleria_ordinario']++;
                    $estadisticas['porTipoToken']['ordinario']++;
                }
            }
        }
    }
    
    // Obtener detalles de recursos si hay solicitudes
    if (!empty($solicitudIds)) {
        $placeholders = implode(',', array_fill(0, count($solicitudIds), '?'));
        
        // Obtener insumos
        $sqlInsumos = "
            SELECT i.nombre, SUM(sd.cantidad_solicitada) as total
            FROM solicitud_detalles sd
            INNER JOIN insumos i ON sd.insumo_id = i.id
            WHERE sd.solicitud_id IN ($placeholders)
            AND sd.insumo_id IS NOT NULL
            GROUP BY i.nombre
            ORDER BY total DESC
        ";
        
        $stmtInsumos = $conn->prepare($sqlInsumos);
        $stmtInsumos->execute($solicitudIds);
        $insumos = $stmtInsumos->fetchAll();
        
        foreach ($insumos as $insumo) {
            $nombre = $insumo['nombre'];
            $total = (int)$insumo['total'];
            $estadisticas['insumosSolicitados'][$nombre] = $total;
            $estadisticas['recursosSolicitados']["📦 $nombre"] = $total;
        }
        
        // Obtener papelería
        $sqlPapeleria = "
            SELECT p.nombre, SUM(sd.cantidad_solicitada) as total
            FROM solicitud_detalles sd
            INNER JOIN papeleria p ON sd.papeleria_id = p.id
            WHERE sd.solicitud_id IN ($placeholders)
            AND sd.papeleria_id IS NOT NULL
            GROUP BY p.nombre
            ORDER BY total DESC
        ";
        
        $stmtPapeleria = $conn->prepare($sqlPapeleria);
        $stmtPapeleria->execute($solicitudIds);
        $papeleria = $stmtPapeleria->fetchAll();
        
        foreach ($papeleria as $item) {
            $nombre = $item['nombre'];
            $total = (int)$item['total'];
            $estadisticas['papeleriaSolicitada'][$nombre] = $total;
            $estadisticas['recursosSolicitados']["📝 $nombre"] = $total;
        }
    }
    
    return $estadisticas;
}
?>
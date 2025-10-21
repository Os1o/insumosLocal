<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../utils/helpers.php';

setupCORS();

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    SessionManager::requireAuth();
    $currentUser = SessionManager::getCurrentUser();
    
    if ($currentUser['rol'] !== 'super_admin') {
        sendResponse(false, null, 'Solo super admin', 403);
    }
    
    $usuarioId = $_GET['usuario_id'] ?? null;
    
    if (!$usuarioId) {
        sendResponse(false, null, 'Falta usuario_id', 400);
    }
    
    // 1. Obtener solicitudes del usuario
    $stmt = $conn->prepare("
        SELECT 
            s.id, 
            s.tipo, 
            s.recurso_tipo, 
            s.token_tipo_usado, 
            s.fecha_solicitud, 
            s.estado,
            s.token_usado
        FROM solicitudes s
        WHERE s.usuario_id = :usuario_id
        AND s.estado = 'cerrado'
        ORDER BY s.fecha_solicitud DESC
        LIMIT 20
    ");
    $stmt->execute(['usuario_id' => $usuarioId]);
    $solicitudes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $resultado = [];
    
    foreach ($solicitudes as $sol) {
        // Verificar si está en solicitudes_recibidos
        $stmtRecibido = $conn->prepare("
            SELECT id, fecha_marcado_recibido, comentarios
            FROM solicitudes_recibidos
            WHERE solicitud_id = :solicitud_id
            AND usuario_id = :usuario_id
        ");
        $stmtRecibido->execute([
            'solicitud_id' => $sol['id'],
            'usuario_id' => $usuarioId
        ]);
        $recibido = $stmtRecibido->fetch(PDO::FETCH_ASSOC);
        
        $resultado[] = [
            'solicitud_id' => $sol['id'],
            'tipo' => $sol['tipo'],
            'recurso_tipo' => $sol['recurso_tipo'],
            'token_tipo_usado' => $sol['token_tipo_usado'],
            'token_usado' => $sol['token_usado'],
            'fecha_solicitud' => $sol['fecha_solicitud'],
            'estado' => $sol['estado'],
            'marcado_recibido' => $recibido ? '✅ SÍ' : '❌ NO',
            'fecha_marcado' => $recibido ? $recibido['fecha_marcado_recibido'] : null,
            'comentarios' => $recibido ? $recibido['comentarios'] : null
        ];
    }
    
    // Resumen
    $totalSolicitudes = count($resultado);
    $marcadas = count(array_filter($resultado, fn($r) => $r['marcado_recibido'] === '✅ SÍ'));
    $noMarcadas = $totalSolicitudes - $marcadas;
    
    // Filtrar solo las que usaron token
    $conToken = array_filter($resultado, fn($r) => $r['token_usado'] === true);
    $conTokenMarcadas = count(array_filter($conToken, fn($r) => $r['marcado_recibido'] === '✅ SÍ'));
    $conTokenNoMarcadas = count($conToken) - $conTokenMarcadas;
    
    sendResponse(true, [
        'usuario_id' => $usuarioId,
        'resumen_general' => [
            'total_solicitudes_cerradas' => $totalSolicitudes,
            'marcadas_recibido' => $marcadas,
            'NO_marcadas_recibido' => $noMarcadas
        ],
        'resumen_con_token' => [
            'total_solicitudes_con_token' => count($conToken),
            'marcadas_recibido' => $conTokenMarcadas,
            'NO_marcadas_recibido' => $conTokenNoMarcadas,
            'debe_renovar' => $conTokenNoMarcadas === 0 ? '✅ SÍ (todas marcadas)' : '❌ NO (faltan marcar)'
        ],
        'solicitudes' => $resultado
    ]);
    
} catch (Exception $e) {
    logError('Error: ' . $e->getMessage());
    sendResponse(false, null, $e->getMessage(), 500);
}
?>
```

---

## ✅ Prueba Ahora

1. **Guarda los cambios** en `renovacion-mensual.php`

2. **Prueba el endpoint de test** con un usuario real:
```
http://11.254.27.18/insumos/api/endpoints/test-recibidos.php?usuario_id=USUARIO_REAL_UUID
<?php

/**
 * Endpoint para el proceso de renovación mensual de tokens
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

    // Verificar que sea super_admin
    SessionManager::requireAuth();
    $currentUser = SessionManager::getCurrentUser();

    if ($currentUser['rol'] !== 'super_admin') {
        sendResponse(false, null, 'Solo super administradores pueden ejecutar este proceso', 403);
    }

    switch ($action) {
        case 'ejecutar-proceso':
            handleEjecutarProceso($conn);
            break;

        default:
            sendResponse(false, null, 'Acción no válida', 400);
    }
} catch (Exception $e) {
    logError('Error en renovacion-mensual.php: ' . $e->getMessage());
    sendResponse(false, null, 'Error del servidor: ' . $e->getMessage(), 500);
}

/**
 * Ejecutar el proceso completo de renovación mensual
 */
/**
 * Ejecutar el proceso completo de renovación mensual
 */
function handleEjecutarProceso($conn)
{
    try {
        $conn->beginTransaction();

        $fechaActual = new DateTime();
        $mesAnterior = new DateTime();
        $mesAnterior->modify('first day of last month');

        $finMesAnterior = new DateTime();
        $finMesAnterior->modify('last day of last month');
        $finMesAnterior->setTime(23, 59, 59);

        $inicioMes = $mesAnterior->format('Y-m-d H:i:s');
        $finMes = $finMesAnterior->format('Y-m-d H:i:s');
        $mesAno = $fechaActual->format('Y-m');

        logError("Proceso mensual - Rango: $inicioMes a $finMes");

        $stmt = $conn->prepare("
            SELECT id, username, nombre, token_disponible, 
                   token_papeleria_ordinario, token_papeleria_extraordinario
            FROM usuarios
            WHERE activo = true
        ");
        $stmt->execute();
        $usuarios = $stmt->fetchAll();

        $resultados = [];
        $estadisticas = [
            'total_usuarios' => count($usuarios),
            'insumos_renovados' => 0,
            'insumos_no_renovados' => 0,
            'papeleria_ord_renovados' => 0,
            'papeleria_ord_no_renovados' => 0,
            'papeleria_ext_renovados' => 0,
            'papeleria_ext_no_renovados' => 0
        ];

        foreach ($usuarios as $usuario) {
            $resultado = procesarTokenUsuario(
                $conn,
                $usuario['id'],
                $inicioMes,
                $finMes,
                $mesAno
            );
            
            $resultado['username'] = $usuario['username'];
            $resultado['nombre'] = $usuario['nombre'];
            
            // Actualizar estadísticas
            if ($resultado['renovaciones']['insumo']) {
                $estadisticas['insumos_renovados']++;
            } else {
                $estadisticas['insumos_no_renovados']++;
            }
            
            if ($resultado['renovaciones']['papeleria_ordinario']) {
                $estadisticas['papeleria_ord_renovados']++;
            } else {
                $estadisticas['papeleria_ord_no_renovados']++;
            }
            
            if ($resultado['renovaciones']['papeleria_extraordinario']) {
                $estadisticas['papeleria_ext_renovados']++;
            } else {
                $estadisticas['papeleria_ext_no_renovados']++;
            }
            
            $resultados[] = $resultado;
        }

        $conn->commit();

        // Generar advertencias
        $advertencias = [];
        if ($estadisticas['insumos_no_renovados'] > 0) {
            $advertencias[] = "{$estadisticas['insumos_no_renovados']} usuarios NO recuperaron token de INSUMOS (no marcaron recibido)";
        }
        if ($estadisticas['papeleria_ord_no_renovados'] > 0) {
            $advertencias[] = "{$estadisticas['papeleria_ord_no_renovados']} usuarios NO recuperaron token de PAPELERÍA ORDINARIA (no marcaron recibido)";
        }
        if ($estadisticas['papeleria_ext_no_renovados'] > 0) {
            $advertencias[] = "{$estadisticas['papeleria_ext_no_renovados']} usuarios NO recuperaron token de PAPELERÍA EXTRAORDINARIA (no marcaron recibido)";
        }

        sendResponse(true, [
            'message' => 'Proceso de renovación mensual completado',
            'estadisticas' => $estadisticas,
            'resultados' => $resultados,
            'advertencias' => $advertencias
        ]);
    } catch (Exception $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        logError('Error en handleEjecutarProceso: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Procesar tokens de un usuario específico
 */

/**
 * Procesar tokens de un usuario específico
 * TODOS LOS TOKENS se renuevan SOLO si marcó recibido (o no usó el token)
 */
function procesarTokenUsuario($conn, $usuarioId, $inicioMes, $finMes, $mesAno)
{
    try {
        logError("\n═══ PROCESANDO USUARIO: $usuarioId ═══");
        
        // Buscar solicitudes del mes anterior que usaron token
        $stmt = $conn->prepare("
            SELECT id, fecha_solicitud, token_usado, recurso_tipo, token_tipo_usado, estado
            FROM solicitudes
            WHERE usuario_id = :usuario_id
            AND token_usado = true
            AND fecha_solicitud >= :inicio
            AND fecha_solicitud <= :fin
            AND estado = 'cerrado'
        ");

        $stmt->execute([
            'usuario_id' => $usuarioId,
            'inicio' => $inicioMes,
            'fin' => $finMes
        ]);

        $solicitudesToken = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        logError("Total solicitudes con token: " . count($solicitudesToken));

        // Separar por tipo
        $solicitudesInsumo = array_filter($solicitudesToken, function ($s) {
            return ($s['recurso_tipo'] === 'insumo' || !$s['recurso_tipo'])
                && $s['token_tipo_usado'] === 'ordinario';
        });

        $solicitudesPapeleriaOrd = array_filter($solicitudesToken, function ($s) {
            return $s['recurso_tipo'] === 'papeleria'
                && $s['token_tipo_usado'] === 'ordinario';
        });

        $solicitudesPapeleriaExt = array_filter($solicitudesToken, function ($s) {
            return $s['recurso_tipo'] === 'papeleria'
                && $s['token_tipo_usado'] === 'extraordinario';
        });

        logError("- Insumos ordinario: " . count($solicitudesInsumo) . " solicitudes");
        logError("- Papelería ordinario: " . count($solicitudesPapeleriaOrd) . " solicitudes");
        logError("- Papelería extraordinario: " . count($solicitudesPapeleriaExt) . " solicitudes");

        // Verificar renovación para cada tipo
        $renovaciones = [];

        logError("\n--- Verificando INSUMOS ---");
        $renovaciones['insumo'] = verificarRenovacionToken(
            $conn,
            $usuarioId,
            $solicitudesInsumo,
            'insumo',
            'ordinario',
            $mesAno
        );

        logError("\n--- Verificando PAPELERÍA ORDINARIA ---");
        $renovaciones['papeleria_ordinario'] = verificarRenovacionToken(
            $conn,
            $usuarioId,
            $solicitudesPapeleriaOrd,
            'papeleria',
            'ordinario',
            $mesAno
        );

        logError("\n--- Verificando PAPELERÍA EXTRAORDINARIA ---");
        $renovaciones['papeleria_extraordinario'] = verificarRenovacionToken(
            $conn,
            $usuarioId,
            $solicitudesPapeleriaExt,
            'papeleria',
            'extraordinario',
            $mesAno
        );

        // Actualizar tokens SOLO si la verificación fue exitosa
        $setClauses = [];

        if ($renovaciones['insumo']) {
            $setClauses[] = "token_disponible = 1";
        }
        if ($renovaciones['papeleria_ordinario']) {
            $setClauses[] = "token_papeleria_ordinario = 1";
        }
        if ($renovaciones['papeleria_extraordinario']) {
            $setClauses[] = "token_papeleria_extraordinario = 1";
        }

        // Solo actualizar si hay tokens para renovar
        if (!empty($setClauses)) {
            $sql = "UPDATE usuarios SET " . implode(', ', $setClauses) . " WHERE id = :id";
            $stmtUpdate = $conn->prepare($sql);
            $stmtUpdate->execute(['id' => $usuarioId]);
            
            logError("\n✅ Tokens actualizados en BD: " . implode(', ', $setClauses));
        } else {
            logError("\n⚠️ No se actualizaron tokens (ninguno cumplió requisitos)");
        }
        
        logError("═══ FIN PROCESAMIENTO USUARIO ═══\n");

        return [
            'usuario_id' => $usuarioId,
            'renovaciones' => $renovaciones,
            'tokens_renovados' => count(array_filter($renovaciones)),
            'detalle' => [
                'insumo' => [
                    'renovado' => $renovaciones['insumo'],
                    'razon' => $renovaciones['insumo'] 
                        ? (count($solicitudesInsumo) > 0 ? 'Marcó recibido' : 'No usó token')
                        : 'NO marcó recibido'
                ],
                'papeleria_ordinario' => [
                    'renovado' => $renovaciones['papeleria_ordinario'],
                    'razon' => $renovaciones['papeleria_ordinario'] 
                        ? (count($solicitudesPapeleriaOrd) > 0 ? 'Marcó recibido' : 'No usó token')
                        : 'NO marcó recibido'
                ],
                'papeleria_extraordinario' => [
                    'renovado' => $renovaciones['papeleria_extraordinario'],
                    'razon' => $renovaciones['papeleria_extraordinario'] 
                        ? (count($solicitudesPapeleriaExt) > 0 ? 'Marcó recibido' : 'No usó token')
                        : 'NO marcó recibido'
                ]
            ]
        ];
    } catch (Exception $e) {
        logError("Error procesando usuario $usuarioId: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Verificar si se debe renovar un token específico
 * REGLA: Solo renueva si NO hay solicitudes pendientes O si todas están marcadas como recibidas
 */
/**
 * Verificar si se debe renovar un token específico
 * CORREGIDO: Maneja correctamente la tabla solicitudes_recibidos con ID integer
 */
/**
 * Verificar si se debe renovar un token específico
 * LÓGICA CORREGIDA:
 * - Si NO usó el token → Renovar automáticamente
 * - Si SÍ usó el token Y marcó recibido → Renovar
 * - Si SÍ usó el token pero NO marcó recibido → NO renovar
 */
function verificarRenovacionToken($conn, $usuarioId, $solicitudes, $recursoTipo, $tokenTipo, $mesAno)
{
    try {
        $teniaSolicitud = count($solicitudes) > 0;
        $marcoRecibido = false;
        $tokenRenovado = true;
        
        if ($teniaSolicitud) {
            $todasMarcadas = true;
            
            foreach ($solicitudes as $solicitud) {
                $stmt = $conn->prepare("
                    SELECT id, fecha_marcado_recibido
                    FROM solicitudes_recibidos
                    WHERE solicitud_id = :solicitud_id
                    AND usuario_id = :usuario_id
                ");

                $stmt->execute([
                    'solicitud_id' => $solicitud['id'],
                    'usuario_id' => $usuarioId
                ]);

                $recibido = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$recibido || $recibido['fecha_marcado_recibido'] === null) {
                    $todasMarcadas = false;
                    logError("❌ Usuario $usuarioId - Solicitud {$solicitud['id']} ($recursoTipo - $tokenTipo) NO marcada");
                    break;
                } else {
                    logError("✅ Usuario $usuarioId - Solicitud {$solicitud['id']} ($recursoTipo - $tokenTipo) SÍ marcada");
                }
            }
            
            if ($todasMarcadas) {
                $tokenRenovado = true;
                $marcoRecibido = true;
            } else {
                $tokenRenovado = false;
                $marcoRecibido = false;
            }
            
        } else {
            logError("✅ Usuario $usuarioId - NO usó token de $recursoTipo - $tokenTipo → Renovar");
            $tokenRenovado = true;
            $marcoRecibido = false;
        }

        // Registrar en tokens_renovacion con tipos correctos
        $stmtToken = $conn->prepare("
            INSERT INTO tokens_renovacion (
                usuario_id,
                mes_ano,
                recurso_tipo,
                token_tipo,
                tenia_solicitud,
                marco_recibido,
                token_renovado,
                fecha_verificacion
            ) VALUES (
                :usuario_id,
                :mes_ano,
                :recurso_tipo,
                :token_tipo,
                :tenia_solicitud,
                :marco_recibido,
                :token_renovado,
                NOW()
            )
            ON CONFLICT (usuario_id, mes_ano, recurso_tipo, token_tipo) 
            DO UPDATE SET
                tenia_solicitud = EXCLUDED.tenia_solicitud,
                marco_recibido = EXCLUDED.marco_recibido,
                token_renovado = EXCLUDED.token_renovado,
                fecha_verificacion = EXCLUDED.fecha_verificacion
        ");

        // Convertir a enteros para PostgreSQL (más compatible)
        $stmtToken->execute([
            'usuario_id' => $usuarioId,
            'mes_ano' => $mesAno,
            'recurso_tipo' => $recursoTipo,
            'token_tipo' => $tokenTipo,
            'tenia_solicitud' => $teniaSolicitud ? 1 : 0,
            'marco_recibido' => $marcoRecibido ? 1 : 0,
            'token_renovado' => $tokenRenovado ? 1 : 0
        ]);

        $status = $tokenRenovado ? '✅ RENOVADO' : '❌ NO RENOVADO';
        logError("RESULTADO: $recursoTipo $tokenTipo: $status");

        return $tokenRenovado;
        
    } catch (Exception $e) {
        logError("Error en verificarRenovacionToken: " . $e->getMessage());
        throw $e;
    }
}


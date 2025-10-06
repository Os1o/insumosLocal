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
function handleEjecutarProceso($conn)
{
    try {
        // Iniciar transacción
        $conn->beginTransaction();

        // Calcular fechas del mes anterior
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

        // Obtener todos los usuarios activos
        $stmt = $conn->prepare("
            SELECT id, username, token_disponible, token_papeleria_ordinario, token_papeleria_extraordinario
            FROM usuarios
            WHERE activo = true
        ");
        $stmt->execute();
        $usuarios = $stmt->fetchAll();

        $resultados = [];

        foreach ($usuarios as $usuario) {
            $resultado = procesarTokenUsuario(
                $conn,
                $usuario['id'],
                $inicioMes,
                $finMes,
                $mesAno
            );
            $resultados[] = $resultado;
        }

        // Commit
        $conn->commit();

        sendResponse(true, [
            'message' => 'Proceso de renovación mensual completado',
            'usuarios_procesados' => count($usuarios),
            'resultados' => $resultados
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
function procesarTokenUsuario($conn, $usuarioId, $inicioMes, $finMes, $mesAno)
{
    try {
        // Buscar solicitudes del mes anterior que usaron token
        $stmt = $conn->prepare("
            SELECT id, fecha_solicitud, token_usado, recurso_tipo, token_tipo_usado
            FROM solicitudes
            WHERE usuario_id = :usuario_id
            AND token_usado = true
            AND fecha_solicitud >= :inicio
            AND fecha_solicitud <= :fin
        ");

        $stmt->execute([
            'usuario_id' => $usuarioId,
            'inicio' => $inicioMes,
            'fin' => $finMes
        ]);

        $solicitudesToken = $stmt->fetchAll();

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

        // Verificar renovación para cada tipo
        $renovaciones = [];

        $renovaciones['insumo'] = verificarRenovacionToken(
            $conn,
            $usuarioId,
            $solicitudesInsumo,
            'insumo',
            'ordinario',
            $mesAno
        );

        $renovaciones['papeleria_ordinario'] = verificarRenovacionToken(
            $conn,
            $usuarioId,
            $solicitudesPapeleriaOrd,
            'papeleria',
            'ordinario',
            $mesAno
        );

        $renovaciones['papeleria_extraordinario'] = verificarRenovacionToken(
            $conn,
            $usuarioId,
            $solicitudesPapeleriaExt,
            'papeleria',
            'extraordinario',
            $mesAno
        );

        // Actualizar tokens del usuario
        $updateData = [];
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

        if (!empty($setClauses)) {
            $sql = "UPDATE usuarios SET " . implode(', ', $setClauses) . " WHERE id = :id";
            $stmtUpdate = $conn->prepare($sql);
            $stmtUpdate->execute(['id' => $usuarioId]);
        }

        return [
            'usuario_id' => $usuarioId,
            'renovaciones' => $renovaciones,
            'tokens_renovados' => count(array_filter($renovaciones))
        ];
    } catch (Exception $e) {
        logError("Error procesando usuario $usuarioId: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Verificar si se debe renovar un token específico
 */
function verificarRenovacionToken($conn, $usuarioId, $solicitudes, $recursoTipo, $tokenTipo, $mesAno)
{
    try {
        $tokenRenovado = true;
        $teniaSolicitud = count($solicitudes) > 0;

        if ($teniaSolicitud) {
            foreach ($solicitudes as $solicitud) {
                // Verificar si marcó como recibido
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

                $recibido = $stmt->fetch();

                if (!$recibido) {
                    // No marcó como recibido - NO renovar
                    $tokenRenovado = false;
                    break;
                }
            }
        }

        // Registrar en tokens_renovacion
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

        $stmtToken->execute([
            'usuario_id' => $usuarioId,
            'mes_ano' => $mesAno,
            'recurso_tipo' => $recursoTipo,
            'token_tipo' => $tokenTipo,
            'tenia_solicitud' => (int)$teniaSolicitud,
            'marco_recibido' => (int)$tokenRenovado,
            'token_renovado' => (int)$tokenRenovado
        ]);

        return $tokenRenovado;
    } catch (Exception $e) {
        logError("Error en verificarRenovacionToken: " . $e->getMessage());
        throw $e;
    }
}

<?php
/**
 * Endpoint de recursos (categorías, insumos, papelería)
 * Reemplaza consultas a tablas de recursos de Supabase
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
        
        case 'get-categorias-insumos':
            handleGetCategoriasInsumos($conn);
            break;
            
        case 'get-insumos':
            handleGetInsumos($conn, $requestData);
            break;
            
        case 'get-categorias-papeleria':
            handleGetCategoriasPapeleria($conn);
            break;
            
        case 'get-papeleria':
            handleGetPapeleria($conn, $requestData);
            break;
            
        default:
            sendResponse(false, null, 'Acción no válida', 400);
    }
    
} catch(Exception $e) {
    logError('Error en recursos.php: ' . $e->getMessage());
    sendResponse(false, null, 'Error del servidor: ' . $e->getMessage(), 500);
}

/**
 * Obtener categorías de insumos
 */
function handleGetCategoriasInsumos($conn) {
    $stmt = $conn->prepare("
        SELECT id, nombre, descripcion, orden, color, icono, activo, created_at, updated_at
        FROM categorias_insumos
        WHERE activo = true
        ORDER BY orden, nombre
    ");
    
    $stmt->execute();
    $categorias = $stmt->fetchAll();
    
    sendResponse(true, $categorias);
}

/**
 * Obtener insumos (con filtros de acceso)
 */
function handleGetInsumos($conn, $data) {
    SessionManager::requireAuth();
    
    $user = SessionManager::getCurrentUser();
    $departamento = $user['departamento'] ?? '';
    
    // Departamentos con acceso completo
    $departamentosPrivilegiados = [
        'Dirección Jurídica',
        'Coordinación Administrativa'
    ];
    
    $tieneAccesoCompleto = in_array($departamento, $departamentosPrivilegiados);
    
    // Query base
    $sql = "
        SELECT id, nombre, descripcion, categoria_id, stock_actual, 
               cantidad_warning, unidad_medida, precio_unitario, 
               activo, acceso_tipo, created_at, updated_at
        FROM insumos
        WHERE activo = true
    ";
    
    // Aplicar filtros de acceso
    if (!$tieneAccesoCompleto) {
        $sql .= " AND acceso_tipo = 'todos'";
    } else {
        $sql .= " AND acceso_tipo != 'ninguno'";
    }
    
    $sql .= " ORDER BY nombre";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $insumos = $stmt->fetchAll();
    
    sendResponse(true, $insumos);
}

/**
 * Obtener categorías de papelería
 */
function handleGetCategoriasPapeleria($conn) {
    $stmt = $conn->prepare("
        SELECT id, nombre, descripcion, orden, color, icono, activo, created_at, updated_at
        FROM categorias_papeleria
        WHERE activo = true
        ORDER BY orden, nombre
    ");
    
    $stmt->execute();
    $categorias = $stmt->fetchAll();
    
    sendResponse(true, $categorias);
}

/**
 * Obtener papelería (con filtros de acceso)
 */
function handleGetPapeleria($conn, $data) {
    SessionManager::requireAuth();
    
    $user = SessionManager::getCurrentUser();
    $departamento = $user['departamento'] ?? '';
    
    // Departamentos con acceso completo
    $departamentosPrivilegiados = [
        'Dirección Jurídica',
        'Coordinación Administrativa'
    ];
    
    $tieneAccesoCompleto = in_array($departamento, $departamentosPrivilegiados);
    
    // Query base
    $sql = "
        SELECT id, nombre, descripcion, categoria_id, stock_actual, 
               cantidad_warning, unidad_medida, precio_unitario, 
               activo, acceso_tipo, created_at, updated_at
        FROM papeleria
        WHERE activo = true
    ";
    
    // Aplicar filtros de acceso
    if (!$tieneAccesoCompleto) {
        $sql .= " AND acceso_tipo = 'todos'";
    }
    
    $sql .= " ORDER BY nombre";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $papeleria = $stmt->fetchAll();
    
    sendResponse(true, $papeleria);
}
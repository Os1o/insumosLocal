<?php
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
    sendResponse(false, null, 'Error del servidor', 500);
}

function handleGetCategoriasInsumos($conn) {
    SessionManager::requireAuth();
    
    $stmt = $conn->prepare("
        SELECT * FROM categorias_insumos 
        WHERE activo = true 
        ORDER BY orden, nombre
    ");
    $stmt->execute();
    $categorias = $stmt->fetchAll();
    
    sendResponse(true, $categorias);
}

function handleGetInsumos($conn, $requestData) {
    SessionManager::requireAuth();
    
    $filters = $requestData['filters'] ?? [];
    
    $sql = "SELECT * FROM insumos WHERE activo = true";
    $params = [];
    
    if (isset($filters['categoria_id'])) {
        $sql .= " AND categoria_id = :categoria_id";
        $params['categoria_id'] = $filters['categoria_id']['value'];
    }
    
    $sql .= " ORDER BY nombre";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $insumos = $stmt->fetchAll();
    
    sendResponse(true, $insumos);
}

function handleGetCategoriasPapeleria($conn) {
    SessionManager::requireAuth();
    
    $stmt = $conn->prepare("
        SELECT * FROM categorias_papeleria 
        WHERE activo = true 
        ORDER BY orden, nombre
    ");
    $stmt->execute();
    $categorias = $stmt->fetchAll();
    
    sendResponse(true, $categorias);
}

function handleGetPapeleria($conn, $requestData) {
    SessionManager::requireAuth();
    
    $filters = $requestData['filters'] ?? [];
    
    $sql = "SELECT * FROM papeleria WHERE activo = true";
    $params = [];
    
    if (isset($filters['categoria_id'])) {
        $sql .= " AND categoria_id = :categoria_id";
        $params['categoria_id'] = $filters['categoria_id']['value'];
    }
    
    $sql .= " ORDER BY nombre";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $papeleria = $stmt->fetchAll();
    
    sendResponse(true, $papeleria);
}
?>
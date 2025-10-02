<?php
/**
 * Sistema de gestión de sesiones
 */

// Iniciar sesión con configuración segura
if (session_status() === PHP_SESSION_NONE) {
    session_start([
        'cookie_lifetime' => 3600,
        'cookie_httponly' => true,
        'cookie_secure' => false, // Cambiar a true si usas HTTPS
        'use_strict_mode' => true
    ]);
}

class SessionManager {
    
    /**
     * Iniciar sesión de usuario
     */
    public static function login($userData) {
        $_SESSION['user_id'] = $userData['id'];
        $_SESSION['username'] = $userData['username'];
        $_SESSION['nombre'] = $userData['nombre'];
        $_SESSION['rol'] = $userData['rol'];
        $_SESSION['rol_id'] = $userData['rol_id'];
        $_SESSION['departamento'] = $userData['departamento'];
        $_SESSION['token_disponible'] = $userData['token_disponible'];
        $_SESSION['token_papeleria_ordinario'] = $userData['token_papeleria_ordinario'] ?? 1;
        $_SESSION['token_papeleria_extraordinario'] = $userData['token_papeleria_extraordinario'] ?? 1;
        $_SESSION['login_time'] = time();
        $_SESSION['last_activity'] = time();
        
        // Regenerar ID de sesión por seguridad
        session_regenerate_id(true);
        
        return true;
    }
    
    /**
     * Cerrar sesión
     */
    public static function logout() {
        $_SESSION = [];
        
        if (isset($_COOKIE[session_name()])) {
            setcookie(session_name(), '', time() - 3600, '/');
        }
        
        session_destroy();
        return true;
    }
    
    /**
     * Verificar si hay sesión activa
     */
    public static function isLoggedIn() {
        if (!isset($_SESSION['user_id']) || !isset($_SESSION['last_activity'])) {
            return false;
        }
        
        // Verificar timeout de sesión (1 hora)
        if (time() - $_SESSION['last_activity'] > 3600) {
            self::logout();
            return false;
        }
        
        // Actualizar última actividad
        $_SESSION['last_activity'] = time();
        
        return true;
    }
    
    /**
     * Obtener datos del usuario actual
     */
    public static function getCurrentUser() {
        if (!self::isLoggedIn()) {
            return null;
        }
        
        return [
            'id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'nombre' => $_SESSION['nombre'],
            'rol' => $_SESSION['rol'],
            'rol_id' => $_SESSION['rol_id'],
            'departamento' => $_SESSION['departamento'],
            'token_disponible' => $_SESSION['token_disponible'],
            'token_papeleria_ordinario' => $_SESSION['token_papeleria_ordinario'] ?? 1,
            'token_papeleria_extraordinario' => $_SESSION['token_papeleria_extraordinario'] ?? 1
        ];
    }
    
    /**
     * Requerir autenticación (redirige si no está logueado)
     */
    public static function requireAuth() {
        if (!self::isLoggedIn()) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'error' => 'No autorizado. Sesión expirada o inválida.'
            ]);
            exit;
        }
    }
    
    /**
     * Requerir rol específico
     */
    public static function requireRole($allowedRoles = []) {
        self::requireAuth();
        
        if (!in_array($_SESSION['rol'], $allowedRoles)) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => 'Acceso denegado. No tienes permisos suficientes.'
            ]);
            exit;
        }
    }
    
    /**
     * Actualizar tokens del usuario en sesión
     */
    public static function updateTokens($tokens) {
        if (isset($tokens['token_disponible'])) {
            $_SESSION['token_disponible'] = $tokens['token_disponible'];
        }
        if (isset($tokens['token_papeleria_ordinario'])) {
            $_SESSION['token_papeleria_ordinario'] = $tokens['token_papeleria_ordinario'];
        }
        if (isset($tokens['token_papeleria_extraordinario'])) {
            $_SESSION['token_papeleria_extraordinario'] = $tokens['token_papeleria_extraordinario'];
        }
    }
    
    /**
     * Verificar si el usuario es admin
     */
    public static function isAdmin() {
        return self::isLoggedIn() && 
               ($_SESSION['rol'] === 'admin' || $_SESSION['rol'] === 'super_admin');
    }
    
    /**
     * Verificar si el usuario es super admin
     */
    public static function isSuperAdmin() {
        return self::isLoggedIn() && $_SESSION['rol'] === 'super_admin';
    }
}
/**
 * API ADAPTER - Reemplazo de Supabase
 * Conecta el frontend con el backend PHP local
 */

const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost/insumos/api/endpoints'
    : 'http://11.254.27.18/insumos/api/endpoints';

/**
 * Función auxiliar para hacer fetch con manejo de errores
 */
async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
            method: options.method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            credentials: 'include', // Importante para sesiones PHP
            body: options.body ? JSON.stringify(options.body) : null
        });

        const data = await response.json();
        
        // Formato compatible con Supabase
        return {
            data: data.success ? data.data : null,
            error: data.success ? null : { message: data.error }
        };
        
    } catch (error) {
        console.error('Error en apiFetch:', error);
        return {
            data: null,
            error: { message: error.message }
        };
    }
}

/**
 * API Adapter - Objeto principal que reemplaza Supabase
 */
const API = {
    
    /**
     * Sistema de autenticación
     */
    auth: {
        /**
         * Login (reemplaza supabase.auth.signIn)
         */
        signIn: async ({ email, password }) => {
            return await apiFetch('auth.php', {
                body: {
                    action: 'login',
                    username: email, // En el sistema local usamos username
                    password: password
                }
            });
        },

        /**
         * Logout (reemplaza supabase.auth.signOut)
         */
        signOut: async () => {
            return await apiFetch('auth.php', {
                body: { action: 'logout' }
            });
        },

        /**
         * Verificar sesión activa
         */
        checkSession: async () => {
            return await apiFetch('auth.php', {
                body: { action: 'check-session' }
            });
        },

        /**
         * Obtener perfil del usuario
         */
        getProfile: async () => {
            return await apiFetch('auth.php', {
                body: { action: 'get-profile' }
            });
        }
    },

    /**
     * Operaciones de base de datos (placeholder)
     * Se implementarán según se vayan necesitando
     */
    from: (table) => {
        return {
            select: async (columns = '*') => {
                // Se implementará cuando creemos endpoints específicos
                console.warn(`API.from('${table}').select() aún no implementado`);
                return { data: null, error: { message: 'No implementado' } };
            },
            insert: async (data) => {
                console.warn(`API.from('${table}').insert() aún no implementado`);
                return { data: null, error: { message: 'No implementado' } };
            },
            update: async (data) => {
                console.warn(`API.from('${table}').update() aún no implementado`);
                return { data: null, error: { message: 'No implementado' } };
            },
            delete: async () => {
                console.warn(`API.from('${table}').delete() aún no implementado`);
                return { data: null, error: { message: 'No implementado' } };
            }
        };
    }
};

// Hacer disponible globalmente
window.API = API;

console.log('✅ API Adapter cargado y listo');
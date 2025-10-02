/**
 * API ADAPTER - Reemplazo de Supabase
 * Conecta el frontend con el backend PHP local
 */

const API_BASE_URL = 'http://11.254.27.18/insumos/api/endpoints';

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
        signIn: async ({ email, password }) => {
            return await apiFetch('auth.php', {
                body: {
                    action: 'login',
                    username: email,
                    password: password
                }
            });
        },

        signOut: async () => {
            return await apiFetch('auth.php', {
                body: { action: 'logout' }
            });
        },

        checkSession: async () => {
            return await apiFetch('auth.php', {
                body: { action: 'check-session' }
            });
        },

        getProfile: async () => {
            return await apiFetch('auth.php', {
                body: { action: 'get-profile' }
            });
        }
    },

    /**
     * Operaciones de base de datos
     */
    from: (table) => {
        return {
            select: (columns = '*') => {
                return new TableQuery(table, 'select', columns);
            },
            insert: (data) => {
                return new TableQuery(table, 'insert', data);
            },
            update: (data) => {
                return new TableQuery(table, 'update', data);
            },
            delete: () => {
                return new TableQuery(table, 'delete');
            }
        };
    }
};

/**
 * Clase para construir queries tipo Supabase
 */
class TableQuery {
    constructor(table, action, data = null) {
        this.table = table;
        this.action = action;
        this.data = data;
        this.filters = {};
        this.orderBy = null;
        this.limitValue = null;
        this.singleValue = false;
    }

    eq(field, value) {
        this.filters[field] = { op: 'eq', value };
        return this;
    }

    neq(field, value) {
        this.filters[field] = { op: 'neq', value };
        return this;
    }

    order(field, options = {}) {
        this.orderBy = {
            field,
            ascending: options.ascending !== false
        };
        return this;
    }

    limit(count) {
        this.limitValue = count;
        return this;
    }

    single() {
        this.singleValue = true;
        return this;
    }

    async then(resolve, reject) {
        try {
            const result = await this.execute();
            resolve(result);
        } catch (error) {
            reject(error);
        }
    }

    async execute() {
        // Determinar endpoint según la tabla
        let endpoint = '';
        let actionName = '';

        switch(this.table) {
            case 'categorias_insumos':
                endpoint = 'recursos.php';
                actionName = 'get-categorias-insumos';
                break;

            case 'insumos':
                endpoint = 'recursos.php';
                actionName = 'get-insumos';
                break;

            case 'categorias_papeleria':
                endpoint = 'recursos.php';
                actionName = 'get-categorias-papeleria';
                break;

            case 'papeleria':
                endpoint = 'recursos.php';
                actionName = 'get-papeleria';
                break;

            case 'usuarios':
                endpoint = 'usuarios.php';
                actionName = this.action === 'select' ? 'get' : this.action;
                break;

            case 'solicitudes':
                endpoint = 'solicitudes.php';
                actionName = this.action;
                break;

            case 'solicitud_detalles':
                endpoint = 'solicitudes.php';
                actionName = 'insert-detalles';
                break;

            case 'solicitudes_recibidos':
                endpoint = 'solicitudes.php';
                actionName = 'get-recibidos';
                break;

            case 'tokens_renovacion':
                endpoint = 'solicitudes.php';
                actionName = 'insert-token-renovacion';
                break;

            default:
                console.warn(`Tabla ${this.table} no tiene endpoint específico`);
                return { data: null, error: { message: 'Tabla no soportada' } };
        }

        // Preparar body de la petición
        const body = {
            action: actionName,
            filters: this.filters,
            order: this.orderBy,
            limit: this.limitValue,
            single: this.singleValue,
            data: this.data
        };

        return await apiFetch(endpoint, { body });
    }
}

// Hacer disponible globalmente
window.API = API;

console.log('✅ API Adapter cargado y listo');
/* ===================================
   GESTIÓN DE USUARIOS - SUPER ADMIN
   Sistema completo para administrar usuarios
   =================================== */

// Variables globales para usuarios
let todosLosUsuarios = [];
let usuarioEditando = null;

// Configuración Supabase (usar la misma conexión)
const supabaseUsuarios = window.supabase.createClient(
    'https://nxuvisaibpmdvraybzbm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54dXZpc2FpYnBtZHZyYXliemJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4OTMxNjQsImV4cCI6MjA3MTQ2OTE2NH0.OybYM_E3mWsZym7mEf-NiRtrG0svkylXx_q8Tivonfg'
);

// ===================================
// FUNCIÓN PRINCIPAL - ABRIR MODAL DE USUARIOS
// ===================================
async function abrirModalUsuarios() {
    console.log('👥 Abriendo gestión de usuarios...');
    
    try {
        // Verificar permisos
        const session = sessionStorage.getItem('currentUser');
        if (!session) {
            alert('Sesión expirada');
            return;
        }
        
        const user = JSON.parse(session);
        if (user.rol !== 'super_admin') {
            alert('❌ Solo Super Administradores pueden gestionar usuarios');
            return;
        }
        
        // Crear modal si no existe
        if (!document.getElementById('modalUsuarios')) {
            crearModalUsuarios();
        }
        
        // Cargar usuarios y mostrar modal
        await cargarTodosLosUsuarios();
        document.getElementById('modalUsuarios').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error abriendo modal usuarios:', error);
        alert('Error al abrir gestión de usuarios');
    }
}

// ===================================
// CREAR ESTRUCTURA DEL MODAL
// ===================================
function crearModalUsuarios() {
    const modalHTML = `
        <div class="modal-overlay" id="modalUsuarios" style="display: none;">
            <div class="modal-content modal-usuarios">
                
                <!-- Header del Modal -->
                <div class="modal-header">
                    <h2>👥 Gestión de Usuarios</h2>
                    <button class="modal-close" onclick="cerrarModalUsuarios()">×</button>
                </div>
                
                <!-- Controles superiores -->
                <div class="usuarios-controles">
                    <div class="usuarios-stats">
                        <span class="stat-item">
                            <strong id="totalUsuarios">0</strong> Total
                        </span>
                        <span class="stat-item">
                            <strong id="usuariosActivos">0</strong> Activos
                        </span>
                        <span class="stat-item">
                            <strong id="usuariosAdmins">0</strong> Admins
                        </span>
                    </div>
                    
                    <div class="usuarios-acciones">
                        <button class="btn-usuarios-primary" onclick="abrirCrearUsuario()">
                            ➕ Nuevo Usuario
                        </button>
                        <button class="btn-usuarios-secondary" onclick="recargarUsuarios()">
                            🔄 Actualizar
                        </button>
                    </div>
                </div>
                
                <!-- Loading -->
                <div class="usuarios-loading" id="usuariosLoading" style="display: none;">
                    <div class="loading-spinner"></div>
                    <p>Cargando usuarios...</p>
                </div>
                
                <!-- Lista de usuarios -->
                <div class="usuarios-lista" id="usuariosLista">
                    <!-- Se llena dinámicamente -->
                </div>
                
                <!-- Footer del modal -->
                <div class="modal-footer">
                    <button class="btn-usuarios-secondary" onclick="cerrarModalUsuarios()">
                        Cerrar
                    </button>
                </div>
                
            </div>
        </div>
    `;
    
    // Agregar al body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Agregar estilos
    agregarEstilosUsuarios();
}

// ===================================
// CARGAR TODOS LOS USUARIOS
// ===================================
async function cargarTodosLosUsuarios() {
    try {
        mostrarLoadingUsuarios(true);
        
        console.log('📊 Cargando usuarios desde Supabase...');
        
        // Query a la tabla usuarios con información de roles
        const { data: usuarios, error } = await supabaseUsuarios
            .from('usuarios')
            .select(`
                *,
                roles:rol_id (
                    nombre,
                    permisos
                )
            `)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error cargando usuarios:', error);
            throw error;
        }
        
        console.log('✅ Usuarios cargados:', usuarios.length);
        
        todosLosUsuarios = usuarios || [];
        renderizarUsuarios(todosLosUsuarios);
        actualizarEstadisticasUsuarios();
        
        mostrarLoadingUsuarios(false);
        
    } catch (error) {
        console.error('Error completo cargando usuarios:', error);
        mostrarLoadingUsuarios(false);
        document.getElementById('usuariosLista').innerHTML = `
            <div class="error-usuarios">
                <p>❌ Error al cargar usuarios: ${error.message}</p>
                <button onclick="cargarTodosLosUsuarios()">🔄 Reintentar</button>
            </div>
        `;
    }
}

// ===================================
// RENDERIZAR LISTA DE USUARIOS
// ===================================
function renderizarUsuarios(usuarios) {
    const lista = document.getElementById('usuariosLista');
    
    if (!usuarios || usuarios.length === 0) {
        lista.innerHTML = `
            <div class="no-usuarios">
                <p>👤 No hay usuarios registrados</p>
                <button onclick="abrirCrearUsuario()">➕ Crear primer usuario</button>
            </div>
        `;
        return;
    }
    
    let html = '<div class="usuarios-tabla">';
    
    // Header de la tabla
    html += `
        <div class="usuarios-header">
            <span>Usuario</span>
            <span>Departamento</span>
            <span>Rol</span>
            <span>Estado</span>
            <span>Token</span>
            <span>Acciones</span>
        </div>
    `;
    
    // Filas de usuarios
    usuarios.forEach(usuario => {
        const rolNombre = usuario.roles?.nombre || 'Sin rol';
        const estadoClass = usuario.activo ? 'activo' : 'inactivo';
        const estadoTexto = usuario.activo ? 'Activo' : 'Inactivo';
        const tokenTexto = usuario.token_disponible ? 'Disponible' : 'Usado';
        const tokenClass = usuario.token_disponible ? 'disponible' : 'usado';
        
        html += `
        
            <div class="usuario-fila" data-usuario-id="${usuario.id}">
                <div class="usuario-info">
                    <div class="usuario-avatar">
                        ${usuario.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div class="usuario-datos">
                        <strong>${usuario.nombre}</strong>
                        <small>${usuario.username}</small>
                    </div>
                </div>
                
                <div class="usuario-departamento">
                    ${usuario.departamento || 'No especificado'}
                </div>
                
                <div class="usuario-rol">
                    <span class="rol-badge rol-${rolNombre.toLowerCase().replace(' ', '-')}">${rolNombre}</span>
                </div>
                
                <div class="usuario-estado">
                    <span class="estado-badge estado-${estadoClass}">${estadoTexto}</span>
                </div>
                
                <div class="usuario-token">
                    <span class="token-badge token-${tokenClass}">${tokenTexto}</span>
                </div>
                
                <div class="usuario-acciones">
                    <button class="btn-accion-edit" onclick="editarUsuario('${usuario.id}')" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-accion-toggle" onclick="toggleUsuarioEstado('${usuario.id}')" title="${usuario.activo ? 'Desactivar' : 'Activar'}">
                        ${usuario.activo ? '🔒' : '🔓'}
                    </button>
                    
                    <!-- Dropdown para tokens -->
                    <div class="token-dropdown">
                        <button class="btn-accion-token dropdown-toggle" title="Resetear Tokens">
                            🔄 ▼
                        </button>
                        <div class="dropdown-menu">
                            <button onclick="resetearToken('${usuario.id}', 'todos')">🔄 Todos</button>
                            <button onclick="resetearToken('${usuario.id}', 'insumo')">📦 Insumos</button>
                            <button onclick="resetearToken('${usuario.id}', 'papeleria_ordinario')">📝 P. Ordinario</button>
                            <button onclick="resetearToken('${usuario.id}', 'papeleria_extraordinario')">⚡ P. Extraordinario</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    lista.innerHTML = html;
}

// ===================================
// ACTUALIZAR ESTADÍSTICAS
// ===================================
function actualizarEstadisticasUsuarios() {
    const total = todosLosUsuarios.length;
    const activos = todosLosUsuarios.filter(u => u.activo).length;
    const admins = todosLosUsuarios.filter(u => 
        u.roles?.nombre === 'admin' || u.roles?.nombre === 'super_admin'
    ).length;
    
    document.getElementById('totalUsuarios').textContent = total;
    document.getElementById('usuariosActivos').textContent = activos;
    document.getElementById('usuariosAdmins').textContent = admins;
}

// ===================================
// CREAR NUEVO USUARIO
// ===================================
function abrirCrearUsuario() {
    usuarioEditando = null;
    abrirModalFormUsuario();
}

// ===================================
// EDITAR USUARIO EXISTENTE
// ===================================
function editarUsuario(usuarioId) {
    usuarioEditando = todosLosUsuarios.find(u => u.id === usuarioId);
    if (!usuarioEditando) {
        alert('Usuario no encontrado');
        return;
    }
    abrirModalFormUsuario(usuarioEditando);
}

// ===================================
// TOGGLE ESTADO USUARIO
// ===================================
async function toggleUsuarioEstado(usuarioId) {
    try {
        const usuario = todosLosUsuarios.find(u => u.id === usuarioId);
        if (!usuario) return;
        
        const nuevoEstado = !usuario.activo;
        const confirmacion = confirm(
            `¿${nuevoEstado ? 'Activar' : 'Desactivar'} usuario ${usuario.nombre}?`
        );
        
        if (!confirmacion) return;
        
        const { error } = await supabaseUsuarios
            .from('usuarios')
            .update({ activo: nuevoEstado })
            .eq('id', usuarioId);
        
        if (error) throw error;
        
        // Actualizar localmente
        usuario.activo = nuevoEstado;
        renderizarUsuarios(todosLosUsuarios);
        actualizarEstadisticasUsuarios();
        
        showNotificationUsuarios(`Usuario ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`, 'success');
        
    } catch (error) {
        console.error('Error toggle usuario:', error);
        showNotificationUsuarios('Error al cambiar estado del usuario', 'error');
    }
}

// ===================================
// RESETEAR TOKEN DE USUARIO
// ===================================
/*async function resetearToken(usuarioId) {
    try {
        const usuario = todosLosUsuarios.find(u => u.id === usuarioId);
        if (!usuario) return;
        
        const confirmacion = confirm(`¿Resetear token de ${usuario.nombre}? Podrá hacer una nueva solicitud.`);
        if (!confirmacion) return;
        
        const { error } = await supabaseUsuarios
            .from('usuarios')
            .update({ token_disponible: 1 })
            .eq('id', usuarioId);
        
        if (error) throw error;
        
        // Actualizar localmente
        usuario.token_disponible = 1;
        renderizarUsuarios(todosLosUsuarios);
        
        showNotificationUsuarios(`Token reseteado para ${usuario.nombre}`, 'success');
        
    } catch (error) {
        console.error('Error reseteando token:', error);
        showNotificationUsuarios('Error al resetear token', 'error');
    }
}*/

// ===================================
// UTILIDADES
// ===================================
function mostrarLoadingUsuarios(show) {
    const loading = document.getElementById('usuariosLoading');
    const lista = document.getElementById('usuariosLista');
    
    if (loading) loading.style.display = show ? 'flex' : 'none';
    if (lista) lista.style.display = show ? 'none' : 'block';
}

function recargarUsuarios() {
    cargarTodosLosUsuarios();
}

function cerrarModalUsuarios() {
    document.getElementById('modalUsuarios').style.display = 'none';
    document.body.style.overflow = '';
}

function showNotificationUsuarios(message, type = 'info') {
    // Crear notificación simple
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ffebee' : '#e8f5e8'};
        color: ${type === 'error' ? '#c62828' : '#2e7d32'};
        padding: 12px 16px;
        border-radius: 6px;
        border: 1px solid ${type === 'error' ? '#ef5350' : '#66bb6a'};
        z-index: 10000;
        font-weight: 500;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// ===================================
// PLACEHOLDER PARA MODAL DE FORMULARIO
// ===================================
function abrirModalFormUsuario(usuario = null) {
    // TODO: Implementar en siguiente paso
    const esEdicion = usuario !== null;
    alert(`🚧 Próximamente: ${esEdicion ? 'Editar' : 'Crear'} usuario\n\nDatos: ${esEdicion ? usuario.nombre : 'Nuevo usuario'}`);
}

// ===================================
// ESTILOS CSS PARA LOS MODALES
// ===================================
function agregarEstilosUsuarios() {
    if (document.getElementById('estilos-usuarios')) return;
    
    const estilos = document.createElement('style');
    estilos.id = 'estilos-usuarios';
    estilos.textContent = `
        /* Modal de usuarios */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        }
        
        .modal-usuarios {
            background: white;
            border-radius: 12px;
            width: 95%;
            max-width: 1200px;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }
        
        .modal-header {
            background: linear-gradient(135deg, #2c3e50, #34495e);
            color: white;
            padding: 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .modal-header h2 {
            margin: 0;
            font-size: 1.5rem;
            font-weight: 600;
        }
        
        .modal-close {
            background: none;
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.5rem;
            border-radius: 4px;
            transition: background 0.2s;
        }
        
        .modal-close:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        
        .usuarios-controles {
            padding: 1.5rem;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
        }
        
        .usuarios-stats {
            display: flex;
            gap: 2rem;
        }
        
        .stat-item {
            font-size: 0.9rem;
            color: #666;
        }
        
        .stat-item strong {
            color: #2c3e50;
            font-size: 1.2rem;
        }
        
        .usuarios-acciones {
            display: flex;
            gap: 0.5rem;
        }
        
        .btn-usuarios-primary {
            background: #3498db;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: background 0.2s;
        }
        
        .btn-usuarios-primary:hover {
            background: #2980b9;
        }
        
        .btn-usuarios-secondary {
            background: #f8f9fa;
            color: #495057;
            border: 1px solid #dee2e6;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
        }
        
        .btn-usuarios-secondary:hover {
            background: #e9ecef;
            border-color: #adb5bd;
        }
        
        .usuarios-lista {
            padding: 1rem;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .usuarios-tabla {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        
        .usuarios-header {
            display: grid;
            grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr 1.5fr;
            gap: 1rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 6px;
            font-weight: 600;
            color: #495057;
            font-size: 0.9rem;
        }
        
        .usuario-fila {
            display: grid;
            grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr 1.5fr;
            gap: 1rem;
            padding: 1rem;
            background: white;
            border: 1px solid #eee;
            border-radius: 6px;
            transition: all 0.2s;
            align-items: center;
        }
        
        .usuario-fila:hover {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            transform: translateY(-1px);
        }
        
        .usuario-info {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .usuario-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #3498db;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1rem;
        }
        
        .usuario-datos strong {
            display: block;
            color: #2c3e50;
            font-size: 0.95rem;
        }
        
        .usuario-datos small {
            color: #6c757d;
            font-size: 0.8rem;
        }
        
        .rol-badge, .estado-badge, .token-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
            text-transform: uppercase;
        }
        
        .rol-usuario {
            background: #e3f2fd;
            color: #1565c0;
        }
        
        .rol-admin {
            background: #fff3e0;
            color: #ef6c00;
        }
        
        .rol-super-admin {
            background: #fce4ec;
            color: #c2185b;
        }
        
        .estado-activo {
            background: #e8f5e8;
            color: #2e7d32;
        }
        
        .estado-inactivo {
            background: #ffebee;
            color: #c62828;
        }
        
        .token-disponible {
            background: #e8f5e8;
            color: #2e7d32;
        }
        
        .token-usado {
            background: #fff3e0;
            color: #ef6c00;
        }
        
        .usuario-acciones {
            display: flex;
            gap: 0.25rem;
        }
        
        .btn-accion-edit, .btn-accion-toggle, .btn-accion-token {
            background: none;
            border: 1px solid #dee2e6;
            padding: 0.5rem;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-accion-edit:hover {
            background: #e3f2fd;
            border-color: #2196f3;
        }
        
        .btn-accion-toggle:hover {
            background: #fff3e0;
            border-color: #ff9800;
        }
        
        .btn-accion-token:hover {
            background: #e8f5e8;
            border-color: #4caf50;
        }
        
        .usuarios-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem;
            color: #6c757d;
        }
        
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .modal-footer {
            padding: 1.5rem;
            border-top: 1px solid #eee;
            text-align: right;
        }
        
        .no-usuarios, .error-usuarios {
            text-align: center;
            padding: 3rem;
            color: #6c757d;
        }
        
        @media (max-width: 768px) {
            .modal-usuarios {
                width: 95%;
                max-height: 90vh;
            }
            
            .usuarios-controles {
                flex-direction: column;
                align-items: stretch;
            }
            
            .usuarios-stats {
                justify-content: space-around;
            }
            
            .usuarios-header {
                grid-template-columns: 1fr;
                gap: 0.5rem;
            }
            
            .usuario-fila {
                grid-template-columns: 1fr;
                gap: 0.5rem;
            }
        }
            /* CSS para dropdown de tokens */
        .token-dropdown {
            position: relative;
            display: inline-block;
        }

        .dropdown-toggle {
            background: #f8f9fa;
            border: 1px solid #ddd;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
        }

        .dropdown-menu {
            position: absolute;
            bottom: 100%;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 1000;
            min-width: 150px;
            display: none;
            margin-bottom: 2px;
        }

        .token-dropdown:hover .dropdown-menu {
            display: block;
        }

        .dropdown-menu button {
            display: block;
            width: 100%;
            padding: 0.5rem 0.75rem;
            border: none;
            background: none;
            text-align: left;
            cursor: pointer;
            font-size: 0.8rem;
        }

        .dropdown-menu button:hover {
            background: #f8f9fa;
        }
    `;
    
    document.head.appendChild(estilos);
}

// ===================================
// FUNCIONES FALTANTES PARA USUARIOS.JS
// Agregar al final del archivo usuarios.js
// ===================================

// ===================================
// CERRAR MODAL PRINCIPAL
// ===================================
function cerrarModalUsuarios() {
    const modal = document.getElementById('modalUsuarios');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    // Cerrar también modal de formulario si está abierto
    const modalForm = document.getElementById('modalFormUsuario');
    if (modalForm) {
        modalForm.style.display = 'none';
    }
}

// ===================================
// RECARGAR USUARIOS
// ===================================
function recargarUsuarios() {
    cargarTodosLosUsuarios();
}

// ===================================
// LOADING USUARIOS
// ===================================
function mostrarLoadingUsuarios(mostrar) {
    const loading = document.getElementById('usuariosLoading');
    const lista = document.getElementById('usuariosLista');
    
    if (loading) loading.style.display = mostrar ? 'block' : 'none';
    if (lista) lista.style.display = mostrar ? 'none' : 'block';
}

// ===================================
// MODAL DE FORMULARIO CREAR/EDITAR USUARIO
// ===================================
function abrirModalFormUsuario(usuario = null) {
    const esEdicion = usuario !== null;
    
    // Crear modal de formulario si no existe
    if (!document.getElementById('modalFormUsuario')) {
        crearModalFormularioUsuario();
    }
    
    // Cargar roles disponibles
    cargarRolesEnSelect();
    
    // Si es edición, llenar campos
    if (esEdicion) {
        document.getElementById('formUsuarioId').value = usuario.id;
        document.getElementById('formUsername').value = usuario.username;
        document.getElementById('formNombre').value = usuario.nombre;
        document.getElementById('formDepartamento').value = usuario.departamento;
        document.getElementById('formRol').value = usuario.rol_id;
        document.getElementById('formActivo').checked = usuario.activo;
        document.getElementById('formToken').checked = usuario.token_disponible;
        
        // Título del modal
        document.getElementById('tituloFormUsuario').textContent = '✏️ Editar Usuario';
        document.getElementById('btnGuardarUsuario').textContent = '💾 Actualizar';
        
        // Password opcional en edición
        document.getElementById('formPassword').required = false;
        document.querySelector('label[for="formPassword"]').textContent = 'Nueva Contraseña (opcional)';
    } else {
        // Limpiar formulario para nuevo usuario
        document.getElementById('formUsuario').reset();
        document.getElementById('formUsuarioId').value = '';
        
        // Título del modal
        document.getElementById('tituloFormUsuario').textContent = '➕ Nuevo Usuario';
        document.getElementById('btnGuardarUsuario').textContent = '💾 Crear Usuario';
        
        // Password requerido en creación
        document.getElementById('formPassword').required = true;
        document.querySelector('label[for="formPassword"]').textContent = 'Contraseña *';
        
        // Valores por defecto
        document.getElementById('formActivo').checked = true;
        document.getElementById('formToken').checked = true;
    }
    
    // Mostrar modal
    document.getElementById('modalFormUsuario').style.display = 'flex';
}

// ===================================
// CREAR MODAL DE FORMULARIO
// ===================================
function crearModalFormularioUsuario() {
    const modalHTML = `
        <div class="modal-overlay" id="modalFormUsuario" style="display: none;">
            <div class="modal-content modal-form-usuario">
                
                <!-- Header -->
                <div class="modal-header">
                    <h3 id="tituloFormUsuario">➕ Nuevo Usuario</h3>
                    <button class="modal-close" onclick="cerrarModalFormUsuario()">×</button>
                </div>
                
                <!-- Formulario -->
                <div class="modal-body">
                    <form id="formUsuario" onsubmit="guardarUsuario(event)">
                        
                        <!-- ID oculto para edición -->
                        <input type="hidden" id="formUsuarioId">
                        
                        <!-- Username -->
                        <div class="form-group">
                            <label for="formUsername">Username (Usuario) *</label>
                            <input type="text" id="formUsername" required 
                                   pattern="[a-zA-Z0-9_]+" 
                                   title="Solo letras, números y guión bajo"
                                   placeholder="ej: JURD01">
                            <small>Solo letras, números y guión bajo. Se usará para login.</small>
                        </div>
                        
                        <!-- Nombre completo -->
                        <div class="form-group">
                            <label for="formNombre">Nombre Completo *</label>
                            <input type="text" id="formNombre" required 
                                   placeholder="ej: Juan Pérez López">
                        </div>
                        
                        <!-- Departamento -->
                        <div class="form-group">
                            <label for="formDepartamento">Departamento/Área *</label>
                            <select id="formDepartamento" required>
                                <option value="">Seleccionar departamento...</option>
                                <option value="Dirección Jurídica">Dirección Jurídica</option>
                                <option value="Coordinación Administrativa">Coordinación Administrativa</option>
                                <option value="Coordinación de Sistemas">Coordinación de Sistemas</option>
                                <option value="Administración General">Administración General</option>
                                <option value="Recursos Humanos">Recursos Humanos</option>
                                <option value="Contabilidad">Contabilidad</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        
                        <!-- Contraseña -->
                        <div class="form-group">
                            <label for="formPassword">Contraseña *</label>
                            <input type="password" id="formPassword" required 
                                   minlength="3" placeholder="Mínimo 3 caracteres">
                            <small>La contraseña debe tener al menos 3 caracteres</small>
                        </div>
                        
                        <!-- Rol -->
                        <div class="form-group">
                            <label for="formRol">Rol del Sistema *</label>
                            <select id="formRol" required>
                                <option value="">Cargando roles...</option>
                            </select>
                        </div>
                        
                        <!-- Estado activo -->
                        <div class="form-group checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="formActivo" checked>
                                <span class="checkmark"></span>
                                Usuario Activo
                            </label>
                            <small>Si está desactivado, no podrá iniciar sesión</small>
                        </div>
                        
                        <!-- Token disponible -->
                        <div class="form-group checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="formToken" checked>
                                <span class="checkmark"></span>
                                Token Mensual Disponible
                            </label>
                            <small>Define si puede hacer solicitudes ordinarias este mes</small>
                        </div>
                        
                    </form>
                </div>
                
                <!-- Footer -->
                <div class="modal-footer">
                    <button type="button" class="btn-usuarios-secondary" onclick="cerrarModalFormUsuario()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-usuarios-primary" id="btnGuardarUsuario" 
                            onclick="document.getElementById('formUsuario').requestSubmit()">
                        💾 Crear Usuario
                    </button>
                </div>
                
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Agregar estilos específicos del formulario
    agregarEstilosFormUsuario();
}

// ===================================
// CERRAR MODAL FORMULARIO
// ===================================
function cerrarModalFormUsuario() {
    const modal = document.getElementById('modalFormUsuario');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ===================================
// CARGAR ROLES EN SELECT
// ===================================
async function cargarRolesEnSelect() {
    try {
        const { data: roles, error } = await supabaseUsuarios
            .from('roles')
            .select('id, nombre, descripcion')
            .order('nombre');
        
        if (error) throw error;
        
        const select = document.getElementById('formRol');
        if (select && roles) {
            select.innerHTML = '<option value="">Seleccionar rol...</option>';
            
            roles.forEach(rol => {
                const option = document.createElement('option');
                option.value = rol.id;
                option.textContent = `${rol.nombre}${rol.descripcion ? ' - ' + rol.descripcion : ''}`;
                select.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error cargando roles:', error);
        const select = document.getElementById('formRol');
        if (select) {
            select.innerHTML = '<option value="">Error cargando roles</option>';
        }
    }
}

// ===================================
// GUARDAR USUARIO (CREAR/EDITAR)
// ===================================
// ===================================
// FUNCIÓN GUARDAR USUARIO - VERSION DEBUG
// REEMPLAZA la función guardarUsuario en usuarios.js
// ===================================

async function guardarUsuario(event) {
    event.preventDefault();
    
    const btn = document.getElementById('btnGuardarUsuario');
    const originalText = btn.textContent;
    
    try {
        btn.disabled = true;
        btn.textContent = '⏳ Guardando...';
        
        // Obtener datos del formulario
        const usuarioId = document.getElementById('formUsuarioId').value;
        const username = document.getElementById('formUsername').value.trim();
        const nombre = document.getElementById('formNombre').value.trim();
        const departamento = document.getElementById('formDepartamento').value;
        const password = document.getElementById('formPassword').value;
        const rolId = document.getElementById('formRol').value;
        const activo = document.getElementById('formActivo').checked;
        const tokenDisponible = document.getElementById('formToken').checked;
        
        console.log('=== DEBUG DATOS FORMULARIO ===');
        console.log('usuarioId:', usuarioId);
        console.log('username:', username);
        console.log('nombre:', nombre);
        console.log('departamento:', departamento);
        console.log('password:', password ? '***' : 'vacío');
        console.log('rolId:', rolId);
        console.log('activo:', activo);
        console.log('tokenDisponible:', tokenDisponible);
        
        // Validaciones
        if (!username || !nombre || !departamento || !rolId) {
            throw new Error('Todos los campos obligatorios deben estar llenos');
        }
        
        if (!usuarioId && !password) {
            throw new Error('La contraseña es requerida para nuevos usuarios');
        }
        
        // Preparar datos - VERSION SIMPLE Y LIMPIA
        const userData = {
            username: username.toUpperCase(),
            nombre: nombre,
            departamento: departamento,
            rol_id: parseInt(rolId),
            activo: activo,
            token_disponible: tokenDisponible ? 1 : 0
        };
        
        // Solo agregar password_hash si hay password Y es creación
        if (!usuarioId && password && password.trim()) {
            userData.password_hash = password.trim();
        }
        
        // Si es edición Y hay password, agregarlo
        if (usuarioId && password && password.trim()) {
            userData.password_hash = password.trim();
        }
        
        console.log('=== DEBUG DATOS A ENVIAR ===');
        console.log('Es edición:', !!usuarioId);
        console.log('Datos finales:', userData);
        
        let result;
        
        if (usuarioId) {
            console.log('=== EJECUTANDO UPDATE ===');
            result = await supabaseUsuarios
                .from('usuarios')
                .update(userData)
                .eq('id', usuarioId)
                .select(); // Agregar select para ver el resultado
                
            console.log('Resultado UPDATE:', result);
        } else {
            console.log('=== EJECUTANDO INSERT ===');
            result = await supabaseUsuarios
                .from('usuarios')
                .insert([userData])
                .select(); // Agregar select para ver el resultado
                
            console.log('Resultado INSERT:', result);
        }
        
        if (result.error) {
            console.error('=== ERROR DE SUPABASE ===');
            console.error('Error completo:', result.error);
            console.error('Mensaje:', result.error.message);
            console.error('Detalles:', result.error.details);
            console.error('Hint:', result.error.hint);
            throw result.error;
        }
        
        console.log('=== ÉXITO ===');
        console.log('Data guardada:', result.data);
        
        // Éxito
        showNotificationUsuarios(
            `Usuario ${usuarioId ? 'actualizado' : 'creado'} exitosamente`, 
            'success'
        );
        
        // Cerrar modal y recargar lista
        cerrarModalFormUsuario();
        await cargarTodosLosUsuarios();
        
    } catch (error) {
        console.error('=== ERROR COMPLETO ===');
        console.error('Error object:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        showNotificationUsuarios(`Error: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// ===================================
// RESETEAR TOKEN DE USUARIO
// ===================================
async function resetearToken(usuarioId, tipoToken = 'todos') {
    try {
        const usuario = todosLosUsuarios.find(u => u.id === usuarioId);
        if (!usuario) return;
        
        // Determinar qué tokens resetear
        let mensaje = '';
        let updateData = {};
        
        if (tipoToken === 'todos') {
            mensaje = `¿Resetear TODOS los tokens de ${usuario.nombre}?\n\nEsto incluye:\n- Token de insumos\n- Token papelería ordinario\n- Token papelería extraordinario`;
            updateData = {
                token_disponible: 1,
                token_papeleria_ordinario: 1,
                token_papeleria_extraordinario: 1
            };
        } else if (tipoToken === 'insumo') {
            mensaje = `¿Resetear token de insumos de ${usuario.nombre}?`;
            updateData = { token_disponible: 1 };
        } else if (tipoToken === 'papeleria_ordinario') {
            mensaje = `¿Resetear token papelería ordinario de ${usuario.nombre}?`;
            updateData = { token_papeleria_ordinario: 1 };
        } else if (tipoToken === 'papeleria_extraordinario') {
            mensaje = `¿Resetear token papelería extraordinario de ${usuario.nombre}?`;
            updateData = { token_papeleria_extraordinario: 1 };
        }
        
        const confirmacion = confirm(mensaje);
        if (!confirmacion) return;
        
        const { error } = await supabaseUsuarios
            .from('usuarios')
            .update(updateData)
            .eq('id', usuarioId);
        
        if (error) throw error;
        
        // Actualizar localmente
        Object.assign(usuario, updateData);
        renderizarUsuarios(todosLosUsuarios);
        
        showNotificationUsuarios(`Tokens reseteados para ${usuario.nombre}`, 'success');
        
    } catch (error) {
        console.error('Error reseteando token:', error);
        showNotificationUsuarios(`Error reseteando token: ${error.message}`, 'error');
    }
}

// ===================================
// ESTILOS ADICIONALES PARA FORMULARIO
// ===================================
function agregarEstilosFormUsuario() {
    if (document.getElementById('estilos-form-usuario')) return;
    
    const estilos = document.createElement('style');
    estilos.id = 'estilos-form-usuario';
    estilos.textContent = `
        .modal-form-usuario {
            max-width: 600px;
            width: 90%;
        }
        
        .form-group {
            margin-bottom: 1.25rem;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .form-group input,
        .form-group select {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e1e8ed;
            border-radius: 6px;
            font-size: 1rem;
            transition: border-color 0.2s;
        }
        
        .form-group input:focus,
        .form-group select:focus {
            outline: none;
            border-color: #3498db;
            box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }
        
        .form-group small {
            display: block;
            margin-top: 0.25rem;
            font-size: 0.85rem;
            color: #6c757d;
            font-style: italic;
        }
        
        .checkbox-group {
            position: relative;
        }
        
        .checkbox-label {
            display: flex;
            align-items: center;
            cursor: pointer;
            font-weight: normal !important;
            margin-bottom: 0 !important;
        }
        
        .checkbox-label input[type="checkbox"] {
            width: auto;
            margin-right: 0.75rem;
            transform: scale(1.2);
        }
        
        .modal-footer {
            padding: 1.5rem;
            border-top: 1px solid #eee;
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
        }
    `;
    
    document.head.appendChild(estilos);
}

// Alias para compatibilidad con el botón en admin.html
function gestionarUsuarios() {
    abrirModalUsuarios();
}

console.log('✅ usuarios.js cargado correctamente');
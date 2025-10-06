/* ===================================
   HISTORIAL DE SOLICITUDES - LÓGICA
   =================================== */

// Variables globales del historial
let solicitudesUsuario = [];
let solicitudSeleccionada = null;
let solicitudesRecibidas = []; // ← AGREGAR ESTA LÍNEA

// Configuración Supabase (usar misma que script.js)
const SUPABASE_CONFIG = {
    url: 'https://nxuvisaibpmdvraybzbm.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54dXZpc2FpYnBtZHZyYXliemJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4OTMxNjQsImV4cCI6MjA3MTQ2OTE2NH0.OybYM_E3mWsZym7mEf-NiRtrG0svkylXx_q8Tivonfg'
};

const supabaseHistorial = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// ===================================
// INICIALIZACIÓN DE HISTORIAL
// ===================================

document.addEventListener('DOMContentLoaded', async function () {
    console.log('Inicializando página de historial...');

    // Verificar autenticación
    const user = verificarSesion();
    if (!user) return;

    // Cargar componentes del header/footer
    await cargarComponentesHistorial();

    // Cargar estado del token del usuario
    actualizarEstadoToken();

    // Cargar historial de solicitudes
    await cargarHistorialSolicitudes();
});

function verificarSesion() {
    const session = sessionStorage.getItem('currentUser');
    if (!session) {
        console.log('No hay sesión, redirigiendo al login');
        window.location.replace('/login.html');
        return null;
    }

    try {
        return JSON.parse(session);
    } catch (error) {
        console.error('Error en sesión:', error);
        window.location.replace('/login.html');
        return null;
    }
}

async function cargarComponentesHistorial() {
    try {
        await Promise.all([
            loadComponent('header-container', 'includes/header.html'),
            loadComponent('footer-container', 'includes/foot.html')
        ]);

        setTimeout(() => {
            setupHeaderEvents();
            setupFooterEvents();
        }, 200);

    } catch (error) {
        console.error('Error cargando componentes:', error);
    }
}

// ===================================
// GESTIÓN DE TOKEN Y ESTADO
// ===================================

function actualizarEstadoToken() {
    const session = sessionStorage.getItem('currentUser');
    if (!session) return;
    
    const user = JSON.parse(session);
    
    // Actualizar la sección de tokens para mostrar los 3
    const tokenSection = document.querySelector('.token-status-card');
    if (tokenSection) {
        tokenSection.innerHTML = `
            <div class="tokens-grid">
                <div class="token-item">
                    <span class="token-label">Insumos:</span>
                    <span class="token-value ${user.token_disponible === 1 ? 'token-available' : 'token-used'}">${user.token_disponible}</span>
                </div>
                <div class="token-item">
                    <span class="token-label">Papelería Ordinaria:</span>
                    <span class="token-value ${user.token_papeleria_ordinario === 1 ? 'token-available' : 'token-used'}">${user.token_papeleria_ordinario}</span>
                </div>
                <div class="token-item">
                    <span class="token-label">Papelería Extraordinaria:</span>
                    <span class="token-value ${user.token_papeleria_extraordinario === 1 ? 'token-available' : 'token-used'}">${user.token_papeleria_extraordinario}</span>
                </div>
            </div>
        `;
    }
}

// ===================================
// CARGA DE SOLICITUDES
// ===================================

async function cargarHistorialSolicitudes() {
    try {
        mostrarLoading(true);

        const session = sessionStorage.getItem('currentUser');
        const user = JSON.parse(session);

        // Obtener solicitudes del usuario con sus detalles
        const { data: solicitudes, error } = await supabaseHistorial
            .from('solicitudes')
            .select(`
                id,
                tipo,
                recurso_tipo,
                token_tipo_usado,
                estado,
                fecha_solicitud,
                total_items,
                token_usado,
                admin_asignado,
                fecha_cerrado,
                notas_admin,
                datos_junta,
                solicitud_detalles!inner(
                    cantidad_solicitada,
                    cantidad_aprobada,
                    insumos(nombre, unidad_medida),
                    papeleria(nombre, unidad_medida)
                )
            `)
            .eq('usuario_id', user.id)
            .order('fecha_solicitud', { ascending: false });

        if (error) throw error;

        solicitudesUsuario = solicitudes || [];

        // Renderizar solicitudes
        renderizarSolicitudes(solicitudesUsuario);

        mostrarLoading(false);

    } catch (error) {
        console.error('Error cargando historial:', error);
        mostrarError('Error al cargar el historial. Intenta nuevamente.');
        mostrarLoading(false);
    }
}

function mostrarLoading(show) {
    const loading = document.getElementById('loadingHistorial');
    const lista = document.getElementById('solicitudesLista');
    const vacio = document.getElementById('historialVacio');

    if (loading) loading.style.display = show ? 'block' : 'none';
    if (lista) lista.style.display = show ? 'none' : 'block';
    if (vacio) vacio.style.display = 'none';
}

function mostrarError(mensaje) {
    const lista = document.getElementById('solicitudesLista');
    if (lista) {
        lista.innerHTML = `
            <div class="error-message">
                <p>⚠️ ${mensaje}</p>
                <button onclick="cargarHistorialSolicitudes()" class="btn-secondary">Reintentar</button>
            </div>
        `;
    }
}

// ===================================
// RENDERIZADO DE SOLICITUDES
// ===================================

function renderizarSolicitudes(solicitudes) {
    const lista = document.getElementById('solicitudesLista');
    const vacio = document.getElementById('historialVacio');

    if (!solicitudes || solicitudes.length === 0) {
        lista.style.display = 'none';
        vacio.style.display = 'block';
        return;
    }

    lista.style.display = 'block';
    vacio.style.display = 'none';

    let html = '';

    solicitudes.forEach(solicitud => {
        const estadoClass = getEstadoClass(solicitud.estado);
        const tipoLabel = solicitud.tipo === 'ordinaria' ? 'Ordinaria' : 'Para Juntas';
        const fechaFormatted = new Date(solicitud.fecha_solicitud).toLocaleString('es-ES');

        // Verificar si puede marcar como recibido
        const puedeMarcarRecibido = solicitud.estado === 'cerrado' && !yaEstaRecibido(solicitud.id);

        html += `
            <div class="solicitud-item" data-solicitud="${solicitud.id}">
                <div class="solicitud-header">
                    <div class="solicitud-info">
                        <span class="solicitud-id">#${solicitud.id.substring(0, 8)}</span>
                        <span class="recurso-tipo recurso-${solicitud.recurso_tipo || 'insumo'}">${solicitud.recurso_tipo === 'papeleria' ? 'Papelería' : 'Insumos'}</span>
                        <span class="solicitud-tipo tipo-${solicitud.tipo}">${tipoLabel}</span>                        
                        <span class="solicitud-estado estado-${estadoClass}">${getEstadoLabel(solicitud.estado)}</span>
                    </div>
                    <div class="solicitud-fecha">
                        ${fechaFormatted}
                    </div>
                </div>
                
                <div class="solicitud-body">
                    <div class="solicitud-detalles">
                        <p><strong>Total de items:</strong> ${solicitud.total_items}</p>
                        ${solicitud.token_usado ? '<span class="token-usado">Token utilizado</span>' : ''}
                    </div>
                    
                    ${solicitud.datos_junta ? `
                        <div class="solicitud-evento">
                            <h5>Información del Evento:</h5>
                            <div class="evento-grid">
                                <div class="evento-item">
                                    <strong>Fecha:</strong> ${new Date(solicitud.datos_junta.fecha_evento).toLocaleDateString('es-ES')}
                                </div>
                                <div class="evento-item">
                                    <strong>Hora:</strong> ${solicitud.datos_junta.hora_evento}
                                </div>
                                <div class="evento-item">
                                    <strong>Participantes:</strong> ${solicitud.datos_junta.num_participantes} personas
                                </div>
                                <div class="evento-item">
                                    <strong>Ubicación:</strong> ${solicitud.datos_junta.sala_ubicacion}
                                </div>
                                ${solicitud.datos_junta.descripcion ? `
                                    <div class="evento-descripcion">
                                        <strong>Descripción:</strong> ${solicitud.datos_junta.descripcion}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="solicitud-insumos" style="display: none;">
                        <h5>Items solicitados:</h5>
                        <ul class="insumos-list">
                            ${solicitud.solicitud_detalles.map(detalle => {
                                const item = detalle.insumos || detalle.papeleria;
                                const nombreItem = item ? item.nombre : 'Item no encontrado';
                                const unidadMedida = item ? item.unidad_medida : 'unidad';
                                
                                return `
                                    <li class="insumo-detalle">
                                        <span class="insumo-nombre">${nombreItem}</span>
                                        <span class="cantidades">
                                            Solicitado: ${detalle.cantidad_solicitada} ${unidadMedida}
                                            ${detalle.cantidad_aprobada ?
                                                `| Entregado: ${detalle.cantidad_aprobada} ${unidadMedida}` :
                                                ''
                                            }
                                        </span>
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    </div>
                </div>
                
                <div class="solicitud-actions">
                    ${puedeMarcarRecibido ? `
                        <button class="btn-recibido" onclick="abrirModalRecibido('${solicitud.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12l2 2 4-4"/>
                                <circle cx="12" cy="12" r="10"/>
                            </svg>
                            Marcar como Recibido
                        </button>
                    ` : ''}
                    
                    <button class="btn-secondary btn-sm" onclick="toggleDetalles('${solicitud.id}')">
                        Ver Detalles
                    </button>
                </div>
            </div>
        `;
    });

    lista.innerHTML = html;
}
// ===================================
// FUNCIONES DE UTILIDAD
// ===================================

function getEstadoClass(estado) {
    const estados = {
        'pendiente': 'pendiente',
        'en_revision': 'revision',
        'cerrado': 'cerrado',
        'cancelado': 'cancelado'
    };
    return estados[estado] || 'pendiente';
}

function getEstadoLabel(estado) {
    const labels = {
        'pendiente': 'Pendiente',
        'en_revision': 'En Revisión',
        'cerrado': 'Cerrado',
        'cancelado': 'Cancelado'
    };
    return labels[estado] || 'Desconocido';
}

/*async function yaEstaRecibido(solicitudId) {
    try {
        const { data, error } = await supabaseHistorial
            .from('solicitudes_recibidos')
            .select('id')
            .eq('solicitud_id', solicitudId)
            .single();
            
        if (error && error.code !== 'PGRST116') {
            console.error('Error verificando recibido:', error);
            return false;
        }
        
        return !!data; // True si existe, false si no existe
    } catch (error) {
        console.error('Error en yaEstaRecibido:', error);
        return false;
    }
}*/

function yaEstaRecibido(solicitudId) {
    return solicitudesRecibidas.includes(solicitudId);
}
// ===================================
// GESTIÓN DE FILTROS
// ===================================

function filtrarSolicitudes() {
    const filtroTipo = document.getElementById('filtroTipo').value;
    const filtroEstado = document.getElementById('filtroEstado').value;
    const filtroRecurso = document.getElementById('filtroRecurso')?.value; // Nuevo filtro

    let solicitudesFiltradas = [...solicitudesUsuario];

    if (filtroTipo) {
        solicitudesFiltradas = solicitudesFiltradas.filter(s => s.tipo === filtroTipo);
    }

    if (filtroEstado) {
        solicitudesFiltradas = solicitudesFiltradas.filter(s => s.estado === filtroEstado);
    }

    // Nuevo: Filtrar por tipo de recurso
    if (filtroRecurso && filtroRecurso !== 'todos') {
        solicitudesFiltradas = solicitudesFiltradas.filter(s => 
            (s.recurso_tipo || 'insumo') === filtroRecurso
        );
    }

    renderizarSolicitudes(solicitudesFiltradas);
}

function recargarHistorial() {
    cargarHistorialSolicitudes();
}

// ===================================
// MARCAR COMO RECIBIDO
// ===================================

function abrirModalRecibido(solicitudId) {
    const solicitud = solicitudesUsuario.find(s => s.id === solicitudId);
    if (!solicitud) return;

    solicitudSeleccionada = solicitud;

    // Actualizar resumen en modal
    const resumen = document.getElementById('resumenSolicitud');
    if (resumen) {
        resumen.innerHTML = `
            <div class="resumen-content">
                <p><strong>Solicitud:</strong> #${solicitud.id.substring(0, 8)}</p>
                <p><strong>Tipo:</strong> ${solicitud.tipo === 'ordinaria' ? 'Ordinaria' : 'Para Juntas'}</p>
                <p><strong>Total items:</strong> ${solicitud.total_items}</p>
                <p><strong>Fecha:</strong> ${new Date(solicitud.fecha_solicitud).toLocaleString('es-ES')}</p>
            </div>
        `;
    }

    // Mostrar modal
    const modal = document.getElementById('recibido-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function cerrarModalRecibido() {
    const modal = document.getElementById('recibido-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    solicitudSeleccionada = null;
}

async function confirmarRecibido() {
    if (!solicitudSeleccionada) return;

    try {
        const session = sessionStorage.getItem('currentUser');
        const user = JSON.parse(session);

        // SOLO registrar como recibido - SIN reactivar token
        const { error: recibidoError } = await supabaseHistorial
            .from('solicitudes_recibidos')
            .insert({
                solicitud_id: solicitudSeleccionada.id,
                usuario_id: user.id,
                fecha_marcado_recibido: new Date().toISOString()
            });

        if (recibidoError) throw recibidoError;

        // Marcar como recibido localmente
        solicitudesRecibidas.push(solicitudSeleccionada.id);

        // Ocultar el botón inmediatamente
        const botonRecibido = document.querySelector(`[data-solicitud="${solicitudSeleccionada.id}"] .btn-recibido`);
        if (botonRecibido) {
            botonRecibido.style.display = 'none';
        }

        showNotificationHistorial('Solicitud marcada como recibida. Tu token se renovará el próximo mes si has marcado todas tus solicitudes.', 'success');

        // Cerrar modal
        cerrarModalRecibido();

    } catch (error) {
        console.error('Error marcando como recibido:', error);
        showNotificationHistorial('Error al marcar como recibido. Intenta nuevamente.', 'error');
    }
}

// ===================================
// FUNCIONES DE UI
// ===================================

function toggleDetalles(solicitudId) {
    const item = document.querySelector(`[data-solicitud="${solicitudId}"]`);
    if (!item) return;

    const insumos = item.querySelector('.solicitud-insumos');
    if (!insumos) return;

    if (insumos.style.display === 'none' || !insumos.style.display) {
        insumos.style.display = 'block';
    } else {
        insumos.style.display = 'none';
    }
}

function showNotificationHistorial(message, type = 'info', duration = 3000) {
    // Crear notificación similar a la del script.js
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 1rem 1.5rem;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 3000;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;

    const colors = {
        success: { border: '#27ae60', background: '#d4edda', color: '#155724' },
        error: { border: '#e74c3c', background: '#f8d7da', color: '#721c24' },
        warning: { border: '#f39c12', background: '#fff3cd', color: '#856404' },
        info: { border: '#3498db', background: '#d1ecf1', color: '#0c5460' }
    };

    const colorScheme = colors[type] || colors.info;
    notification.style.borderLeftColor = colorScheme.border;
    notification.style.backgroundColor = colorScheme.background;
    notification.style.color = colorScheme.color;
    notification.style.borderLeftWidth = '4px';

    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.2rem;">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; margin-left: auto;">×</button>
        </div>
    `;

    document.body.appendChild(notification);

    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }
}

// ===================================
// MANEJO DE ERRORES
// ===================================

window.addEventListener('error', function (e) {
    console.error('Error en historial:', e.error);
});

console.log('Historial.js cargado completamente');
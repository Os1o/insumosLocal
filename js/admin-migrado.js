/* ===================================
   PANEL DE ADMINISTRACIÓN - MIGRADO A API LOCAL
   =================================== */

// Variables globales admin
let todasLasSolicitudes = [];
let solicitudesFiltradas = [];
let currentAdmin = null;
let contadorAnteriorPendientes = 0; // NUEVO: Para detectar nuevas solicitudes
let intervalVerificacion = null;     // NUEVO: Para el polling

// Usar API Adapter en lugar de Supabase
const apiAdmin = window.API;

// ===================================
// INICIALIZACIÓN
// ===================================

document.addEventListener('DOMContentLoaded', async function () {
    console.log('🔄 Iniciando panel de administración (API Local)...');

    // Verificar permisos de administrador
    currentAdmin = verificarPermisosAdmin();
    if (!currentAdmin) return;

    // Mostrar elementos según el rol
    configurarInterfazSegunRol(currentAdmin.rol);

    // Cargar header y footer
    await cargarHeaderAdmin();
    await cargarFooter();

    // Cargar todas las solicitudes
    await cargarTodasLasSolicitudes();

    // Configurar event listeners
    configurarEventListeners();
});

function verificarPermisosAdmin() {
    const session = sessionStorage.getItem('currentUser');
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }

    try {
        const user = JSON.parse(session);
        if (user.rol !== 'admin' && user.rol !== 'super_admin') {
            alert('No tienes permisos para acceder al panel de administración');
            window.location.href = 'index.html';
            return null;
        }
        return user;
    } catch (error) {
        window.location.href = 'login.html';
        return null;
    }
}

function configurarInterfazSegunRol(rol) {
    if (rol === 'super_admin') {
        document.querySelectorAll('.super-admin-only').forEach(element => {
            element.style.display = 'block';
        });
        console.log('✅ Interfaz configurada para super_admin');
    }
}

function configurarEventListeners() {
    const filtroEstado = document.getElementById('filtroEstadoAdmin');
    const filtroTipo = document.getElementById('filtroTipoAdmin');
    const filtroRecurso = document.getElementById('filtroRecurso');
    const btnRecargar = document.getElementById('btnRecargarAdmin');

    if (filtroEstado) filtroEstado.addEventListener('change', filtrarSolicitudesAdmin);
    if (filtroTipo) filtroTipo.addEventListener('change', filtrarSolicitudesAdmin);
    if (filtroRecurso) filtroRecurso.addEventListener('change', filtrarSolicitudesAdmin);
    if (btnRecargar) btnRecargar.addEventListener('click', recargarSolicitudes);
}

// ===================================
// CARGA DE DATOS
// ===================================
async function cargarTodasLasSolicitudes() {
    try {
        console.log('📥 Cargando solicitudes desde API local...');
        mostrarLoadingAdmin(true);

        // Usar fetch directo al endpoint de admin con credenciales
        const response = await fetch('http://11.254.27.18/insumos/api/endpoints/admin.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // IMPORTANTE: Incluir cookies de sesión
            body: JSON.stringify({
                action: 'get-solicitudes'
            })
        });

        const result = await response.json();

        if (!result.success) {
            console.error('❌ Error de API:', result.error);
            throw new Error(result.error || 'Error cargando solicitudes');
        }

        console.log(`✅ Solicitudes cargadas: ${result.data?.length || 0}`);

        todasLasSolicitudes = result.data || [];
        solicitudesFiltradas = [...todasLasSolicitudes];

        renderizarSolicitudesSimples(solicitudesFiltradas);
        actualizarEstadisticasAdmin(todasLasSolicitudes);

        mostrarLoadingAdmin(false);
        
        // Iniciar verificación automática después de la primera carga
        iniciarVerificacionAutomatica();

    } catch (error) {
        console.error('❌ Error completo:', error);
        mostrarErrorAdmin('Error al cargar solicitudes: ' + error.message);
        mostrarLoadingAdmin(false);
    }
}

/*-------------------------------------------------------------------------------------------*/

// ===================================
// VERIFICACIÓN AUTOMÁTICA DE NUEVAS SOLICITUDES
// ===================================

async function verificarNuevasSolicitudes() {
    try {
        // Usar el mismo endpoint de admin con credenciales
        const response = await fetch('http://11.254.27.18/insumos/api/endpoints/admin.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                action: 'get-solicitudes'
            })
        });

        const result = await response.json();

        if (!result.success || !result.data) return;

        const solicitudes = result.data;
        const pendientesActuales = solicitudes.filter(s => s.estado === 'pendiente').length;

        // Si hay MÁS pendientes que antes, hay nuevas solicitudes
        if (contadorAnteriorPendientes > 0 && pendientesActuales > contadorAnteriorPendientes) {
            const nuevasSolicitudes = pendientesActuales - contadorAnteriorPendientes;
            console.log(`🔔 ${nuevasSolicitudes} nueva(s) solicitud(es) detectada(s)`);

            // Reproducir sonido de notificación
            if (window.reproducirSonidoNotificacion) {
                window.reproducirSonidoNotificacion();
            }

            // Mostrar notificación visual
            mostrarNotificacionNuevaSolicitud(nuevasSolicitudes);

            // Recargar automáticamente las solicitudes
            await cargarTodasLasSolicitudes();
        }

        // Actualizar contador para la próxima verificación
        contadorAnteriorPendientes = pendientesActuales;

    } catch (error) {
        console.error('Error verificando nuevas solicitudes:', error);
    }
}

function mostrarNotificacionNuevaSolicitud(cantidad) {
    const notificacion = document.createElement('div');
    notificacion.className = 'notificacion-nueva-solicitud';
    notificacion.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1.5rem 2rem;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        cursor: pointer;
        min-width: 320px;
    `;

    notificacion.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="font-size: 2.5rem; animation: pulse 1s infinite;">🔔</div>
            <div style="flex: 1;">
                <div style="font-weight: bold; font-size: 1.1rem; margin-bottom: 0.25rem;">
                    ${cantidad === 1 ? '¡Nueva Solicitud!' : `¡${cantidad} Nuevas Solicitudes!`}
                </div>
                <div style="font-size: 0.9rem; opacity: 0.9;">
                    Click aquí para ver detalles
                </div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                font-size: 1.5rem;
                cursor: pointer;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            ">×</button>
        </div>
    `;

    // Hacer click para ir a la primera solicitud pendiente
    notificacion.onclick = function(e) {
        if (e.target.tagName !== 'BUTTON') {
            const primeraPendiente = todasLasSolicitudes.find(s => s.estado === 'pendiente');
            if (primeraPendiente) {
                abrirModalRevision(primeraPendiente.id);
            }
            notificacion.remove();
        }
    };

    document.body.appendChild(notificacion);

    // Auto-eliminar después de 8 segundos
    setTimeout(() => {
        if (notificacion.parentNode) {
            notificacion.style.animation = 'fadeOut 0.5s ease';
            setTimeout(() => notificacion.remove(), 500);
        }
    }, 8000);
}

// Iniciar verificación automática cada 30 segundos
function iniciarVerificacionAutomatica() {
    if (intervalVerificacion) {
        clearInterval(intervalVerificacion);
    }
    
    // Inicializar contador con el valor actual
    contadorAnteriorPendientes = todasLasSolicitudes.filter(s => s.estado === 'pendiente').length;
    
    // Verificar cada 30 segundos
    intervalVerificacion = setInterval(verificarNuevasSolicitudes, 30000);
    
    console.log('✅ Verificación automática de solicitudes iniciada (cada 30 segundos)');
}

// Detener verificación (útil si cambias de página)
function detenerVerificacionAutomatica() {
    if (intervalVerificacion) {
        clearInterval(intervalVerificacion);
        intervalVerificacion = null;
        console.log('⏸️ Verificación automática detenida');
    }
}







/*-------------------------------------------------------------------------------------------*/
function renderizarSolicitudesSimples(solicitudes) {
    const lista = document.getElementById('solicitudesAdminLista');
    if (!lista) return;

    if (!solicitudes || solicitudes.length === 0) {
        lista.innerHTML = '<div class="no-solicitudes-admin"><p>No hay solicitudes</p></div>';
        lista.style.display = 'block';
        return;
    }

    let html = '<div class="solicitudes-simples">';
    
    solicitudes.forEach(s => {
        const fecha = s.fecha_solicitud ? new Date(s.fecha_solicitud).toLocaleDateString() : 'N/A';
        const tipo = s.tipo === 'juntas' ? 'Juntas' : s.tipo === 'extraordinaria' ? 'Extraordinaria' : 'Ordinaria';
        
        const tipoRecurso = s.recurso_tipo === 'papeleria' ? 'Papelería' : 'Insumos';
        const claseRecurso = s.recurso_tipo || 'insumo';
        
        html += `
            <div class="solicitud-simple-card" onclick="abrirModalRevision('${s.id}')">
                <div class="solicitud-header">
                    <span class="solicitud-id">#${s.id.substring(0, 8)}</span>
                    <span class="recurso-badge recurso-${claseRecurso}">${tipoRecurso}</span>
                    <span class="solicitud-tipo ${s.tipo}">${tipo}</span>
                </div>
                <div class="solicitud-body">
                    <p class="solicitud-estado estado-${s.estado}">${s.estado}</p>
                    <p class="solicitud-fecha">${fecha}</p>
                    <p class="solicitud-items">${s.total_items || 0} items</p>
                </div>
                <div class="solicitud-footer">
                    <span class="token-indicator ${s.token_usado ? 'used' : 'available'}">
                        ${s.token_usado ? '🔴 Token usado' : '🟢 Token disponible'}
                    </span>
                </div>
            </div>
        `;
    });

    html += '</div>';
    lista.innerHTML = html;
    lista.style.display = 'block';
}

function mostrarLoadingAdmin(show) {
    const loading = document.getElementById('loadingAdmin');
    const lista = document.getElementById('solicitudesAdminLista');

    if (loading) loading.style.display = show ? 'block' : 'none';
    if (lista) lista.style.display = show ? 'none' : 'block';
}

function mostrarErrorAdmin(mensaje) {
    const lista = document.getElementById('solicitudesAdminLista');
    if (lista) {
        lista.innerHTML = `
            <div class="error-admin">
                <p>${mensaje}</p>
                <button onclick="cargarTodasLasSolicitudes()" class="btn-admin-primary">Reintentar</button>
            </div>
        `;
        lista.style.display = 'block';
    }
}

// ===================================
// MODAL DE REVISIÓN
// ===================================
async function abrirModalRevision(solicitudId) {
    try {
        console.log('📋 Abriendo modal para solicitud:', solicitudId);

        // Llamar al endpoint específico para obtener detalle completo
        const response = await fetch(`http://11.254.27.18/insumos/api/endpoints/admin.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                action: 'get-solicitud-detalle',
                solicitud_id: solicitudId
            })
        });

        const result = await response.json();
        
        if (!result.success || !result.data) {
            showNotificationAdmin('Solicitud no encontrada', 'error');
            return;
        }

        const solicitud = result.data;

        const modalContent = `
            <div class="revision-completa">
                <!-- Información del solicitante -->
                <div class="usuario-info">
                    <h4>👤 Solicitud de: ${solicitud.usuario_nombre || 'N/A'}</h4>
                    <p><strong>Área:</strong> ${solicitud.usuario_departamento || 'N/A'}</p>
                    <p><strong>Fecha:</strong> ${new Date(solicitud.fecha_solicitud).toLocaleDateString()}</p>
                </div>

                ${solicitud.estado === 'cerrado' && solicitud.admin_nombre ? `
                    <div class="admin-info" style="background: #e8f5e8; padding: 0.5rem; border-radius: 6px; margin: 0.5rem 0;">
                        <p><strong>✅ Cerrada por:</strong> ${solicitud.admin_nombre}</p>
                        ${solicitud.fecha_cerrado ? `<p><strong>📅 Fecha de cierre:</strong> ${new Date(solicitud.fecha_cerrado).toLocaleDateString()}</p>` : ''}
                    </div>
                ` : ''}

                <!-- Detalles del ticket -->
                <div class="ticket-info">
                    <h4>🎫 Detalles del ticket</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div><strong>ID:</strong> ${solicitud.id.substring(0, 8)}</div>
                        <div><strong>Tipo:</strong> ${solicitud.tipo}</div>
                        <div><strong>Estado:</strong> 
                            <select id="nuevoEstado" style="margin-left: 0.5rem;">
                                <option value="pendiente" ${solicitud.estado === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                                <option value="en_revision" ${solicitud.estado === 'en_revision' ? 'selected' : ''}>👀 En Revisión</option>
                                <option value="cerrado" ${solicitud.estado === 'cerrado' ? 'selected' : ''}>✅ Cerrado</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Items solicitados -->
                <div class="insumos-solicitados">
                    <h4>📦 ${solicitud.recurso_tipo === 'papeleria' ? 'Papelería solicitada' : 'Insumos solicitados'}</h4>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
                        <thead>
                            <tr style="background: #f8f9fa; text-align: left;">
                                <th style="padding: 0.5rem; border: 1px solid #ddd;">Nombre del producto</th>
                                <th style="padding: 0.5rem; border: 1px solid #ddd;">Cantidad solicitada</th>
                                <th style="padding: 0.5rem; border: 1px solid #ddd;">En inventario</th>
                                <th style="padding: 0.5rem; border: 1px solid #ddd;">Cantidad aprobada</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(solicitud.solicitud_detalles || []).map((detalle) => {
                                const nombreItem = detalle.nombre || 'N/A';
                                const stockActual = detalle.stock_actual || 0;
                                
                                return `
                                <tr>
                                    <td style="padding: 0.5rem; border: 1px solid #ddd;">
                                        <strong>${nombreItem}</strong>
                                    </td>
                                    <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">
                                        ${detalle.cantidad_solicitada}
                                    </td>
                                    <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">
                                        <span style="color: ${stockActual >= detalle.cantidad_solicitada ? 'green' : 'red'};">
                                            ${stockActual >= detalle.cantidad_solicitada ? '✓' : '⚠️'}
                                        </span> ${stockActual}
                                    </td>
                                    <td style="padding: 0.5rem; border: 1px solid #ddd;">
                                        <input type="number" 
                                            id="cantidad-${detalle.id}" 
                                            value="${detalle.cantidad_aprobada || Math.min(detalle.cantidad_solicitada, stockActual)}" 
                                            min="0" 
                                            max="${stockActual}"
                                            style="width: 80px; padding: 0.25rem; border: 1px solid #ddd; border-radius: 4px;"
                                            onchange="validarStock(this, ${stockActual})">
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                ${solicitud.datos_junta ? `
                    <div class="junta-info">
                        <h4>📅 Información del Evento</h4>
                        <p><strong>Fecha:</strong> ${solicitud.datos_junta.fecha_evento}</p>
                        <p><strong>Hora:</strong> ${solicitud.datos_junta.hora_evento}</p>
                        <p><strong>Participantes:</strong> ${solicitud.datos_junta.num_participantes}</p>
                        <p><strong>Ubicación:</strong> ${solicitud.datos_junta.sala_ubicacion}</p>
                        ${solicitud.datos_junta.descripcion ? `<p><strong>Descripción:</strong> ${solicitud.datos_junta.descripcion}</p>` : ''}
                    </div>
                ` : ''}

                <!-- Acciones -->
                <div class="acciones-ticket">
                    <button class="btn-admin-primary" onclick="guardarCambiosCompletos('${solicitud.id}')">
                        💾 Guardar Cambios
                    </button>
                    <button class="btn-admin-secondary" onclick="cerrarModalRevision()">
                        ❌ Cerrar
                    </button>
                </div>
            </div>
        `;

        document.getElementById('detallesSolicitud').innerHTML = modalContent;
        document.getElementById('modalRevision').style.display = 'flex';

        if (solicitud.estado === 'cerrado') {
            setTimeout(() => {
                document.querySelectorAll('[id^="cantidad-"]').forEach(input => {
                    input.disabled = true;
                    input.style.backgroundColor = '#f5f5f5';
                    input.title = 'No se pueden modificar cantidades de tickets cerrados';
                });
                document.getElementById('nuevoEstado').disabled = true;
            }, 100);
        }

    } catch (error) {
        console.error('❌ Error abriendo modal:', error);
        showNotificationAdmin('Error al cargar detalles', 'error');
    }
}

function cerrarModalRevision() {
    document.getElementById('modalRevision').style.display = 'none';
}

// ===================================
// GUARDAR CAMBIOS
// ===================================

async function guardarCambiosCompletos(solicitudId) {
    try {
        const nuevoEstado = document.getElementById('nuevoEstado').value;

        // Verificar estado actual
        const responseCheck = await fetch('http://11.254.27.18/insumos/api/endpoints/admin.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                action: 'get-solicitud-detalle',
                solicitud_id: solicitudId
            })
        });

        const resultCheck = await responseCheck.json();
        if (!resultCheck.success) throw new Error('No se pudo verificar el estado actual');
        
        const solicitudActual = resultCheck.data;
        const yaEstabaCerrado = solicitudActual.estado === 'cerrado';
        const ahoraSeraCerrado = nuevoEstado === 'cerrado';

        // 1. Actualizar estado de la solicitud
        const updateData = {
            estado: nuevoEstado,
            admin_asignado: ahoraSeraCerrado ? currentAdmin.id : null
        };

        if (nuevoEstado === 'en_revision') {
            updateData.fecha_revision = new Date().toISOString();
        }
        if (nuevoEstado === 'cerrado') {
            updateData.fecha_cerrado = new Date().toISOString();
        }

        const responseSolicitud = await fetch('http://11.254.27.18/insumos/api/endpoints/admin.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                action: 'update-solicitud',
                solicitud_id: solicitudId,
                data: updateData
            })
        });

        const resultSolicitud = await responseSolicitud.json();
        if (!resultSolicitud.success) throw new Error(resultSolicitud.error || 'Error actualizando solicitud');

        // 2. Actualizar cantidades aprobadas
        const detalles = document.querySelectorAll('[id^="cantidad-"]');
        for (const input of detalles) {
            if (!input.disabled) {
                const detalleId = parseInt(input.id.replace('cantidad-', ''));
                const cantidadAprobada = parseInt(input.value) || 0;

                const responseDetalle = await fetch('http://11.254.27.18/insumos/api/endpoints/admin.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        action: 'update-detalle',
                        detalle_id: detalleId,
                        cantidad_aprobada: cantidadAprobada
                    })
                });

                const resultDetalle = await responseDetalle.json();
                if (!resultDetalle.success) {
                    console.error('Error actualizando detalle:', resultDetalle.error);
                }
            }
        }

        // 3. Descontar inventario si se cerró el ticket
        if (ahoraSeraCerrado && !yaEstabaCerrado) {
            const responseInventario = await fetch('http://11.254.27.18/insumos/api/endpoints/admin.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'descontar-inventario',
                    solicitud_id: solicitudId
                })
            });

            const resultInventario = await responseInventario.json();
            if (!resultInventario.success) {
                throw new Error('Error descontando inventario: ' + resultInventario.error);
            }
            
            showNotificationAdmin('Ticket cerrado e inventario actualizado', 'success');
        } else {
            showNotificationAdmin('Cambios guardados exitosamente', 'success');
        }

        cerrarModalRevision();
        recargarSolicitudes();

    } catch (error) {
        console.error('❌ Error guardando:', error);
        showNotificationAdmin('Error al guardar cambios: ' + error.message, 'error');
    }
}

async function descontarInventarioCompleto(solicitudId) {
    try {
        console.log('🔄 Descontando inventario para solicitud:', solicitudId);
        
        // Obtener la solicitud con tipo de recurso y detalles
        const { data: solicitud, error } = await apiAdmin
            .from('solicitudes')
            .select('*')
            .eq('id', solicitudId)
            .single();

        if (error) throw error;

        const detalles = solicitud.solicitud_detalles || [];

        for (const detalle of detalles) {
            const cantidadAprobada = detalle.cantidad_aprobada || 0;
            
            if (cantidadAprobada > 0) {
                // Determinar si es insumo o papelería
                const esInsumo = detalle.insumo_id != null;
                const tabla = esInsumo ? 'insumos' : 'papeleria';
                const itemId = esInsumo ? detalle.insumo_id : detalle.papeleria_id;

                // Obtener stock actual
                const { data: itemActual, error: getError } = await apiAdmin
                    .from(tabla)
                    .select('*')
                    .eq('id', itemId)
                    .single();

                if (getError) throw getError;

                const stockAnterior = itemActual.stock_actual;
                const stockNuevo = stockAnterior - cantidadAprobada;

                // Actualizar stock
                const { error: updateError } = await apiAdmin
                    .from(tabla)
                    .update({ stock_actual: stockNuevo })
                    .eq('id', itemId);

                if (updateError) throw updateError;

                // Registrar movimiento
                const movimientoData = {
                    tipo_movimiento: 'entrega',
                    cantidad: -cantidadAprobada,
                    stock_anterior: stockAnterior,
                    stock_nuevo: stockNuevo,
                    motivo: 'Entrega por solicitud cerrada',
                    referencia_id: solicitudId,
                    admin_id: currentAdmin.id
                };

                if (esInsumo) {
                    movimientoData.insumo_id = itemId;
                    movimientoData.papeleria_id = null;
                } else {
                    movimientoData.papeleria_id = itemId;
                    movimientoData.insumo_id = null;
                }

                const { error: movError } = await apiAdmin
                    .from('inventario_movimientos')
                    .insert(movimientoData);

                if (movError) throw movError;

                console.log(`✅ ${tabla} ${itemId}: ${stockAnterior} → ${stockNuevo} (-${cantidadAprobada})`);
            }
        }
        
        console.log('✅ Inventario descontado exitosamente');
        
    } catch (error) {
        console.error('❌ Error descontando inventario:', error);
        throw error;
    }
}

function validarStock(input, stockDisponible) {
    const cantidad = parseInt(input.value) || 0;
    if (cantidad > stockDisponible) {
        input.style.borderColor = 'red';
        showNotificationAdmin(`No hay suficiente stock. Disponible: ${stockDisponible}`, 'warning');
        input.value = stockDisponible;
    } else {
        input.style.borderColor = '#ddd';
    }
}
function showNotification(message, type = 'info', duration = 3000) {
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
        display: flex;
        align-items: center;
        gap: 0.75rem;
    `;

    // Colores según el tipo
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

    // Icono según el tipo
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    notification.innerHTML = `
        <span style="font-size: 1.2rem;">${icons[type] || icons.info}</span>
        <span style="flex: 1;">${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; opacity: 0.7; padding: 0;">×</button>
    `;

    document.body.appendChild(notification);

    // Auto-remove
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }

    return notification;
}

async function procesarRenovacionMensual() {
    try {
        console.log('Iniciando proceso de renovación mensual...');

        // Llamar al endpoint que hace todo el proceso
        const response = await fetch('http://11.254.27.18/insumos/api/endpoints/renovacion-mensual.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                action: 'ejecutar-proceso'
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Error en el proceso');
        }

        console.log('Proceso completado:', result.data);
        return true;

    } catch (error) {
        console.error('Error en proceso mensual:', error);
        return false;
    }
}

window.ejecutarProcesoMensual = async function () {
    const resultado = await procesarRenovacionMensual();
    if (resultado) {
        showNotification('Proceso de renovación mensual completado exitosamente', 'success');
        setTimeout(() => window.location.reload(), 2000);
    } else {
        showNotification('Error en el proceso de renovación mensual', 'error');
    }
};


// ===================================
// FILTRADO
// ===================================

function filtrarSolicitudesAdmin() {
    const filtroEstado = document.getElementById('filtroEstadoAdmin');
    const filtroTipo = document.getElementById('filtroTipoAdmin');
    const filtroRecurso = document.getElementById('filtroRecurso');

    if (!filtroEstado || !filtroTipo) return;

    const estado = filtroEstado.value;
    const tipo = filtroTipo.value;
    const recurso = filtroRecurso ? filtroRecurso.value : '';

    solicitudesFiltradas = todasLasSolicitudes.filter(s => {
        let match = true;
        if (estado) match = match && s.estado === estado;
        if (tipo) match = match && s.tipo === tipo;
        if (recurso && recurso !== 'todos') match = match && (s.recurso_tipo || 'insumo') === recurso;
        return match;
    });

    renderizarSolicitudesSimples(solicitudesFiltradas);
}

function recargarSolicitudes() {
    cargarTodasLasSolicitudes();
}

// ===================================
// ESTADÍSTICAS
// ===================================

function actualizarEstadisticasAdmin(solicitudes) {
    if (!solicitudes) return;

    const stats = {
        pendientes: solicitudes.filter(s => s.estado === 'pendiente').length,
        revision: solicitudes.filter(s => s.estado === 'en_revision').length,
        cerradas: solicitudes.filter(s => s.estado === 'cerrado').length,
        total: solicitudes.length
    };

    const updateElement = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    updateElement('totalPendientes', stats.pendientes);
    updateElement('totalRevision', stats.revision);
    updateElement('totalCerradas', stats.cerradas);
    updateElement('totalItems', stats.total);
}



async function procesarRenovacionMensual() {
    try {
        console.log('Iniciando proceso de renovación mensual...');

        const response = await fetch('http://11.254.27.18/insumos/api/endpoints/renovacion-mensual.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                action: 'ejecutar-proceso'
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Error en el proceso');
        }

        console.log('Proceso completado:', result.data);

        // Mostrar resumen del proceso
        const stats = result.data.estadisticas;
        let mensaje = `✅ PROCESO DE RENOVACIÓN MENSUAL COMPLETADO\n\n`;
        mensaje += `📊 RESUMEN:\n`;
        mensaje += `• Total de usuarios procesados: ${stats.total_usuarios}\n\n`;
        
        mensaje += `🥤 TOKENS DE INSUMOS:\n`;
        mensaje += `  ✅ Renovados: ${stats.insumos_renovados}\n`;
        mensaje += `  ❌ NO renovados: ${stats.insumos_no_renovados}\n\n`;
        
        mensaje += `📄 TOKENS DE PAPELERÍA ORDINARIA:\n`;
        mensaje += `  ✅ Renovados: ${stats.papeleria_ord_renovados}\n`;
        mensaje += `  ❌ NO renovados: ${stats.papeleria_ord_no_renovados}\n\n`;
        
        mensaje += `📋 TOKENS DE PAPELERÍA EXTRAORDINARIA:\n`;
        mensaje += `  ✅ Renovados: ${stats.papeleria_ext_renovados}\n`;
        mensaje += `  ❌ NO renovados: ${stats.papeleria_ext_no_renovados}\n`;

        if (result.data.advertencias && result.data.advertencias.length > 0) {
            mensaje += `\n⚠️ ADVERTENCIAS:\n`;
            result.data.advertencias.forEach(adv => {
                mensaje += `• ${adv}\n`;
            });
        }

        // Mostrar detalles en consola
        console.log('\n📋 DETALLE POR USUARIO:');
        console.table(result.data.resultados.map(r => ({
            Usuario: r.username,
            Nombre: r.nombre,
            'Token Insumo': r.detalle.insumo.renovado ? '✅' : '❌',
            'Razón Insumo': r.detalle.insumo.razon,
            'Token Pap.Ord': r.detalle.papeleria_ordinario.renovado ? '✅' : '❌',
            'Razón Pap.Ord': r.detalle.papeleria_ordinario.razon,
            'Token Pap.Ext': r.detalle.papeleria_extraordinario.renovado ? '✅' : '❌',
            'Razón Pap.Ext': r.detalle.papeleria_extraordinario.razon
        })));

        alert(mensaje);
        return true;

    } catch (error) {
        console.error('Error en proceso mensual:', error);
        alert('❌ Error en el proceso: ' + error.message);
        return false;
    }
}

window.ejecutarProcesoMensual = async function () {
    const confirmar = confirm(
        '🔄 PROCESO DE RENOVACIÓN MENSUAL\n\n' +
        '⚠️ REGLA IMPORTANTE:\n' +
        'TODOS los tokens (insumos y papelería) solo se renovarán\n' +
        'si el usuario marcó "recibido" en sus solicitudes del mes anterior.\n\n' +
        '¿Deseas continuar?'
    );
    
    if (!confirmar) return;

    const resultado = await procesarRenovacionMensual();
    if (resultado) {
        showNotification('Proceso de renovación mensual completado exitosamente', 'success');
        setTimeout(() => window.location.reload(), 4000);
    } else {
        showNotification('Error en el proceso de renovación mensual', 'error');
    }
};


// ===================================
// NOTIFICACIONES
// ===================================

function showNotificationAdmin(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ffebee' : type === 'warning' ? '#fff3e0' : '#e8f5e8'};
        color: ${type === 'error' ? '#c62828' : type === 'warning' ? '#e65100' : '#2e7d32'};
        padding: 12px 16px;
        border-radius: 4px;
        border: 1px solid ${type === 'error' ? '#ef5350' : type === 'warning' ? '#ff9800' : '#66bb6a'};
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, duration);
}

// ===================================
// HEADER Y FOOTER
// ===================================

function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        const isVisible = dropdown.style.display !== 'none';
        dropdown.style.display = isVisible ? 'none' : 'block';
    }
}

function logout() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

function inicializarHeaderAdmin() {
    const session = sessionStorage.getItem('currentUser');
    if (session) {
        try {
            const user = JSON.parse(session);

            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = user.nombre;
            }

            if (user.rol !== 'super_admin') {
                const inventarioLink = document.getElementById('inventarioLink');
                if (inventarioLink) {
                    inventarioLink.style.display = 'none';
                }
            }

            console.log('✅ Header administrativo inicializado para:', user.nombre);

        } catch (error) {
            console.error('Error inicializando header admin:', error);
        }
    }
}

document.addEventListener('click', function (e) {
    if (!e.target.closest('.user-menu') && !e.target.closest('.user-dropdown')) {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }
});

async function cargarHeaderAdmin() {
    try {
        const response = await fetch('includes/headerAdmin.html');
        if (!response.ok) throw new Error('Error cargando header');

        const html = await response.text();
        const headerContainer = document.getElementById('header-container');

        if (headerContainer) {
            headerContainer.innerHTML = html;
            console.log('✅ Header administrativo cargado');
            setTimeout(inicializarHeaderAdmin, 100);
        }
    } catch (error) {
        console.error('Error cargando header administrativo:', error);
    }
}

async function cargarFooter() {
    try {
        const response = await fetch('includes/footerAdmin.html');
        if (!response.ok) throw new Error('Error cargando footer');

        const html = await response.text();
        const footerContainer = document.getElementById('footer-container');

        if (footerContainer) {
            footerContainer.innerHTML = html;
            console.log('✅ Footer cargado correctamente');
        }
    } catch (error) {
        console.error('Error cargando footer:', error);
    }
}

// ===================================
// MANEJO DE ERRORES
// ===================================

window.addEventListener('error', function (e) {
    console.error('Error global:', e.error);
    showNotificationAdmin('Error en la aplicación', 'error');
});


// ===================================
// LIMPIAR FILTROS
// ===================================
function limpiarFiltros() {
    // Resetear los selectores de filtro
    const filtroEstado = document.getElementById('filtroEstadoAdmin');
    const filtroTipo = document.getElementById('filtroTipoAdmin');
    const filtroRecurso = document.getElementById('filtroRecurso');
    
    if (filtroEstado) filtroEstado.value = '';
    if (filtroTipo) filtroTipo.value = '';
    if (filtroRecurso) filtroRecurso.value = 'todos';
    
    // Mostrar todas las solicitudes sin filtros
    solicitudesFiltradas = [...todasLasSolicitudes];
    renderizarSolicitudesSimples(solicitudesFiltradas);
    
    // Notificación
    showNotificationAdmin('Filtros limpiados - Mostrando todas las solicitudes', 'success');
    
    console.log('✅ Filtros limpiados');
}

console.log('✅ admin.js migrado cargado correctamente - Usando API Local');
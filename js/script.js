/* ===================================
   SISTEMA SOLICITUDES DE INSUMOS - SCRIPT.JS
   Sistema de gestión de solicitudes
   =================================== */

// ===================================
// CONFIGURACIÓN GLOBAL
// ===================================
const APP_CONFIG = {
    name: 'Sistema de Solicitudes de Insumos',
    version: '1.0.0',
    description: 'Plataforma digital para gestión de solicitudes',
    company: 'Empresa Corporativa',
    email: 'soporte@empresa.com',
    phone: '+52 55 1234 5678'
};

// Variables globales
let currentUser = {
    name: 'Usuario Actual',
    email: 'usuario@empresa.com',
    department: 'Administración',
    avatar: null
};

let solicitudes = JSON.parse(localStorage.getItem('solicitudes')) || [];
let currentSolicitudType = '';

// Variables globales para carrito
let categorias = [];
let insumos = [];
let carritoItems = [];


// Configuración Supabase
const supabase = window.supabase.createClient(
    'https://nxuvisaibpmdvraybzbm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54dXZpc2FpYnBtZHZyYXliemJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4OTMxNjQsImV4cCI6MjA3MTQ2OTE2NH0.OybYM_E3mWsZym7mEf-NiRtrG0svkylXx_q8Tivonfg'
);

// Función para verificar token disponible
function verificarTokenDisponible() {
    const session = sessionStorage.getItem('currentUser');
    if (!session) return false;

    try {
        const user = JSON.parse(session);
        return user.token_disponible === 1;
    } catch (error) {
        console.error('Error verificando token:', error);
        return false;
    }
}

// Función para cargar datos del carrito
async function cargarDatosCarrito() {
    try {
        console.log('Cargando categorías e insumos...');

        // Cargar categorías
        const { data: categoriasFromDB, error: catError } = await supabase
            .from('categorias_insumos')
            .select('*')
            .eq('activo', true)
            .order('orden');

        if (catError) throw catError;

        // Determinar qué insumos puede ver el usuario
        const session = sessionStorage.getItem('currentUser');
        const user = JSON.parse(session);

        const departamentosConAccesoCompleto = [
            'Dirección Jurídica',
            'Coordinación Administrativa'
        ];

        let insumosQuery = supabase
            .from('insumos')
            .select('*')
            .eq('activo', true);

        // Filtrar por acceso si no es coordinación privilegiada
        if (!departamentosConAccesoCompleto.includes(user.departamento)) {
            insumosQuery = insumosQuery.eq('acceso_tipo', 'todos');
        }
        // SI ES usuario privilegiado: ver 'todos' Y 'solo_direccion', pero NO 'ninguno'
        else {
            insumosQuery = insumosQuery.neq('acceso_tipo', 'ninguno');
        }

        const { data: insumosFromDB, error: insError } = await insumosQuery.order('nombre');

        if (insError) throw insError;

        // Guardar datos globalmente
        categorias = categoriasFromDB;
        insumos = insumosFromDB;

        // Renderizar interfaz
        renderizarCategorias();
        renderizarInsumos(categorias[0]?.id || 1);

    } catch (error) {
        console.error('Error cargando datos del carrito:', error);
        showNotification('Error cargando datos. Intenta nuevamente.', 'error');
    }
}

/*// Actualizar información del usuario en el modal
function actualizarInfoUsuarioModal() {
    const session = sessionStorage.getItem('currentUser');
    if (!session) return;

    try {
        const user = JSON.parse(session);

        // Actualizar nombre del usuario
        const usuarioNombre = document.querySelector('.usuario-nombre');
        if (usuarioNombre) {
            usuarioNombre.textContent = user.nombre;
        }

        // Actualizar departamento
        const usuarioDepto = document.querySelector('.usuario-depto');
        if (usuarioDepto) {
            usuarioDepto.textContent = user.departamento;
        }

        // Actualizar token status
        const tokenStatus = document.getElementById('tokenStatus');
        if (tokenStatus) {
            tokenStatus.textContent = user.token_disponible;
        }

    } catch (error) {
        console.error('Error actualizando info del usuario:', error);
    }
}*/

// Modificar la función para recibir parámetros
function actualizarInfoUsuarioModal(tipoSolicitud = null) {
    const session = sessionStorage.getItem('currentUser');
    if (!session) return;

    try {
        const user = JSON.parse(session);

        // Actualizar nombre del usuario
        const usuarioNombre = document.querySelector('.usuario-nombre');
        if (usuarioNombre) {
            usuarioNombre.textContent = user.nombre;
        }

        // Actualizar departamento
        const usuarioDepto = document.querySelector('.usuario-depto');
        if (usuarioDepto) {
            usuarioDepto.textContent = user.departamento;
        }

        // CAMBIAR: Actualizar token según el tipo de solicitud
        const tokenStatus = document.getElementById('tokenStatus');
        if (tokenStatus) {
            let tokenValue = 1;
            let tokenLabel = 'Token disponible:';

            if (tipoSolicitud) {
                if (tipoSolicitud) {
                    if (tipoSolicitud.includes('extraordinaria')) {
                        tokenValue = user.token_papeleria_extraordinario;
                        tokenLabel = 'Token extraordinario:';
                    } else if (tipoSolicitud.includes('ordinaria') && recursoActual === 'insumo') {
                        tokenValue = user.token_disponible;
                        tokenLabel = 'Token insumos:';
                    } else if (tipoSolicitud.includes('ordinaria') && recursoActual === 'papeleria') {
                        tokenValue = user.token_papeleria_ordinario;
                        tokenLabel = 'Token ordinario:';
                    } else if (tipoSolicitud.includes('juntas')) {
                        tokenLabel = 'Sin token requerido';
                        tokenValue = '✓';
                    }
                }
            } else {
                tokenValue = user.token_disponible;
            }

            // Actualizar label también
            const tokenLabelElement = document.querySelector('.token-label');
            if (tokenLabelElement) {
                tokenLabelElement.textContent = tokenLabel;
            }

            tokenStatus.textContent = tokenValue;
        }

    } catch (error) {
        console.error('Error actualizando info del usuario:', error);
    }
}

// Renderizar pestañas de categorías
function renderizarCategorias() {
    const container = document.getElementById('categoriasTabsContainer');
    if (!container) return;

    let html = '';
    categorias.forEach((categoria, index) => {
        const isActive = index === 0 ? 'active' : '';
        html += `
            <button class="categoria-tab ${isActive}" 
                    data-categoria="${categoria.id}" 
                    onclick="cambiarCategoria(${categoria.id})"
                    style="border-color: ${categoria.color}">
                <span class="categoria-icon">${categoria.icono}</span>
                <span class="categoria-nombre">${categoria.nombre}</span>
            </button>
        `;
    });

    container.innerHTML = html;
}

// Renderizar insumos de una categoría
function renderizarInsumos(categoriaId) {
    const container = document.getElementById('insumosListaContainer');
    if (!container) return;

    const insumosFiltrados = insumos.filter(insumo => insumo.categoria_id === categoriaId);

    let html = '';
    insumosFiltrados.forEach(insumo => {
        html += `
            <div class="insumo-item" data-insumo="${insumo.id}">
                <div class="insumo-info">
                    <span class="insumo-nombre">${insumo.nombre}</span>
                    <span class="insumo-unidad">${insumo.unidad_medida}</span>
                </div>
                <div class="insumo-controls">
                    <button class="btn-cantidad" onclick="cambiarCantidad(${insumo.id}, -1)">-</button>
                    <span class="cantidad-display" id="cantidad-${insumo.id}">0</span>
                    <button class="btn-cantidad" onclick="cambiarCantidad(${insumo.id}, 1)">+</button>
                    <button class="btn-agregar" onclick="agregarAlCarrito(${insumo.id})">Agregar</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html || '<p class="no-insumos">No hay insumos en esta categoría</p>';
}

// Cambiar de categoría
function cambiarCategoria(categoriaId) {
    // Actualizar tabs activos
    document.querySelectorAll('.categoria-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-categoria="${categoriaId}"]`).classList.add('active');

    // Renderizar insumos de la nueva categoría
    renderizarInsumos(categoriaId);
}


// Variables para cantidades temporales
let cantidadesTemp = {};

// Cambiar cantidad de un insumo
function cambiarCantidad(insumoId, cambio) {
    const actual = cantidadesTemp[insumoId] || 0;
    const nueva = Math.max(0, Math.min(100, actual + cambio));

    cantidadesTemp[insumoId] = nueva;

    const display = document.getElementById(`cantidad-${insumoId}`);
    if (display) {
        display.textContent = nueva;
    }

    // Warning para cantidades altas
    if (nueva > 50) {
        display.style.color = '#e74c3c';
        display.title = 'Cantidad alta - puede que no se entregue completa';
    } else {
        display.style.color = '';
        display.title = '';
    }
}

// Agregar insumo al carrito
function agregarAlCarrito(insumoId) {
    const cantidad = cantidadesTemp[insumoId] || 0;

    if (cantidad === 0) {
        showNotification('Selecciona una cantidad mayor a 0', 'warning');
        return;
    }

    const insumo = insumos.find(i => i.id === insumoId);
    if (!insumo) return;

    // Verificar si ya está en el carrito
    const existingIndex = carritoItems.findIndex(item => item.insumo_id === insumoId);

    if (existingIndex >= 0) {
        // Actualizar cantidad
        carritoItems[existingIndex].cantidad = cantidad;
    } else {
        // Agregar nuevo item
        carritoItems.push({
            insumo_id: insumoId,
            nombre: insumo.nombre,
            cantidad: cantidad,
            unidad_medida: insumo.unidad_medida
        });
    }

    // Limpiar cantidad temporal
    cantidadesTemp[insumoId] = 0;
    const display = document.getElementById(`cantidad-${insumoId}`);
    if (display) display.textContent = '0';

    // Actualizar vista del carrito
    actualizarVistaCarrito();

    showNotification(`${insumo.nombre} agregado al carrito`, 'success');
}

// Actualizar vista del carrito
/*function actualizarVistaCarrito() {
    const container = document.getElementById('carritoItems');
    const count = document.getElementById('carritoCount');

    if (carritoItems.length === 0) {
        container.innerHTML = '<p class="carrito-vacio">Agrega insumos a tu carrito</p>';
        count.textContent = '0';
        document.getElementById('btnEnviar').disabled = true;
        return;
    }

    let html = '';
    carritoItems.forEach((item, index) => {
        html += `
            <div class="carrito-item">
                <span class="item-nombre">${item.nombre}</span>
                <span class="item-cantidad">${item.cantidad} ${item.unidad_medida}</span>
                <button class="btn-remove" onclick="removerDelCarrito(${index})">×</button>
            </div>
        `;
    });

    container.innerHTML = html;
    count.textContent = carritoItems.length;
    document.getElementById('btnEnviar').disabled = false;
}*/
// Actualizar vista del carrito
function actualizarVistaCarrito() {
    const container = document.getElementById('carritoItems');
    const count = document.getElementById('carritoCount');
    const btnEnviar = document.getElementById('btnEnviar');

    // Verificar que los elementos existan antes de usarlos
    if (!container || !count || !btnEnviar) {
        console.log('Elementos del carrito no disponibles (modal probablemente cerrado)');
        return; // Salir silenciosamente si el modal no está abierto
    }

    if (carritoItems.length === 0) {
        container.innerHTML = '<p class="carrito-vacio">Agrega insumos a tu carrito</p>';
        count.textContent = '0';
        btnEnviar.disabled = true;
        return;
    }

    let html = '';
    carritoItems.forEach((item, index) => {
        html += `
            <div class="carrito-item">
                <span class="item-nombre">${item.nombre}</span>
                <span class="item-cantidad">${item.cantidad} ${item.unidad_medida}</span>
                <button class="btn-remove" onclick="removerDelCarrito(${index})">×</button>
            </div>
        `;
    });

    container.innerHTML = html;
    count.textContent = carritoItems.length;
    btnEnviar.disabled = false;
}


// Remover del carrito
function removerDelCarrito(index) {
    carritoItems.splice(index, 1);
    actualizarVistaCarrito();
    showNotification('Item removido del carrito', 'info');
}


/*async function enviarSolicitud() {
    if (carritoItems.length === 0) {
        showNotification('Agrega al menos un insumo al carrito', 'warning');
        return;
    }

    try {
        const session = sessionStorage.getItem('currentUser');
        const user = JSON.parse(session);

        // Preparar datos de la solicitud
        let datosJunta = null;

        // Si es solicitud de juntas, capturar campos específicos
        if (currentSolicitudType === 'juntas') {
            const fechaEvento = document.getElementById('fechaEvento').value;
            const horaEvento = document.getElementById('horaEvento').value;
            const numParticipantes = document.getElementById('numParticipantes').value;
            const salaEvento = document.getElementById('salaEvento').value;
            const descripcionEvento = document.getElementById('descripcionEvento').value;

            // Validar campos requeridos para juntas
            if (!fechaEvento || !horaEvento || !numParticipantes || !salaEvento) {
                showNotification('Complete todos los campos obligatorios del evento', 'warning');
                return;
            }

            // Validar que la fecha sea futura
            const fechaEventsDateTime = new Date(`${fechaEvento}T${horaEvento}`);
            const ahora = new Date();
            if (fechaEventsDateTime <= ahora) {
                showNotification('La fecha y hora del evento debe ser futura', 'warning');
                return;
            }

            // Preparar objeto JSON para datos_junta
            datosJunta = {
                fecha_evento: fechaEvento,
                hora_evento: horaEvento,
                num_participantes: parseInt(numParticipantes),
                sala_ubicacion: salaEvento.trim(),
                descripcion: descripcionEvento.trim() || null,
                fecha_captura: new Date().toISOString()
            };
        }

        // Crear solicitud principal CON datos_junta
        const { data: solicitud, error: solError } = await supabase
            .from('solicitudes')
            .insert({
                usuario_id: user.id,
                tipo: currentSolicitudType,
                estado: 'pendiente',
                total_items: carritoItems.length,
                token_usado: currentSolicitudType === 'ordinaria',
                datos_junta: datosJunta  // LÍNEA NUEVA
            })
            .select()
            .single();

        if (solError) throw solError;

        // Crear detalles de la solicitud
        const detalles = carritoItems.map(item => ({
            solicitud_id: solicitud.id,
            insumo_id: item.insumo_id,
            cantidad_solicitada: item.cantidad
        }));

        const { error: detError } = await supabase
            .from('solicitud_detalles')
            .insert(detalles);

        if (detError) throw detError;

        // Actualizar token si es solicitud ordinaria
        if (currentSolicitudType === 'ordinaria') {
            await supabase
                .from('usuarios')
                .update({ token_disponible: 0 })
                .eq('id', user.id);
        }

        // Actualizar sesión local después de consumir token
        if (currentSolicitudType === 'ordinaria') {
            // Actualizar sesión local
            user.token_disponible = 0;
            sessionStorage.setItem('currentUser', JSON.stringify(user));

            // Actualizar vista del token en modal
            const tokenStatus = document.getElementById('tokenStatus');
            if (tokenStatus) {
                tokenStatus.textContent = '0';
                tokenStatus.style.color = '#e74c3c';
            }

            // Deshabilitar botón de solicitud ordinaria en dashboard
            setTimeout(() => {
                const btnOrdinaria = document.querySelector('[data-type="ordinaria"] .btn-solicitar');
                if (btnOrdinaria) {
                    btnOrdinaria.textContent = 'Token Agotado';
                    btnOrdinaria.disabled = true;
                    btnOrdinaria.style.background = '#ccc';
                    btnOrdinaria.style.cursor = 'not-allowed';
                }

                // Agregar mensaje visual en la card
                const cardOrdinaria = document.querySelector('[data-type="ordinaria"]');
                if (cardOrdinaria) {
                    cardOrdinaria.style.opacity = '0.6';
                    const cardContent = cardOrdinaria.querySelector('.card-content p');
                    if (cardContent) {
                        cardContent.textContent = 'Token usado este mes';
                        cardContent.style.color = '#e74c3c';
                    }
                }
            }, 100);
        }

        // Mostrar notificación de éxito
        showNotification('Solicitud enviada exitosamente', 'success');

        // Limpiar carrito
        carritoItems = [];
        cantidadesTemp = {};
        actualizarVistaCarrito();

        setTimeout(() => cerrarModal(), 2000);

    } catch (error) {
        console.error('Error enviando solicitud:', error);
        showNotification('Error enviando solicitud. Intenta nuevamente.', 'error');
    }
}*/

async function enviarSolicitud() {
    if (carritoItems.length === 0) {
        showNotification('Agrega al menos un insumo al carrito', 'warning');
        return;
    }

    try {
        const session = sessionStorage.getItem('currentUser');
        const user = JSON.parse(session);

        // NUEVO: Función para normalizar el tipo de solicitud
        function normalizarTipoSolicitud(tipo) {
            if (tipo.includes('ordinaria')) return 'ordinaria';
            if (tipo.includes('extraordinaria')) return 'extraordinaria';
            if (tipo.includes('juntas')) return 'juntas';
            return tipo;
        }

        // NUEVO: Determinar qué token se usará y actualizará
        const tipoNormalizado = normalizarTipoSolicitud(currentSolicitudType);
        let tokenTipoUsado = 'ninguno';
        let consumeToken = false;

        if (tipoNormalizado === 'ordinaria') {
            if (recursoActual === 'insumo') {
                tokenTipoUsado = 'ordinario';
                consumeToken = true;
            } else if (recursoActual === 'papeleria') {
                tokenTipoUsado = 'ordinario';
                consumeToken = true;
            }
        } else if (tipoNormalizado === 'extraordinaria') {
            tokenTipoUsado = 'extraordinario';
            consumeToken = true;
        }

        // Preparar datos de la solicitud
        let datosJunta = null;
        let datosExtraordinaria = null;

        // Si es solicitud de juntas, capturar campos específicos
        if (tipoNormalizado === 'juntas') {
            const fechaEvento = document.getElementById('fechaEvento').value;
            const horaEvento = document.getElementById('horaEvento').value;
            const numParticipantes = document.getElementById('numParticipantes').value;
            const salaEvento = document.getElementById('salaEvento').value;
            const descripcionEvento = document.getElementById('descripcionEvento').value;

            // Validar campos requeridos para juntas
            if (!fechaEvento || !horaEvento || !numParticipantes || !salaEvento) {
                showNotification('Complete todos los campos obligatorios del evento', 'warning');
                return;
            }

            // Validar que la fecha sea futura
            const fechaEventsDateTime = new Date(`${fechaEvento}T${horaEvento}`);
            const ahora = new Date();
            if (fechaEventsDateTime <= ahora) {
                showNotification('La fecha y hora del evento debe ser futura', 'warning');
                return;
            }

            // Preparar objeto JSON para datos_junta
            datosJunta = {
                fecha_evento: fechaEvento,
                hora_evento: horaEvento,
                num_participantes: parseInt(numParticipantes),
                sala_ubicacion: salaEvento.trim(),
                descripcion: descripcionEvento.trim() || null,
                fecha_captura: new Date().toISOString()
            };
        }

        // NUEVO: Si es solicitud extraordinaria, capturar campos específicos
        if (tipoNormalizado === 'extraordinaria') {
            const motivoExtraordinaria = document.getElementById('motivo-extraordinaria')?.value;
            const fechaNecesidad = document.getElementById('fecha-necesidad')?.value;
            const prioridadExtraordinaria = document.getElementById('prioridad-extraordinaria')?.value;

            // Validar campos requeridos para extraordinaria
            if (!motivoExtraordinaria || !fechaNecesidad) {
                showNotification('Complete todos los campos obligatorios para solicitud extraordinaria', 'warning');
                return;
            }

            // Validar que la fecha de necesidad sea futura
            const fechaNecesidadDate = new Date(fechaNecesidad);
            const ahora = new Date();
            if (fechaNecesidadDate <= ahora) {
                showNotification('La fecha de necesidad debe ser futura', 'warning');
                return;
            }

            // Preparar objeto JSON para datos extraordinaria
            datosExtraordinaria = {
                motivo: motivoExtraordinaria.trim(),
                fecha_necesidad: fechaNecesidad,
                prioridad: prioridadExtraordinaria || 'alta',
                fecha_captura: new Date().toISOString()
            };
        }

        // Crear solicitud principal CON todos los nuevos campos
        const { data: solicitud, error: solError } = await supabase
            .from('solicitudes')
            .insert({
                usuario_id: user.id,
                tipo: tipoNormalizado, // CAMBIADO: Usar tipo normalizado
                recurso_tipo: recursoActual, // NUEVO: Tipo de recurso
                estado: 'pendiente',
                total_items: carritoItems.length,
                token_usado: consumeToken, // CAMBIADO: Basado en lógica nueva
                token_tipo_usado: tokenTipoUsado, // NUEVO: Qué tipo de token se usó
                datos_junta: datosJunta,
                // NUEVO: Agregar datos extraordinaria si aplica
                ...(datosExtraordinaria && { datos_extraordinaria: datosExtraordinaria })
            })
            .select()
            .single();

        if (solError) throw solError;

        // Crear detalles de la solicitud - MODIFICADO para manejar papelería
        const detalles = carritoItems.map(item => {
            const detalle = {
                solicitud_id: solicitud.id,
                cantidad_solicitada: item.cantidad
            };

            // Agregar referencia según el tipo de recurso
            if (recursoActual === 'insumo') {
                detalle.insumo_id = item.insumo_id;
            } else if (recursoActual === 'papeleria') {
                detalle.papeleria_id = item.insumo_id; // Reutilizamos insumo_id para papeleria_id
            }

            return detalle;
        });

        const { error: detError } = await supabase
            .from('solicitud_detalles')
            .insert(detalles);

        if (detError) throw detError;

        // NUEVO: Actualizar tokens según el tipo de solicitud y recurso
        if (consumeToken) {
            const actualizacion = {};

            if (recursoActual === 'insumo' && tipoNormalizado === 'ordinaria') {
                actualizacion.token_disponible = 0;
            } else if (recursoActual === 'papeleria') {
                if (tipoNormalizado === 'ordinaria') {
                    actualizacion.token_papeleria_ordinario = 0;
                } else if (tipoNormalizado === 'extraordinaria') {
                    actualizacion.token_papeleria_extraordinario = 0;
                }
            }

            // Actualizar en la base de datos
            if (Object.keys(actualizacion).length > 0) {
                await supabase
                    .from('usuarios')
                    .update(actualizacion)
                    .eq('id', user.id);

                // NUEVO: Actualizar sesión local
                Object.assign(user, actualizacion);
                sessionStorage.setItem('currentUser', JSON.stringify(user));

                // NUEVO: Actualizar visualización de tokens
                actualizarVisualizacionTokens();
            }
        }

        // MODIFICADO: Actualizar dashboard solo para insumos ordinarios (compatibilidad)
        if (currentSolicitudType === 'ordinaria' && recursoActual === 'insumo') {
            // Actualizar vista del token en modal
            const tokenStatus = document.getElementById('tokenStatus');
            if (tokenStatus) {
                tokenStatus.textContent = '0';
                tokenStatus.style.color = '#e74c3c';
            }

            // Deshabilitar botón de solicitud ordinaria en dashboard
            setTimeout(() => {
                const btnOrdinaria = document.querySelector('[data-type="ordinaria"] .btn-solicitar');
                if (btnOrdinaria) {
                    btnOrdinaria.textContent = 'Token Agotado';
                    btnOrdinaria.disabled = true;
                    btnOrdinaria.style.background = '#ccc';
                    btnOrdinaria.style.cursor = 'not-allowed';
                }

                // Agregar mensaje visual en la card
                const cardOrdinaria = document.querySelector('[data-type="ordinaria"]');
                if (cardOrdinaria) {
                    cardOrdinaria.style.opacity = '0.6';
                    const cardContent = cardOrdinaria.querySelector('.card-content p');
                    if (cardContent) {
                        cardContent.textContent = 'Token usado este mes';
                        cardContent.style.color = '#e74c3c';
                    }
                }
            }, 100);
        }

        // Mostrar notificación de éxito
        const tipoRecurso = recursoActual === 'insumo' ? 'insumos' : 'papelería';
        showNotification(`Solicitud de ${tipoRecurso} enviada exitosamente`, 'success');

        // Limpiar carrito
        carritoItems = [];
        if (typeof cantidadesTemp !== 'undefined') {
            cantidadesTemp = {};
        }
        actualizarVistaCarrito();

        setTimeout(() => cerrarModal(), 2000);

    } catch (error) {
        console.error('Error enviando solicitud:', error);
        showNotification('Error enviando solicitud. Intenta nuevamente.', 'error');
    }
}

// Función para actualizar estado de dashboard
function actualizarEstadoDashboard() {
    const session = sessionStorage.getItem('currentUser');
    if (!session) return;

    const user = JSON.parse(session);
    const btnOrdinaria = document.querySelector('[data-type="ordinaria"] .btn-solicitar');
    const cardOrdinaria = document.querySelector('[data-type="ordinaria"]');

    if (user.token_disponible === 0) {
        // Token agotado
        if (btnOrdinaria) {
            btnOrdinaria.textContent = 'Token Agotado';
            btnOrdinaria.disabled = true;
            btnOrdinaria.style.background = '#ccc';
        }
        if (cardOrdinaria) {
            cardOrdinaria.style.opacity = '0.6';
        }
    } else {
        // Token disponible
        if (btnOrdinaria) {
            btnOrdinaria.textContent = 'Solicitar';
            btnOrdinaria.disabled = false;
            btnOrdinaria.style.background = '';
        }
        if (cardOrdinaria) {
            cardOrdinaria.style.opacity = '1';
        }
    }
}



// Función para procesar renovación mensual de tokens
async function procesarRenovacionMensual() {
    try {
        console.log('Iniciando proceso de renovación mensual...');

        // Obtener fecha del mes anterior
        const fechaActual = new Date();
        const mesAnterior = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1, 1);
        const finMesAnterior = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 0);

        // 1. Obtener todos los usuarios activos
        const { data: usuarios, error: usuariosError } = await supabase
            .from('usuarios')
            .select('id, username, token_disponible')
            .eq('activo', true);

        if (usuariosError) throw usuariosError;

        for (const usuario of usuarios) {
            await procesarTokenUsuario(usuario.id, mesAnterior, finMesAnterior);
        }

        console.log('Proceso de renovación mensual completado');
        return true;

    } catch (error) {
        console.error('Error en proceso mensual:', error);
        return false;
    }
}
/*
async function procesarTokenUsuario(usuarioId, inicioMes, finMes) {
    try {
        console.log(`--- Procesando usuario ${usuarioId} ---`);
        console.log(`Rango fechas: ${inicioMes.toISOString()} a ${finMes.toISOString()}`);

        // 1. Buscar solicitudes del mes anterior que usaron token
        const { data: solicitudesToken, error: solicitudesError } = await supabase
            .from('solicitudes')
            .select('id, fecha_solicitud, token_usado')
            .eq('usuario_id', usuarioId)
            .eq('token_usado', true)
            .gte('fecha_solicitud', inicioMes.toISOString())
            .lte('fecha_solicitud', finMes.toISOString());

        if (solicitudesError) throw solicitudesError;

        console.log(`Solicitudes con token encontradas: ${solicitudesToken.length}`);
        console.log('Detalles de solicitudes:', solicitudesToken);

        let tokenRenovado = true;

        if (solicitudesToken.length > 0) {
            console.log('Verificando si todas están marcadas como recibidas...');

            for (const solicitud of solicitudesToken) {
                console.log(`Verificando solicitud ${solicitud.id.substring(0, 8)}...`);

                const { data: recibido, error: recibidoError } = await supabase
                    .from('solicitudes_recibidos')
                    .select('id, fecha_marcado_recibido')
                    .eq('solicitud_id', solicitud.id)
                    .eq('usuario_id', usuarioId)
                    .single();

                console.log(`Resultado búsqueda recibido:`, { data: recibido, error: recibidoError?.code });

                if (recibidoError && recibidoError.code !== 'PGRST116') {
                    throw recibidoError;
                }

                if (!recibido) {
                    console.log(`BLOQUEO: Solicitud ${solicitud.id.substring(0, 8)} NO marcada como recibida`);
                    tokenRenovado = false;
                    break;
                } else {
                    console.log(`OK: Solicitud ${solicitud.id.substring(0, 8)} marcada como recibida el ${recibido.fecha_marcado_recibido}`);
                }
            }
        } else {
            console.log('Usuario sin solicitudes con token del mes anterior - token renovado automáticamente');
        }

        console.log(`DECISION FINAL: Token para usuario ${usuarioId} será ${tokenRenovado ? 'RENOVADO' : 'BLOQUEADO'}`);

        // 3. Registrar en tokens_renovacion
        const { error: tokenError } = await supabase
            .from('tokens_renovacion')
            .insert({
                usuario_id: usuarioId,
                mes_ano: finMes.toISOString().substring(0, 7),
                tenia_solicitud: solicitudesToken.length > 0,
                marco_recibido: tokenRenovado,
                token_renovado: tokenRenovado,
                fecha_verificacion: new Date().toISOString()
            });

        if (tokenError) throw tokenError;

        // 4. Actualizar token_disponible del usuario
        const nuevoToken = tokenRenovado ? 1 : 0;
        const { error: updateError } = await supabase
            .from('usuarios')
            .update({ token_disponible: nuevoToken })
            .eq('id', usuarioId);

        if (updateError) throw updateError;

        console.log(`COMPLETADO: Usuario ${usuarioId} - Token actualizado a ${nuevoToken}`);
        console.log('---');

    } catch (error) {
        console.error(`Error procesando usuario ${usuarioId}:`, error);
    }
}*/
async function procesarTokenUsuario(usuarioId, inicioMes, finMes) {
    try {
        console.log(`--- Procesando usuario ${usuarioId} ---`);
        console.log(`Rango fechas: ${inicioMes.toISOString()} a ${finMes.toISOString()}`);

        // Buscar solicitudes del mes anterior que usaron token
        const { data: solicitudesToken, error: solicitudesError } = await supabase
            .from('solicitudes')
            .select('id, fecha_solicitud, token_usado, recurso_tipo, token_tipo_usado')
            .eq('usuario_id', usuarioId)
            .eq('token_usado', true)
            .gte('fecha_solicitud', inicioMes.toISOString())
            .lte('fecha_solicitud', finMes.toISOString());

        if (solicitudesError) throw solicitudesError;

        console.log(`Solicitudes con token encontradas: ${solicitudesToken.length}`);

        // Separar por tipo de token
        const solicitudesInsumo = solicitudesToken.filter(s => 
            (s.recurso_tipo === 'insumo' || !s.recurso_tipo) && s.token_tipo_usado === 'ordinario'
        );
        const solicitudesPapeleriaOrd = solicitudesToken.filter(s => 
            s.recurso_tipo === 'papeleria' && s.token_tipo_usado === 'ordinario'
        );
        const solicitudesPapeleriaExt = solicitudesToken.filter(s => 
            s.recurso_tipo === 'papeleria' && s.token_tipo_usado === 'extraordinario'
        );

        // Procesar cada tipo de token
        const renovaciones = {};

        // Token de insumos
        renovaciones.insumo = await verificarRenovacionToken(usuarioId, solicitudesInsumo, 'insumo', 'ordinario');

        // Token papelería ordinario
        renovaciones.papeleria_ordinario = await verificarRenovacionToken(usuarioId, solicitudesPapeleriaOrd, 'papeleria', 'ordinario');

        // Token papelería extraordinario
        renovaciones.papeleria_extraordinario = await verificarRenovacionToken(usuarioId, solicitudesPapeleriaExt, 'papeleria', 'extraordinario');

        // Actualizar tokens del usuario
        const updateData = {};
        if (renovaciones.insumo) updateData.token_disponible = 1;
        if (renovaciones.papeleria_ordinario) updateData.token_papeleria_ordinario = 1;
        if (renovaciones.papeleria_extraordinario) updateData.token_papeleria_extraordinario = 1;

        if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
                .from('usuarios')
                .update(updateData)
                .eq('id', usuarioId);

            if (updateError) throw updateError;
        }

        console.log(`RENOVACIONES PARA USUARIO ${usuarioId}:`, renovaciones);

    } catch (error) {
        console.error(`Error procesando usuario ${usuarioId}:`, error);
        throw error;
    }
}

async function verificarRenovacionToken(usuarioId, solicitudes, recursoTipo, tokenTipo) {
    let tokenRenovado = true;

    if (solicitudes.length > 0) {
        console.log(`Verificando ${solicitudes.length} solicitudes de ${recursoTipo} ${tokenTipo}...`);

        for (const solicitud of solicitudes) {
            const { data: recibido, error: recibidoError } = await supabase
                .from('solicitudes_recibidos')
                .select('id, fecha_marcado_recibido')
                .eq('solicitud_id', solicitud.id)
                .eq('usuario_id', usuarioId)
                .single();

            if (recibidoError && recibidoError.code !== 'PGRST116') {
                throw recibidoError;
            }

            if (!recibido) {
                console.log(`BLOQUEO: Solicitud ${solicitud.id.substring(0, 8)} NO marcada como recibida`);
                tokenRenovado = false;
                break;
            }
        }
    }

    // Registrar en tokens_renovacion
    const { error: tokenError } = await supabase
        .from('tokens_renovacion')
        .insert({
            usuario_id: usuarioId,
            mes_ano: new Date().toISOString().substring(0, 7),
            recurso_tipo: recursoTipo,
            token_tipo: tokenTipo,
            tenia_solicitud: solicitudes.length > 0,
            marco_recibido: tokenRenovado,
            token_renovado: tokenRenovado,
            fecha_verificacion: new Date().toISOString()
        });

    if (tokenError) throw tokenError;

    return tokenRenovado;
}

// Verificar si usuario puede recibir token (para mostrar en UI)
async function verificarElegibilidadToken(usuarioId) {
    try {
        // Buscar solicitudes del mes actual con token usado
        const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        const { data: solicitudesToken, error } = await supabase
            .from('solicitudes')
            .select('id')
            .eq('usuario_id', usuarioId)
            .eq('token_usado', true)
            .gte('fecha_solicitud', inicioMes.toISOString());

        if (error) throw error;

        if (solicitudesToken.length === 0) {
            return { elegible: true, mensaje: 'Sin solicitudes pendientes' };
        }

        // Verificar si todas están marcadas
        for (const solicitud of solicitudesToken) {
            const { data: recibido } = await supabase
                .from('solicitudes_recibidos')
                .select('id')
                .eq('solicitud_id', solicitud.id)
                .eq('usuario_id', usuarioId)
                .single();

            if (!recibido) {
                return {
                    elegible: false,
                    mensaje: `Tienes solicitudes sin marcar como recibidas`
                };
            }
        }

        return { elegible: true, mensaje: 'Todas las solicitudes marcadas' };

    } catch (error) {
        console.error('Error verificando elegibilidad:', error);
        return { elegible: false, mensaje: 'Error verificando estado' };
    }
}


// Para ejecutar manualmente o programar
window.ejecutarProcesoMensual = async function () {
    const resultado = await procesarRenovacionMensual();
    if (resultado) {
        showNotification('Proceso de renovación mensual completado exitosamente', 'success');
        // Recargar página para actualizar estado
        setTimeout(() => window.location.reload(), 2000);
    } else {
        showNotification('Error en el proceso de renovación mensual', 'error');
    }
};

// ===================================
// SISTEMA DE INCLUDES/COMPONENTES
// ===================================

// Función para cargar componentes dinámicamente
async function loadComponent(containerId, filePath) {
    try {
        console.log(`🔄 Intentando cargar: ${filePath}`);

        // Intentar fetch con manejo de errores mejorado
        const response = await fetch(filePath, {
            method: 'GET',
            headers: {
                'Content-Type': 'text/html',
            },
            cache: 'no-cache'
        });

        console.log(`📡 Respuesta de ${filePath}:`, response.status, response.statusText);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        console.log(`📄 HTML obtenido de ${filePath}:`, html.substring(0, 100) + '...');

        const container = document.getElementById(containerId);

        if (!container) {
            console.error(`❌ Container no encontrado: ${containerId}`);
            return;
        }

        container.innerHTML = html;
        console.log(`✅ Componente cargado exitosamente: ${filePath}`);

        // Ejecutar scripts específicos después de cargar
        if (filePath.includes('header')) {
            setTimeout(setupHeaderEvents, 100);
        } else if (filePath.includes('footer')) {
            setTimeout(() => {
                setupFooterEvents();
                updateFooterStats();
            }, 100);
        }

    } catch (error) {
        console.error(`❌ Error detallado cargando ${filePath}:`, error);

        // Fallback: cargar contenido básico
        const container = document.getElementById(containerId);
        if (container) {
            if (filePath.includes('footer')) {
                loadFallbackFooter(container);
            } else if (filePath.includes('header')) {
                loadFallbackHeader(container);
            } else {
                container.innerHTML = `
                    <div style="text-align: center; padding: 1rem; background: #fee; border: 1px solid #fcc; border-radius: 8px; color: #c33;">
                        ⚠️ Error cargando ${filePath}<br>
                        <small>Error: ${error.message}</small><br>
                        <small>Verificando rutas y permisos...</small>
                    </div>
                `;
            }
        }
    }
}

// Fallback para footer si no se puede cargar dinámicamente
function loadFallbackFooter(container) {
    console.log('🔄 Cargando footer fallback...');
    container.innerHTML = `
        <footer class="footer">
            <div class="container">
                <div class="footer-content">
                    <div class="footer-section">
                        <h3>Contacto</h3>
                        <div class="contact-info">
                            <div class="contact-item">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                    <polyline points="22,6 12,13 2,6"/>
                                </svg>
                                <span>soporte@empresa.com</span>
                            </div>
                            <div class="contact-item">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                </svg>
                                <span>+52 55 1234 5678</span>
                            </div>
                            <div class="contact-item">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                </svg>
                                <span>Oficina Central - Piso 3</span>
                            </div>
                            <div class="contact-item">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12,6 12,12 16,14"/>
                                </svg>
                                <span>Lun - Vie: 9:00 - 18:00</span>
                            </div>
                        </div>
                    </div>
                    <div class="footer-section">
                        <h3>Enlaces Rápidos</h3>
                        <div class="footer-links">
                            <a href="index.html">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                    <polyline points="9,22 9,12 15,12 15,22"/>
                                </svg>
                                Inicio
                            </a>
                            <a href="historial.html">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 3h18v18H3zM8 7h8M8 11h8M8 15h8"/>
                                </svg>
                                Historial
                            </a>
                        </div>
                    </div>
                    <div class="footer-section">
                        <h3>Sistema de Insumos</h3>
                        <p class="footer-description">Plataforma digital para gestión de solicitudes</p>
                        <div class="system-stats">
                            <div class="stat-item">
                                <span class="stat-number" id="totalSolicitudes">0</span>
                                <span class="stat-label">Solicitudes</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number" id="solicitudesActivas">0</span>
                                <span class="stat-label">Activas</span>
                            </div>
                        </div>
                    </div>
                    <div class="footer-section">
                        <h3>Estado del Sistema</h3>
                        <div class="system-status">
                            <div class="status-item">
                                <div class="status-indicator online"></div>
                                <span>Sistema Operativo</span>
                            </div>
                        </div>
                        <div class="system-info">
                            <small>Última actualización: <span id="lastUpdate">${new Date().toLocaleTimeString()}</span></small>
                            <small>Versión: 1.0.0</small>
                        </div>
                    </div>
                </div>
                <div class="footer-bottom">
                    <div class="footer-bottom-content">
                        <div class="copyright">
                            <p>&copy; <span id="currentYear">${new Date().getFullYear()}</span> Sistema de Solicitudes de Insumos.</p>
                        </div>
                        <div class="footer-actions">
                            <button class="footer-btn" onclick="scrollToTop()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="19" x2="12" y2="5"/>
                                    <polyline points="5,12 12,5 19,12"/>
                                </svg>
                                Subir
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    `;

    setTimeout(() => {
        setupFooterEvents();
        updateFooterStats();
    }, 100);
}

// Fallback para header si no se puede cargar dinámicamente
function loadFallbackHeader(container) {
    console.log('🔄 Cargando header fallback...');
    container.innerHTML = `
        <header class="header">
            <div class="container">
                <div class="header-content">
                    <div class="logo-section">
                        <div class="logo-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12l2 2 4-4"/>
                                <circle cx="12" cy="12" r="10"/>
                            </svg>
                        </div>
                        <div class="logo-text">
                            <h1>Solicitudes de Insumos</h1>
                        </div>
                    </div>
                    <nav class="main-nav">
                        <ul class="nav-links">
                            <li><a href="index.html" class="nav-link active">Inicio</a></li>
                            <li><a href="historial.html" class="nav-link">Historial</a></li>
                            <li><a href="contacto.html" class="nav-link">Contacto</a></li>
                        </ul>
                    </nav>
                    <div class="user-section">
                        <div class="user-menu">
                            <button class="user-button" onclick="toggleUserMenu()">
                                <div class="user-avatar">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                        <circle cx="12" cy="7" r="4"/>
                                    </svg>
                                </div>
                                <span class="user-name">Usuario</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    `;

    setTimeout(setupHeaderEvents, 100);
}

// Función para actualizar información dinámica
function updateDynamicInfo() {
    // Actualizar año actual
    const yearElements = document.querySelectorAll('#currentYear, .current-year');
    yearElements.forEach(el => {
        if (el) el.textContent = new Date().getFullYear();
    });

    // Actualizar última actualización
    const updateElements = document.querySelectorAll('#lastUpdate, .last-updated');
    updateElements.forEach(el => {
        if (el) el.textContent = new Date().toLocaleTimeString();
    });

    // ACTUALIZAR USUARIO DESDE SESIÓN
    const session = sessionStorage.getItem('currentUser');
    if (session) {
        try {
            const user = JSON.parse(session);
            currentUser = {
                name: user.nombre,
                email: user.username + '@empresa.com',
                department: user.departamento,
                role: user.rol
            };
            console.log('Usuario actualizado:', currentUser.name);
        } catch (error) {
            console.error('Error actualizando usuario:', error);
        }
    }

    // Actualizar información del usuario
    updateUserInfo();
}

// ===================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ===================================

document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 ' + APP_CONFIG.name + ' v' + APP_CONFIG.version + ' iniciando...');
    console.log('📍 URL actual:', window.location.href);
    console.log('🔍 Verificando contenedores DOM...');

    // Verificar que los contenedores existan
    const headerContainer = document.getElementById('header-container');
    const footerContainer = document.getElementById('footer-container');

    console.log('Header container:', headerContainer ? '✅ Encontrado' : '❌ No encontrado');
    console.log('Footer container:', footerContainer ? '✅ Encontrado' : '❌ No encontrado');

    /*if (!headerContainer) {
        console.error('❌ Header container faltante. Verificar HTML.');
        return;
    }*/

    // Footer es opcional
    if (!footerContainer) {
        console.log('⚠️ Footer container no encontrado, continuando sin footer...');
    }

    try {
        console.log('🔄 Iniciando carga de componentes...');

        // Cargar componentes del sistema con timeout
        const headerPromise = loadComponent('header-container', 'includes/header.html');
        const footerPromise = loadComponent('footer-container', 'includes/foot.html');

        // Esperar máximo 5 segundos por componente
        await Promise.race([
            Promise.all([headerPromise, footerPromise]),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);

        console.log('✅ Componentes cargados exitosamente');

        // Actualizar información dinámica
        updateDynamicInfo();

        // Configurar eventos principales
        setTimeout(setupAllEventListeners, 300);

        // Cargar datos iniciales
        setTimeout(loadInitialData, 500);

        console.log('✅ Aplicación inicializada correctamente');

    } catch (error) {
        console.error('❌ Error durante la inicialización:', error);

        // Mostrar notificación de error solo si existe la función
        if (typeof showNotification === 'function') {
            showNotification('Error al inicializar componentes: ' + error.message, 'warning');
        }

        // Continuar con la inicialización básica
        setTimeout(() => {
            updateDynamicInfo();
            setupAllEventListeners();
            loadInitialData();
        }, 1000);
    }
});


setTimeout(actualizarEstadoDashboard, 1000);

// ===================================
// GESTIÓN DE EVENTOS
// ===================================

function setupAllEventListeners() {
    console.log('Configurando event listeners...');

    // Event listeners del header
    setupHeaderEvents();

    // Event listeners del footer
    setupFooterEvents();

    // Event listeners del modal
    setupModalEvents();

    // Event listeners generales
    setupGeneralEvents();
}

function setupHeaderEvents() {
    // Cerrar dropdowns al hacer click fuera
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.user-menu')) {
            closeUserDropdown();
        }
    });

    // Eventos de navegación móvil
    const mobileOverlay = document.getElementById('mobileOverlay');
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', closeMobileMenus);
    }
}

function setupFooterEvents() {
    // Botón de scroll to top
    const scrollBtn = document.querySelector('.footer-btn[onclick="scrollToTop()"]');
    if (scrollBtn) {
        scrollBtn.onclick = scrollToTop;
    }
}

function setupModalEvents() {
    const modal = document.getElementById('solicitud-modal');
    const form = document.getElementById('solicitud-form');

    if (modal) {
        // Cerrar modal al hacer click en el overlay
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                cerrarModal();
            }
        });
    }

    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

function setupGeneralEvents() {
    // Navegación con teclado
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            cerrarModal();
            closeMobileMenus();
            closeUserDropdown();
        }
    });

    // Prevenir submit por defecto en formularios sin handler
    document.addEventListener('submit', function (e) {
        if (!e.target.hasAttribute('data-handled')) {
            e.preventDefault();
        }
    });
}

// ===================================
// FUNCIONES DEL HEADER
// ===================================

// Toggle del menú de usuario
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        const isVisible = dropdown.style.display !== 'none';
        if (isVisible) {
            closeUserDropdown();
        } else {
            dropdown.style.display = 'block';
            dropdown.style.animation = 'modalSlideIn 0.2s ease';
        }
    }
}

// Cerrar dropdown de usuario
function closeUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

// Toggle del menú móvil
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileOverlay = document.getElementById('mobileOverlay');

    if (mobileMenu && mobileOverlay) {
        const isVisible = mobileMenu.style.display !== 'none';

        if (isVisible) {
            closeMobileMenus();
        } else {
            mobileMenu.style.display = 'block';
            mobileOverlay.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }
}

// Cerrar menús móviles
function closeMobileMenus() {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileOverlay = document.getElementById('mobileOverlay');

    if (mobileMenu) mobileMenu.style.display = 'none';
    if (mobileOverlay) mobileOverlay.style.display = 'none';
    document.body.style.overflow = '';
}

// Actualizar información del usuario en el UI
function updateUserInfo() {
    const userNameElements = document.querySelectorAll('.user-name, .user-display-name');
    const userEmailElements = document.querySelectorAll('.user-email');

    userNameElements.forEach(el => {
        if (el) el.textContent = currentUser.name;
    });

    userEmailElements.forEach(el => {
        if (el) el.textContent = currentUser.email;
    });
}

// ===================================
// FUNCIONES DEL FOOTER
// ===================================

// Scroll to top
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Actualizar estadísticas del footer
function updateFooterStats() {
    const totalSolicitudesEl = document.getElementById('totalSolicitudes');
    const solicitudesActivasEl = document.getElementById('solicitudesActivas');

    if (totalSolicitudesEl) {
        totalSolicitudesEl.textContent = solicitudes.length;
    }

    if (solicitudesActivasEl) {
        const activeSolicitudes = solicitudes.filter(s =>
            s.estado === 'pendiente' || s.estado === 'en_proceso'
        ).length;
        solicitudesActivasEl.textContent = activeSolicitudes;
    }
}

// ===================================
// FUNCIONES DEL MODAL DE SOLICITUDES
// ===================================

// Abrir modal de solicitud
/*function abrirSolicitud(tipo) {
    currentSolicitudType = tipo;

    // Verificar token para solicitudes ordinarias
    if (tipo === 'ordinaria' && !verificarTokenDisponible()) {
        showNotification('No tienes token disponible para solicitudes ordinarias', 'warning');
        return;
    }

    const modal = document.getElementById('solicitud-modal');
    const modalTitle = document.getElementById('modal-title');

    if (modal && modalTitle) {
        // Configurar título según el tipo
        const titles = {
            'ordinaria': 'Nueva Solicitud Mensual/Ordinaria',
            'juntas': 'Nueva Solicitud para Juntas'
        };

        modalTitle.textContent = titles[tipo] || 'Nueva Solicitud';

        // ACTUALIZAR INFO DEL USUARIO EN EL MODAL
        actualizarInfoUsuarioModal();
        cargarDatosCarrito();

        // Mostrar modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Mostrar/ocultar campos según tipo
    const camposJunta = document.getElementById('camposJunta');
    if (camposJunta) {
        if (tipo === 'juntas') {
            camposJunta.style.display = 'block';
            // Establecer fecha mínima como mañana
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const fechaEvento = document.getElementById('fechaEvento');
            if (fechaEvento) {
                fechaEvento.min = tomorrow.toISOString().split('T')[0];
            }
        } else {
            camposJunta.style.display = 'none';
        }
    }
}*/


// Cerrar modal
function cerrarModal() {
    const modal = document.getElementById('solicitud-modal');

    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    // Limpiar campos de junta
    const fechaEvento = document.getElementById('fechaEvento');
    const horaEvento = document.getElementById('horaEvento');
    const numParticipantes = document.getElementById('numParticipantes');
    const salaEvento = document.getElementById('salaEvento');
    const descripcionEvento = document.getElementById('descripcionEvento');

    if (fechaEvento) fechaEvento.value = '';
    if (horaEvento) horaEvento.value = '';
    if (numParticipantes) numParticipantes.value = '';
    if (salaEvento) salaEvento.value = '';
    if (descripcionEvento) descripcionEvento.value = '';

    currentSolicitudType = '';
    carritoItems = [];
    cantidadesTemp = {};
    actualizarVistaCarrito();
}

// Manejar envío del formulario
function handleFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);

    // Validar formulario
    if (!validateForm(form)) {
        return;
    }

    // Crear objeto de solicitud
    const solicitud = {
        id: generateId(),
        tipo: currentSolicitudType,
        solicitante: formData.get('solicitante'),
        departamento: formData.get('departamento'),
        descripcion: formData.get('descripcion'),
        justificacion: formData.get('justificacion') || '',
        prioridad: formData.get('prioridad'),
        fecha_evento: formData.get('fecha_evento') || null,
        fecha_solicitud: new Date().toISOString(),
        estado: 'pendiente',
        usuario: currentUser.email
    };

    // Guardar solicitud
    saveSolicitud(solicitud);

    // Mostrar confirmación
    showNotification('Solicitud enviada exitosamente', 'success');

    // Cerrar modal
    cerrarModal();

    // Actualizar estadísticas
    updateFooterStats();
}

// ===================================
// FUNCIONES DE VALIDACIÓN
// ===================================

function validateForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            showFieldError(field, 'Este campo es obligatorio');
            isValid = false;
        } else {
            clearFieldError(field);
        }
    });

    // Validaciones específicas
    const email = form.querySelector('input[type="email"]');
    if (email && email.value && !isValidEmail(email.value)) {
        showFieldError(email, 'Ingrese un email válido');
        isValid = false;
    }

    const fechaEvento = document.getElementById('fecha-evento');
    if (fechaEvento && fechaEvento.required && fechaEvento.value) {
        const fechaSeleccionada = new Date(fechaEvento.value);
        const ahora = new Date();

        if (fechaSeleccionada <= ahora) {
            showFieldError(fechaEvento, 'La fecha del evento debe ser futura');
            isValid = false;
        }
    }

    return isValid;
}

function showFieldError(field, message) {
    clearFieldError(field);

    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.color = '#e74c3c';
    errorDiv.style.fontSize = '0.9rem';
    errorDiv.style.marginTop = '0.25rem';
    errorDiv.textContent = message;

    field.style.borderColor = '#e74c3c';
    field.parentNode.appendChild(errorDiv);
}

function clearFieldError(field) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    field.style.borderColor = '';
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ===================================
// GESTIÓN DE DATOS
// ===================================

// Cargar datos iniciales
function loadInitialData() {
    // Cargar solicitudes desde localStorage
    solicitudes = JSON.parse(localStorage.getItem('solicitudes')) || [];

    // Cargar configuración de usuario
    const savedUser = JSON.parse(localStorage.getItem('currentUser'));
    if (savedUser) {
        currentUser = { ...currentUser, ...savedUser };
        updateUserInfo();
    }

    // Actualizar estadísticas
    updateFooterStats();

    console.log(`📊 Datos cargados: ${solicitudes.length} solicitudes`);
}

// Guardar solicitud
function saveSolicitud(solicitud) {
    solicitudes.push(solicitud);
    localStorage.setItem('solicitudes', JSON.stringify(solicitudes));

    console.log('💾 Solicitud guardada:', solicitud);
}

// Generar ID único
function generateId() {
    return 'SOL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// ===================================
// SISTEMA DE NOTIFICACIONES
// ===================================

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

// ===================================
// UTILIDADES
// ===================================

// Formatear fecha
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ===================================
// FUNCIONES DE NAVEGACIÓN
// ===================================

// Ir a historial (si existe la página)
function irAHistorial() {
    if (solicitudes.length === 0) {
        showNotification('No tienes solicitudes registradas', 'info');
        return;
    }

    // Si existe la página de historial, navegar
    window.location.href = 'historial.html';
}

// ===================================
// MANEJO DE ERRORES GLOBAL
// ===================================

window.addEventListener('error', function (e) {
    console.error('Error global capturado:', e.error);
    showNotification('Ha ocurrido un error inesperado', 'error');
});

window.addEventListener('unhandledrejection', function (e) {
    console.error('Promise rechazada:', e.reason);
    showNotification('Error de conexión o procesamiento', 'error');
});

// ===================================
// ANIMACIONES CSS DINÁMICAS
// ===================================

// Agregar estilos de animación al head
const animationStyles = document.createElement('style');
animationStyles.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(animationStyles);

// ===================================
// DEBUG Y DESARROLLO
// ===================================

// ===================================
// DEBUG Y DESARROLLO
// ===================================

function debugInfo() {
    console.log('=== 🔍 DEBUG INFO ===');
    console.log('📍 URL actual:', window.location.href);
    console.log('📁 Ubicación base:', window.location.origin);
    console.log('🔍 Contenedores DOM:');
    console.log('  - Header container:', document.getElementById('header-container') ? '✅' : '❌');
    console.log('  - Footer container:', document.getElementById('footer-container') ? '✅' : '❌');
    console.log('📊 Datos:');
    console.log('  - Solicitudes:', solicitudes.length);
    console.log('  - Usuario actual:', currentUser);
    console.log('  - Tipo de solicitud actual:', currentSolicitudType);
    console.log('⚙️ Configuración:', APP_CONFIG);
    console.log('🌐 Live Server activo:', window.location.protocol === 'http:' && window.location.hostname === '127.0.0.1');
    console.log('===================');
}

// Función para forzar recarga de componentes
function forceReloadComponents() {
    console.log('🔄 Forzando recarga de componentes...');
    loadComponent('header-container', 'includes/header.html');
    loadComponent('footer-container', 'includes/footer.html');
}

// Función para probar rutas
async function testRoutes() {
    console.log('🧪 Probando rutas de archivos...');

    const routes = [
        'includes/header.html',
        'includes/footer.html',
        'css/styles.css',
        'js/script.js'
    ];

    for (const route of routes) {
        try {
            const response = await fetch(route, { method: 'HEAD' });
            console.log(`${route}: ${response.ok ? '✅' : '❌'} (${response.status})`);
        } catch (error) {
            console.log(`${route}: ❌ Error - ${error.message}`);
        }
    }
}

// Exponer funciones para debug en desarrollo
if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
    window.debugSolicitudes = {
        debugInfo,
        testRoutes,
        forceReloadComponents,
        solicitudes: () => solicitudes,
        clearSolicitudes: () => {
            localStorage.removeItem('solicitudes');
            solicitudes = [];
            updateFooterStats();
            console.log('🗑️ Solicitudes limpiadas');
        },
        addTestData: () => {
            const testSolicitud = {
                id: generateId(),
                tipo: 'ordinaria',
                solicitante: 'Usuario de Prueba',
                departamento: 'Sistemas',
                descripcion: 'Solicitud de prueba para testing',
                justificacion: 'Solo para pruebas del sistema',
                prioridad: 'media',
                fecha_solicitud: new Date().toISOString(),
                estado: 'pendiente',
                usuario: 'test@empresa.com'
            };
            saveSolicitud(testSolicitud);
            updateFooterStats();
            console.log('📝 Datos de prueba agregados');
        }
    };

    // Auto-ejecutar debug info al cargar en desarrollo
    setTimeout(debugInfo, 2000);
}



// Función de logout
function logout() {
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('userSession');
    localStorage.removeItem('rememberLogin');
    window.location.href = '/login.html';
}














// ===================================
// NUEVAS FUNCIONES PARA TOKENS DE PAPELERÍA
// Agregar estas funciones a tu script.js existente
// ===================================



// Función para normalizar el tipo de solicitud antes de enviar
function normalizarTipoSolicitud(tipo) {
    if (tipo.includes('ordinaria')) return 'ordinaria';
    if (tipo.includes('extraordinaria')) return 'extraordinaria';
    if (tipo.includes('juntas')) return 'juntas';
    return tipo; // Fallback
}


// Variables globales adicionales
let recursoActual = 'insumo'; // 'insumo' o 'papeleria'
let tokensPapeleria = {
    ordinario: 0,
    extraordinario: 0
};

// Función para cargar tokens de papelería desde la base de datos
async function cargarTokensPapeleria() {
    try {
        const session = sessionStorage.getItem('currentUser');
        if (!session) return;

        const user = JSON.parse(session);

        // Obtener tokens actualizados del usuario
        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('token_disponible, token_papeleria_ordinario, token_papeleria_extraordinario')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error cargando tokens de papelería:', error);
            return;
        }

        // Actualizar tokens en memoria
        tokensPapeleria.ordinario = usuario.token_papeleria_ordinario || 0;
        tokensPapeleria.extraordinario = usuario.token_papeleria_extraordinario || 0;

        // Actualizar la sesión con los nuevos tokens
        user.token_disponible = usuario.token_disponible;
        user.token_papeleria_ordinario = usuario.token_papeleria_ordinario;
        user.token_papeleria_extraordinario = usuario.token_papeleria_extraordinario;
        sessionStorage.setItem('currentUser', JSON.stringify(user));

        // Actualizar la interfaz
        actualizarVisualizacionTokens();

        console.log('Tokens cargados:', {
            insumo: usuario.token_disponible,
            papeleria_ordinario: tokensPapeleria.ordinario,
            papeleria_extraordinario: tokensPapeleria.extraordinario
        });

    } catch (error) {
        console.error('Error en cargarTokensPapeleria:', error);
    }
}

// Función para actualizar la visualización de tokens en la interfaz
function actualizarVisualizacionTokens() {
    const session = sessionStorage.getItem('currentUser');
    if (!session) return;

    const user = JSON.parse(session);

    // Actualizar token de insumos
    const tokenInsumoDisplay = document.getElementById('token-insumo-display');
    if (tokenInsumoDisplay) {
        tokenInsumoDisplay.textContent = `Token: ${user.token_disponible || 0}`;
    }

    // Actualizar tokens de papelería
    const tokenPapeleriaOrdinario = document.getElementById('token-papeleria-ordinario-display');
    const tokenPapeleriaExtraordinario = document.getElementById('token-papeleria-extraordinario-display');

    if (tokenPapeleriaOrdinario) {
        tokenPapeleriaOrdinario.textContent = `Ordinario: ${user.token_papeleria_ordinario || 0}`;
        // Agregar clase visual si está agotado
        if (user.token_papeleria_ordinario === 0) {
            tokenPapeleriaOrdinario.style.color = '#e74c3c';
        } else {
            tokenPapeleriaOrdinario.style.color = '';
        }
    }

    if (tokenPapeleriaExtraordinario) {
        tokenPapeleriaExtraordinario.textContent = `Extraordinario: ${user.token_papeleria_extraordinario || 0}`;
        // Agregar clase visual si está agotado
        if (user.token_papeleria_extraordinario === 0) {
            tokenPapeleriaExtraordinario.style.color = '#e74c3c';
        } else {
            tokenPapeleriaExtraordinario.style.color = '';
        }
    }

    // Actualizar estado de los botones de solicitud
    actualizarEstadoBotonesSolicitud();
}

// Función para actualizar el estado de los botones según los tokens disponibles
function actualizarEstadoBotonesSolicitud() {
    const session = sessionStorage.getItem('currentUser');
    if (!session) return;

    const user = JSON.parse(session);

    // Botones de insumos
    const btnOrdinaria = document.querySelector('[data-type="ordinaria"] .btn-solicitar');
    if (btnOrdinaria) {
        if (user.token_disponible === 0) {
            btnOrdinaria.textContent = 'Token Agotado';
            btnOrdinaria.disabled = true;
            btnOrdinaria.style.background = '#ccc';
            btnOrdinaria.style.cursor = 'not-allowed';
        } else {
            btnOrdinaria.textContent = 'Solicitar';
            btnOrdinaria.disabled = false;
            btnOrdinaria.style.background = '';
            btnOrdinaria.style.cursor = 'pointer';
        }
    }

    // Botones de papelería
    const btnOrdinariaPapeleria = document.querySelector('[data-type="ordinaria-papeleria"] .btn-solicitar');
    const btnExtraordinariaPapeleria = document.querySelector('[data-type="extraordinaria-papeleria"] .btn-solicitar');

    if (btnOrdinariaPapeleria) {
        if (user.token_papeleria_ordinario === 0) {
            btnOrdinariaPapeleria.textContent = 'Token Agotado';
            btnOrdinariaPapeleria.disabled = true;
            btnOrdinariaPapeleria.style.background = '#ccc';
            btnOrdinariaPapeleria.style.cursor = 'not-allowed';
        } else {
            btnOrdinariaPapeleria.textContent = 'Solicitar';
            btnOrdinariaPapeleria.disabled = false;
            btnOrdinariaPapeleria.style.background = '';
            btnOrdinariaPapeleria.style.cursor = 'pointer';
        }
    }

    if (btnExtraordinariaPapeleria) {
        if (user.token_papeleria_extraordinario === 0) {
            btnExtraordinariaPapeleria.textContent = 'Token Agotado';
            btnExtraordinariaPapeleria.disabled = true;
            btnExtraordinariaPapeleria.style.background = '#ccc';
            btnExtraordinariaPapeleria.style.cursor = 'not-allowed';
        } else {
            btnExtraordinariaPapeleria.textContent = 'Solicitar';
            btnExtraordinariaPapeleria.disabled = false;
            btnExtraordinariaPapeleria.style.background = '';
            btnExtraordinariaPapeleria.style.cursor = 'pointer';
        }
    }
}

// Función para validar token antes de abrir modal
function validarTokenParaSolicitud(tipo) {
    const session = sessionStorage.getItem('currentUser');
    if (!session) return false;

    const user = JSON.parse(session);

    switch (tipo) {
        case 'ordinaria':
            if (user.token_disponible === 0) {
                showNotification('Token de insumos agotado. Marca tus solicitudes como recibidas para renovarlo.', 'error');
                return false;
            }
            break;

        case 'ordinaria-papeleria':
            if (user.token_papeleria_ordinario === 0) {
                showNotification('Token ordinario de papelería agotado. Marca tus solicitudes como recibidas para renovarlo.', 'error');
                return false;
            }
            break;

        case 'extraordinaria-papeleria':
            if (user.token_papeleria_extraordinario === 0) {
                showNotification('Token extraordinario de papelería agotado. Se renueva mensualmente.', 'error');
                return false;
            }
            break;

        case 'juntas':
        case 'juntas-papeleria':
            // Las solicitudes para juntas no requieren token
            return true;

        default:
            return true;
    }

    return true;
}

// Función para seleccionar tipo de recurso (actualizada)
function seleccionarRecurso(tipo) {
    recursoActual = tipo;

    // Actualizar botones
    const btnInsumos = document.getElementById('btn-insumos');
    const btnPapeleria = document.getElementById('btn-papeleria');

    if (tipo === 'insumo') {
        // Activar insumos
        btnInsumos.style.background = 'linear-gradient(135deg, #657153, #8aaa79)';
        btnInsumos.style.color = 'white';
        btnInsumos.style.border = 'none';

        // Desactivar papelería
        btnPapeleria.style.background = 'white';
        btnPapeleria.style.color = '#657153';
        btnPapeleria.style.border = '2px solid #b7b6c2';

        // Mostrar/ocultar secciones
        document.getElementById('seccion-insumos').style.display = 'block';
        document.getElementById('seccion-papeleria').style.display = 'none';

    } else {
        // Activar papelería
        btnPapeleria.style.background = 'linear-gradient(135deg, #657153, #8aaa79)';
        btnPapeleria.style.color = 'white';
        btnPapeleria.style.border = 'none';

        // Desactivar insumos
        btnInsumos.style.background = 'white';
        btnInsumos.style.color = '#657153';
        btnInsumos.style.border = '2px solid #b7b6c2';

        // Mostrar/ocultar secciones
        document.getElementById('seccion-insumos').style.display = 'none';
        document.getElementById('seccion-papeleria').style.display = 'block';
    }

    // Actualizar estado de botones según tokens
    actualizarEstadoBotonesSolicitud();
}

// Función expandida para abrir solicitud (actualizada)
function abrirSolicitud(tipo) {
    console.log('Abriendo solicitud:', tipo, 'para recurso:', recursoActual);

    // Validar token antes de continuar
    if (!validarTokenParaSolicitud(tipo)) {
        return;
    }

    actualizarInfoUsuarioModal();
    actualizarInfoUsuarioModal(tipo);

    // Actualizar tipo de solicitud actual
    currentSolicitudType = tipo;

    // Actualizar info del modal
    const modalTitle = document.getElementById('modal-title');
    const infoSolicitud = document.getElementById('info-solicitud-actual');
    const recursoSpan = document.getElementById('recurso-actual');
    const tipoSpan = document.getElementById('tipo-solicitud-actual');

    // Mostrar info adicional si existe
    if (infoSolicitud) {
        infoSolicitud.style.display = 'block';
        if (recursoSpan) recursoSpan.textContent = recursoActual === 'insumo' ? 'Insumos' : 'Papelería';
    }

    // Ocultar todos los campos especiales primero
    const camposJunta = document.getElementById('camposJunta');
    const camposExtraordinaria = document.getElementById('campos-extraordinaria');

    if (camposJunta) camposJunta.style.display = 'none';
    if (camposExtraordinaria) camposExtraordinaria.style.display = 'none';

    // Configurar modal según el tipo de solicitud
    if (tipo.includes('juntas')) {
        if (tipoSpan) tipoSpan.textContent = 'Juntas';
        modalTitle.textContent = `Carrito de ${recursoActual === 'insumo' ? 'Insumos' : 'Papelería'} - Juntas`;
        if (camposJunta) camposJunta.style.display = 'block';
    } else if (tipo.includes('extraordinaria')) {
        if (tipoSpan) tipoSpan.textContent = 'Extraordinaria';
        modalTitle.textContent = 'Carrito de Papelería - Extraordinaria';
        if (camposExtraordinaria) camposExtraordinaria.style.display = 'block';
    } else {
        if (tipoSpan) tipoSpan.textContent = 'Ordinaria';
        modalTitle.textContent = `Carrito de ${recursoActual === 'insumo' ? 'Insumos' : 'Papelería'} - Ordinaria`;
    }

    // Cargar datos del carrito según el tipo de recurso
    if (recursoActual === 'papeleria') {
        cargarDatosPapeleria();
    } else {
        cargarDatosCarrito(); // Tu función existente para insumos
    }

    // Abrir modal
    document.getElementById('solicitud-modal').style.display = 'flex';
}

// Función para cargar datos de papelería (nueva)
async function cargarDatosPapeleria() {
    try {
        console.log('Cargando categorías y papelería...');

        // Cargar categorías de papelería
        const { data: categoriasFromDB, error: catError } = await supabase
            .from('categorias_papeleria')
            .select('*')
            .eq('activo', true)
            .order('orden');

        if (catError) throw catError;

        // Determinar qué papelería puede ver el usuario
        const session = sessionStorage.getItem('currentUser');
        const user = JSON.parse(session);

        const departamentosConAccesoCompleto = ['Dirección Jurídica', 'Coordinación Administrativa'];
        const tieneAccesoCompleto = departamentosConAccesoCompleto.includes(user.departamento);

        // Cargar papelería según acceso
        let query = supabase
            .from('papeleria')
            .select('*')
            .eq('activo', true);

        if (!tieneAccesoCompleto) {
            query = query.eq('acceso_tipo', 'todos');
        }

        const { data: papeleriaFromDB, error: papError } = await query.order('nombre');

        if (papError) throw papError;

        // Actualizar variables globales
        categorias = categoriasFromDB || [];
        insumos = papeleriaFromDB || []; // Reutilizamos la variable insumos para papelería

        console.log(`Categorías de papelería cargadas: ${categorias.length}`);
        console.log(`Items de papelería cargados: ${insumos.length}`);

        // Renderizar categorías y papelería
        renderizarCategorias();

        if (categorias.length > 0) {
            // Simular clic en la primera categoría
            setTimeout(() => {
                const primerTab = document.querySelector('.categoria-tab');
                if (primerTab) {
                    primerTab.click();
                }
                // O si tienes función para mostrar categoría:
                // mostrarCategoria(categorias[0].id);
            }, 100);
        }


    } catch (error) {
        console.error('Error cargando datos de papelería:', error);
        showNotification('Error cargando datos de papelería', 'error');
    }
}

// Modificar el DOMContentLoaded existente para incluir la carga de tokens de papelería
document.addEventListener('DOMContentLoaded', function () {
    // Tu código DOMContentLoaded existente aquí...

    // Agregar carga de tokens de papelería
    cargarTokensPapeleria();

    // Configurar selector de recursos por defecto
        if (document.getElementById('btn-insumos')) {
        seleccionarRecurso('insumo');
    }
});

// Función para mostrar notificaciones (si no existe)
function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Estilos básicos
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        transition: all 0.3s ease;
    `;

    // Color según tipo
    switch (type) {
        case 'error':
            notification.style.background = '#e74c3c';
            break;
        case 'success':
            notification.style.background = '#27ae60';
            break;
        case 'warning':
            notification.style.background = '#f39c12';
            break;
        default:
            notification.style.background = '#3498db';
    }

    document.body.appendChild(notification);

    // Remover después de 4 segundos
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}
















// ===================================
// INICIALIZACIÓN FINAL
// ===================================

console.log('Script.js cargado completamente - ' + APP_CONFIG.name);

/* ===================================
   SISTEMA DE I-NVENTARIO COMPLETO - inventario.js
   Gestión completa de stock, restock y reportes
   =================================== */

// Variables globales
let inventarioData = [];
let categoriasData = [];
let movimientosData = [];
let currentSuperAdmin = null;

// Configuración Supabase - INICIALIZACIÓN INMEDIATA
const supabaseInventario = window.supabase.createClient(
    'https://nxuvisaibpmdvraybzbm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54dXZpc2FpYnBtZHZyYXliemJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4OTMxNjQsImV4cCI6MjA3MTQ2OTE2NH0.OybYM_E3mWsZym7mEf-NiRtrG0svkylXx_q8Tivonfg'
);

// ===================================
// INICIALIZACIÓN DEL SISTEMA
// ===================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Inicializando sistema de inventario...');
    
    try {
        // 1. Verificar permisos
        currentSuperAdmin = verificarPermisosSuperAdmin();
        if (!currentSuperAdmin) return;
        
        // 2. Cargar datos iniciales
        await cargarDatosInventario();
        
        // 3. Configurar event listeners
        configurarEventListeners();
        
        console.log('✅ Sistema de inventario inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando inventario:', error);
        mostrarError('Error al cargar el sistema de inventario');
    }
});

function verificarPermisosSuperAdmin() {
    const session = sessionStorage.getItem('currentUser');
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    
    try {
        const user = JSON.parse(session);
        if (user.rol !== 'super_admin' && user.rol !== 'admin') {
            alert('Solo los Administradores pueden acceder al inventario');
            window.location.href = 'admin.html';
            return null;
        }
        return user;
    } catch (error) {
        window.location.href = 'login.html';
        return null;
    }
}

// ===================================
// CARGA DE DATOS (CORREGIDA)
// ===================================

async function cargarDatosInventario() {
    try {
        mostrarLoadingInventario(true);
        
        console.log('📦 Cargando datos de inventario...');
        
        // Cargar inventario con categorías
        const { data: inventario, error: invError } = await supabaseInventario
            .from('insumos')
            .select(`
                *,
                categorias_insumos(id, nombre, icono, color)
            `)
            .order('nombre');
        
        if (invError) throw invError;
        
        // Cargar categorías
        const { data: categorias, error: catError } = await supabaseInventario
            .from('categorias_insumos')
            .select('*')
            .eq('activo', true)
            .order('orden');
        
        if (catError) throw catError;
        
        inventarioData = inventario || [];
        categoriasData = categorias || [];
        
        console.log('✅ Datos cargados:', inventarioData.length, 'insumos');
        
        // Renderizar datos
        await renderizarInventario();
        await cargarMovimientosRecientes();
        actualizarEstadisticasInventario();
        cargarFiltrosCategorias();
        
        mostrarLoadingInventario(false);
        
    } catch (error) {
        console.error('Error cargando inventario:', error);
        mostrarError('Error cargando datos del inventario');
        mostrarLoadingInventario(false);
    }
}
// ===================================
// RENDERIZADO DE INVENTARIO
// ===================================

async function renderizarInventario() {
    const tableBody = document.getElementById('inventarioTableBody');
    const alertasContainer = document.getElementById('listaAlertas');
    
    if (!tableBody) return;
    
    let html = '';
    let alertas = [];
    
    inventarioData.forEach(insumo => {
        const categoria = insumo.categorias_insumos;
        const stockStatus = getStockStatus(insumo.stock_actual, insumo.cantidad_warning);
        const estadoClass = getStockStatusClass(stockStatus);
        const accesoTipo = insumo.acceso_tipo || 'todos';
        
        // Verificar alertas de stock crítico (solo insumos activos)
        if (stockStatus === 'critico' && insumo.activo) {
            alertas.push({
                id: insumo.id,
                nombre: insumo.nombre,
                stock: insumo.stock_actual,
                minimo: insumo.cantidad_warning
            });
        }
        
        // Aplicar clase de inactivo si corresponde
        const trClass = !insumo.activo ? 'insumo-inactivo' : '';
        
        html += `
            <tr data-insumo="${insumo.id}" class="${trClass}">
                <td>
                    <div class="insumo-info">
                        <strong>${insumo.nombre}</strong>
                        ${insumo.descripcion ? `<br><small>${insumo.descripcion}</small>` : ''}
                        ${!insumo.activo ? `<br><small style="color: #e74c3c;">❌ INACTIVO</small>` : ''}
                    </div>
                </td>
                <td>
                    <div class="categoria-badge" style="background: ${categoria?.color || '#657153'}20; color: ${categoria?.color || '#657153'}">
                        ${categoria?.icono || '📦'} ${categoria?.nombre || 'Sin categoría'}
                    </div>
                </td>
                <td class="text-center">
                    <span class="stock-numero ${insumo.stock_actual <= insumo.cantidad_warning ? 'stock-bajo' : ''}">${insumo.stock_actual}</span>
                </td>
                <td class="text-center">${insumo.cantidad_warning}</td>
                <td class="text-center">
                    <span class="stock-status ${estadoClass}">${stockStatus.toUpperCase()}</span>
                </td>
                <td class="text-center">${insumo.unidad_medida}</td>
                <td class="text-center">
                    <span class="visibilidad-badge ${getVisibilidadClass(accesoTipo)}">
                        ${getVisibilidadLabel(accesoTipo)}
                    </span>
                </td>
                <td class="text-center">
                    <div class="acciones-inventario">
                        <button class="btn-inventario-action" onclick="abrirModalRestock('${insumo.id}')" title="Agregar Stock" ${!insumo.activo ? 'disabled style="opacity: 0.5;"' : ''}>
                            ➕
                        </button>
                        <button class="btn-inventario-action" onclick="verHistorialInsumo('${insumo.id}')" title="Ver Historial">
                            📊
                        </button>
                        <button class="btn-inventario-action" onclick="editarInsumo('${insumo.id}')" title="Editar">
                            ✏️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    
    // Mostrar/ocultar alertas
    const alertasSection = document.getElementById('alertasInventario');
    if (alertas.length > 0) {
        mostrarAlertas(alertas);
        alertasSection.style.display = 'block';
    } else {
        alertasSection.style.display = 'none';
    }
    
    document.getElementById('tablaInventario').style.display = 'block';
}

// ===================================
// FUNCIONES DE VISIBILIDAD
// ===================================

function getVisibilidadLabel(accesoTipo) {
    const labels = {
        'todos': '👥 Todos',
        'solo_direccion': '🏢 Solo Dirección',
        'ninguno': '🚫 Ninguno'
    };
    return labels[accesoTipo] || accesoTipo || 'todos';
}

function getVisibilidadClass(accesoTipo) {
    const classes = {
        'todos': 'visibilidad-todos',
        'solo_direccion': 'visibilidad-solo_direccion', 
        'ninguno': 'visibilidad-ninguno'
    };
    return classes[accesoTipo] || 'visibilidad-todos';
}

// ===================================
// ESTADÍSTICAS
// ===================================

function actualizarEstadisticasInventario() {
    const totalInsumos = inventarioData.length;
    const stockCritico = inventarioData.filter(item => 
        getStockStatus(item.stock_actual, item.cantidad_warning) === 'critico' && item.activo
    ).length;
    
    const totalActivos = inventarioData.filter(item => item.activo).length;
    
    // Actualizar elementos DOM si existen
    const updateElement = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    updateElement('totalInsumos', totalInsumos);
    updateElement('stockCritico', stockCritico);
    updateElement('totalActivos', totalActivos);
}

// ===================================
// FILTROS Y BÚSQUEDAS
// ===================================

function cargarFiltrosCategorias() {
    const select = document.getElementById('filtroCategoria');
    if (!select) return;
    
    let html = '<option value="">📂 Todas las categorías</option>';
    categoriasData.forEach(categoria => {
        html += `<option value="${categoria.id}">${categoria.icono} ${categoria.nombre}</option>`;
    });
    
    select.innerHTML = html;
}

function filtrarInventario() {
    const filtroCategoria = document.getElementById('filtroCategoria')?.value || '';
    const filtroEstadoStock = document.getElementById('filtroEstadoStock')?.value || '';
    const filtroVisibilidad = document.getElementById('filtroVisibilidad')?.value || '';
    
    console.log('🔍 Aplicando filtros:', {
        categoria: filtroCategoria,
        estadoStock: filtroEstadoStock,
        visibilidad: filtroVisibilidad
    });
    
    let inventarioFiltrado = [...inventarioData];
    
    if (filtroCategoria) {
        inventarioFiltrado = inventarioFiltrado.filter(item => 
            item.categoria_id == filtroCategoria
        );
    }
    
    if (filtroEstadoStock) {
        inventarioFiltrado = inventarioFiltrado.filter(item => {
            const status = getStockStatus(item.stock_actual, item.cantidad_warning);
            return status === filtroEstadoStock;
        });
    }
    
    if (filtroVisibilidad) {
        inventarioFiltrado = inventarioFiltrado.filter(item => {
            const accesoTipo = item.acceso_tipo || 'todos';
            return accesoTipo === filtroVisibilidad;
        });
    }
    
    console.log('📊 Resultados del filtro:', inventarioFiltrado.length, 'insumos');
    renderizarInventarioFiltrado(inventarioFiltrado);
}

function renderizarInventarioFiltrado(items) {
    const tableBody = document.getElementById('inventarioTableBody');
    if (!tableBody) return;
    
    if (items.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No se encontraron insumos</td></tr>';
        return;
    }
    
    let html = '';
    items.forEach(insumo => {
        const categoria = insumo.categorias_insumos;
        const stockStatus = getStockStatus(insumo.stock_actual, insumo.cantidad_warning);
        const estadoClass = getStockStatusClass(stockStatus);
        const accesoTipo = insumo.acceso_tipo || 'todos';
        
        html += `
            <tr data-insumo="${insumo.id}">
                <td>
                    <div class="insumo-info">
                        <strong>${insumo.nombre}</strong>
                        ${insumo.descripcion ? `<br><small>${insumo.descripcion}</small>` : ''}
                    </div>
                </td>
                <td>
                    <div class="categoria-badge" style="background: ${categoria?.color || '#657153'}20; color: ${categoria?.color || '#657153'}">
                        ${categoria?.icono || '📦'} ${categoria?.nombre || 'Sin categoría'}
                    </div>
                </td>
                <td class="text-center">
                    <span class="stock-numero ${insumo.stock_actual <= insumo.cantidad_warning ? 'stock-bajo' : ''}">${insumo.stock_actual}</span>
                </td>
                <td class="text-center">${insumo.cantidad_warning}</td>
                <td class="text-center">
                    <span class="stock-status ${estadoClass}">${stockStatus.toUpperCase()}</span>
                </td>
                <td class="text-center">${insumo.unidad_medida}</td>
                <td class="text-center">
                    <span class="visibilidad-badge ${getVisibilidadClass(accesoTipo)}">
                        ${getVisibilidadLabel(accesoTipo)}
                    </span>
                </td>
                <td class="text-center">
                    <div class="acciones-inventario">
                        <button class="btn-inventario-action" onclick="abrirModalRestock('${insumo.id}')" title="Agregar Stock">
                            ➕
                        </button>
                        <button class="btn-inventario-action" onclick="verHistorialInsumo('${insumo.id}')" title="Ver Historial">
                            📊
                        </button>
                        <button class="btn-inventario-action" onclick="editarInsumo('${insumo.id}')" title="Editar">
                            ✏️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// ===================================
// MODAL DE RESTOCK
// ===================================

function abrirModalRestock(insumoId) {
    const insumo = inventarioData.find(i => i.id == insumoId);
    if (!insumo) return;
    
    // Cargar opciones de insumos en el select
    cargarInsumosEnSelect();
    
    // Pre-seleccionar el insumo si viene de un botón específico
    if (insumoId) {
        setTimeout(() => {
            document.getElementById('insumoSelect').value = insumoId;
            actualizarInfoInsumo();
        }, 100);
    }
    
    document.getElementById('restockModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function cargarInsumosEnSelect() {
    const select = document.getElementById('insumoSelect');
    if (!select) return;
    
    let html = '<option value="">Seleccionar insumo...</option>';
    inventarioData.forEach(insumo => {
        const stockStatus = getStockStatus(insumo.stock_actual, insumo.cantidad_warning);
        const indicador = stockStatus === 'critico' ? '🔴' : stockStatus === 'bajo' ? '🟡' : '🟢';
        
        html += `<option value="${insumo.id}">${indicador} ${insumo.nombre} (Stock: ${insumo.stock_actual})</option>`;
    });
    
    select.innerHTML = html;
}

function actualizarInfoInsumo() {
    const selectInsumo = document.getElementById('insumoSelect');
    const insumoId = selectInsumo.value;
    
    if (!insumoId) {
        document.getElementById('insumoInfoCard').style.display = 'none';
        return;
    }
    
    const insumo = inventarioData.find(i => i.id == insumoId);
    if (!insumo) return;
    
    const accesoTipo = insumo.acceso_tipo || 'todos';
    
    document.getElementById('stockActual').textContent = insumo.stock_actual;
    document.getElementById('stockMinimo').textContent = insumo.cantidad_warning;
    document.getElementById('unidadMedida').textContent = insumo.unidad_medida;
    document.getElementById('visibilidadActual').textContent = getVisibilidadLabel(accesoTipo);
    document.getElementById('insumoInfoCard').style.display = 'block';
    
    // Limpiar campos
    document.getElementById('cantidadAgregar').value = '';
    document.getElementById('nuevoStockPreview').style.display = 'none';
}

function calcularNuevoStock() {
    const selectInsumo = document.getElementById('insumoSelect');
    const cantidadInput = document.getElementById('cantidadAgregar');
    const insumoId = selectInsumo.value;
    const cantidad = parseInt(cantidadInput.value) || 0;
    
    if (!insumoId || cantidad === 0) {
        document.getElementById('nuevoStockPreview').style.display = 'none';
        return;
    }
    
    const insumo = inventarioData.find(i => i.id == insumoId);
    if (!insumo) return;
    
    const nuevoStock = insumo.stock_actual + cantidad;
    document.getElementById('nuevoStockCalculado').textContent = nuevoStock;
    document.getElementById('nuevoStockPreview').style.display = 'block';
}

async function confirmarRestock() {
    try {
        const insumoId = document.getElementById('insumoSelect').value;
        const cantidad = parseInt(document.getElementById('cantidadAgregar').value) || 0;
        const tipoMovimiento = document.getElementById('tipoMovimiento').value;
        const motivo = document.getElementById('motivoRestock').value.trim();
        
        // Validaciones
        if (!insumoId) {
            showNotificationInventario('Selecciona un insumo', 'warning');
            return;
        }
        
        if (cantidad <= 0) {
            showNotificationInventario('Ingresa una cantidad válida mayor a 0', 'warning');
            return;
        }
        
        if (!tipoMovimiento) {
            showNotificationInventario('Selecciona el tipo de movimiento', 'warning');
            return;
        }
        
        const insumo = inventarioData.find(i => i.id == insumoId);
        if (!insumo) throw new Error('Insumo no encontrado');
        
        const stockAnterior = insumo.stock_actual;
        const stockNuevo = stockAnterior + cantidad;
        
        // Deshabilitar botón
        const btnConfirmar = document.getElementById('btnConfirmarRestock');
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '⏳ Procesando...';
        
        // 1. Actualizar stock en insumos
        const { error: stockError } = await supabaseInventario
            .from('insumos')
            .update({ 
                stock_actual: stockNuevo,
                updated_at: new Date().toISOString()
            })
            .eq('id', insumoId);
        
        if (stockError) throw stockError;
        
        // 2. Registrar movimiento
        const { error: movError } = await supabaseInventario
            .from('inventario_movimientos')
            .insert({
                insumo_id: insumoId,
                tipo_movimiento: tipoMovimiento,
                cantidad: cantidad,
                stock_anterior: stockAnterior,
                stock_nuevo: stockNuevo,
                motivo: motivo,
                admin_id: currentSuperAdmin.id
            });
        
        if (movError) throw movError;
        
        // 3. Actualizar datos locales
        const insumoIndex = inventarioData.findIndex(i => i.id == insumoId);
        if (insumoIndex !== -1) {
            inventarioData[insumoIndex].stock_actual = stockNuevo;
        }
        
        // 4. Actualizar UI
        await renderizarInventario();
        actualizarEstadisticasInventario();
        await cargarMovimientosRecientes();
        
        showNotificationInventario(`Stock actualizado: ${insumo.nombre} (+${cantidad} ${insumo.unidad_medida})`, 'success');
        cerrarModalRestock();
        
    } catch (error) {
        console.error('Error en restock:', error);
        showNotificationInventario('Error al actualizar el stock', 'error');
        
        // Rehabilitar botón
        const btnConfirmar = document.getElementById('btnConfirmarRestock');
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '➕ Agregar Stock';
    }
}

function cerrarModalRestock() {
    document.getElementById('restockModal').style.display = 'none';
    document.body.style.overflow = '';
    
    // Limpiar formulario
    document.getElementById('insumoSelect').value = '';
    document.getElementById('cantidadAgregar').value = '';
    document.getElementById('tipoMovimiento').value = '';
    document.getElementById('motivoRestock').value = '';
    document.getElementById('insumoInfoCard').style.display = 'none';
    document.getElementById('nuevoStockPreview').style.display = 'none';
}

// ===================================
// NUEVO INSUMO
// ===================================

function abrirModalNuevoInsumo() {
    // Cargar categorías en el select
    cargarCategoriasEnSelect('categoriaInsumo');
    
    document.getElementById('nuevoInsumoModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function cerrarModalNuevoInsumo() {
    document.getElementById('nuevoInsumoModal').style.display = 'none';
    document.body.style.overflow = '';
    
    // Limpiar formulario
    document.getElementById('nuevoInsumoForm').reset();
}

async function cargarCategoriasEnSelect(selectId) {
    try {
        const { data: categorias, error } = await supabaseInventario
            .from('categorias_insumos')
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre');
        
        if (error) throw error;
        
        const select = document.getElementById(selectId);
        if (!select) {
            console.error('❌ Select no encontrado:', selectId);
            return;
        }
        
        let html = '<option value="">Seleccionar categoría...</option>';
        
        categorias.forEach(categoria => {
            html += `<option value="${categoria.id}">${categoria.nombre}</option>`;
        });
        
        select.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando categorías:', error);
        showNotificationInventario('Error cargando categorías', 'error');
    }
}

async function confirmarNuevoInsumo() {
    try {
        const nombre = document.getElementById('nombreInsumo').value.trim();
        const descripcion = document.getElementById('descripcionInsumo').value.trim();
        const categoriaId = document.getElementById('categoriaInsumo').value;
        const unidad = document.getElementById('unidadInsumo').value;
        const stockInicial = parseInt(document.getElementById('stockInicial').value) || 0;
        const stockMinimo = parseInt(document.getElementById('stockMinimo').value);
        const visibilidad = document.getElementById('visibilidadInsumo').value;
        
        // Validaciones
        if (!nombre || !categoriaId || !unidad || !stockMinimo) {
            showNotificationInventario('Completa todos los campos obligatorios', 'warning');
            return;
        }
        
        if (stockMinimo < 1) {
            showNotificationInventario('El stock mínimo debe ser al menos 1', 'warning');
            return;
        }
        
        const btnConfirmar = document.getElementById('btnConfirmarNuevoInsumo');
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '⏳ Creando...';
        
        // Crear nuevo insumo
        const { data: nuevoInsumo, error } = await supabaseInventario
            .from('insumos')
            .insert({
                nombre: nombre,
                descripcion: descripcion || null,
                categoria_id: categoriaId,
                unidad_medida: unidad,
                stock_actual: stockInicial,
                cantidad_warning: stockMinimo,
                acceso_tipo: visibilidad,
                activo: true,
                creado_por: currentSuperAdmin.id
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Registrar movimiento inicial si hay stock
        if (stockInicial > 0) {
            await supabaseInventario
                .from('inventario_movimientos')
                .insert({
                    insumo_id: nuevoInsumo.id,
                    tipo_movimiento: 'restock',
                    cantidad: stockInicial,
                    stock_anterior: 0,
                    stock_nuevo: stockInicial,
                    motivo: 'Stock inicial al crear insumo',
                    admin_id: currentSuperAdmin.id
                });
        }
        
        showNotificationInventario(`Insumo "${nombre}" creado exitosamente`, 'success');
        cerrarModalNuevoInsumo();
        await cargarDatosInventario();
        
    } catch (error) {
        console.error('Error creando insumo:', error);
        showNotificationInventario('Error al crear el insumo', 'error');
        
        const btnConfirmar = document.getElementById('btnConfirmarNuevoInsumo');
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '🆕 Crear Insumo';
    }
}

// ===================================
// EDITAR INSUMO
// ===================================

async function editarInsumo(insumoId) {
    try {
        console.log('🔄 Intentando editar insumo ID:', insumoId);
        console.log('📊 Total de insumos cargados:', inventarioData.length);
        
        // Mostrar todos los IDs para debug
        console.log('📋 IDs de insumos disponibles:', inventarioData.map(i => i.id));
        
        // Buscar el insumo - asegurar comparación correcta
        const insumo = inventarioData.find(i => i.id == insumoId); // == en lugar de ===
        
        if (!insumo) {
            console.error('❌ Insumo no encontrado. ID buscado:', insumoId);
            console.error('💡 Tip: Verificar que el insumo esté en inventarioData');
            showNotificationInventario('Insumo no encontrado en los datos cargados', 'error');
            return;
        }
        
        console.log('✅ Insumo encontrado:', insumo.nombre);
        
        // Cargar categorías en el select
        await cargarCategoriasEnSelect('editarCategoria');
        
        // Llenar formulario con datos actuales
        document.getElementById('editarInsumoId').value = insumo.id;
        document.getElementById('editarNombre').value = insumo.nombre;
        document.getElementById('editarDescripcion').value = insumo.descripcion || '';
        document.getElementById('editarCategoria').value = insumo.categoria_id;
        document.getElementById('editarUnidad').value = insumo.unidad_medida;
        document.getElementById('editarStockMinimo').value = insumo.cantidad_warning;
        document.getElementById('editarVisibilidad').value = insumo.acceso_tipo || 'todos';
        document.getElementById('editarActivo').value = insumo.activo.toString();
        
        document.getElementById('editarInsumoModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error preparando edición:', error);
        showNotificationInventario('Error al cargar datos del insumo', 'error');
    }
}

function cerrarModalEditarInsumo() {
    document.getElementById('editarInsumoModal').style.display = 'none';
    document.body.style.overflow = '';
}

async function confirmarEdicionInsumo() {
    const btnConfirmar = document.getElementById('btnConfirmarEdicion');
    
    try {
        // OBTENER EL ID DEL FORMULARIO - ESTO FALTA
        const insumoId = document.getElementById('editarInsumoId').value;
        
        // Validar que tengamos un ID
        if (!insumoId) {
            showNotificationInventario('Error: ID de insumo no encontrado', 'error');
            return;
        }

        const nombre = document.getElementById('editarNombre').value.trim();
        const descripcion = document.getElementById('editarDescripcion').value.trim();
        const categoriaId = document.getElementById('editarCategoria').value;
        const unidad = document.getElementById('editarUnidad').value;
        const stockMinimo = parseInt(document.getElementById('editarStockMinimo').value);
        const visibilidad = document.getElementById('editarVisibilidad').value;
        const activo = document.getElementById('editarActivo').value === 'true';
        
        // Validaciones
        if (!nombre || !categoriaId || !unidad || !stockMinimo) {
            showNotificationInventario('Completa todos los campos obligatorios', 'warning');
            return;
        }
        
        if (stockMinimo < 1) {
            showNotificationInventario('El stock mínimo debe ser al menos 1', 'warning');
            return;
        }
        
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '⏳ Guardando...';
        
        // Actualizar insumo
        const { error } = await supabaseInventario
            .from('insumos')
            .update({
                nombre: nombre,
                descripcion: descripcion || null,
                categoria_id: categoriaId,
                unidad_medida: unidad,
                cantidad_warning: stockMinimo,
                acceso_tipo: visibilidad,
                activo: activo,
                updated_at: new Date().toISOString()
            })
            .eq('id', insumoId);
        
        if (error) throw error;
        
        showNotificationInventario(`Insumo "${nombre}" actualizado exitosamente`, 'success');
        cerrarModalEditarInsumo();
        
        // 🔄 ACTUALIZACIÓN: Recargar datos y re-aplicar filtros
        await cargarDatosInventario();
        
        const filtroCategoria = document.getElementById('filtroCategoria')?.value || '';
        const filtroEstadoStock = document.getElementById('filtroEstadoStock')?.value || '';
        const filtroVisibilidad = document.getElementById('filtroVisibilidad')?.value || '';
        
        if (filtroCategoria || filtroEstadoStock || filtroVisibilidad) {
            filtrarInventario();
        }
        
    } catch (error) {
        console.error('Error editando insumo:', error);
        showNotificationInventario('Error al actualizar el insumo', 'error');
    } finally {
        // ⚠️ ESTA LÍNEA ES CRÍTICA - Reactivar el botón SIEMPRE
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '💾 Guardar Cambios';
    }
}

// ===================================
// REPORTES Y MOVIMIENTOS
// ===================================

async function cargarMovimientosRecientes() {
    try {
        const { data: movimientos, error } = await supabaseInventario
            .from('inventario_movimientos')
            .select(`
                *,
                insumos(nombre, unidad_medida),
                usuarios:admin_id(nombre)
            `)
            .order('fecha', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        movimientosData = movimientos || [];
        renderizarMovimientosRecientes();
        
    } catch (error) {
        console.error('Error cargando movimientos:', error);
    }
}

function renderizarMovimientosRecientes() {
    const container = document.getElementById('movimientosRecientes');
    if (!container) return;
    
    if (movimientosData.length === 0) {
        container.innerHTML = '<p class="no-movimientos">No hay movimientos recientes</p>';
        return;
    }
    
    let html = '<div class="movimientos-list">';
    movimientosData.forEach(mov => {
        const tipoIcon = getTipoMovimientoIcon(mov.tipo_movimiento);
        const cantidad = mov.tipo_movimiento === 'entrega' ? mov.cantidad : Math.abs(mov.cantidad);
        const signo = mov.cantidad > 0 ? '+' : '';
        
        html += `
            <div class="movimiento-item ${mov.tipo_movimiento}">
                <div class="movimiento-icon">${tipoIcon}</div>
                <div class="movimiento-info">
                    <div class="movimiento-header">
                        <strong>${mov.insumos?.nombre || 'Insumo eliminado'}</strong>
                        <span class="movimiento-fecha">${new Date(mov.fecha).toLocaleDateString()}</span>
                    </div>
                    <div class="movimiento-detalles">
                        <span class="movimiento-tipo">${getTipoMovimientoLabel(mov.tipo_movimiento)}</span>
                        <span class="movimiento-cantidad ${mov.cantidad > 0 ? 'positivo' : 'negativo'}">
                            ${signo}${cantidad} ${mov.insumos?.unidad_medida || ''}
                        </span>
                    </div>
                    <div class="movimiento-stock">
                        Stock: ${mov.stock_anterior} → ${mov.stock_nuevo}
                    </div>
                    ${mov.motivo ? `<div class="movimiento-motivo">${mov.motivo}</div>` : ''}
                </div>
                <div class="movimiento-admin">
                    <small>Por: ${mov.usuarios?.nombre || 'Sistema'}</small>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    container.innerHTML = html;
}

function getTipoMovimientoIcon(tipo) {
    const icons = {
        'entrega': '📤',
        'restock': '📦',
        'ajuste': '⚙️',
        'perdida': '⚠️',
        'donacion': '🎁'
    };
    return icons[tipo] || '📊';
}

function getTipoMovimientoLabel(tipo) {
    const labels = {
        'entrega': 'Entrega',
        'restock': 'Restock',
        'ajuste': 'Ajuste',
        'perdida': 'Pérdida',
        'donacion': 'Donación'
    };
    return labels[tipo] || tipo;
}

// ===================================
// HISTORIAL COMPLETO
// ===================================

function verHistorialCompleto() {
    cargarHistorialCompleto();
    document.getElementById('historialModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

async function cargarHistorialCompleto() {
    try {
        const filtroTipo = document.getElementById('filtroTipoMovimiento')?.value || '';
        const filtroDesde = document.getElementById('filtroFechaDesde')?.value || '';
        const filtroHasta = document.getElementById('filtroFechaHasta')?.value || '';
        
        let query = supabaseInventario
            .from('inventario_movimientos')
            .select(`
                *,
                insumos(nombre, unidad_medida),
                usuarios:admin_id(nombre)
            `)
            .order('fecha', { ascending: false });
        
        if (filtroTipo) {
            query = query.eq('tipo_movimiento', filtroTipo);
        }
        
        if (filtroDesde) {
            query = query.gte('fecha', filtroDesde + 'T00:00:00');
        }
        
        if (filtroHasta) {
            query = query.lte('fecha', filtroHasta + 'T23:59:59');
        }
        
        const { data: movimientos, error } = await query.limit(100);
        
        if (error) throw error;
        
        renderizarHistorialCompleto(movimientos || []);
        
    } catch (error) {
        console.error('Error cargando historial completo:', error);
        showNotificationInventario('Error cargando historial', 'error');
    }
}

/*function renderizarHistorialCompleto(movimientos) {
    const container = document.getElementById('historialCompleto');
    if (!container) return;
    
    if (movimientos.length === 0) {
        container.innerHTML = '<p class="text-center">No se encontraron movimientos con los filtros aplicados</p>';
        return;
    }
    
    let html = '<div class="historial-tabla">';
    html += `
        <div class="historial-header">
            <div>Fecha</div>
            <div>Insumo</div>
            <div>Tipo</div>
            <div>Cantidad</div>
            <div>Stock</div>
            <div>Admin</div>
        </div>
    `;
    
    movimientos.forEach(mov => {
        const tipoIcon = getTipoMovimientoIcon(mov.tipo_movimiento);
        const cantidad = mov.tipo_movimiento === 'entrega' ? mov.cantidad : Math.abs(mov.cantidad);
        const signo = mov.cantidad > 0 ? '+' : '';
        
        html += `
            <div class="historial-row">
                <div class="historial-fecha">${new Date(mov.fecha).toLocaleDateString()}</div>
                <div class="historial-insumo">${mov.insumos?.nombre || 'N/A'}</div>
                <div class="historial-tipo">${tipoIcon} ${getTipoMovimientoLabel(mov.tipo_movimiento)}</div>
                <div class="historial-cantidad ${mov.cantidad > 0 ? 'positivo' : 'negativo'}">
                    ${signo}${cantidad}
                </div>
                <div class="historial-stock">${mov.stock_anterior} → ${mov.stock_nuevo}</div>
                <div class="historial-admin">${mov.usuarios?.nombre || 'Sistema'}</div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}*/


function renderizarHistorialCompleto(movimientos) {
    const container = document.getElementById('historialCompleto');
    if (!container) return;

    if (movimientos.length === 0) {
        container.innerHTML = '<p class="text-center">No se encontraron movimientos con los filtros aplicados</p>';
        return;
    }

    let html = '<div class="historial-tabla">';

    // Header con la clase compartida
    html += `
        <div class="historial-header-row historial-grid">
            <div>Fecha</div>
            <div>Insumo</div>
            <div>Tipo</div>
            <div>Cantidad</div>
            <div>Stock</div>
            <div>Admin</div>
        </div>
    `;

    // Filas con la misma grilla
    movimientos.forEach(mov => {
        const tipoIcon = getTipoMovimientoIcon(mov.tipo_movimiento);
        const cantidad = mov.tipo_movimiento === 'entrega' ? mov.cantidad : Math.abs(mov.cantidad);
        const signo = mov.cantidad > 0 ? '+' : '';

        html += `
            <div class="historial-row historial-grid">
                <div class="historial-fecha">${new Date(mov.fecha).toLocaleDateString()}</div>
                <div class="historial-insumo">${mov.insumos?.nombre || 'N/A'}</div>
                <div class="historial-tipo">${tipoIcon} ${getTipoMovimientoLabel(mov.tipo_movimiento)}</div>
                <div class="historial-cantidad ${mov.cantidad > 0 ? 'positivo' : 'negativo'}">
                    ${signo}${cantidad}
                </div>
                <div class="historial-stock">${mov.stock_anterior} → ${mov.stock_nuevo}</div>
                <div class="historial-admin">${mov.usuarios?.nombre || 'Sistema'}</div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}


function cerrarHistorialModal() {
    document.getElementById('historialModal').style.display = 'none';
    document.body.style.overflow = '';
}

// ===================================
// UTILIDADES Y HELPERS
// ===================================

function getStockStatus(stockActual, stockMinimo) {
    if (stockActual === 0) return 'critico';
    if (stockActual <= stockMinimo) return 'bajo';
    if (stockActual <= stockMinimo * 2) return 'normal';
    return 'alto';
}

function getStockStatusClass(status) {
    const classes = {
        'critico': 'status-critico',
        'bajo': 'status-bajo',
        'normal': 'status-normal',
        'alto': 'status-alto'
    };
    return classes[status] || 'status-normal';
}

function actualizarInventario() {
    cargarDatosInventario();
}


function exportarInventario() {
    // Preparar datos para exportación
    const data = inventarioData.map(item => ({
        'Insumo': item.nombre,
        'Categoría': item.categorias_insumos?.nombre || 'Sin categoría',
        'Stock Actual': item.stock_actual,
        'Stock Mínimo': item.cantidad_warning,
        'Unidad': item.unidad_medida,
        'Visibilidad': getVisibilidadLabel(item.acceso_tipo),
        'Estado': getStockStatus(item.stock_actual, item.cantidad_warning),
        'Activo': item.activo ? 'Sí' : 'No'
    }));
    
    // Convertir a CSV
    const csvContent = convertirACSV(data);
    
    // Agregar BOM (Byte Order Mark) para UTF-8 - ¡ESTO ES CLAVE!
    const BOM = '\uFEFF';
    const contentWithBOM = BOM + csvContent;
    
    // Usar tipo MIME específico para CSV UTF-8
    const blob = new Blob([contentWithBOM], { 
        type: 'text/csv;charset=utf-8;' 
    });
    
    // Descargar como CSV (Excel lo abre perfectamente)
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Liberar memoria
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    showNotificationInventario('Inventario exportado exitosamente', 'success');
}

function convertirACSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) {
                return '';
            }
            
            const stringValue = value.toString();
            // Escapar comillas y caracteres problemáticos
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(','))
    ].join('\r\n'); // \r\n para compatibilidad con Windows/Excel
    
    return csvContent;
}

function ocultarAlertas() {
    document.getElementById('alertasInventario').style.display = 'none';
}

function mostrarLoadingInventario(show) {
    const loading = document.getElementById('loadingInventario');
    const tabla = document.getElementById('tablaInventario');
    const sinInventario = document.getElementById('sinInventario');
    
    if (loading) loading.style.display = show ? 'block' : 'none';
    if (tabla) tabla.style.display = show ? 'none' : (inventarioData.length > 0 ? 'block' : 'none');
    if (sinInventario) sinInventario.style.display = show ? 'none' : (inventarioData.length === 0 ? 'block' : 'none');
}

function mostrarError(mensaje) {
    showNotificationInventario(mensaje, 'error');
}

function showNotificationInventario(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification-inventario notification-${type}`;
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
    
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }
}

// ===================================
// FUNCIONES ADICIONALES
// ===================================

function verHistorialInsumo(insumoId) {
    const insumo = inventarioData.find(i => i.id == insumoId);
    if (!insumo) return;
    
    // Mostrar modal de historial filtrado por este insumo específico
    cargarHistorialInsumo(insumoId);
    document.getElementById('historialModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

async function cargarHistorialInsumo(insumoId) {
    try {
        const { data: movimientos, error } = await supabaseInventario
            .from('inventario_movimientos')
            .select(`
                *,
                insumos(nombre, unidad_medida),
                usuarios:admin_id(nombre)
            `)
            .eq('insumo_id', insumoId)
            .order('fecha', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        renderizarHistorialCompleto(movimientos || []);
        
    } catch (error) {
        console.error('Error cargando historial del insumo:', error);
        showNotificationInventario('Error cargando historial del insumo', 'error');
    }
}

function configurarEventListeners() {
    // Filtros
    const filtroCategoria = document.getElementById('filtroCategoria');
    const filtroEstadoStock = document.getElementById('filtroEstadoStock');
    const filtroVisibilidad = document.getElementById('filtroVisibilidad');
    
    if (filtroCategoria) {
        filtroCategoria.addEventListener('change', filtrarInventario);
    }
    
    if (filtroEstadoStock) {
        filtroEstadoStock.addEventListener('change', filtrarInventario);
    }
    
    if (filtroVisibilidad) {
        filtroVisibilidad.addEventListener('change', filtrarInventario);
    }
    
    // Campos del modal de restock
    const insumoSelect = document.getElementById('insumoSelect');
    const cantidadAgregar = document.getElementById('cantidadAgregar');
    
    if (insumoSelect) {
        insumoSelect.addEventListener('change', actualizarInfoInsumo);
    }
    
    if (cantidadAgregar) {
        cantidadAgregar.addEventListener('input', calcularNuevoStock);
    }
    
    // Filtros de historial
    const filtroTipoMovimiento = document.getElementById('filtroTipoMovimiento');
    const filtroFechaDesde = document.getElementById('filtroFechaDesde');
    const filtroFechaHasta = document.getElementById('filtroFechaHasta');
    
    if (filtroTipoMovimiento) {
        filtroTipoMovimiento.addEventListener('change', cargarHistorialCompleto);
    }
    
    if (filtroFechaDesde) {
        filtroFechaDesde.addEventListener('change', cargarHistorialCompleto);
    }
    
    if (filtroFechaHasta) {
        filtroFechaHasta.addEventListener('change', cargarHistorialCompleto);
    }
}



// ===================================
// FUNCIONES DEL HEADER ADMINISTRATIVO
// ===================================

// Toggle del menú de usuario
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        const isVisible = dropdown.style.display !== 'none';
        dropdown.style.display = isVisible ? 'none' : 'block';
    }
}

// Cerrar sesión
function logout() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

// Inicializar el header después de cargarse
function inicializarHeaderAdmin() {
    const session = sessionStorage.getItem('currentUser');
    if (session) {
        try {
            const user = JSON.parse(session);

            // Actualizar nombre de usuario
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = user.nombre;
            }

            // Solo super_admin ve inventario
            if (user.rol !== 'super_admin') {
                const inventarioLink = document.getElementById('inventarioLink');
                if (inventarioLink) {
                    inventarioLink.style.display = 'none';
                }
            }

            console.log('Header administrativo inicializado para:', user.nombre);

        } catch (error) {
            console.error('Error inicializando header admin:', error);
        }
    }
}

// Cerrar dropdown al hacer click fuera
document.addEventListener('click', function (e) {
    if (!e.target.closest('.user-menu') && !e.target.closest('.user-dropdown')) {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }
});

// ===================================
// CARGA DEL HEADER DINÁMICO
// ===================================

// Función para cargar el header
async function cargarHeaderAdmin() {
    try {
        const response = await fetch('includes/headerAdmin.html');
        if (!response.ok) throw new Error('Error cargando header');

        const html = await response.text();
        const headerContainer = document.getElementById('header-contain');

        if (headerContainer) {
            headerContainer.innerHTML = html;
            console.log('Header administrativo cargado');

            // Inicializar después de cargar el HTML
            setTimeout(inicializarHeaderAdmin, 100);
        }
    } catch (error) {
        console.error('Error cargando header administrativo:', error);
        // Fallback básico
        const headerContainer = document.getElementById('header-contain');
        if (headerContainer) {
            headerContainer.innerHTML = `
                <header class="header">
                    <div class="container">
                        <div class="header-content">
                            <div class="logo-section">
                                <h1>Panel de Administración</h1>
                            </div>
                            <div class="user-section">
                                <span class="user-name">Usuario</span>
                                <a href="login.html" style="margin-left: 1rem;">Cerrar Sesión</a>
                            </div>
                        </div>
                    </div>
                </header>
            `;
        }
    }
}

// ===================================
// CARGA DEL FOOTER
// ===================================

async function cargarFooter() {
    try {
        const response = await fetch('includes/footerAdmin.html');
        if (!response.ok) throw new Error('Error cargando footer');
        
        const html = await response.text();
        const footerContainer = document.getElementById('footer-container');
        
        if (footerContainer) {
            footerContainer.innerHTML = html;
            console.log('Footer cargado correctamente');
        }
    } catch (error) {
        console.error('Error cargando footer:', error);
        // Footer básico si hay error
        const footerContainer = document.getElementById('footer-container');
        if (footerContainer) {
            footerContainer.innerHTML = `
                <footer>
                    <div class="container">
                        <p>&copy; ${new Date().getFullYear()} Sistema de Administración</p>
                    </div>
                </footer>
            `;
        }
    }
}

// ===================================
// INICIALIZACIÓN DEL ADMIN
// ===================================

document.addEventListener('DOMContentLoaded', function () {
    // 1. Verificar autenticación primero
    const session = sessionStorage.getItem('currentUser');
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const user = JSON.parse(session);
        
        // Verificar si es administrador
        if (user.rol !== 'admin' && user.rol !== 'super_admin') {
            showNotificationAdmin('No tienes permisos de administrador', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }
        
        console.log('Usuario admin autenticado:', user.nombre);

    } catch (error) {
        console.error('Error verificando autenticación:', error);
        window.location.href = 'login.html';
        return;
    }

    // 2. Cargar header y footer
    cargarHeaderAdmin();
    cargarFooter(); 

    // 3. Inicializar header después de que se cargue
    // (esto se hace dentro de cargarHeaderAdmin con setTimeout)

    // 4. Cargar las solicitudes y demás funcionalidad admin
    setTimeout(() => {
        // Esta función ya debe estar definida en tu admin.js
        if (typeof cargarSolicitudesAdmin === 'function') {
            cargarSolicitudesAdmin();
        }
        if (typeof actualizarEstadisticasAdmin === 'function') {
            actualizarEstadisticasAdmin();
        }
        if (typeof verificarSuperAdmin === 'function') {
            verificarSuperAdmin();
        }
    }, 800); // Un poco más de tiempo para que cargue el header
});



// ===================================
// MANEJO DE ERRORES GLOBALES
// ===================================

window.addEventListener('error', function(e) {
    console.error('Error en inventario:', e.error);
    showNotificationInventario('Error inesperado en el sistema de inventario', 'error');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise rechazada en inventario:', e.reason);
    showNotificationInventario('Error de conexión con la base de datos', 'error');
});

console.log('📦 Inventario.js cargado completamente');
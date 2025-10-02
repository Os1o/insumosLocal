/* ===================================
   SISTEMA DE INVENTARIO POLIMÓRFICO - inventario.js
   Gestión completa de insumos y papelería
   =================================== */

// Variables globales expandidas
let inventarioData = [];
let categoriasData = [];
let categoriasPapeleriaData = [];
let movimientosData = [];
let currentSuperAdmin = null;
let tipoRecursoActual = 'insumo'; // 'insumo' o 'papeleria'
let tipoItemActual = 'insumo'; // 'insumo' o 'papeleria'


// Configuración Supabase - INICIALIZACIÓN INMEDIATA
const supabaseInventario = window.supabase.createClient(
    'https://nxuvisaibpmdvraybzbm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54dXZpc2FpYnBtZHZyYXliemJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4OTMxNjQsImV4cCI6MjA3MTQ2OTE2NH0.OybYM_E3mWsZym7mEf-NiRtrG0svkylXx_q8Tivonfg'
);

// ===================================
// INICIALIZACIÓN DEL SISTEMA
// ===================================

document.addEventListener('DOMContentLoaded', async function () {
    console.log('🔄 Inicializando sistema de inventario polimórfico...');

    await cargarHeaderAdmin();
    await cargarFooter();
    try {
        // 1. Verificar permisos
        currentSuperAdmin = verificarPermisosSuperAdmin();
        if (!currentSuperAdmin) return;

        // 2. Cargar datos iniciales
        await cargarDatosInventario();

        // 3. Configurar event listeners
        configurarEventListeners();

        // 4. Agregar selector de tipo de recurso
        agregarSelectorTipoRecurso();

        console.log('✅ Sistema de inventario polimórfico inicializado correctamente');

    } catch (error) {
        console.error('❌ Error inicializando inventario:', error);
        mostrarError('Error al cargar el sistema de inventario');
    }

    const filtroTipoRecurso = document.getElementById('filtroTipoRecurso');
    if (filtroTipoRecurso) {
        filtroTipoRecurso.addEventListener('change', cambiarTipoRecurso);

        // Configurar estado inicial
        cambiarTipoRecurso();
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
// CARGA DE DATOS POLIMÓRFICA
// ===================================

async function cargarDatosInventario() {
    try {
        mostrarLoadingInventario(true);

        console.log(`📦 Cargando datos de ${tipoRecursoActual}...`);

        // Cargar ambos tipos de categorías
        await Promise.all([
            cargarCategoriasInsumos(),
            cargarCategoriasPapeleria()
        ]);

        // Cargar inventario según tipo actual
        await cargarInventarioActual();

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

async function cargarCategoriasInsumos() {
    try {
        const { data: categorias, error } = await supabaseInventario
            .from('categorias_insumos')
            .select('*')
            .eq('activo', true)
            .order('orden');

        if (error) throw error;
        categoriasData = categorias || [];

    } catch (error) {
        console.error('Error cargando categorías de insumos:', error);
    }
}

async function cargarCategoriasPapeleria() {
    try {
        const { data: categorias, error } = await supabaseInventario
            .from('categorias_papeleria')
            .select('*')
            .eq('activo', true)
            .order('orden');

        if (error) throw error;
        categoriasPapeleriaData = categorias || [];

    } catch (error) {
        console.error('Error cargando categorías de papelería:', error);
    }
}

async function cargarInventarioActual() {
    try {
        let query, data, error;

        if (tipoRecursoActual === 'papeleria') {
            // Consulta para papelería
            ({ data, error } = await supabaseInventario
                .from('papeleria')
                .select(`
                    *,
                    categorias_papeleria(id, nombre, icono, color)
                `)
                .order('nombre'));
        } else {
            // Consulta para insumos
            ({ data, error } = await supabaseInventario
                .from('insumos')
                .select(`
                    *,
                    categorias_insumos(id, nombre, icono, color)
                `)
                .order('nombre'));
        }

        if (error) throw error;

        inventarioData = data || [];
        console.log(`✅ Datos cargados: ${inventarioData.length} items de ${tipoRecursoActual}`);

    } catch (error) {
        console.error('Error cargando inventario actual:', error);
        throw error;
    }
}

// ===================================
// SELECTOR DE TIPO DE RECURSO
// ===================================

function agregarSelectorTipoRecurso() {
    // Buscar el contenedor de filtros existente
    const filtrosContainer = document.querySelector('.inventario-filtros');
    if (!filtrosContainer) return;

    // Verificar si ya existe el selector
    if (document.getElementById('filtroTipoRecurso')) return;

    // Crear selector de tipo de recurso
    const selectorContainer = document.createElement('div');
    selectorContainer.className = 'filtro-grupo';
    selectorContainer.innerHTML = `
        <label for="filtroTipoRecurso">Tipo de Recurso:</label>
        <select id="filtroTipoRecurso" onchange="cambiarTipoRecurso()">
            <option value="insumo">📦 Insumos</option>
            <option value="papeleria">📝 Papelería</option>
        </select>
    `;

    // Insertar al inicio de los filtros
    filtrosContainer.insertBefore(selectorContainer, filtrosContainer.firstChild);
}

async function cambiarTipoRecurso() {
    const selector = document.getElementById('filtroTipoRecurso');
    if (!selector) return;

    tipoRecursoActual = selector.value;

    console.log(`🔄 Cambiando a tipo de recurso: ${tipoRecursoActual}`);

    // Limpiar filtros
    limpiarFiltros();

    // Actualizar título de la página
    actualizarTituloSeccion();

    // Recargar datos
    await cargarInventarioActual();
    await renderizarInventario();
    actualizarEstadisticasInventario();

    // Actualizar filtro de categorías
    cargarFiltrosCategorias();
}

function actualizarTituloSeccion() {
    const titulo = document.querySelector('.inventario-header h2');
    if (titulo) {
        titulo.textContent = tipoRecursoActual === 'papeleria'
            ? '📝 Gestión de Inventario - Papelería'
            : '📦 Gestión de Inventario - Insumos';
    }
}

function limpiarFiltros() {
    const filtros = ['filtroCategoria', 'filtroEstadoStock', 'filtroVisibilidad'];
    filtros.forEach(filtroId => {
        const filtro = document.getElementById(filtroId);
        if (filtro) filtro.value = '';
    });
}

// ===================================
// RENDERIZADO POLIMÓRFICO
// ===================================

async function renderizarInventario() {
    const tableBody = document.getElementById('inventarioTableBody');
    const alertasContainer = document.getElementById('listaAlertas');

    if (!tableBody) return;

    let html = '';
    let alertas = [];

    inventarioData.forEach(item => {
        // Manejar categoría polimórfica
        const categoria = tipoRecursoActual === 'papeleria'
            ? item.categorias_papeleria
            : item.categorias_insumos;

        const stockStatus = getStockStatus(item.stock_actual, item.cantidad_warning);
        const estadoClass = getStockStatusClass(stockStatus);
        const accesoTipo = item.acceso_tipo || 'todos';

        // Verificar alertas de stock crítico (solo items activos)
        if (stockStatus === 'critico' && item.activo) {
            alertas.push({
                id: item.id,
                nombre: item.nombre,
                stock: item.stock_actual,
                minimo: item.cantidad_warning
            });
        }

        // Aplicar clase de inactivo si corresponde
        const trClass = !item.activo ? 'insumo-inactivo' : '';

        html += `
            <tr data-item="${item.id}" data-tipo="${tipoRecursoActual}" class="${trClass}">
                <td>
                    <div class="insumo-info">
                        <strong>${item.nombre}</strong>
                        ${item.descripcion ? `<br><small>${item.descripcion}</small>` : ''}
                        ${!item.activo ? `<br><small style="color: #e74c3c;">❌ INACTIVO</small>` : ''}
                    </div>
                </td>
                <td>
                    <div class="categoria-badge" style="background: ${categoria?.color || '#657153'}20; color: ${categoria?.color || '#657153'}">
                        ${categoria?.icono || (tipoRecursoActual === 'papeleria' ? '📝' : '📦')} ${categoria?.nombre || 'Sin categoría'}
                    </div>
                </td>
                <td class="text-center">
                    <span class="stock-numero ${item.stock_actual <= item.cantidad_warning ? 'stock-bajo' : ''}">${item.stock_actual}</span>
                </td>
                <td class="text-center">${item.cantidad_warning}</td>
                <td class="text-center">
                    <span class="stock-status ${estadoClass}">${stockStatus.toUpperCase()}</span>
                </td>
                <td class="text-center">${item.unidad_medida}</td>
                <td class="text-center">
                    <span class="visibilidad-badge ${getVisibilidadClass(accesoTipo)}">
                        ${getVisibilidadLabel(accesoTipo)}
                    </span>
                </td>
                <td class="text-center">
                    <div class="acciones-inventario">
                        <button class="btn-inventario-action" onclick="abrirModalRestock('${item.id}')" title="Agregar Stock" ${!item.activo ? 'disabled style="opacity: 0.5;"' : ''}>
                            ➕
                        </button>
                        <button class="btn-inventario-action" onclick="verHistorialItem('${item.id}')" title="Ver Historial">
                            📊
                        </button>
                        <button class="btn-inventario-action" onclick="editarItem('${item.id}')" title="Editar">
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
        if (alertasSection) alertasSection.style.display = 'block';
    } else {
        if (alertasSection) alertasSection.style.display = 'none';
    }

    document.getElementById('tablaInventario').style.display = 'block';
}

// ===================================
// ESTADÍSTICAS POLIMÓRFICAS
// ===================================

function actualizarEstadisticasInventario() {
    const totalItems = inventarioData.length;
    const stockCritico = inventarioData.filter(item =>
        getStockStatus(item.stock_actual, item.cantidad_warning) === 'critico' && item.activo
    ).length;

    const totalActivos = inventarioData.filter(item => item.activo).length;

    // Actualizar elementos DOM si existen
    const updateElement = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    updateElement('totalInsumos', totalItems);
    updateElement('stockCritico', stockCritico);
    updateElement('totalActivos', totalActivos);
}

// ===================================
// FILTROS POLIMÓRFICOS
// ===================================

function cargarFiltrosCategorias() {
    const select = document.getElementById('filtroCategoria');
    if (!select) return;

    const categorias = tipoRecursoActual === 'papeleria'
        ? categoriasPapeleriaData
        : categoriasData;

    let html = '<option value="">📂 Todas las categorías</option>';
    categorias.forEach(categoria => {
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

    const tipoTexto = tipoRecursoActual === 'papeleria' ? 'papelería' : 'insumos';
    console.log(`📊 Resultados del filtro: ${inventarioFiltrado.length} items de ${tipoTexto}`);
    renderizarInventarioFiltrado(inventarioFiltrado);
}

function renderizarInventarioFiltrado(items) {
    const tableBody = document.getElementById('inventarioTableBody');
    if (!tableBody) return;

    if (items.length === 0) {
        const tipoTexto = tipoRecursoActual === 'papeleria' ? 'papelería' : 'insumos';
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center">No se encontraron items de ${tipoTexto}</td></tr>`;
        return;
    }

    let html = '';
    items.forEach(item => {
        // Manejar categoría polimórfica
        const categoria = tipoRecursoActual === 'papeleria'
            ? item.categorias_papeleria
            : item.categorias_insumos;

        const stockStatus = getStockStatus(item.stock_actual, item.cantidad_warning);
        const estadoClass = getStockStatusClass(stockStatus);
        const accesoTipo = item.acceso_tipo || 'todos';

        html += `
            <tr data-item="${item.id}" data-tipo="${tipoRecursoActual}">
                <td>
                    <div class="insumo-info">
                        <strong>${item.nombre}</strong>
                        ${item.descripcion ? `<br><small>${item.descripcion}</small>` : ''}
                    </div>
                </td>
                <td>
                    <div class="categoria-badge" style="background: ${categoria?.color || '#657153'}20; color: ${categoria?.color || '#657153'}">
                        ${categoria?.icono || (tipoRecursoActual === 'papeleria' ? '📝' : '📦')} ${categoria?.nombre || 'Sin categoría'}
                    </div>
                </td>
                <td class="text-center">
                    <span class="stock-numero ${item.stock_actual <= item.cantidad_warning ? 'stock-bajo' : ''}">${item.stock_actual}</span>
                </td>
                <td class="text-center">${item.cantidad_warning}</td>
                <td class="text-center">
                    <span class="stock-status ${estadoClass}">${stockStatus.toUpperCase()}</span>
                </td>
                <td class="text-center">${item.unidad_medida}</td>
                <td class="text-center">
                    <span class="visibilidad-badge ${getVisibilidadClass(accesoTipo)}">
                        ${getVisibilidadLabel(accesoTipo)}
                    </span>
                </td>
                <td class="text-center">
                    <div class="acciones-inventario">
                        <button class="btn-inventario-action" onclick="abrirModalRestock('${item.id}')" title="Agregar Stock">
                            ➕
                        </button>
                        <button class="btn-inventario-action" onclick="verHistorialItem('${item.id}')" title="Ver Historial">
                            📊
                        </button>
                        <button class="btn-inventario-action" onclick="editarItem('${item.id}')" title="Editar">
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
// MODAL DE RESTOCK POLIMÓRFICO
// ===================================

function abrirModalRestock(itemId) {
    const item = inventarioData.find(i => i.id == itemId);
    if (!item) return;

    // Cargar opciones de items en el select
    cargarItemsEnSelect();

    // Pre-seleccionar el item si viene de un botón específico
    if (itemId) {
        setTimeout(() => {
            document.getElementById('insumoSelect').value = itemId;
            actualizarInfoInsumo();
        }, 100);
    }

    document.getElementById('restockModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function cargarItemsEnSelect() {
    const select = document.getElementById('insumoSelect');
    if (!select) return;

    const tipoTexto = tipoRecursoActual === 'papeleria' ? 'papelería' : 'insumo';
    let html = `<option value="">Seleccionar ${tipoTexto}...</option>`;

    inventarioData.forEach(item => {
        const stockStatus = getStockStatus(item.stock_actual, item.cantidad_warning);
        const indicador = stockStatus === 'critico' ? '🔴' : stockStatus === 'bajo' ? '🟡' : '🟢';

        html += `<option value="${item.id}">${indicador} ${item.nombre} (Stock: ${item.stock_actual})</option>`;
    });

    select.innerHTML = html;
}

async function confirmarRestock() {
    try {
        const itemId = document.getElementById('insumoSelect').value;
        const cantidad = parseInt(document.getElementById('cantidadAgregar').value) || 0;
        const tipoMovimiento = document.getElementById('tipoMovimiento').value;
        const motivo = document.getElementById('motivoRestock').value.trim();

        // Validaciones
        if (!itemId) {
            showNotificationInventario(`Selecciona un ${tipoRecursoActual === 'papeleria' ? 'item de papelería' : 'insumo'}`, 'warning');
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

        const item = inventarioData.find(i => i.id == itemId);
        if (!item) throw new Error('Item no encontrado');

        const stockAnterior = item.stock_actual;
        const stockNuevo = stockAnterior + cantidad;

        // Deshabilitar botón
        const btnConfirmar = document.getElementById('btnConfirmarRestock');
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '⏳ Procesando...';

        // 1. Actualizar stock en la tabla correspondiente
        const tabla = tipoRecursoActual === 'papeleria' ? 'papeleria' : 'insumos';
        const { error: stockError } = await supabaseInventario
            .from(tabla)
            .update({
                stock_actual: stockNuevo,
                updated_at: new Date().toISOString()
            })
            .eq('id', itemId);

        if (stockError) throw stockError;

        // 2. Registrar movimiento polimórfico
        const movimientoData = {
            tipo_movimiento: tipoMovimiento,
            cantidad: cantidad,
            stock_anterior: stockAnterior,
            stock_nuevo: stockNuevo,
            motivo: motivo,
            admin_id: currentSuperAdmin.id
        };

        // Agregar referencia polimórfica
        if (tipoRecursoActual === 'papeleria') {
            movimientoData.papeleria_id = itemId;
            movimientoData.insumo_id = null;
        } else {
            movimientoData.insumo_id = itemId;
            movimientoData.papeleria_id = null;
        }

        const { error: movError } = await supabaseInventario
            .from('inventario_movimientos')
            .insert(movimientoData);

        if (movError) throw movError;

        // 3. Actualizar datos locales
        const itemIndex = inventarioData.findIndex(i => i.id == itemId);
        if (itemIndex !== -1) {
            inventarioData[itemIndex].stock_actual = stockNuevo;
        }

        // 4. Actualizar UI
        await renderizarInventario();
        actualizarEstadisticasInventario();
        await cargarMovimientosRecientes();

        showNotificationInventario(`Stock actualizado: ${item.nombre} (+${cantidad} ${item.unidad_medida})`, 'success');
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

// ===================================
// EDICIÓN POLIMÓRFICA
// ===================================

async function editarItem(itemId) {
    try {
        console.log(`🔄 Intentando editar ${tipoRecursoActual} ID:`, itemId);

        const item = inventarioData.find(i => i.id == itemId);

        if (!item) {
            console.error('❌ Item no encontrado. ID buscado:', itemId);
            showNotificationInventario('Item no encontrado en los datos cargados', 'error');
            return;
        }

        console.log('✅ Item encontrado:', item.nombre);

        // Cargar categorías correspondientes en el select
        await cargarCategoriasEnSelectPorTipo('editarCategoria');

        // Llenar formulario con datos actuales
        document.getElementById('editarInsumoId').value = item.id;
        document.getElementById('editarNombre').value = item.nombre;
        document.getElementById('editarDescripcion').value = item.descripcion || '';
        document.getElementById('editarCategoria').value = item.categoria_id;
        document.getElementById('editarUnidad').value = item.unidad_medida;
        document.getElementById('editarStockMinimo').value = item.cantidad_warning;
        document.getElementById('editarVisibilidad').value = item.acceso_tipo || 'todos';
        document.getElementById('editarActivo').value = item.activo.toString();

        document.getElementById('editarInsumoModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';

    } catch (error) {
        console.error('Error preparando edición:', error);
        showNotificationInventario('Error al cargar datos del item', 'error');
    }
}

async function cargarCategoriasEnSelectPorTipo(selectId) {
    try {
        const tabla = tipoRecursoActual === 'papeleria' ? 'categorias_papeleria' : 'categorias_insumos';
        const { data: categorias, error } = await supabaseInventario
            .from(tabla)
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

async function confirmarEdicionInsumo() {
    const btnConfirmar = document.getElementById('btnConfirmarEdicion');

    try {
        const itemId = document.getElementById('editarInsumoId').value;

        if (!itemId) {
            showNotificationInventario('Error: ID de item no encontrado', 'error');
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

        // Actualizar en la tabla correspondiente
        const tabla = tipoRecursoActual === 'papeleria' ? 'papeleria' : 'insumos';
        const { error } = await supabaseInventario
            .from(tabla)
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
            .eq('id', itemId);

        if (error) throw error;

        showNotificationInventario(`${tipoRecursoActual === 'papeleria' ? 'Item de papelería' : 'Insumo'} "${nombre}" actualizado exitosamente`, 'success');
        cerrarModalEditarInsumo();

        // Recargar datos y re-aplicar filtros
        await cargarInventarioActual();
        await renderizarInventario();

        const filtroCategoria = document.getElementById('filtroCategoria')?.value || '';
        const filtroEstadoStock = document.getElementById('filtroEstadoStock')?.value || '';
        const filtroVisibilidad = document.getElementById('filtroVisibilidad')?.value || '';

        if (filtroCategoria || filtroEstadoStock || filtroVisibilidad) {
            filtrarInventario();
        }

    } catch (error) {
        console.error('Error editando item:', error);
        showNotificationInventario('Error al actualizar el item', 'error');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '💾 Guardar Cambios';
    }
}

// ===================================
// MOVIMIENTOS POLIMÓRFICOS
// ===================================

async function cargarMovimientosRecientes() {
    try {
        const { data: movimientos, error } = await supabaseInventario
            .from('inventario_movimientos')
            .select(`
                *,
                insumos(nombre, unidad_medida),
                papeleria(nombre, unidad_medida),
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

        // Determinar nombre del item (polimórfico)
        const nombreItem = mov.insumos?.nombre || mov.papeleria?.nombre || 'Item eliminado';
        const unidadMedida = mov.insumos?.unidad_medida || mov.papeleria?.unidad_medida || '';

        html += `
            <div class="movimiento-item ${mov.tipo_movimiento}">
                <div class="movimiento-icon">${tipoIcon}</div>
                <div class="movimiento-info">
                    <div class="movimiento-header">
                        <strong>${nombreItem}</strong>
                        <span class="movimiento-fecha">${new Date(mov.fecha).toLocaleDateString()}</span>
                    </div>
                    <div class="movimiento-detalles">
                        <span class="movimiento-tipo">${getTipoMovimientoLabel(mov.tipo_movimiento)}</span>
                        <span class="movimiento-cantidad ${mov.cantidad > 0 ? 'positivo' : 'negativo'}">
                            ${signo}${cantidad} ${unidadMedida}
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

// ===================================
// HISTORIAL POLIMÓRFICO
// ===================================

function verHistorialItem(itemId) {
    const item = inventarioData.find(i => i.id == itemId);
    if (!item) return;

    cargarHistorialItem(itemId);
    document.getElementById('historialModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

async function cargarHistorialItem(itemId) {
    try {
        let query = supabaseInventario
            .from('inventario_movimientos')
            .select(`
                *,
                insumos(nombre, unidad_medida),
                papeleria(nombre, unidad_medida),
                usuarios:admin_id(nombre)
            `)
            .order('fecha', { ascending: false })
            .limit(50);

        // Filtrar por el tipo correcto de item
        if (tipoRecursoActual === 'papeleria') {
            query = query.eq('papeleria_id', itemId);
        } else {
            query = query.eq('insumo_id', itemId);
        }

        const { data: movimientos, error } = await query;

        if (error) throw error;

        renderizarHistorialCompleto(movimientos || []);

    } catch (error) {
        console.error('Error cargando historial del item:', error);
        showNotificationInventario('Error cargando historial del item', 'error');
    }
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
                papeleria(nombre, unidad_medida),
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

function renderizarHistorialCompleto(movimientos) {
    const container = document.getElementById('historialCompleto');
    if (!container) return;

    if (movimientos.length === 0) {
        container.innerHTML = '<p class="text-center">No se encontraron movimientos con los filtros aplicados</p>';
        return;
    }

    let html = '<div class="historial-tabla">';

    html += `
        <div class="historial-header-row historial-grid">
            <div>Fecha</div>
            <div>Item</div>
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

        // Nombre polimórfico
        const nombreItem = mov.insumos?.nombre || mov.papeleria?.nombre || 'N/A';

        html += `
            <div class="historial-row historial-grid">
                <div class="historial-fecha">${new Date(mov.fecha).toLocaleDateString()}</div>
                <div class="historial-insumo">${nombreItem}</div>
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

// ===================================
// FUNCIONES AUXILIARES
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

// ===================================
// FUNCIONES EXISTENTES MANTENIDAS
// ===================================

function actualizarInfoInsumo() {
    const selectInsumo = document.getElementById('insumoSelect');
    const itemId = selectInsumo.value;

    if (!itemId) {
        document.getElementById('insumoInfoCard').style.display = 'none';
        return;
    }

    const item = inventarioData.find(i => i.id == itemId);
    if (!item) return;

    const accesoTipo = item.acceso_tipo || 'todos';

    document.getElementById('stockActual').textContent = item.stock_actual;
    document.getElementById('stockMinimo').textContent = item.cantidad_warning;
    document.getElementById('unidadMedida').textContent = item.unidad_medida;
    document.getElementById('visibilidadActual').textContent = getVisibilidadLabel(accesoTipo);
    document.getElementById('insumoInfoCard').style.display = 'block';

    document.getElementById('cantidadAgregar').value = '';
    document.getElementById('nuevoStockPreview').style.display = 'none';
}

function calcularNuevoStock() {
    const selectInsumo = document.getElementById('insumoSelect');
    const cantidadInput = document.getElementById('cantidadAgregar');
    const itemId = selectInsumo.value;
    const cantidad = parseInt(cantidadInput.value) || 0;

    if (!itemId || cantidad === 0) {
        document.getElementById('nuevoStockPreview').style.display = 'none';
        return;
    }

    const item = inventarioData.find(i => i.id == itemId);
    if (!item) return;

    const nuevoStock = item.stock_actual + cantidad;
    document.getElementById('nuevoStockCalculado').textContent = nuevoStock;
    document.getElementById('nuevoStockPreview').style.display = 'block';
}

function cerrarModalRestock() {
    document.getElementById('restockModal').style.display = 'none';
    document.body.style.overflow = '';

    document.getElementById('insumoSelect').value = '';
    document.getElementById('cantidadAgregar').value = '';
    document.getElementById('tipoMovimiento').value = '';
    document.getElementById('motivoRestock').value = '';
    document.getElementById('insumoInfoCard').style.display = 'none';
    document.getElementById('nuevoStockPreview').style.display = 'none';
}

function cerrarModalEditarInsumo() {
    document.getElementById('editarInsumoModal').style.display = 'none';
    document.body.style.overflow = '';
}

function verHistorialCompleto() {
    cargarHistorialCompleto();
    document.getElementById('historialModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function cerrarHistorialModal() {
    document.getElementById('historialModal').style.display = 'none';
    document.body.style.overflow = '';
}

function actualizarInventario() {
    cargarDatosInventario();
}

function exportarInventario() {
    const tipoTexto = tipoRecursoActual === 'papeleria' ? 'papeleria' : 'insumos';

    const data = inventarioData.map(item => {
        const categoria = tipoRecursoActual === 'papeleria'
            ? item.categorias_papeleria
            : item.categorias_insumos;

        return {
            'Item': item.nombre,
            'Categoría': categoria?.nombre || 'Sin categoría',
            'Stock Actual': item.stock_actual,
            'Stock Mínimo': item.cantidad_warning,
            'Unidad': item.unidad_medida,
            'Visibilidad': getVisibilidadLabel(item.acceso_tipo),
            'Estado': getStockStatus(item.stock_actual, item.cantidad_warning),
            'Activo': item.activo ? 'Sí' : 'No'
        };
    });

    const csvContent = convertirACSV(data);
    const BOM = '\uFEFF';
    const contentWithBOM = BOM + csvContent;

    const blob = new Blob([contentWithBOM], {
        type: 'text/csv;charset=utf-8;'
    });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${tipoTexto}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 100);

    showNotificationInventario(`${tipoTexto === 'papeleria' ? 'Papelería' : 'Inventario'} exportado exitosamente`, 'success');
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
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(','))
    ].join('\r\n');

    return csvContent;
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

function configurarEventListeners() {
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

    const insumoSelect = document.getElementById('insumoSelect');
    const cantidadAgregar = document.getElementById('cantidadAgregar');

    if (insumoSelect) {
        insumoSelect.addEventListener('change', actualizarInfoInsumo);
    }

    if (cantidadAgregar) {
        cantidadAgregar.addEventListener('input', calcularNuevoStock);
    }

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
// FUNCIÓN PARA ABRIR MODAL DINÁMICO
// ===================================

function abrirModalNuevoItem(tipo = 'insumo') {
    tipoItemActual = tipo;

    // Actualizar título y textos del modal según el tipo
    actualizarTextoModal(tipo);

    // Cargar categorías según el tipo
    if (tipo === 'papeleria') {
        cargarCategoriasEnSelect('categoriaItem', 'categorias_papeleria');
    } else {
        cargarCategoriasEnSelect('categoriaItem', 'categorias_insumos');
    }

    document.getElementById('nuevoItemModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function cerrarModalNuevoItem() {
    document.getElementById('nuevoItemModal').style.display = 'none';
    document.body.style.overflow = '';

    // Limpiar formulario
    document.getElementById('nuevoItemForm').reset();
    tipoItemActual = 'insumo'; // Reset por defecto
}

// ===================================
// FUNCIÓN PARA ACTUALIZAR TEXTOS DEL MODAL
// ===================================

function actualizarTextoModal(tipo) {
    const esPapeleria = tipo === 'papeleria';

    // Actualizar título del modal
    const titulo = document.getElementById('tituloModalItem');
    if (titulo) {
        titulo.textContent = esPapeleria ? '📝 Nuevo Item de Papelería' : '📦 Nuevo Insumo';
    }

    // Actualizar placeholder del nombre
    const nombreInput = document.getElementById('nombreItem');
    if (nombreInput) {
        nombreInput.placeholder = esPapeleria ? 'Ej: Hojas Bond Carta' : 'Ej: Agua Bonafont 1.2L';
    }

    // Actualizar label de categoría
    const labelCategoria = document.querySelector('label[for="categoriaItem"]');
    if (labelCategoria) {
        labelCategoria.textContent = esPapeleria ? 'Categoría de Papelería:' : 'Categoría de Insumo:';
    }

    // Actualizar texto del botón
    const btnConfirmar = document.getElementById('btnConfirmarNuevoItem');
    if (btnConfirmar) {
        btnConfirmar.innerHTML = esPapeleria ? '📝 Crear Item de Papelería' : '📦 Crear Insumo';
    }
}

// ===================================
// FUNCIÓN ADAPTADA PARA CARGAR CATEGORÍAS
// ===================================

async function cargarCategoriasEnSelect(selectId, tablaCategoria = 'categorias_insumos') {
    try {
        const { data: categorias, error } = await supabaseInventario
            .from(tablaCategoria)
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre');

        if (error) throw error;

        const select = document.getElementById(selectId);
        if (!select) {
            console.error('❌ Select no encontrado:', selectId);
            console.log('🔍 Elementos disponibles:', document.querySelectorAll('select'));
            return;
        }

        const esPapeleria = tablaCategoria === 'categorias_papeleria';
        let html = `<option value="">Seleccionar ${esPapeleria ? 'categoría de papelería' : 'categoría de insumo'}...</option>`;

        categorias.forEach(categoria => {
            html += `<option value="${categoria.id}">${categoria.nombre}</option>`;
        });

        select.innerHTML = html;

    } catch (error) {
        console.error('Error cargando categorías:', error);
        showNotificationInventario('Error cargando categorías', 'error');
    }
}

// ===================================
// FUNCIÓN PRINCIPAL ADAPTADA
// ===================================

async function confirmarNuevoItem() {
    try {
        const nombre = document.getElementById('nombreItem').value.trim();
        const descripcion = document.getElementById('descripcionItem').value.trim();
        const categoriaId = document.getElementById('categoriaItem').value;
        const unidad = document.getElementById('unidadItem').value;
        const stockInicial = parseInt(document.getElementById('stockInicial').value) || 0;
        const stockMinimo = parseInt(document.getElementById('stockMinimo').value);
        const visibilidad = document.getElementById('visibilidadItem').value;

        // Validaciones
        if (!nombre || !categoriaId || !unidad || !stockMinimo) {
            showNotificationInventario('Completa todos los campos obligatorios', 'warning');
            return;
        }

        if (stockMinimo < 1) {
            showNotificationInventario('El stock mínimo debe ser al menos 1', 'warning');
            return;
        }

        const btnConfirmar = document.getElementById('btnConfirmarNuevoItem');
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '⏳ Creando...';

        // Determinar qué tabla usar
        const tabla = tipoItemActual === 'papeleria' ? 'papeleria' : 'insumos';
        const nombreTipo = tipoItemActual === 'papeleria' ? 'item de papelería' : 'insumo';

        // Crear nuevo item
        const { data: nuevoItem, error } = await supabaseInventario
            .from(tabla)
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
            const movimientoData = {
                tipo_movimiento: 'restock',
                cantidad: stockInicial,
                stock_anterior: 0,
                stock_nuevo: stockInicial,
                motivo: `Stock inicial al crear ${nombreTipo}`,
                admin_id: currentSuperAdmin.id
            };

            // Agregar el ID correcto según el tipo
            if (tipoItemActual === 'papeleria') {
                movimientoData.papeleria_id = nuevoItem.id;
                movimientoData.insumo_id = null;
            } else {
                movimientoData.insumo_id = nuevoItem.id;
                movimientoData.papeleria_id = null;
            }

            await supabaseInventario
                .from('inventario_movimientos')
                .insert(movimientoData);
        }

        showNotificationInventario(`${nombreTipo.charAt(0).toUpperCase() + nombreTipo.slice(1)} "${nombre}" creado exitosamente`, 'success');
        cerrarModalNuevoItem();
        await cargarDatosInventario();

    } catch (error) {
        console.error('Error creando item:', error);
        showNotificationInventario(`Error al crear el ${tipoItemActual === 'papeleria' ? 'item de papelería' : 'insumo'}`, 'error');

        const btnConfirmar = document.getElementById('btnConfirmarNuevoItem');
        btnConfirmar.disabled = false;
        const esPapeleria = tipoItemActual === 'papeleria';
        btnConfirmar.innerHTML = esPapeleria ? '📝 Crear Item de Papelería' : '📦 Crear Insumo';
    }
}

// ===================================
// FUNCIÓN PARA CAMBIAR TIPO DE RECURSO
// ===================================

function cambiarTipoRecurso() {
    const select = document.getElementById('filtroTipoRecurso');
    const tipoSeleccionado = select.value;

    // Actualizar botón "Nuevo" dinámicamente
    const btnNuevo = document.getElementById('btnNuevoItem'); // Usar ID específico
    if (btnNuevo) {
        if (tipoSeleccionado === 'papeleria') {
            btnNuevo.innerHTML = '📝 Nueva Papelería';
            btnNuevo.onclick = () => abrirModalNuevoItem('papeleria');
        } else {
            btnNuevo.innerHTML = '📦 Nuevo Insumo';
            btnNuevo.onclick = () => abrirModalNuevoItem('insumo');
        }
    }

    // Recargar datos del inventario según el tipo
    cargarDatosInventarioPorTipo(tipoSeleccionado);

    console.log('🔄 Tipo de recurso cambiado a:', tipoSeleccionado);
}

// ===================================
// FUNCIÓN AUXILIAR PARA CARGAR DATOS POR TIPO
// ===================================

async function cargarDatosInventarioPorTipo(tipo = 'insumo') {
    try {
        mostrarLoadingInventario(true);

        if (tipo === 'papeleria') {
            // Cargar papelería con sus categorías
            const { data: inventario, error: invError } = await supabaseInventario
                .from('papeleria')
                .select(`
                    *,
                    categorias_papeleria(id, nombre, icono, color)
                `)
                .order('nombre');

            if (invError) throw invError;

            // Cargar categorías de papelería
            const { data: categorias, error: catError } = await supabaseInventario
                .from('categorias_papeleria')
                .select('*')
                .eq('activo', true)
                .order('orden');

            if (catError) throw catError;

            inventarioData = inventario || [];
            categoriasData = categorias || [];

        } else {
            // Cargar insumos (código existente)
            const { data: inventario, error: invError } = await supabaseInventario
                .from('insumos')
                .select(`
                    *,
                    categorias_insumos(id, nombre, icono, color)
                `)
                .order('nombre');

            if (invError) throw invError;

            const { data: categorias, error: catError } = await supabaseInventario
                .from('categorias_insumos')
                .select('*')
                .eq('activo', true)
                .order('orden');

            if (catError) throw catError;

            inventarioData = inventario || [];
            categoriasData = categorias || [];
        }

        console.log('✅ Datos cargados:', inventarioData.length, tipo);

        // Renderizar datos
        await renderizarInventario();
        await cargarMovimientosRecientes();
        actualizarEstadisticasInventario();
        cargarFiltrosCategorias();

        mostrarLoadingInventario(false);

    } catch (error) {
        console.error('Error cargando inventario:', error);
        mostrarError(`Error cargando datos de ${tipo}`);
        mostrarLoadingInventario(false);
    }
}
































// ===================================
// CARGAR HEADER ADMIN ESPECÍFICO
// ===================================

// ===================================
// FUNCIÓN PARA CARGAR HEADER ADMIN CON USUARIO
// ===================================

async function cargarHeaderAdmin() {
    try {
        const response = await fetch('includes/headerAdmin.html');
        if (!response.ok) throw new Error('Error cargando headerAdmin.html');

        const html = await response.text();
        const headerContainer = document.getElementById('header-container');

        if (headerContainer) {
            headerContainer.innerHTML = html;
            console.log('✅ HeaderAdmin.html cargado correctamente');

            // Actualizar información del usuario después de cargar el HTML
            setTimeout(() => {
                actualizarInfoUsuarioHeader();

                // Inicializar funciones del header si existen
                if (typeof inicializarHeaderAdmin === 'function') {
                    inicializarHeaderAdmin();
                }
            }, 100);
        }
    } catch (error) {
        console.error('❌ Error cargando headerAdmin.html:', error);
        // Header básico como fallback con información de usuario
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const usuario = obtenerUsuarioActual();
            headerContainer.innerHTML = `
                <header class="header">
                    <div class="container">
                        <div class="header-content">
                            <h1>📦 Gestión de Inventario</h1>
                            <div class="user-info">
                                <span class="user-name">${usuario ? usuario.nombre : 'Usuario'}</span>
                                <span class="user-role">${usuario ? usuario.rol : 'Admin'}</span>
                            </div>
                            <a href="admin.html" class="back-link">← Volver al Admin</a>
                        </div>
                    </div>
                </header>
            `;
        }
    }
}

// ===================================
// FUNCIÓN PARA OBTENER USUARIO ACTUAL
// ===================================

function obtenerUsuarioActual() {
    try {
        const session = sessionStorage.getItem('currentUser');
        if (!session) {
            console.warn('⚠️ No hay sesión de usuario activa');
            return null;
        }

        const usuario = JSON.parse(session);
        console.log('👤 Usuario actual:', usuario.nombre);
        return usuario;

    } catch (error) {
        console.error('❌ Error obteniendo usuario actual:', error);
        return null;
    }
}

// ===================================
// FUNCIÓN PARA ACTUALIZAR INFO EN HEADER
// ===================================

function actualizarInfoUsuarioHeader() {
    const usuario = obtenerUsuarioActual();
    if (!usuario) return;

    // Actualizar nombre del usuario
    const userNameElements = document.querySelectorAll('.user-name, #userName, [data-user-name]');
    userNameElements.forEach(element => {
        if (element) element.textContent = usuario.nombre;
    });

    // Actualizar rol/departamento
    const userRoleElements = document.querySelectorAll('.user-role, #userRole, [data-user-role]');
    userRoleElements.forEach(element => {
        if (element) element.textContent = usuario.rol || usuario.departamento;
    });

    // Actualizar email
    const userEmailElements = document.querySelectorAll('.user-email, #userEmail, [data-user-email]');
    userEmailElements.forEach(element => {
        if (element) element.textContent = usuario.username;
    });

    // Actualizar avatar/iniciales
    const avatarElements = document.querySelectorAll('.user-avatar, #userAvatar, [data-user-avatar]');
    avatarElements.forEach(element => {
        if (element) {
            const iniciales = usuario.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            element.textContent = iniciales;
        }
    });

    // Mostrar/ocultar elementos según permisos
    if (usuario.rol === 'super_admin') {
        const superAdminElements = document.querySelectorAll('[data-super-admin-only]');
        superAdminElements.forEach(element => {
            element.style.display = 'block';
        });
    }

    console.log('✅ Información de usuario actualizada en header');
}

// ===================================
// FUNCIÓN PARA INICIALIZAR HEADER ADMIN
// ===================================

function inicializarHeaderAdmin() {
    console.log('🔧 Inicializando funciones del header admin...');

    const usuario = obtenerUsuarioActual();
    if (!usuario) return;

    // Configurar menú de usuario si existe
    const userMenuToggle = document.querySelector('.user-menu-toggle');
    const userDropdown = document.querySelector('.user-dropdown');

    if (userMenuToggle && userDropdown) {
        userMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });

        // Cerrar menú al hacer click fuera
        document.addEventListener('click', () => {
            userDropdown.classList.remove('show');
        });
    }

    // Configurar botón de logout
    const logoutBtn = document.querySelector('.logout-btn, [data-logout]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    }

    // Mostrar notificación de bienvenida
    if (typeof showNotification === 'function') {
        showNotification(`Bienvenido, ${usuario.nombre}`, 'success', 2000);
    }

    console.log('✅ Header admin inicializado correctamente');
}

// ===================================
// FUNCIÓN PARA CERRAR SESIÓN
// ===================================

function cerrarSesion() {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
        console.log('🚪 Cerrando sesión...');

        // Limpiar datos de sesión
        sessionStorage.removeItem('currentUser');
        localStorage.removeItem('userSession');
        localStorage.removeItem('rememberLogin');

        // Redirigir al login
        window.location.href = 'login.html';
    }
}

// ===================================
// FUNCIÓN PARA VERIFICAR AUTENTICACIÓN
// ===================================

function verificarAutenticacionAdmin() {
    const usuario = obtenerUsuarioActual();

    if (!usuario) {
        console.log('❌ No hay usuario autenticado, redirigiendo al login');
        window.location.href = 'login.html';
        return false;
    }

    // Verificar si es admin
    if (usuario.rol !== 'admin' && usuario.rol !== 'super_admin') {
        console.log('❌ Usuario sin permisos de admin');
        if (typeof showNotification === 'function') {
            showNotification('No tienes permisos de administrador', 'error');
        }
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    return usuario;
}





async function cargarFooter() {
    try {
        const response = await fetch('includes/footerAdmin.html');
        if (!response.ok) throw new Error('Error cargando footerAdmin.html');

        const html = await response.text();
        const footerContainer = document.getElementById('footer-container');

        if (footerContainer) {
            footerContainer.innerHTML = html;
            console.log('✅ Footer cargado correctamente');

            // Actualizar año dinámicamente
            const currentYearSpan = document.getElementById('currentYear');
            if (currentYearSpan) {
                currentYearSpan.textContent = new Date().getFullYear();
            }

            // Inicializar funciones del footer si existen
            setTimeout(() => {
                if (typeof inicializarFooter === 'function') {
                    inicializarFooter();
                }
            }, 100);
        }
    } catch (error) {
        console.error('❌ Error cargando footer:', error);
        // Footer básico como fallback
        const footerContainer = document.getElementById('footer-container');
        if (footerContainer) {
            footerContainer.innerHTML = `
                <footer class="footer">
                    <div class="container">
                        <div class="footer-content">
                            <div class="footer-info">
                                <p>&copy; ${new Date().getFullYear()} Sistema de Insumos. Todos los derechos reservados.</p>
                            </div>
                            <div class="footer-links">
                                <a href="index.html" class="footer-link">Inicio</a>
                                <a href="historial.html" class="footer-link">Historial</a>
                                <a href="#" class="footer-link">Ayuda</a>
                            </div>
                        </div>
                    </div>
                </footer>
            `;
        }
    }
}


// Llamar la función al cargar
document.addEventListener('DOMContentLoaded', function () {
    cargarHeaderAdmin();
    cargarFooter();
});





// Alias para mantener compatibilidad
const editarInsumo = editarItem;
const verHistorialInsumo = verHistorialItem;

console.log('📦 Inventario polimórfico.js cargado completamente');



/* ===================================
   SISTEMA DE REPORTES - DESDE CERO
   js/reportes.js - Funcional y limpio
   =================================== */

// Variables específicas del sistema de reportes
let datosReporte = null;
let mesSeleccionado = new Date().getMonth() + 1;
let anoSeleccionado = new Date().getFullYear();
let areaSeleccionada = '';
let areasDisponibles = [];
let tipoPeriodoSeleccionado = 'mes';


// Configuración Supabase (reutilizar conexión)
const supabaseReportes = window.supabase.createClient(
    'https://nxuvisaibpmdvraybzbm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54dXZpc2FpYnBtZHZyYXliemJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4OTMxNjQsImV4cCI6MjA3MTQ2OTE2NH0.OybYM_E3mWsZym7mEf-NiRtrG0svkylXx_q8Tivonfg'
);

// ===================================
// INICIALIZACIÓN DEL SISTEMA
// ===================================

function inicializarReportes() {
    console.log('Inicializando sistema de reportes...');
    
    // Configurar selectores iniciales
    configurarSelectores();
    
    // Cargar áreas disponibles
    cargarAreas();
}

function configurarSelectores() {
    // Configurar selector de tipo de período
    const selectorTipoPeriodo = document.getElementById('tipoPeriodo');
    if (selectorTipoPeriodo) {
        selectorTipoPeriodo.innerHTML = `
            <option value="mes">Un mes específico</option>
            <option value="anual">Año completo</option>
        `;
    }
    
    // Configurar selector de mes (mantener igual)
    const selectorMes = document.getElementById('selectorMes');
    if (selectorMes) {
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        
        let html = '';
        meses.forEach((nombre, index) => {
            const valor = index + 1;
            const selected = valor === mesSeleccionado ? 'selected' : '';
            html += `<option value="${valor}" ${selected}>${nombre}</option>`;
        });
        
        selectorMes.innerHTML = html;
    }
    
    // Configurar selector de año (mantener igual)
    const selectorAno = document.getElementById('selectorAno');
    if (selectorAno) {
        const anoActual = new Date().getFullYear();
        let html = '';
        
        for (let ano = anoActual - 2; ano <= anoActual; ano++) {
            const selected = ano === anoSeleccionado ? 'selected' : '';
            html += `<option value="${ano}" ${selected}>${ano}</option>`;
        }
        
        selectorAno.innerHTML = html;
    }
}

function cambiarTipoPeriodo() {
    tipoPeriodoSeleccionado = document.getElementById('tipoPeriodo').value;
    const mesContainer = document.getElementById('mes-container');
    
    if (mesContainer) {
        mesContainer.style.display = tipoPeriodoSeleccionado === 'mes' ? 'block' : 'none';
    }
}


async function cargarAreas() {
    try {
        const { data: usuarios, error } = await supabaseReportes
            .from('usuarios')
            .select('departamento')
            .not('departamento', 'is', null);
        
        if (error) throw error;
        
        // Extraer departamentos únicos
        areasDisponibles = [...new Set(usuarios.map(u => u.departamento))].sort();
        
        const selectorArea = document.getElementById('selectorArea');
        if (selectorArea) {
            let html = '<option value="">Todas las áreas</option>';
            areasDisponibles.forEach(area => {
                html += `<option value="${area}">${area}</option>`;
            });
            selectorArea.innerHTML = html;
        }
        
    } catch (error) {
        console.error('Error cargando áreas:', error);
    }
}

// ===================================
// GENERACIÓN DEL REPORTE
// ===================================

/*async function ejecutarReporte() {
    try {
        // Obtener valores de los selectores
        mesSeleccionado = parseInt(document.getElementById('selectorMes').value);
        anoSeleccionado = parseInt(document.getElementById('selectorAno').value);
        areaSeleccionada = document.getElementById('selectorArea').value;
        
        // Mostrar loading
        mostrarLoadingReporte(true);
        
        // Obtener datos del período seleccionado
        const datosActual = await consultarSolicitudesPeriodo(mesSeleccionado, anoSeleccionado, areaSeleccionada);
        
        // Obtener datos del mes anterior para comparación
        let mesAnterior = mesSeleccionado - 1;
        let anoAnterior = anoSeleccionado;
        
        if (mesAnterior === 0) {
            mesAnterior = 12;
            anoAnterior = anoAnterior - 1;
        }
        
        const datosAnterior = await consultarSolicitudesPeriodo(mesAnterior, anoAnterior, areaSeleccionada);
        
        // Procesar datos para el reporte
        datosReporte = {
            periodo: {
                mes: mesSeleccionado,
                ano: anoSeleccionado,
                area: areaSeleccionada
            },
            actual: datosActual,
            anterior: datosAnterior
        };
        
        // Renderizar el reporte
        renderizarReporte();
        
        // Generar gráficos
        setTimeout(() => {
            crearGraficos();
        }, 200);
        
        mostrarLoadingReporte(false);
        
    } catch (error) {
        console.error('Error ejecutando reporte:', error);
        mostrarErrorReporte('Error generando el reporte');
        mostrarLoadingReporte(false);
    }
}*/

async function ejecutarReporte() {
    try {
        // Obtener valores de los selectores
        tipoPeriodoSeleccionado = document.getElementById('tipoPeriodo').value;
        anoSeleccionado = parseInt(document.getElementById('selectorAno').value);
        areaSeleccionada = document.getElementById('selectorArea').value;
        
        // ✅ AGREGAR ESTA LÍNEA - Obtener filtro de recursos
        const recursoSeleccionado = document.getElementById('selectorRecurso')?.value || null;
        
        // Mostrar loading
        mostrarLoadingReporte(true);
        
        let datosActual, datosAnterior;
        
        if (tipoPeriodoSeleccionado === 'mes') {
            // Lógica mensual - PASAR el filtro de recursos
            mesSeleccionado = parseInt(document.getElementById('selectorMes').value);
            
            // ✅ ESTAS LÍNEAS CORREGIDAS - Agregar parámetro recursoSeleccionado
            datosActual = await consultarSolicitudesPeriodo(mesSeleccionado, anoSeleccionado, areaSeleccionada, recursoSeleccionado);
            
            let mesAnterior = mesSeleccionado - 1;
            let anoAnterior = anoSeleccionado;
            if (mesAnterior === 0) {
                mesAnterior = 12;
                anoAnterior = anoAnterior - 1;
            }
            datosAnterior = await consultarSolicitudesPeriodo(mesAnterior, anoAnterior, areaSeleccionada, recursoSeleccionado);
            
        } else if (tipoPeriodoSeleccionado === 'anual') {
            // Lógica anual - PASAR el filtro de recursos
            
            // ✅ ESTAS LÍNEAS CORREGIDAS - Agregar parámetro recursoSeleccionado
            datosActual = await consultarSolicitudesAnual(anoSeleccionado, areaSeleccionada, recursoSeleccionado);
            datosAnterior = await consultarSolicitudesAnual(anoSeleccionado - 1, areaSeleccionada, recursoSeleccionado);
        }
        
        // Procesar datos para el reporte
        datosReporte = {
            periodo: {
                tipo: tipoPeriodoSeleccionado,
                mes: tipoPeriodoSeleccionado === 'mes' ? mesSeleccionado : null,
                ano: anoSeleccionado,
                area: areaSeleccionada,
                recurso: recursoSeleccionado // ✅ AGREGAR para referencia
            },
            actual: datosActual,
            anterior: datosAnterior
        };
        
        // Renderizar el reporte
        renderizarReporte();
        
        // Generar gráficos
        setTimeout(() => {
            crearGraficos();
        }, 200);
        
        mostrarLoadingReporte(false);
        
    } catch (error) {
        console.error('Error ejecutando reporte:', error);
        mostrarErrorReporte('Error generando el reporte');
        mostrarLoadingReporte(false);
    }
}




// AGREGAR esta nueva función para consulta anual
async function consultarSolicitudesAnual(ano, area, recursoTipo = null) {
    try {
        // Fechas para todo el año
        const fechaInicio = `${ano}-01-01T00:00:00`;
        const fechaFin = `${ano}-12-31T23:59:59`;
        
        // Consulta expandida para manejar ambos recursos
        let query = supabaseReportes
            .from('solicitudes')
            .select(`
                id,
                tipo,
                estado,
                fecha_solicitud,
                token_usado,
                recurso_tipo,
                token_tipo_usado,
                usuarios:usuario_id(departamento),
                solicitud_detalles(
                    cantidad_solicitada,
                    cantidad_aprobada,
                    insumos(nombre),
                    papeleria(nombre)
                )
            `)
            .gte('fecha_solicitud', fechaInicio)
            .lte('fecha_solicitud', fechaFin);
        
        // Filtrar por tipo de recurso si está especificado
        if (recursoTipo) {
            query = query.eq('recurso_tipo', recursoTipo);
        }
        
        const { data: solicitudes, error } = await query;
        
        if (error) throw error;
        
        // Filtrar por área si está seleccionada
        let solicitudesFiltradas = solicitudes || [];
        if (area) {
            solicitudesFiltradas = solicitudesFiltradas.filter(s => 
                s.usuarios && s.usuarios.departamento === area
            );
        }
        
        return procesarSolicitudes(solicitudesFiltradas);
        
    } catch (error) {
        console.error('Error consultando solicitudes anuales:', error);
        return getEstadisticasVacias();
    }
}

async function consultarSolicitudesPeriodo(mes, ano, area, recursoTipo = null) {
    try {
        // Crear fechas del período
        const primerDia = new Date(ano, mes - 1, 1);
        const ultimoDia = new Date(ano, mes, 0);
        
        const fechaInicio = primerDia.toISOString().split('T')[0] + 'T00:00:00';
        const fechaFin = ultimoDia.toISOString().split('T')[0] + 'T23:59:59';
        
        // Consulta base expandida para manejar ambos recursos
        let query = supabaseReportes
            .from('solicitudes')
            .select(`
                id,
                tipo,
                estado,
                fecha_solicitud,
                token_usado,
                recurso_tipo,
                token_tipo_usado,
                usuarios:usuario_id(departamento),
                solicitud_detalles(
                    cantidad_solicitada,
                    cantidad_aprobada,
                    insumos(nombre),
                    papeleria(nombre)
                )
            `)
            .gte('fecha_solicitud', fechaInicio)
            .lte('fecha_solicitud', fechaFin);
        
        // Filtrar por tipo de recurso si está especificado
        if (recursoTipo) {
            query = query.eq('recurso_tipo', recursoTipo);
        }
        
        const { data: solicitudes, error } = await query;
        
        if (error) throw error;
        
        // Filtrar por área si está seleccionada
        let solicitudesFiltradas = solicitudes || [];
        if (area) {
            solicitudesFiltradas = solicitudesFiltradas.filter(s => 
                s.usuarios && s.usuarios.departamento === area
            );
        }
        
        return procesarSolicitudes(solicitudesFiltradas);
        
    } catch (error) {
        console.error('Error consultando solicitudes del período:', error);
        return getEstadisticasVacias();
    }
}

function procesarSolicitudes(solicitudes) {
    const estadisticas = {
        total: solicitudes.length,
        porArea: {},
        porTipo: { ordinaria: 0, juntas: 0 },
        porEstado: { pendiente: 0, en_revision: 0, cerrado: 0, cancelado: 0 },
        porRecurso: { insumo: 0, papeleria: 0 },
        porTipoToken: { 
            ordinario: 0, 
            extraordinario: 0, 
            juntas: 0 
        },
        insumosSolicitados: {},
        papeleriaSolicitada: {},
        recursosSolicitados: {}, // Combinado de ambos
        tokenUsados: 0,
        tokensPorTipo: {
            insumo_ordinario: 0,
            papeleria_ordinario: 0,
            papeleria_extraordinario: 0
        }
    };
    
    solicitudes.forEach(solicitud => {
        // Contar por área
        const area = solicitud.usuarios?.departamento || 'Sin área';
        estadisticas.porArea[area] = (estadisticas.porArea[area] || 0) + 1;
        
        // Contar por tipo de solicitud
        estadisticas.porTipo[solicitud.tipo] = (estadisticas.porTipo[solicitud.tipo] || 0) + 1;
        
        // Contar por estado
        estadisticas.porEstado[solicitud.estado] = (estadisticas.porEstado[solicitud.estado] || 0) + 1;
        
        // Contar por tipo de recurso
        const recursoTipo = solicitud.recurso_tipo || 'insumo'; // Default para compatibilidad
        estadisticas.porRecurso[recursoTipo] = (estadisticas.porRecurso[recursoTipo] || 0) + 1;
        
        // Contar tokens usados por tipo
        if (solicitud.token_usado) {
            estadisticas.tokenUsados++;
            
            // Clasificar tokens por tipo específico
            const tokenTipo = solicitud.token_tipo_usado || 'ordinario';
            if (solicitud.tipo === 'juntas') {
                estadisticas.porTipoToken.juntas++;
            } else if (recursoTipo === 'insumo') {
                estadisticas.tokensPorTipo.insumo_ordinario++;
                estadisticas.porTipoToken.ordinario++;
            } else if (recursoTipo === 'papeleria') {
                if (tokenTipo === 'extraordinario') {
                    estadisticas.tokensPorTipo.papeleria_extraordinario++;
                    estadisticas.porTipoToken.extraordinario++;
                } else {
                    estadisticas.tokensPorTipo.papeleria_ordinario++;
                    estadisticas.porTipoToken.ordinario++;
                }
            }
        }
        
        // Procesar items solicitados (polimórfico)
        if (solicitud.solicitud_detalles) {
            solicitud.solicitud_detalles.forEach(detalle => {
                const cantidad = detalle.cantidad_solicitada || 0;
                
                // Determinar si es insumo o papelería
                if (detalle.insumos && detalle.insumos.nombre) {
                    const insumo = detalle.insumos.nombre;
                    estadisticas.insumosSolicitados[insumo] = (estadisticas.insumosSolicitados[insumo] || 0) + cantidad;
                    estadisticas.recursosSolicitados[`📦 ${insumo}`] = (estadisticas.recursosSolicitados[`📦 ${insumo}`] || 0) + cantidad;
                    
                } else if (detalle.papeleria && detalle.papeleria.nombre) {
                    const papeleria = detalle.papeleria.nombre;
                    estadisticas.papeleriaSolicitada[papeleria] = (estadisticas.papeleriaSolicitada[papeleria] || 0) + cantidad;
                    estadisticas.recursosSolicitados[`📝 ${papeleria}`] = (estadisticas.recursosSolicitados[`📝 ${papeleria}`] || 0) + cantidad;
                }
            });
        }
    });
    
    return estadisticas;
}


function getEstadisticasVacias() {
    return {
        total: 0,
        porArea: {},
        porTipo: { ordinaria: 0, juntas: 0 },
        porEstado: { pendiente: 0, en_revision: 0, cerrado: 0, cancelado: 0 },
        porRecurso: { insumo: 0, papeleria: 0 },
        porTipoToken: { 
            ordinario: 0, 
            extraordinario: 0, 
            juntas: 0 
        },
        insumosSolicitados: {},
        papeleriaSolicitada: {},
        recursosSolicitados: {},
        tokenUsados: 0,
        tokensPorTipo: {
            insumo_ordinario: 0,
            papeleria_ordinario: 0,
            papeleria_extraordinario: 0
        }
    };
}
// ===================================
// RENDERIZADO DEL REPORTE
// ===================================

function renderizarReporte() {
    const container = document.getElementById('reporteContenido');
    if (!container || !datosReporte) return;
    
    const nombreMes = obtenerNombreMes(datosReporte.periodo.mes);
    const tituloArea = datosReporte.periodo.area ? ` - ${datosReporte.periodo.area}` : '';
    
    // ✅ DETERMINAR TIPO DE RECURSO FILTRADO
    const recursoFiltrado = datosReporte.periodo.recurso;
    
    let html = `
        <!-- Header del reporte -->
        <div class="reporte-titulo">
            <h3>${obtenerTituloReporte()}${tituloArea}</h3>
            <p>Comparación con período anterior</p>
        </div>
        
        <!-- Estadísticas principales -->
        <div class="estadisticas-principales">
            ${crearTarjetaEstadistica('Total Solicitudes', datosReporte.actual.total, datosReporte.anterior.total)}
            ${crearTarjetaEstadistica('Tokens Usados', datosReporte.actual.tokenUsados, datosReporte.anterior.tokenUsados)}
            ${crearTarjetaEstadistica('Solicitudes Cerradas', datosReporte.actual.porEstado.cerrado, datosReporte.anterior.porEstado.cerrado)}
        </div>
        
        <!-- Solo mostrar por área si no hay filtro específico -->
        ${!datosReporte.periodo.area ? `
        <div class="seccion-reporte">
            <h4>Solicitudes por Área</h4>
            <div class="contenido-mixto">
                <div class="tabla-datos">
                    ${crearTablaPorAreas()}
                </div>
                <div class="grafico-container">
                    <canvas id="graficoAreas"></canvas>
                </div>
            </div>
        </div>
        ` : ''}
        
        <!-- ✅ SECCIÓN DINÁMICA DE RECURSOS -->
        <div class="seccion-reporte">
            <h4>${obtenerTituloRecursos(recursoFiltrado)}</h4>
            <div class="contenido-mixto">
                <div class="tabla-datos">
                    ${crearTablaRecursos(recursoFiltrado)}
                </div>
                <div class="grafico-container">
                    <canvas id="graficoRecursos"></canvas>
                </div>
            </div>
        </div>
        
        <!-- Acciones -->
        <div class="acciones-reporte">
            <button class="btn-reporte-exportar" onclick="exportarReporteCompleto()">
                Exportar Reporte CSV
            </button>
            <button class="btn-reporte-actualizar" onclick="ejecutarReporte()">
                Actualizar Datos
            </button>
        </div>
    `;
    
    container.innerHTML = html;
}


function obtenerTituloRecursos(recursoFiltrado) {
    if (recursoFiltrado === 'insumo') {
        return '📦 Insumos Más Solicitados';
    } else if (recursoFiltrado === 'papeleria') {
        return '📝 Papelería Más Solicitada';
    } else {
        return '📊 Recursos Más Solicitados';
    }
}


function crearTablaRecursos(recursoFiltrado) {
    let datos = {};
    
    // ✅ SELECCIONAR DATOS SEGÚN EL FILTRO
    if (recursoFiltrado === 'insumo') {
        datos = datosReporte.actual.insumosSolicitados;
    } else if (recursoFiltrado === 'papeleria') {
        datos = datosReporte.actual.papeleriaSolicitada;
    } else {
        // Mostrar recursos combinados si no hay filtro específico
        datos = datosReporte.actual.recursosSolicitados;
    }
    
    // Verificar si hay datos
    if (!datos || Object.keys(datos).length === 0) {
        const tipoRecurso = recursoFiltrado === 'insumo' ? 'insumos' : 
                           recursoFiltrado === 'papeleria' ? 'papelería' : 'recursos';
        return `<p class="no-datos">No hay datos de ${tipoRecurso} para este período</p>`;
    }
    
    // Ordenar por cantidad (descendente) y tomar top 10
    const recursosOrdenados = Object.entries(datos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    let html = `
        <table class="tabla-reporte">
            <thead>
                <tr>
                    <th>Recurso</th>
                    <th>Cantidad</th>
                    <th>Cambio</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    recursosOrdenados.forEach(([recurso, cantidad]) => {
        // Obtener cantidad anterior para comparación
        let cantidadAnterior = 0;
        if (recursoFiltrado === 'insumo') {
            cantidadAnterior = datosReporte.anterior.insumosSolicitados[recurso] || 0;
        } else if (recursoFiltrado === 'papeleria') {
            cantidadAnterior = datosReporte.anterior.papeleriaSolicitada[recurso] || 0;
        } else {
            cantidadAnterior = datosReporte.anterior.recursosSolicitados[recurso] || 0;
        }
        
        const cambio = calcularCambioSeguro(cantidad, cantidadAnterior);
        
        html += `
            <tr>
                <td>${recurso}</td>
                <td><strong>${cantidad}</strong></td>
                <td class="cambio">${cambio}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    return html;
}


function crearTarjetaEstadistica(titulo, actual, anterior) {
    const cambio = calcularCambioSeguro(actual, anterior);
    const claseCambio = cambio.startsWith('+') ? 'positivo' : cambio.startsWith('-') ? 'negativo' : 'neutral';
    
    return `
        <div class="tarjeta-estadistica">
            <div class="estadistica-titulo">${titulo}</div>
            <div class="estadistica-numero">${actual}</div>
            <div class="estadistica-cambio ${claseCambio}">${cambio}</div>
        </div>
    `;
}

function crearTablaAnalisisTipo() {
    const tipoActual = datosReporte.actual.porTipo;
    const tipoAnterior = datosReporte.anterior.porTipo;
    const total = datosReporte.actual.total;
    
    return `
        <table class="tabla-reporte">
            <thead>
                <tr>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>%</th>
                    <th>Cambio</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Ordinarias</td>
                    <td>${tipoActual.ordinaria}</td>
                    <td>${total > 0 ? ((tipoActual.ordinaria / total) * 100).toFixed(1) : 0}%</td>
                    <td class="cambio">${calcularCambioSeguro(tipoActual.ordinaria, tipoAnterior.ordinaria)}</td>
                </tr>
                <tr>
                    <td>Para Juntas</td>
                    <td>${tipoActual.juntas}</td>
                    <td>${total > 0 ? ((tipoActual.juntas / total) * 100).toFixed(1) : 0}%</td>
                    <td class="cambio">${calcularCambioSeguro(tipoActual.juntas, tipoAnterior.juntas)}</td>
                </tr>
            </tbody>
        </table>
    `;
}

function crearTablaPorAreas() {
    const areasOrdenadas = Object.entries(datosReporte.actual.porArea)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8); // Top 8 áreas
    
    let tbody = '';
    areasOrdenadas.forEach(([area, cantidad]) => {
        const anterior = datosReporte.anterior.porArea[area] || 0;
        const cambio = calcularCambioSeguro(cantidad, anterior);
        
        tbody += `
            <tr>
                <td class="area-nombre">${area}</td>
                <td class="area-cantidad">${cantidad}</td>
                <td class="area-cambio">${cambio}</td>
            </tr>
        `;
    });
    
    return `
        <table class="tabla-reporte">
            <thead>
                <tr>
                    <th>Área/Departamento</th>
                    <th>Solicitudes</th>
                    <th>Cambio</th>
                </tr>
            </thead>
            <tbody>
                ${tbody}
            </tbody>
        </table>
    `;
}

function crearTablaInsumos() {
    // Mantener esta función para compatibilidad con código existente
    return crearTablaRecursos('insumo');
}

// ===================================
// GRÁFICOS CON CHART.JS
// ===================================

function crearGraficos() {
    // Gráfico por área (si aplica)
    if (!datosReporte.periodo.area) {
        crearGraficoAreas();
    }
    
    // Gráfico de recursos (dinámico)
    crearGraficoRecursos();
}


function crearGraficoRecursos() {
    const canvas = document.getElementById('graficoRecursos');
    if (!canvas) return;
    
    const recursoFiltrado = datosReporte.periodo.recurso;
    let datos = {};
    
    // Seleccionar datos según el filtro
    if (recursoFiltrado === 'insumo') {
        datos = datosReporte.actual.insumosSolicitados;
    } else if (recursoFiltrado === 'papeleria') {
        datos = datosReporte.actual.papeleriaSolicitada;
    } else {
        datos = datosReporte.actual.recursosSolicitados;
    }
    
    if (!datos || Object.keys(datos).length === 0) {
        canvas.style.display = 'none';
        return;
    }
    
    // Top 8 para el gráfico
    const recursosTop = Object.entries(datos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: recursosTop.map(([recurso]) => 
                recurso.length > 25 ? recurso.substring(0, 22) + '...' : recurso
            ),
            datasets: [{
                data: recursosTop.map(([, cantidad]) => cantidad),
                backgroundColor: [
                    '#657153', '#8aaa79', '#b7b6c2', '#837569',
                    '#2c3e50', '#34495e', '#16a085', '#f39c12'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: obtenerTituloRecursos(recursoFiltrado)
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}


function crearGraficoAreas() {
    const canvas = document.getElementById('graficoAreas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const areas = Object.entries(datosReporte.actual.porArea)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: areas.map(([area]) => area),
            datasets: [{
                label: 'Solicitudes',
                data: areas.map(([, cantidad]) => cantidad),
                backgroundColor: '#657153',
                borderColor: '#8aaa79',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Solicitudes por Área'
                }
            }
        }
    });
}

function crearGraficoInsumos() {
    const canvas = document.getElementById('graficoInsumos');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const insumos = Object.entries(datosReporte.actual.insumosSolicitados)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    if (insumos.length === 0) {
        ctx.fillText('No hay datos de insumos', 50, 50);
        return;
    }
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: insumos.map(([insumo]) => insumo.length > 15 ? insumo.substring(0, 12) + '...' : insumo),
            datasets: [{
                data: insumos.map(([, cantidad]) => cantidad),
                backgroundColor: [
                    '#657153', '#8aaa79', '#b7b6c2', '#837569',
                    '#2c3e50', '#34495e', '#16a085', '#f39c12'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Insumos Más Solicitados'
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// ===================================
// EXPORTACIÓN
// ===================================

function exportarReporteCompleto() {
    if (!datosReporte) {
        alert('No hay datos para exportar');
        return;
    }
    
    const nombreMes = obtenerTituloReporte();
    const sufijo = datosReporte.periodo.area ? `_${datosReporte.periodo.area}` : '_todas_areas';
    
    // Preparar datos de exportación
    const datosExportacion = [];
    
    // Información del reporte
    datosExportacion.push({
        'Sección': 'INFORMACIÓN',
        'Concepto': 'Período',
        'Valor': `${nombreMes} ${datosReporte.periodo.ano}`,
        'Observaciones': datosReporte.periodo.area || 'Todas las áreas'
    });
    
    datosExportacion.push({
        'Sección': '',
        'Concepto': 'Total Solicitudes',
        'Valor': datosReporte.actual.total,
        'Observaciones': calcularCambioSeguro(datosReporte.actual.total, datosReporte.anterior.total)
    });
    
    datosExportacion.push({
        'Sección': '',
        'Concepto': 'Tokens Usados',
        'Valor': datosReporte.actual.tokenUsados,
        'Observaciones': calcularCambioSeguro(datosReporte.actual.tokenUsados, datosReporte.anterior.tokenUsados)
    });
    
    datosExportacion.push({
        'Sección': '',
        'Concepto': 'Solicitudes Cerradas',
        'Valor': datosReporte.actual.porEstado.cerrado,
        'Observaciones': calcularCambioSeguro(datosReporte.actual.porEstado.cerrado, datosReporte.anterior.porEstado.cerrado)
    });
    
    datosExportacion.push({}); // Línea vacía
    
    // SECCIÓN DETALLADA POR ÁREAS (EN LUGAR DE TIPOS)
    datosExportacion.push({ 
        'Sección': 'ANÁLISIS POR ÁREA', 
        'Concepto': '', 
        'Valor': '', 
        'Observaciones': '' 
    });
    
    // Ordenar áreas por cantidad de solicitudes
    const areasOrdenadas = Object.entries(datosReporte.actual.porArea)
        .sort((a, b) => b[1] - a[1]);
    
    areasOrdenadas.forEach(([area, cantidad]) => {
        const anterior = datosReporte.anterior.porArea[area] || 0;
        const cambio = calcularCambioSeguro(cantidad, anterior);
        const porcentaje = datosReporte.actual.total > 0 ? 
            ((cantidad / datosReporte.actual.total) * 100).toFixed(1) + '%' : '0%';
        
        datosExportacion.push({
            'Sección': '',
            'Concepto': area,
            'Valor': cantidad,
            'Observaciones': `${porcentaje} del total | Cambio: ${cambio}`
        });
    });
    
    datosExportacion.push({}); // Línea vacía
    
    // Top insumos (mantener como estaba)
    datosExportacion.push({ 
        'Sección': 'INSUMOS MÁS SOLICITADOS', 
        'Concepto': '', 
        'Valor': '', 
        'Observaciones': '' 
    });
    
    Object.entries(datosReporte.actual.insumosSolicitados)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([insumo, cantidad]) => {
            const anterior = datosReporte.anterior.insumosSolicitados[insumo] || 0;
            datosExportacion.push({
                'Sección': '',
                'Concepto': insumo,
                'Valor': cantidad,
                'Observaciones': calcularCambioSeguro(cantidad, anterior)
            });
        });
    
    // Exportar usando la función existente
    exportarCSV(datosExportacion, `reporte_${nombreMes}_${datosReporte.periodo.ano}${sufijo}`);
}

function exportarCSV(data, nombreArchivo) {
    // Reutilizar tu función convertirACSV existente
    const csvContent = convertirACSV(data);
    const BOM = '\uFEFF';
    const contentWithBOM = BOM + csvContent;
    
    const blob = new Blob([contentWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${nombreArchivo}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    if (window.showNotificationAdmin) {
        showNotificationAdmin('Reporte exportado exitosamente', 'success');
    }
}


// Función faltante para convertir datos a CSV
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

// ===================================
// UTILIDADES
// ===================================
function obtenerTituloReporte() {
    let titulo = '';
    
    if (datosReporte.periodo.tipo === 'anual') {
        titulo = `Reporte Anual ${datosReporte.periodo.ano}`;
    } else {
        const nombreMes = obtenerNombreMes(datosReporte.periodo.mes);
        titulo = `Reporte de ${nombreMes} ${datosReporte.periodo.ano}`;
    }
    
    // ✅ AGREGAR sufijo del tipo de recurso si está filtrado
    if (datosReporte.periodo.recurso) {
        const tipoRecurso = datosReporte.periodo.recurso === 'insumo' ? '📦 Insumos' : '📝 Papelería';
        titulo += ` - ${tipoRecurso}`;
    }
    
    return titulo;
}

function obtenerNombreMes(numeroMes) {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[numeroMes - 1] || `Mes ${numeroMes}`;
}

function calcularCambioSeguro(actual, anterior) {
    if (!anterior || anterior === 0) {
        return actual > 0 ? `+${actual}` : '0';
    }
    
    const diferencia = actual - anterior;
    if (diferencia === 0) return '0';
    
    const porcentaje = Math.abs((diferencia / anterior) * 100).toFixed(1);
    return diferencia > 0 ? `+${diferencia} (+${porcentaje}%)` : `${diferencia} (-${porcentaje}%)`;
}

function mostrarLoadingReporte(mostrar) {
    const loading = document.getElementById('reporteLoading');
    const contenido = document.getElementById('reporteContenido');
    
    if (loading) loading.style.display = mostrar ? 'block' : 'none';
    if (contenido) contenido.style.display = mostrar ? 'none' : 'block';
}

function mostrarErrorReporte(mensaje) {
    const contenido = document.getElementById('reporteContenido');
    if (contenido) {
        contenido.innerHTML = `
            <div class="error-reporte">
                <h4>Error generando reporte</h4>
                <p>${mensaje}</p>
                <button onclick="ejecutarReporte()">Reintentar</button>
            </div>
        `;
    }
}

function cerrarReporteModal() {
    document.getElementById('reporteModal').style.display = 'none';
    document.body.style.overflow = '';
}
// Función para abrir el modal (llamar desde admin.html)
function abrirReportes() {
    document.getElementById('reporteModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    inicializarReportes();
}

function cerrarReportes() {
    document.getElementById('reporteModal').style.display = 'none';
    document.body.style.overflow = '';
}

function cambiarPeriodo() {
    const tipo = document.getElementById('tipoPeriodo').value;
    const mesContainer = document.getElementById('selectorMes');
    mesContainer.style.display = tipo === 'mes' ? 'block' : 'none';
}
console.log('Sistema de reportes cargado correctamente');

console.log('📊 DATOS DEL REPORTE:');
console.log('Total solicitudes:', datosReporte.actual.total);
console.log('Por recurso:', datosReporte.actual.porRecurso);
console.log('Insumos solicitados:', datosReporte.actual.insumosSolicitados);
console.log('Papelería solicitada:', datosReporte.actual.papeleriaSolicitada);
console.log('Recursos combinados:', datosReporte.actual.recursosSolicitados);
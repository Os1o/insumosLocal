/* ===================================
   SISTEMA DE REPORTES - MIGRADO A API LOCAL
   =================================== */

// Variables específicas del sistema de reportes
let datosReporte = null;
let mesSeleccionado = new Date().getMonth() + 1;
let anoSeleccionado = new Date().getFullYear();
let areaSeleccionada = '';
let areasDisponibles = [];
let tipoPeriodoSeleccionado = 'mes';

// URL del API
const API_REPORTES_URL = 'http://11.254.27.18/insumos/api/endpoints/reportes.php';

// ===================================
// INICIALIZACIÓN
// ===================================

function inicializarReportes() {
    console.log('📊 Inicializando sistema de reportes (API Local)...');
    configurarSelectores();
    cargarAreas();
}

function configurarSelectores() {
    // Selector de tipo de período
    const selectorTipoPeriodo = document.getElementById('tipoPeriodo');
    if (selectorTipoPeriodo) {
        selectorTipoPeriodo.innerHTML = `
            <option value="mes">Un mes específico</option>
            <option value="anual">Año completo</option>
        `;
    }
    
    // Selector de mes
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
    
    // Selector de año
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

function cambiarPeriodo() {
    cambiarTipoPeriodo();
}

async function cargarAreas() {
    try {
        const response = await fetch(API_REPORTES_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action: 'get-areas' })
        });
        
        const result = await response.json();
        
        if (!result.success) throw new Error(result.error);
        
        areasDisponibles = result.data || [];
        
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

async function ejecutarReporte() {
    try {
        tipoPeriodoSeleccionado = document.getElementById('tipoPeriodo').value;
        anoSeleccionado = parseInt(document.getElementById('selectorAno').value);
        areaSeleccionada = document.getElementById('selectorArea').value;
        const recursoSeleccionado = document.getElementById('selectorRecurso')?.value || null;
        
        mostrarLoadingReporte(true);
        
        let datosActual, datosAnterior;
        
        if (tipoPeriodoSeleccionado === 'mes') {
            // Reporte mensual
            mesSeleccionado = parseInt(document.getElementById('selectorMes').value);
            
            const responseMensual = await fetch(API_REPORTES_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'generar-mensual',
                    mes: mesSeleccionado,
                    ano: anoSeleccionado,
                    area: areaSeleccionada || null,
                    recurso_tipo: recursoSeleccionado
                })
            });
            
            const resultMensual = await responseMensual.json();
            
            if (!resultMensual.success) throw new Error(resultMensual.error);
            
            datosActual = resultMensual.data.actual;
            datosAnterior = resultMensual.data.anterior;
            
        } else if (tipoPeriodoSeleccionado === 'anual') {
            // Reporte anual
            const responseAnual = await fetch(API_REPORTES_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'generar-anual',
                    ano: anoSeleccionado,
                    area: areaSeleccionada || null,
                    recurso_tipo: recursoSeleccionado
                })
            });
            
            const resultAnual = await responseAnual.json();
            
            if (!resultAnual.success) throw new Error(resultAnual.error);
            
            datosActual = resultAnual.data.actual;
            datosAnterior = resultAnual.data.anterior;
        }
        
        // Guardar datos del reporte
        datosReporte = {
            periodo: {
                tipo: tipoPeriodoSeleccionado,
                mes: tipoPeriodoSeleccionado === 'mes' ? mesSeleccionado : null,
                ano: anoSeleccionado,
                area: areaSeleccionada,
                recurso: recursoSeleccionado
            },
            actual: datosActual,
            anterior: datosAnterior
        };
        
        renderizarReporte();
        
        setTimeout(() => {
            crearGraficos();
        }, 200);
        
        mostrarLoadingReporte(false);
        
    } catch (error) {
        console.error('❌ Error ejecutando reporte:', error);
        mostrarErrorReporte('Error generando el reporte: ' + error.message);
        mostrarLoadingReporte(false);
    }
}

// ===================================
// RENDERIZADO DEL REPORTE
// ===================================

function renderizarReporte() {
    const container = document.getElementById('reporteContenido');
    if (!container || !datosReporte) return;
    
    const tituloArea = datosReporte.periodo.area ? ` - ${datosReporte.periodo.area}` : '';
    const recursoFiltrado = datosReporte.periodo.recurso;
    
    let html = `
        <div class="reporte-titulo">
            <h3>${obtenerTituloReporte()}${tituloArea}</h3>
            <p>Comparación con período anterior</p>
        </div>
        
        <div class="estadisticas-principales">
            ${crearTarjetaEstadistica('Total Solicitudes', datosReporte.actual.total, datosReporte.anterior.total)}
            ${crearTarjetaEstadistica('Tokens Usados', datosReporte.actual.tokenUsados, datosReporte.anterior.tokenUsados)}
            ${crearTarjetaEstadistica('Solicitudes Cerradas', datosReporte.actual.porEstado.cerrado, datosReporte.anterior.porEstado.cerrado)}
        </div>
        
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
        
        <div class="acciones-reporte">
            <button class="btn-reporte-exportar" onclick="exportarReporteCompleto()">
                📊 Exportar Reporte CSV
            </button>
            <button class="btn-reporte-actualizar" onclick="ejecutarReporte()">
                🔄 Actualizar Datos
            </button>
        </div>
    `;
    
    container.innerHTML = html;
    container.style.display = 'block';
}

function obtenerTituloReporte() {
    let titulo = '';
    
    if (datosReporte.periodo.tipo === 'anual') {
        titulo = `Reporte Anual ${datosReporte.periodo.ano}`;
    } else {
        const nombreMes = obtenerNombreMes(datosReporte.periodo.mes);
        titulo = `Reporte de ${nombreMes} ${datosReporte.periodo.ano}`;
    }
    
    if (datosReporte.periodo.recurso) {
        const tipoRecurso = datosReporte.periodo.recurso === 'insumo' ? '📦 Insumos' : '📝 Papelería';
        titulo += ` - ${tipoRecurso}`;
    }
    
    return titulo;
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

function crearTablaPorAreas() {
    const areasOrdenadas = Object.entries(datosReporte.actual.porArea)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    if (areasOrdenadas.length === 0) {
        return '<p class="no-datos">No hay datos de áreas para este período</p>';
    }
    
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

function crearTablaRecursos(recursoFiltrado) {
    let datos = {};
    
    if (recursoFiltrado === 'insumo') {
        datos = datosReporte.actual.insumosSolicitados;
    } else if (recursoFiltrado === 'papeleria') {
        datos = datosReporte.actual.papeleriaSolicitada;
    } else {
        datos = datosReporte.actual.recursosSolicitados;
    }
    
    if (!datos || Object.keys(datos).length === 0) {
        const tipoRecurso = recursoFiltrado === 'insumo' ? 'insumos' : 
                           recursoFiltrado === 'papeleria' ? 'papelería' : 'recursos';
        return `<p class="no-datos">No hay datos de ${tipoRecurso} para este período</p>`;
    }
    
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

// ===================================
// GRÁFICOS
// ===================================

function crearGraficos() {
    if (!datosReporte.periodo.area) {
        crearGraficoAreas();
    }
    crearGraficoRecursos();
}

function crearGraficoAreas() {
    const canvas = document.getElementById('graficoAreas');
    if (!canvas) return;
    
    const areas = Object.entries(datosReporte.actual.porArea)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    
    if (areas.length === 0) {
        canvas.style.display = 'none';
        return;
    }
    
    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: areas.map(([area]) => area),
            datasets: [{
                label: 'Solicitudes',
                data: areas.map(([, cantidad]) => cantidad),
                backgroundColor: '#667eea',
                borderColor: '#764ba2',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
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

function crearGraficoRecursos() {
    const canvas = document.getElementById('graficoRecursos');
    if (!canvas) return;
    
    const recursoFiltrado = datosReporte.periodo.recurso;
    let datos = {};
    
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
                    '#667eea', '#764ba2', '#f093fb', '#4facfe',
                    '#43e97b', '#fa709a', '#fee140', '#30cfd0'
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

// ===================================
// EXPORTACIÓN
// ===================================

function exportarReporteCompleto() {
    if (!datosReporte) {
        alert('No hay datos para exportar');
        return;
    }
    
    const nombreReporte = obtenerTituloReporte();
    const sufijo = datosReporte.periodo.area ? `_${datosReporte.periodo.area}` : '_todas_areas';
    
    const datosExportacion = [];
    
    // Información del reporte
    datosExportacion.push({
        'Sección': 'INFORMACIÓN',
        'Concepto': 'Período',
        'Valor': nombreReporte,
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
    
    datosExportacion.push({});
    
    // Por áreas
    datosExportacion.push({ 
        'Sección': 'ANÁLISIS POR ÁREA', 
        'Concepto': '', 
        'Valor': '', 
        'Observaciones': '' 
    });
    
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
    
    datosExportacion.push({});
    
    // Recursos
    datosExportacion.push({ 
        'Sección': 'RECURSOS MÁS SOLICITADOS', 
        'Concepto': '', 
        'Valor': '', 
        'Observaciones': '' 
    });
    
    Object.entries(datosReporte.actual.recursosSolicitados)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .forEach(([recurso, cantidad]) => {
            const anterior = datosReporte.anterior.recursosSolicitados[recurso] || 0;
            datosExportacion.push({
                'Sección': '',
                'Concepto': recurso,
                'Valor': cantidad,
                'Observaciones': calcularCambioSeguro(cantidad, anterior)
            });
        });
    
    exportarCSV(datosExportacion, `reporte_${datosReporte.periodo.ano}${sufijo}`);
}

function exportarCSV(data, nombreArchivo) {
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

function convertirACSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            
            const stringValue = value.toString();
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(','))
    ].join('\r\n');
    
    return csvContent;
}

// ===================================
// UTILIDADES
// ===================================

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
                <h4>⚠️ Error generando reporte</h4>
                <p>${mensaje}</p>
                <button class="btn-reporte-actualizar" onclick="ejecutarReporte()">🔄 Reintentar</button>
            </div>
        `;
        contenido.style.display = 'block';
    }
}

function abrirReportes() {
    document.getElementById('reporteModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    inicializarReportes();
}

function cerrarReporteModal() {
    document.getElementById('reporteModal').style.display = 'none';
    document.body.style.overflow = '';
}

console.log('✅ reportes-migrado.js cargado correctamente - Usando API Local');
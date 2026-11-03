/* agroflow/views/reportes/reportes.js */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar Iconos
    lucide.createIcons();

    // 2. Control de Rol y Sidebar
    const currentRole = localStorage.getItem('agroflow_user_role');
    if (currentRole === 'SUPERVISOR') {
        window.location.href = '../supervisor/index.html';
        return;
    } else if (currentRole === 'OBRERO') {
        window.location.href = '../obrero/index.html';
        return;
    } else if (currentRole === 'JEFE_ALMACEN') {
        window.location.href = '../jefealmacen/index.html';
        return;
    }

    const sidebar = document.getElementById('sidebar');
    document.getElementById('openSidebar')?.addEventListener('click', () => sidebar.classList.add('active'));
    document.getElementById('closeSidebar')?.addEventListener('click', () => sidebar.classList.remove('active'));

    // Usuario Logueado
    const storedName = localStorage.getItem('agroflow_user_name');
    if (storedName) {
        document.getElementById('topUserName').textContent = storedName;
    }

    // Cerrar Sesión
    document.getElementById('btnLogout')?.addEventListener('click', () => {
        localStorage.removeItem('agroflow_user_role');
        localStorage.removeItem('agroflow_user_name');
        localStorage.removeItem('agroflow_user_id');
        localStorage.removeItem('agroflow_user_dni');
    });

    const apiBase = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
        ? CONFIG.API_BASE_URL 
        : 'http://localhost:8000/api';

    // Estado Local
    let incidencias = [];
    let sectores = [];
    let cuadrillas = [];
    let cosechas = [];
    let tareas = [];
    let mapaCalorData = null;
    let heatmapCurrentView = 'DIAS';
    let activeIncidentForDecision = null;

    // DOM Elements - Filtros y Stats
    const selectTipoReporte = document.getElementById('selectTipoReporte');
    const selectCuadrilla = document.getElementById('selectCuadrilla');
    const selectLabor = document.getElementById('selectLabor');
    const selectSector = document.getElementById('selectSector');
    const selectGravedad = document.getElementById('selectGravedad');
    const selectEstado = document.getElementById('selectEstado');
    const groupFiltroCuadrilla = document.getElementById('groupFiltroCuadrilla');
    const groupFiltroLabor = document.getElementById('groupFiltroLabor');
    const groupFiltroSector = document.getElementById('groupFiltroSector');
    const groupFiltroGravedad = document.getElementById('groupFiltroGravedad');
    const groupFiltroEstado = document.getElementById('groupFiltroEstado');
    const searchInput = document.getElementById('searchInput');
    const btnFiltrar = document.getElementById('btnFiltrar');
    const btnRefreshReportes = document.getElementById('btnRefreshReportes');
    const refreshIcon = document.getElementById('refreshIcon');
    const liveSyncText = document.getElementById('liveSyncText');

    // Heatmap Elements
    const heatmapCard = document.getElementById('heatmapCard');
    const heatmapContainer = document.getElementById('heatmapContainer');
    const btnHeatmapDias = document.getElementById('btnHeatmapDias');
    const btnHeatmapHoras = document.getElementById('btnHeatmapHoras');
    const heatmapLeaderText = document.getElementById('heatmapLeaderText');

    // DOM Elements - KPIs
    const statTotalIncidencias = document.getElementById('statTotalIncidencias');
    const statCriticas = document.getElementById('statCriticas');
    const statEnProceso = document.getElementById('statEnProceso');
    const statResueltas = document.getElementById('statResueltas');
    const topNotificationBadge = document.getElementById('topNotificationBadge');

    // DOM Elements - Tabla
    const tableCardTitle = document.getElementById('tableCardTitle');
    const tableCardSubtitle = document.getElementById('tableCardSubtitle');
    const recordsCountTag = document.getElementById('recordsCountTag');
    const reportesThead = document.getElementById('reportesThead');
    const reportesTbody = document.getElementById('reportesTbody');

    // Export Buttons
    const btnExportExcel = document.getElementById('btnExportExcel');
    const btnExportPdf = document.getElementById('btnExportPdf');

    // Modal Decisión
    const modalDecision = document.getElementById('modalDecision');
    const btnCerrarModalDecision = document.getElementById('btnCerrarModalDecision');
    const btnCancelarModalDecision = document.getElementById('btnCancelarModalDecision');
    const formDecision = document.getElementById('formDecision');
    const modalIncidenciaId = document.getElementById('modalIncidenciaId');
    const modalIncidenciaBadges = document.getElementById('modalIncidenciaBadges');
    const modalIncidenciaFecha = document.getElementById('modalIncidenciaFecha');
    const modalIncidenciaTitulo = document.getElementById('modalIncidenciaTitulo');
    const modalIncidenciaSector = document.getElementById('modalIncidenciaSector');
    const modalIncidenciaSupervisor = document.getElementById('modalIncidenciaSupervisor');
    const modalIncidenciaDesc = document.getElementById('modalIncidenciaDesc');
    const modalIncidenciaAccionContainer = document.getElementById('modalIncidenciaAccionContainer');
    const modalIncidenciaAccion = document.getElementById('modalIncidenciaAccion');
    const selectNuevoEstado = document.getElementById('selectNuevoEstado');
    const textareaResolucion = document.getElementById('textareaResolucion');
    const btnGuardarDecision = document.getElementById('btnGuardarDecision');
    const btnSugerirResolucionIA = document.getElementById('btnSugerirResolucionIA');
    const aiSuggestionNotice = document.getElementById('aiSuggestionNotice');
    const aiSuggestionNoticeText = document.getElementById('aiSuggestionNoticeText');

    // Inicializar
    initApp();

    async function initApp() {
        try {
            await Promise.all([
                loadSectores(),
                loadData()
            ]);
            setupEventListeners();

            // Auto-refresh cada 60s
            setInterval(loadData, 60000);
        } catch (err) {
            console.error('Error inicializando reportes:', err);
        }
    }

    /**
     * Cargar sectores dinámicamente
     */
    async function loadSectores() {
        try {
            const res = await fetch(`${apiBase}/sectores/`);
            if (res.ok) {
                sectores = await res.json();
                selectSector.innerHTML = '<option value="TODOS">Todos los Sectores</option>' +
                    sectores.map(s => {
                        const cult = s.cultivo_nombre ? ` (${s.cultivo_nombre})` : '';
                        return `<option value="${s.id}">${s.nombre}${cult}</option>`;
                    }).join('');
            }
        } catch (e) {
            console.error('Error cargando sectores:', e);
        }
    }

    /**
     * Cargar todos los datos del backend
     */
    async function loadData() {
        try {
            const [resInc, resCua, resCos, resTar, resMap] = await Promise.all([
                fetch(`${apiBase}/incidencias/`).then(r => r.ok ? r.json() : []),
                fetch(`${apiBase}/cuadrillas/`).then(r => r.ok ? r.json() : []),
                fetch(`${apiBase}/cosechas/`).then(r => r.ok ? r.json() : []),
                fetch(`${apiBase}/tareas/`).then(r => r.ok ? r.json() : []),
                fetch(`${apiBase}/tareas/mapa_calor/`).then(r => r.ok ? r.json() : null)
            ]);

            incidencias = resInc || [];
            cuadrillas = resCua || [];
            cosechas = resCos || [];
            tareas = resTar || [];
            mapaCalorData = resMap || null;

            // Popular selectCuadrilla si aún no tiene las opciones
            if (selectCuadrilla && selectCuadrilla.options.length <= 1) {
                selectCuadrilla.innerHTML = '<option value="TODAS">Todas las Cuadrillas</option>' +
                    cuadrillas.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)} (${escapeHtml(c.encargado_nombre || 'Supervisor')})</option>`).join('');
            }

            updateFilterVisibility();
            renderStats();
            applyFiltersAndRender();

            // Actualizar hora de sincronización
            const ahora = new Date();
            if (liveSyncText) {
                liveSyncText.textContent = `Centro de Control Gerencial · Sincronizado ${ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
            }

            lucide.createIcons();
        } catch (err) {
            console.error('Error cargando datos de reportes:', err);
        }
    }

    /**
     * Alternar visibilidad de filtros según el módulo seleccionado
     */
    function updateFilterVisibility() {
        const val = selectTipoReporte.value;
        const isTareas = (val === 'TAREAS');
        const isIncidencias = (val === 'INCIDENCIAS');
        const isCosecha = (val === 'COSECHA');
        const isCuadrillas = (val === 'CUADRILLAS');

        if (groupFiltroCuadrilla) groupFiltroCuadrilla.style.display = (isTareas || isIncidencias) ? 'flex' : 'none';
        if (groupFiltroLabor) groupFiltroLabor.style.display = isTareas ? 'flex' : 'none';
        if (groupFiltroSector) groupFiltroSector.style.display = (isTareas || isIncidencias || isCosecha) ? 'flex' : 'none';
        if (groupFiltroGravedad) groupFiltroGravedad.style.display = isIncidencias ? 'flex' : 'none';
        
        if (groupFiltroEstado) {
            groupFiltroEstado.style.display = (isTareas || isIncidencias) ? 'flex' : 'none';
            const curVal = selectEstado.value;
            if (isTareas) {
                selectEstado.innerHTML = `
                    <option value="TODOS" ${curVal === 'TODOS' ? 'selected' : ''}>Todos los Estados</option>
                    <option value="COMPLETADA" ${curVal === 'COMPLETADA' ? 'selected' : ''}>✅ Completadas</option>
                    <option value="EN_PROCESO" ${curVal === 'EN_PROCESO' ? 'selected' : ''}>▶️ En Proceso</option>
                    <option value="PENDIENTE" ${curVal === 'PENDIENTE' ? 'selected' : ''}>⏳ Pendientes</option>
                `;
            } else if (isIncidencias) {
                selectEstado.innerHTML = `
                    <option value="TODOS" ${curVal === 'TODOS' ? 'selected' : ''}>Todos los Estados</option>
                    <option value="ABIERTA" ${curVal === 'ABIERTA' ? 'selected' : ''}>Abiertas / En Revisión</option>
                    <option value="EN_PROCESO" ${curVal === 'EN_PROCESO' ? 'selected' : ''}>En Proceso</option>
                    <option value="RESUELTA" ${curVal === 'RESUELTA' ? 'selected' : ''}>Resueltas</option>
                `;
            }
        }
    }

    /**
     * Métricas de KPIs Superiores
     */
    function renderStats() {
        const val = selectTipoReporte.value;
        const labelTotal = document.querySelector('.stat-card-rep:nth-child(1) .stat-card-rep__label');
        const labelCriticas = document.querySelector('.stat-card-rep:nth-child(2) .stat-card-rep__label');
        const labelEnProceso = document.querySelector('.stat-card-rep:nth-child(3) .stat-card-rep__label');
        const labelResueltas = document.querySelector('.stat-card-rep:nth-child(4) .stat-card-rep__label');

        if (val === 'TAREAS' && mapaCalorData && mapaCalorData.resumen) {
            const r = mapaCalorData.resumen;
            statTotalIncidencias.textContent = r.total_tareas;
            statCriticas.textContent = `${r.tareas_completadas} (${r.porcentaje_cumplimiento}%)`;
            statEnProceso.textContent = `${r.total_horas_trabajadas}h`;
            statResueltas.textContent = r.cuadrilla_lider ? `${r.cuadrilla_lider.horas}h` : '0h';

            if (labelTotal) labelTotal.textContent = 'Total Labores en Plan';
            if (labelCriticas) labelCriticas.textContent = 'Labores Completadas (% Avance)';
            if (labelEnProceso) labelEnProceso.textContent = 'Horas Efectivas Ejecutadas';
            if (labelResueltas) labelResueltas.textContent = r.cuadrilla_lider ? `Líder: ${r.cuadrilla_lider.nombre}` : 'Sin cuadrilla líder';
        } else {
            const total = incidencias.length;
            const criticas = incidencias.filter(i => i.gravedad === 'CRITICA' || i.gravedad === 'ALTA').length;
            const enProceso = incidencias.filter(i => i.estado === 'EN_PROCESO').length;
            const resueltas = incidencias.filter(i => i.estado === 'RESUELTA').length;

            statTotalIncidencias.textContent = total;
            statCriticas.textContent = criticas;
            statEnProceso.textContent = enProceso;
            statResueltas.textContent = resueltas;

            if (labelTotal) labelTotal.textContent = 'Total Incidencias Reportadas';
            if (labelCriticas) labelCriticas.textContent = 'Críticas / Riesgo Alto';
            if (labelEnProceso) labelEnProceso.textContent = 'En Proceso de Atención';
            if (labelResueltas) labelResueltas.textContent = 'Resueltas por Gerencia';
        }

        // Notificaciones pendientes
        const abiertas = incidencias.filter(i => i.estado === 'ABIERTA').length;
        if (topNotificationBadge) {
            if (abiertas > 0) {
                topNotificationBadge.textContent = abiertas;
                topNotificationBadge.style.display = 'inline-flex';
            } else {
                topNotificationBadge.style.display = 'none';
            }
        }
    }

    /**
     * Aplica filtros y renderiza el reporte seleccionado
     */
    function applyFiltersAndRender() {
        const tipoReporte = selectTipoReporte.value;

        if (tipoReporte === 'TAREAS') {
            if (heatmapCard) heatmapCard.style.display = 'block';
            renderHeatmap();
            renderTareasReport();
        } else {
            if (heatmapCard) heatmapCard.style.display = 'none';
            if (tipoReporte === 'INCIDENCIAS') {
                renderIncidenciasReport();
            } else if (tipoReporte === 'COSECHA') {
                renderCosechasReport();
            } else if (tipoReporte === 'CUADRILLAS') {
                renderCuadrillasReport();
            }
        }
    }

    /**
     * 0. MAPA DE CALOR (HEATMAP) DE RENDIMIENTO DE CUADRILLAS
     */
    function renderHeatmap() {
        if (!mapaCalorData || !heatmapContainer) return;

        const heatmapSubtitle = document.querySelector('.heatmap-subtitle');
        const legendEl = document.getElementById('heatmapLegend');

        if (heatmapCurrentView === 'DIAS') {
            if (heatmapSubtitle) {
                heatmapSubtitle.textContent = 'Historial semanal de labores completadas y horas trabajadas por cada cuadrilla (Lunes a Sábado)';
            }
            if (legendEl) {
                legendEl.innerHTML = `
                    <span class="legend-title"><i data-lucide="info" style="width:13px;height:13px;vertical-align:middle;"></i> Escala de Horas por Día:</span>
                    <span class="legend-chip"><span class="legend-color legend-0"></span> <strong>0h</strong> Sin labor</span>
                    <span class="legend-chip"><span class="legend-color legend-1"></span> <strong>0.1h - 3.0h</strong> Media Jornada</span>
                    <span class="legend-chip"><span class="legend-color legend-2"></span> <strong>3.1h - 6.0h</strong> Jornada Parcial</span>
                    <span class="legend-chip"><span class="legend-color legend-3"></span> <strong>6.1h - 8.0h</strong> Jornada Completa</span>
                `;
            }
            if (heatmapLeaderText && mapaCalorData.resumen && mapaCalorData.resumen.cuadrilla_lider) {
                const lider = mapaCalorData.resumen.cuadrilla_lider;
                heatmapLeaderText.textContent = `Cuadrilla Líder Semanal: ${lider.nombre} (${lider.supervisor}) • ${lider.horas}h acumuladas (${lider.tareas} labores completadas)`;
            }

            // Matriz por Días de la Semana
            const headers = mapaCalorData.dias_semana_labels || ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const rows = mapaCalorData.mapa_dias || [];

            let html = `
                <table class="heatmap-table">
                    <thead>
                        <tr>
                            <th class="th-crew">Cuadrilla / Supervisor</th>
                            ${headers.map(d => `<th>${d}</th>`).join('')}
                            <th class="th-total">Total Semana</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            rows.forEach(r => {
                html += `
                    <tr>
                        <td class="td-crew">
                            <span class="td-crew__name">${escapeHtml(r.cuadrilla_nombre)}</span>
                            <span class="td-crew__sup">${escapeHtml(r.supervisor_nombre)}</span><br>
                            <span class="td-crew__sector"><i data-lucide="map-pin" style="width:11px;height:11px;display:inline;"></i> ${escapeHtml(r.sector_nombre)}</span>
                        </td>
                `;

                r.dias.forEach(d => {
                    const horas = d.horas || 0;
                    let level = 0;
                    if (horas > 6.0) level = 3;
                    else if (horas > 3.0) level = 2;
                    else if (horas > 0) level = 1;

                    const tareasTooltip = d.tareas && d.tareas.length > 0 
                        ? d.tareas.map(t => `• ${t.titulo} ${t.estado_detalle || ''}${t.duracion ? ' · ' + t.duracion : ''}`).join('&#10;')
                        : 'Sin labores registradas';

                    html += `
                        <td class="heatmap-cell" data-level="${level}" title="${r.cuadrilla_nombre} - ${d.dia} (${d.fecha || ''})&#10;Horas: ${horas}h&#10;Tareas: ${d.tareas_count}&#10;${tareasTooltip}">
                            <span class="cell-hours">${horas > 0 ? horas + 'h' : '—'}</span>
                            <span class="cell-tasks">${d.tareas_count > 0 ? d.tareas_count + ' lab.' : ''}</span>
                        </td>
                    `;
                });

                html += `
                        <td class="td-total-cell">
                            <span class="td-total-hours">${r.total_horas}h</span>
                            <span class="td-total-sub">${r.tareas_completadas} completadas</span>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            heatmapContainer.innerHTML = html;
        } else {
            // Matriz por Franjas Horarias del Día de Hoy
            if (heatmapSubtitle) {
                const fStr = mapaCalorData.fecha_consulta || 'Hoy';
                heatmapSubtitle.textContent = `Concentración horaria y avance de labores en la jornada de hoy (${fStr}) · Bloques de 2 horas (máx 2h por bloque)`;
            }
            if (legendEl) {
                legendEl.innerHTML = `
                    <span class="legend-title"><i data-lucide="info" style="width:13px;height:13px;vertical-align:middle;"></i> Escala Carga/Bloque (2h máx):</span>
                    <span class="legend-chip"><span class="legend-color legend-0"></span> <strong>0h</strong> Inactivo</span>
                    <span class="legend-chip"><span class="legend-color legend-1"></span> <strong>&lt; 1.0h</strong> Carga Baja</span>
                    <span class="legend-chip"><span class="legend-color legend-2"></span> <strong>1.1h - 1.5h</strong> Carga Media</span>
                    <span class="legend-chip"><span class="legend-color legend-3"></span> <strong>1.6h - 2.0h</strong> Carga Plena</span>
                `;
            }

            const headers = mapaCalorData.franjas_labels || [];
            const rows = mapaCalorData.mapa_franjas || [];

            // Identificar líder de hoy
            if (heatmapLeaderText && rows.length > 0) {
                const sortedHoy = [...rows].sort((a, b) => b.total_horas - a.total_horas);
                const lHoy = sortedHoy[0];
                if (lHoy && lHoy.total_horas > 0) {
                    heatmapLeaderText.textContent = `Cuadrilla con Mayor Avance Hoy: ${lHoy.cuadrilla_nombre} (${lHoy.supervisor_nombre}) • ${lHoy.total_horas}h ejecutadas hoy (${lHoy.tareas_completadas} completadas, ${lHoy.tareas_en_proceso} en curso)`;
                }
            }

            let html = `
                <table class="heatmap-table">
                    <thead>
                        <tr>
                            <th class="th-crew">Cuadrilla / Supervisor</th>
                            ${headers.map(f => `<th>${f}</th>`).join('')}
                            <th class="th-total">Total Hoy</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            rows.forEach(r => {
                html += `
                    <tr>
                        <td class="td-crew">
                            <span class="td-crew__name">${escapeHtml(r.cuadrilla_nombre)}</span>
                            <span class="td-crew__sup">${escapeHtml(r.supervisor_nombre)}</span><br>
                            <span class="td-crew__sector"><i data-lucide="map-pin" style="width:11px;height:11px;display:inline;"></i> ${escapeHtml(r.sector_nombre)}</span>
                        </td>
                `;

                r.franjas.forEach(f => {
                    const horas = f.horas || 0;
                    let level = 0;
                    if (horas > 1.5) level = 3;
                    else if (horas > 1.0) level = 2;
                    else if (horas > 0) level = 1;

                    const tareasTooltip = f.tareas && f.tareas.length > 0 
                        ? f.tareas.map(t => `• ${t.titulo} ${t.estado_detalle || ''}${t.duracion ? ' · ' + t.duracion : ''}`).join('&#10;')
                        : 'Sin labores registradas en este bloque';

                    html += `
                        <td class="heatmap-cell" data-level="${level}" title="${r.cuadrilla_nombre} - Bloque ${f.franja}&#10;Horas: ${horas}h&#10;Labores: ${f.tareas_count}&#10;${tareasTooltip}">
                            <span class="cell-hours">${horas > 0 ? horas + 'h' : '—'}</span>
                            <span class="cell-tasks">${f.tareas_count > 0 ? f.tareas_count + ' lab.' : ''}</span>
                        </td>
                    `;
                });

                html += `
                        <td class="td-total-cell">
                            <span class="td-total-hours">${r.total_horas}h</span>
                            <span class="td-total-sub">${r.tareas_completadas} completadas</span>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            heatmapContainer.innerHTML = html;
        }

        lucide.createIcons();
    }

    /**
     * REPORTE: TABLA DETALLADA DE TAREAS Y TRAZABILIDAD
     */
    function renderTareasReport() {
        tableCardTitle.textContent = 'Bitácora Detallada de Tareas y Rendimiento de Cuadrillas';
        tableCardSubtitle.textContent = 'Trazabilidad de labores planificadas, horas de inicio, término y duración efectiva por cuadrilla';

        reportesThead.innerHTML = `
            <tr>
              <th>Fecha Programada</th>
              <th>Cuadrilla & Supervisor</th>
              <th>Labor & Tarea</th>
              <th>Sector & Cultivo</th>
              <th>Horario (Inicio → Fin)</th>
              <th>Duración Real</th>
              <th>Estado Exacto</th>
              <th>Observaciones de Cierre</th>
            </tr>
        `;

        let list = [...tareas];

        // Filtro Cuadrilla
        const cuadrillaVal = selectCuadrilla ? selectCuadrilla.value : 'TODAS';
        if (cuadrillaVal !== 'TODAS') {
            list = list.filter(t => String(t.cuadrilla) === String(cuadrillaVal));
        }

        // Filtro Labor
        const laborVal = selectLabor ? selectLabor.value : 'TODOS';
        if (laborVal !== 'TODOS') {
            list = list.filter(t => t.tipo_labor === laborVal);
        }

        // Filtro Sector
        const sectorVal = selectSector.value;
        if (sectorVal !== 'TODOS') {
            list = list.filter(t => String(t.sector) === String(sectorVal));
        }

        // Filtro Estado
        const estadoVal = selectEstado.value;
        if (estadoVal !== 'TODOS') {
            list = list.filter(t => t.estado === estadoVal);
        }

        // Buscador
        const query = (searchInput?.value || '').trim().toLowerCase();
        if (query) {
            list = list.filter(t => 
                (t.titulo && t.titulo.toLowerCase().includes(query)) ||
                (t.descripcion && t.descripcion.toLowerCase().includes(query)) ||
                (t.cuadrilla_nombre && t.cuadrilla_nombre.toLowerCase().includes(query)) ||
                (t.supervisor_nombre && t.supervisor_nombre.toLowerCase().includes(query)) ||
                (t.observaciones && t.observaciones.toLowerCase().includes(query))
            );
        }

        recordsCountTag.textContent = `${list.length} registros`;

        if (list.length === 0) {
            reportesTbody.innerHTML = `
                <tr>
                  <td colspan="8" class="text-center py-4 text-muted">
                    No hay tareas que coincidan con los filtros aplicados.
                  </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }

        reportesTbody.innerHTML = list.map(t => {
            let tagClass = 'tag--falta';
            let statusIcon = '⏳';
            if (t.estado === 'EN_PROCESO') {
                tagClass = 'tag--proceso';
                statusIcon = '▶️';
            } else if (t.estado === 'COMPLETADA') {
                tagClass = 'tag--terminado';
                statusIcon = '✅';
            }

            const estadoTexto = getEstadoDetalle(t);

            const horaIni = formatTime12(t.hora_inicio);
            const horaFin = formatTime12(t.hora_fin);
            const horarioStr = (t.estado === 'COMPLETADA') 
                ? `${horaIni} → ${horaFin}` 
                : (t.estado === 'EN_PROCESO' ? `Inició: ${horaIni}` : 'Programada');

            const durBadge = t.duracion_formateada && t.duracion_formateada !== '-'
                ? `<span class="duration-tag"><i data-lucide="clock"></i> ${t.duracion_formateada}</span>`
                : (t.estado === 'EN_PROCESO' ? `<span class="duration-tag duration-tag--process"><i data-lucide="play"></i> En curso</span>` : `<span class="text-muted">—</span>`);

            return `
                <tr>
                  <td><strong>${t.fecha_programada}</strong></td>
                  <td>
                    <strong>${escapeHtml(t.cuadrilla_nombre || 'Cuadrilla')}</strong><br>
                    <small class="text-muted">${escapeHtml(t.supervisor_nombre || 'Supervisor')}</small>
                  </td>
                  <td>
                    <span class="badge-labor-table badge-labor--${(t.tipo_labor || 'cosecha').toLowerCase()}">${escapeHtml(t.tipo_labor_display || t.tipo_labor)}</span><br>
                    <strong>${escapeHtml(t.titulo)}</strong>
                    <div style="margin-top: 0.25rem;">
                      <span class="task-status-tag ${tagClass}">${statusIcon} ${escapeHtml(estadoTexto)}</span>
                    </div>
                    ${t.descripcion ? `<small class="text-muted" style="display:block;margin-top:0.25rem;">${escapeHtml(t.descripcion)}</small>` : ''}
                  </td>
                  <td>
                    <strong>${escapeHtml(t.sector_nombre || 'General')}</strong><br>
                    <small class="text-muted">${escapeHtml(t.cultivo_nombre || '-')}</small>
                  </td>
                  <td><span style="font-size:0.8125rem; font-weight:600;">${horarioStr}</span></td>
                  <td>${durBadge}</td>
                  <td>
                    <span class="task-status-tag ${tagClass}">
                      ${statusIcon} ${escapeHtml(estadoTexto)}
                    </span>
                  </td>
                  <td>
                    ${t.observaciones ? `<span style="font-size:0.8125rem; color:#A7F3D0;">${escapeHtml(t.observaciones)}</span>` : `<span class="text-muted">—</span>`}
                  </td>
                </tr>
            `;
        }).join('');

        lucide.createIcons();
    }

    /**
     * 1. REPORTE PRINCIPAL: INCIDENCIAS Y TOMA DE DECISIONES
     */
    function renderIncidenciasReport() {
        tableCardTitle.textContent = 'Bitácora de Incidencias Operativas en Campo';
        tableCardSubtitle.textContent = 'Eventos registrados por supervisores de cuadrilla para toma de decisiones gerenciales';

        reportesThead.innerHTML = `
            <tr>
              <th>Fecha y Hora</th>
              <th>Gravedad</th>
              <th>Tipo / Título</th>
              <th>Sector y Cultivo</th>
              <th>Supervisor / Cuadrilla</th>
              <th>Descripción de Campo</th>
              <th>Estado</th>
              <th>Decisión Gerencial</th>
              <th>Acción</th>
            </tr>
        `;

        let list = [...incidencias];

        // Filtro Sector
        const sectorVal = selectSector.value;
        if (sectorVal !== 'TODOS') {
            list = list.filter(i => String(i.sector) === String(sectorVal));
        }

        // Filtro Gravedad
        const gravedadVal = selectGravedad.value;
        if (gravedadVal !== 'TODAS') {
            list = list.filter(i => i.gravedad === gravedadVal);
        }

        // Filtro Estado
        const estadoVal = selectEstado.value;
        if (estadoVal !== 'TODOS') {
            list = list.filter(i => i.estado === estadoVal);
        }

        // Búsqueda por texto
        const query = (searchInput?.value || '').trim().toLowerCase();
        if (query) {
            list = list.filter(i => 
                (i.titulo && i.titulo.toLowerCase().includes(query)) ||
                (i.descripcion && i.descripcion.toLowerCase().includes(query)) ||
                (i.sector_nombre && i.sector_nombre.toLowerCase().includes(query)) ||
                (i.reportado_por_nombre && i.reportado_por_nombre.toLowerCase().includes(query))
            );
        }

        recordsCountTag.textContent = `${list.length} incidencias`;

        if (list.length === 0) {
            reportesTbody.innerHTML = `
                <tr>
                  <td colspan="9" class="text-center py-4 text-muted">
                    No hay incidencias que coincidan con los filtros aplicados.
                  </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }

        reportesTbody.innerHTML = list.map(inc => {
            // Badges
            let gravBadge = '';
            if (inc.gravedad === 'CRITICA') gravBadge = `<span class="status-pill badge-critica"><i data-lucide="flame"></i> Crítica</span>`;
            else if (inc.gravedad === 'ALTA') gravBadge = `<span class="status-pill badge-alta"><i data-lucide="alert-triangle"></i> Alta</span>`;
            else if (inc.gravedad === 'MEDIA') gravBadge = `<span class="status-pill badge-media">Media</span>`;
            else gravBadge = `<span class="status-pill badge-baja">Baja</span>`;

            let estBadge = '';
            if (inc.estado === 'RESUELTA') estBadge = `<span class="status-pill badge-resuelta"><i data-lucide="check-circle-2"></i> Resuelta</span>`;
            else if (inc.estado === 'EN_PROCESO') estBadge = `<span class="status-pill badge-en-proceso"><i data-lucide="clock"></i> En Proceso</span>`;
            else estBadge = `<span class="status-pill badge-abierta"><i data-lucide="alert-octagon"></i> Abierta</span>`;

            const tipoBadge = `<span class="status-pill badge-tipo">${escapeHtml(inc.tipo_display || inc.tipo)}</span>`;

            const fechaObj = new Date(inc.fecha_reporte);
            const fechaStr = fechaObj.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) + ' ' + 
                           fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Decisión de Gerencia
            let decisionHtml = '';
            if (inc.resolucion_gerencia) {
                decisionHtml = `
                    <div class="decision-callout">
                        <strong>Instrucción Gerencial:</strong>
                        ${escapeHtml(inc.resolucion_gerencia)}
                    </div>
                `;
            } else {
                decisionHtml = `<span class="no-decision-text">⏳ Pendiente de resolución</span>`;
            }

            return `
                <tr>
                  <td><span class="text-muted" style="font-size: 0.8125rem;">${fechaStr}</span></td>
                  <td>${gravBadge}</td>
                  <td>
                    <strong>${escapeHtml(inc.titulo)}</strong>
                    <div style="margin-top: 0.25rem;">${tipoBadge}</div>
                  </td>
                  <td>
                    <strong>${escapeHtml(inc.sector_nombre || 'General')}</strong><br>
                    <small class="text-muted">${escapeHtml(inc.cultivo_nombre || 'Cultivo')}</small>
                  </td>
                  <td>
                    <strong>${escapeHtml(inc.reportado_por_nombre || 'Supervisor')}</strong><br>
                    <small class="text-muted">${escapeHtml(inc.cuadrilla_nombre || 'Sin Cuadrilla')}</small>
                  </td>
                  <td>
                    <div style="max-width: 260px; font-size: 0.8125rem; line-height: 1.4;">
                      ${escapeHtml(inc.descripcion)}
                      ${inc.accion_tomada ? `<br><small style="color: #60A5FA;"><strong>Medida:</strong> ${escapeHtml(inc.accion_tomada)}</small>` : ''}
                    </div>
                  </td>
                  <td>${estBadge}</td>
                  <td>${decisionHtml}</td>
                  <td>
                    <button class="btn btn--primary btn--sm btn-tomar-decision" data-id="${inc.id}" style="box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);">
                      <i data-lucide="gavel"></i> Decidir
                    </button>
                  </td>
                </tr>
            `;
        }).join('');

        lucide.createIcons();

        // Enlazar botones de Decidir
        document.querySelectorAll('.btn-tomar-decision').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                openDecisionModal(id);
            });
        });
    }

    /**
     * 2. REPORTE DE COSECHA (PRODUCCIÓN)
     */
    function renderCosechasReport() {
        tableCardTitle.textContent = 'Reporte de Producción y Cosecha';
        tableCardSubtitle.textContent = 'Histórico de recolección de flores exportadas y mercadería cosechada por sector';

        reportesThead.innerHTML = `
            <tr>
              <th>Fecha de Corte</th>
              <th>Sector Agrícola</th>
              <th>Cultivo / Variedad</th>
              <th>Volumen Cosechado</th>
              <th>Calidad de Flor</th>
            </tr>
        `;

        if (cosechas.length === 0) {
            reportesTbody.innerHTML = `
                <tr>
                  <td colspan="5" class="text-center py-4 text-muted">
                    No hay registros de cosecha almacenados en el periodo actual.
                  </td>
                </tr>
            `;
            recordsCountTag.textContent = '0 registros';
            lucide.createIcons();
            return;
        }

        recordsCountTag.textContent = `${cosechas.length} registros`;

        reportesTbody.innerHTML = cosechas.map(c => `
            <tr>
              <td><strong>${c.fecha}</strong></td>
              <td>${escapeHtml(c.sector_nombre || 'Sector')}</td>
              <td><span class="status-pill badge-tipo">${escapeHtml(c.cultivo || 'Flor')}</span></td>
              <td><strong>${c.volumen_cajas}</strong> cajas</td>
              <td><span class="status-pill badge-resuelta">${escapeHtml(c.calidad || 'Exportación')}</span></td>
            </tr>
        `).join('');

        lucide.createIcons();
    }

    /**
     * 3. REPORTE DE CUADRILLAS Y PERSONAL
     */
    function renderCuadrillasReport() {
        tableCardTitle.textContent = 'Trazabilidad de Cuadrillas y Despliegue de Personal';
        tableCardSubtitle.textContent = 'Distribución de cuadrillas en campo, tipo de labor asignada y supervisores encargados';

        reportesThead.innerHTML = `
            <tr>
              <th>Cuadrilla</th>
              <th>Tipo de Labor</th>
              <th>Sector Asignado</th>
              <th>Supervisor Encargado</th>
              <th>Estado Operativo</th>
            </tr>
        `;

        recordsCountTag.textContent = `${cuadrillas.length} cuadrillas`;

        reportesTbody.innerHTML = cuadrillas.map(c => `
            <tr>
              <td><strong>${escapeHtml(c.nombre)}</strong></td>
              <td><span class="status-pill badge-media">${escapeHtml(c.tipo || 'General')}</span></td>
              <td><strong>${escapeHtml(c.sector_nombre || 'Sin Sector')}</strong></td>
              <td><strong>${escapeHtml(c.encargado_nombre || 'Por Asignar')}</strong></td>
              <td><span class="status-pill badge-resuelta"><i data-lucide="check"></i> Operativa en Campo</span></td>
            </tr>
        `).join('');

        lucide.createIcons();
    }

    /**
     * Abrir Modal de Decisión Gerencial
     */
    function openDecisionModal(id) {
        activeIncidentForDecision = incidencias.find(i => String(i.id) === String(id));
        if (!activeIncidentForDecision) return;

        modalIncidenciaId.value = activeIncidentForDecision.id;
        modalIncidenciaTitulo.textContent = activeIncidentForDecision.titulo;
        modalIncidenciaSector.textContent = `${activeIncidentForDecision.sector_nombre || 'General'} (${activeIncidentForDecision.cultivo_nombre || 'Cultivo'})`;
        modalIncidenciaSupervisor.textContent = `${activeIncidentForDecision.reportado_por_nombre || 'Supervisor'} · ${activeIncidentForDecision.cuadrilla_nombre || 'Cuadrilla'}`;
        modalIncidenciaDesc.textContent = activeIncidentForDecision.descripcion;

        const fechaObj = new Date(activeIncidentForDecision.fecha_reporte);
        modalIncidenciaFecha.textContent = fechaObj.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) + ' ' + 
                                          fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Badges
        let gravBadge = '';
        if (activeIncidentForDecision.gravedad === 'CRITICA') gravBadge = `<span class="status-pill badge-critica">Crítica</span>`;
        else if (activeIncidentForDecision.gravedad === 'ALTA') gravBadge = `<span class="status-pill badge-alta">Alta</span>`;
        else gravBadge = `<span class="status-pill badge-media">${activeIncidentForDecision.gravedad}</span>`;

        modalIncidenciaBadges.innerHTML = `
            ${gravBadge}
            <span class="status-pill badge-tipo">${escapeHtml(activeIncidentForDecision.tipo_display || activeIncidentForDecision.tipo)}</span>
        `;

        // Medida preventiva previa
        if (activeIncidentForDecision.accion_tomada) {
            modalIncidenciaAccion.textContent = activeIncidentForDecision.accion_tomada;
            modalIncidenciaAccionContainer.style.display = 'block';
        } else {
            modalIncidenciaAccionContainer.style.display = 'none';
        }

        // Estado y Resolución
        selectNuevoEstado.value = activeIncidentForDecision.estado === 'ABIERTA' ? 'EN_PROCESO' : activeIncidentForDecision.estado;
        textareaResolucion.value = activeIncidentForDecision.resolucion_gerencia || '';

        // Reset aviso de IA
        if (aiSuggestionNotice) {
            aiSuggestionNotice.style.display = 'none';
        }

        modalDecision.classList.add('active');
        lucide.createIcons();
    }

    /**
     * Event Listeners
     */
    function setupEventListeners() {
        // Alternar vista del Mapa de Calor (Días vs Franjas Horarias)
        btnHeatmapDias?.addEventListener('click', () => {
            heatmapCurrentView = 'DIAS';
            btnHeatmapDias.classList.add('active');
            btnHeatmapHoras.classList.remove('active');
            renderHeatmap();
        });

        btnHeatmapHoras?.addEventListener('click', () => {
            heatmapCurrentView = 'HORAS';
            btnHeatmapHoras.classList.add('active');
            btnHeatmapDias.classList.remove('active');
            renderHeatmap();
        });

        // Cambio de tipo de reporte
        selectTipoReporte?.addEventListener('change', () => {
            updateFilterVisibility();
            renderStats();
            applyFiltersAndRender();
        });

        // Filtros individuales con actualización instantánea
        selectCuadrilla?.addEventListener('change', applyFiltersAndRender);
        selectLabor?.addEventListener('change', applyFiltersAndRender);
        selectSector?.addEventListener('change', applyFiltersAndRender);
        selectGravedad?.addEventListener('change', applyFiltersAndRender);
        selectEstado?.addEventListener('change', applyFiltersAndRender);

        // Botón Filtrar manual
        btnFiltrar?.addEventListener('click', applyFiltersAndRender);

        // Búsqueda en tiempo real
        searchInput?.addEventListener('input', applyFiltersAndRender);

        // Botón Refrescar
        btnRefreshReportes?.addEventListener('click', async () => {
            refreshIcon?.classList.add('spinning');
            await loadData();
            setTimeout(() => refreshIcon?.classList.remove('spinning'), 700);
        });

        // Cerrar modal de decisión
        const closeDecisionModal = () => {
            modalDecision.classList.remove('active');
            activeIncidentForDecision = null;
        };

        btnCerrarModalDecision?.addEventListener('click', closeDecisionModal);
        btnCancelarModalDecision?.addEventListener('click', closeDecisionModal);
        modalDecision?.addEventListener('click', (e) => {
            if (e.target === modalDecision) closeDecisionModal();
        });

        // Sugerir Resolución con IA Groq
        btnSugerirResolucionIA?.addEventListener('click', async () => {
            const incidenciaId = modalIncidenciaId.value;
            if (!incidenciaId) return;

            const origHtml = btnSugerirResolucionIA.innerHTML;
            btnSugerirResolucionIA.disabled = true;
            btnSugerirResolucionIA.innerHTML = `<i data-lucide="loader" class="spinning" style="width: 13px; height: 13px;"></i> Analizando...`;
            lucide.createIcons();

            try {
                const response = await fetch(`${apiBase}/ia/sugerir-resolucion/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ incidencia_id: incidenciaId })
                });

                const data = await response.json();
                if (data.resolucion_sugerida) {
                    textareaResolucion.value = data.resolucion_sugerida;
                    if (data.estado_recomendado) {
                        selectNuevoEstado.value = data.estado_recomendado;
                    }
                    if (aiSuggestionNotice) {
                        aiSuggestionNotice.style.display = 'block';
                        if (aiSuggestionNoticeText) {
                            aiSuggestionNoticeText.innerHTML = `<strong>Sugerencia de Agro-IA (Groq):</strong> Directiva agronómica lista para revisión y aplicación por Gerencia.`;
                        }
                    }
                } else {
                    alert('No se pudo generar la recomendación: ' + (data.error || 'Error desconocido'));
                }
            } catch (err) {
                console.error('Error al consultar IA:', err);
                alert('Error al conectar con el servicio de IA: ' + err.message);
            } finally {
                btnSugerirResolucionIA.disabled = false;
                btnSugerirResolucionIA.innerHTML = origHtml;
                lucide.createIcons();
            }
        });

        // Guardar Decisión de Gerencia
        formDecision?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const incidenciaId = modalIncidenciaId.value;
            const nuevoEstado = selectNuevoEstado.value;
            const resolucion = textareaResolucion.value.trim();

            if (!incidenciaId || !resolucion) {
                alert('Por favor redacta la directiva o resolución de Gerencia General.');
                return;
            }

            const payload = {
                estado: nuevoEstado,
                resolucion_gerencia: resolucion
            };

            const origContent = btnGuardarDecision.innerHTML;
            btnGuardarDecision.disabled = true;
            btnGuardarDecision.innerHTML = `<i data-lucide="loader" class="spinning"></i> Guardando...`;
            lucide.createIcons();

            try {
                const response = await fetch(`${apiBase}/incidencias/${incidenciaId}/`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error('Error al actualizar la decisión en el servidor');
                }

                closeDecisionModal();
                await loadData();

                alert('✅ Decisión gerencial registrada y sincronizada con el equipo de campo exitosamente.');
            } catch (err) {
                console.error('Error guardando decisión:', err);
                alert(`❌ Error al guardar resolución: ${err.message}`);
            } finally {
                btnGuardarDecision.disabled = false;
                btnGuardarDecision.innerHTML = origContent;
                lucide.createIcons();
            }
        });

        // Exportar a Excel (CSV real)
        btnExportExcel?.addEventListener('click', () => {
            if (selectTipoReporte.value === 'TAREAS') {
                exportTareasToCSV();
            } else {
                exportIncidenciasToCSV();
            }
        });

        // Imprimir / PDF
        btnExportPdf?.addEventListener('click', () => {
            window.print();
        });
    }

    /**
     * Generador de archivo CSV descargable para Tareas y Rendimiento
     */
    function exportTareasToCSV() {
        if (!tareas || tareas.length === 0) {
            alert('No hay tareas para exportar.');
            return;
        }

        const headers = ['ID', 'Fecha Programada', 'Cuadrilla', 'Supervisor', 'Tipo Labor', 'Título', 'Sector', 'Cultivo', 'Hora Inicio', 'Hora Fin', 'Duración Real', 'Minutos', 'Estado', 'Observaciones'];
        const rows = tareas.map(t => [
            t.id,
            `"${t.fecha_programada || ''}"`,
            `"${(t.cuadrilla_nombre || '').replace(/"/g, '""')}"`,
            `"${(t.supervisor_nombre || '').replace(/"/g, '""')}"`,
            `"${t.tipo_labor || ''}"`,
            `"${(t.titulo || '').replace(/"/g, '""')}"`,
            `"${(t.sector_nombre || '').replace(/"/g, '""')}"`,
            `"${(t.cultivo_nombre || '').replace(/"/g, '""')}"`,
            `"${formatTimeString(t.hora_inicio)}"`,
            `"${formatTimeString(t.hora_fin)}"`,
            `"${t.duracion_formateada || '-'}"`,
            t.duracion_minutos || 0,
            `"${t.estado || ''}"`,
            `"${(t.observaciones || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Tareas_Cuadrillas_AGROFLOW_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Generador de archivo CSV descargable
     */
    function exportIncidenciasToCSV() {
        if (!incidencias || incidencias.length === 0) {
            alert('No hay incidencias para exportar.');
            return;
        }

        const headers = ['ID', 'Fecha Reporte', 'Nivel Gravedad', 'Tipo', 'Título', 'Sector', 'Cultivo', 'Cuadrilla', 'Supervisor Reportante', 'Descripción', 'Acción Inmediata', 'Estado', 'Resolución Gerencia'];
        const rows = incidencias.map(i => [
            i.id,
            `"${i.fecha_reporte || ''}"`,
            `"${i.gravedad || ''}"`,
            `"${i.tipo || ''}"`,
            `"${(i.titulo || '').replace(/"/g, '""')}"`,
            `"${(i.sector_nombre || '').replace(/"/g, '""')}"`,
            `"${(i.cultivo_nombre || '').replace(/"/g, '""')}"`,
            `"${(i.cuadrilla_nombre || '').replace(/"/g, '""')}"`,
            `"${(i.reportado_por_nombre || '').replace(/"/g, '""')}"`,
            `"${(i.descripcion || '').replace(/"/g, '""')}"`,
            `"${(i.accion_tomada || '').replace(/"/g, '""')}"`,
            `"${i.estado || ''}"`,
            `"${(i.resolucion_gerencia || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Incidencias_AGROFLOW_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function formatTime12(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) {
            const parts = String(isoStr).split(':');
            if (parts.length >= 2) {
                let h = parseInt(parts[0], 10);
                const m = parts[1];
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return `${h}:${m} ${ampm}`;
            }
            return isoStr;
        }
        let h = d.getHours();
        const m = d.getMinutes().toString().padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    function getEstadoDetalle(t) {
        if (t.estado_detalle) return t.estado_detalle;
        if (t.estado === 'COMPLETADA') {
            const ini = formatTime12(t.hora_inicio);
            const fin = formatTime12(t.hora_fin);
            if (ini && fin) return `(Terminado) ${ini} - ${fin}`;
            if (fin) return `(Terminado) ${fin}`;
            return `(Terminado)`;
        } else if (t.estado === 'EN_PROCESO') {
            const ini = formatTime12(t.hora_inicio);
            return ini ? `(En proceso) ${ini}` : `(En proceso)`;
        }
        return `(Falta)`;
    }

    /**
     * Formateador de horas (HH:MM)
     */
    function formatTimeString(isoOrTimeStr) {
        if (!isoOrTimeStr) return '--:--';
        if (isoOrTimeStr.includes('T')) {
            const d = new Date(isoOrTimeStr);
            if (!isNaN(d.getTime())) {
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        }
        const parts = String(isoOrTimeStr).split(':');
        if (parts.length >= 2) {
            return `${parts[0]}:${parts[1]}`;
        }
        return isoOrTimeStr;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});

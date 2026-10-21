/* agroflow/views/dashboard/dashboard.js */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Control de Rol y Sesión
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

    // Inicializar iconos básicos
    lucide.createIcons();

    // Sidebar Mobile
    const sidebar = document.getElementById('sidebar');
    document.getElementById('openSidebar')?.addEventListener('click', () => sidebar.classList.add('active'));
    document.getElementById('closeSidebar')?.addEventListener('click', () => sidebar.classList.remove('active'));

    // Mostrar nombre del usuario logueado si existe
    const storedName = localStorage.getItem('agroflow_user_name');
    if (storedName) {
        const elUserName = document.querySelector('.user-name');
        if (elUserName) elUserName.textContent = storedName;
    }

    // Botón de Cerrar Sesión
    document.querySelector('.sidebar__footer a')?.addEventListener('click', () => {
        localStorage.removeItem('agroflow_user_role');
        localStorage.removeItem('agroflow_user_name');
        localStorage.removeItem('agroflow_user_id');
        localStorage.removeItem('agroflow_user_dni');
    });

    // Configuración Global de Chart.js para Dark Theme
    Chart.defaults.color = '#94a3b8'; // text-muted
    Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';

    // Referencias de gráficos para actualización dinámica
    let chartLabores = null;
    let chartSectores = null;

    // DOM Elements - KPIs
    const elKpiTotalPersonal = document.getElementById('kpiTotalPersonal');
    const elKpiPersonalDesglose = document.getElementById('kpiPersonalDesglose');
    const elKpiSupervisoresActivos = document.getElementById('kpiSupervisoresActivos');
    const elKpiSupervisoresDesglose = document.getElementById('kpiSupervisoresDesglose');
    const elKpiCuadrillasActivas = document.getElementById('kpiCuadrillasActivas');
    const elKpiCuadrillasDesglose = document.getElementById('kpiCuadrillasDesglose');
    const elKpiIncidenciasActivas = document.getElementById('kpiIncidenciasActivas');
    const elKpiIncidenciasDesglose = document.getElementById('kpiIncidenciasDesglose');

    // DOM Elements - Tags y Banners
    const elLiveSyncText = document.getElementById('liveSyncText');
    const elAiBannerTitle = document.getElementById('aiBannerTitle');
    const elAiBannerText = document.getElementById('aiBannerText');
    const elChartTotalTrabajadoresTag = document.getElementById('chartTotalTrabajadoresTag');
    const elChartTotalHectareasTag = document.getElementById('chartTotalHectareasTag');
    const elTotalIncidenciasCount = document.getElementById('totalIncidenciasCount');

    // DOM Elements - Tablas
    const elSupervisoresTableBody = document.getElementById('supervisoresTableBody');
    const elBitacoraTableBody = document.getElementById('bitacoraTableBody');

    // Botón Refresh
    const btnRefresh = document.getElementById('btnRefreshData');
    const refreshIcon = document.getElementById('refreshIcon');

    // Cargar datos
    loadDashboardData();

    // Polling cada 60 segundos para mantener el centro de control sincronizado en vivo
    const refreshInterval = setInterval(loadDashboardData, 60000);

    // Evento Click en botón manual de refresco
    btnRefresh?.addEventListener('click', async () => {
        refreshIcon?.classList.add('spinning');
        await loadDashboardData();
        setTimeout(() => refreshIcon?.classList.remove('spinning'), 700);
    });

    /**
     * Función principal que consulta en paralelo todos los endpoints del backend
     */
    async function loadDashboardData() {
        try {
            const apiBase = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
                ? CONFIG.API_BASE_URL 
                : 'http://localhost:8000/api';

            // Consultas paralelas a los endpoints operativos
            const [
                resTrabajadores,
                resCuadrillas,
                resSectores,
                resSupervisores,
                resTraslados,
                resInsumos,
                resIncidencias
            ] = await Promise.all([
                fetch(`${apiBase}/trabajadores/`).then(r => r.ok ? r.json() : []),
                fetch(`${apiBase}/cuadrillas/`).then(r => r.ok ? r.json() : []),
                fetch(`${apiBase}/sectores/`).then(r => r.ok ? r.json() : []),
                fetch(`${apiBase}/supervisores/ubicaciones/`).then(r => r.ok ? r.json() : []),
                fetch(`${apiBase}/traslados/`).then(r => r.ok ? r.json() : []),
                fetch(`${apiBase}/insumos/`).then(r => r.ok ? r.json() : []),
                fetch(`${apiBase}/incidencias/`).then(r => r.ok ? r.json() : [])
            ]);

            const trabajadores = resTrabajadores || [];
            const cuadrillas = resCuadrillas || [];
            const sectores = resSectores || [];
            const supervisores = resSupervisores || [];
            const traslados = resTraslados || [];
            const insumos = resInsumos || [];
            const incidencias = resIncidencias || [];

            // 1. Renderizar KPIs Operativos
            renderKPIs(trabajadores, cuadrillas, sectores, supervisores, traslados, insumos, incidencias);

            // 2. Renderizar Copilot de IA y Alertas
            renderAICopilot(trabajadores, cuadrillas, sectores, supervisores, traslados, insumos, incidencias);

            // 3. Renderizar Gráficos Chart.js
            renderCharts(trabajadores, cuadrillas, sectores);

            // 4. Renderizar Tabla de Monitoreo de Supervisores
            renderSupervisoresTable(supervisores);

            // 5. Renderizar Bitácora de Trazabilidad e Incidencias Recientes
            renderBitacoraTable(traslados, insumos, incidencias);

            // 6. Actualizar hora de sincronización
            const ahora = new Date();
            const horaFormateada = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            if (elLiveSyncText) {
                elLiveSyncText.textContent = `Conectado al Fundo · Sincronizado ${horaFormateada}`;
            }

            // Refrescar iconos Lucide inyectados
            lucide.createIcons();

        } catch (error) {
            console.error('Error al cargar datos del dashboard:', error);
            if (elLiveSyncText) {
                elLiveSyncText.textContent = 'Aviso: Intentando reconectar con el servidor...';
            }
        }
    }

    /**
     * Renderiza los 4 KPIs clave de trazabilidad
     */
    function renderKPIs(trabajadores, cuadrillas, sectores, supervisores, traslados, insumos, incidencias) {
        // KPI 1: Personal en Fundo
        const obreros = trabajadores.filter(t => !t.es_supervisor && !t.es_jefe_almacen);
        const asignados = obreros.filter(t => t.cuadrilla !== null).length;
        const sinCuadrilla = obreros.filter(t => t.cuadrilla === null).length;

        elKpiTotalPersonal.textContent = obreros.length;
        elKpiPersonalDesglose.textContent = `${asignados} asignados · ${sinCuadrilla} disponibles`;

        // KPI 2: Supervisores en Terreno
        const supActivos = supervisores.filter(s => s.esta_activo).length;
        const totalSup = supervisores.length;
        elKpiSupervisoresActivos.textContent = `${supActivos} / ${totalSup}`;
        elKpiSupervisoresDesglose.textContent = supActivos > 0 
            ? `${supActivos} con señal GPS activa en vivo` 
            : 'Esperando señal GPS en campo';

        // KPI 3: Cuadrillas Desplegadas
        const sectoresAsignadosIds = new Set(cuadrillas.map(c => c.sector_asignado).filter(Boolean));
        elKpiCuadrillasActivas.textContent = cuadrillas.length;
        elKpiCuadrillasDesglose.textContent = `Cubriendo ${sectoresAsignadosIds.size} de ${sectores.length} sectores`;

        // KPI 4: Incidencias y Alertas
        const sectoresAlerta = sectores.filter(s => s.estado === 'ALERTA' || s.estado === 'MANTENIMIENTO').length;
        const trasladosPendientes = traslados.filter(t => t.estado === 'PENDIENTE').length;
        const insumosUrgentes = insumos.filter(i => i.prioridad === 'URGENTE' && i.estado === 'PENDIENTE').length;
        const incidenciasAbiertas = (incidencias || []).filter(i => i.estado !== 'RESUELTA').length;
        const totalIncidencias = sectoresAlerta + trasladosPendientes + insumosUrgentes + incidenciasAbiertas;

        elKpiIncidenciasActivas.textContent = totalIncidencias;
        elKpiIncidenciasDesglose.textContent = totalIncidencias === 0 
            ? 'Operación en estado óptimo' 
            : `${incidenciasAbiertas} incidencias · ${sectoresAlerta} sectores · ${insumosUrgentes} insumos`;
    }

    /**
     * Genera diagnósticos inteligentes basados en el estado real de la operación
     * combinando heurísticas rápidas y el motor Groq LLM (/api/ia/diagnostico/)
     */
    async function renderAICopilot(trabajadores, cuadrillas, sectores, supervisores, traslados, insumos, incidencias) {
        const obrerosSinCuadrilla = trabajadores.filter(t => !t.es_supervisor && !t.es_jefe_almacen && t.cuadrilla === null).length;
        const incidenciaCritica = (incidencias || []).find(i => (i.gravedad === 'CRITICA' || i.gravedad === 'ALTA') && i.estado !== 'RESUELTA');
        const sectorEnAlerta = sectores.find(s => s.estado === 'ALERTA');
        const aiBtn = document.getElementById('aiActionBtn');

        // Diagnóstico preliminar inmediato mientras consulta la IA de Groq
        if (incidenciaCritica) {
            elAiBannerTitle.textContent = `Alerta de Incidencia [${incidenciaCritica.gravedad}] en Campo`;
            elAiBannerText.innerHTML = `<strong>${escapeHtml(incidenciaCritica.titulo)}:</strong> Reportada en ${escapeHtml(incidenciaCritica.sector_nombre || 'Sector')}. <span style="color:#C084FC; display:inline-flex; align-items:center; gap:4px; margin-left:6px;"><i data-lucide="loader" class="spinning" style="width:13px;height:13px;"></i> Analizando con Agro-IA...</span>`;
            if (aiBtn) {
                aiBtn.href = '../reportes/index.html';
                aiBtn.textContent = 'Evaluar Incidencias';
            }
        } else if (sectorEnAlerta) {
            elAiBannerTitle.textContent = 'Alerta Operativa · Fitosanidad en Sector';
            elAiBannerText.innerHTML = `El <strong>${escapeHtml(sectorEnAlerta.nombre)}</strong> se encuentra en estado <strong>ALERTA</strong>. <span style="color:#C084FC; display:inline-flex; align-items:center; gap:4px; margin-left:6px;"><i data-lucide="loader" class="spinning" style="width:13px;height:13px;"></i> Analizando con Agro-IA...</span>`;
            if (aiBtn) {
                aiBtn.href = '../mapa/index.html';
                aiBtn.textContent = 'Inspeccionar Sector';
            }
        } else {
            elAiBannerTitle.textContent = 'Agro-IA Copilot · Monitoreo Operativo';
            elAiBannerText.innerHTML = `Analizando trazabilidad de <strong>${cuadrillas.length} cuadrillas</strong> y <strong>${supervisores.length} supervisores</strong> con IA...`;
        }
        lucide.createIcons();

        // Consultar a Groq LLM para diagnóstico profundo en tiempo real
        try {
            const apiBase = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : 'http://localhost:8000/api';
            console.log('[Agro-IA] Solicitando diagnóstico a:', `${apiBase}/ia/diagnostico/`);
            const resIA = await fetch(`${apiBase}/ia/diagnostico/`);
            if (resIA.ok) {
                const dataIA = await resIA.json();
                console.log('[Agro-IA] Diagnóstico recibido exitosamente:', dataIA);
                if (dataIA && dataIA.titulo && dataIA.diagnostico) {
                    elAiBannerTitle.innerHTML = `<i data-lucide="sparkles" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> ${escapeHtml(dataIA.titulo)}`;
                    elAiBannerText.innerHTML = `<strong>Diagnóstico IA:</strong> ${escapeHtml(dataIA.diagnostico)} <br><span style="color:#C084FC;font-weight:600;">Sugerencia de Acción:</span> ${escapeHtml(dataIA.accion_sugerida)}`;
                    
                    if (aiBtn && dataIA.accion_label) {
                        aiBtn.textContent = dataIA.accion_label;
                        if (dataIA.accion_url) aiBtn.href = dataIA.accion_url;
                    }
                    lucide.createIcons();
                }
            } else {
                console.warn('[Agro-IA] Error en respuesta del endpoint de IA:', resIA.status);
            }
        } catch (e) {
            console.warn('[Agro-IA] Diagnóstico IA en segundo plano omitido (usando heurística local):', e);
        }
    }

    /**
     * Gráficos dinámicos con Chart.js
     */
    function renderCharts(trabajadores, cuadrillas, sectores) {
        // --- GRÁFICO 1: Despliegue de Personal por Tipo de Labor ---
        const laborCountMap = {
            'COSECHA': 0,
            'PODADO': 0,
            'RIEGO': 0,
            'MANTENIMIENTO': 0,
            'DISPONIBLE': 0
        };

        // Crear mapa de cuadrilla id -> tipo
        const cuadrillaTipoMap = {};
        cuadrillas.forEach(c => {
            cuadrillaTipoMap[c.id] = (c.tipo || 'COSECHA').toUpperCase();
        });

        const obreros = trabajadores.filter(t => !t.es_supervisor && !t.es_jefe_almacen);
        obreros.forEach(t => {
            if (t.cuadrilla && cuadrillaTipoMap[t.cuadrilla]) {
                const tipo = cuadrillaTipoMap[t.cuadrilla];
                if (laborCountMap[tipo] !== undefined) {
                    laborCountMap[tipo]++;
                } else {
                    laborCountMap['MANTENIMIENTO']++;
                }
            } else {
                laborCountMap['DISPONIBLE']++;
            }
        });

        if (elChartTotalTrabajadoresTag) {
            elChartTotalTrabajadoresTag.textContent = `${obreros.length} operarios`;
        }

        const ctxLabores = document.getElementById('laboresChart');
        if (ctxLabores) {
            const chartData = {
                labels: ['Cosecha', 'Podado', 'Riego', 'Mantenimiento', 'Disponibles'],
                datasets: [{
                    label: 'Operarios Desplegados',
                    data: [
                        laborCountMap['COSECHA'],
                        laborCountMap['PODADO'],
                        laborCountMap['RIEGO'],
                        laborCountMap['MANTENIMIENTO'],
                        laborCountMap['DISPONIBLE']
                    ],
                    backgroundColor: [
                        '#10B981', // Verde Cosecha
                        '#38BDF8', // Celeste Podado
                        '#6366F1', // Azul Riego
                        '#F59E0B', // Naranja Mantenimiento
                        '#64748B'  // Gris Disponibles
                    ],
                    borderRadius: 6,
                    borderSkipped: false
                }]
            };

            if (chartLabores) {
                chartLabores.data = chartData;
                chartLabores.update();
            } else {
                chartLabores = new Chart(ctxLabores, {
                    type: 'bar',
                    data: chartData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return ` ${context.parsed.y} operario(s)`;
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { stepSize: 1, precision: 0 },
                                grid: { color: 'rgba(51, 65, 85, 0.3)' },
                                border: { display: false }
                            },
                            x: {
                                grid: { display: false },
                                border: { display: false }
                            }
                        }
                    }
                });
            }
        }

        // --- GRÁFICO 2: Estado Operativo de Sectores (Doughnut) ---
        const estadoSectoresMap = {
            'ACTIVO': 0,
            'RIEGO': 0,
            'ALERTA': 0,
            'MANTENIMIENTO': 0
        };

        let totalHectareas = 0;
        sectores.forEach(s => {
            const est = (s.estado || 'ACTIVO').toUpperCase();
            if (estadoSectoresMap[est] !== undefined) {
                estadoSectoresMap[est]++;
            } else {
                estadoSectoresMap['ACTIVO']++;
            }
            totalHectareas += parseFloat(s.area_hectareas || 0);
        });

        if (elChartTotalHectareasTag) {
            elChartTotalHectareasTag.textContent = `${totalHectareas.toFixed(1)} ha totales`;
        }

        const ctxSectores = document.getElementById('sectoresChart');
        if (ctxSectores) {
            const doughnutData = {
                labels: ['Activo / Óptimo', 'En Riego', 'Alerta Fitosanitaria', 'Mantenimiento'],
                datasets: [{
                    data: [
                        estadoSectoresMap['ACTIVO'],
                        estadoSectoresMap['RIEGO'],
                        estadoSectoresMap['ALERTA'],
                        estadoSectoresMap['MANTENIMIENTO']
                    ],
                    backgroundColor: [
                        '#10B981', // Verde Activo
                        '#3B82F6', // Azul Riego
                        '#EF4444', // Rojo Alerta
                        '#F59E0B'  // Naranja Mantenimiento
                    ],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            };

            if (chartSectores) {
                chartSectores.data = doughnutData;
                chartSectores.update();
            } else {
                chartSectores = new Chart(ctxSectores, {
                    type: 'doughnut',
                    data: doughnutData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '72%',
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 14,
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                    color: '#94a3b8',
                                    font: { size: 12 }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const val = context.parsed;
                                        return ` ${label}: ${val} sector(es)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    }

    /**
     * Renderiza la tabla de monitoreo en tiempo real de supervisores
     */
    function renderSupervisoresTable(supervisores) {
        if (!elSupervisoresTableBody) return;

        if (!supervisores || supervisores.length === 0) {
            elSupervisoresTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        No hay supervisores registrados en el sistema.
                    </td>
                </tr>
            `;
            return;
        }

        elSupervisoresTableBody.innerHTML = supervisores.map(s => {
            const avatarUrl = s.foto_url 
                ? s.foto_url 
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(s.nombre_completo || 'Supervisor')}&background=10B981&color=fff`;

            // Estado de señal GPS
            let gpsPill = '';
            if (s.esta_activo) {
                gpsPill = `<span class="status-pill badge-live"><span class="pulse-dot"></span> Señal en Vivo</span>`;
            } else if (s.es_estimado) {
                gpsPill = `<span class="status-pill badge-estimated"><i data-lucide="map-pin"></i> Estimada</span>`;
            } else {
                gpsPill = `<span class="status-pill badge-offline"><i data-lucide="radio"></i> Inactivo</span>`;
            }

            // Tipo de labor de cuadrilla
            const tipoLabor = s.cuadrilla_tipo 
                ? `<span class="status-pill badge-priority-normal">${escapeHtml(s.cuadrilla_tipo)}</span>` 
                : '<span class="text-muted">-</span>';

            const sectorDisplay = s.sector_nombre && s.sector_nombre !== 'Sin Sector Asignado'
                ? `<strong>${escapeHtml(s.sector_nombre)}</strong><br><small class="text-muted">${escapeHtml(s.cultivo_nombre || 'Sin Cultivo')}</small>`
                : `<span class="text-muted">Sin sector asignado</span>`;

            return `
                <tr>
                    <td>
                        <div class="table-user">
                            <img src="${avatarUrl}" class="avatar-small" alt="${escapeHtml(s.nombre_completo)}">
                            <div class="table-user__info">
                                <span class="table-user__name">${escapeHtml(s.nombre_completo)}</span>
                                <span class="table-user__dni">DNI: ${escapeHtml(s.dni)}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <strong>${escapeHtml(s.cuadrilla_nombre || 'Sin Asignar')}</strong>
                        <div style="margin-top: 0.25rem;">${tipoLabor}</div>
                    </td>
                    <td>${sectorDisplay}</td>
                    <td>${gpsPill}</td>
                    <td><span class="text-muted" style="font-size: 0.8125rem;">${escapeHtml(s.tiempo_texto || 'Desconocido')}</span></td>
                    <td>
                        <a href="../mapa/index.html" class="btn btn--outline btn--sm" title="Ver en el mapa">
                            <i data-lucide="navigation"></i> Localizar
                        </a>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Renderiza la Bitácora combinada de Trazabilidad (Traslados, Insumos e Incidencias)
     */
    function renderBitacoraTable(traslados, insumos, incidencias) {
        if (!elBitacoraTableBody) return;

        // Combinar eventos y ordenar cronológicamente
        const eventos = [];

        // Incidencias de campo reportadas por supervisores
        (incidencias || []).forEach(inc => {
            eventos.push({
                tipo: 'INCIDENCIA',
                fecha: new Date(inc.fecha_reporte || Date.now()),
                titulo: inc.titulo,
                detalle: `${inc.gravedad_display || inc.gravedad} · ${inc.descripcion ? inc.descripcion.substring(0, 75) + '...' : ''}`,
                origenDestino: `${inc.sector_nombre || 'Sector'} (${inc.cuadrilla_nombre || 'Cuadrilla'})`,
                estado: inc.estado,
                gravedad: inc.gravedad,
                data: inc
            });
        });

        // Traslados de obreros (WebAuthn compliance)
        traslados.forEach(t => {
            eventos.push({
                tipo: 'TRASLADO',
                fecha: new Date(t.fecha_solicitud || Date.now()),
                titulo: `Reasignación de ${t.trabajador_nombre || 'Trabajador'}`,
                detalle: t.motivo || 'Reasignación de personal entre cuadrillas',
                origenDestino: t.cuadrilla_destino_nombre || 'Cuadrilla Asignada',
                estado: t.estado,
                data: t
            });
        });

        // Solicitudes de insumos a almacén
        insumos.forEach(i => {
            eventos.push({
                tipo: 'INSUMO',
                fecha: new Date(i.fecha_solicitud || Date.now()),
                titulo: `Solicitud de ${i.insumo_nombre}`,
                detalle: `${parseFloat(i.cantidad || 1)} ${i.unidad_medida || 'unid.'} · Por ${i.solicitado_por_nombre || 'Supervisor'}`,
                origenDestino: i.cuadrilla_nombre || 'Cuadrilla',
                estado: i.estado,
                prioridad: i.prioridad,
                data: i
            });
        });

        // Ordenar del más reciente al más antiguo
        eventos.sort((a, b) => b.fecha - a.fecha);

        if (elTotalIncidenciasCount) {
            elTotalIncidenciasCount.textContent = `${eventos.length} registros`;
        }

        if (eventos.length === 0) {
            elBitacoraTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">
                        No hay registros de trazabilidad recientes en la bitácora.
                    </td>
                </tr>
            `;
            return;
        }

        // Mostrar los 8 registros más recientes
        elBitacoraTableBody.innerHTML = eventos.slice(0, 8).map(ev => {
            let tipoHtml = '';
            let estadoPill = '';

            if (ev.tipo === 'INCIDENCIA') {
                tipoHtml = `
                    <div class="event-tag text-orange">
                        <i data-lucide="alert-triangle"></i>
                        <span>Incidencia de Campo</span>
                    </div>
                `;

                if (ev.estado === 'RESUELTA') {
                    estadoPill = `<span class="status-pill badge-webauthn-ok"><i data-lucide="check-circle-2"></i> Resuelta</span>`;
                } else if (ev.estado === 'EN_PROCESO') {
                    estadoPill = `<span class="status-pill badge-priority-normal"><i data-lucide="clock"></i> En Proceso</span>`;
                } else {
                    const esCrit = ev.gravedad === 'CRITICA' || ev.gravedad === 'ALTA';
                    estadoPill = esCrit
                        ? `<span class="status-pill badge-priority-urgent"><i data-lucide="flame"></i> Abierta (${ev.gravedad})</span>`
                        : `<span class="status-pill badge-webauthn-pending"><i data-lucide="alert-circle"></i> Abierta</span>`;
                }
            } else if (ev.tipo === 'TRASLADO') {
                tipoHtml = `
                    <div class="event-tag text-purple">
                        <i data-lucide="user-check"></i>
                        <span>Traslado de Obrero</span>
                    </div>
                `;

                if (ev.estado === 'ACEPTADO') {
                    estadoPill = `<span class="status-pill badge-webauthn-ok"><i data-lucide="fingerprint"></i> Biometría Verificada</span>`;
                } else if (ev.estado === 'RECHAZADO') {
                    estadoPill = `<span class="status-pill badge-webauthn-rejected"><i data-lucide="x-circle"></i> Rechazado</span>`;
                } else {
                    estadoPill = `<span class="status-pill badge-webauthn-pending"><i data-lucide="clock"></i> Firma WebAuthn Pendiente</span>`;
                }
            } else {
                tipoHtml = `
                    <div class="event-tag text-blue">
                        <i data-lucide="package"></i>
                        <span>Pedido de Insumo</span>
                    </div>
                `;

                if (ev.estado === 'APROBADO') {
                    estadoPill = `<span class="status-pill badge-live"><i data-lucide="check-circle-2"></i> Aprobado por Almacén</span>`;
                } else if (ev.estado === 'RECHAZADO') {
                    estadoPill = `<span class="status-pill badge-webauthn-rejected"><i data-lucide="x-circle"></i> No Autorizado</span>`;
                } else {
                    const esUrgente = ev.prioridad === 'URGENTE';
                    estadoPill = esUrgente
                        ? `<span class="status-pill badge-priority-urgent"><i data-lucide="alert-triangle"></i> Urgente / En Espera</span>`
                        : `<span class="status-pill badge-priority-normal"><i data-lucide="clock"></i> Pendiente Almacén</span>`;
                }
            }

            // Formatear fecha
            const fechaStr = formatRelativeDate(ev.fecha);

            return `
                <tr>
                    <td>${tipoHtml}</td>
                    <td>
                        <strong>${escapeHtml(ev.titulo)}</strong>
                        <div class="text-muted" style="font-size: 0.8125rem; margin-top: 0.2rem;">
                            ${escapeHtml(ev.detalle)}
                        </div>
                    </td>
                    <td>
                        <span class="status-pill badge-priority-normal">
                            <i data-lucide="users"></i> ${escapeHtml(ev.origenDestino)}
                        </span>
                    </td>
                    <td>${estadoPill}</td>
                    <td><span class="text-muted" style="font-size: 0.8125rem;">${fechaStr}</span></td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Auxiliar para formatear fechas de manera amigable
     */
    function formatRelativeDate(date) {
        if (!date || isNaN(date.getTime())) return '-';
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHours = Math.floor(diffMin / 60);

        if (diffSec < 60) return 'Hace unos segundos';
        if (diffMin < 60) return `Hace ${diffMin} min`;
        if (diffHours < 24) {
            return `Hoy, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) + ' ' + 
               date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Sanitizador XSS
     */
    // --- MÓDULO CHAT AGRO-IA COPILOT ---
    const modalChatIA = document.getElementById('modalChatIA');
    const btnAbrirChatIA = document.getElementById('btnAbrirChatIA');
    const btnCerrarChatIA = document.getElementById('btnCerrarChatIA');
    const chatInputForm = document.getElementById('chatInputForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessagesContainer = document.getElementById('chatMessagesContainer');

    btnAbrirChatIA?.addEventListener('click', () => {
        modalChatIA?.classList.add('active');
        chatInput?.focus();
    });

    const closeChatIA = () => {
        modalChatIA?.classList.remove('active');
    };

    btnCerrarChatIA?.addEventListener('click', closeChatIA);
    modalChatIA?.addEventListener('click', (e) => {
        if (e.target === modalChatIA) closeChatIA();
    });

    // Quick prompts
    document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.dataset.prompt;
            if (chatInput && prompt) {
                chatInput.value = prompt;
                chatInputForm?.dispatchEvent(new Event('submit'));
            }
        });
    });

    // Enviar pregunta a la IA
    chatInputForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pregunta = chatInput.value.trim();
        if (!pregunta) return;

        // Renderizar mensaje del usuario
        appendChatMessage('user', escapeHtml(pregunta));
        chatInput.value = '';

        // Renderizar mensaje temporal de carga
        const loadingId = 'loading-' + Date.now();
        appendChatMessage('ia', '<em>Analizando datos en tiempo real de Roots SAC con Groq...</em>', loadingId);

        try {
            const apiBase = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : 'http://localhost:8000/api';
            const response = await fetch(`${apiBase}/ia/chat/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pregunta })
            });

            const data = await response.json();
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) {
                loadingEl.innerHTML = data.respuesta 
                    ? data.respuesta.replace(/\n/g, '<br>') 
                    : 'No se pudo generar respuesta.';
            }
        } catch (err) {
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) {
                loadingEl.innerHTML = '<span style="color:#EF4444;">Error al conectar con Agro-IA. Intenta nuevamente.</span>';
            }
        }
    });

    function appendChatMessage(sender, htmlContent, elementId = null) {
        if (!chatMessagesContainer) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg chat-msg--${sender}`;
        const bubble = document.createElement('div');
        bubble.className = 'chat-msg__bubble';
        if (elementId) bubble.id = elementId;
        bubble.innerHTML = htmlContent;
        msgDiv.appendChild(bubble);
        chatMessagesContainer.appendChild(msgDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});


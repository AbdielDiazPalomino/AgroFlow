/* agroflow/views/supervisor/tareas/tareas.js */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar iconos
    lucide.createIcons();

    // 2. Control de Rol y Sesión
    const currentRole = localStorage.getItem('agroflow_user_role');
    let currentUserId = localStorage.getItem('agroflow_trabajador_id') || localStorage.getItem('agroflow_user_id');
    const storedName = localStorage.getItem('agroflow_nombre') || localStorage.getItem('agroflow_user_name');
    const storedUsername = localStorage.getItem('agroflow_username') || localStorage.getItem('agroflow_user_dni');

    if (currentRole !== 'SUPERVISOR' && currentRole !== 'GERENTE') {
        if (currentRole === 'JEFE_ALMACEN') {
            window.location.href = '../../jefealmacen/index.html';
        } else {
            window.location.href = '../../obrero/index.html';
        }
        return;
    }

    // Mostrar nombre en Topbar
    if (storedName && document.getElementById('topNombre')) {
        document.getElementById('topNombre').textContent = storedName;
    }

    // Sidebar Mobile
    const sidebar = document.getElementById('sidebar');
    document.getElementById('openSidebar')?.addEventListener('click', () => sidebar.classList.add('active'));
    document.getElementById('closeSidebar')?.addEventListener('click', () => sidebar.classList.remove('active'));

    // Botón Cerrar Sesión
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
    let currentSupervisor = null;
    let currentCuadrilla = null;
    let allCuadrillas = [];
    let tareas = [];
    let sectores = [];
    let activeFilterStatus = 'TODAS';
    let activeFilterLabor = 'TODOS';
    let tareaToFinish = null;

    // Elementos DOM
    const crewName = document.getElementById('crewName');
    const crewSector = document.getElementById('crewSector');
    const todayDateText = document.getElementById('todayDateText');
    const taskProgressPercent = document.getElementById('taskProgressPercent');
    const taskProgressBarFill = document.getElementById('taskProgressBarFill');
    const taskProgressSub = document.getElementById('taskProgressSub');

    const kpiTotalTareas = document.getElementById('kpiTotalTareas');
    const kpiEnProceso = document.getElementById('kpiEnProceso');
    const kpiCompletadas = document.getElementById('kpiCompletadas');
    const kpiHorasTrabajadas = document.getElementById('kpiHorasTrabajadas');

    const taskStatusFilters = document.getElementById('taskStatusFilters');
    const filterTipoLabor = document.getElementById('filterTipoLabor');
    const taskCountTag = document.getElementById('taskCountTag');
    const tasksGrid = document.getElementById('tasksGrid');

    // Modales
    const btnNuevaTarea = document.getElementById('btnNuevaTarea');
    const modalNuevaTarea = document.getElementById('modalNuevaTarea');
    const btnCerrarModalTarea = document.getElementById('btnCerrarModalTarea');
    const btnCancelarTarea = document.getElementById('btnCancelarTarea');
    const formNuevaTarea = document.getElementById('formNuevaTarea');

    const modalFinalizarTarea = document.getElementById('modalFinalizarTarea');
    const btnCerrarModalFin = document.getElementById('btnCerrarModalFin');
    const btnCancelarFin = document.getElementById('btnCancelarFin');
    const formFinalizarTarea = document.getElementById('formFinalizarTarea');
    const finTareaId = document.getElementById('finTareaId');
    const finTaskTitle = document.getElementById('finTaskTitle');
    const finTaskTimes = document.getElementById('finTaskTimes');
    const finObservaciones = document.getElementById('finObservaciones');

    // Fecha actual formateada
    const now = new Date();
    const hoyISO = now.toISOString().split('T')[0];
    const optionsDate = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    todayDateText.innerHTML = `<i data-lucide="calendar"></i> ${now.toLocaleDateString('es-ES', optionsDate)}`;
    document.getElementById('taskFecha').value = hoyISO;

    // Inicializar
    initTareas();

    async function initTareas() {
        try {
            await Promise.all([
                loadSupervisorProfile(),
                loadSectores()
            ]);
            await loadTareas();
            setupEventListeners();
        } catch (err) {
            console.error('Error al inicializar tareas:', err);
        }
    }

    /**
     * Carga el perfil del supervisor y su cuadrilla
     */
    async function loadSupervisorProfile() {
        try {
            const [resUbic, resCua] = await Promise.all([
                fetch(`${apiBase}/supervisores/ubicaciones/`).then(r => r.ok ? r.json() : []),
                fetch(`${apiBase}/cuadrillas/`).then(r => r.ok ? r.json() : [])
            ]);

            const supervisores = resUbic || [];
            allCuadrillas = resCua || [];

            // 1. Intentar encontrar por ID de trabajador
            if (currentUserId) {
                currentSupervisor = supervisores.find(s => String(s.id) === String(currentUserId));
            }

            // 2. Intentar por DNI o username
            if (!currentSupervisor && storedUsername) {
                currentSupervisor = supervisores.find(s => String(s.dni) === String(storedUsername));
            }

            // 3. Intentar por coincidencia de nombre
            if (!currentSupervisor && storedName) {
                currentSupervisor = supervisores.find(s => 
                    s.nombre_completo && s.nombre_completo.toLowerCase().includes(storedName.toLowerCase())
                );
            }

            // 4. Si es admin o supervisor de prueba sin match exacto, usar el primer supervisor
            if (!currentSupervisor && supervisores.length > 0) {
                currentSupervisor = supervisores[0];
            }

            // Identificar la cuadrilla asignada
            if (currentSupervisor && currentSupervisor.cuadrilla_id) {
                const foundC = allCuadrillas.find(c => c.id === currentSupervisor.cuadrilla_id);
                currentCuadrilla = foundC || {
                    id: currentSupervisor.cuadrilla_id,
                    nombre: currentSupervisor.cuadrilla_nombre,
                    sector_asignado: currentSupervisor.sector_id,
                    sector_nombre: currentSupervisor.sector_nombre
                };
            } else if (currentSupervisor) {
                const miC = allCuadrillas.find(c => String(c.encargado) === String(currentSupervisor.id));
                if (miC) currentCuadrilla = miC;
            }

            // Fallback: Si todavía no hay cuadrilla, tomar la primera de la base de datos
            if (!currentCuadrilla && allCuadrillas.length > 0) {
                currentCuadrilla = allCuadrillas[0];
            }

            // Sincronizar ID de supervisor
            if (currentSupervisor && !currentUserId) {
                currentUserId = currentSupervisor.id;
            }

            // Actualizar interfaz del Banner
            if (currentCuadrilla) {
                crewName.textContent = currentCuadrilla.nombre;
                const secNom = currentCuadrilla.sector_nombre || (currentSupervisor ? currentSupervisor.sector_nombre : 'General');
                const cultNom = (currentSupervisor && currentSupervisor.cultivo_nombre) ? ` (${currentSupervisor.cultivo_nombre})` : '';
                crewSector.innerHTML = `<i data-lucide="map-pin"></i> Sector: ${escapeHtml(secNom)}${escapeHtml(cultNom)}`;
            } else {
                crewName.textContent = 'Sin Cuadrilla Asignada';
                crewSector.innerHTML = `<i data-lucide="map-pin"></i> Sector: General`;
            }

            // Popular el select de Cuadrilla del modal
            populateModalCuadrillas();

            // Topbar
            const displayNombre = (currentSupervisor ? currentSupervisor.nombre_completo : null) || storedName || 'Supervisor de Campo';
            const topNombreEl = document.getElementById('topNombre');
            if (topNombreEl) topNombreEl.textContent = displayNombre;

            lucide.createIcons();
        } catch (e) {
            console.error('Error cargando perfil de supervisor:', e);
            crewName.textContent = 'Cuadrilla de Campo';
            crewSector.innerHTML = `<i data-lucide="map-pin"></i> Sector: General`;
        }
    }

    /**
     * Llena el selector de cuadrilla dentro del modal de nueva tarea
     */
    function populateModalCuadrillas() {
        const selectC = document.getElementById('taskCuadrilla');
        if (!selectC) return;

        if (allCuadrillas.length === 0) {
            selectC.innerHTML = '<option value="">Sin cuadrillas disponibles</option>';
            return;
        }

        selectC.innerHTML = allCuadrillas.map(c => {
            const isSelected = (currentCuadrilla && currentCuadrilla.id === c.id) ? 'selected' : '';
            return `<option value="${c.id}" ${isSelected}>${escapeHtml(c.nombre)} (${escapeHtml(c.sector_nombre || 'General')})</option>`;
        }).join('');

        // Al cambiar de cuadrilla en el modal, auto-seleccionar su sector si está configurado
        selectC.addEventListener('change', () => {
            const selectedCId = parseInt(selectC.value);
            const selectedC = allCuadrillas.find(c => c.id === selectedCId);
            if (selectedC && selectedC.sector_asignado) {
                const sectorSelect = document.getElementById('taskSector');
                if (sectorSelect) sectorSelect.value = selectedC.sector_asignado;
            }
        });
    }

    /**
     * Cargar sectores para el selector del modal
     */
    async function loadSectores() {
        try {
            const res = await fetch(`${apiBase}/sectores/`);
            if (res.ok) {
                sectores = await res.json();
                const taskSectorSelect = document.getElementById('taskSector');
                taskSectorSelect.innerHTML = '<option value="">-- Seleccionar Sector --</option>' +
                    sectores.map(s => {
                        const cult = s.cultivo_nombre ? `(${s.cultivo_nombre})` : '';
                        const isSel = (currentCuadrilla && currentCuadrilla.sector_asignado === s.id) || 
                                      (currentSupervisor && currentSupervisor.sector_id === s.id);
                        return `<option value="${s.id}" ${isSel ? 'selected' : ''}>${s.nombre} ${cult}</option>`;
                    }).join('');
            }
        } catch (e) {
            console.error('Error cargando sectores:', e);
        }
    }

    /**
     * Cargar tareas de la cuadrilla / supervisor
     */
    async function loadTareas() {
        try {
            let url = `${apiBase}/tareas/`;
            if (currentCuadrilla && currentCuadrilla.id) {
                url += `?cuadrilla=${currentCuadrilla.id}`;
            }

            const res = await fetch(url);
            if (res.ok) {
                tareas = await res.json();
                renderKPIsAndProgress();
                renderTasks();
            } else {
                tasksGrid.innerHTML = `
                    <div class="tasks-empty">
                        <i data-lucide="alert-circle" style="width: 40px; height: 40px; color: #EF4444; margin: 0 auto 0.75rem auto;"></i>
                        <h4 style="color: var(--color-text-title); margin-bottom: 0.25rem;">No se pudieron cargar las tareas</h4>
                        <p style="color: var(--color-text-muted); font-size: 0.875rem;">Intenta recargar la página o contacta con soporte.</p>
                    </div>
                `;
                lucide.createIcons();
            }
        } catch (e) {
            console.error('Error al cargar tareas:', e);
        }
    }

    /**
     * Actualiza los KPIs y la barra de progreso del día
     */
    function renderKPIsAndProgress() {
        const tareasHoy = tareas.filter(t => t.fecha_programada === hoyISO);
        const hoyCompletadas = tareasHoy.filter(t => t.estado === 'COMPLETADA').length;
        const hoyTotal = tareasHoy.length;

        // Horas totales hoy
        const horasHoy = tareasHoy
            .filter(t => t.estado === 'COMPLETADA')
            .reduce((acc, t) => acc + (t.duracion_minutos || 0) / 60.0, 0);

        // Actualizar KPIs
        kpiTotalTareas.textContent = tareas.length;
        kpiEnProceso.textContent = tareas.filter(t => t.estado === 'EN_PROCESO').length;
        kpiCompletadas.textContent = tareas.filter(t => t.estado === 'COMPLETADA').length;
        kpiHorasTrabajadas.textContent = `${horasHoy.toFixed(1)}h`;

        // Barra de Progreso Diario
        const percent = hoyTotal > 0 ? Math.round((hoyCompletadas / hoyTotal) * 100) : 0;
        taskProgressPercent.textContent = `${percent}%`;
        taskProgressBarFill.style.width = `${percent}%`;
        taskProgressSub.textContent = `${hoyCompletadas} de ${hoyTotal} tareas completadas hoy (${horasHoy.toFixed(1)} hrs efectivas)`;
    }

    /**
     * Renderiza las tarjetas de tareas con filtros aplicados
     */
    function renderTasks() {
        let list = [...tareas];

        // Filtro por Estado / Fecha
        if (activeFilterStatus === 'HOY') {
            list = list.filter(t => t.fecha_programada === hoyISO);
        } else if (activeFilterStatus !== 'TODAS') {
            list = list.filter(t => t.estado === activeFilterStatus);
        }

        // Filtro por Tipo de Labor
        if (activeFilterLabor !== 'TODOS') {
            list = list.filter(t => t.tipo_labor === activeFilterLabor);
        }

        taskCountTag.textContent = `${list.length} tarea(s) filtrada(s)`;

        if (list.length === 0) {
            tasksGrid.innerHTML = `
                <div class="tasks-empty">
                    <i data-lucide="calendar-check" style="width: 44px; height: 44px; color: var(--color-primary); margin: 0 auto 0.75rem auto;"></i>
                    <h4 style="color: var(--color-text-title); font-size: 1.125rem; font-weight: 600; margin-bottom: 0.25rem;">Sin labores en esta categoría</h4>
                    <p style="color: var(--color-text-muted); font-size: 0.875rem;">No hay tareas que coincidan con los filtros aplicados. Puedes programar una nueva labor arriba.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        tasksGrid.innerHTML = list.map(t => {
            // Estilos según estado
            let stateClass = 'task-card--pending';
            let tagClass = 'tag--falta';
            let statusIcon = '⏳';
            if (t.estado === 'EN_PROCESO') {
                stateClass = 'task-card--process';
                tagClass = 'tag--proceso';
                statusIcon = '▶️';
            }
            if (t.estado === 'COMPLETADA') {
                stateClass = 'task-card--done';
                tagClass = 'tag--terminado';
                statusIcon = '✅';
            }

            const estadoTexto = getEstadoDetalle(t);

            // Badge de Labor
            const laborClass = `badge-labor--${(t.tipo_labor || 'mantenimiento').toLowerCase()}`;
            const laborLabel = t.tipo_labor_display || t.tipo_labor;

            // Badge de Prioridad
            let prioBadge = `<span class="badge-prio-media">Media</span>`;
            if (t.prioridad === 'ALTA') prioBadge = `<span class="badge-prio-alta">Alta Prioridad</span>`;
            if (t.prioridad === 'URGENTE') prioBadge = `<span class="badge-prio-urgente">🚨 Urgente</span>`;
            if (t.prioridad === 'BAJA') prioBadge = `<span class="badge-prio-baja">Baja</span>`;

            // Botones de acción directos
            let actionBtnHtml = '';
            if (t.estado === 'PENDIENTE') {
                actionBtnHtml = `
                    <button class="btn-task-action btn-start btn-iniciar-tarea" data-id="${t.id}">
                        <i data-lucide="play"></i> Iniciar Labor (Registrar Hora)
                    </button>
                `;
            } else if (t.estado === 'EN_PROCESO') {
                actionBtnHtml = `
                    <button class="btn-task-action btn-finish btn-finalizar-tarea" data-id="${t.id}">
                        <i data-lucide="check-circle-2"></i> Finalizar y Registrar Horas
                    </button>
                `;
            } else if (t.estado === 'COMPLETADA') {
                const durStr = t.duracion_formateada && t.duracion_formateada !== '-' ? ` (${t.duracion_formateada})` : '';
                actionBtnHtml = `
                    <div class="btn-task-action btn-completed">
                        <i data-lucide="badge-check"></i> Labor Finalizada${durStr}
                    </div>
                `;
            }

            // Observaciones de cierre
            let obsHtml = '';
            if (t.observaciones) {
                obsHtml = `
                    <div class="task-obs-box">
                        <strong>Comentario de Cierre:</strong>
                        ${escapeHtml(t.observaciones)}
                    </div>
                `;
            }

            return `
                <div class="task-card ${stateClass}">
                    <div>
                        <div class="task-card__top">
                            <div class="task-card__badges">
                                <span class="badge-labor ${laborClass}">${escapeHtml(laborLabel)}</span>
                                ${prioBadge}
                            </div>
                            <span class="task-status-tag ${tagClass}">
                                ${statusIcon} ${escapeHtml(estadoTexto)}
                            </span>
                        </div>

                        <h3 class="task-card__title">${escapeHtml(t.titulo)}</h3>

                        <div class="task-card__location">
                            <i data-lucide="map-pin"></i>
                            <span>${escapeHtml(t.sector_nombre || 'General')} (${escapeHtml(t.cultivo_nombre || 'Fundo')})</span>
                        </div>

                        ${t.descripcion ? `<div class="task-card__desc">${escapeHtml(t.descripcion)}</div>` : ''}

                        ${obsHtml}
                    </div>

                    <div class="task-card__actions">
                        ${actionBtnHtml}
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();

        // Enlazar botones de Iniciar Tarea
        document.querySelectorAll('.btn-iniciar-tarea').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                iniciarTarea(id, btn);
            });
        });

        // Enlazar botones de Finalizar Tarea
        document.querySelectorAll('.btn-finalizar-tarea').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                abrirModalFinalizar(id);
            });
        });
    }

    /**
     * Iniciar Tarea (pasa a EN_PROCESO)
     */
    async function iniciarTarea(id, btn) {
        if (!confirm('¿Deseas iniciar esta labor en campo ahora mismo? Se estampará la hora de inicio oficial.')) return;

        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="spinning"></i> Iniciando...`;
        lucide.createIcons();

        try {
            const res = await fetch(`${apiBase}/tareas/${id}/iniciar/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) throw new Error('Error al iniciar labor');

            await loadTareas();
            showToast('✅ Labor iniciada. Cronómetro en marcha para la cuadrilla.');
        } catch (e) {
            console.error(e);
            alert('Error al iniciar tarea: ' + e.message);
            btn.disabled = false;
            btn.innerHTML = origHtml;
            lucide.createIcons();
        }
    }

    /**
     * Abrir modal para finalizar tarea
     */
    function abrirModalFinalizar(id) {
        tareaToFinish = tareas.find(t => String(t.id) === String(id));
        if (!tareaToFinish) return;

        finTareaId.value = tareaToFinish.id;
        finTaskTitle.textContent = tareaToFinish.titulo;
        finTaskTimes.textContent = `Iniciada a las: ${formatTimeString(tareaToFinish.hora_inicio)} • Sector: ${tareaToFinish.sector_nombre || 'General'}`;
        finObservaciones.value = '';

        modalFinalizarTarea.classList.add('active');
        lucide.createIcons();
    }

    /**
     * Listeners de Eventos
     */
    function setupEventListeners() {
        // Filtros de estado (Pills)
        taskStatusFilters.querySelectorAll('.filter-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                taskStatusFilters.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                activeFilterStatus = pill.dataset.filter;
                renderTasks();
            });
        });

        // Filtro por tipo de labor (Select)
        filterTipoLabor.addEventListener('change', () => {
            activeFilterLabor = filterTipoLabor.value;
            renderTasks();
        });

        // Abrir modal nueva tarea
        btnNuevaTarea.addEventListener('click', () => {
            formNuevaTarea.reset();
            document.getElementById('taskFecha').value = hoyISO;
            const selectC = document.getElementById('taskCuadrilla');
            if (selectC && currentCuadrilla) {
                selectC.value = currentCuadrilla.id;
            }
            if (currentCuadrilla && currentCuadrilla.sector_asignado) {
                const selectS = document.getElementById('taskSector');
                if (selectS) selectS.value = currentCuadrilla.sector_asignado;
            }
            modalNuevaTarea.classList.add('active');
            lucide.createIcons();
        });

        // Cerrar modal nueva tarea
        const cerrarNuevaTarea = () => modalNuevaTarea.classList.remove('active');
        btnCerrarModalTarea.addEventListener('click', cerrarNuevaTarea);
        btnCancelarTarea.addEventListener('click', cerrarNuevaTarea);
        modalNuevaTarea.addEventListener('click', (e) => {
            if (e.target === modalNuevaTarea) cerrarNuevaTarea();
        });

        // Submit nueva tarea
        formNuevaTarea.addEventListener('submit', async (e) => {
            e.preventDefault();

            const selectC = document.getElementById('taskCuadrilla');
            const cuadrillaId = (selectC && selectC.value) ? parseInt(selectC.value) : (currentCuadrilla ? currentCuadrilla.id : null);

            if (!cuadrillaId) {
                alert('Debes seleccionar una cuadrilla para programar la labor.');
                return;
            }

            const payload = {
                titulo: document.getElementById('taskTitulo').value.trim(),
                tipo_labor: document.getElementById('taskTipoLabor').value,
                sector: document.getElementById('taskSector').value,
                prioridad: document.getElementById('taskPrioridad').value,
                fecha_programada: document.getElementById('taskFecha').value,
                descripcion: document.getElementById('taskDescripcion').value.trim(),
                cuadrilla: cuadrillaId,
                supervisor: currentUserId || (currentCuadrilla ? currentCuadrilla.encargado : null) || (currentSupervisor ? currentSupervisor.id : null)
            };

            const btnSubmit = document.getElementById('btnGuardarTarea');
            const origHtml = btnSubmit.innerHTML;
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i data-lucide="loader" class="spinning"></i> Guardando...`;
            lucide.createIcons();

            try {
                const res = await fetch(`${apiBase}/tareas/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) throw new Error('Error al registrar la tarea en el servidor');

                cerrarNuevaTarea();
                await loadTareas();
                showToast('✅ Tarea programada exitosamente en el plan de la cuadrilla.');
            } catch (err) {
                console.error(err);
                alert('Error al programar labor: ' + err.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = origHtml;
                lucide.createIcons();
            }
        });

        // Cerrar modal finalizar tarea
        const cerrarFinModal = () => {
            modalFinalizarTarea.classList.remove('active');
            tareaToFinish = null;
        };
        btnCerrarModalFin.addEventListener('click', cerrarFinModal);
        btnCancelarFin.addEventListener('click', cerrarFinModal);
        modalFinalizarTarea.addEventListener('click', (e) => {
            if (e.target === modalFinalizarTarea) cerrarFinModal();
        });

        // Submit finalizar tarea
        formFinalizarTarea.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = finTareaId.value;
            const observaciones = finObservaciones.value.trim();

            const btnConfirm = document.getElementById('btnConfirmarFin');
            const origHtml = btnConfirm.innerHTML;
            btnConfirm.disabled = true;
            btnConfirm.innerHTML = `<i data-lucide="loader" class="spinning"></i> Finalizando...`;
            lucide.createIcons();

            try {
                const res = await fetch(`${apiBase}/tareas/${id}/completar/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ observaciones })
                });

                if (!res.ok) throw new Error('Error al completar la labor');

                cerrarFinModal();
                await loadTareas();
                showToast('✅ Labor finalizada. Horas efectivas calculadas y sincronizadas.');
            } catch (err) {
                console.error(err);
                alert('Error al finalizar labor: ' + err.message);
            } finally {
                btnConfirm.disabled = false;
                btnConfirm.innerHTML = origHtml;
                lucide.createIcons();
            }
        });
    }

    /**
     * Utilidades
     */
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

    function formatTimeString(isoString) {
        if (!isoString) return '--:--';
        try {
            const d = new Date(isoString);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '--:--';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #10B981;
            color: #ffffff;
            padding: 0.85rem 1.25rem;
            border-radius: var(--radius-md);
            font-size: 0.875rem;
            font-weight: 600;
            box-shadow: 0 10px 25px rgba(0,0,0,0.4);
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            animation: fadeIn 0.3s ease;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
});


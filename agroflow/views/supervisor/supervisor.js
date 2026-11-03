/* agroflow/views/supervisor/supervisor.js */

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();

    // 1. Control de Acceso y Sesión
    const userRole = localStorage.getItem('agroflow_user_role');
    const storedTrabajadorId = localStorage.getItem('agroflow_trabajador_id');
    const currentSupervisorId = storedTrabajadorId ? parseInt(storedTrabajadorId) : null;

    if (!userRole || (userRole !== 'SUPERVISOR' && userRole !== 'GERENTE')) {
        window.location.href = '../login/index.html';
        return;
    }

    // Sidebar Mobile
    const sidebar = document.getElementById('sidebar');
    document.getElementById('openSidebar')?.addEventListener('click', () => sidebar.classList.add('active'));
    document.getElementById('closeSidebar')?.addEventListener('click', () => sidebar.classList.remove('active'));

    // Logout
    document.getElementById('btnLogout')?.addEventListener('click', () => {
        localStorage.removeItem('agroflow_user_role');
        localStorage.removeItem('agroflow_trabajador_id');
        localStorage.removeItem('agroflow_nombre');
        localStorage.removeItem('agroflow_username');
    });

    // Elementos DOM
    const topNombre = document.getElementById('topNombre');
    const topAvatar = document.getElementById('topAvatar');
    const crewSummaryBar = document.getElementById('crewSummaryBar');
    const noCrewBanner = document.getElementById('noCrewBanner');
    const mainCuadrillasLayout = document.getElementById('mainCuadrillasLayout');

    const crewName = document.getElementById('crewName');
    const crewSector = document.getElementById('crewSector');
    const crewTipo = document.getElementById('crewTipo');
    const crewTotalCount = document.getElementById('crewTotalCount');

    const searchInput = document.getElementById('searchInput');
    const supervisorWorkerList = document.getElementById('supervisorWorkerList');

    const sourceCrewName = document.getElementById('sourceCrewName');
    const sourceCrewCount = document.getElementById('sourceCrewCount');
    const sourceWorkerList = document.getElementById('sourceWorkerList');

    const targetCrewSelect = document.getElementById('targetCrewSelect');
    const targetCrewCount = document.getElementById('targetCrewCount');
    const targetWorkerList = document.getElementById('targetWorkerList');

    const legalAlert = document.getElementById('legalAlert');
    const transferFooter = document.getElementById('transferFooter');
    const transferReason = document.getElementById('transferReason');
    const btnCancelar = document.getElementById('btnCancelar');
    const btnReasignar = document.getElementById('btnReasignar');

    // Estado local
    let allCuadrillas = [];
    let allTrabajadores = [];
    let miCuadrilla = null;
    let misObreros = [];
    let selectedWorker = null;

    // 2. Inicialización de Datos
    async function initSupervisorApp() {
        try {
            const [resCuadrillas, resTrabajadores] = await Promise.all([
                fetch(`${CONFIG.API_BASE_URL}/cuadrillas/`),
                fetch(`${CONFIG.API_BASE_URL}/trabajadores/`)
            ]);

            if (!resCuadrillas.ok || !resTrabajadores.ok) {
                throw new Error("No se pudo cargar la información desde el servidor.");
            }

            allCuadrillas = await resCuadrillas.json();
            allTrabajadores = await resTrabajadores.json();

            // Localizar datos del supervisor actual
            const supervisorInfo = allTrabajadores.find(t => t.id === currentSupervisorId);
            
            // Actualizar Topbar
            const displayNombre = supervisorInfo 
                ? `${supervisorInfo.nombres} ${supervisorInfo.apellidos}` 
                : (localStorage.getItem('agroflow_nombre') || 'Supervisor de Campo');
            
            if (topNombre) topNombre.textContent = displayNombre;
            if (topAvatar) {
                topAvatar.src = supervisorInfo?.foto_url || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayNombre)}&background=3B82F6&color=fff`;
            }

            // Identificar cuál es SU cuadrilla a cargo
            miCuadrilla = allCuadrillas.find(c => 
                c.encargado === currentSupervisorId || 
                (supervisorInfo && supervisorInfo.cuadrilla === c.id)
            );

            // Si es un admin/gerente probando la vista y no tiene cuadrilla directa, tomar la primera
            if (!miCuadrilla && userRole === 'GERENTE' && allCuadrillas.length > 0) {
                miCuadrilla = allCuadrillas[0];
            }

            // Validar si tiene cuadrilla a cargo
            if (!miCuadrilla) {
                if (crewSummaryBar) crewSummaryBar.style.display = 'none';
                if (mainCuadrillasLayout) mainCuadrillasLayout.style.display = 'none';
                if (noCrewBanner) noCrewBanner.style.display = 'block';
                return;
            }

            // Mostrar UI activa
            if (crewSummaryBar) crewSummaryBar.style.display = 'flex';
            if (mainCuadrillasLayout) mainCuadrillasLayout.style.display = 'grid';
            if (noCrewBanner) noCrewBanner.style.display = 'none';

            // Datos del banner
            if (crewName) crewName.textContent = miCuadrilla.nombre;
            if (crewSector) crewSector.textContent = `Sector: ${miCuadrilla.sector_nombre || 'Sin Sector Asignado'}`;
            if (crewTipo) crewTipo.textContent = `Labor: ${miCuadrilla.tipo || 'General'}`;
            if (sourceCrewName) sourceCrewName.textContent = miCuadrilla.nombre;

            // Filtrar ÚNICAMENTE los obreros de SU cuadrilla (excluyendo al propio supervisor)
            misObreros = allTrabajadores.filter(t => 
                t.cuadrilla === miCuadrilla.id && 
                t.id !== currentSupervisorId
            );

            if (crewTotalCount) crewTotalCount.textContent = `${misObreros.length} obreros`;
            if (sourceCrewCount) sourceCrewCount.textContent = `${misObreros.length} personas`;

            // Llenar select de cuadrillas destino (excluyendo SU cuadrilla)
            populateTargetSelect();

            // Renderizar lista de obreros
            renderSupervisorWorkers(misObreros);

            // Cargar plan de tareas del día de la cuadrilla
            await loadDailyTasks(miCuadrilla.id);

            // Restablecer panel de reasignación
            resetTransferPanel();

        } catch (err) {
            console.error("Error al inicializar dashboard de supervisor:", err);
            if (supervisorWorkerList) {
                supervisorWorkerList.innerHTML = `
                    <li style="padding: 2rem; text-align: center; color: #EF4444;">
                        Error al cargar los obreros. Asegúrate de que el servidor Django esté activo.
                    </li>
                `;
            }
        }
    }

    // 3. Renderizar Lista de Obreros del Supervisor
    function renderSupervisorWorkers(workers) {
        supervisorWorkerList.innerHTML = '';

        if (workers.length === 0) {
            supervisorWorkerList.innerHTML = `
                <li style="padding: 2.5rem 1rem; text-align: center; color: var(--color-text-muted);">
                    <i data-lucide="users" style="width: 32px; height: 32px; margin-bottom: 0.5rem; opacity: 0.4;"></i>
                    <p style="font-size: 0.875rem;">No hay obreros en tu cuadrilla.</p>
                </li>
            `;
            lucide.createIcons();
            return;
        }

        workers.forEach(w => {
            const li = document.createElement('li');
            li.className = `worker-item worker-item-supervisor ${selectedWorker?.id === w.id ? 'active' : ''}`;
            
            const avatarUrl = w.foto_url || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(w.nombres)}+${encodeURIComponent(w.apellidos)}&background=10B981&color=fff`;

            li.innerHTML = `
                <img src="${avatarUrl}" alt="${w.nombres}">
                <div class="worker-item-info" style="flex:1;">
                    <span class="worker-item-name">${w.nombres} ${w.apellidos}</span>
                    <span class="worker-dni-pill">DNI: ${w.dni}</span>
                </div>
                <div style="color: var(--color-text-muted);">
                    <i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i>
                </div>
            `;

            li.addEventListener('click', () => {
                selectWorkerForTransfer(w);
            });

            supervisorWorkerList.appendChild(li);
        });

        lucide.createIcons();
    }

    // 4. Llenar Select de Cuadrillas Destino (Cualquiera excepto la suya)
    function populateTargetSelect() {
        targetCrewSelect.innerHTML = '';
        const otherCrews = allCuadrillas.filter(c => c.id !== miCuadrilla.id);

        if (otherCrews.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No hay otras cuadrillas disponibles';
            targetCrewSelect.appendChild(opt);
            return;
        }

        otherCrews.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.nombre} (${c.tipo})`;
            targetCrewSelect.appendChild(opt);
        });

        targetCrewSelect.addEventListener('change', () => {
            if (targetCrewSelect.value) {
                renderTargetCrew(targetCrewSelect.value);
            }
        });

        // Mostrar por defecto los integrantes de la primera otra cuadrilla
        if (otherCrews.length > 0) {
            targetCrewSelect.value = otherCrews[0].id;
            renderTargetCrew(otherCrews[0].id);
        }
    }

    // 5. Seleccionar Obrero para Traslado
    function selectWorkerForTransfer(worker) {
        selectedWorker = worker;

        // Actualizar visual en la lista izquierda
        document.querySelectorAll('.worker-item-supervisor').forEach(el => el.classList.remove('active'));
        const activeLi = Array.from(supervisorWorkerList.children).find(li => 
            li.querySelector('.worker-item-name')?.textContent.includes(worker.nombres)
        );
        if (activeLi) activeLi.classList.add('active');

        // Habilitar panel de reasignación
        transferFooter.style.opacity = '1';
        transferFooter.style.pointerEvents = 'auto';
        legalAlert.style.display = 'flex';

        // Renderizar caja origen con el obrero resaltado
        renderSourceCrew(worker);

        // Renderizar cuadrilla destino actual
        if (targetCrewSelect.value) {
            renderTargetCrew(targetCrewSelect.value);
        }

        // Enfocar el motivo
        transferReason.focus();
    }

    // 6. Dibuja la cuadrilla origen (la del supervisor), resaltando al seleccionado
    function renderSourceCrew(highlightWorker) {
        sourceWorkerList.innerHTML = '';

        misObreros.forEach(w => {
            const isHighlight = highlightWorker && w.id === highlightWorker.id;
            const div = document.createElement('div');
            div.className = `worker-card-mini ${isHighlight ? 'highlight' : ''}`;
            
            const avatarUrl = w.foto_url || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(w.nombres)}+${encodeURIComponent(w.apellidos)}&background=10B981&color=fff`;

            div.innerHTML = `
                <div class="wcm-left">
                    <img src="${avatarUrl}" alt="${w.nombres}">
                    <div class="wcm-info">
                        <span class="wcm-name">${w.nombres} ${w.apellidos}</span>
                        <span class="wcm-id">DNI ${w.dni}</span>
                    </div>
                </div>
                <div class="wcm-right">
                    ${isHighlight ? '<span class="badge" style="background:#10B981; color:#022c22; font-weight:700; font-size:10px;">A TRASLADAR</span>' : ''}
                </div>
            `;

            if (isHighlight) {
                sourceWorkerList.prepend(div);
            } else {
                sourceWorkerList.appendChild(div);
            }
        });

        lucide.createIcons();
    }

    // 7. Dibuja la cuadrilla destino (solo lectura)
    function renderTargetCrew(crewId) {
        const destWorkers = allTrabajadores.filter(t => t.cuadrilla == crewId);
        targetCrewCount.textContent = `${destWorkers.length} personas`;
        
        targetWorkerList.innerHTML = '';
        if (destWorkers.length === 0) {
            targetWorkerList.innerHTML = `
                <div class="empty-state-small">Esta cuadrilla destino aún no tiene integrantes asignados.</div>
            `;
            return;
        }

        destWorkers.forEach(w => {
            const div = document.createElement('div');
            div.className = 'worker-card-mini';
            const avatarUrl = w.foto_url || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(w.nombres)}+${encodeURIComponent(w.apellidos)}&background=64748B&color=fff`;

            div.innerHTML = `
                <div class="wcm-left">
                    <img src="${avatarUrl}" alt="${w.nombres}">
                    <div class="wcm-info">
                        <span class="wcm-name">${w.nombres} ${w.apellidos}</span>
                        <span class="wcm-id">DNI ${w.dni}</span>
                    </div>
                </div>
            `;
            targetWorkerList.appendChild(div);
        });

        lucide.createIcons();
    }

    // 8. Restablecer Panel
    function resetTransferPanel() {
        selectedWorker = null;
        transferFooter.style.opacity = '0.5';
        transferFooter.style.pointerEvents = 'none';
        legalAlert.style.display = 'none';
        transferReason.value = '';

        document.querySelectorAll('.worker-item-supervisor').forEach(el => el.classList.remove('active'));

        sourceWorkerList.innerHTML = `
            <div class="empty-state-small">Selecciona a un trabajador de tu lista a la izquierda para solicitar su traslado a otra cuadrilla.</div>
        `;
    }

    btnCancelar?.addEventListener('click', () => {
        resetTransferPanel();
    });

    // 9. Solicitar Reasignación (Firma WebAuthn requerida por ley)
    btnReasignar?.addEventListener('click', async () => {
        if (!selectedWorker) {
            alert("Por favor selecciona primero a un obrero de tu lista.");
            return;
        }

        const targetId = targetCrewSelect.value;
        if (!targetId) {
            alert("Selecciona la cuadrilla de destino.");
            return;
        }

        const motivo = transferReason.value.trim();
        if (!motivo) {
            alert("El motivo operativo del traslado es obligatorio por motivos de trazabilidad laboral y firma legal.");
            transferReason.focus();
            return;
        }

        const targetCrewObj = allCuadrillas.find(c => c.id == targetId);
        const targetCrewName = targetCrewObj ? targetCrewObj.nombre : 'la cuadrilla de destino';

        const originalText = btnReasignar.innerHTML;
        btnReasignar.innerHTML = `<i data-lucide="loader" class="spin"></i> Registrando solicitud...`;
        btnReasignar.disabled = true;
        lucide.createIcons();

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/traslados/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trabajador: selectedWorker.id,
                    cuadrilla_origen: miCuadrilla.id,
                    cuadrilla_destino: parseInt(targetId),
                    motivo: motivo,
                    estado: 'PENDIENTE'
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Error al enviar la solicitud al servidor.");
            }

            alert(`📋 ¡Solicitud de traslado formal registrada con éxito!\n\nSe ha enviado la notificación a ${selectedWorker.nombres} ${selectedWorker.apellidos} para su traslado hacia "${targetCrewName}".\n\nEl cambio se formalizará automáticamente una vez que el obrero ingrese a su portal y firme con biometría (WebAuthn).`);

            // Recargar datos actualizados
            await initSupervisorApp();

        } catch (error) {
            console.error("Error al registrar traslado:", error);
            alert("Ocurrió un error al procesar la solicitud: " + error.message);
        } finally {
            btnReasignar.innerHTML = originalText;
            btnReasignar.disabled = false;
            lucide.createIcons();
        }
    });

    // 10. Búsqueda en Vivo en su propia cuadrilla
    searchInput?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderSupervisorWorkers(misObreros);
            return;
        }

        const filtered = misObreros.filter(w => {
            const fullName = `${w.nombres} ${w.apellidos}`.toLowerCase();
            const dni = (w.dni || '').toLowerCase();
            return fullName.includes(query) || dni.includes(query);
        });

        renderSupervisorWorkers(filtered);
    });

    // 11. Cargar Plan de Trabajo y Tareas de Hoy para la Cuadrilla
    async function loadDailyTasks(cuadrillaId) {
        const dailyTasksList = document.getElementById('dailyTasksList');
        if (!dailyTasksList) return;

        try {
            const hoy = new Date().toISOString().split('T')[0];
            const res = await fetch(`${CONFIG.API_BASE_URL}/tareas/?cuadrilla=${cuadrillaId}`);
            if (!res.ok) throw new Error('Error al consultar tareas');
            const tareas = await res.json();
            
            // Filtrar tareas de hoy (o fallback a las 5 primeras)
            const tareasHoy = tareas.filter(t => t.fecha_programada === hoy);
            const listToShow = tareasHoy.length > 0 ? tareasHoy : tareas.slice(0, 5);

            if (listToShow.length === 0) {
                dailyTasksList.innerHTML = `
                    <div style="padding: 1.5rem; text-align: center; color: var(--color-text-muted); font-size: 0.875rem;">
                        No hay tareas programadas para hoy. Puedes planificarlas en la sección <a href="tareas/index.html" style="color: var(--color-primary); font-weight:600;">Plan de Tareas</a>.
                    </div>
                `;
                return;
            }

            dailyTasksList.innerHTML = listToShow.map((t, idx) => {
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

                let actionBtn = '';
                if (t.estado === 'PENDIENTE') {
                    actionBtn = `
                        <button class="btn btn--primary btn--sm btn-iniciar-quick" data-id="${t.id}" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">
                            <i data-lucide="play" style="width: 13px; height: 13px;"></i> Iniciar
                        </button>
                    `;
                } else if (t.estado === 'EN_PROCESO') {
                    actionBtn = `
                        <button class="btn btn--primary btn--sm btn-finalizar-quick" data-id="${t.id}" style="background-color: #10B981; border-color: #10B981; font-size: 0.75rem; padding: 0.35rem 0.75rem;">
                            <i data-lucide="check" style="width: 13px; height: 13px;"></i> Terminar
                        </button>
                    `;
                }

                return `
                    <div class="daily-task-item">
                        <div class="daily-task-left">
                            <span class="daily-task-number">${idx + 1}</span>
                            <div class="daily-task-info">
                                <h4>
                                    <span>${escapeHtml(t.titulo)}</span>
                                    <span class="task-status-tag ${tagClass}">
                                        ${statusIcon} ${escapeHtml(estadoTexto)}
                                    </span>
                                </h4>
                                <p>
                                    <span><i data-lucide="map-pin" style="width: 12px; height: 12px; display: inline;"></i> ${escapeHtml(t.sector_nombre || 'General')} (${escapeHtml(t.cultivo_nombre || 'Fundo')})</span>
                                    ${t.descripcion ? ` · <span>${escapeHtml(t.descripcion)}</span>` : ''}
                                </p>
                            </div>
                        </div>
                        <div class="daily-task-actions">
                            ${actionBtn}
                        </div>
                    </div>
                `;
            }).join('');

            lucide.createIcons();

            // Event listeners para Iniciar y Terminar
            document.querySelectorAll('.btn-iniciar-quick').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    btn.disabled = true;
                    btn.innerHTML = `<i data-lucide="loader" class="spinning" style="width: 12px; height: 12px;"></i>`;
                    lucide.createIcons();
                    await fetch(`${CONFIG.API_BASE_URL}/tareas/${id}/iniciar/`, { method: 'POST' });
                    await loadDailyTasks(cuadrillaId);
                });
            });

            document.querySelectorAll('.btn-finalizar-quick').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    const obs = prompt('Observaciones o resultado de la labor (opcional):', 'Labor completada con éxito.');
                    if (obs === null) return;
                    btn.disabled = true;
                    btn.innerHTML = `<i data-lucide="loader" class="spinning" style="width: 12px; height: 12px;"></i>`;
                    lucide.createIcons();
                    await fetch(`${CONFIG.API_BASE_URL}/tareas/${id}/completar/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ observaciones: obs })
                    });
                    await loadDailyTasks(cuadrillaId);
                });
            });

        } catch (e) {
            console.error('Error cargando tareas diarias:', e);
            dailyTasksList.innerHTML = `
                <div style="padding: 1.25rem; text-align: center; color: var(--color-text-muted); font-size: 0.875rem;">
                    No se pudieron cargar las tareas de hoy.
                </div>
            `;
        }
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

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Carga inicial
    await initSupervisorApp();
});


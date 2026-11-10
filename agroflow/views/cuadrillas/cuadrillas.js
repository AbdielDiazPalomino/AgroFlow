/* agroflow/views/cuadrillas/cuadrillas.js */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Control de rol
    const currentRole = localStorage.getItem('agroflow_user_role');
    if (currentRole === 'SUPERVISOR') {
        window.location.href = '../supervisor/index.html';
        return;
    } else if (currentRole === 'OBRERO') {
        window.location.href = '../obrero/index.html';
        return;
    }

    // Sidebar Mobile
    const sidebar = document.getElementById('sidebar');
    document.getElementById('openSidebar')?.addEventListener('click', () => sidebar.classList.add('active'));
    document.getElementById('closeSidebar')?.addEventListener('click', () => sidebar.classList.remove('active'));

    // --- DATOS REALES DESDE EL BACKEND ---
    let cuadrillas = [];
    let trabajadores = [];
    let sectores = [];
    let supervisores = [];

    // Nodos DOM
    const globalList = document.getElementById('globalWorkerList');
    const searchInput = document.getElementById('searchInput');
    const sourceWorkerList = document.getElementById('sourceWorkerList');
    const targetWorkerList = document.getElementById('targetWorkerList');
    const sourceCrewName = document.getElementById('sourceCrewName');
    const sourceCrewCount = document.getElementById('sourceCrewCount');
    const targetCrewSelect = document.getElementById('targetCrewSelect');
    const targetCrewCount = document.getElementById('targetCrewCount');
    const transferFooter = document.getElementById('transferFooter');
    const legalAlert = document.getElementById('legalAlert');
    const btnReasignar = document.getElementById('btnReasignar');
    const btnCancelar = document.getElementById('btnCancelar');

    // Variables de estado
    let selectedWorker = null;
    let selectedSourceCrewId = null;

    // Inicialización asíncrona
    async function initApp() {
        try {
            const [resC, resT, resS, resSup] = await Promise.all([
                fetch(`${CONFIG.API_BASE_URL}/cuadrillas/`),
                fetch(`${CONFIG.API_BASE_URL}/trabajadores/`),
                fetch(`${CONFIG.API_BASE_URL}/sectores/`),
                fetch(`${CONFIG.API_BASE_URL}/supervisores/`)
            ]);
            
            cuadrillas = await resC.json();
            const trabajadoresRaw = await resT.json();
            sectores = await resS.json();
            supervisores = await resSup.json();
            
            // Adaptar JSON del backend a la estructura que el UI requiere
            trabajadores = trabajadoresRaw.map(t => ({
                id: t.id.toString(),
                dni: t.dni,
                nombres: t.nombres,
                apellidos: t.apellidos,
                nombre: `${t.nombres} ${t.apellidos}`,
                esSupervisor: !!t.es_supervisor,
                esJefeAlmacen: !!t.es_jefe_almacen,
                activo: t.activo !== false, // Estado laboral (activo o receso)
                img: t.foto_url || `https://ui-avatars.com/api/?name=${t.nombres}+${t.apellidos}&background=random`,
                cuadrillaId: t.cuadrilla // FK integer o null
            }));

            updateStatusCounts();
            applyWorkerFilters();
            populateTargetSelect();
            populateSectoresSelect();
            populateSupervisoresSelect();
        } catch (error) {
            console.error("Error conectando con Django:", error);
            globalList.innerHTML = `<li style="padding:1rem; color:red;">Error de conexión con el Backend. Verifica tu CONFIG.API_BASE_URL o si runserver está encendido.</li>`;
        }
    }
    
    initApp();

    // Filtro por Estado de Actividad (Todos, Activos, Inactivos)
    let currentWorkerStatusFilter = 'TODOS';

    function updateStatusCounts() {
        const countTodos = document.getElementById('countTodos');
        const countActivos = document.getElementById('countActivos');
        const countInactivos = document.getElementById('countInactivos');
        if (countTodos) countTodos.textContent = trabajadores.length;
        if (countActivos) countActivos.textContent = trabajadores.filter(t => t.activo).length;
        if (countInactivos) countInactivos.textContent = trabajadores.filter(t => !t.activo).length;
    }

    function applyWorkerFilters() {
        const query = (searchInput.value || '').toLowerCase().trim();
        let filtered = trabajadores;
        if (currentWorkerStatusFilter === 'ACTIVO') {
            filtered = filtered.filter(t => t.activo);
        } else if (currentWorkerStatusFilter === 'INACTIVO') {
            filtered = filtered.filter(t => !t.activo);
        }
        if (query) {
            filtered = filtered.filter(t => t.nombre.toLowerCase().includes(query) || t.dni.includes(query));
        }
        renderGlobalWorkerList(filtered);
    }

    document.querySelectorAll('.status-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentWorkerStatusFilter = btn.dataset.filter;
            applyWorkerFilters();
        });
    });

    function populateSectoresSelect() {
        const sectorSelect = document.getElementById('addCuadrillaSector');
        if(sectorSelect) {
            // Mantener la opción por defecto
            sectorSelect.innerHTML = '<option value="">Sin Sector Específico</option>';
            sectores.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.nombre;
                sectorSelect.appendChild(opt);
            });
        }
    }

    function populateSupervisoresSelect() {
        const supSelect = document.getElementById('addCuadrillaSupervisor');
        if(supSelect) {
            supSelect.innerHTML = '<option value="">Sin Encargado Asignado</option>';
            supervisores.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.nombre_display;
                supSelect.appendChild(opt);
            });
        }
    }

    // Buscador interactivo
    searchInput.addEventListener('input', () => {
        applyWorkerFilters();
    });

    /**
     * Dibuja la lista izquierda de todos los obreros
     */
    function renderGlobalWorkerList(data) {
        globalList.innerHTML = '';
        data.forEach(worker => {
            const crew = cuadrillas.find(c => c.id == worker.cuadrillaId);
            const crewName = crew ? crew.nombre : 'Sin Cuadrilla';
            const inactivoBadge = !worker.activo 
                ? '<span class="badge-status-inactivo">INACTIVO (Receso)</span>' 
                : '';
            const crewText = !worker.activo 
                ? `DNI: ${worker.dni} • ${crewName} (En receso de temporada)` 
                : `DNI: ${worker.dni} • ${crewName}`;

            const toggleIcon = worker.activo ? 'user-minus' : 'user-check';
            const toggleTitle = worker.activo 
                ? 'Poner en receso de temporada (Inactivar temporalmente)' 
                : 'Reactivar trabajador en su cuadrilla previa';
            const toggleColor = worker.activo ? '#94A3B8' : '#10B981';

            const li = document.createElement('li');
            li.className = `worker-item ${worker.activo ? '' : 'worker-item--inactivo'} ${selectedWorker?.id === worker.id ? 'active' : ''}`;
            li.innerHTML = `
                <img src="${worker.img}" alt="${worker.nombre}">
                <div class="worker-item-info" style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                        <span class="worker-item-name">${worker.nombre}</span>
                        ${worker.esJefeAlmacen ? '<span style="background: rgba(59, 130, 246, 0.2); color: #60A5FA; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">JEFE DE ALMACÉN</span>' : (worker.esSupervisor ? '<span style="background: rgba(16, 185, 129, 0.2); color: #10B981; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">SUPERVISOR</span>' : '')}
                        ${inactivoBadge}
                    </div>
                    <span class="worker-item-crew">${crewText}</span>
                </div>
                <div class="worker-actions" style="display: flex; gap: 0.25rem; align-items: center;">
                    <button class="icon-btn icon-btn--small btn-toggle-status" data-id="${worker.id}" title="${toggleTitle}" style="color: ${toggleColor}; width: 28px; height: 28px;">
                        <i data-lucide="${toggleIcon}" style="width: 14px; height: 14px;"></i>
                    </button>
                    <button class="icon-btn icon-btn--small btn-edit-worker" data-id="${worker.id}" title="Editar trabajador" style="color: var(--color-primary); width: 28px; height: 28px;">
                        <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                    </button>
                    <button class="icon-btn icon-btn--small btn-delete-worker" data-id="${worker.id}" title="Eliminar trabajador" style="color: #EF4444; width: 28px; height: 28px;">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                    </button>
                </div>
            `;

            li.addEventListener('click', async (e) => {
                // Evitar seleccionar para traslado si se hizo click en los botones de acción
                if(e.target.closest('.worker-actions')) return;

                if (worker.esJefeAlmacen) {
                    alert("ℹ️ El Jefe de Almacén tiene un rol administrativo en Almacén Central y no puede ser asignado a cuadrillas operativas de campo.");
                    return;
                }

                if (!worker.activo) {
                    const reactivar = confirm(`ℹ️ "${worker.nombre}" está actualmente INACTIVO (en receso de temporada).\n\n¿Deseas REACTIVARLO ahora para asignarlo o trasladarlo a una cuadrilla?`);
                    if (!reactivar) return;

                    try {
                        await fetch(`${CONFIG.API_BASE_URL}/trabajadores/${worker.id}/toggle_activo/`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ activo: true })
                        });
                        worker.activo = true;
                        await initApp();
                    } catch(err) {
                        console.error(err);
                        alert("❌ Error al reactivar trabajador.");
                        return;
                    }
                }

                selectWorkerForTransfer(worker, crew);
                // Highlight update
                document.querySelectorAll('.worker-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
            });

            globalList.appendChild(li);
        });

        // Event listener para alternar estado Activo / Inactivo directamente
        globalList.querySelectorAll('.btn-toggle-status').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const workerId = btn.getAttribute('data-id');
                const worker = trabajadores.find(t => t.id === workerId);
                if (!worker) return;

                const crew = cuadrillas.find(c => c.id == worker.cuadrillaId);
                const crewName = crew ? crew.nombre : 'Sin Cuadrilla asignada';

                const confirmMsg = worker.activo
                    ? `¿Deseas poner a "${worker.nombre}" en estado INACTIVO (Receso de temporada)?\n\n• Conservará su cuadrilla asignada (${crewName}).\n• NO se borrará su historial ni su registro.\n• NO aparecerá en los partes de la cuadrilla activa hasta que sea reactivado.`
                    : `¿Deseas REACTIVAR a "${worker.nombre}"?\n\n• Volverá a estar activo inmediatamente en su cuadrilla asignada (${crewName}).`;

                if (!confirm(confirmMsg)) return;

                try {
                    const res = await fetch(`${CONFIG.API_BASE_URL}/trabajadores/${workerId}/toggle_activo/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (!res.ok) throw new Error('Error al cambiar estado');

                    await initApp();
                    alert(`✅ Trabajador "${worker.nombre}" ahora está ${worker.activo ? 'INACTIVO (en receso de temporada)' : 'REACTIVADO en ' + crewName}.`);
                } catch(err) {
                    console.error(err);
                    alert("❌ Error al actualizar el estado del trabajador.");
                }
            });
        });

        // Event listeners para los botones de editar y eliminar trabajadores
        globalList.querySelectorAll('.btn-edit-worker').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const workerId = btn.getAttribute('data-id');
                const worker = trabajadores.find(t => t.id === workerId);
                if(worker) openWorkerModalEdit(worker);
            });
        });

        globalList.querySelectorAll('.btn-delete-worker').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const workerId = btn.getAttribute('data-id');
                const worker = trabajadores.find(t => t.id === workerId);
                if(!worker) return;

                const confirmDelete = confirm(`⚠️ ¿Estás seguro que deseas ELIMINAR al trabajador "${worker.nombre}" (DNI: ${worker.dni})? Esta acción no se puede deshacer.`);
                if(!confirmDelete) return;

                try {
                    const res = await fetch(`${CONFIG.API_BASE_URL}/trabajadores/${workerId}/`, {
                        method: 'DELETE'
                    });
                    if(!res.ok) throw new Error('Error al eliminar');

                    alert(`🗑️ Trabajador "${worker.nombre}" eliminado correctamente.`);
                    if(selectedWorker?.id === workerId) {
                        btnCancelar.click();
                    }
                    await initApp();
                } catch(err) {
                    console.error(err);
                    alert("❌ Error al eliminar el trabajador.");
                }
            });
        });

        lucide.createIcons();
    }

    /**
     * Llena el select de Cuadrilla Destino
     */
    function populateTargetSelect() {
        targetCrewSelect.innerHTML = '';
        cuadrillas.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre;
            targetCrewSelect.appendChild(opt);
        });

        targetCrewSelect.addEventListener('change', () => {
            renderTargetCrew(targetCrewSelect.value);
        });
    }

    /**
     * Lógica al seleccionar un trabajador de la lista izquierda
     */
    function selectWorkerForTransfer(worker, sourceCrew) {
        selectedWorker = worker;
        selectedSourceCrewId = sourceCrew ? sourceCrew.id : null;
        const isReassignment = !!sourceCrew;

        // Actualizar UI del panel origen y título
        sourceCrewName.textContent = sourceCrew ? sourceCrew.nombre : 'Personal Sin Asignar';
        const panelTitle = document.getElementById('panelActionTitle');
        if(panelTitle) {
            panelTitle.textContent = isReassignment ? 'Reasignación de Personal (Traslado Legal)' : 'Asignación Inicial de Personal';
        }
        
        // Habilitar controles
        transferFooter.style.opacity = '1';
        transferFooter.style.pointerEvents = 'auto';
        
        // Alerta legal: Solo si YA tiene cuadrilla y se trata de un traslado/reasignación
        legalAlert.style.display = isReassignment ? 'flex' : 'none';

        // Adaptar etiqueta del botón y placeholder del motivo
        const reasonInput = document.getElementById('transferReason');
        if(isReassignment) {
            btnReasignar.innerHTML = `<i data-lucide="shield-check" style="width: 16px; height: 16px;"></i> Solicitar Reasignación (Firma WebAuthn)`;
            btnReasignar.style.backgroundColor = '#10B981'; // Verde corporativo Agroflow
            if(reasonInput) {
                reasonInput.placeholder = "Describe brevemente la razón operativa o administrativa de este traslado de personal (requerido por ley)...";
            }
        } else {
            btnReasignar.innerHTML = `<i data-lucide="user-check" style="width: 16px; height: 16px;"></i> Asignar Directamente a Cuadrilla`;
            btnReasignar.style.backgroundColor = '#10B981'; // Verde corporativo Agroflow
            if(reasonInput) {
                reasonInput.placeholder = "Nota interna opcional para esta primera asignación...";
            }
        }
        lucide.createIcons();

        // Auto-seleccionar otra cuadrilla por defecto en el destino
        const otherCrew = cuadrillas.find(c => c.id != selectedSourceCrewId);
        if(otherCrew) {
            targetCrewSelect.value = otherCrew.id;
            renderTargetCrew(otherCrew.id);
        } else if(cuadrillas.length > 0) {
            targetCrewSelect.value = cuadrillas[0].id;
            renderTargetCrew(cuadrillas[0].id);
        }

        renderSourceCrew(selectedSourceCrewId, worker);
    }

    /**
     * Dibuja la cuadrilla origen, resaltando al trabajador a transferir
     */
    function renderSourceCrew(crewId, highlightWorker) {
        let workers = [];
        if (crewId === null) {
            // Si no tiene cuadrilla, solo mostramos al trabajador seleccionado en la caja origen
            workers = [highlightWorker];
            sourceCrewCount.textContent = `1 persona nueva`;
        } else {
            // Solo los trabajadores activos de la cuadrilla aparecen como miembros operativos
            workers = trabajadores.filter(t => t.cuadrillaId == crewId && t.activo);
            const inactivosCrew = trabajadores.filter(t => t.cuadrillaId == crewId && !t.activo).length;
            sourceCrewCount.textContent = inactivosCrew > 0 
                ? `${workers.length} activos (${inactivosCrew} en receso)`
                : `${workers.length} personas`;
        }
        
        sourceWorkerList.innerHTML = '';
        workers.forEach(w => {
            const isHighlight = w.id === highlightWorker.id;
            const div = document.createElement('div');
            div.className = `worker-card-mini ${isHighlight ? 'highlight' : ''}`;
            div.innerHTML = `
                <div class="wcm-left">
                    <img src="${w.img}">
                    <div class="wcm-info">
                        <span class="wcm-name">${w.nombre}</span>
                        <span class="wcm-id">ID ${w.id}</span>
                    </div>
                </div>
                <div class="wcm-right">
                    ${isHighlight ? '<i data-lucide="grip-vertical"></i>' : ''}
                </div>
            `;
            // Asegurarse de que el seleccionado esté arriba
            if(isHighlight) {
                sourceWorkerList.prepend(div);
            } else {
                sourceWorkerList.appendChild(div);
            }
        });
        lucide.createIcons();
    }

    /**
     * Dibuja la cuadrilla destino (solo lectura)
     */
    function renderTargetCrew(crewId) {
        const workers = trabajadores.filter(t => t.cuadrillaId == crewId && t.activo);
        const inactivosCrew = trabajadores.filter(t => t.cuadrillaId == crewId && !t.activo).length;
        targetCrewCount.textContent = inactivosCrew > 0 
            ? `${workers.length} activos (${inactivosCrew} en receso)`
            : `${workers.length} personas`;
        
        targetWorkerList.innerHTML = '';
        if (workers.length === 0) {
            targetWorkerList.innerHTML = `
                <div class="empty-state-small">${inactivosCrew > 0 ? `Todos los miembros (${inactivosCrew}) están en receso de temporada.` : 'Esta cuadrilla aún no tiene integrantes activos.'}</div>
            `;
            return;
        }

        workers.forEach(w => {
            const div = document.createElement('div');
            div.className = 'worker-card-mini';
            div.innerHTML = `
                <div class="wcm-left">
                    <img src="${w.img}">
                    <div class="wcm-info">
                        <span class="wcm-name">${w.nombre}</span>
                        <span class="wcm-id">ID ${w.id}</span>
                    </div>
                </div>
            `;
            targetWorkerList.appendChild(div);
        });
        lucide.createIcons();
    }

    // Acción: Asignar / Reasignar
    btnReasignar.addEventListener('click', async () => {
        if(!selectedWorker) return;
        const targetId = targetCrewSelect.value;
        const motivo = document.getElementById('transferReason').value.trim();
        const isReassignment = !!selectedWorker.cuadrillaId;
        const targetCrewObj = cuadrillas.find(c => c.id == targetId);
        const targetCrewName = targetCrewObj ? targetCrewObj.nombre : 'la cuadrilla seleccionada';
        
        if(!targetId) {
            alert('Debes seleccionar una cuadrilla de destino.');
            return;
        }

        if(targetId == selectedWorker.cuadrillaId) {
            alert('El trabajador ya pertenece a esta cuadrilla.');
            return;
        }

        // Si es REASIGNACIÓN (ya tenía cuadrilla previa), es obligatorio el motivo legal
        if(isReassignment && !motivo) {
            alert('Por favor, ingresa el motivo del cambio para el registro de auditoría legal y biometría.');
            return;
        }

        const originalText = btnReasignar.innerHTML;
        btnReasignar.innerHTML = `<i data-lucide="loader" class="spin"></i> Procesando...`;
        btnReasignar.disabled = true;
        lucide.createIcons();

        try {
            if(!isReassignment) {
                // =========================================================================
                // CASO 1: ASIGNACIÓN INICIAL DIRECTA (El trabajador no tenía cuadrilla previa)
                // Se asigna de inmediato sin requerir firma biométrica WebAuthn
                // =========================================================================
                const patchResponse = await fetch(`${CONFIG.API_BASE_URL}/trabajadores/${selectedWorker.id}/`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        cuadrilla: parseInt(targetId)
                    })
                });

                if (!patchResponse.ok) throw new Error('Error al asignar cuadrilla al trabajador');

                alert(`✅ ¡Asignación directa exitosa!\n${selectedWorker.nombre} fue asignado directamente a ${targetCrewName} sin necesidad de validación biométrica.`);
            } else {
                // =========================================================================
                // CASO 2: REASIGNACIÓN / TRASLADO (Ya tenía cuadrilla previa)
                // Se genera la solicitud formal que requiere firma biométrica WebAuthn
                // =========================================================================
                const response = await fetch(`${CONFIG.API_BASE_URL}/traslados/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        trabajador: parseInt(selectedWorker.id),
                        cuadrilla_origen: parseInt(selectedWorker.cuadrillaId),
                        cuadrilla_destino: parseInt(targetId),
                        motivo: motivo,
                        estado: 'PENDIENTE'
                    })
                });

                if (!response.ok) throw new Error('Error al enviar la solicitud de traslado');

                alert(`📋 Solicitud de traslado registrada correctamente en la Base de Datos.\n\nAl tratarse de una reasignación entre cuadrillas, queda en estado PENDIENTE hasta que ${selectedWorker.nombre} firme digitalmente mediante WebAuthn.`);
            }
            
            // Recargar datos actualizados
            await initApp();
            
            // Restablecer UI
            document.getElementById('transferReason').value = '';
            btnCancelar.click();

        } catch(error) {
            console.error(error);
            alert("❌ Ocurrió un error al contactar con el servidor. Verifica tu CONFIG.API_BASE_URL o que runserver esté activo.");
        } finally {
            btnReasignar.innerHTML = originalText;
            btnReasignar.disabled = false;
            lucide.createIcons();
        }
    });

    btnCancelar.addEventListener('click', () => {
        selectedWorker = null;
        transferFooter.style.opacity = '0.5';
        transferFooter.style.pointerEvents = 'none';
        legalAlert.style.display = 'none';
        
        const panelTitle = document.getElementById('panelActionTitle');
        if(panelTitle) panelTitle.textContent = 'Asignación / Reasignación de Personal';
        
        sourceWorkerList.innerHTML = '<div class="empty-state-small">Selecciona un obrero de la lista izquierda para iniciar reasignación.</div>';
        targetWorkerList.innerHTML = '';
        sourceCrewName.textContent = 'Cuadrilla Origen';
        sourceCrewCount.textContent = '0 personas';
        targetCrewCount.textContent = '0 personas';
        
        document.querySelectorAll('.worker-item').forEach(el => el.classList.remove('active'));
    });

    // ==========================================
    // AGREGAR / EDITAR / ELIMINAR TRABAJADOR
    // ==========================================
    const modalAdd = document.getElementById('modalAgregarTrabajador');
    const btnOpenModal = document.getElementById('btnAgregarTrabajador');
    const btnCloseModal = document.getElementById('btnCerrarModal');
    const formAdd = document.getElementById('formAgregarTrabajador');
    const btnEliminarTrabajador = document.getElementById('btnEliminarTrabajador');
    const modalTrabajadorTitle = document.getElementById('modalTrabajadorTitle');

    const btnCancelarModalTrabajador = document.getElementById('btnCancelarModalTrabajador');

    function openWorkerModalCreate() {
        modalTrabajadorTitle.innerHTML = `
            <i data-lucide="user-plus" style="color: var(--color-primary); width: 22px; height: 22px;"></i>
            <span>Nuevo Trabajador</span>
        `;
        formAdd.reset();
        document.getElementById('addTrabajadorId').value = '';
        document.getElementById('addEsSupervisor').value = 'OBRERO';
        const estadoSelect = document.getElementById('addEstadoLaboral');
        if (estadoSelect) estadoSelect.value = 'true';
        btnEliminarTrabajador.style.display = 'none';
        modalAdd.classList.add('active');
        lucide.createIcons();
    }

    function openWorkerModalEdit(worker) {
        modalTrabajadorTitle.innerHTML = `
            <i data-lucide="edit" style="color: var(--color-primary); width: 22px; height: 22px;"></i>
            <span>Editar Trabajador</span>
        `;
        document.getElementById('addTrabajadorId').value = worker.id;
        document.getElementById('addNombres').value = worker.nombres || '';
        document.getElementById('addApellidos').value = worker.apellidos || '';
        document.getElementById('addDni').value = worker.dni || '';
        document.getElementById('addEsSupervisor').value = worker.esJefeAlmacen 
            ? 'JEFE_ALMACEN' 
            : (worker.esSupervisor ? 'SUPERVISOR' : 'OBRERO');
        const estadoSelect = document.getElementById('addEstadoLaboral');
        if (estadoSelect) estadoSelect.value = worker.activo ? 'true' : 'false';
        btnEliminarTrabajador.style.display = 'inline-flex';
        modalAdd.classList.add('active');
        lucide.createIcons();
    }

    function closeWorkerModal() {
        modalAdd.classList.remove('active');
    }

    if(btnOpenModal && modalAdd) {
        btnOpenModal.addEventListener('click', openWorkerModalCreate);
        btnCloseModal?.addEventListener('click', closeWorkerModal);
        btnCancelarModalTrabajador?.addEventListener('click', closeWorkerModal);

        // Cerrar al dar click fuera (en el backdrop)
        modalAdd.addEventListener('click', (e) => {
            if(e.target === modalAdd) closeWorkerModal();
        });

        formAdd.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const trabajadorId = document.getElementById('addTrabajadorId').value;
            const nombres = document.getElementById('addNombres').value.trim();
            const apellidos = document.getElementById('addApellidos').value.trim();
            const dni = document.getElementById('addDni').value.trim();
            const rolVal = document.getElementById('addEsSupervisor').value;
            const esSupervisor = rolVal === 'SUPERVISOR';
            const esJefeAlmacen = rolVal === 'JEFE_ALMACEN';
            const estadoLaboralVal = document.getElementById('addEstadoLaboral')?.value;
            const activo = estadoLaboralVal === undefined ? true : (estadoLaboralVal === 'true');
            
            const submitBtn = formAdd.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Guardando...';

            const payload = {
                nombres: nombres,
                apellidos: apellidos,
                dni: dni,
                es_supervisor: esSupervisor,
                es_jefe_almacen: esJefeAlmacen,
                activo: activo
            };

            const method = trabajadorId ? 'PUT' : 'POST';
            const url = trabajadorId 
                ? `${CONFIG.API_BASE_URL}/trabajadores/${trabajadorId}/` 
                : `${CONFIG.API_BASE_URL}/trabajadores/`;

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const err = await response.json();
                    const msg = err.error || err.detail || (typeof err === 'object' ? Object.values(err).flat().join(', ') : JSON.stringify(err));
                    throw new Error(msg);
                }

                alert(`✅ Trabajador ${nombres} ${trabajadorId ? 'actualizado' : 'registrado'} correctamente.`);
                
                formAdd.reset();
                closeWorkerModal();
                
                await initApp();

            } catch(error) {
                console.error("Error al guardar:", error);
                alert("❌ " + (error.message || "Ocurrió un error al guardar el trabajador."));
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });

        btnEliminarTrabajador.addEventListener('click', async () => {
            const trabajadorId = document.getElementById('addTrabajadorId').value;
            if(!trabajadorId) return;

            const confirmDelete = confirm('⚠️ ¿Estás seguro que deseas ELIMINAR este trabajador? Esta acción no se puede deshacer.');
            if(!confirmDelete) return;

            btnEliminarTrabajador.disabled = true;
            btnEliminarTrabajador.innerHTML = 'Eliminando...';

            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/trabajadores/${trabajadorId}/`, {
                    method: 'DELETE'
                });

                if (!response.ok) throw new Error('Error al eliminar');

                alert('🗑️ Trabajador eliminado correctamente.');
                closeWorkerModal();
                if(selectedWorker?.id === trabajadorId) {
                    btnCancelar.click();
                }
                await initApp();
            } catch(err) {
                console.error(err);
                alert('❌ Error al eliminar el trabajador.');
            } finally {
                btnEliminarTrabajador.disabled = false;
                btnEliminarTrabajador.innerHTML = 'Eliminar';
            }
        });
    }

    // ==========================================
    // CREAR / EDITAR / ELIMINAR CUADRILLA
    // ==========================================
    const modalAddCuadrilla = document.getElementById('modalAgregarCuadrilla');
    const btnOpenModalCuadrilla = document.getElementById('btnAgregarCuadrilla');
    const btnCloseModalCuadrilla = document.getElementById('btnCerrarModalCuadrilla');
    const btnCerrarModalCuadrillaX = document.getElementById('btnCerrarModalCuadrillaX');
    const formAddCuadrilla = document.getElementById('formAgregarCuadrilla');
    const btnEliminarCuadrilla = document.getElementById('btnEliminarCuadrilla');
    const modalCuadrillaTitle = document.getElementById('modalCuadrillaTitle');

    function closeCuadrillaModal() {
        modalAddCuadrilla.classList.remove('active');
    }

    // Helper: Abrir modal en modo CREAR
    function openCuadrillaModalCreate() {
        modalCuadrillaTitle.innerHTML = `
            <i data-lucide="users" style="color: var(--color-primary); width: 22px; height: 22px;"></i>
            <span>Nueva Cuadrilla</span>
        `;
        formAddCuadrilla.reset();
        document.getElementById('addCuadrillaId').value = '';
        btnEliminarCuadrilla.style.display = 'none';
        modalAddCuadrilla.classList.add('active');
        lucide.createIcons();
    }

    // Helper: Abrir modal en modo EDITAR
    function openCuadrillaModalEdit(cuadrilla) {
        modalCuadrillaTitle.innerHTML = `
            <i data-lucide="edit" style="color: var(--color-primary); width: 22px; height: 22px;"></i>
            <span>Editar Cuadrilla</span>
        `;
        document.getElementById('addCuadrillaId').value = cuadrilla.id;
        document.getElementById('addCuadrillaNombre').value = cuadrilla.nombre;
        document.getElementById('addCuadrillaTipo').value = cuadrilla.tipo;
        document.getElementById('addCuadrillaSector').value = cuadrilla.sector_asignado || '';
        document.getElementById('addCuadrillaSupervisor').value = cuadrilla.encargado || cuadrilla.supervisor || '';
        btnEliminarCuadrilla.style.display = 'inline-flex';
        modalAddCuadrilla.classList.add('active');
        lucide.createIcons();
    }

    if(btnOpenModalCuadrilla && modalAddCuadrilla) {
        btnOpenModalCuadrilla.addEventListener('click', openCuadrillaModalCreate);
        btnCloseModalCuadrilla?.addEventListener('click', closeCuadrillaModal);
        btnCerrarModalCuadrillaX?.addEventListener('click', closeCuadrillaModal);

        modalAddCuadrilla.addEventListener('click', (e) => {
            if(e.target === modalAddCuadrilla) closeCuadrillaModal();
        });

        // GUARDAR (POST o PUT)
        formAddCuadrilla.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const cuadrillaId = document.getElementById('addCuadrillaId').value;
            const nombre = document.getElementById('addCuadrillaNombre').value;
            const tipo = document.getElementById('addCuadrillaTipo').value;
            const sectorId = document.getElementById('addCuadrillaSector').value;
            const encargadoId = document.getElementById('addCuadrillaSupervisor').value;
            
            const submitBtn = formAddCuadrilla.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Guardando...';

            const payload = {
                nombre: nombre,
                tipo: tipo,
                sector_asignado: sectorId ? parseInt(sectorId) : null,
                encargado: encargadoId ? parseInt(encargadoId) : null
            };

            const method = cuadrillaId ? 'PUT' : 'POST';
            const url = cuadrillaId 
                ? `${CONFIG.API_BASE_URL}/cuadrillas/${cuadrillaId}/` 
                : `${CONFIG.API_BASE_URL}/cuadrillas/`;

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(JSON.stringify(err));
                }

                alert(`✅ Cuadrilla '${nombre}' ${cuadrillaId ? 'actualizada' : 'registrada'} correctamente.`);
                
                formAddCuadrilla.reset();
                closeCuadrillaModal();
                await initApp();

            } catch(error) {
                console.error("Error al guardar:", error);
                alert("❌ Ocurrió un error al guardar la Cuadrilla. Verifica la consola.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });

        // ELIMINAR
        btnEliminarCuadrilla.addEventListener('click', async () => {
            const cuadrillaId = document.getElementById('addCuadrillaId').value;
            if(!cuadrillaId) return;

            const confirmDelete = confirm('⚠️ ¿Estás seguro que deseas ELIMINAR esta cuadrilla? Los trabajadores asignados quedarán sin cuadrilla.');
            if(!confirmDelete) return;

            btnEliminarCuadrilla.disabled = true;
            btnEliminarCuadrilla.innerHTML = 'Eliminando...';

            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/cuadrillas/${cuadrillaId}/`, {
                    method: 'DELETE'
                });

                if (!response.ok) throw new Error('Error eliminando');

                alert('🗑️ Cuadrilla eliminada correctamente.');
                closeCuadrillaModal();
                await initApp();
            } catch(err) {
                console.error(err);
                alert('❌ Error al eliminar la cuadrilla.');
            } finally {
                btnEliminarCuadrilla.disabled = false;
                btnEliminarCuadrilla.innerHTML = 'Eliminar';
            }
        });
    }

    // ==========================================
    // EDITAR CUADRILLA DESDE LA LISTA DE CUADRILLAS (targetCrewSelect)
    // Se añade un botón de editar al lado del select de destino
    // ==========================================
    const editTargetBtn = document.createElement('button');
    editTargetBtn.className = 'icon-btn icon-btn--small';
    editTargetBtn.title = 'Editar esta cuadrilla';
    editTargetBtn.innerHTML = '<i data-lucide="edit-2"></i>';
    editTargetBtn.style.cssText = 'color: var(--color-primary); margin-left: 0.5rem;';
    
    // Insertar el botón de editar junto al select de cuadrilla destino
    const targetSelectWrapper = targetCrewSelect?.parentElement;
    if(targetSelectWrapper) {
        targetSelectWrapper.parentElement.appendChild(editTargetBtn);
    }

    editTargetBtn.addEventListener('click', () => {
        const selectedId = targetCrewSelect.value;
        if(!selectedId) return;
        const cuadrilla = cuadrillas.find(c => c.id == selectedId);
        if(cuadrilla) {
            openCuadrillaModalEdit(cuadrilla);
        }
    });

    lucide.createIcons();

});

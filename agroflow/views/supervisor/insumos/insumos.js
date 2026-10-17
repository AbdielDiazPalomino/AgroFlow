/* agroflow/views/supervisor/insumos/insumos.js */

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();

    // 1. Control de Rol y Sesión
    const userRole = localStorage.getItem('agroflow_user_role');
    const storedTrabajadorId = localStorage.getItem('agroflow_trabajador_id');
    const currentSupervisorId = storedTrabajadorId ? parseInt(storedTrabajadorId) : null;

    if (!userRole || (userRole !== 'SUPERVISOR' && userRole !== 'GERENTE')) {
        window.location.href = '../../login/index.html';
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
    const barCuadrillaNombre = document.getElementById('barCuadrillaNombre');
    const barSectorNombre = document.getElementById('barSectorNombre');

    const statTotal = document.getElementById('statTotal');
    const statPendientes = document.getElementById('statPendientes');
    const statAprobados = document.getElementById('statAprobados');
    const statRechazados = document.getElementById('statRechazados');

    const solicitudesGrid = document.getElementById('solicitudesGrid');
    const solicitudesCountText = document.getElementById('solicitudesCountText');
    const tabBtns = document.querySelectorAll('.tab-btn');

    const modal = document.getElementById('modalSolicitud');
    const btnNuevaSolicitud = document.getElementById('btnNuevaSolicitud');
    const btnCerrarModal = document.getElementById('btnCerrarModal');
    const btnCancelarModal = document.getElementById('btnCancelarModal');
    const formSolicitudInsumo = document.getElementById('formSolicitudInsumo');

    // Estado local
    let allCuadrillas = [];
    let allTrabajadores = [];
    let miCuadrilla = null;
    let todasSolicitudes = [];
    let currentFilter = 'TODOS';

    // 2. Cargar Datos
    async function loadInsumosApp() {
        try {
            const [resC, resT, resI] = await Promise.all([
                fetch(`${CONFIG.API_BASE_URL}/cuadrillas/`),
                fetch(`${CONFIG.API_BASE_URL}/trabajadores/`),
                fetch(`${CONFIG.API_BASE_URL}/insumos/`)
            ]);

            allCuadrillas = await resC.json();
            allTrabajadores = await resT.json();
            todasSolicitudes = await resI.json();

            // Identificar supervisor
            const supervisorInfo = allTrabajadores.find(t => t.id === currentSupervisorId);
            const displayNombre = supervisorInfo 
                ? `${supervisorInfo.nombres} ${supervisorInfo.apellidos}` 
                : (localStorage.getItem('agroflow_nombre') || 'Supervisor de Campo');

            if (topNombre) topNombre.textContent = displayNombre;
            if (topAvatar) {
                topAvatar.src = supervisorInfo?.foto_url || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayNombre)}&background=3B82F6&color=fff`;
            }

            // Identificar cuadrilla
            miCuadrilla = allCuadrillas.find(c => 
                c.encargado === currentSupervisorId || 
                (supervisorInfo && supervisorInfo.cuadrilla === c.id)
            );

            if (!miCuadrilla && userRole === 'GERENTE' && allCuadrillas.length > 0) {
                miCuadrilla = allCuadrillas[0];
            }

            if (miCuadrilla) {
                barCuadrillaNombre.textContent = miCuadrilla.nombre;
                barSectorNombre.textContent = `Sector: ${miCuadrilla.sector_nombre || 'Sin Sector asignado'} • Labor: ${miCuadrilla.tipo || 'General'}`;
            } else {
                barCuadrillaNombre.textContent = 'Sin Cuadrilla a Cargo';
                barSectorNombre.textContent = 'Contacta al administrador para asignarte una cuadrilla';
            }

            // Filtrar solicitudes correspondientes a esta cuadrilla (o todas si es gerente)
            const solicitudesFiltradas = miCuadrilla 
                ? todasSolicitudes.filter(s => s.cuadrilla === miCuadrilla.id)
                : todasSolicitudes;

            // Actualizar Métricas
            updateStats(solicitudesFiltradas);

            // Renderizar Grid
            renderGrid(solicitudesFiltradas);

        } catch (err) {
            console.error("Error al cargar insumos:", err);
            solicitudesGrid.innerHTML = `
                <div style="padding: 3rem; text-align: center; color: #EF4444; grid-column: 1 / -1;">
                    Error al conectar con la base de datos de insumos.
                </div>
            `;
        }
    }

    // 3. Métricas
    function updateStats(solicitudes) {
        const total = solicitudes.length;
        const pendientes = solicitudes.filter(s => s.estado === 'PENDIENTE').length;
        const aprobados = solicitudes.filter(s => s.estado === 'APROBADO').length;
        const rechazados = solicitudes.filter(s => s.estado === 'RECHAZADO').length;

        if (statTotal) statTotal.textContent = total;
        if (statPendientes) statPendientes.textContent = pendientes;
        if (statAprobados) statAprobados.textContent = aprobados;
        if (statRechazados) statRechazados.textContent = rechazados;
    }

    // 4. Renderizar Solicitudes
    function renderGrid(solicitudes) {
        let displayList = solicitudes;
        if (currentFilter !== 'TODOS') {
            displayList = solicitudes.filter(s => s.estado === currentFilter);
        }

        solicitudesCountText.textContent = `${displayList.length} pedidos mostrados`;
        solicitudesGrid.innerHTML = '';

        if (displayList.length === 0) {
            solicitudesGrid.innerHTML = `
                <div style="padding: 3rem 1rem; text-align: center; color: var(--color-text-muted); grid-column: 1 / -1;">
                    <i data-lucide="package-search" style="width: 44px; height: 44px; opacity: 0.4; margin-bottom: 0.75rem;"></i>
                    <p style="font-size: 0.9375rem; font-weight: 500;">No hay pedidos en esta categoría.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        displayList.forEach(s => {
            const card = document.createElement('div');
            
            let statusClass = 'status-pending';
            let badgeText = '🟡 Pendiente';
            let badgeColor = 'rgba(245, 158, 11, 0.15); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.3);';

            if (s.estado === 'APROBADO') {
                statusClass = 'status-approved';
                badgeText = '✅ Aprobado (SÍ)';
                badgeColor = 'rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3);';
            } else if (s.estado === 'RECHAZADO') {
                statusClass = 'status-rejected';
                badgeText = '❌ Rechazado (NO)';
                badgeColor = 'rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.3);';
            }

            card.className = `solicitud-card ${statusClass}`;

            const fechaFormat = s.fecha_solicitud 
                ? new Date(s.fecha_solicitud).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Reciente';

            const esUrgente = s.prioridad === 'URGENTE';

            // HTML de la caja de respuesta de almacén
            let respuestaAlmacenHtml = '';
            if (s.estado === 'PENDIENTE') {
                respuestaAlmacenHtml = `
                    <div class="almacen-response-box">
                        <div class="almacen-response-header">
                            <span style="font-size:0.75rem; font-weight:600; color:#FBBF24;">🟡 En espera de respuesta de Almacén</span>
                        </div>
                        <p style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:0.25rem;">
                            ¿Qué responde Almacén Central?
                        </p>
                        <div class="almacen-sim-actions">
                            <button class="btn-almacen-si" data-id="${s.id}">
                                <i data-lucide="check"></i> Aprobar (SÍ)
                            </button>
                            <button class="btn-almacen-no" data-id="${s.id}">
                                <i data-lucide="x"></i> Rechazar (NO)
                            </button>
                        </div>
                    </div>
                `;
            } else if (s.estado === 'APROBADO') {
                respuestaAlmacenHtml = `
                    <div class="almacen-response-box approved">
                        <div class="almacen-response-header">
                            <span style="font-size:0.8125rem; font-weight:700; color:#10B981; display:flex; align-items:center; gap:0.35rem;">
                                <i data-lucide="check-circle-2" style="width:16px; height:16px;"></i> Respuesta: APROBADO (SÍ)
                            </span>
                            <span style="font-size:0.72rem; color:#34D399;">Listo en Almacén</span>
                        </div>
                        <p style="font-size:0.8125rem; color:var(--color-text-title);">
                            ${s.respuesta_almacen || 'Insumo verificado con stock y listo para retiro en puerta 1 de almacén.'}
                        </p>
                    </div>
                `;
            } else {
                respuestaAlmacenHtml = `
                    <div class="almacen-response-box rejected">
                        <div class="almacen-response-header">
                            <span style="font-size:0.8125rem; font-weight:700; color:#EF4444; display:flex; align-items:center; gap:0.35rem;">
                                <i data-lucide="x-circle" style="width:16px; height:16px;"></i> Respuesta: RECHAZADO (NO)
                            </span>
                        </div>
                        <p style="font-size:0.8125rem; color:#F87171;">
                            ${s.respuesta_almacen || 'Sin existencias en almacén central o desestimado por política de inventario.'}
                        </p>
                    </div>
                `;
            }

            card.innerHTML = `
                <div>
                    <div class="solicitud-card__header">
                        <div>
                            <div class="solicitud-card__title">${s.insumo_nombre}</div>
                            <div class="solicitud-card__sub">
                                <i data-lucide="calendar" style="width: 14px; height: 14px;"></i> ${fechaFormat}
                            </div>
                        </div>
                        <span class="badge" style="${badgeColor}; font-size: 0.75rem; padding: 0.35rem 0.75rem;">
                            ${badgeText}
                        </span>
                    </div>

                    <div class="solicitud-card__body mt-4">
                        <div class="solicitud-meta-row">
                            <span class="solicitud-meta-label">Cantidad Requerida:</span>
                            <span class="solicitud-meta-val" style="color:var(--color-primary); font-size:1rem;">
                                ${s.cantidad} ${s.unidad_medida}
                            </span>
                        </div>
                        <div class="solicitud-meta-row">
                            <span class="solicitud-meta-label">Nivel de Prioridad:</span>
                            <span>
                                ${esUrgente 
                                    ? '<span class="badge" style="background:#EF4444; color:white; font-size:10px;">URGENTE</span>' 
                                    : '<span class="badge badge--neutral" style="font-size:10px;">Normal</span>'
                                }
                            </span>
                        </div>
                        <div class="solicitud-motivo mt-4">
                            <strong style="display:block; margin-bottom:0.25rem; color:var(--color-text-title); font-size:0.75rem; text-transform:uppercase;">Motivo en Campo:</strong>
                            ${s.motivo || 'Requerimiento operativo general.'}
                        </div>
                    </div>
                </div>

                ${respuestaAlmacenHtml}
            `;

            // Event listeners para la simulación de respuesta de almacén
            const btnSi = card.querySelector('.btn-almacen-si');
            const btnNo = card.querySelector('.btn-almacen-no');

            btnSi?.addEventListener('click', async () => {
                await responderAlmacen(s.id, 'APROBADO');
            });

            btnNo?.addEventListener('click', async () => {
                await responderAlmacen(s.id, 'RECHAZADO');
            });

            solicitudesGrid.appendChild(card);
        });

        lucide.createIcons();
    }

    // 5. Responder a la Solicitud (SÍ o NO)
    async function responderAlmacen(solicitudId, nuevoEstado) {
        let nota = "";
        if (nuevoEstado === 'APROBADO') {
            nota = prompt("Nota de Almacén para la Cuadrilla (Opcional):", "Aprobado por Almacén Central. Pasar a retirar por ventanilla 2 con firma de remisión.");
            if (nota === null) return; // Cancelado
        } else {
            nota = prompt("Motivo del Rechazo de Almacén (Requerido):", "Sin stock disponible en almacén central. Se coordinará reposición con compras.");
            if (nota === null) return; // Cancelado
        }

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/insumos/${solicitudId}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: nuevoEstado,
                    respuesta_almacen: nota
                })
            });

            if (!res.ok) throw new Error("No se pudo actualizar la respuesta de almacén.");

            const accionTexto = nuevoEstado === 'APROBADO' ? 'APROBADO (SÍ)' : 'RECHAZADO (NO)';
            alert(`✅ Respuesta de almacén registrada: ${accionTexto}`);

            await loadInsumosApp();

        } catch (err) {
            console.error(err);
            alert("Error al responder: " + err.message);
        }
    }

    // 6. Tabs de Filtro
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            
            const solicitudesFiltradas = miCuadrilla 
                ? todasSolicitudes.filter(s => s.cuadrilla === miCuadrilla.id)
                : todasSolicitudes;

            renderGrid(solicitudesFiltradas);
        });
    });

    // 7. Modal Nueva Solicitud
    btnNuevaSolicitud?.addEventListener('click', () => {
        if (!miCuadrilla) {
            alert("Necesitas tener una cuadrilla a tu cargo para solicitar insumos.");
            return;
        }
        formSolicitudInsumo.reset();
        modal.classList.add('active');
        lucide.createIcons();
    });

    btnCerrarModal?.addEventListener('click', () => modal.classList.remove('active'));
    btnCancelarModal?.addEventListener('click', () => modal.classList.remove('active'));
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // 8. Envío de Nueva Solicitud a Almacén
    formSolicitudInsumo?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const insumoNombre = document.getElementById('inputInsumoNombre').value.trim();
        const cantidad = parseFloat(document.getElementById('inputCantidad').value);
        const unidad = document.getElementById('inputUnidad').value;
        const prioridad = document.getElementById('inputPrioridad').value;
        const motivo = document.getElementById('inputMotivo').value.trim();

        if (!insumoNombre || isNaN(cantidad) || cantidad <= 0) {
            alert("Por favor completa el nombre del insumo y una cantidad válida.");
            return;
        }

        const btnSubmit = formSolicitudInsumo.querySelector('button[type="submit"]');
        const originalText = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i data-lucide="loader" class="spin"></i> Enviando...`;
        lucide.createIcons();

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/insumos/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cuadrilla: miCuadrilla.id,
                    solicitado_por: currentSupervisorId,
                    insumo_nombre: insumoNombre,
                    cantidad: cantidad,
                    unidad_medida: unidad,
                    prioridad: prioridad,
                    motivo: motivo,
                    estado: 'PENDIENTE'
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Error al enviar el pedido.");
            }

            modal.classList.remove('active');
            alert(`📦 ¡Pedido enviado a Almacén con éxito!\n\nSolicitaste: ${cantidad} ${unidad} de ${insumoNombre}.\nQueda en estado PENDIENTE hasta que Almacén conteste SÍ o NO.`);

            await loadInsumosApp();

        } catch (err) {
            console.error(err);
            alert("Error al enviar solicitud: " + err.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
            lucide.createIcons();
        }
    });

    // Carga inicial
    await loadInsumosApp();
});


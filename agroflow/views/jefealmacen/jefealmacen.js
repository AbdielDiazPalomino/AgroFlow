// agroflow/views/jefealmacen/jefealmacen.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificación de Seguridad y Sesión
    const userRole = localStorage.getItem('agroflow_user_role');
    const userName = localStorage.getItem('agroflow_nombre') || 'Jefe de Almacén';

    if (!userRole || (userRole !== 'JEFE_ALMACEN' && userRole !== 'GERENTE')) {
        alert("Acceso restringido: Esta administración es exclusiva para el Jefe de Almacén.");
        window.location.href = '../login/index.html';
        return;
    }

    // Configuración del perfil en el Topbar
    const topNombre = document.getElementById('topNombre');
    const topAvatar = document.getElementById('topAvatar');
    if (topNombre) topNombre.textContent = userName;
    if (topAvatar) {
        topAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=10B981&color=022c22`;
    }

    // Cerrar sesión
    document.getElementById('btnLogout')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
            localStorage.removeItem('agroflow_user_role');
            localStorage.removeItem('agroflow_username');
            localStorage.removeItem('agroflow_nombre');
            localStorage.removeItem('agroflow_trabajador_id');
            window.location.href = '../login/index.html';
        }
    });

    // 2. Elementos del DOM
    const sidebar = document.getElementById('sidebar');
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const btnRefresh = document.getElementById('btnRefresh');

    const statTotal = document.getElementById('statTotal');
    const statPendientes = document.getElementById('statPendientes');
    const statAprobados = document.getElementById('statAprobados');
    const statRechazados = document.getElementById('statRechazados');
    const badgeTabPendientes = document.getElementById('badgeTabPendientes');

    const tabBtns = document.querySelectorAll('.tab-btn');
    const searchInput = document.getElementById('searchInput');
    const solicitudesCountText = document.getElementById('solicitudesCountText');
    const solicitudesGrid = document.getElementById('solicitudesGrid');

    // Modal de Respuesta
    const modalRespuesta = document.getElementById('modalRespuesta');
    const btnCerrarModalRespuesta = document.getElementById('btnCerrarModalRespuesta');
    const btnCancelarRespuesta = document.getElementById('btnCancelarRespuesta');
    const formRespuestaAlmacen = document.getElementById('formRespuestaAlmacen');
    const modalActionIcon = document.getElementById('modalActionIcon');
    const modalRespuestaTitle = document.getElementById('modalRespuestaTitle');
    const modalRespuestaSub = document.getElementById('modalRespuestaSub');
    const resumenInsumoNombre = document.getElementById('resumenInsumoNombre');
    const resumenCantidad = document.getElementById('resumenCantidad');
    const resumenCuadrilla = document.getElementById('resumenCuadrilla');
    const resumenSupervisor = document.getElementById('resumenSupervisor');
    const resumenMotivo = document.getElementById('resumenMotivo');
    const labelNotaAlmacen = document.getElementById('labelNotaAlmacen');
    const inputNotaAlmacen = document.getElementById('inputNotaAlmacen');
    const btnConfirmarRespuesta = document.getElementById('btnConfirmarRespuesta');
    const btnConfirmarTexto = document.getElementById('btnConfirmarTexto');

    // Manejo de Sidebar en Móvil
    openSidebarBtn?.addEventListener('click', () => sidebar.classList.add('active'));
    closeSidebarBtn?.addEventListener('click', () => sidebar.classList.remove('active'));

    // Estado local
    let todasSolicitudes = [];
    let currentFilter = 'TODOS';
    let searchQuery = '';
    let selectedSolicitud = null;
    let selectedAction = null; // 'APROBADO' o 'RECHAZADO'

    // 3. Cargar Solicitudes desde el Backend Django
    async function loadSolicitudes() {
        try {
            if (btnRefresh) {
                btnRefresh.classList.add('spin');
            }

            const res = await fetch(`${CONFIG.API_BASE_URL}/insumos/`);
            if (!res.ok) throw new Error("No se pudo cargar la lista de solicitudes de insumos.");

            todasSolicitudes = await res.json();

            // Ordenar: primero las pendientes, luego por fecha más reciente
            todasSolicitudes.sort((a, b) => {
                if (a.estado === 'PENDIENTE' && b.estado !== 'PENDIENTE') return -1;
                if (a.estado !== 'PENDIENTE' && b.estado === 'PENDIENTE') return 1;
                return new Date(b.fecha_solicitud || 0) - new Date(a.fecha_solicitud || 0);
            });

            updateStats();
            renderGrid();

        } catch (err) {
            console.error("Error al cargar pedidos:", err);
            solicitudesGrid.innerHTML = `
                <div style="padding: 3rem; text-align: center; color: #EF4444; grid-column: 1 / -1;">
                    <i data-lucide="alert-triangle" style="width: 40px; height: 40px; margin-bottom: 0.5rem;"></i>
                    <p>Error al conectar con el servidor: ${err.message}</p>
                </div>
            `;
            lucide.createIcons();
        } finally {
            if (btnRefresh) {
                setTimeout(() => btnRefresh.classList.remove('spin'), 400);
            }
        }
    }

    // 4. Actualizar Estadísticas
    function updateStats() {
        const total = todasSolicitudes.length;
        const pendientes = todasSolicitudes.filter(s => s.estado === 'PENDIENTE').length;
        const aprobados = todasSolicitudes.filter(s => s.estado === 'APROBADO').length;
        const rechazados = todasSolicitudes.filter(s => s.estado === 'RECHAZADO').length;

        statTotal.textContent = total;
        statPendientes.textContent = pendientes;
        statAprobados.textContent = aprobados;
        statRechazados.textContent = rechazados;

        if (badgeTabPendientes) {
            badgeTabPendientes.textContent = pendientes;
            badgeTabPendientes.style.display = pendientes > 0 ? 'inline-block' : 'none';
        }
    }

    // 5. Renderizar Grid de Solicitudes
    function renderGrid() {
        // Filtrar según pestaña y búsqueda
        let list = todasSolicitudes;

        if (currentFilter !== 'TODOS') {
            list = list.filter(s => s.estado === currentFilter);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(s => 
                (s.insumo_nombre && s.insumo_nombre.toLowerCase().includes(q)) ||
                (s.cuadrilla_nombre && s.cuadrilla_nombre.toLowerCase().includes(q)) ||
                (s.solicitado_por_nombre && s.solicitado_por_nombre.toLowerCase().includes(q)) ||
                (s.motivo && s.motivo.toLowerCase().includes(q))
            );
        }

        solicitudesCountText.textContent = `${list.length} pedidos mostrados`;
        solicitudesGrid.innerHTML = '';

        if (list.length === 0) {
            solicitudesGrid.innerHTML = `
                <div style="padding: 3.5rem 1rem; text-align: center; color: var(--color-text-muted); grid-column: 1 / -1;">
                    <i data-lucide="package-search" style="width: 48px; height: 48px; opacity: 0.35; margin-bottom: 0.75rem;"></i>
                    <p style="font-size: 1rem; font-weight: 600; color: var(--color-text-title);">No hay solicitudes registradas</p>
                    <p style="font-size: 0.8125rem; margin-top: 0.25rem;">No se encontraron pedidos con el filtro actual.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        list.forEach(s => {
            const card = document.createElement('div');

            let statusClass = 'status-pending';
            let pillClass = 'status-pill--pending';
            let badgeText = '🟡 Pendiente';

            if (s.estado === 'APROBADO') {
                statusClass = 'status-approved';
                pillClass = 'status-pill--approved';
                badgeText = '✅ Aprobado (SÍ)';
            } else if (s.estado === 'RECHAZADO') {
                statusClass = 'status-rejected';
                pillClass = 'status-pill--rejected';
                badgeText = '❌ Rechazado (NO)';
            }

            card.className = `solicitud-card-almacen ${statusClass}`;

            const fechaFormat = s.fecha_solicitud 
                ? new Date(s.fecha_solicitud).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Reciente';

            const esUrgente = s.prioridad === 'URGENTE';
            const cuadrillaTxt = s.cuadrilla_nombre || `Cuadrilla #${s.cuadrilla}`;
            const supervisorTxt = s.solicitado_por_nombre || 'Supervisor';

            // Bloque de Acción o Respuesta según estado
            let accionHtml = '';
            if (s.estado === 'PENDIENTE') {
                accionHtml = `
                    <div class="almacen-decision-box">
                        <div class="almacen-decision-header">
                            <span style="font-size: 0.75rem; font-weight: 700; color: #FBBF24; text-transform: uppercase; letter-spacing: 0.5px;">
                                Decisión de Almacén Central
                            </span>
                            <span style="font-size: 0.72rem; color: var(--color-text-muted);">¿Hay existencias?</span>
                        </div>
                        <div class="decision-actions">
                            <button class="btn-action-aprobar" data-id="${s.id}">
                                <i data-lucide="check"></i> Aprobar (SÍ)
                            </button>
                            <button class="btn-action-rechazar" data-id="${s.id}">
                                <i data-lucide="x"></i> Rechazar (NO)
                            </button>
                        </div>
                    </div>
                `;
            } else if (s.estado === 'APROBADO') {
                accionHtml = `
                    <div class="almacen-resolved-box approved">
                        <div class="almacen-resolved-header">
                            <span style="font-size: 0.8125rem; font-weight: 700; color: #10B981; display: flex; align-items: center; gap: 0.35rem;">
                                <i data-lucide="check-circle-2" style="width: 16px; height: 16px;"></i> Entrega Autorizada (SÍ)
                            </span>
                            <span style="font-size: 0.72rem; color: #34D399; font-weight: 500;">Listo en Almacén</span>
                        </div>
                        <p style="font-size: 0.8125rem; color: var(--color-text-title); margin: 0;">
                            ${s.respuesta_almacen || 'Insumo verificado con stock y listo para retiro.'}
                        </p>
                    </div>
                `;
            } else {
                accionHtml = `
                    <div class="almacen-resolved-box rejected">
                        <div class="almacen-resolved-header">
                            <span style="font-size: 0.8125rem; font-weight: 700; color: #EF4444; display: flex; align-items: center; gap: 0.35rem;">
                                <i data-lucide="x-circle" style="width: 16px; height: 16px;"></i> Solicitud Desestimada (NO)
                            </span>
                            <span style="font-size: 0.72rem; color: #F87171; font-weight: 500;">Sin Despacho</span>
                        </div>
                        <p style="font-size: 0.8125rem; color: #F87171; margin: 0;">
                            ${s.respuesta_almacen || 'Sin existencias en almacén central o desestimado.'}
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
                        <span class="status-pill ${pillClass}">${badgeText}</span>
                    </div>

                    <div class="solicitud-card__body mt-4">
                        <div class="solicitud-meta-row">
                            <span class="solicitud-meta-label">
                                <i data-lucide="users" style="width: 14px; height: 14px;"></i> Cuadrilla:
                            </span>
                            <span class="solicitud-meta-val" style="color: var(--color-text-title);">
                                ${cuadrillaTxt}
                            </span>
                        </div>

                        <div class="solicitud-meta-row">
                            <span class="solicitud-meta-label">
                                <i data-lucide="user-check" style="width: 14px; height: 14px;"></i> Solicitado por:
                            </span>
                            <span class="solicitud-meta-val">
                                ${supervisorTxt}
                            </span>
                        </div>

                        <div class="solicitud-meta-row">
                            <span class="solicitud-meta-label">
                                <i data-lucide="scale" style="width: 14px; height: 14px;"></i> Cantidad Requerida:
                            </span>
                            <span class="solicitud-meta-val" style="color: var(--color-primary); font-size: 1rem; font-weight: 700;">
                                ${s.cantidad} ${s.unidad_medida}
                            </span>
                        </div>

                        <div class="solicitud-meta-row">
                            <span class="solicitud-meta-label">
                                <i data-lucide="alert-circle" style="width: 14px; height: 14px;"></i> Prioridad:
                            </span>
                            <span>
                                ${esUrgente 
                                    ? '<span class="priority-tag priority-tag--urgent">URGENTE</span>' 
                                    : '<span class="priority-tag priority-tag--normal">Normal</span>'
                                }
                            </span>
                        </div>

                        <div class="solicitud-motivo mt-3">
                            <strong style="display:block; margin-bottom:0.25rem; color:var(--color-text-title); font-size:0.75rem; text-transform:uppercase;">
                                Motivo en Campo:
                            </strong>
                            ${s.motivo || 'Requerimiento operativo general.'}
                        </div>
                    </div>
                </div>

                ${accionHtml}
            `;

            // Botones de Acción (Aprobar / Rechazar)
            const btnAprobar = card.querySelector('.btn-action-aprobar');
            const btnRechazar = card.querySelector('.btn-action-rechazar');

            btnAprobar?.addEventListener('click', () => openModalRespuesta(s, 'APROBADO'));
            btnRechazar?.addEventListener('click', () => openModalRespuesta(s, 'RECHAZADO'));

            solicitudesGrid.appendChild(card);
        });

        lucide.createIcons();
    }

    // 6. Abrir Modal de Respuesta (SÍ o NO)
    function openModalRespuesta(solicitud, action) {
        selectedSolicitud = solicitud;
        selectedAction = action;

        resumenInsumoNombre.textContent = solicitud.insumo_nombre;
        resumenCantidad.textContent = `${solicitud.cantidad} ${solicitud.unidad_medida}`;
        resumenCuadrilla.textContent = solicitud.cuadrilla_nombre || `Cuadrilla #${solicitud.cuadrilla}`;
        resumenSupervisor.textContent = solicitud.solicitado_por_nombre || 'Supervisor';
        resumenMotivo.textContent = `"${solicitud.motivo || 'Sin detalles adicionales'}"`;

        if (action === 'APROBADO') {
            modalActionIcon.className = 'modal-badge-action-icon aprobar';
            modalActionIcon.innerHTML = '<i data-lucide="check"></i>';
            modalRespuestaTitle.textContent = 'Aprobar Solicitud de Insumo (SÍ)';
            modalRespuestaSub.textContent = 'Autoriza la entrega del material solicitado para retiro en almacén';
            labelNotaAlmacen.textContent = 'Instrucciones de Retiro / Despacho';
            inputNotaAlmacen.value = 'Aprobado por Almacén Central. Pasar a retirar por ventanilla principal con orden de remisión.';
            
            btnConfirmarRespuesta.style.backgroundColor = '#10B981';
            btnConfirmarRespuesta.style.color = '#022c22';
            btnConfirmarTexto.textContent = 'Autorizar Despacho (SÍ)';
        } else {
            modalActionIcon.className = 'modal-badge-action-icon rechazar';
            modalActionIcon.innerHTML = '<i data-lucide="x"></i>';
            modalRespuestaTitle.textContent = 'Rechazar Solicitud de Insumo (NO)';
            modalRespuestaSub.textContent = 'Se notificará al supervisor el motivo de no disponibilidad';
            labelNotaAlmacen.textContent = 'Motivo de Rechazo o No Disponibilidad';
            inputNotaAlmacen.value = 'Sin existencias en almacén central actualmente. Se coordinará reposición con el área de compras.';
            
            btnConfirmarRespuesta.style.backgroundColor = '#EF4444';
            btnConfirmarRespuesta.style.color = '#ffffff';
            btnConfirmarTexto.textContent = 'Denegar Despacho (NO)';
        }

        modalRespuesta.classList.add('active');
        lucide.createIcons();
        inputNotaAlmacen.focus();
    }

    // Cerrar Modal
    function closeModalRespuesta() {
        modalRespuesta.classList.remove('active');
        selectedSolicitud = null;
        selectedAction = null;
    }

    btnCerrarModalRespuesta?.addEventListener('click', closeModalRespuesta);
    btnCancelarRespuesta?.addEventListener('click', closeModalRespuesta);
    modalRespuesta?.addEventListener('click', (e) => {
        if (e.target === modalRespuesta) closeModalRespuesta();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalRespuesta?.classList.contains('active')) {
            closeModalRespuesta();
        }
    });

    // 7. Enviar Respuesta de Almacén al Backend Django
    formRespuestaAlmacen?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedSolicitud || !selectedAction) return;

        const solicitudId = selectedSolicitud.id;
        const insumoNombre = selectedSolicitud.insumo_nombre;
        const cuadrillaNombre = selectedSolicitud.cuadrilla_nombre || selectedSolicitud.cuadrilla;
        const accionEstado = selectedAction;
        const nota = inputNotaAlmacen.value.trim();

        if (!nota) {
            alert("Por favor escribe una nota o justificación para la cuadrilla.");
            return;
        }

        const originalBtnHtml = btnConfirmarRespuesta.innerHTML;
        btnConfirmarRespuesta.disabled = true;
        btnConfirmarRespuesta.innerHTML = `<i data-lucide="loader" class="spin"></i> Procesando...`;
        lucide.createIcons();

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/insumos/${solicitudId}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: accionEstado,
                    respuesta_almacen: nota
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Error al actualizar la solicitud.");
            }

            closeModalRespuesta();

            const textoAccion = accionEstado === 'APROBADO' ? '✅ APROBADO (SÍ)' : '❌ RECHAZADO (NO)';
            alert(`Respuesta registrada con éxito: ${textoAccion}\n\nInsumo: ${insumoNombre}\nCuadrilla: ${cuadrillaNombre}`);

            await loadSolicitudes();

        } catch (err) {
            console.error("Error al registrar respuesta:", err);
            alert("Error: " + err.message);
        } finally {
            btnConfirmarRespuesta.disabled = false;
            btnConfirmarRespuesta.innerHTML = originalBtnHtml;
            lucide.createIcons();
        }
    });

    // 8. Event Listeners de Filtros y Búsqueda
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderGrid();
        });
    });

    searchInput?.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderGrid();
    });

    btnRefresh?.addEventListener('click', () => {
        loadSolicitudes();
    });

    // Carga inicial
    await loadSolicitudes();
});


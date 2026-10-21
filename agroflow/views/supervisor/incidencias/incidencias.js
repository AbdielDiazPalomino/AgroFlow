/* agroflow/views/supervisor/incidencias/incidencias.js */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Control de Rol
    const currentRole = localStorage.getItem('agroflow_user_role');
    if (currentRole && currentRole !== 'SUPERVISOR' && currentRole !== 'GERENTE') {
        window.location.href = '../../../views/login/index.html';
        return;
    }

    // Inicializar Iconos
    lucide.createIcons();

    // 2. Control de Sidebar Móvil
    const sidebar = document.getElementById('sidebar');
    document.getElementById('openSidebar')?.addEventListener('click', () => sidebar.classList.add('active'));
    document.getElementById('closeSidebar')?.addEventListener('click', () => sidebar.classList.remove('active'));

    // 3. Cerrar Sesión
    document.getElementById('btnLogout')?.addEventListener('click', () => {
        localStorage.removeItem('agroflow_user_role');
        localStorage.removeItem('agroflow_user_name');
        localStorage.removeItem('agroflow_user_id');
        localStorage.removeItem('agroflow_user_dni');
    });

    // Estado Local
    let incidencias = [];
    let sectores = [];
    let cuadrillas = [];
    let currentSupervisor = null;
    let currentFilterEstado = 'TODAS';
    let currentFilterTipo = 'TODOS';

    const apiBase = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
        ? CONFIG.API_BASE_URL 
        : 'http://localhost:8000/api';

    // Elementos DOM
    const barSupervisorNombre = document.getElementById('barSupervisorNombre');
    const barCuadrillaNombre = document.getElementById('barCuadrillaNombre');
    const barSectorNombre = document.getElementById('barSectorNombre');
    const topNombre = document.getElementById('topNombre');
    const topAvatar = document.getElementById('topAvatar');

    // Stats
    const statTotal = document.getElementById('statTotal');
    const statCriticas = document.getElementById('statCriticas');
    const statEnProceso = document.getElementById('statEnProceso');
    const statResueltas = document.getElementById('statResueltas');
    const incidenciasCountText = document.getElementById('incidenciasCountText');
    const filterTipo = document.getElementById('filterTipo');

    // Grid y Modal
    const incidenciasGrid = document.getElementById('incidenciasGrid');
    const modalIncidencia = document.getElementById('modalIncidencia');
    const btnNuevaIncidencia = document.getElementById('btnNuevaIncidencia');
    const btnCerrarModal = document.getElementById('btnCerrarModal');
    const btnCancelarModal = document.getElementById('btnCancelarModal');
    const formIncidencia = document.getElementById('formIncidencia');
    const inputSector = document.getElementById('inputSector');
    const btnEnviarIncidencia = document.getElementById('btnEnviarIncidencia');

    // Iniciar
    initApp();

    async function initApp() {
        try {
            await loadUserData();
            await Promise.all([
                loadSectores(),
                loadIncidencias()
            ]);
            setupEvents();
        } catch (err) {
            console.error('Error inicializando módulo de incidencias:', err);
        }
    }

    /**
     * Cargar información del supervisor actual
     */
    async function loadUserData() {
        const storedName = localStorage.getItem('agroflow_user_name');
        const storedId = localStorage.getItem('agroflow_user_id');
        const storedDni = localStorage.getItem('agroflow_user_dni');

        if (storedName) {
            topNombre.textContent = storedName;
            topAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(storedName)}&background=EF4444&color=fff`;
            barSupervisorNombre.textContent = storedName;
        }

        try {
            const res = await fetch(`${apiBase}/supervisores/ubicaciones/`);
            if (res.ok) {
                const supervisores = await res.json();
                if (storedId) {
                    currentSupervisor = supervisores.find(s => String(s.id) === String(storedId));
                }
                if (!currentSupervisor && storedDni) {
                    currentSupervisor = supervisores.find(s => String(s.dni) === String(storedDni));
                }
                if (!currentSupervisor && supervisores.length > 0) {
                    currentSupervisor = supervisores[0];
                }

                if (currentSupervisor) {
                    barSupervisorNombre.textContent = `${currentSupervisor.nombre_completo} (DNI: ${currentSupervisor.dni})`;
                    barCuadrillaNombre.textContent = currentSupervisor.cuadrilla_nombre || 'Sin Cuadrilla Asignada';
                    barSectorNombre.textContent = `Sector: ${currentSupervisor.sector_nombre || 'Sin Sector'} (${currentSupervisor.cultivo_nombre || '-'})`;
                }
            }
        } catch (e) {
            console.warn('No se pudo obtener el perfil de supervisor ampliado:', e);
        }
    }

    /**
     * Cargar sectores para el selector del modal
     */
    async function loadSectores() {
        try {
            const res = await fetch(`${apiBase}/sectores/`);
            if (res.ok) {
                sectores = await res.json();
                inputSector.innerHTML = '<option value="">-- Seleccionar Sector Afectado --</option>' +
                    sectores.map(s => {
                        const cultivoStr = s.cultivo_nombre ? `(${s.cultivo_nombre})` : '';
                        const isSelected = (currentSupervisor && currentSupervisor.sector_id === s.id) ? 'selected' : '';
                        return `<option value="${s.id}" ${isSelected}>${s.nombre} ${cultivoStr}</option>`;
                    }).join('');
            }
        } catch (e) {
            console.error('Error cargando sectores:', e);
            inputSector.innerHTML = '<option value="">Error cargando sectores</option>';
        }
    }

    /**
     * Cargar incidencias desde el backend
     */
    async function loadIncidencias() {
        try {
            const res = await fetch(`${apiBase}/incidencias/`);
            if (res.ok) {
                incidencias = await res.json();
                renderStats();
                renderIncidencias();
            } else {
                incidenciasGrid.innerHTML = `
                    <div style="padding: 3rem; text-align: center; color: var(--color-text-muted); grid-column: 1 / -1;">
                        No se pudieron cargar las incidencias del servidor.
                    </div>
                `;
            }
        } catch (err) {
            console.error('Error cargando incidencias:', err);
            incidenciasGrid.innerHTML = `
                <div style="padding: 3rem; text-align: center; color: #EF4444; grid-column: 1 / -1;">
                    Error de conexión con el backend de AGROFLOW.
                </div>
            `;
        }
    }

    /**
     * Renderizar métricas numéricas
     */
    function renderStats() {
        const total = incidencias.length;
        const criticas = incidencias.filter(i => i.gravedad === 'CRITICA' || i.gravedad === 'ALTA').length;
        const enProceso = incidencias.filter(i => i.estado === 'EN_PROCESO').length;
        const resueltas = incidencias.filter(i => i.estado === 'RESUELTA').length;

        statTotal.textContent = total;
        statCriticas.textContent = criticas;
        statEnProceso.textContent = enProceso;
        statResueltas.textContent = resueltas;
    }

    /**
     * Renderizar tarjetas de incidencias según filtros
     */
    function renderIncidencias() {
        let filtradas = [...incidencias];

        // Filtro por Estado (Tabs)
        if (currentFilterEstado !== 'TODAS') {
            filtradas = filtradas.filter(i => i.estado === currentFilterEstado);
        }

        // Filtro por Tipo (Select)
        if (currentFilterTipo !== 'TODOS') {
            filtradas = filtradas.filter(i => i.tipo === currentFilterTipo);
        }

        incidenciasCountText.textContent = `${filtradas.length} incidencia(s) filtrada(s)`;

        if (filtradas.length === 0) {
            incidenciasGrid.innerHTML = `
                <div style="padding: 3.5rem 1.5rem; text-align: center; color: var(--color-text-muted); grid-column: 1 / -1; background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius-lg);">
                    <i data-lucide="shield-check" style="width: 44px; height: 44px; color: #10B981; margin: 0 auto 0.75rem auto; display: block;"></i>
                    <h3 style="color: var(--color-text-title); font-size: 1.125rem; font-weight: 600; margin-bottom: 0.25rem;">Sin Incidencias en esta categoría</h3>
                    <p style="font-size: 0.875rem;">No hay contingencias reportadas que coincidan con los filtros aplicados.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        incidenciasGrid.innerHTML = filtradas.map(inc => {
            // Badges de Gravedad
            let gravedadPill = '';
            if (inc.gravedad === 'CRITICA') {
                gravedadPill = `<span class="status-pill badge-critica"><i data-lucide="flame"></i> Crítica</span>`;
            } else if (inc.gravedad === 'ALTA') {
                gravedadPill = `<span class="status-pill badge-alta"><i data-lucide="alert-triangle"></i> Alta</span>`;
            } else if (inc.gravedad === 'MEDIA') {
                gravedadPill = `<span class="status-pill badge-media"><i data-lucide="alert-circle"></i> Media</span>`;
            } else {
                gravedadPill = `<span class="status-pill badge-baja"><i data-lucide="info"></i> Baja</span>`;
            }

            // Badges de Estado
            let estadoPill = '';
            if (inc.estado === 'RESUELTA') {
                estadoPill = `<span class="status-pill badge-resuelta"><i data-lucide="check-circle-2"></i> Resuelta</span>`;
            } else if (inc.estado === 'EN_PROCESO') {
                estadoPill = `<span class="status-pill badge-en-proceso"><i data-lucide="clock"></i> En Proceso</span>`;
            } else {
                estadoPill = `<span class="status-pill badge-abierta"><i data-lucide="alert-octagon"></i> Abierta / En Revisión</span>`;
            }

            // Tipo con icono
            const tipoLabel = inc.tipo_display || inc.tipo || 'Operativa';
            const tipoPill = `<span class="status-pill badge-tipo">${escapeHtml(tipoLabel)}</span>`;

            // Fecha formateada
            const fechaObj = new Date(inc.fecha_reporte);
            const tiempoRelativo = formatRelativeTime(fechaObj);

            // Bloque de resolución de Gerencia General (si existe)
            let gerenciaBox = '';
            if (inc.resolucion_gerencia) {
                gerenciaBox = `
                    <div class="gerencia-resolucion-box">
                        <div class="gerencia-resolucion-box__header">
                            <i data-lucide="award"></i> Instrucción de Gerencia General
                        </div>
                        <div class="gerencia-resolucion-box__text">
                            ${escapeHtml(inc.resolucion_gerencia)}
                        </div>
                    </div>
                `;
            }

            // Acción inmediata (si existe)
            let accionHtml = '';
            if (inc.accion_tomada) {
                accionHtml = `
                    <div class="incidencia-card__action">
                        <strong>Acción Inmediata:</strong> ${escapeHtml(inc.accion_tomada)}
                    </div>
                `;
            }

            return `
                <div class="incidencia-card">
                    <div>
                        <div class="incidencia-card__top">
                            <div class="incidencia-card__badges">
                                ${gravedadPill}
                                ${tipoPill}
                            </div>
                            <span class="incidencia-card__time">${tiempoRelativo}</span>
                        </div>

                        <h3 class="incidencia-card__title">${escapeHtml(inc.titulo)}</h3>

                        <div class="incidencia-card__meta">
                            <div>
                                <i data-lucide="map-pin" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; color: #EF4444;"></i>
                                <strong>Sector:</strong> ${escapeHtml(inc.sector_nombre || 'General')} 
                                <span class="text-muted">(${escapeHtml(inc.cultivo_nombre || 'Cultivo')})</span>
                            </div>
                            <div>
                                <i data-lucide="users" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; color: #3B82F6;"></i>
                                <strong>Cuadrilla:</strong> ${escapeHtml(inc.cuadrilla_nombre || 'Sin Cuadrilla')}
                            </div>
                        </div>

                        <p class="incidencia-card__desc">${escapeHtml(inc.descripcion)}</p>

                        ${accionHtml}
                        ${gerenciaBox}
                    </div>

                    <div class="incidencia-card__footer">
                        <div>${estadoPill}</div>
                        <div style="font-size: 0.75rem; color: var(--color-text-muted);">
                            Por: <strong>${escapeHtml(inc.reportado_por_nombre || 'Supervisor')}</strong>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    }

    /**
     * Configuración de eventos de UI y Formulario
     */
    function setupEvents() {
        // Tabs de filtro por estado
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilterEstado = btn.dataset.filter;
                renderIncidencias();
            });
        });

        // Selector de tipo
        filterTipo?.addEventListener('change', (e) => {
            currentFilterTipo = e.target.value;
            renderIncidencias();
        });

        // Abrir y Cerrar Modal
        btnNuevaIncidencia?.addEventListener('click', () => {
            modalIncidencia.classList.add('active');
        });

        const closeModal = () => {
            modalIncidencia.classList.remove('active');
            formIncidencia.reset();
        };

        btnCerrarModal?.addEventListener('click', closeModal);
        btnCancelarModal?.addEventListener('click', closeModal);
        modalIncidencia?.addEventListener('click', (e) => {
            if (e.target === modalIncidencia) closeModal();
        });

        // Envío de Formulario
        formIncidencia?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const titulo = document.getElementById('inputTitulo').value.trim();
            const tipo = document.getElementById('inputTipo').value;
            const gravedad = document.getElementById('inputGravedad').value;
            const sectorVal = document.getElementById('inputSector').value;
            const descripcion = document.getElementById('inputDescripcion').value.trim();
            const accionTomada = document.getElementById('inputAccionTomada').value.trim();

            if (!titulo || !descripcion) {
                alert('Por favor completa el título y la descripción de la incidencia.');
                return;
            }

            const payload = {
                titulo,
                tipo,
                gravedad,
                descripcion,
                accion_tomada: accionTomada || null,
                sector: sectorVal ? parseInt(sectorVal) : (currentSupervisor ? currentSupervisor.sector_id : null),
                cuadrilla: currentSupervisor ? currentSupervisor.cuadrilla_id : null,
                reportado_por: currentSupervisor ? currentSupervisor.id : null,
                estado: 'ABIERTA'
            };

            const originalBtnContent = btnEnviarIncidencia.innerHTML;
            btnEnviarIncidencia.disabled = true;
            btnEnviarIncidencia.innerHTML = `<i data-lucide="loader" class="spinning"></i><span>Registrando...</span>`;
            lucide.createIcons();

            try {
                const response = await fetch(`${apiBase}/incidencias/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'No se pudo guardar la incidencia en el servidor');
                }

                const nuevaIncidencia = await response.json();

                // Cerrar modal y limpiar
                closeModal();

                // Recargar lista
                await loadIncidencias();

                alert(`✅ Incidencia reportada exitosamente con Nivel [${nuevaIncidencia.gravedad}].\n\nHa sido notificada al panel de Gerencia General para evaluación y toma de decisiones.`);

            } catch (err) {
                console.error('Error registrando incidencia:', err);
                alert(`❌ Error al reportar incidencia: ${err.message}`);
            } finally {
                btnEnviarIncidencia.disabled = false;
                btnEnviarIncidencia.innerHTML = originalBtnContent;
                lucide.createIcons();
            }
        });
    }

    /**
     * Utilidades
     */
    function formatRelativeTime(date) {
        if (!date || isNaN(date.getTime())) return '-';
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMin / 60);

        if (diffMin < 1) return 'Hace unos segundos';
        if (diffMin < 60) return `Hace ${diffMin} min`;
        if (diffHours < 24) return `Hoy, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});


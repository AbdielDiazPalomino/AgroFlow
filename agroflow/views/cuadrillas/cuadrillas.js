/* agroflow/views/cuadrillas/cuadrillas.js */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Sidebar Mobile
    const sidebar = document.getElementById('sidebar');
    document.getElementById('openSidebar')?.addEventListener('click', () => sidebar.classList.add('active'));
    document.getElementById('closeSidebar')?.addEventListener('click', () => sidebar.classList.remove('active'));

    // --- DATOS REALES DESDE EL BACKEND ---
    let cuadrillas = [];
    let trabajadores = [];
    let sectores = [];

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
            const [resC, resT, resS] = await Promise.all([
                fetch(`${CONFIG.API_BASE_URL}/cuadrillas/`),
                fetch(`${CONFIG.API_BASE_URL}/trabajadores/`),
                fetch(`${CONFIG.API_BASE_URL}/sectores/`)
            ]);
            
            cuadrillas = await resC.json();
            const trabajadoresRaw = await resT.json();
            sectores = await resS.json();
            
            // Adaptar JSON del backend a la estructura que el UI requiere
            trabajadores = trabajadoresRaw.map(t => ({
                id: t.id.toString(),
                dni: t.dni,
                nombre: `${t.nombres} ${t.apellidos}`,
                img: t.foto_url || `https://ui-avatars.com/api/?name=${t.nombres}+${t.apellidos}&background=random`,
                cuadrillaId: t.cuadrilla // FK integer o null
            }));

            renderGlobalWorkerList(trabajadores);
            populateTargetSelect();
            populateSectoresSelect();
        } catch (error) {
            console.error("Error conectando con Django:", error);
            globalList.innerHTML = `<li style="padding:1rem; color:red;">Error de conexión con el Backend. Verifica tu CONFIG.API_BASE_URL o si runserver está encendido.</li>`;
        }
    }
    
    initApp();

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

    // Buscador interactivo
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = trabajadores.filter(t => t.nombre.toLowerCase().includes(query) || t.dni.includes(query));
        renderGlobalWorkerList(filtered);
    });

    /**
     * Dibuja la lista izquierda de todos los obreros
     */
    function renderGlobalWorkerList(data) {
        globalList.innerHTML = '';
        data.forEach(worker => {
            const crew = cuadrillas.find(c => c.id == worker.cuadrillaId);
            const crewName = crew ? crew.nombre : 'Sin Cuadrilla';

            const li = document.createElement('li');
            li.className = `worker-item ${selectedWorker?.id === worker.id ? 'active' : ''}`;
            li.innerHTML = `
                <img src="${worker.img}" alt="${worker.nombre}">
                <div class="worker-item-info">
                    <span class="worker-item-name">${worker.nombre}</span>
                    <span class="worker-item-crew">${crewName}</span>
                </div>
            `;

            li.addEventListener('click', () => {
                selectWorkerForTransfer(worker, crew);
                // Highlight update
                document.querySelectorAll('.worker-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
            });

            globalList.appendChild(li);
        });
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

        // Actualizar UI del panel origen
        sourceCrewName.textContent = sourceCrew ? sourceCrew.nombre : 'Personal Sin Asignar';
        
        // Habilitar controles y alerta
        transferFooter.style.opacity = '1';
        transferFooter.style.pointerEvents = 'auto';
        
        // Si es un traslado (ya tenía cuadrilla), mostramos alerta legal. Si es nuevo, no es necesario.
        legalAlert.style.display = sourceCrew ? 'flex' : 'none';
        document.getElementById('btnReasignar').textContent = sourceCrew ? 'Reasignar' : 'Asignar a Cuadrilla';

        // Auto-seleccionar otra cuadrilla por defecto en el destino
        const otherCrew = cuadrillas.find(c => c.id != selectedSourceCrewId);
        if(otherCrew) {
            targetCrewSelect.value = otherCrew.id;
            renderTargetCrew(otherCrew.id);
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
            workers = trabajadores.filter(t => t.cuadrillaId == crewId);
            sourceCrewCount.textContent = `${workers.length} personas`;
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
        const workers = trabajadores.filter(t => t.cuadrillaId == crewId);
        targetCrewCount.textContent = `${workers.length} personas`;
        
        targetWorkerList.innerHTML = '';
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

    // Acción: Reasignar
    btnReasignar.addEventListener('click', async () => {
        if(!selectedWorker) return;
        const targetId = targetCrewSelect.value;
        const motivo = document.getElementById('transferReason').value;
        
        if(targetId == selectedWorker.cuadrillaId) {
            alert('El trabajador ya está en esta cuadrilla.');
            return;
        }

        if(!motivo) {
            alert('Por favor, ingresa el motivo del cambio para el registro legal.');
            return;
        }

        const originalText = btnReasignar.innerHTML;
        btnReasignar.innerHTML = `<i data-lucide="loader" class="spin"></i> Procesando...`;
        btnReasignar.disabled = true;
        lucide.createIcons();

        try {
            // POST a la API de Django REST Framework
            const response = await fetch(`${CONFIG.API_BASE_URL}/traslados/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    trabajador: parseInt(selectedWorker.id),
                    cuadrilla_origen: selectedWorker.cuadrillaId ? parseInt(selectedWorker.cuadrillaId) : null,
                    cuadrilla_destino: parseInt(targetId),
                    motivo: motivo,
                    estado: 'PENDIENTE'
                })
            });

            if (!response.ok) throw new Error('Error al enviar la solicitud');

            alert(`✅ Solicitud enviada a ${selectedWorker.nombre} de forma oficial en la Base de Datos.\nEsperando su confirmación biométrica desde el App del Obrero.`);
            
            // Si estuviéramos conectando websockets, aquí el UI se bloquearía esperando.
            // Por ahora recargamos los datos para tener la versión fresca del servidor.
            await initApp();
            
            // Restablecer UI
            document.getElementById('transferReason').value = '';
            btnCancelar.click(); // Disparamos cancelar para limpiar la selección visual

        } catch(error) {
            console.error(error);
            alert("❌ Ocurrió un error al contactar con el servidor. Verifica tu CONFIG.API_BASE_URL o que runserver esté activo.");
        } finally {
            btnReasignar.innerHTML = originalText;
            btnReasignar.disabled = false;
        }
    });

    btnCancelar.addEventListener('click', () => {
        selectedWorker = null;
        transferFooter.style.opacity = '0.5';
        transferFooter.style.pointerEvents = 'none';
        legalAlert.style.display = 'none';
        
        sourceWorkerList.innerHTML = '<div class="empty-state-small">Selecciona un obrero de la lista izquierda para iniciar reasignación.</div>';
        targetWorkerList.innerHTML = '';
        sourceCrewName.textContent = 'Cuadrilla Origen';
        sourceCrewCount.textContent = '0 personas';
        targetCrewCount.textContent = '0 personas';
        
        document.querySelectorAll('.worker-item').forEach(el => el.classList.remove('active'));
    });

    // ==========================================
    // AGREGAR NUEVO TRABAJADOR
    // ==========================================
    const modalAdd = document.getElementById('modalAgregarTrabajador');
    const btnOpenModal = document.getElementById('btnAgregarTrabajador');
    const btnCloseModal = document.getElementById('btnCerrarModal');
    const formAdd = document.getElementById('formAgregarTrabajador');

    if(btnOpenModal && modalAdd) {
        btnOpenModal.addEventListener('click', () => {
            modalAdd.style.display = 'flex';
        });

        btnCloseModal.addEventListener('click', () => {
            modalAdd.style.display = 'none';
        });

        formAdd.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombres = document.getElementById('addNombres').value;
            const apellidos = document.getElementById('addApellidos').value;
            const dni = document.getElementById('addDni').value;
            
            const submitBtn = formAdd.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Guardando...';

            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/trabajadores/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        nombres: nombres,
                        apellidos: apellidos,
                        dni: dni,
                        // Un nuevo trabajador no tiene cuadrilla al inicio
                        cuadrilla: null 
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(JSON.stringify(err));
                }

                alert(`✅ ${nombres} registrado correctamente en la Base de Datos.`);
                
                // Cerrar modal y limpiar
                formAdd.reset();
                modalAdd.style.display = 'none';
                
                // Recargar lista global para ver al nuevo trabajador sin cuadrilla
                await initApp();

            } catch(error) {
                console.error("Error al guardar:", error);
                alert("❌ Ocurrió un error al guardar el trabajador. Verifica la consola.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    // ==========================================
    // AGREGAR NUEVA CUADRILLA
    // ==========================================
    const modalAddCuadrilla = document.getElementById('modalAgregarCuadrilla');
    const btnOpenModalCuadrilla = document.getElementById('btnAgregarCuadrilla');
    const btnCloseModalCuadrilla = document.getElementById('btnCerrarModalCuadrilla');
    const formAddCuadrilla = document.getElementById('formAgregarCuadrilla');

    if(btnOpenModalCuadrilla && modalAddCuadrilla) {
        btnOpenModalCuadrilla.addEventListener('click', () => {
            modalAddCuadrilla.style.display = 'flex';
        });

        btnCloseModalCuadrilla.addEventListener('click', () => {
            modalAddCuadrilla.style.display = 'none';
        });

        formAddCuadrilla.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('addCuadrillaNombre').value;
            const tipo = document.getElementById('addCuadrillaTipo').value;
            const sectorId = document.getElementById('addCuadrillaSector').value;
            
            const submitBtn = formAddCuadrilla.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Guardando...';

            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/cuadrillas/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        nombre: nombre,
                        tipo: tipo,
                        sector_asignado: sectorId ? parseInt(sectorId) : null,
                        supervisor: null
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(JSON.stringify(err));
                }

                alert(`✅ Cuadrilla '${nombre}' registrada correctamente en la Base de Datos.`);
                
                // Cerrar modal y limpiar
                formAddCuadrilla.reset();
                modalAddCuadrilla.style.display = 'none';
                
                // Recargar lista global para ver la nueva cuadrilla
                await initApp();

            } catch(error) {
                console.error("Error al guardar:", error);
                alert("❌ Ocurrió un error al guardar la Cuadrilla. Verifica la consola.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

});

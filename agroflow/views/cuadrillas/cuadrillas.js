/* agroflow/views/cuadrillas/cuadrillas.js */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // --- MOCK DATA ---
    const cuadrillas = [
        { id: 'C1', nombre: 'Cuadrilla Cosecha Naranja', sector: 'Sector Norte 1' },
        { id: 'C2', nombre: 'Cuadrilla Podado', sector: 'Sector Este 1' },
        { id: 'C3', nombre: 'Cuadrilla Riego Norte', sector: 'Sector Central' },
        { id: 'C4', nombre: 'Cuadrilla Cosecha Norte', sector: 'Sector Oeste 1' }
    ];

    const trabajadores = [
        { id: '10503419', nombre: 'Juan García', img: 'https://i.pravatar.cc/150?u=1', cuadrillaId: 'C1' },
        { id: '10501203', nombre: 'Rorfin Secharz', img: 'https://i.pravatar.cc/150?u=2', cuadrillaId: 'C1' },
        { id: '10507014', nombre: 'Jusen Merraez', img: 'https://i.pravatar.cc/150?u=3', cuadrillaId: 'C2' },
        { id: '10502036', nombre: 'Maria Vinton', img: 'https://i.pravatar.cc/150?u=4', cuadrillaId: 'C1' },
        { id: '10507523', nombre: 'Reshros Rianaji', img: 'https://i.pravatar.cc/150?u=5', cuadrillaId: 'C1' },
        { id: '10501703', nombre: 'Jennica Morter', img: 'https://i.pravatar.cc/150?u=6', cuadrillaId: 'C3' },
        { id: '10504422', nombre: 'Carlos Domínguez', img: 'https://i.pravatar.cc/150?u=7', cuadrillaId: 'C4' },
        { id: '10508811', nombre: 'Ana Ruiz', img: 'https://i.pravatar.cc/150?u=8', cuadrillaId: 'C2' }
    ];

    // Variables de estado
    let selectedWorker = null;
    let selectedSourceCrewId = null;
    
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

    // Inicialización
    renderGlobalWorkerList(trabajadores);
    populateTargetSelect();

    // Buscador interactivo
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = trabajadores.filter(t => t.nombre.toLowerCase().includes(query) || t.id.includes(query));
        renderGlobalWorkerList(filtered);
    });

    /**
     * Dibuja la lista izquierda de todos los obreros
     */
    function renderGlobalWorkerList(data) {
        globalList.innerHTML = '';
        data.forEach(worker => {
            const crew = cuadrillas.find(c => c.id === worker.cuadrillaId);
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
        selectedSourceCrewId = sourceCrew.id;

        // Actualizar UI del panel origen
        sourceCrewName.textContent = sourceCrew.nombre;
        
        // Habilitar controles y alerta
        transferFooter.style.opacity = '1';
        transferFooter.style.pointerEvents = 'auto';
        legalAlert.style.display = 'flex';

        // Auto-seleccionar otra cuadrilla por defecto en el destino
        const otherCrew = cuadrillas.find(c => c.id !== sourceCrew.id);
        if(otherCrew) {
            targetCrewSelect.value = otherCrew.id;
            renderTargetCrew(otherCrew.id);
        }

        renderSourceCrew(sourceCrew.id, worker.id);
    }

    /**
     * Dibuja la cuadrilla origen, resaltando al trabajador a transferir
     */
    function renderSourceCrew(crewId, highlightWorkerId) {
        const workers = trabajadores.filter(t => t.cuadrillaId === crewId);
        sourceCrewCount.textContent = `${workers.length} personas`;
        
        sourceWorkerList.innerHTML = '';
        workers.forEach(w => {
            const isHighlight = w.id === highlightWorkerId;
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
            // Asegurarse de que el seleccionado esté arriba (simulando que lo agarramos)
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
        const workers = trabajadores.filter(t => t.cuadrillaId === crewId);
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
    btnReasignar.addEventListener('click', () => {
        if(!selectedWorker) return;
        const targetId = targetCrewSelect.value;
        const motivo = document.getElementById('transferReason').value;
        
        if(targetId === selectedWorker.cuadrillaId) {
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

        // Simular latencia y "cambio" a estado Pendiente
        setTimeout(() => {
            alert(`✅ Solicitud enviada a ${selectedWorker.nombre}.\nEsperando su confirmación biométrica desde el App del Obrero.`);
            
            // Restablecer UI
            btnReasignar.innerHTML = originalText;
            btnReasignar.disabled = false;
            document.getElementById('transferReason').value = '';
            
            // En un sistema real, el trabajador pasaría a un estado de "Traslado Pendiente"
            // Por ahora, refrescamos la lista global
            renderGlobalWorkerList(trabajadores);
        }, 1200);
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

});

/* agroflow/views/cuadrillas/cuadrillas.js */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Sidebar Mobile
    const sidebar = document.getElementById('sidebar');
    document.getElementById('openSidebar')?.addEventListener('click', () => sidebar.classList.add('active'));
    document.getElementById('closeSidebar')?.addEventListener('click', () => sidebar.classList.remove('active'));

    // --- MOCK DATA ---
    // Cuadrillas asignadas a sectores
    const cuadrillas = [
        { id: 'C1', nombre: 'Cuadrilla Alfa', sector: 'Sector Norte 1', supervisor: 'Juan Pérez' },
        { id: 'C2', nombre: 'Cuadrilla Beta', sector: 'Sector Este 1', supervisor: 'María López' },
        { id: 'C3', nombre: 'Cuadrilla Gamma', sector: 'Sector Central', supervisor: 'Carlos Ruiz' }
    ];

    // Personal (Obreros)
    // estadoTraslado: 'ninguno' | 'pendiente'
    let trabajadores = [
        { id: 'T1', nombre: 'José Mamani', dni: '71234567', cuadrillaId: 'C1', estadoTraslado: 'ninguno' },
        { id: 'T2', nombre: 'Ana Condori', dni: '76543210', cuadrillaId: 'C1', estadoTraslado: 'ninguno' },
        { id: 'T3', nombre: 'Luis Quispe', dni: '78901234', cuadrillaId: 'C1', estadoTraslado: 'ninguno' },
        { id: 'T4', nombre: 'Rosa Flores', dni: '70112233', cuadrillaId: 'C2', estadoTraslado: 'ninguno' },
        { id: 'T5', nombre: 'Miguel Vargas', dni: '75445566', cuadrillaId: 'C2', estadoTraslado: 'ninguno' }
    ];

    let currentCuadrillaId = null;
    let workerToTransfer = null;

    // --- INICIALIZACIÓN ---
    renderCrewList();
    populateTransferSelect();

    // Lógica del Modal de Traslado
    const modal = document.getElementById('transferModal');
    document.getElementById('closeTransferModal')?.addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('cancelTransfer')?.addEventListener('click', () => modal.classList.remove('active'));
    
    // Confirmar Traslado
    document.getElementById('confirmTransfer')?.addEventListener('click', () => {
        if(!workerToTransfer) return;
        
        const targetCrewId = document.getElementById('transferTargetCrew').value;
        if(targetCrewId === workerToTransfer.cuadrillaId) {
            alert("El trabajador ya pertenece a esta cuadrilla.");
            return;
        }

        // SIMULACIÓN DE LÓGICA DE NEGOCIO:
        // No cambiamos su cuadrillaId directamente. Lo marcamos como "pendiente".
        // El Obrero en su app móvil tendrá que aceptar con biometría.
        const workerIndex = trabajadores.findIndex(t => t.id === workerToTransfer.id);
        if(workerIndex !== -1) {
            trabajadores[workerIndex].estadoTraslado = 'pendiente';
            // Refrescar UI
            renderWorkersGrid(currentCuadrillaId);
        }

        modal.classList.remove('active');
        // Usar setTimeout para simular que sale de la pila de eventos
        setTimeout(() => {
            alert(`Solicitud de traslado enviada a ${workerToTransfer.nombre}.\nEsperando validación biométrica del trabajador (WebAuthn / Huella) en su dispositivo.`);
        }, 300);
    });

    /**
     * Renderiza la lista izquierda de cuadrillas
     */
    function renderCrewList() {
        const list = document.getElementById('crewList');
        list.innerHTML = '';

        cuadrillas.forEach(crew => {
            // Contar obreros
            const count = trabajadores.filter(t => t.cuadrillaId === crew.id).length;

            const li = document.createElement('li');
            li.className = 'crew-item';
            li.innerHTML = `
                <div class="crew-item__header">
                    <span class="crew-item__title">${crew.nombre}</span>
                    <span class="badge badge--neutral">${count} <i data-lucide="users" style="width:10px; height:10px; margin-left:2px;"></i></span>
                </div>
                <div class="crew-item__meta">
                    <i data-lucide="map-pin"></i> ${crew.sector}
                </div>
                <div class="crew-item__meta" style="margin-top: 4px;">
                    <i data-lucide="user-check"></i> Sup: ${crew.supervisor}
                </div>
            `;

            li.addEventListener('click', () => {
                // Quitar active de todos
                document.querySelectorAll('.crew-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                
                currentCuadrillaId = crew.id;
                document.getElementById('selectedCrewTitle').textContent = crew.nombre;
                document.getElementById('selectedCrewSector').innerHTML = `<i data-lucide="map-pin"></i> ${crew.sector}`;
                
                renderWorkersGrid(crew.id);
                lucide.createIcons();
            });

            list.appendChild(li);
        });
        lucide.createIcons();
    }

    /**
     * Renderiza el grid derecho con los trabajadores de una cuadrilla
     */
    function renderWorkersGrid(crewId) {
        const grid = document.getElementById('workersGrid');
        grid.innerHTML = '';

        const crewWorkers = trabajadores.filter(t => t.cuadrillaId === crewId);

        if(crewWorkers.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                  <i data-lucide="inbox"></i>
                  <p>No hay personal asignado a esta cuadrilla.</p>
                </div>`;
            return;
        }

        crewWorkers.forEach(worker => {
            const isPending = worker.estadoTraslado === 'pendiente';
            const card = document.createElement('div');
            card.className = `worker-card ${isPending ? 'is-pending' : ''}`;
            
            card.innerHTML = `
                <div class="worker-info">
                    <img src="https://ui-avatars.com/api/?name=${worker.nombre.replace(' ', '+')}&background=random" class="worker-avatar">
                    <div class="worker-details">
                        <span class="worker-name">${worker.nombre}</span>
                        <span class="worker-dni">DNI: ${worker.dni}</span>
                    </div>
                </div>
                <div class="worker-actions">
                    <button class="btn btn--outline" ${isPending ? 'disabled' : ''} onclick="initiateTransfer('${worker.id}')">
                        <i data-lucide="arrow-right-left"></i> Trasladar
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });

        lucide.createIcons();
    }

    /**
     * Llena el select del modal con las cuadrillas disponibles
     */
    function populateTransferSelect() {
        const select = document.getElementById('transferTargetCrew');
        select.innerHTML = '';
        cuadrillas.forEach(crew => {
            const opt = document.createElement('option');
            opt.value = crew.id;
            opt.textContent = `${crew.nombre} (${crew.sector})`;
            select.appendChild(opt);
        });
    }

    // Exponer la función al window para poder llamarla desde el onclick del HTML
    window.initiateTransfer = function(workerId) {
        workerToTransfer = trabajadores.find(t => t.id === workerId);
        if(!workerToTransfer) return;

        document.getElementById('transferWorkerName').textContent = workerToTransfer.nombre;
        
        // Quitar del select la cuadrilla actual
        const select = document.getElementById('transferTargetCrew');
        Array.from(select.options).forEach(opt => {
            opt.disabled = (opt.value === workerToTransfer.cuadrillaId);
        });
        
        modal.classList.add('active');
    };
});


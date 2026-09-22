/* agroflow/views/dashboard/dashboard.js */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Iniciar Iconos
    lucide.createIcons();

    // 2. Control del Sidebar (Mobile)
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('openSidebar');
    const closeBtn = document.getElementById('closeSidebar');

    if (openBtn && sidebar) {
        openBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
        });
    }

    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }

    // 3. MOCK DATA (Simulación de Base de Datos para el Frontend)
    // Cuando se conecte a Django, esto vendrá de un fetch('/api/sectores/')
    const mockSectores = [
        {
            id: 1,
            nombre: "Sector Norte A-1",
            cultivo: "Arándanos",
            hectareas: 12.5,
            estado: "optimo", // optimo, riego, alerta
            trabajadores: 24,
            posicion: { top: '25%', left: '30%' } // Posición visual en el mapa mock
        },
        {
            id: 2,
            nombre: "Sector Este B-3",
            cultivo: "Arándanos",
            hectareas: 8.0,
            estado: "riego",
            trabajadores: 0,
            posicion: { top: '45%', left: '60%' }
        },
        {
            id: 3,
            nombre: "Sector Sur C-2",
            cultivo: "Paltas",
            hectareas: 22.4,
            estado: "optimo",
            trabajadores: 45,
            posicion: { top: '70%', left: '40%' }
        },
        {
            id: 4,
            nombre: "Invernadero Principal",
            cultivo: "Plantines",
            hectareas: 2.0,
            estado: "alerta", // ej: humedad baja
            trabajadores: 5,
            posicion: { top: '35%', left: '75%' }
        },
        {
            id: 5,
            nombre: "Sector Oeste A-2",
            cultivo: "Arándanos",
            hectareas: 10.0,
            estado: "optimo",
            trabajadores: 12,
            posicion: { top: '60%', left: '20%' }
        }
    ];

    // 4. Renderizado Dinámico de Datos (Vanilla JS)
    renderMapPins(mockSectores);
    renderSectorList(mockSectores);
    
    // Actualizar un KPI dinámicamente
    document.getElementById('totalSectoresList').textContent = mockSectores.length;

});

/**
 * Función para inyectar pines en el mapa visual
 */
function renderMapPins(sectores) {
    const mapContainer = document.getElementById('mockMap');
    if (!mapContainer) return;

    sectores.forEach(sector => {
        // Determinar estilo según estado
        let colorClass = '';
        let icon = 'leaf';
        
        if (sector.estado === 'riego') {
            colorClass = 'map-pin--riego';
            icon = 'droplet';
        } else if (sector.estado === 'alerta') {
            colorClass = 'map-pin--alerta';
            icon = 'alert-triangle';
        }

        const pin = document.createElement('div');
        pin.className = `map-pin ${colorClass}`;
        pin.style.top = sector.posicion.top;
        pin.style.left = sector.posicion.left;
        
        pin.innerHTML = `
            <i data-lucide="${icon}"></i>
            ${sector.nombre}
        `;
        
        // Agregar interactividad de prueba
        pin.addEventListener('click', () => {
            alert(`Detalles del ${sector.nombre}:\nCultivo: ${sector.cultivo}\nHectáreas: ${sector.hectareas} ha\nTrabajadores activos: ${sector.trabajadores}`);
        });

        mapContainer.appendChild(pin);
    });
}

/**
 * Función para crear la lista lateral de sectores
 */
function renderSectorList(sectores) {
    const listContainer = document.getElementById('sectorList');
    if (!listContainer) return;

    sectores.forEach(sector => {
        // Badge HTML según estado
        let badgeHtml = '';
        if (sector.estado === 'optimo') {
            badgeHtml = `<span class="status-badge status-badge--ok"><i data-lucide="check-circle"></i> Óptimo</span>`;
        } else if (sector.estado === 'riego') {
            badgeHtml = `<span class="status-badge status-badge--riego"><i data-lucide="droplet"></i> En Riego</span>`;
        } else if (sector.estado === 'alerta') {
            badgeHtml = `<span class="status-badge status-badge--alerta"><i data-lucide="alert-triangle"></i> Revisar</span>`;
        }

        const item = document.createElement('div');
        item.className = 'sector-item';
        
        item.innerHTML = `
            <div class="sector-item__info">
                <span class="sector-item__name">${sector.nombre}</span>
                <span class="sector-item__meta">
                    <i data-lucide="sprout" style="width:12px;height:12px"></i> ${sector.cultivo} • ${sector.hectareas} ha
                </span>
            </div>
            <div class="sector-item__status">
                ${badgeHtml}
            </div>
        `;

        listContainer.appendChild(item);
    });
}

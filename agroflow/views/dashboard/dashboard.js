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

    // 3. MOCK DATA (Simulación de la API)
    // Coordenadas base: Fundo Corporación Roots SAC
    const baseLat = -14.030357850520657;
    const baseLng = -75.73223536541536;

    const mockSectores = [
        {
            id: 1,
            nombre: "Sector Norte 1",
            cultivo: "SUNFLOWER",
            hectareas: 25.5,
            estado: "optimo",
            trabajadores: 45,
            bounds: [[baseLat + 0.001, baseLng - 0.003], [baseLat + 0.005, baseLng + 0.002]]
        },
        {
            id: 2,
            nombre: "Sector Este 1",
            cultivo: "GYPSOPHILA TANGO",
            hectareas: 18.2,
            estado: "riego",
            trabajadores: 12,
            bounds: [[baseLat - 0.001, baseLng + 0.0025], [baseLat + 0.005, baseLng + 0.0055]]
        },
        {
            id: 3,
            nombre: "Sector Sur 1",
            cultivo: "LISIANTHUS MARIACHI",
            hectareas: 12.0,
            estado: "optimo",
            trabajadores: 30,
            bounds: [[baseLat - 0.005, baseLng - 0.003], [baseLat - 0.0015, baseLng + 0.002]]
        },
        {
            id: 4,
            nombre: "Sector Oeste 1",
            cultivo: "WAXFLOWER",
            hectareas: 10.5,
            estado: "alerta", // ej: plaga o riego fallido
            trabajadores: 8,
            bounds: [[baseLat - 0.004, baseLng - 0.006], [baseLat + 0.0008, baseLng - 0.0035]]
        },
        {
            id: 5,
            nombre: "Sector Central",
            cultivo: "PROTEAS / PINK ICE",
            hectareas: 5.4,
            estado: "optimo",
            trabajadores: 15,
            bounds: [[baseLat - 0.001, baseLng - 0.003], [baseLat + 0.0008, baseLng + 0.002]]
        },
        {
            id: 6,
            nombre: "Sector Noroeste",
            cultivo: "LIMONIUM HYBRIDS",
            hectareas: 8.8,
            estado: "optimo",
            trabajadores: 20,
            bounds: [[baseLat + 0.001, baseLng - 0.006], [baseLat + 0.005, baseLng - 0.0035]]
        },
        {
            id: 7,
            nombre: "Invernadero A",
            cultivo: "ASTER MATSUMOTO",
            hectareas: 2.1,
            estado: "riego",
            trabajadores: 5,
            bounds: [[baseLat - 0.001, baseLng + 0.006], [baseLat + 0.001, baseLng + 0.007]]
        },
        {
            id: 8,
            nombre: "Invernadero B",
            cultivo: "BRASSICA (FLOWERING KALE)",
            hectareas: 3.0,
            estado: "optimo",
            trabajadores: 6,
            bounds: [[baseLat + 0.0015, baseLng + 0.006], [baseLat + 0.004, baseLng + 0.007]]
        }
    ];

    // 4. Inicializar Mapa de Leaflet
    const map = L.map('sectorMap').setView([baseLat, baseLng], 15);
    
    // Usar Esri World Imagery (Satélite) ideal para agricultura
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 18
    }).addTo(map);

    // 5. Renderizar Polígonos y Lista
    renderSectorsOnMap(map, mockSectores);
    renderSectorList(mockSectores);
    document.getElementById('totalSectoresList').textContent = mockSectores.length;

    // 6. Lógica del Modal
    const modal = document.getElementById('sectorModal');
    const closeModalBtn = document.getElementById('closeModal');

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    // Cerrar al hacer clic fuera del modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

/**
 * Función para abrir el modal con los datos del sector
 */
function openSectorModal(sector) {
    document.getElementById('modalTitle').textContent = sector.nombre;
    document.getElementById('modalCultivo').textContent = sector.cultivo;
    document.getElementById('modalArea').textContent = `${sector.hectareas} ha`;
    
    let estadoTexto = sector.estado.charAt(0).toUpperCase() + sector.estado.slice(1);
    if(sector.estado === 'optimo') estadoTexto = 'Óptimo';
    document.getElementById('modalEstado').textContent = estadoTexto;
    
    document.getElementById('modalTrabajadores').textContent = sector.trabajadores;
    
    document.getElementById('sectorModal').classList.add('active');
}

/**
 * Función para inyectar polígonos en Leaflet
 */
function renderSectorsOnMap(map, sectores) {
    sectores.forEach(sector => {
        // Colores según el estado
        let fillColor = '#10B981'; // Óptimo
        if (sector.estado === 'riego') fillColor = '#3B82F6';
        if (sector.estado === 'alerta') fillColor = '#F59E0B';

        // Crear polígono (rectángulo por ahora basado en bounds)
        const rectangle = L.rectangle(sector.bounds, {
            color: fillColor,
            weight: 2,
            fillColor: fillColor,
            fillOpacity: 0.4
        }).addTo(map);

        // Añadir Tooltip (hover)
        rectangle.bindTooltip(sector.nombre, { permanent: false, direction: 'center' });

        // Evento Click para abrir el modal
        rectangle.on('click', () => {
            openSectorModal(sector);
            // Centrar el mapa sutilmente
            map.flyToBounds(sector.bounds, { padding: [50, 50], duration: 0.5 });
        });
    });
}

/**
 * Función para crear la lista lateral de sectores
 */
function renderSectorList(sectores) {
    const listContainer = document.getElementById('sectorList');
    if (!listContainer) return;

    sectores.forEach(sector => {
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
        
        // Al dar clic en la lista, abrir modal también
        item.addEventListener('click', () => {
            openSectorModal(sector);
        });

        listContainer.appendChild(item);
    });
}


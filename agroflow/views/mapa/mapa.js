/* agroflow/views/mapa/mapa.js */

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

    // 3. DATOS DE LA API
    let sectores = [];
    let cultivos = [];

    // Coordenadas base: Fundo Corporación Roots SAC
    const baseLat = -14.030357;
    const baseLng = -75.732235;

    // 4. Inicializar Mapa de Leaflet
    const map = L.map('sectorMap', {
        zoomControl: false // Ocultar controles por defecto
    }).setView([baseLat, baseLng], 15);
    
    // Capas base (Tiles)
    const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri',
        maxZoom: 18
    });
    
    const osmStreet = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18
    });

    esriSatellite.addTo(map);
    let isSatellite = true;

    // Controles personalizados del mapa
    document.getElementById('btnZoomIn')?.addEventListener('click', () => map.zoomIn());
    document.getElementById('btnZoomOut')?.addEventListener('click', () => map.zoomOut());
    
    document.getElementById('btnToggleLayer')?.addEventListener('click', () => {
        if (isSatellite) {
            map.removeLayer(esriSatellite);
            osmStreet.addTo(map);
        } else {
            map.removeLayer(osmStreet);
            esriSatellite.addTo(map);
        }
        isSatellite = !isSatellite;
    });

    setTimeout(() => {
        map.invalidateSize();
    }, 200);

    // ==========================================
    // CARGAR DATOS DESDE EL BACKEND
    // ==========================================
    async function loadData() {
        try {
            const [resS, resC] = await Promise.all([
                fetch(`${CONFIG.API_BASE_URL}/sectores/`),
                fetch(`${CONFIG.API_BASE_URL}/cultivos/`)
            ]);
            sectores = await resS.json();
            cultivos = await resC.json();

            // Limpiar Mapa de capas previas (excepto el tileLayer)
            map.eachLayer((layer) => {
                if (layer instanceof L.Circle || layer instanceof L.Rectangle) {
                    map.removeLayer(layer);
                }
            });

            renderSectorsOnMap(map, sectores, cultivos);
            renderSectorList(sectores, cultivos);
            
            const totalSectoresEl = document.getElementById('totalSectoresList');
            if(totalSectoresEl) totalSectoresEl.textContent = sectores.length;

            populateCultivosSelect();
        } catch (error) {
            console.error("Error al cargar datos:", error);
        }
    }

    loadData();

    // ==========================================
    // MODAL: INFO DE SECTOR EXISTENTE
    // ==========================================
    const modal = document.getElementById('sectorModal');
    const closeModalBtn = document.getElementById('closeModal');

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // ==========================================
    // MODAL: NUEVO SECTOR
    // ==========================================
    const modalAgregarSector = document.getElementById('modalAgregarSector');
    const btnAgregarSector = document.getElementById('btnAgregarSector');
    const btnCerrarModalSector = document.getElementById('btnCerrarModalSector');
    const formAgregarSector = document.getElementById('formAgregarSector');

    let currentOpenedSectorId = null; // Guardará el ID del sector abierto en el modal de detalle

    if(btnAgregarSector && modalAgregarSector) {
        btnAgregarSector.addEventListener('click', () => {
            document.getElementById('formSectorTitle').textContent = 'Nuevo Sector Agrícola';
            formAgregarSector.reset();
            document.getElementById('addSectorId').value = '';
            modalAgregarSector.classList.add('active');
        });

        btnCerrarModalSector.addEventListener('click', () => {
            modalAgregarSector.classList.remove('active');
        });

        formAgregarSector.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const sectorId = document.getElementById('addSectorId').value;
            const nombre = document.getElementById('addSectorNombre').value;
            const coordsText = document.getElementById('addSectorCoords').value;
            const area = document.getElementById('addSectorArea').value;
            const cultivoId = document.getElementById('addSectorCultivo').value;

            // Parsear textarea a array de coordenadas
            let coordenadasArray = [];
            if(coordsText) {
                const lines = coordsText.split('\n');
                lines.forEach(line => {
                    if(line.trim()) {
                        const parts = line.split(',');
                        if(parts.length >= 2) {
                            coordenadasArray.push([parseFloat(parts[0].trim()), parseFloat(parts[1].trim())]);
                        }
                    }
                });
            }

            const submitBtn = formAgregarSector.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Guardando...';

            const payload = {
                nombre: nombre,
                coordenadas_poligono: JSON.stringify(coordenadasArray),
                area_hectareas: parseFloat(area),
                cultivo: cultivoId ? parseInt(cultivoId) : null,
                estado: 'ACTIVO' // TODO: se podría permitir editar estado también
            };

            try {
                const method = sectorId ? 'PUT' : 'POST';
                const url = sectorId 
                    ? `${CONFIG.API_BASE_URL}/sectores/${sectorId}/` 
                    : `${CONFIG.API_BASE_URL}/sectores/`;

                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error('Error guardando el sector');

                alert(`✅ Sector '${nombre}' ${sectorId ? 'actualizado' : 'creado'} correctamente.`);
                formAgregarSector.reset();
                modalAgregarSector.classList.remove('active');
                
                await loadData();

            } catch (err) {
                console.error(err);
                alert("❌ Error al guardar el sector.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    // ==========================================
    // LOGICA EDITAR / ELIMINAR DESDE MODAL DETALLE
    // ==========================================
    const btnEditarSector = document.getElementById('btnEditarSector');
    const btnEliminarSector = document.getElementById('btnEliminarSector');

    if (btnEditarSector) {
        btnEditarSector.addEventListener('click', () => {
            if(!currentOpenedSectorId) return;
            const s = sectores.find(x => x.id === currentOpenedSectorId);
            if(!s) return;
            
            // Cerrar el modal de detalle
            modal.classList.remove('active');
            
            // Rellenar formulario de edición
            document.getElementById('formSectorTitle').textContent = 'Editar Sector';
            document.getElementById('addSectorId').value = s.id;
            document.getElementById('addSectorNombre').value = s.nombre;
            
            let coordsStr = "";
            if(s.coordenadas_poligono) {
                try {
                    const parsed = JSON.parse(s.coordenadas_poligono);
                    coordsStr = parsed.map(c => `${c[0]}, ${c[1]}`).join('\n');
                } catch(e) {}
            }
            document.getElementById('addSectorCoords').value = coordsStr;
            
            document.getElementById('addSectorArea').value = s.area_hectareas;
            document.getElementById('addSectorCultivo').value = s.cultivo || '';
            
            // Abrir formulario
            modalAgregarSector.classList.add('active');
        });
    }

    if (btnEliminarSector) {
        btnEliminarSector.addEventListener('click', async () => {
            if(!currentOpenedSectorId) return;
            
            const confirmDelete = confirm("⚠️ ¿Estás seguro que deseas ELIMINAR este sector? Esta acción no se puede deshacer.");
            if(!confirmDelete) return;

            const submitBtn = btnEliminarSector;
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Eliminando...';

            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/sectores/${currentOpenedSectorId}/`, {
                    method: 'DELETE'
                });

                if (!response.ok) throw new Error('Error eliminando el sector');

                alert(`🗑️ Sector eliminado correctamente.`);
                modal.classList.remove('active');
                await loadData();
            } catch (err) {
                console.error(err);
                alert("❌ Error al eliminar el sector. Asegúrate que no tenga cuadrillas asociadas.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    // Funciones Auxiliares
    function getCultivoNombre(cultivoId) {
        if (!cultivoId) return "Sin cultivo";
        const c = cultivos.find(x => x.id === cultivoId);
        return c ? c.nombre : "Desconocido";
    }

    function populateCultivosSelect() {
        const select = document.getElementById('addSectorCultivo');
        if (!select) return;
        select.innerHTML = '<option value="">Sin Cultivo / Preparación</option>';
        cultivos.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre;
            select.appendChild(opt);
        });
    }

    function openSectorModal(sector) {
        currentOpenedSectorId = sector.id;
        document.getElementById('modalTitle').textContent = sector.nombre;
        document.getElementById('modalCultivo').textContent = getCultivoNombre(sector.cultivo);
        document.getElementById('modalArea').textContent = `${sector.area_hectareas} ha`;
        
        let estadoTexto = sector.estado;
        if(estadoTexto === 'ACTIVO') estadoTexto = 'Óptimo';
        document.getElementById('modalEstado').textContent = estadoTexto;
        
        // Simulado: en el futuro esto puede ser la cantidad de trabajadores en cuadrillas asignadas
        document.getElementById('modalTrabajadores').textContent = "Consultando..."; 
        
        document.getElementById('sectorModal').classList.add('active');
    }

    function renderSectorsOnMap(map, sectoresList) {
        sectoresList.forEach(sector => {
            let fillColor = '#10B981'; // Óptimo (Activo)
            if (sector.estado === 'RIEGO') fillColor = '#3B82F6';
            if (sector.estado === 'ALERTA') fillColor = '#F59E0B';
            if (sector.estado === 'MANTENIMIENTO') fillColor = '#9CA3AF';

            // Parsea JSON polygon
            let lat = baseLat, lng = baseLng;
            let boundsArray = null;

            if (sector.coordenadas_poligono) {
                try {
                    const parsed = JSON.parse(sector.coordenadas_poligono);
                    if(parsed.length >= 3) {
                        boundsArray = parsed;
                    } else if (parsed.length > 0) {
                        lat = parsed[0][0];
                        lng = parsed[0][1];
                    }
                } catch(e) {}
            }

            if(boundsArray) {
                const polygon = L.polygon(boundsArray, {
                    color: fillColor,
                    weight: 2,
                    fillColor: fillColor,
                    fillOpacity: 0.5
                }).addTo(map);

                polygon.bindTooltip(sector.nombre, { permanent: false, direction: 'center' });
                
                polygon.on('click', () => {
                    openSectorModal(sector);
                    map.flyToBounds(polygon.getBounds(), { padding: [50, 50], duration: 0.5, maxZoom: 16 });
                });
            } else {
                // Fallback a círculo si no hay polígono válido
                const radioCalculado = Math.sqrt((sector.area_hectareas * 10000) / Math.PI);
                const circle = L.circle([lat, lng], {
                    color: fillColor,
                    weight: 2,
                    fillColor: fillColor,
                    fillOpacity: 0.5,
                    radius: radioCalculado > 10 ? radioCalculado : 50
                }).addTo(map);

                circle.bindTooltip(sector.nombre, { permanent: false, direction: 'center' });

                circle.on('click', () => {
                    openSectorModal(sector);
                    map.flyTo([lat, lng], 16, { duration: 0.5 });
                });
            }
        });
    }

    function renderSectorList(sectoresList) {
        const listContainer = document.getElementById('sectorList');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        sectoresList.forEach(sector => {
            let badgeHtml = '';
            if (sector.estado === 'ACTIVO') {
                badgeHtml = `<span class="status-badge status-badge--ok"><i data-lucide="check-circle"></i> Óptimo</span>`;
            } else if (sector.estado === 'RIEGO') {
                badgeHtml = `<span class="status-badge status-badge--riego"><i data-lucide="droplet"></i> En Riego</span>`;
            } else if (sector.estado === 'ALERTA') {
                badgeHtml = `<span class="status-badge status-badge--alerta"><i data-lucide="alert-triangle"></i> Revisar</span>`;
            } else {
                badgeHtml = `<span class="status-badge"><i data-lucide="tool"></i> Mantenimiento</span>`;
            }

            const item = document.createElement('div');
            item.className = 'sector-item';
            
            item.innerHTML = `
                <div class="sector-item__info">
                    <span class="sector-item__name">${sector.nombre}</span>
                    <span class="sector-item__meta">
                        <i data-lucide="sprout" style="width:12px;height:12px"></i> ${getCultivoNombre(sector.cultivo)} • ${sector.area_hectareas} ha
                    </span>
                </div>
                <div class="sector-item__status">
                    ${badgeHtml}
                </div>
            `;
            
            item.addEventListener('click', () => {
                openSectorModal(sector);
                
                // Centrar en el mapa
                if (sector.coordenadas_poligono) {
                    try {
                        const parsed = JSON.parse(sector.coordenadas_poligono);
                        if(parsed.length > 0) {
                            if(parsed.length >= 3) {
                                const tempPoly = L.polygon(parsed);
                                map.flyToBounds(tempPoly.getBounds(), { padding: [50, 50], duration: 0.5, maxZoom: 16 });
                            } else {
                                map.flyTo([parsed[0][0], parsed[0][1]], 16, { duration: 0.5 });
                            }
                        }
                    } catch(e) {}
                }
            });

            listContainer.appendChild(item);
        });

        lucide.createIcons();
    }

    if (modalAgregarSector) {
        modalAgregarSector.addEventListener('click', (e) => {
            if (e.target === modalAgregarSector) {
                modalAgregarSector.classList.remove('active');
            }
        });
    }
});

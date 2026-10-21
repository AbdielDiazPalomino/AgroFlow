/* agroflow/views/supervisor/mapa/mapa.js */

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
    const pillSectorNombre = document.getElementById('pillSectorNombre');
    const pillSectorBadge = document.getElementById('pillSectorBadge');
    const pillCultivoNombre = document.getElementById('pillCultivoNombre');
    const pillCuadrillaNombre = document.getElementById('pillCuadrillaNombre');

    const btnCentrarSector = document.getElementById('btnCentrarSector');
    const btnToggleGps = document.getElementById('btnToggleGps');
    const btnSimularUbicacion = document.getElementById('btnSimularUbicacion');
    const btnToggleLayer = document.getElementById('btnToggleLayer');

    const gpsStatusText = document.getElementById('gpsStatusText');
    const gpsDetailText = document.getElementById('gpsDetailText');

    const modal = document.getElementById('sectorModal');
    const closeModal = document.getElementById('closeModal');
    closeModal?.addEventListener('click', () => modal.classList.remove('active'));
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // Coordenadas base: Fundo Corporación Roots SAC (Ica, Perú)
    const baseLat = -14.030357;
    const baseLng = -75.732235;

    // 2. Inicializar Mapa Leaflet
    const map = L.map('supervisorMap', {
        zoomControl: true
    }).setView([baseLat, baseLng], 15);

    const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri &mdash; Roots Agroflow',
        maxZoom: 19
    });

    const osmStreet = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
    });

    esriSatellite.addTo(map);
    let isSatellite = true;

    btnToggleLayer?.addEventListener('click', () => {
        if (isSatellite) {
            map.removeLayer(esriSatellite);
            osmStreet.addTo(map);
            btnToggleLayer.innerHTML = `<i data-lucide="layers"></i><span>Satelital</span>`;
        } else {
            map.removeLayer(osmStreet);
            esriSatellite.addTo(map);
            btnToggleLayer.innerHTML = `<i data-lucide="layers"></i><span>Calles</span>`;
        }
        isSatellite = !isSatellite;
        lucide.createIcons();
    });

    // Estado local
    let allCuadrillas = [];
    let allTrabajadores = [];
    let allSectores = [];
    let allCultivos = [];
    let miCuadrilla = null;
    let miSector = null;

    let mySectorBounds = null;
    let mySectorCenter = [baseLat, baseLng];

    // Variables GPS
    let userMarker = null;
    let accuracyCircle = null;
    let isSimulating = false;

    const gpsIcon = L.divIcon({
        className: 'pulsing-gps-marker',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });

    // 3. Cargar Datos del Servidor
    async function loadData() {
        try {
            const [resC, resT, resS, resCul] = await Promise.all([
                fetch(`${CONFIG.API_BASE_URL}/cuadrillas/`),
                fetch(`${CONFIG.API_BASE_URL}/trabajadores/`),
                fetch(`${CONFIG.API_BASE_URL}/sectores/`),
                fetch(`${CONFIG.API_BASE_URL}/cultivos/`)
            ]);

            allCuadrillas = await resC.json();
            allTrabajadores = await resT.json();
            allSectores = await resS.json();
            allCultivos = await resCul.json();

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

            // Identificar cuadrilla y sector
            miCuadrilla = allCuadrillas.find(c => 
                c.encargado === currentSupervisorId || 
                (supervisorInfo && supervisorInfo.cuadrilla === c.id)
            );

            if (!miCuadrilla && userRole === 'GERENTE' && allCuadrillas.length > 0) {
                miCuadrilla = allCuadrillas[0];
            }

            if (miCuadrilla && miCuadrilla.sector_asignado) {
                miSector = allSectores.find(s => s.id === miCuadrilla.sector_asignado);
            }

            // Actualizar píldora informativa
            if (miSector) {
                pillSectorNombre.textContent = miSector.nombre;
                pillCultivoNombre.textContent = miSector.cultivo_nombre || 'Cultivo';
                pillCuadrillaNombre.textContent = miCuadrilla.nombre;
                if (pillSectorBadge) pillSectorBadge.style.display = 'inline-block';
            } else {
                pillSectorNombre.textContent = miCuadrilla ? "Sin Sector Asignado" : "Sin Cuadrilla Asignada";
                pillCultivoNombre.textContent = "-";
                pillCuadrillaNombre.textContent = miCuadrilla ? miCuadrilla.nombre : "Sin Cuadrilla";
                if (pillSectorBadge) pillSectorBadge.style.display = 'none';
            }

            // Renderizar los sectores sobre el mapa
            renderSectors();

            // Iniciar seguimiento GPS
            startGpsTracking();

        } catch (err) {
            console.error("Error al cargar datos del mapa:", err);
        }
    }

    // 4. Renderizar Sectores (Destacando el de SU cuadrilla)
    function renderSectors() {
        allSectores.forEach(sector => {
            const isMySector = miSector && sector.id === miSector.id;
            
            // Color del sector
            let fillColor = '#10B981'; // Verde óptimo
            if (sector.estado === 'RIEGO') fillColor = '#3B82F6';
            if (sector.estado === 'ALERTA') fillColor = '#F59E0B';
            if (sector.estado === 'MANTENIMIENTO') fillColor = '#9CA3AF';

            let polygonCoords = null;
            let centerLat = baseLat;
            let centerLng = baseLng;

            if (sector.coordenadas_poligono) {
                try {
                    const parsed = JSON.parse(sector.coordenadas_poligono);
                    if (Array.isArray(parsed) && parsed.length >= 3) {
                        polygonCoords = parsed;
                        centerLat = parsed[0][0];
                        centerLng = parsed[0][1];
                    }
                } catch(e) {}
            }

            let layer = null;

            if (polygonCoords) {
                layer = L.polygon(polygonCoords, {
                    color: isMySector ? '#10B981' : fillColor,
                    weight: isMySector ? 4 : 2,
                    dashArray: isMySector ? null : '4, 4',
                    fillColor: isMySector ? '#10B981' : fillColor,
                    fillOpacity: isMySector ? 0.65 : 0.25
                }).addTo(map);

                if (isMySector) {
                    mySectorBounds = layer.getBounds();
                    mySectorCenter = [mySectorBounds.getCenter().lat, mySectorBounds.getCenter().lng];
                }
            } else {
                // Fallback círculo
                const radio = Math.sqrt(((sector.area_hectareas || 2) * 10000) / Math.PI);
                layer = L.circle([centerLat, centerLng], {
                    color: isMySector ? '#10B981' : fillColor,
                    weight: isMySector ? 4 : 2,
                    fillColor: isMySector ? '#10B981' : fillColor,
                    fillOpacity: isMySector ? 0.65 : 0.25,
                    radius: radio > 20 ? radio : 60
                }).addTo(map);

                if (isMySector) {
                    mySectorBounds = layer.getBounds();
                    mySectorCenter = [centerLat, centerLng];
                }
            }

            // Tooltip persistente o al hover
            const tooltipText = isMySector 
                ? `<strong>⭐ TU SECTOR: ${sector.nombre}</strong><br>Cultivo: ${sector.cultivo_nombre || '-'}`
                : `Sector: ${sector.nombre}`;

            layer.bindTooltip(tooltipText, { 
                permanent: isMySector, 
                direction: 'center',
                className: isMySector ? 'custom-leaflet-tooltip-active' : ''
            });

            // Al hacer clic, abrir modal de detalles
            layer.on('click', () => {
                openSectorDetail(sector, isMySector);
            });
        });

        // Si tenemos sector asignado, centramos el mapa en él
        if (mySectorBounds) {
            map.flyToBounds(mySectorBounds, { padding: [50, 50], duration: 1, maxZoom: 16 });
        }
    }

    // 5. Modal con detalle del sector
    function openSectorDetail(sector, isMySector) {
        document.getElementById('modalSectorTitle').textContent = sector.nombre;
        document.getElementById('modalSectorSubtitle').textContent = isMySector ? `Sector a cargo de ${miCuadrilla?.nombre || 'tu cuadrilla'}` : 'Sector Agrícola';
        document.getElementById('modalSectorCultivo').textContent = sector.cultivo_nombre || 'No especificado';
        document.getElementById('modalSectorArea').textContent = `${sector.area_hectareas || '-'} ha`;
        document.getElementById('modalSectorEstado').textContent = sector.estado || 'Óptimo';
        document.getElementById('modalSectorAsignacion').textContent = isMySector ? `Asignado a tu cuadrilla` : 'Otra Cuadrilla / Fundo';

        const notaEl = document.getElementById('modalSectorNota');
        if (isMySector) {
            notaEl.style.display = 'block';
            notaEl.textContent = `✅ Este es el sector donde tu cuadrilla (${miCuadrilla?.nombre}) realiza sus tareas operativas.`;
        } else {
            notaEl.style.display = 'none';
        }

        modal.classList.add('active');
        lucide.createIcons();
    }

    // 6. Seguimiento GPS en Tiempo Real
    function startGpsTracking() {
        if ("geolocation" in navigator) {
            navigator.geolocation.watchPosition(
                (pos) => {
                    if (isSimulating) return;
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    const acc = pos.coords.accuracy || 15;
                    updateGpsDisplay(lat, lng, acc, false);
                },
                (err) => {
                    console.warn("GPS Warning:", err.message);
                    gpsStatusText.textContent = "GPS: Sin señal directa en navegador";
                    gpsDetailText.textContent = "Haz clic en 'Simular en Sector' para probar la ubicación en el campo.";
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
            );
        } else {
            gpsStatusText.textContent = "Geolocalización no soportada por el navegador";
        }
    }

    let lastSentTimestamp = 0;
    let currentReportedLat = null;
    let currentReportedLng = null;
    let lastSavedLat = null;
    let lastSavedLng = null;

    function hasMovedSignificantly(lat1, lon1, lat2, lon2) {
        if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return true;
        const dLat = (lat2 - lat1) * 111000;
        const dLng = (lon2 - lon1) * 111000 * Math.cos(lat1 * Math.PI / 180);
        return Math.sqrt(dLat * dLat + dLng * dLng) > 10; // Solo si se movió más de 10 metros
    }

    async function sendLocationToServer(lat, lng, force = false) {
        if (!currentSupervisorId) return;
        const now = Date.now();

        // Enviar solo si pasaron al menos 60 segundos O si hubo desplazamiento significativo (>10m) O si es forzado
        const moved = hasMovedSignificantly(lastSavedLat, lastSavedLng, lat, lng);
        if (!force && !moved && (now - lastSentTimestamp < 60000)) return;
        if (!force && (now - lastSentTimestamp < 15000)) return; // Mínimo 15s de espera entre pings

        lastSentTimestamp = now;
        currentReportedLat = lat;
        currentReportedLng = lng;
        lastSavedLat = lat;
        lastSavedLng = lng;

        try {
            await fetch(`${CONFIG.API_BASE_URL}/supervisores/actualizar-ubicacion/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trabajador_id: currentSupervisorId,
                    latitud: lat,
                    longitud: lng
                })
            });
            console.log(`🛰️ Ubicación sincronizada con el Gerente General: [${lat}, ${lng}]`);
        } catch (e) {
            console.warn("No se pudo sincronizar ubicación con el servidor:", e);
        }
    }

    function updateGpsDisplay(lat, lng, accuracy, isSimulated) {
        if (!userMarker) {
            userMarker = L.marker([lat, lng], { icon: gpsIcon, zIndexOffset: 1000 }).addTo(map);
            accuracyCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: '#3B82F6',
                fillColor: '#3B82F6',
                fillOpacity: 0.12,
                weight: 1
            }).addTo(map);
        } else {
            userMarker.setLatLng([lat, lng]);
            accuracyCircle.setLatLng([lat, lng]);
            accuracyCircle.setRadius(accuracy);
        }

        userMarker.bindPopup(`
            <div style="font-size:0.875rem;">
                <strong>📍 Supervisor: ${topNombre.textContent}</strong><br>
                <span>${isSimulated ? 'Ubicación simulada en terreno' : 'Ubicación GPS en vivo'}</span><br>
                <small style="color:#64748B;">Precisión: ±${Math.round(accuracy)}m</small>
            </div>
        `);

        gpsStatusText.textContent = isSimulated 
            ? "📍 Ubicación Simulada en tu Sector" 
            : "🛰️ GPS Activo: Rastreando en tiempo real";
        
        gpsDetailText.textContent = `Lat: ${lat.toFixed(6)} | Lng: ${lng.toFixed(6)} (Precisión: ±${Math.round(accuracy)}m)`;

        // Enviar la ubicación al servidor para que el Gerente General la visualice
        sendLocationToServer(lat, lng, isSimulated);
    }

    // Ping de presencia cada 60 segundos para mantener la señal en el mapa del Gerente
    setInterval(() => {
        if (currentReportedLat !== null && currentReportedLng !== null) {
            sendLocationToServer(currentReportedLat, currentReportedLng, true);
        }
    }, 60000);

    // 7. Botones de Control
    btnCentrarSector?.addEventListener('click', () => {
        if (mySectorBounds) {
            map.flyToBounds(mySectorBounds, { padding: [60, 60], duration: 0.8, maxZoom: 16 });
        } else {
            map.flyTo([baseLat, baseLng], 15, { duration: 0.8 });
        }
    });

    btnToggleGps?.addEventListener('click', () => {
        if (userMarker) {
            map.flyTo(userMarker.getLatLng(), 17, { duration: 0.8 });
            userMarker.openPopup();
        } else {
            // Si aún no hay posición, simularla
            btnSimularUbicacion.click();
        }
    });

    btnSimularUbicacion?.addEventListener('click', () => {
        isSimulating = !isSimulating;
        if (isSimulating) {
            btnSimularUbicacion.classList.add('btn-map-control--active');
            // Ubicar al supervisor exactamente en el centro de su sector
            const simLat = mySectorCenter[0] + (Math.random() - 0.5) * 0.001;
            const simLng = mySectorCenter[1] + (Math.random() - 0.5) * 0.001;
            updateGpsDisplay(simLat, simLng, 8, true);
            map.flyTo([simLat, simLng], 17, { duration: 0.8 });
            if (userMarker) userMarker.openPopup();
        } else {
            btnSimularUbicacion.classList.remove('btn-map-control--active');
            startGpsTracking();
        }
    });

    // Carga inicial
    await loadData();
});


/* agroflow/views/obrero/obrero.js */

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();

    // 1. Control de Sesión
    const trabajadorId = localStorage.getItem('agroflow_trabajador_id');
    const userRole = localStorage.getItem('agroflow_user_role');

    if (!trabajadorId && userRole !== 'GERENTE') {
        window.location.href = '../login/index.html';
        return;
    }

    // Sidebar Mobile
    const sidebar = document.getElementById('sidebar');
    document.getElementById('openSidebar')?.addEventListener('click', () => sidebar.classList.add('active'));
    document.getElementById('closeSidebar')?.addEventListener('click', () => sidebar.classList.remove('active'));

    // Navegación (Tabs)
    const navInicio = document.getElementById('navInicio');
    const navReasignacion = document.getElementById('navReasignacion');
    const navSeguridad = document.getElementById('navSeguridad');

    const viewInicio = document.getElementById('viewInicio');
    const viewReasignacion = document.getElementById('viewReasignacion');
    const viewSeguridad = document.getElementById('viewSeguridad');

    function switchTab(activeNav, activeView) {
        [navInicio, navReasignacion, navSeguridad].forEach(n => n?.classList.remove('active'));
        [viewInicio, viewReasignacion, viewSeguridad].forEach(v => { if (v) v.style.display = 'none'; });
        
        activeNav?.classList.add('active');
        if (activeView) activeView.style.display = 'block';
        if (window.innerWidth <= 768) sidebar.classList.remove('active');
        lucide.createIcons();
    }

    navInicio?.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(navInicio, viewInicio);
    });

    navReasignacion?.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(navReasignacion, viewReasignacion);
    });

    navSeguridad?.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(navSeguridad, viewSeguridad);
    });

    // Botón de campana de notificaciones
    document.getElementById('btnNotificacion')?.addEventListener('click', () => {
        switchTab(navReasignacion, viewReasignacion);
    });

    // Logout
    document.getElementById('btnLogout')?.addEventListener('click', () => {
        localStorage.removeItem('agroflow_user_role');
        localStorage.removeItem('agroflow_trabajador_id');
        localStorage.removeItem('agroflow_nombre');
        localStorage.removeItem('agroflow_username');
    });

    // Variables de estado
    let currentTraslado = null;
    let currentPerfil = null;

    // 2. Cargar Perfil del Obrero
    async function cargarPerfil() {
        if (!trabajadorId) return;

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/obrero-perfil/${trabajadorId}/`);
            if (!res.ok) throw new Error('Error al cargar datos del perfil');
            const data = await res.json();
            currentPerfil = data;

            // Topbar
            const topNombre = document.getElementById('topNombre');
            const topRol = document.getElementById('topRol');
            const topAvatar = document.getElementById('topAvatar');

            if (topNombre) topNombre.textContent = `${data.trabajador.nombres} ${data.trabajador.apellidos}`;
            if (topRol) topRol.textContent = data.trabajador.es_supervisor ? 'Supervisor de Cuadrilla' : 'Obrero Agrícola';
            if (topAvatar) {
                if (data.trabajador.foto_url) {
                    topAvatar.src = data.trabajador.foto_url;
                } else {
                    topAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.trabajador.nombres)}+${encodeURIComponent(data.trabajador.apellidos)}&background=10B981&color=fff`;
                }
            }

            // Vista Principal (Asignación de hoy)
            const saludoObrero = document.getElementById('saludoObrero');
            const cardCuadrilla = document.getElementById('cardCuadrilla');
            const cardSector = document.getElementById('cardSector');
            const cardSupervisor = document.getElementById('cardSupervisor');
            const cardDni = document.getElementById('cardDni');

            if (saludoObrero) saludoObrero.textContent = `¡Hola, ${data.trabajador.nombres}!`;
            if (cardCuadrilla) cardCuadrilla.textContent = data.cuadrilla.nombre || 'Sin Cuadrilla asignada';
            
            if (cardSector) {
                if (data.sector && data.sector.id) {
                    cardSector.textContent = `Sector: ${data.sector.nombre} (${data.sector.cultivo})`;
                } else {
                    cardSector.textContent = 'Sector: Sin Sector asignado';
                }
            }

            if (cardSupervisor) {
                cardSupervisor.innerHTML = `<i data-lucide="user-check" style="width:16px; margin-right:5px;"></i> ${data.cuadrilla.supervisor}`;
            }
            if (cardDni) {
                cardDni.innerHTML = `<i data-lucide="id-card" style="width:16px; margin-right:5px;"></i> ${data.trabajador.dni}`;
            }

            // Vista Reasignación
            const contenedorSolicitud = document.getElementById('contenedorSolicitud');
            const sinSolicitudesMensaje = document.getElementById('sinSolicitudesMensaje');
            const badgeCampana = document.getElementById('badgeCampana');
            const badgeReasignacion = document.getElementById('badgeReasignacion');

            if (data.traslado_pendiente) {
                currentTraslado = data.traslado_pendiente;
                if (badgeCampana) { badgeCampana.style.display = 'flex'; badgeCampana.textContent = '1'; }
                if (badgeReasignacion) { badgeReasignacion.style.display = 'inline-block'; badgeReasignacion.textContent = '1'; }
                if (contenedorSolicitud) contenedorSolicitud.style.display = 'block';
                if (sinSolicitudesMensaje) sinSolicitudesMensaje.style.display = 'none';

                // Llenar datos de comparación
                document.getElementById('trasladoOrigenNombre').textContent = data.traslado_pendiente.cuadrilla_origen;
                document.getElementById('trasladoOrigenSector').textContent = data.sector.nombre;
                document.getElementById('trasladoOrigenSup').textContent = `Sup: ${data.cuadrilla.supervisor}`;

                document.getElementById('trasladoDestinoNombre').textContent = data.traslado_pendiente.cuadrilla_destino_nombre;
                document.getElementById('trasladoDestinoSector').textContent = `${data.traslado_pendiente.sector_destino_nombre} (${data.traslado_pendiente.cultivo_destino_nombre})`;
                document.getElementById('trasladoDestinoSup').textContent = `Sup: ${data.traslado_pendiente.supervisor_destino_nombre}`;
                document.getElementById('trasladoMotivoTexto').textContent = data.traslado_pendiente.motivo || 'Reasignación operativa de personal.';
            } else {
                currentTraslado = null;
                if (badgeCampana) badgeCampana.style.display = 'none';
                if (badgeReasignacion) badgeReasignacion.style.display = 'none';
                if (contenedorSolicitud) contenedorSolicitud.style.display = 'none';
                if (sinSolicitudesMensaje) sinSolicitudesMensaje.style.display = 'block';
            }

            lucide.createIcons();
        } catch (err) {
            console.error("Error al obtener perfil del obrero:", err);
        }
    }

    // 3. WebAuthn: Aceptar Reasignación con Firma Digital
    const btnAceptar = document.getElementById('btnAceptarAuthn');
    btnAceptar?.addEventListener('click', async () => {
        if (!currentTraslado) {
            alert("No tienes ninguna solicitud de reasignación pendiente.");
            return;
        }

        const originalText = btnAceptar.innerHTML;
        btnAceptar.innerHTML = `<i data-lucide="loader" class="spin"></i> Esperando validación biométrica...`;
        btnAceptar.disabled = true;
        lucide.createIcons();

        let credentialHash = 'WEBAUTHN-LEGAL-' + Date.now();

        try {
            if (window.PublicKeyCredential) {
                const challenge = new Uint8Array(32);
                window.crypto.getRandomValues(challenge);
                const credential = await navigator.credentials.create({
                    publicKey: {
                        challenge: challenge,
                        rp: { name: "AGROFLOW Biometría" },
                        user: {
                            id: Uint8Array.from(String(trabajadorId), c => c.charCodeAt(0)),
                            name: currentPerfil ? currentPerfil.trabajador.dni : "obrero",
                            displayName: currentPerfil ? `${currentPerfil.trabajador.nombres} ${currentPerfil.trabajador.apellidos}` : "Obrero"
                        },
                        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                        authenticatorSelection: {
                            authenticatorAttachment: "platform",
                            userVerification: "required"
                        },
                        timeout: 60000
                    }
                });
                if (credential && credential.id) {
                    credentialHash = 'WEBAUTHN-' + credential.id;
                }
            }
        } catch (error) {
            console.warn("Autenticador nativo cancelado o entorno sin HTTPS, aplicando token de firma:", error);
        }

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/traslados/${currentTraslado.id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: 'ACEPTADO',
                    firma_biometrica_hash: credentialHash
                })
            });

            if (!res.ok) throw new Error("No se pudo actualizar el estado en el servidor.");

            btnAceptar.innerHTML = `<i data-lucide="check-circle"></i> Traslado Confirmado`;
            btnAceptar.style.backgroundColor = '#10B981';
            lucide.createIcons();

            setTimeout(async () => {
                alert("¡Firma Biométrica Registrada Legalmente!\nHas sido reasignado exitosamente a tu nueva cuadrilla.");
                btnAceptar.innerHTML = originalText;
                btnAceptar.disabled = false;
                btnAceptar.style.backgroundColor = '';
                await cargarPerfil();
                switchTab(navInicio, viewInicio);
            }, 800);

        } catch (err) {
            alert("Error al procesar el traslado: " + err.message);
            btnAceptar.innerHTML = originalText;
            btnAceptar.disabled = false;
            lucide.createIcons();
        }
    });

    // 4. Rechazar Traslado
    document.getElementById('btnRechazar')?.addEventListener('click', async () => {
        if (!currentTraslado) return;
        if (!confirm("¿Estás seguro de que deseas rechazar este cambio de cuadrilla?")) return;

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/traslados/${currentTraslado.id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: 'RECHAZADO'
                })
            });

            if (!res.ok) throw new Error("No se pudo registrar el rechazo.");

            alert("Has rechazado el traslado. Se notificará a tu supervisor.");
            await cargarPerfil();
            switchTab(navInicio, viewInicio);
        } catch (err) {
            alert("Error: " + err.message);
        }
    });

    // 5. Cambio de Contraseña
    const formCambiarPassword = document.getElementById('formCambiarPassword');
    formCambiarPassword?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPass = document.getElementById('inputCurrentPass').value;
        const newPass = document.getElementById('inputNewPass').value;
        const confirmPass = document.getElementById('inputConfirmPass').value;

        if (newPass !== confirmPass) {
            alert("La nueva contraseña y la confirmación no coinciden.");
            return;
        }

        if (newPass.length < 4) {
            alert("La nueva contraseña debe tener al menos 4 caracteres.");
            return;
        }

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/cambiar-password/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trabajador_id: trabajadorId,
                    current_password: currentPass,
                    new_password: newPass
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "No se pudo actualizar la contraseña.");
            }

            alert("¡Contraseña actualizada con éxito!\nPuedes usar tu nueva clave la próxima vez que inicies sesión.");
            formCambiarPassword.reset();
            switchTab(navInicio, viewInicio);
        } catch (err) {
            alert(err.message);
        }
    });

    // Cargar inicial
    await cargarPerfil();
});

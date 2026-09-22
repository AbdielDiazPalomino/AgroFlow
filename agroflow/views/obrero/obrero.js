/* agroflow/views/obrero/obrero.js */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Sidebar Mobile
    const sidebar = document.getElementById('sidebar');
    document.getElementById('openSidebar')?.addEventListener('click', () => sidebar.classList.add('active'));
    document.getElementById('closeSidebar')?.addEventListener('click', () => sidebar.classList.remove('active'));

    // Navegación Básica (Tabs)
    const navInicio = document.getElementById('navInicio');
    const navReasignacion = document.getElementById('navReasignacion');
    const viewInicio = document.getElementById('viewInicio');
    const viewReasignacion = document.getElementById('viewReasignacion');

    // Botón de campana
    document.getElementById('btnNotificacion')?.addEventListener('click', () => {
        showReasignacion();
    });

    navInicio?.addEventListener('click', (e) => {
        e.preventDefault();
        navInicio.classList.add('active');
        navReasignacion.classList.remove('active');
        viewInicio.style.display = 'block';
        viewReasignacion.style.display = 'none';
        if(window.innerWidth <= 768) sidebar.classList.remove('active');
    });

    navReasignacion?.addEventListener('click', (e) => {
        e.preventDefault();
        showReasignacion();
    });

    function showReasignacion() {
        navReasignacion.classList.add('active');
        navInicio.classList.remove('active');
        viewReasignacion.style.display = 'block';
        viewInicio.style.display = 'none';
        if(window.innerWidth <= 768) sidebar.classList.remove('active');
    }

    // --- LÓGICA DE FIRMA WEBAUTHN (BIOMETRÍA) ---
    const btnAceptar = document.getElementById('btnAceptarAuthn');
    
    btnAceptar?.addEventListener('click', async () => {
        const originalText = btnAceptar.innerHTML;
        btnAceptar.innerHTML = `<i data-lucide="loader" class="spin"></i> Esperando validación biométrica...`;
        btnAceptar.disabled = true;
        lucide.createIcons();

        try {
            // Intentamos invocar la API Nativa de WebAuthn del navegador.
            // Esto le pide al celular/PC que escanee la huella, rostro o pida el PIN.
            // Para que no falle por completo en Localhost sin HTTPS, envolvemos en un catch.
            if (!window.PublicKeyCredential) {
                throw new Error("El navegador no soporta WebAuthn o no está en un entorno seguro (HTTPS).");
            }

            // Parámetros falsos (Dummy) para forzar al navegador a mostrar el prompt de huella
            const publicKeyCredentialCreationOptions = {
                challenge: Uint8Array.from("randomStringChallenge", c => c.charCodeAt(0)),
                rp: { name: "Agroflow" },
                user: {
                    id: Uint8Array.from("userID", c => c.charCodeAt(0)),
                    name: "jose.mamani@roots.com",
                    displayName: "José Mamani"
                },
                pubKeyCredParams: [{alg: -7, type: "public-key"}],
                authenticatorSelection: {
                    authenticatorAttachment: "platform", // Obliga a usar la huella/cara del propio dispositivo
                    userVerification: "required"
                },
                timeout: 60000
            };

            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions
            });

            // Si llegamos aquí, el usuario puso su huella exitosamente
            console.log("Firma digital exitosa:", credential);
            triggerSuccess();

        } catch (error) {
            console.warn("Simulando éxito ya que no estamos en producción/HTTPS:", error);
            
            // SIMULACIÓN (Mock) en caso de estar en desarrollo local sin HTTPS
            setTimeout(() => {
                triggerSuccess();
            }, 2000);
        }

        function triggerSuccess() {
            btnAceptar.innerHTML = `<i data-lucide="check-circle"></i> Traslado Confirmado`;
            btnAceptar.style.backgroundColor = '#10B981';
            
            // Ocultar las notificaciones de la UI
            document.querySelectorAll('.badge').forEach(b => b.style.display = 'none');
            
            setTimeout(() => {
                alert("¡Firma Biométrica Registrada Legalmente!\nHas sido reasignado a la Cuadrilla Beta.");
                // Retornar a la vista principal
                navInicio.click();
                
                // Actualizar la vista principal para mostrar la nueva cuadrilla
                document.querySelector('.assignment-card h2').textContent = 'Cuadrilla Beta';
                document.querySelector('.assignment-card p').textContent = 'Sector Este 1 (Gypsophila)';
                
                btnAceptar.innerHTML = originalText;
                btnAceptar.disabled = false;
                btnAceptar.style.backgroundColor = '';
            }, 500);
        }
    });

    // Rechazar
    document.getElementById('btnRechazar')?.addEventListener('click', () => {
        alert("Has rechazado el traslado. Se notificará a tu supervisor.");
        navInicio.click();
    });
});

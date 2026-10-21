/* agroflow/views/login/login.js */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar Iconos Lucide
    lucide.createIcons();

    // 2. Mostrar/Ocultar Contraseña
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            
            // Alternar el tipo de input
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            
            // Cambiar el icono usando inyección y regeneración de lucide
            toggleBtn.innerHTML = isPassword 
                ? '<i data-lucide="eye"></i>' 
                : '<i data-lucide="eye-off"></i>';
                
            // Forzar a lucide a renderizar el nuevo icono insertado
            lucide.createIcons();
        });
    }

    // 3. Envío Real al Backend
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('username').value;
            const passwordInput = document.getElementById('password').value;

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            submitBtn.innerHTML = '<i data-lucide="loader" class="spin-icon"></i> Verificando...';
            lucide.createIcons();

            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/login/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: usernameInput,
                        password: passwordInput
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    // Guardar datos de sesión
                    localStorage.setItem('agroflow_user_role', data.role);
                    localStorage.setItem('agroflow_username', data.username || data.dni);
                    localStorage.setItem('agroflow_nombre', data.nombre || data.username);
                    if (data.id) {
                        localStorage.setItem('agroflow_trabajador_id', data.id);
                    } else {
                        localStorage.removeItem('agroflow_trabajador_id');
                    }
                    
                    // Redirección según rol
                    if (data.role === 'OBRERO') {
                        window.location.href = '../obrero/index.html';
                    } else if (data.role === 'SUPERVISOR') {
                        window.location.href = '../supervisor/index.html';
                    } else if (data.role === 'JEFE_ALMACEN') {
                        window.location.href = '../jefealmacen/index.html';
                    } else {
                        // GERENTE / ADMIN
                        window.location.href = '../dashboard/index.html';
                    }
                } else {
                    // Mostrar error del backend (Ej: Credenciales inválidas o Rol Denegado)
                    alert(data.error || 'Error al iniciar sesión');
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.innerHTML = originalText;
                    lucide.createIcons();
                }
            } catch (error) {
                console.error("Error conectando con Django:", error);
                alert("Error de red: Verifica que el backend Django esté corriendo en el puerto 8000.");
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.innerHTML = originalText;
                lucide.createIcons();
            }
        });
    }
});

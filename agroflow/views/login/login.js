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

    // 3. Simulación de Envío de Formulario
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Evitamos recarga real de la página
            const email = document.getElementById('email').value;

            // Simular un request de 1 segundo para efecto de realismo
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            submitBtn.innerHTML = '<i data-lucide="loader" class="spin-icon"></i> Ingresando...';
            lucide.createIcons();

            setTimeout(() => {
                console.log(`Iniciando sesión con Email: ${email}`);
                
                // Redirigir al dashboard principal
                window.location.href = '../dashboard/index.html';
                
                // Retornar botón a su estado normal (aunque la página se recargará)
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.innerHTML = originalText;
                lucide.createIcons();
            }, 1000);
        });
    }
});


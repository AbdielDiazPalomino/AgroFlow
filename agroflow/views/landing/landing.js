/* agroflow/views/landing/landing.js */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar Iconos Lucide
    // Transforma todas las etiquetas <i data-lucide="..."> en SVGs estilizados
    lucide.createIcons();

    // 2. Lógica del menú hamburguesa (Mobile)
    const menuBtn = document.getElementById('mobile-menu-btn');
    const nav = document.getElementById('nav-menu');
    const actions = document.getElementById('nav-actions');
    let isMenuOpen = false;

    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            isMenuOpen = !isMenuOpen;
            
            if (isMenuOpen) {
                // Aplicar estilos para mostrar menú desplegable
                nav.style.display = 'flex';
                nav.style.flexDirection = 'column';
                nav.style.position = 'absolute';
                nav.style.top = '72px';
                nav.style.left = '0';
                nav.style.width = '100%';
                nav.style.backgroundColor = 'rgba(11, 17, 33, 0.98)';
                nav.style.padding = '1.5rem';
                nav.style.gap = '1.5rem';
                nav.style.borderBottom = '1px solid var(--color-border)';
                
                actions.style.display = 'flex';
                actions.style.flexDirection = 'column';
                actions.style.width = '100%';
                
                // Cambiar icono a "X"
                menuBtn.innerHTML = '<i data-lucide="x"></i>';
                lucide.createIcons();
            } else {
                // Ocultar menú
                nav.style.display = 'none';
                actions.style.display = 'none';
                
                // Limpiar los estilos inline para que el CSS por defecto (Media Queries) tome control de nuevo
                nav.removeAttribute('style');
                actions.removeAttribute('style');
                
                // Regresar al icono de hamburguesa
                menuBtn.innerHTML = '<i data-lucide="menu"></i>';
                lucide.createIcons();
            }
        });
    }

    // 3. Control de scroll para el header
    // Le da un fondo oscuro fijo cuando haces scroll hacia abajo
    const header = document.getElementById('header');
    
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('header--scrolled');
            } else {
                header.classList.remove('header--scrolled');
            }
        });
    }
});


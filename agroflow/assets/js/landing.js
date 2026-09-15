/**
 * Lógica específica para la Landing Page de Agroflow
 */

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const mobileMenuBtn = document.querySelector('.header__toggle');
    const headerNav = document.querySelector('.header__nav');
    const headerActions = document.querySelector('.header__actions');

    // Funcionalidad básica para menú móvil (Toggle)
    // En un proyecto real esto abriría un sidebar o modal con los enlaces
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            // Ejemplo simple de interacción
            alert('Abrir menú móvil (En desarrollo)');
        });
    }

    // Efecto de Header al hacer scroll
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
        } else {
            header.style.boxShadow = 'none';
        }
    });
});

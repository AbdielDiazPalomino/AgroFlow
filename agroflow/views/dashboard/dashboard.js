/* agroflow/views/dashboard/dashboard.js */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Sidebar Mobile
    const sidebar = document.getElementById('sidebar');
    document.getElementById('openSidebar')?.addEventListener('click', () => sidebar.classList.add('active'));
    document.getElementById('closeSidebar')?.addEventListener('click', () => sidebar.classList.remove('active'));

    // Configuración Global de Chart.js para que haga match con nuestro tema oscuro
    Chart.defaults.color = '#94a3b8'; // text-muted
    Chart.defaults.font.family = 'Inter, sans-serif';

    // Gráfico 1: Proyección de Cosecha (Line Chart)
    const ctxCosecha = document.getElementById('cosechaChart');
    if (ctxCosecha) {
        new Chart(ctxCosecha, {
            type: 'line',
            data: {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'],
                datasets: [{
                    label: 'Cajas Exportadas (Miles)',
                    data: [12, 19, 15, 22, 28, 25, 30],
                    borderColor: '#10B981', // primary green
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4, // Curvas suaves
                    pointBackgroundColor: '#10B981',
                    pointBorderColor: '#fff',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(51, 65, 85, 0.3)' }, // border color
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        border: { display: false }
                    }
                }
            }
        });
    }

    // Gráfico 2: Distribución de Cultivos (Doughnut Chart)
    const ctxCultivos = document.getElementById('cultivosChart');
    if (ctxCultivos) {
        new Chart(ctxCultivos, {
            type: 'doughnut',
            data: {
                labels: ['Sunflower', 'Gypsophila', 'Lisianthus', 'Otros'],
                datasets: [{
                    data: [40, 25, 20, 15],
                    backgroundColor: [
                        '#10B981', // Verde
                        '#3B82F6', // Azul
                        '#F59E0B', // Naranja
                        '#8B5CF6'  // Morado
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', // Agujero más grande
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 20, usePointStyle: true }
                    }
                }
            }
        });
    }
});


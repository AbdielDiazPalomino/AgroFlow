/* agroflow/views/reportes/reportes.js */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Iconos
    lucide.createIcons();

    // Sidebar Mobile
    const sidebar = document.getElementById('sidebar');
    document.getElementById('openSidebar')?.addEventListener('click', () => sidebar.classList.add('active'));
    document.getElementById('closeSidebar')?.addEventListener('click', () => sidebar.classList.remove('active'));

    // --- SIMULACIÓN DE BACKEND ---

    const btnGenerar = document.getElementById('btnGenerar');
    const btnExcel = document.getElementById('btnExcel');
    const btnPdf = document.getElementById('btnPdf');

    // Simular el Filtro (Request al Backend)
    btnGenerar?.addEventListener('click', () => {
        const originalText = btnGenerar.innerHTML;
        
        // Estado de Carga
        btnGenerar.innerHTML = `<i data-lucide="loader" class="spin"></i> Buscando en base de datos...`;
        btnGenerar.disabled = true;
        lucide.createIcons();

        // Simular latencia de red de Django (1.5 segundos)
        setTimeout(() => {
            btnGenerar.innerHTML = originalText;
            btnGenerar.disabled = false;
            lucide.createIcons();
            alert("✅ Filtros aplicados.\n(En producción, esto enviará las fechas y parámetros al servidor Django, el cual ejecutará un query SQL y devolverá los datos actualizados a la tabla).");
        }, 1500);
    });

    // Simular Descarga de Excel
    btnExcel?.addEventListener('click', () => {
        const originalText = btnExcel.innerHTML;
        btnExcel.innerHTML = `Generando .xlsx...`;
        btnExcel.disabled = true;

        setTimeout(() => {
            btnExcel.innerHTML = originalText;
            btnExcel.disabled = false;
            alert("📥 Descarga de Excel iniciada.\n(En producción, Django usará librerías como 'openpyxl' para crear el archivo real).");
        }, 1000);
    });

    // Simular Descarga de PDF
    btnPdf?.addEventListener('click', () => {
        const originalText = btnPdf.innerHTML;
        btnPdf.innerHTML = `Generando .pdf...`;
        btnPdf.disabled = true;

        setTimeout(() => {
            btnPdf.innerHTML = originalText;
            btnPdf.disabled = false;
            alert("📥 Descarga de PDF iniciada.\n(En producción, Django usará librerías como 'reportlab' o 'WeasyPrint' para devolver el PDF renderizado).");
        }, 1000);
    });
});

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Menu toggle
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('openSidebar');
    const closeBtn = document.getElementById('closeSidebar');

    if (openBtn && sidebar) openBtn.addEventListener('click', () => sidebar.classList.add('active'));
    if (closeBtn && sidebar) closeBtn.addEventListener('click', () => sidebar.classList.remove('active'));

    // DOM Elements
    const tableBody = document.getElementById('cultivosTableBody');
    const btnNuevoCultivo = document.getElementById('btnNuevoCultivo');
    const modalCultivo = document.getElementById('modalCultivo');
    const btnCerrarModal = document.getElementById('btnCerrarModal');
    const formCultivo = document.getElementById('formCultivo');
    
    const inputId = document.getElementById('cultivoId');
    const inputNombre = document.getElementById('cultivoNombre');
    const inputVariedad = document.getElementById('cultivoVariedad');
    const modalTitle = document.getElementById('modalTitle');

    let cultivos = [];

    async function loadCultivos() {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/cultivos/`);
            cultivos = await res.json();
            renderTable();
        } catch(e) {
            console.error(e);
            tableBody.innerHTML = `<tr><td colspan="3" style="color:red; text-align:center;">Error cargando cultivos</td></tr>`;
        }
    }

    function renderTable() {
        tableBody.innerHTML = '';
        if(cultivos.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--color-text-muted);">No hay cultivos registrados.</td></tr>`;
            return;
        }

        cultivos.forEach(c => {
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td style="font-weight: 500; color: var(--color-text-title);">${c.nombre}</td>
                <td>${c.variedad || '-'}</td>
                <td>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="icon-btn icon-btn--small btn-edit" data-id="${c.id}" style="color: var(--color-primary);"><i data-lucide="edit-2"></i></button>
                        <button class="icon-btn icon-btn--small btn-delete" data-id="${c.id}" style="color: #EF4444;"><i data-lucide="trash-2"></i></button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        lucide.createIcons();
        attachTableEvents();
    }

    function attachTableEvents() {
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                const c = cultivos.find(x => x.id === id);
                if(c) {
                    modalTitle.textContent = 'Editar Cultivo';
                    inputId.value = c.id;
                    inputNombre.value = c.nombre;
                    inputVariedad.value = c.variedad || '';
                    modalCultivo.classList.add('active');
                }
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if(confirm('⚠️ ¿Seguro que deseas eliminar este cultivo?')) {
                    try {
                        const res = await fetch(`${CONFIG.API_BASE_URL}/cultivos/${id}/`, { method: 'DELETE' });
                        if(!res.ok) throw new Error();
                        alert('🗑️ Cultivo eliminado');
                        loadCultivos();
                    } catch(err) {
                        alert('❌ Error eliminando cultivo. Asegúrate de que no esté asignado a ningún sector.');
                    }
                }
            });
        });
    }

    // Modal Logic
    btnNuevoCultivo.addEventListener('click', () => {
        modalTitle.textContent = 'Nuevo Cultivo';
        formCultivo.reset();
        inputId.value = '';
        modalCultivo.classList.add('active');
    });

    btnCerrarModal.addEventListener('click', () => {
        modalCultivo.classList.remove('active');
    });

    modalCultivo.addEventListener('click', (e) => {
        if(e.target === modalCultivo) modalCultivo.classList.remove('active');
    });

    formCultivo.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            nombre: inputNombre.value,
            variedad: inputVariedad.value || null
        };

        const id = inputId.value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${CONFIG.API_BASE_URL}/cultivos/${id}/` : `${CONFIG.API_BASE_URL}/cultivos/`;

        const submitBtn = formCultivo.querySelector('button[type="submit"]');
        const origText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Guardando...';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if(!res.ok) throw new Error();
            
            modalCultivo.classList.remove('active');
            loadCultivos();
        } catch(err) {
            alert('❌ Error al guardar el cultivo');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origText;
        }
    });

    // INIT
    loadCultivos();
});

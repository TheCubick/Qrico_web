function actualizarRelojAdmin() {
    const contenedorReloj = document.getElementById('reloj-admin');
    if (!contenedorReloj) return;

    const ahora = new Date();
    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'short' };
    let fechaTexto = ahora.toLocaleDateString('es-ES', opcionesFecha);
    fechaTexto = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);

    const opcionesHora = { hour: '2-digit', minute: '2-digit' };
    const horaTexto = ahora.toLocaleTimeString('es-ES', opcionesHora);

    contenedorReloj.innerHTML = `<i class="fa-regular fa-clock"></i> <span>${fechaTexto} - ${horaTexto}</span>`;
}

function obtenerComandasGlobales() {
    const dato = localStorage.getItem('qrico_comandas');
    return dato ? JSON.parse(dato) : [
        {
            id: 1089,
            origen: 'Para llevar',
            estado: 'nuevos',
            total: 283.00,
            hora: '14:20',
            items: [
                { nombre: 'Enchiladas Toks', cantidad: 2, precio: 119.00 },
                { nombre: 'Café Americano', cantidad: 1, precio: 45.00 }
            ]
        }
    ];
}

function guardarComandasGlobales(comandas) {
    localStorage.setItem('qrico_comandas', JSON.stringify(comandas));
}

function obtenerMesasGlobales() {
    const dato = localStorage.getItem('qrico_mesas');
    return dato ? JSON.parse(dato) : [
        { id: '1', zona: 'salon', estado: 'libre', personas: 0, forma: 'cuadrada', capacidad: 4 },
        { id: '2', zona: 'salon', estado: 'ocupada', personas: 2, forma: 'cuadrada', capacidad: 4 },
        { id: '3', zona: 'salon', estado: 'libre', personas: 0, forma: 'cuadrada', capacidad: 4 },
        { id: '4', zona: 'salon', estado: 'pagando', personas: 4, forma: 'redonda', capacidad: 6 },
        { id: '5', zona: 'salon', estado: 'sucia', personas: 0, forma: 'redonda', capacidad: 4 },
        { id: 'T1', zona: 'terraza', estado: 'libre', personas: 0, forma: 'cuadrada', capacidad: 2 },
        { id: 'T2', zona: 'terraza', estado: 'ocupada', personas: 4, forma: 'cuadrada', capacidad: 4 },
        { id: 'T3', zona: 'terraza', estado: 'libre', personas: 0, forma: 'redonda', capacidad: 6 }
    ];
}

function guardarMesasGlobales(mesas) {
    localStorage.setItem('qrico_mesas', JSON.stringify(mesas));
}

let graficoVentas = null;
let graficoPlatillos = null;
let graficoRepVentas = null;
let graficoRepPagos = null;

function inicializarGraficas() {
    if (typeof Chart === 'undefined') return;

    if (graficoVentas) graficoVentas.destroy();
    if (graficoPlatillos) graficoPlatillos.destroy();

    const ctxVentas = document.getElementById('ventasChart');
    const ctxPlatillos = document.getElementById('platillosChart');

    if (ctxVentas) {
        graficoVentas = new Chart(ctxVentas, {
            type: 'line',
            data: {
                labels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'],
                datasets: [{
                    label: 'Ventas por Hora ($)',
                    data: [1200, 2500, 4800, 7500, 5200, 8900],
                    borderColor: '#F47920',
                    backgroundColor: 'rgba(244, 121, 32, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    if (ctxPlatillos) {
        graficoPlatillos = new Chart(ctxPlatillos, {
            type: 'doughnut',
            data: {
                labels: ['Enchiladas', 'Combos Pollo', 'Molletes', 'Bebidas'],
                datasets: [{
                    data: [45, 25, 20, 10],
                    backgroundColor: ['#F47920', '#10B981', '#3B82F6', '#F59E0B'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%'
            }
        });
    }
}

const productosPOS = [
    { id: 1, nombre: 'Enchiladas Toks', precio: 119.00, categoria: 'fuertes', imagen: 'https://saboresdemicocina.com/wp-content/uploads/2025/10/22queretaro-enchiladas-queretanas-68ed60c10ad5a-1.webp' },
    { id: 2, nombre: 'Combo Pechuga Crispy', precio: 360.80, categoria: 'combos', imagen: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSerpNuwj96HubTl-FnG08cIG4w3IAQxPFNV5kwPRsYZYhWo2JudJNd4vc&s=10' },
    { id: 3, nombre: 'Molletes Naturales', precio: 99.00, categoria: 'entradas', imagen: 'https://tropicalcheese.com/wp-content/uploads/2019/03/molletes.jpg' },
    { id: 4, nombre: 'Café Americano', precio: 45.00, categoria: 'bebidas', imagen: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=200&h=200&fit=crop' },
    { id: 5, nombre: 'Tacos de Pollo', precio: 125.00, categoria: 'fuertes', imagen: 'https://cdn.avena.io/avena-recipes-v2/2019/10/1571780755073.jpeg' },
    { id: 6, nombre: 'Limonada Natural', precio: 35.00, categoria: 'bebidas', imagen: 'https://enlacocina.telemesa.es/wp-content/uploads/2018/07/bebidas-refrescantes-992x640.jpg' }
];

let ticketActual = [];
let tipoOrdenActual = 'Comedor';
let mesaSeleccionada = null;
let mesaEnProceso = null;

function renderizarProductosPOS(filtro = 'todos') {
    const grid = document.getElementById('pos-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const productosFiltrados = filtro === 'todos' ? productosPOS : productosPOS.filter(p => p.categoria === filtro);

    productosFiltrados.forEach((prod, index) => {
        const item = document.createElement('div');
        item.className = 'pos-item';
        item.style.animationDelay = `${index * 0.05}s`;
        item.innerHTML = `
            <img src="${prod.imagen}" alt="${prod.nombre}">
            <div class="pos-item-info">
                <h4 style="font-size:0.9rem; margin-bottom:5px; color:#0F172A;">${prod.nombre}</h4>
                <span style="color:#F47920; font-weight:800;">$${prod.precio.toFixed(2)}</span>
            </div>
        `;
        item.addEventListener('click', () => agregarAlTicket(prod));
        grid.appendChild(item);
    });
}

window.modificarCantidadPOS = function(id, cambio) {
    const index = ticketActual.findIndex(item => item.id === id);
    if (index > -1) {
        ticketActual[index].cantidad += cambio;
        if (ticketActual[index].cantidad <= 0) ticketActual.splice(index, 1);
        actualizarTicketPOS();
    }
};

function agregarAlTicket(producto) {
    const index = ticketActual.findIndex(item => item.id === producto.id);
    if (index > -1) {
        ticketActual[index].cantidad += 1;
    } else {
        ticketActual.push({ ...producto, cantidad: 1 });
    }
    actualizarTicketPOS();
}

function actualizarTicketPOS() {
    const contenedorItems = document.getElementById('ticket-items');
    const subtotalEl = document.getElementById('ticket-subtotal');
    const ivaEl = document.getElementById('ticket-iva');
    const totalEl = document.getElementById('ticket-total');
    if (!contenedorItems || !subtotalEl || !ivaEl || !totalEl) return;

    if (ticketActual.length === 0) {
        contenedorItems.innerHTML = `
            <div style="text-align:center; color:#94A3B8; margin:auto;">
                <i class="fa-solid fa-utensils" style="font-size:3rem; margin-bottom:15px; opacity:0.5;"></i>
                <p>El ticket está vacío.<br>Selecciona productos del menú.</p>
            </div>
        `;
        subtotalEl.innerText = '$0.00';
        ivaEl.innerText = '$0.00';
        totalEl.innerText = '$0.00';
        return;
    }

    contenedorItems.innerHTML = '';
    let subtotal = 0;

    ticketActual.forEach((item, index) => {
        subtotal += item.precio * item.cantidad;
        const row = document.createElement('div');
        row.className = 'ticket-row';
        row.style.animationDelay = `${index * 0.05}s`;
        row.innerHTML = `
            <div style="flex:1;">
                <h5 style="font-size:0.85rem; color:#0F172A; margin:0; line-height:1.2;">${item.nombre}</h5>
                <span style="font-size:0.8rem; color:#64748B;">$${item.precio.toFixed(2)} c/u</span>
            </div>
            <div class="ticket-controls">
                <button onclick="modificarCantidadPOS(${item.id}, -1)"><i class="fa-solid fa-minus"></i></button>
                <span style="font-size:0.9rem; font-weight:600; width:15px; text-align:center;">${item.cantidad}</span>
                <button onclick="modificarCantidadPOS(${item.id}, 1)"><i class="fa-solid fa-plus"></i></button>
            </div>
            <div style="font-weight:700; width:70px; text-align:right; font-size:0.95rem; color:#0F172A;">
                $${(item.precio * item.cantidad).toFixed(2)}
            </div>
        `;
        contenedorItems.appendChild(row);
    });

    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    subtotalEl.innerText = `$${subtotal.toFixed(2)}`;
    ivaEl.innerText = `$${iva.toFixed(2)}`;
    totalEl.innerText = `$${total.toFixed(2)}`;
}

function inicializarPOS() {
    renderizarProductosPOS('todos');

    const botonesFiltro = document.querySelectorAll('.pos-cat-btn');
    botonesFiltro.forEach(btn => {
        btn.addEventListener('click', (e) => {
            botonesFiltro.forEach(b => b.classList.remove('activo'));
            e.currentTarget.classList.add('activo');
            renderizarProductosPOS(e.currentTarget.getAttribute('data-cat'));
        });
    });

    const botonesTipo = document.querySelectorAll('#botones-tipo-orden button');
    botonesTipo.forEach(btn => {
        btn.addEventListener('click', (e) => {
            botonesTipo.forEach(b => b.classList.remove('activo'));
            e.currentTarget.classList.add('activo');
            tipoOrdenActual = e.currentTarget.innerText.trim();
        });
    });

    const btnComandar = document.getElementById('btn-comandar-pos');
    const modalMesa = document.getElementById('modal-asignar-mesa');
    const btnCerrarMesa = document.getElementById('cerrar-modal-mesa-pos');
    const btnConfirmarComanda = document.getElementById('btn-confirmar-comanda');

    if (modalMesa && btnConfirmarComanda) {
        const gridMesasModal = document.querySelector('.grid-mesas-select');
        if (gridMesasModal) {
            const mesasGlobales = obtenerMesasGlobales();
            gridMesasModal.innerHTML = '';

            mesasGlobales.forEach(mesa => {
                const btn = document.createElement('button');
                btn.className = 'btn-mesa-select';
                btn.setAttribute('data-mesa', mesa.id);
                btn.innerText = `Mesa ${mesa.id}`;
                if (mesa.estado !== 'libre') {
                    btn.style.opacity = '0.5';
                    btn.title = 'Mesa ocupada';
                }

                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.btn-mesa-select').forEach(b => b.classList.remove('seleccionada'));
                    e.currentTarget.classList.add('seleccionada');
                    mesaSeleccionada = mesa.id;
                    btnConfirmarComanda.disabled = false;
                    btnConfirmarComanda.style.opacity = '1';
                });
                gridMesasModal.appendChild(btn);
            });
        }
    }

    if (btnComandar) {
        btnComandar.addEventListener('click', () => {
            if (ticketActual.length === 0) {
                alert('⚠️ El ticket está vacío. Agrega productos antes de comandar.');
                return;
            }

            if (tipoOrdenActual === 'Comedor') {
                if (modalMesa) modalMesa.classList.add('activo');
                mesaSeleccionada = null;
                document.querySelectorAll('.btn-mesa-select').forEach(b => b.classList.remove('seleccionada'));
                if (btnConfirmarComanda) {
                    btnConfirmarComanda.disabled = true;
                    btnConfirmarComanda.style.opacity = '0.5';
                }
            } else {
                enviarComandaAKDS(tipoOrdenActual);
            }
        });
    }

    if (modalMesa && btnCerrarMesa) {
        btnCerrarMesa.addEventListener('click', () => modalMesa.classList.remove('activo'));
    }

    if (modalMesa && btnConfirmarComanda) {
        btnConfirmarComanda.addEventListener('click', () => {
            enviarComandaAKDS(`Mesa ${mesaSeleccionada}`);
            modalMesa.classList.remove('activo');
        });
    }

    const btnCobrar = document.getElementById('btn-cobrar-pos');
    const modalCobro = document.getElementById('modal-cobro-pos');
    const btnCerrarCobro = document.getElementById('cerrar-modal-cobro');
    const tabEfectivo = document.getElementById('tab-efectivo');
    const tabTarjeta = document.getElementById('tab-tarjeta');
    const secEfectivo = document.getElementById('pago-efectivo-sec');
    const secTarjeta = document.getElementById('pago-tarjeta-sec');
    const inputRecibido = document.getElementById('input-monto-recibido');
    const lblCambio = document.getElementById('pago-cambio');
    const btnFinalizarCobro = document.getElementById('btn-finalizar-cobro');

    if (btnCobrar && modalCobro) {
        btnCobrar.addEventListener('click', () => {
            if (ticketActual.length === 0) {
                alert('⚠️ Agrega productos al ticket para poder cobrar.');
                return;
            }

            const subtotal = ticketActual.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
            const total = subtotal * 1.16;
            const modalTotal = document.getElementById('modal-cobro-total');
            if (modalTotal) modalTotal.innerText = `$${total.toFixed(2)}`;
            if (inputRecibido) inputRecibido.value = total.toFixed(2);
            if (lblCambio) lblCambio.innerText = '$0.00';

            modalCobro.classList.add('activo');
        });

        if (btnCerrarCobro) btnCerrarCobro.addEventListener('click', () => modalCobro.classList.remove('activo'));

        if (tabEfectivo && tabTarjeta && secEfectivo && secTarjeta) {
            tabEfectivo.addEventListener('click', () => {
                tabEfectivo.classList.add('activo');
                tabTarjeta.classList.remove('activo');
                secEfectivo.style.display = 'block';
                secTarjeta.style.display = 'none';
            });

            tabTarjeta.addEventListener('click', () => {
                tabTarjeta.classList.add('activo');
                tabEfectivo.classList.remove('activo');
                secEfectivo.style.display = 'none';
                secTarjeta.style.display = 'flex';
            });
        }

        if (inputRecibido && lblCambio) {
            inputRecibido.addEventListener('input', () => {
                const subtotal = ticketActual.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
                const total = subtotal * 1.16;
                const recibido = parseFloat(inputRecibido.value) || 0;
                const cambio = recibido - total;

                lblCambio.innerText = cambio >= 0 ? `$${cambio.toFixed(2)}` : '$0.00';
                lblCambio.style.color = cambio >= 0 ? '#10B981' : '#EF4444';
            });
        }

        if (btnFinalizarCobro) {
            btnFinalizarCobro.addEventListener('click', () => {
                alert('💰 ¡Cobro registrado con éxito! Ticket impreso.');
                modalCobro.classList.remove('activo');
                ticketActual = [];
                actualizarTicketPOS();
            });
        }
    }
}

function enviarComandaAKDS(origen) {
    const comandas = obtenerComandasGlobales();
    const subtotal = ticketActual.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
    const total = subtotal * 1.16;
    const ahora = new Date();
    const horaTexto = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const nuevaComanda = {
        id: Math.floor(1000 + Math.random() * 9000),
        origen,
        estado: 'nuevos',
        items: [...ticketActual],
        total,
        hora: horaTexto
    };

    comandas.unshift(nuevaComanda);
    guardarComandasGlobales(comandas);

    if (origen.includes('Mesa')) {
        const numeroMesa = origen.split(' ')[1];
        const mesas = obtenerMesasGlobales();
        const indexMesa = mesas.findIndex(m => m.id === numeroMesa);

        if (indexMesa > -1) {
            mesas[indexMesa].estado = 'ocupada';
            if (mesas[indexMesa].personas === 0) mesas[indexMesa].personas = 2;
            guardarMesasGlobales(mesas);
        }
    }

    alert(`✅ ¡Comanda #${nuevaComanda.id} enviada a Cocina (KDS)!\nDestino: ${origen}`);
    ticketActual = [];
    actualizarTicketPOS();
}

function inicializarKDS() {
    const comandas = obtenerComandasGlobales();

    const bodyNuevos = document.getElementById('kds-body-nuevos');
    const bodyPreparando = document.getElementById('kds-body-preparando');
    const bodyListos = document.getElementById('kds-body-listos');

    if (!bodyNuevos || !bodyPreparando || !bodyListos) return;

    bodyNuevos.innerHTML = '';
    bodyPreparando.innerHTML = '';
    bodyListos.innerHTML = '';

    let countNuevos = 0;
    let countPrep = 0;
    let countListos = 0;

    comandas.forEach((comanda, index) => {
        const card = document.createElement('div');
        card.className = `kds-card ${comanda.estado === 'nuevos' ? 'urgente' : comanda.estado === 'preparando' ? 'normal' : 'listo'}`;
        card.style.animationDelay = `${index * 0.05}s`;

        const itemsHTML = comanda.items.map(item => `<li><span class="qty">${item.cantidad}x</span> ${item.nombre}</li>`).join('');

        let botonPaso = '';
        if (comanda.estado === 'nuevos') {
            countNuevos += 1;
            botonPaso = `<button class="btn-kds-step" style="background:#FEF3C7; color:#B45309;" onclick="moverEstadoKDS(${comanda.id}, 'preparando', this)">Iniciar 🍳</button>`;
        } else if (comanda.estado === 'preparando') {
            countPrep += 1;
            botonPaso = `<button class="btn-kds-step" style="background:#D1FAE5; color:#047857;" onclick="moverEstadoKDS(${comanda.id}, 'listos', this)">Listo ✅</button>`;
        } else {
            countListos += 1;
            botonPaso = `<span style="font-size:0.75rem; color:#10B981; font-weight:bold;">Completado</span>`;
        }

        card.innerHTML = `
            <div class="card-top">
                <div>
                    <h3>#${comanda.id}</h3>
                    <span class="badge-origen-kds ${comanda.origen.includes('Mesa') ? 'badge-mesa' : 'badge-llevar'}">${comanda.origen}</span>
                </div>
                <span style="font-size:0.8rem; font-weight:700; color:#64748B;"><i class="fa-regular fa-clock"></i> ${comanda.hora}</span>
            </div>
            <div class="card-items">
                <ul>${itemsHTML}</ul>
            </div>
            <div class="kds-card-actions">
                ${botonPaso}
            </div>
        `;

        if (comanda.estado === 'nuevos') bodyNuevos.appendChild(card);
        else if (comanda.estado === 'preparando') bodyPreparando.appendChild(card);
        else bodyListos.appendChild(card);
    });

    const countNuevosEl = document.getElementById('kds-count-nuevos');
    const countPreparandoEl = document.getElementById('kds-count-preparando');
    const countListosEl = document.getElementById('kds-count-listos');

    if (countNuevosEl) countNuevosEl.innerText = `🔴 Por Preparar (${countNuevos})`;
    if (countPreparandoEl) countPreparandoEl.innerText = `🍳 En Fuego (${countPrep})`;
    if (countListosEl) countListosEl.innerText = `✅ Listos (${countListos})`;
}

window.moverEstadoKDS = function(id, nuevoEstado, btnElement) {
    if (btnElement) {
        const card = btnElement.closest('.kds-card');
        if (card) {
            card.style.transform = 'scale(0.8)';
            card.style.opacity = '0';
        }
    }

    setTimeout(() => {
        const comandas = obtenerComandasGlobales();
        const index = comandas.findIndex(c => c.id === id);
        if (index > -1) {
            comandas[index].estado = nuevoEstado;
            guardarComandasGlobales(comandas);
            inicializarKDS();
        }
    }, btnElement ? 250 : 0);
};

function inicializarMesas() {
    const gridSalon = document.getElementById('grid-salon');
    const gridTerraza = document.getElementById('grid-terraza');
    const panel = document.getElementById('mesa-detalle-panel');
    const btnCerrar = document.getElementById('cerrar-panel-mesa');
    const modalMesa = document.getElementById('modal-abrir-mesa');
    const btnCerrarMesa = document.getElementById('btn-cancelar-mesa');
    const btnConfirmarAbrir = document.getElementById('btn-confirmar-abrir');
    const inputPersonas = document.getElementById('input-personas');

    if (!gridSalon || !gridTerraza) return;

    const mesasGlobales = obtenerMesasGlobales();
    gridSalon.innerHTML = '';
    gridTerraza.innerHTML = '';

    mesasGlobales.forEach((mesa, index) => {
        const div = document.createElement('div');
        div.className = `mesa-item ${mesa.forma} ${mesa.estado}`;
        div.style.animationDelay = `${index * 0.05}s`;

        const iconoCapacidad = mesa.estado === 'sucia'
            ? '<i class="fa-solid fa-broom"></i> Limpiar'
            : `<i class="fa-solid fa-user"></i> ${mesa.personas > 0 ? mesa.personas + '/' : ''}${mesa.capacidad}`;
        let badgeHTML = '';

        if (mesa.estado === 'ocupada') badgeHTML = '<div class="tiempo-badge" style="color:#D97706;">Comiendo</div>';
        if (mesa.estado === 'pagando') badgeHTML = '<div class="tiempo-badge" style="color:#2563EB;">Ticket</div>';

        div.innerHTML = `
            ${badgeHTML}
            <span class="mesa-num">${mesa.id}</span>
            <span class="mesa-capacidad">${iconoCapacidad}</span>
        `;

        div.addEventListener('click', () => renderizarDetalleMesa(mesa.id));

        if (mesa.zona === 'salon') gridSalon.appendChild(div);
        else gridTerraza.appendChild(div);
    });

    if (btnCerrar) {
        btnCerrar.addEventListener('click', () => {
            if (panel) panel.style.display = 'none';
        });
    }

    if (modalMesa && btnCerrarMesa && btnConfirmarAbrir && inputPersonas) {
        btnCerrarMesa.addEventListener('click', () => modalMesa.classList.remove('activo'));
        btnConfirmarAbrir.addEventListener('click', () => {
            cambiarEstadoMesa(mesaEnProceso, 'ocupada', parseInt(inputPersonas.value, 10));
            modalMesa.classList.remove('activo');
        });
    }

    const modalCobroMesa = document.getElementById('modal-cobro-mesa');
    const btnCerrarCobroMesa = document.getElementById('cerrar-modal-cobro-mesa');
    const tabMesaEfectivo = document.getElementById('tab-mesa-efectivo');
    const tabMesaTarjeta = document.getElementById('tab-mesa-tarjeta');
    const secMesaEfectivo = document.getElementById('sec-mesa-efectivo');
    const secMesaTarjeta = document.getElementById('sec-mesa-tarjeta');
    const inputMesaRecibido = document.getElementById('input-cobro-mesa-recibido');
    const lblMesaCambio = document.getElementById('cobro-mesa-cambio');
    const btnFinalizarCobroMesa = document.getElementById('btn-finalizar-cobro-mesa');

    if (modalCobroMesa && !modalCobroMesa.dataset.bound) {
        if (btnCerrarCobroMesa) {
            btnCerrarCobroMesa.addEventListener('click', () => modalCobroMesa.classList.remove('activo'));
        }

        if (tabMesaEfectivo && tabMesaTarjeta && secMesaEfectivo && secMesaTarjeta) {
            tabMesaEfectivo.addEventListener('click', () => {
                tabMesaEfectivo.style.background = '#10B981';
                tabMesaEfectivo.style.color = 'white';
                tabMesaTarjeta.style.background = '#F8FAFC';
                tabMesaTarjeta.style.color = '#475569';
                secMesaEfectivo.style.display = 'block';
                secMesaTarjeta.style.display = 'none';
            });

            tabMesaTarjeta.addEventListener('click', () => {
                tabMesaTarjeta.style.background = '#10B981';
                tabMesaTarjeta.style.color = 'white';
                tabMesaEfectivo.style.background = '#F8FAFC';
                tabMesaEfectivo.style.color = '#475569';
                secMesaEfectivo.style.display = 'none';
                secMesaTarjeta.style.display = 'flex';
            });
        }

        if (inputMesaRecibido && lblMesaCambio) {
            inputMesaRecibido.addEventListener('input', () => {
                const total = parseFloat(inputMesaRecibido.getAttribute('data-total')) || 0;
                const recibido = parseFloat(inputMesaRecibido.value) || 0;
                const cambio = recibido - total;

                lblMesaCambio.innerText = cambio >= 0 ? `$${cambio.toFixed(2)}` : '$0.00';
                lblMesaCambio.style.color = cambio >= 0 ? '#10B981' : '#EF4444';
            });
        }

        if (btnFinalizarCobroMesa) {
            btnFinalizarCobroMesa.addEventListener('click', () => {
                if (!mesaEnProceso) return;

                let comandas = obtenerComandasGlobales();
                comandas = comandas.filter(c => c.origen !== `Mesa ${mesaEnProceso}`);
                guardarComandasGlobales(comandas);

                alert(`✅ ¡Cobro exitoso! Se liberó la Mesa ${mesaEnProceso}. Cambió a estado: Sucia / Por limpiar.`);
                cambiarEstadoMesa(mesaEnProceso, 'sucia');
                modalCobroMesa.classList.remove('activo');
            });
        }

        modalCobroMesa.dataset.bound = 'true';
    }

    const btnNuevaMesa = document.getElementById('btn-nueva-mesa');
    const modalNuevaMesa = document.getElementById('modal-nueva-mesa');

    if (btnNuevaMesa && modalNuevaMesa) {
        btnNuevaMesa.addEventListener('click', () => modalNuevaMesa.classList.add('activo'));

        const btnCerrarNueva = document.getElementById('btn-cerrar-nueva-mesa');
        if (btnCerrarNueva) {
            btnCerrarNueva.addEventListener('click', () => modalNuevaMesa.classList.remove('activo'));
        }

        const btnGuardarNueva = document.getElementById('btn-guardar-nueva-mesa');
        if (btnGuardarNueva) {
            btnGuardarNueva.addEventListener('click', () => {
                const idVal = document.getElementById('nm-id').value.trim();
                const zonaVal = document.getElementById('nm-zona').value;
                const capacidadVal = parseInt(document.getElementById('nm-capacidad').value, 10) || 4;
                const formaVal = document.getElementById('nm-forma').value;

                if (!idVal) return alert('⚠️ Por favor ingresa un identificador para la mesa (Ej. 10, VIP).');

                let mesasActuales = obtenerMesasGlobales();

                if (mesasActuales.find(m => m.id.toLowerCase() === idVal.toLowerCase())) {
                    return alert('❌ ¡Ese número o nombre de mesa ya existe!');
                }

                mesasActuales.push({
                    id: idVal.toUpperCase(),
                    zona: zonaVal,
                    estado: 'libre',
                    personas: 0,
                    forma: formaVal,
                    capacidad: capacidadVal
                });

                guardarMesasGlobales(mesasActuales);

                modalNuevaMesa.classList.remove('activo');
                document.getElementById('nm-id').value = '';
                inicializarMesas();
            });
        }
    }
}

window.renderizarDetalleMesa = function(idMesa) {
    const mesasGlobales = obtenerMesasGlobales();
    const mesa = mesasGlobales.find(m => m.id === idMesa);
    const panel = document.getElementById('mesa-detalle-panel');
    const contenidoDinamico = document.getElementById('panel-contenido-dinamico');

    if (!mesa || !panel || !contenidoDinamico) return;

    document.getElementById('panel-mesa-titulo').innerText = `Mesa ${mesa.id}`;
    const badgeEstado = document.getElementById('panel-mesa-estado');
    badgeEstado.className = `estado-badge ${mesa.estado === 'libre' ? 'nuevo' : mesa.estado === 'ocupada' ? 'preparando' : mesa.estado === 'pagando' ? 'listo' : 'sucia'}`;
    badgeEstado.innerText = mesa.estado.toUpperCase();

    let htmlContenido = '';

    if (mesa.estado === 'libre') {
        htmlContenido = `
            <div style="text-align:center; padding: 40px 10px;">
                <i class="fa-solid fa-utensils" style="font-size:3rem; color:#CBD5E1; margin-bottom:15px;"></i>
                <h3 style="color:#0F172A; margin-bottom:5px;">Mesa Disponible</h3>
                <p style="color:#64748B; font-size:0.9rem; margin-bottom:20px;">Esta mesa está lista para recibir nuevos comensales.</p>
                <button onclick="mostrarModalAbrirMesa('${mesa.id}')" class="btn-primario btn-animado" style="background:#F47920; justify-content:center; width:100%;"><i class="fa-solid fa-door-open"></i> Abrir Mesa</button>
            </div>
        `;
    } else if (mesa.estado === 'ocupada' || mesa.estado === 'pagando') {
        const comandas = obtenerComandasGlobales();
        const comandasMesa = comandas.filter(c => c.origen === `Mesa ${mesa.id}`);
        let itemsHTML = '';
        let totalCuenta = 0;

        if (comandasMesa.length > 0) {
            comandasMesa.forEach(comanda => {
                comanda.items.forEach(item => {
                    totalCuenta += item.precio * item.cantidad;
                    itemsHTML += `
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px dashed #E2E8F0; padding-bottom:10px;">
                        <div><span style="font-weight:700;">${item.cantidad}x</span> ${item.nombre}</div>
                        <div style="font-weight:600;">$${(item.precio * item.cantidad).toFixed(2)}</div>
                    </div>`;
                });
            });
            totalCuenta *= 1.16;
        } else {
            itemsHTML = '<p style="color:#94A3B8; text-align:center;">Mesa abierta sin pedidos en KDS.</p>';
        }

        const botonesAccion = mesa.estado === 'ocupada'
            ? `<button class="btn-primario btn-animado" onclick="cambiarEstadoMesa('${mesa.id}', 'pagando')" style="background:#3B82F6; justify-content:center; width:100%;"><i class="fa-solid fa-receipt"></i> Imprimir Cuenta</button>`
            : `<button class="btn-primario btn-animado" onclick="abrirModalCobroMesa('${mesa.id}', ${totalCuenta})" style="background:#10B981; justify-content:center; width:100%;"><i class="fa-solid fa-money-bill"></i> Cobrar y Liberar</button>`;

        htmlContenido = `
            <div>
                <div style="display:flex; justify-content:space-between; margin-bottom:20px; color:#64748B; font-size:0.9rem;">
                    <span><i class="fa-solid fa-users"></i> ${mesa.personas} Personas</span>
                    <span><i class="fa-solid fa-chair"></i> Cap: ${mesa.capacidad}</span>
                </div>
                <h4 style="font-size:0.85rem; color:#94A3B8; text-transform:uppercase; margin-bottom:10px;">Consumo Actual</h4>
                <div style="border:1px solid #E2E8F0; border-radius:8px; padding:15px; margin-bottom:20px; max-height:200px; overflow-y:auto;">
                    ${itemsHTML}
                    <div style="margin-top:15px; padding-top:15px; border-top:2px solid #E2E8F0; display:flex; justify-content:space-between; font-size:1.2rem; font-weight:800; color:#0F172A;">
                        <span>Total (c/ IVA)</span>
                        <span>$${totalCuenta.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            <div>${botonesAccion}</div>
        `;
    } else if (mesa.estado === 'sucia') {
        htmlContenido = `
            <div style="text-align:center; padding: 40px 10px;">
                <i class="fa-solid fa-spray-can-sparkles" style="font-size:3rem; color:#EF4444; margin-bottom:15px; opacity:0.8;"></i>
                <h3 style="color:#0F172A; margin-bottom:5px;">Mesa por Limpiar</h3>
                <p style="color:#64748B; font-size:0.9rem; margin-bottom:20px;">Los clientes se han retirado. Requiere limpieza.</p>
                <button onclick="cambiarEstadoMesa('${mesa.id}', 'libre')" class="btn-primario btn-animado" style="background:#10B981; justify-content:center; width:100%;"><i class="fa-solid fa-broom"></i> Marcar Limpia</button>
            </div>
        `;
    }

    contenidoDinamico.innerHTML = htmlContenido;
    panel.style.display = 'flex';
};

window.abrirModalCobroMesa = function(idMesa, total) {
    mesaEnProceso = idMesa;
    const modal = document.getElementById('modal-cobro-mesa');

    document.getElementById('lbl-cobro-mesa-id').innerText = idMesa;
    document.getElementById('cobro-mesa-total').innerText = `$${total.toFixed(2)}`;

    const inputRecibido = document.getElementById('input-cobro-mesa-recibido');
    if (inputRecibido) {
        inputRecibido.value = total.toFixed(2);
        inputRecibido.setAttribute('data-total', total);
    }

    const lblCambio = document.getElementById('cobro-mesa-cambio');
    if (lblCambio) {
        lblCambio.innerText = '$0.00';
        lblCambio.style.color = '#10B981';
    }

    const tabEfectivo = document.getElementById('tab-mesa-efectivo');
    if (tabEfectivo) tabEfectivo.click();

    if (modal) modal.classList.add('activo');
};

window.mostrarModalAbrirMesa = function(idMesa) {
    mesaEnProceso = idMesa;
    const lblModalMesa = document.getElementById('lbl-modal-mesa');
    const inputPersonas = document.getElementById('input-personas');
    const modal = document.getElementById('modal-abrir-mesa');
    if (lblModalMesa) lblModalMesa.innerText = idMesa;
    if (inputPersonas) inputPersonas.value = 2;
    if (modal) modal.classList.add('activo');
};

window.cambiarEstadoMesa = function(idMesa, nuevoEstado, personas = 0) {
    const mesasGlobales = obtenerMesasGlobales();
    const index = mesasGlobales.findIndex(m => m.id === idMesa);
    if (index > -1) {
        mesasGlobales[index].estado = nuevoEstado;
        if (nuevoEstado === 'libre' || nuevoEstado === 'sucia') {
            mesasGlobales[index].personas = 0;
        } else if (personas > 0) {
            mesasGlobales[index].personas = personas;
        }
        guardarMesasGlobales(mesasGlobales);
        inicializarMesas();
        const panel = document.getElementById('mesa-detalle-panel');
        if (panel) {
            if (nuevoEstado === 'libre') panel.style.display = 'none';
            else renderizarDetalleMesa(idMesa);
        }
    }
};

function inicializarMenuStock() {
    const btnNuevo = document.getElementById('btn-nuevo-prod');
    const modalProd = document.getElementById('modal-form-producto');
    const btnCerrar = document.getElementById('cerrar-modal-prod');
    const btnCancelar = document.getElementById('btn-cancelar-prod');

    if (btnNuevo && modalProd) {
        btnNuevo.addEventListener('click', () => modalProd.classList.add('activo'));
        const cerrarProd = () => modalProd.classList.remove('activo');
        if (btnCerrar) btnCerrar.addEventListener('click', cerrarProd);
        if (btnCancelar) btnCancelar.addEventListener('click', cerrarProd);
        modalProd.addEventListener('click', (e) => { if (e.target === modalProd) cerrarProd(); });
    }

    const switches = document.querySelectorAll('.toggle-stock');
    switches.forEach(btnSwitch => {
        btnSwitch.addEventListener('change', (e) => {
            const tdPadre = e.target.closest('td');
            const textoEstado = tdPadre?.querySelector('.estado-texto');
            if (!textoEstado) return;

            if (e.target.checked) {
                textoEstado.innerText = 'ACTIVO';
                textoEstado.style.color = '#10B981';
            } else {
                textoEstado.innerText = 'AGOTADO';
                textoEstado.style.color = '#EF4444';
            }
        });
    });
}

function inicializarPersonal() {
    const btnNuevo = document.getElementById('btn-nuevo-empleado');
    const modalEmp = document.getElementById('modal-form-empleado');
    const btnCerrar = document.getElementById('cerrar-modal-emp');
    const btnCancelar = document.getElementById('btn-cancelar-emp');

    if (btnNuevo && modalEmp) {
        btnNuevo.addEventListener('click', () => modalEmp.classList.add('activo'));
        const cerrarEmp = () => modalEmp.classList.remove('activo');
        if (btnCerrar) btnCerrar.addEventListener('click', cerrarEmp);
        if (btnCancelar) btnCancelar.addEventListener('click', cerrarEmp);
        modalEmp.addEventListener('click', (e) => { if (e.target === modalEmp) cerrarEmp(); });
    }
}

function inicializarReportes() {
    if (typeof Chart === 'undefined') return;
    if (graficoRepVentas) graficoRepVentas.destroy();
    if (graficoRepPagos) graficoRepPagos.destroy();

    const ctxVentas = document.getElementById('reporteVentasChart');
    const ctxPagos = document.getElementById('reportePagosChart');

    if (ctxVentas) {
        graficoRepVentas = new Chart(ctxVentas, {
            type: 'bar',
            data: {
                labels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
                datasets: [{
                    label: 'Ventas Totales ($)',
                    data: [12500, 14200, 11800, 15900, 22400, 28900, 24700],
                    backgroundColor: '#3B82F6',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    if (ctxPagos) {
        graficoRepPagos = new Chart(ctxPagos, {
            type: 'pie',
            data: {
                labels: ['Tarjeta (65%)', 'Efectivo (25%)', 'Transferencia (10%)'],
                datasets: [{
                    data: [65, 25, 10],
                    backgroundColor: ['#10B981', '#F59E0B', '#6366F1'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

function inicializarConfiguracion() {
    const btnGuardar = document.getElementById('btn-guardar-config');
    if (btnGuardar) {
        btnGuardar.addEventListener('click', () => {
            const originalHTML = btnGuardar.innerHTML;
            btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            btnGuardar.style.opacity = '0.8';
            setTimeout(() => {
                btnGuardar.innerHTML = '<i class="fa-solid fa-check"></i> ¡Guardado!';
                btnGuardar.style.background = '#10B981';
                btnGuardar.style.opacity = '1';
                setTimeout(() => {
                    btnGuardar.innerHTML = originalHTML;
                    btnGuardar.style.background = '#F47920';
                }, 2500);
            }, 1000);
        });
    }
}

function simularDescarga(btnElement) {
    if (!btnElement) return;
    const originalHTML = btnElement.innerHTML;
    const originalBg = btnElement.style.background || '';
    const originalColor = btnElement.style.color || '';

    btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    btnElement.style.opacity = '0.8';
    btnElement.disabled = true;

    setTimeout(() => {
        btnElement.innerHTML = '<i class="fa-solid fa-circle-check"></i> Descargado';
        btnElement.style.background = '#10B981';
        btnElement.style.color = '#FFFFFF';
        btnElement.style.borderColor = '#10B981';
        btnElement.style.opacity = '1';

        setTimeout(() => {
            btnElement.innerHTML = originalHTML;
            btnElement.style.background = originalBg;
            btnElement.style.color = originalColor;
            btnElement.style.borderColor = '';
            btnElement.disabled = false;
        }, 3000);
    }, 1500);
}

function cargarVista(nombreVista) {
    const contenedor = document.getElementById('admin-main-content');
    if (!contenedor) return;

    contenedor.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#94A3B8;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';

    fetch(`admin_views/${nombreVista}.html`)
        .then(respuesta => {
            if (!respuesta.ok) throw new Error(`HTTP error! status: ${respuesta.status}`);
            return respuesta.text();
        })
        .then(html => {
            contenedor.innerHTML = html;

            if (nombreVista === 'dashboard') {
                setTimeout(() => {
                    inicializarGraficas();
                    const btnCorte = document.getElementById('btn-corte-caja');
                    if (btnCorte) btnCorte.addEventListener('click', () => simularDescarga(btnCorte));
                }, 100);
            }
            if (nombreVista === 'pos') setTimeout(inicializarPOS, 100);
            if (nombreVista === 'kds') setTimeout(inicializarKDS, 100);
            if (nombreVista === 'mesas') setTimeout(inicializarMesas, 100);
            if (nombreVista === 'menu_stock') setTimeout(inicializarMenuStock, 100);
            if (nombreVista === 'personal') setTimeout(inicializarPersonal, 100);
            if (nombreVista === 'reportes') {
                setTimeout(() => {
                    inicializarReportes();
                    const btnExcel = document.getElementById('btn-exportar-excel');
                    const btnPdf = document.getElementById('btn-exportar-pdf');
                    if (btnExcel) btnExcel.addEventListener('click', () => simularDescarga(btnExcel));
                    if (btnPdf) btnPdf.addEventListener('click', () => simularDescarga(btnPdf));
                }, 100);
            }
            if (nombreVista === 'configuracion') setTimeout(inicializarConfiguracion, 100);
        })
        .catch(error => {
            console.error('Error cargando vista:', error);
            contenedor.innerHTML = `
                <div style="text-align:center; margin-top:50px;">
                    <h2><i class="fa-solid fa-person-digging"></i> Módulo en Construcción</h2>
                    <p style="color:#64748B; margin-top:10px;">No se encontró el archivo: <b>admin_views/${nombreVista}.html</b></p>
                    <p style="color:#EF4444; font-size:0.8rem; margin-top:5px;">Verifica que la carpeta 'admin_views' exista dentro de 'html' y contenga este archivo.</p>
                </div>
            `;
        });
}

function configurarNavegacionSidebar() {
    const links = document.querySelectorAll('.nav-item');
    const sidebarContainer = document.getElementById('sidebar-container');
    const overlaySidebar = document.getElementById('overlay-sidebar');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            links.forEach(l => l.classList.remove('activo'));
            link.classList.add('activo');
            cargarVista(link.getAttribute('data-view'));

            // STREAMING_CHUNK: Cerrar el menú automáticamente en móvil al elegir una opción
            if (window.innerWidth <= 768 && sidebarContainer && overlaySidebar) {
                sidebarContainer.classList.remove('activo');
                overlaySidebar.classList.remove('activo');
            }
        });
    });
}

/* STREAMING_CHUNK: Base de Datos de Usuarios y Lógica de Accesos */
const usuariosAutorizados = [
    { pin: '8092', nombre: 'Alejandro M.', rol: 'Gerente General', vistaInicial: 'dashboard', accesos: ['dashboard', 'pos', 'kds', 'mesas', 'menu_stock', 'personal', 'reportes', 'configuracion'] },
    { pin: '1455', nombre: 'María G.', rol: 'Caja Turno 1', vistaInicial: 'pos', accesos: ['pos', 'mesas'] },
    { pin: '3321', nombre: 'Juan P.', rol: 'Chef Ejecutivo', vistaInicial: 'kds', accesos: ['kds'] },
    { pin: '9901', nombre: 'Ana S.', rol: 'Mesero Salón', vistaInicial: 'mesas', accesos: ['mesas', 'pos'] }
];

function inicializarBloqueoSeguridad() {
    let pinIngresado = '';
    const pantallaBloqueo = document.getElementById('pantalla-bloqueo');
    const displayPin = document.getElementById('pin-display');
    const botonesPin = document.querySelectorAll('.pin-btn');
    const btnBorrar = document.getElementById('btn-borrar-pin');

    const actualizarDisplay = () => {
        let mostrar = '';
        for (let i = 0; i < 4; i++) {
            mostrar += (i < pinIngresado.length) ? '●' : '-';
        }
        if (displayPin) {
            displayPin.textContent = mostrar;
            displayPin.classList.remove('error');
        }
    };

    const iluminarBotonPantalla = (boton) => {
        if (!boton) return;
        boton.style.transform = 'scale(0.95)';
        boton.style.background = '#F47920';
        boton.style.borderColor = '#F47920';
        setTimeout(() => {
            boton.style.transform = '';
            boton.style.background = '';
            boton.style.borderColor = '';
        }, 150);
    };

    botonesPin.forEach(btn => {
        if (btn.id !== 'btn-borrar-pin' && btn.textContent.trim() !== '') {
            btn.addEventListener('click', () => {
                procesarIngreso(btn.textContent.trim());
            });
        }
    });

    if (btnBorrar) {
        btnBorrar.addEventListener('click', () => {
            procesarBorrado();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (pantallaBloqueo && !pantallaBloqueo.classList.contains('oculto')) {
            const tecla = e.key;

            if (tecla >= '0' && tecla <= '9') {
                procesarIngreso(tecla);
                const botonVisual = Array.from(botonesPin).find(b => b.textContent.trim() === tecla);
                iluminarBotonPantalla(botonVisual);
            } else if (tecla === 'Backspace' || tecla === 'Delete') {
                procesarBorrado();
                iluminarBotonPantalla(btnBorrar);
            }
        }
    });

    function procesarIngreso(numero) {
        if (pinIngresado.length < 4) {
            pinIngresado += numero;
            actualizarDisplay();

            if (pinIngresado.length === 4) {
                validarAcceso(pinIngresado);
            }
        }
    }

    function procesarBorrado() {
        if (pinIngresado.length > 0) {
            pinIngresado = pinIngresado.slice(0, -1);
            actualizarDisplay();
        }
    }

    function validarAcceso(pin) {
        const usuarioEncontrado = usuariosAutorizados.find(u => u.pin === pin);

        if (!pantallaBloqueo || !displayPin) return;

        if (usuarioEncontrado) {
            displayPin.style.color = '#10B981';

            setTimeout(() => {
                pantallaBloqueo.classList.add('oculto');
            }, 300);

            const lblName = document.getElementById('nombre-usuario');
            const lblRole = document.getElementById('rol-usuario');
            const imgAvatar = document.getElementById('avatar-usuario');
            const lblDropdownName = document.getElementById('dropdown-nombre');

            if (lblName) lblName.textContent = usuarioEncontrado.nombre;
            if (lblRole) lblRole.textContent = usuarioEncontrado.rol;
            if (lblDropdownName) lblDropdownName.textContent = usuarioEncontrado.nombre;

            if (imgAvatar) {
                const nombreUrl = encodeURIComponent(usuarioEncontrado.nombre);
                imgAvatar.src = `https://ui-avatars.com/api/?name=${nombreUrl}&background=F47920&color=fff&bold=true`;
            }

            const enlacesMenu = document.querySelectorAll('.nav-item');
            enlacesMenu.forEach(enlace => {
                const vistaRequerida = enlace.getAttribute('data-view');
                if (usuarioEncontrado.accesos.includes(vistaRequerida)) {
                    enlace.style.display = 'flex';
                } else {
                    enlace.style.display = 'none';
                }
                enlace.classList.remove('activo');
            });

            const primerEnlace = document.querySelector(`.nav-item[data-view="${usuarioEncontrado.vistaInicial}"]`);
            if (primerEnlace) {
                primerEnlace.classList.add('activo');
                cargarVista(usuarioEncontrado.vistaInicial);
            }
        } else {
            displayPin.classList.add('error');
            setTimeout(() => {
                pinIngresado = '';
                actualizarDisplay();
            }, 500);
        }
    }

    const btnProfileMenu = document.getElementById('btn-profile-menu');
    const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');

    if (btnProfileMenu) {
        btnProfileMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            btnProfileMenu.classList.toggle('activo');
        });

        document.addEventListener('click', (e) => {
            if (!btnProfileMenu.contains(e.target)) {
                btnProfileMenu.classList.remove('activo');
            }
        });
    }

    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', (e) => {
            e.preventDefault();
            if (btnProfileMenu) btnProfileMenu.classList.remove('activo');

            if (pantallaBloqueo) {
                pantallaBloqueo.classList.remove('oculto');
                pinIngresado = '';
                actualizarDisplay();
            }

            const contenedor = document.getElementById('admin-main-content');
            if (contenedor) contenedor.innerHTML = '';
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    actualizarRelojAdmin();
    setInterval(actualizarRelojAdmin, 1000);

    const sidebarContainer = document.getElementById('sidebar-container');
    const overlaySidebar = document.getElementById('overlay-sidebar');
    const btnMenuMovil = document.getElementById('btn-menu-movil');

    // STREAMING_CHUNK: Lógica del botón hamburguesa
    if (btnMenuMovil && sidebarContainer && overlaySidebar) {
        btnMenuMovil.addEventListener('click', () => {
            sidebarContainer.classList.add('activo');
            overlaySidebar.classList.add('activo');
        });

        // Cerrar al tocar el fondo oscuro
        overlaySidebar.addEventListener('click', () => {
            sidebarContainer.classList.remove('activo');
            overlaySidebar.classList.remove('activo');
        });
    }

    if (sidebarContainer) {
        fetch('admin_sidebar.html')
            .then(res => res.text())
            .then(html => {
                sidebarContainer.innerHTML = html;
                configurarNavegacionSidebar();
                inicializarBloqueoSeguridad(); 
            });
    }
});

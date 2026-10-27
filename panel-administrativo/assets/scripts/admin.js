/* =====================================================================
   Q-RICO · Panel del restaurante (SPA)
   Login por PIN, router de vistas, POS, KDS, mesas + QR, menú y stock,
   personal, reportes con corte de caja en PDF y configuración SaaS.
   Toda la información vive en qrico_saas_store (shared/js/store.js).
   ===================================================================== */
(function () {
    'use strict';

    const q = QStore.q;
    const esc = QStore.escapeHtml;
    const S = () => QStore.get();
    const money = (n) => QStore.money(n);
    const I = (name, cls) => QUI.icon(name, cls);
    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    const SESSION_KEY = 'qrico_sesion';
    const SOUND_KEY = 'qrico_sonido';
    const PIN_INTENTOS_KEY = 'qrico_pin_intentos';
    const PIN_BLOQUEO_KEY = 'qrico_pin_bloqueo';
    const DAY = 86400000;

    const COLORES = { coral: '#D1312B', mostaza: '#D1A059', carbon: '#1E1B18', piedra: '#6E655F', salvia: '#2E7D32', borde: '#DFD3BC', crema: '#EDE2CE' };
    const SERIE = [COLORES.coral, COLORES.mostaza, COLORES.carbon, COLORES.salvia, COLORES.piedra, '#E9C48E'];

    const METODOS = {
        efectivo: { label: 'Efectivo', icon: 'banknote' },
        tarjeta: { label: 'Tarjeta', icon: 'credit-card' },
        transferencia: { label: 'Transferencia', icon: 'smartphone' },
        dividido: { label: 'Dividido', icon: 'split' }
    };

    const VISTAS = {
        dashboard: { titulo: 'Dashboard' },
        pos: { titulo: 'Punto de venta' },
        kds: { titulo: 'Cocina · KDS' },
        mesas: { titulo: 'Mesas y QR' },
        menu_stock: { titulo: 'Menú y stock' },
        personal: { titulo: 'Personal' },
        reportes: { titulo: 'Reportes' },
        configuracion: { titulo: 'Configuración' }
    };

    const ROL_ICONOS = { gerente: 'crown', cajero: 'calculator', cocina: 'chef-hat', mesero: 'hand-platter' };

    const ICONOS_CATEGORIA = ['utensils', 'salad', 'soup', 'sandwich', 'pizza', 'beef', 'drumstick', 'fish', 'egg-fried', 'croissant',
        'cake-slice', 'ice-cream-cone', 'cookie', 'coffee', 'cup-soda', 'wine', 'beer', 'martini', 'leaf', 'flame', 'citrus', 'popcorn'];

    /* ---------------- Utilidades ---------------- */
    function hora(ts) { return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }); }
    function fecha(ts) { return new Date(ts).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
    function fechaHora(ts) { return fecha(ts) + ' · ' + hora(ts); }
    function folioVenta(n) { return 'V-' + String(n).padStart(5, '0'); }
    function pct(a, b) { return b ? Math.round(((a - b) / b) * 100) : null; }

    function origenPedido(s, p) {
        if (p.mesaId) {
            const m = q.mesa(s, p.mesaId);
            return { label: 'Mesa ' + (m ? m.numero : '?'), icon: 'armchair' };
        }
        return p.tipo === 'llevar' ? { label: 'Para llevar', icon: 'shopping-bag' } : { label: 'Mostrador', icon: 'store' };
    }

    function etiquetaVenta(s, v) {
        if (v.mesaId) { const m = q.mesa(s, v.mesaId); return 'Mesa ' + (m ? m.numero : '—'); }
        return v.tipo === 'llevar' ? 'Para llevar' : 'Mostrador';
    }

    function descargarArchivo(nombre, contenido, tipo) {
        const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo || 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    function guardar(mutator, evento, mensajeOk) {
        try {
            const r = QStore.update(mutator, evento);
            if (mensajeOk) QUI.toast(mensajeOk, 'success');
            return r;
        } catch (e) {
            QUI.toast(e.message || 'No se pudo guardar.', 'error');
            return undefined;
        }
    }

    function sonidoActivo() {
        try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch (e) { return true; }
    }

    /* ---------------- Sesión ---------------- */
    // La sesión se valida en cada lectura: si alguien la altera desde la consola con tipos o roles
    // inválidos, se descarta y el panel regresa al acceso por PIN.
    function sesion() {
        try {
            const se = JSON.parse(sessionStorage.getItem(SESSION_KEY));
            if (!se || typeof se !== 'object' || typeof se.id !== 'string' || typeof se.nombre !== 'string') return null;
            if (!QStore.ROLES[se.rol]) return null;
            return se;
        } catch (e) {
            return null;
        }
    }
    function guardarSesion(se) {
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(se)); } catch (e) { /* almacenamiento bloqueado */ }
    }
    function puede(vista) {
        const se = sesion();
        return !!(se && QStore.ROLES[se.rol] && QStore.ROLES[se.rol].vistas.includes(vista));
    }
    function cerrarSesion() {
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* almacenamiento bloqueado */ }
        location.href = '../index.html';
    }

    /* =================================================================
       LOGIN POR PIN (panel-administrativo/index.html)
       ================================================================= */
    function initLogin() {
        const s = S();
        $('#login-restaurante').textContent = s.negocio.nombre;
        if (s.negocio.eslogan) $('#login-eslogan').textContent = s.negocio.eslogan;
        $('#pin-demo').innerHTML = s.personal.filter(p => p.activo).map(p =>
            `<button type="button" data-pin="${esc(p.pin)}">
                <span class="role-tag role-tag--${p.rol}">${I(ROL_ICONOS[p.rol])}${esc(QStore.ROLES[p.rol].label)}</span>
                <b class="q-mono">${esc(p.pin)}</b><small>${esc(p.nombre)}</small>
            </button>`).join('');
        QUI.icons();

        let pin = '';
        let bloqueado = false;
        const dots = $$('#pin-dots span');
        const pintar = () => dots.forEach((d, i) => d.classList.toggle('is-filled', i < pin.length));

        /* Protección contra fuerza bruta: tras 5 PIN incorrectos seguidos el teclado se bloquea 30 s.
           El conteo y el bloqueo se guardan en localStorage para que recargar la página no los reinicie. */
        const MAX_INTENTOS = 5;
        const BLOQUEO_MS = 30000;
        const leerNumero = key => {
            try { const n = Number(localStorage.getItem(key)); return Number.isFinite(n) && n > 0 ? n : 0; } catch (e) { return 0; }
        };
        const escribir = (key, v) => {
            try { if (v) localStorage.setItem(key, String(v)); else localStorage.removeItem(key); } catch (e) { /* sin almacenamiento */ }
        };
        let intentos = leerNumero(PIN_INTENTOS_KEY);
        let bloqueoHasta = leerNumero(PIN_BLOQUEO_KEY);
        let relojBloqueo = null;

        function enBloqueo() { return bloqueoHasta > Date.now(); }

        function mostrarBloqueo() {
            const card = $('#pin-card');
            card.classList.add('is-locked');
            $$('#pin-pad button, #pin-demo button').forEach(b => { b.disabled = true; });
            const pintarReloj = () => {
                const resta = Math.ceil((bloqueoHasta - Date.now()) / 1000);
                if (resta <= 0) {
                    clearInterval(relojBloqueo);
                    relojBloqueo = null;
                    bloqueoHasta = 0;
                    intentos = 0;
                    escribir(PIN_BLOQUEO_KEY, 0);
                    escribir(PIN_INTENTOS_KEY, 0);
                    card.classList.remove('is-locked');
                    $$('#pin-pad button, #pin-demo button').forEach(b => { b.disabled = false; });
                    $('#pin-mensaje').textContent = 'Teclado desbloqueado. Ingresa tu PIN.';
                    return;
                }
                $('#pin-mensaje').innerHTML = '<span class="pin-alerta">' + I('shield-alert') +
                    '<span>Demasiados intentos fallidos. Por seguridad, espera <b class="q-mono">' + resta + ' s</b>.</span></span>';
                QUI.icons($('#pin-mensaje'));
            };
            pintarReloj();
            if (!relojBloqueo) relojBloqueo = setInterval(pintarReloj, 1000);
        }

        function tecla(k) {
            if (bloqueado || enBloqueo()) return;
            if (k === 'back') pin = pin.slice(0, -1);
            else if (k === 'clear') pin = '';
            else if (/^\d$/.test(k) && pin.length < 4) pin += k;
            pintar();
            const filled = dots[pin.length - 1];
            if (filled && /^\d$/.test(k)) QUI.pulse(filled);
            if (pin.length === 4) validar();
        }

        function validar() {
            bloqueado = true;
            const u = S().personal.find(p => p.activo && p.pin === pin);
            if (!u) {
                intentos += 1;
                escribir(PIN_INTENTOS_KEY, intentos);
                $('#pin-dots').classList.add('is-error');
                const restantes = MAX_INTENTOS - intentos;
                $('#pin-mensaje').textContent = restantes > 0
                    ? 'PIN incorrecto. Te quedan ' + restantes + (restantes === 1 ? ' intento.' : ' intentos.')
                    : 'PIN incorrecto.';
                QUI.shake($('#pin-card'));
                setTimeout(() => {
                    pin = ''; pintar(); $('#pin-dots').classList.remove('is-error'); bloqueado = false;
                    if (intentos >= MAX_INTENTOS) {
                        bloqueoHasta = Date.now() + BLOQUEO_MS;
                        escribir(PIN_BLOQUEO_KEY, bloqueoHasta);
                        QUI.toast('El acceso se bloqueó 30 segundos por seguridad.', 'error', { title: 'Alerta de seguridad', icon: 'shield-alert' });
                        mostrarBloqueo();
                    }
                }, 700);
                return;
            }
            intentos = 0;
            escribir(PIN_INTENTOS_KEY, 0);
            $('#pin-dots').classList.add('is-success');
            $('#pin-mensaje').textContent = 'Hola, ' + u.nombre.split(' ')[0] + '. Entrando como ' + QStore.ROLES[u.rol].label + '…';
            guardarSesion({ id: u.id, nombre: u.nombre, rol: u.rol, desde: Date.now() });
            const destino = 'pages/admin.html#' + QStore.ROLES[u.rol].inicio;
            if (QUI.hasGsap()) gsap.to('.login', { opacity: 0, y: -12, duration: 0.45, delay: 0.35, ease: 'power2.in', onComplete: () => { location.href = destino; } });
            else location.href = destino;
        }

        $('#pin-pad').addEventListener('click', e => {
            const b = e.target.closest('[data-key]');
            if (!b) return;
            if (QUI.hasGsap()) gsap.fromTo(b, { scale: 0.92 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
            tecla(b.dataset.key);
        });
        document.addEventListener('keydown', e => {
            if (/^\d$/.test(e.key)) tecla(e.key);
            else if (e.key === 'Backspace') tecla('back');
            else if (e.key === 'Escape') tecla('clear');
        });
        $('#pin-demo').addEventListener('click', e => {
            const b = e.target.closest('[data-pin]');
            if (!b || bloqueado || enBloqueo()) return;
            pin = '';
            pintar();
            b.dataset.pin.split('').forEach((d, i) => setTimeout(() => tecla(d), 110 * (i + 1)));
        });

        if (QUI.hasGsap()) {
            gsap.from('.login__brand > *', { y: 24, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'expo.out' });
            gsap.from('.pin-card', { y: 30, opacity: 0, duration: 0.8, ease: 'expo.out', delay: 0.1 });
            gsap.from('.pin-pad button', { scale: 0.7, opacity: 0, duration: 0.5, stagger: 0.03, ease: 'back.out(2)', delay: 0.25 });
        }

        // Si la página se recargó durante un bloqueo, este continúa donde se quedó
        if (enBloqueo()) mostrarBloqueo();
    }

    /* =================================================================
       SHELL DEL PANEL
       ================================================================= */
    let vistaActual = null;
    let cargaId = 0;
    const charts = {};
    let mesaParaPOS = null;

    function chart(id, config) {
        const el = document.getElementById(id);
        if (!el || typeof Chart === 'undefined') return null;
        const prev = charts[id];
        if (prev && prev.canvas === el) {
            prev.data = config.data;
            prev.update('none');
            return prev;
        }
        if (prev) prev.destroy();
        charts[id] = new Chart(el, config);
        return charts[id];
    }

    function destruirCharts() {
        Object.keys(charts).forEach(k => { charts[k].destroy(); delete charts[k]; });
    }

    function configurarChartJs() {
        if (typeof Chart === 'undefined') return;
        Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
        Chart.defaults.font.size = 12;
        Chart.defaults.color = COLORES.piedra;
        Chart.defaults.borderColor = '#EFE7D8';
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.legend.labels.boxWidth = 8;
        Chart.defaults.plugins.tooltip.backgroundColor = COLORES.carbon;
        Chart.defaults.plugins.tooltip.padding = 10;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.plugins.tooltip.titleFont = { weight: '700' };
        Chart.defaults.plugins.tooltip.bodyFont = { family: "'JetBrains Mono', monospace" };
        Chart.defaults.animation.duration = 700;
    }

    const ejeDinero = {
        beginAtZero: true,
        grid: { color: '#F1EADD' },
        border: { display: false },
        ticks: { callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : v) }
    };
    const ejeX = { grid: { display: false }, border: { color: COLORES.borde } };
    const tooltipDinero = { callbacks: { label: ctx => ' ' + (ctx.dataset.label ? ctx.dataset.label + ': ' : '') + money(ctx.parsed.y != null ? ctx.parsed.y : ctx.parsed) } };

    async function initAdmin() {
        const se = sesion();
        if (!se) { location.replace('../index.html'); return; }
        const u = S().personal.find(p => p.id === se.id && p.activo);
        if (!u) { cerrarSesion(); return; }

        configurarChartJs();
        try {
            const res = await fetch('../components/admin_sidebar.html', { cache: 'no-cache' });
            if (!res.ok) throw new Error();
            $('#sidebar-container').innerHTML = await res.text();
        } catch (e) {
            $('#admin-main-content').innerHTML = errorCarga();
            return;
        }

        // Ocultar secciones no permitidas para el rol
        $$('.nav-item').forEach(a => { a.hidden = !puede(a.dataset.view); });
        $$('.sidebar__title').forEach(t => {
            let sib = t.nextElementSibling, visible = false;
            while (sib && !sib.classList.contains('sidebar__title')) { if (!sib.hidden) visible = true; sib = sib.nextElementSibling; }
            t.hidden = !visible;
        });

        enlazarShell();
        renderShell();
        QUI.icons();
        actualizarReloj();
        setInterval(actualizarReloj, 15000);

        QStore.subscribe(alCambiarStore);
        window.addEventListener('hashchange', () => cargarVista(rutaActual()));
        cargarVista(rutaActual());
    }

    function errorCarga() {
        return `<div class="q-empty" style="min-height:50vh">${I('wifi-off')}<strong>No se pudieron cargar los componentes del panel</strong>
            <span>Abre el proyecto desde un servidor (Live Server, Render o <code>npx serve</code>), no con doble clic al archivo.</span></div>`;
    }

    function rutaActual() {
        const h = location.hash.replace('#', '');
        if (VISTAS[h]) return h;
        return QStore.ROLES[sesion().rol].inicio;
    }

    async function cargarVista(nombre) {
        if (!puede(nombre)) {
            QUI.toast('Tu rol no tiene acceso a esa sección.', 'warning', { icon: 'lock' });
            nombre = QStore.ROLES[sesion().rol].inicio;
            history.replaceState(null, '', '#' + nombre);
        }
        const id = ++cargaId;
        if (vistaActual && Views[vistaActual].destroy) Views[vistaActual].destroy();
        destruirCharts();
        vistaActual = null;
        const main = $('#admin-main-content');
        main.innerHTML = '<div class="view-loading"><span class="spinner"></span> Cargando…</div>';
        $$('.nav-item').forEach(a => a.classList.toggle('is-active', a.dataset.view === nombre));
        $('#topbar-vista').textContent = VISTAS[nombre].titulo;
        document.title = VISTAS[nombre].titulo + ' | ' + S().negocio.nombre;
        document.body.classList.remove('sidebar-open');

        let html;
        try {
            const res = await fetch('../components/views/' + nombre + '.html', { cache: 'no-cache' });
            if (!res.ok) throw new Error();
            html = await res.text();
        } catch (e) {
            if (id === cargaId) main.innerHTML = errorCarga();
            QUI.icons(main);
            return;
        }
        if (id !== cargaId) return;
        main.innerHTML = html;
        main.dataset.view = nombre;
        vistaActual = nombre;
        QUI.icons(main);
        Views[nombre].init();
        QUI.icons(main);
        if (QUI.hasGsap()) gsap.from(main.firstElementChild, { y: 12, opacity: 0, duration: 0.45, ease: 'power3.out', clearProps: 'all' });
    }

    function enlazarShell() {
        $('#btn-menu-movil').addEventListener('click', () => document.body.classList.add('sidebar-open'));
        $('#sidebar-overlay').addEventListener('click', () => document.body.classList.remove('sidebar-open'));
        const cerrarSb = $('#btn-cerrar-sidebar');
        if (cerrarSb) cerrarSb.addEventListener('click', () => document.body.classList.remove('sidebar-open'));

        const toggle = (btnSel, dropSel) => {
            $(btnSel).addEventListener('click', e => {
                e.stopPropagation();
                const d = $(dropSel);
                const abrir = d.hidden;
                $$('.dropdown').forEach(x => { x.hidden = true; });
                d.hidden = !abrir;
                if (abrir && QUI.hasGsap()) gsap.fromTo(d, { y: -6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out' });
            });
        };
        toggle('#btn-alertas', '#dropdown-alertas');
        toggle('#btn-perfil', '#dropdown-perfil');
        document.addEventListener('click', e => {
            if (!e.target.closest('.topbar__dropdown-wrap')) $$('.dropdown').forEach(x => { x.hidden = true; });
        });
        $('#btn-cerrar-sesion').addEventListener('click', cerrarSesion);
        $('#btn-cambiar-usuario').addEventListener('click', cerrarSesion);

        $('#dropdown-alertas').addEventListener('click', e => {
            const at = e.target.closest('[data-atender]');
            if (at) { atenderAlerta(at.dataset.atender); return; }
            const cb = e.target.closest('[data-cobrar-mesa]');
            if (cb) { $('#dropdown-alertas').hidden = true; abrirCobro({ mesaId: cb.dataset.cobrarMesa, tipo: 'mesa' }); }
        });
    }

    function renderShell() {
        const s = S();
        const se = sesion();
        const n = s.negocio;
        const logo = $('#sidebar-logo');
        if (logo) {
            logo.src = QStore.resolveAsset(n.logo);
            logo.alt = n.nombre;
            logo.onerror = () => { logo.onerror = null; logo.src = QStore.PLACEHOLDER; };
            $('#sidebar-negocio').textContent = n.nombre;
            $('#sidebar-plan').textContent = s.plan.nombre;
            $('#sidebar-plan-precio').textContent = '$' + s.plan.precio + ' ' + s.plan.moneda + '/' + s.plan.periodo;
        }
        $('#topbar-negocio').textContent = n.nombre + (n.abierto ? '' : ' · cerrado');
        $('#perfil-avatar').textContent = QUI.initials(se.nombre);
        $('#perfil-avatar').className = 'avatar avatar--' + se.rol;
        $('#perfil-nombre').textContent = se.nombre;
        $('#perfil-rol').textContent = QStore.ROLES[se.rol].label;
        $('#dropdown-nombre').textContent = se.nombre;
        renderBadges();
        renderAlertasDropdown();
    }

    function renderBadges() {
        const s = S();
        const set = (key, n) => {
            const b = $('[data-badge="' + key + '"]');
            if (!b) return;
            b.hidden = !n;
            b.textContent = n;
        };
        set('kds', s.pedidos.filter(p => p.estado === 'pendiente').length);
        set('mesas', q.alertasActivas(s).length);
        set('menu_stock', s.platillos.filter(p => !p.disponible).length);
    }

    function renderAlertasDropdown() {
        const s = S();
        const alertas = q.alertasActivas(s).sort((a, b) => b.creadoEn - a.creadoEn);
        const count = $('#alertas-count');
        count.hidden = !alertas.length;
        count.textContent = alertas.length;
        $('#btn-alertas').classList.toggle('has-alerts', alertas.length > 0);
        const d = $('#dropdown-alertas');
        d.innerHTML = '<div class="dropdown__header"><strong>Alertas de mesas</strong><span class="q-muted">' + alertas.length + ' activas</span></div>' +
            (alertas.length ? alertas.map(a => alertaItemHTML(s, a, true)).join('')
                : '<div class="q-empty q-empty--sm">' + I('bell-off') + '<span>Sin alertas por ahora</span></div>');
        QUI.icons(d);
    }

    function alertaItemHTML(s, a, compacto) {
        const m = q.mesa(s, a.mesaId);
        const esCuenta = a.tipo === 'cuenta';
        const cuenta = m ? q.cuentaMesa(s, m.id) : null;
        return `<div class="alert-item alert-item--${a.tipo}">
            <span class="alert-item__icon">${I(esCuenta ? 'receipt-text' : 'hand-platter')}</span>
            <div class="alert-item__body">
                <strong>Mesa ${esc(m ? m.numero : '?')} · ${esCuenta ? 'pide la cuenta' : 'llama al mesero'}</strong>
                ${a.nota || (esCuenta && cuenta) ? `<span>${esc(a.nota || 'Total ' + money(cuenta.subtotal))}</span>` : ''}
                <span class="q-hint">Hace ${QStore.minutesSince(a.creadoEn)} min</span>
            </div>
            <div class="alert-item__actions">
                ${esCuenta && puede('pos') && cuenta && cuenta.items.length ? `<button class="q-btn q-btn--dark q-btn--sm" data-cobrar-mesa="${a.mesaId}">${I('wallet')} Cobrar</button>` : ''}
                <button class="q-btn q-btn--outline q-btn--sm" data-atender="${a.id}">${I('check')} Atender</button>
            </div>
        </div>`;
    }

    function atenderAlerta(id) {
        guardar(st => {
            const a = st.alertas.find(x => x.id === id);
            if (a) { a.atendida = true; a.atendidaEn = Date.now(); }
        }, { type: 'alerta:atendida' }, 'Alerta atendida. El comensal fue notificado.');
    }

    function actualizarReloj() {
        const el = $('#reloj-admin');
        if (!el) return;
        const d = new Date();
        const dia = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }).replace('.', '');
        el.textContent = dia + ' · ' + hora(d.getTime());
    }

    function notificar(evt, remoto) {
        if (!remoto || !evt) return;
        const s = S();
        if (evt.type === 'pedido:nuevo') {
            const p = s.pedidos[s.pedidos.length - 1];
            if (!p) return;
            const o = origenPedido(s, p);
            const piezas = p.items.reduce((a, i) => a + i.cantidad, 0);
            QUI.toast(o.label + (p.comensal ? ' · ' + p.comensal : '') + ' · ' + piezas + (piezas === 1 ? ' platillo' : ' platillos') + ' · ' + money(p.total), 'order', { title: 'Nueva orden #' + p.folio, icon: 'chef-hat', duration: 6000 });
            if (sonidoActivo()) QUI.chime('pedido');
        } else if (evt.type === 'alerta:nueva') {
            const m = q.mesa(s, evt.mesaId);
            QUI.toast(evt.tipo === 'cuenta' ? 'Solicita la cuenta.' : 'Solicita a su mesero.', 'warning', {
                title: 'Mesa ' + (m ? m.numero : '?'), icon: evt.tipo === 'cuenta' ? 'receipt-text' : 'hand-platter', duration: 6000
            });
            if (sonidoActivo()) QUI.chime('alerta');
            QUI.pulse($('#btn-alertas'));
        } else if (evt.type === 'pedido:estado' && evt.estado === 'listo') {
            const p = s.pedidos.find(x => x.id === evt.pedidoId);
            if (p) QUI.toast(origenPedido(s, p).label + ' · lista para servir.', 'success', { title: 'Orden #' + p.folio, icon: 'bell-ring' });
        } else if (evt.type === 'reset') {
            QUI.toast('Se restauraron los datos de demostración.', 'info', { icon: 'rotate-ccw' });
        }
    }

    function alCambiarStore(state, evt, remoto) {
        const se = sesion();
        const u = se && state.personal.find(p => p.id === se.id && p.activo);
        if (!u) { QUI.toast('Tu acceso fue modificado. Ingresa de nuevo.', 'warning'); setTimeout(cerrarSesion, 1200); return; }
        if (u.rol !== se.rol || u.nombre !== se.nombre) {
            guardarSesion(Object.assign(se, { rol: u.rol, nombre: u.nombre }));
            if (!puede(vistaActual)) { cargarVista(QStore.ROLES[u.rol].inicio); }
        }
        renderShell();
        notificar(evt, remoto);
        if (vistaActual && Views[vistaActual].render) Views[vistaActual].render(evt);
    }

    /* =================================================================
       COBRO (compartido por POS, Mesas y alertas)
       ================================================================= */
    function consolidar(items) {
        const map = new Map();
        items.forEach(it => {
            const k = it.nombre + '|' + it.precio;
            if (map.has(k)) map.get(k).cantidad += it.cantidad;
            else map.set(k, { nombre: it.nombre, precio: it.precio, cantidad: it.cantidad });
        });
        return Array.from(map.values());
    }

    function abrirCobro(opts) {
        const s = S();
        // Pedido directo del menú QR (sin mesa): se cobra completo en caja
        const directo = opts.pedidoId ? s.pedidos.find(p => p.id === opts.pedidoId && !p.mesaId) : null;
        if (opts.pedidoId && (!directo || directo.pagado)) { QUI.toast('Ese pedido ya fue cobrado.', 'info'); return; }
        const mesa = !directo && opts.mesaId ? q.mesa(s, opts.mesaId) : null;
        const tipo = directo ? (directo.tipo === 'llevar' ? 'llevar' : 'mostrador') : (opts.tipo || (mesa ? 'mesa' : 'mostrador'));
        const cuenta = directo ? { pedidos: [directo], items: directo.items, subtotal: directo.total }
            : mesa ? q.cuentaMesa(s, mesa.id) : { pedidos: [], items: [], subtotal: 0 };
        const extra = (opts.lineasExtra || []).map(l => {
            const p = q.platillo(s, l.platilloId);
            return p ? { platilloId: p.id, nombre: p.nombre, precio: p.precio, cantidad: l.cantidad, notas: l.notas || '' } : null;
        }).filter(Boolean);
        const items = cuenta.items.map(i => ({ platilloId: i.platilloId, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, notas: i.notas || '' })).concat(extra);
        if (!items.length) { QUI.toast('No hay consumo para cobrar.', 'warning'); return; }

        const subtotal = QStore.totalItems(items);
        const alerta = mesa ? q.alertasMesa(s, mesa.id).find(a => a.tipo === 'cuenta') : null;
        const sugerido = alerta && alerta.split ? alerta.split : null;
        const st = {
            propinaPct: sugerido ? sugerido.propinaPct : (tipo === 'mesa' ? (s.negocio.propinaDefault || 0) : 0),
            metodo: sugerido && sugerido.personas > 1 ? 'dividido' : 'efectivo',
            recibido: '',
            pagos: null
        };
        const total = () => QStore.round2(subtotal + subtotal * st.propinaPct / 100);

        function pagosIniciales(n) {
            const t = total();
            if (sugerido && sugerido.montos && sugerido.montos.length === n && Math.abs(sugerido.montos.reduce((a, b) => a + b, 0) - t) < 1) {
                return sugerido.montos.map(m => ({ monto: m, metodo: 'tarjeta' }));
            }
            const base = Math.floor((t / n) * 100) / 100;
            const arr = Array.from({ length: n }, () => ({ monto: base, metodo: 'tarjeta' }));
            arr[n - 1].monto = QStore.round2(t - base * (n - 1));
            return arr;
        }
        if (st.metodo === 'dividido') st.pagos = pagosIniciales(sugerido.personas);

        const titulo = directo ? 'Cobrar pedido #' + directo.folio + (directo.comensal ? ' · ' + esc(directo.comensal) : '') + (tipo === 'llevar' ? ' · para llevar' : '')
            : mesa ? 'Cobrar mesa ' + esc(mesa.numero) : (tipo === 'llevar' ? 'Cobrar orden para llevar' : 'Cobrar en mostrador');
        const body = `
            <div class="cobro">
                <div class="cobro__resumen">
                    <span class="q-label">Consumo</span>
                    <ul class="cobro__items">
                        ${consolidar(items).map(it => `<li><span><b class="q-mono">${it.cantidad}×</b> ${esc(it.nombre)}</span><span class="q-mono">${money(it.precio * it.cantidad)}</span></li>`).join('')}
                    </ul>
                    ${alerta ? `<div class="cobro__nota">${I('message-square-text')} <span>El comensal pidió: <b>${esc(alerta.nota)}</b></span></div>` : ''}
                </div>
                <div class="cobro__pago" id="cobro-dyn"></div>
            </div>`;
        const modal = QUI.openModal({
            title: titulo, body, size: 'lg', className: 'cobro-modal',
            footer: `<button class="q-btn q-btn--ghost" data-close>Cancelar</button><button class="q-btn q-btn--primary q-btn--lg" id="cobro-confirmar"></button>`
        });

        function render() {
            const t = total();
            const propina = QStore.round2(t - subtotal);
            const opciones = Array.from(new Set((s.negocio.propinas || [0, 10, 15, 20]).concat([st.propinaPct]))).sort((a, b) => a - b);
            let panel = '';
            if (st.metodo === 'efectivo') {
                const recibido = parseFloat(st.recibido) || 0;
                const cambio = recibido - t;
                const sugerencias = [t, Math.ceil(t / 100) * 100, Math.ceil(t / 500) * 500, Math.ceil(t / 1000) * 1000]
                    .filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 4);
                panel = `<div class="q-field"><label for="cobro-recibido">Efectivo recibido</label>
                    <input class="q-input q-mono cobro__input" id="cobro-recibido" type="number" min="0" step="0.5" inputmode="decimal" value="${esc(st.recibido)}" placeholder="0.00"></div>
                    <div class="cobro__quick">${sugerencias.map(v => `<button class="q-chip" data-recibido="${v}">${money(v)}</button>`).join('')}</div>
                    <div class="cobro__cambio ${recibido && cambio < 0 ? 'is-short' : ''}"><span>${recibido && cambio < 0 ? 'Faltan' : 'Cambio'}</span><b class="q-mono">${money(Math.abs(recibido ? cambio : 0))}</b></div>`;
            } else if (st.metodo === 'dividido') {
                const suma = QStore.round2(st.pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0));
                const resta = QStore.round2(t - suma);
                panel = `<div class="cobro__split-head"><span class="q-label">Pagos (${st.pagos.length} personas)</span>
                    <div class="qty-mini"><button data-personas="-1" aria-label="Menos">${I('minus')}</button><button data-personas="1" aria-label="Más">${I('plus')}</button></div></div>
                    <ul class="cobro__pagos">${st.pagos.map((p, i) => `
                        <li><span class="avatar-dot">${i + 1}</span>
                            <input class="q-input q-mono" type="number" min="0" step="0.01" data-monto="${i}" value="${p.monto}">
                            <select class="q-select" data-metodo-pago="${i}">${['efectivo', 'tarjeta', 'transferencia'].map(m => `<option value="${m}" ${p.metodo === m ? 'selected' : ''}>${METODOS[m].label}</option>`).join('')}</select>
                        </li>`).join('')}</ul>
                    <div class="cobro__cambio ${Math.abs(resta) > 0.009 ? 'is-short' : 'is-ok'}"><span>${Math.abs(resta) > 0.009 ? (resta > 0 ? 'Por asignar' : 'Excedente') : 'Cuadra con el total'}</span><b class="q-mono">${money(Math.abs(resta))}</b></div>
                    <button class="q-btn q-btn--ghost q-btn--sm" data-igualar>${I('equal')} Repartir en partes iguales</button>`;
            } else {
                panel = `<div class="cobro__info">${I(METODOS[st.metodo].icon)}<span>Registra el pago con ${st.metodo === 'tarjeta' ? 'la terminal bancaria' : 'la transferencia del cliente'} por <b class="q-mono">${money(t)}</b>.</span></div>`;
            }

            $('#cobro-dyn', modal.el).innerHTML = `
                <span class="q-label">Propina</span>
                <div class="tip-row">${opciones.map(o => `<button class="tip-chip ${o === st.propinaPct ? 'is-active' : ''}" data-propina="${o}">${o === 0 ? 'Sin propina' : o + '%'}</button>`).join('')}</div>
                <span class="q-label">Método de pago</span>
                <div class="metodo-grid">${Object.keys(METODOS).map(k => `<button class="metodo-btn ${st.metodo === k ? 'is-active' : ''}" data-metodo="${k}">${I(METODOS[k].icon)}<span>${METODOS[k].label}</span></button>`).join('')}</div>
                <div class="cobro__panel">${panel}</div>
                <div class="cobro__totales">
                    <div><span>Subtotal</span><span class="q-mono">${money(subtotal)}</span></div>
                    <div><span>Propina ${st.propinaPct}%</span><span class="q-mono">${money(propina)}</span></div>
                    <div class="is-total"><span>Total</span><span class="q-mono">${money(t)}</span></div>
                </div>`;
            $('#cobro-confirmar', modal.el).innerHTML = I('check') + ' Cobrar ' + money(t);
            QUI.icons(modal.el);
        }

        modal.el.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.propina != null) {
                st.propinaPct = Number(b.dataset.propina);
                if (st.metodo === 'dividido') st.pagos = pagosIniciales(st.pagos.length);
                render();
            } else if (b.dataset.metodo) {
                st.metodo = b.dataset.metodo;
                if (st.metodo === 'dividido' && !st.pagos) st.pagos = pagosIniciales(2);
                render();
            } else if (b.dataset.recibido) {
                st.recibido = b.dataset.recibido;
                render();
            } else if (b.dataset.personas) {
                const n = Math.max(2, Math.min(20, st.pagos.length + Number(b.dataset.personas)));
                st.pagos = pagosIniciales(n);
                render();
            } else if (b.hasAttribute('data-igualar')) {
                st.pagos = pagosIniciales(st.pagos.length);
                render();
            }
        });
        modal.el.addEventListener('input', e => {
            if (e.target.id === 'cobro-recibido') {
                st.recibido = e.target.value;
                const t = total(), rec = parseFloat(st.recibido) || 0, cambio = rec - t;
                const box = $('.cobro__cambio', modal.el);
                box.classList.toggle('is-short', rec > 0 && cambio < 0);
                box.innerHTML = `<span>${rec && cambio < 0 ? 'Faltan' : 'Cambio'}</span><b class="q-mono">${money(Math.abs(rec ? cambio : 0))}</b>`;
            }
            if (e.target.dataset.monto != null) {
                st.pagos[Number(e.target.dataset.monto)].monto = parseFloat(e.target.value) || 0;
                const suma = QStore.round2(st.pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0));
                const resta = QStore.round2(total() - suma);
                const box = $('.cobro__cambio', modal.el);
                box.className = 'cobro__cambio ' + (Math.abs(resta) > 0.009 ? 'is-short' : 'is-ok');
                box.innerHTML = `<span>${Math.abs(resta) > 0.009 ? (resta > 0 ? 'Por asignar' : 'Excedente') : 'Cuadra con el total'}</span><b class="q-mono">${money(Math.abs(resta))}</b>`;
            }
        });
        modal.el.addEventListener('change', e => {
            if (e.target.dataset.metodoPago != null) st.pagos[Number(e.target.dataset.metodoPago)].metodo = e.target.value;
        });

        $('#cobro-confirmar', modal.el).addEventListener('click', () => {
            const t = total();
            const propina = QStore.round2(t - subtotal);
            let pagos, recibido = null, cambio = null;
            if (st.metodo === 'efectivo') {
                recibido = parseFloat(st.recibido);
                if (isNaN(recibido)) recibido = t;
                if (recibido + 0.001 < t) { QUI.toast('El efectivo recibido no cubre el total.', 'error'); QUI.shake($('#cobro-recibido', modal.el)); return; }
                cambio = QStore.round2(recibido - t);
                pagos = [{ metodo: 'efectivo', monto: t }];
            } else if (st.metodo === 'dividido') {
                const suma = QStore.round2(st.pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0));
                if (Math.abs(suma - t) > 0.009) { QUI.toast('La suma de los pagos debe ser igual al total.', 'error'); return; }
                if (st.pagos.some(p => !(p.monto > 0))) { QUI.toast('Cada pago debe ser mayor a cero.', 'error'); return; }
                pagos = st.pagos.map(p => ({ metodo: p.metodo, monto: QStore.round2(p.monto) }));
            } else {
                pagos = [{ metodo: st.metodo, monto: t }];
            }

            const ahora = Date.now();
            const venta = guardar(stt => {
                const v = {
                    id: QStore.uid('v'), folio: stt.contadores.venta++, mesaId: mesa ? mesa.id : null, tipo,
                    items: items.map(i => ({ platilloId: i.platilloId, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad })),
                    subtotal, propina, total: t, metodo: st.metodo, pagos, personas: pagos.length,
                    recibido, cambio, cerradoEn: ahora, cajero: sesion().nombre
                };
                if (directo) {
                    v.comensal = directo.comensal || null;
                    const p = stt.pedidos.find(x => x.id === directo.id);
                    if (p) { p.pagado = true; p.actualizadoEn = ahora; }
                }
                stt.ventas.push(v);
                if (mesa) {
                    stt.pedidos.forEach(p => {
                        if (p.mesaId === mesa.id && !p.pagado && p.estado !== 'cancelado') { p.pagado = true; p.actualizadoEn = ahora; }
                    });
                    stt.alertas.forEach(a => { if (a.mesaId === mesa.id && !a.atendida) { a.atendida = true; a.atendidaEn = ahora; } });
                    const m = q.mesa(stt, mesa.id);
                    if (m) { m.abierta = false; m.abiertaEn = null; }
                }
                if (extra.length) {
                    stt.pedidos.push({
                        id: QStore.uid('ped'), folio: stt.contadores.pedido++, mesaId: mesa ? mesa.id : null, origen: 'pos', tipo,
                        estado: 'pendiente', pagado: true, creadoEn: ahora, actualizadoEn: ahora, items: extra, total: QStore.totalItems(extra)
                    });
                }
                return v;
            }, { type: 'venta:cerrada', mesaId: mesa ? mesa.id : null });
            if (!venta) return;
            modal.close();
            if (opts.onDone) opts.onDone(venta);
            mostrarTicket(venta, true);
        });

        render();
    }

    /* ---------------- Tickets ---------------- */
    function ticketHTML(v) {
        const s = S();
        const n = s.negocio;
        const linea = '<div style="border-top:1px dashed #6E655F;margin:8px 0"></div>';
        const fila = (a, b, bold) => `<div style="display:flex;justify-content:space-between;gap:8px;${bold ? 'font-weight:700;font-size:13px' : ''}"><span>${a}</span><span>${b}</span></div>`;
        return `<div class="ticket" style="width:272px;padding:14px 12px;background:#fff;color:#1E1B18;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;line-height:1.5">
            <div style="text-align:center">
                <div style="font-family:Fraunces,Georgia,serif;font-size:18px;font-weight:700">${esc(n.nombre)}</div>
                ${n.direccion ? `<div>${esc(n.direccion)}</div>` : ''}
                ${n.telefono ? `<div>Tel. ${esc(n.telefono)}</div>` : ''}
            </div>
            ${linea}
            ${fila('Folio', folioVenta(v.folio))}
            ${fila('Fecha', fechaHora(v.cerradoEn))}
            ${fila('Servicio', esc(etiquetaVenta(s, v)))}
            ${v.comensal ? fila('Cliente', esc(v.comensal)) : ''}
            ${fila('Atendió', esc(v.cajero || '—'))}
            ${linea}
            ${consolidar(v.items).map(it => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${it.cantidad} x ${esc(it.nombre)}</span><span>${money(it.precio * it.cantidad)}</span></div>`).join('')}
            ${linea}
            ${fila('Subtotal', money(v.subtotal))}
            ${fila('Propina', money(v.propina))}
            ${fila('TOTAL', money(v.total), true)}
            ${linea}
            ${(v.pagos || []).map((p, i) => fila((v.pagos.length > 1 ? 'Pago ' + (i + 1) + ' · ' : '') + METODOS[p.metodo].label, money(p.monto))).join('')}
            ${v.recibido != null ? fila('Recibido', money(v.recibido)) + fila('Cambio', money(v.cambio)) : ''}
            ${linea}
            <div style="text-align:center;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px">${esc(n.mensajeTicket || '')}</div>
            <div style="text-align:center;margin-top:6px;color:#6E655F;font-size:10px">Menú digital por Q-RICO</div>
        </div>`;
    }

    function descargarTicketPDF(v) {
        if (typeof html2pdf === 'undefined') { QUI.toast('No se cargó el generador de PDF.', 'error'); return; }
        const wrap = document.createElement('div');
        wrap.innerHTML = ticketHTML(v);
        const lineas = consolidar(v.items).length + (v.pagos || []).length + (v.recibido != null ? 2 : 0);
        html2pdf().set({
            margin: 3,
            filename: 'ticket-' + folioVenta(v.folio) + '.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: [80, 105 + lineas * 5.2], orientation: 'portrait' }
        }).from(wrap.firstElementChild).save();
    }

    function imprimirHTML(html, titulo) {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(titulo || 'Q-RICO')}</title>
            <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
            <style>body{margin:0;padding:12px;display:flex;flex-wrap:wrap;gap:16px;justify-content:center}@page{margin:8mm}</style></head><body>${html}</body></html>`);
        doc.close();
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => iframe.remove(), 1500);
        }, 600);
    }

    function mostrarTicket(v, recienCobrado) {
        const modal = QUI.openModal({
            title: recienCobrado ? 'Cobro registrado' : 'Ticket ' + folioVenta(v.folio),
            size: 'sm',
            className: 'ticket-modal',
            body: (recienCobrado ? `<div class="ticket-ok">${I('circle-check')}<div><strong>${money(v.total)}</strong><span>${METODOS[v.metodo].label}${v.cambio ? ' · cambio ' + money(v.cambio) : ''}</span></div></div>` : '') +
                  `<div class="ticket-preview">${ticketHTML(v)}</div>`,
            footer: `<button class="q-btn q-btn--outline" id="tk-imprimir">${I('printer')} Imprimir</button>
                     <button class="q-btn q-btn--outline" id="tk-pdf">${I('file-down')} PDF</button>
                     <button class="q-btn q-btn--primary" data-close>Listo</button>`
        });
        if (recienCobrado && QUI.hasGsap()) gsap.from($('.ticket-ok svg', modal.el), { scale: 0, rotate: -90, duration: 0.6, ease: 'back.out(2)' });
        $('#tk-imprimir', modal.el).addEventListener('click', () => imprimirHTML(ticketHTML(v), 'Ticket ' + folioVenta(v.folio)));
        $('#tk-pdf', modal.el).addEventListener('click', () => descargarTicketPDF(v));
    }

    /* =================================================================
       QR DE MESAS
       ================================================================= */
    function qrDataUrl(texto, size) {
        if (typeof QRCode === 'undefined') return '';
        const tmp = document.createElement('div');
        new QRCode(tmp, { text: texto, width: size, height: size, colorDark: COLORES.carbon, colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.M });
        const c = tmp.querySelector('canvas');
        if (c) return c.toDataURL('image/png');
        const img = tmp.querySelector('img');
        return img ? img.src : '';
    }

    function qrCardHTML(mesa, dataUrl) {
        const n = S().negocio;
        return `<div class="qr-print" style="width:300px;box-sizing:border-box;padding:22px 20px;border:2px solid #D1312B;border-radius:18px;text-align:center;font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#1E1B18;page-break-inside:avoid;break-inside:avoid;margin:0 auto 18px">
            <div style="font-family:Fraunces,Georgia,serif;font-size:21px;font-weight:700;line-height:1.2">${esc(n.nombre)}</div>
            <div style="font-size:11px;color:#6E655F;margin-top:2px">${esc(n.eslogan || '')}</div>
            <div style="margin:14px auto 12px;padding:12px;border-radius:14px;background:#EDE2CE;display:inline-block"><img src="${dataUrl}" alt="QR mesa ${esc(mesa.numero)}" style="width:190px;height:190px;display:block"></div>
            <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#B88944;font-weight:800">Mesa</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:42px;font-weight:700;color:#D1312B;line-height:1.05">${esc(mesa.numero)}</div>
            <div style="font-size:12px;margin-top:8px;line-height:1.4">Escanea para ver el menú,<br>ordenar y pedir la cuenta</div>
            <div style="font-size:9px;color:#6E655F;margin-top:10px">Menú digital por <b style="color:#D1312B">Q</b><b style="color:#D1A059">RICO</b></div>
        </div>`;
    }

    function trazoRedondeado(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function descargarQRPng(mesa) {
        const n = S().negocio;
        const url = QStore.urlMenuMesa(mesa.numero);
        const W = 600, H = 820;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = COLORES.coral; ctx.lineWidth = 8;
        trazoRedondeado(ctx, 14, 14, W - 28, H - 28, 34); ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORES.carbon; ctx.font = '700 40px Fraunces, Georgia, serif';
        ctx.fillText(n.nombre.slice(0, 26), W / 2, 92);
        ctx.fillStyle = COLORES.piedra; ctx.font = "500 20px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText((n.eslogan || '').slice(0, 46), W / 2, 128);
        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = COLORES.crema; trazoRedondeado(ctx, 125, 158, 350, 350, 26); ctx.fill();
            ctx.drawImage(img, 145, 178, 310, 310);
            ctx.fillStyle = '#B88944'; ctx.font = "800 22px 'Plus Jakarta Sans', sans-serif";
            ctx.fillText('M E S A', W / 2, 560);
            ctx.fillStyle = COLORES.coral; ctx.font = "700 92px 'JetBrains Mono', monospace";
            ctx.fillText(mesa.numero, W / 2, 650);
            ctx.fillStyle = COLORES.carbon; ctx.font = "600 22px 'Plus Jakarta Sans', sans-serif";
            ctx.fillText('Escanea para ver el menú y ordenar', W / 2, 712);
            ctx.fillStyle = COLORES.piedra; ctx.font = "500 16px 'Plus Jakarta Sans', sans-serif";
            ctx.fillText('Menú digital por Q-RICO', W / 2, 768);
            const a = document.createElement('a');
            a.href = c.toDataURL('image/png');
            a.download = 'QR-mesa-' + mesa.numero + '.png';
            a.click();
        };
        img.src = qrDataUrl(url, 620);
    }

    function pdfDesdeHTML(html, filename, formato) {
        if (typeof html2pdf === 'undefined') { QUI.toast('No se cargó el generador de PDF.', 'error'); return Promise.resolve(); }
        const wrap = document.createElement('div');
        wrap.innerHTML = html;
        return html2pdf().set({
            margin: 10,
            filename,
            image: { type: 'jpeg', quality: 0.97 },
            html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
            jsPDF: { unit: 'mm', format: formato || 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'], avoid: ['.qr-print', 'tr'] }
        }).from(wrap.firstElementChild).save();
    }

    function abrirQR(mesa) {
        if (typeof QRCode === 'undefined') { QUI.toast('No se cargó el generador de QR.', 'error'); return; }
        const url = QStore.urlMenuMesa(mesa.numero);
        const dataUrl = qrDataUrl(url, 380);
        const modal = QUI.openModal({
            title: 'Código QR · Mesa ' + esc(mesa.numero),
            size: 'md',
            body: `<div class="qr-modal">
                    <div class="qr-modal__card">${qrCardHTML(mesa, dataUrl)}</div>
                    <div class="qr-modal__info">
                        <span class="q-label">Enlace de la mesa</span>
                        <div class="copy-field"><input class="q-input q-mono" readonly value="${esc(url)}"><button class="q-icon-btn" id="qr-copiar" aria-label="Copiar">${I('copy')}</button></div>
                        <p class="q-hint">Imprime este código y colócalo en la mesa. Al escanearlo, el comensal abre tu menú con la mesa ya identificada.</p>
                        <div class="stack-actions">
                            <button class="q-btn q-btn--primary" id="qr-pdf">${I('printer')} Imprimir / PDF</button>
                            <button class="q-btn q-btn--outline" id="qr-png">${I('image-down')} Descargar PNG</button>
                            <a class="q-btn q-btn--ghost" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${I('external-link')} Probar menú de la mesa</a>
                        </div>
                    </div>
                </div>`
        });
        $('#qr-copiar', modal.el).addEventListener('click', () => {
            if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => QUI.toast('Enlace copiado.', 'success'));
        });
        $('#qr-png', modal.el).addEventListener('click', () => descargarQRPng(mesa));
        $('#qr-pdf', modal.el).addEventListener('click', () => pdfDesdeHTML('<div style="padding-top:20px">' + qrCardHTML(mesa, dataUrl) + '</div>', 'QR-mesa-' + mesa.numero + '.pdf'));
    }

    /* =================================================================
       VISTAS
       ================================================================= */
    const Views = {};

    /* ---------------- DASHBOARD ---------------- */
    Views.dashboard = {
        init() { this.render(); },
        render() {
            const s = S();
            const se = sesion();
            const now = Date.now();
            const hoy = QStore.startOfDay();
            const h = new Date().getHours();
            $('#dash-saludo').textContent = (h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches') + ', ' + se.nombre.split(' ')[0];
            const f = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
            $('#dash-fecha').textContent = f.charAt(0).toUpperCase() + f.slice(1);

            const ventasHoy = q.ventasEntre(s, hoy, hoy + DAY);
            const ventasAyer = q.ventasEntre(s, hoy - DAY, now - DAY);
            const totalHoy = ventasHoy.reduce((a, v) => a + v.total, 0);
            const totalAyer = ventasAyer.reduce((a, v) => a + v.total, 0);
            const abiertos = s.pedidos.filter(p => !p.pagado && p.estado !== 'cancelado');
            const ordenes = ventasHoy.length + abiertos.length;
            const ocupadas = s.mesas.filter(m => q.estadoMesa(s, m) !== 'libre').length;
            const ticket = ventasHoy.length ? totalHoy / ventasHoy.length : 0;
            const ticketAyer = ventasAyer.length ? totalAyer / ventasAyer.length : 0;
            const enCurso = abiertos.reduce((a, p) => a + p.total, 0);

            const delta = (d) => d == null ? '<span class="kpi__foot">Sin referencia de ayer</span>'
                : `<span class="kpi__foot ${d >= 0 ? 'is-up' : 'is-down'}">${I(d >= 0 ? 'trending-up' : 'trending-down')} ${d >= 0 ? '+' : ''}${d}% vs. ayer a esta hora</span>`;

            $('#dash-kpis').innerHTML = [
                { tone: 'coral', icon: 'wallet', label: 'Ventas del día', value: money(totalHoy), foot: delta(pct(totalHoy, totalAyer)) },
                { tone: 'gold', icon: 'receipt-text', label: 'Órdenes del día', value: ordenes, foot: `<span class="kpi__foot">${abiertos.length} en curso · ${money(enCurso)} por cobrar</span>` },
                { tone: 'dark', icon: 'armchair', label: 'Mesas ocupadas', value: ocupadas + '<small>/' + s.mesas.length + '</small>', foot: `<span class="kpi__foot">${s.mesas.length ? Math.round(ocupadas / s.mesas.length * 100) : 0}% de ocupación</span>` },
                { tone: 'green', icon: 'chart-pie', label: 'Ticket promedio', value: money(ticket), foot: delta(pct(Math.round(ticket), Math.round(ticketAyer))) }
            ].map(k => `<article class="kpi kpi--${k.tone}"><span class="kpi__icon">${I(k.icon)}</span>
                <div class="kpi__body"><span class="kpi__label">${k.label}</span><strong class="kpi__value q-mono">${k.value}</strong>${k.foot}</div></article>`).join('');

            // Ventas por hora (hoy vs ayer)
            const horas = Array.from({ length: 16 }, (_, i) => i + 8);
            const porHora = (lista, base) => horas.map(hh => QStore.round2(lista.filter(v => v.cerradoEn >= base + hh * 3600000 && v.cerradoEn < base + (hh + 1) * 3600000).reduce((a, v) => a + v.total, 0)));
            const ayerCompleto = q.ventasEntre(s, hoy - DAY, hoy);
            chart('chart-horas', {
                type: 'bar',
                data: {
                    labels: horas.map(hh => hh + ':00'),
                    datasets: [
                        { type: 'bar', label: 'Hoy', data: porHora(ventasHoy, hoy), backgroundColor: COLORES.coral, borderRadius: 6, maxBarThickness: 26, order: 2 },
                        { type: 'line', label: 'Ayer', data: porHora(ayerCompleto, hoy - DAY), borderColor: COLORES.mostaza, backgroundColor: COLORES.mostaza, borderWidth: 2, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 4, tension: 0.35, order: 1 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: ejeX, y: ejeDinero }, plugins: { legend: { position: 'top', align: 'end' }, tooltip: tooltipDinero } }
            });

            // Más vendidos
            let fuente = ventasHoy, etiqueta = 'Hoy · por unidades';
            if (!fuente.length) { fuente = q.ventasEntre(s, hoy - 6 * DAY, hoy + DAY); etiqueta = 'Últimos 7 días · por unidades'; }
            const conteo = {};
            fuente.forEach(v => v.items.forEach(it => { conteo[it.nombre] = (conteo[it.nombre] || 0) + it.cantidad; }));
            const top = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5);
            $('#dash-top-sub').textContent = etiqueta;
            chart('chart-top', {
                type: 'doughnut',
                data: { labels: top.map(t => t[0]), datasets: [{ data: top.map(t => t[1]), backgroundColor: SERIE, borderColor: '#fff', borderWidth: 3, hoverOffset: 6 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.parsed + ' unidades' } } } }
            });
            $('#dash-top-list').innerHTML = top.length ? top.map((t, i) => `<li><span class="legend-swatch" style="background:${SERIE[i]}"></span><span>${esc(t[0])}</span><b class="q-mono">${t[1]}</b></li>`).join('')
                : '<li class="q-muted">Aún no hay ventas registradas.</li>';

            // Semana
            const dias = Array.from({ length: 7 }, (_, i) => hoy - (6 - i) * DAY);
            chart('chart-semana', {
                type: 'bar',
                data: {
                    labels: dias.map(d => new Date(d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }).replace('.', '')),
                    datasets: [{ label: 'Ventas', data: dias.map(d => QStore.round2(q.ventasEntre(s, d, d + DAY).reduce((a, v) => a + v.total, 0))), backgroundColor: dias.map(d => d === hoy ? COLORES.coral : COLORES.mostaza), borderRadius: 6, maxBarThickness: 44 }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { x: ejeX, y: ejeDinero }, plugins: { legend: { display: false }, tooltip: tooltipDinero } }
            });

            // Órdenes en vivo
            const recientes = s.pedidos.filter(p => !p.pagado || p.creadoEn >= hoy).sort((a, b) => b.creadoEn - a.creadoEn).slice(0, 8);
            $('#dash-ordenes').innerHTML = recientes.length
                ? `<thead><tr><th>Folio</th><th>Origen</th><th>Platillos</th><th>Estado</th><th class="t-right">Total</th><th class="t-right">Tiempo</th></tr></thead><tbody>
                    ${recientes.map(p => {
                        const o = origenPedido(s, p);
                        const est = QStore.ESTADOS_PEDIDO[p.estado];
                        return `<tr><td class="q-mono"><b>#${p.folio}</b></td><td><span class="cell-icon">${I(o.icon)}${esc(o.label)}</span></td>
                            <td class="t-ellipsis">${esc(p.items.map(i => i.cantidad + '× ' + i.nombre).join(', '))}</td>
                            <td><span class="state-badge state-badge--${p.estado}">${esc(est.label)}</span>${p.pagado ? ' <span class="q-badge q-badge--green">Pagado</span>' : ''}</td>
                            <td class="t-right q-mono">${money(p.total)}</td><td class="t-right q-mono">${QStore.minutesSince(p.creadoEn)} min</td></tr>`;
                    }).join('')}</tbody>`
                : `<tbody><tr><td><div class="q-empty">${I('inbox')}<span>Sin órdenes en curso.</span></div></td></tr></tbody>`;

            // Alertas
            const alertas = q.alertasActivas(s).sort((a, b) => b.creadoEn - a.creadoEn);
            const cont = $('#dash-alertas');
            cont.innerHTML = alertas.length ? alertas.map(a => alertaItemHTML(s, a, false)).join('')
                : `<div class="q-empty">${I('smile')}<strong>Todo en orden</strong><span>Ninguna mesa está esperando.</span></div>`;
            if (!cont.dataset.bound) {
                cont.dataset.bound = '1';
                cont.addEventListener('click', e => {
                    const at = e.target.closest('[data-atender]');
                    if (at) atenderAlerta(at.dataset.atender);
                    const cb = e.target.closest('[data-cobrar-mesa]');
                    if (cb) abrirCobro({ mesaId: cb.dataset.cobrarMesa, tipo: 'mesa' });
                });
            }
            QUI.icons($('#admin-main-content'));
        }
    };

    /* ---------------- PUNTO DE VENTA ---------------- */
    const pos = { cat: 'todas', busqueda: '', tipo: 'mesa', mesaId: null, lineas: [] };

    function posTotal() {
        const s = S();
        return QStore.round2(pos.lineas.reduce((a, l) => { const p = q.platillo(s, l.platilloId); return a + (p ? p.precio * l.cantidad : 0); }, 0));
    }

    function posAgregar(platilloId) {
        const p = q.platillo(S(), platilloId);
        if (!p || !p.disponible) { QUI.toast('Ese platillo está agotado.', 'warning'); return; }
        const key = platilloId + '|';
        const l = pos.lineas.find(x => x.key === key);
        if (l) l.cantidad++; else pos.lineas.push({ key, platilloId, cantidad: 1, notas: '' });
        Views.pos.renderTicket();
        const el = $('.pos-line[data-key="' + CSS.escape(key) + '"]');
        if (el && QUI.hasGsap()) gsap.fromTo(el, { backgroundColor: '#F6ECDC' }, { backgroundColor: '#FFFFFF', duration: 0.8 });
    }

    function posEditarNota(key) {
        const l = pos.lineas.find(x => x.key === key);
        if (!l) return;
        const p = q.platillo(S(), l.platilloId);
        const m = QUI.openModal({
            title: 'Nota para cocina', size: 'sm',
            body: `<p class="q-muted" style="margin-bottom:10px">${esc(p ? p.nombre : '')}</p><textarea class="q-textarea" id="pos-nota" maxlength="140" placeholder="Ej. sin cebolla, término medio…">${esc(l.notas)}</textarea>`,
            footer: '<button class="q-btn q-btn--ghost" data-close>Cancelar</button><button class="q-btn q-btn--primary" id="pos-nota-ok">Guardar nota</button>'
        });
        $('#pos-nota', m.el).focus();
        $('#pos-nota-ok', m.el).addEventListener('click', () => {
            const notas = $('#pos-nota', m.el).value.trim();
            const nuevaKey = l.platilloId + '|' + notas.toLowerCase();
            const existente = pos.lineas.find(x => x.key === nuevaKey && x !== l);
            if (existente) { existente.cantidad += l.cantidad; pos.lineas = pos.lineas.filter(x => x !== l); }
            else { l.notas = notas; l.key = nuevaKey; }
            m.close();
            Views.pos.renderTicket();
        });
    }

    function posEnviarCocina() {
        const s = S();
        if (pos.tipo !== 'mesa' || !pos.mesaId) { QUI.toast('Selecciona una mesa.', 'warning'); return; }
        const items = pos.lineas.map(l => {
            const p = q.platillo(s, l.platilloId);
            return p && p.disponible ? { platilloId: p.id, nombre: p.nombre, precio: p.precio, cantidad: l.cantidad, notas: l.notas } : null;
        }).filter(Boolean);
        if (!items.length) { QUI.toast('Agrega platillos a la orden.', 'warning'); return; }
        const ped = guardar(st => {
            const m = q.mesa(st, pos.mesaId);
            const p = {
                id: QStore.uid('ped'), folio: st.contadores.pedido++, mesaId: m.id, origen: 'pos', tipo: 'mesa', estado: 'pendiente', pagado: false,
                creadoEn: Date.now(), actualizadoEn: Date.now(), items, total: QStore.totalItems(items)
            };
            st.pedidos.push(p);
            if (!m.abierta) { m.abierta = true; m.abiertaEn = Date.now(); }
            return p;
        }, { type: 'pedido:nuevo', mesaId: pos.mesaId });
        if (!ped) return;
        pos.lineas = [];
        QUI.toast('Orden #' + ped.folio + ' enviada a cocina.', 'success', { icon: 'chef-hat' });
        Views.pos.renderTicket();
    }

    Views.pos = {
        init() {
            if (mesaParaPOS) { pos.tipo = 'mesa'; pos.mesaId = mesaParaPOS; mesaParaPOS = null; }
            const buscar = $('#pos-buscar');
            buscar.value = pos.busqueda;
            buscar.addEventListener('input', () => { pos.busqueda = buscar.value.trim().toLowerCase(); this.renderGrid(); });
            $('#pos-cats').addEventListener('click', e => {
                const b = e.target.closest('[data-cat]');
                if (!b) return;
                pos.cat = b.dataset.cat;
                this.renderCats();
                this.renderGrid();
            });
            $('#pos-grid').addEventListener('click', e => {
                const b = e.target.closest('[data-add]');
                if (b && !b.disabled) { posAgregar(b.dataset.add); if (QUI.hasGsap()) gsap.fromTo(b, { scale: 0.95 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }); }
            });
            $('#pos-cuentas-abiertas').addEventListener('click', e => {
                const directo = e.target.closest('[data-cobrar-pedido]');
                if (directo) { abrirCobro({ pedidoId: directo.dataset.cobrarPedido }); return; }
                const b = e.target.closest('[data-mesa]');
                if (!b) return;
                pos.tipo = 'mesa';
                pos.mesaId = b.dataset.mesa;
                this.renderTicket();
            });
            $('#pos-tipo').addEventListener('click', e => {
                const b = e.target.closest('[data-tipo]');
                if (!b) return;
                pos.tipo = b.dataset.tipo;
                this.renderTicket();
            });
            $('#pos-mesa').addEventListener('change', e => { pos.mesaId = e.target.value || null; this.renderTicket(); });
            $('#pos-limpiar').addEventListener('click', () => { pos.lineas = []; this.renderTicket(); });
            $('#pos-lines').addEventListener('click', e => {
                const b = e.target.closest('button');
                if (!b) return;
                const key = b.dataset.key;
                const l = pos.lineas.find(x => x.key === key);
                if (b.dataset.act === 'nota') { posEditarNota(key); return; }
                if (!l) return;
                if (b.dataset.act === 'inc') l.cantidad++;
                if (b.dataset.act === 'dec') l.cantidad--;
                if (b.dataset.act === 'del' || l.cantidad <= 0) pos.lineas = pos.lineas.filter(x => x !== l);
                this.renderTicket();
            });
            $('#pos-foot').addEventListener('click', e => {
                const b = e.target.closest('button');
                if (!b) return;
                if (b.id === 'pos-enviar') posEnviarCocina();
                if (b.id === 'pos-cobrar') {
                    if (pos.tipo === 'mesa' && !pos.mesaId) { QUI.toast('Selecciona una mesa.', 'warning'); return; }
                    abrirCobro({
                        mesaId: pos.tipo === 'mesa' ? pos.mesaId : null, tipo: pos.tipo, lineasExtra: pos.lineas,
                        onDone: () => { pos.lineas = []; this.renderTicket(); }
                    });
                }
            });
            this.render();
        },
        render() {
            this.renderCats();
            this.renderGrid();
            this.renderTicket();
        },
        renderCats() {
            const s = S();
            const cats = [{ id: 'todas', nombre: 'Todo', icono: 'layout-grid' }].concat(q.categoriasOrdenadas(s));
            $('#pos-cats').innerHTML = cats.map(c => `<button class="q-chip ${pos.cat === c.id ? 'is-active' : ''}" data-cat="${c.id}">${I(c.icono || 'utensils')}${esc(c.nombre)}</button>`).join('');
            QUI.icons($('#pos-cats'));
        },
        renderGrid() {
            const s = S();
            const lista = s.platillos.filter(p => (pos.cat === 'todas' || p.categoriaId === pos.cat) && (!pos.busqueda || p.nombre.toLowerCase().includes(pos.busqueda)));
            $('#pos-grid').innerHTML = lista.length ? lista.map(p => `
                <button class="pos-item ${p.disponible ? '' : 'is-soldout'}" data-add="${p.id}" ${p.disponible ? '' : 'disabled'}>
                    <span class="pos-item__img">${QUI.imgTag(p.imagen, p.nombre, '', { ancho: 360 })}${p.disponible ? '' : '<span class="pos-item__tag">Agotado</span>'}</span>
                    <span class="pos-item__name">${esc(p.nombre)}</span>
                    <span class="pos-item__price q-mono">${money(p.precio)}</span>
                </button>`).join('')
                : `<div class="q-empty">${I('search-x')}<span>Sin resultados.</span></div>`;
            QUI.icons($('#pos-grid'));
        },
        renderTicket() {
            const s = S();
            if (pos.mesaId && !q.mesa(s, pos.mesaId)) pos.mesaId = null;
            $$('#pos-tipo button').forEach(b => b.classList.toggle('is-active', b.dataset.tipo === pos.tipo));
            $('#pos-mesa-row').hidden = pos.tipo !== 'mesa';
            $('#pos-mesa').innerHTML = '<option value="">Selecciona una mesa…</option>' + s.mesas.map(m => {
                const est = QStore.ESTADOS_MESA[q.estadoMesa(s, m)].label;
                return `<option value="${m.id}" ${pos.mesaId === m.id ? 'selected' : ''}>Mesa ${esc(m.numero)} · ${esc(m.zona)} · ${est}</option>`;
            }).join('');

            // Cuentas abiertas (atajos): mesas con consumo y pedidos directos del menú QR por cobrar en caja
            const abiertas = s.mesas.filter(m => q.pedidosAbiertosMesa(s, m.id).length);
            const directos = q.pedidosDirectosAbiertos(s);
            $('#pos-cuentas-abiertas').innerHTML =
                (abiertas.length
                    ? '<span class="q-label">Cuentas abiertas</span>' + abiertas.map(m => `<button class="open-acc ${pos.mesaId === m.id && pos.tipo === 'mesa' ? 'is-active' : ''} open-acc--${q.estadoMesa(s, m)}" data-mesa="${m.id}"><b class="q-mono">${esc(m.numero)}</b><span class="q-mono">${money(q.cuentaMesa(s, m.id).subtotal)}</span></button>`).join('')
                    : '') +
                (directos.length
                    ? (abiertas.length ? '<span class="open-acc-salto" aria-hidden="true"></span>' : '') +
                      '<span class="q-label">Pedidos directos</span>' + directos.map(p => {
                        const o = origenPedido(s, p);
                        return `<button class="open-acc open-acc--directo" data-cobrar-pedido="${p.id}" title="Cobrar pedido #${p.folio} · ${esc(o.label)}">${I(o.icon)}<b class="q-mono">#${p.folio}</b>${p.comensal ? `<span>${esc(p.comensal)}</span>` : ''}<span class="q-mono">${money(p.total)}</span></button>`;
                    }).join('')
                    : '');

            const cuentaBox = $('#pos-cuenta-mesa');
            if (pos.tipo === 'mesa' && pos.mesaId) {
                const c = q.cuentaMesa(s, pos.mesaId);
                cuentaBox.innerHTML = c.items.length
                    ? `<div class="pos-account">${I('receipt-text')}<div><strong>Cuenta abierta · ${money(c.subtotal)}</strong><span>${c.pedidos.length} ${c.pedidos.length === 1 ? 'orden enviada' : 'órdenes enviadas'} a cocina</span></div></div>`
                    : `<div class="pos-account pos-account--empty">${I('info')}<span>Esta mesa aún no tiene consumo.</span></div>`;
            } else cuentaBox.innerHTML = '';

            const lines = $('#pos-lines');
            if (!pos.lineas.length) {
                lines.innerHTML = `<div class="q-empty">${I('mouse-pointer-click')}<strong>Orden vacía</strong><span>Toca un platillo del catálogo para agregarlo.</span></div>`;
            } else {
                lines.innerHTML = pos.lineas.map(l => {
                    const p = q.platillo(s, l.platilloId);
                    if (!p) return '';
                    return `<div class="pos-line" data-key="${esc(l.key)}">
                        <div class="pos-line__info">
                            <strong>${esc(p.nombre)}</strong>
                            <button class="link-btn" data-act="nota" data-key="${esc(l.key)}">${I('notebook-pen')}${l.notas ? esc(l.notas) : 'Agregar nota'}</button>
                        </div>
                        <div class="qty-mini">
                            <button data-act="dec" data-key="${esc(l.key)}" aria-label="Menos">${I('minus')}</button>
                            <span class="q-mono">${l.cantidad}</span>
                            <button data-act="inc" data-key="${esc(l.key)}" aria-label="Más">${I('plus')}</button>
                        </div>
                        <span class="pos-line__total q-mono">${money(p.precio * l.cantidad)}</span>
                        <button class="q-icon-btn q-icon-btn--sm q-icon-btn--danger" data-act="del" data-key="${esc(l.key)}" aria-label="Quitar">${I('x')}</button>
                    </div>`;
                }).join('');
            }

            const total = posTotal();
            const cuentaMesa = pos.tipo === 'mesa' && pos.mesaId ? q.cuentaMesa(s, pos.mesaId).subtotal : 0;
            const foot = $('#pos-foot');
            if (pos.tipo === 'mesa') {
                foot.innerHTML = `
                    <div class="summary-line"><span>Esta orden</span><b class="q-mono">${money(total)}</b></div>
                    ${cuentaMesa ? `<div class="summary-line summary-line--muted"><span>Cuenta abierta de la mesa</span><span class="q-mono">${money(cuentaMesa)}</span></div>` : ''}
                    <div class="pos-foot-actions">
                        <button class="q-btn q-btn--primary q-btn--lg" id="pos-enviar" ${total && pos.mesaId ? '' : 'disabled'}>${I('chef-hat')} Enviar a cocina</button>
                        <button class="q-btn q-btn--dark q-btn--lg" id="pos-cobrar" ${(total || cuentaMesa) && pos.mesaId ? '' : 'disabled'}>${I('wallet')} Cobrar ${money(total + cuentaMesa)}</button>
                    </div>`;
            } else {
                foot.innerHTML = `
                    <div class="summary-line"><span>Total</span><b class="q-mono">${money(total)}</b></div>
                    <button class="q-btn q-btn--primary q-btn--lg q-btn--block" id="pos-cobrar" ${total ? '' : 'disabled'}>${I('wallet')} Cobrar y enviar a cocina</button>`;
            }
            QUI.icons($('.pos-ticket'));
            QUI.icons($('#pos-cuentas-abiertas'));
        }
    };

    /* ---------------- KDS ---------------- */
    const kds = { sortables: [], arrastrando: false, pendiente: false, conocidos: null, timer: null };

    function moverPedido(id, estado) {
        guardar(st => {
            const p = st.pedidos.find(x => x.id === id);
            if (!p) return;
            p.estado = estado;
            p.actualizadoEn = Date.now();
            if (estado === 'preparacion' && !p.iniciadoEn) p.iniciadoEn = Date.now();
            if (estado === 'listo') p.listoEn = Date.now();
            if (estado === 'entregado') p.entregadoEn = Date.now();
        }, { type: 'pedido:estado', estado, pedidoId: id });
    }

    const KDS_SIGUIENTE = {
        pendiente: { estado: 'preparacion', label: 'Iniciar', icon: 'flame', cls: 'q-btn--gold' },
        preparacion: { estado: 'listo', label: 'Marcar listo', icon: 'bell-ring', cls: 'q-btn--success' },
        listo: { estado: 'entregado', label: 'Entregado', icon: 'check', cls: 'q-btn--dark' }
    };
    const KDS_ANTERIOR = { preparacion: 'pendiente', listo: 'preparacion' };

    function claseTimer(ts) {
        const m = QStore.minutesSince(ts);
        return m >= 20 ? 'is-late' : m >= 10 ? 'is-warn' : '';
    }

    Views.kds = {
        init() {
            const btnS = $('#kds-sonido');
            const pintarSonido = () => {
                btnS.innerHTML = sonidoActivo() ? I('volume-2') + ' Sonido activo' : I('volume-x') + ' Sonido apagado';
                btnS.classList.toggle('is-off', !sonidoActivo());
                QUI.icons(btnS);
            };
            pintarSonido();
            btnS.addEventListener('click', () => {
                localStorage.setItem(SOUND_KEY, sonidoActivo() ? '0' : '1');
                QUI.unlockAudio();
                pintarSonido();
                if (sonidoActivo()) setTimeout(() => QUI.chime('pedido'), 50);
            });
            $('#kds-fullscreen').addEventListener('click', () => {
                const el = $('.view-kds');
                if (document.fullscreenElement) document.exitFullscreen();
                else if (el.requestFullscreen) el.requestFullscreen();
            });

            $('.kds-board').addEventListener('click', e => {
                const b = e.target.closest('[data-mover]');
                if (!b) return;
                const card = b.closest('.kds-card');
                const go = () => moverPedido(b.dataset.mover, b.dataset.estado);
                if (QUI.hasGsap() && card) gsap.to(card, { x: b.dataset.dir === 'back' ? -30 : 30, opacity: 0, duration: 0.22, ease: 'power2.in', onComplete: go });
                else go();
            });

            if (typeof Sortable !== 'undefined') {
                $$('.kds-list').forEach(list => {
                    kds.sortables.push(Sortable.create(list, {
                        group: 'kds', animation: 180, ghostClass: 'kds-card--ghost', chosenClass: 'kds-card--chosen', dragClass: 'kds-card--drag',
                        delay: 120, delayOnTouchOnly: true, filter: 'button', preventOnFilter: false,
                        onStart: () => { kds.arrastrando = true; },
                        onEnd: (evt) => {
                            kds.arrastrando = false;
                            const id = evt.item.dataset.id;
                            const nuevo = evt.to.dataset.estado;
                            if (evt.from !== evt.to) moverPedido(id, nuevo);
                            else if (kds.pendiente) { kds.pendiente = false; this.render(); }
                        }
                    }));
                });
            }

            kds.conocidos = null;
            this.render();
            kds.timer = setInterval(() => {
                $$('.kds-timer').forEach(t => {
                    const ts = Number(t.dataset.desde);
                    t.textContent = QStore.formatTimer(ts);
                    t.className = 'kds-timer q-mono ' + claseTimer(ts);
                });
            }, 1000);
        },
        render() {
            if (kds.arrastrando) { kds.pendiente = true; return; }
            const s = S();
            const activos = s.pedidos.filter(p => ['pendiente', 'preparacion', 'listo'].includes(p.estado)).sort((a, b) => a.creadoEn - b.creadoEn);
            const nuevos = new Set();
            if (kds.conocidos) activos.forEach(p => { if (!kds.conocidos.has(p.id)) nuevos.add(p.id); });
            kds.conocidos = new Set(activos.map(p => p.id));

            ['pendiente', 'preparacion', 'listo'].forEach(estado => {
                const lista = activos.filter(p => p.estado === estado);
                $('[data-count="' + estado + '"]').textContent = lista.length;
                const cont = $('.kds-list[data-estado="' + estado + '"]');
                cont.innerHTML = lista.length ? lista.map(p => {
                    const o = origenPedido(s, p);
                    const sig = KDS_SIGUIENTE[estado];
                    const ant = KDS_ANTERIOR[estado];
                    return `<article class="kds-card kds-card--${estado} ${nuevos.has(p.id) ? 'is-new' : ''}" data-id="${p.id}">
                        <header class="kds-card__head">
                            <div>
                                <span class="kds-card__folio q-mono">#${p.folio}</span>
                                <span class="kds-card__origen">${I(o.icon)}${esc(o.label)}${p.comensal ? ' · ' + esc(p.comensal) : ''}</span>
                            </div>
                            <span class="kds-timer q-mono ${claseTimer(p.creadoEn)}" data-desde="${p.creadoEn}">${QStore.formatTimer(p.creadoEn)}</span>
                        </header>
                        <ul class="kds-card__items">
                            ${p.items.map(it => `<li><b class="q-mono">${it.cantidad}×</b><div><span>${esc(it.nombre)}</span>${it.notas ? `<em class="kds-note">${I('triangle-alert')}${esc(it.notas)}</em>` : ''}</div></li>`).join('')}
                        </ul>
                        <footer class="kds-card__foot">
                            <span class="q-badge ${p.origen === 'qr' ? 'q-badge--coral' : 'q-badge--neutral'}">${I(p.origen === 'qr' ? 'qr-code' : 'calculator')}${p.origen === 'qr' ? 'Menú QR' : 'POS'}</span>
                            <div class="kds-card__btns">
                                ${ant ? `<button class="q-icon-btn q-icon-btn--sm" data-mover="${p.id}" data-estado="${ant}" data-dir="back" title="Regresar">${I('undo-2')}</button>` : ''}
                                <button class="q-btn q-btn--sm ${sig.cls}" data-mover="${p.id}" data-estado="${sig.estado}">${I(sig.icon)} ${sig.label}</button>
                            </div>
                        </footer>
                    </article>`;
                }).join('') : `<div class="kds-empty">${I(estado === 'pendiente' ? 'inbox' : estado === 'preparacion' ? 'flame' : 'bell')}<span>${estado === 'pendiente' ? 'Sin comandas nuevas' : estado === 'preparacion' ? 'Nada en el fuego' : 'Nada por servir'}</span></div>`;
            });

            // Estadísticas
            const hoy = QStore.startOfDay();
            const entregadosHoy = s.pedidos.filter(p => p.entregadoEn && p.entregadoEn >= hoy);
            const prom = entregadosHoy.length ? Math.round(entregadosHoy.reduce((a, p) => a + (p.entregadoEn - p.creadoEn), 0) / entregadosHoy.length / 60000) : null;
            const atrasados = activos.filter(p => QStore.minutesSince(p.creadoEn) >= 20 && p.estado !== 'listo').length;
            $('#kds-stats').innerHTML = `
                <div class="kds-stat"><span>Comandas activas</span><b class="q-mono">${activos.length}</b></div>
                <div class="kds-stat"><span>Entregadas hoy</span><b class="q-mono">${entregadosHoy.length}</b></div>
                <div class="kds-stat"><span>Tiempo promedio</span><b class="q-mono">${prom == null ? '—' : prom + ' min'}</b></div>
                <div class="kds-stat ${atrasados ? 'kds-stat--alert' : ''}"><span>Con más de 20 min</span><b class="q-mono">${atrasados}</b></div>`;

            QUI.icons($('.view-kds'));
            if (nuevos.size && QUI.hasGsap()) {
                gsap.from('.kds-card.is-new', { y: -24, opacity: 0, scale: 0.94, duration: 0.6, ease: 'back.out(1.7)' });
            }
        },
        destroy() {
            clearInterval(kds.timer);
            kds.sortables.forEach(x => x.destroy());
            kds.sortables = [];
            kds.arrastrando = false;
            if (document.fullscreenElement) document.exitFullscreen();
        }
    };

    /* ---------------- MESAS ---------------- */
    const mesasUI = { zona: 'todas' };

    function abrirFormMesa(mesa) {
        const s = S();
        const zonas = Array.from(new Set(s.mesas.map(m => m.zona)));
        let capacidad = mesa ? mesa.capacidad : 4;
        const modal = QUI.openModal({
            title: mesa ? 'Editar mesa ' + esc(mesa.numero) : 'Agregar mesa',
            size: 'sm',
            body: `<form class="q-form-grid" id="form-mesa" novalidate>
                <div class="q-field"><label for="mesa-numero">Número o nombre</label><input class="q-input q-mono" id="mesa-numero" maxlength="6" required value="${mesa ? esc(mesa.numero) : ''}" placeholder="Ej. 7 o T4"></div>
                <div class="q-field"><label for="mesa-zona">Zona</label><input class="q-input" id="mesa-zona" list="zonas-list" maxlength="24" value="${esc(mesa ? mesa.zona : (zonas[0] || 'Salón'))}"><datalist id="zonas-list">${zonas.map(z => `<option value="${esc(z)}">`).join('')}</datalist></div>
                <div class="q-field q-span-2"><label>Capacidad</label><div class="cap-picker" id="cap-picker">${[2, 4, 6, 8, 10, 12].map(c => `<button type="button" data-cap="${c}" class="${c === capacidad ? 'is-active' : ''}">${I('users')}<b class="q-mono">${c}</b></button>`).join('')}</div></div>
                ${mesa ? '<p class="q-hint q-span-2">Si cambias el número, el código QR impreso de esta mesa dejará de funcionar y deberás reimprimirlo.</p>' : '<p class="q-hint q-span-2">Al guardar se genera automáticamente el código QR de la mesa.</p>'}
            </form>`,
            footer: `<button class="q-btn q-btn--ghost" data-close>Cancelar</button><button class="q-btn q-btn--primary" id="mesa-guardar">${I('check')} ${mesa ? 'Guardar' : 'Crear mesa y QR'}</button>`
        });
        $('#cap-picker', modal.el).addEventListener('click', e => {
            const b = e.target.closest('[data-cap]');
            if (!b) return;
            capacidad = Number(b.dataset.cap);
            $$('#cap-picker button', modal.el).forEach(x => x.classList.toggle('is-active', x === b));
        });
        const guardarMesa = () => {
            const numero = $('#mesa-numero', modal.el).value.trim().toUpperCase();
            const zona = $('#mesa-zona', modal.el).value.trim() || 'Salón';
            if (!numero) { QUI.toast('Escribe el número de la mesa.', 'error'); QUI.shake($('#mesa-numero', modal.el)); return; }
            if (!/^[A-Z0-9-]{1,6}$/.test(numero)) { QUI.toast('Usa solo letras, números o guion (máx. 6).', 'error'); return; }
            const dup = S().mesas.find(m => m.numero.toUpperCase() === numero && (!mesa || m.id !== mesa.id));
            if (dup) { QUI.toast('Ya existe la mesa ' + numero + '.', 'error'); return; }
            let creada = null;
            guardar(st => {
                if (mesa) {
                    const m = q.mesa(st, mesa.id);
                    Object.assign(m, { numero, zona, capacidad });
                } else {
                    creada = { id: QStore.uid('mesa'), numero, zona, capacidad, abierta: false, abiertaEn: null };
                    st.mesas.push(creada);
                }
            }, { type: 'mesas:actualizadas' }, mesa ? 'Mesa actualizada.' : 'Mesa ' + numero + ' creada.');
            modal.close();
            if (creada) setTimeout(() => abrirQR(creada), 280);
        };
        $('#mesa-guardar', modal.el).addEventListener('click', guardarMesa);
        $('#form-mesa', modal.el).addEventListener('submit', e => { e.preventDefault(); guardarMesa(); });
        $('#mesa-numero', modal.el).focus();
    }

    function abrirDetalleMesa(id) {
        const s = S();
        const mesa = q.mesa(s, id);
        if (!mesa) return;
        const estado = q.estadoMesa(s, mesa);
        const cuenta = q.cuentaMesa(s, mesa.id);
        const alertas = q.alertasMesa(s, mesa.id);
        const info = QStore.ESTADOS_MESA[estado];
        const modal = QUI.openModal({
            title: 'Mesa ' + esc(mesa.numero) + ' <small class="modal-sub">' + esc(mesa.zona) + ' · ' + mesa.capacidad + ' personas</small>',
            size: 'md',
            body: `<div class="mesa-detalle">
                <div class="mesa-detalle__estado mesa-detalle__estado--${estado}">${I(info.icon)}<div><strong>${info.label}</strong><span>${mesa.abiertaEn ? 'Abierta hace ' + QStore.minutesSince(mesa.abiertaEn) + ' min' : 'Lista para recibir comensales'}</span></div></div>
                ${alertas.map(a => `<div class="alert-item alert-item--${a.tipo}"><span class="alert-item__icon">${I(a.tipo === 'cuenta' ? 'receipt-text' : 'hand-platter')}</span><div class="alert-item__body"><strong>${a.tipo === 'cuenta' ? 'Pide la cuenta' : 'Llama al mesero'}</strong><span>${esc(a.nota || 'Hace ' + QStore.minutesSince(a.creadoEn) + ' min')}</span></div><div class="alert-item__actions"><button class="q-btn q-btn--outline q-btn--sm" data-atender="${a.id}">${I('check')} Atender</button></div></div>`).join('')}
                <div class="mesa-detalle__cuenta">
                    <span class="q-label">Consumo</span>
                    ${cuenta.pedidos.length ? cuenta.pedidos.map(p => `<div class="order-block"><div class="order-block__head"><b class="q-mono">#${p.folio}</b><span class="state-badge state-badge--${p.estado}">${QStore.ESTADOS_PEDIDO[p.estado].label}</span><span class="q-mono q-muted">${hora(p.creadoEn)}</span></div>
                        ${p.items.map(it => `<div class="order-block__line"><span><b class="q-mono">${it.cantidad}×</b> ${esc(it.nombre)}${it.notas ? ' <em>· ' + esc(it.notas) + '</em>' : ''}</span><span class="q-mono">${money(it.precio * it.cantidad)}</span></div>`).join('')}</div>`).join('')
                        : '<p class="q-muted">Sin consumo registrado.</p>'}
                    ${cuenta.items.length ? `<div class="order-total"><span>Total de la cuenta</span><b class="q-mono">${money(cuenta.subtotal)}</b></div>` : ''}
                </div>
            </div>`,
            footer: `
                <button class="q-btn q-btn--ghost q-btn--sm" data-acc="qr">${I('qr-code')} QR</button>
                ${puede('mesas') ? `<button class="q-btn q-btn--ghost q-btn--sm" data-acc="editar">${I('pencil')} Editar</button>` : ''}
                ${estado === 'libre' ? `<button class="q-btn q-btn--ghost q-btn--sm" data-acc="eliminar">${I('trash-2')} Eliminar</button>` : ''}
                <span class="footer-spacer"></span>
                ${!cuenta.items.length && (mesa.abierta || alertas.length) ? `<button class="q-btn q-btn--outline" data-acc="liberar">${I('sparkles')} Liberar mesa</button>` : ''}
                ${!mesa.abierta && !cuenta.items.length ? `<button class="q-btn q-btn--outline" data-acc="abrir">${I('users')} Sentar comensales</button>` : ''}
                ${puede('pos') ? `<button class="q-btn q-btn--outline" data-acc="pos">${I('plus')} Agregar productos</button>` : ''}
                ${puede('pos') && cuenta.items.length ? `<button class="q-btn q-btn--primary" data-acc="cobrar">${I('wallet')} Cobrar ${money(cuenta.subtotal)}</button>` : ''}`
        });
        modal.el.addEventListener('click', async e => {
            const at = e.target.closest('[data-atender]');
            if (at) { atenderAlerta(at.dataset.atender); at.closest('.alert-item').remove(); return; }
            const b = e.target.closest('[data-acc]');
            if (!b) return;
            const acc = b.dataset.acc;
            if (acc === 'qr') abrirQR(mesa);
            if (acc === 'editar') { modal.close(); setTimeout(() => abrirFormMesa(mesa), 250); }
            if (acc === 'eliminar') {
                const ok = await QUI.confirmDialog({ title: 'Eliminar mesa ' + esc(mesa.numero), message: 'Se eliminará la mesa y su código QR dejará de funcionar. Esta acción no se puede deshacer.', confirmText: 'Eliminar', danger: true });
                if (!ok) return;
                guardar(st => { st.mesas = st.mesas.filter(m => m.id !== mesa.id); st.alertas = st.alertas.filter(a => a.mesaId !== mesa.id); }, { type: 'mesas:actualizadas' }, 'Mesa eliminada.');
                modal.close();
            }
            if (acc === 'liberar') {
                guardar(st => {
                    const m = q.mesa(st, mesa.id);
                    m.abierta = false; m.abiertaEn = null;
                    st.alertas.forEach(a => { if (a.mesaId === mesa.id && !a.atendida) { a.atendida = true; a.atendidaEn = Date.now(); } });
                }, { type: 'mesas:actualizadas' }, 'Mesa ' + mesa.numero + ' liberada.');
                modal.close();
            }
            if (acc === 'abrir') {
                guardar(st => { const m = q.mesa(st, mesa.id); m.abierta = true; m.abiertaEn = Date.now(); }, { type: 'mesas:actualizadas' }, 'Mesa ' + mesa.numero + ' ocupada.');
                modal.close();
            }
            if (acc === 'pos') { modal.close(); mesaParaPOS = mesa.id; location.hash = '#pos'; if (vistaActual === 'pos') { pos.tipo = 'mesa'; pos.mesaId = mesa.id; mesaParaPOS = null; Views.pos.renderTicket(); } }
            if (acc === 'cobrar') { modal.close(); setTimeout(() => abrirCobro({ mesaId: mesa.id, tipo: 'mesa' }), 250); }
        });
    }

    async function imprimirTodosQR() {
        const s = S();
        if (!s.mesas.length) { QUI.toast('Aún no hay mesas.', 'warning'); return; }
        if (typeof QRCode === 'undefined') { QUI.toast('No se cargó el generador de QR.', 'error'); return; }
        QUI.toast('Generando PDF con ' + s.mesas.length + ' códigos QR…', 'info', { icon: 'printer' });
        const tarjetas = s.mesas.map(m => `<div style="display:inline-block;vertical-align:top;width:48%;padding:6px 0">${qrCardHTML(m, qrDataUrl(QStore.urlMenuMesa(m.numero), 380))}</div>`).join('');
        await pdfDesdeHTML(`<div style="width:720px;text-align:center;font-size:0">${tarjetas}</div>`, 'QR-mesas-' + s.negocio.nombre.replace(/\s+/g, '-') + '.pdf');
    }

    Views.mesas = {
        init() {
            const soloLectura = !puede('mesas');
            $('#mesas-agregar').hidden = soloLectura;
            $('#mesas-agregar').addEventListener('click', () => abrirFormMesa(null));
            $('#mesas-imprimir-qr').addEventListener('click', imprimirTodosQR);
            $('#mesas-zonas').addEventListener('click', e => {
                const b = e.target.closest('[data-zona]');
                if (!b) return;
                mesasUI.zona = b.dataset.zona;
                this.render();
            });
            $('#mesas-grid').addEventListener('click', e => {
                const t = e.target.closest('[data-mesa]');
                if (t) abrirDetalleMesa(t.dataset.mesa);
            });
            this.render(null, true);
        },
        render(evt, animar) {
            const s = S();
            const zonas = Array.from(new Set(s.mesas.map(m => m.zona)));
            if (mesasUI.zona !== 'todas' && !zonas.includes(mesasUI.zona)) mesasUI.zona = 'todas';
            $('#mesas-zonas').innerHTML = ['todas'].concat(zonas).map(z => `<button data-zona="${esc(z)}" class="${mesasUI.zona === z ? 'is-active' : ''}">${z === 'todas' ? 'Todas' : esc(z)}</button>`).join('');

            const conteo = { libre: 0, ocupada: 0, llamando: 0, cuenta: 0 };
            s.mesas.forEach(m => { conteo[q.estadoMesa(s, m)]++; });
            $('#mesas-resumen').innerHTML = Object.keys(conteo).map(k => `<div class="mini-stat mini-stat--${k}"><span class="legend-dot legend-dot--${k}"></span><span>${QStore.ESTADOS_MESA[k].label}</span><b class="q-mono">${conteo[k]}</b></div>`).join('');

            const visibles = zonas.filter(z => mesasUI.zona === 'todas' || z === mesasUI.zona);
            $('#mesas-grid').innerHTML = s.mesas.length ? visibles.map(z => `
                <section class="zona">
                    <h3 class="zona__title">${I('map-pin')}${esc(z)} <span class="q-muted">${s.mesas.filter(m => m.zona === z).length} mesas</span></h3>
                    <div class="mesas-grid">
                        ${s.mesas.filter(m => m.zona === z).map(m => {
                            const est = q.estadoMesa(s, m);
                            const cuenta = q.cuentaMesa(s, m.id);
                            const arriba = Math.ceil(m.capacidad / 2), abajo = Math.floor(m.capacidad / 2);
                            const sillas = n => Array.from({ length: Math.min(n, 6) }, () => '<span class="seat"></span>').join('');
                            return `<button class="mesa-tile mesa-tile--${est}" data-mesa="${m.id}">
                                <div class="mesa-tile__top"><span class="mesa-tile__num q-mono">${esc(m.numero)}</span><span class="mesa-tile__state">${I(QStore.ESTADOS_MESA[est].icon)}${QStore.ESTADOS_MESA[est].label}</span></div>
                                <div class="mesa-tile__plan"><div class="seats">${sillas(arriba)}</div><div class="table-shape">${I('users')}<span class="q-mono">${m.capacidad}</span></div><div class="seats">${sillas(abajo)}</div></div>
                                <div class="mesa-tile__meta">${est === 'libre' ? '<span>Disponible</span>' : `<span>${m.abiertaEn ? QStore.minutesSince(m.abiertaEn) + ' min' : 'Abierta'}</span><b class="q-mono">${money(cuenta.subtotal)}</b>`}</div>
                            </button>`;
                        }).join('')}
                    </div>
                </section>`).join('')
                : `<div class="panel q-empty">${I('armchair')}<strong>Aún no tienes mesas</strong><span>Agrega tu primera mesa para generar su código QR.</span></div>`;
            QUI.icons($('.view-mesas'));
            if (animar) QUI.staggerIn($$('.mesa-tile'));
        }
    };

    /* ---------------- MENÚ Y STOCK ---------------- */
    const ms = { tab: 'platillos', busqueda: '', cat: 'todas', estado: 'todos' };
    const puedeEditarMenu = () => sesion().rol !== 'cocina';

    function abrirFormPlatillo(platillo) {
        const s = S();
        if (!s.categorias.length) { QUI.toast('Primero crea una categoría.', 'warning'); return; }
        let imagen = platillo ? platillo.imagen : '';
        const p = platillo || { nombre: '', descripcion: '', precio: '', categoriaId: ms.cat !== 'todas' ? ms.cat : s.categorias[0].id, tiempo: 10, disponible: true, destacado: false };
        const modal = QUI.openModal({
            title: platillo ? 'Editar platillo' : 'Nuevo platillo',
            size: 'lg',
            body: `<form class="platillo-form" id="form-platillo" novalidate>
                <div class="platillo-form__img">
                    <div class="image-picker__preview image-picker__preview--tall"><img id="pl-preview" src="${esc(QStore.resolveAsset(imagen))}" alt="Vista previa" onerror="this.onerror=null;this.src=QStore.PLACEHOLDER"></div>
                    <label class="q-btn q-btn--outline q-btn--sm q-btn--block">${I('upload')} Subir foto<input type="file" accept="image/*" id="pl-file" hidden></label>
                    <input class="q-input" id="pl-url" placeholder="o pega una URL de imagen" value="${/^https?:/.test(imagen) ? esc(imagen) : ''}">
                    <button type="button" class="q-btn q-btn--ghost q-btn--sm" id="pl-quitar-img">${I('image-off')} Quitar imagen</button>
                </div>
                <div class="q-form-grid">
                    <div class="q-field q-span-2"><label for="pl-nombre">Nombre del platillo</label><input class="q-input" id="pl-nombre" maxlength="60" required value="${esc(p.nombre)}"></div>
                    <div class="q-field q-span-2"><label for="pl-desc">Descripción</label><textarea class="q-textarea" id="pl-desc" maxlength="220" placeholder="Ingredientes, porción, acompañamientos…">${esc(p.descripcion)}</textarea></div>
                    <div class="q-field"><label for="pl-precio">Precio (${esc(s.negocio.moneda)})</label><input class="q-input q-mono" id="pl-precio" type="number" min="0" step="0.5" inputmode="decimal" value="${p.precio}"></div>
                    <div class="q-field"><label for="pl-anterior">Precio anterior (opcional)</label><input class="q-input q-mono" id="pl-anterior" type="number" min="0" step="0.5" inputmode="decimal" value="${p.precioAnterior || ''}" placeholder="Para mostrar descuento"></div>
                    <div class="q-field"><label for="pl-tiempo">Tiempo de preparación (min)</label><input class="q-input q-mono" id="pl-tiempo" type="number" min="1" max="120" value="${p.tiempo}"></div>
                    <div class="q-field"><label for="pl-cat">Categoría</label><select class="q-select" id="pl-cat">${q.categoriasOrdenadas(s).map(c => `<option value="${c.id}" ${c.id === p.categoriaId ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>
                    <label class="q-switch"><input type="checkbox" id="pl-disponible" ${p.disponible ? 'checked' : ''}><span class="q-switch__track"></span><span class="q-switch__label">Disponible (en stock)</span></label>
                    <label class="q-switch"><input type="checkbox" id="pl-destacado" ${p.destacado ? 'checked' : ''}><span class="q-switch__track"></span><span class="q-switch__label">Favorito de la casa</span></label>
                </div>
            </form>`,
            footer: `<button class="q-btn q-btn--ghost" data-close>Cancelar</button><button class="q-btn q-btn--primary" id="pl-guardar">${I('check')} ${platillo ? 'Guardar cambios' : 'Agregar al menú'}</button>`
        });
        const preview = $('#pl-preview', modal.el);
        $('#pl-file', modal.el).addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                imagen = await QStore.compressImage(file, 720, 0.78);
                preview.src = imagen;
                $('#pl-url', modal.el).value = '';
            } catch (err) { QUI.toast(err.message, 'error'); }
        });
        $('#pl-url', modal.el).addEventListener('input', e => {
            const v = e.target.value.trim();
            if (/^https?:\/\/.+/.test(v)) { imagen = v; preview.src = v; }
        });
        $('#pl-quitar-img', modal.el).addEventListener('click', () => { imagen = ''; preview.src = QStore.PLACEHOLDER; $('#pl-url', modal.el).value = ''; });

        $('#pl-guardar', modal.el).addEventListener('click', () => {
            const nombre = $('#pl-nombre', modal.el).value.trim();
            const precio = QStore.round2(parseFloat($('#pl-precio', modal.el).value));
            const tiempo = Math.max(1, Math.min(120, parseInt($('#pl-tiempo', modal.el).value, 10) || 10));
            if (!nombre) { QUI.toast('El nombre es obligatorio.', 'error'); QUI.shake($('#pl-nombre', modal.el)); return; }
            if (!(precio > 0)) { QUI.toast('Escribe un precio válido.', 'error'); QUI.shake($('#pl-precio', modal.el)); return; }
            const anterior = QStore.round2(parseFloat($('#pl-anterior', modal.el).value));
            if (anterior && anterior <= precio) { QUI.toast('El precio anterior debe ser mayor al actual para mostrar el descuento.', 'error'); QUI.shake($('#pl-anterior', modal.el)); return; }
            const datos = {
                nombre, precio, tiempo,
                precioAnterior: anterior > precio ? anterior : null,
                descripcion: $('#pl-desc', modal.el).value.trim(),
                categoriaId: $('#pl-cat', modal.el).value,
                disponible: $('#pl-disponible', modal.el).checked,
                destacado: $('#pl-destacado', modal.el).checked,
                imagen
            };
            const ok = guardar(st => {
                if (platillo) Object.assign(st.platillos.find(x => x.id === platillo.id), datos);
                else st.platillos.push(Object.assign({ id: QStore.uid('pl') }, datos));
                return true;
            }, { type: 'menu:actualizado' }, platillo ? 'Platillo actualizado en el menú.' : nombre + ' ya aparece en el menú QR.');
            if (ok) modal.close();
        });
    }

    function abrirFormCategoria(cat) {
        let icono = cat ? cat.icono : 'utensils';
        const modal = QUI.openModal({
            title: cat ? 'Editar categoría' : 'Nueva categoría',
            size: 'sm',
            body: `<div class="q-field"><label for="cat-nombre">Nombre</label><input class="q-input" id="cat-nombre" maxlength="30" value="${cat ? esc(cat.nombre) : ''}" placeholder="Ej. Desayunos"></div>
                <div class="q-field" style="margin-top:16px"><label>Ícono</label><div class="icon-picker" id="icon-picker">${ICONOS_CATEGORIA.map(ic => `<button type="button" data-icono="${ic}" class="${ic === icono ? 'is-active' : ''}" aria-label="${ic}">${I(ic)}</button>`).join('')}</div></div>`,
            footer: `<button class="q-btn q-btn--ghost" data-close>Cancelar</button><button class="q-btn q-btn--primary" id="cat-guardar">${I('check')} Guardar</button>`
        });
        $('#icon-picker', modal.el).addEventListener('click', e => {
            const b = e.target.closest('[data-icono]');
            if (!b) return;
            icono = b.dataset.icono;
            $$('#icon-picker button', modal.el).forEach(x => x.classList.toggle('is-active', x === b));
        });
        $('#cat-nombre', modal.el).focus();
        $('#cat-guardar', modal.el).addEventListener('click', () => {
            const nombre = $('#cat-nombre', modal.el).value.trim();
            if (!nombre) { QUI.toast('Escribe el nombre de la categoría.', 'error'); return; }
            const dup = S().categorias.find(c => c.nombre.toLowerCase() === nombre.toLowerCase() && (!cat || c.id !== cat.id));
            if (dup) { QUI.toast('Ya existe esa categoría.', 'error'); return; }
            guardar(st => {
                if (cat) Object.assign(st.categorias.find(c => c.id === cat.id), { nombre, icono });
                else st.categorias.push({ id: QStore.uid('cat'), nombre, icono, orden: st.categorias.reduce((a, c) => Math.max(a, c.orden), 0) + 1 });
            }, { type: 'menu:actualizado' }, cat ? 'Categoría actualizada.' : 'Categoría creada.');
            modal.close();
        });
    }

    Views.menu_stock = {
        init() {
            $('#ms-tabs').addEventListener('click', e => {
                const b = e.target.closest('[data-tab]');
                if (!b) return;
                ms.tab = b.dataset.tab;
                this.renderToolbar();
                this.render();
            });
            $('#ms-toolbar').addEventListener('input', e => {
                if (e.target.id === 'ms-buscar') { ms.busqueda = e.target.value.trim().toLowerCase(); this.render(); }
            });
            $('#ms-toolbar').addEventListener('change', e => {
                if (e.target.id === 'ms-cat') { ms.cat = e.target.value; this.render(); }
                if (e.target.id === 'ms-estado') { ms.estado = e.target.value; this.render(); }
            });
            $('#ms-toolbar').addEventListener('click', e => {
                if (e.target.closest('#ms-nuevo-platillo')) abrirFormPlatillo(null);
                if (e.target.closest('#ms-nueva-cat')) abrirFormCategoria(null);
            });
            $('#ms-content').addEventListener('change', e => {
                const sw = e.target.closest('[data-stock]');
                if (!sw) return;
                const id = sw.dataset.stock;
                const disponible = sw.checked;
                guardar(st => { st.platillos.find(p => p.id === id).disponible = disponible; }, { type: 'stock:actualizado' });
                const p = q.platillo(S(), id);
                QUI.toast(p.nombre + (disponible ? ' vuelve a estar disponible.' : ' marcado como agotado en el menú QR.'), disponible ? 'success' : 'warning', { icon: disponible ? 'package-check' : 'package-x', duration: 2400 });
            });
            $('#ms-content').addEventListener('click', async e => {
                const b = e.target.closest('button');
                if (!b) return;
                const s = S();
                if (b.dataset.destacar) {
                    guardar(st => { const p = st.platillos.find(x => x.id === b.dataset.destacar); p.destacado = !p.destacado; }, { type: 'menu:actualizado' });
                }
                if (b.dataset.editar) abrirFormPlatillo(q.platillo(s, b.dataset.editar));
                if (b.dataset.eliminar) {
                    const p = q.platillo(s, b.dataset.eliminar);
                    const ok = await QUI.confirmDialog({ title: 'Eliminar platillo', message: '¿Eliminar <b>' + esc(p.nombre) + '</b> del menú? Dejará de mostrarse a los comensales.', confirmText: 'Eliminar', danger: true });
                    if (ok) guardar(st => { st.platillos = st.platillos.filter(x => x.id !== p.id); }, { type: 'menu:actualizado' }, 'Platillo eliminado.');
                }
                if (b.dataset.editarCat) abrirFormCategoria(q.categoria(s, b.dataset.editarCat));
                if (b.dataset.moverCat) {
                    const [id, dir] = b.dataset.moverCat.split(':');
                    guardar(st => {
                        const lista = q.categoriasOrdenadas(st);
                        const i = lista.findIndex(c => c.id === id);
                        const j = i + Number(dir);
                        if (j < 0 || j >= lista.length) return;
                        const tmp = lista[i].orden; lista[i].orden = lista[j].orden; lista[j].orden = tmp;
                        if (lista[i].orden === lista[j].orden) { lista.forEach((c, k) => { c.orden = k + 1; }); [lista[i].orden, lista[j].orden] = [j + 1, i + 1]; }
                    }, { type: 'menu:actualizado' });
                }
                if (b.dataset.eliminarCat) {
                    const c = q.categoria(s, b.dataset.eliminarCat);
                    const n = s.platillos.filter(p => p.categoriaId === c.id).length;
                    if (n) { QUI.toast('Mueve o elimina sus ' + n + ' platillos antes de borrar la categoría.', 'warning'); return; }
                    const ok = await QUI.confirmDialog({ title: 'Eliminar categoría', message: '¿Eliminar la categoría <b>' + esc(c.nombre) + '</b>?', confirmText: 'Eliminar', danger: true });
                    if (ok) guardar(st => { st.categorias = st.categorias.filter(x => x.id !== c.id); }, { type: 'menu:actualizado' }, 'Categoría eliminada.');
                }
            });
            this.renderToolbar();
            this.render();
        },
        renderToolbar() {
            $$('#ms-tabs button').forEach(b => b.classList.toggle('is-active', b.dataset.tab === ms.tab));
            const editar = puedeEditarMenu();
            if (ms.tab === 'platillos') {
                $('#ms-toolbar').innerHTML = `
                    <label class="search-inline">${I('search')}<input type="search" id="ms-buscar" placeholder="Buscar platillo…" value="${esc(ms.busqueda)}"></label>
                    <select class="q-select q-select--auto" id="ms-cat"></select>
                    <select class="q-select q-select--auto" id="ms-estado">
                        <option value="todos">Todos</option><option value="disponibles">En stock</option><option value="agotados">Agotados</option>
                    </select>
                    <span class="toolbar-spacer"></span>
                    ${editar ? `<button class="q-btn q-btn--primary" id="ms-nuevo-platillo">${I('plus')} Nuevo platillo</button>` : '<span class="q-badge q-badge--neutral">Tu rol solo puede cambiar disponibilidad</span>'}`;
                $('#ms-estado').value = ms.estado;
            } else {
                $('#ms-toolbar').innerHTML = `<p class="q-muted">Ordena las categorías como quieres que aparezcan en el menú del comensal.</p><span class="toolbar-spacer"></span>
                    ${editar ? `<button class="q-btn q-btn--primary" id="ms-nueva-cat">${I('plus')} Nueva categoría</button>` : ''}`;
            }
            QUI.icons($('#ms-toolbar'));
        },
        render() {
            const s = S();
            const editar = puedeEditarMenu();
            const cont = $('#ms-content');
            if (ms.tab === 'platillos') {
                const sel = $('#ms-cat');
                if (sel) {
                    if (ms.cat !== 'todas' && !q.categoria(s, ms.cat)) ms.cat = 'todas';
                    sel.innerHTML = '<option value="todas">Todas las categorías</option>' + q.categoriasOrdenadas(s).map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
                    sel.value = ms.cat;
                }
                const lista = s.platillos.filter(p =>
                    (ms.cat === 'todas' || p.categoriaId === ms.cat) &&
                    (ms.estado === 'todos' || (ms.estado === 'disponibles' ? p.disponible : !p.disponible)) &&
                    (!ms.busqueda || (p.nombre + ' ' + p.descripcion).toLowerCase().includes(ms.busqueda)));
                const agotados = s.platillos.filter(p => !p.disponible).length;
                cont.innerHTML = `<div class="ms-summary"><span><b class="q-mono">${s.platillos.length}</b> platillos</span><span><b class="q-mono">${agotados}</b> agotados</span><span><b class="q-mono">${s.platillos.filter(p => p.destacado).length}</b> favoritos</span></div>` +
                    (lista.length ? '<div class="ms-list">' + lista.map(p => {
                        const c = q.categoria(s, p.categoriaId);
                        return `<article class="ms-row ${p.disponible ? '' : 'is-soldout'}">
                            <div class="ms-row__img">${QUI.imgTag(p.imagen, p.nombre)}</div>
                            <div class="ms-row__info">
                                <strong>${esc(p.nombre)}</strong>
                                <p>${esc(p.descripcion || 'Sin descripción')}</p>
                                <div class="ms-row__tags"><span class="q-badge q-badge--neutral">${I(c ? c.icono : 'utensils')}${esc(c ? c.nombre : 'Sin categoría')}</span><span class="q-badge q-badge--neutral">${I('timer')}${p.tiempo} min</span></div>
                            </div>
                            <span class="ms-row__price q-mono">${money(p.precio)}${p.precioAnterior > p.precio ? `<s>${money(p.precioAnterior)}</s>` : ''}</span>
                            <button class="star-btn ${p.destacado ? 'is-on' : ''}" data-destacar="${p.id}" title="${p.destacado ? 'Quitar de favoritos' : 'Marcar como favorito'}" ${editar ? '' : 'disabled'}>${I('star')}</button>
                            <label class="q-switch ms-row__stock"><input type="checkbox" data-stock="${p.id}" ${p.disponible ? 'checked' : ''}><span class="q-switch__track"></span><span class="q-switch__label">${p.disponible ? 'En stock' : 'Agotado'}</span></label>
                            ${editar ? `<div class="ms-row__actions"><button class="q-icon-btn q-icon-btn--sm" data-editar="${p.id}" aria-label="Editar">${I('pencil')}</button><button class="q-icon-btn q-icon-btn--sm q-icon-btn--danger" data-eliminar="${p.id}" aria-label="Eliminar">${I('trash-2')}</button></div>` : ''}
                        </article>`;
                    }).join('') + '</div>'
                    : `<div class="q-empty">${I('search-x')}<strong>Sin platillos con esos filtros</strong>${editar ? '<span>Crea uno nuevo con el botón “Nuevo platillo”.</span>' : ''}</div>`);
            } else {
                const cats = q.categoriasOrdenadas(s);
                cont.innerHTML = cats.length ? '<ul class="cat-list">' + cats.map((c, i) => {
                    const n = s.platillos.filter(p => p.categoriaId === c.id).length;
                    return `<li class="cat-row">
                        <span class="cat-row__icon">${I(c.icono || 'utensils')}</span>
                        <div class="cat-row__info"><strong>${esc(c.nombre)}</strong><span class="q-muted">${n} ${n === 1 ? 'platillo' : 'platillos'}</span></div>
                        ${editar ? `<div class="cat-row__actions">
                            <button class="q-icon-btn q-icon-btn--sm" data-mover-cat="${c.id}:-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${I('arrow-up')}</button>
                            <button class="q-icon-btn q-icon-btn--sm" data-mover-cat="${c.id}:1" ${i === cats.length - 1 ? 'disabled' : ''} aria-label="Bajar">${I('arrow-down')}</button>
                            <button class="q-icon-btn q-icon-btn--sm" data-editar-cat="${c.id}" aria-label="Editar">${I('pencil')}</button>
                            <button class="q-icon-btn q-icon-btn--sm q-icon-btn--danger" data-eliminar-cat="${c.id}" aria-label="Eliminar">${I('trash-2')}</button>
                        </div>` : ''}
                    </li>`;
                }).join('') + '</ul>'
                    : `<div class="q-empty">${I('layers')}<strong>Sin categorías</strong><span>Crea la primera para empezar a armar tu menú.</span></div>`;
            }
            QUI.icons(cont);
        }
    };

    /* ---------------- PERSONAL ---------------- */
    const personalUI = { visibles: new Set() };

    function abrirFormPersonal(persona) {
        const p = persona || { nombre: '', rol: 'mesero', pin: '', activo: true };
        const modal = QUI.openModal({
            title: persona ? 'Editar persona' : 'Agregar persona',
            size: 'sm',
            body: `<form class="q-form-grid" id="form-personal" novalidate>
                <div class="q-field q-span-2"><label for="st-nombre">Nombre completo</label><input class="q-input" id="st-nombre" maxlength="40" value="${esc(p.nombre)}"></div>
                <div class="q-field"><label for="st-rol">Rol</label><select class="q-select" id="st-rol">${Object.keys(QStore.ROLES).map(r => `<option value="${r}" ${p.rol === r ? 'selected' : ''}>${QStore.ROLES[r].label}</option>`).join('')}</select></div>
                <div class="q-field"><label for="st-pin">PIN de 4 dígitos</label><input class="q-input q-mono pin-input" id="st-pin" maxlength="4" inputmode="numeric" autocomplete="off" value="${esc(p.pin)}"></div>
                <div class="q-span-2"><button type="button" class="q-btn q-btn--ghost q-btn--sm" id="st-generar">${I('dices')} Generar PIN aleatorio</button></div>
                <label class="q-switch q-span-2"><input type="checkbox" id="st-activo" ${p.activo ? 'checked' : ''}><span class="q-switch__track"></span><span class="q-switch__label">Acceso activo</span></label>
            </form>`,
            footer: `<button class="q-btn q-btn--ghost" data-close>Cancelar</button><button class="q-btn q-btn--primary" id="st-guardar">${I('check')} Guardar</button>`
        });
        const pinInput = $('#st-pin', modal.el);
        pinInput.addEventListener('input', () => { pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4); });
        $('#st-generar', modal.el).addEventListener('click', () => {
            const usados = new Set(S().personal.map(x => x.pin));
            let nuevo;
            do { nuevo = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); } while (usados.has(nuevo));
            pinInput.value = nuevo;
            QUI.pulse(pinInput);
        });
        $('#st-guardar', modal.el).addEventListener('click', () => {
            const s = S();
            const se = sesion();
            const nombre = $('#st-nombre', modal.el).value.trim();
            const rol = $('#st-rol', modal.el).value;
            const pin = pinInput.value;
            const activo = $('#st-activo', modal.el).checked;
            if (!nombre) { QUI.toast('Escribe el nombre.', 'error'); return; }
            if (!/^\d{4}$/.test(pin)) { QUI.toast('El PIN debe tener exactamente 4 dígitos.', 'error'); QUI.shake(pinInput); return; }
            if (s.personal.some(x => x.pin === pin && (!persona || x.id !== persona.id))) { QUI.toast('Ese PIN ya está en uso por otra persona.', 'error'); QUI.shake(pinInput); return; }
            if (persona && persona.id === se.id && (!activo || rol !== 'gerente')) { QUI.toast('No puedes quitarte tu propio acceso de gerente.', 'warning'); return; }
            const gerentesActivos = s.personal.filter(x => x.rol === 'gerente' && x.activo && (!persona || x.id !== persona.id)).length + (rol === 'gerente' && activo ? 1 : 0);
            if (!gerentesActivos) { QUI.toast('Debe existir al menos un gerente activo.', 'warning'); return; }
            guardar(st => {
                if (persona) Object.assign(st.personal.find(x => x.id === persona.id), { nombre, rol, pin, activo });
                else st.personal.push({ id: QStore.uid('st'), nombre, rol, pin, activo });
            }, { type: 'personal:actualizado' }, persona ? 'Datos actualizados.' : nombre + ' ya puede entrar con su PIN.');
            modal.close();
        });
    }

    Views.personal = {
        init() {
            $('#personal-agregar').addEventListener('click', () => abrirFormPersonal(null));
            $('#personal-tabla').addEventListener('click', async e => {
                const b = e.target.closest('button');
                if (!b) return;
                const s = S();
                if (b.dataset.verPin) {
                    const id = b.dataset.verPin;
                    if (personalUI.visibles.has(id)) personalUI.visibles.delete(id); else personalUI.visibles.add(id);
                    this.render();
                }
                if (b.dataset.editar) abrirFormPersonal(s.personal.find(x => x.id === b.dataset.editar));
                if (b.dataset.eliminar) {
                    const p = s.personal.find(x => x.id === b.dataset.eliminar);
                    if (p.id === sesion().id) { QUI.toast('No puedes eliminar tu propia cuenta.', 'warning'); return; }
                    if (p.rol === 'gerente' && s.personal.filter(x => x.rol === 'gerente' && x.activo).length <= 1 && p.activo) { QUI.toast('Debe existir al menos un gerente activo.', 'warning'); return; }
                    const ok = await QUI.confirmDialog({ title: 'Eliminar acceso', message: '¿Eliminar a <b>' + esc(p.nombre) + '</b>? Su PIN dejará de funcionar.', confirmText: 'Eliminar', danger: true });
                    if (ok) guardar(st => { st.personal = st.personal.filter(x => x.id !== p.id); }, { type: 'personal:actualizado' }, 'Persona eliminada.');
                }
            });
            $('#personal-tabla').addEventListener('change', e => {
                const sw = e.target.closest('[data-activo]');
                if (!sw) return;
                const s = S();
                const p = s.personal.find(x => x.id === sw.dataset.activo);
                if (p.id === sesion().id && !sw.checked) { sw.checked = true; QUI.toast('No puedes desactivar tu propio acceso.', 'warning'); return; }
                if (p.rol === 'gerente' && !sw.checked && s.personal.filter(x => x.rol === 'gerente' && x.activo).length <= 1) { sw.checked = true; QUI.toast('Debe existir al menos un gerente activo.', 'warning'); return; }
                guardar(st => { st.personal.find(x => x.id === p.id).activo = sw.checked; }, { type: 'personal:actualizado' }, sw.checked ? 'Acceso activado.' : 'Acceso desactivado.');
            });
            this.render();
        },
        render() {
            const s = S();
            const se = sesion();
            $('#personal-roles').innerHTML = Object.keys(QStore.ROLES).map(r => {
                const n = s.personal.filter(p => p.rol === r && p.activo).length;
                return `<article class="role-card role-card--${r}"><span class="role-card__icon">${I(ROL_ICONOS[r])}</span>
                    <div><strong>${QStore.ROLES[r].label}</strong><span class="q-muted">${n} ${n === 1 ? 'persona activa' : 'personas activas'}</span>
                    <p>${QStore.ROLES[r].vistas.map(v => VISTAS[v].titulo).join(' · ')}</p></div></article>`;
            }).join('');
            $('#personal-tabla').innerHTML = `<thead><tr><th>Persona</th><th>Rol</th><th>PIN</th><th>Acceso</th><th class="t-right">Acciones</th></tr></thead><tbody>
                ${s.personal.map(p => `<tr class="${p.activo ? '' : 'is-inactive'}">
                    <td><div class="person-cell"><span class="avatar avatar--${p.rol}">${esc(QUI.initials(p.nombre))}</span><div><strong>${esc(p.nombre)}</strong>${p.id === se.id ? '<span class="q-badge q-badge--gold">Tú</span>' : ''}</div></div></td>
                    <td><span class="role-tag role-tag--${p.rol}">${I(ROL_ICONOS[p.rol])}${QStore.ROLES[p.rol].label}</span></td>
                    <td><button class="pin-reveal q-mono" data-ver-pin="${p.id}">${personalUI.visibles.has(p.id) ? esc(p.pin) : '••••'} ${I(personalUI.visibles.has(p.id) ? 'eye-off' : 'eye')}</button></td>
                    <td><label class="q-switch"><input type="checkbox" data-activo="${p.id}" ${p.activo ? 'checked' : ''}><span class="q-switch__track"></span><span class="q-switch__label">${p.activo ? 'Activo' : 'Inactivo'}</span></label></td>
                    <td class="t-right"><div class="row-actions"><button class="q-icon-btn q-icon-btn--sm" data-editar="${p.id}" aria-label="Editar">${I('pencil')}</button><button class="q-icon-btn q-icon-btn--sm q-icon-btn--danger" data-eliminar="${p.id}" aria-label="Eliminar">${I('trash-2')}</button></div></td>
                </tr>`).join('')}</tbody>`;
            QUI.icons($('.view-personal'));
        }
    };

    /* ---------------- REPORTES ---------------- */
    const rep = { rango: 'hoy', desde: '', hasta: '' };

    function inputFecha(ts) {
        const d = new Date(ts);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function parseFecha(v) {
        const [y, m, d] = v.split('-').map(Number);
        return new Date(y, m - 1, d).getTime();
    }

    function rangoReporte() {
        const hoy = QStore.startOfDay();
        if (rep.rango === 'hoy') return { desde: hoy, hasta: hoy + DAY, label: 'Hoy · ' + fecha(hoy), porHora: true };
        if (rep.rango === '7' || rep.rango === '30') {
            const n = Number(rep.rango);
            return { desde: hoy - (n - 1) * DAY, hasta: hoy + DAY, label: 'Últimos ' + n + ' días · ' + fecha(hoy - (n - 1) * DAY) + ' al ' + fecha(hoy), porHora: false };
        }
        let d = rep.desde ? parseFecha(rep.desde) : hoy;
        let h = rep.hasta ? parseFecha(rep.hasta) : hoy;
        if (h < d) { const t = d; d = h; h = t; }
        return { desde: d, hasta: h + DAY, label: d === h ? fecha(d) : fecha(d) + ' al ' + fecha(h), porHora: d === h };
    }

    function datosReporte() {
        const s = S();
        const r = rangoReporte();
        const ventas = q.ventasEntre(s, r.desde, r.hasta).sort((a, b) => b.cerradoEn - a.cerradoEn);
        const sum = (f) => QStore.round2(ventas.reduce((a, v) => a + f(v), 0));
        const metodos = {};
        ventas.forEach(v => (v.pagos || [{ metodo: v.metodo, monto: v.total }]).forEach(p => { metodos[p.metodo] = QStore.round2((metodos[p.metodo] || 0) + p.monto); }));
        const platillos = {};
        ventas.forEach(v => v.items.forEach(it => {
            const x = platillos[it.nombre] || (platillos[it.nombre] = { nombre: it.nombre, cantidad: 0, ingreso: 0 });
            x.cantidad += it.cantidad;
            x.ingreso = QStore.round2(x.ingreso + it.precio * it.cantidad);
        }));
        const top = Object.values(platillos).sort((a, b) => b.cantidad - a.cantidad);
        return {
            r, ventas, metodos, top,
            netas: sum(v => v.subtotal), propinas: sum(v => v.propina), total: sum(v => v.total),
            cuentas: ventas.length, piezas: top.reduce((a, t) => a + t.cantidad, 0),
            ticket: ventas.length ? QStore.round2(sum(v => v.total) / ventas.length) : 0
        };
    }

    function exportarCortePDF() {
        const s = S();
        const d = datosReporte();
        const n = s.negocio;
        const th = 'text-align:left;padding:6px 8px;border-bottom:2px solid #1E1B18;font-size:10px;text-transform:uppercase;letter-spacing:.08em';
        const td = 'padding:5px 8px;border-bottom:1px solid #DFD3BC;font-size:11px';
        const tdr = td + ';text-align:right;font-family:JetBrains Mono,monospace';
        const kpi = (l, v) => `<td style="padding:10px;border:1px solid #DFD3BC;border-radius:8px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#6E655F">${l}</div><div style="font-family:JetBrains Mono,monospace;font-size:15px;font-weight:700;margin-top:4px">${v}</div></td>`;
        const html = `<div style="width:720px;font-family:'Plus Jakarta Sans',sans-serif;color:#1E1B18;background:#fff">
            <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #D1312B;padding-bottom:10px">
                <div><div style="font-family:Fraunces,Georgia,serif;font-size:24px;font-weight:700">${esc(n.nombre)}</div><div style="font-size:11px;color:#6E655F">${esc(n.direccion || '')}</div></div>
                <div style="text-align:right"><div style="font-size:16px;font-weight:800;color:#D1312B">CORTE DE CAJA</div><div style="font-size:11px">${esc(d.r.label)}</div><div style="font-size:10px;color:#6E655F">Generado ${fechaHora(Date.now())} por ${esc(sesion().nombre)}</div></div>
            </div>
            <table style="width:100%;border-collapse:separate;border-spacing:6px;margin:14px -6px"><tr>
                ${kpi('Ventas netas', money(d.netas))}${kpi('Propinas', money(d.propinas))}${kpi('Total cobrado', money(d.total))}${kpi('Cuentas', d.cuentas)}${kpi('Ticket promedio', money(d.ticket))}
            </tr></table>
            <div style="display:flex;gap:16px">
                <div style="flex:1"><div style="font-weight:800;margin:6px 0">Por método de pago</div>
                    <table style="width:100%;border-collapse:collapse"><tr><th style="${th}">Método</th><th style="${th};text-align:right">Monto</th></tr>
                    ${Object.keys(d.metodos).map(m => `<tr><td style="${td}">${METODOS[m] ? METODOS[m].label : m}</td><td style="${tdr}">${money(d.metodos[m])}</td></tr>`).join('') || `<tr><td style="${td}" colspan="2">Sin movimientos</td></tr>`}
                    </table></div>
                <div style="flex:1.3"><div style="font-weight:800;margin:6px 0">Platillos más vendidos</div>
                    <table style="width:100%;border-collapse:collapse"><tr><th style="${th}">Platillo</th><th style="${th};text-align:right">Cant.</th><th style="${th};text-align:right">Ingreso</th></tr>
                    ${d.top.slice(0, 10).map(t => `<tr><td style="${td}">${esc(t.nombre)}</td><td style="${tdr}">${t.cantidad}</td><td style="${tdr}">${money(t.ingreso)}</td></tr>`).join('') || `<tr><td style="${td}" colspan="3">Sin ventas</td></tr>`}
                    </table></div>
            </div>
            <div style="font-weight:800;margin:18px 0 6px">Detalle de cuentas (${d.cuentas})</div>
            <table style="width:100%;border-collapse:collapse"><tr><th style="${th}">Folio</th><th style="${th}">Fecha</th><th style="${th}">Servicio</th><th style="${th}">Método</th><th style="${th};text-align:right">Subtotal</th><th style="${th};text-align:right">Propina</th><th style="${th};text-align:right">Total</th></tr>
            ${d.ventas.map(v => `<tr><td style="${td};font-family:JetBrains Mono,monospace">${folioVenta(v.folio)}</td><td style="${td}">${fechaHora(v.cerradoEn)}</td><td style="${td}">${esc(etiquetaVenta(s, v))}</td><td style="${td}">${METODOS[v.metodo] ? METODOS[v.metodo].label : v.metodo}</td><td style="${tdr}">${money(v.subtotal)}</td><td style="${tdr}">${money(v.propina)}</td><td style="${tdr};font-weight:700">${money(v.total)}</td></tr>`).join('')}
            </table>
            <div style="margin-top:28px;display:flex;justify-content:space-between;font-size:11px;color:#6E655F"><span>Firma de quien entrega: ____________________</span><span>Firma de quien recibe: ____________________</span></div>
            <div style="margin-top:14px;text-align:center;font-size:9px;color:#6E655F">Generado con Q-RICO · Plan ${esc(s.plan.nombre)}</div>
        </div>`;
        QUI.toast('Generando corte de caja…', 'info', { icon: 'file-down' });
        pdfDesdeHTML(html, 'corte-caja-' + inputFecha(d.r.desde) + '.pdf');
    }

    function exportarCSV() {
        const s = S();
        const d = datosReporte();
        const filas = [['Folio', 'Fecha', 'Hora', 'Servicio', 'Metodo', 'Subtotal', 'Propina', 'Total', 'Atendio']];
        d.ventas.forEach(v => filas.push([folioVenta(v.folio), inputFecha(v.cerradoEn), hora(v.cerradoEn), etiquetaVenta(s, v), METODOS[v.metodo] ? METODOS[v.metodo].label : v.metodo, v.subtotal.toFixed(2), v.propina.toFixed(2), v.total.toFixed(2), v.cajero || '']));
        const csv = '﻿' + filas.map(f => f.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
        descargarArchivo('ventas-' + inputFecha(d.r.desde) + '.csv', csv, 'text/csv;charset=utf-8');
    }

    Views.reportes = {
        init() {
            const hoy = QStore.startOfDay();
            if (!rep.desde) { rep.desde = inputFecha(hoy - 6 * DAY); rep.hasta = inputFecha(hoy); }
            $('#rep-desde').value = rep.desde;
            $('#rep-hasta').value = rep.hasta;
            $('#rep-rango').addEventListener('click', e => {
                const b = e.target.closest('[data-rango]');
                if (!b) return;
                rep.rango = b.dataset.rango;
                this.render();
            });
            ['rep-desde', 'rep-hasta'].forEach(id => $('#' + id).addEventListener('change', e => {
                rep[id === 'rep-desde' ? 'desde' : 'hasta'] = e.target.value;
                this.render();
            }));
            $('#rep-pdf').addEventListener('click', exportarCortePDF);
            $('#rep-csv').addEventListener('click', exportarCSV);
            $('#rep-ventas').addEventListener('click', e => {
                const b = e.target.closest('[data-ticket]');
                if (b) { const v = S().ventas.find(x => x.id === b.dataset.ticket); if (v) mostrarTicket(v, false); }
            });
            this.render();
        },
        render() {
            const s = S();
            const d = datosReporte();
            $$('#rep-rango button').forEach(b => b.classList.toggle('is-active', b.dataset.rango === rep.rango));
            $('#rep-custom').hidden = rep.rango !== 'custom';
            $('#rep-rango-label').textContent = d.r.label;

            $('#rep-kpis').innerHTML = [
                { l: 'Ventas netas', v: money(d.netas), i: 'wallet', t: 'coral' },
                { l: 'Propinas', v: money(d.propinas), i: 'heart-handshake', t: 'gold' },
                { l: 'Total cobrado', v: money(d.total), i: 'banknote', t: 'dark' },
                { l: 'Cuentas', v: d.cuentas, i: 'receipt-text', t: 'neutral' },
                { l: 'Ticket promedio', v: money(d.ticket), i: 'chart-pie', t: 'green' },
                { l: 'Platillos vendidos', v: d.piezas, i: 'utensils', t: 'neutral' }
            ].map(k => `<article class="kpi kpi--${k.t} kpi--compact"><span class="kpi__icon">${I(k.i)}</span><div class="kpi__body"><span class="kpi__label">${k.l}</span><strong class="kpi__value q-mono">${k.v}</strong></div></article>`).join('');

            // Serie de ventas
            let labels, valores;
            if (d.r.porHora) {
                const horas = Array.from({ length: 16 }, (_, i) => i + 8);
                labels = horas.map(h => h + ':00');
                valores = horas.map(h => QStore.round2(d.ventas.filter(v => new Date(v.cerradoEn).getHours() === h).reduce((a, v) => a + v.total, 0)));
                $('#rep-chart-sub').textContent = 'Por hora';
            } else {
                const dias = [];
                for (let t = d.r.desde; t < d.r.hasta; t += DAY) dias.push(QStore.startOfDay(t + 3600000));
                labels = dias.map(t => new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', ''));
                valores = dias.map(t => QStore.round2(d.ventas.filter(v => v.cerradoEn >= t && v.cerradoEn < t + DAY).reduce((a, v) => a + v.total, 0)));
                $('#rep-chart-sub').textContent = 'Por día';
            }
            chart('rep-chart-ventas', {
                type: 'bar',
                data: { labels, datasets: [{ label: 'Total cobrado', data: valores, backgroundColor: COLORES.coral, hoverBackgroundColor: COLORES.mostaza, borderRadius: 6, maxBarThickness: 36 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { x: ejeX, y: ejeDinero }, plugins: { legend: { display: false }, tooltip: tooltipDinero } }
            });

            const mkeys = Object.keys(d.metodos);
            const mcolor = { efectivo: COLORES.salvia, tarjeta: COLORES.coral, transferencia: COLORES.mostaza };
            chart('rep-chart-pagos', {
                type: 'doughnut',
                data: { labels: mkeys.map(k => METODOS[k] ? METODOS[k].label : k), datasets: [{ data: mkeys.map(k => d.metodos[k]), backgroundColor: mkeys.map(k => mcolor[k] || COLORES.piedra), borderColor: '#fff', borderWidth: 3 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '66%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + money(c.parsed) } } } }
            });
            $('#rep-pagos-list').innerHTML = mkeys.length ? mkeys.map(k => `<li><span class="legend-swatch" style="background:${mcolor[k] || COLORES.piedra}"></span><span>${METODOS[k] ? METODOS[k].label : k}</span><b class="q-mono">${money(d.metodos[k])}</b><span class="q-muted q-mono">${d.total ? Math.round(d.metodos[k] / d.total * 100) : 0}%</span></li>`).join('')
                : '<li class="q-muted">Sin cobros en el periodo.</li>';

            const maxCant = d.top.length ? d.top[0].cantidad : 1;
            $('#rep-top').innerHTML = d.top.length ? `<thead><tr><th>#</th><th>Platillo</th><th class="t-right">Cantidad</th><th class="t-right">Ingreso</th></tr></thead><tbody>
                ${d.top.slice(0, 10).map((t, i) => `<tr><td class="q-mono q-muted">${i + 1}</td><td><div class="bar-cell"><span>${esc(t.nombre)}</span><span class="bar-cell__bar" style="width:${Math.round(t.cantidad / maxCant * 100)}%"></span></div></td><td class="t-right q-mono">${t.cantidad}</td><td class="t-right q-mono">${money(t.ingreso)}</td></tr>`).join('')}</tbody>`
                : `<tbody><tr><td><div class="q-empty">${I('chart-pie')}<span>Sin ventas en el periodo.</span></div></td></tr></tbody>`;

            $('#rep-ventas').innerHTML = d.ventas.length ? `<thead><tr><th>Folio</th><th>Fecha</th><th>Servicio</th><th>Método</th><th class="t-right">Total</th><th></th></tr></thead><tbody>
                ${d.ventas.slice(0, 80).map(v => `<tr><td class="q-mono"><b>${folioVenta(v.folio)}</b></td><td class="q-muted">${fechaHora(v.cerradoEn)}</td><td>${esc(etiquetaVenta(s, v))}</td><td><span class="cell-icon">${I(METODOS[v.metodo] ? METODOS[v.metodo].icon : 'wallet')}${METODOS[v.metodo] ? METODOS[v.metodo].label : v.metodo}</span></td><td class="t-right q-mono">${money(v.total)}</td><td class="t-right"><button class="q-icon-btn q-icon-btn--sm" data-ticket="${v.id}" aria-label="Ver ticket">${I('receipt-text')}</button></td></tr>`).join('')}</tbody>`
                : `<tbody><tr><td><div class="q-empty">${I('receipt-text')}<span>Sin cuentas cobradas en el periodo.</span></div></td></tr></tbody>`;
            QUI.icons($('.view-reportes'));
        }
    };

    /* ---------------- CONFIGURACIÓN ---------------- */
    const cfg = { logo: '', portada: '' };

    function urlRed(valor) {
        const v = String(valor || '').trim();
        if (!v) return '';
        return /^https?:\/\//i.test(v) ? v : 'https://' + v;
    }

    function parsePropinas(txt) {
        const arr = String(txt).split(/[,\s]+/).map(x => parseInt(x, 10)).filter(x => !isNaN(x) && x >= 0 && x <= 100);
        return Array.from(new Set(arr)).sort((a, b) => a - b).slice(0, 5);
    }

    Views.configuracion = {
        init() {
            this.llenar();
            const form = $('#cfg-form');
            const actualizarDefault = () => {
                const ops = parsePropinas($('#cfg-propinas').value);
                const sel = $('#cfg-propina-default');
                const actual = Number(sel.value || S().negocio.propinaDefault);
                sel.innerHTML = (ops.length ? ops : [0]).map(o => `<option value="${o}" ${o === actual ? 'selected' : ''}>${o === 0 ? 'Sin propina' : o + '%'}</option>`).join('');
            };
            $('#cfg-propinas').addEventListener('input', actualizarDefault);

            const picker = (tipo, max) => {
                $('#cfg-' + tipo + '-file').addEventListener('change', async e => {
                    const f = e.target.files[0];
                    if (!f) return;
                    try {
                        cfg[tipo] = await QStore.compressImage(f, max, 0.82);
                        $('#cfg-' + tipo + '-preview').src = cfg[tipo];
                        $('#cfg-' + tipo + '-url').value = '';
                    } catch (err) { QUI.toast(err.message, 'error'); }
                });
                $('#cfg-' + tipo + '-url').addEventListener('input', e => {
                    const v = e.target.value.trim();
                    if (/^https?:\/\/.+/.test(v)) { cfg[tipo] = v; $('#cfg-' + tipo + '-preview').src = v; }
                });
            };
            picker('logo', 400);
            picker('portada', 1400);

            form.addEventListener('submit', e => {
                e.preventDefault();
                const nombre = $('#cfg-nombre').value.trim();
                if (!nombre) { QUI.toast('El nombre comercial es obligatorio.', 'error'); QUI.shake($('#cfg-nombre')); return; }
                const propinas = parsePropinas($('#cfg-propinas').value);
                const propinaDefault = Number($('#cfg-propina-default').value) || 0;
                guardar(st => {
                    Object.assign(st.negocio, {
                        nombre,
                        eslogan: $('#cfg-eslogan').value.trim(),
                        logo: cfg.logo,
                        portada: cfg.portada,
                        direccion: $('#cfg-direccion').value.trim(),
                        telefono: $('#cfg-telefono').value.trim(),
                        horario: $('#cfg-horario').value.trim(),
                        wifi: { red: $('#cfg-wifi-red').value.trim(), clave: $('#cfg-wifi-clave').value.trim() },
                        abierto: $('#cfg-abierto').checked,
                        moneda: $('#cfg-moneda').value,
                        propinas: propinas.length ? propinas : [0],
                        propinaDefault: propinas.includes(propinaDefault) ? propinaDefault : (propinas[0] || 0),
                        mensajeTicket: $('#cfg-mensaje').value.trim(),
                        frasePie: $('#cfg-frase').value.trim(),
                        razonSocial: $('#cfg-razon').value.trim(),
                        redes: {
                            facebook: urlRed($('#cfg-facebook').value),
                            instagram: urlRed($('#cfg-instagram').value),
                            tiktok: urlRed($('#cfg-tiktok').value)
                        }
                    });
                }, { type: 'negocio:actualizado' }, 'Configuración guardada. El menú QR ya muestra los cambios.');
            });

            $('#cfg-exportar').addEventListener('click', () => {
                descargarArchivo('qrico-respaldo-' + inputFecha(Date.now()) + '.json', JSON.stringify(S(), null, 2), 'application/json');
            });
            $('#cfg-importar').addEventListener('change', e => {
                const f = e.target.files[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = async () => {
                    let data;
                    try { data = JSON.parse(reader.result); } catch (err) { QUI.toast('El archivo no es un respaldo válido.', 'error'); return; }
                    // Los respaldos de versiones anteriores se llevan al esquema actual antes de validarlos
                    data = QStore.actualizarEsquema(data);
                    const valido = data && data.version === S().version && ['negocio', 'categorias', 'platillos', 'mesas', 'pedidos', 'ventas', 'alertas', 'personal', 'contadores'].every(k => k in data);
                    if (!valido) { QUI.toast('El respaldo no es compatible con esta versión de Q-RICO.', 'error'); return; }
                    const ok = await QUI.confirmDialog({ title: 'Restaurar respaldo', message: 'Se reemplazará toda la información actual por la del respaldo. ¿Continuar?', confirmText: 'Restaurar', danger: true });
                    if (!ok) return;
                    guardar(st => {
                        Object.keys(st).forEach(k => { delete st[k]; });
                        Object.assign(st, data);
                    }, { type: 'reset' }, 'Respaldo restaurado.');
                };
                reader.readAsText(f);
                e.target.value = '';
            });
            $('#cfg-reset').addEventListener('click', async () => {
                const ok = await QUI.confirmDialog({ title: 'Restaurar datos de demostración', message: 'Se borrarán tu menú, mesas, personal, pedidos y ventas, y se cargará el restaurante de ejemplo. Te recomendamos descargar un respaldo antes.', confirmText: 'Restaurar demo', danger: true });
                if (!ok) return;
                QStore.reset();
                QUI.toast('Datos de demostración restaurados.', 'success', { icon: 'rotate-ccw' });
            });
        },
        llenar() {
            const s = S();
            const n = s.negocio;
            cfg.logo = n.logo;
            cfg.portada = n.portada;
            $('#cfg-nombre').value = n.nombre;
            $('#cfg-eslogan').value = n.eslogan || '';
            $('#cfg-direccion').value = n.direccion || '';
            $('#cfg-telefono').value = n.telefono || '';
            $('#cfg-horario').value = n.horario || '';
            $('#cfg-wifi-red').value = (n.wifi && n.wifi.red) || '';
            $('#cfg-wifi-clave').value = (n.wifi && n.wifi.clave) || '';
            $('#cfg-abierto').checked = !!n.abierto;
            $('#cfg-moneda').value = n.moneda || 'MXN';
            $('#cfg-propinas').value = (n.propinas || []).join(', ');
            $('#cfg-propina-default').innerHTML = (n.propinas || [0]).map(o => `<option value="${o}" ${o === n.propinaDefault ? 'selected' : ''}>${o === 0 ? 'Sin propina' : o + '%'}</option>`).join('');
            $('#cfg-mensaje').value = n.mensajeTicket || '';
            $('#cfg-frase').value = n.frasePie || '';
            $('#cfg-razon').value = n.razonSocial || '';
            const redes = n.redes || {};
            $('#cfg-facebook').value = redes.facebook || '';
            $('#cfg-instagram').value = redes.instagram || '';
            $('#cfg-tiktok').value = redes.tiktok || '';
            $('#cfg-logo-url').value = /^https?:/.test(n.logo || '') ? n.logo : '';
            $('#cfg-portada-url').value = /^https?:/.test(n.portada || '') ? n.portada : '';
            ['logo', 'portada'].forEach(t => {
                const img = $('#cfg-' + t + '-preview');
                img.onerror = () => { img.onerror = null; img.src = QStore.PLACEHOLDER; };
                img.src = QStore.resolveAsset(n[t]);
            });
            $('#cfg-plan-nombre').textContent = s.plan.nombre;
            $('#cfg-plan-precio').textContent = '$' + s.plan.precio;
            $('#cfg-plan-periodo').textContent = s.plan.moneda + ' / ' + s.plan.periodo;
            $('#cfg-plan-desde').textContent = 'Cliente desde el ' + fecha(s.plan.desde) + '. Precio fijo, sin comisiones por pedido.';
        },
        render(evt) {
            if (evt && evt.type === 'reset') this.llenar();
        }
    };

    /* ---------------- Arranque ---------------- */
    document.addEventListener('DOMContentLoaded', () => {
        QStore.get();
        if (document.body.dataset.page === 'login') initLogin();
        else initAdmin();
    });
})();

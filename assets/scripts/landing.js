/* =====================================================================
   Q-RICO · Landing page corporativa
   Menú móvil, sombra de la barra al desplazarse y aparición de
   secciones. No depende del núcleo compartido (store.js).
   ===================================================================== */
(function () {
    'use strict';

    if (window.lucide) lucide.createIcons();

    // Año vigente en el pie de página
    document.getElementById('anio').textContent = new Date().getFullYear();

    // Barra de navegación con sombra al bajar
    const nav = document.getElementById('nav');
    const marcarNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
    marcarNav();
    window.addEventListener('scroll', marcarNav, { passive: true });

    // Menú desplegable en móvil
    const burger = document.getElementById('nav-burger');
    const enlaces = document.getElementById('nav-enlaces');

    function alternarMenu(abrir) {
        enlaces.classList.toggle('is-open', abrir);
        burger.setAttribute('aria-expanded', String(abrir));
        burger.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
        burger.innerHTML = '<i data-lucide="' + (abrir ? 'x' : 'menu') + '"></i>';
        if (window.lucide) lucide.createIcons();
    }

    burger.addEventListener('click', () => alternarMenu(!enlaces.classList.contains('is-open')));
    enlaces.addEventListener('click', e => { if (e.target.closest('a')) alternarMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && enlaces.classList.contains('is-open')) alternarMenu(false); });

    /* ---------------- Demo interactiva y acceso por rol ----------------
       La landing comparte origen con el menú y el panel, así que puede preparar la sesión
       de demostración en sessionStorage (qrico_sesion) y los iframes la heredan. */
    const SESSION_KEY = 'qrico_sesion';
    const hayStore = typeof window.QStore !== 'undefined';

    function iniciarSesionDemo(rol) {
        if (!hayStore) return false;
        try {
            const u = QStore.get().personal.find(p => p.activo && p.rol === rol);
            if (!u || !QStore.ROLES[rol]) return false;
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, nombre: u.nombre, rol: u.rol, desde: Date.now() }));
            return true;
        } catch (e) {
            return false;
        }
    }

    // Tarjetas de rol: inician la sesión y entran directo a la vista de inicio de ese rol.
    // Sin JavaScript o sin almacenamiento, el enlace lleva al acceso por PIN de siempre.
    document.querySelectorAll('[data-rol]').forEach(card => {
        card.addEventListener('click', e => {
            const rol = card.dataset.rol;
            if (!iniciarSesionDemo(rol)) return;
            e.preventDefault();
            location.href = 'panel-administrativo/pages/admin.html#' + QStore.ROLES[rol].inicio;
        });
    });

    // Escala cada iframe (dibujado a tamaño real) para que quepa en su marco
    function ajustarEscala(caja) {
        const ancho = Number(caja.dataset.baseAncho);
        const alto = Number(caja.dataset.baseAlto);
        const iframe = caja.querySelector('iframe');
        const escala = caja.clientWidth / ancho;
        if (!escala) return;
        iframe.style.width = ancho + 'px';
        iframe.style.height = alto + 'px';
        iframe.style.transform = 'scale(' + escala + ')';
        caja.style.height = Math.round(alto * escala) + 'px';
    }
    const cajas = document.querySelectorAll('.demo-escala');
    if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(entradas => entradas.forEach(en => ajustarEscala(en.target)));
        cajas.forEach(c => ro.observe(c));
    } else {
        cajas.forEach(ajustarEscala);
        window.addEventListener('resize', () => cajas.forEach(ajustarEscala));
    }

    // Los iframes se cargan solo cuando la sección se acerca a la pantalla
    const demo = document.getElementById('demo');
    let demoCargada = false;
    function cargarDemo() {
        if (demoCargada || !demo) return;
        demoCargada = true;
        iniciarSesionDemo('gerente');
        demo.querySelectorAll('iframe[data-src]').forEach(f => { f.src = f.dataset.src; });
    }
    if (demo && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(en => {
            if (en.some(x => x.isIntersecting)) { cargarDemo(); io.disconnect(); }
        }, { rootMargin: '400px 0px' });
        io.observe(demo);
    } else {
        cargarDemo();
    }

    // Selector móvil: comensal o restaurante
    const selector = document.querySelectorAll('.demo__selector [data-pane]');
    selector.forEach(b => b.addEventListener('click', () => {
        selector.forEach(x => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-selected', String(on)); });
        document.querySelectorAll('.demo__pane').forEach(p => p.classList.toggle('is-active', p.id === 'demo-' + b.dataset.pane));
        cajas.forEach(ajustarEscala);
    }));

    // Pestañas del panel: cambian la vista del iframe por su hash (#kds, #pos, #mesas)
    const iframePanel = document.querySelector('#demo-panel iframe');
    const vistas = document.querySelectorAll('.demo__vistas [data-vista]');
    vistas.forEach(b => b.addEventListener('click', () => {
        vistas.forEach(x => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-selected', String(on)); });
        const destino = 'panel-administrativo/pages/admin.html#' + b.dataset.vista;
        iframePanel.dataset.src = destino;
        if (!demoCargada) return;
        try {
            const w = iframePanel.contentWindow;
            // Si el panel se salió al acceso por PIN, se recarga con la sesión de demostración
            if (/pages\/admin\.html$/.test(w.location.pathname)) w.location.hash = b.dataset.vista;
            else { iniciarSesionDemo('gerente'); iframePanel.src = destino; }
        } catch (e) {
            iframePanel.src = destino;
        }
    }));

    // Restaurar datos de demostración (útil antes de exponer)
    const btnReiniciar = document.getElementById('demo-reiniciar');
    if (btnReiniciar) btnReiniciar.addEventListener('click', () => {
        if (!hayStore || !confirm('Se restaurarán el menú, las mesas, los pedidos y las ventas de ejemplo. ¿Continuar?')) return;
        try { QStore.reset(); } catch (e) { /* almacenamiento bloqueado */ }
    });

    // Aparición suave de bloques al entrar en pantalla
    const bloques = document.querySelectorAll('.seccion__cabeza, .funcion, .paso, .plan, .aliados__logos');
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducir || !('IntersectionObserver' in window)) return;

    bloques.forEach(el => el.classList.add('revelar'));
    const observador = new IntersectionObserver(entradas => {
        entradas.forEach(entrada => {
            if (!entrada.isIntersecting) return;
            entrada.target.classList.add('is-visible');
            observador.unobserve(entrada.target);
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    bloques.forEach(el => observador.observe(el));
})();

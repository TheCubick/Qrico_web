/* =====================================================================
   Q-RICO · Módulo Comensal (menú QR)
   Estructura clásica (header coral, carrusel, cintilla, menú en línea,
   platillos destacados, footer) alimentada por qrico_saas_store, con
   carrito, cuenta dividida, seguimiento en vivo y alertas a la mesa.
   ===================================================================== */
(function () {
    'use strict';

    const q = QStore.q;
    const esc = QStore.escapeHtml;
    const money = (n) => QStore.money(n);
    const S = () => QStore.get();

    const CART_KEY = 'qrico_carrito';
    const MIS_PEDIDOS_KEY = 'qrico_mis_pedidos';
    const MESA_KEY = 'qrico_mesa_actual';
    const NOMBRE_KEY = 'qrico_comensal_nombre';
    const NOTAS_RAPIDAS = ['Sin cebolla', 'Sin picante', 'Picante aparte', 'Sin cilantro', 'Extra salsa', 'Para compartir'];
    const HERO_INTERVALO = 6000;

    const plantillas = { card: '', cuadro: '' };
    const ui = {
        busqueda: '',
        filtros: new Set(),
        categoria: 'todas',
        tab: 'carrito',
        drawerAbierto: false,
        propinaPct: null,
        split: { modo: 'una', personas: 2, asignacion: {} },
        estadosPrevios: {},
        alertasPrevias: {},
        anchoTracker: {},
        hero: { index: 0, firma: '', timer: null, total: 0 }
    };
    let mesaNumero = null;

    /* ---------------- Utilidades ---------------- */
    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    function plantilla(tpl, data) {
        return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] == null ? '' : data[k]));
    }

    function normalizar(txt) {
        return String(txt || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    }

    function leerJSON(key, def) {
        try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; }
    }

    function guardarJSON(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* almacenamiento lleno */ }
    }

    async function cargarParcial(archivo) {
        const res = await fetch(archivo, { cache: 'no-cache' });
        if (!res.ok) throw new Error('No se pudo cargar ' + archivo);
        return res.text();
    }

    function descuento(p) {
        return p.precioAnterior > p.precio ? Math.round((1 - p.precio / p.precioAnterior) * 100) : 0;
    }

    function precioAnteriorHTML(p) {
        return p.precioAnterior > p.precio ? '<span class="precio-original q-mono">' + money(p.precioAnterior) + '</span>' : '';
    }

    function nombreComensal() {
        try { return (localStorage.getItem(NOMBRE_KEY) || '').trim(); } catch (e) { return ''; }
    }

    function alturaHeader() {
        const h = $('#site-header');
        return h ? h.offsetHeight : 76;
    }

    function scrollSuave(el, extra) {
        if (!el) return;
        const catbar = $('#contenedor-sidebar');
        const offset = alturaHeader() + (extra ? catbar.offsetHeight : 0) + 12;
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
    }

    /* ---------------- Mesa ---------------- */
    function resolverMesaInicial() {
        const param = new URLSearchParams(location.search).get('mesa');
        const guardada = sessionStorage.getItem(MESA_KEY);
        const candidata = param || guardada;
        if (candidata && q.mesaPorNumero(S(), candidata)) {
            mesaNumero = q.mesaPorNumero(S(), candidata).numero;
            sessionStorage.setItem(MESA_KEY, mesaNumero);
        }
    }

    function mesaActual() {
        return mesaNumero ? q.mesaPorNumero(S(), mesaNumero) || null : null;
    }

    function seleccionarMesa(numero) {
        mesaNumero = numero;
        sessionStorage.setItem(MESA_KEY, numero);
        const url = new URL(location.href);
        url.searchParams.set('mesa', numero);
        history.replaceState(null, '', url);
        ui.split.asignacion = {};
        renderHeader();
        renderDock();
        if (ui.drawerAbierto) renderDrawer();
        QUI.toast('Ahora estás en la mesa ' + numero + '.', 'success', { icon: 'armchair' });
    }

    function abrirSelectorMesa(motivo) {
        const s = S();
        const zonas = {};
        s.mesas.forEach(m => { (zonas[m.zona] = zonas[m.zona] || []).push(m); });
        const body = (motivo ? '<p class="mesa-picker__hint">' + esc(motivo) + '</p>' : '') +
            Object.keys(zonas).map(z =>
                '<div class="mesa-picker__zona"><span class="eyebrow">' + esc(z) + '</span><div class="mesa-picker__grid">' +
                zonas[z].map(m =>
                    '<button class="mesa-picker__btn' + (m.numero === mesaNumero ? ' is-active' : '') + '" data-mesa="' + esc(m.numero) + '">' +
                    '<strong class="q-mono">' + esc(m.numero) + '</strong><span>' + m.capacidad + ' pers.</span></button>'
                ).join('') + '</div></div>'
            ).join('');
        const modal = QUI.openModal({ title: '¿En qué mesa estás?', body: body || '<div class="q-empty">El restaurante aún no registra mesas.</div>', size: 'sm', className: 'mesa-picker' });
        modal.$$('[data-mesa]').forEach(b => b.addEventListener('click', () => { seleccionarMesa(b.dataset.mesa); modal.close(); }));
    }

    /* ---------------- Nombre del comensal ---------------- */
    function pedirNombre() {
        const modal = QUI.openModal({
            title: '¿Cómo te llamas?',
            size: 'sm',
            body: '<p class="q-muted" style="margin-bottom:12px">Lo usamos para identificar tus pedidos en cocina. Se guarda solo en este dispositivo.</p>' +
                  '<input class="q-input" id="nombre-comensal" maxlength="24" placeholder="Tu nombre" value="' + esc(nombreComensal()) + '">',
            footer: '<button class="q-btn q-btn--ghost" data-close>Cancelar</button><button class="q-btn q-btn--primary" id="guardar-nombre">Guardar</button>'
        });
        const input = modal.$('#nombre-comensal');
        input.focus();
        const guardarNombre = () => {
            const v = input.value.trim().replace(/\s+/g, ' ');
            try { if (v) localStorage.setItem(NOMBRE_KEY, v); else localStorage.removeItem(NOMBRE_KEY); } catch (e) { /* sin almacenamiento */ }
            renderHeader();
            modal.close();
            if (v) QUI.toast('¡Hola, ' + v + '!', 'success', { icon: 'user-round', duration: 2000 });
        };
        modal.$('#guardar-nombre').addEventListener('click', guardarNombre);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') guardarNombre(); });
    }

    /* ---------------- Carrito ---------------- */
    function carrito() { return leerJSON(CART_KEY, []); }

    function setCarrito(items) {
        guardarJSON(CART_KEY, items);
        renderContadores();
        if (ui.drawerAbierto && ui.tab === 'carrito') renderDrawer();
    }

    function lineasCarrito() {
        const s = S();
        return carrito().map(it => ({ item: it, platillo: q.platillo(s, it.platilloId) }));
    }

    function totalCarrito() {
        return QStore.round2(lineasCarrito().reduce((acc, l) => acc + (l.platillo && l.platillo.disponible ? l.platillo.precio * l.item.cantidad : 0), 0));
    }

    function piezasCarrito() {
        return lineasCarrito().reduce((acc, l) => acc + (l.platillo ? l.item.cantidad : 0), 0);
    }

    function agregarAlCarrito(platilloId, cantidad, notas, origenEl) {
        const s = S();
        const p = q.platillo(s, platilloId);
        if (!p) return;
        if (!s.negocio.abierto) { QUI.toast('El restaurante está cerrado en este momento.', 'warning', { icon: 'store' }); return; }
        if (!p.disponible) { QUI.toast(p.nombre + ' está agotado por ahora.', 'warning'); return; }
        notas = (notas || '').trim();
        const key = platilloId + '|' + normalizar(notas);
        const items = carrito();
        const existente = items.find(i => i.key === key);
        if (existente) existente.cantidad = Math.min(99, existente.cantidad + cantidad);
        else items.push({ key, platilloId, cantidad, notas });
        setCarrito(items);
        animarVuelo(origenEl, p);
    }

    function cambiarCantidad(key, delta) {
        const items = carrito();
        const it = items.find(i => i.key === key);
        if (!it) return;
        it.cantidad += delta;
        setCarrito(it.cantidad <= 0 ? items.filter(i => i.key !== key) : items);
    }

    function quitarLinea(key) {
        setCarrito(carrito().filter(i => i.key !== key));
    }

    function destinoCarrito() {
        const dock = $('#btn-dock-carrito');
        if (dock && dock.getBoundingClientRect().width > 0) return dock;
        return $('#btn-carrito');
    }

    function animarVuelo(origenEl, platillo) {
        const destino = destinoCarrito();
        if (!origenEl || !destino || !QUI.hasGsap()) { QUI.pulse(destino); return; }
        const a = origenEl.getBoundingClientRect();
        const b = destino.getBoundingClientRect();
        const dot = document.createElement('div');
        dot.className = 'fly-dot';
        dot.innerHTML = QUI.imgTag(platillo.imagen, '');
        document.body.appendChild(dot);
        const x0 = a.left + a.width / 2 - 22, y0 = a.top + a.height / 2 - 22;
        const x1 = b.left + b.width / 2 - 22, y1 = b.top + b.height / 2 - 22;
        gsap.set(dot, { x: x0, y: y0, scale: 0.6, opacity: 0 });
        const tl = gsap.timeline({ onComplete: () => { dot.remove(); QUI.pulse(destino); QUI.pulse($('#cart-count')); } });
        tl.to(dot, { opacity: 1, scale: 1, duration: 0.15 })
          .to(dot, { x: x1, duration: 0.6, ease: 'power1.inOut' }, '>')
          .to(dot, { y: Math.min(y0, y1) - 80, duration: 0.28, ease: 'power2.out' }, '<')
          .to(dot, { y: y1, duration: 0.32, ease: 'power2.in' }, '>')
          .to(dot, { scale: 0.3, opacity: 0, duration: 0.18 }, '-=0.12');
    }

    /* ---------------- Filtros ---------------- */
    function coincide(p, ignorarCategoria) {
        if (!ignorarCategoria && ui.categoria !== 'todas' && p.categoriaId !== ui.categoria) return false;
        if (ui.filtros.has('destacados') && !p.destacado) return false;
        if (ui.filtros.has('rapidos') && !(p.tiempo < 15)) return false;
        if (ui.filtros.has('disponibles') && !p.disponible) return false;
        if (ui.busqueda) {
            const cat = q.categoria(S(), p.categoriaId);
            const texto = normalizar(p.nombre + ' ' + p.descripcion + ' ' + (cat ? cat.nombre : ''));
            return ui.busqueda.split(/\s+/).every(t => texto.includes(t));
        }
        return true;
    }

    function platillosOrdenados() {
        const s = S();
        const orden = {};
        q.categoriasOrdenadas(s).forEach((c, i) => { orden[c.id] = i; });
        return s.platillos.slice().sort((a, b) => (orden[a.categoriaId] ?? 99) - (orden[b.categoriaId] ?? 99));
    }

    /* ---------------- Render: header ---------------- */
    function renderHeader() {
        const s = S();
        const n = s.negocio;
        const logo = $('#header-logo');
        if (!logo) return;
        logo.src = QStore.resolveAsset(n.logo);
        logo.alt = n.nombre;
        logo.onerror = () => { logo.onerror = null; logo.src = QStore.PLACEHOLDER; };
        const mesa = mesaActual();
        $('#mesa-label').textContent = mesa ? 'Mesa ' + mesa.numero : 'Elige tu mesa';
        $('#header-estado').innerHTML = '<span class="dot ' + (n.abierto ? 'dot--open' : 'dot--closed') + '"></span>' + (n.abierto ? 'Abierto ahora' : 'Cerrado');
        $('#btn-mesa').classList.toggle('is-empty', !mesa);
        const nombre = nombreComensal();
        const saludo = '¡Hola, ' + (nombre || 'Invitado') + '!';
        $('#saludo-texto').textContent = saludo;
        $('#mobile-saludo').textContent = saludo;
        document.title = 'Menú | ' + n.nombre;
    }

    /* ---------------- Render: carrusel del hero ---------------- */
    function slidesHero() {
        const s = S();
        const n = s.negocio;
        const slides = [{
            tipo: 'marca',
            imagen: n.portada,
            eyebrow: n.nombre,
            titulo: 'COMIDA QUE SE SIENTE <em>Q-RICO</em>',
            texto: n.eslogan || ''
        }];
        s.platillos.filter(p => p.destacado && p.disponible).slice(0, 3).forEach(p => {
            const d = descuento(p);
            slides.push({
                tipo: 'platillo',
                id: p.id,
                imagen: p.imagen,
                eyebrow: d ? 'Ahorra ' + d + '% hoy' : 'Favorito de la casa',
                titulo: esc(p.nombre.toUpperCase()),
                texto: p.descripcion,
                precio: money(p.precio),
                precioAnterior: d ? money(p.precioAnterior) : ''
            });
        });
        return slides;
    }

    function renderHero() {
        const slides = slidesHero();
        const firma = JSON.stringify(slides) + S().negocio.abierto;
        if (firma === ui.hero.firma) return;
        ui.hero.firma = firma;
        ui.hero.total = slides.length;
        if (ui.hero.index >= slides.length) ui.hero.index = 0;
        const abierto = S().negocio.abierto;

        $('#hero-slides').innerHTML = slides.map((sl, i) =>
            '<div class="slide' + (i === ui.hero.index ? ' activa' : '') + '" data-slide="' + i + '" aria-hidden="' + (i !== ui.hero.index) + '">' +
                QUI.imgTag(sl.imagen, '') +
                '<div class="slide__texto">' +
                    '<span class="slide__eyebrow">' + (sl.tipo === 'marca' ? QUI.icon(abierto ? 'circle-check' : 'circle-x') : QUI.icon('star')) + esc(sl.eyebrow) + (sl.tipo === 'marca' && !abierto ? ' · Cerrado por ahora' : '') + '</span>' +
                    '<h1 class="slide__titulo">' + sl.titulo + '</h1>' +
                    (sl.texto ? '<p class="slide__desc">' + esc(sl.texto) + '</p>' : '') +
                    (sl.tipo === 'platillo'
                        ? '<div class="slide__precio"><span class="q-mono">' + sl.precio + '</span>' + (sl.precioAnterior ? '<s class="q-mono">' + sl.precioAnterior + '</s>' : '') + '</div>' +
                          '<div class="slide__cta"><button class="btn-ordena btn-ordena--hero" data-add="' + sl.id + '">' + QUI.icon('plus') + ' AGREGAR</button>' +
                          '<button class="btn-ghost-light" data-open="' + sl.id + '">VER MÁS</button></div>'
                        : '<div class="slide__cta"><button class="btn-ordena btn-ordena--hero" data-ordenar>ORDENA AQUÍ</button></div>') +
                '</div>' +
            '</div>'
        ).join('');
        $('#hero-puntos').innerHTML = slides.map((_, i) =>
            '<button class="punto' + (i === ui.hero.index ? ' activo' : '') + '" data-punto="' + i + '" aria-label="Ir a la promoción ' + (i + 1) + '"></button>'
        ).join('');
        const multiples = slides.length > 1;
        $('#hero-prev').hidden = !multiples;
        $('#hero-next').hidden = !multiples;
        $('#hero-puntos').hidden = !multiples;
        QUI.icons($('#hero'));
        reiniciarHero();
    }

    function irASlide(i) {
        const total = ui.hero.total;
        if (!total) return;
        ui.hero.index = (i + total) % total;
        $$('#hero-slides .slide').forEach((sl, k) => {
            const activa = k === ui.hero.index;
            sl.classList.toggle('activa', activa);
            sl.setAttribute('aria-hidden', String(!activa));
        });
        $$('#hero-puntos .punto').forEach((p, k) => p.classList.toggle('activo', k === ui.hero.index));
        const texto = $('#hero-slides .slide.activa .slide__texto');
        if (texto && QUI.hasGsap()) gsap.fromTo(texto.children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.06, ease: 'power3.out', delay: 0.15 });
    }

    function reiniciarHero() {
        clearInterval(ui.hero.timer);
        if (ui.hero.total > 1) ui.hero.timer = setInterval(() => irASlide(ui.hero.index + 1), HERO_INTERVALO);
    }

    /* ---------------- Render: cintilla informativa ---------------- */
    function renderCintilla() {
        const n = S().negocio;
        const redes = n.redes || {};
        const items = [];
        if (n.direccion) items.push('<a class="cintilla__item" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(n.direccion) + '" target="_blank" rel="noopener">' + QUI.icon('map-pin') + '<span><small>Dirección</small>' + esc(n.direccion) + '</span></a>');
        if (n.telefono) items.push('<a class="cintilla__item" href="tel:' + esc(n.telefono.replace(/[^\d+]/g, '')) + '">' + QUI.icon('phone') + '<span><small>Teléfono</small>' + esc(n.telefono) + '</span></a>');
        if (n.horario) items.push('<div class="cintilla__item">' + QUI.icon('clock') + '<span><small>Horario</small>' + esc(n.horario) + '</span></div>');
        if (n.wifi && n.wifi.red) items.push('<button class="cintilla__item" id="cintilla-wifi" title="Copiar contraseña">' + QUI.icon('wifi') + '<span><small>WiFi · toca para copiar</small>' + esc(n.wifi.red) + '</span></button>');
        const enlacesRedes = ['facebook', 'instagram'].filter(r => redes[r]).map(r =>
            '<a href="' + esc(redes[r]) + '" target="_blank" rel="noopener" aria-label="' + r + '">' + QUI.icon(r) + '</a>').join('') +
            (redes.tiktok ? '<a href="' + esc(redes.tiktok) + '" target="_blank" rel="noopener" aria-label="TikTok">' + tiktokSVG() + '</a>' : '');
        if (enlacesRedes) items.push('<div class="cintilla__item cintilla__redes"><span><small>Síguenos</small></span><div class="cintilla__redes-iconos">' + enlacesRedes + '</div></div>');
        const cont = $('#cintilla-info');
        cont.hidden = !items.length;
        cont.innerHTML = '<div class="cintilla__inner">' + items.join('') + '</div>';
        QUI.icons(cont);
        const wifi = $('#cintilla-wifi');
        if (wifi) wifi.addEventListener('click', () => {
            const clave = (n.wifi && n.wifi.clave) || '';
            if (navigator.clipboard && clave) navigator.clipboard.writeText(clave).then(() => QUI.toast('Clave copiada: ' + clave, 'success', { icon: 'wifi' }), () => QUI.toast('Clave del WiFi: ' + clave, 'info', { icon: 'wifi' }));
            else QUI.toast('Clave del WiFi: ' + (clave || 'sin clave'), 'info', { icon: 'wifi' });
        });
    }

    function tiktokSVG() {
        const footerSvg = document.querySelector('[data-red="tiktok"] svg');
        return footerSvg ? footerSvg.outerHTML : '';
    }

    /* ---------------- Render: footer ---------------- */
    function renderFooter() {
        const n = S().negocio;
        if (!$('#footer-logo')) return;
        const logo = $('#footer-logo');
        logo.src = QStore.resolveAsset(n.logo);
        logo.alt = n.nombre;
        logo.onerror = () => { logo.onerror = null; logo.src = QStore.PLACEHOLDER; };
        $('#footer-frase').textContent = n.frasePie || n.eslogan || '';
        $('#footer-anio').textContent = new Date().getFullYear();
        $('#footer-razon').textContent = n.razonSocial || n.nombre + '.';
        const suc = $('#footer-sucursal');
        suc.href = n.direccion ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(n.direccion) : '#';
        const contacto = $('#footer-contacto');
        contacto.href = n.telefono ? 'tel:' + n.telefono.replace(/[^\d+]/g, '') : '#';
        const redes = n.redes || {};
        $$('#footer-redes [data-red]').forEach(a => {
            const url = redes[a.dataset.red];
            a.hidden = !url;
            if (url) a.href = url;
        });
    }

    /* ---------------- Render: categorías ---------------- */
    function renderChips() {
        const cont = $('#chips-categorias');
        if (!cont) return;
        const s = S();
        const cats = q.categoriasOrdenadas(s).filter(c => s.platillos.some(p => p.categoriaId === c.id));
        if (ui.categoria !== 'todas' && !cats.some(c => c.id === ui.categoria)) ui.categoria = 'todas';
        cont.innerHTML = [{ id: 'todas', nombre: 'Todo el menú', icono: 'layout-grid' }].concat(cats).map(c =>
            '<button class="q-chip' + (ui.categoria === c.id ? ' is-active' : '') + '" data-cat="' + c.id + '">' +
            QUI.icon(c.icono || 'utensils') + esc(c.nombre) + '</button>'
        ).join('');
        QUI.icons(cont);
    }

    /* ---------------- Render: carrusel "Menú para ordenar en línea" ---------------- */
    function renderCarrusel(animar) {
        const s = S();
        const cont = $('#contenedor-productos');
        const lista = platillosOrdenados().filter(p => coincide(p));
        cont.innerHTML = lista.length ? lista.map(p => {
            const cat = q.categoria(s, p.categoriaId);
            const d = descuento(p);
            let badge = '';
            if (!p.disponible) badge = '<span class="badge-esquina badge-esquina--agotado">' + QUI.icon('ban') + 'Agotado</span>';
            else if (d) badge = '<span class="badge-esquina badge-esquina--descuento">-' + d + '%</span>';
            else if (p.destacado) badge = '<span class="badge-esquina badge-esquina--favorito">' + QUI.icon('star') + 'Favorito</span>';
            return plantilla(plantillas.card, {
                id: p.id,
                clase: p.disponible ? '' : 'is-soldout',
                imagen: QUI.imgTag(p.imagen, p.nombre),
                badge,
                categoria: esc(cat ? cat.nombre : ''),
                nombre: esc(p.nombre),
                precio: money(p.precio),
                precioAnterior: precioAnteriorHTML(p),
                disabled: p.disponible ? '' : 'disabled'
            });
        }).join('') : '<div class="pista-vacia">' + QUI.icon('search-x') + '<span>Sin platillos con estos filtros.</span></div>';
        cont.scrollLeft = 0;
        QUI.icons(cont);
        if (animar) QUI.staggerIn($$('.tarjeta-toks', cont).slice(0, 6));
        actualizarFlechasCarrusel();
        return lista.length;
    }

    function actualizarFlechasCarrusel() {
        const pista = $('#contenedor-productos');
        const prev = $('#carrusel-prev'), next = $('#carrusel-next');
        if (!pista || !prev) return;
        const max = pista.scrollWidth - pista.clientWidth - 4;
        prev.disabled = pista.scrollLeft <= 4;
        next.disabled = pista.scrollLeft >= max;
    }

    /* ---------------- Render: platillos destacados y por categoría ---------------- */
    function tarjetaCuadro(p) {
        const badges = [];
        const d = descuento(p);
        if (!p.disponible) badges.push('<span class="etiqueta etiqueta--agotado">' + QUI.icon('ban') + 'Agotado</span>');
        if (d) badges.push('<span class="etiqueta etiqueta--descuento">-' + d + '%</span>');
        if (p.destacado) badges.push('<span class="etiqueta etiqueta--favorito">' + QUI.icon('star') + 'Favorito</span>');
        if (p.tiempo < 10 && p.disponible) badges.push('<span class="etiqueta etiqueta--rapido">' + QUI.icon('zap') + 'Rápido</span>');
        return plantilla(plantillas.cuadro, {
            id: p.id,
            clase: p.disponible ? '' : 'is-soldout',
            nombre: esc(p.nombre),
            precio: money(p.precio),
            precioAnterior: precioAnteriorHTML(p),
            tiempo: p.tiempo,
            descripcion: esc(p.descripcion),
            badges: badges.join(''),
            imagen: QUI.imgTag(p.imagen, p.nombre),
            disabled: p.disponible ? '' : 'disabled'
        });
    }

    function renderDestacados(animar) {
        const s = S();
        const destacados = platillosOrdenados().filter(p => p.destacado && coincide(p));
        const grid = $('#contenedor-cuadricula');
        grid.innerHTML = destacados.map(tarjetaCuadro).join('');
        grid.hidden = !destacados.length;

        let total = destacados.length;
        const secciones = q.categoriasOrdenadas(s).map(c => {
            const lista = s.platillos.filter(p => p.categoriaId === c.id && coincide(p));
            if (!lista.length) return '';
            total += lista.length;
            return '<section class="categoria-bloque" id="sec-' + c.id + '">' +
                '<h3 class="categoria-titulo">' + QUI.icon(c.icono || 'utensils') + esc(c.nombre) + '<span>' + lista.length + (lista.length === 1 ? ' platillo' : ' platillos') + '</span></h3>' +
                '<div class="cuadricula-productos">' + lista.map(tarjetaCuadro).join('') + '</div></section>';
        }).join('');
        $('#contenedor-secciones').innerHTML = secciones;
        $('#sin-resultados').hidden = total > 0;
        QUI.icons($('#seccion-destacados'));
        if (animar) QUI.staggerIn($$('#contenedor-cuadricula .cuadro-platillo').slice(0, 6));
    }

    function renderMenu(animar) {
        renderChips();
        renderCarrusel(animar);
        renderDestacados(animar);
    }

    /* ---------------- Modal de platillo ---------------- */
    function abrirPlatillo(id) {
        const s = S();
        const p = q.platillo(s, id);
        if (!p) return;
        const cat = q.categoria(s, p.categoriaId);
        const d = descuento(p);
        let cantidad = 1;
        const body =
            '<div class="dish-modal__media">' + QUI.imgTag(p.imagen, p.nombre) +
                '<button class="q-icon-btn dish-modal__close" data-close aria-label="Cerrar">' + QUI.icon('x') + '</button>' +
                (p.disponible ? '' : '<span class="dish-modal__soldout">' + QUI.icon('ban') + 'Agotado por hoy</span>') +
            '</div>' +
            '<div class="dish-modal__content">' +
                '<div class="dish-modal__badges">' +
                    (cat ? '<span class="q-badge q-badge--neutral">' + QUI.icon(cat.icono || 'utensils') + esc(cat.nombre) + '</span>' : '') +
                    (d ? '<span class="q-badge q-badge--coral">-' + d + '%</span>' : '') +
                    (p.destacado ? '<span class="q-badge q-badge--gold">' + QUI.icon('star') + 'Favorito de la casa</span>' : '') +
                    '<span class="q-badge q-badge--neutral">' + QUI.icon('timer') + p.tiempo + ' min</span>' +
                '</div>' +
                '<h3 class="dish-modal__title">' + esc(p.nombre) + '</h3>' +
                '<p class="dish-modal__desc">' + esc(p.descripcion) + '</p>' +
                '<div class="dish-modal__prices"><span class="dish-modal__price q-mono">' + money(p.precio) + '</span>' + precioAnteriorHTML(p) + '</div>' +
                '<div class="dish-modal__notes">' +
                    '<label class="q-label" for="nota-platillo">' + QUI.icon('notebook-pen') + ' Indicaciones para cocina</label>' +
                    '<div class="note-chips">' + NOTAS_RAPIDAS.map(n => '<button type="button" class="note-chip" data-nota="' + esc(n) + '">' + esc(n) + '</button>').join('') + '</div>' +
                    '<textarea id="nota-platillo" class="q-textarea" maxlength="140" placeholder="Ej. Sin cebolla, salsa aparte…"></textarea>' +
                '</div>' +
            '</div>';
        const footer =
            '<div class="qty-stepper qty-stepper--lg">' +
                '<button type="button" data-qty="-1" aria-label="Menos">' + QUI.icon('minus') + '</button>' +
                '<span class="q-mono" id="qty-valor">1</span>' +
                '<button type="button" data-qty="1" aria-label="Más">' + QUI.icon('plus') + '</button>' +
            '</div>' +
            '<button class="q-btn q-btn--primary q-btn--lg dish-modal__add" id="btn-agregar-modal"' + (p.disponible && s.negocio.abierto ? '' : ' disabled') + '>' +
                QUI.icon('shopping-bag') + '<span>' + (p.disponible ? 'Agregar · <b class="q-mono" id="total-modal">' + money(p.precio) + '</b>' : 'Agotado') + '</span>' +
            '</button>';

        const modal = QUI.openModal({ body, footer, size: 'md', className: 'dish-modal' });
        const nota = modal.$('#nota-platillo');
        const actualizar = () => {
            modal.$('#qty-valor').textContent = cantidad;
            const t = modal.$('#total-modal');
            if (t) t.textContent = money(p.precio * cantidad);
        };
        modal.$$('[data-qty]').forEach(b => b.addEventListener('click', () => {
            cantidad = Math.max(1, Math.min(20, cantidad + Number(b.dataset.qty)));
            actualizar();
            QUI.pulse(modal.$('#qty-valor'));
        }));
        modal.$$('.note-chip').forEach(ch => ch.addEventListener('click', () => {
            const n = ch.dataset.nota;
            const partes = nota.value.split(',').map(x => x.trim()).filter(Boolean);
            const idx = partes.findIndex(x => normalizar(x) === normalizar(n));
            if (idx >= 0) partes.splice(idx, 1); else partes.push(n);
            nota.value = partes.join(', ');
            ch.classList.toggle('is-active', idx < 0);
        }));
        modal.$('#btn-agregar-modal').addEventListener('click', (e) => {
            agregarAlCarrito(p.id, cantidad, nota.value, e.currentTarget);
            QUI.toast(cantidad + ' × ' + p.nombre + ' agregado a tu pedido.', 'success', { icon: 'shopping-bag', duration: 2200 });
            modal.close();
        });
    }

    /* ---------------- Modales informativos (header y footer) ---------------- */
    function abrirInfo(tipo) {
        const s = S();
        const n = s.negocio;
        const contacto = (n.telefono ? 'al <b>' + esc(n.telefono) + '</b>' : 'con nuestro personal') + (n.direccion ? ' o visítanos en <b>' + esc(n.direccion) + '</b>' : '');
        const contenidos = {
            conocenos: {
                titulo: 'Nuestra historia',
                body: '<div class="info-modal__marca"><img src="' + esc(QStore.resolveAsset(n.logo)) + '" alt="" onerror="this.onerror=null;this.src=QStore.PLACEHOLDER"><div><strong class="q-display">' + esc(n.nombre) + '</strong><p>' + esc(n.eslogan || '') + '</p></div></div>' +
                    '<p class="info-modal__texto">' + esc(n.frasePie || '') + '</p>' +
                    '<ul class="info-modal__lista">' +
                        (n.direccion ? '<li>' + QUI.icon('map-pin') + esc(n.direccion) + '</li>' : '') +
                        (n.horario ? '<li>' + QUI.icon('clock') + esc(n.horario) + '</li>' : '') +
                        (n.telefono ? '<li>' + QUI.icon('phone') + esc(n.telefono) + '</li>' : '') +
                    '</ul>'
            },
            responsabilidad: {
                titulo: 'Responsabilidad Social',
                body: '<p class="info-modal__texto">En <b>' + esc(n.nombre) + '</b> usamos un menú 100% digital: menos papel impreso, precios y disponibilidad siempre actualizados y pedidos directos a cocina que reducen errores y desperdicio.</p>' +
                    '<p class="info-modal__texto">Si quieres conocer más sobre nuestras iniciativas con la comunidad, comunícate ' + contacto + '.</p>'
            },
            empleo: {
                titulo: 'Bolsa de Trabajo',
                body: '<p class="info-modal__texto">¿Te gustaría formar parte del equipo de <b>' + esc(n.nombre) + '</b>? Comunícate ' + contacto + ' y pregunta por las vacantes disponibles.</p>'
            },
            privacidad: {
                titulo: 'Aviso de Privacidad',
                body: '<p class="info-modal__texto">Este menú digital no solicita datos personales. Tu nombre (opcional), tu mesa y tu carrito se guardan únicamente en este dispositivo para poder enviar tu pedido.</p>' +
                    '<p class="info-modal__texto">Para consultar el aviso de privacidad integral de <b>' + esc(n.nombre) + '</b>, solicítalo ' + contacto + '.</p>'
            },
            terminos: {
                titulo: 'Términos y Condiciones',
                body: '<ul class="info-modal__lista">' +
                    '<li>' + QUI.icon('banknote') + 'Precios expresados en ' + esc(n.moneda || 'MXN') + '.</li>' +
                    '<li>' + QUI.icon('receipt-text') + 'Los pedidos se pagan con tu mesero al pedir la cuenta.</li>' +
                    '<li>' + QUI.icon('package-x') + 'La disponibilidad de los platillos puede cambiar durante el día.</li>' +
                    '<li>' + QUI.icon('heart-handshake') + 'La propina es opcional y la eliges tú.</li>' +
                '</ul>'
            },
            facturacion: {
                titulo: 'Facturación Electrónica',
                body: '<p class="info-modal__texto">Pide tu factura al personal al momento de pagar y conserva tu ticket. Para dudas sobre facturación, comunícate ' + contacto + '.</p>'
            }
        };
        const c = contenidos[tipo];
        if (!c) return;
        QUI.openModal({ title: c.titulo, body: c.body, size: 'sm', className: 'info-modal' });
    }

    function manejarNav(destino) {
        cerrarMenuMovil();
        if (destino === 'menu') { scrollSuave($('#seccion-ordenar')); return; }
        if (destino === 'nombre') { pedirNombre(); return; }
        abrirInfo(destino);
    }

    function cerrarMenuMovil() {
        const nav = $('#mobile-nav');
        if (!nav) return;
        nav.hidden = true;
        $('#btn-burger').setAttribute('aria-expanded', 'false');
    }

    function ordenarAqui() {
        if (!mesaActual()) abrirSelectorMesa('Elige tu mesa para empezar a ordenar.');
        scrollSuave($('#seccion-ordenar'));
    }

    /* ---------------- Drawer: carrito y cuenta ---------------- */
    function abrirDrawer(tab) {
        if (tab) ui.tab = tab;
        ui.drawerAbierto = true;
        $('#drawer').classList.add('is-open');
        $('#drawer-overlay').classList.add('is-open');
        $('#drawer').setAttribute('aria-hidden', 'false');
        document.body.classList.add('q-no-scroll');
        renderDrawer();
    }

    function cerrarDrawer() {
        ui.drawerAbierto = false;
        $('#drawer').classList.remove('is-open');
        $('#drawer-overlay').classList.remove('is-open');
        $('#drawer').setAttribute('aria-hidden', 'true');
        if (!document.querySelector('.q-modal-backdrop')) document.body.classList.remove('q-no-scroll');
    }

    function propinaActual() {
        const n = S().negocio;
        return ui.propinaPct == null ? (n.propinaDefault || 0) : ui.propinaPct;
    }

    function renderDrawer() {
        const mesa = mesaActual();
        $('#drawer-mesa').textContent = mesa ? 'Mesa ' + mesa.numero + ' · ' + mesa.zona : 'Sin mesa seleccionada';
        $$('.drawer__tabs button').forEach(b => b.classList.toggle('is-active', b.dataset.tab === ui.tab));
        $('.drawer__title').textContent = ui.tab === 'carrito' ? 'Tu pedido' : 'Cuenta de la mesa';
        if (ui.tab === 'carrito') renderTabCarrito(); else renderTabCuenta();
        QUI.icons($('#drawer'));
    }

    function renderTabCarrito() {
        const body = $('#drawer-body');
        const footer = $('#drawer-footer');
        const s = S();
        const lineas = lineasCarrito();
        if (!lineas.length) {
            body.innerHTML = '<div class="q-empty">' + QUI.icon('shopping-bag') +
                '<strong>Tu pedido está vacío</strong><span>Agrega platillos del menú y envíalos a cocina desde aquí.</span>' +
                '<button class="q-btn q-btn--outline q-btn--sm" data-close-drawer>Explorar el menú</button></div>';
            footer.innerHTML = '';
            body.querySelector('[data-close-drawer]').addEventListener('click', () => { cerrarDrawer(); scrollSuave($('#seccion-ordenar')); });
            return;
        }
        body.innerHTML = '<ul class="cart-list">' + lineas.map(l => {
            const p = l.platillo;
            const it = l.item;
            if (!p) {
                return '<li class="cart-line is-missing"><div class="cart-line__info"><strong>Platillo retirado del menú</strong>' +
                    '<span class="q-hint">Ya no está disponible.</span></div><button class="q-icon-btn q-icon-btn--sm q-icon-btn--danger" data-remove="' + esc(it.key) + '" aria-label="Quitar">' + QUI.icon('trash-2') + '</button></li>';
            }
            return '<li class="cart-line' + (p.disponible ? '' : ' is-missing') + '">' +
                '<div class="cart-line__img">' + QUI.imgTag(p.imagen, p.nombre) + '</div>' +
                '<div class="cart-line__info">' +
                    '<strong>' + esc(p.nombre) + '</strong>' +
                    (it.notas ? '<span class="cart-line__note">' + QUI.icon('notebook-pen') + esc(it.notas) + '</span>' : '') +
                    (p.disponible ? '' : '<span class="q-badge q-badge--dark">Se agotó · no se enviará</span>') +
                    '<div class="cart-line__row">' +
                        '<div class="qty-stepper">' +
                            '<button data-dec="' + esc(it.key) + '" aria-label="Menos">' + QUI.icon(it.cantidad === 1 ? 'trash-2' : 'minus') + '</button>' +
                            '<span class="q-mono">' + it.cantidad + '</span>' +
                            '<button data-inc="' + esc(it.key) + '" aria-label="Más">' + QUI.icon('plus') + '</button>' +
                        '</div>' +
                        '<span class="cart-line__price q-mono">' + money(p.precio * it.cantidad) + '</span>' +
                    '</div>' +
                '</div></li>';
        }).join('') + '</ul>';

        const total = totalCarrito();
        const mesa = mesaActual();
        const puedeEnviar = total > 0 && s.negocio.abierto;
        footer.innerHTML =
            '<div class="summary-row"><span>Subtotal</span><span class="q-mono">' + money(total) + '</span></div>' +
            '<p class="q-hint">La propina se elige al pedir la cuenta. El pago se realiza con tu mesero.</p>' +
            (mesa
                ? '<button class="q-btn q-btn--primary q-btn--lg q-btn--block" id="btn-enviar-pedido"' + (puedeEnviar ? '' : ' disabled') + '>' + QUI.icon('chef-hat') + 'Enviar a cocina · <span class="q-mono">' + money(total) + '</span></button>'
                : '<button class="q-btn q-btn--gold q-btn--lg q-btn--block" id="btn-elegir-mesa-drawer">' + QUI.icon('armchair') + 'Elige tu mesa para enviar</button>') +
            (s.negocio.abierto ? '' : '<p class="q-hint q-hint--warn">El restaurante está cerrado; no se pueden enviar pedidos.</p>');

        body.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => cambiarCantidad(b.dataset.inc, 1)));
        body.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => cambiarCantidad(b.dataset.dec, -1)));
        body.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => quitarLinea(b.dataset.remove)));
        const enviar = $('#btn-enviar-pedido');
        if (enviar) enviar.addEventListener('click', enviarPedido);
        const elegir = $('#btn-elegir-mesa-drawer');
        if (elegir) elegir.addEventListener('click', () => abrirSelectorMesa('Necesitamos tu mesa para llevarte el pedido.'));
    }

    function unidadesCuenta(cuenta) {
        const unidades = [];
        cuenta.items.forEach((it, idx) => {
            for (let u = 0; u < it.cantidad; u++) {
                unidades.push({ key: it.pedidoId + ':' + idx + ':' + u, nombre: it.nombre, precio: it.precio, notas: it.notas });
            }
        });
        return unidades;
    }

    function calcularDivision(cuenta) {
        const pct = propinaActual();
        const subtotal = cuenta.subtotal;
        const propina = QStore.round2(subtotal * pct / 100);
        const total = QStore.round2(subtotal + propina);
        const personas = ui.split.personas;
        if (ui.split.modo === 'iguales') {
            const cada = QStore.round2(total / personas);
            return { total, propina, montos: Array.from({ length: personas }, () => cada) };
        }
        if (ui.split.modo === 'platillo') {
            const subs = Array.from({ length: personas }, () => 0);
            unidadesCuenta(cuenta).forEach(u => {
                const quien = Math.min(personas - 1, ui.split.asignacion[u.key] || 0);
                subs[quien] += u.precio;
            });
            return { total, propina, montos: subs.map(x => QStore.round2(x * (1 + pct / 100))) };
        }
        return { total, propina, montos: [total] };
    }

    function renderTabCuenta() {
        const body = $('#drawer-body');
        const footer = $('#drawer-footer');
        const s = S();
        const mesa = mesaActual();
        if (!mesa) {
            body.innerHTML = '<div class="q-empty">' + QUI.icon('armchair') + '<strong>Primero elige tu mesa</strong><span>Así podremos mostrarte la cuenta compartida.</span>' +
                '<button class="q-btn q-btn--gold q-btn--sm" id="btn-cuenta-mesa">Elegir mesa</button></div>';
            footer.innerHTML = '';
            $('#btn-cuenta-mesa').addEventListener('click', () => abrirSelectorMesa());
            return;
        }
        const cuenta = q.cuentaMesa(s, mesa.id);
        if (!cuenta.items.length) {
            body.innerHTML = '<div class="q-empty">' + QUI.icon('receipt-text') + '<strong>Aún no hay consumo en esta mesa</strong><span>Cuando envíes tu pedido a cocina, aquí verás la cuenta de toda la mesa.</span></div>';
            footer.innerHTML = '';
            return;
        }
        const pct = propinaActual();
        const div = calcularDivision(cuenta);
        const opcionesPropina = s.negocio.propinas || [0, 10, 15, 20];
        const pendienteCuenta = q.alertasMesa(s, mesa.id).some(a => a.tipo === 'cuenta');

        let html = '<div class="bill">' +
            cuenta.pedidos.map(p => {
                const est = QStore.ESTADOS_PEDIDO[p.estado] || { label: p.estado };
                return '<div class="bill__order"><div class="bill__order-head"><span class="q-mono">#' + p.folio + (p.comensal ? ' · ' + esc(p.comensal) : '') + '</span>' +
                    '<span class="status-pill status-pill--' + p.estado + '">' + esc(est.label) + '</span></div>' +
                    p.items.map(it => '<div class="bill__line"><span><b class="q-mono">' + it.cantidad + '×</b> ' + esc(it.nombre) + '</span><span class="q-mono">' + money(it.precio * it.cantidad) + '</span></div>').join('') +
                    '</div>';
            }).join('') + '</div>';

        html += '<div class="split">' +
            '<div class="split__head"><strong>' + QUI.icon('split') + ' Dividir cuenta</strong></div>' +
            '<div class="q-segmented split__modes">' +
                '<button data-modo="una" class="' + (ui.split.modo === 'una' ? 'is-active' : '') + '">Una cuenta</button>' +
                '<button data-modo="iguales" class="' + (ui.split.modo === 'iguales' ? 'is-active' : '') + '">Partes iguales</button>' +
                '<button data-modo="platillo" class="' + (ui.split.modo === 'platillo' ? 'is-active' : '') + '">Por platillo</button>' +
            '</div>';

        if (ui.split.modo !== 'una') {
            html += '<div class="split__people"><span>Personas</span><div class="qty-stepper">' +
                '<button data-personas="-1" aria-label="Menos">' + QUI.icon('minus') + '</button><span class="q-mono">' + ui.split.personas + '</span>' +
                '<button data-personas="1" aria-label="Más">' + QUI.icon('plus') + '</button></div></div>';
        }
        if (ui.split.modo === 'platillo') {
            const opciones = n => Array.from({ length: ui.split.personas }, (_, i) => '<option value="' + i + '"' + (i === n ? ' selected' : '') + '>Persona ' + (i + 1) + '</option>').join('');
            html += '<ul class="split__assign">' + unidadesCuenta(cuenta).map(u => {
                const quien = Math.min(ui.split.personas - 1, ui.split.asignacion[u.key] || 0);
                return '<li><span>' + esc(u.nombre) + ' <b class="q-mono">' + money(u.precio) + '</b></span>' +
                    '<select class="q-select q-select--sm" data-asignar="' + esc(u.key) + '">' + opciones(quien) + '</select></li>';
            }).join('') + '</ul>';
        }
        if (ui.split.modo !== 'una') {
            html += '<div class="split__result">' + div.montos.map((m, i) =>
                '<div class="split__person"><span class="avatar-dot">' + (i + 1) + '</span><span>Persona ' + (i + 1) + '</span><b class="q-mono">' + money(m) + '</b></div>'
            ).join('') + '</div>';
        }
        html += '</div>';
        body.innerHTML = html;

        footer.innerHTML =
            '<div class="tip"><span class="q-label">Propina sugerida</span><div class="tip__options">' +
                opcionesPropina.map(o => '<button class="tip__btn' + (o === pct ? ' is-active' : '') + '" data-propina="' + o + '">' + (o === 0 ? 'Sin propina' : o + '%') + '</button>').join('') +
            '</div></div>' +
            '<div class="summary-row"><span>Subtotal</span><span class="q-mono">' + money(cuenta.subtotal) + '</span></div>' +
            '<div class="summary-row"><span>Propina (' + pct + '%)</span><span class="q-mono">' + money(div.propina) + '</span></div>' +
            '<div class="summary-row summary-row--total"><span>Total</span><span class="q-mono">' + money(div.total) + '</span></div>' +
            '<button class="q-btn ' + (pendienteCuenta ? 'q-btn--outline' : 'q-btn--dark') + ' q-btn--lg q-btn--block" id="btn-cuenta-drawer">' +
                QUI.icon(pendienteCuenta ? 'circle-check' : 'receipt-text') + (pendienteCuenta ? 'Cuenta solicitada · tu mesero viene' : 'Pedir la cuenta') + '</button>';

        body.querySelectorAll('[data-modo]').forEach(b => b.addEventListener('click', () => { ui.split.modo = b.dataset.modo; renderDrawer(); }));
        body.querySelectorAll('[data-personas]').forEach(b => b.addEventListener('click', () => {
            ui.split.personas = Math.max(2, Math.min(20, ui.split.personas + Number(b.dataset.personas)));
            renderDrawer();
        }));
        body.querySelectorAll('[data-asignar]').forEach(sel => sel.addEventListener('change', () => {
            ui.split.asignacion[sel.dataset.asignar] = Number(sel.value);
            renderDrawer();
        }));
        footer.querySelectorAll('[data-propina]').forEach(b => b.addEventListener('click', () => { ui.propinaPct = Number(b.dataset.propina); renderDrawer(); }));
        $('#btn-cuenta-drawer').addEventListener('click', (e) => pedirCuenta(e.currentTarget));
        if (QUI.hasGsap()) gsap.from(body.querySelectorAll('.split__person'), { y: 8, opacity: 0, stagger: 0.04, duration: 0.3, clearProps: 'all' });
    }

    function enviarPedido() {
        const s = S();
        const mesa = mesaActual();
        if (!mesa) { abrirSelectorMesa('Elige tu mesa para enviar el pedido.'); return; }
        if (!s.negocio.abierto) { QUI.toast('El restaurante está cerrado.', 'warning'); return; }
        const lineas = lineasCarrito().filter(l => l.platillo && l.platillo.disponible);
        if (!lineas.length) { QUI.toast('No hay platillos disponibles para enviar.', 'warning'); return; }
        const btn = $('#btn-enviar-pedido');
        if (btn) { btn.disabled = true; btn.innerHTML = QUI.icon('loader-circle', 'spin') + 'Enviando…'; QUI.icons(btn); }
        const comensal = nombreComensal();

        let pedido;
        try {
            pedido = QStore.update(st => {
                const m = q.mesa(st, mesa.id);
                const items = lineas.map(l => {
                    const p = q.platillo(st, l.platillo.id);
                    return { platilloId: p.id, nombre: p.nombre, precio: p.precio, cantidad: l.item.cantidad, notas: l.item.notas || '' };
                });
                const nuevo = {
                    id: QStore.uid('ped'), folio: st.contadores.pedido++, mesaId: m.id, origen: 'qr', tipo: 'mesa',
                    estado: 'pendiente', pagado: false, creadoEn: Date.now(), actualizadoEn: Date.now(),
                    items, total: QStore.totalItems(items), comensal: comensal || null
                };
                st.pedidos.push(nuevo);
                if (!m.abierta) { m.abierta = true; m.abiertaEn = Date.now(); }
                return nuevo;
            }, { type: 'pedido:nuevo', mesaId: mesa.id });
        } catch (e) {
            QUI.toast(e.message, 'error');
            renderDrawer();
            return;
        }

        const mis = leerJSON(MIS_PEDIDOS_KEY, []);
        mis.push(pedido.id);
        guardarJSON(MIS_PEDIDOS_KEY, mis.slice(-30));
        ui.estadosPrevios[pedido.id] = 'pendiente';
        setCarrito([]);
        cerrarDrawer();
        celebrarEnvio(pedido);
        renderTracker();
        setTimeout(() => scrollSuave($('#tracker')), 450);
    }

    function celebrarEnvio(pedido) {
        const el = document.createElement('div');
        el.className = 'sent-burst';
        el.innerHTML = '<div class="sent-burst__card"><span class="sent-burst__icon">' + QUI.icon('chef-hat') + '</span>' +
            '<strong class="q-display">¡Pedido enviado!</strong><span>Folio <b class="q-mono">#' + pedido.folio + '</b> ya está en cocina.</span></div>';
        document.body.appendChild(el);
        QUI.icons(el);
        if (!QUI.hasGsap()) { setTimeout(() => el.remove(), 1600); return; }
        gsap.timeline({ onComplete: () => el.remove() })
            .fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 })
            .fromTo('.sent-burst__card', { scale: 0.8, y: 20 }, { scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.8)' }, '<')
            .fromTo('.sent-burst__icon', { rotate: -20 }, { rotate: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, '<0.1')
            .to(el, { opacity: 0, duration: 0.3, delay: 1.1 });
    }

    /* ---------------- Seguimiento en vivo ---------------- */
    const PASOS = [
        { key: 'pendiente', label: 'Recibido', icon: 'inbox' },
        { key: 'preparacion', label: 'En preparación en cocina', icon: 'flame' },
        { key: 'listo', label: '¡Listo para servir en tu mesa!', icon: 'bell-ring' }
    ];
    const PROGRESO = { pendiente: 0.14, preparacion: 0.55, listo: 1, entregado: 1 };

    function pedidosSeguidos() {
        const s = S();
        const ids = leerJSON(MIS_PEDIDOS_KEY, []);
        return ids.map(id => s.pedidos.find(p => p.id === id))
            .filter(p => p && !p.pagado && p.estado !== 'cancelado' &&
                (p.estado !== 'entregado' || Date.now() - p.actualizadoEn < 3 * 60000));
    }

    function renderTracker() {
        const cont = $('#tracker');
        const lista = pedidosSeguidos();
        if (!lista.length) { cont.hidden = true; cont.innerHTML = ''; return; }
        cont.hidden = false;
        cont.innerHTML = lista.map(p => {
            const idxActual = p.estado === 'entregado' ? 3 : PASOS.findIndex(x => x.key === p.estado);
            const piezas = p.items.reduce((a, i) => a + i.cantidad, 0);
            const titulo = p.estado === 'entregado' ? 'Servido. ¡Buen provecho!' : (PASOS[idxActual] ? PASOS[idxActual].label : '');
            return '<article class="track-card track-card--' + p.estado + '" data-pedido="' + p.id + '">' +
                '<div class="track-card__head">' +
                    '<span class="track-card__icon">' + QUI.icon(p.estado === 'entregado' ? 'utensils' : (PASOS[idxActual] || PASOS[0]).icon) + '</span>' +
                    '<div><span class="eyebrow">Pedido <b class="q-mono">#' + p.folio + '</b> · ' + piezas + (piezas === 1 ? ' platillo' : ' platillos') + '</span>' +
                    '<strong class="track-card__title">' + esc(titulo) + '</strong></div>' +
                    '<span class="track-card__time q-mono">' + QStore.minutesSince(p.creadoEn) + ' min</span>' +
                '</div>' +
                '<div class="track-bar"><div class="track-bar__fill"></div></div>' +
                '<ol class="track-steps">' + PASOS.map((paso, i) =>
                    '<li class="' + (i < idxActual ? 'is-done' : i === idxActual ? 'is-current' : '') + '">' + QUI.icon(paso.icon) + '<span>' + esc(paso.label.replace('¡', '').replace('!', '')) + '</span></li>'
                ).join('') + '</ol>' +
            '</article>';
        }).join('');
        QUI.icons(cont);
        lista.forEach(p => {
            const fill = cont.querySelector('[data-pedido="' + p.id + '"] .track-bar__fill');
            const destino = PROGRESO[p.estado] || 0;
            const previo = ui.anchoTracker[p.id] != null ? ui.anchoTracker[p.id] : 0;
            if (QUI.hasGsap()) gsap.fromTo(fill, { scaleX: previo }, { scaleX: destino, duration: 0.9, ease: 'expo.out' });
            else fill.style.transform = 'scaleX(' + destino + ')';
            ui.anchoTracker[p.id] = destino;
        });
    }

    function notificarCambiosPedidos(remoto) {
        pedidosSeguidos().forEach(p => {
            const previo = ui.estadosPrevios[p.id];
            if (previo && previo !== p.estado && remoto) {
                if (p.estado === 'preparacion') QUI.toast('Tu pedido #' + p.folio + ' ya se está cocinando.', 'info', { icon: 'flame', title: 'En preparación' });
                if (p.estado === 'listo') {
                    QUI.toast('Tu pedido #' + p.folio + ' va en camino a tu mesa.', 'success', { icon: 'bell-ring', title: '¡Listo para servir!' });
                    QUI.chime('pedido');
                    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
                }
            }
            ui.estadosPrevios[p.id] = p.estado;
        });
    }

    function notificarAlertasAtendidas(remoto) {
        const s = S();
        const mesa = mesaActual();
        if (!mesa) return;
        s.alertas.filter(a => a.mesaId === mesa.id).forEach(a => {
            const previo = ui.alertasPrevias[a.id];
            if (previo === false && a.atendida && remoto) {
                QUI.toast(a.tipo === 'cuenta' ? 'Tu mesero va en camino con la cuenta.' : 'Tu mesero va en camino.', 'success', { icon: 'hand-platter' });
            }
            ui.alertasPrevias[a.id] = a.atendida;
        });
    }

    /* ---------------- Acciones rápidas en mesa ---------------- */
    function confirmarBoton(btn, icono, texto) {
        if (!btn) return;
        const original = btn.innerHTML;
        btn.classList.add('is-confirmed');
        const label = btn.querySelector('.dock-btn__label');
        const icon = btn.querySelector('.dock-btn__icon');
        if (label && icon) {
            icon.innerHTML = QUI.icon(icono);
            label.textContent = texto;
            QUI.icons(btn);
            if (QUI.hasGsap()) gsap.fromTo(icon, { scale: 0.4, rotate: -30 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(2.2)' });
            setTimeout(() => { btn.classList.remove('is-confirmed'); btn.innerHTML = original; QUI.icons(btn); renderDock(); }, 3200);
        } else {
            QUI.pulse(btn);
        }
    }

    function crearAlerta(tipo, nota, extra) {
        const mesa = mesaActual();
        return QStore.update(st => {
            const yaExiste = st.alertas.find(a => a.mesaId === mesa.id && a.tipo === tipo && !a.atendida);
            if (yaExiste) { Object.assign(yaExiste, extra || {}, { nota: nota || yaExiste.nota, creadoEn: Date.now() }); return yaExiste; }
            const nueva = Object.assign({ id: QStore.uid('al'), mesaId: mesa.id, tipo, nota: nota || '', creadoEn: Date.now(), atendida: false }, extra || {});
            st.alertas.push(nueva);
            const m = q.mesa(st, mesa.id);
            if (m && !m.abierta) { m.abierta = true; m.abiertaEn = Date.now(); }
            return nueva;
        }, { type: 'alerta:nueva', tipo, mesaId: mesa.id });
    }

    function llamarMesero() {
        const mesa = mesaActual();
        if (!mesa) { abrirSelectorMesa('Elige tu mesa para avisar a tu mesero.'); return; }
        const nombre = nombreComensal();
        const al = crearAlerta('mesero', nombre ? 'Lo solicita ' + nombre : '');
        ui.alertasPrevias[al.id] = false;
        confirmarBoton($('#btn-llamar-mesero'), 'check', '¡Mesero avisado!');
        QUI.toast('Avisamos a tu mesero. Llega en un momento.', 'success', { icon: 'hand-platter', title: 'Mesa ' + mesa.numero });
    }

    function pedirCuenta(btnOrigen) {
        const s = S();
        const mesa = mesaActual();
        if (!mesa) { abrirSelectorMesa('Elige tu mesa para pedir la cuenta.'); return; }
        const cuenta = q.cuentaMesa(s, mesa.id);
        if (!cuenta.items.length) {
            QUI.toast('Aún no hay consumo registrado en tu mesa.', 'info', { icon: 'receipt-text' });
            return;
        }
        const pct = propinaActual();
        const div = calcularDivision(cuenta);
        let nota;
        if (ui.split.modo === 'iguales') nota = 'Dividir en partes iguales entre ' + ui.split.personas + ' (' + money(div.montos[0]) + ' c/u)';
        else if (ui.split.modo === 'platillo') nota = 'Dividir por platillo: ' + div.montos.map((m, i) => 'P' + (i + 1) + ' ' + money(m)).join(', ');
        else nota = 'Una sola cuenta';
        nota += ' · propina ' + pct + '%';
        const al = crearAlerta('cuenta', nota, {
            split: { modo: ui.split.modo, personas: ui.split.modo === 'una' ? 1 : ui.split.personas, propinaPct: pct, montos: div.montos }
        });
        ui.alertasPrevias[al.id] = false;
        confirmarBoton($('#btn-pedir-cuenta'), 'check', '¡Cuenta en camino!');
        if (btnOrigen && btnOrigen.id === 'btn-cuenta-drawer') renderDrawer();
        QUI.toast('Tu mesero traerá la cuenta: ' + money(div.total) + '.', 'success', { icon: 'receipt-text', title: 'Cuenta solicitada' });
    }

    /* ---------------- Dock y contadores ---------------- */
    function renderContadores() {
        const piezas = piezasCarrito();
        const total = totalCarrito();
        const c = $('#cart-count');
        if (c) { c.textContent = piezas; c.classList.toggle('is-empty', piezas === 0); }
        $('#dock-count').textContent = piezas;
        $('#dock-total').textContent = money(total);
        $('#btn-dock-carrito').classList.toggle('has-items', piezas > 0);
    }

    function renderDock() {
        const s = S();
        const mesa = mesaActual();
        const alertas = mesa ? q.alertasMesa(s, mesa.id) : [];
        const btnM = $('#btn-llamar-mesero');
        const btnC = $('#btn-pedir-cuenta');
        if (!btnM.classList.contains('is-confirmed')) btnM.classList.toggle('is-pending', alertas.some(a => a.tipo === 'mesero'));
        if (!btnC.classList.contains('is-confirmed')) btnC.classList.toggle('is-pending', alertas.some(a => a.tipo === 'cuenta'));
        renderContadores();
    }

    /* ---------------- Barra sticky ---------------- */
    function actualizarSticky() {
        const slot = $('#contenedor-sidebar');
        if (!slot) return;
        slot.style.top = alturaHeader() + 'px';
        const pegada = slot.getBoundingClientRect().top <= alturaHeader() + 1;
        slot.classList.toggle('is-stuck', pegada);
        $('#site-header').classList.toggle('is-scrolled', window.scrollY > 8);
    }

    function despuesDeFiltrar() {
        // Si la barra ya está fija, lleva la vista al inicio de los resultados
        const slot = $('#contenedor-sidebar');
        if (slot.classList.contains('is-stuck')) scrollSuave($('#seccion-carrusel'), true);
    }

    /* ---------------- Eventos ---------------- */
    function enlazarEventos() {
        // Delegación global: agregar rápido, abrir detalle, navegación
        document.addEventListener('click', (e) => {
            const add = e.target.closest('[data-add]');
            if (add) {
                e.stopPropagation();
                agregarAlCarrito(add.dataset.add, 1, '', add);
                return;
            }
            const nav = e.target.closest('[data-nav]');
            if (nav) { e.preventDefault(); manejarNav(nav.dataset.nav); return; }
            if (e.target.closest('[data-ordenar]')) { ordenarAqui(); return; }
            const open = e.target.closest('[data-open]');
            if (open && !e.target.closest('.q-modal')) abrirPlatillo(open.dataset.open);
        });
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('article[data-open]')) {
                e.preventDefault();
                abrirPlatillo(e.target.dataset.open);
            }
        });

        // Header
        $('#btn-carrito').addEventListener('click', () => abrirDrawer('carrito'));
        $('#btn-mesa').addEventListener('click', () => abrirSelectorMesa());
        $('#btn-ordena').addEventListener('click', ordenarAqui);
        $('#btn-saludo').addEventListener('click', pedirNombre);
        $('#btn-burger').addEventListener('click', () => {
            const nav = $('#mobile-nav');
            nav.hidden = !nav.hidden;
            $('#btn-burger').setAttribute('aria-expanded', String(!nav.hidden));
            if (!nav.hidden && QUI.hasGsap()) gsap.fromTo(nav.children, { y: -8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.04 });
        });
        $('.logo-box').addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

        // Drawer
        $('#btn-cerrar-drawer').addEventListener('click', cerrarDrawer);
        $('#drawer-overlay').addEventListener('click', cerrarDrawer);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.drawerAbierto && !document.querySelector('.q-modal-backdrop')) cerrarDrawer(); });
        $$('.drawer__tabs button').forEach(b => b.addEventListener('click', () => { ui.tab = b.dataset.tab; renderDrawer(); }));

        // Dock
        $('#btn-dock-carrito').addEventListener('click', () => abrirDrawer('carrito'));
        $('#btn-llamar-mesero').addEventListener('click', llamarMesero);
        $('#btn-pedir-cuenta').addEventListener('click', () => {
            const mesa = mesaActual();
            if (mesa && q.cuentaMesa(S(), mesa.id).items.length) abrirDrawer('cuenta');
            else pedirCuenta();
        });

        // Carrusel del hero
        $('#hero-prev').addEventListener('click', () => { irASlide(ui.hero.index - 1); reiniciarHero(); });
        $('#hero-next').addEventListener('click', () => { irASlide(ui.hero.index + 1); reiniciarHero(); });
        $('#hero-puntos').addEventListener('click', e => {
            const p = e.target.closest('[data-punto]');
            if (p) { irASlide(Number(p.dataset.punto)); reiniciarHero(); }
        });
        const hero = $('#hero');
        hero.addEventListener('mouseenter', () => clearInterval(ui.hero.timer));
        hero.addEventListener('mouseleave', reiniciarHero);
        let x0 = null;
        hero.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
        hero.addEventListener('touchend', e => {
            if (x0 == null) return;
            const dx = e.changedTouches[0].clientX - x0;
            if (Math.abs(dx) > 40) { irASlide(ui.hero.index + (dx < 0 ? 1 : -1)); reiniciarHero(); }
            x0 = null;
        });

        // Buscador y filtros
        const buscador = $('#buscador');
        const limpiar = $('#buscador-limpiar');
        let t;
        buscador.addEventListener('input', () => {
            clearTimeout(t);
            limpiar.hidden = !buscador.value;
            t = setTimeout(() => { ui.busqueda = normalizar(buscador.value); renderMenu(true); }, 140);
        });
        limpiar.addEventListener('click', () => { buscador.value = ''; limpiar.hidden = true; ui.busqueda = ''; renderMenu(true); buscador.focus(); });
        $$('.filter').forEach(f => f.addEventListener('click', () => {
            const k = f.dataset.filter;
            if (ui.filtros.has(k)) ui.filtros.delete(k); else ui.filtros.add(k);
            f.classList.toggle('is-active', ui.filtros.has(k));
            renderMenu(true);
            despuesDeFiltrar();
        }));
        $('#btn-limpiar-filtros').addEventListener('click', () => {
            ui.filtros.clear();
            ui.busqueda = '';
            ui.categoria = 'todas';
            buscador.value = '';
            limpiar.hidden = true;
            $$('.filter').forEach(f => f.classList.remove('is-active'));
            renderMenu(true);
            scrollSuave($('#seccion-ordenar'));
        });

        // Categorías
        $('#chips-categorias').addEventListener('click', (e) => {
            const chip = e.target.closest('[data-cat]');
            if (!chip) return;
            ui.categoria = chip.dataset.cat;
            renderMenu(true);
            despuesDeFiltrar();
        });

        // Flechas del carrusel de tarjetas
        const pista = $('#contenedor-productos');
        const paso = () => Math.max(pista.clientWidth * 0.8, 300);
        $('#carrusel-prev').addEventListener('click', () => pista.scrollBy({ left: -paso(), behavior: 'smooth' }));
        $('#carrusel-next').addEventListener('click', () => pista.scrollBy({ left: paso(), behavior: 'smooth' }));
        pista.addEventListener('scroll', actualizarFlechasCarrusel, { passive: true });

        window.addEventListener('scroll', actualizarSticky, { passive: true });
        window.addEventListener('resize', () => { actualizarSticky(); actualizarFlechasCarrusel(); if (window.innerWidth > 900) cerrarMenuMovil(); });
    }

    /* ---------------- Sincronización en tiempo real ---------------- */
    function alCambiarStore(state, evento, remoto) {
        if (mesaNumero && !q.mesaPorNumero(S(), mesaNumero)) {
            mesaNumero = null;
            sessionStorage.removeItem(MESA_KEY);
        }
        renderHeader();
        renderHero();
        renderCintilla();
        renderFooter();
        renderMenu(false);
        renderDock();
        notificarCambiosPedidos(remoto);
        notificarAlertasAtendidas(remoto);
        renderTracker();
        if (ui.drawerAbierto) renderDrawer();
        if (remoto && evento && evento.type === 'reset') QUI.toast('El restaurante actualizó su menú.', 'info', { icon: 'refresh-cw' });
    }

    /* ---------------- Arranque ---------------- */
    async function init() {
        QStore.get();
        resolverMesaInicial();
        try {
            const [header, sidebar, card, cuadro, footer] = await Promise.all([
                cargarParcial('../components/header.html'), cargarParcial('../components/sidebar.html'), cargarParcial('../components/card.html'),
                cargarParcial('../components/cuadro_card.html'), cargarParcial('../components/footer.html')
            ]);
            $('#contenedor-header').innerHTML = header;
            $('#contenedor-sidebar').innerHTML = sidebar;
            $('#contenedor-footer').innerHTML = footer;
            plantillas.card = card;
            plantillas.cuadro = cuadro;
        } catch (e) {
            document.getElementById('menu-main').innerHTML =
                '<div class="q-empty" style="min-height:60vh">' +
                '<strong>No se pudieron cargar los componentes del menú</strong>' +
                '<span>Abre el proyecto desde un servidor (Live Server, Render o <code>npx serve</code>), no con doble clic al archivo.</span></div>';
            return;
        }

        // Estado inicial de seguimiento (sin notificar)
        const s = S();
        pedidosSeguidos().forEach(p => { ui.estadosPrevios[p.id] = p.estado; });
        const mesa = mesaActual();
        if (mesa) s.alertas.filter(a => a.mesaId === mesa.id).forEach(a => { ui.alertasPrevias[a.id] = a.atendida; });

        renderHeader();
        renderHero();
        renderCintilla();
        renderFooter();
        renderMenu(true);
        renderTracker();
        renderDock();
        enlazarEventos();
        QUI.icons();
        actualizarSticky();

        if (QUI.hasGsap()) {
            const texto = $('#hero-slides .slide.activa .slide__texto');
            if (texto) gsap.from(texto.children, { y: 20, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' });
        }

        QStore.subscribe(alCambiarStore);

        // Minutos del tracker
        setInterval(() => {
            $$('.track-card').forEach(card => {
                const p = S().pedidos.find(x => x.id === card.dataset.pedido);
                const t = card.querySelector('.track-card__time');
                if (p && t) t.textContent = QStore.minutesSince(p.creadoEn) + ' min';
            });
        }, 30000);

        if (!mesa && new URLSearchParams(location.search).get('mesa')) {
            QUI.toast('La mesa del QR ya no existe. Elige tu mesa.', 'warning', { icon: 'armchair' });
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();

/* =====================================================================
   Q-RICO · Menú web del comensal (menu-web/)
   Header coral, carrusel promocional, cintilla compacta, favoritos en
   carrusel 3D y menú por categorías con barra sticky de una sola fila
   (chips con indicador deslizante + buscador). El pedido no exige mesa:
   sin ?mesa=X se envía como pedido directo (para comer aquí o para
   llevar); con ?mesa=X se asocia en silencio y se habilitan la cuenta
   de la mesa, el llamado al mesero y la cuenta dividida.
   Todo se alimenta de qrico_saas_store y se sincroniza con el panel.
   Animaciones: GSAP (ScrollTrigger + Flip), Swiper, Lenis y canvas-confetti.
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
    const MODALIDAD_KEY = 'qrico_modalidad';
    const HERO_INTERVALO = 6000;

    // Notas rápidas para cocina según el tipo de platillo; las categorías creadas por el restaurante usan las generales
    const NOTAS_GENERALES = ['Sin cebolla', 'Sin picante', 'Salsa aparte', 'Para compartir'];
    const NOTAS_POR_CATEGORIA = {
        cat_casera: ['Sin cebolla', 'Sin picante', 'Salsa aparte', 'Sin crema', 'Tortillas extra'],
        cat_burgers: ['Término medio', 'Bien cocida', 'Sin pepinillos', 'Sin cebolla', 'Aderezo aparte'],
        cat_asiatica: ['Sin ajonjolí', 'Extra picante', 'Salsa aparte', 'Sin cebollín', 'Palillos extra'],
        cat_entradas: ['Sin cebolla', 'Picante aparte', 'Sin cilantro', 'Para compartir'],
        cat_pan_cafe: ['Con nata', 'Con cajeta', 'Matcha', 'Leche deslactosada', 'Leche de avena', 'Extra shot'],
        cat_postres: ['Jamaica', 'Horchata', 'Sin hielo', 'Poca azúcar', 'Para compartir']
    };

    // Textos de accesibilidad de Swiper en español
    const A11Y_SWIPER = {
        prevSlideMessage: 'Anterior',
        nextSlideMessage: 'Siguiente',
        firstSlideMessage: 'Es la primera',
        lastSlideMessage: 'Es la última',
        paginationBulletMessage: 'Ir a la diapositiva {{index}}',
        slideLabelMessage: '{{index}} de {{slidesLength}}',
        containerRoleDescriptionMessage: 'carrusel',
        itemRoleDescriptionMessage: 'diapositiva'
    };

    const plantillas = { card: '', cuadro: '' };
    const ui = {
        busqueda: '',
        tab: 'carrito',
        drawerAbierto: false,
        propinaPct: null,
        split: { modo: 'una', personas: 2, asignacion: {} },
        estadosPrevios: {},
        alertasPrevias: {},
        anchoTracker: {},
        firmaMenu: '',
        firmaHero: '',
        chipActivo: null,
        spyBloqueado: false,
        spyTimer: null,
        revelados: [],
        swiperHero: null,
        swiperFavoritos: null,
        lenis: null,
        ultimoFoco: null
    };
    let mesaNumero = null;

    /* ---------------- Utilidades ---------------- */
    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    const hayGsap = () => QUI.hasGsap();
    const hayScrollTrigger = () => hayGsap() && typeof window.ScrollTrigger !== 'undefined';
    const hayFlip = () => hayGsap() && typeof window.Flip !== 'undefined';
    const reducir = () => QUI.reducirMovimiento();

    function plantilla(tpl, data) {
        return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] == null ? '' : data[k]));
    }

    function normalizar(txt) {
        // NFD separa acentos de su letra; \p{M} elimina las marcas diacríticas (tacos = tácos)
        return String(txt || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
    }

    function leerJSON(key, def) {
        try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; }
    }

    function guardarJSON(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* almacenamiento lleno */ }
    }

    function leerSesion(key) {
        try { return sessionStorage.getItem(key); } catch (e) { return null; }
    }

    function guardarSesion(key, valor) {
        try { if (valor == null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, valor); } catch (e) { /* sin almacenamiento */ }
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

    function conteoTexto(n) { return n + (n === 1 ? ' platillo' : ' platillos'); }

    function nombreComensal() {
        try { return (localStorage.getItem(NOMBRE_KEY) || '').trim(); } catch (e) { return ''; }
    }

    function guardarNombre(valor) {
        try { if (valor) localStorage.setItem(NOMBRE_KEY, valor); else localStorage.removeItem(NOMBRE_KEY); } catch (e) { /* sin almacenamiento */ }
    }

    // Pedido directo: "mostrador" (para comer aquí) o "llevar"
    function modalidadActual() { return leerSesion(MODALIDAD_KEY) === 'llevar' ? 'llevar' : 'mostrador'; }

    function alturaHeader() {
        const h = $('#site-header');
        return h ? h.offsetHeight : 72;
    }

    function alturaCatbar() {
        const c = $('#contenedor-sidebar');
        return c ? c.offsetHeight : 0;
    }

    /* Desplazamiento suave con Lenis (o nativo si no está disponible) compensando header y barra sticky */
    function desplazarA(destino, opts) {
        opts = opts || {};
        if (destino == null) return;
        const offset = alturaHeader() + (opts.sinCatbar ? 0 : alturaCatbar()) + 12;
        const y = Math.max(0, typeof destino === 'number' ? destino : destino.getBoundingClientRect().top + window.scrollY - offset);
        if (ui.lenis) {
            ui.lenis.scrollTo(y, { duration: 1.05, onComplete: opts.alTerminar });
        } else {
            window.scrollTo({ top: y, behavior: reducir() ? 'auto' : 'smooth' });
            if (opts.alTerminar) setTimeout(opts.alTerminar, 750);
        }
    }

    /* ---------------- Mesa (solo si llega por QR) ---------------- */
    // Devuelve el número de mesa del QR si ya no existe, para avisar al comensal
    function resolverMesaInicial() {
        const param = new URLSearchParams(location.search).get('mesa');
        const candidata = param || leerSesion(MESA_KEY);
        const mesa = candidata ? q.mesaPorNumero(S(), candidata) : null;
        if (mesa) {
            mesaNumero = mesa.numero;
            guardarSesion(MESA_KEY, mesa.numero);
        } else {
            guardarSesion(MESA_KEY, null);
        }
        return param && !mesa ? param : null;
    }

    function mesaActual() {
        return mesaNumero ? q.mesaPorNumero(S(), mesaNumero) || null : null;
    }

    /* ---------------- Carrito ---------------- */
    function carrito() { return leerJSON(CART_KEY, []); }

    function setCarrito(items, platilloCambiado) {
        guardarJSON(CART_KEY, items);
        renderContadores();
        actualizarControles(platilloCambiado);
        renderFlotante();
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

    function cantidadesPorPlatillo() {
        const mapa = {};
        carrito().forEach(it => { mapa[it.platilloId] = (mapa[it.platilloId] || 0) + it.cantidad; });
        return mapa;
    }

    function agregarAlCarrito(platilloId, cantidad, notas, origenEl, conVuelo) {
        const s = S();
        const p = q.platillo(s, platilloId);
        if (!p) return false;
        if (!s.negocio.abierto) { QUI.toast('El restaurante está cerrado en este momento.', 'warning', { icon: 'store' }); return false; }
        if (!p.disponible) { QUI.toast(p.nombre + ' está agotado por ahora.', 'warning'); return false; }
        notas = (notas || '').trim();
        const key = platilloId + '|' + normalizar(notas);
        const items = carrito();
        const existente = items.find(i => i.key === key);
        if (existente) existente.cantidad = Math.min(99, existente.cantidad + cantidad);
        else items.push({ key, platilloId, cantidad, notas });
        setCarrito(items, platilloId);
        if (conVuelo) animarVuelo(origenEl, p);
        else QUI.pulse(destinoCarrito());
        return true;
    }

    /* Quita una pieza desde la tarjeta: primero de la línea sin nota (la que suma el "+"), si no, de la más reciente */
    function restarDelCarrito(platilloId) {
        const items = carrito();
        let it = items.find(i => i.platilloId === platilloId && !i.notas);
        if (!it) it = items.slice().reverse().find(i => i.platilloId === platilloId);
        if (!it) return;
        it.cantidad -= 1;
        setCarrito(it.cantidad <= 0 ? items.filter(i => i !== it) : items, platilloId);
    }

    function cambiarCantidad(key, delta) {
        const items = carrito();
        const it = items.find(i => i.key === key);
        if (!it) return;
        it.cantidad += delta;
        setCarrito(it.cantidad <= 0 ? items.filter(i => i.key !== key) : items, it.platilloId);
    }

    function quitarLinea(key) {
        const it = carrito().find(i => i.key === key);
        setCarrito(carrito().filter(i => i.key !== key), it && it.platilloId);
    }

    /* Cambia la nota de una línea. Si ya existe otra línea del mismo platillo con esa nota, se fusionan */
    function guardarNotaLinea(key, notas) {
        notas = String(notas || '').trim().replace(/\s+/g, ' ');
        const items = carrito();
        const it = items.find(i => i.key === key);
        if (!it) return;
        const nuevaKey = it.platilloId + '|' + normalizar(notas);
        const duplicada = items.find(i => i.key === nuevaKey && i !== it);
        if (duplicada) {
            duplicada.cantidad = Math.min(99, duplicada.cantidad + it.cantidad);
            setCarrito(items.filter(i => i !== it), it.platilloId);
        } else {
            it.notas = notas;
            it.key = nuevaKey;
            setCarrito(items, it.platilloId);
        }
        QUI.toast(notas ? 'Nota guardada para cocina.' : 'Nota eliminada.', 'success', { icon: 'notebook-pen', duration: 1800 });
    }

    function editarNotaLinea(key) {
        const it = carrito().find(i => i.key === key);
        if (!it) return;
        const p = q.platillo(S(), it.platilloId);
        const modal = QUI.openModal({
            title: 'Nota para cocina',
            size: 'sm',
            className: 'nota-modal',
            body: '<p class="nota-modal__platillo">' + QUI.icon('utensils') + '<span><b>' + esc(p ? p.nombre : 'Platillo') + '</b> · ' +
                    it.cantidad + (it.cantidad === 1 ? ' pieza' : ' piezas') + '</span></p>' +
                  chipsNotasHTML(it.notas, p && p.categoriaId) +
                  '<textarea id="nota-linea" class="q-textarea" maxlength="140" placeholder="Ej. Sin cebolla, salsa aparte…">' + esc(it.notas) + '</textarea>' +
                  '<p class="q-hint">La nota viaja a cocina junto con este platillo.</p>',
            footer: (it.notas ? '<button class="q-btn q-btn--ghost nota-modal__quitar" id="quitar-nota">' + QUI.icon('trash-2') + ' Quitar nota</button>' : '') +
                    '<button class="q-btn q-btn--ghost" data-close>Cancelar</button>' +
                    '<button class="q-btn q-btn--primary" id="guardar-nota">' + QUI.icon('check') + ' Guardar nota</button>'
        });
        const textarea = modal.$('#nota-linea');
        enlazarNotasRapidas(modal.el, textarea);
        const aplicar = (notas) => { modal.close(); guardarNotaLinea(key, notas); };
        modal.$('#guardar-nota').addEventListener('click', () => aplicar(textarea.value));
        const quitar = modal.$('#quitar-nota');
        if (quitar) quitar.addEventListener('click', () => aplicar(''));
        if (!QUI.esMovil()) textarea.focus();
    }

    function destinoCarrito() {
        const barra = $('#btn-barra-pedido');
        if (barra && barra.classList.contains('is-visible')) return barra.querySelector('.barra-pedido__icono') || barra;
        return $('#btn-carrito');
    }

    function animarVuelo(origenEl, platillo) {
        const destino = destinoCarrito();
        if (!origenEl || !destino || !hayGsap() || reducir()) { QUI.pulse(destino); return; }
        const a = origenEl.getBoundingClientRect();
        const b = destino.getBoundingClientRect();
        const dot = document.createElement('div');
        dot.className = 'fly-dot';
        dot.innerHTML = QUI.imgTag(platillo.imagen, '', '', { ancho: 120 });
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

    /* ---------------- Catálogo ---------------- */
    function platillosOrdenados() {
        const s = S();
        const orden = {};
        q.categoriasOrdenadas(s).forEach((c, i) => { orden[c.id] = i; });
        return s.platillos.slice().sort((a, b) => (orden[a.categoriaId] ?? 99) - (orden[b.categoriaId] ?? 99));
    }

    // Cada término debe coincidir con el inicio de una palabra ("ram" encuentra "ramen", pero "ramen" no encuentra "ligeramente")
    function coincideBusqueda(p, conCategoria) {
        if (!ui.busqueda) return true;
        const cat = conCategoria ? q.categoria(S(), p.categoriaId) : null;
        const palabras = normalizar(p.nombre + ' ' + p.descripcion + ' ' + (cat ? cat.nombre : '')).split(/[^a-z0-9]+/);
        return ui.busqueda.split(/[^a-z0-9]+/).filter(Boolean).every(t => palabras.some(w => w.startsWith(t)));
    }

    /* Busca primero en nombre e ingredientes; si nada coincide, también en el nombre de la categoría
       ("ramen" muestra el ramen, "sushi" muestra toda la categoría de makis) */
    function idsBusqueda() {
        const s = S();
        let lista = s.platillos.filter(p => coincideBusqueda(p, false));
        if (!lista.length) lista = s.platillos.filter(p => coincideBusqueda(p, true));
        return new Set(lista.map(p => p.id));
    }

    // Solo se reconstruye el DOM del menú cuando cambia algo que se ve en las tarjetas
    function firmaMenu() {
        const s = S();
        return JSON.stringify([
            q.categoriasOrdenadas(s).map(c => [c.id, c.nombre, c.icono]),
            s.platillos.map(p => [p.id, p.nombre, p.descripcion, p.precio, p.precioAnterior, p.categoriaId, p.imagen, p.disponible, p.destacado, p.tiempo])
        ]);
    }

    /* ---------------- Render: header ---------------- */
    function renderHeader() {
        const n = S().negocio;
        const logo = $('#header-logo');
        if (!logo) return;
        logo.src = QStore.resolveAsset(n.logo);
        logo.alt = n.nombre;
        logo.onerror = () => { logo.onerror = null; logo.src = QStore.PLACEHOLDER; };
        $('#header-nombre').textContent = n.nombre;
        const estado = $('#header-estado');
        estado.innerHTML = '<span class="dot ' + (n.abierto ? 'dot--open' : 'dot--closed') + '"></span>' + (n.abierto ? 'Abierto' : 'Cerrado');
        estado.classList.toggle('is-cerrado', !n.abierto);
        document.title = 'Menú | ' + n.nombre;
    }

    /* ---------------- Render: carrusel promocional (Swiper) ---------------- */
    function slidesHero() {
        const s = S();
        const n = s.negocio;
        const slides = [{
            tipo: 'marca',
            imagen: n.portada,
            etiquetas: [{ tono: 'oro', icono: n.abierto ? 'circle-check' : 'circle-x', texto: n.nombre + (n.abierto ? '' : ' · Cerrado por ahora') }],
            titulo: 'Comida que se siente <em>Q-RICO</em>',
            texto: n.eslogan || ''
        }];
        s.platillos.filter(p => p.destacado && p.disponible).slice(0, 3).forEach(p => {
            const d = descuento(p);
            slides.push({
                tipo: 'platillo',
                id: p.id,
                imagen: p.imagen,
                etiquetas: [{ tono: 'oro', icono: 'star', texto: 'Favorito de la casa' }]
                    .concat(d ? [{ tono: 'coral', icono: 'tag', texto: '-' + d + '% hoy' }] : []),
                titulo: esc(p.nombre),
                texto: p.descripcion,
                precio: money(p.precio),
                precioAnterior: d ? money(p.precioAnterior) : ''
            });
        });
        return slides;
    }

    function slideHeroHTML(sl, i) {
        const etiquetas = '<div class="slide__etiquetas">' + sl.etiquetas.map(e =>
            '<span class="slide__eyebrow slide__eyebrow--' + e.tono + '">' + QUI.icon(e.icono) + esc(e.texto) + '</span>'
        ).join('') + '</div>';
        const titulo = sl.tipo === 'marca' ? '<h1 class="slide__titulo">' + sl.titulo + '</h1>' : '<h2 class="slide__titulo">' + sl.titulo + '</h2>';
        const acciones = sl.tipo === 'platillo'
            ? '<div class="slide__cta">' +
                '<div class="slide__precio"><span class="q-mono">' + sl.precio + '</span>' + (sl.precioAnterior ? '<s class="q-mono">' + sl.precioAnterior + '</s>' : '') + '</div>' +
                '<button type="button" class="slide__link" data-open="' + sl.id + '">Ver detalle</button>' +
                '<button type="button" class="btn-ordena btn-ordena--hero" data-add="' + sl.id + '" data-vuelo>' + QUI.icon('plus') + 'Agregar</button>' +
              '</div>'
            : '<div class="slide__cta"><button type="button" class="btn-ordena btn-ordena--hero" data-ir-menu>' + QUI.icon('utensils') + 'Ver el menú</button></div>';
        return '<div class="swiper-slide slide slide--' + sl.tipo + '">' +
            '<div class="slide__media">' + QUI.imgTag(sl.imagen, '', '', { ancho: 1400, prioridad: i === 0 }) + '</div>' +
            '<div class="slide__texto">' + etiquetas + titulo + (sl.texto ? '<p class="slide__desc">' + esc(sl.texto) + '</p>' : '') + acciones + '</div>' +
        '</div>';
    }

    function renderHero() {
        const slides = slidesHero();
        const firma = JSON.stringify(slides);
        if (firma === ui.firmaHero) return;
        ui.firmaHero = firma;
        if (ui.swiperHero) { ui.swiperHero.destroy(true, true); ui.swiperHero = null; }
        $('#hero-slides').innerHTML = slides.map(slideHeroHTML).join('');
        const multiples = slides.length > 1;
        $('#hero-prev').hidden = !multiples;
        $('#hero-next').hidden = !multiples;
        $('#hero-puntos').hidden = !multiples;
        QUI.icons($('#hero'));
        if (typeof Swiper === 'undefined') { $('#hero').classList.add('sin-swiper'); return; }
        ui.swiperHero = new Swiper('#hero-swiper', {
            effect: 'creative',
            creativeEffect: {
                limitProgress: 2,
                prev: { translate: ['-22%', 0, -1], opacity: 0.5 },
                next: { translate: ['100%', 0, 0] }
            },
            loop: slides.length > 2,
            speed: 750,
            grabCursor: multiples,
            allowTouchMove: multiples,
            autoplay: multiples && !reducir() ? { delay: HERO_INTERVALO, disableOnInteraction: false, pauseOnMouseEnter: true } : false,
            pagination: { el: '#hero-puntos', clickable: true, bulletClass: 'punto', bulletActiveClass: 'activo' },
            navigation: { prevEl: '#hero-prev', nextEl: '#hero-next' },
            a11y: A11Y_SWIPER,
            on: { slideChangeTransitionStart: animarTextoHero }
        });
    }

    function animarTextoHero() {
        if (!hayGsap() || reducir()) return;
        const sw = ui.swiperHero;
        const activa = sw && sw.slides ? sw.slides[sw.activeIndex] : $('#hero-slides .swiper-slide');
        const texto = activa && activa.querySelector('.slide__texto');
        if (texto) gsap.fromTo(texto.children, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.07, ease: 'power3.out', delay: 0.12, overwrite: true });
    }

    /* Parallax suave de la foto del banner al desplazarse (la variable se lee en menu.css) */
    function iniciarParallaxHero() {
        const hero = $('#hero');
        if (!hero || !hayScrollTrigger() || reducir()) return;
        ScrollTrigger.create({
            trigger: hero,
            start: 0,
            end: () => hero.offsetTop + hero.offsetHeight,
            onUpdate: self => hero.style.setProperty('--hero-parallax', (self.progress * 56).toFixed(1) + 'px')
        });
    }

    /* ---------------- Render: cintilla compacta ---------------- */
    function renderCintilla() {
        const n = S().negocio;
        const pills = [];
        if (n.horario) pills.push('<span class="cintilla__pill">' + QUI.icon('clock') + '<span>' + esc(n.horario) + '</span></span>');
        if (n.direccion) pills.push('<a class="cintilla__pill cintilla__pill--accion" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(n.direccion) + '" target="_blank" rel="noopener" title="' + esc(n.direccion) + '">' + QUI.icon('map-pin') + '<span>Cómo llegar</span></a>');
        if (n.wifi && n.wifi.red) pills.push('<button type="button" class="cintilla__pill cintilla__pill--accion" data-copiar-wifi>' + QUI.icon('wifi') + '<span>WiFi: copiar clave</span></button>');
        const cont = $('#cintilla-info');
        cont.hidden = !pills.length;
        cont.innerHTML = '<div class="cintilla__inner">' + pills.join('') + '</div>';
        QUI.icons(cont);
    }

    function copiarWifi() {
        const w = S().negocio.wifi || {};
        const clave = w.clave || '';
        if (!clave) { QUI.toast('La red ' + (w.red || 'del restaurante') + ' no tiene clave.', 'info', { icon: 'wifi' }); return; }
        const avisar = (copiada) => QUI.toast(copiada ? 'Clave copiada. Red: ' + (w.red || '') : 'Clave del WiFi: ' + clave, copiada ? 'success' : 'info', { icon: 'wifi', title: copiada ? clave : '' });
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(clave).then(() => avisar(true), () => avisar(false));
        else avisar(false);
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

    /* ---------------- Render: menú (chips, favoritos y bandas) ---------------- */
    function seccionesMenu() {
        const s = S();
        const lista = [];
        if (s.platillos.some(p => p.destacado && p.disponible)) lista.push({ id: 'sec-favoritos', nombre: 'Favoritos', icono: 'star' });
        q.categoriasOrdenadas(s).forEach(c => {
            if (s.platillos.some(p => p.categoriaId === c.id)) lista.push({ id: 'sec-' + c.id, nombre: c.nombre, icono: c.icono || 'utensils' });
        });
        return lista;
    }

    function renderChips() {
        const cont = $('#chips-categorias');
        if (!cont) return;
        cont.innerHTML = '<span class="catbar__pill" id="catbar-pill" aria-hidden="true"></span>' + seccionesMenu().map(sec =>
            '<button type="button" class="catbar__chip" data-target="' + sec.id + '">' + QUI.icon(sec.icono) + '<span>' + esc(sec.nombre) + '</span></button>'
        ).join('');
        QUI.icons(cont);
        ui.chipActivo = null;
        actualizarSombrasChips();
    }

    function tarjetaFavorito(p) {
        const cat = q.categoria(S(), p.categoriaId);
        const d = descuento(p);
        return plantilla(plantillas.card, {
            id: p.id,
            clase: p.disponible ? '' : 'is-soldout',
            imagen: QUI.imgTag(p.imagen, p.nombre, '', { ancho: 640 }),
            badge: d ? '<span class="badge-esquina badge-esquina--descuento">-' + d + '%</span>' : '',
            categoria: esc(cat ? cat.nombre : ''),
            nombre: esc(p.nombre),
            precio: money(p.precio),
            precioAnterior: precioAnteriorHTML(p)
        });
    }

    function renderFavoritos() {
        const favoritos = platillosOrdenados().filter(p => p.destacado && p.disponible);
        const seccion = $('#sec-favoritos');
        seccion.dataset.hayFavoritos = favoritos.length ? '1' : '';
        if (ui.swiperFavoritos) { ui.swiperFavoritos.destroy(true, true); ui.swiperFavoritos = null; }
        $('#contenedor-favoritos').innerHTML = favoritos.map(tarjetaFavorito).join('');
        QUI.icons(seccion);
        const sinSwiper = typeof Swiper === 'undefined';
        seccion.classList.toggle('sin-swiper', sinSwiper);
        if (!favoritos.length || sinSwiper) return;
        ui.swiperFavoritos = new Swiper('#favoritos-swiper', {
            effect: 'coverflow',
            centeredSlides: true,
            slidesPerView: 'auto',
            initialSlide: Math.min(1, favoritos.length - 1),
            slideToClickedSlide: true,
            grabCursor: true,
            speed: 600,
            observer: true,
            observeParents: true,
            coverflowEffect: { rotate: 10, stretch: 0, depth: 120, modifier: 1, scale: 0.94, slideShadows: false },
            pagination: { el: '#favoritos-puntos', clickable: true, dynamicBullets: true, dynamicMainBullets: 3 },
            navigation: { prevEl: '#fav-prev', nextEl: '#fav-next' },
            keyboard: { enabled: true, onlyInViewport: true },
            // Sin etiqueta "1 de 7": cada tarjeta ya anuncia el nombre y el precio del platillo
            a11y: Object.assign({}, A11Y_SWIPER, { slideLabelMessage: '' }),
            breakpoints: { 0: { spaceBetween: 6 }, 768: { spaceBetween: 20 } }
        });
    }

    function tarjetaCuadro(p) {
        // Una sola etiqueta por tarjeta: agotado, descuento o popular
        const d = descuento(p);
        let etiqueta = '';
        if (!p.disponible) etiqueta = '<span class="etiqueta etiqueta--agotado">' + QUI.icon('ban') + 'Agotado</span>';
        else if (d) etiqueta = '<span class="etiqueta etiqueta--descuento">-' + d + '%</span>';
        else if (p.destacado) etiqueta = '<span class="etiqueta etiqueta--popular">' + QUI.icon('flame') + 'Popular</span>';
        return plantilla(plantillas.cuadro, {
            id: p.id,
            clase: p.disponible ? '' : 'is-soldout',
            etiqueta,
            nombre: esc(p.nombre),
            descripcion: esc(p.descripcion),
            precio: money(p.precio),
            precioAnterior: precioAnteriorHTML(p),
            imagen: QUI.imgTag(p.imagen, p.nombre, '', { ancho: 360 })
        });
    }

    function renderSecciones() {
        const s = S();
        const orden = platillosOrdenados();
        $('#contenedor-secciones').innerHTML = q.categoriasOrdenadas(s).map(c => {
            const lista = orden.filter(p => p.categoriaId === c.id);
            if (!lista.length) return '';
            return '<section class="banda categoria-bloque" id="sec-' + c.id + '" data-seccion aria-labelledby="titulo-' + c.id + '">' +
                '<div class="seccion-interior">' +
                    '<h2 class="categoria-titulo" id="titulo-' + c.id + '">' + QUI.icon(c.icono || 'utensils') +
                        '<span class="categoria-titulo__nombre">' + esc(c.nombre) + '</span>' +
                        '<span class="categoria-titulo__conteo" data-conteo>' + conteoTexto(lista.length) + '</span>' +
                    '</h2>' +
                    '<div class="cuadricula-productos">' + lista.map(tarjetaCuadro).join('') + '</div>' +
                '</div>' +
            '</section>';
        }).join('');
        QUI.icons($('#contenedor-secciones'));
    }

    // Alternancia blanco / crema calculada solo con las bandas visibles (cambia al buscar)
    function recolorearBandas() {
        $$('#contenedor-secciones .categoria-bloque:not([hidden])').forEach((sec, i) => {
            sec.classList.toggle('banda--crema', i % 2 === 0);
            sec.classList.toggle('banda--blanco', i % 2 !== 0);
        });
    }

    function renderMenu(forzar) {
        const firma = firmaMenu();
        if (!forzar && firma === ui.firmaMenu) { actualizarControles(); return; }
        const primeraVez = !ui.firmaMenu;
        revelarTodo();
        ui.firmaMenu = firma;
        renderChips();
        renderFavoritos();
        renderSecciones();
        aplicarBusqueda(false);
        actualizarControles();
        if (primeraVez) animarEntradaMenu();
        else if (hayScrollTrigger()) ScrollTrigger.refresh();
        actualizarSpy(true);
    }

    /* ---------------- Botón "+" que se transforma en contador "− 1 +" ---------------- */
    function controlTarjetaHTML(p, n, variante) {
        const nombre = esc(p.nombre);
        if (!p.disponible) {
            return variante === 'pill'
                ? '<span class="btn-agotado">' + QUI.icon('ban') + 'Agotado</span>'
                : '<button type="button" class="btn-agregar" disabled aria-label="' + nombre + ' está agotado">' + QUI.icon('ban') + '</button>';
        }
        if (!n) {
            return variante === 'pill'
                ? '<button type="button" class="btn-agregar-pill" data-add="' + p.id + '" aria-label="Agregar ' + nombre + '">' + QUI.icon('plus') + '<span>Agregar</span></button>'
                : '<button type="button" class="btn-agregar" data-add="' + p.id + '" aria-label="Agregar ' + nombre + '">' + QUI.icon('plus') + '</button>';
        }
        return '<div class="stepper-tarjeta' + (variante === 'pill' ? ' stepper-tarjeta--pill' : '') + '" role="group" aria-label="' + nombre + ' en tu pedido">' +
            '<button type="button" data-restar="' + p.id + '" aria-label="Quitar un ' + nombre + '">' + QUI.icon(n === 1 ? 'trash-2' : 'minus') + '</button>' +
            '<span class="stepper-tarjeta__n q-mono" aria-live="polite">' + n + '</span>' +
            '<button type="button" data-add="' + p.id + '" aria-label="Agregar otro ' + nombre + '">' + QUI.icon('plus') + '</button>' +
        '</div>';
    }

    function actualizarControles(platilloCambiado) {
        const s = S();
        const cantidades = cantidadesPorPlatillo();
        $$('[data-control]').forEach(el => {
            const p = q.platillo(s, el.dataset.control);
            if (!p) return;
            const n = cantidades[p.id] || 0;
            const estado = (p.disponible ? 'd' : 'a') + n;
            if (el.dataset.estado === estado) return;
            const antes = el.dataset.estado ? Number(el.dataset.estado.slice(1)) : n;
            const anchoPrevio = el.firstElementChild ? el.firstElementChild.offsetWidth : 0;
            el.dataset.estado = estado;
            el.innerHTML = controlTarjetaHTML(p, n, el.dataset.variante);
            QUI.icons(el);
            if (p.id === platilloCambiado) animarControl(el, antes, n, anchoPrevio);
        });
    }

    function animarControl(el, antes, n, anchoPrevio) {
        const hijo = el.firstElementChild;
        if (!hijo || !hayGsap() || reducir()) return;
        if (antes === 0 && n > 0) {
            // Rebote elástico: el "+" se estira hasta convertirse en el contador
            const ancho = hijo.offsetWidth;
            gsap.set(hijo, { overflow: 'hidden' });
            gsap.fromTo(hijo, { width: anchoPrevio || 44 }, { width: ancho, duration: 0.55, ease: 'back.out(1.8)', clearProps: 'width,overflow' });
            gsap.fromTo(hijo.querySelector('.stepper-tarjeta__n'), { scale: 0.3 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.45)' });
        } else if (n > 0) {
            const num = hijo.querySelector('.stepper-tarjeta__n');
            gsap.fromTo(num, { yPercent: n > antes ? -70 : 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
            const btn = hijo.querySelector(n > antes ? '[data-add]' : '[data-restar]');
            if (btn) gsap.fromTo(btn, { scale: 0.72 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1.1, 0.4)' });
        } else {
            gsap.fromTo(hijo, { scale: 0.6, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)', clearProps: 'transform' });
        }
    }

    /* ---------------- Búsqueda con reacomodo animado (GSAP Flip) ---------------- */
    function aplicarBusqueda(animar) {
        const tarjetas = $$('#contenedor-secciones .cuadro-platillo');
        const conFlip = animar && hayFlip() && !reducir();
        const estado = conFlip ? Flip.getState(tarjetas) : null;
        const ids = idsBusqueda();
        let visibles = 0;
        tarjetas.forEach(t => {
            const ok = ids.has(t.dataset.platillo);
            t.hidden = !ok;
            if (ok) visibles++;
        });
        $$('#contenedor-secciones .categoria-bloque').forEach(sec => {
            const n = sec.querySelectorAll('.cuadro-platillo:not([hidden])').length;
            sec.hidden = n === 0;
            const conteo = sec.querySelector('[data-conteo]');
            if (conteo) conteo.textContent = conteoTexto(n);
        });
        const fav = $('#sec-favoritos');
        fav.hidden = !!ui.busqueda || !fav.dataset.hayFavoritos;
        $('#sin-resultados').hidden = visibles > 0;
        recolorearBandas();
        if (estado) {
            Flip.from(estado, {
                duration: 0.55,
                ease: 'power3.inOut',
                stagger: 0.012,
                prune: true,
                onEnter: els => gsap.fromTo(els, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out', clearProps: 'opacity,transform' }),
                onComplete: () => { if (hayScrollTrigger()) ScrollTrigger.refresh(); }
            });
        } else if (hayScrollTrigger()) {
            ScrollTrigger.refresh();
        }
    }

    function buscar(texto) {
        ui.busqueda = normalizar(texto);
        revelarTodo();
        aplicarBusqueda(true);
        $('#btn-abrir-buscador').classList.toggle('is-activa', !!ui.busqueda);
        // Si la barra ya está fija, la vista sube al inicio de los resultados
        if ($('#contenedor-sidebar').classList.contains('is-stuck')) {
            const primera = $$('#contenedor-secciones .categoria-bloque').find(sec => !sec.hidden) || $('#sin-resultados');
            desplazarA(primera);
        }
        actualizarSpy();
    }

    function abrirBuscadorMovil() {
        $('#catbar').classList.add('is-buscando');
        $('#btn-abrir-buscador').setAttribute('aria-expanded', 'true');
        $('#buscador-limpiar').hidden = false;
        $('#buscador').focus();
    }

    function limpiarBusqueda(cerrar) {
        const input = $('#buscador');
        input.value = '';
        const catbar = $('#catbar');
        if (cerrar) {
            catbar.classList.remove('is-buscando');
            $('#btn-abrir-buscador').setAttribute('aria-expanded', 'false');
        }
        $('#buscador-limpiar').hidden = !catbar.classList.contains('is-buscando');
        if (ui.busqueda) buscar('');
    }

    /* ---------------- Chips con indicador deslizante + ScrollSpy ---------------- */
    function actualizarSpy(inmediato) {
        if (ui.spyBloqueado) return;
        const visibles = $$('[data-seccion]').filter(sec => !sec.hidden && sec.offsetHeight);
        if (!visibles.length) { marcarChip(null, inmediato); return; }
        const limite = alturaHeader() + alturaCatbar() + 24;
        let activa = visibles[0];
        visibles.forEach(sec => { if (sec.getBoundingClientRect().top <= limite) activa = sec; });
        marcarChip(activa.id, inmediato);
    }

    function marcarChip(id, inmediato) {
        const chips = $$('#chips-categorias .catbar__chip');
        const chip = chips.find(c => c.dataset.target === id) || null;
        if (id === ui.chipActivo && !inmediato) return;
        ui.chipActivo = id;
        chips.forEach(c => {
            const activo = c === chip;
            c.classList.toggle('is-active', activo);
            if (activo) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
        });
        moverPill(chip, inmediato);
        if (chip) centrarChip(chip, inmediato);
    }

    function moverPill(chip, inmediato) {
        const pill = $('#catbar-pill');
        if (!pill) return;
        if (!chip) { pill.style.opacity = '0'; return; }
        const destino = { x: chip.offsetLeft, y: chip.offsetTop, width: chip.offsetWidth, height: chip.offsetHeight, opacity: 1 };
        if (!hayGsap()) {
            pill.style.cssText = 'opacity:1;width:' + destino.width + 'px;height:' + destino.height + 'px;transform:translate(' + destino.x + 'px,' + destino.y + 'px)';
            return;
        }
        if (inmediato || reducir() || pill.dataset.listo !== '1') {
            gsap.set(pill, destino);
            pill.dataset.listo = '1';
        } else {
            gsap.to(pill, Object.assign({ duration: 0.5, ease: 'power3.out', overwrite: true }, destino));
        }
    }

    function centrarChip(chip, inmediato) {
        const pista = $('#chips-categorias');
        if (!pista || pista.scrollWidth <= pista.clientWidth) return;
        const destino = chip.offsetLeft - (pista.clientWidth - chip.offsetWidth) / 2;
        pista.scrollTo({ left: Math.max(0, destino), behavior: inmediato || reducir() ? 'auto' : 'smooth' });
    }

    // Degradados laterales (y flechas en escritorio) solo del lado donde aún hay chips por deslizar
    function actualizarSombrasChips() {
        const pista = $('#chips-categorias');
        if (!pista) return;
        const izq = pista.scrollLeft > 4;
        const der = pista.scrollLeft + pista.clientWidth < pista.scrollWidth - 4;
        pista.classList.toggle('hay-izq', izq);
        pista.classList.toggle('hay-der', der);
        // Las flechas solo tienen sentido con ratón; en pantallas táctiles los chips se deslizan con el dedo
        const conRaton = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        $('#chips-prev').hidden = !(conRaton && izq);
        $('#chips-next').hidden = !(conRaton && der);
    }

    function desplazarChips(sentido) {
        const pista = $('#chips-categorias');
        pista.scrollBy({ left: sentido * Math.max(160, pista.clientWidth * 0.6), behavior: reducir() ? 'auto' : 'smooth' });
    }

    function irASeccion(id) {
        const destino = document.getElementById(id);
        if (!destino) return;
        if (destino.hidden && ui.busqueda) limpiarBusqueda(true);
        clearTimeout(ui.spyTimer);
        ui.spyBloqueado = true;
        ui.chipActivo = null;
        marcarChip(id);
        const liberar = () => { clearTimeout(ui.spyTimer); ui.spyBloqueado = false; actualizarSpy(); };
        desplazarA(destino, { alTerminar: liberar });
        ui.spyTimer = setTimeout(liberar, 1800);
    }

    function irAlMenu() {
        const primera = $$('[data-seccion]').find(sec => !sec.hidden);
        if (primera) irASeccion(primera.id);
    }

    /* ---------------- Animaciones de entrada (ScrollTrigger) ---------------- */
    function animarEntradaMenu() {
        if (!hayScrollTrigger() || reducir()) return;
        const tarjetas = $$('#contenedor-secciones .cuadro-platillo');
        const titulos = $$('#contenedor-secciones .categoria-titulo');
        gsap.set(tarjetas, { autoAlpha: 0, y: 26 });
        gsap.set(titulos, { autoAlpha: 0, x: -18 });
        ui.revelados = [].concat(
            ScrollTrigger.batch(tarjetas, {
                start: 'top 92%',
                once: true,
                onEnter: lote => gsap.to(lote, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity,visibility' })
            }),
            ScrollTrigger.batch(titulos, {
                start: 'top 92%',
                once: true,
                onEnter: lote => gsap.to(lote, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity,visibility' })
            })
        );
        const fav = $('#sec-favoritos');
        if (fav && !fav.hidden) {
            gsap.from('#sec-favoritos .seccion-cabecera, #sec-favoritos .favoritos-carrusel', {
                autoAlpha: 0, y: 30, duration: 0.8, stagger: 0.12, ease: 'power3.out', clearProps: 'transform,opacity,visibility',
                scrollTrigger: { trigger: fav, start: 'top 88%', once: true }
            });
        }
    }

    // Muestra de inmediato lo que aún no aparecía (al buscar o al reconstruir el menú)
    function revelarTodo() {
        ui.revelados.forEach(t => t.kill());
        ui.revelados = [];
        if (hayGsap()) gsap.set($$('#contenedor-secciones .cuadro-platillo, #contenedor-secciones .categoria-titulo'), { clearProps: 'transform,opacity,visibility' });
    }

    function iniciarAnimaciones() {
        if (hayScrollTrigger()) gsap.registerPlugin(ScrollTrigger);
        if (hayFlip()) gsap.registerPlugin(Flip);
        if (reducir() || typeof Lenis === 'undefined') return;
        // Desplazamiento suave e inercial solo con rueda/trackpad; en pantallas táctiles se respeta el scroll nativo
        ui.lenis = new Lenis({ lerp: 0.11, smoothWheel: true, syncTouch: false, anchors: false, autoRaf: !hayGsap() });
        if (hayGsap()) {
            gsap.ticker.add(t => ui.lenis.raf(t * 1000));
            gsap.ticker.lagSmoothing(0);
        }
        if (hayScrollTrigger()) ui.lenis.on('scroll', ScrollTrigger.update);
        // Mientras haya un modal o el drawer abierto, Lenis se detiene y el scroll interno es nativo
        new MutationObserver(() => {
            if (document.body.classList.contains('q-no-scroll')) ui.lenis.stop(); else ui.lenis.start();
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    /* ---------------- Notas rápidas para cocina ---------------- */
    function notasDe(categoriaId) {
        return NOTAS_POR_CATEGORIA[categoriaId] || NOTAS_GENERALES;
    }

    function chipsNotasHTML(notasActuales, categoriaId) {
        const activas = String(notasActuales || '').split(',').map(normalizar);
        return '<div class="note-chips">' + notasDe(categoriaId).map(n =>
            '<button type="button" class="note-chip' + (activas.includes(normalizar(n)) ? ' is-active' : '') + '" data-nota="' + esc(n) + '">' + esc(n) + '</button>'
        ).join('') + '</div>';
    }

    // Cada chip agrega o quita su texto de la nota, separado por comas
    function enlazarNotasRapidas(root, textarea) {
        root.querySelectorAll('.note-chip').forEach(ch => ch.addEventListener('click', () => {
            const n = ch.dataset.nota;
            const partes = textarea.value.split(',').map(x => x.trim()).filter(Boolean);
            const idx = partes.findIndex(x => normalizar(x) === normalizar(n));
            if (idx >= 0) partes.splice(idx, 1); else partes.push(n);
            textarea.value = partes.join(', ');
            ch.classList.toggle('is-active', idx < 0);
        }));
    }

    /* ---------------- Modal de platillo (hoja inferior en móvil) ---------------- */
    function abrirPlatillo(id) {
        const s = S();
        const p = q.platillo(s, id);
        if (!p) return;
        const cat = q.categoria(s, p.categoriaId);
        const d = descuento(p);
        let cantidad = 1;
        const body =
            '<div class="dish-modal__media">' + QUI.imgTag(p.imagen, p.nombre, '', { ancho: 900 }) +
                '<button class="q-icon-btn dish-modal__close" data-close aria-label="Cerrar">' + QUI.icon('x') + '</button>' +
                (p.disponible ? '' : '<span class="dish-modal__soldout">' + QUI.icon('ban') + 'Agotado por hoy</span>') +
            '</div>' +
            '<div class="dish-modal__content">' +
                '<div class="dish-modal__badges">' +
                    (cat ? '<span class="q-badge q-badge--neutral">' + QUI.icon(cat.icono || 'utensils') + esc(cat.nombre) + '</span>' : '') +
                    (d ? '<span class="q-badge q-badge--coral">-' + d + '%</span>' : '') +
                    '<span class="q-badge q-badge--neutral">' + QUI.icon('timer') + p.tiempo + ' min</span>' +
                '</div>' +
                '<h3 class="dish-modal__title">' + esc(p.nombre) + '</h3>' +
                '<p class="dish-modal__desc">' + esc(p.descripcion) + '</p>' +
                '<div class="dish-modal__prices"><span class="dish-modal__price q-mono">' + money(p.precio) + '</span>' + precioAnteriorHTML(p) + '</div>' +
                '<div class="dish-modal__notes">' +
                    '<label class="q-label" for="nota-platillo">' + QUI.icon('notebook-pen') + ' Indicaciones para cocina</label>' +
                    chipsNotasHTML('', p.categoriaId) +
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
        enlazarNotasRapidas(modal.el, nota);
        modal.$('#btn-agregar-modal').addEventListener('click', (e) => {
            if (agregarAlCarrito(p.id, cantidad, nota.value, e.currentTarget, true)) {
                QUI.toast(cantidad + ' × ' + p.nombre + ' agregado a tu pedido.', 'success', { icon: 'shopping-bag', duration: 2200 });
            }
            modal.close();
        });
    }

    /* ---------------- Modales informativos (header y footer) ---------------- */
    function abrirInfo(tipo) {
        const s = S();
        const n = s.negocio;
        const contacto = (n.telefono ? 'al <b>' + esc(n.telefono) + '</b>' : 'con nuestro personal') + (n.direccion ? ' o visítanos en <b>' + esc(n.direccion) + '</b>' : '');
        const maps = n.direccion ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(n.direccion) : '';
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
            ubicacion: {
                titulo: 'Ubicación y WiFi',
                body: '<ul class="info-modal__lista">' +
                        (n.direccion ? '<li>' + QUI.icon('map-pin') + '<span>' + esc(n.direccion) + '</span></li>' : '') +
                        (n.horario ? '<li>' + QUI.icon('clock') + '<span>' + esc(n.horario) + '</span></li>' : '') +
                        (n.telefono ? '<li>' + QUI.icon('phone') + '<a href="tel:' + esc(n.telefono.replace(/[^\d+]/g, '')) + '">' + esc(n.telefono) + '</a></li>' : '') +
                    '</ul>' +
                    (maps ? '<a class="q-btn q-btn--outline q-btn--block info-modal__maps" href="' + maps + '" target="_blank" rel="noopener">' + QUI.icon('navigation') + 'Abrir en Google Maps</a>' : '') +
                    (n.wifi && n.wifi.red
                        ? '<div class="wifi-card">' + QUI.icon('wifi') +
                            '<div class="wifi-card__datos"><small>Red</small><strong>' + esc(n.wifi.red) + '</strong>' +
                            (n.wifi.clave ? '<small>Clave</small><code class="q-mono">' + esc(n.wifi.clave) + '</code>' : '<small>Red abierta, sin clave</small>') + '</div>' +
                            (n.wifi.clave ? '<button type="button" class="q-btn q-btn--primary" data-copiar-wifi>' + QUI.icon('copy') + 'Copiar clave</button>' : '') +
                          '</div>'
                        : '')
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
                body: '<p class="info-modal__texto">Este menú digital no solicita datos personales. Tu nombre o referencia (opcional), la mesa del QR que escaneaste y tu pedido se guardan únicamente en este dispositivo para poder enviarlo a cocina.</p>' +
                    '<p class="info-modal__texto">Para consultar el aviso de privacidad integral de <b>' + esc(n.nombre) + '</b>, solicítalo ' + contacto + '.</p>'
            },
            terminos: {
                titulo: 'Términos y Condiciones',
                body: '<ul class="info-modal__lista">' +
                    '<li>' + QUI.icon('banknote') + 'Precios expresados en ' + esc(n.moneda || 'MXN') + '.</li>' +
                    '<li>' + QUI.icon('store') + 'Pedidos directos (para comer aquí o para llevar): pagas en caja al recogerlos.</li>' +
                    '<li>' + QUI.icon('receipt-text') + 'Pedidos desde el QR de tu mesa: pagas con tu mesero al pedir la cuenta.</li>' +
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
        if (destino === 'menu') { irAlMenu(); return; }
        abrirInfo(destino);
    }

    function cerrarMenuMovil() {
        const nav = $('#mobile-nav');
        if (!nav) return;
        nav.hidden = true;
        $('#btn-burger').setAttribute('aria-expanded', 'false');
    }

    /* ---------------- Drawer: pedido y cuenta de la mesa ---------------- */
    function abrirDrawer(tab) {
        if (tab) ui.tab = tab;
        ui.drawerAbierto = true;
        ui.ultimoFoco = document.activeElement;
        $('#drawer').classList.add('is-open');
        $('#drawer-overlay').classList.add('is-open');
        $('#drawer').setAttribute('aria-hidden', 'false');
        document.body.classList.add('q-no-scroll', 'drawer-abierto');
        renderDrawer();
        setTimeout(() => { if (ui.drawerAbierto) $('#btn-cerrar-drawer').focus({ preventScroll: true }); }, 60);
    }

    function cerrarDrawer() {
        if (!ui.drawerAbierto) return;
        ui.drawerAbierto = false;
        $('#drawer').classList.remove('is-open');
        $('#drawer-overlay').classList.remove('is-open');
        $('#drawer').setAttribute('aria-hidden', 'true');
        document.body.classList.remove('drawer-abierto');
        if (!document.querySelector('.q-modal-backdrop')) document.body.classList.remove('q-no-scroll');
        if (ui.ultimoFoco && document.contains(ui.ultimoFoco)) ui.ultimoFoco.focus({ preventScroll: true });
    }

    function propinaActual() {
        const n = S().negocio;
        return ui.propinaPct == null ? (n.propinaDefault || 0) : ui.propinaPct;
    }

    /* Vuelve a pintar el drawer sin perder el campo que el comensal estaba escribiendo */
    function conservarFoco(render) {
        const activo = document.activeElement;
        const id = activo && activo.id && $('#drawer').contains(activo) ? activo.id : null;
        const seleccion = id && typeof activo.selectionStart === 'number' ? [activo.selectionStart, activo.selectionEnd] : null;
        render();
        if (!id) return;
        const nuevo = document.getElementById(id);
        if (nuevo && nuevo !== activo) {
            nuevo.focus({ preventScroll: true });
            if (seleccion && nuevo.setSelectionRange) nuevo.setSelectionRange(seleccion[0], seleccion[1]);
        }
    }

    function renderDrawer() {
        const mesa = mesaActual();
        if (!mesa) ui.tab = 'carrito';
        // Mesa del QR o pedido directo: solo un distintivo informativo
        $('#drawer-modo').innerHTML = mesa
            ? QUI.icon('armchair') + 'Mesa ' + esc(mesa.numero) + ' · ' + esc(mesa.zona)
            : QUI.icon('store') + 'Pedido directo';
        $('#drawer-modo').classList.toggle('drawer__modo--mesa', !!mesa);
        $('#drawer-tabs').hidden = !mesa;
        $$('#drawer-tabs button').forEach(b => b.classList.toggle('is-active', b.dataset.tab === ui.tab));
        $('#drawer-titulo').textContent = ui.tab === 'carrito' ? 'Tu pedido' : 'Cuenta de la mesa';
        conservarFoco(() => { if (ui.tab === 'carrito') renderTabCarrito(); else renderTabCuenta(); });
        QUI.icons($('#drawer'));
    }

    function lineaCarritoHTML(l) {
        const p = l.platillo;
        const it = l.item;
        if (!p) {
            return '<li class="cart-line is-missing"><div class="cart-line__info"><strong>Platillo retirado del menú</strong>' +
                '<span class="q-hint">Ya no está disponible.</span></div><button class="q-icon-btn q-icon-btn--danger" data-remove="' + esc(it.key) + '" aria-label="Quitar">' + QUI.icon('trash-2') + '</button></li>';
        }
        return '<li class="cart-line' + (p.disponible ? '' : ' is-missing') + '">' +
            '<div class="cart-line__img">' + QUI.imgTag(p.imagen, p.nombre, '', { ancho: 160 }) + '</div>' +
            '<div class="cart-line__info">' +
                '<strong>' + esc(p.nombre) + '</strong>' +
                (p.disponible
                    ? '<button type="button" class="cart-line__note' + (it.notas ? '' : ' cart-line__note--vacia') + '" data-nota-linea="' + esc(it.key) + '" title="Editar nota para cocina">' +
                        QUI.icon(it.notas ? 'notebook-pen' : 'plus') + '<span>' + (it.notas ? esc(it.notas) : 'Nota para cocina') + '</span></button>'
                    : (it.notas ? '<span class="cart-line__note">' + QUI.icon('notebook-pen') + '<span>' + esc(it.notas) + '</span></span>' : '') +
                      '<span class="q-badge q-badge--dark">Se agotó · no se enviará</span>') +
                '<div class="cart-line__row">' +
                    '<div class="qty-stepper">' +
                        '<button data-dec="' + esc(it.key) + '" aria-label="Menos">' + QUI.icon(it.cantidad === 1 ? 'trash-2' : 'minus') + '</button>' +
                        '<span class="q-mono">' + it.cantidad + '</span>' +
                        '<button data-inc="' + esc(it.key) + '" aria-label="Más">' + QUI.icon('plus') + '</button>' +
                    '</div>' +
                    '<span class="cart-line__price q-mono">' + money(p.precio * it.cantidad) + '</span>' +
                '</div>' +
            '</div></li>';
    }

    /* Datos opcionales del pedido: modalidad (solo sin mesa) y nombre o referencia */
    function detallesPedidoHTML(mesa) {
        const modalidad = modalidadActual();
        const opcion = (valor, icono, texto) =>
            '<button type="button" role="radio" data-modalidad="' + valor + '" aria-checked="' + (modalidad === valor) + '"' +
            (modalidad === valor ? ' class="is-active"' : '') + '>' + QUI.icon(icono) + texto + '</button>';
        return '<section class="detalles-pedido" aria-label="Detalles del pedido">' +
            (mesa ? '' :
                '<span class="q-label">¿Cómo lo quieres?</span>' +
                '<div class="q-segmented modalidad" role="radiogroup" aria-label="Modalidad del pedido">' +
                    opcion('mostrador', 'utensils', 'Para comer aquí') +
                    opcion('llevar', 'shopping-bag', 'Para llevar') +
                '</div>') +
            '<div class="q-field">' +
                '<label for="pedido-referencia">' + (mesa ? 'Tu nombre (opcional)' : 'Tu nombre o referencia (opcional)') + '</label>' +
                '<input class="q-input" id="pedido-referencia" maxlength="32" autocomplete="given-name" enterkeyhint="done" placeholder="' +
                    (mesa ? 'Ej. Sofía' : 'Ej. Mariana, chamarra roja…') + '" value="' + esc(nombreComensal()) + '">' +
                '<span class="q-hint">' + (mesa ? 'Ayuda a tu mesero a repartir los platillos.' : 'Así te llamamos cuando tu pedido esté listo.') + '</span>' +
            '</div>' +
        '</section>';
    }

    function renderTabCarrito() {
        const body = $('#drawer-body');
        const footer = $('#drawer-footer');
        const s = S();
        const lineas = lineasCarrito();
        if (!lineas.length) {
            body.innerHTML = '<div class="q-empty">' + QUI.icon('shopping-bag') +
                '<strong>Tu pedido está vacío</strong><span>Agrega platillos del menú y envíalos a cocina desde aquí.</span>' +
                '<button class="q-btn q-btn--outline" data-close-drawer>Explorar el menú</button></div>';
            footer.innerHTML = '';
            body.querySelector('[data-close-drawer]').addEventListener('click', () => { cerrarDrawer(); irAlMenu(); });
            return;
        }
        const mesa = mesaActual();
        body.innerHTML = '<ul class="cart-list">' + lineas.map(lineaCarritoHTML).join('') + '</ul>' + detallesPedidoHTML(mesa);

        const total = totalCarrito();
        const puedeEnviar = total > 0 && s.negocio.abierto;
        footer.innerHTML =
            '<div class="summary-row"><span>Subtotal</span><span class="q-mono">' + money(total) + '</span></div>' +
            '<button class="q-btn q-btn--primary q-btn--lg q-btn--block" id="btn-enviar-pedido"' + (puedeEnviar ? '' : ' disabled') + '>' +
                QUI.icon('chef-hat') + (mesa ? 'Enviar a cocina' : 'Enviar pedido') + ' · <span class="q-mono">' + money(total) + '</span></button>' +
            '<p class="q-hint drawer__nota-pago">' + (mesa ? 'Pagas con tu mesero al pedir la cuenta.' : 'Pagas en caja al recoger tu pedido.') + '</p>' +
            (s.negocio.abierto ? '' : '<p class="q-hint q-hint--warn">El restaurante está cerrado; no se pueden enviar pedidos.</p>');

        body.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => cambiarCantidad(b.dataset.inc, 1)));
        body.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => cambiarCantidad(b.dataset.dec, -1)));
        body.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => quitarLinea(b.dataset.remove)));
        body.querySelectorAll('[data-nota-linea]').forEach(b => b.addEventListener('click', () => editarNotaLinea(b.dataset.notaLinea)));
        body.querySelectorAll('[data-modalidad]').forEach(b => b.addEventListener('click', () => {
            guardarSesion(MODALIDAD_KEY, b.dataset.modalidad);
            body.querySelectorAll('[data-modalidad]').forEach(x => {
                const activo = x === b;
                x.classList.toggle('is-active', activo);
                x.setAttribute('aria-checked', String(activo));
            });
        }));
        const referencia = $('#pedido-referencia');
        referencia.addEventListener('input', () => guardarNombre(referencia.value.trim().replace(/\s+/g, ' ')));
        referencia.addEventListener('keydown', e => { if (e.key === 'Enter') referencia.blur(); });
        $('#btn-enviar-pedido').addEventListener('click', enviarPedido);
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
        if (!mesa) { ui.tab = 'carrito'; renderTabCarrito(); return; }
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
                    '<select class="q-select q-select--sm" data-asignar="' + esc(u.key) + '" aria-label="Quién paga ' + esc(u.nombre) + '">' + opciones(quien) + '</select></li>';
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
        $('#btn-cuenta-drawer').addEventListener('click', pedirCuenta);
        if (hayGsap()) gsap.from(body.querySelectorAll('.split__person'), { y: 8, opacity: 0, stagger: 0.04, duration: 0.3, clearProps: 'all' });
    }

    /* ---------------- Envío del pedido (con o sin mesa) ---------------- */
    function enviarPedido() {
        const s = S();
        const mesa = mesaActual();
        if (!s.negocio.abierto) { QUI.toast('El restaurante está cerrado.', 'warning'); return; }
        const lineas = lineasCarrito().filter(l => l.platillo && l.platillo.disponible);
        if (!lineas.length) { QUI.toast('No hay platillos disponibles para enviar.', 'warning'); return; }
        const campo = $('#pedido-referencia');
        const referencia = (campo ? campo.value : nombreComensal()).trim().replace(/\s+/g, ' ').slice(0, 32);
        guardarNombre(referencia);
        const modalidad = modalidadActual();
        const btn = $('#btn-enviar-pedido');
        if (btn) { btn.disabled = true; btn.innerHTML = QUI.icon('loader-circle', 'spin') + 'Enviando…'; QUI.icons(btn); }

        let pedido;
        try {
            pedido = QStore.update(st => {
                // Sin mesa (o si la mesa se eliminó mientras tanto) el pedido llega como directo
                const m = mesa ? q.mesa(st, mesa.id) : null;
                const items = lineas.map(l => {
                    const p = q.platillo(st, l.platillo.id);
                    return { platilloId: p.id, nombre: p.nombre, precio: p.precio, cantidad: l.item.cantidad, notas: l.item.notas || '' };
                });
                const nuevo = {
                    id: QStore.uid('ped'), folio: st.contadores.pedido++, mesaId: m ? m.id : null, origen: 'qr', tipo: m ? 'mesa' : modalidad,
                    estado: 'pendiente', pagado: false, creadoEn: Date.now(), actualizadoEn: Date.now(),
                    items, total: QStore.totalItems(items), comensal: referencia || null
                };
                st.pedidos.push(nuevo);
                if (m && !m.abierta) { m.abierta = true; m.abiertaEn = Date.now(); }
                return nuevo;
            }, { type: 'pedido:nuevo', mesaId: mesa ? mesa.id : null, tipo: mesa ? 'mesa' : modalidad });
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
        renderFlotante();
        setTimeout(() => desplazarA($('#tracker'), { sinCatbar: true }), 650);
    }

    function lanzarConfeti() {
        if (typeof confetti !== 'function' || reducir()) return;
        const base = { colors: ['#D1312B', '#D1A059', '#FFFFFF', '#EDE2CE'], zIndex: 3000, disableForReducedMotion: true, ticks: 220, scalar: 0.9 };
        confetti(Object.assign({}, base, { particleCount: 80, spread: 75, startVelocity: 42, origin: { x: 0.5, y: 0.6 } }));
        setTimeout(() => {
            confetti(Object.assign({}, base, { particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.72 } }));
            confetti(Object.assign({}, base, { particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.72 } }));
        }, 180);
    }

    function celebrarEnvio(pedido) {
        const destino = pedido.mesaId
            ? 'Te lo llevamos a tu mesa en cuanto esté listo.'
            : pedido.tipo === 'llevar' ? 'Te avisamos aquí cuando esté listo para llevar.' : 'Te avisamos aquí cuando esté listo.';
        const el = document.createElement('div');
        el.className = 'sent-burst';
        el.innerHTML = '<div class="sent-burst__card"><span class="sent-burst__icon">' + QUI.icon('chef-hat') + '</span>' +
            '<strong class="q-display">¡Pedido enviado!</strong><span>Folio <b class="q-mono">#' + pedido.folio + '</b> ya está en cocina.</span><span>' + destino + '</span></div>';
        document.body.appendChild(el);
        QUI.icons(el);
        lanzarConfeti();
        if (!hayGsap()) { setTimeout(() => el.remove(), 1800); return; }
        gsap.timeline({ onComplete: () => el.remove() })
            .fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 })
            .fromTo(el.querySelector('.sent-burst__card'), { scale: 0.8, y: 20 }, { scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.8)' }, '<')
            .fromTo(el.querySelector('.sent-burst__icon'), { rotate: -20 }, { rotate: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, '<0.1')
            .to(el, { opacity: 0, duration: 0.3, delay: 1.3 });
    }

    /* ---------------- Seguimiento en vivo ---------------- */
    const PASOS = [
        { key: 'pendiente', label: 'Recibido', icon: 'inbox' },
        { key: 'preparacion', label: 'En preparación', icon: 'flame' },
        { key: 'listo', label: 'Listo', icon: 'bell-ring' }
    ];
    const PROGRESO = { pendiente: 0.14, preparacion: 0.55, listo: 1, entregado: 1 };

    // El aviso de "listo" depende de la modalidad: a la mesa, a la barra o para llevar
    function tituloSeguimiento(p) {
        if (p.estado === 'pendiente') return 'Recibimos tu pedido';
        if (p.estado === 'preparacion') return 'Se está preparando en cocina';
        if (p.estado === 'listo') {
            if (p.mesaId) return '¡Listo! Va en camino a tu mesa';
            return p.tipo === 'llevar' ? '¡Listo para llevar! Recógelo en caja' : '¡Listo! Pasa a recogerlo a la barra';
        }
        return p.tipo === 'llevar' ? 'Entregado. ¡Buen provecho!' : 'Servido. ¡Buen provecho!';
    }

    function modalidadPedido(p) {
        if (p.mesaId) { const m = q.mesa(S(), p.mesaId); return 'Mesa ' + (m ? m.numero : '—'); }
        return (QStore.TIPOS_PEDIDO[p.tipo] || QStore.TIPOS_PEDIDO.mostrador).label;
    }

    function pedidosSeguidos() {
        const s = S();
        const ids = leerJSON(MIS_PEDIDOS_KEY, []);
        // Los directos se suelen pagar antes de recogerlos: el pago solo cierra el seguimiento de los pedidos en mesa
        return ids.map(id => s.pedidos.find(p => p.id === id))
            .filter(p => p && p.estado !== 'cancelado' && !(p.pagado && p.mesaId) &&
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
            return '<article class="track-card track-card--' + p.estado + '" data-pedido="' + p.id + '">' +
                '<div class="track-card__head">' +
                    '<span class="track-card__icon">' + QUI.icon(p.estado === 'entregado' ? 'utensils' : (PASOS[idxActual] || PASOS[0]).icon) + '</span>' +
                    '<div class="track-card__textos"><span class="eyebrow">Pedido <b class="q-mono">#' + p.folio + '</b> · ' + conteoTexto(piezas) + ' · ' + esc(modalidadPedido(p)) +
                        (p.comensal ? ' · ' + esc(p.comensal) : '') + '</span>' +
                    '<strong class="track-card__title">' + esc(tituloSeguimiento(p)) + '</strong></div>' +
                    '<span class="track-card__time q-mono">' + QStore.minutesSince(p.creadoEn) + ' min</span>' +
                '</div>' +
                '<div class="track-bar"><div class="track-bar__fill"></div></div>' +
                '<ol class="track-steps">' + PASOS.map((paso, i) =>
                    '<li class="' + (i < idxActual ? 'is-done' : i === idxActual ? 'is-current' : '') + '">' + QUI.icon(paso.icon) + '<span>' + esc(paso.label) + '</span></li>'
                ).join('') + '</ol>' +
            '</article>';
        }).join('');
        QUI.icons(cont);
        lista.forEach(p => {
            const fill = cont.querySelector('[data-pedido="' + p.id + '"] .track-bar__fill');
            const destino = PROGRESO[p.estado] || 0;
            const previo = ui.anchoTracker[p.id] != null ? ui.anchoTracker[p.id] : 0;
            if (hayGsap() && !reducir()) gsap.fromTo(fill, { scaleX: previo }, { scaleX: destino, duration: 0.9, ease: 'expo.out' });
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
                    const mensaje = p.mesaId ? 'Tu pedido #' + p.folio + ' va en camino a tu mesa.'
                        : p.tipo === 'llevar' ? 'Tu pedido #' + p.folio + ' está listo para llevar. Recógelo en caja.'
                        : 'Tu pedido #' + p.folio + ' está listo. Pasa a recogerlo a la barra.';
                    QUI.toast(mensaje, 'success', { icon: 'bell-ring', title: '¡Listo!' });
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

    /* ---------------- Asistencia en mesa (solo con ?mesa=X) ---------------- */
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
        if (!mesa) return;
        const nombre = nombreComensal();
        let al;
        try { al = crearAlerta('mesero', nombre ? 'Lo solicita ' + nombre : ''); } catch (e) { QUI.toast(e.message, 'error'); return; }
        ui.alertasPrevias[al.id] = false;
        renderFlotante();
        QUI.pulse($('#btn-asistencia'));
        QUI.toast('Avisamos a tu mesero. Llega en un momento.', 'success', { icon: 'hand-platter', title: 'Mesa ' + mesa.numero });
    }

    function pedirCuenta() {
        const s = S();
        const mesa = mesaActual();
        if (!mesa) return;
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
        let al;
        try {
            al = crearAlerta('cuenta', nota, {
                split: { modo: ui.split.modo, personas: ui.split.modo === 'una' ? 1 : ui.split.personas, propinaPct: pct, montos: div.montos }
            });
        } catch (e) { QUI.toast(e.message, 'error'); return; }
        ui.alertasPrevias[al.id] = false;
        if (ui.drawerAbierto) renderDrawer();
        renderFlotante();
        QUI.toast('Tu mesero traerá la cuenta: ' + money(div.total) + '.', 'success', { icon: 'receipt-text', title: 'Cuenta solicitada' });
    }

    function abrirAsistencia() {
        const mesa = mesaActual();
        if (!mesa) return;
        const s = S();
        const alertas = q.alertasMesa(s, mesa.id);
        const llamando = alertas.find(a => a.tipo === 'mesero');
        const cuentaPedida = alertas.find(a => a.tipo === 'cuenta');
        const consumo = q.cuentaMesa(s, mesa.id).subtotal;
        const opcion = (accion, icono, titulo, detalle, pendiente) =>
            '<button type="button" class="asistencia__opcion' + (pendiente ? ' is-pending' : '') + '" data-asistencia="' + accion + '">' + QUI.icon(icono) +
            '<span><strong>' + titulo + '</strong><span>' + detalle + '</span></span>' + QUI.icon('chevron-right', 'asistencia__chevron') + '</button>';
        const modal = QUI.openModal({
            title: 'Mesa ' + esc(mesa.numero) + ' · ¿Qué necesitas?',
            size: 'sm',
            className: 'asistencia-modal',
            body: '<div class="asistencia">' +
                opcion('mesero', 'hand-platter', llamando ? 'Tu mesero ya va en camino' : 'Llamar a mi mesero',
                    llamando ? 'Lo avisamos hace ' + QStore.minutesSince(llamando.creadoEn) + ' min. Toca para recordarle.' : 'Te atiende en un momento.', !!llamando) +
                opcion('cuenta', 'receipt-text', cuentaPedida ? 'Cuenta solicitada' : 'Pedir la cuenta',
                    consumo ? 'Consumo de la mesa: ' + money(consumo) + '. Elige propina y cómo dividirla.' : 'Aún no hay consumo en tu mesa.', !!cuentaPedida) +
            '</div>'
        });
        modal.$('[data-asistencia="mesero"]').addEventListener('click', () => { modal.close(); llamarMesero(); });
        modal.$('[data-asistencia="cuenta"]').addEventListener('click', () => {
            modal.close();
            if (consumo) abrirDrawer('cuenta');
            else QUI.toast('Aún no hay consumo registrado en tu mesa.', 'info', { icon: 'receipt-text' });
        });
    }

    /* ---------------- Barra flotante y contadores ---------------- */
    function alternarFlotante(el, visible) {
        clearTimeout(el._ocultar);
        if (visible) {
            if (el.hidden) { el.hidden = false; void el.offsetWidth; }
            el.classList.add('is-visible');
            el.removeAttribute('inert');
        } else if (!el.hidden) {
            el.classList.remove('is-visible');
            el.setAttribute('inert', '');
            el._ocultar = setTimeout(() => { el.hidden = true; }, 520);
        }
    }

    function renderFlotante() {
        const barra = $('#btn-barra-pedido');
        const asistencia = $('#btn-asistencia');
        if (!barra) return;
        const piezas = piezasCarrito();
        const activos = pedidosSeguidos().filter(p => p.estado !== 'entregado');
        const modo = piezas > 0 ? 'carrito' : (activos.length ? 'seguimiento' : null);
        barra.dataset.modo = modo || '';
        barra.classList.toggle('barra-pedido--seguimiento', modo === 'seguimiento');
        if (modo === 'carrito') {
            $('#barra-icono').innerHTML = QUI.icon('shopping-bag');
            $('#barra-label').textContent = 'Ver mi pedido (' + piezas + ')';
            $('#barra-total').textContent = money(totalCarrito());
            barra.setAttribute('aria-label', 'Ver mi pedido: ' + conteoTexto(piezas) + ', ' + money(totalCarrito()));
        } else if (modo === 'seguimiento') {
            const p = activos[activos.length - 1];
            const est = QStore.ESTADOS_PEDIDO[p.estado] || { label: p.estado, icon: 'inbox' };
            $('#barra-icono').innerHTML = QUI.icon(est.icon);
            $('#barra-label').textContent = 'Pedido #' + p.folio + ' · ' + (p.estado === 'listo' ? '¡Listo!' : est.label);
            $('#barra-total').textContent = 'Ver estado';
            barra.setAttribute('aria-label', 'Ver el estado del pedido ' + p.folio);
        }
        QUI.icons(barra);
        alternarFlotante(barra, !!modo);

        const mesa = mesaActual();
        if (mesa) {
            $('#asistencia-mesa').textContent = 'Mesa ' + mesa.numero;
            asistencia.classList.toggle('is-pending', q.alertasMesa(S(), mesa.id).length > 0);
        }
        alternarFlotante(asistencia, !!mesa);
        document.body.classList.toggle('con-flotante', !!modo || !!mesa);
    }

    function renderContadores() {
        const piezas = piezasCarrito();
        const c = $('#cart-count');
        if (c) { c.textContent = piezas; c.classList.toggle('is-empty', piezas === 0); }
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

    /* ---------------- Eventos ---------------- */
    function enlazarEventos() {
        // Delegación global: agregar, quitar, abrir detalle, navegación y WiFi
        document.addEventListener('click', (e) => {
            const add = e.target.closest('[data-add]');
            if (add) {
                if (!add.disabled) agregarAlCarrito(add.dataset.add, 1, '', add, add.hasAttribute('data-vuelo'));
                return;
            }
            const restar = e.target.closest('[data-restar]');
            if (restar) { restarDelCarrito(restar.dataset.restar); return; }
            if (e.target.closest('[data-copiar-wifi]')) { copiarWifi(); return; }
            const nav = e.target.closest('[data-nav]');
            if (nav) { e.preventDefault(); manejarNav(nav.dataset.nav); return; }
            if (e.target.closest('[data-ir-menu]')) { irAlMenu(); return; }
            const open = e.target.closest('[data-open]');
            if (!open || e.target.closest('.q-modal')) return;
            // Un toque en una tarjeta lateral del carrusel solo la centra (Swiper); el detalle se abre desde la activa
            const lateral = open.closest('.favoritos-swiper.swiper-initialized .swiper-slide');
            if (lateral && !lateral.classList.contains('swiper-slide-active')) return;
            abrirPlatillo(open.dataset.open);
        });
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('article[data-open]')) {
                e.preventDefault();
                abrirPlatillo(e.target.dataset.open);
            }
        });

        // Header
        $('#btn-carrito').addEventListener('click', () => abrirDrawer('carrito'));
        $('#btn-burger').addEventListener('click', () => {
            const nav = $('#mobile-nav');
            nav.hidden = !nav.hidden;
            $('#btn-burger').setAttribute('aria-expanded', String(!nav.hidden));
            if (!nav.hidden && hayGsap()) gsap.fromTo(nav.children, { y: -8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.04 });
            actualizarSticky();
        });
        $('.logo-box').addEventListener('click', e => { e.preventDefault(); desplazarA(0); });

        // Drawer (en móvil se cierra también deslizándolo hacia abajo)
        $('#btn-cerrar-drawer').addEventListener('click', cerrarDrawer);
        $('#drawer-overlay').addEventListener('click', cerrarDrawer);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.drawerAbierto && !document.querySelector('.q-modal-backdrop')) cerrarDrawer(); });
        $$('#drawer-tabs button').forEach(b => b.addEventListener('click', () => { ui.tab = b.dataset.tab; renderDrawer(); }));
        QUI.hojaArrastrable($('#drawer'), [$('#drawer-grabber'), $('#drawer-header')], cerrarDrawer);

        // Barra flotante
        $('#btn-barra-pedido').addEventListener('click', () => {
            if ($('#btn-barra-pedido').dataset.modo === 'seguimiento') desplazarA($('#tracker'), { sinCatbar: true });
            else abrirDrawer('carrito');
        });
        $('#btn-asistencia').addEventListener('click', abrirAsistencia);

        // Chips de categoría: desplazan a su sección
        const chips = $('#chips-categorias');
        chips.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-target]');
            if (chip) irASeccion(chip.dataset.target);
        });
        chips.addEventListener('scroll', actualizarSombrasChips, { passive: true });
        $('#chips-prev').addEventListener('click', () => desplazarChips(-1));
        $('#chips-next').addEventListener('click', () => desplazarChips(1));

        // Buscador
        const buscador = $('#buscador');
        const limpiar = $('#buscador-limpiar');
        let t;
        buscador.addEventListener('input', () => {
            clearTimeout(t);
            limpiar.hidden = !buscador.value && !$('#catbar').classList.contains('is-buscando');
            t = setTimeout(() => buscar(buscador.value), 160);
        });
        buscador.addEventListener('keydown', e => {
            if (e.key === 'Escape') { limpiarBusqueda(true); $('#btn-abrir-buscador').focus(); }
            if (e.key === 'Enter') buscador.blur();
        });
        limpiar.addEventListener('click', () => {
            // En móvil la "x" también cierra el buscador desplegado
            const movil = $('#catbar').classList.contains('is-buscando');
            limpiarBusqueda(movil);
            if (!movil) buscador.focus();
        });
        $('#btn-abrir-buscador').addEventListener('click', abrirBuscadorMovil);
        $('#btn-limpiar-busqueda').addEventListener('click', () => { limpiarBusqueda(true); irAlMenu(); });

        // Desplazamiento: barra fija y ScrollSpy (una vez por cuadro)
        let pendiente = false;
        window.addEventListener('scroll', () => {
            if (pendiente) return;
            pendiente = true;
            requestAnimationFrame(() => { pendiente = false; actualizarSticky(); actualizarSpy(); });
        }, { passive: true });
        window.addEventListener('resize', () => {
            actualizarSticky();
            marcarChip(ui.chipActivo, true);
            actualizarSombrasChips();
            if (window.innerWidth > 900) cerrarMenuMovil();
        });
    }

    /* ---------------- Sincronización en tiempo real ---------------- */
    function alCambiarStore(state, evento, remoto) {
        if (mesaNumero && !q.mesaPorNumero(S(), mesaNumero)) {
            mesaNumero = null;
            guardarSesion(MESA_KEY, null);
        }
        renderHeader();
        renderHero();
        renderCintilla();
        renderFooter();
        renderMenu(false);
        renderContadores();
        notificarCambiosPedidos(remoto);
        notificarAlertasAtendidas(remoto);
        renderTracker();
        renderFlotante();
        if (ui.drawerAbierto) renderDrawer();
        if (remoto && evento && evento.type === 'reset') QUI.toast('El restaurante actualizó su menú.', 'info', { icon: 'refresh-cw' });
    }

    /* ---------------- Arranque ---------------- */
    async function init() {
        QStore.get();
        const mesaInexistente = resolverMesaInicial();
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

        iniciarAnimaciones();

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
        renderContadores();
        renderFlotante();
        enlazarEventos();
        QUI.icons();
        actualizarSticky();
        actualizarSpy(true);
        animarTextoHero();
        iniciarParallaxHero();
        // Las fuentes cambian el ancho de los chips: se recoloca el indicador cuando terminan de cargar
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
            marcarChip(ui.chipActivo, true);
            actualizarSombrasChips();
            if (hayScrollTrigger()) ScrollTrigger.refresh();
        });

        QStore.subscribe(alCambiarStore);

        // Minutos del seguimiento
        setInterval(() => {
            $$('.track-card').forEach(card => {
                const p = S().pedidos.find(x => x.id === card.dataset.pedido);
                const t = card.querySelector('.track-card__time');
                if (p && t) t.textContent = QStore.minutesSince(p.creadoEn) + ' min';
            });
        }, 30000);

        if (mesaInexistente) {
            QUI.toast('No encontramos la mesa ' + mesaInexistente + '. Puedes pedir igual: tu pedido llegará como pedido directo.', 'warning', { icon: 'armchair', duration: 5200 });
            const url = new URL(location.href);
            url.searchParams.delete('mesa');
            history.replaceState(null, '', url);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();

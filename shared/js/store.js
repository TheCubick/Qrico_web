/* =====================================================================
   Q-RICO · Store compartido (qrico_saas_store)
   Fuente única de verdad para usuario/ (comensal) y cliente/ (restaurante).
   Persistencia: localStorage · Sincronización: BroadcastChannel + evento storage
   ===================================================================== */
(function (global) {
    'use strict';

    const STORE_KEY = 'qrico_saas_store';
    const SCHEMA_VERSION = 3;
    const CHANNEL_NAME = 'qrico_saas_channel';

    // Raíz del proyecto calculada desde la ubicación de este script (shared/js/store.js)
    const scriptSrc = document.currentScript && document.currentScript.src;
    const ROOT = scriptSrc ? new URL('../../', scriptSrc).href : location.origin + '/';

    const PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">' +
        '<rect width="400" height="300" fill="#EDE2CE"/>' +
        '<g fill="none" stroke="#D1A059" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" transform="translate(152 102) scale(4)">' +
        '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/>' +
        '<path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></g></svg>'
    );

    const NEGOCIO_DEFAULTS = {
        frasePie: 'Llenamos tu mesa de sabor y tradición todos los días. ¡Siéntete como en casa!',
        razonSocial: 'Restaurantes Q-RICO S.A.S.',
        redes: { facebook: 'https://www.facebook.com/', instagram: 'https://www.instagram.com/', tiktok: 'https://www.tiktok.com/' }
    };

    /* ---------- Utilidades ---------- */
    function uid(prefix) {
        return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function resolveAsset(path) {
        if (!path) return PLACEHOLDER;
        if (/^(data:|https?:|blob:)/i.test(path)) return path;
        return new URL(path, ROOT).href;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function money(amount, currency) {
        const cur = currency || (cache && cache.negocio && cache.negocio.moneda) || 'MXN';
        try {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(amount || 0);
        } catch (e) {
            return '$' + Number(amount || 0).toFixed(2);
        }
    }

    function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

    function totalItems(items) {
        return round2((items || []).reduce((acc, it) => acc + it.precio * it.cantidad, 0));
    }

    function startOfDay(ts) {
        const d = new Date(ts == null ? Date.now() : ts);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }

    function minutesSince(ts) { return Math.max(0, Math.floor((Date.now() - ts) / 60000)); }

    function formatTimer(ts) {
        const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
        const m = Math.floor(s / 60);
        return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

    /* Comprime una imagen local a JPEG para que quepa en localStorage */
    function compressImage(file, maxSize, quality) {
        maxSize = maxSize || 720;
        quality = quality || 0.78;
        return new Promise((resolve, reject) => {
            if (!file || !/^image\//.test(file.type)) return reject(new Error('El archivo no es una imagen.'));
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('Formato de imagen no soportado.'));
                img.onload = () => {
                    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const type = file.type === 'image/png' && maxSize <= 400 ? 'image/png' : 'image/jpeg';
                    resolve(canvas.toDataURL(type, quality));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    /* ---------- Datos semilla ---------- */
    function mulberry32(seed) {
        return function () {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function seed() {
        const now = Date.now();
        const min = 60000;

        const categorias = [
            { id: 'cat_entradas', nombre: 'Entradas', icono: 'salad', orden: 1 },
            { id: 'cat_antojitos', nombre: 'Tacos y antojitos', icono: 'sandwich', orden: 2 },
            { id: 'cat_fuertes', nombre: 'Platos fuertes', icono: 'beef', orden: 3 },
            { id: 'cat_bebidas', nombre: 'Bebidas', icono: 'cup-soda', orden: 4 },
            { id: 'cat_cafe', nombre: 'Café', icono: 'coffee', orden: 5 },
            { id: 'cat_postres', nombre: 'Postres', icono: 'cake-slice', orden: 6 }
        ];

        const platillos = [
            { id: 'pl_molletes', nombre: 'Molletes de la casa', descripcion: 'Bolillo dorado con frijoles refritos, queso gratinado y pico de gallo fresco. Seis piezas.', precio: 99, precioAnterior: 129, categoriaId: 'cat_entradas', imagen: 'https://tropicalcheese.com/wp-content/uploads/2019/03/molletes.jpg', tiempo: 12, disponible: true, destacado: true },
            { id: 'pl_aguachile', nombre: 'Aguachile verde de camarón', descripcion: 'Camarón curado en limón con chile serrano, pepino, cebolla morada y aguacate. Con totopos.', precio: 189, categoriaId: 'cat_entradas', imagen: 'usuario/assets/images/complementos/platillos/platillo 2.jpg', tiempo: 15, disponible: true, destacado: true },
            { id: 'pl_tacos', nombre: 'Tacos de pollo al cilantro', descripcion: 'Cuatro tacos de pollo marinado con guacamole, cebolla y salsa verde de la casa.', precio: 125, categoriaId: 'cat_antojitos', imagen: 'https://cdn.avena.io/avena-recipes-v2/2019/10/1571780755073.jpeg', tiempo: 14, disponible: true, destacado: false },
            { id: 'pl_enchiladas', nombre: 'Enchiladas verdes', descripcion: 'Rellenas de pollo deshebrado, bañadas en salsa verde, crema, queso fresco y cebolla.', precio: 139, precioAnterior: 159, categoriaId: 'cat_antojitos', imagen: 'https://saboresdemicocina.com/wp-content/uploads/2025/10/22queretaro-enchiladas-queretanas-68ed60c10ad5a-1.webp', tiempo: 18, disponible: true, destacado: true },
            { id: 'pl_pechuga', nombre: 'Pechuga crispy con puré', descripcion: 'Pechuga empanizada (180 g) con puré de papa rústico y ensalada de la estación.', precio: 179, precioAnterior: 219, categoriaId: 'cat_fuertes', imagen: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSerpNuwj96HubTl-FnG08cIG4w3IAQxPFNV5kwPRsYZYhWo2JudJNd4vc&s=10', tiempo: 20, disponible: true, destacado: false },
            { id: 'pl_arroz', nombre: 'Arroz frito con pollo', descripcion: 'Arroz salteado al wok con pollo, huevo, pimiento y cebollín. Porción generosa.', precio: 149, categoriaId: 'cat_fuertes', imagen: 'usuario/assets/images/complementos/platillos/platillo 3.jpg', tiempo: 16, disponible: true, destacado: false },
            { id: 'pl_arrachera', nombre: 'Arrachera a la parrilla', descripcion: 'Corte marinado (250 g) con cebollitas cambray, nopal asado, guacamole y tortillas hechas a mano.', precio: 249, categoriaId: 'cat_fuertes', imagen: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=600&q=70&fit=crop', tiempo: 25, disponible: true, destacado: true },
            { id: 'pl_limonada', nombre: 'Limonada de hierbabuena', descripcion: 'Limón recién exprimido, hierbabuena y un toque de miel de agave. 500 ml.', precio: 45, categoriaId: 'cat_bebidas', imagen: 'usuario/assets/images/complementos/platillos/bebida.jpg', tiempo: 4, disponible: true, destacado: false },
            { id: 'pl_jamaica', nombre: 'Agua de jamaica', descripcion: 'Infusión de flor de jamaica endulzada ligeramente. 500 ml.', precio: 38, categoriaId: 'cat_bebidas', imagen: '', tiempo: 2, disponible: true, destacado: false },
            { id: 'pl_americano', nombre: 'Café americano', descripcion: 'Café de altura de Veracruz, tostado medio. Refill sin costo.', precio: 42, categoriaId: 'cat_cafe', imagen: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=600&fit=crop', tiempo: 4, disponible: true, destacado: false },
            { id: 'pl_capuchino', nombre: 'Capuchino', descripcion: 'Doble shot de espresso con leche texturizada y canela.', precio: 55, categoriaId: 'cat_cafe', imagen: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&q=70&fit=crop', tiempo: 6, disponible: false, destacado: false },
            { id: 'pl_cheesecake', nombre: 'Mini cheesecake con fresa', descripcion: 'Cheesecake horneado sobre base de galleta, coronado con fresa bañada en chocolate.', precio: 89, categoriaId: 'cat_postres', imagen: 'usuario/assets/images/complementos/platillos/postre.jpg', tiempo: 5, disponible: true, destacado: true },
            { id: 'pl_flan', nombre: 'Flan napolitano', descripcion: 'Receta de la casa con caramelo oscuro y vainilla de Papantla.', precio: 65, categoriaId: 'cat_postres', imagen: '', tiempo: 3, disponible: true, destacado: false }
        ];

        const mesas = [
            { id: 'mesa_1', numero: '1', zona: 'Salón', capacidad: 2, abierta: false, abiertaEn: null },
            { id: 'mesa_2', numero: '2', zona: 'Salón', capacidad: 4, abierta: true, abiertaEn: now - 32 * min },
            { id: 'mesa_3', numero: '3', zona: 'Salón', capacidad: 4, abierta: false, abiertaEn: null },
            { id: 'mesa_4', numero: '4', zona: 'Salón', capacidad: 6, abierta: true, abiertaEn: now - 58 * min },
            { id: 'mesa_5', numero: '5', zona: 'Salón', capacidad: 4, abierta: true, abiertaEn: now - 6 * min },
            { id: 'mesa_6', numero: '6', zona: 'Salón', capacidad: 8, abierta: false, abiertaEn: null },
            { id: 'mesa_t1', numero: 'T1', zona: 'Terraza', capacidad: 2, abierta: false, abiertaEn: null },
            { id: 'mesa_t2', numero: 'T2', zona: 'Terraza', capacidad: 4, abierta: true, abiertaEn: now - 24 * min },
            { id: 'mesa_t3', numero: 'T3', zona: 'Terraza', capacidad: 6, abierta: false, abiertaEn: null }
        ];

        const byId = Object.fromEntries(platillos.map(p => [p.id, p]));
        const line = (pid, cantidad, notas) => ({ platilloId: pid, nombre: byId[pid].nombre, precio: byId[pid].precio, cantidad, notas: notas || '' });

        const pedidos = [
            { id: 'ped_seed_1040', folio: 1040, mesaId: 'mesa_4', origen: 'qr', tipo: 'mesa', estado: 'entregado', pagado: false, creadoEn: now - 52 * min, actualizadoEn: now - 30 * min,
              items: [line('pl_pechuga', 2), line('pl_arroz', 1), line('pl_cheesecake', 2, 'Una sin chocolate')] },
            { id: 'ped_seed_1041', folio: 1041, mesaId: 'mesa_2', origen: 'qr', tipo: 'mesa', estado: 'preparacion', pagado: false, creadoEn: now - 9 * min, actualizadoEn: now - 6 * min,
              items: [line('pl_enchiladas', 2, 'Una sin crema'), line('pl_limonada', 2)] },
            { id: 'ped_seed_1042', folio: 1042, mesaId: 'mesa_5', origen: 'qr', tipo: 'mesa', estado: 'pendiente', pagado: false, creadoEn: now - 3 * min, actualizadoEn: now - 3 * min,
              items: [line('pl_arrachera', 1, 'Término medio'), line('pl_tacos', 1), line('pl_americano', 1)] },
            { id: 'ped_seed_1043', folio: 1043, mesaId: 'mesa_t2', origen: 'pos', tipo: 'mesa', estado: 'listo', pagado: false, creadoEn: now - 14 * min, actualizadoEn: now - 1 * min,
              items: [line('pl_aguachile', 1, 'Picante aparte'), line('pl_molletes', 1)] }
        ];
        pedidos.forEach(p => { p.total = totalItems(p.items); });
        pedidos[1].comensal = 'Sofía';
        platillos.forEach(p => { if (p.precioAnterior === undefined) p.precioAnterior = null; });

        const alertas = [
            { id: 'al_seed_1', mesaId: 'mesa_4', tipo: 'cuenta', nota: 'Dividir entre 3 · propina 10%', creadoEn: now - 2 * min, atendida: false },
            { id: 'al_seed_2', mesaId: 'mesa_t2', tipo: 'mesero', nota: '', creadoEn: now - 1 * min, atendida: false }
        ];

        // Historial de ventas de los últimos 14 días (determinista)
        const rand = mulberry32(499);
        const vendibles = platillos.filter(p => p.disponible);
        const metodos = ['efectivo', 'tarjeta', 'tarjeta', 'transferencia'];
        const ventas = [];
        let ventaFolio = 1;
        const hoy0 = startOfDay(now);
        for (let d = 13; d >= 0; d--) {
            const dia0 = hoy0 - d * 86400000;
            const diaSemana = new Date(dia0).getDay();
            const base = (diaSemana === 5 || diaSemana === 6) ? 22 : (diaSemana === 0 ? 18 : 13);
            const cuentas = base + Math.floor(rand() * 6);
            for (let i = 0; i < cuentas; i++) {
                const hora = 9 + Math.floor(Math.pow(rand(), 0.85) * 13);
                const ts = dia0 + hora * 3600000 + Math.floor(rand() * 59) * min;
                if (ts > now - 20 * min) continue;
                const items = [];
                const n = 1 + Math.floor(rand() * 4);
                for (let k = 0; k < n; k++) {
                    const p = vendibles[Math.floor(rand() * vendibles.length)];
                    const ex = items.find(x => x.platilloId === p.id);
                    if (ex) ex.cantidad += 1; else items.push({ platilloId: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 + (rand() > 0.75 ? 1 : 0) });
                }
                const subtotal = totalItems(items);
                const pct = [0, 10, 10, 15][Math.floor(rand() * 4)];
                const propina = round2(subtotal * pct / 100);
                const metodo = metodos[Math.floor(rand() * metodos.length)];
                const mesa = mesas[Math.floor(rand() * mesas.length)];
                ventas.push({
                    id: 'v_seed_' + ventaFolio, folio: ventaFolio, mesaId: rand() > 0.2 ? mesa.id : null,
                    tipo: rand() > 0.2 ? 'mesa' : 'mostrador', items, subtotal, propina, total: round2(subtotal + propina),
                    metodo, pagos: [{ metodo, monto: round2(subtotal + propina) }], personas: 1,
                    cerradoEn: ts, cajero: 'Lucía Ramírez'
                });
                ventaFolio++;
            }
        }
        ventas.sort((a, b) => a.cerradoEn - b.cerradoEn);
        ventas.forEach((v, i) => { v.folio = i + 1; v.id = 'v_seed_' + (i + 1); });

        return {
            version: SCHEMA_VERSION,
            rev: 0,
            negocio: {
                nombre: 'Casa Q-RICO',
                eslogan: 'Cocina mexicana de barrio, hecha al momento',
                logo: 'usuario/assets/images/logo/vectorizar_logo.svg',
                portada: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1400&q=70&fit=crop',
                direccion: 'Av. Juárez 214, Centro, Querétaro, Qro.',
                telefono: '442 123 4567',
                horario: 'Lun a Dom · 9:00 a 23:00',
                wifi: { red: 'QRICO_Clientes', clave: 'saborcasero' },
                moneda: 'MXN',
                propinas: [0, 10, 15, 20],
                propinaDefault: 10,
                mensajeTicket: '¡Gracias por tu visita! Vuelve pronto.',
                frasePie: NEGOCIO_DEFAULTS.frasePie,
                razonSocial: NEGOCIO_DEFAULTS.razonSocial,
                redes: Object.assign({}, NEGOCIO_DEFAULTS.redes),
                abierto: true
            },
            plan: { nombre: 'Q-RICO Estándar', precio: 499, moneda: 'MXN', periodo: 'mes', desde: hoy0 - 40 * 86400000 },
            categorias,
            platillos,
            mesas,
            pedidos,
            ventas,
            alertas,
            personal: [
                { id: 'st_gerente', nombre: 'Andrea Morales', rol: 'gerente', pin: '1234', activo: true },
                { id: 'st_cajero', nombre: 'Lucía Ramírez', rol: 'cajero', pin: '2222', activo: true },
                { id: 'st_cocina', nombre: 'Javier Torres', rol: 'cocina', pin: '3333', activo: true },
                { id: 'st_mesero', nombre: 'Diego Hernández', rol: 'mesero', pin: '4444', activo: true }
            ],
            contadores: { pedido: 1044, venta: ventas.length + 1 },
            ultimoEvento: { type: 'seed', at: now }
        };
    }

    /* ---------- Núcleo del store ---------- */
    let cache = null;
    let lastRev = -1;
    const listeners = new Set();
    const channel = 'BroadcastChannel' in global ? new BroadcastChannel(CHANNEL_NAME) : null;

    /* Completa campos agregados en versiones posteriores sin perder los datos del restaurante */
    function migrar(data) {
        const n = data.negocio || (data.negocio = {});
        if (n.frasePie == null) n.frasePie = NEGOCIO_DEFAULTS.frasePie;
        if (n.razonSocial == null) n.razonSocial = NEGOCIO_DEFAULTS.razonSocial;
        if (!n.redes) n.redes = Object.assign({}, NEGOCIO_DEFAULTS.redes);
        (data.platillos || []).forEach(p => { if (p.precioAnterior === undefined) p.precioAnterior = null; });
        return data;
    }

    function readRaw() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            return data && data.version === SCHEMA_VERSION ? migrar(data) : null;
        } catch (e) {
            return null;
        }
    }

    function writeRaw(data) {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(data));
        } catch (e) {
            const err = new Error('Sin espacio de almacenamiento. Usa imágenes más ligeras o por URL.');
            err.code = 'QUOTA';
            throw err;
        }
    }

    function get() {
        if (!cache) {
            cache = readRaw();
            if (!cache) {
                cache = seed();
                cache.rev = 1;
                writeRaw(cache);
            }
            lastRev = cache.rev;
        }
        return cache;
    }

    function emit(remote) {
        listeners.forEach(fn => {
            try { fn(cache, cache.ultimoEvento || {}, remote); } catch (e) { console.error('[QStore] listener', e); }
        });
    }

    /**
     * Aplica una mutación sobre el estado más reciente y la difunde a todas las pestañas.
     * @param {(state) => any} mutator
     * @param {{type:string}} evento
     */
    function update(mutator, evento) {
        const fresh = readRaw() || get();
        const backup = JSON.stringify(fresh);
        const result = mutator(fresh);
        fresh.rev = (fresh.rev || 0) + 1;
        fresh.ultimoEvento = Object.assign({ type: 'update' }, evento || {}, { at: Date.now(), rev: fresh.rev });
        try {
            writeRaw(fresh);
        } catch (e) {
            cache = JSON.parse(backup);
            throw e;
        }
        cache = fresh;
        lastRev = fresh.rev;
        if (channel) channel.postMessage({ rev: fresh.rev });
        emit(false);
        return result;
    }

    function syncFromStorage() {
        const data = readRaw();
        if (!data) {
            // El store fue borrado desde otra pestaña: se regenera
            if (!localStorage.getItem(STORE_KEY)) { cache = null; get(); emit(true); }
            return;
        }
        if (data.rev !== lastRev) {
            cache = data;
            lastRev = data.rev;
            emit(true);
        }
    }

    if (channel) channel.onmessage = syncFromStorage;
    global.addEventListener('storage', e => { if (e.key === STORE_KEY || e.key === null) syncFromStorage(); });

    function subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    }

    function reset() {
        const fresh = seed();
        const prevRev = (readRaw() || cache || { rev: 0 }).rev || 0;
        fresh.rev = prevRev + 1;
        fresh.ultimoEvento = { type: 'reset', at: Date.now(), rev: fresh.rev };
        writeRaw(fresh);
        cache = fresh;
        lastRev = fresh.rev;
        if (channel) channel.postMessage({ rev: fresh.rev });
        emit(false);
    }

    /* ---------- Consultas de dominio ---------- */
    const Q = {
        platillo: (s, id) => s.platillos.find(p => p.id === id),
        categoria: (s, id) => s.categorias.find(c => c.id === id),
        mesa: (s, id) => s.mesas.find(m => m.id === id),
        mesaPorNumero: (s, numero) => s.mesas.find(m => String(m.numero).toLowerCase() === String(numero).toLowerCase()),
        categoriasOrdenadas: s => s.categorias.slice().sort((a, b) => a.orden - b.orden),
        pedidosAbiertosMesa: (s, mesaId) => s.pedidos.filter(p => p.mesaId === mesaId && !p.pagado && p.estado !== 'cancelado'),
        alertasMesa: (s, mesaId) => s.alertas.filter(a => a.mesaId === mesaId && !a.atendida),
        alertasActivas: s => s.alertas.filter(a => !a.atendida),
        cuentaMesa(s, mesaId) {
            const pedidos = Q.pedidosAbiertosMesa(s, mesaId);
            const items = [];
            pedidos.forEach(p => p.items.forEach(it => items.push(Object.assign({ pedidoId: p.id, folio: p.folio }, it))));
            return { pedidos, items, subtotal: totalItems(items) };
        },
        estadoMesa(s, mesa) {
            const alertas = Q.alertasMesa(s, mesa.id);
            if (alertas.some(a => a.tipo === 'cuenta')) return 'cuenta';
            if (alertas.some(a => a.tipo === 'mesero')) return 'llamando';
            if (mesa.abierta || Q.pedidosAbiertosMesa(s, mesa.id).length) return 'ocupada';
            return 'libre';
        },
        ventasEntre: (s, desde, hasta) => s.ventas.filter(v => v.cerradoEn >= desde && v.cerradoEn < hasta)
    };

    const ESTADOS_MESA = {
        libre: { label: 'Libre', icon: 'circle-check' },
        ocupada: { label: 'Ocupada', icon: 'users' },
        llamando: { label: 'Llamando mesero', icon: 'bell-ring' },
        cuenta: { label: 'Pidiendo cuenta', icon: 'receipt' }
    };

    const ESTADOS_PEDIDO = {
        pendiente: { label: 'Recibido', icon: 'inbox' },
        preparacion: { label: 'En preparación', icon: 'flame' },
        listo: { label: 'Listo para servir', icon: 'bell-ring' },
        entregado: { label: 'Entregado', icon: 'circle-check' },
        cancelado: { label: 'Cancelado', icon: 'x' }
    };

    const ROLES = {
        gerente: { label: 'Gerente', vistas: ['dashboard', 'pos', 'kds', 'mesas', 'menu_stock', 'personal', 'reportes', 'configuracion'], inicio: 'dashboard' },
        cajero: { label: 'Cajero', vistas: ['dashboard', 'pos', 'mesas', 'reportes'], inicio: 'pos' },
        cocina: { label: 'Cocina', vistas: ['kds', 'menu_stock'], inicio: 'kds' },
        mesero: { label: 'Mesero', vistas: ['mesas', 'pos', 'kds'], inicio: 'mesas' }
    };

    function urlMenuMesa(numero) {
        return new URL('usuario/?mesa=' + encodeURIComponent(numero), ROOT).href;
    }

    global.QStore = {
        KEY: STORE_KEY, ROOT, PLACEHOLDER, ESTADOS_MESA, ESTADOS_PEDIDO, ROLES,
        get, update, subscribe, reset, seed,
        uid, money, round2, totalItems, escapeHtml, resolveAsset, startOfDay, minutesSince, formatTimer,
        compressImage, urlMenuMesa,
        q: Q
    };
})(window);

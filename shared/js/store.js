/* =====================================================================
   Q-RICO · Store compartido (qrico_saas_store)
   Fuente única de verdad para menu-web/ (comensal) y panel-administrativo/ (restaurante).
   Persistencia: localStorage · Sincronización: BroadcastChannel + evento storage
   ===================================================================== */
(function (global) {
    'use strict';

    const STORE_KEY = 'qrico_saas_store';
    const SCHEMA_VERSION = 4;
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

    /**
     * Traduce rutas guardadas con estructuras anteriores del proyecto a la actual:
     * usuario/img/ → menu-web/assets/images/ · usuario/ → menu-web/ · cliente/ → panel-administrativo/
     */
    function normalizarRuta(path) {
        if (typeof path !== 'string' || !path) return path;
        return path
            .replace(/^usuario\/img\//, 'menu-web/assets/images/')
            .replace(/^usuario\//, 'menu-web/')
            .replace(/^cliente\//, 'panel-administrativo/');
    }

    /**
     * Devuelve la URL solo si usa un protocolo seguro: https:, http:, data:image/, blob: o una ruta relativa.
     * Cualquier otro esquema (javascript:, vbscript:, data:text/html…) se descarta y regresa ''.
     */
    function sanitizeUrl(url) {
        if (typeof url !== 'string') return '';
        // Se quitan espacios y caracteres de control que algunos navegadores ignoran (p. ej. "java\tscript:")
        const limpia = url.trim().replace(/[\u0000-\u001F\u007F\s]+/g, '');
        if (!limpia) return '';
        if (/^(https?:|blob:)/i.test(limpia)) return url.trim();
        if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i.test(limpia)) return url.trim();
        // Con esquema explícito pero no permitido: se bloquea
        if (/^[a-z][a-z0-9+.-]*:/i.test(limpia)) return '';
        return url.trim();
    }

    function resolveAsset(path) {
        const segura = sanitizeUrl(path);
        if (!segura) return PLACEHOLDER;
        if (/^(data:|https?:|blob:)/i.test(segura)) return segura;
        return new URL(normalizarRuta(segura), ROOT).href;
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

    // Fotografías: archivos locales de menu-web/ y fotos libres de Unsplash (el menú pide el ancho que necesita)
    const fotoUnsplash = id => 'https://images.unsplash.com/photo-' + id + '?w=800&q=70&fit=crop&auto=format';
    const fotoLocal = archivo => 'menu-web/assets/images/complementos/platillos/' + archivo;

    function seed() {
        const now = Date.now();
        const min = 60000;

        // Catálogo multigastronómico: muestra que Q-RICO sirve igual a una fonda, una hamburguesería,
        // una barra de sushi o una cafetería
        const categorias = [
            { id: 'cat_casera', nombre: 'Comida Casera y Mexicana', icono: 'utensils', orden: 1 },
            { id: 'cat_burgers', nombre: 'Hamburguesas y Urban', icono: 'sandwich', orden: 2 },
            { id: 'cat_asiatica', nombre: 'Makis, Sushi y Ramen', icono: 'soup', orden: 3 },
            { id: 'cat_entradas', nombre: 'Entradas y Para Compartir', icono: 'salad', orden: 4 },
            { id: 'cat_pan_cafe', nombre: 'Panadería y Café', icono: 'coffee', orden: 5 },
            { id: 'cat_postres', nombre: 'Postres y Bebidas', icono: 'cake-slice', orden: 6 }
        ];

        const platillos = [
            // Comida Casera y Mexicana
            { id: 'pl_chilaquiles', nombre: 'Chilaquiles divorciados con arrachera', descripcion: 'Totopos crujientes mitad salsa verde y mitad roja, coronados con fajitas de arrachera, crema y queso Cotija.', precio: 189, categoriaId: 'cat_casera', imagen: fotoUnsplash('1633372363856-f2fe2669a26e'), tiempo: 15, disponible: true, destacado: true },
            { id: 'pl_milanesa', nombre: 'Milanesa de res casera', descripcion: 'Empanizada al momento, servida con arroz rojo casero, frijoles refritos, ensalada fresca y tortillas recién hechas.', precio: 175, categoriaId: 'cat_casera', imagen: fotoUnsplash('1599921841143-819065a55cc6'), tiempo: 18, disponible: true, destacado: false },
            { id: 'pl_enchiladas', nombre: 'Enchiladas verdes suizas', descripcion: 'Rellenas de pollo deshebrado con salsa de tomatillo asado, gratinadas con queso manchego y crema.', precio: 149, precioAnterior: 169, categoriaId: 'cat_casera', imagen: fotoUnsplash('1613514967307-d5b3471b2453'), tiempo: 16, disponible: true, destacado: false },
            { id: 'pl_mole', nombre: 'Pollo en mole poblano', descripcion: 'Pierna y muslo bañados en mole poblano de la casa con ajonjolí tostado, arroz blanco y tortillas hechas a mano.', precio: 179, categoriaId: 'cat_casera', imagen: fotoLocal('platillo 1.avif'), tiempo: 16, disponible: true, destacado: false },
            { id: 'pl_sopa_azteca', nombre: 'Sopa azteca tradicional', descripcion: 'Caldo de jitomate y chile guajillo con tiras de tortilla frita, aguacate, chicharrón, queso panela y crema.', precio: 98, categoriaId: 'cat_casera', imagen: fotoUnsplash('1730243338482-78d6ffd943df'), tiempo: 10, disponible: true, destacado: false },
            // Hamburguesas y Urban
            { id: 'pl_smash', nombre: 'Smash Burger Doble Cheddar', descripcion: 'Doble carne de res 100% sirloin a la plancha con costra crujiente, cuádruple queso americano, pepinillos, cebolla caramelizada y aderezo de la casa en pan brioche.', precio: 189, precioAnterior: 219, categoriaId: 'cat_burgers', imagen: fotoUnsplash('1607013251379-e6eecfffe234'), tiempo: 14, disponible: true, destacado: true },
            { id: 'pl_bbq_bacon', nombre: 'BBQ Crispy Bacon Burger', descripcion: 'Carne a la parrilla (200 g), tocino ahumado crujiente, aros de cebolla dorados, queso cheddar y salsa BBQ artesanal. Con papas gajo.', precio: 205, categoriaId: 'cat_burgers', imagen: fotoUnsplash('1553979459-d2229ba7433b'), tiempo: 16, disponible: true, destacado: false },
            { id: 'pl_boneless', nombre: 'Boneless Buffalo & Ranch', descripcion: 'Trocitos de pechuga crujiente bañados en salsa Buffalo picante o BBQ con miel, acompañados de apio y aderezo ranch.', precio: 159, categoriaId: 'cat_burgers', imagen: fotoUnsplash('1734987942068-a1a459d65d3d'), tiempo: 12, disponible: true, destacado: false },
            // Makis, Sushi y Ramen
            { id: 'pl_ramen', nombre: 'Tonkotsu Ramen Artesanal', descripcion: 'Caldo cremoso cocinado a fuego lento por 12 horas, fideos alcalinos, panceta chashu flameada, huevo ajitsuke marinado, alga nori y cebollín.', precio: 219, categoriaId: 'cat_asiatica', imagen: fotoUnsplash('1614563637806-1d0e645e0940'), tiempo: 15, disponible: true, destacado: true },
            { id: 'pl_dragon', nombre: 'Dragon Maki Empanizado', descripcion: 'Relleno de camarón tempura y queso crema, cubierto con láminas de aguacate, salsa de anguila dulce y ajonjolí tostado. 10 piezas.', precio: 195, categoriaId: 'cat_asiatica', imagen: fotoUnsplash('1582450871972-ab5ca641643d'), tiempo: 14, disponible: true, destacado: true },
            { id: 'pl_philadelphia', nombre: 'Philadelphia Uramaki', descripcion: 'Salmón fresco del Atlántico, pepino crujiente y queso crema por dentro, envuelto en arroz y ajonjolí negro. 10 piezas.', precio: 169, categoriaId: 'cat_asiatica', imagen: fotoUnsplash('1774635800472-41eaa93c1453'), tiempo: 12, disponible: true, destacado: false },
            { id: 'pl_kushiagues', nombre: 'Kushiagues de Queso y Camarón', descripcion: 'Orden de cuatro brochetas estilo japonés empanizadas en panko crujiente, con salsa kushiage agridulce.', precio: 129, categoriaId: 'cat_asiatica', imagen: fotoUnsplash('1757961047601-a54855371afa'), tiempo: 10, disponible: true, destacado: false },
            { id: 'pl_yakimeshi', nombre: 'Yakimeshi Especial al Wok', descripcion: 'Arroz frito japonés salteado al wok con res, camarón, pollo, verduras finas, huevo y un toque de aceite de ajonjolí.', precio: 155, categoriaId: 'cat_asiatica', imagen: fotoLocal('platillo 3.jpg'), tiempo: 12, disponible: true, destacado: false },
            // Entradas y Para Compartir
            { id: 'pl_aguachile', nombre: 'Aguachile verde de camarón', descripcion: 'Camarón cristal curado al momento en limón con chile serrano, pepino, cebolla morada, aguacate y totopos caseros.', precio: 195, categoriaId: 'cat_entradas', imagen: fotoLocal('platillo 2.jpg'), tiempo: 12, disponible: true, destacado: true },
            { id: 'pl_edamames', nombre: 'Edamames al Grill con Togarashi', descripcion: 'Vainas de soya tierna salteadas al wok con mantequilla de ajo, soya y un toque ligeramente picante de shichimi togarashi.', precio: 89, categoriaId: 'cat_entradas', imagen: fotoUnsplash('1602768201544-302a3bf80742'), tiempo: 7, disponible: true, destacado: false },
            { id: 'pl_molletes', nombre: 'Molletes tradicionales de la casa', descripcion: 'Bolillo artesanal dorado con mantequilla, frijoles refritos, queso gratinado y pico de gallo fresco.', precio: 89, precioAnterior: 109, categoriaId: 'cat_entradas', imagen: fotoUnsplash('1594978583693-8dfdfc93f052'), tiempo: 10, disponible: true, destacado: false },
            // Panadería y Café
            { id: 'pl_bisquet', nombre: 'Bisquet artesanal con nata o cajeta', descripcion: 'Dos bisquets recién horneados, dorados por fuera y suaves por dentro, con generosa nata montada o cajeta de Celaya.', precio: 62, categoriaId: 'cat_pan_cafe', imagen: fotoUnsplash('1763390896467-1ca4a95c6261'), tiempo: 6, disponible: true, destacado: true },
            { id: 'pl_americano', nombre: 'Café Americano de Altura', descripcion: 'Grano 100% arábica de Veracruz de tueste medio, aromático y recién filtrado.', precio: 45, categoriaId: 'cat_pan_cafe', imagen: fotoUnsplash('1601199896828-df6b0b32af25'), tiempo: 4, disponible: true, destacado: false },
            { id: 'pl_capuchino', nombre: 'Capuchino Artesanal / Matcha Latte', descripcion: 'Doble shot de espresso o té verde matcha ceremonial con leche texturizada. Dinos en la nota cuál prefieres.', precio: 65, categoriaId: 'cat_pan_cafe', imagen: fotoUnsplash('1515823064-d6e0c04616a7'), tiempo: 6, disponible: true, destacado: false },
            // Postres y Bebidas
            { id: 'pl_cheesecake', nombre: 'Mini Cheesecake con frutos rojos', descripcion: 'Base crujiente de galleta con crema de queso horneada y compota casera de fresas y zarzamoras.', precio: 89, categoriaId: 'cat_postres', imagen: fotoLocal('postre.jpg'), tiempo: 5, disponible: true, destacado: true },
            { id: 'pl_flan', nombre: 'Flan napolitano de la abuela', descripcion: 'Receta casera horneada a baño María con caramelo oscuro y vainilla natural de Papantla.', precio: 65, categoriaId: 'cat_postres', imagen: fotoUnsplash('1780798465831-de1e4d58ee46'), tiempo: 3, disponible: false, destacado: false },
            { id: 'pl_limonada', nombre: 'Limonada mineral con hierbabuena', descripcion: 'Limón recién exprimido con hojas de hierbabuena fresca y un toque de agave. 500 ml.', precio: 49, categoriaId: 'cat_postres', imagen: fotoLocal('bebida.jpg'), tiempo: 4, disponible: true, destacado: false },
            { id: 'pl_agua_fresca', nombre: 'Agua fresca del día (Jamaica / Horchata)', descripcion: 'Preparada diariamente con ingredientes 100% naturales. 500 ml.', precio: 39, categoriaId: 'cat_postres', imagen: fotoUnsplash('1593624191635-f1a49f5eca76'), tiempo: 2, disponible: true, destacado: false }
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

        // Pedidos en curso: cuatro en mesa y dos directos (mostrador y para llevar) sin mesa asignada
        const pedidos = [
            { id: 'ped_seed_1040', folio: 1040, mesaId: 'mesa_4', origen: 'qr', tipo: 'mesa', estado: 'entregado', pagado: false, creadoEn: now - 52 * min, actualizadoEn: now - 30 * min,
              items: [line('pl_smash', 2), line('pl_yakimeshi', 1), line('pl_cheesecake', 2, 'Uno sin frutos rojos')] },
            { id: 'ped_seed_1041', folio: 1041, mesaId: 'mesa_2', origen: 'qr', tipo: 'mesa', estado: 'preparacion', pagado: false, creadoEn: now - 9 * min, actualizadoEn: now - 6 * min,
              items: [line('pl_enchiladas', 2, 'Una sin crema'), line('pl_limonada', 2)] },
            { id: 'ped_seed_1042', folio: 1042, mesaId: 'mesa_5', origen: 'qr', tipo: 'mesa', estado: 'pendiente', pagado: false, creadoEn: now - 3 * min, actualizadoEn: now - 3 * min,
              items: [line('pl_ramen', 1, 'Huevo extra'), line('pl_dragon', 1), line('pl_americano', 1)] },
            { id: 'ped_seed_1043', folio: 1043, mesaId: 'mesa_t2', origen: 'pos', tipo: 'mesa', estado: 'listo', pagado: false, creadoEn: now - 14 * min, actualizadoEn: now - 1 * min,
              items: [line('pl_aguachile', 1, 'Picante aparte'), line('pl_molletes', 1)] },
            { id: 'ped_seed_1044', folio: 1044, mesaId: null, origen: 'qr', tipo: 'llevar', estado: 'preparacion', pagado: false, creadoEn: now - 7 * min, actualizadoEn: now - 4 * min,
              items: [line('pl_bisquet', 2, 'Uno con cajeta'), line('pl_capuchino', 2, 'Matcha')] },
            { id: 'ped_seed_1045', folio: 1045, mesaId: null, origen: 'qr', tipo: 'mostrador', estado: 'pendiente', pagado: false, creadoEn: now - 2 * min, actualizadoEn: now - 2 * min,
              items: [line('pl_boneless', 1, 'Salsa aparte'), line('pl_agua_fresca', 1, 'Jamaica')] }
        ];
        pedidos.forEach(p => { p.total = totalItems(p.items); });
        pedidos[1].comensal = 'Sofía';
        pedidos[4].comensal = 'Mariana';
        pedidos[5].comensal = 'Carlos';
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
                const enMesa = rand() > 0.3;
                const pct = enMesa ? [0, 10, 10, 15][Math.floor(rand() * 4)] : 0;
                const propina = round2(subtotal * pct / 100);
                const metodo = metodos[Math.floor(rand() * metodos.length)];
                const mesa = mesas[Math.floor(rand() * mesas.length)];
                ventas.push({
                    id: 'v_seed_' + ventaFolio, folio: ventaFolio, mesaId: enMesa ? mesa.id : null,
                    tipo: enMesa ? 'mesa' : (rand() > 0.5 ? 'llevar' : 'mostrador'), items, subtotal, propina, total: round2(subtotal + propina),
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
                eslogan: 'Cocina casera, urbana y asiática, hecha al momento',
                logo: 'menu-web/assets/images/logo/vectorizar_logo.svg',
                portada: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1400&q=70&fit=crop&auto=format',
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
            contadores: { pedido: 1046, venta: ventas.length + 1 },
            ultimoEvento: { type: 'seed', at: now }
        };
    }

    /* ---------- Núcleo del store ---------- */
    let cache = null;
    let lastRev = -1;
    const listeners = new Set();
    const channel = 'BroadcastChannel' in global ? new BroadcastChannel(CHANNEL_NAME) : null;

    // Catálogo de demostración de la versión 3 y la categoría nueva que corresponde a cada una de las anteriores
    const CATEGORIAS_V3 = { cat_entradas: 'cat_entradas', cat_antojitos: 'cat_casera', cat_fuertes: 'cat_casera', cat_bebidas: 'cat_postres', cat_cafe: 'cat_pan_cafe', cat_postres: 'cat_postres' };
    const PLATILLOS_V3 = ['pl_molletes', 'pl_aguachile', 'pl_tacos', 'pl_enchiladas', 'pl_pechuga', 'pl_arroz', 'pl_arrachera', 'pl_limonada', 'pl_jamaica', 'pl_americano', 'pl_capuchino', 'pl_cheesecake', 'pl_flan'];

    /**
     * Versión 3 → 4: cambia el catálogo de demostración por el multigastronómico.
     * Conserva lo que el restaurante creó (categorías y platillos propios, mesas, personal y configuración).
     * Pedidos, alertas y ventas solo se renuevan si siguen siendo los de demostración, para no duplicar folios.
     */
    function migrarV3aV4(data) {
        const demo = seed();
        const propias = (data.categorias || []).filter(c => !(c.id in CATEGORIAS_V3)).sort((a, b) => a.orden - b.orden);
        data.categorias = demo.categorias.concat(propias.map((c, i) => Object.assign(c, { orden: demo.categorias.length + i + 1 })));
        const propios = (data.platillos || []).filter(p => !PLATILLOS_V3.includes(p.id));
        propios.forEach(p => { if (CATEGORIAS_V3[p.categoriaId]) p.categoriaId = CATEGORIAS_V3[p.categoriaId]; });
        data.platillos = demo.platillos.concat(propios);

        const soloDemo = (lista, prefijo) => (lista || []).every(x => String(x.id).startsWith(prefijo));
        if (soloDemo(data.pedidos, 'ped_seed_') && soloDemo(data.alertas, 'al_seed_')) {
            data.pedidos = demo.pedidos;
            data.alertas = demo.alertas;
            data.contadores = Object.assign({}, data.contadores, { pedido: demo.contadores.pedido });
        }
        if (soloDemo(data.ventas, 'v_seed_')) {
            data.ventas = demo.ventas;
            data.contadores = Object.assign({}, data.contadores, { venta: demo.contadores.venta });
        }
        data.version = SCHEMA_VERSION;
        return data;
    }

    /* Completa campos agregados en versiones posteriores sin perder los datos del restaurante */
    function migrar(data) {
        const n = data.negocio || (data.negocio = {});
        if (n.frasePie == null) n.frasePie = NEGOCIO_DEFAULTS.frasePie;
        if (n.razonSocial == null) n.razonSocial = NEGOCIO_DEFAULTS.razonSocial;
        if (!n.redes) n.redes = Object.assign({}, NEGOCIO_DEFAULTS.redes);
        // Rutas locales guardadas antes de renombrar carpetas (usuario/ → menu-web/, cliente/ → panel-administrativo/)
        n.logo = normalizarRuta(n.logo);
        n.portada = normalizarRuta(n.portada);
        (data.platillos || []).forEach(p => {
            if (p.precioAnterior === undefined) p.precioAnterior = null;
            p.imagen = normalizarRuta(p.imagen);
        });
        return data;
    }

    /**
     * Lleva cualquier respaldo o estado guardado al esquema actual.
     * Devuelve null si la versión no se puede migrar (en ese caso se cargan los datos de demostración).
     */
    function actualizarEsquema(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
        if (data.version === 3) migrarV3aV4(data);
        return data.version === SCHEMA_VERSION ? sanear(migrar(data)) : null;
    }

    /* ---------- Integridad del estado ----------
       El estado vive en localStorage y en respaldos importados, así que cualquiera puede alterarlo
       desde la consola. Antes de usarlo se validan colecciones, tipos numéricos, identificadores,
       valores de catálogo y URLs. Así ningún dato manipulado llega a la interfaz como HTML. */
    const COLECCIONES = ['categorias', 'platillos', 'mesas', 'pedidos', 'alertas', 'ventas', 'personal'];
    const CAMPOS_NUMERICOS = ['precio', 'precioAnterior', 'cantidad', 'capacidad', 'tiempo', 'folio', 'monto', 'total',
        'subtotal', 'propina', 'propinaPct', 'propinaDefault', 'recibido', 'cambio', 'orden', 'personas', 'rev',
        'creadoEn', 'actualizadoEn', 'abiertaEn', 'cerradoEn', 'atendidaEn', 'at', 'desde'];
    // Campos que terminan como clases CSS, atributos o nombres de icono: solo letras, números, guion y guion bajo
    const CAMPOS_CLAVE = ['id', 'estado', 'rol', 'metodo', 'tipo', 'origen', 'icono'];
    const soloClave = v => String(v).replace(/[^\w-]/g, '');

    function sanearValor(obj) {
        if (Array.isArray(obj)) { obj.forEach(sanearValor); return; }
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach(k => {
            const v = obj[k];
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') { delete obj[k]; return; }
            if (v && typeof v === 'object') { sanearValor(v); return; }
            if (CAMPOS_NUMERICOS.includes(k)) {
                if (v == null || v === '') return;
                const n = Number(v);
                obj[k] = Number.isFinite(n) ? n : 0;
            } else if ((CAMPOS_CLAVE.includes(k) || /Id$/.test(k)) && v != null && typeof v !== 'boolean') {
                obj[k] = soloClave(v);
            }
        });
    }

    function sanear(data) {
        COLECCIONES.forEach(c => { if (!Array.isArray(data[c])) data[c] = []; });
        if (!data.negocio || typeof data.negocio !== 'object') data.negocio = {};
        sanearValor(data);
        // Valores de catálogo: lo desconocido se reemplaza por un valor válido
        data.pedidos.forEach(p => {
            if (!ESTADOS_PEDIDO[p.estado]) p.estado = 'pendiente';
            if (!TIPOS_PEDIDO[p.tipo]) p.tipo = p.mesaId ? 'mesa' : 'mostrador';
            if (!Array.isArray(p.items)) p.items = [];
        });
        // Un rol desconocido no puede iniciar sesión: queda como mesero inactivo hasta que el gerente lo corrija
        data.personal.forEach(u => { if (!ROLES[u.rol]) { u.rol = 'mesero'; u.activo = false; } });
        // Una imagen con protocolo no permitido se vacía (la interfaz muestra la imagen de respaldo)
        const urlSegura = v => (typeof v === 'string' && v && !sanitizeUrl(v)) ? '' : v;
        data.platillos.forEach(p => { p.imagen = urlSegura(p.imagen); });
        const n = data.negocio;
        n.logo = urlSegura(n.logo);
        n.portada = urlSegura(n.portada);
        // Redes sociales: solo enlaces web
        if (n.redes && typeof n.redes === 'object') {
            Object.keys(n.redes).forEach(r => {
                const u = sanitizeUrl(n.redes[r]);
                n.redes[r] = /^https?:/i.test(u) ? u : '';
            });
        }
        return data;
    }

    function readRaw() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            const versionGuardada = data && data.version;
            const actual = actualizarEsquema(data);
            // Si hubo migración, se guarda de inmediato para no repetirla en cada lectura
            if (actual && versionGuardada !== SCHEMA_VERSION) {
                try { localStorage.setItem(STORE_KEY, JSON.stringify(actual)); } catch (e) { /* sin espacio: se migra en memoria */ }
            }
            return actual;
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
        // Pedidos sin mesa (mostrador o para llevar) que siguen pendientes de cobro en caja
        pedidosDirectosAbiertos: s => s.pedidos.filter(p => !p.mesaId && !p.pagado && p.estado !== 'cancelado'),
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

    // Modalidad del pedido: en mesa (QR de mesa) o directo, sin mesa, para comer aquí o para llevar
    const TIPOS_PEDIDO = {
        mesa: { label: 'En mesa', icon: 'armchair' },
        mostrador: { label: 'Para comer aquí', icon: 'utensils' },
        llevar: { label: 'Para llevar', icon: 'shopping-bag' }
    };

    const ROLES = {
        gerente: { label: 'Gerente', vistas: ['dashboard', 'pos', 'kds', 'mesas', 'menu_stock', 'personal', 'reportes', 'configuracion'], inicio: 'dashboard' },
        cajero: { label: 'Cajero', vistas: ['dashboard', 'pos', 'mesas', 'reportes'], inicio: 'pos' },
        cocina: { label: 'Cocina', vistas: ['kds', 'menu_stock'], inicio: 'kds' },
        mesero: { label: 'Mesero', vistas: ['mesas', 'pos', 'kds'], inicio: 'mesas' }
    };

    function urlMenuMesa(numero) {
        return new URL('menu-web/?mesa=' + encodeURIComponent(numero), ROOT).href;
    }

    global.QStore = {
        KEY: STORE_KEY, VERSION: SCHEMA_VERSION, ROOT, PLACEHOLDER, ESTADOS_MESA, ESTADOS_PEDIDO, TIPOS_PEDIDO, ROLES,
        get, update, subscribe, reset, seed, actualizarEsquema,
        uid, money, round2, totalItems, escapeHtml, sanitizeUrl, resolveAsset, startOfDay, minutesSince, formatTimer,
        compressImage, urlMenuMesa,
        q: Q
    };
})(window);

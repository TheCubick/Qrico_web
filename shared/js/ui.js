/* =====================================================================
   Q-RICO · Kit de UI compartido
   Iconos Lucide, toasts, modales (bottom sheet en móvil), confirmaciones,
   sonido y animaciones.
   ===================================================================== */
(function (global) {
    'use strict';

    const hasGsap = () => typeof global.gsap !== 'undefined';
    const consultaMovil = global.matchMedia ? global.matchMedia('(max-width: 640px)') : null;
    const consultaMovimiento = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const esMovil = () => !!(consultaMovil && consultaMovil.matches);
    const reducirMovimiento = () => !!(consultaMovimiento && consultaMovimiento.matches);

    function icons(root) {
        if (!global.lucide) return;
        global.lucide.createIcons({
            attrs: { 'stroke-width': 1.75 },
            nameAttr: 'data-lucide',
            root: root || document
        });
    }

    function icon(name, extraClass) {
        return '<i data-lucide="' + name + '"' + (extraClass ? ' class="' + extraClass + '"' : '') + '></i>';
    }

    /* Pide a Unsplash solo el ancho que se va a mostrar (las demás URLs no se tocan) */
    function urlConAncho(src, ancho) {
        if (!ancho || typeof src !== 'string' || !/^https:\/\/images\.unsplash\.com\//.test(src)) return src;
        try {
            const u = new URL(src);
            u.searchParams.set('w', String(ancho));
            u.searchParams.set('auto', 'format');
            if (!u.searchParams.has('q')) u.searchParams.set('q', '70');
            return u.href;
        } catch (e) {
            return src;
        }
    }

    /**
     * Imagen con respaldo de marca si falla la carga.
     * opts.ancho: ancho en px que se pide a Unsplash · opts.prioridad: carga inmediata (imagen principal)
     */
    function imgTag(src, alt, cls, opts) {
        opts = opts || {};
        const safeAlt = QStore.escapeHtml(alt || '');
        const url = QStore.resolveAsset(urlConAncho(src, opts.ancho));
        return '<img src="' + QStore.escapeHtml(url) + '" alt="' + safeAlt + '"' +
            (opts.prioridad ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"') + ' decoding="async"' +
            (cls ? ' class="' + cls + '"' : '') +
            ' onerror="this.onerror=null;this.src=QStore.PLACEHOLDER;">';
    }

    /* ---------- Toasts ---------- */
    function toastStack() {
        let stack = document.querySelector('.q-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'q-toast-stack';
            stack.setAttribute('role', 'status');
            stack.setAttribute('aria-live', 'polite');
            document.body.appendChild(stack);
        }
        return stack;
    }

    const TOAST_ICONS = { success: 'circle-check', error: 'circle-alert', info: 'info', warning: 'triangle-alert', order: 'chef-hat' };

    function toast(message, type, opts) {
        type = type || 'info';
        opts = opts || {};
        const el = document.createElement('div');
        el.className = 'q-toast q-toast--' + type;
        el.innerHTML = icon(opts.icon || TOAST_ICONS[type] || 'info') +
            '<div class="q-toast__body">' + (opts.title ? '<strong>' + QStore.escapeHtml(opts.title) + '</strong>' : '') +
            '<span>' + QStore.escapeHtml(message) + '</span></div>';
        toastStack().appendChild(el);
        icons(el);
        if (hasGsap()) gsap.fromTo(el, { y: 16, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'power3.out' });
        const close = () => {
            if (hasGsap()) gsap.to(el, { opacity: 0, y: -8, duration: 0.3, onComplete: () => el.remove() });
            else el.remove();
        };
        setTimeout(close, opts.duration || 3600);
        el.addEventListener('click', close);
        return el;
    }

    /* ---------- Hoja inferior arrastrable (bottom sheet en móvil) ---------- */
    /**
     * Permite cerrar una hoja deslizándola hacia abajo desde sus zonas de arrastre.
     * Usa la propiedad CSS `translate`, que se suma al `transform` de la animación de apertura sin pisarlo.
     */
    function hojaArrastrable(hoja, zonas, alCerrar) {
        let y0 = null, dy = 0, t0 = 0;
        zonas.filter(Boolean).forEach(zona => {
            zona.addEventListener('pointerdown', e => {
                if (!esMovil() || (e.pointerType === 'mouse' && e.button !== 0)) return;
                if (e.target.closest('button, a, input, textarea, select')) return;
                y0 = e.clientY;
                dy = 0;
                t0 = performance.now();
                try { zona.setPointerCapture(e.pointerId); } catch (err) { /* el puntero ya se soltó */ }
            });
            zona.addEventListener('pointermove', e => {
                if (y0 == null) return;
                dy = Math.max(0, e.clientY - y0);
                hoja.style.translate = '0 ' + dy + 'px';
            });
            const soltar = () => {
                if (y0 == null) return;
                y0 = null;
                const rapido = dy / Math.max(1, performance.now() - t0) > 0.55;
                if (dy > 110 || (rapido && dy > 32)) {
                    alCerrar();
                    setTimeout(() => { hoja.style.translate = ''; }, 650);
                } else if (dy > 0) {
                    const desde = '0 ' + dy + 'px';
                    hoja.style.translate = '';
                    if (hoja.animate && !reducirMovimiento()) hoja.animate([{ translate: desde }, { translate: '0 0' }], { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
                }
            };
            zona.addEventListener('pointerup', soltar);
            zona.addEventListener('pointercancel', soltar);
        });
    }

    /* ---------- Modales ---------- */
    function openModal(options) {
        const o = Object.assign({ title: '', body: '', footer: '', size: 'md', onClose: null, className: '' }, options);
        const backdrop = document.createElement('div');
        backdrop.className = 'q-modal-backdrop';
        // El desplazamiento suave (Lenis) no debe capturar la rueda del ratón dentro del modal
        backdrop.setAttribute('data-lenis-prevent', '');
        backdrop.innerHTML =
            '<div class="q-modal q-modal--' + o.size + ' ' + o.className + '" role="dialog" aria-modal="true">' +
                '<span class="q-sheet-grabber" aria-hidden="true"></span>' +
                (o.title ? '<header class="q-modal__header"><h3>' + o.title + '</h3>' +
                '<button class="q-icon-btn" data-close aria-label="Cerrar">' + icon('x') + '</button></header>' : '') +
                '<div class="q-modal__body">' + o.body + '</div>' +
                (o.footer ? '<footer class="q-modal__footer">' + o.footer + '</footer>' : '') +
            '</div>';
        document.body.appendChild(backdrop);
        document.body.classList.add('q-no-scroll');
        icons(backdrop);
        const modal = backdrop.querySelector('.q-modal');
        const comoHoja = esMovil();

        if (hasGsap()) {
            gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25 });
            if (comoHoja) gsap.fromTo(modal, { yPercent: 100 }, { yPercent: 0, duration: reducirMovimiento() ? 0.01 : 0.55, ease: 'expo.out' });
            else gsap.fromTo(modal, { y: 28, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out' });
        }

        let closed = false;
        function close() {
            if (closed) return;
            closed = true;
            document.removeEventListener('keydown', onKey);
            const done = () => {
                backdrop.remove();
                // Conserva el bloqueo si sigue abierto otro modal o el drawer del pedido
                if (!document.querySelector('.q-modal-backdrop, .drawer.is-open')) document.body.classList.remove('q-no-scroll');
                if (o.onClose) o.onClose();
            };
            if (hasGsap()) {
                if (comoHoja) gsap.to(modal, { yPercent: 100, duration: 0.3, ease: 'power2.in' });
                else gsap.to(modal, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.in' });
                gsap.to(backdrop, { opacity: 0, duration: comoHoja ? 0.3 : 0.22, onComplete: done });
            } else done();
        }
        function onKey(e) { if (e.key === 'Escape') close(); }
        document.addEventListener('keydown', onKey);
        backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close(); });
        backdrop.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
        hojaArrastrable(modal, [modal.querySelector('.q-sheet-grabber'), modal.querySelector('.q-modal__header')], close);

        return { el: modal, backdrop, close, $: sel => modal.querySelector(sel), $$: sel => modal.querySelectorAll(sel) };
    }

    function confirmDialog(options) {
        const o = Object.assign({ title: '¿Confirmar acción?', message: '', confirmText: 'Confirmar', cancelText: 'Cancelar', danger: false }, options);
        return new Promise(resolve => {
            let answered = false;
            const m = openModal({
                title: o.title,
                size: 'sm',
                body: '<p class="q-confirm-text">' + o.message + '</p>',
                footer: '<button class="q-btn q-btn--ghost" data-close>' + o.cancelText + '</button>' +
                        '<button class="q-btn ' + (o.danger ? 'q-btn--danger' : 'q-btn--primary') + '" data-ok>' + o.confirmText + '</button>',
                onClose: () => { if (!answered) resolve(false); }
            });
            m.$('[data-ok]').addEventListener('click', () => { answered = true; resolve(true); m.close(); });
        });
    }

    /* ---------- Sonido (Web Audio, sin archivos externos) ---------- */
    let audioCtx = null;
    function unlockAudio() {
        try {
            if (!audioCtx) audioCtx = new (global.AudioContext || global.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
        } catch (e) { /* sin audio */ }
    }
    ['pointerdown', 'keydown'].forEach(ev => global.addEventListener(ev, unlockAudio, { passive: true }));

    function chime(kind) {
        if (!audioCtx || audioCtx.state !== 'running') return;
        const notes = kind === 'alerta' ? [880, 660, 880] : [660, 880, 1175];
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = audioCtx.currentTime + i * 0.16;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(t);
            osc.stop(t + 0.3);
        });
    }

    /* ---------- Animaciones ---------- */
    function staggerIn(elements, opts) {
        if (!hasGsap() || !elements || !elements.length) return;
        gsap.fromTo(elements, { y: 14, opacity: 0 }, Object.assign({ y: 0, opacity: 1, duration: 0.5, stagger: 0.035, ease: 'power3.out', clearProps: 'transform,opacity' }, opts || {}));
    }

    function pulse(el) {
        if (!el) return;
        if (hasGsap()) gsap.fromTo(el, { scale: 1 }, { scale: 1.18, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' });
    }

    function shake(el) {
        if (!el) return;
        if (hasGsap()) gsap.fromTo(el, { x: 0 }, { keyframes: [{ x: -10 }, { x: 10 }, { x: -7 }, { x: 7 }, { x: -3 }, { x: 0 }], duration: 0.45, ease: 'power1.inOut' });
    }

    function initials(nombre) {
        return String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
    }

    global.QUI = {
        icons, icon, imgTag, urlConAncho, toast, openModal, confirmDialog, hojaArrastrable, chime, unlockAudio,
        staggerIn, pulse, shake, initials, hasGsap, esMovil, reducirMovimiento
    };
})(window);

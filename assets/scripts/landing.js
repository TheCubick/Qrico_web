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

/* =====================================================================
   Q-RICO · Copia de librerías de animación a shared/vendor/
   El sitio es estático (sin compilación): menu-web/pages/menu.html carga
   estas copias locales, así funciona igual en Render, en Live Server o
   sin internet. Se ejecuta solo después de `npm install` (postinstall)
   o a mano con `npm run vendor` al actualizar una versión.
   ===================================================================== */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const modulos = join(raiz, 'node_modules');
const destino = join(raiz, 'shared', 'vendor');

// [paquete, archivo de origen dentro del paquete, nombre final en shared/vendor/<carpeta>/]
const archivos = [
    ['gsap', 'dist/gsap.min.js', 'gsap/gsap.min.js'],
    ['gsap', 'dist/ScrollTrigger.min.js', 'gsap/ScrollTrigger.min.js'],
    ['gsap', 'dist/Flip.min.js', 'gsap/Flip.min.js'],
    ['swiper', 'swiper-bundle.min.js', 'swiper/swiper-bundle.min.js'],
    ['swiper', 'swiper-bundle.min.css', 'swiper/swiper-bundle.min.css'],
    ['swiper', 'LICENSE', 'swiper/LICENSE'],
    ['lenis', 'dist/lenis.min.js', 'lenis/lenis.min.js'],
    ['lenis', 'dist/lenis.css', 'lenis/lenis.css'],
    ['lenis', 'LICENSE', 'lenis/LICENSE'],
    ['canvas-confetti', 'dist/confetti.browser.js', 'canvas-confetti/confetti.browser.js'],
    ['canvas-confetti', 'LICENSE', 'canvas-confetti/LICENSE']
];

let copiados = 0;
for (const [paquete, origen, final] of archivos) {
    const de = join(modulos, paquete, origen);
    const a = join(destino, final);
    if (!existsSync(de)) {
        console.error('[vendor] No se encontró ' + paquete + '/' + origen + '. Ejecuta npm install primero.');
        process.exitCode = 1;
        continue;
    }
    mkdirSync(dirname(a), { recursive: true });
    if (/\.(js|css)$/.test(final)) {
        // Los mapas de código fuente no se publican: se quita la referencia para evitar peticiones 404
        const texto = readFileSync(de, 'utf8').replace(/\n?\/[/*][#@] sourceMappingURL=.*$/m, '');
        writeFileSync(a, texto);
    } else {
        copyFileSync(de, a);
    }
    copiados++;
}

// Versiones instaladas, para saber qué hay en shared/vendor/ sin abrir cada archivo
const versiones = Object.fromEntries(['gsap', 'swiper', 'lenis', 'canvas-confetti'].map(p => {
    const pkg = join(modulos, p, 'package.json');
    return [p, existsSync(pkg) ? JSON.parse(readFileSync(pkg, 'utf8')).version : null];
}));
writeFileSync(join(destino, 'versiones.json'), JSON.stringify(versiones, null, 2) + '\n');

console.log('[vendor] ' + copiados + ' archivos copiados a shared/vendor/ · ' +
    Object.entries(versiones).map(([p, v]) => p + '@' + v).join(' · '));

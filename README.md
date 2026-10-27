<div align="center">

# Q-RICO | Plataforma SaaS de Menús Interactivos QR y Gestión Restaurantera

> **Digitalización integral del restaurante en tiempo real.** El comensal ordena desde su mesa escaneando un código QR, sin descargar ninguna aplicación, y cada pedido llega al instante a cocina, caja y piso. Todo bajo una **suscripción fija de $499.00 MXN al mes, sin comisiones por venta**.

![Estado](https://img.shields.io/badge/Estado-En%20producci%C3%B3n-D1312B?style=for-the-badge)
![Render](https://img.shields.io/badge/Render-Desplegado-1E1B18?style=for-the-badge&logo=render&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-Sem%C3%A1ntico-D1312B?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Design%20Tokens-D1A059?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-1E1B18?style=for-the-badge&logo=javascript&logoColor=D1A059)
![PWA](https://img.shields.io/badge/Arquitectura-PWA-D1A059?style=for-the-badge&logo=pwa&logoColor=white)

</div>

---

## 1. Demo en Vivo

> **Sitio en producción:** [https://qrico-web.onrender.com](https://qrico-web.onrender.com)

| Módulo | Enlace directo |
| --- | --- |
| **Landing Page comercial** | [`qrico-web.onrender.com`](https://qrico-web.onrender.com/) |
| **Menú del comensal (Mesa 1)** | [`qrico-web.onrender.com/menu-web/?mesa=1`](https://qrico-web.onrender.com/menu-web/?mesa=1) |
| **Panel administrativo** | [`qrico-web.onrender.com/panel-administrativo/`](https://qrico-web.onrender.com/panel-administrativo/) |

### PINs de Acceso de Demostración

| Rol | PIN | Alcance dentro del panel |
| --- | :---: | --- |
| **Gerente** | `1234` | Acceso total: Dashboard, POS, KDS, Mesas, Menú/Stock, Personal, Reportes y Configuración |
| **Cajero** | `2222` | Dashboard, Punto de Venta, Mesas y Reportes |
| **Cocina** | `3333` | Monitor KDS en tiempo real y control de disponibilidad de platillos |
| **Mesero** | `4444` | Mapa de Mesas, Punto de Venta y Monitor KDS |

> **Prueba de sincronización en un solo vistazo:** en la sección *Demo en vivo* de la Landing Page, el menú del comensal y el panel del restaurante se muestran lado a lado. Al enviar un pedido desde el teléfono, la comanda aparece en el monitor de cocina al instante.

---

## 2. Arquitectura Funcional del Ecosistema

| Módulo | Ubicación | Función |
| --- | --- | --- |
| **Landing Page Comercial** | `index.html` | Vitrina B2B con propuesta de valor, plan y precio, demostración interactiva integrada y acceso directo por rol con un clic. |
| **Módulo Comensal** | `menu-web/` | Menú QR dinámico con buscador instantáneo y navegación por categorías, seguimiento del pedido en vivo, llamado a mesero y división automática de cuentas (cuenta única, partes iguales o por platillo). También acepta pedidos directos para comer aquí o para llevar. |
| **Panel Administrativo** | `panel-administrativo/` | Aplicación de una sola página (SPA) con Punto de Venta (POS), Monitor de Cocina (KDS) con cronómetros y arrastrar y soltar, mapa de mesas con QR, control de stock al instante, gestión de personal y reportes gráficos. |
| **Núcleo de Sincronización** | `shared/` | Motor reactivo `QStore` que sincroniza pedidos, alertas y stock en tiempo real entre pestañas y dispositivos del mismo navegador mediante `BroadcastChannel` y `localStorage`, con migración automática de esquema. |

---

## 3. Herramientas, Tecnologías y Librerías Utilizadas

| Categoría | Tecnología | Uso dentro de Q-RICO |
| --- | --- | --- |
| **Core y lenguajes** | HTML5 semántico | Estructura accesible de la landing, el menú y el panel |
| | CSS3 modular con Design Tokens | Paleta, tipografía y medidas centralizadas en `tokens.css` |
| | Vanilla JavaScript (ES6+) | Toda la lógica de negocio, sin frameworks ni paso de compilación |
| **APIs nativas del navegador** | `BroadcastChannel API` | Sincronización en tiempo real entre el menú y el panel |
| | `Web Storage API` | Persistencia del estado y migración de esquema |
| | `Canvas API` | Compresión automática de imágenes subidas al menú |
| | `Web Audio API` | Alertas sonoras sintetizadas, sin archivos de audio externos |
| **Librerías especializadas (CDN)** | GSAP 3.12 | Animaciones de interfaz y microinteracciones del panel |
| | Chart.js 4.4 | Analítica y gráficas de ventas |
| | SortableJS 1.15 | Arrastrar y soltar comandas en el monitor de cocina |
| | QRCode.js | Generación dinámica del código QR de cada mesa |
| | html2pdf.js | Exportación de tickets térmicos de 80 mm, cortes de caja y plantillas QR en PDF |
| | Lucide Icons | Iconografía vectorial en toda la plataforma |
| **Librerías locales del menú** | GSAP 3.15 (ScrollTrigger y Flip), Swiper, Lenis, canvas-confetti | Carruseles, desplazamiento suave, transiciones de búsqueda y confirmación visual del pedido |
| **Entorno, diseño y despliegue** | Visual Studio Code, Git y GitHub | Desarrollo y control de versiones |
| | Adobe Illustrator | Vectorización de la identidad corporativa |
| | Render | Cloud hosting estático con despliegue continuo desde GitHub |

---

## 4. Seguridad y Posicionamiento Web (SEO)

**Seguridad**

- **Prevención de XSS:** todo dato capturado por usuarios (nombres, notas de cocina, platillos, motivos de alerta y el parámetro `?mesa=`) se escapa con `QStore.escapeHtml()` antes de insertarse en la interfaz.
- **Integridad del estado:** cada lectura de `localStorage` valida colecciones, tipos numéricos, identificadores y valores de catálogo. Así, un dato manipulado desde la consola o un respaldo alterado no puede inyectar código.
- **Validación de protocolos en URLs:** `QStore.sanitizeUrl()` solo admite `https:`, `http:`, `data:image/`, `blob:` y rutas relativas. Bloquea `javascript:`, `vbscript:` y cualquier otro esquema en imágenes, redes sociales y mapas.
- **Bloqueo por intentos fallidos:** tras cinco PIN incorrectos seguidos, el teclado del panel se bloquea 30 segundos con una alerta de seguridad y cuenta regresiva. Recargar la página no reinicia el bloqueo.
- **Sesión validada:** la sesión del panel se verifica en cada lectura (tipos, rol existente y usuario activo). Si se altera, se descarta y el sistema regresa al acceso por PIN.
- **Cabeceras de seguridad HTTP:** el archivo `_headers` define `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y `Strict-Transport-Security`. Además, todos los enlaces externos usan `rel="noopener noreferrer"`.

**Posicionamiento web**

- **Metadatos completos:** título, descripción, palabras clave, autores y directivas `robots` en cada página pública.
- **Open Graph y Twitter Cards:** vista previa profesional al compartir el enlace en WhatsApp y redes sociales.
- **Datos estructurados `Schema.org` (JSON-LD):** declaran `SoftwareApplication` (`BusinessApplication`, $499.00 MXN) y `Organization` con sede en Tuxtla Gutiérrez, Chiapas.
- **Archivos de indexación:** `robots.txt`, `sitemap.xml` y `manifest.json` para instalar el sitio como aplicación web progresiva (PWA).

---

## 5. Identidad Visual (Design System)

| Token | Nombre | Hexadecimal | Uso principal |
| --- | --- | --- | --- |
| `--q-coral` | **Rojo Coral** | `#D1312B` | Acciones principales, marca y estados activos |
| `--q-mostaza` | **Dorado Mostaza** | `#D1A059` | Acentos, insignias y enfoque de teclado |
| `--q-blanco` | **Blanco Puro** | `#FFFFFF` | Tarjetas y superficies de contenido |
| `--q-crema` | **Beige Crema** | `#EDE2CE` | Fondos cálidos y bordes suaves |
| `--q-carbon` | **Carbón** | `#1E1B18` | Texto principal y superficies oscuras |

| Familia tipográfica | Rol |
| --- | --- |
| **Fraunces** | Titulares y nombres de platillos |
| **Plus Jakarta Sans** | Interfaz y texto de lectura |
| `JetBrains Mono` | Precios, folios, PINs y cronómetros |

---

## 6. Autores y Créditos Académicos

> Proyecto desarrollado para la asignatura de **Creación de Empresas**, Ingeniería en Sistemas Computacionales, **Instituto de Estudios Superiores de Chiapas (IESCH)**, Tuxtla Gutiérrez, Chiapas. Octubre de 2026.

| Integrante | Responsabilidad |
| --- | --- |
| **Pablo Ángel Ramírez García** | Dirección del Proyecto e Ingeniería de Software |
| **José María Orantes Palacios** | Gestión de Contenidos, Operaciones y Control de Calidad |
| **Jocelin Magdalena Aguilar Rueda** | Diseño Gráfico, Identidad Corporativa y Experiencia de Usuario (UI/UX) |

**Docente titular:** Mtra. Xenia Culebro Montoya

---

<div align="center">

**Q-RICO** · Tuxtla Gutiérrez, Chiapas, México · 2026

</div>

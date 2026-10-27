# Q-RICO

Q-RICO es una plataforma SaaS de menús digitales interactivos y gestión gastronómica para micro, pequeñas y medianas empresas (MiPyMEs) del sector restaurantero. Por una suscripción fija de $499 MXN al mes, el negocio obtiene un menú web que sus clientes abren desde el celular (con o sin código QR de mesa) y un panel administrativo para operar cocina, caja, mesas, inventario y reportes. Ambos módulos se sincronizan en tiempo real sin necesidad de un servidor propio.

Proyecto desarrollado para la materia Creación de Empresas.

---

## 1. Descripción General

El propósito de Q-RICO es que cualquier negocio de comida, desde una fonda o una cafetería hasta una barra de sushi o una hamburguesería, pueda digitalizar su menú y recibir pedidos sin contratar desarrolladores ni imprimir cartas nuevas cada vez que cambia un precio.

- **Autogestión total.** Nombre, logotipo, portada, categorías, platillos, precios, fotografías, disponibilidad, mesas, WiFi, propinas y redes sociales se editan desde el panel administrativo. Ningún dato del negocio está escrito a mano en el código.
- **Tiempo real.** Cuando el restaurante marca un platillo como agotado, cambia un precio o la cocina avanza un pedido, el menú del comensal se actualiza al instante.
- **Sin fricción.** El comensal no está obligado a elegir una mesa ni a registrarse: agrega platillos y envía su pedido.

---

## 2. Arquitectura y Estructura del Proyecto

Es un sitio estático (HTML, CSS y JavaScript sin compilación) que se despliega en Render. Toda la información vive en un solo objeto, `qrico_saas_store`, administrado por `shared/js/store.js`.

```text
web/
├── shared/                              Núcleo compartido por ambos módulos
│   ├── css/
│   │   └── tokens.css                   Paleta oficial, tipografía y componentes base (botones, campos, chips, modales, avisos)
│   ├── js/
│   │   ├── store.js                     QStore: datos, persistencia, sincronización, migraciones y catálogo de demostración
│   │   └── ui.js                        QUI: iconos, avisos, modales (hoja inferior en móvil), confirmaciones y sonido
│   └── vendor/                          Copias locales de GSAP, Swiper, Lenis y canvas-confetti
│
├── menu-web/                            Menú del comensal
│   ├── index.html                       Entrada: redirige a pages/menu.html conservando ?mesa=X
│   ├── pages/
│   │   └── menu.html                    Estructura de la página del menú
│   ├── components/
│   │   ├── header.html                  Header coral y drawer del pedido
│   │   ├── sidebar.html                 Barra sticky de una fila: categorías y buscador
│   │   ├── card.html                    Tarjeta vertical del carrusel "Favoritos de la casa"
│   │   ├── cuadro_card.html             Tarjeta horizontal del menú con foto cuadrada
│   │   └── footer.html                  Footer de cuatro columnas
│   └── assets/
│       ├── images/logo/                 Logotipos de Q-RICO
│       ├── images/complementos/         Banners y fotografías locales de platillos (platillos/)
│       ├── scripts/menu.js              Lógica del comensal: menú, pedido, seguimiento, cuenta y animaciones
│       └── styles/                      menu.css, header.css, card.css, cuadro_card.css y footer.css
│
├── panel-administrativo/                Panel privado del restaurante (aplicación de una sola página)
│   ├── index.html                       Acceso por PIN de cuatro dígitos
│   ├── pages/
│   │   └── admin.html                   Estructura del panel: barra lateral, barra superior y vista activa
│   ├── components/
│   │   ├── admin_sidebar.html           Navegación lateral según el rol
│   │   └── views/                       dashboard, pos, kds, mesas, menu_stock, personal, reportes y configuracion
│   └── assets/
│       ├── scripts/admin.js             Login, rutas, vistas, cobro, tickets, códigos QR y PDF
│       └── styles/                      admin.css y admin_sidebar.css
│
├── scripts/
│   └── vendor.mjs                       Copia las librerías de node_modules/ a shared/vendor/
├── package.json                         Dependencias de animación
├── DESIGN.md                            Sistema de diseño y arquitectura detallada
└── README.md                            Este documento
```

Los componentes HTML se cargan con `fetch` y se insertan en su página, por lo que el proyecto debe abrirse desde un servidor HTTP (ver la sección 8).

---

## 3. Características Principales

### Menú web (`menu-web/`)

- **Interfaz limpia.** Header con nombre y estado del restaurante, una cintilla de una sola línea (horario, cómo llegar y WiFi), barra de categorías de una fila y una sola acción por tarjeta. La barra inferior de pedido solo aparece cuando hay platillos o un pedido en curso.
- **Catálogo multigastronómico.** Seis categorías y 23 platillos de demostración: comida casera y mexicana, hamburguesas, makis, sushi y ramen, entradas, panadería y café, postres y bebidas.
- **Carrusel táctil.** Banner promocional y carrusel "Favoritos de la casa" con perspectiva 3D, arrastre con el dedo y paginación dinámica.
- **Navegación por categorías.** Chips con indicador deslizante que siguen la sección visible y buscador por platillo o ingrediente.
- **Personalización.** Cantidades, notas rápidas para cocina adaptadas a cada tipo de platillo (por ejemplo, "Término medio" en hamburguesas o "Sin ajonjolí" en makis) y texto libre. El botón "+" de cada tarjeta se convierte en un contador "- 1 +".
- **Seguimiento en vivo.** Barra de progreso del pedido (recibido, en preparación, listo) y aviso cuando está listo, adaptado a la modalidad: en mesa, para recoger en barra o para llevar.
- **División de cuenta.** Con QR de mesa: propina elegible y cuenta en una sola, en partes iguales o por platillo; llamado al mesero con un botón compacto.
- **Diseño mobile-first.** Modal y drawer como hojas inferiores deslizables, áreas táctiles de al menos 44 x 44 px y desplazamiento suave que respeta la preferencia de movimiento reducido.

### Panel administrativo (`panel-administrativo/`)

- **Acceso por PIN** con cuatro roles (gerente, cajero, cocina y mesero) y vistas permitidas según el rol.
- **KDS (pantalla de cocina).** Comandas en columnas Pendiente, En preparación y Listo, con arrastrar y soltar, cronómetros, notas resaltadas, sonido y origen del pedido (mesa, mostrador o para llevar).
- **POS (punto de venta).** Órdenes de mesa, mostrador y para llevar; cobro en efectivo, tarjeta, transferencia o dividido; cobro de los pedidos directos que llegan desde el menú web.
- **Inventario en vivo.** Alta y edición de platillos y categorías, fotografías y disponibilidad que se refleja de inmediato en el menú del comensal.
- **Mesas y generador de QR.** Mapa de mesas con su estado y un código QR por mesa, descargable en PNG o PDF.
- **Tickets y reportes en PDF.** Ticket de 80 mm, corte de caja y gráficas de ventas.

---

## 4. Flujo Operativo para MiPyMEs

Muchos negocios pequeños no trabajan con mesas numeradas: venden en mostrador, para llevar o por pedido rápido. Por eso Q-RICO **nunca bloquea el pedido** por falta de mesa.

### Pedido directo (sin mesa)

Es el caso más común. El cliente abre `menu-web/` desde un QR general, un enlace o redes sociales.

1. Agrega platillos al pedido con el botón "+" o desde el detalle del platillo.
2. Abre "Ver mi pedido". El drawer muestra el distintivo "Pedido directo".
3. Elige la modalidad: "Para comer aquí" o "Para llevar".
4. Escribe, si quiere, su nombre o una referencia (por ejemplo, "Mariana" o "chamarra roja"). Es opcional y se recuerda en su dispositivo.
5. Presiona "Enviar pedido". El pedido llega a cocina y aparece en el KDS como "Mostrador · Carlos" o "Para llevar · Mariana".
6. El cliente ve el avance en vivo y recibe un aviso cuando puede recogerlo.
7. En el panel, el cajero lo cobra desde **Punto de venta, Pedidos directos**; el ticket muestra el nombre del cliente.

### Pedido con QR de mesa (detección silenciosa)

Si el local imprime un código QR por mesa, cada código abre `menu-web/?mesa=X`.

- Si la mesa existe, se asocia automáticamente en segundo plano. Solo se muestra como el distintivo "Mesa X" dentro del drawer.
- Se habilitan la pestaña "Cuenta de la mesa" (propina y división de la cuenta) y un botón compacto de asistencia para "Llamar a mi mesero" o "Pedir la cuenta".
- Si el número de mesa ya no existe, el menú muestra un aviso discreto y el pedido continúa como pedido directo.

---

## 5. Sistema de Diseño y Paleta de Colores

### Paleta oficial (`shared/css/tokens.css`)

| Variable CSS | Hexadecimal | Uso |
|---|---|---|
| `--q-coral` | `#D1312B` | Header, precios, botones de acción principal, letra "Q" |
| `--q-mostaza` | `#D1A059` | Acentos secundarios, palabra "RICO", etiquetas destacadas, bordes editoriales |
| `--q-blanco` | `#FFFFFF` | Superficie principal, tarjetas, modales y barra sticky |
| `--q-crema` | `#EDE2CE` | Chips inactivos, notas rápidas y distintivos |
| `--q-crema-claro` | `#F6F0E5` | Bandas alternas del menú y fondos secundarios |
| `--q-carbon` | `#1E1B18` (`#141210` en el menú web) | Texto principal y barra lateral del panel |
| `--q-salvia` | `#2E7D32` | Estados de éxito: mesa libre, pedido listo |

### Tipografía (Google Fonts)

| Familia | Uso |
|---|---|
| Fraunces | Títulos: secciones, categorías, nombres de platillo, drawer y modales |
| Plus Jakarta Sans | Interfaz: navegación, botones, chips, descripciones y formularios |
| JetBrains Mono | Datos: precios, folios, cronómetros del KDS, PIN y tickets |

El detalle completo del sistema de diseño (distribución del color, componentes, animaciones y reglas para móvil) está en [DESIGN.md](DESIGN.md).

---

## 6. Stack Tecnológico y Librerías

| Tecnología | Versión | Uso |
|---|---|---|
| HTML5 | - | Estructura de páginas y componentes |
| CSS3 modular | - | Una hoja por componente sobre los tokens compartidos |
| JavaScript ES6+ | - | Lógica sin frameworks ni compilación |
| Lucide Icons | 0.454.0 | Iconografía vectorial en ambos módulos |
| GSAP (con ScrollTrigger y Flip) | 3.15.0 en el menú, 3.12.5 en el panel | Animaciones, aparición al hacer scroll y reacomodo de tarjetas al buscar |
| Swiper | 11.2.10 | Carrusel promocional y carrusel 3D de favoritos |
| Lenis | 1.3.26 | Desplazamiento suave e inercial |
| Canvas Confetti | 1.9.4 | Celebración al enviar un pedido a cocina |
| Chart.js | 4.4.4 | Gráficas del dashboard y reportes |
| SortableJS | 1.15.3 | Arrastrar y soltar comandas en el KDS |
| QRCode.js | 1.0.0 | Códigos QR por mesa |
| html2pdf.js | 0.10.2 | Tickets, corte de caja y hoja de QR en PDF |

Las librerías de animación del menú se instalan con npm y se copian a `shared/vendor/`, por lo que funcionan sin conexión. Lucide y las librerías del panel se cargan desde CDN con versión fija.

---

## 7. Credenciales de Acceso (Modo Demostración)

| Perfil | Nombre de demostración | PIN | Entra a |
|---|---|---|---|
| Gerente | Andrea Morales | `1234` | Dashboard (acceso a todas las vistas) |
| Cajero | Lucía Ramírez | `2222` | Punto de venta |
| Cocina | Javier Torres | `3333` | KDS |
| Mesero | Diego Hernández | `4444` | Mesas y QR |

---

## 8. Instalación y Ejecución Local

No se necesita compilar ni instalar dependencias para usar el proyecto.

1. Clona o descarga el repositorio y abre una terminal en la carpeta `web/`.
2. Levanta un servidor HTTP local con una de estas opciones:

   ```bash
   npx serve .
   ```

   o bien:

   ```bash
   python3 -m http.server 8080
   ```

   (En Windows puede usarse `python -m http.server 8080`, o la extensión Live Server de VS Code.)
3. Abre en el navegador la dirección que indica la terminal (`http://localhost:3000` con `npx serve`, `http://localhost:8080` con Python):

   | Página | Ruta |
   |---|---|
   | Menú del comensal (pedido directo) | `/menu-web/` |
   | Menú con QR de la mesa 4 | `/menu-web/?mesa=4` |
   | Panel administrativo | `/panel-administrativo/` |

No abras los archivos con doble clic: los componentes se cargan con `fetch` y el navegador lo bloquea fuera de un servidor.

Para actualizar las librerías de animación, cambia la versión en `package.json` y ejecuta `npm install`; el script `postinstall` vuelve a copiarlas a `shared/vendor/`. Para regresar a los datos de ejemplo, usa **Configuración, Restaurar datos de demostración** en el panel.

---

## 9. Sincronización en Tiempo Real

El menú y el panel comparten el objeto `qrico_saas_store` en `localStorage`. Cada cambio aumenta un número de revisión y se anuncia por `BroadcastChannel` (canal `qrico_saas_channel`) y por el evento `storage` del navegador; la otra pestaña lee los datos nuevos y se vuelve a dibujar.

Para probarlo:

1. Levanta el servidor (sección 8).
2. En una pestaña abre el panel administrativo, entra con el PIN `3333` (Cocina) y deja abierta la vista **KDS**.
3. En otra pestaña del **mismo navegador** abre `/menu-web/`.
4. En el menú, agrega dos platillos, abre "Ver mi pedido", elige "Para llevar", escribe un nombre y presiona "Enviar pedido".
5. En el KDS aparece la comanda nueva con sonido y la etiqueta "Para llevar · (nombre)".
6. En el KDS presiona "Iniciar" y luego "Marcar listo". En el menú, la barra de seguimiento avanza y aparece el aviso de pedido listo.
7. Para probar el inventario, entra como Gerente (`1234`), ve a **Menú y stock** y marca un platillo como agotado: en el menú se muestra agotado al instante.

Limitación conocida: `localStorage` vive en el navegador, así que la sincronización funciona entre pestañas y ventanas del mismo navegador y dispositivo. Para conectar el celular del comensal con la tableta de cocina, el siguiente paso es sustituir la capa interna de `QStore` por un backend (por ejemplo Supabase, Firebase o una API propia); la interfaz `get`, `update` y `subscribe` ya está preparada para ese cambio sin modificar las vistas.

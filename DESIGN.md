# Q-RICO · Sistema de diseño y arquitectura

> SaaS de suscripción fija ($499 MXN/mes) para micro, pequeñas y medianas empresas gastronómicas: menú web por QR para el comensal (`menu-web/`) y panel autogestionable para el restaurante (`panel-administrativo/`), sincronizados en tiempo real sin servidor.

---

## 1. Principios

1. **Cero código para el restaurante.** Todo lo que ve el comensal (nombre, logo, portada, menú, precios, stock, mesas, WiFi, propinas, redes) se edita desde `panel-administrativo/`. Ningún dato del negocio está escrito a mano en HTML.
2. **Una sola fuente de verdad.** Ambos módulos leen y escriben el mismo objeto `qrico_saas_store` mediante `shared/js/store.js`.
3. **Sin fricción para la MiPyME.** Una fonda, una cafetería, una barra de sushi o una dark kitchen no siempre trabaja con mesas. El comensal **nunca** está obligado a elegir mesa: sin QR de mesa, su pedido llega a cocina como *pedido directo* (para comer aquí o para llevar). Si el local sí usa QR por mesa, la mesa se asocia sola.
4. **El platillo es el protagonista.** Interfaz desaturada: una acción por tarjeta, una etiqueta como máximo, barra sticky de una sola fila y controles secundarios (llamar mesero, cuenta) solo cuando aplican.
5. **Cálido y gastronómico, nunca "genérico de IA".** Sin gradientes neón, sin morados ni azules, sin emojis como iconos. Superficies blancas alternadas con crema claro, bordes mostaza sutiles, sombras cálidas tenues y tipografía editorial.
6. **Operación primero.** En cocina y caja, lo urgente se lee a 2 metros: folios y cronómetros en monoespaciada, notas del comensal resaltadas en mostaza y estados codificados por color.

---

## 2. Tokens de color (`shared/css/tokens.css`)

| Token | Valor | Uso |
|---|---|---|
| `--q-coral` | `#D1312B` | Header, CTA principal, precios, letra "Q", alertas críticas, estado *Pendiente/Ocupada* |
| `--q-coral-hover` | `#B52621` | Hover del CTA |
| `--q-coral-soft` | `#FBECEA` | Fondo de badges, íconos de categoría y alertas coral |
| `--q-mostaza` | `#D1A059` | Acento secundario, "RICO", etiquetas destacadas, bordes editoriales, *En preparación*, *Llamando mesero* |
| `--q-mostaza-hover` | `#B88944` | Hover del botón dorado |
| `--q-mostaza-soft` | `#F6ECDC` | Notas para cocina, etiqueta "Popular", conteos |
| `--q-blanco` | `#FFFFFF` | Superficie principal, tarjetas, modales, barra sticky, tickets |
| `--q-crema` | `#EDE2CE` | Chips inactivos, notas rápidas, distintivo "Pedido directo" |
| `--q-crema-claro` | `#F6F0E5` | Bandas alternas del menú, buscador en reposo, fondo del panel |
| `--q-carbon` | `#1E1B18` | Texto principal, sidebar del panel (en `menu-web/` se sobrescribe a `#141210`) |
| `--q-piedra` | `#6E655F` | Texto secundario |
| `--q-borde` | `#DFD3BC` | Divisores y bordes de 1px |
| `--q-salvia` | `#2E7D32` | Éxito, *Libre*, *Listo para servir* |

**Sombras:** `--q-shadow: 0 4px 20px -2px rgba(30,27,24,.06)` en reposo; `--q-shadow-md` / `--q-shadow-lg` para hover y modales.
**Radios:** 8 / 12 / 18 px, 22–24 px en tarjetas de favoritos y hojas inferiores, y `999px` para píldoras. **Curva de movimiento:** `cubic-bezier(0.22, 1, 0.36, 1)`.
**Bordes mostaza sutiles:** `rgba(209, 160, 89, 0.3–0.5)` en reposo y `--q-mostaza` sólido en hover.

### Distribución de color en el menú web (`menu-web/`)

| Color | Dónde |
|---|---|
| Coral `#D1312B` | Header completo, precios, botón `+` y contador `− 1 +`, indicador deslizante del chip activo, barra "Ver mi pedido", flechas de carrusel |
| Blanco `#FFFFFF` | Fondo base, tarjetas, modales, barra sticky, sección de favoritos y bandas pares |
| Crema claro `#F6F0E5` | Bandas impares de categoría y buscador en reposo |
| Crema `#EDE2CE` | Notas rápidas para cocina y chips inactivos al pasar el cursor |
| Mostaza `#D1A059` | Palabra "RICO", subrayado de títulos, bordes de tarjetas, divisor de categoría, etiqueta "Popular", paginación inactiva |
| Carbón `#141210` | Texto principal y barra flotante en modo seguimiento |
| `#111111` | Footer completo |

**Secuencia de la página:** header coral → carrusel promocional → cintilla compacta (horario · cómo llegar · WiFi) → seguimiento del pedido (si hay uno en curso) → barra sticky de una fila (chips + buscador) → **Favoritos de la casa** (carrusel 3D) → una banda por categoría alternando crema claro y blanco → footer de 4 columnas.

Cada platillo aparece una sola vez en las bandas; los favoritos se repiten solo en su carrusel. La alternancia se recalcula en `recolorearBandas()` con las bandas visibles, así que el ritmo crema/blanco se conserva aunque la búsqueda oculte categorías.

### Semántica de estados (consistente en todo el producto)

| Estado | Color |
|---|---|
| Pedido *Recibido* / Mesa *Ocupada* | Coral |
| Pedido *En preparación* / Mesa *Llamando mesero* | Mostaza |
| Pedido *Listo* / Mesa *Libre* | Salvia |
| Mesa *Pidiendo cuenta* | Carbón |

---

## 3. Tipografía (Google Fonts)

| Rol | Familia | Uso |
|---|---|---|
| Display | **Fraunces** 500–700 | Titular del carrusel, "Favoritos de la casa", nombre de cada categoría, nombres de platillo, títulos de drawer y modales, nombre del restaurante en el header, frase del footer |
| Interfaz | **Plus Jakarta Sans** 400–800 | Navegación, botones, chips, descripciones y controles |
| Datos | **JetBrains Mono** 500–700 | Precios, folios, cronómetros del KDS, PIN, tickets |

Reglas: títulos en mayúsculas y minúsculas (no en versalitas) para dar aire; `line-height: 1.5` en lectura, `text-wrap: pretty` en descripciones y `balance` en títulos; descripciones de platillo limitadas a 2 líneas en la tarjeta. En móvil el titular del carrusel usa `clamp(1.35rem, 5vw, 2rem)`.

---

## 4. Referencias de UI/UX del menú web

| Referencia | Qué se tomó |
|---|---|
| **Bisquets Obregón** | Carrusel de favoritos con perspectiva 3D (coverflow sutil): fotografía protagonista, categoría discreta, título, precio limpio y una sola acción por tarjeta. |
| **Toteat / Yoake Sushi** | Barra sticky de una sola fila con chips desplazables, indicador activo y buscador tipo píldora. Tarjeta horizontal: texto a la izquierda, foto cuadrada a la derecha y botón `+` circular que se vuelve contador. Barra inferior "Ver mi pedido (X) • $Subtotal" que solo aparece con productos. Hojas inferiores en móvil. |
| **Toks** | Header institucional coral con logo en contenedor blanco y navegación corta; carrusel promocional con etiquetas doradas ("Favorito de la casa" y descuento en coral); footer oscuro de 4 columnas. |
| **El sabor de México** (identidad) | Bandas alternas blanco/crema, Fraunces en títulos, bordes mostaza sutiles. |

---

## 5. Librerías

### Menú web: instaladas con npm y servidas desde `shared/vendor/`

| Librería | Versión | Para qué |
|---|---|---|
| GSAP | 3.15.0 | Animaciones base, rebote elástico del `+`, contador, vuelo al carrito, celebración |
| GSAP ScrollTrigger | 3.15.0 | Aparición escalonada de tarjetas y títulos al hacer scroll, parallax del banner |
| GSAP Flip | 3.15.0 | Reacomodo fluido de las tarjetas al buscar (sin parpadeos) |
| Swiper | 11.2.10 | Carrusel promocional (efecto *creative*) y favoritos (coverflow 3D) con arrastre táctil y paginación dinámica |
| Lenis | 1.3.26 | Desplazamiento suave e inercial con rueda o trackpad |
| canvas-confetti | 1.9.4 | Micro-celebración al enviar un pedido a cocina |

`package.json` declara estas dependencias y `scripts/vendor.mjs` copia sus archivos de distribución a `shared/vendor/` (se ejecuta solo tras `npm install`, o con `npm run vendor`). Las copias están versionadas en el repositorio: **el sitio funciona al abrirlo, sin compilación y sin internet para las animaciones**. `shared/vendor/versiones.json` registra qué versión hay de cada una.

### Por CDN con versión fija

| Librería | Versión | Dónde | Para qué |
|---|---|---|---|
| Lucide Icons | 0.454.0 | ambos | Iconografía vectorial (`stroke-width: 1.75`) |
| GSAP | 3.12.5 | panel | Entradas, PIN, modales y KDS |
| Chart.js | 4.4.4 | panel | Dashboard y reportes |
| SortableJS | 1.15.3 | panel | Drag & drop del KDS |
| QRCode.js | 1.0.0 | panel | QR por mesa (PNG y PDF) |
| html2pdf.js | 0.10.2 | panel | Tickets de 80 mm, corte de caja, hoja de QR |

---

## 6. Sistema de animación del menú web

| Interacción | Cómo |
|---|---|
| Carrusel promocional | Swiper `effect: 'creative'` (la diapositiva anterior se aleja con profundidad), autoplay de 6 s que se pausa con el cursor, arrastre con el dedo; el texto entra escalonado con GSAP y la foto hace un zoom lento (Ken Burns) con parallax ligado al scroll |
| Favoritos de la casa | Swiper `effect: 'coverflow'` (rotación 10°, profundidad 120, escala 0.94), paginación dinámica y teclado. Tocar una tarjeta lateral la centra; las acciones viven en la tarjeta activa |
| Entrada del menú | `ScrollTrigger.batch`: tarjetas y títulos aparecen escalonados una sola vez al entrar en pantalla |
| Botón `+` → `− 1 +` | Al agregar, el círculo se estira hasta el contador con `back.out` y el número rebota con `elastic.out`; cada cambio desliza el número hacia arriba o abajo |
| Chips de categoría | Indicador coral que se desliza con GSAP bajo el chip activo; ScrollSpy lo mueve al pasar por cada sección y centra el chip en la fila |
| Búsqueda | `Flip.getState` / `Flip.from`: las tarjetas que quedan se reacomodan y las que vuelven aparecen con escala suave |
| Desplazamiento | Lenis con la rueda; en pantallas táctiles se respeta el scroll nativo. Se detiene mientras haya un modal o el drawer abierto (`data-lenis-prevent`) |
| Envío a cocina | Tarjeta "¡Pedido enviado!" + dos ráfagas de canvas-confetti con la paleta oficial |
| Hover de tarjetas | Elevación suave y `scale(1.05)` de la foto con `cubic-bezier(0.22, 1, 0.36, 1)` |

**Movimiento reducido:** con `prefers-reduced-motion: reduce` no se crea Lenis, no hay autoplay, ni aparición por scroll, ni Flip, ni confeti; todo queda visible de inmediato. Si alguna librería no carga, el menú sigue funcionando (los carruseles caen a desplazamiento horizontal nativo).

---

## 7. Flujo del pedido (MiPyME primero)

| Entrada | Qué ve el comensal | Cómo llega a cocina |
|---|---|---|
| Sin `?mesa` (lo más común) | Drawer con distintivo **"Pedido directo"**, selector *Para comer aquí / Para llevar* y campo opcional *"Tu nombre o referencia"*. Botón "Enviar pedido". | `mesaId: null`, `tipo: 'mostrador'` o `'llevar'`, `comensal`. El KDS lo muestra como "Mostrador · Carlos" o "Para llevar · Mariana" |
| Con `?mesa=X` válida | La mesa se asocia en silencio: distintivo **"Mesa X · zona"** en el drawer, pestaña *Cuenta de la mesa* y botón compacto de asistencia (*Llamar a mi mesero* / *Pedir la cuenta*). | `mesaId`, `tipo: 'mesa'` |
| Con `?mesa=X` que ya no existe | Aviso discreto y se limpia la URL; sigue como pedido directo. | Igual que sin mesa |

- El nombre o referencia se recuerda en el dispositivo y la modalidad en la sesión.
- El seguimiento en vivo adapta el aviso de "listo": *"Va en camino a tu mesa"*, *"Pasa a recogerlo a la barra"* o *"Listo para llevar. Recógelo en caja"*.
- En el panel, los pedidos directos por cobrar aparecen en **Punto de venta → Pedidos directos**; al cobrarlos se registran como venta de mostrador o para llevar con el nombre del cliente en el ticket. Como en una MiPyME se suele pagar antes de recoger, pagar un pedido directo no oculta su seguimiento; en mesa, sí.

---

## 8. Estructura del repositorio

```
package.json                    Dependencias de animación (gsap, swiper, lenis, canvas-confetti)
scripts/vendor.mjs              Copia las librerías de node_modules/ a shared/vendor/
shared/                         Núcleo compartido por ambos módulos
  css/tokens.css                Tokens + componentes base (botones, inputs, switch, chips, badges, modal/hoja inferior, toast)
  js/store.js                   QStore: estado, persistencia, sincronización, migración, catálogo semilla, consultas
  js/ui.js                      QUI: iconos, toasts, modales, hoja arrastrable, confirmaciones, sonido, animaciones
  vendor/                       gsap · swiper · lenis · canvas-confetti (copias locales versionadas)
menu-web/                       Menú del comensal
  index.html                    Redirige a pages/menu.html conservando ?mesa=X
  pages/menu.html               Shell de la página
  components/header.html        Header coral + drawer (tu pedido y cuenta de la mesa)
  components/sidebar.html       Barra sticky de una fila: chips de categoría + buscador
  components/card.html          Tarjeta vertical de favoritos
  components/cuadro_card.html   Tarjeta horizontal con foto cuadrada
  components/footer.html        Footer de 4 columnas
  assets/images/logo/           Logotipos de Q-RICO
  assets/images/complementos/   Banners y platillos/ (fotografías locales de la demo)
  assets/scripts/menu.js        Lógica del comensal
  assets/styles/                menu · header · card · cuadro_card · footer
panel-administrativo/           Panel del restaurante (SPA)
  index.html                    Acceso por PIN de 4 dígitos
  pages/admin.html              Shell (sidebar + topbar + vista)
  components/admin_sidebar.html Navegación lateral
  components/views/             dashboard · pos · kds · mesas · menu_stock · personal · reportes · configuracion
  assets/scripts/admin.js       Login, router, vistas, cobro, tickets, QR y PDF
  assets/styles/                admin (login, componentes y vistas) · admin_sidebar (sidebar y topbar)
```

- Las plantillas HTML usan marcadores `{{clave}}`; los valores se escapan con `QStore.escapeHtml` antes de insertarse.
- Los componentes se cargan con `fetch` y se insertan en la página (`pages/*.html`), por lo que **las rutas relativas dentro de un componente se resuelven desde la página**, no desde el archivo del componente. Ejemplo: el botón "Ver menú" de `components/views/configuracion.html` usa `../../menu-web/` porque vive dentro de `panel-administrativo/pages/admin.html`.

---

## 9. Estado compartido · `qrico_saas_store`

### Esquema (versión 4)

```js
{
  version: 4, rev: 128,                       // rev aumenta en cada escritura
  negocio: { nombre, eslogan, logo, portada, direccion, telefono, horario,
             wifi: { red, clave }, moneda, propinas: [0,10,15,20], propinaDefault,
             mensajeTicket, abierto, frasePie, razonSocial,
             redes: { facebook, instagram, tiktok } },
  plan: { nombre, precio: 499, moneda: 'MXN', periodo: 'mes', desde },
  categorias: [{ id, nombre, icono, orden }],
  platillos:  [{ id, nombre, descripcion, precio, precioAnterior|null, categoriaId, imagen, tiempo, disponible, destacado }],
  mesas:      [{ id, numero, zona, capacidad, abierta, abiertaEn }],
  pedidos:    [{ id, folio, mesaId|null, comensal|null, origen: 'qr'|'pos', tipo: 'mesa'|'mostrador'|'llevar',
                 estado: 'pendiente'|'preparacion'|'listo'|'entregado', pagado,
                 items: [{ platilloId, nombre, precio, cantidad, notas }], total,
                 creadoEn, actualizadoEn, iniciadoEn?, listoEn?, entregadoEn? }],
  ventas:     [{ id, folio, mesaId|null, tipo, comensal?, items, subtotal, propina, total,
                 metodo: 'efectivo'|'tarjeta'|'transferencia'|'dividido',
                 pagos: [{ metodo, monto }], personas, recibido, cambio, cerradoEn, cajero }],
  alertas:    [{ id, mesaId, tipo: 'mesero'|'cuenta', nota, split?, creadoEn, atendida }],
  personal:   [{ id, nombre, rol: 'gerente'|'cajero'|'cocina'|'mesero', pin, activo }],
  contadores: { pedido, venta },
  ultimoEvento: { type, at, rev, ...datos }
}
```

`QStore.TIPOS_PEDIDO` describe las modalidades (`mesa`, `mostrador` = para comer aquí, `llevar`) y `QStore.q.pedidosDirectosAbiertos(s)` devuelve los pedidos sin mesa pendientes de cobro.

Los pedidos y ventas guardan una **copia** del nombre y precio del platillo: si el restaurante cambia un precio, los tickets históricos no se alteran.

### Catálogo de demostración (multigastronómico)

Seis categorías y 23 platillos que muestran que Q-RICO sirve igual a una fonda, una hamburguesería, una barra de sushi o una cafetería: **Comida Casera y Mexicana** (`utensils`), **Hamburguesas y Urban** (`sandwich`), **Makis, Sushi y Ramen** (`soup`), **Entradas y Para Compartir** (`salad`), **Panadería y Café** (`coffee`) y **Postres y Bebidas** (`cake-slice`). Siete platillos son favoritos, tres tienen precio anterior (descuento) y el flan aparece agotado para mostrar ese estado. La demo incluye pedidos en mesa y dos pedidos directos (mostrador y para llevar).

Las fotos combinan los archivos locales de `menu-web/assets/images/complementos/platillos/` (aguachile, yakimeshi, mole, cheesecake y limonada) con fotografías libres de Unsplash. Los banners de `complementos/` (`asian.jpeg`, `carne.jpeg`, `cofee.jpeg`) no se usan como foto de platillo porque traen texto de plantilla. El menú pide a Unsplash solo el ancho que muestra (`QUI.imgTag(src, alt, clase, { ancho })`): 360 px en tarjetas, 640 en favoritos, 900 en el detalle y 1400 en el banner.

### Migraciones

`readRaw()` pasa los datos guardados por `actualizarEsquema()`:

1. **Versión 3 → 4 (`migrarV3aV4`)**: reemplaza el catálogo de demostración anterior por el multigastronómico, **conserva** las categorías y platillos creados por el restaurante (reubicando los que estaban en categorías de demo: antojitos y platos fuertes → Comida Casera, bebidas → Postres y Bebidas, café → Panadería y Café), y solo renueva pedidos, alertas y ventas si siguen siendo los de demostración, para no duplicar folios. Mesas, personal y configuración no se tocan. El resultado se guarda de inmediato.
2. **`migrar()`** rellena campos agregados después (redes, frase del pie, razón social, precio anterior) y traduce rutas de estructuras anteriores.

Los respaldos importados desde **Configuración** pasan por la misma función, así que un respaldo de la versión 3 se puede restaurar.

### Rutas de imágenes

- Las imágenes locales se guardan relativas a la raíz del proyecto (`menu-web/assets/images/...`) y se resuelven con `QStore.resolveAsset()`, calculado desde la ubicación real de `store.js`; así funciona igual en Live Server, en Render o en un subdirectorio.
- `normalizarRuta()` traduce rutas guardadas antes de renombrar carpetas: `usuario/img/` → `menu-web/assets/images/`, `usuario/` → `menu-web/` y `cliente/` → `panel-administrativo/`. Se aplica en `migrar()` y en `resolveAsset()`.
- Las imágenes subidas se comprimen con canvas (`QStore.compressImage`) a JPEG de 720 px antes de guardarse en Base64. Si se llena `localStorage`, la escritura se revierte y se muestra el error.
- El QR de cada mesa apunta a `menu-web/?mesa=X` (`QStore.urlMenuMesa`).

### Flujo de sincronización

```
 menu-web/ (comensal)                         panel-administrativo/ (restaurante)
 --------------------                         -----------------------------------
 QStore.update(mutador, evento)
   1. lee lo más reciente de localStorage
   2. aplica el mutador
   3. rev++ y ultimoEvento = evento
   4. escribe localStorage --------------->  evento "storage"
   5. BroadcastChannel.postMessage({rev}) ->  canal qrico_saas_channel
                                              ambos llaman a syncFromStorage()
   6. notifica a sus suscriptores              si rev cambió: render + aviso
```

- `QStore.subscribe(fn)` recibe `(estado, evento, remoto)`. `remoto = true` cuando el cambio vino de otra pestaña. Con eso se deciden sonidos y toasts sin duplicarlos.
- Ambas vías (BroadcastChannel y `storage`) se deduplican comparando `rev`.
- El menú web solo reconstruye las tarjetas cuando cambia algo visible del catálogo (`firmaMenu()`); los cambios del carrito actualizan únicamente los contadores de cada tarjeta.

### Eventos que viajan entre módulos

| Evento | Origen | Efecto |
|---|---|---|
| `pedido:nuevo` | comensal / POS | Toast y sonido en el panel con la modalidad y el nombre; la tarjeta aparece y parpadea en el KDS |
| `pedido:estado` | KDS | La barra de seguimiento del comensal avanza; aviso de "listo" según la modalidad |
| `alerta:nueva` | comensal (solo con mesa) | Campana con contador, mesa pulsando en el mapa, sonido |
| `alerta:atendida` | panel | El comensal recibe "Tu mesero va en camino" |
| `stock:actualizado` / `menu:actualizado` | panel | El menú web se vuelve a dibujar al instante |
| `negocio:actualizado` | panel | Header, portada, cintilla y footer del comensal se actualizan |
| `venta:cerrada` | POS / mesas | Mesa liberada o pedido directo marcado como pagado |
| `reset` | configuración | Ambos módulos recargan los datos de demostración |

---

## 10. Roles y permisos

| Rol | Vistas | Entra a |
|---|---|---|
| Gerente | Todas | Dashboard |
| Cajero | Dashboard, POS, Mesas, Reportes | POS |
| Cocina | KDS, Menú y stock (solo disponibilidad) | KDS |
| Mesero | Mesas, POS, KDS | Mesas |

La sesión vive en `sessionStorage.qrico_sesion`. Siempre debe quedar al menos un gerente activo, y nadie puede desactivarse a sí mismo.

**PINs de demostración:** Gerente `1234` · Cajero `2222` · Cocina `3333` · Mesero `4444`.

---

## 11. Patrones de componentes del menú web

- **Header:** logo en caja blanca, nombre del restaurante en Fraunces con su estado (*Abierto* en verde / *Cerrado*), navegación *Menú | Conócenos | Ubicación y WiFi* y, a la derecha, solo el botón del pedido con contador y el menú móvil.
- **Cintilla:** píldoras ligeras en una sola línea: horario, *Cómo llegar* (Google Maps) y *WiFi: copiar clave*.
- **Barra sticky:** una fila. Chips desplazables con indicador deslizante y ScrollSpy (llevan a su sección, no filtran) + buscador tipo píldora. En móvil el buscador es una lupa que se despliega sobre la fila; en escritorio aparecen flechas para desplazar los chips con el ratón. La búsqueda coincide con el inicio de cada palabra del nombre o la descripción y, si no encuentra nada, con el nombre de la categoría.
- **Tarjeta vertical de favoritos (`card.html`):** foto cuadrada protagonista con sombra interior, categoría en mostaza, título en Fraunces, precio en mono y una sola acción: *Agregar*, que se convierte en contador.
- **Tarjeta horizontal (`cuadro_card.html`):** máximo una etiqueta (*Agotado*, *-XX%* o *Popular*), título, descripción de 2 líneas y precio coral; foto cuadrada a la derecha (128 px en escritorio, 112 px en tableta, 108 px en móvil) con el `+` circular que se vuelve `− N +`.
- **Banda:** `.banda.banda--crema` o `.banda.banda--blanco` a todo el ancho; ícono de categoría en recuadro coral suave, nombre en Fraunces, conteo en píldora mostaza y divisor mostaza sutil.
- **Barra flotante:** oculta mientras no haya platillos ni pedido en curso. Con productos: *"Ver mi pedido (X) • $Subtotal"* en coral. Con un pedido en curso y el carrito vacío: modo seguimiento en carbón. El botón de asistencia (*Mesa X*) solo existe si se entró con QR de mesa.
- **Drawer del pedido:** panel lateral en escritorio y hoja inferior en móvil. Distintivo de modalidad, líneas con notas para cocina editables (se fusionan si dos líneas quedan con la misma nota), detalles opcionales del pedido y, con mesa, la pestaña *Cuenta de la mesa* con propina y cuenta dividida (una cuenta, partes iguales o por platillo).
- **Modal / hoja inferior:** encabezado en Fraunces; en móvil sube desde abajo con barra para arrastrar y se cierra deslizándola.
- **Toast:** fondo carbón con borde izquierdo del color semántico; en móvil se muestra arriba.

---

## 12. Adaptación móvil y táctil

| Regla | Valor |
|---|---|
| Header + barra sticky al hacer scroll (móvil) | 56 px + 54 px (≤ 120 px) |
| Banner promocional en móvil | 264 px de alto, titular `clamp(1.35rem, 5vw, 2rem)`, sin descripción |
| Tarjeta horizontal en móvil | Texto a la izquierda, foto de 108 × 108 px con radio de 12 px |
| Modal de platillo y drawer en móvil | Hoja inferior: radio `24px 24px 0 0`, alto máximo `90dvh`, botón principal respetando `env(safe-area-inset-bottom)` |
| Áreas táctiles | Mínimo 44 × 44 px; donde el círculo visible es menor, un `::after` extiende el área |
| Carruseles y chips | Sin barra de desplazamiento (`scrollbar-width: none`) y con degradado lateral (`mask-image`) del lado donde hay más contenido |
| Tabletas (768–1024 px) | Dos columnas de tarjetas, sin flechas en carruseles (se arrastran) |

---

## 13. Cómo ejecutar

El proyecto debe servirse por HTTP porque los componentes y las vistas se cargan con `fetch`:

```bash
npx serve .            # o la extensión Live Server, o python -m http.server
```

- Comensal sin mesa (pedido directo): `http://localhost:3000/menu-web/`
- Comensal con QR de mesa: `http://localhost:3000/menu-web/?mesa=4`
- Restaurante: `http://localhost:3000/panel-administrativo/`

`npm install` solo hace falta para actualizar las librerías de animación (vuelve a copiarlas a `shared/vendor/`). Para probar la sincronización, abre el menú y el panel en pestañas del mismo navegador. Para volver a empezar, usa **Configuración → Restaurar datos de demostración**.

> Los códigos QR impresos antes del cambio de nombre apuntan a `usuario/?mesa=X` y dejan de funcionar. Reimprímelos desde **Mesas y QR → Imprimir todos los QR**.

> Limitación conocida: la persistencia es `localStorage`, que vive en el navegador. La sincronización funciona entre pestañas y ventanas del **mismo navegador y dispositivo**. Para que un celular de comensal hable con la tablet de cocina, el siguiente paso es cambiar la capa interna de `QStore` por un backend (Supabase, Firebase o una API propia). La interfaz `get / update / subscribe` ya está pensada para ese cambio sin tocar las vistas.

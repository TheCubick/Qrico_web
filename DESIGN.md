# Q-RICO · Sistema de diseño y arquitectura

> SaaS de suscripción fija ($499 MXN/mes) para restaurantes: menú QR para el comensal (`usuario/`) y panel autogestionable para el restaurante (`cliente/`), sincronizados en tiempo real sin servidor.

---

## 1. Principios

1. **Cero código para el restaurante.** Todo lo que ve el comensal (nombre, logo, portada, menú, precios, stock, mesas, WiFi, propinas) se edita desde `cliente/`. Ningún dato del negocio está escrito a mano en HTML.
2. **Una sola fuente de verdad.** Ambos módulos leen y escriben el mismo objeto `qrico_saas_store`.
3. **Cálido y gastronómico, nunca "genérico de IA".** Sin gradientes neón, sin morados ni azules, sin emojis como iconos. Superficies blancas sobre crema, sombras cálidas tenues, tipografía editorial.
4. **Operación primero.** En cocina y caja, lo urgente se lee a 2 metros: folios y cronómetros en monoespaciada, notas del comensal resaltadas en mostaza y estados codificados por color.

---

## 2. Tokens de color (`shared/css/tokens.css`)

| Token | Valor | Uso |
|---|---|---|
| `--q-coral` | `#D1312B` | CTA principal, precios, letra "Q", alertas críticas, estado *Pendiente/Ocupada* |
| `--q-coral-hover` | `#B52621` | Hover del CTA |
| `--q-coral-soft` | `#FBECEA` | Fondo de badges y alertas coral |
| `--q-mostaza` | `#D1A059` | Acento secundario, "RICO", favoritos, *En preparación*, *Llamando mesero* |
| `--q-mostaza-hover` | `#B88944` | Hover del botón dorado |
| `--q-mostaza-soft` | `#F6ECDC` | Notas para cocina, badges dorados |
| `--q-blanco` | `#FFFFFF` | Tarjetas, modales, tickets |
| `--q-crema` | `#EDE2CE` | Fondo base del comensal, chips inactivos |
| `--q-crema-claro` | `#F6F0E5` | Fondo del panel, áreas secundarias |
| `--q-carbon` | `#1E1B18` | Texto principal, sidebar del panel, dock del comensal |
| `--q-piedra` | `#6E655F` | Texto secundario |
| `--q-borde` | `#DFD3BC` | Divisores y bordes de 1px |
| `--q-salvia` | `#2E7D32` | Éxito, *Libre*, *Listo para servir* |

**Sombras:** `--q-shadow: 0 4px 20px -2px rgba(30,27,24,.06)` para reposo; `--q-shadow-md` / `--q-shadow-lg` para hover y modales.
**Radios:** 8 / 12 / 18 px y `999px` para píldoras. **Curva de movimiento:** `cubic-bezier(0.22, 1, 0.36, 1)`.

### Distribución de color en el menú del comensal (`usuario/`)

| Color | Dónde |
|---|---|
| Coral `#D1312B` | Header/navbar completo, títulos de sección centrados, botones `+`/AGREGAR, chip de categoría activo, flechas del carrusel, precios |
| Blanco `#FFFFFF` | Fondo base, tarjetas, modales y barra sticky de búsqueda/categorías |
| Crema `#EDE2CE` | Sección "Platillos destacados", chips y filtros inactivos |
| Mostaza `#D1A059` | Palabra "RICO", badges de favorito, borde de la tarjeta horizontal, píldora de mesa, subrayado de títulos |
| Carbón `#141210` | Texto principal y barra flotante de mesa (`body.comensal` sobrescribe `--q-carbon`) |
| `#111111` | Footer completo |

Secuencia de la página: header coral → carrusel promocional (portada + favoritos) → cintilla informativa → seguimiento del pedido → "MENÚ PARA ORDENAR EN LÍNEA" + barra sticky → carrusel de tarjetas verticales → "PLATILLOS DESTACADOS" (grid de 2 columnas + bloques por categoría) → footer clásico.

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
| Display | **Fraunces** 500–700 | Títulos de vista, nombre del restaurante, nombres de platillo |
| Interfaz | **Plus Jakarta Sans** 400–800 | Todo el texto de lectura y controles |
| Datos | **JetBrains Mono** 500–700 | Precios, folios, cronómetros del KDS, PIN, tickets |

Reglas: `line-height: 1.5` en lectura, `text-wrap: pretty` en descripciones y `balance` en títulos, descripciones de platillo limitadas a 2 líneas en la tarjeta.

---

## 4. Librerías integradas (CDN con versión fija)

| Librería | Versión | Dónde | Para qué |
|---|---|---|---|
| Lucide Icons | 0.454.0 | ambos | Iconografía vectorial (`stroke-width: 1.75`) |
| GSAP | 3.12.5 | ambos | Entradas, vuelo al carrito, PIN, modales, tracker |
| Chart.js | 4.4.4 | panel | Dashboard y reportes |
| SortableJS | 1.15.3 | panel | Drag & drop del KDS |
| QRCode.js | 1.0.0 | panel | QR por mesa (PNG y PDF) |
| html2pdf.js | 0.10.2 | panel | Tickets de 80 mm, corte de caja, hoja de QR |

Todas se cargan desde `cdnjs`, `jsdelivr` o `unpkg`, sin build: el sitio se despliega como estático en Render.

---

## 5. Estructura del repositorio

```
shared/
  css/tokens.css        Tokens + componentes base (botones, inputs, switch, chips, badges, modal, toast)
  js/store.js           QStore: estado, persistencia, sincronización, datos semilla, consultas
  js/ui.js              QUI: iconos, toasts, modales, confirmaciones, sonido, animaciones
usuario/                Módulo comensal (menú QR)
  index.html            Redirige a html/menu.html conservando ?mesa=X
  html/menu.html        Shell
  html/header.html      Header + drawer (carrito y cuenta de la mesa)
  html/sidebar.html     Barra sticky: buscador, filtros rápidos y chips de categoría
  html/card.html        Plantilla de tarjeta "favorito"
  html/cuadro_card.html Plantilla de tarjeta de platillo
  html/footer.html      Datos del negocio
  css/*.css             menu (layout, portada, tracker, dock) · header · card · cuadro_card · footer
  js/menu.js            Lógica del comensal
cliente/                Panel del restaurante (SPA)
  index.html            Acceso por PIN de 4 dígitos
  html/admin.html       Shell (sidebar + topbar + vista)
  html/admin_sidebar.html
  html/admin_views/     dashboard · pos · kds · mesas · menu_stock · personal · reportes · configuracion
  css/admin.css         Login, componentes del panel y estilos de cada vista
  css/admin_sidebar.css Sidebar y topbar
  js/admin.js           Login, router, vistas, cobro, tickets, QR y PDF
```

Las plantillas HTML usan marcadores `{{clave}}`; los valores se escapan con `QStore.escapeHtml` antes de insertarse.

---

## 6. Estado compartido · `qrico_saas_store`

### Esquema (versión 3)

```js
{
  version: 3, rev: 128,                       // rev aumenta en cada escritura
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
  ventas:     [{ id, folio, mesaId, tipo, items, subtotal, propina, total,
                 metodo: 'efectivo'|'tarjeta'|'transferencia'|'dividido',
                 pagos: [{ metodo, monto }], personas, recibido, cambio, cerradoEn, cajero }],
  alertas:    [{ id, mesaId, tipo: 'mesero'|'cuenta', nota, split?, creadoEn, atendida }],
  personal:   [{ id, nombre, rol: 'gerente'|'cajero'|'cocina'|'mesero', pin, activo }],
  contadores: { pedido, venta },
  ultimoEvento: { type, at, rev, ...datos }
}
```

`readRaw()` pasa los datos guardados por `migrar()`, que rellena los campos agregados después (redes, frase del pie, razón social, precio anterior) sin borrar la información del restaurante.

Los pedidos y ventas guardan una **copia** del nombre y precio del platillo: si el restaurante cambia un precio, los tickets históricos no se alteran.

### Flujo de sincronización

```
 usuario/ (comensal)                          cliente/ (panel)
 ───────────────────                          ────────────────
 QStore.update(mutador, evento)
   1. lee lo más reciente de localStorage
   2. aplica el mutador
   3. rev++ y ultimoEvento = evento
   4. escribe localStorage ─────────────────► evento "storage"      ┐
   5. BroadcastChannel.postMessage({rev}) ──► canal qrico_saas_channel ┘→ syncFromStorage()
   6. notifica a sus suscriptores                                      si rev cambió → render + aviso
```

- `QStore.subscribe(fn)` recibe `(estado, evento, remoto)`. `remoto = true` cuando el cambio vino de otra pestaña. Con eso se deciden sonidos y toasts sin duplicarlos.
- Ambas vías (BroadcastChannel y `storage`) se deduplican comparando `rev`.
- Las rutas de imágenes locales se guardan relativas a la raíz del proyecto (`usuario/img/...`) y se resuelven con `QStore.resolveAsset()`, calculado desde la ubicación real de `store.js`; así funciona igual en Live Server, en Render o en un subdirectorio.
- Las imágenes subidas se comprimen con canvas (`QStore.compressImage`) a JPEG de 720 px antes de guardarse en Base64. Si se llena `localStorage`, la escritura se revierte y se muestra el error.

### Eventos que viajan entre módulos

| Evento | Origen | Efecto |
|---|---|---|
| `pedido:nuevo` | comensal / POS | Toast y sonido en el panel; la tarjeta aparece y parpadea en el KDS |
| `pedido:estado` | KDS | La barra de seguimiento del comensal avanza; aviso de "listo" |
| `alerta:nueva` | comensal | Campana con contador, mesa pulsando en el mapa, sonido |
| `alerta:atendida` | panel | El comensal recibe "Tu mesero va en camino" |
| `stock:actualizado` / `menu:actualizado` | panel | El menú QR se vuelve a dibujar al instante |
| `negocio:actualizado` | panel | Header, portada y footer del comensal se actualizan |
| `venta:cerrada` | POS / mesas | Mesa liberada, alertas cerradas, seguimiento del comensal oculto |
| `reset` | configuración | Ambos módulos recargan los datos de demostración |

---

## 7. Roles y permisos

| Rol | Vistas | Entra a |
|---|---|---|
| Gerente | Todas | Dashboard |
| Cajero | Dashboard, POS, Mesas, Reportes | POS |
| Cocina | KDS, Menú y stock (solo disponibilidad) | KDS |
| Mesero | Mesas, POS, KDS | Mesas |

La sesión vive en `sessionStorage.qrico_sesion`. Siempre debe quedar al menos un gerente activo, y nadie puede desactivarse a sí mismo.

**PINs de demostración:** Gerente `1234` · Cajero `2222` · Cocina `3333` · Mesero `4444`.

---

## 8. Patrones de componentes

- **Botones:** `.q-btn` + `--primary` (coral), `--gold`, `--dark`, `--outline`, `--ghost`, `--danger`, `--success`; tamaños `--sm` / `--lg`.
- **Tarjeta de platillo:** blanco, borde de 1px `--q-borde`, sombra cálida, imagen cuadrada de 116 px a la derecha y botón `+` coral superpuesto. Si está agotado: imagen en escala de grises, precio tachado y botón deshabilitado.
- **Modal:** encabezado en Fraunces y pie en crema claro. En móvil se convierte en hoja inferior.
- **Toast:** fondo carbón con borde izquierdo del color semántico.
- **Drawer del pedido:** se desliza desde la derecha (`transform` + `cubic-bezier(0.22,1,0.36,1)`) con dos pestañas: *Por enviar* y *Cuenta de la mesa*. La segunda incluye propina y división de la cuenta (una cuenta, partes iguales o por platillo).
- **Dock del comensal:** píldora carbón fija abajo: *Llamar mesero*, *Pedir la cuenta* y *Ver pedido* (se vuelve coral cuando hay artículos).

---

## 9. Cómo ejecutar

El proyecto debe servirse por HTTP porque las vistas se cargan con `fetch`:

```bash
npx serve .            # o la extensión Live Server, o python -m http.server
```

- Comensal: `http://localhost:3000/usuario/?mesa=4`
- Restaurante: `http://localhost:3000/cliente/`

Para probar la sincronización, abre ambas URLs en pestañas del mismo navegador. Para volver a empezar, usa **Configuración → Restaurar datos de demostración**.

> Limitación conocida: la persistencia es `localStorage`, que vive en el navegador. La sincronización funciona entre pestañas y ventanas del **mismo navegador y dispositivo**. Para que un celular de comensal hable con la tablet de cocina, el siguiente paso es cambiar la capa interna de `QStore` por un backend (Supabase, Firebase o una API propia). La interfaz `get / update / subscribe` ya está pensada para ese cambio sin tocar las vistas.

# Qrico_web
Proyecto de la materia Creación de empresas, donde se desarrolla una web para restaurantes.

Q-RICO es un SaaS de menús digitales para micro, pequeñas y medianas empresas gastronómicas. El comensal pide desde el **menú web**, con o sin mesa: si escaneó el QR de una mesa, el pedido se asocia a ella; si no, llega a cocina como pedido directo (para comer aquí o para llevar). El restaurante administra menú, cocina, mesas y caja desde el **panel administrativo**. Ambos módulos se sincronizan en tiempo real mediante `shared/js/store.js`.

## Estructura web

```text
web/
├── menu-web/                   # Menú del comensal
│   ├── index.html              # Entrada: redirige a pages/menu.html conservando ?mesa=X
│   ├── pages/                  # menu.html
│   ├── components/             # header, sidebar (barra de categorías), card, cuadro_card y footer
│   └── assets/
│       ├── images/             # logo/ y complementos/ (incluye platillos/)
│       ├── scripts/            # menu.js
│       └── styles/             # menu, header, card, cuadro_card y footer
├── panel-administrativo/       # Panel privado del restaurante
│   ├── index.html              # Acceso por PIN de 4 dígitos
│   ├── pages/                  # admin.html
│   ├── components/             # admin_sidebar.html y views/ (8 vistas dinámicas)
│   └── assets/
│       ├── scripts/            # admin.js
│       └── styles/             # admin y admin_sidebar
├── shared/                     # Núcleo compartido por ambos módulos
│   ├── css/                    # tokens.css (paleta y componentes base)
│   ├── js/                     # store.js (datos y sincronización) y ui.js
│   └── vendor/                 # GSAP, Swiper, Lenis y canvas-confetti (copias locales)
├── scripts/vendor.mjs          # Copia las librerías de node_modules/ a shared/vendor/
├── package.json                # Dependencias de animación
├── DESIGN.md                   # Sistema de diseño y arquitectura
└── README.md
```

## Cómo ejecutar

Los componentes se cargan con `fetch`, así que el proyecto debe abrirse desde un servidor (no con doble clic):

```bash
npx serve .            # o la extensión Live Server, o python -m http.server
```

- Menú del comensal (pedido directo): `http://localhost:3000/menu-web/`
- Menú con QR de mesa: `http://localhost:3000/menu-web/?mesa=4`
- Panel administrativo: `http://localhost:3000/panel-administrativo/`

No hace falta compilar ni instalar nada: las librerías de animación ya están en `shared/vendor/`. Para actualizarlas, cambia la versión en `package.json` y ejecuta `npm install` (el script `postinstall` las vuelve a copiar).

**PINs de demostración:** Gerente `1234` · Cajero `2222` · Cocina `3333` · Mesero `4444`.

Para ver la sincronización en vivo, abre ambas URLs en pestañas del mismo navegador. Los pedidos directos se cobran en **Punto de venta → Pedidos directos**. El detalle de la paleta, la tipografía, las animaciones, el esquema de datos y los eventos está en [DESIGN.md](DESIGN.md).

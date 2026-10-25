# Qrico_web
Proyecto de la materia Creación de empresas, donde se desarrolla una web para restaurantes.

## Estructura web

```text
web/
├── usuario/                    # Aplicación pública para comensales
│   ├── index.html              # Entrada y redirección al menú
│   ├── pages/                  # Páginas completas
│   ├── components/             # Fragmentos HTML reutilizables
│   └── assets/
│       ├── images/             # Logotipos y fotografías
│       ├── scripts/            # JavaScript de la aplicación
│       └── styles/             # Hojas de estilo
├── cliente/                    # Panel privado del restaurante
│   ├── index.html              # Acceso por PIN
│   ├── pages/                  # Páginas del panel
│   ├── components/             # Sidebar y vistas dinámicas
│   └── assets/
│       ├── scripts/
│       └── styles/
└── shared/                     # Recursos compartidos por ambas aplicaciones
    ├── js/
    └── css/
```

Las rutas de entrada se mantienen en `usuario/index.html` y `cliente/index.html`.
Los componentes y las vistas dinámicas se cargan desde sus nuevas carpetas para
evitar duplicación y facilitar el mantenimiento.

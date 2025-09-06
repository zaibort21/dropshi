Scraper Dropi (puppeteer)

Qué hace
- Abre sesión en Dropi con las credenciales que proporciones por variables de entorno.
- Visita el catálogo (la URL que indicaste) y extrae imágenes encontradas en las tarjetas de producto.
- Genera `scripts/image-list.json` con objetos { id, url, fileName } listos para usar con `download-images.ps1`.

Requisitos
- Node.js instalado (14+)
- En la carpeta `dropshi` ejecuta `npm install` para instalar dependencias.

Uso (Windows PowerShell)

$env:DROPI_EMAIL='tu-email@ejemplo.com'; $env:DROPI_PASSWORD='tu-pass'; npm run scrape

Notas y limitaciones
- Asume un formulario de login con campos `input[type=email]` y `input[type=password]`. Si Dropi cambia selectores, hay que ajustar `scrape-dropi.js`.
- No soporta 2FA. Para cuentas con 2FA, prefiero usar una API o exportar CSV desde Dropi.
- Revisa `scripts/image-list.json` antes de ejecutar la descarga.

Siguiente paso recomendado
- Ejecutar el scraper para generar `image-list.json` y luego ejecutar `download-images.ps1` para bajar las imágenes y opcionalmente inyectar los nombres en `products.json`.

/*
scrape-dropi.js
Qué hace: inicia sesión en Dropi (app.dropi.co) usando las credenciales proporcionadas via variables de entorno,
visita la URL del catálogo (por defecto la que diste) y extrae una lista de imágenes por producto.
Genera `scripts/image-list.json` con objetos: { id, url, fileName, images }.

Advertencias / supuestos:
 - Asume que el login está en https://app.dropi.co/login y que el flujo es un formulario con los campos 'email' y 'password'.
 - No maneja 2FA. Si tu cuenta tiene 2FA, debes usar un token/API o exportar CSV desde el panel.
 - Ejecuta localmente. NO subas credenciales a git. Usa variables de entorno: DROPi_EMAIL y DROPi_PASSWORD.

Uso:
 1) Instala dependencias (en la carpeta dropshi):
    npm install
 2) Ejecuta (PowerShell):
    $env:DROPI_EMAIL='tu-email'; $env:DROPI_PASSWORD='tu-pass'; node .\scripts\scrape-dropi.js

Si quieres apuntar a otra URL, pasa la opción --url "https://..."
*/

const fs = require('fs');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const argv = require('minimist')(process.argv.slice(2));

(async () => {
  const DROPi_EMAIL = process.env.DROPI_EMAIL || process.env.DROPi_EMAIL || process.env.DROPI_EMAIL;
  const DROPi_PASSWORD = process.env.DROPI_PASSWORD || process.env.DROPi_PASSWORD || process.env.DROPi_PASSWORD;

  if (!DROPi_EMAIL || !DROPi_PASSWORD) {
    console.error('Error: debes exportar las variables de entorno DROPI_EMAIL y DROPI_PASSWORD antes de ejecutar.');
    process.exit(1);
  }

  const startUrl = argv.url || 'https://app.dropi.co/dashboard/search?search_type=simple&favorite=true&order_by=created_at&order_type=desc';
  const outFile = path.resolve(__dirname, 'image-list.json');

  console.log('Iniciando navegador...');

  // Determinar ejecutable de Chrome/Edge instalado localmente
  const envChrome = process.env.DROPI_CHROME_PATH;
  const candidates = [
    envChrome,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);

  let executablePath = null;
  for (const c of candidates) {
    if (c && fs.existsSync(c)) { executablePath = c; break }
  }

  if (!executablePath) {
    console.warn('No se encontró Chrome/Edge local. Si prefieres no usar puppeteer-core, instala puppeteer completo o define la variable DROPI_CHROME_PATH con la ruta a tu chrome.exe');
  }

  const headless = process.env.DROPI_HEADLESS === 'true' ? true : false; // por defecto mostramos el navegador para debug
  const launchOpts = executablePath ? { headless, executablePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] } : { headless };

  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();

  try {
    console.log('Abriendo página de login...');
    await page.goto('https://app.dropi.co/login', { waitUntil: 'networkidle2' });

    // Rellenar el formulario (selector asumido)
    await page.type('input[type="email"]', DROPi_EMAIL, { delay: 30 });
    await page.type('input[type="password"]', DROPi_PASSWORD, { delay: 30 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    ]);

    console.log('Login realizado. Navegando al catálogo...');
    await page.goto(startUrl, { waitUntil: 'networkidle2' });

    // Ajusta selectores según la estructura real de Dropi
    // Intentamos detectar tarjetas de producto y sus imágenes
    await page.waitForTimeout(2000);

    const items = await page.evaluate(() => {
      // Recorremos elementos que parezcan productos
      const nodes = Array.from(document.querySelectorAll('a[href*="/dashboard/products/"]'));
      const byHref = new Map();
      for (const n of nodes) {
        const href = n.getAttribute('href');
        if (!byHref.has(href)) byHref.set(href, n);
      }
      const products = [];
      for (const [href, el] of byHref.entries()) {
        // Buscar imagen dentro del link
        let imgs = [];
        const imgEls = el.querySelectorAll('img');
        imgEls.forEach(i => {
          const src = i.getAttribute('src') || i.getAttribute('data-src');
          if (src) imgs.push(src);
        });
        // extraer id del href, ejemplo: /dashboard/products/123
        const m = href.match(/products\/(\d+)/);
        const id = m ? parseInt(m[1], 10) : null;
        const title = el.querySelector('h3, h4, .product-name, .title') ? (el.querySelector('h3, h4, .product-name, .title').innerText.trim()) : null;
        products.push({ id, title, href, images: imgs });
      }
      return products;
    });

    // Procesar y construir image-list
    const list = [];
    for (const p of items) {
      if (!p.images || p.images.length === 0) continue;
      p.images.forEach((u, idx) => {
        const ext = path.extname(new URL(u, 'https://app.dropi.co').pathname) || '.jpg';
        const fileName = `${p.id || 'unknown'}-${idx + 1}${ext}`;
        list.push({ id: p.id || null, url: u, fileName: fileName });
      });
    }

    fs.writeFileSync(outFile, JSON.stringify(list, null, 2), 'utf8');
    console.log('Lista generada:', outFile);
    console.log(`Encontrados ${list.length} elementos.`);

  } catch (err) {
    console.error('Error al scrapear:', err.message);
  } finally {
    await browser.close();
  }
})();

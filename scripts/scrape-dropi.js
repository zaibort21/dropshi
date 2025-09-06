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
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  try { puppeteer = require('puppeteer-core'); } catch (e2) {
    console.error('Error: se requiere puppeteer o puppeteer-core en scripts/package.json. Ejecuta npm install en ./scripts');
    process.exit(1);
  }
}
const argv = require('minimist')(process.argv.slice(2));

(async () => {
  process.on('unhandledRejection', (r) => { console.error('UNHANDLED_REJECTION', String(r)) });
  process.on('uncaughtException', (err) => { console.error('UNCAUGHT_EXCEPTION', err && err.stack || err); process.exit(1) });

  const DROPi_EMAIL = process.env.DROPI_EMAIL || process.env.DROPi_EMAIL || process.env.DROPI_EMAIL;
  const DROPi_PASSWORD = process.env.DROPI_PASSWORD || process.env.DROPi_PASSWORD || process.env.DROPi_PASSWORD;

  if (!DROPi_EMAIL || !DROPi_PASSWORD) {
    console.error('Error: debes exportar las variables de entorno DROPI_EMAIL y DROPI_PASSWORD antes de ejecutar.');
    process.exit(1);
  }

  const startUrl = argv.url || 'https://app.dropi.co/dashboard/search?search_type=simple&favorite=true&order_by=created_at&order_type=desc';
  const outFile = path.resolve(__dirname, 'image-list.json');

  console.log('Iniciando navegador...');
  // preparar archivo de debug
  const debugLogPath = path.resolve(__dirname, 'scrape-debug.log');
  function logDebug() {
    try {
      const line = Array.from(arguments).map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      fs.appendFileSync(debugLogPath, `${new Date().toISOString()} ${line}\n`);
      console.log(line);
    } catch (e) { console.error('No se pudo escribir debug log', e.message) }
  }
  logDebug('Arrancando scraper, headless=', process.env.DROPI_HEADLESS || 'false');

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

  // Forward page console and errors to debug log
  page.on('console', msg => {
    try { logDebug('PAGE_CONSOLE', msg.type(), msg.text()); } catch(e){}
  });
  page.on('pageerror', err => { logDebug('PAGE_ERROR', err.message); });

  try {
    console.log('Abriendo página de login...');
    await page.goto('https://app.dropi.co/login', { waitUntil: 'networkidle2' });

    // Rellenar el formulario: usar selectores alternativos y fallbacks
    await page.waitForTimeout(800);
    const emailSelectors = ['input[type="email"]','input[name="email"]','input[id*=email]','input[name*=email]','input[type="text"]'];
    const passwordSelectors = ['input[type="password"]','input[name="password"]','input[id*=password]'];

    let emailSelector = null;
    for (const s of emailSelectors) {
      if (await page.$(s)) { emailSelector = s; break }
    }
    let passwordSelector = null;
    for (const s of passwordSelectors) {
      if (await page.$(s)) { passwordSelector = s; break }
    }

    if (!emailSelector || !passwordSelector) {
      throw new Error('No se encontraron campos de email/password en la página de login');
    }

    await page.type(emailSelector, DROPi_EMAIL, { delay: 30 });
    await page.type(passwordSelector, DROPi_PASSWORD, { delay: 30 });

    let submitClicked = false;
    const submitSelectors = ['button[type="submit"]','input[type="submit"]','button.btn-primary','button.btn','button[class*=login]'];
    for (const s of submitSelectors) {
      const el = await page.$(s);
      if (el) {
        await Promise.all([
          el.click(),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
        ]).catch(() => {});
        submitClicked = true;
        break;
      }
    }

    if (!submitClicked) {
      // intentar encontrar botón por texto (ingresar/entrar/login)
      const btns = await page.$x("//button[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'ingresar') or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'entrar') or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'iniciar sesion') or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'login')]");
      if (btns.length) {
        try {
          await Promise.all([btns[0].click(), page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })]);
          submitClicked = true;
        } catch(e) {}
      }
    }

    if (!submitClicked) {
      // fallback: presionar Enter en el campo password
      try {
        await page.focus(passwordSelector);
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        submitClicked = true;
      } catch (e) {
        // dejar que el bloque catch general capture esto
      }
    }

  console.log('Login realizado. Navegando al catálogo...');
    await page.goto(startUrl, { waitUntil: 'networkidle2' });

    // Ajusta selectores según la estructura real de Dropi
    // Intentamos detectar tarjetas de producto buscando el botón "Enviar a cliente" que aparece en cada tarjeta
    await page.waitForTimeout(2000);

    // Extraer productos e intentar capturar id de forma robusta (href, data attributes, dataset)
    const items = await page.evaluate(() => {
      const products = [];

      // Buscar nodos que contienen el texto "Enviar a cliente" como ancla de las tarjetas
      const xpath = "//*[contains(normalize-space(.),'Enviar a cliente') or contains(normalize-space(.),'Enviar al cliente')]";
      const snap = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      for (let i = 0; i < snap.snapshotLength; i++) {
        const btn = snap.snapshotItem(i);
        let card = btn;
        // subir hasta encontrar un contenedor que incluya imágenes o hasta 7 niveles
        for (let up = 0; up < 7; up++) {
          if (!card) break;
          if (card.querySelector && card.querySelector('img')) break;
          card = card.parentElement;
        }
        if (!card) continue;

        // Recolectar imágenes dentro de la tarjeta
        const imgEls = Array.from(card.querySelectorAll('img'));
        const imgs = imgEls.map(iEl => {
          const src = iEl.getAttribute('src') || iEl.getAttribute('data-src') || iEl.getAttribute('data-lazy-src') || null;
          if (!src) return null;
          try { return new URL(src, document.baseURI).href } catch(e) { return src }
        }).filter(Boolean);

        // Extraer hrefs y buscar id en patrones comunes
        let href = null;
        const a = card.querySelector('a[href*="/dashboard/products/"]') || card.querySelector('a[href*="/products/"]') || card.querySelector('a');
        if (a) href = a.getAttribute('href');

        let id = null;
        if (href) {
          const m = String(href).match(/products\/(\d+)/);
          if (m) id = parseInt(m[1], 10);
        }

        // Buscar data-id o data-product-id en el propio card o en ancestros/descendientes
        if (!id) {
          const candidates = [];
          if (card.dataset && card.dataset.id) candidates.push(card.dataset.id);
          if (card.dataset && card.dataset.productId) candidates.push(card.dataset.productId);
          const dataEl = card.querySelector('[data-id], [data-product-id], [data-productid]');
          if (dataEl) {
            if (dataEl.dataset && dataEl.dataset.id) candidates.push(dataEl.dataset.id);
            if (dataEl.getAttribute('data-product-id')) candidates.push(dataEl.getAttribute('data-product-id'));
            if (dataEl.getAttribute('data-productid')) candidates.push(dataEl.getAttribute('data-productid'));
          }
          for (const c of candidates) {
            if (!c) continue;
            const n = String(c).match(/\d+/);
            if (n) { id = parseInt(n[0], 10); break }
          }
        }

        // Intentar extraer título
        let title = null;
        const titleEl = card.querySelector('h1, h2, h3, h4, .product-name, .title, .card-title');
        if (titleEl && titleEl.innerText) title = titleEl.innerText.trim();
        // si no hay title, buscar alt en imagen principal
        if (!title && imgEls.length) {
          const alt = imgEls[0].getAttribute('alt');
          if (alt) title = alt.trim();
        }

        // Proveedor
        let provider = null;
        const provSelectors = ['.provider', '.provider-name', '.providerLink', '.seller', '.store-name'];
        for (const ps of provSelectors) {
          const pel = card.querySelector(ps);
          if (pel && pel.innerText && pel.innerText.trim().length > 1) { provider = pel.innerText.trim(); break }
        }
        if (!provider) {
          const txt = card.innerText || '';
          const m = txt.match(/Proveedor[:\s]*([A-Z0-9\- _\.\u00C0-\u017F\w]+)/i);
          if (m) provider = m[1].trim();
        }

        const key = href || title || (`card-${i}`);
        products.push({ key, id: id || null, title: title || null, href: href || null, provider: provider || null, images: imgs });
      }

      // Fallback: si no encontró nada, intentar tomar imágenes grandes en la sección principal
      if (products.length === 0) {
        const mainImgs = Array.from(document.querySelectorAll('main img, .content img, .products-list img'));
        mainImgs.forEach((iEl, idx) => {
          const src = iEl.getAttribute('src') || iEl.getAttribute('data-src') || iEl.getAttribute('data-lazy-src') || null;
          if (src) {
            try { products.push({ key: `fallback-${idx}`, id: null, title: null, href: null, provider: null, images: [new URL(src, document.baseURI).href] }) } catch(e) { products.push({ key: `fallback-${idx}`, id: null, title: null, href: null, provider: null, images: [src] }) }
          }
        });
      }

      return products;
    });

    // Procesar y construir image-list
    const list = [];
    const seen = new Set();
    for (const p of items) {
      if (!p.images || p.images.length === 0) continue;
      // slugify helper
      const slug = (s) => {
        if (!s) return null;
        return String(s).toLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      };
      const base = p.title ? slug(p.title) : (p.provider ? slug(p.provider) : (p.id ? `product-${p.id}` : 'product'));
      for (let idx = 0; idx < p.images.length; idx++) {
        const u = p.images[idx];
        try {
          const urlObj = new URL(u, 'https://app.dropi.co');
          const ext = path.extname(urlObj.pathname) || '.jpg';
          const orig = path.basename(urlObj.pathname);
          const fileName = `${p.id || 'unknown'}_${base}_${idx + 1}${ext}`;
          const key = `${p.id||'null'}|${urlObj.href}`;
          if (seen.has(key)) continue;
          seen.add(key);
          list.push({ id: p.id || null, url: urlObj.href, fileName: fileName, originalFileName: orig, title: p.title, provider: p.provider });
        } catch (e) {
          // si URL no es absoluta y URL constructor falla, fallback
          const ext = path.extname(u) || '.jpg';
          const fileName = `${p.id || 'unknown'}_${base}_${idx + 1}${ext}`;
          const key = `${p.id||'null'}|${u}`;
          if (seen.has(key)) continue;
          seen.add(key);
          list.push({ id: p.id || null, url: u, fileName: fileName, originalFileName: null, title: p.title, provider: p.provider });
        }
      }
    }

  console.log('DEBUG: items length before flatten:', items.length);
  fs.writeFileSync(outFile, JSON.stringify(list, null, 2), 'utf8');
  console.log('Lista generada:', outFile);
  console.log(`Encontrados ${list.length} elementos.`);

  } catch (err) {
    console.error('Error al scrapear:', err.message);
  } finally {
    await browser.close();
  }
})();

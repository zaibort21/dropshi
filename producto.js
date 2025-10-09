// Lee el id del producto de la URL
function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function loadProductData() {
  const id = getProductIdFromUrl();
  if (!id) return;
  const resp = await fetch('products.json');
  const productos = await resp.json();
  const producto = productos.find(p => String(p.id) === String(id));
  if (!producto) {
    document.getElementById('producto-nombre').textContent = 'Producto no encontrado';
    return;
  }
  renderProduct(producto);
  setupAddToCart(producto);
  loadComentarios(producto.id);
  renderRelated(producto);
}

function renderProduct(producto) {
  document.getElementById('producto-nombre').textContent = producto.name;
  // precios
  const precioActual = producto.price ? Currency.formatPrice(producto.price) : '';
  document.getElementById('precio-actual').textContent = precioActual;
  if (producto.originalPrice && producto.originalPrice > producto.price) {
    document.getElementById('precio-original').textContent = Currency.formatPrice(producto.originalPrice);
    document.getElementById('precio-original').style.display = 'inline';
  }

  document.getElementById('producto-descripcion').innerHTML = producto.description || '';

  // Galería de imágenes (main + thumbs)
  const galeriaMain = document.getElementById('galeria-main');
  const galeria = document.getElementById('galeria-imagenes');
  galeria.innerHTML = '';
  const imgs = producto.images && producto.images.length ? producto.images : (producto.image ? [producto.image] : []);
  if (imgs.length) {
    galeriaMain.querySelector('img').src = imgs[0];
    galeriaMain.querySelector('img').alt = producto.name;
    imgs.forEach((src, i) => {
      const wrap = document.createElement('div'); wrap.className = 'producto-thumb';
      const img = document.createElement('img'); img.src = src; img.alt = `${producto.name} ${i+1}`;
      wrap.appendChild(img);
      wrap.onclick = () => { galeriaMain.querySelector('img').src = src; openLightbox(imgs, i); };
      galeria.appendChild(wrap);
    });
    // open lightbox when main image clicked
    galeriaMain.querySelector('img').onclick = () => openLightbox(imgs, 0);
  }

  // Variantes
  const variantesDiv = document.getElementById('producto-variantes');
  variantesDiv.innerHTML = '';
  if (producto.variants && producto.variants.length) {
    producto.variants.forEach((v, idx) => {
      const btn = document.createElement('button');
      btn.textContent = `${v.name} · $${Number(v.price).toLocaleString('es-CO')} COP`;
      btn.onclick = () => mostrarVariante(producto, v);
      variantesDiv.appendChild(btn);
      if (idx === 0) btn.click();
    });
  }

  // especificaciones (si existen)
  const specList = document.getElementById('producto-especificaciones');
  specList.innerHTML = '';
  if (producto.specs && Array.isArray(producto.specs)) {
    producto.specs.forEach(s => { const li = document.createElement('li'); li.textContent = s; specList.appendChild(li); });
  }
}

function mostrarVariante(producto, variante) {
  // Actualiza galería y precio
  const galeria = document.getElementById('galeria-imagenes');
  galeria.innerHTML = '';
  const imgs = variante.images && variante.images.length ? variante.images : (producto.images && producto.images.length ? producto.images : (producto.image ? [producto.image] : []));
  const galeriaMain = document.getElementById('galeria-main');
  if (imgs.length) {
    galeriaMain.querySelector('img').src = imgs[0];
    imgs.forEach((src,i) => {
      const wrap = document.createElement('div'); wrap.className = 'producto-thumb';
      const img = document.createElement('img'); img.src = src; img.alt = `${producto.name} ${i+1}`;
      wrap.appendChild(img);
      wrap.onclick = () => { galeriaMain.querySelector('img').src = src; };
      galeria.appendChild(wrap);
    });
  }
  document.getElementById('precio-actual').textContent = variante.price ? Currency.formatPrice(variante.price) : '';
  document.getElementById('producto-descripcion').innerHTML = (producto.description || '') + (variante.description ? `<div style='margin-top:1em;'>${variante.description}</div>` : '');
}

// quantity + add to cart
function setupAddToCart(producto) {
  const qtyVal = document.getElementById('qty-val');
  let qty = 1;
  document.getElementById('qty-increase').onclick = () => { qty++; qtyVal.textContent = qty; };
  document.getElementById('qty-decrease').onclick = () => { if (qty>1) qty--; qtyVal.textContent = qty; };

  document.getElementById('btn-agregar-carrito').onclick = () => {
    // determine selected variant id if any
    let selectedVariantId = null;
    const activeVarBtn = document.querySelector('.producto-variantes .active');
    if (activeVarBtn) selectedVariantId = activeVarBtn.dataset.variantId || null;
    try {
      if (window.shoppingCart && typeof shoppingCart.addToCart === 'function') {
        shoppingCart.addToCart(producto.id, selectedVariantId, qty);
        alert('Producto agregado al carrito');
      } else {
        const cart = JSON.parse(localStorage.getItem('cart')||'[]');
        cart.push({ id: producto.id, qty, name: producto.name, price: producto.price, variantId: selectedVariantId });
        localStorage.setItem('cart', JSON.stringify(cart));
        alert('Producto agregado al carrito');
      }
    } catch (e) { console.error(e); alert('Error agregando al carrito'); }
  };

  document.getElementById('btn-compra-whatsapp').onclick = () => {
    const text = `Hola, quiero información sobre el producto ${producto.name} (id:${producto.id})`;
    window.open(`https://wa.me/573115477984?text=${encodeURIComponent(text)}`, '_blank');
  };
}

/* Lightbox functions */
function openLightbox(imgs, index) {
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  lb.classList.add('show');
  lb.dataset.images = JSON.stringify(imgs);
  lb.dataset.index = index;
  lbImg.src = imgs[index];
}
function closeLightbox() {
  const lb = document.getElementById('lightbox');
  lb.classList.remove('show');
}
function navigateLightbox(dir) {
  const lb = document.getElementById('lightbox');
  const imgs = JSON.parse(lb.dataset.images || '[]');
  let idx = Number(lb.dataset.index || 0);
  idx = (idx + dir + imgs.length) % imgs.length;
  lb.dataset.index = idx;
  document.getElementById('lb-img').src = imgs[idx];
}

document.addEventListener('DOMContentLoaded', () => {
  const lbClose = document.getElementById('lb-close');
  const lbPrev = document.getElementById('lb-prev');
  const lbNext = document.getElementById('lb-next');
  if (lbClose) lbClose.onclick = closeLightbox;
  if (lbPrev) lbPrev.onclick = () => navigateLightbox(-1);
  if (lbNext) lbNext.onclick = () => navigateLightbox(1);
  document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('lightbox');
    if (!lb.classList.contains('show')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });
});

// Render related products (simple: pick 4 products from products.json in same category)
function renderRelated(producto) {
  fetch('products.json').then(r=>r.json()).then(list=>{
    const related = list.filter(p=>p.id!==producto.id && p.category===producto.category).slice(0,4);
    if (!related || !related.length) return;
    const container = document.createElement('div'); container.className = 'seccion';
    const title = document.createElement('h3'); title.textContent = 'También te pueden interesar'; container.appendChild(title);
    const grid = document.createElement('div'); grid.className = 'related-grid';
    related.forEach(rp=>{
      const card = document.createElement('div'); card.className = 'related-card';
      const img = document.createElement('img'); img.src = (rp.images&&rp.images[0])||rp.image||'';
      const name = document.createElement('div'); name.textContent = rp.name; name.style.marginTop='8px'; name.style.fontSize='0.95rem';
      const btn = document.createElement('button'); btn.className='btn btn-primary'; btn.textContent='Agregar al carrito'; btn.onclick = ()=>{ if (window.shoppingCart) shoppingCart.addToCart(rp.id,null,1); };
      card.appendChild(img); card.appendChild(name); card.appendChild(btn); grid.appendChild(card);
    });
    container.appendChild(grid);
    document.querySelector('.producto-info').appendChild(container);
  }).catch(()=>{});
}

// Comentarios almacenados en localStorage por producto
function loadComentarios(productId) {
  const key = `comentarios_prod_${productId}`;
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  const out = document.getElementById('comentarios-list'); out.innerHTML = '';
  list.forEach(c => { const d = document.createElement('div'); d.className = 'comentario'; d.innerHTML = `<strong>${c.name||'Anónimo'}</strong><div style="font-size:0.95rem;margin-top:6px">${c.text}</div>`; out.appendChild(d); });

  document.getElementById('btn-enviar-comentario').onclick = () => {
    const txt = document.getElementById('comentario-text').value.trim();
    if (!txt) return alert('Escribe un comentario');
    const entry = { name: 'Cliente', text: txt, date: Date.now() };
    list.unshift(entry);
    localStorage.setItem(key, JSON.stringify(list));
    document.getElementById('comentario-text').value = '';
    loadComentarios(productId);
  };
}

document.addEventListener('DOMContentLoaded', loadProductData);

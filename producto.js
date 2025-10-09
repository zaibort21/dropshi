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
      wrap.onclick = () => { galeriaMain.querySelector('img').src = src; };
      galeria.appendChild(wrap);
    });
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
    // use shoppingCart if available, otherwise save in localStorage simple list
    try {
      if (window.shoppingCart && typeof shoppingCart.addToCart === 'function') {
        shoppingCart.addToCart(producto.id, null);
        alert('Producto agregado al carrito');
      } else {
        const cart = JSON.parse(localStorage.getItem('cart')||'[]');
        cart.push({ id: producto.id, qty, name: producto.name, price: producto.price });
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

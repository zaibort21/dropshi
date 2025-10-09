// Currency conversion utility
const Currency = {
  // Now treating prices in products.json as COP integers
  formatPrice(copPrice) {
    // accept numbers or numeric strings
    const n = Math.round(Number(copPrice) || 0);
    return `$${n.toLocaleString('es-CO')} COP`;
  },
  
  getPriceValue(copPrice) {
    return Math.round(Number(copPrice) || 0);
  }
};

// Normaliza y codifica una ruta de imagen solo si no está ya codificada (evita doble-encoding)
function safeSrc(src) {
  if (!src) return '';
  try {
    // Si ya contiene un % seguido de dos hex, asumimos que está codificada y no re-codificamos
    if (/%[0-9A-Fa-f]{2}/.test(src)) return src;
  } catch (e) {
    // ignore
  }
  return encodeURI(src);
}

// Intenta varias rutas candidatas para una imagen (ayuda con mayúsculas, prefijos, espacios)
function imageCandidates(src) {
  if (!src) return [];
  const candidates = new Set();
  try {
    candidates.add(safeSrc(src));
  } catch (e) {}
  // common local locations
  const plain = src.replace(/^\.\/|^\//, '');
  candidates.add(`imagenes/${encodeURI(plain)}`);
  candidates.add(`./imagenes/${encodeURI(plain)}`);
  candidates.add(encodeURI(plain));
  // lowercase variants
  try {
    const lower = plain.toLowerCase();
    candidates.add(`imagenes/${encodeURI(lower)}`);
    candidates.add(encodeURI(lower));
  } catch (e) {}
  return Array.from(candidates);
}

function loadImageWithFallback(img, src, context = {}) {
  const cands = imageCandidates(src);
  let i = 0;
  function tryNext() {
    if (i >= cands.length) {
      console.error('[Image] all candidates failed', { original: src, tried: cands, context });
      img.onerror = null;
      img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23f8fafc"/><text x="200" y="150" text-anchor="middle" fill="%23999" font-size="16">Imagen no disponible</text></svg>';
      img.classList.add('image-error');
      return;
    }
    const trySrc = cands[i++];
    img.onerror = () => {
      console.warn('[Image] candidate failed, trying next', { trySrc, context });
      tryNext();
    };
    img.src = trySrc;
  }
  tryNext();
}

// Debounce utility to limit how often a function is called
function debounce(fn, wait = 200) {
  let timeout;
  return function(...args) {
    const later = () => {
      timeout = null;
      fn.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Product Management System
class ProductManager {
  constructor() {
    this.products = [];
    this.categories = [];
    this.currentFilter = 'all';
    this.currentPage = 1;
    this.productsPerPage = 10;
    this.init();
  }

  // Mapa de traducción para las etiquetas de categoría (display only)
  static CATEGORY_LABELS = {
    'Sports & Outdoors': 'Deportes y aire libre',
    'Electronics': 'Electrónica',
    'Home & Kitchen': 'Hogar y Cocina',
    'Office': 'Oficina',
    'Accessories': 'Accesorios',
    'Gaming': 'Gaming',
    'Fashion': 'Moda',
    'Beauty': 'Belleza',
    'Photography': 'Fotografía',
    'Wearables': 'Wearables'
  };

  async init() {
    await this.loadProducts();
    this.normalizeProducts();
    this.extractCategories();
    this.setupEventListeners();
    this.renderProducts();
    this.renderCategories();
  }

  // Normaliza campos de productos para compatibilidad con diferentes esquemas
  normalizeProducts() {
    this.products = this.products.map(p => {
      const prod = { ...p };
      // nombre
      if (!prod.name && prod.title) prod.name = prod.title;
      // descripción principal
      if (!prod.description) prod.description = prod.descriptionHtml ? prod.descriptionHtml.replace(/<[^>]+>/g, '') : (prod.shortDescription || '');
      // imágenes: mantener `images` o convertir `image`
      if (!prod.images || prod.images.length === 0) {
        if (prod.image) prod.images = [prod.image];
      }
      // resolver rutas locales: si la entrada es solo un nombre, buscar en carpetas comunes
      if (prod.images && prod.images.length) {
        prod.images = prod.images.map(src => {
          if (!src) return src;
          // si es URL absoluta o ruta relativa ya con slash, dejarla
          if (/^(https?:)?\/\//i.test(src) || src.startsWith('/') || src.startsWith('./') || src.includes('/')) {
            return src;
          }
          // intento preferente: carpeta `imagenes/` (usada en el repo), luego `assets/images/`
          // encodeURI para espacios y caracteres especiales
          const encoded = encodeURI(src);
          return `imagenes/${encoded}`;
        });
        // Asegurar que `image` principal apunte a la primera imagen normalizada (evita miniaturas rotas)
        if (!prod.image && prod.images.length) {
          prod.image = prod.images[0];
        }
        // Normalizar imágenes de variantes (si existen)
        if (prod.variants && Array.isArray(prod.variants)) {
          prod.variants = prod.variants.map(v => {
            const variant = { ...v };
            if (variant.images && variant.images.length) {
              variant.images = variant.images.map(src => {
                if (!src) return src;
                if (/^(https?:)?\/\//i.test(src) || src.startsWith('/') || src.startsWith('./') || src.includes('/')) {
                  return src;
                }
                return `imagenes/${encodeURI(src)}`;
              });
            }
            // ensure variant price numeric
            if (typeof variant.price !== 'undefined') variant.price = Number(variant.price);
            return variant;
          });
        }
      }
      // precios por defecto
      if (typeof prod.price === 'undefined') prod.price = 0;
      if (typeof prod.originalPrice === 'undefined') prod.originalPrice = prod.price;
      return prod;
    });
  }

  async loadProducts() {
    try {
      // Append a timestamp to avoid stale cached responses (helps when deploying updates)
      const resp = await fetch(`./products.json?t=${Date.now()}`, { cache: 'no-store' });
      this.products = await resp.json();
    } catch (error) {
      console.error('Error cargando productos:', error);
      this.showError('No se pudieron cargar los productos. Intenta nuevamente más tarde.');
    }
  }

  extractCategories() {
    const categorySet = new Set(this.products.map(product => product.category));
    this.categories = ['all', ...Array.from(categorySet)];
  }

  setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      // Debounced input to avoid filtering on every keystroke
      const handler = debounce((e) => {
        const q = (e.target.value || '').trim();
        // reset to first page when performing a search
        this.currentPage = 1;
        if (q === '') {
          // empty query -> show filtered by category (if any)
          this.renderProducts();
        } else {
          this.searchProducts(q);
        }
      }, 250);
      searchInput.addEventListener('input', handler);
    }

    // Filter functionality
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('category-filter')) {
        this.filterByCategory(e.target.dataset.category);
      }
    });

    // View Details functionality
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('view-details')) {
        const productId = parseInt(e.target.dataset.productId);
        window.location.href = `producto.html?id=${productId}`;
      }
    });

    // Modal close functionality
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-close') || e.target.classList.contains('modal')) {
        this.closeModal();
      }
    });

    // Product cards lazy loading
    this.setupLazyLoading();
  }

  setupLazyLoading() {
    const options = {
      root: null,
      // Increase rootMargin on mobile so images start loading earlier when scrolling
      rootMargin: '200px',
      threshold: 0.05
    };

    this.imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('skeleton');
          
          // Add error handling for images
          img.onerror = () => {
            img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23f0f0f0"/><text x="200" y="150" text-anchor="middle" fill="%23999" font-size="16">Imagen no disponible</text></svg>';
            img.classList.add('image-error');
          };
          
          img.onload = () => {
            img.classList.add('image-loaded');
          };
          
          this.imageObserver.unobserve(img);
        }
      });
    }, options);
  }

  showProductDetails(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    // Título
    document.getElementById('modal-product-title').textContent = product.name;

    // Construir carrusel dentro del modal
    const modalImgContainer = document.getElementById('modal-product-img-container');
    if (modalImgContainer) {
      modalImgContainer.innerHTML = '';
      const carousel = document.createElement('div');
      carousel.className = 'carousel modal-carousel';

      const track = document.createElement('div');
      track.className = 'carousel-track';

      // Render image slides
      (product.images || [product.image]).forEach((src, idx) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        if (idx === 0) slide.classList.add('active');
  const img = document.createElement('img');
  loadImageWithFallback(img, src || '', { product: product.name, idx });
  img.alt = `${product.name} - ${idx + 1}`;
  img.loading = 'lazy';
  // default size hints to reduce layout shift (can ajustarse luego)
  img.width = 600; img.height = 600;
  img.classList.add('modal-image');
        // Fallback inline SVG if image fails to load
        img.onerror = () => {
          console.error('[Modal Image] failed to load', { src: img.src, product: product.name, index: idx });
          img.onerror = null;
          img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23f8fafc"/><text x="200" y="150" text-anchor="middle" fill="%23999" font-size="16">Imagen no disponible</text></svg>';
          img.classList.add('image-error');
        };
        slide.appendChild(img);
        track.appendChild(slide);
      });

      // If the product has a video, add a video slide at the end
      if (product.video) {
        const vidSlide = document.createElement('div');
        vidSlide.className = 'carousel-slide';
        const video = document.createElement('video');
  video.controls = true;
  video.preload = 'metadata';
  video.src = safeSrc(product.video);
  // Enable muted autoplay behavior: many mobile browsers allow autoplay only when muted.
  video.muted = true;
  video.playsInline = true;
  video.autoplay = false; // we'll call play() programmatically when the slide becomes active
        video.style.maxWidth = '100%';
        video.style.maxHeight = '420px';
        video.onloadeddata = () => {
          // no-op for now
        };
        video.onerror = () => {
          // replace with fallback image if video fails
          const fallback = document.createElement('img');
          fallback.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23f8fafc"/><text x="200" y="150" text-anchor="middle" fill="%23999" font-size="16">Video no disponible</text></svg>';
          vidSlide.innerHTML = '';
          vidSlide.appendChild(fallback);
        };
        vidSlide.appendChild(video);
        track.appendChild(vidSlide);
      }

      carousel.appendChild(track);

      const prev = document.createElement('button');
      prev.className = 'carousel-prev carousel-btn';
      prev.textContent = '‹';
      const next = document.createElement('button');
      next.className = 'carousel-next carousel-btn';
      next.textContent = '›';
      carousel.appendChild(prev);
      carousel.appendChild(next);

      const indicators = document.createElement('div');
      indicators.className = 'carousel-indicators';
      (product.images || [product.image]).forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = i === 0 ? 'carousel-dot active' : 'carousel-dot';
        dot.dataset.index = i;
        indicators.appendChild(dot);
      });
      carousel.appendChild(indicators);

      modalImgContainer.appendChild(carousel);

      this.initModalCarousel(carousel);

      // Variant selector: si el producto tiene variantes, renderizar botones que actualizan
      const variantsContainer = document.getElementById('modal-variants');
      if (variantsContainer) {
        variantsContainer.innerHTML = '';
        if (product.variants && Array.isArray(product.variants) && product.variants.length) {
          // helper: reconstruir carrusel con imágenes dadas
          const buildCarousel = (images, variantName = null) => {
            modalImgContainer.innerHTML = '';
            const c = document.createElement('div');
            c.className = 'carousel modal-carousel';
            const t = document.createElement('div');
            t.className = 'carousel-track';
            (images || []).forEach((src, idx) => {
              const s = document.createElement('div');
              s.className = 'carousel-slide';
              if (idx === 0) s.classList.add('active');
              const im = document.createElement('img');
              loadImageWithFallback(im, src || '', { product: product.name, variant: variantName, idx });
              im.alt = `${product.name} - ${idx + 1}`;
              im.loading = 'lazy';
              im.width = 600; im.height = 600;
              im.classList.add('modal-image');
              im.onerror = () => { console.error('[Variant Image] failed to load', { src: im.src, product: product.name, variant: variantName }); im.onerror = null; im.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23f8fafc"/><text x="200" y="150" text-anchor="middle" fill="%23999" font-size="16">Imagen no disponible</text></svg>'; };
              s.appendChild(im);
              t.appendChild(s);
            });
            c.appendChild(t);
            const pbtn = document.createElement('button'); pbtn.className = 'carousel-prev carousel-btn'; pbtn.textContent = '‹';
            const nbtn = document.createElement('button'); nbtn.className = 'carousel-next carousel-btn'; nbtn.textContent = '›';
            c.appendChild(pbtn); c.appendChild(nbtn);
            const inds = document.createElement('div'); inds.className = 'carousel-indicators';
            (images || []).forEach((_, i) => { const dot = document.createElement('button'); dot.className = i === 0 ? 'carousel-dot active' : 'carousel-dot'; dot.dataset.index = i; inds.appendChild(dot); });
            c.appendChild(inds);
            modalImgContainer.appendChild(c);
            // init carousel behavior
            this.initModalCarousel(c);
          };

          product.variants.forEach((v, idx) => {
            const b = document.createElement('button');
            b.className = 'variant-btn' + (idx === 0 ? ' active' : '');
            // mostrar nombre y precio corto en el botón
            b.textContent = `${v.name} · ${Currency.formatPrice(v.price)}`;
            b.dataset.variantId = v.id;
            b.onclick = (ev) => {
              // marcar activo
              variantsContainer.querySelectorAll('.variant-btn').forEach(x => x.classList.remove('active'));
              b.classList.add('active');

              // actualizar precio y originalPrice
              document.getElementById('modal-current-price').textContent = Currency.formatPrice(v.price || product.price || 0);
              const origEl = document.getElementById('modal-original-price');
              if (product.originalPrice && product.originalPrice > (v.price || product.price)) {
                origEl.textContent = Currency.formatPrice(product.originalPrice);
                origEl.style.display = 'inline';
              } else {
                origEl.style.display = 'none';
              }

              // actualizar descripción para incluir detalles de la variante
              const descEl = document.getElementById('modal-product-description');
              descEl.innerHTML = '';
              if (product.description) descEl.innerHTML += `<div>${product.description}</div>`;
              if (v.description) descEl.innerHTML += `<div style="margin-top:.5rem;font-weight:600">${v.name}</div><div>${v.description.replace(/\n/g,'<br/>')}</div>`;

              // setear variante seleccionada en el estado del modal
              this.currentModalVariant = v.id;

              // reconstruir carrusel con imágenes de la variante si existen, si no usar product.images
              const rawImgs = (v.images && v.images.length) ? v.images : (product.images || []);
              const imgs = rawImgs.map(src => {
                if (!src) return src;
                // si ya contiene 'imagenes/' asumir ruta correcta, si no prefix
                if (src.startsWith('imagenes/') || src.startsWith('./imagenes/') || src.startsWith('/imagenes/')) return src;
                return `imagenes/${encodeURI(src)}`;
              });
              buildCarousel(imgs, v && v.name);
            };
            variantsContainer.appendChild(b);
          });

          // activar la primera variante por defecto
          const firstBtn = variantsContainer.querySelector('.variant-btn');
          if (firstBtn) setTimeout(() => firstBtn.click(), 50);
        } else {
          variantsContainer.innerHTML = '';
        }
      }
    }

    // Descripción
    document.getElementById('modal-product-description').innerHTML = product.description || '';

    // Features
    const featuresContainer = document.getElementById('modal-product-features');
    featuresContainer.innerHTML = (product.features || []).map(feature => `<li>${feature}</li>`).join('');

    // Rating
    document.getElementById('modal-product-stars').innerHTML = this.renderStars(product.rating || 0);
    document.getElementById('modal-product-rating').textContent = `${product.rating || 0} (${product.reviews || 0} reseñas)`;

    // Price
    document.getElementById('modal-current-price').textContent = Currency.formatPrice(product.price || 0);
    const originalPriceElement = document.getElementById('modal-original-price');
    if (product.originalPrice > product.price) {
      originalPriceElement.textContent = Currency.formatPrice(product.originalPrice);
      originalPriceElement.style.display = 'inline';
    } else {
      originalPriceElement.style.display = 'none';
    }

    // Add to cart
    const modalAddToCartBtn = document.getElementById('modal-add-to-cart');
    if (modalAddToCartBtn) {
      modalAddToCartBtn.onclick = () => {
        // add selected variant if any
        const variantId = this.currentModalVariant || null;
        shoppingCart.addToCart(productId, variantId);
        this.closeModal();
      };
    }

    // Abrir modal
    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.add('show');
  }

  initModalCarousel(carousel) {
    const track = carousel.querySelector('.carousel-track');
    const slides = Array.from(track.children);
    const prev = carousel.querySelector('.carousel-prev');
    const next = carousel.querySelector('.carousel-next');
    const dots = Array.from(carousel.querySelectorAll('.carousel-dot'));
    let index = slides.findIndex(s => s.classList.contains('active')) || 0;

    function go(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach((s, idx) => s.classList.toggle('active', idx === index));
      dots.forEach((d, idx) => d.classList.toggle('active', idx === index));
      track.style.transform = `translateX(-${index * 100}%)`;

      // Pause any videos that are not visible; avoid autoplay but ensure only active video can play
      slides.forEach((s, idx) => {
        const vid = s.querySelector('video');
        if (vid) {
            if (idx === index) {
              // Try to play muted video when its slide becomes active (allowed in many browsers)
              try { vid.muted = true; vid.play().catch(()=>{}); } catch (e) {}
            } else {
              try { vid.pause(); vid.currentTime = 0; } catch (e) {}
            }
          }
      });
    }

    prev && (prev.onclick = () => go(index - 1));
    next && (next.onclick = () => go(index + 1));
    dots.forEach(d => d.onclick = () => go(parseInt(d.dataset.index)));

    // keyboard support
    carousel.tabIndex = 0;
    carousel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') prev && prev.click();
      if (e.key === 'ArrowRight') next && next.click();
    });

    go(index);
  }

  closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.remove('show');
    });
  }

  getFilteredProducts() {
    return this.products.filter(product => {
      const matchesCategory = this.currentFilter === 'all' || product.category === this.currentFilter;
      return matchesCategory;
    });
  }

  searchProducts(query) {
    const q = (query || '').toString().toLowerCase().trim();
    if (!q) return this.renderProducts();

    const filteredProducts = this.products.filter(product => {
      // Respect category filter if set
      if (this.currentFilter && this.currentFilter !== 'all' && product.category !== this.currentFilter) return false;

      const name = (product.name || '').toString().toLowerCase();
      const desc = (product.description || '').toString().toLowerCase();
      const category = (product.category || '').toString().toLowerCase();
      const features = (product.features || []).join(' ').toString().toLowerCase();
      const tags = (product.tags || []).join(' ').toString().toLowerCase();
      const sku = (product.sku || '').toString().toLowerCase();

      return name.includes(q) || desc.includes(q) || category.includes(q) || features.includes(q) || tags.includes(q) || sku.includes(q);
    });

    // show results starting on page 1
    this.currentPage = 1;
    this.renderProductsFromArray(filteredProducts);
  }

  filterByCategory(category) {
    this.currentFilter = category;
    this.currentPage = 1;
    this.updateCategoryButtons();
    this.renderProducts();
  }

  updateCategoryButtons() {
    document.querySelectorAll('.category-filter').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.category === this.currentFilter) {
        btn.classList.add('active');
      }
    });
  }

  renderCategories() {
    const container = document.getElementById('category-filters');
    if (!container) return;

    container.innerHTML = this.categories.map(category => {
      const label = category === 'all' ? 'Todos los productos' : (ProductManager.CATEGORY_LABELS[category] || category);
      return `
        <button class="category-filter btn btn-secondary ${category === 'all' ? 'active' : ''}" 
                data-category="${category}">
          ${label}
        </button>
      `;
    }).join('');
  }

  renderProducts() {
    const filteredProducts = this.getFilteredProducts();
    this.renderProductsFromArray(filteredProducts);
  }

  renderProductsFromArray(products) {
    const container = document.getElementById('products-grid');
    if (!container) return;

    const startIndex = (this.currentPage - 1) * this.productsPerPage;
    const endIndex = startIndex + this.productsPerPage;
    const paginatedProducts = products.slice(startIndex, endIndex);

    if (paginatedProducts.length === 0) {
      container.innerHTML = `
        <div class="no-products">
          <h3>No se encontraron productos</h3>
          <p>Intenta ajustar tu búsqueda o filtros.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = paginatedProducts.map(product => this.createProductCard(product)).join('');
    
  // Setup lazy loading for new images
  container.querySelectorAll('img[data-src]').forEach(img => {
    this.imageObserver.observe(img);
  });

  // Init carousels inside product cards
  setTimeout(() => { initCarousels(); }, 50);

  this.updatePagination(products.length);
  }

  createProductCard(product) {
    const discountPercentage = Math.round((1 - product.price / product.originalPrice) * 100);
    let imageHtml = '';
    if (product.images && product.images.length > 0) {
  const slides = product.images.map((img, idx) => `\n            <div class="carousel-slide"><img data-src="${safeSrc(img)}" alt="${product.name} - ${idx+1}" loading="lazy"></div>`).join('');
      imageHtml = `
        <div class="carousel">
          <div class="carousel-track">
            ${slides}
          </div>
          <div class="carousel-controls">
            <button class="carousel-btn prev">‹</button>
            <button class="carousel-btn next">›</button>
          </div>
          <div class="carousel-indicators">
            ${product.images.map((_,i)=>`<button data-index="${i}" ${i===0? 'class="active"':''}></button>`).join('')}
          </div>
        </div>
      `;
    } else {
  imageHtml = `<div class="image-container"><img class="image-responsive skeleton" data-src="${safeSrc(product.image || '')}" alt="${product.name}" loading="lazy"></div>`;
    }

    return `
      <div class="card product-card fade-in" data-product-id="${product.id}">
        ${imageHtml}
        <div class="card-body">
          <h3 class="product-title">${product.name}</h3>
          <p class="product-description truncated" title="${(product.description||'').replace(/"/g,'&quot;')}">${product.description}</p>
          <div class="product-features">
            ${ (product.features||[]).slice(0, 3).map(feature => `<span class="feature-tag">${feature}</span>`).join('') }
          </div>
          <div class="product-rating">
            ${this.renderStars(product.rating||0)}
            <span class="rating-text">${(product.rating||0)} (${product.reviews||0} reseñas)</span>
          </div>
          <div class="product-price">
            <span class="current-price">${Currency.formatPrice(product.price||0)}</span>
            ${product.originalPrice > product.price ? `<span class="original-price">${Currency.formatPrice(product.originalPrice)}</span>` : ''}
          </div>
        </div>
        <div class="card-footer">
          <button class="btn btn-primary add-to-cart" data-product-id="${product.id}">🛒 Agregar al Carrito</button>
          <a class="btn btn-secondary view-details" href="product.html?id=${product.id}">👁️ Ver Detalles</a>
          <button class="btn btn-whatsapp buy-whatsapp" data-product-id="${product.id}">💬 Consultar por WhatsApp</button>
        </div>
      </div>
    `;
  }

  renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return `
      <div class="stars">
        ${'★'.repeat(fullStars)}
        ${hasHalfStar ? '☆' : ''}
        ${'☆'.repeat(emptyStars)}
      </div>
    `;
  }

  updatePagination(totalProducts) {
    const totalPages = Math.ceil(totalProducts / this.productsPerPage);
    const paginationContainer = document.getElementById('pagination');
    
    if (!paginationContainer || totalPages <= 1) {
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    let paginationHTML = `
      <button class="btn btn-secondary pagination-btn" 
              ${this.currentPage === 1 ? 'disabled' : ''} 
              onclick="productManager.goToPage(${this.currentPage - 1})">
  Anterior
      </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
        paginationHTML += `
          <button class="btn ${i === this.currentPage ? 'btn-primary' : 'btn-secondary'} pagination-btn" 
                  onclick="productManager.goToPage(${i})">
            ${i}
          </button>
        `;
      } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
        paginationHTML += '<span class="pagination-ellipsis">...</span>';
      }
    }

    paginationHTML += `
      <button class="btn btn-secondary pagination-btn" 
              ${this.currentPage === totalPages ? 'disabled' : ''} 
              onclick="productManager.goToPage(${this.currentPage + 1})">
  Siguiente
      </button>
    `;

    paginationContainer.innerHTML = paginationHTML;
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderProducts();
    document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  showError(message) {
    const container = document.getElementById('products-grid');
    if (container) {
      container.innerHTML = `
        <div class="error-message">
          <h3>Error</h3>
          <p>${message}</p>
        </div>
      `;
    }
  }
}

// Carousel initializer (autoplay + controls)
function initCarousels(){
  document.querySelectorAll('.carousel').forEach(car => {
    const track = car.querySelector('.carousel-track');
    const slides = Array.from(track.children);
    // Ensure each slide takes full carousel width (fix mobile sliding where slides appear cut)
    const carWidth = car.clientWidth || car.getBoundingClientRect().width;
    slides.forEach(s => { s.style.flex = '0 0 ' + carWidth + 'px'; });
    const prev = car.querySelector('.carousel-btn.prev');
    const next = car.querySelector('.carousel-btn.next');
    const indicators = Array.from(car.querySelectorAll('.carousel-indicators button'));
    let idx = 0;
    function go(i){ idx = (i+slides.length)%slides.length; track.style.transform = `translateX(-${idx * carWidth}px)`; indicators.forEach((b,bi)=> b.classList.toggle('active', bi===idx)); }
    prev && prev.addEventListener('click', ()=> { go(idx-1); });
    next && next.addEventListener('click', ()=> { go(idx+1); });
    indicators.forEach((btn,i)=> btn.addEventListener('click', ()=> go(i)));
    // autoplay
    let interval = setInterval(()=> go(idx+1), 3500);
    car.addEventListener('mouseenter', ()=> clearInterval(interval));
    car.addEventListener('mouseleave', ()=> interval = setInterval(()=> go(idx+1), 3500));
    // Recompute slide widths on resize (handles orientation changes)
    window.addEventListener('resize', () => {
      const newWidth = car.clientWidth || car.getBoundingClientRect().width;
      slides.forEach(s => { s.style.flex = '0 0 ' + newWidth + 'px'; });
      // Reposition track to current index with new width
      track.style.transform = `translateX(-${idx * newWidth}px)`;
    });
    // initial
    go(0);
  });
}

// Shopping Cart Management
class ShoppingCart {
  constructor() {
    this.items = JSON.parse(localStorage.getItem('cart')) || [];
    this.updateCartDisplay();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('add-to-cart')) {
        const productId = parseInt(e.target.dataset.productId);
        this.addToCart(productId);
      } else if (e.target.classList.contains('buy-whatsapp')) {
        const productId = parseInt(e.target.dataset.productId);
        this.buyViaWhatsApp(productId);
      }
    });

    // Cart icon click
    const cartIcon = document.querySelector('.cart-icon');
    if (cartIcon) {
      cartIcon.addEventListener('click', () => {
        this.showCart();
      });
    }

    // Cart modal actions
    document.addEventListener('click', (e) => {
      if (e.target.id === 'clear-cart') {
        this.clearCart();
      } else if (e.target.id === 'checkout-btn') {
        this.proceedToCheckout();
      } else if (e.target.classList.contains('quantity-btn')) {
        const productId = parseInt(e.target.dataset.productId);
        const action = e.target.dataset.action;
        this.updateQuantity(productId, action);
      }
    });
  }

  addToCart(productId, variantId = null) {
    const product = productManager.products.find(p => p.id === productId);
    if (!product) return;

    // resolve variant if provided
    let variant = null;
    if (variantId && product.variants && Array.isArray(product.variants)) {
      variant = product.variants.find(v => v.id === variantId) || null;
    }

    // Use a composite key to differentiate same product different variants
    const key = variant ? `${productId}::${variant.id}` : `${productId}`;

    const existingItem = this.items.find(item => item.key === key);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      const item = {
        key,
        id: productId,
        variantId: variant ? variant.id : null,
        variantName: variant ? variant.name : null,
        name: product.name,
        price: variant && variant.price ? variant.price : (product.price || 0),
        originalPrice: product.originalPrice || product.price || 0,
        images: (variant && variant.images && variant.images.length) ? variant.images : (product.images || [product.image]),
        quantity: 1
      };
      this.items.push(item);
    }

    this.saveCart();
    this.updateCartDisplay();
    this.showAddedToCartNotification(product.name);
  }

  saveCart() {
    localStorage.setItem('cart', JSON.stringify(this.items));
  }

  updateCartDisplay() {
    const cartCount = document.getElementById('cart-count');
    const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
    
    if (cartCount) {
      cartCount.textContent = totalItems;
      cartCount.style.display = totalItems > 0 ? 'block' : 'none';
    }
  }

  showAddedToCartNotification(productName) {
    // Create notification
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `
      <span>✓ ${productName} agregado al carrito</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  showCart() {
    this.renderCartItems();
    const modal = document.getElementById('cart-modal');
    modal.classList.add('show');
  }

  renderCartItems() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalContainer = document.getElementById('cart-total');

    if (this.items.length === 0) {
      cartItemsContainer.innerHTML = `
        <div class="empty-cart">
          <h3>Tu carrito está vacío</h3>
          <p>Comienza a comprar para añadir artículos a tu carrito.</p>
        </div>
      `;
      cartTotalContainer.innerHTML = '';
      return;
    }

      cartItemsContainer.innerHTML = this.items.map(item => {
        const thumb = safeSrc((item.images && item.images[0]) || item.image || '');
        return `
        <div class="cart-item">
          <img src="${thumb}" alt="${item.name}" class="cart-item-image">
          <div class="cart-item-details">
            <div class="cart-item-title">${item.name}</div>
            <div class="cart-item-price">${Currency.formatPrice(item.price)}</div>
          </div>
          <div class="cart-item-quantity">
            <button class="quantity-btn" data-product-id="${item.id}" data-action="decrease">-</button>
            <span>${item.quantity}</span>
            <button class="quantity-btn" data-product-id="${item.id}" data-action="increase">+</button>
          </div>
          <div class="cart-item-total">${Currency.formatPrice(item.price * item.quantity)}</div>
        </div>
      `;
      }).join('');

    const total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Enhanced total display with automation
    let totalHTML = `<div>Subtotal: ${Currency.formatPrice(total)}</div>`;
    
    if (window.colombiaAutomation) {
      const location = window.colombiaAutomation.getSelectedLocation();
      if (location.department && location.city) {
        const dept = window.colombiaAutomation.colombianDepartments[location.department];
  const subtotalCOP = Currency.getPriceValue(total);
  const shippingCost = subtotalCOP >= 100000 ? 0 : dept.shippingCost;
        const finalTotal = subtotalCOP + shippingCost;
        
        totalHTML += `
          <div class="automation-summary">
            <h4>📍 Resumen de envío a ${location.city}</h4>
            <div class="summary-line">
              <span>Subtotal:</span>
              <span>${Currency.formatPrice(total)}</span>
            </div>
            <div class="summary-line">
              <span>Envío:</span>
              <span>${shippingCost > 0 ? Currency.formatPrice(shippingCost) : 'GRATIS'}</span>
            </div>
            <div class="summary-line" style="font-size:12px;color:#6b7280;">
              <em>Nota: el costo es aproximado y puede subir o bajar según la ciudad y la transportadora.</em>
            </div>
            <div class="summary-line total">
              <span>Total:</span>
              <span>${Currency.formatPrice(finalTotal)}</span>
            </div>
            <div class="summary-line">
              <span>Entrega estimada:</span>
              <span>${dept.deliveryDays.min}-${dept.deliveryDays.max} días</span>
            </div>
          </div>
        `;
      } else {
        totalHTML += `
          <div class="automation-summary">
            <h4>📍 Selecciona tu ubicación</h4>
            <p style="font-size: 13px; color: #6b7280; margin: 8px 0;">
              Elige tu departamento y ciudad arriba para ver el costo de envío y tiempo de entrega exacto.
            </p>
          </div>
        `;
      }
    }
    
    cartTotalContainer.innerHTML = totalHTML;
  }

  updateQuantity(productId, action) {
    const item = this.items.find(item => item.id === productId);
    if (!item) return;

    if (action === 'increase') {
      item.quantity += 1;
    } else if (action === 'decrease') {
      item.quantity -= 1;
      if (item.quantity <= 0) {
        this.removeFromCart(productId);
        this.renderCartItems();
        this.updateCartDisplay();
        return;
      }
    }

    this.saveCart();
    this.renderCartItems();
    this.updateCartDisplay();
  }

  removeFromCart(productId) {
    this.items = this.items.filter(item => item.id !== productId);
  }

  clearCart() {
    this.items = [];
    this.saveCart();
    this.renderCartItems();
    this.updateCartDisplay();
  }

  buyViaWhatsApp(productId) {
    const product = productManager.products.find(p => p.id === productId);
    if (!product) return;

    // Create WhatsApp message for single product
    let message = "🛍️ *Consulta de Producto - PremiumDrop*\n\n";
    message += "*Producto de interés:*\n";
    message += `📦 ${product.name}\n`;
    message += `💰 Precio: ${Currency.formatPrice(product.price)}\n`;
    message += `⭐ Calificación: ${product.rating}/5 (${product.reviews} reseñas)\n\n`;
    message += "¡Hola! Me interesa este producto. ¿Podrías darme más información sobre:\n";
    message += "• Disponibilidad y origen del producto\n";
    message += "• Métodos de pago disponibles\n";
    message += "• Tiempo de entrega a Colombia (7-15 días)\n";
    message += "• Proceso de importación\n";
    message += "• Garantía y soporte\n\n";
    message += "📍 *Ubicación en Colombia:*\n";
    message += "Por favor, indica tu ciudad para calcular tiempo exacto de entrega.\n\n";
    message += "¡Gracias! 😊";
    
    // Enhance message with automation if location is selected
    if (window.colombiaAutomation) {
      const location = window.colombiaAutomation.getSelectedLocation();
      if (location.department && location.city) {
        message = window.colombiaAutomation.enhanceWhatsAppMessage(message, location.department, location.city);
      }
    }
    
    // WhatsApp number (3115477984)
    const whatsappNumber = "573115477984"; // Colombia country code + number
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    
    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank');
  }

  proceedToCheckout() {
    if (this.items.length === 0) {
      alert('¡Tu carrito está vacío!');
      return;
    }

    this.proceedToWhatsAppCheckout();
  }

  proceedToWhatsAppCheckout() {
    const total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
    
    // Calculate total with shipping if automation is available
    let finalTotal = total;
    let shippingInfo = "";
    
    if (window.colombiaAutomation) {
      finalTotal = window.colombiaAutomation.calculateTotalWithShipping(Currency.getPriceValue(total));
      const location = window.colombiaAutomation.getSelectedLocation();
      
      if (location.department && location.city) {
        const dept = window.colombiaAutomation.colombianDepartments[location.department];
        const shippingCost = finalTotal > Currency.getPriceValue(total) ? dept.shippingCost : 0;
  shippingInfo = `\n*Información de envío:*\n`;
  shippingInfo += `• Destino: ${location.city}, ${dept.name}\n`;
  shippingInfo += `• Costo de envío: ${shippingCost > 0 ? Currency.formatPrice(shippingCost) : 'GRATIS'}\n`;
      }
    }
    
    // Create WhatsApp message
    let message = "🛍️ *Nuevo Pedido - PremiumDrop*\n\n";
    message += "*Productos solicitados:*\n";
    
    this.items.forEach((item, index) => {
      message += `${index + 1}. ${item.name}\n`;
      message += `   Cantidad: ${item.quantity}\n`;
      message += `   Precio: ${Currency.formatPrice(item.price)}\n`;
      message += `   Subtotal: ${Currency.formatPrice(item.price * item.quantity)}\n\n`;
    });
    
    message += `*Total de artículos:* ${itemCount}\n`;
    message += `*Subtotal:* ${Currency.formatPrice(total)}\n`;
    
    if (shippingInfo) {
      message += shippingInfo;
    }
    
  message += `*Total final:* ${Currency.formatPrice(finalTotal)}\n\n`;
    message += "📍 *Información importante:*\n";
    message += "• Los productos son importados directamente de fabricantes internacionales\n";
    message += "• Tiempo de entrega: 7-15 días hábiles en Colombia\n";
    message += "• Envío gratuito en pedidos superiores a $200.000 COP\n";
    message += "• Proceso de importación personalizada\n\n";
    
    // Enhance message with automation if location is selected
    if (window.colombiaAutomation) {
      const location = window.colombiaAutomation.getSelectedLocation();
      if (location.department && location.city) {
        message = window.colombiaAutomation.enhanceWhatsAppMessage(message, location.department, location.city);
      } else {
        message += "¿Podrías confirmar tu ciudad en Colombia para el envío?\n\n";
      }
    } else {
      message += "¿Podrías confirmar tu ciudad en Colombia para el envío?\n\n";
    }
    
    message += "¡Gracias por elegir PremiumDrop! 🚚\n";
    message += "Nuestro equipo comercial te contactará con todos los detalles.";
    
    // WhatsApp number (3115477984)
    const whatsappNumber = "573115477984"; // Colombia country code + number
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    
    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank');
    
    // Show success message and clear cart
    setTimeout(() => {
      alert('¡Tu pedido ha sido enviado por WhatsApp! Revisa tu app de WhatsApp y confirma tu ubicación.');
      this.clearCart();
      
      // Close modal
      document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('show');
      });
    }, 1000);
  }
}

// Featured Products Carousel
class FeaturedCarousel {
  constructor() {
    this.currentSlide = 0;
    this.itemsPerSlide = 4;
    this.featuredProducts = [];
    this.autoplayInterval = null;
    this.init();
  }

  async init() {
    // Wait for products to load
    if (!productManager || !productManager.products.length) {
      setTimeout(() => this.init(), 100);
      return;
    }
    
    this.setupFeaturedProducts();
    this.render();
    this.setupEventListeners();
    this.startAutoplay();
  }

  setupFeaturedProducts() {
    // Prefer products explicitly marked as featured in the catalog
    const all = productManager.products || [];
    const featuredFlagged = all.filter(p => p.featured === true);
    if (featuredFlagged.length > 0) {
      this.featuredProducts = featuredFlagged.slice(0, 8);
      return;
    }

    // Fallback: Get top 8 products by rating/reviews
    this.featuredProducts = all
      .slice() // copy
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0))
      .slice(0, 8);
  }

  render() {
    const track = document.getElementById('carousel-track');
    const indicators = document.getElementById('carousel-indicators');
    
    if (!track || !indicators) return;

    // Render lightweight carousel items (ensure images load inside carousel)
    track.innerHTML = this.featuredProducts.map(product => {
      const imgSrc = safeSrc((product.images && product.images[0]) || product.image || '');
      const title = product.name || product.title || '';
      const price = Currency.formatPrice(product.price || 0);
      return `
      <div class="carousel-item">
        <div class="carousel-card featured-click" data-product-id="${product.id}">
          <div class="carousel-thumb"><img src="${imgSrc}" alt="${title}" style="width:100%;height:auto;max-height:180px;object-fit:contain;border-radius:8px;"/></div>
          <div class="carousel-meta" style="padding:12px 16px;">
            <div style="font-weight:600;margin-bottom:6px;">${title}</div>
            <div style="color:var(--color-text-secondary);font-size:14px;margin-bottom:8px;">${price}</div>
          </div>
        </div>
      </div>
    `}).join('');

    // Calculate number of slides
    const totalSlides = Math.ceil(this.featuredProducts.length / this.itemsPerSlide);
    
    // Render indicators
    indicators.innerHTML = Array.from({length: totalSlides}, (_, i) => 
      `<button class="carousel-indicator ${i === 0 ? 'active' : ''}" data-slide="${i}"></button>`
    ).join('');

    this.updateCarousel();
  }

  setupEventListeners() {
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    const indicators = document.getElementById('carousel-indicators');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevSlide());
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextSlide());
    }

    if (indicators) {
      indicators.addEventListener('click', (e) => {
        if (e.target.classList.contains('carousel-indicator')) {
          this.goToSlide(parseInt(e.target.dataset.slide));
        }
      });
    }

    // Delegated click handler: open product modal when a featured item is clicked
    const track = document.getElementById('carousel-track');
    if (track) {
      track.addEventListener('click', (e) => {
        const el = e.target.closest('.featured-click');
        if (el && el.dataset && el.dataset.productId) {
          const pid = parseInt(el.dataset.productId);
          if (window.productManager && typeof window.productManager.showProductDetails === 'function') {
            window.productManager.showProductDetails(pid);
            // scroll to products section lightly to show modal context
            document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    }

    // Pause autoplay on hover
    const carousel = document.querySelector('.carousel-container');
    if (carousel) {
      carousel.addEventListener('mouseenter', () => this.stopAutoplay());
      carousel.addEventListener('mouseleave', () => this.startAutoplay());
    }
  }

  updateCarousel() {
    const track = document.getElementById('carousel-track');
    const indicators = document.querySelectorAll('.carousel-indicator');
    
    if (!track) return;

    const itemWidth = 300 + 24; // item width + gap
    const offset = -this.currentSlide * (itemWidth * this.itemsPerSlide);
    track.style.transform = `translateX(${offset}px)`;

    // Update indicators
    indicators.forEach((indicator, index) => {
      indicator.classList.toggle('active', index === this.currentSlide);
    });
  }

  nextSlide() {
    const totalSlides = Math.ceil(this.featuredProducts.length / this.itemsPerSlide);
    this.currentSlide = (this.currentSlide + 1) % totalSlides;
    this.updateCarousel();
  }

  prevSlide() {
    const totalSlides = Math.ceil(this.featuredProducts.length / this.itemsPerSlide);
    this.currentSlide = this.currentSlide === 0 ? totalSlides - 1 : this.currentSlide - 1;
    this.updateCarousel();
  }

  goToSlide(index) {
    this.currentSlide = index;
    this.updateCarousel();
  }

  startAutoplay() {
    this.stopAutoplay();
    this.autoplayInterval = setInterval(() => this.nextSlide(), 5000);
  }

  stopAutoplay() {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
      this.autoplayInterval = null;
    }
  }
}

// Initialize when DOM is loaded
let productManager;
let shoppingCart;
let featuredCarousel;

document.addEventListener('DOMContentLoaded', () => {
  productManager = new ProductManager();
  shoppingCart = new ShoppingCart();
  
  // Initialize carousel after products load
  setTimeout(() => {
    featuredCarousel = new FeaturedCarousel();
  }, 500);
});

// Navegación del carousel en modal
(function() {
  const carousel = document.querySelector('.modal-carousel');
  if (!carousel) return;
  const track = carousel.querySelector('.carousel-track');
  const slides = Array.from(track.children);
  let index = 0;
  const prev = carousel.querySelector('.carousel-prev');
  const next = carousel.querySelector('.carousel-next');

  function update() {
    const offset = -index * carousel.clientWidth;
    track.style.transform = `translateX(${offset}px)`;
  }

  prev && prev.addEventListener('click', () => {
    index = Math.max(0, index - 1);
    update();
  });
  next && next.addEventListener('click', () => {
    index = Math.min(slides.length - 1, index + 1);
    update();
  });
})();
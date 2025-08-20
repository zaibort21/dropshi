// Product Management System
class ProductManager {
  constructor() {
    this.products = [];
    this.categories = [];
    this.currentFilter = 'all';
    this.currentPage = 1;
    this.productsPerPage = 12;
    this.init();
  }

  async init() {
    await this.loadProducts();
    this.extractCategories();
    this.setupEventListeners();
    this.renderProducts();
    this.renderCategories();
  }

  async loadProducts() {
    try {
      const response = await fetch('./products.json');
      this.products = await response.json();
    } catch (error) {
      console.error('Error loading products:', error);
      this.showError('Failed to load products. Please try again later.');
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
      searchInput.addEventListener('input', (e) => {
        this.searchProducts(e.target.value);
      });
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
        this.showProductDetails(productId);
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
      rootMargin: '50px',
      threshold: 0.1
    };

    this.imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('skeleton');
          this.imageObserver.unobserve(img);
        }
      });
    }, options);
  }

  showProductDetails(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    // Update modal content
    document.getElementById('modal-product-title').textContent = product.name;
    document.getElementById('modal-product-img').src = product.image;
    document.getElementById('modal-product-img').alt = product.name;
    document.getElementById('modal-product-description').textContent = product.description;
    
    // Update features
    const featuresContainer = document.getElementById('modal-product-features');
    featuresContainer.innerHTML = product.features.map(feature => 
      `<span class="feature-tag">${feature}</span>`
    ).join('');
    
    // Update rating
    document.getElementById('modal-product-stars').innerHTML = this.renderStars(product.rating);
    document.getElementById('modal-product-rating').textContent = `${product.rating} (${product.reviews} reviews)`;
    
    // Update price
    document.getElementById('modal-current-price').textContent = `$${product.price}`;
    const originalPriceElement = document.getElementById('modal-original-price');
    if (product.originalPrice > product.price) {
      originalPriceElement.textContent = `$${product.originalPrice}`;
      originalPriceElement.style.display = 'inline';
    } else {
      originalPriceElement.style.display = 'none';
    }
    
    // Set up add to cart button
    const modalAddToCartBtn = document.getElementById('modal-add-to-cart');
    modalAddToCartBtn.onclick = () => {
      shoppingCart.addToCart(productId);
      this.closeModal();
    };
    
    // Show modal
    const modal = document.getElementById('product-modal');
    modal.classList.add('show');
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
    const filteredProducts = this.products.filter(product => {
      return product.name.toLowerCase().includes(query.toLowerCase()) ||
             product.description.toLowerCase().includes(query.toLowerCase()) ||
             product.category.toLowerCase().includes(query.toLowerCase());
    });
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

    container.innerHTML = this.categories.map(category => `
      <button class="category-filter btn btn-secondary ${category === 'all' ? 'active' : ''}" 
              data-category="${category}">
        ${category === 'all' ? 'All Products' : category}
      </button>
    `).join('');
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
          <h3>No products found</h3>
          <p>Try adjusting your search or filter criteria.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = paginatedProducts.map(product => this.createProductCard(product)).join('');
    
    // Setup lazy loading for new images
    container.querySelectorAll('img[data-src]').forEach(img => {
      this.imageObserver.observe(img);
    });

    this.updatePagination(products.length);
  }

  createProductCard(product) {
    const discountPercentage = Math.round((1 - product.price / product.originalPrice) * 100);
    
    return `
      <div class="card product-card fade-in" data-product-id="${product.id}">
        <div class="image-container">
          <img class="image-responsive skeleton" 
               data-src="${product.image}" 
               alt="${product.name}"
               loading="lazy">
          ${discountPercentage > 0 ? `<div class="discount-badge">-${discountPercentage}%</div>` : ''}
        </div>
        <div class="card-body">
          <h3 class="product-title">${product.name}</h3>
          <p class="product-description">${product.description}</p>
          <div class="product-features">
            ${product.features.slice(0, 3).map(feature => `<span class="feature-tag">${feature}</span>`).join('')}
          </div>
          <div class="product-rating">
            ${this.renderStars(product.rating)}
            <span class="rating-text">${product.rating} (${product.reviews} reviews)</span>
          </div>
          <div class="product-price">
            <span class="current-price">$${product.price}</span>
            ${product.originalPrice > product.price ? `<span class="original-price">$${product.originalPrice}</span>` : ''}
          </div>
        </div>
        <div class="card-footer">
          <button class="btn btn-primary add-to-cart" data-product-id="${product.id}">
            Add to Cart
          </button>
          <button class="btn btn-secondary view-details" data-product-id="${product.id}">
            View Details
          </button>
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
        Previous
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
        Next
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

  addToCart(productId) {
    const product = productManager.products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = this.items.find(item => item.id === productId);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.items.push({ ...product, quantity: 1 });
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
      <span>✓ ${productName} added to cart</span>
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
          <h3>Your cart is empty</h3>
          <p>Start shopping to add items to your cart!</p>
        </div>
      `;
      cartTotalContainer.innerHTML = '';
      return;
    }

    cartItemsContainer.innerHTML = this.items.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}" class="cart-item-image">
        <div class="cart-item-details">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-price">$${item.price}</div>
        </div>
        <div class="cart-item-quantity">
          <button class="quantity-btn" data-product-id="${item.id}" data-action="decrease">-</button>
          <span>${item.quantity}</span>
          <button class="quantity-btn" data-product-id="${item.id}" data-action="increase">+</button>
        </div>
        <div class="cart-item-total">$${(item.price * item.quantity).toFixed(2)}</div>
      </div>
    `).join('');

    const total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotalContainer.innerHTML = `
      <div>Total: $${total.toFixed(2)}</div>
    `;
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

  proceedToCheckout() {
    if (this.items.length === 0) {
      alert('Your cart is empty!');
      return;
    }

    const total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
    
    alert(`Thank you for your purchase!\n\nItems: ${itemCount}\nTotal: $${total.toFixed(2)}\n\nThis is a demo store. In a real implementation, this would redirect to a payment processor.`);
    
    // Clear cart after "purchase"
    this.clearCart();
    
    // Close modal
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.remove('show');
    });
  }
}

// Initialize when DOM is loaded
let productManager;
let shoppingCart;

document.addEventListener('DOMContentLoaded', () => {
  productManager = new ProductManager();
  shoppingCart = new ShoppingCart();
});
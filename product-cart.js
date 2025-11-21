// Product Cart System - Específicamente para páginas de productos individuales
// Este script se carga en las páginas de producto-X.html para que el carrito funcione correctamente

class ProductCart {
  constructor() {
    this.items = JSON.parse(localStorage.getItem('cart')) || [];
    this.updateCartDisplay();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Agregar al carrito desde botón en página de producto
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('add-to-cart-btn')) {
        const productId = parseInt(e.target.dataset.productId);
        const productName = e.target.dataset.productName;
        const productPrice = parseFloat(e.target.dataset.productPrice);
        const productImage = e.target.dataset.productImage;
        
        this.addToCart(productId, productName, productPrice, productImage);
      }
    });

    // Carrito icon click
    const cartIcon = document.querySelector('.cart-icon');
    if (cartIcon) {
      cartIcon.addEventListener('click', () => {
        this.showCart();
      });
    }

    // Cerrar carrito modal
    document.addEventListener('click', (e) => {
      if (e.target.id === 'close-cart-modal') {
        this.closeCart();
      }
    });
  }

  addToCart(productId, productName, productPrice, productImage) {
    const existingItem = this.items.find(item => item.id === productId);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      const item = {
        id: productId,
        name: productName,
        price: productPrice,
        image: productImage,
        quantity: 1
      };
      this.items.push(item);
    }

    this.saveCart();
    this.updateCartDisplay();
    this.showNotification(`✓ ${productName} agregado al carrito`);
  }

  saveCart() {
    localStorage.setItem('cart', JSON.stringify(this.items));
  }

  updateCartDisplay() {
    const cartCount = document.getElementById('cart-count');
    const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
    
    if (cartCount) {
      if (totalItems > 0) {
        cartCount.textContent = totalItems;
        cartCount.style.display = 'block';
      } else {
        cartCount.style.display = 'none';
      }
    }
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `<span>${message}</span>`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 9999;
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  showCart() {
    // Crear modal simple del carrito
    const modal = document.createElement('div');
    modal.id = 'cart-modal';
    modal.className = 'cart-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: flex-end;
      z-index: 9999;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      width: 100%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      border-radius: 12px 12px 0 0;
      padding: 20px;
      box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
    `;

    if (this.items.length === 0) {
      content.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
          <h3 style="margin-bottom: 10px;">Tu carrito está vacío</h3>
          <p style="color: #666; margin-bottom: 20px;">Agrega productos para comenzar a comprar</p>
          <button id="close-cart-modal" style="
            padding: 10px 20px;
            background: #007aff;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
          ">Cerrar</button>
        </div>
      `;
    } else {
      let itemsHtml = '';
      this.items.forEach(item => {
        itemsHtml += `
          <div style="
            display: flex;
            gap: 12px;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
            align-items: center;
          ">
            <img src="${item.image}" alt="${item.name}" style="
              width: 60px;
              height: 60px;
              object-fit: cover;
              border-radius: 8px;
            ">
            <div style="flex: 1;">
              <div style="font-weight: 600; margin-bottom: 4px;">${item.name}</div>
              <div style="color: #666; font-size: 14px;">Cantidad: ${item.quantity}</div>
            </div>
            <div style="text-align: right; font-weight: 600;">
              $${(item.price * item.quantity).toLocaleString('es-CO')}
            </div>
          </div>
        `;
      });

      const total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      content.innerHTML = `
        <div style="margin-bottom: 20px;">
          <h3 style="margin-bottom: 16px;">Tu Carrito</h3>
          ${itemsHtml}
        </div>
        <div style="
          border-top: 2px solid #e5e7eb;
          padding: 16px 0;
          margin-bottom: 20px;
          font-size: 18px;
          font-weight: 700;
        ">
          Total: $${total.toLocaleString('es-CO')} COP
        </div>
        <div style="display: flex; gap: 12px;">
          <button id="close-cart-modal" style="
            flex: 1;
            padding: 12px;
            background: #f3f4f6;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
          ">Cerrar</button>
          <button id="checkout-btn" style="
            flex: 1;
            padding: 12px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
          ">Ir a WhatsApp</button>
        </div>
      `;

      // Agregar evento para checkout
      const checkoutBtn = content.querySelector('#checkout-btn');
      if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
          this.proceedToCheckout();
          this.closeCart();
        });
      }
    }

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Cerrar al hacer click fuera
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeCart();
      }
    });
  }

  closeCart() {
    const modal = document.getElementById('cart-modal');
    if (modal) modal.remove();
  }

  proceedToCheckout() {
    const total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
    
    let message = "🛍️ Nuevo Pedido - PremiumDrop\n\n";
    message += "Productos solicitados:\n";

    this.items.forEach((item, index) => {
      message += `${index + 1}. ${item.name}\n`;
      message += `   Cantidad: ${item.quantity}\n`;
      message += `   Precio: $${item.price.toLocaleString('es-CO')} COP\n`;
      message += `   Subtotal: $${(item.price * item.quantity).toLocaleString('es-CO')} COP\n\n`;
    });

    message += `Total de artículos: ${itemCount}\n`;
    message += `Subtotal: $${total.toLocaleString('es-CO')} COP\n\n`;
    message += `Información de envío:\n`;
    message += `* Destino: (por confirmar)\n`;
    message += `* Costo de envío: (por confirmar)\n\n`;
    message += `📍 Información importante:\n`;
    message += `* Los productos son importados directamente de fabricantes internacionales\n`;
    message += `* Tiempo de entrega: 7-15 días hábiles en Colombia\n`;
    message += `* Envío gratuito en pedidos superiores a $200.000 COP\n`;
    message += `* Proceso de importación personalizada\n\n`;
    message += "¡Gracias por elegir PremiumDrop! 🚚\n";
    message += "Nuestro equipo comercial te contactará con todos los detalles.";
    
    const whatsappNumber = "573115477984";
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    this.clearCart();
  }

  clearCart() {
    this.items = [];
    this.saveCart();
    this.updateCartDisplay();
  }
}

// Inicializar carrito cuando el DOM está listo
let productCart;
document.addEventListener('DOMContentLoaded', () => {
  productCart = new ProductCart();
});

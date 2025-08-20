// Colombian Automation System for PremiumDrop
// Automates location detection, shipping, pricing, and order processing for Colombia

class ColombiaAutomation {
  constructor() {
    this.colombianDepartments = {
      'antioquia': {
        name: 'Antioquia',
        capital: 'Medellín',
        cities: ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Apartadó', 'Turbo'],
        deliveryDays: { min: 7, max: 10 },
        shippingCost: 15000
      },
      'bogota': {
        name: 'Bogotá D.C.',
        capital: 'Bogotá',
        cities: ['Bogotá'],
        deliveryDays: { min: 6, max: 9 },
        shippingCost: 12000
      },
      'valle': {
        name: 'Valle del Cauca',
        capital: 'Cali',
        cities: ['Cali', 'Palmira', 'Buenaventura', 'Tuluá', 'Cartago'],
        deliveryDays: { min: 8, max: 11 },
        shippingCost: 16000
      },
      'atlantico': {
        name: 'Atlántico',
        capital: 'Barranquilla',
        cities: ['Barranquilla', 'Soledad', 'Malambo', 'Galapa'],
        deliveryDays: { min: 9, max: 12 },
        shippingCost: 18000
      },
      'santander': {
        name: 'Santander',
        capital: 'Bucaramanga',
        cities: ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta'],
        deliveryDays: { min: 8, max: 11 },
        shippingCost: 17000
      }
    };

    this.holidays2024 = [
      '2024-01-01', '2024-01-08', '2024-03-25', '2024-03-28', '2024-03-29',
      '2024-05-01', '2024-05-13', '2024-06-03', '2024-06-10', '2024-06-24',
      '2024-07-01', '2024-07-20', '2024-08-07', '2024-08-19', '2024-10-14',
      '2024-11-04', '2024-11-11', '2024-12-08', '2024-12-25'
    ];

    this.exchangeRate = 4000; // Default rate, will be updated
    this.taxRate = 0.19; // IVA 19%
    this.init();
  }

  async init() {
    this.setupLocationDetection();
    this.createDepartmentSelector();
    this.updateExchangeRate();
    this.setupDeliveryEstimator();
    this.setupAutomatedPricing();
  }

  setupLocationDetection() {
    // Detect user location automatically
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => this.handleLocationSuccess(position),
        (error) => this.handleLocationError(error),
        { timeout: 10000, enableHighAccuracy: false }
      );
    }
  }

  handleLocationSuccess(position) {
    const { latitude, longitude } = position.coords;
    this.reverseGeocode(latitude, longitude);
  }

  handleLocationError(error) {
    console.log('Geolocation error:', error);
    // Fall back to IP-based location detection
    this.detectLocationByIP();
  }

  async detectLocationByIP() {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      if (data.country_code === 'CO') {
        this.setDetectedLocation(data.city, data.region);
      }
    } catch (error) {
      console.log('IP location detection failed:', error);
    }
  }

  async reverseGeocode(lat, lng) {
    try {
      // Using a free geocoding service
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`
      );
      const data = await response.json();
      
      if (data.countryCode === 'CO') {
        this.setDetectedLocation(data.locality, data.principalSubdivision);
      }
    } catch (error) {
      console.log('Reverse geocoding failed:', error);
    }
  }

  setDetectedLocation(city, region) {
    const detectedDept = this.findDepartmentByRegion(region);
    if (detectedDept) {
      this.updateLocationDisplay(city, detectedDept);
      this.autoFillLocationSelector(detectedDept.key);
    }
  }

  findDepartmentByRegion(region) {
    for (const [key, dept] of Object.entries(this.colombianDepartments)) {
      if (dept.name.toLowerCase().includes(region.toLowerCase()) ||
          region.toLowerCase().includes(dept.name.toLowerCase())) {
        return { key, ...dept };
      }
    }
    return null;
  }

  createDepartmentSelector() {
    const existingSelector = document.getElementById('colombia-location-selector');
    if (existingSelector) return;

    const selector = document.createElement('div');
    selector.id = 'colombia-location-selector';
    selector.className = 'colombia-automation-widget';
    selector.innerHTML = `
      <div class="location-widget">
        <h3>📍 Ubicación en Colombia</h3>
        <div class="location-form">
          <select id="department-select" class="form-select">
            <option value="">Selecciona tu departamento</option>
            ${Object.entries(this.colombianDepartments).map(([key, dept]) => 
              `<option value="${key}">${dept.name}</option>`
            ).join('')}
          </select>
          <select id="city-select" class="form-select" disabled>
            <option value="">Selecciona tu ciudad</option>
          </select>
          <div id="delivery-estimate" class="delivery-info"></div>
          <div id="shipping-cost" class="shipping-info"></div>
        </div>
      </div>
    `;

    // Insert after header or at the beginning of main content
    const header = document.querySelector('header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(selector, header.nextSibling);
    } else {
      document.body.insertBefore(selector, document.body.firstChild);
    }

    this.setupLocationSelectors();
  }

  setupLocationSelectors() {
    const departmentSelect = document.getElementById('department-select');
    const citySelect = document.getElementById('city-select');

    departmentSelect.addEventListener('change', (e) => {
      const selectedDept = e.target.value;
      this.updateCitySelector(selectedDept);
      this.updateDeliveryEstimate(selectedDept);
    });

    citySelect.addEventListener('change', (e) => {
      const selectedCity = e.target.value;
      const selectedDept = departmentSelect.value;
      this.updateShippingInfo(selectedDept, selectedCity);
    });
  }

  updateCitySelector(departmentKey) {
    const citySelect = document.getElementById('city-select');
    const department = this.colombianDepartments[departmentKey];

    if (!department) {
      citySelect.disabled = true;
      citySelect.innerHTML = '<option value="">Selecciona tu ciudad</option>';
      return;
    }

    citySelect.disabled = false;
    citySelect.innerHTML = `
      <option value="">Selecciona tu ciudad</option>
      ${department.cities.map(city => 
        `<option value="${city}">${city}</option>`
      ).join('')}
    `;
  }

  updateDeliveryEstimate(departmentKey) {
    const estimateDiv = document.getElementById('delivery-estimate');
    const department = this.colombianDepartments[departmentKey];

    if (!department) {
      estimateDiv.innerHTML = '';
      return;
    }

    const deliveryDate = this.calculateDeliveryDate(department.deliveryDays);
    estimateDiv.innerHTML = `
      <div class="delivery-estimate">
        <strong>🚚 Tiempo de entrega estimado:</strong><br>
        ${department.deliveryDays.min}-${department.deliveryDays.max} días hábiles<br>
        <small>Entrega estimada: ${deliveryDate}</small>
      </div>
    `;
  }

  calculateDeliveryDate(deliveryDays) {
    const today = new Date();
    let deliveryDate = new Date(today);
    let businessDays = 0;
    let targetDays = deliveryDays.max;

    while (businessDays < targetDays) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      
      // Check if it's a weekday and not a holiday
      if (this.isBusinessDay(deliveryDate)) {
        businessDays++;
      }
    }

    return deliveryDate.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  isBusinessDay(date) {
    const dayOfWeek = date.getDay();
    const dateString = date.toISOString().split('T')[0];
    
    // Check if it's weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    
    // Check if it's a Colombian holiday
    if (this.holidays2024.includes(dateString)) return false;
    
    return true;
  }

  updateShippingInfo(departmentKey, city) {
    const shippingDiv = document.getElementById('shipping-cost');
    const department = this.colombianDepartments[departmentKey];

    if (!department || !city) {
      shippingDiv.innerHTML = '';
      return;
    }

    const shippingCost = department.shippingCost;
    const freeShippingThreshold = 200000; // 200,000 COP

    shippingDiv.innerHTML = `
      <div class="shipping-cost">
        <strong>💰 Costo de envío a ${city}:</strong><br>
        $${shippingCost.toLocaleString('es-CO')} COP<br>
        <small>📦 Envío GRATIS en pedidos superiores a $${freeShippingThreshold.toLocaleString('es-CO')} COP</small>
      </div>
    `;
  }

  async updateExchangeRate() {
    try {
      // Using a free exchange rate API
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();
      
      if (data.rates && data.rates.COP) {
        this.exchangeRate = Math.round(data.rates.COP);
        
        // Update the Currency utility
        if (window.Currency) {
          window.Currency.USD_TO_COP_RATE = this.exchangeRate;
        }
        
        console.log(`Exchange rate updated: 1 USD = ${this.exchangeRate} COP`);
      }
    } catch (error) {
      console.log('Exchange rate update failed, using default rate:', error);
    }
  }

  setupDeliveryEstimator() {
    // Add delivery estimation to all product cards
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const productCards = document.querySelectorAll('.product-card');
          productCards.forEach(card => this.enhanceProductCard(card));
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Enhance existing product cards
    const existingCards = document.querySelectorAll('.product-card');
    existingCards.forEach(card => this.enhanceProductCard(card));
  }

  enhanceProductCard(card) {
    if (card.querySelector('.colombia-delivery-info')) return; // Already enhanced

    const selectedDept = document.getElementById('department-select')?.value;
    if (!selectedDept) return;

    const department = this.colombianDepartments[selectedDept];
    const deliveryInfo = document.createElement('div');
    deliveryInfo.className = 'colombia-delivery-info';
    deliveryInfo.innerHTML = `
      <div class="delivery-badge">
        🚚 ${department.deliveryDays.min}-${department.deliveryDays.max} días
      </div>
    `;

    const cardFooter = card.querySelector('.card-footer');
    if (cardFooter) {
      cardFooter.insertBefore(deliveryInfo, cardFooter.firstChild);
    }
  }

  setupAutomatedPricing() {
    // Add tax information to pricing
    const observer = new MutationObserver(() => {
      this.updatePricingDisplays();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.updatePricingDisplays();
  }

  updatePricingDisplays() {
    const priceElements = document.querySelectorAll('.product-price, .cart-item-price');
    priceElements.forEach(element => {
      if (!element.querySelector('.tax-info')) {
        const taxInfo = document.createElement('small');
        taxInfo.className = 'tax-info';
        taxInfo.innerHTML = '<br><span style="color: #666;">IVA incluido</span>';
        element.appendChild(taxInfo);
      }
    });
  }

  autoFillLocationSelector(departmentKey) {
    const departmentSelect = document.getElementById('department-select');
    if (departmentSelect) {
      departmentSelect.value = departmentKey;
      departmentSelect.dispatchEvent(new Event('change'));
    }
  }

  updateLocationDisplay(city, department) {
    // Create or update location display
    let locationDisplay = document.getElementById('detected-location');
    if (!locationDisplay) {
      locationDisplay = document.createElement('div');
      locationDisplay.id = 'detected-location';
      locationDisplay.className = 'location-detected';
      
      const widget = document.querySelector('.location-widget');
      if (widget) {
        widget.insertBefore(locationDisplay, widget.firstChild);
      }
    }

    locationDisplay.innerHTML = `
      <div class="detected-info">
        ✅ Ubicación detectada: ${city}, ${department.name}
      </div>
    `;
  }

  // Integration with existing WhatsApp functionality
  enhanceWhatsAppMessage(message, selectedDept, selectedCity) {
    if (!selectedDept || !selectedCity) return message;

    const department = this.colombianDepartments[selectedDept];
    if (!department) return message;

    message += "\n\n📍 *Información de entrega automática:*\n";
    message += `• Ubicación: ${selectedCity}, ${department.name}\n`;
    message += `• Tiempo estimado: ${department.deliveryDays.min}-${department.deliveryDays.max} días hábiles\n`;
    message += `• Costo de envío: $${department.shippingCost.toLocaleString('es-CO')} COP\n`;
    
    const deliveryDate = this.calculateDeliveryDate(department.deliveryDays);
    message += `• Entrega estimada: ${deliveryDate}\n`;
    
    return message;
  }

  // Get current selected location
  getSelectedLocation() {
    const departmentSelect = document.getElementById('department-select');
    const citySelect = document.getElementById('city-select');
    
    return {
      department: departmentSelect?.value || null,
      city: citySelect?.value || null
    };
  }

  // Calculate total with shipping
  calculateTotalWithShipping(subtotal) {
    const location = this.getSelectedLocation();
    if (!location.department) return subtotal;

    const department = this.colombianDepartments[location.department];
    if (!department) return subtotal;

    const freeShippingThreshold = 200000;
    const shippingCost = subtotal >= freeShippingThreshold ? 0 : department.shippingCost;
    
    return subtotal + shippingCost;
  }
}

// Initialize Colombia Automation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.colombiaAutomation = new ColombiaAutomation();
});

// Make it available globally
window.ColombiaAutomation = ColombiaAutomation;
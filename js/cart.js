class CartManager {
    constructor() {
        this.api = new AlSajiAPI();
        this.cartData = null;
        this.productImages = new Map(); // Cache for product images
        this.init();
    }

    async init() {
        await this.loadCart();
        this.updateCartCount();
        this.setupEventListeners();
    }

    async loadCart() {
        try {
            const result = await this.api.getCart();
            if (result.success) {
                this.cartData = result.cart;
                await this.loadProductImages(); // Load images BEFORE rendering
                this.renderCart();
            } else {
                console.error('Failed to load cart:', result.error);
                this.showEmptyCart();
            }
        } catch (error) {
            console.error('Error loading cart:', error);
            this.showEmptyCart();
        }
    }

    async loadProductImages() {
        if (!this.cartData || !this.cartData.lines.length) return;

        try {
            // Load all products from static data instead of individual API calls
            const productsResult = await this.api.getProducts({ limit: 1000 });

            if (productsResult.success && productsResult.products) {
                // Create a map of product ID to image URL
                const productMap = new Map();
                productsResult.products.forEach(product => {
                    if (product.id && product.image_url) {
                        productMap.set(product.id, product.image_url);
                    }
                });

                // Cache the images for products in cart
                this.cartData.lines.forEach(item => {
                    if (productMap.has(item.product_id)) {
                        this.productImages.set(item.product_id, productMap.get(item.product_id));
                    }
                });
            }
        } catch (error) {
            console.error('Error loading product images:', error);
        }
    }


  renderCart() {
    if (!this.cartData || this.cartData.lines.length === 0) {
      this.showEmptyCart();
      return;
    }

    // Show cart with items
    document.getElementById('emptyCart').style.display = 'none';
    document.getElementById('cartWithItems').style.display = 'block';

    // Render cart items
    const cartItemsContainer = document.getElementById('cartItems');
    cartItemsContainer.innerHTML = '';

    this.cartData.lines.forEach(item => {
      const itemElement = this.createCartItemElement(item);
      cartItemsContainer.appendChild(itemElement);
    });

    // Update totals
    this.updateTotals();
  }

    createCartItemElement(item) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'row between';
        itemDiv.style.cssText = 'padding:12px;border-bottom:1px solid var(--w1);align-items:center';

        const imageUrl = this.getProductImageUrl(item);

        itemDiv.innerHTML = `
            <div class="row" style="gap:12px;align-items:center;flex:1">
                <div style="width:80px;height:80px;background:var(--w2);border-radius:8px;overflow:hidden;flex-shrink:0">
                    <img src="${imageUrl}"
                         alt="${this.escapeHtml(item.product_name)}"
                         style="width:100%;height:100%;object-fit:contain;padding:4px;"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPlByb2R1Y3Q8L3RleHQ+Cjwvc3ZnPgo='">
                </div>
                <div style="flex:1">
                    <div style="font-weight:500;margin-bottom:4px">${this.escapeHtml(item.product_name)}</div>
                    <div class="muted" style="font-size:14px;margin-bottom:4px">Product ID: ${item.product_id}</div>
                    ${item.price ? `<div style="font-size:14px;color:var(--red);font-weight:500">IQD ${this.formatPrice(item.price)} each</div>` : ''}
                </div>
            </div>
            <div class="row" style="gap:16px;align-items:center">
                <div style="font-weight:600;min-width:100px;text-align:right">IQD ${this.formatPrice(item.price * item.quantity)}</div>
                <select class="select quantity-select" data-line-id="${item.line_id}" style="width:80px">
                    ${this.generateQuantityOptions(item.quantity)}
                </select>
                <button class="btn ghost remove-btn" data-line-id="${item.line_id}" style="color:var(--red)">Remove</button>
            </div>
        `;

        return itemDiv;
    }

    getProductImageUrl(item) {
        // Try to get from our image cache first
        if (this.productImages.has(item.product_id)) {
            const imageUrl = this.productImages.get(item.product_id);
            return imageUrl.startsWith('http') ? imageUrl : `http://alsajigroup.odoo.com/${imageUrl}`;
        }

        // Fallback to placeholder
        return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPlByb2R1Y3Q8L3RleHQ+Cjwvc3ZnPgo=`;
    }

  generateQuantityOptions(currentQuantity) {
    let options = '';
    const maxQuantity = 20; // Increased max quantity
    for (let i = 1; i <= maxQuantity; i++) {
      const selected = i === currentQuantity ? 'selected' : '';
      options += `<option value="${i}" ${selected}>${i}</option>`;
    }
    return options;
  }

  updateTotals() {
    if (!this.cartData) return;

    const subtotal = this.cartData.total_amount || this.calculateSubtotal();
    const itemCount = this.cartData.cart_count || this.cartData.lines.length;
    const shipping = 5000; // Fixed shipping cost
    const total = subtotal + shipping;

    // Update subtotal display
    document.getElementById('subtotalText').textContent = `Subtotal (${itemCount} item${itemCount !== 1 ? 's' : ''})`;
    document.getElementById('subtotalAmount').textContent = `IQD ${this.formatPrice(subtotal)}`;

    // Update order summary
    document.getElementById('orderID').textContent =  `Order No. ${this.cartData.order_id}`;
    document.getElementById('summarySubtotal').textContent = `IQD ${this.formatPrice(subtotal)}`;
    document.getElementById('totalAmount').textContent = `IQD ${this.formatPrice(total)}`;

    // Update cart count in header
    this.updateCartCount();
  }

  calculateSubtotal() {
    if (!this.cartData || !this.cartData.lines) return 0;
    return this.cartData.lines.reduce((total, item) => total + (item.total || 0), 0);
  }

  updateCartCount() {
    const count = this.cartData ? (this.cartData.cart_count || this.cartData.lines.length) : 0;
    document.getElementById('cartCount').textContent = count;
  }

  showEmptyCart() {
    document.getElementById('emptyCart').style.display = 'block';
    document.getElementById('cartWithItems').style.display = 'none';
    document.getElementById('cartCount').textContent = '0';
  }

  setupEventListeners() {
    // Quantity change
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('quantity-select')) {
        const lineId = e.target.dataset.lineId;
        const newQuantity = parseInt(e.target.value);
        this.updateQuantity(lineId, newQuantity);
      }
    });

    // Remove item
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-btn')) {
        const lineId = e.target.dataset.lineId;
        this.removeItem(lineId);
      }
    });

    // Checkout button
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        this.proceedToCheckout();
      });
    }

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce(() => {
        this.handleSearch(searchInput.value);
      }, 500));
    }
  }

  async updateQuantity(lineId, quantity) {
    try {
      const result = await this.api.updateCart(lineId, quantity);
      if (result.success) {
        await this.loadCart(); // Reload cart to get updated data
        this.showNotification('Quantity updated successfully', 'success');
      } else {
        this.showNotification('Failed to update quantity: ' + result.error, 'error');
        await this.loadCart(); // Reload to reset UI
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      this.showNotification('Error updating quantity. Please try again.', 'error');
      await this.loadCart(); // Reload to reset UI
    }
  }

  async removeItem(lineId) {
    if (!confirm('Are you sure you want to remove this item from your cart?')) {
      return;
    }

    try {
      const result = await this.api.removeFromCart(lineId);
      if (result.success) {
        await this.loadCart(); // Reload cart to get updated data
        this.showNotification('Item removed from cart', 'success');
      } else {
        this.showNotification('Failed to remove item: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error removing item:', error);
      this.showNotification('Error removing item. Please try again.', 'error');
    }
  }

  async clearCart() {
    if (!confirm('Are you sure you want to clear your entire cart?')) {
      return;
    }

    try {
      const result = await this.api.clearCart();
      if (result.success) {
        await this.loadCart(); // Reload cart to get updated data
        this.showNotification('Cart cleared successfully', 'success');
      } else {
        this.showNotification('Failed to clear cart: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
      this.showNotification('Error clearing cart. Please try again.', 'error');
    }
  }

  proceedToCheckout() {
    if (!this.cartData || this.cartData.lines.length === 0) {
      this.showNotification('Your cart is empty!', 'error');
      return;
    }
    window.location.href = 'checkout.html';
  }

  handleSearch(query) {
    if (query.trim()) {
      // Redirect to shop page with search query
      window.location.href = `shop.html?search=${encodeURIComponent(query)}`;
    }
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.cart-notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 10000;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

formatPrice(price) {
  return new Intl.NumberFormat().format(Number(price));
}


  escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Add notification styles if not already present
if (!document.querySelector('#cart-notification-styles')) {
  const style = document.createElement('style');
  style.id = 'cart-notification-styles';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Initialize cart manager when page loads
document.addEventListener('DOMContentLoaded', () => {
  new CartManager();
});


// cart-manager.js - Fixed version
class CartManager {
    constructor() {
        this.cartElements = new Map();
        this.init();
    }

    init() {
        // Wait a bit for alsajiAPI to be available
        setTimeout(() => {
            this.updateCartCount();
            this.setupEventListeners();
        }, 100);
    }

    setupEventListeners() {
        // Listen for cart updates
        document.addEventListener('cartUpdated', () => {
            this.updateCartCount();
        });

        // Listen for storage changes (across tabs)
        window.addEventListener('storage', (e) => {
            if (e.key === 'alsaji_cart') {
                this.updateCartCount();
            }
        });
    }

    async updateCartCount() {
        const countElements = document.querySelectorAll('.cart-count, .cart-item-count');

        // Check if API is available
        if (typeof window.alsajiAPI === 'undefined') {
            console.warn('alsajiAPI not available yet for cart count');
            this.setFallbackCartCount(countElements);
            return;
        }

        try {
            const cartResult = await window.alsajiAPI.getCart();
            const count = cartResult.cart.item_count;

            countElements.forEach(element => {
                element.textContent = count;
                element.style.display = count > 0 ? 'inline' : 'none';
            });

            // Update badge elements
            const badgeElements = document.querySelectorAll('.cart-badge');
            badgeElements.forEach(badge => {
                badge.textContent = count;
                badge.classList.toggle('hidden', count === 0);
            });

        } catch (error) {
            console.error('Failed to update cart count:', error);
            this.setFallbackCartCount(countElements);
        }
    }

    setFallbackCartCount(countElements) {
        // Try to get cart count from localStorage directly
        try {
            const cartJson = localStorage.getItem('alsaji_cart');
            if (cartJson) {
                const cart = JSON.parse(cartJson);
                const count = cart.item_count || 0;

                countElements.forEach(element => {
                    element.textContent = count;
                    element.style.display = count > 0 ? 'inline' : 'none';
                });
            } else {
                countElements.forEach(element => {
                    element.textContent = '0';
                    element.style.display = 'none';
                });
            }
        } catch (error) {
            countElements.forEach(element => {
                element.textContent = '0';
                element.style.display = 'none';
            });
        }
    }

    registerCartElement(selector, updateCallback) {
        const element = document.querySelector(selector);
        if (element) {
            this.cartElements.set(selector, { element, updateCallback });
        }
    }

    async refreshAllCartElements() {
        if (typeof window.alsajiAPI === 'undefined') {
            console.warn('alsajiAPI not available for cart refresh');
            return;
        }

        try {
            const cartResult = await window.alsajiAPI.getCart(true);

            for (const [selector, { element, updateCallback }] of this.cartElements) {
                if (typeof updateCallback === 'function') {
                    updateCallback(cartResult.cart, element);
                }
            }

            // Dispatch custom event
            document.dispatchEvent(new CustomEvent('cartUpdated', {
                detail: { cart: cartResult.cart }
            }));

        } catch (error) {
            console.error('Failed to refresh cart elements:', error);
        }
    }

    // Add to cart with UI feedback
    async addToCartWithFeedback(productId, quantity = 1, buttonElement = null) {
        if (typeof window.alsajiAPI === 'undefined') {
            this.showErrorFeedback(buttonElement);
            this.showToast('System not ready. Please refresh page.', 'error');
            return { success: false, error: 'API not available' };
        }

        if (buttonElement) {
            this.showLoadingState(buttonElement);
        }

        try {
            const result = await window.alsajiAPI.addToCart(productId, quantity);

            if (result.success) {
                this.showSuccessFeedback(buttonElement);
                await this.refreshAllCartElements();

                // Show toast notification
                this.showToast('Product added to cart!', 'success');

            } else {
                throw new Error(result.error);
            }

            return result;

        } catch (error) {
            this.showErrorFeedback(buttonElement);
            this.showToast(error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    showLoadingState(button) {
        if (!button) return;

        const originalText = button.innerHTML;
        button.innerHTML = '<span class="loading-spinner">⟳</span> Adding...';
        button.disabled = true;
        button.setAttribute('data-original-text', originalText);
    }

    showSuccessFeedback(button) {
        if (!button) return;

        const originalText = button.getAttribute('data-original-text');
        button.innerHTML = '<span class="checkmark">✓</span> Added!';
        button.classList.add('success');

        setTimeout(() => {
            if (originalText) {
                button.innerHTML = originalText;
            }
            button.disabled = false;
            button.classList.remove('success');
        }, 2000);
    }

    showErrorFeedback(button) {
        if (!button) return;

        const originalText = button.getAttribute('data-original-text');
        button.innerHTML = '<span class="error">✗</span> Failed';
        button.classList.add('error');

        setTimeout(() => {
            if (originalText) {
                button.innerHTML = originalText;
            }
            button.disabled = false;
            button.classList.remove('error');
        }, 2000);
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-message">${message}</span>
                <button class="toast-close">&times;</button>
            </div>
        `;

        // Add styles if not already added
        if (!document.querySelector('#toast-styles')) {
            const styles = document.createElement('style');
            styles.id = 'toast-styles';
            styles.textContent = `
                .toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    border-left: 4px solid #007bff;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    border-radius: 4px;
                    z-index: 10000;
                    max-width: 350px;
                    animation: slideIn 0.3s ease;
                }
                .toast-success { border-left-color: #28a745; }
                .toast-error { border-left-color: #dc3545; }
                .toast-warning { border-left-color: #ffc107; }
                .toast-content {
                    padding: 12px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: between;
                }
                .toast-message {
                    flex: 1;
                    margin-right: 10px;
                }
                .toast-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    opacity: 0.7;
                }
                .toast-close:hover { opacity: 1; }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    }
}

// Create global cart manager instance
window.cartManager = new CartManager();
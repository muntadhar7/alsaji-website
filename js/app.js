// app.js - Optimized for instant loading
class AlSajiApp {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Al Saji App...');

        // 🔥 NEW: Show UI immediately
        this.showUIInstantly();

        // 🔥 NEW: Load everything in background
        this.loadInBackground();

        console.log('✅ App initialized successfully');
    }

    // 🔥 NEW: Show UI immediately without waiting for data
    showUIInstantly() {
        // Make sure body is visible (in case layout.js hasn't finished)
        document.body.style.visibility = 'visible';

        // Initialize basic UI that doesn't require API calls
        this.initBasicEventListeners();
    }

    // 🔥 NEW: Load everything in background without blocking
    async loadInBackground() {
        try {
            await Promise.allSettled([
                this.checkAuthStatus(),
            ]);
        } catch (error) {
            console.log('Background loading completed with some errors:', error);
        } finally {
            this.isInitialized = true;
        }
    }

    async checkAuthStatus() {
        try {
            const username = alsajiAPI.getUsername();
            if (username) {
                this.currentUser = username;
                this.updateAuthUI();

                // 🔥 NEW: Lazy authentication - don't block on it
                setTimeout(() => {
                    alsajiAPI.lazyAuthenticate?.().then(authenticated => {
                        if (authenticated) {
                            console.log('✅ Background authentication successful');
                        }
                    });
                }, 1000);
            }
        } catch (error) {
            console.log('Auth check failed (non-critical):', error);
        }
    }

    updateAuthUI() {
        const loginElements = document.querySelectorAll('.login-btn, .auth-required');
        const logoutElements = document.querySelectorAll('.logout-btn, .user-menu');
        const usernameElements = document.querySelectorAll('.username-display');

        if (this.currentUser) {
            // User is logged in
            loginElements.forEach(el => el.style.display = 'none');
            logoutElements.forEach(el => el.style.display = 'block');
            usernameElements.forEach(el => el.textContent = this.currentUser);
        } else {
            // User is logged out
            loginElements.forEach(el => el.style.display = 'block');
            logoutElements.forEach(el => el.style.display = 'none');
            usernameElements.forEach(el => el.textContent = '');
        }
    }



    // NEW: Wait for cartManager to be available
    waitForCartManager() {
        return new Promise((resolve) => {
            const checkCartManager = () => {
                if (typeof window.cartManager !== 'undefined') {
                    console.log('✅ cartManager is available');
                    resolve();
                } else {
                    console.log('⏳ Waiting for cartManager...');
                    setTimeout(checkCartManager, 100);
                }
            };
            checkCartManager();
        });
    }



    // NEW: Reset button to original state
    resetButtonState(button) {
        const originalText = button.getAttribute('data-original-text');
        if (originalText) {
            button.innerHTML = originalText;
        }
        button.disabled = false;
    }



    // Update the showAddToCartFeedback method:
    showAddToCartFeedback(button) {
        const originalText = button.innerHTML;
        button.innerHTML = 'Adding...';
        button.disabled = true;
        button.setAttribute('data-original-text', originalText);
    }



    async renderCartPage() {
        const cartContainer = document.querySelector('.cart-items-container');
        const cartTotal = document.querySelector('.cart-total');
        const emptyCart = document.querySelector('.empty-cart-message');

        if (!cartContainer) return;

        try {
            const cartResult = await alsajiAPI.getCart(true);
            const cart = cartResult.cart;

            if (cart.items.length === 0) {
                cartContainer.innerHTML = '';
                if (emptyCart) emptyCart.style.display = 'block';
                if (cartTotal) cartTotal.textContent = '0.00';
                return;
            }

            if (emptyCart) emptyCart.style.display = 'none';

            // Render cart items
            cartContainer.innerHTML = cart.items.map(item => `
                <div class="cart-item" data-line-id="${item.id}">
                    <div class="item-image">
                        ${item.image ? `<img src="${item.image}" alt="${item.name}" loading="lazy">` : '<div class="no-image">No Image</div>'}
                    </div>
                    <div class="item-details">
                        <h4 class="item-name">${this.escapeHtml(item.name)}</h4>
                        <p class="item-price">$${item.unit_price.toFixed(2)}</p>
                    </div>
                    <div class="item-quantity">
                        <button class="update-quantity-btn" data-line-id="${item.id}" data-change="-1">-</button>
                        <input type="number" class="quantity-input" value="${item.quantity}" min="1" readonly>
                        <button class="update-quantity-btn" data-line-id="${item.id}" data-change="1">+</button>
                    </div>
                    <div class="item-subtotal">
                        $${item.subtotal.toFixed(2)}
                    </div>
                    <div class="item-actions">
                        <button class="remove-item-btn" data-line-id="${item.id}" title="Remove item">
                            &times;
                        </button>
                    </div>
                </div>
            `).join('');

            if (cartTotal) {
                cartTotal.textContent = cart.total.toFixed(2);
            }
        } catch (error) {
            console.log('Cart page render failed:', error);
        }
    }








    // 🔥 NEW: Basic event listeners that work immediately
    initBasicEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin(loginForm);
            });
        }

        // Logout button
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('logout-btn')) {
                e.preventDefault();
                await this.handleLogout();
            }
        });




    }

    async handleLogin(form) {
        const formData = new FormData(form);
        const username = formData.get('username');
        const password = formData.get('password');
        const submitBtn = form.querySelector('button[type="submit"]');

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;

        try {
            const result = await alsajiAPI.login(username, password);

            if (result.success) {
                this.currentUser = username;
                this.updateAuthUI();
                cartManager.showToast('Login successful!', 'success');

                // Redirect or close modal
                const redirect = form.dataset.redirect;
                if (redirect) {
                    window.location.href = redirect;
                } else {
                    // Close login modal if exists
                    const modal = form.closest('.modal');
                    if (modal) {
                        modal.style.display = 'none';
                    }
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            cartManager.showToast(error.message, 'error');
            form.reset();
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleLogout() {
        const result = await alsajiAPI.logout();
        if (result.success) {
            this.currentUser = null;
            this.updateAuthUI();
            cartManager.showToast('Logged out successfully', 'success');

            // Redirect to home page if on protected page
            if (document.querySelector('.auth-required-page')) {
                window.location.href = '/';
            }
        }
    }




    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.alsajiApp = new AlSajiApp();
});
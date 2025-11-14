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
        this.initSearch(); // Search can work locally
    }

    // 🔥 NEW: Load everything in background without blocking
    async loadInBackground() {
        try {
            await Promise.allSettled([
                this.checkAuthStatus(),
                this.initCart(),
                this.initProductGrids()
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

    // In your initCart method, replace with:
    async initCart() {
        try {
            // Wait for cartManager to be available
            await this.waitForCartManager();

            // Use global cart system
            if (window.AlSajiCartEvents) {
                await window.AlSajiCartEvents.refreshCartCount();
            }

            console.log('🛒 Cart initialized');
        } catch (error) {
            console.log('Cart init failed (non-critical):', error);
        }

        // Add to cart buttons
        document.addEventListener('click', async (e) => {
            const addToCartBtn = e.target.closest('.add-to-cart-btn');
            if (addToCartBtn) {
                e.preventDefault();

                const productId = addToCartBtn.dataset.productId;
                const quantity = addToCartBtn.dataset.quantity || 1;

                // Show immediate feedback
                this.showAddToCartFeedback(addToCartBtn);

                // Process in background
                setTimeout(async () => {
                    await this.handleAddToCart(productId, quantity, addToCartBtn);
                }, 10);
            }
        });

        // Cart page specific logic
        if (document.querySelector('.cart-page')) {
            this.initCartPage();
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

    // NEW: Handle add to cart using cartManager
    async handleAddToCart(productId, quantity, buttonElement = null) {
        try {
            // Use cartManager if available, otherwise fallback to direct API
            if (window.cartManager && typeof window.cartManager.addToCartWithFeedback === 'function') {
                await window.cartManager.addToCartWithFeedback(productId, quantity, buttonElement);
            } else {
                // Fallback: use API directly
                await this.addToCartDirect(productId, quantity, buttonElement);
            }
        } catch (error) {
            this.showToast('Failed to add to cart', 'error');
        }
    }

    // NEW: Fallback method using direct API
    async addToCartDirect(productId, quantity, buttonElement = null) {
        try {
            const result = await alsajiAPI.addToCart(productId, quantity);

            if (result.success) {
                this.showToast('Product added to cart!', 'success');

                // Update cart count globally
                if (window.AlSajiCartEvents) {
                    window.AlSajiCartEvents.updateCartCount(result.cart_count);
                }

                // Reset button state
                if (buttonElement) {
                    this.resetButtonState(buttonElement);
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.showToast(error.message || 'Failed to add to cart', 'error');
            if (buttonElement) {
                this.resetButtonState(buttonElement);
            }
        }
    }

    // NEW: Reset button to original state
    resetButtonState(button) {
        const originalText = button.getAttribute('data-original-text');
        if (originalText) {
            button.innerHTML = originalText;
        }
        button.disabled = false;
    }

    // NEW: Simple toast notification (compatible with cartManager's toast)
    showToast(message, type = 'info') {
        // Use cartManager's toast if available
        if (window.cartManager && typeof window.cartManager.showToast === 'function') {
            window.cartManager.showToast(message, type);
            return;
        }

        // Fallback toast implementation
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }

    // Update the showAddToCartFeedback method:
    showAddToCartFeedback(button) {
        const originalText = button.innerHTML;
        button.innerHTML = 'Adding...';
        button.disabled = true;
        button.setAttribute('data-original-text', originalText);
    }


    initCartPage() {
        // Cart page can load in background
        setTimeout(() => {
            this.renderCartPage();
        }, 100);

        const updateCartItem = async (lineId, quantity) => {
            const result = await alsajiAPI.updateCart(lineId, quantity);
            if (result.success) {
                await this.renderCartPage();
            } else {
                cartManager.showToast('Failed to update cart', 'error');
            }
        };

        const removeCartItem = async (lineId) => {
            const result = await alsajiAPI.removeFromCart(lineId);
            if (result.success) {
                await this.renderCartPage();
                cartManager.showToast('Item removed from cart', 'success');
            } else {
                cartManager.showToast('Failed to remove item', 'error');
            }
        };

        // Event delegation for cart actions
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('update-quantity-btn')) {
                const lineId = parseInt(e.target.dataset.lineId);
                const change = parseInt(e.target.dataset.change);

                const currentItem = document.querySelector(`.cart-item[data-line-id="${lineId}"]`);
                const quantityInput = currentItem?.querySelector('.quantity-input');

                if (quantityInput) {
                    let newQuantity = parseInt(quantityInput.value) + change;
                    if (newQuantity < 1) newQuantity = 1;

                    quantityInput.value = newQuantity;
                    await updateCartItem(lineId, newQuantity);
                }
            }

            if (e.target.classList.contains('remove-item-btn')) {
                const lineId = parseInt(e.target.dataset.lineId);
                if (confirm('Are you sure you want to remove this item from your cart?')) {
                    await removeCartItem(lineId);
                }
            }
        });
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

    initSearch() {
        const searchInput = document.getElementById('search-input');
        const searchSuggestions = document.getElementById('search-suggestions');

        if (!searchInput) return;

        let searchTimeout;

        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();

            if (query.length < 2) {
                this.hideSearchSuggestions();
                return;
            }

            searchTimeout = setTimeout(async () => {
                try {
                    const result = await alsajiAPI.getSearchSuggestions(query);
                    if (result.success) {
                        this.showSearchSuggestions(result.suggestions, searchInput);
                    }
                } catch (error) {
                    console.log('Search suggestions failed:', error);
                }
            }, 300);
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchSuggestions?.contains(e.target)) {
                this.hideSearchSuggestions();
            }
        });

        // Search form submission
        const searchForm = document.querySelector('.search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query) {
                    window.location.href = `/search.html?q=${encodeURIComponent(query)}`;
                }
            });
        }
    }

    showSearchSuggestions(suggestions, inputElement) {
        let suggestionsContainer = document.getElementById('search-suggestions');

        if (!suggestionsContainer) {
            suggestionsContainer = document.createElement('div');
            suggestionsContainer.id = 'search-suggestions';
            suggestionsContainer.className = 'search-suggestions';
            document.body.appendChild(suggestionsContainer);
        }

        if (suggestions.length === 0) {
            suggestionsContainer.innerHTML = '<div class="suggestion-item no-results">No suggestions found</div>';
        } else {
            suggestionsContainer.innerHTML = suggestions.map(suggestion => `
                <div class="suggestion-item" data-suggestion="${suggestion}">
                    ${this.escapeHtml(suggestion)}
                </div>
            `).join('');
        }

        // Position below input
        const rect = inputElement.getBoundingClientRect();
        suggestionsContainer.style.position = 'absolute';
        suggestionsContainer.style.top = `${rect.bottom + window.scrollY}px`;
        suggestionsContainer.style.left = `${rect.left + window.scrollX}px`;
        suggestionsContainer.style.width = `${rect.width}px`;
        suggestionsContainer.style.display = 'block';

        // Add click handlers
        suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                inputElement.value = item.dataset.suggestion;
                suggestionsContainer.style.display = 'none';
                inputElement.focus();
            });
        });
    }

    hideSearchSuggestions() {
        const suggestionsContainer = document.getElementById('search-suggestions');
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    }

    initProductGrids() {
        // 🔥 NEW: Load product grids with slight delay to prioritize page display
        setTimeout(() => {
            const productGrids = document.querySelectorAll('.products-grid, .featured-products');
            productGrids.forEach(grid => {
                this.loadProductsForGrid(grid);
            });
        }, 500);
    }

    async loadProductsForGrid(gridElement) {
        const limit = gridElement.dataset.limit || 12;
        const category = gridElement.dataset.category;
        const featured = gridElement.dataset.featured === 'true';

        let filters = { limit: parseInt(limit) };
        if (category) filters.category = category;
        if (featured) filters.featured = true;

        try {
            gridElement.classList.add('loading');

            const result = await alsajiAPI.getProducts(filters);

            if (result.success && result.products.length > 0) {
                this.renderProductGrid(gridElement, result.products);
            } else {
                gridElement.innerHTML = '<div class="no-products">No products found</div>';
            }

        } catch (error) {
            console.error('Failed to load products:', error);
            gridElement.innerHTML = '<div class="error-message">Failed to load products</div>';
        } finally {
            gridElement.classList.remove('loading');
        }
    }

    renderProductGrid(container, products) {
        container.innerHTML = products.map(product => `
            <div class="product-card" data-product-id="${product.id}">
                <div class="product-image">
                    ${product.image_url ?
                        `<img src="${product.image_url}" alt="${product.name}" loading="lazy">` :
                        '<div class="no-image">No Image</div>'
                    }
                </div>
                <div class="product-info">
                    <h3 class="product-name">${this.escapeHtml(product.name)}</h3>
                    <p class="product-description">${this.escapeHtml(product.description?.substring(0, 100) || '')}...</p>
                    <div class="product-price">$${product.price.toFixed(2)}</div>
                    <div class="product-meta">
                        ${product.category ? `<span class="product-category">${this.escapeHtml(product.category.name)}</span>` : ''}
                        ${product.brand ? `<span class="product-brand">${this.escapeHtml(product.brand.name)}</span>` : ''}
                    </div>
                    <button class="add-to-cart-btn" data-product-id="${product.id}">
                        Add to Cart
                    </button>
                </div>
            </div>
        `).join('');
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

        // Product filter forms
        const filterForms = document.querySelectorAll('.filter-form');
        filterForms.forEach(form => {
            form.addEventListener('change', () => {
                this.handleFilterChange(form);
            });
        });

        // Clear filters
        const clearFiltersBtn = document.querySelector('.clear-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearFilters();
            });
        }
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

    handleFilterChange(form) {
        const formData = new FormData(form);
        const filters = {};

        for (const [key, value] of formData.entries()) {
            if (value) filters[key] = value;
        }

        // Update URL without reloading page
        const url = new URL(window.location);
        url.search = new URLSearchParams(filters).toString();
        window.history.replaceState({}, '', url);

        // Reload products with new filters
        this.reloadProductsWithFilters(filters);
    }

    async reloadProductsWithFilters(filters) {
        const productsGrid = document.querySelector('.products-grid');
        if (!productsGrid) return;

        productsGrid.classList.add('loading');

        try {
            const result = await alsajiAPI.getProducts(filters);
            if (result.success) {
                this.renderProductGrid(productsGrid, result.products);

                // Update results count
                const resultsCount = document.querySelector('.results-count');
                if (resultsCount) {
                    resultsCount.textContent = `Showing ${result.count} of ${result.total_count} products`;
                }
            }
        } catch (error) {
            console.error('Filter error:', error);
        } finally {
            productsGrid.classList.remove('loading');
        }
    }

    clearFilters() {
        // Clear all filter inputs
        const filterInputs = document.querySelectorAll('.filter-form input, .filter-form select');
        filterInputs.forEach(input => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });

        // Clear URL parameters
        window.history.replaceState({}, '', window.location.pathname);

        // Reload products without filters
        this.reloadProductsWithFilters({});
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
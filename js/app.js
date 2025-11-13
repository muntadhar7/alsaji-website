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
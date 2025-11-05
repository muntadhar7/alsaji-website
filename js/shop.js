// Utility functions
function formatPrice(price) {
    return 'IQD ' + price.toLocaleString();
}

function debounce(func, wait) {
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

// URL parameter handling
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const filters = {};

    if (params.has('brand')) filters.brand = params.get('brand');
    if (params.has('category')) filters.category = params.get('category');
    if (params.has('search')) filters.search = params.get('search');
    if (params.has('in_stock')) filters.in_stock = params.get('in_stock') === 'true';

    return filters;
}

function updateUrlParams(filters) {
    const params = new URLSearchParams();

    if (filters.brand) params.set('brand', filters.brand);
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    if (filters.in_stock) params.set('in_stock', 'true');

    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', newUrl);
}

async function addToCart(productId) {
    try {
        const result = await alsajiAPI.addToCart(productId);
        if (result.success) {
            updateCartCount(result.cart_count);
            showNotification(result.message, 'success');
        } else {
            showNotification('Failed to add product to cart', 'error');
        }
    } catch (error) {
        showNotification('Error adding to cart', 'error');
    }
}

function updateCartCount(count) {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.textContent = count;
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
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

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add CSS for animations if not already in main.js
if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
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

// Shop page functionality
document.addEventListener('DOMContentLoaded', async function() {
    await loadShopData();
    setupShopEvents();
    applyUrlFilters(); // Apply URL filters after data is loaded
});

async function loadShopData() {
    try {
        const [products, categories, brands] = await Promise.all([
            alsajiAPI.getProducts(),
            alsajiAPI.getCategories(),
            alsajiAPI.getBrands()
        ]);

        renderProducts(products);
        populateFilters(categories, brands);

    } catch (error) {
        console.error('Failed to load shop data:', error);
        showNotification('Failed to load products', 'error');
    }
}

function renderProducts(products) {
    const container = document.getElementById('productGrid');
    const resultsCount = document.getElementById('resultsCount');

    if (container) {
        container.innerHTML = products.map(product => `
            <div class="card">
                <img class="image" src='http://localhost:8888${product.image_url}' alt='${product.name}' onerror="this.style.display='none'">
                <div class="muted">${product.brand} • ${product.oe_reference}</div>
                <div>${product.name}</div>
                <div class="row between">
                    <div style="color:var(--red)">${formatPrice(product.price)}</div>
                    <button class="btn add-to-cart-btn" data-product-id="${product.id}" style="padding:6px 10px;font-size:12px">
                        Add
                    </button>
                </div>
                <div class="muted">${product.in_stock ? 'In stock' : 'Out of stock'}</div>
            </div>
        `).join('');
    }

    if (resultsCount) {
        resultsCount.textContent = `${products.length} results`;
    }
}

function populateFilters(categories, brands) {
    const categorySelect = document.getElementById('filterCategory');
    const brandSelect = document.getElementById('filterBrand');

    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">All Categories</option>' +
            categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
    }

    if (brandSelect) {
        brandSelect.innerHTML = '<option value="">All Brands</option>' +
            brands.map(brand => `<option value="${brand.name}">${brand.name}</option>`).join('');
    }
}

function applyUrlFilters() {
    const urlFilters = getUrlParams();

    // Apply URL filters to form elements
    if (urlFilters.brand) {
        const brandSelect = document.getElementById('filterBrand');
        if (brandSelect) {
            brandSelect.value = urlFilters.brand;
        }
    }

    if (urlFilters.category) {
        const categorySelect = document.getElementById('filterCategory');
        if (categorySelect) {
            categorySelect.value = urlFilters.category;
        }
    }

    if (urlFilters.search) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = urlFilters.search;
        }
    }

    if (urlFilters.in_stock) {
        const stockSelect = document.getElementById('filterStock');
        if (stockSelect) {
            stockSelect.value = 'in_stock';
        }
    }

    // Apply the filters if any URL parameters exist
    if (Object.keys(urlFilters).length > 0) {
        applyFilters();
    }
}

function setupShopEvents() {
    // Filter changes
    const filters = ['filterBrand', 'filterCategory', 'filterPrice', 'filterStock', 'sortSelect'];
    filters.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) {
            element.addEventListener('change', debounce(function() {
                applyFilters();
                updateUrlFromForm(); // Update URL when filters change
            }, 300));
        }
    });

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            applyFilters();
            updateUrlFromForm(); // Update URL when search changes
        }, 500));
    }

    // Add to cart buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.add-to-cart-btn')) {
            const productId = e.target.closest('.add-to-cart-btn').dataset.productId;
            addToCart(productId);
        }
    });
}

function getCurrentFilters() {
    return {
        brand: document.getElementById('filterBrand')?.value || '',
        category: document.getElementById('filterCategory')?.value || '',
        search: document.getElementById('searchInput')?.value || '',
        in_stock: document.getElementById('filterStock')?.value === 'in_stock'
    };
}

function updateUrlFromForm() {
    const filters = getCurrentFilters();
    updateUrlParams(filters);
}

async function applyFilters() {
    const filters = getCurrentFilters();

    try {
        const products = await alsajiAPI.getProducts(filters);
        renderProducts(products);

        // Update page title to reflect current filters
        updatePageTitle(filters);

    } catch (error) {
        console.error('Failed to apply filters:', error);
    }
}

function updatePageTitle(filters) {
    let titleParts = [];

    if (filters.brand) titleParts.push(filters.brand);
    if (filters.category) titleParts.push(filters.category);
    if (filters.search) titleParts.push(`"${filters.search}"`);

    if (titleParts.length > 0) {
        document.title = titleParts.join(' • ') + ' - AlSaji Shop';
    } else {
        document.title = 'Shop - AlSaji Auto Parts';
    }
}

// Add this function to create shareable links
function createShareableLink() {
    const filters = getCurrentFilters();
    const params = new URLSearchParams();

    if (filters.brand) params.set('brand', filters.brand);
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    if (filters.in_stock) params.set('in_stock', 'true');

    return window.location.origin + window.location.pathname + '?' + params.toString();
}

// Optional: Add a share button to your shop page
function addShareButton() {
    const shareButton = document.createElement('button');
    shareButton.className = 'btn secondary';
    shareButton.innerHTML = '🔗 Share This View';
    shareButton.style.marginLeft = 'auto';
    shareButton.addEventListener('click', function() {
        const shareUrl = createShareableLink();
        navigator.clipboard.writeText(shareUrl).then(() => {
            showNotification('Link copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            prompt('Copy this link:', shareUrl);
        });
    });

    // Add to the filter section
    const filterSection = document.querySelector('.row.between');
    if (filterSection) {
        filterSection.appendChild(shareButton);
    }
}

// Call this in your setup if you want the share button
// addShareButton();
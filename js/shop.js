// Shop state management
class ShopState {
    constructor() {
        this.products = null;
        this.categories = null;
        this.brands = null;
        this.filters = {
            brand: '',
            category: '',
            search: '',
            in_stock: false
        };
        this.isLoading = false;
        this.currentPage = 1;
        this.productsPerPage = 20; // Show 12 products per page
        this.hasMoreProducts = false;
        this.allProducts = []; // Store all loaded products
    }
}

const shopState = new ShopState();

// Utility functions
function formatPrice(price) {
    return 'IQD ' + (typeof price === 'number' ? price.toLocaleString() : '0');
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
    if (params.has('page')) shopState.currentPage = parseInt(params.get('page'));

    return filters;
}

function updateUrlParams(filters) {
    const params = new URLSearchParams();

    if (filters.brand) params.set('brand', filters.brand);
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    if (filters.in_stock) params.set('in_stock', 'true');
    if (shopState.currentPage > 1) params.set('page', shopState.currentPage);

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
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.shop-notification');
    existingNotifications.forEach(notification => notification.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'shop-notification';
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
    // Reset pagination when loading new data
    shopState.currentPage = 1;
    shopState.allProducts = [];

    try {
        showLoadingState();

        // Load categories and brands first
        const [categories, brands] = await Promise.all([
            alsajiAPI.getCategories(),
            alsajiAPI.getBrands()
        ]);

        shopState.categories = categories;
        shopState.brands = brands;
        populateFilters(categories, brands);

        // Then load products with current filters
        await loadProducts();

    } catch (error) {
        console.error('Failed to load shop data:', error);
        showNotification('Failed to load products', 'error');
        hideLoadingState();
    }
}

async function loadProducts() {
    if (shopState.isLoading) return;

    shopState.isLoading = true;
    showLoadingMoreState();

    try {
        // Load products with current filters and pagination
        const response = await alsajiAPI.getProducts({
            ...shopState.filters,
            limit: shopState.productsPerPage * shopState.currentPage
        });

        console.log('API Response:', response); // Debug log

        // FIX: Use response.products instead of response
        shopState.allProducts = response.products || []; // THIS IS THE FIX
        console.log('allProducts set to:', shopState.allProducts); // Debug log

        // Store all products for pagination
        shopState.products = getCurrentPageProducts();

        // Check if there are more products to load
        shopState.hasMoreProducts = shopState.allProducts.length >= shopState.productsPerPage * shopState.currentPage;

        renderProducts(shopState.products);
        updateLoadMoreButton();
        hideLoadingState();

    } catch (error) {
        console.error('Failed to load products:', error);
        showNotification('Error loading products', 'error');
        hideLoadingState();
    } finally {
        shopState.isLoading = false;
    }
}
function getCurrentPageProducts() {
    const startIndex = 0; // Always show all loaded products
    const endIndex = shopState.productsPerPage * shopState.currentPage;
    return shopState.allProducts.slice(0, endIndex);
}

async function loadMoreProducts() {
    if (shopState.isLoading || !shopState.hasMoreProducts) return;

    shopState.currentPage++;
    shopState.isLoading = true;

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const loadMoreInfo = document.getElementById('loadMoreInfo');

    if (loadMoreBtn) loadMoreBtn.disabled = true;
    if (loadMoreInfo) loadMoreInfo.textContent = 'Loading more products...';

    try {
        // Simulate loading delay for better UX
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get products for the new page
        shopState.products = getCurrentPageProducts();

        // Check if we've reached the end
        shopState.hasMoreProducts = shopState.allProducts.length > shopState.products.length;

        renderProducts(shopState.products);
        updateLoadMoreButton();
        updateUrlFromForm();

        // Scroll to show new products
        setTimeout(() => {
            const productGrid = document.getElementById('productGrid');
            if (productGrid) {
                const lastProduct = productGrid.lastElementChild;
                if (lastProduct) {
                    lastProduct.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }, 100);

    } catch (error) {
        console.error('Failed to load more products:', error);
        showNotification('Error loading more products', 'error');
        shopState.currentPage--; // Revert page on error
    } finally {
        shopState.isLoading = false;
        if (loadMoreBtn) loadMoreBtn.disabled = false;
    }
}

function updateLoadMoreButton() {
    const container = document.getElementById('loadMoreContainer');
    const button = document.getElementById('loadMoreBtn');
    const info = document.getElementById('loadMoreInfo');

    if (!container || !button || !info) return;

    if (shopState.hasMoreProducts && shopState.allProducts.length > 0) {
        container.style.display = 'block';
        button.textContent = `Load More (${shopState.products.length} of ${shopState.allProducts.length} shown)`;
        button.disabled = shopState.isLoading;

        const remaining = shopState.allProducts.length - shopState.products.length;
        info.textContent = `${remaining} more products available`;
    } else {
        container.style.display = 'none';
    }

    // Hide load more if we're showing all products
    if (shopState.products.length >= shopState.allProducts.length) {
        container.style.display = 'none';
    }
}

function showLoadingState() {
    const container = document.getElementById('productGrid');
    if (container) {
        container.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:40px">
                <div style="font-size:24px;margin-bottom:12px">⏳</div>
                <div class="muted">Loading products...</div>
            </div>
        `;
    }
    // Hide load more during initial load
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (loadMoreContainer) {
        loadMoreContainer.style.display = 'none';
    }
}

function showLoadingMoreState() {
    const loadMoreInfo = document.getElementById('loadMoreInfo');
    if (loadMoreInfo && shopState.currentPage > 1) {
        loadMoreInfo.textContent = 'Loading more products...';
    }
}

function hideLoadingState() {
    // Loading state is automatically removed when products are rendered
}

function renderProducts(products) {
    const container = document.getElementById('productGrid');
    const resultsCount = document.getElementById('resultsCount');

    if (!container) return;

    if (products.length === 0 && shopState.currentPage === 1) {
        container.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:40px">
                <div style="font-size:48px;margin-bottom:12px">🔍</div>
                <h3 style="margin-bottom:8px">No products found</h3>
                <p class="muted">Try adjusting your filters or search terms</p>
                <button class="btn" onclick="clearFilters()" style="margin-top:16px">
                    Clear All Filters
                </button>
            </div>
        `;
    } else {
        container.innerHTML = products.map(product => `
            <div class="card product-card" data-product-id="${product.id}">
                <img class="image" src='http://localhost:8888${product.image_url}' alt='${product.name}'
                     onerror="this.style.display='none'"
                     loading="lazy">
                <div class="muted">${product.brand} • ${product.oe_reference}</div>
                <div style="font-weight:500;margin:8px 0">${product.name}</div>
                <div class="row between" style="align-items:center">
                    <div style="color:var(--red);font-weight:600">${formatPrice(product.price)}</div>
                    <button class="btn add-to-cart-btn" data-product-id="${product.id}"
                            style="padding:6px 10px;font-size:12px"
                            ${!product.in_stock ? 'disabled' : ''}>
                        ${product.in_stock ? 'Add' : 'Out of Stock'}
                    </button>
                </div>
                <div class="muted" style="font-size:12px;margin-top:4px">
                    ${product.in_stock ? '✅ In stock' : '❌ Out of stock'}
                </div>
            </div>
        `).join('');
    }

    if (resultsCount) {
        const totalShown = products.length;
        const totalAvailable = shopState.allProducts.length;
        if (totalShown < totalAvailable) {
            resultsCount.textContent = `Showing ${totalShown} of ${totalAvailable} products`;
        } else {
            resultsCount.textContent = `${totalShown} ${totalShown === 1 ? 'product' : 'products'} found`;
        }
    }
}

function populateFilters(categories, brands) {
    const categorySelect = document.getElementById('filterCategory');
    const brandSelect = document.getElementById('filterBrand');

    if (categorySelect && categories) {
        categorySelect.innerHTML = '<option value="">All Categories</option>' +
            categories.map(cat => `<option value="${cat.name}">${cat.name} (${cat.product_count || 0})</option>`).join('');
    }

    if (brandSelect && brands) {
        brandSelect.innerHTML = '<option value="">All Brands</option>' +
            brands.map(brand => `<option value="${brand.name}">${brand.name}</option>`).join('');
    }
}

function applyUrlFilters() {
    const urlFilters = getUrlParams();

    // Update state
    shopState.filters = { ...shopState.filters, ...urlFilters };

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
    // Filter changes - use cached data when possible
    const filters = ['filterBrand', 'filterCategory', 'filterPrice', 'filterStock', 'sortSelect'];
    filters.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) {
            element.addEventListener('change', debounce(function() {
                // Reset pagination when filters change
                shopState.currentPage = 1;
                shopState.allProducts = [];
                shopState.filters = getCurrentFilters();
                applyFilters();
                updateUrlFromForm();
            }, 300));
        }
    });

    // Search input with caching
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            // Reset pagination when search changes
            shopState.currentPage = 1;
            shopState.allProducts = [];
            shopState.filters.search = searchInput.value;
            applyFilters();
            updateUrlFromForm();
        }, 500));
    }

    // Add to cart buttons with event delegation
    document.addEventListener('click', function(e) {
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        if (addToCartBtn && !addToCartBtn.disabled) {
            const productId = addToCartBtn.dataset.productId;
            addToCart(productId);
        }
    });

    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreProducts);
    }

    // Quick view functionality (optional)
    document.addEventListener('click', function(e) {
        const productCard = e.target.closest('.product-card');
        if (productCard && !e.target.closest('.add-to-cart-btn')) {
            // Optional: Add quick product view
            // showQuickView(productCard.dataset.productId);
        }
    });

    // Infinite scroll (optional)
    setupInfiniteScroll();
}

function setupInfiniteScroll() {
    let scrollTimeout;

    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (shouldLoadMoreOnScroll()) {
                loadMoreProducts();
            }
        }, 100);
    });
}

function shouldLoadMoreOnScroll() {
    if (shopState.isLoading || !shopState.hasMoreProducts) return false;

    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (!loadMoreContainer || loadMoreContainer.style.display === 'none') return false;

    const containerRect = loadMoreContainer.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    // Load more when the load more button is 500px from the viewport bottom
    return containerRect.top <= windowHeight + 500;
}

function getCurrentFilters() {
    return {
        brand: document.getElementById('filterBrand')?.value || '',
        category: document.getElementById('filterCategory')?.value || '',
        search: document.getElementById('searchInput')?.value || '',
        in_stock: document.getElementById('filterStock')?.value || '',
    };
}

function updateUrlFromForm() {
    updateUrlParams(shopState.filters);
}

async function applyFilters() {
    if (shopState.isLoading) return;

    shopState.isLoading = true;

    try {
        // Reset pagination when applying new filters
        shopState.currentPage = 1;
        shopState.allProducts = [];

        // Use cached API call
        const products = await alsajiAPI.getProducts(shopState.filters);
        shopState.allProducts = products.products || [];
        shopState.products = getCurrentPageProducts();
        shopState.hasMoreProducts = products.length > shopState.productsPerPage;

        renderProducts(shopState.products);
        updatePageTitle(shopState.filters);
        updateLoadMoreButton();

    } catch (error) {
        console.error('Failed to apply filters:', error);
        showNotification('Error applying filters', 'error');
    } finally {
        shopState.isLoading = false;
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

function clearFilters() {
    // Reset form elements
    const resetElements = ['filterBrand', 'filterCategory', 'filterStock', 'searchInput'];
    resetElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'text' || element.type === 'search') {
                element.value = '';
            } else {
                element.value = '';
            }
        }
    });

    // Reset state
    shopState.filters = {
        brand: '',
        category: '',
        search: '',
        in_stock: false
    };
    shopState.currentPage = 1;
    shopState.allProducts = [];

    // Apply changes
    applyFilters();
    updateUrlParams({});
    showNotification('Filters cleared', 'success');
}

// Add this function to create shareable links
function createShareableLink() {
    const params = new URLSearchParams();

    if (shopState.filters.brand) params.set('brand', shopState.filters.brand);
    if (shopState.filters.category) params.set('category', shopState.filters.category);
    if (shopState.filters.search) params.set('search', shopState.filters.search);
    if (shopState.filters.in_stock) params.set('in_stock', 'true');
    if (shopState.currentPage > 1) params.set('page', shopState.currentPage);

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

// Cache management for shop
function clearShopCache() {
    alsajiAPI.clearProductCache();
    shopState.products = null;
    shopState.categories = null;
    shopState.brands = null;
    shopState.allProducts = [];
    shopState.currentPage = 1;
    showNotification('Shop cache cleared', 'info');
}

// Auto-refresh products every 5 minutes (optional)
function startAutoRefresh() {
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            alsajiAPI.clearProductCache();
            loadShopData().then(() => {
                console.log('Shop data auto-refreshed');
            });
        }
    }, 5 * 60 * 1000); // 5 minutes
}

// Start auto-refresh when page becomes visible
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        // Page became visible, could refresh cache if needed
    }
});

// Debug functions
window.shopDebug = {
    state: () => shopState,
    clearCache: () => clearShopCache(),
    loadMore: () => loadMoreProducts(),
    testCache: async () => {
        console.log('=== CACHE TEST ===');
        console.time('First API call');
        const result1 = await alsajiAPI.getProducts();
        console.timeEnd('First API call');
        console.time('Second API call');
        const result2 = await alsajiAPI.getProducts();
        console.timeEnd('Second API call');
        console.log('Cache working:', result1 === result2);
    }
};

// Call this in your setup if you want the share button
// addShareButton();

// Uncomment to enable auto-refresh
// startAutoRefresh();

// Uncomment to enable infinite scroll
// setupInfiniteScroll();
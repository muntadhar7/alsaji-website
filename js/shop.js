// Shop state management
class ShopState {
    constructor() {
        this.products = [];
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
        this.productsPerPage = 12;
        this.hasMoreProducts = false;
        this.totalProducts = 0;
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

async function addToCart(productId, quantity = 1) {
    try {
        const result = await alsajiAPI.addToCart(productId, quantity);
        if (result.success) {
            updateCartCount(result.cart_count);
            showNotification(result.message, 'success');
        } else {
            showNotification('Failed to add product to cart', 'error');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        showNotification('Error adding to cart', 'error');
    }
}

function updateCartCount(count) {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.textContent = count;
    }
}
function updateCartCount(count) {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.textContent = count;
    }
}

function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.shop-notification');
    existingNotifications.forEach(notification => notification.remove());

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

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add CSS for animations
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

// Data loading functions for static data
async function loadStaticData() {
    try {
        // Load data from our generated JSON files
        const [productsData, categoriesData, brandsData] = await Promise.all([
            fetch('data/json/products.json').then(r => r.json()),
            fetch('data/json/categories.json').then(r => r.json()),
            fetch('data/json/brands.json').then(r => r.json())
        ]);

        return {
            products: productsData,
            categories: categoriesData,
            brands: brandsData
        };
    } catch (error) {
        console.error('Failed to load static data:', error);
        return { products: [], categories: [], brands: [] };
    }
}

// Shop page functionality
document.addEventListener('DOMContentLoaded', async function() {
    await loadShopData();
    setupShopEvents();
    applyUrlFilters();
});

async function loadShopData() {
    shopState.currentPage = 1;
    shopState.products = [];

    try {
        showLoadingState();

        const staticData = await loadStaticData();

        shopState.categories = staticData.categories;
        shopState.brands = staticData.brands;
        populateFilters(staticData.categories, staticData.brands);

        // Load all products initially (we'll filter client-side)
        shopState.allProducts = staticData.products;
        shopState.totalProducts = staticData.products.length;

        await loadProducts();

    } catch (error) {
        console.error('Failed to load shop data:', error);
        showNotification('Failed to load products', 'error');
        hideLoadingState();
    }
}

// Client-side filtering and pagination
function filterProducts(products, filters) {
    return products.filter(product => {
        // Brand filter
        if (filters.brand) {
            const productBrand = typeof product.brand === 'object' ? product.brand.name : product.brand;
            if (productBrand !== filters.brand) return false;
        }

        // Category filter
        if (filters.category) {
            const productCategory = typeof product.category === 'object' ? product.category.name : product.category;
            if (productCategory !== filters.category) return false;
        }

        // Search filter
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            const searchableText = [
                product.name,
                typeof product.brand === 'object' ? product.brand.name : product.brand,
                typeof product.category === 'object' ? product.category.name : product.category,
                product.description
            ].join(' ').toLowerCase();

            if (!searchableText.includes(searchTerm)) return false;
        }

        // In stock filter
        if (filters.in_stock) {
            if (!product.in_stock) return false;
        }

        return true;
    });
}

// UPDATED loadProducts function for static data
async function loadProducts() {
    console.log('🔄 loadProducts: Starting with filters:', shopState.filters);

    try {
        // Filter products client-side
        const filteredProducts = filterProducts(shopState.allProducts, shopState.filters);
        shopState.totalProducts = filteredProducts.length;

        // Calculate pagination
        const startIndex = (shopState.currentPage - 1) * shopState.productsPerPage;
        const endIndex = startIndex + shopState.productsPerPage;
        const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

        console.log('📊 loadProducts: Pagination info', {
            total: filteredProducts.length,
            currentPage: shopState.currentPage,
            startIndex,
            endIndex,
            productsThisPage: paginatedProducts.length
        });

        // Update products array
        if (shopState.currentPage === 1) {
            shopState.products = paginatedProducts;
        } else {
            shopState.products = [...shopState.products, ...paginatedProducts];
        }

        // Check if there are more products to load
        shopState.hasMoreProducts = endIndex < filteredProducts.length;

        console.log('🎨 loadProducts: Calling renderProducts with', shopState.products.length, 'products');
        renderProducts(shopState.products);
        updateLoadMoreButton();
        hideLoadingState();

        console.log('✨ loadProducts: Completed successfully');

    } catch (error) {
        console.error('❌ loadProducts: Failed to load products:', error);
        showNotification('Error loading products', 'error');
        hideLoadingState();
    }
}

// UPDATED loadMoreProducts function
async function loadMoreProducts() {
    if (shopState.isLoading || !shopState.hasMoreProducts) {
        console.log('Cannot load more - loading:', shopState.isLoading, 'hasMore:', shopState.hasMoreProducts);
        return;
    }

    console.log('Loading more products, moving from page', shopState.currentPage, 'to page', shopState.currentPage + 1);
    shopState.currentPage++;

    try {
        await loadProducts();
    } catch (error) {
        console.error('Error in loadMoreProducts:', error);
        shopState.currentPage--; // Revert on error
    }
}

// UPDATED applyFilters function for static data
async function applyFilters() {
    if (shopState.isLoading) {
        console.log('🔄 applyFilters: Already loading, but resetting state for new filters');
    }

    shopState.isLoading = true;
    shopState.currentPage = 1;
    shopState.products = []; // Clear products immediately

    console.log('🔄 applyFilters: Applying filters:', shopState.filters);
    showLoadingState(); // Show loading immediately

    try {
        await loadProducts();
        updatePageTitle(shopState.filters);
        console.log('✅ applyFilters: Filters applied, products loaded:', shopState.products.length);
    } catch (error) {
        console.error('❌ applyFilters: Failed to apply filters:', error);
        showNotification('Error applying filters', 'error');
    } finally {
        shopState.isLoading = false;
        console.log('🏁 applyFilters: Finished, isLoading reset to false');
    }
}

// Rest of the functions remain mostly the same, but remove API cache references

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

    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (loadMoreContainer) {
        loadMoreContainer.style.display = 'none';
    }
}

function hideLoadingState() {
    // Loading state is automatically removed when products are rendered
}

function renderProducts(products) {
    const container = document.getElementById('productGrid');
    const resultsCount = document.getElementById('resultsCount');

    console.log('🎨 renderProducts: Called with', products.length, 'products');
    console.log('🎨 renderProducts: Container exists:', !!container);

    if (!container) {
        console.error('❌ renderProducts: No product grid container found!');
        return;
    }

    if (products.length === 0 && !shopState.isLoading) {
        console.log('🎨 renderProducts: Showing no products message');
        const activeFilters = [];
        if (shopState.filters.brand) activeFilters.push(`Brand: ${shopState.filters.brand}`);
        if (shopState.filters.category) activeFilters.push(`Category: ${shopState.filters.category}`);
        if (shopState.filters.search) activeFilters.push(`Search: "${shopState.filters.search}"`);
        if (shopState.filters.in_stock) activeFilters.push('In Stock Only');

        container.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:40px">
                <div style="font-size:48px;margin-bottom:12px">🔍</div>
                <h3 style="margin-bottom:8px">No products found</h3>
                <p class="muted" style="margin-bottom:16px">
                    ${activeFilters.length > 0
                        ? `No products match ${activeFilters.join(' + ')}`
                        : 'Try adjusting your filters or search terms'}
                </p>
                ${activeFilters.length > 0 ? `
                    <p class="muted" style="font-size:14px;margin-bottom:16px">
                        Tip: Try removing some filters to see more products
                    </p>
                ` : ''}
                <button class="btn" onclick="clearFilters()" style="margin-top:8px">
                    Clear All Filters
                </button>
            </div>
        `;
    } else {
        console.log('🎨 renderProducts: Rendering', products.length, 'product cards');
        container.innerHTML = products.map(product => {
            // Safely extract brand and category names
            const brandName = typeof product.brand === 'object' ? product.brand.name : product.brand;
            const categoryName = typeof product.category === 'object' ? product.category.name : product.category;

            // Handle image URL - use placeholder if not available
            const imageUrl = product.image_url ?
                (product.image_url.startsWith('http') ? product.image_url : `http://localhost:8888${product.image_url}`) :
                `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K`;

            return `
            <div class="card product-card" data-product-id="${product.id}">
                <img class="image" src="${imageUrl}" alt="${product.name}"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K'; this.style.display='block'"
                     loading="lazy">
                <div class="muted">${brandName} • ${categoryName} • ${product.reference || 'N/A'}</div>
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
        `}).join('');
    }

    if (resultsCount) {
        const totalShown = products.length;
        const totalAvailable = shopState.totalProducts;

        if (shopState.hasMoreProducts) {
            resultsCount.textContent = `Showing ${totalShown} of ${totalAvailable} products`;
        } else {
            resultsCount.textContent = `${totalShown} ${totalShown === 1 ? 'product' : 'products'} found`;

            // Add filter info to results count
            const activeFilters = [];
            if (shopState.filters.brand) activeFilters.push(`Brand: ${shopState.filters.brand}`);
            if (shopState.filters.category) activeFilters.push(`Category: ${shopState.filters.category}`);

            if (activeFilters.length > 0) {
                resultsCount.textContent += ` • ${activeFilters.join(' • ')}`;
            }
        }
        console.log('🎨 renderProducts: Updated results count:', resultsCount.textContent);
    }

    console.log('🎨 renderProducts: Finished rendering');
}

function populateFilters(categories, brands) {
    const categorySelect = document.getElementById('filterCategory');
    const brandSelect = document.getElementById('filterBrand');

    if (categorySelect && categories) {
        categorySelect.innerHTML = '<option value="">All Categories</option>' +
            categories.map(cat => {
                const catName = typeof cat === 'object' ? cat.name : cat;
                return `<option value="${catName}">${catName}</option>`;
            }).join('');
    }

    if (brandSelect && brands) {
        brandSelect.innerHTML = '<option value="">All Brands</option>' +
            brands.map(brand => {
                const brandName = typeof brand === 'object' ? brand.name : brand;
                return `<option value="${brandName}">${brandName}</option>`;
            }).join('');
    }
}

function applyUrlFilters() {
    const urlFilters = getUrlParams();

    shopState.filters = { ...shopState.filters, ...urlFilters };

    if (urlFilters.brand) {
        const brandSelect = document.getElementById('filterBrand');
        if (brandSelect) brandSelect.value = urlFilters.brand;
    }

    if (urlFilters.category) {
        const categorySelect = document.getElementById('filterCategory');
        if (categorySelect) categorySelect.value = urlFilters.category;
    }

    if (urlFilters.search) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = urlFilters.search;
    }

    if (urlFilters.in_stock) {
        const stockSelect = document.getElementById('filterStock');
        if (stockSelect) stockSelect.value = urlFilters.in_stock;
    }

    if (Object.keys(urlFilters).length > 0) {
        applyFilters();
    }
}

function setupShopEvents() {
    console.log('🛠️ Setting up shop events...');

    // Filter changes
    const filters = ['filterBrand', 'filterCategory', 'filterPrice', 'filterStock', 'sortSelect'];
    filters.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) {
            element.addEventListener('change', debounce(function() {
                console.log('🎛️ Filter changed:', filterId, 'value:', element.value);

                shopState.currentPage = 1;
                shopState.filters = getCurrentFilters();
                console.log('📋 Current filters:', shopState.filters);

                // Force immediate UI update
                showLoadingState();

                applyFilters();
                updateUrlFromForm();
            }, 300));
        }
    });

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            console.log('🔍 Search input:', searchInput.value);

            shopState.currentPage = 1;
            shopState.filters.search = searchInput.value;

            // Force immediate UI update
            showLoadingState();

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
    setupInfiniteScroll();
    console.log('✅ Shop events setup complete');
}

// Keep the same infinite scroll and utility functions
function setupInfiniteScroll() {
    let isThrottled = false;

    window.addEventListener('scroll', () => {
        if (isThrottled) return;

        isThrottled = true;
        setTimeout(() => {
            isThrottled = false;

            // Check if we should load more
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight;
            const clientHeight = document.documentElement.clientHeight;

            // Load when 500px from bottom
            if (scrollTop + clientHeight >= scrollHeight - 500) {
                if (!shopState.isLoading && shopState.hasMoreProducts) {
                    console.log('Auto-loading more products...');
                    loadMoreProducts();
                }
            }
        }, 200);
    });

    console.log('Infinite scroll enabled');
}

function getCurrentFilters() {
    const stockValue = document.getElementById('filterStock')?.value;
    return {
        brand: document.getElementById('filterBrand')?.value || '',
        category: document.getElementById('filterCategory')?.value || '',
        search: document.getElementById('searchInput')?.value || '',
        in_stock: stockValue === 'True' ? true : stockValue === 'False' ? false : '',
    };
}

function updateUrlFromForm() {
    updateUrlParams(shopState.filters);
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
    const resetElements = ['filterBrand', 'filterCategory', 'filterStock', 'searchInput'];
    resetElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });

    shopState.filters = {
        brand: '',
        category: '',
        search: '',
        in_stock: false
    };
    shopState.currentPage = 1;
    shopState.products = [];

    applyFilters();
    updateUrlParams({});
    showNotification('Filters cleared', 'success');
}

// UPDATED load more button function
function updateLoadMoreButton() {
    const container = document.getElementById('loadMoreContainer');
    const button = document.getElementById('loadMoreBtn');
    const info = document.getElementById('loadMoreInfo');

    if (!container) {
        console.error('loadMoreContainer not found in HTML');
        return;
    }

    console.log('Updating load more button:', {
        hasMoreProducts: shopState.hasMoreProducts,
        productsLength: shopState.products.length,
        totalProducts: shopState.totalProducts,
        currentPage: shopState.currentPage
    });

    if (shopState.hasMoreProducts && shopState.products.length > 0) {
        // SHOW LOAD MORE BUTTON
        container.style.display = 'block';
        container.style.border = '2px solid #3B82F6';
        container.style.background = '#f0f7ff';
        container.style.padding = '20px';
        container.style.borderRadius = '8px';
        container.style.marginTop = '24px';

        if (button) {
            button.textContent = `Load More (Page ${shopState.currentPage + 1})`;
            button.disabled = shopState.isLoading;
            button.style.display = 'block';
            button.style.fontSize = '16px';
            button.style.padding = '12px 24px';
        }
        if (info) {
            const remaining = shopState.totalProducts - shopState.products.length;
            info.textContent = `${remaining} more products available - Click to load next page`;
            info.style.color = '#3B82F6';
            info.style.display = 'block';
            info.style.fontWeight = '500';
        }
        console.log('✅ Load more button: VISIBLE');

    } else if (shopState.products.length > 0) {
        // SHOW "ALL LOADED" MESSAGE
        container.style.display = 'block';
        container.style.border = '2px solid #10B981';
        container.style.background = '#f0f9f4';
        container.style.padding = '20px';
        container.style.borderRadius = '8px';
        container.style.marginTop = '24px';

        if (button) {
            button.style.display = 'none';
        }
        if (info) {
            info.textContent = `✅ All ${shopState.products.length} products loaded (Page ${shopState.currentPage})`;
            info.style.color = '#10B981';
            info.style.display = 'block';
            info.style.fontWeight = '500';
        }
        console.log('✅ Load more container: VISIBLE (all loaded)');

    } else {
        // NO PRODUCTS
        container.style.display = 'none';
        console.log('❌ Load more container: HIDDEN (no products)');
    }
}

// Debug function to check the current state
window.debugShop = function() {
    console.log('=== SHOP DEBUG INFO ===');
    console.log('Shop State:', {
        products: shopState.products.length,
        totalProducts: shopState.totalProducts,
        currentPage: shopState.currentPage,
        productsPerPage: shopState.productsPerPage,
        hasMoreProducts: shopState.hasMoreProducts,
        isLoading: shopState.isLoading,
        filters: shopState.filters
    });

    const container = document.getElementById('loadMoreContainer');
    if (container) {
        const computedStyle = window.getComputedStyle(container);
        console.log('Load More Container:', {
            exists: true,
            display: container.style.display,
            computedDisplay: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity
        });
    } else {
        console.log('Load More Container: NOT FOUND');
    }
};
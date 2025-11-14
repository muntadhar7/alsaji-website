// Shop state management
class ShopState {
    constructor() {
        this.products = [];
        this.allProducts = [];
        this.categories = null;
        this.brands = null;
        this.filters = {
            brand: '',
            category: '',
            search: '',
            in_stock: false,
            price_min: '',
            price_max: '',
            // ✅ VEHICLE FILTERS
            vehicle_make: '',
            vehicle_model: '',
            vehicle_year: ''
        };
        this.isLoading = false;
        this.currentPage = 1;
        this.productsPerPage = 12;
        this.hasMoreProducts = false;
        this.totalProducts = 0;
        this.currentVehicle = null;
    }
}

const shopState = new ShopState();

// Utility functions
function formatPrice(price) {
    if (typeof price !== 'number') {
        price = parseFloat(price) || 0;
    }
    return 'IQD ' + price.toLocaleString('en-US');
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

// URL PARAMETER HANDLING
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const filters = {};

    if (params.has('brand')) filters.brand = params.get('brand');
    if (params.has('category')) filters.category = params.get('category');
    if (params.has('search')) filters.search = params.get('search');
    if (params.has('in_stock')) filters.in_stock = params.get('in_stock') === 'true';
    if (params.has('price_min')) filters.price_min = params.get('price_min');
    if (params.has('price_max')) filters.price_max = params.get('price_max');
    if (params.has('page')) shopState.currentPage = parseInt(params.get('page')) || 1;

    // ✅ ADD VEHICLE PARAMS
    if (params.has('make')) filters.vehicle_make = params.get('make');
    if (params.has('model')) filters.vehicle_model = params.get('model');
    if (params.has('year')) filters.vehicle_year = params.get('year');

    return filters;
}

function updateUrlParams(filters) {
    const params = new URLSearchParams();

    if (filters.brand) params.set('brand', filters.brand);
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    if (filters.in_stock) params.set('in_stock', 'true');
    if (filters.price_min) params.set('price_min', filters.price_min);
    if (filters.price_max) params.set('price_max', filters.price_max);
    if (shopState.currentPage > 1) params.set('page', shopState.currentPage);

    // ✅ ADD VEHICLE PARAMS
    if (filters.vehicle_make) params.set('make', filters.vehicle_make);
    if (filters.vehicle_model) params.set('model', filters.vehicle_model);
    if (filters.vehicle_year) params.set('year', filters.vehicle_year);

    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', newUrl);
}

// Product ID validation
function validateProductId(productId) {
    if (productId === null || productId === undefined || productId === '') {
        return false;
    }

    const id = parseInt(productId);
    return !isNaN(id) && id > 0;
}

// Enhanced addToCart with validation
async function addToCart(productId, quantity = 1) {
    // Validate product ID before sending to API
    if (!validateProductId(productId)) {
        console.error('❌ Invalid product ID:', productId);
        showNotification('Invalid product selection', 'error');
        return;
    }

    try {
        const validatedProductId = parseInt(productId);
        const validatedQuantity = parseInt(quantity) || 1;

        console.log('🛒 Adding to cart:', {
            productId: validatedProductId,
            quantity: validatedQuantity
        });

        const result = await alsajiAPI.addToCart(validatedProductId, validatedQuantity);
        if (result.success) {
            updateCartCount(result.cart_count || result.cart?.item_count || 0);
            showNotification(result.message || 'Product added to cart', 'success');
        } else {
            showNotification(result.error || 'Failed to add product to cart', 'error');
        }
    } catch (error) {
        console.error('❌ Error adding to cart:', error);
        showNotification('Error adding product to cart', 'error');
    }
}

function updateCartCount(count) {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.textContent = count;
        cartCount.style.display = count > 0 ? 'flex' : 'none';
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
        border-radius: 999px;
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
        console.log('📁 Loading static data from JSON files...');

        const [productsData, categoriesData, brandsData] = await Promise.all([
            fetch('data/json/products.json').then(r => {
                if (!r.ok) throw new Error(`Products: ${r.status}`);
                return r.json();
            }),
            fetch('data/json/categories.json').then(r => {
                if (!r.ok) throw new Error(`Categories: ${r.status}`);
                return r.json();
            }),
            fetch('data/json/brands.json').then(r => {
                if (!r.ok) throw new Error(`Brands: ${r.status}`);
                return r.json();
            })
        ]);

        console.log('✅ Static data loaded successfully');
        return {
            products: productsData,
            categories: categoriesData,
            brands: brandsData
        };
    } catch (error) {
        console.error('❌ Failed to load static data:', error);
        showNotification('Failed to load product data', 'error');
        return { products: [], categories: [], brands: [] };
    }
}

// Shop page functionality
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛍️ Initializing shop...');

    // ✅ SETUP VEHICLE FILTERS FIRST
    setupVehicleFilters();

    // ✅ LOAD DATA - vehicle filters are already set
    await loadShopData();
    setupShopEvents();

    // ✅ NO NEED FOR applyUrlFilters() - filters are already applied in loadProducts()

    console.log('✅ Shop initialized with filters:', shopState.filters);

    // Load initial cart count
    try {
        const cartResult = await alsajiAPI.getCart();
        if (cartResult.success && cartResult.cart) {
            updateCartCount(cartResult.cart.item_count || 0);
        }
    } catch (error) {
        console.log('Cart not initialized yet');
    }
});

async function loadShopData() {
    shopState.currentPage = 1;
    shopState.products = [];

    try {
        showLoadingState();

        const staticData = await loadStaticData();

        shopState.categories = staticData.categories;
        shopState.brands = staticData.brands;

        // ✅ ENHANCE PRODUCTS WITH COMPATIBILITY DATA (AWAIT THE PROMISE)
        shopState.allProducts = await enhanceProductsWithCompatibility(staticData.products);

        shopState.totalProducts = shopState.allProducts.length;

        console.log('📊 Loaded data:', {
            products: shopState.allProducts.length,
            enhanced_with_compatibility: shopState.allProducts.filter(p => p.compatibility_info).length,
            categories: shopState.categories.length,
            brands: shopState.brands.length,
            currentFilters: shopState.filters
        });

        populateFilters(staticData.categories, staticData.products);

        // ✅ LOAD PRODUCTS WITH CURRENT FILTERS (INCLUDING VEHICLE)
        await loadProducts();

    } catch (error) {
        console.error('❌ Failed to load shop data:', error);
        showNotification('Failed to load products', 'error');
        hideLoadingState();
    }
}

function showLoadingState() {
    shopState.isLoading = true;

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
    shopState.isLoading = false;
}

// ✅ UPDATE filterProducts FUNCTION TO INCLUDE VEHICLE FILTERING
async function filterProducts(products, filters) {
    console.log('🔍 filterProducts: Filtering', products.length, 'products with filters:', filters);

    // Use Promise.all to handle async compatibility checks
    const filterPromises = products.map(async (product) => {
        // Brand filter
        if (filters.brand && filters.brand !== 'All') {
            const brandName = product.brand ?
                (typeof product.brand === 'object' ? product.brand.name : product.brand) :
                '';
            if (brandName !== filters.brand) {
                return false;
            }
        }

        // Category filter
        if (filters.category && filters.category !== 'All') {
            const categoryName = product.category ?
                (typeof product.category === 'object' ? product.category.name : product.category) :
                '';
            if (categoryName !== filters.category) {
                return false;
            }
        }

        // Search filter
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            const searchableText = [
                product.name || '',
                product.default_code || '',
                product.description || '',
                product.brand ? (typeof product.brand === 'object' ? product.brand.name : product.brand) : '',
                product.category ? (typeof product.category === 'object' ? product.category.name : product.category) : ''
            ].join(' ').toLowerCase();

            if (!searchableText.includes(searchTerm)) {
                return false;
            }
        }

        // In stock filter
        if (filters.in_stock && !product.in_stock) {
            return false;
        }

        // Price range filters
        if (filters.price_min) {
            const minPrice = parseFloat(filters.price_min);
            if (!isNaN(minPrice) && product.price < minPrice) {
                return false;
            }
        }

        if (filters.price_max) {
            const maxPrice = parseFloat(filters.price_max);
            if (!isNaN(maxPrice) && product.price > maxPrice) {
                return false;
            }
        }

        // ✅ VEHICLE COMPATIBILITY FILTER (ASYNC)
        if (filters.vehicle_make || filters.vehicle_model || filters.vehicle_year) {
            const isCompatible = await checkVehicleCompatibility(product, filters);
            if (!isCompatible) {
                console.log('❌ Product not compatible with vehicle:', product.name, 'ID:', product.id);
                return false;
            } else {
                console.log('✅ Product compatible with vehicle:', product.name, 'ID:', product.id);
            }
        }

        return true;
    });

    const filterResults = await Promise.all(filterPromises);
    const filteredProducts = products.filter((_, index) => filterResults[index]);

    console.log('🔍 filterProducts: After filtering:', filteredProducts.length, 'products remain');
    console.log('🔍 filterProducts: Vehicle filter active?', !!(filters.vehicle_make || filters.vehicle_model || filters.vehicle_year));

    return filteredProducts;
}

// ✅ IMPROVED VEHICLE COMPATIBILITY CHECK FUNCTION
async function checkVehicleCompatibility(product, filters) {
    const { vehicle_make, vehicle_model, vehicle_year } = filters;

    // If no vehicle filters are active, show all products
    if (!vehicle_make && !vehicle_model && !vehicle_year) {
        return true;
    }

    // Check if product has compatibility info
    if (product.compatibility_info) {
        const compInfo = product.compatibility_info;

        // Check model match
        if (vehicle_model && compInfo.vehicle_model_id != vehicle_model) {
            return false;
        }

        // Check year range
        if (vehicle_year) {
            const year = parseInt(vehicle_year);
            const fromYear = compInfo.from_year;
            const toYear = compInfo.to_year;

            if (fromYear && toYear) {
                if (year < fromYear || year > toYear) {
                    return false;
                }
            } else if (fromYear && year < fromYear) {
                return false;
            } else if (toYear && year > toYear) {
                return false;
            }
        }

        return true;
    }

    // If product doesn't have compatibility info, use the compatibility index directly
    const compatibilityIndex = await loadVehicleCompatibilityData();

    if (compatibilityIndex && compatibilityIndex.length > 0) {
        const compatibleVehicles = compatibilityIndex.filter(vehicle => {
            return vehicle.compatible_products.some(cp => {
                const productId = cp.product_id || cp.product_template_id;
                return productId === product.id;
            });
        });

        if (compatibleVehicles.length === 0) {
            // No compatibility data for this product
            return true; // Change to false if you only want to show compatible products
        }

        // Filter compatible vehicles by the current vehicle filters
        const matchingVehicles = compatibleVehicles.filter(vehicle => {
            // Check model match
            if (vehicle_model && vehicle.vehicle_model_id != vehicle_model) {
                return false;
            }

            // Check year range
            if (vehicle_year) {
                const year = parseInt(vehicle_year);
                const fromYear = vehicle.from_year;
                const toYear = vehicle.to_year;

                if (fromYear && toYear) {
                    if (year < fromYear || year > toYear) {
                        return false;
                    }
                } else if (fromYear && year < fromYear) {
                    return false;
                } else if (toYear && year > toYear) {
                    return false;
                }
            }

            return true;
        });

        return matchingVehicles.length > 0;
    }

    // If no compatibility data available at all, show the product
    return true;
}

async function loadProducts() {
    console.log('🔄 loadProducts: Starting with filters:', shopState.filters);

    try {
        if (!shopState.allProducts || !Array.isArray(shopState.allProducts)) {
            console.error('❌ loadProducts: No products data available');
            showNotification('No products data available', 'error');
            hideLoadingState();
            return;
        }

        console.log('📊 loadProducts: Total products available:', shopState.allProducts.length);

        // ✅ FILTER PRODUCTS CLIENT-SIDE (ASYNC)
        const filteredProducts = await filterProducts(shopState.allProducts, shopState.filters);
        shopState.totalProducts = filteredProducts.length;

        console.log('📊 loadProducts: After filtering:', filteredProducts.length, 'products');

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
        showNotification('Error loading products: ' + error.message, 'error');
        hideLoadingState();
    }
}

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

function loadMoreProducts() {
    if (shopState.isLoading || !shopState.hasMoreProducts) return;

    shopState.currentPage++;
    shopState.isLoading = true;

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';
    }

    loadProducts();
}

function applyFilters(newFilters = {}) {
    console.log('🔄 applyFilters: Applying NEW filters:', newFilters);
    console.log('🔄 applyFilters: Current shopState filters BEFORE:', shopState.filters);

    shopState.isLoading = true;
    shopState.currentPage = 1;

    // ✅ UPDATE filters by merging - don't replace entirely
    shopState.filters = {
        ...shopState.filters, // Keep existing filters
        ...newFilters // Apply new filters
    };

    // Convert "All" to empty string for filtering
    if (shopState.filters.category === 'All') {
        shopState.filters.category = '';
    }
    if (shopState.filters.brand === 'All') {
        shopState.filters.brand = '';
    }

    console.log('🔄 applyFilters: Final filters for processing:', shopState.filters);

    try {
        loadProducts();
        updateURL();
        console.log('✅ applyFilters: Filters applied, products loaded:', shopState.products.length);
    } catch (error) {
        console.error('❌ applyFilters: Error applying filters:', error);
        showNotification('Error applying filters', 'error');
    } finally {
        shopState.isLoading = false;
        console.log('🏁 applyFilters: Finished, isLoading reset to false');
    }
}

function renderProducts(products) {
    const container = document.getElementById('productGrid');
    const resultsCount = document.getElementById('resultsCount');

    console.log('🎨 renderProducts: Called with', products.length, 'products');

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
        if (shopState.filters.vehicle_model) activeFilters.push('Vehicle Filter');

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
            const brandName = product.brand ?
                (typeof product.brand === 'object' ? product.brand.name : product.brand) :
                'No Brand';

            const categoryName = product.category ?
                (typeof product.category === 'object' ? product.category.name : product.category) :
                'Uncategorized';

            // Handle image URL
            const imageUrl = product.image_url ?
                (product.image_url.startsWith('http') ? product.image_url : `https://alsajigroup-staging-24665929.dev.odoo.com${product.image_url}`) :
                `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K`;

            const reference = product.default_code || '';

            // ✅ ADD VEHICLE COMPATIBILITY BADGE
            const compatibilityBadge = product.compatibility_info ? `
                <div style="background:#10B981; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-top:4px;">
                    ✅ Vehicle Compatible
                </div>
            ` : '';

            return `
            <div class="card product-card" style="background:#f8f9fa;" data-product-id="${product.id}">
                <img class="image" style="object-fit: contain; background:#ffffff;" src="${imageUrl}" alt="${product.name}"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K'; this.style.display='block'"
                     loading="lazy">
                <div class="muted">${brandName} • ${categoryName} • ${reference}</div>
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
                ${compatibilityBadge}
            </div>
        `}).join('');
    }

    if (resultsCount) {
        const totalShown = products.length;
        const totalAvailable = shopState.totalProducts || products.length;

        if (shopState.hasMoreProducts) {
            resultsCount.textContent = `Showing ${totalShown} of ${totalAvailable} products`;
        } else {
            resultsCount.textContent = `${totalShown} ${totalShown === 1 ? 'product' : 'products'} found`;
        }

        // ✅ ADD VEHICLE FILTER INFO
        if (shopState.filters.vehicle_model) {
            resultsCount.textContent += ' • Vehicle Filter Applied';
        }
    }

    console.log('🎨 renderProducts: Finished rendering');
}

function populateFilters(categories, products) {
    const categorySelect = document.getElementById('filterCategory');
    const brandSelect = document.getElementById('filterBrand');

    // Populate categories
    if (categorySelect && categories) {
        categorySelect.innerHTML = '<option value="">All Categories</option>' +
            categories.map(cat => {
                const catName = typeof cat === 'object' ? cat.name : cat;
                return `<option value="${catName}">${catName}</option>`;
            }).join('');
    }

    // Extract unique brands from products
    if (brandSelect && products) {
        const brands = extractBrandsFromProducts(products);
        brandSelect.innerHTML = '<option value="">All Brands</option>' +
            brands.map(brand => {
                return `<option value="${brand}">${brand}</option>`;
            }).join('');

        console.log('🔄 populateFilters: Found', brands.length, 'brands from products');
    }
}

function extractBrandsFromProducts(products) {
    const brandSet = new Set();

    products.forEach(product => {
        if (product.brand) {
            const brandName = typeof product.brand === 'object' ? product.brand.name : product.brand;
            if (brandName && brandName !== 'No Brand') {
                brandSet.add(brandName);
            }
        }
    });

    return Array.from(brandSet).sort();
}

function applyUrlFilters() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlFilters = {};

    console.log('🔗 applyUrlFilters: URL parameters found:', {
        make: urlParams.get('make'),
        model: urlParams.get('model'),
        year: urlParams.get('year'),
        category: urlParams.get('category'),
        brand: urlParams.get('brand'),
        search: urlParams.get('search')
    });

    // Only set filters that exist in URL - don't override with empty values
    if (urlParams.has('category') && urlParams.get('category')) {
        const category = urlParams.get('category');
        urlFilters.category = category === 'All' ? '' : category;
    }

    if (urlParams.has('brand') && urlParams.get('brand')) {
        const brand = urlParams.get('brand');
        urlFilters.brand = brand === 'All' ? '' : brand;
    }

    if (urlParams.has('search') && urlParams.get('search')) {
        urlFilters.search = urlParams.get('search');
    }

    if (urlParams.has('in_stock')) {
        urlFilters.in_stock = urlParams.get('in_stock') === 'true';
    }

    if (urlParams.has('price_min') && urlParams.get('price_min')) {
        urlFilters.price_min = urlParams.get('price_min');
    }

    if (urlParams.has('price_max') && urlParams.get('price_max')) {
        urlFilters.price_max = urlParams.get('price_max');
    }

    // ✅ VEHICLE FILTERS - only apply if they exist in URL
    if (urlParams.has('make') && urlParams.get('make')) {
        urlFilters.vehicle_make = urlParams.get('make');
    }
    if (urlParams.has('model') && urlParams.get('model')) {
        urlFilters.vehicle_model = urlParams.get('model');
    }
    if (urlParams.has('year') && urlParams.get('year')) {
        urlFilters.vehicle_year = urlParams.get('year');
    }

    console.log('🔗 applyUrlFilters: URL filters to apply:', urlFilters);
    console.log('🔗 applyUrlFilters: Current shopState filters before:', shopState.filters);

    // ✅ MERGE filters properly - preserve existing vehicle filters if URL doesn't have them
    const mergedFilters = {
        ...shopState.filters, // Keep all existing filters
        ...urlFilters // Apply URL filters (this will override existing ones only for specified fields)
    };

    console.log('🔗 applyUrlFilters: Merged filters after:', mergedFilters);

    // ✅ Apply the merged filters
    applyFilters(mergedFilters);
}

function updateURL() {
    const urlParams = new URLSearchParams();

    // Only add filters that have values
    if (shopState.filters.category) {
        urlParams.set('category', shopState.filters.category);
    }

    if (shopState.filters.brand) {
        urlParams.set('brand', shopState.filters.brand);
    }

    if (shopState.filters.search) {
        urlParams.set('search', shopState.filters.search);
    }

    if (shopState.filters.in_stock) {
        urlParams.set('in_stock', 'true');
    }

    if (shopState.filters.price_min) {
        urlParams.set('price_min', shopState.filters.price_min);
    }

    if (shopState.filters.price_max) {
        urlParams.set('price_max', shopState.filters.price_max);
    }

    // Update URL without page reload
    const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
    window.history.replaceState({}, '', newUrl);

    console.log('🔗 updateURL: Updated URL to:', newUrl);
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

    // Enhanced add to cart buttons with better validation
    document.addEventListener('click', function(e) {
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        if (addToCartBtn && !addToCartBtn.disabled) {
            const productId = addToCartBtn.dataset.productId;

            // Add loading state to button
            const originalText = addToCartBtn.textContent;
            addToCartBtn.textContent = 'Adding...';
            addToCartBtn.disabled = true;

            addToCart(productId).finally(() => {
                // Restore button state
                addToCartBtn.textContent = originalText;
                addToCartBtn.disabled = false;
            });
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
        price_min: document.getElementById('filterPriceMin')?.value || '',
        price_max: document.getElementById('filterPriceMax')?.value || ''
    };
}

function updateUrlFromForm() {
    updateUrlParams(shopState.filters);
}

function clearFilters() {
    const resetElements = ['filterBrand', 'filterCategory', 'filterStock', 'searchInput', 'filterPriceMin', 'filterPriceMax'];
    resetElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });

    shopState.filters = {
        brand: '',
        category: '',
        search: '',
        in_stock: false,
        price_min: '',
        price_max: '',
        // ✅ CLEAR VEHICLE FILTERS TOO
        vehicle_make: '',
        vehicle_model: '',
        vehicle_year: ''
    };
    shopState.currentPage = 1;
    shopState.products = [];

    // Also clear vehicle selection
    clearVehicleSelection();

    applyFilters();
    updateUrlParams({});
    showNotification('Filters cleared', 'success');
}


// ✅ VEHICLE FILTERS HANDLING
function setupVehicleFilters() {
    console.log('🚗 Setting up vehicle filters...');

    // Get vehicle from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const makeId = urlParams.get('make');
    const modelId = urlParams.get('model');
    const year = urlParams.get('year');

    if (makeId && modelId && year) {
        console.log('🚗 Vehicle detected in URL:', { makeId, modelId, year });

        // Set vehicle filters immediately
        shopState.filters.vehicle_make = makeId;
        shopState.filters.vehicle_model = modelId;
        shopState.filters.vehicle_year = year;

        // Display vehicle in the vehicle box
        displayCurrentVehicle(makeId, modelId, year);

        console.log('🚗 Vehicle filters set, will be applied when products load');
    } else {
        console.log('🚗 No vehicle specified in URL');
        // Check if there's a saved vehicle
        const savedVehicle = vehicleManager?.getCurrentVehicle();
        if (savedVehicle) {
            console.log('🚗 Using saved vehicle:', savedVehicle);
            shopState.filters.vehicle_make = savedVehicle.makeId;
            shopState.filters.vehicle_model = savedVehicle.modelId;
            shopState.filters.vehicle_year = savedVehicle.year;
            displayCurrentVehicle(savedVehicle.makeName, savedVehicle.modelName, savedVehicle.year);
        }
    }
}

function displayCurrentVehicle(makeName, modelName, year) {
    const vehBox = document.getElementById('vehBox');
    if (vehBox) {
        vehBox.innerHTML = `
            <div class="row between" style="align-items:center;">
                <div>
                    <strong>${makeName} ${modelName} ${year}</strong>
                    <div class="muted" style="font-size:12px;">Vehicle selected</div>
                </div>
                <button class="btn secondary" onclick="clearVehicleSelection()" style="padding:4px 8px;font-size:12px;">
                    Change
                </button>
            </div>
        `;
        vehBox.style.background = '#f0f9ff';
        vehBox.style.border = '1px solid #3B82F6';
    }
}

function clearVehicleSelection() {
    // Clear vehicle filters
    shopState.filters.vehicle_make = '';
    shopState.filters.vehicle_model = '';
    shopState.filters.vehicle_year = '';

    // Clear from URL
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.delete('make');
    urlParams.delete('model');
    urlParams.delete('year');
    const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
    window.history.replaceState({}, '', newUrl);

    // Clear vehicle display
    const vehBox = document.getElementById('vehBox');
    if (vehBox) {
        vehBox.innerHTML = '<div class="muted">No vehicle selected</div>';
        vehBox.style.background = '#f9f7f9';
        vehBox.style.border = 'none';
    }

    // Clear from vehicle manager
    if (vehicleManager) {
        vehicleManager.clearVehicle();
    }

    // Reload products without vehicle filters
    shopState.currentPage = 1;
    loadProducts();

    showNotification('Vehicle selection cleared', 'success');
}

// ✅ CHECK COMPATIBILITY DATA LOADING
async function loadVehicleCompatibilityData() {
    try {
        console.log('🚗 Loading vehicle compatibility data...');

        // Try to load from static API first
        if (window.staticAPI && window.staticAPI.vehicleCompatibilityIndex) {
            console.log('✅ Vehicle compatibility loaded from static API');
            return window.staticAPI.vehicleCompatibilityIndex;
        }

        // Try to load from JS module
        if (window.vehicleCompatibilityIndex) {
            console.log('✅ Vehicle compatibility loaded from JS module');
            return window.vehicleCompatibilityIndex;
        }

        // Fallback: load from JSON file
        const response = await fetch('data/json/vehicle_compatibility_index.json');
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Vehicle compatibility loaded from JSON file');
            return data;
        }

        console.warn('⚠️ No vehicle compatibility data found');
        return [];
    } catch (error) {
        console.error('❌ Error loading vehicle compatibility data:', error);
        return [];
    }
}

async function enhanceProductsWithCompatibility(products) {
    console.log('🔧 Enhancing products with compatibility data...');

    const compatibilityIndex = await loadVehicleCompatibilityData();

    if (!compatibilityIndex || compatibilityIndex.length === 0) {
        console.warn('⚠️ No compatibility index available');
        return products;
    }

    console.log('📊 Compatibility index loaded:', compatibilityIndex.length, 'vehicle models');

    let enhancedCount = 0;
    const enhancedProducts = products.map(product => {
        // Find compatible vehicles for this product
        const compatibleVehicles = compatibilityIndex.filter(vehicle => {
            // Check if any compatible product matches this product ID
            return vehicle.compatible_products.some(cp => {
                // Handle both product_id and product_template_id
                const productId = cp.product_id || cp.product_template_id;
                return productId === product.id;
            });
        });

        if (compatibleVehicles.length > 0) {
            enhancedCount++;

            // For now, attach the first compatible vehicle's info
            const firstCompatible = compatibleVehicles[0];

            return {
                ...product,
                compatibility_info: {
                    vehicle_model_id: firstCompatible.vehicle_model_id,
                    vehicle_model_name: firstCompatible.vehicle_model_name,
                    brand_id: firstCompatible.brand_id,
                    brand_name: firstCompatible.brand_name,
                    from_year: firstCompatible.from_year,
                    to_year: firstCompatible.to_year,
                    year_range: firstCompatible.year_range,
                    all_compatible_vehicles: compatibleVehicles
                }
            };
        }

        return product;
    });

    console.log(`✅ Enhanced ${enhancedCount} products with compatibility data`);

    // Log some examples
    if (enhancedCount > 0) {
        const enhancedExamples = enhancedProducts.filter(p => p.compatibility_info).slice(0, 3);
        console.log('📝 Enhanced product examples:', enhancedExamples.map(p => ({
            id: p.id,
            name: p.name,
            compatible_with: p.compatibility_info.vehicle_model_name
        })));
    }

    return enhancedProducts;
}
// ✅ ENHANCE PRODUCTS WITH COMPATIBILITY DATA

// Update the main initialization
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛍️ Initializing shop...');

    // ✅ SETUP VEHICLE FILTERS FIRST
    setupVehicleFilters();

    await loadShopData();
    setupShopEvents();
    applyUrlFilters();

    // Load initial cart count
    try {
        const cartResult = await alsajiAPI.getCart();
        if (cartResult.success && cartResult.cart) {
            updateCartCount(cartResult.cart.item_count || 0);
        }
    } catch (error) {
        console.log('Cart not initialized yet');
    }
});

// ✅ DEBUG FUNCTION TO CHECK VEHICLE COMPATIBILITY
function debugVehicleFiltering() {
    console.log('🔍 DEBUG VEHICLE FILTERING:');
    console.log('Current shopState.filters:', shopState.filters);
    console.log('Vehicle filters active:',
        shopState.filters.vehicle_make || 'No make',
        shopState.filters.vehicle_model || 'No model',
        shopState.filters.vehicle_year || 'No year'
    );

    // Check if products have compatibility data
    const productsWithCompatibility = shopState.allProducts.filter(p => p.compatibility_info);
    console.log('Products with compatibility info:', productsWithCompatibility.length);

    // Check compatibility index
    if (window.staticAPI && window.staticAPI.vehicleCompatibilityIndex) {
        console.log('Compatibility index entries:', window.staticAPI.vehicleCompatibilityIndex.length);

        const matchingVehicles = window.staticAPI.vehicleCompatibilityIndex.filter(
            vehicle => vehicle.vehicle_model_id == shopState.filters.vehicle_model
        );
        console.log('Matching vehicles in index:', matchingVehicles.length);

        if (matchingVehicles.length > 0) {
            console.log('First matching vehicle:', matchingVehicles[0]);
            console.log('Compatible products for this vehicle:', matchingVehicles[0].compatible_products.length);
        }
    }
}

// Call this in the console to debug: debugVehicleFiltering()
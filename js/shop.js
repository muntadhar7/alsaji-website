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
            vehicle_make: '',
            vehicle_model: '',
            vehicle_year: ''
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
    if (typeof price !== 'number') {
        price = parseFloat(price) || 0;
    }
    return 'IQD ' + price.toLocaleString('en-US');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// URL parameter handling
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const filters = {};

    const urlMappings = {
        'brand': 'brand',
        'category': 'category',
        'search': 'search',
        'in_stock': 'in_stock',
        'price_min': 'price_min',
        'price_max': 'price_max',
        'make': 'vehicle_make',
        'model': 'vehicle_model',
        'year': 'vehicle_year'
    };

    Object.entries(urlMappings).forEach(([param, filterKey]) => {
        if (params.has(param)) {
            const value = params.get(param);
            if (filterKey === 'in_stock') {
                filters[filterKey] = value === 'true';
            } else {
                filters[filterKey] = value;
            }
        }
    });

    if (params.has('page')) {
        shopState.currentPage = parseInt(params.get('page')) || 1;
    }

    return filters;
}

function updateUrlParams() {
    const params = new URLSearchParams();

    const filterMappings = {
        'brand': 'brand',
        'category': 'category',
        'search': 'search',
        'vehicle_make': 'make',
        'vehicle_model': 'model',
        'vehicle_year': 'year'
    };

    Object.entries(filterMappings).forEach(([filterKey, param]) => {
        if (shopState.filters[filterKey]) {
            params.set(param, shopState.filters[filterKey]);
        }
    });

    if (shopState.filters.in_stock) {
        params.set('in_stock', 'true');
    }

    if (shopState.filters.price_min) {
        params.set('price_min', shopState.filters.price_min);
    }

    if (shopState.filters.price_max) {
        params.set('price_max', shopState.filters.price_max);
    }

    if (shopState.currentPage > 1) {
        params.set('page', shopState.currentPage);
    }

    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', newUrl);
}

// Cart functionality
function validateProductId(productId) {
    if (!productId && productId !== 0) return false;
    const id = parseInt(productId);
    return !isNaN(id) && id > 0;
}

async function addToCart(productId, quantity = 1) {
    if (!validateProductId(productId)) {
        console.error('❌ Invalid product ID:', productId);
        showNotification('Invalid product selection', 'error');
        return;
    }

    try {
        const validatedProductId = parseInt(productId);
        const validatedQuantity = parseInt(quantity) || 1;

        console.log('🛒 Adding to cart:', { productId: validatedProductId, quantity: validatedQuantity });

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
        setTimeout(() => notification.remove(), 300);
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

// Data loading
async function loadStaticData() {
    try {
        console.log('📁 Loading static data from JSON files...');

        const [productsData, categoriesData, brandsData] = await Promise.all([
            fetch('data/json/products.json').then(r => r.json()),
            fetch('data/json/categories.json').then(r => r.json()),
            fetch('data/json/brands.json').then(r => r.json())
        ]);

        console.log('✅ Static data loaded successfully');
        return { products: productsData, categories: categoriesData, brands: brandsData };
    } catch (error) {
        console.error('❌ Failed to load static data:', error);
        showNotification('Failed to load product data', 'error');
        return { products: [], categories: [], brands: [] };
    }
}

// Vehicle compatibility
async function loadVehicleCompatibilityData() {
    try {
        console.log('🚗 Loading vehicle compatibility data...');

        if (window.staticAPI?.vehicleCompatibilityIndex) {
            console.log('✅ Vehicle compatibility loaded from static API');
            return window.staticAPI.vehicleCompatibilityIndex;
        }

        if (window.vehicleCompatibilityIndex) {
            console.log('✅ Vehicle compatibility loaded from JS module');
            return window.vehicleCompatibilityIndex;
        }

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

    if (!compatibilityIndex?.length) {
        console.warn('⚠️ No compatibility index available');
        return products;
    }

    console.log('📊 Compatibility index loaded:', compatibilityIndex.length, 'vehicle models');

    const enhancedProducts = products.map(product => {
        const compatibleVehicles = compatibilityIndex.filter(vehicle =>
            vehicle.compatible_products.some(cp => {
                const productId = cp.product_id || cp.product_template_id;
                return productId === product.id;
            })
        );

        if (compatibleVehicles.length > 0) {
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

    const enhancedCount = enhancedProducts.filter(p => p.compatibility_info).length;
    console.log(`✅ Enhanced ${enhancedCount} products with compatibility data`);

    return enhancedProducts;
}

async function checkVehicleCompatibility(product, filters) {
    const { vehicle_make, vehicle_model, vehicle_year } = filters;

    if (!vehicle_make && !vehicle_model && !vehicle_year) {
        return true;
    }

    if (product.compatibility_info) {
        const compInfo = product.compatibility_info;

        if (vehicle_model && compInfo.vehicle_model_id != vehicle_model) {
            return false;
        }

        if (vehicle_year) {
            const year = parseInt(vehicle_year);
            const fromYear = compInfo.from_year;
            const toYear = compInfo.to_year;

            if (fromYear && toYear && (year < fromYear || year > toYear)) {
                return false;
            } else if (fromYear && year < fromYear) {
                return false;
            } else if (toYear && year > toYear) {
                return false;
            }
        }

        return true;
    }

    const compatibilityIndex = await loadVehicleCompatibilityData();
    if (!compatibilityIndex?.length) return true;

    const compatibleVehicles = compatibilityIndex.filter(vehicle =>
        vehicle.compatible_products.some(cp => {
            const productId = cp.product_id || cp.product_template_id;
            return productId === product.id;
        })
    );

    if (compatibleVehicles.length === 0) return true;

    const matchingVehicles = compatibleVehicles.filter(vehicle => {
        if (vehicle_model && vehicle.vehicle_model_id != vehicle_model) {
            return false;
        }

        if (vehicle_year) {
            const year = parseInt(vehicle_year);
            const fromYear = vehicle.from_year;
            const toYear = vehicle.to_year;

            if (fromYear && toYear && (year < fromYear || year > toYear)) {
                return false;
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

// Product filtering and rendering
async function filterProducts(products, filters) {
    console.log('🔍 Filtering', products.length, 'products with filters:', filters);

    const filterPromises = products.map(async (product) => {
        // Brand filter
        if (filters.brand && filters.brand !== 'All') {
            const brandName = product.brand ?
                (typeof product.brand === 'object' ? product.brand.name : product.brand) : '';
            if (brandName !== filters.brand) return false;
        }

        // Category filter
        if (filters.category && filters.category !== 'All') {
            const categoryName = product.category ?
                (typeof product.category === 'object' ? product.category.name : product.category) : '';
            if (categoryName !== filters.category) return false;
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

            if (!searchableText.includes(searchTerm)) return false;
        }

        // In stock filter
        if (filters.in_stock && !product.in_stock) return false;

        // Price range filters
        if (filters.price_min) {
            const minPrice = parseFloat(filters.price_min);
            if (!isNaN(minPrice) && product.price < minPrice) return false;
        }

        if (filters.price_max) {
            const maxPrice = parseFloat(filters.price_max);
            if (!isNaN(maxPrice) && product.price > maxPrice) return false;
        }

        // Vehicle compatibility filter
        if (filters.vehicle_make || filters.vehicle_model || filters.vehicle_year) {
            const isCompatible = await checkVehicleCompatibility(product, filters);
            if (!isCompatible) return false;
        }

        return true;
    });

    const filterResults = await Promise.all(filterPromises);
    const filteredProducts = products.filter((_, index) => filterResults[index]);

    console.log('🔍 After filtering:', filteredProducts.length, 'products remain');
    return filteredProducts;
}

function renderProducts(products) {

    const container = document.getElementById('productGrid');
    const resultsCount = document.getElementById('resultsCount');

    console.log('🎨 Rendering', products.length, 'products');

    if (!container) {
        console.error('❌ No product grid container found!');
        return;
    }

    if (products.length === 0 && !shopState.isLoading) {
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
        container.innerHTML = products.map(product => {
            const brandName = product.brand ?
                (typeof product.brand === 'object' ? product.brand.name : product.brand) : 'No Brand';

            const categoryName = product.category ?
                (typeof product.category === 'object' ? product.category.name : product.category) : 'Uncategorized';

            const imageUrl = product.image_url ?
                (product.image_url.startsWith('http') ? product.image_url : `https://alsajigroup-staging-24665929.dev.odoo.com${product.image_url}`) :
                `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K`;

            const reference = product.default_code || '';
            const compatibilityBadge = product.compatibility_info ? `
                <div style="background:#10B981; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-top:4px;">
                    ✅ Vehicle Compatible
                </div>
            ` : '';

            return `
            <div class="card product-card"  data-product-id="${product.id}">
                <img class="image" style="object-fit: contain;" src="${imageUrl}" alt="${product.name}"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K'; this.style.display='block'"
                     loading="lazy">
                <div class="muted">${brandName} • ${categoryName} • ${reference}</div>
                <div style="font-weight:500;margin:8px 0">${product.name}</div>
                <div class="row between" >
                    <div style="color:var(--red);font-weight:600">${formatPrice(product.price)}</div>
                    <button class="btn add-to-cart-btn" data-product-id="${product.id}"
                            style="padding:6px 10px;font-size:12px; "
                            ${!product.in_stock ? 'disabled' : ''}>
                        ${product.in_stock ? 'Add' : 'Out of Stock'}
                    </button>
                </div>

                ${compatibilityBadge}
            </div>
        `}).join('');
        setupCartButtonListeners();

        // Add event listeners to cart buttons
        container.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.productId;
                console.log('🛒 Add to cart clicked for product:', productId);
                addToCart(productId);
            });
        });
    }

    if (resultsCount) {
        const totalShown = products.length;
        const totalAvailable = shopState.totalProducts || products.length;

        if (shopState.hasMoreProducts) {
            resultsCount.textContent = `Showing ${totalShown} of ${totalAvailable} products`;
        } else {
            resultsCount.textContent = `${totalShown} ${totalShown === 1 ? 'product' : 'products'} found`;
        }

        if (shopState.filters.vehicle_model) {
            resultsCount.textContent += ' • Vehicle Filter Applied';
        }
    }

    console.log('🎨 Finished rendering products');
}

function setupCartButtonListeners() {
    console.log('🛒 Setting up cart button listeners...');

    const cartButtons = document.querySelectorAll('.add-to-cart-btn');
    console.log(`🛒 Found ${cartButtons.length} cart buttons`);

    cartButtons.forEach(button => {
        // Remove any existing listeners to prevent duplicates
        button.replaceWith(button.cloneNode(true));
    });

    // Re-select buttons after cloning
    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const productId = this.dataset.productId;
            console.log('🛒 Add to cart clicked:', {
                productId: productId,
                button: this,
                text: this.textContent
            });

            if (productId) {
                addToCart(productId);
            } else {
                console.error('❌ No product ID found on button:', this);
            }
        });
    });

    console.log('✅ Cart button listeners setup complete');
}

// Main product loading
async function loadProducts() {
    console.log('🔄 Loading products with filters:', shopState.filters);

    try {
        if (!shopState.allProducts?.length) {
            console.error('❌ No products data available');
            showNotification('No products data available', 'error');
            return;
        }

        console.log('📊 Total products available:', shopState.allProducts.length);

        const filteredProducts = await filterProducts(shopState.allProducts, shopState.filters);
        shopState.totalProducts = filteredProducts.length;

        console.log('📊 After filtering:', filteredProducts.length, 'products');

        const startIndex = (shopState.currentPage - 1) * shopState.productsPerPage;
        const endIndex = startIndex + shopState.productsPerPage;
        const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

        if (shopState.currentPage === 1) {
            shopState.products = paginatedProducts;
        } else {
            shopState.products = [...shopState.products, ...paginatedProducts];
        }

        shopState.hasMoreProducts = endIndex < filteredProducts.length;

        renderProducts(shopState.products);
        updateLoadMoreButton();

        console.log('✨ Products loaded successfully');

    } catch (error) {
        console.error('❌ Failed to load products:', error);
        showNotification('Error loading products: ' + error.message, 'error');
    }
}

// Update your updateLoadMoreButton function to include auto-load setup
function updateLoadMoreButton() {
    const container = document.getElementById('loadMoreContainer');
    const button = document.getElementById('loadMoreBtn');
    const info = document.getElementById('loadMoreInfo');

    if (!container) return;

    if (shopState.hasMoreProducts && shopState.products.length > 0) {
        container.style.display = 'block';
        container.style.border = '2px solid #3B82F6';
        container.style.background = '#f0f7ff';
        container.style.padding = '20px';
        container.style.borderRadius = '8px';
        container.style.marginTop = '24px';
        container.style.textAlign = 'center';

        if (button) {
            button.textContent = `Load More (Page ${shopState.currentPage + 1})`;
            button.disabled = shopState.isLoading;
            button.style.display = 'inline-block';
        }
        if (info) {
            const remaining = shopState.totalProducts - shopState.products.length;
            info.textContent = `${remaining} more products available - Scroll down or click to load`;
            info.style.marginBottom = '12px';
        }

        // Setup auto-load observer
        setTimeout(setupAutoLoadMore, 100);

    } else if (shopState.products.length > 0) {
        container.style.display = 'block';
        container.style.border = '2px solid #10B981';
        container.style.background = '#f0f9f4';
        container.style.padding = '20px';
        container.style.borderRadius = '8px';
        container.style.marginTop = '24px';
        container.style.textAlign = 'center';

        if (button) button.style.display = 'none';
        if (info) {
            info.textContent = `✅ All ${shopState.products.length} products loaded (Page ${shopState.currentPage})`;
            info.style.marginBottom = '0';
        }
    } else {
        container.style.display = 'none';
    }
}

function setupAutoLoadMore() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && shopState.hasMoreProducts && !shopState.isLoading) {
                console.log('🔄 Auto-loading more products...');
                loadMoreProducts();
            }
        });
    }, {
        rootMargin: '100px', // Load 100px before reaching the bottom
        threshold: 0.1
    });

    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (loadMoreContainer) {
        observer.observe(loadMoreContainer);
        console.log('🔍 Auto-load observer set up');
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

    loadProducts().finally(() => {
        shopState.isLoading = false;
        if (loadMoreBtn) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = `Load More (Page ${shopState.currentPage + 1})`;
        }
    });
}
// Filter management
function applyFilters(newFilters = {}) {
    console.log('🔄 Applying filters:', newFilters);

    shopState.currentPage = 1;
    shopState.filters = { ...shopState.filters, ...newFilters };

    // Convert "All" to empty string
    if (shopState.filters.category === 'All') shopState.filters.category = '';
    if (shopState.filters.brand === 'All') shopState.filters.brand = '';

    loadProducts();
    updateUrlParams();
}

function clearFilters() {
    console.log('🧹 Clearing all filters...');

    // Reset filter elements
    ['filterBrand', 'filterCategory', 'filterStock', 'filterPrice', 'searchInput'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });

    // Reset shop state
    shopState.filters = {
        brand: '',
        category: '',
        search: '',
        in_stock: false,
        price_min: '',
        price_max: '',
        vehicle_make: '',
        vehicle_model: '',
        vehicle_year: ''
    };

    shopState.currentPage = 1;

    applyFilters();
    showNotification('All filters cleared', 'success');
}

// Vehicle filters
function setupVehicleFilters() {
    console.log('🚗 Setting up vehicle filters...');

    const urlParams = new URLSearchParams(window.location.search);
    const makeId = urlParams.get('make');
    const modelId = urlParams.get('model');
    const year = urlParams.get('year');

    if (makeId && modelId && year) {
        console.log('🚗 Vehicle detected in URL:', { makeId, modelId, year });
        shopState.filters.vehicle_make = makeId;
        shopState.filters.vehicle_model = modelId;
        shopState.filters.vehicle_year = year;
        displayCurrentVehicle(makeId, modelId, year);
    } else {
        console.log('🚗 No vehicle specified in URL');
        const savedVehicle = vehicleManager?.getCurrentVehicle();
        if (savedVehicle) {
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
    shopState.filters.vehicle_make = '';
    shopState.filters.vehicle_model = '';
    shopState.filters.vehicle_year = '';

    const urlParams = new URLSearchParams(window.location.search);
    urlParams.delete('make');
    urlParams.delete('model');
    urlParams.delete('year');
    const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
    window.history.replaceState({}, '', newUrl);

    const vehBox = document.getElementById('vehBox');
    if (vehBox) {
        vehBox.innerHTML = '<div class="muted">No vehicle selected</div>';
        vehBox.style.background = '#f9f7f9';
        vehBox.style.border = 'none';
    }

    if (vehicleManager) {
        vehicleManager.clearVehicle();
    }

    shopState.currentPage = 1;
    loadProducts();
    showNotification('Vehicle selection cleared', 'success');
}

// Event handlers
function setupShopEvents() {
    console.log('🛠️ Setting up shop events...');

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            shopState.currentPage = 1;
            shopState.filters.search = searchInput.value;
            applyFilters();
        }, 500));
    }

    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreProducts);
    }

    // Clear filters button
    const clearButton = document.getElementById('clearButton');
    if (clearButton) {
        clearButton.addEventListener('click', clearFilters);
    }

    // Desktop filter events
    const brandSelect = document.getElementById('filterBrand');
    if (brandSelect) {
        brandSelect.addEventListener('change', (e) => {
            applyFilters({ brand: e.target.value });
        });
    }

    const categorySelect = document.getElementById('filterCategory');
    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            applyFilters({ category: e.target.value });
        });
    }

    const stockSelect = document.getElementById('filterStock');
    if (stockSelect) {
        stockSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            applyFilters({
                in_stock: value === 'True' ? true : value === 'False' ? false : ''
            });
        });
    }
    setTimeout(() => {
        setupCartButtonListeners();
    }, 100);


    console.log('✅ Shop events setup complete');
}

// Main initialization
async function loadShopData() {
    shopState.currentPage = 1;
    shopState.products = [];

    try {
        const staticData = await loadStaticData();
        shopState.categories = staticData.categories;
        shopState.brands = staticData.brands;
        shopState.allProducts = await enhanceProductsWithCompatibility(staticData.products);
        shopState.totalProducts = shopState.allProducts.length;

        console.log('📊 Loaded data:', {
            products: shopState.allProducts.length,
            categories: shopState.categories.length,
            brands: shopState.brands.length
        });

        // ✅ POPULATE DESKTOP FILTERS
        populateDesktopFilters();

        // ✅ POPULATE MOBILE FILTERS
        populateMobileFilters();

        await loadProducts();

    } catch (error) {
        console.error('❌ Failed to load shop data:', error);
        showNotification('Failed to load products', 'error');
    }
}

// ✅ ADD THIS FUNCTION: Populate desktop filters
function populateDesktopFilters() {
    console.log('🖥️ Populating desktop filters...');

    // Brand filter
    const brandSelect = document.getElementById('filterBrand');
    if (brandSelect && shopState.brands) {
        const brands = extractUniqueBrands();
        brandSelect.innerHTML = '<option value="">All Brands</option>' +
            brands.map(brand => `<option value="${brand}">${brand}</option>`).join('');
        console.log(`✅ Populated desktop brand filter with ${brands.length} brands`);
    }

    // Category filter
    const categorySelect = document.getElementById('filterCategory');
    if (categorySelect && shopState.categories) {
        categorySelect.innerHTML = '<option value="">All Categories</option>' +
            shopState.categories.map(category => {
                const categoryName = typeof category === 'object' ? category.name : category;
                return `<option value="${categoryName}">${categoryName}</option>`;
            }).join('');
        console.log(`✅ Populated desktop category filter with ${shopState.categories.length} categories`);
    }
}
// Global exports
window.clearFilters = clearFilters;
window.applyFilters = applyFilters;
window.loadMoreProducts = loadMoreProducts;
window.clearVehicleSelection = clearVehicleSelection;

// Initialize shop
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛍️ Initializing shop...');

    try {
        setupVehicleFilters();
        await loadShopData();
        setupShopEvents();

        // Load initial cart count
        try {
            const cartResult = await alsajiAPI.getCart();
            if (cartResult.success && cartResult.cart) {
                updateCartCount(cartResult.cart.item_count || 0);
            }
        } catch (error) {
            console.log('Cart not initialized yet');
        }

        console.log('✅ Shop fully initialized');

    } catch (error) {
        console.error('❌ Shop initialization failed:', error);
        showNotification('Failed to initialize shop', 'error');
    }
});

// ✅ ADD THIS FUNCTION: Populate mobile filters from shopState data
function populateMobileFilters() {
    console.log('📱 Populating mobile filters from shopState...');

    // Populate brand pills
    const brandSection = document.querySelector('#brandSection .filter-options');
    if (brandSection && shopState.brands) {
        const brands = extractUniqueBrands();
        const brandPills = brands.map(brand => `
            <button class="filter-pill" data-filter="brand" data-value="${brand}">
                ${brand}
            </button>
        `).join('');

        brandSection.innerHTML = `
            <button class="filter-pill active" data-filter="brand" data-value="all">
                All Brands
            </button>
            ${brandPills}
        `;
        console.log(`✅ Populated ${brands.length} brand pills`);
    }

    // Populate category pills
    const categorySection = document.querySelector('#categorySection .filter-options');
    if (categorySection && shopState.categories) {
        const categoryPills = shopState.categories.map(category => {
            const categoryName = typeof category === 'object' ? category.name : category;
            return `
                <button class="filter-pill" data-filter="category" data-value="${categoryName}">
                    ${categoryName}
                </button>
            `;
        }).join('');

        categorySection.innerHTML = `
            <button class="filter-pill active" data-filter="category" data-value="all">
                All Categories
            </button>
            ${categoryPills}
        `;
        console.log(`✅ Populated ${shopState.categories.length} category pills`);
    }

    // Setup mobile filter events
    setupMobileFilterEvents();
}

// ✅ ADD THIS FUNCTION: Extract unique brands from products
function extractUniqueBrands() {
    if (!shopState.allProducts) return [];

    const brandSet = new Set();
    shopState.allProducts.forEach(product => {
        if (product.brand) {
            const brandName = typeof product.brand === 'object' ? product.brand.name : product.brand;
            if (brandName && brandName !== 'No Brand') {
                brandSet.add(brandName);
            }
        }
    });

    return Array.from(brandSet).sort();
}

// ✅ ADD THIS FUNCTION: Setup mobile filter events
function setupMobileFilterEvents() {
    console.log('🎯 Setting up mobile filter events...');

    // Brand filter pills
    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-filter="brand"]')) {
            const pill = e.target.closest('[data-filter="brand"]');
            const value = pill.dataset.value;

            // Update active state
            const section = pill.closest('.filter-options');
            section.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            // Apply filter
            applyFilters({
                brand: value === 'all' ? '' : value
            });
        }

        // Category filter pills
        if (e.target.closest('[data-filter="category"]')) {
            const pill = e.target.closest('[data-filter="category"]');
            const value = pill.dataset.value;

            // Update active state
            const section = pill.closest('.filter-options');
            section.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            // Apply filter
            applyFilters({
                category: value === 'all' ? '' : value
            });
        }
    });

    console.log('✅ Mobile filter events setup complete');
}
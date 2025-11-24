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
        this._compatibilityCache = new Map();
    }
}

const shopState = new ShopState();

// Global vehicle data cache
let vehicleDataLoaded = false;
let vehicleData = { makes: [], models: [], years: [] };

// Data cache
const dataCache = new Map();

// Utility functions
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// URL parameter handling
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const filters = {
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

    for (const [param, value] of params) {
        switch (param) {
            case 'brand':
                filters.brand = value;
                break;
            case 'category':
                filters.category = value;
                break;
            case 'search':
                filters.search = value;
                break;
            case 'in_stock':
                filters.in_stock = value === 'true';
                break;
            case 'price_min':
                filters.price_min = value;
                break;
            case 'price_max':
                filters.price_max = value;
                break;
            case 'make':
                filters.vehicle_make = value;
                break;
            case 'model':
                filters.vehicle_model = value;
                break;
            case 'year':
                filters.vehicle_year = value;
                break;
            case 'page':
                shopState.currentPage = parseInt(value) || 1;
                break;
        }
    }

    console.log('📖 Read URL params:', filters);
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

// Data loading
async function loadVehicleData() {
    if (vehicleDataLoaded) {
        return vehicleData;
    }

    try {
        console.log('🚗 Loading vehicle data for name lookup...');

        if (window.vehicleManager && window.vehicleManager.vehicleData) {
            vehicleData = window.vehicleManager.vehicleData;
            console.log('✅ Vehicle data loaded from vehicleManager');
        } else {
            console.log('📁 Loading vehicle data from JSON files...');
            const [makesData, modelsData] = await Promise.all([
                fetch('../data/json/vehicle_brands.json').then(r => {
                    if (!r.ok) throw new Error(`Failed to load vehicle_brands.json: ${r.status}`);
                    return r.json();
                }),
                fetch('../data/json/vehicle_models.json').then(r => {
                    if (!r.ok) throw new Error(`Failed to load vehicle_models.json: ${r.status}`);
                    return r.json();
                })
            ]);

            vehicleData.makes = makesData;
            vehicleData.models = modelsData;
            console.log('✅ Vehicle data loaded from JSON files');
        }

        vehicleDataLoaded = true;
        return vehicleData;

    } catch (error) {
        console.error('❌ Error loading vehicle data:', error);
        vehicleData = { makes: [], models: [], years: [] };
        return vehicleData;
    }
}

async function fetchWithCache(url) {
    if (dataCache.has(url)) {
        return dataCache.get(url);
    }

    const response = await fetch(url);
    const data = await response.json();
    dataCache.set(url, data);
    return data;
}

async function loadStaticData() {
    const cacheKey = 'static_data';

    if (dataCache.has(cacheKey)) {
        return dataCache.get(cacheKey);
    }

    try {
        const [productsData, categoriesData, brandsData] = await Promise.all([
            this.fetchWithCache('../data/json/products.json'),
            this.fetchWithCache('../data/json/categories.json'),
            this.fetchWithCache('../data/json/brands.json')
        ]);

        const result = { products: productsData, categories: categoriesData, brands: brandsData };
        dataCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('❌ Failed to load static data:', error);
        return { products: [], categories: [], brands: [] };
    }
}

// Vehicle compatibility
async function loadVehicleCompatibilityData() {
    try {
        if (window.staticAPI?.vehicleCompatibilityIndex) {
            console.log('✅ Vehicle compatibility loaded from static API');
            return window.staticAPI.vehicleCompatibilityIndex;
        }

        if (window.vehicleCompatibilityIndex) {
            console.log('✅ Vehicle compatibility loaded from JS module');
            return window.vehicleCompatibilityIndex;
        }

        const response = await fetch('../data/json/vehicle_compatibility_index.json');
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

    const compatibilityMap = new Map();

    compatibilityIndex.forEach(vehicle => {
        vehicle.compatible_products.forEach(cp => {
            const productId = cp.product_id || cp.product_template_id;
            if (!compatibilityMap.has(productId)) {
                compatibilityMap.set(productId, []);
            }
            compatibilityMap.get(productId).push(vehicle);
        });
    });

    const enhancedProducts = products.map(product => {
        const compatibleVehicles = compatibilityMap.get(product.id) || [];

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
                    all_compatible_vehicles: compatibleVehicles,
                    compatible_count: compatibleVehicles.length
                }
            };
        }

        return product;
    });

    const enhancedCount = enhancedProducts.filter(p => p.compatibility_info).length;
    console.log(`✅ Enhanced ${enhancedCount} products with compatibility data`);

    return enhancedProducts;
}

// Helper functions for vehicle compatibility
function isVehicleMatchingFilters(vehicle, filters) {
    const { vehicle_make, vehicle_model, vehicle_year } = filters;

    if (vehicle_model && vehicle.vehicle_model_id != vehicle_model) {
        return false;
    }

    if (vehicle_make && vehicle.brand_id != vehicle_make) {
        return false;
    }

    if (vehicle_year) {
        const year = parseInt(vehicle_year);
        const fromYear = vehicle.from_year ? parseInt(vehicle.from_year) : null;
        const toYear = vehicle.to_year ? parseInt(vehicle.to_year) : null;

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

function isProductCompatibleWithVehicle(compatibilityInfo, filters) {
    const { vehicle_make, vehicle_model, vehicle_year } = filters;

    if (vehicle_model && compatibilityInfo.vehicle_model_id != vehicle_model) {
        return false;
    }

    if (vehicle_make && compatibilityInfo.brand_id != vehicle_make) {
        return false;
    }

    if (vehicle_year) {
        const year = parseInt(vehicle_year);
        const fromYear = compatibilityInfo.from_year ? parseInt(compatibilityInfo.from_year) : null;
        const toYear = compatibilityInfo.to_year ? parseInt(compatibilityInfo.to_year) : null;

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

async function checkCompatibilityIndex(product, filters) {
    const { vehicle_make, vehicle_model, vehicle_year } = filters;

    console.log(`🔍 Checking compatibility index for product ${product.id}`, {
        vehicle_make, vehicle_model, vehicle_year
    });

    if (!vehicle_make && !vehicle_model && !vehicle_year) {
        return true;
    }

    try {
        const compatibilityIndex = await loadVehicleCompatibilityData();

        if (!compatibilityIndex?.length) {
            console.log('⚠️ No compatibility index available, showing product');
            return true;
        }

        console.log(`📊 Checking ${compatibilityIndex.length} vehicle models for compatibility`);

        const compatibleVehicles = compatibilityIndex.filter(vehicle => {
            return vehicle.compatible_products.some(cp => {
                const productId = cp.product_id || cp.product_template_id;
                return productId === product.id;
            });
        });

        console.log(`🎯 Product ${product.id} has ${compatibleVehicles.length} compatible vehicles`);

        if (compatibleVehicles.length === 0 && (vehicle_make || vehicle_model || vehicle_year)) {
            console.log(`❌ Product ${product.id} has no compatible vehicles - hiding`);
            return false;
        }

        if (compatibleVehicles.length === 0) {
            return true;
        }

        const hasMatchingVehicle = compatibleVehicles.some(vehicle => {
            return isVehicleMatchingFilters(vehicle, filters);
        });

        console.log(`✅ Product ${product.id} ${hasMatchingVehicle ? 'matches' : 'does not match'} vehicle filters`);
        return hasMatchingVehicle;

    } catch (error) {
        console.error('❌ Error checking compatibility index:', error);
        return true;
    }
}

async function checkVehicleCompatibility(product, filters) {
    const { vehicle_make, vehicle_model, vehicle_year } = filters;

    if (!vehicle_make && !vehicle_model && !vehicle_year) {
        return true;
    }

    const cacheKey = `${product.id}_${vehicle_make}_${vehicle_model}_${vehicle_year}`;
    if (shopState._compatibilityCache.has(cacheKey)) {
        return shopState._compatibilityCache.get(cacheKey);
    }

    let isCompatible = false;

    if (product.compatibility_info) {
        isCompatible = isProductCompatibleWithVehicle(product.compatibility_info, filters);
    } else {
        isCompatible = await checkCompatibilityIndex(product, filters);
    }

    shopState._compatibilityCache.set(cacheKey, isCompatible);
    return isCompatible;
}

// Product filtering
function shouldShowAllProducts(filters) {
    return !filters.brand &&
           !filters.category &&
           !filters.search &&
           !filters.in_stock &&
           !filters.price_min &&
           !filters.price_max &&
           !filters.vehicle_make &&
           !filters.vehicle_model &&
           !filters.vehicle_year;
}

function getSearchableText(product) {
    if (!product) return '';

    const searchFields = [
        product.name,
        product.description,
        product.default_code,
        product.brand?.name,
        product.category?.name
    ];

    return searchFields
        .filter(field => field && typeof field === 'string')
        .join(' ')
        .toLowerCase();
}

function shouldIncludeProduct(product, filters) {
    if (filters.brand && filters.brand !== 'All') {
        const brandName = getBrandName(product);
        if (brandName !== filters.brand) return false;
    }

    if (filters.category && filters.category !== 'All') {
        const categoryName = getCategoryName(product);
        if (categoryName !== filters.category) return false;
    }

    if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const searchableText = getSearchableText(product);
        if (!searchableText.includes(searchTerm)) return false;
    }

    if (filters.in_stock && !product.in_stock) return false;

    if (filters.price_min) {
        const minPrice = parseFloat(filters.price_min);
        if (!isNaN(minPrice) && product.price < minPrice) return false;
    }

    if (filters.price_max) {
        const maxPrice = parseFloat(filters.price_max);
        if (!isNaN(maxPrice) && product.price > maxPrice) return false;
    }

    return true;
}

async function filterProducts(products, filters) {
    console.log('🔍 Filtering', products.length, 'products');

    if (shouldShowAllProducts(filters)) {
        return products;
    }

    const filterPromises = [];

    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        if (shouldIncludeProduct(product, filters)) {
            filterPromises.push(checkVehicleCompatibility(product, filters));
        } else {
            filterPromises.push(Promise.resolve(false));
        }
    }

    const filterResults = await Promise.all(filterPromises);
    return products.filter((_, index) => filterResults[index]);
}

// Product rendering helpers
function getBrandName(product) {
    if (!product.brand) return 'No Brand';
    return typeof product.brand === 'object' ? product.brand.name : product.brand;
}

function getCategoryName(product) {
    if (!product.category) return 'Uncategorized';
    return typeof product.category === 'object' ? product.category.name : product.category;
}

function getImageUrl(product) {
    if (!product.image_url) {
        return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K`;
    }
    return product.image_url.startsWith('http') ? product.image_url : `https://alsajigroup-staging-24665929.dev.odoo.com${product.image_url}`;
}

// Product rendering
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
                <h3 style="margin-bottom:8px">No compatible products found</h3>
                <p class="muted" style="margin-bottom:16px">
                    ${activeFilters.length > 0
                        ? `No products match ${activeFilters.join(' + ')}`
                        : 'Try adjusting your filters or search terms'}
                </p>
                ${shopState.filters.vehicle_model ? `
                    <p class="muted" style="font-size:14px;margin-bottom:16px">
                        No parts found for your vehicle. Try a different vehicle or check without vehicle filter.
                    </p>
                ` : ''}
                <button class="btn" onclick="clearFilters()" style="margin-top:8px">
                    Clear All Filters
                </button>
                ${shopState.filters.vehicle_model ? `
                    <button class="btn secondary" onclick="clearVehicleSelection()" style="margin-top:8px; margin-left:8px">
                        Clear Vehicle Filter Only
                    </button>
                ` : ''}
            </div>
        `;
    } else {
        container.innerHTML = products.map(product => {
            const brandName = getBrandName(product);
            const categoryName = getCategoryName(product);
            const imageUrl = getImageUrl(product);
            const reference = product.default_code || '';

            let compatibilityBadge = '';
            if (product.compatibility_info) {
                const compInfo = product.compatibility_info;
                if (shopState.filters.vehicle_model) {
                    compatibilityBadge = `
                        <div style="background:#10B981; color:white; padding:4px 8px; border-radius:4px; font-size:10px; margin-top:4px;">
                            ✅ Fits Your Vehicle
                        </div>
                    `;
                } else {
                    compatibilityBadge = `
                        <div style="background:#3B82F6; color:white; padding:4px 8px; border-radius:4px; font-size:10px; margin-top:4px;">
                            🚗 Vehicle Compatible (${compInfo.compatible_count || 'Multiple'})
                        </div>
                    `;
                }
            }

            return `
            <div class="card product-card" data-product-id="${product.id}">
                <img class="image" style="object-fit: contain;" src="${imageUrl}" alt="${product.name}"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K'; this.style.display='block'"
                     loading="lazy">
                <div class="muted">${brandName} • ${categoryName} • ${reference}</div>
                <div style="font-weight:500;margin:8px 0">${product.name}</div>
                <div class="row between">
                    <div style="color:var(--red);font-weight:600">${formatPrice(product.price)}</div>
                    <button class="btn add-to-cart-btn" data-product-id="${product.id}"
                            style="padding:6px 10px;font-size:12px;"
                            ${!product.in_stock ? 'disabled' : ''}>
                        ${product.in_stock ? 'Add' : 'Out of Stock'}
                    </button>
                </div>
                ${compatibilityBadge}
            </div>
        `}).join('');

        setupCartButtonListeners();
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

function setupCartButtonListeners() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('.add-to-cart-btn')) {
            e.preventDefault();
            e.stopPropagation();

            const button = e.target.closest('.add-to-cart-btn');
            const productId = button.dataset.productId;

            if (productId) {
                addToCart(productId);
            }
        }
    });
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
        rootMargin: '100px',
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

    if (shopState.filters.category === 'All') shopState.filters.category = '';
    if (shopState.filters.brand === 'All') shopState.filters.brand = '';

    loadProducts();
    updateUrlParams();
}

function clearFilters() {
    console.log('🧹 Clearing all filters...');

    // Reset shop state filters
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

    // Clear URL parameters
    const newUrl = window.location.pathname;
    window.history.replaceState({}, '', newUrl);

    // Reset UI controls
    updateFilterControls();

    // Reload products
    loadProducts();

    showNotification('All filters cleared', 'success');
}

// Vehicle filters
function getVehicleNamesFromIds(makeId, modelId, year) {
    const make = vehicleData.makes.find(m => m.id == makeId);
    const model = vehicleData.models.find(m => m.id == modelId);

    return {
        makeName: make ? make.name : `Make ${makeId}`,
        modelName: model ? model.name : `Model ${modelId}`,
        year: year
    };
}

function displayCurrentVehicle(makeName, modelName, year) {
    const vehBox = document.getElementById('vehBox');
    if (vehBox) {
        vehBox.innerHTML = `
            <div class="row between" style="align-items:center;">
                <div>
                    <strong>${makeName} ${modelName} ${year}</strong>
                    <div class="muted" style="font-size:12px;">Vehicle filter active - showing compatible parts only</div>
                </div>
                <button class="btn secondary" onclick="clearVehicleSelection()" style="padding:4px 8px;font-size:12px;">
                    Clear
                </button>
            </div>
        `;
        vehBox.style.background = '#f0f9ff';
        vehBox.style.border = '1px solid #3B82F6';
        vehBox.style.padding = '12px';
        vehBox.style.borderRadius = '8px';
        vehBox.style.marginBottom = '16px';
    }
}

function clearVehicleSelection() {
    const currentMakeId = shopState.filters.vehicle_make;
    const currentModelId = shopState.filters.vehicle_model;
    const currentYear = shopState.filters.vehicle_year;

    let vehicleNames = { makeName: 'Unknown', modelName: 'Unknown', year: currentYear };
    if (currentMakeId && currentModelId) {
        vehicleNames = getVehicleNamesFromIds(currentMakeId, currentModelId, currentYear);
    }

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
        vehBox.style.padding = '12px';
    }

    if (vehicleManager) {
        vehicleManager.clearVehicle();
    }

    shopState.currentPage = 1;
    loadProducts();

    showNotification(`Vehicle filter cleared: ${vehicleNames.makeName} ${vehicleNames.modelName} ${vehicleNames.year}`, 'success');
}

async function setupVehicleFilters() {
    console.log('🚗 Setting up vehicle filters...');

    await loadVehicleData();

    const urlParams = new URLSearchParams(window.location.search);
    const makeId = urlParams.get('make');
    const modelId = urlParams.get('model');
    const year = urlParams.get('year');

    if (makeId && modelId && year) {
        console.log('🚗 Vehicle detected in URL:', { makeId, modelId, year });
        shopState.filters.vehicle_make = makeId;
        shopState.filters.vehicle_model = modelId;
        shopState.filters.vehicle_year = year;

        const vehicleNames = getVehicleNamesFromIds(makeId, modelId, year);
        displayCurrentVehicle(vehicleNames.makeName, vehicleNames.modelName, vehicleNames.year);

        showNotification(`Vehicle filter applied: ${vehicleNames.makeName} ${vehicleNames.modelName} ${vehicleNames.year}`, 'info');
    } else {
        console.log('🚗 No vehicle specified in URL');
        const savedVehicle = vehicleManager?.getCurrentVehicle();
        if (savedVehicle) {
            shopState.filters.vehicle_make = savedVehicle.makeId;
            shopState.filters.vehicle_model = savedVehicle.modelId;
            shopState.filters.vehicle_year = savedVehicle.year;

            const makeName = savedVehicle.makeName || getVehicleNamesFromIds(savedVehicle.makeId, savedVehicle.modelId, savedVehicle.year).makeName;
            const modelName = savedVehicle.modelName || getVehicleNamesFromIds(savedVehicle.makeId, savedVehicle.modelId, savedVehicle.year).modelName;

            displayCurrentVehicle(makeName, modelName, savedVehicle.year);
        }
    }
}

// Filter population
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

function populateDesktopFilters() {
    console.log('🖥️ Populating desktop filters...');

    const brandSelect = document.getElementById('filterBrand');
    if (brandSelect && shopState.brands) {
        const brands = extractUniqueBrands();
        brandSelect.innerHTML = '<option value="">All Brands</option>' +
            brands.map(brand => `<option value="${brand}">${brand}</option>`).join('');
        console.log(`✅ Populated desktop brand filter with ${brands.length} brands`);
    }

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

// Add this function to apply URL filters to the shop state
function applyUrlFilters() {
    const urlFilters = getUrlParams();

    console.log('🔗 Applying URL filters:', urlFilters);

    // Apply URL filters to shop state
    shopState.filters = { ...shopState.filters, ...urlFilters };

    // Update UI controls to match URL filters
    updateFilterControls();
}

// Function to update filter controls based on current filters
function updateFilterControls() {
    console.log('🎛️ Updating filter controls:', shopState.filters);

    // Update brand filter
    const brandSelect = document.getElementById('filterBrand');
    if (brandSelect && shopState.filters.brand) {
        brandSelect.value = shopState.filters.brand;
    }

    // Update category filter
    const categorySelect = document.getElementById('filterCategory');
    if (categorySelect && shopState.filters.category) {
        categorySelect.value = shopState.filters.category;
    }

    // Update search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput && shopState.filters.search) {
        searchInput.value = shopState.filters.search;
    }

    // Update stock filter
    const stockSelect = document.getElementById('filterStock');
    if (stockSelect) {
        if (shopState.filters.in_stock) {
            stockSelect.value = 'True';
        } else if (shopState.filters.in_stock === false) {
            stockSelect.value = 'False';
        } else {
            stockSelect.value = '';
        }
    }

    // Update price filters if you have them
    const priceMinInput = document.getElementById('filterPriceMin');
    const priceMaxInput = document.getElementById('filterPriceMax');
    if (priceMinInput && shopState.filters.price_min) {
        priceMinInput.value = shopState.filters.price_min;
    }
    if (priceMaxInput && shopState.filters.price_max) {
        priceMaxInput.value = shopState.filters.price_max;
    }
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

        populateDesktopFilters();

        // Apply URL filters after data is loaded and UI is populated
        applyUrlFilters();

        // Now load products with the applied filters
        await loadProducts();

    } catch (error) {
        console.error('❌ Failed to load shop data:', error);
        showNotification('Failed to load products', 'error');
    }
}

// Event handlers
function setupShopEvents() {
    console.log('🛠️ Setting up shop events...');

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            shopState.currentPage = 1;
            shopState.filters.search = searchInput.value;
            applyFilters();
        }, 500));
    }

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreProducts);
    }

    const clearButton = document.getElementById('clearButton');
    if (clearButton) {
        clearButton.addEventListener('click', clearFilters);
    }

    const mobileClearFilters = document.getElementById('mobileClearFilters');
    if (mobileClearFilters) {
        mobileClearFilters.addEventListener('click', clearFilters);
    }

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

// Global exports
window.clearFilters = clearFilters;
window.applyFilters = applyFilters;
window.loadMoreProducts = loadMoreProducts;
window.clearVehicleSelection = clearVehicleSelection;

// Initialize shop
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛍️ Initializing shop...');

    try {
        // First setup vehicle filters (reads from URL)
        await setupVehicleFilters();

        // Then load shop data and apply all filters
        await loadShopData();

        // Finally setup event handlers
        setupShopEvents();

        console.log('✅ Shop fully initialized with URL filters applied');

    } catch (error) {
        console.error('❌ Shop initialization failed:', error);
        showNotification('Failed to initialize shop', 'error');
    }
});
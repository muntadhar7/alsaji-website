class AlSajiAPI {
    constructor() {
        this.baseURL = 'https://alsajigroup-staging-24665929.dev.odoo.com/';
        this.useMockData = false;
        this.mockDelay = 100;
        this.cache = new Map();
        this.cacheExpiry = new Map();

        // Static data storage
        this.staticData = {
            products: null,
            categories: null,
            brands: null,
            branches: null
        };

        // Cache durations in milliseconds
        this.CACHE_DURATIONS = {
            PRODUCTS: 5 * 60 * 1000, // 5 minutes
            CATEGORIES: 30 * 60 * 1000, // 30 minutes
            BRANDS: 30 * 60 * 1000, // 30 minutes
            BRANCHES: 60 * 60 * 1000, // 60 minutes
            SEARCH: 2 * 60 * 1000, // 2 minutes
            CART: 10 * 1000, // 10 seconds (short for cart)
            SUGGESTIONS: 1 * 60 * 1000 // 1 minute
        };
    }

    // Load static data from JSON files
    async loadStaticData() {
        try {
            console.log('📁 Loading static data from /data folder...');

            const [products, categories, brands, branches] = await Promise.all([
                this.fetchJSON('/alsaji-website/data/json/products.json'),
                this.fetchJSON('/alsaji-website/data/json/categories.json'),
                this.fetchJSON('/alsaji-website/data/json/brands.json'),
                this.fetchJSON('/alsaji-website/data/json/branches.json')
            ]);

            this.staticData = {
                products: products || [],
                categories: categories || [],
                brands: brands || [],
                branches: branches || []
            };

            console.log('✅ Static data loaded:', {
                products: this.staticData.products.length,
                categories: this.staticData.categories.length,
                brands: this.staticData.brands.length,
                branches: this.staticData.branches.length
            });

            return this.staticData;
        } catch (error) {
            console.error('❌ Failed to load static data:', error);
            // Return empty data if files can't be loaded
            return {
                products: [],
                categories: [],
                brands: [],
                branches: []
            };
        }
    }

    // Helper to fetch JSON files
    async fetchJSON(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`Could not load ${url}:`, error.message);
            return null;
        }
    }

    // Client-side filtering for products
    filterProducts(products, filters = {}) {
        if (!products || !Array.isArray(products)) return [];

        return products.filter(product => {
            // Brand filter
            if (filters.brand) {
                const productBrand = this.getFieldValue(product, 'brand');
                if (productBrand !== filters.brand) return false;
            }

            // Category filter
            if (filters.category) {
                const productCategory = this.getFieldValue(product, 'category');
                if (productCategory !== filters.category) return false;
            }

            // Search filter
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                const searchableText = [
                    product.name,
                    this.getFieldValue(product, 'brand'),
                    this.getFieldValue(product, 'category'),
                    product.description || ''
                ].join(' ').toLowerCase();

                if (!searchableText.includes(searchTerm)) return false;
            }

            // In stock filter
            if (filters.in_stock !== undefined && filters.in_stock !== '') {
                if (Boolean(product.in_stock) !== Boolean(filters.in_stock)) return false;
            }

            return true;
        });
    }

    // Helper to safely get field values (handles both objects and strings)
    getFieldValue(item, field) {
        const value = item[field];
        if (typeof value === 'object' && value !== null) {
            return value.name || String(value);
        }
        return String(value || '');
    }

    // Paginate results
    paginateResults(results, limit = 12, offset = 0) {
        if (!results || !Array.isArray(results)) return [];
        return results.slice(offset, offset + limit);
    }

    // Generate search suggestions
    generateSearchSuggestions(products, query) {
        if (!query || query.length < 2) return [];

        const searchTerms = new Set();
        const lowerQuery = query.toLowerCase();

        products.forEach(product => {
            const fields = [
                product.name,
                this.getFieldValue(product, 'brand'),
                this.getFieldValue(product, 'category')
            ];

            fields.forEach(field => {
                if (field.toLowerCase().includes(lowerQuery)) {
                    searchTerms.add(field);
                }
            });
        });

        return Array.from(searchTerms).slice(0, 10); // Limit to 10 suggestions
    }

    // Cache management methods (kept for compatibility)
    _getCacheKey(endpoint, params = {}) {
        return `${endpoint}:${JSON.stringify(params)}`;
    }

    _setCache(key, data, duration) {
        const expiry = Date.now() + duration;
        this.cache.set(key, data);
        this.cacheExpiry.set(key, expiry);
    }

    _getCache(key) {
        const expiry = this.cacheExpiry.get(key);
        if (expiry && Date.now() > expiry) {
            this.cache.delete(key);
            this.cacheExpiry.delete(key);
            return null;
        }
        return this.cache.get(key) || null;
    }

    _clearCacheByPrefix(prefix) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                this.cacheExpiry.delete(key);
            }
        }
    }

    // Main request method - now works with static data for products, real API for cart
    async request(endpoint, params = {}, cacheDuration = null) {
        // Ensure static data is loaded for product-related endpoints
        if (endpoint.includes('/products') || endpoint.includes('/categories') ||
            endpoint.includes('/brands') || endpoint.includes('/branches') ||
            endpoint.includes('/search')) {

            if (!this.staticData.products) {
                await this.loadStaticData();
            }
        }

        // Check cache first
        if (cacheDuration) {
            const cacheKey = this._getCacheKey(endpoint, params);
            const cached = this._getCache(cacheKey);
            if (cached) {
                console.log(`📦 Cache HIT: ${endpoint}`);
                return cached;
            }
        }

        if (this.useMockData) {
            await this.delay();
            return this.mockRequest(endpoint, params);
        }

        try {
            console.log(`🔄 Processing: ${endpoint}`, params);

            let result;

            // Handle different endpoints - static data for products, real API for cart
            switch (endpoint) {
                case '/api/alsaji/products':
                    const filteredProducts = this.filterProducts(this.staticData.products, params);
                    const totalCount = filteredProducts.length;
                    const limit = parseInt(params.limit) || 12;
                    const offset = parseInt(params.offset) || 0;
                    const paginatedProducts = this.paginateResults(filteredProducts, limit, offset);

                    result = {
                        success: true,
                        products: paginatedProducts,
                        total_count: totalCount,
                        count: paginatedProducts.length,
                        filters_used: params
                    };
                    break;

                case '/api/alsaji/categories':
                    result = {
                        success: true,
                        categories: this.staticData.categories
                    };
                    break;

                case '/api/alsaji/brands':
                    result = {
                        success: true,
                        brands: this.staticData.brands
                    };
                    break;

                case '/api/alsaji/branches':
                    result = {
                        success: true,
                        branches: this.staticData.branches
                    };
                    break;

                case '/api/alsaji/search/suggest':
                    const suggestions = this.generateSearchSuggestions(this.staticData.products, params.q);
                    result = {
                        success: true,
                        suggestions: suggestions
                    };
                    break;

                default:
                    // For cart endpoints, use real API
                    return await this.makeRealAPIRequest(endpoint, params, cacheDuration);
            }

            console.log(`✅ Processed: ${endpoint}`, {
                resultCount: result.products ? result.products.length :
                           result.categories ? result.categories.length :
                           result.brands ? result.brands.length :
                           result.branches ? result.branches.length :
                           result.suggestions ? result.suggestions.length : 0
            });

            // Cache the response
            if (cacheDuration) {
                const cacheKey = this._getCacheKey(endpoint, params);
                this._setCache(cacheKey, result, cacheDuration);
            }

            return result;

        } catch (error) {
            console.error('❌ Request failed:', error);
            // Return empty result instead of throwing to maintain compatibility
            return {
                success: false,
                error: error.message,
                products: [],
                categories: [],
                brands: [],
                branches: [],
                suggestions: []
            };
        }
    }

    // Real API request for cart and other dynamic endpoints
    async makeRealAPIRequest(endpoint, params = {}, cacheDuration = null) {
        try {
            const url = new URL(`${this.baseURL}${endpoint}`);
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    url.searchParams.append(key, params[key]);
                }
                url.searchParams.append('db', 'alsaji_copy');
            });

            console.log(`🌐 Real API Request: ${url.toString()}`);

            const response = await fetch(url, {
                credentials: 'include',
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                mode: 'cors'
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`🌐 Real API Response:`, data);

            // Cache the response
            if (cacheDuration) {
                const cacheKey = this._getCacheKey(endpoint, params);
                this._setCache(cacheKey, data, cacheDuration);
            }

            return data;
        } catch (error) {
            console.error('Real API Request failed:', error);
            throw error;
        }
    }

    // POST requests - real API for cart, static for others
    async postRequest(endpoint, data = {}, invalidateCache = []) {
        // Invalidate cache for specified endpoints
        invalidateCache.forEach(prefix => {
            this._clearCacheByPrefix(prefix);
        });

        if (this.useMockData) {
            await this.delay();
            return this.mockPostRequest(endpoint, data);
        }

        // Use real API for cart operations
        if (endpoint.includes('/cart') || endpoint.includes('/order')) {
            return await this.makeRealAPIPostRequest(endpoint, data, invalidateCache);
        }

        // For non-cart endpoints, use simulation
        try {
            console.log(`🔄 POST Processing: ${endpoint}`, data);

            let result;

            // Simulate POST operations for non-cart endpoints
            switch (endpoint) {
                // Add other non-cart endpoints here if needed
                default:
                    result = {
                        success: true,
                        message: `Operation completed for ${endpoint} (simulated)`
                    };
            }

            console.log(`✅ POST Processed: ${endpoint}`, result);
            return result;

        } catch (error) {
            console.error('❌ POST Request failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Real API POST request for cart operations
    async makeRealAPIPostRequest(endpoint, data = {}, invalidateCache = []) {
    try {
        const url = `${this.baseURL}${endpoint}`;

        console.log(`🌐 Real API POST Request: ${url}`, data);

        // First, check if we need to handle OPTIONS preflight
        await this.handlePreflightRequest(url);

        const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Cookie': 'db=alsaji_copy'
            },
            body: JSON.stringify(data)
        });

        console.log(`🌐 Response status: ${response.status} ${response.statusText}`);

        // Handle CORS and network errors
        if (response.type === 'opaque' || response.status === 0) {
            throw new Error('CORS policy blocked the request. Check server CORS configuration.');
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log(`✅ Real API POST Success:`, result);
        return result;

    } catch (error) {
        console.error('❌ Real API POST Request failed:', error);

        // More specific error handling
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
            throw new Error(`CORS Error: Cannot connect to API. Make sure the server is running and CORS is configured. Details: ${error.message}`);
        }

        throw error;
    }
}

    async handlePreflightRequest(url) {
    // Check if we need to handle OPTIONS preflight
    try {
        const optionsResponse = await fetch(url, {
            method: 'OPTIONS',
            credentials: 'include',
            headers: {
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type',
            }
        });

        if (!optionsResponse.ok) {
            console.warn('⚠️ OPTIONS preflight failed, but continuing with POST...');
        }
    } catch (preflightError) {
        console.warn('⚠️ OPTIONS preflight error:', preflightError);
        // Continue with POST anyway
    }
}

    // Product methods with caching (static data)
    async getProducts(filters = {}) {
        return this.request('/api/alsaji/products', filters, this.CACHE_DURATIONS.PRODUCTS);
    }

    async getFeaturedProducts(limit = 8) {
        return this.getProducts({ limit });
    }

    async getCategories() {
        return this.request('/api/alsaji/categories', {}, this.CACHE_DURATIONS.CATEGORIES);
    }

    async getBrands() {
        return this.request('/api/alsaji/brands', {}, this.CACHE_DURATIONS.BRANDS);
    }

    async getBranches() {
        return this.request('/api/alsaji/branches', {}, this.CACHE_DURATIONS.BRANCHES);
    }

    async searchProducts(query) {
        if (!query) return this.getProducts();
        return this.request('/api/alsaji/products', { search: query }, this.CACHE_DURATIONS.SEARCH);
    }

    async getSearchSuggestions(query) {
        if (query.length < 2) return [];
        return this.request('/api/alsaji/search/suggest', { q: query }, this.CACHE_DURATIONS.SUGGESTIONS);
    }

    // Cart methods with cache invalidation (REAL API)
    async addToCart(productId, quantity = 1) {
        // Get cart ID from localStorage or create new
        let cartId = localStorage.getItem('cart_id');
        
        return this.postRequest('/api/alsaji/cart/add', {
            product_id: parseInt(productId),
            quantity: parseInt(quantity),
            cart_id: cartId // Send cart ID with request
        }, ['/api/alsaji/cart']);
    }

// After successful cart creation, save cart ID
// localStorage.setItem('cart_id', response.order_id);

    async getCart() {
        // Use real API for cart, but with short cache
        return this.request('/api/alsaji/cart/get', {}, this.CACHE_DURATIONS.CART);
    }

    async updateCart(lineId, quantity) {
        return this.postRequest('/api/alsaji/cart/update', {
            line_id: lineId,
            quantity: quantity
        }, ['/api/alsaji/cart']);
    }

    async removeFromCart(lineId) {
        return this.postRequest('/api/alsaji/cart/remove', {
            line_id: lineId
        }, ['/api/alsaji/cart']);
    }

    async clearCart() {
        return this.postRequest('/api/alsaji/cart/clear', {}, ['/api/alsaji/cart']);
    }

    async placeOrder(orderData) {
        return this.postRequest('/api/alsaji/order/place', orderData, [
            '/api/alsaji/cart',
            '/api/alsaji/order'
        ]);
    }

    // Cache management methods
    clearAllCache() {
        this.cache.clear();
        this.cacheExpiry.clear();
        console.log('🗑️ All cache cleared');
    }

    clearProductCache() {
        this._clearCacheByPrefix('/api/alsaji/products');
        this._clearCacheByPrefix('/api/alsaji/categories');
        this._clearCacheByPrefix('/api/alsaji/brands');
        console.log('🗑️ Product cache cleared');
    }

    clearCartCache() {
        this._clearCacheByPrefix('/api/alsaji/cart');
        console.log('🗑️ Cart cache cleared');
    }

    getCacheStats() {
        return {
            totalCached: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    // Static data management
    async reloadStaticData() {
        console.log('🔄 Reloading static data...');
        this.staticData = {
            products: null,
            categories: null,
            brands: null,
            branches: null
        };
        this.clearAllCache();
        return await this.loadStaticData();
    }

    getStaticDataStats() {
        return {
            products: this.staticData.products ? this.staticData.products.length : 0,
            categories: this.staticData.categories ? this.staticData.categories.length : 0,
            brands: this.staticData.brands ? this.staticData.brands.length : 0,
            branches: this.staticData.branches ? this.staticData.branches.length : 0
        };
    }

    // Mock data methods
    delay() {
        return new Promise(resolve => setTimeout(resolve, this.mockDelay));
    }

    mockRequest(endpoint, params) {
        console.log('Mock request:', endpoint, params);
        return Promise.resolve({ mock: true, endpoint, params });
    }

    mockPostRequest(endpoint, data) {
        console.log('Mock POST request:', endpoint, data);
        return Promise.resolve({ success: true, mock: true, endpoint, data });
    }
}

// Create global instance
const alsajiAPI = new AlSajiAPI();

// Auto-load static data when the API is created
alsajiAPI.loadStaticData().then(() => {
    console.log('🚀 AlSajiAPI ready with static data + real cart API');
}).catch(error => {
    console.error('❌ Failed to initialize AlSajiAPI:', error);
});

async function testJSSession() {
  console.log('Testing JavaScript session...');

  try {
    const response = await fetch('http://localhost:8069/api/alsaji/debug-routes', {
      credentials: 'include'
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (response.ok) {
      const data = await response.json();
      console.log('SUCCESS:', data);
      return true;
    } else {
      console.error('FAILED:', response.status, await response.text());
      return false;
    }
  } catch (error) {
    console.error('ERROR:', error);
    return false;
  }
}

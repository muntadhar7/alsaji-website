class AlSajiAPI {
    constructor() {
        this.baseURL = 'http://localhost:8888';
        this.useMockData = false;
        this.mockDelay = 100;
        this.cache = new Map();
        this.cacheExpiry = new Map();

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

    // Cache management methods
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
            // Cache expired
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

    async request(endpoint, params = {}, cacheDuration = null) {
        // Check cache first
        if (cacheDuration) {
            const cacheKey = this._getCacheKey(endpoint, params);
            const cached = this._getCache(cacheKey);
            if (cached) {
                console.log(`API Cache HIT: ${endpoint}`);
                return cached;
            }
        }

        if (this.useMockData) {
            await this.delay();
            return this.mockRequest(endpoint, params);
        }

        try {
            const url = new URL(`${this.baseURL}${endpoint}`);
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    url.searchParams.append(key, params[key]);
                }
            });

            console.log(`API Request: ${url.toString()}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // This is crucial for sending cookies
                mode: 'cors'
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`API Response:`, data);

            // Cache the response
            if (cacheDuration) {
                const cacheKey = this._getCacheKey(endpoint, params);
                this._setCache(cacheKey, data, cacheDuration);
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    async postRequest(endpoint, data = {}, invalidateCache = []) {
        // Invalidate cache for specified endpoints
        invalidateCache.forEach(prefix => {
            this._clearCacheByPrefix(prefix);
        });

        if (this.useMockData) {
            await this.delay();
            return this.mockPostRequest(endpoint, data);
        }

        try {
            const url = `${this.baseURL}${endpoint}`;

            console.log(`API POST Request: ${url}`, data);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'http://localhost:8000',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(data),
                credentials: 'include',
                mode: 'cors'
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`API POST Response:`, result);
            return result;
        } catch (error) {
            console.error('API POST Request failed:', error);
            throw error;
        }
    }

    // Product methods with caching
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

    // Cart methods with cache invalidation
    async addToCart(productId, quantity = 1) {
        return this.postRequest('/api/alsaji/cart/add', {
            product_id: productId,
            quantity: quantity
        }, ['/api/alsaji/cart']); // Invalidate cart cache
    }

    async getCart() {
        // Cart has very short cache since it changes frequently
        return this.request('/api/alsaji/cart/get', {}, this.CACHE_DURATIONS.CART);
    }

    async updateCart(lineId, quantity) {
        return this.postRequest('/api/alsaji/cart/update', {
            line_id: lineId,
            quantity: quantity
        }, ['/api/alsaji/cart']); // Invalidate cart cache
    }

    async removeFromCart(lineId) {
        return this.postRequest('/api/alsaji/cart/remove', {
            line_id: lineId
        }, ['/api/alsaji/cart']); // Invalidate cart cache
    }

    async clearCart() {
        return this.postRequest('/api/alsaji/cart/clear', {}, ['/api/alsaji/cart']); // Invalidate cart cache
    }

    async placeOrder(orderData) {
        return this.postRequest('/api/alsaji/order/place', orderData, [
            '/api/alsaji/cart',
            '/api/alsaji/order'
        ]); // Invalidate cart and order cache
    }

    // Cache management methods
    clearAllCache() {
        this.cache.clear();
        this.cacheExpiry.clear();
        console.log('All cache cleared');
    }

    clearProductCache() {
        this._clearCacheByPrefix('/api/alsaji/products');
        this._clearCacheByPrefix('/api/alsaji/categories');
        this._clearCacheByPrefix('/api/alsaji/brands');
        console.log('Product cache cleared');
    }

    clearCartCache() {
        this._clearCacheByPrefix('/api/alsaji/cart');
        console.log('Cart cache cleared');
    }

    getCacheStats() {
        return {
            totalCached: this.cache.size,
            keys: Array.from(this.cache.keys())
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
class AlSajiAPI {  // ← Change to uppercase 'A'
    constructor() {
        this.baseURL = 'http://localhost:8888';
        this.useMockData = false; // ← Change to false to use real Odoo data
        this.mockDelay = 100;
    }

    async request(endpoint, params = {}) {
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
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`API Response:`, data);
            return data;
        } catch (error) {
            console.error('API Request failed:', error);

        }
    }

    async postRequest(endpoint, data = {}) {
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
            },
            body: JSON.stringify(data),
            credentials: 'include', // Include credentials for session
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

    }
}








    // Real API methods
    async getProducts(filters = {}) {
        return this.request('/api/alsaji/products', filters);
    }

    async getFeaturedProducts(limit = 8) {
        return this.getProducts({ limit });
    }

    async getCategories() {
        return this.request('/api/alsaji/categories');
    }

    async getBrands() {
        return this.request('/api/alsaji/brands');
    }

    async getBranches() {
        return this.request('/api/alsaji/branches');
    }

    async searchProducts(query) {
        return this.getProducts({ search: query });
    }

    async getSearchSuggestions(query) {
        if (query.length < 2) return [];
        return this.request('/api/alsaji/search/suggest', { q: query });
    }

    async addToCart(productId, quantity = 1) {
        return this.postRequest('/api/alsaji/cart/add', {
            product_id: productId,
            quantity: quantity
        });
    }
}

// Create global instance
const alsajiAPI = new AlSajiAPI();
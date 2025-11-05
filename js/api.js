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
            // Fallback to mock data if API fails
            console.log('Falling back to mock data...');
            await this.delay();
            return this.mockRequest(endpoint, params);
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
        console.log('Falling back to mock data...');
        await this.delay();
        return this.mockPostRequest(endpoint, data);
    }
}

    // Mock methods (fallback)
    async delay(ms = this.mockDelay) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    mockRequest(endpoint, params) {
        // Your existing mock data methods here
        if (endpoint === '/api/alsaji/products') return this.getMockProducts(params);
        if (endpoint === '/api/alsaji/categories') return this.getMockCategories();
        if (endpoint === '/api/alsaji/brands') return this.getMockBrands();
        if (endpoint === '/api/alsaji/branches') return this.getMockBranches();
        return [];
    }

    mockPostRequest(endpoint, data) {
        if (endpoint === '/api/alsaji/cart/add') {
            return {
                success: true,
                cart_count: Math.floor(Math.random() * 10) + 1,
                message: 'Product added to cart successfully (mock)'
            };
        }
        return { success: false, error: 'Mock endpoint not implemented' };
    }

    // Enhanced mock data methods
    getMockCategories() {
        return [
            { id: 1, name: 'Brake System', product_count: 8 },
            { id: 2, name: 'Filtration', product_count: 12 },
            { id: 3, name: 'Suspension', product_count: 6 },
            { id: 4, name: 'Lubricants', product_count: 5 },
            { id: 5, name: 'Electrical', product_count: 7 },
            { id: 6, name: 'Engine Parts', product_count: 10 }
        ];
    }

    getMockBrands() {
        return [
            { id: 1, name: 'AISIN', product_count: 15 },
            { id: 2, name: 'DENSO', product_count: 12 },
            { id: 3, name: 'ADVICS', product_count: 8 },
            { id: 4, name: '555', product_count: 6 },
            { id: 5, name: 'CASP', product_count: 4 },
            { id: 6, name: 'BOSCH', product_count: 9 }
        ];
    }

    getMockProducts(filters = {}) {
        let products = [
            {
                id: 1,
                name: 'Front Brake Pad Set - Toyota Corolla',
                price: 38500,
                brand: 'AISIN',
                oe_reference: '04465-0K390',
                in_stock: true,
                category: 'Brake System',
                description: 'High-quality brake pads for Toyota vehicles',
                image_url: '',
                stock_quantity: 15
            },
            {
                id: 2,
                name: 'Oil Filter - Universal',
                price: 9500,
                brand: 'DENSO',
                oe_reference: '90915-YZZE1',
                in_stock: true,
                category: 'Filtration',
                description: 'High-performance oil filter',
                image_url: '',
                stock_quantity: 8
            },
            {
                id: 3,
                name: 'Tie Rod End - Hyundai',
                price: 24000,
                brand: '555',
                oe_reference: 'TRE-123',
                in_stock: false,
                category: 'Suspension',
                description: 'Durable tie rod end assembly',
                image_url: '',
                stock_quantity: 0
            },
            {
                id: 4,
                name: '0W20 Engine Oil',
                price: 1.0,
                brand: 'Generic',
                oe_reference: 'OIL-001',
                in_stock: false,
                category: 'Lubricants',
                description: 'High-quality engine oil',
                image_url: '',
                stock_quantity: 0
            },
            {
                id: 5,
                name: 'Air Filter',
                price: 12500,
                brand: 'CASP',
                oe_reference: 'AF-456',
                in_stock: true,
                category: 'Filtration',
                description: 'Premium air filter',
                image_url: '',
                stock_quantity: 12
            },
            {
                id: 6,
                name: 'Spark Plug Set',
                price: 35000,
                brand: 'BOSCH',
                oe_reference: 'SP-789',
                in_stock: true,
                category: 'Engine Parts',
                description: 'High-performance spark plugs',
                image_url: '',
                stock_quantity: 20
            }
        ];

        // Apply filters
        if (filters.category) {
            products = products.filter(p => p.category.toLowerCase().includes(filters.category.toLowerCase()));
        }
        if (filters.brand) {
            products = products.filter(p => p.brand.toLowerCase().includes(filters.brand.toLowerCase()));
        }
        if (filters.search) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(filters.search.toLowerCase()) ||
                p.oe_reference.toLowerCase().includes(filters.search.toLowerCase())
            );
        }
        if (filters.in_stock) {
            products = products.filter(p => p.in_stock);
        }
        if (filters.limit) {
            products = products.slice(0, parseInt(filters.limit));
        }

        return products;
    }

    getMockBranches() {
        return [
            {
                id: 1,
                name: 'Baghdad - Palestine St.',
                address: 'Palestine Street, Baghdad',
                phone: '+964 770 123 4567',
                opening_hours: '9:00 AM - 8:00 PM'
            },
            {
                id: 2,
                name: 'Erbil - Ganjan City',
                address: 'Ganjan City, Erbil',
                phone: '+964 750 123 4567',
                opening_hours: '9:00 AM - 8:00 PM'
            }
        ];
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
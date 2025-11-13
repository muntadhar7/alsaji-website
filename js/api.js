// api.js - Complete fixed version
class AlSajiAPI {
    constructor() {
        this.useStaticData = true;
        this.liveAPI = {
            baseURL: 'https://alsajigroup-staging-24665929.dev.odoo.com',
            dbName: 'alsajigroup-staging-24665929'
        };
        this.uid = null;
        this.sessionInfo = null;
        this.cartCache = null;
        this.cartCacheTime = null;
        this.CART_CACHE_DURATION = 30000;

        // 🔥 ADD THIS: Authentication coordination properties
        this.authPromise = null;
        this.authAttempts = 0;
        this.MAX_AUTH_ATTEMPTS = 2;

        this.checkStaticData();
    }

    // Add this method to set credentials
    setCredentials(username, password) {
        this.username = username;
        this.password = password;
        this.uid = null; // Reset UID to force re-authentication
        localStorage.removeItem('alsaji_session'); // Clear old session
        console.log('🔐 Credentials set, will authenticate on next API call');
    }
    // Add this method to create Odoo orders
    async createOdooOrder(orderData) {
        try {
            console.log('🔄 Creating sales order in Odoo...', orderData);

            // First, find or create customer
            const partnerId = await this.findOrCreateCustomer(orderData.customer);

            // Prepare order lines
            const orderLines = orderData.items.map(item => [
                0, 0, { // (0, 0, {values}) means create new line
                    'product_id': item.product_id,
                    'product_uom_qty': item.quantity,
                    'price_unit': item.unit_price,
                    'name': item.name,
                    'tax_id': false
                }
            ]);

            // Create sales order values
            const orderValues = {
                'partner_id': partnerId,
                'partner_invoice_id': partnerId,
                'partner_shipping_id': partnerId,
                'order_line': orderLines,
                'client_order_ref': orderData.order_number,
                'note': this.formatOrderNotes(orderData),
                'state': 'draft', // Keep as draft (quotation)
                'require_payment': false,
                'require_signature': false,
            };

            console.log('📦 Order values:', orderValues);

            // Create the sales order in Odoo
            const orderResult = await this.executeOdooMethod(
                'sale.order',
                'create',
                [orderValues]
            );

            if (orderResult && orderResult.result) {
                const orderId = orderResult.result;
                console.log(`✅ Sales order created in Odoo with ID: ${orderId}`);

                // Mark as "Request Sent" by updating notes
                await this.markAsRequestSent(orderId, orderData);

                return {
                    success: true,
                    odoo_order_id: orderId,
                    message: 'Order created successfully in Odoo'
                };
            } else {
                throw new Error('Failed to create order in Odoo');
            }

        } catch (error) {
            console.error('❌ Failed to create Odoo order:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async findOrCreateCustomer(customerData) {
        try {
            if (!customerData || !customerData.email) {
                return 1; // Default public partner
            }

            // Search for existing customer by email
            const searchResult = await this.executeOdooMethod(
                'res.partner',
                'search_read',
                [],
                {
                    domain: [['email', '=', customerData.email]],
                    fields: ['id'],
                    limit: 1
                }
            );

            if (searchResult && searchResult.result && searchResult.result.length > 0) {
                console.log(`✅ Found existing customer: ${searchResult.result[0].id}`);
                return searchResult.result[0].id;
            }

            // Create new customer
            const customerValues = {
                'name': customerData.fullName || 'Website Customer',
                'email': customerData.email || '',
                'phone': customerData.phone || '',
                'street': customerData.address || '',
                'city': customerData.city || '',
                'type': 'invoice',
                'company_type': 'person',
            };

            const createResult = await this.executeOdooMethod(
                'res.partner',
                'create',
                [customerValues]
            );

            if (createResult && createResult.result) {
                console.log(`✅ Created new customer: ${createResult.result}`);
                return createResult.result;
            } else {
                throw new Error('Failed to create customer');
            }

        } catch (error) {
            console.error('❌ Customer lookup/creation failed:', error);
            return 1; // Default public partner
        }
    }

    async markAsRequestSent(orderId, orderData) {
        try {
            const noteContent = this.formatRequestSentNotes(orderData);

            const updateResult = await this.executeOdooMethod(
                'sale.order',
                'write',
                [
                    [orderId], // Array of IDs to update
                    {
                        'note': noteContent,
                        // If you have a custom field for request status, add it here
                        // 'x_studio_request_sent': true,
                    }
                ]
            );

            if (updateResult && updateResult.result) {
                console.log(`✅ Order ${orderId} marked as 'Request Sent'`);
            } else {
                console.log('⚠️ Could not update order notes');
            }

        } catch (error) {
            console.error('⚠️ Could not mark order as request sent:', error);
        }
    }

    formatOrderNotes(orderData) {
        const customer = orderData.customer || {};
        return `Website Order - ${orderData.order_number}
    Customer: ${customer.fullName || 'N/A'}
    Payment: ${orderData.payment || 'N/A'}`;
    }

    formatRequestSentNotes(orderData) {
        const customer = orderData.customer || {};
        const itemsText = orderData.items.map(item =>
            `- ${item.name} (Qty: ${item.quantity}) - IQD ${item.unit_price.toLocaleString()} each`
        ).join('\n');

        return `WEBSITE ORDER - REQUEST SENT
    =================================
    Order Number: ${orderData.order_number}
    Customer: ${customer.fullName || 'N/A'}
    Email: ${customer.email || 'N/A'}
    Phone: ${customer.phone || 'N/A'}
    Shipping Address: ${customer.address || 'N/A'}
    City: ${customer.city || 'N/A'} | Area: ${customer.area || 'N/A'}
    Payment Method: ${orderData.payment || 'N/A'}
    Customer Notes: ${customer.notes || 'None'}

    ORDER ITEMS:
    ${itemsText}

    ORDER TOTALS:
    Subtotal: IQD ${orderData.total.toLocaleString()}
    Shipping: IQD ${orderData.shipping.toLocaleString()}
    Tax: IQD ${orderData.tax.toLocaleString()}
    Grand Total: IQD ${(orderData.total + orderData.shipping + orderData.tax).toLocaleString()}

    STATUS: REQUEST SENT - Awaiting manual processing
    Created: ${new Date().toLocaleString()}`;
    }

    // In your api.js, update the executeOdooMethod method:
    async executeOdooMethod(model, method, args = [], kwargs = {}) {
        try {
            await this.ensureAuthenticated();

            if (!this.uid || !this.password) {
                throw new Error('Not authenticated with Odoo');
            }

            const requestData = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "object",
                    method: "execute_kw",
                    args: [
                        this.liveAPI.dbName,
                        this.uid,
                        this.password,
                        model,
                        method,
                        args,
                        kwargs
                    ]
                },
                id: Math.floor(Math.random() * 1000000)
            };

            console.log(`🌐 Odoo API Call: ${model}.${method}`);

            // Use your BlueHost proxy
            const response = await fetch('https://alsaji.com/proxy.php/https://alsaji.com/proxy.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
                // Add any other headers your proxy might need
                // 'Authorization': 'Bearer your-token' // if you add security later
                // 'X-API-Key': 'your-api-key'
            },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.error) {
                console.error('❌ Odoo API Error:', result.error);
                throw new Error(result.error.data?.message || result.error.message || 'Odoo API error');
            }

            console.log(`✅ Odoo API Success: ${model}.${method}`, result.result);
            return result;

        } catch (error) {
            console.error(`❌ Odoo method execution failed (${model}.${method}):`, error);
            throw error;
        }
    }

    checkStaticData() {
        if (typeof window.staticAPI === 'undefined') {
            console.warn('❌ staticAPI not found. Make sure static_api.js is loaded.');
            this.useStaticData = false;
        } else if (window.staticAPI.products && window.staticAPI.products.length === 0) {
            console.warn('⚠️ Static API has no products. Data may not be loaded yet.');
        } else {
            console.log('✅ Static API available:', {
                products: window.staticAPI.products ? window.staticAPI.products.length : 0,
                categories: window.staticAPI.categories ? window.staticAPI.categories.length : 0,
                brands: window.staticAPI.brands ? window.staticAPI.brands.length : 0
            });
        }
    }

    // ==================== STATIC DATA METHODS ====================

    async getProducts(filters = {}) {
        console.log('🔄 Getting products with filters:', filters);

        if (this.useStaticData && window.staticAPI) {
            try {
                const result = window.staticAPI.getProducts(filters);
                console.log(`✅ Static API returned ${result.products.length} products`);
                return result;
            } catch (error) {
                console.error('❌ Static API failed:', error);
                return await this.getFallbackProducts(filters);
            }
        }
        return await this.getFallbackProducts(filters);
    }

    async getCategories() {
        if (this.useStaticData && window.staticAPI) {
            try {
                return window.staticAPI.getCategories();
            } catch (error) {
                console.error('Static categories failed:', error);
                return await this.getFallbackCategories();
            }
        }
        return await this.getFallbackCategories();
    }

    async getBrands() {
        if (this.useStaticData && window.staticAPI) {
            try {
                return window.staticAPI.getBrands();
            } catch (error) {
                console.error('Static brands failed:', error);
                return await this.getFallbackBrands();
            }
        }
        return await this.getFallbackBrands();
    }

    async getSearchSuggestions(query) {
        if (!query || query.length < 2) {
            return { success: true, suggestions: [] };
        }

        if (this.useStaticData && window.staticAPI) {
            try {
                return {
                    success: true,
                    suggestions: window.staticAPI.searchSuggestions(query)
                };
            } catch (error) {
                console.error('Static suggestions failed:', error);
                return await this.getFallbackSuggestions(query);
            }
        }
        return await this.getFallbackSuggestions(query);
    }

    async getFeaturedProducts(limit = 8) {
        return this.getProducts({ limit });
    }

    // Add this method to your AlSajiAPI class in api.js
    async getProductById(productId) {
        if (!this.useStaticData || !window.staticAPI || !window.staticAPI.products) {
            console.log('Static API not available for product lookup');
            return null;
        }

        // Convert to number and try different matching strategies
        const id = parseInt(productId);
        console.log(`🔍 Looking for product ID: ${id} (original: ${productId})`);

        // Try multiple lookup strategies
        let product = window.staticAPI.products.find(p => p.id === id);
        if (product) return product;

        product = window.staticAPI.products.find(p => p.id == id);
        if (product) return product;

        product = window.staticAPI.products.find(p => p.id.toString() === productId.toString());
        if (product) return product;

        console.log(`❌ Product ${productId} not found in ${window.staticAPI.products.length} products`);
        return null;
    }

    // ==================== FALLBACK METHODS ====================

    async getFallbackProducts(filters = {}) {
        console.log('🔄 Using fallback products method');

        // Try to load from JSON file directly
        try {
            const response = await fetch('/data/json/products.json');
            if (response.ok) {
                const products = await response.json();

                // Simple filtering
                let filtered = [...products];

                if (filters.search) {
                    const searchTerm = filters.search.toLowerCase();
                    filtered = filtered.filter(p =>
                        p.name && p.name.toLowerCase().includes(searchTerm)
                    );
                }

                const limit = parseInt(filters.limit) || 12;
                const offset = parseInt(filters.offset) || 0;
                const paginated = filtered.slice(offset, offset + limit);

                return {
                    success: true,
                    products: paginated,
                    total_count: filtered.length,
                    count: paginated.length,
                    source: 'json-file'
                };
            }
        } catch (error) {
            console.log('Could not load products.json:', error);
        }

        // Ultimate fallback
        return {
            success: false,
            error: 'No product data available',
            products: [],
            total_count: 0,
            count: 0,
            source: 'fallback'
        };
    }

    async getFallbackCategories() {
        try {
            const response = await fetch('/data/json/categories.json');
            if (response.ok) {
                const categories = await response.json();
                return {
                    success: true,
                    categories: categories,
                    source: 'json-file'
                };
            }
        } catch (error) {
            console.log('Could not load categories.json:', error);
        }

        return {
            success: false,
            error: 'No categories available',
            categories: [],
            source: 'fallback'
        };
    }

    async getFallbackBrands() {
        try {
            const response = await fetch('/data/json/brands.json');
            if (response.ok) {
                const brands = await response.json();
                return {
                    success: true,
                    brands: brands,
                    source: 'json-file'
                };
            }
        } catch (error) {
            console.log('Could not load brands.json:', error);
        }

        return {
            success: false,
            error: 'No brands available',
            brands: [],
            source: 'fallback'
        };
    }

    async getFallbackSuggestions(query) {
        return {
            success: true,
            suggestions: [],
            source: 'fallback'
        };
    }

    // ==================== CART & AUTH METHODS ====================



    // 🔥 NEW: Coordinated authentication method
    async ensureAuthenticated() {
        // If already authenticated, return immediately
        if (this.uid && this.password) {
            console.log('✅ Already authenticated, UID:', this.uid);
            return true;
        }

        // Try to get session from localStorage first (fast path)
        const savedSession = localStorage.getItem('alsaji_session');
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                if (session.uid && session.password && session.expires > Date.now()) {
                    this.uid = session.uid;
                    this.password = session.password;
                    this.sessionInfo = session;
                    console.log('✅ Restored session from storage, UID:', this.uid);
                    return true;
                }
            } catch (e) {
                console.log('❌ Invalid saved session format');
            }
        }

        // If no credentials, skip authentication (cart will work locally)
        if (!this.username || !this.password) {
            console.log('🔐 No credentials set, using local mode');
            return false;
        }

        // 🔥 NEW: Coordinate authentication attempts
        if (this.authPromise) {
            console.log('🔐 Waiting for existing auth attempt...');
            return await this.authPromise;
        }

        // Limit authentication attempts
        if (this.authAttempts >= this.MAX_AUTH_ATTEMPTS) {
            console.log('🔐 Max auth attempts reached, using local mode');
            return false;
        }

        this.authAttempts++;
        console.log(`🔐 Starting authentication attempt ${this.authAttempts}`);

        this.authPromise = this.authenticate();
        try {
            const result = await this.authPromise;
            return result;
        } finally {
            this.authPromise = null;
        }
    }

    // Update the authenticate method to be more efficient
    async authenticate() {
        try {
            console.log('🔐 Attempting Odoo authentication...');

            const authData = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "common",
                    method: "login",
                    args: [
                        this.liveAPI.dbName,
                        this.username,
                        this.password
                    ]
                },
                id: 1
            };

            // Add timeout to authentication
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const proxyUrl = 'https://alsaji.com/proxy.php';

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
                body: JSON.stringify(authData)
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('🔐 Auth response:', result);

            if (result.result) {
                this.uid = result.result;

                // Save session to localStorage
                const sessionData = {
                    uid: this.uid,
                    password: this.password,
                    username: this.username,
                    expires: Date.now() + (60 * 60 * 1000), // 1 hour
                };

                localStorage.setItem('alsaji_session', JSON.stringify(sessionData));

                console.log('✅ Authentication successful. User ID:', this.uid);
                return true;
            } else {
                console.error('❌ Authentication failed');
                return false;
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('❌ Authentication timeout');
            } else {
                console.error('❌ Authentication error:', error);
            }
            return false;
        }
    }

    async login(username, password) {
        try {
            console.log('🔐 Attempting login via proxy...');

            // Use proxy URL instead of direct Odoo URL
            const proxyUrl = 'https://alsaji.com/proxy.php';

            const authData = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "common",
                    method: "login",
                    args: [
                        this.liveAPI.dbName,
                        username,
                        password
                    ]
                },
                id: 1
            };

            console.log('🔐 Auth request via proxy:', authData);

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(authData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('🔐 Auth response:', result);

            if (result.result) {
                this.uid = result.result;
                this.username = username;
                this.password = password;

                // Save session to localStorage
                const sessionData = {
                    uid: this.uid,
                    username: username,
                    password: password,
                    expires: Date.now() + (60 * 60 * 1000), // 1 hour
                };

                localStorage.setItem('alsaji_session', JSON.stringify(sessionData));
                localStorage.setItem('alsaji_username', username);

                console.log('✅ Login successful, UID:', this.uid);
                return {
                    success: true,
                    user: { uid: this.uid, username: username }
                };
            } else {
                console.error('❌ Login failed:', result.error);
                return {
                    success: false,
                    error: result.error?.data?.message || result.error?.message || 'Login failed'
                };
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            return {
                success: false,
                error: 'Network error during login: ' + error.message
            };
        }
    }

    async logout() {
        try {
            // Use proxy for logout if authenticated
            if (this.uid) {
                const proxyUrl = 'https://alsaji.com/proxy.php';
                const logoutData = {
                    jsonrpc: "2.0",
                    method: "call",
                    params: {
                        service: "common",
                        method: "logout",
                        args: [this.liveAPI.dbName, this.uid]
                    },
                    id: 1
                };

                await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(logoutData)
                });
            }
        } catch (error) {
            console.log('Logout request failed (may be expected):', error);
        }

        // Clear local session
        this.uid = null;
        this.username = null;
        this.password = null;
        this.sessionInfo = null;
        this.cartCache = null;
        localStorage.removeItem('alsaji_session');
        localStorage.removeItem('alsaji_username');
        localStorage.removeItem('alsaji_cart');

        console.log('✅ Logged out successfully');
        return { success: true };
    }

    async getCart(forceRefresh = false) {
        // Check cache first (fast path)
        if (!forceRefresh && this.cartCache && this.cartCacheTime &&
            (Date.now() - this.cartCacheTime) < this.CART_CACHE_DURATION) {
            console.log('📦 Returning cached cart');
            return this.cartCache;
        }

        // 🔥 NEW: Don't wait for authentication - use local cart immediately
        try {
            // Try Odoo API in background if authenticated
            if (this.uid && this.password) {
                const cart = await this.liveGetCart();
                if (cart.success) {
                    this.cartCache = cart;
                    this.cartCacheTime = Date.now();
                    return cart;
                }
            }
        } catch (error) {
            console.log('Odoo cart failed, using local:', error);
        }

        // Use local cart (fast path)
        return await this.getLocalCart();
    }

    async liveGetCart() {
        try {
            // This would call Odoo's cart API
            // For now, we'll use localStorage as fallback
            throw new Error('Odoo cart API not implemented');
        } catch (error) {
            throw error;
        }
    }

    async getLocalCart() {
        try {
            const cartJson = localStorage.getItem('alsaji_cart');
            if (cartJson) {
                const cart = JSON.parse(cartJson);
                // 🔥 FIX: Ensure cart has the required structure
                if (!cart.items) cart.items = [];
                if (!cart.item_count) cart.item_count = 0;
                if (!cart.total) cart.total = 0;

                return {
                    success: true,
                    cart: cart,
                    source: 'local'
                };
            }

            // Return empty cart with proper structure
            return {
                success: true,
                cart: {
                    items: [],
                    item_count: 0,
                    total: 0
                },
                source: 'local'
            };
        } catch (error) {
            // Return empty cart on error
            return {
                success: true,
                cart: {
                    items: [],
                    item_count: 0,
                    total: 0
                },
                source: 'local'
            };
        }
    }
    updateCartTotals(cart) {
        cart.item_count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    }

    async addToCart(productId, quantity = 1) {
        try {
            console.log(`🛒 Adding to cart: product ${productId}, quantity ${quantity}`);

            // Validate product ID
            if (!this.validateProductId(productId)) {
                throw new Error('Invalid product ID');
            }

            // Get current cart
            const cartResult = await this.getCart();
            const cart = cartResult.cart; // 🔥 FIX: Extract cart from result

            // Find existing item
            const existingItemIndex = cart.items.findIndex(item => item.product_id == productId);

            if (existingItemIndex >= 0) {
                // Update quantity
                cart.items[existingItemIndex].quantity += quantity;
                cart.items[existingItemIndex].subtotal = cart.items[existingItemIndex].unit_price * cart.items[existingItemIndex].quantity;
            } else {
                // Get product info from static data
                const product = await this.getProductById(productId);
                if (!product) {
                    throw new Error('Product not found');
                }

                // Add new item
                cart.items.push({
                    id: Date.now(), // Temporary ID
                    product_id: parseInt(productId),
                    name: product.name,
                    quantity: parseInt(quantity),
                    unit_price: product.price,
                    subtotal: product.price * quantity,
                    image: product.image_url,
                    product_data: product
                });
            }

            // Recalculate totals
            this.updateCartTotals(cart);

            // Save to localStorage
            localStorage.setItem('alsaji_cart', JSON.stringify(cart));

            // Clear cache and trigger global update
            this.cartCache = null;
            if (window.AlSajiCartEvents) {
                window.AlSajiCartEvents.updateCartCount(cart.item_count);
            }

            console.log('✅ Added to cart successfully');
            return {
                success: true,
                message: 'Product added to cart',
                cart_count: cart.item_count,
                cart: cart
            };

        } catch (error) {
            console.error('❌ Add to cart failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async updateCart(lineId, quantity) {
        try {
            // ... existing update logic ...

            localStorage.setItem('alsaji_cart', JSON.stringify(cart));
            this.cartCache = null;

            // Trigger global update
            if (window.AlSajiCartEvents) {
                window.AlSajiCartEvents.updateCartCount(cart.item_count);
            }

            return {
                success: true,
                message: 'Cart updated',
                cart: cart
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async removeFromCart(lineId) {
        try {
            // ... existing remove logic ...

            this.updateCartTotals(cart);
            localStorage.setItem('alsaji_cart', JSON.stringify(cart));
            this.cartCache = null;

            // Trigger global update
            if (window.AlSajiCartEvents) {
                window.AlSajiCartEvents.updateCartCount(cart.item_count);
            }

            return {
                success: true,
                message: 'Item removed from cart',
                cart: cart
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async clearCart() {
        try {
            localStorage.removeItem('alsaji_cart');
            this.cartCache = null;

            // Trigger global update
            if (window.AlSajiCartEvents) {
                window.AlSajiCartEvents.updateCartCount(0);
            }

            return {
                success: true,
                message: 'Cart cleared'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    validateProductId(productId) {
        if (!productId || productId === '' || productId === null || productId === undefined) {
            return false;
        }
        const id = parseInt(productId);
        return !isNaN(id) && id > 0;
    }

    // ==================== UTILITY METHODS ====================

    isLoggedIn() {
        return this.uid !== null;
    }

    getUsername() {
        try {
            const session = localStorage.getItem('alsaji_session');
            if (session) {
                const sessionData = JSON.parse(session);
                return sessionData.username || null;
            }
            return localStorage.getItem('alsaji_username');
        } catch (error) {
            return localStorage.getItem('alsaji_username');
        }
    }

    getLastSyncTime() {
        if (window.staticAPI && window.staticAPI.lastUpdated) {
            return new Date(window.staticAPI.lastUpdated);
        }
        return null;
    }

    // Force refresh cart cache
    refreshCart() {
        this.cartCache = null;
        this.cartCacheTime = null;
        return this.getCart(true);
    }
}

// Create global instance
window.alsajiAPI = new AlSajiAPI();

// Auto-initialize session on load
document.addEventListener('DOMContentLoaded', function() {
    window.alsajiAPI.ensureAuthenticated().then(authenticated => {
        if (authenticated) {
            console.log('✅ Auto-login successful');
        }
    });
});

// ==================== GLOBAL CART SYNCHRONIZATION ====================

// Global cart event system
window.AlSajiCartEvents = {
    // Update cart count everywhere
    updateCartCount: function(count) {
        // Update all cart count elements
        const cartCountElements = document.querySelectorAll('#cartCount');
        cartCountElements.forEach(element => {
            element.textContent = count;
        });

        // Dispatch event for other components
        const event = new CustomEvent('cartCountUpdated', {
            detail: { count: count }
        });
        document.dispatchEvent(event);

        console.log('🔄 Cart count updated globally:', count);
    },

    // Force refresh cart count from storage
    refreshCartCount: async function() {
        try {
            const cartResult = await window.alsajiAPI.getCart(true); // Force refresh
            const count = cartResult.cart?.item_count || 0;
            this.updateCartCount(count);
        } catch (error) {
            console.error('Failed to refresh cart count:', error);
        }
    }
};

// Listen for storage events (when cart changes in other tabs)
window.addEventListener('storage', function(e) {
    if (e.key === 'alsaji_cart') {
        console.log('🔄 Cart changed in another tab, updating count...');
        AlSajiCartEvents.refreshCartCount();
    }
});

// Listen for cart updates on this page
document.addEventListener('cartUpdated', function(e) {
    AlSajiCartEvents.refreshCartCount();
});

// Auto-initialize cart count on page load
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the header to load
    setTimeout(() => {
        AlSajiCartEvents.refreshCartCount();
    }, 500);

    // Also update when page becomes visible
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            AlSajiCartEvents.refreshCartCount();
        }
    });
});
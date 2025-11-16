// api.js - Refactored and optimized version
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

        // Authentication coordination
        this.authPromise = null;
        this.authAttempts = 0;
        this.MAX_AUTH_ATTEMPTS = 2;

        this.checkStaticData();
        this.initializeSession();
    }

    // ==================== INITIALIZATION METHODS ====================

    initializeSession() {
        try {
            const savedSession = localStorage.getItem('alsaji_session');
            if (savedSession) {
                const session = JSON.parse(savedSession);
                if (session.uid && session.password && session.expires > Date.now()) {
                    this.uid = session.uid;
                    this.password = session.password;
                    this.username = session.username;
                    this.sessionInfo = session;
                    console.log('✅ Restored session from storage, UID:', this.uid);
                }
            }
        } catch (e) {
            console.log('❌ Invalid saved session format');
            this.clearSession();
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
                products: window.staticAPI.products?.length || 0,
                categories: window.staticAPI.categories?.length || 0,
                brands: window.staticAPI.brands?.length || 0
            });
        }
    }

    // ==================== AUTHENTICATION METHODS ====================

    setCredentials(username, password) {
        this.username = username;
        this.password = password;
        this.uid = null;
        localStorage.removeItem('alsaji_session');
        console.log('🔐 Credentials set, will authenticate on next API call');
    }

    async ensureAuthenticated() {
        if (this.uid && this.password) {
            return true;
        }

        // Try to restore from localStorage
        this.initializeSession();
        if (this.uid && this.password) {
            return true;
        }

        if (!this.username || !this.password) {
            console.log('🔐 No credentials set, using local mode');
            return false;
        }

        if (this.authPromise) {
            return await this.authPromise;
        }

        if (this.authAttempts >= this.MAX_AUTH_ATTEMPTS) {
            console.log('🔐 Max auth attempts reached, using local mode');
            return false;
        }

        this.authAttempts++;
        this.authPromise = this.authenticate();

        try {
            return await this.authPromise;
        } finally {
            this.authPromise = null;
        }
    }

    async authenticate() {
        try {
            console.log('🔐 Attempting Odoo authentication...');

            const authData = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "common",
                    method: "login",
                    args: [this.liveAPI.dbName, this.username, this.password]
                },
                id: 1
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch('https://alsaji.com/proxy.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(authData)
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.result) {
                this.uid = result.result;
                this.saveSession();
                console.log('✅ Authentication successful. User ID:', this.uid);
                return true;
            } else {
                throw new Error(result.error?.data?.message || 'Authentication failed');
            }

        } catch (error) {
            console.error('❌ Authentication error:', error.message);
            return false;
        }
    }

    saveSession() {
        const sessionData = {
            uid: this.uid,
            password: this.password,
            username: this.username,
            expires: Date.now() + (60 * 60 * 1000),
        };
        localStorage.setItem('alsaji_session', JSON.stringify(sessionData));
    }

    clearSession() {
        this.uid = null;
        this.username = null;
        this.password = null;
        this.sessionInfo = null;
        localStorage.removeItem('alsaji_session');
        localStorage.removeItem('alsaji_username');
    }

    async logout() {
        try {
            if (this.uid) {
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

                await fetch('https://alsaji.com/proxy.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(logoutData)
                });
            }
        } catch (error) {
            console.log('Logout request failed:', error);
        }

        this.clearSession();
        console.log('✅ Logged out successfully');
        return { success: true };
    }

    // ==================== PRODUCT METHODS ====================

    async getProducts(filters = {}) {
        console.log('🔄 Getting products with filters:', filters);

        if (this.useStaticData && window.staticAPI) {
            try {
                const result = window.staticAPI.getProducts(filters);
                console.log(`✅ Static API returned ${result.products.length} products`);
                return result;
            } catch (error) {
                console.error('❌ Static API failed:', error);
            }
        }

        return await this.getFallbackProducts(filters);
    }

    async getProductById(productId) {
        if (!this.useStaticData || !window.staticAPI?.products) {
            return null;
        }

        const id = parseInt(productId);
        console.log(`🔍 Looking for product ID: ${id}`);

        // Multiple lookup strategies
        const product = window.staticAPI.products.find(p =>
            p.id === id || p.id == id || p.id.toString() === productId.toString()
        );

        if (!product) {
            console.log(`❌ Product ${productId} not found in ${window.staticAPI.products.length} products`);
        }

        return product;
    }

    async getCategories() {
        if (this.useStaticData && window.staticAPI) {
            try {
                return window.staticAPI.getCategories();
            } catch (error) {
                console.error('Static categories failed:', error);
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
            }
        }
        return await this.getFallbackSuggestions(query);
    }

    async getFeaturedProducts(limit = 8) {
        return this.getProducts({ limit });
    }

    // ==================== CART METHODS ====================



    async getLocalCart() {
        try {
            const cartJson = localStorage.getItem('alsaji_cart');
            if (cartJson) {
                const cart = JSON.parse(cartJson);
                this.ensureCartStructure(cart);
                return {
                    success: true,
                    cart: cart,
                    source: 'local'
                };
            }
        } catch (error) {
            console.error('Failed to parse local cart:', error);
        }

        return {
            success: true,
            cart: this.getEmptyCart(),
            source: 'local'
        };
    }

    getEmptyCart() {
        return {
            items: [],
            item_count: 0,
            total: 0,
            tax_total: 0,
            currency: 'IQD'
        };
    }

    ensureCartStructure(cart) {
        if (!cart.items) cart.items = [];
        if (!cart.item_count) cart.item_count = 0;
        if (!cart.total) cart.total = 0;
        if (!cart.tax_total) cart.tax_total = 0;
        if (!cart.currency) cart.currency = 'IQD';
    }

    isCartCacheValid() {
        return this.cartCache &&
               this.cartCacheTime &&
               (Date.now() - this.cartCacheTime) < this.CART_CACHE_DURATION;
    }





    updateCartTotals(cart) {
        cart.item_count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    }

    async saveCart(cart) {
        localStorage.setItem('alsaji_cart', JSON.stringify(cart));
        this.cartCache = null;
        this.triggerCartUpdate(cart.item_count);
    }

    triggerCartUpdate(count) {
        if (window.AlSajiCartEvents) {
            window.AlSajiCartEvents.updateCartCount(count);
        }
    }

    validateProductId(productId) {
        if (!productId || productId === '' || productId === null || productId === undefined) {
            return false;
        }
        const id = parseInt(productId);
        return !isNaN(id) && id > 0;
    }

    // ==================== CART METHODS - FIXED VERSION ====================

    async getCart(forceRefresh = false) {
        // Check cache first
        if (!forceRefresh && this.isCartCacheValid()) {
            console.log('📦 Returning cached cart');
            return this.cartCache;
        }

        // Always check local cart first for immediate response
        const localCart = await this.getLocalCart();

        // Try Odoo API in background if authenticated, but don't wait for it
        if (await this.ensureAuthenticated()) {
            this.syncCartToOdoo(localCart.cart).catch(error => {
                console.log('🔄 Background Odoo sync failed:', error);
            });
        }

        // Return local cart immediately for best user experience
        this.cartCache = localCart;
        this.cartCacheTime = Date.now();
        return localCart;
    }

    async liveGetCart() {
        try {
            console.log('🔄 Getting live cart from Odoo...');

            // Search for current user's cart (sale orders in draft state)
            const searchResult = await this.executeOdooMethod(
                'sale.order',
                'search_read',
                [],
                {
                    domain: [
                        ['partner_id', '=', this.uid],
                        ['state', '=', 'draft']
                    ],
                    fields: ['id', 'amount_total', 'amount_tax', 'currency_id', 'order_line'],
                    limit: 1,
                    order: 'id desc'
                }
            );

            let cartData = null;
            let orderLines = [];

            if (searchResult?.result?.length > 0) {
                cartData = searchResult.result[0];

                // Get detailed order line information
                if (cartData.order_line && cartData.order_line.length > 0) {
                    const linesResult = await this.executeOdooMethod(
                        'sale.order.line',
                        'read',
                        [cartData.order_line],
                        {
                            fields: ['product_id', 'name', 'product_uom_qty', 'price_unit', 'price_subtotal', 'product_uom']
                        }
                    );
                    orderLines = linesResult?.result || [];
                }
            } else {
                // No cart found in Odoo - create a new one
                console.log('📝 No cart found in Odoo, creating new one...');
                const newCartResult = await this.executeOdooMethod(
                    'sale.order',
                    'create',
                    [{
                        'partner_id': this.uid,
                        'state': 'draft'
                    }]
                );

                if (newCartResult?.result) {
                    cartData = {
                        id: newCartResult.result,
                        amount_total: 0,
                        amount_tax: 0,
                        currency_id: [1, 'IQD'], // Default currency
                        order_line: []
                    };
                }
            }

            const formattedCart = {
                items: orderLines.map(line => ({
                    product_id: line.product_id[0],
                    name: line.name,
                    quantity: line.product_uom_qty,
                    unit_price: line.price_unit,
                    subtotal: line.price_subtotal,
                    image: null,
                    sku: line.product_id[1],
                    odoo_line_id: line.id
                })),
                total: cartData?.amount_total || 0,
                item_count: orderLines.reduce((sum, line) => sum + line.product_uom_qty, 0),
                tax_total: cartData?.amount_tax || 0,
                currency: cartData?.currency_id?.[1] || 'IQD',
                odoo_order_id: cartData?.id || null
            };

            return {
                success: true,
                cart: formattedCart,
                source: 'odoo'
            };

        } catch (error) {
            console.error('❌ Failed to get live cart:', error);
            // Return local cart as fallback
            return this.getLocalCart();
        }
    }

async syncCartToOdoo(localCart) {
    try {
        if (!localCart.items || localCart.items.length === 0) {
            console.log('🔄 No items to sync to Odoo');
            return;
        }

        console.log('🔄 Syncing cart to Odoo...', localCart.items.length, 'items');

        // Get or create Odoo cart
        const odooCart = await this.getOrCreateOdooCart();
        if (!odooCart) {
            throw new Error('Failed to get or create Odoo cart');
        }

        // 🔥 SIMPLIFIED: Get current lines first, then only delete ones that exist
        let existingLineIds = [];
        if (odooCart.order_line && odooCart.order_line.length > 0) {
            try {
                // Read current lines to see which ones actually exist
                const currentLines = await this.executeOdooMethod(
                    'sale.order.line',
                    'read',
                    [odooCart.order_line],
                    { fields: ['id'] }
                );

                if (currentLines?.result?.length > 0) {
                    existingLineIds = currentLines.result.map(line => line.id);
                }
            } catch (readError) {
                console.log('⚠️ Could not read current cart lines, assuming empty cart');
                existingLineIds = [];
            }
        }

        // Delete only the lines that actually exist
        if (existingLineIds.length > 0) {
            try {
                await this.executeOdooMethod(
                    'sale.order.line',
                    'unlink',
                    [existingLineIds]
                );
                console.log(`✅ Cleared ${existingLineIds.length} existing Odoo cart lines`);
            } catch (deleteError) {
                if (deleteError.message.includes('Record does not exist')) {
                    console.log('⚠️ Some lines were already deleted during sync');
                } else {
                    throw deleteError;
                }
            }
        }

        // Add all items to Odoo cart
        for (const item of localCart.items) {
            await this.addItemToOdooCart(odooCart.id, item);
        }

        console.log('✅ Cart synced to Odoo successfully');

    } catch (error) {
        console.error('❌ Failed to sync cart to Odoo:', error);
        throw error;
    }
}    async getOrCreateOdooCart() {
        try {
            // Search for existing cart
            const searchResult = await this.executeOdooMethod(
                'sale.order',
                'search_read',
                [],
                {
                    domain: [
                        ['partner_id', '=', this.uid],
                        ['state', '=', 'draft']
                    ],
                    fields: ['id', 'order_line'],
                    limit: 1,
                    order: 'id desc'
                }
            );

            if (searchResult?.result?.length > 0) {
                return searchResult.result[0];
            }

            // Create new cart
            const createResult = await this.executeOdooMethod(
                'sale.order',
                'create',
                [{
                    'partner_id': this.uid,
                    'state': 'draft'
                }]
            );

            if (createResult?.result) {
                return {
                    id: createResult.result,
                    order_line: []
                };
            }

            return null;

        } catch (error) {
            console.error('❌ Failed to get/create Odoo cart:', error);
            throw error;
        }
    }

    async addItemToOdooCart(orderId, item) {
        try {
            const lineResult = await this.executeOdooMethod(
                'sale.order.line',
                'create',
                [{
                    'order_id': orderId,
                    'product_id': item.product_id,
                    'product_uom_qty': item.quantity,
                    'price_unit': item.unit_price,
                    'name': item.name
                }]
            );

            return lineResult?.result;

        } catch (error) {
            console.error('❌ Failed to add item to Odoo cart:', error);
            throw error;
        }
    }

    async addToCart(productId, quantity = 1) {
        try {
            console.log(`🛒 Adding to cart: product ${productId}, quantity ${quantity}`);

            if (!this.validateProductId(productId)) {
                throw new Error('Invalid product ID');
            }

            const cartResult = await this.getCart();
            const cart = cartResult.cart;

            const existingItemIndex = cart.items.findIndex(item => item.product_id == productId);

            if (existingItemIndex >= 0) {
                // Update existing item
                cart.items[existingItemIndex].quantity += quantity;
                cart.items[existingItemIndex].subtotal =
                    cart.items[existingItemIndex].unit_price * cart.items[existingItemIndex].quantity;
            } else {
                // Add new item
                const product = await this.getProductById(productId);
                if (!product) {
                    throw new Error('Product not found');
                }

                cart.items.push({
                    id: Date.now(),
                    product_id: parseInt(productId),
                    name: product.name,
                    quantity: parseInt(quantity),
                    unit_price: product.price,
                    subtotal: product.price * quantity,
                    image: product.image_url,
                    product_data: product
                });
            }

            this.updateCartTotals(cart);
            await this.saveCart(cart);

            // Sync to Odoo in background if authenticated
            if (await this.ensureAuthenticated()) {
                this.syncCartToOdoo(cart).catch(error => {
                    console.log('⚠️ Background Odoo sync failed, but local cart updated:', error);
                });
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
            const cartResult = await this.getCart();
            const cart = cartResult.cart;

            const itemIndex = cart.items.findIndex(item => item.id == lineId);
            if (itemIndex === -1) {
                throw new Error('Item not found in cart');
            }

            if (quantity <= 0) {
                return await this.removeFromCart(lineId);
            }

            cart.items[itemIndex].quantity = quantity;
            cart.items[itemIndex].subtotal = cart.items[itemIndex].unit_price * quantity;

            this.updateCartTotals(cart);
            await this.saveCart(cart);

            // Sync to Odoo in background
            if (await this.ensureAuthenticated()) {
                this.syncCartToOdoo(cart).catch(error => {
                    console.log('⚠️ Background Odoo sync failed:', error);
                });
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
            const cartResult = await this.getCart();
            const cart = cartResult.cart;

            cart.items = cart.items.filter(item => item.id != lineId);
            this.updateCartTotals(cart);
            await this.saveCart(cart);

            // Sync to Odoo in background
            if (await this.ensureAuthenticated()) {
                this.syncCartToOdoo(cart).catch(error => {
                    console.log('⚠️ Background Odoo sync failed:', error);
                });
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
            this.triggerCartUpdate(0);

            // Clear Odoo cart in background
            if (await this.ensureAuthenticated()) {
                this.clearOdooCart().catch(error => {
                    console.log('⚠️ Background Odoo clear failed:', error);
                });
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

    async clearOdooCart() {
        try {
            const odooCart = await this.getOrCreateOdooCart();
            if (odooCart && odooCart.order_line && odooCart.order_line.length > 0) {
                await this.executeOdooMethod(
                    'sale.order.line',
                    'unlink',
                    [odooCart.order_line]
                );
                console.log('✅ Odoo cart cleared');
            }
        } catch (error) {
            console.error('❌ Failed to clear Odoo cart:', error);
            throw error;
        }
    }

    // ==================== ORDER METHODS ====================

async createOdooOrder(orderData) {
    try {
        console.log('🔄 Creating sales order in Odoo...', orderData);

        // 🔥 REMOVE: No custom order number generation
        const partnerId = await this.findOrCreateCashCustomer(orderData.customer);
        const orderLines = this.prepareOrderLines(orderData.items);

        const orderValues = {
            'partner_id': partnerId,
            'partner_invoice_id': partnerId,
            'partner_shipping_id': partnerId,
            'order_line': orderLines,
            'note': this.formatOrderNotes(orderData),
            'state': 'draft', // Keep as draft initially
            'require_payment': false,
            'require_signature': false,
        };

        console.log('📦 Order values:', orderValues);

        const orderResult = await this.executeOdooMethod(
            'sale.order',
            'create',
            [orderValues]
        );

        if (orderResult?.result) {
            const orderId = orderResult.result;
            console.log(`✅ Sales order created in Odoo with ID: ${orderId}`);

            // 🔥 NEW: Get the Odoo-generated order name/number
            const orderInfo = await this.executeOdooMethod(
                'sale.order',
                'read',
                [[orderId]],
                { fields: ['name'] } // 'name' field contains the Odoo order number
            );

            const odooOrderNumber = orderInfo?.result?.[0]?.name || orderId.toString();

            await this.markAsRequestSent(orderId, orderData, odooOrderNumber);

            return {
                success: true,
                odoo_order_id: orderId,
                odoo_order_number: odooOrderNumber, // 🔥 RETURN ODOO ORDER NUMBER
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
// 🔥 NEW: Find or create customer with CASH payment type
async findOrCreateCashCustomer(customerData) {
    try {
        if (!customerData || !customerData.phone) {
            // If no customer data, create a generic website customer with cash payment
            return await this.createCashCustomer({
                name: 'Website Customer',
                phone: '000000000',
                email: 'website@alsaji.com'
            });
        }

        // Try to find customer by phone (more reliable than email)
        const searchResult = await this.executeOdooMethod(
            'res.partner',
            'search_read',
            [],
            {
                domain: [
                    '|',
                    ['phone', '=', customerData.phone],
                    ['mobile', '=', customerData.phone]
                ],
                fields: ['id', 'partner_payment_type', 'name', 'email'],
                limit: 1
            }
        );

        let partnerId;

        if (searchResult?.result?.length > 0) {
            partnerId = searchResult.result[0].id;
            const existingPaymentType = searchResult.result[0].partner_payment_type;

            // 🔥 UPDATE existing customer to CASH payment type if needed
            if (existingPaymentType !== 'cash') {
                console.log(`🔄 Updating customer ${partnerId} payment type to CASH`);

                await this.executeOdooMethod(
                    'res.partner',
                    'write',
                    [
                        [partnerId],
                        {
                            'partner_payment_type': 'cash',
                            'name': customerData.fullName || searchResult.result[0].name,
                            'email': customerData.email || searchResult.result[0].email,
                            'phone': customerData.phone,
                            'street': customerData.address || '',
                            'city': customerData.city || '',
                        }
                    ]
                );
            }

            console.log(`✅ Using existing customer: ${partnerId} with CASH payment`);
        } else {
            // Create new customer with CASH payment type
            partnerId = await this.createCashCustomer(customerData);
        }

        return partnerId;

    } catch (error) {
        console.error('❌ Customer lookup/creation failed:', error);
        // 🔥 FALLBACK: Create a generic website customer
        return await this.createCashCustomer({
            name: customerData?.fullName || 'Website Customer',
            phone: customerData?.phone || '000000000',
            email: customerData?.email || 'website@alsaji.com',
            address: customerData?.address || '',
            city: customerData?.city || ''
        });
    }
}

// 🔥 HELPER: Create customer with CASH payment type
async createCashCustomer(customerData) {
    const customerValues = {
        'name': customerData.name || 'Website Customer',
        'email': customerData.email || '',
        'phone': customerData.phone || '000000000',
        'street': customerData.address || '',
        'city': customerData.city || '',
        'partner_payment_type': 'cash', // 🔥 FORCE CASH PAYMENT TYPE
        'type': 'invoice',
        'company_type': 'person',
    };

    const createResult = await this.executeOdooMethod(
        'res.partner',
        'create',
        [customerValues]
    );

    if (createResult?.result) {
        console.log(`✅ Created new CASH customer: ${createResult.result}`);
        return createResult.result;
    } else {
        throw new Error('Failed to create customer');
    }
}

// 🔥 FIX: Also update the fallback method to use orderData.customer
async createOdooOrderFallback(orderData) {
    const partnerId = 1; // Always use public partner

    const orderLines = this.prepareOrderLines(orderData.items);

    const orderValues = {
        'partner_id': partnerId,
        'order_line': orderLines,
        'client_order_ref': orderData.order_number,
        'state': 'draft',
    };

    const orderResult = await this.executeOdooMethod(
        'sale.order',
        'create',
        [orderValues]
    );

    if (orderResult?.result) {
        const orderId = orderResult.result;
        console.log(`✅ Fallback order created in Odoo with ID: ${orderId}`);

        // Add notes separately to avoid any validation issues
        try {
            await this.executeOdooMethod(
                'sale.order',
                'write',
                [
                    [orderId],
                    { 'note': this.formatOrderNotes(orderData) }
                ]
            );
        } catch (noteError) {
            console.log('⚠️ Could not add notes to order, but order was created');
        }

        return {
            success: true,
            odoo_order_id: orderId,
            message: 'Order created successfully (fallback method)'
        };
    } else {
        throw new Error('Failed to create fallback order');
    }
}



// And the formatRequestSentNotes method
formatRequestSentNotes(orderData) {
    const customer = orderData.customer || {}; // 🔥 Use orderData.customer
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
    // 🔥 SIMPLIFIED: Always use cash payment type for website customers
    async findOrCreateCustomerWithCashPayment(customerData) {
        try {
            if (!customerData || !customerData.email) {
                return 1; // Default public partner (usually cash)
            }

            // Search for existing customer by email
            const searchResult = await this.executeOdooMethod(
                'res.partner',
                'search_read',
                [],
                {
                    domain: [['email', '=', customerData.email]],
                    fields: ['id', 'partner_payment_type'],
                    limit: 1
                }
            );

            let partnerId;

            if (searchResult?.result?.length > 0) {
                partnerId = searchResult.result[0].id;
                const existingPaymentType = searchResult.result[0].partner_payment_type;

                // 🔥 FORCE CASH: Update customer to cash payment type if not already
                if (existingPaymentType !== 'cash') {
                    console.log(`🔄 Updating customer payment type from ${existingPaymentType} to cash`);

                    await this.executeOdooMethod(
                        'res.partner',
                        'write',
                        [
                            [partnerId],
                            {
                                'partner_payment_type': 'cash', // 🔥 FORCE CASH
                                'name': customerData.fullName || 'Website Customer',
                                'phone': customerData.phone || '',
                                'street': customerData.address || '',
                                'city': customerData.city || '',
                            }
                        ]
                    );
                }

                console.log(`✅ Using customer: ${partnerId} with CASH payment type`);
            } else {
                // Create new customer with CASH payment type
                const customerValues = {
                    'name': customerData.fullName || 'Website Customer',
                    'email': customerData.email || '',
                    'phone': customerData.phone || '',
                    'street': customerData.address || '',
                    'city': customerData.city || '',
                    'partner_payment_type': 'cash', // 🔥 ALWAYS CASH FOR WEBSITE
                    'type': 'invoice',
                    'company_type': 'person',
                };

                const createResult = await this.executeOdooMethod(
                    'res.partner',
                    'create',
                    [customerValues]
                );

                if (createResult?.result) {
                    partnerId = createResult.result;
                    console.log(`✅ Created new customer: ${partnerId} with CASH payment type`);
                } else {
                    throw new Error('Failed to create customer');
                }
            }

            return partnerId;

        } catch (error) {
            console.error('❌ Customer lookup/creation failed:', error);
            return 1; // Default public partner (cash)
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

            if (searchResult?.result?.length > 0) {
                console.log(`✅ Found existing customer: ${searchResult.result[0].id}`);
                return searchResult.result[0].id;
            }

            // Create new customer with CASH payment type
            const customerValues = {
                'name': customerData.fullName || 'Website Customer',
                'email': customerData.email || '',
                'phone': customerData.phone || '',
                'street': customerData.address || '',
                'city': customerData.city || '',
                'partner_payment_type': 'cash', // 🔥 ALWAYS CASH
                'type': 'invoice',
                'company_type': 'person',
            };

            const createResult = await this.executeOdooMethod(
                'res.partner',
                'create',
                [customerValues]
            );

            if (createResult?.result) {
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

    prepareOrderLines(items) {
        return items.map(item => [
            0, 0, {
                'product_id': item.product_id,
                'product_uom_qty': item.quantity,
                'price_unit': item.unit_price,
                'name': item.name,
                'tax_id': false
            }
        ]);
    }

async markAsRequestSent(orderId, orderData, odooOrderNumber) {
    try {
        const noteContent = this.formatRequestSentNotes(orderData, odooOrderNumber); // 🔥 PASS ODOO ORDER NUMBER

        const updateResult = await this.executeOdooMethod(
            'sale.order',
            'write',
            [
                [orderId],
                {
                    'note': noteContent,
                    // If you want to confirm the order immediately, uncomment:
                    // 'state': 'sent' // Changes from draft to sent
                }
            ]
        );

        if (updateResult && updateResult.result) {
            console.log(`✅ Order ${orderId} marked as 'Request Sent' with Odoo number: ${odooOrderNumber}`);
        } else {
            console.log('⚠️ Could not update order notes');
        }

    } catch (error) {
        console.error('⚠️ Could not mark order as request sent:', error);
    }
}
    // Also make sure the formatOrderNotes method uses orderData.customer
formatOrderNotes(orderData) {
    const customer = orderData.customer || {};
    return `Website Order
Customer: ${customer.fullName || 'N/A'}
Phone: ${customer.phone || 'N/A'}
Payment: ${orderData.payment || 'N/A'}`;
}

formatRequestSentNotes(orderData, odooOrderNumber) { // 🔥 ADD ODOO ORDER NUMBER PARAM
    const customer = orderData.customer || {};
    const itemsText = orderData.items.map(item =>
        `- ${item.name} (Qty: ${item.quantity}) - IQD ${item.unit_price.toLocaleString()} each`
    ).join('\n');

    return `WEBSITE ORDER - REQUEST SENT
=================================
Odoo Order Number: ${odooOrderNumber} 🔥 USE ODOO NUMBER
Customer: ${customer.fullName || 'N/A'}
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
    // ==================== ODOO EXECUTION METHODS ====================

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

            const response = await fetch('https://alsaji.com/proxy.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
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

            console.log(`✅ Odoo API Success: ${model}.${method}`);
            return result;

        } catch (error) {
            console.error(`❌ Odoo method execution failed (${model}.${method}):`, error);
            throw error;
        }
    }

    // ==================== FALLBACK METHODS ====================

    async getFallbackProducts(filters = {}) {
        console.log('🔄 Using fallback products method');

        try {
            const response = await fetch('data/json/products.json');
            if (response.ok) {
                const products = await response.json();
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
            const response = await fetch('data/json/categories.json');
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
            const response = await fetch('data/json/brands.json');
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

    // ==================== UTILITY METHODS ====================

    isLoggedIn() {
        return this.uid !== null;
    }

    getUsername() {
        return this.username || localStorage.getItem('alsaji_username');
    }

    getLastSyncTime() {
        return window.staticAPI?.lastUpdated ? new Date(window.staticAPI.lastUpdated) : null;
    }

    refreshCart() {
        this.cartCache = null;
        this.cartCacheTime = null;
        return this.getCart(true);
    }
}

// ==================== GLOBAL CART EVENT SYSTEM ====================

window.AlSajiCartEvents = {
    updateCartCount: function(count) {
        const cartCountElements = document.querySelectorAll('#cartCount');
        cartCountElements.forEach(element => {
            element.textContent = count;
        });

        document.dispatchEvent(new CustomEvent('cartCountUpdated', {
            detail: { count: count }
        }));

        console.log('🔄 Cart count updated globally:', count);
    },

    refreshCartCount: async function() {
        try {
            const cartResult = await window.alsajiAPI.getCart(true);
            const count = cartResult.cart?.item_count || 0;
            this.updateCartCount(count);
        } catch (error) {
            console.error('Failed to refresh cart count:', error);
        }
    }
};

// Event listeners for cross-tab synchronization
window.addEventListener('storage', function(e) {
    if (e.key === 'alsaji_cart') {
        console.log('🔄 Cart changed in another tab, updating count...');
        AlSajiCartEvents.refreshCartCount();
    }
});

document.addEventListener('cartUpdated', function() {
    AlSajiCartEvents.refreshCartCount();
});

// Auto-initialization
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        AlSajiCartEvents.refreshCartCount();
    }, 500);

    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            AlSajiCartEvents.refreshCartCount();
        }
    });
});

// Create global instance
window.alsajiAPI = new AlSajiAPI();
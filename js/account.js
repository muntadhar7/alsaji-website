// Enhanced Account Manager with complete functionality and caching
class AccountManager {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.authChecked = false;
        this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache
        this.init();
    }

    async init() {
        console.log('🔐 Initializing Enhanced Account Manager...');

        // Show page immediately
        this.showPage();

        // Check cached auth first
        const cachedAuth = this.getCachedAuth();
        if (cachedAuth && cachedAuth.username) {
            console.log('⚡ Using cached authentication');
            this.currentUser = cachedAuth.username;
            this.authChecked = true;

            await this.loadUserData();
            this.showAccountSection();
        } else if (cachedAuth !== null) {
            // Cache exists but no user (already checked and no login)
            this.showLoginSection();
        } else {
            // No cache, check properly
            this.showLoadingState();
            this.setupEventListeners();
            await this.checkAuthStatus();
        }

        this.initializeYearDropdown();
    }

    getCachedAuth() {
        try {
            const cached = sessionStorage.getItem('alsaji_auth_checked');
            if (!cached) return null;

            const data = JSON.parse(cached);
            const now = Date.now();

            // Check if cache is still valid
            if (now - data.timestamp < this.CACHE_DURATION) {
                return data;
            }

            // Cache expired
            sessionStorage.removeItem('alsaji_auth_checked');
            return null;
        } catch (error) {
            console.log('❌ Cache read error:', error);
            return null;
        }
    }

    showLoadingState() {
        const loadingHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
                <h3>Checking authentication...</h3>
                <p>Please wait while we verify your session</p>
            </div>
        `;

        document.getElementById('loginSection').innerHTML = loadingHTML;
        document.getElementById('loginSection').classList.add('active');
        document.getElementById('accountSection').classList.remove('active');
    }

    showPage() {
        document.body.style.visibility = 'visible';
        document.body.style.opacity = '1';
    }

    initializeYearDropdown() {
        const yearSelect = document.getElementById('vehicleYear');
        if (yearSelect) {
            const currentYear = new Date().getFullYear();
            for (let year = currentYear; year >= 1990; year--) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearSelect.appendChild(option);
            }
        }
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(loginForm);
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }

        // Account tabs
        this.setupAccountTabs();

        // Profile form
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleProfileUpdate(profileForm);
            });
        }

        // Vehicle form
        const vehicleForm = document.getElementById('addVehicleForm');
        if (vehicleForm) {
            vehicleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddVehicle(vehicleForm);
            });
        }

        // Address form
        const addressForm = document.getElementById('addAddressForm');
        if (addressForm) {
            addressForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddAddress(addressForm);
            });
        }

        // Register button
        const showRegister = document.getElementById('showRegister');
        if (showRegister) {
            showRegister.addEventListener('click', () => {
                this.showRegisterForm();
            });
        }
    }

    setupAccountTabs() {
        const tabs = {
            'acctRetail': 'acctRetailView',
            'acctTrade': 'acctTradeView',
            'acctAddresses': 'acctAddressesView',
            'acctProfile': 'acctProfileView'
        };

        Object.entries(tabs).forEach(([btnId, viewId]) => {
            const btn = document.getElementById(btnId);
            const view = document.getElementById(viewId);

            if (btn && view) {
                btn.addEventListener('click', () => {
                    // Hide all views
                    document.querySelectorAll('.account-section').forEach(section => {
                        if (section.id.includes('View')) {
                            section.classList.remove('active');
                        }
                    });

                    // Remove active from all tabs
                    document.querySelectorAll('.chip').forEach(chip => {
                        chip.classList.remove('active');
                    });

                    // Show selected view
                    view.classList.add('active');
                    btn.classList.add('active');

                    // Load data for the selected tab
                    this.loadTabData(viewId);
                });
            }
        });
    }

    async loadTabData(tabId) {
        switch(tabId) {
            case 'acctRetailView':
                await this.loadRealOrdersData();
                break;
            case 'acctTradeView':
                await this.loadVehiclesData();
                break;
            case 'acctAddressesView':
                await this.loadAddressesData();
                break;
            case 'acctProfileView':
                await this.loadProfileData();
                break;
        }
    }

    async checkAuthStatus() {
        try {
            if (typeof alsajiAPI === 'undefined') {
                console.log('⏳ Waiting for API...');
                setTimeout(() => this.checkAuthStatus(), 100);
                return;
            }

            const username = alsajiAPI.getUsername();
            console.log('🔍 Checking auth status, username:', username);

            // Cache the result for this session
            sessionStorage.setItem('alsaji_auth_checked', JSON.stringify({
                username: username,
                timestamp: Date.now()
            }));

            if (username) {
                this.currentUser = username;
                await this.loadUserData();
                this.showAccountSection();
            } else {
                this.showLoginSection();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showLoginSection();
        }
    }

    async handleLogin(form) {
        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');
        const submitBtn = form.querySelector('button[type="submit"]');

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Signing in...';
        submitBtn.disabled = true;

        try {
            console.log('🔐 Attempting login for:', email);

            // Set credentials in API
            alsajiAPI.setCredentials(email, password);

            // Attempt login
            const result = await alsajiAPI.login(email, password);

            if (result.success) {
                this.currentUser = email;

                // Update cache with new login
                sessionStorage.setItem('alsaji_auth_checked', JSON.stringify({
                    username: email,
                    timestamp: Date.now()
                }));

                await this.loadUserData();
                this.showAccountSection();
                this.showToast('Welcome back!', 'success');
                form.reset();
            } else {
                throw new Error(result.error || 'Login failed');
            }
        } catch (error) {
            this.showToast(error.message, 'error');
            console.error('Login error:', error);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleLogout() {
        try {
            const result = await alsajiAPI.logout();
            if (result.success) {
                this.currentUser = null;
                this.userData = null;

                // Clear all caches on logout
                sessionStorage.removeItem('alsaji_auth_checked');
                if (this.currentUser) {
                    localStorage.removeItem(`alsaji_user_${this.currentUser}`);
                    localStorage.removeItem(`alsaji_user_${this.currentUser}_loaded`);
                }

                this.showLoginSection();
                this.showToast('Signed out successfully', 'success');
            }
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('Logout failed', 'error');
        }
    }

    async loadUserData() {
        // Check if we recently loaded user data
        const cacheKey = `alsaji_user_${this.currentUser}_loaded`;
        const lastLoaded = localStorage.getItem(cacheKey);
        const now = Date.now();

        // If loaded less than 5 minutes ago, use cache
        if (lastLoaded && (now - parseInt(lastLoaded)) < 5 * 60 * 1000) {
            console.log('⚡ Using cached user data');
            const cachedData = localStorage.getItem(`alsaji_user_${this.currentUser}`);
            if (cachedData) {
                this.userData = JSON.parse(cachedData);
                this.updateUserInterface();
                this.populateProfileForm(this.userData.profile);
                return;
            }
        }

        try {
            console.log('👤 Loading fresh user data for:', this.currentUser);

            // Load from localStorage first as fallback
            const storedData = localStorage.getItem(`alsaji_user_${this.currentUser}`);
            if (storedData) {
                this.userData = JSON.parse(storedData);
            }

            // Try to get real user data from Odoo
            await this.loadRealUserDataFromOdoo();

            // Check trade account status
            await this.checkTradeAccountStatus();

            // Mark as recently loaded
            localStorage.setItem(cacheKey, now.toString());

            this.updateUserInterface();
            this.populateProfileForm(this.userData.profile);

        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    async loadRealUserDataFromOdoo() {
        try {
            console.log('🔍 Fetching real user data from Odoo...');

            if (!alsajiAPI.uid) {
                console.log('Not authenticated with Odoo, using default data');
                return;
            }

            // Ensure userData exists
            if (!this.userData) {
                console.log('⚠️ userData is null, initializing...');
                this.userData = {
                    profile: {
                        name: this.currentUser.split('@')[0],
                        email: this.currentUser,
                        firstName: '',
                        lastName: '',
                        phone: '',
                        company: '',
                        accountType: 'retail',
                        memberSince: new Date().getFullYear()
                    },
                    orders: [],
                    vehicles: [],
                    addresses: [],
                    stats: {
                        ordersCount: 0,
                        vehiclesCount: 0,
                        tradeDiscount: '0%'
                    }
                };
            }

            // Search for partner by email
            const partnerResult = await alsajiAPI.executeOdooMethod(
                'res.partner',
                'search_read',
                [],
                {
                    domain: [['email', '=', this.currentUser]],
                    fields: [
                        'name', 'email', 'phone', 'street', 'city',
                        'company_type', 'type', 'parent_id', 'create_date'
                    ],
                    limit: 1
                }
            );

            if (partnerResult && partnerResult.result && partnerResult.result.length > 0) {
                const partnerData = partnerResult.result[0];
                console.log('✅ Found partner data in Odoo:', partnerData);

                // Parse the name to extract first and last names
                const nameParts = this.parseName(partnerData.name);

                // Update user profile with real data
                this.userData.profile = {
                    ...this.userData.profile,
                    firstName: nameParts.firstName,
                    lastName: nameParts.lastName,
                    name: partnerData.name,
                    email: partnerData.email || this.currentUser,
                    phone: partnerData.phone || '',
                    company: partnerData.parent_id ? await this.getCompanyName(partnerData.parent_id[0]) : '',
                    accountType: this.determineAccountType(partnerData),
                    memberSince: new Date(partnerData.create_date).getFullYear() || new Date().getFullYear(),
                    odooPartnerId: partnerData.id
                };

                console.log('✅ Updated profile with real Odoo data:', this.userData.profile);
                this.saveUserData();
            } else {
                console.log('⚠️ No partner found in Odoo for email:', this.currentUser);
                // Ensure userData exists even if no partner found
                if (!this.userData) {
                    this.userData = {
                        profile: {
                            name: this.currentUser.split('@')[0],
                            email: this.currentUser,
                            firstName: '',
                            lastName: '',
                            phone: '',
                            company: '',
                            accountType: 'retail',
                            memberSince: new Date().getFullYear()
                        },
                        orders: [],
                        vehicles: [],
                        addresses: [],
                        stats: {
                            ordersCount: 0,
                            vehiclesCount: 0,
                            tradeDiscount: '0%'
                        }
                    };
                }
            }

        } catch (error) {
            console.error('❌ Failed to load user data from Odoo:', error);
            // Ensure userData exists even on error
            if (!this.userData) {
                this.userData = {
                    profile: {
                        name: this.currentUser.split('@')[0],
                        email: this.currentUser,
                        firstName: '',
                        lastName: '',
                        phone: '',
                        company: '',
                        accountType: 'retail',
                        memberSince: new Date().getFullYear()
                    },
                    orders: [],
                    vehicles: [],
                    addresses: [],
                    stats: {
                        ordersCount: 0,
                        vehiclesCount: 0,
                        tradeDiscount: '0%'
                    }
                };
            }
        }
    }

    parseName(fullName) {
        if (!fullName) return { firstName: '', lastName: '' };

        const nameParts = fullName.trim().split(' ');

        if (nameParts.length === 1) {
            return {
                firstName: nameParts[0],
                lastName: ''
            };
        } else if (nameParts.length === 2) {
            return {
                firstName: nameParts[0],
                lastName: nameParts[1]
            };
        } else {
            // For names with multiple parts, take first as first name, rest as last name
            return {
                firstName: nameParts[0],
                lastName: nameParts.slice(1).join(' ')
            };
        }
    }

    async getCompanyName(companyId) {
        try {
            const companyResult = await alsajiAPI.executeOdooMethod(
                'res.partner',
                'read',
                [[companyId]],
                {
                    fields: ['name']
                }
            );

            if (companyResult && companyResult.result && companyResult.result.length > 0) {
                return companyResult.result[0].name;
            }
            return '';
        } catch (error) {
            console.error('Failed to get company name:', error);
            return '';
        }
    }

    determineAccountType(partnerData) {
        // Determine account type based on partner data
        if (partnerData.company_type === 'company') {
            return 'trade';
        }

        if (partnerData.parent_id) {
            return 'trade'; // Child of a company = trade account
        }

        if (partnerData.type === 'invoice') {
            return 'trade'; // Invoice contact = likely trade
        }

        return 'retail'; // Default to retail
    }

    async createOdooPartner() {
        try {
            console.log('👤 Creating new partner in Odoo for:', this.currentUser);

            const partnerData = {
                'name': this.userData.profile.name,
                'email': this.currentUser,
                'company_type': 'person',
                'type': 'contact'
            };

            const createResult = await alsajiAPI.executeOdooMethod(
                'res.partner',
                'create',
                [partnerData]
            );

            if (createResult && createResult.result) {
                console.log('✅ Created new partner in Odoo with ID:', createResult.result);
                this.userData.profile.odooPartnerId = createResult.result;
                this.saveUserData();
            }

        } catch (error) {
            console.error('Failed to create Odoo partner:', error);
        }
    }

    saveUserData() {
        if (this.userData && this.currentUser) {
            localStorage.setItem(`alsaji_user_${this.currentUser}`, JSON.stringify(this.userData));
        }
    }

    updateUserInterface() {
        if (!this.userData) return;

        const { profile, stats } = this.userData;

        // Update user info
        document.getElementById('userName').textContent = profile.firstName && profile.lastName
            ? `${profile.firstName} ${profile.lastName}`
            : profile.name;
        document.getElementById('userEmail').textContent = profile.email;

        // Update stats
        document.getElementById('ordersCount').textContent = stats.ordersCount;
        document.getElementById('vehiclesCount').textContent = stats.vehiclesCount;
        document.getElementById('tradeDiscount').textContent = stats.tradeDiscount;
        document.getElementById('accountSince').textContent = profile.memberSince;

        // Update avatar with first letter
        const displayName = profile.firstName && profile.lastName ? profile.firstName : profile.name;
        const firstLetter = displayName.charAt(0).toUpperCase();
        document.getElementById('userAvatar').textContent = firstLetter;

        // Update account type
        const accountTypeText = profile.accountType === 'trade' ? 'Trade Account' : 'Retail Account';
        const benefitsText = profile.accountType === 'trade'
            ? 'Trade pricing and bulk order benefits'
            : 'Standard pricing and features';

        document.getElementById('accountTypeBadge').textContent = accountTypeText;
        document.getElementById('displayAccountType').textContent = accountTypeText;
        document.getElementById('displayBenefits').textContent = benefitsText;
    }

    populateProfileForm(profileData) {
        document.getElementById('firstName').value = profileData.firstName || '';
        document.getElementById('lastName').value = profileData.lastName || '';
        document.getElementById('email').value = profileData.email || '';
        document.getElementById('phone').value = profileData.phone || '';
        document.getElementById('company').value = profileData.company || '';
    }

    async handleProfileUpdate(form) {
        const formData = new FormData(form);
        const profileData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            company: formData.get('company')
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        try {
            submitBtn.textContent = 'Updating...';
            submitBtn.disabled = true;

            // Update user data
            if (this.userData) {
                Object.assign(this.userData.profile, profileData);

                // Update full name
                this.userData.profile.name = `${profileData.firstName} ${profileData.lastName}`.trim();

                this.saveUserData();
                this.updateUserInterface();

                // Sync with Odoo if we have a partner ID
                await this.syncProfileWithOdoo();

                // Clear cache to force reload next time
                localStorage.removeItem(`alsaji_user_${this.currentUser}_loaded`);
            }

            this.showToast('Profile updated successfully!', 'success');

        } catch (error) {
            this.showToast('Failed to update profile', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async syncProfileWithOdoo() {
        try {
            if (!this.userData.profile.odooPartnerId) {
                console.log('No Odoo partner ID, skipping sync');
                return;
            }

            const updateData = {
                'name': this.userData.profile.name,
                'email': this.userData.profile.email,
                'phone': this.userData.profile.phone
            };

            const updateResult = await alsajiAPI.executeOdooMethod(
                'res.partner',
                'write',
                [
                    [this.userData.profile.odooPartnerId],
                    updateData
                ]
            );

            if (updateResult && updateResult.result) {
                console.log('✅ Profile synced with Odoo');
            } else {
                console.log('⚠️ Profile sync failed');
            }

        } catch (error) {
            console.error('Failed to sync profile with Odoo:', error);
        }
    }

    async handleAddVehicle(form) {
        const formData = new FormData(form);
        const vehicleData = {
            id: Date.now(),
            make: formData.get('make'),
            model: formData.get('model'),
            year: formData.get('year'),
            nickname: formData.get('nickname') || `${formData.get('make')} ${formData.get('model')}`,
            addedDate: new Date().toISOString()
        };

        try {
            if (this.userData) {
                this.userData.vehicles.push(vehicleData);
                this.userData.stats.vehiclesCount = this.userData.vehicles.length;
                this.saveUserData();
                this.updateUserInterface();

                this.showToast('Vehicle added successfully!', 'success');
                form.reset();
                showVehiclesList();
                this.loadVehiclesData();
            }
        } catch (error) {
            this.showToast('Failed to add vehicle', 'error');
        }
    }

    async handleAddAddress(form) {
        const formData = new FormData(form);
        const addressData = {
            id: Date.now(),
            name: formData.get('name'),
            phone: formData.get('phone'),
            street: formData.get('street'),
            city: formData.get('city'),
            area: formData.get('area'),
            type: formData.get('type'),
            isDefault: this.userData.addresses.length === 0 // First address is default
        };

        try {
            if (this.userData) {
                this.userData.addresses.push(addressData);
                this.saveUserData();

                this.showToast('Address added successfully!', 'success');
                form.reset();
                showAddressesList();
                this.loadAddressesData();
            }
        } catch (error) {
            this.showToast('Failed to add address', 'error');
        }
    }

    async checkTradeAccountStatus() {
        try {
            if (!this.userData || !this.userData.profile.odooPartnerId) return;

            // Check if user has special pricelist or trade status
            const partnerResult = await alsajiAPI.executeOdooMethod(
                'res.partner',
                'read',
                [[this.userData.profile.odooPartnerId]],
                {
                    fields: ['property_product_pricelist', 'category_id']
                }
            );

            if (partnerResult && partnerResult.result && partnerResult.result.length > 0) {
                const partner = partnerResult.result[0];

                // Check for trade pricelist
                if (partner.property_product_pricelist && partner.property_product_pricelist[0] !== 1) {
                    this.userData.profile.accountType = 'trade';
                    this.userData.stats.tradeDiscount = '15%'; // Example discount
                }

                // Check for trade categories
                if (partner.category_id && partner.category_id.length > 0) {
                    const categoryResult = await alsajiAPI.executeOdooMethod(
                        'res.partner.category',
                        'read',
                        [partner.category_id],
                        {
                            fields: ['name']
                        }
                    );

                    if (categoryResult && categoryResult.result) {
                        const hasTradeCategory = categoryResult.result.some(cat =>
                            cat.name.toLowerCase().includes('trade') ||
                            cat.name.toLowerCase().includes('wholesale')
                        );

                        if (hasTradeCategory) {
                            this.userData.profile.accountType = 'trade';
                        }
                    }
                }

                this.saveUserData();
                this.updateUserInterface();
            }

        } catch (error) {
            console.error('Failed to check trade status:', error);
        }
    }

    async loadRealOrdersData() {
        try {
            console.log('📦 Loading real orders from Odoo...');

            if (!this.currentUser) {
                console.log('No user logged in, skipping orders load');
                return;
            }

            // Check if we have Odoo authentication
            if (!alsajiAPI.uid) {
                console.log('Not authenticated with Odoo, using local data');
                await this.loadOrdersData();
                return;
            }

            const partnerId = await this.getOdooPartnerId();
            console.log('🔍 Using partner ID for orders:', partnerId);

            // Fetch sales orders from Odoo
            const ordersResult = await alsajiAPI.executeOdooMethod(
                'sale.order',
                'search_read',
                [],
                {
                    domain: [
                        ['state', 'in', ['sale', 'done']], // Only confirmed/completed orders
                        ['partner_id', '=', partnerId]
                    ],
                    fields: [
                        'name', 'date_order', 'amount_total', 'state',
                        'client_order_ref', 'note', 'order_line'
                    ],
                    order: 'date_order desc',
                    limit: 50
                }
            );

            if (ordersResult && ordersResult.result) {
                console.log(`✅ Found ${ordersResult.result.length} orders from Odoo`);
                await this.processOdooOrders(ordersResult.result);
            } else {
                console.log('No orders found in Odoo');
                await this.loadOrdersData(); // Fallback to local data
            }

        } catch (error) {
            console.error('❌ Failed to load orders from Odoo:', error);
            // Fallback to local data
            await this.loadOrdersData();
        }
    }

    async getOdooPartnerId() {
        try {
            // Use the partner ID from user data if available
            if (this.userData && this.userData.profile.odooPartnerId) {
                return this.userData.profile.odooPartnerId;
            }

            // Fallback: search by email
            const partnerResult = await alsajiAPI.executeOdooMethod(
                'res.partner',
                'search_read',
                [],
                {
                    domain: [['email', '=', this.currentUser]],
                    fields: ['id'],
                    limit: 1
                }
            );

            if (partnerResult && partnerResult.result && partnerResult.result.length > 0) {
                const partnerId = partnerResult.result[0].id;

                // Store it for future use
                if (this.userData) {
                    this.userData.profile.odooPartnerId = partnerId;
                    this.saveUserData();
                }

                return partnerId;
            }

            return 1; // Public partner

        } catch (error) {
            console.error('Failed to get partner ID:', error);
            return 1;
        }
    }

    async processOdooOrders(odooOrders) {
        if (!this.userData) {
            console.log('⚠️ userData is null, cannot process orders');
            return;
        }

        try {
            console.log('🔄 Processing Odoo orders:', odooOrders);

            // Convert Odoo orders to our format
            this.userData.orders = await Promise.all(
                odooOrders.map(async (odooOrder) => {
                    const items = await this.getOrderItems(odooOrder.order_line);
                    return {
                        id: odooOrder.name,
                        odooId: odooOrder.id,
                        date: new Date(odooOrder.date_order),
                        status: this.mapOdooStatus(odooOrder.state),
                        total: odooOrder.amount_total,
                        reference: odooOrder.client_order_ref || '',
                        notes: odooOrder.note || '',
                        items: items,
                        rawData: odooOrder // Keep raw data for reference
                    };
                })
            );

            this.userData.stats.ordersCount = this.userData.orders.length;
            this.saveUserData();
            this.updateUserInterface();
            this.renderOrdersList();

            console.log(`✅ Processed ${this.userData.orders.length} orders`);
        } catch (error) {
            console.error('❌ Error processing Odoo orders:', error);
        }
    }

    mapOdooStatus(odooState) {
        const statusMap = {
            'draft': 'pending',
            'sent': 'confirmed',
            'sale': 'confirmed',
            'done': 'delivered',
            'cancel': 'cancelled'
        };
        return statusMap[odooState] || 'pending';
    }

    async getOrderItems(orderLineIds) {
        try {
            if (!orderLineIds || orderLineIds.length === 0) return [];

            const itemsResult = await alsajiAPI.executeOdooMethod(
                'sale.order.line',
                'read',
                [orderLineIds],
                {
                    fields: ['product_id', 'name', 'product_uom_qty', 'price_unit']
                }
            );

            if (itemsResult && itemsResult.result) {
                return itemsResult.result.map(line => ({
                    name: line.name,
                    quantity: line.product_uom_qty,
                    price: line.price_unit
                }));
            }

            return [];

        } catch (error) {
            console.error('Failed to get order items:', error);
            return [];
        }
    }

    renderOrdersList() {
        if (!this.userData) return;

        const ordersList = document.getElementById('ordersList');

        if (this.userData.orders.length === 0) {
            ordersList.innerHTML = this.getEmptyOrdersHTML();
            return;
        }

        ordersList.innerHTML = this.userData.orders.map(order => this.getOrderHTML(order)).join('');
    }

    getOrderHTML(order) {
        const statusClass = `status-${order.status}`;
        const statusText = this.formatStatusText(order.status);
        const date = order.date.toLocaleDateString();
        const total = new Intl.NumberFormat('en-IQ', {
            style: 'currency',
            currency: 'IQD',
            minimumFractionDigits: 0
        }).format(order.total);

        return `
            <div class="order-item" data-order-id="${order.id}">
                <div class="row between">
                    <div>
                        <h4 style="margin: 0 0 4px 0;">${order.id}</h4>
                        <p class="muted" style="margin: 0;">Placed on ${date}</p>
                        ${order.reference ? `<p class="muted" style="margin: 4px 0 0 0; font-size: 12px;">Reference: ${order.reference}</p>` : ''}
                    </div>
                    <div class="order-status ${statusClass}">${statusText}</div>
                </div>

                ${order.items && order.items.length > 0 ? `
                    <div style="margin: 12px 0; padding: 12px; background: var(--w2); border-radius: 8px;">
                        <div style="font-size: 14px;">
                            <strong>Items:</strong> ${order.items.slice(0, 3).map(item =>
                                `${item.quantity}x ${item.name}`
                            ).join(', ')}
                            ${order.items.length > 3 ? ` and ${order.items.length - 3} more...` : ''}
                        </div>
                    </div>
                ` : ''}

                <div class="row between" style="align-items: center;">
                    <div>
                        <strong>${total}</strong>
                        <div class="muted">${order.items ? order.items.length : 0} item${order.items && order.items.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div class="row" style="gap: 8px;">
                        <button class="btn-small btn secondary" onclick="viewOrderDetails('${order.id}')">
                            View Details
                        </button>
                        ${order.status === 'delivered' ? `
                            <button class="btn-small btn secondary" onclick="requestReturn('${order.id}')">
                                Return
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    formatStatusText(status) {
        const statusTexts = {
            'pending': 'Pending',
            'confirmed': 'Confirmed',
            'shipped': 'Shipped',
            'delivered': 'Delivered',
            'cancelled': 'Cancelled'
        };
        return statusTexts[status] || status;
    }

    getEmptyOrdersHTML() {
        return `
            <div class="muted" style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                <h3>No orders yet</h3>
                <p>Your order history will appear here once you place orders</p>
                <div class="row" style="gap: 12px; justify-content: center; margin-top: 20px;">
                    <button class="btn" onclick="window.location.href='shop.html'">
                        Start Shopping
                    </button>
                    <button class="btn secondary" onclick="loadSampleOrders()">
                        Load Sample Data
                    </button>
                </div>
            </div>
        `;
    }

    async loadOrdersData() {
        if (!this.userData) return;

        const ordersList = document.getElementById('ordersList');
        if (this.userData.orders.length === 0) {
            ordersList.innerHTML = `
                <div class="muted" style="text-align: center; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                    <h3>No orders yet</h3>
                    <p>Your order history will appear here</p>
                    <button class="btn" onclick="window.location.href='shop.html'">Start Shopping</button>
                </div>
            `;
        } else {
            ordersList.innerHTML = this.userData.orders.map(order => `
                <div class="order-item">
                    <div class="row between">
                        <div>
                            <h4 style="margin: 0 0 4px 0;">Order #${order.id}</h4>
                            <p class="muted" style="margin: 0;">Placed on ${new Date(order.date).toLocaleDateString()}</p>
                        </div>
                        <div class="order-status status-${order.status}">${order.status}</div>
                    </div>
                    <div class="row between" style="margin-top: 12px; align-items: center;">
                        <div>
                            <strong>IQD ${order.total.toLocaleString()}</strong>
                            <div class="muted">${order.items.length} items</div>
                        </div>
                        <button class="btn-small btn secondary">View Details</button>
                    </div>
                </div>
            `).join('');
        }
    }

    async loadVehiclesData() {
        if (!this.userData) return;

        const vehiclesList = document.getElementById('vehiclesList');
        if (this.userData.vehicles.length === 0) {
            vehiclesList.innerHTML = `
                <div class="muted" style="text-align: center; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🚗</div>
                    <h3>No vehicles saved</h3>
                    <p>Add your vehicles to get personalized part recommendations</p>
                </div>
            `;
        } else {
            vehiclesList.innerHTML = this.userData.vehicles.map(vehicle => `
                <div class="vehicle-item">
                    <div class="row between">
                        <div>
                            <h4 style="margin: 0 0 4px 0;">${vehicle.nickname}</h4>
                            <p class="muted" style="margin: 0;">${vehicle.year} ${vehicle.make} ${vehicle.model}</p>
                        </div>
                        <button class="btn-small btn secondary" onclick="removeVehicle(${vehicle.id})">Remove</button>
                    </div>
                </div>
            `).join('');
        }
    }

    async loadAddressesData() {
        if (!this.userData) return;

        const addressesList = document.getElementById('addressesList');
        if (this.userData.addresses.length === 0) {
            addressesList.innerHTML = `
                <div class="muted" style="text-align: center; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🏠</div>
                    <h3>No addresses saved</h3>
                    <p>Add your shipping addresses for faster checkout</p>
                </div>
            `;
        } else {
            addressesList.innerHTML = this.userData.addresses.map(address => `
                <div class="address-item">
                    <div class="row between">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 4px 0;">${address.name}</h4>
                            <p style="margin: 0;">${address.street}</p>
                            <p style="margin: 0;">${address.area}, ${address.city}</p>
                            <p class="muted" style="margin: 4px 0 0 0;">${address.phone} • ${address.type}</p>
                        </div>
                        <div>
                            ${address.isDefault ? '<span class="chip" style="background: var(--red); color: white; margin-bottom: 8px;">Default</span>' : ''}
                            <button class="btn-small btn secondary" onclick="removeAddress(${address.id})">Remove</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    async loadProfileData() {
        // Profile data is already loaded in updateUserInterface
    }

    showLoginSection() {
        console.log('👤 Showing login section');
        // Reset to original login form
        const loginSection = document.getElementById('loginSection');
        loginSection.innerHTML = `
            <div class="card" style="max-width: 400px; margin: 40px auto; text-align: center;">
                <h1>Welcome Back</h1>
                <p class="muted" style="margin-bottom: 24px;">Sign in to your AlSaji account</p>

                <form id="loginForm">
                    <div class="form-group">
                        <label for="loginEmail">Email</label>
                        <input type="email" id="loginEmail" name="email" required placeholder="your@email.com" autocomplete="email">
                    </div>

                    <div class="form-group">
                        <label for="loginPassword">Password</label>
                        <input type="password" id="loginPassword" name="password" required placeholder="Enter your password" autocomplete="current-password">
                    </div>

                    <button type="submit" class="btn" style="width: 100%; margin-bottom: 16px;">
                        Sign In
                    </button>

                    <div class="row between" style="margin-bottom: 16px;">
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 14px;">
                            <input type="checkbox" name="remember"> Remember me
                        </label>
                        <a href="#" class="muted" style="font-size: 14px;">Forgot password?</a>
                    </div>
                </form>

                <div style="border-top: 1px solid var(--w1); padding-top: 16px;">
                    <p class="muted" style="margin-bottom: 12px;">Don't have an account?</p>
                    <button class="btn secondary" id="showRegister" style="width: 100%;">
                        Create Trade Account
                    </button>
                </div>
            </div>
        `;

        // Re-attach event listeners
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(loginForm);
            });
        }

        const showRegister = document.getElementById('showRegister');
        if (showRegister) {
            showRegister.addEventListener('click', () => {
                this.showRegisterForm();
            });
        }

        document.getElementById('loginSection').classList.add('active');
        document.getElementById('accountSection').classList.remove('active');
    }

    showAccountSection() {
        console.log('👤 Showing account section');
        document.getElementById('loginSection').classList.remove('active');
        document.getElementById('accountSection').classList.add('active');

        // Load initial tab data
        this.loadTabData('acctRetailView');
    }

    showRegisterForm() {
        this.showToast('Trade account registration - Contact sales@alsaji.com', 'info');
    }

    showToast(message, type = 'info') {
        console.log('📢 Toast:', message, type);
        if (window.cartManager && typeof window.cartManager.showToast === 'function') {
            window.cartManager.showToast(message, type);
        } else {
            // Simple fallback toast
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                z-index: 10000;
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }
}

// Global functions for UI interactions
function showSection(section) {
    const sections = document.querySelectorAll('.section-content');
    sections.forEach(sec => sec.classList.remove('active'));
    document.getElementById(section + 'Content').classList.add('active');
}

function showAddVehicleForm() {
    showSection('addVehicle');
}

function showVehiclesList() {
    showSection('vehicles');
}

function showAddAddressForm() {
    showSection('addAddress');
}

function showAddressesList() {
    showSection('addresses');
}

function removeVehicle(vehicleId) {
    if (confirm('Are you sure you want to remove this vehicle?')) {
        if (window.accountManager && window.accountManager.userData) {
            window.accountManager.userData.vehicles = window.accountManager.userData.vehicles.filter(v => v.id !== vehicleId);
            window.accountManager.userData.stats.vehiclesCount = window.accountManager.userData.vehicles.length;
            window.accountManager.saveUserData();
            window.accountManager.updateUserInterface();
            window.accountManager.loadVehiclesData();
            window.accountManager.showToast('Vehicle removed', 'success');
        }
    }
}

function removeAddress(addressId) {
    if (confirm('Are you sure you want to remove this address?')) {
        if (window.accountManager && window.accountManager.userData) {
            window.accountManager.userData.addresses = window.accountManager.userData.addresses.filter(a => a.id !== addressId);
            window.accountManager.saveUserData();
            window.accountManager.loadAddressesData();
            window.accountManager.showToast('Address removed', 'success');
        }
    }
}

function loadSampleOrders() {
    if (window.accountManager && window.accountManager.userData) {
        window.accountManager.showToast('Loading sample orders...', 'info');

        // Show a message that we're trying real data first
        setTimeout(async () => {
            try {
                // Try to load real data first
                await window.accountManager.loadRealOrdersData();

                // If no real orders, load samples
                if (window.accountManager.userData.orders.length === 0) {
                    const sampleOrders = [
                        {
                            id: 'ALS' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                            date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                            status: 'delivered',
                            total: 125000,
                            reference: 'WEB001',
                            items: [
                                { name: 'Oil Filter - Toyota Camry', quantity: 2, price: 25000 },
                                { name: 'Spark Plugs Set', quantity: 1, price: 75000 }
                            ]
                        },
                        {
                            id: 'ALS' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                            status: 'shipped',
                            total: 185000,
                            reference: 'WEB002',
                            items: [
                                { name: 'Air Filter', quantity: 1, price: 35000 },
                                { name: 'Brake Pads Set', quantity: 1, price: 120000 },
                                { name: 'Windshield Wipers', quantity: 1, price: 30000 }
                            ]
                        }
                    ];

                    window.accountManager.userData.orders = sampleOrders;
                    window.accountManager.userData.stats.ordersCount = sampleOrders.length;
                    window.accountManager.saveUserData();
                    window.accountManager.updateUserInterface();
                    window.accountManager.renderOrdersList();
                    window.accountManager.showToast('Sample orders loaded', 'success');
                } else {
                    window.accountManager.showToast('Real orders loaded from system!', 'success');
                }
            } catch (error) {
                window.accountManager.showToast('Using sample orders data', 'info');
            }
        }, 1000);
    }
}

function showChangePassword() {
    window.accountManager.showToast('Password change feature coming soon!', 'info');
}

// Add these global functions
function viewOrderDetails(orderId) {
    const order = window.accountManager.userData.orders.find(o => o.id === orderId);
    if (order) {
        const detailsHTML = `
            <div class="order-details">
                <h3>Order Details: ${order.id}</h3>
                <div class="grid cols-2" style="gap: 16px; margin-bottom: 16px;">
                    <div>
                        <strong>Order Date:</strong><br>
                        ${order.date.toLocaleDateString()}
                    </div>
                    <div>
                        <strong>Status:</strong><br>
                        <span class="order-status status-${order.status}">${window.accountManager.formatStatusText(order.status)}</span>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <strong>Items:</strong>
                    <div style="margin-top: 8px;">
                        ${order.items.map(item => `
                            <div style="padding: 8px; border-bottom: 1px solid var(--w1);">
                                <div class="row between">
                                    <span>${item.name}</span>
                                    <span>${item.quantity} x IQD ${item.price.toLocaleString()}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div style="border-top: 2px solid var(--red); padding-top: 12px;">
                    <div class="row between">
                        <strong>Total:</strong>
                        <strong>IQD ${order.total.toLocaleString()}</strong>
                    </div>
                </div>

                ${order.notes ? `
                    <div style="margin-top: 16px;">
                        <strong>Notes:</strong><br>
                        <p style="margin: 4px 0 0 0; font-style: italic;">${order.notes}</p>
                    </div>
                ` : ''}
            </div>
        `;

        // Show in a modal or alert (you can implement a proper modal)
        alert(`Order Details for ${order.id}\n\nStatus: ${window.accountManager.formatStatusText(order.status)}\nTotal: IQD ${order.total.toLocaleString()}\nItems: ${order.items.length}`);
    }
}

function requestReturn(orderId) {
    if (confirm('Would you like to request a return for this order?')) {
        window.accountManager.showToast('Return request submitted for order: ' + orderId, 'success');
        // Here you would typically make an API call to create a return request
    }
}

function trackOrder(orderId) {
    window.accountManager.showToast('Tracking information for order: ' + orderId, 'info');
    // Implement order tracking functionality
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing Enhanced Account Manager...');
    window.accountManager = new AccountManager();
});
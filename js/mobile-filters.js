// Mobile Filters - Enhanced with Homepage Vehicle Logic
class MobileFilters {
    constructor() {
        this._initialized = false;
        this._eventListeners = new Map();
        this.init();
    }

    init() {
        if (this._initialized) return;

        if (typeof shopState === 'undefined') {
            setTimeout(() => this.init(), 100);
            return;
        }

        this.setupEventListeners();
        this.setupMobileResponsive();
        this.waitForShopData();
        this._initialized = true;
    }

    waitForShopData() {
        if (shopState.allProducts && shopState.allProducts.length > 0) {
            console.log('✅ Shop data ready, populating filters...');
            this.populateFilterOptions();
        } else {
            console.log('⏳ Waiting for shop data...');
            setTimeout(() => this.waitForShopData(), 500);
        }
    }

    setupEventListeners() {
        const events = [
            ['#mobileFilterBtn', 'click', () => this.openFilterSheet()],
            ['#filterClose', 'click', () => this.closeFilterSheet()],
            ['#filterOverlay', 'click', () => this.closeFilterSheet()],
            ['#mobileApplyFilters', 'click', () => this.applyAllFilters()],
            ['#mobileClearFilters', 'click', () => this.clearFilters()]
        ];

        events.forEach(([selector, event, handler]) => {
            const element = document.querySelector(selector);
            if (element) {
                element.addEventListener(event, handler);
                this._eventListeners.set(selector, { element, event, handler });
            }
        });

        // Event delegation for section toggles
        document.addEventListener('click', (e) => {
            if (e.target.closest('.section-title')) {
                this.toggleSection(e.target.closest('.section-title'));
            }
        });

        // Setup vehicle filter events using homepage logic
        this.setupVehicleFilterEvents();
    }

setupVehicleFilterEvents() {
    const vehicleMake = document.getElementById('mobileVehicleMake');
    const vehicleModel = document.getElementById('mobileVehicleModel');
    const vehicleYear = document.getElementById('mobileVehicleYear');
    const applyVehicleBtn = document.getElementById('mobileApplyVehicle');

    if (vehicleMake) {
        vehicleMake.addEventListener('change', (e) => {
            this.onMakeChange(e.target.value);
            this.checkApplyButtonState();
        });
    }

    if (vehicleModel) {
        vehicleModel.addEventListener('change', (e) => {
            this.onModelChange(e.target.value);
            this.checkApplyButtonState();
        });
    }

    if (vehicleYear) {
        vehicleYear.addEventListener('change', () => {
            this.checkApplyButtonState();
        });
    }

    // Apply vehicle button
    if (applyVehicleBtn) {
        applyVehicleBtn.addEventListener('click', () => {
            this.applyVehicleFilter();
        });
    }

    // Clear vehicle button
    const clearVehicleBtn = document.getElementById('mobileClearVehicle');
    if (clearVehicleBtn) {
        clearVehicleBtn.addEventListener('click', () => {
            this.clearVehicleSelection();
        });
    }
}

    destroy() {
        this._eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this._eventListeners.clear();
        this._initialized = false;
    }

    setupMobileResponsive() {
        const checkMobile = () => {
            const isMobile = window.innerWidth <= 768;
            const mobileFilterBtn = document.getElementById('mobileFilterBtn');
            const desktopFilters = document.getElementById('desktopFilters');

            if (mobileFilterBtn) {
                mobileFilterBtn.style.display = isMobile ? 'inline-block' : 'none';
            }
            if (desktopFilters) {
                desktopFilters.style.display = isMobile ? 'none' : 'block';
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
    }

    openFilterSheet() {
        const sheet = document.getElementById('mobileFilterSheet');
        if (sheet) {
            sheet.classList.add('active');
            document.body.classList.add('filter-sheet-open');
            this.updateCurrentVehicleDisplay();
            this.populateVehicleFilters();
        }
    }

    closeFilterSheet() {
        const sheet = document.getElementById('mobileFilterSheet');
        if (sheet) {
            sheet.classList.remove('active');
            document.body.classList.remove('filter-sheet-open');
        }
    }

    toggleSection(button) {
        const sectionId = button.getAttribute('data-section');
        const sectionBody = document.getElementById(`${sectionId}Section`);

        if (sectionBody) {
            const isOpen = sectionBody.style.display === 'block';
            sectionBody.style.display = isOpen ? 'none' : 'block';

            const chevron = button.querySelector('.chevron');
            if (chevron) {
                chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            }

            button.classList.toggle('expanded', !isOpen);
        }
    }

    // VEHICLE FILTER METHODS USING HOMEPAGE LOGIC
    async populateVehicleFilters() {
        console.log('🚗 Populating mobile vehicle filters...');

        const vehicleMake = document.getElementById('mobileVehicleMake');
        const vehicleModel = document.getElementById('mobileVehicleModel');
        const vehicleYear = document.getElementById('mobileVehicleYear');
        const applyVehicleBtn = document.getElementById('mobileApplyVehicle');

        if (!vehicleMake) return;

        // Clear existing options
        vehicleMake.innerHTML = '<option value="">Select Make</option>';
        if (vehicleModel) {
            vehicleModel.innerHTML = '<option value="">Select Model</option>';
            vehicleModel.disabled = true;
        }
        if (vehicleYear) {
            vehicleYear.innerHTML = '<option value="">Select Year</option>';
            vehicleYear.disabled = true;
        }
        if (applyVehicleBtn) {
            applyVehicleBtn.disabled = true;
        }

        try {
            // Use the same logic as homepage
            await this.loadVehicleMakes();

            // Pre-select current vehicle if set
            if (shopState.filters.vehicle_make) {
                vehicleMake.value = shopState.filters.vehicle_make;
                await this.onMakeChange(shopState.filters.vehicle_make);

                if (shopState.filters.vehicle_model) {
                    setTimeout(async () => {
                        if (vehicleModel) {
                            vehicleModel.value = shopState.filters.vehicle_model;
                            await this.onModelChange(shopState.filters.vehicle_model);

                            if (shopState.filters.vehicle_year && vehicleYear) {
                                setTimeout(() => {
                                    vehicleYear.value = shopState.filters.vehicle_year;
                                    if (applyVehicleBtn) applyVehicleBtn.disabled = false;
                                }, 100);
                            }
                        }
                    }, 100);
                }
            }

        } catch (error) {
            console.error('❌ Error populating vehicle filters:', error);
        }

        // Show current vehicle if set
        this.updateCurrentVehicleDisplay();
    }

    // REUSED FROM HOMEPAGE
    async loadVehicleMakes() {
        try {
            const response = await fetch('data/json/vehicle_brands.json');

            if (response.ok) {
                const brandsData = await response.json();
                console.log('🚗 Loaded vehicle brands from JSON:', brandsData);

                const makeSelect = document.getElementById('mobileVehicleMake');
                if (makeSelect) {
                    makeSelect.innerHTML = '<option value="">Select Make</option>' +
                        brandsData.map(brand => {
                            const brandName = brand.name;
                            const brandId = brand.id;
                            const logoUrl = brand.logo && brand.logo.length > 0 ? brand.logo[0] : '';

                            return `<option value="${brandId}" data-logo="${logoUrl}">${brandName}</option>`;
                        }).join('');
                }
            } else {
                await this.loadVehicleMakesFromAPI();
            }
        } catch (error) {
            console.error('❌ Failed to load vehicle brands from JSON:', error);
            await this.loadVehicleMakesFromAPI();
        }
    }

    async onMakeChange(makeId) {
        const vehicleModel = document.getElementById('mobileVehicleModel');
        const vehicleYear = document.getElementById('mobileVehicleYear');
        const applyVehicleBtn = document.getElementById('mobileApplyVehicle');

        if (!vehicleModel) return;

        // Reset dependent fields
        vehicleModel.innerHTML = '<option value="">Select Model</option>';
        vehicleModel.disabled = !makeId;

        if (vehicleYear) {
            vehicleYear.innerHTML = '<option value="">Select Year</option>';
            vehicleYear.disabled = true;
        }

        if (applyVehicleBtn) {
            applyVehicleBtn.disabled = true;
        }

        if (!makeId) return;

        try {
            await this.loadVehicleModels(makeId);
            vehicleModel.disabled = false;
        } catch (error) {
            console.error('❌ Error loading models:', error);
            vehicleModel.innerHTML = '<option value="">No models found</option>';
        }
    }

async loadVehicleModels(makeId) {
    try {
        console.log('🚙 Loading vehicle models for make:', makeId);

        const response = await fetch('data/json/vehicle_models.json');
        const modelsData = await response.json();

        const modelSelect = document.getElementById('mobileVehicleModel');
        if (!modelSelect) return;

        console.log('🔍 First model sample:', modelsData[0]);
        console.log('🔍 Looking for models where brand_id array contains:', makeId);

        // FIXED: Handle brand_id as array
        const filteredModels = modelsData.filter(model => {
            if (!model.brand_id || !Array.isArray(model.brand_id)) {
                return false;
            }

            // Check if the brand_id array contains our makeId
            const matches = model.brand_id.some(brandId =>
                brandId == makeId ||
                brandId?.toString() === makeId?.toString()
            );

            if (matches) {
                console.log('✅ Matching model:', {
                    name: model.name,
                    brand_id: model.brand_id,
                    contains: makeId
                });
            }
            return matches;
        });

        console.log(`🎯 Found ${filteredModels.length} models for make ${makeId}`);

        if (filteredModels.length > 0) {
            modelSelect.innerHTML = '<option value="">Select Model</option>' +
                filteredModels.map(model => {
                    const modelName = model.name || 'Unknown Model';
                    const modelId = model.id;
                    const logoUrl = model.logo && model.logo.length > 0 ? model.logo[0] : '';

                    return `<option value="${modelId}" data-logo="${logoUrl}">${modelName}</option>`;
                }).join('');

            modelSelect.disabled = false;
            console.log('✅ Models populated successfully');
        } else {
            console.warn('⚠️ No models found for make:', makeId);
            modelSelect.innerHTML = '<option value="">No models found</option>';
            modelSelect.disabled = false;
        }

    } catch (error) {
        console.error('❌ Failed to load vehicle models:', error);
    }
}

async onModelChange(modelId) {
    const vehicleYear = document.getElementById('mobileVehicleYear');
    const applyVehicleBtn = document.getElementById('mobileApplyVehicle');

    if (!vehicleYear) return;

    console.log('📅 Model changed:', modelId);

    // Reset year field
    vehicleYear.innerHTML = '<option value="">Select Year</option>';
    vehicleYear.disabled = !modelId;

    if (applyVehicleBtn) {
        applyVehicleBtn.disabled = true;
    }

    if (!modelId) return;

    try {
        await this.loadVehicleYears();
        vehicleYear.disabled = false;
        console.log('✅ Years loaded for model:', modelId);
    } catch (error) {
        console.error('❌ Error loading years:', error);
    }
}
    // DEBUG METHOD - Add this to help troubleshoot
    debugVehicleData() {
        console.log('🐛 DEBUG Vehicle Data:');
        console.log('Vehicle Data Loaded:', vehicleDataLoaded);
        console.log('Makes:', vehicleData.makes?.length);
        console.log('Models:', vehicleData.models?.length);

        if (vehicleData.makes) {
            console.log('First make:', vehicleData.makes[0]);
        }
        if (vehicleData.models) {
            console.log('First few models:', vehicleData.models.slice(0, 3));
        }

        const makeSelect = document.getElementById('mobileVehicleMake');
        if (makeSelect) {
            console.log('Make select options:', makeSelect.options.length);
        }
    }
    async onModelChange(modelId) {
        const vehicleYear = document.getElementById('mobileVehicleYear');
        const applyVehicleBtn = document.getElementById('mobileApplyVehicle');

        if (!vehicleYear) return;

        // Reset year field
        vehicleYear.innerHTML = '<option value="">Select Year</option>';
        vehicleYear.disabled = !modelId;

        if (applyVehicleBtn) {
            applyVehicleBtn.disabled = true;
        }

        if (!modelId) return;

        try {
            await this.loadVehicleYears();
            vehicleYear.disabled = false;
        } catch (error) {
            console.error('❌ Error loading years:', error);
        }
    }

    // REUSED FROM HOMEPAGE
async loadVehicleYears() {
    const vehicleYear = document.getElementById('mobileVehicleYear');
    if (!vehicleYear) return;

    const currentYear = new Date().getFullYear();
    const startYear = 1990; // You can adjust this range

    let yearOptions = '<option value="">Select Year</option>';
    for (let year = currentYear; year >= startYear; year--) {
        yearOptions += `<option value="${year}">${year}</option>`;
    }

    vehicleYear.innerHTML = yearOptions;
    console.log(`✅ Loaded years from ${startYear} to ${currentYear}`);
}
applyVehicleFilter() {
    const vehicleMake = document.getElementById('mobileVehicleMake');
    const vehicleModel = document.getElementById('mobileVehicleModel');
    const vehicleYear = document.getElementById('mobileVehicleYear');

    if (!vehicleMake || !vehicleModel || !vehicleYear) {
        console.error('❌ Vehicle filter elements not found');
        return;
    }

    const makeId = vehicleMake.value;
    const modelId = vehicleModel.value;
    const year = vehicleYear.value;

    console.log('🔄 Applying vehicle filter:', { makeId, modelId, year });

    // Validate all fields are selected
    if (!makeId || !modelId || !year) {
        const missingFields = [];
        if (!makeId) missingFields.push('make');
        if (!modelId) missingFields.push('model');
        if (!year) missingFields.push('year');

        showNotification(`Please select ${missingFields.join(', ')}`, 'error');
        return;
    }

    // Get the display names
    const selectedMake = vehicleMake.options[vehicleMake.selectedIndex];
    const selectedModel = vehicleModel.options[vehicleModel.selectedIndex];

    const vehicle = {
        makeId: makeId,
        makeName: selectedMake.text,
        modelId: modelId,
        modelName: selectedModel.text,
        year: year
    };

    console.log('🚗 Vehicle selected:', vehicle);

    // Apply vehicle filter to shop state
    shopState.filters.vehicle_make = makeId;
    shopState.filters.vehicle_model = modelId;
    shopState.filters.vehicle_year = year;

    // Update URL
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('make', makeId);
    urlParams.set('model', modelId);
    urlParams.set('year', year);
    const newUrl = window.location.pathname + '?' + urlParams.toString();
    window.history.replaceState({}, '', newUrl);

    // Update vehicle manager if available
    if (window.vehicleManager) {
        window.vehicleManager.setVehicle(vehicle);
    }

    // Update display and apply filters
    this.updateCurrentVehicleDisplay();
    shopState.currentPage = 1;

    if (typeof applyFilters === 'function') {
        applyFilters();
    }

    showNotification(`Vehicle filter applied: ${vehicle.makeName} ${vehicle.modelName} ${vehicle.year}`, 'success');
    this.closeFilterSheet();
}
    updateCurrentVehicleDisplay() {
        const currentVehicleDisplay = document.getElementById('mobileCurrentVehicle');
        const currentVehicleText = document.getElementById('mobileCurrentVehicleText');

        if (!currentVehicleDisplay || !currentVehicleText) return;

        const hasVehicle = shopState.filters.vehicle_make && shopState.filters.vehicle_model && shopState.filters.vehicle_year;

        if (hasVehicle) {
            const vehicleNames = getVehicleNamesFromIds(
                shopState.filters.vehicle_make,
                shopState.filters.vehicle_model,
                shopState.filters.vehicle_year
            );
            currentVehicleText.textContent = `${vehicleNames.makeName} ${vehicleNames.modelName} ${vehicleNames.year}`;
            currentVehicleDisplay.style.display = 'block';
        } else {
            currentVehicleDisplay.style.display = 'none';
        }
    }

    clearVehicleSelection() {
        // Clear form fields
        const vehicleMake = document.getElementById('mobileVehicleMake');
        const vehicleModel = document.getElementById('mobileVehicleModel');
        const vehicleYear = document.getElementById('mobileVehicleYear');

        if (vehicleMake) vehicleMake.value = '';
        if (vehicleModel) {
            vehicleModel.innerHTML = '<option value="">Select Model</option>';
            vehicleModel.disabled = true;
        }
        if (vehicleYear) {
            vehicleYear.innerHTML = '<option value="">Select Year</option>';
            vehicleYear.disabled = true;
        }

        // Clear from shop state
        shopState.filters.vehicle_make = '';
        shopState.filters.vehicle_model = '';
        shopState.filters.vehicle_year = '';

        // Update URL
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.delete('make');
        urlParams.delete('model');
        urlParams.delete('year');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);

        // Clear from vehicle manager
        if (window.vehicleManager) {
            window.vehicleManager.clearVehicle();
        }

        // Update display and reload products
        this.updateCurrentVehicleDisplay();
        shopState.currentPage = 1;

        if (typeof applyFilters === 'function') {
            applyFilters();
        }

        showNotification('Vehicle filter cleared', 'success');
        this.closeFilterSheet();
    }

    // API fallback methods (same as homepage)
    async loadVehicleMakesFromAPI() {
        console.log('📡 Loading vehicle makes from API...');
        // Implement your API fallback here
    }

    async loadVehicleModelsFromAPI(makeId) {
        console.log('📡 Loading vehicle models from API for make:', makeId);
        // Implement your API fallback here
    }

    // Rest of the existing mobile filter methods remain the same...
    populateFilterOptions() {
        if (!shopState.allProducts?.length) return;

        requestAnimationFrame(() => {
            this.populateBrandPills();
            this.populateCategoryPills();
            this.populatePriceSlider();
        });
    }

    populateBrandPills() {
        const brandSection = document.getElementById('brandSection');
        if (!brandSection) return;

        const brandOptions = brandSection.querySelector('.filter-options');
        if (!brandOptions) return;

        if (!shopState.brands || shopState.brands.length === 0) {
            brandOptions.innerHTML = '<div class="muted">No brands available</div>';
            return;
        }

        const brandSet = new Set();
        shopState.allProducts.forEach(product => {
            if (product.brand) {
                const brandName = typeof product.brand === 'object' ? product.brand.name : product.brand;
                if (brandName && brandName !== 'No Brand') brandSet.add(brandName);
            }
        });

        const brands = Array.from(brandSet).sort();
        const brandPills = brands.map(brand => `
            <button class="filter-pill" data-filter-type="brand" data-filter-value="${brand}">${brand}</button>
        `).join('');

        brandOptions.innerHTML = `
            <button class="filter-pill active" data-filter-type="brand" data-filter-value="all">All Brands</button>
            ${brandPills}
        `;
    }

    populateCategoryPills() {
        const categorySection = document.getElementById('categorySection');
        if (!categorySection) return;

        const categoryOptions = categorySection.querySelector('.filter-options');
        if (!categoryOptions) return;

        if (!shopState.categories || shopState.categories.length === 0) {
            categoryOptions.innerHTML = '<div class="muted">No categories available</div>';
            return;
        }

        const categories = shopState.categories.map(category => {
            const categoryName = typeof category === 'object' ? category.name : category;
            return { value: categoryName, text: categoryName };
        });

        const categoryPills = categories.map(category => `
            <button class="filter-pill" data-filter-type="category" data-filter-value="${category.value}">${category.text}</button>
        `).join('');

        categoryOptions.innerHTML = `
            <button class="filter-pill active" data-filter-type="category" data-filter-value="all">All Categories</button>
            ${categoryPills}
        `;
    }

    populatePriceSlider() {
        const priceSection = document.getElementById('priceSection');
        if (!priceSection) return;

        const priceOptions = priceSection.querySelector('.filter-options');
        if (!priceOptions) return;

        if (!shopState.allProducts || shopState.allProducts.length === 0) {
            priceOptions.innerHTML = '<div class="muted">Price data not available</div>';
            return;
        }

        const prices = shopState.allProducts.map(p => p.price).filter(p => p > 0);
        const minPrice = Math.floor(Math.min(...prices) / 1000) * 1000;
        const maxPrice = Math.ceil(Math.max(...prices) / 1000) * 1000;

        const currentMin = shopState.filters.price_min || minPrice;
        const currentMax = shopState.filters.price_max || maxPrice;

        priceOptions.innerHTML = `
            <div class="price-slider-container">
                <div class="price-display">
                    <span>IQD </span><span id="min-price-display">${currentMin.toLocaleString()}</span>
                    <span> - IQD </span><span id="max-price-display">${currentMax.toLocaleString()}</span>
                </div>
                <div class="slider-wrapper">
                    <input type="range" id="min-price" min="${minPrice}" max="${maxPrice}" value="${currentMin}" step="1000" class="price-slider">
                    <input type="range" id="max-price" min="${minPrice}" max="${maxPrice}" value="${currentMax}" step="1000" class="price-slider">
                </div>
                <div class="price-slider-labels">
                    <span>${(minPrice/1000).toFixed(0)}K</span>
                    <span>${(maxPrice/1000).toFixed(0)}K</span>
                </div>
            </div>
        `;

        this.initializePriceSlider();
    }

    initializePriceSlider() {
        const minSlider = document.getElementById('min-price');
        const maxSlider = document.getElementById('max-price');
        const minDisplay = document.getElementById('min-price-display');
        const maxDisplay = document.getElementById('max-price-display');

        if (!minSlider || !maxSlider) return;

        const updateDisplays = () => {
            const minValue = parseInt(minSlider.value);
            const maxValue = parseInt(maxSlider.value);

            if (minValue > maxValue) {
                minSlider.value = maxValue;
                maxSlider.value = minValue;
            }

            if (minDisplay) minDisplay.textContent = parseInt(minSlider.value).toLocaleString();
            if (maxDisplay) maxDisplay.textContent = parseInt(maxSlider.value).toLocaleString();
        };

        minSlider.addEventListener('input', updateDisplays);
        maxSlider.addEventListener('input', updateDisplays);
    }

    getAllSelectedFilters() {
        const filters = {};

        // Brand
        const activeBrand = document.querySelector('#brandSection .filter-pill.active');
        if (activeBrand && activeBrand.dataset.filterValue !== 'all') {
            filters.brand = activeBrand.dataset.filterValue;
        }

        // Category
        const activeCategory = document.querySelector('#categorySection .filter-pill.active');
        if (activeCategory && activeCategory.dataset.filterValue !== 'all') {
            filters.category = activeCategory.dataset.filterValue;
        }

        // Stock
        const activeStock = document.querySelector('#stockSection .filter-pill.active');
        if (activeStock) {
            const stockSlug = activeStock.dataset.filterSlug;
            if (stockSlug === 'stock-true') filters.in_stock = true;
            else if (stockSlug === 'stock-false') filters.in_stock = false;
        }

        // Price
        const minSlider = document.getElementById('min-price');
        const maxSlider = document.getElementById('max-price');
        if (minSlider && maxSlider) {
            const minPrice = parseInt(minSlider.value);
            const maxPrice = parseInt(maxSlider.value);
            const prices = shopState.allProducts.map(p => p.price).filter(p => p > 0);
            const absoluteMin = Math.floor(Math.min(...prices) / 1000) * 1000;
            const absoluteMax = Math.ceil(Math.max(...prices) / 1000) * 1000;

            if (minPrice > absoluteMin || maxPrice < absoluteMax) {
                filters.price_min = minPrice;
                filters.price_max = maxPrice;
            }
        }

        // Vehicle filters
        if (shopState.filters.vehicle_make) filters.vehicle_make = shopState.filters.vehicle_make;
        if (shopState.filters.vehicle_model) filters.vehicle_model = shopState.filters.vehicle_model;
        if (shopState.filters.vehicle_year) filters.vehicle_year = shopState.filters.vehicle_year;

        return filters;
    }

    applyAllFilters() {
        const filters = this.getAllSelectedFilters();
        if (typeof window.applyFilters === 'function') {
            window.applyFilters(filters);
        }
        this.closeFilterSheet();
    }

    clearFilters() {
        // Reset pills
        document.querySelectorAll('.filter-options').forEach(container => {
            const allPill = container.querySelector('[data-filter-value="all"]');
            container.querySelectorAll('.filter-pill').forEach(pill => pill.classList.remove('active'));
            if (allPill) allPill.classList.add('active');
        });

        // Reset price sliders
        const minSlider = document.getElementById('min-price');
        const maxSlider = document.getElementById('max-price');
        if (minSlider && maxSlider) {
            const prices = shopState.allProducts.map(p => p.price).filter(p => p > 0);
            const minPrice = Math.floor(Math.min(...prices) / 1000) * 1000;
            const maxPrice = Math.ceil(Math.max(...prices) / 1000) * 1000;

            minSlider.value = minPrice;
            maxSlider.value = maxPrice;

            const minDisplay = document.getElementById('min-price-display');
            const maxDisplay = document.getElementById('max-price-display');
            if (minDisplay) minDisplay.textContent = minPrice.toLocaleString();
            if (maxDisplay) maxDisplay.textContent = maxPrice.toLocaleString();
        }

        if (typeof window.clearFilters === 'function') {
            window.clearFilters();
        }

        this.closeFilterSheet();
    }
   checkApplyButtonState() {
    const vehicleMake = document.getElementById('mobileVehicleMake');
    const vehicleModel = document.getElementById('mobileVehicleModel');
    const vehicleYear = document.getElementById('mobileVehicleYear');
    const applyVehicleBtn = document.getElementById('mobileApplyVehicle');

    if (!applyVehicleBtn) return;

    const isReady = vehicleMake?.value &&
                   vehicleModel?.value &&
                   vehicleYear?.value;

    applyVehicleBtn.disabled = !isReady;

    if (isReady) {
        console.log('✅ Apply button enabled - all fields selected');
    }
}

}

// Enhanced initialization with better error handling
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚗 Initializing mobile filters...');

        // Force reload vehicle data to ensure it's fresh
        vehicleDataLoaded = false;
        await loadVehicleData();

        console.log('📱 Vehicle data status:', {
            makes: vehicleData.makes?.length,
            models: vehicleData.models?.length,
            loaded: vehicleDataLoaded
        });

        if (!vehicleData.makes || vehicleData.makes.length === 0) {
            console.error('❌ No vehicle makes loaded');
            return;
        }

        if (typeof MobileFilters !== 'undefined') {
            window.mobileFilters = new MobileFilters();
            console.log('✅ Mobile filters initialized successfully');

            // Debug info
            setTimeout(() => {
                window.mobileFilters.debugVehicleData();
            }, 1000);
        }

    } catch (error) {
        console.error('❌ Error initializing mobile filters:', error);
        showNotification('Failed to load vehicle filters', 'error');
    }



});


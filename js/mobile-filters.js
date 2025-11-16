// SIMPLIFIED Mobile Filters - Focus on getting it working first
class MobileFilters {
    constructor() {
        this.init();
    }

    init() {
        console.log('📱 Initializing mobile filters...');
        this.setupEventListeners();
        this.setupMobileResponsive();

        // Wait a bit for shop data, then populate
        setTimeout(() => {
            this.populateFilterOptions();
        }, 1000);

        console.log('✅ Mobile filters initialized');
    }

    setupEventListeners() {
        console.log('🎯 Setting up mobile filter events...');

        // Mobile filter button
        const mobileFilterBtn = document.getElementById('mobileFilterBtn');
        if (mobileFilterBtn) {
            console.log('✅ Found mobile filter button');
            mobileFilterBtn.addEventListener('click', () => {
                console.log('🎯 Mobile filter button CLICKED');
                this.openFilterSheet();
            });
        }

        // Close buttons
        const filterClose = document.getElementById('filterClose');
        if (filterClose) {
            filterClose.addEventListener('click', () => {
                this.closeFilterSheet();
            });
        }

        const filterOverlay = document.getElementById('filterOverlay');
        if (filterOverlay) {
            filterOverlay.addEventListener('click', () => {
                this.closeFilterSheet();
            });
        }

        // Section toggles - make sure sections start closed
        document.querySelectorAll('.section-title').forEach(button => {
            const sectionId = button.getAttribute('data-section');
            const sectionBody = document.getElementById(`${sectionId}Section`);
            if (sectionBody) {
                sectionBody.style.display = 'none';
            }

            button.addEventListener('click', (e) => {
                this.toggleSection(e.currentTarget);
            });
        });

        // Filter pills
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-pill')) {
                this.handleFilterPill(e.target);
            }
        });

        // Apply filters - NOW HANDLES ALL FILTERS INCLUDING PRICE
        const applyBtn = document.getElementById('mobileApplyFilters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyAllFilters();
            });
        }

        // Clear filters
        const clearBtn = document.getElementById('mobileClearFilters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearFilters();
            });
        }
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
        console.log('📱 Opening mobile filter sheet...');
        const sheet = document.getElementById('mobileFilterSheet');
        if (sheet) {
            sheet.classList.add('active');
            document.body.classList.add('filter-sheet-open');
            console.log('✅ Filter sheet opened with active class');
        } else {
            console.log('❌ Filter sheet element not found');
        }
    }

    closeFilterSheet() {
        console.log('📱 Closing mobile filter sheet...');
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

            // Toggle chevron
            const chevron = button.querySelector('.chevron');
            if (chevron) {
                chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            }

            button.classList.toggle('expanded', !isOpen);
        }
    }

    populateFilterOptions() {
        console.log('📱 Populating filter options...');

        // Populate brand pills
        this.populateBrandPills();

        // Populate category pills
        this.populateCategoryPills();

        // Populate price slider
        this.populatePriceSlider();
    }

    // Updated price slider without individual apply button
    populatePriceSlider() {
        const priceOptions = document.querySelector('#priceSection .filter-options');
        if (!priceOptions) {
            console.log('❌ Price options container not found');
            return;
        }

        // Calculate min and max prices from products (in 1000 IQD steps)
        const prices = shopState.allProducts.map(p => p.price).filter(p => p > 0);
        const minPrice = Math.floor(Math.min(...prices) / 1000) * 1000;
        const maxPrice = Math.ceil(Math.max(...prices) / 1000) * 1000;

        const currentMin = shopState.filters.price_min || minPrice;
        const currentMax = shopState.filters.price_max || maxPrice;

        priceOptions.innerHTML = `
            <div class="price-slider-container">
                <div class="price-display">
                    <span>IQD </span>
                    <span id="min-price-display">${currentMin.toLocaleString()}</span>
                    <span> - IQD </span>
                    <span id="max-price-display">${currentMax.toLocaleString()}</span>
                </div>
                <div class="slider-wrapper">
                    <input type="range"
                           id="min-price"
                           min="${minPrice}"
                           max="${maxPrice}"
                           value="${currentMin}"
                           step="1000"
                           class="price-slider">
                    <input type="range"
                           id="max-price"
                           min="${minPrice}"
                           max="${maxPrice}"
                           value="${currentMax}"
                           step="1000"
                           class="price-slider">
                </div>
                <div class="price-slider-labels">
                    <span>${(minPrice/1000).toFixed(0)}K</span>
                    <span>${(maxPrice/1000).toFixed(0)}K</span>
                </div>

            </div>
        `;

        this.initializePriceSlider();
    }

    // Updated price slider initialization - no apply button needed
    initializePriceSlider() {
        const minSlider = document.getElementById('min-price');
        const maxSlider = document.getElementById('max-price');
        const minDisplay = document.getElementById('min-price-display');
        const maxDisplay = document.getElementById('max-price-display');

        if (!minSlider || !maxSlider) return;

        const updateDisplays = () => {
            const minValue = parseInt(minSlider.value);
            const maxValue = parseInt(maxSlider.value);

            // Ensure min doesn't exceed max and vice versa
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

    populateBrandPills() {
        const brandOptions = document.querySelector('#brandSection .filter-options');
        if (!brandOptions) {
            console.log('❌ Brand options container not found');
            return;
        }

        // Get brands from desktop select or extract from products
        const brandSelect = document.getElementById('filterBrand');
        if (brandSelect && brandSelect.options.length > 1) {
            let brandPills = '';
            Array.from(brandSelect.options).forEach(option => {
                if (option.value) {
                    brandPills += `
                        <button class="filter-pill" data-filter-type="brand" data-filter-value="${option.value}">
                            ${option.text}
                        </button>
                    `;
                }
            });

            brandOptions.innerHTML = `
                <button class="filter-pill active" data-filter-type="brand" data-filter-value="all">
                    All Brands
                </button>
                ${brandPills}
            `;
            console.log('✅ Brand pills populated:', brandSelect.options.length);
        } else {
            console.log('❌ No brand options found in desktop select');
        }
    }

    populateCategoryPills() {
        const categoryOptions = document.querySelector('#categorySection .filter-options');
        if (!categoryOptions) {
            console.log('❌ Category options container not found');
            return;
        }

        const categorySelect = document.getElementById('filterCategory');
        if (categorySelect && categorySelect.options.length > 1) {
            let categoryPills = '';
            Array.from(categorySelect.options).forEach(option => {
                if (option.value) {
                    categoryPills += `
                        <button class="filter-pill" data-filter-type="category" data-filter-value="${option.value}">
                            ${option.text}
                        </button>
                    `;
                }
            });

            categoryOptions.innerHTML = `
                <button class="filter-pill active" data-filter-type="category" data-filter-value="all">
                    All Categories
                </button>
                ${categoryPills}
            `;
            console.log('✅ Category pills populated:', categorySelect.options.length);
        } else {
            console.log('❌ No category options found in desktop select');
        }
    }

    handleFilterPill(pill) {
        const filterType = pill.dataset.filterType;
        const filterValue = pill.dataset.filterValue;

        console.log(`📱 Filter pill clicked: ${filterType} = ${filterValue}`);

        // Remove active class from other pills in same group
        const container = pill.closest('.filter-options');
        if (container) {
            container.querySelectorAll('.filter-pill').forEach(p => {
                p.classList.remove('active');
            });
        }

        // Add active class to clicked pill
        pill.classList.add('active');
    }

    // UPDATED: Now includes price filters
    getAllSelectedFilters() {
        const filters = {};

        // Get active brand
        const activeBrand = document.querySelector('#brandSection .filter-pill.active');
        if (activeBrand && activeBrand.dataset.filterValue !== 'all') {
            filters.brand = activeBrand.dataset.filterValue;
        }

        // Get active category
        const activeCategory = document.querySelector('#categorySection .filter-pill.active');
        if (activeCategory && activeCategory.dataset.filterValue !== 'all') {
            filters.category = activeCategory.dataset.filterValue;
        }

        // Get active stock
        const activeStock = document.querySelector('#stockSection .filter-pill.active');
        if (activeStock) {
            const stockSlug = activeStock.dataset.filterSlug;
            if (stockSlug === 'stock-true') {
                filters.in_stock = true;
            } else if (stockSlug === 'stock-false') {
                filters.in_stock = false;
            }
        }

        // Get price range from sliders
        const minSlider = document.getElementById('min-price');
        const maxSlider = document.getElementById('max-price');
        if (minSlider && maxSlider) {
            const minPrice = parseInt(minSlider.value);
            const maxPrice = parseInt(maxSlider.value);
            const prices = shopState.allProducts.map(p => p.price).filter(p => p > 0);
            const absoluteMin = Math.floor(Math.min(...prices) / 1000) * 1000;
            const absoluteMax = Math.ceil(Math.max(...prices) / 1000) * 1000;

            // Only apply price filter if it's different from the full range
            if (minPrice > absoluteMin || maxPrice < absoluteMax) {
                filters.price_min = minPrice;
                filters.price_max = maxPrice;
            }
        }

        console.log('📱 All selected filters:', filters);
        return filters;
    }

    // UPDATED: Apply all filters including price
    applyAllFilters() {
        const filters = this.getAllSelectedFilters();

        console.log('📱 Applying ALL mobile filters:', filters);

        // Use the main applyFilters function
        if (typeof window.applyFilters === 'function') {
            window.applyFilters(filters);
        } else {
            console.error('❌ applyFilters function not found');
        }

        this.closeFilterSheet();
    }

    clearFilters() {
        console.log('📱 Clearing all mobile filters');

        // Reset all pills to "all"
        document.querySelectorAll('.filter-options').forEach(container => {
            const allPill = container.querySelector('[data-filter-value="all"]');
            container.querySelectorAll('.filter-pill').forEach(pill => {
                pill.classList.remove('active');
            });
            if (allPill) {
                allPill.classList.add('active');
            }
        });

        // Reset price sliders to full range
        const minSlider = document.getElementById('min-price');
        const maxSlider = document.getElementById('max-price');
        if (minSlider && maxSlider) {
            const prices = shopState.allProducts.map(p => p.price).filter(p => p > 0);
            const minPrice = Math.floor(Math.min(...prices) / 1000) * 1000;
            const maxPrice = Math.ceil(Math.max(...prices) / 1000) * 1000;

            minSlider.value = minPrice;
            maxSlider.value = maxPrice;

            // Update displays
            const minDisplay = document.getElementById('min-price-display');
            const maxDisplay = document.getElementById('max-price-display');
            if (minDisplay) minDisplay.textContent = minPrice.toLocaleString();
            if (maxDisplay) maxDisplay.textContent = maxPrice.toLocaleString();
        }

        // Clear all filters using the main function
        if (typeof window.clearFilters === 'function') {
            window.clearFilters();
        }

        this.closeFilterSheet();
    }
}

// Initialize mobile filters when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mobileFilters = new MobileFilters();
});
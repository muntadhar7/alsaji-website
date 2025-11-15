// Mobile Filter Functionality
class MobileFilters {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.populateFilterOptions();
        this.setupMobileResponsive();
        this.syncWithDesktopFilters();
    }

    setupEventListeners() {
        // Toggle filter sheet
        const mobileFilterBtn = document.getElementById('mobileFilterBtn');
        if (mobileFilterBtn) {
            mobileFilterBtn.addEventListener('click', () => {
                this.openFilterSheet();
            });
        }

        // Close filter sheet
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

        // Section toggles
        document.querySelectorAll('.section-title').forEach(button => {
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

        // Apply filters
        const applyBtn = document.getElementById('mobileApplyFilters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyFilters();
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
        // Check if mobile and show/hide appropriate elements
        const checkMobile = () => {
            const isMobile = window.innerWidth <= 768;
            const mobileFilterBtn = document.getElementById('mobileFilterBtn');
            const desktopFilters = document.querySelector('.shop .grid > aside');

            if (mobileFilterBtn) {
                mobileFilterBtn.style.display = isMobile ? 'inline-block' : 'none';
            }

            if (desktopFilters) {
                desktopFilters.style.display = isMobile ? 'none' : 'block';
            }
        };

        // Check on load and resize
        checkMobile();
        window.addEventListener('resize', checkMobile);
    }

    openFilterSheet() {
        const sheet = document.getElementById('mobileFilterSheet');
        if (sheet) {
            sheet.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    closeFilterSheet() {
        const sheet = document.getElementById('mobileFilterSheet');
        if (sheet) {
            sheet.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    toggleSection(button) {
        const sectionId = button.getAttribute('data-section');
        const sectionBody = document.getElementById(`${sectionId}Section`);
        const isExpanded = button.getAttribute('aria-expanded') === 'true';

        button.setAttribute('aria-expanded', !isExpanded);
        if (sectionBody) {
            sectionBody.classList.toggle('open');
        }
    }

    handleFilterPill(pill) {
        const filterData = pill.getAttribute('data-filter');
        if (!filterData) return;

        const filterType = filterData.split('-')[0];

        // Remove active class from other pills in same group
        const allPills = document.querySelectorAll(`[data-filter^="${filterType}-"]`);
        allPills.forEach(p => {
            p.classList.remove('active');
        });

        // Add active class to clicked pill
        pill.classList.add('active');
    }

    populateFilterOptions() {
        // Wait a bit for the shop data to load
        setTimeout(() => {
            // Populate brand pills from your existing brand dropdown
            const brandSelect = document.getElementById('filterBrand');
            const brandOptions = document.getElementById('brandSection')?.querySelector('.filter-options');

            console.log('Brand select found:', !!brandSelect);
            console.log('Brand options found:', !!brandOptions);

            if (brandSelect && brandOptions) {
                console.log('Brand options count:', brandSelect.options.length);

                // Clear existing pills (keep "All Brands")
                const allBrandPill = brandOptions.querySelector('[data-filter="brand-all"]');
                brandOptions.innerHTML = '';
                if (allBrandPill) {
                    brandOptions.appendChild(allBrandPill);
                }

                Array.from(brandSelect.options).forEach(option => {
                    if (option.value && option.value !== '') {
                        const pill = document.createElement('button');
                        pill.className = 'filter-pill';
                        pill.setAttribute('data-filter', `brand-${option.value}`);
                        pill.textContent = option.text;
                        brandOptions.appendChild(pill);
                        console.log('Added brand pill:', option.text);
                    }
                });
            }

            // Populate category pills from your existing category dropdown
            const categorySelect = document.getElementById('filterCategory');
            const categoryOptions = document.getElementById('categorySection')?.querySelector('.filter-options');

            console.log('Category select found:', !!categorySelect);
            console.log('Category options found:', !!categoryOptions);

            if (categorySelect && categoryOptions) {
                console.log('Category options count:', categorySelect.options.length);

                // Clear existing pills (keep "All Categories")
                const allCategoryPill = categoryOptions.querySelector('[data-filter="category-all"]');
                categoryOptions.innerHTML = '';
                if (allCategoryPill) {
                    categoryOptions.appendChild(allCategoryPill);
                }

                Array.from(categorySelect.options).forEach(option => {
                    if (option.value && option.value !== '') {
                        const pill = document.createElement('button');
                        pill.className = 'filter-pill';
                        pill.setAttribute('data-filter', `category-${option.value}`);
                        pill.textContent = option.text;
                        categoryOptions.appendChild(pill);
                        console.log('Added category pill:', option.text);
                    }
                });
            }

            // Add event listeners to new pills
            document.querySelectorAll('.filter-pill').forEach(pill => {
                pill.addEventListener('click', (e) => {
                    this.handleFilterPill(e.target);
                });
            });

            console.log('Finished populating filter options');
        }, 1000); // Wait 1 second for data to load
    }
    syncWithDesktopFilters() {
        // Sync mobile filters with current desktop filter state
        const brandSelect = document.getElementById('filterBrand');
        const categorySelect = document.getElementById('filterCategory');
        const priceSelect = document.getElementById('filterPrice');
        const stockSelect = document.getElementById('filterStock');

        // Sync brand
        if (brandSelect && brandSelect.value) {
            const brandPill = document.querySelector(`[data-filter="brand-${brandSelect.value}"]`);
            if (brandPill) {
                document.querySelectorAll('[data-filter^="brand-"]').forEach(p => p.classList.remove('active'));
                brandPill.classList.add('active');
            }
        }

        // Sync category
        if (categorySelect && categorySelect.value) {
            const categoryPill = document.querySelector(`[data-filter="category-${categorySelect.value}"]`);
            if (categoryPill) {
                document.querySelectorAll('[data-filter^="category-"]').forEach(p => p.classList.remove('active'));
                categoryPill.classList.add('active');
            }
        }

        // Sync price
        if (priceSelect && priceSelect.value) {
            const pricePill = document.querySelector(`[data-filter="price-${priceSelect.value}"]`);
            if (pricePill) {
                document.querySelectorAll('[data-filter^="price-"]').forEach(p => p.classList.remove('active'));
                pricePill.classList.add('active');
            }
        }

        // Sync stock
        if (stockSelect && stockSelect.value) {
            const stockValue = stockSelect.value === 'True' ? 'true' : 'false';
            const stockPill = document.querySelector(`[data-filter="stock-${stockValue}"]`);
            if (stockPill) {
                document.querySelectorAll('[data-filter^="stock-"]').forEach(p => p.classList.remove('active'));
                stockPill.classList.add('active');
            }
        }
    }

    getSelectedFilters() {
        const filters = {
            brand: '',
            category: '',
            price: '',
            stock: ''
        };

        // Get active pills
        document.querySelectorAll('.filter-pill.active').forEach(pill => {
            const filterData = pill.getAttribute('data-filter');
            if (!filterData) return;

            const parts = filterData.split('-');
            const type = parts[0];
            const value = parts.slice(1).join('-');

            if (value !== 'all') {
                filters[type] = value;
            }
        });

        return filters;
    }

    applyFilters() {
        const filters = this.getSelectedFilters();

        // Update desktop filter dropdowns to match mobile selections
        const brandSelect = document.getElementById('filterBrand');
        const categorySelect = document.getElementById('filterCategory');
        const priceSelect = document.getElementById('filterPrice');
        const stockSelect = document.getElementById('filterStock');

        if (brandSelect) {
            brandSelect.value = filters.brand || '';
        }
        if (categorySelect) {
            categorySelect.value = filters.category || '';
        }
        if (priceSelect) {
            priceSelect.value = filters.price || '';
        }
        if (stockSelect) {
            stockSelect.value = filters.stock === 'true' ? 'True' : filters.stock === 'false' ? 'False' : '';
        }

        // Trigger filter change using your existing shop functionality
        if (typeof window.applyFilters === 'function') {
            window.applyFilters();
        } else {
            // Fallback: trigger change events
            if (brandSelect) brandSelect.dispatchEvent(new Event('change'));
            if (categorySelect) categorySelect.dispatchEvent(new Event('change'));
            if (priceSelect) priceSelect.dispatchEvent(new Event('change'));
            if (stockSelect) stockSelect.dispatchEvent(new Event('change'));
        }

        this.closeFilterSheet();
    }

    clearFilters() {
        // Reset all pills to "all"
        document.querySelectorAll('.filter-pill').forEach(pill => {
            pill.classList.remove('active');
        });

        // Activate "all" pills
        document.querySelectorAll('[data-filter$="-all"]').forEach(pill => {
            pill.classList.add('active');
        });

        // Clear desktop filters
        const brandSelect = document.getElementById('filterBrand');
        const categorySelect = document.getElementById('filterCategory');
        const priceSelect = document.getElementById('filterPrice');
        const stockSelect = document.getElementById('filterStock');

        if (brandSelect) brandSelect.value = '';
        if (categorySelect) categorySelect.value = '';
        if (priceSelect) priceSelect.value = '';
        if (stockSelect) stockSelect.value = '';

        // Trigger filter change using your existing shop functionality
        if (typeof window.clearFilters === 'function') {
            window.clearFilters();
        } else {
            // Fallback: trigger change events
            if (brandSelect) brandSelect.dispatchEvent(new Event('change'));
            if (categorySelect) categorySelect.dispatchEvent(new Event('change'));
            if (priceSelect) priceSelect.dispatchEvent(new Event('change'));
            if (stockSelect) stockSelect.dispatchEvent(new Event('change'));
        }

        this.closeFilterSheet();
    }
}

// Initialize mobile filters when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MobileFilters();
});

// Make functions globally available for your existing shop.js
window.applyProductFilters = function() {
    if (typeof window.applyFilters === 'function') {
        window.applyFilters();
    }
};

window.clearAllFilters = function() {
    if (typeof window.clearFilters === 'function') {
        window.clearFilters();
    }
};
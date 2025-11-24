// Shop UI Management - Responsive layout and mobile interactions
class ShopUI {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.handleResponsiveLayout();
        this.setupLoadingSkeleton();

        // Add resize listener
        window.addEventListener('resize', () => this.handleResponsiveLayout());
    }

    // Responsive layout handling
    handleResponsiveLayout() {
        const isMobile = window.innerWidth <= 768;
        const desktopFilters = document.getElementById('desktopFilters');
        const desktopSearchSort = document.querySelector('.desktop-search-sort');
        const mobileSearchSort = document.getElementById('mobileSearchSort');

        // Show/hide desktop filters and search
        if (desktopFilters) desktopFilters.style.display = isMobile ? 'none' : 'block';
        if (desktopSearchSort) desktopSearchSort.style.display = isMobile ? 'none' : 'flex';
        if (mobileSearchSort) mobileSearchSort.style.display = isMobile ? 'block' : 'none';
    }

    // Mobile search functionality
    setupMobileSearch() {
        const mobileSearchTrigger = document.getElementById('mobileSearchTrigger');
        const mobileSearchContainer = document.getElementById('mobileSearchContainer');
        const mobileSearchInput = document.getElementById('mobileSearchInput');
        const mobileSearchClose = document.getElementById('mobileSearchClose');

        if (mobileSearchTrigger) {
            mobileSearchTrigger.addEventListener('click', () => {
                mobileSearchContainer.style.display = 'block';
                mobileSearchTrigger.style.display = 'none';
                setTimeout(() => mobileSearchInput.focus(), 100);
            });
        }

        if (mobileSearchClose) {
            mobileSearchClose.addEventListener('click', () => {
                mobileSearchContainer.style.display = 'none';
                const searchTerm = mobileSearchInput.value.trim();
                if (searchTerm) {
                    this.performMobileSearch(searchTerm);
                }
            });
        }

        if (mobileSearchInput) {
            mobileSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    mobileSearchContainer.style.display = 'none';
                    this.performMobileSearch(e.target.value.trim());
                }
            });
        }
    }

    performMobileSearch(searchTerm) {
        shopState.currentPage = 1;
        shopState.filters.search = searchTerm;
        if (typeof applyFilters === 'function') {
            applyFilters();
        }
    }

    // Desktop search functionality
    setupDesktopSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');

        const performSearch = () => {
            const searchTerm = searchInput.value.trim();
            shopState.currentPage = 1;
            shopState.filters.search = searchTerm;
            if (typeof applyFilters === 'function') {
                applyFilters();
            }
        };

        if (searchButton) searchButton.addEventListener('click', performSearch);
        if (searchInput) searchInput.addEventListener('keypress', (e) => e.key === 'Enter' && performSearch());
    }

    // Mobile filter button
    setupMobileFilter() {
        const mobileFilterBtn = document.getElementById('mobileFilterBtn');
        if (mobileFilterBtn) {
            mobileFilterBtn.addEventListener('click', () => {
                const mobileFilterSheet = document.getElementById('mobileFilterSheet');
                if (mobileFilterSheet) {
                    mobileFilterSheet.classList.add('active');
                    document.body.classList.add('filter-sheet-open');
                }
            });
        }
    }

    // Mobile sort functionality
    setupMobileSort() {
        const mobileSortBtn = document.getElementById('mobileSortBtn');
        const mobileSortSheet = document.getElementById('mobileSortSheet');
        const sortOverlay = document.getElementById('sortOverlay');
        const sortClose = document.getElementById('sortClose');

        if (mobileSortBtn && mobileSortSheet) {
            mobileSortBtn.addEventListener('click', () => {
                mobileSortSheet.classList.add('active');
                document.body.classList.add('sort-sheet-open');
            });
        }

        const closeSortSheet = () => {
            mobileSortSheet.classList.remove('active');
            document.body.classList.remove('sort-sheet-open');
        };

        if (sortOverlay) sortOverlay.addEventListener('click', closeSortSheet);
        if (sortClose) sortClose.addEventListener('click', closeSortSheet);

        // Sort options
        const sortOptions = document.querySelectorAll('.sort-option');
        sortOptions.forEach(option => {
            option.addEventListener('click', function() {
                sortOptions.forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                const sortValue = this.dataset.sortValue;
                console.log('Sort by:', sortValue);
                // Add your sort logic here
                closeSortSheet();
            });
        });
    }

    // Loading skeleton
    setupLoadingSkeleton() {
        const productGrid = document.getElementById('productGrid');
        const loadingSkeleton = productGrid.querySelector('.loading-skeleton');

        if (loadingSkeleton) {
            loadingSkeleton.style.display = 'grid';
            loadingSkeleton.innerHTML = Array(12).fill(0).map(() => `
                <div class="card">
                    <div class="image loading"></div>
                    <div class="muted loading" style="height: 12px; margin: 4px 0"></div>
                    <div style="font-weight:500;margin:8px 0; height: 16px" class="loading"></div>
                    <div class="row between">
                        <div class="loading" style="height: 20px; width: 80px"></div>
                        <button class="btn loading" style="height: 32px; width: 60px" disabled></button>
                    </div>
                </div>
            `).join('');

            // Remove loading state when products load
            if (typeof loadProducts !== 'undefined') {
                const originalLoadProducts = window.loadProducts;
                window.loadProducts = async function() {
                    if (loadingSkeleton) {
                        loadingSkeleton.style.display = 'none';
                    }
                    return originalLoadProducts.apply(this, arguments);
                };
            }
        }
    }

    // Setup all event listeners
    setupEventListeners() {
        this.setupMobileSearch();
        this.setupDesktopSearch();
        this.setupMobileFilter();
        this.setupMobileSort();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.shopUI = new ShopUI();
    console.log('✅ Shop UI initialized');
});

// Close filter sheet function (for use in mobile-filters.js)
function closeFilterSheet() {
    const mobileFilterSheet = document.getElementById('mobileFilterSheet');
    if (mobileFilterSheet) {
        mobileFilterSheet.classList.remove('active');
        document.body.classList.remove('filter-sheet-open');
    }
}

// Close sort sheet function
function closeSortSheet() {
    const mobileSortSheet = document.getElementById('mobileSortSheet');
    if (mobileSortSheet) {
        mobileSortSheet.classList.remove('active');
        document.body.classList.remove('sort-sheet-open');
    }
}
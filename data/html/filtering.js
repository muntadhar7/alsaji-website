// filtering.js - Client-side filtering functionality
    class AlSajiFilter {
    constructor() {
        this.filters = {
            categories: [],
            brands: [],
            priceRange: null,
            searchQuery: ''
        };
        this.init();
    }

    async init() {
        if (window.filterData && window.searchIndex) {
            this.filterData = window.filterData;
            this.searchIndex = window.searchIndex;
            this.setupFilters();
            this.applyFilters();
        } else {
            console.error('Filter data not found.');
        }
    }

    setupFilters() {
        this.renderCategoryFilters();
        this.renderBrandFilters();
        this.renderPriceFilters();
        this.setupEventListeners();
    }

    renderCategoryFilters() {
        const container = document.getElementById('category-filters');
        if (!container) return;

        container.innerHTML = this.filterData.categories.map(category => `
            <label style="display: block; margin: 5px 0;">
                <input type="checkbox" value="${category.slug}" data-type="category">
                ${category.name} (${category.count})
            </label>
        `).join('');
    }

    renderBrandFilters() {
        const container = document.getElementById('brand-filters');
        if (!container) return;

        container.innerHTML = this.filterData.brands.map(brand => `
            <label style="display: block; margin: 5px 0;">
                <input type="checkbox" value="${brand.slug}" data-type="brand">
                ${brand.name} (${brand.count})
            </label>
        `).join('');
    }

renderPriceFilters() {
    const container = document.getElementById('price-filters');
    if (!container) return;

    // Get min and max prices from your data
    const minPrice = 0;
    const maxPrice = 1000000; // Adjust based on your data
    const currentMin = shopState.filters.price_min || minPrice;
    const currentMax = shopState.filters.price_max || maxPrice;

    container.innerHTML = `
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
                       class="price-slider">
                <input type="range"
                       id="max-price"
                       min="${minPrice}"
                       max="${maxPrice}"
                       value="${currentMax}"
                       class="price-slider">
            </div>
            <button id="apply-price-filter" class="btn" style="margin-top: 10px; width: 100%;">
                Apply Price Filter
            </button>
        </div>
    `;

    this.initializePriceSlider();
}

initializePriceSlider() {
    const minSlider = document.getElementById('min-price');
    const maxSlider = document.getElementById('max-price');
    const minDisplay = document.getElementById('min-price-display');
    const maxDisplay = document.getElementById('max-price-display');
    const applyBtn = document.getElementById('apply-price-filter');

    if (!minSlider || !maxSlider) return;

    // Update displays when sliders move
    minSlider.addEventListener('input', () => {
        const minValue = parseInt(minSlider.value);
        const maxValue = parseInt(maxSlider.value);

        // Ensure min doesn't exceed max
        if (minValue > maxValue) {
            minSlider.value = maxValue;
            return;
        }

        minDisplay.textContent = minValue.toLocaleString();
    });

    maxSlider.addEventListener('input', () => {
        const minValue = parseInt(minSlider.value);
        const maxValue = parseInt(maxSlider.value);

        // Ensure max doesn't go below min
        if (maxValue < minValue) {
            maxSlider.value = minValue;
            return;
        }

        maxDisplay.textContent = maxValue.toLocaleString();
    });

    // Apply filter on button click
    applyBtn.addEventListener('click', () => {
        const minValue = parseInt(minSlider.value);
        const maxValue = parseInt(maxSlider.value);

        shopState.filters.price_min = minValue;
        shopState.filters.price_max = maxValue;

        // Update URL
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('price_min', minValue);
        urlParams.set('price_max', maxValue);
        window.history.replaceState({}, '', `${window.location.pathname}?${urlParams}`);

        // Apply filters
        if (window.applyFilters) {
            applyFilters();
        }
    });
}

    setupEventListeners() {
        document.addEventListener('change', (e) => {
            if (e.target.matches('[data-type="category"], [data-type="brand"]')) {
                this.updateFilters();
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.matches('[name="price-range"]')) {
                this.updatePriceFilter(e.target.value);
            }
        });

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.searchQuery = e.target.value.toLowerCase();
                this.applyFilters();
            });
        }
    }

    updateFilters() {
        const categoryCheckboxes = document.querySelectorAll('[data-type="category"]:checked');
        this.filters.categories = Array.from(categoryCheckboxes).map(cb => cb.value);

        const brandCheckboxes = document.querySelectorAll('[data-type="brand"]:checked');
        this.filters.brands = Array.from(brandCheckboxes).map(cb => cb.value);

        this.applyFilters();
    }

    updatePriceFilter(priceRange) {
        if (priceRange) {
            const [min, max] = priceRange.split('-').map(Number);
            this.filters.priceRange = { min, max };
        } else {
            this.filters.priceRange = null;
        }
        this.applyFilters();
    }

    applyFilters() {
        const filteredProducts = this.searchIndex.filter(product => {
            if (this.filters.categories.length > 0) {
                const productCategorySlug = this.slugify(product.category);
                if (!this.filters.categories.includes(productCategorySlug)) {
                    return false;
                }
            }

            if (this.filters.brands.length > 0) {
                const productBrandSlug = this.slugify(product.brand);
                if (!this.filters.brands.includes(productBrandSlug)) {
                    return false;
                }
            }

            if (this.filters.priceRange) {
                if (product.price < this.filters.priceRange.min || 
                    product.price > this.filters.priceRange.max) {
                    return false;
                }
            }

            if (this.filters.searchQuery) {
                const searchTerm = this.filters.searchQuery.toLowerCase();
                const matchesSearch = product.search_terms.some(term => 
                    term && term.toLowerCase().includes(searchTerm)
                );
                if (!matchesSearch) {
                    return false;
                }
            }

            return true;
        });

        this.renderResults(filteredProducts);
    }

    renderResults(products) {
        const resultsContainer = document.getElementById('products-grid');
        const resultsCount = document.getElementById('results-count');

        if (resultsCount) {
            resultsCount.innerHTML = `<p>Showing ${products.length} of ${this.searchIndex.length} products</p>`;
        }

        if (!resultsContainer) return;

        if (products.length === 0) {
            resultsContainer.innerHTML = '<p>No products found matching your criteria.</p>';
            return;
        }

        resultsContainer.innerHTML = products.map(product => `
            <div class="product-card">
                <div class="product-name">${this.escapeHtml(product.name)}</div>
                <div class="product-price">$${product.price.toFixed(2)}</div>
                <div class="product-category">Category: ${this.escapeHtml(product.category)}</div>
                <div class="product-brand">Brand: ${this.escapeHtml(product.brand)}</div>
            </div>
        `).join('');
    }

    slugify(text) {
        if (!text) return 'unknown';
        return text.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

function clearFilters() {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[type="radio"]').forEach(rb => rb.checked = false);

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    if (window.alsajiFilter) {
        window.alsajiFilter.filters = {
            categories: [],
            brands: [],
            priceRange: null,
            searchQuery: ''
        };
        window.alsajiFilter.applyFilters();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.alsajiFilter = new AlSajiFilter();
});

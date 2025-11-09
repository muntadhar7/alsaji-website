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
        // Load data (assuming it's available as window.filterData and window.searchIndex)
        if (window.filterData && window.searchIndex) {
            this.filterData = window.filterData;
            this.searchIndex = window.searchIndex;
            this.setupFilters();
            this.applyFilters();
        } else {
            console.error('Filter data not found. Make sure filter-data.js and search-index.js are loaded.');
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

        container.innerHTML = this.filterData.price_ranges.map(range => `
            <label style="display: block; margin: 5px 0;">
                <input type="radio" name="price-range" value="${range.min}-${range.max}">
                ${range.label} (${range.count})
            </label>
        `).join('');
    }

    setupEventListeners() {
        // Category and brand filters
        document.addEventListener('change', (e) => {
            if (e.target.matches('[data-type="category"], [data-type="brand"]')) {
                this.updateFilters();
            }
        });

        // Price range filters
        document.addEventListener('change', (e) => {
            if (e.target.matches('[name="price-range"]')) {
                this.updatePriceFilter(e.target.value);
            }
        });

        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.searchQuery = e.target.value.toLowerCase();
                this.applyFilters();
            });
        }
    }

    updateFilters() {
        // Get selected categories
        const categoryCheckboxes = document.querySelectorAll('[data-type="category"]:checked');
        this.filters.categories = Array.from(categoryCheckboxes).map(cb => cb.value);

        // Get selected brands
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
            // Category filter
            if (this.filters.categories.length > 0) {
                const productCategorySlug = this.slugify(product.category);
                if (!this.filters.categories.includes(productCategorySlug)) {
                    return false;
                }
            }

            // Brand filter
            if (this.filters.brands.length > 0) {
                const productBrandSlug = this.slugify(product.brand);
                if (!this.filters.brands.includes(productBrandSlug)) {
                    return false;
                }
            }

            // Price filter
            if (this.filters.priceRange) {
                if (product.price < this.filters.priceRange.min || 
                    product.price > this.filters.priceRange.max) {
                    return false;
                }
            }

            // Search filter
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

// Clear filters function
function clearFilters() {
    // Uncheck all checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[type="radio"]').forEach(rb => rb.checked = false);

    // Clear search
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    // Reset filters and reapply
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

// Initialize filter when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.alsajiFilter = new AlSajiFilter();
});

import json
import os
import re

import requests
from datetime import datetime
import time
import hashlib
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class AlSajiDataExporter:
    def __init__(self, base_url="http://localhost:8069", db_name="alsaji_copy"):
        self.base_url = base_url
        self.db_name = db_name
        self.output_dir = "data"
        self.json_dir = os.path.join(self.output_dir, "json")
        self.html_dir = os.path.join(self.output_dir, "html")
        self.cache_file = os.path.join(self.output_dir, "data_hash.txt")

        # Create session with retry strategy
        self.session = requests.Session()
        self.setup_session()
        self.setup_directories()


    def get_data_hash(self, data):
        """Generate hash of data to check for changes"""
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.md5(data_str.encode()).hexdigest()

    def has_data_changed(self, new_data):
        """Check if data has changed since last export"""
        if not os.path.exists(self.cache_file):
            return True

        try:
            with open(self.cache_file, 'r') as f:
                old_hash = f.read().strip()

            new_hash = self.get_data_hash(new_data)
            return old_hash != new_hash
        except:
            return True

    def save_data_hash(self, data):
        """Save current data hash"""
        data_hash = self.get_data_hash(data)
        with open(self.cache_file, 'w') as f:
            f.write(data_hash)

    def setup_session(self):
        """Setup session with retry strategy and headers"""
        # Retry strategy
        retry_strategy = Retry(
            total=3,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS"],
            backoff_factor=1
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # Set headers to mimic browser
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
        })

    def setup_directories(self):
        """Create necessary directories"""
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.json_dir, exist_ok=True)
        os.makedirs(self.html_dir, exist_ok=True)

    def initialize_session(self):
        """Initialize session by visiting Odoo web interface first"""
        print("Initializing session...")
        try:
            # First, access the web interface to establish session with database
            init_url = f"{self.base_url}/web"
            params = {'db': self.db_name}
            response = self.session.get(init_url, params=params, timeout=10)
            print(f"Session initialization: {response.status_code}")

            # If we get a session cookie, we're good
            if 'session_id' in self.session.cookies:
                print("Session cookie obtained successfully")
            else:
                print("No session cookie received, trying alternative approach...")
                # Try logging in as public user
                self._try_public_login()

        except Exception as e:
            print(f"Session initialization failed: {e}")

    def _try_public_login(self):
        """Alternative: Try to simulate public user access"""
        try:
            # Access the website sale page to get session
            login_url = f"{self.base_url}/web/login"
            data = {
                'login': '',
                'password': '',
                'redirect': '/shop'
            }
            response = self.session.post(login_url, data=data, timeout=10)
            print(f"Public access attempt: {response.status_code}")
        except Exception as e:
            print(f"Public access failed: {e}")

    def make_request(self, endpoint, params=None):
        """Make API request with session"""
        try:
            url = f"{self.base_url}{endpoint}"

            # Add database to params for initial requests
            if params is None:
                params = {}

            # Only add db param if we don't have a session yet
            if 'session_id' not in self.session.cookies:
                params['db'] = self.db_name

            response = self.session.get(url, params=params, timeout=30)

            # If we get redirected to login, we need to reinitialize session
            if response.status_code == 303 or '/web/login' in response.url:
                print("Session expired, reinitializing...")
                self.initialize_session()
                # Retry the request
                response = self.session.get(url, params=params, timeout=30)

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            print(f"Error fetching {endpoint}: {e}")
            return None

    def fetch_products(self, limit=1000):
        """Fetch all products with pagination"""
        print("Fetching products...")

        # Ensure session is initialized
        if 'session_id' not in self.session.cookies:
            self.initialize_session()

        all_products = []
        page = 1
        page_size = 1000
        offset = 0

        while True:
            params = {
                'page': page,
                'limit': page_size,
                'offset': offset
            }
            data = self.make_request('/api/alsaji/products', params)

            if not data or 'products' not in data or not data['products']:
                break

            all_products.extend(data['products'])
            print(f"Fetched page {page} with {len(data['products'])} products")

            if len(data['products']) < page_size:
                break

            page += 1
            offset += len(data['products'])
            time.sleep(0.1)

        print(f"Total products fetched: {len(all_products)}")
        return all_products

    # ... rest of your methods (fetch_categories, fetch_brands, etc.) stay the same

    def fetch_categories(self):
        """Fetch categories"""
        print("Fetching categories...")
        return self.make_request('/api/alsaji/categories') or []

    def fetch_brands(self):
        """Fetch brands"""
        print("Fetching brands...")
        return self.make_request('/api/alsaji/brands') or []

    def fetch_branches(self):
        """Fetch branches"""
        print("Fetching branches...")
        return self.make_request('/api/alsaji/branches') or []

    def generate_filter_data(self, products, categories, brands, branches):
        """Generate JSON data for filtering - FIXED VERSION"""
        print("Generating filter data...")

        # Extract unique values for filtering
        filter_data = {
            "categories": [],
            "brands": [],
            "price_ranges": self.calculate_price_ranges(products),
            "branches": [],
            "last_updated": datetime.now().isoformat()
        }

        # Process categories - FIXED: Handle both string and object categories
        category_count = {}
        for product in products:
            category = product.get('category')
            if category:
                # Handle both string and object formats
                if isinstance(category, dict):
                    category_name = category.get('name', 'Unknown')
                else:
                    category_name = str(category)

                category_count[category_name] = category_count.get(category_name, 0) + 1

        filter_data["categories"] = [
            {
                "name": name,
                "count": count,
                "slug": self.slugify(name)
            }
            for name, count in category_count.items()
        ]

        # Process brands - FIXED: Handle both string and object brands
        brand_count = {}
        for product in products:
            brand = product.get('brand')
            if brand:
                # Handle both string and object formats
                if isinstance(brand, dict):
                    brand_name = brand.get('name', 'Unknown')
                else:
                    brand_name = str(brand)

                brand_count[brand_name] = brand_count.get(brand_name, 0) + 1

        filter_data["brands"] = [
            {
                "name": name,
                "count": count,
                "slug": self.slugify(name)
            }
            for name, count in brand_count.items()
        ]

        # Process branches - FIXED: Handle branch data structure
        branch_count = {}
        for product in products:
            branches_data = product.get('branches', [])
            if branches_data:
                for branch in branches_data:
                    if isinstance(branch, dict):
                        branch_name = branch.get('name', 'Unknown')
                    else:
                        branch_name = str(branch)

                    branch_count[branch_name] = branch_count.get(branch_name, 0) + 1

        filter_data["branches"] = [
            {
                "name": name,
                "count": count,
                "slug": self.slugify(name)
            }
            for name, count in branch_count.items()
        ]

        return filter_data

    def calculate_price_ranges(self, products):
        """Calculate price ranges for filtering"""
        prices = []
        for product in products:
            price = product.get('price')
            if price is not None:
                try:
                    prices.append(float(price))
                except (ValueError, TypeError):
                    continue

        if not prices:
            return []

        min_price = min(prices)
        max_price = max(prices)

        # Create price ranges
        ranges = []
        if min_price == max_price:
            # All prices are the same
            ranges.append({
                "min": min_price,
                "max": max_price,
                "count": len(prices),
                "label": f"${min_price:.2f}"
            })
        else:
            step = max(1, (max_price - min_price) // 5)
            current = min_price

            while current <= max_price:
                range_max = current + step
                count = len([p for p in prices if current <= p <= range_max])

                if count > 0:
                    ranges.append({
                        "min": current,
                        "max": range_max,
                        "count": count,
                        "label": f"${current:.2f} - ${range_max:.2f}"
                    })

                current = range_max + 0.01  # Small increment to avoid overlaps

        return ranges

    def generate_search_index(self, products):
        """Generate search index for quick client-side search"""
        print("Generating search index...")

        search_index = []
        for product in products:
            # Handle category name extraction safely
            category = product.get('category')
            if isinstance(category, dict):
                category_name = category.get('name', '')
            else:
                category_name = str(category) if category else ''

            # Handle brand name extraction safely
            brand = product.get('brand')
            if isinstance(brand, dict):
                brand_name = brand.get('name', '')
            else:
                brand_name = str(brand) if brand else ''

            # Handle price safely
            try:
                price = float(product.get('price', 0)) if product.get('price') else 0
            except (ValueError, TypeError):
                price = 0

            search_item = {
                "id": product.get('id'),
                "name": product.get('name', ''),
                "category": category_name,
                "brand": brand_name,
                "price": price,
                "slug": self.slugify(product.get('name', '')),
                "search_terms": [
                    product.get('name', ''),
                    category_name,
                    brand_name,
                    str(product.get('description', ''))[:100]
                ]
            }
            search_index.append(search_item)

        return search_index

    def generate_html_pages(self, products, categories, brands):
        """Generate HTML pages for products, categories, and brands"""
        print("Generating HTML pages...")

        # Products page
        self.generate_products_page(products)

        # Categories page
        self.generate_categories_page(categories)

        # Brands page
        self.generate_brands_page(brands)

        # Individual product pages (limited for performance)
        self.generate_individual_product_pages(products[:20])

    def generate_products_page(self, products):
        """Generate main products page - FIXED FORMATTING"""

        # Safely extract category and brand names
        def get_safe_value(product, field):
            value = product.get(field)
            if isinstance(value, dict):
                return value.get('name', 'N/A')
            return str(value) if value else 'N/A'

        def format_price(price):
            """Safely format price"""
            try:
                return f"${float(price):.2f}"
            except (ValueError, TypeError):
                return "$0.00"

        # Build product cards HTML
        product_cards_html = ""
        for product in products[:50]:  # Limit to first 50 for performance
            category_name = get_safe_value(product, 'category')
            brand_name = get_safe_value(product, 'brand')
            price = product.get('price', 0)
            formatted_price = format_price(price)

            product_cards_html += f"""
                <div class="product-card" 
                     data-category="{self.slugify(category_name)}" 
                     data-brand="{self.slugify(brand_name)}" 
                     data-price="{price}">
                    <div class="product-name">{product.get('name', 'N/A')}</div>
                    <div class="product-price">{formatted_price}</div>
                    <div class="product-category">Category: {category_name}</div>
                    <div class="product-brand">Brand: {brand_name}</div>
                </div>
            """

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Al Saji - Products</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .products-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }}
        .product-card {{ border: 1px solid #ddd; padding: 15px; border-radius: 8px; }}
        .product-name {{ font-weight: bold; margin-bottom: 10px; }}
        .product-price {{ color: #2c5aa0; font-size: 1.2em; }}
        .filter-section {{ margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px; }}
        .filter-group {{ margin-bottom: 15px; }}
        .last-updated {{ color: #666; font-size: 0.9em; margin-top: 20px; }}
    </style>
</head>
<body>
    <h1>Al Saji Products</h1>
    <p>Total products: {len(products)}</p>

    <div class="filter-section">
        <h3>Filters</h3>
        <input type="text" id="search-input" placeholder="Search products..." style="width: 100%; padding: 8px; margin-bottom: 15px;">

        <div class="filter-group">
            <h4>Categories</h4>
            <div id="category-filters"></div>
        </div>

        <div class="filter-group">
            <h4>Brands</h4>
            <div id="brand-filters"></div>
        </div>

        <div class="filter-group">
            <h4>Price Range</h4>
            <div id="price-filters"></div>
        </div>

        <button onclick="clearFilters()" style="padding: 8px 15px; margin-top: 10px;">Clear All Filters</button>
    </div>

    <div id="results-count"></div>
    <div class="products-grid" id="products-grid">
        {product_cards_html}
    </div>

    <div class="last-updated">
        Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    </div>

    <script src="../json/filter-data.js"></script>
    <script src="../json/search-index.js"></script>
    <script src="filtering.js"></script>
</body>
</html>"""

        with open(os.path.join(self.html_dir, "products.html"), "w", encoding="utf-8") as f:
            f.write(html_content)

    def generate_categories_page(self, categories):
        """Generate categories page"""
        categories_list_html = ""
        for category in categories:
            category_name = category.get('name', 'N/A') if isinstance(category, dict) else str(category)
            categories_list_html += f'<li>{category_name}</li>'

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Al Saji - Categories</title>
</head>
<body>
    <h1>Product Categories</h1>
    <ul>
        {categories_list_html}
    </ul>
    <a href="products.html">← Back to Products</a>
</body>
</html>"""

        with open(os.path.join(self.html_dir, "categories.html"), "w", encoding="utf-8") as f:
            f.write(html_content)

    def generate_brands_page(self, brands):
        """Generate brands page"""
        brands_list_html = ""
        for brand in brands:
            brand_name = brand.get('name', 'N/A') if isinstance(brand, dict) else str(brand)
            brands_list_html += f'<li>{brand_name}</li>'

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Al Saji - Brands</title>
</head>
<body>
    <h1>Brands</h1>
    <ul>
        {brands_list_html}
    </ul>
    <a href="products.html">← Back to Products</a>
</body>
</html>"""

        with open(os.path.join(self.html_dir, "brands.html"), "w", encoding="utf-8") as f:
            f.write(html_content)

    def generate_individual_product_pages(self, products):
        """Generate individual product pages (first 20 as example)"""
        products_dir = os.path.join(self.html_dir, "products")
        os.makedirs(products_dir, exist_ok=True)

        for product in products:
            product_slug = self.slugify(product.get('name', f"product-{product.get('id')}"))

            # Safely extract category and brand names
            category_name = product.get('category')
            if isinstance(category_name, dict):
                category_name = category_name.get('name', 'N/A')
            else:
                category_name = str(category_name) if category_name else 'N/A'

            brand_name = product.get('brand')
            if isinstance(brand_name, dict):
                brand_name = brand_name.get('name', 'N/A')
            else:
                brand_name = str(brand_name) if brand_name else 'N/A'

            # Safely format price
            try:
                formatted_price = f"${float(product.get('price', 0)):.2f}"
            except (ValueError, TypeError):
                formatted_price = "$0.00"

            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{product.get('name', 'Product')} - Al Saji</title>
</head>
<body>
    <h1>{product.get('name', 'N/A')}</h1>
    <p><strong>Price:</strong> {formatted_price}</p>
    <p><strong>Category:</strong> {category_name}</p>
    <p><strong>Brand:</strong> {brand_name}</p>
    <p><strong>Description:</strong> {product.get('description', 'No description available')}</p>
    <a href="../products.html">← Back to Products</a>
</body>
</html>"""

            with open(os.path.join(products_dir, f"{product_slug}.html"), "w", encoding="utf-8") as f:
                f.write(html_content)

    def save_json_data(self, data, filename, as_js_module=False):
        """Save data as JSON or JS module"""
        filepath = os.path.join(self.json_dir, filename)

        if as_js_module:
            # Save as JavaScript module for direct inclusion in HTML
            js_content = f"window.{filename.replace('.js', '')} = {json.dumps(data, indent=2, ensure_ascii=False)};"
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(js_content)
        else:
            # Save as regular JSON
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)


    def safe_filename(self, name):
        """
        Convert a string into a safe filename by:
        - Replacing whitespace and tabs with '-'
        - Removing invalid characters for Windows filenames
        """
        # Replace any whitespace (space, tab, newline) with a dash
        name = re.sub(r'\s+', '-', name)

        # Remove invalid characters for Windows filenames: \ / : * ? " < > |
        name = re.sub(r'[\\/:*?"<>|]', '', name)

        # Optionally, lowercase everything
        name = name.lower()

        return name

    def slugify(self, text):
        """Convert text to URL-friendly slug"""
        if not text:
            return "unknown"
        text = self.safe_filename(text)
        return (text.lower()
                .replace(' ', '-')
                .replace('/', '-')
                .replace('\\', '-')
                .replace('&', 'and')
                .replace('%', '')
                .replace('?', '')
                .replace('#', '')
                .replace('--', '-')
                .strip('-'))

    def export_all_data(self, force_update=False):
        """Main method to export all data"""
        print("Starting Al Saji data export...")

        # Fetch data from API
        products = self.fetch_products()
        categories = self.fetch_categories()
        brands = self.fetch_brands()
        branches = self.fetch_branches()

        if not products:
            print("No products fetched. Exiting.")
            return

        # Combine all data for change detection
        all_data = {
            "products": products,
            "categories": categories,
            "brands": brands,
            "branches": branches
        }

        # Check if data has changed
        if not force_update and not self.has_data_changed(all_data):
            print("Data has not changed since last export. Use force_update=True to force export.")
            return

        # Generate filter data and search index
        filter_data = self.generate_filter_data(products, categories, brands, branches)
        search_index = self.generate_search_index(products)

        # Save JSON files
        self.save_json_data(products, "products.json")
        self.save_json_data(categories, "categories.json")
        self.save_json_data(brands, "brands.json")
        self.save_json_data(branches, "branches.json")
        self.save_json_data(filter_data, "filter-data.json")
        self.save_json_data(search_index, "search-index.json")

        # Save as JS modules for direct browser use
        self.save_json_data(filter_data, "filter-data.js", as_js_module=True)
        self.save_json_data(search_index, "search-index.js", as_js_module=True)

        # Generate HTML pages
        self.generate_html_pages(products, categories, brands)

        # Save filtering JavaScript
        self.save_filtering_js()

        # Generate metadata
        metadata = {
            "export_date": datetime.now().isoformat(),
            "total_products": len(products),
            "total_categories": len(categories),
            "total_brands": len(brands),
            "total_branches": len(branches),
            "data_hash": self.get_data_hash(all_data)
        }

        with open(os.path.join(self.output_dir, "metadata.json"), "w") as f:
            json.dump(metadata, f, indent=2)

        # Save current data hash
        self.save_data_hash(all_data)

        print(f"\nExport completed!")
        print(f"✓ JSON files saved to: {self.json_dir}")
        print(f"✓ HTML pages saved to: {self.html_dir}")
        print(f"✓ Total products: {len(products)}")
        print(f"✓ Total categories: {len(categories)}")
        print(f"✓ Total brands: {len(brands)}")
        print(f"✓ Data hash saved for change detection")

    def save_filtering_js(self):
        """Save the filtering JavaScript file"""
        filtering_js = """// filtering.js - Client-side filtering functionality
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
            .replace(/\\s+/g, '-')
            .replace(/[^\\w-]+/g, '')
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
"""

        with open(os.path.join(self.html_dir, "filtering.js"), "w", encoding="utf-8") as f:
            f.write(filtering_js)


# Usage with options
if __name__ == "__main__":
    exporter = AlSajiDataExporter()

    # Export with change detection (default)
    exporter.export_all_data()

    # Or force update regardless of changes
    # exporter.export_all_data(force_update=True)
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
    def __init__(self, base_url="https://alsajigroup-staging-24665929.dev.odoo.com",
                 db_name="alsajigroup-staging-24665929",
                 username="mntr59@gmail.com", password="0212"):
        self.base_url = base_url.rstrip('/')  # Remove trailing slash
        self.db_name = db_name
        self.username = username
        self.password = password
        self.output_dir = "data"
        self.json_dir = os.path.join(self.output_dir, "json")
        self.html_dir = os.path.join(self.output_dir, "html")
        self.cache_file = os.path.join(self.output_dir, "data_hash.txt")
        self.uid = None  # User ID after authentication

        # Create session with retry strategy
        self.session = requests.Session()
        self.setup_session()
        self.setup_directories()

    def authenticate(self):
        """Authenticate with Odoo and get user ID"""
        print("Authenticating with Odoo...")
        try:
            auth_url = f"{self.base_url}/web/session/authenticate"
            auth_data = {
                'jsonrpc': '2.0',
                'params': {
                    'db': self.db_name,
                    'login': self.username,
                    'password': self.password,
                },
                'id': 1
            }

            print(f"Auth URL: {auth_url}")
            print(f"Database: {self.db_name}")
            print(f"Username: {self.username}")

            response = self.session.post(auth_url, json=auth_data, timeout=30)
            print(f"Auth Response Status: {response.status_code}")

            result = response.json()

            if result.get('result'):
                user_data = result['result']
                self.uid = user_data.get('uid')
                print(f"Authentication successful. User ID: {self.uid}")
                return True
            else:
                error = result.get('error', {})
                print(f"Authentication failed: {error.get('message', 'Unknown error')}")
                print(f"Error data: {error.get('data', {})}")
                return False

        except Exception as e:
            print(f"Authentication error: {e}")
            return False

    def call_odoo_api(self, model, method, domain=None, fields=None, limit=100, offset=0):
        """Make Odoo JSON-RPC API call"""
        try:
            url = f"{self.base_url}/jsonrpc"

            # Build the arguments based on the method
            if method == 'search_read':
                # For search_read, we need to pass domain, fields, offset, limit as keyword arguments
                kwargs = {
                    'domain': domain or [],
                    'fields': fields or [],
                    'offset': offset,
                    'limit': limit,
                    'order': 'id'
                }
                args = [
                    self.db_name,
                    self.uid,
                    self.password,
                    model,
                    method,
                    [],  # empty domain in args since we use kwargs
                    kwargs
                ]
            else:
                # For other methods
                args = [
                    self.db_name,
                    self.uid,
                    self.password,
                    model,
                    method,
                    domain or [],
                    fields or {}
                ]

            data = {
                'jsonrpc': '2.0',
                'method': 'call',
                'params': {
                    'service': 'object',
                    'method': 'execute_kw',
                    'args': args
                },
                'id': 1
            }

            print(f"API Call - Model: {model}, Method: {method}")
            print(f"Domain: {domain}")
            print(f"Fields: {fields}")
            print(f"Limit: {limit}, Offset: {offset}")

            response = self.session.post(url, json=data, timeout=30)
            print(f"API Response Status: {response.status_code}")

            result = response.json()

            if 'error' in result:
                print(f"API Error: {result['error']}")
                return None

            return result.get('result')

        except Exception as e:
            print(f"API call error: {e}")
            import traceback
            traceback.print_exc()
            return None

    def fetch_products(self, limit=1000):
        """Fetch all products using Odoo product.template model with proper pricing"""
        print("Fetching products from Odoo...")

        if not self.initialize_session():
            print("Failed to initialize session")
            return []

        all_products = []
        offset = 0
        page_size = 1000

        # First, get the public pricelist
        print("Fetching public pricelist...")
        pricelist_data = self.call_odoo_api(
            model='product.pricelist',
            method='search_read',
            domain=[('name', 'ilike', 'public')],  # Get public pricelist
            fields=['id', 'name'],
            limit=1
        )

        pricelist_id = 1  # Default fallback
        if pricelist_data:
            pricelist_id = pricelist_data[0]['id']
            print(f"Using pricelist: {pricelist_data[0]['name']} (ID: {pricelist_id})")
        else:
            print("Using default pricelist ID: 1")

        # Define fields to fetch
        fields = [
            'id', 'name', 'default_code', 'list_price', 'standard_price',
            'public_categ_ids', 'description', 'description_sale',
            'qty_available', 'image_128', 'brand_id'
        ]

        while True:
            print(f"Fetching products with offset {offset}, limit {page_size}")

            products_data = self.call_odoo_api(
                model='product.template',
                method='search_read',
                domain=["&", "&", "&", ("sale_ok", "=", True), ("product_variant_id.is_vehicle", "=", False), ("categ_id", "!=", 5), ("is_published", "=", True)],  # Only products that can be sold
                fields=fields,
                limit=page_size,
                offset=offset
            )

            if products_data is None:
                print("No products data returned (None)")
                break

            if not products_data:
                print("Empty products list returned")
                break

            print(f"Received {len(products_data)} products")

            # Get prices using pricelist for all products
            product_ids = [product['id'] for product in products_data]
            print(f"Getting prices for {len(product_ids)} products from pricelist...")

            # Use pricelist to get actual prices
            prices_data = self.call_odoo_api(
                model='product.pricelist',
                method='get_products_price',
                domain=[],
                fields={
                    'products': [{'id': pid, 'quantity': 1.0} for pid in product_ids],
                    'pricelist_id': pricelist_id
                }
            )

            # Transform Odoo product data to your expected format with proper pricing
            transformed_products = self.transform_products(products_data, prices_data, pricelist_id)
            all_products.extend(transformed_products)

            print(f"Fetched {len(products_data)} products (offset: {offset})")

            if len(products_data) < page_size:
                print("Reached end of product list")
                break

            offset += len(products_data)
            time.sleep(0.5)

        print(f"Total products fetched: {len(all_products)}")
        return all_products

    def transform_products(self, odoo_products, prices_data=None, pricelist_id=1):
        """Transform Odoo product data to your expected format with proper pricing"""
        transformed = []

        for product in odoo_products:
            print(f"Transforming product: {product.get('id')} - {product.get('name')}")

            # Get the price from pricelist if available, otherwise use list_price
            price = product.get('list_price', 0.0)

            if prices_data and isinstance(prices_data, list) and len(prices_data) > 0:
                # Find the price for this product in the prices_data
                product_id = product.get('id')
                # prices_data should be a list of prices in the same order as product_ids
                product_index = [p['id'] for p in odoo_products].index(product_id)
                if product_index < len(prices_data):
                    price = prices_data[product_index]
                    print(f"  Using pricelist price: {price}")

            # Apply the IQD rounding logic: price_iqd = int(round(price / 1000.0) * 1000)
            try:
                price_iqd = int(round(float(price*1410) / 1000.0) * 1000)
                print(f"  Original price: {price}, IQD price: {price_iqd}")
            except (ValueError, TypeError):
                price_iqd = 0
                print(f"  Price conversion error, using 0")

            # Handle category (many2one field)
            category = None
            categ_id = product.get('public_categ_ids')
            if categ_id and isinstance(categ_id, (list, tuple)) and len(categ_id) > 1:
                category = {
                    'id': categ_id[0],
                    'name': categ_id[1]
                }
                print(f"  Category: {category['name']}")
            else:
                print(f"  No category found: {categ_id}")

            # Handle brand_id (many2one field)
            brand = None
            brand_id = product.get('brand_id')
            if brand_id and isinstance(brand_id, (list, tuple)) and len(brand_id) > 1:
                brand = {
                    'id': brand_id[0],
                    'name': brand_id[1]
                }
                print(f"  Brand: {brand['name']}")
            else:
                print(f"  No brand found: {brand_id}")

            transformed_product = {
                'id': product.get('id'),
                'name': product.get('name', ''),
                'default_code': product.get('default_code', ''),
                'price': price_iqd,  # Use the calculated IQD price
                'original_price': price,  # Keep original for reference
                'cost_price': product.get('standard_price', 0.0),
                'category': category,
                'brand': brand,
                'brand_id': product.get('brand_id'),
                'description': product.get('description', '') or product.get('description_sale', ''),
                'quantity_available': product.get('qty_available', 0),
                'in_stock': product.get('qty_available', 0) > 0,  # Boolean field for stock availability
                'image_url': f"{self.base_url}/web/image?model=product.template&field=image_1920&id={product['id']}" if product.get(
                    'image_128') else None,
                'branches': [],  # Default empty branches
                'pricelist_id': pricelist_id
            }
            transformed.append(transformed_product)

        return transformed

    def fetch_categories(self):
        """Fetch product categories using Odoo product.category model"""
        print("Fetching categories from Odoo...")

        if not self.uid:
            if not self.initialize_session():
                return []

        categories_data = self.call_odoo_api(
            model='product.public.category',
            method='search_read',
            domain=[],  # Get all categories
            fields=['id', 'name', 'parent_id','image_128']
        )

        if categories_data is None:
            print("No categories data returned (None)")
            return []

        if not categories_data:
            print("Empty categories list returned")
            return []

        transformed_categories = []
        for category in categories_data:
            parent = None
            image_url = None
            parent_id = category.get('parent_id')
            if parent_id and isinstance(parent_id, (list, tuple)) and len(parent_id) > 1:
                parent = {
                    'id': parent_id[0],
                    'name': parent_id[1]
                }
            if category.get('image_128'):
                image_url = f"{self.base_url}/web/image?model=product.public.category&id={category.get('id')}&field=image_1920"


            transformed_categories.append({
                'id': category['id'],
                'name': category.get('complete_name', category.get('name', '')),
                'parent': parent,
                'image_url': image_url
            })

        return transformed_categories

    def fetch_brands(self):
        """Fetch branches/companies using Odoo res.company model"""
        print("Fetching brands from Odoo...")

        if not self.uid:
            if not self.initialize_session():
                return []

        brands_data = self.call_odoo_api(
            model='product.productbrand',
            method='search_read',
            domain=[('is_published','=',True)],
            fields=['id', 'name', 'logo', ]
        )

        if brands_data is None:
            print("No brands data returned (None)")
            return []

        if not brands_data:
            print("Empty brands list returned")
            return []

        transformed_brands = []
        for brand in brands_data:
            logo_url = ''
            logo = brand.get('logo')
            if logo:
                logo_url = f"{self.base_url}/web/image?model=product.productbrand&field=logo&id={brand['id']}" if brand.get(
                    'logo') else None,


            transformed_brands.append({
                'id': brand['id'],
                'name': brand.get('name', ''),
                'logo': logo_url,

            })

        return transformed_brands

    def fetch_vehicle_brands(self):
        """Fetch branches using Odoo  model"""
        print("Fetching brands from Odoo...")

        if not self.uid:
            if not self.initialize_session():
                return []

        brands_data = self.call_odoo_api(
            model='vehicle.brand',
            method='search_read',
            domain=[('is_published','=',True)],
            fields=['id', 'name', 'logo', ]
        )

        if brands_data is None:
            print("No brands data returned (None)")
            return []

        if not brands_data:
            print("Empty brands list returned")
            return []

        transformed_brands = []
        for brand in brands_data:
            logo_url = ''
            logo = brand.get('logo')
            if logo:
                logo_url = f"{self.base_url}/web/image?model=product.productbrand&field=logo&id={brand['id']}" if brand.get(
                    'logo') else None,


            transformed_brands.append({
                'id': brand['id'],
                'name': brand.get('name', ''),
                'logo': logo_url,

            })

        return transformed_brands

    def fetch_vehicle_models(self):
        """Fetch models using Odoo  model"""
        print("Fetching models from Odoo...")

        if not self.uid:
            if not self.initialize_session():
                return []

        models_data = self.call_odoo_api(
            model='vehicle.model',
            method='search_read',
            domain=[('is_published','=',True)],
            fields=['id', 'name', 'image', ]
        )

        if models_data is None:
            print("No models data returned (None)")
            return []

        if not models_data:
            print("Empty models list returned")
            return []

        transformed_models = []
        for model in models_data:
            logo_url = ''
            logo = model.get('logo')
            if logo:
                logo_url = f"{self.base_url}/web/image?model=product.vehicle&field=logo&id={logo['id']}" if model.get(
                    'image') else None,


            transformed_models.append({
                'id': model['id'],
                'name': model.get('name', ''),
                'logo': logo_url,

            })

        return transformed_models

    def fetch_branches(self):
        """Fetch branches/companies using Odoo res.company model"""
        print("Fetching branches from Odoo...")

        if not self.uid:
            if not self.initialize_session():
                return []

        branches_data = self.call_odoo_api(
            model='res.company',
            method='search_read',
            domain=[],
            fields=['id', 'name', 'street', 'city', 'country_id', 'phone', 'email']
        )

        if branches_data is None:
            print("No branches data returned (None)")
            return []

        if not branches_data:
            print("Empty branches list returned")
            return []

        transformed_branches = []
        for branch in branches_data:
            country = None
            country_id = branch.get('country_id')
            if country_id and isinstance(country_id, (list, tuple)) and len(country_id) > 1:
                country = {
                    'id': country_id[0],
                    'name': country_id[1]
                }

            transformed_branches.append({
                'id': branch['id'],
                'name': branch.get('name', ''),
                'address': branch.get('street', ''),
                'city': branch.get('city', ''),
                'country': country,
                'phone': branch.get('phone', ''),
                'email': branch.get('email', '')
            })

        return transformed_branches

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
            allowed_methods=["HEAD", "GET", "POST", "OPTIONS"],
            backoff_factor=1
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # Set headers
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Connection': 'keep-alive',
        })

    def setup_directories(self):
        """Create necessary directories"""
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.json_dir, exist_ok=True)
        os.makedirs(self.html_dir, exist_ok=True)

    def initialize_session(self):
        """Initialize session by authenticating with Odoo"""
        print("Initializing Odoo session...")
        if self.authenticate():
            print("Session initialized successfully")
            return True
        else:
            print("Failed to initialize session")
            return False

    def generate_filter_data(self, products, categories, brands, vehicle_brands, branches):
        """Generate JSON data for filtering"""
        print("Generating filter data...")

        # Extract unique values for filtering
        filter_data = {
            "categories": [],
            "brands": [],
            "vehicle_brands": [],
            "price_ranges": self.calculate_price_ranges(products),
            "branches": [],
            "last_updated": datetime.now().isoformat()
        }

        # Process categories
        category_count = {}
        for product in products:
            category = product.get('category')
            if category and isinstance(category, dict):
                category_name = category.get('name', 'Unknown')
                category_count[category_name] = category_count.get(category_name, 0) + 1

        filter_data["categories"] = [
            {
                "name": name,
                "count": count,
                "slug": self.slugify(name)
            }
            for name, count in category_count.items()
        ]

        # Process brands (empty for now since Odoo doesn't have built-in brands)
        filter_data["brands"] = []

        # Process branches
        branch_count = {}
        for product in products:
            branches_data = product.get('branches', [])
            for branch in branches_data:
                if isinstance(branch, dict):
                    branch_name = branch.get('name', 'Unknown')
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

                current = range_max + 0.01

        return ranges

    def generate_search_index(self, products):
        """Generate search index for quick client-side search"""
        print("Generating search index...")

        search_index = []
        for product in products:
            category_name = product.get('category', {}).get('name', '') if isinstance(product.get('category'),
                                                                                      dict) else ''
            brand_name = product.get('brand', {}).get('name', '') if isinstance(product.get('brand'), dict) else ''

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

    # ... (Keep all the HTML generation methods the same as before)
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
        """Generate main products page"""

        def get_safe_value(product, field):
            value = product.get(field)
            if isinstance(value, dict):
                return value.get('name', 'N/A')
            return str(value) if value else 'N/A'

        def format_price(price):
            try:
                return f"${float(price):.2f}"
            except (ValueError, TypeError):
                return "$0.00"

        product_cards_html = ""
        for product in products[:50]:
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

            category_name = product.get('category', {})
            if isinstance(category_name, dict):
                category_name = category_name.get('name', 'N/A')
            else:
                category_name = str(category_name) if category_name else 'N/A'

            brand_name = product.get('brand', {})
            if isinstance(brand_name, dict):
                brand_name = brand_name.get('name', 'N/A')
            else:
                brand_name = str(brand_name) if brand_name else 'N/A'

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
            js_content = f"window.{filename.replace('.js', '')} = {json.dumps(data, indent=2, ensure_ascii=False)};"
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(js_content)
        else:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

    def safe_filename(self, name):
        """Convert a string into a safe filename"""
        name = re.sub(r'\s+', '-', name)
        name = re.sub(r'[\\/:*?"<>|]', '', name)
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
        print("Starting Al Saji data export using Odoo API...")

        # Fetch data from Odoo API
        products = self.fetch_products()

        if not products:
            print("No products fetched. Exiting.")
            return

        # Fetch other data
        categories = self.fetch_categories()
        brands = self.fetch_brands()
        vehicle_brands = self.fetch_vehicle_brands()
        vehicle_models = self.fetch_vehicle_models()
        branches = self.fetch_branches()

        # Combine all data for change detection
        all_data = {
            "products": products,
            "categories": categories or [],
            "brands": brands or [],
            "vehicle_brands" : vehicle_brands or [],
            "vehicle_models" : vehicle_models or [],
            "branches": branches or []
        }

        # Check if data has changed
        if not force_update and not self.has_data_changed(all_data):
            print("Data has not changed since last export. Use force_update=True to force export.")
            return

        # Generate filter data and search index
        filter_data = self.generate_filter_data(products, categories, brands, vehicle_brands, branches)
        search_index = self.generate_search_index(products)

        # Save JSON files
        self.save_json_data(products, "products.json")
        self.save_json_data(categories, "categories.json")
        self.save_json_data(brands, "brands.json")
        self.save_json_data(vehicle_brands, "vehicle_brands.json")
        self.save_json_data(vehicle_models, "vehicle_models.json")
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
        self.generate_static_api_js()

        # Generate metadata
        metadata = {
            "export_date": datetime.now().isoformat(),
            "total_products": len(products),
            "total_categories": len(categories) if categories else 0,
            "total_brands": len(brands) if brands else 0,
            "total_branches": len(branches) if branches else 0,
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
        print(f"✓ Total categories: {len(categories) if categories else 0}")
        print(f"✓ Total brands: {len(brands) if brands else 0}")
        print(f"✓ Total branches: {len(branches) if branches else 0}")
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

        container.innerHTML = this.filterData.price_ranges.map(range => `
            <label style="display: block; margin: 5px 0;">
                <input type="radio" name="price-range" value="${range.min}-${range.max}">
                ${range.label} (${range.count})
            </label>
        `).join('');
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
"""

        with open(os.path.join(self.html_dir, "filtering.js"), "w", encoding="utf-8") as f:
            f.write(filtering_js)

    # Add this method to your AlSajiDataExporter class
    def generate_static_api_js(self):
        """Generate static_api.js file for frontend"""
        print("📁 Generating static_api.js...")

        try:
            # Load the JSON data
            with open(os.path.join(self.json_dir, 'products.json'), 'r', encoding='utf-8') as f:
                products = json.load(f)

            with open(os.path.join(self.json_dir, 'categories.json'), 'r', encoding='utf-8') as f:
                categories = json.load(f)

            with open(os.path.join(self.json_dir, 'brands.json'), 'r', encoding='utf-8') as f:
                brands = json.load(f)

            # Create the static API JavaScript content
            static_api_content = f"""
    // Static API - Auto-generated {datetime.now().isoformat()}
    window.staticAPI = {{
        products: {json.dumps(products, ensure_ascii=False)},
        categories: {json.dumps(categories, ensure_ascii=False)},
        brands: {json.dumps(brands, ensure_ascii =False)},
        lastUpdated: "{datetime.now().isoformat()}",

        getProducts(filters = {{}}) {{
            let filtered = [...this.products];

            // Search filter
            if (filters.search) {{
                const searchTerm = filters.search.toLowerCase();
                filtered = filtered.filter(p => 
                    p.name && p.name.toLowerCase().includes(searchTerm) ||
                    (p.description && p.description.toLowerCase().includes(searchTerm))
                );
            }}

            // Category filter
            if (filters.category) {{
                filtered = filtered.filter(p => {{
                    const cat = p.category;
                    return cat && cat.name && cat.name.toString().toLowerCase().includes(filters.category.toLowerCase());
                }});
            }}

            // Brand filter
            if (filters.brand) {{
                filtered = filtered.filter(p => {{
                    const brand = p.brand;
                    return brand && brand.name && brand.name.toString().toLowerCase().includes(filters.brand.toLowerCase());
                }});
            }}

            // In stock filter
            if (filters.in_stock !== undefined && filters.in_stock !== '') {{
                const inStock = filters.in_stock === 'true' || filters.in_stock === true;
                filtered = filtered.filter(p => p.in_stock === inStock);
            }}

            // Price range filters
            if (filters.price_min) {{
                const minPrice = parseFloat(filters.price_min);
                if (!isNaN(minPrice)) {{
                    filtered = filtered.filter(p => p.price >= minPrice);
                }}
            }}

            if (filters.price_max) {{
                const maxPrice = parseFloat(filters.price_max);
                if (!isNaN(maxPrice)) {{
                    filtered = filtered.filter(p => p.price <= maxPrice);
                }}
            }}

            // Pagination
            const limit = parseInt(filters.limit) || 12;
            const offset = parseInt(filters.offset) || 0;
            const paginated = filtered.slice(offset, offset + limit);

            return {{
                success: true,
                products: paginated,
                total_count: filtered.length,
                count: paginated.length
            }};
        }},

        getCategories() {{
            return {{ success: true, categories: this.categories }};
        }},

        getBrands() {{
            return {{ success: true, brands: this.brands }};
        }},

        searchSuggestions(query) {{
            if (!query || query.length < 2) return [];
            const suggestions = new Set();
            const q = query.toLowerCase();

            this.products.forEach(product => {{
                if (product.name && product.name.toLowerCase().includes(q)) {{
                    suggestions.add(product.name);
                }}
                if (product.category && product.category.name && product.category.name.toLowerCase().includes(q)) {{
                    suggestions.add(product.category.name);
                }}
                if (product.brand && product.brand.name && product.brand.name.toLowerCase().includes(q)) {{
                    suggestions.add(product.brand.name);
                }}
            }});

            return Array.from(suggestions).slice(0, 8);
        }},

        getProductById(id) {{
            return this.products.find(p => p.id == id);
        }}
    }};

    console.log('✅ Static API loaded:', {{
        products: window.staticAPI.products.length,
        categories: window.staticAPI.categories.length,
        brands: window.staticAPI.brands.length,
        lastUpdated: window.staticAPI.lastUpdated
    }});
    """

            # Save the static_api.js file
            static_api_path = os.path.join(self.output_dir, 'static_api.js')
            with open(static_api_path, 'w', encoding='utf-8') as f:
                f.write(static_api_content)

            print(
                f"✅ Generated static_api.js with {len(products)} products, {len(categories)} categories, {len(brands)} brands")

        except Exception as e:
            print(f"❌ Error generating static_api.js: {e}")
            import traceback
            traceback.print_exc()

# Usage with your Odoo.sh credentials
if __name__ == "__main__":
    exporter = AlSajiDataExporter()
    exporter.export_all_data()
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
        self.cached_products = None  # Add this line


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
            domain=[('name', 'ilike', 'public')],
            fields=['id', 'name'],
            limit=1
        )

        pricelist_id = 1
        if pricelist_data:
            pricelist_id = pricelist_data[0]['id']
            print(f"Using pricelist: {pricelist_data[0]['name']} (ID: {pricelist_id})")
        else:
            print("Using default pricelist ID: 1")

        # **FIX 1: Fetch categories first to get their names**
        print("Fetching categories...")
        categories_data = self.call_odoo_api(
            model='product.public.category',
            method='search_read',
            domain=[],
            fields=['id', 'name']
        )

        # Create a mapping of category ID to category name
        categories_map = {cat['id']: cat['name'] for cat in (categories_data or [])}
        print(f"Loaded {len(categories_map)} categories")

        # Define fields to fetch
        fields = [
            'id', 'name', 'default_code', 'list_price', 'standard_price',
            'public_categ_ids', 'categ_id', 'description', 'description_sale',  # **FIX 2: Added categ_id**
            'qty_available', 'image_128', 'brand_id'
        ]

        while True:
            print(f"Fetching products with offset {offset}, limit {page_size}")

            products_data = self.call_odoo_api(
                model='product.template',
                method='search_read',
                domain=["&", "&", "&", ("sale_ok", "=", True), ("product_variant_id.is_vehicle", "=", False),
                        ("categ_id", "!=", 5), ("is_published", "=", True)],
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

            prices_data = self.call_odoo_api(
                model='product.pricelist',
                method='get_products_price',
                domain=[],
                fields={
                    'products': [{'id': pid, 'quantity': 1.0} for pid in product_ids],
                    'pricelist_id': pricelist_id
                }
            )

            # **FIX 3: Pass categories_map to transform_products**
            transformed_products = self.transform_products(products_data, prices_data, pricelist_id, categories_map)
            all_products.extend(transformed_products)

            print(f"Fetched {len(products_data)} products (offset: {offset})")

            if len(products_data) < page_size:
                print("Reached end of product list")
                break

            offset += len(products_data)
            time.sleep(0.5)

        # Store the products for later use
        self.cached_products = all_products
        print(f"Total products fetched and cached: {len(all_products)}")
        return all_products

        print(f"Total products fetched: {len(all_products)}")
        return all_products

    def transform_products(self, odoo_products, prices_data=None, pricelist_id=1, categories_map=None):
        """Transform Odoo product data to your expected format with proper pricing"""
        transformed = []

        # Ensure categories_map is a dictionary
        if categories_map is None:
            categories_map = {}

        for product in odoo_products:
            print(f"Transforming product: {product.get('id')} - {product.get('name')}")

            # Get the price from pricelist if available, otherwise use list_price
            price = product.get('list_price', 0.0)

            if prices_data and isinstance(prices_data, list) and len(prices_data) > 0:
                product_id = product.get('id')
                product_index = [p['id'] for p in odoo_products].index(product_id)
                if product_index < len(prices_data):
                    price = prices_data[product_index]
                    print(f"  Using pricelist price: {price}")

            # Apply the IQD rounding logic
            try:
                price_iqd = int(round(float(price * 1410) / 1000.0) * 1000)
                print(f"  Original price: {price}, IQD price: {price_iqd}")
            except (ValueError, TypeError):
                price_iqd = 0
                print(f"  Price conversion error, using 0")

            # **FIX 4: Correct category handling**
            category = None
            categ_ids = product.get('public_categ_ids', [])

            if categ_ids and isinstance(categ_ids, list):
                # Take the first category ID and look up its name
                first_categ_id = categ_ids[0] if categ_ids else None
                if first_categ_id and first_categ_id in categories_map:
                    category = {
                        'id': first_categ_id,
                        'name': categories_map[first_categ_id]
                    }
                    print(f"  Category: {category['name']} (ID: {category['id']})")
                else:
                    print(f"  Category ID {first_categ_id} not found in categories map")
            else:
                print(f"  No category IDs found: {categ_ids}")



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
                'price': price_iqd,
                'original_price': price,
                'cost_price': product.get('standard_price', 0.0),
                'category': category,
                'brand': brand,
                'brand_id': product.get('brand_id'),
                'description': product.get('description', '') or product.get('description_sale', ''),
                'quantity_available': product.get('qty_available', 0),
                'in_stock': product.get('qty_available', 0) > 0,
                'image_url': f"{self.base_url}/web/image?model=product.template&field=image_1920&id={product['id']}" if product.get(
                    'image_128') else None,
                'branches': [],
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
        """Fetch brands using cached products data - FAST VERSION"""
        print("Fetching brands from Odoo (using cached products)...")

        if not self.uid:
            if not self.initialize_session():
                return []

        try:
            # Step 1: Fetch all brands in one call
            brands_data = self.call_odoo_api(
                model='product.productbrand',
                method='search_read',
                domain=[('is_published', '=', True)],
                fields=['id', 'name', 'logo']
            )

            if not brands_data:
                print("No brands found")
                return []

            print(f"Found {len(brands_data)} brands")

            # Step 2: Use cached products data instead of fetching again
            if self.cached_products is None:
                print("No cached products found, fetching products first...")
                self.fetch_products()

            all_products = self.cached_products or []
            print(f"Using {len(all_products)} cached products for category mapping")

            # Step 3: Build brand-category mapping from cached products
            brand_categories_map = {}
            brand_product_count = {}

            for product in all_products:
                brand_id = product.get('brand_id')

                # FIX: Handle brand_id whether it's a single ID or [id, name] list
                actual_brand_id = None
                if isinstance(brand_id, (list, tuple)) and len(brand_id) > 0:
                    actual_brand_id = brand_id[0]  # Extract the ID from [id, name]
                elif isinstance(brand_id, int):
                    actual_brand_id = brand_id
                elif brand_id is None:
                    continue  # Skip products without brands

                if actual_brand_id:
                    # Initialize brand in maps
                    if actual_brand_id not in brand_categories_map:
                        brand_categories_map[actual_brand_id] = set()
                        brand_product_count[actual_brand_id] = 0

                    # Count product
                    brand_product_count[actual_brand_id] += 1

                    # Add categories - FIX: Also handle category ID extraction
                    category = product.get('category')
                    if category and isinstance(category, dict):
                        category_id = category.get('id')
                        if category_id:
                            brand_categories_map[actual_brand_id].add(category_id)
                    # Alternative: if you have direct category IDs in products
                    elif product.get('public_categ_ids'):
                        categ_ids = product.get('public_categ_ids', [])
                        if isinstance(categ_ids, list):
                            # Extract IDs if they're in [id, name] format
                            for categ_id in categ_ids:
                                if isinstance(categ_id, (list, tuple)) and len(categ_id) > 0:
                                    brand_categories_map[actual_brand_id].add(categ_id[0])
                                elif isinstance(categ_id, int):
                                    brand_categories_map[actual_brand_id].add(categ_id)

            # Step 4: Get all unique category IDs
            all_category_ids = set()
            for category_ids in brand_categories_map.values():
                all_category_ids.update(category_ids)

            # Step 5: Fetch category details in one call
            categories_map = {}
            if all_category_ids:
                print(f"Fetching {len(all_category_ids)} categories...")
                categories_data = self.call_odoo_api(
                    model='product.public.category',
                    method='search_read',
                    domain=[('id', 'in', list(all_category_ids))],
                    fields=['id', 'name', 'parent_id', 'image_128']
                ) or []

                categories_map = {cat['id']: cat for cat in categories_data}

            # Step 6: Transform brands
            transformed_brands = []
            for brand in brands_data:
                brand_id = brand['id']
                categories = []

                if brand_id in brand_categories_map:
                    for categ_id in brand_categories_map[brand_id]:
                        if categ_id in categories_map:
                            category_data = categories_map[categ_id]

                            parent = None
                            parent_id = category_data.get('parent_id')
                            if parent_id and isinstance(parent_id, (list, tuple)) and len(parent_id) > 1:
                                parent = {
                                    'id': parent_id[0],
                                    'name': parent_id[1]
                                }

                            image_url = None
                            if category_data.get('image_128'):
                                image_url = f"{self.base_url}/web/image?model=product.public.category&id={categ_id}&field=image_1920"

                            categories.append({
                                'id': categ_id,
                                'name': category_data.get('name', ''),
                                'parent': parent,
                                'image_url': image_url
                            })

                # Handle logo URL
                logo_url = ""
                logo_data = brand.get('logo')
                if logo_data:
                    if isinstance(logo_data, list) and len(logo_data) > 0:
                        logo_url = logo_data[0]
                    elif isinstance(logo_data, str):
                        logo_url = logo_data

                transformed_brands.append({
                    'id': brand_id,
                    'name': brand.get('name', ''),
                    'logo': logo_url,
                    'categories': categories,
                    'product_count': brand_product_count.get(brand_id, 0)
                })

            print(f"Successfully processed {len(transformed_brands)} brands with categories")
            return transformed_brands

        except Exception as e:
            print(f"Error fetching brands: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

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
            logo = model.get('image')
            logo_id = model.get('id')
            if logo:
                logo_url = f"{self.base_url}/web/image?model=product.vehicle&field=logo&id={logo_id}" if model.get(
                    'image') else None,


            transformed_models.append({
                'id': model['id'],
                'name': model.get('name', ''),
                'logo': logo_url,

            })

        return transformed_models

    def fetch_part_compatibility(self, filters=None, limit=10000):
        """Fetch part compatibility data from Odoo part.compatibility model"""
        print("🚗 Fetching part compatibility data from Odoo...")

        if not self.uid:
            if not self.initialize_session():
                return []

        # Define fields to fetch
        fields = [
            'id', 'product_id', 'product_template_id', 'model', 'brand_id',
            'from_year', 'to_year', 'engine_ids', 'import_type_ids',
            'create_date', 'write_date', 'x_studio_category'
        ]

        # Use provided filters or default to empty
        domain = filters or []

        all_compatibility = []
        offset = 0
        page_size = 1000

        while True:
            print(f"📋 Fetching part compatibility with offset {offset}, limit {page_size}")

            compatibility_data = self.call_odoo_api(
                model='part.compatibility',
                method='search_read',
                domain=domain,
                fields=fields,
                limit=page_size,
                offset=offset
            )

            if compatibility_data is None:
                print("❌ No compatibility data returned (None)")
                break

            if not compatibility_data:
                print("✅ Reached end of compatibility list")
                break

            print(f"✅ Received {len(compatibility_data)} compatibility records")

            # Transform the data
            transformed_compatibility = self.transform_compatibility_data(compatibility_data)
            all_compatibility.extend(transformed_compatibility)

            if len(compatibility_data) < page_size:
                print("✅ Reached end of compatibility data")
                break

            offset += len(compatibility_data)
            time.sleep(0.5)  # Be nice to the API

        print(f"🚗 Total compatibility records fetched: {len(all_compatibility)}")
        return all_compatibility

    def transform_compatibility_data(self, compatibility_data):
        """Transform Odoo compatibility data to a more usable format"""
        transformed = []

        for comp in compatibility_data:
            # Extract product information
            product_id = None
            product_name = None
            if comp.get('product_id') and isinstance(comp['product_id'], (list, tuple)) and len(comp['product_id']) > 1:
                product_id = comp['product_id'][0]
                product_name = comp['product_id'][1]

            product_template_id = None
            product_template_name = None
            if comp.get('product_template_id') and isinstance(comp['product_template_id'], (list, tuple)) and len(
                    comp['product_template_id']) > 1:
                product_template_id = comp['product_template_id'][0]
                product_template_name = comp['product_template_id'][1]

            # Extract vehicle model information
            vehicle_model_id = None
            vehicle_model_name = None
            if comp.get('model') and isinstance(comp['model'], (list, tuple)) and len(comp['model']) > 1:
                vehicle_model_id = comp['model'][0]
                vehicle_model_name = comp['model'][1]

            # Extract brand information
            brand_id = None
            brand_name = None
            if comp.get('brand_id') and isinstance(comp['brand_id'], (list, tuple)) and len(comp['brand_id']) > 1:
                brand_id = comp['brand_id'][0]
                brand_name = comp['brand_id'][1]

            # Extract engine information
            engines = []
            if comp.get('engine_ids') and isinstance(comp['engine_ids'], list):
                engines = comp['engine_ids']

            # Extract import type information
            import_types = []
            if comp.get('import_type_ids') and isinstance(comp['import_type_ids'], list):
                import_types = comp['import_type_ids']

            transformed_comp = {
                'id': comp.get('id'),
                'product_id': product_id,
                'product_name': product_name,
                'product_template_id': product_template_id,
                'product_template_name': product_template_name,
                'vehicle_model_id': vehicle_model_id,
                'vehicle_model_name': vehicle_model_name,
                'brand_id': brand_id,
                'brand_name': brand_name,
                'from_year': comp.get('from_year'),
                'to_year': comp.get('to_year'),
                'year_range': f"{comp.get('from_year', '')}-{comp.get('to_year', '')}" if comp.get(
                    'from_year') and comp.get('to_year') else None,
                'engine_ids': engines,
                'import_type_ids': import_types,
                'category': comp.get('x_studio_category'),
                'create_date': comp.get('create_date'),
                'write_date': comp.get('write_date')
            }
            transformed.append(transformed_comp)

        return transformed

    def generate_vehicle_compatibility_index(self, compatibility_data, products_data):
        """Generate a search index for vehicle compatibility"""
        print("🔧 Generating vehicle compatibility index...")

        compatibility_index = {}

        for comp in compatibility_data:
            product_id = comp.get('product_template_id') or comp.get('product_id')
            vehicle_model_id = comp.get('vehicle_model_id')
            brand_id = comp.get('brand_id')

            if not product_id or not vehicle_model_id:
                continue

            # Create entry for vehicle model
            if vehicle_model_id not in compatibility_index:
                compatibility_index[vehicle_model_id] = {
                    'vehicle_model_id': vehicle_model_id,
                    'vehicle_model_name': comp.get('vehicle_model_name'),
                    'brand_id': brand_id,
                    'brand_name': comp.get('brand_name'),
                    'compatible_products': [],
                    'year_range': comp.get('year_range'),
                    'from_year': comp.get('from_year'),
                    'to_year': comp.get('to_year')
                }

            # Find product details from products data
            product_details = None
            for product in products_data:
                if product['id'] == product_id:
                    product_details = product
                    break

            if product_details:
                compatibility_index[vehicle_model_id]['compatible_products'].append({
                    'product_id': product_id,
                    'product_name': product_details.get('name'),
                    'product_code': product_details.get('default_code'),
                    'price': product_details.get('price'),
                    'in_stock': product_details.get('in_stock'),
                    'image_url': product_details.get('image_url')
                })

        # Convert to list and filter empty entries
        compatibility_list = [item for item in compatibility_index.values() if item['compatible_products']]

        print(f"✅ Generated compatibility index with {len(compatibility_list)} vehicle models")
        return compatibility_list

    def get_products_by_vehicle(self, make_id=None, model_id=None, year=None):
        """Get products compatible with specific vehicle"""
        print(f"🔍 Getting products for vehicle - Make: {make_id}, Model: {model_id}, Year: {year}")

        # Load compatibility data if not already loaded
        if not hasattr(self, 'compatibility_data'):
            self.compatibility_data = self.fetch_part_compatibility()

        # Load products data if not already loaded
        if not hasattr(self, 'products_data'):
            products_file = os.path.join(self.json_dir, "products.json")
            if os.path.exists(products_file):
                with open(products_file, 'r', encoding='utf-8') as f:
                    self.products_data = json.load(f)
            else:
                print("❌ Products data not found")
                return []

        compatible_products = []

        for comp in self.compatibility_data:
            # Filter by model
            if model_id and comp.get('vehicle_model_id') != model_id:
                continue

            # Filter by brand/make (if available)
            if make_id and comp.get('brand_id') != make_id:
                continue

            # Filter by year
            if year:
                from_year = comp.get('from_year')
                to_year = comp.get('to_year')
                if from_year and to_year:
                    if not (from_year <= year <= to_year):
                        continue
                elif from_year and year < from_year:
                    continue
                elif to_year and year > to_year:
                    continue

            # Find product in products data
            product_id = comp.get('product_template_id') or comp.get('product_id')
            for product in self.products_data:
                if product['id'] == product_id:
                    # Add compatibility info to product
                    product_with_compatibility = product.copy()
                    product_with_compatibility['compatibility_info'] = {
                        'vehicle_model': comp.get('vehicle_model_name'),
                        'from_year': comp.get('from_year'),
                        'to_year': comp.get('to_year'),
                        'year_range': comp.get('year_range')
                    }
                    compatible_products.append(product_with_compatibility)
                    break

        print(f"✅ Found {len(compatible_products)} compatible products")
        return compatible_products

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

    def generate_filter_data(self, products, categories, brands, vehicle_brands, vehicle_models, branches):
        """Generate JSON data for filtering"""
        print("Generating filter data...")

        # Extract unique values for filtering
        filter_data = {
            "categories": [],
            "brands": [],
            "vehicle_brands": [],
            "vehicle_models": [],
            "price_ranges": self.calculate_price_ranges(products),
            "branches": [],
            "last_updated": datetime.now().isoformat()
        }

        # Process categories - use actual categories from fetched data
        if categories:
            filter_data["categories"] = [
                {
                    "id": cat.get('id'),
                    "name": cat.get('name', 'Unknown'),
                    "slug": self.slugify(cat.get('name', '')),
                    "image_url": cat.get('image_url'),
                    "product_count": self.count_products_in_category(products, cat.get('id'))
                }
                for cat in categories
                if cat.get('name')
            ]
        else:
            # Fallback: extract categories from products
            category_count = {}
            for product in products:
                category = product.get('category')
                if category and isinstance(category, dict):
                    category_id = category.get('id')
                    category_name = category.get('name', 'Unknown')
                    if category_id and category_name:
                        key = f"{category_id}-{category_name}"
                        category_count[key] = {
                            'id': category_id,
                            'name': category_name,
                            'count': category_count.get(key, {}).get('count', 0) + 1
                        }

            filter_data["categories"] = [
                {
                    "id": cat_data['id'],
                    "name": cat_data['name'],
                    "slug": self.slugify(cat_data['name']),
                    "product_count": cat_data['count']
                }
                for cat_data in category_count.values()
            ]

        # Process brands - use actual brands from fetched data
        if brands:
            filter_data["brands"] = [
                {
                    "id": brand.get('id'),
                    "name": brand.get('name', 'Unknown'),
                    "slug": self.slugify(brand.get('name', '')),
                    "logo": brand.get('logo'),
                    "product_count": self.count_products_in_brand(products, brand.get('id'))
                }
                for brand in brands
                if brand.get('name')
            ]
        else:
            # Fallback: extract brands from products
            brand_count = {}
            for product in products:
                brand = product.get('brand')
                if brand and isinstance(brand, dict):
                    brand_id = brand.get('id')
                    brand_name = brand.get('name', 'Unknown')
                    if brand_id and brand_name:
                        key = f"{brand_id}-{brand_name}"
                        brand_count[key] = {
                            'id': brand_id,
                            'name': brand_name,
                            'count': brand_count.get(key, {}).get('count', 0) + 1
                        }

            filter_data["brands"] = [
                {
                    "id": brand_data['id'],
                    "name": brand_data['name'],
                    "slug": self.slugify(brand_data['name']),
                    "product_count": brand_data['count']
                }
                for brand_data in brand_count.values()
            ]

        # Process vehicle brands
        if vehicle_brands:
            filter_data["vehicle_brands"] = [
                {
                    "id": vb.get('id'),
                    "name": vb.get('name', 'Unknown'),
                    "slug": self.slugify(vb.get('name', '')),
                    "logo": vb.get('logo')
                }
                for vb in vehicle_brands
                if vb.get('name')
            ]

        # Process vehicle models
        if vehicle_models:
            filter_data["vehicle_models"] = [
                {
                    "id": vm.get('id'),
                    "name": vm.get('name', 'Unknown'),
                    "slug": self.slugify(vm.get('name', '')),
                    "logo": vm.get('logo')
                }
                for vm in vehicle_models
                if vm.get('name')
            ]

        # Process branches
        if branches:
            filter_data["branches"] = [
                {
                    "id": branch.get('id'),
                    "name": branch.get('name', 'Unknown'),
                    "slug": self.slugify(branch.get('name', '')),
                    "address": branch.get('address'),
                    "city": branch.get('city'),
                    "phone": branch.get('phone')
                }
                for branch in branches
                if branch.get('name')
            ]

        # Sort categories and brands by product count (descending)
        filter_data["categories"].sort(key=lambda x: x.get('product_count', 0), reverse=True)
        filter_data["brands"].sort(key=lambda x: x.get('product_count', 0), reverse=True)

        print(
            f"✅ Generated filter data: {len(filter_data['categories'])} categories, {len(filter_data['brands'])} brands")
        return filter_data

    def count_products_in_category(self, products, category_id):
        """Count products in a specific category"""
        count = 0
        for product in products:
            product_category = product.get('category')
            if product_category and isinstance(product_category, dict):
                if product_category.get('id') == category_id:
                    count += 1
        return count

    def count_products_in_brand(self, products, brand_id):
        """Count products in a specific brand"""
        count = 0
        for product in products:
            product_brand = product.get('brand')
            if product_brand and isinstance(product_brand, dict):
                if product_brand.get('id') == brand_id:
                    count += 1
        return count

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

        # Create meaningful price ranges based on actual data distribution
        ranges = []

        if min_price == max_price:
            ranges.append({
                "min": min_price,
                "max": max_price,
                "count": len(prices),
                "label": f"IQD {min_price:,.0f}"
            })
        else:
            # Use logarithmic ranges for better distribution
            if max_price > 1000000:  # For high price ranges
                steps = [0, 50000, 100000, 250000, 500000, 1000000, float('inf')]
            elif max_price > 100000:  # For medium price ranges
                steps = [0, 25000, 50000, 100000, 250000, 500000, float('inf')]
            else:  # For low price ranges
                steps = [0, 10000, 25000, 50000, 100000, 250000, float('inf')]

            for i in range(len(steps) - 1):
                range_min = steps[i]
                range_max = steps[i + 1]

                count = len([p for p in prices if range_min <= p < range_max])

                if count > 0:
                    if range_max == float('inf'):
                        label = f"IQD {range_min:,.0f}+"
                    else:
                        label = f"IQD {range_min:,.0f} - {range_max:,.0f}"

                    ranges.append({
                        "min": range_min,
                        "max": range_max,
                        "count": count,
                        "label": label
                    })

        return ranges

    def generate_search_index(self, products):
        """Generate search index for quick client-side search"""
        print("🔍 Generating search index...")

        search_index = []

        for product in products:
            # Safely extract category name
            category_name = ""
            category_id = None
            if product.get('category') and isinstance(product.get('category'), dict):
                category_name = product.get('category', {}).get('name', '')
                category_id = product.get('category', {}).get('id')

            # Safely extract brand name
            brand_name = ""
            brand_id = None
            if product.get('brand') and isinstance(product.get('brand'), dict):
                brand_name = product.get('brand', {}).get('name', '')
                brand_id = product.get('brand', {}).get('id')

            # Handle price safely
            try:
                price = float(product.get('price', 0)) if product.get('price') is not None else 0
            except (ValueError, TypeError):
                price = 0

            # Handle stock status
            in_stock = product.get('in_stock', False)
            quantity = product.get('quantity_available', 0)

            # Create search terms array
            search_terms = []

            # Add product name
            if product.get('name'):
                search_terms.append(product.get('name').lower())

            # Add product code
            if product.get('default_code'):
                search_terms.append(product.get('default_code').lower())

            # Add category name
            if category_name:
                search_terms.append(category_name.lower())

            # Add brand name
            if brand_name:
                search_terms.append(brand_name.lower())

            # Add description (first 200 chars)
            if product.get('description'):
                desc = product.get('description')[:200].lower()
                search_terms.append(desc)

            # Remove duplicates and empty terms
            search_terms = list(set([term for term in search_terms if term.strip()]))

            search_item = {
                "id": product.get('id'),
                "name": product.get('name', ''),
                "default_code": product.get('default_code', ''),
                "category_id": category_id,
                "category_name": category_name,
                "brand_id": brand_id,
                "brand_name": brand_name,
                "price": price,
                "in_stock": in_stock,
                "quantity_available": quantity,
                "image_url": product.get('image_url'),
                "slug": self.slugify(product.get('name', '')),
                "search_terms": search_terms,
                "description_preview": (product.get('description') or '')[:100] + '...' if product.get(
                    'description') else ''
            }
            search_index.append(search_item)

        print(f"✅ Generated search index with {len(search_index)} products")
        return search_index

    # HTML generation methods
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

    <script src="..json/filter-data.js"></script>
    <script src="..json/search-index.js"></script>
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

        # ✅ ADD PART COMPATIBILITY DATA
        part_compatibility = self.fetch_part_compatibility()

        # Combine all data for change detection
        all_data = {
            "products": products,
            "categories": categories or [],
            "brands": brands or [],
            "vehicle_brands": vehicle_brands or [],
            "vehicle_models": vehicle_models or [],
            "branches": branches or [],
            "part_compatibility": part_compatibility or []
        }

        # Check if data has changed
        if not force_update and not self.has_data_changed(all_data):
            print("Data has not changed since last export. Use force_update=True to force export.")
            return

        # ✅ FIXED: Pass all required parameters to generate_filter_data
        filter_data = self.generate_filter_data(
            products=products,
            categories=categories,
            brands=brands,
            vehicle_brands=vehicle_brands,
            vehicle_models=vehicle_models,  # ✅ ADD THIS
            branches=branches
        )

        search_index = self.generate_search_index(products)

        # ✅ GENERATE VEHICLE COMPATIBILITY INDEX
        vehicle_compatibility_index = self.generate_vehicle_compatibility_index(part_compatibility, products)

        # Save JSON files
        self.save_json_data(products, "products.json")
        self.save_json_data(categories, "categories.json")
        self.save_json_data(brands, "brands.json")
        self.save_json_data(vehicle_brands, "vehicle_brands.json")
        self.save_json_data(vehicle_models, "vehicle_models.json")
        self.save_json_data(branches, "branches.json")
        self.save_json_data(filter_data, "filter-data.json")
        self.save_json_data(search_index, "search-index.json")
        self.save_json_data(part_compatibility, "part_compatibility.json")
        self.save_json_data(vehicle_compatibility_index, "vehicle_compatibility_index.json")

        # Save as JS modules for direct browser use
        self.save_json_data(filter_data, "filter-data.js", as_js_module=True)
        self.save_json_data(search_index, "search-index.js", as_js_module=True)
        self.save_json_data(vehicle_compatibility_index, "vehicle_compatibility_index.js", as_js_module=True)

        # Generate HTML pages
        self.generate_html_pages(products, categories, brands)

        # Save filtering JavaScript
        self.save_filtering_js()
        self.generate_static_api_js()

        # ✅ UPDATE STATIC API TO INCLUDE VEHICLE COMPATIBILITY
        self.update_static_api_with_compatibility()

        # Generate metadata
        metadata = {
            "export_date": datetime.now().isoformat(),
            "total_products": len(products),
            "total_categories": len(categories) if categories else 0,
            "total_brands": len(brands) if brands else 0,
            "total_vehicle_brands": len(vehicle_brands) if vehicle_brands else 0,
            "total_vehicle_models": len(vehicle_models) if vehicle_models else 0,
            "total_branches": len(branches) if branches else 0,
            "total_compatibility_records": len(part_compatibility),
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
        print(f"✓ Total vehicle brands: {len(vehicle_brands) if vehicle_brands else 0}")
        print(f"✓ Total vehicle models: {len(vehicle_models) if vehicle_models else 0}")
        print(f"✓ Total branches: {len(branches) if branches else 0}")
        print(f"✓ Total compatibility records: {len(part_compatibility)}")
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

    def generate_static_api_js(self):
        """Generate static_api.js file for frontend"""
        print("📁 Generating static_api.js...")

        try:
            # Load the JSON data and validate them
            def fetch_json_file(file_name):
                file_path = os.path.join(self.json_dir, file_name)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        return data
                except Exception as e:
                    print(f"❌ Failed to load {file_name}: {e}")
                    return []

            products = fetch_json_file('products.json')  # Products data
            categories = fetch_json_file('categories.json')  # Categories data
            brands = fetch_json_file('brands.json')  # Brands data

            # Create the valid static API
            static_api_data = {
                "products": products,
                "categories": categories,
                "brands": brands,
                "lastUpdated": datetime.now().isoformat()
            }

            # Format JavaScript output with proper syntax
            static_api_content = f"""// Static API - Auto-generated {datetime.now().isoformat()}
    window.staticAPI = {json.dumps(static_api_data, ensure_ascii=False, indent=2)};
    """

            # Save to the static_api.js file
            output_file_path = os.path.join(self.output_dir, 'static_api.js')

            with open(output_file_path, 'w', encoding='utf-8') as file:
                file.write(static_api_content)

            print(f"✅ static_api.js successfully generated: {output_file_path}")

        except Exception as e:
            print(f"❌ Error generating static_api.js: {e}")

    def update_static_api_with_compatibility(self):
        """Update static_api.js to include vehicle compatibility functions"""
        print("🔄 Updating static API with vehicle compatibility...")

        try:
            # Load the existing static_api.js
            static_api_path = os.path.join(self.output_dir, 'static_api.js')
            with open(static_api_path, 'r', encoding='utf-8') as f:
                static_api_content = f.read()

            # Load compatibility data
            compatibility_file = os.path.join(self.json_dir, 'vehicle_compatibility_index.json')
            with open(compatibility_file, 'r', encoding='utf-8') as f:
                compatibility_data = json.load(f)

            # Add compatibility functions to the static API - FIXED SYNTAX
            compatibility_functions = f""",
        // Vehicle Compatibility Functions
        getProductsByVehicle(vehicleData) {{
            const {{ makeId, modelId, year }} = vehicleData;
            let compatibleProducts = [];

            // Find compatible products from compatibility index
            this.vehicleCompatibilityIndex.forEach(vehicle => {{
                if (modelId && vehicle.vehicle_model_id == modelId) {{
                    // Filter by year if provided
                    let yearCompatible = true;
                    if (year) {{
                        const fromYear = vehicle.from_year;
                        const toYear = vehicle.to_year;
                        if (fromYear && toYear) {{
                            yearCompatible = (year >= fromYear && year <= toYear);
                        }} else if (fromYear) {{
                            yearCompatible = (year >= fromYear);
                        }} else if (toYear) {{
                            yearCompatible = (year <= toYear);
                        }}
                    }}

                    if (yearCompatible) {{
                        compatibleProducts = [...compatibleProducts, ...vehicle.compatible_products];
                    }}
                }}
            }});

            // Remove duplicates and get full product details
            const uniqueProducts = [];
            const seenIds = new Set();

            compatibleProducts.forEach(compProduct => {{
                if (!seenIds.has(compProduct.product_id)) {{
                    const fullProduct = this.getProductById(compProduct.product_id);
                    if (fullProduct) {{
                        uniqueProducts.push({{
                            ...fullProduct,
                            compatibility_info: {{
                                vehicle_model: compProduct.vehicle_model_name,
                                from_year: compProduct.from_year,
                                to_year: compProduct.to_year
                            }}
                        }});
                        seenIds.add(compProduct.product_id);
                    }}
                }}
            }});

            return {{
                success: true,
                products: uniqueProducts,
                total_count: uniqueProducts.length,
                vehicle_info: vehicleData
            }};
        }},

        getVehicleCompatibilityIndex() {{
            return {{ success: true, compatibility_index: this.vehicleCompatibilityIndex }};
        }},

        getCompatibleVehicles(productId) {{
            const compatibleVehicles = [];

            this.vehicleCompatibilityIndex.forEach(vehicle => {{
                const isCompatible = vehicle.compatible_products.some(
                    product => product.product_id == productId
                );
                if (isCompatible) {{
                    compatibleVehicles.push({{
                        vehicle_model_id: vehicle.vehicle_model_id,
                        vehicle_model_name: vehicle.vehicle_model_name,
                        brand_id: vehicle.brand_id,
                        brand_name: vehicle.brand_name,
                        from_year: vehicle.from_year,
                        to_year: vehicle.to_year,
                        year_range: vehicle.year_range
                    }});
                }}
            }});

            return compatibleVehicles;
        }}"""

            # Find where to insert the compatibility data
            # Look for the end of the main object (before the last closing brace)
            last_brace_pos = static_api_content.rfind('}')
            if last_brace_pos == -1:
                raise Exception("Could not find the main object closing brace")

            # Find the position before the last brace and any trailing content
            insert_pos = last_brace_pos

            # Check if there are functions already defined
            if 'getProductById' in static_api_content:
                # If functions exist, insert before the last function's closing brace
                last_function_brace = static_api_content.rfind('    }', 0, last_brace_pos)
                if last_function_brace != -1:
                    insert_pos = last_function_brace + 5  # Position after the function closing brace

            # Insert compatibility data and functions
            updated_content = (
                    static_api_content[:insert_pos] +
                    f',\n    vehicleCompatibilityIndex: {json.dumps(compatibility_data, ensure_ascii=False)}' +
                    compatibility_functions +
                    static_api_content[insert_pos:]
            )

            # Save the updated static API
            with open(static_api_path, 'w', encoding='utf-8') as f:
                f.write(updated_content)

            print("✅ Updated static API with vehicle compatibility functions")

        except Exception as e:
            print(f"❌ Error updating static API with compatibility: {e}")
            import traceback
            traceback.print_exc()

# Usage with your Odoo.sh credentials
if __name__ == "__main__":
    exporter = AlSajiDataExporter()
    exporter.export_all_data(force_update=True)
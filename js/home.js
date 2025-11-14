// Homepage specific functionality
document.addEventListener('DOMContentLoaded', async function() {
    await loadHomepageData();
    setupHomepageEvents();

    // Load initial cart count
    try {
        const cartResult = await alsajiAPI.getCart();
        if (cartResult.success && cartResult.cart) {
            updateCartCount(cartResult.cart.item_count || 0);
        }
    } catch (error) {
        console.log('Cart not initialized yet');
    }
});

async function loadHomepageData() {
    try {
        console.log('🏠 Loading homepage data...');

        // Load all data in parallel
        const [categories, brands, products] = await Promise.all([
            alsajiAPI.getCategories(),
            alsajiAPI.getBrands(),
            alsajiAPI.getFeaturedProducts(8)
        ]);

        renderCategories(categories);
        renderBrandsHome(brands);
        renderFeaturedProducts(products);

        // Initialize vehicle selection after content is loaded
        initializeVehicleSelection();

        console.log('✅ Homepage data loaded successfully');

    } catch (error) {
        console.error('❌ Failed to load homepage data:', error);
        showNotification('Failed to load homepage content', 'error');
    }
}

function initializeVehicleSelection() {
    const makeSelect = document.getElementById('make');
    const modelSelect = document.getElementById('model');
    const yearSelect = document.getElementById('year');
    const applyBtn = document.getElementById('applyFitment');
    const clearBtn = document.getElementById('clearFitment');

    if (!makeSelect || !modelSelect || !yearSelect || !applyBtn || !clearBtn) {
        console.error('❌ Vehicle selection elements not found');
        return;
    }

    console.log('🚗 Initializing vehicle selection...');

    // ✅ ADD THIS LINE - Load the vehicle makes when initializing
    loadVehicleMakes();

    // Apply fitment button event
    applyBtn.addEventListener('click', function() {
        const selectedMake = makeSelect.options[makeSelect.selectedIndex];
        const selectedModel = modelSelect.options[modelSelect.selectedIndex];
        const selectedYear = yearSelect.value;

        if (makeSelect.value && modelSelect.value && yearSelect.value) {
            const vehicle = {
                makeId: makeSelect.value,
                makeName: selectedMake.text,
                modelId: modelSelect.value,
                modelName: selectedModel.text,
                year: yearSelect.value
            };

            console.log('🚗 Vehicle selected:', vehicle);

            // Save vehicle and navigate to shop
            vehicleManager.saveVehicle(vehicle);
            vehicleManager.goToShopWithVehicle();
        } else {
            alert('Please select make, model, and year');
        }
    });

    // Clear fitment button event
    clearBtn.addEventListener('click', function() {
        makeSelect.value = '';
        modelSelect.innerHTML = '<option value="">Select Model</option>';
        modelSelect.disabled = true;
        yearSelect.innerHTML = '<option value="">Select Year</option>';
        yearSelect.disabled = true;

        // Clear any displayed logo
        const existingLogo = document.getElementById('selectedBrandLogo');
        if (existingLogo) {
            existingLogo.remove();
        }

        vehicleManager.clearVehicle();
        console.log('🚗 Vehicle selection cleared');
    });

    // Make selection event - load models
    makeSelect.addEventListener('change', function() {
        const makeId = this.value;
        const selectedOption = this.options[this.selectedIndex];
        const logoUrl = selectedOption.getAttribute('data-logo');

        showSelectedBrandLogo(logoUrl);

        if (makeId) {
            loadVehicleModels(makeId);
            modelSelect.disabled = false;
        } else {
            modelSelect.innerHTML = '<option value="">Select Model</option>';
            modelSelect.disabled = true;
            yearSelect.innerHTML = '<option value="">Select Year</option>';
            yearSelect.disabled = true;
        }
    });

    // Model selection event - load years
    modelSelect.addEventListener('change', function() {
        const modelId = this.value;
        if (modelId) {
            loadVehicleYears();
            yearSelect.disabled = false;
        } else {
            yearSelect.innerHTML = '<option value="">Select Year</option>';
            yearSelect.disabled = true;
        }
    });
}

function loadVehicleYears() {
    const yearSelect = document.getElementById('year');
    const currentYear = new Date().getFullYear();
    const startYear = 1990;

    let yearOptions = '<option value="">Select Year</option>';
    for (let year = currentYear; year >= startYear; year--) {
        yearOptions += `<option value="${year}">${year}</option>`;
    }

    yearSelect.innerHTML = yearOptions;
}

async function loadVehicleMakes() {
    try {
        const response = await fetch('data/json/vehicle_brands.json');

        if (response.ok) {
            const brandsData = await response.json();
            console.log('🚗 Loaded vehicle brands from JSON:', brandsData);

            const makeSelect = document.getElementById('make');
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
            await loadVehicleMakesFromAPI();
        }
    } catch (error) {
        console.error('❌ Failed to load vehicle brands from JSON:', error);
        await loadVehicleMakesFromAPI();
    }
}

async function loadVehicleModels(makeId) {
    try {
        const response = await fetch('data/json/vehicle_models.json');

        if (response.ok) {
            const modelsData = await response.json();
            console.log('🚙 Loaded vehicle models from JSON:', modelsData);

            const modelSelect = document.getElementById('model');
            if (modelSelect) {
                modelSelect.innerHTML = '<option value="">Select Model</option>' +
                    modelsData.map(model => {
                        const modelName = model.name;
                        const modelId = model.id;
                        const logoUrl = model.logo && model.logo.length > 0 ? model.logo[0] : '';

                        return `<option value="${modelId}" data-logo="${logoUrl}">${modelName}</option>`;
                    }).join('');
            }
        } else {
            await loadVehicleModelsFromAPI(makeId);
        }
    } catch (error) {
        console.error('❌ Failed to load vehicle models from JSON:', error);
        await loadVehicleModelsFromAPI(makeId);
    }
}

// Function to display selected brand logo
function showSelectedBrandLogo(logoUrl) {
    // Remove any existing logo display
    const existingLogo = document.getElementById('selectedBrandLogo');
    if (existingLogo) {
        existingLogo.remove();
    }

    if (logoUrl) {
        const makeSelect = document.getElementById('make');
        const logoContainer = document.createElement('div');
        logoContainer.id = 'selectedBrandLogo';
        logoContainer.style.cssText = `
            margin-top: 8px;
            text-align: center;
            padding: 8px;
            background: var(--w2);
            border-radius: 8px;
        `;

        logoContainer.innerHTML = `
            <img src="${logoUrl}"
                 alt="Brand Logo"
                 style="max-height: 40px; max-width: 100px; object-fit: contain;"
                 onerror="this.style.display='none'">
        `;

        makeSelect.parentNode.appendChild(logoContainer);
    }
}

function setupHomepageEvents() {
    console.log('🛠️ Setting up homepage events...');

    // Enhanced add to cart buttons with validation
    document.addEventListener('click', function(e) {
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        if (addToCartBtn && !addToCartBtn.disabled) {
            const productId = addToCartBtn.dataset.productId;

            console.log('🛒 Homepage add to cart clicked:', {
                productId: productId,
                element: addToCartBtn,
                dataset: addToCartBtn.dataset
            });

            // Add loading state to button
            const originalText = addToCartBtn.textContent;
            addToCartBtn.textContent = 'Adding...';
            addToCartBtn.disabled = true;

            addToCart(productId).finally(() => {
                // Restore button state
                addToCartBtn.textContent = originalText;
                addToCartBtn.disabled = false;
            });
        }
    });

    console.log('✅ Homepage events setup complete');
}

// API fallback functions (add these if they don't exist)
async function loadVehicleMakesFromAPI() {
    console.log('📡 Loading vehicle makes from API...');
    // Implement your API fallback here
}

async function loadVehicleModelsFromAPI(makeId) {
    console.log('📡 Loading vehicle models from API for make:', makeId);
    // Implement your API fallback here
}









function renderCategories(categories) {
    const container = document.getElementById('popularCategories');
    if (!container) return;

    // Handle both array format and API response format
    const categoriesList = categories.categories || categories;

    if (!Array.isArray(categoriesList) || categoriesList.length === 0) {
        container.innerHTML = '<div class="muted" style="text-align:center;padding:20px">No categories available</div>';
        return;
    }

    container.innerHTML = categoriesList.slice(0, 8).map(cat => {
        // Safely extract category data
        const categoryName = typeof cat === 'object' ? cat.name : String(cat);
        const productCount = cat.product_count || 0;

        // Handle image URL - use placeholder if not available
        const imageUrl = cat.image_url ?
            (cat.image_url.startsWith('http') ? cat.image_url : `https://alsajigroup-staging-24665929.dev.odoo.com${cat.image_url}`) :
            `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPkNhdGVnb3J5PC90ZXh0Pgo8L3N2Zz4K`;

        return `
            <div class="card"
                 onclick="window.location.href='shop.html?category=${encodeURIComponent(categoryName)}'"
                 style="cursor:pointer; text-align:center; border-radius:10px; overflow:hidden; background:#f8f9fa; display:flex; flex-direction:column; justify-content:space-between; height:100%;">

                <div style="position:relative; width:100%; aspect-ratio:1/1; overflow:hidden; background:#ffffff;">
                    <img src="${imageUrl}"
                         alt="${categoryName}"
                         style="width:100%; height:100%; object-fit:contain; padding:0px;"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPkNhdGVnb3J5PC90ZXh0Pgo8L3N2Zz4K'">

                </div>

                <div style="margin-top:8px; padding:0 8px 8px;">
                    <div style="font-weight:500; margin-bottom:4px;">${categoryName}</div>
                    <div class="muted" style="font-size:12px;">${productCount} product${productCount !== 1 ? 's' : ''}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderBrandsHome(brands) {
    const container = document.getElementById('topBrands');
    if (!container) return;

    // Handle both array format and API response format
    const brandsList = brands.brands || brands;

    if (!Array.isArray(brandsList) || brandsList.length === 0) {
        container.innerHTML = '<div class="muted" style="text-align:center;padding:20px">No brands available</div>';
        return;
    }

    container.innerHTML = brandsList.slice(0, 12).map(brand => {
        // Safely extract brand data
        const brandName = typeof brand === 'object' ? brand.name : String(brand);

        // Handle image URL - use placeholder if not available
        const imageUrl = brand.logo
          ? brand.logo // use full URL directly
          : `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPkJyYW5kPC90ZXh0Pgo8L3N2Zz4K`;

        return `
            <div class="card"
                 onclick="window.location.href='shop.html?brand=${encodeURIComponent(brandName)}'"
                 style="cursor:pointer; text-align:center; border-radius:10px; overflow:hidden; display:flex; background:#f8f9fa; flex-direction:column; justify-content:space-between; height:100%;">

                <div style="position:relative; width:100%; aspect-ratio:1/1; overflow:hidden; background:#ffffff;">
                    <img src="${imageUrl}"
                         alt="${brandName}"
                         style="width:100%; height:100%; object-fit:contain; padding:15px;"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPkJyYW5kPC90ZXh0Pgo8L3N2Zz4K'">
                </div>

                <div style="margin-top:6px; padding:0 8px 8px;">
                    <div style="font-weight:500;">${brandName}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderFeaturedProducts(products) {
    const container = document.getElementById('featuredProducts');
    if (!container) return;

    // Handle both array format and API response format
    const productsList = products.products || products;

    if (!Array.isArray(productsList) || productsList.length === 0) {
        container.innerHTML = '<div class="muted" style="text-align:center;padding:20px">No featured products available</div>';
        return;
    }

    container.innerHTML = productsList.slice(0, 8).map(product => {
        // Safely extract product data
        const productName = product.name || 'Unnamed Product';
        const productBrand = product.brand ?
            (typeof product.brand === 'object' ? product.brand.name : product.brand) :
            'No Brand';
        const productCategory = product.category ?
            (typeof product.category === 'object' ? product.category.name : product.category) :
            'Uncategorized';
        const reference = product.default_code || product.reference || '';
        const price = product.price || 0;
        const inStock = product.in_stock !== false;

        // Handle image URL - use placeholder if not available
        const imageUrl = product.image_url ?
            (product.image_url.startsWith('http') ? product.image_url : `https://alsajigroup-staging-24665929.dev.odoo.com${product.image_url}`) :
            `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPlByb2R1Y3Q8L3RleHQ+Cjwvc3ZnPgo=`;

        return `
            <div class="card"
                 style="text-align:center; border-radius:10px; overflow:hidden; display:flex; flex-direction:column; background:#f8f9fa; justify-content:space-between; height:100%;">

                <div style="position:relative; width:100%; aspect-ratio:1/1; overflow:hidden; background:#ffffff;">
                    <img src="${imageUrl}"
                         alt="${productName}"
                         style="width:100%; height:100%; object-fit:contain; padding:10px;"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPlByb2R1Y3Q8L3RleHQ+Cjwvc3ZnPgo='">
                </div>

                <div style="padding:12px; flex-grow:1; display:flex; flex-direction:column;">
                    <div class="muted" style="font-size:12px; margin-bottom:4px;">${productBrand} • ${reference}</div>
                    <div style="font-weight:500; margin-bottom:8px; flex-grow:1;">${productName}</div>

                    <div class="row between" style="align-items:center; margin-bottom:4px;">
                        <div style="color:var(--red); font-weight:600;">${formatPrice(price)}</div>
                        <button class="btn add-to-cart-btn"
                                data-product-id="${product.id}"
                                style="padding:6px 10px;font-size:12px"
                                ${!inStock ? 'disabled' : ''}>
                            ${inStock ? 'Add' : 'Out of Stock'}
                        </button>
                    </div>

                    <div class="muted" style="font-size:11px;">
                        ${inStock ? '✅ In stock' : '❌ Out of stock'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}










// Enhanced addToCart with comprehensive validation (same as shop.js)
async function addToCart(productId, quantity = 1) {
    console.log('🛒 addToCart called with:', { productId, quantity });

    // Comprehensive validation
    if (!validateProductId(productId)) {
        console.error('❌ Invalid product ID in addToCart:', productId);
        showNotification('Invalid product selection. Please try again.', 'error');
        return;
    }

    try {
        const validatedProductId = parseInt(productId);
        const validatedQuantity = parseInt(quantity) || 1;

        console.log('🛒 Sending to cart API:', {
            validatedProductId,
            validatedQuantity,
            dataType: {
                productId: typeof validatedProductId,
                quantity: typeof validatedQuantity
            }
        });

        const result = await alsajiAPI.addToCart(validatedProductId, validatedQuantity);

        if (result.success) {
            const cartCount = result.cart_count || result.cart?.item_count || 0;
            updateCartCount(cartCount);
            showNotification(result.message || 'Product added to cart successfully!', 'success');
        } else {
            console.error('❌ Cart API returned error:', result);
            showNotification(result.error || 'Failed to add product to cart. Please try again.', 'error');
        }
    } catch (error) {
        console.error('❌ Error in addToCart:', error);
        showNotification('Error adding product to cart. Please try again.', 'error');
    }
}

// Product ID validation (same as shop.js)
function validateProductId(productId) {
    console.log('🔍 Validating product ID:', productId, 'Type:', typeof productId);

    if (productId === null || productId === undefined || productId === '') {
        console.error('❌ Product ID is null/undefined/empty');
        return false;
    }

    // Convert to number and validate
    const id = parseInt(productId);
    const isValid = !isNaN(id) && id > 0;

    console.log('🔍 Product ID validation result:', {
        input: productId,
        parsed: id,
        isValid: isValid
    });

    return isValid;
}

// Update cart count (same as shop.js)
function updateCartCount(count) {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.textContent = count;
        cartCount.style.display = count > 0 ? 'flex' : 'none';
    }
}

// Show notification (same as shop.js)
function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.shop-notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = 'shop-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 10000;
        max-width: 300px;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Price formatting (same as shop.js)
function formatPrice(price) {
    if (typeof price !== 'number') {
        price = parseFloat(price) || 0;
    }
    return 'IQD ' + price.toLocaleString('en-US');
}

// Add CSS for animations if not already added
if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
// Homepage specific functionality
document.addEventListener('DOMContentLoaded', async function() {
    await loadHomepageData();
    setupHomepageEvents();
});

async function loadHomepageData() {
    try {
        // Load all data in parallel
        const [categories, brands, products] = await Promise.all([
            alsajiAPI.getCategories(),
            alsajiAPI.getBrands(),
            alsajiAPI.getFeaturedProducts(8)
        ]);

        renderCategories(categories);
        renderBrandsHome(brands);
        renderFeaturedProducts(products);
        loadVehicleMakes();

    } catch (error) {
        console.error('Failed to load homepage data:', error);
        showNotification('Failed to load homepage content', 'error');
    }
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

    container.innerHTML = categoriesList.map(cat => {
        // Safely extract category data
        const categoryName = typeof cat === 'object' ? cat.name : String(cat);
        const productCount = cat.product_count || 0;

        // Handle image URL - use placeholder if not available
        const imageUrl = cat.image_url ?
            (cat.image_url.startsWith('http') ? cat.image_url : `https://alsajigroup.odoo.com/${cat.image_url}`) :
            `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPkNhdGVnb3J5PC90ZXh0Pgo8L3N2Zz4K`;

        return `
            <div class="card"
                 onclick="window.location.href='shop.html?category=${encodeURIComponent(categoryName)}'"
                 style="cursor:pointer; text-align:center; border-radius:10px; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; height:100%;">

                <div style="position:relative; width:100%; aspect-ratio:1/1; overflow:hidden; background:#f8f9fa;">
                    <img src="${imageUrl}"
                         alt="${categoryName}"
                         style="width:100%; height:100%; object-fit:contain; padding:10px;"
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

    container.innerHTML = brandsList.map(brand => {
        // Safely extract brand data
        const brandName = typeof brand === 'object' ? brand.name : String(brand);

        // Handle image URL - use placeholder if not available
        const imageUrl = brand.image_url ?
            (brand.image_url.startsWith('http') ? brand.image_url : `http://localhost:8888${brand.image_url}`) :
            `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPkJyYW5kPC90ZXh0Pgo8L3N2Zz4K`;

        return `
            <div class="card"
                 onclick="window.location.href='shop.html?brand=${encodeURIComponent(brandName)}'"
                 style="cursor:pointer; text-align:center; border-radius:10px; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; height:100%;">

                <div style="position:relative; width:100%; aspect-ratio:1/1; overflow:hidden; background:#f8f9fa;">
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

    container.innerHTML = productsList.map(product => {
        // Safely extract product data
        const productName = product.name || 'Unnamed Product';
        const productBrand = typeof product.brand === 'object' ? product.brand.name : product.brand;
        const productCategory = typeof product.category === 'object' ? product.category.name : product.category;
        const oeReference = product.oe_reference || product.reference || 'N/A';
        const price = product.price || 0;
        const inStock = product.in_stock !== false; // Default to true if not specified

        // Handle image URL - use placeholder if not available
        const imageUrl = product.image_url ?
            (product.image_url.startsWith('http') ? product.image_url : `http://localhost:8888${product.image_url}`) :
            `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPlByb2R1Y3Q8L3RleHQ+Cjwvc3ZnPgo=`;

        return `
            <div class="card"
                 style="text-align:center; border-radius:10px; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; height:100%;">

                <div style="position:relative; width:100%; aspect-ratio:1/1; overflow:hidden; background:#f8f9fa;">
                    <img src="${imageUrl}"
                         alt="${productName}"
                         style="width:100%; height:100%; object-fit:contain; padding:10px;"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPlByb2R1Y3Q8L3RleHQ+Cjwvc3ZnPgo='">
                </div>

                <div style="padding:12px; flex-grow:1; display:flex; flex-direction:column;">
                    <div class="muted" style="font-size:12px; margin-bottom:4px;">${productBrand} • ${oeReference}</div>
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

async function loadVehicleMakes() {
    try {
        const brands = await alsajiAPI.getBrands();
        const makeSelect = document.getElementById('make');
        if (makeSelect) {
            // Handle both array format and API response format
            const brandsList = brands.brands || brands;

            makeSelect.innerHTML = '<option value="">Select Make</option>' +
                brandsList.map(brand => {
                    const brandName = typeof brand === 'object' ? brand.name : String(brand);
                    const brandId = brand.id || brandName; // Use name as ID if no ID
                    return `<option value="${brandId}">${brandName}</option>`;
                }).join('');
        }
    } catch (error) {
        console.error('Failed to load vehicle makes:', error);
    }
}

function setupHomepageEvents() {
    // Make selection change
    const makeSelect = document.getElementById('make');
    if (makeSelect) {
        makeSelect.addEventListener('change', async function(e) {
            const makeId = e.target.value;
            const modelSelect = document.getElementById('model');
            const yearSelect = document.getElementById('year');

            if (makeId) {
                modelSelect.disabled = false;
                yearSelect.disabled = true;
                yearSelect.innerHTML = '<option value="">Select Year</option>';

                try {
                    // For static data, we'll simulate models based on the make
                    const models = await getSimulatedVehicleModels(makeId);
                    modelSelect.innerHTML = '<option value="">Select Model</option>' +
                        models.map(model => `<option value="${model.id}">${model.name}</option>`).join('');
                } catch (error) {
                    console.error('Failed to load models:', error);
                    modelSelect.innerHTML = '<option value="">Select Model</option>';
                }
            } else {
                modelSelect.disabled = true;
                yearSelect.disabled = true;
                modelSelect.innerHTML = '<option value="">Select Model</option>';
                yearSelect.innerHTML = '<option value="">Select Year</option>';
            }
        });
    }

    // Model selection change
    const modelSelect = document.getElementById('model');
    if (modelSelect) {
        modelSelect.addEventListener('change', function(e) {
            const yearSelect = document.getElementById('year');
            if (e.target.value) {
                yearSelect.disabled = false;
                // Generate years (2010-2025)
                const years = Array.from({length: 16}, (_, i) => 2025 - i);
                yearSelect.innerHTML = '<option value="">Select Year</option>' +
                    years.map(year => `<option value="${year}">${year}</option>`).join('');
            } else {
                yearSelect.disabled = true;
                yearSelect.innerHTML = '<option value="">Select Year</option>';
            }
        });
    }

    // Apply fitment
    const applyBtn = document.getElementById('applyFitment');
    if (applyBtn) {
        applyBtn.addEventListener('click', function() {
            const make = document.getElementById('make');
            const model = document.getElementById('model');
            const year = document.getElementById('year');

            const makeValue = make.value;
            const modelValue = model.value;
            const yearValue = year.value;

            if (makeValue && modelValue && yearValue) {
                const makeText = make.options[make.selectedIndex].text;
                const modelText = model.options[model.selectedIndex].text;

                showNotification(`Vehicle fitment applied: ${makeText} ${modelText} ${yearValue}`, 'success');
                // In real app, this would filter products by vehicle compatibility
            } else {
                showNotification('Please select make, model, and year', 'error');
            }
        });
    }

    // Clear fitment
    const clearBtn = document.getElementById('clearFitment');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            document.getElementById('make').value = '';
            document.getElementById('model').value = '';
            document.getElementById('model').disabled = true;
            document.getElementById('model').innerHTML = '<option value="">Select Model</option>';
            document.getElementById('year').value = '';
            document.getElementById('year').disabled = true;
            document.getElementById('year').innerHTML = '<option value="">Select Year</option>';
            showNotification('Fitment cleared', 'info');
        });
    }

    // Add to cart buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.add-to-cart-btn')) {
            const productId = e.target.closest('.add-to-cart-btn').dataset.productId;
            addToCart(productId);
        }
    });
}

// Simulate vehicle models for static data
async function getSimulatedVehicleModels(makeId) {
    // This is a simulation - in a real app, you'd have vehicle model data
    const makeModels = {
        'toyota': [
            { id: 'camry', name: 'Camry' },
            { id: 'corolla', name: 'Corolla' },
            { id: 'rav4', name: 'RAV4' },
            { id: 'hilux', name: 'Hilux' },
            { id: 'land-cruiser', name: 'Land Cruiser' }
        ],
        'nissan': [
            { id: 'altima', name: 'Altima' },
            { id: 'sunny', name: 'Sunny' },
            { id: 'patrol', name: 'Patrol' },
            { id: 'xterra', name: 'X-Terra' }
        ],
        'mitsubishi': [
            { id: 'lancer', name: 'Lancer' },
            { id: 'pajero', name: 'Pajero' },
            { id: 'outlander', name: 'Outlander' }
        ],
        'hyundai': [
            { id: 'elantra', name: 'Elantra' },
            { id: 'tucson', name: 'Tucson' },
            { id: 'santa-fe', name: 'Santa Fe' }
        ],
        'kia': [
            { id: 'optima', name: 'Optima' },
            { id: 'sportage', name: 'Sportage' },
            { id: 'sorento', name: 'Sorento' }
        ]
    };

    // Get make name from ID
    const makeName = makeId.toLowerCase();

    // Return models for the make, or empty array if not found
    return makeModels[makeName] || [
        { id: 'model-1', name: 'Model 1' },
        { id: 'model-2', name: 'Model 2' },
        { id: 'model-3', name: 'Model 3' }
    ];
}

async function addToCart(productId, quantity = 1) {
    try {
        const result = await alsajiAPI.addToCart(productId, quantity);
        if (result.success) {
            updateCartCount(result.cart_count);
            showNotification(result.message, 'success');
        } else {
            showNotification('Failed to add product to cart', 'error');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        showNotification('Error adding to cart', 'error');
    }
}

function updateCartCount(count) {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.textContent = count;
    }
}
function updateCartCount(count) {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.textContent = count;
    }
}

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

// Utility function for price formatting
function formatPrice(price) {
    return 'IQD ' + (typeof price === 'number' ? price.toLocaleString() : '0');
}

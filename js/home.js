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
        renderBrands(brands);
        renderFeaturedProducts(products);
        loadVehicleMakes();

    } catch (error) {
        console.error('Failed to load homepage data:', error);
        showNotification('Failed to load homepage content', 'error');
    }
}

function renderCategories(categories) {
    const container = document.getElementById('popularCategories');
    if (container) {
        container.innerHTML = categories.map(cat => `
            <div class="card" onclick="window.location.href='shop.html?category=${cat.name}'" style="cursor:pointer">
                <img class="image" src="http://localhost:8888/${cat.image_url}"></img>
                <div class="muted" style="margin-top:8px">${cat.name}</div>
                <div class="muted">${cat.product_count} products</div>
            </div>
        `).join('');
    }
}

function renderBrands(brands) {
    const container = document.getElementById('topBrands');
    if (container) {
        container.innerHTML = brands.map(brand => `
            <div class="card" style="text-align:center;cursor:pointer" onclick="window.location.href='shop.html?brand=${brand.name}'">
                <image class="image" src='http://localhost:8888/${brand.image_url}'>

                </div>
                <div class="muted" style="margin-top:6px">${brand.name}</div>
            </div>
        `).join('');
    }
}

function renderFeaturedProducts(products) {
    const container = document.getElementById('featuredProducts');
    if (container) {
        container.innerHTML = products.map(product => `
            <div class="card">
                <img class="image" src = "http://localhost:8888//${product.image_url}"></img>
                <div class="muted">${product.brand} • ${product.oe_reference}</div>
                <div>${product.name}</div>
                <div class="row between">
                    <div style="color:var(--red)">${formatPrice(product.price)}</div>
                    <button class="btn add-to-cart-btn" data-product-id="${product.id}" style="padding:6px 10px;font-size:12px">
                        Add
                    </button>
                </div>
                <div class="muted">${product.in_stock ? 'In stock' : 'Out of stock'}</div>
            </div>
        `).join('');
    }
}

async function loadVehicleMakes() {
    try {
        const makes = await alsajiAPI.getVehicleMakes();
        const makeSelect = document.getElementById('make');
        if (makeSelect) {
            makeSelect.innerHTML = '<option value="">Select Make</option>' +
                makes.map(make => `<option value="${make.id}">${make.name}</option>`).join('');
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
                    const models = await alsajiAPI.getVehicleModels(makeId);
                    modelSelect.innerHTML = '<option value="">Select Model</option>' +
                        models.map(model => `<option value="${model.id}">${model.name}</option>`).join('');
                } catch (error) {
                    console.error('Failed to load models:', error);
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
                // Generate years (2015-2025)
                const years = Array.from({length: 11}, (_, i) => 2025 - i);
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
            const make = document.getElementById('make').value;
            const model = document.getElementById('model').value;
            const year = document.getElementById('year').value;

            if (make && model && year) {
                showNotification('Vehicle fitment applied!', 'success');
                // In real app, this would filter products
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
            document.getElementById('year').value = '';
            document.getElementById('year').disabled = true;
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

async function addToCart(productId) {
    try {
        const result = await alsajiAPI.addToCart(productId);
        if (result.success) {
            updateCartCount(result.cart_count);
            showNotification(result.message, 'success');
        }
    } catch (error) {
        showNotification('Failed to add product to cart', 'error');
    }
}
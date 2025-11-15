let allBrands = [];

async function loadBrandsData() {
    try {
        console.log("Fetching brands...");
        const brandsResponse = await alsajiAPI.getBrands();
        console.log("Brands response received:", brandsResponse);

        // Handle both direct array and API response format
        const brands = brandsResponse.brands || brandsResponse;
        allBrands = Array.isArray(brands) ? brands : []; // Save for search filter

        console.log("Processed brands:", allBrands);

        // Debug: Check if categories are present
        if (allBrands.length > 0) {
            const brandWithCategories = allBrands.find(brand => brand.categories && brand.categories.length > 0);
            if (brandWithCategories) {
                console.log("Brand with categories example:", brandWithCategories);
                console.log("Categories array:", brandWithCategories.categories);
            } else {
                console.log("No brands with categories found");
            }
        }

        renderBrands(allBrands);
    } catch (error) {
        console.error('Failed to load brands:', error);
        showNotification('Failed to load brands', 'error');
    }
}

function renderBrands(brands) {
    const container = document.getElementById('brandsGrid');
    if (!container) return;

    if (!brands || !brands.length) {
        container.innerHTML = `<p class="muted" style="text-align:center;padding:40px">No brands found.</p>`;
        return;
    }

    container.innerHTML = brands.map(brand => {
        // Safely extract brand data
        const brandName = brand.name || 'Unnamed Brand';
        const brandDescription = `Available in ${brand.product_count || 0} products`;

        // Handle categories - they should now be present in the data
        const brandCategories = brand.categories || [];

        console.log(`Rendering brand: ${brandName}, Categories count: ${brandCategories.length}`); // Debug

        // Handle image URL safely
        const image = brand.logo || 'assets/logo-placeholder-image.png';

        // Category chips - only render if categories exist
        const chipsHTML = brandCategories
            .map(cat => {
                const categoryName = cat.name || 'Unnamed Category';
                const categoryId = cat.id;

                return `
                <span class="chip"
                      onclick="event.stopPropagation(); filterByCategory('${categoryName}')"
                      style="cursor: pointer;">
                    ${categoryName}
                </span>
            `;
            })
            .join('');

        return `
        <section style="margin-top:32px; width:100%;">
            <div class="card"
                 style="padding:24px; margin-top:16px; width:100%; cursor:pointer;"
                 onclick="window.location.href='shop.html?brand=${encodeURIComponent(brandName)}'">

                <div class="row" style="gap:24px; align-items:center">

                    <!-- Logo -->
                    <div style="
                            width:120px;
                            height:120px;
                            background:var(--w2);
                            border-radius:8px;
                            overflow:hidden;
                            flex-shrink:0;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                        ">
                        <img src="data:image/png;base64,${image}"
                         alt="${brandName}"
                         style="max-width:100%;max-height:100%;object-fit:contain;padding:12px;"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\'text-align:center;color:var(--navy2);font-size:14px;padding:20px\'>${brandName}</div>'">

                          </div>

                    <!-- Text -->
                    <div style="flex:1;">
                        <h3 style="margin-bottom:8px;">${brandName}</h3>

                        <p class="muted" style="margin-top:6px; line-height:1.5;">
                            ${brandDescription}
                        </p>

                        ${brandCategories.length > 0
                            ? `<div class="row" style="gap:8px; margin-top:12px; flex-wrap:wrap;">
                                   ${chipsHTML}
                               </div>`
                            : '<p class="muted" style="margin-top:12px;font-size:14px;">No categories available</p>'
                        }
                    </div>

                </div>
            </div>
        </section>`;
    }).join('');
}

// Add this helper function for category filtering
function filterByCategory(categoryName) {
    event.stopPropagation();
    console.log(`Filtering by category: ${categoryName}`);
    // Navigate to shop page with category filter
    window.location.href = `shop.html?category=${encodeURIComponent(categoryName)}`;
}

function getBrandImageUrl(brand) {
    if (!brand) return '';

    // Handle both object and string formats
    const brandObj = typeof brand === 'object' ? brand : { name: String(brand) };

    if (brandObj.logo) {
        const imageUrl = brandObj.logo;
        return imageUrl
    }

    // Fallback to placeholder
    return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMzBWMTIwSDEyMFYxMDBIMzBWODBINzBWNjBaIiBmaWxsPSIjOEU5MEEwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOEU5MEEwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPkJyYW5kPC90ZXh0Pgo8L3N2Zz4K`;
}

// --- Live Search Filter ---
document.addEventListener("DOMContentLoaded", () => {
    loadBrandsData();

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", e => {
            const term = e.target.value.toLowerCase().trim();
            const filtered = allBrands.filter(brand => {
                const brandName = typeof brand === 'object' ? brand.name : String(brand);
                return brandName.toLowerCase().includes(term);
            });
            renderBrands(filtered);
        });
    }
});

// Utility functions (add if not already available)
function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.brands-notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = 'brands-notification';
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

// Add notification styles if not already present
if (!document.querySelector('#brands-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'brands-notification-styles';
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
let allBrands = [];

async function loadBrandsData() {
    try {
        console.log("Fetching brands...");
        const brands = await alsajiAPI.getBrands();
        console.log("Brands received:", brands);

        allBrands = brands; // Save for search filter
        renderBrands(brands);
    } catch (error) {
        console.error('Failed to load brands:', error);
        showNotification('Failed to load brands', 'error');
    }
}


function renderBrands(brands) {
    console.log("Rendering brands:", brands);

    const container = document.getElementById('brandsGrid');
    if (!container) return;

    if (!brands.length) {
        container.innerHTML = `<p class="muted">No brands found.</p>`;
        return;
    }
    console.log("Rendering to container:", container, brands);

    container.innerHTML = brands.map(brand => {
        const imageUrl = brand.image_url.startsWith('/')
            ? `http://localhost:8888${brand.image_url}`
            : brand.image_url;

        return `
        <div class="card brand-card"
             style="text-align:center; cursor:pointer;"
             onclick="window.location.href='shop.html?brand=${encodeURIComponent(brand.name)}'">

            <img class="image"
                 src="${imageUrl}"
                 alt="${brand.name}"
                 style="width:100%; height:150px; object-fit:contain;">

            <div class="muted" style="margin-top:6px">${brand.name}</div>
        </div>`;
    }).join('');
}

// --- Live Search Filter ---
document.addEventListener("DOMContentLoaded", () => {
    loadBrandsData();

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", e => {
            const term = e.target.value.toLowerCase().trim();
            const filtered = allBrands.filter(b =>
                b.name.toLowerCase().includes(term)
            );
            renderBrands(filtered);
        });
    }
});

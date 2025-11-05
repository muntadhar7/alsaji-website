// Common functionality across all pages
document.addEventListener('DOMContentLoaded', function() {
    initializeCommonFeatures();
});

function initializeCommonFeatures() {
    setupBranchMenu();
    setupLanguageToggle();
    updateCartCount();
}

// Branch menu functionality
function setupBranchMenu() {
    const branchBtn = document.getElementById('branchBtn');
    const branchMenu = document.getElementById('branchMenu');

    if (branchBtn && branchMenu) {
        branchBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            branchMenu.style.display = branchMenu.style.display === 'block' ? 'none' : 'block';
        });

        // Close menu when clicking outside
        document.addEventListener('click', function() {
            branchMenu.style.display = 'none';
        });

        // Load branches
        loadBranches();
    }
}

async function loadBranches() {
    try {
        const branches = await alsajiAPI.getBranches();
        const branchList = document.getElementById('branchList');
        if (branchList) {
            branchList.innerHTML = branches.map(branch => `
                <button class="chip branch-item" data-branch-id="${branch.id}" style="width:100%;text-align:left;margin:4px 0">
                    ${branch.name} <span class="muted" style="float:right">Pickup today 4-6</span>
                </button>
            `).join('');

            // Add click handlers for branch items
            document.querySelectorAll('.branch-item').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const branchId = this.dataset.branchId;
                    const branch = branches.find(b => b.id == branchId);
                    if (branch) {
                        document.getElementById('branchBtn').textContent = branch.name;
                        document.getElementById('branchMenu').style.display = 'none';
                        showNotification(`Branch changed to ${branch.name}`, 'success');
                    }
                });
            });
        }
    } catch (error) {
        console.error('Failed to load branches:', error);
    }
}

// Language toggle
function setupLanguageToggle() {
    const langBtn = document.getElementById('langBtn');
    if (langBtn) {
        langBtn.addEventListener('click', function() {
            const currentLang = this.textContent;
            const newLang = currentLang === 'AR' ? 'EN' : 'AR';
            this.textContent = newLang;

            // Toggle RTL/LTR
            document.documentElement.dir = newLang === 'AR' ? 'rtl' : 'ltr';
            document.documentElement.lang = newLang === 'AR' ? 'ar' : 'en';

            showNotification(`Language changed to ${newLang}`, 'info');
        });
    }
}

// Cart functionality
function updateCartCount(count = 0) {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.textContent = count;
    }
}

// Notification system
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
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

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add CSS for animations
const style = document.createElement('style');
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

// Utility functions
function formatPrice(price) {
    return 'IQD ' + price.toLocaleString();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
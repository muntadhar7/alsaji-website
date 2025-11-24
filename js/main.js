// Common functionality across all pages
document.addEventListener('DOMContentLoaded', function() {
    initializeCommonFeatures();
});

function initializeCommonFeatures() {
    setupBranchMenu();
    setupLanguageToggle();
    initializeHamburgerMenu();
    highlightActiveTab();
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
                    ${branch.name} <span class="muted" style="float:right">${getTranslation('pickup_today')}</span>
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
                        showNotification(`${getTranslation('branch_changed')} ${branch.name}`, 'success');
                    }
                });
            });
        }
    } catch (error) {
        console.error('Failed to load branches:', error);
    }
}

// Translation dictionary
const translations = {
    en: {
        'account': 'Account',
        'home': 'Home',
        'shop': 'Shop',
        'services': 'Services',
        'brands': 'Brands & Partners',
        'branches': 'Branches',
        'news': 'News & Guides',
        'support': 'Support',
        'trade': 'Trade Portal',
        'cart': 'Cart',
        'pickup_today': 'Pickup today 4-6',
        'branch_changed': 'Branch changed to',
        'language_changed': 'Language changed to',
        'english': 'English',
        'arabic': 'Arabic',
        'welcome': 'Welcome',
        'search_placeholder': 'Search products...',
        'all_categories': 'All Categories',
        'all_brands': 'All Brands',
        'apply_fitment': 'Apply',
        'clear_fitment': 'Clear',
        'select_make': 'Select Make',
        'select_model': 'Select Model',
        'select_year': 'Select Year',
        'select_engine': 'Select Engine',
        'select_import_type': 'Select Import Type'
    },
    ar: {
        'account': 'حسابي',
        'home': 'الرئيسية',
        'shop': 'المتجر',
        'services': 'الخدمات',
        'brands': 'العلامات التجارية والشركاء',
        'branches': 'الفروع',
        'news': 'الأخبار والدلائل',
        'support': 'الدعم',
        'trade': 'البوابة التجارية',
        'cart': 'عربة التسوق',
        'pickup_today': 'استلام اليوم 4-6',
        'branch_changed': 'تم تغيير الفرع إلى',
        'language_changed': 'تم تغيير اللغة إلى',
        'english': 'الإنجليزية',
        'arabic': 'العربية',
        'welcome': 'مرحباً',
        'search_placeholder': 'ابحث في المنتجات...',
        'all_categories': 'كل الفئات',
        'all_brands': 'كل الماركات',
        'apply_fitment': 'تطبيق',
        'clear_fitment': 'مسح',
        'select_make': 'اختر الشركة المصنعة',
        'select_model': 'اختر الموديل',
        'select_year': 'اختر السنة',
        'select_engine': 'اختر المحرك',
        'select_import_type': 'اختر نوع الاستيراد'
    }
};

function getTranslation(key, lang = null) {
    const currentLang = lang || (document.documentElement.lang === 'ar' ? 'ar' : 'en');
    return translations[currentLang][key] || key;
}

// Language toggle with directory switching
function setupLanguageToggle() {
    const langBtn = document.getElementById('langBtn');
    const mobileLangBtn = document.getElementById('mobileLangBtn');

    function toggleLanguage() {
        const currentLang = document.documentElement.lang || 'en';
        const newLang = currentLang === 'en' ? 'ar' : 'en';

        // Get current page info
        const currentPath = window.location.pathname;
        const currentPage = currentPath.split('/').pop() || 'index.html';
        const isInArabicDir = currentPath.includes('/arabic/');

        // Determine target URL
        let targetUrl;

        if (newLang === 'ar' && !isInArabicDir) {
            // Switch to Arabic: move to /arabic/ directory
            targetUrl = `/arabic/${currentPage}`;
        } else if (newLang === 'en' && isInArabicDir) {
            // Switch to English: move to root directory
            // Remove 'arabic/' from the path
            targetUrl = `/${currentPage}`;
        } else {
            // Should not happen, but fallback
            targetUrl = newLang === 'ar' ? '/arabic/index.html' : '/index.html';
        }

        console.log(`Switching from ${currentLang} to ${newLang}`);
        console.log(`Current path: ${currentPath}, Target: ${targetUrl}`);

        // Navigate to the target page
        window.location.href = targetUrl;
    }

    // Add event listeners
    if (langBtn) {
        langBtn.addEventListener('click', toggleLanguage);
    }
    if (mobileLangBtn) {
        mobileLangBtn.addEventListener('click', toggleLanguage);
    }

    // Initialize language button text on page load
    function initializeLanguageButton() {
        const currentLang = window.location.pathname.includes('/arabic/') ? 'ar' : 'en';

        if (langBtn) langBtn.textContent = currentLang === 'en' ? 'العربية' : 'English';
        if (mobileLangBtn) mobileLangBtn.textContent = currentLang === 'en' ? 'العربية' : 'English';

        // Set HTML attributes
        document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = currentLang;

        // Update page content for current language
        updatePageContent(currentLang);
    }

    initializeLanguageButton();
}
// Function to update page content based on language
function updatePageContent(lang) {
    console.log('Updating page content to:', lang);

    // Update navigation tabs
    const navTabs = document.querySelectorAll('.tab, .mobile-tab');
    navTabs.forEach(tab => {
        const href = tab.getAttribute('href');
        if (href) {
            const pageKey = getPageKeyFromHref(href);
            if (pageKey) {
                const translatedText = getTranslation(pageKey, lang);
                tab.textContent = translatedText;
            }
        }
    });

    // Update other UI elements with data-translate attribute
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        const translatedText = getTranslation(key, lang);

        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.placeholder = translatedText;
        } else {
            element.textContent = translatedText;
        }
    });

    // Update select options
    document.querySelectorAll('select option').forEach(option => {
        const value = option.value;
        if (value && translations[lang][value]) {
            option.textContent = translations[lang][value];
        }
    });

    // Update buttons with specific IDs
    const buttonTranslations = {
        'applyFitment': 'apply_fitment',
        'clearFitment': 'clear_fitment',
        'searchButton': 'search',
        'mobileFilterBtn': 'filters'
    };

    Object.keys(buttonTranslations).forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.textContent = getTranslation(buttonTranslations[buttonId], lang);
        }
    });

    // Update search placeholder
    const searchInput = document.getElementById('searchInput') || document.getElementById('mobileSearchInput');
    if (searchInput) {
        searchInput.placeholder = getTranslation('search_placeholder', lang);
    }

    // Update fitment select placeholders
    const fitmentSelects = ['make', 'model', 'year', 'engine', 'importType'];
    fitmentSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const firstOption = select.querySelector('option[value=""]');
            if (firstOption) {
                firstOption.textContent = getTranslation(`select_${selectId}`, lang);
            }
        }
    });
}

function getPageKeyFromHref(href) {
    const pageMap = {
        'index.html': 'home',
        'shop.html': 'shop',
        'services.html': 'services',
        'brands.html': 'brands',
        'branches.html': 'branches',
        'news.html': 'news',
        'support.html': 'support',
        'trade.html': 'trade',
        'account.html': 'account',
        'cart.html': 'cart'
    };

    const pageName = href.split('/').pop() || href;
    return pageMap[pageName];
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
    const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    return lang === 'ar' ? `دينار ${price.toLocaleString()}` : `IQD ${price.toLocaleString()}`;
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

// Layout loading
async function loadLayout() {
    try {
        const [headerRes, footerRes] = await Promise.all([
            fetch('../partials/header.html'),
            fetch('../partials/footer.html')
        ]);

        const [headerHtml, footerHtml] = await Promise.all([
            headerRes.text(),
            footerRes.text()
        ]);

        document.body.insertAdjacentHTML('afterbegin', headerHtml);
        document.body.insertAdjacentHTML('beforeend', footerHtml);

        document.body.style.visibility = 'visible';

        // Initialize ALL features after header is loaded
        initializeCommonFeatures();

        setTimeout(() => {
            initializeCartManager();
        }, 100);

    } catch (err) {
        console.error('Failed to load header/footer:', err);
        document.body.style.visibility = 'visible';
        // Initialize features even if header/footer fail
        initializeCommonFeatures();
    }
}

// Hamburger menu functionality
function initializeHamburgerMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileNav = document.getElementById('mobileNav');
    const mobileNavClose = document.getElementById('mobileNavClose');

    console.log('Hamburger menu elements:', { hamburgerBtn, mobileNav, mobileNavClose });

    if (hamburgerBtn && mobileNav && mobileNavClose) {
        // Remove any existing event listeners
        hamburgerBtn.replaceWith(hamburgerBtn.cloneNode(true));
        mobileNavClose.replaceWith(mobileNavClose.cloneNode(true));

        // Get fresh references after clone
        const freshHamburgerBtn = document.getElementById('hamburgerBtn');
        const freshMobileNavClose = document.getElementById('mobileNavClose');
        const freshMobileNav = document.getElementById('mobileNav');

        // Open menu
        freshHamburgerBtn.addEventListener('click', function() {
            console.log('Opening mobile menu');
            freshMobileNav.classList.add('active');
            freshHamburgerBtn.classList.add('active');
            document.body.classList.add('menu-open');
        });

        // Close menu with close button
        freshMobileNavClose.addEventListener('click', function() {
            console.log('Closing mobile menu');
            freshMobileNav.classList.remove('active');
            freshHamburgerBtn.classList.remove('active');
            document.body.classList.remove('menu-open');
        });

        // Close when clicking on mobile tabs
        const mobileTabs = freshMobileNav.querySelectorAll('.mobile-tab');
        mobileTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                freshMobileNav.classList.remove('active');
                freshHamburgerBtn.classList.remove('active');
                document.body.classList.remove('menu-open');
            });
        });

        // Close when clicking outside the nav content
        freshMobileNav.addEventListener('click', function(e) {
            if (e.target === this) {
                freshMobileNav.classList.remove('active');
                freshHamburgerBtn.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });

        // Close with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && freshMobileNav.classList.contains('active')) {
                freshMobileNav.classList.remove('active');
                freshHamburgerBtn.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });

        console.log('Hamburger menu initialized successfully');
    } else {
        console.error('Hamburger menu elements not found');
    }
}

// Active tab highlighting
function highlightActiveTab() {
    const tabs = document.querySelectorAll('header .tab, header .mobile-tab');
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    tabs.forEach(tab => {
        const tabHref = tab.getAttribute('href');
        const isActive = tabHref === currentPath;
        tab.classList.toggle('active', isActive);
    });
}

// Initialize cart manager (your existing function)
function initializeCartManager() {
    // Your existing cart manager code here
    if (typeof AlSajiAPI !== 'undefined') {
        console.log('Initializing cart manager...');
        // Your cart initialization code
    }
}

// Start everything when DOM is ready
document.addEventListener('DOMContentLoaded', loadLayout);

// Mobile menu functionality
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileNav = document.getElementById('mobileNav');
const mobileNavClose = document.getElementById('mobileNavClose');

if (hamburgerBtn && mobileNav) {
    hamburgerBtn.addEventListener('click', () => {
        mobileNav.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    mobileNavClose.addEventListener('click', () => {
        mobileNav.classList.remove('active');
        document.body.style.overflow = '';
    });

    // Close menu when clicking on links
    const mobileLinks = mobileNav.querySelectorAll('.mobile-tab');
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileNav.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}
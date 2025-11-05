// Trade portal functionality
document.addEventListener('DOMContentLoaded', function() {
    setupTradeTabs();
});

function setupTradeTabs() {
    const loginTab = document.getElementById('tradeLoginTab');
    const quickTab = document.getElementById('tradeQuickTab');
    const registerTab = document.getElementById('tradeRegisterTab');
    const loginView = document.getElementById('tradeLogin');
    const quickView = document.getElementById('tradeQuick');
    const registerView = document.getElementById('tradeRegister');

    function showTab(tab) {
        // Hide all views
        [loginView, quickView, registerView].forEach(view => {
            if (view) view.style.display = 'none';
        });

        // Remove active class from all tabs
        [loginTab, quickTab, registerTab].forEach(tab => {
            if (tab) tab.classList.remove('active');
        });

        // Show selected view and activate tab
        if (tab === 'login' && loginView && loginTab) {
            loginView.style.display = '';
            loginTab.classList.add('active');
        } else if (tab === 'quick' && quickView && quickTab) {
            quickView.style.display = '';
            quickTab.classList.add('active');
        } else if (tab === 'register' && registerView && registerTab) {
            registerView.style.display = '';
            registerTab.classList.add('active');
        }
    }

    // Add event listeners
    if (loginTab) loginTab.addEventListener('click', () => showTab('login'));
    if (quickTab) quickTab.addEventListener('click', () => showTab('quick'));
    if (registerTab) registerTab.addEventListener('click', () => showTab('register'));

    // Show login tab by default
    showTab('login');
}
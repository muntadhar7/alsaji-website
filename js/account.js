// Account page functionality
document.addEventListener('DOMContentLoaded', function() {
    setupAccountTabs();
});

function setupAccountTabs() {
    const retailBtn = document.getElementById('acctRetail');
    const tradeBtn = document.getElementById('acctTrade');
    const retailView = document.getElementById('acctRetailView');
    const tradeView = document.getElementById('acctTradeView');

    if (retailBtn && tradeBtn) {
        retailBtn.addEventListener('click', function() {
            retailBtn.classList.add('active');
            tradeBtn.classList.remove('active');
            retailView.style.display = '';
            tradeView.style.display = 'none';
        });

        tradeBtn.addEventListener('click', function() {
            tradeBtn.classList.add('active');
            retailBtn.classList.remove('active');
            retailView.style.display = 'none';
            tradeView.style.display = '';
        });
    }
}
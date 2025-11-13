async function loadLayout() {
  try {
    // Load header and footer in parallel
    const [headerRes, footerRes] = await Promise.all([
      fetch('partials/header.html'),
      fetch('partials/footer.html')
    ]);

    const [headerHtml, footerHtml] = await Promise.all([
      headerRes.text(),
      footerRes.text()
    ]);

    document.body.insertAdjacentHTML('afterbegin', headerHtml);
    document.body.insertAdjacentHTML('beforeend', footerHtml);

    // 🔥 NEW: Show page immediately, don't wait for cart
    document.body.style.visibility = 'visible';

    // Initialize cart count in background (non-blocking)
    setTimeout(() => {
      if (window.AlSajiCartEvents) {
        window.AlSajiCartEvents.refreshCartCount();
      }
    }, 100);

    // Highlight active tab
    const tabs = document.querySelectorAll('header .tab');
    const currentPath = window.location.pathname.split('/').pop();
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('href') === currentPath);
    });

  } catch (err) {
    console.error('Failed to load header/footer:', err);
    // 🔥 NEW: Always show the page, even if header/footer fails
    document.body.style.visibility = 'visible';
  }
}

document.addEventListener('DOMContentLoaded', loadLayout);
async function loadLayout() {
  try {
    // Load header
    const headerRes = await fetch('partials/header.html');
    const headerHtml = await headerRes.text();
    document.body.insertAdjacentHTML('afterbegin', headerHtml);

    // Highlight active tab
    const tabs = document.querySelectorAll('header .tab');
    const currentPath = window.location.pathname.split('/').pop();
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('href') === currentPath);
    });

    // Load footer
    const footerRes = await fetch('partials/footer.html');
    const footerHtml = await footerRes.text();
    document.body.insertAdjacentHTML('beforeend', footerHtml);

  } catch (err) {
    console.error('Failed to load header/footer:', err);
  }

  // ✅ Show the page ONLY after header/footer are loaded
  document.body.style.visibility = 'visible';
}

document.addEventListener('DOMContentLoaded', loadLayout);

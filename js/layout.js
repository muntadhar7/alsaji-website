async function loadLayout() {
  // Load header
  const header = await fetch('partials/header.html')
    .then(res => res.text())
    .catch(() => '<header>Header failed to load</header>');
  document.body.insertAdjacentHTML('afterbegin', header);

    // Highlight the active tab
  const tabs = document.querySelectorAll('header .tab');
  const currentPath = window.location.pathname.split('/').pop();
  tabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('href') === currentPath);
  });

  // Load footer
  const footer = await fetch('partials/footer.html')
    .then(res => res.text())
    .catch(() => '<footer>Footer failed to load</footer>');
  document.body.insertAdjacentHTML('beforeend', footer);
}

document.addEventListener('DOMContentLoaded', loadLayout);

async function loadLayout() {
  try {
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

    // Show page immediately
    document.body.style.visibility = 'visible';

    // Re-initialize header functionality
    if (window.reinitializeHeader) {
        window.reinitializeHeader();
    }

    // Rest of your code...
  } catch (err) {
    console.error('Failed to load header/footer:', err);
    document.body.style.visibility = 'visible';
  }
}
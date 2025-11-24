// utils/pathHelper.js
function getBasePath() {
    const currentPath = window.location.pathname;
    const isGitHubPages = window.location.hostname.includes('github.io');

    if (isGitHubPages) {
        const pathSegments = currentPath.split('/').filter(segment => segment);
        const repoName = pathSegments[0];
        const isArabic = pathSegments.includes('arabic');

        if (isArabic) {
            // In Arabic folder: /repo-name/arabic/
            return `/${repoName}/arabic/`;
        } else {
            // In root: /repo-name/
            return `/${repoName}/`;
        }
    } else {
        // Local development
        const isArabic = currentPath.includes('/arabic/');
        return isArabic ? '../' : './';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    fixAllPaths();
    if (typeof loadLayout === 'function') {
        loadLayout();
    }
});

function fixAllPaths() {
    const basePath = getBasePath();

    console.log('Base path detected:', basePath); // Debug log

    // Fix all links, images, scripts, and other assets
    document.querySelectorAll('a, img, script, link, iframe, source, embed').forEach(element => {
        const attr = getSrcHrefAttr(element);
        if (attr && element[attr]) {
            const originalUrl = element[attr];
            element[attr] = fixPath(originalUrl, basePath);
            console.log(`Fixed ${attr}: ${originalUrl} → ${element[attr]}`); // Debug log
        }
    });

    // Fix CSS background images and other inline styles
    document.querySelectorAll('[style*="url("]').forEach(element => {
        element.style.cssText = fixCssUrls(element.style.cssText, basePath);
    });
}

function getSrcHrefAttr(element) {
    if (element.hasAttribute('src')) return 'src';
    if (element.hasAttribute('href')) return 'href';
    return null;
}

function fixPath(url, basePath) {
    // Don't fix absolute URLs or external resources
    if (url.startsWith('http') || url.startsWith('//') || url.startsWith('data:') || url.startsWith('#')) {
        return url;
    }

    // Don't fix root-absolute paths (they need special handling for GitHub)
    if (url.startsWith('/')) {
        // For GitHub Pages, we might need to prepend repository name
        if (basePath.startsWith('/') && !url.startsWith(basePath)) {
            return basePath + url.substring(1);
        }
        return url;
    }

    // Fix relative paths
    if (url.startsWith('./') || url.startsWith('../')) {
        return basePath + url.replace(/^(\.\.\/|\.\/)/, '');
    }

    return basePath + url;
}

function fixCssUrls(cssText, basePath) {
    return cssText.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
        const fixedUrl = fixPath(url, basePath);
        return `url("${fixedUrl}")`;
    });
}


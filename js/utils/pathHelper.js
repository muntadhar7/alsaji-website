// pathHelper.js - FIXED VERSION
(function() {
    'use strict';

    // Remove the illegal return statement from here
    if (window.pathHelperLoaded) {
        console.log('Path helper already loaded, skipping...');
        return; // This return is fine inside a function
    }
    window.pathHelperLoaded = true;

    console.log('🚀 Path helper loading...');


    // Add this to pathHelper.js - OVERRIDE JAVASCRIPT PATH REQUESTS
function setupJavaScriptPathOverrides() {
    const basePath = getBasePath();
    console.log('🔧 Setting up JS path overrides with base:', basePath);

    // 1. Override fetch()
    const originalFetch = window.fetch;
    window.fetch = function(resource, options) {
        if (typeof resource === 'string') {
            const fixedResource = fixPath(resource, basePath);
            if (fixedResource !== resource) {
                console.log('🔧 Fixed fetch:', resource, '→', fixedResource);
            }
            resource = fixedResource;
        }
        return originalFetch.call(this, resource, options);
    };

    // 2. Override XMLHttpRequest (for older AJAX calls)
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        const fixedUrl = fixPath(url, basePath);
        if (fixedUrl !== url) {
            console.log('🔧 Fixed XHR:', url, '→', fixedUrl);
        }
        return originalXHROpen.call(this, method, fixedUrl, async, user, password);
    };

    // 3. Override import() for dynamic imports (if needed)
    const originalImport = window.import;
    if (originalImport) {
        window.import = function(url) {
            const fixedUrl = fixPath(url, basePath);
            console.log('🔧 Fixed import:', url, '→', fixedUrl);
            return originalImport(fixedUrl);
        };
    }
}

// Update your fixPath function to handle all cases
function fixPath(url, basePath) {
    // Don't fix absolute URLs or external resources
    if (url.startsWith('http') || url.startsWith('//') || url.startsWith('data:') || url.startsWith('#')) {
        return url;
    }

    // Don't fix root-absolute paths (they might need special handling)
    if (url.startsWith('/')) {
        // For GitHub Pages, prepend repo name if not already there
        if (basePath.startsWith('/') && !url.startsWith(basePath)) {
            return basePath + url.substring(1);
        }
        return url;
    }

    // Fix relative paths
    if (url.startsWith('./') || url.startsWith('../')) {
        return basePath + url.replace(/^(\.\.\/|\.\/)/, '');
    }

    // Fix simple relative paths
    return basePath + url;
}

// Call this in your initialization
document.addEventListener('DOMContentLoaded', function() {
    fixAllPaths(); // Fix HTML elements
    setupJavaScriptPathOverrides(); // Fix JavaScript internal paths
});

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

// In pathHelper.js - Only fix new elements, not existing ones multiple times
function fixAllPaths() {
    const basePath = getBasePath();

    console.log('Base path detected:', basePath);

    // Only fix elements that haven't been fixed yet
    document.querySelectorAll('a, img, script, link, iframe, source, embed').forEach(element => {
        if (element.hasAttribute('data-path-fixed')) return;

        const attr = getSrcHrefAttr(element);
        if (attr && element[attr]) {
            const originalUrl = element[attr];
            element[attr] = fixPath(originalUrl, basePath);
            element.setAttribute('data-path-fixed', 'true');
            console.log(`Fixed ${attr}: ${originalUrl} → ${element[attr]}`);
        }
    });
}
function getSrcHrefAttr(element) {
    if (element.hasAttribute('src')) return 'src';
    if (element.hasAttribute('href')) return 'href';
    return null;
}


function fixCssUrls(cssText, basePath) {
    return cssText.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
        const fixedUrl = fixPath(url, basePath);
        return `url("${fixedUrl}")`;
    });
}

})();
// pathHelper.js - CORRECTED VERSION
(function() {
    'use strict';

    if (window.pathHelperLoaded) {
        console.log('Path helper already loaded, skipping...');
        return;
    }
    window.pathHelperLoaded = true;

    console.log('🚀 Path helper loading...');

    // 1. Define functions FIRST
    function getBasePath() {
        const currentPath = window.location.pathname;
        const isGitHubPages = window.location.hostname.includes('github.io');

        console.log('📍 Path Helper Debug:');
        console.log('  - Hostname:', window.location.hostname);
        console.log('  - Pathname:', currentPath);
        console.log('  - Is GitHub Pages:', isGitHubPages);

        if (isGitHubPages) {
            const pathSegments = currentPath.split('/').filter(segment => segment);
            const repoName = pathSegments[0] || 'alsaji-website';
            const isArabic = pathSegments.includes('arabic');

            console.log('  - Repo Name:', repoName);
            console.log('  - Is Arabic:', isArabic);

            // IMPORTANT: For GitHub Pages, always use root paths
            return `/${repoName}/`;
        } else {
            // Local development
            const isArabic = currentPath.includes('/arabic/');
            const basePath = isArabic ? '../' : './';
            console.log('  - Is Arabic:', isArabic);
            console.log('  - Final Base Path:', basePath);
            return basePath;
        }
    }

    function fixPath(url, basePath) {
        // Don't fix absolute URLs or external resources
        if (url.startsWith('http') || url.startsWith('//') || url.startsWith('data:') || url.startsWith('#')) {
            return url;
        }

        // Don't fix root-absolute paths
        if (url.startsWith('/')) {
            return url;
        }

        // Fix relative paths
        if (url.startsWith('./') || url.startsWith('../')) {
            return basePath + url.replace(/^(\.\.\/|\.\/)/, '');
        }

        // Fix simple relative paths
        return basePath + url;
    }

    function getSrcHrefAttr(element) {
        if (element.hasAttribute('src')) return 'src';
        if (element.hasAttribute('href')) return 'href';
        return null;
    }

    function fixAllPaths() {
        const basePath = getBasePath();
        console.log('🔄 fixAllPaths running with base:', basePath);

        // Only fix elements that haven't been fixed yet
        document.querySelectorAll('a, img, script, link, iframe, source, embed').forEach(element => {
            if (element.hasAttribute('data-path-fixed')) return;

            const attr = getSrcHrefAttr(element);
            if (attr && element[attr]) {
                const originalUrl = element[attr];
                const fixedUrl = fixPath(originalUrl, basePath);
                element[attr] = fixedUrl;
                element.setAttribute('data-path-fixed', 'true');
                console.log(`✅ Fixed ${element.tagName}.${attr}: ${originalUrl} → ${fixedUrl}`);
            }
        });
    }

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

        // 2. Override XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            const fixedUrl = fixPath(url, basePath);
            if (fixedUrl !== url) {
                console.log('🔧 Fixed XHR:', url, '→', fixedUrl);
            }
            return originalXHROpen.call(this, method, fixedUrl, async, user, password);
        };
    }

    // 2. Initialize everything
    function initializePathHelper() {
        console.log('🎯 Initializing path helper...');

        // Fix existing HTML elements
        fixAllPaths();

        // Setup JavaScript overrides for future requests
        setupJavaScriptPathOverrides();

        // Fix paths when new elements are added to DOM
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    setTimeout(fixAllPaths, 10);
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // 3. Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePathHelper);
    } else {
        initializePathHelper();
    }

})();
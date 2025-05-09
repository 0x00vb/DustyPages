/**
 * Main application file for RustyPages
 * Initializes all modules and handles global events
 */

(function() {
    // Initialize application when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        // Register service worker for cache (if supported)
        registerServiceWorker();
        
        // Initialize modules
        Reader.init();
        Library.init();
        
        // Set iOS specific settings
        setupIOSSpecific();
        
        // Handle viewport resizing and orientation changes
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        
        // Initial resize handling
        handleResize();
    });
    
    /**
     * Setup iOS specific settings
     */
    function setupIOSSpecific() {
        // Prevent double-tap to zoom
        document.addEventListener('touchend', function(event) {
            var now = Date.now();
            var lastTouch = this.lastTouch || now + 1;
            var delta = now - lastTouch;
            if (delta < 500 && delta > 0) {
                event.preventDefault();
            }
            this.lastTouch = now;
        }, false);
        
        // Disable bounce effect
        document.body.addEventListener('touchmove', function(e) {
            if (e.target.tagName !== 'CANVAS' && !e.target.classList.contains('pdf-viewer')) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Fix 300ms delay on iOS
        var links = document.querySelectorAll('a, button');
        Array.from(links).forEach(function(link) {
            link.style.cursor = 'pointer';
            link.addEventListener('touchstart', function() {});
        });
    }
    
    /**
     * Handle window resize or orientation change
     */
    function handleResize() {
        // Set height for mobile browsers (address bar issues)
        var height = window.innerHeight;
        document.getElementById('app').style.height = height + 'px';
    }
    
    /**
     * Register service worker if supported
     */
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            // Skip for iOS 9 since it doesn't support Service Workers
            var userAgent = window.navigator.userAgent;
            var iOS = !!userAgent.match(/iPad/i) || !!userAgent.match(/iPhone/i);
            var webkit = !!userAgent.match(/WebKit/i);
            var iOSSafari = iOS && webkit && !userAgent.match(/CriOS/i);
            
            if (!iOSSafari) {
                navigator.serviceWorker.register('service-worker.js')
                    .then(function(registration) {
                        console.log('Service Worker registered with scope:', registration.scope);
                    })
                    .catch(function(error) {
                        console.log('Service Worker registration failed:', error);
                    });
            }
        }
    }
    
    /**
     * Show alert if storage is not available
     */
    function checkStorageAvailability() {
        try {
            var storage = window.localStorage;
            var testKey = '__storage_test__';
            storage.setItem(testKey, testKey);
            storage.removeItem(testKey);
            return true;
        } catch (e) {
            alert('LocalStorage is not available. RustyPages requires localStorage to function properly. Please enable storage for this website in your browser settings.');
            return false;
        }
    }
    
    /**
     * Add to home screen hint (for iOS)
     */
    function showAddToHomeScreenHint() {
        if (('standalone' in window.navigator) && !window.navigator.standalone) {
            var hintElement = document.createElement('div');
            hintElement.style.position = 'fixed';
            hintElement.style.bottom = '0';
            hintElement.style.left = '0';
            hintElement.style.width = '100%';
            hintElement.style.padding = '10px';
            hintElement.style.backgroundColor = '#f8f8f8';
            hintElement.style.borderTop = '1px solid #ddd';
            hintElement.style.textAlign = 'center';
            hintElement.style.zIndex = '1000';
            hintElement.innerHTML = 'Add to Home Screen for the best reading experience. <button id="dismiss-hint" style="margin-left: 10px;">Dismiss</button>';
            
            document.body.appendChild(hintElement);
            
            document.getElementById('dismiss-hint').addEventListener('click', function() {
                document.body.removeChild(hintElement);
                localStorage.setItem('hintDismissed', 'true');
            });
        }
    }
    
    // Check for storage and show add to home screen hint
    if (checkStorageAvailability() && !localStorage.getItem('hintDismissed')) {
        // Delay hint to avoid overwhelming on first visit
        setTimeout(showAddToHomeScreenHint, 3000);
    }
})(); 
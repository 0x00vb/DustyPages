/**
 * Main application file for RustyPages
 * Initializes all modules and handles global events
 */

(function() {
    // Safari iOS detection functions
    var isIOS = !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform);
    var isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    var iosVersion = 0;
    
    // Get iOS version if applicable
    if (isIOS) {
        var match = navigator.userAgent.match(/OS (\d+)_/);
        if (match && match[1]) {
            iosVersion = parseInt(match[1], 10);
        }
    }
    
    // Determine if using iOS 9 Safari
    var isIOS9Safari = isIOS && isSafari && iosVersion === 9;
    
    // Store modules in the global object if available
    if (window.RustyPages && window.RustyPages.modules) {
        if (window.Reader) window.RustyPages.modules.Reader = window.Reader;
        if (window.Library) window.RustyPages.modules.Library = window.Library;
        if (window.Storage) window.RustyPages.modules.Storage = window.Storage;
    }
    
    // Defer startup for Safari iOS 9
    if (isIOS9Safari) {
        // For iOS 9 Safari, we need a more careful loading sequence
        window.addEventListener('load', function() {
            console.log('iOS 9 Safari detected - using compatibility mode');
            // Safari iOS 9 needs a delay to fully initialize the DOM
            setTimeout(initializeApp, 500);
        });
    } else {
        // Normal initialization for other browsers
        document.addEventListener('DOMContentLoaded', initializeApp);
    }
    
    /**
     * Main initialization function
     */
    function initializeApp() {
        console.log('Initializing RustyPages app');
        
        try {
            // Set up classes for iOS
            if (isIOS) {
                // Add iOS version as class to body for specific CSS targeting
                document.body.classList.add('ios');
                document.body.classList.add('ios-' + iosVersion);
                
                // Add Safari class if applicable
                if (isSafari) {
                    document.body.classList.add('ios-safari');
                    
                    // For iOS Safari, we use simpler UI
                    document.body.classList.add('simple-animations');
                }
                
                // Special case for iOS 9 Safari
                if (isIOS9Safari) {
                    enableLegacyCompatMode();
                }
            }
            
            // Register service worker for cache (if supported)
            registerServiceWorker();
            
            // Initialize modules - wrapped in try/catch for safety
            try {
                if (window.Reader && typeof Reader.init === 'function') {
                    Reader.init();
                } else {
                    console.error('Reader module not available');
                    throw new Error('Reader module not available');
                }
                
                if (window.Library && typeof Library.init === 'function') {
                    Library.init();
                } else {
                    console.error('Library module not available');
                    throw new Error('Library module not available');
                }
                
                // Set iOS specific settings
                setupIOSSpecific();
                
                // Handle viewport resizing and orientation changes
                window.addEventListener('resize', handleResize);
                window.addEventListener('orientationchange', handleResize);
                
                // Initial resize handling
                handleResize();
                
                // Check storage availability
                if (checkStorageAvailability() && !localStorage.getItem('hintDismissed')) {
                    // Delay hint to avoid overwhelming on first visit
                    setTimeout(showAddToHomeScreenHint, 3000);
                }
                
                // Mark app as ready in global object
                if (window.RustyPages) {
                    window.RustyPages.init();
                }
                
            } catch (moduleError) {
                console.error('Error initializing modules:', moduleError);
                
                // For iOS 9, try the fallback mode instead of showing error
                if (isIOS9Safari && window.RustyPages && !window.RustyPages.fallbackMode) {
                    console.warn('Using fallback mode for iOS 9 Safari');
                    window.RustyPages.activateFallbackMode();
                    return;
                }
                
                showErrorMessage('Failed to initialize application modules. Please reload the page.');
            }
            
        } catch (e) {
            console.error('Fatal initialization error:', e);
            
            // For iOS 9, try the fallback mode instead of showing error
            if (isIOS9Safari && window.RustyPages && !window.RustyPages.fallbackMode) {
                console.warn('Using fallback mode for iOS 9 Safari after fatal error');
                window.RustyPages.activateFallbackMode();
                return;
            }
            
            showErrorMessage('Failed to initialize application. Please reload the page.');
        }
    }
    
    /**
     * Enable legacy compatibility mode for iOS 9
     */
    function enableLegacyCompatMode() {
        console.log('Enabling legacy compatibility mode for iOS 9 Safari');
        
        // Use absolutely minimal UI features and no animations for Safari iOS 9
        document.body.classList.add('ios-9-compat');
        
        // Force redraw to ensure proper rendering
        document.body.style.display = 'none';
        // Force reflow
        void document.body.offsetHeight;
        document.body.style.display = '';
        
        // Create a simpler alternative panel control for iOS 9
        fixPanelForIOS9();
    }
    
    /**
     * Fix panel behavior for iOS 9
     */
    function fixPanelForIOS9() {
        var settingsPanel = document.getElementById('settings-panel');
        var settingsBtn = document.getElementById('settings-btn');
        var closeSettingsBtn = document.getElementById('close-settings');
        
        if (!settingsPanel || !settingsBtn || !closeSettingsBtn) return;
        
        // Create a backdrop for the settings panel
        var backdrop = document.createElement('div');
        backdrop.className = 'ios9-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100%';
        backdrop.style.height = '100%';
        backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
        backdrop.style.zIndex = '999';
        backdrop.style.display = 'none';
        document.body.appendChild(backdrop);
        
        // Original toggle function may not work well in iOS 9
        settingsBtn.removeEventListener('click', window.Reader.toggleSettings);
        closeSettingsBtn.removeEventListener('click', window.Reader.toggleSettings);
        
        // Use a simpler approach
        settingsBtn.addEventListener('click', function() {
            settingsPanel.style.display = 'block';
            backdrop.style.display = 'block';
        });
        
        closeSettingsBtn.addEventListener('click', function() {
            settingsPanel.style.display = 'none';
            backdrop.style.display = 'none';
        });
        
        backdrop.addEventListener('click', function() {
            settingsPanel.style.display = 'none';
            backdrop.style.display = 'none';
        });
    }
    
    /**
     * Show error message to the user
     */
    function showErrorMessage(message) {
        var errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '20%';
        errorDiv.style.left = '10%';
        errorDiv.style.right = '10%';
        errorDiv.style.padding = '20px';
        errorDiv.style.backgroundColor = '#f8d7da';
        errorDiv.style.color = '#721c24';
        errorDiv.style.borderRadius = '5px';
        errorDiv.style.textAlign = 'center';
        errorDiv.style.zIndex = '10000';
        errorDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        
        errorDiv.innerHTML = message + '<div style="margin-top:15px"><button id="error-reload" style="padding:8px 15px;background:#721c24;color:white;border:none;border-radius:3px;">Reload App</button></div>';
        
        document.body.appendChild(errorDiv);
        
        document.getElementById('error-reload').addEventListener('click', function() {
            window.location.reload();
        });
    }
    
    /**
     * Show a loading spinner
     */
    function showLoadingSpinner(duration) {
        var spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.innerHTML = 'Loading RustyPages...';
        spinner.style.position = 'fixed';
        spinner.style.top = '0';
        spinner.style.left = '0';
        spinner.style.width = '100%';
        spinner.style.height = '100%';
        spinner.style.backgroundColor = '#f8f8f8';
        spinner.style.color = '#333';
        spinner.style.display = 'flex';
        spinner.style.alignItems = 'center';
        spinner.style.justifyContent = 'center';
        spinner.style.fontSize = '20px';
        spinner.style.zIndex = '9999';
        
        document.body.appendChild(spinner);
        
        setTimeout(function() {
            if (spinner.parentNode) {
                spinner.parentNode.removeChild(spinner);
            }
        }, duration || 1000);
    }
    
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
        
        // Disable bounce effect - conditionally based on iOS version
        if (iosVersion <= 9) {
            // Older iOS needs a simpler approach
            document.body.addEventListener('touchmove', function(e) {
                e.preventDefault();
            }, false);
        } else {
            // Newer iOS can use more specific prevention
            document.body.addEventListener('touchmove', function(e) {
                if (e.target.tagName !== 'CANVAS' && !e.target.classList.contains('pdf-viewer')) {
                    e.preventDefault();
                }
            }, { passive: false });
        }
        
        // Fix 300ms delay on iOS
        var links = document.querySelectorAll('a, button');
        Array.prototype.forEach.call(links, function(link) {
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
        var app = document.getElementById('app');
        if (app) {
            app.style.height = height + 'px';
        }
        
        // Rebuild display for iOS 9 Safari after orientation change
        if (isIOS9Safari) {
            setTimeout(function() {
                // Force a reflow to update layout
                document.body.style.display = 'none';
                void document.body.offsetHeight;
                document.body.style.display = '';
            }, 300);
        }
    }
    
    /**
     * Register service worker if supported
     */
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            // Skip for iOS 9 since it doesn't support Service Workers
            if (isIOS && iosVersion <= 9) {
                console.log('Service Worker not registered on iOS 9');
                return;
            }
            
            navigator.serviceWorker.register('service-worker.js')
                .then(function(registration) {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch(function(error) {
                    console.log('Service Worker registration failed:', error);
                });
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
            console.warn('LocalStorage is not available:', e);
            // We already have a memory-based fallback in polyfills.js
            return true;
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
})(); 
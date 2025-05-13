/**
 * Main Application Script for RustyPages
 * Initializes the book reader application
 * Compatible with iOS 9 Safari
 */

(function() {
    // Check for application cache events
    if (window.applicationCache) {
        // Handle appcache events for offline support
        applicationCache.addEventListener('updateready', function() {
            if (applicationCache.status === applicationCache.UPDATEREADY) {
                // New version downloaded, reload to apply changes
                if (confirm('A new version of the app is available. Load it now?')) {
                    window.location.reload();
                }
            }
        }, false);
    }
    
    // Initialize application when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log('RustyPages: Initializing...');
        
        // Check browser compatibility
        Compatibility.checkCompatibility();
        
        // Log iOS version if applicable
        var iosVersion = Compatibility.getIOSVersion();
        if (iosVersion !== null) {
            console.log('Running on iOS ' + iosVersion);
            
            // Show a warning for iOS versions below 9
            if (iosVersion < 9) {
                alert('RustyPages is designed for iOS 9 and above. Some features may not work correctly on your device.');
            }
        }
        
        // Initialize the reader module
        Reader.init();
        
        // Check for iOS
        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            document.body.classList.add('ios-device');
        }
        
        // Handle initial network status
        updateNetworkStatus();
        
        // Listen for online/offline events
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        
        console.log('RustyPages: Initialization complete');
    });
    
    /**
     * Update network status indicator
     */
    function updateNetworkStatus() {
        var isOnline = navigator.onLine;
        console.log('Network status:', isOnline ? 'online' : 'offline');
        
        // You could add a network status indicator here if needed
        if (!isOnline) {
            showOfflineMessage();
        }
    }
    
    /**
     * Show an offline message
     */
    function showOfflineMessage() {
        // iOS 9 has issues with notifications, we'll use a simple approach
        var offlineMsg = document.createElement('div');
        offlineMsg.className = 'offline-message';
        offlineMsg.textContent = 'You are currently offline. RustyPages will continue to work.';
        offlineMsg.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ffeb3b;color:#333;text-align:center;padding:5px;z-index:9999;font-size:14px;';
        
        document.body.appendChild(offlineMsg);
        
        // Remove the message after a few seconds
        setTimeout(function() {
            if (offlineMsg.parentNode) {
                offlineMsg.parentNode.removeChild(offlineMsg);
            }
        }, 3000);
    }
})(); 
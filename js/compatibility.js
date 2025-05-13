/**
 * Browser Compatibility Checker for RustyPages
 * Checks if the current browser is compatible with the app
 */

var Compatibility = (function() {
    var warnings = [];
    
    /**
     * Check if the browser is compatible with RustyPages
     */
    function checkCompatibility() {
        warnings = [];
        
        // Check for basic requirements
        checkLocalStorage();
        checkFileAPI();
        checkCanvas();
        checkBlobSupport();
        
        // Display warnings if any
        displayWarnings();
        
        return warnings.length === 0;
    }
    
    /**
     * Check if localStorage is available
     */
    function checkLocalStorage() {
        try {
            var test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
        } catch (e) {
            warnings.push('Local Storage is not available. Book storage may not work properly.');
        }
    }
    
    /**
     * Check if File API is available
     */
    function checkFileAPI() {
        if (typeof FileReader === 'undefined') {
            warnings.push('File API is not supported. You will not be able to upload books.');
        }
    }
    
    /**
     * Check if Canvas is available (needed for PDF rendering)
     */
    function checkCanvas() {
        var canvas = document.createElement('canvas');
        if (!canvas.getContext || !canvas.getContext('2d')) {
            warnings.push('Canvas is not supported. PDF rendering may not work properly.');
        }
    }
    
    /**
     * Check if Blob is supported (needed for book handling)
     */
    function checkBlobSupport() {
        if (typeof Blob === 'undefined') {
            warnings.push('Blob API is not supported. Book handling may be limited.');
        }
    }
    
    /**
     * Display warnings in the app interface
     */
    function displayWarnings() {
        if (warnings.length > 0) {
            // Create warning box
            var warningBox = document.createElement('div');
            warningBox.className = 'compatibility-warning';
            warningBox.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#ffeb3b;color:#333;padding:10px;z-index:9999;font-size:14px;text-align:center;';
            
            var title = document.createElement('h3');
            title.style.margin = '0 0 5px 0';
            title.textContent = 'Browser Compatibility Warnings';
            warningBox.appendChild(title);
            
            var list = document.createElement('ul');
            list.style.listStyle = 'none';
            list.style.padding = '0';
            list.style.margin = '0';
            
            warnings.forEach(function(warning) {
                var item = document.createElement('li');
                item.textContent = warning;
                item.style.margin = '5px 0';
                list.appendChild(item);
            });
            
            warningBox.appendChild(list);
            
            var closeBtn = document.createElement('button');
            closeBtn.textContent = 'Dismiss';
            closeBtn.style.margin = '10px auto 0 auto';
            closeBtn.style.display = 'block';
            closeBtn.addEventListener('click', function() {
                if (warningBox.parentNode) {
                    warningBox.parentNode.removeChild(warningBox);
                }
            });
            
            warningBox.appendChild(closeBtn);
            document.body.appendChild(warningBox);
        }
    }
    
    /**
     * Check if device is iOS
     */
    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }
    
    /**
     * Get iOS version if applicable
     */
    function getIOSVersion() {
        if (!isIOS()) return null;
        
        // iOS 9 and below: Mozilla/5.0 (iPad; CPU OS 9_3_5 like Mac OS X) ...
        var match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
        return match ? parseInt(match[1], 10) : null;
    }
    
    // Public API
    return {
        checkCompatibility: checkCompatibility,
        isIOS: isIOS,
        getIOSVersion: getIOSVersion
    };
})(); 
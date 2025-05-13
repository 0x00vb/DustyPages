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
        
        // Initialize reader functionality
        Reader.init();
        
        // Initialize user authentication
        initUserAuth();
        
        // Initialize network status monitoring
        initNetworkStatus();
        
        // Check for iOS
        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            document.body.classList.add('ios-device');
        }
        
        console.log('RustyPages: Initialization complete');
    });
    
    /**
     * Initialize user authentication UI
     */
    function initUserAuth() {
        // DOM elements
        var loginButton = document.getElementById('login-button');
        var userInfo = document.getElementById('user-info');
        var syncStatus = document.getElementById('sync-status');
        var authView = document.getElementById('auth-view');
        var authTitle = document.getElementById('auth-title');
        var authSubmit = document.getElementById('auth-submit');
        var authToggle = document.getElementById('auth-toggle');
        var closeAuth = document.getElementById('close-auth');
        var usernameInput = document.getElementById('username');
        var passwordInput = document.getElementById('password');
        var authError = document.getElementById('auth-error');
        
        // Auth mode: 'login' or 'register'
        var authMode = 'login';
        
        // Check if already logged in
        if (Users.checkLoggedIn()) {
            updateUserUI();
        }
        
        // Event listeners
        loginButton.addEventListener('click', function() {
            // If logged in, this becomes a logout button
            if (Users.isLoggedIn()) {
                Users.logout(function() {
                    updateUserUI();
                });
            } else {
                showAuthModal('login');
            }
        });
        
        authToggle.addEventListener('click', function() {
            if (authMode === 'login') {
                showAuthModal('register');
            } else {
                showAuthModal('login');
            }
        });
        
        authSubmit.addEventListener('click', function() {
            var username = usernameInput.value.trim();
            var password = passwordInput.value.trim();
            
            if (!username || !password) {
                authError.textContent = 'Username and password are required';
                return;
            }
            
            authError.textContent = '';
            authSubmit.disabled = true;
            authSubmit.textContent = authMode === 'login' ? 'Logging in...' : 'Registering...';
            
            if (authMode === 'login') {
                Users.login(username, password, function(success, error) {
                    authSubmit.disabled = false;
                    authSubmit.textContent = 'Login';
                    
                    if (success) {
                        hideAuthModal();
                        updateUserUI();
                        showMessage('Logged in successfully. Syncing books...');
                        Reader.refreshBookList();
                    } else {
                        authError.textContent = error || 'Login failed';
                    }
                });
            } else {
                Users.register(username, password, function(success, error) {
                    authSubmit.disabled = false;
                    authSubmit.textContent = 'Register';
                    
                    if (success) {
                        hideAuthModal();
                        updateUserUI();
                        showMessage('Account created successfully!');
                        Reader.refreshBookList();
                    } else {
                        authError.textContent = error || 'Registration failed';
                    }
                });
            }
        });
        
        closeAuth.addEventListener('click', hideAuthModal);
    }
    
    /**
     * Show authentication modal
     */
    function showAuthModal(mode) {
        var authView = document.getElementById('auth-view');
        var authTitle = document.getElementById('auth-title');
        var authSubmit = document.getElementById('auth-submit');
        var authToggle = document.getElementById('auth-toggle');
        var usernameInput = document.getElementById('username');
        var passwordInput = document.getElementById('password');
        var authError = document.getElementById('auth-error');
        
        authMode = mode || 'login';
        
        // Clear previous inputs
        usernameInput.value = '';
        passwordInput.value = '';
        authError.textContent = '';
        
        // Update UI based on mode
        if (authMode === 'login') {
            authTitle.textContent = 'Login';
            authSubmit.textContent = 'Login';
            authToggle.textContent = 'Need an account? Register';
        } else {
            authTitle.textContent = 'Register';
            authSubmit.textContent = 'Register';
            authToggle.textContent = 'Already have an account? Login';
        }
        
        authView.classList.remove('hidden');
        
        // Focus on username field
        setTimeout(function() {
            usernameInput.focus();
        }, 100);
    }
    
    /**
     * Hide authentication modal
     */
    function hideAuthModal() {
        var authView = document.getElementById('auth-view');
        authView.classList.add('hidden');
    }
    
    /**
     * Update user interface based on login status
     */
    function updateUserUI() {
        var loginButton = document.getElementById('login-button');
        var userInfo = document.getElementById('user-info');
        var syncStatus = document.getElementById('sync-status');
        
        if (Users.isLoggedIn()) {
            var user = Users.getCurrentUser();
            userInfo.textContent = user.username;
            loginButton.textContent = 'Logout';
            
            // Check for last sync time in localStorage
            var lastSync = localStorage.getItem('RustyPagesLastSync');
            if (lastSync) {
                try {
                    var lastSyncDate = new Date(parseInt(lastSync, 10));
                    syncStatus.textContent = 'Last synced: ' + lastSyncDate.toLocaleTimeString();
                } catch (e) {
                    syncStatus.textContent = 'Last synced: never';
                }
            } else {
                syncStatus.textContent = 'Last synced: never';
            }
        } else {
            userInfo.textContent = '';
            loginButton.textContent = 'Login';
            syncStatus.textContent = '';
        }
    }
    
    /**
     * Handle coming online - try to sync books
     */
    function handleOnlineEvent() {
        updateNetworkStatus();
        
        // If user is logged in, try to sync books
        if (Users.isLoggedIn()) {
            var syncStatus = document.getElementById('sync-status');
            syncStatus.textContent = 'Syncing...';
            
            Users.syncBooks(function(success) {
                if (success) {
                    // Store last sync time
                    localStorage.setItem('RustyPagesLastSync', new Date().getTime().toString());
                    syncStatus.textContent = 'Last synced: ' + new Date().toLocaleTimeString();
                    showMessage('Books synchronized successfully!');
                    // Refresh book list to show any new books
                    Reader.refreshBookList();
                } else {
                    syncStatus.textContent = 'Sync failed';
                    showMessage('Book synchronization failed. Please try again later.', true);
                }
            });
        }
    }
    
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
     * Show a message to the user
     */
    function showMessage(message, isError) {
        var msgClass = isError ? 'error-message' : 'info-message';
        var msgEl = document.createElement('div');
        msgEl.className = msgClass;
        msgEl.textContent = message;
        msgEl.style.cssText = 'position:fixed;top:0;left:0;right:0;background:' + 
                             (isError ? '#f44336' : '#4CAF50') + 
                             ';color:white;text-align:center;padding:10px;z-index:9999;font-size:14px;';
        
        document.body.appendChild(msgEl);
        
        // Remove the message after a few seconds
        setTimeout(function() {
            if (msgEl.parentNode) {
                msgEl.parentNode.removeChild(msgEl);
            }
        }, 3000);
    }
    
    /**
     * Show an offline message
     */
    function showOfflineMessage() {
        // iOS 9 has issues with notifications, we'll use a simple approach
        showMessage('You are currently offline. RustyPages will continue to work.', false);
    }
    
    /**
     * Initialize network status monitoring
     */
    function initNetworkStatus() {
        // Handle initial network status
        updateNetworkStatus();
        
        // Listen for online/offline events
        window.addEventListener('online', handleOnlineEvent);
        window.addEventListener('offline', updateNetworkStatus);
    }
})(); 
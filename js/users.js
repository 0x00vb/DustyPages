/**
 * Users Module for RustyPages
 * Handles user authentication and book synchronization with MongoDB
 * Compatible with iOS 9 Safari
 */

var Users = (function() {
    // MongoDB connection details
    var MONGODB_API_ENDPOINT = "http://localhost:3000/api"; // Using local server for development
    var syncInProgress = false;
    var isLoggedIn = false;
    var currentUser = null;
    
    /**
     * Register a new user
     */
    function register(username, password, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', MONGODB_API_ENDPOINT + '/register', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || xhr.status === 201) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            login(username, password, callback);
                        } else {
                            if (callback) callback(false, response.message || 'Registration failed');
                        }
                    } catch (e) {
                        if (callback) callback(false, 'Error parsing response');
                    }
                } else {
                    if (callback) callback(false, 'Registration failed: ' + xhr.status);
                }
            }
        };
        
        xhr.onerror = function() {
            if (callback) callback(false, 'Network error during registration');
        };
        
        var data = JSON.stringify({
            username: username,
            password: password
        });
        
        xhr.send(data);
    }
    
    /**
     * Login user
     */
    function login(username, password, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', MONGODB_API_ENDPOINT + '/login', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        if (response.success && response.token) {
                            isLoggedIn = true;
                            currentUser = {
                                username: username,
                                userId: response.userId,
                                token: response.token
                            };
                            
                            // Save user info to localStorage
                            saveUserToLocalStorage(currentUser);
                            
                            // Sync books after successful login
                            syncBooks(function(syncSuccess) {
                                if (callback) callback(true, null);
                            });
                        } else {
                            if (callback) callback(false, response.message || 'Login failed');
                        }
                    } catch (e) {
                        if (callback) callback(false, 'Error parsing response');
                    }
                } else {
                    if (callback) callback(false, 'Login failed: ' + xhr.status);
                }
            }
        };
        
        xhr.onerror = function() {
            if (callback) callback(false, 'Network error during login');
        };
        
        var data = JSON.stringify({
            username: username,
            password: password
        });
        
        xhr.send(data);
    }
    
    /**
     * Logout user
     */
    function logout(callback) {
        isLoggedIn = false;
        currentUser = null;
        
        // Remove user info from localStorage
        localStorage.removeItem('RustyPagesUser');
        
        if (callback) callback(true);
    }
    
    /**
     * Check if user is logged in from localStorage
     */
    function checkLoggedIn() {
        if (!isLoggedIn) {
            var savedUser = getUserFromLocalStorage();
            if (savedUser) {
                isLoggedIn = true;
                currentUser = savedUser;
                return true;
            }
        }
        return isLoggedIn;
    }
    
    /**
     * Save user info to localStorage
     */
    function saveUserToLocalStorage(user) {
        try {
            localStorage.setItem('RustyPagesUser', JSON.stringify(user));
        } catch (e) {
            console.log('Error saving user to localStorage', e);
        }
    }
    
    /**
     * Get user info from localStorage
     */
    function getUserFromLocalStorage() {
        try {
            var user = localStorage.getItem('RustyPagesUser');
            return user ? JSON.parse(user) : null;
        } catch (e) {
            console.log('Error getting user from localStorage', e);
            return null;
        }
    }
    
    /**
     * Sync books with server
     */
    function syncBooks(callback) {
        if (!checkLoggedIn() || syncInProgress) {
            if (callback) callback(false);
            return;
        }
        
        syncInProgress = true;
        console.log('Starting book synchronization...');
        
        // First, get all local books
        Storage.getAllBooks(function(localBooks) {
            console.log('Retrieved local books:', localBooks.length);
            
            // Then, get all books from server
            getRemoteBooks(function(success, remoteBooks) {
                if (!success) {
                    console.log('Failed to get remote books');
                    syncInProgress = false;
                    if (callback) callback(false);
                    return;
                }
                
                console.log('Retrieved remote books:', remoteBooks.length);
                
                // Create maps for easier comparison
                var localBooksMap = {};
                var remoteBooksMap = {};
                
                for (var i = 0; i < localBooks.length; i++) {
                    var localBook = localBooks[i];
                    // Create a clean copy without circular references
                    localBooksMap[localBook.id] = {
                        id: localBook.id,
                        title: localBook.title,
                        author: localBook.author || '',
                        format: localBook.format,
                        position: localBook.position || 0,
                        lastRead: localBook.lastRead || 0,
                        added: localBook.added || 0,
                        data: localBook.data
                    };
                }
                
                for (var j = 0; j < remoteBooks.length; j++) {
                    var remoteBook = remoteBooks[j];
                    remoteBooksMap[remoteBook.id] = remoteBook;
                }
                
                var booksToUpload = [];
                var booksToDownload = [];
                var booksToUpdate = [];
                
                // Find books to upload (exist locally but not remotely)
                for (var localId in localBooksMap) {
                    if (!remoteBooksMap[localId]) {
                        console.log('Book to upload:', localBooksMap[localId].title);
                        booksToUpload.push(localBooksMap[localId]);
                    } else {
                        // Book exists in both places, check which is newer
                        var localLastRead = localBooksMap[localId].lastRead || 0;
                        var remoteLastRead = remoteBooksMap[localId].lastRead || 0;
                        
                        if (localLastRead > remoteLastRead) {
                            console.log('Book to update (local newer):', localBooksMap[localId].title);
                            booksToUpdate.push(localBooksMap[localId]);
                        } else if (remoteLastRead > localLastRead) {
                            // We need full book data for download, check if it's in the response
                            if (!remoteBooksMap[localId].data) {
                                // Need to fetch the full book data
                                console.log('Need to fetch full data for:', remoteBooksMap[localId].title);
                                // Will download in a separate step
                            }
                            console.log('Book to download (remote newer):', remoteBooksMap[localId].title);
                            booksToDownload.push(remoteBooksMap[localId]);
                        }
                    }
                }
                
                // Find books to download (exist remotely but not locally)
                for (var remoteId in remoteBooksMap) {
                    if (!localBooksMap[remoteId]) {
                        console.log('Book to download (not local):', remoteBooksMap[remoteId].title);
                        booksToDownload.push(remoteBooksMap[remoteId]);
                    }
                }
                
                // Perform the sync operations
                var uploadCount = 0;
                var downloadCount = 0;
                var updateCount = 0;
                
                function finishSync() {
                    console.log('Sync completed - Uploaded: ' + uploadCount + ', Updated: ' + updateCount + ', Downloaded: ' + downloadCount);
                    syncInProgress = false;
                    if (callback) callback(true);
                }
                
                // If nothing to sync, we're done
                if (booksToUpload.length === 0 && booksToDownload.length === 0 && booksToUpdate.length === 0) {
                    console.log('No books to sync');
                    finishSync();
                    return;
                }
                
                // Upload books
                function processUploads() {
                    if (uploadCount < booksToUpload.length) {
                        var book = booksToUpload[uploadCount];
                        console.log('Uploading book: ' + book.title);
                        
                        uploadBook(book, function(success) {
                            console.log('Upload ' + (success ? 'succeeded' : 'failed') + ' for: ' + book.title);
                            uploadCount++;
                            processUploads();
                        });
                    } else {
                        processUpdates();
                    }
                }
                
                // Update books
                function processUpdates() {
                    if (updateCount < booksToUpdate.length) {
                        var book = booksToUpdate[updateCount];
                        console.log('Updating book: ' + book.title);
                        
                        updateBook(book, function(success) {
                            console.log('Update ' + (success ? 'succeeded' : 'failed') + ' for: ' + book.title);
                            updateCount++;
                            processUpdates();
                        });
                    } else {
                        processDownloads();
                    }
                }
                
                // Download books
                function processDownloads() {
                    if (downloadCount < booksToDownload.length) {
                        var book = booksToDownload[downloadCount];
                        console.log('Downloading book: ' + book.title);
                        
                        // Check if we have the book data 
                        if (!book.data) {
                            // Need to fetch the full book first
                            getRemoteBook(book.id, function(success, fullBook) {
                                if (success && fullBook && fullBook.data) {
                                    console.log('Retrieved full book data for:', fullBook.title);
                                    // Save the full book to local storage
                                    Storage.saveBook(fullBook, function(result) {
                                        console.log('Download ' + (result ? 'succeeded' : 'failed') + ' for: ' + fullBook.title);
                                        downloadCount++;
                                        processDownloads();
                                    });
                                } else {
                                    console.log('Failed to get full book data, skipping:', book.title);
                                    downloadCount++;
                                    processDownloads();
                                }
                            });
                        } else {
                            // We already have the full book data
                            Storage.saveBook(book, function(result) {
                                console.log('Download ' + (result ? 'succeeded' : 'failed') + ' for: ' + book.title);
                                downloadCount++;
                                processDownloads();
                            });
                        }
                    } else {
                        finishSync();
                    }
                }
                
                // Start the sync process
                processUploads();
            });
        });
    }
    
    /**
     * Get books from server
     */
    function getRemoteBooks(callback) {
        if (!checkLoggedIn()) {
            if (callback) callback(false, []);
            return;
        }
        
        console.log('Fetching books from server...');
        var xhr = new XMLHttpRequest();
        xhr.open('GET', MONGODB_API_ENDPOINT + '/books', true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + currentUser.token);
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        console.log('Server response:', response);
                        if (response.success && response.books) {
                            console.log('Successfully retrieved ' + response.books.length + ' books');
                            if (callback) callback(true, response.books);
                        } else {
                            console.log('No books in response or response not successful');
                            if (callback) callback(false, []);
                        }
                    } catch (e) {
                        console.log('Error parsing server response:', e);
                        if (callback) callback(false, []);
                    }
                } else {
                    console.log('Failed to get books from server, status:', xhr.status);
                    if (callback) callback(false, []);
                }
            }
        };
        
        xhr.onerror = function(e) {
            console.log('Network error during book fetch:', e);
            if (callback) callback(false, []);
        };
        
        xhr.send();
    }
    
    /**
     * Upload a book to server
     */
    function uploadBook(book, callback) {
        if (!checkLoggedIn()) {
            if (callback) callback(false);
            return;
        }
        
        console.log('Uploading book to server:', book.title);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', MONGODB_API_ENDPOINT + '/books', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', 'Bearer ' + currentUser.token);
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || xhr.status === 201) {
                    console.log('Book upload successful');
                    if (callback) callback(true);
                } else {
                    console.log('Book upload failed, status:', xhr.status);
                    if (xhr.responseText) {
                        try {
                            var response = JSON.parse(xhr.responseText);
                            console.log('Server error:', response.message);
                        } catch (e) {
                            console.log('Could not parse server response');
                        }
                    }
                    if (callback) callback(false);
                }
            }
        };
        
        xhr.onerror = function(e) {
            console.log('Network error during book upload:', e);
            if (callback) callback(false);
        };
        
        try {
            // Create a deep copy with essential properties
            var cleanBook = {
                id: book.id,
                title: book.title,
                author: book.author || '',
                format: book.format,
                position: book.position || 0,
                lastRead: book.lastRead || 0,
                added: book.added || 0
            };
            
            // Properly handle book data for different formats
            if (book.data) {
                // For EPUB/PDF files, we need to convert ArrayBuffer to Base64 if it's not already a string
                if (book.data instanceof ArrayBuffer) {
                    // Convert ArrayBuffer to Base64
                    var binary = '';
                    var bytes = new Uint8Array(book.data);
                    var len = bytes.byteLength;
                    for (var i = 0; i < len; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    cleanBook.data = btoa(binary);
                    console.log('Converted ArrayBuffer to Base64 for upload, length:', cleanBook.data.length);
                } else if (typeof book.data === 'string') {
                    // Already a string (possibly Base64), use as is
                    cleanBook.data = book.data;
                    console.log('Using string data for upload, length:', cleanBook.data.length);
                } else if (typeof book.data === 'object') {
                    try {
                        // For other objects, try to stringify them
                        cleanBook.data = JSON.stringify(book.data);
                        console.log('Stringified object data for upload');
                    } catch (e) {
                        console.error('Error stringifying book data:', e);
                        cleanBook.data = '{}'; // Set a default to prevent errors
                    }
                } else {
                    console.warn('Unknown book data type:', typeof book.data);
                    cleanBook.data = String(book.data);
                }
            } else {
                console.warn('No book data present for upload');
                cleanBook.data = '{}'; // Set a default to prevent errors
            }
            
            var dataString = JSON.stringify(cleanBook);
            console.log('Sending book data, size:', dataString.length);
            
            xhr.send(dataString);
        } catch (e) {
            console.error('Error preparing book data for upload:', e);
            if (callback) callback(false);
        }
    }
    
    /**
     * Update a book on server
     */
    function updateBook(book, callback) {
        if (!checkLoggedIn()) {
            if (callback) callback(false);
            return;
        }
        
        console.log('Updating book on server:', book.title);
        var xhr = new XMLHttpRequest();
        xhr.open('PUT', MONGODB_API_ENDPOINT + '/books/' + book.id, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', 'Bearer ' + currentUser.token);
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    console.log('Book update successful');
                    if (callback) callback(true);
                } else {
                    console.log('Book update failed, status:', xhr.status);
                    if (xhr.responseText) {
                        try {
                            var response = JSON.parse(xhr.responseText);
                            console.log('Server error:', response.message);
                        } catch (e) {
                            console.log('Could not parse server response');
                        }
                    }
                    if (callback) callback(false);
                }
            }
        };
        
        xhr.onerror = function(e) {
            console.log('Network error during book update:', e);
            if (callback) callback(false);
        };
        
        try {
            // Create a deep copy with essential properties
            var cleanBook = {
                id: book.id,
                title: book.title,
                author: book.author || '',
                format: book.format,
                position: book.position || 0,
                lastRead: book.lastRead || 0,
                added: book.added || 0
            };
            
            // Important: Make sure book data is included and properly formatted
            if (book.data !== undefined) {
                // Handle data conversion similar to upload
                if (book.data instanceof ArrayBuffer) {
                    var binary = '';
                    var bytes = new Uint8Array(book.data);
                    var len = bytes.byteLength;
                    for (var i = 0; i < len; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    cleanBook.data = btoa(binary);
                } else if (typeof book.data === 'string') {
                    cleanBook.data = book.data;
                } else if (typeof book.data === 'object') {
                    try {
                        cleanBook.data = JSON.stringify(book.data);
                    } catch (e) {
                        console.error('Error stringifying book data for update:', e);
                        cleanBook.data = '{}';
                    }
                } else {
                    cleanBook.data = String(book.data);
                }
            }
            
            var dataString = JSON.stringify(cleanBook);
            console.log('Sending book update data, size:', dataString.length);
            
            xhr.send(dataString);
        } catch (e) {
            console.error('Error preparing book data for update:', e);
            if (callback) callback(false);
        }
    }
    
    /**
     * Get a single book with full data from server
     */
    function getRemoteBook(bookId, callback) {
        if (!checkLoggedIn()) {
            if (callback) callback(false, null);
            return;
        }
        
        console.log('Fetching full book data for:', bookId);
        var xhr = new XMLHttpRequest();
        xhr.open('GET', MONGODB_API_ENDPOINT + '/books/' + bookId, true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + currentUser.token);
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        if (response.success && response.book) {
                            console.log('Successfully retrieved full book data');
                            if (callback) callback(true, response.book);
                        } else {
                            console.log('No book data in response or response not successful');
                            if (callback) callback(false, null);
                        }
                    } catch (e) {
                        console.log('Error parsing server response:', e);
                        if (callback) callback(false, null);
                    }
                } else {
                    console.log('Failed to get book from server, status:', xhr.status);
                    if (callback) callback(false, null);
                }
            }
        };
        
        xhr.onerror = function(e) {
            console.log('Network error during book fetch:', e);
            if (callback) callback(false, null);
        };
        
        xhr.send();
    }
    
    /**
     * Delete a book from server
     */
    function deleteBookFromServer(bookId, callback) {
        if (!checkLoggedIn()) {
            if (callback) callback(false);
            return;
        }
        
        console.log('Deleting book from server:', bookId);
        var xhr = new XMLHttpRequest();
        xhr.open('DELETE', MONGODB_API_ENDPOINT + '/books/' + bookId, true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + currentUser.token);
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    console.log('Book deleted successfully from server');
                    if (callback) callback(true);
                } else {
                    console.log('Book deletion failed, status:', xhr.status);
                    if (xhr.responseText) {
                        try {
                            var response = JSON.parse(xhr.responseText);
                            console.log('Server error:', response.message);
                        } catch (e) {
                            console.log('Could not parse server response');
                        }
                    }
                    if (callback) callback(false);
                }
            }
        };
        
        xhr.onerror = function(e) {
            console.log('Network error during book deletion:', e);
            if (callback) callback(false);
        };
        
        xhr.send();
    }
    
    // Public API
    return {
        register: register,
        login: login,
        logout: logout,
        checkLoggedIn: checkLoggedIn,
        syncBooks: syncBooks,
        uploadBook: uploadBook,
        updateBook: updateBook,
        deleteBookFromServer: deleteBookFromServer,
        isLoggedIn: function() { return isLoggedIn; },
        getCurrentUser: function() { return currentUser; }
    };
})(); 
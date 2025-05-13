/**
 * Storage Module for RustyPages
 * Handles book storage and user settings using IndexedDB and localStorage
 * Compatible with iOS 9 Safari
 */

var Storage = (function() {
    var db = null;
    var DB_NAME = 'RustyPagesDB';
    var DB_VERSION = 1;
    var BOOKS_STORE = 'books';
    
    // Check if IndexedDB is available
    var indexedDBSupported = window.indexedDB !== undefined;
    
    /**
     * Initialize the database
     */
    function init(callback) {
        if (!indexedDBSupported) {
            console.log('IndexedDB not supported, falling back to localStorage');
            if (callback) callback(false);
            return;
        }
        
        var request = window.indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = function(event) {
            console.log('Error opening database', event);
            if (callback) callback(false);
        };
        
        request.onsuccess = function(event) {
            db = event.target.result;
            console.log('Database opened successfully');
            if (callback) callback(true);
        };
        
        request.onupgradeneeded = function(event) {
            var db = event.target.result;
            
            // Create object store for books
            if (!db.objectStoreNames.contains(BOOKS_STORE)) {
                var store = db.createObjectStore(BOOKS_STORE, {keyPath: 'id'});
                store.createIndex('title', 'title', {unique: false});
                store.createIndex('added', 'added', {unique: false});
                console.log('Book store created');
            }
        };
    }
    
    /**
     * Save a book to the database
     */
    function saveBook(book, callback) {
        // Validate book data
        if (!book || !book.id || !book.title) {
            console.error('Invalid book data provided to saveBook');
            if (callback) callback(null);
            return;
        }
        
        // Log book size info for debugging
        var dataSize = 'unknown';
        if (book.data) {
            if (typeof book.data === 'string') {
                dataSize = book.data.length + ' chars';
            } else if (book.data instanceof ArrayBuffer) {
                dataSize = book.data.byteLength + ' bytes';
            }
        }
        console.log('Saving book:', book.title, '- data size:', dataSize);
        
        if (!indexedDBSupported) {
            saveBookToLocalStorage(book);
            
            // Sync with server if logged in
            if (typeof Users !== 'undefined' && Users.isLoggedIn()) {
                Users.uploadBook(book, function(success) {
                    console.log('Book upload ' + (success ? 'succeeded' : 'failed') + ' for: ' + book.title);
                });
            }
            
            if (callback) callback(book);
            return;
        }
        
        if (!db) {
            init(function() {
                saveBook(book, callback);
            });
            return;
        }
        
        try {
            var transaction = db.transaction([BOOKS_STORE], 'readwrite');
            var store = transaction.objectStore(BOOKS_STORE);
            var request = store.put(book);
            
            request.onsuccess = function() {
                console.log('Book saved successfully');
                
                // Sync with server if logged in
                if (typeof Users !== 'undefined' && Users.isLoggedIn()) {
                    Users.uploadBook(book, function(success) {
                        console.log('Book upload ' + (success ? 'succeeded' : 'failed') + ' for: ' + book.title);
                    });
                }
                
                if (callback) callback(book);
            };
            
            request.onerror = function(event) {
                console.log('Error saving book:', event);
                if (callback) callback(null);
            };
        } catch (e) {
            console.error('Exception while saving book:', e);
            if (callback) callback(null);
        }
    }
    
    /**
     * Get all books from the database
     */
    function getAllBooks(callback) {
        if (!indexedDBSupported) {
            var books = getBooksFromLocalStorage();
            if (callback) callback(books);
            return;
        }
        
        if (!db) {
            init(function() {
                getAllBooks(callback);
            });
            return;
        }
        
        var transaction = db.transaction([BOOKS_STORE], 'readonly');
        var store = transaction.objectStore(BOOKS_STORE);
        var request = store.index('added').openCursor(null, 'prev');
        var books = [];
        
        request.onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                try {
                    books.push(cursor.value);
                } catch (e) {
                    console.error('Error processing book in cursor:', e);
                    // Skip this book but continue processing others
                }
                cursor.continue();
            } else {
                if (callback) callback(books);
            }
        };
        
        request.onerror = function(event) {
            console.log('Error getting books', event);
            if (callback) callback([]);
        };
    }
    
    /**
     * Get a book by ID
     */
    function getBook(id, callback) {
        if (!indexedDBSupported) {
            var book = getBookFromLocalStorage(id);
            if (callback) callback(book);
            return;
        }
        
        if (!db) {
            init(function() {
                getBook(id, callback);
            });
            return;
        }
        
        var transaction = db.transaction([BOOKS_STORE], 'readonly');
        var store = transaction.objectStore(BOOKS_STORE);
        var request = store.get(id);
        
        request.onsuccess = function() {
            var book = request.result;
            
            // Process book data if needed
            if (book && book.data) {
                console.log('Retrieved book:', book.title);
                console.log('Book data type:', typeof book.data);
                
                // Handle string data that should be binary
                if (typeof book.data === 'string' && (book.data.indexOf('UEsDB') === 0)) {
                    console.log('Book data appears to be Base64 encoded binary data');
                    try {
                        // Try to convert from Base64 to ArrayBuffer
                        try {
                            console.log('Attempting to convert Base64 to ArrayBuffer');
                            var binaryString = atob(book.data);
                            var bytes = new Uint8Array(binaryString.length);
                            for (var i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            book.data = bytes.buffer;
                            console.log('Successfully converted Base64 to ArrayBuffer');
                        } catch (decodeError) {
                            console.error('Base64 decode failed:', decodeError);
                            // Keep original data if conversion fails
                            console.log('Keeping original string data');
                        }
                    } catch (e) {
                        console.error('Error processing book data:', e);
                    }
                }
            }
            
            if (callback) callback(book);
        };
        
        request.onerror = function(event) {
            console.log('Error getting book', event);
            if (callback) callback(null);
        };
    }
    
    /**
     * Delete a book by ID
     */
    function deleteBook(id, callback) {
        if (!indexedDBSupported) {
            var deleted = deleteBookFromLocalStorage(id);
            
            // Sync with server if logged in
            if (deleted && typeof Users !== 'undefined' && Users.isLoggedIn()) {
                Users.deleteBookFromServer(id, function(success) {
                    console.log('Book deletion from server ' + (success ? 'succeeded' : 'failed'));
                });
            }
            
            if (callback) callback(deleted);
            return;
        }
        
        if (!db) {
            init(function() {
                deleteBook(id, callback);
            });
            return;
        }
        
        var transaction = db.transaction([BOOKS_STORE], 'readwrite');
        var store = transaction.objectStore(BOOKS_STORE);
        var request = store.delete(id);
        
        request.onsuccess = function() {
            console.log('Book deleted successfully');
            
            // Sync with server if logged in
            if (typeof Users !== 'undefined' && Users.isLoggedIn()) {
                Users.deleteBookFromServer(id, function(success) {
                    console.log('Book deletion from server ' + (success ? 'succeeded' : 'failed'));
                });
            }
            
            if (callback) callback(true);
        };
        
        request.onerror = function(event) {
            console.log('Error deleting book', event);
            if (callback) callback(false);
        };
    }
    
    /**
     * Update book reading progress
     */
    function updateBookProgress(id, position, callback) {
        if (!indexedDBSupported) {
            updateBookProgressInLocalStorage(id, position);
            if (callback) callback(true);
            
            // Sync with server if logged in
            syncBookProgressWithServer(id, position);
            return;
        }
        
        getBook(id, function(book) {
            if (book) {
                book.position = position;
                book.lastRead = new Date().getTime();
                
                saveBook(book, function(result) {
                    if (callback) callback(!!result);
                    
                    // Sync with server if logged in
                    if (result) {
                        syncBookProgressWithServer(id, position, book);
                    }
                });
            } else {
                if (callback) callback(false);
            }
        });
    }
    
    /**
     * Sync book progress with server if user is logged in
     * @private
     */
    function syncBookProgressWithServer(id, position, bookData) {
        // Check if Users module exists and user is logged in
        if (typeof Users !== 'undefined' && Users.isLoggedIn()) {
            if (bookData) {
                // We already have the book data, just update it on the server
                Users.updateBook(bookData, function(success) {
                    console.log('Book progress sync ' + (success ? 'succeeded' : 'failed'));
                });
            } else {
                // We need to get the book data first
                getBook(id, function(book) {
                    if (book) {
                        Users.updateBook(book, function(success) {
                            console.log('Book progress sync ' + (success ? 'succeeded' : 'failed'));
                        });
                    }
                });
            }
        }
    }
    
    /**
     * Save user settings to localStorage
     */
    function saveSettings(settings) {
        try {
            localStorage.setItem('RustyPagesSettings', JSON.stringify(settings));
            return true;
        } catch (e) {
            console.log('Error saving settings', e);
            return false;
        }
    }
    
    /**
     * Get user settings from localStorage
     */
    function getSettings() {
        try {
            var settings = localStorage.getItem('RustyPagesSettings');
            return settings ? JSON.parse(settings) : getDefaultSettings();
        } catch (e) {
            console.log('Error getting settings', e);
            return getDefaultSettings();
        }
    }
    
    /**
     * Get default settings
     */
    function getDefaultSettings() {
        return {
            theme: 'light',
            font: 'serif',
            fontSize: 'medium',
            margin: 'medium'
        };
    }
    
    /**
     * localStorage fallback for books when IndexedDB is not available
     */
    function saveBookToLocalStorage(book) {
        try {
            var books = getBooksFromLocalStorage();
            
            // Find and remove the book if it already exists
            for (var i = 0; i < books.length; i++) {
                if (books[i].id === book.id) {
                    books.splice(i, 1);
                    break;
                }
            }
            
            // Add the book
            books.push(book);
            
            // Save books
            localStorage.setItem('RustyPagesBooks', JSON.stringify(books));
        } catch (e) {
            console.log('Error saving book to localStorage', e);
        }
    }
    
    function getBooksFromLocalStorage() {
        try {
            var books = localStorage.getItem('RustyPagesBooks');
            return books ? JSON.parse(books) : [];
        } catch (e) {
            console.log('Error getting books from localStorage', e);
            return [];
        }
    }
    
    function getBookFromLocalStorage(id) {
        var books = getBooksFromLocalStorage();
        for (var i = 0; i < books.length; i++) {
            if (books[i].id === id) {
                return books[i];
            }
        }
        return null;
    }
    
    function deleteBookFromLocalStorage(id) {
        try {
            var books = getBooksFromLocalStorage();
            
            for (var i = 0; i < books.length; i++) {
                if (books[i].id === id) {
                    books.splice(i, 1);
                    localStorage.setItem('RustyPagesBooks', JSON.stringify(books));
                    return true;
                }
            }
            
            return false;
        } catch (e) {
            console.log('Error deleting book from localStorage', e);
            return false;
        }
    }
    
    function updateBookProgressInLocalStorage(id, position) {
        try {
            var books = getBooksFromLocalStorage();
            
            for (var i = 0; i < books.length; i++) {
                if (books[i].id === id) {
                    books[i].position = position;
                    books[i].lastRead = new Date().getTime();
                    localStorage.setItem('RustyPagesBooks', JSON.stringify(books));
                    return true;
                }
            }
            
            return false;
        } catch (e) {
            console.log('Error updating book progress in localStorage', e);
            return false;
        }
    }
    
    // Public API
    return {
        init: init,
        saveBook: saveBook,
        getAllBooks: getAllBooks,
        getBook: getBook,
        deleteBook: deleteBook,
        updateBookProgress: updateBookProgress,
        saveSettings: saveSettings,
        getSettings: getSettings
    };
})(); 
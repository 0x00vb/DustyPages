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
        if (!indexedDBSupported) {
            saveBookToLocalStorage(book);
            if (callback) callback(book);
            return;
        }
        
        if (!db) {
            init(function() {
                saveBook(book, callback);
            });
            return;
        }
        
        var transaction = db.transaction([BOOKS_STORE], 'readwrite');
        var store = transaction.objectStore(BOOKS_STORE);
        var request = store.put(book);
        
        request.onsuccess = function() {
            console.log('Book saved successfully');
            if (callback) callback(book);
        };
        
        request.onerror = function(event) {
            console.log('Error saving book', event);
            if (callback) callback(null);
        };
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
                books.push(cursor.value);
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
            if (callback) callback(request.result);
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
            deleteBookFromLocalStorage(id);
            if (callback) callback(true);
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
            return;
        }
        
        getBook(id, function(book) {
            if (book) {
                book.position = position;
                book.lastRead = new Date().getTime();
                
                saveBook(book, function(result) {
                    if (callback) callback(!!result);
                });
            } else {
                if (callback) callback(false);
            }
        });
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
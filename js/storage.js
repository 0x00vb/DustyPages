/**
 * Storage module for RustyPages
 * Handles book storage using localStorage with binary chunking
 */

var Storage = (function() {
    // Maximum size for chunks in localStorage (to avoid size limits)
    var CHUNK_SIZE = 512 * 1024; // 512KB chunks
    
    // Key prefixes
    var BOOK_INFO_PREFIX = 'rustyPages_book_';
    var BOOK_DATA_PREFIX = 'rustyPages_data_';
    var BOOK_LIST_KEY = 'rustyPages_bookList';
    var SETTINGS_KEY = 'rustyPages_settings';
    
    /**
     * Convert ArrayBuffer to Base64 string
     */
    function arrayBufferToBase64(buffer) {
        var binary = '';
        var bytes = new Uint8Array(buffer);
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
    
    /**
     * Convert Base64 string to ArrayBuffer
     */
    function base64ToArrayBuffer(base64) {
        var binary_string = window.atob(base64);
        var len = binary_string.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    /**
     * Save book data in chunks to localStorage
     */
    function saveBookData(id, arrayBuffer) {
        return new Promise(function(resolve, reject) {
            try {
                var base64Data = arrayBufferToBase64(arrayBuffer);
                var chunks = Math.ceil(base64Data.length / CHUNK_SIZE);
                
                // Store how many chunks we have
                localStorage.setItem(BOOK_DATA_PREFIX + id + '_chunks', chunks);
                
                // Store each chunk
                for (var i = 0; i < chunks; i++) {
                    var chunk = base64Data.substr(i * CHUNK_SIZE, CHUNK_SIZE);
                    localStorage.setItem(BOOK_DATA_PREFIX + id + '_' + i, chunk);
                }
                
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }
    
    /**
     * Load book data from localStorage chunks
     */
    function loadBookData(id) {
        return new Promise(function(resolve, reject) {
            try {
                var chunks = parseInt(localStorage.getItem(BOOK_DATA_PREFIX + id + '_chunks'), 10);
                
                if (isNaN(chunks) || chunks <= 0) {
                    return reject(new Error('Book data not found'));
                }
                
                var base64Data = '';
                
                // Combine all chunks
                for (var i = 0; i < chunks; i++) {
                    var chunk = localStorage.getItem(BOOK_DATA_PREFIX + id + '_' + i);
                    if (!chunk) {
                        return reject(new Error('Book data corrupted'));
                    }
                    base64Data += chunk;
                }
                
                var arrayBuffer = base64ToArrayBuffer(base64Data);
                resolve(arrayBuffer);
            } catch (e) {
                reject(e);
            }
        });
    }
    
    /**
     * Delete book data and its chunks
     */
    function deleteBookData(id) {
        return new Promise(function(resolve, reject) {
            try {
                var chunks = parseInt(localStorage.getItem(BOOK_DATA_PREFIX + id + '_chunks'), 10);
                
                if (!isNaN(chunks) && chunks > 0) {
                    // Delete all chunks
                    for (var i = 0; i < chunks; i++) {
                        localStorage.removeItem(BOOK_DATA_PREFIX + id + '_' + i);
                    }
                }
                
                // Delete chunk count
                localStorage.removeItem(BOOK_DATA_PREFIX + id + '_chunks');
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }
    
    return {
        /**
         * Save a book to storage
         */
        saveBook: function(book) {
            return new Promise(function(resolve, reject) {
                try {
                    // Get current book list
                    var bookList = JSON.parse(localStorage.getItem(BOOK_LIST_KEY) || '[]');
                    
                    // Check if book already exists
                    var existingIndex = -1;
                    for (var i = 0; i < bookList.length; i++) {
                        if (bookList[i].id === book.id) {
                            existingIndex = i;
                            break;
                        }
                    }
                    
                    // Create a book info object without the raw data
                    var bookInfo = {
                        id: book.id,
                        title: book.title || 'Unknown Title',
                        author: book.author || 'Unknown Author',
                        format: book.format,
                        addedAt: book.addedAt || new Date().toISOString(),
                        lastRead: book.lastRead || null,
                        progress: book.progress || 0,
                        currentLocation: book.currentLocation || null
                    };
                    
                    // Update or add to list
                    if (existingIndex !== -1) {
                        bookList[existingIndex] = bookInfo;
                    } else {
                        bookList.push(bookInfo);
                    }
                    
                    // Save book list
                    localStorage.setItem(BOOK_LIST_KEY, JSON.stringify(bookList));
                    
                    // Save book info
                    localStorage.setItem(BOOK_INFO_PREFIX + book.id, JSON.stringify(bookInfo));
                    
                    // Save book data if provided
                    if (book.data) {
                        saveBookData(book.id, book.data)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        resolve();
                    }
                } catch (e) {
                    reject(e);
                }
            });
        },
        
        /**
         * Get all books in the library
         */
        getBooks: function() {
            return new Promise(function(resolve, reject) {
                try {
                    var bookList = JSON.parse(localStorage.getItem(BOOK_LIST_KEY) || '[]');
                    resolve(bookList);
                } catch (e) {
                    reject(e);
                }
            });
        },
        
        /**
         * Get a specific book by ID, with or without its data
         */
        getBook: function(id, includeData) {
            return new Promise(function(resolve, reject) {
                try {
                    var bookInfoJson = localStorage.getItem(BOOK_INFO_PREFIX + id);
                    
                    if (!bookInfoJson) {
                        return reject(new Error('Book not found'));
                    }
                    
                    var bookInfo = JSON.parse(bookInfoJson);
                    
                    if (includeData) {
                        loadBookData(id)
                            .then(function(data) {
                                bookInfo.data = data;
                                resolve(bookInfo);
                            })
                            .catch(reject);
                    } else {
                        resolve(bookInfo);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        },
        
        /**
         * Delete a book from storage
         */
        deleteBook: function(id) {
            return new Promise(function(resolve, reject) {
                try {
                    // Get current book list
                    var bookList = JSON.parse(localStorage.getItem(BOOK_LIST_KEY) || '[]');
                    
                    // Remove from list
                    bookList = bookList.filter(function(book) {
                        return book.id !== id;
                    });
                    
                    // Save updated list
                    localStorage.setItem(BOOK_LIST_KEY, JSON.stringify(bookList));
                    
                    // Remove book info
                    localStorage.removeItem(BOOK_INFO_PREFIX + id);
                    
                    // Remove book data
                    deleteBookData(id)
                        .then(resolve)
                        .catch(reject);
                } catch (e) {
                    reject(e);
                }
            });
        },
        
        /**
         * Update book reading progress
         */
        updateProgress: function(id, progress, currentLocation) {
            return new Promise(function(resolve, reject) {
                try {
                    var bookInfoJson = localStorage.getItem(BOOK_INFO_PREFIX + id);
                    
                    if (!bookInfoJson) {
                        return reject(new Error('Book not found'));
                    }
                    
                    var bookInfo = JSON.parse(bookInfoJson);
                    bookInfo.progress = progress;
                    bookInfo.currentLocation = currentLocation;
                    bookInfo.lastRead = new Date().toISOString();
                    
                    // Save updated book info
                    localStorage.setItem(BOOK_INFO_PREFIX + id, JSON.stringify(bookInfo));
                    
                    // Also update in book list
                    var bookList = JSON.parse(localStorage.getItem(BOOK_LIST_KEY) || '[]');
                    
                    for (var i = 0; i < bookList.length; i++) {
                        if (bookList[i].id === id) {
                            bookList[i].progress = progress;
                            bookList[i].lastRead = bookInfo.lastRead;
                            break;
                        }
                    }
                    
                    localStorage.setItem(BOOK_LIST_KEY, JSON.stringify(bookList));
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        },
        
        /**
         * Save app settings
         */
        saveSettings: function(settings) {
            return new Promise(function(resolve, reject) {
                try {
                    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        },
        
        /**
         * Get app settings
         */
        getSettings: function() {
            return new Promise(function(resolve, reject) {
                try {
                    var settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
                    
                    // Apply defaults if settings don't exist
                    var defaultSettings = {
                        theme: 'light',
                        fontSize: 100,
                        fontFamily: 'serif'
                    };
                    
                    resolve(Object.assign({}, defaultSettings, settings));
                } catch (e) {
                    reject(e);
                }
            });
        },
        
        /**
         * Estimate storage usage
         */
        getStorageUsage: function() {
            return new Promise(function(resolve, reject) {
                try {
                    var total = 0;
                    for (var i = 0; i < localStorage.length; i++) {
                        var key = localStorage.key(i);
                        if (key.indexOf('rustyPages_') === 0) {
                            total += localStorage.getItem(key).length;
                        }
                    }
                    
                    // Convert to MB
                    var usageMB = (total * 2) / (1024 * 1024);
                    resolve(usageMB.toFixed(2));
                } catch (e) {
                    reject(e);
                }
            });
        }
    };
})(); 
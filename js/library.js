/**
 * Library module for RustyPages
 * Handles book list, import, and management
 */

var Library = (function() {
    // DOM elements
    var bookListElement;
    var emptyLibraryElement;
    var fileInputElement;
    
    // Initialize module
    function init() {
        // Get DOM elements
        bookListElement = document.getElementById('book-list');
        emptyLibraryElement = document.getElementById('empty-library');
        fileInputElement = document.getElementById('file-input');
        
        // Set up import button
        var importBtn = document.getElementById('import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', function() {
                fileInputElement.click();
            });
        }
        
        // Set up file input change event
        if (fileInputElement) {
            fileInputElement.addEventListener('change', handleFileSelect);
        }
        
        // Load books initially
        loadBooks();
    }
    
    /**
     * Generate a unique ID for books
     */
    function generateId() {
        return 'book_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Format date for display
     */
    function formatDate(dateString) {
        var date = new Date(dateString);
        var now = new Date();
        var yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // If today
        if (date.toDateString() === now.toDateString()) {
            return 'Today, ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        // If yesterday
        else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday, ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        // Otherwise show date
        else {
            var options = { month: 'short', day: 'numeric' };
            if (date.getFullYear() !== now.getFullYear()) {
                options.year = 'numeric';
            }
            return date.toLocaleDateString(undefined, options);
        }
    }
    
    /**
     * Handle file selection for import
     */
    function handleFileSelect(e) {
        var files = e.target.files;
        
        if (!files || files.length === 0) {
            return;
        }
        
        // Show loading indicator
        showLoadingIndicator();
        
        // Process each file
        var filePromises = Array.from(files).map(function(file) {
            return importBook(file);
        });
        
        // When all files are processed
        Promise.all(filePromises)
            .then(function() {
                hideLoadingIndicator();
            })
            .catch(function(error) {
                console.error('Error importing files:', error);
                hideLoadingIndicator();
            });
        
        // Reset file input
        fileInputElement.value = '';
    }
    
    /**
     * Show loading indicator
     */
    function showLoadingIndicator() {
        var existingIndicator = document.getElementById('loading-indicator');
        if (existingIndicator) return;
        
        var loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading-indicator';
        loadingIndicator.textContent = 'Importing books...';
        loadingIndicator.style.position = 'fixed';
        loadingIndicator.style.top = '50%';
        loadingIndicator.style.left = '50%';
        loadingIndicator.style.transform = 'translate(-50%, -50%)';
        loadingIndicator.style.padding = '15px 20px';
        loadingIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        loadingIndicator.style.color = 'white';
        loadingIndicator.style.borderRadius = '8px';
        loadingIndicator.style.zIndex = '1000';
        
        document.body.appendChild(loadingIndicator);
    }
    
    /**
     * Hide loading indicator
     */
    function hideLoadingIndicator() {
        var loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            document.body.removeChild(loadingIndicator);
        }
    }
    
    /**
     * Import a book file
     */
    function importBook(file) {
        return new Promise(function(resolve, reject) {
            // Check file type
            var format;
            if (file.name.toLowerCase().endsWith('.epub')) {
                format = 'epub';
            } else if (file.name.toLowerCase().endsWith('.pdf')) {
                format = 'pdf';
            } else {
                alert('Unsupported file format. Please use EPUB or PDF files.');
                reject(new Error('Unsupported format'));
                return;
            }
            
            // Read file as ArrayBuffer
            var reader = new FileReader();
            
            reader.onload = function(e) {
                var data = e.target.result;
                
                // Extract metadata based on format
                extractMetadata(data, format)
                    .then(function(metadata) {
                        // Create book object
                        var book = {
                            id: generateId(),
                            title: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
                            author: metadata.author || 'Unknown',
                            format: format,
                            data: data,
                            addedAt: new Date().toISOString(),
                            progress: 0
                        };
                        
                        // Save to storage
                        Storage.saveBook(book)
                            .then(function() {
                                // Update UI
                                addBookToUI(book);
                                updateLibraryVisibility();
                                resolve();
                            })
                            .catch(function(error) {
                                console.error('Failed to save book:', error);
                                alert('Failed to import book: ' + error.message);
                                reject(error);
                            });
                    })
                    .catch(function(error) {
                        console.error('Failed to extract metadata:', error);
                        
                        // Still save the book, but with minimal info
                        var book = {
                            id: generateId(),
                            title: file.name.replace(/\.[^/.]+$/, ''),
                            author: 'Unknown',
                            format: format,
                            data: data,
                            addedAt: new Date().toISOString(),
                            progress: 0
                        };
                        
                        Storage.saveBook(book)
                            .then(function() {
                                addBookToUI(book);
                                updateLibraryVisibility();
                                resolve();
                            })
                            .catch(function(error) {
                                console.error('Failed to save book:', error);
                                alert('Failed to import book: ' + error.message);
                                reject(error);
                            });
                    });
            };
            
            reader.onerror = function() {
                alert('Failed to read file. Please try again.');
                reject(new Error('File read error'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * Extract metadata from book file
     */
    function extractMetadata(data, format) {
        return new Promise(function(resolve, reject) {
            if (format === 'epub') {
                // Use epub.js to extract metadata
                var book = ePub();
                book.open(data)
                    .then(function() {
                        book.loaded.metadata.then(function(metadata) {
                            resolve({
                                title: metadata.title,
                                author: metadata.creator
                            });
                        });
                    })
                    .catch(reject);
            } else if (format === 'pdf') {
                // Check if PDF.js is available
                if (typeof pdfjsLib === 'undefined') {
                    console.warn('PDF.js library not found. Cannot extract metadata.');
                    resolve({}); // Proceed with import, but without metadata
                    return;
                }
                
                try {
                    // Make sure worker is configured
                    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                        pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/lib/pdf.worker.min.js';
                    }
                    
                    // Use pdf.js to extract metadata
                    pdfjsLib.getDocument({ data: data }).promise
                        .then(function(pdf) {
                            pdf.getMetadata().then(function(metadata) {
                                if (metadata && metadata.info) {
                                    resolve({
                                        title: metadata.info.Title,
                                        author: metadata.info.Author
                                    });
                                } else {
                                    resolve({});
                                }
                            }).catch(function() {
                                resolve({});
                            });
                        })
                        .catch(function(error) {
                            console.warn('Could not extract PDF metadata:', error);
                            resolve({}); // Proceed with import, but without metadata
                        });
                } catch (error) {
                    console.warn('Error initializing PDF.js:', error);
                    resolve({}); // Proceed with import, but without metadata
                }
            } else {
                reject(new Error('Unsupported format'));
            }
        });
    }
    
    /**
     * Load books from storage
     */
    function loadBooks() {
        Storage.getBooks()
            .then(function(books) {
                // Clear current list
                bookListElement.innerHTML = '';
                
                // Sort books by most recently read then by added date
                books.sort(function(a, b) {
                    // If both have lastRead, compare those
                    if (a.lastRead && b.lastRead) {
                        return new Date(b.lastRead) - new Date(a.lastRead);
                    }
                    // If only one has lastRead, that one goes first
                    else if (a.lastRead) {
                        return -1;
                    }
                    else if (b.lastRead) {
                        return 1;
                    }
                    // If neither has lastRead, sort by addedAt
                    else {
                        return new Date(b.addedAt) - new Date(a.addedAt);
                    }
                });
                
                // Add each book to UI
                books.forEach(function(book) {
                    addBookToUI(book);
                });
                
                // Update visibility
                updateLibraryVisibility();
            })
            .catch(function(error) {
                console.error('Failed to load books:', error);
                alert('Failed to load your library: ' + error.message);
            });
    }
    
    /**
     * Add a book to the UI
     */
    function addBookToUI(book) {
        var bookItem = document.createElement('div');
        bookItem.className = 'book-item';
        bookItem.setAttribute('data-id', book.id);
        
        var bookCover = document.createElement('div');
        bookCover.className = 'book-cover';
        bookCover.textContent = book.format.toUpperCase();
        
        // Create the book info container
        var bookInfo = document.createElement('div');
        bookInfo.className = 'book-info';
        
        // Book title
        var bookTitle = document.createElement('div');
        bookTitle.className = 'book-title';
        bookTitle.textContent = book.title;
        
        // Book author
        var bookAuthor = document.createElement('div');
        bookAuthor.className = 'book-author';
        bookAuthor.textContent = book.author;
        
        // Book progress
        var bookProgress = document.createElement('div');
        bookProgress.className = 'book-progress';
        
        var progressPercentage = Math.round(book.progress * 100);
        
        // Add progress text
        if (book.lastRead) {
            var formattedDate = formatDate(book.lastRead);
            if (progressPercentage > 0) {
                bookProgress.textContent = progressPercentage + '% • Last read: ' + formattedDate;
            } else {
                bookProgress.textContent = 'Started on ' + formattedDate;
            }
        } else {
            bookProgress.textContent = 'Not started';
        }
        
        // Add progress bar
        var progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        
        var progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.width = progressPercentage + '%';
        
        progressBar.appendChild(progressFill);
        
        // Create actions container
        var bookActions = document.createElement('div');
        bookActions.className = 'book-actions';
        
        // Create delete button
        var deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteBook(book.id);
        });
        
        // Assemble the elements
        bookActions.appendChild(deleteBtn);
        bookInfo.appendChild(bookTitle);
        bookInfo.appendChild(bookAuthor);
        bookInfo.appendChild(bookProgress);
        bookInfo.appendChild(progressBar);
        
        bookItem.appendChild(bookCover);
        bookItem.appendChild(bookInfo);
        bookItem.appendChild(bookActions);
        
        // Add click handler to open book
        bookItem.addEventListener('click', function() {
            openBook(book.id);
        });
        
        bookListElement.appendChild(bookItem);
    }
    
    /**
     * Update library visibility based on book count
     */
    function updateLibraryVisibility() {
        var hasBooks = bookListElement.children.length > 0;
        
        bookListElement.style.display = hasBooks ? 'block' : 'none';
        emptyLibraryElement.style.display = hasBooks ? 'none' : 'flex';
    }
    
    /**
     * Delete a book
     */
    function deleteBook(id) {
        if (confirm('Are you sure you want to delete this book?')) {
            Storage.deleteBook(id)
                .then(function() {
                    // Remove from UI
                    var bookItem = bookListElement.querySelector('[data-id="' + id + '"]');
                    if (bookItem) {
                        // Fade out animation
                        bookItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        bookItem.style.opacity = '0';
                        bookItem.style.transform = 'translateX(20px)';
                        
                        // Remove after animation
                        setTimeout(function() {
                            if (bookItem.parentNode) {
                                bookListElement.removeChild(bookItem);
                            }
                            // Update visibility
                            updateLibraryVisibility();
                        }, 300);
                    }
                })
                .catch(function(error) {
                    console.error('Failed to delete book:', error);
                    alert('Failed to delete book: ' + error.message);
                });
        }
    }
    
    /**
     * Open a book in the reader
     */
    function openBook(id) {
        // Show loading indicator
        showLoadingIndicator();
        
        Storage.getBook(id, true)
            .then(function(book) {
                hideLoadingIndicator();
                Reader.loadBook(book);
                
                // Switch to reader view
                document.getElementById('library-view').classList.remove('active');
                document.getElementById('reader-view').classList.add('active');
            })
            .catch(function(error) {
                hideLoadingIndicator();
                console.error('Failed to load book for reading:', error);
                alert('Failed to open book: ' + error.message);
            });
    }
    
    return {
        init: init,
        loadBooks: loadBooks,
        importBook: importBook
    };
})(); 
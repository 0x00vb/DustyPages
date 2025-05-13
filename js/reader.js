/**
 * Reader Module for RustyPages
 * Manages the reading interface for both EPUB and PDF formats
 * Compatible with iOS 9 Safari
 */

var Reader = (function() {
    var currentBook = null;
    var currentReaderType = null; // 'epub' or 'pdf'
    
    /**
     * Open a book and display it in the reader
     */
    function openBook(bookId) {
        // Get the book data from storage
        Storage.getBook(bookId, function(book) {
            if (!book) {
                console.log('Book not found in local storage:', bookId);
                // If user is logged in, try to get the book from the server
                if (Users.isLoggedIn()) {
                    console.log('Attempting to get book from server...');
                    Users.getRemoteBook(bookId, function(success, remoteBook) {
                        if (success && remoteBook) {
                            console.log('Book retrieved from server successfully');
                            
                            // If we have actual book content, convert it from Base64 if needed
                            if (remoteBook.data && typeof remoteBook.data === 'string') {
                                console.log('Processing book data from server, type:', typeof remoteBook.data);
                                console.log('Book data length:', remoteBook.data.length);
                                
                                // If the data starts with UEsDB or PK, it's probably binary data in Base64
                                if (remoteBook.data.indexOf('UEsDB') === 0 || remoteBook.data.indexOf('PK') === 0) {
                                    try {
                                        // Try to decode as Base64
                                        console.log('Attempting to convert apparent Base64 data');
                                        try {
                                            var binaryString = atob(remoteBook.data);
                                            var bytes = new Uint8Array(binaryString.length);
                                            for (var i = 0; i < binaryString.length; i++) {
                                                bytes[i] = binaryString.charCodeAt(i);
                                            }
                                            remoteBook.data = bytes.buffer;
                                            console.log('Successfully converted Base64 to ArrayBuffer from server data');
                                        } catch (decodeError) {
                                            console.error('Base64 decode failed for server data:', decodeError);
                                            // If conversion fails, we'll keep the string data as-is
                                            console.log('Using original string data from server');
                                        }
                                    } catch (e) {
                                        console.error('Error processing book data from server:', e);
                                    }
                                }
                            }
                            
                            Storage.saveBook(remoteBook, function(savedBook) {
                                if (savedBook) {
                                    openBook(bookId); // Recursively call openBook with the now-saved book
                                } else {
                                    showError('Failed to save book from server');
                                }
                            });
                        } else {
                            showError('Book not found on server or locally');
                        }
                    });
                } else {
                    showError('Book not found: ' + bookId);
                }
                return;
            }
            
            currentBook = book;
            
            // Update book title
            var titleEl = document.getElementById('book-title');
            if (titleEl) {
                titleEl.textContent = book.title;
            }
            
            // Check if book has data
            if (!book.data) {
                console.log('Book has no data:', bookId);
                if (Users.isLoggedIn()) {
                    console.log('Attempting to get book data from server...');
                    Users.getRemoteBook(bookId, function(success, remoteBook) {
                        if (success && remoteBook && remoteBook.data) {
                            console.log('Book data retrieved from server successfully');
                            Storage.saveBook(remoteBook, function(savedBook) {
                                if (savedBook) {
                                    openBook(bookId); // Recursively call openBook with the now-complete book
                                } else {
                                    showError('Failed to save book data from server');
                                }
                            });
                        } else {
                            showError('Book data not available locally or on server');
                        }
                    });
                } else {
                    showError('Book data not available. Please reupload the book.');
                }
                return;
            }
            
            // Initialize the appropriate reader
            if (book.format === 'epub') {
                currentReaderType = 'epub';
                EPUBHandler.init(book, 'reader-container', function(success, error) {
                    if (!success) {
                        console.error('Failed to open EPUB book:', error);
                        showError(error || 'Failed to open EPUB book');
                        
                        // If there's an issue with the book data, attempt to redownload if user is logged in
                        if (Users.isLoggedIn() && error && (error.indexOf('Failed to open EPUB file') >= 0 || error.indexOf('Error initializing EPUB reader') >= 0)) {
                            console.log('Attempting to get fresh book data from server...');
                            Users.getRemoteBook(bookId, function(success, remoteBook) {
                                if (success && remoteBook && remoteBook.data) {
                                    console.log('Fresh book data retrieved from server successfully');
                                    Storage.saveBook(remoteBook, function(savedBook) {
                                        if (savedBook) {
                                            openBook(bookId); // Retry opening with fresh data
                                        } else {
                                            showError('Failed to save fresh book data from server');
                                        }
                                    });
                                }
                            });
                        }
                    } else {
                        // Apply current settings
                        applySettings(Storage.getSettings());
                    }
                });
            } else if (book.format === 'pdf') {
                currentReaderType = 'pdf';
                PDFHandler.init(book, 'reader-container', function(success, error) {
                    if (!success) {
                        console.error('Failed to open PDF book:', error);
                        showError(error || 'Failed to open PDF book');
                        
                        // If there's an issue with the book data, attempt to redownload if user is logged in
                        if (Users.isLoggedIn() && error && (error.indexOf('Failed to load PDF') >= 0 || error.indexOf('Error initializing PDF reader') >= 0)) {
                            console.log('Attempting to get fresh book data from server...');
                            Users.getRemoteBook(bookId, function(success, remoteBook) {
                                if (success && remoteBook && remoteBook.data) {
                                    console.log('Fresh book data retrieved from server successfully');
                                    Storage.saveBook(remoteBook, function(savedBook) {
                                        if (savedBook) {
                                            openBook(bookId); // Retry opening with fresh data
                                        } else {
                                            showError('Failed to save fresh book data from server');
                                        }
                                    });
                                }
                            });
                        }
                    } else {
                        // Apply current settings
                        applySettings(Storage.getSettings());
                    }
                });
            } else {
                showError('Unsupported book format: ' + book.format);
            }
            
            // Update view
            showReaderView();
        });
    }
    
    /**
     * Close the current book
     */
    function closeBook() {
        if (currentReaderType === 'epub') {
            EPUBHandler.unload();
        } else if (currentReaderType === 'pdf') {
            PDFHandler.unload();
        }
        
        currentBook = null;
        currentReaderType = null;
        
        // Clear reader container
        var container = document.getElementById('reader-container');
        if (container) {
            container.innerHTML = '';
        }
        
        // Show library view
        showLibraryView();
    }
    
    /**
     * Go to next page
     */
    function nextPage() {
        if (currentReaderType === 'epub') {
            EPUBHandler.nextPage();
        } else if (currentReaderType === 'pdf') {
            PDFHandler.nextPage();
        }
        updatePaginationButtons();
    }
    
    /**
     * Go to previous page
     */
    function prevPage() {
        if (currentReaderType === 'epub') {
            EPUBHandler.prevPage();
        } else if (currentReaderType === 'pdf') {
            PDFHandler.prevPage();
        }
        updatePaginationButtons();
    }
    
    /**
     * Update the state of pagination buttons based on current position
     */
    function updatePaginationButtons() {
        var prevBtn = document.getElementById('prev-page');
        var nextBtn = document.getElementById('next-page');
        var currentPage = parseInt(document.getElementById('current-page').textContent, 10);
        var totalPages = parseInt(document.getElementById('total-pages').textContent, 10);
        
        if (prevBtn) {
            if (currentPage <= 1) {
                prevBtn.setAttribute('disabled', 'disabled');
                prevBtn.classList.add('disabled');
            } else {
                prevBtn.removeAttribute('disabled');
                prevBtn.classList.remove('disabled');
            }
        }
        
        if (nextBtn) {
            if (currentPage >= totalPages) {
                nextBtn.setAttribute('disabled', 'disabled');
                nextBtn.classList.add('disabled');
            } else {
                nextBtn.removeAttribute('disabled');
                nextBtn.classList.remove('disabled');
            }
        }
    }
    
    /**
     * Apply settings to the current book
     */
    function applySettings(settings) {
        if (currentReaderType === 'epub') {
            EPUBHandler.applySettings(settings);
        } else if (currentReaderType === 'pdf') {
            PDFHandler.applySettings(settings);
        }
        
        // Apply body class for theme
        document.body.className = 'theme-' + settings.theme;
        
        // Apply font class to reader container
        var container = document.getElementById('reader-container');
        if (container) {
            // Remove existing font classes
            container.classList.remove('font-serif', 'font-sans-serif', 'font-dyslexic');
            container.classList.remove('font-small', 'font-medium', 'font-large', 'font-xlarge');
            container.classList.remove('margin-small', 'margin-medium', 'margin-large');
            
            // Add new font classes
            container.classList.add('font-' + settings.font);
            container.classList.add('font-' + settings.fontSize);
            container.classList.add('margin-' + settings.margin);
        }
    }
    
    /**
     * Show the reader view and hide library view
     */
    function showReaderView() {
        var libraryView = document.getElementById('library-view');
        var readerView = document.getElementById('reader-view');
        var navButtons = document.getElementById('nav-buttons');
        
        if (libraryView) libraryView.classList.add('hidden');
        if (readerView) readerView.classList.remove('hidden');
        if (navButtons) navButtons.classList.remove('hidden');
    }
    
    /**
     * Show the library view and hide reader view
     */
    function showLibraryView() {
        var libraryView = document.getElementById('library-view');
        var readerView = document.getElementById('reader-view');
        var navButtons = document.getElementById('nav-buttons');
        var settingsPanel = document.getElementById('settings-panel');
        
        if (libraryView) libraryView.classList.remove('hidden');
        if (readerView) readerView.classList.add('hidden');
        if (navButtons) navButtons.classList.add('hidden');
        if (settingsPanel) settingsPanel.classList.add('hidden');
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        alert('Error: ' + message);
    }
    
    /**
     * Process a new book file
     */
    function processBookFile(file) {
        if (!file) return;
        
        var fileExtension = file.name.split('.').pop().toLowerCase();
        
        if (fileExtension === 'epub') {
            // Parse EPUB file
            EPUBHandler.parseEpub(file, function(bookData, error) {
                if (bookData) {
                    // Save to storage
                    Storage.saveBook(bookData, function(result) {
                        if (result) {
                            // Refresh book list and open book
                            refreshBookList(function() {
                                openBook(bookData.id);
                            });
                            
                            // If user is logged in, upload to server
                            if (Users.isLoggedIn()) {
                                Users.uploadBook(bookData, function(success) {
                                    if (success) {
                                        console.log('Book uploaded to server successfully');
                                    } else {
                                        console.log('Failed to upload book to server');
                                    }
                                });
                            }
                        } else {
                            showError('Failed to save book');
                        }
                    });
                } else {
                    showError(error || 'Failed to parse EPUB file');
                }
            });
        } else if (fileExtension === 'pdf') {
            // Parse PDF file
            PDFHandler.parsePdf(file, function(bookData, error) {
                if (bookData) {
                    // Save to storage
                    Storage.saveBook(bookData, function(result) {
                        if (result) {
                            // Refresh book list and open book
                            refreshBookList(function() {
                                openBook(bookData.id);
                            });
                            
                            // If user is logged in, upload to server
                            if (Users.isLoggedIn()) {
                                Users.uploadBook(bookData, function(success) {
                                    if (success) {
                                        console.log('Book uploaded to server successfully');
                                    } else {
                                        console.log('Failed to upload book to server');
                                    }
                                });
                            }
                        } else {
                            showError('Failed to save book');
                        }
                    });
                } else {
                    showError(error || 'Failed to parse PDF file');
                }
            });
        } else {
            showError('Unsupported file format: ' + fileExtension);
        }
    }
    
    /**
     * Refresh the list of books in the library
     */
    function refreshBookList(callback) {
        var bookList = document.getElementById('book-list');
        var noBooks = document.getElementById('no-books-message');
        
        if (!bookList) return;
        
        // Get all books from storage
        Storage.getAllBooks(function(books) {
            // Clear current list
            bookList.innerHTML = '';
            
            if (books.length === 0) {
                // Show "no books" message
                if (noBooks) noBooks.style.display = 'block';
                if (callback) callback();
                return;
            }
            
            // Hide "no books" message
            if (noBooks) noBooks.style.display = 'none';
            
            // Add each book to the list
            books.forEach(function(book) {
                var bookItem = document.createElement('div');
                bookItem.className = 'book-item';
                bookItem.setAttribute('data-id', book.id);
                
                // Create book cover
                var cover = document.createElement('div');
                cover.className = 'book-cover';
                
                if (book.cover) {
                    var img = document.createElement('img');
                    img.src = book.cover;
                    img.alt = book.title;
                    img.onerror = function() {
                        // If image fails to load, replace with fallback
                        cover.removeChild(img);
                        createFallbackCover(cover, book.title);
                    };
                    cover.appendChild(img);
                } else {
                    // Create fallback cover with title if no cover image
                    createFallbackCover(cover, book.title);
                }
                
                // Create book info
                var title = document.createElement('div');
                title.className = 'book-title';
                title.textContent = book.title;
                
                var author = document.createElement('div');
                author.className = 'book-author';
                author.textContent = book.author;
                
                var format = document.createElement('div');
                format.className = 'book-format';
                format.textContent = book.format.toUpperCase();
                
                // Create delete button
                var deleteBtn = document.createElement('div');
                deleteBtn.className = 'delete-book';
                deleteBtn.textContent = '×';
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this book?')) {
                        deleteBook(book.id);
                    }
                });
                
                // Add all elements to the book item
                bookItem.appendChild(cover);
                bookItem.appendChild(title);
                bookItem.appendChild(author);
                bookItem.appendChild(format);
                bookItem.appendChild(deleteBtn);
                
                // Add click event to open the book
                bookItem.addEventListener('click', function() {
                    openBook(book.id);
                });
                
                // Add to book list
                bookList.appendChild(bookItem);
            });
            
            if (callback) callback();
        });
    }
    
    /**
     * Delete a book from storage
     */
    function deleteBook(bookId) {
        Storage.deleteBook(bookId, function(success) {
            if (success) {
                refreshBookList();
                
                // If user is logged in, delete from server
                if (Users.isLoggedIn()) {
                    Users.deleteBookFromServer(bookId, function(serverSuccess) {
                        if (serverSuccess) {
                            console.log('Book deleted from server successfully');
                        } else {
                            console.log('Failed to delete book from server');
                        }
                    });
                }
            } else {
                showError('Failed to delete book');
            }
        });
    }
    
    /**
     * Toggle the settings panel
     */
    function toggleSettings() {
        var settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel) {
            settingsPanel.classList.toggle('hidden');
            
            // If opening the panel, update active settings
            if (!settingsPanel.classList.contains('hidden')) {
                updateSettingsPanel();
            }
        }
    }
    
    /**
     * Update the settings panel to show current settings
     */
    function updateSettingsPanel() {
        var settings = Storage.getSettings();
        
        // Update theme buttons
        var themeButtons = document.querySelectorAll('.theme-btn');
        for (var i = 0; i < themeButtons.length; i++) {
            var btn = themeButtons[i];
            if (btn.getAttribute('data-theme') === settings.theme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
        
        // Update font buttons
        var fontButtons = document.querySelectorAll('.font-btn');
        for (var j = 0; j < fontButtons.length; j++) {
            var btn = fontButtons[j];
            if (btn.getAttribute('data-font') === settings.font) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
        
        // Update font size buttons
        var fontSizeButtons = document.querySelectorAll('.font-size-btn');
        for (var k = 0; k < fontSizeButtons.length; k++) {
            var btn = fontSizeButtons[k];
            if (btn.getAttribute('data-size') === settings.fontSize) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
        
        // Update margin buttons
        var marginButtons = document.querySelectorAll('.margin-btn');
        for (var l = 0; l < marginButtons.length; l++) {
            var btn = marginButtons[l];
            if (btn.getAttribute('data-margin') === settings.margin) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    }
    
    /**
     * Change a setting
     */
    function changeSetting(type, value) {
        var settings = Storage.getSettings();
        
        // Update the setting
        settings[type] = value;
        
        // Save the settings
        Storage.saveSettings(settings);
        
        // Apply the settings
        applySettings(settings);
        
        // Update the settings panel
        updateSettingsPanel();
    }
    
    /**
     * Jump to a position in the book using the progress slider
     */
    function jumpToPosition(percent) {
        if (!currentReaderType) return;
        
        if (currentReaderType === 'epub') {
            EPUBHandler.jumpToPosition(percent);
        } else if (currentReaderType === 'pdf') {
            PDFHandler.jumpToPosition(percent);
        }
        
        // Update pagination buttons after jumping
        setTimeout(updatePaginationButtons, 50);
    }
    
    /**
     * Initialize the reader module
     */
    function init() {
        // Initialize storage
        Storage.init();
        
        // Apply default settings
        applySettings(Storage.getSettings());
        
        // Set up event listeners
        setupEventListeners();
        
        // Initial button state
        updatePaginationButtons();
        
        // Load the book list
        refreshBookList();
    }
    
    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // File input for adding books
        var fileInput = document.getElementById('book-file');
        if (fileInput) {
            fileInput.addEventListener('change', function(e) {
                var file = e.target.files[0];
                if (file) {
                    processBookFile(file);
                }
                // Reset the input so the same file can be selected again
                fileInput.value = '';
            });
        }
        
        // Navigation buttons
        var backToLibraryBtn = document.getElementById('back-to-library');
        if (backToLibraryBtn) {
            backToLibraryBtn.addEventListener('click', closeBook);
        }
        
        var toggleSettingsBtn = document.getElementById('toggle-settings');
        if (toggleSettingsBtn) {
            toggleSettingsBtn.addEventListener('click', toggleSettings);
        }
        
        var closeSettingsBtn = document.getElementById('close-settings');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', toggleSettings);
        }
        
        // Page navigation buttons
        var prevPageBtn = document.getElementById('prev-page');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', prevPage);
        }
        
        var nextPageBtn = document.getElementById('next-page');
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', nextPage);
        }
        
        // Settings buttons
        var themeButtons = document.querySelectorAll('.theme-btn');
        for (var i = 0; i < themeButtons.length; i++) {
            themeButtons[i].addEventListener('click', function() {
                changeSetting('theme', this.getAttribute('data-theme'));
            });
        }
        
        var fontButtons = document.querySelectorAll('.font-btn');
        for (var j = 0; j < fontButtons.length; j++) {
            fontButtons[j].addEventListener('click', function() {
                changeSetting('font', this.getAttribute('data-font'));
            });
        }
        
        var fontSizeButtons = document.querySelectorAll('.font-size-btn');
        for (var k = 0; k < fontSizeButtons.length; k++) {
            fontSizeButtons[k].addEventListener('click', function() {
                changeSetting('fontSize', this.getAttribute('data-size'));
            });
        }
        
        var marginButtons = document.querySelectorAll('.margin-btn');
        for (var l = 0; l < marginButtons.length; l++) {
            marginButtons[l].addEventListener('click', function() {
                changeSetting('margin', this.getAttribute('data-margin'));
            });
        }
        
        // Progress slider
        var progressSlider = document.getElementById('progress-slider');
        if (progressSlider) {
            progressSlider.addEventListener('input', function() {
                var percent = parseInt(this.value, 10);
                // Update progress percentage display while sliding
                var percentEl = document.getElementById('progress-percent');
                if (percentEl) {
                    percentEl.textContent = percent + '%';
                }
                
                // Also update button states during slider movement
                updatePaginationButtons();
            });
            
            progressSlider.addEventListener('change', function() {
                var percent = parseInt(this.value, 10);
                jumpToPosition(percent);
            });
        }
        
        // Watch for page number changes with a more frequent polling mechanism
        // This ensures the slider updates even if events aren't firing properly
        var pageWatcher = setInterval(function() {
            var currentPageEl = document.getElementById('current-page');
            if (currentPageEl && currentPageEl.getAttribute('data-last-value') !== currentPageEl.textContent) {
                // Page has changed, update slider and buttons
                updateSliderFromPageNumbers();
                updatePaginationButtons();
                // Store last value to detect changes
                currentPageEl.setAttribute('data-last-value', currentPageEl.textContent);
            }
        }, 500);  // Check every 500ms
        
        // Monitor page changes to update button states
        var observer = new MutationObserver(function(mutations) {
            updatePaginationButtons();
            updateSliderFromPageNumbers();
        });
        
        var currentPageEl = document.getElementById('current-page');
        var totalPagesEl = document.getElementById('total-pages');
        
        if (currentPageEl) {
            observer.observe(currentPageEl, { childList: true });
        }
        
        if (totalPagesEl) {
            observer.observe(totalPagesEl, { childList: true });
        }
    }
    
    /**
     * Update slider position based on current page and total page numbers
     */
    function updateSliderFromPageNumbers() {
        var currentPageEl = document.getElementById('current-page');
        var totalPagesEl = document.getElementById('total-pages');
        var sliderEl = document.getElementById('progress-slider');
        
        if (!currentPageEl || !totalPagesEl || !sliderEl) return;
        
        var currentPage = parseInt(currentPageEl.textContent, 10);
        var totalPages = parseInt(totalPagesEl.textContent, 10);
        
        if (isNaN(currentPage) || isNaN(totalPages) || totalPages <= 1) return;
        
        // Calculate progress percentage
        var progress = ((currentPage - 1) / (totalPages - 1)) * 100;
        progress = Math.max(0, Math.min(100, progress)); // Clamp between 0-100
        
        // Update slider value
        sliderEl.value = Math.round(progress);
        
        // Update percentage display
        var percentEl = document.getElementById('progress-percent');
        if (percentEl) {
            percentEl.textContent = Math.round(progress) + '%';
        }
    }
    
    /**
     * Creates a fallback cover with styled book title
     * @param {HTMLElement} coverElement - The cover container element
     * @param {string} title - The book title to display
     */
    function createFallbackCover(coverElement, title) {
        var fallback = document.createElement('div');
        fallback.className = 'book-cover-fallback';
        fallback.textContent = title;
        coverElement.appendChild(fallback);
    }
    
    // Public API
    return {
        init: init,
        openBook: openBook,
        closeBook: closeBook,
        nextPage: nextPage,
        prevPage: prevPage,
        refreshBookList: refreshBookList,
        applySettings: applySettings,
        jumpToPosition: jumpToPosition,
        updatePaginationButtons: updatePaginationButtons
    };
})(); 
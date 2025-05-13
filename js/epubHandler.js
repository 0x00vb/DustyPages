/**
 * EPUB Handler Module for RustyPages
 * Handles rendering and navigation of EPUB books
 * Compatible with iOS 9 Safari
 * Uses epub.js v0.3.x
 */

var EPUBHandler = (function() {
    var book = null;
    var rendition = null;
    var currentLocation = null;
    var container = null;
    var currentBook = null;
    var locations = null;
    var isGeneratingLocations = false;
    var currentPageNumber = 1; // Track current page explicitly
    
    /**
     * Initialize the EPUB reader with a book file
     */
    function init(bookData, containerId, callback) {
        container = document.getElementById(containerId);
        
        if (!container) {
            if (callback) callback(false, 'Container element not found');
            return;
        }
        
        try {
            // Clear container
            container.innerHTML = '';
            
            currentBook = bookData;
            
            // Create a new book
            book = ePub(bookData.data);
            
            // Generate a rendition
            rendition = book.renderTo(container, {
                width: '100%',
                height: '100%',
                spread: 'none',
                flow: 'paginated'
            });
            
            // Add event listeners (must be set before rendering)
            addEventListeners();
            
            // Initialize progress slider
            initProgressSlider();
            
            // Generate locations for more accurate progress
            generateLocations();
            
            // Get total pages count
            book.loaded.navigation.then(function() {
                updateTotalPages();
                
                // Load initial location or start from beginning
                if (bookData.position) {
                    rendition.display(bookData.position).then(function() {
                        // Force an initial location update, since locationChanged might not fire
                        if (rendition.location && rendition.location.start) {
                            currentLocation = rendition.location;
                            updatePageDisplay();
                        }
                        if (callback) callback(true);
                    });
                } else {
                    rendition.display().then(function() {
                        // Force an initial location update
                        if (rendition.location && rendition.location.start) {
                            currentLocation = rendition.location;
                            updatePageDisplay();
                        }
                        if (callback) callback(true);
                    });
                }
            });
            
            // Handle errors
            book.on('openFailed', function(error) {
                console.log('Failed to open book:', error);
                if (callback) callback(false, 'Failed to open EPUB file: ' + error);
            });
        } catch (e) {
            console.log('Error initializing EPUB reader:', e);
            if (callback) callback(false, 'Error initializing EPUB reader: ' + e.message);
        }
    }
    
    /**
     * Generate locations for the book for accurate progress
     */
    function generateLocations() {
        if (!book) return;
        
        // Show a spinner or indicator without text
        var percentEl = document.getElementById('progress-percent');
        if (percentEl) {
            // Just show 0% instead of "Generating locations..."
            percentEl.textContent = '0%';
        }
        
        isGeneratingLocations = true;
        
        // Generate locations
        book.ready.then(function() {
            // Check if we already have locations
            if (currentBook && currentBook.locations) {
                // Load pre-generated locations
                book.locations.load(currentBook.locations);
                isGeneratingLocations = false;
                updateProgressInfo();
                return;
            }
            
            // Generate new locations
            book.locations.generate(1024).then(function() {
                isGeneratingLocations = false;
                
                // Save locations to the book data
                if (currentBook && currentBook.id) {
                    currentBook.locations = book.locations.save();
                    Storage.saveBook(currentBook);
                }
                
                // Update progress info
                updateProgressInfo();
            });
        });
    }
    
    /**
     * Initialize progress slider
     */
    function initProgressSlider() {
        var slider = document.getElementById('progress-slider');
        if (!slider) return;
        
        // Set initial value
        slider.value = 0;
        
        // Use input event for continuous updates while dragging (better UX)
        slider.addEventListener('input', function() {
            var value = parseInt(slider.value, 10);
            updateProgressLabel(value);
            
            // Update current page preview during drag based on percentage
            if (book && book.spine && book.spine.items) {
                var pageEl = document.getElementById('current-page');
                if (pageEl) {
                    var totalItems = book.spine.items.length;
                    var estimatedPage = Math.max(1, Math.ceil((value / 100) * totalItems));
                    // Update both the display and our tracked page number
                    currentPageNumber = estimatedPage;
                    pageEl.textContent = estimatedPage;
                }
            }
        });
        
        // On release, actually jump to the position
        slider.addEventListener('change', function() {
            var value = parseInt(slider.value, 10);
            jumpToPosition(value);
        });
    }
    
    /**
     * Update progress label based on slider value
     */
    function updateProgressLabel(value) {
        var percentEl = document.getElementById('progress-percent');
        if (percentEl) {
            percentEl.textContent = value + '%';
        }
    }
    
    /**
     * Jump to position in the book based on slider percentage
     */
    function jumpToPosition(percent) {
        if (!book || !rendition) return;
        
        // Calculate and update the current page number before navigating
        if (book.spine && book.spine.items && book.spine.items.length > 0) {
            var totalItems = book.spine.items.length;
            currentPageNumber = Math.max(1, Math.ceil((percent / 100) * totalItems));
            
            // Update the display immediately
            var pageEl = document.getElementById('current-page');
            if (pageEl) {
                pageEl.textContent = currentPageNumber;
            }
        }
        
        // If locations are being generated, just use the spine-based navigation
        if (isGeneratingLocations || !book.locations || book.locations.length() === 0) {
            // Fallback: calculate position based on spine
            if (book.spine && book.spine.items && book.spine.items.length > 0) {
                var index = Math.floor((book.spine.items.length - 1) * (percent / 100));
                // Store the intended page in case the locationChanged event doesn't fire immediately
                currentPageNumber = index + 1;
                
                rendition.display(book.spine.items[index].href).then(function(location) {
                    if (location) {
                        currentLocation = location;
                        updateProgressInfo();
                    }
                });
            }
        } else {
            // Use CFI-based navigation if locations are available
            var cfi = book.locations.cfiFromPercentage(percent / 100);
            if (cfi) {
                rendition.display(cfi).then(function(location) {
                    if (location) {
                        currentLocation = location;
                        updateProgressInfo();
                    }
                });
            }
        }
    }
    
    /**
     * Update progress information
     */
    function updateProgressInfo() {
        if (!book) return;
        
        var percentEl = document.getElementById('progress-percent');
        var sliderEl = document.getElementById('progress-slider');
        
        // Calculate progress percentage
        var progress = 0;
        
        if (currentLocation) {
            if (book.locations && book.locations.length() > 0) {
                progress = book.locations.percentageFromCfi(currentLocation.start.cfi);
            } else if (book.spine && book.spine.items && book.spine.items.length > 0) {
                // Fallback calculation using spine position
                var index = currentLocation.start.index || 0;
                progress = (index / Math.max(1, book.spine.items.length - 1));
            }
        } else if (currentPageNumber > 1 && book.spine && book.spine.items) {
            // Use currentPageNumber as fallback
            progress = (currentPageNumber - 1) / Math.max(1, book.spine.items.length - 1);
        }
        
        // Ensure progress is a valid number
        if (isNaN(progress) || !isFinite(progress)) {
            progress = 0;
        }
        
        // Cap progress between 0 and 1
        progress = Math.max(0, Math.min(1, progress));
        
        // Update progress percentage display
        var percent = Math.round(progress * 100);
        if (percentEl) {
            percentEl.textContent = percent + '%';
        }
        
        // Update slider - force a direct value assignment
        if (sliderEl) {
            // Directly setting the slider value
            sliderEl.value = percent;
            
            // Force a UI update by triggering input event (doesn't trigger listeners)
            var event = document.createEvent('HTMLEvents');
            event.initEvent('input', false, true);
            sliderEl.dispatchEvent(event);
        }
        
        // Update page display
        updatePageDisplay();
    }
    
    /**
     * Update the current page and total page display
     */
    function updatePageDisplay() {
        var pageEl = document.getElementById('current-page');
        var totalPagesEl = document.getElementById('total-pages');
        
        if (!pageEl || !totalPagesEl || !book) return;
        
        // Make sure we have a valid current location
        if (!currentLocation || !currentLocation.start) {
            // If we don't have a valid location yet, try to get it from rendition
            if (rendition && rendition.location && rendition.location.start) {
                currentLocation = rendition.location;
            } else {
                // Use our tracked page number as fallback
                pageEl.textContent = currentPageNumber;
                return;
            }
        }
        
        // Current "page" is spine item index + 1
        var currentPage = currentPageNumber;
        if (currentLocation.start && typeof currentLocation.start.index !== 'undefined') {
            currentPage = currentLocation.start.index + 1;
            // Update our tracked page number
            currentPageNumber = currentPage;
        }
        
        // Make sure currentPage is a valid number before displaying
        currentPage = !isNaN(currentPage) ? currentPage : 1;
        
        // Update current page display
        pageEl.textContent = currentPage;
        
        // Make sure totalPages is a valid number
        var totalPages = book.spine && book.spine.items ? book.spine.items.length : 1;
        
        // Make sure it's not NaN before displaying
        totalPages = !isNaN(totalPages) ? totalPages : 1;
        
        totalPagesEl.textContent = totalPages;
        
        // Update the pagination buttons if Reader module is available
        if (typeof Reader !== 'undefined' && Reader.updatePaginationButtons) {
            Reader.updatePaginationButtons();
        }
    }
    
    /**
     * Update the total pages count
     */
    function updateTotalPages() {
        var totalPagesEl = document.getElementById('total-pages');
        if (!totalPagesEl || !book || !book.spine) return;
        
        var total = book.spine.items ? book.spine.items.length : 1;
        
        // Make sure it's a valid number before displaying
        total = !isNaN(total) ? total : 1;
        
        totalPagesEl.textContent = total;
    }
    
    /**
     * Add event listeners for navigation and location changes
     */
    function addEventListeners() {
        // Track current location
        rendition.on('locationChanged', function(location) {
            currentLocation = location;
            
            // Update current page number from location
            if (location && location.start && typeof location.start.index !== 'undefined') {
                currentPageNumber = location.start.index + 1;
            }
            
            // Update progress info immediately - this will update the slider position
            updateProgressInfo();
            
            // Save progress if we have a current book
            if (currentBook && currentBook.id) {
                Storage.updateBookProgress(currentBook.id, location.start.cfi);
            }
        });
        
        // Add a rendered event to ensure page display updates
        rendition.on('rendered', function(section) {
            // We use setTimeout to ensure this runs after any other rendering is complete
            setTimeout(function() {
                updatePageDisplay();
                // Also update progress slider when a new page is rendered
                updateProgressInfo();
            }, 10);
        });
        
        // Add keyboard navigation
        document.addEventListener('keydown', function(e) {
            if (e.keyCode === 37) { // Left arrow
                prevPage();
            } else if (e.keyCode === 39) { // Right arrow
                nextPage();
            }
        });
        
        // Add touch areas for swiping
        createTouchAreas();
    }
    
    /**
     * Create touch areas for swiping left and right
     */
    function createTouchAreas() {
        // Create left touch area
        var leftArea = document.createElement('div');
        leftArea.className = 'touch-area-left';
        container.appendChild(leftArea);
        
        // Create right touch area
        var rightArea = document.createElement('div');
        rightArea.className = 'touch-area-right';
        container.appendChild(rightArea);
        
        // Add event listeners to touch areas
        addTouchListeners(leftArea, prevPage);
        addTouchListeners(rightArea, nextPage);
    }
    
    /**
     * Add touch listeners to an element
     */
    function addTouchListeners(element, callback) {
        // For iOS 9 compatibility, use touchstart/touchend
        var touchStart = 0;
        var touchEnd = 0;
        
        element.addEventListener('touchstart', function(e) {
            touchStart = e.changedTouches[0].screenX;
        }, {passive: true});
        
        element.addEventListener('touchend', function(e) {
            touchEnd = e.changedTouches[0].screenX;
            
            // Only trigger if the touch was more of a tap than a swipe
            if (Math.abs(touchEnd - touchStart) < 30) {
                callback();
            }
        }, {passive: true});
        
        // Also add click event for desktop
        element.addEventListener('click', callback);
    }
    
    /**
     * Go to the next page
     */
    function nextPage() {
        if (!rendition || !book || !book.spine) return;
        
        // Check if we're already at the last page
        if (currentPageNumber >= book.spine.items.length) {
            return; // Already at the end, don't go further
        }
        
        rendition.next().then(function() {
            // Increment our tracked page number, but don't exceed total pages
            currentPageNumber = Math.min(book.spine.items.length, currentPageNumber + 1);
            
            // Calculate and directly update slider position based on current page
            var sliderEl = document.getElementById('progress-slider');
            if (sliderEl && book.spine && book.spine.items) {
                var progress = (currentPageNumber - 1) / Math.max(1, book.spine.items.length - 1);
                sliderEl.value = Math.round(progress * 100);
            }
            
            // Update page display and progress info
            updatePageDisplay();
            updateProgressInfo();
        }).catch(function() {
            // If we couldn't go to the next page, do nothing
        });
    }
    
    /**
     * Go to the previous page
     */
    function prevPage() {
        if (!rendition) return;
        
        // Check if we're already at the first page
        if (currentPageNumber <= 1) {
            return; // Already at the beginning, don't go further
        }
        
        rendition.prev().then(function() {
            // Decrement our tracked page number, but don't go below 1
            currentPageNumber = Math.max(1, currentPageNumber - 1);
            
            // Calculate and directly update slider position based on current page
            var sliderEl = document.getElementById('progress-slider');
            if (sliderEl && book.spine && book.spine.items) {
                var progress = (currentPageNumber - 1) / Math.max(1, book.spine.items.length - 1);
                sliderEl.value = Math.round(progress * 100);
            }
            
            // Update page display and progress info
            updatePageDisplay();
            updateProgressInfo();
        }).catch(function() {
            // If we couldn't go to the previous page, do nothing
        });
    }
    
    /**
     * Apply settings to the book
     */
    function applySettings(settings) {
        if (!rendition) return;
        
        // Apply font family
        var fontFamily = 'Georgia, serif';
        if (settings.font === 'sans-serif') {
            fontFamily = 'Helvetica, Arial, sans-serif';
        } else if (settings.font === 'dyslexic') {
            fontFamily = "'OpenDyslexic', 'Comic Sans MS', cursive";
        }
        
        // Apply font size
        var fontSize = '100%';
        if (settings.fontSize === 'small') {
            fontSize = '90%';
        } else if (settings.fontSize === 'large') {
            fontSize = '120%';
        } else if (settings.fontSize === 'xlarge') {
            fontSize = '150%';
        }
        
        // Apply margin
        var margin = '20px';
        if (settings.margin === 'small') {
            margin = '10px';
        } else if (settings.margin === 'large') {
            margin = '30px';
        }
        
        // Apply theme
        var theme = {
            body: {
                color: '#000',
                background: '#fff'
            }
        };
        
        if (settings.theme === 'sepia') {
            theme.body.color = '#5b4636';
            theme.body.background = '#f8f2e3';
        } else if (settings.theme === 'dark') {
            theme.body.color = '#e0e0e0';
            theme.body.background = '#262626';
        }
        
        // Apply styles
        rendition.themes.override('font-family', fontFamily);
        rendition.themes.override('font-size', fontSize);
        rendition.themes.override('padding', margin);
        rendition.themes.override('color', theme.body.color);
        rendition.themes.override('background', theme.body.background);
    }
    
    /**
     * Unload the book and cleanup resources
     */
    function unload() {
        if (rendition) {
            rendition.destroy();
        }
        
        if (book) {
            book = null;
        }
        
        if (container) {
            container.innerHTML = '';
        }
        
        currentLocation = null;
        currentBook = null;
        isGeneratingLocations = false;
        currentPageNumber = 1; // Reset the page number
    }
    
    /**
     * Parse an EPUB file and return book metadata
     */
    function parseEpub(file, callback) {
        var reader = new FileReader();
        
        reader.onload = function(e) {
            var data = e.target.result;
            var tempBook = ePub();
            
            tempBook.open(data)
                .then(function() {
                    return tempBook.loaded.metadata;
                })
                .then(function(metadata) {
                    var id = 'epub_' + new Date().getTime();
                    var bookData = {
                        id: id,
                        title: metadata.title || file.name,
                        author: metadata.creator || 'Unknown',
                        format: 'epub',
                        data: data,
                        added: new Date().getTime(),
                        position: null,
                        lastRead: null,
                        locations: null
                    };
                    
                    // Get cover if available
                    tempBook.loaded.cover
                        .then(function(coverUrl) {
                            bookData.cover = coverUrl;
                            callback(bookData);
                        })
                        .catch(function() {
                            callback(bookData);
                        });
                })
                .catch(function(error) {
                    console.log('Error parsing EPUB:', error);
                    callback(null, 'Failed to parse EPUB file: ' + error);
                });
        };
        
        reader.onerror = function(error) {
            console.log('Error reading file:', error);
            callback(null, 'Error reading file: ' + error);
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    // Public API
    return {
        init: init,
        nextPage: nextPage,
        prevPage: prevPage,
        unload: unload,
        parseEpub: parseEpub,
        applySettings: applySettings,
        jumpToPosition: jumpToPosition
    };
})(); 
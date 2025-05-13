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
    var totalPageCount = 1;    // Track total pages explicitly
    var progressUpdating = false; // Guard against recursive updates
    
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
            
            // Create a new book - handle different possible data formats
            var bookDataToUse = bookData.data;
            
            // Convert string data if needed - handle various possible formats
            if (typeof bookDataToUse === 'string') {
                console.log('Book data is string, preparing for binary conversion');
                
                // Check if it's a base64 data URI
                if (bookDataToUse.indexOf('data:') === 0) {
                    try {
                        // Extract the base64 part
                        var base64 = bookDataToUse.split(',')[1];
                        if (base64) {
                            // Convert to array buffer
                            var binary = atob(base64);
                            var len = binary.length;
                            var bytes = new Uint8Array(len);
                            for (var i = 0; i < len; i++) {
                                bytes[i] = binary.charCodeAt(i);
                            }
                            bookDataToUse = bytes.buffer;
                            console.log('Converted base64 data URI to ArrayBuffer');
                        }
                    } catch (e) {
                        console.error('Error converting base64 to ArrayBuffer:', e);
                    }
                } 
                // Special case for "UEsDB..." which is a Base64 encoded EPUB without proper header
                else if (bookDataToUse.indexOf('UEsDB') === 0) {
                    try {
                        console.log('Detected Base64 encoded EPUB content');
                        // This is likely a base64 encoded zip/epub file starting with PK header
                        // First, try to decode it
                        try {
                            var binaryString = atob(bookDataToUse);
                            var bytes = new Uint8Array(binaryString.length);
                            for (var i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            bookDataToUse = bytes.buffer;
                            console.log('Converted Base64 to ArrayBuffer successfully');
                        } catch (decodeError) {
                            console.error('Base64 decode failed, trying direct binary conversion:', decodeError);
                            // If base64 decode fails, try direct conversion
                            var blob = new Blob([bookDataToUse], {type: 'application/epub+zip'});
                            var url = URL.createObjectURL(blob);
                            bookDataToUse = url;
                            console.log('Created Blob URL for EPUB:', url.substr(0, 50) + '...');
                        }
                    } catch (e) {
                        console.error('Error handling UEsDB data:', e);
                    }
                }
                // If it starts with PK (epub zip magic number), it's likely binary data stored as string
                else if (bookDataToUse.indexOf('PK') === 0) {
                    try {
                        var len = bookDataToUse.length;
                        var bytes = new Uint8Array(len);
                        for (var i = 0; i < len; i++) {
                            bytes[i] = bookDataToUse.charCodeAt(i);
                        }
                        bookDataToUse = bytes.buffer;
                        console.log('Converted binary string to ArrayBuffer');
                    } catch (e) {
                        console.error('Error converting binary string to ArrayBuffer:', e);
                    }
                }
                // If it's a URL, we'll use it directly but warn
                else if (bookDataToUse.indexOf('http') === 0 || bookDataToUse.indexOf('/') === 0 || bookDataToUse.indexOf('blob:') === 0) {
                    console.log('Book data appears to be a URL:', bookDataToUse.substring(0, 50) + '...');
                }
                // Otherwise, it's probably not valid EPUB data
                else {
                    console.warn('Book data is in an unexpected string format:', bookDataToUse.substring(0, 50) + '...');
                    // Try to convert it to a blob as a last resort
                    try {
                        var blob = new Blob([bookDataToUse], {type: 'application/epub+zip'});
                        var url = URL.createObjectURL(blob);
                        bookDataToUse = url;
                        console.log('Created Blob URL from unknown string data:', url);
                    } catch (e) {
                        console.error('Error creating blob from string:', e);
                    }
                }
            }
            
            // Log the type of data we're using
            console.log('Using book data of type:', typeof bookDataToUse);
            if (bookDataToUse instanceof ArrayBuffer) {
                console.log('ArrayBuffer length:', bookDataToUse.byteLength);
            }
            
            // Initialize the book with appropriate data
            book = ePub(bookDataToUse);
            
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
                            
                            // Make sure currentPageNumber is correctly set
                            if (currentLocation.start && typeof currentLocation.start.index !== 'undefined') {
                                currentPageNumber = currentLocation.start.index + 1;
                            } else {
                                currentPageNumber = 1;
                            }
                            
                            updatePageDisplay();
                        }
                        if (callback) callback(true);
                    }).catch(function(error) {
                        console.error("Error displaying at position:", error);
                        // Fall back to first page
                        rendition.display().then(function() {
                            if (callback) callback(true);
                        });
                    });
                } else {
                    rendition.display().then(function() {
                        // Force an initial location update
                        if (rendition.location && rendition.location.start) {
                            currentLocation = rendition.location;
                            
                            // Make sure currentPageNumber is correctly set
                            if (currentLocation.start && typeof currentLocation.start.index !== 'undefined') {
                                currentPageNumber = currentLocation.start.index + 1;
                            } else {
                                currentPageNumber = 1;
                            }
                            
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
            }).catch(function(error) {
                console.error("Error generating locations:", error);
                isGeneratingLocations = false;
                // Still update progress info using fallback methods
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
                    // Update the display only (don't change currentPageNumber yet)
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
        
        // Calculate the page number for display purposes
        var pageToShow = 1;
        if (book.spine && book.spine.items && book.spine.items.length > 0) {
            var totalItems = book.spine.items.length;
            pageToShow = Math.max(1, Math.ceil((percent / 100) * totalItems));
            
            // Update the display immediately for responsiveness
            var pageEl = document.getElementById('current-page');
            if (pageEl) {
                pageEl.textContent = pageToShow;
            }
        }
        
        // Save the page number before navigation so we can fall back to it if needed
        var targetPageNumber = pageToShow;
        
        // If locations are being generated, just use the spine-based navigation
        if (isGeneratingLocations || !book.locations || book.locations.length() === 0) {
            // Fallback: calculate position based on spine
            if (book.spine && book.spine.items && book.spine.items.length > 0) {
                var index = Math.floor((book.spine.items.length - 1) * (percent / 100));
                index = Math.max(0, Math.min(book.spine.items.length - 1, index));
                
                // Store the intended page number
                currentPageNumber = index + 1;
                
                rendition.display(book.spine.items[index].href).then(function(location) {
                    if (location) {
                        currentLocation = location;
                        
                        // Ensure page number is correct
                        if (location.start && typeof location.start.index !== 'undefined') {
                            currentPageNumber = location.start.index + 1;
                        } else {
                            // Fall back to our calculated value
                            currentPageNumber = targetPageNumber;
                        }
                        
                        updateProgressInfo();
                        updatePageDisplay();
                    }
                }).catch(function(error) {
                    console.error("Error jumping to position:", error);
                    // Still update the page number
                    currentPageNumber = targetPageNumber;
                    updateProgressInfo();
                    updatePageDisplay();
                });
            }
        } else {
            // Use CFI-based navigation if locations are available
            try {
                var cfi = book.locations.cfiFromPercentage(percent / 100);
                if (cfi) {
                    rendition.display(cfi).then(function(location) {
                        if (location) {
                            currentLocation = location;
                            
                            // Ensure page number is correct
                            if (location.start && typeof location.start.index !== 'undefined') {
                                currentPageNumber = location.start.index + 1;
                            } else {
                                // Fall back to our calculated value
                                currentPageNumber = targetPageNumber;
                            }
                            
                            updateProgressInfo();
                            updatePageDisplay();
                        }
                    }).catch(function(error) {
                        console.error("Error jumping to CFI position:", error);
                        // Fall back to spine-based navigation
                        jumpToSpinePosition(percent, targetPageNumber);
                    });
                } else {
                    // Fall back to spine-based navigation if cfi computation fails
                    jumpToSpinePosition(percent, targetPageNumber);
                }
            } catch (e) {
                console.log('Error with CFI navigation:', e);
                // Fall back to spine-based navigation
                jumpToSpinePosition(percent, targetPageNumber);
            }
        }
    }
    
    /**
     * Helper function to jump to a spine position as a fallback
     */
    function jumpToSpinePosition(percent, targetPageNumber) {
        if (book.spine && book.spine.items && book.spine.items.length > 0) {
            var index = Math.floor((book.spine.items.length - 1) * (percent / 100));
            index = Math.max(0, Math.min(book.spine.items.length - 1, index));
            
            // Store the intended page number
            currentPageNumber = index + 1;
            
            rendition.display(book.spine.items[index].href).then(function(location) {
                if (location) {
                    currentLocation = location;
                    
                    // Ensure page number is correct
                    if (location.start && typeof location.start.index !== 'undefined') {
                        currentPageNumber = location.start.index + 1;
                    } else {
                        // Fall back to our calculated value
                        currentPageNumber = targetPageNumber;
                    }
                    
                    updateProgressInfo();
                    updatePageDisplay();
                }
            }).catch(function(error) {
                console.error("Error jumping to spine position:", error);
                // Still update the page number
                currentPageNumber = targetPageNumber;
                updateProgressInfo();
                updatePageDisplay();
            });
        }
    }
    
    /**
     * Update progress information
     */
    function updateProgressInfo() {
        if (!book || progressUpdating) return;
        
        progressUpdating = true;
        
        try {
            var percentEl = document.getElementById('progress-percent');
            var sliderEl = document.getElementById('progress-slider');
            
            // Calculate progress percentage
            var progress = 0;
            
            if (currentLocation) {
                if (book.locations && book.locations.length() > 0 && currentLocation.start && currentLocation.start.cfi) {
                    try {
                        progress = book.locations.percentageFromCfi(currentLocation.start.cfi);
                        // If progress is not a valid number, fall back to spine-based calculation
                        if (isNaN(progress) || !isFinite(progress)) {
                            progress = calculateSpineProgress();
                        }
                    } catch (e) {
                        console.log('Error calculating progress from CFI:', e);
                        // Fall back to spine-based calculation
                        progress = calculateSpineProgress();
                    }
                } else {
                    // Fallback calculation using spine position
                    progress = calculateSpineProgress();
                }
            } else if (currentPageNumber >= 1 && book.spine && book.spine.items) {
                // Use currentPageNumber as fallback
                progress = (currentPageNumber - 1) / Math.max(1, book.spine.items.length - 1);
            }
            
            // For single-page books, show 100% progress
            if (book.spine && book.spine.items && book.spine.items.length <= 1) {
                progress = 1;
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
            
            // Update slider - only if value has changed
            if (sliderEl) {
                // Check if we need to update the value
                if (parseInt(sliderEl.value, 10) !== percent) {
                    // Directly setting the slider value
                    sliderEl.value = percent;
                    
                    // Force a UI update by triggering input event
                    var event = document.createEvent('HTMLEvents');
                    event.initEvent('input', false, true);
                    sliderEl.dispatchEvent(event);
                }
            }
            
            // Update page display
            updatePageDisplay();
        } finally {
            progressUpdating = false;
        }
    }
    
    /**
     * Helper function to calculate progress based on spine position
     */
    function calculateSpineProgress() {
        if (book.spine && book.spine.items && book.spine.items.length > 0) {
            var index = 0;
            if (currentLocation && currentLocation.start) {
                index = currentLocation.start.index || 0;
            } else {
                index = Math.max(0, currentPageNumber - 1);
            }
            return index / Math.max(1, book.spine.items.length - 1);
        }
        return 0;
    }
    
    /**
     * Update the current page and total page display
     */
    function updatePageDisplay() {
        var pageEl = document.getElementById('current-page');
        var totalPagesEl = document.getElementById('total-pages');
        
        if (!pageEl || !totalPagesEl || !book) return;
        
        // Calculate current page number
        var currentPage = currentPageNumber;
        
        // If we have a valid location, use its index
        if (currentLocation && currentLocation.start && typeof currentLocation.start.index !== 'undefined') {
            currentPage = currentLocation.start.index + 1;
            // Update our tracked page number
            currentPageNumber = currentPage;
        }
        
        // Make sure currentPage is a valid number
        if (isNaN(currentPage) || !isFinite(currentPage)) {
            currentPage = 1;
            currentPageNumber = 1;
        }
        
        // Ensure it's within valid range
        currentPage = Math.max(1, Math.min(totalPageCount, currentPage));
        currentPageNumber = currentPage;
        
        // Update current page display
        pageEl.textContent = currentPage;
        
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
        if (isNaN(total) || !isFinite(total)) {
            total = 1;
        }
        
        // Store the total value
        totalPageCount = total;
        
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
            if (currentBook && currentBook.id && location && location.start && location.start.cfi) {
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
        
        // Save the current page before navigation in case we need to revert
        var previousPage = currentPageNumber;
        
        rendition.next().then(function() {
            // Wait slightly to let the rendition's locationChanged event fire
            // which will have updated currentLocation and currentPageNumber
            setTimeout(function() {
                // If location update didn't happen properly, manually increment
                if (currentPageNumber === previousPage) {
                    // Increment our tracked page number, but don't exceed total pages
                    currentPageNumber = Math.min(totalPageCount, currentPageNumber + 1);
                }
                
                // Calculate and directly update slider position based on current page
                var sliderEl = document.getElementById('progress-slider');
                if (sliderEl && book.spine && book.spine.items) {
                    var progress = (currentPageNumber - 1) / Math.max(1, book.spine.items.length - 1);
                    var newValue = Math.round(progress * 100);
                    if (parseInt(sliderEl.value, 10) !== newValue) {
                        sliderEl.value = newValue;
                    }
                }
                
                // Update page display and progress info
                updatePageDisplay();
                updateProgressInfo();
            }, 50);
        }).catch(function(error) {
            console.error("Error navigating to next page:", error);
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
        
        // Save the current page before navigation in case we need to revert
        var previousPage = currentPageNumber;
        
        rendition.prev().then(function() {
            // Wait slightly to let the rendition's locationChanged event fire
            // which will have updated currentLocation and currentPageNumber
            setTimeout(function() {
                // If location update didn't happen properly, manually decrement
                if (currentPageNumber === previousPage) {
                    // Decrement our tracked page number, but don't go below 1
                    currentPageNumber = Math.max(1, currentPageNumber - 1);
                }
                
                // Calculate and directly update slider position based on current page
                var sliderEl = document.getElementById('progress-slider');
                if (sliderEl && book.spine && book.spine.items) {
                    var progress = (currentPageNumber - 1) / Math.max(1, book.spine.items.length - 1);
                    var newValue = Math.round(progress * 100);
                    if (parseInt(sliderEl.value, 10) !== newValue) {
                        sliderEl.value = newValue;
                    }
                }
                
                // Update page display and progress info
                updatePageDisplay();
                updateProgressInfo();
            }, 50);
        }).catch(function(error) {
            console.error("Error navigating to previous page:", error);
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
            var data = e.target.result; // ArrayBuffer format
            console.log('EPUB file read as:', typeof data);
            if (data instanceof ArrayBuffer) {
                console.log('EPUB data size:', data.byteLength, 'bytes');
            }
            
            var tempBook = ePub();
            
            // Safety check for data
            if (!data || (typeof data === 'string' && data.length < 10)) {
                console.error('Invalid EPUB data received');
                callback(null, 'Invalid EPUB data: File appears to be empty or corrupted');
                return;
            }
            
            // Ensure we have appropriate binary data
            if (typeof data === 'string') {
                console.warn('EPUB data is string, converting to ArrayBuffer...');
                
                // Handle Base64 encoded data (UEsDB... prefix)
                if (data.indexOf('UEsDB') === 0) {
                    console.log('Detected Base64 encoded data in parseEpub');
                    try {
                        // Try to decode as Base64
                        try {
                            var binaryString = atob(data);
                            var bytes = new Uint8Array(binaryString.length);
                            for (var i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            data = bytes.buffer;
                            console.log('Successfully converted Base64 to ArrayBuffer in parseEpub');
                        } catch (decodeError) {
                            console.error('Base64 decode failed in parseEpub:', decodeError);
                            // Create a blob and URL as fallback
                            var blob = new Blob([data], {type: 'application/epub+zip'});
                            data = URL.createObjectURL(blob);
                            console.log('Created blob URL from Base64 data in parseEpub');
                        }
                    } catch (e) {
                        console.error('Error handling UEsDB data in parseEpub:', e);
                    }
                }
                // Regular binary string starting with PK
                else if (data.indexOf('PK') === 0) {
                    try {
                        var len = data.length;
                        var bytes = new Uint8Array(len);
                        for (var i = 0; i < len; i++) {
                            bytes[i] = data.charCodeAt(i);
                        }
                        data = bytes.buffer;
                        console.log('Converted binary string to ArrayBuffer for parsing');
                    } catch (e) {
                        console.error('Error converting string to ArrayBuffer:', e);
                    }
                }
                // For other string formats, try creating a blob
                else {
                    try {
                        var blob = new Blob([data], {type: 'application/epub+zip'});
                        data = URL.createObjectURL(blob);
                        console.log('Created blob URL from string data in parseEpub');
                    } catch (e) {
                        console.error('Error creating blob in parseEpub:', e);
                    }
                }
            }
            
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
                        data: data, // Store the ArrayBuffer directly
                        added: new Date().getTime(),
                        position: null,
                        lastRead: null,
                        locations: null
                    };
                    
                    // Log book information
                    console.log('Parsed EPUB book:', bookData.title, 'by', bookData.author);
                    console.log('Book data type:', typeof bookData.data);
                    if (bookData.data instanceof ArrayBuffer) {
                        console.log('Book data is ArrayBuffer, size:', bookData.data.byteLength);
                    }
                    
                    // Get cover if available
                    tempBook.loaded.cover
                        .then(function(coverUrl) {
                            if (coverUrl) {
                                // Extract the raw cover data to store with the book
                                var xhr = new XMLHttpRequest();
                                xhr.open('GET', coverUrl, true);
                                xhr.responseType = 'blob';
                                xhr.onload = function() {
                                    if (xhr.status === 200) {
                                        var reader = new FileReader();
                                        reader.onloadend = function() {
                                            bookData.cover = reader.result;
                                            callback(bookData);
                                        };
                                        reader.readAsDataURL(xhr.response);
                                    } else {
                                        callback(bookData);
                                    }
                                };
                                xhr.onerror = function() {
                                    callback(bookData);
                                };
                                xhr.send();
                            } else {
                                callback(bookData);
                            }
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
        
        // Read file as ArrayBuffer to handle binary data properly
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
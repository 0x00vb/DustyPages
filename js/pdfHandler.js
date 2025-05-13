/**
 * PDF Handler Module for RustyPages
 * Handles rendering and navigation of PDF books
 * Compatible with iOS 9 Safari
 * Uses pdf.js (lightweight version)
 */

var PDFHandler = (function() {
    var pdfDoc = null;
    var currentPage = 1;
    var totalPages = 0;
    var container = null;
    var canvas = null;
    var context = null;
    var currentBook = null;
    var pageRendering = false;
    var pageNumPending = null;
    var scale = 1.0;
    var progressUpdating = false;
    
    // Initialize PDF.js library
    if (typeof pdfjsLib === 'undefined') {
        // If not loaded, set up with the global object
        window.pdfjsLib = window.pdfjsLib || window.PDFJS;
    }
    
    // Check if PDF.js is available
    if (typeof pdfjsLib === 'undefined') {
        console.error('PDF.js library not found.');
    } else {
        // Configure worker URL if needed
        if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/lib/pdf.worker.min.js';
        } else if (pdfjsLib.workerSrc) {
            pdfjsLib.workerSrc = 'js/lib/pdf.worker.min.js';
        }
    }
    
    /**
     * Initialize the PDF reader with a book file
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
            
            // Create canvas for PDF rendering
            canvas = document.createElement('canvas');
            canvas.className = 'pdf-canvas';
            container.appendChild(canvas);
            context = canvas.getContext('2d');
            
            // Load PDF document - use pdfjsLib instead of PDFJS
            pdfjsLib.getDocument(bookData.data).promise.then(function(pdf) {
                pdfDoc = pdf;
                totalPages = pdf.numPages;
                
                // Update total pages display
                var totalPagesEl = document.getElementById('total-pages');
                if (totalPagesEl) {
                    totalPagesEl.textContent = totalPages;
                }
                
                // Load initial page (either saved position or first page)
                if (bookData.position && !isNaN(parseInt(bookData.position, 10))) {
                    currentPage = Math.max(1, Math.min(totalPages, parseInt(bookData.position, 10)));
                } else {
                    currentPage = 1;
                }
                
                // Initialize progress slider
                initProgressSlider();
                
                // Render initial page
                renderPage(currentPage);
                
                // Add event listeners
                addEventListeners();
                
                if (callback) callback(true);
            }).catch(function(error) {
                console.log('Error loading PDF:', error);
                if (callback) callback(false, 'Failed to load PDF: ' + error);
            });
        } catch (e) {
            console.log('Error initializing PDF reader:', e);
            if (callback) callback(false, 'Error initializing PDF reader: ' + e.message);
        }
    }
    
    /**
     * Initialize progress slider
     */
    function initProgressSlider() {
        var slider = document.getElementById('progress-slider');
        if (!slider) return;
        
        // Set initial value based on current page
        updateProgressInfo();
        
        // Add input event for real-time updates while dragging
        slider.addEventListener('input', function() {
            var value = parseInt(slider.value, 10);
            
            // Update percentage label
            updateProgressLabel(value);
            
            // Show preview of page during drag
            var pageNum = Math.max(1, Math.min(Math.round((value / 100) * totalPages), totalPages));
            var pageEl = document.getElementById('current-page');
            if (pageEl) {
                pageEl.textContent = pageNum;
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
     * Jump to position in the PDF based on slider percentage
     */
    function jumpToPosition(percent) {
        if (!pdfDoc) return;
        
        // Calculate the page number from percentage
        var pageNum = Math.max(1, Math.min(Math.round((percent / 100) * totalPages), totalPages));
        
        // Update the page display immediately for responsive UI
        var pageEl = document.getElementById('current-page');
        if (pageEl) {
            pageEl.textContent = pageNum;
        }
        
        // Go to that page
        if (pageNum !== currentPage) {
            queueRenderPage(pageNum);
        }
    }
    
    /**
     * Update progress information
     */
    function updateProgressInfo() {
        if (!pdfDoc || progressUpdating) return;
        
        progressUpdating = true;
        
        try {
            var percentEl = document.getElementById('progress-percent');
            var sliderEl = document.getElementById('progress-slider');
            var pageEl = document.getElementById('current-page');
            
            // Calculate progress - ensure we're using valid values
            // When only 1 page, progress should be 100% at that page
            var progress = 0;
            if (totalPages <= 1) {
                progress = 100;
            } else {
                // For multiple pages, calculate progress percentage
                progress = ((currentPage - 1) / Math.max(1, totalPages - 1)) * 100;
            }
            
            // Ensure progress is a valid number
            if (isNaN(progress) || !isFinite(progress)) {
                progress = 0;
            }
            
            // Ensure progress is between 0 and 100
            progress = Math.max(0, Math.min(100, progress));
            
            // Update progress percentage display
            if (percentEl) {
                percentEl.textContent = Math.round(progress) + '%';
            }
            
            // Update slider 
            if (sliderEl) {
                // Only update if the value has actually changed
                var newValue = Math.round(progress);
                if (parseInt(sliderEl.value, 10) !== newValue) {
                    sliderEl.value = newValue;
                    
                    // Trigger an input event to ensure UI is updated
                    var event = document.createEvent('HTMLEvents');
                    event.initEvent('input', false, true);
                    sliderEl.dispatchEvent(event);
                }
            }
            
            // Update page display - ensure the displayed page matches the internal state
            if (pageEl && pageEl.textContent !== currentPage.toString()) {
                pageEl.textContent = currentPage;
            }
            
            // Update the pagination buttons if Reader module is available
            if (typeof Reader !== 'undefined' && Reader.updatePaginationButtons) {
                Reader.updatePaginationButtons();
            }
        } finally {
            progressUpdating = false;
        }
    }
    
    /**
     * Render a specific page
     */
    function renderPage(pageNum) {
        pageRendering = true;
        
        // Ensure page number is valid
        pageNum = Math.max(1, Math.min(totalPages, pageNum));
        
        // Update current page
        currentPage = pageNum;
        
        // Update progress info immediately - this updates the slider position
        updateProgressInfo();
        
        // Get the page
        pdfDoc.getPage(pageNum).then(function(page) {
            // Determine scale to fit width
            var viewport = page.getViewport({scale: scale});
            var containerWidth = container.clientWidth;
            var containerHeight = container.clientHeight;
            
            // Adjust scale to fit container width
            var scaleX = containerWidth / viewport.width;
            var scaleY = containerHeight / viewport.height;
            var fitScale = Math.min(scaleX, scaleY);
            
            // Update viewport with new scale
            viewport = page.getViewport({scale: fitScale * scale});
            
            // Set canvas height and width to match viewport
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Center canvas
            canvas.style.marginLeft = Math.max(0, (containerWidth - canvas.width) / 2) + 'px';
            
            // Render PDF page into canvas context
            var renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            var renderTask = page.render(renderContext);
            
            renderTask.promise.then(function() {
                pageRendering = false;
                
                // If another page rendering is pending, render that page
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
                
                // Save progress if we have a current book
                if (currentBook && currentBook.id) {
                    Storage.updateBookProgress(currentBook.id, currentPage);
                }
                
                // Update progress info again after rendering is complete
                updateProgressInfo();
            });
        }).catch(function(error) {
            console.error('Error rendering PDF page:', error);
            pageRendering = false;
            
            // If another page rendering is pending, try that page
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    }
    
    /**
     * Queue rendering of a page if another is already in progress
     */
    function queueRenderPage(pageNum) {
        if (pageRendering) {
            pageNumPending = pageNum;
        } else {
            renderPage(pageNum);
        }
    }
    
    /**
     * Add event listeners for navigation
     */
    function addEventListeners() {
        // Add keyboard navigation
        document.addEventListener('keydown', function(e) {
            if (e.keyCode === 37) { // Left arrow
                prevPage();
            } else if (e.keyCode === 39) { // Right arrow
                nextPage();
            }
        });
        
        // Add touch areas for navigation
        createTouchAreas();
        
        // Add resize listener to adjust rendering on window resize
        window.addEventListener('resize', function() {
            // Only re-render if we have a current page
            if (currentPage && !pageRendering) {
                // Wait a bit for resize to finish
                setTimeout(function() {
                    renderPage(currentPage);
                }, 200);
            }
        });
    }
    
    /**
     * Create touch areas for tapping left and right
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
        if (pdfDoc === null || currentPage >= totalPages) {
            return; // Already at the end, don't go further
        }
        
        // Update current page safely
        currentPage = Math.min(totalPages, currentPage + 1);
        
        // Directly update slider based on current page
        var sliderEl = document.getElementById('progress-slider');
        if (sliderEl) {
            var progress = ((currentPage - 1) / Math.max(1, totalPages - 1)) * 100;
            sliderEl.value = Math.round(progress);
        }
        
        // Render the new page, which will update the progress info
        queueRenderPage(currentPage);
        
        // Also update progress immediately for responsive UI
        updateProgressInfo();
    }
    
    /**
     * Go to the previous page
     */
    function prevPage() {
        if (pdfDoc === null || currentPage <= 1) {
            return; // Already at the beginning, don't go further
        }
        
        // Update current page safely
        currentPage = Math.max(1, currentPage - 1);
        
        // Directly update slider based on current page
        var sliderEl = document.getElementById('progress-slider');
        if (sliderEl) {
            var progress = ((currentPage - 1) / Math.max(1, totalPages - 1)) * 100;
            sliderEl.value = Math.round(progress);
        }
        
        // Render the new page, which will update the progress info
        queueRenderPage(currentPage);
        
        // Also update progress immediately for responsive UI
        updateProgressInfo();
    }
    
    /**
     * Change zoom level
     */
    function changeZoom(newScale) {
        if (pdfDoc === null) return;
        
        scale = newScale;
        queueRenderPage(currentPage);
    }
    
    /**
     * Apply settings (some settings may not apply to PDF)
     */
    function applySettings(settings) {
        // PDFs don't support most theme settings
        // We could apply some settings like background color to the container
        if (container) {
            // Apply theme background to container
            if (settings.theme === 'light') {
                container.style.backgroundColor = '#ffffff';
            } else if (settings.theme === 'sepia') {
                container.style.backgroundColor = '#f8f2e3';
            } else if (settings.theme === 'dark') {
                container.style.backgroundColor = '#262626';
            }
        }
    }
    
    /**
     * Unload the PDF and cleanup resources
     */
    function unload() {
        if (pdfDoc) {
            pdfDoc.destroy();
            pdfDoc = null;
        }
        
        if (container) {
            container.innerHTML = '';
        }
        
        canvas = null;
        context = null;
        currentPage = 1;
        totalPages = 0;
        currentBook = null;
        pageRendering = false;
        pageNumPending = null;
        scale = 1.0;
    }
    
    /**
     * Parse a PDF file and return book metadata
     */
    function parsePdf(file, callback) {
        var reader = new FileReader();
        
        reader.onload = function(e) {
            var data = e.target.result; // ArrayBuffer format
            
            if (!pdfjsLib) {
                callback(null, 'PDF.js library not loaded correctly');
                return;
            }
            
            console.log('PDF data type:', typeof data);
            if (data instanceof ArrayBuffer) {
                console.log('PDF data is ArrayBuffer, size:', data.byteLength);
            }
            
            // Try to get PDF metadata - use pdfjsLib instead of PDFJS
            pdfjsLib.getDocument(data).promise.then(function(pdf) {
                pdf.getMetadata().then(function(metadata) {
                    var info = metadata.info || {};
                    var id = 'pdf_' + new Date().getTime();
                    
                    var bookData = {
                        id: id,
                        title: info.Title || file.name.replace('.pdf', ''),
                        author: info.Author || 'Unknown',
                        format: 'pdf',
                        data: data, // Store the ArrayBuffer directly
                        added: new Date().getTime(),
                        position: 1,
                        lastRead: null
                    };
                    
                    // Log book information
                    console.log('Parsed PDF book:', bookData.title, 'by', bookData.author);
                    
                    // Get first page as cover thumbnail
                    pdf.getPage(1).then(function(page) {
                        var viewport = page.getViewport({scale: 0.2}); // Small scale for thumbnail
                        var coverCanvas = document.createElement('canvas');
                        var coverContext = coverCanvas.getContext('2d');
                        coverCanvas.height = viewport.height;
                        coverCanvas.width = viewport.width;
                        
                        var renderTask = page.render({
                            canvasContext: coverContext,
                            viewport: viewport
                        });
                        
                        renderTask.promise.then(function() {
                            try {
                                // Use a higher quality setting for the thumbnail
                                bookData.cover = coverCanvas.toDataURL('image/jpeg', 0.8);
                                callback(bookData);
                            } catch (e) {
                                // Ignore errors with toDataURL (can happen with tainted canvas)
                                console.log('Could not create thumbnail:', e);
                                callback(bookData);
                            }
                        }).catch(function(error) {
                            console.log('Error rendering PDF cover:', error);
                            callback(bookData);
                        });
                    }).catch(function(error) {
                        // If we couldn't get the cover, return the book data anyway
                        console.log('Could not get PDF first page for cover:', error);
                        callback(bookData);
                    });
                }).catch(function() {
                    // If we couldn't get metadata, create basic book data
                    var id = 'pdf_' + new Date().getTime();
                    var bookData = {
                        id: id,
                        title: file.name.replace('.pdf', ''),
                        author: 'Unknown',
                        format: 'pdf',
                        data: data, // Store the ArrayBuffer directly
                        added: new Date().getTime(),
                        position: 1,
                        lastRead: null
                    };
                    console.log('Created PDF book with basic metadata due to error');
                    callback(bookData);
                });
            }).catch(function(error) {
                console.log('Error parsing PDF:', error);
                callback(null, 'Failed to parse PDF file: ' + error);
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
        changeZoom: changeZoom,
        unload: unload,
        parsePdf: parsePdf,
        applySettings: applySettings,
        jumpToPosition: jumpToPosition
    };
})(); 
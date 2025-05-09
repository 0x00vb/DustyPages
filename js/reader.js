/**
 * Reader module for RustyPages
 * Handles EPUB and PDF rendering and navigation
 */

var Reader = (function() {
    // Current book and renderer
    var currentBook = null;
    var currentFormat = null;
    var rendition = null;
    var pdfDocument = null;
    var currentPage = 1;
    var totalPages = 0;
    
    // DOM elements
    var readerContainer;
    var bookTitleElement;
    var currentPageElement;
    var totalPagesElement;
    var prevBtn;
    var nextBtn;
    var settingsBtn;
    var backBtn;
    var settingsPanel;
    
    // Settings elements
    var fontIncreaseBtn;
    var fontDecreaseBtn;
    var fontSizeValueElement;
    var fontFamilyButtons;
    var themeButtons;
    var closeSettingsBtn;
    var pdfNightModeCheckbox;
    var pdfSettingsGroup;
    var letterSpacingSlider;
    var letterSpacingValue;
    var lineHeightSlider;
    var lineHeightValue;
    
    // Current settings
    var currentSettings = {
        theme: 'light',
        fontSize: 100, // percentage
        fontFamily: 'serif',
        pdfNightMode: false,
        letterSpacing: 0,
        lineHeight: 160
    };
    
    // Initialize the reader module
    function init() {
        // Get DOM elements
        readerContainer = document.getElementById('reader-container');
        bookTitleElement = document.getElementById('book-title');
        currentPageElement = document.getElementById('current-page');
        totalPagesElement = document.getElementById('total-pages');
        prevBtn = document.getElementById('prev-btn');
        nextBtn = document.getElementById('next-btn');
        settingsBtn = document.getElementById('settings-btn');
        backBtn = document.getElementById('back-btn');
        settingsPanel = document.getElementById('settings-panel');
        
        // Settings elements
        fontIncreaseBtn = document.getElementById('font-increase');
        fontDecreaseBtn = document.getElementById('font-decrease');
        fontSizeValueElement = document.getElementById('font-size-value');
        fontFamilyButtons = document.querySelectorAll('.font-btn');
        themeButtons = document.querySelectorAll('.theme-btn');
        closeSettingsBtn = document.getElementById('close-settings');
        pdfNightModeCheckbox = document.getElementById('pdf-night-mode');
        pdfSettingsGroup = document.getElementById('pdf-settings');
        letterSpacingSlider = document.getElementById('letter-spacing');
        letterSpacingValue = document.getElementById('letter-spacing-value');
        lineHeightSlider = document.getElementById('line-height');
        lineHeightValue = document.getElementById('line-height-value');
        
        // Set up event listeners
        if (prevBtn) {
            prevBtn.addEventListener('click', previous);
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', next);
        }
        
        if (backBtn) {
            backBtn.addEventListener('click', closeReader);
        }
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', toggleSettings);
        }
        
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', toggleSettings);
        }
        
        if (fontIncreaseBtn) {
            fontIncreaseBtn.addEventListener('click', increaseFontSize);
        }
        
        if (fontDecreaseBtn) {
            fontDecreaseBtn.addEventListener('click', decreaseFontSize);
        }
        
        // Font family buttons
        fontFamilyButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                changeFontFamily(btn.getAttribute('data-font'));
            });
        });
        
        // Theme buttons
        themeButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                changeTheme(btn.getAttribute('data-theme'));
            });
        });
        
        // PDF night mode
        if (pdfNightModeCheckbox) {
            pdfNightModeCheckbox.addEventListener('change', function() {
                togglePdfNightMode(this.checked);
            });
        }
        
        // Check for empty-library import button
        var emptyImportBtn = document.getElementById('empty-import-btn');
        if (emptyImportBtn) {
            emptyImportBtn.addEventListener('click', function() {
                document.getElementById('file-input').click();
            });
        }
        
        // Touch zones for navigation
        setupTouchZones();
        
        // Load saved settings
        loadSettings();
        
        // Letter Spacing event listener
        if (letterSpacingSlider) {
            letterSpacingSlider.addEventListener('input', function() {
                var value = parseInt(this.value);
                setLetterSpacing(value);
            });
        }
        
        // Line Height event listener
        if (lineHeightSlider) {
            lineHeightSlider.addEventListener('input', function() {
                var value = parseInt(this.value);
                setLineHeight(value);
            });
        }
    }
    
    /**
     * Load settings from storage
     */
    function loadSettings() {
        Storage.getSettings()
            .then(function(settings) {
                currentSettings = settings;
                applySettings();
            })
            .catch(function(error) {
                console.error('Failed to load settings:', error);
            });
    }
    
    /**
     * Save settings to storage
     */
    function saveSettings() {
        Storage.saveSettings(currentSettings)
            .catch(function(error) {
                console.error('Failed to save settings:', error);
            });
    }
    
    /**
     * Apply current settings to the reader
     */
    function applySettings() {
        // Safari iOS 9 compatibility - fix theme application
        var isIOS9Safari = document.documentElement.classList.contains('ios-9');
        
        // Apply theme
        document.body.className = currentSettings.theme + '-theme';
        if (isIOS9Safari) {
            // Keep iOS-9 class for Safari iOS 9
            document.body.classList.add('ios-9');
        }
        
        if (currentSettings.pdfNightMode && currentFormat === 'pdf' && currentSettings.theme === 'dark') {
            document.body.classList.add('night-reading');
        } else {
            document.body.classList.remove('night-reading');
        }
        
        // Update theme buttons
        themeButtons.forEach(function(btn) {
            if (btn.getAttribute('data-theme') === currentSettings.theme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Apply font size
        fontSizeValueElement.textContent = currentSettings.fontSize + '%';
        
        // Apply font family
        fontFamilyButtons.forEach(function(btn) {
            if (btn.getAttribute('data-font') === currentSettings.fontFamily) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Update PDF night mode checkbox
        if (pdfNightModeCheckbox) {
            pdfNightModeCheckbox.checked = currentSettings.pdfNightMode;
        }
        
        // Show/hide PDF settings based on current format
        if (pdfSettingsGroup) {
            pdfSettingsGroup.style.display = currentFormat === 'pdf' ? 'block' : 'none';
        }
        
        // Apply letter spacing
        if (letterSpacingSlider && letterSpacingValue) {
            letterSpacingSlider.value = currentSettings.letterSpacing;
            letterSpacingValue.textContent = currentSettings.letterSpacing + 'px';
        }
        
        // Apply line height
        if (lineHeightSlider && lineHeightValue) {
            lineHeightSlider.value = currentSettings.lineHeight;
            lineHeightValue.textContent = (currentSettings.lineHeight / 100).toFixed(1);
        }
        
        // Apply to current book if it's an EPUB
        if (currentFormat === 'epub' && rendition) {
            // Apply font size
            rendition.themes.fontSize(currentSettings.fontSize + '%');
            
            // Apply font family
            rendition.themes.font(currentSettings.fontFamily);
            
            // Create and apply theme styles
            var themeStyles = {};
            
            // Light theme styles (default)
            themeStyles.light = {
                body: {
                    color: '#333',
                    background: '#ffffff'
                }
            };
            
            // Sepia theme styles
            themeStyles.sepia = {
                body: {
                    color: '#5b4636',
                    background: '#f8f1e3'
                },
                'a': {
                    color: '#8b5a2b !important'
                },
                'h1, h2, h3, h4, h5, h6': {
                    color: '#5b4636 !important'
                },
                'img, svg': {
                    filter: 'sepia(0.4) brightness(0.95)'
                }
            };
            
            // Dark theme styles
            themeStyles.dark = {
                body: {
                    color: '#f0f0f0',
                    background: '#1a1a1a'
                },
                'a, h1, h2, h3, h4, h5, h6': {
                    color: '#5c9eff !important'
                },
                'img, svg': {
                    filter: 'brightness(0.85)'
                }
            };
            
            // Register and apply the themes
            Object.keys(themeStyles).forEach(function(theme) {
                rendition.themes.register(theme, themeStyles[theme]);
            });
            
            rendition.themes.select(currentSettings.theme);
            
            // Apply letter spacing and line height
            var css = "*{letter-spacing: " + currentSettings.letterSpacing + "px !important;}";
            css += "p, div{line-height: " + (currentSettings.lineHeight / 100) + " !important;}";
            rendition.themes.override(css);
        }
        
        // Apply to current book if it's a PDF
        if (currentFormat === 'pdf' && currentSettings.theme === 'dark' && currentSettings.pdfNightMode) {
            applyPdfNightMode(true);
        } else if (currentFormat === 'pdf') {
            applyPdfNightMode(false);
        }
    }
    
    /**
     * Change the theme
     */
    function changeTheme(theme) {
        currentSettings.theme = theme;
        applySettings();
        saveSettings();
    }
    
    /**
     * Increase font size
     */
    function increaseFontSize() {
        if (currentSettings.fontSize < 200) {
            currentSettings.fontSize += 10;
            applySettings();
            saveSettings();
        }
    }
    
    /**
     * Decrease font size
     */
    function decreaseFontSize() {
        if (currentSettings.fontSize > 70) {
            currentSettings.fontSize -= 10;
            applySettings();
            saveSettings();
        }
    }
    
    /**
     * Change font family
     */
    function changeFontFamily(fontFamily) {
        currentSettings.fontFamily = fontFamily;
        applySettings();
        saveSettings();
    }
    
    /**
     * Toggle PDF night mode
     */
    function togglePdfNightMode(enabled) {
        currentSettings.pdfNightMode = enabled;
        applySettings();
        saveSettings();
    }
    
    /**
     * Apply PDF night mode
     */
    function applyPdfNightMode(enabled) {
        var canvas = document.querySelector('.pdf-canvas-container canvas');
        if (!canvas) return;
        
        if (enabled) {
            // Apply night mode effect to canvas
            canvas.style.filter = 'invert(1) hue-rotate(180deg)';
        } else {
            // Remove night mode effect
            canvas.style.filter = 'none';
        }
    }
    
    /**
     * Toggle settings panel
     */
    function toggleSettings() {
        settingsPanel.classList.toggle('active');
    }
    
    /**
     * Set up touch zones for navigation
     */
    function setupTouchZones() {
        if (!readerContainer) return;
        
        // Create touch zones
        var leftZone = document.createElement('div');
        leftZone.className = 'touch-zone left';
        
        var rightZone = document.createElement('div');
        rightZone.className = 'touch-zone right';
        
        // Add touch events
        leftZone.addEventListener('click', previous);
        rightZone.addEventListener('click', next);
        
        readerContainer.appendChild(leftZone);
        readerContainer.appendChild(rightZone);
    }
    
    /**
     * Load a book into the reader
     */
    function loadBook(book) {
        currentBook = book;
        currentFormat = book.format;
        
        // Clear reader container
        readerContainer.innerHTML = '';
        
        // Set book title
        bookTitleElement.textContent = book.title;
        
        // Load based on format
        if (book.format === 'epub') {
            loadEpub(book);
        } else if (book.format === 'pdf') {
            loadPdf(book);
        } else {
            alert('Unsupported book format.');
            closeReader();
        }
        
        // Apply settings based on format
        applySettings();
    }
    
    /**
     * Load an EPUB book
     */
    function loadEpub(book) {
        try {
            // Check for iOS 9 Safari to use simpler rendering
            var isIOS9Safari = document.documentElement.classList.contains('ios-9');
            
            // Create new book with epub.js
            var epubBook = ePub();
            epubBook.open(book.data);
            
            // Create rendition with optimized settings for iOS 9
            var renditionOptions = {
                width: '100%',
                height: '100%',
                spread: 'none',
                flow: 'paginated',
                minSpreadWidth: 800
            };
            
            // Use simpler rendering for iOS 9 Safari
            if (isIOS9Safari) {
                // Optimize for iOS 9 Safari
                renditionOptions.flow = 'scrolled-doc'; // Use simpler flow mode
                renditionOptions.manager = 'continuous'; // Use continuous rendering
                renditionOptions.gap = 0; // No gap between pages
                
                // Simplify the reader container
                readerContainer.style.overflowY = 'auto';
                readerContainer.style.WebkitOverflowScrolling = 'touch';
            }
            
            // Create rendition
            rendition = epubBook.renderTo(readerContainer, renditionOptions);
            
            // Apply current settings
            rendition.themes.fontSize(currentSettings.fontSize + '%');
            rendition.themes.font(currentSettings.fontFamily);
            
            // Special handling for iOS 9 - retry rendering if failed
            if (isIOS9Safari) {
                var renderAttempts = 0;
                var maxAttempts = 3;
                
                function attemptRender() {
                    renderAttempts++;
                    try {
                        if (book.currentLocation) {
                            rendition.display(book.currentLocation);
                        } else {
                            rendition.display();
                        }
                    } catch (e) {
                        console.warn('EPUB rendering attempt ' + renderAttempts + ' failed:', e);
                        if (renderAttempts < maxAttempts) {
                            setTimeout(attemptRender, 500);
                        } else {
                            console.error('Failed to render EPUB after multiple attempts');
                            alert('Unable to render this EPUB book on your device. Please try a different book.');
                            closeReader();
                        }
                    }
                }
                
                attemptRender();
            } else {
                // Normal rendering for other browsers
                if (book.currentLocation) {
                    rendition.display(book.currentLocation);
                } else {
                    rendition.display();
                }
            }
            
            // Get total pages (approximately)
            epubBook.loaded.navigation.then(function(nav) {
                if (nav.toc && nav.toc.length > 0) {
                    totalPages = nav.toc.length;
                } else {
                    // Fallback if TOC not available
                    totalPages = 1;
                    epubBook.spine.each(function() {
                        totalPages++;
                    });
                }
                totalPagesElement.textContent = totalPages;
            });
            
            // Update page info on location change
            rendition.on('relocated', function(location) {
                currentPage = location.start.displayed.page;
                currentPageElement.textContent = currentPage;
                
                // Calculate progress
                var progress = location.start.percentage;
                
                // Save progress
                Storage.updateProgress(book.id, progress, location.start.cfi)
                    .catch(function(error) {
                        console.error('Failed to save reading progress:', error);
                    });
            });
            
            // Handle window resize
            window.addEventListener('resize', function() {
                rendition.resize();
            });
        } catch (e) {
            console.error('Failed to load EPUB:', e);
            alert('Failed to load EPUB book. It may be corrupted or not compatible with your device.');
            closeReader();
        }
    }
    
    /**
     * Load a PDF book
     */
    function loadPdf(book) {
        try {
            // Check for iOS 9 Safari
            var isIOS9Safari = document.documentElement.classList.contains('ios-9');
            
            // Check if PDF.js is available
            if (typeof pdfjsLib === 'undefined') {
                alert('PDF reader is not available. Please make sure pdf.js is properly loaded.');
                console.error('PDF.js library not found. Make sure it is properly included.');
                closeReader();
                return;
            }
            
            // Create PDF viewer container with simpler structure for iOS 9
            var viewerContainer = document.createElement('div');
            viewerContainer.className = 'pdf-viewer';
            viewerContainer.style.width = '100%';
            viewerContainer.style.height = '100%';
            viewerContainer.style.position = 'relative';
            
            // For iOS 9, use simpler overflow handling
            if (isIOS9Safari) {
                viewerContainer.style.overflow = 'scroll';
                viewerContainer.style.WebkitOverflowScrolling = 'touch';
            } else {
                viewerContainer.style.overflow = 'auto';
            }
            
            var canvasContainer = document.createElement('div');
            canvasContainer.className = 'pdf-canvas-container';
            canvasContainer.style.width = '100%';
            canvasContainer.style.position = 'relative';
            
            var canvas = document.createElement('canvas');
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto';
            
            // Optimized handling for iOS 9
            if (isIOS9Safari) {
                // Use a smaller scale for better performance
                canvas.style.maxWidth = '100%';
                
                // Add touch scroll hint for iOS 9
                var scrollHint = document.createElement('div');
                scrollHint.style.position = 'absolute';
                scrollHint.style.bottom = '10px';
                scrollHint.style.left = '0';
                scrollHint.style.width = '100%';
                scrollHint.style.textAlign = 'center';
                scrollHint.style.padding = '5px';
                scrollHint.style.color = '#666';
                scrollHint.style.fontSize = '12px';
                scrollHint.innerHTML = 'Scroll to read more';
                scrollHint.style.opacity = '0.7';
                canvasContainer.appendChild(scrollHint);
                
                // Hide hint after 5 seconds
                setTimeout(function() {
                    scrollHint.style.display = 'none';
                }, 5000);
            }
            
            canvasContainer.appendChild(canvas);
            viewerContainer.appendChild(canvasContainer);
            readerContainer.appendChild(viewerContainer);
            
            // Make sure worker is configured
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/lib/pdf.worker.min.js';
            }
            
            // For iOS 9, use a more reliable approach with smaller chunks
            var pdfOptions = isIOS9Safari 
                ? { data: book.data, disableRange: true, disableStream: true } 
                : { data: book.data };
            
            // Initialize PDF.js
            pdfjsLib.getDocument(pdfOptions).promise
                .then(function(pdf) {
                    pdfDocument = pdf;
                    totalPages = pdf.numPages;
                    totalPagesElement.textContent = totalPages;
                    
                    // Set initial page (using saved progress)
                    currentPage = book.progress ? Math.max(1, Math.round(book.progress * totalPages)) : 1;
                    
                    // Add a small delay for iOS 9 Safari
                    if (isIOS9Safari) {
                        setTimeout(function() {
                            renderPage(currentPage);
                        }, 100);
                    } else {
                        renderPage(currentPage);
                    }
                    
                    // Apply settings after PDF is loaded
                    applySettings();
                })
                .catch(function(error) {
                    console.error('Failed to load PDF:', error);
                    alert('Failed to load PDF book. It may be corrupted or too large for your device.');
                    closeReader();
                });
        } catch (e) {
            console.error('Failed to load PDF:', e);
            alert('Failed to load PDF book. The PDF reader may not be supported on your device.');
            closeReader();
        }
    }
    
    /**
     * Render a specific PDF page with iOS 9 optimization
     */
    function renderPage(pageNumber) {
        if (!pdfDocument) return;
        
        // Update current page
        currentPage = pageNumber;
        currentPageElement.textContent = currentPage;
        
        // Calculate progress
        var progress = (currentPage - 1) / (totalPages - 1);
        if (isNaN(progress)) progress = 0;
        
        // Save progress
        if (currentBook) {
            Storage.updateProgress(currentBook.id, progress, currentPage)
                .catch(function(error) {
                    console.error('Failed to save reading progress:', error);
                });
        }
        
        // Get the canvas
        var canvas = document.querySelector('.pdf-canvas-container canvas');
        if (!canvas) return;
        
        var ctx = canvas.getContext('2d');
        
        // Clear the canvas first to avoid artifacts
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Check for iOS 9 Safari
        var isIOS9Safari = document.documentElement.classList.contains('ios-9');
        
        // Attempt to render the page with error handling
        function attemptRender() {
            // Get PDF page
            pdfDocument.getPage(pageNumber).then(function(page) {
                // Determine scale to fit the viewport
                var containerWidth = isIOS9Safari 
                    ? Math.min(screen.width, 768) - 20 // Optimize for iPad 2 (limit max width)
                    : readerContainer.clientWidth - 40; // Normal calculation
                
                var viewport = page.getViewport({ scale: 1 });
                var scale = containerWidth / viewport.width;
                
                // For iOS 9, use a slightly lower scale for better performance
                if (isIOS9Safari && scale > 1.2) {
                    scale = 1.2;
                }
                
                var scaledViewport = page.getViewport({ scale: scale });
                
                // Set canvas dimensions
                canvas.height = scaledViewport.height;
                canvas.width = scaledViewport.width;
                
                // Render PDF page
                var renderContext = {
                    canvasContext: ctx,
                    viewport: scaledViewport
                };
                
                page.render(renderContext).promise.then(function() {
                    // After rendering, apply night mode if needed
                    if (currentSettings.theme === 'dark' && currentSettings.pdfNightMode) {
                        applyPdfNightMode(true);
                    } else {
                        applyPdfNightMode(false);
                    }
                }).catch(function(error) {
                    console.error('Error rendering PDF page:', error);
                    
                    // For iOS 9 Safari, try one more time with lower quality
                    if (isIOS9Safari) {
                        console.log('Retrying PDF render with lower quality');
                        
                        // Create a simpler render context with lower quality
                        var simpleRenderContext = {
                            canvasContext: ctx,
                            viewport: scaledViewport,
                            intent: 'display', // Lower quality
                            renderInteractiveForms: false,
                            enableWebGL: false
                        };
                        
                        page.render(simpleRenderContext).promise.catch(function(finalError) {
                            console.error('Final PDF render attempt failed:', finalError);
                        });
                    }
                });
            }).catch(function(error) {
                console.error('Error getting PDF page:', error);
            });
        }
        
        // For iOS 9, add a small delay
        if (isIOS9Safari) {
            setTimeout(attemptRender, 50);
        } else {
            attemptRender();
        }
    }
    
    /**
     * Go to the previous page
     */
    function previous() {
        if (currentFormat === 'epub' && rendition) {
            rendition.prev();
        } else if (currentFormat === 'pdf' && pdfDocument) {
            if (currentPage > 1) {
                renderPage(currentPage - 1);
            }
        }
    }
    
    /**
     * Go to the next page
     */
    function next() {
        if (currentFormat === 'epub' && rendition) {
            rendition.next();
        } else if (currentFormat === 'pdf' && pdfDocument) {
            if (currentPage < totalPages) {
                renderPage(currentPage + 1);
            }
        }
    }
    
    /**
     * Close the reader and return to library
     */
    function closeReader() {
        // Reset reader state
        rendition = null;
        pdfDocument = null;
        currentBook = null;
        
        // Close settings panel if open
        settingsPanel.classList.remove('active');
        
        // Switch back to library view
        document.getElementById('reader-view').classList.remove('active');
        document.getElementById('library-view').classList.add('active');
    }
    
    /**
     * Set letter spacing
     */
    function setLetterSpacing(value) {
        currentSettings.letterSpacing = value;
        applySettings();
        saveSettings();
    }
    
    /**
     * Set line height
     */
    function setLineHeight(value) {
        currentSettings.lineHeight = value;
        applySettings();
        saveSettings();
    }
    
    return {
        init: init,
        loadBook: loadBook,
        changeTheme: changeTheme,
        changeFontFamily: changeFontFamily,
        increaseFontSize: increaseFontSize,
        decreaseFontSize: decreaseFontSize,
        togglePdfNightMode: togglePdfNightMode,
        setLetterSpacing: setLetterSpacing,
        setLineHeight: setLineHeight,
        previous: previous,
        next: next,
        closeReader: closeReader
    };
})(); 
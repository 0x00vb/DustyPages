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
        // Apply theme
        document.body.className = currentSettings.theme + '-theme';
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
            // Create new book with epub.js
            var epubBook = ePub();
            epubBook.open(book.data);
            
            // Create rendition
            rendition = epubBook.renderTo(readerContainer, {
                width: '100%',
                height: '100%',
                spread: 'none',
                flow: 'paginated',
                minSpreadWidth: 800
            });
            
            // Apply current settings
            rendition.themes.fontSize(currentSettings.fontSize + '%');
            rendition.themes.font(currentSettings.fontFamily);
            
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
            
            // Display
            if (book.currentLocation) {
                rendition.display(book.currentLocation);
            } else {
                rendition.display();
            }
            
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
            alert('Failed to load EPUB book. It may be corrupted.');
            closeReader();
        }
    }
    
    /**
     * Load a PDF book
     */
    function loadPdf(book) {
        try {
            // Check if PDF.js is available
            if (typeof pdfjsLib === 'undefined') {
                alert('PDF reader is not available. Please make sure pdf.js is properly loaded.');
                console.error('PDF.js library not found. Make sure it is properly included.');
                closeReader();
                return;
            }
            
            // Create PDF viewer container
            var viewerContainer = document.createElement('div');
            viewerContainer.className = 'pdf-viewer';
            viewerContainer.style.width = '100%';
            viewerContainer.style.height = '100%';
            viewerContainer.style.overflow = 'auto';
            viewerContainer.style.position = 'relative';
            
            var canvasContainer = document.createElement('div');
            canvasContainer.className = 'pdf-canvas-container';
            canvasContainer.style.width = '100%';
            canvasContainer.style.position = 'relative';
            
            var canvas = document.createElement('canvas');
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto';
            
            canvasContainer.appendChild(canvas);
            viewerContainer.appendChild(canvasContainer);
            readerContainer.appendChild(viewerContainer);
            
            // Make sure worker is configured
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/lib/pdf.worker.min.js';
            }
            
            // Initialize PDF.js
            pdfjsLib.getDocument({ data: book.data }).promise
                .then(function(pdf) {
                    pdfDocument = pdf;
                    totalPages = pdf.numPages;
                    totalPagesElement.textContent = totalPages;
                    
                    // Set initial page (using saved progress)
                    currentPage = book.progress ? Math.max(1, Math.round(book.progress * totalPages)) : 1;
                    renderPage(currentPage);
                    
                    // Apply settings after PDF is loaded
                    applySettings();
                })
                .catch(function(error) {
                    console.error('Failed to load PDF:', error);
                    alert('Failed to load PDF book. It may be corrupted.');
                    closeReader();
                });
        } catch (e) {
            console.error('Failed to load PDF:', e);
            alert('Failed to load PDF book. The PDF reader may not be supported on your device.');
            closeReader();
        }
    }
    
    /**
     * Render a specific PDF page
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
        
        // Get PDF page
        pdfDocument.getPage(pageNumber).then(function(page) {
            // Determine scale to fit the viewport
            var containerWidth = readerContainer.clientWidth - 40; // Account for padding
            var viewport = page.getViewport({ scale: 1 });
            var scale = containerWidth / viewport.width;
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
            });
        });
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
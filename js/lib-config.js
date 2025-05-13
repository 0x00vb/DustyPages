/**
 * Library Configuration and Compatibility Script
 * Ensures libraries are properly configured for iOS 9 compatibility
 */

(function() {
    // Configure PDF.js
    function configurePdfJs() {
        if (typeof window.PDFJS !== 'undefined') {
            // Set up global object for older PDF.js versions
            window.pdfjsLib = window.pdfjsLib || window.PDFJS;
            
            // Configure worker
            if (window.pdfjsLib.GlobalWorkerOptions) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/lib/pdf.worker.min.js';
            } else if (window.pdfjsLib.workerSrc) {
                window.pdfjsLib.workerSrc = 'js/lib/pdf.worker.min.js';
            }
            
            console.log('PDF.js configured successfully');
        } else {
            console.error('PDF.js not found');
        }
    }
    
    // Configure EPUB.js
    function configureEpubJs() {
        if (typeof window.ePub !== 'undefined') {
            console.log('EPUB.js detected successfully');
            
            // Make sure JSZip is available
            if (typeof window.JSZip === 'undefined' && typeof window.zip !== 'undefined') {
                window.JSZip = window.zip;
            }
            
            if (typeof window.JSZip === 'undefined') {
                console.error('JSZip not found. EPUB functionality will not work.');
            } else {
                console.log('JSZip detected successfully');
            }
        } else {
            console.error('EPUB.js not found');
        }
    }
    
    // Configure libraries when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            configurePdfJs();
            configureEpubJs();
        });
    } else {
        configurePdfJs();
        configureEpubJs();
    }
})(); 
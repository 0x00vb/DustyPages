LIBRARY FILES NEEDED

To complete this application, you need to download and place the following library files in this directory:

1. jszip.min.js
   - Download from: https://stuk.github.io/jszip/
   - Version recommended: 3.1.5 (for better iOS 9 compatibility)

2. epub.min.js
   - Download from: https://github.com/futurepress/epub.js/
   - Version recommended: 0.3.88 (or try an older version if needed for iOS 9)
   - Note: For older iOS devices, you might need to patch the library or use an older version

3. pdf.min.js
   - Download from: https://mozilla.github.io/pdf.js/
   - Version recommended: 2.6.347 (for better iOS 9 compatibility)
   - Include both pdf.min.js and pdf.worker.min.js

For best performance on older devices:
- Use minified versions of all libraries
- Consider creating custom builds with only necessary features
- Test thoroughly on the target device 
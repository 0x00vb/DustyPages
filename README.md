# RustyPages

A lightweight, offline-first book reader web app designed specifically for iOS 9 Safari (e.g., on iPad 2).

## Features

- **EPUB and PDF Support**: Read both EPUB and PDF files with a clean interface.
- **Fully Offline Capable**: Once loaded, works completely offline with no internet connection required.
- **Compatible with iOS 9**: Works on older iOS devices like iPad 2.
- **Customization Options**: Change theme, font, font size, and margins to your liking.
- **Local Storage**: Books are stored locally on your device.
- **Touch Friendly**: Optimized for touch navigation.

## How to Use

1. Open the app in Safari on your iOS device.
2. Tap "Add Book" to upload an EPUB or PDF file.
3. Tap on a book in your library to open it.
4. Use the left/right sides of the screen or the navigation buttons to turn pages.
5. Tap the "Settings" button to customize your reading experience.

## Technical Details

RustyPages uses:

- Vanilla JavaScript (ES5) for maximum compatibility
- IndexedDB with localStorage fallback for storing books
- AppCache for offline capabilities
- epub.js v0.3.x for EPUB rendering
- pdf.js for PDF rendering

## Development

To modify RustyPages:

1. Clone the repository.
2. Make changes to the HTML, CSS, or JavaScript files.
3. Test in an iOS 9 Safari environment or simulator.

## License

This project is available for use under the MIT License.

## Limitations

- Large books may take longer to load and may fail on low memory devices.
- PDF rendering performance depends on the device's capabilities.
- Only EPUB and PDF formats are supported. 
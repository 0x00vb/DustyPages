# RustyPages - Lightweight EPUB/PDF Reader

RustyPages is a lightweight, offline-capable web-based e-book reader designed specifically for older devices like the iPad 2 running iOS 9. It allows users to read EPUB and PDF files without requiring an internet connection after the initial load.

## Features

- **Completely Offline:** Works entirely offline after initial load
- **Lightweight:** Designed to run smoothly on older devices with limited resources
- **EPUB and PDF Support:** Read both EPUB and PDF format books
- **Library Management:** Import, organize, and delete books
- **Persistent Storage:** Books and reading progress are saved between sessions
- **Customizable Reading Experience:**
  - Font size adjustment
  - Font family selection (Serif, Sans-serif, Merriweather, OpenDyslexic, Literata)
  - Color themes (Light, Sepia, Dark)
  - Letter spacing control
  - Line height adjustment
  - PDF night mode for better reading in dark environments
- **Reading Progress:** Automatically saves your place in each book
- **Touch-Optimized UI:** Larger touch targets and improved interaction feedback

## Compatibility

RustyPages is specifically designed for:
- iPad 2 running iOS 9 Safari
- Other older iOS devices with limited resources
- Also works on modern browsers with enhanced performance

## Usage

1. **Open the App:** Open the index.html file in Safari
2. **Import Books:** Click the "Import" button to add EPUB or PDF files
3. **Open a Book:** Tap on a book in your library to open it
4. **Navigate:** Tap left/right sides of the screen to turn pages, or use the buttons at the bottom
5. **Adjust Settings:** Click the settings icon to customize your reading experience
6. **Return to Library:** Click the back button to return to your library

## Technical Notes

- Uses localStorage with a chunking mechanism to store e-books
- Compatible with ES5 JavaScript for maximum compatibility
- No external dependencies or services required
- For best performance on iPad 2, add to homescreen for fullscreen mode

## Libraries Used

- **EPUB.js:** Lightweight EPUB reader (modified for iOS 9 compatibility)
- **PDF.js:** Lightweight PDF viewer (minimal build for iOS 9)
- **JSZip:** For handling EPUB files (which are ZIP archives)

## Offline Installation

For completely offline usage:
1. Download all files
2. Transfer to your device using iTunes File Sharing or another method
3. Open in an offline-capable browser like iCab Mobile

## License

MIT License - Feel free to use, modify and distribute as needed. 
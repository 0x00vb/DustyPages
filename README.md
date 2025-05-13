# RustyPages

A lightweight, offline-first book reader web app designed specifically for iOS 9 Safari (e.g., on iPad 2).

## Features

- **EPUB and PDF Support**: Read both EPUB and PDF files with a clean interface.
- **Fully Offline Capable**: Once loaded, works completely offline with no internet connection required.
- **Compatible with iOS 9**: Works on older iOS devices like iPad 2.
- **Customization Options**: Change theme, font, font size, and margins to your liking.
- **Local Storage**: Books are stored locally on your device.
- **Touch Friendly**: Optimized for touch navigation.
- **User Accounts & Sync**: Create an account to sync your books across devices.

## How to Use

1. Open the app in Safari on your iOS device.
2. Tap "Add Book" to upload an EPUB or PDF file.
3. Tap on a book in your library to open it.
4. Use the left/right sides of the screen or the navigation buttons to turn pages.
5. Tap the "Settings" button to customize your reading experience.
6. To sync books across devices, tap "Login" to create an account or sign in.

## Technical Details

RustyPages uses:

- Vanilla JavaScript (ES5) for maximum compatibility
- IndexedDB with localStorage fallback for storing books
- AppCache for offline capabilities
- epub.js v0.3.x for EPUB rendering
- pdf.js for PDF rendering
- MongoDB for user authentication and book synchronization

## Server Component

RustyPages includes a Node.js API server for user authentication and book synchronization:

- Express.js REST API
- MongoDB database for storing user accounts and books
- JWT authentication
- Syncs reading progress between devices

For server setup instructions, see [server/README.md](server/README.md).

## Development

To modify RustyPages:

1. Clone the repository.
2. Make changes to the HTML, CSS, or JavaScript files.
3. Test in an iOS 9 Safari environment or simulator.
4. (Optional) Deploy the server component for user sync functionality.

## License

This project is available for use under the MIT License.

## Limitations

- Large books may take longer to load and may fail on low memory devices.
- PDF rendering performance depends on the device's capabilities.
- Only EPUB and PDF formats are supported.
- Book synchronization requires internet connection. 
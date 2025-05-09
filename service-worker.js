/**
 * 
 * Service Worker for RustyPages
 * Provides offline caching for the app
 * Note: This won't run on iOS 9 but is included for other browsers
 */

// Cache name - update version when content changes
var CACHE_NAME = 'rustyPages-v1';

// Files to cache
var filesToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/polyfills.js',
  '/js/storage.js',
  '/js/library.js',
  '/js/reader.js',
  '/js/app.js',
  '/js/lib/jszip.min.js',
  '/js/lib/epub.min.js',
  '/js/lib/pdf.min.js',
  '/js/lib/pdf.worker.min.js'
];

// Install event - cache static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(filesToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName !== CACHE_NAME;
        }).map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Fetch event - serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        var fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(
          function(response) {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            var responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          }
        );
      })
  );
}); 
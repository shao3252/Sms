// sw.js - Hii inaiambia browser kwamba hii ni App halisi
self.addEventListener('install', (event) => {
    console.log('Service Worker: Imewekwa (Installed)');
});

self.addEventListener('fetch', (event) => {
    // Hapa tunaipanga ikubali PWA check bila kuvuruga mtandao
    event.respondWith(fetch(event.request).catch(() => console.log('Mtandao unasumbua')));
});

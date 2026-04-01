const CACHE_NAME = 'sms-tamu-v1';

// Haya ndio mafaili ya msingi yatakayohifadhiwa kwenye simu (Offline)
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/chat.html',
    '/style.css',
    '/app.js',
    '/chat.js',
    '/manifest.json'
];

// 1. INSTALL EVENT: Hifadhi mafaili kwenye Cache ya simu
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Inahifadhi mafaili kwa ajili ya Offline...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Ianze kufanya kazi papo hapo
});

// 2. ACTIVATE EVENT: Safisha cache za zamani kama umefanya update
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Inafuta Cache ya zamani');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. FETCH EVENT: Logic ya "Network First, kisha Cache Fallback"
self.addEventListener('fetch', (event) => {
    // Tunaruka request za Firebase Database (Maana yenyewe ina mfumo wake wa offline)
    if (event.request.url.includes('firestore.googleapis.com')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Kama mtandao upo (Online), chukua vitu vipya, viweke kwenye cache, kisha muonyeshe user
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            })
            .catch(() => {
                // Kama hakuna mtandao (Offline), mpe vitu vilivyohifadhiwa kwenye Cache!
                return caches.match(event.request);
            })
    );
});

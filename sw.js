// InternPulse Service Worker — YSH Admin
// Version: bump this string when you update the app to force a cache refresh
const CACHE_NAME = 'internpulse-v1';

// Pages and assets to cache immediately on first install
const PRECACHE_URLS = [
  '/YSH-Intern/index.html',
  '/YSH-Intern/privacy.html',
  '/YSH-Intern/manifest.json'
];

// ─── INSTALL ────────────────────────────────────────────────────────────────
// Runs once when the service worker is first registered.
// Think of it as the assistant walking into the shop and memorising everything.
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cache the essential pages. Failures here are silent — app still works online.
      return cache.addAll(PRECACHE_URLS).catch(function(err) {
        console.warn('[SW] Pre-cache failed (some URLs may not exist yet):', err);
      });
    }).then(function() {
      // Take control immediately — don't wait for old SW to die
      return self.skipWaiting();
    })
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────────────────────
// Runs after install. Cleans up old caches from previous versions.
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      // Take control of all open tabs immediately
      return self.clients.claim();
    })
  );
});

// ─── FETCH ──────────────────────────────────────────────────────────────────
// Intercepts every network request.
// Strategy: Network First (try internet, fall back to cache).
// This is safest for a real-time Supabase app — always tries to get fresh data.
self.addEventListener('fetch', function(event) {
  var request = event.request;

  // Only handle GET requests — don't intercept POST/PUT/DELETE (Supabase writes)
  if (request.method !== 'GET') return;

  // Don't intercept Supabase API calls — those always need live network
  if (request.url.indexOf('supabase.co') > -1) return;

  // Don't intercept Google Fonts — they have their own caching
  if (request.url.indexOf('fonts.googleapis.com') > -1) return;
  if (request.url.indexOf('fonts.gstatic.com') > -1) return;

  // Don't intercept CDN scripts (Supabase JS library)
  if (request.url.indexOf('cdn.jsdelivr.net') > -1) return;

  // For everything else (HTML pages): Network First, Cache Fallback
  event.respondWith(
    fetch(request)
      .then(function(networkResponse) {
        // Got a good response — update the cache silently
        if (networkResponse && networkResponse.status === 200) {
          var responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(function() {
        // Network failed — serve from cache (offline mode)
        return caches.match(request).then(function(cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Nothing in cache either — show a simple offline message
          return new Response(
            '<html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#f0fafa;">'
            + '<h2 style="color:#079897">InternPulse</h2>'
            + '<p style="color:#555">You are offline. Please check your internet connection.</p>'
            + '<p style="color:#aaa;font-size:0.8rem">Yenepoya Specialty Hospital · Mangalore</p>'
            + '</body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
  );
});

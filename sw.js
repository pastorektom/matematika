// Service Worker aplikace Matematika E1.
// Ukládá jen vlastní statické soubory a CDN soubory s pevnou verzí. Nikdy nesahá na Supabase
// (databáze, přihlášení) ani na content/. Bez připojení se tedy načte aplikace a témata;
// přihlášení a ukládání pokroku se chovají jako dosud (potřebují internet).
importScripts('sw-rules.js');

// __BUILD__ se při nasazení (GitHub Actions) nahradí zkratkou revize, takže každé nasazení má novou cache.
var BUILD = '__BUILD__';
var STATIC_CACHE = 'matika-static-' + BUILD;
var CDN_CACHE = 'matika-cdn-v1';
var classify = self.SWRules.classify;

var PRECACHE = [
  './', 'index.html', 'manifest.webmanifest', 'sw-rules.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'css/app.css', 'css/board.css', 'css/viz.css', 'css/popout.css',
  'js/app.js', 'js/auth.js', 'js/boot.js', 'js/checker-core.js', 'js/checker-structured.js', 'js/checker.js', 'js/config.js',
  'js/content.js', 'js/custom-input.js', 'js/derive-expr.js', 'js/derive-steps.js', 'js/formulas.js', 'js/lin.js', 'js/progress.js', 'js/pwa.js', 'js/render.js', 'js/rng.js', 'js/router.js',
  'js/topics/derivace-elem.js', 'js/topics/derivace-custom.js', 'js/topics/derivace-fit.js', 'js/topics/derivace-lib.js', 'js/topics/derivace-prubeh.js',
  'js/topics/derivace-teorie.js', 'js/topics/derivace.js', 'js/topics/determinant-lib.js', 'js/topics/determinant.js',
  'js/topics/funkce-lib.js', 'js/topics/funkce.js', 'js/topics/index.js', 'js/topics/limita-custom.js', 'js/topics/limita-lib.js', 'js/topics/limita.js',
  'js/topics/matice.js', 'js/topics/soustavy-lib.js', 'js/topics/soustavy.js', 'js/topics/vektory.js',
  'js/ui/board-link.js', 'js/ui/custom.js', 'js/ui/formulas.js', 'js/ui/home.js', 'js/ui/inputs.js', 'js/ui/login.js', 'js/ui/popout.js',
  'js/ui/practice.js', 'js/ui/shapes.js', 'js/ui/shell.js', 'js/ui/stepper.js', 'js/ui/theory.js', 'js/ui/typepicker.js',
  'js/ui/whiteboard.js',
  'js/viz/board.js', 'js/viz/common.js', 'js/viz/gauss.js', 'js/viz/index.js', 'js/viz/matrix.js', 'js/viz/plot.js',
  'js/viz/signchart.js', 'js/viz/step.js', 'js/viz/tangent.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function (cache) { return cache.addAll(PRECACHE.map(function (u) { return new Request(u, { cache: 'reload' }); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k.indexOf('matika-static-') === 0 && k !== STATIC_CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function storable(res) { return res && (res.ok || res.type === 'opaque'); }

function networkFirst(request) {
  return fetch(request).then(function (res) {
    if (storable(res)) { var copy = res.clone(); caches.open(STATIC_CACHE).then(function (c) { return c.put(request, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(request, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
  });
}

function cacheFirst(request, cacheName) {
  return caches.match(request, { ignoreSearch: cacheName === STATIC_CACHE }).then(function (hit) {
    if (hit) return hit;
    return fetch(request).then(function (res) {
      if (storable(res)) { var copy = res.clone(); caches.open(cacheName).then(function (c) { return c.put(request, copy); }); }
      return res;
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var kind = classify(request.url, self.registration.scope, request.method);
  if (kind === 'shell') return event.respondWith(networkFirst(request));
  if (kind === 'static') return event.respondWith(cacheFirst(request, STATIC_CACHE));
  if (kind === 'cdn') return event.respondWith(cacheFirst(request, CDN_CACHE));
  // 'skip': Supabase, content/ a vše ostatní zpracuje prohlížeč sám.
});

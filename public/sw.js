/* Meridian service worker. The app always opens, even with weak or no signal.
   - Page and code: network first (3 s), then the copy saved on this device.
   - Hashed /assets files, textures, logos: saved on first use, served from the device.
   - Music, intro film and other websites go straight to the network. */
var CACHE = "meridian-c1";
var NAV_TIMEOUT_MS = 3000;
var STATIC = ["/textures/earth-day.jpg", "/textures/earth-night.png", "/textures/earth-specular.jpg", "/textures/moon.jpg",
  "/sour-paint-logo.png", "/sour-paint-mark.png", "/favicon.svg", "/__grok/manifest.webmanifest", "/__grok/icon-180.png"];

self.addEventListener("install", function (e) {
  e.waitUntil((async function () {
    var cache = await caches.open(CACHE);
    try {
      var res = await fetch(new Request("/", { cache: "reload", credentials: "same-origin" }));
      if (res && res.ok && !res.redirected) {
        await cache.put("/", res.clone());
        var html = await res.text();
        var urls = {};
        (html.match(/\/assets\/[A-Za-z0-9_.\-]+\.(?:js|css)/g) || []).forEach(function (u) { urls[u] = 1; });
        await Promise.all(Object.keys(urls).map(function (u) {
          return cache.add(new Request(u, { cache: "reload", credentials: "same-origin" })).catch(function () {});
        }));
      }
    } catch (err) { /* offline during install: saved on the next online visit */ }
    await Promise.all(STATIC.map(function (u) { return cache.add(new Request(u, { cache: "reload" })).catch(function () {}); }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.indexOf("meridian-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

function skip(p) { return p === "/sw.js" || /\.(mp4|webm|mp3|m4a|ogg|wav)$/i.test(p) || p.indexOf("/api/") === 0; }

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var p = url.pathname;
  if (skip(p)) return;
  if (req.mode === "navigate") { e.respondWith(networkFirst(req, "/", NAV_TIMEOUT_MS)); return; }
  if (p.indexOf("/assets/") === 0 || p.indexOf("/textures/") === 0) { e.respondWith(cacheFirst(req)); return; }
  e.respondWith(networkFirst(req, null, NAV_TIMEOUT_MS));
});

async function cacheFirst(req) {
  var cache = await caches.open(CACHE);
  var hit = await cache.match(req);
  if (hit) return hit;
  try {
    var res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone()).catch(function () {});
    return res;
  } catch (err) { return new Response("", { status: 504, statusText: "Offline" }); }
}

async function networkFirst(req, key, ms) {
  var cache = await caches.open(CACHE);
  var network = fetch(req).then(function (res) {
    if (res && res.status === 200 && !res.redirected) cache.put(key || req, res.clone()).catch(function () {});
    return res;
  });
  network.catch(function () {});
  var timeout = new Promise(function (r) { setTimeout(function () { r(null); }, ms); });
  try { var first = await Promise.race([network, timeout]); if (first) return first; } catch (err) { /* offline */ }
  var hit = await cache.match(key || req);
  if (hit) return hit;
  try { return await network; } catch (err) { return new Response("", { status: 504, statusText: "Offline" }); }
}

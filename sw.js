// sw.js — Service Worker: מאפשר למשחק לעבוד גם בלי אינטרנט (אחרי טעינה ראשונה)
// גרסה מועלית בכל שינוי קוד/אמנות — activate מוחק מטמון ישן ומרענן הכל
// (בלי זה, cache-first מגיש למשתמשים מותקנים את הגרסה הישנה לנצח).
const CACHE = 'agam-farm-v2';
const CORE = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/main.js', './js/world.js', './js/horses.js', './js/animals.js',
  './js/fields.js', './js/game.js', './js/ui.js', './js/audio.js',
  './js/math.js', './js/cloud.js',
  './js/contest.js', './js/delivery.js', './js/photo.js',
  './js/forest_area.js', './js/lake_area.js', './js/village_area.js',
  './js/mountain_area.js', './js/fair_area.js',
  './js/lib/three.module.min.js', './js/lib/addons/controls/OrbitControls.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // רק GET מאותו מקור (לא נוגעים ב-Supabase / CDN)
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});

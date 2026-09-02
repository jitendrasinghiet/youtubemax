// __BUILD_ID__ is replaced with a real build-time value by vite.config.ts's
// swVersionPlugin -- without it, this file's bytes never change between
// deploys (it's a static public/ file, not part of Vite's own hashed
// asset pipeline), so the browser's service-worker update check never
// finds anything different and the reload-on-update listener in
// src/main.tsx (already correct) never has a real update to react to.
// The dist/ copy this ships from always has a real id substituted in;
// this literal placeholder only appears in source/dev.
const CACHE_NAME = 'youtubemax-shell-__BUILD_ID__'
const SHELL_FILES = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html')),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
    }),
  )
})

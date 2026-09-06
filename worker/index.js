// Migração dos caches de runtime criados pela configuração padrão anterior.
// Não remover o precache do Workbox nem caches de outras aplicações na origem.
const legacyRuntimeCaches = new Set([
  "start-url",
  "google-fonts-webfonts",
  "google-fonts-stylesheets",
  "static-font-assets",
  "static-image-assets",
  "next-static-js-assets",
  "next-image",
  "static-audio-assets",
  "static-video-assets",
  "static-js-assets",
  "static-style-assets",
  "next-data",
  "static-data-assets",
  "apis",
  "pages-rsc-prefetch",
  "pages-rsc",
  "pages",
  "cross-origin",
]);

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => legacyRuntimeCaches.has(name))
          .map((name) => caches.delete(name)),
      ),
    ),
  );
});

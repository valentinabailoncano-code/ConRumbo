const CACHE = "conrumbo-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
});
self.addEventListener("fetch", (e)=>{
  const url = new URL(e.request.url);
  // Cache-first para estáticos
  if (ASSETS.some(p => url.pathname.endsWith(p.replace("./","/")))) {
    e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
    return;
  }
  // Network-first para API
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(()=> new Response(JSON.stringify({ok:false, offline:true}), {headers:{'Content-Type':'application/json'}}))
    );
    return;
  }
});

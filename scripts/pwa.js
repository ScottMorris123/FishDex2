// Centralized PWA service worker registration for FishDex (partial offline)
(function(){
  const SW_VERSION = '2025-11-06'; // bump when SW changes
  // Back/forward cache (bfcache) refresh: when coming back, force a reload to avoid showing old DOM
  // This ensures UI changes (like updated cards/icons) are visible without a manual refresh.
  window.addEventListener('pageshow', (e) => {
    // Navigation Timing v2 reliably indicates back/forward navigations
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    const isBackForward = nav && nav.type === 'back_forward';
    if (e.persisted || isBackForward) {
      // Hard reload to fetch latest HTML/JS
      window.location.reload();
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        // Register with a versioned URL to defeat HTTP caching of sw.js on some devices
        const reg = await navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(SW_VERSION)}`, { scope: './' });
        // Proactively check for updates
        try { reg.update(); } catch {}
        // If a new worker is waiting, tell it to activate immediately
        if (reg.waiting) { reg.waiting.postMessage('skipWaiting'); }

        // If a new worker is found, promote it quickly
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              try { sw.postMessage('skipWaiting'); } catch {}
            }
          });
        });

        // If a new Service Worker takes control, reload once to pick up fresh assets
        let swReloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (swReloaded) return; // one-time
          swReloaded = true;
          // Delay a tick so the new SW can settle before reload
          setTimeout(() => window.location.reload(), 50);
        });

        // Optional: allow manual cache purge by visiting with #purge in URL
        if (location.hash === '#purge') {
          try {
            // Clear web storages that might hold stale JSON
            try { sessionStorage.clear(); } catch {}
            try { localStorage.clear(); } catch {}
            // Ask SW to delete all caches
            reg.active?.postMessage('purgeCaches');
            // Also unregister any other service workers bound to this scope
            try { const regs = await navigator.serviceWorker.getRegistrations(); regs.forEach(r => r.unregister()); } catch {}
          } finally {
            // Remove the hash and hard-reload once
            try { history.replaceState(null, '', location.pathname + location.search); } catch {}
            setTimeout(() => location.reload(), 80);
          }
        }
      } catch (e) {
        console.warn('[PWA] service worker registration failed', e);
      }
    });
  }
})();
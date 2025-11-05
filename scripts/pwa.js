// Centralized PWA service worker registration for FishDex (partial offline)
(function(){
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
        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        // Proactively check for updates
        try { reg.update(); } catch {}
        // If a new worker is waiting, tell it to activate immediately
        if (reg.waiting) { reg.waiting.postMessage('skipWaiting'); }

        // If a new Service Worker takes control, reload once to pick up fresh assets
        let swReloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (swReloaded) return; // one-time
          swReloaded = true;
          // Delay a tick so the new SW can settle before reload
          setTimeout(() => window.location.reload(), 50);
        });
      } catch (e) {
        console.warn('[PWA] service worker registration failed', e);
      }
    });
  }
})();
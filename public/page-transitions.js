// Shared by app and static pages; listen before the first pagereveal event.
(function setupPageTransitions() {
  const source = document.currentScript?.src;
  if (source) {
    document.documentElement.classList.add('site-shell-ready');
    const shell = document.createElement('script');
    shell.type = 'module';
    shell.src = new URL('./site-shell.js', source).href;
    shell.addEventListener('error', function restoreOriginalLayout() {
      document.documentElement.classList.remove('site-shell-ready');
    });
    document.head.append(shell);
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /** @type {Animation | null} */
  let entryAnimation = null;

  function cancelEntry() {
    entryAnimation?.cancel();
    entryAnimation = null;
  }

  function animateEntry() {
    cancelEntry();
    if (reducedMotion.matches || document.visibilityState === 'hidden') return;
    if (!document.body || typeof document.body.animate !== 'function') return;
    entryAnimation = document.body.animate([{ opacity: 0 }, { opacity: 1 }], {
      id: 'study-page-entry', duration: 200, easing: 'ease-out',
    });
  }

  const revealEvent = 'onpagereveal' in window ? 'pagereveal' : 'pageshow';
  window.addEventListener(revealEvent, animateEntry);
  window.addEventListener('pageswap', cancelEntry);
  window.addEventListener('pagehide', cancelEntry);
  reducedMotion.addEventListener('change', cancelEntry);
})();

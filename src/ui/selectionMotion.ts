import { siteNavigationPage } from './siteNavigation.ts';

let initialized = false;

/** Only the checked box moves; the card's layout and scroll position stay fixed. */
export function animateCompletionCheckbox(input: HTMLInputElement): Animation | null {
  input.getAnimations().filter(animation => animation.id === 'study-completion-checkbox').forEach(animation => animation.cancel());
  if (!input.checked || matchMedia('(prefers-reduced-motion: reduce)').matches || !input.animate) return null;
  return input.animate([
    { transform: 'scale(1)', offset: 0 },
    { transform: 'scale(1.18)', offset: .38 },
    { transform: 'scale(.995)', offset: .75 },
    { transform: 'scale(1)', offset: 1 },
  ], { id: 'study-completion-checkbox', duration: 300, easing: 'cubic-bezier(.22,.65,.28,1)' });
}

/** Shared chrome is reused on every app, legal, prompt and source page. */
export function initializeSelectionMotion(right: HTMLElement, bar: HTMLElement): void {
  if (initialized) return;
  initialized = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 1199px)');
  const nav = bar.querySelector<HTMLElement>('nav')!;
  const mobileSelection = document.createElement('span');
  mobileSelection.className = 'site-mobile-selection';
  mobileSelection.setAttribute('aria-hidden', 'true');
  nav.prepend(mobileSelection);
  nav.dataset.selectionMotion = 'ready';
  const marker = document.createElement('span');
  marker.className = 'site-navigation-selection';
  marker.setAttribute('aria-hidden', 'true');
  right.prepend(marker);
  let markerMotion: Animation | null = null;
  let pendingHref: string | null = null;
  let frame = 0;

  function selectedLink(): HTMLAnchorElement | null {
    return right.querySelector<HTMLAnchorElement>('.site-tools a[aria-current=page],.site-workspace-home[aria-current=page]');
  }

  function paintMarker(target: HTMLElement | null, moving = false): Animation | null {
    if (!target || !target.getClientRects().length) return null;
    const railRect = right.getBoundingClientRect(), rect = target.getBoundingClientRect();
    const before = marker.getBoundingClientRect();
    markerMotion?.cancel();
    const to = { left: rect.left - railRect.left + right.scrollLeft, top: rect.top - railRect.top + right.scrollTop, width: rect.width, height: rect.height };
    const from = { left: before.left - railRect.left + right.scrollLeft, top: before.top - railRect.top + right.scrollTop, width: before.width, height: before.height };
    Object.entries(to).forEach(([property, value]) => marker.style.setProperty(property, `${value}px`));
    const ready = right.dataset.selectionMotion === 'ready';
    right.dataset.selectionMotion = 'ready';
    if (!moving || !ready || reduced.matches || !before.width) return null;
    const pixels = (values: typeof to): Record<string, string> => Object.fromEntries(Object.entries(values).map(([property, value]) => [property, `${value}px`]));
    markerMotion = marker.animate([pixels(from), pixels(to)], { id: 'study-navigation-selection', duration: 260, easing: 'cubic-bezier(.2,.75,.25,1)' });
    return markerMotion;
  }

  function updateMobileSelection(): void {
    const buttons = [...nav.querySelectorAll<HTMLButtonElement>('[data-mobile-section]')];
    const index = buttons.findIndex(button => button.getAttribute('aria-pressed') === 'true');
    nav.style.setProperty('--mobile-selection', String(Math.max(0, index)));
  }

  function refreshGeometry(): void {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { if (!pendingHref) paintMarker(selectedLink()); });
  }

  new MutationObserver(() => { updateMobileSelection(); refreshGeometry(); }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
  if (typeof ResizeObserver === 'function') new ResizeObserver(refreshGeometry).observe(right);
  window.addEventListener('resize', refreshGeometry);
  window.addEventListener('pageshow', refreshGeometry);
  updateMobileSelection();
  paintMarker(selectedLink());

  document.addEventListener('click', function selectNavigation(event): void {
    if (!(event.target instanceof Element) || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const link = event.target.closest<HTMLAnchorElement>('#siteRightRail a');
    if (!link || link.download || (link.target && link.target !== '_self')) return;
    const destination = new URL(link.href);
    if (destination.origin !== location.origin || !/^https?:$/.test(destination.protocol)) return;
    const page = siteNavigationPage(destination.pathname);
    const target = [...right.querySelectorAll<HTMLAnchorElement>('.site-tools a,.site-workspace-home')].find(anchor => siteNavigationPage(new URL(anchor.href).pathname) === page);
    if (!target) return;
    // Mobile page departures already own the rightward slide. Do not delay or
    // replace their direction, same-tab navigation, or preserved panel nodes.
    if (compact.matches || reduced.matches || destination.href === location.href) { paintMarker(target); return; }
    if (event.defaultPrevented) return;
    event.preventDefault();
    pendingHref = destination.href;
    const motion = paintMarker(target, true);
    const finish = (): void => {
      if (pendingHref !== destination.href) return;
      pendingHref = null;
      location.assign(destination.href);
    };
    if (motion) void motion.finished.then(finish, () => {});
    else finish();
  }, true);

  // Tracker replaces a completed card synchronously. Resolve its new checkbox
  // after the save handler, rather than animating the detached old input.
  document.addEventListener('change', function completedTrackerItem(event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches('[data-done],[data-week-done]')) return;
    let selector: string;
    if (input.hasAttribute('data-week-done')) {
      selector = `[data-week-done][data-week-date="${CSS.escape(input.dataset.weekDate ?? '')}"][data-week-item="${CSS.escape(input.dataset.weekItem ?? '')}"]`;
    } else {
      const item = input.closest<HTMLElement>('[data-item]');
      if (!item) return;
      selector = `[data-item="${CSS.escape(item.dataset.item!)}"]>.item-top>[data-done]`;
    }
    const occurrence = [...document.querySelectorAll(selector)].indexOf(input);
    const wasFocused = document.activeElement === input;
    queueMicrotask(() => {
      const current = input.isConnected ? input : document.querySelectorAll<HTMLInputElement>(selector)[Math.max(0, occurrence)];
      if (current?.checked === input.checked) {
        if (wasFocused && !input.isConnected) current.focus({ preventScroll: true });
        animateCompletionCheckbox(current);
      }
    });
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !pendingHref) return;
    pendingHref = null;
    markerMotion?.cancel();
    paintMarker(selectedLink());
  });
  window.addEventListener('pagehide', () => { pendingHref = null; markerMotion?.cancel(); cancelAnimationFrame(frame); });
}

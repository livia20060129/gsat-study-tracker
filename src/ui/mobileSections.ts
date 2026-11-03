type MobileSection = 'date' | 'content' | 'tools';

interface MobileSections {
  showContent(): void;
}

/** Reuse the original nodes so timers, focused drafts and record listeners survive switching. */
export function initializeMobileSections(left: HTMLElement, right: HTMLElement, bar: HTMLElement): MobileSections {
  const compact = matchMedia('(max-width: 1199px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const positions = new Map<MobileSection, number>();
  const concealed = new Map<HTMLElement, boolean>();
  const buttons = [...bar.querySelectorAll<HTMLButtonElement>('[data-mobile-section]')];
  let section: MobileSection = 'content';
  let previous = 0;
  let direction = 0;
  let distance = 0;
  let switching = false;
  let scrollFrame = 0;
  let switchFrame = 0;
  let animation: Animation | undefined;

  function scrollTop(): number {
    const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    return Math.max(0, Math.min(maximum, window.scrollY));
  }

  function revealNavigation(): void {
    document.body.dataset.mobileNavHidden = 'false';
    previous = scrollTop();
    direction = 0;
    distance = 0;
  }

  function contentNodes(): HTMLElement[] {
    return [...document.body.children].filter((node): node is HTMLElement =>
      node instanceof HTMLElement && !node.matches('.site-rail,.site-mobile-bar,script,style,link'));
  }

  function updateContentVisibility(): void {
    if (!compact.matches || section === 'content') {
      for (const [node, wasInert] of concealed) {
        node.classList.remove('site-mobile-content-hidden');
        node.inert = wasInert;
      }
      concealed.clear();
      return;
    }
    for (const node of contentNodes()) {
      if (!concealed.has(node)) concealed.set(node, node.inert);
      node.inert = true;
      node.classList.add('site-mobile-content-hidden');
    }
  }

  function selectSection(next: MobileSection): void {
    if (!compact.matches) return;
    positions.set(section, scrollTop());
    const changed = next !== section;
    section = next;
    switching = true;
    cancelAnimationFrame(switchFrame);
    animation?.cancel();
    document.body.dataset.mobileSection = section;
    left.inert = section !== 'date';
    right.inert = section !== 'tools';
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.mobileSection === section));
    updateContentVisibility();
    if (changed) window.scrollTo({ top: positions.get(section) ?? 0, behavior: 'instant' });
    revealNavigation();
    let target: HTMLElement | undefined;
    if (section === 'date') target = left;
    else if (section === 'tools') target = right;
    else target = contentNodes().find(node => node.matches('main,header'));
    if (changed && target && !reducedMotion.matches) {
      animation = target.animate([{ opacity: 0.4 }, { opacity: 1 }], { id: 'study-mobile-section', duration: 180, easing: 'ease-out' });
    }
    switchFrame = requestAnimationFrame(function settleSwitch(): void {
      switchFrame = requestAnimationFrame(function resumeScrollObservation(): void {
        switching = false;
        previous = scrollTop();
      });
    });
  }

  function observeScroll(): void {
    scrollFrame = 0;
    if (!compact.matches || switching) return;
    const current = scrollTop();
    const delta = current - previous;
    previous = current;
    if (current <= 12) { revealNavigation(); return; }
    // Connection settings own their opening/closing position animation.
    if (document.querySelector('.connection-dock.is-animating,.connection-dock.is-preparing')) return;
    if (Math.abs(delta) < 0.5) return;
    const nextDirection = Math.sign(delta);
    if (direction !== nextDirection) { direction = nextDirection; distance = 0; }
    distance += Math.abs(delta);
    if (distance >= (direction > 0 ? 24 : 12)) {
      document.body.dataset.mobileNavHidden = String(direction > 0);
      distance = 0;
    }
  }

  bar.addEventListener('click', function switchFromNavigation(event): void {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-mobile-section]');
    const next = button?.dataset.mobileSection;
    if (next === 'date' || next === 'content' || next === 'tools') selectSection(next);
  });
  bar.addEventListener('focusin', revealNavigation);
  window.addEventListener('scroll', function queueScrollObservation(): void {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(observeScroll);
  }, { passive: true });
  document.addEventListener('keydown', function returnFromSection(event): void {
    if (compact.matches && section !== 'content' && event.key === 'Escape') {
      selectSection('content');
      buttons.find(button => button.dataset.mobileSection === 'content')?.focus({ preventScroll: true });
    }
  });
  new MutationObserver(updateContentVisibility).observe(document.body, { childList: true });
  compact.addEventListener('change', function updateLayout(): void {
    if (compact.matches) {
      selectSection('content');
      return;
    }
    const wasAlternate = section !== 'content';
    if (wasAlternate) positions.set(section, scrollTop());
    section = 'content';
    animation?.cancel();
    left.inert = false;
    right.inert = false;
    updateContentVisibility();
    delete document.body.dataset.mobileSection;
    delete document.body.dataset.mobileNavHidden;
    if (wasAlternate) window.scrollTo({ top: positions.get('content') ?? 0, behavior: 'instant' });
  });
  reducedMotion.addEventListener('change', function cancelSectionMotion(): void { animation?.cancel(); });
  if (compact.matches) selectSection('content');
  return { showContent(): void { selectSection('content'); } };
}

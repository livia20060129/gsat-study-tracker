type ConnectionMotionState = 'idle' | 'opening' | 'closing';

const MOTION_FALLBACK_MS = 520;
const MOBILE_FLOW_MARGIN_PX = 14;
const MOBILE_QUERY = '(max-width: 720px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function limitedExpandedHeight(panel: HTMLDetailsElement): number {
  const naturalHeight = panel.scrollHeight;
  const maxHeight = Number.parseFloat(getComputedStyle(panel).maxHeight);
  return Number.isFinite(maxHeight) ? Math.min(naturalHeight, maxHeight) : naturalHeight;
}

/**
 * Gives the desktop disclosure and mobile bottom sheet one shared open/close
 * lifecycle. Keeping the details element open until the closing transition is
 * complete prevents its content from disappearing before the shell retracts.
 */
export function setupConnectionSettingsMotion(
  panel: HTMLDetailsElement,
  summary: HTMLElement,
): () => void {
  const content = panel.querySelector<HTMLElement>('.connection-settings-content');
  const mobilePlaceholder = document.createElement('div');
  mobilePlaceholder.className = 'connection-dock-placeholder';
  mobilePlaceholder.setAttribute('aria-hidden', 'true');
  panel.before(mobilePlaceholder);
  let state: ConnectionMotionState = 'idle';
  let paintFrame = 0;
  let resizeFrame = 0;
  let fallbackTimer = 0;
  let mobileReservedHeight = 0;

  function isMobile(): boolean {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function prefersReducedMotion(): boolean {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  }

  function syncBodyLock(): void {
    const mobileOpen = panel.open && isMobile();
    document.body.classList.toggle('connection-sheet-open', mobileOpen);
    if (!mobileOpen) releaseMobileSpace();
    else if (!mobilePlaceholder.classList.contains('is-active')) reserveMobileSpace();
  }

  function reserveMobileSpace(collapsedHeight?: number): void {
    if (!isMobile()) return;
    if (Number.isFinite(collapsedHeight)) {
      const marginTop = Number.parseFloat(getComputedStyle(panel).marginTop) || 0;
      mobileReservedHeight = Math.max(0, Number(collapsedHeight)) + marginTop;
    } else if (!mobileReservedHeight) {
      mobileReservedHeight = summary.getBoundingClientRect().height + MOBILE_FLOW_MARGIN_PX;
    }
    mobilePlaceholder.style.height = `${mobileReservedHeight}px`;
    mobilePlaceholder.classList.add('is-active');
  }

  function releaseMobileSpace(): void {
    mobilePlaceholder.classList.remove('is-active');
    mobilePlaceholder.style.removeProperty('height');
  }

  function clearScheduledWork(): void {
    cancelAnimationFrame(paintFrame);
    cancelAnimationFrame(resizeFrame);
    window.clearTimeout(fallbackTimer);
  }

  function clearMotionStyles(preserveHeight = false): void {
    panel.classList.remove('is-preparing', 'is-animating', 'is-opening', 'is-closing', 'is-expanded');
    if (!preserveHeight) panel.style.removeProperty('height');
    panel.style.removeProperty('--connection-summary-height');
    panel.style.removeProperty('--connection-expanded-height');
  }

  function finishOpening(): void {
    if (state !== 'opening') return;
    state = 'idle';
    clearScheduledWork();
    clearMotionStyles(isMobile());
    syncBodyLock();
  }

  function finishClosing(): void {
    if (state !== 'closing') return;
    state = 'idle';
    clearScheduledWork();
    panel.open = false;
    releaseMobileSpace();
    clearMotionStyles();
    syncBodyLock();
  }

  function finishAfterTimeout(action: () => void): void {
    fallbackTimer = window.setTimeout(action, MOTION_FALLBACK_MS);
  }

  function openImmediately(): void {
    clearScheduledWork();
    state = 'idle';
    const mobile = isMobile();
    const collapsedHeight = panel.getBoundingClientRect().height;
    clearMotionStyles();
    if (mobile) reserveMobileSpace(collapsedHeight);
    panel.open = true;
    if (mobile) panel.style.height = `${limitedExpandedHeight(panel)}px`;
    syncBodyLock();
  }

  function closeImmediately(): void {
    clearScheduledWork();
    state = 'idle';
    panel.open = false;
    releaseMobileSpace();
    clearMotionStyles();
    syncBodyLock();
  }

  function startOpening(): void {
    if (prefersReducedMotion()) {
      openImmediately();
      return;
    }
    state = 'opening';
    const mobile = isMobile();
    const collapsedHeight = panel.getBoundingClientRect().height;
    const summaryHeight = summary.getBoundingClientRect().height;
    if (mobile) reserveMobileSpace(collapsedHeight);
    panel.classList.add('is-preparing', 'is-opening');
    panel.style.setProperty('--connection-summary-height', `${summaryHeight}px`);
    if (!mobile) panel.style.height = `${summaryHeight}px`;
    panel.open = true;
    syncBodyLock();

    const expandedHeight = limitedExpandedHeight(panel);
    panel.style.setProperty('--connection-expanded-height', `${expandedHeight}px`);
    if (mobile) panel.style.height = `${expandedHeight}px`;
    panel.getBoundingClientRect();
    paintFrame = requestAnimationFrame(() => {
      if (state !== 'opening') return;
      panel.classList.remove('is-preparing');
      panel.classList.add('is-animating', 'is-expanded');
      if (!mobile) panel.style.height = `${limitedExpandedHeight(panel)}px`;
    });
    finishAfterTimeout(finishOpening);
  }

  function startClosing(): void {
    if (prefersReducedMotion()) {
      closeImmediately();
      return;
    }
    state = 'closing';
    const mobile = isMobile();
    const expandedHeight = panel.getBoundingClientRect().height;
    const summaryHeight = summary.getBoundingClientRect().height;
    panel.style.setProperty('--connection-expanded-height', `${expandedHeight}px`);
    panel.style.setProperty('--connection-summary-height', `${summaryHeight}px`);
    panel.classList.add('is-animating', 'is-closing', 'is-expanded');
    if (!mobile) panel.style.height = `${expandedHeight}px`;
    panel.getBoundingClientRect();

    paintFrame = requestAnimationFrame(() => {
      if (state !== 'closing') return;
      panel.classList.remove('is-expanded');
      if (!mobile) panel.style.height = `${summaryHeight}px`;
    });
    finishAfterTimeout(finishClosing);
  }

  function handleSummaryClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (target?.closest('button,a,input,select,textarea')) return;
    event.preventDefault();
    if (state !== 'idle') return;
    if (panel.open) startClosing();
    else startOpening();
  }

  function handleTransitionEnd(event: TransitionEvent): void {
    if (event.target !== panel) return;
    const expectedProperty = isMobile() ? 'transform' : 'height';
    if (event.propertyName !== expectedProperty) return;
    if (state === 'opening') finishOpening();
    else if (state === 'closing') finishClosing();
  }

  function handleContentResize(): void {
    if (state !== 'opening' || isMobile()) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (state !== 'opening') return;
      const height = limitedExpandedHeight(panel);
      panel.style.setProperty('--connection-expanded-height', `${height}px`);
      panel.style.height = `${height}px`;
    });
  }

  function handleViewportResize(): void {
    syncBodyLock();
    if (state !== 'idle' || !panel.open || !isMobile()) return;
    panel.style.height = `${limitedExpandedHeight(panel)}px`;
  }

  const resizeObserver = content && typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(handleContentResize)
    : null;
  resizeObserver?.observe(content as HTMLElement);
  summary.addEventListener('click', handleSummaryClick);
  panel.addEventListener('transitionend', handleTransitionEnd);
  panel.addEventListener('toggle', syncBodyLock);
  window.addEventListener('resize', handleViewportResize);
  syncBodyLock();

  return function disposeConnectionSettingsMotion(): void {
    clearScheduledWork();
    resizeObserver?.disconnect();
    summary.removeEventListener('click', handleSummaryClick);
    panel.removeEventListener('transitionend', handleTransitionEnd);
    panel.removeEventListener('toggle', syncBodyLock);
    window.removeEventListener('resize', handleViewportResize);
    mobilePlaceholder.remove();
  };
}

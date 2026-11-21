import { subjectTimeArcPath } from '../study/subjectTime.ts';

type Point = [number, number];
type Arc = { start: number; end: number };
type Color = [number, number, number, number];
type Shape = { values: Record<string, number>; node: SVGElement; owner: string };
type Day = { angle: number; core: Color; accent: Color };

export interface SummaryMotionSnapshot {
  numbers: Map<string, number>;
  arcs: Map<string, Arc & { node: SVGElement }>;
  shapes: Map<string, Shape>;
  lines: Map<string, Point[]>;
  days: Map<string, Day>;
}

function bounded(value: number): number { return Math.max(0, Math.min(1, value)); }

/** Resample by relative position when adjacent months contain different day counts. */
export function interpolateSummaryPoints(from: readonly Point[], to: readonly Point[], progress: number): Point[] {
  const t = bounded(progress);
  if (!from.length) return to.map(point => [...point]);
  return to.map((point, index) => {
    const position = index / Math.max(1, to.length - 1) * (from.length - 1);
    const left = Math.floor(position), right = Math.min(from.length - 1, left + 1);
    return point.map((value, axis) => {
      const previous = from[left][axis] + (from[right][axis] - from[left][axis]) * (position - left);
      return previous + (value - previous) * t;
    }) as Point;
  });
}

/** A bedtime around midnight travels through midnight rather than through noon. */
export function interpolateSummaryClock(from: number, to: number, progress: number): number {
  const difference = ((to - from + 720) % 1440 + 1440) % 1440 - 720;
  return from + difference * bounded(progress);
}

function color(value: string): Color {
  const hex = /^#([\da-f]{6})$/i.exec(value.trim());
  if (hex) return [0, 2, 4].map(index => parseInt(hex[1].slice(index, index + 2), 16)).concat(1) as Color;
  const parts = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

function mixedColor(from: Color, to: Color, t: number): string {
  const values = to.map((value, index) => from[index] + (value - from[index]) * t);
  return `rgba(${values.slice(0, 3).map(Math.round).join(',')},${values[3].toFixed(3)})`;
}

function points(node: Element): Point[] {
  const values = (node.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number);
  return Array.from({ length: Math.floor(values.length / 2) }, (_, index) => [values[index * 2], values[index * 2 + 1]]);
}

function geometry(node: SVGElement): Record<string, number> {
  const names = node.tagName.toLowerCase() === 'rect' ? ['x', 'y', 'width', 'height'] : ['cx', 'cy', 'r'];
  return Object.fromEntries(names.map(name => [name, Number(node.getAttribute(name) ?? 0)]));
}

function ghost(source: SVGElement, kind: string, key: string): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', source.tagName);
  for (const name of ['d', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'class']) {
    const value = source.getAttribute(name);
    if (value !== null) node.setAttribute(name, value);
  }
  node.setAttribute(kind, key);
  node.setAttribute('data-summary-morph-exit', '');
  node.setAttribute('aria-hidden', 'true');
  node.style.pointerEvents = 'none';
  return node;
}

export function createSummaryPeriodMotion(
  root: HTMLElement,
  formatNumber: (format: string, value: number) => string,
): { capture(): SummaryMotionSnapshot; start(before: SummaryMotionSnapshot): void; finish(): void } {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const paintedNumbers = new WeakMap<Element, number>();
  const paintedArcs = new WeakMap<Element, Arc>();
  let frame = 0;
  let steps: Array<(progress: number) => void> = [];
  let cleanup: Array<() => void> = [];

  function halt(complete: boolean): void {
    cancelAnimationFrame(frame);
    frame = 0;
    if (complete) steps.forEach(paint => paint(1));
    cleanup.forEach(restore => restore());
    steps = [];
    cleanup = [];
    delete root.dataset.summaryPeriodMotion;
  }

  function capture(): SummaryMotionSnapshot {
    const snapshot: SummaryMotionSnapshot = { numbers: new Map(), arcs: new Map(), shapes: new Map(), lines: new Map(), days: new Map() };
    root.querySelectorAll<HTMLElement>('[data-summary-morph-number]').forEach(node => {
      snapshot.numbers.set(node.dataset.summaryMorphNumber!, paintedNumbers.get(node) ?? Number(node.dataset.summaryMorphValue));
    });
    root.querySelectorAll<SVGElement>('[data-summary-morph-arc]').forEach(node => {
      snapshot.arcs.set(node.dataset.summaryMorphArc!, { ...(paintedArcs.get(node) ?? {
        start: Number(node.dataset.summaryMorphStart), end: Number(node.dataset.summaryMorphEnd),
      }), node });
    });
    root.querySelectorAll<SVGElement>('[data-summary-morph-shape]').forEach(node => {
      snapshot.shapes.set(node.dataset.summaryMorphShape!, { values: geometry(node), node, owner: node.closest('#summaryTrend,#sleepTrend')?.id ?? '' });
    });
    root.querySelectorAll<SVGElement>('[data-summary-morph-line]').forEach(node => snapshot.lines.set(node.dataset.summaryMorphLine!, points(node)));
    root.querySelectorAll<HTMLElement>('[data-summary-morph-day]').forEach(node => {
      snapshot.days.set(node.dataset.summaryMorphDay!, {
        angle: parseFloat(node.style.getPropertyValue('--day-completion')),
        core: color(node.style.getPropertyValue('--day-core-color')),
        accent: color(getComputedStyle(node).getPropertyValue('--day-accent')),
      });
    });
    // Capture the painted frame before removing exiting marks or settling styles.
    halt(false);
    return snapshot;
  }

  function start(before: SummaryMotionSnapshot): void {
    halt(true);
    if (reducedMotion.matches || !root.isConnected || document.hidden) return;
    const labels = new Map([...root.querySelectorAll<HTMLElement>('[data-summary-morph-label]')]
      .map(node => [node.dataset.summaryMorphLabel!, node]));

    root.querySelectorAll<HTMLElement>('[data-summary-morph-number]').forEach(node => {
      const from = before.numbers.get(node.dataset.summaryMorphNumber!);
      const to = Number(node.dataset.summaryMorphValue), format = node.dataset.summaryMorphFormat ?? '';
      if (from === undefined || !Number.isFinite(from) || !Number.isFinite(to) || from === to) return;
      const finalText = node.textContent, finalLabel = node.getAttribute('aria-label');
      node.setAttribute('aria-label', finalText ?? '');
      steps.push(t => {
        const value = format === 'clock' ? interpolateSummaryClock(from, to, t) : from + (to - from) * t;
        paintedNumbers.set(node, value);
        node.textContent = formatNumber(format, value);
      });
      cleanup.push(() => {
        node.textContent = finalText;
        paintedNumbers.delete(node);
        if (finalLabel === null) node.removeAttribute('aria-label'); else node.setAttribute('aria-label', finalLabel);
      });
    });

    const targets = new Set<string>();
    function arcStep(node: SVGElement, key: string, from: Arc, to: Arc): void {
      if (from.start === to.start && from.end === to.end) return;
      const finalPath = node.getAttribute('d'), label = labels.get(key);
      const finalLeft = label?.style.left, finalTop = label?.style.top;
      steps.push(t => {
        const arc = { start: from.start + (to.start - from.start) * t, end: from.end + (to.end - from.end) * t };
        paintedArcs.set(node, arc);
        node.setAttribute('d', subjectTimeArcPath({ startPercent: arc.start, endPercent: arc.end }));
        if (label) {
          const angle = (arc.start + arc.end) / 200 * Math.PI * 2 - Math.PI / 2;
          label.style.left = `${(80 + Math.cos(angle) * 56) / 1.6}%`;
          label.style.top = `${(80 + Math.sin(angle) * 56) / 1.6}%`;
        }
      });
      cleanup.push(() => {
        if (finalPath !== null) node.setAttribute('d', finalPath);
        paintedArcs.delete(node);
        if (label) { label.style.left = finalLeft!; label.style.top = finalTop!; }
      });
    }
    root.querySelectorAll<SVGElement>('[data-summary-morph-arc]').forEach(node => {
      const key = node.dataset.summaryMorphArc!;
      targets.add(key);
      const to = { start: Number(node.dataset.summaryMorphStart), end: Number(node.dataset.summaryMorphEnd) };
      arcStep(node, key, before.arcs.get(key) ?? { start: to.start, end: to.start }, to);
    });
    const donut = root.querySelector<SVGElement>('#summarySubjectDistribution svg');
    if (donut) for (const [key, from] of before.arcs) {
      if (targets.has(key)) continue;
      const node = ghost(from.node, 'data-summary-morph-arc', key);
      node.dataset.summaryMorphStart = String(from.start);
      node.dataset.summaryMorphEnd = String(from.end);
      node.setAttribute('d', subjectTimeArcPath({ startPercent: from.start, endPercent: from.end }));
      donut.append(node);
      arcStep(node, key, from, { start: from.start, end: from.start });
      cleanup.push(() => node.remove());
    }

    const shapeTargets = new Set<string>();
    function shapeStep(node: SVGElement, from: Record<string, number>, to: Record<string, number>): void {
      if (Object.keys(to).every(name => from[name] === to[name])) return;
      steps.push(t => Object.entries(to).forEach(([name, value]) => node.setAttribute(name, String(from[name] + (value - from[name]) * t))));
      cleanup.push(() => Object.entries(to).forEach(([name, value]) => node.setAttribute(name, String(value))));
    }
    root.querySelectorAll<SVGElement>('[data-summary-morph-shape]').forEach(node => {
      const key = node.dataset.summaryMorphShape!, to = geometry(node);
      shapeTargets.add(key);
      const previous = before.shapes.get(key)?.values;
      const from = previous ?? (node.tagName.toLowerCase() === 'rect' ? { ...to, y: to.y + to.height, height: 0 } : to);
      shapeStep(node, from, to);
    });
    for (const [key, previous] of before.shapes) {
      if (shapeTargets.has(key) || !previous.owner || previous.node.tagName.toLowerCase() !== 'rect') continue;
      const svg = root.querySelector<SVGElement>(`#${previous.owner} svg`);
      if (!svg) continue;
      const node = ghost(previous.node, 'data-summary-morph-shape', key), from = previous.values;
      Object.entries(from).forEach(([name, value]) => node.setAttribute(name, String(value)));
      svg.append(node);
      shapeStep(node, from, { ...from, y: from.y + from.height, height: 0 });
      cleanup.push(() => node.remove());
    }

    root.querySelectorAll<SVGElement>('[data-summary-morph-line]').forEach(node => {
      const from = before.lines.get(node.dataset.summaryMorphLine!), to = points(node);
      if (!from?.length || !to.length || JSON.stringify(from) === JSON.stringify(to)) return;
      const finalPoints = node.getAttribute('points')!;
      steps.push(t => node.setAttribute('points', interpolateSummaryPoints(from, to, t).map(point => point.join(',')).join(' ')));
      cleanup.push(() => node.setAttribute('points', finalPoints));
    });

    root.querySelectorAll<HTMLElement>('[data-summary-morph-day]').forEach(node => {
      const originals = ['--day-completion', '--day-core-color', '--day-accent'].map(name => [name, node.style.getPropertyValue(name)] as const);
      const to = { angle: parseFloat(node.style.getPropertyValue('--day-completion')), core: color(node.style.getPropertyValue('--day-core-color')), accent: color(getComputedStyle(node).getPropertyValue('--day-accent')) };
      const from = before.days.get(node.dataset.summaryMorphDay!) ?? { ...to, angle: 0 };
      if (JSON.stringify(from) === JSON.stringify(to)) return;
      steps.push(t => {
        node.style.setProperty('--day-completion', `${from.angle + (to.angle - from.angle) * t}deg`);
        node.style.setProperty('--day-core-color', mixedColor(from.core, to.core, t));
        node.style.setProperty('--day-accent', mixedColor(from.accent, to.accent, t));
      });
      cleanup.push(() => originals.forEach(([name, value]) => { if (value) node.style.setProperty(name, value); else node.style.removeProperty(name); }));
    });

    if (!steps.length) { halt(true); return; }
    root.dataset.summaryPeriodMotion = 'running';
    const started = performance.now();
    // One frame loop updates only marks and counters; no layout reads or re-renders.
    function tick(now: number): void {
      if (!root.isConnected) { halt(false); return; }
      const progress = bounded((now - started) / 520), eased = 1 - (1 - progress) ** 3;
      steps.forEach(paint => paint(eased));
      if (progress < 1) frame = requestAnimationFrame(tick); else halt(true);
    }
    tick(started);
  }

  const finish = () => halt(true);
  reducedMotion.addEventListener('change', finish);
  window.addEventListener('pagehide', finish);
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  return { capture, start, finish };
}

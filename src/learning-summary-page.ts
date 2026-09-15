import './learning-summary.css';
import { readMaterialProgressRecords } from './study/materialProgress.ts';
import {
  SUMMARY_MODES,
  calendarLeadingBlankCount,
  dateKey,
  formatClockMinutes,
  shiftSummaryAnchor,
  summarizeLearningPeriod,
  summaryPeriod,
  type LearningPeriodSummary,
  type SummaryMode,
} from './study/learningSummary.ts';
import { SUBJECT_TIME_COLORS, SUBJECT_TIME_SHORT_LABELS } from './study/subjectTime.ts';
import type { StudyRecord } from './types.ts';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

let activeMode: SummaryMode = location.hash === '#month' ? 'month' : 'week';
let activeAnchor = dateKey(new Date());
let records: StudyRecord[] = [];

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
}

function formatMinutes(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded < 60) return `${rounded} 分`;
  const hours = Math.floor(rounded / 60);
  const minutes = Math.round((rounded - hours * 60) * 10) / 10;
  return minutes > 0 ? `${hours} 小時 ${minutes} 分` : `${hours} 小時`;
}

function signed(value: number, suffix: string): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '' : '±'}${rounded}${suffix}`;
}

function comparisonClass(value: number, lowerIsBetter = false): string {
  if (value === 0) return 'is-flat';
  const better = lowerIsBetter ? value < 0 : value > 0;
  return better ? 'is-up' : 'is-down';
}

function renderCalendar(summary: LearningPeriodSummary): void {
  const calendar = element<HTMLDivElement>('summaryCalendar');
  document.querySelector<HTMLElement>('.summary-calendar-weekdays')!.hidden = activeMode !== 'month';
  calendar.className = `summary-calendar is-${activeMode}`;
  element<HTMLHeadingElement>('calendarTitle').textContent = activeMode === 'week' ? '週曆' : '月曆';
  element<HTMLParagraphElement>('calendarCaption').textContent = `${summary.recordedDayCount} 天已有紀錄`;
  const maxMinutes = Math.max(1, ...summary.days.map(day => day.totalMinutes));
  const blankCount = calendarLeadingBlankCount(summary.period);
  const blanks = Array.from({ length: blankCount }, () => '<span class="summary-calendar-blank" aria-hidden="true"></span>');
  const days = summary.days.map(day => {
    const intensity = day.totalMinutes > 0 ? 0.12 + 0.58 * day.totalMinutes / maxMinutes : 0;
    const detail = day.hasRecord
      ? `${formatMinutes(day.totalMinutes)}｜完成率 ${day.completionPercent}%`
      : '尚無紀錄';
    return `<article class="summary-day${day.hasRecord ? ' has-record' : ''}" role="listitem" style="--day-completion:${day.completionPercent * 3.6}deg;--day-intensity:${intensity}">
      <span class="summary-day-week">${activeMode === 'week' ? `週${day.weekday}` : ''}</span>
      <div class="summary-day-ring"><div class="summary-day-core"><strong>${day.dayNumber}</strong></div></div>
      <span class="summary-day-detail">${escapeHtml(detail)}</span>
    </article>`;
  });
  calendar.innerHTML = [...blanks, ...days].join('');
}

function renderSubjectDistribution(summary: LearningPeriodSummary): void {
  const target = element<HTMLDivElement>('summarySubjectDistribution');
  const slices = summary.subjectTime.slices;
  if (!slices.length) {
    target.innerHTML = `<div class="summary-donut is-empty"><div><strong>0</strong><span>分鐘</span></div></div><p class="summary-empty">本期尚無完成時間紀錄。</p>`;
    return;
  }
  let cursor = 0;
  const stops = slices.map(slice => {
    const start = cursor;
    cursor += slice.percent;
    return `${slice.color} ${start}% ${Math.min(100, cursor)}%`;
  }).join(',');
  const list = slices.map(slice => `<li><i style="background:${slice.color}"></i><span>${SUBJECT_TIME_SHORT_LABELS[slice.subject]}｜${slice.subject}</span><strong>${slice.percent}%</strong></li>`).join('');
  target.innerHTML = `<div class="summary-donut" style="--donut:${stops}"><div><strong>${summary.subjectTime.totalMinutes}</strong><span>分鐘</span></div></div><ul>${list}</ul>`;
}

function renderTrend(summary: LearningPeriodSummary): void {
  const target = element<HTMLDivElement>('summaryTrend');
  const days = summary.days;
  const width = 720;
  const height = 250;
  const left = 42;
  const right = 34;
  const top = 24;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxMinutes = Math.max(60, ...days.map(day => day.totalMinutes));
  const slot = plotWidth / Math.max(1, days.length);
  const barWidth = Math.max(3, Math.min(28, slot * .58));
  const points = days.map((day, index) => ({
    x: left + slot * (index + .5),
    y: top + plotHeight * (1 - day.completionPercent / 100),
    ...day,
  }));
  const grid = [0, 50, 100].map(percent => {
    const y = top + plotHeight * (1 - percent / 100);
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/><text x="4" y="${y + 4}">${percent}%</text>`;
  }).join('');
  const bars = points.map(point => {
    const barHeight = plotHeight * point.totalMinutes / maxMinutes;
    return `<rect x="${point.x - barWidth / 2}" y="${top + plotHeight - barHeight}" width="${barWidth}" height="${barHeight}" rx="4"><title>${point.date}：${formatMinutes(point.totalMinutes)}</title></rect>`;
  }).join('');
  const line = points.map(point => `${point.x},${point.y}`).join(' ');
  const dots = points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="3.8"><title>${point.date}：完成率 ${point.completionPercent}%</title></circle>`).join('');
  const labels = points.map((point, index) => {
    const show = activeMode === 'week' || index === 0 || index === points.length - 1 || point.dayNumber % 5 === 0;
    return show ? `<text class="trend-day-label" x="${point.x}" y="${height - 13}">${activeMode === 'week' ? `週${point.weekday}` : point.dayNumber}</text>` : '';
  }).join('');
  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="本期每日學習時間與完成率趨勢">${grid}${bars}<polyline points="${line}"/>${dots}${labels}</svg>`;
}

function renderComparison(current: LearningPeriodSummary, previous: LearningPeriodSummary): void {
  const timeDelta = current.subjectTime.totalMinutes - previous.subjectTime.totalMinutes;
  const completionDelta = current.completion.settlementPercent - previous.completion.settlementPercent;
  const wakeDelta = current.averageWakeMinutes !== null && previous.averageWakeMinutes !== null
    ? current.averageWakeMinutes - previous.averageWakeMinutes
    : null;
  const wakeText = wakeDelta === null ? '資料不足' : wakeDelta === 0 ? '相同' : `${wakeDelta < 0 ? '早起' : '晚起'} ${Math.abs(wakeDelta)} 分`;
  element<HTMLDListElement>('summaryComparison').innerHTML = `
    <div><dt>學習時間</dt><dd class="${comparisonClass(timeDelta)}">${signed(timeDelta / 60, ' hr')}</dd></div>
    <div><dt>完成率</dt><dd class="${comparisonClass(completionDelta)}">${signed(completionDelta, '%')}</dd></div>
    <div><dt>平均起床</dt><dd class="${wakeDelta === null ? 'is-flat' : comparisonClass(wakeDelta, true)}">${wakeText}</dd></div>`;
}

function renderConclusion(current: LearningPeriodSummary, previous: LearningPeriodSummary): void {
  const timeDelta = current.subjectTime.totalMinutes - previous.subjectTime.totalMinutes;
  const completionDelta = current.completion.settlementPercent - previous.completion.settlementPercent;
  const timeTitle = timeDelta > 0 ? '學習時間增加' : timeDelta < 0 ? '學習時間減少' : '學習時間持平';
  const completionTitle = completionDelta > 0 ? '完成度提高' : completionDelta < 0 ? '完成度下降' : '完成度持平';
  const timeText = timeDelta === 0
    ? '本期與上期的完成學習時間相同。'
    : `本期比上期${timeDelta > 0 ? '多' : '少'}了 ${formatMinutes(Math.abs(timeDelta))}。`;
  const completionText = completionDelta === 0
    ? `本期完成率維持在 ${current.completion.settlementPercent}%。`
    : `本期完成率比上期${completionDelta > 0 ? '提高' : '降低'} ${Math.abs(completionDelta)} 個百分點。`;
  element<HTMLDivElement>('summaryConclusion').innerHTML = `
    <article class="${comparisonClass(timeDelta)}"><strong>${timeTitle}</strong><p>${timeText}</p></article>
    <article class="${comparisonClass(completionDelta)}"><strong>${completionTitle}</strong><p>${completionText}</p></article>`;
}

function renderAll(): void {
  const period = summaryPeriod(activeAnchor, activeMode);
  const previousPeriod = summaryPeriod(shiftSummaryAnchor(activeAnchor, activeMode, -1), activeMode);
  const current = summarizeLearningPeriod(records, period);
  const previous = summarizeLearningPeriod(records, previousPeriod);
  const switcher = element<HTMLDivElement>('summaryModeSwitch');
  switcher.dataset.active = String(SUMMARY_MODES.indexOf(activeMode));
  switcher.querySelectorAll<HTMLButtonElement>('[data-summary-mode]').forEach(button => {
    const selected = button.dataset.summaryMode === activeMode;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  element<HTMLElement>('periodLabel').textContent = period.label;
  element<HTMLButtonElement>('previousPeriod').ariaLabel = activeMode === 'week' ? '上一週' : '上一月';
  element<HTMLButtonElement>('nextPeriod').ariaLabel = activeMode === 'week' ? '下一週' : '下一月';
  element<HTMLParagraphElement>('wakePeriodLabel').textContent = activeMode === 'week' ? '本週平均' : '本月平均';
  element<HTMLElement>('averageWakeTime').textContent = formatClockMinutes(current.averageWakeMinutes);
  renderCalendar(current);
  renderSubjectDistribution(current);
  renderTrend(current);
  renderComparison(current, previous);
  renderConclusion(current, previous);
}

function loadRecords(): void {
  try {
    const result = readMaterialProgressRecords(localStorage);
    records = result.records;
    const source = result.prefix.startsWith('study-v11:user:') ? '目前登入帳號的本機同步資料' : '訪客本機資料';
    element<HTMLParagraphElement>('summarySource').textContent = `${source}｜共讀取 ${records.length} 天紀錄`;
    element<HTMLParagraphElement>('summaryError').hidden = true;
    renderAll();
  } catch {
    records = [];
    element<HTMLParagraphElement>('summarySource').textContent = '無法讀取 Tracker 紀錄';
    const error = element<HTMLParagraphElement>('summaryError');
    error.textContent = '瀏覽器目前不允許存取 Tracker 的本機同步資料，請回到 Tracker 確認瀏覽器儲存權限。';
    error.hidden = false;
    renderAll();
  }
}

element<HTMLDivElement>('summaryModeSwitch').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-summary-mode]');
  if (!button) return;
  const mode = button.dataset.summaryMode as SummaryMode;
  if (!SUMMARY_MODES.includes(mode)) return;
  activeMode = mode;
  history.replaceState(null, '', `${location.pathname}${location.search}#${mode}`);
  renderAll();
});
element<HTMLButtonElement>('previousPeriod').addEventListener('click', () => {
  activeAnchor = shiftSummaryAnchor(activeAnchor, activeMode, -1);
  renderAll();
});
element<HTMLButtonElement>('nextPeriod').addEventListener('click', () => {
  activeAnchor = shiftSummaryAnchor(activeAnchor, activeMode, 1);
  renderAll();
});
window.addEventListener('storage', loadRecords);
loadRecords();

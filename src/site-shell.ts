import { initialRecordPrefix } from './storage/local.ts';
import { decodeStudyRecord } from './storage/studyRecordCodec.ts';
import { overdueTasks } from './study/overdueTasks.ts';
import { overdueEntriesForPeriod } from './study/overduePeriod.ts';
import { studyItemProgress } from './study/itemProgress.ts';
import type { StudyItem, StudyRecord } from './types.ts';
const cache = new Map<string, {
    raw: string;
    record: StudyRecord;
}>();
const currentPage = location.pathname.split('/').pop() || 'index.html';
const tools = [
    ['todo.html', '待辦事項', '全部、本月、本週的逾期項目', '□'],
    ['material.progress.html', '教材進度圖', '檢視範圍與管理教材目錄', '▤'],
    ['vocabulary.review.html', '英文單字複習', '單字、組合與句子', 'Aa'],
    ['gpt.prompt.html', '排程建議prompt', '用於 AI 幫助 Google Calendar 排程', '✧'],
];
function dateKey(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function escapeText(text: string): string {
    return text.replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value]!);
}
function hasStudyInput(item: StudyItem): boolean {
    if (item.done || Number(item.minutes) > 0 || studyItemProgress(item).some(progress => progress.checked))
        return true;
    return Object.entries(item.f ?? {}).some(([key, value]) => {
        if (key === 'words')
            return Array.isArray(value) && value.some(word => typeof word === 'string' ? word.trim() : word?.text?.trim());
        if (Array.isArray(value))
            return value.some(child => child && typeof child === 'object' && 'f' in child && hasStudyInput(child as StudyItem));
        return false;
    });
}
function hasRecordInput(record: StudyRecord): boolean {
    return Boolean(record.mood || record.wakeTime || record.bedtime || record.notes?.trim() || record.biggestBlock?.trim() || record.firstThingTomorrow?.trim() || record.items.some(hasStudyInput));
}
const left = document.createElement('aside');
left.className = 'site-rail site-rail-left';
left.id = 'siteLeftRail';
left.setAttribute('aria-label', '日期與每週紀錄');
left.innerHTML = `<div class="site-rail-top"><a class="site-brand" href="./index.html"><span aria-hidden="true">✓</span><span><strong>讀書紀錄卡</strong><small>STUDY LOG</small></span></a><button type="button" class="site-rail-close" data-close-rail aria-label="收合左側紀錄欄">×</button></div><div class="site-rail-date"><span data-rail-year></span><strong data-rail-date></strong><span data-rail-weekday></span></div><section class="site-week"><span>本週紀錄</span><strong><b data-rail-days>0</b><small>／7</small></strong><p data-rail-week-description></p><div class="site-week-ticks" aria-label="本週每日紀錄"></div></section><a class="site-summary-link" href="./summary.html"${currentPage === 'summary.html' ? ' aria-current="page"' : ''}>查看週／月總結 <span aria-hidden="true">↗</span></a><div class="site-rail-bottom"><span data-rail-storage>資料儲存於本機</span><p data-rail-account></p></div>`;
const right = document.createElement('aside');
right.className = 'site-rail site-rail-right';
right.id = 'siteRightRail';
right.setAttribute('aria-label', '工具與本週逾期');
right.innerHTML = `<div class="site-rail-top"><a class="site-workspace-home" href="./index.html"${currentPage === 'index.html' ? ' aria-current="page"' : ''}><strong>GSAT Tracker</strong><span>回到主頁 ↗</span></a><button type="button" class="site-rail-close" data-close-rail aria-label="收合右側工具欄">×</button></div><nav class="site-tools" aria-label="讀書工具">${tools.map(([href, title, caption, icon]) => `<a href="./${href}"${currentPage === href ? ' aria-current="page"' : ''}><span class="site-tool-icon" aria-hidden="true">${icon}</span><span><strong>${title}</strong><small>${caption}</small></span><span class="site-tool-arrow" aria-hidden="true">→</span></a>`).join('')}</nav><section class="site-overdue"><header><h2>本週逾期</h2><span data-rail-overdue-count>0 項</span></header><div data-rail-overdue-list></div><a class="site-overdue-all" href="./todo.html?period=all">查看全部待辦 →</a></section>`;
const bar = document.createElement('div');
bar.className = 'site-mobile-bar';
bar.innerHTML = '<button type="button" data-open-rail="left" aria-controls="siteLeftRail" aria-expanded="false">☰ 紀錄</button><a href="./index.html">讀書紀錄卡</a><button type="button" data-open-rail="right" aria-controls="siteRightRail" aria-expanded="false">工具 ☷</button>';
const backdrop = document.createElement('button');
backdrop.type = 'button';
backdrop.className = 'site-rail-backdrop';
backdrop.hidden = true;
backdrop.setAttribute('aria-label', '收合資訊欄');
document.body.classList.add('has-site-shell');
document.querySelectorAll('[data-navigation="home"]').forEach(link => link.removeAttribute('data-navigation'));
right.querySelector('.site-workspace-home')!.setAttribute('data-navigation', 'home');
right.querySelectorAll<HTMLAnchorElement>('.site-tools a').forEach(link => {
    link.setAttribute('aria-label', link.querySelector('strong')!.textContent!);
    if (link.getAttribute('href') === './gpt.prompt.html') {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
    }
});
left.querySelector('.site-summary-link')!.setAttribute('aria-label', '週／月總結');
document.body.append(left, right, bar, backdrop);
let opener: HTMLElement | null = null;
function closeRail(): void {
    document.documentElement.classList.remove('site-rail-open');
    delete document.body.dataset.rail;
    backdrop.hidden = true;
    bar.querySelectorAll('[data-open-rail]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (opener)
        opener.focus({ preventScroll: true });
    opener = null;
}
bar.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-open-rail]');
    if (!button)
        return;
    if (document.body.dataset.rail === button.dataset.openRail) {
        closeRail();
        return;
    }
    closeRail();
    opener = button;
    document.body.dataset.rail = button.dataset.openRail;
    document.documentElement.classList.add('site-rail-open');
    backdrop.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    (button.dataset.openRail === 'left' ? left : right).querySelector<HTMLButtonElement>('[data-close-rail]')?.focus({ preventScroll: true });
});
backdrop.addEventListener('click', closeRail);
for (const rail of [left, right])
    rail.addEventListener('click', event => {
        if ((event.target as Element).closest('[data-close-rail]'))
            closeRail();
    });
document.addEventListener('keydown', event => {
    if (!document.body.dataset.rail)
        return;
    if (event.key === 'Escape')
        closeRail();
    if (event.key !== 'Tab')
        return;
    const rail = document.body.dataset.rail === 'left' ? left : right;
    const focusable = [...rail.querySelectorAll<HTMLElement>('a,button')].filter(node => node.getClientRects().length);
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    if (event.shiftKey && index <= 0) {
        event.preventDefault();
        focusable.at(-1)?.focus();
    }
    else if (!event.shiftKey && index === focusable.length - 1) {
        event.preventDefault();
        focusable[0]?.focus();
    }
});
matchMedia('(min-width: 1200px)').addEventListener('change', closeRail);
function updateRailStatus(): void {
    const badge = document.getElementById('cloudStatusBadge');
    const state = badge?.textContent?.trim();
    left.querySelector('[data-rail-storage]')!.textContent = state ? `Cloud：${state}` : '資料儲存於本機';
}
function refreshRails(): void {
    try {
        const prefix = initialRecordPrefix(localStorage), records: StudyRecord[] = [], keys = new Set<string>();
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key?.startsWith(prefix) || !/^\d{4}-\d{2}-\d{2}$/.test(key.slice(prefix.length)))
                continue;
            const raw = localStorage.getItem(key);
            if (!raw)
                continue;
            keys.add(key);
            let value = cache.get(key);
            if (value?.raw !== raw) {
                const decoded = decodeStudyRecord(raw, key.slice(prefix.length));
                if (!decoded.ok)
                    continue;
                value = { raw, record: decoded.record };
                cache.set(key, value);
            }
            if (value)
                records.push(value.record);
        }
        for (const key of cache.keys())
            if (!keys.has(key))
                cache.delete(key);
        const today = dateKey(), selected = (document.getElementById('studyDate') as HTMLInputElement | null)?.value || today;
        const anchor = new Date(`${selected}T12:00:00`), monday = new Date(anchor);
        monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
        let count = 0;
        const ticks = Array.from({ length: 7 }, (_, index) => {
            const day = new Date(monday);
            day.setDate(day.getDate() + index);
            const key = dateKey(day);
            const entered = key <= today && records.some(record => record.date === key && hasRecordInput(record));
            if (entered)
                count += 1;
            return `<span${entered ? ' class="has-record"' : ''} title="${key}${entered ? ' 已填寫' : ' 尚未填寫'}">${['一', '二', '三', '四', '五', '六', '日'][index]}</span>`;
        });
        left.querySelector('[data-rail-year]')!.textContent = String(anchor.getFullYear());
        left.querySelector('[data-rail-date]')!.textContent = `${String(anchor.getMonth() + 1).padStart(2, '0')}.${String(anchor.getDate()).padStart(2, '0')}`;
        left.querySelector('[data-rail-weekday]')!.textContent = `星期${'日一二三四五六'[anchor.getDay()]}`;
        left.querySelector('[data-rail-days]')!.textContent = String(count);
        left.querySelector('[data-rail-week-description]')!.textContent = `已填寫 ${count} 天紀錄`;
        left.querySelector('.site-week-ticks')!.innerHTML = ticks.join('');
        left.querySelector('[data-rail-account]')!.textContent = prefix.includes(':user:') ? '目前帳號的本機資料' : '訪客本機資料';
        const pending = overdueEntriesForPeriod(overdueTasks(records, today), 'week', today);
        right.querySelector('[data-rail-overdue-count]')!.textContent = `${pending.length} 項`;
        right.querySelector('[data-rail-overdue-list]')!.innerHTML = pending.length ? pending.slice(0, 5).map(entry => `<a class="site-overdue-item" href="./todo.html?period=week#${entry.subject}"><strong>${escapeText(entry.title)}</strong><small>${entry.recordDate} · ${escapeText(entry.subjectLabel)}</small></a>`).join('') : '<p class="site-overdue-empty">本週尚無逾期項目</p>';
        updateRailStatus();
    }
    catch {
        left.querySelector('[data-rail-account]')!.textContent = '無法讀取本機資料';
        right.querySelector('[data-rail-overdue-list]')!.textContent = '本機資料暫時無法讀取。';
    }
}
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRefresh(): void { clearTimeout(refreshTimer); refreshTimer = setTimeout(refreshRails, 180); }
window.addEventListener('storage', scheduleRefresh);
window.addEventListener('study-records-changed', scheduleRefresh);
window.addEventListener('pageshow', scheduleRefresh);
window.addEventListener('focus', scheduleRefresh);
document.getElementById('studyDate')?.addEventListener('change', scheduleRefresh);
const badge = document.getElementById('cloudStatusBadge');
if (badge)
    new MutationObserver(updateRailStatus).observe(badge, { childList: true, subtree: true, characterData: true });
setInterval(scheduleRefresh, 60000);
refreshRails();

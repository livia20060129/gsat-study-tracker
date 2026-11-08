import '../tracker-overview.css';
/** Keep the existing select and change handler as the single saved mood value. */
function initializeMoodSlider(): void {
    const select = document.getElementById('mood') as HTMLSelectElement;
    const moods = document.createElement('div');
    moods.className = 'mood-segments';
    moods.setAttribute('role', 'group');
    moods.setAttribute('aria-label', '今日狀態');
    const indicator = document.createElement('span');
    indicator.className = 'mood-segment-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    moods.append(indicator);
    const buttons = [...select.options].map(function moodButton(option, index): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = option.text;
        button.addEventListener('click', function selectMood(): void {
            select.selectedIndex = index;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        moods.append(button);
        return button;
    });
    function updateMood(): void {
        moods.style.setProperty('--mood-index', String(select.selectedIndex));
        buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === select.selectedIndex)));
    }
    select.classList.add('mood-native-source');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.after(moods);
    select.addEventListener('change', updateMood);
    new MutationObserver(updateMood).observe(document.getElementById('weekdayText')!, { childList: true, characterData: true, subtree: true });
    updateMood();
}
function initializeRoutineDisclosure(): void {
    const field = document.getElementById('routineTimeField')!;
    const grid = field.closest('.today-info-grid')!;
    const details = document.createElement('details');
    details.id = 'routineDisclosure';
    details.className = 'routine-disclosure';
    const summary = document.createElement('summary');
    summary.innerHTML = '<strong><span data-home-icon="clock" aria-hidden="true"></span>作息時間</strong><span class="routine-disclosure-toggle"><span class="routine-expand">展開</span><span class="routine-collapse">收合</span><i aria-hidden="true"></i></span>';
    field.before(details);
    details.append(summary, field);
    grid.prepend(details);
    const nextDay = field.querySelector('.routine-time-meta');
    if (nextDay)
        summary.insertBefore(nextDay, summary.lastElementChild);
    details.addEventListener('toggle', function updateRoutineDisclosureState(): void {
        summary.setAttribute('aria-expanded', String(details.open && details.dataset.disclosureMotion !== 'closing'));
    });
    summary.setAttribute('aria-expanded', 'false');
}
export function initializeTrackerLayout(): void {
    initializeMoodSlider();
    initializeRoutineDisclosure();
    initializeHomeHeader();
}

/** Small inline line icons keep the home screen independent of an icon runtime. */
function initializeHomeHeader(): void {
    const paths: Record<string, string> = {
        book: '<path d="M12 7v14m0-14C9 4 5 4 2 5v15c4-1 7-1 10 1 3-2 6-2 10-1V5c-3-1-7-1-10 2Z"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
        save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
        settings: '<path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 3 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-3Z"/><circle cx="12" cy="11" r="3"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
        heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M3 12h4l2-3 3 6 2-3h7"/>',
        clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h6"/>',
        flag: '<path d="M4 22V3c5-3 9 3 16 0v11c-7 3-11-3-16 0"/>',
        note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    };
    function renderIcons(root: ParentNode): void {
        root.querySelectorAll<HTMLElement>('[data-home-icon]').forEach(node => {
            node.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[node.dataset.homeIcon!] || ''}</svg>`;
        });
    }
    renderIcons(document);
    const date = document.getElementById('studyDate') as HTMLInputElement;
    const mobileBar = document.getElementById('siteMobileBar');
    const mobileHome = mobileBar?.querySelector<HTMLAnchorElement>('.site-mobile-home');
    const homeDate = document.querySelector<HTMLButtonElement>('[data-home-date]');
    if (mobileHome && homeDate) {
        mobileHome.setAttribute('aria-label', 'GSAT Tracker');
        mobileHome.innerHTML = '<span data-home-icon="book" aria-hidden="true"></span><span>GSAT Tracker<small>每日讀書完成度紀錄卡</small></span>';
        mobileBar!.append(homeDate.cloneNode(true));
        renderIcons(mobileHome);
    }
    function updateDate(): void {
        const value = date.value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
        const selected = new Date(`${value}T12:00:00`);
        document.querySelectorAll('[data-home-date-label]').forEach(node => {
            node.textContent = `${value.slice(5).replace('-', '.')} 星期${'日一二三四五六'[selected.getDay()]}`;
        });
    }
    document.querySelectorAll('[data-home-date]').forEach(button => button.addEventListener('click', () => {
        const mobile = document.querySelector<HTMLButtonElement>('#siteMobileBar [data-mobile-section="date"]');
        if (mobile && matchMedia('(max-width:1199px)').matches) mobile.click();
        else { date.focus({ preventScroll: true }); try { date.showPicker(); } catch { date.click(); } }
    }));
    document.querySelector('[data-home-save]')?.addEventListener('click', () => {
        document.getElementById('saveBtn')!.click();
    });
    date.addEventListener('change', updateDate);
    new MutationObserver(updateDate).observe(document.getElementById('weekdayText')!, { childList: true, subtree: true });
    updateDate();
}

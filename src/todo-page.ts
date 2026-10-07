import './todo-page.css';

import { markRecordLocallyEdited } from './storage/recordSync.ts';
import { readMaterialProgressRecords } from './study/materialProgress.ts';
import {
  normalizedOverdueSubject,
  OVERDUE_TASK_SUBJECTS,
  overdueSubjectIndex,
  overdueTasks,
  updateOverdueTaskCompletion,
  updateOverdueTaskMinutes,
  updateOverdueTaskSkip,
  type OverdueTaskEntry,
  type OverdueTaskSubject,
} from './study/overdueTasks.ts';
import type { StudyRecord } from './types.ts';

interface TodoActionTarget {
  recordDate: string;
  itemId: string;
  title: string;
}

interface UndoAction extends TodoActionTarget {
  kind: 'complete' | 'skip';
}

let activeSubject = normalizedOverdueSubject(location.hash.replace(/^#/, ''));
let recordPrefix = 'study-v11:guest:';
let records: StudyRecord[] = [];
let lastAction: UndoAction | null = null;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[2])}/${Number(match[3])}` : value;
}

function setError(message: string): void {
  const error = element<HTMLParagraphElement>('todoError');
  error.textContent = message;
  error.hidden = !message;
}

function setFeedback(message: string, canUndo = false): void {
  const feedback = element<HTMLDivElement>('todoFeedback');
  element<HTMLSpanElement>('todoFeedbackText').textContent = message;
  element<HTMLButtonElement>('undoSkip').hidden = !canUndo;
  feedback.hidden = !message;
}

function visibleEntries(entries: OverdueTaskEntry[]): OverdueTaskEntry[] {
  if (activeSubject === 'all') return entries;
  return entries.filter(function hasActiveSubject(entry): boolean {
    return entry.subject === activeSubject;
  });
}

function createMeta(entry: OverdueTaskEntry): HTMLElement {
  const meta = document.createElement('div');
  meta.className = 'todo-card-meta';

  const subject = document.createElement('span');
  subject.className = 'todo-subject';
  subject.textContent = entry.subjectLabel;

  const date = document.createElement('span');
  date.textContent = `原排程 ${displayDate(entry.recordDate)}`;

  const overdue = document.createElement('span');
  overdue.className = 'todo-overdue';
  overdue.textContent = `逾期 ${entry.daysOverdue} 天`;
  meta.append(subject, date, overdue);
  return meta;
}

function createTodoCard(entry: OverdueTaskEntry): HTMLElement {
  const article = document.createElement('article');
  article.className = `todo-card subject-${entry.subject}`;

  const main = document.createElement('div');
  main.className = 'todo-card-main';
  main.append(createMeta(entry));

  const title = document.createElement('h3');
  title.textContent = entry.title;
  main.append(title);

  if (entry.description) {
    const description = document.createElement('p');
    description.className = 'todo-description';
    description.textContent = entry.description;
    main.append(description);
  }

  const detailGrid = document.createElement('dl');
  detailGrid.className = 'todo-record-grid';
  for (const detail of entry.details) {
    const label = document.createElement('dt');
    label.textContent = detail.label;
    const value = document.createElement('dd');
    value.textContent = detail.value;
    detailGrid.append(label, value);
  }
  main.append(detailGrid);

  const controls = document.createElement('div');
  controls.className = 'todo-card-controls';

  const minutesField = document.createElement('label');
  minutesField.className = 'todo-control-field todo-minutes-field';
  const minutesLabel = document.createElement('span');
  minutesLabel.textContent = '學習時間';
  const minutesRow = document.createElement('span');
  minutesRow.className = 'todo-minutes-row';
  const minutes = document.createElement('input');
  minutes.type = 'number';
  minutes.min = '0';
  minutes.step = '0.1';
  minutes.inputMode = 'decimal';
  minutes.value = entry.minutes;
  minutes.dataset.todoMinutes = '';
  minutes.dataset.recordDate = entry.recordDate;
  minutes.dataset.itemId = entry.itemId;
  minutes.dataset.title = entry.title;
  minutes.setAttribute('aria-label', `${entry.title}的學習時間`);
  const minutesUnit = document.createElement('span');
  minutesUnit.textContent = '分鐘';
  minutesRow.append(minutes, minutesUnit);
  minutesField.append(minutesLabel, minutesRow);

  const dateField = document.createElement('label');
  dateField.className = 'todo-control-field';
  const dateLabel = document.createElement('span');
  dateLabel.textContent = '完成日期';
  const completionDate = document.createElement('input');
  completionDate.type = 'date';
  completionDate.value = localDateKey();
  completionDate.dataset.todoCompletionDate = '';
  completionDate.setAttribute('aria-label', `${entry.title}的完成日期`);
  dateField.append(dateLabel, completionDate);

  const complete = document.createElement('button');
  complete.type = 'button';
  complete.className = 'todo-complete';
  complete.textContent = '標記完成';
  complete.dataset.recordDate = entry.recordDate;
  complete.dataset.itemId = entry.itemId;
  complete.dataset.title = entry.title;
  complete.setAttribute('aria-label', `標記完成 ${entry.title}`);

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'todo-skip';
  skip.textContent = '跳過';
  skip.dataset.recordDate = entry.recordDate;
  skip.dataset.itemId = entry.itemId;
  skip.dataset.title = entry.title;
  skip.setAttribute('aria-label', `跳過 ${entry.title}`);
  controls.append(minutesField, dateField, complete, skip);
  article.append(main, controls);
  return article;
}

function render(): void {
  const entries = overdueTasks(records, localDateKey());
  const filtered = visibleEntries(entries);
  document.body.dataset.subject = activeSubject;

  const switcher = element<HTMLDivElement>('subjectSwitch');
  switcher.dataset.active = String(overdueSubjectIndex(activeSubject));
  switcher.querySelectorAll<HTMLButtonElement>('[data-subject]').forEach(function updateTab(button): void {
    const selected = button.dataset.subject === activeSubject;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });

  const summary = activeSubject === 'all'
    ? `共有 ${entries.length} 項待辦`
    : `目前科目 ${filtered.length} 項｜全部 ${entries.length} 項`;
  element<HTMLElement>('todoSummary').textContent = summary;
  element<HTMLDivElement>('todoList').replaceChildren(...filtered.map(createTodoCard));
  element<HTMLParagraphElement>('todoEmpty').hidden = filtered.length > 0;
}

function saveRecordChange(
  action: TodoActionTarget,
  update: (record: StudyRecord) => StudyRecord | null,
): boolean {
  const recordIndex = records.findIndex(function hasDate(record): boolean {
    return record.date === action.recordDate;
  });
  if (recordIndex < 0) return false;
  const previous = records[recordIndex];
  const updated = update(previous);
  if (!updated) return false;
  const edited = markRecordLocallyEdited(updated, previous);
  localStorage.setItem(`${recordPrefix}${action.recordDate}`, JSON.stringify(edited));
  records[recordIndex] = edited;
  return true;
}

function saveSkippedState(action: TodoActionTarget, skippedOn: string | null): boolean {
  return saveRecordChange(action, function updateSkip(record): StudyRecord | null {
    return updateOverdueTaskSkip(record, action.itemId, skippedOn);
  });
}

function skipTask(action: TodoActionTarget): void {
  try {
    if (!saveSkippedState(action, localDateKey())) {
      setError('找不到原始項目，請重新讀取後再試。');
      return;
    }
    lastAction = { ...action, kind: 'skip' };
    setError('');
    setFeedback(`已跳過「${action.title}」。原排程日期仍保留未完成紀錄。`, true);
    render();
  } catch {
    setError('無法保存跳過狀態，請確認瀏覽器儲存權限。');
  }
}

function completeTask(action: TodoActionTarget, completionDate: string): void {
  try {
    const saved = saveRecordChange(action, function updateCompletion(record): StudyRecord | null {
      return updateOverdueTaskCompletion(record, action.itemId, true, completionDate);
    });
    if (!saved) {
      setError('找不到原始項目或完成日期無效，請重新讀取後再試。');
      return;
    }
    lastAction = { ...action, kind: 'complete' };
    setError('');
    setFeedback(`已完成「${action.title}」，完成日期為 ${completionDate}。原紀錄卡已同步更新。`, true);
    render();
  } catch {
    setError('無法保存完成狀態，請確認瀏覽器儲存權限。');
  }
}

function saveMinutes(action: TodoActionTarget, minutes: string): void {
  try {
    const saved = saveRecordChange(action, function updateMinutes(record): StudyRecord | null {
      return updateOverdueTaskMinutes(record, action.itemId, minutes);
    });
    if (!saved) {
      setError('學習時間必須是 0 以上的數字。');
      return;
    }
    setError('');
    setFeedback(`已將「${action.title}」的學習時間保存為 ${minutes || '—'} 分鐘。`);
  } catch {
    setError('無法保存學習時間，請確認瀏覽器儲存權限。');
  }
}

function undoLastAction(): void {
  if (!lastAction) return;
  try {
    const action = lastAction;
    const saved = action.kind === 'skip'
      ? saveSkippedState(action, null)
      : saveRecordChange(action, function undoCompletion(record): StudyRecord | null {
        return updateOverdueTaskCompletion(record, action.itemId, false, localDateKey());
      });
    if (!saved) {
      setError('找不到原始項目，請重新讀取後再試。');
      return;
    }
    const title = action.title;
    lastAction = null;
    setError('');
    setFeedback(`已復原「${title}」，項目重新列入待辦且仍維持未完成。`);
    render();
  } catch {
    setError('無法復原跳過狀態，請確認瀏覽器儲存權限。');
  }
}

function load(): void {
  try {
    const result = readMaterialProgressRecords(localStorage);
    records = result.records;
    recordPrefix = result.prefix;
    lastAction = null;
    const source = result.prefix.startsWith('study-v11:user:') ? '目前登入帳號的本機同步資料' : '訪客本機資料';
    element<HTMLParagraphElement>('recordSource').textContent = `${source}｜已讀取 ${result.records.length} 天紀錄`;
    setError('');
    setFeedback('');
    render();
  } catch {
    records = [];
    lastAction = null;
    element<HTMLParagraphElement>('recordSource').textContent = '無法讀取本機紀錄';
    setFeedback('');
    setError('瀏覽器目前不允許存取 Tracker 的本機資料，請回到 Tracker 確認瀏覽器儲存權限。');
    render();
  }
}

function selectSubject(subject: OverdueTaskSubject, focus = false): void {
  activeSubject = subject;
  history.replaceState(null, '', `${location.pathname}${location.search}#${subject}`);
  render();
  if (focus) {
    element<HTMLDivElement>('subjectSwitch')
      .querySelector<HTMLButtonElement>(`[data-subject="${subject}"]`)?.focus();
  }
}

element<HTMLDivElement>('subjectSwitch').addEventListener('click', function switchSubject(event): void {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-subject]');
  if (button) selectSubject(normalizedOverdueSubject(button.dataset.subject));
});

element<HTMLDivElement>('subjectSwitch').addEventListener('keydown', function moveSubject(event): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const current = overdueSubjectIndex(activeSubject);
  let next = current;
  if (event.key === 'ArrowLeft') next = (current - 1 + OVERDUE_TASK_SUBJECTS.length) % OVERDUE_TASK_SUBJECTS.length;
  if (event.key === 'ArrowRight') next = (current + 1) % OVERDUE_TASK_SUBJECTS.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = OVERDUE_TASK_SUBJECTS.length - 1;
  selectSubject(OVERDUE_TASK_SUBJECTS[next], true);
});

element<HTMLDivElement>('todoList').addEventListener('click', function handleSkip(event): void {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.todo-skip, .todo-complete');
  const recordDate = button?.dataset.recordDate;
  const itemId = button?.dataset.itemId;
  if (!recordDate || !itemId) return;
  const action = { recordDate, itemId, title: button.dataset.title || '未命名項目' };
  if (button.classList.contains('todo-skip')) {
    skipTask(action);
    return;
  }
  const card = button.closest<HTMLElement>('.todo-card');
  const completionDate = card?.querySelector<HTMLInputElement>('[data-todo-completion-date]')?.value ?? '';
  completeTask(action, completionDate);
});

element<HTMLDivElement>('todoList').addEventListener('change', function handleMinutes(event): void {
  const input = (event.target as HTMLElement).closest<HTMLInputElement>('[data-todo-minutes]');
  const recordDate = input?.dataset.recordDate;
  const itemId = input?.dataset.itemId;
  if (!input || !recordDate || !itemId) return;
  saveMinutes({ recordDate, itemId, title: input.dataset.title || '未命名項目' }, input.value);
});

element<HTMLButtonElement>('undoSkip').addEventListener('click', undoLastAction);
element<HTMLButtonElement>('refreshTodo').addEventListener('click', load);
window.addEventListener('storage', load);
window.addEventListener('hashchange', function syncHash(): void {
  activeSubject = normalizedOverdueSubject(location.hash.replace(/^#/, ''));
  render();
});

load();

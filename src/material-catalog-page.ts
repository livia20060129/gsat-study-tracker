import './material-catalog.css';
import { saveCatalogMaterial } from './application/records/catalogEdits.ts';
import { builtInMaterialCatalog, readMaterialProgressRecords } from './study/materialProgress.ts';
import { CATALOG_SUBJECTS, catalogGroups, catalogModeNoun, catalogOverrides, catalogValidationError, effectiveMaterialCatalog, type CatalogMaterial, type CatalogSection, type CatalogSubject } from './study/materialCatalog.ts';
import type { StudyRecord } from './types.ts';

const builtins = builtInMaterialCatalog();
let records: StudyRecord[] = [];
let prefix = '';
let entries: CatalogMaterial[] = [];
let editing: CatalogMaterial | null = null;
let expected: CatalogMaterial | null = null;
let busy = false;

function el<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }
function message(text: string, error = false): void {
  el('catalogError').hidden = !error;
  el('catalogError').textContent = error ? text : '';
  el('catalogStatus').textContent = error ? '' : text;
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function newId(): string { return crypto.randomUUID(); }
function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function option(value: string): HTMLOptionElement { return new Option(value, value); }
function updateGroups(selected?: string): void {
  const values = catalogGroups(el<HTMLSelectElement>('catalogSubject').value as CatalogSubject);
  el<HTMLSelectElement>('catalogGroup').replaceChildren(...values.map(option));
  if (selected && values.includes(selected)) el<HTMLSelectElement>('catalogGroup').value = selected;
}
function updateLabels(): void {
  const mode = el<HTMLSelectElement>('catalogMode').value as CatalogMaterial['mode'];
  el('catalogTotalLabel').textContent = `總${catalogModeNoun(mode)}數`;
}
function sectionRow(section: CatalogSection): HTMLElement {
  const row = document.createElement('div'); row.className = 'catalog-section'; row.dataset.sectionId = section.id;
  for (const [field, name] of [['topic', '大單元'], ['detail', '小主題（可不填）'], ['start', '起始'], ['end', '結束']] as const) {
    const label = document.createElement('label'); label.textContent = name;
    const input = document.createElement('input'); input.dataset.sectionField = field; input.value = String(section[field]);
    if (field === 'start' || field === 'end') { input.type = 'number'; input.min = '1'; input.step = '1'; input.required = true; }
    else { input.maxLength = 200; input.required = field === 'topic'; }
    label.append(input); row.append(label);
  }
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger'; remove.textContent = '刪除此列';
  remove.addEventListener('click', function removeSection(): void { row.remove(); }); row.append(remove);
  return row;
}
function openEditor(entry?: CatalogMaterial): void {
  if (busy) return;
  editing = clone(entry ?? { id: `custom:${newId()}`, title: '', subject: '英文', group: '補充', mode: 'pages', total: 1, sections: [], revision: 0, updatedAt: '' });
  expected = clone(catalogOverrides(records).find(current => current.id === editing!.id) ?? null);
  el('catalogEditorTitle').textContent = entry ? '編輯教材' : '新增教材';
  el<HTMLInputElement>('catalogTitle').value = editing.title;
  el<HTMLSelectElement>('catalogSubject').value = editing.subject;
  updateGroups(editing.group);
  el<HTMLSelectElement>('catalogMode').value = editing.mode;
  el<HTMLInputElement>('catalogTotal').value = editing.total > 10000 ? '' : String(editing.total);
  updateLabels();
  el('catalogSections').replaceChildren(...editing.sections.map(sectionRow));
  el('catalogEditor').hidden = false;
  el('catalogEditor').scrollIntoView({ block: 'start' });
  el<HTMLInputElement>('catalogTitle').focus({ preventScroll: true });
}
function readDraft(): CatalogMaterial {
  if (!editing) throw new Error('請先選擇教材。');
  const sections = [...document.querySelectorAll<HTMLElement>('[data-section-id]')].map(function readSection(row): CatalogSection {
    function value(field: string): string { return row.querySelector<HTMLInputElement>(`[data-section-field="${field}"]`)!.value.trim(); }
    return { id: row.dataset.sectionId!, start: Number(value('start')), end: Number(value('end')), topic: value('topic'), detail: value('detail') };
  });
  return { ...editing, title: el<HTMLInputElement>('catalogTitle').value.trim(), subject: el<HTMLSelectElement>('catalogSubject').value as CatalogSubject,
    group: el<HTMLSelectElement>('catalogGroup').value, mode: el<HTMLSelectElement>('catalogMode').value as CatalogMaterial['mode'], total: Number(el<HTMLInputElement>('catalogTotal').value),
    sections: sections.sort((left, right) => left.start - right.start), deleted: false, reset: false };
}
function refresh(): void {
  const loaded = readMaterialProgressRecords(localStorage); prefix = loaded.prefix; records = loaded.records;
  entries = effectiveMaterialCatalog(builtins, records, true);
  el('catalogScope').textContent = prefix.startsWith('study-v11:user:') ? '目前登入帳號的教材目錄' : '訪客的教材目錄';
  renderList();
}
function renderList(): void {
  const query = el<HTMLInputElement>('catalogSearch').value.trim().toLowerCase();
  const subject = el<HTMLSelectElement>('catalogFilter').value;
  const filtered = entries.filter(entry => (!subject || entry.subject === subject) && `${entry.title} ${entry.subject}`.toLowerCase().includes(query));
  el('catalogList').replaceChildren(...filtered.map(function renderEntry(entry): HTMLElement {
    const row = document.createElement('article'); row.className = `catalog-row${entry.deleted ? ' is-deleted' : ''}`;
    const head = document.createElement('div'); head.className = 'catalog-row-head';
    const title = document.createElement('h3'); title.textContent = `${entry.subject}｜${entry.title}`;
    const actions = document.createElement('div'); actions.className = 'catalog-row-actions';
    function action(label: string, handler: () => void): void {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', handler); actions.append(button);
    }
    action('編輯', () => openEditor(entry));
    if (!entry.deleted) action('刪除目錄', () => { if (confirm(`刪除「${entry.title}」的目錄？既有讀書紀錄會保留。`)) void commit({ ...entry, deleted: true }, catalogOverrides(records).find(current => current.id === entry.id) ?? null); });
    else action('恢復教材', () => { void commit({ ...entry, deleted: false }, catalogOverrides(records).find(current => current.id === entry.id) ?? null); });
    const builtin = builtins.find(current => current.id === entry.id);
    if (builtin && entry.revision > 0) action('還原內建', () => { if (confirm('還原此教材的內建目錄設定？已填紀錄會保留。')) void commit({ ...builtin, reset: true }, catalogOverrides(records).find(current => current.id === entry.id) ?? null); });
    head.append(title, actions);
    const note = document.createElement('p'); const noun = catalogModeNoun(entry.mode);
    note.textContent = `${entry.group}｜${entry.total > 10000 ? '末頁尚未設定' : `共 ${entry.total} ${noun}`}｜${entry.sections.length} 筆章節對照｜${builtin ? '內建教材' : '自行新增'}${entry.deleted ? '｜已停用' : ''}`;
    row.append(head, note); return row;
  }));
  if (!filtered.length) el('catalogList').textContent = '沒有符合條件的教材。';
}
async function commit(entry: CatalogMaterial, base: CatalogMaterial | null): Promise<void> {
  if (busy) return;
  const error = catalogValidationError(entry); if (error) { message(error, true); return; }
  if (!entry.deleted && !entry.reset && entries.some(other => other.id !== entry.id && !other.deleted && other.subject === entry.subject && other.title.toLowerCase() === entry.title.toLowerCase())) { message('同科目已有相同書名，請編輯原教材或使用不同名稱。', true); return; }
  busy = true;
  el<HTMLButtonElement>('newMaterial').disabled = true;
  try {
    const updated = { ...entry, revision: (base?.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
    await saveCatalogMaterial(localStorage, prefix, updated, base, localDate());
    editing = null; el('catalogEditor').hidden = true; refresh();
    message('教材已儲存；可回 Tracker 選用。登入帳號的變更會在返回 Tracker 後同步雲端。');
  } catch (error) { message(error instanceof Error ? error.message : '教材儲存失敗。', true); }
  finally { busy = false; el<HTMLButtonElement>('newMaterial').disabled = false; }
}

el<HTMLSelectElement>('catalogSubject').replaceChildren(...CATALOG_SUBJECTS.map(option));
el<HTMLSelectElement>('catalogFilter').append(...CATALOG_SUBJECTS.map(option));
el('newMaterial').addEventListener('click', () => openEditor());
el('catalogSubject').addEventListener('change', () => updateGroups());
el('catalogMode').addEventListener('change', updateLabels);
el('catalogSearch').addEventListener('input', renderList);
el('catalogFilter').addEventListener('change', renderList);
el('cancelCatalogEdit').addEventListener('click', () => { if (!busy) { editing = null; el('catalogEditor').hidden = true; } });
el('addCatalogSection').addEventListener('click', () => el('catalogSections').append(sectionRow({ id: newId(), topic: '', detail: '', start: 1, end: 1 })));
el('catalogForm').addEventListener('submit', function submit(event): void { event.preventDefault(); void commit(readDraft(), expected); });
window.addEventListener('storage', function accountChanged(event): void {
  if (!event.key?.startsWith('study-v11:')) return;
  if (editing) { message('其他頁面的資料已更新；儲存時會再次檢查，草稿仍保留。'); return; }
  refresh();
});
try { refresh(); } catch { message('無法讀取本機教材，請確認瀏覽器的儲存權限。', true); }

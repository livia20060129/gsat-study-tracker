import './vocabulary-review.css';
import { markRecordLocallyEdited } from './storage/recordSync.ts';
import { readMaterialProgressRecords } from './study/materialProgress.ts';
import {
  updateVocabularyWordEntries,
  VOCABULARY_PARTS_OF_SPEECH,
  vocabularyReviewEntries,
  type VocabularyPartOfSpeechField,
  type VocabularyReviewEntry,
  type VocabularyWordEdits,
} from './study/vocabularyReview.ts';
import type { StudyRecord } from './types.ts';

type VocabularyGroupingMode = 'alphabetical' | 'partOfSpeech';

let allEntries: VocabularyReviewEntry[] = [];
let loadedRecords: StudyRecord[] = [];
let activeRecordPrefix = '';
let activeLetter = '全部';
let groupingMode: VocabularyGroupingMode = 'alphabetical';
let searchText = '';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
}

function cloneRecord(record: StudyRecord): StudyRecord {
  return JSON.parse(JSON.stringify(record)) as StudyRecord;
}

function entryMatchesSearch(entry: VocabularyReviewEntry): boolean {
  if (!searchText) return true;
  const searchable = [
    entry.text,
    entry.lookupQuery,
    entry.translation,
    ...entry.tags,
    ...entry.contentKinds,
  ].join(' ').toLocaleLowerCase('en-US');
  return searchable.includes(searchText.toLocaleLowerCase('en-US'));
}

function filteredEntries(): VocabularyReviewEntry[] {
  return allEntries.filter(entry => (
    (groupingMode !== 'alphabetical' || activeLetter === '全部' || entry.letter === activeLetter)
    && entryMatchesSearch(entry)
  ));
}

function createWordLink(entry: VocabularyReviewEntry): HTMLElement {
  if (!entry.lookupUrl) {
    const text = document.createElement('span');
    text.className = 'vocabulary-word-text';
    text.textContent = entry.text;
    return text;
  }
  const link = document.createElement('a');
  link.className = 'vocabulary-word-link';
  link.href = entry.lookupUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = entry.text;
  link.title = `在 Oxford Learner's Dictionaries 查詢「${entry.lookupQuery}」`;
  link.setAttribute('aria-label', `${entry.text}；在 Oxford Learner's Dictionaries 開啟查詢結果`);
  return link;
}

function saveEntryEdits(entry: VocabularyReviewEntry, edits: VocabularyWordEdits): void {
  let changed = false;
  try {
    loadedRecords = loadedRecords.map(record => {
      const previous = cloneRecord(record);
      if (!updateVocabularyWordEntries(record, entry.key, edits)) return record;
      const edited = markRecordLocallyEdited(record, previous);
      localStorage.setItem(`${activeRecordPrefix}${edited.date}`, JSON.stringify(edited));
      changed = true;
      return edited;
    });
    if (!changed) return;
    allEntries = vocabularyReviewEntries(loadedRecords);
    const status = element<HTMLParagraphElement>('vocabularySaveStatus');
    status.textContent = `已儲存「${entry.text}」的整理資料，回到 Tracker 後會接續雲端同步。`;
    render();
  } catch {
    const error = element<HTMLParagraphElement>('vocabularyError');
    error.textContent = `無法儲存「${entry.text}」的修改，請確認瀏覽器儲存權限後再試一次。`;
    error.hidden = false;
  }
}

function selectedPartsOfSpeech(container: HTMLElement): Set<VocabularyPartOfSpeechField> {
  const fields = new Set<VocabularyPartOfSpeechField>();
  for (const checkbox of container.querySelectorAll<HTMLInputElement>('[data-vocabulary-pos]')) {
    if (checkbox.checked) fields.add(checkbox.dataset.vocabularyPos as VocabularyPartOfSpeechField);
  }
  return fields;
}

function createPartsOfSpeechEditor(entry: VocabularyReviewEntry): HTMLFieldSetElement {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'vocabulary-pos-editor';
  fieldset.dataset.entryKey = entry.key;
  const legend = document.createElement('legend');
  legend.textContent = '詞性';
  fieldset.append(legend);

  for (const [field, label] of VOCABULARY_PARTS_OF_SPEECH) {
    const option = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.vocabularyPos = field;
    checkbox.checked = entry.tags.includes(label);
    option.append(checkbox, document.createTextNode(label));
    fieldset.append(option);
  }
  return fieldset;
}

function createTranslationEditor(entry: VocabularyReviewEntry): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'vocabulary-translation-editor';
  const title = document.createElement('span');
  title.textContent = '中文翻譯';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = entry.translation;
  input.placeholder = '輸入中文翻譯';
  input.autocomplete = 'off';
  input.dataset.vocabularyTranslation = entry.key;
  label.append(title, input);
  return label;
}

function createVocabularyRow(entry: VocabularyReviewEntry): HTMLElement {
  const article = document.createElement('article');
  article.className = 'vocabulary-row';
  article.dataset.entryKey = entry.key;

  const identity = document.createElement('div');
  identity.className = 'vocabulary-identity';
  identity.append(createWordLink(entry));
  const kinds = document.createElement('div');
  kinds.className = 'vocabulary-kinds';
  for (const kind of entry.contentKinds) {
    const badge = document.createElement('span');
    badge.textContent = kind;
    kinds.append(badge);
  }
  identity.append(kinds);
  if (entry.occurrenceCount > 1) {
    const occurrence = document.createElement('p');
    occurrence.className = 'vocabulary-occurrence';
    occurrence.textContent = `已整理 ${entry.occurrenceCount} 次`;
    identity.append(occurrence);
  }

  const editors = document.createElement('div');
  editors.className = 'vocabulary-editors';
  editors.append(createPartsOfSpeechEditor(entry), createTranslationEditor(entry));
  article.append(identity, editors);
  return article;
}

function createVocabularyGroup(
  key: string,
  label: string,
  entries: VocabularyReviewEntry[],
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'vocabulary-letter-group';
  section.id = `vocabulary-group-${key}`;
  const heading = document.createElement('h2');
  heading.textContent = label;
  const list = document.createElement('div');
  list.className = 'vocabulary-letter-list';
  list.append(...entries.map(createVocabularyRow));
  section.append(heading, list);
  return section;
}

function renderLetters(): void {
  const availableLetters = new Set(allEntries.map(entry => entry.letter));
  const letters = ['全部', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];
  const navigation = element<HTMLDivElement>('vocabularyLetters');
  navigation.hidden = groupingMode !== 'alphabetical';
  navigation.replaceChildren(...letters.map(letter => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.letter = letter;
    button.textContent = letter;
    button.disabled = letter !== '全部' && !availableLetters.has(letter);
    button.setAttribute('aria-pressed', String(letter === activeLetter));
    return button;
  }));
}

function alphabeticalGroups(entries: VocabularyReviewEntry[]): HTMLElement[] {
  const groups = new Map<string, VocabularyReviewEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.letter) ?? [];
    group.push(entry);
    groups.set(entry.letter, group);
  }
  return [...groups].map(([letter, group]) => createVocabularyGroup(
    letter === '#' ? 'other' : letter,
    letter,
    group,
  ));
}

function partsOfSpeechGroups(entries: VocabularyReviewEntry[]): HTMLElement[] {
  const groups: HTMLElement[] = [];
  for (const [, label] of VOCABULARY_PARTS_OF_SPEECH) {
    const group = entries.filter(entry => entry.tags.includes(label));
    if (group.length > 0) groups.push(createVocabularyGroup(label.toLowerCase(), label, group));
  }
  const unclassified = entries.filter(entry => entry.tags.length === 0);
  if (unclassified.length > 0) {
    groups.push(createVocabularyGroup('unclassified', '未標註', unclassified));
  }
  return groups;
}

function renderGroupingSwitch(): void {
  const switcher = element<HTMLDivElement>('vocabularyGrouping');
  switcher.dataset.active = groupingMode === 'alphabetical' ? '0' : '1';
  for (const button of switcher.querySelectorAll<HTMLButtonElement>('[data-grouping-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.groupingMode === groupingMode));
  }
}

function renderEntries(): void {
  const entries = filteredEntries();
  const list = element<HTMLDivElement>('vocabularyList');
  const empty = element<HTMLParagraphElement>('vocabularyEmpty');
  const groups = groupingMode === 'alphabetical'
    ? alphabeticalGroups(entries)
    : partsOfSpeechGroups(entries);
  list.replaceChildren(...groups);
  empty.hidden = entries.length > 0;
  empty.textContent = allEntries.length === 0
    ? '目前尚未在 Tracker 新增英文單字。'
    : '找不到符合目前篩選條件的單字。';
  element<HTMLElement>('visibleVocabularyCount').textContent = `${entries.length} 個`;
}

function render(): void {
  renderGroupingSwitch();
  renderLetters();
  renderEntries();
  element<HTMLElement>('totalVocabularyCount').textContent = `${allEntries.length} 個不重複單字／片語`;
}

function load(): void {
  try {
    const result = readMaterialProgressRecords(localStorage);
    loadedRecords = result.records;
    activeRecordPrefix = result.prefix;
    allEntries = vocabularyReviewEntries(loadedRecords);
    const source = result.prefix.startsWith('study-v11:user:') ? '目前登入帳號的本機同步資料' : '訪客本機資料';
    element<HTMLParagraphElement>('vocabularySource').textContent = `${source}｜共讀取 ${result.records.length} 天紀錄`;
    element<HTMLParagraphElement>('vocabularyError').hidden = true;
  } catch {
    loadedRecords = [];
    activeRecordPrefix = '';
    allEntries = [];
    element<HTMLParagraphElement>('vocabularySource').textContent = '無法讀取 Tracker 紀錄';
    const error = element<HTMLParagraphElement>('vocabularyError');
    error.textContent = '瀏覽器目前不允許存取 Tracker 的本機同步資料，請回到 Tracker 確認瀏覽器儲存權限。';
    error.hidden = false;
  }
  render();
}

element<HTMLInputElement>('vocabularySearch').addEventListener('input', event => {
  searchText = (event.target as HTMLInputElement).value.trim();
  renderEntries();
});
element<HTMLDivElement>('vocabularyGrouping').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-grouping-mode]');
  if (!button) return;
  groupingMode = button.dataset.groupingMode === 'partOfSpeech' ? 'partOfSpeech' : 'alphabetical';
  activeLetter = '全部';
  render();
});
element<HTMLDivElement>('vocabularyLetters').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-letter]');
  if (!button || button.disabled) return;
  activeLetter = button.dataset.letter ?? '全部';
  renderLetters();
  renderEntries();
});
element<HTMLDivElement>('vocabularyList').addEventListener('change', event => {
  const target = event.target as HTMLInputElement;
  const row = target.closest<HTMLElement>('[data-entry-key]');
  const entry = allEntries.find(candidate => candidate.key === row?.dataset.entryKey);
  if (!entry) return;
  if (target.matches('[data-vocabulary-pos]')) {
    const fieldset = target.closest<HTMLElement>('.vocabulary-pos-editor');
    if (fieldset) saveEntryEdits(entry, { partsOfSpeech: selectedPartsOfSpeech(fieldset) });
    return;
  }
  if (target.matches('[data-vocabulary-translation]')) {
    saveEntryEdits(entry, { translation: target.value.trim() });
  }
});
element<HTMLButtonElement>('refreshVocabulary').addEventListener('click', load);
window.addEventListener('storage', load);
load();

import './vocabulary-review.css';
import { readMaterialProgressRecords } from './study/materialProgress.ts';
import {
  vocabularyReviewEntries,
  type VocabularyReviewEntry,
} from './study/vocabularyReview.ts';

let allEntries: VocabularyReviewEntry[] = [];
let activeLetter = '全部';
let searchText = '';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${year}/${month}/${day}`;
}

function entryMatchesSearch(entry: VocabularyReviewEntry): boolean {
  if (!searchText) return true;
  const searchable = [entry.text, entry.lookupQuery, ...entry.tags].join(' ').toLocaleLowerCase('en-US');
  return searchable.includes(searchText.toLocaleLowerCase('en-US'));
}

function visibleEntries(): VocabularyReviewEntry[] {
  return allEntries.filter(entry => (
    (activeLetter === '全部' || entry.letter === activeLetter)
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

function createVocabularyRow(entry: VocabularyReviewEntry): HTMLElement {
  const article = document.createElement('article');
  article.className = 'vocabulary-row';

  const main = document.createElement('div');
  main.className = 'vocabulary-row-main';
  main.append(createWordLink(entry));
  if (entry.tags.length > 0) {
    const tags = document.createElement('div');
    tags.className = 'vocabulary-tags';
    for (const label of entry.tags) {
      const tag = document.createElement('span');
      tag.textContent = label;
      tags.append(tag);
    }
    main.append(tags);
  }

  const meta = document.createElement('p');
  meta.className = 'vocabulary-source';
  const latestDate = entry.sourceDates.at(-1);
  const occurrence = entry.occurrenceCount > 1 ? `｜已整理 ${entry.occurrenceCount} 次` : '';
  meta.textContent = latestDate ? `最近紀錄 ${formatDate(latestDate)}${occurrence}` : `已整理${occurrence}`;
  article.append(main, meta);
  return article;
}

function createLetterGroup(letter: string, entries: VocabularyReviewEntry[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'vocabulary-letter-group';
  section.id = `letter-${letter === '#' ? 'other' : letter}`;
  const heading = document.createElement('h2');
  heading.textContent = letter;
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

function renderEntries(): void {
  const entries = visibleEntries();
  const list = element<HTMLDivElement>('vocabularyList');
  const empty = element<HTMLParagraphElement>('vocabularyEmpty');
  const groups = new Map<string, VocabularyReviewEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.letter) ?? [];
    group.push(entry);
    groups.set(entry.letter, group);
  }
  list.replaceChildren(...[...groups].map(([letter, group]) => createLetterGroup(letter, group)));
  empty.hidden = entries.length > 0;
  empty.textContent = allEntries.length === 0
    ? '目前尚未在 Tracker 新增英文單字。'
    : '找不到符合目前篩選條件的單字。';
  element<HTMLElement>('visibleVocabularyCount').textContent = `${entries.length} 個`;
}

function render(): void {
  renderLetters();
  renderEntries();
  element<HTMLElement>('totalVocabularyCount').textContent = `${allEntries.length} 個不重複單字／片語`;
}

function load(): void {
  try {
    const result = readMaterialProgressRecords(localStorage);
    allEntries = vocabularyReviewEntries(result.records);
    const source = result.prefix.startsWith('study-v11:user:') ? '目前登入帳號的本機同步資料' : '訪客本機資料';
    element<HTMLParagraphElement>('vocabularySource').textContent = `${source}｜共讀取 ${result.records.length} 天紀錄`;
    element<HTMLParagraphElement>('vocabularyError').hidden = true;
  } catch {
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
element<HTMLDivElement>('vocabularyLetters').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-letter]');
  if (!button || button.disabled) return;
  activeLetter = button.dataset.letter ?? '全部';
  renderLetters();
  renderEntries();
});
element<HTMLButtonElement>('refreshVocabulary').addEventListener('click', load);
window.addEventListener('storage', load);
load();

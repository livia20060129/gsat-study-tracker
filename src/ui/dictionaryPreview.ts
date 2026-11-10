import { dictionaryQuery, type DictionaryLookupResult } from '../study/dictionaryEntries.ts';
import { localDictionaryLookup } from '../study/localDictionaryLookup.ts';
import { loadEcdictTranslations } from '../study/ecdictLookup.ts';
import { VOCABULARY_PARTS_OF_SPEECH } from '../study/vocabularyTranslationCounts.ts';
import type { VocabularyTranslations } from '../types.ts';
import type { GoogleTranslationContentKind, GoogleTranslationSelection } from '../study/googleTranslationSelection.ts';
import { translationText } from '../../supabase/functions/_shared/translationText.ts';
import { waitForDisclosure } from './disclosureMotion.ts';

type SelectionOutcome = 'saved' | 'unchanged' | 'failed';

export interface DictionaryPreviewOptions {
  word: string;
  local?: boolean;
  apply: (selection: DictionaryLookupResult) => SelectionOutcome;
  google?: {
    enabled: boolean;
    contentKind?: GoogleTranslationContentKind;
    lookup: () => Promise<GoogleTranslationSelection | null>;
    apply: (selection: GoogleTranslationSelection) => SelectionOutcome;
  };
}

/** Local candidates remain temporary until the user confirms selected meanings. */
export class DictionaryPreview {
  readonly element: HTMLElement;
  private readonly options: DictionaryPreviewOptions;
  private readonly output: HTMLDivElement;
  private readonly status: HTMLParagraphElement;
  private disposed = false;
  private requestSerial = 0;

  constructor(options: DictionaryPreviewOptions) {
    this.options = options;
    this.element = document.createElement('section');
    this.element.className = 'dictionary-preview';
    this.element.setAttribute('aria-label', '取得「' + options.word + '」的翻譯');
    const controls = document.createElement('div');
    controls.className = 'dictionary-preview-controls';
    const source = document.createElement('span');
    source.className = 'dictionary-preview-source';
    source.textContent = 'ECDICT（本機）';
    const query = document.createElement('button');
    query.type = 'button';
    query.dataset.dictionaryLookup = '';
    query.textContent = '取得翻譯';
    query.disabled = !dictionaryQuery(options.word);
    if (options.local !== false) controls.append(source, query);
    const googleQuery = document.createElement('button');
    googleQuery.type = 'button';
    googleQuery.dataset.googleTranslate = '';
    googleQuery.textContent = 'Google 翻譯';
    const word = dictionaryQuery(options.word);
    const googleWord = options.google?.contentKind && options.google.contentKind !== '單字'
      ? translationText(options.word) !== null : word !== null && /^[a-z]+(?:['-][a-z]+)*$/.test(word);
    const googleEnabled = options.google?.enabled === true && googleWord;
    googleQuery.disabled = !googleEnabled;
    if (!options.google?.enabled) googleQuery.title = '登入 Tracker 帳號後可使用';
    else if (!googleWord) googleQuery.title = '請填入有效英文，每次最多 200 個單字、1,000 個字元';
    else googleQuery.title = '使用每月 5,000 個單字額度，快取不扣；預覽後確認追加';
    if (options.google) controls.append(googleQuery);
    this.status = document.createElement('p');
    this.status.className = 'dictionary-preview-status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.status.textContent = query.disabled
      ? '請先將英文內容改為有效的英文單字或短語。'
      : '使用 ECDICT，更多單字按需載入。可勾選意思追加填入，保留既有手動修改。';
    if (options.local === false) this.status.textContent = 'Google 翻譯整段英文，預覽後確認追加中文，保留既有手動修改；按英文單字數計入月額度。';
    if (options.google && !options.google.enabled) this.status.textContent += ' Google 翻譯需先登入 Tracker。';
    this.output = document.createElement('div');
    this.output.className = 'dictionary-preview-results';
    this.element.append(controls, this.status, this.output);
    query.addEventListener('click', () => this.lookup());
    googleQuery.addEventListener('click', async () => {
      if (!googleEnabled || googleQuery.disabled || !this.options.google) return;
      const serial = ++this.requestSerial;
      this.output.replaceChildren();
      this.status.textContent = '正在取得 Google 翻譯…';
      googleQuery.disabled = true;
      try {
        await waitForDisclosure(this.element);
        if (this.disposed || serial !== this.requestSerial) return;
        const result = await this.options.google.lookup();
        if (this.disposed || serial !== this.requestSerial) return;
        if (result) this.showGoogleResult(result);
        else this.status.textContent = '請先回到 Tracker 確認登入，再重試 Google 翻譯。';
      } catch (error) {
        if (!this.disposed && serial === this.requestSerial) this.status.textContent = error instanceof Error ? error.message : 'Google 翻譯暫時無法使用，請稍後重試。';
      } finally {
        if (!this.disposed) googleQuery.disabled = !googleEnabled;
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    this.requestSerial++;
    this.output.replaceChildren();
  }

  private async lookup(): Promise<void> {
    const serial = ++this.requestSerial;
    this.output.replaceChildren();
    let translations: VocabularyTranslations | null;
    try {
      await waitForDisclosure(this.element);
      if (this.disposed || serial !== this.requestSerial) return;
      translations = await loadEcdictTranslations(this.options.word);
    }
    catch {
      if (!this.disposed && serial === this.requestSerial) this.status.textContent = 'ECDICT 暫時無法載入，可稍後重試或手動輸入中文。';
      return;
    }
    if (this.disposed || serial !== this.requestSerial) return;
    const result = localDictionaryLookup(this.options.word, translations);
    if (result) this.showResult(result);
    else this.status.textContent = '本機 ECDICT 未收錄此拼法的翻譯，可手動輸入中文。';
  }

  private showGoogleResult(selection: GoogleTranslationSelection): void {
    this.status.textContent = 'Google 翻譯已取得；確認後追加，保留原有中文。';
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Google 翻譯預覽';
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.googleMeaning = '';
    const part = VOCABULARY_PARTS_OF_SPEECH.find(([field]) => field === selection.partOfSpeech)?.[1] ?? '未分詞性';
    const text = selection.contentKind && selection.contentKind !== '單字' ? selection.text : `${part}｜${selection.text}`;
    label.append(checkbox, document.createTextNode(text));
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.dataset.googleApply = '';
    confirm.textContent = '填入 Google 翻譯';
    confirm.disabled = true;
    checkbox.addEventListener('change', () => { confirm.disabled = !checkbox.checked; });
    confirm.addEventListener('click', () => {
      if (!checkbox.checked || !this.options.google || this.disposed) return;
      const outcome = this.options.google.apply(selection);
      if (outcome === 'saved') this.status.textContent = '已追加 Google 翻譯。';
      else if (outcome === 'unchanged') this.status.textContent = '此翻譯已存在，沒有變更紀錄。';
      else this.status.textContent = '尚未填入，請先處理頁面上的儲存提示。';
    });
    group.append(legend, label, confirm);
    this.output.replaceChildren(group);
  }

  private showResult(result: DictionaryLookupResult): void {
    this.status.textContent = '來源：ECDICT。請勾選要填入的意思。';
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = '選擇翻譯';
    group.append(legend);
    for (const [index, meaning] of result.meanings.entries()) {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.dictionaryMeaning = String(index);
      const part = VOCABULARY_PARTS_OF_SPEECH.find(([field]) => field === meaning.partOfSpeech)?.[1] ?? '未分詞性';
      label.append(checkbox, document.createTextNode(part + '｜' + meaning.text));
      group.append(label);
    }
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.dataset.dictionaryApply = '';
    confirm.textContent = '填入已選翻譯';
    confirm.disabled = true;
    group.addEventListener('change', () => { confirm.disabled = !group.querySelector('input:checked'); });
    confirm.addEventListener('click', () => {
      const meanings = [...group.querySelectorAll<HTMLInputElement>('input:checked')].map(input => result.meanings[Number(input.dataset.dictionaryMeaning)]);
      if (!meanings.length) return;
      const outcome = this.options.apply({ ...result, meanings });
      if (outcome === 'saved') this.status.textContent = '已填入所選翻譯。';
      else if (outcome === 'unchanged') this.status.textContent = '所選翻譯已存在，沒有變更紀錄。';
      else this.status.textContent = '尚未填入，請先處理頁面上的儲存提示。';
    });
    this.output.replaceChildren(group, confirm);
  }
}

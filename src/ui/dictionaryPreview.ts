import { cambridgeDictionaryUrl, dictionaryQuery, type DictionaryLookupResult, type DictionaryProvider } from '../study/dictionaryEntries.ts';
import { localDictionaryLookup } from '../study/localDictionaryLookup.ts';
import { VOCABULARY_PARTS_OF_SPEECH } from '../study/vocabularyTranslationCounts.ts';

export interface DictionaryPreviewOptions {
  word: string;
  recordPrefix: string;
  apply: (selection: DictionaryLookupResult) => 'saved' | 'unchanged' | 'failed';
}

/** A preview owns only temporary candidates. Storage is reached solely through explicit confirmation. */
export class DictionaryPreview {
  readonly element: HTMLElement;
  private readonly options: DictionaryPreviewOptions;
  private readonly source: HTMLSelectElement;
  private readonly queryButton: HTMLButtonElement;
  private readonly output: HTMLDivElement;
  private readonly status: HTMLParagraphElement;
  private controller: AbortController | null = null;
  private generation = 0;

  constructor(options: DictionaryPreviewOptions) {
    this.options = options;
    this.element = document.createElement('section');
    this.element.className = 'dictionary-preview';
    this.element.setAttribute('aria-label', `取得「${options.word}」的翻譯`);
    const controls = document.createElement('div');
    controls.className = 'dictionary-preview-controls';
    const label = document.createElement('label');
    label.textContent = '字典來源';
    this.source = document.createElement('select');
    this.source.dataset.dictionaryProvider = '';
    for (const [value, text] of [['ecdict', 'ECDICT（本機）'], ['cambridge', '劍橋（線上）']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      this.source.append(option);
    }
    label.append(this.source);
    this.queryButton = document.createElement('button');
    this.queryButton.type = 'button';
    this.queryButton.dataset.dictionaryLookup = '';
    this.queryButton.textContent = '取得翻譯';
    this.queryButton.disabled = !dictionaryQuery(options.word);
    const link = document.createElement('a');
    link.textContent = '劍橋查看';
    link.href = cambridgeDictionaryUrl(dictionaryQuery(options.word) ?? options.word);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    controls.append(label, this.queryButton, link);
    this.status = document.createElement('p');
    this.status.className = 'dictionary-preview-status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.status.textContent = this.queryButton.disabled ? '請先將英文內容改為有效的英文單字或短語。' : '按下取得翻譯後，選擇意思再填入；既有內容會保留。';
    this.output = document.createElement('div');
    this.output.className = 'dictionary-preview-results';
    this.element.append(controls, this.status, this.output);
    this.source.addEventListener('change', () => {
      this.cancel();
      this.output.replaceChildren();
      this.status.textContent = this.source.value === 'cambridge'
        ? '按下後會將此英文內容送交劍橋查詢，其他讀書紀錄不會傳送。' : '使用網站已附的本機字典，不需連線。';
    });
    this.queryButton.addEventListener('click', () => { void this.lookup(); });
  }

  dispose(): void {
    this.cancel();
  }

  private cancel(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
    this.queryButton.disabled = !dictionaryQuery(this.options.word);
    this.queryButton.textContent = '取得翻譯';
    this.element.removeAttribute('aria-busy');
  }

  private async lookup(): Promise<void> {
    this.cancel();
    const generation = this.generation;
    const provider = this.source.value as DictionaryProvider;
    this.output.replaceChildren();
    if (provider === 'ecdict') {
      const result = localDictionaryLookup(this.options.word);
      if (result) this.showResult(result);
      else this.status.textContent = '本機字典未收錄此拼法的翻譯，可切換劍橋查詢或手動輸入。';
      return;
    }
    this.controller = new AbortController();
    const controller = this.controller;
    this.queryButton.disabled = true;
    this.queryButton.textContent = '查詢中…';
    this.status.textContent = '正在取得翻譯，可繼續編輯其他內容。';
    this.element.setAttribute('aria-busy', 'true');
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const result = await Promise.race([
        import('../infrastructure/dictionary/cambridgeLookup.ts').then(module => module.lookupCambridge(this.options.word, this.options.recordPrefix, controller.signal)),
        new Promise<never>((_, reject) => {
          if (controller.signal.aborted) reject(new DOMException('Cancelled', 'AbortError'));
          else controller.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
        }),
      ]);
      if (generation === this.generation && this.element.isConnected) this.showResult(result);
    } catch (error) {
      if (generation !== this.generation || !this.element.isConnected) return;
      if (controller.signal.aborted) this.status.textContent = '查詢逾時，尚未填入翻譯；可再試一次或手動輸入。';
      else if (error instanceof Error) this.status.textContent = error.message;
      else this.status.textContent = '無法取得翻譯，仍可手動輸入。';
    } finally {
      clearTimeout(timeout);
      if (generation === this.generation) {
        this.queryButton.disabled = false;
        this.queryButton.textContent = '取得翻譯';
        this.element.removeAttribute('aria-busy');
        this.controller = null;
      }
    }
  }

  private showResult(result: DictionaryLookupResult): void {
    this.status.textContent = `來源：${result.provider === 'cambridge' ? 'Cambridge Dictionary' : 'ECDICT'}。請勾選要填入的意思。`;
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
      label.append(checkbox, document.createTextNode(`${part}｜${meaning.text}`));
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

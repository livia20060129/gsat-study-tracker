const IDENTITY_LABELS = new Set(['科目', '書名', '書名／教材', '書名/教材', '講義版本']);
const FIELD_ROWS = [
  '.math-main-row', '.science-main-row', '.chinese-book-main-row', '.english-book-row',
  '.english-book-page-row', '.english-title-half', '.grid-2', '.grid-3', '.grid-4', '.field-grid',
].join(',');

function comparableIdentity(value: string): string {
  return value.normalize('NFKC').trim()
    .replace(/^(?:國文|英文|數學A?|自然|生物|物理|化學|地科)\s*[｜|：:]\s*/, '')
    .replace(/講義$/, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function cardHeadingIdentities(card: HTMLElement): string[] {
  const identities: string[] = [];
  let owner: HTMLElement | null = card;
  while (owner) {
    const heading = owner.querySelector<HTMLElement>(':scope > .item-top .item-title');
    if (heading?.textContent) identities.push(comparableIdentity(heading.textContent));
    owner = owner.parentElement?.closest<HTMLElement>('[data-item]') ?? null;
  }
  return identities;
}

/** Remove only repeated display fields; selectors and all record values stay intact. */
export function deduplicateStudyIdentityFields(root: ParentNode): void {
  const changedRows = new Set<HTMLElement>();
  for (const card of root.querySelectorAll<HTMLElement>('.study-record-section [data-item]')) {
    const headings = cardHeadingIdentities(card);
    for (const field of card.querySelectorAll<HTMLElement>('.field')) {
      if (field.closest('[data-item]') !== card || field.querySelector('input,select,textarea')) continue;
      const row = field.parentElement;
      if (!row?.matches(FIELD_ROWS)) continue;
      const label = field.querySelector(':scope > label')?.textContent?.trim() ?? '';
      if (!IDENTITY_LABELS.has(label)) continue;
      const value = field.querySelector(':scope > .fixed-book-value')?.textContent;
      if (!value) continue;
      const identity = comparableIdentity(value);
      if (identity.length < 2 || !headings.some(heading => heading.includes(identity))) continue;
      field.remove();
      changedRows.add(row);
    }
  }
  for (const row of changedRows) {
    const count = row.children.length;
    if (!count) {
      row.remove();
      continue;
    }
    row.classList.add('study-fields-deduplicated');
    row.style.setProperty('--study-field-count', String(count));
  }
}

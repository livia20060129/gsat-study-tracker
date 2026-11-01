import type { OverdueTaskDetail, OverdueTaskEntry } from '../study/overdueTasks.ts';
import { studyCardDescription } from './studyDescription.ts';
import { omitStudyRanges, studyBookIncludes, studyHeadingText, studyReferenceText, studyTextIncludes, type StudyRangeKind } from './studyDisplayText.ts';

interface TodoStudyDisplay {
  title: string;
  description: string;
  details: OverdueTaskDetail[];
}

/** Presentation only: the entry and its data attributes still identify the original saved task. */
export function todoStudyDisplay(entry: Pick<OverdueTaskEntry, 'title' | 'description' | 'details'>): TodoStudyDisplay {
  const kinds: StudyRangeKind[] = entry.details.filter(detail => detail.editableRange).map(detail => detail.rangeKind ?? 'pages');
  const title = studyHeadingText(entry.title, [], kinds) || '讀書項目';
  const context = [title];
  const details: OverdueTaskDetail[] = [];
  for (const detail of entry.details) {
    if (detail.editableRange) {
      details.push(detail);
      continue;
    }
    const identity = ['書名', '書名／冊別', '教材', '講義', '講義版本', '科目'].includes(detail.label);
    if (identity && context.some(previous => studyBookIncludes(previous, detail.value))) continue;
    const scope = ['單元', '章節', '主題', '回次', 'Google Calendar 當日主題'].includes(detail.label);
    if (scope && context.some(previous => studyTextIncludes(previous, detail.value))) continue;
    details.push(detail);
    if (identity || scope) context.push(detail.value);
  }
  const description = studyCardDescription(entry.description).split(/[｜|]/).filter(part => {
    if (!omitStudyRanges(part, kinds).trim()) return false;
    return !context.some(previous => studyBookIncludes(previous, part.trim()));
  }).join('｜');
  return { title, details, description: studyReferenceText(description, context) };
}

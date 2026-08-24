export type StudySubject = '國文' | '英文' | '數學A' | '自然' | '物理' | '化學' | '生物' | '地科' | '混合';

export type StudyItemType =
  | 'mathStudy'
  | 'mathLecture'
  | 'mathPractice'
  | 'mathOral'
  | 'magazine'
  | 'englishPractice'
  | 'englishVocabInteractive'
  | 'englishMixedWriting'
  | 'biologyInteractive'
  | 'scienceReview'
  | 'chineseReading'
  | 'mock'
  | 'general'
  | 'extra'
  | 'interactive'
  | 'interactiveDaily'
  | 'calendarStudy';

export interface PageRange {
  start: number;
  end: number;
}

export interface StudyItemFields {
  [key: string]: unknown;
  words?: Array<string | Record<string, unknown>>;
  interactiveEntries?: StudyItem[];
  calendarIntegrationEntries?: CalendarNaturalIntegrationEntry[];
}

export interface StudyItem {
  id: string;
  type: StudyItemType | string;
  done: boolean;
  minutes: string;
  required: boolean;
  source?: string;
  presetKey?: string;
  title?: string;
  description?: string;
  deferred?: boolean;
  deferredCarry?: boolean;
  deferredOriginDate?: string;
  deferredOriginId?: string;
  locked?: boolean;
  mondayFixedVocab?: boolean;
  f: StudyItemFields;
}

export interface StudyRecord {
  date: string;
  mood?: string;
  wakeTime?: string;
  biggestBlock?: string;
  firstThingTomorrow?: string;
  notes?: string;
  items: StudyItem[];
}

export interface CalendarNaturalIntegrationEntry {
  id?: string;
  subject: '生物' | '化學' | '物理' | '地科';
  material?: '123日的淬鍊';
  ranges?: Array<[number, number]>;
  pageText?: string;
  chapterText?: string;
  dynamic?: boolean;
  done?: boolean;
  source?: string;
  calendarIntegrationChild?: boolean;
}

export interface CalendarMathPlanEntry {
  title: string;
  book: string;
  start: number;
  end: number;
  pages: number;
  unitPages: number;
  weekTarget: number;
}

export const WEEKLY_DEFER_LIMIT = 6 as const;

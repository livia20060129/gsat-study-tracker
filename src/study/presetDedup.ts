import { calendarFixedTemplate, type CalendarFixedTemplate } from '../calendar/calendarBridge.ts';

export interface PresetDefinitionLike {
  key: string;
  type: string;
  title: string;
  description: string;
  required: boolean;
  f: Record<string, unknown>;
}

const KEY_TEMPLATES: Record<string, CalendarFixedTemplate> = {
  weekday_math_study: 'mathStudy',
  fri_math_study: 'mathStudy',
  sat_math_fill: 'mathStudy',
  weekday_math_practice: 'mathPractice',
  fri_math_practice: 'mathPractice',
  sat_math_practice: 'mathPractice',
  sun_math_practice: 'mathPractice',
  daily_interactive: 'interactiveDaily',
  weekday_magazine: 'fixedMagazine',
  fri_magazine: 'fixedMagazine',
  weekday_english_review: 'englishReview',
  english_mixed_writing: 'englishMixedWriting',
  fri_mock_timed: 'englishMockTimed',
  sat_mock_correction: 'englishMockCorrection',
  sat_week_review: 'weekReview',
  sun_english_optional: 'englishLightReading',
};

export function presetDefinitionTemplate(definition: PresetDefinitionLike | null | undefined): CalendarFixedTemplate | null {
  if (!definition) return null;
  const declared = definition.f?.calendarFixedTemplate;
  if (typeof declared === 'string') return declared as CalendarFixedTemplate;
  return KEY_TEMPLATES[definition.key] || calendarFixedTemplate(definition.title);
}

function isCalendarDefinition(definition: PresetDefinitionLike): boolean {
  return /^cal_/.test(definition.key);
}

function calendarMetadata(fields: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (/^calendar/.test(key)) metadata[key] = value;
  }
  return metadata;
}

/** Merges one matching Calendar definition into the built-in card and leaves intentional extra events separate. */
export function dedupePresetDefinitions<T extends PresetDefinitionLike>(definitions: T[]): T[] {
  const output: T[] = [];
  const builtInIndex = new Map<CalendarFixedTemplate, number>();
  const consumedBuiltIn = new Set<CalendarFixedTemplate>();

  for (const original of definitions) {
    const definition = {
      ...original,
      f: { ...(original.f || {}) },
    } as T;
    const template = presetDefinitionTemplate(definition);

    if (!isCalendarDefinition(definition)) {
      const index = output.push(definition) - 1;
      if (template && !builtInIndex.has(template)) builtInIndex.set(template, index);
      continue;
    }

    const route = definition.f?.calendarRoute;
    const index = template && route !== 'week' ? builtInIndex.get(template) : undefined;
    if (!template || index === undefined || consumedBuiltIn.has(template)) {
      output.push(definition);
      continue;
    }

    const base = output[index];
    const metadata = calendarMetadata(definition.f || {});
    const includesMakeup = metadata.calendarMakeup === true;
    delete metadata.calendarMakeup;
    output[index] = {
      ...base,
      description: `${base.description}${definition.title ? `｜Google Calendar：${definition.title}` : ''}`,
      f: {
        ...(base.f || {}),
        ...metadata,
        calendarMerged: true,
        ...(includesMakeup ? { calendarIncludesMakeup: true } : {}),
      },
    };
    consumedBuiltIn.add(template);
  }

  return output;
}

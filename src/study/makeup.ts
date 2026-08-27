import type { StudyItem } from '../types';

export interface MakeupCloneOptions {
  id: string;
  presetKey: string;
  originDate: string;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Returns the preset that owns the item's UI template, including carried makeup items. */
export function effectiveTemplatePresetKey(item: Pick<StudyItem, 'presetKey' | 'templatePresetKey'> | null | undefined): string {
  return String(item?.templatePresetKey || item?.presetKey || '');
}

/** Creates a makeup item without flattening the original item into a generic blank form. */
export function cloneOriginalItemForMakeup(original: StudyItem, options: MakeupCloneOptions): StudyItem {
  const makeup = cloneJson(original);
  const templatePresetKey = effectiveTemplatePresetKey(original);

  makeup.id = options.id;
  makeup.presetKey = options.presetKey;
  if (templatePresetKey) makeup.templatePresetKey = templatePresetKey;
  makeup.source = 'preset';
  makeup.required = true;
  makeup.done = false;
  makeup.deferred = false;
  delete makeup.deferredTargetDay;
  makeup.deferredCarry = true;
  makeup.deferredOriginDate = options.originDate;
  makeup.deferredOriginId = original.id || '';
  makeup.description = `延期自 ${options.originDate}${original.description ? `｜${original.description}` : ''}`;

  return makeup;
}

/** Keeps user-entered makeup progress while restoring any missing original template fields. */
export function mergeMakeupProgress(template: StudyItem, existing: StudyItem): StudyItem {
  const merged = cloneJson(template);
  merged.done = Boolean(existing.done);
  merged.minutes = existing.minutes || '';
  merged.f = {
    ...(cloneJson(template.f || {})),
    ...(cloneJson(existing.f || {})),
  };
  return merged;
}

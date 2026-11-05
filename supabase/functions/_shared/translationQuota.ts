export const GOOGLE_TRANSLATION_MONTHLY_LIMIT = 5000;

export interface TranslationQuota {
  allowed: boolean;
  unit: 'words';
  month: string;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

/** Reject malformed quota replies; an unavailable counter must never permit a paid request. */
export function translationQuota(value: unknown): TranslationQuota | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as TranslationQuota;
  if (data.unit !== 'words' || typeof data.allowed !== 'boolean' || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(data.month)
    || data.limit !== GOOGLE_TRANSLATION_MONTHLY_LIMIT
    || !Number.isInteger(data.used) || data.used < 0 || data.used > data.limit
    || data.remaining !== data.limit - data.used
    || typeof data.resetsAt !== 'string' || !Number.isFinite(Date.parse(data.resetsAt))) return null;
  return data;
}

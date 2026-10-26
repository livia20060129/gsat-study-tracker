import { createDictionaryLookupHandler } from '../_shared/dictionaryLookup.ts';

function publishableKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>;
    if (typeof keys.default === 'string' && keys.default.startsWith('sb_publishable_')) return keys.default;
  } catch { /* Existing projects may still provide only the legacy public key. */ }
  return Deno.env.get('SUPABASE_ANON_KEY') ?? '';
}

Deno.serve(createDictionaryLookupHandler({
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  publishableKey: publishableKey(),
  apiKey: Deno.env.get('CAMBRIDGE_DICTIONARY_API_KEY') ?? '',
  dictionaryCode: Deno.env.get('CAMBRIDGE_DICTIONARY_CODE') ?? '',
}));

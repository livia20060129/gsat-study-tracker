import { createGoogleTranslationHandler } from '../_shared/googleTranslation.ts';

Deno.serve(createGoogleTranslationHandler({ env: name => Deno.env.get(name), fetch }));

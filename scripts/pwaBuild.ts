import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { siteNavigationPage } from '../src/ui/siteNavigation.ts';

export interface OfflineRelease {
  version: string;
  id: string;
  resources: { path: string; hash: string; bytes: number; source?: string }[];
  pages: string[];
  documentHeaders?: Record<string, string>;
}
const PUBLIC_FILES = new Set(['site-shell.js', 'site-shell.css', 'page-transitions.js', 'navigation.css',
  'legal.css', 'legal-language.js', 'gpt-prompt.js', 'google-g.svg', 'google-translate-attribution.png', 'manifest.webmanifest']);

/** Only compiled assets and known app pages belong in a public offline release. */
export function offlineAssetPath(path: string): boolean {
  if (path.endsWith('.html')) return !path.includes('/') && siteNavigationPage('/' + path.slice(0, -5)) === path;
  return PUBLIC_FILES.has(path) || /^(?:assets|icons)\/[\w.-]+\.(?:js|css|json|png|svg|woff2?)$/.test(path)
    || path === 'fonts/NotoSansTC-Regular.ttf';
}
export function offlineWorkerSource(release: OfflineRelease): string {
  return readFileSync(new URL('./app-worker.js', import.meta.url), 'utf8')
    .replace('__GSAT_RELEASE__', JSON.stringify(release));
}
export function buildOfflineRelease(directory: string, version: string, documentHeaders: Record<string, string> = {}): OfflineRelease {
  function files(folder: string, prefix = ''): string[] {
    return readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
      ? files(join(folder, entry.name), prefix + entry.name + '/') : [prefix + entry.name]);
  }
  const resources = files(directory).filter(offlineAssetPath).sort().map(path => {
    const bytes = readFileSync(join(directory, path));
    const hash = createHash('sha256').update(bytes).digest('hex');
    // CDN bot checks can append per-request scripts to text/html. Transport the
    // exact static document as JSON; verify its decoded UTF-8 bytes before use.
    const source = path.endsWith('.html') ? offlineDocumentSource(path, hash) : undefined;
    if (source) {
      mkdirSync(join(directory, 'offline-pages'), { recursive: true });
      writeFileSync(join(directory, source), JSON.stringify({ html: bytes.toString('utf8') }));
    }
    return { path, bytes: bytes.length, hash, ...(source ? { source } : {}) };
  });
  const worker = readFileSync(new URL('./app-worker.js', import.meta.url), 'utf8');
  const release = { version, id: createHash('sha256').update(JSON.stringify({ version, resources, worker, documentHeaders })).digest('hex').slice(0, 20),
    resources, pages: resources.filter(row => row.path.endsWith('.html')).map(row => row.path), documentHeaders };
  if (!release.pages.includes('index.html') || !resources.some(row => row.path === 'site-shell.js')) throw new Error('Incomplete offline app build');
  writeFileSync(join(directory, 'app-worker.js'), offlineWorkerSource(release));
  writeFileSync(join(directory, 'app-release.json'), JSON.stringify(release, null, 2) + '\n');
  return release;
}
export function offlineDocumentSource(path: string, hash: string): string {
  return 'offline-pages/' + path.slice(0, -5) + '-' + hash.slice(0, 20) + '.json';
}

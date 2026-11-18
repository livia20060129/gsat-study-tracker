import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { siteNavigationPage } from '../src/ui/siteNavigation.ts';

export interface OfflineRelease {
  version: string;
  id: string;
  resources: { path: string; hash: string; bytes: number }[];
  pages: string[];
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
export function buildOfflineRelease(directory: string, version: string): OfflineRelease {
  function files(folder: string, prefix = ''): string[] {
    return readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
      ? files(join(folder, entry.name), prefix + entry.name + '/') : [prefix + entry.name]);
  }
  const resources = files(directory).filter(offlineAssetPath).sort().map(path => {
    const bytes = readFileSync(join(directory, path));
    return { path, bytes: bytes.length, hash: createHash('sha256').update(bytes).digest('hex') };
  });
  const worker = readFileSync(new URL('./app-worker.js', import.meta.url), 'utf8');
  const release = { version, id: createHash('sha256').update(JSON.stringify({ version, resources, worker })).digest('hex').slice(0, 20),
    resources, pages: resources.filter(row => row.path.endsWith('.html')).map(row => row.path) };
  if (!release.pages.includes('index.html') || !resources.some(row => row.path === 'site-shell.js')) throw new Error('Incomplete offline app build');
  writeFileSync(join(directory, 'app-worker.js'), offlineWorkerSource(release));
  writeFileSync(join(directory, 'app-release.json'), JSON.stringify(release, null, 2) + '\n');
  return release;
}

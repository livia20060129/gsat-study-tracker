import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const folder = resolve('node_modules/@capacitor/assets');
const metadata = JSON.parse(readFileSync(resolve(folder,'package.json'),'utf8'));
const bin = typeof metadata.bin === 'string' ? metadata.bin : metadata.bin['capacitor-assets'];
const result = spawnSync(process.execPath, [resolve(folder,bin),'generate','--android','--ios','--assetPath','native/assets',
  '--iconBackgroundColor','#f5f8fc','--splashBackgroundColor','#f5f8fc'], { encoding: 'utf8' });
process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
if (result.error) throw result.error;
if (result.status !== 0 || /Unable to generate assets|Unable to parse color/.test((result.stdout ?? '')+(result.stderr ?? ''))) process.exit(1);

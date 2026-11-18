import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { safeNativeFilename } from './nativePolicy.ts';

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('無法讀取匯出檔案。'));
    reader.readAsDataURL(blob);
  });
}
export async function shareNativeFile(blob: Blob, filename: string): Promise<void> {
  // Only this app's dated export cache is pruned. Study records and auth are untouched.
  const folder = 'gsat-exports';
  const prior = await Filesystem.readdir({ directory: Directory.Cache, path: folder }).catch(() => null);
  for (const entry of prior?.files ?? []) {
    const match = /^(\d{13})-[0-9a-f-]{36}-/.exec(entry.name);
    if (match && Date.now() - Number(match[1]) > 86400000) {
      await Filesystem.deleteFile({ directory: Directory.Cache, path: folder + '/' + entry.name }).catch(() => {});
    }
  }
  const path = folder + '/' + Date.now() + '-' + crypto.randomUUID() + '-' + safeNativeFilename(filename);
  const file = await Filesystem.writeFile({ directory: Directory.Cache, path, recursive: true, data: await base64(blob) });
  await Share.share({ files: [file.uri], title: filename, dialogTitle: '儲存或分享檔案' });
}

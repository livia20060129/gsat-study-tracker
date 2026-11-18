import { isNativeApp } from '../native/platform.ts';

/** Native exports use the system sheet; browser exports keep their existing download. */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (isNativeApp()) {
    const { shareNativeFile } = await import('../native/shareFile.ts');
    return shareNativeFile(blob, filename);
  }
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

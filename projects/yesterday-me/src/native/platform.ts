import { Capacitor, registerPlugin } from '@capacitor/core';

export const isNativeApp = Capacitor.isNativePlatform();

interface BackupWriter {
  save(options: { filename: string; json: string }): Promise<{ saved: boolean }>;
}
const BackupFile = registerPlugin<BackupWriter>('BackupFile');

/** Android uses the system file picker; browsers retain their standard download. */
export async function saveBackupFile(filename: string, json: string): Promise<boolean> {
  if (isNativeApp) return (await BackupFile.save({ filename, json })).saved;
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return true;
}

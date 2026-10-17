import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { isNativeApp } from './platform';

/** Consume Android Back without navigating away from the local data origin. */
export function installNativeLifecycle(onReturnToSeal: () => boolean, onResume: () => void): () => void {
  if (!isNativeApp) return () => {};
  let disposed = false;
  const handles: PluginListenerHandle[] = [];
  function retain(handle: PluginListenerHandle) {
    if (disposed) void handle.remove();
    else handles.push(handle);
  }
  void App.addListener('backButton', () => {
    const topDialog = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).at(-1);
    if (topDialog) {
      // The modal owns dismissal rules, including a busy or mandatory guide state.
      topDialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      return;
    }
    if (onReturnToSeal()) return;
    void App.minimizeApp();
  }).then(retain);
  void App.addListener('appStateChange', ({ isActive }) => { if (isActive) onResume(); }).then(retain);
  return () => { disposed = true; for (const handle of handles) void handle.remove(); };
}

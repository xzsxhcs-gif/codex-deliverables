/// <reference types="vite-plugin-pwa/vue" />

import { onBeforeUnmount, ref } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

export function usePwa() {
  const canInstall = ref(false)
  const registrationError = ref('')
  const installing = ref(false)
  const standaloneQuery = window.matchMedia('(display-mode: standalone)')
  const isStandalone = ref(standaloneQuery.matches || Boolean((navigator as NavigatorWithStandalone).standalone))
  let installPrompt: InstallPromptEvent | null = null

  const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisterError(error: unknown) {
      console.warn('Offline installation failed:', error)
      registrationError.value = '离线文件暂未准备好。联网后重新打开即可重试，已封存的记录不受影响。'
    },
  })

  const serviceWorker = 'serviceWorker' in navigator ? navigator.serviceWorker : null
  const expectedWorkerUrl = new URL('sw.js', document.baseURI).href
  function syncOfflineReady() {
    const controller = serviceWorker?.controller
    // The plugin's callback fires only on first installation, not on later visits.
    // An activated instance of our own worker has already completed precaching.
    if (controller?.scriptURL === expectedWorkerUrl && controller.state === 'activated') {
      offlineReady.value = true
    }
  }
  syncOfflineReady()
  serviceWorker?.addEventListener('controllerchange', syncOfflineReady)

  function beforeInstall(event: Event) {
    event.preventDefault()
    installPrompt = event as InstallPromptEvent
    canInstall.value = !isStandalone.value
  }

  function syncStandalone() {
    isStandalone.value = standaloneQuery.matches || Boolean((navigator as NavigatorWithStandalone).standalone)
    if (isStandalone.value) canInstall.value = false
  }

  function installed() {
    installPrompt = null
    canInstall.value = false
    syncStandalone()
  }

  window.addEventListener('beforeinstallprompt', beforeInstall)
  window.addEventListener('appinstalled', installed)
  standaloneQuery.addEventListener('change', syncStandalone)

  onBeforeUnmount(() => {
    window.removeEventListener('beforeinstallprompt', beforeInstall)
    window.removeEventListener('appinstalled', installed)
    standaloneQuery.removeEventListener('change', syncStandalone)
    serviceWorker?.removeEventListener('controllerchange', syncOfflineReady)
  })

  async function install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!installPrompt || installing.value) return 'unavailable'
    const prompt = installPrompt
    installing.value = true
    try {
      await prompt.prompt()
      return (await prompt.userChoice).outcome
    } finally {
      installPrompt = null
      canInstall.value = false
      installing.value = false
    }
  }

  // Call only after explicit confirmation: activation reloads the current page.
  async function updateApp(): Promise<void> {
    await updateServiceWorker(true)
  }

  return { offlineReady, needRefresh, updateApp, canInstall, install, isStandalone, installing, registrationError }
}

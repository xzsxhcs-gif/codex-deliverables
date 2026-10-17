import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // A relative base also supports a repository or any other static subdirectory.
  base: './',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        id: './',
        name: '昨日的我',
        short_name: '昨日的我',
        description: '跨时空自我审判系统。给明天的自己留一份证据，在时间里获得一点意外的快乐。',
        lang: 'zh-CN',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#111214',
        theme_color: '#111214',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/api(?:\/|$)/],
        // Capsule data belongs only in IndexedDB; there is no network data cache.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
})

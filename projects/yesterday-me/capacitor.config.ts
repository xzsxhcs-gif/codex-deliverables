import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.xzsxhcsgif.yesterdayme',
  appName: '昨日的我',
  webDir: 'dist',
  backgroundColor: '#111214',
  // Keep this origin stable: IndexedDB belongs to the app's local origin.
  server: { hostname: 'localhost', androidScheme: 'https', cleartext: false },
  android: { adjustMarginsForEdgeToEdge: 'auto', allowMixedContent: false, webContentsDebuggingEnabled: false, backgroundColor: '#111214' },
};

export default config;

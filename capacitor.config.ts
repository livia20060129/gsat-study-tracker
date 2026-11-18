import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.liviayeh.gsat',
  appName: 'GSAT Tracker',
  webDir: 'dist-native',
  server: { hostname: 'localhost', androidScheme: 'https', iosScheme: 'capacitor' },
  ios: { contentInset: 'automatic', limitsNavigationsToAppBoundDomains: false },
  android: { allowMixedContent: false, minWebViewVersion: 107 },
};
export default config;

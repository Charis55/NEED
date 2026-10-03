import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.need.app',
  appName: 'Need',
  webDir: 'public',
  server: {
    url: 'https://need-chi.vercel.app',
    cleartext: true
  }
};

export default config;

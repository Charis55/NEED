import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.need.app',
  appName: 'Need',
  webDir: 'public',
  server: {
    url: 'https://need-chi.vercel.app',
    cleartext: true,
    errorPath: 'error.html'
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"],
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 500,
      launchAutoHide: true,
      backgroundColor: "#111111",
      showSpinner: false
    }
  }
};

export default config;

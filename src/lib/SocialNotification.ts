import { registerPlugin } from '@capacitor/core';

export interface SocialNotificationPlugin {
  startService(options: { uid: string }): Promise<void>;
  stopService(): Promise<void>;
  playRingtone(): Promise<void>;
  stopRingtone(): Promise<void>;
  setAudioRoute(options: { route: 'speaker' | 'earpiece' }): Promise<void>;
}

const SocialNotification = registerPlugin<SocialNotificationPlugin>('SocialNotification');

export default SocialNotification;

import { registerPlugin } from '@capacitor/core';

export interface SocialNotificationPlugin {
  startService(options: { uid: string }): Promise<void>;
  stopService(): Promise<void>;
}

const SocialNotification = registerPlugin<SocialNotificationPlugin>('SocialNotification');

export default SocialNotification;

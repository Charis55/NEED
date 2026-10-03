import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';

export const enableKeepAwake = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await KeepAwake.keepAwake();
    } catch (e) {
      console.warn("KeepAwake not available", e);
    }
  }
};

export const disableKeepAwake = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await KeepAwake.allowSleep();
    } catch (e) {
      console.warn("KeepAwake not available", e);
    }
  }
};

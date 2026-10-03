import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Heavy) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style });
    } catch (e) {
      console.warn("Haptics not available", e);
    }
  }
};

export const triggerHapticSelection = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    } catch (e) {
      console.warn("Haptics not available", e);
    }
  }
};

export const triggerHapticVibrate = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.vibrate();
    } catch (e) {
      console.warn("Haptics not available", e);
    }
  }
};

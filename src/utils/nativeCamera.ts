import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export async function pickNativePhoto(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false, 
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt // Prompts user to choose from Photos or Camera
    });

    if (image.webPath) {
      const response = await fetch(image.webPath);
      const blob = await response.blob();
      const fileName = `photo_${Date.now()}.${image.format}`;
      return new File([blob], fileName, { type: `image/${image.format}` });
    }
    return null;
  } catch (error) {
    console.error("Native camera error:", error);
    return null; 
  }
}

export async function pickNativePhotos(limit: number = 5): Promise<File[]> {
  if (!Capacitor.isNativePlatform()) return [];

  try {
    const { photos } = await Camera.pickImages({
      quality: 90,
      limit: limit
    });

    const files: File[] = [];
    for (const photo of photos) {
      if (photo.webPath) {
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        const fileName = `photo_${Date.now()}.${photo.format}`;
        files.push(new File([blob], fileName, { type: `image/${photo.format}` }));
      }
    }
    return files;
  } catch (error) {
    console.error("Native gallery error:", error);
    return [];
  }
}

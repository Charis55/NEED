export const compressImage = (file: File, maxSizeMB: number = 1): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Max resolution for 1MB can comfortably be up to 2048x2048 to retain high preview quality
        const MAX_WIDTH = 2048;
        const MAX_HEIGHT = 2048;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);

        // Try reducing quality to ensure it fits the size
        let quality = 0.95; // Start very high
        const compressToBlob = (q: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Canvas to Blob failed"));
                return;
              }
              
              // If still too large and we can compress more, reduce quality by a small step
              if (blob.size / 1024 / 1024 > maxSizeMB && q > 0.1) {
                compressToBlob(q - 0.05);
              } else {
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              }
            },
            "image/jpeg",
            q
          );
        };
        
        compressToBlob(quality);
      };
      
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

"use client";

import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/utils/cropImage';
import { X, Check } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedFile: File) => void;
  onCancel: () => void;
}

export default function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropCompleteCallback = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const croppedImageFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedImageFile) {
        onCropComplete(croppedImageFile);
      } else {
        onCancel();
      }
    } catch (e) {
      console.error(e);
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[var(--color-brutal-bg)] border-4 border-black w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col relative h-[80vh] md:h-[600px]">
        {/* Header */}
        <div className="p-4 border-b-4 border-black flex justify-between items-center bg-[var(--color-brutal-blue)] shrink-0">
          <h2 className="text-xl font-black uppercase text-black">Position Photo</h2>
          <button 
            onClick={onCancel}
            className="w-8 h-8 bg-white border-2 border-black flex items-center justify-center hover:bg-[var(--color-brutal-red)] hover:text-white transition-colors"
          >
            <X className="w-5 h-5 stroke-[3]" />
          </button>
        </div>
        
        {/* Cropper Area */}
        <div className="flex-1 relative bg-gray-200 min-h-0">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteCallback}
            onZoomChange={setZoom}
          />
        </div>

        {/* Controls */}
        <div className="p-6 border-t-4 border-black bg-white shrink-0">
          <div className="mb-6">
            <label className="block text-sm font-black uppercase mb-2">Zoom</label>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-4 bg-gray-200 border-2 border-black appearance-none rounded-none accent-[var(--color-brutal-pink)] cursor-pointer"
            />
          </div>
          
          <button
            onClick={handleSave}
            disabled={isProcessing}
            className="w-full py-4 bg-[var(--color-brutal-green)] border-4 border-black font-black uppercase text-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {isProcessing ? "PROCESSING..." : (
              <>
                <Check className="w-5 h-5 stroke-[3]" /> SAVE PHOTO
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

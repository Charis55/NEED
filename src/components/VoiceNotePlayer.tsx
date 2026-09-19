"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

export default function VoiceNotePlayer({ audioUrl, waveform = [] }: { audioUrl: string; waveform?: number[] }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Create a default waveform if none is provided
  const visualWaveform = waveform.length > 0 ? waveform : Array.from({ length: 30 }, () => Math.random() * 0.5 + 0.1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration);
      }
    };

    const handleLoadedMetadata = () => {
      if (audio.duration === Infinity) {
        audio.currentTime = 1e101;
        setTimeout(() => {
          audio.currentTime = 0;
          setDuration(audio.duration);
        }, 100);
      } else {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, x / rect.width));
    audioRef.current.currentTime = newProgress * duration;
    setProgress(newProgress);
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time) || time === Infinity) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 bg-[var(--color-brutal-bg)] border-4 border-black p-2 min-w-[250px] shadow-[4px_4px_0_0_#000]">
      <audio ref={audioRef} src={audioUrl} />
      
      <button 
        onClick={togglePlay}
        className="w-10 h-10 bg-[var(--color-brutal-pink)] border-2 border-black flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 fill-black text-black" />
        ) : (
          <Play className="w-5 h-5 fill-black text-black ml-1" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div 
          className="flex items-end h-8 gap-1 cursor-pointer"
          onClick={handleSeek}
        >
          {visualWaveform.map((val, i) => {
            const isPlayed = (i / visualWaveform.length) <= progress;
            return (
              <div 
                key={i} 
                className={`flex-1 border-x border-t border-black transition-colors ${isPlayed ? 'bg-[var(--color-brutal-teal)]' : 'bg-gray-300'}`}
                style={{ height: `${Math.max(10, val * 100)}%` }}
              />
            );
          })}
        </div>
        
        <div className="flex justify-between items-center text-[10px] font-black uppercase text-black">
          <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, Ear } from "lucide-react";

interface AgoraCallModalProps {
  channelName: string;
  uid: string;
  isVideo: boolean;
  partnerName: string;
  onEndCall: () => void;
}

export default function AgoraCallModal({ channelName, uid, isVideo, partnerName, onEndCall }: AgoraCallModalProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  
  const [micMuted, setMicMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [error, setError] = useState("");
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (joined) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [joined]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleSpeaker = () => {
    if (typeof window !== 'undefined' && (window as any).AudioToggle) {
      if (speakerOn) {
        (window as any).AudioToggle.setAudioMode((window as any).AudioToggle.EARPIECE);
      } else {
        (window as any).AudioToggle.setAudioMode((window as any).AudioToggle.SPEAKER);
      }
    }
    setSpeakerOn(!speakerOn);
  };

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;

  // 1. Fetch token
  useEffect(() => {
    if (!appId) {
      setError("Agora App ID is missing in environment variables (.env.local).");
      return;
    }
    
    fetch('/api/agora/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName, uid })
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          setToken(data.token);
        } else {
          setError(data.error || "Failed to get token");
        }
      })
      .catch(e => setError("Failed to fetch token"));
  }, [channelName, uid, appId]);

  // 2. Join Call and setup Tracks
  useEffect(() => {
    if (!token || !appId) return;

    let isMounted = true;
    let localA: IMicrophoneAudioTrack;
    let localV: ICameraVideoTrack;
    
    // Create a fresh client for this effect execution
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    clientRef.current = client;

    const initCall = async () => {
      try {
        // Listeners for remote users
        client.on("user-published", async (user, mediaType) => {
          try {
            await client.subscribe(user, mediaType);
          } catch (err) {
            console.error("Agora subscribe error:", err);
            return;
          }
          
          setRemoteUsers(prev => {
            if (prev.find(u => u.uid === user.uid)) return prev;
            return [...prev, user];
          });

          if (mediaType === "video") {
            // Delay slightly to ensure DOM element exists before playing
            setTimeout(() => {
              user.videoTrack?.play(`remote-video-${user.uid}`);
            }, 100);
          }
          if (mediaType === "audio") {
            user.audioTrack?.play();
          }
        });

        client.on("user-unpublished", (user, mediaType) => {
          if (mediaType === "video") {
            user.videoTrack?.stop();
            setRemoteUsers(prev => [...prev]);
          }
        });

        client.on("user-left", (user) => {
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        });

        // 1. Create local tracks (This prompts for permissions)
        localA = await AgoraRTC.createMicrophoneAudioTrack();
        if (!isMounted) return;

        if (isVideo) {
          localV = await AgoraRTC.createCameraVideoTrack();
          if (!isMounted) return;
        }

        // 2. Join channel AFTER permissions are granted and tracks created
        await client.join(appId, channelName, token, uid);
        if (!isMounted) return;

        // 3. Publish tracks
        if (isVideo) {
          await client.publish([localA, localV]);
          if (!isMounted) return;

          setLocalVideoTrack(localV);
          setTimeout(() => {
            localV.play("local-video");
          }, 100);
        } else {
          await client.publish([localA]);
          if (!isMounted) return;
        }
        
        if (isMounted) {
          setLocalAudioTrack(localA);
          setJoined(true);
        }
      } catch (err: any) {
        if (!isMounted) return; // Ignore errors if unmounted (e.g., strict mode aborts)
        console.error("Agora Error:", err);
        setError("Failed to join call. Please check microphone/camera permissions. " + err?.message);
      }
    };

    initCall();

    return () => {
      isMounted = false;
      localA?.close();
      localV?.close();
      client.removeAllListeners();
      client.leave();
    };
  }, [token, appId, channelName, uid, isVideo]);

  const toggleMic = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setMuted(!micMuted);
      setMicMuted(!micMuted);
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setMuted(!videoMuted);
      setVideoMuted(!videoMuted);
    }
  };

  const leaveCall = async () => {
    localAudioTrack?.close();
    localVideoTrack?.close();
    await clientRef.current?.leave();
    onEndCall();
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
        <div className="bg-[var(--color-brutal-bg)] p-6 border-4 border-black shadow-[8px_8px_0_0_#000] max-w-md w-full">
          <h2 className="text-xl font-black uppercase text-red-600 mb-4">Call Error</h2>
          <p className="font-bold mb-6">{error}</p>
          <button 
            onClick={onEndCall} 
            className="w-full py-3 bg-white border-4 border-black font-black uppercase hover:bg-gray-200 shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black text-white overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 w-full h-20 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-center justify-center px-4">
        <div className="text-white font-black uppercase text-lg tracking-widest flex flex-col items-center">
          <div>{isVideo ? "Video Call" : "Audio Call"}</div>
          {joined && (
            <div className="text-xl mt-1 text-[var(--color-brutal-yellow)] font-mono tracking-widest drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
              {formatTime(callDuration)}
            </div>
          )}
        </div>
      </div>

      {/* Video / Audio Area */}
      <div className="flex-1 relative flex flex-wrap items-center justify-center p-2 gap-2">
        {!joined && (
          <div className="text-center font-black uppercase text-2xl animate-pulse text-[var(--color-brutal-yellow)]">
            Connecting...
          </div>
        )}
        
        {joined && remoteUsers.length === 0 && (
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full border-4 border-[var(--color-brutal-blue)] border-t-transparent animate-spin mb-4"></div>
            <div className="text-center font-black uppercase text-xl text-gray-400">Waiting for {partnerName} to join...</div>
          </div>
        )}

        {/* Remote Videos */}
        {remoteUsers.map(user => (
          <div 
            key={user.uid} 
            id={`remote-video-${user.uid}`} 
            className={`w-full h-full max-w-3xl bg-gray-900 border-4 border-[var(--color-brutal-blue)] overflow-hidden relative shadow-[8px_8px_0_0_#000] ${!user.hasVideo && isVideo ? 'flex items-center justify-center' : ''}`}
          >

            <div className="absolute bottom-4 left-4 z-10 bg-[var(--color-brutal-bg)] text-black border-2 border-black px-2 py-1 font-black text-sm uppercase shadow-[4px_4px_0_0_#000]">
              {partnerName}
            </div>
          </div>
        ))}

        {/* Local Video (Floating if remote exists, or centered if alone) */}
        {isVideo && localVideoTrack && (
          <div 
            id="local-video" 
            className={`${remoteUsers.length > 0 ? 'absolute bottom-6 right-6 w-32 h-48 md:w-48 md:h-64 border-4 border-[var(--color-brutal-yellow)]' : 'w-full h-full max-w-3xl border-4 border-[var(--color-brutal-yellow)]'} bg-gray-800 overflow-hidden shadow-[8px_8px_0_0_#000] transition-all duration-300 z-20`}
          >
            <div className="absolute bottom-2 left-2 z-10 bg-white text-black border-2 border-black px-1.5 py-0.5 font-black text-xs uppercase">
              You
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-28 bg-[var(--color-brutal-bg)] border-t-4 border-black flex items-center justify-center gap-6 sm:gap-10 pb-safe z-10 shadow-[0_-8px_0_0_rgba(0,0,0,0.1)] relative">
        <button 
          onClick={toggleMic}
          className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full border-4 border-black shadow-[4px_4px_0_0_#000] transition-transform active:translate-y-1 active:shadow-none ${micMuted ? 'bg-[var(--color-brutal-red)] text-black' : 'bg-white text-black'}`}
        >
          {micMuted ? <MicOff size={28} /> : <Mic size={28} />}
        </button>

        {isVideo && (
          <button 
            onClick={toggleVideo}
            className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full border-4 border-black shadow-[4px_4px_0_0_#000] transition-transform active:translate-y-1 active:shadow-none ${videoMuted ? 'bg-[var(--color-brutal-red)] text-black' : 'bg-white text-black'}`}
          >
            {videoMuted ? <VideoOff size={28} /> : <Video size={28} />}
          </button>
        )}

        <button 
          onClick={toggleSpeaker}
          className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full border-4 border-black shadow-[4px_4px_0_0_#000] transition-transform active:translate-y-1 active:shadow-none ${!speakerOn ? 'bg-[var(--color-brutal-yellow)] text-black' : 'bg-white text-black'}`}
        >
          {speakerOn ? <Volume2 size={28} /> : <Ear size={28} />}
        </button>

        <button 
          onClick={leaveCall}
          className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-full border-4 border-black shadow-[6px_6px_0_0_#000] bg-[var(--color-brutal-red)] text-white transition-transform active:translate-y-1 active:shadow-[2px_2px_0_0_#000]"
        >
          <PhoneOff size={32} />
        </button>
      </div>
    </div>
  );
}

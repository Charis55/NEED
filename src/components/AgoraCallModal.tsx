"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, Ear } from "lucide-react";
import { Capacitor } from "@capacitor/core";

interface AgoraCallModalProps {
  channelName: string;
  uid: string;
  isVideo: boolean;
  partnerName: string;
  partnerPhoto?: string;
  onEndCall: () => void;
}

export default function AgoraCallModal({ channelName, uid, isVideo, partnerName, partnerPhoto, onEndCall }: AgoraCallModalProps) {
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
    // Play pickup sound when call connects
    if (typeof window !== "undefined") {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3");
      audio.play().catch(e => console.warn("Audio play failed:", e));
    }
  }, []);

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

  const toggleSpeaker = async () => {
    if (typeof window !== 'undefined' && Capacitor.getPlatform() !== "web") {
      if ((window as any).AudioToggle) {
        if (speakerOn) {
          (window as any).AudioToggle.setAudioMode((window as any).AudioToggle.EARPIECE);
        } else {
          (window as any).AudioToggle.setAudioMode((window as any).AudioToggle.SPEAKER);
        }
      }
    }
    setSpeakerOn(!speakerOn);
  };

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const mountUid = useRef(`${uid}_${Math.random().toString(36).slice(2, 7)}`).current;

  // 1. Fetch token
  useEffect(() => {
    if (!appId) {
      setError("Agora App ID is missing in environment variables (.env.local).");
      return;
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://need-chi.vercel.app';
    fetch(`${baseUrl}/api/agora/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName, uid: mountUid })
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          setToken(data.token);
        } else {
          setError(data.error || "Failed to get token");
        }
      })
      .catch(e => setError("Failed to fetch token: " + e.message));
  }, [channelName, mountUid, appId]);

  // 2. Join Call and setup Tracks
  useEffect(() => {
    if (!token || !appId) return;

    let isMounted = true;
    let localA: IMicrophoneAudioTrack;
    let localV: ICameraVideoTrack;
    let connectionPromise: Promise<void> | null = null;
    
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
              user.videoTrack?.play(`remote-video-${user.uid}`, { fit: "contain" });
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
        if (!isMounted) {
          localA.stop();
          localA.close();
          return;
        }

        if (isVideo) {
          localV = await AgoraRTC.createCameraVideoTrack();
          if (!isMounted) {
            localA.stop();
            localA.close();
            localV.stop();
            localV.close();
            return;
          }
        }

        // 2. Join channel AFTER permissions are granted and tracks created
        let joinSuccess = false;
        let retries = 3;
        while (!joinSuccess && retries > 0) {
          try {
            await client.join(appId, channelName, token, mountUid);
            joinSuccess = true;
          } catch (err: any) {
            if (err?.code === 'UID_CONFLICT' || err?.message?.includes('UID_CONFLICT')) {
              console.warn("UID_CONFLICT detected, retrying in 1s to allow previous connection to close...");
              await new Promise(r => setTimeout(r, 1000));
              retries--;
              if (retries === 0) throw err;
            } else {
              throw err;
            }
          }
        }
        if (!isMounted) {
          if (localA) { localA.stop(); localA.close(); }
          if (localV) { localV.stop(); localV.close(); }
          return;
        }

        // 3. Publish tracks
        if (isVideo) {
          await client.publish([localA, localV]);
          if (!isMounted) {
            if (localA) { localA.stop(); localA.close(); }
            if (localV) { localV.stop(); localV.close(); }
            return;
          }

          setLocalVideoTrack(localV);
          setTimeout(() => {
            localV.play("local-video");
          }, 100);
        } else {
          await client.publish([localA]);
          if (!isMounted) {
            if (localA) { localA.stop(); localA.close(); }
            if (localV) { localV.stop(); localV.close(); }
            return;
          }
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

    connectionPromise = initCall();

    return () => {
      isMounted = false;
      if (localA) {
        localA.stop();
        localA.close();
      }
      if (localV) {
        localV.stop();
        localV.close();
      }
      client.removeAllListeners();
      
      if (connectionPromise) {
        connectionPromise.finally(() => {
          client.leave().catch(console.error);
        });
      } else {
        client.leave().catch(console.error);
      }
    };
  }, [token, appId, channelName, mountUid, isVideo]);

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
    if (typeof window !== "undefined") {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3");
      audio.play().catch(e => console.warn("End call audio failed:", e));
    }
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    if (localVideoTrack) {
      localVideoTrack.stop();
      localVideoTrack.close();
    }
    clientRef.current?.removeAllListeners();
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
    <div className={`fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-[var(--color-brutal-bg)] text-black`}>
      
      {/* Audio-only UI Design */}
      {!isVideo && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
            {/* Background Pattern for Audio Call */}
            <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            
            <div className="relative z-10 flex flex-col items-center w-full">
              <div className="w-32 h-32 md:w-48 md:h-48 bg-[var(--color-brutal-pink)] border-8 border-black shadow-[16px_16px_0_0_#000] rounded-none flex items-center justify-center overflow-hidden mb-12 animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]">
                {partnerPhoto ? (
                  <img src={partnerPhoto} alt={partnerName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-6xl md:text-8xl font-black">{partnerName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4 text-center bg-white px-8 py-3 border-4 border-black shadow-[8px_8px_0_0_#000]">{partnerName}</h1>
              
              <div className="h-16 flex items-center justify-center mt-8">
                {!joined ? (
                  <div className="text-xl font-bold uppercase tracking-widest text-black bg-[var(--color-brutal-yellow)] border-4 border-black shadow-[4px_4px_0_0_#000] px-6 py-2 animate-bounce">
                    Connecting...
                  </div>
                ) : (
                  <div className="text-4xl font-mono font-black tracking-widest bg-white px-8 py-3 border-4 border-black shadow-[6px_6px_0_0_#000]">
                    {formatTime(callDuration)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Video-only UI Design */}
      {isVideo && (
        <>
          {/* Header */}
          <div className="absolute top-6 left-6 right-6 z-30 flex justify-between items-start pointer-events-none">
            <div className="flex gap-2 pointer-events-auto flex-col sm:flex-row">
              <div className="bg-[var(--color-brutal-blue)] text-black px-4 py-2 border-4 border-black shadow-[4px_4px_0_0_#000] font-black uppercase tracking-widest text-sm sm:text-base inline-block w-max">
                Video Call
              </div>
              {joined && (
                <div className="bg-white text-black px-4 py-2 border-4 border-black shadow-[4px_4px_0_0_#000] font-mono font-black tracking-widest text-sm sm:text-base inline-block w-max">
                  {formatTime(callDuration)}
                </div>
              )}
            </div>
          </div>

          {/* Video Area */}
          <div className="flex-1 relative bg-[var(--color-brutal-bg)] border-b-4 border-black overflow-hidden z-10">
            {!joined && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--color-brutal-bg)]">
                <div className="text-center font-black uppercase text-2xl sm:text-3xl animate-pulse text-black border-4 border-black px-6 py-4 shadow-[8px_8px_0_0_#000] bg-[var(--color-brutal-yellow)]">
                  Connecting...
                </div>
              </div>
            )}
            
            {joined && remoteUsers.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[var(--color-brutal-bg)]">
                <div className="w-24 h-24 rounded-none border-8 border-black bg-[var(--color-brutal-blue)] animate-spin mb-8 shadow-[8px_8px_0_0_#000]"></div>
                <div className="text-center font-black uppercase text-xl sm:text-2xl text-black bg-white border-4 border-black px-6 py-3 shadow-[6px_6px_0_0_#000]">
                  Waiting for {partnerName}...
                </div>
              </div>
            )}

            {/* Remote Videos (Full Screen) */}
            {remoteUsers.map(user => (
              <div 
                key={user.uid} 
                id={`remote-video-${user.uid}`} 
                className={`absolute inset-0 w-full h-full object-cover ${!user.hasVideo ? 'flex items-center justify-center bg-[var(--color-brutal-bg)]' : 'bg-black'}`}
              >
                {!user.hasVideo && (
                   <div className="text-black bg-[var(--color-brutal-yellow)] px-6 py-3 border-4 border-black shadow-[6px_6px_0_0_#000] font-black uppercase text-2xl">
                     Camera Off
                   </div>
                )}
                <div className="absolute bottom-6 left-6 z-10 bg-[var(--color-brutal-yellow)] text-black border-4 border-black px-4 py-2 font-black text-lg uppercase shadow-[4px_4px_0_0_#000]">
                  {partnerName}
                </div>
              </div>
            ))}

            {/* Local Video Picture-in-Picture */}
            {localVideoTrack && (
              <div 
                id="local-video" 
                className={`absolute ${remoteUsers.length > 0 ? 'top-6 right-6 w-28 h-40 sm:w-40 sm:h-56 border-4 border-black shadow-[8px_8px_0_0_#000]' : 'inset-0 w-full h-full'} bg-black overflow-hidden transition-all duration-300 z-20`}
              >
                <div className="absolute bottom-2 left-2 z-10 bg-white text-black border-2 border-black px-2 py-1 font-black text-xs uppercase shadow-[2px_2px_0_0_#000]">
                  You
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Shared Controls Footer */}
      <div className={`p-6 sm:p-8 flex items-center justify-center pb-safe z-[50] relative bg-[var(--color-brutal-bg)]`}>
        <div className="flex gap-4 sm:gap-6 bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-4 sm:p-6 w-full max-w-md justify-between items-center">
          <button 
            onClick={toggleMic}
            className={`flex-1 max-w-[4rem] aspect-square flex items-center justify-center border-4 border-black brutal-shadow-hover ${micMuted ? 'bg-[var(--color-brutal-pink)] text-black' : 'bg-[var(--color-brutal-bg)] text-black'}`}
          >
            {micMuted ? <MicOff size={24} className="sm:w-8 sm:h-8" /> : <Mic size={24} className="sm:w-8 sm:h-8" />}
          </button>

          {isVideo && (
            <button 
              onClick={toggleVideo}
              className={`flex-1 max-w-[4rem] aspect-square flex items-center justify-center border-4 border-black brutal-shadow-hover ${videoMuted ? 'bg-[var(--color-brutal-pink)] text-black' : 'bg-[var(--color-brutal-bg)] text-black'}`}
            >
              {videoMuted ? <VideoOff size={24} className="sm:w-8 sm:h-8" /> : <Video size={24} className="sm:w-8 sm:h-8" />}
            </button>
          )}

          {typeof window !== "undefined" && Capacitor.getPlatform() !== "web" && (
            <button 
              onClick={toggleSpeaker}
              className={`flex-1 max-w-[4rem] aspect-square flex items-center justify-center border-4 border-black brutal-shadow-hover ${!speakerOn ? 'bg-[var(--color-brutal-yellow)] text-black' : 'bg-[var(--color-brutal-bg)] text-black'}`}
            >
              {speakerOn ? <Volume2 size={24} className="sm:w-8 sm:h-8" /> : <Ear size={24} className="sm:w-8 sm:h-8" />}
            </button>
          )}

          <button 
            onClick={leaveCall}
            className="flex-1 max-w-[5rem] aspect-square flex items-center justify-center border-4 border-black brutal-shadow-hover bg-[var(--color-brutal-red)] text-black"
          >
            <PhoneOff size={28} className="sm:w-10 sm:h-10" />
          </button>
        </div>
      </div>
    </div>
  );
}

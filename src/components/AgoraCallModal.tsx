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
    // Play pickup sound when call connects
    if (typeof window !== "undefined") {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3");
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
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://need-chi.vercel.app';
    fetch(`${baseUrl}/api/agora/token`, {
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
      .catch(e => setError("Failed to fetch token: " + e.message));
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
    <div className={`fixed inset-0 z-[9999] flex flex-col overflow-hidden ${!isVideo ? 'bg-[var(--color-brutal-bg)] text-black' : 'bg-black text-white'}`}>
      
      {/* Audio-only UI Design */}
      {!isVideo && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
            {/* Background Pattern for Audio Call */}
            <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            
            <div className="relative z-10 flex flex-col items-center w-full">
              <div className="w-32 h-32 md:w-48 md:h-48 bg-[var(--color-brutal-pink)] border-8 border-black shadow-[16px_16px_0_0_#000] rounded-full flex items-center justify-center overflow-hidden mb-12 animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]">
                <span className="text-6xl md:text-8xl font-black">{partnerName.charAt(0).toUpperCase()}</span>
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
          <div className="absolute top-0 w-full h-24 bg-gradient-to-b from-black/90 to-transparent z-10 flex items-center justify-center px-4">
            <div className="text-white font-black uppercase text-xl tracking-widest flex flex-col items-center mt-6">
              <div className="bg-[var(--color-brutal-bg)] text-black px-4 py-1 border-2 border-black">Video Call</div>
              {joined && (
                <div className="text-2xl mt-2 text-[var(--color-brutal-yellow)] font-mono tracking-widest drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
                  {formatTime(callDuration)}
                </div>
              )}
            </div>
          </div>

          {/* Video Area */}
          <div className="flex-1 relative bg-black">
            {!joined && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center font-black uppercase text-3xl animate-pulse text-[var(--color-brutal-yellow)]">
                  Connecting...
                </div>
              </div>
            )}
            
            {joined && remoteUsers.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/50">
                <div className="w-24 h-24 rounded-full border-8 border-[var(--color-brutal-blue)] border-t-transparent animate-spin mb-6"></div>
                <div className="text-center font-black uppercase text-2xl text-white bg-black border-2 border-white px-4 py-2">Waiting for {partnerName}...</div>
              </div>
            )}

            {/* Remote Videos (Full Screen) */}
            {remoteUsers.map(user => (
              <div 
                key={user.uid} 
                id={`remote-video-${user.uid}`} 
                className={`absolute inset-0 w-full h-full object-cover ${!user.hasVideo ? 'flex items-center justify-center bg-gray-900' : ''}`}
              >
                {!user.hasVideo && (
                   <div className="text-gray-500 font-bold uppercase text-xl">Camera Off</div>
                )}
                <div className="absolute top-28 left-4 z-10 bg-[var(--color-brutal-bg)] text-black border-4 border-black px-4 py-2 font-black text-lg uppercase shadow-[6px_6px_0_0_#000]">
                  {partnerName}
                </div>
              </div>
            ))}

            {/* Local Video Picture-in-Picture */}
            {localVideoTrack && (
              <div 
                id="local-video" 
                className={`absolute ${remoteUsers.length > 0 ? 'bottom-6 right-4 w-32 h-48 md:w-48 md:h-72 border-4 border-[var(--color-brutal-yellow)]' : 'inset-0 w-full h-full'} bg-gray-800 overflow-hidden shadow-[8px_8px_0_0_#000] transition-all duration-300 z-20`}
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
      <div className={`h-32 border-t-8 border-black flex items-center justify-center gap-6 sm:gap-10 pb-safe z-[50] relative ${!isVideo ? 'bg-[var(--color-brutal-blue)] shadow-[0_-8px_0_0_rgba(0,0,0,1)]' : 'bg-black/90'}`}>
        <button 
          onClick={toggleMic}
          className={`w-16 h-16 flex items-center justify-center rounded-full border-4 border-black shadow-[6px_6px_0_0_#000] transition-transform active:translate-y-1 active:shadow-none ${micMuted ? 'bg-gray-400 text-black' : 'bg-white text-black'}`}
        >
          {micMuted ? <MicOff size={32} /> : <Mic size={32} />}
        </button>

        {isVideo && (
          <button 
            onClick={toggleVideo}
            className={`w-16 h-16 flex items-center justify-center rounded-full border-4 border-black shadow-[6px_6px_0_0_#000] transition-transform active:translate-y-1 active:shadow-none ${videoMuted ? 'bg-gray-400 text-black' : 'bg-white text-black'}`}
          >
            {videoMuted ? <VideoOff size={32} /> : <Video size={32} />}
          </button>
        )}

        <button 
          onClick={toggleSpeaker}
          className={`w-16 h-16 flex items-center justify-center rounded-full border-4 border-black shadow-[6px_6px_0_0_#000] transition-transform active:translate-y-1 active:shadow-none ${!speakerOn ? 'bg-[var(--color-brutal-yellow)] text-black' : 'bg-white text-black'}`}
        >
          {speakerOn ? <Volume2 size={32} /> : <Ear size={32} />}
        </button>

        <button 
          onClick={leaveCall}
          className="w-20 h-20 flex items-center justify-center rounded-full border-4 border-black shadow-[8px_8px_0_0_#000] bg-[var(--color-brutal-red)] text-white transition-transform active:translate-y-1 active:shadow-[2px_2px_0_0_#000] ml-4"
        >
          <PhoneOff size={36} />
        </button>
      </div>
    </div>
  );
}

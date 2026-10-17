"use client";

import { useEffect, useState, useRef } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, Ear } from "lucide-react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { apiFetch } from "@/utils/apiBase";

interface AudioTogglePlugin {
  setAudioMode(options: { mode: "speaker" | "earpiece" | "normal" }): Promise<{ success: boolean; mode?: string }>;
  isSpeakerphoneOn(): Promise<{ speakerOn: boolean }>;
  startOngoingCall(options: {
    partnerName: string;
    isVideo: boolean;
    connectedAt: number;
    isMuted?: boolean;
    isSpeaker?: boolean;
  }): Promise<{ success: boolean }>;
  stopOngoingCall(): Promise<{ success: boolean }>;
}

const AudioToggle = registerPlugin<AudioTogglePlugin>("AudioToggle");

interface AgoraCallModalProps {
  channelName: string;
  uid: string;
  isVideo: boolean;
  partnerName: string;
  partnerPhoto?: string;
  connectedAt?: number | null;
  bothConnectedAt?: number | null;
  onBothConnected?: (timestamp: number) => void;
  onEndCall: (durationSec?: number) => void;
}

export default function AgoraCallModal({ 
  channelName, 
  uid, 
  isVideo, 
  partnerName, 
  partnerPhoto, 
  connectedAt,
  bothConnectedAt,
  onBothConnected,
  onEndCall 
}: AgoraCallModalProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [joinUid, setJoinUid] = useState<string | null>(null);
  const isJoiningRef = useRef(false);
  const hasJoinedRef = useRef(false);
  const [joined, setJoined] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  
  const [micMuted, setMicMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  // Default audio calls to discrete earpiece (false); video calls to loudspeaker (true)
  const [speakerOn, setSpeakerOn] = useState(isVideo);
  const speakerOnRef = useRef(speakerOn);
  speakerOnRef.current = speakerOn;
  const [error, setError] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const callDurationRef = useRef(0);
  callDurationRef.current = callDuration;
  const localJoinedAtRef = useRef<number | null>(null);

  // Both participants are connected in the channel
  const bothConnected = joined && remoteUsers.length > 0;

  useEffect(() => {
    // Play pickup sound when call connects
    if (typeof window !== "undefined") {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3");
      audio.play().catch(e => console.warn("Audio play failed:", e));
    }

    return () => {
      // Ensure audio routing is reset to normal and notification is dismissed when exiting call
      if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
        AudioToggle.stopOngoingCall().catch(e => console.warn("AudioToggle stopOngoingCall failed on unmount:", e));
        AudioToggle.setAudioMode({ mode: "normal" }).catch(e =>
          console.warn("AudioToggle reset failed on unmount:", e)
        );
      }
    };
  }, []);

  // When call connects, set initial audio route
  useEffect(() => {
    if (joined && typeof window !== "undefined" && Capacitor.isNativePlatform()) {
      AudioToggle.setAudioMode({ mode: speakerOn ? "speaker" : "earpiece" }).catch(e =>
        console.warn("AudioToggle initial route failed:", e)
      );
    }
  }, [joined]);

  // Clean, monotonic in-call timer: counts smoothly from 0 for the duration of the call on this device
  useEffect(() => {
    if (!joined) return;

    if (!localJoinedAtRef.current) {
      localJoinedAtRef.current = Date.now();
    }

    // Sync Samsung One UI "Now Bar" / Live Status Bar ongoing call notification
    if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
      AudioToggle.startOngoingCall({
        partnerName: partnerName || "Need Call",
        isVideo,
        connectedAt: localJoinedAtRef.current,
        isMuted: micMuted,
        isSpeaker: speakerOn,
      }).catch(e => console.warn("AudioToggle startOngoingCall failed:", e));
    }

    const calcElapsed = () => {
      if (!localJoinedAtRef.current) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - localJoinedAtRef.current) / 1000));
      setCallDuration(elapsed);
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 1000);
    return () => clearInterval(interval);
  }, [joined, isVideo, micMuted, speakerOn, partnerName]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleSpeaker = async () => {
    const nextSpeakerState = !speakerOn;
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      try {
        await AudioToggle.setAudioMode({ mode: nextSpeakerState ? "speaker" : "earpiece" });
      } catch (err) {
        console.warn("AudioToggle setAudioMode failed:", err);
      }
    }
    setSpeakerOn(nextSpeakerState);
  };

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;

  // 1. Fetch token using mobile-safe apiFetch
  useEffect(() => {
    if (!appId) {
      setError("Agora App ID is missing in environment variables (.env.local).");
      return;
    }
    
    apiFetch('/api/agora/token', {
      method: 'POST',
      body: JSON.stringify({ channelName, uid })
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          setJoinUid(data.joinUid || String(uid));
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
    let connectionPromise: Promise<void> | null = null;
    
    // Create a fresh client for this effect execution
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    clientRef.current = client;

    const initCall = async () => {
      if (isJoiningRef.current || hasJoinedRef.current) return;
      isJoiningRef.current = true;
      try {
        // Listeners for remote users
        client.on("user-joined", (user) => {
          setRemoteUsers(prev => {
            if (prev.find(u => u.uid === user.uid)) return prev;
            return [...prev, user];
          });
        });

        client.on("user-published", async (user, mediaType) => {
          setRemoteUsers(prev => {
            if (prev.find(u => u.uid === user.uid)) return prev;
            return [...prev, user];
          });

          try {
            await client.subscribe(user, mediaType);
          } catch (err) {
            console.error("Agora subscribe error:", err);
            return;
          }

          if (mediaType === "video") {
            // Delay slightly to ensure DOM element exists before playing
            setTimeout(() => {
              user.videoTrack?.play(`remote-video-${user.uid}`, { fit: "contain" });
            }, 100);
          }
          if (mediaType === "audio") {
            user.audioTrack?.play();
            // Re-assert audio routing immediately after remote audio begins playing in WebView
            if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
              setTimeout(() => {
                AudioToggle.setAudioMode({ mode: speakerOnRef.current ? "speaker" : "earpiece" }).catch(e =>
                  console.warn("AudioToggle re-route on audio play failed:", e)
                );
              }, 250);
            }
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

        // 1. Create local tracks with discrete voice filtering (AEC, ANS, AGC)
        localA = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
          AGC: true,
        });
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
        // Priority: try user account string first, with automatic fallback to null for wildcard numeric token
        let currentJoinParam: string | null = joinUid || String(uid);
        let triedFallback = false;

        while (!joinSuccess && retries > 0) {
          try {
            await client.join(appId, channelName, token, currentJoinParam);
            joinSuccess = true;
          } catch (err: any) {
            console.warn(`Agora join attempt failed with param [${currentJoinParam}] (retries left: ${retries - 1}):`, err);
            const errStr = (err?.message || '') + (err?.code || '');

            // If token authorization fails due to UID mismatch (e.g. token signed for user account vs wildcard 0)
            if (!triedFallback && (errStr.includes('invalid token') || errStr.includes('CAN_NOT_GET_GATEWAY_SERVER') || err?.code === 4096)) {
              console.warn("Switching join parameter between account UID and wildcard null...");
              currentJoinParam = currentJoinParam ? null : String(uid);
              triedFallback = true;
              continue;
            }

            if (err?.code === 'UID_CONFLICT' || errStr.includes('UID_CONFLICT')) {
              console.warn("UID_CONFLICT detected, retrying join in 600ms...");
              await new Promise(r => setTimeout(r, 600));
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

        // Sync existing remote users who joined before local client
        if (client.remoteUsers && client.remoteUsers.length > 0) {
          setRemoteUsers(prev => {
            const combined = [...prev];
            for (const ru of client.remoteUsers) {
              if (!combined.find(u => u.uid === ru.uid)) {
                combined.push(ru);
              }
            }
            return combined;
          });
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
          if (!localJoinedAtRef.current) {
            localJoinedAtRef.current = Date.now();
          }
          hasJoinedRef.current = true;
          setJoined(true);

          if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
            AudioToggle.setAudioMode({ mode: speakerOnRef.current ? "speaker" : "earpiece" }).catch(console.warn);
          }
        }
      } catch (err: any) {
        if (!isMounted) return; // Ignore errors if unmounted (e.g., strict mode aborts)
        console.error("Agora Error:", err);
        setError("Failed to join call. Please check microphone/camera permissions. " + err?.message);
      } finally {
        isJoiningRef.current = false;
      }
    };

    connectionPromise = initCall();

    return () => {
      isMounted = false;
      isJoiningRef.current = false;
      hasJoinedRef.current = false;
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
  }, [token, appId, channelName]);

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
    if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
      AudioToggle.stopOngoingCall().catch(e => console.warn("AudioToggle stopOngoingCall failed in leaveCall:", e));
      AudioToggle.setAudioMode({ mode: "normal" }).catch(e =>
        console.warn("AudioToggle reset failed in leaveCall:", e)
      );
    }
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
    onEndCall(callDurationRef.current);
  };

  // Wire deep link handlers for background ongoing call notification actions (End, Mute, Speaker)
  const leaveCallRef = useRef(leaveCall);
  leaveCallRef.current = leaveCall;
  const toggleMicRef = useRef(toggleMic);
  toggleMicRef.current = toggleMic;
  const toggleSpeakerRef = useRef(toggleSpeaker);
  toggleSpeakerRef.current = toggleSpeaker;

  useEffect(() => {
    let sub: any = null;
    if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
      sub = App.addListener('appUrlOpen', (data) => {
        if (!data?.url) return;
        if (data.url.includes('call/end')) {
          leaveCallRef.current();
        } else if (data.url.includes('call/toggle-mute')) {
          toggleMicRef.current();
        } else if (data.url.includes('call/toggle-speaker')) {
          toggleSpeakerRef.current();
        }
      });
    }
    return () => {
      if (sub) {
        sub.then((handle: any) => handle?.remove?.()).catch(console.warn);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
        <div className="bg-[var(--color-brutal-bg)] p-6 border-4 border-black shadow-[8px_8px_0_0_#000] max-w-md w-full">
          <h2 className="text-xl font-black uppercase text-red-600 mb-4">Call Error</h2>
          <p className="font-bold mb-6">{error}</p>
          <button 
            onClick={() => onEndCall()} 
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
                {!bothConnected ? (
                  <div className="text-base sm:text-lg font-black uppercase tracking-wider text-black bg-[var(--color-brutal-yellow)] border-4 border-black shadow-[4px_4px_0_0_#000] px-6 py-2 animate-pulse flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-black rounded-full animate-ping mr-1"></span>
                    {joined ? `Connecting with ${partnerName}...` : "Connecting..."}
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
              {bothConnected ? (
                <div className="bg-white text-black px-4 py-2 border-4 border-black shadow-[4px_4px_0_0_#000] font-mono font-black tracking-widest text-sm sm:text-base inline-block w-max">
                  {formatTime(callDuration)}
                </div>
              ) : (
                <div className="bg-[var(--color-brutal-yellow)] text-black px-3 py-1.5 border-4 border-black shadow-[4px_4px_0_0_#000] font-black uppercase tracking-wider text-xs sm:text-sm inline-block w-max animate-pulse">
                  Connecting...
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

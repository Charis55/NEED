"use client";

import { useEffect, useState, useRef } from "react";
import AgoraRTC, { 
  IAgoraRTCClient, 
  ICameraVideoTrack, 
  IMicrophoneAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
  IAgoraRTCRemoteUser
} from "agora-rtc-sdk-ng";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, Ear } from "lucide-react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { apiFetch } from "@/utils/apiBase";
import { isMobileDevice, notifyNativeCall } from "@/utils/device";

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
  jobId?: string;
  channelName: string;
  uid: string;
  isVideo: boolean;
  isCaller?: boolean;
  partnerName: string;
  partnerPhoto?: string;
  connectedAt?: number | null;
  bothConnectedAt?: number | null;
  onBothConnected?: (timestamp: number) => void;
  onEndCall: (durationSec?: number) => void;
}

function VideoTrackPlayer({
  track,
  isLocal = false,
  className = "w-full h-full",
}: {
  track: ICameraVideoTrack | IRemoteVideoTrack | null | undefined;
  isLocal?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !track) return;

    let isCancelled = false;

    const playVideo = () => {
      if (isCancelled || !containerRef.current) return;
      try {
        try {
          track.stop();
        } catch (e) {}
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }
        track.play(containerRef.current, { fit: "cover", mirror: isLocal });

        const fixVideo = () => {
          if (!containerRef.current) return;
          const video = containerRef.current.querySelector("video");
          if (video) {
            video.setAttribute("playsinline", "true");
            video.setAttribute("webkit-playsinline", "true");
            video.setAttribute("autoplay", "true");
            video.playsInline = true;
            video.autoplay = true;
            if (isLocal) {
              video.muted = true;
              video.setAttribute("muted", "true");
            }
            video.play().catch(() => {});
          }
        };

        fixVideo();
        setTimeout(fixVideo, 50);
        setTimeout(fixVideo, 200);
        setTimeout(fixVideo, 600);
      } catch (err) {
        console.warn("[Agora VideoTrackPlayer] Play error:", err);
      }
    };

    playVideo();

    return () => {
      isCancelled = true;
      try {
        track.stop();
      } catch (e) {}
    };
  }, [track, isLocal]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}
    />
  );
}

export default function AgoraCallModal({ 
  jobId,
  channelName, 
  uid, 
  isVideo, 
  isCaller = false,
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
  // Default in-app calls to loudspeaker so both parties hear each other clearly immediately
  const [speakerOn, setSpeakerOn] = useState(true);
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
    if (bothConnected && !bothConnectedAt && onBothConnected) {
      onBothConnected(Date.now());
    }
  }, [bothConnected, bothConnectedAt, onBothConnected]);

  // Proactively unlock Web Audio Context & Agora audio on ANY user touch or click
  useEffect(() => {
    const unlockAllAudio = () => {
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
          }
        }
        if (clientRef.current) {
          clientRef.current.remoteUsers.forEach(u => {
            if (u.audioTrack && !u.audioTrack.isPlaying) {
              try {
                u.audioTrack.setVolume(100);
                u.audioTrack.play();
              } catch (playErr) {}
            }
          });
        }
      } catch (e) {}
    };

    window.addEventListener("touchstart", unlockAllAudio);
    window.addEventListener("click", unlockAllAudio);
    return () => {
      window.removeEventListener("touchstart", unlockAllAudio);
      window.removeEventListener("click", unlockAllAudio);
    };
  }, []);

  useEffect(() => {
    // Mark body as in-call to suppress generic toasts and banners
    if (typeof document !== "undefined") {
      document.body.setAttribute("data-in-call", "true");
    }

    // Play pickup sound when call connects
    if (typeof window !== "undefined") {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3");
      audio.play().catch(e => console.warn("Audio play failed:", e));
    }

    return () => {
      if (typeof document !== "undefined") {
        document.body.removeAttribute("data-in-call");
      }
      // Ensure audio routing is reset to normal and native call is ended
      if (typeof window !== "undefined") {
        if (Capacitor.isNativePlatform()) {
          AudioToggle.stopOngoingCall().catch(e => console.warn("AudioToggle stopOngoingCall failed on unmount:", e));
          AudioToggle.setAudioMode({ mode: "normal" }).catch(e =>
            console.warn("AudioToggle reset failed on unmount:", e)
          );
        }
        notifyNativeCall("endCall");
      }
    };
  }, []);

    // Listen for Native CallKit / Dynamic Island button actions
    useEffect(() => {
      const handleNativeEnd = () => {
        console.log("[AgoraCallModal] Native CallKit end event received from Dynamic Island / CallKit");
        leaveCallRef.current();
      };
      const handleNativeRoute = (e: any) => {
        if (e.detail && typeof e.detail.isSpeaker === "boolean") {
          setSpeakerOn(e.detail.isSpeaker);
        }
      };
      const handleNativeMute = (e: any) => {
        if (e.detail && typeof e.detail.isMuted === "boolean") {
          if (localAudioTrack) {
            localAudioTrack.setMuted(e.detail.isMuted);
            setMicMuted(e.detail.isMuted);
          }
        }
      };
      window.addEventListener("needNativeCallEnd", handleNativeEnd);
      window.addEventListener("needNativeRouteChanged", handleNativeRoute);
      window.addEventListener("needNativeMuteToggle", handleNativeMute);
      return () => {
        window.removeEventListener("needNativeCallEnd", handleNativeEnd);
        window.removeEventListener("needNativeRouteChanged", handleNativeRoute);
        window.removeEventListener("needNativeMuteToggle", handleNativeMute);
      };
    }, [localAudioTrack]);

    // When call connects, set initial audio route and notify native CallKit / Dynamic Island
    useEffect(() => {
      if (joined && typeof window !== "undefined") {
        if (Capacitor.isNativePlatform()) {
          AudioToggle.setAudioMode({ mode: "speaker" }).catch(e =>
            console.warn("AudioToggle initial route failed:", e)
          );
        }
        // ONLY outgoing caller triggers startCall in native CallKit. Callee answered existing call!
        if (isCaller) {
          notifyNativeCall("startCall", { partnerName, isVideo, jobId: jobId || channelName, uid });
        }
        notifyNativeCall("setAudioMode", { mode: "speaker" });
      }
    }, [joined, isCaller, partnerName, isVideo, jobId, channelName, uid]);

  // Clean, monotonic in-call timer: counts smoothly from 0 for the duration of the call on this device
  useEffect(() => {
    if (!joined) return;

    if (!localJoinedAtRef.current) {
      localJoinedAtRef.current = Date.now();
    }

    const calcElapsed = () => {
      if (!localJoinedAtRef.current) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - localJoinedAtRef.current) / 1000));
      setCallDuration(elapsed);
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 1000);
    return () => clearInterval(interval);
  }, [joined]);

  // Sync Samsung One UI "Now Bar" / Live Status Bar ongoing call notification
  useEffect(() => {
    if (typeof window !== "undefined" && Capacitor.isNativePlatform() && joined) {
      AudioToggle.startOngoingCall({
        partnerName: partnerName || "Need Call",
        isVideo,
        connectedAt: localJoinedAtRef.current || Date.now(),
        isMuted: micMuted,
        isSpeaker: speakerOn,
      }).catch(e => console.warn("AudioToggle startOngoingCall failed:", e));
    }
  }, [joined, isVideo, micMuted, speakerOn, partnerName]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleSpeaker = () => {
    const nextSpeakerState = !speakerOn;
    setSpeakerOn(nextSpeakerState);
    if (typeof window !== 'undefined') {
      const mode = nextSpeakerState ? "speaker" : "earpiece";
      if (Capacitor.isNativePlatform()) {
        AudioToggle.setAudioMode({ mode }).catch(err => {
          console.warn("AudioToggle setAudioMode failed:", err);
        });
      }
      notifyNativeCall("setAudioMode", { mode });
    }
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
      headers: { 'Content-Type': 'application/json' },
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
    
    // Create a fresh client with h264 for universal iOS Safari / WebKit hardware support
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "h264" });
    clientRef.current = client;

    const initCall = async () => {
      if (isJoiningRef.current || hasJoinedRef.current) return;
      isJoiningRef.current = true;
      try {
        // Listeners for remote users
        client.on("user-joined", () => {
          setRemoteUsers([...client.remoteUsers]);
        });

        client.on("user-published", async (user, mediaType) => {
          try {
            await client.subscribe(user, mediaType);
          } catch (err) {
            console.error("Agora subscribe error:", err);
            return;
          }

          setRemoteUsers([...client.remoteUsers]);

          if (mediaType === "audio") {
            try {
              user.audioTrack?.setVolume(100);
              user.audioTrack?.play();
            } catch (playErr) {
              console.warn("Agora audioTrack play error:", playErr);
            }
            if (typeof window !== "undefined") {
              if (Capacitor.isNativePlatform()) {
                AudioToggle.setAudioMode({ mode: speakerOnRef.current ? "speaker" : "earpiece" }).catch(console.warn);
              }
              notifyNativeCall("setAudioMode", { mode: speakerOnRef.current ? "speaker" : "earpiece" });
            }
          }
        });

        client.on("user-unpublished", () => {
          setRemoteUsers([...client.remoteUsers]);
        });

        client.on("user-left", (user, reason) => {
          console.log(`[Agora] Remote user ${user.uid} left with reason: ${reason}`);
          setRemoteUsers([...client.remoteUsers]);
          if (reason === "Quit") {
            leaveCallRef.current();
          }
        });

        // Ensure browser Web Audio Context is active and not suspended
        if (typeof window !== "undefined") {
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            try {
              const testCtx = new AudioCtx();
              if (testCtx.state === "suspended") {
                testCtx.resume().catch(() => {});
              }
            } catch (ctxErr) {}
          }
        }

        // Handle browser/webview autoplay restrictions gracefully
        AgoraRTC.onAudioAutoplayFailed = () => {
          console.warn("[Agora] Audio autoplay failed, arming touch listener to unlock audio");
          const unlock = () => {
            if (clientRef.current) {
              clientRef.current.remoteUsers.forEach(u => {
                try {
                  u.audioTrack?.play();
                } catch (e) {
                  console.warn("[Agora] Retry audio play error:", e);
                }
              });
            }
            window.removeEventListener("click", unlock);
            window.removeEventListener("touchstart", unlock);
          };
          window.addEventListener("click", unlock, { once: true });
          window.addEventListener("touchstart", unlock, { once: true });
        };

        // 1. Create local tracks: combined on video calls for single-query mobile stability
        if (isVideo) {
          try {
            const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
              { AEC: true, ANS: true, AGC: true, encoderConfig: "speech_standard" },
              { facingMode: "user", encoderConfig: "480p_1" }
            );
            localA = audioTrack;
            localV = videoTrack;
          } catch (combinedErr) {
            console.warn("[Agora] Combined tracks with presets failed, trying minimal:", combinedErr);
            try {
              const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
                {},
                { facingMode: "user" }
              );
              localA = audioTrack;
              localV = videoTrack;
            } catch (fallbackErr) {
              console.warn("[Agora] Combined fallback failed, creating tracks individually:", fallbackErr);
              try {
                localA = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
              } catch (aErr) {
                localA = await AgoraRTC.createMicrophoneAudioTrack();
              }
              try {
                localV = await AgoraRTC.createCameraVideoTrack({ facingMode: "user" });
              } catch (camErr) {
                try {
                  localV = await AgoraRTC.createCameraVideoTrack();
                } catch (camErr2) {
                  console.warn("[Agora] Camera completely unavailable:", camErr2);
                }
              }
            }
          }
          if (isMounted && localV) {
            setLocalVideoTrack(localV);
          }
        } else {
          try {
            localA = await AgoraRTC.createMicrophoneAudioTrack({
              AEC: true,
              ANS: true,
              AGC: true,
              encoderConfig: "speech_standard",
            });
          } catch (audioConstraintErr) {
            console.warn("[Agora] createMicrophoneAudioTrack with constraints failed, retrying default:", audioConstraintErr);
            localA = await AgoraRTC.createMicrophoneAudioTrack();
          }
        }

        if (!isMounted) {
          if (localA) { (localA as any).stop?.(); (localA as any).close?.(); }
          if (localV) { (localV as any).stop?.(); (localV as any).close?.(); }
          return;
        }

        try {
          localA?.setVolume(100);
        } catch (volErr) {
          console.warn("[Agora] Failed setting local track volume:", volErr);
        }

        // 2. Join channel AFTER permissions are granted and tracks created
        let joinSuccess = false;
        let retries = 3;
        const currentJoinParam: string = joinUid || String(uid);

        while (!joinSuccess && retries > 0) {
          try {
            await client.join(appId, channelName, token, currentJoinParam);
            joinSuccess = true;
            console.log(`[Agora] Successfully joined channel ${channelName} with UID ${currentJoinParam}`);
          } catch (err: any) {
            console.warn(`Agora join attempt failed with param [${currentJoinParam}] (retries left: ${retries - 1}):`, err);
            const errStr = (err?.message || '') + (err?.code || '');

            if (err?.code === 'UID_CONFLICT' || errStr.includes('UID_CONFLICT')) {
              console.warn("UID_CONFLICT detected, retrying join in 600ms...");
              await new Promise(r => setTimeout(r, 600));
            } else {
              await new Promise(r => setTimeout(r, 800));
            }
            retries--;
            if (retries === 0) throw err;
          }
        }
        if (!isMounted) {
          if (localA) { localA.stop(); localA.close(); }
          if (localV) { localV.stop(); localV.close(); }
          return;
        }

        // Sync & SUBSCRIBE to existing remote users who joined before local client
        if (client.remoteUsers && client.remoteUsers.length > 0) {
          for (const ru of client.remoteUsers) {
            setRemoteUsers(prev => (prev.find(u => u.uid === ru.uid) ? prev : [...prev, ru]));
            if (ru.hasAudio) {
              try {
                if (!ru.audioTrack) {
                  await client.subscribe(ru, "audio");
                }
                (ru as any).audioTrack?.setVolume(100);
                (ru as any).audioTrack?.play();
                console.log(`[Agora] Subscribed & playing existing remote user audio for UID: ${ru.uid}`);
              } catch (subErr) {
                console.warn(`[Agora] Failed subscribing to existing user ${ru.uid} audio:`, subErr);
              }
            }
            if (ru.hasVideo && !ru.videoTrack && isVideo) {
              try {
                await client.subscribe(ru, "video");
                setRemoteUsers([...client.remoteUsers]);
                console.log(`[Agora] Subscribed to existing user ${ru.uid} video`);
              } catch (subErr) {
                console.warn(`[Agora] Failed subscribing to existing user ${ru.uid} video:`, subErr);
              }
            }
          }
        }

        // 3. Publish tracks
        if (isVideo && localV) {
          await client.publish([localA, localV]);
          if (!isMounted) {
            if (localA) { localA.stop(); localA.close(); }
            if (localV) { localV.stop(); localV.close(); }
            return;
          }

          setLocalVideoTrack(localV);
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
  }, [token, appId, channelName, isVideo]);

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
      notifyNativeCall("endCall");
      if (Capacitor.isNativePlatform()) {
        AudioToggle.stopOngoingCall().catch(e => console.warn("AudioToggle stopOngoingCall failed in leaveCall:", e));
        AudioToggle.setAudioMode({ mode: "normal" }).catch(e =>
          console.warn("AudioToggle reset failed in leaveCall:", e)
        );
      }
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
                className="absolute inset-0 w-full h-full bg-black overflow-hidden z-10"
              >
                {user.hasVideo && user.videoTrack ? (
                  <VideoTrackPlayer track={user.videoTrack} isLocal={false} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--color-brutal-bg)]">
                    <div className="text-black bg-[var(--color-brutal-yellow)] px-6 py-3 border-4 border-black shadow-[6px_6px_0_0_#000] font-black uppercase text-xl sm:text-2xl mb-4">
                      Camera Off
                    </div>
                    <div className="text-black font-black uppercase text-lg">
                      {partnerName}
                    </div>
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
                className={`absolute ${remoteUsers.length > 0 ? 'top-6 right-6 w-28 h-40 sm:w-40 sm:h-56 border-4 border-black shadow-[8px_8px_0_0_#000]' : 'inset-0 w-full h-full'} bg-black overflow-hidden transition-all duration-300 z-20`}
              >
                <VideoTrackPlayer track={localVideoTrack} isLocal={true} />
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

          {isMobileDevice() && (
            <button 
              onClick={toggleSpeaker}
              title={speakerOn ? "Loudspeaker On - Click to switch to discrete earpiece" : "Earpiece On - Click to switch to loudspeaker"}
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

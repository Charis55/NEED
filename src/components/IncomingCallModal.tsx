import { Phone, Video, X } from "lucide-react";
import { useEffect } from "react";
import UserAvatar from "./UserAvatar";

interface IncomingCallModalProps {
  callerName: string;
  callerPhoto?: string;
  callType: "audio" | "video";
  jobTitle: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallModal({
  callerName,
  callerPhoto,
  callType,
  jobTitle,
  onAccept,
  onDecline
}: IncomingCallModalProps) {


  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-[200] p-4">
      <div className="bg-white brutal-border p-8 w-full max-w-sm text-center shadow-[12px_12px_0_0_#000] flex flex-col items-center animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
        <div className="w-24 h-24 rounded-full border-4 border-black overflow-hidden bg-[var(--color-brutal-yellow)] mb-6">
          <UserAvatar photoURL={callerPhoto} name={callerName} className="w-full h-full text-4xl font-black text-black" />
        </div>
        
        <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 truncate w-full">{callerName}</h2>
        <p className="text-black font-bold text-lg mb-1">{callType === "video" ? "Incoming Video Call" : "Incoming Audio Call"}</p>
        <p className="text-sm font-bold bg-[var(--color-brutal-teal)] px-3 py-1 border-2 border-black mb-8 inline-block shadow-[2px_2px_0_0_#000] truncate max-w-full">
          {jobTitle}
        </p>

        <div className="flex w-full justify-between gap-4">
          <button
            onClick={onDecline}
            className="flex-1 bg-[var(--color-brutal-pink)] border-4 border-black py-4 flex justify-center items-center shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0_0_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
          >
            <X className="w-8 h-8 stroke-[3]" />
          </button>
          
          <button
            onClick={onAccept}
            className="flex-1 bg-[var(--color-brutal-green)] border-4 border-black py-4 flex justify-center items-center shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0_0_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all animate-pulse"
          >
            {callType === "video" ? (
              <Video className="w-8 h-8 stroke-[3] text-black" />
            ) : (
              <Phone className="w-8 h-8 stroke-[3] text-black" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

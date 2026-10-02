import { PhoneOff } from "lucide-react";
import UserAvatar from "./UserAvatar";

interface OutgoingCallModalProps {
  calleeName: string;
  calleePhoto?: string;
  callType: "audio" | "video";
  onCancel: () => void;
}

export default function OutgoingCallModal({
  calleeName,
  calleePhoto,
  callType,
  onCancel
}: OutgoingCallModalProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-[200] p-4">
      <div className="bg-white brutal-border p-8 w-full max-w-sm text-center shadow-[12px_12px_0_0_#000] flex flex-col items-center">
        <div className="w-24 h-24 rounded-full border-4 border-black overflow-hidden bg-[var(--color-brutal-yellow)] mb-6 animate-pulse">
          <UserAvatar photoURL={calleePhoto} name={calleeName} className="w-full h-full text-4xl font-black text-black" />
        </div>
        
        <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 truncate w-full">{calleeName}</h2>
        <p className="text-black font-bold text-lg mb-8 animate-pulse">
          Calling...
        </p>

        <button
          onClick={onCancel}
          className="w-20 h-20 bg-[var(--color-brutal-red)] border-4 border-black rounded-full flex justify-center items-center shadow-[6px_6px_0_0_#000] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0_0_#000] active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_0_#000] transition-all"
        >
          <PhoneOff className="w-10 h-10 stroke-[3] text-white" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { Strike } from "@/types/platform";
import { compressImage } from "@/utils/imageCompression";
import { 
  X, 
  Upload, 
  Scale, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Trash2, 
  Eye,
  ExternalLink 
} from "lucide-react";

interface StrikeAppealModalProps {
  strike: Strike | null;
  currentUserId: string;
  onClose: () => void;
  onAppealSubmitted: () => void;
}

export default function StrikeAppealModal({
  strike,
  currentUserId,
  onClose,
  onAppealSubmitted
}: StrikeAppealModalProps) {
  const [appealNote, setAppealNote] = useState("");
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (!strike) return null;

  const isPending = strike.appealStatus === "pending";
  const isApproved = strike.appealStatus === "approved";
  const isRejected = strike.appealStatus === "rejected";
  const canAppeal = !strike.appealStatus || strike.appealStatus === "none";

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setErrorMsg(null);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        let fileToUpload = file;
        try {
          fileToUpload = await compressImage(file, 2);
        } catch {
          // If compression fails, upload original
        }

        const formData = new FormData();
        formData.append("file", fileToUpload);

        const res = await fetch("/api/upload-direct", {
          method: "POST",
          body: formData
        });

        if (!res.ok) {
          throw new Error("Failed to upload image");
        }

        const data = await res.json();
        return data.publicUrl as string;
      });

      const urls = await Promise.all(uploadPromises);
      setEvidencePhotos((prev) => [...prev, ...urls]);
    } catch (err: any) {
      console.error("Upload evidence error:", err);
      setErrorMsg("Failed to upload evidence photo(s). Please try again.");
    } finally {
      setUploading(false);
      // Reset input value
      e.target.value = "";
    }
  };

  const removePhoto = (indexToRemove: number) => {
    setEvidencePhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealNote.trim()) {
      setErrorMsg("Please provide an explanation or reason for your appeal.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/strikes/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strikeId: strike.strikeId,
          userId: currentUserId,
          appealNote: appealNote.trim(),
          appealEvidencePhotos: evidencePhotos
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit appeal");
      }

      onAppealSubmitted();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit appeal. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border-4 border-black p-6 md:p-8 max-w-xl w-full shadow-[8px_8px_0_0_#000] my-8 relative max-h-[90vh] overflow-y-auto font-mono text-black">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-4 border-black pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Scale className="w-6 h-6 text-black bg-[var(--color-brutal-yellow,#FFD700)] p-0.5 border-2 border-black" />
            <h2 className="text-xl font-black uppercase tracking-tight">
              Strike #{strike.strikeNumber} Appeal
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 border-2 border-black hover:bg-black hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-100 border-2 border-black text-red-900 font-bold text-xs uppercase flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Strike Details Card */}
        <div className="bg-red-50 border-2 border-black p-4 mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-red-700 flex items-center gap-1">
              <ShieldAlert className="w-4 h-4" /> Violation Detail
            </span>
            <span className="text-xs font-bold text-gray-500">
              Issued: {new Date(strike.issuedAt).toLocaleDateString()}
            </span>
          </div>
          <p className="font-black text-sm text-black">{strike.reason}</p>
          <p className="text-xs font-bold text-gray-700 bg-white p-2 border border-red-200">
            <strong>Surveillance Evidence:</strong> {strike.evidenceSummary}
          </p>
        </div>

        {/* Existing Appeal Status View */}
        {isPending && (
          <div className="bg-yellow-50 border-4 border-black p-5 mb-4 space-y-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <Clock className="w-5 h-5" />
              <h3 className="font-black uppercase text-sm">Appeal Currently Under Admin Review</h3>
            </div>
            <p className="text-xs font-bold text-gray-700">
              Your appeal was submitted on {strike.appealedAt ? new Date(strike.appealedAt).toLocaleDateString() : "recently"}. An administrator is examining your statement and evidence. If approved, this strike will be removed and full standing restored.
            </p>
            {strike.appealNote && (
              <div className="bg-white border-2 border-black p-3 text-xs font-bold mt-2">
                <span className="font-black uppercase text-gray-500 block mb-1">Your Submitted Statement:</span>
                "{strike.appealNote}"
              </div>
            )}
            {strike.appealEvidencePhotos && strike.appealEvidencePhotos.length > 0 && (
              <div className="mt-2">
                <span className="font-black uppercase text-xs text-gray-700 block mb-1">
                  Attached Proofs ({strike.appealEvidencePhotos.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {strike.appealEvidencePhotos.map((photo, i) => (
                    <div 
                      key={i} 
                      onClick={() => setPreviewImage(photo)}
                      className="relative w-16 h-16 border-2 border-black bg-white cursor-pointer group"
                    >
                      <Image src={photo} alt={`Evidence ${i}`} fill sizes="64px" className="object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                        <Eye className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {isApproved && (
          <div className="bg-green-50 border-4 border-black p-5 mb-4 space-y-2">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5" />
              <h3 className="font-black uppercase text-sm">Appeal Approved & Strike Voided</h3>
            </div>
            <p className="text-xs font-bold text-green-900">
              This appeal was approved. This strike is inactive and will not count towards account restrictions.
            </p>
            {strike.resolutionNote && (
              <div className="bg-white border-2 border-black p-3 text-xs font-bold">
                <span className="font-black uppercase text-gray-500 block mb-1">Admin Resolution Note:</span>
                "{strike.resolutionNote}"
              </div>
            )}
          </div>
        )}

        {isRejected && (
          <div className="bg-red-50 border-4 border-black p-5 mb-4 space-y-2">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-black uppercase text-sm">Appeal Rejected</h3>
            </div>
            <p className="text-xs font-bold text-red-900">
              This appeal was reviewed and rejected by the administration. The strike remains active on your record.
            </p>
            {strike.resolutionNote && (
              <div className="bg-white border-2 border-black p-3 text-xs font-bold">
                <span className="font-black uppercase text-gray-500 block mb-1">Admin Resolution Note:</span>
                "{strike.resolutionNote}"
              </div>
            )}
          </div>
        )}

        {/* Appeal Form (Only when not yet appealed) */}
        {canAppeal && (
          <form onSubmit={handleSubmitAppeal} className="space-y-5">
            <div>
              <label className="block text-xs font-black uppercase text-black mb-1">
                Your Explanation & Reason for Appeal <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-600 mb-2">
                Provide full context. If you communicated in good faith, experienced technical errors, or the interaction was on-platform, describe what happened clearly.
              </p>
              <textarea
                required
                rows={4}
                value={appealNote}
                onChange={(e) => setAppealNote(e.target.value)}
                placeholder="Explain why this strike should be revoked..."
                className="w-full p-3 border-2 border-black text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            {/* Evidence File Upload */}
            <div>
              <label className="block text-xs font-black uppercase text-black mb-1">
                Attach Supporting Evidence (Screenshots, receipts, photos)
              </label>
              <div className="mt-1 flex items-center gap-3">
                <label className="cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-black font-black uppercase text-xs flex items-center gap-2 shadow-[2px_2px_0_0_#000] active:translate-y-0.5">
                  <Upload className="w-4 h-4" />
                  {uploading ? "Uploading..." : "Select Files"}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-gray-500 font-bold">
                  PNG, JPG up to 10MB each
                </span>
              </div>

              {/* Uploaded Photos Preview Grid */}
              {evidencePhotos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {evidencePhotos.map((url, idx) => (
                    <div key={idx} className="relative w-20 h-20 border-2 border-black group bg-gray-100">
                      <Image
                        src={url}
                        alt={`Evidence ${idx + 1}`}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 border border-black hover:bg-black"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-3 border-t-2 border-black flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 font-black text-xs uppercase border-2 border-black"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || uploading || !appealNote.trim()}
                className="px-5 py-2.5 bg-[var(--color-brutal-yellow,#FFD700)] hover:bg-yellow-400 font-black text-xs uppercase border-2 border-black flex items-center gap-2 shadow-[2px_2px_0_0_#000] disabled:opacity-50"
              >
                <Scale className="w-4 h-4" />
                {submitting ? "Submitting Appeal..." : "Submit Appeal to Admin"}
              </button>
            </div>
          </form>
        )}

        {/* Close Button when cannot appeal */}
        {!canAppeal && (
          <div className="pt-4 border-t-2 border-black flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-black text-white font-black text-xs uppercase border-2 border-black hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        )}

        {/* Full Image Preview Lightbox */}
        {previewImage && (
          <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-black p-3 max-w-2xl w-full shadow-[8px_8px_0_0_#000]">
              <div className="flex justify-between items-center pb-2 mb-2 border-b-2 border-black">
                <span className="text-xs font-black uppercase">Evidence Photo Preview</span>
                <button onClick={() => setPreviewImage(null)} className="p-1 hover:bg-black hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative h-80 w-full bg-gray-100">
                <Image src={previewImage} alt="Preview" fill sizes="600px" className="object-contain" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

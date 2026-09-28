"use client";

import { useState } from "react";
import { X, Upload, AlertTriangle } from "lucide-react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAlert } from "@/components/AlertProvider";

interface ReportModalProps {
  jobId?: string;
  reportedUserId: string; // The person being reported (Customer or Artisan)
  reporterUserId: string;
  reporterRole: "customer" | "artisan";
  onClose: () => void;
}

export default function ReportModal({ jobId, reportedUserId, reporterUserId, reporterRole, onClose }: ReportModalProps) {
  const [category, setCategory] = useState<string>("quality");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { showAlert } = useAlert();

  const categories = [
    { id: "quality", label: "Quality of Work / No Show" },
    { id: "safety", label: "Safety / Harassment" },
    { id: "payment", label: "Payment Issue / Scam" },
    { id: "other", label: "Other" }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) return;
    
    setLoading(true);
    try {
      let evidenceUrl = null;
      if (file) {
        const fileRef = ref(storage, `disputes/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`);
        await uploadBytes(fileRef, file);
        evidenceUrl = await getDownloadURL(fileRef);
      }

      await addDoc(collection(db, "disputes"), {
        jobId: jobId || null,
        reportedUserId,
        reporterUserId,
        reporterRole,
        category,
        description,
        evidenceUrl,
        status: "open",
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error submitting report:", error);
      showAlert("Failed to submit report. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white brutal-border w-full max-w-md brutal-shadow relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 border-2 border-black flex items-center justify-center hover:bg-[var(--color-brutal-red)] hover:text-white transition-colors"
        >
          <X className="w-6 h-6 stroke-[3]" />
        </button>

        {success ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-[var(--color-brutal-green)] border-4 border-black flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 stroke-[3] text-black" />
            </div>
            <h2 className="text-2xl font-black uppercase mb-2">Report Submitted</h2>
            <p className="font-bold text-gray-600 uppercase text-sm">Our trust & safety team will review this shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8">
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-none mb-6">
              REPORT AN ISSUE
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block font-black uppercase mb-2 text-sm">Issue Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map(cat => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`p-2 border-2 border-black font-bold text-xs uppercase text-center transition-colors ${
                        category === cat.id ? "bg-black text-white" : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-black uppercase mb-2 text-sm">Description</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Please describe what happened in detail..."
                  className="w-full h-32 p-3 border-4 border-black focus:outline-none focus:bg-[var(--color-brutal-yellow)] transition-colors resize-none font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-black uppercase mb-2 text-sm">Upload Evidence (Optional)</label>
                <div className="border-4 border-black border-dashed p-4 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative">
                  <input 
                    type="file" 
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept="image/*,application/pdf"
                  />
                  <Upload className="w-8 h-8 mb-2" />
                  <span className="font-bold uppercase text-xs text-center">
                    {file ? file.name : "Tap to upload photos or screenshots"}
                  </span>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading || !description}
                className="w-full bg-[var(--color-brutal-red)] text-white border-4 border-black py-4 font-black uppercase text-xl mt-4 brutal-btn disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "SUBMITTING..." : "SUBMIT REPORT"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

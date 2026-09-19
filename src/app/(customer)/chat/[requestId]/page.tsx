"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, runTransaction } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { JobRequest, ArtisanProfile, Review } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";
import UserAvatar from "@/components/UserAvatar";
import { ChevronLeft, Send, Image as ImageIcon, X, Mic } from "lucide-react";
import VoiceNotePlayer from "@/components/VoiceNotePlayer";
import { compressImage } from "@/utils/imageCompression";
import PaymentModal from "@/components/PaymentModal";

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: number;
  imageUrl?: string;
  audioUrl?: string;
  waveform?: number[];
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.requestId as string;
  
  const [job, setJob] = useState<JobRequest | null>(null);
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const { showAlert } = useAlert();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const waveformRef = useRef<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      waveformRef.current = [];
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const drawWaveform = () => {
        if (mediaRecorder.state !== 'recording') return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;
        const normalized = Math.min(1, average / 128); // 0 to 1
        waveformRef.current.push(normalized);
        requestAnimationFrame(drawWaveform);
      };
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.start(200);
      setIsRecording(true);
      drawWaveform();
      
      // Auto-stop after 1 minute (60,000ms)
      maxDurationTimerRef.current = setTimeout(() => {
        stopRecording();
      }, 60000);
      
    } catch (err) {
      console.error("Microphone access denied", err);
      showAlert("Microphone permission denied", "error");
    }
  };

  const stopRecording = () => {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) await audioContextRef.current.close();
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 0 && waveformRef.current.length > 0) {
          sendVoiceNote(audioBlob, [...waveformRef.current]);
        }
      };
      mediaRecorderRef.current.stop();
    }
  };
  
  const sendVoiceNote = async (audioBlob: Blob, rawWaveform: number[]) => {
    const user = auth.currentUser;
    if (!user) return;
    
    setSending(true);
    try {
      const sampledWaveform = [];
      const step = Math.max(1, Math.floor(rawWaveform.length / 30));
      for (let i = 0; i < rawWaveform.length; i += step) {
        if (sampledWaveform.length < 30) {
          sampledWaveform.push(rawWaveform[i] || 0.1);
        }
      }
      
      const fileName = `audio_${Date.now()}.webm`;
      const url = await uploadFileToR2(audioBlob, fileName);
      
      await addDoc(collection(db, "jobRequests", requestId, "messages"), {
        text: "",
        audioUrl: url,
        waveform: sampledWaveform,
        senderId: user.uid,
        createdAt: Date.now()
      });
    } catch (err) {
      console.error(err);
      showAlert("Failed to send voice note", "error");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const jobDoc = await getDoc(doc(db, "jobRequests", requestId));
        if (jobDoc.exists()) {
          const jobData = jobDoc.data() as JobRequest;
          setJob(jobData);
          
          if (jobData.artisanId) {
            const artDoc = await getDoc(doc(db, "artisans", jobData.artisanId));
            if (artDoc.exists()) {
              setArtisan(artDoc.data() as ArtisanProfile);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching job", err);
        showAlert("Failed to load chat", "error");
      }
    };
    
    fetchJob();
  }, [requestId]);

  useEffect(() => {
    if (!job) return;
    
    const q = query(
      collection(db, "jobRequests", requestId, "messages"),
      orderBy("createdAt", "asc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });
    
    return () => unsubscribe();
  }, [job]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    
    const user = auth.currentUser;
    if (!user) return;
    
    setSending(true);
    try {
      await addDoc(collection(db, "jobRequests", requestId, "messages"), {
        text: newMessage,
        senderId: user.uid,
        createdAt: Date.now()
      });
      setNewMessage("");
    } catch (err) {
      console.error(err);
      showAlert("Failed to send message", "error");
    } finally {
      setSending(false);
    }
  };
  
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      if (photos.length + selectedFiles.length > 5) {
        showAlert("You can only upload a maximum of 5 photos.", "error");
        return;
      }
      setPhotos(prev => [...prev, ...selectedFiles]);
      const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
      setPhotoPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const uploadFileToR2 = async (file: File | Blob, name: string) => {
    const res = await fetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: name, contentType: file.type })
    });
    if (!res.ok) throw new Error("Failed to get upload URL");
    const { presignedUrl, publicUrl } = await res.json();
    
    const uploadRes = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    });
    if (!uploadRes.ok) throw new Error("Failed to upload file to R2");
    return publicUrl;
  };

  const handleChatPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return;

    setSending(true);
    try {
      const compressed = await compressImage(file, 4);
      const url = await uploadFileToR2(compressed, file.name);

      await addDoc(collection(db, "jobRequests", requestId, "messages"), {
        text: "",
        imageUrl: url,
        senderId: user.uid,
        createdAt: Date.now()
      });
    } catch (err) {
      console.error(err);
      showAlert("Failed to send photo", "error");
    } finally {
      setSending(false);
      e.target.value = '';
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || rating === 0) return;
    
    setSubmittingReview(true);
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Helper function to upload to R2
      const uploadFileToR2 = async (file: File | Blob, name: string) => {
        const res = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: name, contentType: file.type })
        });
        if (!res.ok) throw new Error("Failed to get upload URL");
        const { presignedUrl, publicUrl } = await res.json();
        
        const uploadRes = await fetch(presignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file
        });
        if (!uploadRes.ok) throw new Error("Failed to upload file to R2");
        return publicUrl;
      };

      // 1. Upload photos (4MB max)
      const photoUrls: string[] = [];
      for (const file of photos) {
        const compressed = await compressImage(file, 4);
        const url = await uploadFileToR2(compressed, file.name);
        photoUrls.push(url);
      }

      const reviewId = `rev_${Date.now()}`;
      
      await runTransaction(db, async (transaction) => {
        const artisanRef = doc(db, "artisans", job.artisanId as string);
        const artisanDoc = await transaction.get(artisanRef);
        
        if (!artisanDoc.exists()) throw new Error("Artisan does not exist!");

        const artisanData = artisanDoc.data() as ArtisanProfile;
        const currentCount = artisanData.ratingCount || 0;
        const currentAvg = artisanData.ratingAverage || 0;

        const newCount = currentCount + 1;
        const newAvg = ((currentAvg * currentCount) + rating) / newCount;

        const reviewRef = doc(collection(db, "reviews"));
        transaction.set(reviewRef, {
          reviewId: reviewRef.id,
          requestId: job.requestId,
          artisanId: job.artisanId,
          customerId: user.uid,
          jobTitle: job.subcategory,
          rating,
          comment,
          photos: photoUrls,
          createdAt: Date.now()
        } as Review);

        transaction.update(artisanRef, {
          ratingCount: newCount,
          ratingAverage: newAvg
        });

        const reqRef = doc(db, "jobRequests", job.requestId);
        transaction.update(reqRef, {
          reviewed: true
        });
      });

      setJob(prev => prev ? { ...prev, reviewed: true } : prev);
      setShowReviewModal(false);
      showAlert("Review submitted successfully!", "success");
    } catch (err) {
      console.error(err);
      showAlert("Failed to submit review", "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handlePaymentSuccess = async (method: "cash" | "paystack", reference?: string) => {
    try {
      const reqRef = doc(db, "jobRequests", requestId);
      await updateDoc(reqRef, {
        status: "completed",
        paymentMethod: method,
        completedAt: Date.now()
      });
      
      setJob(prev => prev ? { ...prev, status: "completed", paymentMethod: method } : prev);
      setShowPaymentModal(false);
      showAlert("Payment confirmed successfully!", "success");
    } catch (err) {
      console.error("Payment confirmation failed:", err);
      showAlert("Failed to confirm payment", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center">
        <GlobalSpinner text="LOADING CHAT" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--color-brutal-bg)] selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Header */}
      <div className="bg-[var(--color-brutal-blue)] border-b-8 border-black p-4 flex items-center shrink-0 shadow-[0_4px_0_0_#000] z-10">
        <button 
          onClick={() => router.push('/explore')}
          className="w-10 h-10 bg-white border-4 border-black flex justify-center items-center mr-4 brutal-shadow hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-transform"
        >
          <ChevronLeft className="w-6 h-6 stroke-[3]" />
        </button>
        
        <div className="w-12 h-12 rounded-full border-4 border-black overflow-hidden bg-[var(--color-brutal-yellow)] shrink-0 mr-4">
          <UserAvatar name={artisan?.name || "Artisan"} className="w-full h-full text-xl font-black text-black" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h2 className="font-black text-black text-xl uppercase truncate">{artisan?.name || "Unknown Technician"}</h2>
          <p className="text-black font-bold text-xs truncate bg-white border-2 border-black px-1 py-0.5 inline-block -rotate-1 shadow-[2px_2px_0_0_#000]">
            {job?.subcategory}
          </p>
        </div>
      </div>
      
      {/* Payment Pending Notification */}
      {job?.status === "payment_pending" && (
        <div className="bg-[var(--color-brutal-yellow)] border-b-4 border-black p-4 text-center shrink-0 shadow-[0_4px_0_0_#000] z-0">
          <p className="font-black uppercase text-black mb-2">Technician marked job as finished!</p>
          <button 
            onClick={() => setShowPaymentModal(true)}
            className="bg-[var(--color-brutal-green)] border-4 border-black px-6 py-2 font-black uppercase text-black brutal-shadow hover:-translate-y-1 transition-transform"
          >
            COMPLETE PAYMENT
          </button>
        </div>
      )}

      {/* Completed Job Notification & Review Button */}
      {job?.status === "completed" && (
        <div className="bg-[var(--color-brutal-green)] border-b-4 border-black p-4 text-center shrink-0 shadow-[0_4px_0_0_#000] z-0">
          <p className="font-black uppercase text-black mb-2">This job is completed!</p>
          {!job.reviewed ? (
            <button 
              onClick={() => setShowReviewModal(true)}
              className="bg-white border-4 border-black px-6 py-2 font-black uppercase text-black brutal-shadow hover:-translate-y-1 transition-transform"
            >
              LEAVE A REVIEW
            </button>
          ) : (
            <span className="bg-black text-white font-black px-4 py-1 uppercase text-sm border-2 border-black inline-block rotate-1 shadow-[2px_2px_0_0_#fff]">
              Review Submitted
            </span>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && job && (
        <PaymentModal 
          amount={job.offerAmount || 0}
          email={auth.currentUser?.email || ""}
          onSuccess={handlePaymentSuccess}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* Pinned Photo Retention Message */}
      {messages.some(m => !!m.imageUrl) && (
        <div className="bg-[var(--color-brutal-yellow)] border-b-4 border-black p-3 text-center shrink-0 shadow-[0_4px_0_0_#000] z-0 flex items-center justify-center gap-2">
          <ImageIcon className="w-5 h-5 text-black stroke-[3]" />
          <p className="font-black uppercase text-black text-sm">Photos clear after 1 week</p>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-0 pb-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="bg-white border-4 border-black p-6 brutal-shadow -rotate-2 max-w-xs">
              <p className="font-black text-black uppercase mb-2">Start the conversation!</p>
              <p className="text-sm font-bold text-gray-600">You can discuss pricing, timing, or details here.</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div 
                  className={`max-w-[80%] p-3 border-4 border-black shadow-[4px_4px_0_0_#000] flex flex-col ${
                    isMe 
                      ? "bg-[var(--color-brutal-yellow)] rounded-l-xl rounded-tr-xl" 
                      : "bg-white rounded-r-xl rounded-tl-xl"
                  }`}
                >
                  {msg.imageUrl && (
                    <img 
                      src={msg.imageUrl} 
                      alt="Chat photo" 
                      className="w-full max-w-[250px] object-cover brutal-border mb-2"
                    />
                  )}
                  {msg.audioUrl && (
                    <div className="mb-2">
                      {Date.now() - msg.createdAt > 30 * 24 * 60 * 60 * 1000 ? (
                        <div className="p-3 bg-gray-200 border-4 border-black text-gray-600 text-sm font-bold shadow-[4px_4px_0_0_#000]">
                          Voice note expired
                        </div>
                      ) : (
                        <VoiceNotePlayer audioUrl={msg.audioUrl} waveform={msg.waveform} />
                      )}
                    </div>
                  )}
                  {msg.text && (
                    <p className="font-bold text-black break-words text-sm md:text-base">{msg.text}</p>
                  )}
                  <p className="text-[10px] font-black mt-1 text-black/50 text-right">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t-8 border-black p-4 shrink-0 shadow-[0_-4px_0_0_#000] z-10 relative">
        <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
          <label className={`cursor-pointer border-4 border-black p-3 flex items-center justify-center transition-all bg-[var(--color-brutal-teal)] text-black brutal-shadow hover:-translate-y-1 ${sending ? 'opacity-50 pointer-events-none' : ''}`}>
            <ImageIcon className="w-6 h-6 stroke-[3]" />
            <input type="file" accept="image/*" onChange={handleChatPhotoSelect} className="hidden" disabled={sending} />
          </label>
          
          <button
            type="button"
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            className={`border-4 border-black p-3 flex items-center justify-center transition-all text-black brutal-shadow ${isRecording ? 'bg-[var(--color-brutal-red)] animate-pulse' : 'bg-[var(--color-brutal-yellow)] hover:-translate-y-1'} ${sending ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Mic className="w-6 h-6 stroke-[3]" />
          </button>
          
          <input 
            type="text" 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-50 border-4 border-black p-3 font-bold text-black focus:outline-none focus:bg-[var(--color-brutal-yellow)] transition-colors placeholder:text-gray-500 rounded-none"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-[var(--color-brutal-pink)] border-4 border-black p-3 flex items-center justify-center hover:-translate-y-1 brutal-shadow disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-[4px_4px_0_0_#000] transition-all"
          >
            <Send className="w-6 h-6 stroke-[3] text-black" />
          </button>
        </form>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white border-8 border-black max-w-lg w-full max-h-[90vh] overflow-y-auto brutal-shadow p-6 relative">
            <button 
              onClick={() => setShowReviewModal(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-[var(--color-brutal-red)] border-4 border-black flex justify-center items-center text-black brutal-shadow hover:-translate-y-1 transition-transform"
            >
              <X className="w-6 h-6 stroke-[3]" />
            </button>
            
            <h2 className="text-3xl font-black text-black uppercase mb-6 tracking-tighter">Leave a Review</h2>
            
            <form onSubmit={submitReview} className="space-y-6">
              <div>
                <label className="block text-black font-black uppercase mb-2">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`w-12 h-12 border-4 border-black text-2xl brutal-shadow hover:-translate-y-1 transition-transform ${
                        rating >= star ? 'bg-[var(--color-brutal-yellow)]' : 'bg-gray-100 grayscale'
                      }`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-black font-black uppercase mb-2">Comment</label>
                <textarea 
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full bg-white border-4 border-black p-4 font-bold text-black focus:outline-none focus:bg-[var(--color-brutal-pink)] transition-colors min-h-[120px]"
                  placeholder="How was the service?"
                  required
                />
              </div>

              <div>
                <label className="block text-black font-black uppercase mb-2">Photos (Optional)</label>
                <div className="flex flex-wrap gap-4 mb-4">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative w-24 h-24 border-4 border-black shadow-[4px_4px_0_0_#000]">
                      <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => {
                          setPhotos(prev => prev.filter((_, i) => i !== index));
                          setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="absolute -top-3 -right-3 w-8 h-8 bg-[var(--color-brutal-red)] border-2 border-black flex justify-center items-center text-white font-black text-xs hover:scale-110 transition-transform"
                      >
                        X
                      </button>
                    </div>
                  ))}
                  
                  {photos.length < 5 && (
                    <label className="w-24 h-24 border-4 border-black border-dashed flex flex-col justify-center items-center bg-gray-50 cursor-pointer hover:bg-[var(--color-brutal-teal)] transition-colors">
                      <ImageIcon className="w-8 h-8 mb-1 stroke-[2]" />
                      <span className="text-[10px] font-black uppercase">Add Photo</span>
                      <input type="file" multiple accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              <button 
                type="submit"
                disabled={submittingReview}
                className="w-full py-4 bg-[var(--color-brutal-green)] border-4 border-black font-black uppercase text-black text-xl hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
              >
                {submittingReview ? "SUBMITTING..." : "SUBMIT REVIEW"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

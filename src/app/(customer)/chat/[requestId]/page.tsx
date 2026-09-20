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
import AdUnit from "@/components/AdUnit";

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
  const [artisanUser, setArtisanUser] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [showPhotoWarning, setShowPhotoWarning] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  
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
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const waveformRef = useRef<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const secondsIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      setRecordingSeconds(0);
      drawWaveform();
      
      secondsIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
      
      // Auto-stop after 1 minute (60,000ms)
      maxDurationTimerRef.current = setTimeout(() => {
        stopRecording();
      }, 60000);
      
    } catch (err) {
      console.error("Microphone access denied", err);
      showAlert("Microphone permission denied", "error");
    }
  };

  const cancelRecording = () => {
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    if (secondsIntervalRef.current) clearInterval(secondsIntervalRef.current);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setRecordingSeconds(0);
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) await audioContextRef.current.close();
      };
      mediaRecorderRef.current.stop();
    }
  };

  const stopRecording = () => {
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    if (secondsIntervalRef.current) clearInterval(secondsIntervalRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setRecordingSeconds(0);
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) await audioContextRef.current.close();
        
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 0) {
          sendVoiceNote(audioBlob, [...waveformRef.current]);
        } else {
          showAlert("Voice note was empty", "error");
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

      await updateDoc(doc(db, "jobRequests", requestId), {
        lastMessageText: "Voice note",
        lastMessageSenderId: user.uid,
        lastMessageAt: Date.now()
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
            const artUserDoc = await getDoc(doc(db, "users", jobData.artisanId));
            if (artUserDoc.exists()) {
              setArtisanUser(artUserDoc.data());
            }
          }
          
          if (jobData.customerId) {
            const custDoc = await getDoc(doc(db, "users", jobData.customerId));
            if (custDoc.exists()) {
              setCustomer(custDoc.data());
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
      await updateDoc(doc(db, "jobRequests", requestId), {
        lastMessageText: newMessage,
        lastMessageSenderId: user.uid,
        lastMessageAt: Date.now()
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
    const formData = new FormData();
    // Reconstruct File from Blob if needed, ensuring it has a name
    const fileObj = file instanceof File ? file : new File([file], name, { type: file.type || "application/octet-stream" });
    formData.append("file", fileObj, name);

    const res = await fetch('/api/upload-direct', {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error("Upload error response:", errorData);
      throw new Error(errorData.error || "Failed to upload file");
    }
    
    const { publicUrl } = await res.json();
    return publicUrl;
  };

  const handleChatPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImage(file);
    setPendingImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleSendPendingImage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingImage) return;

    const user = auth.currentUser;
    if (!user) return;

    setSending(true);
    try {
      const compressed = await compressImage(pendingImage, 4);
      const url = await uploadFileToR2(compressed, pendingImage.name);

      await addDoc(collection(db, "jobRequests", requestId, "messages"), {
        text: newMessage,
        imageUrl: url,
        senderId: user.uid,
        createdAt: Date.now()
      });
      await updateDoc(doc(db, "jobRequests", requestId), {
        lastMessageText: newMessage || "Image attached",
        lastMessageSenderId: user.uid,
        lastMessageAt: Date.now()
      });
      setNewMessage("");
      setPendingImage(null);
      setPendingImagePreview(null);
    } catch (err) {
      console.error(err);
      showAlert("Failed to send photo", "error");
    } finally {
      setSending(false);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || rating === 0) return;
    
    setSubmittingReview(true);
    const user = auth.currentUser;
    if (!user) return;

    try {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center">
        <GlobalSpinner text="LOADING CHAT" />
      </div>
    );
  }

  const isCustomerViewing = auth.currentUser?.uid === job?.customerId;
  const chatPartnerName = isCustomerViewing 
    ? (artisan?.name || artisanUser?.displayName || (artisanUser?.firstName ? `${artisanUser.firstName} ${artisanUser.lastName}` : "Unknown Technician")) 
    : (customer?.displayName || (customer?.firstName ? `${customer.firstName} ${customer.lastName}` : "Unknown Customer"));

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--color-brutal-bg)] selection:bg-[var(--color-brutal-pink)] selection:text-black z-[100]">
      {/* Header */}
      <div className="bg-[var(--color-brutal-blue)] border-b-8 border-black pt-6 md:pt-10 pb-4 px-4 flex items-center shrink-0 shadow-[0_4px_0_0_#000] z-10">
        <button 
          onClick={() => {
            if (isCustomerViewing) {
              router.push("/inbox");
            } else {
              router.push("/technician/inbox");
            }
          }}
          className="w-12 h-12 bg-white border-4 border-black flex justify-center items-center mr-4 brutal-shadow hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-transform shrink-0"
        >
          <ChevronLeft className="w-6 h-6 stroke-[3]" />
        </button>
        
        <div className="w-14 h-14 rounded-full border-4 border-black overflow-hidden bg-[var(--color-brutal-yellow)] shrink-0 mr-4">
          <UserAvatar photoURL={isCustomerViewing ? (artisanUser?.photoURL || artisan?.portfolioPhotoUrls?.[0]) : customer?.photoURL} name={chatPartnerName} className="w-full h-full text-2xl font-black text-black" />
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col items-start justify-center">
          <div className="flex items-center gap-2 w-full">
            <h2 className="font-black text-black text-xl md:text-2xl uppercase truncate">{chatPartnerName}</h2>
            {job?.status === "completed" && (
              <span className="bg-[var(--color-brutal-green)] text-black border-2 border-black text-xs px-3 py-1 uppercase font-black rotate-2 shrink-0 shadow-[2px_2px_0_0_#000]">Completed</span>
            )}
          </div>
          <p className="text-black font-bold text-xs md:text-sm bg-white border-2 border-black px-1.5 py-0.5 inline-block -rotate-1 shadow-[2px_2px_0_0_#000] whitespace-normal break-words max-w-full leading-tight mt-1">
            {job?.subcategory}
          </p>
        </div>

        {job?.status === "completed" && isCustomerViewing && !job.reviewed && (
          <button 
            onClick={() => setShowReviewModal(true)}
            className="ml-2 bg-[var(--color-brutal-yellow)] border-2 border-black px-3 py-1.5 font-black uppercase text-black text-xs md:text-sm brutal-shadow hover:-translate-y-0.5 transition-transform shrink-0"
          >
            REVIEW
          </button>
        )}
      </div>
      
      {/* Liability Disclaimer */}
      {job?.status === "completed" && (
        <div className="bg-[var(--color-brutal-pink)] border-b-4 border-black p-2 md:p-3 text-center shrink-0 z-0 flex items-center justify-between shadow-[0_4px_0_0_#000]">
          <p className="font-bold text-black text-[10px] md:text-xs uppercase leading-tight text-left flex-1 mr-2">
            ⚠️ Upload Proof of Payment (receipt) to avoid liability.
          </p>
        
        {job?.proofOfPaymentUrl ? (
          <a 
            href={job.proofOfPaymentUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            download={`Receipt_${job.requestId}.jpg`}
            className="shrink-0 inline-block bg-[var(--color-brutal-green)] text-black font-black uppercase text-[10px] border-2 border-black px-3 py-1.5 brutal-shadow-sm hover:-translate-y-0.5 transition-transform"
          >
            DOWNLOAD PROOF
          </a>
        ) : (
          <div className="shrink-0">
            <input 
              type="file" 
              accept="image/*" 
              id="pop-upload" 
              className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                try {
                  showAlert("Uploading Proof of Payment...", "success");
                  // Compress to 2MB max
                  const compressed = await compressImage(file, 2);
                  const url = await uploadFileToR2(compressed, file.name);
                  
                  await updateDoc(doc(db, "jobRequests", requestId), {
                    proofOfPaymentUrl: url,
                    proofOfPaymentAt: Date.now()
                  });
                  
                  setJob(prev => prev ? { ...prev, proofOfPaymentUrl: url, proofOfPaymentAt: Date.now() } : prev);
                  showAlert("Proof of Payment uploaded successfully!", "success");
                } catch (err) {
                  console.error(err);
                  showAlert("Failed to upload Proof of Payment", "error");
                }
              }}
            />
            <label 
              htmlFor="pop-upload"
              className="inline-block bg-[var(--color-brutal-green)] text-black font-black uppercase text-[10px] border-2 border-black px-3 py-1.5 cursor-pointer brutal-shadow-sm hover:-translate-y-0.5 transition-transform whitespace-nowrap"
            >
              UPLOAD PROOF
            </label>
          </div>
        )}
      </div>
      )}

      {/* Liability Disclaimer */}
      {showPhotoWarning && messages.some(m => !!m.imageUrl) && (
        <div className="bg-[var(--color-brutal-yellow)] border-b-4 border-black p-3 text-center shrink-0 shadow-[0_4px_0_0_#000] z-0 flex items-center justify-center gap-2 relative">
          <ImageIcon className="w-5 h-5 text-black stroke-[3]" />
          <p className="font-black uppercase text-black text-sm">Photos clear after 1 week</p>
          <button onClick={() => setShowPhotoWarning(false)} className="absolute right-4 hover:scale-110 transition-transform">
            <X className="w-5 h-5 stroke-[3] text-black" />
          </button>
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
                      onClick={() => setEnlargedImage(msg.imageUrl!)}
                      className="w-full max-w-[250px] object-cover brutal-border mb-2 cursor-pointer hover:opacity-90 transition-opacity"
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
      <div className="bg-white border-t-8 border-black p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shrink-0 shadow-[0_-4px_0_0_#000] z-10 relative">
        {isRecording ? (
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={cancelRecording}
              className="border-4 border-black p-3 flex items-center justify-center transition-all bg-[var(--color-brutal-red)] text-white brutal-shadow hover:-translate-y-1"
            >
              <X className="w-6 h-6 stroke-[3]" />
            </button>
            
            <div className="flex-1 bg-[var(--color-brutal-yellow)] border-4 border-black p-3 flex items-center justify-center gap-4 animate-pulse brutal-shadow">
              <Mic className="w-6 h-6 stroke-[3] text-black" />
              <span className="font-black text-black">
                {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>
            
            <button
              type="button"
              onClick={stopRecording}
              disabled={sending}
              className="bg-[var(--color-brutal-pink)] border-4 border-black p-3 flex items-center justify-center hover:-translate-y-1 brutal-shadow disabled:opacity-50 transition-all"
            >
              <Send className="w-6 h-6 stroke-[3] text-black" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex gap-2 items-center min-w-0 w-full">
            <label className={`cursor-pointer border-4 border-black p-3 flex items-center justify-center transition-all bg-[var(--color-brutal-teal)] text-black brutal-shadow shrink-0 hover:-translate-y-1 ${sending ? 'opacity-50 pointer-events-none' : ''}`}>
              <ImageIcon className="w-6 h-6 stroke-[3]" />
              <input type="file" accept="image/*" onChange={handleChatPhotoSelect} className="hidden" disabled={sending} />
            </label>
            
            <button
              type="button"
              onClick={startRecording}
              className={`border-4 border-black p-3 flex items-center justify-center transition-all text-black brutal-shadow shrink-0 bg-[var(--color-brutal-yellow)] hover:-translate-y-1 ${sending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Mic className="w-6 h-6 stroke-[3]" />
            </button>
            
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 min-w-0 bg-gray-50 border-4 border-black p-3 font-bold text-black focus:outline-none focus:bg-[var(--color-brutal-yellow)] transition-colors placeholder:text-gray-500 rounded-none w-full"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="bg-[var(--color-brutal-pink)] border-4 border-black p-3 flex items-center justify-center shrink-0 hover:-translate-y-1 brutal-shadow disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-[4px_4px_0_0_#000] transition-all"
            >
              <Send className="w-6 h-6 stroke-[3] text-black" />
            </button>
          </form>
        )}
      </div>

      <div className="bg-white shrink-0">
        <AdUnit adSlot="3608382521" className="border-t-0" />
      </div>

      {/* Pending Image Preview Modal */}
      {pendingImagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-white border-8 border-black max-w-lg w-full brutal-shadow flex flex-col relative overflow-hidden">
            <button 
              onClick={() => {
                setPendingImage(null);
                setPendingImagePreview(null);
                setNewMessage("");
              }}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-[var(--color-brutal-red)] border-4 border-black flex justify-center items-center text-black brutal-shadow hover:-translate-y-1 transition-transform"
            >
              <X className="w-6 h-6 stroke-[3]" />
            </button>
            <div className="flex-1 bg-gray-100 flex items-center justify-center p-4 min-h-[40vh] max-h-[60vh]">
              <img src={pendingImagePreview} alt="Preview" className="max-w-full max-h-full object-contain brutal-border shadow-[4px_4px_0_0_#000]" />
            </div>
            <form onSubmit={handleSendPendingImage} className="bg-white border-t-8 border-black p-4 flex gap-2 items-center">
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Add a caption..."
                className="flex-1 bg-gray-50 border-4 border-black p-3 font-bold text-black focus:outline-none focus:bg-[var(--color-brutal-yellow)] transition-colors placeholder:text-gray-500 rounded-none"
              />
              <button 
                type="submit"
                disabled={sending}
                className="bg-[var(--color-brutal-teal)] border-4 border-black p-3 flex items-center justify-center hover:-translate-y-1 brutal-shadow disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-[4px_4px_0_0_#000] transition-all"
              >
                {sending ? <GlobalSpinner text="" /> : <Send className="w-6 h-6 stroke-[3] text-black" />}
              </button>
            </form>
          </div>
        </div>
      )}

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
      {/* Image Modal */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <button 
              className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 bg-[var(--color-brutal-red)] border-4 border-black w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-none z-10 brutal-shadow text-black hover:-translate-y-1 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                setEnlargedImage(null);
              }}
            >
              <X className="w-6 h-6 sm:w-8 sm:h-8 stroke-[4]" />
            </button>
            <img 
              src={enlargedImage} 
              alt="Enlarged chat photo" 
              className="max-w-full max-h-[85vh] object-contain brutal-border border-4 border-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

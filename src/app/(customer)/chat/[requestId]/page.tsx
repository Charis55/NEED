"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, runTransaction, arrayUnion, increment, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { JobRequest, ArtisanProfile, Review } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";
import UserAvatar from "@/components/UserAvatar";
import { ChevronLeft, Send, Image as ImageIcon, X, Mic, AlertTriangle, Star, ShieldAlert, Check, Phone, Video } from "lucide-react";
import VoiceNotePlayer from "@/components/VoiceNotePlayer";
import { compressImage } from "@/utils/imageCompression";
import AdUnit from "@/components/AdUnit";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { pickNativePhoto, pickNativePhotos } from "@/utils/nativeCamera";

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: number;
  imageUrl?: string;
  audioUrl?: string;
  waveform?: number[];
  read?: boolean;
  deletedBy?: string[];
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
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  
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
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingFinished, setIsRecordingFinished] = useState(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedWaveform, setRecordedWaveform] = useState<number[]>([]);
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
      setIsRecordingFinished(false);
      setRecordedAudioBlob(null);
      setRecordedWaveform([]);
      setRecordingSeconds(0);
      drawWaveform();
      
      secondsIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
      
      // Auto-stop after 1 minute (60,000ms)
      maxDurationTimerRef.current = setTimeout(() => {
        finishRecording();
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
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) audioContextRef.current.close();
    
    setIsRecording(false);
    setIsRecordingFinished(false);
    setRecordedAudioBlob(null);
    setRecordedWaveform([]);
    setRecordingSeconds(0);
  };

  const finishRecording = () => {
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    if (secondsIntervalRef.current) clearInterval(secondsIntervalRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = async () => {
        setIsRecordingFinished(true);
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) await audioContextRef.current.close();
        
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 0) {
          setRecordedAudioBlob(audioBlob);
          setRecordedWaveform([...waveformRef.current]);
        } else {
          cancelRecording();
          showAlert("Voice note was empty", "error");
        }
      };
      mediaRecorderRef.current.stop();
    }
  };
  
  const stopAndSendRecording = () => {
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    if (secondsIntervalRef.current) clearInterval(secondsIntervalRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setIsRecordingFinished(false);
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
  
  const sendRecordedVoiceNote = async () => {
    if (!recordedAudioBlob) return;
    const blob = recordedAudioBlob;
    const wave = [...recordedWaveform];
    
    setIsRecording(false);
    setIsRecordingFinished(false);
    setRecordedAudioBlob(null);
    setRecordedWaveform([]);
    setRecordingSeconds(0);
    
    await sendVoiceNote(blob, wave);
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

      const partnerId = isCustomerViewing ? job?.artisanId : job?.customerId;

      await updateDoc(doc(db, "jobRequests", requestId), {
        lastMessageText: "Voice note",
        lastMessageSenderId: user.uid,
        lastMessageAt: Date.now(),
        ...(partnerId ? { [`unreadCount.${partnerId}`]: increment(1) } : {})
      });

      if (partnerId) {
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: partnerId,
            title: "New Voice Note",
            body: "Sent an audio message",
            data: { requestId, type: "chat" }
          })
        }).catch(err => console.error("Push failed:", err));
      }
    } catch (err) {
      console.error(err);
      showAlert("Failed to send voice note", "error");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    let artisanFetched = false;
    let customerFetched = false;

    const jobUnsubscribe = onSnapshot(doc(db, "jobRequests", requestId), async (jobDoc) => {
      try {
        if (jobDoc.exists()) {
          const jobData = jobDoc.data() as JobRequest;
          setJob(jobData);
          
          if (jobData.artisanId && !artisanFetched) {
            artisanFetched = true;
            getDoc(doc(db, "artisans", jobData.artisanId)).then(artDoc => {
              if (artDoc.exists()) setArtisan(artDoc.data() as ArtisanProfile);
            });
            getDoc(doc(db, "users", jobData.artisanId)).then(artUserDoc => {
              if (artUserDoc.exists()) setArtisanUser(artUserDoc.data());
            });
          }
          
          if (jobData.customerId && !customerFetched) {
            customerFetched = true;
            getDoc(doc(db, "users", jobData.customerId)).then(custDoc => {
              if (custDoc.exists()) setCustomer(custDoc.data());
            });
          }

          // Incoming call checking moved to a separate useEffect
        }
      } catch (err) {
        console.error("Error in job snapshot", err);
      }
    });
    
    return () => jobUnsubscribe();
  }, [requestId]);

  // Reset unread count when viewing chat
  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (job && currentUid && job.unreadCount?.[currentUid]) {
      if (job.unreadCount[currentUid] > 0) {
        updateDoc(doc(db, "jobRequests", requestId), {
          [`unreadCount.${currentUid}`]: 0
        }).catch(err => console.error("Failed to reset unread count", err));
      }
    }
  }, [job?.unreadCount, auth.currentUser?.uid, requestId]);


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
      
      // Mark incoming messages as read using a batch to prevent update storms
      const currentUser = auth.currentUser;
      if (currentUser) {
        const batch = writeBatch(db);
        let hasUpdates = false;

        msgs.forEach(msg => {
          if (msg.senderId !== currentUser.uid && !msg.read) {
            const msgRef = doc(db, "jobRequests", requestId, "messages", msg.id);
            batch.update(msgRef, { read: true });
            hasUpdates = true;
          }
        });

        if (hasUpdates) {
          batch.commit().catch(err => console.error("Failed to mark read:", err));
        }
      }
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
      const partnerId = isCustomerViewing ? job?.artisanId : job?.customerId;

      await updateDoc(doc(db, "jobRequests", requestId), {
        lastMessageText: newMessage,
        lastMessageSenderId: user.uid,
        lastMessageAt: Date.now(),
        ...(partnerId ? { [`unreadCount.${partnerId}`]: increment(1) } : {})
      });
      setNewMessage("");

      if (partnerId) {
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: partnerId,
            title: "New Message",
            body: newMessage || "Sent a message",
            data: { requestId, type: "chat" }
          })
        }).catch(err => console.error("Push failed:", err));
      }
    } catch (err) {
      console.error(err);
      showAlert("Failed to send message", "error");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (msg: Message, forEveryone: boolean) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      if (forEveryone) {
        if (msg.read) {
          showAlert("Message has already been read, you can only delete for yourself.", "error");
          return;
        }
        await updateDoc(doc(db, "jobRequests", requestId, "messages", msg.id), {
          deletedBy: ["everyone"]
        });
      } else {
        await updateDoc(doc(db, "jobRequests", requestId, "messages", msg.id), {
          deletedBy: arrayUnion(user.uid)
        });
      }
    } catch (err) {
      console.error(err);
      showAlert("Failed to delete message", "error");
    }
  };

  const handleDownloadReceipt = async (url: string, filename: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        showAlert("Downloading receipt...", "success");
        const res = await fetch(url);
        const blob = await res.blob();
        
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64string = base64data.split(',')[1];
          
          await Filesystem.writeFile({
            path: filename,
            data: base64string,
            directory: Directory.Documents
          });
          showAlert(`Saved to Documents/${filename}`, "success");
        };
      } catch (e) {
        console.error(e);
        showAlert("Failed to download natively.", "error");
      }
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };
  
  const handleBlockUser = async () => {
    const user = auth.currentUser;
    if (!user || !job) return;
    
    const partnerId = isCustomerViewing ? job.artisanId : job.customerId;
    const partnerName = isCustomerViewing 
      ? (artisan?.name || "this technician")
      : (customer?.displayName || "this customer");

    if (confirm(`Are you sure you want to block ${partnerName}? You will not receive any more messages from them.`)) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          blockedUsers: arrayUnion(partnerId)
        });
        showAlert("User blocked successfully.", "success");
        // Optionally navigate away
        router.push(isCustomerViewing ? "/inbox" : "/technician/inbox");
      } catch (err) {
        console.error("Failed to block user:", err);
        showAlert("Failed to block user", "error");
      }
    }
  };
  
  const processPhotos = (selectedFiles: File[]) => {
    if (photos.length + selectedFiles.length > 5) {
      showAlert("You can only upload a maximum of 5 photos.", "error");
      return;
    }
    setPhotos(prev => [...prev, ...selectedFiles]);
    const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
    setPhotoPreviews(prev => [...prev, ...newPreviews]);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processPhotos(Array.from(e.target.files));
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

  const processChatPhoto = (file: File) => {
    setPendingImage(file);
    setPendingImagePreview(URL.createObjectURL(file));
  };

  const handleChatPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processChatPhoto(file);
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
      const partnerId = isCustomerViewing ? job?.artisanId : job?.customerId;

      await updateDoc(doc(db, "jobRequests", requestId), {
        lastMessageText: newMessage || "Image attached",
        lastMessageSenderId: user.uid,
        lastMessageAt: Date.now(),
        ...(partnerId ? { [`unreadCount.${partnerId}`]: increment(1) } : {})
      });
      setNewMessage("");
      setPendingImage(null);
      setPendingImagePreview(null);

      if (partnerId) {
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: partnerId,
            title: "New Photo",
            body: "Sent an image",
            data: { requestId, type: "chat" }
          })
        }).catch(err => console.error("Push failed:", err));
      }
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
    ? (artisan?.name || artisanUser?.displayName || (artisanUser?.firstName ? `${artisanUser.firstName} ${artisanUser.lastName || ''}`.trim() : null) || artisanUser?.phone || "Unknown Technician") 
    : (customer?.displayName || (customer?.firstName ? `${customer.firstName} ${customer.lastName || ''}`.trim() : null) || customer?.phone || "Unknown Customer");

  const startCall = async (type: "audio" | "video") => {
    if (!job || !auth.currentUser) {
      showAlert("Cannot start call: Job or user missing", "error");
      return;
    }
    showAlert("Starting call...", "success");
    try {
      await updateDoc(doc(db, "jobRequests", requestId), {
        activeCall: {
          channelName: requestId,
          callerId: auth.currentUser.uid,
          type,
          status: "ringing",
          timestamp: Date.now()
        }
      });

      const partnerId = isCustomerViewing ? job?.artisanId : job?.customerId;
      if (partnerId) {
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: partnerId,
            title: `Incoming ${type} call`,
            body: `${auth.currentUser.displayName || 'Someone'} is calling you`,
            data: { requestId, type: "call" }
          })
        }).catch(err => console.error("Push failed:", err));
      }
    } catch (error) {
      console.error("Failed to start call", error);
      showAlert("Failed to start call", "error");
    }
  };

  return (
    <div 
      className="fixed inset-0 flex flex-col bg-[var(--color-brutal-bg)] selection:bg-[var(--color-brutal-pink)] selection:text-black z-[100]"
      onClick={() => setDeletingMsgId(null)}
    >
      {/* Header */}
      <div className="bg-[var(--color-brutal-blue)] border-b-4 md:border-b-8 border-black pt-[max(env(safe-area-inset-top),0.75rem)] md:pt-10 pb-3 md:pb-4 px-3 md:px-4 flex items-center shrink-0 shadow-[0_4px_0_0_#000] z-10">
        <button 
          onClick={() => {
            if (isCustomerViewing) {
              router.push("/inbox");
            } else {
              router.push("/technician/inbox");
            }
          }}
          className="w-9 h-9 md:w-12 md:h-12 bg-white border-3 md:border-4 border-black flex justify-center items-center mr-2 md:mr-4 shadow-[2px_2px_0_0_#000] md:shadow-[4px_4px_0_0_#000] hover:-translate-y-1 transition-transform shrink-0"
        >
          <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 stroke-[3]" />
        </button>
        
        <div className="w-10 h-10 md:w-14 md:h-14 rounded-full border-3 md:border-4 border-black overflow-hidden bg-[var(--color-brutal-yellow)] shrink-0 mr-2 md:mr-4">
          <UserAvatar photoURL={isCustomerViewing ? (artisan?.profilePictureUrl || artisanUser?.photoURL) : customer?.photoURL} name={chatPartnerName} className="w-full h-full text-lg md:text-2xl font-black text-black" />
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col items-start justify-center">
          <div className="flex items-center gap-1.5 md:gap-2 w-full flex-wrap">
            <h2 className="font-black text-black text-base md:text-2xl uppercase leading-tight truncate max-w-[45vw] md:max-w-none">{chatPartnerName}</h2>
            {job?.status === "completed" && (
              <span className="bg-[var(--color-brutal-green)] text-black border-2 border-black text-[10px] md:text-xs px-2 md:px-3 py-0.5 md:py-1 uppercase font-black shrink-0 shadow-[1px_1px_0_0_#000] md:shadow-[2px_2px_0_0_#000]">Done</span>
            )}
          </div>
          <p className="text-black font-bold text-[10px] md:text-sm bg-white border-2 border-black px-1 md:px-1.5 py-0.5 inline-block shadow-[1px_1px_0_0_#000] md:shadow-[2px_2px_0_0_#000] truncate max-w-full leading-tight mt-0.5 md:mt-1">
            {job?.subcategory}
          </p>
        </div>

        <div className="flex items-center gap-1 md:gap-2 ml-1 md:ml-2 shrink-0">
          {job?.status === "completed" && isCustomerViewing && !job.reviewed && (
            <button 
              onClick={() => setShowReviewModal(true)}
              className="bg-[var(--color-brutal-yellow)] border-2 border-black px-2 md:px-3 py-1 md:py-1.5 font-black uppercase text-black text-[10px] md:text-sm shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 transition-transform"
            >
              <Star className="w-4 h-4 md:hidden" />
              <span className="hidden md:inline">REVIEW</span>
            </button>
          )}
          {job?.status === "completed" && (
            <button 
              onClick={() => setShowReceiptModal(true)}
              className={`border-2 border-black px-2 md:px-3 py-1 md:py-1.5 font-black uppercase text-[10px] md:text-sm shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 transition-transform flex items-center gap-1 ${job.proofOfPaymentUrl ? 'bg-[var(--color-brutal-green)] text-black' : 'bg-[var(--color-brutal-pink)] text-black'}`}
            >
              <span className="hidden md:inline">RECEIPT</span>
              <span className="md:hidden">RECEIPT</span>
              {job.proofOfPaymentUrl && <div className="w-4 h-4 bg-white border-2 border-black rounded-full flex items-center justify-center"><Check className="w-3 h-3 stroke-[4]" /></div>}
            </button>
          )}
          {job?.status !== "completed" && job?.status !== "cancelled" && job?.status !== "declined" && (
            <>
              <button 
                onClick={() => startCall("audio")}
                className="w-8 h-8 md:w-10 md:h-10 bg-white border-2 md:border-3 border-black flex justify-center items-center shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 transition-transform shrink-0"
              >
                <Phone className="w-4 h-4 md:w-5 md:h-5 stroke-[3]" />
              </button>
              <button 
                onClick={() => startCall("video")}
                className="w-8 h-8 md:w-10 md:h-10 bg-[var(--color-brutal-yellow)] border-2 md:border-3 border-black flex justify-center items-center shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 transition-transform shrink-0"
              >
                <Video className="w-4 h-4 md:w-5 md:h-5 stroke-[3]" />
              </button>
            </>
          )}
          <button 
            onClick={handleBlockUser}
            className="bg-black text-white border-2 border-white p-1.5 md:px-2 md:py-1.5 font-black uppercase text-xs hover:scale-105 transition-transform flex items-center justify-center"
            title="Block User"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        </div>
      </div>


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
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 relative z-0 pb-6">
        {job?.proofOfPaymentUrl && (
          <div className="absolute inset-x-0 bottom-4 pointer-events-none flex justify-center z-[0] opacity-20 mix-blend-multiply px-4 md:px-8">
            <img 
              src={job.proofOfPaymentUrl} 
              alt="Receipt Watermark" 
              className="max-w-full max-h-[50vh] object-contain grayscale"
            />
          </div>
        )}
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
            
            if (msg.deletedBy?.includes(auth.currentUser?.uid || "")) return null;
            if (msg.deletedBy?.includes("everyone")) {
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className="p-2 border-2 border-black border-dashed bg-gray-100 italic text-xs font-bold text-gray-500 rounded-xl">
                    This message was deleted
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} relative`}>
                <div 
                  className={`max-w-[85%] md:max-w-[80%] p-2.5 md:p-3 border-3 md:border-4 border-black shadow-[2px_2px_0_0_#000] md:shadow-[4px_4px_0_0_#000] flex flex-col cursor-pointer ${
                    isMe 
                      ? "bg-[var(--color-brutal-yellow)] rounded-l-xl rounded-tr-xl" 
                      : "bg-white rounded-r-xl rounded-tl-xl"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isMe) setDeletingMsgId(deletingMsgId === msg.id ? null : msg.id);
                  }}
                >
                  {msg.imageUrl && (
                    <img 
                      src={msg.imageUrl} 
                      alt="Chat photo" 
                      onClick={(e) => { e.stopPropagation(); setEnlargedImage(msg.imageUrl!); }}
                      className="w-full max-w-[250px] object-cover brutal-border mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  )}
                  {msg.audioUrl && (
                    <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                      <VoiceNotePlayer audioUrl={msg.audioUrl} waveform={msg.waveform} />
                    </div>
                  )}
                  {msg.text && (
                    (msg.text.startsWith("[CALL_LOG]:") || msg.text.includes("📞")) ? (() => {
                      let isVideo = false;
                      let duration = "";
                      
                      if (msg.text.startsWith("[CALL_LOG]:")) {
                        const parts = msg.text.split(":");
                        isVideo = parts[1]?.toLowerCase() === "video";
                        duration = parts.slice(2).join(":");
                      } else {
                        // Legacy support for "📞 Video Call • Missed Call"
                        isVideo = msg.text.includes("Video");
                        const parts = msg.text.split("•");
                        duration = parts.length > 1 ? parts[1].trim() : "Ended";
                      }
                      
                      return (
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`p-1.5 border-2 border-black ${isMe ? 'bg-white' : 'bg-[var(--color-brutal-yellow)]'} shadow-[2px_2px_0_0_#000]`}>
                            {isVideo ? (
                              <Video className="w-4 h-4 stroke-[3] text-black" />
                            ) : (
                              <Phone className="w-4 h-4 stroke-[3] text-black" />
                            )}
                          </div>
                          <span className="font-black text-black text-sm uppercase">
                            {isVideo ? 'Video' : 'Voice'} Call • {duration}
                          </span>
                        </div>
                      );
                    })() : (
                      <p className="font-bold text-black break-words text-sm md:text-base">{msg.text}</p>
                    )
                  )}
                  <div className="flex justify-end items-center gap-1 mt-1">
                    <p className="text-[10px] font-black text-black/50 text-right">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isMe && (
                      <span className={`text-[10px] font-black ${msg.read ? "text-[var(--color-brutal-teal)]" : "text-black/50"}`}>
                        {msg.read ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                  
                  {deletingMsgId === msg.id && isMe && (
                    <div className="absolute top-full right-0 mt-2 bg-white border-4 border-black p-2 flex flex-col gap-2 shadow-[4px_4px_0_0_#000] z-20 min-w-[150px]" onClick={e => e.stopPropagation()}>
                       <button onClick={() => { handleDeleteMessage(msg, false); setDeletingMsgId(null); }} className="text-xs font-black uppercase text-left bg-gray-100 hover:bg-gray-200 p-2 border-2 border-black transition-colors">Delete for me</button>
                       {!msg.read && (
                         <button onClick={() => { handleDeleteMessage(msg, true); setDeletingMsgId(null); }} className="text-xs font-black uppercase text-left bg-[var(--color-brutal-red)] text-white hover:bg-red-600 p-2 border-2 border-black transition-colors">Delete for everyone</button>
                       )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t-4 md:border-t-8 border-black p-2.5 md:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-[calc(1rem+env(safe-area-inset-bottom))] shrink-0 shadow-[0_-4px_0_0_#000] z-10 relative">
        {isRecording || isRecordingFinished ? (
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={cancelRecording}
              className="border-4 border-black p-3 flex items-center justify-center transition-all bg-[var(--color-brutal-red)] text-white brutal-shadow hover:-translate-y-1"
            >
              <X className="w-6 h-6 stroke-[3]" />
            </button>
            
            <div className={`flex-1 bg-[var(--color-brutal-yellow)] border-4 border-black p-3 flex items-center justify-center gap-4 brutal-shadow ${isRecordingFinished ? 'bg-[var(--color-brutal-yellow)]' : 'animate-pulse'}`}>
              <Mic className="w-6 h-6 stroke-[3] text-black" />
              <span className="font-black text-black">
                {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>
            
            <button
              type="button"
              onClick={isRecordingFinished ? sendRecordedVoiceNote : stopAndSendRecording}
              disabled={sending}
              className="bg-[var(--color-brutal-pink)] border-4 border-black p-3 flex items-center justify-center hover:-translate-y-1 brutal-shadow disabled:opacity-50 transition-all"
            >
              <Send className="w-6 h-6 stroke-[3] text-black" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex gap-2 items-center min-w-0 w-full">
            <label 
              className={`cursor-pointer border-3 md:border-4 border-black p-2.5 md:p-3 flex items-center justify-center transition-all bg-[var(--color-brutal-teal)] text-black shadow-[2px_2px_0_0_#000] md:shadow-[4px_4px_0_0_#000] shrink-0 hover:-translate-y-1 ${sending ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={async (e) => {
                if (Capacitor.isNativePlatform()) {
                  e.preventDefault();
                  const file = await pickNativePhoto();
                  if (file) processChatPhoto(file);
                }
              }}
            >
              <ImageIcon className="w-5 h-5 md:w-6 md:h-6 stroke-[3]" />
              <input type="file" accept="image/*" onChange={handleChatPhotoSelect} className="hidden" disabled={sending} />
            </label>
            
            <button
              type="button"
              onClick={startRecording}
              className={`border-3 md:border-4 border-black p-2.5 md:p-3 flex items-center justify-center transition-all text-black shadow-[2px_2px_0_0_#000] md:shadow-[4px_4px_0_0_#000] shrink-0 bg-[var(--color-brutal-yellow)] hover:-translate-y-1 ${sending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Mic className="w-5 h-5 md:w-6 md:h-6 stroke-[3]" />
            </button>
            
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message."
              className="flex-1 min-w-0 bg-gray-50 border-3 md:border-4 border-black p-2.5 md:p-3 font-bold text-sm md:text-base text-black focus:outline-none focus:bg-[var(--color-brutal-yellow)] transition-colors placeholder:text-gray-500 rounded-none w-full"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="bg-[var(--color-brutal-pink)] border-3 md:border-4 border-black p-2.5 md:p-3 flex items-center justify-center shrink-0 hover:-translate-y-1 shadow-[2px_2px_0_0_#000] md:shadow-[4px_4px_0_0_#000] disabled:opacity-50 disabled:hover:translate-y-0 transition-all"
            >
              <Send className="w-5 h-5 md:w-6 md:h-6 stroke-[3] text-black" />
            </button>
          </form>
        )}
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
                      className={`w-12 h-12 border-4 border-black text-2xl brutal-shadow hover:-translate-y-1 transition-transform flex justify-center items-center ${
                        rating >= star ? 'bg-[var(--color-brutal-yellow)]' : 'bg-gray-100 grayscale'
                      }`}
                    >
                      <Star className={`w-6 h-6 stroke-[3] ${rating >= star ? 'fill-black' : ''}`} />
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
                    <label 
                      className="w-24 h-24 border-4 border-black border-dashed flex flex-col justify-center items-center bg-gray-50 cursor-pointer hover:bg-[var(--color-brutal-teal)] transition-colors"
                      onClick={async (e) => {
                        if (Capacitor.isNativePlatform()) {
                          e.preventDefault();
                          const files = await pickNativePhotos(5 - photos.length);
                          if (files && files.length > 0) processPhotos(files);
                        }
                      }}
                    >
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
      {/* Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white border-8 border-black max-w-lg w-full brutal-shadow p-6 relative">
            <button 
              onClick={() => setShowReceiptModal(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-[var(--color-brutal-red)] border-4 border-black flex justify-center items-center text-black brutal-shadow hover:-translate-y-1 transition-transform"
            >
              <X className="w-6 h-6 stroke-[3]" />
            </button>
            
            <h2 className="text-3xl font-black text-black uppercase mb-6 tracking-tighter">Proof of Payment</h2>
            
            <div className="bg-[var(--color-brutal-yellow)] border-4 border-black p-4 mb-6 brutal-shadow-sm">
              <p className="font-bold text-black text-sm uppercase leading-tight">
                To protect both parties and avoid liability, please upload your proof of payment. This ensures the technician is properly credited and your payment is securely documented in our records.
              </p>
            </div>
            
            {job?.proofOfPaymentUrl ? (
              <div className="space-y-4">
                <div className="bg-gray-100 border-4 border-black p-2 brutal-shadow-sm">
                  <img src={job.proofOfPaymentUrl} alt="Uploaded Receipt" className="w-full h-48 object-contain" />
                </div>
                <button 
                  onClick={() => handleDownloadReceipt(job.proofOfPaymentUrl!, `Receipt_${job.requestId}.jpg`)}
                  className="block w-full py-4 text-center bg-[var(--color-brutal-green)] border-4 border-black font-black uppercase text-black text-xl hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  DOWNLOAD RECEIPT
                </button>
              </div>
            ) : (
              <div>
                <input 
                  type="file" 
                  accept="image/*" 
                  id="modal-pop-upload" 
                  className="hidden" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    try {
                      setSending(true);
                      showAlert("Uploading Proof of Payment...", "success");
                      const compressed = await compressImage(file, 2);
                      const url = await uploadFileToR2(compressed, file.name);
                      
                      await updateDoc(doc(db, "jobRequests", requestId), {
                        proofOfPaymentUrl: url,
                        proofOfPaymentAt: Date.now()
                      });
                      
                      setJob(prev => prev ? { ...prev, proofOfPaymentUrl: url, proofOfPaymentAt: Date.now() } : prev);
                      showAlert("Proof of Payment uploaded successfully!", "success");
                    } catch (err) {
                      console.error("Proof of payment upload failed:", err);
                      showAlert("Failed to upload proof of payment", "error");
                    } finally {
                      setSending(false);
                    }
                  }}
                  disabled={sending}
                />
                <label 
                  htmlFor="modal-pop-upload"
                  className={`block w-full text-center py-4 bg-[var(--color-brutal-teal)] border-4 border-black font-black uppercase text-black text-xl hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer ${sending ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {sending ? "UPLOADING..." : "UPLOAD RECEIPT"}
                </label>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

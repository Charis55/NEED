"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, orderBy, onSnapshot } from "firebase/firestore";
import { JobRequest, ArtisanProfile } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { MessageCircle } from "lucide-react";

interface ChatListItem {
  job: JobRequest;
  artisan: ArtisanProfile | null;
  artisanUser: any | null;
  unreadCount: number;
}

export default function InboxPage() {
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { showAlert } = useAlert();

  useEffect(() => {
    const fetchChats = async () => {
      const user = auth.currentUser;
      if (!user) return; 

      try {
        // We only want accepted or completed jobs for the chat list
        const q = query(
          collection(db, "jobRequests"), 
          where("customerId", "==", user.uid)
        );
        const snapshot = await getDocs(q);
        const allJobs = snapshot.docs.map(doc => doc.data() as JobRequest);
        
        // Filter locally because Firestore OR queries are complex
        const activeJobs = allJobs.filter(j => j.status === "accepted" || j.status === "completed" || j.status === "payment_pending");
        
        // Sort by newest first
        activeJobs.sort((a, b) => b.createdAt - a.createdAt);

        // Fetch artisan info for each job
        const listItems: ChatListItem[] = [];
        
        for (const job of activeJobs) {
          let artisan: ArtisanProfile | null = null;
          let artisanUser: any = null;
          
          if (job.artisanId) {
            const artDoc = await getDoc(doc(db, "artisans", job.artisanId));
            if (artDoc.exists()) {
              artisan = artDoc.data() as ArtisanProfile;
            }
            const userDoc = await getDoc(doc(db, "users", job.artisanId));
            if (userDoc.exists()) {
              artisanUser = userDoc.data();
            }
          }
          
          listItems.push({
            job,
            artisan,
            artisanUser,
            unreadCount: 0 // We will implement real unread counts later in the chat logic
          });
        }

        setChatList(listItems);
      } catch (error) {
        console.error("Error fetching chats:", error);
        showAlert("Failed to load your inbox", "error");
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => fetchChats(), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="max-w-2xl mx-auto pt-12 px-4 pb-20 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <h1 className="text-[3rem] font-black text-black tracking-tighter uppercase leading-none mb-8 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
        MESSAGES
      </h1>
      
      {loading ? (
        <GlobalSpinner text="LOADING CHATS" color="bg-[var(--color-brutal-pink)]" />
      ) : chatList.length === 0 ? (
        <div className="bg-white border-4 border-black p-8 brutal-shadow text-center">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 stroke-[3] text-black" />
          <p className="text-black font-black uppercase text-xl">No Active Chats</p>
          <p className="text-gray-600 font-bold mt-2">When a technician accepts your job, you can chat with them here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {chatList.map((item) => (
            <Link key={item.job.requestId} href={`/chat/${item.job.requestId}`}>
              <div className="bg-white border-4 border-black p-4 brutal-shadow flex items-center hover:-translate-y-1 transition-transform group cursor-pointer">
                
                {/* Artisan Avatar */}
                <div className="relative mr-4 shrink-0">
                  <div className="w-16 h-16 rounded-full border-4 border-black overflow-hidden bg-[var(--color-brutal-yellow)] group-hover:bg-[var(--color-brutal-pink)] transition-colors">
                    <div className="w-14 h-14 rounded-full border-4 border-black overflow-hidden bg-[var(--color-brutal-yellow)] shrink-0 flex items-center justify-center">
                      <UserAvatar photoURL={item.artisanUser?.photoURL || item.artisan?.portfolioPhotoUrls?.[0]} name={item.artisan?.name || item.artisanUser?.displayName || (item.artisanUser?.firstName ? `${item.artisanUser.firstName} ${item.artisanUser.lastName}` : "Artisan")} className="w-full h-full text-2xl text-black font-black" />
                    </div>
                  </div>
                  {/* Unread Badge */}
                  {item.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-[var(--color-brutal-red)] border-2 border-black w-6 h-6 rounded-full flex items-center justify-center">
                      <span className="text-white font-black text-xs">{item.unreadCount}</span>
                    </div>
                  )}
                </div>

                {/* Chat Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-black text-black text-lg truncate uppercase">
                      {item.artisan?.name || item.artisanUser?.displayName || (item.artisanUser?.firstName ? `${item.artisanUser.firstName} ${item.artisanUser.lastName}` : "Unknown Technician")}
                    </h3>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 border-2 border-black px-2 py-0.5 shrink-0 ml-2">
                      {new Date(item.job.createdAt).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-gray-600 truncate mr-2">
                      {item.job.subcategory}
                    </p>
                    
                    {item.job.status === "completed" && (
                      <span className="text-[10px] font-black text-white bg-[var(--color-brutal-blue)] border-2 border-black px-2 py-0.5 uppercase tracking-wider shrink-0">
                        COMPLETED
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

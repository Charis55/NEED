"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, orderBy, onSnapshot } from "firebase/firestore";
import { JobRequest, ArtisanProfile, UserAccount } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { MessageCircle } from "lucide-react";
import AuthGate from "@/components/AuthGate";

interface ChatListItem {
  job: JobRequest;
  artisan: ArtisanProfile | null;
  artisanUser: UserAccount | null;
  unreadCount: number;
}

export default function InboxPage() {
  return (
    <AuthGate title="Sign in to view messages" description="Create a free account to chat with technicians.">
      <InboxContent />
    </AuthGate>
  );
}

function InboxContent() {
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { showAlert } = useAlert();

  useEffect(() => {
    let unsubscribe = () => {};
    const setupListener = () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      
      const q = query(
        collection(db, "jobRequests"), 
        where("customerId", "==", user.uid)
      );
      
      unsubscribe = onSnapshot(q, async (snapshot) => {
        try {
          const allJobs = snapshot.docs.map(doc => doc.data() as JobRequest);
          const activeJobs = allJobs.filter(j => ["accepted", "en_route", "in_progress", "payment_pending", "completed"].includes(j.status));
          activeJobs.sort((a, b) => b.createdAt - a.createdAt);

          const listItems: ChatListItem[] = [];
          
          for (const job of activeJobs) {
            let artisan: ArtisanProfile | null = null;
            let artisanUser: UserAccount | null = null;
            
            if (job.artisanId) {
              const artDoc = await getDoc(doc(db, "artisans", job.artisanId));
              if (artDoc.exists()) {
                artisan = artDoc.data() as ArtisanProfile;
              }
              const userDoc = await getDoc(doc(db, "users", job.artisanId));
              if (userDoc.exists()) {
                artisanUser = userDoc.data() as UserAccount;
              }
            }
            
            listItems.push({
              job,
              artisan,
              artisanUser,
              unreadCount: job.unreadCount?.[user.uid] || 0
            });
          }

          setChatList(listItems);
        } catch (error) {
          console.error("Error processing chats:", error);
          showAlert("Failed to load your inbox", "error");
        } finally {
          setLoading(false);
        }
      });
    };

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setupListener();
      } else {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribe();
    };
  }, [showAlert]);

  return (
    <div className="w-full pt-12 px-6 md:px-12 pb-20 selection:bg-[var(--color-brutal-pink)] selection:text-black">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {chatList.map((item) => (
            <Link key={item.job.requestId} href={`/chat/${item.job.requestId}`}>
              <div className="bg-white border-4 border-black p-4 brutal-shadow flex items-center hover:-translate-y-1 transition-transform group cursor-pointer">
                
                {/* Artisan Avatar */}
                <div className="relative mr-4 shrink-0">
                  <div className="w-16 h-16 rounded-full border-4 border-black overflow-hidden bg-[var(--color-brutal-yellow)] group-hover:bg-[var(--color-brutal-pink)] transition-colors">
                    <div className="w-14 h-14 rounded-full border-4 border-black overflow-hidden bg-[var(--color-brutal-yellow)] shrink-0 flex items-center justify-center">
                      <UserAvatar photoURL={item.artisanUser?.photoURL || item.artisan?.profilePictureUrl} name={item.artisan?.name || item.artisanUser?.displayName || (item.artisanUser?.firstName ? `${item.artisanUser.firstName} ${item.artisanUser.lastName || ''}`.trim() : null) || item.artisanUser?.phone || "Unknown Technician"} className="w-full h-full text-2xl text-black font-black" />
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
                      {item.artisan?.name || item.artisanUser?.displayName || (item.artisanUser?.firstName ? `${item.artisanUser.firstName} ${item.artisanUser.lastName || ''}`.trim() : null) || item.artisanUser?.phone || "Unknown Technician"}
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

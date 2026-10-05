"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, orderBy, onSnapshot } from "firebase/firestore";
import { JobRequest, ArtisanProfile, UserAccount } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { MessageCircle, Search, Filter, SlidersHorizontal } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"ongoing" | "completed" | "az" | "za">("ongoing");
  const [isSortOpen, setIsSortOpen] = useState(false);
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

          const listItems: ChatListItem[] = await Promise.all(activeJobs.map(async (job) => {
            let artisan: ArtisanProfile | null = null;
            let artisanUser: UserAccount | null = null;
            
            if (job.artisanId) {
              const [artDoc, userDoc] = await Promise.all([
                getDoc(doc(db, "artisans", job.artisanId)),
                getDoc(doc(db, "users", job.artisanId))
              ]);
              if (artDoc.exists()) artisan = artDoc.data() as ArtisanProfile;
              if (userDoc.exists()) artisanUser = userDoc.data() as UserAccount;
            }
            
            return {
              job,
              artisan,
              artisanUser,
              unreadCount: job.unreadCount?.[user.uid] || 0
            };
          }));

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

  const filteredList = chatList.filter(({ job, artisan, artisanUser }) => {
    const name = (artisan?.name || artisanUser?.displayName || artisanUser?.firstName || "Technician").toLowerCase();
    const trade = (job.services ? job.services.map(s => `${s.trade} ${s.subcategory}`).join(" ") : (job.subcategory || job.trade || "")).toLowerCase();
    const dateStr = new Date(job.createdAt).toLocaleDateString('en-GB').toLowerCase();
    const q = searchQuery.toLowerCase();
    if (q && !name.includes(q) && !trade.includes(q) && !dateStr.includes(q)) return false;
    return true;
  });

  const sortedList = [...filteredList].sort((a, b) => {
    const nameA = (a.artisan?.name || a.artisanUser?.displayName || a.artisanUser?.firstName || "").toLowerCase();
    const nameB = (b.artisan?.name || b.artisanUser?.displayName || b.artisanUser?.firstName || "").toLowerCase();
    
    if (sortOption === "az") return nameA.localeCompare(nameB);
    if (sortOption === "za") return nameB.localeCompare(nameA);
    if (sortOption === "ongoing") {
      const aIsOngoing = a.job.status !== "completed" ? 1 : 0;
      const bIsOngoing = b.job.status !== "completed" ? 1 : 0;
      return bIsOngoing - aIsOngoing || b.job.createdAt - a.job.createdAt;
    }
    if (sortOption === "completed") {
      const aIsCompleted = a.job.status === "completed" ? 1 : 0;
      const bIsCompleted = b.job.status === "completed" ? 1 : 0;
      return bIsCompleted - aIsCompleted || b.job.createdAt - a.job.createdAt;
    }
    return 0;
  });

  return (
    <div className="w-full pt-12 px-6 md:px-12 pb-20 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <h1 className="text-[3rem] font-black text-black tracking-tighter uppercase leading-none mb-8 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
        MESSAGES
      </h1>

      <div className="mb-8 flex flex-col gap-4">
        <div className="flex justify-end w-full relative z-[60]">
          <div className="relative">
            <button 
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center justify-center w-12 h-12 md:w-auto md:px-4 md:py-3 border-4 border-black bg-[var(--color-brutal-pink)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-6 h-6 stroke-[3]" />
            </button>

            {isSortOpen && (
              <div className="absolute top-14 md:top-16 right-0 z-50 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-48 flex flex-col p-2 animate-in fade-in slide-in-from-top-2">
                <p className="text-xs font-black uppercase text-gray-500 mb-2 px-2 border-b-2 border-gray-200 pb-1">Sort By</p>
                {[
                  { label: "Ongoing", value: "ongoing" },
                  { label: "Completed", value: "completed" },
                  { label: "A to Z", value: "az" },
                  { label: "Z to A", value: "za" },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortOption(option.value as any);
                      setIsSortOpen(false);
                    }}
                    className={`text-left px-2 py-2 font-black uppercase text-xs sm:text-sm border-2 transition-all ${sortOption === option.value ? "bg-[var(--color-brutal-yellow)] border-black" : "border-transparent hover:border-black hover:bg-gray-100"} break-words`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <Search className="w-6 h-6 text-black stroke-[3]" />
          </div>
          <input
            type="text"
            placeholder="Search by Name, Job or Date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border-4 border-black font-bold text-black focus:outline-none focus:ring-4 focus:ring-[var(--color-brutal-pink)] brutal-shadow transition-all"
          />
        </div>
      </div>
      
      {loading ? (
        <GlobalSpinner text="LOADING CHATS" color="bg-[var(--color-brutal-pink)]" />
      ) : sortedList.length === 0 ? (
        <div className="bg-white border-4 border-black p-8 brutal-shadow text-center">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 stroke-[3] text-black" />
          <p className="text-black font-black uppercase text-xl">No Results</p>
          <p className="text-gray-600 font-bold mt-2">Try adjusting your search or sort filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedList.map((item) => (
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
                      {item.job.services && item.job.services.length > 1 ? `${item.job.services.length} Services` : item.job.subcategory}
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

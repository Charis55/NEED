"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { JobRequest, UserAccount } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { MessageCircle, Search, Filter, SlidersHorizontal, Trash2 } from "lucide-react";

interface ChatListItem {
  job: JobRequest;
  customer: UserAccount | null;
  unreadCount: number;
}

const customerCache = new Map<string, UserAccount>();

export default function InboxPage() {
  const router = useRouter();
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"recent" | "oldest" | "ongoing" | "completed" | "az" | "za">("recent");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<ChatListItem | null>(null);
  const [hiddenChatIds, setHiddenChatIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const { showAlert } = useAlert();

  useEffect(() => {
    let unsubscribe = () => {};
    // Safety timeout: never let inbox spinner block for > 2.5s
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const setupListener = () => {
      const user = auth.currentUser;
      if (!user) {
        clearTimeout(safetyTimer);
        setLoading(false);
        return;
      }
      
      const q = query(
        collection(db, "jobRequests"), 
        where("artisanId", "==", user.uid)
      );
      
      unsubscribe = onSnapshot(q, async (snapshot) => {
        clearTimeout(safetyTimer);
        try {
          const allJobs = snapshot.docs.map(doc => doc.data() as JobRequest);
          const activeJobs = allJobs.filter(j => ["accepted", "en_route", "in_progress", "payment_pending", "completed"].includes(j.status));
          activeJobs.sort((a, b) => {
            const timeA = a.lastMessageAt || a.updatedAt || a.createdAt || 0;
            const timeB = b.lastMessageAt || b.updatedAt || b.createdAt || 0;
            return timeB - timeA;
          });

          const listItems: ChatListItem[] = await Promise.all(activeJobs.map(async (job) => {
            let customer: UserAccount | null = job.customerId ? customerCache.get(job.customerId) || null : null;
            if (job.customerId && !customer) {
              try {
                const timeoutP = new Promise<null>((res) => setTimeout(() => res(null), 1500));
                const fetchP = getDoc(doc(db, "users", job.customerId));
                const cusDoc = await Promise.race([fetchP, timeoutP]);
                if (cusDoc && cusDoc.exists()) {
                  customer = cusDoc.data() as UserAccount;
                  customerCache.set(job.customerId, customer);
                }
              } catch (e) {
                // progressive fallback
              }
            }
            return {
              job,
              customer,
              unreadCount: job.unreadCount?.[user.uid] || 0 
            };
          }));
          setChatList(listItems);
        } catch (error) {
          console.error("Error processing chats:", error);
          showAlert("Failed to load inbox", "error");
        } finally {
          setLoading(false);
        }
      }, (err) => {
        console.warn("Technician inbox listener error:", err);
        clearTimeout(safetyTimer);
        setLoading(false);
      });
    };

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        try {
          const raw = localStorage.getItem("need_hidden_chats_" + user.uid);
          if (raw) setHiddenChatIds(JSON.parse(raw));
        } catch (e) {}
        setupListener();
      } else {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeAuth();
      unsubscribe();
    };
  }, [showAlert]);

  const startLongPress = (item: ChatListItem) => {
    isLongPressRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof window !== "undefined" && window.navigator?.vibrate) {
        try { window.navigator.vibrate(60); } catch (e) {}
      }
      setChatToDelete(item);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleClickItem = (requestId: string) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    router.push(`/chat/${requestId}`);
  };

  const handleDeleteChat = async () => {
    if (!chatToDelete || !auth.currentUser) return;
    setDeleting(true);
    const targetId = chatToDelete.job.requestId;
    const uid = auth.currentUser.uid;
    const updated = [...hiddenChatIds, targetId];
    setHiddenChatIds(updated);
    try {
      localStorage.setItem("need_hidden_chats_" + uid, JSON.stringify(updated));
    } catch (e) {}

    try {
      await updateDoc(doc(db, "jobRequests", targetId), {
        [`hiddenFor.${uid}`]: true
      });
    } catch (err) {
      console.warn("Could not sync hiddenFor to Firestore:", err);
    }
    setDeleting(false);
    setChatToDelete(null);
    showAlert("Chat deleted from your inbox", "success");
  };

  if (loading) return <GlobalSpinner />;

  const user = auth.currentUser;
  const filteredList = chatList.filter(({ job, customer }) => {
    if (user && job.hiddenFor?.[user.uid]) return false;
    if (hiddenChatIds.includes(job.requestId)) return false;
    const name = (customer?.displayName || customer?.firstName || "Customer").toLowerCase();
    const trade = (job.services ? job.services.map(s => `${s.trade} ${s.subcategory}`).join(" ") : (job.subcategory || job.trade || "")).toLowerCase();
    const dateStr = new Date(job.createdAt).toLocaleDateString('en-GB').toLowerCase();
    const q = searchQuery.toLowerCase();
    if (q && !name.includes(q) && !trade.includes(q) && !dateStr.includes(q)) return false;
    return true;
  });

  const sortedList = [...filteredList].sort((a, b) => {
    const nameA = (a.customer?.displayName || a.customer?.firstName || "").toLowerCase();
    const nameB = (b.customer?.displayName || b.customer?.firstName || "").toLowerCase();
    
    const timeA = a.job.lastMessageAt || a.job.updatedAt || a.job.createdAt || 0;
    const timeB = b.job.lastMessageAt || b.job.updatedAt || b.job.createdAt || 0;

    if (sortOption === "recent") {
      return timeB - timeA;
    }
    if (sortOption === "oldest") {
      return timeA - timeB;
    }
    if (sortOption === "az") return nameA.localeCompare(nameB);
    if (sortOption === "za") return nameB.localeCompare(nameA);
    if (sortOption === "ongoing") {
      const aIsOngoing = a.job.status !== "completed" ? 1 : 0;
      const bIsOngoing = b.job.status !== "completed" ? 1 : 0;
      return bIsOngoing - aIsOngoing || timeB - timeA;
    }
    if (sortOption === "completed") {
      const aIsCompleted = a.job.status === "completed" ? 1 : 0;
      const bIsCompleted = b.job.status === "completed" ? 1 : 0;
      return bIsCompleted - aIsCompleted || timeB - timeA;
    }
    return timeB - timeA;
  });

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pt-[calc(env(safe-area-inset-top,0px)+4.5rem)] px-4 md:px-12 pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-black text-black mb-3 tracking-tighter uppercase">Inbox</h1>
        
        {/* Subtitle & Sorter Row */}
        <div className="flex items-center justify-between gap-3 mb-3 relative z-[60]">
          <p className="text-black font-bold text-sm sm:text-base md:text-lg border-l-4 border-black pl-3 bg-[var(--color-brutal-teal)] inline-block pr-3 -rotate-1 shadow-[2px_2px_0_0_#000]">
            Chat with your customers.
          </p>

          <div className="relative shrink-0">
            <button 
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center justify-center w-11 h-11 md:w-auto md:px-4 md:py-2.5 border-4 border-black bg-[var(--color-brutal-pink)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
              aria-label="Sort options"
            >
              <SlidersHorizontal className="w-5 h-5 stroke-[3] md:mr-2" />
              <span className="hidden md:inline font-black uppercase text-black text-sm">Sort</span>
            </button>

            {isSortOpen && (
              <div className="absolute top-13 md:top-14 right-0 z-50 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-48 flex flex-col p-2 animate-in fade-in slide-in-from-top-2">
                <p className="text-xs font-black uppercase text-gray-500 mb-2 px-2 border-b-2 border-gray-200 pb-1">Sort By</p>
                {[
                  { label: "Most Recent", value: "recent" },
                  { label: "Oldest", value: "oldest" },
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

        {/* Search Bar - directly under the subtitle & sorter row */}
        <div className="relative w-full mb-6">
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

        {loading ? (
          <GlobalSpinner text="LOADING CHATS" color="bg-[var(--color-brutal-pink)]" />
        ) : sortedList.length === 0 ? (
          <div className="bg-white p-12 text-center border-4 border-black shadow-[4px_4px_0_0_#000]">
            <div className="w-20 h-20 bg-[var(--color-brutal-yellow)] border-4 border-black flex items-center justify-center mx-auto mb-4 rotate-3">
              <MessageCircle className="w-10 h-10 stroke-[3]" />
            </div>
            <h3 className="text-2xl font-black text-black mb-2 uppercase">No Results</h3>
            <p className="text-black font-bold">Try adjusting your search or sort filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedList.map((item) => {
              const { job, customer, unreadCount } = item;
              return (
                <div 
                  key={job.requestId} 
                  onClick={() => handleClickItem(job.requestId)}
                  onMouseDown={() => startLongPress(item)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={() => startLongPress(item)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setChatToDelete(item);
                  }}
                  className="block bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0_0_#000] active:scale-[0.99] transition-all group cursor-pointer select-none relative"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0 pointer-events-none">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-black bg-[var(--color-brutal-yellow)]">
                        <UserAvatar 
                          photoURL={customer?.photoURL} 
                          name={customer?.displayName || (customer?.firstName ? `${customer.firstName} ${customer.lastName || ''}`.trim() : null) || "Customer"} 
                          className="w-full h-full text-xl text-black font-black" 
                        />
                      </div>
                      {unreadCount > 0 && (
                        <div className="absolute -top-2 -right-2 bg-[var(--color-brutal-red)] text-white w-6 h-6 flex items-center justify-center border-2 border-black rounded-full font-black text-xs z-10 shadow-[2px_2px_0_0_#000]">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 pointer-events-none">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="text-xl font-black text-black truncate uppercase tracking-tighter">
                          {customer?.displayName || (customer?.firstName ? `${customer.firstName} ${customer.lastName || ''}`.trim() : null) || "Customer"}
                        </h3>
                        <span className="text-xs font-black px-2 py-0.5 bg-[var(--color-brutal-bg)] border-2 border-black -rotate-2 whitespace-nowrap ml-2">
                          {new Date(job.createdAt).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                      
                      <p className="text-sm font-bold text-gray-700 truncate">
                        {job.services && job.services.length > 1 ? `${job.services.length} Services` : job.trade} • {job.neighborhood}
                      </p>
                      
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-xs font-black uppercase px-2 py-0.5 border-2 border-black
                          ${job.status === 'completed' ? 'bg-[var(--color-brutal-teal)] text-black' : 'bg-[var(--color-brutal-yellow)] text-black'}
                        `}>
                          {job.status}
                        </span>
                      </div>
                    </div>

                    {/* Delete button (shortcut for desktop mouse or tap) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatToDelete(item);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-2 right-2 p-1.5 bg-white border-2 border-black shadow-[2px_2px_0_0_#000] hover:bg-[var(--color-brutal-red)] hover:text-white transition-all cursor-pointer z-10"
                      title="Delete chat from inbox"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Chat Confirmation Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white border-4 border-black p-6 sm:p-8 max-w-md w-full shadow-[8px_8px_0_0_#000] animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[var(--color-brutal-red)] border-3 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000]">
                <Trash2 className="w-5 h-5 text-white stroke-[3]" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black">
                Delete Chat?
              </h2>
            </div>
            <p className="font-bold text-gray-800 text-sm mb-6 leading-relaxed">
              Are you sure you want to delete this chat with <span className="font-black text-black uppercase underline decoration-2">{chatToDelete.customer?.displayName || chatToDelete.customer?.firstName || "Customer"}</span>?
              <br /><br />
              <span className="text-xs text-gray-500 font-semibold block bg-gray-100 p-2.5 border-2 border-black">
                This removes the chat from your inbox view. The customer can still view their chat history, and any active job booking will remain unaffected.
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setChatToDelete(null)}
                disabled={deleting}
                className="py-3 bg-white border-3 border-black font-black uppercase text-xs sm:text-sm shadow-[3px_3px_0_0_#000] hover:bg-gray-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteChat}
                disabled={deleting}
                className="py-3 bg-[var(--color-brutal-red)] text-white border-3 border-black font-black uppercase text-xs sm:text-sm shadow-[3px_3px_0_0_#000] hover:opacity-90 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {deleting ? "Deleting..." : "Delete Chat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

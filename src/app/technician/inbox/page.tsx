"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from "firebase/firestore";
import { JobRequest, UserAccount } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { MessageCircle, Search, Filter, SlidersHorizontal } from "lucide-react";

interface ChatListItem {
  job: JobRequest;
  customer: UserAccount | null;
  unreadCount: number;
}

export default function InboxPage() {
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
        where("artisanId", "==", user.uid)
      );
      
      unsubscribe = onSnapshot(q, async (snapshot) => {
        try {
          const allJobs = snapshot.docs.map(doc => doc.data() as JobRequest);
          const activeJobs = allJobs.filter(j => ["accepted", "en_route", "in_progress", "payment_pending", "completed"].includes(j.status));
          activeJobs.sort((a, b) => b.createdAt - a.createdAt);

          const listItems: ChatListItem[] = await Promise.all(activeJobs.map(async (job) => {
            let customer: UserAccount | null = null;
            if (job.customerId) {
              const cusDoc = await getDoc(doc(db, "users", job.customerId));
              if (cusDoc.exists()) {
                customer = cusDoc.data() as UserAccount;
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

  if (loading) return <GlobalSpinner />;

  const filteredList = chatList.filter(({ job, customer }) => {
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
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pt-12 px-4 md:px-12 pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-black text-black mb-2 tracking-tighter uppercase">Inbox</h1>
        <p className="text-black font-bold text-lg border-l-4 border-black pl-3 bg-[var(--color-brutal-teal)] inline-block pr-3 mb-10 -rotate-1 shadow-[2px_2px_0_0_#000]">Chat with your customers.</p>
        
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex justify-end w-full relative z-[60]">
            <div className="relative">
              <button 
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="flex items-center justify-center w-12 h-12 md:w-auto md:px-4 md:py-3 border-4 border-black bg-[var(--color-brutal-pink)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-6 h-6 stroke-[3] md:mr-2" />
                <span className="hidden md:inline font-black uppercase text-black">Sort</span>
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
          <div className="bg-white p-12 text-center border-4 border-black shadow-[4px_4px_0_0_#000]">
            <div className="w-20 h-20 bg-[var(--color-brutal-yellow)] border-4 border-black flex items-center justify-center mx-auto mb-4 rotate-3">
              <MessageCircle className="w-10 h-10 stroke-[3]" />
            </div>
            <h3 className="text-2xl font-black text-black mb-2 uppercase">No Results</h3>
            <p className="text-black font-bold">Try adjusting your search or sort filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedList.map(({ job, customer, unreadCount }) => (
              <Link 
                key={job.requestId} 
                href={`/chat/${job.requestId}`}
                className="block bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0_0_#000] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-black bg-[var(--color-brutal-yellow)]">
                      <UserAvatar 
                        photoURL={customer?.photoURL} 
                        name={customer?.displayName || (customer?.firstName ? `${customer.firstName} ${customer.lastName || ''}`.trim() : null) || customer?.phone || "Customer"} 
                        className="w-full h-full text-xl text-black font-black" 
                      />
                    </div>
                    {unreadCount > 0 && (
                      <div className="absolute -top-2 -right-2 bg-[var(--color-brutal-red)] text-white w-6 h-6 flex items-center justify-center border-2 border-black rounded-full font-black text-xs z-10 shadow-[2px_2px_0_0_#000]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-xl font-black text-black truncate uppercase tracking-tighter">
                        {customer?.displayName || (customer?.firstName ? `${customer.firstName} ${customer.lastName || ''}`.trim() : null) || customer?.phone || "Customer"}
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

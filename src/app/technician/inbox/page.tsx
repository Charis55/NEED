"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { JobRequest } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { MessageCircle } from "lucide-react";

interface ChatListItem {
  job: JobRequest;
  customer: any | null;
  unreadCount: number;
}

export default function InboxPage() {
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { showAlert } = useAlert();

  useEffect(() => {
    const fetchChats = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, "jobRequests"), 
          where("artisanId", "==", user.uid)
        );
        const snapshot = await getDocs(q);
        const allJobs = snapshot.docs.map(doc => doc.data() as JobRequest);
        
        const activeJobs = allJobs.filter(j => j.status === "accepted" || j.status === "completed");
        activeJobs.sort((a, b) => b.createdAt - a.createdAt);

        const listItems: ChatListItem[] = [];
        
        for (const job of activeJobs) {
          let customer: any | null = null;
          if (job.customerId) {
            const cusDoc = await getDoc(doc(db, "users", job.customerId));
            if (cusDoc.exists()) {
              customer = cusDoc.data();
            }
          }
          
          listItems.push({
            job,
            customer,
            unreadCount: 0 
          });
        }
        
        setChatList(listItems);
      } catch (error) {
        console.error("Error fetching chats:", error);
        showAlert("Failed to load inbox", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, [showAlert]);

  if (loading) return <GlobalSpinner />;

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pt-12 px-4 md:px-12 pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-black text-black mb-2 tracking-tighter uppercase">Inbox</h1>
        <p className="text-black font-bold text-lg border-l-4 border-black pl-3 bg-[var(--color-brutal-teal)] inline-block pr-3 mb-10 -rotate-1 shadow-[2px_2px_0_0_#000]">Chat with your customers.</p>
        
        {chatList.length === 0 ? (
          <div className="bg-white p-12 text-center border-4 border-black shadow-[4px_4px_0_0_#000]">
            <div className="w-20 h-20 bg-[var(--color-brutal-yellow)] border-4 border-black flex items-center justify-center mx-auto mb-4 rotate-3">
              <MessageCircle className="w-10 h-10 stroke-[3]" />
            </div>
            <h3 className="text-2xl font-black text-black mb-2 uppercase">No Active Chats</h3>
            <p className="text-black font-bold">When you accept jobs, you can chat with customers here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {chatList.map(({ job, customer, unreadCount }) => (
              <Link 
                key={job.requestId} 
                href={`/chat/${job.requestId}`}
                className="block bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0_0_#000] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-black flex-shrink-0 bg-[var(--color-brutal-yellow)]">
                    <UserAvatar 
                      photoURL={customer?.photoURL} 
                      name={customer?.displayName || "Customer"} 
                      className="w-full h-full text-xl text-black font-black" 
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-xl font-black text-black truncate uppercase tracking-tighter">
                        {customer?.displayName || "Customer"}
                      </h3>
                      <span className="text-xs font-black px-2 py-0.5 bg-[var(--color-brutal-bg)] border-2 border-black -rotate-2 whitespace-nowrap ml-2">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <p className="text-sm font-bold text-gray-700 truncate">
                      {job.trade} • {job.neighborhood}
                    </p>
                    
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-xs font-black uppercase px-2 py-0.5 border-2 border-black
                        ${job.status === 'completed' ? 'bg-[var(--color-brutal-teal)] text-black' : 'bg-[var(--color-brutal-yellow)] text-black'}
                      `}>
                        {job.status}
                      </span>
                      {unreadCount > 0 && (
                        <span className="bg-[var(--color-brutal-red)] text-white text-xs font-black px-2 py-0.5 border-2 border-black rounded-full">
                          {unreadCount} NEW
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
    </div>
  );
}

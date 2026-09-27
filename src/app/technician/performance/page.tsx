"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { ArtisanProfile, Review } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { ChevronLeft, Star, ThumbsUp, AlertTriangle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { JobRequest } from "@/types";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PerformancePage() {
  const [loading, setLoading] = useState(true);
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const router = useRouter();

  const submitReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      await updateDoc(doc(db, "reviews", reviewId), {
        artisanResponse: replyText.trim(),
        respondedAt: Date.now()
      });
      setReviews(reviews.map(r => r.reviewId === reviewId ? { ...r, artisanResponse: replyText.trim(), respondedAt: Date.now() } : r));
      setReplyingTo(null);
      setReplyText("");
    } catch (error) {
      console.error(error);
      alert("Failed to submit reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  useEffect(() => {
    const fetchPerformance = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const artisanRef = doc(db, "artisans", user.uid);
        const artisanSnap = await getDoc(artisanRef);
        
        if (artisanSnap.exists()) {
          setArtisan(artisanSnap.data() as ArtisanProfile);
        }

        const reviewsQ = query(collection(db, "reviews"), where("artisanId", "==", user.uid));
        const reviewsSnap = await getDocs(reviewsQ);
        
        const fetchedReviews = reviewsSnap.docs.map(d => ({ ...d.data(), reviewId: d.id } as Review));
        // Sort by newest first
        fetchedReviews.sort((a, b) => b.createdAt - a.createdAt);
        setReviews(fetchedReviews);

        const jobsQ = query(collection(db, "jobRequests"), where("artisanId", "==", user.uid));
        const jobsSnap = await getDocs(jobsQ);
        const fetchedJobs = jobsSnap.docs.map(d => ({ ...d.data(), id: d.id } as JobRequest));
        setJobs(fetchedJobs);

      } catch (err) {
        console.error("Error fetching performance data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, []);

  if (loading) return <div className="h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center"><GlobalSpinner text="LOADING PERFORMANCE" /></div>;
  
  if (!artisan) return <div className="p-8 font-black uppercase text-center text-xl">Profile not found</div>;

  const totalReviews = artisan.ratingCount || 0;
  const avgRating = artisan.ratingAverage || 0;
  
  // Calculate Rating Distribution
  const distribution = [5, 4, 3, 2, 1].map(stars => {
    const count = reviews.filter(r => Math.round(r.rating) === stars).length;
    const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
    return { stars, count, percentage };
  });

  // Calculate Job Metrics
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === "completed").length;
  const cancelledJobs = jobs.filter(j => j.status === "cancelled").length;
  const rejectedJobs = jobs.filter(j => j.status === "rejected").length;
  const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
  
  // Chart Data: Jobs completed per month for the last 6 months
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthName = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear();
    const monthStart = new Date(year, d.getMonth(), 1).getTime();
    const monthEnd = new Date(year, d.getMonth() + 1, 0, 23, 59, 59).getTime();
    
    const completedInMonth = jobs.filter(j => 
      j.status === "completed" && 
      j.completedAt && 
      j.completedAt >= monthStart && 
      j.completedAt <= monthEnd
    ).length;

    chartData.push({
      name: monthName,
      jobs: completedInMonth
    });
  }

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Header */}
      <div className="bg-[var(--color-brutal-yellow)] border-b-8 border-black p-4 pt-16 flex items-center shadow-[0_4px_0_0_#000] z-10 sticky top-0">
        <button 
          onClick={() => router.back()}
          className="w-12 h-12 bg-white border-4 border-black flex justify-center items-center mr-4 brutal-shadow hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-transform"
        >
          <ChevronLeft className="w-8 h-8 stroke-[3]" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-black uppercase tracking-tighter leading-none">Performance</h1>
          <p className="font-bold text-black text-sm uppercase mt-1 tracking-widest border-t-2 border-black pt-1 inline-block">
            Your Stats & Reviews
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 mt-6">
        
        {/* Top Summary Card */}
        <div className="bg-[var(--color-brutal-blue)] border-4 border-black p-6 md:p-10 mb-10 brutal-shadow -rotate-1 relative">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <p className="text-sm font-black uppercase tracking-widest mb-2 bg-white px-2 py-1 border-2 border-black inline-block -rotate-2">Overall Rating</p>
              <div className="flex items-end justify-center md:justify-start gap-2">
                <h2 className="text-7xl font-black leading-none tracking-tighter">{avgRating.toFixed(1)}</h2>
                <div className="pb-2">
                  <div className="flex gap-1 text-[var(--color-brutal-yellow)]">
                    {[1,2,3,4,5].map(star => (
                      <Star key={star} className={`w-8 h-8 ${star <= Math.round(avgRating) ? 'fill-current' : 'fill-transparent stroke-black stroke-[2]'}`} />
                    ))}
                  </div>
                  <p className="text-sm font-bold uppercase mt-1">Based on {totalReviews} Reviews</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border-4 border-black p-4 w-full md:w-64 rotate-1 shadow-[4px_4px_0_0_#000]">
              <h3 className="font-black uppercase mb-3 text-sm border-b-2 border-black pb-1">Response Time</h3>
              <p className="font-bold text-xl uppercase text-[var(--color-brutal-teal)]">{artisan.typicalResponseTime || "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Job Metrics & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-white border-4 border-black p-6 brutal-shadow-sm">
              <h3 className="font-black uppercase mb-2">Job Completion</h3>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-black">{completionRate}%</span>
              </div>
              <p className="text-sm font-bold text-gray-600">Completed {completedJobs} out of {totalJobs} total requests</p>
            </div>
            
            <div className="bg-white border-4 border-black p-6 brutal-shadow-sm">
              <h3 className="font-black uppercase mb-2">Cancelled/Rejected</h3>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-black text-[var(--color-brutal-red)]">{cancelledJobs + rejectedJobs}</span>
              </div>
              <p className="text-sm font-bold text-gray-600">Jobs missed</p>
            </div>
          </div>
          
          <div className="lg:col-span-2 bg-white border-4 border-black p-6 brutal-shadow-sm">
            <h3 className="font-black uppercase mb-6">Completed Jobs (Last 6 Months)</h3>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#000" vertical={false} />
                  <XAxis dataKey="name" stroke="#000" tick={{ fill: '#000', fontWeight: 'bold' }} />
                  <YAxis stroke="#000" tick={{ fill: '#000', fontWeight: 'bold' }} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ border: '4px solid #000', borderRadius: 0, fontWeight: 'bold', boxShadow: '4px 4px 0 0 #000' }}
                    itemStyle={{ color: '#000', fontWeight: 'black' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="jobs" 
                    stroke="var(--color-brutal-teal)" 
                    strokeWidth={4} 
                    dot={{ fill: 'var(--color-brutal-yellow)', stroke: '#000', strokeWidth: 3, r: 6 }} 
                    activeDot={{ r: 8, fill: '#000' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="bg-white border-4 border-black p-6 md:p-8 mb-10 brutal-shadow">
          <h3 className="text-2xl font-black uppercase mb-6 tracking-tighter">Rating Breakdown</h3>
          <div className="space-y-4">
            {distribution.map(({ stars, count, percentage }) => (
              <div key={stars} className="flex items-center gap-4">
                <div className="w-16 font-black text-lg flex items-center gap-1">
                  {stars} <Star className="w-5 h-5 fill-[var(--color-brutal-yellow)] stroke-black stroke-[2]" />
                </div>
                <div className="flex-1 h-6 bg-gray-200 border-2 border-black overflow-hidden relative">
                  <div 
                    className={`h-full border-r-2 border-black ${stars >= 4 ? 'bg-[var(--color-brutal-green)]' : stars === 3 ? 'bg-[var(--color-brutal-yellow)]' : 'bg-[var(--color-brutal-red)]'}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="w-12 text-right font-bold">{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality Badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-[var(--color-brutal-green)] border-4 border-black p-6 brutal-shadow-sm flex items-start gap-4">
            <div className="bg-white p-3 border-2 border-black rounded-full">
              <ShieldCheck className="w-8 h-8 stroke-[3]" />
            </div>
            <div>
              <h4 className="font-black uppercase text-xl mb-1">Top Tier Artisan</h4>
              <p className="text-sm font-bold leading-tight">Maintain a 4.5+ rating to unlock exclusive high-paying jobs and premium placement.</p>
            </div>
          </div>
          <div className="bg-[var(--color-brutal-pink)] border-4 border-black p-6 brutal-shadow-sm flex items-start gap-4">
            <div className="bg-white p-3 border-2 border-black rounded-full">
              <ThumbsUp className="w-8 h-8 stroke-[3]" />
            </div>
            <div>
              <h4 className="font-black uppercase text-xl mb-1">Customer Favorite</h4>
              <p className="text-sm font-bold leading-tight">You've completed {artisan.ratingCount} rated jobs. Keep up the great work to build trust!</p>
            </div>
          </div>
        </div>

        {/* Recent Reviews List */}
        <div>
          <h3 className="text-3xl font-black uppercase mb-6 tracking-tighter inline-block border-b-4 border-black pb-2">Recent Reviews</h3>
          
          {reviews.length === 0 ? (
            <div className="bg-white border-4 border-black p-8 text-center rotate-1 brutal-shadow-sm">
              <p className="font-black uppercase text-xl">No Reviews Yet</p>
              <p className="font-bold text-gray-600 mt-2">Complete jobs to start collecting feedback from customers.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map(review => (
                <div key={review.reviewId} className="bg-white border-4 border-black p-6 brutal-shadow-sm flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-black uppercase text-xl leading-none">{review.jobTitle || "Job Completed"}</h4>
                      <span className="text-xs font-bold bg-[var(--color-brutal-bg)] border-2 border-black px-2 py-1">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="flex gap-1 mb-4">
                      {[1,2,3,4,5].map(star => (
                        <Star key={star} className={`w-5 h-5 ${star <= review.rating ? 'fill-[var(--color-brutal-yellow)]' : 'fill-transparent stroke-gray-400'} stroke-black stroke-[2]`} />
                      ))}
                    </div>
                    
                    <p className="font-bold text-lg leading-relaxed mb-4 p-4 bg-gray-50 border-l-4 border-black">"{review.comment}"</p>
                    
                    {review.photos && review.photos.length > 0 && (
                      <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                        {review.photos.map((photo, idx) => (
                          <div key={idx} className="w-20 h-20 border-2 border-black relative shrink-0">
                            <Image src={photo} alt="Review photo" fill className="object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {review.artisanResponse ? (
                      <div className="mt-4 p-4 bg-[var(--color-brutal-teal)] border-4 border-black ml-4 md:ml-8 relative">
                        <div className="absolute -top-4 -left-4 w-8 h-8 bg-black rotate-45 border-4 border-white"></div>
                        <h5 className="font-black uppercase mb-1">Your Reply:</h5>
                        <p className="font-bold text-black text-sm">{review.artisanResponse}</p>
                      </div>
                    ) : (
                      <div className="mt-4">
                        {replyingTo === review.reviewId ? (
                          <div className="flex flex-col gap-2">
                            <textarea 
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              placeholder="Write a public reply..."
                              className="w-full border-4 border-black p-3 font-bold text-sm resize-none focus:outline-none"
                              rows={3}
                            ></textarea>
                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => { setReplyingTo(null); setReplyText(""); }}
                                className="px-4 py-2 bg-gray-200 border-2 border-black font-black uppercase text-sm"
                                disabled={submittingReply}
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => submitReply(review.reviewId)}
                                className="px-4 py-2 bg-[var(--color-brutal-blue)] border-2 border-black font-black uppercase text-sm flex items-center justify-center min-w-[100px]"
                                disabled={submittingReply || !replyText.trim()}
                              >
                                {submittingReply ? <GlobalSpinner text="" /> : "Post Reply"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => { setReplyingTo(review.reviewId); setReplyText(""); }}
                            className="font-black uppercase text-sm border-b-2 border-black pb-0.5 hover:text-[var(--color-brutal-blue)] transition-colors"
                          >
                            Add a Public Reply
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

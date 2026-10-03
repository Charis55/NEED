"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { JobRequest, ArtisanProfile, UserAccount } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { Printer, ArrowLeft, CheckCircle, Download } from "lucide-react";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { useAlert } from "@/components/AlertProvider";

export default function JobReceiptPage() {
  const params = useParams();
  const id = params.id as string;
  const [job, setJob] = useState<JobRequest | null>(null);
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [customer, setCustomer] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const { showAlert } = useAlert();

  const handleDownloadReceipt = async () => {
    if (!job) return;
    const price = job.counterOfferAmount || job.offerAmount || 0;
    const receiptContent = `NEED PLATFORM - JOB RECEIPT
==============================
Receipt ID: #${job.requestId.slice(-8).toUpperCase()}
Date: ${new Date(job.completedAt || job.createdAt).toLocaleDateString()}

BILLED TO:
${customer?.displayName || "Customer"}
${customer?.phone || ""}
${job.neighborhood || ""}

SERVICE BY:
${artisan?.name || "Technician"}
${artisan?.phone || ""}

JOB DETAILS:
${job.subcategory}
Status: ${job.status.toUpperCase()}

Total Amount: NGN ${price.toLocaleString()}
==============================
Thank you for using NEED.`;

    const fileName = `Receipt_NEED_${job.requestId.slice(-8).toUpperCase()}.txt`;

    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: receiptContent,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        showAlert(`Receipt saved to Documents folder as ${fileName}`, "success");
      } catch (err) {
        console.error(err);
        showAlert("Failed to save receipt to device", "error");
      }
    } else {
      const blob = new Blob([receiptContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    const fetchReceiptData = async () => {
      try {
        const jobDoc = await getDoc(doc(db, "jobRequests", id));
        if (jobDoc.exists()) {
          const jobData = jobDoc.data() as JobRequest;
          setJob(jobData);

          if (jobData.artisanId) {
            const artisanDoc = await getDoc(doc(db, "artisans", jobData.artisanId));
            if (artisanDoc.exists()) {
              setArtisan(artisanDoc.data() as ArtisanProfile);
            }
          }

          if (jobData.customerId) {
            const customerDoc = await getDoc(doc(db, "users", jobData.customerId));
            if (customerDoc.exists()) {
              setCustomer(customerDoc.data() as UserAccount);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching receipt:", err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchReceiptData();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-[#FFF0E5] flex justify-center items-center"><GlobalSpinner text="GENERATING RECEIPT..." /></div>;
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#FFF0E5] p-8 text-center flex flex-col justify-center items-center">
        <h1 className="text-4xl font-black uppercase mb-6">Receipt Not Found</h1>
        <Link href="/jobs" className="bg-white border-4 border-black px-6 py-3 font-black uppercase shadow-[4px_4px_0_0_#000]">
          Return to Jobs
        </Link>
      </div>
    );
  }

  const price = job.counterOfferAmount || job.offerAmount || 0;
  const date = new Date(job.completedAt || job.createdAt).toLocaleDateString();

  return (
    <div className="min-h-screen bg-[#FFF0E5] pt-16 px-6 md:px-12 pb-20">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8 print:hidden flex-wrap gap-4">
          <Link href="/jobs" className="inline-flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-black uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex gap-4">
            <button 
              onClick={handleDownloadReceipt}
              className="inline-flex items-center gap-2 bg-[var(--color-brutal-green)] text-black border-4 border-black px-6 py-2 font-black uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all"
            >
              <Download className="w-5 h-5" /> Download
            </button>
            <button 
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 bg-[var(--color-brutal-teal)] text-black border-4 border-black px-6 py-2 font-black uppercase shadow-[4px_4px_0_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all hidden md:inline-flex"
            >
              <Printer className="w-5 h-5" /> Print
            </button>
          </div>
        </div>

        <div className="bg-white border-4 border-black shadow-[12px_12px_0_0_#000] p-8 md:p-12 print:shadow-none print:border-none print:p-0">
          <div className="border-b-4 border-black pb-8 mb-8 text-center flex flex-col items-center">
            <h1 className="text-5xl font-black uppercase tracking-tighter mb-2">Receipt</h1>
            <div className="bg-black text-white px-4 py-1 font-mono font-bold tracking-widest inline-block transform -rotate-2">
              #{job.requestId.slice(-8).toUpperCase()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div>
              <p className="font-bold text-gray-500 uppercase tracking-widest text-sm mb-1">Billed To</p>
              <p className="font-black text-xl uppercase">{customer?.displayName || "Customer"}</p>
              <p className="font-bold">{customer?.phone}</p>
              <p className="font-bold mt-2">{job.neighborhood}</p>
            </div>
            <div className="md:text-right">
              <p className="font-bold text-gray-500 uppercase tracking-widest text-sm mb-1">Service By</p>
              <p className="font-black text-xl uppercase">{artisan?.identityVerifiedName || artisan?.name || "Technician"}</p>
              <p className="font-bold">{artisan?.trade}</p>
              <p className="font-bold uppercase tracking-widest text-xs mt-2 bg-[var(--color-brutal-yellow)] inline-block px-2 py-1 border-2 border-black">
                {date}
              </p>
            </div>
          </div>

          <div className="border-4 border-black mb-8 overflow-hidden">
            <div className="bg-[var(--color-brutal-blue)] border-b-4 border-black p-4 flex justify-between">
              <span className="font-black uppercase tracking-widest">Description</span>
              <span className="font-black uppercase tracking-widest">Amount</span>
            </div>
            <div className="p-4 bg-white flex justify-between items-start">
              <div>
                <p className="font-black text-lg uppercase">{job.trade}</p>
                <p className="font-bold text-gray-600">{job.subcategory}</p>
              </div>
              <p className="font-black text-2xl">₦{price.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex justify-end mb-12">
            <div className="w-full md:w-1/2 border-4 border-black p-4 bg-[var(--color-brutal-green)] text-black transform rotate-1">
              <div className="flex justify-between items-center">
                <span className="font-black uppercase tracking-widest text-lg">Total Paid</span>
                <span className="font-black text-4xl">₦{price.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="text-center pt-8 border-t-4 border-dashed border-gray-400">
            <div className="inline-flex items-center gap-2 mb-4 bg-white border-2 border-black px-4 py-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span className="font-black uppercase tracking-widest">Payment Confirmed</span>
            </div>
            <p className="font-bold text-gray-600 uppercase tracking-widest text-sm">Thank you for using NEED Marketplace</p>
          </div>
        </div>
      </div>
    </div>
  );
}

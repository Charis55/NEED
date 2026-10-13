"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { TrendingUp, TrendingDown, X, Loader2 } from "lucide-react";
import { useAlert } from "@/components/AlertProvider";
import { Wallet, UserPrivate } from "@/types/platform";
import Link from "next/link";

export default function WalletCard() {
  const { showAlert } = useAlert();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [userPrivate, setUserPrivate] = useState<UserPrivate | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [topUpAmountStr, setTopUpAmountStr] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  
  // Bank account form state
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [banks, setBanks] = useState<{name: string, code: string}[]>([]);
  const [fetchingBanks, setFetchingBanks] = useState(false);
  const [bankName, setBankName] = useState("");
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    // Listen to wallet real-time
    const unsubscribeWallet = onSnapshot(doc(db, "wallets", user.uid), (snap) => {
      if (snap.exists()) {
        setWallet(snap.data() as Wallet);
      } else {
        setWallet({ userId: user.uid, balance: 0, pendingEarnings: 0, blockedReason: "none", creditLimit: 0, updatedAt: Date.now() });
      }
      setLoading(false);
    });

    // Fetch userPrivate for bank account
    getDoc(doc(db, "userPrivate", user.uid)).then(snap => {
      if (snap.exists()) {
        setUserPrivate(snap.data() as UserPrivate);
      }
    });

    return () => unsubscribeWallet();
  }, []);

  useEffect(() => {
    const shouldShowForm = !userPrivate?.bankAccount || showBankForm;
    if (shouldShowForm && banks.length === 0 && !fetchingBanks && showWithdrawModal) {
      setFetchingBanks(true);
      fetch("/api/wallet/banks")
        .then(res => res.json())
        .then(data => {
          if (data.banks) {
            // Sort banks alphabetically
            const sortedBanks = data.banks.sort((a: any, b: any) => a.name.localeCompare(b.name));
            setBanks(sortedBanks);
          }
        })
        .catch(console.error)
        .finally(() => setFetchingBanks(false));
    }
  }, [showBankForm, userPrivate?.bankAccount, banks.length, showWithdrawModal]);

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankCode || !accountNumber) {
      showAlert("Please select a bank and enter your account number.", "error");
      return;
    }
    setSavingBank(true);
    try {
      const selectedBank = banks.find(b => b.code === bankCode);
      const res = await fetch("/api/wallet/add-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.currentUser?.uid,
          accountNumber,
          bankCode,
          bankName: selectedBank?.name || bankName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add bank account");
      
      setUserPrivate(prev => ({ ...prev, userId: auth.currentUser!.uid, bankAccount: data.bankAccount }));
      setShowBankForm(false);
      showAlert(`Account verified! Linked to ${data.bankAccount.accountName}`, "success");
    } catch (err: any) {
      showAlert(err.message, "error");
    } finally {
      setSavingBank(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNumNaira = parseFloat(amountStr);
    if (isNaN(amountNumNaira) || amountNumNaira <= 0) {
      showAlert("Enter a valid amount.", "error");
      return;
    }
    const amountKobo = Math.round(amountNumNaira * 100);
    if (!wallet || amountKobo > wallet.balance) {
      showAlert("Insufficient funds.", "error");
      return;
    }
    
    setWithdrawing(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.currentUser?.uid,
          amount: amountKobo
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");
      
      setShowWithdrawModal(false);
      setAmountStr("");
      window.location.href = `/checkout/withdraw-success?amount=${amountKobo}&reference=${data.payout?.reference || ""}`;
    } catch (err: any) {
      showAlert(err.message, "error");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNumNaira = parseFloat(topUpAmountStr);
    if (isNaN(amountNumNaira) || amountNumNaira < 100) {
      showAlert("Minimum top-up is ₦100.", "error");
      return;
    }
    const amountKobo = Math.round(amountNumNaira * 100);
    
    setToppingUp(true);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.currentUser?.uid,
          amount: amountKobo
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initialize top-up");
      
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        showAlert("Failed to get payment link.", "error");
      }
    } catch (err: any) {
      showAlert(err.message, "error");
    } finally {
      setToppingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border-4 border-black p-8 shadow-[6px_6px_0_0_#000] mb-8 flex justify-center items-center h-48">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const walletBalanceNaira = wallet ? (wallet.balance / 100) : 0;

  return (
    <>
      <div className="bg-[var(--color-brutal-yellow)] border-4 border-black p-8 shadow-[6px_6px_0_0_#000] mb-8 -rotate-1 relative overflow-visible">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <p className="text-black text-sm font-black mb-2 uppercase tracking-widest">Your Wallet</p>
            <p className="text-5xl md:text-7xl font-black text-black tracking-tighter">₦{walletBalanceNaira.toLocaleString()}</p>
          </div>
          
          {/* Action buttons (Desktop & Tablet) */}
          <div className="hidden md:flex flex-col gap-4 w-56 shrink-0">
            <div className="relative">
              <button 
                onClick={() => setShowWithdrawModal(true)}
                className="w-full bg-[var(--color-brutal-teal)] text-black px-6 py-3.5 font-black uppercase tracking-wider border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-x-1 active:translate-y-1 hover:bg-black hover:text-white transition-all flex items-center justify-center cursor-pointer"
              >
                <span>Withdraw</span>
              </button>
              {/* Crooked Upward Arrow Badge attached to Withdraw */}
              <div className="absolute -top-3.5 -right-3 bg-white border-4 border-black w-11 h-11 flex items-center justify-center rotate-12 shadow-[2px_2px_0_0_#000] pointer-events-none z-10">
                <TrendingUp className="w-7 h-7 stroke-[3] text-black" />
              </div>
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowTopUpModal(true)}
                className="w-full bg-[var(--color-brutal-green)] text-black px-6 py-3.5 font-black uppercase tracking-wider border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-x-1 active:translate-y-1 hover:bg-black hover:text-white transition-all flex items-center justify-center cursor-pointer"
              >
                <span>Fund Account</span>
              </button>
              {/* Crooked Inward/Downward Arrow Badge attached to Fund Account */}
              <div className="absolute -bottom-3 -right-3 bg-white border-4 border-black w-11 h-11 flex items-center justify-center -rotate-12 shadow-[2px_2px_0_0_#000] pointer-events-none z-10">
                <TrendingDown className="w-7 h-7 stroke-[3] text-black" />
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons (Mobile) */}
        <div className="mt-8 flex flex-col gap-3 md:hidden">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <button 
                onClick={() => setShowWithdrawModal(true)}
                className="w-full bg-[var(--color-brutal-teal)] text-black px-6 py-4 font-black uppercase tracking-wider border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-x-1 active:translate-y-1 hover:bg-black hover:text-white transition-all flex items-center justify-center cursor-pointer"
              >
                <span>Withdraw</span>
              </button>
              <div className="absolute -top-3 -right-2 bg-white border-3 border-black w-9 h-9 flex items-center justify-center rotate-12 shadow-[2px_2px_0_0_#000] pointer-events-none z-10">
                <TrendingUp className="w-5 h-5 stroke-[3] text-black" />
              </div>
            </div>

            <div className="relative flex-1">
              <button 
                onClick={() => setShowTopUpModal(true)}
                className="w-full bg-[var(--color-brutal-green)] text-black px-6 py-4 font-black uppercase tracking-wider border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-x-1 active:translate-y-1 hover:bg-black hover:text-white transition-all flex items-center justify-center cursor-pointer"
              >
                <span>Fund Account</span>
              </button>
              <div className="absolute -bottom-2.5 -right-2 bg-white border-3 border-black w-9 h-9 flex items-center justify-center -rotate-12 shadow-[2px_2px_0_0_#000] pointer-events-none z-10">
                <TrendingDown className="w-5 h-5 stroke-[3] text-black" />
              </div>
            </div>
          </div>
          <Link href="/technician/earnings?tab=wallet" className="inline-block bg-black text-white px-6 py-3 font-black uppercase text-sm tracking-widest hover:bg-white hover:text-black transition-colors border-2 border-black text-center mt-2">
            View Payment History
          </Link>
        </div>
        
        {/* Desktop link */}
        <div className="mt-4 hidden md:block">
          <Link href="/technician/earnings?tab=wallet" className="inline-block bg-black text-white px-6 py-2.5 font-black uppercase text-xs tracking-widest hover:bg-white hover:text-black transition-colors border-2 border-black text-center">
            View Payment History
          </Link>
        </div>
      </div>

      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white border-4 border-black max-w-md w-full shadow-[8px_8px_0_0_var(--color-brutal-teal)] relative">
            <button 
              onClick={() => setShowWithdrawModal(false)}
              className="absolute top-4 right-4 text-black hover:text-[var(--color-brutal-red)] transition-colors"
            >
              <X className="w-8 h-8 stroke-[3]" />
            </button>
            
            <div className="p-8">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-6 border-b-4 border-black pb-2">
                Withdraw Funds
              </h2>
              
              {!userPrivate?.bankAccount || showBankForm ? (
                <form onSubmit={handleAddBank}>
                  <p className="font-bold text-gray-700 mb-4 bg-gray-100 p-3 border-l-4 border-black">
                    You need to link a bank account before withdrawing.
                  </p>
                  
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-black uppercase tracking-widest mb-1">Bank Name</label>
                      <select 
                        value={bankCode}
                        onChange={(e) => setBankCode(e.target.value)}
                        className="w-full border-4 border-black p-3 font-bold focus:outline-none focus:bg-gray-100"
                        required
                      >
                        <option value="">Select your bank...</option>
                        {fetchingBanks ? (
                          <option value="" disabled>Loading banks...</option>
                        ) : (
                          banks.map((b, i) => (
                            <option key={`${b.code}-${i}`} value={b.code}>{b.name}</option>
                          ))
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-black uppercase tracking-widest mb-1">Account Number</label>
                      <input 
                        type="text" 
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="10 digits"
                        className="w-full border-4 border-black p-3 font-bold focus:outline-none focus:bg-gray-100"
                        maxLength={10}
                        required
                      />
                    </div>
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={savingBank}
                    className="w-full bg-[var(--color-brutal-green)] text-black font-black uppercase py-4 border-4 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {savingBank ? <Loader2 className="animate-spin w-6 h-6" /> : "Link Bank Account"}
                  </button>
                  {userPrivate?.bankAccount && (
                    <button type="button" onClick={() => setShowBankForm(false)} className="w-full mt-4 font-bold underline">Cancel</button>
                  )}
                </form>
              ) : (
                <form onSubmit={handleWithdraw}>
                  <div className="mb-6 bg-gray-100 border-4 border-black p-4">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Withdrawing to</p>
                    <p className="font-black text-xl">{userPrivate.bankAccount.accountName}</p>
                    <p className="font-bold">{userPrivate.bankAccount.bankName} - {userPrivate.bankAccount.accountNumber}</p>
                    <button type="button" onClick={() => setShowBankForm(true)} className="text-sm font-bold underline text-[var(--color-brutal-teal)] mt-2">Change Account</button>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex justify-between items-end mb-1">
                      <label className="block text-sm font-black uppercase tracking-widest">Amount (₦)</label>
                      <span className="text-xs font-bold text-gray-500">Max: ₦{walletBalanceNaira.toLocaleString()}</span>
                    </div>
                    <input 
                      type="number" 
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      placeholder="Amount to withdraw"
                      max={walletBalanceNaira}
                      className="w-full border-4 border-black p-4 text-3xl font-black focus:outline-none focus:bg-gray-100"
                      required
                    />
                  </div>
                  
                  <p className="text-xs font-bold text-gray-600 mb-6 bg-[var(--color-brutal-pink)] p-2 border-2 border-black">
                    Note: You are limited to 4 withdrawals per week to minimize transaction charges.
                  </p>
                  
                  <button 
                    type="submit" 
                    disabled={withdrawing || walletBalanceNaira <= 0}
                    className="w-full bg-black text-white font-black uppercase py-4 border-4 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {withdrawing ? <Loader2 className="animate-spin w-6 h-6" /> : "Withdraw Now"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white border-4 border-black max-w-md w-full shadow-[8px_8px_0_0_var(--color-brutal-green)] relative">
            <button 
              onClick={() => setShowTopUpModal(false)}
              className="absolute top-4 right-4 text-black hover:text-[var(--color-brutal-red)] transition-colors"
            >
              <X className="w-8 h-8 stroke-[3]" />
            </button>
            
            <div className="p-8">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 border-b-4 border-black pb-2 flex items-center gap-2">
                <TrendingDown className="w-8 h-8 stroke-[3] text-[var(--color-brutal-green)]" />
                Fund Account
              </h2>
              
              <p className="text-sm font-bold text-gray-600 mb-6 uppercase">
                Top up your wallet balance instantly via Paystack to settle platform fees or maintain your account.
              </p>

              <form onSubmit={handleTopUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-1">
                    Amount to Fund (₦)
                  </label>
                  <input
                    type="number"
                    step="50"
                    min="100"
                    placeholder="Min ₦100"
                    value={topUpAmountStr}
                    onChange={e => setTopUpAmountStr(e.target.value)}
                    required
                    className="w-full p-4 border-4 border-black font-black text-3xl focus:outline-none focus:bg-[var(--color-brutal-yellow)] transition-colors"
                  />
                </div>

                {/* Quick amount presets */}
                <div className="grid grid-cols-4 gap-2">
                  {[1000, 2500, 5000, 10000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmountStr(amt.toString())}
                      className="py-2 text-xs font-black uppercase border-2 border-black bg-gray-100 hover:bg-[var(--color-brutal-yellow)] transition-colors shadow-[2px_2px_0_0_#000] cursor-pointer"
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={toppingUp || !topUpAmountStr || parseFloat(topUpAmountStr) < 100}
                  className="w-full py-4 mt-4 bg-[var(--color-brutal-green)] text-black border-4 border-black font-black uppercase tracking-widest text-lg hover:bg-black hover:text-white transition-all shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {toppingUp ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <span>PROCEED TO PAYSTACK</span>
                      <TrendingDown className="w-6 h-6 stroke-[3]" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { Download, Smartphone, ArrowRight, ShieldCheck, Wifi, Sparkles, Check } from "lucide-react";
import { useState } from "react";

export default function InstallPage() {
  const [copied, setCopied] = useState(false);
  const otaUrl = "itms-services://?action=download-manifest&url=https://need-chi.vercel.app/ios/manifest.plist";

  const handleCopy = () => {
    navigator.clipboard.writeText("https://need-chi.vercel.app/install");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] text-black p-4 sm:p-6 md:p-12 flex flex-col justify-between">
      <div className="max-w-2xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="bg-white border-4 border-black p-6 sm:p-8 brutal-shadow relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[var(--color-brutal-yellow)] border-2 border-black flex items-center justify-center font-black">
              <Wifi className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider bg-black text-white px-2 py-0.5">
              Wireless Deployment
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight leading-none mt-2">
            Install NEED on iPhone
          </h1>
          <p className="font-bold text-gray-700 mt-3 text-sm sm:text-base">
            Install the latest signed build of NEED directly over the air onto your iPhone without connecting any cables.
          </p>
        </div>

        {/* Primary Wireless Action */}
        <div className="bg-[var(--color-brutal-green)] border-4 border-black p-6 sm:p-8 brutal-shadow space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl sm:text-2xl font-black uppercase flex items-center gap-2">
              <Sparkles className="w-6 h-6 stroke-[3]" /> One-Tap Wireless Install
            </h2>
            <span className="text-xs font-black bg-white border-2 border-black px-2 py-1 uppercase">
              Latest Build
            </span>
          </div>
          <p className="font-bold text-xs sm:text-sm text-black/80">
            Tap the button below in <strong>Safari on your iPhone</strong>. iOS will display a prompt asking to install &quot;NEED&quot;.
          </p>
          <a
            href={otaUrl}
            className="block text-center w-full bg-black text-white hover:bg-neutral-800 border-4 border-black font-black uppercase text-lg sm:text-xl py-4 sm:py-5 tracking-wider transition-all brutal-shadow hover:translate-x-1 hover:translate-y-1 active:translate-x-2 active:translate-y-2"
          >
            📲 TAP TO INSTALL ON IPHONE
          </a>
        </div>

        {/* Instructions */}
        <div className="bg-white border-4 border-black p-6 sm:p-8 brutal-shadow space-y-5">
          <h3 className="font-black uppercase text-lg flex items-center gap-2 border-b-4 border-black pb-3">
            <Smartphone className="w-5 h-5 stroke-[2.5]" /> 3 Simple Steps
          </h3>
          
          <div className="space-y-4 text-sm font-bold">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-black text-white rounded-none flex items-center justify-center font-black shrink-0">
                1
              </div>
              <div>
                <p className="text-black">Open this page in Safari on your iPhone:</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="bg-gray-100 border-2 border-black px-2 py-1 text-xs select-all">
                    https://need-chi.vercel.app/install
                  </code>
                  <button
                    onClick={handleCopy}
                    className="bg-[var(--color-brutal-yellow)] border-2 border-black px-2 py-1 text-xs font-black uppercase hover:bg-yellow-400"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "COPY"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-black text-white rounded-none flex items-center justify-center font-black shrink-0">
                2
              </div>
              <div>
                <p className="text-black">
                  Tap <span className="underline font-black">&quot;TAP TO INSTALL ON IPHONE&quot;</span> above, then tap <strong>&quot;Install&quot;</strong> when iOS prompts you.
                </p>
                <p className="text-xs text-gray-600 mt-0.5">The app will appear on your Home Screen and begin downloading.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-black text-white rounded-none flex items-center justify-center font-black shrink-0">
                3
              </div>
              <div>
                <p className="text-black">Trust the Developer Profile (First-Time Only):</p>
                <p className="text-xs text-gray-700 mt-1">
                  Go to <strong>Settings</strong> &rarr; <strong>General</strong> &rarr; <strong>VPN &amp; Device Management</strong> &rarr; Tap your developer certificate &rarr; Tap <strong>&quot;Trust&quot;</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alternative Sideload Options */}
        <div className="bg-white border-4 border-black p-6 brutal-shadow flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-black uppercase text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" /> Direct File Download
            </h4>
            <p className="font-bold text-xs text-gray-600 mt-1">
              Need the raw IPA for AltStore, Sideloadly, or TrollStore?
            </p>
          </div>
          <a
            href="/ios/Need.ipa"
            download="Need.ipa"
            className="w-full sm:w-auto bg-[var(--color-brutal-yellow)] border-2 border-black px-4 py-2 font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-yellow-400 shrink-0"
          >
            <Download className="w-4 h-4 stroke-[2.5]" /> Download Need.ipa
          </a>
        </div>

        {/* Back Link */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-black uppercase text-sm border-b-2 border-black hover:opacity-70"
          >
            &larr; Back to NEED Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}

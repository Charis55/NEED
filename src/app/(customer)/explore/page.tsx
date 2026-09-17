import Link from "next/link";
import { Search, Menu, MapPin } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pb-20 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Top Section */}
      <div className="bg-[var(--color-brutal-teal)] border-b-4 border-black px-6 pt-12 pb-10 brutal-shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white brutal-border overflow-hidden brutal-shadow-sm">
              <img src="https://i.pravatar.cc/150?img=11" alt="User profile" className="w-full h-full object-cover grayscale contrast-125" />
            </div>
            <div>
              <h2 className="text-black font-black text-xl uppercase tracking-tighter">Jensen Crowly</h2>
              <p className="text-black font-bold border-l-2 border-black pl-2 text-sm mt-1">09.11.2022</p>
            </div>
          </div>
          <button className="w-12 h-12 bg-white brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none">
            <Menu className="w-6 h-6 text-black stroke-[3]" />
          </button>
        </div>

        <h1 className="text-5xl font-black text-black mb-6 uppercase tracking-tighter leading-none max-w-[280px]">
          How can we <span className="bg-[var(--color-brutal-yellow)] inline-block px-2 border-2 border-black -rotate-2 mt-2">help you?</span>
        </h1>

        <div className="relative border-4 border-black bg-white focus-within:bg-[var(--color-brutal-yellow)] transition-colors brutal-shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-6 w-6 text-black stroke-[3]" />
          </div>
          <input
            type="text"
            className="w-full pl-14 pr-4 py-4 border-none focus:outline-none text-black font-black placeholder-gray-500 uppercase text-sm bg-transparent"
            placeholder="START SEARCH"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Link href="/explore/map" className="bg-[var(--color-brutal-pink)] text-black px-6 py-3 text-sm brutal-btn gap-2 inline-flex">
            <MapPin className="w-5 h-5 stroke-[3]" />
            RADAR
          </Link>
        </div>
      </div>

      {/* Categories Section */}
      <div className="px-6 mt-10">
        <div className="grid grid-cols-2 gap-6">
          
          {/* Cleaning */}
          <Link href="/services/cleaning" className="block">
            <div className="bg-[var(--color-brutal-blue)] p-5 brutal-card h-48 flex flex-col justify-between brutal-shadow hover:-translate-y-1 transition-transform">
              <span className="bg-white text-black text-sm font-black px-3 py-1 brutal-border self-start -rotate-2">
                $20 / HR
              </span>
              <div>
                <h3 className="text-2xl font-black mb-1 uppercase tracking-tighter">Cleaning</h3>
                <p className="text-black font-bold text-sm leading-tight border-t-2 border-black pt-1">All types of cleaning</p>
              </div>
            </div>
          </Link>

          {/* Handyman */}
          <Link href="/services/handyman" className="block">
            <div className="bg-white p-5 brutal-card h-48 flex flex-col justify-end brutal-shadow hover:-translate-y-1 transition-transform">
              <div>
                <h3 className="text-2xl font-black mb-1 uppercase tracking-tighter">Handyman</h3>
                <p className="text-black font-bold text-sm leading-tight border-t-2 border-black pt-1">Any help around house</p>
              </div>
            </div>
          </Link>

          {/* Repairing */}
          <Link href="/services/repairing" className="block">
            <div className="bg-black text-white p-5 brutal-card h-48 flex flex-col justify-end brutal-shadow hover:-translate-y-1 transition-transform">
              <div>
                <h3 className="text-2xl font-black mb-1 text-white uppercase tracking-tighter">Repairing</h3>
                <p className="text-gray-300 font-bold text-sm leading-tight border-t-2 border-white pt-1">Appliances, plumbing</p>
              </div>
            </div>
          </Link>

          {/* Interior Remodeling */}
          <Link href="/services/remodeling" className="block">
            <div className="bg-[var(--color-brutal-yellow)] p-5 brutal-card h-48 flex flex-col justify-between brutal-shadow hover:-translate-y-1 transition-transform">
              <span className="bg-white text-black text-sm font-black px-3 py-1 brutal-border self-start rotate-2">
                $120 / HR
              </span>
              <div>
                <h3 className="text-2xl font-black mb-1 leading-none uppercase tracking-tighter">Remodeling</h3>
                <p className="text-black font-bold text-sm leading-tight border-t-2 border-black pt-1">Redesign of house</p>
              </div>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Search, Menu } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      {/* Top Green Section */}
      <div className="bg-emerald-400 rounded-b-[40px] px-6 pt-12 pb-10">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white">
              <img src="https://i.pravatar.cc/150?img=11" alt="User profile" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-gray-900 font-bold text-lg leading-tight">Jensen Crowly</h2>
              <p className="text-gray-800 text-sm">09.11.2022</p>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-gray-900">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-6 leading-tight max-w-[250px]">
          How can we help you?
        </h1>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full pl-12 pr-4 py-4 rounded-full border-none focus:ring-2 focus:ring-gray-900 shadow-sm text-gray-900 placeholder-gray-400"
            placeholder="Start search"
          />
        </div>
      </div>

      {/* Categories Section */}
      <div className="px-4 mt-6">
        <div className="grid grid-cols-2 gap-4">
          
          {/* Cleaning */}
          <Link href="/services/cleaning" className="block">
            <div className="bg-black text-white p-5 rounded-3xl h-48 flex flex-col justify-between shadow-xl transition-transform hover:scale-105 active:scale-95">
              <span className="bg-white text-black text-xs font-bold px-3 py-1 rounded-full self-start">
                $2 per hour
              </span>
              <div>
                <h3 className="text-xl font-bold mb-1">Cleaning</h3>
                <p className="text-gray-400 text-sm leading-tight">all types of cleaning</p>
              </div>
            </div>
          </Link>

          {/* Handyman */}
          <Link href="/services/handyman" className="block">
            <div className="bg-white text-gray-900 p-5 rounded-3xl h-48 flex flex-col justify-end shadow-xl border border-gray-100 transition-transform hover:scale-105 active:scale-95">
              <div>
                <h3 className="text-xl font-bold mb-1">Handyman</h3>
                <p className="text-gray-400 text-sm leading-tight">any help around the house</p>
              </div>
            </div>
          </Link>

          {/* Repairing */}
          <Link href="/services/repairing" className="block">
            <div className="bg-gray-200 text-gray-900 p-5 rounded-3xl h-48 flex flex-col justify-end shadow-md transition-transform hover:scale-105 active:scale-95">
              <div>
                <h3 className="text-xl font-bold mb-1">Repairing</h3>
                <p className="text-gray-500 text-sm leading-tight">Appliances, plumbing, furniture</p>
              </div>
            </div>
          </Link>

          {/* Interior Remodeling */}
          <Link href="/services/remodeling" className="block">
            <div className="bg-yellow-300 text-gray-900 p-5 rounded-3xl h-48 flex flex-col justify-between shadow-lg transition-transform hover:scale-105 active:scale-95">
              <span className="bg-white/50 text-gray-900 text-xs font-bold px-3 py-1 rounded-full self-start backdrop-blur-sm">
                $120 per hour
              </span>
              <div>
                <h3 className="text-xl font-bold mb-1 leading-tight">Interior Remodeling</h3>
                <p className="text-yellow-800 text-sm leading-tight">Redesign of house</p>
              </div>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}

import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Tag } from "lucide-react";
import { getAllPosts } from "@/data/blogPosts";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home Repair Guides, Technician Tips & Escrow Protection | NEED Blog",
  description: "Comprehensive home maintenance, electrical safety, plumbing guides, and technician tips from certified professionals on the NEED marketplace.",
};

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <PublicHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12 md:py-20">
        <div className="max-w-3xl mb-12">
          <span className="bg-[var(--color-brutal-yellow)] px-3 py-1 text-xs font-black uppercase tracking-widest brutal-border inline-block mb-4">
            Knowledge Base & Practical Advice
          </span>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tighter mb-4 leading-none">
            Home Repair Guides & Technician Tips
          </h1>
          <p className="text-lg md:text-xl font-bold text-gray-800">
            Expert practical insights on maintaining your home, diagnosing electrical faults, servicing generators, and working with verified tradespeople.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link
              href={`/blog/${post.slug}`}
              key={post.slug}
              className="bg-white border-4 border-black shadow-[6px_6px_0_0_#000] p-6 flex flex-col hover:-translate-y-2 hover:shadow-[10px_10px_0_0_#000] transition-all"
            >
              <div className="flex items-center justify-between text-xs font-black uppercase mb-3">
                <span className="bg-[var(--color-brutal-teal)] px-2 py-0.5 border border-black">
                  {post.category}
                </span>
                <span className="text-gray-500 font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {post.readingTime}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight mb-3 leading-tight line-clamp-2">
                {post.title}
              </h2>

              <p className="text-gray-700 text-sm font-medium flex-1 mb-6 leading-relaxed line-clamp-3">
                {post.excerpt}
              </p>

              <div className="border-t-2 border-black pt-4 flex items-center justify-between text-xs font-black uppercase tracking-wider">
                <span className="text-gray-500">{post.date}</span>
                <span className="text-black flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Read Guide <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const posts = [
  {
    slug: "top-5-ways-to-hire-plumber",
    title: "The Top 5 Ways to Hire a Reliable Plumber",
    excerpt: "Hiring a plumber shouldn't be a gamble. Learn the top five things you must check before letting anyone touch your pipes.",
    date: "October 12, 2026"
  },
  {
    slug: "why-electricians-charge-callout-fees",
    title: "Why Electricians Charge Call-Out Fees",
    excerpt: "Ever wonder why you have to pay just for an electrician to show up? We break down the economics of trades work.",
    date: "September 28, 2026"
  },
  {
    slug: "diy-vs-professional-carpentry",
    title: "DIY vs. Professional Carpentry: When to Call a Pro",
    excerpt: "Building a shelf is one thing, but structural framing is another. Learn when it's time to put down the hammer and call a professional carpenter.",
    date: "September 15, 2026"
  }
];

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <PublicHeader />
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12 md:py-20">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-12 bg-[var(--color-brutal-pink)] inline-block px-4 py-2 brutal-border">
          Articles & Tips
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link href={`/blog/${post.slug}`} key={post.slug} className="bg-white brutal-card p-6 flex flex-col hover:-translate-y-2 transition-transform">
              <div className="text-sm font-bold text-gray-500 mb-2">{post.date}</div>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-4 leading-tight">{post.title}</h2>
              <p className="text-gray-700 font-medium flex-1 mb-6">{post.excerpt}</p>
              <div className="flex items-center text-lg font-black uppercase tracking-widest text-[var(--color-brutal-teal)]">
                Read Article <ArrowRight className="w-5 h-5 ml-2" />
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

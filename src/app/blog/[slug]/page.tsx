import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { notFound } from "next/navigation";
import { getPostBySlug, getAllPosts } from "@/data/blogPosts";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Tag, ShieldCheck, ArrowRight } from "lucide-react";

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: "Article Not Found | NEED Guides",
    };
  }

  return {
    title: `${post.title} | NEED Home Guides`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      url: `https://need-chi.vercel.app/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: {
      "@type": "Organization",
      name: "NEED Marketplace Editorial Team",
    },
    publisher: {
      "@type": "Organization",
      name: "NEED Marketplace",
      logo: {
        "@type": "ImageObject",
        url: "https://need-chi.vercel.app/LOGO.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://need-chi.vercel.app/blog/${post.slug}`,
    },
  };

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicHeader />
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-10 md:py-16">
        <div className="mb-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider bg-white px-3 py-1.5 border-2 border-black hover:bg-[var(--color-brutal-yellow)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to all articles
          </Link>
        </div>

        <article className="bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-6 sm:p-12 space-y-8">
          <header className="space-y-4 border-b-4 border-black pb-8">
            <div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase">
              <span className="bg-[var(--color-brutal-teal)] px-2.5 py-1 border-2 border-black">
                {post.category}
              </span>
              <span className="text-gray-600 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {post.date}
              </span>
              <span className="text-gray-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {post.readingTime}
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight leading-[1.1]">
              {post.title}
            </h1>

            <p className="text-base sm:text-lg text-gray-700 font-bold border-l-4 border-black pl-4">
              {post.excerpt}
            </p>
          </header>

          <div
            className="prose prose-lg max-w-none text-black leading-relaxed font-medium space-y-6"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* CALL TO ACTION BOX */}
          <section className="bg-[var(--color-brutal-yellow)] p-6 sm:p-8 border-4 border-black mt-10 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-black" />
              <h3 className="text-xl sm:text-2xl font-black uppercase">
                Hire a Verified Technician on NEED
              </h3>
            </div>
            <p className="text-sm sm:text-base font-bold text-gray-900 leading-normal">
              Skip the frustration of unvetted tradespeople. Get upfront price quotes, escrow protection, and a 30-day workmanship guarantee.
            </p>
            <div className="pt-2">
              <Link
                href="/explore"
                className="bg-black text-white px-6 py-3 font-black uppercase text-xs sm:text-sm border-2 border-black hover:bg-white hover:text-black transition-colors inline-flex items-center gap-2"
              >
                Find Local Technicians Now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}

import Link from "next/link";

export default function PublicHeader() {
  return (
    <nav className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full py-8 flex justify-between items-center bg-[var(--color-brutal-bg)]">
      <Link href="/" className="flex items-center gap-3">
        <div className="flex items-center">
          <img src="/LOGO.png" alt="N Logo" className="h-12 w-auto" />
          <span className="text-[44px] font-bold text-black leading-none tracking-tighter -ml-2">EED</span>
        </div>
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/blog" className="hidden sm:block font-black uppercase text-black hover:text-[var(--color-brutal-teal)] tracking-widest transition-colors mr-4">
          Articles
        </Link>
        <Link href="/login?mode=signin" className="bg-[var(--color-brutal-yellow)] px-8 py-3 text-lg brutal-btn">
          Sign In
        </Link>
      </div>
    </nav>
  );
}

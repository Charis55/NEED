import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <PublicHeader />
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 md:py-20">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-8 bg-[var(--color-brutal-yellow)] inline-block px-4 py-2 brutal-border -rotate-1">
          About NEED
        </h1>
        
        <div className="prose prose-lg max-w-none prose-headings:font-black prose-headings:uppercase prose-p:font-medium prose-p:text-lg">
          <p className="lead text-2xl font-bold mb-8">
            NEED is the ultimate marketplace connecting skilled, verified technicians with people who need their expertise right now.
          </p>

          <h2 className="text-3xl mt-12 mb-4 bg-[var(--color-brutal-teal)] inline-block px-2 brutal-border">Our Mission</h2>
          <p>
            For too long, hiring a plumber, electrician, or carpenter has relied on luck and sketchy word-of-mouth recommendations. We built NEED to inject trust, speed, and transparency into the local service economy. We want to empower honest artisans to build their business while giving customers absolute peace of mind.
          </p>

          <h2 className="text-3xl mt-12 mb-4 bg-[var(--color-brutal-pink)] inline-block px-2 brutal-border">Why Choose Us?</h2>
          <ul className="list-disc pl-6 space-y-4 font-medium mt-4">
            <li><strong>Strict Verification:</strong> Every artisan on our platform has passed a rigorous identity and background check. No exceptions.</li>
            <li><strong>Real Reviews:</strong> Our reviews are tied directly to completed jobs. No fake testimonials, just real feedback from your neighbors.</li>
            <li><strong>Location-Based:</strong> When an emergency strikes, you need someone fast. Our map-based matching ensures you find the closest available professional.</li>
            <li><strong>Transparent Portfolios:</strong> See exactly what an artisan has built or repaired before you ever send a message.</li>
          </ul>

          <h2 className="text-3xl mt-12 mb-4 bg-white inline-block px-2 brutal-border">Join the Movement</h2>
          <p>
            Whether you are a homeowner looking for reliable help, or a skilled tradesperson ready to take control of your schedule and earnings, NEED is your platform. Sign up today and experience the raw, honest way to hire.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

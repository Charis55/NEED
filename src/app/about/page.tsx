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
        
        <div className="space-y-12 mt-12">
          
          <div className="bg-white p-8 md:p-12 brutal-card rotate-1 hover:rotate-0 transition-transform">
            <h2 className="text-3xl md:text-5xl font-black uppercase mb-6 text-black tracking-tight border-b-8 border-[var(--color-brutal-teal)] pb-2 inline-block">
              Our Mission
            </h2>
            <p className="text-xl md:text-2xl font-medium leading-relaxed">
              For too long, hiring a plumber, electrician, or carpenter has relied on luck and sketchy word-of-mouth recommendations. We built <span className="bg-[var(--color-brutal-yellow)] px-2 font-black border-2 border-black">NEED</span> to inject trust, speed, and transparency into the local service economy. We want to empower honest artisans to build their business while giving customers absolute peace of mind.
            </p>
          </div>

          <div className="p-8 md:p-12 brutal-card -rotate-1 hover:rotate-0 transition-transform shadow-[8px_8px_0_0_#FFCC00]">
            <h2 className="text-3xl md:text-5xl font-black uppercase mb-8 tracking-tight text-[var(--color-brutal-pink)]" style={{ textShadow: '2px 2px 0px #000' }}>
              Why Choose Us?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="border-l-8 border-[var(--color-brutal-teal)] pl-6">
                <h3 className="text-2xl font-black uppercase mb-2 text-black">Strict Verification</h3>
                <p className="font-bold text-xl text-black leading-relaxed">Every artisan on our platform has passed a rigorous identity and background check. No exceptions.</p>
              </div>
              <div className="border-l-8 border-[var(--color-brutal-yellow)] pl-6">
                <h3 className="text-2xl font-black uppercase mb-2 text-black">Real Reviews</h3>
                <p className="font-bold text-xl text-black leading-relaxed">Our reviews are tied directly to completed jobs. No fake testimonials, just real feedback from your neighbors.</p>
              </div>
              <div className="border-l-8 border-[var(--color-brutal-pink)] pl-6">
                <h3 className="text-2xl font-black uppercase mb-2 text-black">Location-Based</h3>
                <p className="font-bold text-xl text-black leading-relaxed">When an emergency strikes, you need someone fast. Our map-based matching ensures you find the closest available professional.</p>
              </div>
              <div className="border-l-8 border-black pl-6">
                <h3 className="text-2xl font-black uppercase mb-2 text-black">Transparent Portfolios</h3>
                <p className="font-bold text-xl text-black leading-relaxed">See exactly what an artisan has built or repaired before you ever send a message.</p>
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-brutal-blue)] p-8 md:p-12 brutal-card text-center mt-16">
            <h2 className="text-4xl md:text-6xl font-black uppercase mb-6 tracking-tighter">
              Join the Movement
            </h2>
            <p className="text-xl md:text-2xl font-bold leading-relaxed max-w-2xl mx-auto mb-8">
              Whether you are a homeowner looking for reliable help, or a skilled tradesperson ready to take control of your schedule and earnings, NEED is your platform. Sign up today and experience the raw, honest way to hire.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

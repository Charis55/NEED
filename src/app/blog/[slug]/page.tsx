import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { notFound } from "next/navigation";

const POSTS: Record<string, { title: string; date: string; content: string }> = {
  "top-5-ways-to-hire-plumber": {
    title: "The Top 5 Ways to Hire a Reliable Plumber",
    date: "October 12, 2026",
    content: `
      <p>Hiring a plumber shouldn't be a gamble, but for many homeowners, it often feels like one. Water damage is incredibly expensive, so when a pipe bursts or a drain clogs, the instinct is to call the first number you see online. However, taking just a few extra minutes to verify your professional can save you thousands of dollars in the long run.</p>
      
      <h3>1. Check for Licensing and Insurance</h3>
      <p>This is non-negotiable. Every plumber entering your home should be fully licensed to operate in your jurisdiction and carry both liability insurance and worker's compensation. If they accidentally flood your kitchen and don't have insurance, you could be on the hook for the damages.</p>
      
      <h3>2. Look at Past Work Portfolios</h3>
      <p>A good plumber is proud of their work. Ask to see photos of their previous jobs. While pipe work isn't always glamorous, clean solder joints, neatly run PEX lines, and properly installed traps are signs of a professional who takes their craft seriously.</p>

      <h3>3. Read Verified Reviews</h3>
      <p>Word of mouth is great, but verified reviews tied to actual completed jobs are better. Look for patterns in the reviews. Does the plumber frequently show up late? Do they leave the work area messy? These are red flags.</p>

      <h3>4. Get a Clear Estimate Upfront</h3>
      <p>Reputable plumbers will give you a clear, written estimate before starting work. While unforeseen issues can arise once walls are opened, the baseline cost for the call-out and standard hourly rate should never be a surprise.</p>

      <h3>5. Ask About Warranties</h3>
      <p>If a repair fails a week later, what is their policy? The best tradespeople guarantee their workmanship for a specific period (usually 30 to 90 days for repairs, and up to a year for new installations).</p>
      
      <p>By using the NEED platform, you bypass these worries. We pre-verify all licenses, mandate public portfolios, and collect reviews only from verified paying customers.</p>
    `
  },
  "why-electricians-charge-callout-fees": {
    title: "Why Electricians Charge Call-Out Fees",
    date: "September 28, 2026",
    content: `
      <p>A common source of friction between homeowners and tradespeople is the "call-out fee" or "diagnostic fee". It can feel frustrating to pay someone $100 just to look at an outlet and tell you it's broken. However, understanding the economics of professional trades work explains why this fee is absolutely necessary for reputable businesses.</p>
      
      <h3>The Cost of Doing Business</h3>
      <p>When an electrician drives to your house, they are incurring significant costs before they even step out of their van. These include fuel, vehicle maintenance, commercial auto insurance, and most importantly, time. The travel time to and from your house is time they cannot spend actively working on another paying job.</p>
      
      <h3>Diagnosis is the Hardest Part</h3>
      <p>In electrical work, replacing a switch might take five minutes, but figuring out *which* switch is causing the short circuit across the entire house can take an hour of meticulous testing. The call-out fee compensates the professional for their diagnostic expertise.</p>

      <h3>Weeding Out Unserious Inquiries</h3>
      <p>Call-out fees protect tradespeople from driving 45 minutes for a job that turns out to be "I forgot to plug the lamp in." It ensures that the customer is serious about having professional work done.</p>

      <p>At NEED, our artisans set their own clear call-out fees upfront. You'll always know exactly what you are paying before the technician arrives, ensuring absolute transparency.</p>
    `
  },
  "diy-vs-professional-carpentry": {
    title: "DIY vs. Professional Carpentry: When to Call a Pro",
    date: "September 15, 2026",
    content: `
      <p>The rise of YouTube tutorials and home improvement shows has convinced many homeowners that they can tackle any project with a drill and some enthusiasm. While DIY is fantastic for small projects, knowing when to call a professional carpenter is crucial for the safety and value of your home.</p>
      
      <h3>When to DIY</h3>
      <p>Building a basic bookshelf, installing pre-fabricated floating shelves, or assembling flat-pack furniture are perfect DIY projects. If the project fails, the only things damaged are your ego and perhaps a few books. The risk is incredibly low.</p>
      
      <h3>When to Call a Professional</h3>
      <p>Anything involving structural integrity, weight-bearing elements, or complex joinery requires a professional. Installing kitchen cabinets, building a deck, framing a new wall, or repairing structural rot are not DIY-friendly tasks.</p>

      <h3>The True Cost of Mistakes</h3>
      <p>A poorly built deck isn't just an eyesore; it's a massive liability that can lead to severe injuries. Furthermore, unpermitted or incorrectly executed structural work can significantly devalue your home when it comes time to sell, as home inspectors will flag the shoddy craftsmanship.</p>

      <p>When you're ready to hire a professional, the NEED app connects you with vetted carpenters who have the tools, experience, and insurance to do the job right the first time.</p>
    `
  }
};

export default function BlogPost({ params }: { params: { slug: string } }) {
  const post = POSTS[params.slug];

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <PublicHeader />
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 md:py-20">
        <div className="text-sm font-bold text-gray-500 mb-4 bg-white inline-block px-2 py-1 brutal-border">
          Published: {post.date}
        </div>
        
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-12 leading-none">
          {post.title}
        </h1>
        
        <div 
          className="prose prose-xl max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-p:font-medium prose-p:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </main>
      <Footer />
    </div>
  );
}

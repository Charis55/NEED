import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { notFound } from "next/navigation";

const POSTS: Record<string, { title: string; date: string; content: string }> = {
  "top-5-ways-to-hire-plumber": {
    title: "The Top 5 Ways to Hire a Reliable Plumber",
    date: "October 12, 2026",
    content: `
      <p>Hiring a plumber shouldn't be a gamble, but for many homeowners, it often feels like one. Water damage is incredibly expensive, so when a pipe bursts or a drain clogs, the instinct is to call the first number you see online. However, taking just a few extra minutes to verify your professional can save you thousands of dollars in the long run. In this comprehensive guide, we will break down the top five ways to ensure you are hiring a reliable, honest, and skilled plumber for your home.</p>
      
      <h3 class="text-2xl mt-8 mb-4">1. Check for State Licensing and Insurance</h3>
      <p>This is non-negotiable. Every plumber entering your home should be fully licensed to operate in your jurisdiction and carry both liability insurance and worker's compensation. If they accidentally flood your kitchen and don't have insurance, you could be on the hook for the damages. Licensing requirements vary by state, but generally, a licensed plumber has completed thousands of hours of apprenticeship and passed rigorous exams. Always ask for their license number and verify it on your local government's website. If a contractor hesitates to provide this information, walk away immediately.</p>
      
      <h3 class="text-2xl mt-8 mb-4">2. Look at Past Work Portfolios</h3>
      <p>A good plumber is proud of their work. Ask to see photos of their previous jobs. While pipe work isn't always glamorous to the untrained eye, clean solder joints, neatly run PEX lines, and properly installed traps are signs of a professional who takes their craft seriously. A tradesperson who takes the time to make the hidden parts of your house look neat is someone who isn't cutting corners. On the NEED platform, every artisan is required to maintain a public portfolio of their completed jobs, so you can see their craftsmanship before you even initiate a conversation.</p>

      <h3 class="text-2xl mt-8 mb-4">3. Read Verified Reviews</h3>
      <p>Word of mouth is great, but verified reviews tied to actual completed jobs are better. In today's digital age, fake reviews are a massive problem on traditional directory sites. Look for patterns in the reviews. Does the plumber frequently show up late? Do they leave the work area messy? Are there complaints about surprise fees added to the final bill? These are major red flags. NEED solves this by only allowing reviews from customers who have successfully paid for and completed a job through our secure escrow system.</p>

      <h3 class="text-2xl mt-8 mb-4">4. Get a Clear, Written Estimate Upfront</h3>
      <p>Reputable plumbers will give you a clear, written estimate before starting any work. While unforeseen issues can arise once walls are opened (such as discovering extensive water rot behind drywall), the baseline cost for the call-out, the hourly rate, and the estimated materials should never be a surprise. Be extremely wary of contractors who give vague verbal estimates or ask for large amounts of cash upfront before any tools have been brought into the house.</p>

      <h3 class="text-2xl mt-8 mb-4">5. Ask About Warranties and Guarantees</h3>
      <p>If a repair fails a week later, what is their policy? The best tradespeople guarantee their workmanship for a specific period. Usually, you should expect a 30 to 90-day warranty on basic repairs, and up to a year or more for new installations (like a new water heater or whole-house repipe). A plumber who refuses to guarantee their work is telling you that they don't trust their own skills.</p>
      
      <div class="bg-[var(--color-brutal-yellow)] p-6 mt-8 brutal-border text-black">
        <h4 class="text-xl font-black uppercase mb-2">The NEED Advantage</h4>
        <p class="m-0">By using the NEED platform, you completely bypass these traditional worries. We pre-verify all licenses, mandate public portfolios, and collect reviews only from verified paying customers. Our transparent pricing engine ensures you know exactly what you'll pay before the job starts. <a href="/login?mode=signup" class="font-bold underline hover:text-[var(--color-brutal-pink)]">Sign up today to find a verified plumber in your neighborhood.</a></p>
      </div>
    `
  },
  "why-electricians-charge-callout-fees": {
    title: "Why Electricians Charge Call-Out Fees",
    date: "September 28, 2026",
    content: `
      <p>A common source of friction between homeowners and tradespeople is the dreaded "call-out fee" or "diagnostic fee". It can feel incredibly frustrating to pay someone $100 to $150 just to look at an outlet, spend five minutes testing it, and tell you it's broken. However, understanding the underlying economics of professional trades work explains exactly why this fee is absolutely necessary for reputable businesses to survive.</p>
      
      <h3 class="text-2xl mt-8 mb-4">The True Cost of Doing Business</h3>
      <p>When an electrician drives to your house, they are incurring significant costs before they even step out of their van. These include fuel, vehicle maintenance, commercial auto insurance, tool depreciation, and most importantly, time. The travel time to and from your house (which can easily eat up an hour of the day in city traffic) is time they cannot spend actively working on another paying job. The call-out fee ensures that they don't operate at a loss just for showing up.</p>
      
      <h3 class="text-2xl mt-8 mb-4">Diagnosis is the Hardest Part</h3>
      <p>In electrical work, replacing a light switch might literally take five minutes of physical labor. But figuring out *which* switch is causing the short circuit across the entire house, or why a breaker keeps tripping randomly at 2 AM, can take an hour of meticulous testing with expensive multimeters and thermal cameras. The call-out fee compensates the professional for their diagnostic expertise and the thousands of hours they spent learning how to identify invisible electrical faults safely.</p>

      <h3 class="text-2xl mt-8 mb-4">Weeding Out Unserious Inquiries</h3>
      <p>Call-out fees protect tradespeople from driving 45 minutes for a job that turns out to be "I forgot to plug the lamp in" or "the lightbulb was just burned out." By requiring a fee just to dispatch a truck, it ensures that the customer is serious about having professional work done and respects the technician's time.</p>

      <h3 class="text-2xl mt-8 mb-4">Free Estimates vs. Diagnostic Fees</h3>
      <p>Many homeowners confuse "free estimates" with "free diagnostics." A free estimate is usually for a massive, planned project (like rewiring a whole house or installing a new electrical panel). A diagnostic fee applies when something is actively broken and the technician has to use their skills to figure out *why* it's broken before they can even give you an estimate to fix it.</p>

      <div class="bg-[var(--color-brutal-teal)] p-6 mt-8 brutal-border text-black">
        <h4 class="text-xl font-black uppercase mb-2">Transparency is Key</h4>
        <p class="m-0">At NEED, our artisans set their own clear call-out fees upfront on their public profiles. You will always know exactly what you are paying just to get them to your door before the technician arrives. No surprises, no hidden fees, just absolute transparency.</p>
      </div>
    `
  },
  "diy-vs-professional-carpentry": {
    title: "DIY vs. Professional Carpentry: When to Call a Pro",
    date: "September 15, 2026",
    content: `
      <p>The meteoric rise of YouTube tutorials, TikTok hacks, and home improvement television shows has convinced many enthusiastic homeowners that they can tackle almost any project with a cordless drill and a positive attitude. While the DIY route is fantastic for small, low-stakes projects, knowing exactly when to put down the hammer and call a professional carpenter is crucial for the safety, aesthetics, and overall value of your home.</p>
      
      <h3 class="text-2xl mt-8 mb-4">When to DIY: The Low-Stakes Projects</h3>
      <p>Building a basic bookshelf for your garage, installing pre-fabricated floating shelves from IKEA, or assembling flat-pack furniture are perfect weekend DIY projects. If the project fails, the only things damaged are your ego and perhaps a few cheap books. The risk is incredibly low, and the satisfaction of building something with your own hands is highly rewarding. Basic trim work (like replacing a section of baseboard) is also a great place for beginners to practice their miter saw skills.</p>
      
      <h3 class="text-2xl mt-8 mb-4">When to Call a Professional: Structural Integrity</h3>
      <p>Anything involving the structural integrity of your home, weight-bearing elements, or complex, visible joinery absolutely requires a professional. Framing a new wall, removing an existing wall, or repairing structural rot in floor joists are not DIY-friendly tasks. A mistake here can literally bring the house down around you. Professional framing carpenters understand load paths, shear strength, and local building codes that the average homeowner doesn't even know exist.</p>

      <h3 class="text-2xl mt-8 mb-4">The Complexity of Custom Cabinetry</h3>
      <p>Building and installing custom kitchen cabinets is an art form that takes years to master. Walls in homes are almost never perfectly straight or plumb. A professional finish carpenter knows how to scribe cabinets to imperfect walls, adjust hinges for microscopic alignment, and apply crown molding that joins seamlessly at complex angles. DIY cabinets often look exactly like DIY cabinets—crooked, gappy, and misaligned.</p>

      <h3 class="text-2xl mt-8 mb-4">The True Cost of Mistakes</h3>
      <p>A poorly built outdoor deck isn't just an eyesore; it's a massive liability that can lead to severe injuries or death if it collapses during a family barbecue. Furthermore, unpermitted or incorrectly executed structural work can significantly devalue your home when it comes time to sell, as home inspectors will immediately flag the shoddy craftsmanship and require you to pay a professional to tear it out and do it right anyway.</p>

      <div class="bg-[var(--color-brutal-pink)] p-6 mt-8 brutal-border text-black">
        <h4 class="text-xl font-black uppercase mb-2">Hire the Best on NEED</h4>
        <p class="m-0">When you're ready to stop risking your home's value and hire a professional, the NEED app connects you with vetted, master carpenters who have the heavy-duty tools, years of experience, and liability insurance to do the job right the first time. Browse portfolios and hire a pro today.</p>
      </div>
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

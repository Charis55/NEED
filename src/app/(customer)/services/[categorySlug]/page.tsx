import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import BackButton from "@/components/BackButton";

export default function SubcategoryPage({ params }: { params: { categorySlug: string } }) {
  // Title case the category slug
  const title = params.categorySlug.charAt(0).toUpperCase() + params.categorySlug.slice(1);

  // Mock data for the sub-services based on the mockup
  const subServices = [
    {
      id: "appliances",
      title: "Appliances",
      description: "TV, refrigerator, coffee machine, microwave oven, oven, lamp, laptop, phone, vacuum cleaner"
    },
    {
      id: "plumbing",
      title: "Plumbing",
      description: "Sink clogged, bathroom clogged, toilet clogged, pipe sealing, pipe welding, plumbing installation, water heater installation"
    },
    {
      id: "furniture",
      title: "Furniture",
      description: "Furniture repair, furniture cleaning, upholstering of upholstered furniture, restoration of wooden furniture"
    }
  ];

  return (
    <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Top Header */}
      <div className="px-6 pt-12 pb-8 flex-shrink-0 bg-[var(--color-brutal-blue)] border-b-4 border-black brutal-shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <BackButton className="bg-white text-black brutal-border brutal-shadow-sm hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all w-10 h-10 flex items-center justify-center p-0" />
          <button className="w-12 h-12 bg-white brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none">
            <Search className="w-6 h-6 text-black stroke-[3]" />
          </button>
        </div>
        
        <h1 className="text-5xl font-black text-black mb-4 uppercase tracking-tighter">
          {title}
        </h1>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-[var(--color-brutal-bg)] px-6 pt-10 pb-20 overflow-y-auto">
        <div className="flex flex-col gap-6">
          {subServices.map((service) => (
            <div 
              key={service.id} 
              className="bg-white p-6 brutal-card flex flex-col relative hover:-translate-y-1 transition-transform"
            >
              <h2 className="text-3xl font-black text-black mb-2 uppercase tracking-tighter">{service.title}</h2>
              <p className="text-black font-bold text-sm leading-relaxed mb-8 border-l-4 border-black pl-3">
                {service.description}
              </p>
              
              <div className="flex justify-end mt-auto">
                <Link 
                  href={`/services/${params.categorySlug}/${service.id}/swipe`}
                  className="flex items-center gap-3 bg-[var(--color-brutal-yellow)] px-4 py-3 brutal-btn"
                >
                  <span className="text-sm">FIND A TECHNICIAN</span>
                  <ArrowRight className="w-5 h-5 stroke-[3]" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Search, ChevronLeft, ArrowRight } from "lucide-react";

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
    <div className="bg-[#111111] min-h-screen flex flex-col">
      {/* Top Black Header */}
      <div className="px-6 pt-12 pb-8 flex-shrink-0">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-900 shadow-sm">
            <Search className="w-5 h-5" />
          </button>
        </div>
        
        <h1 className="text-4xl font-bold text-white mb-4">
          {title}
        </h1>
      </div>

      {/* Main Content Area (White Rounded Container) */}
      <div className="flex-1 bg-gray-50 rounded-t-[40px] px-6 pt-10 pb-20 overflow-y-auto">
        <div className="flex flex-col gap-6">
          {subServices.map((service) => (
            <div 
              key={service.id} 
              className="bg-white rounded-[32px] p-6 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col relative"
            >
              {/* Fake offset shadow aesthetic from the mockup */}
              <div className="absolute -bottom-2 -right-2 w-full h-full bg-black rounded-[32px] -z-10 opacity-10"></div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{service.title}</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                {service.description}
              </p>
              
              <div className="flex justify-end mt-auto">
                <Link 
                  href={`/services/${params.categorySlug}/${service.id}/swipe`}
                  className="flex items-center gap-3 font-bold text-gray-900 hover:opacity-80 transition group"
                >
                  <span className="text-sm">Choose an Artisan</span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-400 flex items-center justify-center text-gray-900 group-hover:scale-110 transition-transform shadow-md shadow-emerald-400/30">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

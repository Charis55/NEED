import ArtisanOnboarding from "@/components/ArtisanOnboarding";
import Link from "next/link";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8 text-center">
        <Link href="/" className="text-3xl font-extrabold text-blue-600">
          Artisan Marketplace
        </Link>
      </div>

      <div className="sm:mx-auto w-full max-w-2xl px-4">
        <ArtisanOnboarding />
      </div>
    </div>
  );
}

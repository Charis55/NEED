import PhoneAuth from "@/components/PhoneAuth";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8 text-center">
        <Link href="/" className="text-3xl font-extrabold text-blue-600">
          Artisan Marketplace
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to your account
        </h2>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <PhoneAuth />
      </div>
    </div>
  );
}

import AuthForm from "@/components/AuthForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <AuthForm />
    </div>
  );
}

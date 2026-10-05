import { Metadata } from 'next';
import TechnicianRoutingWrapper from './TechnicianRoutingWrapper';
import BackButton from '@/components/BackButton';

export const metadata: Metadata = {
  title: 'Navigate to Customer | NEED',
};

export default async function TechnicianNavigatePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = await params;
  const jobId = unwrappedParams.id;

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <div className="px-6 pt-12 pb-6 flex items-center gap-4 bg-[var(--color-brutal-teal)] border-b-4 border-black shadow-[0_4px_0_0_#000] sticky top-0 z-40">
        <BackButton className="bg-white text-black brutal-border hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all w-10 h-10 flex items-center justify-center p-0 shrink-0" />
        <h1 className="text-2xl font-black text-black uppercase tracking-tighter leading-none truncate flex-1">
          ROUTE TO CUSTOMER
        </h1>
      </div>

      <div className="px-6 md:px-12 py-8 max-w-5xl mx-auto flex flex-col lg:flex-row gap-8 h-full">
        <TechnicianRoutingWrapper jobId={jobId} />
      </div>
    </div>
  );
}

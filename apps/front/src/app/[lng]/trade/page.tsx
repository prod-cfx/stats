import { Suspense } from 'react';
import TradingPageClient from './TradingPageClient';

export default function TradingPage() {
  return (
    <Suspense fallback={<TradingPageSkeleton />}>
      <TradingPageClient />
    </Suspense>
  );
}

function TradingPageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-[#c9d1d9] overflow-hidden animate-pulse">
      <div className="h-14 bg-[#161b22] border-b border-[#30363d]" />
      <div className="h-14 bg-[#0d1117] border-b border-[#30363d]" />
      <div className="flex-1 flex overflow-hidden p-4 md:p-8">
        <div className="w-full max-w-[1440px] mx-auto flex overflow-hidden gap-4">
          <div className="w-[280px] flex-none bg-[#161b22] rounded-lg" />
          <div className="flex-1 bg-[#161b22] rounded-lg" />
          <div className="w-[320px] flex-none bg-[#161b22] rounded-lg" />
        </div>
      </div>
      <div className="h-28 bg-[#0d1117] border-t border-[#30363d]" />
    </div>
  );
}

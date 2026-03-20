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
    <div className="flex flex-col min-h-screen bg-[color:var(--cf-bg)] text-[color:var(--cf-text)] overflow-hidden animate-pulse">
      <div className="h-14 bg-[color:var(--cf-surface)] border-b border-[color:var(--cf-border)]" />
      <div className="h-14 bg-[color:var(--cf-bg)] border-b border-[color:var(--cf-border)]" />
      <div className="flex-1 flex overflow-hidden p-4 md:p-8">
        <div className="w-full max-w-[1440px] mx-auto flex overflow-hidden gap-4">
          <div className="w-[280px] flex-none bg-[color:var(--cf-surface)] rounded-lg" />
          <div className="flex-1 bg-[color:var(--cf-surface)] rounded-lg" />
          <div className="w-[320px] flex-none bg-[color:var(--cf-surface)] rounded-lg" />
        </div>
      </div>
      <div className="h-28 bg-[color:var(--cf-bg)] border-t border-[color:var(--cf-border)]" />
    </div>
  );
}

import React, { Suspense } from 'react'
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { DashboardClient } from './DashboardClient'

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-white overflow-hidden">
      <Navbar />

      <main className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8">
        <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="text-[#8b949e]">Loading...</div></div>}>
          <DashboardClient />
        </Suspense>
        <div className="mt-20">
          <Footer />
        </div>
      </main>
    </div>
  );
}

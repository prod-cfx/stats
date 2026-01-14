import React, { Suspense } from 'react'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { DashboardViewClient } from './DashboardViewClient'

export default function DashboardViewPage() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-white overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar">
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="text-[#8b949e]">Loading...</div></div>}>
          <DashboardViewClient />
        </Suspense>
        <div className="mt-20">
          <Footer />
        </div>
      </main>
    </div>
  )
}


import React, { Suspense } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { DashboardViewClient } from './DashboardViewClient'

export default function DashboardViewPage() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-white overflow-hidden">
      <Navbar />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="text-[#8b949e]">Loading...</div></div>}>
        <DashboardViewClient />
      </Suspense>
    </div>
  )
}


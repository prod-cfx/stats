import React from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { DashboardViewClient } from './DashboardViewClient'

export default function DashboardViewPage() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-white overflow-hidden">
      <Navbar />
      <DashboardViewClient />
    </div>
  )
}


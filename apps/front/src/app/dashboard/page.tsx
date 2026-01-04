import React from 'react'
import { Navbar } from '@/components/layout/Navbar';
import { DashboardClient } from './DashboardClient'

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-white overflow-hidden">
      <Navbar />
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <DashboardClient />
      </main>
    </div>
  );
}

import Link from 'next/link'
import React from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { DashboardCanvas } from '@/features/dashboards/components/DashboardCanvas'

export default function DashboardDetailPage({ params }: { params: { lng: string; id: string } }) {
  const { lng, id } = params

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-white overflow-hidden">
      <Navbar />

      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Link
              href={`/${lng}/dashboard`}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              ← 返回看板
            </Link>
            <Link
              href={`/${lng}/dashboard/editor`}
              className="text-sm text-white bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
            >
              编辑
            </Link>
          </div>

          <div className="min-h-[600px] bg-[#0d1117] rounded-xl border border-[#30363d] p-4 relative">
            <DashboardCanvas dashboardId={id} />
          </div>
        </div>
      </main>
    </div>
  )
}


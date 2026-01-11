import Link from 'next/link'
import React from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { DashboardCanvas } from '@/features/dashboards/components/DashboardCanvas'

// 静态导出模式需要预定义所有动态参数
// 由于看板 ID 是用户动态创建的，使用占位 ID
// 实际页面将通过客户端路由访问
// eslint-disable-next-line react-refresh/only-export-components
export async function generateStaticParams() {
  // 为静态导出提供占位参数，实际数据通过客户端加载
  return [
    { lng: 'zh', id: 'placeholder' },
    { lng: 'en', id: 'placeholder' },
  ]
}

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


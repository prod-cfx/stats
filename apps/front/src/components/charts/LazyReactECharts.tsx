'use client'

import type { EChartsReactProps } from 'echarts-for-react/lib/types'
import dynamic from 'next/dynamic'
import { echarts } from '@/components/charts/echarts-runtime'

const ReactEChartsCore = dynamic(
  async () => {
    const mod = await import('echarts-for-react/lib/core')
    return mod.default
  },
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-[color:var(--cf-surface-2)]" />,
  },
) as React.ComponentType<EChartsReactProps>

export function LazyReactECharts(props: EChartsReactProps) {
  return <ReactEChartsCore {...props} echarts={echarts} />
}

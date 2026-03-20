import type { WidgetType } from '../widgets/widgets.catalog'
import { useEffect, useState } from 'react'

interface State {
  loading: boolean
  data: any
  error: string | null
}

function fakeDelay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function useWidgetMockData(type: WidgetType, config: Record<string, any>): State {
  const [state, setState] = useState<State>({ loading: true, data: null, error: null })

  useEffect(() => {
    let alive = true
    ;(async () => {
      setState({ loading: true, data: null, error: null })
      await fakeDelay(250 + Math.random() * 500)

      if (!alive) return

      // 统一返回一些 mock，可按 type 微调
      const base = {
        ts: Date.now(),
        type,
        config,
      }

      // 这里故意不做复杂结构：Phase1 只为验证链路
      setState({ loading: false, data: base, error: null })
    })()

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config 通过 JSON.stringify 深比较，避免对象引用变化导致无限循环
  }, [type, JSON.stringify(config)])

  return state
}


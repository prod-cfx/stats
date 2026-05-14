import type { GridLayoutItem } from '../store/dashboard-store'
import { useEffect, useState } from 'react'

export const DASHBOARD_MOBILE_BREAKPOINT = 768

export function useDashboardMobileLayout() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < DASHBOARD_MOBILE_BREAKPOINT,
  )

  useEffect(() => {
    const read = () => {
      setIsMobile(window.innerWidth < DASHBOARD_MOBILE_BREAKPOINT)
    }
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  return isMobile
}

export function sortLayoutForMobile<T extends GridLayoutItem>(layout: T[]) {
  return [...layout]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const y = Number(a.item.y ?? 0) - Number(b.item.y ?? 0)
      if (y !== 0) return y
      const x = Number(a.item.x ?? 0) - Number(b.item.x ?? 0)
      if (x !== 0) return x
      return a.index - b.index
    })
    .map(({ item }) => item)
}

export function mobileWidgetMinHeight(layout: Pick<GridLayoutItem, 'h'>) {
  const h = Number(layout.h || 3)
  return Math.max(180, Math.min(420, h * 52))
}

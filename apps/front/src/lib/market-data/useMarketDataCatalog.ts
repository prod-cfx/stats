'use client'

import type { MarketDataCatalogItem } from './catalog-types'
import { useEffect, useMemo, useState } from 'react'
import { fetchMarketDataCatalog } from './catalog-api'

export function useMarketDataCatalog() {
  const [items, setItems] = useState<MarketDataCatalogItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchMarketDataCatalog()
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const byId = useMemo(() => {
    const map = new Map<string, MarketDataCatalogItem>()
    for (const item of items || []) map.set(item.id, item)
    return map
  }, [items])

  return { items: items || [], loading, byId }
}



'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchWhaleTradesRealtime } from '@/lib/api'

const REFRESH_SECONDS = 5

export interface RealtimeRow {
  rowKey: string
  address: string
  symbol: string
  positionValueUsd: number
  positionValueText: string
  entryPriceText: string
  timestamp: number
}

interface RealtimeWhaleTradeItem {
  user_address: string
  symbol: string
  trade_time: string
  trade_value_usd: number | string
  price: number | string
}

function createRowKey(item: RealtimeWhaleTradeItem): string {
  return [
    item.user_address,
    item.symbol,
    item.trade_time,
    item.trade_value_usd,
    item.price,
  ].join(':')
}

function mapTradeToRow(item: RealtimeWhaleTradeItem): RealtimeRow {
  const tradeValue = Number(item.trade_value_usd)
  const price = Number(item.price)
  const timestamp = new Date(item.trade_time).getTime()

  return {
    rowKey: createRowKey(item),
    address: item.user_address,
    symbol: item.symbol,
    positionValueUsd: Number.isFinite(tradeValue) ? tradeValue : 0,
    positionValueText: Number.isFinite(tradeValue)
      ? `$ ${tradeValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
      : '$ -',
    entryPriceText: Number.isFinite(price)
      ? `$ ${price.toLocaleString('en-US', { maximumFractionDigits: 1 })}`
      : '$ -',
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
  }
}

export function useRealtimeWhaleTrades(onLoadError: () => void) {
  const [rows, setRows] = useState<RealtimeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_SECONDS)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchWhaleTradesRealtime({ limit: 50 })
      setRows((list as RealtimeWhaleTradeItem[]).map(mapTradeToRow))
    } catch {
      onLoadError()
    } finally {
      setLoading(false)
    }
  }, [onLoadError])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (isPaused) return

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          void fetchRows()
          return REFRESH_SECONDS
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchRows, isPaused])

  return {
    rows,
    loading,
    isPaused,
    countdown,
    setIsPaused,
    fetchRows,
  }
}

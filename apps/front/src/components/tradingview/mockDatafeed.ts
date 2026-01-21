/**
 * TradingView Charting Library - Mock Datafeed
 *
 * 目标：
 * - 先用 mock K 线数据跑通 Charting Library（商业版）
 * - 后端数据准备好后，只需要把 getBars() 改成真实请求并映射成 bars 即可（无痛替换）
 *
 * ✅ 真实后端接入点：mockDatafeed.getBars() 里 TODO 标注的位置。
 *
 * 注意：
 * - 不要 import charting_library 代码（它是静态资源，通过 <script> 加载到 window.TradingView）
 */

export type TvResolution = '1' | '5' | '15' | '60' | '240' | '1D'

export interface TvBar {
  time: number // 毫秒时间戳
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface OnReadyCallback {
  (config: { supported_resolutions: TvResolution[] }): void
}

interface ResolveCallback {
  (symbolInfo: Record<string, unknown>): void
}

interface ErrorCallback {
  (reason: string): void
}

interface BarsCallback {
  (bars: TvBar[], meta: { noData?: boolean }): void
}

interface PeriodParams {
  from: number // 秒
  to: number // 秒
  firstDataRequest: boolean
  countBack?: number
}

const SUPPORTED_RESOLUTIONS: TvResolution[] = ['1', '5', '15', '60', '240', '1D']

function resolutionToMs(resolution: string): number | null {
  if (resolution === '1D') return 24 * 60 * 60 * 1000
  const minutes = Number(resolution)
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  return minutes * 60 * 1000
}

function resolutionToBaseVolume(resolution: string): number {
  // 让不同周期的量级更合理（mock 用），避免“全都一样高 / 数额太小”
  switch (resolution) {
    case '1':
      return 220
    case '5':
      return 650
    case '15':
      return 1800
    case '60':
      return 7000
    case '240':
      return 22000
    case '1D':
      return 90000
    default:
      return 1800
  }
}

// 简单 deterministic RNG（避免每次刷新完全不一样，便于调试）
function createRng(seed: number) {
  let s = seed >>> 0
  return () => {
    // LCG
    s = (1664525 * s + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const mockDatafeed = {
  onReady(cb: OnReadyCallback) {
    // Charting Library 期望异步回调
    setTimeout(() => {
      cb({
        supported_resolutions: SUPPORTED_RESOLUTIONS,
      })
    }, 0)
  },

  // Charting Library 会在符号搜索/对比等场景调用；mock 先返回空列表即可（避免 console 报错刷屏）
  searchSymbols(
    _userInput: string,
    _exchange: string,
    _symbolType: string,
    onResult: (items: unknown[]) => void,
  ) {
    setTimeout(() => {
      onResult([])
    }, 0)
  },

  resolveSymbol(symbolName: string, onResolve: ResolveCallback, onError: ErrorCallback) {
    try {
      const ticker = symbolName.toUpperCase()
      // TradingView 要求 resolveSymbol 结果必须异步返回（否则会在控制台报错）
      setTimeout(() => {
        onResolve({
          name: ticker,
          ticker,
          description: `${ticker} (mock)`,
          type: 'crypto',
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: 'MOCK',
          listed_exchange: 'MOCK',

          // 价格精度：两位小数（pricescale=100）
          pricescale: 100,
          minmov: 1,

          has_intraday: true,
          has_daily: true,
          has_volume: true,
          supported_resolutions: SUPPORTED_RESOLUTIONS,

          // volume 精度可根据需要调整
          volume_precision: 2,
          data_status: 'streaming',
        })
      }, 0)
    } catch (e) {
      onError((e as Error)?.message || 'resolveSymbol failed')
    }
  },

  getBars(
    symbolInfo: Record<string, unknown>,
    resolution: string,
    periodParams: PeriodParams,
    onResult: BarsCallback,
    onError: ErrorCallback,
  ) {
    const stepMs = resolutionToMs(resolution)
    if (!stepMs || !SUPPORTED_RESOLUTIONS.includes(resolution as TvResolution)) {
      onError(`Unsupported resolution: ${resolution}`)
      return
    }

    try {
      // TODO(backend): 替换为真实后端 K 线接口
      // 例如：
      // const url = `/api/market/kline?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${periodParams.from}&to=${periodParams.to}`
      // const resp = await fetch(url)
      // const data = await resp.json()
      // const bars = data.map(mapToTradingViewBars)
      // onResult(bars, { noData: bars.length === 0 })

      const symbol = String((symbolInfo as any)?.ticker || (symbolInfo as any)?.name || 'BTCUSDT')
      const rng = createRng(hashString(`${symbol}|${resolution}`))

      const toMs = Number.isFinite(periodParams?.to) ? periodParams.to * 1000 : Date.now()
      const alignedToMs = Math.floor(toMs / stepMs) * stepMs
      const count = 200
      const startMs = alignedToMs - stepMs * (count - 1)

      // 从一个“合理”的基准价开始
      let lastClose = 50000 + Math.floor(rng() * 5000)
      const baseVol = resolutionToBaseVolume(resolution)

      const bars: TvBar[] = []
      for (let i = 0; i < count; i++) {
        const time = startMs + i * stepMs

        // 生成一个小波动的 OHLC
        const drift = (rng() - 0.5) * 80
        const open = lastClose
        const close = Math.max(1, open + drift)
        const high = Math.max(open, close) + rng() * 50
        const low = Math.max(1, Math.min(open, close) - rng() * 50)

        // 生成更“像成交量”的 volume：有日内节律 + 与价格波动相关 + 少量噪声
        // 目标（15m）：大致 1k~5k，方便显示为 K 且柱高明显不同
        const move = Math.abs(close - open)
        const season = 1 + Math.sin(i / 14) * 0.35 + Math.sin(i / 5) * 0.12
        const noise = (rng() - 0.5) * baseVol * 0.25
        const vol = Math.max(1, baseVol * season + move * (baseVol / 40) + noise)
        const volume = Math.round(vol * 100) / 100

        bars.push({
          time, // 毫秒
          open: Math.round(open * 100) / 100,
          high: Math.round(high * 100) / 100,
          low: Math.round(low * 100) / 100,
          close: Math.round(close * 100) / 100,
          volume,
        })

        lastClose = close
      }

      // 如果 periodParams.from/to 很窄，过滤到范围内（同时保证至少返回一些数据）
      const fromMs = Number.isFinite(periodParams?.from) ? periodParams.from * 1000 : startMs
      const filtered = bars.filter(b => b.time >= fromMs && b.time <= alignedToMs)

      onResult(filtered.length ? filtered : bars, { noData: false })
    } catch (e) {
      onError((e as Error)?.message || 'getBars failed')
    }
  },

  subscribeBars() {
    // mock：暂不推实时数据
  },

  unsubscribeBars() {
    // mock：暂不推实时数据
  },
}


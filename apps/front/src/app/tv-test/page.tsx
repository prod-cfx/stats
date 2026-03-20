import { TradingViewChart } from '@/components/tradingview/TradingViewChart'

export default function TvTestPage() {
  // 注意：这是纯测试页面，不接入现有生产页面结构（例如 [lng] 路由与业务布局）。
  // 目标是先用 mock datafeed 跑通 TradingView Charting Library，后续无痛替换为真实 API。
  return (
    <div className="h-[80vh] w-full">
      <TradingViewChart />
    </div>
  )
}


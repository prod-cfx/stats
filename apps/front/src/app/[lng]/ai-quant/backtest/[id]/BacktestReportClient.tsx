'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

// --- Types ---
interface BacktestReportProps {
  lng: string
  id: string
  symbol: string
  rangeDisplay: string
  metrics: {
    maxDrawdownPct: number
    totalReturnPct: number
    winRatePct: number
    tradeCount: number
  }
}

// --- 1. Strategy Conclusion Card ---
function StrategyConclusionCard({ status, summary, onDeploy, lng }: { status: 'good' | 'warning' | 'danger', summary: string, onDeploy: () => void, lng: string }) {
  const statusConfig = {
    good: { color: 'var(--cf-primary)', icon: '🟢', bgGlow: 'bg-[color:var(--cf-primary)]/10', border: 'border-[color:var(--cf-border)]', shadow: 'shadow-[0_0_10px_var(--cf-primary)]', btnClass: 'from-primary to-secondary bg-gradient-to-r text-white' },
    warning: { color: '#F5A623', icon: '🟡', bgGlow: 'bg-[#F5A623]/10', border: 'border-[color:var(--cf-border)]', shadow: 'shadow-[0_0_10px_#F5A623]', btnClass: 'bg-gradient-to-r from-[#F5A623] to-[#D48806] text-white' },
    danger: { color: '#FF4D4F', icon: '🔴', bgGlow: 'bg-[#FF4D4F]/10', border: 'border-[color:var(--cf-border)]', shadow: 'shadow-[0_0_10px_#FF4D4F]', btnClass: 'bg-gradient-to-r from-[#FF4D4F] to-[#CF1322] text-white' }
  }
  const config = statusConfig[status]

  return (
        <div className={`relative overflow-hidden bg-[color:var(--cf-surface)] border ${config.border} rounded-[16px] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
      <div className={`absolute left-0 top-0 w-32 h-full ${config.bgGlow} blur-3xl pointer-events-none`}></div>
      
      <div className="flex items-center gap-4 relative z-10">
        <div className={`w-3 h-3 rounded-full ${config.shadow}`} style={{ backgroundColor: config.color }}></div>
        <h2 className="text-base font-medium text-[color:var(--cf-text)]">{summary}</h2>
      </div>

      <button 
        onClick={onDeploy}
        className={`relative z-10 px-8 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity ${config.btnClass}`}
      >
        {lng === 'en' ? 'One-Click Deploy' : '一键部署'}
      </button>
    </div>
  )
}

// --- 2. Core Metrics Grid ---
function MetricCard({ title, value, trend, isPrimary = false }: { title: string, value: string, trend?: 'up' | 'down' | 'neutral', isPrimary?: boolean }) {
  const colorClass = trend === 'up' ? 'text-[color:var(--cf-primary)]' : trend === 'down' ? 'text-[#FF4D4F]' : 'text-[color:var(--cf-text-strong)]'
  
  return (
    <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-[16px] p-6 backdrop-blur-sm transition-all duration-300 hover:bg-[color:var(--cf-surface-hover)]">
      <p className="text-sm text-[color:var(--cf-muted)] font-medium">{title}</p>
      <p className={`mt-2 text-[28px] md:text-[32px] font-bold tracking-tight ${colorClass}`}>
        {value}
      </p>
    </div>
  )
}

// --- 3. Equity Curve Chart ---
function EquityCurveChart({ lng }: { lng: string }) {
  // Add a state to force re-render when theme changes
  const [themeTick, setThemeTick] = useState(0)

  // Listen for theme changes
  React.useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme') {
          setThemeTick(t => t + 1)
        }
      })
    })
    
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  const data = useMemo(() => {
    // Generate some realistic-looking mock data
    const dataCount = 100
    const result = []
    
    let currentEquity = 10000
    let peakEquity = 10000
    const now = new Date()
    
    for (let i = 0; i < dataCount; i++) {
      const date = new Date(now.getTime() - (dataCount - i) * 24 * 60 * 60 * 1000)
      const timeStr = `${date.getMonth() + 1}-${date.getDate()}`
      
      // Random walk with upward drift
      const change = (Math.random() - 0.45) * 300
      currentEquity += change
      
      if (currentEquity > peakEquity) {
        peakEquity = currentEquity
      }
      
      const drawdown = currentEquity < peakEquity 
        ? -((peakEquity - currentEquity) / peakEquity) * 100 
        : 0
      
      result.push({
        time: timeStr,
        equity: Number(currentEquity.toFixed(2)),
        drawdown: Number(drawdown.toFixed(2))
      })
    }
    return result
  }, [])

  if (!data || data.length === 0) {
    return (
      <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-[16px] p-6 backdrop-blur-sm flex items-center justify-center h-[480px]">
        <p className="text-[color:var(--cf-muted)]">{lng === 'en' ? 'No backtest data available' : '暂无回测数据'}</p>
      </div>
    )
  }

  const equityValues = data.map(d => d.equity)
  const minEquity = Math.min(...equityValues) * 0.98
  const maxEquity = Math.max(...equityValues) * 1.02
  
  const drawdownValues = data.map(d => d.drawdown)
  // Ensure the min drawdown is at least -10% for better visual scale, but can go deeper if needed
  const minDrawdown = Math.min(Math.min(...drawdownValues) * 1.1, -10)

  let isDark = true
  if (typeof document !== 'undefined') {
    isDark = document.documentElement.classList.contains('dark') || 
             document.documentElement.getAttribute('data-theme') === 'dark' ||
             getComputedStyle(document.documentElement).getPropertyValue('color-scheme') === 'dark'
  }

  const textColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'
  const xAxisTextColor = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)'
  const splitLineColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const tooltipBg = isDark ? 'rgba(20,20,20,0.9)' : 'rgba(255,255,255,0.9)'
  const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const tooltipText = isDark ? '#fff' : '#000'

  return (
    <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-[16px] p-6 backdrop-blur-sm">
      <h3 className="text-base font-medium text-[color:var(--cf-text-strong)] mb-6">{lng === 'en' ? 'Equity & Backtest Performance' : '净值与回测表现'}</h3>
      <div className="h-[400px] w-full" key={themeTick}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF4D4F" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#FF4D4F" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={splitLineColor} strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="time"
              stroke="transparent"
              tick={{ fill: xAxisTextColor, fontSize: 12 }}
              tickMargin={10}
              minTickGap={30}
            />

            <YAxis
              yAxisId="equity"
              domain={[minEquity, maxEquity]}
              stroke="transparent"
              tick={{ fill: textColor, fontSize: 12 }}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              width={80}
            />
            
            <YAxis
              yAxisId="drawdown"
              orientation="right"
              domain={[minDrawdown, 0]}
              stroke="transparent"
              tick={{ fill: textColor, fontSize: 12 }}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              width={60}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '8px',
                color: tooltipText,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
              itemStyle={{ color: tooltipText }}
              formatter={(value: number, name: string) => {
                if (name === 'equity') return [`$${value.toFixed(2)}`, lng === 'en' ? 'Equity' : '净值']
                if (name === 'drawdown') return [`${value.toFixed(2)}%`, lng === 'en' ? 'Drawdown' : '回撤']
                return [value, name]
              }}
              labelStyle={{ color: textColor, marginBottom: '8px' }}
            />

            {/* 回撤区域 */}
            <Area
              yAxisId="drawdown"
              type="monotone"
              dataKey="drawdown"
              stroke="none"
              fill="url(#drawdownGradient)"
              baseValue={0}
              isAnimationActive={false}
            />

            {/* 净值曲线 */}
            <Line
              yAxisId="equity"
              type="monotone"
              dataKey="equity"
              stroke="#00C087"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#00C087', stroke: tooltipBg, strokeWidth: 2 }}
              isAnimationActive={true}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// --- 4. AI Analysis Panel ---
function AiAnalysisPanel({ lng }: { lng: string }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-[16px] p-6 transition-all duration-300">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">✨</span>
          <h3 className="text-base font-medium text-[color:var(--cf-text-strong)]">{lng === 'en' ? 'AI Insights' : 'AI 深度洞察'}</h3>
        </div>
        <button className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]">
          {expanded ? (lng === 'en' ? 'Collapse' : '收起') : (lng === 'en' ? 'Expand' : '展开')}
        </button>
      </div>
      
      {expanded && (
        <ul className="mt-4 space-y-3 text-sm text-[color:var(--cf-text)] list-disc pl-5">
          <li>
            <p>{lng === 'en' ? 'Profit mainly comes from ' : '盈利主要来源于 '}<span className="text-[color:var(--cf-text-strong)] font-medium">{lng === 'en' ? 'trend markets' : '趋势行情'}</span>{lng === 'en' ? ', capturing 80% of unilateral uptrends.' : '，捕获了 80% 的单边上涨。'}</p>
          </li>
          <li>
            <p>{lng === 'en' ? 'Performs poorly in volatile markets, generating continuous small drawdowns. Consider reducing position size during consolidation.' : '在震荡市场表现较差，产生连续小额回撤，建议在震荡行情中降低仓位。'}</p>
          </li>
          <li>
            <p>{lng === 'en' ? 'Maximum drawdown occurred during periods of extreme market volatility (e.g., around CPI data releases), indicating average resistance to extreme conditions.' : '最大回撤发生在市场剧烈波动期（如 CPI 数据公布前后），说明策略对极端行情的抵抗力一般。'}</p>
          </li>
        </ul>
      )}
    </div>
  )
}

// --- 5. Risk Analysis ---\nfunction RiskCard({ title, data }: { title: string, data: { label: string, value: string }[] }) {\n  // #region agent log\n  React.useEffect(() => {\n    if (typeof window !== \'undefined\') {\n      const h3Element = document.querySelector(\'h3.text-base.font-medium.text-\\[color\\:var\\(--cf-text-strong\\)\'\);\n      if (h3Element) {\n        const computedStyle = window.getComputedStyle(h3Element);\n        fetch(\'http://127.0.0.1:7870/ingest/3da6987d-ca0d-4524-a672-c2ff657176d6\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\',\'X-Debug-Session-Id\':\'fe4860\'},body:JSON.stringify({sessionId:\'fe4860\',location:\'BacktestReportClient.tsx:RiskCard\',message:\'H3 computed margin-bottom\',data:{title,marginBottom:computedStyle.marginBottom},timestamp:Date.now(),runId:\'run4\',hypothesisId:\'H1/H3\'})}).catch(()=>{});\n      }\n      const parentDiv = h3Element?.parentElement;\n      if (parentDiv) {\n        const parentComputedStyle = window.getComputedStyle(parentDiv);\n        fetch(\'http://127.0.0.1:7870/ingest/3da6987d-ca0d-4524-a672-c2ff657176d6\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\',\'X-Debug-Session-Id\':\'fe4860\'},body:JSON.stringify({sessionId:\'fe4860\',location:\'BacktestReportClient.tsx:RiskCard\',message:\'Parent div computed styles\',data:{title,display:parentComputedStyle.display,flexDirection:parentComputedStyle.flexDirection,alignItems:parentComputedStyle.alignItems,justifyContent:parentComputedStyle.justifyContent},timestamp:Date.now(),runId:\'run4\',hypothesisId:\'H3\'})}).catch(()=>{});\n      }\n    }\n  }, [title]);\n  // #endregion\n  return (\n    <div className=\"bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-[16px] p-6 backdrop-blur-sm h-full flex flex-col\">\n      <h3 className=\"text-base font-medium text-[color:var(--cf-text-strong)] mb-6\">{title}</h3>\n      <div className=\"space-y-4\">\n        {data.map((item, idx) => (\n          <div key={idx} className=\"flex justify-between items-center text-sm\">\n            <span className=\"text-[color:var(--cf-muted)]\">{item.label}</span>\n            <span className=\"text-[color:var(--cf-text-strong)] font-medium\">{item.value}</span>\n          </div>\n        ))}\n      </div>\n    </div>\n  )\n}

// --- 5. Risk Analysis ---
function RiskCard({ title, data }: { title: string, data: { label: string, value: string }[] }) {
  return (
    <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-[16px] p-6 backdrop-blur-sm h-full flex flex-col">
      <h3 className="text-base font-medium text-[color:var(--cf-text-strong)] mb-6">{title}</h3>
      <div className="space-y-4 flex-1 flex flex-col justify-center">
        {data.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center text-sm">
            <span className="text-[color:var(--cf-muted)]">{item.label}</span>
            <span className="text-[color:var(--cf-text-strong)] font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- 6. Trade Details Section ---
function TradeDetailsSection({ lng }: { lng: string }) {
  const [filter, setFilter] = useState<'all' | 'profit' | 'loss'>('all')
  const [expanded, setExpanded] = useState(false)

  // Mock trades
  const trades = [
    { id: 1, time: '2023-10-25 14:30', type: lng === 'en' ? 'Buy/Long' : '买入/做多', price: 34500.50, profit: '+2.4%', isProfit: true },
    { id: 2, time: '2023-10-24 09:15', type: lng === 'en' ? 'Sell/Close' : '卖出/平多', price: 33800.00, profit: '-1.2%', isProfit: false },
    { id: 3, time: '2023-10-22 18:45', type: lng === 'en' ? 'Buy/Long' : '买入/做多', price: 32100.20, profit: '+5.1%', isProfit: true },
    { id: 4, time: '2023-10-20 11:00', type: lng === 'en' ? 'Sell/Close' : '卖出/平多', price: 31500.00, profit: '-0.8%', isProfit: false },
    { id: 5, time: '2023-10-18 16:20', type: lng === 'en' ? 'Buy/Long' : '买入/做多', price: 30200.80, profit: '+4.3%', isProfit: true },
  ]

  const filteredTrades = trades.filter(t => {
    if (filter === 'profit') return t.isProfit
    if (filter === 'loss') return !t.isProfit
    return true
  })

  const displayTrades = expanded ? filteredTrades : filteredTrades.slice(0, 3)

  return (
    <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-[16px] p-6 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-base font-medium text-[color:var(--cf-text-strong)]">{lng === 'en' ? 'Trade Details' : '交易明细'}</h3>
        <div className="flex items-center gap-2 bg-[color:var(--cf-bg)] p-1 rounded-lg border border-[color:var(--cf-border)]">
          {(['all', 'profit', 'loss'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === f 
                  ? 'bg-[color:var(--cf-surface-hover)] text-[color:var(--cf-text-strong)] font-medium shadow-sm border border-[color:var(--cf-border)]' 
                  : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
              }`}
            >
              {f === 'all' ? (lng === 'en' ? 'All' : '全部') : f === 'profit' ? (lng === 'en' ? 'Profit' : '盈利') : (lng === 'en' ? 'Loss' : '亏损')}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-[color:var(--cf-muted)] border-b border-[color:var(--cf-border)]">
              <th className="pb-3 font-normal">{lng === 'en' ? 'Time' : '时间'}</th>
              <th className="pb-3 font-normal">{lng === 'en' ? 'Direction' : '方向'}</th>
              <th className="pb-3 font-normal">{lng === 'en' ? 'Price' : '成交价'}</th>
              <th className="pb-3 font-normal text-right">{lng === 'en' ? 'Return' : '收益率'}</th>
            </tr>
          </thead>
          <tbody>
            {displayTrades.map((trade) => (
              <tr key={trade.id} className="border-b border-[color:var(--cf-border)] last:border-0 hover:bg-[color:var(--cf-surface-hover)] transition-colors">
                <td className="py-3 text-[color:var(--cf-text)]">{trade.time}</td>
                <td className="py-3 text-[color:var(--cf-text)]">{trade.type}</td>
                <td className="py-3 text-[color:var(--cf-text)]">${trade.price.toFixed(2)}</td>
                <td className={`py-3 text-right font-medium ${trade.isProfit ? 'text-[color:var(--cf-primary)]' : 'text-[#FF4D4F]'}`}>
                  {trade.profit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredTrades.length > 3 && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 py-2 text-xs text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] transition-colors flex items-center justify-center gap-1"
        >
          {expanded ? (lng === 'en' ? 'Collapse Details' : '收起明细') : (lng === 'en' ? `View More (${filteredTrades.length - 3})` : `查看更多 (${filteredTrades.length - 3})`)}
        </button>
      )}
    </div>
  )
}

// --- Main Page Component ---
export function BacktestReportClient({ lng, symbol, rangeDisplay, metrics }: BacktestReportProps) {
  const handleDeploy = () => {
    // In a real scenario, this would trigger the deploy dialog or API
    alert('部署功能开发中')
  }

  // Determine strategy status based on metrics
  let status: 'good' | 'warning' | 'danger' = 'warning'
  let summary = lng === 'en' ? 'Average performance, consider optimizing parameters before deploying.' : '表现一般，建议优化参数后再部署。'
  
  if (metrics.maxDrawdownPct <= 15 && metrics.totalReturnPct > 20) {
    status = 'good'
    summary = lng === 'en' ? 'Good performance, controllable risk and considerable return, recommended to deploy.' : '策略表现良好，风险可控且收益可观，建议部署。'
  } else if (metrics.maxDrawdownPct > 30 || metrics.totalReturnPct < 0) {
    status = 'danger'
    summary = lng === 'en' ? 'High risk or in loss, not recommended to deploy.' : '策略风险较高或处于亏损状态，不建议部署。'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">{lng === 'en' ? 'Backtest Analysis Report' : '回测分析报告'}</h1>
          <p className="mt-1 text-sm text-[color:var(--cf-muted)]">
            {symbol} · {rangeDisplay}
          </p>
        </div>
        <Link
          href={`/${lng}/ai-quant`}
          className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] hover:bg-[color:var(--cf-surface-hover)] transition-colors px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
        >
          {lng === 'en' ? 'Back to AI Quant' : '返回 AI量化'}
        </Link>
      </div>

      {/* 1. 策略结论区 */}
      <StrategyConclusionCard status={status} summary={summary} onDeploy={handleDeploy} lng={lng} />

      {/* 2. 核心指标卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          title={lng === 'en' ? 'Total Return' : '总收益'} 
          value={`${metrics.totalReturnPct > 0 ? '+' : ''}${metrics.totalReturnPct}%`} 
          trend={metrics.totalReturnPct > 0 ? 'up' : 'down'} 
          isPrimary 
        />
        <MetricCard 
          title={lng === 'en' ? 'Max Drawdown' : '最大回撤'} 
          value={`-${metrics.maxDrawdownPct}%`} 
          trend="down" 
        />
        <MetricCard 
          title={lng === 'en' ? 'Win Rate' : '胜率'} 
          value={`${metrics.winRatePct}%`} 
          trend="neutral" 
        />
        <MetricCard 
          title={lng === 'en' ? 'Trade Count' : '交易次数'} 
          value={`${metrics.tradeCount}`} 
          trend="neutral" 
        />
      </div>

      {/* 3. 净值曲线图 */}
      <EquityCurveChart lng={lng} />

      {/* 4. AI 分析总结 */}
      <AiAnalysisPanel lng={lng} />

      {/* 5. 风险分析 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RiskCard 
          title={lng === 'en' ? 'Max Drawdown Analysis' : '最大回撤分析'} 
          data={[
            { label: lng === 'en' ? 'Max Drawdown' : '最大回撤幅度', value: `-${metrics.maxDrawdownPct}%` },
            { label: lng === 'en' ? 'Drawdown Period' : '回撤发生时间', value: '2023-08-15 ~ 2023-09-02' },
            { label: lng === 'en' ? 'Recovery Days' : '回撤恢复天数', value: lng === 'en' ? '24 Days' : '24 天' }
          ]} 
        />
        <RiskCard 
          title={lng === 'en' ? 'Volatility & Sharpe' : '波动率与夏普'} 
          data={[
            { label: lng === 'en' ? 'Annualized Volatility' : '年化波动率', value: '18.5%' },
            { label: lng === 'en' ? 'Sharpe Ratio' : '夏普比率 (Sharpe)', value: '1.85' },
            { label: lng === 'en' ? 'Sortino Ratio' : '索提诺比率 (Sortino)', value: '2.42' }
          ]} 
        />
      </div>

      {/* 6. 交易明细 */}
      <TradeDetailsSection lng={lng} />
    </div>
  )
}

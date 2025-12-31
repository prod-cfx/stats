'use client';

import { BarChart2, ChevronDown, Eye, Search, Settings, Star, X } from 'lucide-react';
import React, { useState } from 'react';
import { TradingViewChart } from './TradingViewChart';

export const CenterChartPanel = () => {
  const [interval, setInterval] = useState('15m');
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);
  const timeframes = ['1s', '1m', '5m', '15m', '1h', '4h', '1d'];

  const indicators = [
    { id: 'liq', name: '清算地图', star: true },
    { id: 'ls', name: '各交易所多空比', star: false },
    { id: 'order', name: '聚合挂单', star: false },
    { id: 'oi', name: '聚合持仓量', star: false },
    { id: 'vol', name: '聚合成交量', star: false },
    { id: 'liq_data', name: '市场爆仓数据', star: false },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden min-h-0 relative">
      {/* Chart Toolbar */}
      <div className="h-[48px] bg-[#161b22] border-b border-[#30363d] px-2 flex items-center justify-between z-20">
        <div className="flex items-center gap-1 h-full">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setInterval(tf)}
              className={`px-3 h-full text-xs transition-colors hover:text-[#c9d1d9] ${
                interval === tf ? 'bg-[#374151] text-[#c9d1d9] font-bold' : 'text-[#8b949e]'
              }`}
            >
              {tf.includes('s') ? tf.replace('s', '秒') : tf.includes('m') ? tf.replace('m', '分') : tf.includes('h') ? tf.replace('h', '小时') : tf.replace('d', '日')}
            </button>
          ))}
          <div className="h-4 w-[1px] bg-[#30363d] mx-1" />
          <button 
            className="px-3 h-full text-xs text-[#8b949e] flex items-center gap-1 hover:text-[#c9d1d9]"
            onClick={() => setIsIndicatorModalOpen(true)}
          >
            <span>指标</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          <button 
            className="px-3 h-full text-xs text-[#8b949e] flex items-center gap-1 hover:text-[#c9d1d9]"
            onClick={() => setIsIndicatorModalOpen(true)}
          >
            <span>数据指标</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-2 pr-2">
          <div className="flex items-center gap-1 text-[#8b949e] text-xs px-2 py-1 hover:text-[#c9d1d9] cursor-pointer">
            <span className="text-[#c9d1d9]">数据源:</span>
            <span className="bg-[#1f2937] px-2 py-0.5 rounded flex items-center gap-1">
              聚合开启 <ChevronDown className="w-3 h-3" />
            </span>
          </div>
          <div className="h-4 w-[1px] bg-[#30363d]" />
          <button className="p-1.5 text-[#8b949e] hover:text-[#c9d1d9]">
            <BarChart2 className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-[#8b949e] hover:text-[#c9d1d9]">
            <Eye className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-[#8b949e] hover:text-[#c9d1d9]">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 relative">
        <TradingViewChart symbol="BTCUSDT" interval={interval} />
      </div>

      {/* Indicator Modal */}
      {isIndicatorModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[600px] h-[400px] bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
              <span className="text-[#c9d1d9] font-bold">精选指标</span>
              <button onClick={() => setIsIndicatorModalOpen(false)} className="text-[#8b949e] hover:text-[#c9d1d9]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              <div className="w-[180px] border-r border-[#30363d] p-2 flex flex-col gap-1 bg-[#0d1117]">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8b949e]" />
                  <input 
                    type="text" 
                    placeholder="搜索" 
                    className="w-full bg-[#161b22] border border-[#30363d] rounded py-1 pl-7 pr-2 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
                {['精选指标', '期权指标'].map((cat, i) => (
                  <button key={i} className={`text-left px-3 py-2 text-xs rounded transition-colors ${i === 0 ? 'bg-[#374151] text-[#c9d1d9] font-bold' : 'text-[#8b949e] hover:bg-[#30363d]'}`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Main List */}
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
                {indicators.map((ind) => (
                  <button 
                    key={ind.id} 
                    className="flex items-center justify-between px-3 py-2.5 rounded hover:bg-[#30363d] group transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Star className={`w-3.5 h-3.5 ${ind.star ? 'text-yellow-500 fill-yellow-500' : 'text-[#8b949e] group-hover:text-[#c9d1d9]'}`} />
                      <span className="text-xs text-[#8b949e] group-hover:text-[#c9d1d9]">{ind.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

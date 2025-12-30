'use client';

import React, { useState } from 'react';
import { FileSearch } from 'lucide-react';

export const BottomPanel = () => {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'history' | 'positions' | 'assets'
  
  const tabs = [
    { id: 'orders', label: '当前委托 (2)' },
    { id: 'history', label: '历史委托' },
    { id: 'positions', label: '当前仓位 (1)' },
    { id: 'pos_history', label: '历史仓位' },
    { id: 'assets', label: '资产' }
  ];

  // Mock Data
  const mockOrders = [
    { id: 1, time: '14:20:33', symbol: 'BTCUSDT', type: '限价', side: 'buy', price: '86,500.00', amount: '0.050', filled: '0.000', total: '4,325.00', status: '进行中' },
    { id: 2, time: '14:25:12', symbol: 'BTCUSDT', type: '限价', side: 'sell', price: '88,200.00', amount: '0.100', filled: '0.000', total: '8,820.00', status: '进行中' },
  ];

  const mockHistory = [
    { id: 101, time: '10:15:22', symbol: 'BTCUSDT', type: '市价', side: 'buy', price: '87,120.50', amount: '0.010', filled: '0.010', total: '871.20', status: '已成交' },
    { id: 102, time: '09:05:11', symbol: 'ETHUSDT', type: '限价', side: 'sell', price: '3,100.00', amount: '1.500', filled: '1.500', total: '4,650.00', status: '已成交' },
    { id: 103, time: 'Yesterday', symbol: 'SOLUSDT', type: '限价', side: 'buy', price: '120.00', amount: '10.00', filled: '0.00', total: '0.00', status: '已撤单' },
  ];

  const mockPositions = [
    { id: 'p1', symbol: 'BTCUSDT', side: 'long', size: '0.500', value: '43,510.00', entry: '86,800.00', mark: '87,020.00', liq: '85,100.00', margin: '870.20 (50x)', pnl: '+110.00 (+12.6%)' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'orders':
        return (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] text-[#8b949e] border-b border-[#30363d]">
                  <th className="py-2 px-4 font-normal">时间</th>
                  <th className="py-2 px-4 font-normal">合约</th>
                  <th className="py-2 px-4 font-normal">类型</th>
                  <th className="py-2 px-4 font-normal">方向</th>
                  <th className="py-2 px-4 font-normal">价格(USDT)</th>
                  <th className="py-2 px-4 font-normal">数量</th>
                  <th className="py-2 px-4 font-normal">已成交</th>
                  <th className="py-2 px-4 font-normal">委托总额</th>
                  <th className="py-2 px-4 font-normal">状态</th>
                  <th className="py-2 px-4 font-normal text-right">操作</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {mockOrders.map(order => (
                  <tr key={order.id} className="border-b border-[#30363d] hover:bg-[#1c2128]">
                    <td className="py-2.5 px-4 text-[#8b949e]">{order.time}</td>
                    <td className="py-2.5 px-4 font-medium">{order.symbol}</td>
                    <td className="py-2.5 px-4">{order.type}</td>
                    <td className={`py-2.5 px-4 font-bold ${order.side === 'buy' ? 'text-[#2ea043]' : 'text-[#da3633]'}`}>
                      {order.side === 'buy' ? '买入开多' : '卖出开空'}
                    </td>
                    <td className="py-2.5 px-4">{order.price}</td>
                    <td className="py-2.5 px-4">{order.amount}</td>
                    <td className="py-2.5 px-4">{order.filled}</td>
                    <td className="py-2.5 px-4">{order.total}</td>
                    <td className="py-2.5 px-4">{order.status}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button type="button" className="text-primary hover:opacity-80">撤单</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      
      case 'history':
        return (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] text-[#8b949e] border-b border-[#30363d]">
                  <th className="py-2 px-4 font-normal">时间</th>
                  <th className="py-2 px-4 font-normal">合约</th>
                  <th className="py-2 px-4 font-normal">类型</th>
                  <th className="py-2 px-4 font-normal">方向</th>
                  <th className="py-2 px-4 font-normal">价格(USDT)</th>
                  <th className="py-2 px-4 font-normal">成交量</th>
                  <th className="py-2 px-4 font-normal">成交额</th>
                  <th className="py-2 px-4 font-normal">状态</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {mockHistory.map(item => (
                  <tr key={item.id} className="border-b border-[#30363d] hover:bg-[#1c2128]">
                    <td className="py-2.5 px-4 text-[#8b949e]">{item.time}</td>
                    <td className="py-2.5 px-4 font-medium">{item.symbol}</td>
                    <td className="py-2.5 px-4">{item.type}</td>
                    <td className={`py-2.5 px-4 font-bold ${item.side === 'buy' ? 'text-[#2ea043]' : 'text-[#da3633]'}`}>
                      {item.side === 'buy' ? '买入' : '卖出'}
                    </td>
                    <td className="py-2.5 px-4">{item.price}</td>
                    <td className="py-2.5 px-4">{item.filled}</td>
                    <td className="py-2.5 px-4">{item.total}</td>
                    <td className="py-2.5 px-4 text-[#8b949e]">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'positions':
        return (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] text-[#8b949e] border-b border-[#30363d]">
                  <th className="py-2 px-4 font-normal">合约</th>
                  <th className="py-2 px-4 font-normal">持仓数量</th>
                  <th className="py-2 px-4 font-normal">持仓价值</th>
                  <th className="py-2 px-4 font-normal">开仓价格</th>
                  <th className="py-2 px-4 font-normal">标记价格</th>
                  <th className="py-2 px-4 font-normal text-orange-400">强平价格</th>
                  <th className="py-2 px-4 font-normal">保证金(杠杆)</th>
                  <th className="py-2 px-4 font-normal">未实现盈亏(ROE)</th>
                  <th className="py-2 px-4 font-normal text-right">操作</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {mockPositions.map(pos => (
                  <tr key={pos.id} className="border-b border-[#30363d] hover:bg-[#1c2128]">
                    <td className="py-2.5 px-4 font-medium flex items-center gap-1">
                      <div className={`w-1 h-4 rounded-sm ${pos.side === 'long' ? 'bg-[#2ea043]' : 'bg-[#da3633]'}`} />
                      {pos.symbol}
                    </td>
                    <td className={`py-2.5 px-4 font-bold ${pos.side === 'long' ? 'text-[#2ea043]' : 'text-[#da3633]'}`}>
                      {pos.size} BTC
                    </td>
                    <td className="py-2.5 px-4">{pos.value}</td>
                    <td className="py-2.5 px-4">{pos.entry}</td>
                    <td className="py-2.5 px-4">{pos.mark}</td>
                    <td className="py-2.5 px-4 text-orange-400">{pos.liq}</td>
                    <td className="py-2.5 px-4">{pos.margin}</td>
                    <td className="py-2.5 px-4 text-[#2ea043] font-medium">{pos.pnl}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button className="bg-[#21262d] hover:bg-[#30363d] px-2 py-1 rounded text-[10px] border border-[#30363d]">平仓</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      default:
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-[#8b949e] min-h-[150px]">
            <div className="flex flex-col items-center gap-2 opacity-50">
              <FileSearch className="w-10 h-10" />
              <span className="text-xs">暂无数据</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full bg-[#161b22] border-t border-[#30363d] flex flex-col text-[#c9d1d9] min-h-full">
      {/* Tabs */}
      <div className="flex border-b border-[#30363d] bg-[#0d1117] sticky top-0 z-10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium transition-colors border-t-2 ${
              activeTab === tab.id
                ? 'bg-[#21262d] border-orange-400 text-[#c9d1d9]'
                : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-[#161b22]">
        {renderContent()}
      </div>
    </div>
  );
};

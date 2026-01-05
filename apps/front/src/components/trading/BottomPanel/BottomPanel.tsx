import { FileSearch } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMockBasePrice } from '@/lib/mock/market';

export const BottomPanel = ({ symbol }: { symbol: string }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'history' | 'positions' | 'assets'
  
  const tabs = [
    { id: 'orders', label: `${t('bottomPanel.currentOrders')} (2)` },
    { id: 'history', label: t('bottomPanel.orderHistory') },
    { id: 'positions', label: `${t('bottomPanel.currentPositions')} (1)` },
    { id: 'pos_history', label: t('bottomPanel.positionHistory') },
    { id: 'assets', label: t('bottomPanel.assets') }
  ];

  // Mock Data
  type OrderTypeKey = 'limit' | 'market'
  type OrderStatusKey = 'open' | 'filled' | 'cancelled'

  const basePrice = useMemo(() => getMockBasePrice(symbol), [symbol]);
  const mockOrders = useMemo(() => {
    const buyPrice = basePrice * 0.995;
    const sellPrice = basePrice * 1.01;
    const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: basePrice >= 1000 ? 1 : 2, maximumFractionDigits: basePrice >= 1000 ? 1 : 4 });
    return [
      { id: 1, time: '14:20:33', symbol, type: 'limit' as OrderTypeKey, side: 'buy', price: fmt(buyPrice), amount: '0.050', filled: '0.000', total: fmt(buyPrice * 0.05), status: 'open' as OrderStatusKey },
      { id: 2, time: '14:25:12', symbol, type: 'limit' as OrderTypeKey, side: 'sell', price: fmt(sellPrice), amount: '0.100', filled: '0.000', total: fmt(sellPrice * 0.1), status: 'open' as OrderStatusKey },
    ];
  }, [basePrice, symbol]);

  const mockHistory = [
    { id: 101, time: '10:15:22', symbol: 'BTCUSDT', type: 'market' as OrderTypeKey, side: 'buy', price: '87,120.50', amount: '0.010', filled: '0.010', total: '871.20', status: 'filled' as OrderStatusKey },
    { id: 102, time: '09:05:11', symbol: 'ETHUSDT', type: 'limit' as OrderTypeKey, side: 'sell', price: '3,100.00', amount: '1.500', filled: '1.500', total: '4,650.00', status: 'filled' as OrderStatusKey },
    { id: 103, time: t('common.yesterday', { defaultValue: t('nav.yesterday') }), symbol: 'SOLUSDT', type: 'limit' as OrderTypeKey, side: 'buy', price: '120.00', amount: '10.00', filled: '0.00', total: '0.00', status: 'cancelled' as OrderStatusKey },
  ];

  const mockPositions = [
    { id: 'p1', symbol, side: 'long', size: '0.500', value: '43,510.00', entry: '86,800.00', mark: '87,020.00', liq: '85,100.00', margin: '870.20 (50x)', pnl: '+110.00 (+12.6%)' }
  ];

  const renderOrderType = (key: OrderTypeKey) => t(`bottomPanel.orderTypes.${key}`)
  const renderOrderStatus = (key: OrderStatusKey) => t(`bottomPanel.statuses.${key}`)

  const renderContent = () => {
    switch (activeTab) {
      case 'orders':
        return (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] text-[#8b949e] border-b border-[#30363d]">
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.time')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.contract')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.type')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.side')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.price')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.amount')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.filled')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.total')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.status')}</th>
                  <th className="py-2 px-4 font-normal text-right">{t('bottomPanel.actions')}</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {mockOrders.map(order => (
                  <tr key={order.id} className="border-b border-[#30363d] hover:bg-[#1c2128]">
                    <td className="py-2.5 px-4 text-[#8b949e]">{order.time}</td>
                    <td className="py-2.5 px-4 font-medium">{order.symbol}</td>
                    <td className="py-2.5 px-4">{renderOrderType(order.type)}</td>
                    <td className={`py-2.5 px-4 font-bold ${order.side === 'buy' ? 'text-[#2ea043]' : 'text-[#da3633]'}`}>
                      {order.side === 'buy' ? t('bottomPanel.buyOpenLong') : t('bottomPanel.sellOpenShort')}
                    </td>
                    <td className="py-2.5 px-4">{order.price}</td>
                    <td className="py-2.5 px-4">{order.amount}</td>
                    <td className="py-2.5 px-4">{order.filled}</td>
                    <td className="py-2.5 px-4">{order.total}</td>
                    <td className="py-2.5 px-4">{renderOrderStatus(order.status)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button type="button" className="text-primary hover:opacity-80">{t('bottomPanel.cancel')}</button>
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
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.time')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.contract')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.type')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.side')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.price')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.volume')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.turnover')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.status')}</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {mockHistory.map(item => (
                  <tr key={item.id} className="border-b border-[#30363d] hover:bg-[#1c2128]">
                    <td className="py-2.5 px-4 text-[#8b949e]">{item.time}</td>
                    <td className="py-2.5 px-4 font-medium">{item.symbol}</td>
                    <td className="py-2.5 px-4">{renderOrderType(item.type)}</td>
                    <td className={`py-2.5 px-4 font-bold ${item.side === 'buy' ? 'text-[#2ea043]' : 'text-[#da3633]'}`}>
                      {item.side === 'buy' ? t('bottomPanel.buy') : t('bottomPanel.sell')}
                    </td>
                    <td className="py-2.5 px-4">{item.price}</td>
                    <td className="py-2.5 px-4">{item.filled}</td>
                    <td className="py-2.5 px-4">{item.total}</td>
                    <td className="py-2.5 px-4 text-[#8b949e]">{renderOrderStatus(item.status)}</td>
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
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.contract')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.positionSize')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.positionValue')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.entryPrice')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.markPrice')}</th>
                  <th className="py-2 px-4 font-normal text-orange-400">{t('bottomPanel.liqPrice')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.marginLeverage')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.unrealizedPnl')}</th>
                  <th className="py-2 px-4 font-normal text-right">{t('bottomPanel.actions')}</th>
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
                      <button className="bg-[#21262d] hover:bg-[#30363d] px-2 py-1 rounded text-[10px] border border-[#30363d]">{t('bottomPanel.close')}</button>
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
              <span className="text-xs">{t('bottomPanel.noData')}</span>
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

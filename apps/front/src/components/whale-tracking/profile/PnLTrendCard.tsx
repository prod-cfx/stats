'use client';

import { ChevronDown } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { PnLTrendChart } from './PnLTrendChart';

export const PnLTrendCard = () => {
  const [timeRange, setTimeRange] = useState('1周');
  const [contractType, setContractType] = useState('仅永续合约');
  const [pnlType, setPnlType] = useState('总盈亏');
  
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleDocClick = () => setDropdownOpen(null);
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [dropdownOpen]);

  // Generate mock data for 1 week at ~2 hour intervals
  const generateMockData = () => {
    const data = [];
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    let currentValue = -200000; // Starting point
    const hoursInWeek = 7 * 24;
    
    for (let i = 0; i <= hoursInWeek; i += 2) {
      const date = new Date(oneWeekAgo.getTime() + i * 60 * 60 * 1000);
      const ts = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:00`;
      
      // Random walk with a trend towards the Figma value -414,743.38
      const change = (Math.random() - 0.6) * 50000; // More likely to go down
      currentValue += change;
      
      data.push({ ts, value: currentValue });
    }
    
    // Ensure final value is close to Figma design
    data[data.length - 1].value = -414743.38;
    return data;
  };

  const mockData = generateMockData();

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="text-[#8b949e] text-sm font-medium">{timeRange} {pnlType} ({contractType})</div>
          <div className="text-[#4ade80] text-h2 font-bold tracking-tight">$ +1,978,371.60</div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Time Range Dropdown */}
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(dropdownOpen === 'time' ? null : 'time'); }}
              className={`flex items-center gap-2 px-3 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e5e5e5] text-caption font-medium hover:border-transparent hover:bg-gradient-to-r hover:from-primary hover:to-secondary active:scale-95 transition-all group ${dropdownOpen === 'time' ? 'border-transparent bg-gradient-to-r from-primary to-secondary' : ''}`}
            >
              <span>{timeRange}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#8b949e] group-hover:text-white transition-all ${dropdownOpen === 'time' ? 'rotate-180 text-white' : ''}`} />
            </button>
            {dropdownOpen === 'time' && (
              <div className="absolute right-0 mt-2 w-24 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl z-30 overflow-hidden">
                {['1天', '1周', '1月', '全部'].map(opt => (
                  <button 
                    key={opt}
                    onClick={() => { setTimeRange(opt); setDropdownOpen(null); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[#30363d] transition-colors ${timeRange === opt ? 'text-primary' : 'text-[#c9d1d9]'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Contract Type Dropdown */}
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(dropdownOpen === 'contract' ? null : 'contract'); }}
              className={`flex items-center gap-2 px-3 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e5e5e5] text-caption font-medium hover:border-transparent hover:bg-gradient-to-r hover:from-primary hover:to-secondary active:scale-95 transition-all group ${dropdownOpen === 'contract' ? 'border-transparent bg-gradient-to-r from-primary to-secondary' : ''}`}
            >
              <span>{contractType}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#8b949e] group-hover:text-white transition-all ${dropdownOpen === 'contract' ? 'rotate-180 text-white' : ''}`} />
            </button>
            {dropdownOpen === 'contract' && (
              <div className="absolute right-0 mt-2 w-36 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl z-30 overflow-hidden">
                {['永续合约和现货', '仅永续合约'].map(opt => (
                  <button 
                    key={opt}
                    onClick={() => { setContractType(opt); setDropdownOpen(null); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[#30363d] transition-colors ${contractType === opt ? 'text-primary' : 'text-[#c9d1d9]'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PnL Type Dropdown */}
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(dropdownOpen === 'pnl' ? null : 'pnl'); }}
              className={`flex items-center gap-2 px-3 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e5e5e5] text-caption font-medium hover:border-transparent hover:bg-gradient-to-r hover:from-primary hover:to-secondary active:scale-95 transition-all group ${dropdownOpen === 'pnl' ? 'border-transparent bg-gradient-to-r from-primary to-secondary' : ''}`}
            >
              <span>{pnlType}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#8b949e] group-hover:text-white transition-all ${dropdownOpen === 'pnl' ? 'rotate-180 text-white' : ''}`} />
            </button>
            {dropdownOpen === 'pnl' && (
              <div className="absolute right-0 mt-2 w-28 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl z-30 overflow-hidden">
                {['账户价值', '总盈亏'].map(opt => (
                  <button 
                    key={opt}
                    onClick={() => { setPnlType(opt); setDropdownOpen(null); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[#30363d] transition-colors ${pnlType === opt ? 'text-primary' : 'text-[#c9d1d9]'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 min-h-[300px] w-full">
        <PnLTrendChart data={mockData} />
      </div>
    </div>
  );
};



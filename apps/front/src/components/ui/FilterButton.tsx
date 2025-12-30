'use client';

import { ChevronDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface FilterButtonProps {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  minWidth?: string;
  className?: string;
}

export const FilterButton = ({ value, options, onChange, minWidth = "100px", className = "" }: FilterButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-3 py-2 bg-[#21262d] border rounded-md text-[#e6edf3] text-sm transition-all active:scale-95 ${
          isOpen 
            ? 'border-transparent bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/20' 
            : 'border-[#30363d] hover:border-[#8b949e]'
        }`}
        style={{ minWidth }}
      >
        <span className={`mr-2 ${isOpen ? 'text-white font-bold' : ''}`}>{value}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : 'text-[#8b949e]'}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-[#161b22] border border-[#30363d] rounded-md shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in duration-150">
          <div className="max-h-60 overflow-y-auto no-scrollbar">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                  value === opt 
                    ? 'bg-gradient-to-r from-primary to-secondary text-white font-bold' 
                    : 'text-[#e6edf3] hover:bg-primary/10 hover:text-primary'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

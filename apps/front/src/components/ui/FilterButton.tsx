'use client';

import { ChevronDown } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

type FilterOption = string | { value: string; label: string };

interface FilterButtonProps {
  value: string;
  options: FilterOption[];
  onChange: (v: string) => void;
  minWidth?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const FilterButton = ({ value, options, onChange, minWidth = "100px", className = "", size = 'md' }: FilterButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const padding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-2';
  const itemPadding = size === 'sm' ? 'px-2 py-1.5' : 'px-3 py-2.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  const getOptionValue = (opt: FilterOption) => (typeof opt === 'string' ? opt : opt.value);
  const getOptionLabel = (opt: FilterOption) => (typeof opt === 'string' ? opt : opt.label);
  const selectedLabel = getOptionLabel(
    options.find(opt => getOptionValue(opt) === value) ?? value
  );

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center justify-between ${padding} bg-[color:var(--cf-surface-2)] border rounded-md text-[color:var(--cf-text)] ${textSize} transition-all active:scale-95 ${
          isOpen 
            ? 'border-transparent bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/20' 
            : 'border-[color:var(--cf-border)] hover:border-[color:var(--cf-muted)]'
        }`}
        style={{ minWidth }}
      >
        <span className={`mr-2 ${isOpen ? 'text-white font-bold' : ''}`}>{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : 'text-[color:var(--cf-muted)]'}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-md shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in duration-150">
          <div className="max-h-60 overflow-y-auto no-scrollbar">
            {options.map((opt) => {
              const optValue = getOptionValue(opt);
              const optLabel = getOptionLabel(opt);
              return (
              <button
                key={optValue}
                type="button"
                onClick={() => {
                  onChange(optValue);
                  setIsOpen(false);
                }}
                className={`w-full text-left ${itemPadding} ${textSize} transition-colors ${
                  value === optValue 
                    ? 'bg-gradient-to-r from-primary to-secondary text-white font-bold' 
                    : 'text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)] hover:text-primary'
                }`}
              >
                {optLabel}
              </button>
            )})}
          </div>
        </div>
      )}
    </div>
  );
};

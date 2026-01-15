'use client';

import { Info, MoreHorizontal } from 'lucide-react';
import React from 'react';
import { SubTitle } from '@/components/ui/Typography';

export interface PredictionOption {
  label: string;
  probability: string;
}

export interface PredictionRulesMeta {
  paragraphs: string[];
  createdAt?: string;
}

export interface PredictionCardProps {
  id?: string;
  title: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  options?: PredictionOption[];
  probability?: string;
  status?: 'LIVE' | string;
  volume?: string;
  rules?: PredictionRulesMeta;
}

export const PredictionCard = ({ 
  title, 
  icon, 
  iconBgColor, 
  options, 
  probability, 
  status, 
  volume 
}: PredictionCardProps) => {
  return (
    <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl p-5 flex flex-col h-full relative group gradient-border-hover">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3 items-start">
          {icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBgColor || 'bg-[#374151]'}`}>
              {icon}
            </div>
          )}
          <SubTitle className="leading-snug line-clamp-2 pr-6 text-[color:var(--cf-text-strong)]">
            {title}
          </SubTitle>
        </div>
        <button type="button" className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] transition-colors absolute top-5 right-5">
          <Info className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 mb-6">
        {options ? (
          options.map((option, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span className="text-[color:var(--cf-text)]">{option.label}</span>
              <span className="text-[color:var(--cf-text-strong)] font-medium">{option.probability}</span>
            </div>
          ))
        ) : probability ? (
          <div className="flex flex-col items-center justify-center py-2">
            <span className="text-[color:var(--cf-text-strong)] text-3xl font-bold">{probability}</span>
            <span className="text-[color:var(--cf-muted)] text-xs uppercase tracking-wider mt-1">probability</span>
          </div>
        ) : null}
      </div>

      <div className="flex justify-between items-center mt-auto">
        <div className="flex items-center gap-2">
          {(status === 'LIVE' || status === 'OPEN' || status === 'ACTIVE') && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#f87171] animate-pulse" />
              <span className="text-[#f87171] text-xs font-bold tracking-wider">LIVE</span>
            </div>
          )}
          {volume && (
            <span className="text-[color:var(--cf-muted)] text-xs font-medium">{volume} Vol.</span>
          )}
        </div>
        <button type="button" className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};



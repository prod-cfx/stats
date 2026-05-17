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
    <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-lg p-4 flex flex-col h-full min-w-0 relative group transition-colors hover:border-[color:var(--cf-muted)]">
      <div className="flex justify-between items-start mb-3">
        <div className="flex min-w-0 gap-3 items-start">
          {icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBgColor || 'bg-[#374151]'}`}>
              {icon}
            </div>
          )}
          <SubTitle className="min-w-0 line-clamp-2 pr-6 !text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">
            {title}
          </SubTitle>
        </div>
        <button type="button" className="absolute top-4 right-4 text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]">
          <Info className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 space-y-2.5 mb-4">
        {options ? (
          options.map((option, idx) => (
            <div key={idx} className="flex min-w-0 items-center justify-between gap-3">
              <span className="min-w-0 truncate !text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)]">{option.label}</span>
              <span className="flex-none !text-sm !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{option.probability}</span>
            </div>
          ))
        ) : probability ? (
          <div className="flex flex-col items-center justify-center py-2">
            <span className="!text-base !font-semibold !leading-6 text-[color:var(--cf-text-strong)]">{probability}</span>
            <span className="mt-1 !text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)] uppercase tracking-normal">probability</span>
          </div>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {(status === 'LIVE' || status === 'OPEN' || status === 'ACTIVE') && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#f87171] animate-pulse" />
              <span className="!text-xs !font-semibold !leading-5 tracking-normal text-[#f87171]">LIVE</span>
            </div>
          )}
          {volume && (
            <span className="truncate !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">{volume} Vol.</span>
          )}
        </div>
        <button type="button" className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

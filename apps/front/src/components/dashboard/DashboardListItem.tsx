'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

export interface DashboardListItemProps {
  title: string;
  description: string;
  creator: string;
  saves: number;
  image: string;
  tags?: string[];
}

export const DashboardListItem = ({ title, description, creator, saves, image, tags }: DashboardListItemProps) => {
  const { t } = useTranslation();
  return (
    <div className="bg-[#161b22]/30 border border-[#30363d] rounded-xl p-4 flex items-center gap-4 hover:border-[#3b82f6]/30 hover:bg-[#161b22]/50 transition-all group">
      <div className="w-12 h-12 rounded-lg bg-[#0d1117] flex-none border border-[#30363d] overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover" />
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <h4 className="text-white text-body font-semibold truncate">{title}</h4>
        <p className="text-[#8b949e] text-caption truncate">{description}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[#8b949e] text-caption font-medium uppercase tracking-tight">{t('dashboard.creator', { name: creator })}</span>
          <span className="text-[#8b949e] text-caption font-medium uppercase tracking-tight">{t('dashboard.saves', { count: saves.toLocaleString() })}</span>
          {tags && tags.map((tag, idx) => (
            <span key={idx} className="px-1.5 py-0.5 bg-[#0d1117] text-[#8b949e] text-caption font-bold rounded uppercase border border-[#30363d]">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};


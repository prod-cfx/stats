'use client';

import React from 'react';
import { SubTitle } from '@/components/ui/Typography';

export interface DashboardCardProps {
  title: string;
  tags: string[];
  saves: number;
  creator: string;
  image: string;
}

export const DashboardCard = ({ title, tags, saves, creator, image }: DashboardCardProps) => {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden hover:border-[#3b82f6]/50 transition-all group flex flex-col h-full">
      <div className="aspect-[16/10] w-full overflow-hidden border-b border-[#30363d]">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
        />
      </div>
      <div className="p-5 flex flex-col gap-4 flex-1">
        <SubTitle className="line-clamp-2 min-h-[56px]">{title}</SubTitle>
        
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, idx) => (
            <span 
              key={idx} 
              className="px-2 py-0.5 bg-[#0d1117] text-[#cccccc] text-caption font-bold rounded border border-[#30363d] uppercase tracking-wider"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex justify-between items-center text-caption">
          <span className="text-[#999999]">{saves.toLocaleString()} 保存</span>
          <span className="text-[#5a5a5a] group-hover:text-[#999999] transition-colors">创建者 @{creator}</span>
        </div>
      </div>
    </div>
  );
};


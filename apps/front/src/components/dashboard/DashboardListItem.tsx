'use client';

import React from 'react';

export interface DashboardListItemProps {
  title: string;
  description: string;
  creator: string;
  saves: number;
  image: string;
  tags?: string[];
}

export const DashboardListItem = ({ title, description, creator, saves, image, tags }: DashboardListItemProps) => {
  return (
    <div className="bg-[#161b22]/30 border border-[#30363d] rounded-xl p-4 flex items-center gap-4 hover:border-[#3b82f6]/30 hover:bg-[#161b22]/50 transition-all group">
      <div className="w-12 h-12 rounded-lg bg-[#0d1117] flex-none border border-[#30363d] overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover" />
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <h4 className="text-white text-body font-semibold truncate">{title}</h4>
        <p className="text-[#999999] text-caption truncate">{description}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[#5a5a5a] text-caption font-medium uppercase tracking-tight">创建者 @{creator}</span>
          <span className="text-[#5a5a5a] text-caption font-medium uppercase tracking-tight">{saves.toLocaleString()} 保存</span>
          {tags && tags.map((tag, idx) => (
            <span key={idx} className="px-1.5 py-0.5 bg-[#0d1117] text-[#999999] text-caption font-bold rounded uppercase border border-[#30363d]">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};


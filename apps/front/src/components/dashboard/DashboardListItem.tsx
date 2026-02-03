'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'

export interface DashboardListItemProps {
  title: string
  description: string
  creator: string
  saves: number
  image: string
  tags?: string[]
}

export const DashboardListItem = ({
  title,
  description,
  creator,
  saves,
  image,
  tags,
}: DashboardListItemProps) => {
  const { t } = useTranslation()
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-[#30363d] bg-[#161b22]/30 p-4 transition-all hover:border-[#3b82f6]/30 hover:bg-[#161b22]/50">
      <div className="h-12 w-12 flex-none overflow-hidden rounded-lg border border-[#30363d] bg-[#0d1117]">
        <img src={image} alt={title} className="h-full w-full object-cover" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h4 className="text-body truncate font-semibold text-white">{title}</h4>
        <p className="text-caption truncate text-[#8b949e]">{description}</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-caption font-medium tracking-tight text-[#8b949e] uppercase">
            {t('dashboard.creator', { name: creator })}
          </span>
          <span className="text-caption font-medium tracking-tight text-[#8b949e] uppercase">
            {t('dashboard.saves', { count: saves })}
          </span>
          {tags &&
            tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-caption rounded border border-[#30363d] bg-[#0d1117] px-1.5 py-0.5 font-bold text-[#8b949e] uppercase"
              >
                {tag}
              </span>
            ))}
        </div>
      </div>
    </div>
  )
}

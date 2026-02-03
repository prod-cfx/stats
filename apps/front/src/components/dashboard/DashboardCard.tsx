'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { SubTitle } from '@/components/ui/Typography'

export interface DashboardCardProps {
  title: string
  tags: string[]
  saves: number
  creator: string
  image: string
}

export const DashboardCard = ({ title, tags, saves, creator, image }: DashboardCardProps) => {
  const { t } = useTranslation()
  return (
    <div className="gradient-border-hover group flex h-full flex-col overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22]">
      <div className="aspect-[16/10] w-full overflow-hidden border-b border-[#30363d]">
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <SubTitle className="line-clamp-2 min-h-[56px]">{title}</SubTitle>

        <div className="flex flex-wrap gap-2">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="text-caption rounded border border-[#30363d] bg-[#0d1117] px-2 py-0.5 font-bold tracking-wider text-[#c9d1d9] uppercase"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="text-caption mt-auto flex items-center justify-between">
          <span className="text-[#8b949e]">{t('dashboard.saves', { count: saves })}</span>
          <span className="text-[#8b949e] transition-colors group-hover:text-[#c9d1d9]">
            {t('dashboard.creator', { name: creator })}
          </span>
        </div>
      </div>
    </div>
  )
}

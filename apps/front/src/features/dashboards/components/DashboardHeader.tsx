'use client'

import type { DashboardDoc } from '../store/dashboardStore'
import { Edit2, Image, Save, Send } from 'lucide-react'
import React, { useRef, useState } from 'react'
import { publishDashboard, updateDashboardMeta } from '../store/dashboardStore'

interface DashboardHeaderProps {
  dashboard: DashboardDoc
  onRefresh: () => void
}

export function DashboardHeader({ dashboard, onRefresh }: DashboardHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(dashboard.name)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSaveTitle = () => {
    updateDashboardMeta(dashboard.id, { name: titleValue })
    setIsEditingTitle(false)
    onRefresh()
  }

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      updateDashboardMeta(dashboard.id, { thumbnail: base64 })
      onRefresh()
    }
    reader.readAsDataURL(file)
  }

  const handlePublish = () => {
    publishDashboard(dashboard.id)
    onRefresh()
  }

  return (
    <div className="flex items-center justify-between mb-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        {isEditingTitle ? (
          <input
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveTitle()
              if (e.key === 'Escape') {
                setTitleValue(dashboard.name)
                setIsEditingTitle(false)
              }
            }}
            autoFocus
            className="bg-transparent border-b border-primary text-4xl font-bold text-white focus:outline-none px-2"
          />
        ) : (
          <h1 className="text-4xl font-bold text-white">{dashboard.name}</h1>
        )}
        <button
          type="button"
          onClick={() => setIsEditingTitle(!isEditingTitle)}
          className="text-[#8b949e] hover:text-white transition-colors p-2"
          title="编辑标题"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Thumbnail Upload */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 border border-primary text-primary hover:bg-primary/10 rounded-lg transition-colors text-sm font-medium"
          title="选择缩略图"
        >
          <Image className="w-4 h-4" />
          选择缩略图
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleThumbnailUpload}
          className="hidden"
        />

        {/* Save/Publish */}
        {dashboard.isPublished ? (
          <button
            type="button"
            onClick={() => onRefresh()}
            className="flex items-center gap-2 px-4 py-2 bg-[#21262d] text-white hover:bg-[#30363d] rounded-lg transition-colors text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePublish}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
          >
            <Send className="w-4 h-4" />
            发布
          </button>
        )}
      </div>
    </div>
  )
}

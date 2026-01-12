'use client'

import type { DashboardDoc } from '../store/dashboardStore'
import { Check, Edit2, Image, Loader2, Save, X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { updateDashboardMeta } from '../store/dashboardStore'

interface DashboardHeaderProps {
  dashboard: DashboardDoc
  onRefresh: () => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

type SavePublishStatus = 'idle' | 'saving' | 'success' | 'error'

export function DashboardHeader({ dashboard, onRefresh }: DashboardHeaderProps) {
  const { t } = useTranslation()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(dashboard.name)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [savePublishStatus, setSavePublishStatus] = useState<SavePublishStatus>('idle')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastSavedStateRef = useRef(JSON.stringify(dashboard))

  // 监听看板变化，检测是否有未保存的修改
  useEffect(() => {
    const currentState = JSON.stringify(dashboard)
    setHasUnsavedChanges(currentState !== lastSavedStateRef.current)
  }, [dashboard])

  const handleSaveTitle = () => {
    updateDashboardMeta(dashboard.id, { name: titleValue })
    setIsEditingTitle(false)
    onRefresh()
  }

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadStatus('error')
      setUploadError(t('dashboard.editor.actions.uploadFail'))
      setTimeout(() => {
        setUploadStatus('idle')
        setUploadError(null)
      }, 3000)
      return
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      setUploadStatus('error')
      setUploadError(t('dashboard.editor.actions.uploadFail'))
      setTimeout(() => {
        setUploadStatus('idle')
        setUploadError(null)
      }, 3000)
      return
    }

    setUploadStatus('uploading')
    setUploadError(null)

    const reader = new FileReader()
    
    reader.onerror = () => {
      setUploadStatus('error')
      setUploadError(t('dashboard.editor.actions.uploadFail'))
      setTimeout(() => {
        setUploadStatus('idle')
        setUploadError(null)
      }, 3000)
    }

    reader.onloadend = () => {
      try {
        const base64 = reader.result as string
        updateDashboardMeta(dashboard.id, { thumbnail: base64 })
        setUploadStatus('success')
        onRefresh()
        
        // 2秒后恢复初始状态
        setTimeout(() => {
          setUploadStatus('idle')
        }, 2000)
      } catch (err) {
        void err
        setUploadStatus('error')
        setUploadError(t('dashboard.editor.actions.uploadFail'))
        setTimeout(() => {
          setUploadStatus('idle')
          setUploadError(null)
        }, 3000)
      }
    }
    
    reader.readAsDataURL(file)
    
    // 清空 input，允许重复上传同一文件
    e.target.value = ''
  }

  const handleSaveChanges = async () => {
    if (savePublishStatus === 'saving') return
    
    setSavePublishStatus('saving')
    
    try {
      // 模拟保存延迟
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // 更新最后保存状态
      lastSavedStateRef.current = JSON.stringify(dashboard)
      setHasUnsavedChanges(false)
      setSavePublishStatus('success')
      
      toast.success({
        title: t('dashboard.editor.validation.saveSuccess'),
        description: t('dashboard.editor.validation.saveSuccessDesc'),
        duration: 2000,
      })
      
      onRefresh()
      
      // 1.5秒后恢复按钮状态
      setTimeout(() => {
        setSavePublishStatus('idle')
      }, 1500)
    } catch (err) {
      void err
      setSavePublishStatus('error')
      toast.error({
        title: t('dashboard.editor.validation.saveFail'),
        description: t('dashboard.editor.validation.saveFailDesc'),
      })
      setTimeout(() => {
        setSavePublishStatus('idle')
      }, 2000)
    }
  }

  return (
    <div className="flex items-center justify-between mb-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        {/* Thumbnail Preview */}
        {dashboard.thumbnail && (
          <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-primary/30 flex-shrink-0">
            <img
              src={dashboard.thumbnail}
              alt="Dashboard thumbnail"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
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
          title={t('dashboard.editor.actions.editTitle')}
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Thumbnail Upload */}
        <div className="relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadStatus === 'uploading'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-lg active:scale-95 ${
              uploadStatus === 'uploading'
                ? 'bg-gray-500 cursor-not-allowed'
                : uploadStatus === 'success'
                  ? 'bg-green-600 text-white'
                  : uploadStatus === 'error'
                    ? 'bg-red-600 text-white'
                    : 'bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 shadow-primary/20'
            }`}
            title={uploadStatus === 'idle' ? t('dashboard.editor.actions.selectThumbnail') : uploadStatus === 'uploading' ? t('dashboard.editor.actions.uploading') : uploadStatus === 'success' ? t('dashboard.editor.actions.uploadSuccess') : t('dashboard.editor.actions.uploadFail')}
          >
            {uploadStatus === 'uploading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('dashboard.editor.actions.uploading')}
              </>
            ) : uploadStatus === 'success' ? (
              <>
                <Check className="w-4 h-4" />
                {t('dashboard.editor.actions.uploadSuccess')}
              </>
            ) : uploadStatus === 'error' ? (
              <>
                <X className="w-4 h-4" />
                {t('dashboard.editor.actions.uploadFail')}
              </>
            ) : (
              <>
                <Image className="w-4 h-4" />
                {dashboard.thumbnail ? t('dashboard.editor.actions.changeThumbnail') : t('dashboard.editor.actions.selectThumbnail')}
              </>
            )}
          </button>
          {uploadError && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-red-500/10 border border-red-500/30 rounded px-3 py-2 text-xs text-red-400 whitespace-nowrap z-10">
              {uploadError}
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleThumbnailUpload}
          className="hidden"
        />

        {/* Save Button - Only shows "保存" or "未保存" states */}
        <button
          type="button"
          onClick={handleSaveChanges}
          disabled={savePublishStatus === 'saving' || savePublishStatus === 'success' || !hasUnsavedChanges}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-lg active:scale-95 ${
            savePublishStatus === 'saving'
              ? 'bg-gray-600 cursor-not-allowed text-white'
              : savePublishStatus === 'success'
                ? 'bg-green-600 text-white'
                : savePublishStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : !hasUnsavedChanges
                    ? 'bg-[#21262d] text-[#8b949e] cursor-not-allowed'
                    : 'bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 shadow-primary/20'
          }`}
          title={
            savePublishStatus === 'saving'
              ? t('dashboard.editor.actions.saving')
              : savePublishStatus === 'success'
                ? t('dashboard.editor.validation.saveSuccess')
                : savePublishStatus === 'error'
                  ? t('dashboard.editor.validation.saveFail')
                  : !hasUnsavedChanges
                    ? t('dashboard.editor.actions.noChanges')
                    : t('dashboard.editor.actions.saveChanges')
          }
        >
          {savePublishStatus === 'saving' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('dashboard.editor.actions.saving')}
            </>
          ) : savePublishStatus === 'success' ? (
            <>
              <Check className="w-4 h-4" />
              {t('dashboard.editor.actions.saved')}
            </>
          ) : savePublishStatus === 'error' ? (
            <>
              <X className="w-4 h-4" />
              {t('dashboard.editor.validation.saveFail')}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {hasUnsavedChanges ? t('dashboard.editor.actions.save') : t('dashboard.editor.actions.unsaved')}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

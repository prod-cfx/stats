/* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect */
'use client'

import type { DashboardDoc } from '../store/dashboard-store'
import { Check, Edit2, Image, Loader2, Save, X } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { deleteDashboard, updateDashboardMeta, upsertDashboard } from '../store/dashboard-store'

interface DashboardHeaderProps {
  dashboard: DashboardDoc
  onRefresh: () => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

type SavePublishStatus = 'idle' | 'saving' | 'success' | 'error'

export function DashboardHeader({ dashboard, onRefresh }: DashboardHeaderProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams()
  const lng = (params as any)?.lng || 'zh'
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(dashboard.name)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>(
    'idle',
  )
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [savePublishStatus, setSavePublishStatus] = useState<SavePublishStatus>('idle')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastSavedStateRef = useRef(JSON.stringify(dashboard))

  // 监听看板变化，检测是否有未保存的修改
  useEffect(() => {
    const currentState = JSON.stringify(dashboard)
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- derived from dashboard prop
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
      // If we're still on the internal placeholder `draft`, materialize it into a real dashboard id
      // so it can appear under "Saved Dashboards" (lists intentionally filter out `draft`).
      if (dashboard.id === 'draft') {
        const nextId = crypto.randomUUID()
        upsertDashboard({
          ...dashboard,
          id: nextId,
          isPublished: false,
        })
        deleteDashboard('draft')
        router.replace(`/${lng}/dashboard/editor?id=${nextId}`)
      }

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
    <div className="mb-6 flex items-center justify-between">
      {/* Title */}
      <div className="flex items-center gap-3">
        {/* Thumbnail Preview */}
        {dashboard.thumbnail && (
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border-2 border-[color:var(--cf-border)]">
            <img
              src={dashboard.thumbnail}
              alt="Dashboard thumbnail"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {isEditingTitle ? (
          <input
            type="text"
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSaveTitle()
              if (e.key === 'Escape') {
                setTitleValue(dashboard.name)
                setIsEditingTitle(false)
              }
            }}
            autoFocus
            className="border-b border-[color:var(--cf-border)] bg-transparent px-2 text-4xl font-bold text-[color:var(--cf-text-strong)] focus:outline-none"
          />
        ) : (
          <h1 className="text-4xl font-bold text-[color:var(--cf-text-strong)]">
            {dashboard.name}
          </h1>
        )}
        <button
          type="button"
          onClick={() => setIsEditingTitle(!isEditingTitle)}
          className="p-2 text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
          title={t('dashboard.editor.actions.editTitle')}
        >
          <Edit2 className="h-4 w-4" />
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
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg transition-all active:scale-95 ${
              uploadStatus === 'uploading'
                ? 'cursor-not-allowed bg-gray-500'
                : uploadStatus === 'success'
                  ? 'bg-green-600 text-white'
                  : uploadStatus === 'error'
                    ? 'bg-red-600 text-white'
                    : 'from-primary to-secondary shadow-primary/20 bg-gradient-to-r text-white hover:opacity-90'
            }`}
            title={
              uploadStatus === 'idle'
                ? t('dashboard.editor.actions.selectThumbnail')
                : uploadStatus === 'uploading'
                  ? t('dashboard.editor.actions.uploading')
                  : uploadStatus === 'success'
                    ? t('dashboard.editor.actions.uploadSuccess')
                    : t('dashboard.editor.actions.uploadFail')
            }
          >
            {uploadStatus === 'uploading' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('dashboard.editor.actions.uploading')}
              </>
            ) : uploadStatus === 'success' ? (
              <>
                <Check className="h-4 w-4" />
                {t('dashboard.editor.actions.uploadSuccess')}
              </>
            ) : uploadStatus === 'error' ? (
              <>
                <X className="h-4 w-4" />
                {t('dashboard.editor.actions.uploadFail')}
              </>
            ) : (
              <>
                <Image className="h-4 w-4" />
                {dashboard.thumbnail
                  ? t('dashboard.editor.actions.changeThumbnail')
                  : t('dashboard.editor.actions.selectThumbnail')}
              </>
            )}
          </button>
          {uploadError && (
            <div className="absolute top-full right-0 left-0 z-10 mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs whitespace-nowrap text-red-400">
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
        {(() => {
          const canSave = hasUnsavedChanges || dashboard.id === 'draft'
          return (
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={
                savePublishStatus === 'saving' || savePublishStatus === 'success' || !canSave
              }
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg transition-all active:scale-95 ${
                savePublishStatus === 'saving'
                  ? 'cursor-not-allowed bg-gray-600 text-white'
                  : savePublishStatus === 'success'
                    ? 'bg-green-600 text-white'
                    : savePublishStatus === 'error'
                      ? 'bg-red-600 text-white'
                      : !canSave
                        ? 'cursor-not-allowed bg-[color:var(--cf-surface)] text-[color:var(--cf-muted)]'
                        : 'from-primary to-secondary shadow-primary/20 bg-gradient-to-r text-white hover:opacity-90'
              }`}
              title={
                savePublishStatus === 'saving'
                  ? t('dashboard.editor.actions.saving')
                  : savePublishStatus === 'success'
                    ? t('dashboard.editor.validation.saveSuccess')
                    : savePublishStatus === 'error'
                      ? t('dashboard.editor.validation.saveFail')
                      : !canSave
                        ? t('dashboard.editor.actions.noChanges')
                        : t('dashboard.editor.actions.saveChanges')
              }
            >
              {savePublishStatus === 'saving' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('dashboard.editor.actions.saving')}
                </>
              ) : savePublishStatus === 'success' ? (
                <>
                  <Check className="h-4 w-4" />
                  {t('dashboard.editor.actions.saved')}
                </>
              ) : savePublishStatus === 'error' ? (
                <>
                  <X className="h-4 w-4" />
                  {t('dashboard.editor.validation.saveFail')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {canSave
                    ? t('dashboard.editor.actions.save')
                    : t('dashboard.editor.actions.saved')}
                </>
              )}
            </button>
          )
        })()}
      </div>
    </div>
  )
}

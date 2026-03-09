'use client'

import type {
  CreateWhaleNotificationRuleInput,
  WhaleNotificationChannels,
  WhaleNotificationRuleType,
} from '../types'
import { Bell, Mail, Send } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/lib/toast'
import {
  getDefaultWhaleChannels,
} from '../api/whale-notification-api'
import { DEFAULT_MONITOR_SYMBOL, MONITOR_SYMBOL_OPTIONS } from '../constants'

interface CreateMonitorModalProps {
  isOpen: boolean
  mode: WhaleNotificationRuleType
  presetAddress?: string
  titleOverride?: string
  submitText?: string
  initialValues?: {
    thresholdUsd?: number
    note?: string
    symbol?: string
    channels?: WhaleNotificationChannels
  }
  onClose: () => void
  onCreate: (input: CreateWhaleNotificationRuleInput) => Promise<{ created: boolean }>
}

const DEFAULT_THRESHOLD = 500000

export function CreateMonitorModal({
  isOpen,
  mode,
  presetAddress,
  titleOverride,
  submitText,
  initialValues,
  onClose,
  onCreate,
}: CreateMonitorModalProps) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const [threshold, setThreshold] = useState<string>(String(DEFAULT_THRESHOLD))
  const [address, setAddress] = useState(presetAddress ?? '')
  const [addressNote, setAddressNote] = useState('')
  const [symbol, setSymbol] = useState<string>(DEFAULT_MONITOR_SYMBOL)
  const [channels, setChannels] = useState(getDefaultWhaleChannels)
  const [submitting, setSubmitting] = useState(false)
  const canUseTelegram = Boolean(session?.telegram?.isLinked || session?.loginMethods?.includes('telegram'))

  useEffect(() => {
    if (!isOpen) return
    setThreshold(String(initialValues?.thresholdUsd ?? DEFAULT_THRESHOLD))
    setAddress(presetAddress ?? '')
    setAddressNote(initialValues?.note ?? '')
    setSymbol(initialValues?.symbol ?? DEFAULT_MONITOR_SYMBOL)
    const nextChannels = initialValues?.channels ?? getDefaultWhaleChannels()
    setChannels({
      ...nextChannels,
      telegram: canUseTelegram ? nextChannels.telegram : false,
    })
  }, [canUseTelegram, initialValues, isOpen, presetAddress])

  const handleClose = () => {
    onClose()
  }

  const title = useMemo(
    () => titleOverride || (
      mode === 'ADDRESS'
        ? t('whaleTracking.notifications.modal.createAddressTitle')
        : t('whaleTracking.notifications.modal.createSymbolTitle')
    ),
    [mode, t, titleOverride],
  )

  const handleSubmit = async () => {
    const thresholdUsd = Number(threshold)
    if (!Number.isFinite(thresholdUsd) || thresholdUsd <= 0) {
      toast.error({ title: t('common.error'), description: t('whaleTracking.notifications.errors.invalidThreshold') })
      return
    }

    const finalAddress = mode === 'ADDRESS' ? (presetAddress ?? address).trim() : undefined
    if (mode === 'ADDRESS' && !/^0x[a-fA-F0-9]{40}$/.test(finalAddress || '')) {
      toast.error({ title: t('common.error'), description: t('whaleTracking.notifications.errors.invalidAddress') })
      return
    }

    setSubmitting(true)
    try {
      if (
        channels.web &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'default'
      ) {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          toast.info({
            title: t('whaleTracking.notifications.toast.webPermissionDeniedTitle'),
            description: t('whaleTracking.notifications.toast.webPermissionDeniedDesc'),
          })
        }
      }

      const result = await onCreate({
        type: mode,
        address: finalAddress,
        symbol: mode === 'SYMBOL' ? symbol : undefined,
        thresholdUsd,
        note: mode === 'ADDRESS' ? addressNote : undefined,
        channels,
      })
      if (result.created) {
        toast.success({ title: t('whaleTracking.notifications.toast.ruleCreated') })
        handleClose()
      }
    } catch (err) {
      toast.error({
        title: t('common.error'),
        description: err instanceof Error ? err.message : t('common.tryAgain'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      width="max-w-xl"
      footer={(
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="from-primary to-secondary rounded-full bg-gradient-to-r px-6 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t('common.loading') : (submitText ?? t('whaleTracking.notifications.modal.create'))}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        {mode === 'ADDRESS' && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--cf-muted)]">
                {t('whaleTracking.notifications.modal.address')}
              </label>
              <input
                value={presetAddress ?? address}
                onChange={e => setAddress(e.target.value)}
                readOnly={Boolean(presetAddress)}
                className="w-full rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 text-sm text-[color:var(--cf-text-strong)]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--cf-muted)]">
                {t('whaleTracking.notifications.modal.addressNote')}
              </label>
              <input
                value={addressNote}
                onChange={e => setAddressNote(e.target.value)}
                placeholder={t('whaleTracking.notifications.modal.optional')}
                className="w-full rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 text-sm text-[color:var(--cf-text-strong)]"
              />
            </div>
          </>
        )}

        {mode === 'SYMBOL' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-[color:var(--cf-muted)]">
              {t('whaleTracking.notifications.modal.symbol')}
            </label>
            <select
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 text-sm text-[color:var(--cf-text-strong)]"
            >
              {MONITOR_SYMBOL_OPTIONS.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-[color:var(--cf-muted)]">
            {t('whaleTracking.notifications.modal.thresholdUsd')}
          </label>
          <input
            type="number"
            min={1}
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 text-sm text-[color:var(--cf-text-strong)]"
          />
        </div>

        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)]/40 p-3">
          <div className="mb-2 text-sm font-medium text-[color:var(--cf-muted)]">
            {t('whaleTracking.notifications.modal.channels')}
          </div>
          <div className="space-y-2">
            <label className="flex items-center justify-between rounded-lg bg-[color:var(--cf-surface)] px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-[color:var(--cf-text-strong)]"><Bell className="h-4 w-4" />{t('whaleTracking.notifications.channels.web')}</span>
              <input
                type="checkbox"
                checked={channels.web}
                onChange={e => setChannels(prev => ({ ...prev, web: e.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg bg-[color:var(--cf-surface)] px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-[color:var(--cf-text-strong)]"><Mail className="h-4 w-4" />{t('whaleTracking.notifications.channels.email')}</span>
              <input
                type="checkbox"
                checked={channels.email}
                onChange={e => setChannels(prev => ({ ...prev, email: e.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg bg-[color:var(--cf-surface)] px-3 py-2">
              <span className={`flex items-center gap-2 text-sm ${canUseTelegram ? 'text-[color:var(--cf-text-strong)]' : 'text-[color:var(--cf-muted)]'}`}><Send className="h-4 w-4" />{t('whaleTracking.notifications.channels.telegram')}</span>
              <input
                type="checkbox"
                checked={channels.telegram}
                disabled={!canUseTelegram}
                onChange={e => setChannels(prev => ({ ...prev, telegram: canUseTelegram ? e.target.checked : false }))}
              />
            </label>
            {!canUseTelegram && (
              <p className="px-1 text-xs text-[color:var(--cf-muted)]">
                {t('whaleTracking.notifications.modal.telegramBindRequired')}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

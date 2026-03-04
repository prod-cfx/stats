'use client'

import type { WhaleNotificationRuleType } from '@/features/whale-notification/types'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageTitle } from '@/components/ui/Typography'
import { createWhaleNotificationRule } from '@/features/whale-notification/api/whale-notification-api'
import { CreateMonitorModal } from '@/features/whale-notification/components/CreateMonitorModal'
import { ensureMonitorAuth } from '@/features/whale-notification/guards/monitor-auth-guard'
import { useWhaleNotificationRules } from '@/features/whale-notification/hooks/useWhaleNotificationRules'
import { MonitorSection } from './MonitorSection'

export function NotificationsClient() {
  const { t } = useTranslation()
  const [openModal, setOpenModal] = useState(false)
  const [modalMode, setModalMode] = useState<WhaleNotificationRuleType>('SYMBOL')

  const {
    rules,
    loading,
    updateRule,
    deleteRule,
    refresh,
  } = useWhaleNotificationRules()

  const addressRules = useMemo(
    () => rules.filter(rule => rule.type === 'ADDRESS'),
    [rules],
  )

  const symbolRules = useMemo(
    () => rules.filter(rule => rule.type === 'SYMBOL'),
    [rules],
  )

  const openCreateModal = (mode: WhaleNotificationRuleType) => {
    if (!ensureMonitorAuth(t)) return
    setModalMode(mode)
    setOpenModal(true)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <PageTitle className="text-xl md:text-2xl">{t('whaleTracking.notifications.title')}</PageTitle>
        <p className="text-sm text-[color:var(--cf-muted)]">{t('whaleTracking.notifications.subtitle')}</p>
      </div>

      <MonitorSection
        title={t('whaleTracking.notifications.sections.address')}
        rules={addressRules}
        loading={loading}
        emptyText={t('whaleTracking.notifications.emptyAddress')}
        onCreate={() => openCreateModal('ADDRESS')}
        onToggle={(id, isActive) => {
          void updateRule(id, { isActive })
        }}
        onDelete={(id) => {
          void deleteRule(id)
        }}
      />

      <MonitorSection
        title={t('whaleTracking.notifications.sections.realtime')}
        rules={symbolRules}
        loading={loading}
        emptyText={t('whaleTracking.notifications.emptyRealtime')}
        onCreate={() => openCreateModal('SYMBOL')}
        onToggle={(id, isActive) => {
          void updateRule(id, { isActive })
        }}
        onDelete={(id) => {
          void deleteRule(id)
        }}
      />

      <CreateMonitorModal
        isOpen={openModal}
        mode={modalMode}
        onClose={() => setOpenModal(false)}
        onCreate={async (payload) => {
          if (!ensureMonitorAuth(t)) return { created: false }
          await createWhaleNotificationRule(payload)
          await refresh()
          return { created: true }
        }}
      />
    </div>
  )
}

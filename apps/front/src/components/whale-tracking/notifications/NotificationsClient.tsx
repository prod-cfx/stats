'use client'

import type { WhaleNotificationRuleType } from '@/features/whale-notification/types'
import dynamic from 'next/dynamic'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageTitle } from '@/components/ui/Typography'
import { createWhaleNotificationRule } from '@/features/whale-notification/api/whale-notification-api'
import { ensureMonitorAuth } from '@/features/whale-notification/guards/monitor-auth-guard'
import { useWhaleNotificationInbox } from '@/features/whale-notification/hooks/useWhaleNotificationInbox'
import { useWhaleNotificationRules } from '@/features/whale-notification/hooks/useWhaleNotificationRules'
import { AddressMonitorSection } from './AddressMonitorSection'
import { InboxTab } from './InboxTab'
import { RealtimeWhaleMonitorSection } from './RealtimeWhaleMonitorSection'

const CreateMonitorModal = dynamic(
  () =>
    import('@/features/whale-notification/components/CreateMonitorModal').then(
      mod => mod.CreateMonitorModal,
    ),
  { ssr: false, loading: () => null },
)

export function NotificationsClient() {
  const { t } = useTranslation()
  const [openModal, setOpenModal] = useState(false)
  const [modalMode, setModalMode] = useState<WhaleNotificationRuleType>('ADDRESS')

  const { rules, loading, updateRule, deleteRule, refresh } = useWhaleNotificationRules()
  const inbox = useWhaleNotificationInbox()

  const addressRules = useMemo(() => rules.filter(rule => rule.type === 'ADDRESS'), [rules])

  const symbolRules = useMemo(() => rules.filter(rule => rule.type === 'SYMBOL'), [rules])

  const openCreateModal = (mode: WhaleNotificationRuleType) => {
    if (!ensureMonitorAuth(t)) return
    setModalMode(mode)
    setOpenModal(true)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <PageTitle className="text-xl md:text-2xl">
          {t('whaleTracking.notifications.title')}
        </PageTitle>
        <p className="text-sm text-[color:var(--cf-muted)]">
          {t('whaleTracking.notifications.subtitle')}
        </p>
      </div>

      <AddressMonitorSection
        rules={addressRules}
        loading={loading}
        onCreate={() => openCreateModal('ADDRESS')}
        onUpdate={async (id, input) => {
          await updateRule(id, input)
        }}
        onDelete={id => {
          void deleteRule(id)
        }}
      />

      <RealtimeWhaleMonitorSection
        rules={symbolRules}
        onCreateRule={async input => {
          if (!ensureMonitorAuth(t)) return { created: false }
          await createWhaleNotificationRule(input)
          await refresh()
          return { created: true }
        }}
        onUpdateRule={async (id, input) => {
          await updateRule(id, input)
        }}
        onDeleteRule={async id => {
          await deleteRule(id)
        }}
      />

      <section className="space-y-3 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 md:p-5">
        <h3 className="text-lg font-bold text-[color:var(--cf-text-strong)]">
          {t('whaleTracking.notifications.tabs.inbox')} ({inbox.unreadCount})
        </h3>
        <InboxTab
          items={inbox.items}
          loading={inbox.loading}
          onRead={id => {
            void inbox.markRead(id)
          }}
          onReadAll={() => {
            void inbox.markAllRead()
          }}
        />
      </section>

      <CreateMonitorModal
        isOpen={openModal}
        mode={modalMode}
        onClose={() => setOpenModal(false)}
        onCreate={async payload => {
          if (!ensureMonitorAuth(t)) return { created: false }
          await createWhaleNotificationRule(payload)
          await refresh()
          return { created: true }
        }}
      />
    </div>
  )
}

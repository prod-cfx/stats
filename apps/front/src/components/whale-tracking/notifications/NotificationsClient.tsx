'use client'

import { useSearchParams } from 'next/navigation'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageTitle } from '@/components/ui/Typography'
import {
  createWhaleNotificationRule,
} from '@/features/whale-notification/api/whale-notification-api'
import { CreateMonitorModal } from '@/features/whale-notification/components/CreateMonitorModal'
import { useWhaleNotificationInbox } from '@/features/whale-notification/hooks/useWhaleNotificationInbox'
import { useWhaleNotificationRules } from '@/features/whale-notification/hooks/useWhaleNotificationRules'
import { InboxTab } from './InboxTab'
import { RulesTab } from './RulesTab'

type TabKey = 'rules' | 'inbox'

export function NotificationsClient() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const initialTab = searchParams?.get('tab') === 'inbox' ? 'inbox' : 'rules'
  const [tab, setTab] = useState<TabKey>(initialTab)
  const [openModal, setOpenModal] = useState(false)

  const {
    rules,
    loading: rulesLoading,
    updateRule,
    deleteRule,
    refresh: refreshRules,
  } = useWhaleNotificationRules()

  const {
    items,
    loading: inboxLoading,
    markRead,
    markAllRead,
    refresh: refreshInbox,
  } = useWhaleNotificationInbox()

  const unreadCount = useMemo(() => items.filter(item => !item.read).length, [items])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <PageTitle className="text-xl md:text-2xl">{t('whaleTracking.notifications.title')}</PageTitle>
          <p className="mt-1 text-sm text-[color:var(--cf-muted)]">{t('whaleTracking.notifications.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpenModal(true)}
          className="from-primary to-secondary rounded-full bg-gradient-to-r px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          {t('whaleTracking.notifications.actions.newSymbolRule')}
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-1">
        <button
          type="button"
          onClick={() => setTab('rules')}
          className={`rounded-lg px-3 py-2 text-sm transition-colors ${tab === 'rules' ? 'bg-primary/15 text-primary' : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'}`}
        >
          {t('whaleTracking.notifications.tabs.rules')}
        </button>
        <button
          type="button"
          onClick={() => setTab('inbox')}
          className={`rounded-lg px-3 py-2 text-sm transition-colors ${tab === 'inbox' ? 'bg-primary/15 text-primary' : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'}`}
        >
          {t('whaleTracking.notifications.tabs.inbox')} ({unreadCount})
        </button>
      </div>

      {tab === 'rules' ? (
        <RulesTab
          rules={rules}
          loading={rulesLoading}
          onToggle={(id, isActive) => {
            void updateRule(id, { isActive })
          }}
          onDelete={(id) => {
            void deleteRule(id)
          }}
        />
      ) : (
        <InboxTab
          items={items}
          loading={inboxLoading}
          onRead={(id) => {
            void markRead(id)
          }}
          onReadAll={() => {
            void markAllRead()
          }}
        />
      )}

      <CreateMonitorModal
        isOpen={openModal}
        mode="SYMBOL"
        onClose={() => setOpenModal(false)}
        onCreate={async (payload) => {
          await createWhaleNotificationRule(payload)
          await Promise.all([refreshRules(), refreshInbox()])
        }}
      />
    </div>
  )
}

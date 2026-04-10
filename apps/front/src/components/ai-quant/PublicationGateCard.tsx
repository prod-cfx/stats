'use client'

import type { LlmPublicationGate } from '@/lib/api'
import { useTranslation } from 'react-i18next'

export function PublicationGateCard({ gate }: { gate: LlmPublicationGate }) {
  const { t } = useTranslation()
  if (gate.passed || gate.blockingMismatches.length === 0) return null

  return (
    <section className="rounded-2xl border border-rose-300 bg-rose-50 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-rose-700">
        {t('aiQuant.publicationGateTitle', { defaultValue: 'Publication blocked' })}
      </div>
      <div className="space-y-3">
        {gate.blockingMismatches.map(item => (
          <div
            key={`${item.field}-${item.expected}-${item.actual}`}
            className="rounded-xl border border-rose-200 bg-white p-3"
          >
            <div className="text-sm font-semibold text-rose-950">{item.field}</div>
            <div className="mt-1 text-sm text-rose-900">
              {t('aiQuant.publicationGateExpected', { defaultValue: 'Expected' })}
              {`: ${item.expected}`}
            </div>
            <div className="text-sm text-rose-900">
              {t('aiQuant.publicationGateActual', { defaultValue: 'Actual' })}
              {`: ${item.actual}`}
            </div>
            <div className="mt-1 text-xs text-rose-700">{item.reason}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

'use client'

import type { LlmClarificationGate } from '@/lib/api'
import { useTranslation } from 'react-i18next'

export function ClarificationGateCard({
  gate,
  onAnswer,
}: {
  gate: LlmClarificationGate
  onAnswer: (itemKey: string, value: string) => void
}) {
  const { t } = useTranslation()
  const items = gate.items ?? gate.pendingItems ?? []
  const current = items.find(item => item.status === 'pending')
  if (!current) return null

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        {t('aiQuant.clarificationGateTitle', { defaultValue: 'Clarification required' })}
      </div>
      <p className="text-sm font-medium text-amber-950">{current.question}</p>
      {(current.allowedAnswers?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {current.allowedAnswers?.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => onAnswer(current.key, option)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-950 transition-colors hover:bg-amber-100"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

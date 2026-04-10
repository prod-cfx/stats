'use client'

import type { LlmClarificationGate } from '@/lib/api'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function ClarificationGateCard({
  gate,
  onAnswer,
}: {
  gate: LlmClarificationGate
  onAnswer: (itemKey: string, value: string) => void
}) {
  const { t } = useTranslation()
  const [freeformAnswer, setFreeformAnswer] = useState('')
  const items = gate.items ?? gate.pendingItems ?? []
  const current = items.find(item => item.status === 'pending')

  useEffect(() => {
    setFreeformAnswer(current?.answer ?? '')
  }, [current?.answer, current?.key])

  if (!current) return null

  const hasAllowedAnswers = (current.allowedAnswers?.length ?? 0) > 0
  const trimmedFreeformAnswer = freeformAnswer.trim()

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        {t('aiQuant.clarificationGateTitle', { defaultValue: 'Clarification required' })}
      </div>
      <p className="text-sm font-medium text-amber-950">{current.question}</p>
      {hasAllowedAnswers && (
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
      {!hasAllowedAnswers && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            data-testid="clarification-freeform-input"
            type="text"
            value={freeformAnswer}
            onChange={event => setFreeformAnswer(event.target.value)}
            placeholder={t('aiQuant.clarificationGateInputPlaceholder', {
              defaultValue: 'Enter your answer',
            })}
            className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-amber-950 outline-none transition-colors placeholder:text-amber-500 focus:border-amber-500"
          />
          <button
            data-testid="clarification-freeform-submit"
            type="button"
            disabled={!trimmedFreeformAnswer}
            onClick={() => onAnswer(current.key, trimmedFreeformAnswer)}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-amber-950 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('aiQuant.clarificationGateSubmit', { defaultValue: 'Submit' })}
          </button>
        </div>
      )}
    </section>
  )
}

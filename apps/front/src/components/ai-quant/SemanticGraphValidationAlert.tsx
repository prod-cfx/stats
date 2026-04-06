import type { LlmSemanticGraphValidationReport } from '@/lib/api'

interface SemanticGraphValidationAlertProps {
  validationReport: LlmSemanticGraphValidationReport
}

export function SemanticGraphValidationAlert({
  validationReport,
}: SemanticGraphValidationAlertProps) {
  if (validationReport.ok || validationReport.errors.length === 0) {
    return null
  }

  return (
    <section className="rounded-2xl border border-rose-300/40 bg-rose-500/10 p-5">
      <h2 className="text-lg font-semibold text-rose-200">Semantic Graph Validation</h2>
      <div className="mt-3 space-y-2">
        {validationReport.errors.map((error, index) => (
          <div
            key={`${error.code}-${index}`}
            className="rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
          >
            <div className="font-medium">{error.code}</div>
            <div className="mt-1">{error.message}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

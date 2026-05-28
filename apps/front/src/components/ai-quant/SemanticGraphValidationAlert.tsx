import type { LlmSemanticGraphValidationReport } from '@/lib/api'

const DIAGNOSTIC_ONLY_CODES = new Set([
  'evidence_text_not_substring',
  'rule_shape_invalid',
])

// Staging / 生产对终端用户隐藏整个诊断面板（含 rules_missing_or_empty 等硬错误）；
// 只在显式 development audience 暴露，便于内部排障。
// fail-closed：未知 / 缺省 / 大小写变体 / 字符串 'undefined' / 'null' 一律拒绝，
// 避免容器漏配 NEXT_PUBLIC_APP_ENV 时面板回归泄漏（Issue #1693 复测场景）。
function isDevelopmentAudience(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase()
  return appEnv === 'development'
}

interface SemanticGraphValidationAlertProps {
  validationReport: LlmSemanticGraphValidationReport
}

export function SemanticGraphValidationAlert({
  validationReport,
}: SemanticGraphValidationAlertProps) {
  if (!isDevelopmentAudience()) return null

  const visibleErrors = validationReport.errors.filter(error => !DIAGNOSTIC_ONLY_CODES.has(error.code))

  if (validationReport.ok || visibleErrors.length === 0) {
    return null
  }

  return (
    <section className="rounded-2xl border border-rose-300/40 bg-rose-500/10 p-5">
      <h2 className="text-lg font-semibold text-rose-200">Semantic Graph Validation</h2>
      <div className="mt-3 space-y-2">
        {visibleErrors.map((error, index) => (
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

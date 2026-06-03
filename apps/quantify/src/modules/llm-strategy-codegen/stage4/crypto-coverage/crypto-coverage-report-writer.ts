import type { CryptoCoverageReport } from './crypto-coverage-types'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export function renderCryptoCoverageMarkdown(report: CryptoCoverageReport): string {
  const backlogRows = report.backlog
    .map(item => `| ${item.atomKey} | ${item.requiredPhase} | ${item.failureKind} | ${item.ownerLayer} |`)
    .join('\n')
  const unsupportedRows = report.unsupported
    .map(item => `| ${item.caseId} | ${item.matchedPhrase} | ${item.publicReason} |`)
    .join('\n')

  return [
    '# Crypto Strategy Coverage Report',
    '',
    `- Total cases: ${report.summary.totalCases}`,
    `- Passed cases: ${report.summary.passCases}`,
    `- Pass rate: ${report.summary.passPct}%`,
    `- Weighted B coverage: ${report.summary.weightedBCoveragePct}%`,
    `- C-scope unsupported: ${report.summary.unsupportedCCount}`,
    '',
    '## Atom Backlog',
    '',
    '| Atom | Phase | Failure | Owner layer |',
    '| --- | --- | --- | --- |',
    backlogRows || '| none | none | none | none |',
    '',
    '## Unsupported C-Scope',
    '',
    '| Case | Phrase | Reason |',
    '| --- | --- | --- |',
    unsupportedRows || '| none | none | none |',
    '',
  ].join('\n')
}

export async function writeCryptoCoverageReport(report: CryptoCoverageReport, paths: { json: string, markdown: string }): Promise<void> {
  await mkdir(dirname(paths.json), { recursive: true })
  await mkdir(dirname(paths.markdown), { recursive: true })
  await writeFile(paths.json, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(paths.markdown, renderCryptoCoverageMarkdown(report), 'utf8')
}

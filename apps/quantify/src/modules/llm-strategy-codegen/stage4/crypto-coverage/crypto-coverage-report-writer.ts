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
  const taxonomyRows = report.taxonomy.families
    .map(item => `| ${item.familyId} | ${item.scope} | ${item.weightPct}% | ${item.covered ? 'yes' : 'no'} | ${item.corpusCaseIds.length} | ${item.weightSource} |`)
    .join('\n')
  const caseRows = report.taxonomy.caseMappings
    .map((item, index) => `| ${index + 1} | ${item.caseId} | ${item.scope} | ${item.labels.join(', ')} | ${item.familyIds.join(', ')} | ${item.source} | ${item.passed ? 'passed' : 'failed'} |`)
    .join('\n')

  return [
    '# Crypto Strategy Coverage Report',
    '',
    `- Total cases: ${report.summary.totalCases}`,
    `- Passed cases: ${report.summary.passCases}`,
    `- Pass rate: ${report.summary.passPct}%`,
    `- Weighted B coverage: ${report.summary.weightedBCoveragePct}%`,
    `- C-scope unsupported: ${report.summary.unsupportedCCount}`,
    `- Taxonomy target: ${report.taxonomy.targetCoveragePct}%`,
    `- Taxonomy achieved: ${report.taxonomy.achievedCoveragePct}%`,
    `- Taxonomy denominator: ${report.taxonomy.denominator}`,
    `- Taxonomy corpus: ${report.taxonomy.corpusSource}`,
    '',
    '## Taxonomy Evidence',
    '',
    `Weight source: ${report.taxonomy.weightSource}`,
    '',
    'Limitations:',
    '',
    ...report.taxonomy.sourceLimitations.map(item => `- ${item}`),
    '',
    '| Family | Scope | Weight | Covered | Cases | Weight source |',
    '| --- | --- | --- | --- | ---: | --- |',
    taxonomyRows || '| none | none | 0% | no | 0 | none |',
    '',
    '## Corpus Case Mapping',
    '',
    '| No. | Case | Scope | Labels | Taxonomy families | Source | Status |',
    '| ---: | --- | --- | --- | --- | --- | --- |',
    caseRows || '| 0 | none | none | none | none | none | none |',
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

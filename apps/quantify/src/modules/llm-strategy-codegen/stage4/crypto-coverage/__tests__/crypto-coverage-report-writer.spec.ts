import type { CryptoCoverageReport } from '../crypto-coverage-types'
import { renderCryptoCoverageMarkdown } from '../crypto-coverage-report-writer'

const report: CryptoCoverageReport = {
  summary: {
    totalCases: 2,
    passCases: 1,
    passPct: 50,
    weightedBCoveragePct: 60,
    unsupportedCCount: 1,
  },
  cases: [],
  atoms: [],
  failures: [],
  backlog: [{ atomKey: 'execution.post_only', requiredPhase: 'P2', failureKind: 'missing_ir_emit', ownerLayer: 'ir_emit' }],
  unsupported: [{ caseId: 'c', matchedPhrase: 'HFT', status: 'unsupported_out_of_scope', publicReason: 'hft_market_making_out_of_scope' }],
}

describe('crypto coverage report writer', () => {
  it('renders summary, atom backlog, and C-scope unsupported sections', () => {
    const markdown = renderCryptoCoverageMarkdown(report)
    expect(markdown).toContain('- Total cases: 2')
    expect(markdown).toContain('- Weighted B coverage: 60%')
    expect(markdown).toContain('| execution.post_only | P2 | missing_ir_emit | ir_emit |')
    expect(markdown).toContain('| c | HFT | hft_market_making_out_of_scope |')
  })
})

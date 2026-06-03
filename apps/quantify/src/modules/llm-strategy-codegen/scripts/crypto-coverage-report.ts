import { resolve } from 'node:path'
import { CRYPTO_STRATEGY_COVERAGE_CORPUS } from '../stage4/crypto-coverage/crypto-strategy-corpus'
import { runCryptoCoverageCorpus } from '../stage4/crypto-coverage/crypto-coverage-runner'
import { writeCryptoCoverageReport } from '../stage4/crypto-coverage/crypto-coverage-report-writer'

async function main(): Promise<void> {
  const report = await runCryptoCoverageCorpus(CRYPTO_STRATEGY_COVERAGE_CORPUS)
  await writeCryptoCoverageReport(report, {
    json: resolve(process.cwd(), 'tmp/crypto-strategy-coverage-report.json'),
    markdown: resolve(process.cwd(), 'tmp/crypto-strategy-coverage-report.md'),
  })
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

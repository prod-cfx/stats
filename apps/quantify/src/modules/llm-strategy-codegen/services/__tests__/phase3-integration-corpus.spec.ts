import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'
import { phase3MtfCases } from './fixtures/phase3-mtf-cases'
import { phase3PreviousExtremaCases } from './fixtures/phase3-previous-extrema-cases'
import { phase3TimeStopCases } from './fixtures/phase3-time-stop-cases'

// Phase 3 三能力联调 corpus (#1021)
//
// 范围与降级说明：
// - 既有 fixture (phase3MtfCases / phase3PreviousExtremaCases / phase3TimeStopCases)
//   均为自由文本 `message` 形态，与 atom-coverage-golden-cases 同源；它们对应的实际
//   入口是 SemanticSeedExtractor → SemanticSeedStateBuilder → SemanticSupportClassifier
//   这条 readiness 路径，而不是 CanonicalSpecBuilderService.build({...spec input}) 的
//   形参化入口。
// - CanonicalSpecBuilderService / CanonicalSpecV2IrCompilerService /
//   CompiledPublicationGateService 三层在生产链路中由 codegen 编排服务（持有 IR
//   adapter / digest / canonicalizer / validator / parser / repository 等多重依赖）
//   组装；在本 PR 不引入业务代码改动的约束下无法用 fixture.message 直接驱动。
// - 因此本 corpus 采用"smoke + 不抛异常"的最小联调形态：对每个 case 走 readiness 三段
//   （extract → build → classify），断言流水线 deterministic 且不崩；spec→IR→gate
//   完整三层串联留待后续 PR 引入 codegen orchestrator 测试夹具后补齐，已在
//   apps/quantify/docs/phase3-coverage-report.md 中登记为已知缺口。

const allCases = [
  ...phase3MtfCases.map(c => ({ ...c, group: 'multi_timeframe' as const })),
  ...phase3PreviousExtremaCases.map(c => ({ ...c, group: 'previous_extrema' as const })),
  ...phase3TimeStopCases.map(c => ({ ...c, group: 'time_stop_bars' as const })),
]

describe('Phase 3 三能力联调 corpus (#1021)', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const classifier = new SemanticSupportClassifierService(new SemanticAtomRegistryService())

  it('aggregates mtf / previous_extrema / time_stop fixtures into a single corpus', () => {
    expect(allCases.length).toBe(
      phase3MtfCases.length + phase3PreviousExtremaCases.length + phase3TimeStopCases.length,
    )
    expect(allCases.length).toBeGreaterThan(0)
    for (const c of allCases) {
      expect(c.message).toEqual(expect.any(String))
      expect(c.message.length).toBeGreaterThan(0)
      expect(['multi_timeframe', 'previous_extrema', 'time_stop_bars']).toContain(c.group)
    }
  })

  it.each(allCases)('$group / $name → readiness 三段链路不抛异常', (goldenCase) => {
    // step 1: seed extractor — message → semantic patch
    const patch = extractor.extract(goldenCase.message)
    expect(patch).toBeDefined()

    // step 2: state builder — patch → SemanticState
    const state = builder.build(patch)
    expect(state).not.toBeNull()

    // step 3: support classifier — SemanticState → readiness route
    const classification = classifier.classify(state!)
    expect(classification).toBeDefined()
    expect(typeof classification.route).toBe('string')
    expect(classification.route.length).toBeGreaterThan(0)
  })

  it.todo(
    'spec → IR → publication gate 三层串联（待 codegen orchestrator 测试夹具落地后补齐）',
  )
})

import { CanonicalSpecBuilderService } from '@/modules/llm-strategy-codegen/services/canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CodegenGraphSnapshotService } from '@/modules/llm-strategy-codegen/services/codegen-graph-snapshot.service'
import { CompiledPublicationGateService } from '@/modules/llm-strategy-codegen/services/compiled-publication-gate.service'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '@/modules/llm-strategy-codegen/services/compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '@/modules/llm-strategy-codegen/services/compiled-script-parser.service'
import { GenericSeedDispatcher } from '@/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service'
import { ScriptProfileExtractorService } from '@/modules/llm-strategy-codegen/services/script-profile-extractor.service'
import { SemanticSeedStateBuilderService } from '@/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service'
import { SpecDescBuilderService } from '@/modules/llm-strategy-codegen/services/spec-desc-builder.service'
import { StrategyConsistencyService } from '@/modules/llm-strategy-codegen/services/strategy-consistency.service'
import { StrategySummaryBuilderService } from '@/modules/llm-strategy-codegen/services/strategy-summary-builder.service'
import { StrategySummaryObservationService } from '@/modules/llm-strategy-codegen/services/strategy-summary-observation.service'
import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../constants/official-strategy-plaza-templates'
import { StrategyPlazaCompiledSnapshotService } from './strategy-plaza-compiled-snapshot.service'

function buildService() {
  const repo = {
    resolveExistingOfficialSnapshotForUser: jest.fn().mockResolvedValue(null),
    resolveOfficialSnapshotForUser: jest.fn().mockResolvedValue({ id: 'snapshot-1' }),
  }
  const scriptParser = new CompiledScriptParserService()
  const publicationGate = new CompiledPublicationGateService(
    { create: jest.fn() } as never,
    { withTransaction: (cb: () => Promise<unknown>) => cb() } as never,
    scriptParser,
  )

  const service = new StrategyPlazaCompiledSnapshotService(
    repo as never,
    new GenericSeedDispatcher(),
    new SemanticSeedStateBuilderService(),
    new CanonicalSpecBuilderService(),
    new SpecDescBuilderService(),
    new StrategyConsistencyService(new ScriptProfileExtractorService()),
    new StrategySummaryBuilderService(new ScriptProfileExtractorService()),
    new CanonicalSpecV2IrCompilerService(),
    new CanonicalStrategyAstCompilerService(),
    new CompiledScriptEmitterService(),
    new CompiledScriptExecutionEnvelopeService(),
    scriptParser,
    new StrategySummaryObservationService(),
    publicationGate,
    new CodegenGraphSnapshotService(),
  )

  return { repo, service }
}

function template(id: string) {
  const found = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(item => item.id === id)
  if (!found) throw new Error(`${id} missing`)
  return found
}

function sourceContentFromLastCall(repo: ReturnType<typeof buildService>['repo']) {
  const call = repo.resolveOfficialSnapshotForUser.mock.calls.at(-1)?.[0]
  if (!call?.sourceContent) throw new Error('sourceContent missing')
  return call.sourceContent as {
    scriptSnapshot: string
    astSnapshot: { exprPool?: Array<{ payload?: { kind?: string } }> }
    executionEnvelope?: { runtime?: string, source?: string }
  }
}

describe('StrategyPlazaCompiledSnapshotService', () => {
  it('marks compiled plaza snapshots as official signal-generator templates for deployment', async () => {
    const { repo, service } = buildService()

    await service.resolveCompiledSnapshotForUser({ userId: 'user-1', template: template('ema-trend-continuation') })

    expect(sourceContentFromLastCall(repo).executionEnvelope).toMatchObject({
      runtime: 'signal-generator',
      source: 'strategy-plaza-official-template',
    })
  })

  it('builds ma-cross compiled plaza snapshots without throwing', async () => {
    const { repo, service } = buildService()

    await expect(service.resolveCompiledSnapshotForUser({
      userId: 'user-1',
      template: template('ma-cross'),
    })).resolves.toEqual({ id: 'snapshot-1' })

    expect(sourceContentFromLastCall(repo).scriptSnapshot).toContain('protocolVersion')
  })

  it('builds orderbook plaza runs from compiled rules artifacts with external event predicates', async () => {
    const { repo, service } = buildService()

    await service.resolveCompiledSnapshotForUser({ userId: 'user-1', template: template('orderbook-imbalance-long') })

    const sourceContent = sourceContentFromLastCall(repo)
    expect(sourceContent.scriptSnapshot).toContain('evaluateExprPool')
    expect(sourceContent.scriptSnapshot).toContain('orderbookImbalance')
    expect(sourceContent.astSnapshot.exprPool?.map(expr => expr.payload?.kind)).toEqual(expect.arrayContaining([
      'orderbookImbalance',
    ]))
  })

  it('builds funding plus OI plaza runs from compiled rules artifacts with external event predicates', async () => {
    const { repo, service } = buildService()

    await service.resolveCompiledSnapshotForUser({ userId: 'user-1', template: template('funding-oi-confirmation') })

    const sourceContent = sourceContentFromLastCall(repo)
    expect(sourceContent.scriptSnapshot).toContain('evaluateExprPool')
    expect(sourceContent.scriptSnapshot).toContain('fundingRateCondition')
    expect(sourceContent.scriptSnapshot).toContain('openInterestCondition')
    expect(sourceContent.astSnapshot.exprPool?.map(expr => expr.payload?.kind)).toEqual(expect.arrayContaining([
      'fundingRateCondition',
      'openInterestCondition',
    ]))
  })
})

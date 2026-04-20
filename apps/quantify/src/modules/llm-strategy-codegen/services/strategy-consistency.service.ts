import type { CanonicalStrategyIrV1 } from '../types/canonical-strategy-ir'
import type {
  CanonicalAction,
  CanonicalRuleV2,
  CanonicalStrategySpec,
  CanonicalStrategySpecV2,
} from '../types/canonical-strategy-spec'
import type { SemanticStrategyGraph } from '../types/semantic-strategy-graph'
import type { StrategyConsistencyCheck, StrategyConsistencyReport } from '../types/strategy-consistency-report'
import type {
  StrategySemanticProfile,
  StrategySemanticRuleKey,
  StrategySemanticRuleMapping,
  StrategySemanticRuleProfile,
} from '../types/strategy-semantic-profile'
import { createHash } from 'node:crypto'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import { Injectable } from '@nestjs/common'

import { CanonicalSpecV2IrCompilerService } from './canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from './canonical-strategy-ast-compiler.service'
import { CompiledScriptParserService } from './compiled-script-parser.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { ScriptProfileExtractorService } from './script-profile-extractor.service'
import { normalizeStrategySemanticProfile } from './strategy-semantic-profile-normalizer'

@Injectable()
export class StrategyConsistencyService {
  constructor(
    private readonly scriptProfileExtractor: ScriptProfileExtractorService,
    private readonly compiledScriptParser: CompiledScriptParserService = new CompiledScriptParserService(),
    private readonly canonicalSpecV2IrCompiler: CanonicalSpecV2IrCompilerService = new CanonicalSpecV2IrCompilerService(),
    private readonly canonicalStrategyAstCompiler: CanonicalStrategyAstCompilerService = new CanonicalStrategyAstCompilerService(),
  ) {}

  audit(input: {
    semanticGraph: SemanticStrategyGraph
    ir: CanonicalStrategyIrV1
    scriptCode: string
  }): StrategyConsistencyReport {
    const parsedProjection = this.tryParseCompiledProjection(input.scriptCode)
    const scriptProfile = this.extractCompiledScriptProfile(input.scriptCode, parsedProjection)
    const specProfile = this.irToProfile(input.ir)
    const checks: StrategyConsistencyCheck[] = []

    checks.push(this.checkSemanticGraphDigest(input.semanticGraph, input.ir))
    checks.push(this.checkIrDirectionSensitiveAtom(input.semanticGraph, input.ir))
    checks.push(this.checkIrSupportsSemanticGraph(input.semanticGraph, input.ir))
    checks.push(this.checkAstProjection(input.ir, parsedProjection))
    checks.push(this.checkExecutionEnvelopePositionMode(input.ir, parsedProjection))
    checks.push(this.checkCompiledScriptMatchesIr(input.ir, input.scriptCode))

    const summary = this.buildSummary(checks)
    return {
      status: summary.criticalFailed > 0 ? 'FAILED' : 'PASSED',
      specProfile,
      scriptProfile,
      checks,
      summary,
    }
  }

  evaluate(input: {
    canonicalSpec: CanonicalStrategySpec
    scriptCode: string
  }): StrategyConsistencyReport {
    const parsedProjection = this.tryParseCompiledProjection(input.scriptCode)
    const scriptProfile = normalizeStrategySemanticProfile(
      this.extractCompiledScriptProfile(input.scriptCode, parsedProjection),
    )
    const specProfile = normalizeStrategySemanticProfile(this.specToProfile(input.canonicalSpec))
    const checks: StrategyConsistencyCheck[] = []

    checks.push(this.checkFallback(scriptProfile))
    checks.push(this.checkIndicators(specProfile, scriptProfile))
    checks.push(this.checkRuleMappings(specProfile, scriptProfile))
    checks.push(this.checkActions(specProfile, scriptProfile))
    checks.push(this.checkSizing(specProfile, scriptProfile))
    checks.push(this.checkMarketMetadata(input.canonicalSpec, parsedProjection))
    const compiledIr = this.tryCompileCanonicalIr(input.canonicalSpec)
    if (compiledIr) {
      checks.push(this.checkAstProjection(compiledIr, parsedProjection))
      checks.push(this.checkExecutionEnvelopePositionMode(compiledIr, parsedProjection))
    }

    const summary = this.buildSummary(checks)

    return {
      status: summary.criticalFailed > 0 ? 'FAILED' : 'PASSED',
      specProfile,
      scriptProfile,
      checks,
      summary,
    }
  }

  private extractCompiledScriptProfile(
    scriptCode: string,
    parsedProjection: ReturnType<CompiledScriptParserService['parse']> | null = null,
  ): StrategySemanticProfile {
    try {
      const parsed = parsedProjection ?? this.compiledScriptParser.parse(scriptCode)
      return this.projectionToProfile(parsed)
    } catch {
      return this.scriptProfileExtractor.extract(scriptCode)
    }
  }

  private tryParseCompiledProjection(
    scriptCode: string,
  ): ReturnType<CompiledScriptParserService['parse']> | null {
    try {
      return this.compiledScriptParser.parse(scriptCode)
    } catch {
      return null
    }
  }

  private tryCompileCanonicalIr(spec: CanonicalStrategySpec): CanonicalStrategyIrV1 | null {
    if (spec.version !== 2) {
      return null
    }

    try {
      const compiled = this.canonicalSpecV2IrCompiler.compile({
        canonicalSpec: spec,
        fallback: this.buildCanonicalSpecV2Fallback(spec),
      })
      return compiled.ir
    } catch {
      return null
    }
  }

  private irToProfile(ir: CanonicalStrategyIrV1): StrategySemanticProfile {
    const indicators: StrategySemanticProfile['indicators'] = []
    const pushIndicator = (indicator: StrategySemanticProfile['indicators'][number]) => {
      if (!indicators.some(item => item.kind === indicator.kind)) {
        indicators.push(indicator)
      }
    }

    for (const series of ir.signalCatalog.series) {
      switch (series.kind) {
        case 'UPPER_BAND':
        case 'MID_BAND':
        case 'LOWER_BAND':
          pushIndicator({ kind: 'bollingerBands', params: {
            period: typeof series.params?.period === 'number' ? series.params.period : 20,
            stdDev: typeof series.params?.stdDev === 'number' ? series.params.stdDev : 2,
          } })
          break
        case 'SMA':
          pushIndicator({ kind: 'sma', params: { period: typeof series.params?.period === 'number' ? series.params.period : 20 } })
          break
        case 'EMA':
          pushIndicator({ kind: 'ema', params: { period: typeof series.params?.period === 'number' ? series.params.period : 20 } })
          break
        case 'RSI':
          pushIndicator({ kind: 'rsi', params: { period: typeof series.params?.period === 'number' ? series.params.period : 14 } })
          break
        case 'ATR':
          pushIndicator({ kind: 'atr', params: { period: typeof series.params?.period === 'number' ? series.params.period : 14 } })
          break
        case 'MACD_LINE':
        case 'MACD_SIGNAL':
          pushIndicator({ kind: 'macd', params: {} })
          break
        default:
          break
      }
    }

    const rules: StrategySemanticRuleProfile[] = []
    const pushRule = (rule: StrategySemanticRuleProfile) => {
      if (!rules.some(item =>
        item.key === rule.key
        && item.phase === rule.phase
        && item.sideScope === rule.sideScope
        && item.action === rule.action,
      )) {
        rules.push(rule)
      }
    }

    for (const predicate of ir.signalCatalog.predicates) {
      const actions = ir.ruleBlocks.filter(rule => rule.when === predicate.id).flatMap(rule => rule.actions)
      for (const action of actions) {
        const normalizedAction = this.normalizeAction(action.kind)
        if (!normalizedAction) continue
        const key = this.inferRuleKeyFromPredicate({
          predicateKind: predicate.kind,
          predicateId: predicate.id,
        })
        if (!key) continue
        pushRule({
          key,
          action: normalizedAction,
          phase: this.resolvePhaseFromAction(normalizedAction),
          sideScope: this.resolveRuleSideScope('both', normalizedAction),
        })
      }
    }

    for (const ruleBlock of ir.ruleBlocks) {
      if (typeof ruleBlock.cooldownBars !== 'number' || ruleBlock.cooldownBars <= 0) continue
      for (const action of ruleBlock.actions) {
        const normalizedAction = this.normalizeAction(action.kind)
        if (!normalizedAction) continue
        pushRule({
          key: 'risk.cooldown_bars',
          action: normalizedAction,
          phase: this.resolvePhaseFromAction(normalizedAction),
          sideScope: this.resolveRuleSideScope('both', normalizedAction),
        })
      }
    }

    const actions = Array.from(new Set(
      ir.ruleBlocks.flatMap(rule =>
        rule.actions
          .map(action => this.normalizeAction(action.kind))
          .filter((action): action is CanonicalAction => action !== null),
      ),
    ))

    return {
      indicators,
      actions,
      ruleMappings: this.toRuleMappings(rules),
      rules,
      sizing: {
        mode: this.mapSizingMode(ir.portfolio.sizing.mode),
        value: this.normalizeSizingValue(ir.portfolio.sizing.mode, ir.portfolio.sizing.value),
        source: 'literal',
      },
      requiredParams: [],
      fallbackDetected: false,
    }
  }

  private projectionToProfile(
    projection: ReturnType<CompiledScriptParserService['parse']>,
  ): StrategySemanticProfile {
    const indicators: StrategySemanticProfile['indicators'] = []
    const pushIndicator = (indicator: StrategySemanticProfile['indicators'][number]) => {
      if (!indicators.some(item => item.kind === indicator.kind)) {
        indicators.push(indicator)
      }
    }

    for (const expr of projection.exprPool) {
      if (expr.nodeType !== 'series') continue
      const payload = expr.payload
      switch (payload.kind) {
        case 'UPPER_BAND':
        case 'MID_BAND':
        case 'LOWER_BAND':
          pushIndicator({ kind: 'bollingerBands', params: {
            period: typeof payload.params?.period === 'number' ? payload.params.period : 20,
            stdDev: typeof payload.params?.stdDev === 'number' ? payload.params.stdDev : 2,
          } })
          break
        case 'SMA':
          pushIndicator({ kind: 'sma', params: { period: typeof payload.params?.period === 'number' ? payload.params.period : 20 } })
          break
        case 'EMA':
          pushIndicator({ kind: 'ema', params: { period: typeof payload.params?.period === 'number' ? payload.params.period : 20 } })
          break
        case 'RSI':
          pushIndicator({ kind: 'rsi', params: { period: typeof payload.params?.period === 'number' ? payload.params.period : 14 } })
          break
        case 'ATR':
          pushIndicator({ kind: 'atr', params: { period: typeof payload.params?.period === 'number' ? payload.params.period : 14 } })
          break
        case 'MACD_LINE':
        case 'MACD_SIGNAL':
          pushIndicator({ kind: 'macd', params: {} })
          break
        default:
          break
      }
    }

    const rules: StrategySemanticRuleProfile[] = []
    const pushRule = (rule: StrategySemanticRuleProfile) => {
      if (!rules.some(item =>
        item.key === rule.key
        && item.phase === rule.phase
        && item.sideScope === rule.sideScope
        && item.action === rule.action,
      )) {
        rules.push(rule)
      }
    }

    for (const expr of projection.exprPool) {
      if (expr.nodeType !== 'predicate') continue
      const key = this.inferRuleKeyFromPredicate({
        predicateKind: expr.payload.kind,
        predicateId: expr.sourceRef,
      })
      if (!key) continue

      const actions = projection.decisionPrograms
        .filter(program => program.when === expr.id)
        .flatMap(program => program.actions)
      for (const action of actions) {
        const normalizedAction = this.normalizeAction(action.kind)
        if (!normalizedAction) continue
        pushRule({
          key,
          action: normalizedAction,
          phase: this.resolvePhaseFromAction(normalizedAction),
          sideScope: this.resolveRuleSideScope('both', normalizedAction),
        })
      }
    }

    for (const program of projection.decisionPrograms) {
      if (typeof program.cooldownBars !== 'number' || program.cooldownBars <= 0) continue
      for (const action of program.actions) {
        const normalizedAction = this.normalizeAction(action.kind)
        if (!normalizedAction) continue
        pushRule({
          key: 'risk.cooldown_bars',
          action: normalizedAction,
          phase: this.resolvePhaseFromAction(normalizedAction),
          sideScope: this.resolveRuleSideScope('both', normalizedAction),
        })
      }
    }

    for (const guard of projection.guards) {
      const normalizedAction = this.normalizeAction(guard.payload.onBreach)
      if (!normalizedAction) continue

      const key = this.inferRuleKeyFromGuard(guard.payload.kind)
      if (!key) continue

      pushRule({
        key,
        action: normalizedAction,
        phase: 'risk',
        sideScope: this.resolveRuleSideScope('both', normalizedAction),
      })
    }

    const actions = Array.from(new Set(
      [
        ...projection.decisionPrograms.flatMap(program =>
          program.actions
            .map(action => this.normalizeAction(action.kind))
            .filter((action): action is CanonicalAction => action !== null),
        ),
        ...projection.guards
          .map(guard => this.normalizeAction(guard.payload.onBreach))
          .filter((action): action is CanonicalAction => action !== null),
      ],
    ))

    const firstOpenAction = projection.decisionPrograms
      .flatMap(program => program.actions)
      .find(action => action.kind === 'OPEN_LONG' || action.kind === 'OPEN_SHORT')

    return {
      indicators,
      actions,
      ruleMappings: this.toRuleMappings(rules),
      rules,
      sizing: firstOpenAction
        ? {
            mode: this.mapSizingMode(firstOpenAction.quantity.mode),
            value: this.normalizeSizingValue(firstOpenAction.quantity.mode, firstOpenAction.quantity.value),
            source: 'literal',
          }
        : null,
      requiredParams: [],
      fallbackDetected: false,
    }
  }

  private checkSemanticGraphDigest(
    semanticGraph: SemanticStrategyGraph,
    ir: CanonicalStrategyIrV1,
  ): StrategyConsistencyCheck {
    const expectedDigest = this.hashCanonicalJson(semanticGraph)
    const passed = ir.source.graphDigest === expectedDigest

    return {
      key: 'semantic_graph.digest',
      level: 'critical',
      status: passed ? 'passed' : 'failed',
      expected: expectedDigest,
      actual: ir.source.graphDigest,
      message: passed ? 'IR graphDigest 与 semanticGraph 一致。' : 'IR graphDigest 与 semanticGraph 不一致。',
    }
  }

  private checkIrSupportsSemanticGraph(
    semanticGraph: SemanticStrategyGraph,
    ir: CanonicalStrategyIrV1,
  ): StrategyConsistencyCheck {
    const failures: string[] = []

    const graphTimeframes = new Set([
      semanticGraph.market.primaryTimeframe,
      ...semanticGraph.nodes
        .filter((node): node is SemanticStrategyGraph['nodes'][number] & { params: { timeframe: string } } =>
          typeof (node as { params?: { timeframe?: unknown } }).params?.timeframe === 'string')
        .map(node => node.params.timeframe),
    ])
    for (const timeframe of graphTimeframes) {
      if (!ir.market.timeframes.includes(timeframe)) {
        failures.push(`缺少 timeframe ${timeframe}`)
      }
    }

    const hasBollingerNode = semanticGraph.nodes.some(node => node.kind === 'bollinger_band_touch')
    if (hasBollingerNode) {
      const bandKinds = new Set(ir.signalCatalog.series.map(series => series.kind))
      for (const required of ['UPPER_BAND', 'MID_BAND', 'LOWER_BAND'] as const) {
        if (!bandKinds.has(required)) {
          failures.push(`缺少 ${required}`)
        }
      }
    }

    const gridNodeCount = semanticGraph.nodes.filter(node => node.kind === 'grid_level_touch').length
    if (gridNodeCount > 0) {
      if (ir.signalCatalog.levelSets.length === 0) {
        failures.push('缺少 grid level sets')
      }
      const touchPredicateCount = ir.signalCatalog.predicates.filter(predicate =>
        predicate.kind === 'TOUCH_LEVEL_DOWN' || predicate.kind === 'TOUCH_LEVEL_UP',
      ).length
      if (touchPredicateCount < gridNodeCount) {
        failures.push('grid touch predicates 不足')
      }
    }

    const outsideRiskCount = semanticGraph.nodes.filter(node => node.kind === 'bollinger_bars_outside').length
    if (outsideRiskCount > 0) {
      const outsideSeriesCount = ir.signalCatalog.series.filter(series => series.kind === 'BOLLINGER_BARS_OUTSIDE').length
      if (outsideSeriesCount < outsideRiskCount) {
        failures.push('缺少 bollinger outside risk series')
      }
      const rebalanceCount = ir.ruleBlocks.filter(rule => rule.phase === 'rebalance').length
      if (rebalanceCount === 0) {
        failures.push('缺少 rebalance risk rule')
      }
    }

    const graphActionKinds = new Set(semanticGraph.actions.map(action => action.kind))
    const irActionKinds = new Set(ir.ruleBlocks.flatMap(rule => rule.actions.map(action => action.kind)))
    for (const actionKind of graphActionKinds) {
      if (actionKind === 'REDUCE_POSITION') continue
      if (!irActionKinds.has(actionKind)) {
        failures.push(`缺少 action ${actionKind}`)
      }
    }

    return {
      key: 'semantic_graph.ir_alignment',
      level: 'critical',
      status: failures.length === 0 ? 'passed' : 'failed',
      expected: {
        timeframes: [...graphTimeframes],
        actionKinds: [...graphActionKinds],
      },
      actual: {
        marketTimeframes: ir.market.timeframes,
        actionKinds: [...irActionKinds],
        levelSetCount: ir.signalCatalog.levelSets.length,
      },
      message: failures.length === 0 ? 'IR 已完整承接 semanticGraph 语义。' : failures.join('；'),
    }
  }

  private checkCompiledScriptMatchesIr(
    ir: CanonicalStrategyIrV1,
    scriptCode: string,
  ): StrategyConsistencyCheck {
    try {
      const parsed = this.compiledScriptParser.parse(scriptCode)
      const expectedIrHash = this.hashCanonicalJson(ir)
      const passed = parsed.compiledManifest.irHash === expectedIrHash

      return {
        key: 'script.ir_manifest',
        level: 'critical',
        status: passed ? 'passed' : 'failed',
        expected: expectedIrHash,
        actual: parsed.compiledManifest.irHash,
        message: passed ? '脚本 manifest 与 IR 哈希一致。' : '脚本 manifest 与 IR 哈希不一致。',
      }
    } catch (error) {
      return {
        key: 'script.ir_manifest',
        level: 'critical',
        status: 'failed',
        expected: this.hashCanonicalJson(ir),
        actual: null,
        message: error instanceof Error ? error.message : 'compiled script parse failed',
      }
    }
  }

  private checkIrDirectionSensitiveAtom(
    semanticGraph: SemanticStrategyGraph,
    ir: CanonicalStrategyIrV1,
  ): StrategyConsistencyCheck {
    const failures: string[] = []
    const bollingerNodes = semanticGraph.nodes
      .filter(node => node.kind === 'bollinger_band_touch')
      .map((node) => {
        const record = node as unknown as {
          id: string
          params: {
            band?: string
            direction?: string
          }
        }

        return {
          id: record.id,
          band: record.params.band ?? '',
          direction: record.params.direction ?? '',
        }
      })

    for (const node of bollingerNodes) {
      const predicateId = `predicate_${node.id}`
      const predicate = ir.signalCatalog.predicates.find(item => item.id === predicateId)

      if (node.band === 'middle') {
        const abovePredicate = ir.signalCatalog.predicates.find(item => item.id === `${predicateId}_above`)
        const belowPredicate = ir.signalCatalog.predicates.find(item => item.id === `${predicateId}_below`)
        const unionPredicate = predicate
        if (!abovePredicate || !belowPredicate || !unionPredicate) {
          failures.push(`${node.id}: missing middle-band predicate projection`)
          continue
        }
        if (abovePredicate.kind !== 'CROSS_OVER' || belowPredicate.kind !== 'CROSS_UNDER' || unionPredicate.kind !== 'OR') {
          failures.push(`${node.id}: expected CROSS_OVER/CROSS_UNDER -> OR, actual=${abovePredicate.kind}/${belowPredicate.kind}/${unionPredicate.kind}`)
        }
        continue
      }

      const expectedKind = node.band === 'upper' ? 'CROSS_OVER' : 'CROSS_UNDER'
      if (!predicate) {
        failures.push(`${node.id}: missing predicate projection`)
        continue
      }

      if (predicate.kind !== expectedKind) {
        failures.push(`${node.id}: expected ${expectedKind}, actual=${predicate.kind}`)
      }
    }

    return {
      key: 'compiler_consistency.ir_direction_sensitive_atom',
      level: 'critical',
      status: failures.length === 0 ? 'passed' : 'failed',
      expected: bollingerNodes.map((node) => ({
        nodeId: node.id,
        band: node.band,
        direction: node.direction,
      })),
      actual: ir.signalCatalog.predicates
        .filter(predicate => predicate.id.includes('entry') || predicate.id.includes('exit'))
        .map(predicate => ({
          id: predicate.id,
          kind: predicate.kind,
          args: predicate.args,
        })),
      message: failures.length === 0
        ? 'IR direction-sensitive atom projection与 semanticGraph 一致。'
        : failures.join('；'),
    }
  }

  private checkAstProjection(
    ir: CanonicalStrategyIrV1,
    projection: ReturnType<CompiledScriptParserService['parse']> | null,
  ): StrategyConsistencyCheck {
    const expectedAst = this.canonicalStrategyAstCompiler.compile(ir)

    if (!projection) {
      return {
        key: 'compiler_consistency.ast_projection',
        level: 'critical',
        status: 'unprovable',
        expected: expectedAst.manifest,
        actual: null,
        message: '脚本不是可解析的 compiled artifact，跳过 AST projection 校验。',
      }
    }

    const expectedAstProjection = {
      astVersion: expectedAst.astVersion,
      executionModel: expectedAst.executionModel,
      dataRequirements: expectedAst.dataRequirements,
      exprPool: expectedAst.exprPool,
      guards: expectedAst.guards,
      decisionPrograms: expectedAst.decisionPrograms,
      orderPrograms: expectedAst.orderPrograms,
      topology: expectedAst.topology,
    }
    const expectedManifest = {
      irVersion: expectedAst.manifest.irVersion,
      astVersion: expectedAst.astVersion,
      irHash: expectedAst.manifest.irHash,
      specHash: expectedAst.manifest.specHash,
      compileVersion: expectedAst.manifest.compileVersion,
      astDigest: this.hashCanonicalJson(expectedAstProjection),
    }
    const actual = {
      manifest: {
        irVersion: projection.compiledManifest.irVersion,
        astVersion: projection.compiledManifest.astVersion,
        irHash: projection.compiledManifest.irHash,
        specHash: projection.compiledManifest.specHash,
        compileVersion: projection.compiledManifest.compileVersion,
        astDigest: projection.compiledManifest.astDigest,
      },
      executionModel: this.stripExecutionEnvelope(projection.executionModel),
      dataRequirements: projection.dataRequirements,
      exprPool: projection.exprPool,
      guards: projection.guards,
      decisionPrograms: projection.decisionPrograms,
      orderPrograms: projection.orderPrograms,
      topology: projection.topology,
    }

    const expected = {
      manifest: expectedManifest,
      executionModel: expectedAst.executionModel,
      dataRequirements: expectedAst.dataRequirements,
      exprPool: expectedAst.exprPool,
      guards: expectedAst.guards,
      decisionPrograms: expectedAst.decisionPrograms,
      orderPrograms: expectedAst.orderPrograms,
      topology: expectedAst.topology,
    }

    const mismatches: string[] = []
    for (const key of ['manifest', 'executionModel', 'dataRequirements', 'exprPool', 'guards', 'decisionPrograms', 'orderPrograms', 'topology'] as const) {
      if (this.hashCanonicalJson(expected[key]) !== this.hashCanonicalJson(actual[key])) {
        mismatches.push(key)
      }
    }

    return {
      key: 'compiler_consistency.ast_projection',
      level: 'critical',
      status: mismatches.length === 0 ? 'passed' : 'failed',
      expected,
      actual,
      message: mismatches.length === 0
        ? 'AST projection 与 IR 编译结果一致。'
        : `AST projection 漂移: ${mismatches.join(', ')}`,
    }
  }

  private checkExecutionEnvelopePositionMode(
    ir: CanonicalStrategyIrV1,
    projection: ReturnType<CompiledScriptParserService['parse']> | null,
  ): StrategyConsistencyCheck {
    const expected = this.resolveExpectedPositionModeFromIr(ir)

    if (!projection) {
      return {
        key: 'compiler_consistency.execution_envelope.position_mode',
        level: 'critical',
        status: 'unprovable',
        expected,
        actual: null,
        message: '脚本不是可解析的 compiled artifact，跳过 execution envelope positionMode 校验。',
      }
    }

    const actual = projection.executionModel.positionMode
    const passed = actual === expected

    return {
      key: 'compiler_consistency.execution_envelope.position_mode',
      level: 'critical',
      status: passed ? 'passed' : 'failed',
      expected,
      actual,
      message: passed
        ? 'execution envelope positionMode 与 IR 一致。'
        : `execution envelope positionMode 漂移: expected=${expected}, actual=${actual}`,
    }
  }

  private specToProfile(spec: CanonicalStrategySpec): StrategySemanticProfile {
    if (spec.version === 2) {
      const rules = spec.rules.flatMap(rule => this.flattenV2Rule(rule))
      return {
        indicators: spec.indicators,
        actions: Array.from(new Set(
          spec.rules.flatMap(rule => rule.actions.map(action => action.type as CanonicalAction)),
        )),
        ruleMappings: this.toRuleMappings(rules),
        rules,
        sizing: spec.sizing
          ? {
            ...spec.sizing,
            source: 'literal',
          }
          : null,
        requiredParams: [],
        fallbackDetected: false,
      }
    }

    const actions = new Set<CanonicalAction>()
    for (const rule of spec.entries) actions.add(rule.action)
    for (const rule of spec.exits) actions.add(rule.action)

    const rules = [
      ...spec.entries.map(rule => this.createLegacyRuleProfile(rule.trigger, rule.action, 'entry')),
      ...spec.exits.map(rule => this.createLegacyRuleProfile(rule.trigger, rule.action, 'exit')),
    ].filter((item): item is StrategySemanticRuleProfile => item !== null)

    return {
      indicators: spec.indicators,
      actions: Array.from(actions),
      ruleMappings: this.buildLegacyRuleMappings(spec),
      rules,
      sizing: spec.sizing
        ? {
          ...spec.sizing,
          source: 'literal',
        }
        : null,
      requiredParams: [],
      fallbackDetected: false,
    }
  }

  private checkFallback(scriptProfile: StrategySemanticProfile): StrategyConsistencyCheck {
    if (scriptProfile.fallbackDetected) {
      return {
        key: 'script.fallback_forbidden',
        level: 'critical',
        status: 'failed',
        expected: false,
        actual: true,
        message: '检测到通用 fallback 脚本，禁止直接发布。',
      }
    }

    return {
      key: 'script.fallback_forbidden',
      level: 'critical',
      status: 'passed',
      expected: false,
      actual: false,
      message: '未检测到 fallback 脚本。',
    }
  }

  private checkIndicators(
    specProfile: StrategySemanticProfile,
    scriptProfile: StrategySemanticProfile,
  ): StrategyConsistencyCheck {
    const expected = specProfile.indicators
      .map(item => item.kind)
      .filter(kind => kind !== 'custom')
    const actual = scriptProfile.indicators.map(item => item.kind)
    const missing = expected.filter(kind => !actual.includes(kind))
    const mismatchedParams = specProfile.indicators
      .filter(item => item.kind === 'bollingerBands')
      .flatMap((indicator) => {
        const actualIndicator = scriptProfile.indicators.find(item => item.kind === indicator.kind)
        if (!actualIndicator) return []

        const diffKeys = Object.entries(indicator.params)
          .filter(([key, value]) => actualIndicator.params[key] !== value)
          .map(([key]) => key)
        if (diffKeys.length === 0) return []

        return [`${indicator.kind}(${diffKeys.join(', ')})`]
      })

    if (expected.length === 0) {
      return {
        key: 'indicators.required',
        level: 'warning',
        status: 'unprovable',
        expected,
        actual,
        message: 'canonical spec 未声明可验证指标，跳过指标强校验。',
      }
    }

    if (missing.length > 0 || mismatchedParams.length > 0) {
      return {
        key: 'indicators.required',
        level: 'critical',
        status: 'failed',
        expected: specProfile.indicators.filter(item => item.kind !== 'custom'),
        actual,
        message: [
          missing.length > 0 ? `脚本缺少关键指标: ${missing.join(', ')}` : '',
          mismatchedParams.length > 0 ? `脚本指标参数不匹配: ${mismatchedParams.join(', ')}` : '',
        ].filter(Boolean).join('；'),
      }
    }

    return {
      key: 'indicators.required',
      level: 'critical',
      status: 'passed',
      expected: specProfile.indicators.filter(item => item.kind !== 'custom'),
      actual,
      message: '脚本指标与 canonical spec 一致。',
    }
  }

  private checkRuleMappings(
    specProfile: StrategySemanticProfile,
    scriptProfile: StrategySemanticProfile,
  ): StrategyConsistencyCheck {
    if (specProfile.rules.length > 0 || scriptProfile.rules.length > 0) {
      return this.checkRuleProfiles(specProfile, scriptProfile)
    }

    if (specProfile.ruleMappings.length === 0) {
      return {
        key: 'rules.mapping',
        level: 'warning',
        status: 'unprovable',
        expected: [],
        actual: scriptProfile.ruleMappings,
        message: 'canonical spec 未生成规则级语义映射，跳过规则强校验。',
      }
    }

    const missing: string[] = []
    const mismatched: string[] = []

    specProfile.ruleMappings.forEach((expectedRule) => {
      const actualRule = scriptProfile.ruleMappings.find(item => item.key === expectedRule.key)
      if (!actualRule) {
        missing.push(expectedRule.key)
        return
      }

      if (actualRule.action !== expectedRule.action) {
        mismatched.push(`${expectedRule.key}: expected=${expectedRule.action}, actual=${actualRule.action}`)
      }
    })

    if (missing.length > 0 || mismatched.length > 0) {
      return {
        key: 'rules.mapping',
        level: 'critical',
        status: 'failed',
        expected: specProfile.ruleMappings,
        actual: scriptProfile.ruleMappings,
        message: [
          missing.length > 0 ? `脚本缺少关键规则映射: ${missing.join(', ')}` : '',
          mismatched.length > 0 ? `脚本规则动作不匹配: ${mismatched.join(' | ')}` : '',
        ].filter(Boolean).join('；'),
      }
    }

    return {
      key: 'rules.mapping',
      level: 'critical',
      status: 'passed',
      expected: specProfile.ruleMappings,
      actual: scriptProfile.ruleMappings,
      message: '脚本规则级语义与 canonical spec 一致。',
    }
  }

  private checkRuleProfiles(
    specProfile: StrategySemanticProfile,
    scriptProfile: StrategySemanticProfile,
  ): StrategyConsistencyCheck {
    if (specProfile.rules.length === 0) {
      return {
        key: 'rules.mapping',
        level: 'warning',
        status: 'unprovable',
        expected: [],
        actual: scriptProfile.rules,
        message: 'canonical spec 未生成规则级语义映射，跳过规则强校验。',
      }
    }

    const missing: string[] = []
    const sideScopeDrift: string[] = []
    const mismatched: string[] = []

    specProfile.rules.forEach((expectedRule) => {
      const actualRule = scriptProfile.rules.find(item =>
        item.key === expectedRule.key
        && item.phase === expectedRule.phase
        && item.sideScope === expectedRule.sideScope,
      )
      if (!actualRule) {
        const driftCandidates = scriptProfile.rules.filter(item =>
          item.key === expectedRule.key
          && item.phase === expectedRule.phase
          && item.action === expectedRule.action
          && item.sideScope !== expectedRule.sideScope,
        )
        if (driftCandidates.length > 0) {
          const actualSideScopes = Array.from(new Set(driftCandidates.map(item => item.sideScope))).join(',')
          sideScopeDrift.push(
            `${expectedRule.key}:${expectedRule.phase}:${expectedRule.action}: expected sideScope=${expectedRule.sideScope}, actual sideScope=${actualSideScopes}`,
          )
        }
        missing.push(`${expectedRule.key}:${expectedRule.phase}:${expectedRule.sideScope}`)
        return
      }

      if (actualRule.action !== expectedRule.action) {
        mismatched.push(
          `${expectedRule.key}:${expectedRule.phase}:${expectedRule.sideScope}: expected=${expectedRule.action}, actual=${actualRule.action}`,
        )
      }
    })

    if (missing.length > 0 || mismatched.length > 0) {
      return {
        key: 'rules.mapping',
        level: 'critical',
        status: 'failed',
        expected: specProfile.rules,
        actual: scriptProfile.rules,
        message: [
          missing.length > 0 ? `脚本缺少关键规则映射: ${missing.join(' | ')}` : '',
          sideScopeDrift.length > 0 ? `sideScope 漂移: ${sideScopeDrift.join(' | ')}` : '',
          mismatched.length > 0 ? `脚本规则动作不匹配: ${mismatched.join(' | ')}` : '',
        ].filter(Boolean).join('；'),
      }
    }

    return {
      key: 'rules.mapping',
      level: 'critical',
      status: 'passed',
      expected: specProfile.rules,
      actual: scriptProfile.rules,
      message: '脚本规则级语义与 canonical spec 一致。',
    }
  }

  private checkActions(
    specProfile: StrategySemanticProfile,
    scriptProfile: StrategySemanticProfile,
  ): StrategyConsistencyCheck {
    const expected = Array.from(new Set(specProfile.actions))
    const actual = scriptProfile.actions
    const missing = expected.filter(action => !actual.includes(action))

    if (actual.length === 0) {
      return {
        key: 'actions.required',
        level: 'warning',
        status: 'unprovable',
        expected,
        actual,
        message: '脚本未显式声明 action 字段（可能是旧协议），动作比对降级为 warning。',
      }
    }

    if (expected.length === 0) {
      return {
        key: 'actions.required',
        level: 'warning',
        status: 'unprovable',
        expected,
        actual,
        message: 'canonical spec 未声明关键动作，跳过强校验。',
      }
    }

    if (missing.length > 0) {
      return {
        key: 'actions.required',
        level: 'critical',
        status: 'failed',
        expected,
        actual,
        message: `脚本缺少关键动作: ${missing.join(', ')}`,
      }
    }

    return {
      key: 'actions.required',
      level: 'warning',
      status: 'passed',
      expected,
      actual,
      message: '脚本动作与 canonical spec 一致。',
    }
  }

  private checkSizing(
    specProfile: StrategySemanticProfile,
    scriptProfile: StrategySemanticProfile,
  ): StrategyConsistencyCheck {
    const requiresSizingEvidence = specProfile.actions.some(action => action.startsWith('OPEN_'))
      || scriptProfile.actions.some(action => action.startsWith('OPEN_'))

    if (!specProfile.sizing) {
      return {
        key: 'sizing.mode',
        level: 'warning',
        status: 'unprovable',
        expected: specProfile.sizing,
        actual: scriptProfile.sizing,
        message: 'canonical spec 未声明仓位规则，跳过仓位比对。',
      }
    }

    if (!requiresSizingEvidence) {
      return {
        key: 'sizing.mode',
        level: 'warning',
        status: 'unprovable',
        expected: specProfile.sizing,
        actual: scriptProfile.sizing,
        message: '当前脚本未呈现可校验的开仓仓位语义，跳过 sizing 强校验。',
      }
    }

    if (!scriptProfile.sizing) {
      return {
        key: 'sizing.mode',
        level: 'critical',
        status: 'failed',
        expected: specProfile.sizing,
        actual: null,
        message: '脚本缺少可验证的仓位声明，禁止发布。',
      }
    }

    if (specProfile.sizing.mode !== scriptProfile.sizing.mode) {
      return {
        key: 'sizing.mode',
        level: 'critical',
        status: 'failed',
        expected: specProfile.sizing.mode,
        actual: scriptProfile.sizing.mode,
        message: '脚本仓位模式与 canonical spec 不一致。',
      }
    }

    if (scriptProfile.sizing.source === 'positionPct_raw') {
      return {
        key: 'sizing.mode',
        level: 'critical',
        status: 'failed',
        expected: specProfile.sizing,
        actual: scriptProfile.sizing,
        message: '脚本直接把 positionPct 当作 RATIO 使用，缺少百分比归一化。',
      }
    }

    if (scriptProfile.sizing.source === 'unknown') {
      return {
        key: 'sizing.mode',
        level: 'critical',
        status: 'failed',
        expected: specProfile.sizing,
        actual: scriptProfile.sizing,
        message: '脚本仓位表达式无法证明与 canonical spec 一致，禁止发布。',
      }
    }

    if (scriptProfile.sizing.source === 'literal') {
      const actualValue = scriptProfile.sizing.value
      const expectedValue = specProfile.sizing.value
      if (typeof actualValue !== 'number' || Math.abs(actualValue - expectedValue) > 0.0001) {
        return {
          key: 'sizing.mode',
          level: 'critical',
          status: 'failed',
          expected: specProfile.sizing,
          actual: scriptProfile.sizing,
          message: '脚本仓位值与 canonical spec 不一致。',
        }
      }
    }

    return {
      key: 'sizing.mode',
      level: 'critical',
      status: 'passed',
      expected: specProfile.sizing,
      actual: scriptProfile.sizing,
      message: '仓位语义与 canonical spec 一致。',
    }
  }

  private checkMarketMetadata(
    spec: CanonicalStrategySpec,
    projection: ReturnType<CompiledScriptParserService['parse']> | null,
  ): StrategyConsistencyCheck {
    const expected = {
      exchange: typeof spec.market.exchange === 'string' ? spec.market.exchange : null,
      marketType: typeof spec.market.marketType === 'string' ? spec.market.marketType : null,
      symbol: typeof spec.market.symbol === 'string' ? spec.market.symbol : null,
      timeframe: spec.version === 2 && typeof spec.market.defaultTimeframe === 'string'
        ? spec.market.defaultTimeframe
        : (typeof spec.market.timeframe === 'string' ? spec.market.timeframe : null),
      positionMode: this.resolveExpectedPositionMode(spec),
    }

    if (!projection) {
      return {
        key: 'market.execution_model',
        level: 'warning',
        status: 'unprovable',
        expected,
        actual: null,
        message: '脚本不是可解析的 compiled artifact，跳过市场元数据强校验。',
      }
    }

    const actual = {
      exchange: projection.executionModel.venue,
      marketType: projection.executionModel.instrumentType === 'perpetual' ? 'perp' : 'spot',
      symbol: projection.executionModel.symbol,
      timeframe: projection.executionModel.primaryTimeframe,
      positionMode: projection.executionModel.positionMode,
    }

    const comparableFields = (Object.entries(expected) as Array<[keyof typeof expected, string | null]>)
      .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)

    if (comparableFields.length === 0) {
      return {
        key: 'market.execution_model',
        level: 'warning',
        status: 'unprovable',
        expected,
        actual,
        message: 'canonical spec 未提供可验证的市场元数据，跳过强校验。',
      }
    }

    const mismatches = comparableFields
      .filter(([field, value]) => actual[field] !== value)
      .map(([field, value]) => `${field}: expected=${value}, actual=${actual[field]}`)

    if (mismatches.length > 0) {
      return {
        key: 'market.execution_model',
        level: 'critical',
        status: 'failed',
        expected,
        actual,
        message: `脚本执行市场元数据与 canonical spec 不一致：${mismatches.join(' | ')}`,
      }
    }

    return {
      key: 'market.execution_model',
      level: 'critical',
      status: 'passed',
      expected,
      actual,
      message: '脚本执行市场元数据与 canonical spec 一致。',
    }
  }

  private resolveExpectedPositionMode(
    spec: CanonicalStrategySpec,
  ): 'long_only' | 'short_only' | 'long_short' {
    if (spec.version === 2) {
      const hasLongExposure = spec.rules.some(rule => rule.actions.some(action => (
        action.type === 'OPEN_LONG'
        || action.type === 'REDUCE_LONG'
      )))
      const hasShortExposure = spec.rules.some(rule => rule.actions.some(action => (
        action.type === 'OPEN_SHORT'
        || action.type === 'REDUCE_SHORT'
      )))
      if (hasLongExposure && hasShortExposure) return 'long_short'
      if (hasShortExposure) return 'short_only'
      return 'long_only'
    }

    const hasLongExposure = spec.entries.some(rule =>
      rule.action === 'OPEN_LONG',
    )
    const hasShortExposure = spec.entries.some(rule =>
      rule.action === 'OPEN_SHORT',
    )
    if (hasLongExposure && hasShortExposure) return 'long_short'
    if (hasShortExposure) return 'short_only'
    return 'long_only'
  }

  private buildSummary(checks: StrategyConsistencyCheck[]): StrategyConsistencyReport['summary'] {
    return checks.reduce(
      (acc, check) => {
        if (check.status === 'unprovable') acc.unprovable += 1
        if (check.level === 'critical' && check.status === 'failed') acc.criticalFailed += 1
        if (check.level === 'warning' && check.status === 'failed') acc.warningFailed += 1
        return acc
      },
      {
        criticalFailed: 0,
        warningFailed: 0,
        unprovable: 0,
      },
    )
  }

  private normalizeAction(action: string): CanonicalAction | null {
    if (
      action === 'OPEN_LONG'
      || action === 'OPEN_SHORT'
      || action === 'CLOSE_LONG'
      || action === 'CLOSE_SHORT'
      || action === 'REDUCE_LONG'
      || action === 'REDUCE_SHORT'
      || action === 'FORCE_EXIT'
      || action === 'BLOCK_NEW_ENTRY'
      || action === 'ADJUST_POSITION'
    ) {
      return action
    }
    return null
  }

  private inferRuleKeyFromPredicate(input: {
    predicateKind: string
    predicateId: string
  }): StrategySemanticRuleKey | null {
    const predicateId = input.predicateId.toLowerCase()
    if (predicateId.includes('macd_golden_cross') || predicateId.includes('macd.golden_cross')) {
      return 'macd.golden_cross'
    }
    if (predicateId.includes('macd_death_cross') || predicateId.includes('macd.death_cross')) {
      return 'macd.death_cross'
    }
    if (predicateId.includes('price_change_pct') || predicateId.includes('price.change_pct')) {
      return 'price.change_pct'
    }
    if (predicateId.includes('execution_on_start') || predicateId.includes('execution.on_start')) {
      return 'execution.on_start'
    }
    if (predicateId.includes('bollinger_touch_upper') || predicateId.includes('upper_break')) {
      return 'bollinger.upper_break'
    }
    if (predicateId.includes('bollinger_touch_lower') || predicateId.includes('lower_break')) {
      return 'bollinger.lower_break'
    }
    if (predicateId.includes('bollinger_touch_middle') || predicateId.includes('middle_revert')) {
      return 'bollinger.middle_revert'
    }
    if (predicateId.includes('indicator_above') || predicateId.includes('ma_golden_cross') || predicateId.includes('golden_cross')) {
      return 'ma.golden_cross'
    }
    if (predicateId.includes('indicator_below') || predicateId.includes('ma_death_cross') || predicateId.includes('death_cross')) {
      return 'ma.death_cross'
    }
    if (
      input.predicateKind === 'CROSS_OVER'
      && (predicateId.includes('golden_cross') || predicateId.includes('ma.golden_cross'))
    ) {
      return 'ma.golden_cross'
    }
    if (
      input.predicateKind === 'CROSS_UNDER'
      && (predicateId.includes('death_cross') || predicateId.includes('ma.death_cross'))
    ) {
      return 'ma.death_cross'
    }
    if (
      input.predicateKind === 'CROSS_OVER'
      && (predicateId.includes('upper') || predicateId.includes('bollinger'))
    ) {
      return 'bollinger.upper_break'
    }
    if (
      input.predicateKind === 'CROSS_UNDER'
      && (predicateId.includes('lower') || predicateId.includes('bollinger'))
    ) {
      return 'bollinger.lower_break'
    }
    if (
      (input.predicateKind === 'CROSS_OVER' || input.predicateKind === 'GT' || input.predicateKind === 'GTE')
      && (predicateId.includes('channel_high_break') || predicateId.includes('breakout.channel_high_break'))
    ) {
      return 'breakout.channel_high_break'
    }
    if (
      (input.predicateKind === 'CROSS_UNDER' || input.predicateKind === 'LT' || input.predicateKind === 'LTE')
      && (predicateId.includes('channel_low_break') || predicateId.includes('breakout.channel_low_break'))
    ) {
      return 'breakout.channel_low_break'
    }
    if (input.predicateKind === 'TOUCH_LEVEL_UP' || input.predicateKind === 'TOUCH_LEVEL_DOWN') {
      return 'grid.range_rebalance'
    }
    if (input.predicateKind === 'OR' && input.predicateId.includes('middle')) return 'bollinger.middle_revert'
    if (input.predicateId.includes('outside')) return 'bollinger.bars_outside'
    if (predicateId.includes('rsi_threshold_lte')) return 'rsi.threshold_lte'
    if (predicateId.includes('rsi_threshold_gte')) return 'rsi.threshold_gte'
    if (predicateId.includes('rsi_cross_over')) return 'rsi.cross_over'
    if (predicateId.includes('rsi_cross_under')) return 'rsi.cross_under'
    if (predicateId.includes('time_stop_bars') || predicateId.includes('risk.time_stop_bars')) return 'risk.time_stop_bars'
    if (predicateId.includes('cooldown_bars') || predicateId.includes('risk.cooldown_bars')) return 'risk.cooldown_bars'
    if (predicateId.includes('take_profit') || predicateId.includes('risk.take_profit_pct')) return 'risk.take_profit_pct'
    if (input.predicateId.includes('stop-loss') || input.predicateId.includes('loss')) return 'position_loss_pct'
    return null
  }

  private inferRuleKeyFromGuard(kind: string): StrategySemanticRuleKey | null {
    if (kind === 'STOP_LOSS_PCT' || kind === 'MAX_SINGLE_LOSS_PCT') {
      return 'position_loss_pct'
    }
    if (kind === 'TAKE_PROFIT_PCT') {
      return 'risk.take_profit_pct'
    }
    if (kind === 'TRAILING_STOP_PCT') {
      return 'risk.trailing_stop_pct'
    }
    return null
  }

  private mapSizingMode(
    mode: 'pct_equity' | 'fixed_quote' | 'fixed_base' | 'position_pct',
  ): NonNullable<StrategySemanticProfile['sizing']>['mode'] {
    switch (mode) {
      case 'pct_equity':
      case 'position_pct':
        return 'RATIO'
      case 'fixed_quote':
        return 'QUOTE'
      case 'fixed_base':
        return 'QTY'
    }
  }

  private normalizeSizingValue(
    mode: 'pct_equity' | 'fixed_quote' | 'fixed_base' | 'position_pct',
    value: number,
  ): number {
    if (mode === 'pct_equity' || mode === 'position_pct') {
      return value > 1 ? Number((value / 100).toFixed(4)) : value
    }

    return value
  }

  private hashCanonicalJson(value: unknown): `sha256:${string}` {
    const digest = createHash('sha256').update(canonicalSerialize(value)).digest('hex')
    return `sha256:${digest}`
  }

  private stripExecutionEnvelope(
    executionModel: ReturnType<CompiledScriptParserService['parse']>['executionModel'],
  ): {
    venue: 'binance' | 'okx' | 'hyperliquid'
    instrumentType: 'spot' | 'perpetual'
    symbol: string
    primaryTimeframe: string
    timeframeAlignment: 'strict'
    signalEvaluation: 'bar_close'
    fillPolicy: 'next_bar_open' | 'same_bar_close' | 'intra_bar_limit_match'
    defaultOrderType: 'market' | 'limit'
    allowPartialFill: boolean
  } {
    return {
      venue: executionModel.venue,
      instrumentType: executionModel.instrumentType,
      symbol: executionModel.symbol,
      primaryTimeframe: executionModel.primaryTimeframe,
      timeframeAlignment: executionModel.timeframeAlignment,
      signalEvaluation: executionModel.signalEvaluation,
      fillPolicy: executionModel.fillPolicy,
      defaultOrderType: executionModel.defaultOrderType,
      allowPartialFill: executionModel.allowPartialFill,
    }
  }

  private resolveExpectedPositionModeFromIr(
    ir: CanonicalStrategyIrV1,
  ): 'long_only' | 'short_only' | 'long_short' {
    const hasLongExposure = ir.ruleBlocks.some(rule => rule.actions.some(action => (
      action.kind === 'OPEN_LONG'
      || action.kind === 'REDUCE_LONG'
    )))
    const hasShortExposure = ir.ruleBlocks.some(rule => rule.actions.some(action => (
      action.kind === 'OPEN_SHORT'
      || action.kind === 'REDUCE_SHORT'
    )))

    if (hasLongExposure && hasShortExposure) return 'long_short'
    if (hasShortExposure) return 'short_only'
    return 'long_only'
  }

  private buildCanonicalSpecV2Fallback(spec: Extract<CanonicalStrategySpec, { version: 2 }>): {
    exchange: 'binance' | 'okx' | 'hyperliquid'
    symbol: string
    baseTimeframe: string
    positionPct: number
  } {
    const exchange = spec.market.exchange
    const symbol = spec.market.symbol ?? 'BTCUSDT'
    const baseTimeframe = spec.market.defaultTimeframe ?? spec.market.timeframe ?? spec.dataRequirements.requiredTimeframes[0] ?? '15m'
    const positionPct = spec.sizing && spec.sizing.mode === 'RATIO'
      ? Number((spec.sizing.value * 100).toFixed(4))
      : 10

    return {
      exchange,
      symbol,
      baseTimeframe,
      positionPct,
    }
  }

  private buildLegacyRuleMappings(spec: Exclude<CanonicalStrategySpec, CanonicalStrategySpecV2>): StrategySemanticRuleMapping[] {
    const mappings = new Map<StrategySemanticRuleKey, CanonicalAction>()
    const register = (trigger: string, action: CanonicalAction) => {
      if (/上轨|upper/i.test(trigger)) {
        mappings.set('bollinger.upper_break', action)
      }
      if (/下轨|lower/i.test(trigger)) {
        mappings.set('bollinger.lower_break', action)
      }
      if (/中轨|middle|ma20/i.test(trigger)) {
        mappings.set('bollinger.middle_revert', action)
      }
      if (/网格/u.test(trigger)) {
        mappings.set('grid.range_rebalance', action)
      }
      if ((/\bhighest(?:high)?\b/i.test(trigger) || /通道上轨|通道上沿|前高|唐奇安.*上轨|donchian.*upper|breakout/i.test(trigger)) && (/>=|>|上穿|突破|breakout/i.test(trigger))) {
        mappings.set('breakout.channel_high_break', action)
      }
      if ((/\blowest(?:low)?\b/i.test(trigger) || /通道下轨|通道下沿|前低|唐奇安.*下轨|donchian.*lower|breakdown/i.test(trigger)) && (/<=|<|下穿|跌破|breakdown/i.test(trigger))) {
        mappings.set('breakout.channel_low_break', action)
      }
      if (/金叉|上穿/.test(trigger) && /均线|\bma\b|\bsma\b|\bema\b/i.test(trigger)) {
        mappings.set('ma.golden_cross', action)
      }
      if (/死叉|下穿/.test(trigger) && /均线|\bma\b|\bsma\b|\bema\b/i.test(trigger)) {
        mappings.set('ma.death_cross', action)
      }
      if (/止盈|take[_\s-]?profit/i.test(trigger)) {
        mappings.set('risk.take_profit_pct', action)
      }
      if (/移动止损|trailing[_\s-]?stop/i.test(trigger)) {
        mappings.set('risk.trailing_stop_pct', action)
      }
      if (/冷却|cooldown/i.test(trigger)) {
        mappings.set('risk.cooldown_bars', action)
      }
      if (/time[_\s-]?stop/i.test(trigger) || /持仓.{0,12}(?:bar|k|根)/iu.test(trigger)) {
        mappings.set('risk.time_stop_bars', action)
      }
    }

    spec.entries.forEach(rule => register(rule.trigger, rule.action))
    spec.exits.forEach(rule => register(rule.trigger, rule.action))

    return Array.from(mappings.entries()).map(([key, action]) => ({ key, action }))
  }

  private flattenV2Rule(rule: CanonicalRuleV2): StrategySemanticRuleProfile[] {
    const keys = this.collectRuleKeys(rule.condition)
    if (keys.length === 0) return []

    return keys.flatMap(key => rule.actions.map((action) => ({
      key,
      phase: this.resolveRuleProfilePhase(rule, action.type as CanonicalAction, key),
      sideScope: this.resolveRuleSideScope(rule.sideScope ?? 'both', action.type as CanonicalAction),
      action: action.type as CanonicalAction,
    })))
  }

  private resolveRuleProfilePhase(
    rule: CanonicalRuleV2,
    action: CanonicalAction,
    key: StrategySemanticRuleKey,
  ): StrategySemanticRuleProfile['phase'] {
    if (
      rule.phase === 'risk'
      && key === 'risk.take_profit_pct'
      && (action === 'CLOSE_LONG' || action === 'CLOSE_SHORT')
    ) {
      return 'exit'
    }

    return rule.phase
  }

  private collectRuleKeys(condition: CanonicalRuleV2['condition']): StrategySemanticRuleKey[] {
    if (condition.kind === 'atom') {
      return this.isSupportedRuleKey(condition.key) ? [condition.key] : []
    }

    return condition.children.flatMap(child => this.collectRuleKeys(child))
  }

  private createLegacyRuleProfile(
    trigger: string,
    action: CanonicalAction,
    phase: StrategySemanticRuleProfile['phase'],
  ): StrategySemanticRuleProfile | null {
    const key = this.inferRuleKeyFromTrigger(trigger)
    if (!key) return null

    return {
      key,
      phase,
      sideScope: this.resolveRuleSideScope('both', action),
      action,
    }
  }

  private inferRuleKeyFromTrigger(trigger: string): StrategySemanticRuleKey | null {
    if (/上轨|upper/i.test(trigger)) return 'bollinger.upper_break'
    if (/下轨|lower/i.test(trigger)) return 'bollinger.lower_break'
    if (/中轨|middle|ma20/i.test(trigger)) return 'bollinger.middle_revert'
    if (/轨外|outside/i.test(trigger)) return 'bollinger.bars_outside'
    if (/网格/u.test(trigger)) return 'grid.range_rebalance'
    if ((/\bhighest(?:high)?\b/i.test(trigger) || /通道上轨|通道上沿|前高|唐奇安.*上轨|donchian.*upper|breakout/i.test(trigger)) && (/>=|>|上穿|突破|breakout/i.test(trigger))) {
      return 'breakout.channel_high_break'
    }
    if ((/\blowest(?:low)?\b/i.test(trigger) || /通道下轨|通道下沿|前低|唐奇安.*下轨|donchian.*lower|breakdown/i.test(trigger)) && (/<=|<|下穿|跌破|breakdown/i.test(trigger))) {
      return 'breakout.channel_low_break'
    }
    if (/\bmacd\b|指数平滑异同/iu.test(trigger)) {
      if (/金叉|上穿/u.test(trigger)) return 'macd.golden_cross'
      if (/死叉|下穿/u.test(trigger)) return 'macd.death_cross'
    }
    if (/金叉|上穿/.test(trigger) && /均线|\bma\b|\bsma\b|\bema\b/i.test(trigger)) return 'ma.golden_cross'
    if (/死叉|下穿/.test(trigger) && /均线|\bma\b|\bsma\b|\bema\b/i.test(trigger)) return 'ma.death_cross'
    if (/\brsi\b|相对强弱|超买|超卖/iu.test(trigger)) {
      if (/上穿|突破/u.test(trigger)) return 'rsi.cross_over'
      if (/下穿|跌破/u.test(trigger)) return 'rsi.cross_under'
      if (/<=|＜=|小于等于|低于|小于|超卖|低位/u.test(trigger)) return 'rsi.threshold_lte'
      if (/>=|＞=|大于等于|高于|大于|超买|高位/u.test(trigger)) return 'rsi.threshold_gte'
    }
    if (/止盈|take[_\s-]?profit/i.test(trigger)) return 'risk.take_profit_pct'
    if (/移动止损|trailing[_\s-]?stop/i.test(trigger)) return 'risk.trailing_stop_pct'
    if (/冷却|cooldown/i.test(trigger)) return 'risk.cooldown_bars'
    if (/time[_\s-]?stop/i.test(trigger) || /持仓.{0,12}(?:bar|k|根)/iu.test(trigger)) return 'risk.time_stop_bars'
    if (/止损|亏损|loss/i.test(trigger)) return 'position_loss_pct'
    return null
  }

  private resolveRuleSideScope(
    fallbackScope: StrategySemanticRuleProfile['sideScope'],
    action: CanonicalAction,
  ): StrategySemanticRuleProfile['sideScope'] {
    if (action === 'OPEN_LONG' || action === 'CLOSE_LONG' || action === 'REDUCE_LONG') return 'long'
    if (action === 'OPEN_SHORT' || action === 'CLOSE_SHORT' || action === 'REDUCE_SHORT') return 'short'
    return fallbackScope
  }

  private resolvePhaseFromAction(action: CanonicalAction): StrategySemanticRuleProfile['phase'] {
    if (action === 'OPEN_LONG' || action === 'OPEN_SHORT') return 'entry'
    if (action === 'CLOSE_LONG' || action === 'CLOSE_SHORT' || action === 'ADJUST_POSITION') return 'exit'
    if (action === 'REDUCE_LONG' || action === 'REDUCE_SHORT' || action === 'FORCE_EXIT' || action === 'BLOCK_NEW_ENTRY') {
      return 'risk'
    }
    return 'rebalance'
  }

  private toRuleMappings(rules: StrategySemanticRuleProfile[]): StrategySemanticRuleMapping[] {
    const mappings = new Map<string, StrategySemanticRuleMapping>()

    for (const rule of rules) {
      const key = `${rule.key}:${rule.action}`
      if (!mappings.has(key)) {
        mappings.set(key, {
          key: rule.key,
          action: rule.action,
        })
      }
    }

    return Array.from(mappings.values())
  }

  private isSupportedRuleKey(key: string): key is StrategySemanticRuleKey {
    return key === 'execution.on_start'
      || key === 'price.change_pct'
      || key === 'bollinger.upper_break'
      || key === 'bollinger.lower_break'
      || key === 'bollinger.middle_revert'
      || key === 'bollinger.bars_outside'
      || key === 'breakout.channel_high_break'
      || key === 'breakout.channel_low_break'
      || key === 'grid.range_rebalance'
      || key === 'ma.golden_cross'
      || key === 'ma.death_cross'
      || key === 'rsi.threshold_lte'
      || key === 'rsi.threshold_gte'
      || key === 'rsi.cross_over'
      || key === 'rsi.cross_under'
      || key === 'macd.golden_cross'
      || key === 'macd.death_cross'
      || key === 'position_loss_pct'
      || key === 'risk.take_profit_pct'
      || key === 'risk.trailing_stop_pct'
      || key === 'risk.cooldown_bars'
      || key === 'risk.time_stop_bars'
  }
}

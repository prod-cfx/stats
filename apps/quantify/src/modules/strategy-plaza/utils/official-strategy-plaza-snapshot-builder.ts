import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { createHash } from 'node:crypto'
import {
  buildOfficialTemplateBacktestConfigDefaults,
  buildOfficialTemplateDataRequirements,
  buildOfficialTemplateDeploymentExecutionConstraints,
  buildOfficialTemplateDeploymentExecutionDefaults,
  buildOfficialTemplateParamsSnapshot,
  buildOfficialTemplateStrategyConfig,
} from './official-strategy-plaza-snapshot-content'

export const OFFICIAL_STRATEGY_PLAZA_USER_ID = 'official-strategy-plaza'
export const OFFICIAL_STRATEGY_PLAZA_LLM_MODEL = 'official-strategy-plaza'

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function buildOfficialStrategyScript(templateId: string): string {
  return [
    '// Official Strategy Plaza public beta template.',
    `export default function strategy() { return { action: 'HOLD', templateId: '${templateId}' } }`,
    '',
  ].join('\n')
}

function buildOfficialStrategySpec(template: OfficialStrategyPlazaTemplate) {
  return {
    version: 1,
    source: 'strategy-plaza-official-template',
    templateId: template.id,
    name: template.name,
    logicDescription: template.logicDescription,
    runConfig: {
      exchange: template.runConfig.exchange,
      marketType: template.runConfig.marketType,
      symbol: template.runConfig.symbol,
      timeframe: template.runConfig.timeframe,
      positionPct: template.runConfig.positionPct,
      leverage: template.runConfig.leverage,
    },
  }
}

function buildOfficialStrategyAstSnapshot() {
  return {
    runtimeExecutionSemantics: [{
      semanticKey: 'on_start.entry.primary',
      trigger: 'on_start',
      phase: 'entry',
      consumePolicy: 'once',
      requiredRuntimeContext: {
        barIndex: 1,
        requiresReferenceBar: true,
        requiresSymbol: true,
        requiresTimeframe: true,
      },
      sourceRefs: ['official-template-entry'],
    }],
  }
}

export function buildOfficialStrategySnapshotContent(template: OfficialStrategyPlazaTemplate) {
  const scriptSnapshot = buildOfficialStrategyScript(template.id)
  const specSnapshot = buildOfficialStrategySpec(template)
  const astSnapshot = buildOfficialStrategyAstSnapshot()
  const semanticGraph = {
    nodes: [{ id: 'entry-primary', type: 'decision', label: template.name }],
    edges: [],
  }
  const compiledManifest = {
    source: 'strategy-plaza-official-template',
    templateId: template.id,
    artifactVersion: 1,
  }
  const compiledIr = {
    source: 'strategy-plaza-official-template',
    templateId: template.id,
    market: {
      venue: template.runConfig.exchange,
      symbol: template.runConfig.symbol,
      instrumentType: template.runConfig.marketType,
      timeframe: template.runConfig.timeframe,
    },
  }
  const runtimeContent = {
    paramsSnapshot: buildOfficialTemplateParamsSnapshot(template),
    strategyConfig: buildOfficialTemplateStrategyConfig(template),
    backtestConfigDefaults: buildOfficialTemplateBacktestConfigDefaults(template),
    deploymentExecutionDefaults: buildOfficialTemplateDeploymentExecutionDefaults(template),
    deploymentExecutionConstraints: buildOfficialTemplateDeploymentExecutionConstraints(template),
    dataRequirements: buildOfficialTemplateDataRequirements(template),
    lockedParams: buildOfficialTemplateParamsSnapshot(template),
  }

  return {
    snapshotHash: sha256Json({ specSnapshot, runtimeContent }),
    scriptHash: sha256Json(scriptSnapshot),
    specHash: sha256Json(specSnapshot),
    irHash: sha256Json(compiledIr),
    astDigest: sha256Json(astSnapshot),
    structuralDigest: sha256Json({ semanticGraph, astSnapshot }),
    scriptSnapshot,
    specSnapshot,
    semanticGraph,
    compiledIr,
    irSnapshot: compiledIr,
    astSnapshot,
    compiledManifest,
    consistencyReport: { status: 'PASSED', source: 'strategy-plaza-official-template' },
    ...runtimeContent,
    executionEnvelope: { runtime: 'signal-generator', source: 'strategy-plaza-official-template' },
    executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN', allowPartialFill: false },
    userIntentSummary: { templateId: template.id, name: template.name },
    strategySummary: { name: template.name, description: template.description },
    scriptSummary: { source: 'strategy-plaza-official-template', logic: template.logicDescription },
    snapshotVersion: 3,
  }
}

import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE } from '../constants/official-strategy-plaza-backtest-evidence.constant'
import { getOfficialTemplateDeploymentExecutionConfig } from './official-strategy-plaza-runtime-contract'

function evidenceFor(template: OfficialStrategyPlazaTemplate) {
  const evidence = OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE.templates.find(item => item.templateId === template.id)
  if (!evidence) {
    throw new Error(`Missing official Strategy Plaza evidence for ${template.id}`)
  }
  return evidence
}

export function buildOfficialTemplateParamsSnapshot(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
  const evidence = evidenceFor(template)
  return {
    exchange: template.runConfig.exchange,
    marketType: template.runConfig.marketType,
    symbol: template.runConfig.symbol,
    timeframe: template.runConfig.timeframe,
    positionPct: template.runConfig.positionPct,
    leverage: template.runConfig.leverage,
    optimizedParams: evidence.params,
    verifiedBacktest: evidence.metrics,
    parameterSearchId: evidence.parameterSearchId,
  }
}

export function buildOfficialTemplateStrategyConfig(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
  return {
    exchange: template.runConfig.exchange,
    marketType: template.runConfig.marketType,
    symbol: template.runConfig.symbol,
    baseTimeframe: template.runConfig.timeframe,
    timeframe: template.runConfig.timeframe,
    positionPct: template.runConfig.positionPct,
    strategyDeclaredLeverageRange: buildOfficialTemplateLeverageRange(template),
  }
}

export function buildOfficialTemplateBacktestConfigDefaults(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
  const config = getOfficialTemplateDeploymentExecutionConfig(template)
  return {
    initialCash: 10000,
    leverage: resolveOfficialTemplateLeverage(template),
    slippageBps: 10,
    feeBps: 5,
    priceSource: config.priceSource,
    allowPartial: false,
  }
}

export function buildOfficialTemplateDeploymentExecutionDefaults(
  template: OfficialStrategyPlazaTemplate,
): Record<string, unknown> {
  const config = getOfficialTemplateDeploymentExecutionConfig(template)
  return {
    leverage: config.leverage,
    priceSource: config.priceSource,
    orderType: config.orderType,
    timeInForce: config.timeInForce,
    ...('tdMode' in config ? { tdMode: config.tdMode } : {}),
  }
}

export function buildOfficialTemplateDeploymentExecutionConstraints(
  template: OfficialStrategyPlazaTemplate,
): Record<string, unknown> {
  const config = getOfficialTemplateDeploymentExecutionConfig(template)
  const leverage = resolveOfficialTemplateLeverage(template)
  return {
    platformRiskMaxLeverage: leverage,
    strategyDeclaredLeverageRange: buildOfficialTemplateLeverageRange(template),
    defaultLeverage: leverage,
    supportedPriceSources: [config.priceSource],
    supportedOrderTypes: [config.orderType],
    supportedTimeInForce: [config.timeInForce],
    ...('tdMode' in config ? { supportedTdModes: [config.tdMode] } : {}),
    constraintExplanation: 'official strategy plaza template runtime constraints',
  }
}

export function buildOfficialTemplateDataRequirements(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
  return { primary: [template.runConfig.timeframe] }
}

function resolveOfficialTemplateLeverage(template: OfficialStrategyPlazaTemplate): number {
  return template.runConfig.marketType === 'spot'
    ? 1
    : template.runConfig.leverage ?? 1
}

function buildOfficialTemplateLeverageRange(template: OfficialStrategyPlazaTemplate): Record<string, number> | null {
  if (template.runConfig.marketType === 'spot') return null
  const leverage = resolveOfficialTemplateLeverage(template)
  return { min: 1, max: leverage }
}

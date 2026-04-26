import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'

export function buildOfficialTemplateParamsSnapshot(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
  return {
    exchange: template.runConfig.exchange,
    marketType: template.runConfig.marketType,
    symbol: template.runConfig.symbol,
    timeframe: template.runConfig.timeframe,
    positionPct: template.runConfig.positionPct,
    leverage: template.runConfig.leverage,
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
  return {
    initialCash: 10000,
    leverage: resolveOfficialTemplateLeverage(template),
    slippageBps: 10,
    feeBps: 5,
    priceSource: template.runConfig.deploymentExecutionConfig.priceSource,
    allowPartial: false,
  }
}

export function buildOfficialTemplateDeploymentExecutionDefaults(
  template: OfficialStrategyPlazaTemplate,
): Record<string, unknown> {
  const config = template.runConfig.deploymentExecutionConfig
  return {
    leverage: resolveOfficialTemplateLeverage(template),
    priceSource: config.priceSource,
    orderType: config.orderType,
    timeInForce: config.timeInForce,
  }
}

export function buildOfficialTemplateDeploymentExecutionConstraints(
  template: OfficialStrategyPlazaTemplate,
): Record<string, unknown> {
  const config = template.runConfig.deploymentExecutionConfig
  const leverage = resolveOfficialTemplateLeverage(template)
  return {
    platformRiskMaxLeverage: leverage,
    strategyDeclaredLeverageRange: buildOfficialTemplateLeverageRange(template),
    defaultLeverage: leverage,
    supportedPriceSources: [config.priceSource],
    supportedOrderTypes: [config.orderType],
    supportedTimeInForce: [config.timeInForce],
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

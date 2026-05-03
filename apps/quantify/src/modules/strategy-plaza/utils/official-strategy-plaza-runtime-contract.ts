import type {
  OfficialStrategyPlazaTemplate,
  StrategyPlazaDeploymentOrderType,
  StrategyPlazaDeploymentPriceSource,
  StrategyPlazaDeploymentTimeInForce,
  StrategyPlazaDeploymentTradeMode,
} from '../types/official-strategy-plaza-template'

export interface OfficialTemplateDeploymentExecutionConfig {
  leverage: number | null
  priceSource: StrategyPlazaDeploymentPriceSource
  orderType: StrategyPlazaDeploymentOrderType
  timeInForce: StrategyPlazaDeploymentTimeInForce
  tdMode?: StrategyPlazaDeploymentTradeMode
}

const MODULE = 'OfficialStrategyPlazaRuntimeContract'

function summarizeTemplate(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
  return {
    templateId: template.id,
    exchange: template.runConfig.exchange,
    marketType: template.runConfig.marketType,
    symbol: template.runConfig.symbol,
    timeframe: template.runConfig.timeframe,
    leverage: template.runConfig.leverage,
    deploymentExecutionConfig: template.runConfig.deploymentExecutionConfig,
  }
}

function fail(
  fn: string,
  template: OfficialStrategyPlazaTemplate,
  reason: string,
): never {
  throw new Error(
    `[${MODULE}.${fn}] invalid official Strategy Plaza runtime contract; input=${JSON.stringify(summarizeTemplate(template))}; reason=${reason}`,
  )
}

function assertCommonDeploymentFields(template: OfficialStrategyPlazaTemplate): void {
  const config = template.runConfig.deploymentExecutionConfig
  if (template.runConfig.exchange !== 'okx') {
    fail('assertCommonDeploymentFields', template, 'official Strategy Plaza templates currently support exchange=okx only')
  }
  if (config.orderType !== 'market') {
    fail('assertCommonDeploymentFields', template, 'deploymentExecutionConfig.orderType must be market')
  }
  if (config.timeInForce !== 'ioc') {
    fail('assertCommonDeploymentFields', template, 'deploymentExecutionConfig.timeInForce must be ioc')
  }
}

export function assertOfficialTemplateRuntimeContract(template: OfficialStrategyPlazaTemplate): void {
  assertCommonDeploymentFields(template)
  const config = template.runConfig.deploymentExecutionConfig

  if (template.runConfig.marketType === 'perp') {
    if (template.runConfig.leverage !== config.leverage) {
      fail('assertOfficialTemplateRuntimeContract', template, 'perp leverage must match deploymentExecutionConfig.leverage')
    }
    if (!Number.isFinite(config.leverage) || config.leverage <= 0) {
      fail('assertOfficialTemplateRuntimeContract', template, 'perp deploymentExecutionConfig.leverage must be a positive number')
    }
    if (config.priceSource !== 'mark') {
      fail('assertOfficialTemplateRuntimeContract', template, 'perp deploymentExecutionConfig.priceSource must be mark')
    }
    if (config.tdMode !== 'cross') {
      fail('assertOfficialTemplateRuntimeContract', template, 'perp deploymentExecutionConfig.tdMode must be explicit cross')
    }
    return
  }

  if (template.runConfig.marketType === 'spot') {
    if (template.runConfig.leverage !== null || config.leverage !== null) {
      fail('assertOfficialTemplateRuntimeContract', template, 'spot leverage must be null in template and deploymentExecutionConfig')
    }
    if (config.priceSource !== 'last') {
      fail('assertOfficialTemplateRuntimeContract', template, 'spot deploymentExecutionConfig.priceSource must be last')
    }
    if ('tdMode' in config) {
      fail('assertOfficialTemplateRuntimeContract', template, 'spot deploymentExecutionConfig must not include tdMode')
    }
    return
  }

  fail('assertOfficialTemplateRuntimeContract', template, 'unsupported marketType')
}

export function getOfficialTemplateDeploymentExecutionConfig(
  template: OfficialStrategyPlazaTemplate,
): OfficialTemplateDeploymentExecutionConfig {
  assertOfficialTemplateRuntimeContract(template)
  const config = template.runConfig.deploymentExecutionConfig
  if (template.runConfig.marketType === 'perp') {
    return {
      leverage: config.leverage,
      priceSource: config.priceSource,
      orderType: config.orderType,
      timeInForce: config.timeInForce,
      tdMode: config.tdMode,
    }
  }

  return {
    leverage: 1,
    priceSource: config.priceSource,
    orderType: config.orderType,
    timeInForce: config.timeInForce,
  }
}

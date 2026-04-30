import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../constants/official-strategy-plaza-templates'
import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import {
  assertOfficialTemplateRuntimeContract,
  getOfficialTemplateDeploymentExecutionConfig,
} from './official-strategy-plaza-runtime-contract'

describe('official Strategy Plaza runtime contract', () => {
  it('requires every official perp template to carry explicit cross tdMode', () => {
    for (const template of OFFICIAL_STRATEGY_PLAZA_TEMPLATES.filter(item => item.runConfig.marketType === 'perp')) {
      expect(getOfficialTemplateDeploymentExecutionConfig(template)).toEqual(expect.objectContaining({
        leverage: template.runConfig.leverage,
        priceSource: 'mark',
        orderType: 'market',
        timeInForce: 'ioc',
        tdMode: 'cross',
      }))
    }
  })

  it('rejects official perp templates that omit tdMode instead of relying on downstream fallback', () => {
    const source = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(template => template.runConfig.marketType === 'perp')
    expect(source).toBeDefined()
    const invalid = {
      ...source,
      runConfig: {
        ...source!.runConfig,
        deploymentExecutionConfig: {
          ...source!.runConfig.deploymentExecutionConfig,
          tdMode: undefined,
        },
      },
    } as unknown as OfficialStrategyPlazaTemplate

    expect(() => assertOfficialTemplateRuntimeContract(invalid)).toThrow(/tdMode must be explicit cross/u)
  })

  it('forbids tdMode on official spot templates', () => {
    for (const template of OFFICIAL_STRATEGY_PLAZA_TEMPLATES.filter(item => item.runConfig.marketType === 'spot')) {
      const config = getOfficialTemplateDeploymentExecutionConfig(template)
      expect(config).toEqual({
        leverage: 1,
        priceSource: 'last',
        orderType: 'market',
        timeInForce: 'ioc',
      })
      expect('tdMode' in config).toBe(false)
    }
  })

  it('rejects official spot templates that include tdMode', () => {
    const source = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(template => template.runConfig.marketType === 'spot')
    expect(source).toBeDefined()
    const invalid = {
      ...source,
      runConfig: {
        ...source!.runConfig,
        deploymentExecutionConfig: {
          ...source!.runConfig.deploymentExecutionConfig,
          tdMode: 'cross',
        },
      },
    } as unknown as OfficialStrategyPlazaTemplate

    expect(() => assertOfficialTemplateRuntimeContract(invalid)).toThrow(/spot deploymentExecutionConfig must not include tdMode/u)
  })
})

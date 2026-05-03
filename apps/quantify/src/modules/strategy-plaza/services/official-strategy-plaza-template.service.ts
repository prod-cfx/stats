import { Injectable } from '@nestjs/common'
import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../constants/official-strategy-plaza-templates'
import { StrategyPlazaTemplateNotFoundException } from '../exceptions/strategy-plaza-template-not-found.exception'
import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'

function cloneTemplate(template: OfficialStrategyPlazaTemplate): OfficialStrategyPlazaTemplate {
  return {
    ...template,
    tags: [...template.tags],
    runConfig: {
      ...template.runConfig,
      deploymentExecutionConfig: { ...template.runConfig.deploymentExecutionConfig },
    },
    editSeed: {
      ...template.editSeed,
      guideConfig: template.editSeed.guideConfig ? { ...template.editSeed.guideConfig } : undefined,
    },
    displayMetrics: { ...template.displayMetrics },
  }
}

@Injectable()
export class OfficialStrategyPlazaTemplateService {
  list() {
    return [...OFFICIAL_STRATEGY_PLAZA_TEMPLATES]
      .filter(item => item.status === 'live')
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map(cloneTemplate)
  }

  getRequired(id: string) {
    const template = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(item => item.id === id)
    if (!template || template.status !== 'live') {
      throw new StrategyPlazaTemplateNotFoundException({ templateId: id })
    }
    return cloneTemplate(template)
  }
}

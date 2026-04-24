import { Injectable } from '@nestjs/common'
import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../constants/official-strategy-plaza-templates'
import { StrategyPlazaTemplateNotFoundException } from '../exceptions/strategy-plaza-template-not-found.exception'

@Injectable()
export class OfficialStrategyPlazaTemplateService {
  list() {
    return [...OFFICIAL_STRATEGY_PLAZA_TEMPLATES]
      .filter(item => item.status === 'live')
      .sort((left, right) => left.displayOrder - right.displayOrder)
  }

  getRequired(id: string) {
    const template = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(item => item.id === id)
    if (!template || template.status !== 'live') {
      throw new StrategyPlazaTemplateNotFoundException({ templateId: id })
    }
    return template
  }
}

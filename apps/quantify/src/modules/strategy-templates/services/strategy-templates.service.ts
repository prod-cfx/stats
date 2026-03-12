import type { Prisma, StrategyTemplate } from '@prisma/client'
import type { CreateStrategyTemplateDto } from '../dto/create-strategy-template.dto'
import type { StrategyTemplateListQueryDto } from '../dto/strategy-template-list.query.dto'
import type { UpdateStrategyTemplateDto } from '../dto/update-strategy-template.dto'
import type { StrategyDataRequirements, StrategyExecutionConfig, StrategyLegDefinition } from '../types/strategy-template.types'
import { createScriptEngine } from '@ai/shared/node'
import { Inject, Injectable, Logger } from '@nestjs/common'

import { Prisma as PrismaNamespace } from '@prisma/client'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { AiService } from '@/modules/ai/ai.service'
import { AiProviderErrorException } from '@/modules/ai/exceptions/ai-provider-error.exception'
import { PrismaService } from '@/prisma/prisma.service'

import { InvalidDataRequirementsException } from '../exceptions/invalid-data-requirements.exception'
import { InvalidExecutionConfigException } from '../exceptions/invalid-execution-config.exception'
import { InvalidRequiredFieldsException } from '../exceptions/invalid-required-fields.exception'
import { InvalidStrategyLegsException } from '../exceptions/invalid-strategy-legs.exception'
import { StrategyTemplateNameConflictException } from '../exceptions/strategy-template-name-conflict.exception'
import { StrategyTemplateNotFoundException } from '../exceptions/strategy-template-not-found.exception'
import { TemplateValidationFailedException } from '../exceptions/template-validation-failed.exception'
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type
import { StrategyTemplatesRepository } from '../repositories/strategy-templates.repository'
import { validateDataRequirements, validateExecutionConfig, validateExecutionDataConsistency, validateRequiredFields, validateStrategyLegs } from '../utils/strategy-template.validation'
import { validateFieldNameSafety } from '../validators/safe-field-name.validator'

@Injectable()
export class StrategyTemplatesService {
  private static readonly ORDERABLE_FIELDS = new Set<keyof StrategyTemplate>([
    'createdAt',
    'updatedAt',
    'rulesVersion',
    'name',
  ])

  private readonly logger = new Logger(StrategyTemplatesService.name)

  constructor(
    private readonly repository: StrategyTemplatesRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AiService)
    private readonly aiService: AiService,
  ) {}

  async list(query: StrategyTemplateListQueryDto) {
    const { page = 1, limit = 20, status, keyword, onlyDraft, orderBy } = query
    const skip = (page - 1) * limit

    const where: Prisma.StrategyTemplateWhereInput = {}

    // 褰?onlyDraft 涓?status 鍚屾椂瀛樺湪鏃讹紝浠?status 涓哄噯锛岄伩鍏嶉潤榛樿鐩栬皟鐢ㄦ柟浼犲叆鐨勭姸鎬?
    if (status) {
      where.status = status
    }
    else if (onlyDraft) {
      where.status = 'draft'
    }

    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ]
    }

    const parsedOrderBy = this.parseOrderBy(orderBy)
    const [items, total] = await this.repository.paginate({ skip, take: limit, where, orderBy: parsedOrderBy })
    return new BasePaginationResponseDto(total, page, limit, items)
  }

  async getDetail(id: string): Promise<StrategyTemplate> {
    const record = await this.repository.findById(id)
    if (!record) {
      throw new StrategyTemplateNotFoundException({ templateId: id })
    }
    return record
  }

  async create(dto: CreateStrategyTemplateDto, operatorId?: string): Promise<StrategyTemplate> {
    // 1. 鏍￠獙 legs
    const legResult = validateStrategyLegs(dto.legs)
    if (!legResult.valid) {
      throw new InvalidStrategyLegsException({ reason: legResult.message || 'Invalid strategy legs definition', details: legResult.details })
    }

    // 2. 鏍￠獙 symbol 鏄惁瀛樺湪浜庢暟鎹簱
    await this.validateSymbolsExist(dto.legs)

    // 3. 鏍￠獙 execution 閰嶇疆
    const executionResult = validateExecutionConfig(dto.execution)
    if (!executionResult.valid) {
      throw new InvalidExecutionConfigException({ reason: executionResult.message || 'Invalid execution config', details: executionResult.details })
    }

    // 4. 鏍￠獙 dataRequirements
    const dataReqResult = validateDataRequirements(dto.dataRequirements, dto.legs)
    if (!dataReqResult.valid) {
      throw new InvalidDataRequirementsException({ reason: dataReqResult.message || 'Invalid data requirements', details: dataReqResult.details })
    }

    // 5. 鏍￠獙 execution 涓?dataRequirements 鐨勪竴鑷存€?
    const consistencyResult = validateExecutionDataConsistency(dto.execution, dto.legs, dto.dataRequirements)
    if (!consistencyResult.valid) {
      throw new InvalidDataRequirementsException({ reason: consistencyResult.message || 'Execution and data requirements inconsistency', details: consistencyResult.details })
    }

    // 6. 鏂版灦鏋勫繀椤绘彁渚涜剼鏈?
    if (!dto.script || dto.script.trim() === '') {
      throw new InvalidStrategyLegsException({
        reason: '鏂版灦鏋勭瓥鐣ユā鏉垮繀椤绘彁渚涜剼鏈?(script)锛岀敤浜庡噯澶?AI prompt 鏁版嵁',
        details: {
          hasLegs: true,
          hasScript: false,
          hint: '鑴氭湰鐢ㄤ簬澶勭悊澶氳吙鏁版嵁骞剁敓鎴?AI prompt 鍙橀噺',
        },
      })
    }

    // 7. 鏍￠獙 requiredFields锛堝悜鍚庡吋瀹癸紝deprecated锛?
    const requiredFields = dto.requiredFields ?? []
    if (requiredFields.length > 0) {
      for (const fieldName of requiredFields) {
        const safetyError = validateFieldNameSafety(fieldName)
        if (safetyError) {
          throw new InvalidRequiredFieldsException({
            reason: `Field name safety validation failed: ${safetyError}`,
            details: { invalidField: fieldName, safetyError },
          })
        }
      }

      const fieldsResult = validateRequiredFields(requiredFields)
      if (!fieldsResult.valid) {
        throw new InvalidRequiredFieldsException({ reason: fieldsResult.message || 'Invalid required fields', details: fieldsResult.details })
      }
    }

    const payload: Prisma.StrategyTemplateCreateInput = {
      name: dto.name,
      description: dto.description,
      legs: dto.legs as unknown as Prisma.InputJsonValue,
      execution: dto.execution as unknown as Prisma.InputJsonValue,
      dataRequirements: dto.dataRequirements as unknown as Prisma.InputJsonValue,
      llmModel: dto.llmModel,
      promptTemplate: dto.promptTemplate,
      script: dto.script,
      paramsSchema: dto.paramsSchema as Prisma.InputJsonValue,
      defaultParams: dto.defaultParams as Prisma.InputJsonValue | undefined,
      metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      rulesJson: null,
      requiredFields,
      rulesVersion: 0,
      status: 'draft',
      createdBy: operatorId,
      updatedBy: operatorId,
    }

    let template: StrategyTemplate
    try {
      template = await this.repository.create(payload)
    }
    catch (error) {
      // 鎹曡幏 Prisma 鍞竴绾︽潫鍐茬獊閿欒
      if (error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new StrategyTemplateNameConflictException({ name: dto.name })
      }
      throw error
    }

    return this.refreshAiSummary(template)
  }

  async update(id: string, dto: UpdateStrategyTemplateDto, operatorId?: string): Promise<StrategyTemplate> {
    const current = await this.getDetail(id)

    // 鍒ゆ柇鏄惁浣跨敤鏂版灦鏋勶紙鏈?legs 鎴栧嵆灏嗘洿鏂颁负 legs锛?
    const isNewArchitecture = dto.legs !== undefined || current.legs !== null

    // 1. 鏍￠獙 legs锛堜粎褰撲娇鐢ㄦ柊鏋舵瀯鏃讹級
    if (isNewArchitecture) {
      const nextLegs = dto.legs ?? (current.legs as unknown as StrategyLegDefinition[])
      const legResult = validateStrategyLegs(nextLegs)
      if (!legResult.valid) {
        throw new InvalidStrategyLegsException({ reason: legResult.message || 'Invalid strategy legs definition', details: legResult.details })
      }

      // 1.1 鏍￠獙 symbol 鏄惁瀛樺湪锛堜粎褰撴彁渚涗簡鏂?legs 鏃讹級
      if (dto.legs) {
        await this.validateSymbolsExist(dto.legs)
      }

      // 2. 鏍￠獙 execution锛堟柊鏋舵瀯蹇呴渶锛?
      const nextExecution = dto.execution ?? (current.execution as unknown as StrategyExecutionConfig | undefined)
      if (!nextExecution) {
        throw new InvalidExecutionConfigException({
          reason: '鏂版灦鏋勭瓥鐣ユā鏉垮繀椤绘彁渚?execution 閰嶇疆',
          details: { hasLegs: true, hasExecution: false },
        })
      }
      const executionResult = validateExecutionConfig(nextExecution)
      if (!executionResult.valid) {
        throw new InvalidExecutionConfigException({ reason: executionResult.message || 'Invalid execution config', details: executionResult.details })
      }

      // 3. 鏍￠獙 dataRequirements锛堟柊鏋舵瀯蹇呴渶锛?
      const nextDataRequirements = dto.dataRequirements ?? (current.dataRequirements as unknown as StrategyDataRequirements | undefined)
      if (!nextDataRequirements) {
        throw new InvalidDataRequirementsException({
          reason: '鏂版灦鏋勭瓥鐣ユā鏉垮繀椤绘彁渚?dataRequirements 閰嶇疆',
          details: { hasLegs: true, hasDataRequirements: false },
        })
      }
      const dataReqResult = validateDataRequirements(nextDataRequirements, nextLegs)
      if (!dataReqResult.valid) {
        throw new InvalidDataRequirementsException({ reason: dataReqResult.message || 'Invalid data requirements', details: dataReqResult.details })
      }

      // 4. 鏍￠獙 execution 涓?dataRequirements 鐨勪竴鑷存€?
      const consistencyResult = validateExecutionDataConsistency(nextExecution, nextLegs, nextDataRequirements)
      if (!consistencyResult.valid) {
        throw new InvalidDataRequirementsException({ reason: consistencyResult.message || 'Execution and data requirements inconsistency', details: consistencyResult.details })
      }

      // 5. 鏂版灦鏋勫繀椤绘彁渚涜剼鏈?
      const nextScript = dto.script !== undefined ? dto.script : current.script
      if (!nextScript || nextScript.trim() === '') {
        throw new InvalidStrategyLegsException({
          reason: '鏂版灦鏋勭瓥鐣ユā鏉垮繀椤绘彁渚涜剼鏈?(script)锛岀敤浜庡噯澶?AI prompt 鏁版嵁',
          details: {
            hasLegs: true,
            hasScript: false,
            hint: '鑴氭湰鐢ㄤ簬澶勭悊澶氳吙鏁版嵁骞剁敓鎴?AI prompt 鍙橀噺',
          },
        })
      }
    }

    // 6. 鏍￠獙 requiredFields锛堝悜鍚庡吋瀹癸紝deprecated锛?
    const nextRequiredFields = dto.requiredFields ?? (current.requiredFields ?? [])
    if (nextRequiredFields.length > 0) {
      for (const fieldName of nextRequiredFields) {
        const safetyError = validateFieldNameSafety(fieldName)
        if (safetyError) {
          throw new InvalidRequiredFieldsException({
            reason: `Field name safety validation failed: ${safetyError}`,
            details: { invalidField: fieldName, safetyError },
          })
        }
      }

      const fieldsResult = validateRequiredFields(nextRequiredFields)
      if (!fieldsResult.valid) {
        throw new InvalidRequiredFieldsException({ reason: fieldsResult.message || 'Invalid required fields', details: fieldsResult.details })
      }
    }

    const data: Prisma.StrategyTemplateUpdateInput = {
      name: dto.name,
      description: dto.description,
      legs: dto.legs ? (dto.legs as unknown as Prisma.InputJsonValue) : undefined,
      execution: dto.execution ? (dto.execution as unknown as Prisma.InputJsonValue) : undefined,
      dataRequirements: dto.dataRequirements ? (dto.dataRequirements as unknown as Prisma.InputJsonValue) : undefined,
      llmModel: dto.llmModel,
      promptTemplate: dto.promptTemplate,
      script: dto.script !== undefined ? dto.script : undefined,
      // JSON 瀛楁锛歶ndefined = 涓嶅彉锛沶ull = 缃┖锛涘璞?= 瑕嗙洊
      paramsSchema:
        dto.paramsSchema !== undefined
          ? (dto.paramsSchema as Prisma.InputJsonValue | null)
          : undefined,
      defaultParams:
        dto.defaultParams !== undefined
          ? (dto.defaultParams as Prisma.InputJsonValue | null)
          : undefined,
      requiredFields: dto.requiredFields,
      metadata:
        dto.metadata !== undefined
          ? (dto.metadata as Prisma.InputJsonValue | null)
          : undefined,
      status: dto.status,
      updatedBy: operatorId ?? current.updatedBy,
    }

    let updated: StrategyTemplate
    try {
      updated = await this.repository.update(id, data)
    }
    catch (error) {
      // 鎹曡幏 Prisma 鍞竴绾︽潫鍐茬獊閿欒
      if (error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new StrategyTemplateNameConflictException({ name: dto.name ?? current.name })
      }
      throw error
    }

    return this.refreshAiSummary(updated)
  }

  async delete(id: string): Promise<void> {
    await this.getDetail(id)
    await this.repository.delete(id)
  }

  private parseOrderBy(orderBy?: string): Prisma.StrategyTemplateOrderByWithRelationInput | undefined {
    if (!orderBy) return undefined
    const [field, direction] = orderBy.split(':')
    if (!field) return undefined
    if (!StrategyTemplatesService.ORDERABLE_FIELDS.has(field as keyof StrategyTemplate)) {
      return undefined
    }
    if (direction && direction.toLowerCase() === 'asc') {
      return { [field]: 'asc' }
    }
    return { [field]: 'desc' }
  }

  private async refreshAiSummary(template: StrategyTemplate): Promise<StrategyTemplate> {
    try {
      const summary = await this.generateStrategySummary(template)
      if (!summary || summary === template.lastGenerationSummary)
        return template

      return await this.repository.update(template.id, {
        lastGenerationSummary: summary,
      })
    }
    catch (error) {
      this.logger.warn(
        `Failed to refresh AI summary for template ${template.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return template
    }
  }

  private async generateStrategySummary(template: StrategyTemplate): Promise<string | null> {
    if (!template.llmModel || !template.promptTemplate)
      return null

    const payload = [
      `绛栫暐鍚嶇О: ${template.name}`,
      template.description ? `绛栫暐鎻忚堪: ${template.description}` : null,
      template.requiredFields?.length ? `蹇呴渶瀛楁: ${template.requiredFields.join(', ')}` : null,
      `Prompt 妯℃澘: ${template.promptTemplate}`,
    ]
      .filter(Boolean)
      .join('\n')

    const result = await this.aiService.chat({
      model: template.llmModel,
      messages: [
        {
          role: 'system',
          content: '浣犳槸涓€鍚嶉噺鍖栫瓥鐣ュ姪鎵嬶紝璇峰皢杈撳叆鐨勭瓥鐣ユā鏉夸俊鎭€荤粨涓轰竴娈?2-3 鍙ョ殑涓枃鎻忚堪锛岀獊鍑虹瓥鐣ラ€昏緫涓庨€傜敤鍦烘櫙銆?,
        },
        {
          role: 'user',
          content: `璇锋€荤粨浠ヤ笅绛栫暐妯℃澘锛歕n${payload}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 400,
    })

    const summary = result.content?.trim()
    return summary || null
  }

  /**
   * 楠岃瘉妯℃澘鏄惁浣跨敤鏂扮殑澶?Leg 鏋舵瀯
   *
   * 娉ㄦ剰锛氭鏂规硶蹇呴』涓?StrategySignalsService.processStrategy 鐨勫垽鏂€昏緫淇濇寔涓€鑷?
   * 杩愯鏃舵潯浠讹細execution && dataRequirements && legs?.length > 0
   */
  private isMultiLegTemplate(template: StrategyTemplate): boolean {
    const legs = (template.legs as unknown) as StrategyLegDefinition[] | undefined
    return !!(
      template.execution &&
      template.dataRequirements &&
      Array.isArray(legs) &&
      legs.length > 0
    )
  }

  /**
   * 楠岃瘉妯℃澘閰嶇疆鐨勫畬鏁存€?
   *
   * 娉ㄦ剰锛氭鏂规硶澶嶇敤鍒涘缓/鏇存柊娴佺▼涓殑缁撴瀯鍖栨牎楠屽櫒锛岀‘淇濊剼鏈敓鎴愬墠鐨勯獙璇佹爣鍑嗕笌鍒涘缓鏃朵竴鑷?
   */
  private validateTemplateForGeneration(template: StrategyTemplate): {
    valid: boolean
    warnings: string[]
  } {
    const warnings: string[] = []

    if (!template.promptTemplate) {
      return { valid: false, warnings: ['Missing promptTemplate'] }
    }

    const legs = template.legs as unknown as StrategyLegDefinition[] | undefined
    const execution = template.execution as unknown as StrategyExecutionConfig | undefined
    const dataRequirements = template.dataRequirements as unknown as StrategyDataRequirements | undefined
    const hasExecution = !!execution
    const hasDataRequirements = !!(dataRequirements && Object.keys(dataRequirements).length > 0)
    const hasLegs = !!(Array.isArray(legs) && legs.length > 0)
    const hasRequiredFields = !!(template.requiredFields && Array.isArray(template.requiredFields) && template.requiredFields.length > 0)

    // 妫€娴嬩笉瀹屾暣鐨勫鑵块厤缃細閰嶇疆浜?execution 鎴?dataRequirements 浣?legs 涓虹┖
    if ((hasExecution || hasDataRequirements) && !hasLegs) {
      return {
        valid: false,
        warnings: [
          'Incomplete multi-leg configuration: template has execution/dataRequirements but legs is empty or undefined. ' +
          'Either add legs array or remove execution/dataRequirements to use legacy single-leg mode.'
        ]
      }
    }

    // 妫€娴嬫湁 execution 鍜?legs 浣嗙己灏?dataRequirements 鐨勬儏鍐?
    // 杩欎細瀵艰嚧 isMultiLegTemplate() 杩斿洖 false锛岄€€鍥?legacy 鍒嗘敮锛屼絾 legacy 鍙堟病鏈?requiredFields
    if (hasExecution && hasLegs && !hasDataRequirements) {
      return {
        valid: false,
        warnings: [
          'Incomplete multi-leg configuration: template has execution and legs but dataRequirements is empty or undefined. ' +
          'Multi-leg templates require non-empty dataRequirements to define timeframes for data loading. ' +
          'Without dataRequirements, the strategy will never produce signals.'
        ]
      }
    }

    // 楠岃瘉鏂版灦鏋勯厤缃紙瀹屾暣鐨勫鑵挎ā鏉匡級
    if (this.isMultiLegTemplate(template)) {
      // 浣跨敤缁撴瀯鍖栨牎楠屽櫒楠岃瘉 legs
      if (hasLegs) {
        const legsValidation = validateStrategyLegs(legs)
        if (!legsValidation.valid) {
          return {
            valid: false,
            warnings: [legsValidation.message || 'Invalid legs configuration']
          }
        }
      }

      // 浣跨敤缁撴瀯鍖栨牎楠屽櫒楠岃瘉 execution
      if (hasExecution) {
        const executionValidation = validateExecutionConfig(execution)
        if (!executionValidation.valid) {
          return {
            valid: false,
            warnings: [executionValidation.message || 'Invalid execution configuration']
          }
        }
      }

      // 浣跨敤缁撴瀯鍖栨牎楠屽櫒楠岃瘉 dataRequirements
      if (hasDataRequirements) {
        const dataReqValidation = validateDataRequirements(dataRequirements, legs)
        if (!dataReqValidation.valid) {
          return {
            valid: false,
            warnings: [
              dataReqValidation.message || 'Invalid dataRequirements configuration',
              ...(dataReqValidation.details ? [JSON.stringify(dataReqValidation.details)] : [])
            ]
          }
        }
      }

      // 楠岃瘉 execution 涓?dataRequirements 鐨勪竴鑷存€?
      const consistencyValidation = validateExecutionDataConsistency(execution, legs, dataRequirements)
      if (!consistencyValidation.valid) {
        return {
          valid: false,
          warnings: [
            consistencyValidation.message || 'Execution and data requirements inconsistency',
            ...(consistencyValidation.details ? [JSON.stringify(consistencyValidation.details)] : [])
          ]
        }
      }
    } else if (!hasExecution && !hasRequiredFields) {
      // 鏃㈡病鏈夋柊鏋舵瀯閰嶇疆锛屼篃娌℃湁鏃ф灦鏋勯厤缃?
      return {
        valid: false,
        warnings: ['Template missing both execution config and requiredFields']
      }
    }

    return { valid: true, warnings }
  }

  /**
   * 鏍规嵁鐢ㄦ埛鐨?promptTemplate 鑷姩鐢熸垚绛栫暐鑴氭湰浠ｇ爜
   */
  private async generateStrategyScript(template: StrategyTemplate): Promise<string | null> {
    if (!template.promptTemplate) {
      return null
    }

    // 楠岃瘉妯℃澘閰嶇疆
    const validation = this.validateTemplateForGeneration(template)
    if (!validation.valid) {
      // 鎶涘嚭鍏蜂綋鐨勯獙璇佸け璐ュ紓甯革紝鑰屼笉鏄潤榛樿繑鍥?null
      throw new TemplateValidationFailedException({
        reason: 'Template configuration is incomplete or invalid',
        warnings: validation.warnings,
        details: {
          templateId: template.id,
          templateName: template.name,
        },
      })
    }
    if (validation.warnings.length > 0) {
      this.logger.warn({
        message: 'Template validation warnings',
        templateId: template.id,
        templateName: template.name,
        warnings: validation.warnings,
      })
    }

    // 浣跨敤妯℃澘閰嶇疆鐨?llmModel锛屼俊浠荤敱閰嶇疆骞冲彴/DTO 楠岃瘉杩囩殑妯″瀷鍚嶇О
    // AiService 浼氭牴鎹疄闄呭彲鐢ㄧ殑 provider 鍜?model 杩涜澶勭悊
    const llmModel = template.llmModel || 'gpt-4o-mini'

    const systemPrompt = `浣犳槸涓€涓笓涓氱殑閲忓寲浜ゆ槗鏁版嵁鍑嗗鍔╂墜銆?
浣犵殑浠诲姟鏄敓鎴愪竴涓?JavaScript 鑴氭湰锛岃鑴氭湰鐢ㄤ簬璁＄畻鍜屽噯澶囨彁渚涚粰 LLM 鍐崇瓥鎵€闇€鐨勬暟鎹€?

### 閲嶈璇存槑锛?
鑴氭湰鐨勪綔鐢ㄦ槸"鏁版嵁鍑嗗"锛岃€岄潪"浜ゆ槗鍐崇瓥"銆?
- 鑴氭湰鎵ц 鈫?杩斿洖鍒嗘瀽鏁版嵁瀵硅薄
- 鏁版嵁瀵硅薄 鈫?濉厖 Prompt 妯℃澘鐨勫崰浣嶇锛堝 {{currentPrice}}, {{sma20}} 绛夛級
- 濉厖鍚庣殑 Prompt 鈫?鍙戦€佺粰 LLM 杩涜浜ゆ槗鍐崇瓥

### 鑴氭湰杩愯鐜绾︽潫锛?
- 鑴氭湰浼氳褰撲綔"鏅€?JS 浠ｇ爜鐗囨"鐩存帴鎵ц锛屼笉鍖呭湪鍑芥暟閲?
- **绂佹鍦ㄩ《灞備娇鐢?return 璇彞**锛堜細瑙﹀彂 Illegal return statement 閿欒锛?
- 鑴氭湰鐨勮繑鍥炲€兼槸**鏈€鍚庝竴涓〃杈惧紡鐨勫€?*
- 涓嶈杈撳嚭浠讳綍瑙ｉ噴鏂囧瓧銆佹敞閲婂彲閫夛紝鏈€缁堣緭鍑哄繀椤绘槸绾?JS 浠ｇ爜

### 鍙敤鐨勪笂涓嬫枃鍙橀噺锛堝 Leg 澶氬懆鏈熸灦鏋勶級锛?

#### 涓昏鏁版嵁缁撴瀯锛?
- **data**: 鎸?leg 鍜?timeframe 绱㈠紩鐨勫競鍦烘暟鎹璞?
  - data['legId']['timeframe'].bars - K绾挎暟缁?[{open, high, low, close, volume, timestamp}]
  - data['legId']['timeframe'].indicators - 鎶€鏈寚鏍囧璞?{rsi_14: 45.2, ma_20: 62000, ...}
  - data['legId']['timeframe'].currentPrice - 褰撳墠浠锋牸锛堟暟瀛楋級

  绀轰緥锛?
  - data['btc']['1h'].bars - BTC 1灏忔椂 K绾挎暟缁?
  - data['btc']['4h'].currentPrice - BTC 4灏忔椂褰撳墠浠锋牸
  - data['eth']['1h'].indicators - ETH 1灏忔椂鎶€鏈寚鏍?

- **legs**: 绛栫暐鐨?leg 閰嶇疆鏁扮粍 [{id, symbol, role, description?}, ...]
  - 鍙互閫氳繃閬嶅巻 legs 鑾峰彇鎵€鏈変氦鏄撳淇℃伅
  - primary leg 鏄富瑕佷氦鏄撳璞?

- **execution**: 绛栫暐鎵ц閰嶇疆
  - execution.timeframe - 淇″彿瑙﹀彂鍛ㄦ湡锛堝 '1h', '15m'锛?
  - execution.cooldownMinutes - 鍐峰嵈鏃堕棿锛堝垎閽燂級

- **dataRequirements**: 鏁版嵁闇€姹傞厤缃璞?{legId: [timeframes]}
  - 绀轰緥锛歿"btc": ["15m", "1h", "4h"], "eth": ["1h"]}

- **timestamp**: 褰撳墠鏃堕棿鎴筹紙Date瀵硅薄锛?

#### 鍚戝悗鍏煎鍙橀噺锛堣嚜鍔ㄦ寚鍚?primary leg 鍜?execution.timeframe锛夛細
- **bars**: 绛夊悓浜?data[primaryLegId][execution.timeframe].bars
- **symbol**: 绛夊悓浜?primary leg 鐨?symbol
- **timeframe**: 绛夊悓浜?execution.timeframe
- **indicators**: 绛夊悓浜?data[primaryLegId][execution.timeframe].indicators
- **currentPrice**: 绛夊悓浜?data[primaryLegId][execution.timeframe].currentPrice

### 鍙敤鐨勮緟鍔╁嚱鏁板簱锛?
- helpers.ta.sma(prices, period) - 绠€鍗曠Щ鍔ㄥ钩鍧?
- helpers.ta.ema(prices, period) - 鎸囨暟绉诲姩骞冲潎
- helpers.ta.rsi(prices, period) - 鐩稿寮哄急鎸囨爣
- helpers.ta.macd(prices, fast, slow, signal) - MACD鎸囨爣
- helpers.ta.atr(bars, period) - 骞冲潎鐪熷疄娉㈠箙
- helpers.ta.bollinger(prices, period, stdDev) - 甯冩灄甯?
- helpers.signal.crossOver(series1, series2) - 閲戝弶鍒ゆ柇
- helpers.signal.crossUnder(series1, series2) - 姝诲弶鍒ゆ柇
- helpers.signal.isOversold(value, threshold) - 瓒呭崠鍒ゆ柇
- helpers.signal.isOverbought(value, threshold) - 瓒呬拱鍒ゆ柇
- helpers.signal.calcStopLoss(entryPrice, atr, multiplier, direction) - 璁＄畻姝㈡崯
- helpers.signal.calcTakeProfit(entryPrice, stopLoss, ratio, direction) - 璁＄畻姝㈢泩
- helpers.signal.highest(values, period) - 鑾峰彇鏈€楂樺€?
- helpers.signal.lowest(values, period) - 鑾峰彇鏈€浣庡€?
- helpers.array.tail(array, n) - 鑾峰彇鏁扮粍鏈€鍚巒涓厓绱?
- helpers.array.head(array, n) - 鑾峰彇鏁扮粍鍓峮涓厓绱?
- helpers.finance.returns(prices) - 璁＄畻鏀剁泭鐜?
- helpers.finance.sharpeRatio(returns, riskFreeRate, periods) - 璁＄畻澶忔櫘姣旂巼

### 杩斿洖鏍煎紡锛?
鑴氭湰蹇呴』杩斿洖涓€涓暟鎹璞★紝鍖呭惈鐢ㄤ簬濉厖 Prompt 妯℃澘鐨勫瓧娈点€?

**閲嶈锛氫笉瑕佷娇鐢?return 璇彞锛岃€屾槸璁╂渶鍚庝竴涓〃杈惧紡浣滀负杩斿洖鍊?*

#### 绀轰緥 1: 鍗曞搧绉嶇瓥鐣?
濡傛灉 Prompt 妯℃澘鏄細
"褰撳墠浠锋牸鏄?{{currentPrice}}锛孲MA20鏄?{{sma20}}锛孯SI鏄?{{rsi}}锛岃秼鍔挎槸 {{trend}}锛岃鍒ゆ柇鏄惁搴旇涔板叆"

鑴氭湰搴旇杩欐牱鍐欙紙鎺ㄨ崘鍐欐硶 1 - 鍙橀噺 + 鏈€鍚庤〃杈惧紡锛夛細
\`\`\`javascript
const closes = bars.map(b => b.close);
const sma20 = helpers.ta.sma(closes, 20);
const rsi = helpers.ta.rsi(closes, 14);

const result = {
  currentPrice: currentPrice.toFixed(2),
  sma20: sma20.toFixed(2),
  rsi: rsi.toFixed(2),
  trend: currentPrice > sma20 ? "涓婃定" : "涓嬭穼"
};

result
\`\`\`

鎴栬€咃紙鎺ㄨ崘鍐欐硶 2 - 鐩存帴瀵硅薄瀛楅潰閲忥級锛?
\`\`\`javascript
const closes = bars.map(b => b.close);
const sma20 = helpers.ta.sma(closes, 20);
const rsi = helpers.ta.rsi(closes, 14);

({
  currentPrice: currentPrice.toFixed(2),
  sma20: sma20.toFixed(2),
  rsi: rsi.toFixed(2),
  trend: currentPrice > sma20 ? "涓婃定" : "涓嬭穼"
})
\`\`\`

#### 绀轰緥 2: 澶氬搧绉嶇瓥鐣?
濡傛灉绛栫暐鏈夊涓?legs (濡?BTC 鍜?ETH)锛?
\`\`\`javascript
// 鑾峰彇 BTC 鍜?ETH 鐨勬暟鎹?
const btc15m = data['btc']['15m'];
const eth15m = data['eth']['15m'];

// 璁＄畻鍙樺寲鐜?
const btcChange = (btc15m.currentPrice - btc15m.bars[btc15m.bars.length-2].close) / btc15m.bars[btc15m.bars.length-2].close;
const ethChange = (eth15m.currentPrice - eth15m.bars[eth15m.bars.length-2].close) / eth15m.bars[eth15m.bars.length-2].close;

// 鏈€鍚庤〃杈惧紡浣滀负杩斿洖鍊硷紙鏃?return锛?
const result = {
  btcPrice: btc15m.currentPrice.toFixed(2),
  ethPrice: eth15m.currentPrice.toFixed(2),
  spread: ((btcChange - ethChange) * 100).toFixed(2) + '%'
};

result
\`\`\`

#### 绀轰緥 3: 澶氬懆鏈熺瓥鐣?
濡傛灉闇€瑕佸垎鏋愬涓椂闂村懆鏈燂細
\`\`\`javascript
// 鑾峰彇涓嶅悓鍛ㄦ湡鐨勬暟鎹?
const btc15m = data['btc']['15m'];
const btc1h = data['btc']['1h'];
const btc4h = data['btc']['4h'];

// 璁＄畻涓嶅悓鍛ㄦ湡鐨?MA
const closes15m = btc15m.bars.map(b => b.close);
const closes1h = btc1h.bars.map(b => b.close);
const closes4h = btc4h.bars.map(b => b.close);

const ma20_15m = helpers.ta.sma(closes15m, 20);
const ma20_1h = helpers.ta.sma(closes1h, 20);
const ma20_4h = helpers.ta.sma(closes4h, 20);

// 澶氬懆鏈熻秼鍔垮垽鏂?
const trend = (ma20_15m > ma20_1h && ma20_1h > ma20_4h) ? 'UP' :
              (ma20_15m < ma20_1h && ma20_1h < ma20_4h) ? 'DOWN' : 'SIDEWAYS';

// 鏈€鍚庤〃杈惧紡浣滀负杩斿洖鍊硷紙鏃?return锛?
({
  currentPrice: btc15m.currentPrice.toFixed(2),
  ma15m: ma20_15m.toFixed(2),
  ma1h: ma20_1h.toFixed(2),
  ma4h: ma20_4h.toFixed(2),
  trend: trend
})
\`\`\`

### 浠ｇ爜瑕佹眰锛?
1. **绂佹浣跨敤椤跺眰 return 璇彞**锛堜細瀵艰嚧璇硶閿欒锛夛紝鑴氭湰鏈€鍚庝竴涓〃杈惧紡鐨勫€间綔涓鸿繑鍥炲€?
2. 鏍规嵁绛栫暐鐨?legs 鍜?dataRequirements 閰嶇疆锛岃闂浉搴旂殑甯傚満鏁版嵁
3. 瀵逛簬鍗曞搧绉嶇瓥鐣ワ紝鍙互鐩存帴浣跨敤鍚戝悗鍏煎鍙橀噺 (bars, symbol, currentPrice 绛?
4. 瀵逛簬澶氬搧绉嶆垨澶氬懆鏈熺瓥鐣ワ紝浣跨敤 data['legId']['timeframe'] 璁块棶鏁版嵁
5. 杩斿洖鐨勫璞″瓧娈靛簲璇ユ竻鏅版弿杩板競鍦虹姸鎬侊紝渚夸簬 LLM 鐞嗚В
6. 鍙互鍖呭惈璁＄畻鍊笺€佸垽鏂粨鏋溿€佽秼鍔挎弿杩扮瓑澶氱绫诲瀷鐨勬暟鎹?
7. 浣跨敤 ES6+ 璇硶锛屼絾閬垮厤浣跨敤 async/await锛堣剼鏈紩鎿庨粯璁や笉鏀寔寮傛锛?
8. 娣诲姞娓呮櫚鐨勬敞閲婅鏄庢瘡涓瓧娈电殑鍚箟
9. 澶勭悊鍙兘鐨?null/undefined 鍊硷紝瀵逛簬鏃犳晥鏁版嵁杩斿洖 'N/A' 鎴栫被浼兼爣璁?
10. 閬垮厤浣跨敤 require, import, eval 绛変笉瀹夊叏鐨勫嚱鏁?
11. 鍙娇鐢ㄧ函 JavaScript 閫昏緫锛屼笉鑳借闂閮ㄨ祫婧?
12. 鏁板€煎瓧娈靛缓璁牸寮忓寲涓哄瓧绗︿覆锛堜娇鐢?toFixed锛夛紝渚夸簬鍦?Prompt 涓睍绀?
13. 鎺ㄨ崘鍐欐硶锛氱敤鍙橀噺瀛樺偍缁撴灉瀵硅薄锛岀劧鍚庢渶鍚庝竴琛屽啓鍙橀噺鍚嶏紱鎴栬€呯敤鎷彿鍖呰９瀵硅薄瀛楅潰閲?

璇风敓鎴愮畝娲併€侀珮鏁堛€佸彲缁存姢鐨勬暟鎹噯澶囪剼鏈€俙

    // 鏋勫缓绛栫暐閰嶇疆淇℃伅 - 鏀硅繘绌哄€煎鐞嗗拰绫诲瀷瀹夊叏
    const legs = (template.legs as unknown) as StrategyLegDefinition[] | undefined
    const execution = (template.execution as unknown) as StrategyExecutionConfig | undefined
    const dataRequirements = (template.dataRequirements as unknown) as StrategyDataRequirements | undefined

    const legInfo = (Array.isArray(legs) && legs.length > 0)
      ? legs.map((leg: StrategyLegDefinition) =>
          `  - ${leg.id}: ${leg.symbol} (${leg.role})${leg.description ? ` - ${leg.description}` : ''}`
        ).join('\n')
      : '  - (鏈厤缃?legs)'

    const executionInfo = (execution && typeof execution === 'object' && 'timeframe' in execution)
      ? `  - timeframe: ${execution.timeframe}\n  - cooldownMinutes: ${execution.cooldownMinutes ?? '鏈缃?}`
      : '  - (鏈厤缃?execution)'

    const dataReqInfo = (dataRequirements && typeof dataRequirements === 'object')
      ? Object.entries(dataRequirements)
          .map(([legId, timeframes]) => {
            // 鏀硅繘绫诲瀷瀹夊叏锛氱‘淇?timeframes 鏄暟缁?
            const tfArray = Array.isArray(timeframes) ? timeframes : [timeframes]
            return `  - ${legId}: [${tfArray.join(', ')}]`
          })
          .join('\n')
      : '  - (鏈厤缃?dataRequirements)'

    const userPrompt = [
      '=== 绛栫暐閰嶇疆 ===',
      '',
      '绛栫暐 Legs:',
      legInfo,
      '',
      '鎵ц閰嶇疆:',
      executionInfo,
      '',
      '鏁版嵁闇€姹?',
      dataReqInfo,
      '',
      '=== Prompt 妯℃澘 ===',
      template.promptTemplate,
      '',
      template.description ? `=== 琛ュ厖璇存槑 ===\n${template.description}\n` : null,
      '',
      // 淇濈暀鍚戝悗鍏煎鐨?requiredFields 鎻愮ず
      template.requiredFields?.length
        ? `=== 宸插簾寮冨瓧娈碉紙鍙兘闇€瑕侊級 ===\n${template.requiredFields.join(', ')}\n`
        : null,
      '',
      '=== 浠诲姟 ===',
      '璇峰垎鏋愪笂杩扮瓥鐣ラ厤缃拰 Prompt 妯℃澘锛岀敓鎴愪竴涓暟鎹噯澶囪剼鏈€?,
      '',
      '娉ㄦ剰锛?,
      '1. **绂佹浣跨敤椤跺眰 return 璇彞**锛堜細瀵艰嚧 Illegal return statement 閿欒锛?,
      '2. 鑴氭湰鏈€鍚庝竴涓〃杈惧紡鐨勫€间綔涓鸿繑鍥炲€硷紙鎺ㄨ崘鐢ㄥ彉閲忓瓨鍌ㄥ璞★紝鏈€鍚庝竴琛屽啓鍙橀噺鍚嶏級',
      '   鎺ㄨ崘妯″紡锛氬厛鐢?const result = { ... } 淇濆瓨鎵€鏈夐渶瑕佽繑鍥炵殑瀛楁锛岀劧鍚庝互 result 浣滀负鏈€鍚庝竴琛岃〃杈惧紡',
      '   绀轰緥锛歝onst result = { foo, bar }; result',
      '3. 鏍规嵁绛栫暐鐨?legs 鏁伴噺鍒ゆ柇鏄崟鍝佺杩樻槸澶氬搧绉嶇瓥鐣?,
      '4. 鏍规嵁 dataRequirements 鍒ゆ柇闇€瑕佽闂摢浜涘懆鏈熺殑鏁版嵁',
      '5. 鍗曞搧绉嶅崟鍛ㄦ湡绛栫暐鍙互浣跨敤鍚戝悗鍏煎鍙橀噺锛坆ars, symbol, currentPrice 绛夛級',
      '6. 澶氬搧绉嶆垨澶氬懆鏈熺瓥鐣ュ簲浣跨敤 data[\'legId\'][\'timeframe\'] 璁块棶鏁版嵁',
      '7. 鑴氭湰闇€瑕佽绠楀苟杩斿洖 Prompt 妯℃澘涓墍鏈夊崰浣嶇锛坽{...}}锛夊搴旂殑鏁版嵁瀛楁锛屽苟浠ヤ竴涓?绾璞?褰㈠紡浣滀负鏈€缁堢粨鏋滐紙閿€煎锛?,
      '8. 鍙繑鍥?JavaScript 浠ｇ爜锛屼笉瑕佸寘鍚换浣曡В閲婃枃瀛楁垨 Markdown 浠ｇ爜鍧楁爣璁?,
    ]
      .filter(Boolean)
      .join('\n')

    try {
      const result = await this.aiService.chat({
        model: llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // 杈冧綆鐨勬俯搴︿互鑾峰緱鏇寸‘瀹氭€х殑浠ｇ爜
        maxTokens: 2000, // 浠ｇ爜鍙兘杈冮暱
      })

      // 鎻愬彇浠ｇ爜鍧楋紙濡傛灉 AI 杩斿洖浜?markdown 鏍煎紡锛?
      let code = result.content.trim()
      const codeBlockMatch = code.match(/```(?:javascript|js)?\n([\s\S]*?)```/)
      if (codeBlockMatch) {
        code = codeBlockMatch[1]!.trim()
      }

      // 鍩烘湰楠岃瘉锛氳剼鏈笉鑳戒负绌?
      if (!code.length) {
        this.logger.warn('Generated script is empty')
        return null
      }

      // 涓嶅啀鍦ㄧ敓鎴愰樁娈垫娴嬮《灞?return锛岃寮曟搸鍦ㄨ繍琛屾椂鏅鸿兘澶勭悊锛?
      // - 浼樺厛鐢ㄦ爣鍑嗘ā寮忔墽琛岋紙鏂拌剼鏈細鏈€鍚庤〃杈惧紡浣滀负杩斿洖鍊硷級
      // - 閬囧埌 "Illegal return statement" 鑷姩鐢?allowAsync 閲嶈瘯锛堟棫鑴氭湰鍏煎锛?
      // 杩欑杩愯鏃舵櫤鑳藉鐞嗘瘮澶嶆潅鐨勯潤鎬佹娴嬫洿绠€鍗曘€佹洿鍋ュ．

      return code
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      this.logger.error(
        `Failed to generate strategy script: ${errorMessage}`,
      )
      if (errorStack) {
        this.logger.error(`Error stack: ${errorStack}`)
      }
      return null
    }
  }

  /**
   * 涓烘寚瀹氱殑绛栫暐妯℃澘鐢熸垚鑴氭湰
   */
  async generateScript(id: string): Promise<string> {
    const startTime = Date.now()
    const template = await this.getDetail(id)

    if (!template.promptTemplate) {
      throw new AiProviderErrorException({ providerCode: 'strategy-templates', reason: 'Missing promptTemplate', detail: 'Strategy template is missing promptTemplate, cannot generate script' })
    }

    try {
      // generateStrategyScript 鍐呴儴浼氶獙璇佹ā鏉块厤缃紝濡傛灉楠岃瘉澶辫触浼氭姏鍑?TemplateValidationFailedException
      const script = await this.generateStrategyScript(template)

      if (!script) {
        // 鐞嗚涓婁笉搴旇鍒拌揪杩欓噷锛屽洜涓洪獙璇佸け璐ヤ細鎶涘嚭寮傚父
        throw new AiProviderErrorException({
          providerCode: 'strategy-templates',
          reason: 'Script generation failed',
          detail: 'Script generation returned null unexpectedly'
        })
      }

      // 璁板綍鐢熸垚鎴愬姛鐨勬寚鏍?
      const duration = Date.now() - startTime
      const isMultiLeg = this.isMultiLegTemplate(template)
      const templateType = isMultiLeg ? 'multi-leg' : 'legacy'
      const legs = (template.legs as unknown) as StrategyLegDefinition[] | undefined
      const legsCount = (Array.isArray(legs) && legs.length) ? legs.length : 0

      this.logger.log({
        event: 'script_generated',
        templateId: id,
        templateName: template.name,
        templateType,
        duration,
        scriptLength: script.length,
        success: true,
        legsCount,
        hasExecution: !!template.execution,
        hasDataRequirements: !!template.dataRequirements,
      })

      return script
    }
    catch (error) {
      const duration = Date.now() - startTime
      this.logger.error({
        message: 'Script generation failed',
        templateId: id,
        templateName: template.name,
        duration,
        error: error instanceof Error ? error.message : String(error),
      }, error instanceof Error ? error.stack : undefined)
      // 鐩存帴鎶涘嚭鍘熷寮傚父锛屼繚鐣欓敊璇粏鑺傦紙TemplateValidationFailedException 鎴栧叾浠栧紓甯革級
      throw error
    }
  }

  /**
   * 楠岃瘉鑴氭湰浠ｇ爜鐨勮娉曞拰瀹夊叏鎬?
   */
  validateScript(script: string): {
    valid: boolean
    errors?: string[]
    warnings?: string[]
  } {
    const engine = createScriptEngine()
    return engine.validate(script)
  }


  /**
   * 楠岃瘉 legs 涓殑鎵€鏈?symbol 鏄惁瀛樺湪浜庢暟鎹簱涓?
   * @throws InvalidStrategyLegsException 褰?symbol 涓嶅瓨鍦ㄦ垨鐘舵€佷笉鍙敤鏃?
   */
  private async validateSymbolsExist(legs: StrategyLegDefinition[]): Promise<void> {
    const symbolCodes = legs.map(leg => leg.symbol)

    // 鎵归噺鏌ヨ鎵€鏈?symbols
    const symbols = await this.prisma.getClient().symbol.findMany({
      where: { code: { in: symbolCodes } },
      select: { code: true, status: true },
    })

    const symbolMap = new Map(symbols.map(s => [s.code, s]))

    // 妫€鏌ユ瘡涓?leg 鐨?symbol 鏄惁瀛樺湪
    for (const leg of legs) {
      const symbol = symbolMap.get(leg.symbol)

      if (!symbol) {
        throw new InvalidStrategyLegsException({
          reason: `Symbol ${leg.symbol} (leg: ${leg.id}) 涓嶅瓨鍦ㄤ簬绯荤粺涓璥,
          details: {
            legId: leg.id,
            symbol: leg.symbol,
            availableSymbols: Array.from(symbolMap.keys()),
          },
        })
      }

      // 妫€鏌?symbol 鐘舵€佹槸鍚﹀彲鐢?
      if (symbol.status !== 'ACTIVE') {
        throw new InvalidStrategyLegsException({
          reason: `Symbol ${leg.symbol} (leg: ${leg.id}) 鐘舵€佷笉鍙敤锛屽綋鍓嶇姸鎬? ${symbol.status}`,
          details: {
            legId: leg.id,
            symbol: leg.symbol,
            status: symbol.status,
          },
        })
      }
    }
  }
}

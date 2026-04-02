import type { CreateStrategyTemplateDto } from '../dto/create-strategy-template.dto'
import type { StrategyTemplateListQueryDto } from '../dto/strategy-template-list-query.dto'
import type { UpdateStrategyTemplateDto } from '../dto/update-strategy-template.dto'
import type { StrategyDataRequirements, StrategyExecutionConfig, StrategyLegDefinition } from '../types/strategy-template.types'
import type { Prisma, StrategyTemplate } from '@/prisma/prisma.types'
import { createScriptEngine } from '@ai/shared/node'
import { Inject, Injectable, Logger } from '@nestjs/common'

import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'

import { AiService } from '@/modules/ai/ai.service'
import { AiProviderErrorException } from '@/modules/ai/exceptions/ai-provider-error.exception'
import { Prisma as PrismaNamespace } from '@/prisma/prisma.types'

import { InvalidDataRequirementsException } from '../exceptions/invalid-data-requirements.exception'
import { InvalidExecutionConfigException } from '../exceptions/invalid-execution-config.exception'
import { InvalidRequiredFieldsException } from '../exceptions/invalid-required-fields.exception'
import { InvalidStrategyLegsException } from '../exceptions/invalid-strategy-legs.exception'
import { StrategyTemplateNameConflictException } from '../exceptions/strategy-template-name-conflict.exception'
import { StrategyTemplateNotFoundException } from '../exceptions/strategy-template-not-found.exception'
import { TemplateValidationFailedException } from '../exceptions/template-validation-failed.exception'
// eslint-disable-next-line ts/consistent-type-imports -- 需要用于依赖注入，不能使用 import type
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
    @Inject(AiService)
    private readonly aiService: AiService,
  ) {}

  async list(query: StrategyTemplateListQueryDto) {
    const { page = 1, limit = 20, status, keyword, onlyDraft, orderBy } = query
    const skip = (page - 1) * limit

    const where: Prisma.StrategyTemplateWhereInput = {}

    // 当 onlyDraft 与 status 同时存在时，以 status 为准，避免静默覆盖调用方传入的状态
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
    // 1. 校验 legs
    const legResult = validateStrategyLegs(dto.legs)
    if (!legResult.valid) {
      throw new InvalidStrategyLegsException({ reason: legResult.message || 'Invalid strategy legs definition', details: legResult.details })
    }

    // 2. 校验 symbol 是否存在于数据库
    await this.validateSymbolsExist(dto.legs)

    // 3. 校验 execution 配置
    const executionResult = validateExecutionConfig(dto.execution)
    if (!executionResult.valid) {
      throw new InvalidExecutionConfigException({ reason: executionResult.message || 'Invalid execution config', details: executionResult.details })
    }

    // 4. 校验 dataRequirements
    const dataReqResult = validateDataRequirements(dto.dataRequirements, dto.legs)
    if (!dataReqResult.valid) {
      throw new InvalidDataRequirementsException({ reason: dataReqResult.message || 'Invalid data requirements', details: dataReqResult.details })
    }

    // 5. 校验 execution 与 dataRequirements 的一致性
    const consistencyResult = validateExecutionDataConsistency(dto.execution, dto.legs, dto.dataRequirements)
    if (!consistencyResult.valid) {
      throw new InvalidDataRequirementsException({ reason: consistencyResult.message || 'Execution and data requirements inconsistency', details: consistencyResult.details })
    }

    // 6. 新架构必须提供脚本
    if (!dto.script || dto.script.trim() === '') {
      throw new InvalidStrategyLegsException({
        reason: '新架构策略模板必须提供脚本 (script)，用于准备 AI prompt 数据',
        details: { 
          hasLegs: true, 
          hasScript: false,
          hint: '脚本用于处理多腿数据并生成 AI prompt 变量',
        },
      })
    }

    // 7. 校验 requiredFields（向后兼容，deprecated）
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
      // 捕获 Prisma 唯一约束冲突错误
      if (error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new StrategyTemplateNameConflictException({ name: dto.name })
      }
      throw error
    }

    return this.refreshAiSummary(template)
  }

  async update(id: string, dto: UpdateStrategyTemplateDto, operatorId?: string): Promise<StrategyTemplate> {
    const current = await this.getDetail(id)

    // 判断是否使用新架构（有 legs 或即将更新为 legs）
    const isNewArchitecture = dto.legs !== undefined || current.legs !== null
    
    // 1. 校验 legs（仅当使用新架构时）
    if (isNewArchitecture) {
      const nextLegs = dto.legs ?? (current.legs as unknown as StrategyLegDefinition[])
      const legResult = validateStrategyLegs(nextLegs)
      if (!legResult.valid) {
        throw new InvalidStrategyLegsException({ reason: legResult.message || 'Invalid strategy legs definition', details: legResult.details })
      }
      
      // 1.1 校验 symbol 是否存在（仅当提供了新 legs 时）
      if (dto.legs) {
        await this.validateSymbolsExist(dto.legs)
      }
      
      // 2. 校验 execution（新架构必需）
      const nextExecution = dto.execution ?? (current.execution as unknown as StrategyExecutionConfig | undefined)
      if (!nextExecution) {
        throw new InvalidExecutionConfigException({ 
          reason: '新架构策略模板必须提供 execution 配置',
          details: { hasLegs: true, hasExecution: false },
        })
      }
      const executionResult = validateExecutionConfig(nextExecution)
      if (!executionResult.valid) {
        throw new InvalidExecutionConfigException({ reason: executionResult.message || 'Invalid execution config', details: executionResult.details })
      }

      // 3. 校验 dataRequirements（新架构必需）
      const nextDataRequirements = dto.dataRequirements ?? (current.dataRequirements as unknown as StrategyDataRequirements | undefined)
      if (!nextDataRequirements) {
        throw new InvalidDataRequirementsException({ 
          reason: '新架构策略模板必须提供 dataRequirements 配置',
          details: { hasLegs: true, hasDataRequirements: false },
        })
      }
      const dataReqResult = validateDataRequirements(nextDataRequirements, nextLegs)
      if (!dataReqResult.valid) {
        throw new InvalidDataRequirementsException({ reason: dataReqResult.message || 'Invalid data requirements', details: dataReqResult.details })
      }

      // 4. 校验 execution 与 dataRequirements 的一致性
      const consistencyResult = validateExecutionDataConsistency(nextExecution, nextLegs, nextDataRequirements)
      if (!consistencyResult.valid) {
        throw new InvalidDataRequirementsException({ reason: consistencyResult.message || 'Execution and data requirements inconsistency', details: consistencyResult.details })
      }
      
      // 5. 新架构必须提供脚本
      const nextScript = dto.script !== undefined ? dto.script : current.script
      if (!nextScript || nextScript.trim() === '') {
        throw new InvalidStrategyLegsException({
          reason: '新架构策略模板必须提供脚本 (script)，用于准备 AI prompt 数据',
          details: { 
            hasLegs: true, 
            hasScript: false,
            hint: '脚本用于处理多腿数据并生成 AI prompt 变量',
          },
        })
      }
    }

    // 6. 校验 requiredFields（向后兼容，deprecated）
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
      // JSON 字段：undefined = 不变；null = 置空；对象 = 覆盖
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
      // 捕获 Prisma 唯一约束冲突错误
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
      `策略名称: ${template.name}`,
      template.description ? `策略描述: ${template.description}` : null,
      template.requiredFields?.length ? `必需字段: ${template.requiredFields.join(', ')}` : null,
      `Prompt 模板: ${template.promptTemplate}`,
    ]
      .filter(Boolean)
      .join('\n')

    const result = await this.aiService.chat({
      model: template.llmModel,
      messages: [
        {
          role: 'system',
          content: '你是一名量化策略助手，请将输入的策略模板信息总结为一段 2-3 句的中文描述，突出策略逻辑与适用场景。',
        },
        {
          role: 'user',
          content: `请总结以下策略模板：\n${payload}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 400,
    })

    const summary = result.content?.trim()
    return summary || null
  }

  /**
   * 验证模板是否使用新的多 Leg 架构
   * 
   * 注意：此方法必须与 StrategySignalsService.processStrategy 的判断逻辑保持一致
   * 运行时条件：execution && dataRequirements && legs?.length > 0
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
   * 验证模板配置的完整性
   * 
   * 注意：此方法复用创建/更新流程中的结构化校验器，确保脚本生成前的验证标准与创建时一致
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
    
    // 检测不完整的多腿配置：配置了 execution 或 dataRequirements 但 legs 为空
    if ((hasExecution || hasDataRequirements) && !hasLegs) {
      return { 
        valid: false, 
        warnings: [
          'Incomplete multi-leg configuration: template has execution/dataRequirements but legs is empty or undefined. ' +
          'Either add legs array or remove execution/dataRequirements to use legacy single-leg mode.'
        ] 
      }
    }
    
    // 检测有 execution 和 legs 但缺少 dataRequirements 的情况
    // 这会导致 isMultiLegTemplate() 返回 false，退回 legacy 分支，但 legacy 又没有 requiredFields
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
    
    // 验证新架构配置（完整的多腿模板）
    if (this.isMultiLegTemplate(template)) {
      // 使用结构化校验器验证 legs
      if (hasLegs) {
        const legsValidation = validateStrategyLegs(legs)
        if (!legsValidation.valid) {
          return { 
            valid: false, 
            warnings: [legsValidation.message || 'Invalid legs configuration']
          }
        }
      }
      
      // 使用结构化校验器验证 execution
      if (hasExecution) {
        const executionValidation = validateExecutionConfig(execution)
        if (!executionValidation.valid) {
          return { 
            valid: false, 
            warnings: [executionValidation.message || 'Invalid execution configuration']
          }
        }
      }
      
      // 使用结构化校验器验证 dataRequirements
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
      
      // 验证 execution 与 dataRequirements 的一致性
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
      // 既没有新架构配置，也没有旧架构配置
      return { 
        valid: false, 
        warnings: ['Template missing both execution config and requiredFields'] 
      }
    }
    
    return { valid: true, warnings }
  }

  /**
   * 根据用户的 promptTemplate 自动生成策略脚本代码
   */
  private async generateStrategyScript(template: StrategyTemplate): Promise<string | null> {
    if (!template.promptTemplate) {
      return null
    }

    // 验证模板配置
    const validation = this.validateTemplateForGeneration(template)
    if (!validation.valid) {
      // 抛出具体的验证失败异常，而不是静默返回 null
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

    // 使用模板配置的 llmModel，信任由配置平台/DTO 验证过的模型名称
    // AiService 会根据实际可用的 provider 和 model 进行处理
    const llmModel = template.llmModel || 'gpt-4o-mini'

    const systemPrompt = `你是一个专业的量化交易数据准备助手。
你的任务是生成一个 JavaScript 脚本，该脚本用于计算和准备提供给 LLM 决策所需的数据。

### 重要说明：
脚本的作用是"数据准备"，而非"交易决策"。
- 脚本执行 → 返回分析数据对象
- 数据对象 → 填充 Prompt 模板的占位符（如 {{currentPrice}}, {{sma20}} 等）
- 填充后的 Prompt → 发送给 LLM 进行交易决策

### 脚本运行环境约束：
- 脚本会被当作"普通 JS 代码片段"直接执行，不包在函数里
- **禁止在顶层使用 return 语句**（会触发 Illegal return statement 错误）
- 脚本的返回值是**最后一个表达式的值**
- 不要输出任何解释文字、注释可选，最终输出必须是纯 JS 代码

### 可用的上下文变量（多 Leg 多周期架构）：

#### 主要数据结构：
- **data**: 按 leg 和 timeframe 索引的市场数据对象
  - data['legId']['timeframe'].bars - K线数组 [{open, high, low, close, volume, timestamp}]
  - data['legId']['timeframe'].indicators - 技术指标对象 {rsi_14: 45.2, ma_20: 62000, ...}
  - data['legId']['timeframe'].currentPrice - 当前价格（数字）
  
  示例：
  - data['btc']['1h'].bars - BTC 1小时 K线数组
  - data['btc']['4h'].currentPrice - BTC 4小时当前价格
  - data['eth']['1h'].indicators - ETH 1小时技术指标

- **legs**: 策略的 leg 配置数组 [{id, symbol, role, description?}, ...]
  - 可以通过遍历 legs 获取所有交易对信息
  - primary leg 是主要交易对象

- **execution**: 策略执行配置
  - execution.timeframe - 信号触发周期（如 '1h', '15m'）
  - execution.cooldownMinutes - 冷却时间（分钟）

- **dataRequirements**: 数据需求配置对象 {legId: [timeframes]}
  - 示例：{"btc": ["15m", "1h", "4h"], "eth": ["1h"]}

- **timestamp**: 当前时间戳（Date对象）

#### 向后兼容变量（自动指向 primary leg 和 execution.timeframe）：
- **bars**: 等同于 data[primaryLegId][execution.timeframe].bars
- **symbol**: 等同于 primary leg 的 symbol
- **timeframe**: 等同于 execution.timeframe
- **indicators**: 等同于 data[primaryLegId][execution.timeframe].indicators
- **currentPrice**: 等同于 data[primaryLegId][execution.timeframe].currentPrice

### 可用的辅助函数库：
- helpers.ta.sma(prices, period) - 简单移动平均
- helpers.ta.ema(prices, period) - 指数移动平均
- helpers.ta.rsi(prices, period) - 相对强弱指标
- helpers.ta.macd(prices, fast, slow, signal) - MACD指标
- helpers.ta.atr(bars, period) - 平均真实波幅
- helpers.ta.bollinger(prices, period, stdDev) - 布林带
- helpers.signal.crossOver(series1, series2) - 金叉判断
- helpers.signal.crossUnder(series1, series2) - 死叉判断
- helpers.signal.isOversold(value, threshold) - 超卖判断
- helpers.signal.isOverbought(value, threshold) - 超买判断
- helpers.signal.calcStopLoss(entryPrice, atr, multiplier, direction) - 计算止损
- helpers.signal.calcTakeProfit(entryPrice, stopLoss, ratio, direction) - 计算止盈
- helpers.signal.highest(values, period) - 获取最高值
- helpers.signal.lowest(values, period) - 获取最低值
- helpers.array.tail(array, n) - 获取数组最后n个元素
- helpers.array.head(array, n) - 获取数组前n个元素
- helpers.finance.returns(prices) - 计算收益率
- helpers.finance.sharpeRatio(returns, riskFreeRate, periods) - 计算夏普比率

### 返回格式：
脚本必须返回一个数据对象，包含用于填充 Prompt 模板的字段。

**重要：不要使用 return 语句，而是让最后一个表达式作为返回值**

#### 示例 1: 单品种策略
如果 Prompt 模板是：
"当前价格是 {{currentPrice}}，SMA20是 {{sma20}}，RSI是 {{rsi}}，趋势是 {{trend}}，请判断是否应该买入"

脚本应该这样写（推荐写法 1 - 变量 + 最后表达式）：
\`\`\`javascript
const closes = bars.map(b => b.close);
const sma20 = helpers.ta.sma(closes, 20);
const rsi = helpers.ta.rsi(closes, 14);

const result = {
  currentPrice: currentPrice.toFixed(2),
  sma20: sma20.toFixed(2),
  rsi: rsi.toFixed(2),
  trend: currentPrice > sma20 ? "上涨" : "下跌"
};

result
\`\`\`

或者（推荐写法 2 - 直接对象字面量）：
\`\`\`javascript
const closes = bars.map(b => b.close);
const sma20 = helpers.ta.sma(closes, 20);
const rsi = helpers.ta.rsi(closes, 14);

({
  currentPrice: currentPrice.toFixed(2),
  sma20: sma20.toFixed(2),
  rsi: rsi.toFixed(2),
  trend: currentPrice > sma20 ? "上涨" : "下跌"
})
\`\`\`

#### 示例 2: 多品种策略
如果策略有多个 legs (如 BTC 和 ETH)：
\`\`\`javascript
// 获取 BTC 和 ETH 的数据
const btc15m = data['btc']['15m'];
const eth15m = data['eth']['15m'];

// 计算变化率
const btcChange = (btc15m.currentPrice - btc15m.bars[btc15m.bars.length-2].close) / btc15m.bars[btc15m.bars.length-2].close;
const ethChange = (eth15m.currentPrice - eth15m.bars[eth15m.bars.length-2].close) / eth15m.bars[eth15m.bars.length-2].close;

// 最后表达式作为返回值（无 return）
const result = {
  btcPrice: btc15m.currentPrice.toFixed(2),
  ethPrice: eth15m.currentPrice.toFixed(2),
  spread: ((btcChange - ethChange) * 100).toFixed(2) + '%'
};

result
\`\`\`

#### 示例 3: 多周期策略
如果需要分析多个时间周期：
\`\`\`javascript
// 获取不同周期的数据
const btc15m = data['btc']['15m'];
const btc1h = data['btc']['1h'];
const btc4h = data['btc']['4h'];

// 计算不同周期的 MA
const closes15m = btc15m.bars.map(b => b.close);
const closes1h = btc1h.bars.map(b => b.close);
const closes4h = btc4h.bars.map(b => b.close);

const ma20_15m = helpers.ta.sma(closes15m, 20);
const ma20_1h = helpers.ta.sma(closes1h, 20);
const ma20_4h = helpers.ta.sma(closes4h, 20);

// 多周期趋势判断
const trend = (ma20_15m > ma20_1h && ma20_1h > ma20_4h) ? 'UP' : 
              (ma20_15m < ma20_1h && ma20_1h < ma20_4h) ? 'DOWN' : 'SIDEWAYS';

// 最后表达式作为返回值（无 return）
({
  currentPrice: btc15m.currentPrice.toFixed(2),
  ma15m: ma20_15m.toFixed(2),
  ma1h: ma20_1h.toFixed(2),
  ma4h: ma20_4h.toFixed(2),
  trend: trend
})
\`\`\`

### 代码要求：
1. **禁止使用顶层 return 语句**（会导致语法错误），脚本最后一个表达式的值作为返回值
2. 根据策略的 legs 和 dataRequirements 配置，访问相应的市场数据
3. 对于单品种策略，可以直接使用向后兼容变量 (bars, symbol, currentPrice 等)
4. 对于多品种或多周期策略，使用 data['legId']['timeframe'] 访问数据
5. 返回的对象字段应该清晰描述市场状态，便于 LLM 理解
6. 可以包含计算值、判断结果、趋势描述等多种类型的数据
7. 使用 ES6+ 语法，但避免使用 async/await（脚本引擎默认不支持异步）
8. 添加清晰的注释说明每个字段的含义
9. 处理可能的 null/undefined 值，对于无效数据返回 'N/A' 或类似标记
10. 避免使用 require, import, eval 等不安全的函数
11. 只使用纯 JavaScript 逻辑，不能访问外部资源
12. 数值字段建议格式化为字符串（使用 toFixed），便于在 Prompt 中展示
13. 推荐写法：用变量存储结果对象，然后最后一行写变量名；或者用括号包裹对象字面量

请生成简洁、高效、可维护的数据准备脚本。`

    // 构建策略配置信息 - 改进空值处理和类型安全
    const legs = (template.legs as unknown) as StrategyLegDefinition[] | undefined
    const execution = (template.execution as unknown) as StrategyExecutionConfig | undefined
    const dataRequirements = (template.dataRequirements as unknown) as StrategyDataRequirements | undefined
    
    const legInfo = (Array.isArray(legs) && legs.length > 0)
      ? legs.map((leg: StrategyLegDefinition) => 
          `  - ${leg.id}: ${leg.symbol} (${leg.role})${leg.description ? ` - ${leg.description}` : ''}`
        ).join('\n')
      : '  - (未配置 legs)'

    const executionInfo = (execution && typeof execution === 'object' && 'timeframe' in execution)
      ? `  - timeframe: ${execution.timeframe}\n  - cooldownMinutes: ${execution.cooldownMinutes ?? '未设置'}`
      : '  - (未配置 execution)'

    const dataReqInfo = (dataRequirements && typeof dataRequirements === 'object')
      ? Object.entries(dataRequirements)
          .map(([legId, timeframes]) => {
            // 改进类型安全：确保 timeframes 是数组
            const tfArray = Array.isArray(timeframes) ? timeframes : [timeframes]
            return `  - ${legId}: [${tfArray.join(', ')}]`
          })
          .join('\n')
      : '  - (未配置 dataRequirements)'

    const userPrompt = [
      '=== 策略配置 ===',
      '',
      '策略 Legs:',
      legInfo,
      '',
      '执行配置:',
      executionInfo,
      '',
      '数据需求:',
      dataReqInfo,
      '',
      '=== Prompt 模板 ===',
      template.promptTemplate,
      '',
      template.description ? `=== 补充说明 ===\n${template.description}\n` : null,
      '',
      // 保留向后兼容的 requiredFields 提示
      template.requiredFields?.length
        ? `=== 已废弃字段（可能需要） ===\n${template.requiredFields.join(', ')}\n`
        : null,
      '',
      '=== 任务 ===',
      '请分析上述策略配置和 Prompt 模板，生成一个数据准备脚本。',
      '',
      '注意：',
      '1. **禁止使用顶层 return 语句**（会导致 Illegal return statement 错误）',
      '2. 脚本最后一个表达式的值作为返回值（推荐用变量存储对象，最后一行写变量名）',
      '   推荐模式：先用 const result = { ... } 保存所有需要返回的字段，然后以 result 作为最后一行表达式',
      '   示例：const result = { foo, bar }; result',
      '3. 根据策略的 legs 数量判断是单品种还是多品种策略',
      '4. 根据 dataRequirements 判断需要访问哪些周期的数据',
      '5. 单品种单周期策略可以使用向后兼容变量（bars, symbol, currentPrice 等）',
      '6. 多品种或多周期策略应使用 data[\'legId\'][\'timeframe\'] 访问数据',
      '7. 脚本需要计算并返回 Prompt 模板中所有占位符（{{...}}）对应的数据字段，并以一个"纯对象"形式作为最终结果（键值对）',
      '8. 只返回 JavaScript 代码，不要包含任何解释文字或 Markdown 代码块标记',
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
        temperature: 0.3, // 较低的温度以获得更确定性的代码
        maxTokens: 2000, // 代码可能较长
      })

      // 提取代码块（如果 AI 返回了 markdown 格式）
      let code = result.content.trim()
      const codeBlockMatch = code.match(/```(?:javascript|js)?\n([\s\S]*?)```/)
      if (codeBlockMatch) {
        code = codeBlockMatch[1]!.trim()
      }

      // 基本验证：脚本不能为空
      if (!code.length) {
        this.logger.warn('Generated script is empty')
        return null
      }

      // 不再在生成阶段检测顶层 return，让引擎在运行时智能处理：
      // - 优先用标准模式执行（新脚本：最后表达式作为返回值）
      // - 遇到 "Illegal return statement" 自动用 allowAsync 重试（旧脚本兼容）
      // 这种运行时智能处理比复杂的静态检测更简单、更健壮

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
   * 为指定的策略模板生成脚本
   */
  async generateScript(id: string): Promise<string> {
    const startTime = Date.now()
    const template = await this.getDetail(id)

    if (!template.promptTemplate) {
      throw new AiProviderErrorException({ providerCode: 'strategy-templates', reason: 'Missing promptTemplate', detail: 'Strategy template is missing promptTemplate, cannot generate script' })
    }

    try {
      // generateStrategyScript 内部会验证模板配置，如果验证失败会抛出 TemplateValidationFailedException
      const script = await this.generateStrategyScript(template)

      if (!script) {
        // 理论上不应该到达这里，因为验证失败会抛出异常
        throw new AiProviderErrorException({ 
          providerCode: 'strategy-templates', 
          reason: 'Script generation failed', 
          detail: 'Script generation returned null unexpectedly' 
        })
      }

      // 记录生成成功的指标
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
      // 直接抛出原始异常，保留错误细节（TemplateValidationFailedException 或其他异常）
      throw error
    }
  }

  /**
   * 验证脚本代码的语法和安全性
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
   * 验证 legs 中的所有 symbol 是否存在于数据库中
   * @throws InvalidStrategyLegsException 当 symbol 不存在或状态不可用时
   */
  private async validateSymbolsExist(legs: StrategyLegDefinition[]): Promise<void> {
    const symbolCodes = legs.map(leg => leg.symbol)
    
    // 批量查询所有 symbols
    const symbols = await this.repository.findSymbolsByCodes(symbolCodes)
    
    const symbolMap = new Map(symbols.map(s => [s.code, s]))
    
    // 检查每个 leg 的 symbol 是否存在
    for (const leg of legs) {
      const symbol = symbolMap.get(leg.symbol)
      
      if (!symbol) {
        throw new InvalidStrategyLegsException({
          reason: `Symbol ${leg.symbol} (leg: ${leg.id}) 不存在于系统中`,
          details: {
            legId: leg.id,
            symbol: leg.symbol,
            availableSymbols: Array.from(symbolMap.keys()),
          },
        })
      }
      
      // 检查 symbol 状态是否可用
      if (symbol.status !== 'ACTIVE') {
        throw new InvalidStrategyLegsException({
          reason: `Symbol ${leg.symbol} (leg: ${leg.id}) 状态不可用，当前状态: ${symbol.status}`,
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



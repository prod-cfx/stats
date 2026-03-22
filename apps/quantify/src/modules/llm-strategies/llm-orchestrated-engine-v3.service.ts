import type { LlmOpsTestLogEvent } from './llm-ops-test-log.events'
import type { LlmRunReason } from './llm-run-reasons'
import type { LlmToolExecutionContext } from './llm-tools.service'
import type { AiSignalPayloadWithMeta } from './llm-v3-tools'
import type { ChatCompletionToolCall, ChatMessage } from '@/modules/ai/providers/llm-provider-adapter.interface'
import type { LlmStrategy, LlmStrategyInstance, LlmStrategyRunStatus, Prisma } from '@/prisma/prisma.types'
import { ErrorCode, fillPromptTemplate } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- 需要用于依赖注入 EventEmitter2
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入 AiService
import { AiService } from '@/modules/ai/ai.service'
import { StrategySignalEvents } from '@/modules/strategy-signals/constants/strategy-signal.constants'
import { TradingSignalCreatedEvent } from '@/modules/strategy-signals/events/strategy-signal.events'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入 PrismaService
import { PrismaService } from '@/prisma/prisma.service'
import { LLM_OPS_TEST_LOG_EVENT } from './llm-ops-test-log.events'
import { LLM_RUN_REASONS } from './llm-run-reasons'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入 LlmToolsService
import { LlmToolsService } from './llm-tools.service'
import { GENERATE_TRADING_SIGNAL_TOOL_NAME, llmV3Tools } from './llm-v3-tools'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入仓储类
import { LlmStrategyInstancesRepository, LlmStrategyRunsRepository } from './repositories'

export interface LlmOrchestratedRunEnvironment {
  /**
   * 当前触发时间，默认 new Date()
   */
  now?: Date
  /**
   * 业务上下文中更细粒度的信息（可选）
   * 例如：本次检查作用的 symbol / timeframe / 触发来源等
   */
  symbol?: string
  timeframe?: string
  triggerSource?: string
  [key: string]: unknown
}

export interface LlmOrchestratedRunResult {
  runId: string
  /**
   * 当 LLM 正确调用 generate_trading_signal 时返回结构化信号；
   * 失败或异常时为 undefined。
   */
  status: LlmStrategyRunStatus
  reason?: LlmRunReason
  errorMessage?: string
  signal?: AiSignalPayloadWithMeta
}

@Injectable()
export class LlmOrchestratedEngineV3 {
  private readonly logger = new Logger(LlmOrchestratedEngineV3.name)

  private static readonly DEFAULT_MAX_TOOL_CALLS_PER_RUN = 8

  constructor(
    private readonly aiService: AiService,
    private readonly instancesRepo: LlmStrategyInstancesRepository,
    private readonly runsRepo: LlmStrategyRunsRepository,
    private readonly toolsService: LlmToolsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  private emitOpsTestLog(payload: Omit<LlmOpsTestLogEvent, 'timestamp'>) {
    const event: LlmOpsTestLogEvent = {
      ...payload,
      timestamp: new Date().toISOString(),
    }
    this.eventEmitter.emit(LLM_OPS_TEST_LOG_EVENT, event)
  }

  /**
   * 为指定实例执行一次 LLM v3 流程：
   * - 加载实例与策略
   * - 构造 system/user 初始消息
   * - 运行带 tools 的对话循环
   * - 记录 LlmStrategyRun
   *
   * 无论成功与否都会返回 runId；只有在成功调用 generate_trading_signal 时才返回 signal。
   */
  async runForInstance(
    instanceId: string,
    createdBy: string,
    environment: LlmOrchestratedRunEnvironment = {},
    options?: {
      /**
       * 是否跳过运行前的状态与节流校验：
       * - 默认 false：遵循实例状态、冷却时间、每小时频率等限制
       * - true：忽略上述限制，始终尝试执行一次完整的 LLM 流程
       */
      skipGuards?: boolean
    },
  ): Promise<LlmOrchestratedRunResult> {
    const instance = await this.instancesRepo.findByIdWithStrategy(instanceId)
    if (!instance || !instance.strategy) {
      this.logger.warn(`LlmStrategyInstance ${instanceId} not found for user ${createdBy}`)
      throw new DomainException('llm_strategy.instance_not_found', {
        code: ErrorCode.LLM_STRATEGY_INSTANCE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { instanceId, createdBy },
      })
    }

    const { strategy } = instance
    const now = environment.now ?? new Date()

    const skipGuards = options?.skipGuards === true

    const isOpsTest = environment.triggerSource === 'ops_test'

    if (isOpsTest) {
      const message =
        `[OPS_TEST] Start LLM run for instance=${instance.id} strategy=${strategy.id} ` +
        `model=${instance.llmModel} skipGuards=${skipGuards} now=${now.toISOString()}`
      this.logger.log(message)
      this.emitOpsTestLog({
        instanceId: instance.id,
        operatorId: createdBy,
        level: 'info',
        message,
      })
    }

    // 运行前状态与节流校验：仅在未显式跳过时生效
    if (!skipGuards) {
      const guardResult = await this.checkExecutionGuards(instance, createdBy, now)
      if (!guardResult.allowed) {
        if (isOpsTest) {
          const message =
            `[OPS_TEST] Guards rejected run for instance=${instance.id}, reason=${guardResult.reason}, ` +
            `error=${guardResult.errorMessage ?? ''}`
          this.logger.log(message)
          this.emitOpsTestLog({
            instanceId: instance.id,
            operatorId: createdBy,
            level: 'warn',
            message,
          })
        }
        // 创建一条 skipped run 记录，方便后续审计
        const skippedRun = await this.runsRepo.create({
          strategyInstance: { connect: { id: instance.id } },
          status: 'skipped' satisfies LlmStrategyRunStatus,
          startedAt: now,
          finishedAt: now,
          llmModel: instance.llmModel,
          reason: guardResult.reason,
          toolCallsCount: 0,
          errorMessage: guardResult.errorMessage,
        })

        return {
          runId: skippedRun.id,
          status: 'skipped',
          reason: guardResult.reason,
          errorMessage: guardResult.errorMessage,
        }
      }
    }
    const effectiveRiskConfig = this.buildEffectiveRiskConfig(strategy, instance)

    const messages = this.buildInitialMessages(strategy, instance, effectiveRiskConfig, environment, now)

    // 预创建 run 记录，确保无论成功与否都有 runId 可追踪
    const run = await this.runsRepo.create({
      strategyInstance: { connect: { id: instance.id } },
      status: 'failed' satisfies LlmStrategyRunStatus, // 先标记为 failed，成功后再更新为 success
      startedAt: now,
      llmModel: instance.llmModel,
      toolCallsCount: 0,
    })

    const toolContext: LlmToolExecutionContext = {
      instance,
      effectiveRiskConfig,
      // 实例不再直接绑定账户/投资组合，相关信息由上层（如订阅）提供
      accountSnapshot: null,
      portfolioSnapshot: null,
      // 使用 runId 作为 sessionId，确保同一次运行的工具调用可以共享缓存（如 contextId）
      sessionId: run.id,
    }

    if (isOpsTest) {
      const message =
        `[OPS_TEST] Created LLM run record runId=${run.id} for instance=${instance.id}`
      this.logger.log(message)
      this.emitOpsTestLog({
        instanceId: instance.id,
        operatorId: createdBy,
        runId: run.id,
        level: 'info',
        message,
      })
    }

    let finalStatus: LlmStrategyRunStatus = 'failed'
    let finalReason: LlmRunReason | undefined
    let toolCallsCount = 0
    let signal: AiSignalPayloadWithMeta | undefined
    let errorMessage: string | undefined

    try {
      const maxToolCalls =
        instance.maxToolCallsPerRun && instance.maxToolCallsPerRun > 0
          ? instance.maxToolCallsPerRun
          : LlmOrchestratedEngineV3.DEFAULT_MAX_TOOL_CALLS_PER_RUN

      let loopIndex = 0

      // 主对话循环
      while (true) {
        loopIndex += 1
        if (isOpsTest) {
          const message =
            `[OPS_TEST] Chat loop #${loopIndex} for runId=${run.id}, ` +
            `current toolCallsCount=${toolCallsCount}`
          this.logger.debug(message)
          this.emitOpsTestLog({
            instanceId: instance.id,
            operatorId: createdBy,
            runId: run.id,
            level: 'debug',
            message,
            meta: {
              phase: 'loop',
              loopIndex,
              toolCallsCount,
            },
          })
        }

        const chatResult = await this.aiService.chat({
          model: instance.llmModel,
          messages,
          tools: llmV3Tools,
          toolChoice: 'auto',
          temperature: 0.2,
          maxTokens: 800,
        })

        if (isOpsTest) {
          const contentSnippet =
            chatResult.content && chatResult.content.length > 0
              ? chatResult.content.slice(0, 400)
              : '<empty>'
          const message =
            `[OPS_TEST] Loop #${loopIndex} assistant reply snippet for runId=${run.id}: ${
            contentSnippet}`
          this.logger.debug(message)
          this.emitOpsTestLog({
            instanceId: instance.id,
            operatorId: createdBy,
            runId: run.id,
            level: 'debug',
            message,
            meta: {
              phase: 'assistant_reply',
              loopIndex,
            },
          })
        }

        const toolCalls = chatResult.toolCalls

        if (toolCalls && toolCalls.length > 0) {
          if (isOpsTest) {
            const message =
              `[OPS_TEST] Received ${toolCalls.length} toolCalls for runId=${run.id}: ` +
              `${toolCalls.map(c => c.function.name).join(', ')}`
            this.logger.debug(message)
            this.emitOpsTestLog({
              instanceId: instance.id,
              operatorId: createdBy,
              runId: run.id,
              level: 'debug',
              message,
            })
          }

          // 把 assistant 的 tool_calls 回复也追加到消息里，保持完整对话上下文
          messages.push({
            role: 'assistant',
            content: chatResult.content ?? '',
            toolCalls,
          })

          for (const call of toolCalls) {
            toolCallsCount += 1

              if (toolCallsCount > maxToolCalls) {
                finalReason = LLM_RUN_REASONS.TOOL_CALL_LIMIT_EXCEEDED
                errorMessage = `Tool call count exceeded max_tool_calls_per_run (${maxToolCalls})`
                this.logger.warn(
                  `LlmStrategyInstance ${instance.id} exceeded tool call limit: ${toolCallsCount}/${maxToolCalls}`,
                )
                if (isOpsTest) {
                  const message =
                    `[OPS_TEST] Tool call limit exceeded for runId=${run.id}, ` +
                    `toolCallsCount=${toolCallsCount}, max=${maxToolCalls}`
                  this.logger.warn(message)
                  this.emitOpsTestLog({
                    instanceId: instance.id,
                    operatorId: createdBy,
                    runId: run.id,
                    level: 'warn',
                    message,
                    meta: {
                      phase: 'error',
                      loopIndex,
                      toolCallsCount,
                    },
                  })
                }
                break
              }

            if (call.function.name === GENERATE_TRADING_SIGNAL_TOOL_NAME) {
              // 终止工具：解析为交易信号并结束循环
              const parsed = this.parseGenerateTradingSignal(call)
              if (!parsed) {
                finalStatus = 'failed'
                finalReason = LLM_RUN_REASONS.INVALID_TOOL_ARGS
                const rawArgs = call.function.arguments ?? ''
                errorMessage = `Invalid arguments for generate_trading_signal: ${String(rawArgs).slice(0, 500)}`
                this.logger.warn(
                  `LlmStrategyInstance ${instance.id} received invalid generate_trading_signal arguments, run marked as INVALID_TOOL_ARGS`,
                )
                if (isOpsTest) {
                  const message =
                    `[OPS_TEST] Invalid generate_trading_signal arguments for runId=${run.id}, ` +
                    `rawArgsSnippet=${String(rawArgs).slice(0, 200)}`
                  this.logger.warn(message)
                  this.emitOpsTestLog({
                    instanceId: instance.id,
                    operatorId: createdBy,
                    runId: run.id,
                    level: 'warn',
                    message,
                  })
                }
                break
              }
              signal = parsed
              finalStatus = 'success'
              finalReason = LLM_RUN_REASONS.OK
              if (isOpsTest) {
                const signalSummary = JSON.stringify(signal).slice(0, 400)
                const message =
                  `[OPS_TEST] RunId=${run.id} successfully produced trading signal: ${signalSummary}`
                this.logger.log(message)
                this.emitOpsTestLog({
                  instanceId: instance.id,
                  operatorId: createdBy,
                  runId: run.id,
                  level: 'info',
                  message,
                  meta: {
                    phase: 'final_signal',
                  },
                })
              }
              break
            }

            // 其它工具统一交给 LlmToolsService
            const result = await this.toolsService.executeTool(call, toolContext)
            if (isOpsTest) {
              const outputSnippet = JSON.stringify(result.output ?? {}).slice(0, 400)
              const message =
                `[OPS_TEST] Executed tool name=${result.name} for runId=${run.id}, ` +
                `toolCallId=${result.id}, outputSnippet=${outputSnippet}`
              this.logger.debug(message)
              this.emitOpsTestLog({
                instanceId: instance.id,
                operatorId: createdBy,
                runId: run.id,
                level: 'debug',
                message,
                meta: {
                  phase: 'tool_result',
                  loopIndex,
                  toolName: result.name,
                  toolCallId: result.id,
                },
              })
            }
            messages.push({
              role: 'tool',
              name: result.name,
              toolCallId: result.id,
              content: JSON.stringify(result.output ?? {}),
            })
          }

          if (
            finalStatus === 'success'
            || finalReason === LLM_RUN_REASONS.TOOL_CALL_LIMIT_EXCEEDED
            || finalReason === LLM_RUN_REASONS.INVALID_TOOL_ARGS
          ) {
            break
          }

          // 继续下一轮循环，由 LLM 基于最新的 tool 输出继续思考
          continue
        }

        // 没有 toolCalls，只返回了纯文本 → 视为协议违背
        finalReason = LLM_RUN_REASONS.NO_TOOL_CALL
        errorMessage =
          chatResult.content && chatResult.content.length > 0
            ? `LLM returned plain text without tool_calls: ${chatResult.content.slice(0, 500)}`
            : 'LLM returned empty response without tool_calls'
        this.logger.warn(
          `LlmStrategyInstance ${instance.id} did not follow tool-calling protocol (no tool_calls returned)`,
        )
        if (isOpsTest) {
          const message =
            `[OPS_TEST] No tool_calls returned for runId=${run.id}, contentSnippet=` +
            `${chatResult.content ? chatResult.content.slice(0, 200) : '<empty>'}`
          this.logger.warn(message)
          this.emitOpsTestLog({
            instanceId: instance.id,
            operatorId: createdBy,
            runId: run.id,
            level: 'warn',
            message,
          })
        }
        break
      }
    }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `LlmStrategyInstance ${instance.id} run failed with unexpected error: ${detail}`,
        error instanceof Error ? error.stack : undefined,
      )
       // 管理员测试时，额外打印更明显的日志
      if (isOpsTest) {
        const message = `[OPS_TEST] RunId=${run.id} failed with unexpected error: ${detail}`
        this.logger.error(
          message,
          error instanceof Error ? error.stack : undefined,
        )
        this.emitOpsTestLog({
          instanceId: instance.id,
          operatorId: createdBy,
          runId: run.id,
          level: 'error',
          message,
        })
      }
      finalReason = LLM_RUN_REASONS.UNEXPECTED_ERROR
      errorMessage = detail
    }

    // 保存对话快照（仅保留最近若干条消息，避免过大）
    const rawDialogSnapshot = this.buildDialogSnapshot(messages)

    // 🔄 创建真实的 TradingSignal 记录
    // 仅在：成功生成信号 && 实例为LIVE模式 && 非管理员测试运行
    let generatedSignalId: string | null = null
    if (signal && finalStatus === 'success' && instance.mode === 'LIVE' && !isOpsTest) {
      try {
        generatedSignalId = await this.createTradingSignal(
          signal,
          instance,
          strategy,
          run.id,
          isOpsTest,
          createdBy,
        )
        if (isOpsTest) {
          const message = `[OPS_TEST] Created TradingSignal signalId=${generatedSignalId} for runId=${run.id}`
          this.logger.log(message)
          this.emitOpsTestLog({
            instanceId: instance.id,
            operatorId: createdBy,
            runId: run.id,
            level: 'info',
            message,
            meta: {
              phase: 'signal_created',
              signalId: generatedSignalId,
            },
          })
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        this.logger.error(
          `Failed to create TradingSignal for run ${run.id}: ${detail}`,
          error instanceof Error ? error.stack : undefined,
        )
        if (isOpsTest) {
          const message = `[OPS_TEST] Failed to create TradingSignal for runId=${run.id}: ${detail}`
          this.logger.error(message)
          this.emitOpsTestLog({
            instanceId: instance.id,
            operatorId: createdBy,
            runId: run.id,
            level: 'error',
            message,
          })
        }
      }
    } else if (signal && isOpsTest) {
      // 管理员测试模式：信号将保存到 run metadata 中，不创建真实 TradingSignal
      const message = instance.mode === 'LIVE' 
        ? `[OPS_TEST] Signal generated and saved to run metadata (not creating TradingSignal in test mode)`
        : `[OPS_TEST] Signal generated but not creating TradingSignal (mode=${instance.mode}, not LIVE)`
      this.logger.log(message)
      this.emitOpsTestLog({
        instanceId: instance.id,
        operatorId: createdBy,
        runId: run.id,
        level: 'info',
        message,
        meta: {
          phase: 'signal_test',
          signalPreview: {
            symbol: signal.symbol,
            direction: signal.direction,
            confidence: signal.confidence,
          },
        },
      })
    } else if (signal && instance.mode !== 'LIVE') {
      // 非 LIVE 模式：信号不会创建 TradingSignal
      this.logger.debug(`Signal generated but not creating TradingSignal (mode=${instance.mode})`)
    }

    await this.runsRepo.update(run.id, {
      status: finalStatus,
      reason: finalReason,
      toolCallsCount,
      llmModel: instance.llmModel,
      finishedAt: new Date(),
      rawDialogSnapshot: rawDialogSnapshot as any,
      errorMessage,
      // 注意: generatedSignal 关联已在 createTradingSignal 方法的事务中完成
      // metadata 中仅存放可 JSON 序列化的信号快照，避免类型不匹配
      metadata: signal ? (JSON.parse(JSON.stringify(signal)) as any) : undefined,
    })

    if (isOpsTest) {
      const summaryMessage =
        `[OPS_TEST] Finished LLM run runId=${run.id} for instance=${instance.id}, ` +
        `status=${finalStatus}, reason=${finalReason ?? 'N/A'}`
      this.logger.log(summaryMessage)
      this.emitOpsTestLog({
        instanceId: instance.id,
        operatorId: createdBy,
        runId: run.id,
        level: 'info',
        message: summaryMessage,
      })
      if (errorMessage) {
        const errorMsg = `[OPS_TEST] runId=${run.id} errorMessage=${errorMessage}`
        this.logger.warn(errorMsg)
        this.emitOpsTestLog({
          instanceId: instance.id,
          operatorId: createdBy,
          runId: run.id,
          level: 'warn',
          message: errorMsg,
        })
      }
    }

    // 同步实例级元数据：记录最近一次运行时间，便于 UI 展示与节流控制
    try {
      await this.instancesRepo.update(instance.id, {
        lastRunAt: new Date(),
      })
    }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      this.logger.warn(
        `Failed to update lastRunAt for LlmStrategyInstance ${instance.id}: ${detail}`,
      )
    }

    // 清理当前会话的缓存，释放内存
    // sessionId = run.id，run 结束后不会再复用，及时清理避免缓存堆积
    try {
      this.toolsService.clearSessionCache(instance.id, run.id)
      this.logger.debug(
        `Cleared session cache for instance ${instance.id}, run ${run.id}`,
      )
    }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      this.logger.warn(
        `Failed to clear session cache for instance ${instance.id}, run ${run.id}: ${detail}`,
      )
    }

    return {
      runId: run.id,
      status: finalStatus,
      reason: finalReason,
      errorMessage,
      signal,
    }
  }

  private buildEffectiveRiskConfig(
    strategy: LlmStrategy,
    instance: LlmStrategyInstance,
  ): Record<string, unknown> | null {
    const base = (strategy.riskConfig ?? {}) as Record<string, unknown> | null
    const overrides = (instance.configOverrides ?? {}) as Record<string, unknown> | null

    const isObject = (value: unknown): value is Record<string, unknown> =>
      !!value && typeof value === 'object' && !Array.isArray(value)

    if (!isObject(base) && !isObject(overrides)) return null

    return {
      ...(isObject(base) ? base : {}),
      ...(isObject(overrides) ? overrides : {}),
    }
  }

  private buildInitialMessages(
    strategy: LlmStrategy,
    instance: LlmStrategyInstance,
    effectiveRiskConfig: Record<string, unknown> | null,
    environment: LlmOrchestratedRunEnvironment,
    now: Date,
  ): ChatMessage[] {
    // 优先使用实例级 metadata 白名单，其次回退到策略级配置
    // 这样确保提示词与工具执行器使用同一份白名单，避免 LLM 被告知可以访问某些 symbols 但执行器拒绝的情况
    const instanceMetadata = (instance.metadata as Record<string, unknown>) || {}
    const allowedSymbols = this.safeJson(instanceMetadata.allowedSymbols) || this.safeJson(strategy.allowedSymbols)
    const allowedTimeframes = this.safeJson(instanceMetadata.allowedTimeframes) || this.safeJson(strategy.allowedTimeframes)

    const riskSummary = effectiveRiskConfig ? JSON.stringify(effectiveRiskConfig) : '未提供，按默认中性风险处理'

    const systemParts: string[] = []
    systemParts.push(
      '你是一名严格遵守风险管理的量化交易策略助手，负责根据给定策略和账户约束，输出**结构化的交易信号**。',
    )
    if (strategy.systemPrompt) {
      systemParts.push('\n=== 策略级 System Prompt ===\n', strategy.systemPrompt)
    }
    systemParts.push(
      '\n=== 工具使用规则 ===',
      '- 你拥有一组工具（tools），可以用来查询账户、组合、行情等信息。',
      `- **最终的交易决策必须通过工具 "${GENERATE_TRADING_SIGNAL_TOOL_NAME}" 输出**，而不是用自然语言直接说明。`,
      '- 如果仍然不确定是否应该交易，可以调用 generate_trading_signal 输出一个带有较低 confidence 的 ALERT 或空仓信号。',
      '\n=== 输出协议（非常重要）===',
      `- 你需要通过 function calling 调用 "${GENERATE_TRADING_SIGNAL_TOOL_NAME}"，并按参数 schema 返回 JSON 对象。`,
      '- 除了工具调用返回的 JSON 参数外，不要在最终回答中输出额外解释性文本。',
      '\n=== JSON 格式要求（必须遵守）===',
      '- **所有字符串字段（如 reasoning）中不要使用换行符，用空格或句号分隔**。',
      '- **确保 JSON 格式正确**：所有引号必须闭合，不要有多余的逗号。',
      '- **reasoning 字段应简洁**：不超过 500 个字符，使用单行文本。',
      '- **示例**：{"direction": "BUY", "signalType": "ENTRY", "confidence": 75, "reasoning": "RSI超卖且价格突破阻力位。"}',
    )

    const systemMessage: ChatMessage = {
      role: 'system',
      content: systemParts.join('\n'),
    }

    const userParts: string[] = []
    userParts.push('请根据以下信息判断当前是否需要生成交易信号，并最终通过工具 generate_trading_signal 输出结果：')
    userParts.push('\n=== 策略信息 ===')
    userParts.push(`- 策略名称: ${strategy.name}`)
    userParts.push(`- 策略描述: ${strategy.description}`)
    userParts.push(`- 策略状态: ${strategy.status}`)

    userParts.push('\n=== 实例信息 ===')
    userParts.push(`- 实例名称: ${instance.name}`)
    userParts.push(`- 实例模式: ${instance.mode}`)
    userParts.push(`- 实例状态: ${instance.status}`)
    userParts.push(`- LLM 模型: ${instance.llmModel}`)

    userParts.push('\n=== 约束与环境 ===')
    userParts.push(`- 当前时间: ${now.toISOString()}`)
    if (allowedSymbols) {
      userParts.push(`- 允许交易的标的 (allowedSymbols): ${JSON.stringify(allowedSymbols)}`)
    }
    if (allowedTimeframes) {
      userParts.push(`- 允许使用的时间周期 (allowedTimeframes): ${JSON.stringify(allowedTimeframes)}`)
    }
    if (environment.symbol) {
      userParts.push(`- 本次触发聚焦标的: ${environment.symbol}`)
    }
    if (environment.timeframe) {
      userParts.push(`- 本次触发聚焦周期: ${environment.timeframe}`)
    }
    if (environment.triggerSource) {
      userParts.push(`- 触发来源: ${environment.triggerSource}`)
    }

    userParts.push('\n=== 风险偏好与风控配置 ===')
    userParts.push(riskSummary)

    if (strategy.initialPromptTemplate) {
      const templateVars = this.buildInitialPromptVariables(
        strategy,
        instance,
        effectiveRiskConfig,
        environment,
        now,
        allowedSymbols,
        allowedTimeframes,
      )
      const rendered = fillPromptTemplate(strategy.initialPromptTemplate, templateVars)

      userParts.push('\n=== 初始提示（基于 initial_prompt_template 渲染） ===')
      userParts.push(rendered ?? strategy.initialPromptTemplate)
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: userParts.join('\n'),
    }

    return [systemMessage, userMessage]
  }

  private parseGenerateTradingSignal(call: ChatCompletionToolCall): AiSignalPayloadWithMeta | null {
    let rawArgs: unknown
    let argsStr = call.function.arguments || '{}'
    
    try {
      rawArgs = JSON.parse(argsStr)
    }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      this.logger.warn(
        `Failed to parse arguments for generate_trading_signal: ${detail}. Attempting to fix...`,
      )
      this.logger.debug(
        `Raw arguments (first 500 chars): ${argsStr.slice(0, 500)}`,
      )
      
      // 尝试修复常见的 JSON 错误
      try {
        // 1. 移除换行符和多余的空白
        argsStr = argsStr.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ')
        
        // 2. 如果 reasoning 字段被截断（缺少闭合引号），尝试补全
        if (argsStr.includes('"reasoning"') && !argsStr.endsWith('}')) {
          // 找到最后一个 " 的位置
          const lastQuoteIndex = argsStr.lastIndexOf('"')
          const hasReasoningValue = argsStr.includes('"reasoning":')
          
          if (hasReasoningValue && lastQuoteIndex > 0) {
            // 截断到合理长度并闭合
            const reasoningStart = argsStr.indexOf('"reasoning":')
            const afterReasoning = argsStr.substring(reasoningStart + 12).trim()
            
            if (afterReasoning.startsWith('"')) {
              // 找到 reasoning 值的结束位置（寻找下一个非转义的引号或字符串末尾）
              let endIndex = 1
              let inEscape = false
              for (let i = 1; i < afterReasoning.length; i++) {
                if (inEscape) {
                  inEscape = false
                  continue
                }
                if (afterReasoning[i] === '\\') {
                  inEscape = true
                  continue
                }
                if (afterReasoning[i] === '"') {
                  endIndex = i
                  break
                }
              }
              
              // 如果没找到闭合引号，截断并添加
              if (endIndex === 1 && afterReasoning.length > 1) {
                const truncatedValue = afterReasoning.substring(1, Math.min(500, afterReasoning.length))
                  .replace(/["\n\r]/g, '') // 移除可能导致问题的字符
                const beforeReasoning = argsStr.substring(0, reasoningStart)
                argsStr = `${beforeReasoning}"reasoning":"${truncatedValue}"}`
                this.logger.debug('Fixed truncated reasoning field')
              }
            }
          }
        }
        
        // 3. 确保以 } 结尾
        if (!argsStr.trim().endsWith('}')) {
          argsStr = `${argsStr.trim()  }}`
        }
        
        // 再次尝试解析
        rawArgs = JSON.parse(argsStr)
        this.logger.log('Successfully fixed and parsed JSON arguments')
      }
      catch (retryError) {
        this.logger.error(
          `Failed to fix JSON: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
        )
        this.logger.debug(`Fixed attempt result: ${argsStr.slice(0, 500)}`)
        return null
      }
    }

    if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
      this.logger.warn('generate_trading_signal arguments must be a JSON object')
      this.logger.debug(`Received type: ${typeof rawArgs}, isArray: ${Array.isArray(rawArgs)}`)
      return null
    }

    const obj = rawArgs as Record<string, unknown>

    // 验证 symbol（必填）
    const symbol = obj.symbol
    if (typeof symbol !== 'string' || !symbol.trim()) {
      this.logger.warn(
        `Missing or invalid symbol in generate_trading_signal arguments: ${String(symbol)}`,
      )
      return null
    }

    const direction = obj.direction
    if (
      direction !== 'BUY' &&
      direction !== 'SELL' &&
      direction !== 'CLOSE_LONG' &&
      direction !== 'CLOSE_SHORT'
    ) {
      this.logger.warn(
        `Invalid direction in generate_trading_signal arguments: ${String(
          direction,
        )}. Expected one of BUY/SELL/CLOSE_LONG/CLOSE_SHORT`,
      )
      return null
    }

    const payload: AiSignalPayloadWithMeta = {
      symbol: symbol.trim().toUpperCase(), // 标准化为大写
      direction,
      signalType:
        obj.signalType === 'EXIT' ||
        obj.signalType === 'ADJUSTMENT' ||
        obj.signalType === 'ALERT'
          ? obj.signalType
          : 'ENTRY',
    }

    if (typeof obj.confidence === 'number') {
      payload.confidence = Math.min(100, Math.max(0, obj.confidence))
    }
    if (typeof obj.entryPrice === 'number') {
      payload.entryPrice = obj.entryPrice
    }
    if (typeof obj.stopLoss === 'number') {
      payload.stopLoss = obj.stopLoss
    }
    if (typeof obj.takeProfit === 'number') {
      payload.takeProfit = obj.takeProfit
    }
    if (typeof obj.reasoning === 'string') {
      payload.reasoning = obj.reasoning
    }
    if (typeof obj.positionSizeQuote === 'number') {
      payload.positionSizeQuote = obj.positionSizeQuote
    }
    if (typeof obj.positionSizeRatio === 'number') {
      const ratio = obj.positionSizeRatio
      if (ratio >= 0 && ratio <= 1) {
        payload.positionSizeRatio = ratio
      }
    }
    if (obj.meta && typeof obj.meta === 'object' && !Array.isArray(obj.meta)) {
      payload.meta = obj.meta as Record<string, unknown>
    }

    return payload
  }

  private buildDialogSnapshot(messages: ChatMessage[]) {
    // 仅保留最近若干条消息，避免快照过大
    const MAX_MESSAGES = 20
    const snapshot =
      messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages
    return snapshot
  }

  private safeJson(value: unknown): unknown | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'object') return value
    try {
      if (typeof value === 'string') {
        return JSON.parse(value)
      }
    }
    catch {
      // ignore
    }
    return null
  }

  /**
   * 运行前状态与节流校验：
   * - 校验实例状态是否允许运行
   * - 基于 cooldownSeconds 与 maxRunsPerHour 做简单节流
   */
  private async checkExecutionGuards(
    instance: LlmStrategyInstance,
    createdBy: string,
    now: Date,
  ): Promise<{
    allowed: boolean
    reason?: LlmRunReason
    errorMessage?: string
  }> {
    // 1. 实例状态必须是 running 才允许执行
    if (instance.status !== 'running') {
      const message = `Instance status is ${instance.status}, only 'running' instances can be executed`
      this.logger.debug(
        `Skip LLM run for instance ${instance.id} due to status: ${instance.status}`,
      )
      return {
        allowed: false,
        reason: LLM_RUN_REASONS.SKIPPED_STATUS,
        errorMessage: message,
      }
    }

    // 2. 冷却时间检查（cooldownSeconds 基于 lastRunAt）
    if (instance.cooldownSeconds && instance.cooldownSeconds > 0 && instance.lastRunAt) {
      const elapsedMs = now.getTime() - instance.lastRunAt.getTime()
      const cooldownMs = instance.cooldownSeconds * 1000
      if (elapsedMs < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000)
        const message = `Instance ${instance.id} is in cooldown window (${remainingSeconds}s remaining)`
        this.logger.debug(message)
        return {
          allowed: false,
          reason: LLM_RUN_REASONS.SKIPPED_RATE_LIMIT,
          errorMessage: message,
        }
      }
    }

    // 3. 每小时运行次数限制（基于最近 1 小时的 run 数）
    if (instance.maxRunsPerHour && instance.maxRunsPerHour > 0) {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      // 仅统计 status !== 'skipped' 的有效运行次数，避免被 guard 插入的 skipped run 污染计数
      const countLastHour = await this.runsRepo.countEffectiveRunsSince(
        instance.id,
        oneHourAgo,
      )

      if (countLastHour >= instance.maxRunsPerHour) {
        const message = `Instance ${instance.id} exceeded maxRunsPerHour (${instance.maxRunsPerHour}) in the last hour`
        this.logger.debug(message)
        return {
          allowed: false,
          reason: LLM_RUN_REASONS.SKIPPED_RATE_LIMIT,
          errorMessage: message,
        }
      }
    }

    return { allowed: true }
  }

  private buildInitialPromptVariables(
    strategy: LlmStrategy,
    instance: LlmStrategyInstance,
    effectiveRiskConfig: Record<string, unknown> | null,
    environment: LlmOrchestratedRunEnvironment,
    now: Date,
    allowedSymbols: unknown | null,
    allowedTimeframes: unknown | null,
  ): Record<string, unknown> {
    const vars: Record<string, unknown> = {
      strategyName: strategy.name,
      strategyDescription: strategy.description,
      strategyStatus: strategy.status,
      instanceName: instance.name,
      instanceMode: instance.mode,
      instanceStatus: instance.status,
      llmModel: instance.llmModel,
      now: now.toISOString(),
    }

    if (environment.symbol) {
      vars.symbol = environment.symbol
    }
    if (environment.timeframe) {
      vars.timeframe = environment.timeframe
    }
    if (environment.triggerSource) {
      vars.triggerSource = environment.triggerSource
    }

    if (effectiveRiskConfig) {
      vars.riskConfig = JSON.stringify(effectiveRiskConfig)
    }
    if (allowedSymbols !== null && allowedSymbols !== undefined) {
      try {
        vars.allowedSymbols = JSON.stringify(allowedSymbols)
      }
      catch {
        vars.allowedSymbols = String(allowedSymbols)
      }
    }
    if (allowedTimeframes !== null && allowedTimeframes !== undefined) {
      try {
        vars.allowedTimeframes = JSON.stringify(allowedTimeframes)
      }
      catch {
        vars.allowedTimeframes = String(allowedTimeframes)
      }
    }

    return vars
  }

  /**
   * 创建真实的 TradingSignal 记录并发出事件
   * 只在 LIVE 模式下调用此方法
   * 
   * 使用事务确保以下操作的原子性：
   * 1. 验证Symbol存在
   * 2. 创建TradingSignal
   * 3. 更新LlmStrategyRun关联
   */
  private async createTradingSignal(
    signal: AiSignalPayloadWithMeta,
    instance: LlmStrategyInstance & { strategy: LlmStrategy },
    strategy: LlmStrategy,
    runId: string,
    isOpsTest = false,
    createdBy?: string,
  ): Promise<string> {
    // 🔧 使用事务确保原子性
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. 查找 symbol
      const symbolRecord = await tx.symbol.findUnique({
        where: { code: signal.symbol },
      })

      if (!symbolRecord) {
        const errorMsg = `Symbol ${signal.symbol} not found in database. Please ensure the symbol exists in the symbols table.`
        this.logger.error(errorMsg, {
          signal: signal.symbol,
          strategyId: strategy.id,
          instanceId: instance.id,
          runId,
        })

        // 🔧 管理员测试模式下发出友好提示
        if (isOpsTest && createdBy) {
          this.emitOpsTestLog({
            instanceId: instance.id,
            operatorId: createdBy,
            runId,
            level: 'error',
            message: `[SIGNAL_ERROR] ${errorMsg}`,
            meta: { symbol: signal.symbol, phase: 'signal_creation' },
          })
        }

        throw new DomainException('llm_strategy.symbol_not_found', {
          code: ErrorCode.MARKET_SYMBOL_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
          args: { symbol: signal.symbol, strategyId: strategy.id, instanceId: instance.id },
        })
      }

      // 2. 创建 TradingSignal
      const data: Prisma.TradingSignalCreateInput = {
        // 关联到 LLM 策略（使用新增的字段）
        llmStrategy: { connect: { id: strategy.id } },
        llmStrategyInstance: { connect: { id: instance.id } },
        symbol: { connect: { id: symbolRecord.id } },
        sourceType: 'AI_GENERATED',
        signalType: signal.signalType,
        direction: signal.direction,
        status: 'PENDING',
        confidence: signal.confidence,
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        positionSizeQuote: signal.positionSizeQuote,
        positionSizeRatio: signal.positionSizeRatio,
        aiModel: instance.llmModel,
        aiReasoning: signal.reasoning,
        // 通过 JSON 序列化+反序列化，保证写入的是纯 JSON 对象（而不是字符串）
        aiRawResponse: JSON.parse(JSON.stringify(signal)),
        marketContext: {
          symbol: signal.symbol,
          llmStrategyRunId: runId,
        },
        metadata: {
          source: 'llm-orchestrated-v3',
          generatorVersion: 'v3',
          llmStrategyRunId: runId,
        },
      }

      const tradingSignal = await tx.tradingSignal.create({ data })

      // 3. 更新运行记录（在事务中）
      await tx.llmStrategyRun.update({
        where: { id: runId },
        data: {
          generatedSignal: { connect: { id: tradingSignal.id } },
        },
      })

      return tradingSignal
    })

    // 🔧 结构化日志
    this.logger.log(`Created TradingSignal ${result.id}`, {
      signalId: result.id,
      strategyId: strategy.id,
      instanceId: instance.id,
      runId,
      symbol: signal.symbol,
      direction: signal.direction,
      signalType: signal.signalType,
      mode: instance.mode,
    })

    // 🔧 事务成功后才发出事件
    this.eventEmitter.emit(
      StrategySignalEvents.CREATED,
      new TradingSignalCreatedEvent(result.id),
    )

    return result.id
  }
}

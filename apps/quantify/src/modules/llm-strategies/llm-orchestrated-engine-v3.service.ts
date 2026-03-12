import type { LlmStrategy, LlmStrategyInstance, LlmStrategyRunStatus, Prisma } from '@prisma/client'
import type { LlmOpsTestLogEvent } from './llm-ops-test-log.events'
import type { LlmRunReason } from './llm-run-reasons'
import type { LlmToolExecutionContext } from './llm-tools.service'
import type { AiSignalPayloadWithMeta } from './llm-v3-tools'
import type { ChatCompletionToolCall, ChatMessage } from '@/modules/ai/providers/llm-provider-adapter.interface'
import { fillPromptTemplate } from '@ai/shared'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏?EventEmitter2
import { EventEmitter2 } from '@nestjs/event-emitter'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂娉ㄥ叆 AiService
import { AiService } from '@/modules/ai/ai.service'
import { StrategySignalEvents } from '@/modules/strategy-signals/constants/strategy-signal.constants'
import { TradingSignalCreatedEvent } from '@/modules/strategy-signals/events/strategy-signal.events'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂娉ㄥ叆 PrismaService
import { PrismaService } from '@/prisma/prisma.service'
import { LLM_OPS_TEST_LOG_EVENT } from './llm-ops-test-log.events'
import { LLM_RUN_REASONS } from './llm-run-reasons'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂娉ㄥ叆 LlmToolsService
import { LlmToolsService } from './llm-tools.service'
import { GENERATE_TRADING_SIGNAL_TOOL_NAME, llmV3Tools } from './llm-v3-tools'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂娉ㄥ叆浠撳偍绫?
import { LlmStrategyInstancesRepository, LlmStrategyRunsRepository } from './repositories'

export interface LlmOrchestratedRunEnvironment {
  /**
   * 褰撳墠瑙﹀彂鏃堕棿锛岄粯璁?new Date()
   */
  now?: Date
  /**
   * 涓氬姟涓婁笅鏂囦腑鏇寸粏绮掑害鐨勪俊鎭紙鍙€夛級
   * 渚嬪锛氭湰娆℃鏌ヤ綔鐢ㄧ殑 symbol / timeframe / 瑙﹀彂鏉ユ簮绛?
   */
  symbol?: string
  timeframe?: string
  triggerSource?: string
  [key: string]: unknown
}

export interface LlmOrchestratedRunResult {
  runId: string
  /**
   * 褰?LLM 姝ｇ‘璋冪敤 generate_trading_signal 鏃惰繑鍥炵粨鏋勫寲淇″彿锛?
   * 澶辫触鎴栧紓甯告椂涓?undefined銆?
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
   * 涓烘寚瀹氬疄渚嬫墽琛屼竴娆?LLM v3 娴佺▼锛?
   * - 鍔犺浇瀹炰緥涓庣瓥鐣?
   * - 鏋勯€?system/user 鍒濆娑堟伅
   * - 杩愯甯?tools 鐨勫璇濆惊鐜?
   * - 璁板綍 LlmStrategyRun
   *
   * 鏃犺鎴愬姛涓庡惁閮戒細杩斿洖 runId锛涘彧鏈夊湪鎴愬姛璋冪敤 generate_trading_signal 鏃舵墠杩斿洖 signal銆?
   */
  async runForInstance(
    instanceId: string,
    createdBy: string,
    environment: LlmOrchestratedRunEnvironment = {},
    options?: {
      /**
       * 鏄惁璺宠繃杩愯鍓嶇殑鐘舵€佷笌鑺傛祦鏍￠獙锛?
       * - 榛樿 false锛氶伒寰疄渚嬬姸鎬併€佸喎鍗存椂闂淬€佹瘡灏忔椂棰戠巼绛夐檺鍒?
       * - true锛氬拷鐣ヤ笂杩伴檺鍒讹紝濮嬬粓灏濊瘯鎵ц涓€娆″畬鏁寸殑 LLM 娴佺▼
       */
      skipGuards?: boolean
    },
  ): Promise<LlmOrchestratedRunResult> {
    const instance = await this.instancesRepo.findByIdWithStrategy(instanceId)
    if (!instance || !instance.strategy) {
      this.logger.warn(`LlmStrategyInstance ${instanceId} not found for user ${createdBy}`)
      throw new Error('LLM strategy instance not found')
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

    // 杩愯鍓嶇姸鎬佷笌鑺傛祦鏍￠獙锛氫粎鍦ㄦ湭鏄惧紡璺宠繃鏃剁敓鏁?
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
        // 鍒涘缓涓€鏉?skipped run 璁板綍锛屾柟渚垮悗缁璁?
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

    // 棰勫垱寤?run 璁板綍锛岀‘淇濇棤璁烘垚鍔熶笌鍚﹂兘鏈?runId 鍙拷韪?
    const run = await this.runsRepo.create({
      strategyInstance: { connect: { id: instance.id } },
      status: 'failed' satisfies LlmStrategyRunStatus, // 鍏堟爣璁颁负 failed锛屾垚鍔熷悗鍐嶆洿鏂颁负 success
      startedAt: now,
      llmModel: instance.llmModel,
      toolCallsCount: 0,
    })

    const toolContext: LlmToolExecutionContext = {
      instance,
      effectiveRiskConfig,
      // 瀹炰緥涓嶅啀鐩存帴缁戝畾璐︽埛/鎶曡祫缁勫悎锛岀浉鍏充俊鎭敱涓婂眰锛堝璁㈤槄锛夋彁渚?
      accountSnapshot: null,
      portfolioSnapshot: null,
      // 浣跨敤 runId 浣滀负 sessionId锛岀‘淇濆悓涓€娆¤繍琛岀殑宸ュ叿璋冪敤鍙互鍏变韩缂撳瓨锛堝 contextId锛?
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

      // 涓诲璇濆惊鐜?
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

          // 鎶?assistant 鐨?tool_calls 鍥炲涔熻拷鍔犲埌娑堟伅閲岋紝淇濇寔瀹屾暣瀵硅瘽涓婁笅鏂?
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
              // 缁堟宸ュ叿锛氳В鏋愪负浜ゆ槗淇″彿骞剁粨鏉熷惊鐜?
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

            // 鍏跺畠宸ュ叿缁熶竴浜ょ粰 LlmToolsService
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

          // 缁х画涓嬩竴杞惊鐜紝鐢?LLM 鍩轰簬鏈€鏂扮殑 tool 杈撳嚭缁х画鎬濊€?
          continue
        }

        // 娌℃湁 toolCalls锛屽彧杩斿洖浜嗙函鏂囨湰 鈫?瑙嗕负鍗忚杩濊儗
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
       // 绠＄悊鍛樻祴璇曟椂锛岄澶栨墦鍗版洿鏄庢樉鐨勬棩蹇?
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

    // 淇濆瓨瀵硅瘽蹇収锛堜粎淇濈暀鏈€杩戣嫢骞叉潯娑堟伅锛岄伩鍏嶈繃澶э級
    const rawDialogSnapshot = this.buildDialogSnapshot(messages)

    // 馃攧 鍒涘缓鐪熷疄鐨?TradingSignal 璁板綍
    // 浠呭湪锛氭垚鍔熺敓鎴愪俊鍙?&& 瀹炰緥涓篖IVE妯″紡 && 闈炵鐞嗗憳娴嬭瘯杩愯
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
      // 绠＄悊鍛樻祴璇曟ā寮忥細淇″彿灏嗕繚瀛樺埌 run metadata 涓紝涓嶅垱寤虹湡瀹?TradingSignal
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
      // 闈?LIVE 妯″紡锛氫俊鍙蜂笉浼氬垱寤?TradingSignal
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
      // 娉ㄦ剰: generatedSignal 鍏宠仈宸插湪 createTradingSignal 鏂规硶鐨勪簨鍔′腑瀹屾垚
      // metadata 涓粎瀛樻斁鍙?JSON 搴忓垪鍖栫殑淇″彿蹇収锛岄伩鍏嶇被鍨嬩笉鍖归厤
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

    // 鍚屾瀹炰緥绾у厓鏁版嵁锛氳褰曟渶杩戜竴娆¤繍琛屾椂闂达紝渚夸簬 UI 灞曠ず涓庤妭娴佹帶鍒?
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

    // 娓呯悊褰撳墠浼氳瘽鐨勭紦瀛橈紝閲婃斁鍐呭瓨
    // sessionId = run.id锛宺un 缁撴潫鍚庝笉浼氬啀澶嶇敤锛屽強鏃舵竻鐞嗛伩鍏嶇紦瀛樺爢绉?
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
    // 浼樺厛浣跨敤瀹炰緥绾?metadata 鐧藉悕鍗曪紝鍏舵鍥為€€鍒扮瓥鐣ョ骇閰嶇疆
    // 杩欐牱纭繚鎻愮ず璇嶄笌宸ュ叿鎵ц鍣ㄤ娇鐢ㄥ悓涓€浠界櫧鍚嶅崟锛岄伩鍏?LLM 琚憡鐭ュ彲浠ヨ闂煇浜?symbols 浣嗘墽琛屽櫒鎷掔粷鐨勬儏鍐?
    const instanceMetadata = (instance.metadata as Record<string, unknown>) || {}
    const allowedSymbols = this.safeJson(instanceMetadata.allowedSymbols) || this.safeJson(strategy.allowedSymbols)
    const allowedTimeframes = this.safeJson(instanceMetadata.allowedTimeframes) || this.safeJson(strategy.allowedTimeframes)

    const riskSummary = effectiveRiskConfig ? JSON.stringify(effectiveRiskConfig) : '鏈彁渚涳紝鎸夐粯璁や腑鎬ч闄╁鐞?

    const systemParts: string[] = []
    systemParts.push(
      '浣犳槸涓€鍚嶄弗鏍奸伒瀹堥闄╃鐞嗙殑閲忓寲浜ゆ槗绛栫暐鍔╂墜锛岃礋璐ｆ牴鎹粰瀹氱瓥鐣ュ拰璐︽埛绾︽潫锛岃緭鍑?*缁撴瀯鍖栫殑浜ゆ槗淇″彿**銆?,
    )
    if (strategy.systemPrompt) {
      systemParts.push('\n=== 绛栫暐绾?System Prompt ===\n', strategy.systemPrompt)
    }
    systemParts.push(
      '\n=== 宸ュ叿浣跨敤瑙勫垯 ===',
      '- 浣犳嫢鏈変竴缁勫伐鍏凤紙tools锛夛紝鍙互鐢ㄦ潵鏌ヨ璐︽埛銆佺粍鍚堛€佽鎯呯瓑淇℃伅銆?,
      `- **鏈€缁堢殑浜ゆ槗鍐崇瓥蹇呴』閫氳繃宸ュ叿 "${GENERATE_TRADING_SIGNAL_TOOL_NAME}" 杈撳嚭**锛岃€屼笉鏄敤鑷劧璇█鐩存帴璇存槑銆俙,
      '- 濡傛灉浠嶇劧涓嶇‘瀹氭槸鍚﹀簲璇ヤ氦鏄擄紝鍙互璋冪敤 generate_trading_signal 杈撳嚭涓€涓甫鏈夎緝浣?confidence 鐨?ALERT 鎴栫┖浠撲俊鍙枫€?,
      '\n=== 杈撳嚭鍗忚锛堥潪甯搁噸瑕侊級===',
      `- 浣犻渶瑕侀€氳繃 function calling 璋冪敤 "${GENERATE_TRADING_SIGNAL_TOOL_NAME}"锛屽苟鎸夊弬鏁?schema 杩斿洖 JSON 瀵硅薄銆俙,
      '- 闄や簡宸ュ叿璋冪敤杩斿洖鐨?JSON 鍙傛暟澶栵紝涓嶈鍦ㄦ渶缁堝洖绛斾腑杈撳嚭棰濆瑙ｉ噴鎬ф枃鏈€?,
      '\n=== JSON 鏍煎紡瑕佹眰锛堝繀椤婚伒瀹堬級===',
      '- **鎵€鏈夊瓧绗︿覆瀛楁锛堝 reasoning锛変腑涓嶈浣跨敤鎹㈣绗︼紝鐢ㄧ┖鏍兼垨鍙ュ彿鍒嗛殧**銆?,
      '- **纭繚 JSON 鏍煎紡姝ｇ‘**锛氭墍鏈夊紩鍙峰繀椤婚棴鍚堬紝涓嶈鏈夊浣欑殑閫楀彿銆?,
      '- **reasoning 瀛楁搴旂畝娲?*锛氫笉瓒呰繃 500 涓瓧绗︼紝浣跨敤鍗曡鏂囨湰銆?,
      '- **绀轰緥**锛歿"direction": "BUY", "signalType": "ENTRY", "confidence": 75, "reasoning": "RSI瓒呭崠涓斾环鏍肩獊鐮撮樆鍔涗綅銆?}',
    )

    const systemMessage: ChatMessage = {
      role: 'system',
      content: systemParts.join('\n'),
    }

    const userParts: string[] = []
    userParts.push('璇锋牴鎹互涓嬩俊鎭垽鏂綋鍓嶆槸鍚﹂渶瑕佺敓鎴愪氦鏄撲俊鍙凤紝骞舵渶缁堥€氳繃宸ュ叿 generate_trading_signal 杈撳嚭缁撴灉锛?)
    userParts.push('\n=== 绛栫暐淇℃伅 ===')
    userParts.push(`- 绛栫暐鍚嶇О: ${strategy.name}`)
    userParts.push(`- 绛栫暐鎻忚堪: ${strategy.description}`)
    userParts.push(`- 绛栫暐鐘舵€? ${strategy.status}`)

    userParts.push('\n=== 瀹炰緥淇℃伅 ===')
    userParts.push(`- 瀹炰緥鍚嶇О: ${instance.name}`)
    userParts.push(`- 瀹炰緥妯″紡: ${instance.mode}`)
    userParts.push(`- 瀹炰緥鐘舵€? ${instance.status}`)
    userParts.push(`- LLM 妯″瀷: ${instance.llmModel}`)

    userParts.push('\n=== 绾︽潫涓庣幆澧?===')
    userParts.push(`- 褰撳墠鏃堕棿: ${now.toISOString()}`)
    if (allowedSymbols) {
      userParts.push(`- 鍏佽浜ゆ槗鐨勬爣鐨?(allowedSymbols): ${JSON.stringify(allowedSymbols)}`)
    }
    if (allowedTimeframes) {
      userParts.push(`- 鍏佽浣跨敤鐨勬椂闂村懆鏈?(allowedTimeframes): ${JSON.stringify(allowedTimeframes)}`)
    }
    if (environment.symbol) {
      userParts.push(`- 鏈瑙﹀彂鑱氱劍鏍囩殑: ${environment.symbol}`)
    }
    if (environment.timeframe) {
      userParts.push(`- 鏈瑙﹀彂鑱氱劍鍛ㄦ湡: ${environment.timeframe}`)
    }
    if (environment.triggerSource) {
      userParts.push(`- 瑙﹀彂鏉ユ簮: ${environment.triggerSource}`)
    }

    userParts.push('\n=== 椋庨櫓鍋忓ソ涓庨鎺ч厤缃?===')
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

      userParts.push('\n=== 鍒濆鎻愮ず锛堝熀浜?initial_prompt_template 娓叉煋锛?===')
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

      // 灏濊瘯淇甯歌鐨?JSON 閿欒
      try {
        // 1. 绉婚櫎鎹㈣绗﹀拰澶氫綑鐨勭┖鐧?
        argsStr = argsStr.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ')

        // 2. 濡傛灉 reasoning 瀛楁琚埅鏂紙缂哄皯闂悎寮曞彿锛夛紝灏濊瘯琛ュ叏
        if (argsStr.includes('"reasoning"') && !argsStr.endsWith('}')) {
          // 鎵惧埌鏈€鍚庝竴涓?" 鐨勪綅缃?
          const lastQuoteIndex = argsStr.lastIndexOf('"')
          const hasReasoningValue = argsStr.includes('"reasoning":')

          if (hasReasoningValue && lastQuoteIndex > 0) {
            // 鎴柇鍒板悎鐞嗛暱搴﹀苟闂悎
            const reasoningStart = argsStr.indexOf('"reasoning":')
            const afterReasoning = argsStr.substring(reasoningStart + 12).trim()

            if (afterReasoning.startsWith('"')) {
              // 鎵惧埌 reasoning 鍊肩殑缁撴潫浣嶇疆锛堝鎵句笅涓€涓潪杞箟鐨勫紩鍙锋垨瀛楃涓叉湯灏撅級
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

              // 濡傛灉娌℃壘鍒伴棴鍚堝紩鍙凤紝鎴柇骞舵坊鍔?
              if (endIndex === 1 && afterReasoning.length > 1) {
                const truncatedValue = afterReasoning.substring(1, Math.min(500, afterReasoning.length))
                  .replace(/["\n\r]/g, '') // 绉婚櫎鍙兘瀵艰嚧闂鐨勫瓧绗?
                const beforeReasoning = argsStr.substring(0, reasoningStart)
                argsStr = `${beforeReasoning}"reasoning":"${truncatedValue}"}`
                this.logger.debug('Fixed truncated reasoning field')
              }
            }
          }
        }

        // 3. 纭繚浠?} 缁撳熬
        if (!argsStr.trim().endsWith('}')) {
          argsStr = `${argsStr.trim()  }}`
        }

        // 鍐嶆灏濊瘯瑙ｆ瀽
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

    // 楠岃瘉 symbol锛堝繀濉級
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
      symbol: symbol.trim().toUpperCase(), // 鏍囧噯鍖栦负澶у啓
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
    // 浠呬繚鐣欐渶杩戣嫢骞叉潯娑堟伅锛岄伩鍏嶅揩鐓ц繃澶?
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
   * 杩愯鍓嶇姸鎬佷笌鑺傛祦鏍￠獙锛?
   * - 鏍￠獙瀹炰緥鐘舵€佹槸鍚﹀厑璁歌繍琛?
   * - 鍩轰簬 cooldownSeconds 涓?maxRunsPerHour 鍋氱畝鍗曡妭娴?
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
    // 1. 瀹炰緥鐘舵€佸繀椤绘槸 running 鎵嶅厑璁告墽琛?
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

    // 2. 鍐峰嵈鏃堕棿妫€鏌ワ紙cooldownSeconds 鍩轰簬 lastRunAt锛?
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

    // 3. 姣忓皬鏃惰繍琛屾鏁伴檺鍒讹紙鍩轰簬鏈€杩?1 灏忔椂鐨?run 鏁帮級
    if (instance.maxRunsPerHour && instance.maxRunsPerHour > 0) {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      // 浠呯粺璁?status !== 'skipped' 鐨勬湁鏁堣繍琛屾鏁帮紝閬垮厤琚?guard 鎻掑叆鐨?skipped run 姹℃煋璁℃暟
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
   * 鍒涘缓鐪熷疄鐨?TradingSignal 璁板綍骞跺彂鍑轰簨浠?
   * 鍙湪 LIVE 妯″紡涓嬭皟鐢ㄦ鏂规硶
   *
   * 浣跨敤浜嬪姟纭繚浠ヤ笅鎿嶄綔鐨勫師瀛愭€э細
   * 1. 楠岃瘉Symbol瀛樺湪
   * 2. 鍒涘缓TradingSignal
   * 3. 鏇存柊LlmStrategyRun鍏宠仈
   */
  private async createTradingSignal(
    signal: AiSignalPayloadWithMeta,
    instance: LlmStrategyInstance & { strategy: LlmStrategy },
    strategy: LlmStrategy,
    runId: string,
    isOpsTest = false,
    createdBy?: string,
  ): Promise<string> {
    // 馃敡 浣跨敤浜嬪姟纭繚鍘熷瓙鎬?
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. 鏌ユ壘 symbol
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

        // 馃敡 绠＄悊鍛樻祴璇曟ā寮忎笅鍙戝嚭鍙嬪ソ鎻愮ず
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

        throw new Error(errorMsg)
      }

      // 2. 鍒涘缓 TradingSignal
      const data: Prisma.TradingSignalCreateInput = {
        // 鍏宠仈鍒?LLM 绛栫暐锛堜娇鐢ㄦ柊澧炵殑瀛楁锛?
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
        // 閫氳繃 JSON 搴忓垪鍖?鍙嶅簭鍒楀寲锛屼繚璇佸啓鍏ョ殑鏄函 JSON 瀵硅薄锛堣€屼笉鏄瓧绗︿覆锛?
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

      // 3. 鏇存柊杩愯璁板綍锛堝湪浜嬪姟涓級
      await tx.llmStrategyRun.update({
        where: { id: runId },
        data: {
          generatedSignal: { connect: { id: tradingSignal.id } },
        },
      })

      return tradingSignal
    })

    // 馃敡 缁撴瀯鍖栨棩蹇?
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

    // 馃敡 浜嬪姟鎴愬姛鍚庢墠鍙戝嚭浜嬩欢
    this.eventEmitter.emit(
      StrategySignalEvents.CREATED,
      new TradingSignalCreatedEvent(result.id),
    )

    return result.id
  }
}

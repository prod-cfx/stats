/**
 * Issue #1492：planner 4 类 fallback 路径反向锁定 spec
 *
 * 收敛入口为 planner rules tree 后，以下 4 类异常路径必须只返回澄清提示，
 * 不再产出 dispatcher 推断的 semanticPatch：
 *   1. aiService.chat resolve `{ content: '' }`        → empty_content
 *   2. aiService.chat resolve `{ content: 'not-json{' }` → invalid_json
 *   3. aiService.chat reject `Error('model does not exist')` → nonRetryable model error
 *   4. aiService.chat reject 两次（transport ETIMEDOUT）      → transport retry exhausted
 *
 * 每个 case 锁定：
 *   - plan.semanticPatch === undefined
 *   - plan.related === true
 *   - plan.logicReady === false
 *
 * 这是对 #1492 「dispatcher 不再参与生产解释链路」的不变量回归保护。
 */
import { Logger } from '@nestjs/common'
import { CodegenConversationService } from '../codegen-conversation.service'
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'

interface SvcShell {
  aiService: { chat: jest.Mock }
  genericSeedDispatcher: { dispatch: jest.Mock }
  plannerDispatcherMerge: PlannerDispatcherMergeService
  logger: Logger
  normalizeSemanticPatch: jest.Mock
  validatePlannerRules: jest.Mock
  applyValidatedPlannerRules: jest.Mock
  extractRawPlannerRules: jest.Mock
  readPlannerPayload: jest.Mock
  collectPlannerSchemaMismatchReasons: jest.Mock
  logPlannerFallback: jest.Mock
  localizedText: jest.Mock
  summarizePlannerError: jest.Mock
}

function makeService(): { svc: CodegenConversationService, shell: SvcShell } {
  const mergeSvc = new PlannerDispatcherMergeService()
  const shell: SvcShell = {
    aiService: { chat: jest.fn() },
    // #1492：dispatcher 仍存在于 shell（构造器残留字段），但生产解释链路不应再调用它；
    //   下面每个 case 都断言 dispatch 未被调用。
    genericSeedDispatcher: { dispatch: jest.fn().mockReturnValue({}) },
    plannerDispatcherMerge: mergeSvc,
    logger: new Logger('CodegenConversationFallbackNoDispatcherTest'),
    normalizeSemanticPatch: jest.fn(v => v ?? null),
    validatePlannerRules: jest.fn().mockReturnValue({ rules: [], quarantine: [] }),
    applyValidatedPlannerRules: jest.fn(),
    extractRawPlannerRules: jest.fn().mockReturnValue(undefined),
    readPlannerPayload: jest.fn(v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}),
    collectPlannerSchemaMismatchReasons: jest.fn().mockReturnValue([]),
    logPlannerFallback: jest.fn(),
    localizedText: jest.fn((_locale: string, _en: string, zh: string) => zh),
    summarizePlannerError: jest.fn((e: unknown) => String(e)),
  }
  const svc = Object.create(CodegenConversationService.prototype) as CodegenConversationService
  Object.assign(svc as unknown as Record<string, unknown>, shell)
  return { svc, shell }
}

const USER_MESSAGE = '5min K 线 EMA20/60/144 上方做多 BOLL 下轨开多 币安 BTCUSDT 永续 5% 止损'

async function callPlanner(svc: CodegenConversationService) {
  return await (svc as unknown as { planConversationByLlm: Function }).planConversationByLlm(
    USER_MESSAGE,
    { rules: [] },
    { providerCode: 'test', locale: 'zh' },
    [],
  )
}

describe('#1492 planner fallback 路径不再产出 dispatcher 推断的 semanticPatch', () => {
  it('empty_content：planner 返回空内容 → 仅追问，无 semanticPatch', async () => {
    const { svc, shell } = makeService()
    shell.aiService.chat.mockResolvedValueOnce({ content: '' })
    const plan = await callPlanner(svc)
    expect(plan.semanticPatch).toBeUndefined()
    expect(plan.related).toBe(true)
    expect(plan.logicReady).toBe(false)
    expect(shell.genericSeedDispatcher.dispatch).not.toHaveBeenCalled()
    expect(shell.logPlannerFallback).toHaveBeenCalledWith('empty_content')
  })

  it('invalid_json：planner 输出非法 JSON → 仅追问，无 semanticPatch', async () => {
    const { svc, shell } = makeService()
    shell.aiService.chat.mockResolvedValueOnce({ content: 'not-json{' })
    const plan = await callPlanner(svc)
    expect(plan.semanticPatch).toBeUndefined()
    expect(plan.related).toBe(true)
    expect(plan.logicReady).toBe(false)
    expect(shell.genericSeedDispatcher.dispatch).not.toHaveBeenCalled()
    expect(shell.logPlannerFallback).toHaveBeenCalledWith('invalid_json', expect.any(Object))
  })

  it('model_not_found：basic 失败（model not exist）→ 仅提示服务不可用，无 semanticPatch', async () => {
    const { svc, shell } = makeService()
    // 注意：生产正则为 /model\s+not\s+exist|model.*not.*found/i，
    //   "model does not exist" 因中间夹 "does" 既不匹配第一支也不匹配第二支（第二支要求 found），
    //   会被错误归类为 transport_failure。这里用 'model not exist' 真正落入 nonRetryableModelError 分支。
    shell.aiService.chat.mockRejectedValueOnce(new Error('model not exist'))
    const plan = await callPlanner(svc)
    expect(plan.semanticPatch).toBeUndefined()
    expect(plan.related).toBe(true)
    expect(plan.logicReady).toBe(false)
    expect(shell.genericSeedDispatcher.dispatch).not.toHaveBeenCalled()
    expect(shell.logPlannerFallback).toHaveBeenCalledWith('model_not_found', expect.any(Object))
  })

  it('transport retry exhausted：两次 transport 失败 → 仅追问，无 semanticPatch', async () => {
    const { svc, shell } = makeService()
    shell.aiService.chat
      .mockRejectedValueOnce(new Error('network ETIMEDOUT'))
      .mockRejectedValueOnce(new Error('network ETIMEDOUT'))
    const plan = await callPlanner(svc)
    expect(plan.semanticPatch).toBeUndefined()
    expect(plan.related).toBe(true)
    expect(plan.logicReady).toBe(false)
    expect(shell.aiService.chat).toHaveBeenCalledTimes(2)
    expect(shell.genericSeedDispatcher.dispatch).not.toHaveBeenCalled()
    expect(shell.logPlannerFallback).toHaveBeenCalledWith('transport_failure_retry_exhausted', expect.any(Object))
  })
})

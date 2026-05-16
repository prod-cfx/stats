import { CodegenConversationService } from '../codegen-conversation.service'

const noop: any = () => {}
const stubObj: any = new Proxy({}, { get: () => noop })

/**
 * #1238 follow-up：DCA 策略入场行为由 ADD_LONG / ADD_SHORT 表达
 *   （seed extractor 把 "开始 DCA" 投影到 canonical spec 时 entry action = ADD_LONG）。
 * 原 evaluateCanonicalCompileability 白名单只识别 OPEN_LONG/OPEN_SHORT，导致用户
 * 配完 DCA 策略点 "生成脚本" 时 entryRuleCount === 0 →
 * "当前还不能稳定投影到可执行入场规则。请补充更明确的触发或退出条件" 误判。
 * 修复：白名单同时接受 ADD_LONG / ADD_SHORT。
 */
describe('codegen-conversation — evaluateCanonicalCompileability 入场动作白名单', () => {
  const svc = new CodegenConversationService(
    stubObj, stubObj, stubObj, stubObj, stubObj, stubObj,
    stubObj, stubObj, stubObj, stubObj, stubObj, stubObj,
  )
  const anySvc = svc as any

  type CanonicalActionType =
    | 'OPEN_LONG' | 'OPEN_SHORT'
    | 'ADD_LONG' | 'ADD_SHORT'
    | 'CLOSE_LONG' | 'CLOSE_SHORT'
    | 'FORCE_EXIT'
    | 'REDUCE_LONG' | 'REDUCE_SHORT'

  function buildSpec(entryActionTypes: CanonicalActionType[], exitActionTypes: CanonicalActionType[] = ['CLOSE_LONG']) {
    return {
      rules: [
        { phase: 'entry', actions: entryActionTypes.map(type => ({ type })) },
        { phase: 'exit', actions: exitActionTypes.map(type => ({ type })) },
      ],
    }
  }

  it('ADD_LONG entry action → canCompile=true（DCA 策略关键 case）', () => {
    const report = anySvc.evaluateCanonicalCompileability(buildSpec(['ADD_LONG']))
    expect(report.canCompile).toBe(true)
    expect(report.entryRuleCount).toBe(1)
    expect(report.reasons).not.toContain('canonical_projection_missing_entry_program')
  })

  it('ADD_SHORT entry action → canCompile=true', () => {
    const report = anySvc.evaluateCanonicalCompileability(buildSpec(['ADD_SHORT'], ['CLOSE_SHORT']))
    expect(report.canCompile).toBe(true)
    expect(report.entryRuleCount).toBe(1)
  })

  it('OPEN_LONG entry action（非 DCA 路径）保持识别', () => {
    const report = anySvc.evaluateCanonicalCompileability(buildSpec(['OPEN_LONG']))
    expect(report.canCompile).toBe(true)
    expect(report.entryRuleCount).toBe(1)
  })

  it('OPEN_SHORT entry action 保持识别', () => {
    const report = anySvc.evaluateCanonicalCompileability(buildSpec(['OPEN_SHORT'], ['CLOSE_SHORT']))
    expect(report.canCompile).toBe(true)
  })

  it('完全无入场动作（CLOSE_LONG only）→ 报 missing entry program', () => {
    const report = anySvc.evaluateCanonicalCompileability(buildSpec(['CLOSE_LONG']))
    expect(report.canCompile).toBe(false)
    expect(report.entryRuleCount).toBe(0)
    expect(report.reasons).toContain('canonical_projection_missing_entry_program')
  })

  it('入场动作存在但出场缺失 → 报 missing exit program', () => {
    const report = anySvc.evaluateCanonicalCompileability({
      rules: [
        { phase: 'entry', actions: [{ type: 'ADD_LONG' }] },
      ],
    })
    expect(report.canCompile).toBe(false)
    expect(report.entryRuleCount).toBe(1)
    expect(report.exitRuleCount).toBe(0)
    expect(report.reasons).toContain('canonical_projection_missing_exit_program')
  })
})


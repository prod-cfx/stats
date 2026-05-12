import { CompiledScriptParserService } from '../compiled-script-parser.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { StrategyConsistencyService } from '../strategy-consistency.service'

/**
 * #1217 follow-up — 第 5 层一致性校验 ADD_LONG/ADD_SHORT 接受
 *
 * 原 normalizeAction / resolvePhaseFromAction / resolveRuleSideScope 三处都
 * 漏掉 ADD_LONG / ADD_SHORT：
 * - normalizeAction → null：script 侧 actions 列表丢失 ADD_LONG，但 specToProfile
 *   通过 flattenV2Rule 绕过 normalize，保留 ADD_LONG → checkActions 报
 *   "脚本缺少关键动作: ADD_LONG"
 * - resolvePhaseFromAction 没匹配 → 走 'rebalance'，而 spec 用 rule.phase='entry'
 *   → rule key 不一致
 * - resolveRuleSideScope 没匹配 → 'both'，而 spec rule.sideScope='long'
 *   → 报 "脚本缺少关键规则映射: rsi.threshold_lte:entry:long"
 *
 * 修复：三处都纳入 ADD_LONG / ADD_SHORT，与 OPEN_LONG / OPEN_SHORT 同口径。
 */
describe('strategyConsistencyService — ADD_LONG / ADD_SHORT 同口径接受（DCA 入场）', () => {
  const svc = new StrategyConsistencyService(
    new ScriptProfileExtractorService(),
    new CompiledScriptParserService(),
  )
  const anySvc = svc as any

  it('normalizeAction 保留 ADD_LONG / ADD_SHORT 而非返回 null', () => {
    expect(anySvc.normalizeAction('ADD_LONG')).toBe('ADD_LONG')
    expect(anySvc.normalizeAction('ADD_SHORT')).toBe('ADD_SHORT')
  })

  it('resolvePhaseFromAction 将 ADD_LONG / ADD_SHORT 视为 entry 阶段', () => {
    expect(anySvc.resolvePhaseFromAction('ADD_LONG')).toBe('entry')
    expect(anySvc.resolvePhaseFromAction('ADD_SHORT')).toBe('entry')
  })

  it('resolveRuleSideScope 将 ADD_LONG / ADD_SHORT 锁到 long / short side', () => {
    expect(anySvc.resolveRuleSideScope('both', 'ADD_LONG')).toBe('long')
    expect(anySvc.resolveRuleSideScope('both', 'ADD_SHORT')).toBe('short')
  })

  it('OPEN_LONG / OPEN_SHORT 行为未被破坏（regression guard）', () => {
    expect(anySvc.normalizeAction('OPEN_LONG')).toBe('OPEN_LONG')
    expect(anySvc.resolvePhaseFromAction('OPEN_LONG')).toBe('entry')
    expect(anySvc.resolveRuleSideScope('both', 'OPEN_LONG')).toBe('long')
  })
})

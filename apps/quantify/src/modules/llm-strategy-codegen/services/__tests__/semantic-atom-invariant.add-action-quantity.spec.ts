import { SemanticAtomInvariantService } from '../semantic-atom-invariant.service'

/**
 * #1238 follow-up：position sizing contract drift critical check 通过
 * readAstOpenActionPositionSizings 收集 AST 中开仓动作的 quantity，与
 * SemanticState.position.sizing / canonicalSpec / IR.portfolio.sizing 比对。
 *
 * 原过滤只收 OPEN_LONG / OPEN_SHORT 的 quantity，DCA 策略入场动作由
 * ADD_LONG / ADD_SHORT 表达 → astCandidates=[] → ast.passed=false →
 * codegen.semantic_atom_drift critical reject，回测/部署阶段被卡住。
 *
 * 修复：与 evaluateCanonicalCompileability 同口径，纳入 ADD_LONG / ADD_SHORT。
 */
describe('SemanticAtomInvariantService — readAstOpenActionPositionSizings ADD_LONG/ADD_SHORT 接受', () => {
  const svc = new SemanticAtomInvariantService()
  const anySvc = svc as any

  function buildAst(actionKinds: string[]): any {
    return {
      decisionPrograms: [
        {
          actions: actionKinds.map(kind => ({
            kind,
            quantity: { mode: 'fixed_quote', value: 100, asset: 'USDT' },
          })),
        },
      ],
      orderPrograms: [],
    }
  }

  it('ADD_LONG action quantity 被纳入 astCandidates（DCA 策略关键 case）', () => {
    const candidates = anySvc.readAstOpenActionPositionSizings(buildAst(['ADD_LONG']))
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toEqual({ mode: 'fixed_quote', value: 100, asset: 'USDT' })
  })

  it('ADD_SHORT action quantity 被纳入 astCandidates', () => {
    const candidates = anySvc.readAstOpenActionPositionSizings(buildAst(['ADD_SHORT']))
    expect(candidates).toHaveLength(1)
  })

  it('OPEN_LONG / OPEN_SHORT 保持识别', () => {
    const longCandidates = anySvc.readAstOpenActionPositionSizings(buildAst(['OPEN_LONG']))
    const shortCandidates = anySvc.readAstOpenActionPositionSizings(buildAst(['OPEN_SHORT']))
    expect(longCandidates).toHaveLength(1)
    expect(shortCandidates).toHaveLength(1)
  })

  it('CLOSE_LONG / REDUCE_LONG 不应被收入开仓 quantity', () => {
    const closeCandidates = anySvc.readAstOpenActionPositionSizings(buildAst(['CLOSE_LONG']))
    const reduceCandidates = anySvc.readAstOpenActionPositionSizings(buildAst(['REDUCE_LONG']))
    expect(closeCandidates).toHaveLength(0)
    expect(reduceCandidates).toHaveLength(0)
  })

  it('混合 OPEN_LONG + ADD_LONG 两种 entry 形态共存时 quantities 都被收入', () => {
    const candidates = anySvc.readAstOpenActionPositionSizings(buildAst(['OPEN_LONG', 'ADD_LONG']))
    expect(candidates).toHaveLength(2)
  })

  it('fixed_quote 默认 USDT asset 可与省略 asset 的下游快照匹配', () => {
    expect(anySvc.matchesPositionSizingSnapshot(
      { mode: 'fixed_quote', value: 100 },
      { mode: 'fixed_quote', value: 100, asset: 'USDT' },
    )).toBe(true)
  })
})

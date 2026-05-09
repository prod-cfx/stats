import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Phase 5 S4 T13 (issue #984) — live-signal fast path 接入 orchestrationPrograms。
 *
 * 与 backtest 共用同一 runOrderPrograms 调用路径（packages/shared 的 compiled-runtime），
 * 行为同源。本 spec 做 light integration：验证 wiring + read-only 边界注释。
 *
 * live closeProgramIds 真实启用（合成 close decision、挂限价单等）留 follow-up issue —
 * 当前 live 端的 close 由现有 working-order 协议处理；本 PR 只接入 7 参数，让 ctx 层面
 * 能 capture closeProgramIds 让 follow-up 消费（与 S7 live drawdown 同范式）。
 */
describe('signalGeneratorService orchestration program wiring (live-signal fast path)', () => {
  const src = readFileSync(resolve(__dirname, 'signal-generator.service.ts'), 'utf8')

  it('13.A: source 内含 orchestrationPrograms 引用（projection 读取 + runOrderPrograms 注入）', () => {
    expect(src).toContain('orchestrationPrograms')
  })

  it('13.B: runOrderPrograms 调用包含 7 个参数（含 orchestrationPrograms fallback []）', () => {
    expect(src).toMatch(
      /runOrderPrograms\([\s\S]*?ctx,[\s\S]*?orderPrograms,[\s\S]*?exprValues,[\s\S]*?guardState,[\s\S]*?orderProgramOrder,[\s\S]*?executionModel,[\s\S]*?orchestrationPrograms[\s\S]*?\?\?\s*\[\][\s\S]*?\)/,
    )
  })

  it('13.C: 注释中标注 follow-up issue 留待 live close decision 真实启用', () => {
    expect(src).toMatch(/follow-up[\s\S]*?close|close[\s\S]*?follow-up/i)
  })

  it('13.D: 第 7 参数类型化为 Parameters<typeof runOrderPrograms>[6]', () => {
    expect(src).toMatch(/Parameters<typeof runOrderPrograms>\[6\]/)
  })

  it('13.E (Phase 5 S0a): runOrderPrograms 第 8 参类型为 Readonly<Record<string, ProgramLifecycleState>> | undefined', () => {
    // 类型断言：第 8 参类型保持稳定
    type Param8 = Parameters<typeof import('@ai/shared/script-engine/compiled-runtime').runOrderPrograms>[7]
    type Expected = Readonly<Record<string, import(
      '@ai/shared/script-engine/compiled-runtime'
    ).ProgramLifecycleState>> | undefined
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _typeCheck: Param8 = undefined as Expected
  })

  // Phase 5 S5（#984）：live 端真实接入 dynamic_grid lifecycle map + cleanup
  it('15.A (Phase 5 S5): 源码注入 lifecycleStateIn from programLifecycleStateByStrategyInstanceId map', () => {
    expect(src).toContain('programLifecycleStateByStrategyInstanceId')
    expect(src).toContain('lifecycleStateIn')
    expect(src).toContain('lifecycleStateMap.set(strategyInstanceId, orderState.programLifecycleStateNext)')
  })

  it('15.B (Phase 5 S5): 源码定义 cleanupProgramLifecycleState + eventEmitter listener', () => {
    expect(src).toContain('cleanupProgramLifecycleState(strategyInstanceId: string): void')
    expect(src).toMatch(/this\.eventEmitter\.on\(['"]strategy-instance\.deleted['"]/)
  })

  it('15.C (Phase 5 S5): buildCompiledRuntimeAdapter 接受 strategyInstanceId 参数', () => {
    expect(src).toMatch(/buildCompiledRuntimeAdapter\([\s\S]*?scriptCode:\s*string,\s*strategyInstanceId\?:\s*string/)
  })
})

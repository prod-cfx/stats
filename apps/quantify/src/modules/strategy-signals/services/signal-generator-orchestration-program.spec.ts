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
})

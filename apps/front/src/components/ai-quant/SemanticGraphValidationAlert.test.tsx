/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { SemanticGraphValidationAlert } from './SemanticGraphValidationAlert'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const ORIGINAL_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV

beforeEach(() => {
  // 默认按 development 跑，保证开发审计场景的断言不被宿主 env（如 dx 注入
  // staging）污染；具体 staging/production case 在子测试中显式覆盖。
  process.env.NEXT_PUBLIC_APP_ENV = 'development'
})

afterEach(() => {
  if (ORIGINAL_APP_ENV === undefined) {
    delete process.env.NEXT_PUBLIC_APP_ENV
  } else {
    process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL_APP_ENV
  }
})

async function renderAlert(validationReport: React.ComponentProps<typeof SemanticGraphValidationAlert>['validationReport']) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(<SemanticGraphValidationAlert validationReport={validationReport} />)
  })

  return { container, root }
}

describe('SemanticGraphValidationAlert', () => {
  it('hides evidence_text_not_substring diagnostics from normal error alert', async () => {
    const { container, root } = await renderAlert({
      ok: false,
      errors: [{
        code: 'evidence_text_not_substring',
        message: 'Planner schema rejected semantic patch: evidence_text_not_substring',
      }],
    })

    expect(container.textContent).not.toContain('Semantic Graph Validation')
    expect(container.textContent).not.toContain('evidence_text_not_substring')

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('hides planner schema shape diagnostics from normal user alert', async () => {
    const { container, root } = await renderAlert({
      ok: false,
      errors: [{
        code: 'rule_shape_invalid',
        message: 'Planner schema rejected semantic patch: rule_shape_invalid',
      }],
    })

    expect(container.textContent).not.toContain('Semantic Graph Validation')
    expect(container.textContent).not.toContain('rule_shape_invalid')

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('keeps hard validation errors visible in development', async () => {
    const { container, root } = await renderAlert({
      ok: false,
      errors: [{
        code: 'rules_missing_or_empty',
        message: 'Planner schema rejected semantic patch: rules_missing_or_empty',
      }],
    })

    expect(container.textContent).toContain('Semantic Graph Validation')
    expect(container.textContent).toContain('rules_missing_or_empty')

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  // Staging 30 策略复测：rules_missing_or_empty 等硬错误属于内部诊断信号，
  //   暴露给终端用户没有可操作性，反而干扰策略确认流程（见 issue 截图 2）。
  //   组件入口须按 NEXT_PUBLIC_APP_ENV gate：staging / production 一律返回 null。
  it('hides the entire diagnostic panel from staging/production audience', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'staging'

    const { container, root } = await renderAlert({
      ok: false,
      errors: [{
        code: 'rules_missing_or_empty',
        message: 'Planner schema rejected semantic patch: rules_missing_or_empty',
      }],
    })

    expect(container.textContent).not.toContain('Semantic Graph Validation')
    expect(container.textContent).not.toContain('rules_missing_or_empty')

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  // fail-closed audience gate：未知 / 大小写变体 / 字符串字面量 'undefined'
  //   / 缺省 NEXT_PUBLIC_APP_ENV 全部视作非开发，避免容器漏配回归泄漏。
  it.each([
    ['production', 'production'],
    ['STAGING', 'STAGING（大小写非 development）'],
    ['undefined', '字面字符串 "undefined"'],
    [undefined, '缺省（dotenv 未注入）'],
    ['', '空字符串'],
  ])('hides panel when NEXT_PUBLIC_APP_ENV is %p (%s)', async (envValue: string | undefined) => {
    if (envValue === undefined) {
      delete process.env.NEXT_PUBLIC_APP_ENV
    } else {
      process.env.NEXT_PUBLIC_APP_ENV = envValue
    }

    const { container, root } = await renderAlert({
      ok: false,
      errors: [{
        code: 'rules_missing_or_empty',
        message: 'Planner schema rejected semantic patch: rules_missing_or_empty',
      }],
    })

    expect(container.textContent).not.toContain('Semantic Graph Validation')

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  // NODE_ENV=production 优先级契约：即便 NEXT_PUBLIC_APP_ENV=development
  //   也必须隐藏，防 fail-closed gate 未来回退时 production 短路被破坏。
  it('hides panel when NODE_ENV=production even with NEXT_PUBLIC_APP_ENV=development', async () => {
    const originalNodeEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
    process.env.NEXT_PUBLIC_APP_ENV = 'development'

    try {
      const { container, root } = await renderAlert({
        ok: false,
        errors: [{
          code: 'rules_missing_or_empty',
          message: 'Planner schema rejected semantic patch: rules_missing_or_empty',
        }],
      })

      expect(container.textContent).not.toContain('Semantic Graph Validation')

      await act(async () => {
        root.unmount()
      })
      container.remove()
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, configurable: true })
    }
  })
})

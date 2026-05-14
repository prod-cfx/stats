/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { RunningStrategyEditGuardDialog } from './RunningStrategyEditGuardDialog'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('RunningStrategyEditGuardDialog', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('uses a viewport-bounded scrollable layout with mobile action stacking', async () => {
    await act(async () => {
      root.render(
        <RunningStrategyEditGuardDialog
          open
          mode="running"
          onViewRunningStrategy={() => undefined}
          onStopStrategy={() => undefined}
          onClose={() => undefined}
        />,
      )
    })

    const overlay = container.firstElementChild
    const panel = overlay?.firstElementChild
    const actions = container.querySelector('[data-testid="running-guard-actions"]')

    expect(overlay?.className).toContain('py-4')
    expect(panel?.className).toContain('max-h-[calc(100dvh-2rem)]')
    expect(panel?.className).toContain('overflow-y-auto')
    expect(actions?.className).toContain('grid')
    expect(actions?.className).toContain('sm:flex')
  })
})

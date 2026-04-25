/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeToggle } from './ThemeToggle'

const mockToggleTheme = jest.fn()
const mockUseTheme = jest.fn()

jest.mock('lucide-react', () => ({
  Moon: () => null,
  Sun: () => null,
}))

jest.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => mockUseTheme(),
}))

jest.mock('react-i18next', () => ({
  // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      ({
        'theme.dark': 'Dark',
        'theme.light': 'Light',
        'theme.toggle': 'Toggle light/dark mode',
      }[key] ?? options?.defaultValue ?? key),
  }),
}))

describe('ThemeToggle', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    mockToggleTheme.mockReset()
    mockUseTheme.mockReset()
    mockUseTheme.mockReturnValue({ theme: 'dark', toggleTheme: mockToggleTheme })
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

  it('renders localized English theme labels by default', async () => {
    await act(async () => {
      root.render(<ThemeToggle />)
    })

    const button = container.querySelector('button')
    expect(button?.textContent).toContain('Dark')
    expect(button?.textContent).not.toContain('夜间')
    expect(button?.getAttribute('aria-label')).toBe('Toggle light/dark mode')
    expect(button?.getAttribute('title')).toBe('Toggle light/dark mode')
  })
})

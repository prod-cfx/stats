/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { UserAvatar } from './UserAvatar'

describe('UserAvatar', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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

  it('keeps identicon stable for the same user id even when display names differ', async () => {
    await act(async () => {
      root.render(<UserAvatar userId="user-1" name="12***@qq.com" />)
    })
    const firstCells = Array.from(container.querySelectorAll('span[aria-hidden="true"] > span'))
      .map(cell => cell.getAttribute('class'))

    await act(async () => {
      root.render(<UserAvatar userId="user-1" name="12demo@qq.com" />)
    })
    const secondCells = Array.from(container.querySelectorAll('span[aria-hidden="true"] > span'))
      .map(cell => cell.getAttribute('class'))

    expect(secondCells).toEqual(firstCells)
  })
})

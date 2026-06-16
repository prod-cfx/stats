/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server.node'
import { ClientTimeText } from './ClientTimeText'

describe('ClientTimeText', () => {
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

  it('keeps server markup free of locale formatted time and fills it after mount', async () => {
    const value = '2026-04-11T00:00:00.000Z'
    const formatted = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))

    const markup = renderToStaticMarkup(<ClientTimeText value={value} />)

    expect(markup).not.toContain(formatted)

    await act(async () => {
      root.render(<ClientTimeText value={value} />)
    })

    expect(container.textContent).toBe(formatted)
  })
})

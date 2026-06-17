import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useSameOriginReturnHref } from './return-href'

function ReturnHrefProbe({ fallbackHref, onRender }: { fallbackHref: string; onRender: (href: string) => void }) {
  const href = useSameOriginReturnHref(fallbackHref)
  onRender(href)
  return <a href={href}>Back</a>
}

describe('useSameOriginReturnHref', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    window.history.pushState(null, '', '/current')
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: 'http://localhost/previous?from=plaza#top',
    })
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  it('keeps first client render aligned with the fallback href before reading referrer', () => {
    const renders: string[] = []
    const root = createRoot(container)

    act(() => {
      root.render(<ReturnHrefProbe fallbackHref="/zh/account?tab=ai-quant" onRender={href => renders.push(href)} />)
    })

    expect(renders[0]).toBe('/zh/account?tab=ai-quant')
    expect(renders).toContain('/previous?from=plaza#top')

    act(() => {
      root.unmount()
    })
  })
})

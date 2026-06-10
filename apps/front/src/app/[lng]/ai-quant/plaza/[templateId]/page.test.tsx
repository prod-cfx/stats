import { describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server.node'
import Page from './page'

const mockClient = jest.fn((props: { lng: string, templateId: string }) => (
  <div data-testid="official-report-client">{props.lng}:{props.templateId}</div>
))

jest.mock('@/components/layout/Footer', () => ({ Footer: () => <footer>footer</footer> }))
jest.mock('@/components/layout/Navbar', () => ({ Navbar: () => <nav>navbar</nav> }))
jest.mock('./OfficialStrategyBacktestReportClient', () => ({
  OfficialStrategyBacktestReportClient: (props: { lng: string, templateId: string }) => mockClient(props),
}))

describe('official strategy plaza report page', () => {
  it('renders the public report client with locale and template id params', async () => {
    const element = await Page({ params: Promise.resolve({ lng: 'zh', templateId: 'ma-cross' }) })

    expect(element).toBeTruthy()
    renderToStaticMarkup(element)
    expect(mockClient).toHaveBeenCalledWith({ lng: 'zh', templateId: 'ma-cross' })
  })
})

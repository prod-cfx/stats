/** @jest-environment jsdom */

import { describe, expect, it } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { SemanticGraphValidationAlert } from './SemanticGraphValidationAlert'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

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

  it('keeps hard validation errors visible', async () => {
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
})

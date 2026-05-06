import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { MastraGenerationFailedException } from '../mastra-generation-failed.exception'

describe('MastraGenerationFailedException', () => {
  it('errorCode 等于 MASTRA_GENERATION_FAILED', () => {
    const ex = new MastraGenerationFailedException({ agentId: 'a', reason: 'boom' })
    expect(ex.code).toBe(ErrorCode.MASTRA_GENERATION_FAILED)
  })

  it('getStatus 返回 500 INTERNAL_SERVER_ERROR', () => {
    const ex = new MastraGenerationFailedException({ agentId: 'a', reason: 'boom' })
    expect(ex.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
  })

  it('args 透传 agentId/reason', () => {
    const ex = new MastraGenerationFailedException({ agentId: 'a', reason: 'boom' })
    expect(ex.args).toEqual({ agentId: 'a', reason: 'boom' })
  })
})

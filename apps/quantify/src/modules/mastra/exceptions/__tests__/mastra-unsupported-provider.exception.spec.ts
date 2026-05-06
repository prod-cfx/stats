import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { MastraUnsupportedProviderException } from '../mastra-unsupported-provider.exception'

describe('MastraUnsupportedProviderException', () => {
  it('errorCode 等于 MASTRA_UNSUPPORTED_PROVIDER', () => {
    const ex = new MastraUnsupportedProviderException({ providerCode: 'strategy-codegen' })
    expect(ex.code).toBe(ErrorCode.MASTRA_UNSUPPORTED_PROVIDER)
  })

  it('getStatus 返回 500 INTERNAL_SERVER_ERROR', () => {
    const ex = new MastraUnsupportedProviderException({ providerCode: 'strategy-codegen' })
    expect(ex.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
  })

  it('args 透传 providerCode', () => {
    const ex = new MastraUnsupportedProviderException({ providerCode: 'strategy-codegen' })
    expect(ex.args).toEqual({ providerCode: 'strategy-codegen' })
  })
})

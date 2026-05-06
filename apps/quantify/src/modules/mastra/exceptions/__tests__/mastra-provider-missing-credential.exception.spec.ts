import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { MastraProviderMissingCredentialException } from '../mastra-provider-missing-credential.exception'

describe('MastraProviderMissingCredentialException', () => {
  it('errorCode 等于 MASTRA_PROVIDER_MISSING_CREDENTIAL', () => {
    const ex = new MastraProviderMissingCredentialException({
      providerCode: 'default',
      expectedEnv: 'QUANTIFY_UNIAPI_API_KEY',
    })
    expect(ex.code).toBe(ErrorCode.MASTRA_PROVIDER_MISSING_CREDENTIAL)
  })

  it('getStatus 返回 500 INTERNAL_SERVER_ERROR', () => {
    const ex = new MastraProviderMissingCredentialException({
      providerCode: 'default',
      expectedEnv: 'QUANTIFY_UNIAPI_API_KEY',
    })
    expect(ex.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
  })

  it('args 字段透传，含 providerCode/expectedEnv/modelId', () => {
    const ex = new MastraProviderMissingCredentialException({
      providerCode: 'default',
      expectedEnv: 'QUANTIFY_UNIAPI_API_KEY',
      modelId: 'gpt-4o-mini',
    })
    expect(ex.args).toEqual({
      providerCode: 'default',
      expectedEnv: 'QUANTIFY_UNIAPI_API_KEY',
      modelId: 'gpt-4o-mini',
    })
  })
})

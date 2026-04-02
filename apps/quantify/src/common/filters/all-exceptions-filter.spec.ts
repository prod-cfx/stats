import { ErrorCode } from '@ai/shared'
import { HttpException, HttpStatus } from '@nestjs/common'

import { DomainException } from '../exceptions/domain.exception'
import { AllExceptionsFilter } from './all-exceptions.filter'

jest.mock('@/prisma/prisma.types', () => {
  class PrismaClientKnownRequestError extends Error {
    code = 'P5000'
    meta?: Record<string, unknown>
  }
  return {
    Prisma: { PrismaClientKnownRequestError },
  }
})

function createHttpHost(path: string) {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const setHeader = jest.fn()
  const getHeader = jest.fn().mockReturnValue(undefined)

  const response = {
    headersSent: false,
    status,
    setHeader,
    getHeader,
  }

  const request = {
    method: 'GET',
    url: path,
    originalUrl: path,
    headers: {},
  }

  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  }

  return { host, response, request, status, json }
}

describe('allExceptionsFilter', () => {
  const env = {
    isProd: () => false,
    isE2E: () => false,
    isTest: () => true,
  }

  it('adds stage and requestId for domain exception on codegen path', () => {
    const filter = new AllExceptionsFilter(env as any)
    const { host, status, json } = createHttpHost('/api/v1/llm-strategy-codegen/sessions')

    filter.catch(new DomainException('boom', {
      code: ErrorCode.AI_PROVIDER_ERROR,
      status: HttpStatus.BAD_GATEWAY,
    }), host as any)

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY)
    const body = json.mock.calls[0][0] as Record<string, any>
    expect(body.error?.requestId).toBeDefined()
    expect(body.error?.stage).toBe('codegen')
  })

  it('adds stage for capability http exception', () => {
    const filter = new AllExceptionsFilter(env as any)
    const { host, status, json } = createHttpHost('/api/v1/backtesting/capabilities')
    const exception = new HttpException({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'x',
    }, HttpStatus.INTERNAL_SERVER_ERROR)

    filter.catch(exception, host as any)

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    const body = json.mock.calls[0][0] as Record<string, any>
    expect(body.error?.requestId).toBeDefined()
    expect(body.error?.stage).toBe('capability')
  })
})

import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { throwError } from 'rxjs'
import { LoggerInterceptor } from './logger.interceptor'

describe('LoggerInterceptor', () => {
  const createContext = (): ExecutionContext => {
    const req = {
      method: 'POST',
      url: '/api/v1/llm-strategy-codegen/sessions/s1/messages',
      originalUrl: '/api/v1/llm-strategy-codegen/sessions/s1/messages',
      headers: {},
      body: { userId: 'u1', message: '继续生成' },
      query: {},
    }
    const res = {
      statusCode: 200,
    }

    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext
  }

  const createCallHandler = (error: unknown): CallHandler => ({
    handle: () => throwError(() => error),
  })

  const createInterceptor = () => new LoggerInterceptor({
    isE2E: () => false,
    isProd: () => false,
  } as any)

  it('logs 4xx errors as warn in development', (done) => {
    const interceptor = createInterceptor()
    const logger = (interceptor as any).logger
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined)
    jest.spyOn(logger, 'log').mockImplementation(() => undefined)

    interceptor.intercept(createContext(), createCallHandler({ status: 409, message: '会话已终态，不能继续写入' })).subscribe({
      error: () => {
        expect(warnSpy).toHaveBeenCalled()
        expect(errorSpy).not.toHaveBeenCalled()
        done()
      },
    })
  })

  it('logs 5xx errors as error in development', (done) => {
    const interceptor = createInterceptor()
    const logger = (interceptor as any).logger
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined)
    jest.spyOn(logger, 'log').mockImplementation(() => undefined)

    interceptor.intercept(createContext(), createCallHandler(new Error('boom'))).subscribe({
      error: () => {
        expect(errorSpy).toHaveBeenCalled()
        expect(warnSpy).not.toHaveBeenCalled()
        done()
      },
    })
  })

  it('supports HttpException-like getStatus for status resolution', (done) => {
    const interceptor = createInterceptor()
    const logger = (interceptor as any).logger
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined)
    jest.spyOn(logger, 'log').mockImplementation(() => undefined)

    interceptor.intercept(createContext(), createCallHandler({
      getStatus: () => 400,
      message: 'bad request',
    })).subscribe({
      error: () => {
        expect(warnSpy).toHaveBeenCalled()
        expect(errorSpy).not.toHaveBeenCalled()
        done()
      },
    })
  })
})

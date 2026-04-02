import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { Transactional } from '@nestjs-cls/transactional'
import { Reflector } from '@nestjs/core'
import { lastValueFrom, of } from 'rxjs'
import { TransactionalWithAfterCommit } from '@/common/decorators/transactional-with-after-commit.decorator'
import { AfterCommitInterceptor } from './after-commit.interceptor'
import 'reflect-metadata'

describe('afterCommitInterceptor', () => {
  class TestController {
    @TransactionalWithAfterCommit()
    afterCommitHandler() {}

    @Transactional()
    transactionalHandler() {}
  }

  function createContext(handler: (...args: never[]) => unknown): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => TestController,
    } as unknown as ExecutionContext
  }

  function createNext(): CallHandler {
    return {
      handle: () => of('ok'),
    }
  }

  it('drains queued tasks only for handlers marked with after-commit metadata', async () => {
    const txEvents = {
      reset: jest.fn(),
      drainAfterCommitTasks: jest.fn().mockReturnValue([jest.fn()]),
      runTasks: jest.fn().mockResolvedValue({ success: 1, failed: 0, errors: [] }),
    }

    const interceptor = new AfterCommitInterceptor(txEvents as never, new Reflector())

    await lastValueFrom(interceptor.intercept(createContext(TestController.prototype.afterCommitHandler), createNext()))

    expect(txEvents.reset).toHaveBeenCalledTimes(1)
    expect(txEvents.drainAfterCommitTasks).toHaveBeenCalledTimes(1)
    expect(txEvents.runTasks).toHaveBeenCalledTimes(1)
  })

  it('skips draining queued tasks for plain transactional handlers', async () => {
    const txEvents = {
      reset: jest.fn(),
      drainAfterCommitTasks: jest.fn().mockReturnValue([jest.fn()]),
      runTasks: jest.fn().mockResolvedValue({ success: 1, failed: 0, errors: [] }),
    }

    const interceptor = new AfterCommitInterceptor(txEvents as never, new Reflector())

    await lastValueFrom(interceptor.intercept(createContext(TestController.prototype.transactionalHandler), createNext()))

    expect(txEvents.reset).toHaveBeenCalledTimes(1)
    expect(txEvents.drainAfterCommitTasks).not.toHaveBeenCalled()
    expect(txEvents.runTasks).not.toHaveBeenCalled()
  })
})

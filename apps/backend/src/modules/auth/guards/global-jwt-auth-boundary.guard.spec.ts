import type { ExecutionContext } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, UnauthorizedException } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import { DomainException } from '@/common/exceptions/domain.exception'
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/access-control.decorator'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { GlobalJwtAuthBoundaryGuard } from './global-jwt-auth-boundary.guard'
import { JwtAuthGuard } from './jwt-auth.guard'
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard'

describe('GlobalJwtAuthBoundaryGuard', () => {
  it('allows non-HTTP contexts without running JWT auth', async () => {
    const guard = createGuard({})
    const context = createContext('ws')

    await expect(guard.canActivate(context)).resolves.toBe(true)
  })

  it('allows public HTTP routes without JWT', async () => {
    const guard = createGuard({ [IS_PUBLIC_KEY]: true })
    const context = createContext('http')

    await expect(guard.canActivate(context)).resolves.toBe(true)
  })

  it('returns AUTH_UNAUTHORIZED for unmarked HTTP routes without a valid JWT', () => {
    const guard = createGuard({})
    const context = createContext('http')

    expect(() => guard.handleRequest(null, null, undefined, context)).toThrow(DomainException)

    try {
      guard.handleRequest(null, null, undefined, context)
    }
    catch (error) {
      expect(error).toBeInstanceOf(DomainException)
      expect((error as DomainException).code).toBe(ErrorCode.AUTH_UNAUTHORIZED)
      expect((error as DomainException).getStatus()).toBe(HttpStatus.UNAUTHORIZED)
    }
  })

  it('keeps optional auth routes anonymous when JWT is missing', () => {
    const guard = createGuard({ [IS_OPTIONAL_AUTH_KEY]: true })
    const context = createContext('http')

    expect(guard.handleRequest(null, null, undefined, context)).toBeNull()
  })

  it('keeps direct OptionalJwtAuthGuard routes anonymous when JWT is missing', () => {
    const guard = createGuard({ [GUARDS_METADATA]: [OptionalJwtAuthGuard] })
    const context = createContext('http')

    expect(guard.handleRequest(null, null, undefined, context)).toBeNull()
  })

  it('does not let controller-level OptionalJwtAuthGuard weaken method-level JwtAuthGuard', () => {
    const guard = createGuard({
      [GUARDS_METADATA]: [OptionalJwtAuthGuard],
      [`handler:${GUARDS_METADATA}`]: [JwtAuthGuard],
    })
    const context = createContext('http')

    expect(() => guard.handleRequest(null, null, undefined, context)).toThrow(DomainException)
  })

  it('keeps controller-level OptionalJwtAuthGuard when a method has unrelated guards', () => {
    class TestRateLimitGuard {}
    const guard = createGuard({
      [GUARDS_METADATA]: [OptionalJwtAuthGuard],
      [`handler:${GUARDS_METADATA}`]: [TestRateLimitGuard],
    })
    const context = createContext('http')

    expect(guard.handleRequest(null, null, undefined, context)).toBeNull()
  })

  it('keeps optional auth routes anonymous when JWT is invalid', () => {
    const guard = createGuard({ [IS_OPTIONAL_AUTH_KEY]: true })
    const context = createContext('http')
    const info = new Error('invalid token')
    info.name = 'JsonWebTokenError'

    expect(guard.handleRequest(null, false, info, context)).toBeNull()
  })

  it('injects authenticated users on optional auth routes when JWT is valid', () => {
    const guard = createGuard({ [IS_OPTIONAL_AUTH_KEY]: true })
    const context = createContext('http')
    const user = { id: 'user-1' }

    expect(guard.handleRequest(null, user, undefined, context)).toBe(user)
  })

  it('does not swallow non-authentication errors on optional auth routes', () => {
    const guard = createGuard({ [IS_OPTIONAL_AUTH_KEY]: true })
    const context = createContext('http')
    const error = new Error('jwt backend unavailable')

    expect(() => guard.handleRequest(error, null, undefined, context)).toThrow(error)
  })

  it('treats UnauthorizedException as visitor on optional auth routes', () => {
    const guard = createGuard({ [IS_OPTIONAL_AUTH_KEY]: true })
    const context = createContext('http')

    expect(guard.handleRequest(new UnauthorizedException(), null, undefined, context)).toBeNull()
  })
})

function createGuard(metadata: Record<string, unknown>): GlobalJwtAuthBoundaryGuard {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => metadata[key]),
    get: jest.fn((key: string, target: unknown) => {
      return target instanceof Function && target.name === 'handler' ? metadata[`handler:${key}`] : metadata[key]
    }),
  } as unknown as Reflector

  return new GlobalJwtAuthBoundaryGuard(reflector)
}

function createContext(type: 'http' | 'ws'): ExecutionContext {
  class TestController {}
  function handler() {}

  return {
    getType: () => type,
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext
}

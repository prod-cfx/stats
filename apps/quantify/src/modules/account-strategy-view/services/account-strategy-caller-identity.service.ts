import { createHmac, timingSafeEqual } from 'node:crypto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires value import with emitDecoratorMetadata
import { EnvService } from '@/common/services/env.service'

@Injectable()
export class AccountStrategyCallerIdentityService {
  constructor(private readonly env: EnvService) {}

  resolveCallerUserIdFromAuthorization(authorization: string | undefined): string {
    const normalizedAuth = authorization?.trim()
    if (!normalizedAuth) {
      throw new DomainException('account_strategy.missing_authorization_header', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const [scheme, token] = normalizedAuth.split(/\s+/, 2)
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new DomainException('account_strategy.invalid_authorization_header', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const jwtSecret = this.env.getString('JWT_SECRET')?.trim()
    if (!jwtSecret) {
      throw new DomainException('account_strategy.jwt_secret_not_configured', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const payload = this.verifyHs256Jwt(token, jwtSecret)
    const subject = this.readJwtUserId(payload)
    if (!subject) {
      throw new DomainException('account_strategy.jwt_subject_missing', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    return subject
  }

  private verifyHs256Jwt(token: string, secret: string): Record<string, unknown> {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new DomainException('account_strategy.invalid_jwt_format', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const [encodedHeader, encodedPayload, signature] = parts
    const header = this.decodeJwtPart(encodedHeader)
    if (header.alg !== 'HS256') {
      throw new DomainException('account_strategy.invalid_jwt_header', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`
    const expectedSignature = createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url')
    if (!this.safeEqual(signature, expectedSignature)) {
      throw new DomainException('account_strategy.invalid_jwt_signature', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const payload = this.decodeJwtPart(encodedPayload)
    const exp = payload.exp
    if (typeof exp === 'number' && Number.isFinite(exp)) {
      const now = Math.floor(Date.now() / 1000)
      if (exp <= now) {
        throw new DomainException('account_strategy.jwt_expired', {
          code: ErrorCode.UNAUTHORIZED,
          status: HttpStatus.UNAUTHORIZED,
        })
      }
    }

    return payload
  }

  private decodeJwtPart(part: string): Record<string, unknown> {
    try {
      const decoded = Buffer.from(part, 'base64url').toString('utf8')
      const parsed = JSON.parse(decoded) as unknown
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('invalid_jwt_part')
      }
      return parsed as Record<string, unknown>
    }
    catch {
      throw new DomainException('account_strategy.invalid_jwt_payload', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
  }

  private readJwtUserId(payload: Record<string, unknown>): string | null {
    const candidates = [payload.sub, payload.userId, payload.id]
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const normalized = candidate.trim()
        if (normalized) {
          return normalized
        }
      }
    }
    return null
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    if (left.length !== right.length) {
      return false
    }
    return timingSafeEqual(left, right)
  }
}

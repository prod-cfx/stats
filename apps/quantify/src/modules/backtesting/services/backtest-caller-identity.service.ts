import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { EnvService } from '@/common/services/env.service'

@Injectable()
export class BacktestCallerIdentityService {
  constructor(private readonly env: EnvService) {}

  async resolveCallerUserIdFromAuthorization(authorization: string | undefined): Promise<string> {
    const normalizedAuth = authorization?.trim()
    if (!normalizedAuth) {
      throw new DomainException('backtest.missing_authorization_header', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const [scheme, token] = normalizedAuth.split(/\s+/, 2)
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new DomainException('backtest.invalid_authorization_header', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const payload = this.decodeJwtPayload(token)
    const principalType = payload.principalType
    if (principalType !== 'user') {
      throw new DomainException('backtest.invalid_jwt_principal_type', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const callerUserId = await this.verifyTokenByBackendAuth(token)
    if (!callerUserId) {
      throw new DomainException('backtest.jwt_subject_missing', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    return callerUserId
  }

  private decodeJwtPart(part: string, errorCode: string): Record<string, unknown> {
    try {
      const decoded = Buffer.from(part, 'base64url').toString('utf8')
      const parsed = JSON.parse(decoded) as unknown
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('invalid_jwt_part')
      }
      return parsed as Record<string, unknown>
    } catch {
      throw new DomainException(errorCode, {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
  }

  private decodeJwtPayload(token: string): Record<string, unknown> {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new DomainException('backtest.invalid_jwt_format', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    return this.decodeJwtPart(parts[1], 'backtest.invalid_jwt_payload')
  }

  private resolveBackendApiBaseUrl(): string {
    const configured = this.env.getString('BACKEND_API_BASE_URL')?.trim()
    if (configured) {
      return configured.replace(/\/$/, '')
    }
    return 'http://127.0.0.1:3000/api/v1'
  }

  private extractUserId(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null
    }

    const record = payload as Record<string, unknown>
    const nestedData = record.data
    if (nestedData && typeof nestedData === 'object') {
      const id = (nestedData as Record<string, unknown>).id
      if (typeof id === 'string' && id.trim()) {
        return id.trim()
      }
    }

    const directId = record.id
    if (typeof directId === 'string' && directId.trim()) {
      return directId.trim()
    }
    return null
  }

  private async verifyTokenByBackendAuth(token: string): Promise<string> {
    const profileUrl = `${this.resolveBackendApiBaseUrl()}/users/me`
    let response: Response
    try {
      response = await fetch(profileUrl, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      throw new DomainException('backtest.auth_verification_unreachable', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    if (!response.ok) {
      throw new DomainException('backtest.auth_verification_failed', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new DomainException('backtest.auth_verification_invalid_response', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const userId = this.extractUserId(body)
    if (!userId) {
      throw new DomainException('backtest.auth_verification_missing_user', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    return userId
  }
}

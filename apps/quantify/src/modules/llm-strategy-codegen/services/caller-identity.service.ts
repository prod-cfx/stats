import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { EnvService } from '@/common/services/env.service'

@Injectable()
export class CallerIdentityService {
  constructor(private readonly env: EnvService) {}

  async resolveCallerUserIdFromAuthorization(
    authorization: string | undefined,
    forwardedUserId?: string | undefined,
  ): Promise<string> {
    const normalizedAuth = authorization?.trim()
    if (!normalizedAuth) {
      throw new DomainException('codegen.missing_authorization_header', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const [scheme, token] = normalizedAuth.split(/\s+/, 2)
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new DomainException('codegen.invalid_authorization_header', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const payload = this.decodeJwtPayload(token)
    const principalType = payload.principalType
    if (principalType !== 'user') {
      throw new DomainException('codegen.invalid_jwt_principal_type', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const verifiedUserId = await this.verifyTokenByBackendAuth(token, payload)
    const normalizedForwardedUserId = forwardedUserId?.trim()
    if (normalizedForwardedUserId) {
      if (verifiedUserId !== normalizedForwardedUserId) {
        throw new DomainException('codegen.caller_user_id_mismatch', {
          code: ErrorCode.UNAUTHORIZED,
          status: HttpStatus.UNAUTHORIZED,
          args: {
            authUserId: verifiedUserId,
            inputUserId: normalizedForwardedUserId,
          },
        })
      }
      return normalizedForwardedUserId
    }

    if (!verifiedUserId) {
      throw new DomainException('codegen.jwt_subject_missing', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    return verifiedUserId
  }

  private decodeJwtPart(part: string, errorCode: string): Record<string, unknown> {
    try {
      const decoded = Buffer.from(part, 'base64url').toString('utf8')
      const parsed = JSON.parse(decoded) as unknown
      if (!parsed || typeof parsed !== 'object') {
        throw new DomainException(errorCode, {
          code: ErrorCode.UNAUTHORIZED,
          status: HttpStatus.UNAUTHORIZED,
        })
      }
      return parsed as Record<string, unknown>
    }
    catch (error) {
      if (error instanceof DomainException) {
        throw error
      }
      throw new DomainException(errorCode, {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
  }

  private decodeJwtPayload(token: string): Record<string, unknown> {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new DomainException('codegen.invalid_jwt_format', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    return this.decodeJwtPart(parts[1], 'codegen.invalid_jwt_payload')
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

  private extractUserIdFromJwtPayload(payload: Record<string, unknown>): string | null {
    const sub = payload.sub
    if (typeof sub === 'string' && sub.trim()) {
      return sub.trim()
    }
    const userId = payload.userId
    if (typeof userId === 'string' && userId.trim()) {
      return userId.trim()
    }
    const id = payload.id
    if (typeof id === 'string' && id.trim()) {
      return id.trim()
    }
    return null
  }

  private isJwtPayloadNotExpired(payload: Record<string, unknown>): boolean {
    const exp = payload.exp
    if (typeof exp !== 'number' || !Number.isFinite(exp)) {
      return false
    }
    return exp * 1000 > Date.now()
  }

  private shouldAllowUnverifiedJwtFallback(payload: Record<string, unknown>): boolean {
    if (!this.env.isDev()) return false
    const enabled = this.env.getBoolean('CODEGEN_ALLOW_UNVERIFIED_JWT_FALLBACK', false) === true
    if (!enabled) return false
    const fallbackUserId = this.extractUserIdFromJwtPayload(payload)
    if (!fallbackUserId) return false
    return this.isJwtPayloadNotExpired(payload)
  }

  private async verifyTokenByBackendAuth(token: string, payload: Record<string, unknown>): Promise<string> {
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
    }
    catch {
      if (this.shouldAllowUnverifiedJwtFallback(payload)) {
        const fallbackUserId = this.extractUserIdFromJwtPayload(payload)
        if (fallbackUserId) {
          return fallbackUserId
        }
      }
      throw new DomainException('codegen.auth_verification_unreachable', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    if (!response.ok) {
      throw new DomainException('codegen.auth_verification_failed', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    let body: unknown
    try {
      body = await response.json()
    }
    catch {
      throw new DomainException('codegen.auth_verification_invalid_response', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const userId = this.extractUserId(body)
    if (!userId) {
      throw new DomainException('codegen.auth_verification_missing_user', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    return userId
  }
}

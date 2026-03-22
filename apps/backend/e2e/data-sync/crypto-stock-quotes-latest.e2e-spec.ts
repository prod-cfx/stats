import type { ExecutionContext, INestApplication } from '@nestjs/common'
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'

import { OptionalJwtAuthGuard } from '@/modules/auth/guards/optional-jwt-auth.guard'
import { AppRole, RBAC_PERMISSIONS } from '@/modules/auth/rbac/permissions'
import { PermissionService } from '@/modules/auth/services/permission.service'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

describe('Crypto stock quotes HTTP - /crypto-stock-quotes/latest (E2E)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const ctx = await createTestingApp({
      onBeforeInit: builder => builder
        // 覆盖 OptionalJwtAuthGuard，在请求上下文中注入一个普通 user 角色，
        // 并通过自定义 PermissionService 以 USER 角色执行 RBAC 检查，
        // 确保该接口对真实登录用户具备 readAny(MARKET_SYMBOL) 权限。
        .overrideGuard(OptionalJwtAuthGuard)
        .useValue({
          canActivate: (context: ExecutionContext) => {
            const req = context.switchToHttp().getRequest()
            const user: AuthenticatedUser = {
              id: 'e2e-user-id',
              email: 'e2e-user@example.com',
              roles: [],
              principalType: 'user',
            }
            req.user = user
            return true
          },
        })
        .overrideProvider(PermissionService)
        .useValue({
          hasAccess: async (rules: any[]): Promise<boolean> => {
            for (const rule of rules) {
              const permission = RBAC_PERMISSIONS.permission({
                role: AppRole.USER,
                action: rule.action,
                resource: rule.resource,
                possession: rule.possession ?? 'any',
              })
              if (permission.granted) {
                return true
              }
            }
            return false
          },
        }),
    })
    app = ctx.app
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should allow user role to fetch latest crypto stock quotes', async () => {
    const api = createApiClient(app)

    const res = await api.get('crypto-stock-quotes/latest')
      .set('Authorization', 'Bearer e2e-test-token')
      .expect(200)

    expect(res.body).toBeTruthy()
    expect(Array.isArray(res.body.data) || res.body.data === null || res.body.data === undefined).toBe(true)
  })
})

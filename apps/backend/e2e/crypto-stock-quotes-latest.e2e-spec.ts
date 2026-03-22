/* eslint-disable perfectionist/sort-imports -- 保持与其他 e2e 测试一致的导入分组，优先可读性 */
import type { ExecutionContext, INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { AuthenticatedUser } from '../src/common/types/authenticated-user.type'

import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import { ensureE2eEnv } from './helpers/setup-e2e-env'
import { AppModule } from '../src/modules/app.module'
import { OptionalJwtAuthGuard } from '../src/modules/auth/guards/optional-jwt-auth.guard'
import { PermissionService } from '../src/modules/auth/services/permission.service'
import { AppRole, RBAC_PERMISSIONS } from '../src/modules/auth/rbac/permissions'
import request from 'supertest'

describe('Crypto stock quotes HTTP - /crypto-stock-quotes/latest (E2E)', () => {
  let app: INestApplication

  const originalCwd = process.cwd()

  beforeAll(async () => {
    ensureE2eEnv()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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
      })
      .compile()

    app = moduleFixture.createNestApplication()

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: {
          enableImplicitConversion: true,
        },
        exceptionFactory: errors => {
          const errorMessages = errors.map(err => ({
            property: err.property,
            constraints: err.constraints,
            value: err.value,
          }))
          return new BadRequestException(errorMessages)
        },
      }),
    )

    app.setGlobalPrefix('api/v1')

    await app.init()
  })

  afterAll(async () => {
    process.chdir(originalCwd)
    if (app) {
      await app.close()
    }
  })

  it('should allow user role to fetch latest crypto stock quotes', async () => {
    const server = app.getHttpServer()

    const res = await request(server)
      .get('/api/v1/crypto-stock-quotes/latest')
      .set('Authorization', 'Bearer e2e-test-token')
      .expect(200)

    expect(res.body).toBeTruthy()
    expect(Array.isArray(res.body.data) || res.body.data === null || res.body.data === undefined).toBe(true)
  })
})


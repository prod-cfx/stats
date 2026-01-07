/* eslint-disable perfectionist/sort-imports -- 保持与其他 e2e 测试一致的导入分组，优先可读性 */
import type { ExecutionContext, INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'

import { resolve } from 'node:path'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import type { AuthenticatedUser } from '../src/common/types/authenticated-user.type'
import { AppModule } from '../src/modules/app.module'
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard'
import request from 'supertest'

describe('Crypto stock quotes HTTP - /crypto-stock-quotes/latest (E2E)', () => {
  let app: INestApplication

  const originalCwd = process.cwd()

  beforeAll(async () => {
    // 与 main.ts 保持一致，从 monorepo 根目录加载环境
    if (!process.env.APP_ENV) {
      process.env.APP_ENV = 'e2e'
    }

    process.chdir(resolve(__dirname, '../../..'))

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // 覆盖 JwtAuthGuard，在请求上下文中注入一个普通 user 角色，
      // 让 ACGuard 通过 PermissionService/RoleAssignment 走真实的 RBAC 检查逻辑。
      .overrideGuard(JwtAuthGuard)
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


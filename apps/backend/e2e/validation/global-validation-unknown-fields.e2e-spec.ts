import type { INestApplication } from '@nestjs/common'
import { Body, Controller, Module, Post } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter'
import { EnvModule } from '@/common/modules/env.module'
import { IsString } from 'class-validator'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

class GlobalValidationProbeDto {
  @IsString()
  name!: string
}

@Controller('validation-probe')
class GlobalValidationProbeController {
  @Post()
  create(@Body() dto: GlobalValidationProbeDto) {
    return dto
  }
}

@Module({
  imports: [EnvModule],
  controllers: [GlobalValidationProbeController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
class GlobalValidationProbeModule {}

describe('Global ValidationPipe unknown fields (E2E)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const ctx = await createTestingApp({ imports: [GlobalValidationProbeModule] })
    app = ctx.app
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('rejects DTO body fields that are not declared', async () => {
    const client = createApiClient(app)

    const response = await client
      .post('/validation-probe')
      .send({ name: 'valid-name', unexpectedField: 'silent-drop-risk' })
      .expect(400)

    expect(response.body).toMatchObject({
      status: 400,
      error: expect.objectContaining({
        code: expect.any(String),
        args: expect.objectContaining({
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              property: 'unexpectedField',
              constraints: expect.objectContaining({
                whitelistValidation: 'property unexpectedField should not exist',
              }),
            }),
          ]),
        }),
      }),
    })
    expect(JSON.stringify(response.body)).toContain('unexpectedField')
    expect(JSON.stringify(response.body)).toContain('property unexpectedField should not exist')
  })

  it('keeps accepting declared DTO body fields', async () => {
    const client = createApiClient(app)

    await client
      .post('/validation-probe')
      .send({ name: 'valid-name' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({ name: 'valid-name' })
      })
  })
})

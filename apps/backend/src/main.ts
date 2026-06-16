import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'
import { loadEnvironment } from '@net/config'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { buildValidatedCorsOrigins } from './common/utils/cors-origins'
import { AppModule } from './modules/app.module'
import { buildSwaggerDocument } from './swagger/build-swagger-document'
import 'reflect-metadata'

async function bootstrap() {
  const findWorkspaceRoot = (startDir: string) => {
    let current = startDir
    while (true) {
      if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
        return current
      }
      const parent = dirname(current)
      if (parent === current) {
        return startDir
      }
      current = parent
    }
  }

  process.chdir(findWorkspaceRoot(__dirname))
  const env = loadEnvironment()
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })
  app.enableShutdownHooks()
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER)
  app.useLogger(logger)

  // 配置全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const errorMessages = errors.map(err => ({
          property: err.property,
          constraints: err.constraints,
          value: err.value,
        }))
        return new BadRequestException(errorMessages)
      },
    }),
  )

  // 设置全局路由前缀
  app.setGlobalPrefix('api/v1')

  const corsOrigins = buildValidatedCorsOrigins(
    env.FRONTEND_REDIRECT_ORIGINS,
    env.ALLOWED_ORIGINS,
    env.APP_ENV,
    env.APP_ENV === 'development' ? ['http://localhost:3001'] : ['https://www.coinflux.ai', 'https://admin.coinflux.ai'],
  )

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  })

  if (env.APP_ENV !== 'production') {
    const document = buildSwaggerDocument(app)
    SwaggerModule.setup('docs', app, document, {
      useGlobalPrefix: true,
      jsonDocumentUrl: 'docs-json',
    })
  }
  await app.listen(env.PORT ?? 3000)

  logger.log(`Backend ready on http://localhost:${env.PORT ?? 3000}/api/v1`)
}

bootstrap()

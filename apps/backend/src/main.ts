import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { loadEnvironment } from '@net/config'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { buildCorsOrigins } from './common/utils/cors-origins'
import { AppModule } from './modules/app.module'
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
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER)
  app.useLogger(logger)

  // 配置全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
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

  const corsOrigins = buildCorsOrigins(env.FRONTEND_REDIRECT_ORIGINS, env.ALLOWED_ORIGINS)

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  })

  if (env.APP_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AI Backend API')
      .setDescription('Internal API documentation')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('docs', app, document, {
      useGlobalPrefix: true,
      jsonDocumentUrl: 'docs-json',
    })
  }
  await app.listen(env.PORT ?? 3000)

  logger.log(`Backend ready on http://localhost:${env.PORT ?? 3000}/api/v1`)
}

bootstrap()

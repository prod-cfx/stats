import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { loadEnvironment } from '@net/config'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { applyQuantifyEnvOverrides } from './config/quantify-env'
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
  loadEnvironment()
  applyQuantifyEnvOverrides()
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

  if (process.env.APP_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Quantify API')
      .setDescription('Internal API documentation')
      .setVersion('1.0')
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('docs', app, document, {
      useGlobalPrefix: true,
      jsonDocumentUrl: 'docs-json',
    })
  }
  const port = Number(process.env.PORT || 3010)
  await app.listen(port)

  logger.log(`Quantify ready on http://localhost:${port}/api/v1`)
}

bootstrap()

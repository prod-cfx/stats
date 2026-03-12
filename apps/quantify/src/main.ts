import { resolve } from 'node:path'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { loadEnvironment } from '@net/config'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { AppModule } from './modules/app.module'
import 'reflect-metadata'

async function bootstrap() {
  // 浠?monorepo 鏍圭洰褰曞姞杞界幆澧冨彉閲?
  // pnpm filter 浼氬垏鎹㈠埌搴旂敤鐩綍,鎵€浠ラ渶瑕佸悜涓婁袱绾ф壘鍒版牴鐩綍
  process.chdir(resolve(__dirname, '../../..'))
  const env = loadEnvironment()
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER)
  app.useLogger(logger)

  // 閰嶇疆鍏ㄥ眬楠岃瘉绠￠亾
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

  // 璁剧疆鍏ㄥ眬璺敱鍓嶇紑
  app.setGlobalPrefix('api/v1')

  if (env.APP_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AI Backend API')
      .setDescription('Internal API documentation')
      .setVersion('1.0')
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

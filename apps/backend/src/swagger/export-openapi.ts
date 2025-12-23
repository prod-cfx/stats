import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from '../modules/app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] })

  const config = new DocumentBuilder()
    .setTitle('AI Backend API')
    .setDescription('Auto generated OpenAPI for contracts')
    .setVersion('1.0')
    .build()

  const document = SwaggerModule.createDocument(app, config)

  const outputDir = join(process.cwd(), 'dist', 'openapi')
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }
  const outputPath = join(outputDir, 'backend.json')
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8')
  await app.close()
  console.log(`OpenAPI schema exported to ${outputPath}`)
}

bootstrap().catch(err => {
  console.error('Swagger export failed:', err?.message || err)
  if (err?.stack) console.error(err.stack)
  process.exit(1)
})

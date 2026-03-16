import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from '../modules/app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] })

  const config = new DocumentBuilder()
    .setTitle('Quantify API')
    .setDescription('Auto generated OpenAPI for quantify contracts')
    .setVersion('1.0')
    .build()

  const document = SwaggerModule.createDocument(app, config)

  const outputDirs = [
    join(process.cwd(), 'dist', 'openapi'),
    join(process.cwd(), '..', '..', 'dist', 'openapi'),
  ]
  const documentJson = JSON.stringify(document, null, 2)

  for (const outputDir of outputDirs) {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }
    const outputPath = join(outputDir, 'quantify.json')
    writeFileSync(outputPath, documentJson, 'utf8')
    console.log(`OpenAPI schema exported to ${outputPath}`)
  }

  await app.close()
}

bootstrap().catch(err => {
  console.error('Swagger export failed:', err?.message || err)
  if (err?.stack) console.error(err.stack)
  process.exit(1)
})

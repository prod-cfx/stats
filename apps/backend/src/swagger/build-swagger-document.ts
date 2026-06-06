import type { INestApplication } from '@nestjs/common'
import type { OpenAPIObject } from '@nestjs/swagger'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { BaseResponseDto } from '../common/dto/base.dto'
import { CryptoStockQuoteResponseDto } from '../modules/crypto-stock-quotes/dto/crypto-stock-quote.dto'

// 显式注册的额外模型，确保 components.schemas 生成完整契约。
// 单一真源：main.ts 运行时 UI 与 export-openapi.ts 契约导出共用。
const EXTRA_MODELS = [BaseResponseDto, CryptoStockQuoteResponseDto]

export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('AI Backend API')
    .setDescription('Internal API documentation')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build()

  return SwaggerModule.createDocument(app, config, {
    extraModels: EXTRA_MODELS,
  })
}

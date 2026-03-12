import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { getSchemaPath } from '@nestjs/swagger'

/**
 * 鏋勫缓 BaseResponseDto<T> 鐨勯€氱敤 Swagger Schema
 * 绾﹀畾缁撴瀯锛?
 * {
 *   data: T
 *   message?: string
 * }
 */
export function buildBaseResponseSchema(dto: unknown): SchemaObject {
  return {
    type: 'object',
    required: ['data'],
    properties: {
      data: { $ref: getSchemaPath(dto as any) },
      message: {
        type: 'string',
        example: 'Success',
      },
    },
  }
}

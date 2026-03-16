import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { getSchemaPath } from '@nestjs/swagger'

/**
 * 构建 BaseResponseDto<T> 的通用 Swagger Schema
 * 约定结构：
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

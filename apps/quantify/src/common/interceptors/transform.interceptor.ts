import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { Observable } from 'rxjs'
import { Injectable } from '@nestjs/common'
import { map } from 'rxjs/operators'
import { BaseResponseDto } from '../dto/base.dto'
import { BasePaginationResponseDto } from '../dto/base.pagination.response.dto'

interface PaginationShape<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

const isPaginationShape = <T>(data: unknown): data is PaginationShape<T> => {
  if (!data || typeof data !== 'object') return false
  const candidate = data as Record<string, unknown>
  return (
    Array.isArray(candidate.items) &&
    typeof candidate.total === 'number' &&
    typeof candidate.page === 'number' &&
    typeof candidate.limit === 'number'
  )
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, BaseResponseDto<T> | BasePaginationResponseDto<T> | undefined>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<BaseResponseDto<T> | BasePaginationResponseDto<T> | undefined> {
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const httpContext = context.switchToHttp()
    const response = httpContext.getResponse()

    return next.handle().pipe(
      map(data => {
        if (!response || typeof response.statusCode !== 'number') return data as any

        if (response.statusCode === 204) {
          return undefined
        }

        // 鍏佽 controller 鏄惧紡杩斿洖宸叉牸寮忓寲鐨勫搷搴旓紙渚嬪鏌愪簺鐗规畩鎺ュ彛闇€瑕佽嚜瀹氫箟鍝嶅簲缁撴瀯锛?
        if (data instanceof BaseResponseDto || data instanceof BasePaginationResponseDto) {
          return data
        }

        if (isPaginationShape<T>(data)) {
          return new BasePaginationResponseDto<T>(data.total, data.page, data.limit, data.items)
        }

        return new BaseResponseDto<T>(data ?? null, 'Success')
      }),
    )
  }
}

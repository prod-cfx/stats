import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

/**
 * 订阅详情查询参数 DTO
 * 继承标准分页 DTO，使用 page/limit 字段
 */
export class SubscriptionDetailsQueryDto extends BasePaginationRequestDto {
  // 继承 page 和 limit 字段，无需额外字段
}

/**
 * 分页相关常量
 * 统一管理前后端分页限制，确保类型安全和一致性
 */
export const PAGINATION_LIMITS = {
  /** 默认每页数量 */
  DEFAULT_PAGE_SIZE: 20,

  /** 通用分页最大值（性能考虑） */
  MAX_PAGE_SIZE: 200,

  /**
   * 管理员角色搜索最大值
   * 限制为 100 是因为查询包含大量关联数据（创建者、标签、统计信息等）
   * 性能考虑：避免单次查询返回过多复杂对象
   */
  MAX_ADMIN_CHARACTER_SEARCH: 100,
} as const

/**
 * 分页限制类型
 */
export type PaginationLimits = typeof PAGINATION_LIMITS

/**
 * 分页限制值类型
 */
export type PaginationLimitValue = (typeof PAGINATION_LIMITS)[keyof typeof PAGINATION_LIMITS]

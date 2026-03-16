/**
 * Deposit Completed Event DTO
 * 充值完成事件 - 用于触发邀请佣金计算
 */
export interface DepositCompletedEventDto {
  /** 用户 ID */
  userId: string

  /** 钱包 ID */
  walletId: string

  /** 充值金额 */
  amount: string

  /** 货币类型 */
  currency: string

  /** 资产类型 ID */
  assetTypeId: string

  /** 支付订单 ID (用于幂等性) */
  orderId: string

  /** 事件时间戳 */
  timestamp: string
}

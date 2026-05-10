import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * Phase 5 S3 (#1109): scope.timeframe substrate live publication-time gate
 *
 * 当 published snapshot 的 ast.orchestrationScopes 含 scopeKind='timeframe' 元素 +
 * 部署 mode='LIVE' 时，由 account-strategy-view.service.ts deployStrategy() 抛出，
 * 阻止用户在 publication gate 把 scope.timeframe 策略部署到 live。
 *
 * 理由：本 PR 范畴内 backtest 路径完整接通 multi-tf 数据；live 路径 buildPublishedStrategyContext
 * 不携带多 tf 数据通道。完整 live 接入跟进 follow-up issue #1110。
 *
 * backtest 路径不调用此 gate，未受影响。
 */
export class ScopeTimeframeLiveUnsupportedException extends DomainException {
  constructor(args?: { snapshotId?: string }) {
    super('account_strategy.scope_timeframe_live_unsupported', {
      code: ErrorCode.ORCHESTRATION_SCOPE_TIMEFRAME_LIVE_UNSUPPORTED,
      status: HttpStatus.BAD_REQUEST,
      args: args ?? {},
    })
  }
}

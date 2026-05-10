import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { ScopeTimeframeLiveUnsupportedException } from './scope-timeframe-live-unsupported.exception'

describe('ScopeTimeframeLiveUnsupportedException (Phase 5 S3 #1109)', () => {
  it('should have correct error code', () => {
    const exception = new ScopeTimeframeLiveUnsupportedException({ snapshotId: 'snap-1' })
    expect(exception.code).toBe(ErrorCode.ORCHESTRATION_SCOPE_TIMEFRAME_LIVE_UNSUPPORTED)
  })

  it('should have BAD_REQUEST status', () => {
    const exception = new ScopeTimeframeLiveUnsupportedException({ snapshotId: 'snap-1' })
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('should carry snapshotId in args', () => {
    const exception = new ScopeTimeframeLiveUnsupportedException({ snapshotId: 'pub-snap-abc' })
    expect(exception.args).toEqual({ snapshotId: 'pub-snap-abc' })
  })

  it('should accept empty args', () => {
    const exception = new ScopeTimeframeLiveUnsupportedException()
    expect(exception.args).toEqual({})
    expect(exception.code).toBe(ErrorCode.ORCHESTRATION_SCOPE_TIMEFRAME_LIVE_UNSUPPORTED)
  })

  it('should use stable message key', () => {
    const exception = new ScopeTimeframeLiveUnsupportedException()
    expect(exception.message).toBe('account_strategy.scope_timeframe_live_unsupported')
  })
})

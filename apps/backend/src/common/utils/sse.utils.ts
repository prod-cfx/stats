import type { MessageEvent } from '@nestjs/common'
import type { Observable } from 'rxjs'
import { interval, map } from 'rxjs'

export function createHeartbeatStream(
  intervalMs = 15000,
  label = 'heartbeat',
): Observable<MessageEvent> {
  return interval(intervalMs).pipe(
    map(() => ({ type: label } as MessageEvent)),
  )
}

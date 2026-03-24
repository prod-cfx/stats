import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { Observable } from 'rxjs'
import { Injectable, Logger } from '@nestjs/common'
import { tap } from 'rxjs/operators'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionEventsService } from '../services/transaction-events.service'

@Injectable()
export class AfterCommitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AfterCommitInterceptor.name)

  constructor(
    private readonly txEvents: TransactionEventsService,
  ) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    this.txEvents.reset()

    return next.handle().pipe(
      tap(() => {
        const tasks = this.txEvents.drainAfterCommitTasks()
        if (tasks.length > 0) {
          this.txEvents.runTasks(tasks).catch(err => {
            this.logger.error('afterCommit drain failed', err)
          })
        }
      }),
    )
  }
}

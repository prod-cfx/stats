import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { Observable } from 'rxjs'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 Reflector
import { Reflector } from '@nestjs/core'
import { tap } from 'rxjs/operators'
import { NEEDS_AFTER_COMMIT_METADATA_KEY } from '../decorators/transactional-with-after-commit.decorator'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionEventsService } from '../services/transaction-events.service'

@Injectable()
export class AfterCommitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AfterCommitInterceptor.name)

  constructor(
    private readonly txEvents: TransactionEventsService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    this.txEvents.reset()
    const needsAfterCommit = this.reflector.getAllAndOverride<boolean>(NEEDS_AFTER_COMMIT_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) === true

    return next.handle().pipe(
      tap(() => {
        if (!needsAfterCommit) {
          return
        }
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

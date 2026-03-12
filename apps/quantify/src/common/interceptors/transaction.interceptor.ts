import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { Observable } from 'rxjs'
import type { PrismaService } from '../../prisma/prisma.service'
import type { EnvService } from '../services/env.service'
import type { TransactionEventsService } from '../services/transaction-events.service'
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { from, lastValueFrom } from 'rxjs'
import { map, tap } from 'rxjs/operators'
import { PrismaService as PrismaServiceToken } from '../../prisma/prisma.service'
import { EnvService as EnvServiceToken } from '../services/env.service'
import { TransactionEventsService as TransactionEventsServiceToken } from '../services/transaction-events.service'

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  private readonly skipTransactionMethods = ['streamResponse', 'streamMessage']
  private readonly logger: Pick<Logger, 'debug' | 'error'>

  constructor(
    @Inject(PrismaServiceToken) private readonly prismaService: PrismaService,
    @Optional() @Inject(EnvServiceToken) private readonly env?: EnvService,
    @Optional()
    @Inject(TransactionEventsServiceToken)
    private readonly txEvents?: TransactionEventsService,
  ) {
    const isE2E = this.env?.isE2E?.() ?? false
    this.logger = isE2E
      ? { debug: () => {}, error: () => {} }
      : new Logger(TransactionInterceptor.name)
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler()
    const className = context.getClass().name
    const methodName = handler.name
    const controllerAndMethod = `${className}.${methodName}`

    if (this.skipTransactionMethods.includes(methodName)) {
      this.logger.debug(`Skipping transaction for streaming method: ${controllerAndMethod}`)
      return next.handle()
    }

    this.logger.debug(`Starting transaction for ${controllerAndMethod}`)
    this.txEvents?.reset?.()

    const tx$ = from(
      this.prismaService.runInTransaction(async () => {
        this.logger.debug(`Executing ${controllerAndMethod} in transaction`)
        try {
          const result = await lastValueFrom(next.handle())
          this.logger.debug(`Transaction for ${controllerAndMethod} completed successfully`)
          return result
        } catch (error) {
          this.logger.error(`Transaction for ${controllerAndMethod} failed: ${(error as Error).message}`)
          throw error
        }
      }),
    )

    return tx$.pipe(
      tap(() => {
        const tasks = this.txEvents?.drainAfterCommitTasks?.() || []
        if (!tasks.length) return

        Promise.resolve()
          .then(async () => {
            const started = Date.now()
            try {
              const result = await this.txEvents?.runTasks?.(tasks)
              const elapsed = Date.now() - started
              const executed = result?.success ?? 0
              const failed = result?.failed ?? 0
              this.logger.debug?.(
                `afterCommit executed tasks=${executed} failed=${failed} elapsedMs=${elapsed}`,
              )
            } catch (error) {
              this.logger.error?.(`afterCommit failed: ${(error as Error).message}`)
            }
          })
          .catch(() => {})
      }),
      map(res => res),
    )
  }
}

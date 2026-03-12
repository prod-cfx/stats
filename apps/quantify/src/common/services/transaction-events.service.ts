import type { ClsService } from 'nestjs-cls'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ClsService as ClsServiceToken } from 'nestjs-cls'

const AFTER_COMMIT_TASKS_KEY = 'AFTER_COMMIT_TASKS'

type Task = () => void | Promise<void>

@Injectable()
export class TransactionEventsService {
  private readonly logger = new Logger(TransactionEventsService.name)

  constructor(@Inject(ClsServiceToken) private readonly cls: ClsService) {}

  afterCommit(task: Task): void {
    try {
      const inTx = Boolean(this.cls.get('PRISMA_TRANSACTION'))
      if (!inTx) {
        Promise.resolve()
          .then(() => task())
          .catch(error => {
            const meta = { err: (error as Error)?.message, stack: (error as Error)?.stack }
            this.logger.warn(`afterCommit fallback task failed: ${meta.err}\n${meta.stack ?? ''}`)
          })
        return
      }

      const list = (this.cls.get(AFTER_COMMIT_TASKS_KEY) as Task[] | undefined) || []
      list.push(task)
      this.cls.set(AFTER_COMMIT_TASKS_KEY, list)
    } catch (error) {
      // 褰?CLS 涓婁笅鏂囦笉瀛樺湪鏃讹紝鐩存帴浠ラ潪浜嬪姟鏂瑰紡鎵ц浠诲姟锛岄伩鍏嶆姏鍑哄紓甯稿鑷磋姹傚け璐?
      this.logger.warn(
        `afterCommit called without CLS context, executing task immediately: ${(error as Error)?.message}`,
      )
      Promise.resolve()
        .then(() => task())
        .catch(err => {
          const meta = { err: (err as Error)?.message, stack: (err as Error)?.stack }
          this.logger.warn(`afterCommit fallback task failed: ${meta.err}\n${meta.stack ?? ''}`)
        })
    }
  }

  drainAfterCommitTasks(): Task[] {
    try {
      const list = ((this.cls.get(AFTER_COMMIT_TASKS_KEY) as Task[] | undefined) || []).slice()
      this.cls.set(AFTER_COMMIT_TASKS_KEY, [])
      return list
    } catch {
      // 鏃?CLS 涓婁笅鏂囨椂鐩存帴杩斿洖绌轰换鍔″垪琛?
      return []
    }
  }

  async runTasks(tasks: Task[]): Promise<{ success: number; failed: number; errors: Error[] }> {
    let success = 0
    const errors: Error[] = []
    for (const task of tasks) {
      try {
        await task()
        success++
      } catch (error) {
        const err = error as Error
        errors.push(err)
        this.logger.error(`afterCommit task failed: ${err.message}`, err.stack)
      }
    }
    return { success, failed: errors.length, errors }
  }

  reset(): void {
    try {
      this.cls.set(AFTER_COMMIT_TASKS_KEY, [])
    } catch {
      // 鏃?CLS 涓婁笅鏂囨椂璺宠繃閲嶇疆
    }
  }
}

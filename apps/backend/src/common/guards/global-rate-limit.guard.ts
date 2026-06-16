import { ExecutionContext, Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class GlobalRateLimitGuard extends ThrottlerGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true
    }

    return super.canActivate(context)
  }

  override async onModuleInit(): Promise<void> {
    await super.onModuleInit()
    this.throttlers = this.throttlers.filter(throttler => throttler.name === 'default')
  }
}

import { ErrorCode } from '@ai/shared'
import { BullModule } from '@nestjs/bull'
import { Global, HttpStatus, Module } from '@nestjs/common'
import { EnvService } from '../services/env.service'
import { DomainException } from '../exceptions/domain.exception'

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix -- NestJS API requires the `useFactory` key name.
      useFactory: (env: EnvService) => {
        const url = env.getString('REDIS_URL')
        if (!url) {
          throw new DomainException('redis.missing_url_for_bull', {
            code: ErrorCode.REDIS_CONNECTION_ERROR,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            args: { key: 'REDIS_URL' },
          })
        }

        return { url }
      },
      inject: [EnvService],
    }),
  ],
  exports: [BullModule],
})
export class BullRootModule {}

import type { AccountExchangeAccountResponseDto } from '../dto/account-exchange-account.response.dto'
import type { CreateAccountExchangeAccountDto } from '../dto/create-account-exchange-account.dto'
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
import { Inject, Injectable } from '@nestjs/common'
import {
  createBackendQuantifyApiClient,
  QuantifyClientError,
  runQuantifyContractRequest,
} from '@/common/clients/quantify-contract.shared'
import { EnvService } from '@/common/services/env.service'

@Injectable()
export class QuantifyExchangeAccountsClient {
  private readonly client = createBackendQuantifyApiClient(this.env)

  constructor(@Inject(EnvService) private readonly env: EnvService) {}

  async list(userId: string): Promise<AccountExchangeAccountResponseDto[]> {
    return runQuantifyContractRequest<AccountExchangeAccountResponseDto[]>(() =>
      this.client.ExchangeAccountsController_list({
        queries: { userId },
      }),
    )
  }

  async upsert(
    user: AuthenticatedUser,
    dto: CreateAccountExchangeAccountDto,
  ): Promise<AccountExchangeAccountResponseDto> {
    return runQuantifyContractRequest<AccountExchangeAccountResponseDto>(() =>
      this.client.ExchangeAccountsController_create({
        userId: user.id,
        userEmail: user.email,
        ...dto,
      }),
    )
  }

  async delete(userId: string, exchangeId: string): Promise<void> {
    await runQuantifyContractRequest<void>(() =>
      this.client.ExchangeAccountsController_delete(undefined, {
        params: { exchangeId },
        queries: { userId },
      }),
    )
  }
}

export { QuantifyClientError }

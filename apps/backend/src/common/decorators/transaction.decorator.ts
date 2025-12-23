import { applyDecorators, UseInterceptors } from '@nestjs/common'
import { TransactionInterceptor } from '../interceptors/transaction.interceptor'

export const TRANSACTION_KEY = 'TRANSACTION'

export function Transaction() {
  return applyDecorators(UseInterceptors(TransactionInterceptor))
}


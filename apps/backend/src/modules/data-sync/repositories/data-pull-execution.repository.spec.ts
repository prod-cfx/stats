import { DataPullExecutionRepository } from './data-pull-execution.repository'

function createTxHost() {
  return {
    tx: {
      dataPullExecution: {
        update: jest.fn(),
      },
    },
  }
}

describe('DataPullExecutionRepository', () => {
  it('stores domain exception reason when marking execution failed', async () => {
    const txHost = createTxHost()
    const repo = new DataPullExecutionRepository(txHost as never)
    const error = {
      message: 'polymarket.client_error',
      args: {
        reason: 'Gamma API request failed: status=403 Forbidden url=https://gamma-api.polymarket.com/markets body=blocked',
      },
      stack: 'DomainException: polymarket.client_error\n    at fetchJson',
    }

    await repo.markFailed(196672, new Date('2026-06-04T09:49:00.000Z'), error)

    expect(txHost.tx.dataPullExecution.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        errorMessage: expect.stringContaining('Gamma API request failed: status=403 Forbidden'),
      }),
    }))
  })

  it('redacts BBX signed URL credentials from persisted errors', async () => {
    const txHost = createTxHost()
    const repo = new DataPullExecutionRepository(txHost as never)
    const error = {
      message: 'data_sync.bbx_crypto_stock_quotes.api_error',
      args: {
        reason:
          'BBX API request failed: url=https://open.bbx.com/api/upgrade/v2/crypto_stock/quotes?tickers=i%3Amstr%3Anasdaq&AccessKeyId=bbx-key&SignatureNonce=nonce-1&Timestamp=1780569538&Signature=signed-value status=403 Forbidden body={"error":"没有权限访问此资源"}',
      },
      stack: 'DomainException: data_sync.bbx_crypto_stock_quotes.api_error\n    at fetchQuotesJson',
    }

    await repo.markFailed(361092, new Date('2026-06-04T10:29:14.000Z'), error)

    const call = txHost.tx.dataPullExecution.update.mock.calls[0][0]
    const message = call.data.errorMessage as string
    expect(message).toContain('status=403 Forbidden')
    expect(message).toContain('AccessKeyId=***')
    expect(message).toContain('SignatureNonce=***')
    expect(message).toContain('Signature=***')
    expect(message).not.toContain('bbx-key')
    expect(message).not.toContain('nonce-1')
    expect(message).not.toContain('signed-value')
  })
})

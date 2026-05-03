import { ExecutionStatus } from '@ai/shared'
import { SignalExecutionRepository } from './signal-execution.repository'

describe('SignalExecutionRepository', () => {
  it('keeps failed execution stageHistory array-shaped when existing metadata is malformed', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      metadata: {
        stage: 'PLACE_ORDER',
        stageHistory: { malformed: true },
      },
    })
    const update = jest.fn().mockResolvedValue({})
    const repo = new SignalExecutionRepository({
      tx: {
        userSignalExecution: {
          findUnique,
          update,
        },
      },
    } as any)

    await repo.markFailed('execution-1', 'order rejected', { stage: 'FAILED' } as any)

    expect(update).toHaveBeenCalledWith({
      where: { id: 'execution-1' },
      data: expect.objectContaining({
        status: ExecutionStatus.FAILED,
        errorMessage: 'order rejected',
        metadata: expect.objectContaining({
          stage: 'FAILED',
          stageHistory: [],
        }),
      }),
    })
  })
})

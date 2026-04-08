import { LlmStrategyCodegenController } from './llm-strategy-codegen.controller'

describe('llmStrategyCodegenController', () => {
  it('forwards confirmedCanonicalDigest on continueSession', async () => {
    const service = {
      continueCodegen: jest.fn().mockResolvedValue({ id: 'session-1', status: 'CHECKLIST_GATE' }),
    }
    const controller = new LlmStrategyCodegenController(service as never)

    await controller.continueSession('Bearer token-1', 'session-1', {
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:canonical-1',
    })

    expect(service.continueCodegen).toHaveBeenCalledWith(
      'Bearer token-1',
      'session-1',
      expect.objectContaining({
        message: '确认逻辑图',
        confirmGenerate: true,
        confirmedCanonicalDigest: 'sha256:canonical-1',
      }),
    )
  })
})

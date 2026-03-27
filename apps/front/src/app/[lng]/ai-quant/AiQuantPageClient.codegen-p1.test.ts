import { describe, expect, it } from '@jest/globals'
import {
  buildCodegenReplyContent,
  resolvePublishedStrategyInstanceId,
} from './AiQuantPageClient'

describe('AiQuantPageClient codegen P1 guards', () => {
  it('clears publishedStrategyInstanceId on fallback status or new session start', () => {
    const rejected = resolvePublishedStrategyInstanceId({
      response: {
        id: 's1',
        status: 'REJECTED',
        rejectReason: 'runtime error',
      },
      isStartingNewSession: false,
    })
    const newSessionStart = resolvePublishedStrategyInstanceId({
      response: {
        id: 's2',
        status: 'DRAFTING',
      },
      isStartingNewSession: true,
    })

    expect(rejected).toBeNull()
    expect(newSessionStart).toBeNull()
  })

  it('shows failure message when published carries rejectReason', () => {
    const content = buildCodegenReplyContent({
      response: {
        id: 's3',
        status: 'PUBLISHED',
        rejectReason: 'create instance failed',
      },
      confirmGenerate: true,
      publishedReply: '发布成功',
      graphGeneratedMessage: '已生成',
      graphReviseMessage: '请继续补充',
      checklistContinuedMessage: '继续检查',
      checklistUpdatedMessage: '已更新逻辑图',
      stillGeneratingPrefix: '生成中',
      rejectedPrefix: '生成失败',
      rejectedWithoutReason: '失败（无原因）',
    })

    expect(content).toContain('生成失败')
    expect(content).toContain('create instance failed')
    expect(content).not.toBe('发布成功')
  })
})

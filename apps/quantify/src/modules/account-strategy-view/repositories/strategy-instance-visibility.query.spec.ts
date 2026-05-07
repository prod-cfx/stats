import {
  runnableStrategyInstanceWhere,
  visibleStrategyInstanceWhere,
} from './strategy-instance-visibility.query'

describe('strategy-instance-visibility.query', () => {
  describe('visibleStrategyInstanceWhere', () => {
    it('only excludes archivedAt; view-only rows remain visible for list/detail', () => {
      const where = visibleStrategyInstanceWhere({ createdBy: 'u1' })
      expect(where).toEqual({ createdBy: 'u1', archivedAt: null })
      expect(where).not.toHaveProperty('viewOnlyAt')
    })
  })

  describe('runnableStrategyInstanceWhere', () => {
    it('excludes both archivedAt and viewOnlyAt for reuse/deploy lookups', () => {
      const where = runnableStrategyInstanceWhere({ createdBy: 'u1' })
      expect(where).toEqual({
        createdBy: 'u1',
        archivedAt: null,
        viewOnlyAt: null,
      })
    })

    // 索引同步守卫：若未来再加一列「软退役」状态，新字段必须同时进 helper
    // 与 partial unique 索引（uniq_strategy_instance_runnable_template_model_name）。
    // 这里固化 helper 的"软退役字段集合"，加新列时强制双向更新。
    it('includes exactly the soft-retirement fields kept in sync with the partial unique index', () => {
      const softRetirementFields = Object.keys(runnableStrategyInstanceWhere({}))
      expect(softRetirementFields.sort()).toEqual(['archivedAt', 'viewOnlyAt'].sort())
    })
  })
})

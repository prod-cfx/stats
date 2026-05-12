/**
 * Issue #1231 — UnsupportedFallbackService 去重测试
 *
 * 修复点：当 supported 触发器集合中已存在某个 supported atom（如 price.candle_pattern /
 * price.chart_pattern / liquidity.sweep），其同义 unsupported atom（price.pattern）
 * 必须从 fallback prompt 中剔除；全部剔除后返回 null。
 */

import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { UnsupportedFallbackService } from '../unsupported-fallback.service'

describe('UnsupportedFallbackService — covered-by-supported dedup', () => {
  const service = new UnsupportedFallbackService(new SemanticAtomRegistryService())

  const unsupportedPricePattern = {
    key: 'price.pattern',
    displayName: '图形形态',
    reasonCode: 'chart_pattern_public_beta_unsupported',
    publicReason: '图形形态识别当前公测暂未支持生成和回测。',
  }

  it('supported price.candle_pattern 已存在 → 过滤 unsupported price.pattern，返回 null', () => {
    const result = service.buildPendingFallback(
      [unsupportedPricePattern],
      [{ key: 'price.candle_pattern' }],
    )
    expect(result).toBeNull()
  })

  it('supported price.chart_pattern 已存在 → 过滤 unsupported price.pattern，返回 null', () => {
    const result = service.buildPendingFallback(
      [unsupportedPricePattern],
      [{ key: 'price.chart_pattern' }],
    )
    expect(result).toBeNull()
  })

  it('supported liquidity.sweep 已存在 → 过滤 unsupported price.pattern，返回 null', () => {
    const result = service.buildPendingFallback(
      [unsupportedPricePattern],
      [{ key: 'liquidity.sweep' }],
    )
    expect(result).toBeNull()
  })

  it('无 supported 触发器 → 仍发出 unsupported price.pattern 降级 prompt', () => {
    const result = service.buildPendingFallback([unsupportedPricePattern], [])
    expect(result).not.toBeNull()
    expect(result?.prompt).toContain('图形形态识别当前公测暂未支持生成和回测')
  })

  // 反向覆盖意图（防止未来误把映射改成"全部 unsupported 都被任一 supported 吃掉"）：
  // - price.pattern 在 UNSUPPORTED_COVERED_BY_SUPPORTED 映射里，被 candle_pattern 覆盖 → 应过滤
  // - volume.spike 不在该映射里，即使存在 supported 触发器也必须保留，让用户感知该原子未支持
  it('混合：unsupported price.pattern 被 candle_pattern 覆盖，未在映射中的 volume.spike 必须保留', () => {
    const result = service.buildPendingFallback(
      [
        unsupportedPricePattern,
        {
          key: 'volume.spike',
          displayName: '成交量放大',
          reasonCode: 'volume_condition_public_beta_unsupported',
          publicReason: '成交量条件当前公测暂未支持生成和回测。',
        },
      ],
      [{ key: 'price.candle_pattern' }],
    )
    expect(result).not.toBeNull()
    expect(result?.prompt).not.toContain('图形形态识别当前公测暂未支持')
    expect(result?.prompt).toContain('成交量条件当前公测暂未支持')
  })
})

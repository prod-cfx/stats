/**
 * Issue #1383 Round 2 MR2-4：extractAtrStopParams 参数解析边界覆盖。
 *
 * 提取规则约定：
 *   - multiplier 优先 `params.multiplier`，回退到 `params.multiple` alias
 *   - multiplier 必须 finite number 且 > 0，否则返回 null（fail-closed）
 *   - period 严格只接受 typeof === 'number'（整数 + 正），其他一律默认 14
 *   - 字符串、NaN、负数、零、缺失等异常输入均按 fail-closed 处理
 */

import { extractAtrStopParams } from '../atr-stop-params'

describe('extractAtrStopParams', () => {
  describe('multiplier 提取', () => {
    it('优先用 multiplier 字段', () => {
      expect(extractAtrStopParams({ multiplier: 2.5 })).toEqual({ period: 14, multiplier: 2.5 })
    })
    it('multiplier 缺失时回退 multiple', () => {
      expect(extractAtrStopParams({ multiple: 3 })).toEqual({ period: 14, multiplier: 3 })
    })
    it('multiplier 同时存在时不读 multiple', () => {
      expect(extractAtrStopParams({ multiplier: 2, multiple: 99 })).toEqual({ period: 14, multiplier: 2 })
    })
    it('multiplier=0 返回 null', () => {
      expect(extractAtrStopParams({ multiplier: 0 })).toBeNull()
    })
    it('multiplier 负数返回 null', () => {
      expect(extractAtrStopParams({ multiplier: -1.5 })).toBeNull()
    })
    it('multiplier=NaN 返回 null', () => {
      expect(extractAtrStopParams({ multiplier: Number.NaN })).toBeNull()
    })
    it('multiplier=Infinity 返回 null', () => {
      expect(extractAtrStopParams({ multiplier: Number.POSITIVE_INFINITY })).toBeNull()
    })
    it('multiplier 字符串 "2" 返回 null（typeof === number 强校验）', () => {
      expect(extractAtrStopParams({ multiplier: '2' as unknown as number })).toBeNull()
    })
    it('multiplier 与 multiple 均缺失返回 null', () => {
      expect(extractAtrStopParams({ period: 21 })).toBeNull()
    })
  })

  describe('period 提取', () => {
    it('typeof number 且正整数时采用', () => {
      expect(extractAtrStopParams({ multiplier: 2, period: 21 })).toEqual({ period: 21, multiplier: 2 })
    })
    it('period 缺失时默认 14', () => {
      expect(extractAtrStopParams({ multiplier: 2 })).toEqual({ period: 14, multiplier: 2 })
    })
    it('period=0 退回 14', () => {
      expect(extractAtrStopParams({ multiplier: 2, period: 0 })).toEqual({ period: 14, multiplier: 2 })
    })
    it('period 负数退回 14', () => {
      expect(extractAtrStopParams({ multiplier: 2, period: -7 })).toEqual({ period: 14, multiplier: 2 })
    })
    it('period 非整数（21.5）退回 14', () => {
      expect(extractAtrStopParams({ multiplier: 2, period: 21.5 })).toEqual({ period: 14, multiplier: 2 })
    })
    it('period 字符串 "21" 退回 14（typeof === number 严格）', () => {
      // 行为收紧标注：旧 ir-compiler 接受字符串；新版统一严格 typeof number。
      expect(extractAtrStopParams({ multiplier: 2, period: '21' as unknown as number })).toEqual({ period: 14, multiplier: 2 })
    })
  })

  describe('boundary', () => {
    it('params undefined 返回 null', () => {
      expect(extractAtrStopParams(undefined)).toBeNull()
    })
    it('params null 返回 null', () => {
      expect(extractAtrStopParams(null)).toBeNull()
    })
    it('空对象返回 null（无 multiplier）', () => {
      expect(extractAtrStopParams({})).toBeNull()
    })
  })
})

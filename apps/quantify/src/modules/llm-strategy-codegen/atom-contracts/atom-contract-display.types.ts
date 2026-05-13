/**
 * AtomContractDisplay — 渲染层契约（Issue #1279 PR1a）
 *
 * 设计目标：
 *   取代 `semantic-presentation-registry.service.ts` (2157 行) + `display-token-table.ts` (336 行)
 *   两个并行真相源。让每个 atom 自带 display 数据（publicName / paramRenderers / summaryTemplate），
 *   下游 `display-registry.ts` 退化为薄查询层 `REGISTRY[key].display.*`。
 *
 *   PR1a 阶段：仅声明 type；registry entry 在 PR1b 阶段先填 zh-only stub，
 *   PR1c 阶段从 presentation-registry 2157 行迁移真实双语数据。
 */

/**
 * LocaleMap —— 双语文本对（与 `apps/front/public/locales/{zh,en}/common.json` 对齐）。
 *
 * 注意：mixed locale 不走 LocaleMap，由调用层决定回退到 zh 或 en。
 */
export interface LocaleMap {
  readonly zh: string
  readonly en: string
}

/**
 * ParamRenderer —— 单参数渲染函数
 *
 * 调用方传入参数原值与目标 locale，返回 UI 可直接展示的字符串。
 * 实现必须是纯函数；禁止注入 service / 读外部状态（critic round 2 N3：保证 stable 输出）。
 */
export type ParamRenderer = (value: unknown, locale: 'zh' | 'en') => string

/**
 * SummaryTemplateFn —— atom 整体摘要渲染函数
 *
 * 输入参数 map + locale，返回 conversation summary 段使用的一句话描述
 * （取代现有 `summaryContribution` symbol sentinel + presentation-registry displayRenderer 链路）。
 *
 * params 是 **runtime IR-projected** 形态（来自 dispatcher / state-projection 输出），
 * 结构面允许宽于 surface.paramSlots —— surface 是 NL 解析侧契约，summaryTemplate 是 UI
 * 渲染侧契约，两者解耦。consumer 自行类型守卫。
 */
export type SummaryTemplateFn = (params: Readonly<Record<string, unknown>>, locale: 'zh' | 'en') => string

/**
 * AtomContractDisplay —— atom 渲染层契约
 *
 * 不变量（PR1b 编译期守护）：
 *   - publicName.zh 与 publicName.en 都必须非空（PR1a-6 i18n audit 后必须 100% 双语）
 *   - paramRenderers 覆盖 surface.paramSlots 的全部 key（无对应 renderer 的 slot 不允许在 UI 出现）
 *   - summaryTemplate 必须返回非空字符串（fail-closed）
 */
export interface AtomContractDisplay {
  readonly publicName: LocaleMap
  readonly paramRenderers: Readonly<Record<string, ParamRenderer>>
  readonly summaryTemplate: SummaryTemplateFn
}

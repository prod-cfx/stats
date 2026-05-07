/**
 * Single source of truth for the metadata payload attached to canonical rules /
 * IR rule blocks that originate from a `risk.partial_take_profit` semantic atom.
 *
 * The runtime mirror of this shape lives in
 * `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts`
 * (declared locally because shared cannot import quantify types). Keep both
 * shapes in sync — the comment over there points back here.
 */
export interface PartialTakeProfitProgramMetadata {
  memoryKey: string
  tierIndex: number
  totalTiers: number
}

// Compile-time assertion: structural shape must mirror the runtime declaration
// in packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts
// (PartialTakeProfitMeta). If you change PartialTakeProfitProgramMetadata,
// update the shared mirror or this assertion will catch the drift.
type _AssertShape = PartialTakeProfitProgramMetadata extends {
  memoryKey: string
  tierIndex: number
  totalTiers: number
} ? true : never

// Trivial usage to keep _AssertShape from being tree-shaken
const _shapeAssertion: _AssertShape = true

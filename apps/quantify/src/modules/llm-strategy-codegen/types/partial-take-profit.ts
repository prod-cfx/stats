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

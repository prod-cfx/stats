import type { CanonicalStrategySpec } from '../types/canonical-strategy-spec'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import { Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'

@Injectable()
export class CanonicalSpecV2DigestService {
  hash(spec: CanonicalStrategySpec): `sha256:${string}` {
    if (spec.version !== 2) {
      throw new Error('canonical_spec_v2_required')
    }
    const digest = createHash('sha256')
      .update(canonicalSerialize(spec))
      .digest('hex')
    return `sha256:${digest}`
  }
}

import { Transactional } from '@nestjs-cls/transactional'
import { applyDecorators, SetMetadata } from '@nestjs/common'

export const NEEDS_AFTER_COMMIT_METADATA_KEY = 'needs_after_commit'

export function TransactionalWithAfterCommit(): MethodDecorator {
  return applyDecorators(
    Transactional(),
    SetMetadata(NEEDS_AFTER_COMMIT_METADATA_KEY, true),
  )
}

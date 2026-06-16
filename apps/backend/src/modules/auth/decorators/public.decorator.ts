import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

/**
 * Marks an HTTP route as intentionally public.
 * This is semantic metadata only; current auth behavior remains unchanged.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

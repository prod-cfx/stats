import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

/**
 * Marks an HTTP route as intentionally public.
 * The global auth boundary guard reads this metadata and skips JWT authentication.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

import { NEEDS_AFTER_COMMIT_METADATA_KEY } from '@/common/decorators/transactional-with-after-commit.decorator'
import { AuthController } from './auth.controller'
import 'reflect-metadata'

describe('authController after-commit metadata', () => {
  it('marks routes that enqueue afterCommit tasks', () => {
    expect(Reflect.getMetadata(NEEDS_AFTER_COMMIT_METADATA_KEY, AuthController.prototype.sendVerificationCode)).toBe(true)
    expect(Reflect.getMetadata(NEEDS_AFTER_COMMIT_METADATA_KEY, AuthController.prototype.sendEmailLoginCode)).toBe(true)
    expect(Reflect.getMetadata(NEEDS_AFTER_COMMIT_METADATA_KEY, AuthController.prototype.requestPasswordReset)).toBe(true)
    expect(Reflect.getMetadata(NEEDS_AFTER_COMMIT_METADATA_KEY, AuthController.prototype.resendVerification)).toBe(true)
  })

  it('does not mark routes without afterCommit tasks', () => {
    expect(Reflect.getMetadata(NEEDS_AFTER_COMMIT_METADATA_KEY, AuthController.prototype.login)).toBeUndefined()
    expect(Reflect.getMetadata(NEEDS_AFTER_COMMIT_METADATA_KEY, AuthController.prototype.register)).toBeUndefined()
  })
})

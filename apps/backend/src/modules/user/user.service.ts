import { PrincipalType } from '@ai/shared'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { UserRepository } from './repositories/user.repository'

const TELEGRAM_CREDENTIAL_PREFIX = 'telegram:'

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findProfileById(userId: string) {
    const user = await this.userRepository.findProfileById(userId)

    if (!user) {
      return null
    }

    const assignments = await this.userRepository.findRoleAssignments(userId, PrincipalType.USER)

    const roles = assignments.map(item => item.role.code)

    const { credentials, ...profile } = user
    const telegramCredential = credentials[0]?.value
    const telegramId = telegramCredential?.startsWith(TELEGRAM_CREDENTIAL_PREFIX)
      ? telegramCredential.slice(TELEGRAM_CREDENTIAL_PREFIX.length)
      : null

    return {
      ...profile,
      roles,
      telegram: telegramId
        ? {
            id: telegramId,
            username: null,
            isLinked: true,
          }
        : null,
    }
  }
}

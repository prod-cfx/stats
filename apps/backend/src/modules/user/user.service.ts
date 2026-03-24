import { Injectable } from '@nestjs/common'
import { PrincipalType } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { UserRepository } from './repositories/user.repository'

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

    return {
      ...user,
      roles,
    }
  }
}

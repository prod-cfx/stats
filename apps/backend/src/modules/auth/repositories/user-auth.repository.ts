import type { User, VerificationCodePurpose } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'
import { PrincipalType } from '@/prisma/prisma.types'

@Injectable()
export class UserAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  /** @internal 仅供 Service 层事务编排使用 */
  async runInTransaction<T>(
    fn: Parameters<PrismaService['runInTransaction']>[0],
    options?: Parameters<PrismaService['runInTransaction']>[1],
  ): Promise<T> {
    return this.prisma.runInTransaction(fn, options) as Promise<T>
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const client = this.getClient()
    return client.user.findUnique({ where: { email } })
  }

  async createVerificationCode(data: {
    email: string
    code: string
    purpose: VerificationCodePurpose
    expiresAt: Date
  }): Promise<void> {
    const client = this.getClient()
    await client.verificationCode.create({ data })
  }

  async findRoleAssignments(userId: string): Promise<{ role: { code: string } }[]> {
    const client = this.getClient()
    return client.roleAssignment.findMany({
      where: { principalId: userId, principalType: PrincipalType.USER },
      include: { role: { select: { code: true } } },
    })
  }
}

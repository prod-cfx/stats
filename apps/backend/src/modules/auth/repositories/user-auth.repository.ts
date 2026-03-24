import type { UserCredentialType, VerificationCodePurpose } from '@ai/shared'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { User, UserCredential, VerificationCode } from '@/prisma/prisma.types'
import { PrincipalType } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class UserAuthRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async findUserByEmail(email: string): Promise<User | null> {
    return this.txHost.tx.user.findUnique({ where: { email } })
  }

  async findUserById(id: string): Promise<User | null> {
    return this.txHost.tx.user.findUnique({ where: { id } })
  }

  async findUserByIdOrThrow(id: string): Promise<User> {
    return this.txHost.tx.user.findUniqueOrThrow({ where: { id } })
  }

  async createUser(data: {
    email: string
    passwordHash: string
    nickname?: string | null
    emailVerified: boolean
    emailVerifiedAt?: Date | null
    isGuest: boolean
  }): Promise<User> {
    return this.txHost.tx.user.create({ data })
  }

  async updateUser(id: string, data: {
    email?: string
    passwordHash?: string
    emailVerified?: boolean
    emailVerifiedAt?: Date | null
    tokenVersion?: { increment: number }
  }): Promise<User> {
    return this.txHost.tx.user.update({ where: { id }, data })
  }

  async updateUsersByEmail(email: string, data: {
    emailVerified?: boolean
    emailVerifiedAt?: Date | null
  }): Promise<void> {
    await this.txHost.tx.user.updateMany({ where: { email }, data })
  }

  async createVerificationCode(data: {
    email: string
    code: string
    purpose: VerificationCodePurpose
    expiresAt: Date
  }): Promise<void> {
    await this.txHost.tx.verificationCode.create({ data })
  }

  async findVerificationCode(params: {
    email: string
    code: string
    purpose: VerificationCodePurpose
  }): Promise<VerificationCode | null> {
    return this.txHost.tx.verificationCode.findFirst({
      where: {
        email: params.email,
        code: params.code,
        purpose: params.purpose,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async consumeVerificationCode(id: string): Promise<number> {
    const result = await this.txHost.tx.verificationCode.updateMany({
      where: {
        id,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    })
    return result.count
  }

  async findRoleAssignments(userId: string): Promise<{ role: { code: string } }[]> {
    return this.txHost.tx.roleAssignment.findMany({
      where: { principalId: userId, principalType: PrincipalType.USER },
      include: { role: { select: { code: true } } },
    })
  }

  async findRoleByCode(code: string): Promise<{ id: string } | null> {
    return this.txHost.tx.role.findUnique({
      where: { code },
      select: { id: true },
    })
  }

  async createRoleAssignment(data: {
    principalId: string
    principalType: PrincipalType
    roleId: string
  }): Promise<void> {
    await this.txHost.tx.roleAssignment.create({ data })
  }

  async findUserCredential(value: string): Promise<(UserCredential & { user: User }) | null> {
    return this.txHost.tx.userCredential.findFirst({
      where: { value },
      include: { user: true },
    }) as Promise<(UserCredential & { user: User }) | null>
  }

  async createUserCredential(data: {
    userId: string
    type: UserCredentialType
    value: string
  }): Promise<void> {
    await this.txHost.tx.userCredential.create({ data })
  }

  async findUserCredentialByUserAndValue(userId: string, value: string): Promise<UserCredential | null> {
    return this.txHost.tx.userCredential.findFirst({
      where: { userId, value },
    })
  }
}

import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type {
  BetaAccessCode,
  BetaAccessCodeRedemption,
  Prisma as PrismaTypes,
} from '../../../../generated/prisma'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

export interface CreateBetaAccessCodeInput {
  code: string
  maxUses: number
  createdByAdminId?: string | null
}

@Injectable()
export class BetaAccessCodeRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  async count(): Promise<number> {
    return this.txHost.tx.betaAccessCode.count()
  }

  async findMany(params: { skip: number; take: number }): Promise<BetaAccessCode[]> {
    return this.txHost.tx.betaAccessCode.findMany({
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    })
  }

  async createMany(codes: CreateBetaAccessCodeInput[]): Promise<BetaAccessCode[]> {
    const data: PrismaTypes.BetaAccessCodeCreateManyInput[] = codes.map(code => ({
      code: code.code,
      maxUses: code.maxUses,
      createdByAdminId: code.createdByAdminId ?? null,
    }))

    return this.txHost.tx.betaAccessCode.createManyAndReturn({
      data,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findByCode(code: string): Promise<BetaAccessCode | null> {
    return this.txHost.tx.betaAccessCode.findUnique({
      where: { code },
    })
  }

  async incrementUsedCountIfAvailable(id: string): Promise<number> {
    const result = await this.txHost.tx.$executeRaw`
      UPDATE "beta_access_codes"
      SET "used_count" = "used_count" + 1,
          "updated_at" = NOW()
      WHERE "id" = ${id}
        AND "is_active" = true
        AND "used_count" < "max_uses"
    `
    return Number(result)
  }

  async createRedemption(params: {
    codeId: string
    userId: string
  }): Promise<BetaAccessCodeRedemption> {
    return this.txHost.tx.betaAccessCodeRedemption.create({
      data: {
        codeId: params.codeId,
        userId: params.userId,
      },
    })
  }

  async updateUserInvitationCode(userId: string, code: string): Promise<void> {
    await this.txHost.tx.user.update({
      where: { id: userId },
      data: { invitationCode: code },
    })
  }

  async updateStatus(id: string, isActive: boolean): Promise<BetaAccessCode> {
    return this.txHost.tx.betaAccessCode.update({
      where: { id },
      data: { isActive },
    })
  }
}

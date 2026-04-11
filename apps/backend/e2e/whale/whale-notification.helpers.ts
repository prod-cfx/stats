import type { Prisma as PrismaTypes } from '@/prisma/prisma.types'
import type { PrismaService } from '@/prisma/prisma.service'
import { createUserRecord } from '../fixtures/fixtures'

export type WhaleNotificationRuleCreateData = PrismaTypes.WhaleNotificationRuleUncheckedCreateInput
export type WhaleNotificationDeliverySeedData = PrismaTypes.WhaleNotificationDeliveryCreateManyInput[]

interface WhaleNotificationTestUserInput {
  userId: string
  email: string
  nickname: string
}

export async function createWhaleNotificationTestUser(
  prisma: PrismaService,
  input: WhaleNotificationTestUserInput,
) {
  await createUserRecord(prisma, {
    id: input.userId,
    email: input.email,
    nickname: input.nickname,
  })
}

export async function createWhaleNotificationRuleRecord(
  prisma: PrismaService,
  data: WhaleNotificationRuleCreateData,
) {
  return prisma.whaleNotificationRule.create({ data })
}

export async function createWhaleNotificationDeliveryRecords(
  prisma: PrismaService,
  data: WhaleNotificationDeliverySeedData,
) {
  await prisma.whaleNotificationDelivery.createMany({ data })
}

export async function cleanupWhaleNotificationUser(
  prisma: PrismaService,
  userId: string,
) {
  await prisma.whaleNotificationDelivery.deleteMany({ where: { userId } })
  await prisma.whaleNotificationRule.deleteMany({ where: { userId } })
  await prisma.user.deleteMany({ where: { id: userId } })
}

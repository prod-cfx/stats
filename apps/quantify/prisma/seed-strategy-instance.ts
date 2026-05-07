interface SeedStrategyInstanceDelegate {
  findFirst: (args: unknown) => Promise<{ id: string } | null>
  update: (args: unknown) => Promise<{ id: string }>
  create: (args: unknown) => Promise<{ id: string }>
}

interface SeedStrategyInstanceClient {
  strategyInstance: SeedStrategyInstanceDelegate
}

interface UpsertSeedStrategyInstanceInput {
  strategyTemplateId: string
  name: string
  description: string
  llmModel: string
  params: unknown
  userId: string
  metadata: unknown
}

export async function upsertSeedStrategyInstance(
  client: SeedStrategyInstanceClient,
  input: UpsertSeedStrategyInstanceInput,
): Promise<{ id: string }> {
  const existing = await client.strategyInstance.findFirst({
    where: {
      strategyTemplateId: input.strategyTemplateId,
      llmModel: input.llmModel,
      name: input.name,
      createdBy: input.userId,
      archivedAt: null,
    },
    select: { id: true },
  })

  if (existing) {
    return client.strategyInstance.update({
      where: { id: existing.id },
      data: {
        description: input.description,
        params: input.params,
        updatedBy: input.userId,
        metadata: input.metadata,
      },
      select: { id: true },
    })
  }

  return client.strategyInstance.create({
    data: {
      strategyTemplateId: input.strategyTemplateId,
      name: input.name,
      description: input.description,
      llmModel: input.llmModel,
      params: input.params,
      status: 'draft',
      mode: 'PAPER',
      createdBy: input.userId,
      updatedBy: input.userId,
      metadata: input.metadata,
    },
    select: { id: true },
  })
}

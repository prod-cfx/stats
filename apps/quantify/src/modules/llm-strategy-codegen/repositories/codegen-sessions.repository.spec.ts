import type { SemanticState } from '../types/semantic-state'
import { CodegenSessionsRepository } from './codegen-sessions.repository'

describe('codegenSessionsRepository.createDraftStrategyInstanceFromPublishedSession', () => {
  const buildInput = () => ({
    userId: 'user-1',
    sessionId: 'session-1',
    name: 'OKX SOLUSDT 5m AI策略',
    description: 'desc',
    llmModel: 'gpt-4o-mini',
    scriptCode: 'return { action: "buy" }',
    specDesc: {
      market: {
        symbols: ['SOLUSDT'],
        timeframes: ['5m'],
      },
    },
    params: {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
    },
    metadata: {
      sourceMessage: '平台：OKX',
    },
  })

  it('creates an executable multi-leg template for published AI codegen sessions', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      strategyTemplate: {
        create: jest.fn().mockResolvedValue({ id: 'template-1' }),
      },
      strategyInstance: {
        create: jest.fn().mockResolvedValue({ id: 'instance-1' }),
      },
      llmStrategyCodegenSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    }

    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }

    const repo = new CodegenSessionsRepository(txHost as any)

    const result = await repo.createDraftStrategyInstanceFromPublishedSession(buildInput())

    expect(result).toEqual({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })

    expect(tx.strategyTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        script: 'return { action: "buy" }',
        paramsSchema: {
          type: 'object',
          properties: {
            exchange: { type: 'string', title: 'exchange' },
            marketType: { type: 'string', title: 'marketType' },
            symbol: { type: 'string', title: 'symbol' },
            timeframe: { type: 'string', title: 'timeframe' },
            positionPct: { type: 'number', title: 'positionPct' },
          },
          required: ['exchange', 'marketType', 'symbol', 'timeframe', 'positionPct'],
          additionalProperties: true,
        },
        execution: {
          timeframe: '5m',
          cooldownMinutes: 5,
        },
        legs: [
          {
            id: 'primary',
            symbol: 'SOLUSDT:SPOT',
            role: 'primary',
            description: 'AI codegen primary leg',
          },
        ],
        dataRequirements: {
          primary: ['5m'],
        },
      }),
    }))
  })

  it('returns existing strategy instance without creating duplicated side effects when session already bound', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      strategyTemplate: {
        create: jest.fn(),
      },
      strategyInstance: {
        create: jest.fn(),
      },
      llmStrategyCodegenSession: {
        findUnique: jest.fn().mockResolvedValue({ strategyInstanceId: 'existing-instance-id' }),
        update: jest.fn(),
      },
    }

    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    const result = await repo.ensureDraftStrategyInstanceBoundForPublishedSession(buildInput())

    expect(result).toEqual({
      strategyTemplateId: '',
      strategyInstanceId: 'existing-instance-id',
    })
    expect(tx.strategyTemplate.create).not.toHaveBeenCalled()
    expect(tx.strategyInstance.create).not.toHaveBeenCalled()
    expect(tx.llmStrategyCodegenSession.update).not.toHaveBeenCalled()
  })

  it('creates and binds strategy instance in one transaction when session is not bound', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      strategyTemplate: {
        create: jest.fn().mockResolvedValue({ id: 'template-1' }),
      },
      strategyInstance: {
        create: jest.fn().mockResolvedValue({ id: 'instance-1' }),
      },
      llmStrategyCodegenSession: {
        findUnique: jest.fn().mockResolvedValue({ strategyInstanceId: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    }

    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    const result = await repo.ensureDraftStrategyInstanceBoundForPublishedSession(buildInput())

    expect(result).toEqual({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })
    expect(tx.strategyTemplate.create).toHaveBeenCalledTimes(1)
    expect(tx.strategyInstance.create).toHaveBeenCalledTimes(1)
    expect(tx.llmStrategyCodegenSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { strategyInstanceId: 'instance-1' },
    })
  })

  it('retries transaction startup timeout before binding strategy instance', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      strategyTemplate: {
        create: jest.fn().mockResolvedValue({ id: 'template-1' }),
      },
      strategyInstance: {
        create: jest.fn().mockResolvedValue({ id: 'instance-1' }),
      },
      llmStrategyCodegenSession: {
        findUnique: jest.fn().mockResolvedValue({ strategyInstanceId: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    }

    const transactionTimeoutError = Object.assign(
      new Error('Transaction API error: Unable to start a transaction in the given time.'),
      { code: 'P2034' },
    )

    const txHost = {
      tx,
      withTransaction: jest.fn()
        .mockRejectedValueOnce(transactionTimeoutError)
        .mockImplementation(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    const result = await repo.ensureDraftStrategyInstanceBoundForPublishedSession(buildInput())

    expect(result).toEqual({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })
    expect(txHost.withTransaction).toHaveBeenCalledTimes(2)
    expect(tx.strategyTemplate.create).toHaveBeenCalledTimes(1)
    expect(tx.strategyInstance.create).toHaveBeenCalledTimes(1)
    expect(tx.llmStrategyCodegenSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { strategyInstanceId: 'instance-1' },
    })
  })

  it('backfills published snapshot binding metadata onto the source strategy instance', async () => {
    const tx = {
      strategyInstance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'instance-1',
          metadata: {
            source: 'llm-codegen-session',
            codegenSessionId: 'session-1',
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'instance-1' }),
      },
    }

    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    await repo.bindPublishedSnapshotToStrategyInstance({
      strategyInstanceId: 'instance-1',
      userId: 'user-1',
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash-1',
      strategyTemplateId: 'template-1',
    })

    expect(tx.strategyInstance.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'instance-1',
        createdBy: 'user-1',
      },
      select: {
        id: true,
        metadata: true,
      },
    })
    expect(tx.strategyInstance.update).toHaveBeenCalledWith({
      where: { id: 'instance-1' },
      data: {
        updatedBy: 'user-1',
        metadata: {
          source: 'llm-codegen-session',
          codegenSessionId: 'session-1',
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          sourceStrategyInstanceId: 'instance-1',
          sourceStrategyTemplateId: 'template-1',
        },
      },
    })
  })

  it('persists clarification state on codegen sessions', async () => {
    let storedRow: Record<string, unknown> | null = null

    const pickSelected = (row: Record<string, unknown>, select?: Record<string, boolean>) => {
      const keys = Object.entries(select ?? {})
        .filter(([, enabled]) => enabled)
        .map(([key]) => key)
      return Object.fromEntries(keys.map(key => [key, row[key]]))
    }

    const tx = {
      llmStrategyCodegenSession: {
        create: jest.fn().mockImplementation(async (args: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
          storedRow = {
            id: 'session-1',
            userId: args.data.userId,
            status: args.data.status,
            checklist: args.data.checklist ?? null,
            clarificationState: args.data.clarificationState ?? null,
            constraintPack: args.data.constraintPack ?? null,
            latestDraftCode: args.data.latestDraftCode ?? null,
            latestSpecDesc: args.data.latestSpecDesc ?? null,
            rejectReason: args.data.rejectReason ?? null,
            strategyInstanceId: args.data.strategyInstanceId ?? null,
            createdAt: new Date('2026-04-02T00:00:00.000Z'),
            updatedAt: new Date('2026-04-02T00:00:00.000Z'),
          }
          return pickSelected(storedRow, args.select)
        }),
        findUnique: jest.fn().mockImplementation(async (args: { select?: Record<string, boolean> }) => {
          if (!storedRow) return null
          return pickSelected(storedRow, args.select)
        }),
      },
    }

    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repository = new CodegenSessionsRepository(txHost as never)

    const clarificationState = {
      status: 'NEEDS_CLARIFICATION',
      items: [
        {
          key: 'rule.entry.upper_band.side_scope',
          reason: 'direction_ambiguous',
          question: '突破上轨时是只做空还是也允许做多？',
          status: 'pending',
        },
      ],
    } as const

    const created = await repository.createSession({
      userId: 'u-1',
      status: 'DRAFTING',
      checklist: {},
      clarificationState,
    } as never)

    const loaded = await repository.findById('session-1')

    expect(tx.llmStrategyCodegenSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        clarificationState,
      }),
    }))
    expect((created as any).clarificationState).toEqual({
      status: 'NEEDS_CLARIFICATION',
      items: [
        expect.objectContaining({
          key: 'rule.entry.upper_band.side_scope',
          status: 'pending',
        }),
      ],
    })
    expect((loaded as any)?.clarificationState).toEqual({
      status: 'NEEDS_CLARIFICATION',
      items: [
        expect.objectContaining({
          key: 'rule.entry.upper_band.side_scope',
          status: 'pending',
        }),
      ],
    })
  })

  it('persists semanticState with session reads and writes', async () => {
    let storedRow: Record<string, unknown> | null = null

    const pickSelected = (row: Record<string, unknown>, select?: Record<string, boolean>) => {
      const keys = Object.entries(select ?? {})
        .filter(([, enabled]) => enabled)
        .map(([key]) => key)
      return Object.fromEntries(keys.map(key => [key, row[key]]))
    }

    const tx = {
      llmStrategyCodegenSession: {
        create: jest.fn().mockImplementation(async (args: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
          storedRow = {
            id: 'session-1',
            userId: args.data.userId,
            status: args.data.status,
            checklist: args.data.checklist ?? null,
            semanticState: args.data.semanticState ?? null,
            clarificationState: args.data.clarificationState ?? null,
            constraintPack: args.data.constraintPack ?? null,
            latestDraftCode: args.data.latestDraftCode ?? null,
            latestSpecDesc: args.data.latestSpecDesc ?? null,
            rejectReason: args.data.rejectReason ?? null,
            strategyInstanceId: args.data.strategyInstanceId ?? null,
            createdAt: new Date('2026-04-15T10:00:00.000Z'),
            updatedAt: new Date('2026-04-15T10:00:00.000Z'),
          }
          return pickSelected(storedRow, args.select)
        }),
        findUnique: jest.fn().mockImplementation(async (args: { select?: Record<string, boolean> }) => {
          if (!storedRow) return null
          return pickSelected(storedRow, args.select)
        }),
      },
    }

    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repository = new CodegenSessionsRepository(txHost as never)

    const semanticState: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'trigger-entry-ma-long',
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ma', referenceRole: 'long_term' },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'reference.period.entry',
              fieldPath: 'triggers[0].params.reference.period',
              status: 'open',
              priority: 'core',
              questionHint: '长期均线是多少？',
              affectsExecution: true,
            },
          ],
        },
      ],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-15T10:00:00.000Z',
    }

    const created = await repository.createSession({
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {},
      semanticState: semanticState as any,
      clarificationState: { status: 'NEEDS_CLARIFICATION', items: [] } as any,
      constraintPack: {} as any,
    } as any)

    const found = await repository.findById(created.id)

    expect(tx.llmStrategyCodegenSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        semanticState,
      }),
    }))
    expect((created as any).semanticState).toEqual(expect.objectContaining({
      version: 1,
      families: ['single-leg'],
      updatedAt: '2026-04-15T10:00:00.000Z',
      triggers: expect.arrayContaining([
        expect.objectContaining({
          openSlots: expect.arrayContaining([
            expect.objectContaining({
              slotKey: 'reference.period.entry',
            }),
          ]),
        }),
      ]),
      contextSlots: expect.objectContaining({
        timeframe: null,
      }),
    }))
    expect((found as any)?.semanticState).toEqual(expect.objectContaining({
      version: 1,
      families: ['single-leg'],
      updatedAt: '2026-04-15T10:00:00.000Z',
      triggers: expect.arrayContaining([
        expect.objectContaining({
          openSlots: expect.arrayContaining([
            expect.objectContaining({
              slotKey: 'reference.period.entry',
            }),
          ]),
        }),
      ]),
      contextSlots: expect.objectContaining({
        timeframe: null,
      }),
    }))
  })

  it('persists codegen sessions without a checklist column', async () => {
    const semanticState: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-15T10:00:00.000Z',
    }

    const tx = {
      llmStrategyCodegenSession: {
        create: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'u1',
          status: 'DRAFTING',
          semanticState,
          clarificationState: { status: 'CLEAR', items: [] },
          constraintPack: null,
          latestDraftCode: null,
          latestSpecDesc: { canonicalDigest: 'sha256:1' },
          graphSnapshot: null,
          semanticGraph: null,
          validationReport: null,
          compiledIr: null,
          rejectReason: null,
          strategyInstanceId: null,
          createdAt: new Date('2026-04-15T10:00:00.000Z'),
          updatedAt: new Date('2026-04-15T10:00:00.000Z'),
        }),
      },
    }
    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    await repo.createSession({
      userId: 'u1',
      status: 'DRAFTING' as any,
      semanticState,
      clarificationState: { status: 'CLEAR', items: [] } as any,
      constraintPack: null,
      latestDraftCode: null,
      latestSpecDesc: { canonicalDigest: 'sha256:1' } as any,
      rejectReason: null,
      strategyInstanceId: null,
    } as any)

    expect(tx.llmStrategyCodegenSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({
        checklist: expect.anything(),
      }),
      select: expect.not.objectContaining({
        checklist: true,
      }),
    }))
  })

  it('falls back when semantic_state column is missing during session reads and writes', async () => {
    const missingSemanticStateColumnError = Object.assign(
      new Error('The column `semantic_state` does not exist in the current database.'),
      { code: 'P2022', meta: { column: 'semantic_state' } },
    )

    const tx = {
      llmStrategyCodegenSession: {
        create: jest.fn()
          .mockRejectedValueOnce(missingSemanticStateColumnError)
          .mockResolvedValue({
            id: 'session-1',
            userId: 'user-1',
            status: 'DRAFTING',
            checklist: {},
            clarificationState: null,
            constraintPack: {},
            latestDraftCode: null,
            latestSpecDesc: null,
            graphSnapshot: null,
            semanticGraph: null,
            validationReport: null,
            compiledIr: null,
            rejectReason: null,
            strategyInstanceId: null,
            createdAt: new Date('2026-04-15T10:00:00.000Z'),
            updatedAt: new Date('2026-04-15T10:00:00.000Z'),
          }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-1',
          status: 'DRAFTING',
          checklist: {},
          clarificationState: null,
          constraintPack: {},
          latestDraftCode: null,
          latestSpecDesc: null,
          graphSnapshot: null,
          semanticGraph: null,
          validationReport: null,
          compiledIr: null,
          rejectReason: null,
          strategyInstanceId: null,
          createdAt: new Date('2026-04-15T10:00:00.000Z'),
          updatedAt: new Date('2026-04-15T10:00:00.000Z'),
        }),
      },
    }
    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repository = new CodegenSessionsRepository(txHost as never)

    const created = await repository.createSession({
      userId: 'user-1',
      status: 'DRAFTING',
      checklist: {},
      semanticState: {
        version: 1,
        families: [],
        triggers: [],
        actions: [],
        risk: [],
        position: null,
        contextSlots: {
          exchange: null,
          symbol: null,
          marketType: null,
          timeframe: null,
        },
        normalizationNotes: [],
        updatedAt: '2026-04-15T10:00:00.000Z',
      } satisfies SemanticState,
    } as any)
    const found = await repository.findById('session-1')

    expect(tx.llmStrategyCodegenSession.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({
        semanticState: expect.objectContaining({
          version: 1,
        }),
      }),
      select: expect.objectContaining({
        semanticState: true,
      }),
    }))
    expect(tx.llmStrategyCodegenSession.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.not.objectContaining({
        semanticState: expect.anything(),
      }),
      select: expect.not.objectContaining({
        semanticState: true,
      }),
    }))
    expect(tx.llmStrategyCodegenSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({
        semanticState: true,
      }),
    }))
    expect((created as any).semanticState).toBeNull()
    expect((found as any)?.semanticState).toBeNull()
  })

  it('uses the ambient prisma client for single-statement session reads and writes', async () => {
    const tx = {
      llmStrategyCodegenSession: {
        create: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-1',
          status: 'DRAFTING',
          checklist: {},
          constraintPack: {},
          latestDraftCode: null,
          latestSpecDesc: null,
          semanticGraph: null,
          validationReport: null,
          compiledIr: null,
          rejectReason: null,
          strategyInstanceId: null,
          createdAt: new Date('2026-04-02T00:00:00.000Z'),
          updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-1',
          status: 'DRAFTING',
          checklist: {},
          constraintPack: {},
          latestDraftCode: null,
          latestSpecDesc: null,
          semanticGraph: null,
          validationReport: null,
          compiledIr: null,
          rejectReason: null,
          strategyInstanceId: null,
          createdAt: new Date('2026-04-02T00:00:00.000Z'),
          updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        }),
        update: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-1',
          status: 'VALIDATING_STATIC',
          checklist: {},
          constraintPack: {},
          latestDraftCode: 'code',
          latestSpecDesc: null,
          semanticGraph: null,
          validationReport: null,
          compiledIr: null,
          rejectReason: null,
          strategyInstanceId: null,
          createdAt: new Date('2026-04-02T00:00:00.000Z'),
          updatedAt: new Date('2026-04-02T00:00:01.000Z'),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      llmStrategyCodeVersion: {
        create: jest.fn().mockResolvedValue({ id: 'version-1' }),
      },
    }

    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    await repo.createSession({
      user: { connect: { id: 'user-1' } },
      status: 'DRAFTING',
      checklist: {} as any,
      constraintPack: {} as any,
    } as any)
    await repo.findById('session-1')
    await repo.updateSession('session-1', { status: 'VALIDATING_STATIC' } as any)
    await repo.tryMarkGenerating('session-1', { status: 'GENERATING' } as any)
    await repo.createVersion({ session: { connect: { id: 'session-1' } }, scriptCode: 'code' } as any)

    expect(tx.llmStrategyCodegenSession.create).toHaveBeenCalled()
    expect(tx.llmStrategyCodegenSession.findUnique).toHaveBeenCalled()
    expect(tx.llmStrategyCodegenSession.update).toHaveBeenCalled()
    expect(tx.llmStrategyCodegenSession.updateMany).toHaveBeenCalled()
    expect(tx.llmStrategyCodeVersion.create).toHaveBeenCalled()
    expect(txHost.withTransaction).not.toHaveBeenCalled()
  })

  it('includes semantic pipeline fields in session select and update payloads', async () => {
    const sessionRow = {
      id: 'session-1',
      userId: 'user-1',
      status: 'DRAFTING',
      checklist: {},
      constraintPack: {},
      latestDraftCode: null,
      latestSpecDesc: null,
      graphSnapshot: {
        graphVersion: 'gss.v1',
        nodes: [],
        edges: [],
      },
      semanticGraph: {
        version: 1,
        nodes: [],
      },
      validationReport: {
        ok: true,
        errors: [],
      },
      compiledIr: {
        irVersion: 'csi.v1',
        nodes: [],
      },
      rejectReason: null,
      strategyInstanceId: null,
      createdAt: new Date('2026-04-04T00:00:00.000Z'),
      updatedAt: new Date('2026-04-04T00:00:00.000Z'),
    }
    const tx = {
      llmStrategyCodegenSession: {
        create: jest.fn().mockResolvedValue(sessionRow),
        findUnique: jest.fn().mockResolvedValue(sessionRow),
        update: jest.fn().mockResolvedValue({
          ...sessionRow,
          status: 'CHECKLIST_GATE',
          graphSnapshot: {
            graphVersion: 'gss.v1',
            nodes: [{ id: 'entry-1' }],
            edges: [],
          },
          semanticGraph: {
            version: 1,
            nodes: [{ id: 'entry-1' }],
          },
          validationReport: {
            ok: false,
            errors: [{ code: 'codegen.semantic_graph_incomplete' }],
          },
          compiledIr: {
            irVersion: 'csi.v1',
            nodes: [{ id: 'ir-1' }],
          },
        }),
      },
    }
    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    await repo.createSession({
      user: { connect: { id: 'user-1' } },
      status: 'DRAFTING',
      checklist: {} as any,
      constraintPack: {} as any,
      graphSnapshot: {
        graphVersion: 'gss.v1',
        nodes: [],
        edges: [],
      } as any,
      semanticGraph: {
        version: 1,
        nodes: [],
      } as any,
      validationReport: {
        ok: true,
        errors: [],
      } as any,
      compiledIr: {
        irVersion: 'csi.v1',
        nodes: [],
      } as any,
    } as any)
    await repo.findById('session-1')
    await repo.updateSession('session-1', {
      status: 'CHECKLIST_GATE',
      graphSnapshot: {
        graphVersion: 'gss.v1',
        nodes: [{ id: 'entry-1' }],
        edges: [],
      } as any,
      semanticGraph: {
        version: 1,
        nodes: [{ id: 'entry-1' }],
      } as any,
      validationReport: {
        ok: false,
        errors: [{ code: 'codegen.semantic_graph_incomplete' }],
      } as any,
      compiledIr: {
        irVersion: 'csi.v1',
        nodes: [{ id: 'ir-1' }],
      } as any,
    } as any)

    expect(tx.llmStrategyCodegenSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        graphSnapshot: expect.objectContaining({ graphVersion: 'gss.v1' }),
        semanticGraph: expect.objectContaining({ version: 1 }),
        validationReport: expect.objectContaining({ ok: true }),
        compiledIr: expect.objectContaining({ irVersion: 'csi.v1' }),
      }),
      select: expect.objectContaining({
        graphSnapshot: true,
        semanticGraph: true,
        validationReport: true,
        compiledIr: true,
      }),
    }))
    expect(tx.llmStrategyCodegenSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        graphSnapshot: true,
        semanticGraph: true,
        validationReport: true,
        compiledIr: true,
      }),
    }))
    expect(tx.llmStrategyCodegenSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        graphSnapshot: expect.objectContaining({
          nodes: [{ id: 'entry-1' }],
        }),
        semanticGraph: expect.objectContaining({
          nodes: [{ id: 'entry-1' }],
        }),
        validationReport: expect.objectContaining({
          ok: false,
        }),
        compiledIr: expect.objectContaining({
          nodes: [{ id: 'ir-1' }],
        }),
      }),
      select: expect.objectContaining({
        graphSnapshot: true,
        semanticGraph: true,
        validationReport: true,
        compiledIr: true,
      }),
    }))
  })

  it('persists clarificationState with session reads and writes', async () => {
    const clarificationState = {
      strategyType: 'grid',
      items: [
        {
          id: 'item-1',
          kind: 'semantic_ambiguity',
          strategyType: 'grid',
          field: 'gridSpacingMode',
          reason: '当前网格间距仍有两种解释',
          question: '这里的 1% 等距网格，是固定价差还是按百分比递增？',
          priority: 80,
          status: 'pending',
        },
      ],
      lastAskedItemId: 'item-1',
    }
    const sessionRow = {
      id: 'session-1',
      userId: 'user-1',
      status: 'DRAFTING',
      checklist: {},
      constraintPack: {},
      clarificationState,
      latestDraftCode: null,
      latestSpecDesc: null,
      graphSnapshot: null,
      semanticGraph: null,
      validationReport: null,
      compiledIr: null,
      rejectReason: null,
      strategyInstanceId: null,
      createdAt: new Date('2026-04-07T00:00:00.000Z'),
      updatedAt: new Date('2026-04-07T00:00:00.000Z'),
    }
    const tx = {
      llmStrategyCodegenSession: {
        create: jest.fn().mockResolvedValue(sessionRow),
        findUnique: jest.fn().mockResolvedValue(sessionRow),
        update: jest.fn().mockResolvedValue({
          ...sessionRow,
          clarificationState: {
            ...clarificationState,
            items: clarificationState.items.map(item => ({
              ...item,
              status: item.id === 'item-1' ? 'resolved' : item.status,
              resolvedValue: item.id === 'item-1' ? 'fixed_step' : undefined,
            })),
          },
        }),
      },
    }
    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    const created = await repo.createSession({
      user: { connect: { id: 'user-1' } },
      status: 'DRAFTING',
      checklist: {} as any,
      constraintPack: {} as any,
      clarificationState: clarificationState as any,
    } as any)
    const found = await repo.findById('session-1')
    const updated = await repo.updateSession('session-1', {
      clarificationState: {
        ...clarificationState,
        items: clarificationState.items.map(item => ({
          ...item,
          status: item.id === 'item-1' ? 'resolved' : item.status,
          resolvedValue: item.id === 'item-1' ? 'fixed_step' : undefined,
        })),
      } as any,
    } as any)

    expect((created as any).clarificationState).toEqual(expect.objectContaining({
      strategyType: 'grid',
      lastAskedItemId: 'item-1',
    }))
    expect((found as any)?.clarificationState).toEqual(expect.objectContaining({
      strategyType: 'grid',
    }))
    expect((updated as any).clarificationState).toEqual(expect.objectContaining({
      items: expect.arrayContaining([
        expect.objectContaining({
          id: 'item-1',
          status: 'resolved',
          resolvedValue: 'fixed_step',
        }),
      ]),
    }))
    expect(tx.llmStrategyCodegenSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        clarificationState: expect.objectContaining({
          strategyType: 'grid',
        }),
      }),
      select: expect.objectContaining({
        clarificationState: true,
      }),
    }))
    expect(tx.llmStrategyCodegenSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        clarificationState: true,
      }),
    }))
    expect(tx.llmStrategyCodegenSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        clarificationState: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: 'item-1',
              status: 'resolved',
            }),
          ]),
        }),
      }),
      select: expect.objectContaining({
        clarificationState: true,
      }),
    }))
  })
})

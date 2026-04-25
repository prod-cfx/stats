import { PATH_METADATA } from '@nestjs/common/constants'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { AdminBetaCodeController } from './admin-beta-code.controller'

describe('AdminBetaCodeController', () => {
  const betaCode = {
    id: 'code-1',
    code: 'BETA123',
    maxUses: 2,
    usedCount: 1,
    isActive: true,
    createdByAdminId: 'admin-1',
    createdAt: new Date('2026-04-24T00:00:00.000Z'),
    updatedAt: new Date('2026-04-24T01:00:00.000Z'),
  }

  it('uses the admin beta-codes route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminBetaCodeController)).toEqual('admin/beta-codes')
  })

  it('maps list results to the public beta code response shape', async () => {
    const controller = new AdminBetaCodeController({
      list: jest.fn().mockResolvedValue(new BasePaginationResponseDto(1, 1, 20, [betaCode])),
    } as never)

    const result = await controller.list({ page: 1, limit: 20 })

    expect(result.items).toEqual([
      {
        id: 'code-1',
        code: 'BETA123',
        maxUses: 2,
        usedCount: 1,
        isActive: true,
        createdAt: new Date('2026-04-24T00:00:00.000Z'),
      },
    ])
    expect(result.items[0]).not.toHaveProperty('createdByAdminId')
    expect(result.items[0]).not.toHaveProperty('updatedAt')
  })

})

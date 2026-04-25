import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
import { AppResource } from '../rbac/permissions'
import { PermissionService } from './permission.service'

describe('PermissionService custom role permissions', () => {
  it('resolves admin beta-code permissions for custom roles', async () => {
    const roleAssignmentRepository = {
      findRolesByPrincipal: jest.fn().mockResolvedValue([
        {
          role: {
            code: 'beta-operator',
            apiPermissions: [
              'ADMIN:BETA-CODE:READ',
              'ADMIN:BETA_CODE:CREATE',
              'ADMIN:BETA_ACCESS_CODES:UPDATE',
            ],
          },
        },
      ]),
    }
    const configService = {
      get: jest.fn().mockReturnValue(false),
    }
    const cache = {
      get: jest.fn(),
      set: jest.fn(),
    }
    const service = new PermissionService(
      roleAssignmentRepository as never,
      configService as never,
      cache as never,
    )
    const user = {
      id: 'admin-1',
      principalType: 'admin',
    } as AuthenticatedUser

    await expect(service.hasAccess([{ action: 'read', resource: AppResource.BETA_CODE }], user))
      .resolves.toBe(true)
    await expect(service.hasAccess([{ action: 'create', resource: AppResource.BETA_CODE }], user))
      .resolves.toBe(true)
    await expect(service.hasAccess([{ action: 'update', resource: AppResource.BETA_CODE }], user))
      .resolves.toBe(true)
    await expect(service.hasAccess([{ action: 'delete', resource: AppResource.BETA_CODE }], user))
      .resolves.toBe(false)
  })
})

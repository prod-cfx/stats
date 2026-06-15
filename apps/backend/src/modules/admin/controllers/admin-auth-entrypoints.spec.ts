import type { AdminUserDto } from '../dto/admin-user.dto'
import { AdminAuthController } from './admin-auth.controller'
import { AdminUserController } from './admin-user.controller'

describe('admin auth entrypoints', () => {
  const adminUser: AdminUserDto = {
    id: 'admin-1',
    username: 'root',
    nickName: 'Root',
    email: 'root@example.com',
    avatarUrl: null,
    phone: null,
    isFrozen: false,
    roles: [],
  }

  const authResult = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: '30m',
    user: adminUser,
  }

  const adminInfo = {
    id: adminUser.id,
    username: adminUser.username,
    nickName: adminUser.nickName,
    headPic: adminUser.avatarUrl,
    menus: [],
    menuPermissions: ['system.users'],
    featurePermissions: [],
    apiPermissions: [],
  }

  const createService = () => ({
    login: jest.fn().mockResolvedValue(authResult),
    refresh: jest.fn().mockResolvedValue(authResult),
    findById: jest.fn().mockResolvedValue(adminUser),
    getAdminInfo: jest.fn().mockResolvedValue(adminInfo),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  })

  it('returns the same login response shape from canonical and legacy routes', async () => {
    const service = createService()
    const authController = new AdminAuthController(service as never)
    const userController = new AdminUserController(service as never)

    await expect(authController.login({ username: 'root', password: 'password' })).resolves.toEqual(
      await userController.login({ username: 'root', password: 'password' }),
    )
  })

  it('returns the same refresh response shape from canonical and legacy routes', async () => {
    const service = createService()
    const authController = new AdminAuthController(service as never)
    const userController = new AdminUserController(service as never)

    await expect(authController.refresh({ refreshToken: 'refresh-token' })).resolves.toEqual(
      await userController.refresh({ refreshToken: 'refresh-token' }),
    )
  })
})

import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AdminAuthController } from './controllers/admin-auth.controller'
import { AdminMenuController } from './controllers/admin-menu.controller'
import { AdminRoleController } from './controllers/admin-role.controller'
import { AdminUserController } from './controllers/admin-user.controller'
import { AdminMenuRepository } from './repositories/admin-menu.repository'
import { AdminRoleRepository } from './repositories/admin-role.repository'
import { AdminUserRepository } from './repositories/admin-user.repository'
import { AdminMenuService } from './services/admin-menu.service'
import { AdminRoleService } from './services/admin-role.service'
import { AdminUserService } from './services/admin-user.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminAuthController, AdminUserController, AdminRoleController, AdminMenuController],
  providers: [
    AdminMenuRepository,
    AdminRoleRepository,
    AdminUserRepository,
    AdminUserService,
    AdminRoleService,
    AdminMenuService,
  ],
})
export class AdminModule {}

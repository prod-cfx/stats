// Prisma 7: 显式加载环境变量（Prisma 7 不再自动加载）
import * as path from 'path'
import { loadEnvironment } from '@net/config'

// 使用统一的 loadEnvironment 加载环境变量
const rootDir = path.resolve(__dirname, '../../..')
loadEnvironment({ basePath: rootDir })

// Prisma 7: 使用 Driver Adapter
import { PrismaPg } from '@prisma/adapter-pg'
import { hashSync } from 'bcrypt'
import { Pool } from 'pg'
import { AdminMenuType, PrincipalType } from '@ai/shared'
import { PrismaClient } from '../generated/prisma'
import { createEnvAccessor } from '../src/common/env/env.accessor'
import { AppRole } from '../src/modules/auth/rbac/permissions'
import { seedOrderbookConfigs } from './seeds/orderbook-configs.seed'
import { seedTradesConfigs } from './seeds/trades-configs.seed'
import { seedDataPullTasks } from './seeds/data-pull-tasks.seed'

// 使用统一的环境变量访问器
const env = createEnvAccessor()

const dbUrl = env.str('DATABASE_URL')
if (!dbUrl || dbUrl === '__SET_IN_env.local__') {
  console.error('❌ DATABASE_URL 未配置或仍为占位符。请在 .env.*.local 中设置有效的数据库连接字符串。')
  process.exit(1)
}
const pool = new Pool({ connectionString: dbUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const SUPER_ADMIN_USERNAME = env.str('SEED_ADMIN_USERNAME', 'admin')!
const SUPER_ADMIN_PASSWORD = env.str('SEED_ADMIN_PASSWORD', 'admin123')!
const SUPER_ADMIN_EMAIL = env.str('SEED_ADMIN_EMAIL', 'admin@example.com')!
const SUPER_ADMIN_NICKNAME = '超级管理员'
const SUPER_ADMIN_PHONE = '13300000000'

const ADMIN_MENU_DEFINITIONS: Array<{
  code: string
  title: string
  type: AdminMenuType
  sort?: number
  path?: string
  icon?: string
  parentCode?: string
}> = [
  {
    code: 'dashboard',
    title: '仪表盘',
    type: AdminMenuType.MENU,
    path: '/dashboard',
    icon: 'lucide:layout-dashboard',
    sort: 0,
  },
  {
    code: 'system',
    title: '系统管理',
    type: AdminMenuType.DIRECTORY,
    icon: 'lucide:settings',
    sort: 10,
  },
  {
    code: 'system.roles',
    title: '角色管理',
    type: AdminMenuType.MENU,
    path: '/roles',
    parentCode: 'system',
    icon: 'lucide:shield-check',
    sort: 11,
  },
  {
    code: 'system.menus',
    title: '菜单管理',
    type: AdminMenuType.MENU,
    path: '/menus',
    parentCode: 'system',
    icon: 'lucide:list-checks',
    sort: 12,
  },
  {
    code: 'system.admins',
    title: '管理员',
    type: AdminMenuType.MENU,
    path: '/users',
    parentCode: 'system',
    icon: 'lucide:users',
    sort: 13,
  },
  {
    code: 'beta.access-codes',
    title: '内测码',
    type: AdminMenuType.MENU,
    path: '/beta-codes',
    parentCode: 'system',
    icon: 'lucide:key-round',
    sort: 14,
  },
  {
    code: 'data',
    title: '数据管理',
    type: AdminMenuType.DIRECTORY,
    icon: 'lucide:database',
    sort: 20,
  },
  {
    code: 'data.orderbook',
    title: '订单薄配置',
    type: AdminMenuType.MENU,
    path: '/orderbook-configs',
    parentCode: 'data',
    icon: 'lucide:book-open',
    sort: 21,
  },
  {
    code: 'data.exchanges',
    title: '交易所配置',
    type: AdminMenuType.MENU,
    path: '/exchange-configs',
    parentCode: 'data',
    icon: 'lucide:building-2',
    sort: 22,
  },
  {
    code: 'data.trades',
    title: '交易记录订阅',
    type: AdminMenuType.MENU,
    path: '/trades-configs',
    parentCode: 'data',
    icon: 'lucide:activity',
    sort: 23,
  },
]

const ADMIN_MENU_PERMISSION_CODES = ADMIN_MENU_DEFINITIONS.filter(def => def.type !== AdminMenuType.DIRECTORY).map(
  def => def.code,
)

async function seedBaseRoles() {
  const defaultRoles: Array<{
    code: AppRole
    name: string
    description?: string
    menuPermissions?: string[]
    featurePermissions?: string[]
    apiPermissions?: string[]
  }> = [
    { code: AppRole.USER, name: '普通用户', description: '基础资源访问权限' },
    { code: AppRole.MODERATOR, name: '版主', description: '社区管理权限' },
    { code: AppRole.ADMIN, name: '管理员', description: '后台管理权限' },
    {
      code: AppRole.SUPER_ADMIN,
      name: '超级管理员',
      description: '全局最高权限',
      menuPermissions: ADMIN_MENU_PERMISSION_CODES,
      featurePermissions: ['*'],
      apiPermissions: ['*'],
    },
  ]

  await Promise.all(
    defaultRoles.map(role =>
      prisma.role.upsert({
        where: { code: role.code },
        update: {
          name: role.name,
          description: role.description,
          menuPermissions: role.menuPermissions ?? [],
          featurePermissions: role.featurePermissions ?? [],
          apiPermissions: role.apiPermissions ?? [],
        },
        create: {
          code: role.code,
          name: role.name,
          description: role.description,
          menuPermissions: role.menuPermissions ?? [],
          featurePermissions: role.featurePermissions ?? [],
          apiPermissions: role.apiPermissions ?? [],
        },
      }),
    ),
  )
}

function hashPasswordForSeed(plain: string): string {
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? '12')
  const saltRounds = Number.isFinite(rounds) && rounds > 0 ? rounds : 12
  return hashSync(plain, saltRounds)
}

async function seedAdminMenus() {
  console.log('[seed] 确保后台菜单配置...')
  const menuIdMap = new Map<string, string>()

  for (const definition of ADMIN_MENU_DEFINITIONS) {
    let parentId: string | null = null
    if (definition.parentCode) {
      parentId =
        menuIdMap.get(definition.parentCode) ??
        (
          await prisma.adminMenu.findUnique({
            where: { code: definition.parentCode },
            select: { id: true },
          })
        )?.id ?? null
    }

    const record = await prisma.adminMenu.upsert({
      where: { code: definition.code },
      update: {
        title: definition.title,
        type: definition.type,
        path: definition.path ?? null,
        sort: definition.sort ?? 0,
        icon: definition.icon ?? null,
        parentId,
        isShow: true,
        code: definition.code,
      },
      create: {
        title: definition.title,
        type: definition.type,
        path: definition.path ?? null,
        sort: definition.sort ?? 0,
        icon: definition.icon ?? null,
        parentId,
        isShow: true,
        code: definition.code,
      },
    })

    menuIdMap.set(definition.code, record.id)
  }

  console.log('[seed] 后台菜单配置完成')
}

async function seedAdminUser() {
  console.log('[seed] 开始初始化后台管理员账号...')

  const superAdminRole = await prisma.role.findUnique({
    where: { code: AppRole.SUPER_ADMIN },
  })

  if (!superAdminRole) {
    console.warn('[seed] 未找到 SUPER_ADMIN 角色，跳过管理员账号初始化')
    return
  }

  let adminUser = await prisma.adminUser.findUnique({
    where: { username: SUPER_ADMIN_USERNAME },
  })

  if (!adminUser) {
    adminUser = await prisma.adminUser.create({
      data: {
        username: SUPER_ADMIN_USERNAME,
        password: hashPasswordForSeed(SUPER_ADMIN_PASSWORD),
        nickName: SUPER_ADMIN_NICKNAME,
        email: SUPER_ADMIN_EMAIL,
        avatarUrl: null,
        phone: SUPER_ADMIN_PHONE,
      },
    })
    console.log(`[seed] 已创建默认管理员账号: ${SUPER_ADMIN_USERNAME}/${SUPER_ADMIN_PASSWORD}`)
  } else {
    console.log('[seed] 检测到已有管理员账号，跳过创建')
  }

  const existingAssignment = await prisma.roleAssignment.findFirst({
    where: {
      principalId: adminUser.id,
      principalType: PrincipalType.ADMIN,
      roleId: superAdminRole.id,
    },
  })

  if (!existingAssignment) {
    await prisma.roleAssignment.create({
      data: {
        principalId: adminUser.id,
        principalType: PrincipalType.ADMIN,
        roleId: superAdminRole.id,
      },
    })
    console.log('[seed] 已为管理员账号绑定 SUPER_ADMIN 角色')
  } else {
    console.log('[seed] 管理员账号已绑定 SUPER_ADMIN 角色，跳过绑定')
  }
}

async function main() {
  console.log('开始填充种子数据...')

  await seedBaseRoles()
  await seedAdminMenus()
  await seedAdminUser()
  await seedOrderbookConfigs(prisma)
  await seedTradesConfigs(prisma)
  await seedDataPullTasks(prisma)

  console.log('种子数据填充完成')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    // Prisma 7: 关闭连接池
    await pool.end()
  })
  .catch(async (e) => {
    console.error('种子数据填充失败:', e)
    await prisma.$disconnect()
    // Prisma 7: 关闭连接池
    await pool.end()
    process.exit(1)
  })

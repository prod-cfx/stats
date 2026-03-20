const BASE_DOMAIN = 'admin'

function canonicalPermissionCode(source: string) {
  return source
    .split(':')
    .map(part => part.trim().replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').toUpperCase())
    .join(':')
}

const ACTION_ALIASES = {
  read: 'READ',
  create: 'CREATE',
  update: 'UPDATE',
  delete: 'DELETE',
  manage: 'MANAGE',
  write: 'WRITE',
  execute: 'EXECUTE',
} as const

type PermissionAction = keyof typeof ACTION_ALIASES

type PermissionMap<A extends readonly PermissionAction[]> = {
  readonly [K in Uppercase<A[number]>]: string
}

function definePermissions<A extends readonly PermissionAction[]>(
  resource: string,
  actions: A,
): PermissionMap<A> {
  return actions.reduce(
    (bucket, action) => {
      const key = ACTION_ALIASES[action] as Uppercase<typeof action>
      // 按 domain:resource:action 规范生成权限编码
      bucket[key] = canonicalPermissionCode(`${BASE_DOMAIN}:${resource}:${action}`)
      return bucket
    },
    {} as Record<string, string>,
  ) as PermissionMap<A>
}

export const ADMIN_PERMISSION = {
  DASHBOARD: definePermissions('dashboard', ['read'] as const),
  USER: definePermissions('user', ['create', 'read', 'update', 'delete', 'manage'] as const),
  ROLE: definePermissions('role', ['create', 'read', 'update', 'delete', 'manage'] as const),
  MENU: definePermissions('menu', ['create', 'read', 'update', 'delete', 'manage'] as const),
  CHARACTER: definePermissions('character', [
    'create',
    'read',
    'update',
    'delete',
    'manage',
  ] as const),
  PINNED_TAG: definePermissions('pinned-tag', ['create', 'read', 'update', 'delete'] as const),
  MESSAGES: definePermissions('messages', ['read', 'update', 'delete'] as const),
  STORIES: definePermissions('stories', ['read', 'update', 'delete'] as const),
  CONFIG_TEST: definePermissions('config-test', ['read', 'update'] as const),
  PAYMENT_ORDER: definePermissions('payment-order', ['read'] as const),
  WALLET: definePermissions('wallet', ['read', 'update'] as const),
  LANDING_CHANNEL: definePermissions('landing-channel', [
    'create',
    'read',
    'update',
    'delete',
    'manage',
  ] as const),
  SETTINGS: definePermissions('settings', ['create', 'read', 'update'] as const),
  DEBUG_TRACE: definePermissions('debug-trace', ['read', 'update'] as const),
  INVITATION: definePermissions('invitation', ['read', 'update'] as const),
  MODEL_PROVIDER: definePermissions('model-provider', [
    'create',
    'read',
    'update',
    'delete',
  ] as const),
  MODEL: definePermissions('model', ['create', 'read', 'update', 'delete'] as const),
  VIRTUAL_MODEL: definePermissions('virtual-model', [
    'create',
    'read',
    'update',
    'delete',
  ] as const),
  PRESET: definePermissions('preset', ['create', 'read', 'update', 'delete'] as const),
  AI_USECASE: definePermissions('ai-usecase', ['create', 'read', 'update', 'delete'] as const),
  ACTIVITY: definePermissions('activity', ['create', 'read', 'update', 'delete'] as const),
  ADVERTISEMENT: definePermissions('advertisement', [
    'create',
    'read',
    'update',
    'delete',
  ] as const),
  WORLDINFO: definePermissions('worldinfo', ['create', 'read', 'update', 'delete'] as const),
  ENGAGEMENT: definePermissions('engagement', ['create', 'read', 'update'] as const),
  DEBUG_MESSAGE: definePermissions('debug-message', ['read'] as const),
  USER_ANALYTICS: definePermissions('user-analytics', ['read'] as const),
  SCHEDULER: definePermissions('scheduler', ['create', 'read', 'update', 'delete'] as const),
  CHARACTER_TEMPLATE: definePermissions('character-template', [
    'create',
    'read',
    'update',
    'delete',
  ] as const),
} as const

export type AdminPermissionGroup = typeof ADMIN_PERMISSION

export interface AdminRoutePermission {
  path: string
  permission: string
}

export const ADMIN_ROUTE_PERMISSIONS: AdminRoutePermission[] = [
  { path: '/', permission: ADMIN_PERMISSION.DASHBOARD.READ },
  { path: '/index', permission: ADMIN_PERMISSION.DASHBOARD.READ },
  { path: '/user', permission: ADMIN_PERMISSION.USER.READ },
  { path: '/user/:id', permission: ADMIN_PERMISSION.USER.READ },
  { path: '/user-center', permission: ADMIN_PERMISSION.USER.READ },

  { path: '/system/user', permission: ADMIN_PERMISSION.USER.READ },
  // 创建和编辑路由拆分，确保权限粒度正确（具体路由必须在通配路由之前）
  { path: '/system/user/create/:id', permission: ADMIN_PERMISSION.USER.CREATE },
  { path: '/system/user/edit/:id', permission: ADMIN_PERMISSION.USER.UPDATE },

  { path: '/system/role', permission: ADMIN_PERMISSION.ROLE.READ },
  { path: '/system/role/create/:id', permission: ADMIN_PERMISSION.ROLE.CREATE },
  { path: '/system/role/edit/:id', permission: ADMIN_PERMISSION.ROLE.UPDATE },

  { path: '/system/menu', permission: ADMIN_PERMISSION.MENU.READ },
  { path: '/system/menu/create/:id', permission: ADMIN_PERMISSION.MENU.CREATE },
  { path: '/system/menu/edit/:id', permission: ADMIN_PERMISSION.MENU.UPDATE },

  { path: '/card', permission: ADMIN_PERMISSION.CHARACTER.READ },
  { path: '/card/:id', permission: ADMIN_PERMISSION.CHARACTER.READ },

  { path: '/pinnedtags', permission: ADMIN_PERMISSION.PINNED_TAG.READ },

  { path: '/messages', permission: ADMIN_PERMISSION.MESSAGES.READ },
  { path: '/messages/statistics', permission: ADMIN_PERMISSION.MESSAGES.READ },

  { path: '/stories', permission: ADMIN_PERMISSION.STORIES.READ },

  { path: '/chatdebug', permission: ADMIN_PERMISSION.DEBUG_TRACE.READ },
  { path: '/chatdebug/:id', permission: ADMIN_PERMISSION.DEBUG_TRACE.READ },

  { path: '/ai-usecase', permission: ADMIN_PERMISSION.AI_USECASE.READ },
  { path: '/ai-usecase/:id', permission: ADMIN_PERMISSION.AI_USECASE.READ },

  { path: '/preset', permission: ADMIN_PERMISSION.PRESET.READ },
  { path: '/preset/create', permission: ADMIN_PERMISSION.PRESET.CREATE },
  { path: '/preset/:id', permission: ADMIN_PERMISSION.PRESET.READ },

  { path: '/activity', permission: ADMIN_PERMISSION.ACTIVITY.READ },

  { path: '/worldinfo', permission: ADMIN_PERMISSION.WORLDINFO.READ },
  { path: '/worldinfo/:id', permission: ADMIN_PERMISSION.WORLDINFO.READ },
  { path: '/worldinfo/:id/:entryId', permission: ADMIN_PERMISSION.WORLDINFO.READ },

  { path: '/virtualmodel', permission: ADMIN_PERMISSION.VIRTUAL_MODEL.READ },
  { path: '/virtualmodel/:id/edit', permission: ADMIN_PERMISSION.VIRTUAL_MODEL.UPDATE },

  { path: '/model', permission: ADMIN_PERMISSION.MODEL.READ },
  { path: '/model/:id/edit', permission: ADMIN_PERMISSION.MODEL.UPDATE },

  { path: '/modelprovider', permission: ADMIN_PERMISSION.MODEL_PROVIDER.READ },
  { path: '/modelprovider/:id/edit', permission: ADMIN_PERMISSION.MODEL_PROVIDER.UPDATE },

  { path: '/settings', permission: ADMIN_PERMISSION.SETTINGS.READ },

  { path: '/advertisement', permission: ADMIN_PERMISSION.ADVERTISEMENT.READ },

  { path: '/landing-channel', permission: ADMIN_PERMISSION.LANDING_CHANNEL.READ },
  { path: '/landing-channel/:id', permission: ADMIN_PERMISSION.LANDING_CHANNEL.READ },

  { path: '/payment-orders', permission: ADMIN_PERMISSION.PAYMENT_ORDER.READ },

  { path: '/wallet-statistics', permission: ADMIN_PERMISSION.WALLET.READ },

  { path: '/scheduler', permission: ADMIN_PERMISSION.SCHEDULER.READ },
  { path: '/scheduler/:id', permission: ADMIN_PERMISSION.SCHEDULER.READ },
  { path: '/templates', permission: ADMIN_PERMISSION.CHARACTER_TEMPLATE.READ },

  { path: '/about', permission: ADMIN_PERMISSION.DASHBOARD.READ },
] as const

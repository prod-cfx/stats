import { MODULE_METADATA } from '@nestjs/common/constants'
import { AuthAccessModule } from '@/modules/auth/auth-access.module'
import { AuthModule } from '@/modules/auth/auth.module'
import { BetaCodeModule } from '@/modules/beta-code/beta-code.module'
import { SettingsModule } from '@/modules/settings/settings.module'
import { ACGuard } from './guards/ac.guard'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { AuditLogService } from './services/audit-log.service'
import { PermissionService } from './services/permission.service'

function moduleImports(moduleType: Function): unknown[] {
  return Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleType) ?? []
}

function isForwardRefImport(moduleImport: unknown): boolean {
  return Boolean(
    moduleImport
    && typeof moduleImport === 'object'
    && 'forwardRef' in moduleImport
    && typeof (moduleImport as { forwardRef?: unknown }).forwardRef === 'function',
  )
}

describe('Auth/BetaCode/Settings module assembly', () => {
  it('uses plain module imports without forwardRef wrappers', () => {
    expect(moduleImports(AuthModule).some(isForwardRefImport)).toBe(false)
    expect(moduleImports(BetaCodeModule).some(isForwardRefImport)).toBe(false)
    expect(moduleImports(SettingsModule).some(isForwardRefImport)).toBe(false)
  })

  it('keeps a single dependency direction across the three modules', () => {
    expect(moduleImports(AuthModule)).toContain(BetaCodeModule)
    expect(moduleImports(BetaCodeModule)).toContain(SettingsModule)
    expect(moduleImports(SettingsModule)).not.toContain(AuthModule)
    expect(moduleImports(BetaCodeModule)).not.toContain(AuthModule)
  })

  it('keeps guarded admin modules wired to auth access providers without importing AuthModule', () => {
    expect(moduleImports(SettingsModule)).toContain(AuthAccessModule)
    expect(moduleImports(BetaCodeModule)).toContain(AuthAccessModule)
    expect(moduleImports(SettingsModule)).not.toContain(AuthModule)
    expect(moduleImports(BetaCodeModule)).not.toContain(AuthModule)
  })

  it('exports guards and services required by RequireAuth decorators', () => {
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, AuthAccessModule) ?? []

    expect(exports).toEqual(expect.arrayContaining([JwtAuthGuard, ACGuard, PermissionService, AuditLogService]))
  })
})

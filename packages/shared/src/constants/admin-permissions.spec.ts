import { ADMIN_PERMISSION } from './admin-permissions'

describe('admin beta code permissions', () => {
  it('defines read/create/update beta code permissions', () => {
    expect(ADMIN_PERMISSION.BETA_CODE.READ).toBe('ADMIN:BETA-CODE:READ')
    expect(ADMIN_PERMISSION.BETA_CODE.CREATE).toBe('ADMIN:BETA-CODE:CREATE')
    expect(ADMIN_PERMISSION.BETA_CODE.UPDATE).toBe('ADMIN:BETA-CODE:UPDATE')
  })
})

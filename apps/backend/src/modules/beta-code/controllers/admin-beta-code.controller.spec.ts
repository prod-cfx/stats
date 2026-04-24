import { PATH_METADATA } from '@nestjs/common/constants'
import { AdminBetaCodeController } from './admin-beta-code.controller'

describe('AdminBetaCodeController', () => {
  it('uses the admin beta-codes route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminBetaCodeController)).toEqual('admin/beta-codes')
  })
})

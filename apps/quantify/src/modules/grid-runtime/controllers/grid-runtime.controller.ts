import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common'
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { AccountStrategyCallerIdentityService } from '@/modules/account-strategy-view/services/account-strategy-caller-identity.service'
import { GridRuntimeActionDto, GridRuntimeFillDto, GridRuntimeInstanceDto, GridRuntimeOrderDto } from '../dto/grid-runtime.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridRuntimeService } from '../services/grid-runtime.service'

@ApiTags('grid-runtime')
@Controller('grid-runtime')
export class GridRuntimeController {
  constructor(
    private readonly service: GridRuntimeService,
    private readonly callerIdentityService: AccountStrategyCallerIdentityService,
  ) {}

  @Get('instances/:id')
  @ApiOperation({ summary: '获取当前用户的网格运行实例' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ description: '网格运行实例', type: GridRuntimeInstanceDto })
  async getInstance(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ) {
    const userId = await this.resolveUserId(authorization, forwardedUserId)
    return this.service.getInstanceForUser(userId, id)
  }

  @Get('instances/:id/orders')
  @ApiOperation({ summary: '获取当前用户网格运行实例的订单' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ description: '网格订单列表', type: [GridRuntimeOrderDto] })
  async listOrders(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ) {
    const userId = await this.resolveUserId(authorization, forwardedUserId)
    return this.service.listOrdersForUser(userId, id)
  }

  @Get('instances/:id/fills')
  @ApiOperation({ summary: '获取当前用户网格运行实例的成交' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ description: '网格成交列表', type: [GridRuntimeFillDto] })
  async listFills(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ) {
    const userId = await this.resolveUserId(authorization, forwardedUserId)
    return this.service.listFillsForUser(userId, id)
  }

  @Post('instances/:id/pause')
  @ApiOperation({ summary: '暂停当前用户的网格运行实例' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ description: '暂停后的网格运行实例', type: GridRuntimeInstanceDto })
  async pause(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ) {
    const userId = await this.resolveUserId(authorization, forwardedUserId)
    return this.service.pauseForUser(userId, id)
  }

  @Post('instances/:id/resume')
  @ApiOperation({ summary: '恢复当前用户的网格运行实例' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ description: '恢复后的网格运行实例', type: GridRuntimeInstanceDto })
  async resume(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ) {
    const userId = await this.resolveUserId(authorization, forwardedUserId)
    return this.service.resumeForUser(userId, id)
  }

  @Post('instances/:id/stop')
  @ApiOperation({ summary: '停止当前用户的网格运行实例' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ description: '停止后的网格运行实例', type: GridRuntimeInstanceDto })
  async stop(
    @Param('id') id: string,
    @Body() dto: GridRuntimeActionDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ) {
    const userId = await this.resolveUserId(authorization, forwardedUserId)
    return this.service.stopForUser(userId, id, dto.reason ?? 'user_stop')
  }

  @Post('instances/:id/reconcile')
  @ApiOperation({ summary: '标记当前用户的网格运行实例需要对账' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ description: '标记后的网格运行实例', type: GridRuntimeInstanceDto })
  async reconcile(
    @Param('id') id: string,
    @Body() dto: GridRuntimeActionDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ) {
    const userId = await this.resolveUserId(authorization, forwardedUserId)
    return this.service.markReconcileRequiredForUser(userId, id, dto.reason ?? 'user_reconcile')
  }

  private resolveUserId(authorization?: string, forwardedUserId?: string) {
    return this.callerIdentityService.resolveVerifiedCallerUserIdFromAuthorization(authorization, forwardedUserId)
  }
}

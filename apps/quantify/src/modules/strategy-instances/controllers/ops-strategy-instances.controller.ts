/* eslint-disable ts/consistent-type-imports -- NestJS 瑁呴グ鍣ㄩ渶瑕佽繍琛屾椂瀵煎叆浠ヤ繚鐣欑被鍨嬪厓鏁版嵁 */
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { SignalGeneratorService } from '@/modules/strategy-signals/services/signal-generator.service'

import { CreateStrategyInstanceDto } from '../dto/create-strategy-instance.dto'
import { StrategyInstanceListQueryDto } from '../dto/strategy-instance-list-query.dto'
import { StrategyInstanceResponseDto } from '../dto/strategy-instance-response.dto'
import { StrategyInstanceSubscriptionDetailsDto } from '../dto/strategy-instance-subscription-details.dto'
import { SubscriptionDetailsQueryDto } from '../dto/subscription-details-query.dto'
import {
  TestStrategyInstanceDto,
  TestStrategyInstanceResultDto,
} from '../dto/test-strategy-instance.dto'
import { UpdateStrategyInstanceDto } from '../dto/update-strategy-instance.dto'
import { StrategyInstancesService } from '../services/strategy-instances.service'

@ApiTags('ops/strategy-instances')
@ApiExtraModels(
  BasePaginationResponseDto,
  StrategyInstanceResponseDto,
  TestStrategyInstanceDto,
  TestStrategyInstanceResultDto,
)
@Controller('ops/strategy-instances')
export class OpsStrategyInstancesController {
  private readonly logger = new Logger(OpsStrategyInstancesController.name)

  constructor(
    private readonly instancesService: StrategyInstancesService,
    private readonly signalGenerator: SignalGeneratorService,
  ) {}

  @Post()
  @ApiOperation({ summary: '鍒涘缓绛栫暐瀹炰緥' })
  @ApiResponse({ status: 201, type: StrategyInstanceResponseDto })
  async create(
    @Body() dto: CreateStrategyInstanceDto,
  ): Promise<StrategyInstanceResponseDto> {
    return this.instancesService.createInstance(dto, dto.createdBy)
  }

  @Get()
  @ApiOperation({ summary: '鑾峰彇绛栫暐瀹炰緥鍒楄〃' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(StrategyInstanceResponseDto) },
            },
          },
        },
      ],
    },
  })
  async list(
    @Query() query: StrategyInstanceListQueryDto,
  ): Promise<BasePaginationResponseDto<StrategyInstanceResponseDto>> {
    return this.instancesService.listInstances(query)
  }

  @Get(':id/subscriptions')
  @ApiOperation({ summary: '鑾峰彇绛栫暐瀹炰緥璁㈤槄璇︽儏' })
  @ApiResponse({ status: 200, type: StrategyInstanceSubscriptionDetailsDto })
  async getSubscriptionDetails(
    @Param('id') id: string,
    @Query() query: SubscriptionDetailsQueryDto,
  ): Promise<StrategyInstanceSubscriptionDetailsDto> {
    return this.instancesService.getInstanceSubscriptionDetails(
      id,
      query.page,
      query.limit,
    )
  }

  @Get(':id')
  @ApiOperation({ summary: '鑾峰彇绛栫暐瀹炰緥璇︽儏' })
  @ApiResponse({ status: 200, type: StrategyInstanceResponseDto })
  async detail(@Param('id') id: string): Promise<StrategyInstanceResponseDto> {
    return this.instancesService.getInstanceDetail(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: '鏇存柊绛栫暐瀹炰緥' })
  @ApiResponse({ status: 200, type: StrategyInstanceResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStrategyInstanceDto,
  ): Promise<StrategyInstanceResponseDto> {
    return this.instancesService.updateInstance(id, dto, dto.updatedBy)
  }

  @Delete(':id')
  @ApiOperation({ summary: '鍒犻櫎绛栫暐瀹炰緥锛堜粎 draft 鐘舵€侊級' })
  @ApiResponse({ status: 200, description: '鍒犻櫎鎴愬姛' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.instancesService.deleteInstance(id)
  }

  @Get(':id/test-run/prefill')
  @ApiOperation({
    summary: '鑾峰彇瀹炰緥妫€鏌ラ粯璁よ姹備綋锛堝 Leg 澶氬懆鏈熻嚜鍔ㄥ～鍏咃級',
    description:
      '鏍规嵁绛栫暐妯℃澘鐨?legs 鍜?dataRequirements锛屼粠琛屾儏琛ㄤ腑鎷夊彇鏈€杩戜竴娈?K 绾挎暟鎹紝鎸?multiLegData 缁撴瀯杩斿洖锛屾柟渚胯皟鐢ㄦ柟蹇€熷～鍏呰皟璇曞弬鏁般€?,
  })
  @ApiResponse({ status: 200, type: TestStrategyInstanceDto })
  async buildTestPayload(@Param('id') id: string): Promise<TestStrategyInstanceDto> {
    return this.instancesService.buildTestPayload(id)
  }

  @Post(':id/test-run')
  @ApiOperation({
    summary: '涓诲姩瑙﹀彂绛栫暐瀹炰緥妫€鏌ワ紙璋冭瘯鐢紝涓嶄細浜х敓鐪熷疄淇″彿锛?,
    description:
      '鏍规嵁浼犲叆鐨勫競鍦烘暟鎹墽琛屽叧鑱旂瓥鐣ユā鏉跨殑鑴氭湰锛岃繑鍥炶剼鏈粨鏋滃強濉厖鍚庣殑 Prompt锛岀敤浜庢湰鍦拌皟璇曘€?,
  })
  @ApiResponse({ status: 200, type: TestStrategyInstanceResultDto })
  async testRun(
    @Param('id') id: string,
    @Body() dto: TestStrategyInstanceDto,
  ): Promise<TestStrategyInstanceResultDto> {
    return this.instancesService.testInstance(id, dto)
  }

  @Post(':id/generate-signal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '鎵嬪姩瑙﹀彂绛栫暐瀹炰緥淇″彿鐢熸垚',
    description:
      '鎵嬪姩瑙﹀彂鎸囧畾绛栫暐瀹炰緥鐨勪俊鍙风敓鎴愭祦绋嬨€備細鏍规嵁褰撳墠甯傚満鏁版嵁鎵ц绛栫暐鑴氭湰銆佽皟鐢?AI 骞剁敓鎴愮湡瀹炰氦鏄撲俊鍙枫€? +
      '鐢ㄤ簬娴嬭瘯鎴栫揣鎬ユ儏鍐典笅鎵嬪姩瑙﹀彂淇″彿鐢熸垚銆?,
  })
  @ApiResponse({
    status: 200,
    description: '淇″彿鐢熸垚浠诲姟宸茶Е鍙?,
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: '淇″彿鐢熸垚浠诲姟宸茶Е鍙? },
        instanceId: { type: 'string', example: 'cmioxy4yg03zl3eh8gzvaaimd' },
      },
    },
  })
  async generateSignal(@Param('id') id: string): Promise<{ message: string; instanceId: string }> {
    this.logger.log(`杩愯惀鎺ュ彛鎵嬪姩瑙﹀彂绛栫暐瀹炰緥 ${id} 鐨勪俊鍙风敓鎴恅)

    // 鍦ㄨ繑鍥炲墠鍚屾楠岃瘉鎵€鏈夊繀椤绘潯浠讹紙status銆乵ode銆乼emplate銆乧onfig 绛夛級
    // 閬垮厤鏃犳晥瀹炰緥/绂佺敤閰嶇疆涓嬭鎶ユ垚鍔燂紝纭繚璋冪敤鏂硅幏寰楀噯纭殑閿欒鍙嶉
    try {
      await this.signalGenerator.validateManualTriggerTarget(id)
    }
    catch (error) {
      const message = (error as Error).message
      this.logger.warn(`鎵嬪姩瑙﹀彂楠岃瘉澶辫触: ${message}`)

      // 灏嗛獙璇侀敊璇槧灏勪负閫傚綋鐨?HTTP 鐘舵€佺爜
      if (message.includes('not found')) {
        throw new NotFoundException(message)
      }
      if (message.includes('disabled via configuration')) {
        throw new BadRequestException('淇″彿鐢熸垚鍔熻兘宸茬鐢紝璇锋鏌ラ厤缃?(STRATEGY_SIGNALS_ENABLED)')
      }
      throw new BadRequestException(message)
    }

    // 楠岃瘉閫氳繃鍚庯紝寮傛瑙﹀彂淇″彿鐢熸垚锛堜笉闃诲 AI 璋冪敤锛夛紝鎵嬪姩瑙﹀彂鏃惰烦杩?cooldown 妫€鏌?
    setImmediate(() => {
      this.signalGenerator.generateSignalForInstance(id, { skipCooldown: true }).catch(error => {
        this.logger.error(`鎵嬪姩瑙﹀彂瀹炰緥 ${id} 淇″彿鐢熸垚澶辫触: ${error.message}`, error.stack)
      })
    })

    return {
      message: '淇″彿鐢熸垚浠诲姟宸茶Е鍙戯紝璇风◢鍚庢煡鐪嬩俊鍙峰垪琛?,
      instanceId: id,
    }
  }
}

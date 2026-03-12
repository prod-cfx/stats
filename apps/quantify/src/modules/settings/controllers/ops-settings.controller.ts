import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common'
import {
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'

import { BaseResponseDto } from '@/common/dto/base.dto'
import { CreateSettingDto } from '../dto/requests/create-setting.dto'
import { UpdateSettingDto } from '../dto/requests/update-setting.dto'
import { SettingResponseDto } from '../dto/responses/setting.response.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { SettingsService } from '../services/settings.service'
import { maskSettingValue } from '../utils/mask.util'

@ApiTags('ops-settings')
@Controller('ops/settings')
@ApiExtraModels(BaseResponseDto, SettingResponseDto)
export class OpsSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: '鎸夊垎绫荤瓫閫夐厤缃紙鍙€夛紝涓嶄紶鍒欒繑鍥炴墍鏈夐厤缃級',
  })
  @ApiOperation({ summary: '鑾峰彇鎵€鏈夐厤缃紙杩愯惀鎺ュ彛锛? })
  @ApiResponse({
    status: 200,
    description: '鎴愬姛鑾峰彇閰嶇疆鍒楄〃',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(SettingResponseDto) },
        },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async getAllSettings(@Query('category') category?: string): Promise<SettingResponseDto[]> {
    const settings = category
      ? await this.settingsService.getSettingsByCategory(category)
      : await this.settingsService.getAllSettings()
    // 瀵规晱鎰熷瓧娈佃繘琛岃劚鏁?
    return settings.map(
      setting =>
        new SettingResponseDto({
          ...setting,
          value: maskSettingValue(setting.key, setting.type, setting.value),
        }),
    )
  }

  @Post()
  @ApiOperation({ summary: '鍒涘缓閰嶇疆锛堣繍钀ユ帴鍙ｏ級' })
  @ApiBody({ type: CreateSettingDto })
  @ApiResponse({
    status: 201,
    description: '鎴愬姛鍒涘缓閰嶇疆',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(SettingResponseDto) },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async createSetting(@Body() dto: CreateSettingDto): Promise<SettingResponseDto> {
    const setting = await this.settingsService.set(dto.key, dto.value, {
      type: dto.type,
      description: dto.description,
      category: dto.category,
      isSystem: dto.isSystem,
    })
    return new SettingResponseDto({
      ...setting,
      value: maskSettingValue(setting.key, setting.type, setting.value),
    })
  }

  @Put(':key')
  @ApiOperation({ summary: '鏇存柊閰嶇疆锛堣繍钀ユ帴鍙ｏ級' })
  @ApiBody({ type: UpdateSettingDto })
  @ApiResponse({
    status: 200,
    description: '鎴愬姛鏇存柊閰嶇疆',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(SettingResponseDto) },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ): Promise<SettingResponseDto> {
    const setting = await this.settingsService.set(key, dto.value, {
      type: dto.type,
      description: dto.description,
      category: dto.category,
      isSystem: dto.isSystem,
    })
    return new SettingResponseDto({
      ...setting,
      value: maskSettingValue(setting.key, setting.type, setting.value),
    })
  }

  @Patch('reload')
  @ApiOperation({ summary: '閲嶆柊鍔犺浇鎵€鏈夐厤缃紙杩愯惀鎺ュ彛锛? })
  @ApiResponse({
    status: 200,
    description: '鎴愬姛閲嶆柊鍔犺浇閰嶇疆',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
          },
        },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  @HttpCode(200)
  async reloadSettings(): Promise<{ success: boolean }> {
    await this.settingsService.loadAllSettings()
    return { success: true }
  }
}

import { Transactional } from '@nestjs-cls/transactional'
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
    description: '按分类筛选配置（可选，不传则返回所有配置）',
  })
  @ApiOperation({ summary: '获取所有配置（运营接口）' })
  @ApiResponse({
    status: 200,
    description: '成功获取配置列表',
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
    // 对敏感字段进行脱敏
    return settings.map(
      setting =>
        new SettingResponseDto({
          ...setting,
          value: maskSettingValue(setting.key, setting.type, setting.value),
        }),
    )
  }

  @Transactional()
  @Post()
  @ApiOperation({ summary: '创建配置（运营接口）' })
  @ApiBody({ type: CreateSettingDto })
  @ApiResponse({
    status: 201,
    description: '成功创建配置',
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

  @Transactional()
  @Put(':key')
  @ApiOperation({ summary: '更新配置（运营接口）' })
  @ApiBody({ type: UpdateSettingDto })
  @ApiResponse({
    status: 200,
    description: '成功更新配置',
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

  @Transactional()
  @Patch('reload')
  @ApiOperation({ summary: '重新加载所有配置（运营接口）' })
  @ApiResponse({
    status: 200,
    description: '成功重新加载配置',
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

import { ApiProperty } from '@nestjs/swagger'

interface SettingData {
  id?: string
  key: string
  value: string
  type: string
  description?: string
  category?: string
  isSystem?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export class SettingResponseDto {
  @ApiProperty({ description: '配置ID' })
    id: string

  @ApiProperty({ description: '配置键名' })
    key: string

  @ApiProperty({ description: '配置值' })
    value: string

  @ApiProperty({ description: '值类型' })
    type: string

  @ApiProperty({ description: '配置描述' })
    description?: string

  @ApiProperty({ description: '配置分类' })
    category: string

  @ApiProperty({ description: '是否系统配置' })
    isSystem: boolean

  @ApiProperty({ description: '创建时间' })
    createdAt: Date

  @ApiProperty({ description: '更新时间' })
    updatedAt: Date

  constructor(setting: SettingData) {
    this.id = setting.id || ''
    this.key = setting.key
    this.value = setting.value
    this.type = setting.type
    this.description = setting.description
    this.category = setting.category || 'general'
    this.isSystem = setting.isSystem || false
    this.createdAt = setting.createdAt || new Date()
    this.updatedAt = setting.updatedAt || new Date()
  }
}


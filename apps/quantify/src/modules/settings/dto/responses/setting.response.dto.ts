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
  @ApiProperty({ description: '閰嶇疆ID' })
    id: string

  @ApiProperty({ description: '閰嶇疆閿悕' })
    key: string

  @ApiProperty({ description: '閰嶇疆鍊? })
    value: string

  @ApiProperty({ description: '鍊肩被鍨? })
    type: string

  @ApiProperty({ description: '閰嶇疆鎻忚堪' })
    description?: string

  @ApiProperty({ description: '閰嶇疆鍒嗙被' })
    category: string

  @ApiProperty({ description: '鏄惁绯荤粺閰嶇疆' })
    isSystem: boolean

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
    createdAt: Date

  @ApiProperty({ description: '鏇存柊鏃堕棿' })
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

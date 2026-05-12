import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateExternalSignalWebhookSubscriptionDto {
  @ApiPropertyOptional({ example: 'tradingview' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string

  @ApiProperty({ example: 'BTC_PERP_LONG_01' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  signalId!: string

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}

export class ExternalSignalWebhookSubscriptionResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  userId!: string

  @ApiProperty()
  strategyInstanceId!: string

  @ApiPropertyOptional()
  provider?: string | null

  @ApiProperty()
  signalId!: string

  @ApiProperty()
  secretVersion!: number

  @ApiProperty()
  status!: string

  @ApiPropertyOptional()
  lastAcceptedAt?: string | null

  @ApiPropertyOptional()
  rotatedAt?: string | null

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata?: Record<string, unknown> | null

  @ApiProperty()
  webhookUrl!: string

  @ApiProperty()
  createdAt!: string

  @ApiProperty()
  updatedAt!: string
}

export class ExternalSignalWebhookSubscriptionSecretResponseDto extends ExternalSignalWebhookSubscriptionResponseDto {
  @ApiProperty({
    description: 'Plaintext signing secret. Returned only immediately after create or rotate.',
  })
  secret!: string
}

export class ExternalSignalWebhookAcceptedResponseDto {
  @ApiProperty({ example: true })
  accepted!: boolean

  @ApiProperty()
  eventId!: string
}

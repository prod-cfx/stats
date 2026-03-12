import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { StrategyInstanceMode } from '@prisma/client'
import { IsEnum, IsJSON, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateStrategyInstanceDto {
  @ApiProperty({ description: '绛栫暐妯℃澘 ID' })
  @IsString()
  @IsNotEmpty()
  strategyTemplateId: string

  @ApiProperty({ description: '瀹炰緥鍚嶇О' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ description: '瀹炰緥鎻忚堪', required: false })
  @IsString()
  @IsOptional()
  description?: string

  @ApiProperty({ description: 'LLM 妯″瀷', example: 'gpt-4' })
  @IsString()
  @IsNotEmpty()
  llmModel: string

  @ApiProperty({
    description: '杩愯妯″紡锛欱ACKTEST=鍘嗗彶鍥炴祴锛堜娇鐢ㄥ巻鍙叉暟鎹祴璇曠瓥鐣ワ級锛孭APER=绾镐笂浜ゆ槗锛堜娇鐢ㄥ疄鏃舵暟鎹ā鎷熶氦鏄擄級锛孴ESTNET=娴嬭瘯缃戜氦鏄擄紙鍦ㄦ祴璇曠綉缁滄墽琛岀湡瀹炰氦鏄擄級锛孡IVE=瀹炵洏浜ゆ槗锛堝湪涓荤綉鎵ц鐪熷疄浜ゆ槗锛夈€傛湭鎸囧畾鏃舵暟鎹簱榛樿涓?PAPER',
    enum: StrategyInstanceMode,
    required: false,
    example: 'PAPER',
    examples: {
      backtest: {
        value: 'BACKTEST',
        summary: '鍘嗗彶鍥炴祴',
        description: '浣跨敤鍘嗗彶鏁版嵁杩涜绛栫暐鍥炴祴锛屼笉鎵ц鐪熷疄浜ゆ槗锛岄€傚悎绛栫暐寮€鍙戝拰浼樺寲'
      },
      paper: {
        value: 'PAPER',
        summary: '绾镐笂浜ゆ槗',
        description: '浣跨敤瀹炴椂甯傚満鏁版嵁妯℃嫙浜ゆ槗锛屼笉鎵ц鐪熷疄璁㈠崟锛岄€傚悎绛栫暐楠岃瘉'
      },
      testnet: {
        value: 'TESTNET',
        summary: '娴嬭瘯缃戜氦鏄?,
        description: '鍦ㄦ祴璇曠綉缁滄墽琛岀湡瀹炰氦鏄擄紝浣跨敤娴嬭瘯浠ｅ竵锛岄€傚悎涓婄嚎鍓嶆祴璇?
      },
      live: {
        value: 'LIVE',
        summary: '瀹炵洏浜ゆ槗',
        description: '鍦ㄤ富缃戞墽琛岀湡瀹炰氦鏄擄紝浣跨敤鐪熷疄璧勯噾锛岃璋ㄦ厧浣跨敤'
      },
    }
  })
  @IsEnum(StrategyInstanceMode)
  @IsOptional()
  mode?: StrategyInstanceMode

  @ApiProperty({ description: '瀹炰緥鍙傛暟锛圝SON 鏍煎紡锛?, required: false })
  @IsJSON()
  @IsOptional()
  params?: Record<string, unknown>

  @ApiProperty({ description: '鍏冩暟鎹紙JSON 鏍煎紡锛?, required: false })
  @IsJSON()
  @IsOptional()
  metadata?: Record<string, unknown>

  @ApiPropertyOptional({ description: '鍒涘缓浜烘爣璇?, example: 'system-operator' })
  @IsString()
  @IsOptional()
  createdBy?: string
}

import type { PipeTransform } from '@nestjs/common'
import { BadRequestException, Injectable } from '@nestjs/common'

/**
 * 以太坊地址格式验证正则表达式
 * 格式：0x 开头 + 40 个十六进制字符
 */
const ETHEREUM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

/**
 * 以太坊地址验证 Pipe
 *
 * 验证传入的地址参数是否为合法的以太坊地址格式（42 字符十六进制）
 *
 * @example
 * ```typescript
 * @Get('traders/:address/snapshot')
 * async getTraderSnapshot(
 *   @Param('address', EthereumAddressPipe) address: string,
 * ) { ... }
 * ```
 */
@Injectable()
export class EthereumAddressPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException('Address parameter is required')
    }

    const trimmed = value.trim()

    if (!ETHEREUM_ADDRESS_REGEX.test(trimmed)) {
      throw new BadRequestException(
        `Invalid Ethereum address format: "${trimmed}". Expected format: 0x followed by 40 hexadecimal characters`,
      )
    }

    // 返回标准化的小写地址（以太坊地址大小写不敏感）
    return trimmed.toLowerCase()
  }
}

import * as crypto from 'node:crypto'

export interface BbxSignatureParams {
  accessKeyId: string
  accessSecret: string
  timestamp?: number
  nonce?: string
}

export interface BbxAuthHeaders {
  AccessKeyId: string
  SignatureNonce: string
  Timestamp: string
  Signature: string
}

/**
 * BBX API 签名生成器
 *
 * 签名算法：HMAC-SHA1 + Base64
 * 签名字符串格式：AccessKeyId={accessKeyId}&SignatureNonce={nonce}&Timestamp={timestamp}
 * 时间戳有效期：30 秒
 */
export class BbxSigner {
  private readonly accessKeyId: string
  private readonly accessSecret: string

  constructor(accessKeyId: string, accessSecret: string) {
    this.accessKeyId = accessKeyId
    this.accessSecret = accessSecret
  }

  /**
   * 生成签名认证所需的请求头参数
   */
  generateAuthHeaders(timestamp?: number, nonce?: string): BbxAuthHeaders {
    const ts = timestamp ?? Math.floor(Date.now() / 1000)
    const signatureNonce = nonce ?? this.generateNonce()

    const signatureString = `AccessKeyId=${this.accessKeyId}&SignatureNonce=${signatureNonce}&Timestamp=${ts}`
    const signature = this.sign(signatureString)

    return {
      AccessKeyId: this.accessKeyId,
      SignatureNonce: signatureNonce,
      Timestamp: String(ts),
      Signature: signature,
    }
  }

  /**
   * 使用 HMAC-SHA1 生成签名
   * 步骤：HMAC-SHA1 -> 十六进制 -> 作为二进制数据 Base64 编码
   */
  private sign(message: string): string {
    const hmac = crypto.createHmac('sha1', this.accessSecret)
    hmac.update(message)
    const hexSignature = hmac.digest('hex')
    // 将十六进制字符串作为二进制数据进行 Base64 编码
    return Buffer.from(hexSignature, 'binary').toString('base64')
  }

  /**
   * 生成随机 nonce
   */
  private generateNonce(): string {
    return crypto.randomUUID().replace(/-/g, '')
  }
}

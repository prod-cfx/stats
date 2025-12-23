import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'

import { EnvService } from '@/common/services/env.service'

const AES_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

@Injectable()
export class ConfigCryptoService {
  private readonly key: Buffer

  constructor(
    @Inject(EnvService)
    private readonly envService: EnvService,
  ) {
    this.key = this.resolveKey()
  }

  encryptConfig<T>(payload: T): string {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(AES_ALGORITHM, this.key, iv)
    const json = JSON.stringify(payload)
    const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return Buffer.concat([iv, authTag, encrypted]).toString('base64')
  }

  decryptConfig<T>(cipherText: string): T {
    const buffer = Buffer.from(cipherText, 'base64')
    if (buffer.length <= IV_LENGTH + AUTH_TAG_LENGTH)
      throw new Error('Invalid cipher text payload')

    const iv = buffer.subarray(0, IV_LENGTH)
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = createDecipheriv(AES_ALGORITHM, this.key, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return JSON.parse(decrypted.toString('utf8')) as T
  }

  private resolveKey(): Buffer {
    const rawKey = this.envService.getString('EXCHANGE_ACCOUNT_CRYPTO_KEY')
    if (!rawKey || !rawKey.trim())
      throw new Error('Missing EXCHANGE_ACCOUNT_CRYPTO_KEY')

    const normalized = rawKey.trim()
    const buffer = this.decodeKey(normalized)
    if (buffer.length !== 32)
      throw new Error('EXCHANGE_ACCOUNT_CRYPTO_KEY must decode to 32 bytes for AES-256-GCM')
    return buffer
  }

  private decodeKey(value: string): Buffer {
    const hexPattern = /^[0-9a-f]+$/i
    if (hexPattern.test(value) && value.length === 64)
      return Buffer.from(value, 'hex')
    return Buffer.from(value, 'base64')
  }
}




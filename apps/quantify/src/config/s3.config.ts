import { registerAs } from '@nestjs/config'
import { defaultEnvAccessor } from '../common/env/env.accessor'

const env = defaultEnvAccessor

export const s3Config = registerAs('s3', () => ({
  accessKey: env.str('S3_ACCESS_KEY'),
  secretId: env.str('S3_SECRET_ID'),
  secretKey: env.str('S3_SECRET_KEY'),
  bucketName: env.str('S3_BUCKET_NAME'),
  endpoint: env.str('S3_ENDPOINT'),
  region: env.str('S3_REGION', ''),
  cdnDomain: env.str('S3_CDN_DOMAIN', ''),
  presignedUrlExpiration: env.int('S3_PRESIGNED_URL_EXPIRATION', 300),
}))

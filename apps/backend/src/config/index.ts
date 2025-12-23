import { backendConfigLoaders } from './configuration'
import { s3Config } from './s3.config'
export * from './configuration'
export * from './s3.config'
export const allConfigLoaders = [
  ...backendConfigLoaders,
  s3Config,
]


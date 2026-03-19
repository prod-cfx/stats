import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadFile } from 'dotenv'
import { expand } from 'dotenv-expand'
import { z } from 'zod'

const schema = z.object({
    APP_ENV: z.enum(['development', 'staging', 'production', 'e2e']),
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().default(3000),
    FRONTEND_URL: z.string().url().optional(),
    FRONTEND_REDIRECT_ORIGINS: z
        .string()
        .optional()
        .transform(value => (value ? value.split(',').map(origin => origin.trim()) : [])),
    NEXT_PUBLIC_API_SERVER_URL: z.string().optional(),
})

export type AppEnv = z.infer<typeof schema>

const load = (filePath: string) => {
    if (!existsSync(filePath)) return
    const result = loadFile({ path: filePath, override: true })
    expand(result)
}

export const loadEnvironment = (options: { path?: string; env?: string; basePath?: string } = {}) => {
    if (options.path) {
        load(resolve(options.path))
    } else {
        const envName = options.env ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development'
        const baseDir = options.basePath ?? process.cwd()
        console.log(`[loadEnvironment] envName: ${envName}, basePath: ${baseDir}`)
        const candidates = [
            `.env.${envName}`,
            `.env.${envName}.local`,
            '.env',
            '.env.local',
        ]
        candidates.forEach(file => {
            const fullPath = resolve(baseDir, file)
            console.log(`[loadEnvironment] loading ${file} from ${fullPath}`)
            load(fullPath)
        })
        console.log(`[loadEnvironment] APP_ENV after loading: ${process.env.APP_ENV}`)
    }

    const parsed = schema.safeParse(process.env)
    if (!parsed.success) {
        console.error(`[loadEnvironment] Validation failed. process.env.APP_ENV = ${process.env.APP_ENV}`)
        throw new Error(`环境变量校验失败: ${parsed.error.message}`)
    }
    return parsed.data
}

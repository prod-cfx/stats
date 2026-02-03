import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

function loadSharedEnvironment() {
  const pkgPath = require.resolve('@net/config/package.json')
  const pkgDir = dirname(pkgPath)
  const distEntry = resolve(pkgDir, 'dist/index.js')

  let loadEnvironmentFn
  if (existsSync(distEntry)) {
    ;({ loadEnvironment: loadEnvironmentFn } = require(distEntry))
  } else {
    require('ts-node/register/transpile-only')
    ;({ loadEnvironment: loadEnvironmentFn } = require(resolve(pkgDir, 'src/index.ts')))
  }

  const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
  const previousCwd = process.cwd()

  // Next.js 16+ uses Turbopack workers where process.chdir() is not supported
  let cwdChanged = false
  if (previousCwd !== repoRoot) {
    try {
      process.chdir(repoRoot)
      cwdChanged = true
    } catch {
      // Ignore ERR_WORKER_UNSUPPORTED_OPERATION in Turbopack workers
      // Environment will be loaded from the current working directory
    }
  }

  try {
    loadEnvironmentFn()
  } finally {
    if (cwdChanged) {
      try {
        process.chdir(previousCwd)
      } catch {
        // Ignore errors when restoring directory
      }
    }
  }
}

loadSharedEnvironment()

const distDir = process.env.NODE_ENV === 'production' ? '../../dist/admin-front' : undefined

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(distDir ? { distDir } : {}),
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  // output: 'export',  // 已禁用静态导出，使用 next start
  // trailingSlash: false,
  transpilePackages: ['@ai/shared', '@ai/api-contracts'],
  experimental: {
    optimizePackageImports: ['@ai/shared', '@ai/api-contracts'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    const apiServer = (process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:3000').replace(
      /\/$/,
      '',
    )
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiServer}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig

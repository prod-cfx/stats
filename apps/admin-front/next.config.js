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
  }
  else {
    require('ts-node/register/transpile-only')
    ;({ loadEnvironment: loadEnvironmentFn } = require(resolve(pkgDir, 'src/index.ts')))
  }

  const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
  const previousCwd = process.cwd()
  if (previousCwd !== repoRoot) {
    process.chdir(repoRoot)
  }
  try {
    loadEnvironmentFn()
  }
  finally {
    if (process.cwd() !== previousCwd) {
      process.chdir(previousCwd)
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
  trailingSlash: false,
  transpilePackages: ['@ai/shared', '@ai/api-contracts'],
  experimental: {
    optimizePackageImports: ['@ai/shared', '@ai/api-contracts'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig

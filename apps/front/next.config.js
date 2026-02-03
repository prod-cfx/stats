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

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production'

const nextConfig = {
  // 设置构建输出目录
  // 生产构建产物需要输出到 dist/front/.next（用于Vercel部署/打包）
  // Vercel 的构建输出 API 在 outputDirectory 中查找 .next/trace 文件
  // 当 distDir 设置为 ../../dist/front/.next 时，Next.js 会在 dist/front 下创建 .next 子目录
  // Vercel 可以正确找到 dist/front/.next/trace，避免重新追踪导致的文件膨胀问题
  // 但开发模式下使用 distDir=dist/front/.next 会导致缓存/文件缺失问题（vendor-chunks、manifest 等）
  // 因此开发模式回退到默认 .next，确保 `next dev` 稳定运行。
  distDir: isDev ? '.next' : '../../dist/front/.next',

  images: {
    unoptimized: true, // 静态导出下禁用 Next.js 内置图片优化，改用懒加载与占位符
    formats: ['image/avif', 'image/webp'], // 支持现代图片格式
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ext.same-assets.com',
      },
      {
        protocol: 'https',
        hostname: 'source.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'ugc.same-assets.com',
      },
      {
        protocol: 'https',
        hostname: 'random.imagecdn.app',
      },
      // 添加 CDN 域名支持
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_CDN_DOMAIN || 'cdn.example.com',
      },
      // 新增的域名
      {
        protocol: 'https',
        hostname: 'prod.ugirl.ai',
      },
      {
        protocol: 'https',
        hostname: 'development-file.tang-bao.com',
      },
    ],
  },
  // Help with hydration errors
  reactStrictMode: false,

  // 使用服务端渲染模式，通过 next start 运行
  // output: 'export',  // 已禁用静态导出

  // trailingSlash: true,  // 服务端渲染模式下不需要

  // 优化配置，明确指定需要转译的本地包
  transpilePackages: ['@ai/shared', '@ai/api-contracts'],
  webpack: config => {
    // 解决 @ai/shared 引入问题
    config.resolve.alias = {
      ...config.resolve.alias,
      '@ai/shared': require.resolve('@ai/shared'),
      '@ai/api-contracts': require.resolve('@ai/api-contracts'),
    }
    return config
  },

  // Next.js 16: Cache Components 配置
  // 官方文档: https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents
  // 启用 Cache Components 功能,配合 "use cache" 指令使用
  // 注意: 当前 Next.js 15.4.7 不支持此选项，需升级到 Next.js 16+ 才能启用
  // cacheComponents: true,

  // Reduce Vercel serverless function size by excluding unnecessary traced files
  // Issue: .vercel/output/functions/404.func/.vc-config.json traced 284 MB (exceeds 250 MB limit)
  // Root cause: sharp binaries for multiple platforms (win32, darwin, linux, linuxmusl, wasm, etc.)
  // and Next.js source maps included in trace
  // Strategy: use outputFileTracingExcludes to exclude platform-specific sharp binaries and source maps
  // that are only needed for non-Vercel platforms (win32, darwin, non-arm64 linux)
  outputFileTracingExcludes: {
    '/*': [
      // Windows/win32 sharp binaries - not used on Vercel Linux
      '**/@img+sharp-win32-arm64*/**/*',
      '**/@img+sharp-win32-ia32*/**/*',
      '**/@img+sharp-win32-x64*/**/*',
      // macOS/darwin sharp binaries - not used on Vercel Linux
      '**/@img+sharp-darwin-arm64*/**/*',
      '**/@img+sharp-darwin-x64*/**/*',
      '**/@img+sharp-libvips-darwin-arm64*/**/*',
      '**/@img+sharp-libvips-darwin-x64*/**/*',
      // Non-ARM64 Linux architectures (Vercel uses linux-arm64, not x64/ppc64/etc)
      '**/@img+sharp-linuxmusl-arm64*/**/*',
      '**/@img+sharp-linuxmusl-x64*/**/*',
      '**/@img+sharp-libvips-linuxmusl-arm64*/**/*',
      '**/@img+sharp-libvips-linuxmusl-x64*/**/*',
      '**/@img+sharp-libvips-linux-ppc64*/**/*',
      '**/@img+sharp-libvips-linux-riscv64*/**/*',
      '**/@img+sharp-libvips-linux-s390x*/**/*',
      '**/@img+sharp-libvips-linux-x64*/**/*', // keep only arm64
      '**/@img+sharp-libvips-linux-arm*/**/*',
      '**/@img+sharp-linux-ppc64*/**/*',
      '**/@img+sharp-linux-riscv64*/**/*',
      '**/@img+sharp-linux-s390x*/**/*',
      '**/@img+sharp-linux-x64*/**/*', // keep only arm64
      '**/@img+sharp-linux-arm*/**/*',
      // WASM sharp - not used at runtime
      '**/@img+sharp-wasm32*/**/*',
      // Additional patterns for pnpm nested node_modules structure (@img inside sharp package)
      // Pattern: node_modules/.pnpm/sharp@*/node_modules/@img/*
      // Windows/win32 sharp binaries nested in pnpm
      '**/node_modules/@img/sharp-win32-arm64*/**/*',
      '**/node_modules/@img/sharp-win32-ia32*/**/*',
      '**/node_modules/@img/sharp-win32-x64*/**/*',
      // macOS/darwin sharp binaries nested in pnpm
      '**/node_modules/@img/sharp-darwin-arm64*/**/*',
      '**/node_modules/@img/sharp-darwin-x64*/**/*',
      '**/node_modules/@img/sharp-libvips-darwin-arm64*/**/*',
      '**/node_modules/@img/sharp-libvips-darwin-x64*/**/*',
      // Non-ARM64 Linux architectures nested in pnpm
      '**/node_modules/@img/sharp-linuxmusl-arm64*/**/*',
      '**/node_modules/@img/sharp-linuxmusl-x64*/**/*',
      '**/node_modules/@img/sharp-libvips-linuxmusl-arm64*/**/*',
      '**/node_modules/@img/sharp-libvips-linuxmusl-x64*/**/*',
      '**/node_modules/@img/sharp-libvips-linux-ppc64*/**/*',
      '**/node_modules/@img/sharp-libvips-linux-riscv64*/**/*',
      '**/node_modules/@img/sharp-libvips-linux-s390x*/**/*',
      '**/node_modules/@img/sharp-libvips-linux-x64*/**/*', // keep only arm64
      '**/node_modules/@img/sharp-libvips-linux-arm*/**/*',
      '**/node_modules/@img/sharp-linux-ppc64*/**/*',
      '**/node_modules/@img/sharp-linux-riscv64*/**/*',
      '**/node_modules/@img/sharp-linux-s390x*/**/*',
      '**/node_modules/@img/sharp-linux-x64*/**/*', // keep only arm64
      '**/node_modules/@img/sharp-linux-arm*/**/*',
      // WASM sharp nested in pnpm
      '**/node_modules/@img/sharp-wasm32*/**/*',
      // Source maps - not needed in production bundles
      '**/dist/compiled/next-server/**/*.map',
    ],
  },

  // Next.js 16: 实验性功能配置
  experimental: {
    // Next.js 16: clientRouterFilter 已废弃,已移除
    // 列出需要优化导入的包 (包含本地包)
    optimizePackageImports: ['@ai/shared', '@ai/api-contracts'],
  },

  // 暂时忽略 TypeScript 构建错误，待后续统一类型解决
  typescript: {
    ignoreBuildErrors: true,
  },

  // Next.js 16: Turbopack 配置
  // 空配置用于告诉 Next.js "我知道有 webpack 配置,但我想使用 Turbopack"
  // 这样可以避免 "This build is using Turbopack, with a `webpack` config" 错误
  turbopack: {},

  // 重定向配置：处理废弃路由
  async rewrites() {
    // Proxy API calls in dev to local backend (avoid CORS + 404 from Next).
    // When backend is not available or returns empty data, front-end components
    // should fall back to mock data in development.
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

  async redirects() {
    return [
      {
        source: '/1',
        destination: '/characters?tab=recommended',
        permanent: true, // 301 永久重定向，保留 SEO 权重
      },
    ]
  },
}

export default nextConfig

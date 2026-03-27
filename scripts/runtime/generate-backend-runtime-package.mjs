#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const options = {
  appPackage: 'apps/backend/package.json',
  rootPackage: 'package.json',
  output: '',
  includePrisma: false,
  includePackageManager: false,
  includePnpm: false,
  dotenvVersion: '^8.0.0',
  prismaVersion: '^7.0.0',
};

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--app-package') {
    options.appPackage = argv[++i] ?? '';
  } else if (arg === '--root-package') {
    options.rootPackage = argv[++i] ?? '';
  } else if (arg === '--output') {
    options.output = argv[++i] ?? '';
  } else if (arg === '--include-prisma') {
    options.includePrisma = true;
  } else if (arg === '--include-package-manager') {
    options.includePackageManager = true;
  } else if (arg === '--include-pnpm') {
    options.includePnpm = true;
  } else if (arg === '--dotenv-version') {
    options.dotenvVersion = argv[++i] ?? options.dotenvVersion;
  } else if (arg === '--prisma-version') {
    options.prismaVersion = argv[++i] ?? options.prismaVersion;
  } else if (arg === '-h' || arg === '--help') {
    console.log('用法: node scripts/runtime/generate-backend-runtime-package.mjs --output <path> [--app-package <path>] [--root-package <path>] [--include-prisma] [--include-package-manager] [--include-pnpm]');
    process.exit(0);
  } else {
    console.error(`未知参数: ${arg}`);
    process.exit(1);
  }
}

if (!options.output) {
  console.error('缺少必填参数: --output');
  process.exit(1);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const appPkg = readJson(options.appPackage);
const rootPkg = fs.existsSync(options.rootPackage) ? readJson(options.rootPackage) : {};

const appDeps = appPkg.dependencies ?? {};
const appDevDeps = appPkg.devDependencies ?? {};
const rootDevDeps = rootPkg.devDependencies ?? {};
const dependencies = { ...appDeps };

for (const [name, version] of Object.entries(dependencies)) {
  if (String(version).startsWith('workspace:')) {
    delete dependencies[name];
  }
}

dependencies['dotenv-cli'] =
  dependencies['dotenv-cli'] ??
  appDevDeps['dotenv-cli'] ??
  rootDevDeps['dotenv-cli'] ??
  options.dotenvVersion;

if (options.includePrisma) {
  dependencies.prisma =
    dependencies.prisma ??
    appDevDeps.prisma ??
    rootDevDeps.prisma ??
    options.prismaVersion;
}

const runtimePackage = {
  type: 'commonjs',
  name: appPkg.name ?? '@ai/backend',
  version: appPkg.version ?? '0.0.0',
  private: true,
  dependencies,
};

if (options.includePackageManager && rootPkg.packageManager) {
  runtimePackage.packageManager = rootPkg.packageManager;
}
if (options.includePnpm && rootPkg.pnpm) {
  runtimePackage.pnpm = rootPkg.pnpm;
}

const outputDir = path.dirname(options.output);
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(options.output, `${JSON.stringify(runtimePackage, null, 2)}\n`);

import * as fs from 'node:fs'
import * as path from 'node:path'

export interface EnumMember {
  key: string
  value: string
}

export interface ParsedEnum {
  name: string
  source: 'backend' | 'quantify'
  members: EnumMember[]
}

/**
 * Parse all enum blocks from a .prisma file content.
 * Uses Prisma key as member name (ignores @map values).
 */
export function parsePrismaEnums(content: string, source: 'backend' | 'quantify'): ParsedEnum[] {
  const enumRegex = /enum\s+(\w+)\s*\{([\s\S]*?)\n\}/g
  const results: ParsedEnum[] = []
  let match: RegExpExecArray | null

  while ((match = enumRegex.exec(content)) !== null) {
    const name = match[1]
    const body = match[2]
    const members: EnumMember[] = []

    for (const line of body.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('///'))
        continue
      const memberMatch = trimmed.match(/^(\w+)/)
      if (memberMatch) {
        members.push({ key: memberMatch[1], value: memberMatch[1] })
      }
    }

    if (members.length > 0) {
      results.push({ name, source, members })
    }
  }

  return results
}

/** Build a map from enum name to the set of sources it appears in. */
export function buildNameToSourcesMap(enums: ParsedEnum[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const e of enums) {
    if (!map.has(e.name)) map.set(e.name, new Set())
    map.get(e.name)!.add(e.source)
  }
  return map
}

/** Resolve the final exported name for an enum (adds Backend/Quantify prefix on collision). */
export function resolveEnumName(e: ParsedEnum, nameToSources: Map<string, Set<string>>): string {
  const isDuplicate = (nameToSources.get(e.name)?.size ?? 0) > 1
  const prefix = isDuplicate ? (e.source === 'backend' ? 'Backend' : 'Quantify') : ''
  return `${prefix}${e.name}`
}

/**
 * Generate the TypeScript enum file content.
 * Adds Backend/Quantify prefix when same enum name appears in both sources.
 */
export function generateEnumFile(enums: ParsedEnum[]): string {
  const nameToSources = buildNameToSourcesMap(enums)

  const lines: string[] = [
    '// @generated — DO NOT EDIT',
    '// Generated from Prisma Schema files by scripts/generate-prisma-enums.ts',
    '',
  ]

  for (const e of enums) {
    const enumName = resolveEnumName(e, nameToSources)

    lines.push(`export const ${enumName} = {`)
    for (const m of e.members) {
      lines.push(`  ${m.key}: '${m.value}',`)
    }
    lines.push('} as const')
    lines.push(`export type ${enumName} = (typeof ${enumName})[keyof typeof ${enumName}]`)
    lines.push('')
  }

  return lines.join('\n') + '\n'
}

/**
 * Collect all final enum names (with prefix resolution) for ESLint restriction.
 * Also includes raw Prisma names when they differ from the prefixed version.
 */
export function collectEnumNames(enums: ParsedEnum[]): string[] {
  const nameToSources = buildNameToSourcesMap(enums)

  const names = new Set<string>()
  for (const e of enums) {
    names.add(resolveEnumName(e, nameToSources))
    if ((nameToSources.get(e.name)?.size ?? 0) > 1) names.add(e.name)
  }

  return [...names].sort()
}

// CLI entry point
function main() {
  const rootDir = path.resolve(__dirname, '..')
  const sources: Array<{ pattern: string; source: 'backend' | 'quantify' }> = [
    { pattern: 'apps/backend/prisma/schema/*.prisma', source: 'backend' },
    { pattern: 'apps/quantify/prisma/schema/*.prisma', source: 'quantify' },
  ]

  const allEnums: ParsedEnum[] = []

  for (const { pattern, source } of sources) {
    const dir = path.join(rootDir, path.dirname(pattern))
    const ext = path.extname(pattern)
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith(ext))
      .sort()
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8')
      allEnums.push(...parsePrismaEnums(content, source))
    }
  }

  const output = generateEnumFile(allEnums)
  const outDir = path.join(rootDir, 'packages/shared/src/generated')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'prisma-enums.ts'), output, 'utf-8')

  // Generate enum names JSON for ESLint dynamic import restriction (pnpm generate:enums 自动维护)
  const enumNames = collectEnumNames(allEnums)
  fs.writeFileSync(path.join(outDir, 'prisma-enum-names.json'), JSON.stringify(enumNames, null, 2) + '\n', 'utf-8')

  console.log(`Generated ${allEnums.length} enums → packages/shared/src/generated/prisma-enums.ts`)
  console.log(`Generated ${enumNames.length} enum names → packages/shared/src/generated/prisma-enum-names.json`)
}

// Only run main when executed directly
if (require.main === module) {
  try {
    main()
  }
  catch (err) {
    console.error(err)
    process.exit(1)
  }
}

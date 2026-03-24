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

/**
 * Generate the TypeScript enum file content.
 * Adds Backend/Quantify prefix when same enum name appears in both sources.
 */
export function generateEnumFile(enums: ParsedEnum[]): string {
  // Detect duplicates across sources
  const nameToSources = new Map<string, Set<string>>()
  for (const e of enums) {
    if (!nameToSources.has(e.name)) nameToSources.set(e.name, new Set())
    nameToSources.get(e.name)!.add(e.source)
  }

  const lines: string[] = [
    '// @generated — DO NOT EDIT',
    '// Generated from Prisma Schema files by scripts/generate-prisma-enums.ts',
    '',
  ]

  for (const e of enums) {
    const isDuplicate = (nameToSources.get(e.name)?.size ?? 0) > 1
    const prefix = isDuplicate ? (e.source === 'backend' ? 'Backend' : 'Quantify') : ''
    const enumName = `${prefix}${e.name}`

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

  console.log(`Generated ${allEnums.length} enums → packages/shared/src/generated/prisma-enums.ts`)
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

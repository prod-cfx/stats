/* eslint-disable test/no-import-node-test */
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const test = require('node:test')

const moduleUrl = pathToFileURL(
  path.resolve(__dirname, '../generate-backend-contracts.mjs'),
).href

async function loadBreakSelfRecursion() {
  const mod = await import(moduleUrl)
  return mod.breakSelfRecursion
}

test('直接自引用 items.$ref 被降级为 passthrough object', async () => {
  const breakSelfRecursion = await loadBreakSelfRecursion()
  const doc = {
    components: {
      schemas: {
        Node: {
          type: 'object',
          properties: {
            children: {
              type: 'array',
              items: { $ref: '#/components/schemas/Node' },
            },
          },
        },
      },
    },
  }
  const out = breakSelfRecursion(doc)
  assert.deepEqual(out.components.schemas.Node.properties.children.items, {
    type: 'object',
    additionalProperties: true,
  })
})

test('保留自引用 $ref 同级 sibling 字段', async () => {
  const breakSelfRecursion = await loadBreakSelfRecursion()
  const doc = {
    components: {
      schemas: {
        Node: {
          properties: {
            self: {
              $ref: '#/components/schemas/Node',
              description: 'recursive',
              nullable: true,
            },
          },
        },
      },
    },
  }
  const out = breakSelfRecursion(doc)
  assert.deepEqual(out.components.schemas.Node.properties.self, {
    description: 'recursive',
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
})

test('跨 schema 的 $ref 不被改写', async () => {
  const breakSelfRecursion = await loadBreakSelfRecursion()
  const other = { $ref: '#/components/schemas/Other' }
  const doc = {
    components: {
      schemas: {
        Node: { properties: { other } },
        Other: { type: 'object' },
      },
    },
  }
  const out = breakSelfRecursion(doc)
  assert.deepEqual(out.components.schemas.Node.properties.other, {
    $ref: '#/components/schemas/Other',
  })
})

test('null 与基本类型节点原样返回，不抛错', async () => {
  const breakSelfRecursion = await loadBreakSelfRecursion()
  const doc = {
    components: {
      schemas: {
        Node: { example: null, count: 1, label: 'x', enabled: true },
      },
    },
  }
  const out = breakSelfRecursion(doc)
  assert.equal(out.components.schemas.Node.example, null)
  assert.equal(out.components.schemas.Node.count, 1)
})

test('无 components.schemas 时早返回原 doc', async () => {
  const breakSelfRecursion = await loadBreakSelfRecursion()
  const doc = { info: { title: 'x' } }
  assert.equal(breakSelfRecursion(doc), doc)
})

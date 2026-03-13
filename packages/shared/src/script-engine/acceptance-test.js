#!/usr/bin/env node

/**
 * Script Engine Acceptance Tests
 * 
 * This script validates that the script engine module is working correctly
 */

const { createScriptEngine } = require('../../dist/node.js')

const engine = createScriptEngine()

console.log('🧪 Running Script Engine Acceptance Tests...\n')

async function runTests() {
  let passed = 0
  let failed = 0

  const test = async (name, fn) => {
    try {
      await fn()
      console.log(`✓ ${name}`)
      passed++
    }
    catch (error) {
      console.log(`✗ ${name}`)
      console.error(`  Error: ${error.message}`)
      failed++
    }
  }

  // Test 1: Basic Execution
  await test('Basic arithmetic execution', async () => {
    const result = await engine.execute('1 + 2')
    if (!result.success || result.value !== 3) {
      throw new Error(`Expected 3, got ${result.value}`)
    }
  })

  // Test 2: Context Injection
  await test('Context variable injection', async () => {
    const result = await engine.execute('price * quantity', {
      context: { price: 100, quantity: 5 },
    })
    if (!result.success || result.value !== 500) {
      throw new Error(`Expected 500, got ${result.value}`)
    }
  })

  // Test 3: Function Injection Rejection (Security)
  await test('Function injection rejection', async () => {
    let errorThrown = false
    try {
      await engine.execute('add(10, 20)', {
        context: {
          add: (a, b) => a + b,
        },
      })
    }
    catch (error) {
      errorThrown = true
      if (!error.message.includes('Functions are not allowed in context')) {
        throw new Error(`Expected function injection error, got: ${error.message}`)
      }
    }
    if (!errorThrown) {
      throw new Error('Should have thrown an error for function injection')
    }
  })

  // Test 4: Array Operations
  await test('Array operations', async () => {
    const result = await engine.execute('[1, 2, 3, 4, 5].reduce((a, b) => a + b, 0)')
    if (!result.success || result.value !== 15) {
      throw new Error(`Expected 15, got ${result.value}`)
    }
  })

  // Test 5: Object Operations
  await test('Object operations', async () => {
    const result = await engine.execute('Object.keys(data).length', {
      context: {
        data: { a: 1, b: 2, c: 3 },
      },
    })
    if (!result.success || result.value !== 3) {
      throw new Error(`Expected 3, got ${result.value}`)
    }
  })

  // Test 6: Date Operations
  await test('Date operations', async () => {
    const result = await engine.execute('new Date("2024-01-01").getFullYear()')
    if (!result.success || result.value !== 2024) {
      throw new Error(`Expected 2024, got ${result.value}`)
    }
  })

  // Test 7: JSON Operations
  await test('JSON operations', async () => {
    const result = await engine.execute('JSON.parse(json).value', {
      context: {
        json: '{"value": 42}',
      },
    })
    if (!result.success || result.value !== 42) {
      throw new Error(`Expected 42, got ${result.value}`)
    }
  })

  // Test 8: Console Logging
  await test('Console log capture', async () => {
    const result = await engine.execute(`
      (function() {
        console.log('test');
        return 'done';
      })()
    `)
    if (!result.success || !result.logs || !result.logs.includes('[log] test')) {
      throw new Error('Console logs not captured correctly')
    }
  })

  // Test 9: Error Handling
  await test('Error handling', async () => {
    const result = await engine.execute('throw new Error("test error")')
    if (result.success) {
      throw new Error('Should have failed')
    }
    if (!result.error || !result.error.message.includes('test error')) {
      throw new Error('Error not captured correctly')
    }
  })

  // Test 10: Timeout Control
  await test('Timeout control', async () => {
    const result = await engine.execute('while(true) {}', {
      timeout: 100,
    })
    if (result.success) {
      throw new Error('Should have timed out')
    }
  })

  // Test 11: Script Validation
  await test('Script validation - valid', () => {
    const result = engine.validate('const x = 1 + 2')
    if (!result.valid) {
      throw new Error('Valid script marked as invalid')
    }
  })

  // Test 12: Script Validation - invalid syntax
  await test('Script validation - syntax error', () => {
    const result = engine.validate('const x = ')
    if (result.valid) {
      throw new Error('Invalid script marked as valid')
    }
  })

  // Test 13: Script Validation - security
  await test('Script validation - security check (require)', () => {
    const result = engine.validate('require("fs")')
    if (result.valid) {
      throw new Error('Dangerous script not blocked')
    }
    if (!result.errors || !result.errors.some(e => e.includes('require'))) {
      throw new Error('Security error not reported')
    }
  })

  // Test 14: Script Validation - security
  await test('Script validation - security check (eval)', () => {
    const result = engine.validate('eval("1+1")')
    if (result.valid) {
      throw new Error('Dangerous script not blocked')
    }
  })

  // Test 15: Sandbox Security
  await test('Sandbox security - no process access', async () => {
    const result = await engine.execute('typeof process')
    if (!result.success || result.value !== 'undefined') {
      throw new Error('process object should not be accessible')
    }
  })

  // Test 16: Async Execution
  await test('Async code execution', async () => {
    const result = await engine.execute(
      `
      const value = await Promise.resolve(42);
      return value;
      `,
      {
        allowAsync: true,
      },
    )
    if (!result.success || result.value !== 42) {
      throw new Error(`Expected 42, got ${result.value}`)
    }
  })

  // Test 17: Complex Logic
  await test('Complex business logic', async () => {
    const result = await engine.execute(
      `
      (function() {
        const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        const tax = total * 0.08;
        return Math.round((total + tax) * 100) / 100;
      })()
      `,
      {
        context: {
          items: [
            { price: 10, qty: 2 },
            { price: 20, qty: 1 },
            { price: 15, qty: 3 },
          ],
        },
      },
    )
    if (!result.success || result.value !== 91.8) {
      throw new Error(`Expected 91.8, got ${result.value}`)
    }
  })

  // Test 18: Strict Mode
  await test('Strict mode enforcement', async () => {
    const result = await engine.execute('x = 1') // Assignment without declaration
    if (result.success) {
      throw new Error('Strict mode not enforced')
    }
  })

  // Test 19: Execution Time
  await test('Execution time tracking', async () => {
    const result = await engine.execute('1 + 1')
    if (typeof result.executionTime !== 'number' || result.executionTime < 0) {
      throw new Error('Execution time not tracked correctly')
    }
  })

  // Test 20: Empty Script
  await test('Empty script rejection', async () => {
    const result = await engine.execute('')
    if (result.success) {
      throw new Error('Empty script should be rejected')
    }
  })

  // Results
  console.log(`\n${'='.repeat(50)}`)
  console.log(`Tests passed: ${passed}`)
  console.log(`Tests failed: ${failed}`)
  console.log(`Total: ${passed + failed}`)
  console.log(`${'='.repeat(50)}`)

  if (failed > 0) {
    console.log('\n❌ Some tests failed!')
    process.exit(1)
  }
  else {
    console.log('\n✅ All tests passed!')
    process.exit(0)
  }
}

runTests().catch((error) => {
  console.error('\n❌ Test suite failed:', error)
  process.exit(1)
})

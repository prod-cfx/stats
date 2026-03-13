/**
 * Script Engine Usage Examples
 * 
 * This file demonstrates various use cases of the ScriptEngine
 */

import { createScriptEngine } from './index'

async function main() {
  const engine = createScriptEngine()

  console.log('=== Script Engine Examples ===\n')

  // Example 1: Simple calculation
  console.log('1. Simple Calculation:')
  const result1 = await engine.execute('10 + 20 * 2')
  console.log('   Result:', result1.value) // 50
  console.log('   Time:', result1.executionTime, 'ms\n')

  // Example 2: With context variables
  console.log('2. Using Context Variables:')
  const result2 = await engine.execute(
    'price * quantity * (1 - discount)',
    {
      context: {
        price: 100,
        quantity: 5,
        discount: 0.1,
      },
    },
  )
  console.log('   Result:', result2.value) // 450
  console.log('   Time:', result2.executionTime, 'ms\n')

  // Example 3: Complex logic with functions
  console.log('3. Complex Business Logic:')
  const result3 = await engine.execute(
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
          { name: 'Item A', price: 10, qty: 2 },
          { name: 'Item B', price: 20, qty: 1 },
          { name: 'Item C', price: 15, qty: 3 },
        ],
      },
    },
  )
  console.log('   Total with tax:', result3.value)
  console.log('   Time:', result3.executionTime, 'ms\n')

  // Example 4: Conditional logic
  console.log('4. Conditional Logic:')
  const result4 = await engine.execute(
    `
    (function() {
      if (user.age < 18) return 'minor';
      if (user.age < 65) return 'adult';
      return 'senior';
    })()
  `,
    {
      context: {
        user: { age: 30 },
      },
    },
  )
  console.log('   Category:', result4.value)
  console.log('   Time:', result4.executionTime, 'ms\n')

  // Example 5: Array operations
  console.log('5. Array Operations:')
  const result5 = await engine.execute(
    `
    data
      .filter(x => x.active)
      .map(x => x.value)
      .reduce((a, b) => a + b, 0)
  `,
    {
      context: {
        data: [
          { value: 10, active: true },
          { value: 20, active: false },
          { value: 30, active: true },
        ],
      },
    },
  )
  console.log('   Sum of active items:', result5.value)
  console.log('   Time:', result5.executionTime, 'ms\n')

  // Example 6: Date operations
  console.log('6. Date Operations:')
  const result6 = await engine.execute(
    `
    (function() {
      const date = new Date(dateString);
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        dayOfWeek: date.getDay()
      };
    })()
  `,
    {
      context: {
        dateString: '2024-12-25',
      },
    },
  )
  console.log('   Parsed date:', result6.value)
  console.log('   Time:', result6.executionTime, 'ms\n')

  // Example 7: String operations
  console.log('7. String Operations:')
  const result7 = await engine.execute(
    `
    text
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 3)
      .join('-')
  `,
    {
      context: {
        text: 'Hello World This Is A Test',
      },
    },
  )
  console.log('   Result:', result7.value)
  console.log('   Time:', result7.executionTime, 'ms\n')

  // Example 8: With console logs
  console.log('8. With Console Logs:')
  const result8 = await engine.execute(
    `
    (function() {
      console.log('Starting calculation...');
      const result = a + b;
      console.log('Result:', result);
      return result;
    })()
  `,
    {
      context: { a: 10, b: 20 },
    },
  )
  console.log('   Result:', result8.value)
  console.log('   Logs:', result8.logs)
  console.log('   Time:', result8.executionTime, 'ms\n')

  // Example 9: Error handling
  console.log('9. Error Handling:')
  const result9 = await engine.execute('unknownVariable + 1')
  console.log('   Success:', result9.success)
  console.log('   Error:', result9.error?.message)
  console.log('   Time:', result9.executionTime, 'ms\n')

  // Example 10: Validation
  console.log('10. Script Validation:')
  const validation1 = engine.validate('const x = 1 + 2')
  console.log('   Valid script:', validation1.valid)

  const validation2 = engine.validate('require("fs")')
  console.log('   Invalid script:', validation2.valid)
  console.log('   Errors:', validation2.errors)
  console.log()

  // Example 11: Async execution
  console.log('11. Async Execution:')
  const result11 = await engine.execute(
    `
    const data = await Promise.resolve({ value: 42 });
    return data.value;
  `,
    {
      allowAsync: true,
    },
  )
  console.log('   Result:', result11.value)
  console.log('   Time:', result11.executionTime, 'ms\n')

  // Example 12: Complex data structures
  console.log('12. Complex Data Structures:')
  const result12 = await engine.execute(
    `
    (function() {
      // Calculate total from array
      const total = items.reduce((sum, item) => sum + item, 0);
      // Apply discount calculation
      const discounted = total * (1 - discountRate);
      return Math.round(discounted * 100) / 100;
    })()
  `,
    {
      context: {
        items: [100, 200, 300],
        discountRate: 0.1,
      },
    },
  )
  console.log('   Result:', result12.value)
  console.log('   Time:', result12.executionTime, 'ms\n')
}

// Run examples
if (require.main === module) {
  main().catch(console.error)
}

export { main as runExamples }

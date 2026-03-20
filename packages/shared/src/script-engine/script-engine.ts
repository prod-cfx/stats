import type {
  ScriptContext,
  ScriptExecutionOptions,
  ScriptExecutionResult,
  ScriptValidationResult,
} from './types'
import vm from 'node:vm'
import { getSafeHelpers, isSafeHelperFunction } from './helpers/safe-helpers'

/**
 * JavaScript execution engine with sandboxing capabilities
 */
export class ScriptEngine {
  private readonly defaultTimeout: number = 5000
  private readonly defaultStrict: boolean = true

  /**
   * Execute a JavaScript script in a sandboxed environment
   * @param code - JavaScript code to execute
   * @param options - Execution options
   * @returns Execution result
   */
  async execute<T = any>(
    code: string,
    options: ScriptExecutionOptions = {},
  ): Promise<ScriptExecutionResult<T>> {
    const startTime = Date.now()
    const logs: string[] = []

    const {
      timeout = this.defaultTimeout,
      context = {},
      strict = this.defaultStrict,
      console: customConsole,
      allowAsync = false,
    } = options

    // SECURITY: Validate context before entering try-catch
    // Context injection errors should be thrown immediately
    const sanitizedContext = this.sanitizeContext(context)

    try {
      // Validate the script first
      const validation = this.validate(code, { allowAsync })
      if (!validation.valid) {
        return {
          success: false,
          error: {
            message: `Script validation failed: ${validation.errors?.join(', ')}`,
            name: 'ValidationError',
          },
          executionTime: Date.now() - startTime,
          logs,
        }
      }

      // Create a custom console that captures logs
      const sandboxConsole = customConsole || this.createCaptureConsole(logs)

      // Prepare the sandbox context (using pre-validated context)
      const sandbox = this.createSandbox(sanitizedContext, sandboxConsole)
      this.injectDefaultGlobals(sandbox)

      // Wrap code in strict mode if needed
      const wrappedCode = strict ? `"use strict";\n${code}` : code

      // Create VM context
      const vmContext = vm.createContext(sandbox)

      // SECURITY: Prevent Function constructor escape
      // Run security lockdown script inside the VM context
      const securityScript = new vm.Script(`
        'use strict';
        (() => {
          // Delete constructor property from all function objects
          const removeConstructor = (obj) => {
            if (!obj) return;
            try {
              delete obj.constructor;
              Object.defineProperty(obj, 'constructor', {
                get() { return undefined; },
                set() { /* no-op */ },
                configurable: false,
                enumerable: false
              });
            } catch (e) {
              // Some properties might be non-configurable
            }
          };
          
          // Remove constructor from function prototypes
          const protectFunction = (fn) => {
            if (!fn || typeof fn !== 'function') return;
            removeConstructor(fn);
            removeConstructor(fn.prototype);
          };
          
          // Protect all built-in constructors and their prototypes
          const builtins = [
            Function, Object, Array, String, Number, Boolean,
            Date, RegExp, Error, TypeError, RangeError,
            ReferenceError, SyntaxError, Promise
          ];
          
          builtins.forEach(protectFunction);
          
          // Protect global functions
          const globalFuncs = [
            parseInt, parseFloat, isNaN, isFinite,
            encodeURI, decodeURI, encodeURIComponent, decodeURIComponent
          ];
          
          globalFuncs.forEach(protectFunction);
          
          // Protect console methods
          if (typeof console !== 'undefined') {
            Object.keys(console).forEach(key => {
              protectFunction(console[key]);
            });
          }
          
          // Freeze Function to prevent modifications
          try {
            Object.freeze(Function);
            Object.freeze(Function.prototype);
          } catch (e) {}
        })();
      `, { filename: 'security-lockdown.js' })
      
      try {
        securityScript.runInContext(vmContext, { timeout: 1000 })
      }
      catch {
        // If lockdown fails, it's safer to not execute user code
        throw new Error('Security lockdown failed')
      }

      let result: any

      if (allowAsync) {
        // For async code, wrap in an async function
        const asyncCode = `(async () => { ${wrappedCode} })()`
        const script = new vm.Script(asyncCode, {
          filename: 'user-script.js',
        })
        
        // Create a promise for script execution
        const scriptPromise = script.runInContext(vmContext, {
          timeout,
          breakOnSigint: true,
        })
        
        // Create a timeout promise to enforce async timeout
        let timeoutHandle: NodeJS.Timeout | undefined
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`Script execution timed out after ${timeout}ms`))
          }, timeout)
        })
        
        // Race between script execution and timeout
        // Clear the timeout when script completes to prevent memory leak
        try {
          result = await Promise.race([scriptPromise, timeoutPromise])
        }
        finally {
          if (timeoutHandle !== undefined) {
            clearTimeout(timeoutHandle)
          }
        }
      }
      else {
        // Synchronous execution
        const script = new vm.Script(wrappedCode, {
          filename: 'user-script.js',
        })
        result = script.runInContext(vmContext, {
          timeout,
          breakOnSigint: true,
        })
      }

      return {
        success: true,
        value: result as T,
        executionTime: Date.now() - startTime,
        logs,
      }
    }
    catch (error: any) {
      return {
        success: false,
        error: {
          message: error.message || 'Unknown error',
          stack: error.stack,
          name: error.name || 'Error',
        },
        executionTime: Date.now() - startTime,
        logs,
      }
    }
  }

  /**
   * Validate JavaScript code syntax
   * @param code - JavaScript code to validate
   * @returns Validation result
   */
  validate(code: string, options: { skipSecurityCheck?: boolean, allowAsync?: boolean } = {}): ScriptValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check if code is empty
    if (!code || code.trim().length === 0) {
      errors.push('Script code cannot be empty')
      return { valid: false, errors, warnings }
    }

    // Check for dangerous patterns (unless skipped)
    if (!options.skipSecurityCheck) {
      const dangerousPatterns = [
        { pattern: /require\s*\(/, message: 'require() is not allowed' },
        { pattern: /import\s+/, message: 'import statements are not allowed' },
        { pattern: /process\./, message: 'Access to process object is not allowed' },
        { pattern: /__dirname/, message: '__dirname is not allowed' },
        { pattern: /__filename/, message: '__filename is not allowed' },
        { pattern: /eval\s*\(/, message: 'eval() is not allowed' },
        { pattern: /Function\s*\(/, message: 'Function constructor is not allowed' },
      ]

      for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(code)) {
          errors.push(message)
        }
      }
    }

    // Try to parse the code to check for syntax errors
    try {
      // For async code, wrap it in async function for validation
      const codeToValidate = options.allowAsync
        ? `(async () => { ${code} })()`
        : code

      // Use vm.Script to validate syntax
      // eslint-disable-next-line no-new
      new vm.Script(codeToValidate, { filename: 'validation.js' })
    }
    catch (error: any) {
      errors.push(`Syntax error: ${error.message}`)
    }

    // Check for potentially unsafe patterns (warnings)
    const warningPatterns = [
      { pattern: /while\s*\(\s*true\s*\)/, message: 'Infinite loop detected (while(true))' },
      { pattern: /for\s*\(\s*;\s*;\s*\)/, message: 'Infinite loop detected (for(;;))' },
    ]

    for (const { pattern, message } of warningPatterns) {
      if (pattern.test(code)) {
        warnings.push(message)
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  /**
   * Create a sandbox context with restricted access
   * @param sanitizedContext - Pre-sanitized user context
   * @param console - Console implementation
   * @returns Sandbox object
   */
  private createSandbox(sanitizedContext: ScriptContext, console: Console): any {
    // IMPORTANT: Do NOT inject host's Object/Array/etc directly!
    // That would allow prototype pollution of the host process.
    // Instead, create an empty sandbox and let vm.createContext provide isolated intrinsics
    
    const sandbox = {
      ...sanitizedContext,
      console,
      // Utility functions (these are safe as they're primitive functions)
      parseInt: Number.parseInt,
      parseFloat: Number.parseFloat,
      isNaN: Number.isNaN,
      isFinite: Number.isFinite,
      encodeURI,
      encodeURIComponent,
      decodeURI,
      decodeURIComponent,
      // Explicitly set dangerous globals to undefined
      __dirname: undefined,
      __filename: undefined,
      require: undefined,
      process: undefined,
      global: undefined,
      globalThis: undefined,
      eval: undefined,
      Function: undefined,
    }

    return sandbox
  }

  /**
   * Sanitize user context to prevent injection attacks.
   * Only allows primitives, plain objects, and arrays - no functions.
   * 
   * SECURITY: We strictly reject functions to prevent sandbox escape attacks.
   * Even with constructor protection, attackers can use __proto__ or 
   * Object.getPrototypeOf() to access Function constructor via the prototype chain.
   */
  private sanitizeContext(context: ScriptContext): ScriptContext {
    const sanitized: ScriptContext = {}

    for (const [key, value] of Object.entries(context)) {
      const type = typeof value

      // Allow primitives
      if (value === null || value === undefined) {
        sanitized[key] = value
      }
      else if (type === 'string' || type === 'number' || type === 'boolean') {
        sanitized[key] = value
      }
      // Allow plain objects and arrays (recursively sanitize)
      else if (type === 'object') {
        if (Array.isArray(value)) {
          // Recursively sanitize array items
          sanitized[key] = value.map(item => this.sanitizeValue(item))
        }
        else {
          sanitized[key] = this.sanitizeValue(value)
        }
      }
      // SECURITY: Reject functions to prevent sandbox escape
      else if (type === 'function') {
        if (isSafeHelperFunction(value)) {
          sanitized[key] = value
        }
        else {
          throw new Error(
            `Context injection error: Functions are not allowed in context (key: "${key}"). ` +
            'Only primitives, plain objects, and arrays (plus built-in helpers) are allowed.',
          )
        }
      }
      // Reject other types (symbol, bigint, etc)
      else {
        throw new Error(
          `Context injection error: Type "${type}" is not allowed in context (key: "${key}"). ` +
          'Only primitives, plain objects, and arrays are allowed.'
        )
      }
    }

    return sanitized
  }

  /**
   * Recursively sanitize a value
   * @param value - Value to sanitize
   * @returns Sanitized value
   */
  private sanitizeValue(value: any): any {
    if (value === null || value === undefined) {
      return value
    }
    
    const type = typeof value
    
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return value
    }

    // SECURITY: Reject functions in nested structures
    if (type === 'function') {
      if (isSafeHelperFunction(value)) {
        return value
      }
      throw new Error(
        'Context injection error: Nested functions are not allowed. ' +
        'Only primitives, plain objects, arrays, and built-in helpers are allowed.',
      )
    }

    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeValue(item))
    }
    
    if (type === 'object') {
      const sanitized: any = {}
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = this.sanitizeValue(val)
      }
      return sanitized
    }

    // Reject other types
    throw new Error(
      `Context injection error: Type "${type}" is not allowed. ` +
      'Only primitives, plain objects, and arrays are allowed.'
    )
  }

  /**
   * Inject default globals (helpers, etc.) after sandbox creation.
   * Ensures legacy脚本仍可访问 helpers 命名空间。
   */
  private injectDefaultGlobals(sandbox: Record<string, unknown>): void {
    if (!Object.prototype.hasOwnProperty.call(sandbox, 'helpers')) {
      Object.defineProperty(sandbox, 'helpers', {
        value: getSafeHelpers(),
        writable: false,
        enumerable: true,
        configurable: false,
      })
    }
  }

  /**
   * Create a console that captures output
   * @param logs - Array to store log messages
   * @returns Console object
   */
  private createCaptureConsole(logs: string[]): Console {
    const capture = (level: string, ...args: any[]) => {
      const message = args.map(arg => this.stringifyValue(arg)).join(' ')
      logs.push(`[${level}] ${message}`)
    }

    // Create a plain object without prototype chain to prevent sandbox escape
    // via console.constructor.constructor('return process')()
    const consoleObj = Object.create(null)
    consoleObj.log = (...args: any[]) => capture('log', ...args)
    consoleObj.info = (...args: any[]) => capture('info', ...args)
    consoleObj.warn = (...args: any[]) => capture('warn', ...args)
    consoleObj.error = (...args: any[]) => capture('error', ...args)
    consoleObj.debug = (...args: any[]) => capture('debug', ...args)

    return consoleObj as Console
  }

  /**
   * Convert a value to string for logging
   * @param value - Value to stringify
   * @returns String representation
   */
  private stringifyValue(value: any): string {
    if (value === null)
      return 'null'
    if (value === undefined)
      return 'undefined'
    if (typeof value === 'string')
      return value
    if (typeof value === 'function')
      return '[Function]'
    try {
      return JSON.stringify(value)
    }
    catch {
      return String(value)
    }
  }
}

export type ScriptOutputValidationErrorCode =
  | 'INVALID_TYPE'
  | 'ARRAY_NOT_ALLOWED'
  | 'EMPTY_OBJECT'

export interface ScriptOutputValidationResult {
  valid: boolean
  error?: string
  code?: ScriptOutputValidationErrorCode
  value?: Record<string, unknown>
}

/**
 * Validate script execution result to ensure it returns a plain object.
 * This is shared between single-leg and multi-leg strategy execution paths.
 */
export function validateScriptOutput(
  value: unknown,
  options: { allowEmpty?: boolean } = {},
): ScriptOutputValidationResult {
  const { allowEmpty = false } = options

  if (typeof value !== 'object' || value === null) {
    return {
      valid: false,
      code: 'INVALID_TYPE',
      error: `Invalid return type: expected object, got ${typeof value}`,
    }
  }

  if (Array.isArray(value)) {
    return {
      valid: false,
      code: 'ARRAY_NOT_ALLOWED',
      error: 'Invalid return type: expected plain object, got array',
    }
  }

  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)

  if (!allowEmpty && keys.length === 0) {
    return {
      valid: false,
      code: 'EMPTY_OBJECT',
      error: 'Script returned empty object',
    }
  }

  return {
    valid: true,
    value: obj,
  }
}

/**
 * Create a new script engine instance
 */
export function createScriptEngine(): ScriptEngine {
  return new ScriptEngine()
}

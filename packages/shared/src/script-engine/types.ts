/**
 * Script execution context
 */
export interface ScriptContext {
  [key: string]: any
}

/**
 * Script execution options
 */
export interface ScriptExecutionOptions {
  /**
   * Timeout in milliseconds
   * @default 5000
   */
  timeout?: number

  /**
   * Context data available in the script
   */
  context?: ScriptContext

  /**
   * Whether to use strict mode
   * @default true
   */
  strict?: boolean

  /**
   * Custom console implementation
   */
  console?: Console

  /**
   * Whether to allow async functions
   * @default false
   */
  allowAsync?: boolean
}

/**
 * Script execution result
 */
export interface ScriptExecutionResult<T = any> {
  /**
   * Whether execution was successful
   */
  success: boolean

  /**
   * Execution result value
   */
  value?: T

  /**
   * Error information if execution failed
   */
  error?: {
    message: string
    stack?: string
    name?: string
  }

  /**
   * Execution time in milliseconds
   */
  executionTime: number

  /**
   * Console output during execution
   */
  logs?: string[]
}

/**
 * Script validation result
 */
export interface ScriptValidationResult {
  /**
   * Whether the script is valid
   */
  valid: boolean

  /**
   * Validation errors
   */
  errors?: string[]

  /**
   * Validation warnings
   */
  warnings?: string[]
}

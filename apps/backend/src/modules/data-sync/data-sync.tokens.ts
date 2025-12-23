/**
 * Data-sync 模块内部使用的 DI token 定义。
 *
 * 单独拆出文件是为了避免模块定义与服务之间产生循环引用：
 * - module 需要引用 Orchestrator/Job
 * - Orchestrator 需要引用 token
 */
export const DATA_PULL_JOB_REGISTRY = 'DATA_PULL_JOB_REGISTRY' as const


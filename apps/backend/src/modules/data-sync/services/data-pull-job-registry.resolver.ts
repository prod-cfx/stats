import type { DataPullJob, JobMetaSchema } from '../contracts/data-pull-job'

export interface RegisteredJobInfo {
  key: string
  name: string
  metaSchema: JobMetaSchema | null
}

export class DataPullJobRegistryResolver {
  private readonly registeredKeys: Set<string>
  private readonly jobsMap: Map<string, DataPullJob>

  constructor(jobs: DataPullJob[]) {
    this.registeredKeys = new Set(jobs.map(job => job.key))
    this.jobsMap = new Map(jobs.map(job => [job.key, job]))
  }

  findJobForTask(taskKey: string): DataPullJob | undefined {
    const exactMatch = this.jobsMap.get(taskKey)
    if (exactMatch) {
      return exactMatch
    }

    const colonIndex = taskKey.indexOf(':')
    if (colonIndex > 0) {
      const jobKeyPrefix = taskKey.slice(0, colonIndex)
      return this.jobsMap.get(jobKeyPrefix)
    }

    return undefined
  }

  isKeyRegistered(taskKey: string): boolean {
    if (this.registeredKeys.has(taskKey)) {
      return true
    }

    const colonIndex = taskKey.indexOf(':')
    if (colonIndex > 0) {
      const jobKeyPrefix = taskKey.slice(0, colonIndex)
      return this.registeredKeys.has(jobKeyPrefix)
    }

    return false
  }

  getRegisteredKeys(): string[] {
    return Array.from(this.registeredKeys).sort()
  }

  getRegisteredJobs(): RegisteredJobInfo[] {
    return Array.from(this.jobsMap.values())
      .map(job => ({
        key: job.key,
        name: job.name ?? job.key,
        metaSchema: job.metaSchema ?? null,
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }
}

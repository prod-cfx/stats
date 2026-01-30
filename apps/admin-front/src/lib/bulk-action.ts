export interface BulkTarget {
  id: number
  name: string
}

export interface BulkFailure {
  target: BulkTarget
  errorMessage: string
}

export interface BulkAggregate {
  total: number
  successCount: number
  failureCount: number
  failures: BulkFailure[]
}

const unknownErrorMessage = '未知错误'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function toErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error.trim() ? error : unknownErrorMessage
  }

  if (error instanceof Error) {
    return error.message.trim() ? error.message : unknownErrorMessage
  }

  if (isRecord(error)) {
    const response = error.response
    if (isRecord(response)) {
      const responseData = response.data
      if (isRecord(responseData)) {
        const responseMessage = responseData.message
        if (typeof responseMessage === 'string' && responseMessage.trim()) {
          return responseMessage
        }
        const responseError = responseData.error
        if (typeof responseError === 'string' && responseError.trim()) {
          return responseError
        }
      }
    }

    const data = error.data
    if (isRecord(data)) {
      const dataMessage = data.message
      if (typeof dataMessage === 'string' && dataMessage.trim()) {
        return dataMessage
      }
    }

    const message = error.message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  return unknownErrorMessage
}

export function aggregateBulkSettledResults(
  targets: BulkTarget[],
  results: PromiseSettledResult<unknown>[],
): BulkAggregate {
  if (results.length !== targets.length) {
    console.warn(
      `aggregateBulkSettledResults: results length (${results.length}) does not match targets length (${targets.length})`,
    )
  }

  const normalizedResults = results.slice(0, targets.length)
  const failures: BulkFailure[] = []
  let successCount = 0

  targets.forEach((target, index) => {
    const result = normalizedResults[index]
    if (!result) {
      failures.push({ target, errorMessage: unknownErrorMessage })
      return
    }

    if (result.status === 'fulfilled') {
      successCount += 1
      return
    }

    failures.push({
      target,
      errorMessage: toErrorMessage(result.reason),
    })
  })

  return {
    total: targets.length,
    successCount,
    failureCount: failures.length,
    failures,
  }
}

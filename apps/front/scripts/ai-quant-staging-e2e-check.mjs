#!/usr/bin/env node

const apiBase = (process.env.AI_QUANT_API_BASE_URL ?? 'https://cfx-quantify-staging.devbase.cloud/api/v1').replace(/\/$/, '')
const token = process.env.AI_QUANT_JWT_TOKEN ?? ''
const userId = process.env.AI_QUANT_USER_ID ?? ''

if (!token) {
  console.error('Missing AI_QUANT_JWT_TOKEN')
  process.exit(1)
}

const requestId = `ai-quant-e2e-${Date.now()}`

function printStep(name, payload) {
  console.log(`\n=== ${name} ===`)
  console.log(JSON.stringify(payload, null, 2))
}

async function request(method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  let payload = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }
  return { status: res.status, payload }
}

function extractErrorMeta(payload) {
  const root = payload && typeof payload === 'object' ? payload : {}
  const error = root.error && typeof root.error === 'object' ? root.error : {}
  const args = error.args && typeof error.args === 'object' ? error.args : {}
  return {
    code: error.code ?? root.code ?? null,
    stage: error.stage ?? root.stage ?? null,
    requestId: error.requestId ?? root.requestId ?? null,
    reasonMessage: args.reasonMessage ?? null,
    message: error.message ?? root.message ?? null,
  }
}

const summary = {
  requestId,
  steps: [],
}

// 1) Capabilities
const capabilities = await request('GET', '/backtesting/capabilities')
const capabilitiesMeta = extractErrorMeta(capabilities.payload)
summary.steps.push({ step: 'capabilities', status: capabilities.status, ...capabilitiesMeta })
printStep('capabilities', summary.steps.at(-1))

// 2) Start codegen session
const startPayload = {
  userId: userId || undefined,
  initialMessage: '请生成一个基础的 BTC 15m 趋势策略',
}
const start = await request('POST', '/llm-strategy-codegen/sessions', startPayload)
const startMeta = extractErrorMeta(start.payload)
const sessionId = start.payload?.data?.id ?? start.payload?.id ?? null
summary.steps.push({ step: 'codegen-start', status: start.status, sessionId, ...startMeta })
printStep('codegen-start', summary.steps.at(-1))

// 3) Continue codegen session
if (sessionId) {
  const cont = await request('POST', `/llm-strategy-codegen/sessions/${sessionId}/messages`, {
    userId: userId || undefined,
    message: '确认并生成',
    confirmGenerate: true,
  })
  const contMeta = extractErrorMeta(cont.payload)
  summary.steps.push({ step: 'codegen-continue', status: cont.status, ...contMeta })
  printStep('codegen-continue', summary.steps.at(-1))
}

console.log('\n=== summary ===')
console.log(JSON.stringify(summary, null, 2))

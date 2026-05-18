let suppressAuthGateUntil = 0

export function suppressNextAuthGate(durationMs = 2000) {
  suppressAuthGateUntil = Date.now() + durationMs
}

export function shouldSuppressAuthGate() {
  return Date.now() < suppressAuthGateUntil
}

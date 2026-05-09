import type {
  DisplayToken,
  DisplayTokenKind,
  DisplayTokenTemplateValues,
} from './display-token.types'
import { SemanticPresentationTokenNotFoundException } from '../../exceptions/semantic-presentation-token-not-found.exception'
import { DISPLAY_TOKENS } from './display-token-table'

const TOKEN_BY_ID = new Map<string, DisplayToken>(DISPLAY_TOKENS.map(token => [token.token, token]))

export function listDisplayTokens(kind?: DisplayTokenKind): DisplayToken[] {
  const tokens = kind === undefined
    ? DISPLAY_TOKENS
    : DISPLAY_TOKENS.filter(token => token.kind === kind)
  return tokens.map(token => ({ ...token }))
}

export function getDisplayToken(token: string): DisplayToken {
  const found = TOKEN_BY_ID.get(token)
  if (!found) {
    throw new SemanticPresentationTokenNotFoundException({ token })
  }
  return { ...found }
}

export function renderDisplayToken(
  token: string,
  values: DisplayTokenTemplateValues = {},
): string {
  const template = getDisplayToken(token).zh
  return template.replace(/\{([A-Za-z0-9_.]+)\}/gu, (_match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, key) || values[key] === undefined || values[key] === null) {
      throw new SemanticPresentationTokenNotFoundException({ token: `${token}.${key}` })
    }
    return String(values[key])
  })
}

export function renderEnumDisplayToken(
  tokenPrefix: string,
  value: string,
): string {
  return renderDisplayToken(`${tokenPrefix}.${value}`)
}

import type { ParsedOperatorNode } from '../types/strategy-logic-graph-snapshot'
import { Injectable } from '@nestjs/common'

type Token
  = { type: 'IDENT'; value: string }
    | { type: 'NUMBER'; value: string }
    | { type: 'LPAREN' }
    | { type: 'RPAREN' }
    | { type: 'COMMA' }

const ALLOWED_FUNCTIONS = new Set([
  'EMA',
  'SMA',
  'RSI',
  'ATR',
  'MACD',
  'MACD_LINE',
  'MACD_SIGNAL',
  'CROSS_OVER',
  'CROSS_UNDER',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'EQ',
  'AND',
  'OR',
  'NOT',
  'BETWEEN',
  'TOUCH_LEVEL_UP',
  'TOUCH_LEVEL_DOWN',
  'STOP_LOSS_PCT',
  'TAKE_PROFIT_PCT',
  'MAX_DRAWDOWN_PCT',
  'MAX_POSITION_PCT',
  'TRAILING_STOP_PCT',
  'HARD_PRICE_STOP',
])

@Injectable()
export class GraphOperatorParserService {
  parse(input: string): ParsedOperatorNode {
    try {
      const tokens = this.tokenize(input)
      if (tokens.length === 0) throw new Error('empty')

      let position = 0
      const readToken = () => tokens[position]
      const consume = (): Token => {
        const token = tokens[position]
        if (!token) throw new Error('unexpected eof')
        position += 1
        return token
      }

      const parseExpression = (): ParsedOperatorNode => {
        const token = consume()

        if (token.type === 'NUMBER') {
          return { kind: 'NUMBER', value: Number(token.value) }
        }

        if (token.type !== 'IDENT') {
          throw new Error('unexpected token')
        }

        if (readToken()?.type === 'LPAREN') {
          consume()
          const args: ParsedOperatorNode[] = []

          if (readToken()?.type !== 'RPAREN') {
            while (true) {
              args.push(parseExpression())
              if (readToken()?.type === 'COMMA') {
                consume()
                continue
              }
              break
            }
          }

          if (readToken()?.type !== 'RPAREN') {
            throw new Error('missing closing paren')
          }
          consume()

          if (!ALLOWED_FUNCTIONS.has(token.value)) {
            throw new Error('unsupported function')
          }

          return {
            kind: 'CALL',
            name: token.value,
            args,
          }
        }

        return {
          kind: 'IDENT',
          name: token.value,
        }
      }

      const expression = parseExpression()
      if (position !== tokens.length) {
        throw new Error('trailing tokens')
      }

      return expression
    } catch {
      throw new Error('codegen.graph_operator_invalid')
    }
  }

  private tokenize(input: string): Token[] {
    const tokens: Token[] = []
    let cursor = 0
    const source = input.trim()

    while (cursor < source.length) {
      const char = source[cursor]

      if (/\s/u.test(char)) {
        cursor += 1
        continue
      }

      if (char === '(') {
        tokens.push({ type: 'LPAREN' })
        cursor += 1
        continue
      }

      if (char === ')') {
        tokens.push({ type: 'RPAREN' })
        cursor += 1
        continue
      }

      if (char === ',') {
        tokens.push({ type: 'COMMA' })
        cursor += 1
        continue
      }

      const numberMatch = source.slice(cursor).match(/^-?\d+(?:\.\d+)?/u)
      if (numberMatch) {
        tokens.push({ type: 'NUMBER', value: numberMatch[0] })
        cursor += numberMatch[0].length
        continue
      }

      const identMatch = source.slice(cursor).match(/^[A-Z_][A-Z0-9_]*/u)
      if (identMatch) {
        tokens.push({ type: 'IDENT', value: identMatch[0] })
        cursor += identMatch[0].length
        continue
      }

      throw new Error('invalid token')
    }

    return tokens
  }
}

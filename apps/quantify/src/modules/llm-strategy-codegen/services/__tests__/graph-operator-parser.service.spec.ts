import { GraphOperatorParserService } from '../graph-operator-parser.service'

describe('graphOperatorParserService', () => {
  it('parses nested operator calls within the whitelist', () => {
    const parser = new GraphOperatorParserService()

    expect(parser.parse('CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))')).toEqual({
      kind: 'CALL',
      name: 'CROSS_OVER',
      args: [
        {
          kind: 'CALL',
          name: 'EMA',
          args: [
            { kind: 'IDENT', name: 'CLOSE' },
            { kind: 'NUMBER', value: 7 },
          ],
        },
        {
          kind: 'CALL',
          name: 'EMA',
          args: [
            { kind: 'IDENT', name: 'CLOSE' },
            { kind: 'NUMBER', value: 21 },
          ],
        },
      ],
    })
  })

  it('rejects natural language operators', () => {
    const parser = new GraphOperatorParserService()

    expect(() => parser.parse('价格强势就买入')).toThrow('codegen.graph_operator_invalid')
  })

  it('rejects unsupported functions outside the whitelist', () => {
    const parser = new GraphOperatorParserService()

    expect(() => parser.parse('CUSTOM_ALPHA(CLOSE,7)')).toThrow('codegen.graph_operator_invalid')
  })

  it('parses signed numeric literals', () => {
    const parser = new GraphOperatorParserService()

    expect(parser.parse('LTE(POSITION_PNL_PCT,-5)')).toEqual({
      kind: 'CALL',
      name: 'LTE',
      args: [
        { kind: 'IDENT', name: 'POSITION_PNL_PCT' },
        { kind: 'NUMBER', value: -5 },
      ],
    })
  })
})

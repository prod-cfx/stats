export interface PublicCompanyConfig {
  assetSymbol: string
  assetLogoUrl: string
  companyLogoUrl: string
  mNav?: string
  holdingsValue?: string
  holdingsAmount?: string
  infoParagraphs?: string[]
}

/**
 * 币股视图静态补充配置
 *
 * 说明：
 * - 仅用于补充行情表本身不包含的展示字段（资产映射、Logo、mNAV、持仓说明等）
 * - 如需扩展或改成可视化配置，可迁移到配置中心或数据库
 */
export const PUBLIC_COMPANY_CONFIG: Record<string, PublicCompanyConfig> = {
  PYPL: {
    assetSymbol: 'PYUSD',
    assetLogoUrl: 'https://cryptologos.cc/logos/paypal-usd-pyusd-logo.png?v=040',
    companyLogoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
    mNav: '-',
    holdingsValue: '-',
    holdingsAmount: '-',
  },
  MSTR: {
    assetSymbol: 'BTC',
    assetLogoUrl: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=040',
    companyLogoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/MicroStrategy_logo.svg/1200px-MicroStrategy_logo.svg.png',
    mNav: '0.83',
    holdingsValue: '$58.14B',
    holdingsAmount: '671.27K BTC',
    infoParagraphs: [
      '微策略是一家美国的软件公司，提供商业智能、移动软件和云端服务。',
      '该公司于1989年由迈克尔·塞勒（Michael J. Saylor）、桑朱·班萨尔（Sanju Bansal）和托马斯·斯宾纳（Thomas Spahr）创立，专门开发用于分析内部与外部数据的软件，协助进行商业决策以及开发移动应用程序。',
      '公司总部位于弗吉尼亚州泰森斯（Tysons），属于华盛顿都会区的一部分。塞勒为执行主席，自1989年至2022年担任CEO。',
      '该公司因为持有巨量比特币而被认为是与比特币挂钩的“概念股”。',
    ],
  },
  CRCL: {
    assetSymbol: 'USDC',
    assetLogoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040',
    companyLogoUrl: 'https://www.circle.com/hubfs/logos/Circle_Logo_Green.svg',
    mNav: '0.27',
    holdingsValue: '$64.46B',
    holdingsAmount: '64.50B USDC',
  },
  BMNR: {
    assetSymbol: 'ETH',
    assetLogoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=040',
    companyLogoUrl: 'https://bitmine.tech/wp-content/uploads/2021/06/BitMine-Logo-1.png',
    mNav: '0.73',
    holdingsValue: '$11.62B',
    holdingsAmount: '3.97M ETH',
  },
}








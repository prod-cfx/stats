/* =========================================================
   Coinflux landing — interactions + i18n + tweaks
   ========================================================= */

/* ----- 1. Tweak defaults (read from root HTML inline) ----- */
const TWEAK_DEFAULTS = window.TWEAK_DEFAULTS || { theme: "dark", accent: "#A78BFA" };

/* ----- 2. i18n dictionary ----- */
const I18N = {
  zh: {
    "nav.ai": "AI 量化",
    "nav.data": "数据",
    "nav.data.1": "行情数据",
    "nav.data.2": "交易所多空比",
    "nav.data.3": "聚合挂单",
    "nav.data.4": "预测市场",
    "nav.data.5": "币股",
    "nav.whale": "鲸鱼",
    "nav.whale.1": "发现",
    "nav.whale.2": "实时巨鲸",
    "nav.whale.3": "鲸鱼持仓",
    "nav.whale.4": "监控",
    "nav.market": "策略广场",
    "nav.features": "产品",
    "nav.strategies": "策略广场",
    "nav.security": "安全",
    "nav.cases": "案例",
    "nav.docs": "文档",
    "nav.login": "登录",
    "nav.cta": "免费开始",

    "hero.eyebrow": "AI 量化 · 数据 · 鲸鱼",
    "hero.title.1": "不懂代码，也能跑",
    "hero.title.2": "。",
    "hero.title.3": "AI 量化",
    "hero.lead": "<strong>AI 量化</strong> · <strong>多维数据</strong> · <strong>链上鲸鱼</strong> — 三个引擎装在一个窗口里。描述一句交易想法，Coinflux 帮你写策略、跑回测、接交易所 API 然后自动下单。",
    "hero.cta1": "免费连接交易所",
    "hero.cta2": "查看策略广场",
    "hero.bullet1": "API 仅读取与下单，永不接触提币权限",
    "hero.bullet2": "资金始终留在你的交易所账户",
    "hero.term": "coinflux ▸ 策略控制台",
    "hero.term.desc": '"BTC 跌 5% 加仓，涨 8% 减仓一半"',
    "hero.term.parsing": "→ 解析为网格 + 波段混合策略",
    "hero.term.entry": "入场",
    "hero.term.exit": "出场",
    "hero.term.add": "加仓 0.25 BTC",
    "hero.term.cut": "减仓 50%",
    "hero.term.backtest": "→ 2021-01 ~ 2026-04 回测中…",
    "hero.stat.cagr": "年化收益",
    "hero.stat.win": "胜率",
    "hero.stat.mdd": "最大回撤",

    "ex.label": "已接入 Binance / OKX / Hyperliquid",
    "ex.tg": "TELEGRAM",

    "eng.eyebrow": "三个引擎 · 一个窗口",
    "eng.title": "三个引擎，长在一个产品里。",
    "eng.lead": "AI 量化负责\"做\"，数据负责\"看\"，鲸鱼追踪负责\"跟\"。从信号到下单，链路一气呵成。",

    "eng.1.t1": "AI 量化",
    "eng.1.t2": " · 对话即策略",
    "eng.1.d": "告诉助手你的想法，\"3 分钟跌 1% 买入、5 分钟涨 2% 卖出\"也行。AI 实时把口语翻译成可回测、可部署的策略代码。回测最大回撤 ≤ 20% 才允许一键上线。",
    "eng.1.s1": "AI 策略助手",
    "eng.1.s2": "参数配置",
    "eng.1.s3": "历史回测",
    "eng.1.s4": "策略广场",
    "eng.1.cta": "进入 AI 量化",

    "eng.2.t1": "数据",
    "eng.2.t2": " · 看见别人看不见的",
    "eng.2.d": "分钟级行情、交易所多空比、聚合挂单深度、预测市场赔率、币股联动 — 五条数据线全部串进策略，让 AI 不再只看 K 线。",
    "eng.2.s1": "行情数据",
    "eng.2.s2": "交易所多空比",
    "eng.2.s3": "聚合挂单",
    "eng.2.s4": "预测市场",
    "eng.2.s5": "币股联动",
    "eng.2.s6": "数据 API",
    "eng.2.cta": "浏览所有数据",

    "eng.3.t1": "鲸鱼",
    "eng.3.t2": " · 跟着聪明钱走",
    "eng.3.d": "链上巨鲸地址实时监控、持仓变动推送、Telegram 即时告警。哪条鲸鱼在加仓、哪条在跑路 — 在它们的订单还没冲击市场前，你就已经看到了。",
    "eng.3.s1": "发现",
    "eng.3.s2": "实时巨鲸",
    "eng.3.s3": "鲸鱼持仓",
    "eng.3.s4": "监控",
    "eng.3.cta": "追踪鲸鱼动向",

    "aiq.new": "+ 新建会话",
    "aiq.conv.t": "BTC 网格波段",
    "aiq.assistant": "AI 策略助手",
    "aiq.params": "参数配置",
    "aiq.run": "▶ 开始回测",
    "aiq.msg": "告诉我你的交易想法，我会帮你生成策略并回测。回测最大回撤需要 ≤ 20% 才能一键部署。",
    "aiq.input": "描述你的交易策略，例如：3 分钟跌 1% 买入…",

    "whale.title": "实时巨鲸 · BTC",
    "whale.r1": "Galaxy Digital",
    "whale.r2": "新地址 · 30 天",
    "whale.r3": "Cumberland",
    "whale.r4": "早期巨鲸 · 持币 9 年",


    "flow.eyebrow": "工作流程 · 共 3 步",
    "flow.title.1": "从一句话",
    "flow.title.2": "一条会赚钱的策略",
    "flow.lead": "不用写代码、不用懂指标。Coinflux 把整个量化工作流压缩进三步，每一步都看得见、改得动。",
    "flow.s1.t": "用自然语言说想法",
    "flow.s1.d": '中英都行。"BTC 跌 5% 加仓"、"ETH 突破布林上轨开多" —— AI 把口语翻译成可执行的策略逻辑。',
    "flow.s2.t": "AI 写策略 + 历史回测",
    "flow.s2.d": "秒级生成策略代码，跑遍 5 年历史 K 线。胜率、年化、回撤、夏普一次性给你。",
    "flow.s3.t": "一键托管，自动执行",
    "flow.s3.d": "连接交易所只读 + 下单 API，策略 7×24 自动跑。你随时可以暂停、调参、清盘。",

    "ft.eyebrow": "产品能力 · 四大支柱",
    "ft.title": "一台完整的量化引擎，长在 LLM 上面",
    "ft.lead": "从想法到下单，每一环都被打磨成可点、可改、可解释。下面这四件事，Coinflux 都替你做好了。",
    "ft.1.t": "自然语言生成策略",
    "ft.1.d": '基于专为交易调优的 LLM，把"低吸高抛""趋势加仓""跨币种对冲"这类口语，直接编译成可回测、可上线的策略。',
    "ft.2.t": "全周期历史回测",
    "ft.2.d": "2019 年至今的分钟级行情、永续资金费率、深度盘口都已就位。一键看到策略在牛熊、震荡、闪崩中的真实表现。",
    "ft.3.t": "仓位与风控守门",
    "ft.3.d": "单笔最大亏损、最大杠杆、单币种敞口、连续亏损熔断 —— 在 AI 下单之前，先把这些铁律加上去。",
    "ft.3.max": "最大杠杆",
    "ft.3.expo": "单币敞口",
    "ft.3.loss": "单日止损",
    "ft.3.fuse": "连亏熔断",
    "ft.4.t": "7×24 自动执行",
    "ft.4.d": "分布在 3 个区域的下单节点、延迟低于 80ms。即使你在睡觉，Coinflux 也在按你的策略一笔一笔下单。",

    "sc.eyebrow": "实盘策略 · 公开账本",
    "sc.title": "三条策略，三条曲线，公开账本",
    "sc.lead": "下方曲线全部来自实盘账户。点击任意一条即可在策略广场 fork 一份到你自己的交易所跑。",
    "sc.1.t": "BTC 网格波段",
    "sc.2.t": "ETH 趋势跟随",
    "sc.3.t": "资金费率套利",

    "mk.eyebrow": "策略广场",
    "mk.title": "2,400+ 条社区策略，全部带历史曲线",
    "mk.lead": "订阅、fork、改参数都行。每条策略都附带作者实盘记录，订阅自动跟随，停就停。",
    "mk.tab.all": "全部",
    "mk.tab.grid": "网格",
    "mk.tab.trend": "趋势",
    "mk.tab.arb": "套利",
    "mk.tab.ai": "AI 复合",
    "mk.update": "实时刷新 14:02 · 2,438 LIVE",
    "mk.col.name": "策略",
    "mk.col.type": "类型",
    "mk.col.30d": "30 日曲线",
    "mk.col.cagr": "年化",
    "mk.col.mdd": "最大回撤",
    "mk.col.sharpe": "夏普",
    "mk.col.sub": "订阅",

    "sec.eyebrow": "安全 · 从架构起",
    "sec.title": "资金永远不离开你的交易所",
    "sec.lead": "Coinflux 不是钱包，也不是托管平台。我们只通过你授权的 API 帮你下单 —— 提币这一项，永远是关的。",
    "sec.1.t": "仅读取 + 下单权限",
    "sec.1.d": "连接时强制关闭提币权限。若你给的 key 带提币权限，我们会拒绝接入并提示重建。",
    "sec.2.t": "端到端加密的 API Key",
    "sec.2.d": "使用 HSM 托管，Key 永不以明文形式离开安全飞地，工程师本人也看不到。",
    "sec.3.t": "随时可一键断开",
    "sec.3.d": "控制台一键撤销授权 + 平仓。无锁定期、无追溯抽成、无任何\"客服找你聊聊\"。",
    "sec.api": "API 权限 · BINANCE",
    "sec.api.read": "账户与持仓只读",
    "sec.api.spot": "现货 / 杠杆交易",
    "sec.api.futures": "合约交易",
    "sec.api.transfer": "内部划转",
    "sec.api.withdraw": "提币",
    "sec.api.ip": "IP 白名单",

    "cs.eyebrow": "用户 · 实盘",
    "cs.title": "不写代码的人，也在赚钱",
    "cs.lead": "下面三位都没有量化背景。他们贡献的实盘数据，刷新着我们对\"小白也能用\"这件事的理解。",
    "cs.1.q": '"以前看 K 线像看天书。现在我用普通话跟 Coinflux 描述行情，它就替我把策略写出来 —— 三个月没盯盘，账户多了两万多。"',
    "cs.1.n": "Liang · 上海",
    "cs.1.r": "设计师 · 业余交易者",
    "cs.2.q": '"我只会 Python 的 hello world。Coinflux 直接把我朋友圈里的\'土法择时\'翻译成可回测的策略，胜率出乎意料的稳。"',
    "cs.2.n": "Anya · 新加坡",
    "cs.2.r": "SaaS 创业公司 PM",
    "cs.3.q": '"风控这一关救了我两次。它会在我冲动加仓前弹窗，那两次后来都是闪崩。光这一点就值回订阅费。"',
    "cs.3.n": "Marcus · 柏林",
    "cs.3.r": "自由开发者",

    "cta.eyebrow": "准备好了就出发",
    "cta.title": "把你的下一个交易想法<br/>交给 Coinflux 跑一遍。",
    "cta.p": "注册 → 连交易所只读+下单 API → 描述策略。10 分钟内就能看到第一条回测曲线。",
    "cta.b1": "免费开始",
    "cta.b2": "预约 15 分钟演示",
    "cta.fine": "无需信用卡 · 无锁定期 · 永不接触提币权限",
    "cta.k1": "上手时间",
    "cta.k2": "支持交易所",
    "cta.k3": "首次回测",
    "cta.k4": "在线策略",
    "cta.k5": "资金托管",
    "cta.v5": "永远不",

    "foot.tag": "AI 量化交易，写给不会代码的你。用普通话描述策略，剩下的事 —— 回测、风控、执行 —— Coinflux 替你做。",
    "foot.product": "产品",
    "foot.features": "功能",
    "foot.market": "策略广场",
    "foot.security": "安全",
    "foot.pricing": "价格",
    "foot.dev": "开发者",
    "foot.docs": "文档",
    "foot.api": "API 参考",
    "foot.sdk": "Python SDK",
    "foot.status": "服务状态",
    "foot.company": "公司",
    "foot.cases": "客户",
    "foot.about": "关于我们",
    "foot.blog": "博客",
    "foot.careers": "招聘",
    "foot.legal": "法务",
    "foot.terms": "服务条款",
    "foot.privacy": "隐私",
    "foot.risk": "风险披露",
    "foot.compliance": "合规",
    "foot.disclaim": "加密交易存在风险。历史表现不代表未来收益。"
  },
  en: {
    "nav.ai": "AI Quant",
    "nav.data": "Data",
    "nav.data.1": "Market data",
    "nav.data.2": "L/S ratio",
    "nav.data.3": "Aggregated book",
    "nav.data.4": "Prediction markets",
    "nav.data.5": "Crypto equities",
    "nav.whale": "Whales",
    "nav.whale.1": "Discover",
    "nav.whale.2": "Live feed",
    "nav.whale.3": "Holdings",
    "nav.whale.4": "Watchlist",
    "nav.market": "Marketplace",
    "nav.features": "Product",
    "nav.strategies": "Marketplace",
    "nav.security": "Security",
    "nav.cases": "Customers",
    "nav.docs": "Docs",
    "nav.login": "Sign in",
    "nav.cta": "Start free",

    "hero.eyebrow": "AI QUANT · DATA · WHALES",
    "hero.title.1": "No code needed.",
    "hero.title.2": ".",
    "hero.title.3": "AI quant.",
    "hero.lead": "<strong>AI Quant</strong> · <strong>Multi-feed data</strong> · <strong>On-chain whales</strong> — three engines in one window. Describe a trading idea; Coinflux writes the strategy, runs the backtest, hooks your exchange API and fires the orders.",
    "hero.cta1": "Connect an exchange",
    "hero.cta2": "Browse marketplace",
    "hero.bullet1": "API has read + trade only — never withdrawal",
    "hero.bullet2": "Funds always stay on your exchange",
    "hero.term": "coinflux ▸ strategy console",
    "hero.term.desc": '"BTC adds 0.25 on -5%, sells half on +8%"',
    "hero.term.parsing": "→ parsed as grid + swing hybrid",
    "hero.term.entry": "entry",
    "hero.term.exit": "exit",
    "hero.term.add": "add 0.25 BTC",
    "hero.term.cut": "sell 50%",
    "hero.term.backtest": "→ backtesting 2021-01 — 2026-04…",
    "hero.stat.cagr": "CAGR",
    "hero.stat.win": "Win rate",
    "hero.stat.mdd": "Max drawdown",

    "ex.label": "Live on Binance / OKX / Hyperliquid",
    "ex.tg": "TELEGRAM",

    "eng.eyebrow": "THREE ENGINES · ONE WINDOW",
    "eng.title": "Three engines, living inside one product.",
    "eng.lead": "AI Quant does. Data sees. Whale Tracking follows. From signal to fill — one continuous chain.",

    "eng.1.t1": "AI Quant",
    "eng.1.t2": " · chat is the strategy",
    "eng.1.d": "Tell the assistant your idea — \"buy on a 1% drop over 3 min, sell on a 2% rip over 15 min\" is fine. AI compiles plain words into backtestable, deployable strategy code. You can only go live if backtest max drawdown is ≤ 20%.",
    "eng.1.s1": "Strategy assistant",
    "eng.1.s2": "Param config",
    "eng.1.s3": "Backtest",
    "eng.1.s4": "Marketplace",
    "eng.1.cta": "Enter AI Quant",

    "eng.2.t1": "Data",
    "eng.2.t2": " · see what others miss",
    "eng.2.d": "Minute-level OHLC, exchange long/short ratios, aggregated book depth, prediction-market odds, and crypto-equity correlation — five data lines feeding the model so the AI sees more than candles.",
    "eng.2.s1": "Market data",
    "eng.2.s2": "L/S ratio",
    "eng.2.s3": "Aggregated book",
    "eng.2.s4": "Prediction markets",
    "eng.2.s5": "Crypto ↔ equity",
    "eng.2.s6": "Data API",
    "eng.2.cta": "Browse all data",

    "eng.3.t1": "Whales",
    "eng.3.t2": " · follow the smart money",
    "eng.3.d": "Live monitoring of on-chain whale addresses, holding-change push, Telegram alerts. Which whale is loading up, which is dumping — you see it before the order hits the book.",
    "eng.3.s1": "Discover",
    "eng.3.s2": "Live feed",
    "eng.3.s3": "Holdings",
    "eng.3.s4": "Watchlist",
    "eng.3.cta": "Track the whales",

    "aiq.new": "+ New chat",
    "aiq.conv.t": "BTC grid swing",
    "aiq.assistant": "AI strategy assistant",
    "aiq.params": "Params",
    "aiq.run": "▶ Backtest",
    "aiq.msg": "Tell me your trading idea. I'll generate a strategy and backtest it. Backtest max drawdown must be ≤ 20% before you can deploy.",
    "aiq.input": "Describe your strategy, e.g. 1% dip over 3 min → buy…",

    "whale.title": "Live whales · BTC",
    "whale.r1": "Galaxy Digital",
    "whale.r2": "New address · 30 days",
    "whale.r3": "Cumberland",
    "whale.r4": "OG holder · 9 years",


    "flow.eyebrow": "HOW IT WORKS · 03 STEPS",
    "flow.title.1": "From a sentence",
    "flow.title.2": "to a strategy that prints PnL.",
    "flow.lead": "No code, no indicators to memorise. Coinflux compresses the entire quant workflow into three steps — every one of them visible and editable.",
    "flow.s1.t": "Describe your idea in plain language",
    "flow.s1.d": '"Add on BTC dips, trim on rips." "Long ETH on a 20-MA breakout." Coinflux translates your words into executable strategy logic.',
    "flow.s2.t": "AI writes the strategy + backtests it",
    "flow.s2.d": "Strategy code generated in seconds, tested against 5 years of minute-level OHLC. Win rate, CAGR, drawdown, Sharpe — all in one shot.",
    "flow.s3.t": "One click, hands-off execution",
    "flow.s3.d": "Connect a read + trade API key. Your strategy runs 24/7. Pause, retune, or shut it down anytime.",

    "ft.eyebrow": "PRODUCT · 04 PILLARS",
    "ft.title": "A full quant engine — sitting on top of an LLM.",
    "ft.lead": "From idea to fill, every link is clickable, editable and explainable. These are the four things Coinflux already handles for you.",
    "ft.1.t": "Natural-language strategies",
    "ft.1.d": 'A trading-tuned LLM compiles phrases like "buy dips, sell rips", "follow the trend", or "hedge across pairs" into backtestable, deployable strategies.',
    "ft.2.t": "Full-cycle backtesting",
    "ft.2.d": "Minute-level OHLC since 2019, plus perp funding rates and L2 depth. See how your strategy survives bulls, bears, chop and flash crashes.",
    "ft.3.t": "Risk & position controls",
    "ft.3.d": "Max loss per trade, max leverage, per-asset exposure, consecutive-loss circuit breakers — bolted on before the AI sends a single order.",
    "ft.3.max": "Max leverage",
    "ft.3.expo": "Per-asset",
    "ft.3.loss": "Daily stop",
    "ft.3.fuse": "Loss fuse",
    "ft.4.t": "24/7 automated execution",
    "ft.4.d": "Order routers in 3 regions, sub-80 ms tail latency. Even when you're asleep, Coinflux keeps firing orders the way your strategy says.",

    "sc.eyebrow": "FROM THE PLAYBOOK",
    "sc.title": "Three strategies, three curves, open ledger.",
    "sc.lead": "All curves below are pulled from live accounts. Click any one to fork it into your own exchange in two clicks.",
    "sc.1.t": "BTC grid swing",
    "sc.2.t": "ETH momentum",
    "sc.3.t": "Funding-rate arb",

    "mk.eyebrow": "STRATEGY MARKETPLACE",
    "mk.title": "2,400+ community strategies — every one with a live curve.",
    "mk.lead": "Subscribe, fork or retune. Each strategy ships with its author's live PnL — auto-follow when you subscribe, stop the moment you want to.",
    "mk.tab.all": "All",
    "mk.tab.grid": "Grid",
    "mk.tab.trend": "Trend",
    "mk.tab.arb": "Arb",
    "mk.tab.ai": "AI hybrid",
    "mk.update": "UPDATED 14:02 · 2,438 LIVE",
    "mk.col.name": "Strategy",
    "mk.col.type": "Type",
    "mk.col.30d": "30D curve",
    "mk.col.cagr": "CAGR",
    "mk.col.mdd": "Max DD",
    "mk.col.sharpe": "Sharpe",
    "mk.col.sub": "Subs",

    "sec.eyebrow": "SECURITY · BY DESIGN",
    "sec.title": "Your funds never leave the exchange.",
    "sec.lead": "Coinflux is not a wallet and not a custodian. We only place orders through the API key you authorize — and withdrawal is always off.",
    "sec.1.t": "Read + trade permissions only",
    "sec.1.d": "We refuse keys that carry withdrawal rights and ask you to regenerate without them.",
    "sec.2.t": "End-to-end encrypted API keys",
    "sec.2.d": "Stored in an HSM-backed enclave. Keys never exist in plaintext outside it — not even to our engineers.",
    "sec.3.t": "One-click off-ramp",
    "sec.3.d": "Revoke auth + flatten positions in one button. No lock-in, no clawback, no \"can we hop on a call\".",
    "sec.api": "API PERMISSIONS · BINANCE",
    "sec.api.read": "Read account & positions",
    "sec.api.spot": "Spot & margin trade",
    "sec.api.futures": "Futures trade",
    "sec.api.transfer": "Internal transfer",
    "sec.api.withdraw": "Withdrawal",
    "sec.api.ip": "IP whitelist",

    "cs.eyebrow": "USERS · LIVE PNL",
    "cs.title": "People who don't write code — making money anyway.",
    "cs.lead": "None of the three below has a quant background. The live numbers they share keep rewriting what \"built for everyone\" really means.",
    "cs.1.q": "\"I used to stare at candlesticks and see nothing. Now I just describe the market in plain words and Coinflux writes the strategy. Three months hands-off, +$23k.\"",
    "cs.1.n": "Liang · Shanghai",
    "cs.1.r": "Designer · part-time trader",
    "cs.2.q": "\"My Python ends at hello world. Coinflux turned the back-of-the-napkin timing rules I scribble into a backtestable strategy. Stable beyond expectation.\"",
    "cs.2.n": "Anya · Singapore",
    "cs.2.r": "PM at SaaS startup",
    "cs.3.q": "\"The risk layer saved me twice. It blocked an emotional add — and both times it turned out to be a flash crash. Worth the subscription alone.\"",
    "cs.3.n": "Marcus · Berlin",
    "cs.3.r": "Freelance developer",

    "cta.eyebrow": "READY WHEN YOU ARE",
    "cta.title": "Hand your next trading idea<br/>to Coinflux. See it tomorrow.",
    "cta.p": "Sign up → connect a read+trade API key → describe a strategy. First backtest curve in under 10 minutes.",
    "cta.b1": "Start free",
    "cta.b2": "Book a 15-min demo",
    "cta.fine": "NO CARD · NO LOCK-IN · NO WITHDRAWAL PERMISSION",
    "cta.k1": "SETUP TIME",
    "cta.k2": "SUPPORTED EXCHANGES",
    "cta.k3": "FIRST BACKTEST",
    "cta.k4": "LIVE STRATEGIES",
    "cta.k5": "CUSTODY",
    "cta.v5": "NEVER",

    "foot.tag": "AI quantitative trading for the rest of us. Describe a strategy in plain language — Coinflux backtests, risk-checks and executes.",
    "foot.product": "PRODUCT",
    "foot.features": "Features",
    "foot.market": "Strategy market",
    "foot.security": "Security",
    "foot.pricing": "Pricing",
    "foot.dev": "DEVELOPERS",
    "foot.docs": "Documentation",
    "foot.api": "API reference",
    "foot.sdk": "Python SDK",
    "foot.status": "Status",
    "foot.company": "COMPANY",
    "foot.cases": "Customers",
    "foot.about": "About",
    "foot.blog": "Blog",
    "foot.careers": "Careers",
    "foot.legal": "LEGAL",
    "foot.terms": "Terms",
    "foot.privacy": "Privacy",
    "foot.risk": "Risk disclosure",
    "foot.compliance": "Compliance",
    "foot.disclaim": "CRYPTO TRADING INVOLVES RISK. PAST PERFORMANCE ≠ FUTURE RESULTS."
  }
};

/* ----- 3. Apply translations ----- */
let currentLang = "zh";
function applyLang(lang) {
  currentLang = lang;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  const dict = I18N[lang];
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] != null) el.innerHTML = dict[key];
  });
  document.querySelectorAll(".lang-toggle button").forEach(b => {
    b.classList.toggle("is-on", b.dataset.lang === lang);
  });
  renderMarket();
}

/* ----- 4. Theme ----- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const moon = document.querySelector(".i-moon");
  const sun  = document.querySelector(".i-sun");
  if (theme === "light") {
    moon.style.display = "none";
    sun.style.display  = "block";
  } else {
    moon.style.display = "block";
    sun.style.display  = "none";
  }
}

/* ----- 5. Reveal-on-scroll ----- */
function initReveal() {
  // Only opt-in if the page is actually visible to the user.
  // In a hidden/background tab, CSS animations pause — which would strand
  // elements at opacity 0. So we keep the default visible state and only
  // attach the animation class when the user is actually looking.
  if (document.visibilityState !== "visible") return;
  document.querySelectorAll("[data-reveal]").forEach(el => el.classList.add("reveal-go"));
}

/* ----- 6. Marketplace data ----- */
const STRATEGIES = [
  { gly: "MA",  name: "MA 均线交叉",     name_en: "MA Crossover",        author: "BTC-USDT-SWAP · 15m",  type: "趋势",   type_en: "Trend", curve: "up",   cagr: "+58.1%", win: "58.14%", mdd: "-0.78%", sharpe: "1.94", subs: "1,284" },
  { gly: "BOLL",name: "布林带均值回归",   name_en: "Bollinger Mean Rev",  author: "ETH-USDT-SWAP · 15m",  type: "均值",   type_en: "Mean", curve: "up",   cagr: "+62.4%", win: "79.49%", mdd: "-1.64%", sharpe: "2.41", subs: "892"  },
  { gly: "GRID",name: "区间低买高卖",     name_en: "Range Grid",          author: "BTC-USDT · 15m",       type: "网格",   type_en: "Grid",  curve: "flat", cagr: "+22.8%", win: "82.61%", mdd: "-0.93%", sharpe: "2.18", subs: "612"  },
  { gly: "RSI", name: "RSI 超买超卖",     name_en: "RSI Mean Rev",        author: "ETH-USDT · 15m",       type: "反转",   type_en: "Rev",   curve: "up",   cagr: "+18.9%", win: "78.95%", mdd: "-1.76%", sharpe: "1.62", subs: "2,104" },
  { gly: "BRK", name: "突破追踪",         name_en: "Breakout Follow",     author: "BTC-USDT-SWAP · 15m",  type: "趋势",   type_en: "Trend", curve: "up",   cagr: "+74.2%", win: "70.59%", mdd: "-1.04%", sharpe: "2.05", subs: "1,608" },
  { gly: "MACD",name: "MACD 金叉死叉",    name_en: "MACD Crossover",      author: "ETH-USDT-SWAP · 15m",  type: "趋势",   type_en: "Trend", curve: "up",   cagr: "+44.0%", win: "58.33%", mdd: "-1.34%", sharpe: "1.78", subs: "734"  },
  { gly: "FND", name: "资金费率套利",     name_en: "Funding Arb",         author: "OKX · 8H · 永续",      type: "套利",   type_en: "Arb",   curve: "up",   cagr: "+12.4%", win: "82.7%",  mdd: "-3.1%",  sharpe: "3.42", subs: "528"  },
  { gly: "AI",  name: "AI 复合策略",      name_en: "AI Composer",         author: "多 TF · 多市场",       type: "复合",   type_en: "AI",    curve: "up",   cagr: "+38.1%", win: "62.4%",  mdd: "-8.9%",  sharpe: "1.88", subs: "418"  }
];

function curveSvg(kind) {
  const points = kind === "up"
    ? [22,21,23,20,18,19,16,17,14,15,12,13,10,11,8,6,4]
    : kind === "flat"
    ? [16,15,17,14,16,15,17,15,14,16,15,14,16,15,17,15,16]
    : [10,12,11,14,13,16,15,18,17,20,19,22,21,24,23,26];
  const w = 120, h = 28;
  const step = w / (points.length - 1);
  const d = points.map((y, i) => `${i === 0 ? "M" : "L"}${(i*step).toFixed(1)},${y}`).join(" ");
  const color = kind === "up" ? "var(--chart-up)" : kind === "flat" ? "var(--accent)" : "var(--chart-down)";
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderMarket() {
  const tbody = document.getElementById("market-body");
  if (!tbody) return;
  const isZh = currentLang === "zh";
  tbody.innerHTML = STRATEGIES.map(s => `
    <tr>
      <td>
        <div class="strat-name">
          <div class="glyph">${s.gly}</div>
          <div>
            <div>${isZh ? s.name : s.name_en}</div>
            <small>${s.author}</small>
          </div>
        </div>
      </td>
      <td><span class="type-pill">${isZh ? s.type : s.type_en}</span></td>
      <td class="spark-cell">${curveSvg(s.curve)}</td>
      <td class="num-cell up">${s.cagr}</td>
      <td class="num-cell">${s.mdd}</td>
      <td class="num-cell">${s.sharpe}</td>
      <td class="num-cell">${s.subs}</td>
    </tr>
  `).join("");
}

/* ----- 7. Tweaks panel (vanilla, theme only) ----- */
function buildTweaksPanel() {
  const root = document.getElementById("tweaks-root");
  root.innerHTML = `
    <div class="tweaks" id="tweaks-card" hidden>
      <div class="tweaks-head">
        <span>Tweaks</span>
        <button class="tx" id="tweaksClose" aria-label="Close">×</button>
      </div>
      <div class="tweaks-body">
        <div class="tweaks-row">
          <label>Theme</label>
          <div class="seg" role="tablist">
            <button data-theme-opt="dark">Dark</button>
            <button data-theme-opt="light">Light</button>
          </div>
        </div>
        <div class="tweaks-row">
          <label>Accent</label>
          <div class="swatches">
            <button data-accent="#A78BFA" style="--c:#A78BFA"></button>
            <button data-accent="#7CFFB2" style="--c:#7CFFB2"></button>
            <button data-accent="#FFB547" style="--c:#FFB547"></button>
            <button data-accent="#6AA9FF" style="--c:#6AA9FF"></button>
          </div>
        </div>
      </div>
    </div>
    <style>
      .tweaks {
        width: 240px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 14px;
        box-shadow: 0 20px 40px -20px rgba(0,0,0,0.6);
        font-family: var(--font-body);
      }
      .tweaks-head {
        display: flex; align-items: center;
        font-family: var(--font-mono);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-mid);
        margin-bottom: 12px;
      }
      .tweaks-head .tx {
        margin-left: auto;
        width: 22px; height: 22px;
        border-radius: 6px;
        background: transparent;
        border: 1px solid var(--border);
        color: var(--text-mid);
        font-size: 14px; line-height: 1;
      }
      .tweaks-body { display: grid; gap: 14px; }
      .tweaks-row label {
        font-family: var(--font-mono);
        font-size: 10.5px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-dim);
        display: block;
        margin-bottom: 6px;
      }
      .seg {
        display: inline-flex;
        border: 1px solid var(--border);
        border-radius: 999px; padding: 3px;
        background: var(--bg);
      }
      .seg button {
        border: 0; background: transparent;
        padding: 5px 12px; font-size: 12px;
        border-radius: 999px;
        color: var(--text-mid);
        font-family: var(--font-body);
      }
      .seg button.is-on { background: var(--text); color: var(--bg); }
      .swatches { display: flex; gap: 8px; }
      .swatches button {
        width: 26px; height: 26px;
        border-radius: 8px;
        background: var(--c);
        border: 1px solid var(--border);
        position: relative;
      }
      .swatches button.is-on::after {
        content: "";
        position: absolute; inset: -3px;
        border: 1px solid var(--text);
        border-radius: 11px;
      }
    </style>
  `;

  const card = document.getElementById("tweaks-card");
  document.getElementById("tweaksClose").addEventListener("click", () => {
    card.hidden = true;
    window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*");
  });
  card.querySelectorAll("[data-theme-opt]").forEach(b => {
    b.addEventListener("click", () => setTweak({ theme: b.dataset.themeOpt }));
  });
  card.querySelectorAll("[data-accent]").forEach(b => {
    b.addEventListener("click", () => setTweak({ accent: b.dataset.accent }));
  });

  function refresh() {
    card.querySelectorAll("[data-theme-opt]").forEach(b =>
      b.classList.toggle("is-on", b.dataset.themeOpt === TWEAKS.theme));
    card.querySelectorAll("[data-accent]").forEach(b =>
      b.classList.toggle("is-on", b.dataset.accent.toLowerCase() === TWEAKS.accent.toLowerCase()));
  }
  refresh();

  window.__tweaksRefresh = refresh;
  window.__tweaksCard = card;
}

/* state + persistence */
const TWEAKS = { ...TWEAK_DEFAULTS };
function setTweak(patch) {
  Object.assign(TWEAKS, patch);
  if (patch.theme) applyTheme(patch.theme);
  if (patch.accent) document.documentElement.style.setProperty("--accent", patch.accent);
  window.parent.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*");
  if (window.__tweaksRefresh) window.__tweaksRefresh();
}

/* edit-mode host protocol */
window.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "__activate_edit_mode" && window.__tweaksCard) window.__tweaksCard.hidden = false;
  if (d.type === "__deactivate_edit_mode" && window.__tweaksCard) window.__tweaksCard.hidden = true;
});

/* ----- 8. Boot ----- */
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(TWEAKS.theme);
  document.documentElement.style.setProperty("--accent", TWEAKS.accent);

  applyLang("zh");
  document.querySelectorAll(".lang-toggle button").forEach(b => {
    b.addEventListener("click", () => applyLang(b.dataset.lang));
  });

  document.getElementById("themeBtn").addEventListener("click", () => {
    setTweak({ theme: TWEAKS.theme === "dark" ? "light" : "dark" });
  });

  renderMarket();
  initReveal();
  buildTweaksPanel();
  initNavDropdowns();

  window.parent.postMessage({ type: "__edit_mode_available" }, "*");
});

/* ----- 9. Nav dropdowns + mobile drawer ----- */
function initNavDropdowns() {
  const items = document.querySelectorAll(".nav-item[data-dropdown]");
  const isMobile = () => window.matchMedia("(max-width: 880px)").matches;

  items.forEach(item => {
    const btn = item.querySelector("button");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = item.classList.contains("is-open");
      // close siblings (only when not in mobile drawer accordion)
      if (!isMobile()) {
        items.forEach(i => i.classList.remove("is-open"));
      }
      item.classList.toggle("is-open", !wasOpen);
    });
    item.addEventListener("mouseenter", () => {
      if (!isMobile()) {
        items.forEach(i => i.classList.remove("is-open"));
        item.classList.add("is-open");
      }
    });
    item.addEventListener("mouseleave", () => {
      if (!isMobile()) item.classList.remove("is-open");
    });
  });

  // click outside closes
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-item")) {
      items.forEach(i => i.classList.remove("is-open"));
    }
  });

  // mobile drawer toggle
  const toggle = document.getElementById("mobileToggle");
  const drawer = document.getElementById("navLinks");
  if (toggle && drawer) {
    toggle.addEventListener("click", () => {
      drawer.classList.toggle("is-open");
    });
    drawer.querySelectorAll(".nav-item:not([data-dropdown]) a").forEach(a => {
      a.addEventListener("click", () => drawer.classList.remove("is-open"));
    });
    drawer.querySelectorAll(".nav-pop a").forEach(a => {
      a.addEventListener("click", () => drawer.classList.remove("is-open"));
    });
  }
}

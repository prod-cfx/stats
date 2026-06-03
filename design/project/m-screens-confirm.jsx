/* ========================================================================
   SCREEN — 确认策略 (StratConfirm)
   AI flow: 对话 → AI 给出参数 → [确认策略] → 开始回测
   ======================================================================== */

const STRAT_SCRIPT_BTC = `// Quantify Strategy · BTC 趋势 · 双均线
// Generated 2026-05-26 09:41 · v1.0
// Source: AI dialogue session #s1

import { Strategy, MA } from '@quantify/sdk';

export default class BTCTrendMA extends Strategy {
  static SYMBOL    = 'BTC/USDT';
  static TIMEFRAME = '15m';
  static MARKET    = 'futures';   // 'spot' | 'futures'
  static LEVERAGE  = 5;

  // strategy hyperparameters
  static FAST_PERIOD = 5;
  static SLOW_PERIOD = 20;
  static STOP_LOSS   = 0.02;      // 2% trailing
  static POSITION    = 1.0;       // 100% of available

  constructor() {
    super();
    this.fast = new MA({ period: BTCTrendMA.FAST_PERIOD });
    this.slow = new MA({ period: BTCTrendMA.SLOW_PERIOD });
  }

  onBar(bar) {
    this.fast.update(bar.close);
    this.slow.update(bar.close);

    // not enough data yet — both MAs must be warm
    if (!this.fast.ready || !this.slow.ready) return;

    // entry: fast MA crosses above slow MA
    if (this.fast.crossAbove(this.slow) && !this.position) {
      return this.openLong({
        size: BTCTrendMA.POSITION,
        stopLoss: bar.close * (1 - BTCTrendMA.STOP_LOSS),
        tag: 'ma_cross_up',
      });
    }

    // exit: fast MA crosses below slow MA
    if (this.position && this.fast.crossBelow(this.slow)) {
      return this.closePosition({ reason: 'ma_cross_down' });
    }
  }

  onStopHit(position) {
    this.notify(\`[stop] \${position.symbol} @ \${position.exitPrice}\`);
    return this.onPositionClosed(position);
  }
}
`;

const STRAT_SCRIPT_ETH = `// Quantify Strategy · ETH 网格 · 区间震荡
// Generated 2026-05-26 09:41 · v1.0
// Source: AI dialogue session #s4

import { Strategy, Grid } from '@quantify/sdk';

export default class ETHRangeGrid extends Strategy {
  static SYMBOL    = 'ETH/USDT';
  static TIMEFRAME = '1h';
  static MARKET    = 'spot';      // spot only — no leverage

  // grid hyperparameters
  static LOWER_PRICE  = 2400;
  static UPPER_PRICE  = 3000;
  static GRID_COUNT   = 10;
  static SIZE_PER_BUY = 0.1;      // 10% of capital per grid level
  static STOP_BREAK   = 0.02;     // pause if range breaks down 2%

  constructor() {
    super();
    this.grid = new Grid({
      lower: ETHRangeGrid.LOWER_PRICE,
      upper: ETHRangeGrid.UPPER_PRICE,
      count: ETHRangeGrid.GRID_COUNT,
    });
  }

  onBar(bar) {
    // bail out if price breaks down — grids are useless in trends
    if (bar.close < ETHRangeGrid.LOWER_PRICE * (1 - ETHRangeGrid.STOP_BREAK)) {
      this.notify('[grid] range broken, pausing');
      return this.pause({ reason: 'range_break' });
    }

    // buy when crossing a grid line going down
    const buyLine = this.grid.crossedDown(bar.close);
    if (buyLine && !this.holdsAt(buyLine)) {
      return this.openLong({
        size: ETHRangeGrid.SIZE_PER_BUY,
        price: buyLine,
        tag: \`grid_buy_\${buyLine}\`,
      });
    }

    // sell when crossing a grid line going up
    const sellLine = this.grid.crossedUp(bar.close);
    if (sellLine && this.holdsAt(sellLine - this.grid.step)) {
      return this.closeAt({
        price: sellLine,
        reason: \`grid_sell_\${sellLine}\`,
      });
    }
  }
}
`;

/* two demo scenarios — toggle on the page to compare futures vs. spot */
const STRAT_SCENARIOS = {
  btc: {
    name: 'BTC 趋势 · 双均线',
    category: '趋势跟踪',
    categoryTone: 'violet',
    pair: 'BTC/USDT',
    tf: '15m',
    market: '合约',
    lev: '5x',
    icon: 'M3 12l4-8 5 14 5-10 4 6',
    script: STRAT_SCRIPT_BTC,
    file: 'btc_trend_ma.js',
    sourceMsg: 'BTC 15 分钟周期,5 日均线上穿 20 日均线开多,跌破平仓,止损 2%。',
    summary: [
    { tag: '入场', toneKey: 'ok',
      text: <>当 <Mono>fast_MA(5)</Mono> 上穿 <Mono>slow_MA(20)</Mono> 时<Strong>开多</Strong></> },
    { tag: '出场', toneKey: 'danger',
      text: <>当 <Mono>fast_MA(5)</Mono> 下穿 <Mono>slow_MA(20)</Mono> 时<Strong>平仓</Strong></> },
    { tag: '止损', toneKey: 'warn',
      text: <>持仓回撤 <Strong>≥ 2.0%</Strong> 立即止损</> }],

    params: [
    { k: 'fast_ma', v: '5', unit: '根 K 线', note: '快速均线周期' },
    { k: 'slow_ma', v: '20', unit: '根 K 线', note: '慢速均线周期' },
    { k: 'stop_loss', v: '2.0', unit: '%', note: '单笔最大亏损' },
    { k: 'position', v: '100', unit: '%', note: '每次开仓占用资金' }],

    advice: '该策略在 BTC 4H/15m 上历史表现稳定,但在区间震荡市场可能出现频繁假突破。建议同时开启「ATR 过滤」减少噪音。',
    rules: [
    { iff: 'MA5 上穿 MA20,且当前未持有任何方向仓位', then: '开多 100%' },
    { iff: 'MA5 下穿 MA20', then: '平多' },
    { iff: '持仓回撤 ≥ 2.0% (触发追踪止损)', then: '强制平多' }],

    execute: {
      exchange: 'OKX', symbol: 'BTCUSDT', period: '15m', position: '100%', market: '永续合约',
      risks: [
      { kind: '止损', desc: '价格相对入场均价下跌 2% → 强制平仓' },
      { kind: '止盈', desc: '价格相对入场均价上涨 0.6% → 平仓' }]

    }
  },
  eth: {
    name: 'ETH 网格 · 区间震荡',
    category: '网格',
    categoryTone: 'info',
    pair: 'ETH/USDT',
    tf: '1H',
    market: '现货',
    lev: null,
    icon: 'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16',
    script: STRAT_SCRIPT_ETH,
    file: 'eth_range_grid.js',
    sourceMsg: 'ETH 1 小时,在 2400-3000 区间内做网格,10 格,每格 10% 仓位,跌破 2% 暂停。',
    summary: [
    { tag: '入场', toneKey: 'ok',
      text: <>价格下穿任一网格线时<Strong>分批买入</Strong>,每格 <Mono>10%</Mono> 仓位</> },
    { tag: '出场', toneKey: 'danger',
      text: <>价格上穿对应网格线时<Strong>平仓获利</Strong></> },
    { tag: '风控', toneKey: 'warn',
      text: <>跌破区间下沿 <Strong>≥ 2%</Strong> 暂停网格,等待人工恢复</> }],

    params: [
    { k: 'lower_price', v: '2400', unit: 'USDT', note: '网格区间下沿' },
    { k: 'upper_price', v: '3000', unit: 'USDT', note: '网格区间上沿' },
    { k: 'grid_count', v: '10', unit: '格', note: '区间内等分格数' },
    { k: 'size_per_buy', v: '10', unit: '%', note: '每格买入资金比例' }],

    advice: '该策略适合 ETH 在 2400-3000 区间震荡的行情。如出现单边趋势(尤其向下突破),会持续被动接货并产生浮亏,务必关注风控提示。',
    rules: [
    { iff: '价格下穿任一网格线,且该网格尚未持仓', then: '分批买入 10% 仓位' },
    { iff: '价格上穿对应网格线 (该格已有持仓)', then: '平该格仓位获利' },
    { iff: '价格跌破区间下沿 ≥ 2%', then: '暂停网格 (等待人工恢复)' }],

    execute: {
      exchange: 'OKX', symbol: 'ETHUSDT', period: '1h', position: '10% / 格', market: '现货',
      risks: [
      { kind: '区间', desc: '下沿 2,400 USDT / 上沿 3,000 USDT,共 10 格' },
      { kind: '熔断', desc: '价格跌破区间下沿 2% → 暂停网格' }]

    }
  }
};

function ScreenStratConfirm() {
  // pick scenario from the currently-active chat session, if any
  const sess = window.__qfChatSessions;
  const active = sess?.items?.find((s) => s.id === sess.currentId);
  const initialKey = active?.scenario || window.__qfStratScenario || 'btc';
  React.useEffect(() => {window.__qfStratScenario = initialKey;}, [initialKey]);
  const strat = STRAT_SCENARIOS[initialKey] || STRAT_SCENARIOS.btc;
  const market = strat.market;
  const lev = strat.lev;
  const toneMap = { ok: M.ok, danger: M.danger, warn: M.warn };

  // script generation flow — user must generate + confirm before 下一步 enables
  const [scriptStage, setScriptStage] = React.useState('idle'); // idle | generating | ready
  const [expanded, setExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const confirmed = scriptStage === 'ready';
  // reset script when scenario changes
  React.useEffect(() => {setScriptStage('idle');setExpanded(false);}, [initialKey]);

  const generateScript = () => {
    if (scriptStage !== 'idle') return;
    setScriptStage('generating');
    setTimeout(() => setScriptStage('ready'), 1500);
  };
  const copyScript = () => {
    navigator.clipboard?.writeText(strat.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: M.bg }}>
      <MStatus />
      <MTopBar
        title="确认策略"
        sub="检查参数无误后开始回测"
        onBack
        backTo="ai"
        right={
        <button data-back="ai" style={{
          height: 30, padding: '0 12px', borderRadius: 8,
          border: `1px solid ${M.border}`, background: M.elev,
          color: M.mid, fontSize: 12, fontWeight: 500, cursor: 'pointer'
        }}>取消</button>
        } />
      

      {/* steps indicator (5 steps) */}
      <BtcStepBar active={0} done={[]} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 100px' }}>
        {/* hero — strategy identity */}
        <Card p="16px" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: M.violetSoft,
              color: M.violet, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Ico d={ICONS.spark} w={20} sw={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: M.text, letterSpacing: -0.2 }}>
                {strat.name}
              </div>
              <div style={{ fontSize: 11, color: M.dim, marginTop: 2 }}>
                由当前对话生成 · 可在对话中继续微调
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Chip tone={strat.categoryTone} style={{ whiteSpace: 'nowrap' }}>{strat.category}</Chip>
            <Chip style={{ whiteSpace: 'nowrap' }}>{strat.pair}</Chip>
            <Chip style={{ whiteSpace: 'nowrap' }}>{strat.tf}</Chip>
            <Chip tone="info" style={{ whiteSpace: 'nowrap' }}>
              {market}{lev ? ` · ${lev}` : ''}
            </Chip>
          </div>
        </Card>

        {/* strategy logic — IF / AND AT THEN blocks + EXECUTE
                  matches the desktop "策略确认" structure */}
        <SectTitle right={<EditLink />}>策略逻辑</SectTitle>
        {strat.rules.map((r, i) =>
        <React.Fragment key={i}>
            {i > 0 &&
          <div style={{
            padding: '8px 0 6px', textAlign: 'center',
            fontSize: 10, fontWeight: 600, letterSpacing: 1.4,
            color: M.dim
          }}>AND AT THEN</div>
          }
            <RuleBlock iff={r.iff} then={r.then} />
          </React.Fragment>
        )}

        <div style={{ height: 14 }} />

        {/* execute block */}
        <ExecuteBlock x={strat.execute} />

        <div style={{ height: 14 }} />

        {/* AI advice */}
        <div style={{
          padding: '12px 14px', marginBottom: 14,
          background: M.violetSoft, borderRadius: 12,
          display: 'flex', gap: 10, alignItems: 'flex-start'
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: M.violet, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Ico d={ICONS.bot} w={14} sw={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: M.violet, marginBottom: 4 }}>
              AI 提示
            </div>
            <div style={{ fontSize: 12, color: M.text, lineHeight: 1.65, opacity: 0.85 }}>
              {strat.advice}
            </div>
          </div>
        </div>

        {/* disclaimer */}
        <div style={{
          padding: '10px 0', fontSize: 11, color: M.dim, lineHeight: 1.6,
          display: 'flex', gap: 6, alignItems: 'flex-start'
        }}>
          <Ico d={ICONS.shield} w={12} sw={1.6} />
          <span>
            回测基于历史数据,无法保证实盘表现。部署前请使用模拟账户验证。
          </span>
        </div>
      </div>

      {/* sticky action bar */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30,
        padding: '12px 16px 36px',
        background: `linear-gradient(180deg, transparent, ${M.bg} 30%)`,
        display: 'flex', gap: 10
      }}>
        <button data-back="ai" style={{
          flex: 1, height: 50, borderRadius: 14,
          border: `1px solid ${M.border}`, background: M.elev,
          color: M.text, fontSize: 14, fontWeight: 500, cursor: 'pointer'
        }}>返回对话</button>
        <button
          data-go-script="true"
          style={{
            flex: 2, height: 50, borderRadius: 14, border: 0,
            background: M.violetGrad,
            color: '#fff',
            fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
            boxShadow: '0 8px 24px rgba(124,92,255,0.32)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>
          下一步:策略脚本
          <Ico d={ICONS.caretR} w={13} sw={2.4} />
        </button>
      </div>
    </div>);

}

/* ---- small helpers used only on this screen ---- */
function Step({ n, label, active, done }) {
  const dotBg = done ? M.violet : active ? M.violet : M.soft;
  const dotFg = done || active ? '#fff' : M.dim;
  const dotBd = active ? `0 0 0 4px ${M.violetRing || 'rgba(124,92,255,0.12)'}` : 'none';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      <div style={{
        width: 22, height: 22, borderRadius: 11, background: dotBg, color: dotFg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, fontFamily: M.mono, boxShadow: dotBd,
        flexShrink: 0, transition: 'all 160ms'
      }}>
        {done ?
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff"
        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5 9-11" />
            </svg> :
        n}
      </div>
      <span style={{
        fontSize: 11, fontWeight: active ? 600 : 500, whiteSpace: 'nowrap',
        color: active ? M.text : done ? M.mid : M.dim
      }}>{label}</span>
    </div>);

}
function StepDash({ done }) {
  return <div style={{
    flex: 1, height: 2, borderRadius: 1, minWidth: 8,
    background: done ? M.violet : M.borderSoft,
    opacity: done ? 0.5 : 1
  }} />;
}
function SectTitle({ children, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '4px 4px 8px', gap: 8
    }}>
      <div style={{
        fontSize: 12, color: M.mid, fontWeight: 600, letterSpacing: 0.2,
        whiteSpace: 'nowrap'
      }}>
        {children}
      </div>
      {right}
    </div>);

}
function EditLink() {
  return (
    <button data-back="ai" style={{
      height: 24, padding: '0 8px', borderRadius: 6, border: 0,
      background: 'transparent', color: M.violet,
      fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
      flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', gap: 3
    }}>
      <Ico d="M4 20h4l10-10-4-4L4 16v4z" w={11} sw={1.8} />
      在对话中修改
    </button>);

}
function Mono({ children }) {
  return <span style={{ fontFamily: M.mono, fontSize: 12, color: M.violet, padding: '1px 5px',
    background: M.violetSoft, borderRadius: 4 }}>{children}</span>;
}
function Strong({ children }) {
  return <strong style={{ color: M.text, fontWeight: 600 }}>{children}</strong>;
}

function CfgBlock({ label, sub, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 8
      }}>
        <span style={{ fontSize: 12, color: M.mid, fontWeight: 500 }}>{label}</span>
        {sub && <span style={{ fontSize: 11, color: M.dim, fontFamily: M.mono }}>{sub}</span>}
      </div>
      {children}
    </div>);

}
function CfgInline({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: M.dim, marginBottom: 4 }}>{label}</div>
      <div style={{
        height: 36, padding: '0 10px', borderRadius: 8,
        background: M.soft, border: `1px solid ${M.borderSoft}`,
        display: 'flex', alignItems: 'center', gap: 6
      }}>{children}</div>
    </div>);

}

function ScriptViewer({ strat, expanded, setExpanded }) {
  const lines = strat.script.split('\n');
  const COLLAPSED_LINES = 12;
  const shown = expanded ? lines : lines.slice(0, COLLAPSED_LINES);
  const hasMore = lines.length > COLLAPSED_LINES;

  return (
    <div style={{
      background: '#1a1530', borderRadius: 12, border: `1px solid ${M.border}`,
      marginBottom: 14, overflow: 'hidden', position: 'relative'
    }}>
      {/* terminal-style header */}
      <div style={{
        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: '#FF5F57' }} />
        <span style={{ width: 10, height: 10, borderRadius: 5, background: '#FEBC2E' }} />
        <span style={{ width: 10, height: 10, borderRadius: 5, background: '#28C840' }} />
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: M.mono, fontSize: 10, color: 'rgba(255,255,255,0.5)',
          whiteSpace: 'nowrap'
        }}>{strat.file}</span>
        <span style={{
          padding: '2px 6px', borderRadius: 4,
          background: 'rgba(22,199,131,0.18)', color: '#5EEAA8',
          fontSize: 9, fontWeight: 700, letterSpacing: 0.4, marginLeft: 6
        }}>✓ READY</span>
      </div>

      {/* code body */}
      <div style={{
        padding: '10px 0 0', overflow: 'hidden', position: 'relative',
        maxHeight: expanded ? 'none' : 220
      }}>
        <pre style={{
          margin: 0, padding: '0 12px 12px',
          fontFamily: M.mono, fontSize: 11, lineHeight: 1.6,
          color: '#D9D5F0',
          whiteSpace: 'pre', overflow: 'auto', height: "300px"
        }}>
{shown.map((line, i) =>
          <CodeLine key={i} n={i + 1} text={line} />
          )}
        </pre>
        {/* gradient fade when collapsed */}
        {!expanded && hasMore &&
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 48,
          background: 'linear-gradient(180deg, transparent, #1a1530)',
          pointerEvents: 'none'
        }} />
        }
      </div>

      {/* expand toggle */}
      {hasMore &&
      <button onClick={() => setExpanded((e) => !e)} style={{
        width: '100%', padding: '10px', border: 0,
        background: 'rgba(255,255,255,0.04)', cursor: 'pointer',
        color: '#A78BFA', fontSize: 12, fontWeight: 500,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
      }}>
          <span style={{
          display: 'inline-flex',
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 160ms'
        }}>
            <Ico d={ICONS.caret} w={13} sw={2} />
          </span>
          {expanded ? '收起' : `查看全部 ${lines.length} 行`}
        </button>
      }
    </div>);

}

/* simple JS-ish syntax coloring */
function CodeLine({ n, text }) {
  // detect line comment (//) — but ignore if inside a string
  const commentMatch = text.match(/(^|[^:'"`\\])\/\/(.*)$/);
  let pre = text,comment = '';
  if (commentMatch) {
    const idx = text.indexOf('//', commentMatch.index);
    // crude: only treat as comment if no quotes between line start and //
    const before = text.slice(0, idx);
    const dq = (before.match(/"/g) || []).length;
    const sq = (before.match(/'/g) || []).length;
    const bt = (before.match(/`/g) || []).length;
    if (dq % 2 === 0 && sq % 2 === 0 && bt % 2 === 0) {
      pre = before;
      comment = text.slice(idx);
    }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'baseline' }}>
      <span style={{
        display: 'inline-block', width: 26, textAlign: 'right',
        color: 'rgba(255,255,255,0.25)', fontSize: 10, paddingRight: 10,
        userSelect: 'none', flexShrink: 0
      }}>{n}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        {pre && tokenize(pre)}
        {comment && <span style={{ color: '#6B7280', fontStyle: 'italic' }}>{comment}</span>}
      </span>
    </div>);

}
function tokenize(s) {
  const KW = /\b(import|from|export|default|class|extends|static|constructor|return|if|else|new|this|true|false|null|undefined|const|let|var|async|await|function|of|in|typeof|instanceof)\b/g;
  // match single/double/backtick strings
  const STR = /(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  const NUM = /\b(\d+\.?\d*)\b/g;

  const parts = [];
  let last = 0;
  s.replace(STR, (m, _g, idx) => {
    if (idx > last) parts.push({ t: s.slice(last, idx), kind: 'plain' });
    parts.push({ t: m, kind: 'str' });
    last = idx + m.length;
  });
  if (last < s.length) parts.push({ t: s.slice(last), kind: 'plain' });

  return parts.flatMap((p, i) => {
    if (p.kind === 'str') return <span key={i} style={{ color: '#86E1A0' }}>{p.t}</span>;
    // tokenize plain for keywords and numbers
    let chunks = [];
    let lastIdx = 0;
    // first pass: split on keyword matches
    p.t.replace(KW, (m, _g, idx) => {
      if (idx > lastIdx) chunks.push({ t: p.t.slice(lastIdx, idx), kind: 'plain' });
      chunks.push({ t: m, kind: 'kw' });
      lastIdx = idx + m.length;
    });
    if (lastIdx < p.t.length) chunks.push({ t: p.t.slice(lastIdx), kind: 'plain' });

    return chunks.flatMap((c, j) => {
      if (c.kind === 'kw') {
        return <span key={`k${i}-${j}`} style={{ color: '#C4B5FD', fontWeight: 600 }}>{c.t}</span>;
      }
      // second pass on plain: highlight numbers
      const out = [];
      let li = 0;
      c.t.replace(NUM, (m, _g, idx) => {
        if (idx > li) out.push(c.t.slice(li, idx));
        out.push(<span key={`n${i}-${j}-${idx}`} style={{ color: '#F0B96B' }}>{m}</span>);
        li = idx + m.length;
      });
      if (li < c.t.length) out.push(c.t.slice(li));
      return out;
    });
  });
}

/* ---- RuleBlock: matches the desktop "IF ... THEN ..." card ---- */
function RuleBlock({ iff, then }) {
  return (
    <div style={{
      background: M.elev, border: `1px solid ${M.borderSoft}`, borderRadius: 14,
      padding: '12px 14px'
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#D08A2A', letterSpacing: 1.2,
        marginBottom: 6
      }}>IF</div>
      <div style={{ fontSize: 13, color: M.text, lineHeight: 1.55, marginBottom: 10 }}>
        {iff}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#2A88D0', letterSpacing: 1.2,
        marginBottom: 6
      }}>THEN</div>
      <div style={{ fontSize: 13, color: M.text, lineHeight: 1.55, fontWeight: 500 }}>
        {then}
      </div>
    </div>);

}

/* ---- ExecuteBlock: trading venue + symbol + risks ---- */
function ExecuteBlock({ x }) {
  const chips = [
  { k: '交易所', v: x.exchange },
  { k: '标的', v: x.symbol },
  { k: '周期', v: x.period },
  { k: '仓位', v: x.position },
  { k: '市场', v: x.market }];

  return (
    <div style={{
      background: M.elev, border: `1px solid ${M.borderSoft}`, borderRadius: 14,
      padding: '12px 14px 14px'
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: M.violet, letterSpacing: 1.4,
        marginBottom: 10
      }}>EXECUTE</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {chips.map((c) =>
        <span key={c.k} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 9px', borderRadius: 6,
          background: M.soft, border: `1px solid ${M.borderSoft}`,
          fontSize: 11.5, fontFamily: M.mono, whiteSpace: 'nowrap'
        }}>
            <span style={{ color: M.dim }}>{c.k}:</span>
            <span style={{ color: M.text, fontWeight: 600 }}>{c.v}</span>
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {x.risks.map((r, i) =>
        <div key={i} style={{
          padding: '8px 10px', borderRadius: 8,
          background: 'rgba(245,158,11,0.06)',
          border: `1px solid rgba(245,158,11,0.20)`,
          display: 'flex', gap: 8, alignItems: 'baseline'
        }}>
            <span style={{
            flexShrink: 0, fontSize: 10, fontWeight: 700, color: M.warn,
            letterSpacing: 0.4, padding: '1px 6px', borderRadius: 4,
            background: 'rgba(245,158,11,0.15)'
          }}>风控 · {r.kind}</span>
            <span style={{ fontSize: 12, color: M.text, lineHeight: 1.55 }}>{r.desc}</span>
          </div>
        )}
      </div>
    </div>);

}

/* ========================================================================
   SCREEN — 策略脚本 (StratScript)
   Step 2 of the flow: confirm → SCRIPT → btconfig → backtest → deploy
   ======================================================================== */
function ScreenStratScript() {
  const sess = window.__qfChatSessions;
  const active = sess?.items?.find((s) => s.id === sess.currentId);
  const initialKey = active?.scenario || window.__qfStratScenario || 'btc';
  const strat = STRAT_SCENARIOS[initialKey] || STRAT_SCENARIOS.btc;

  const [stage, setStage] = React.useState('generating'); // generating | ready
  const [expanded, setExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    setStage('generating');
    setExpanded(false);
    const t = setTimeout(() => setStage('ready'), 1500);
    return () => clearTimeout(t);
  }, [initialKey]);
  const confirmed = stage === 'ready';
  const copyScript = () => {
    navigator.clipboard?.writeText(strat.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: M.bg }}>
      <MStatus />
      <MTopBar
        title="策略脚本"
        sub="生成可执行脚本,推送回测引擎"
        onBack backTo="confirm"
        right={
        <button data-back="confirm" style={{
          height: 30, padding: '0 12px', borderRadius: 8,
          border: `1px solid ${M.border}`, background: M.elev,
          color: M.mid, fontSize: 12, fontWeight: 500, cursor: 'pointer'
        }}>取消</button>
        } />
      
      <BtcStepBar active={1} done={[0]} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 100px' }}>
        {/* recap of which strategy this is for */}
        <Card p="14px 16px" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: M.violetSoft,
              color: M.violet, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <Ico d={ICONS.spark} w={18} sw={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: M.text, letterSpacing: -0.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{strat.name}</div>
              <div style={{ fontSize: 11, color: M.dim, marginTop: 2, fontFamily: M.mono }}>
                {strat.pair} · {strat.tf} · {strat.market}{strat.lev ? ` · ${strat.lev}` : ''}
              </div>
            </div>
            <span style={{
              padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: M.soft, color: M.mid, fontFamily: M.mono, whiteSpace: 'nowrap'
            }}>{strat.file}</span>
          </div>
        </Card>

        <SectTitle right={confirmed &&
        <button onClick={copyScript} style={{
          height: 24, padding: '0 8px', borderRadius: 6, border: 0,
          background: 'transparent', color: copied ? M.ok : M.violet,
          fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', gap: 4
        }}>
            {copied ?
          <><Ico d={ICONS.check} w={11} sw={2.4} />已复制</> :
          <><Ico d={ICONS.copy} w={11} sw={1.8} />复制脚本</>
          }
          </button>
        }>{confirmed ? '已生成' : '待生成'}</SectTitle>

        {stage === 'generating' &&
        <Card p="26px 18px" style={{ marginBottom: 14, textAlign: 'center' }}>
            <div style={{
            width: 46, height: 46, borderRadius: 23, margin: '0 auto 12px',
            border: `3px solid ${M.violetSoft}`, borderTopColor: M.violet,
            animation: 'qfScriptSpin 0.9s linear infinite'
          }} />
            <style>{`@keyframes qfScriptSpin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 14, fontWeight: 600, color: M.text, marginBottom: 4 }}>
              正在生成策略脚本
            </div>
            <div style={{ fontSize: 11, color: M.dim, fontFamily: M.mono }}>
              编译参数 · 校验语法 · 注入风控
            </div>
          </Card>
        }

        {stage === 'ready' &&
        <React.Fragment>
            <ScriptViewer strat={strat} expanded={expanded} setExpanded={setExpanded} />
            <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 10,
            background: 'rgba(22,163,107,0.08)',
            border: '1px solid rgba(22,163,107,0.20)',
            display: 'flex', gap: 8, alignItems: 'flex-start'
          }}>
              <Ico d={ICONS.check} w={14} sw={2.4} stroke={M.ok} />
              <span style={{ fontSize: 12, color: M.text, lineHeight: 1.6 }}>
                脚本已生成、风控已注入,可继续下一步配置回测。
              </span>
            </div>
          </React.Fragment>
        }
      </div>

      {/* sticky action bar */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30,
        padding: '12px 16px 36px',
        background: `linear-gradient(180deg, transparent, ${M.bg} 30%)`,
        display: 'flex', gap: 10
      }}>
        <button data-back="confirm" style={{
          flex: 1, height: 50, borderRadius: 14,
          border: `1px solid ${M.border}`, background: M.elev,
          color: M.text, fontSize: 14, fontWeight: 500, cursor: 'pointer'
        }}>上一步</button>
        <button
          {...confirmed ? { 'data-go-btconfig': true } : {}}
          disabled={!confirmed}
          style={{
            flex: 2, height: 50, borderRadius: 14, border: 0,
            background: confirmed ? M.violetGrad : M.border,
            color: confirmed ? '#fff' : M.faint,
            fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
            boxShadow: confirmed ? '0 8px 24px rgba(124,92,255,0.32)' : 'none',
            cursor: confirmed ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>
          下一步:回测设置
          <Ico d={ICONS.caretR} w={13} sw={2.4} />
        </button>
      </div>
    </div>);

}

Object.assign(window, { ScreenStratConfirm, ScreenStratScript });
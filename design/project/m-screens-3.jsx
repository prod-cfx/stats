/* Mobile screens part 3 — Trading detail, L/S Ratio, Whale Feed, Account, API Config */

/* ========================================================================
   SCREEN 6 — Trading Detail (BTC/USDT)
   ======================================================================== */
const ASKS = [
{ p: '68,432.10', q: '0.8214', t: '56.21K' },
{ p: '68,430.50', q: '1.2480', t: '85.41K' },
{ p: '68,428.20', q: '0.4862', t: '33.27K' },
{ p: '68,425.80', q: '2.1306', t: '145.8K' },
{ p: '68,422.40', q: '0.9012', t: '61.66K' }];

const BIDS = [
{ p: '68,420.12', q: '1.4820', t: '101.4K' },
{ p: '68,418.50', q: '0.7240', t: '49.54K' },
{ p: '68,415.30', q: '2.8412', t: '194.4K' },
{ p: '68,412.80', q: '0.5408', t: '37.00K' },
{ p: '68,410.20', q: '1.9620', t: '134.2K' }];

const TRADES = [
{ t: '14:02:18', p: '68,422.40', q: '0.0824', side: 'buy' },
{ t: '14:02:17', p: '68,420.80', q: '0.4118', side: 'buy' },
{ t: '14:02:15', p: '68,420.12', q: '0.1248', side: 'sell' },
{ t: '14:02:14', p: '68,418.50', q: '1.8204', side: 'sell' },
{ t: '14:02:12', p: '68,420.10', q: '0.0612', side: 'buy' },
{ t: '14:02:11', p: '68,422.00', q: '0.2810', side: 'buy' },
{ t: '14:02:09', p: '68,418.30', q: '0.0942', side: 'sell' },
{ t: '14:02:07', p: '68,420.40', q: '0.6184', side: 'buy' },
{ t: '14:02:05', p: '68,416.20', q: '0.3206', side: 'sell' },
{ t: '14:02:03', p: '68,420.10', q: '0.1842', side: 'buy' },
{ t: '14:01:59', p: '68,418.80', q: '0.4012', side: 'sell' },
{ t: '14:01:57', p: '68,422.40', q: '0.0606', side: 'buy' }];

/* 大额成交 — orders ≥ 5 BTC (~$340K+) */
const BIG_TRADES = [
{ t: '14:02:14', p: '68,418.50', q: '24.820', side: 'sell', tag: '巨鲸' },
{ t: '14:01:48', p: '68,420.10', q: '12.408', side: 'buy', tag: '巨鲸' },
{ t: '14:01:22', p: '68,415.60', q: '8.6204', side: 'sell' },
{ t: '14:00:59', p: '68,424.80', q: '15.204', side: 'buy', tag: '巨鲸' },
{ t: '14:00:31', p: '68,418.20', q: '6.4180', side: 'sell' },
{ t: '14:00:04', p: '68,422.40', q: '9.8420', side: 'buy' },
{ t: '13:59:42', p: '68,408.30', q: '18.062', side: 'sell', tag: '巨鲸' },
{ t: '13:58:51', p: '68,422.90', q: '5.4280', side: 'buy' },
{ t: '13:58:12', p: '68,416.80', q: '7.2104', side: 'sell' },
{ t: '13:57:34', p: '68,425.60', q: '11.486', side: 'buy', tag: '巨鲸' }];


function ScreenTradingDetail() {
  const [panel, setPanel] = React.useState('book'); // 'book' | 'trades' | 'depth'
  const [agg, setAgg] = React.useState(false); // 聚合: cross-exchange merged book
  return (
    <div style={{ height: '100%', position: 'relative', background: M.bg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <MStatus />
      <MTopBar
        onBack={() => {}}
        backTo="market"
        title="BTC / USDT"
        sub={agg ? '永续 · 聚合 7 所' : '永续 · Binance'}
        right={
        <div style={{ display: 'flex', gap: 6 }}>
            <button style={iconBtn}><Ico d={ICONS.star} w={18} /></button>
            <button style={iconBtn}><Ico d={ICONS.more} w={18} sw={2.5} /></button>
          </div>
        } />

      {/* scrollable region — sits beneath the fixed top bar, above the sticky buy/sell + tab bar */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: 158 }}>
      <div style={{ padding: '12px 16px 10px', background: M.elev }}>
        {/* row 1: price + change + 聚合 toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: M.up, fontFamily: M.mono, letterSpacing: -0.5 }}>68,420.12</span>
            <span style={{ fontSize: 13, color: M.up, fontFamily: M.mono, fontWeight: 600, whiteSpace: 'nowrap' }}>+1,572.40 (+2.34%)</span>
          </div>
          <AggToggle on={agg} onChange={setAgg} />
        </div>

        {/* row 2: 指数 / 标记 / 资金费率 / 下次结算 */}
        <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
            fontSize: 10.5, paddingBottom: 9, marginBottom: 9,
            borderBottom: `1px solid ${M.borderSoft}`
          }}>
          {[
            { l: '指数价格', v: '67,403.6', tone: M.text },
            { l: '标记价格', v: '68,417.9', tone: M.text },
            { l: '资金费率', v: '+0.0085%', tone: M.up },
            { l: '下次结算', v: '02:34:18', tone: M.text, mono: true }].
            map((s) =>
            <div key={s.l}>
              <div style={{ color: M.dim, letterSpacing: 0.1 }}>{s.l}</div>
              <div style={{ color: s.tone, fontFamily: M.mono, fontWeight: 600, marginTop: 2 }}>{s.v}</div>
            </div>
            )}
        </div>

        {/* row 3: 24h 高 / 低 / 量 / 持仓量 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, fontSize: 10.5 }}>
          {[
            ['24H 高', '69,210.40'],
            ['24H 低', '66,820.10'],
            ['24H 量', '63.25K'],
            ['持仓量', '89.36K BTC']].
            map(([l, v]) =>
            <div key={l}>
              <div style={{ color: M.dim, letterSpacing: 0.1 }}>{l}</div>
              <div style={{ color: M.text, fontFamily: M.mono, fontWeight: 500, marginTop: 2 }}>{v}</div>
            </div>
            )}
        </div>
      </div>

      <div style={{ background: M.elev, borderTop: `1px solid ${M.borderSoft}`, padding: '8px 16px 0' }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, fontWeight: 500 }}>
          {[['1m'], ['15m'], ['1H', true], ['4H'], ['1D'], ['更多']].map(([t, on]) =>
            <span key={t} style={{
              padding: '6px 0', color: on ? M.text : M.mid,
              borderBottom: on ? `2px solid ${M.text}` : '2px solid transparent', fontWeight: on ? 700 : 500
            }}>{t}</span>
            )}
        </div>
      </div>

      <div style={{ background: M.elev, padding: '4px 0 6px' }}>
        <div style={{ padding: '6px 16px', fontFamily: M.mono, fontSize: 10, color: M.mid, display: 'flex', gap: 10 }}>
          <span>O <span style={{ color: M.text }}>67,892</span></span>
          <span>H <span style={{ color: M.up }}>68,540</span></span>
          <span>L <span style={{ color: M.dn }}>67,420</span></span>
          <span>C <span style={{ color: M.up }}>68,420</span></span>
        </div>
        <Candles width={402} height={200} />
      </div>

      {/* 24h 累计成交额 / 累计净流入 — aligned to PC right panel */}
      <div style={{
          background: M.elev, borderTop: `6px solid ${M.bg}`,
          padding: '12px 16px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10
        }}>
        {[
          { l: '累计成交额($)', v: '78.31亿', tone: M.text, hint: '24H' },
          { l: '累计净流入($)', v: '−3.91亿', tone: M.dn, hint: '24H · 资金流出' }].
          map((s) =>
          <div key={s.l} style={{
            padding: '10px 12px', borderRadius: 10,
            background: M.soft, border: `1px solid ${M.borderSoft}`
          }}>
            <div style={{
              fontSize: 10.5, color: M.dim, display: 'flex',
              alignItems: 'center', gap: 6, letterSpacing: 0.1
            }}>
              <span>{s.l}</span>
              <span style={{ color: M.faint, fontFamily: M.mono, fontSize: 9.5 }}>{s.hint}</span>
            </div>
            <div style={{
              marginTop: 3, fontSize: 15, fontWeight: 700, color: s.tone,
              fontFamily: M.mono, letterSpacing: -0.2
            }}>{s.v}</div>
          </div>
          )}
      </div>

      {/* tab strip: 盘口 / 成交 / 深度图 */}
      <div style={{ background: M.elev, borderTop: `6px solid ${M.bg}`, paddingBottom: 24 }}>
        <div style={{ padding: '12px 16px 8px', display: 'flex', gap: 18, fontSize: 13, fontWeight: 500, borderBottom: `1px solid ${M.borderSoft}` }}>
          {[['book', '盘口'], ['trades', '成交'], ['depth', '深度图']].map(([k, label]) => {
              const on = panel === k;
              return (
                <button key={k} onClick={() => setPanel(k)} style={{
                  padding: '6px 0', color: on ? M.text : M.mid, fontWeight: on ? 700 : 500,
                  background: 'transparent', border: '0',
                  borderBottom: on ? `2px solid ${M.text}` : '2px solid transparent',
                  fontSize: 13, cursor: 'pointer'
                }}>{label}</button>);

            })}
          <div style={{ flex: 1 }} />
        </div>

        {panel === 'book' && <OrderBookPanel agg={agg} />}
        {panel === 'trades' && <TradesPanel />}
        {panel === 'depth' && <DepthPanel />}
      </div>
      </div>{/* /scrollable region */}

      {/* sticky buy/sell */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 80, padding: '12px 16px',
        background: M.elev, backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${M.borderSoft}`, display: 'flex', gap: 10
      }}>
        <button data-action="open-buy" style={{
          flex: 1, height: 46, borderRadius: 12, border: 0, background: M.up, color: '#fff',
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2
        }}>
          <span>买入 / 做多</span>
          <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.85 }}>开多 · 10x</span>
        </button>
        <button data-action="open-sell" style={{
          flex: 1, height: 46, borderRadius: 12, border: 0, background: M.dn, color: '#fff',
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2
        }}>
          <span>卖出 / 做空</span>
          <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.85 }}>开空 · 10x</span>
        </button>
      </div>

      <MTabBar active="market" />
    </div>);

}

/* ---- 聚合 toggle (used in trade detail header) ---- */
function AggToggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      flexShrink: 0, height: 30, padding: '0 4px 0 10px',
      border: `1px solid ${on ? 'transparent' : M.border}`,
      background: on ? M.violetGrad : M.elev,
      color: on ? '#fff' : M.mid,
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
      boxShadow: on ? '0 4px 12px rgba(124,92,255,0.28)' : 'none', width: "67px", borderRadius: "999px"
    }}>
      <span>聚合</span>
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: on ? 'rgba(255,255,255,0.22)' : M.soft,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, fontFamily: M.mono,
        color: on ? '#fff' : M.dim
      }}>{on ? '7' : '1'}</span>
    </button>);

}

/* ---- order book panel ---- */
function OrderBookPanel({ agg }) {
  const [prec, setPrec] = React.useState('0.01');
  const [precOpen, setPrecOpen] = React.useState(false);
  const PREC_OPTS = ['0.01', '0.1', '1', '10', '100'];

  // cumulative qty for ask side (from mid outward = ASKS reversed)
  const askRows = ASKS.slice().reverse(); // closest-to-mid first
  let askCum = 0;
  const askWithCum = askRows.map((o) => {
    askCum += parseFloat(o.q);
    return { ...o, cum: askCum };
  }).reverse(); // back to top-down (highest price first)

  let bidCum = 0;
  const bidWithCum = BIDS.map((o) => {
    bidCum += parseFloat(o.q);
    return { ...o, cum: bidCum };
  });
  const maxCum = Math.max(askCum, bidCum);

  return (
    <React.Fragment>
      {/* toolbar — precision dropdown only */}
      <div style={{
        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6,
        borderBottom: `1px solid ${M.borderSoft}`
      }}>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <button onClick={() => setPrecOpen((v) => !v)} style={{
            height: 24, padding: '0 8px', borderRadius: 6,
            border: `1px solid ${precOpen ? M.violet : M.border}`,
            background: precOpen ? M.violetSoft : M.elev,
            color: precOpen ? M.violet : M.text,
            fontSize: 11, fontWeight: 600, fontFamily: M.mono,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            cursor: 'pointer'
          }}>
            {prec}
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: precOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {precOpen &&
          <React.Fragment>
              <div onClick={() => setPrecOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{
              position: 'absolute', top: 30, right: 0, zIndex: 41, minWidth: 74,
              background: M.elev, border: `1px solid ${M.border}`, borderRadius: 8,
              boxShadow: '0 12px 28px -10px rgba(15,22,35,0.28)',
              padding: 4, display: 'flex', flexDirection: 'column'
            }}>
                {PREC_OPTS.map((o) => {
                const on = o === prec;
                return (
                  <button key={o} onClick={() => {setPrec(o);setPrecOpen(false);}}
                  style={{
                    padding: '7px 12px', border: 0, cursor: 'pointer',
                    background: on ? M.violetSoft : 'transparent',
                    color: on ? M.violet : M.text,
                    borderRadius: 6, textAlign: 'right', fontFamily: M.mono,
                    fontSize: 11.5, fontWeight: on ? 600 : 500
                  }}>{o}</button>);

              })}
              </div>
            </React.Fragment>
          }
        </div>
      </div>

      {/* column header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(70px,1fr) minmax(60px,1fr) minmax(70px,1fr)',
        gap: 8, padding: '6px 16px',
        fontSize: 10, color: M.dim, fontFamily: M.mono
      }}>
        <span>价格(USDT)</span>
        <span style={{ textAlign: 'right' }}>数量(BTC)</span>
        <span style={{ textAlign: 'right' }}>委托额($)</span>
      </div>

      <div>
        {askWithCum.map((o, i) =>
        <OrderRow key={'a' + i} o={o} ask maxCum={maxCum} />
        )}

        <div style={{
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
          background: M.soft,
          borderTop: `1px solid ${M.borderSoft}`,
          borderBottom: `1px solid ${M.borderSoft}`
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: M.mono, color: M.up, letterSpacing: -0.3 }}>
            68,420.12
          </span>
          <span style={{ fontSize: 11, color: M.up, fontFamily: M.mono, fontWeight: 600 }}>+2.34%</span>
          <span style={{ fontSize: 10.5, color: M.dim, fontFamily: M.mono }}>≈ $68,420.12</span>
        </div>

        {bidWithCum.map((o, i) =>
        <OrderRow key={'b' + i} o={o} maxCum={maxCum} />
        )}
      </div>
    </React.Fragment>);

}

/* ---- trades panel ---- */
function TradesPanel() {
  const [sub, setSub] = React.useState('latest'); // 'latest' | 'big'
  return (
    <React.Fragment>
      {/* sub-tabs: 最新成交 / 大额成交 */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 16px 8px',
        borderBottom: `1px solid ${M.borderSoft}`
      }}>
        {[['latest', '最新成交'], ['big', '大额成交']].map(([k, label]) => {
          const on = sub === k;
          return (
            <button key={k} onClick={() => setSub(k)} style={{
              padding: '6px 12px', borderRadius: 999, border: 0, cursor: 'pointer',
              background: on ? M.soft : 'transparent',
              color: on ? M.text : M.mid,
              fontSize: 12, fontWeight: on ? 600 : 500,
              fontFamily: M.sans,
              display: 'inline-flex', alignItems: 'center', gap: 6
            }}>
              {label}
              {k === 'big' &&
              <span style={{
                fontSize: 9, fontFamily: M.mono, padding: '1px 5px', borderRadius: 4,
                background: on ? M.violetSoft : 'transparent',
                color: on ? M.violet : M.dim,
                border: on ? '0' : `1px solid ${M.borderSoft}`
              }}>≥5 BTC</span>
              }
            </button>);

        })}
        <div style={{ flex: 1 }} />
        {sub === 'big' &&
        <span style={{ alignSelf: 'center', fontSize: 11, color: M.dim, fontFamily: M.mono }}>
            实时 · 24h 86 笔
          </span>
        }
      </div>

      {sub === 'latest' ? <LatestTradesList /> : <BigTradesList />}
    </React.Fragment>);

}

function LatestTradesList() {
  return (
    <React.Fragment>
      <div style={{
        display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', padding: '8px 16px 4px',
        fontSize: 10, color: M.dim, fontFamily: M.mono
      }}>
        <span>价格(USDT)</span>
        <span style={{ textAlign: 'right' }}>数量(BTC)</span>
        <span style={{ textAlign: 'right' }}>时间</span>
      </div>
      <div>
        {TRADES.map((tr, i) => {
          const up = tr.side === 'buy';
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr',
              padding: '7px 16px', fontSize: 12, fontFamily: M.mono, alignItems: 'center'
            }}>
              <span style={{ color: up ? M.up : M.dn, fontWeight: 600 }}>{tr.p}</span>
              <span style={{ textAlign: 'right', color: M.text }}>{tr.q}</span>
              <span style={{ textAlign: 'right', color: M.mid }}>{tr.t}</span>
            </div>);

        })}
      </div>
    </React.Fragment>);

}

function BigTradesList() {
  const fmtUsd = (p, q) => {
    const v = parseFloat(p.replace(/,/g, '')) * parseFloat(q);
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    return (v / 1e3).toFixed(1) + 'K';
  };
  return (
    <React.Fragment>
      <div style={{
        display: 'grid', gridTemplateColumns: '52px 1fr 1fr 1fr',
        padding: '8px 16px 4px', gap: 8,
        fontSize: 10, color: M.dim, fontFamily: M.mono
      }}>
        <span>方向</span>
        <span>价格</span>
        <span style={{ textAlign: 'right' }}>金额 / 数量</span>
        <span style={{ textAlign: 'right' }}>时间</span>
      </div>
      <div>
        {BIG_TRADES.map((tr, i) => {
          const up = tr.side === 'buy';
          const color = up ? M.up : M.dn;
          const usd = fmtUsd(tr.p, tr.q);
          const big = parseFloat(tr.q) >= 10;
          return (
            <div key={i} style={{
              position: 'relative',
              display: 'grid', gridTemplateColumns: '52px 1fr 1fr 1fr', gap: 8,
              padding: '9px 16px', fontSize: 12, fontFamily: M.mono, alignItems: 'center',
              borderBottom: `1px solid ${M.borderSoft}`
            }}>
              {/* faint background tint based on side */}
              <div style={{
                position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                background: up ? 'rgba(22,163,107,0.04)' : 'rgba(229,72,77,0.04)',
                pointerEvents: 'none'
              }} />
              <span style={{
                position: 'relative',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                height: 20, borderRadius: 5,
                background: up ? 'rgba(22,163,107,0.16)' : 'rgba(229,72,77,0.16)',
                color, fontSize: 10, fontWeight: 700, fontFamily: M.sans, letterSpacing: 0.4
              }}>
                {up ? '主买' : '主卖'}
              </span>
              <span style={{ position: 'relative', color, fontWeight: 600 }}>{tr.p}</span>
              <span style={{ position: 'relative', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 }}>
                <span style={{ color: big ? M.text : M.mid, fontWeight: 700, fontSize: 12.5 }}>${usd}</span>
                <span style={{ color: M.dim, fontSize: 10, marginTop: 1 }}>{tr.q} BTC</span>
              </span>
              <span style={{ position: 'relative', textAlign: 'right', color: M.mid, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 }}>
                <span>{tr.t}</span>
                {tr.tag &&
                <span style={{
                  fontSize: 9, color: M.violet, fontFamily: M.sans, fontWeight: 600, marginTop: 1
                }}>● {tr.tag}</span>
                }
              </span>
            </div>);

        })}
      </div>
    </React.Fragment>);

}

/* ---- depth panel ---- */
function DepthPanel() {
  const W = 402,H = 280;
  // build cumulative bid (left) and ask (right) curves
  const allBids = [...BIDS, ...[
  { p: 68408, q: 0.62 }, { p: 68404, q: 1.21 }, { p: 68400, q: 0.84 }, { p: 68395, q: 2.14 }, { p: 68390, q: 1.45 },
  { p: 68385, q: 0.96 }, { p: 68380, q: 2.84 }, { p: 68370, q: 1.62 }, { p: 68355, q: 3.20 }]];

  const allAsks = [...ASKS, ...[
  { p: 68436, q: 1.10 }, { p: 68438, q: 0.62 }, { p: 68442, q: 1.84 }, { p: 68446, q: 0.74 }, { p: 68450, q: 2.41 },
  { p: 68458, q: 1.02 }, { p: 68466, q: 1.96 }, { p: 68480, q: 2.50 }, { p: 68498, q: 3.15 }]];

  const parse = (o) => ({ p: typeof o.p === 'string' ? parseFloat(o.p.replace(/,/g, '')) : o.p, q: typeof o.q === 'string' ? parseFloat(o.q) : o.q });
  const bids = allBids.map(parse).sort((a, b) => b.p - a.p); // high → low
  const asks = allAsks.map(parse).sort((a, b) => a.p - b.p); // low → high
  let bidCum = 0;const bidPts = bids.map((o) => ({ p: o.p, c: bidCum += o.q }));
  let askCum = 0;const askPts = asks.map((o) => ({ p: o.p, c: askCum += o.q }));
  const maxC = Math.max(bidCum, askCum) * 1.1;
  const mid = 68420.12;
  const range = 110; // ±110 around mid
  const xMin = mid - range,xMax = mid + range;
  const xOf = (p) => (p - xMin) / (xMax - xMin) * W;
  const yOf = (c) => H - c / maxC * (H - 20) - 10;
  const bidPath = `M${xOf(xMin)},${H} ` + bidPts.slice().reverse().map((p) => `L${xOf(p.p)},${yOf(p.c)}`).join(' ') + ` L${xOf(mid)},${H} Z`;
  const askPath = `M${xOf(mid)},${H} ` + askPts.map((p) => `L${xOf(p.p)},${yOf(p.c)}`).join(' ') + ` L${xOf(xMax)},${H} Z`;
  return (
    <div style={{ overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px 6px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, color: M.dim, fontFamily: M.mono }}>BID</div>
          <div style={{ fontSize: 14, color: M.up, fontFamily: M.mono, fontWeight: 700 }}>{bidCum.toFixed(2)} BTC</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: M.dim, fontFamily: M.mono }}>SPREAD</div>
          <div style={{ fontSize: 14, color: M.text, fontFamily: M.mono, fontWeight: 600 }}>0.10 / 0.0001%</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: M.dim, fontFamily: M.mono }}>ASK</div>
          <div style={{ fontSize: 14, color: M.dn, fontFamily: M.mono, fontWeight: 700 }}>{askCum.toFixed(2)} BTC</div>
        </div>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="dgBid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={M.up} stopOpacity="0.4" />
            <stop offset="100%" stopColor={M.up} stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="dgAsk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={M.dn} stopOpacity="0.4" />
            <stop offset="100%" stopColor={M.dn} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((k) =>
        <line key={k} x1="0" y1={H * k} x2={W} y2={H * k}
        stroke="var(--border-soft)" strokeDasharray="2 4" />
        )}
        <path d={bidPath} fill="url(#dgBid)" stroke={M.up} strokeWidth="1.4" />
        <path d={askPath} fill="url(#dgAsk)" stroke={M.dn} strokeWidth="1.4" />
        {/* mid marker */}
        <line x1={xOf(mid)} y1="0" x2={xOf(mid)} y2={H} stroke="var(--text-dim)" strokeDasharray="3 3" strokeOpacity="0.5" />
        <text x={xOf(mid)} y="14" fontSize="10" fontFamily="JetBrains Mono,monospace"
        fill="var(--text-mid)" textAnchor="middle">68,420.12</text>
      </svg>
      <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: M.dim, fontFamily: M.mono }}>
        <span>{xMin.toFixed(0)}</span>
        <span>{mid}</span>
        <span>{xMax.toFixed(0)}</span>
      </div>
    </div>);

}

const iconBtn = {
  width: 36, height: 36, borderRadius: 18, background: M.elev,
  border: `1px solid ${M.border}`, color: M.mid,
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};

function OrderRow({ o, ask, maxCum }) {
  const qty = parseFloat(String(o.q).replace(/,/g, ''));
  const cum = o.cum ?? qty;
  const w = maxCum ? Math.min(100, cum / maxCum * 100) : 0;
  // 委托额 = 价格 × 数量 (notional). 't' field already encodes this in source data.
  const notional = o.t || '';
  return (
    <div style={{
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: 'minmax(70px,1fr) minmax(60px,1fr) minmax(70px,1fr)',
      gap: 8, padding: '5px 16px', fontSize: 12, fontFamily: M.mono, alignItems: 'center'
    }}>
      {/* depth bar — cumulative, anchored to right */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: `${w}%`,
        background: ask ? 'rgba(229,72,77,0.10)' : 'rgba(22,163,107,0.10)',
        pointerEvents: 'none'
      }} />
      <span style={{ position: 'relative', color: ask ? M.dn : M.up, fontWeight: 600 }}>{o.p}</span>
      <span style={{ position: 'relative', textAlign: 'right', color: M.text }}>{o.q}</span>
      <span style={{ position: 'relative', textAlign: 'right', color: M.mid }}>{notional}</span>
    </div>);

}

/* ========================================================================
   SCREEN 7 — 交易所多空比 (Long / Short Ratio)
   Aligned to PC /zh/long-short-ratio
   ======================================================================== */
const LS_COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'BNB', 'SUI', 'ADA', 'LINK'];
const LS_TFS = ['5分钟', '15分钟', '1小时', '4小时', '24小时'];

/* exchange registry — color + letter for the small badge */
const LS_EX = {
  BIN: { name: 'Binance', letter: 'B', color: '#F0B90B', fg: '#000' },
  MEX: { name: 'MEXC', letter: 'M', color: '#1D6EFC', fg: '#fff' },
  WBT: { name: 'WhiteBIT', letter: 'W', color: '#0E1726', fg: '#fff' },
  OKX: { name: 'OKX', letter: 'O', color: '#000000', fg: '#fff' },
  BYB: { name: 'Bybit', letter: 'Y', color: '#F7A600', fg: '#000' },
  GT: { name: 'Gate', letter: 'G', color: '#22D3EE', fg: '#000' },
  BG: { name: 'Bitget', letter: 'G', color: '#00D8C9', fg: '#000' },
  CB: { name: 'Coinbase', letter: 'C', color: '#1652F0', fg: '#fff' },
  BIX: { name: 'BingX', letter: 'X', color: '#2962FF', fg: '#fff' },
  BTX: { name: 'Bitunix', letter: 'B', color: '#0E1726', fg: '#fff' },
  HL: { name: 'Hyperliquid', letter: 'H', color: '#34D399', fg: '#000' },
  LB: { name: 'LBank', letter: 'L', color: '#1B1B1B', fg: '#fff' },
  AST: { name: 'Aster', letter: 'A', color: '#F59E0B', fg: '#000' },
  LGT: { name: 'Lighter', letter: 'L', color: '#A78BFA', fg: '#fff' },
  HTX: { name: 'HTX', letter: 'H', color: '#3076FF', fg: '#fff' },
  DER: { name: 'Deribit', letter: 'D', color: '#E5484D', fg: '#fff' },
  BMX: { name: 'Bitmex', letter: 'B', color: '#1F2937', fg: '#fff' },
  CRP: { name: 'Crypto.com', letter: 'C', color: '#003CDA', fg: '#fff' },
  CEX: { name: 'CoinEx', letter: 'C', color: '#2EB8AA', fg: '#fff' },
  KRK: { name: 'Kraken', letter: 'K', color: '#5841D8', fg: '#fff' },
  KC: { name: 'KuCoin', letter: 'K', color: '#22D896', fg: '#000' },
  BFX: { name: 'Bitfinex', letter: 'B', color: '#94A3B8', fg: '#fff' },
  DYX: { name: 'dYdX', letter: 'D', color: '#6966FF', fg: '#fff' },
  TXY: { name: 'tradeXYZ', letter: 'X', color: '#7C5CFF', fg: '#fff' }
};

/* BTC data — mirrors PC */
const LS_BTC = {
  total: { longPct: 51.65, shortPct: 48.35, longUsd: '23.21亿', shortUsd: '21.73亿' },
  rows: [
  { ex: 'BIN', l: 53.93, s: 46.07, lUsd: '4.69亿', sUsd: '4亿' },
  { ex: 'MEX', l: 50.12, s: 49.88, lUsd: '3.56亿', sUsd: '3.54亿' },
  { ex: 'WBT', l: 47.93, s: 52.07, lUsd: '2.37亿', sUsd: '2.57亿' },
  { ex: 'OKX', l: 54.91, s: 45.09, lUsd: '2.67亿', sUsd: '2.2亿' },
  { ex: 'BYB', l: 56.09, s: 43.91, lUsd: '2亿', sUsd: '1.57亿' },
  { ex: 'GT', l: 51.67, s: 48.33, lUsd: '1.78亿', sUsd: '1.66亿' },
  { ex: 'BG', l: 52.52, s: 47.48, lUsd: '1.31亿', sUsd: '1.18亿' },
  { ex: 'CB', l: 47.20, s: 52.80, lUsd: '7576.49万', sUsd: '8475.19万' },
  { ex: 'BIX', l: 50.40, s: 49.60, lUsd: '7937.35万', sUsd: '7812.64万' },
  { ex: 'BTX', l: 53.89, s: 46.11, lUsd: '8027.4万', sUsd: '6867.57万' },
  { ex: 'HL', l: 62.48, s: 37.52, lUsd: '7381.29万', sUsd: '4431.78万' },
  { ex: 'LB', l: 25.87, s: 74.13, lUsd: '2359.38万', sUsd: '6759.41万' },
  { ex: 'AST', l: 49.54, s: 50.46, lUsd: '3403.8万', sUsd: '3466.96万' },
  { ex: 'LGT', l: 51.41, s: 48.59, lUsd: '2929.53万', sUsd: '2768.84万' },
  { ex: 'HTX', l: 49.67, s: 50.33, lUsd: '1984.38万', sUsd: '2010.72万' },
  { ex: 'DER', l: 50.67, s: 49.33, lUsd: '1476.63万', sUsd: '1437.48万' },
  { ex: 'BMX', l: 29.06, s: 70.94, lUsd: '845.26万', sUsd: '2063.47万' },
  { ex: 'CRP', l: 51.37, s: 48.63, lUsd: '1333.74万', sUsd: '1262.62万' },
  { ex: 'CEX', l: 41.79, s: 58.21, lUsd: '782.65万', sUsd: '1090.05万' },
  { ex: 'KRK', l: 58.66, s: 41.34, lUsd: '1076.56万', sUsd: '758.8万' },
  { ex: 'KC', l: 62.21, s: 37.79, lUsd: '999.23万', sUsd: '607.04万' },
  { ex: 'BFX', l: 64.04, s: 35.96, lUsd: '134.18万', sUsd: '75.35万' },
  { ex: 'DYX', l: 42.74, s: 57.26, lUsd: '82.87万', sUsd: '111.01万' },
  { ex: 'TXY', l: 0, s: 0, lUsd: '0', sUsd: '0', empty: true }]

};

/* Demo data per coin — we ship BTC; everything else falls back to scaled BTC */
const LS_DATA = { BTC: LS_BTC };

function LSExIcon({ k, size = 20 }) {
  const e = LS_EX[k];
  if (!e) return null;
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: e.color, color: e.fg,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, fontWeight: 700,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      flexShrink: 0
    }}>{e.letter}</span>);

}

/* Coin dropdown — reused mini popover */
function LSPopover({ value, options, onChange, render }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        height: 30, padding: '0 12px', borderRadius: 8,
        border: `1px solid ${open ? M.violet : M.borderSoft}`,
        background: open ? M.violetSoft : M.bg,
        color: M.text, fontSize: 12, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: render ? 'inherit' : M.mono
      }}>
        <span>{render ? render(value) : value}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open &&
      <React.Fragment>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
          position: 'absolute', top: 34, right: 0, zIndex: 41, minWidth: 96,
          background: M.elev, border: `1px solid ${M.border}`, borderRadius: 10,
          boxShadow: '0 14px 32px -10px rgba(15,22,35,0.22)',
          padding: 4, display: 'flex', flexDirection: 'column',
          maxHeight: 260, overflowY: 'auto'
        }}>
            {options.map((o) => {
            const on = o === value;
            return (
              <button key={o} onClick={() => {onChange(o);setOpen(false);}} style={{
                padding: '9px 12px', border: 0, cursor: 'pointer',
                background: on ? M.violetGrad || M.violet : 'transparent',
                color: on ? '#fff' : M.text,
                borderRadius: 7, textAlign: 'left',
                fontFamily: render ? 'inherit' : M.mono,
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12.5, fontWeight: on ? 700 : 500
              }}>
                  <span style={{ flex: 1 }}>{render ? render(o) : o}</span>
                  {on &&
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                }
                </button>);

          })}
          </div>
        </React.Fragment>
      }
    </div>);

}

function LSRow({ rank, r }) {
  const empty = r.empty;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, alignItems: 'center',
      padding: '12px 14px',
      borderBottom: `1px solid ${M.borderSoft}`,
      background: M.elev
    }}>
      <span style={{
        fontSize: 11, color: M.dim, fontFamily: M.mono, textAlign: 'center'
      }}>{rank}</span>
      <div style={{ minWidth: 0 }}>
        {/* head: icon + name + amounts right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <LSExIcon k={r.ex} size={20} />
          <span style={{
            fontSize: 12.5, fontWeight: 600, color: M.text,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            flex: 1, minWidth: 0
          }}>{LS_EX[r.ex]?.name || r.ex}</span>
          <span style={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end',
            gap: 1, flexShrink: 0
          }}>
            <span style={{ fontSize: 9.5, color: M.dim }}>做多</span>
            <span style={{ fontSize: 10.5, fontFamily: M.mono, color: M.up, fontWeight: 600 }}>
              US${r.lUsd}
            </span>
          </span>
          <span style={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end',
            gap: 1, flexShrink: 0, minWidth: 62
          }}>
            <span style={{ fontSize: 9.5, color: M.dim }}>做空</span>
            <span style={{ fontSize: 10.5, fontFamily: M.mono, color: M.dn, fontWeight: 600 }}>
              US${r.sUsd}
            </span>
          </span>
        </div>
        {/* split bar with inline % labels */}
        {empty ?
        <div style={{
          height: 18, borderRadius: 4, background: M.soft, border: `1px dashed ${M.borderSoft}`
        }} /> :

        <div style={{
          height: 18, borderRadius: 4, display: 'flex', overflow: 'hidden',
          fontSize: 10, fontWeight: 700, fontFamily: M.mono, color: '#fff'
        }}>
            <span style={{
            width: `${r.l}%`, background: M.up,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: r.l < 18 ? 'auto' : 0, paddingLeft: r.l < 18 ? 4 : 0
          }}>{r.l < 8 ? '' : r.l + '%'}</span>
            <span style={{
            width: `${r.s}%`, background: M.dn,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: r.s < 18 ? 'auto' : 0, paddingRight: r.s < 18 ? 4 : 0
          }}>{r.s < 8 ? '' : r.s + '%'}</span>
          </div>
        }
      </div>
    </div>);

}

function ScreenLS() {
  const [coin, setCoin] = React.useState('BTC');
  const [tf, setTf] = React.useState('4小时');
  const data = LS_DATA[coin] || LS_BTC; // fall back to BTC

  return (
    <div style={{ height: '100%', position: 'relative', background: M.bg, display: 'flex', flexDirection: 'column' }}>
      <MStatus />
      {window.DataHubHeader ?
      <window.DataHubHeader current="ls" /> :

      <MTopBar title="多空比" />
      }

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }}>
        {/* page title row */}
        <div style={{
          padding: '14px 16px 12px', background: M.elev,
          borderBottom: `1px solid ${M.borderSoft}`,
          display: 'flex', alignItems: 'flex-start', gap: 8
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.text, letterSpacing: -0.2 }}>
              交易所多空比{coin}
            </div>
            <div style={{ fontSize: 11, color: M.dim, marginTop: 2 }}>交易所多空持仓人数及持仓量比</div>
          </div>
          {/* coin + tf + refresh */}
          <LSPopover value={coin} options={LS_COINS} onChange={setCoin} />
          <LSPopover value={tf} options={LS_TFS} onChange={setTf} />
          <button aria-label="刷新" style={{
            width: 30, height: 30, padding: 0, borderRadius: 8,
            border: `1px solid ${M.borderSoft}`, background: M.bg,
            color: M.mid, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15.5-6.3M21 12a9 9 0 0 1-15.5 6.3M21 4v5h-5M3 20v-5h5" />
            </svg>
          </button>
        </div>

        {/* total hero card */}
        <div style={{ padding: '12px 12px 4px' }}>
          <div style={{
            padding: '14px 14px 12px', borderRadius: 14,
            background: M.elev, border: `1px solid ${M.borderSoft}`
          }}>
            {/* head: coin icon + 总计 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{
                width: 30, height: 30, borderRadius: '50%',
                background: '#F7931A', color: '#000',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700
              }}>B</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: M.text, lineHeight: 1.1 }}>{coin}</div>
                <div style={{ fontSize: 11, color: M.dim, marginTop: 2 }}>总计</div>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11, fontFamily: M.mono }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: M.dim, fontSize: 10 }}>做多</div>
                  <div style={{ color: M.up, fontWeight: 700, marginTop: 1 }}>US${data.total.longUsd}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: M.dim, fontSize: 10 }}>做空</div>
                  <div style={{ color: M.dn, fontWeight: 700, marginTop: 1 }}>US${data.total.shortUsd}</div>
                </div>
              </div>
            </div>
            {/* split bar with inline % */}
            <div style={{
              height: 32, borderRadius: 6, display: 'flex', overflow: 'hidden',
              fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: M.mono
            }}>
              <div style={{
                width: `${data.total.longPct}%`, background: M.up,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
              }}>{data.total.longPct.toFixed(2)}%</div>
              <div style={{
                width: `${data.total.shortPct}%`, background: M.dn,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
              }}>{data.total.shortPct.toFixed(2)}%</div>
            </div>
          </div>
        </div>

        {/* exchange section title */}
        <div style={{
          padding: '12px 16px 6px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 11, color: M.dim, fontFamily: M.mono
        }}>
          <span>交易所</span>
          <span>持仓占比 (多 VS 空)</span>
        </div>

        {/* exchange list */}
        <div style={{
          margin: '0 12px 16px',
          borderRadius: 12, overflow: 'hidden',
          border: `1px solid ${M.borderSoft}`
        }}>
          {data.rows.map((r, i) =>
          <LSRow key={r.ex} rank={i + 1} r={r} />
          )}
        </div>
      </div>
      <MTabBar active="market" />
    </div>);

}

/* ========================================================================
   SCREEN 6b — Order Entry (sheet for buy/sell)
   ======================================================================== */
function ScreenOrderEntry({ side = 'buy' }) {
  const isBuy = side === 'buy';
  const color = isBuy ? M.up : M.dn;
  const AVAILABLE = 1248.40;
  const LEVERAGES = [3, 5, 10, 20, 50, 75, 100];
  const MARGIN_MODES = ['全仓', '逐仓'];
  const ORDER_TYPES = ['限价委托', '市价委托', '条件委托'];

  const [orderType, setOrderType] = React.useState(0); // 0 限价 / 1 市价 / 2 条件
  const [marginMode, setMarginMode] = React.useState(0); // 0 全仓 / 1 逐仓
  const [leverage, setLeverage] = React.useState(10);
  const [price, setPrice] = React.useState(68420.12);
  const [trigger, setTrigger] = React.useState(68900);
  const [pct, setPct] = React.useState(50); // % of available used as margin
  const [tpsl, setTpsl] = React.useState(false);
  const [tp, setTp] = React.useState(isBuy ? 72500 : 64500);
  const [sl, setSl] = React.useState(isBuy ? 66800 : 70200);
  const [showLev, setShowLev] = React.useState(false);
  const [showMode, setShowMode] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // computed
  const isMarket = orderType === 1;
  const isCond = orderType === 2;
  const margin = AVAILABLE * pct / 100;
  const notional = margin * leverage;
  const amount = price > 0 ? notional / price : 0;
  const fee = notional * 0.0005;
  const liq = isBuy ?
  price * (1 - 0.9 / leverage) :
  price * (1 + 0.9 / leverage);

  const fmt = (n, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtAmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  // slider drag
  const trackRef = React.useRef(null);
  const dragging = React.useRef(false);
  const setPctFromX = (clientX) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, (clientX - r.left) / r.width * 100));
    setPct(Math.round(p));
  };
  React.useEffect(() => {
    const move = (e) => {if (dragging.current) setPctFromX(e.touches ? e.touches[0].clientX : e.clientX);};
    const up = () => {dragging.current = false;};
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, []);

  const stop = (e) => e.stopPropagation();
  const close = () => window.__nav?.sheet(null);

  // styled controls
  const fieldBox = (focus) => ({
    height: 46, padding: '0 10px 0 14px', borderRadius: 11, background: M.soft,
    border: `1px solid ${focus ? color : M.borderSoft}`,
    display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color .15s'
  });
  const inputStyle = {
    flex: 1, fontSize: 15, color: M.text, fontFamily: M.mono, fontWeight: 600,
    background: 'transparent', border: 0, outline: 'none', minWidth: 0
  };

  return (
    <div className="m-sheet-scrim" onClick={close}
    style={{ height: '100%', position: 'relative', background: 'rgba(15,22,35,0.55)', overflow: 'hidden' }}>
      <MStatus dark />
      <div className="m-sheet" onClick={stop} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, top: 80,
        background: M.elev, borderRadius: '24px 24px 0 0',
        boxShadow: '0 -16px 48px rgba(15,22,35,0.18)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* grabber */}
        <div style={{ padding: '10px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 42, height: 4, borderRadius: 2, background: M.border }} />
        </div>
        {/* head */}
        <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Av sym="₿" bg="linear-gradient(135deg, #F7931A 0%, #C16100 100%)" size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: M.text }}>
              {isBuy ? '买入 / 做多' : '卖出 / 做空'} BTC
            </div>
            <div style={{ fontSize: 12, color: M.mid, marginTop: 2 }}>
              BTC/USDT · 永续 · Binance
            </div>
          </div>
          <button data-action="close-sheet" onClick={close} style={{
            width: 32, height: 32, borderRadius: 16, background: M.soft,
            border: 0, color: M.mid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}><Ico d={ICONS.close} w={16} sw={2} /></button>
        </div>

        {/* leverage + margin mode (popovers) */}
        <div style={{ padding: '8px 20px 4px', display: 'flex', gap: 8, position: 'relative' }}>
          <button onClick={() => {setShowMode((s) => !s);setShowLev(false);}} style={{
            flex: 1, height: 34, borderRadius: 8, background: showMode ? M.violetSoft : M.soft,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 12px', fontSize: 12, color: M.text, border: 0, cursor: 'pointer'
          }}>
            <span style={{ color: M.mid }}>{MARGIN_MODES[marginMode]}</span>
            <Ico d={ICONS.caret} w={12} sw={2} />
          </button>
          <button onClick={() => {setShowLev((s) => !s);setShowMode(false);}} style={{
            flex: 1, height: 34, borderRadius: 8, background: showLev ? M.violetSoft : M.soft,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 12px', fontSize: 12, color: M.text, fontWeight: 600, border: 0, cursor: 'pointer'
          }}>
            <span>{leverage}×</span>
            <Ico d={ICONS.caret} w={12} sw={2} />
          </button>

          {showMode &&
          <div style={{
            position: 'absolute', top: 46, left: 20, zIndex: 5, width: 160,
            background: M.elev, border: `1px solid ${M.border}`, borderRadius: 10,
            boxShadow: '0 8px 24px rgba(15,22,35,0.20)', overflow: 'hidden'
          }}>
              {MARGIN_MODES.map((m, i) =>
            <button key={m} onClick={() => {setMarginMode(i);setShowMode(false);}} style={{
              display: 'block', width: '100%', padding: '10px 12px', textAlign: 'left',
              fontSize: 13, color: i === marginMode ? color : M.text,
              background: 'transparent', border: 0, cursor: 'pointer',
              fontWeight: i === marginMode ? 600 : 500
            }}>{m}</button>
            )}
            </div>
          }
          {showLev &&
          <div style={{
            position: 'absolute', top: 46, right: 20, zIndex: 5, width: 200,
            background: M.elev, border: `1px solid ${M.border}`, borderRadius: 10,
            boxShadow: '0 8px 24px rgba(15,22,35,0.20)', padding: 8
          }}>
              <div style={{ fontSize: 11, color: M.mid, padding: '4px 6px 8px' }}>选择杠杆倍数</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                {LEVERAGES.map((L) =>
              <button key={L} onClick={() => {setLeverage(L);setShowLev(false);}} style={{
                height: 30, borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: L === leverage ? color : M.soft,
                color: L === leverage ? '#fff' : M.text,
                border: 0, cursor: 'pointer', fontFamily: M.mono
              }}>{L}×</button>
              )}
              </div>
            </div>
          }
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '10px 20px 20px' }}>
          {/* order type tabs */}
          <div style={{ display: 'flex', gap: 14, fontSize: 13, fontWeight: 500, marginBottom: 14, borderBottom: `1px solid ${M.borderSoft}` }}>
            {ORDER_TYPES.map((t, i) => {
              const on = i === orderType;
              return (
                <button key={t} onClick={() => setOrderType(i)} style={{
                  padding: '8px 0', color: on ? M.text : M.mid, fontWeight: on ? 700 : 500,
                  borderBottom: on ? `2px solid ${color}` : '2px solid transparent',
                  background: 'transparent', border: 0, borderRadius: 0, cursor: 'pointer'
                }}>{t}</button>);

            })}
          </div>

          {/* trigger price (条件) */}
          {isCond &&
          <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: M.mid }}>触发价</span>
                <span style={{ fontSize: 11, color: M.dim }}>最新 {fmt(68420.12)}</span>
              </div>
              <div style={fieldBox(false)}>
                <input type="number" inputMode="decimal" value={trigger}
              onChange={(e) => setTrigger(parseFloat(e.target.value) || 0)}
              style={inputStyle} />
                <span style={{ fontSize: 11, color: M.dim }}>USDT</span>
              </div>
              <div style={{ height: 14 }} />
            </>
          }

          {/* price (only for limit / 条件) */}
          {!isMarket &&
          <>
              <div style={{ fontSize: 12, color: M.mid, marginBottom: 6 }}>价格</div>
              <div style={fieldBox(false)}>
                <input type="number" inputMode="decimal" value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              style={inputStyle} />
                <span style={{ fontSize: 11, color: M.dim }}>USDT</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <button onClick={() => setPrice((p) => +(p + 0.1).toFixed(2))}
                style={{ width: 24, height: 18, background: M.elev, border: `1px solid ${M.border}`, borderRadius: '4px 4px 0 0', color: M.mid, cursor: 'pointer', fontSize: 10 }}>+</button>
                  <button onClick={() => setPrice((p) => +Math.max(0, p - 0.1).toFixed(2))}
                style={{ width: 24, height: 18, background: M.elev, border: `1px solid ${M.border}`, borderTop: 0, borderRadius: '0 0 4px 4px', color: M.mid, cursor: 'pointer', fontSize: 10 }}>−</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 14 }}>
                {[
              { l: '最新', v: 68420.12 },
              { l: '买一', v: 68419.50 },
              { l: '卖一', v: 68420.80 }].
              map((o) =>
              <button key={o.l} onClick={() => setPrice(o.v)} style={{
                flex: 1, height: 24, borderRadius: 6, background: M.soft, border: 0,
                fontSize: 11, color: M.mid, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
              }}>
                    <span>{o.l}</span>
                    <span style={{ fontFamily: M.mono, color: M.text }}>{fmt(o.v)}</span>
                  </button>
              )}
              </div>
            </>
          }

          {isMarket &&
          <div style={{
            padding: '10px 12px', borderRadius: 10, background: M.soft, marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: M.mid
          }}>
              <Ico d={ICONS.bolt || ICONS.shield} w={14} fill={color} sw={0} />
              市价立即成交 · 参考价 <span style={{ fontFamily: M.mono, color: M.text, fontWeight: 600 }}>{fmt(68420.12)}</span> USDT
            </div>
          }

          {/* amount */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: M.mid }}>数量</span>
            <span style={{ fontSize: 11, color: M.dim, fontFamily: M.mono }}>可用 {fmt(AVAILABLE)} USDT</span>
          </div>
          <div style={fieldBox(false)}>
            <input type="number" inputMode="decimal" value={amount.toFixed(4)}
            onChange={(e) => {
              const a = parseFloat(e.target.value) || 0;
              const m = a * price / leverage;
              const p = Math.max(0, Math.min(100, m / AVAILABLE * 100));
              setPct(Math.round(p));
            }}
            style={inputStyle} />
            <span style={{ fontSize: 11, color: M.dim }}>BTC</span>
          </div>

          {/* % slider — clickable + draggable */}
          <div
            ref={trackRef}
            onMouseDown={(e) => {dragging.current = true;setPctFromX(e.clientX);}}
            onTouchStart={(e) => {dragging.current = true;setPctFromX(e.touches[0].clientX);}}
            style={{ position: 'relative', height: 48, margin: '14px 0 22px', cursor: 'pointer', touchAction: 'none', userSelect: 'none' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 15, height: 2, background: M.border, borderRadius: 1 }} />
            <div style={{ position: 'absolute', left: 0, top: 15, height: 2, width: `${pct}%`, background: color, borderRadius: 1, transition: dragging.current ? 'none' : 'width .12s' }} />
            {[0, 25, 50, 75, 100].map((p) => {
              const filled = p <= pct;
              return (
                <div key={p} onClick={(e) => {e.stopPropagation();setPct(p);}}
                style={{
                  position: 'absolute', left: `${p}%`, top: 9, transform: 'translateX(-50%)',
                  width: 14, height: 14, borderRadius: 7,
                  background: filled ? color : M.elev,
                  border: `2px solid ${filled ? color : M.border}`,
                  cursor: 'pointer'
                }} />);

            })}
            {/* draggable handle */}
            <div style={{
              position: 'absolute', left: `${pct}%`, top: 4, transform: 'translateX(-50%)',
              width: 24, height: 24, borderRadius: 12, background: color,
              border: '3px solid #fff',
              boxShadow: `0 2px 8px ${color}88`,
              transition: dragging.current ? 'none' : 'left .12s',
              pointerEvents: 'none'
            }} />
            {[0, 25, 50, 75, 100].map((p) =>
            <span key={p} onClick={(e) => {e.stopPropagation();setPct(p);}} style={{
              position: 'absolute', left: `${p}%`, top: 32, transform: 'translateX(-50%)',
              fontSize: 10, color: pct === p ? color : M.dim, fontWeight: pct === p ? 600 : 500, fontFamily: M.mono,
              cursor: 'pointer'
            }}>{p}%</span>
            )}
          </div>

          {/* TP / SL toggle + inputs */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            background: M.soft, borderRadius: 10, marginBottom: tpsl ? 8 : 14,
            cursor: 'pointer'
          }} onClick={() => setTpsl((t) => !t)}>
            <Ico d={ICONS.shield} w={14} fill={tpsl ? color : M.mid} sw={0} />
            <span style={{ fontSize: 12, color: tpsl ? M.text : M.mid, flex: 1 }}>止盈 / 止损</span>
            <div style={{
              width: 32, height: 20, borderRadius: 10,
              background: tpsl ? color : M.border, position: 'relative',
              transition: 'background .15s'
            }}>
              <div style={{
                position: 'absolute', left: tpsl ? 14 : 2, top: 2,
                width: 16, height: 16, borderRadius: 8, background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                transition: 'left .15s'
              }} />
            </div>
          </div>
          {tpsl &&
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: M.up, marginBottom: 4, fontWeight: 600 }}>止盈价</div>
                <div style={{ ...fieldBox(false), height: 40, padding: '0 10px' }}>
                  <input type="number" inputMode="decimal" value={tp}
                onChange={(e) => setTp(parseFloat(e.target.value) || 0)}
                style={{ ...inputStyle, fontSize: 13 }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: M.dn, marginBottom: 4, fontWeight: 600 }}>止损价</div>
                <div style={{ ...fieldBox(false), height: 40, padding: '0 10px' }}>
                  <input type="number" inputMode="decimal" value={sl}
                onChange={(e) => setSl(parseFloat(e.target.value) || 0)}
                style={{ ...inputStyle, fontSize: 13 }} />
                </div>
              </div>
            </div>
          }

          {/* preview rows */}
          <div style={{
            background: M.soft, borderRadius: 10, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12
          }}>
            <Stat2 label="保证金" v={`${fmt(margin)} USDT`} />
            <Stat2 label="名义价值" v={`${fmt(notional)} USDT`} />
            <Stat2 label="预计强平价" v={fmt(liq)} tone={isBuy ? 'dn' : 'up'} />
            <Stat2 label="手续费 (taker)" v={`${fmt(fee, 2)} USDT`} />
            {tpsl &&
            <>
                <Stat2 label="止盈预计收益" v={`+${fmt(Math.abs((tp - price) / price) * notional)} USDT`} tone="up" />
                <Stat2 label="止损预计损失" v={`-${fmt(Math.abs((sl - price) / price) * notional)} USDT`} tone="dn" />
              </>
            }
          </div>
        </div>

        {/* sticky bottom action */}
        <div style={{ padding: '12px 20px 36px', borderTop: `1px solid ${M.borderSoft}` }}>
          <button
            onClick={() => {
              if (pct === 0 || submitting) return;
              setSubmitting(true);
              setTimeout(() => {setSubmitting(false);close();}, 700);
            }}
            disabled={pct === 0 || submitting}
            style={{
              width: '100%', height: 50, borderRadius: 14, border: 0,
              background: pct === 0 ? M.border : color,
              color: '#fff', fontSize: 16, fontWeight: 700,
              cursor: pct === 0 ? 'default' : 'pointer',
              boxShadow: pct === 0 ? 'none' : `0 8px 24px ${color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background .15s'
            }}>
            {submitting ?
            <>
                <span style={{
                width: 16, height: 16, borderRadius: 8,
                border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                animation: 'qfSpin .8s linear infinite'
              }} />
                提交中…
              </> :
            pct === 0 ? '请选择数量' :
            <>
                <Ico d={isBuy ? ICONS.arrowU : ICONS.arrowD} w={16} sw={2.4} />
                {isBuy ? '确认买入' : '确认卖出'} {fmtAmt(amount)} BTC
              </>
            }
          </button>
          <div style={{ textAlign: 'center', fontSize: 10, color: M.dim, marginTop: 8 }}>
            提交后由 AI 风控自动检查仓位与最大回撤
          </div>
        </div>
        <style>{`@keyframes qfSpin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>);

}

function Stat2({ label, v, tone }) {
  const c = tone === 'up' ? M.up : tone === 'dn' ? M.dn : M.text;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: M.mid }}>{label}</span>
      <span style={{ color: c, fontFamily: M.mono, fontWeight: 600 }}>{v}</span>
    </div>);

}

Object.assign(window, { ScreenTradingDetail, ScreenLS, ScreenOrderEntry, OrderRow });
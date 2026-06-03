/* Mobile screens — 数据 hub: 聚合挂单 / 预测市场 / 币股
   The dropdown menu is shared by 行情数据 + 多空比 + these three. */

/* ========================================================================
   Shared: 数据 dropdown menu (header trigger + popover)
   ======================================================================== */
const DATA_HUB_ITEMS = [
  { k: 'market',  label: '行情数据',     hint: '自选 · 涨跌榜' },
  { k: 'ls',      label: '多空比',       hint: '永续合约 L/S' },
  { k: 'aggord',  label: '聚合挂单',     hint: '跨所合并深度', highlight: true },
  { k: 'predict', label: '预测市场',     hint: '链上事件概率' },
  { k: 'cstock',  label: '币股',         hint: '加密相关股票' },
];

function DataHubTitle({ current }) {
  const [open, setOpen] = React.useState(false);
  const item = DATA_HUB_ITEMS.find(i => i.k === current) || DATA_HUB_ITEMS[0];
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display:'inline-flex', alignItems:'center', gap:6,
          background:'transparent', border:0, padding:0, cursor:'pointer',
          color: M.text, fontSize:17, fontWeight:700, fontFamily:'inherit',
          letterSpacing:-0.2, whiteSpace:'nowrap',
        }}
      >
        {item.label}
        <span style={{
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          width:18, height:18, transform: open ? 'rotate(180deg)' : 'none',
          transition:'transform 160ms', color:M.mid,
        }}>
          <Ico d={ICONS.caret} w={14} sw={2.4}/>
        </span>
      </button>

      {open && (
        <React.Fragment>
          <div
            onClick={()=>setOpen(false)}
            style={{position:'fixed', inset:0, zIndex:60}}
          />
          <div style={{
            position:'absolute', top:34, left:-6, zIndex:61, minWidth:178,
            background: M.elev, border:`1px solid ${M.border}`, borderRadius:14,
            boxShadow:'0 18px 40px -10px rgba(15,22,35,0.28), 0 4px 10px rgba(15,22,35,0.10)',
            padding:6, display:'flex', flexDirection:'column',
          }}>
            {DATA_HUB_ITEMS.map(it => {
              const on = it.k === current;
              return (
                <button
                  key={it.k}
                  onClick={() => {
                    setOpen(false);
                    if (it.k !== current) window.__nav?.go(it.k);
                  }}
                  style={{
                    position:'relative',
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 12px', borderRadius:10, border:0, cursor:'pointer',
                    background: on ? M.violetGrad : 'transparent',
                    color: on ? '#fff' : M.text,
                    textAlign:'left', fontFamily:'inherit',
                    overflow:'hidden',
                  }}
                >
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14, fontWeight: on ? 600 : 500}}>{it.label}</div>
                    <div style={{
                      fontSize:10.5, marginTop:1,
                      color: on ? 'rgba(255,255,255,0.78)' : M.dim,
                      fontFamily: M.mono,
                    }}>{it.hint}</div>
                  </div>
                  {on && <Ico d={ICONS.check} w={14} sw={2.4}/>}
                </button>
              );
            })}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

/* shared right-side bell button used by every data-hub screen */
function DataHubBell({ onClick }) {
  /* keep visually consistent with ScreenTickers — but no unread count
     on the secondary screens since they don't own the notif state. */
  return (
    <button
      onClick={onClick || (()=>{})}
      style={{
        position:'relative', width:36, height:36, borderRadius:18, background:M.elev,
        border:`1px solid ${M.border}`, color:M.mid, cursor:'pointer', padding:0,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}
    >
      <Ico d={ICONS.bell} w={18}/>
    </button>
  );
}

/* page header used by all data-hub screens.
   Single row: scrollable tab strip on the left, notification badge on the right.
   Matches the reference design: purple underline active tab, gray inactive tabs,
   red badge with count on the far right. */
function DataHubHeader({ current, badgeCount = 3 }) {
  return (
    <div style={{
      background: M.elev,
      borderBottom: `1px solid ${M.border}`,
      position: 'relative', zIndex: 30,
      paddingTop: 52,          /* space for status bar / dynamic island */
      display: 'flex', alignItems: 'stretch',
    }}>
      {/* scrollable tabs */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', overflowX: 'auto', whiteSpace: 'nowrap',
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
        paddingLeft: 16,
      }}>
        {DATA_HUB_ITEMS.map(it => {
          const on = it.k === current;
          return (
            <button
              key={it.k}
              onClick={() => { if (it.k !== current) window.__nav?.go(it.k); }}
              style={{
                background: 'transparent', border: 0,
                padding: '12px 8px 0', margin: 0,
                cursor: 'pointer', flexShrink: 0,
                color: on ? M.text : M.mid,
                fontWeight: on ? 600 : 400,
                fontSize: 14,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                position: 'relative',
                /* bottom underline via box-shadow so it sits at the very bottom */
              }}
            >
              {it.label}
              {/* underline indicator */}
              <span style={{
                display: 'block',
                height: 2,
                borderRadius: 2,
                marginTop: 10,
                background: on ? M.violet : 'transparent',
              }}/>
            </button>
          );
        })}
      </div>

      {/* notification badge — right side, vertically centered with tabs */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center',
        paddingRight: 14, paddingLeft: 6,
        paddingBottom: 4,
      }}>
        <div style={{
          position: 'relative', width: 32, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* bell icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={M.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {/* red count badge */}
          {badgeCount > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -4,
              minWidth: 16, height: 16,
              borderRadius: 8,
              background: '#E5484D',
              color: '#fff',
              fontSize: 10, fontWeight: 700,
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px',
              lineHeight: 1,
              border: `1.5px solid ${M.elev}`,
            }}>{badgeCount}</span>
          )}
        </div>
      </div>

      <style>{`
        [data-board] .dhub-tabs::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

/* ========================================================================
   SCREEN — 聚合挂单 (Aggregated Order Book across exchanges)
   Aligned to PC /zh/aggregated-orderbook
   3 sub-tabs: 聚合挂单 (this) / 聚合持仓量 / 聚合成交量
   ======================================================================== */
const EXCHANGES = [
  { k:'BIN', name:'Binance', letter:'B', color:'#F0B90B', fg:'#000' },
  { k:'BYB', name:'Bybit',   letter:'Y', color:'#F7A600', fg:'#000' },
  { k:'BMX', name:'Bitmax',  letter:'B', color:'#1F2937', fg:'#fff' },
  { k:'OKX', name:'OKX',     letter:'O', color:'#000000', fg:'#fff' },
];
const EX_MAP = EXCHANGES.reduce((m,e)=>{ m[e.k]=e; return m; }, {});

/* ── ASKS  (top → bottom = highest price → near mid) ─────────────────── */
const AGG_ASKS = [
  { p:75864.00, q: 0.6120,  ex:'BIN' },
  { p:75859.00, q: 3.5520,  ex:'BIN' },
  { p:75853.00, q: 3.1880,  ex:'BMX' },
  { p:75848.00, q: 0.8620,  ex:'BIN' },
  { p:75843.00, q: 1.0640,  ex:'OKX' },
  { p:75837.00, q: 1.9640,  ex:'BIN' },
  { p:75832.00, q:34.3802,  ex:'BIN', hot:true },
  { p:75827.00, q: 3.3313,  ex:'BIN' },
  { p:75821.00, q:123.3580, ex:'BIN', hot:true },
  { p:75816.00, q:21.9960,  ex:'BIN' },
  { p:75811.00, q: 2.0880,  ex:'BYB' },
  { p:75805.00, q: 0.2650,  ex:'BIN' },
  { p:75800.00, q: 9.7420,  ex:'BYB' },
];

/* ── BIDS  (top → bottom = highest price → lowest) ───────────────────── */
const AGG_BIDS = [
  { p:75812.00, q:23.3536,  ex:'BIN' },
  { p:75807.00, q: 2.5655,  ex:'BIN' },
  { p:75801.00, q:171.6693, ex:'BIN', hot:true, best:true },
  { p:75796.00, q: 4.0290,  ex:'BIN' },
  { p:75791.00, q: 2.4460,  ex:'BIN' },
  { p:75785.00, q: 1.4290,  ex:'BIN' },
  { p:75780.00, q: 3.7140,  ex:'BIN' },
  { p:75775.00, q: 3.8360,  ex:'BIN' },
  { p:75769.00, q: 4.8030,  ex:'BIN' },
  { p:75764.00, q: 4.4160,  ex:'BIN' },
  { p:75759.00, q: 5.0120,  ex:'BIN' },
  { p:75753.00, q: 1.4880,  ex:'BIN' },
  { p:75748.00, q: 3.4800,  ex:'BIN' },
];

/* helper: cumulative totals — for asks, sum from the closest-to-mid OUTWARD.
   asks list is top→bottom = highest→nearest; cumulative grows as we go UP. */
function withCumulative(rows, side) {
  if (side === 'ask') {
    // walk from bottom (nearest mid) up
    let acc = 0;
    const out = rows.slice().reverse().map(r => { acc += r.q; return {...r, total: acc}; });
    return out.reverse();
  } else {
    // bids: walk from top down (highest is nearest mid)
    let acc = 0;
    return rows.map(r => { acc += r.q; return {...r, total: acc}; });
  }
}

/* aggregate by price bucket (1 / 10 / 100). Returns rows sorted descending. */
function aggregateRows(rows, bucketSize, side) {
  if (bucketSize <= 1) return rows;
  const rounder = side === 'ask'
    ? p => Math.ceil(p / bucketSize) * bucketSize
    : p => Math.floor(p / bucketSize) * bucketSize;
  const map = new Map();
  rows.forEach(r => {
    const bucket = rounder(r.p);
    const existing = map.get(bucket);
    if (existing) {
      existing.q += r.q;
      if (r.hot) existing.hot = true;
      if (r.best) existing.best = true;
    } else {
      map.set(bucket, { ...r, p: bucket });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.p - a.p);
}

function ExchangeIcon({ ex, size = 16 }) {
  const e = EX_MAP[ex];
  if (!e) return null;
  return (
    <span style={{
      width:size, height:size, borderRadius:'50%',
      background: e.color, color: e.fg,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      fontSize: size * 0.55, fontWeight:700,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      flexShrink:0,
    }}>{e.letter}</span>
  );
}

function ScreenAggOrders() {
  // sub-tab
  const [subTab, setSubTab] = React.useState('聚合挂单');
  // filters
  const [mode, setMode]     = React.useState('合约');     // 合约 / 现货
  const [coin, setCoin]     = React.useState('BTC');     // BTC / ETH
  // order book view
  const [view, setView]       = React.useState('both');    // both / asks / bids
  const [agg, setAgg]         = React.useState('1');
  const [aggOpen, setAggOpen] = React.useState(false);
  // exchange source settings
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [selectedEx, setSelectedEx]     = React.useState(EXCHANGES.map(e => e.k));

  const toggleEx = (k) =>
    setSelectedEx(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  const asks = React.useMemo(() => {
    const b = parseInt(agg, 10) || 1;
    const filtered = AGG_ASKS.filter(r => selectedEx.includes(r.ex));
    return withCumulative(aggregateRows(filtered, b, 'ask'), 'ask');
  }, [agg, selectedEx]);
  const bids = React.useMemo(() => {
    const b = parseInt(agg, 10) || 1;
    const filtered = AGG_BIDS.filter(r => selectedEx.includes(r.ex));
    return withCumulative(aggregateRows(filtered, b, 'bid'), 'bid');
  }, [agg, selectedEx]);
  const maxCum = Math.max(
    asks[0]?.total || 0,
    bids[bids.length-1]?.total || 0,
  );
  const bestAsk = asks[asks.length-1]?.p;
  const bestBid = bids[0]?.p;

  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus/>
      <DataHubHeader current="aggord"/>

      <div style={{flex:1, overflow:'auto', paddingBottom:100}}>
        {/* 3 sub-tabs — segmented */}
        <div style={{padding:'10px 16px 0', background:M.elev}}>
          <div style={{
            display:'flex', gap:4, padding:3, borderRadius:10,
            background:M.soft, border:`1px solid ${M.borderSoft}`,
          }}>
            {['聚合挂单','聚合持仓量','聚合成交量'].map(t => {
              const on = t === subTab;
              return (
                <button key={t} onClick={()=>setSubTab(t)} style={{
                  flex:1, height:32, padding:'0 4px', borderRadius:8,
                  border:0, cursor:'pointer',
                  background: on ? M.elev : 'transparent',
                  color: on ? M.text : M.mid,
                  fontSize:11.5, fontWeight: on ? 600 : 500,
                  fontFamily:'inherit', whiteSpace:'nowrap',
                  boxShadow: on ? '0 1px 2px rgba(15,23,42,0.06), 0 0 0 1px rgba(15,23,42,0.04)' : 'none',
                }}>{t}</button>
              );
            })}
          </div>
        </div>

        {/* 聚合持仓量 */}
        {subTab === '聚合持仓量' && <OpenInterestTab/>}

        {/* 聚合成交量 */}
        {subTab === '聚合成交量' && <AggVolumeTab/>}

        {subTab === '聚合挂单' && (
          <React.Fragment>
            {/* filter row: 合约/现货 + BTC/ETH */}
            <div style={{
              padding:'12px 16px 8px', background:M.elev,
              display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
            }}>
              <AggSegment value={mode} onChange={setMode} options={['合约','现货']}/>
              <AggSegment value={coin} onChange={setCoin} options={['BTC','ETH']}/>
            </div>

            {/* 24h stats line */}
            <div style={{
              padding:'4px 16px 12px', background:M.elev,
              display:'flex', alignItems:'center', gap:14, flexWrap:'wrap',
              fontSize:10.5, fontFamily:M.mono,
            }}>
              <span style={{color:M.dim}}>
                24h 成交量 <span style={{color:M.text, fontWeight:600}}>6.82万 {coin}</span>
              </span>
              <span style={{width:1, height:11, background:M.borderSoft}}/>
              <span style={{color:M.dim}}>
                24h 成交额 <span style={{color:M.text, fontWeight:600}}>US$7159万</span>
              </span>
            </div>

            {/* order book card */}
            <div style={{padding:'4px 12px 0'}}>
              <div style={{
                background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:12,
                overflow:'hidden',
              }}>
                {/* order book header */}
                <div style={{
                  padding:'12px 12px 10px', display:'flex', alignItems:'center', gap:8,
                  borderBottom:`1px solid ${M.borderSoft}`,
                }}>
                  <span style={{fontSize:12.5, fontWeight:600, color:M.text}}>
                    {coin}/USD 实时订单({mode})
                  </span>
                  <div style={{flex:1}}/>
                  {/* view mode toggle */}
                  <div style={{
                    display:'inline-flex', gap:0, padding:2, borderRadius:7,
                    background:M.soft, border:`1px solid ${M.borderSoft}`,
                  }}>
                    {[
                      {k:'both', label:'双向'},
                      {k:'asks', label:'卖单'},
                      {k:'bids', label:'买单'},
                    ].map(v => (
                      <button key={v.k} onClick={()=>setView(v.k)} aria-label={v.label}
                        style={{
                          width:24, height:22, padding:0, borderRadius:5,
                          border:0, cursor:'pointer',
                          background: view === v.k ? M.elev : 'transparent',
                          color: view === v.k ? M.violet : M.mid,
                          display:'inline-flex', alignItems:'center', justifyContent:'center',
                        }}>
                        <ViewModeIcon kind={v.k}/>
                      </button>
                    ))}
                  </div>
                  {/* aggregation dropdown */}
                  <div style={{position:'relative'}}>
                    <button onClick={()=>setAggOpen(v=>!v)} style={{
                      height:24, padding:'0 8px', borderRadius:6,
                      border:`1px solid ${aggOpen ? M.violet : M.border}`,
                      background: aggOpen ? M.violetGrad || M.violet : M.elev,
                      display:'inline-flex', alignItems:'center', gap:4,
                      fontSize:11, fontWeight:600,
                      color: aggOpen ? '#fff' : M.text, fontFamily:M.mono,
                      cursor:'pointer',
                    }}>
                      {agg}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                        style={{transform: aggOpen ? 'rotate(180deg)' : 'none', transition:'transform 160ms'}}>
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </button>
                  </div>

                  {/* settings gear — 交易所来源 (opens bottom drawer) */}
                  <div style={{position:'relative'}}>
                    <button
                      onClick={()=>setSettingsOpen(true)}
                      aria-label="交易所来源设置"
                      style={{
                        width:26, height:24, padding:0, borderRadius:6,
                        border:`1px solid ${settingsOpen ? M.violet : M.border}`,
                        background: settingsOpen ? M.violetSoft : M.elev,
                        color: settingsOpen ? M.violet : M.mid,
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        cursor:'pointer', flexShrink:0,
                      }}>
                      {/* gear icon */}
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* column header */}
                <div style={{
                  display:'grid',
                  gridTemplateColumns:'22px minmax(70px,1fr) minmax(60px,1fr) minmax(70px,1fr)',
                  gap:8,
                  padding:'8px 12px',
                  fontSize:10, color:M.dim, fontFamily:M.mono,
                  borderBottom:`1px solid ${M.borderSoft}`,
                }}>
                  <span/>
                  <span>价格(USDT)</span>
                  <span style={{textAlign:'right'}}>数量({coin})</span>
                  <span style={{textAlign:'right'}}>总计({coin})</span>
                </div>

                {/* asks */}
                {(view !== 'bids') && (
                  <div>
                    {asks.map((r,i) => (
                      <AggBookRow key={'a'+i} r={r} side="ask" maxCum={maxCum}/>
                    ))}
                  </div>
                )}

                {/* mid price strip (only in 双向 view) */}
                {view === 'both' && (
                  <div style={{
                    padding:'8px 12px',
                    background:`linear-gradient(90deg, ${M.upSoft}33, ${M.dnSoft}33)`,
                    borderTop:`1px solid ${M.borderSoft}`,
                    borderBottom:`1px solid ${M.borderSoft}`,
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                  }}>
                    <span style={{fontSize:10, color:M.dim}}>买一 / 卖一</span>
                    <span style={{
                      fontFamily:M.mono, fontSize:13, fontWeight:700,
                      color:M.text, letterSpacing:-0.2,
                    }}>
                      <span style={{color:M.up}}>{bestBid?.toFixed(2)}</span>
                      <span style={{color:M.dim, margin:'0 6px'}}>↔</span>
                      <span style={{color:M.dn}}>{bestAsk?.toFixed(2)}</span>
                    </span>
                  </div>
                )}

                {/* bids */}
                {(view !== 'asks') && (
                  <div>
                    {bids.map((r,i) => (
                      <AggBookRow key={'b'+i} r={r} side="bid" maxCum={maxCum} isLast={i === bids.length-1}/>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* depth chart card */}
            <div style={{padding:'12px 12px 16px'}}>
              <div style={{
                background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:12,
                padding:'12px 12px 10px',
              }}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                  <span style={{fontSize:12.5, fontWeight:600, color:M.text}}>订单深度</span>
                  <div style={{flex:1}}/>
                  <button style={{
                    display:'inline-flex', alignItems:'center', gap:4,
                    height:22, padding:'0 8px', borderRadius:6,
                    border:0, background:'transparent', cursor:'pointer',
                    color:M.warn, fontSize:11, fontWeight:600,
                    fontFamily:'inherit',
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9"/>
                      <path d="M12 8v5M12 16v.5"/>
                    </svg>
                    流动性热力图
                  </button>
                </div>
                <DepthChart asks={asks} bids={bids} bestAsk={bestAsk} bestBid={bestBid}/>
                <div style={{
                  marginTop:6, display:'flex', alignItems:'center', justifyContent:'space-between',
                  fontSize:10, color:M.dim, fontFamily:M.mono,
                }}>
                  <span style={{display:'inline-flex', alignItems:'center', gap:12}}>
                    <span style={{display:'inline-flex', alignItems:'center', gap:4}}>
                      <span style={{width:8, height:8, borderRadius:2, background:M.up}}/>
                      买单累计
                    </span>
                    <span style={{display:'inline-flex', alignItems:'center', gap:4}}>
                      <span style={{width:8, height:8, borderRadius:2, background:M.dn}}/>
                      卖单累计
                    </span>
                  </span>
                  <span>单位: {coin}</span>
                </div>
              </div>
            </div>
          </React.Fragment>
        )}
      </div>

      <MTabBar active="market"/>

      {/* ─── 数量精度 (aggregation) — bottom drawer ─── */}
      {aggOpen && (
        <div
          onClick={()=>setAggOpen(false)}
          style={{
            position:'absolute', inset:0, zIndex:85,
            background:'rgba(15,11,34,0.55)',
            animation:'m-fade-in .18s ease-out',
          }}>
          <div
            onClick={(e)=>e.stopPropagation()}
            style={{
              position:'absolute', left:0, right:0, bottom:0,
              background:M.elev, borderRadius:'20px 20px 0 0',
              boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
              display:'flex', flexDirection:'column',
              animation:'qfAggSheetUp .26s cubic-bezier(.2,.8,.2,1)',
            }}>
            <div style={{width:42, height:4, borderRadius:2, background:M.border, margin:'10px auto 0'}}/>
            <div style={{padding:'12px 16px 6px', fontSize:14, fontWeight:700, color:M.text}}>
              价格精度
            </div>
            <div style={{padding:'0 8px 6px'}}>
              {['1','10','100'].map((o, i) => {
                const on = o === agg;
                return (
                  <button
                    key={o}
                    onClick={()=>{ setAgg(o); setAggOpen(false); }}
                    style={{
                      display:'flex', alignItems:'center', gap:11,
                      width:'100%', padding:'12px 12px',
                      border:0, background:'transparent', cursor:'pointer',
                      fontFamily:'inherit', textAlign:'left',
                    }}>
                    <span style={{
                      flex:1, fontSize:14, fontWeight:600, fontFamily:M.mono,
                      color: on ? M.violet : M.text,
                    }}>{o}</span>
                    <span style={{
                      width:20, height:20, borderRadius:'50%', flexShrink:0,
                      background: on ? M.violet : 'transparent',
                      border: `1.5px solid ${on ? M.violet : M.border}`,
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      transition:'background 130ms, border-color 130ms',
                    }}>
                      {on && (
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7.2L5.8 10L11 4" stroke="#fff"
                            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{
              borderTop:`1px solid ${M.borderSoft}`,
              padding:'6px 8px calc(8px + env(safe-area-inset-bottom))',
            }}>
              <button
                onClick={()=>setAggOpen(false)}
                style={{
                  width:'100%', height:46, border:0, cursor:'pointer',
                  background:'transparent', color:M.text,
                  fontSize:14, fontWeight:600, fontFamily:'inherit',
                }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 交易所来源 — bottom drawer ─── */}
      {settingsOpen && (
        <div
          onClick={()=>setSettingsOpen(false)}
          style={{
            position:'absolute', inset:0, zIndex:85,
            background:'rgba(15,11,34,0.55)',
            animation:'m-fade-in .18s ease-out',
          }}>
          <div
            onClick={(e)=>e.stopPropagation()}
            style={{
              position:'absolute', left:0, right:0, bottom:0,
              background:M.elev, borderRadius:'20px 20px 0 0',
              boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
              display:'flex', flexDirection:'column', maxHeight:'82%',
              animation:'qfAggSheetUp .26s cubic-bezier(.2,.8,.2,1)',
            }}>
            {/* grab handle */}
            <div style={{width:42, height:4, borderRadius:2, background:M.border, margin:'10px auto 0'}}/>

            {/* header */}
            <div style={{
              padding:'12px 16px 8px', display:'flex', alignItems:'center', gap:8,
            }}>
              <div style={{fontSize:14, fontWeight:700, color:M.text, flex:1}}>交易所来源</div>
              <button
                onClick={()=>setSelectedEx(EXCHANGES.map(e=>e.k))}
                style={{
                  height:26, padding:'0 10px', borderRadius:7, border:0, cursor:'pointer',
                  background:M.violetSoft, color:M.violet, fontSize:11.5, fontWeight:600,
                  fontFamily:'inherit',
                }}>全选</button>
              <button
                onClick={()=>setSelectedEx([])}
                style={{
                  height:26, padding:'0 10px', borderRadius:7, border:0, cursor:'pointer',
                  background:M.soft, color:M.mid, fontSize:11.5, fontWeight:500,
                  fontFamily:'inherit',
                }}>清空</button>
            </div>

            {/* exchange list */}
            <div style={{padding:'2px 8px 6px', overflowY:'auto'}}>
              {EXCHANGES.map((ex, i) => {
                const checked = selectedEx.includes(ex.k);
                return (
                  <button
                    key={ex.k}
                    onClick={()=>toggleEx(ex.k)}
                    style={{
                      display:'flex', alignItems:'center', gap:11,
                      width:'100%', padding:'11px 12px',
                      border:0, background:'transparent', cursor:'pointer',
                      fontFamily:'inherit', textAlign:'left',
                    }}>
                    {/* colored exchange dot */}
                    <span style={{
                      width:20, height:20, borderRadius:'50%',
                      background: ex.color, color: ex.fg,
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      fontSize:9.5, fontWeight:700, flexShrink:0,
                      fontFamily:'system-ui, -apple-system, sans-serif',
                    }}>{ex.letter}</span>
                    {/* name */}
                    <span style={{
                      flex:1, fontSize:13.5, fontWeight:600,
                      color: checked ? M.text : M.mid,
                    }}>{ex.name}</span>
                    {/* circular check (filled when selected) */}
                    <span style={{
                      width:20, height:20, borderRadius:'50%', flexShrink:0,
                      background: checked ? M.violet : 'transparent',
                      border: `1.5px solid ${checked ? M.violet : M.border}`,
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      transition:'background 130ms, border-color 130ms',
                    }}>
                      {checked && (
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7.2L5.8 10L11 4" stroke="#fff"
                            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* cancel footer */}
            <div style={{
              borderTop:`1px solid ${M.borderSoft}`,
              padding:'6px 8px calc(8px + env(safe-area-inset-bottom))',
            }}>
              <button
                onClick={()=>setSettingsOpen(false)}
                style={{
                  width:'100%', height:46, border:0, cursor:'pointer',
                  background:'transparent', color:M.text,
                  fontSize:14, fontWeight:600, fontFamily:'inherit',
                }}>取消</button>
            </div>
          </div>
          <style>{`@keyframes qfAggSheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }`}</style>
        </div>
      )}
    </div>
  );
}

/* ─── small atoms ─── */
function AggSegment({ value, onChange, options }) {
  return (
    <div style={{
      display:'inline-flex', gap:0, padding:3, borderRadius:8,
      background:M.soft, border:`1px solid ${M.borderSoft}`,
    }}>
      {options.map(o => {
        const on = o === value;
        return (
          <button key={o} onClick={()=>onChange(o)} style={{
            height:26, padding:'0 14px', borderRadius:6,
            border:0, cursor:'pointer',
            background: on ? M.violetGrad || M.violet : 'transparent',
            color: on ? '#fff' : M.mid,
            fontSize:12, fontWeight: on ? 600 : 500,
            fontFamily:'inherit', whiteSpace:'nowrap',
            boxShadow: on ? '0 1px 2px rgba(124,92,255,0.32)' : 'none',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function ViewModeIcon({ kind }) {
  if (kind === 'asks') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="2.2" rx="0.6" fill="currentColor" opacity="0.9"/>
        <rect x="2" y="6.5" width="9"  height="2.2" rx="0.6" fill="currentColor" opacity="0.7"/>
        <rect x="2" y="10" width="6"  height="2.2" rx="0.6" fill="currentColor" opacity="0.5"/>
      </svg>
    );
  }
  if (kind === 'bids') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="6"  height="2.2" rx="0.6" fill="currentColor" opacity="0.5"/>
        <rect x="2" y="6.5" width="9"  height="2.2" rx="0.6" fill="currentColor" opacity="0.7"/>
        <rect x="2" y="10" width="12" height="2.2" rx="0.6" fill="currentColor" opacity="0.9"/>
      </svg>
    );
  }
  // both — split rows top + bottom
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="11" height="2" rx="0.6" fill="currentColor" opacity="0.85"/>
      <rect x="2" y="6.5" width="8" height="2" rx="0.6" fill="currentColor" opacity="0.85"/>
      <rect x="2" y="10" width="11" height="2" rx="0.6" fill="currentColor" opacity="0.55"/>
    </svg>
  );
}

function AggBookRow({ r, side, maxCum, isLast }) {
  const c    = side === 'ask' ? M.dn : M.up;
  const bg   = side === 'ask' ? M.dnSoft : M.upSoft;
  const w    = Math.min(100, (r.total / maxCum) * 100);
  // hot row gets a stronger volume fill behind the qty column
  const hotW = r.hot ? Math.min(100, (r.q / Math.max(r.total, 1)) * 100 * 0.9) : 0;
  return (
    <div style={{
      position:'relative',
      display:'grid',
      gridTemplateColumns:'22px minmax(70px,1fr) minmax(60px,1fr) minmax(70px,1fr)',
      gap:8, alignItems:'center',
      padding:'7px 12px', fontSize:11.5, fontFamily:M.mono,
      borderBottom: isLast ? 0 : `1px solid ${M.borderSoft}`,
    }}>
      {/* depth bar (cumulative) — anchored to right edge */}
      <span style={{
        position:'absolute', right:0, top:0, bottom:0,
        width:`${w}%`, background:bg, opacity:0.35,
        pointerEvents:'none',
      }}/>
      {/* hot row qty highlight (shorter, more saturated) */}
      {r.hot && (
        <span style={{
          position:'absolute', right:0, top:0, bottom:0,
          width:`${hotW + 30}%`, background:bg, opacity:0.45,
          pointerEvents:'none',
        }}/>
      )}
      <ExchangeIcon ex={r.ex} size={16}/>
      <span style={{position:'relative', color:c, fontWeight:600}}>
        {r.p.toFixed(2)}
      </span>
      <span style={{position:'relative', textAlign:'right', color:M.text}}>
        {r.q.toFixed(4)}
      </span>
      <span style={{position:'relative', textAlign:'right', color:M.text, fontWeight:500}}>
        {r.total.toFixed(4)}
      </span>
    </div>
  );
}

/* depth chart: cumulative depth curves, mid gap, y-axis ticks on right */
function DepthChart({ asks, bids, bestAsk, bestBid }) {
  const W = 320, H = 140, padR = 26, padL = 4;
  const allPrices = [
    ...asks.map(r => r.p),
    ...bids.map(r => r.p),
  ];
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const maxCum = Math.max(
    asks[0]?.total || 0,
    bids[bids.length-1]?.total || 0,
  );

  const x = (p) => padL + ((p - minP) / (maxP - minP)) * (W - padR - padL);
  const y = (v) => H - (v / maxCum) * (H - 8) - 4;

  // bids: sorted ascending by price (lowest first → highest near mid)
  // cumulative from lowest going up (largest at lowest price)
  // We need cumulative such that at the highest bid price (best bid), volume = bestBid total = first row's total
  // But our bids array is sorted highest→lowest; cumulative built in reverse
  // For the chart, draw bid line from lowest price (highest cum) descending to highest bid (lowest cum).
  // The shape: starts high on the left, comes down toward mid.
  const bidsByPriceAsc = bids.slice().sort((a,b)=>a.p-b.p); // lowest→highest
  // cumulative volume "to fill from this price down" → walk from highest price to lowest
  // already each row.total = cumulative from highest going down, so:
  //   for the highest bid (bestBid), total = q of that row only (smallest cum on bid side)
  //   for the lowest bid, total = sum of all bids (largest cum)
  // Wait that's the case if we set side='bid' in withCumulative — which walks top→bottom adding.
  // The first row (highest) has the smallest cumulative; the last row (lowest) has the largest.
  // For the chart, the X axis is price ASCENDING. So at the LEFT (lowest price), cum is HIGHEST.

  const askPath = (() => {
    // asks reverse so lowest price first
    const asc = asks.slice().reverse();
    // cumulative grows as price grows — total fields already represent cumulative from nearest-mid outward
    // but we need cumulative INCREASING as price goes UP (each higher level adds more sellers)
    const pts = asc.map(r => [x(r.p), y(r.total)]);
    // build step path
    let d = `M ${pts[0][0]} ${H-4} `;
    pts.forEach((p,i) => { d += `L ${p[0]} ${p[1]} `; });
    d += `L ${pts[pts.length-1][0]} ${H-4} Z`;
    return d;
  })();
  const askLine = (() => {
    const asc = asks.slice().reverse();
    const pts = asc.map(r => `${x(r.p)} ${y(r.total)}`);
    return 'M ' + pts.join(' L ');
  })();

  const bidPath = (() => {
    // bidsByPriceAsc: lowest→highest; total field = cumulative from highest down
    // at lowest price (left), total = full sum (highest cum)
    // at highest price (right), total = just one row (lowest cum)
    const pts = bidsByPriceAsc.map(r => [x(r.p), y(r.total)]);
    let d = `M ${pts[0][0]} ${H-4} `;
    pts.forEach((p,i) => { d += `L ${p[0]} ${p[1]} `; });
    d += `L ${pts[pts.length-1][0]} ${H-4} Z`;
    return d;
  })();
  const bidLine = (() => {
    const pts = bidsByPriceAsc.map(r => `${x(r.p)} ${y(r.total)}`);
    return 'M ' + pts.join(' L ');
  })();

  // y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{position:'relative', height:H+18}}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {/* grid */}
        {ticks.map(t => (
          <line key={'g'+t}
            x1={padL} x2={W-padR}
            y1={y(t*maxCum)} y2={y(t*maxCum)}
            stroke={M.borderSoft} strokeWidth="0.6" strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"/>
        ))}
        {/* bids (left, green) */}
        <path d={bidPath} fill={M.up} fillOpacity="0.18"/>
        <path d={bidLine} fill="none" stroke={M.up} strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"/>
        {/* asks (right, red) */}
        <path d={askPath} fill={M.dn} fillOpacity="0.16"/>
        <path d={askLine} fill="none" stroke={M.dn} strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"/>
      </svg>
      {/* y-axis labels (BTC) */}
      <div style={{position:'absolute', right:0, top:0, height:H,
        pointerEvents:'none'}}>
        {ticks.map(t => (
          <span key={'t'+t} style={{
            position:'absolute', right:0,
            top:`${(1-t)*100}%`, transform:'translateY(-50%)',
            fontSize:9, color:M.faint, fontFamily:M.mono,
          }}>{(t*maxCum).toFixed(0)}</span>
        ))}
      </div>
      {/* x-axis labels */}
      <div style={{
        position:'absolute', left:0, right:padR, bottom:0,
        display:'flex', justifyContent:'space-between',
        fontSize:9, color:M.faint, fontFamily:M.mono,
      }}>
        <span>{Math.floor(minP)}</span>
        <span>{Math.floor((minP+maxP)/2)}</span>
        <span>{Math.floor(maxP)}</span>
      </div>
    </div>
  );
}

/* ============= 聚合持仓量 — Aggregated Open Interest ============= */
/* PC 字段: 排名 / 交易所 / 持仓(BTC) / 持仓(USD) / 占比 / 持仓变化(1h/4h/24h) / 持仓/24h成交额 */
const OI_COINS = ['BTC','ETH','SOL','XRP','DOGE','HYPE','BNB','ZEC','BCH','SUI','ADA','LINK','AVAX'];

/* exchange registry (logos as colored circle + letter) — extends the order-book set */
const OI_EX = {
  BIN:  { name:'Binance',     letter:'B', color:'#F0B90B', fg:'#000' },
  BYB:  { name:'Bybit',       letter:'Y', color:'#F7A600', fg:'#000' },
  LB:   { name:'LBank',       letter:'L', color:'#1B1B1B', fg:'#fff' },
  BG:   { name:'Bitget',      letter:'G', color:'#00D8C9', fg:'#000' },
  KC:   { name:'KuCoin',      letter:'K', color:'#22D896', fg:'#000' },
  OKX:  { name:'OKX',         letter:'O', color:'#000000', fg:'#fff' },
  BIX:  { name:'BingX',       letter:'X', color:'#2962FF', fg:'#fff' },
  WBT:  { name:'WhiteBIT',    letter:'W', color:'#0E1726', fg:'#fff' },
  MEX:  { name:'MEXC',        letter:'M', color:'#1D6EFC', fg:'#fff' },
  HL:   { name:'Hyperliquid', letter:'H', color:'#34D399', fg:'#000' },
  GT:   { name:'Gate',        letter:'G', color:'#6C5CE7', fg:'#fff' },
  BTX:  { name:'Bitunix',     letter:'B', color:'#0E1726', fg:'#fff' },
  CEX:  { name:'CoinEx',      letter:'C', color:'#2EB8AA', fg:'#fff' },
  CME:  { name:'CME',         letter:'M', color:'#5B9BD5', fg:'#fff' },
  KRK:  { name:'Kraken',      letter:'K', color:'#5841D8', fg:'#fff' },
  HTX:  { name:'HTX',         letter:'H', color:'#3076FF', fg:'#fff' },
  LGT:  { name:'Lighter',     letter:'L', color:'#A78BFA', fg:'#fff' },
  BMX:  { name:'Bitmex',      letter:'X', color:'#1B1B1B', fg:'#fff' },
  CB:   { name:'Coinbase',    letter:'C', color:'#1652F0', fg:'#fff' },
  AST:  { name:'Aster',       letter:'A', color:'#F59E0B', fg:'#000' },
  CRP:  { name:'Crypto.com',  letter:'C', color:'#003CDA', fg:'#fff' },
  DYX:  { name:'dYdX',        letter:'D', color:'#6966FF', fg:'#fff' },
};

const OI_DATA = {
  BTC: {
    total: { qty: 3.202e9, usd: 7.6e8, h1: -0.80, h4: -1.38, h24: -8.95, oiVol: 0.1003 },
    rows: [
      { ex:'BIN', qty:3.58e8,  usd:8493.45e4, pct:11.18, h1:-1.05, h4:-1.79, h24: -8.35,  oiVol:0.0812 },
      { ex:'BYB', qty:2.04e8,  usd:4844.29e4, pct: 6.38, h1: 0.06, h4:-4.77, h24:-15.73,  oiVol:0.0342 },
      { ex:'LB',  qty:1.80e8,  usd:4284.88e4, pct: 5.64, h1: 0.00, h4:-1.42, h24: -5.54,  oiVol:0.0000 },
      { ex:'BG',  qty:1.60e8,  usd:3785.66e4, pct: 4.98, h1:-0.67, h4: 0.67, h24:  2.72,  oiVol:0.0371 },
      { ex:'KC',  qty:1.56e8,  usd:3703.78e4, pct: 4.87, h1: 0.42, h4: 1.88, h24:-18.07,  oiVol:0.0270 },
      { ex:'OKX', qty:1.26e8,  usd:2999.09e4, pct: 3.95, h1:-0.54, h4: 0.07, h24: -7.79,  oiVol:0.0204 },
      { ex:'BIX', qty:9194.84e4, usd:2182.4e4,pct: 2.87, h1:-5.01, h4: 1.64, h24: -8.19,  oiVol:0.0000 },
      { ex:'WBT', qty:7992.58e4, usd:1890.99e4,pct: 2.49, h1:-0.96, h4:-1.42, h24: -9.12, oiVol:0.0000 },
      { ex:'MEX', qty:6398.44e4, usd:1518.94e4,pct: 2.00, h1:-1.70, h4:-3.36, h24:-13.27, oiVol:0.0000 },
      { ex:'HL',  qty:5200.5e4,  usd:1234.08e4,pct: 1.62, h1:-0.26, h4:-3.43, h24: -3.44, oiVol:0.0000 },
      { ex:'GT',  qty:4000.51e4, usd:948.92e4, pct: 1.25, h1:-0.77, h4:-4.89, h24:-16.88, oiVol:0.0076 },
      { ex:'BTX', qty:2047.52e4, usd:485.88e4, pct: 0.64, h1:-2.71, h4:-3.98, h24:-16.66, oiVol:0.0000 },
      { ex:'CEX', qty:1687.86e4, usd:400.7e4,  pct: 0.53, h1:-0.50, h4: 1.15, h24:-10.39, oiVol:0.0000 },
      { ex:'CME', qty:1409e4,    usd:334.5e4,  pct: 0.44, h1:-0.03, h4: 3.93, h24:  0.00, oiVol:0.0000 },
      { ex:'KRK', qty:1129.05e4, usd:267.93e4, pct: 0.35, h1:-0.17, h4:-2.75, h24:-15.05, oiVol:0.0000 },
      { ex:'HTX', qty: 929.47e4, usd:220.43e4, pct: 0.29, h1: 0.00, h4:-2.08, h24: -2.19, oiVol:0.0000 },
      { ex:'LGT', qty: 478.2e4,  usd:113.43e4, pct: 0.15, h1:-1.28, h4:-4.67, h24: -8.05, oiVol:0.0000 },
      { ex:'BMX', qty: 386.57e4, usd: 91.88e4, pct: 0.12, h1:-8.55, h4:-9.32, h24: -9.48, oiVol:0.0000 },
      { ex:'CB',  qty: 288.06e4, usd: 68.38e4, pct: 0.09, h1:-1.13, h4:-10.06,h24:-14.27, oiVol:0.0000 },
      { ex:'AST', qty: 255.36e4, usd: 60.78e4, pct: 0.08, h1: 0.25, h4:-2.11, h24: -5.17, oiVol:0.0000 },
      { ex:'CRP', qty: 148.64e4, usd: 35.3e4,  pct: 0.05, h1: 0.26, h4: 1.84, h24:-11.21, oiVol:0.0000 },
      { ex:'DYX', qty: 120.66e4, usd: 28.65e4, pct: 0.04, h1:-0.08, h4:-1.38, h24:  1.58, oiVol:0.0000 },
    ],
  },
};

function fmtOiQty(n, coin) {
  if (n >= 1e8) return (n/1e8).toFixed(2).replace(/\.?0+$/,'') + '亿 ' + coin;
  if (n >= 1e4) return (n/1e4).toFixed(2).replace(/\.?0+$/,'') + '万 ' + coin;
  return n.toLocaleString('en-US') + ' ' + coin;
}
function fmtOiUsd(n) {
  if (n >= 1e8) return 'US$' + (n/1e8).toFixed(2).replace(/\.?0+$/,'') + '亿';
  if (n >= 1e4) return 'US$' + (n/1e4).toFixed(2).replace(/\.?0+$/,'') + '万';
  return 'US$' + n.toLocaleString('en-US');
}
function fmtOiPct(p) {
  const sign = p > 0 ? '+' : '';
  return sign + p.toFixed(2) + '%';
}
function oiPctColor(p) {
  return p > 0 ? M.up : p < 0 ? M.dn : M.mid;
}

function OIExchangeIcon({ k, size=24 }) {
  const e = OI_EX[k];
  if (!e) return null;
  return (
    <span style={{
      width:size, height:size, borderRadius: Math.round(size * 0.28),
      background:e.color, color:e.fg,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      fontSize: size * 0.5, fontWeight:700,
      fontFamily:'system-ui, -apple-system, sans-serif',
      flexShrink:0,
    }}>{e.letter}</span>
  );
}

const AGG_COIN_COLOR = { BTC:'#F7931A', ETH:'#627EEA', SOL:'#9945FF', XRP:'#23292F', DOGE:'#C2A633', BNB:'#F0B90B', HYPE:'#16C783', SUI:'#4DA2FF', ADA:'#0033AD', LINK:'#2A5ADA', PEPE:'#3D8E41', WIF:'#C8A06B', ARB:'#28A0F0', OP:'#FF0420' };
function CoinFilterChips({ value, onChange, coins }) {
  const [searching, setSearching] = React.useState(false);

  const renderResults = (q, pick) =>
    coins.filter(c => c.toLowerCase().includes(q.toLowerCase()))
      .map(c => (
        <SearchResultRow key={c} letter={c.slice(0,1)} color={AGG_COIN_COLOR[c] || M.violet}
          title={c} sub="/ USDT" onClick={()=>pick(c)}/>
      ));

  return (
    <React.Fragment>
      <div style={{position:'relative', background:M.elev}}>
        <div className="oi-chips-scroll" style={{
          display:'flex', gap:6, padding:'4px 16px 10px',
          paddingRight:44, overflowX:'auto', whiteSpace:'nowrap',
          scrollbarWidth:'none', WebkitOverflowScrolling:'touch',
        }}>
          {coins.map(c => {
            const on = c === value;
            return (
              <button key={c} onClick={()=>onChange(c)} style={{
                height:30, padding:'0 14px', borderRadius:8,
                border: on ? `1px solid ${M.violet}` : '1px solid transparent',
                background: on ? M.violetSoft : 'transparent',
                color: on ? M.violet : M.mid,
                fontSize:12, fontWeight: on ? 700 : 500,
                fontFamily:M.mono, whiteSpace:'nowrap', flexShrink:0,
                cursor:'pointer',
              }}>{c}</button>
            );
          })}
          <style>{`.oi-chips-scroll::-webkit-scrollbar{display:none}`}</style>
        </div>
        {/* sticky search button */}
        <div style={{
          position:'absolute', right:0, top:0, bottom:0,
          display:'flex', alignItems:'center', paddingRight:8, paddingBottom:6,
          background:`linear-gradient(to right, transparent, ${M.elev} 40%)`,
          pointerEvents:'none',
        }}>
          <button aria-label="搜索币种" onClick={()=>setSearching(true)} style={{
            width:30, height:30, padding:0, borderRadius:8,
            border:0, background:M.elev, color:M.mid, cursor:'pointer',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            pointerEvents:'all',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm5.5 12.5L21 21"/>
            </svg>
          </button>
        </div>
      </div>

      <SearchOverlay
        open={searching}
        onClose={()=>setSearching(false)}
        placeholder="搜索币种"
        hotLabel="热门币种"
        hot={coins}
        onPick={onChange}
        renderResults={renderResults}
        emptyText="无匹配币种"
      />
    </React.Fragment>
  );
}

/* shared grid template for the OI table */
const OI_GRID = '1fr 64px 84px 64px';

function OITableHeader() {
  return (
    <div style={{
      display:'grid', gridTemplateColumns:OI_GRID, gap:8,
      padding:'8px 16px 6px', alignItems:'center',
      fontSize:11, color:M.dim, fontFamily:M.mono,
    }}>
      <span>交易所</span>
      <span>占比</span>
      <span style={{textAlign:'right'}}>持仓</span>
      <span style={{textAlign:'right'}}>24H变化</span>
    </div>
  );
}

function OITotalCard({ coin, total }) {
  const pos = total.h24 >= 0;
  return (
    <div style={{
      display:'grid', gridTemplateColumns:OI_GRID, gap:8,
      padding:'10px 16px', alignItems:'center',
      borderBottom:`1px solid ${M.borderSoft}`,
      background:M.elev,
    }}>
      {/* exchange */}
      <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
        <span style={{
          width:28, height:28, borderRadius:8, flexShrink:0,
          background:M.soft, border:`1px solid ${M.borderSoft}`,
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          fontSize:13, fontWeight:700, color:M.mid,
        }}>#</span>
        <span style={{fontSize:13.5, fontWeight:700, color:M.text}}>全部</span>
      </div>
      {/* 占比 */}
      <div>
        <div style={{fontSize:12, fontFamily:M.mono, color:M.text, fontWeight:600}}>100%</div>
        <div style={{height:3, borderRadius:2, background:M.soft, marginTop:3}}>
          <div style={{height:'100%', width:'100%', borderRadius:2, background:M.violet}}/>
        </div>
      </div>
      {/* 持仓 */}
      <div style={{textAlign:'right'}}>
        <div style={{fontSize:12, fontWeight:600, color:M.text, fontFamily:M.mono, whiteSpace:'nowrap'}}>{fmtOiUsd(total.usd)}</div>
        <div style={{fontSize:10.5, color:M.dim, fontFamily:M.mono, marginTop:1, whiteSpace:'nowrap'}}>{fmtOiQty(total.qty, coin)}</div>
      </div>
      {/* 24H变化 */}
      <div style={{display:'flex', justifyContent:'flex-end'}}>
        <span style={{
          padding:'4px 7px', borderRadius:6,
          background: pos ? M.up : M.dn, color:'#fff',
          fontSize:11, fontWeight:600, fontFamily:M.mono, whiteSpace:'nowrap',
        }}>{pos?'+':''}{total.h24.toFixed(2)}%</span>
      </div>
    </div>
  );
}

function OIRow({ rank, r, coin, maxPct }) {
  const pos = r.h24 >= 0;
  return (
    <div style={{
      display:'grid', gridTemplateColumns:OI_GRID, gap:8,
      padding:'10px 16px', alignItems:'center',
      borderBottom:`1px solid ${M.borderSoft}`,
      background:M.elev,
    }}>
      {/* exchange */}
      <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
        <OIExchangeIcon k={r.ex} size={28}/>
        <span style={{
          fontSize:13, fontWeight:600, color:M.text,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{OI_EX[r.ex]?.name || r.ex}</span>
      </div>
      {/* 占比 */}
      <div>
        <div style={{fontSize:12, fontFamily:M.mono, color:M.text, fontWeight:500}}>
          {r.pct.toFixed(1)}%
        </div>
        <div style={{height:3, borderRadius:2, background:M.soft, marginTop:3}}>
          <div style={{
            height:'100%', borderRadius:2,
            width:`${Math.min(100, (r.pct / (maxPct||1)) * 100)}%`,
            background:M.violet,
          }}/>
        </div>
      </div>
      {/* 持仓 */}
      <div style={{textAlign:'right'}}>
        <div style={{fontSize:12, fontWeight:600, color:M.text, fontFamily:M.mono, whiteSpace:'nowrap'}}>{fmtOiUsd(r.usd)}</div>
        <div style={{fontSize:10.5, color:M.dim, fontFamily:M.mono, marginTop:1, whiteSpace:'nowrap'}}>{fmtOiQty(r.qty, coin)}</div>
      </div>
      {/* 24H变化 */}
      <div style={{display:'flex', justifyContent:'flex-end'}}>
        <span style={{
          padding:'4px 7px', borderRadius:6,
          background: pos ? M.up : M.dn, color:'#fff',
          fontSize:11, fontWeight:600, fontFamily:M.mono, whiteSpace:'nowrap',
        }}>{pos?'+':''}{r.h24.toFixed(2)}%</span>
      </div>
    </div>
  );
}

function OpenInterestTab() {
  const [coin, setCoin] = React.useState('BTC');
  const [search, setSearch] = React.useState('');
  // sort: dir cycles desc → asc → null
  const [sortKey, setSortKey] = React.useState('qty');
  const [sortDir, setSortDir] = React.useState('desc');
  const [sortOpen, setSortOpen] = React.useState(false);
  const data = OI_DATA[coin];
  const q = search.trim().toLowerCase();

  const SORT_OPTS = [
    { k:'qty',   label:'持仓量' },
    { k:'pct',   label:'占比' },
    { k:'h1',    label:'1h 变化' },
    { k:'h4',    label:'4h 变化' },
    { k:'h24',   label:'24h 变化' },
    { k:'oiVol', label:'OI/V' },
  ];
  const activeOpt = SORT_OPTS.find(o => o.k === sortKey);
  const onPickSort = (k) => {
    if (k !== sortKey) { setSortKey(k); setSortDir('desc'); }
    else if (sortDir === 'desc') setSortDir('asc');
    else if (sortDir === 'asc')  setSortDir(null);
    else { setSortDir('desc'); }
    setSortOpen(false);
  };

  const filteredRows = React.useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (q) rows = rows.filter(r => (OI_EX[r.ex]?.name || r.ex).toLowerCase().includes(q));
    if (sortDir) {
      const sign = sortDir === 'desc' ? -1 : 1;
      rows = rows.slice().sort((a,b) => sign * ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)));
    }
    return rows;
  }, [data, q, sortKey, sortDir]);

  const sortArrow = sortDir === 'desc' ? '↓' : sortDir === 'asc' ? '↑' : '↕';

  return (
    <React.Fragment>
      {/* coin filter chips */}
      <div style={{background:M.elev, paddingTop:12}}>
        <CoinFilterChips value={coin} onChange={setCoin} coins={OI_COINS}/>
      </div>


      {!data ? (
        <div style={{padding:'48px 24px', textAlign:'center'}}>
          <div style={{fontSize:13, color:M.dim, marginBottom:6}}>{coin}</div>
          <div style={{fontSize:11, color:M.faint}}>暂无数据</div>
        </div>
      ) : filteredRows.length === 0 ? (
        <div style={{padding:'48px 24px', textAlign:'center'}}>
          <div style={{fontSize:12, color:M.dim}}>无匹配交易所</div>
        </div>
      ) : (
        /* exchange list */
        <div style={{
          margin:'8px 12px 16px',
          borderRadius:12, overflow:'hidden',
          border:`1px solid ${M.borderSoft}`,
        }}>
          <OITableHeader/>
          <OITotalCard coin={coin} total={data.total}/>
          {filteredRows.map((r, _i, arr) => {
            const maxPct = Math.max(...arr.map(x => x.pct));
            return <OIRow key={r.ex} rank={data.rows.indexOf(r)+1} r={r} coin={coin} maxPct={maxPct}/>;
          })}
        </div>
      )}
    </React.Fragment>
  );
}

/* ============= 聚合成交量 — Aggregated Trading Volume ============= */
/* PC: 单卡片，按交易所列出合约成交额。总计行在顶部，下方逐所列出，
   每行 = 名称 + 横向占比条 + $ 金额。横条颜色为各所配色。 */
const VOL_COINS = ['BTC','ETH','SOL','XRP','DOGE','HYPE','BNB','SUI','ADA','LINK'];

/* exchange ↦ bar color (reuses OI_EX where possible; adds missing) */
const VOL_COLOR = {
  BIN:'#7C5CFF', OKX:'#E5484D', MEX:'#F5A524', BYB:'#16A36B', GT:'#22D3EE',
  BTX:'#3B82F6', BG:'#A78BFA', CB:'#E5484D', WBT:'#F5A524', HL:'#16A36B',
  BIX:'#3B82F6', APX:'#EC4899', CRP:'#10B981', AST:'#F97316', EDX:'#EC4899',
  LGT:'#A78BFA', DER:'#E5484D', HTX:'#3B82F6', KRK:'#5841D8', KC:'#22D896',
  LB:'#94A3B8', EXT:'#94A3B8', BMX:'#1F2937', CEX:'#2EB8AA', DYX:'#6966FF',
  BFX:'#94A3B8', PRD:'#94A3B8', DFT:'#94A3B8', TOTAL:'#3B82F6',
};
const VOL_EX_NAME = {
  BIN:'Binance', OKX:'OKX', MEX:'MEXC', BYB:'Bybit', GT:'Gate',
  BTX:'Bitunix', BG:'Bitget', CB:'Coinbase', WBT:'WhiteBIT', HL:'Hyperliquid',
  BIX:'BingX', APX:'ApeX Omni', CRP:'Crypto.com', AST:'Aster',
  EDX:'EdgeX', LGT:'Lighter', DER:'Deribit', HTX:'HTX', KRK:'Kraken',
  KC:'KuCoin', LB:'LBank', EXT:'Extended', BMX:'Bitmex', CEX:'CoinEx',
  DYX:'dYdX', BFX:'Bitfinex', PRD:'Paradex', DFT:'Drift',
};

const VOL_DATA = {
  BTC: {
    total: 63.39,
    rows: [
      { ex:'BIN', v:15.48 }, { ex:'OKX', v:7.47 },  { ex:'MEX', v:6.31 },
      { ex:'BYB', v:5.50 },  { ex:'GT',  v:4.93 },  { ex:'BTX', v:3.91 },
      { ex:'BG',  v:3.19 },  { ex:'CB',  v:2.61 },  { ex:'WBT', v:2.49 },
      { ex:'HL',  v:2.22 },  { ex:'BIX', v:1.55 },  { ex:'APX', v:1.13 },
      { ex:'CRP', v:0.99 },  { ex:'AST', v:0.96 },  { ex:'EDX', v:0.88 },
      { ex:'LGT', v:0.81 },  { ex:'DER', v:0.49 },  { ex:'HTX', v:0.44 },
      { ex:'KRK', v:0.36 },  { ex:'KC',  v:0.33 },  { ex:'EXT', v:0.32 },
      { ex:'LB',  v:0.31 },  { ex:'BMX', v:0.22 },  { ex:'CEX', v:0.18 },
      { ex:'DYX', v:0.16 },  { ex:'BFX', v:0.08 },  { ex:'PRD', v:0.04 },
      { ex:'DFT', v:0.02 },
    ],
  },
  ETH: {
    total: 51.70,
    rows: [
      { ex:'BIN', v:14.45 }, { ex:'OKX', v:9.38 },  { ex:'GT',  v:5.45 },
      { ex:'BTX', v:4.89 },  { ex:'BYB', v:3.56 },  { ex:'MEX', v:2.54 },
      { ex:'BG',  v:2.44 },  { ex:'WBT', v:1.74 },  { ex:'CB',  v:1.59 },
      { ex:'HL',  v:0.90 },  { ex:'BIX', v:0.86 },  { ex:'EDX', v:0.84 },
      { ex:'HTX', v:0.76 },  { ex:'AST', v:0.66 },  { ex:'CRP', v:0.34 },
      { ex:'KC',  v:0.25 },  { ex:'LB',  v:0.23 },  { ex:'EXT', v:0.19 },
      { ex:'DER', v:0.12 },  { ex:'LGT', v:0.12 },  { ex:'APX', v:0.12 },
      { ex:'BMX', v:0.09 },  { ex:'KRK', v:0.09 },  { ex:'CEX', v:0.07 },
      { ex:'BFX', v:0.01 },  { ex:'DYX', v:0.01 },  { ex:'PRD', v:0.01 },
      { ex:'DFT', v:0.00 },
    ],
  },
};

function fmtVolUsd(b) {
  // b is in billions
  if (b >= 10) return '$' + b.toFixed(2) + 'B';
  if (b >= 1)  return '$' + b.toFixed(2) + 'B';
  if (b >= 0.01) return '$' + b.toFixed(2) + 'B';
  return '$' + b.toFixed(2) + 'B';
}

function VolumeRow({ name, value, total, color, isTotal }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'78px 1fr 64px',
      gap:10, alignItems:'center',
      padding:'10px 14px',
      borderBottom:`1px solid ${M.borderSoft}`,
    }}>
      <span style={{
        fontSize:12, fontFamily:'inherit',
        fontWeight: isTotal ? 700 : 500,
        color: isTotal ? M.text : M.mid,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
      }}>{name}</span>
      <span style={{
        position:'relative', height:6, borderRadius:3,
        background:M.soft, overflow:'hidden',
      }}>
        <span style={{
          position:'absolute', left:0, top:0, bottom:0,
          width:`${pct}%`, background:color, borderRadius:3,
          transition:'width 220ms ease',
        }}/>
      </span>
      <span style={{
        fontSize:12, fontFamily:M.mono,
        fontWeight: isTotal ? 700 : 600,
        color: isTotal ? M.text : M.text,
        textAlign:'right', whiteSpace:'nowrap',
      }}>{fmtVolUsd(value)}</span>
    </div>
  );
}

function AggVolumeTab() {
  const [coin, setCoin] = React.useState('BTC');
  const data = VOL_DATA[coin];

  return (
    <React.Fragment>
      {/* coin filter chips — same style as OI tab */}
      <div style={{background:M.elev, paddingTop:12}}>
        <CoinFilterChips value={coin} onChange={setCoin} coins={VOL_COINS}/>
      </div>

      {!data ? (
        <div style={{padding:'48px 24px', textAlign:'center'}}>
          <div style={{fontSize:13, color:M.dim, marginBottom:6}}>{coin}</div>
          <div style={{fontSize:11, color:M.faint}}>暂无数据</div>
        </div>
      ) : (
        <div style={{
          margin:'12px 12px 16px',
          borderRadius:12, overflow:'hidden',
          border:`1px solid ${M.borderSoft}`,
          background:M.elev,
        }}>
          {/* total row — anchors the 100% bar */}
          <VolumeRow
            name="总计"
            value={data.total}
            total={data.total}
            color={VOL_COLOR.TOTAL}
            isTotal
          />
          {/* exchange rows — bar scaled to total */}
          {data.rows.map(r => (
            <VolumeRow
              key={r.ex}
              name={VOL_EX_NAME[r.ex] || r.ex}
              value={r.v}
              total={data.total}
              color={VOL_COLOR[r.ex] || M.violet}
            />
          ))}
        </div>
      )}
    </React.Fragment>
  );
}

/* ========================================================================
   SCREEN — 预测市场 (Polymarket-style markets)
   ======================================================================== */
/* ========================================================================
   SCREEN — 预测市场 (Polymarket-style markets)
   Aligned to PC /zh/prediction-market — 2-col dense grid, no categories,
   no hero, no 下注 button.  Card = icon + question + 是/否 % + LIVE + Vol.
   ======================================================================== */
/* small color palette for the per-card icon backgrounds (cycles by hash) */
const PRED_ICON_PALETTE = [
  '#7C5CFF', '#F59E0B', '#3B82F6', '#A78BFA', '#22D3EE',
  '#EC4899', '#F97316', '#10B981', '#6366F1', '#E5484D',
];

/* icon SVG strings — picked by topic */
const PRED_ICON_SVG = {
  rocket: 'M5 13l3 3-1 4 4-1 3 3 7-7-4-4-2-7-7-2 4-4 2 4 4 2-5 4z M14 10l3 3',
  coin:   'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM9 8h4a2 2 0 0 1 0 4H9zM9 12h5a2 2 0 0 1 0 4H9zM12 6v2M12 16v2',
  shield: 'M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z',
  bank:   'M3 10h18M5 10v8M19 10v8M9 10v8M15 10v8M3 18h18M3 10l9-6 9 6',
  globe:  'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  chip:   'M9 3h6v3h-6zM3 9v6h3v-6zM18 9v6h3v-6zM9 18h6v3h-6zM6 6h12v12h-12z',
  dollar: 'M12 2v20M16 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H7',
};

const PRED_MARKETS = [
  { id:'p1',  ic:'rocket', col:'#7C5CFF', q:'XRP涨跌 - 12月19日，美东时间上午 11:35-11:40', yes:null, vol:0,    live:true },
  { id:'p2',  ic:'rocket', col:'#7C5CFF', q:'CZ 会在2026年3月31日至4月7日期间发布0-19条帖子吗？',  yes:67,  vol:393,  live:true },
  { id:'p3',  ic:'coin',   col:'#F59E0B', q:'CZ 会在2026年3月31日至4月7日期间发布180-199条帖子吗？', yes:0,   vol:330,  live:true },
  { id:'p4',  ic:'coin',   col:'#F59E0B', q:'CZ 会在2026年3月31日至4月7日期间发布160-179条帖子吗？', yes:0,   vol:332,  live:true },
  { id:'p5',  ic:'coin',   col:'#F59E0B', q:'CZ 会在2026年3月31日至4月7日期间发布100-119条帖子吗？', yes:5,   vol:327,  live:true },
  { id:'p6',  ic:'coin',   col:'#F59E0B', q:'CZ 会在2026年3月31日至4月7日期间发布200条以上帖子吗？',  yes:1,   vol:273,  live:true },
  { id:'p7',  ic:'rocket', col:'#7C5CFF', q:'CZ 会在2026年3月31日至4月7日期间发布20-39条帖子吗？',   yes:32,  vol:328,  live:true },
  { id:'p8',  ic:'chip',   col:'#A78BFA', q:'CZ 会在2026年3月31日至4月7日期间发布140-159条帖子吗？', yes:0,   vol:258,  live:true },
  { id:'p9',  ic:'coin',   col:'#F59E0B', q:'CZ 会在2026年3月31日至4月7日期间发布120-139条帖子吗？', yes:5,   vol:326,  live:true },
  { id:'p10', ic:'rocket', col:'#7C5CFF', q:'CZ 会在2026年3月31日至4月7日期间发布40-59条帖子吗？',   yes:4,   vol:269,  live:true },
  { id:'p11', ic:'shield', col:'#22D3EE', q:'CZ 会在2026年3月31日至4月7日期间发布80-99条帖子吗？',   yes:3,   vol:327,  live:true },
  { id:'p12', ic:'chip',   col:'#A78BFA', q:'CZ 会在2026年3月31日至4月7日期间发布60-79条帖子吗？',   yes:4,   vol:327,  live:true },
  { id:'p13', ic:'shield', col:'#22D3EE', q:'XRP的价格在4月3日会超过1.70美元吗？', yes:2,  vol:0,    live:true },
  { id:'p14', ic:'bank',   col:'#3B82F6', q:'XRP的价格在4月3日会超过1.50美元吗？', yes:3,  vol:50,   live:true },
  { id:'p15', ic:'bank',   col:'#3B82F6', q:'比特币价格在4月3日会超过72,000美元吗？', yes:8,  vol:1519, live:true },
  { id:'p16', ic:'rocket', col:'#7C5CFF', q:'XRP的价格在4月3日会在1.50美元到1.60美元之间吗？', yes:3,  vol:30,   live:true },
  { id:'p17', ic:'globe',  col:'#3B82F6', q:'XRP的价格在4月3日会超过1.10美元吗？', yes:99, vol:565,  live:true },
  { id:'p18', ic:'shield', col:'#22D3EE', q:'XRP的价格在4月3日会在1.70美元至1.80美元之间吗？',  yes:2,  vol:0,    live:true },
  { id:'p19', ic:'rocket', col:'#7C5CFF', q:'XRP的价格在4月3日会在1.30美元到1.40美元之间吗？',  yes:41, vol:133,  live:true },
  { id:'p20', ic:'coin',   col:'#F59E0B', q:'Solana的价格在4月3日会介于120美元到130美元之间吗？', yes:2,  vol:0,    live:true },
  { id:'p21', ic:'shield', col:'#22D3EE', q:'Solana价格在4月3日会在70美元至80美元之间吗？', yes:32, vol:88,   live:true },
  { id:'p22', ic:'bank',   col:'#3B82F6', q:'Solana的价格在4月3日会高于110美元吗？',   yes:1,  vol:3898, live:true },
  { id:'p23', ic:'globe',  col:'#3B82F6', q:'XRP的价格在4月3日会高于0.90美元吗？',     yes:98, vol:0,    live:true },
  { id:'p24', ic:'globe',  col:'#3B82F6', q:'Solana的价格在4月3日会高于120美元吗？',   yes:1,  vol:1477, live:true },
  { id:'p25', ic:'coin',   col:'#F59E0B', q:'Solana价格在4月3日会在50美元至60美元之间吗？', yes:2,  vol:50,   live:true },
  { id:'p26', ic:'rocket', col:'#7C5CFF', q:'XRP的价格在4月3日会超过1.40美元吗？', yes:20, vol:87,   live:true },
  { id:'p27', ic:'bank',   col:'#3B82F6', q:'Solana的价格在4月3日会介于100美元到110美元之间吗？', yes:2,  vol:67,   live:true },
  { id:'p28', ic:'coin',   col:'#F59E0B', q:'Solana的价格在4月3日会超过40美元吗？', yes:100, vol:525, live:true },
];

function fmtPredVol(v) {
  if (v == null || v === 0) return null;
  if (v >= 1000) return '$' + (v/1000).toFixed(2).replace(/\.?0+$/, '') + 'K Vol.';
  return '$' + v + ' Vol.';
}

function PredCard({ m, onClick }) {
  const yes = m.yes;
  const no  = yes == null ? null : Math.max(0, 100 - yes);
  return (
    <div onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e)=>{ if (e.key==='Enter') onClick && onClick(); }}
      style={{
      padding:'10px 12px 8px', borderRadius:10,
      background:M.elev, border:`1px solid ${M.borderSoft}`,
      display:'flex', flexDirection:'column', gap:8,
      minHeight:128, cursor:'pointer',
    }}>
      {/* head: icon + ⓘ */}
      <div style={{display:'flex', alignItems:'flex-start', gap:6}}>
        <span style={{
          width:22, height:22, borderRadius:6,
          background:m.col, color:'#fff', flexShrink:0,
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={PRED_ICON_SVG[m.ic] || PRED_ICON_SVG.coin}/>
          </svg>
        </span>
        <div style={{
          flex:1, minWidth:0,
          fontSize:11.5, color:M.text, lineHeight:1.4, fontWeight:500,
          display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical',
          overflow:'hidden',
        }}>{m.q}</div>
        <button aria-label="信息" onClick={(e)=>e.stopPropagation()} style={{
          width:14, height:14, padding:0, border:0, background:'transparent',
          color:M.faint, cursor:'pointer', flexShrink:0,
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 8v5M12 16v.5"/>
          </svg>
        </button>
      </div>

      {/* 是/否 rows */}
      {yes != null && (
        <div style={{display:'flex', flexDirection:'column', gap:2}}>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:M.mono}}>
            <span style={{color:M.mid}}>是</span>
            <span style={{color:M.up, fontWeight:600}}>{yes}%</span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:M.mono}}>
            <span style={{color:M.mid}}>否</span>
            <span style={{color:M.dn, fontWeight:600}}>{no < 1 && no > 0 ? '<1%' : no + '%'}</span>
          </div>
        </div>
      )}

      <div style={{flex:1}}/>

      {/* footer: LIVE + Vol + ... */}
      <div style={{
        display:'flex', alignItems:'center', gap:6,
        fontSize:10, fontFamily:M.mono, color:M.dim,
      }}>
        {m.live && (
          <span style={{display:'inline-flex', alignItems:'center', gap:3, color:M.dn}}>
            <span style={{
              width:6, height:6, borderRadius:3, background:M.dn,
              animation:'mw-pulse 1.6s ease-out infinite',
            }}/>
            LIVE
          </span>
        )}
        <span style={{flex:1, color:M.dim, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
          {fmtPredVol(m.vol) || '$0 Vol.'}
        </span>
        <button aria-label="更多" onClick={(e)=>e.stopPropagation()} style={{
          width:18, height:14, padding:0, border:0, background:'transparent',
          color:M.faint, cursor:'pointer', flexShrink:0,
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="6" cy="12" r="1.6"/>
            <circle cx="12" cy="12" r="1.6"/>
            <circle cx="18" cy="12" r="1.6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function ScreenPredMarket() {
  const [openMarket, setOpenMarket] = React.useState(null);
  const [searching, setSearching] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const shown = filter
    ? PRED_MARKETS.filter(m => m.q.toLowerCase().includes(filter.toLowerCase()))
    : PRED_MARKETS;
  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus/>
      <DataHubHeader current="predict"/>

      <div style={{flex:1, overflow:'auto', paddingBottom:100}}>
        {/* subtitle */}
        <div style={{padding:'10px 16px 4px', background:M.elev}}>
          <div style={{fontSize:11, color:M.dim}}>基于链上数据的未来趋势预测</div>
        </div>

        {/* tappable search bar */}
        <div style={{padding:'10px 16px 4px', background:M.elev, borderBottom:`1px solid ${M.borderSoft}`}}>
          <button onClick={()=>setSearching(true)} style={{
            width:'100%', height:38, background:M.soft, borderRadius:999, border:0, cursor:'pointer',
            padding:'0 14px', display:'flex', alignItems:'center', gap:8, fontFamily:M.sans,
          }}>
            <Ico d={ICONS.search} w={16} sw={1.8}/>
            {filter ? (
              <React.Fragment>
                <span style={{flex:1, textAlign:'left', fontSize:13, color:M.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{filter}</span>
                <span onClick={(e)=>{e.stopPropagation(); setFilter('');}} style={{
                  background:M.border, color:M.bg, width:16, height:16, borderRadius:8,
                  fontSize:11, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center',
                }}>×</span>
              </React.Fragment>
            ) : (
              <span style={{flex:1, textAlign:'left', fontSize:13, color:M.faint}}>搜索预测市场</span>
            )}
          </button>
        </div>

        {/* 2-col dense grid */}
        <div style={{
          padding:'12px 12px 16px',
          display:'grid',
          gridTemplateColumns:'1fr 1fr',
          gap:8,
        }}>
          {shown.map(m => (
            <PredCard key={m.id} m={m} onClick={()=>setOpenMarket(m)}/>
          ))}
          {!shown.length && (
            <div style={{gridColumn:'1 / -1', padding:'48px 0', textAlign:'center', color:M.dim, fontSize:13}}>
              无匹配市场
            </div>
          )}
        </div>
      </div>

      <SearchOverlay
        open={searching}
        onClose={()=>setSearching(false)}
        placeholder="搜索预测市场"
        hotLabel="热门话题"
        hot={['BTC','XRP','SOL','ETH','CZ','美联储']}
        onPick={(kw)=>setFilter(kw)}
        renderResults={(query) =>
          PRED_MARKETS
            .filter(m => m.q.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 20)
            .map(m => (
              <div key={m.id} onClick={()=>{ setSearching(false); setOpenMarket(m); }} style={{
                display:'flex', alignItems:'center', gap:10, padding:'12px 4px',
                borderBottom:`1px solid ${M.borderSoft}`, cursor:'pointer',
              }}>
                <span style={{
                  width:30, height:30, borderRadius:8, background:m.col, color:'#fff', flexShrink:0,
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={PRED_ICON_SVG[m.ic] || PRED_ICON_SVG.coin}/>
                  </svg>
                </span>
                <div style={{flex:1, minWidth:0, fontSize:13, color:M.text, lineHeight:1.4}}>{m.q}</div>
              </div>
            ))
        }
        emptyText="无匹配市场"
      />

      <PredMarketDetailSheet market={openMarket} onClose={()=>setOpenMarket(null)}/>

      <MTabBar active="market"/>
    </div>
  );
}

/* ============= 预测市场详情 — bottom sheet ============= */
function PredMarketDetailSheet({ market, onClose }) {
  if (!market) return null;
  const status = market.live ? 'OPEN' : 'CLOSED';
  // derived placeholders — match PC pattern when not provided
  const slug = (market.q || '').match(/[A-Za-z]+/)?.[0]?.toLowerCase() || 'market';
  const resolution = market.resolution || `https://data.chain.link/streams/${slug}-usd`;
  const winStart   = market.winStart   || '2025-12-19 00:49';
  const winEnd     = market.winEnd     || '2025-12-20 00:40';
  const created    = market.created    || '2026-03-20 16:03';
  const volText    = fmtPredVol(market.vol) || '$0';

  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, zIndex:75,
      background:'rgba(15,11,34,0.55)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div onClick={(e)=>e.stopPropagation()} style={{
        width:'100%', maxHeight:'88%', background:M.bg,
        borderRadius:'18px 18px 0 0',
        display:'flex', flexDirection:'column',
        boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
        animation:'wd-slide-up .22s ease-out',
        overflow:'hidden',
      }}>
        {/* head */}
        <div style={{
          padding:'16px 16px 12px',
          display:'flex', alignItems:'center',
          borderBottom:`1px solid ${M.borderSoft}`,
        }}>
          <span style={{fontSize:15, fontWeight:700, color:M.text}}>市场详情</span>
          <div style={{flex:1}}/>
          <button onClick={onClose} aria-label="关闭" style={{
            width:30, height:30, padding:0, borderRadius:8, border:0,
            background:'transparent', cursor:'pointer', color:M.mid,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>

        {/* body */}
        <div style={{padding:'16px 16px 12px', overflow:'auto', height:300}}>
          {/* icon + question + status */}
          <div style={{display:'flex', alignItems:'flex-start', gap:10, marginBottom:14}}>
            <span style={{
              width:36, height:36, borderRadius:8,
              background:market.col, color:'#fff', flexShrink:0,
              display:'inline-flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={PRED_ICON_SVG[market.ic] || PRED_ICON_SVG.coin}/>
              </svg>
            </span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13.5, color:M.text, lineHeight:1.45, fontWeight:600, marginBottom:6}}>
                {market.q}
              </div>
              <div style={{
                display:'flex', alignItems:'center', gap:10,
                fontSize:11, fontFamily:M.mono, color:M.dim,
              }}>
                <span>交易量: <span style={{color:M.text, fontWeight:600}}>{volText}</span></span>
                <span style={{display:'inline-flex', alignItems:'center', gap:4, color:M.dn}}>
                  <span style={{
                    width:6, height:6, borderRadius:3, background:M.dn,
                    animation:'mw-pulse 1.6s ease-out infinite',
                  }}/>
                  {status}
                </span>
              </div>
            </div>
          </div>

          {/* divider */}
          <div style={{height:1, background:M.borderSoft, margin:'4px 0 14px'}}/>

          {/* 规则 */}
          <div style={{fontSize:13, fontWeight:700, color:M.text, marginBottom:10}}>规则</div>
          <div style={{display:'flex', flexDirection:'column', gap:10, marginBottom:14}}>
            <div style={{display:'flex', flexDirection:'column', gap:3}}>
              <div style={{fontSize:11, color:M.dim}}>Resolution source</div>
              <div style={{
                fontSize:11.5, color:M.text, fontFamily:M.mono,
                wordBreak:'break-all', lineHeight:1.5,
              }}>{resolution}</div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:3}}>
              <div style={{fontSize:11, color:M.dim}}>Event window</div>
              <div style={{
                fontSize:11.5, color:M.text, fontFamily:M.mono, lineHeight:1.5,
              }}>{winStart} ~ {winEnd}</div>
            </div>
          </div>

          {/* divider */}
          <div style={{height:1, background:M.borderSoft, marginBottom:12}}/>

          {/* 创建时间 */}
          <div style={{
            display:'flex', alignItems:'baseline', gap:6,
            fontSize:11, fontFamily:M.mono, color:M.dim,
          }}>
            <span>创建时间:</span>
            <span style={{color:M.text}}>{created}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================
   SCREEN — 币股 (Crypto-related stocks)
   ======================================================================== */
const COIN_COLORS = {
  BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', DOGE: '#C2A633',
  TC:  '#7C5CFF', OTHER: '#9B9BAB',
};

const CSTOCK_TABS = [
  { k:'all',    label:'全部' },
  { k:'btc',    label:'BTC' },
  { k:'eth',    label:'ETH' },
  { k:'other',  label:'其他' },
];

/* Mirrors the PC data: 币种 / 公司 / MNAV / 市值 / 持币价值 / 持币量 / 股价 / 24h */
const CSTOCK_ROWS = [
  { coin:'BTC',  sym:'NXSN', cn:'Nexon',           ex:'3659 美股-TSE',  mnav:'128.082',     mcap:'2,370.17 B', holdV:'114.00 M', holdQ:'1.72 K',  hold:'BTC', px:'2,968.50', ch:'+1.68%', up:true,
    biz:'日本游戏发行商', hq:'东京', listed:'2011',
    intro:'《地下城与勇士》《冒险岛》系列发行商。2021 年起增持 1,717 BTC,是日本上市公司中较早将比特币纳入资产负债表的案例。' },
  { coin:'DOGE', sym:'TSLA', cn:'Tesla, Inc.',     ex:'TSLA 美股-NASDAQ', mnav:'1,523.42',  mcap:'1,174.95 B', holdV:'772.49 M', holdQ:'11.51 K', hold:'BTC', px:'364.89',   ch:'+0.87%', up:true,
    biz:'电动车 / 能源', hq:'Austin', listed:'2010',
    intro:'2021 年披露 15 亿美元 BTC 持仓,后续部分变现;同期短暂接受 DOGE 支付周边商品。马斯克对加密叙事仍有放大效应。' },
  { coin:'BTC',  sym:'MTPL', cn:'Metaplanet Inc.', ex:'3350.T 美股-TSE',  mnav:'221.169',   mcap:'198.85 B',   holdV:'899.08 M', holdQ:'13.35 K', hold:'BTC', px:'296.00',   ch:'-0.67%', up:false,
    biz:'酒店 → 比特币储备', hq:'东京', listed:'2004',
    intro:'被称为「日版 MicroStrategy」。2024 年起将比特币确立为核心储备资产,持续通过股权融资增持 BTC。' },
  { coin:'BTC',  sym:'BLK',  cn:'BlackRock, Inc.', ex:'BLK 美股-NYSE',    mnav:'364,337.7', mcap:'146.41 B',   holdV:'402.72 K', holdQ:'6 B',     hold:'TC',  px:'945.78',   ch:'+1.30%', up:true,
    biz:'全球最大资管', hq:'New York', listed:'1999',
    intro:'IBIT 现货比特币 ETF 发行方,管理 AUM 超 $24B,是机构资金入场比特币的主要通道之一。' },
  { coin:'BTC',  sym:'MELI', cn:'MercadoLibre',    ex:'MELI 美股-NASDAQ', mnav:'2,199.84',  mcap:'85.25 B',    holdV:'38.00 M',  holdQ:'570 B',   hold:'TC',  px:'1,681.44', ch:'+5.12%', up:true,
    biz:'拉美电商 + 金融', hq:'Buenos Aires', listed:'2007',
    intro:'拉美最大电商,Mercado Pago 钱包内支持 BTC/ETH/USDC 买卖与转账,实际把加密带给了上亿用户。' },
  { coin:'BTC',  sym:'WULF', cn:'TeraWulf',        ex:'WULF 美股-NASDAQ', mnav:'5,835.97',  mcap:'53.31 B',    holdV:'1.00 M',   holdQ:'15 B',    hold:'TC',  px:'13.68',    ch:'-8.12%', up:false,
    biz:'零碳 BTC 矿企', hq:'Easton, MD', listed:'2021',
    intro:'通过水电、核能等零碳能源运营比特币矿场,近期向 AI/HPC 数据中心业务扩张。' },
  { coin:'ETH',  sym:'HOOD', cn:'Robinhood Markets', ex:'HOOD 美股-NASDAQ', mnav:'5.4622',  mcap:'51.51 B',    holdV:'9.44 B',   holdQ:'140.57 K',hold:'BTC', px:'66.55',    ch:'+0.80%', up:true,
    biz:'零佣金券商 + 加密', hq:'Menlo Park', listed:'2021',
    intro:'美国主要零佣金券商。加密业务收入占比逐季提升,2024 年收购欧洲交易所 Bitstamp 后扩展机构服务。' },
  { coin:'BTC',  sym:'BLSH', cn:'Bullish',         ex:'BLSH 美股-NYSE',   mnav:'2.701',     mcap:'50.77 B',    holdV:'1.62 B',   holdQ:'24.30 K', hold:'BTC', px:'34.73',    ch:'+0.94%', up:true,
    biz:'机构级加密交易所', hq:'Cayman Islands', listed:'2024',
    intro:'前 Block.one 创始人 Brendan Blumer 主导;2024 年 De-SPAC 上市,主打机构现货 + 衍生品撮合。' },
  { coin:'BTC',  sym:'CIFR', cn:'Cipher Mining',   ex:'CIFR 美股-NASDAQ', mnav:'46.071',    mcap:'44.58 B',    holdV:'101.00 M', holdQ:'1.50 K',  hold:'BTC', px:'12.01',    ch:'-12.62%', up:false,
    biz:'BTC 算力 + 数据中心', hq:'New York', listed:'2021',
    intro:'美国本土上市矿企,得州运营多座大型矿场;近期亦推进 AI 算力代工业务。' },
  { coin:'BTC',  sym:'MSTR', cn:'Strategy',        ex:'MSTR 美股-NASDAQ', mnav:'1.842',     mcap:'42.18 B',    holdV:'39.66 B',  holdQ:'580.25 K',hold:'BTC', px:'412.80',   ch:'+3.42%', up:true,
    biz:'BI 软件 → BTC 财库', hq:'Tysons Corner', listed:'1998',
    intro:'前身 MicroStrategy。Michael Saylor 主导,2020 年起持续融资买 BTC,目前是上市公司中最大的比特币持有者。' },
  { coin:'BTC',  sym:'COIN', cn:'Coinbase',        ex:'COIN 美股-NASDAQ', mnav:'12.84',     mcap:'72.84 B',    holdV:'5.67 B',   holdQ:'82.91 K', hold:'BTC', px:'286.40',   ch:'+2.74%', up:true,
    biz:'美国最大加密交易所', hq:'Remote-first', listed:'2021',
    intro:'美国合规加密交易所龙头,IBIT/FBTC 等多支现货 BTC ETF 的托管方,机构托管 AUM 持续增长。' },
  { coin:'BTC',  sym:'MARA', cn:'Marathon Digital', ex:'MARA 美股-NASDAQ', mnav:'8.62',     mcap:'8.42 B',     holdV:'1.96 B',   holdQ:'28.62 K', hold:'BTC', px:'24.18',    ch:'+6.20%', up:true,
    biz:'北美大型 BTC 矿企', hq:'Fort Lauderdale', listed:'2010',
    intro:'北美装机量最大的 BTC 矿企之一,算力 50 EH/s。同时持有大量 BTC 在自有金库。' },
];

const CSTOCK_SORTS = [
  { k:'mcap',  label:'市值',     get:r => parseNum(r.mcap),  default:'desc' },
  { k:'holdV', label:'持币价值', get:r => parseNum(r.holdV), default:'desc' },
  { k:'holdQ', label:'持币量',   get:r => parseNum(r.holdQ), default:'desc' },
  { k:'px',    label:'股价',     get:r => parseNum(r.px),    default:'desc' },
  { k:'mnav',  label:'MNAV',     get:r => parseNum(r.mnav),  default:'desc' },
  { k:'ch',    label:'24h 涨跌', get:r => parseFloat(r.ch),  default:'desc' },
];

function parseNum(s) {
  if (typeof s !== 'string') return 0;
  const m = s.trim().replace(/,/g,'').match(/^(-?\d+\.?\d*)\s*([BMK]?)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2] || '').toUpperCase();
  return n * (u === 'B' ? 1e9 : u === 'M' ? 1e6 : u === 'K' ? 1e3 : 1);
}

function ScreenCoinStocks() {
  const [tab, setTab] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [sortK, setSortK] = React.useState('mcap');
  const [sortDir, setSortDir] = React.useState('desc'); // 'desc' | 'asc' | null
  const [sortOpen, setSortOpen] = React.useState(false);
  const [info, setInfo] = React.useState(null); // currently-shown company row
  const searchInputRef = React.useRef(null);

  React.useEffect(() => {
    if (searching && searchInputRef.current) searchInputRef.current.focus();
  }, [searching]);

  function openSearch() { setSearching(true); setQ(''); }
  function closeSearch() { setSearching(false); setQ(''); }

  const sortDef = CSTOCK_SORTS.find(s => s.k === sortK) || CSTOCK_SORTS[0];

  const rows = (() => {
    const filtered = CSTOCK_ROWS
      .filter(r => {
        if (tab === 'btc') return r.coin === 'BTC';
        if (tab === 'eth') return r.coin === 'ETH';
        if (tab === 'other') return !['BTC','ETH'].includes(r.coin);
        return true;
      })
      .filter(r => !q || (r.sym + r.cn + r.ex).toLowerCase().includes(q.toLowerCase()));
    if (!sortDir) return filtered; // unsorted — original order
    return filtered.slice().sort((a,b) => {
      const va = sortDef.get(a), vb = sortDef.get(b);
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  })();

  // Cycle the currently-active field: desc → asc → null → desc …
  // Tapping a different field starts at its default direction (desc).
  const pickSort = (k) => {
    if (k === sortK) {
      setSortDir(d => d === 'desc' ? 'asc' : d === 'asc' ? null : 'desc');
    } else {
      setSortK(k);
      const def = CSTOCK_SORTS.find(s => s.k === k);
      setSortDir(def ? def.default : 'desc');
    }
  };

  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus/>
      <DataHubHeader current="cstock"/>

      <div style={{flex:1, overflow:'auto', paddingBottom:100}}>
        {/* coin-type tabs + sort */}
        {(
          /* ── tabs + sort ── */
          <div style={{
            padding:'12px 16px 8px',
            display:'flex', alignItems:'center', gap:6,
          }}>
          <div style={{position:'relative', flex:1, minWidth:0}}>
            <div className="cstock-tabs" style={{
              display:'flex', gap:2, overflowX:'auto', minWidth:0, alignItems:'center',
              scrollbarWidth:'none', WebkitOverflowScrolling:'touch', msOverflowStyle:'none',
              whiteSpace:'nowrap', paddingRight:36,
            }}>
              {CSTOCK_TABS.map(t => {
                const on = tab === t.k;
                return (
                  <button key={t.k} onClick={()=>setTab(t.k)} style={{
                    height:30, padding:'0 14px', borderRadius:8, cursor:'pointer',
                    border: on ? `1px solid ${M.violet}` : '1px solid transparent',
                    background: on ? M.violetSoft : 'transparent',
                    color: on ? M.violet : M.mid,
                    fontSize:12, fontWeight: on ? 700 : 500, whiteSpace:'nowrap', fontFamily:'inherit',
                    flexShrink:0,
                  }}>{t.label}</button>
                );
              })}
              <style>{`.cstock-tabs::-webkit-scrollbar{display:none}`}</style>
            </div>
            {/* fade + search icon pinned right */}
            <div style={{
              position:'absolute', right:0, top:0, bottom:0,
              display:'flex', alignItems:'center', paddingRight:0,
              background:`linear-gradient(to right, transparent, ${M.bg} 40%)`,
              pointerEvents:'none',
            }}>
              <button aria-label="搜索公司" onClick={openSearch} style={{
                width:32, height:32, padding:0, borderRadius:8,
                border:0, background:'transparent', color:M.mid, cursor:'pointer',
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                pointerEvents:'all', flexShrink:0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm5.5 12.5L21 21"/>
                </svg>
              </button>
            </div>
          </div>
          <div style={{position:'relative', flexShrink:0}}>
            <button onClick={()=>setSortOpen(v=>!v)} style={{
              height:30, padding:'0 10px', borderRadius:8, border:`1px solid ${M.border}`,
              background: sortOpen ? M.soft : M.elev, color:M.text, cursor:'pointer',
              display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontFamily:'inherit',
              whiteSpace:'nowrap',
            }}>
              <span style={{color:M.dim}}>按</span>
              <span style={{fontWeight:600}}>{sortDef.label}</span>
              <span style={{
                color: sortDir ? M.violet : M.dim,
                fontFamily:M.mono, fontSize:12, fontWeight:700,
              }}>
                {sortDir === 'desc' ? '↓' : sortDir === 'asc' ? '↑' : '↕'}
              </span>
            </button>
          </div>
          </div>
        )}

        {/* list */}
        <div style={{padding:'4px 16px 0', display:'flex', flexDirection:'column', gap:8}}>
          {rows.map((r,i) => <CStockCard key={i} r={r} onClick={()=>setInfo(r)}/>)}
          {!rows.length && (
            <div style={{padding:'48px 0', textAlign:'center', color:M.dim, fontSize:13}}>
              暂无匹配公司
            </div>
          )}
        </div>
      </div>

      {info && <CompanyInfoSheet r={info} onClose={()=>setInfo(null)}/>}

      <SearchOverlay
        open={searching}
        onClose={closeSearch}
        placeholder="搜索公司 / 股票代码"
        hotLabel="热门标的"
        hot={CSTOCK_ROWS.slice(0, 8).map(r => r.sym)}
        onPick={(sym)=>setQ(sym)}
        renderResults={(query, pick) =>
          CSTOCK_ROWS
            .filter(r => (r.sym + r.cn + r.ex).toLowerCase().includes(query.toLowerCase()))
            .map(r => (
              <SearchResultRow key={r.sym} letter={r.sym.slice(0,1)} color={COIN_COLORS[r.coin] || M.violet}
                title={r.sym} sub={r.cn} right={r.px} onClick={()=>pick(r.sym)}/>
            ))
        }
        emptyText="无匹配公司"
      />

      {/* ─── 筛选 & 排序 — bottom sheet ─── */}
      {sortOpen && (
        <div
          onClick={()=>setSortOpen(false)}
          style={{
            position:'absolute', inset:0, zIndex:85,
            background:'rgba(15,11,34,0.55)',
            animation:'m-fade-in .18s ease-out',
          }}>
          <div
            onClick={(e)=>e.stopPropagation()}
            style={{
              position:'absolute', left:0, right:0, bottom:0,
              background:M.elev, borderRadius:'20px 20px 0 0',
              boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
              padding:'0 20px calc(28px + env(safe-area-inset-bottom))',
              animation:'m-slide-up .26s cubic-bezier(.2,.8,.2,1)',
            }}>
            <div style={{width:42, height:4, borderRadius:2, background:M.border, margin:'10px auto 14px'}}/>
            <div style={{fontSize:14, fontWeight:700, marginBottom:12, color:M.text}}>筛选 & 排序</div>

            {/* 排序指标 — pills (which field to sort by) */}
            <div style={{fontSize:11, color:M.mid, marginBottom:6}}>指标</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:16}}>
              {CSTOCK_SORTS.map(s => {
                const on = s.k === sortK;
                return (
                  <button key={s.k} onClick={()=>{
                    setSortK(s.k);
                    setSortDir(d => d == null ? 'desc' : d);
                  }} style={{
                    height:30, padding:'0 14px', borderRadius:999, fontSize:12,
                    fontWeight: on ? 600 : 500,
                    background: on ? M.violet : M.soft, color: on ? '#fff' : M.text,
                    border:0, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
                  }}>{s.label}</button>
                );
              })}
            </div>

            {/* 排序方式 — direction */}
            <div style={{fontSize:11, color:M.mid, marginBottom:6}}>排序方式</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6}}>
              {[
                {k:'asc',  label:'升序', arrow:'↑'},
                {k:'desc', label:'降序', arrow:'↓'},
                {k:null,   label:'不排序', arrow:''},
              ].map(d => {
                const on = sortDir === d.k;
                return (
                  <button
                    key={String(d.k)}
                    onClick={()=>setSortDir(d.k)}
                    style={{
                      height:40, borderRadius:10, padding:'0 8px',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                      fontSize:12.5, fontWeight: on ? 600 : 500, fontFamily:'inherit',
                      whiteSpace:'nowrap',
                      background: on ? M.violetSoft : M.soft,
                      color: on ? M.violet : M.text,
                      border: on ? `1px solid ${M.violet}` : '1px solid transparent',
                      cursor:'pointer',
                    }}>
                    <span>{d.label}</span>
                    {d.arrow && <span style={{fontFamily:M.mono, fontSize:13, fontWeight:700}}>{d.arrow}</span>}
                  </button>
                );
              })}
            </div>

            <button
              onClick={()=>setSortOpen(false)}
              style={{
                width:'100%', height:46, marginTop:16, borderRadius:12, border:0,
                background:M.violetGrad, color:'#fff', fontSize:14, fontWeight:600,
                boxShadow:'0 6px 20px rgba(124,92,255,0.32)', cursor:'pointer',
                fontFamily:'inherit',
              }}>查看 {rows.length} 个结果</button>
          </div>
        </div>
      )}

      <MTabBar active="market"/>
    </div>
  );
}

function CStockCard({ r, onClick }) {
  const c = COIN_COLORS[r.coin] || COIN_COLORS.OTHER;
  const hc = COIN_COLORS[r.hold] || COIN_COLORS.OTHER;
  return (
    <div
      onClick={onClick}
      style={{
        padding:'12px 12px 10px', borderRadius:12, background:M.elev,
        border:`1px solid ${M.border}`, cursor:'pointer',
      }}
    >
      {/* top row: coin · ticker / name · change badge */}
      <div style={{display:'flex', alignItems:'center', gap:10}}>
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:3, flexShrink:0}}>
          <Av sym={r.coin === 'OTHER' ? '?' : r.coin.slice(0,1)} bg={c} size={30}/>
          <span style={{fontSize:9.5, fontWeight:700, color:c, fontFamily:M.mono, letterSpacing:'0.02em'}}>{r.coin}</span>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{
            display:'flex', alignItems:'baseline', gap:6, minWidth:0,
            overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
          }}>
            <span style={{fontSize:14, fontWeight:700, color:M.text, fontFamily:M.mono}}>{r.sym}</span>
            <span style={{fontSize:12, color:M.text, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.cn}</span>
          </div>
          <div style={{fontSize:10.5, color:M.dim, marginTop:2, fontFamily:M.mono,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {r.ex}
          </div>
        </div>
        <div style={{textAlign:'right', flexShrink:0}}>
          <div style={{fontFamily:M.mono, fontSize:15, fontWeight:600, color:M.text, whiteSpace:'nowrap'}}>${r.px}</div>
          <span style={{
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            height:22, padding:'0 8px', marginTop:3, borderRadius:5,
            background: r.up ? M.up : M.dn, color:'#fff',
            fontFamily:M.mono, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
          }}>{r.ch}</span>
        </div>
      </div>

      {/* stats grid */}
      <div style={{
        marginTop:10, padding:'10px 0 0', borderTop:`1px dashed ${M.borderSoft}`,
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6,
      }}>
        <CSStat label="MNAV"     value={r.mnav}/>
        <CSStat label="市值"     value={r.mcap} suffix="USD"/>
        <CSStat label="持币价值"  value={r.holdV} suffix="USD"/>
        <CSStat label={`持币量 · ${r.hold}`} value={r.holdQ} suffix={r.hold} tone={hc}/>
      </div>
    </div>
  );
}

function CSStat({ label, value, suffix, tone }) {
  return (
    <div style={{minWidth:0}}>
      <div style={{
        fontSize:10, color:M.dim, marginBottom:2,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>{label}</div>
      <div style={{
        fontSize:12, fontWeight:600, color: tone || M.text, fontFamily:M.mono,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>{value}</div>
      {suffix && (
        <div style={{fontSize:9, color:M.dim, fontFamily:M.mono, marginTop:1, letterSpacing:0.3}}>{suffix}</div>
      )}
    </div>
  );
}

function CompanyInfoSheet({ r, onClose }) {
  const c = COIN_COLORS[r.coin] || COIN_COLORS.OTHER;
  const hc = COIN_COLORS[r.hold] || COIN_COLORS.OTHER;
  return (
    <div
      onClick={onClose}
      style={{
        position:'absolute', inset:0, zIndex:90,
        background:'rgba(8,10,20,0.55)', backdropFilter:'blur(2px)',
        display:'flex', alignItems:'flex-end',
      }}
    >
      <div
        onClick={(e)=>e.stopPropagation()}
        style={{
          width:'100%', background:M.bg, borderRadius:'18px 18px 0 0',
          boxShadow:'0 -12px 40px -10px rgba(0,0,0,0.28)',
          maxHeight:'82%', overflowY:'auto', paddingBottom:24,
        }}
      >
        {/* drag handle */}
        <div style={{padding:'10px 0 4px', display:'flex', justifyContent:'center'}}>
          <span style={{width:38, height:4, borderRadius:2, background:M.borderSoft}}/>
        </div>

        {/* header */}
        <div style={{padding:'2px 18px 0', display:'flex', alignItems:'center', gap:12}}>
          <Av sym={r.coin === 'OTHER' ? '?' : r.coin.slice(0,1)} bg={c} size={42}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{
              display:'flex', alignItems:'baseline', gap:8, minWidth:0,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>
              <span style={{fontSize:18, fontWeight:700, color:M.text, fontFamily:M.mono}}>{r.sym}</span>
              <span style={{fontSize:13, color:M.text, fontWeight:500}}>{r.cn}</span>
            </div>
            <div style={{fontSize:11, color:M.dim, marginTop:2, fontFamily:M.mono}}>{r.ex}</div>
          </div>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:16, border:0, background:M.elev,
            color:M.mid, cursor:'pointer', padding:0,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Ico d={ICONS.close} w={16} sw={2}/>
          </button>
        </div>

        {/* price + chip */}
        <div style={{
          margin:'12px 18px 0', padding:'12px 14px', borderRadius:12,
          background: r.up ? 'rgba(22,163,107,0.08)' : 'rgba(229,72,77,0.08)',
          border:`1px solid ${r.up ? 'rgba(22,163,107,0.18)' : 'rgba(229,72,77,0.18)'}`,
          display:'flex', alignItems:'center', gap:12,
        }}>
          <div>
            <div style={{fontSize:11, color:M.dim, marginBottom:2}}>当前股价 · USD</div>
            <div style={{fontFamily:M.mono, fontSize:22, fontWeight:700, color:M.text, letterSpacing:-0.3}}>
              ${r.px}
            </div>
          </div>
          <div style={{flex:1}}/>
          <span style={{
            display:'inline-flex', alignItems:'center', height:28, padding:'0 10px',
            borderRadius:6, background: r.up ? M.up : M.dn, color:'#fff',
            fontFamily:M.mono, fontSize:13, fontWeight:600,
          }}>{r.ch}</span>
        </div>

        {/* intro paragraph */}
        <div style={{padding:'14px 18px 0'}}>
          <div style={{
            fontSize:11, color:M.dim, marginBottom:6, fontWeight:600, letterSpacing:0.4,
          }}>公司概况</div>
          <div style={{fontSize:13, color:M.text, lineHeight:1.7, textWrap:'pretty'}}>
            {r.intro}
          </div>
        </div>

        {/* meta tags */}
        <div style={{padding:'12px 18px 0', display:'flex', gap:6, flexWrap:'wrap'}}>
          {r.biz && <CIChip>{r.biz}</CIChip>}
          {r.hq && <CIChip>HQ · {r.hq}</CIChip>}
          {r.listed && <CIChip>上市 {r.listed}</CIChip>}
          <CIChip tone={c}>关联 · {r.coin}</CIChip>
        </div>

        {/* stats grid */}
        <div style={{padding:'14px 18px 6px'}}>
          <div style={{
            fontSize:11, color:M.dim, marginBottom:8, fontWeight:600, letterSpacing:0.4,
          }}>核心指标</div>
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:1,
            background:M.borderSoft, borderRadius:12, overflow:'hidden',
          }}>
            <CIRow label="市值"     value={r.mcap}  suffix="USD"/>
            <CIRow label="MNAV"     value={r.mnav}/>
            <CIRow label="持币价值"  value={r.holdV} suffix="USD"/>
            <CIRow label={`持币量 · ${r.hold}`} value={r.holdQ} suffix={r.hold} tone={hc}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function CIChip({ children, tone }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
      padding:'4px 10px', borderRadius:999, fontSize:11, fontWeight:500,
      background: tone ? `${tone}1F` : M.soft,
      color: tone || M.mid,
      border: tone ? `1px solid ${tone}33` : `1px solid ${M.borderSoft}`,
    }}>{children}</span>
  );
}

function CIRow({ label, value, suffix, tone }) {
  return (
    <div style={{
      background:M.elev, padding:'12px 12px', minWidth:0,
    }}>
      <div style={{
        fontSize:11, color:M.dim, marginBottom:4,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>{label}</div>
      <div style={{display:'flex', alignItems:'baseline', gap:5, minWidth:0, flexWrap:'nowrap'}}>
        <span style={{
          fontSize:14, fontWeight:700, color: tone || M.text, fontFamily:M.mono,
          whiteSpace:'nowrap',
        }}>{value}</span>
        {suffix && (
          <span style={{
            fontSize:10, color:M.dim, fontFamily:M.mono, letterSpacing:0.3,
            whiteSpace:'nowrap',
          }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

Object.assign(window, {
  DataHubHeader, DataHubTitle,
  ScreenAggOrders, ScreenPredMarket, ScreenCoinStocks,
  CompanyInfoSheet,
});

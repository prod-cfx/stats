/* Mobile screens part 3 — Trading detail, L/S Ratio, Whale Feed, Account, API Config */

/* ========================================================================
   SCREEN 6 — Trading Detail (BTC/USDT)
   ======================================================================== */
const ASKS = [
  {p:'68,432.10', q:'0.8214', t:'56.21K'},
  {p:'68,430.50', q:'1.2480', t:'85.41K'},
  {p:'68,428.20', q:'0.4862', t:'33.27K'},
  {p:'68,425.80', q:'2.1306', t:'145.8K'},
  {p:'68,422.40', q:'0.9012', t:'61.66K'},
];
const BIDS = [
  {p:'68,420.12', q:'1.4820', t:'101.4K'},
  {p:'68,418.50', q:'0.7240', t:'49.54K'},
  {p:'68,415.30', q:'2.8412', t:'194.4K'},
  {p:'68,412.80', q:'0.5408', t:'37.00K'},
  {p:'68,410.20', q:'1.9620', t:'134.2K'},
];
const TRADES = [
  {t:'14:02:18', p:'68,422.40', q:'0.0824', side:'buy'},
  {t:'14:02:17', p:'68,420.80', q:'0.4118', side:'buy'},
  {t:'14:02:15', p:'68,420.12', q:'0.1248', side:'sell'},
  {t:'14:02:14', p:'68,418.50', q:'1.8204', side:'sell'},
  {t:'14:02:12', p:'68,420.10', q:'0.0612', side:'buy'},
  {t:'14:02:11', p:'68,422.00', q:'0.2810', side:'buy'},
  {t:'14:02:09', p:'68,418.30', q:'0.0942', side:'sell'},
  {t:'14:02:07', p:'68,420.40', q:'0.6184', side:'buy'},
  {t:'14:02:05', p:'68,416.20', q:'0.3206', side:'sell'},
  {t:'14:02:03', p:'68,420.10', q:'0.1842', side:'buy'},
  {t:'14:01:59', p:'68,418.80', q:'0.4012', side:'sell'},
  {t:'14:01:57', p:'68,422.40', q:'0.0606', side:'buy'},
];

function ScreenTradingDetail() {
  const [panel, setPanel] = React.useState('book'); // 'book' | 'trades' | 'depth'
  return (
    <div style={{height:'100%', position:'relative', background:M.bg, overflow:'hidden', display:'flex', flexDirection:'column'}}>
      <MStatus/>
      <MTopBar
        onBack={()=>{}}
        backTo="market"
        title="BTC / USDT"
        sub="永续 · Binance"
        right={
          <div style={{display:'flex', gap:6}}>
            <button style={iconBtn}><Ico d={ICONS.star} w={18}/></button>
            <button style={iconBtn}><Ico d={ICONS.more} w={18} sw={2.5}/></button>
          </div>
        }
      />
      {/* scrollable region — sits beneath the fixed top bar, above the sticky buy/sell + tab bar */}
      <div style={{flex:1, minHeight:0, overflow:'auto', paddingBottom:158}}>
      <div style={{padding:'12px 16px 8px', background:M.elev}}>
        <div style={{display:'flex', alignItems:'baseline', gap:12, marginBottom:8}}>
          <span style={{fontSize:26, fontWeight:700, color:M.up, fontFamily:M.mono, letterSpacing:-0.5}}>68,420.12</span>
          <span style={{fontSize:13, color:M.up, fontFamily:M.mono, fontWeight:600}}>+1,572.40 (+2.34%)</span>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, fontSize:11}}>
          {[
            ['24H 高', '69,210.40'], ['24H 低', '66,820.10'],
            ['24H 量', '63.25K'],    ['持仓量', '89.36K BTC'],
          ].map(([l,v]) => (
            <div key={l}>
              <div style={{color:M.dim}}>{l}</div>
              <div style={{color:M.text, fontFamily:M.mono, fontWeight:500, marginTop:2}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:M.elev, borderTop:`1px solid ${M.borderSoft}`, padding:'8px 16px 0'}}>
        <div style={{display:'flex', gap:14, fontSize:12, fontWeight:500}}>
          {[['1m'],['15m'],['1H',true],['4H'],['1D'],['更多']].map(([t,on])=>(
            <span key={t} style={{
              padding:'6px 0', color: on ? M.text : M.mid,
              borderBottom: on ? `2px solid ${M.text}` : '2px solid transparent', fontWeight: on ? 700 : 500,
            }}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{background:M.elev, padding:'4px 0 6px'}}>
        <div style={{padding:'6px 16px', fontFamily:M.mono, fontSize:10, color:M.mid, display:'flex', gap:10}}>
          <span>O <span style={{color:M.text}}>67,892</span></span>
          <span>H <span style={{color:M.up}}>68,540</span></span>
          <span>L <span style={{color:M.dn}}>67,420</span></span>
          <span>C <span style={{color:M.up}}>68,420</span></span>
        </div>
        <Candles width={402} height={200}/>
      </div>

      {/* tab strip: 盘口 / 成交 / 深度图 */}
      <div style={{background:M.elev, borderTop:`6px solid ${M.bg}`, paddingBottom:24}}>
        <div style={{padding:'12px 16px 8px', display:'flex', gap:18, fontSize:13, fontWeight:500, borderBottom:`1px solid ${M.borderSoft}`}}>
          {[['book','盘口'], ['trades','成交'], ['depth','深度图']].map(([k,label]) => {
            const on = panel === k;
            return (
              <button key={k} onClick={() => setPanel(k)} style={{
                padding:'6px 0', color: on ? M.text : M.mid, fontWeight: on ? 700 : 500,
                background:'transparent', border:'0',
                borderBottom: on ? `2px solid ${M.text}` : '2px solid transparent',
                fontSize:13, cursor:'pointer',
              }}>{label}</button>
            );
          })}
          <div style={{flex:1}}/>
          {panel === 'book' && <span style={{color:M.dim, fontSize:11, alignSelf:'center'}}>0.1 ▾</span>}
        </div>

        {panel === 'book' && <OrderBookPanel/>}
        {panel === 'trades' && <TradesPanel/>}
        {panel === 'depth' && <DepthPanel/>}
      </div>
      </div>{/* /scrollable region */}

      {/* sticky buy/sell */}
      <div style={{
        position:'absolute', left:0, right:0, bottom:80, padding:'12px 16px',
        background: M.elev, backdropFilter:'blur(12px)',
        borderTop:`1px solid ${M.borderSoft}`, display:'flex', gap:10,
      }}>
        <button data-action="open-buy" style={{
          flex:1, height:46, borderRadius:12, border:0, background:M.up, color:'#fff',
          fontSize:15, fontWeight:600, cursor:'pointer',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
        }}>
          <span>买入 / 做多</span>
          <span style={{fontSize:10, fontWeight:500, opacity:0.85}}>开多 · 10x</span>
        </button>
        <button data-action="open-sell" style={{
          flex:1, height:46, borderRadius:12, border:0, background:M.dn, color:'#fff',
          fontSize:15, fontWeight:600, cursor:'pointer',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
        }}>
          <span>卖出 / 做空</span>
          <span style={{fontSize:10, fontWeight:500, opacity:0.85}}>开空 · 10x</span>
        </button>
      </div>

      <MTabBar active="market"/>
    </div>
  );
}

/* ---- order book panel ---- */
function OrderBookPanel() {
  return (
    <React.Fragment>
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr', padding:'6px 16px',
        fontSize:10, color:M.dim, fontFamily:M.mono,
      }}>
        <span>价格(USDT)</span>
        <span style={{textAlign:'right'}}>数量(BTC)</span>
        <span style={{textAlign:'right'}}>累计</span>
      </div>
      <div>
        {ASKS.slice().reverse().map((o,i)=>(<OrderRow key={'a'+i} o={o} ask/>))}
        <div style={{
          padding:'8px 16px', display:'flex', alignItems:'center', gap:10,
          background:M.soft, borderTop:`1px solid ${M.borderSoft}`, borderBottom:`1px solid ${M.borderSoft}`,
        }}>
          <span style={{fontSize:18, fontWeight:700, fontFamily:M.mono, color:M.up}}>68,420.12</span>
          <span style={{fontSize:11, color:M.dim, fontFamily:M.mono}}>≈ $68,420.12</span>
        </div>
        {BIDS.map((o,i)=>(<OrderRow key={'b'+i} o={o}/>))}
      </div>
    </React.Fragment>
  );
}

/* ---- trades panel ---- */
function TradesPanel() {
  return (
    <React.Fragment>
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1.2fr 1fr', padding:'6px 16px',
        fontSize:10, color:M.dim, fontFamily:M.mono,
      }}>
        <span>时间</span>
        <span style={{textAlign:'right'}}>价格(USDT)</span>
        <span style={{textAlign:'right'}}>数量(BTC)</span>
      </div>
      <div>
        {TRADES.map((tr,i)=>{
          const up = tr.side === 'buy';
          return (
            <div key={i} style={{
              display:'grid', gridTemplateColumns:'1fr 1.2fr 1fr',
              padding:'7px 16px', fontSize:12, fontFamily:M.mono, alignItems:'center',
            }}>
              <span style={{color:M.mid}}>{tr.t}</span>
              <span style={{textAlign:'right', color: up ? M.up : M.dn, fontWeight:600}}>{tr.p}</span>
              <span style={{textAlign:'right', color:M.text}}>{tr.q}</span>
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

/* ---- depth panel ---- */
function DepthPanel() {
  const W = 402, H = 280;
  // build cumulative bid (left) and ask (right) curves
  const allBids = [...BIDS, ...[
    {p:68408,q:0.62},{p:68404,q:1.21},{p:68400,q:0.84},{p:68395,q:2.14},{p:68390,q:1.45},
    {p:68385,q:0.96},{p:68380,q:2.84},{p:68370,q:1.62},{p:68355,q:3.20},
  ]];
  const allAsks = [...ASKS, ...[
    {p:68436,q:1.10},{p:68438,q:0.62},{p:68442,q:1.84},{p:68446,q:0.74},{p:68450,q:2.41},
    {p:68458,q:1.02},{p:68466,q:1.96},{p:68480,q:2.50},{p:68498,q:3.15},
  ]];
  const parse = (o) => ({ p: typeof o.p === 'string' ? parseFloat(o.p.replace(/,/g,'')) : o.p, q: typeof o.q === 'string' ? parseFloat(o.q) : o.q });
  const bids = allBids.map(parse).sort((a,b) => b.p - a.p); // high → low
  const asks = allAsks.map(parse).sort((a,b) => a.p - b.p); // low → high
  let bidCum = 0; const bidPts = bids.map(o => ({ p: o.p, c: (bidCum += o.q) }));
  let askCum = 0; const askPts = asks.map(o => ({ p: o.p, c: (askCum += o.q) }));
  const maxC = Math.max(bidCum, askCum) * 1.1;
  const mid = 68420.12;
  const range = 110; // ±110 around mid
  const xMin = mid - range, xMax = mid + range;
  const xOf = (p) => ((p - xMin) / (xMax - xMin)) * W;
  const yOf = (c) => H - (c / maxC) * (H - 20) - 10;
  const bidPath = `M${xOf(xMin)},${H} ` + bidPts.slice().reverse().map(p => `L${xOf(p.p)},${yOf(p.c)}`).join(' ') + ` L${xOf(mid)},${H} Z`;
  const askPath = `M${xOf(mid)},${H} ` + askPts.map(p => `L${xOf(p.p)},${yOf(p.c)}`).join(' ') + ` L${xOf(xMax)},${H} Z`;
  return (
    <div style={{overflow:'hidden'}}>
      <div style={{padding:'10px 16px 6px', display:'flex', justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:10, color:M.dim, fontFamily:M.mono}}>BID</div>
          <div style={{fontSize:14, color:M.up, fontFamily:M.mono, fontWeight:700}}>{bidCum.toFixed(2)} BTC</div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:10, color:M.dim, fontFamily:M.mono}}>SPREAD</div>
          <div style={{fontSize:14, color:M.text, fontFamily:M.mono, fontWeight:600}}>0.10 / 0.0001%</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:10, color:M.dim, fontFamily:M.mono}}>ASK</div>
          <div style={{fontSize:14, color:M.dn, fontFamily:M.mono, fontWeight:700}}>{askCum.toFixed(2)} BTC</div>
        </div>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
        <defs>
          <linearGradient id="dgBid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={M.up} stopOpacity="0.4"/>
            <stop offset="100%" stopColor={M.up} stopOpacity="0.05"/>
          </linearGradient>
          <linearGradient id="dgAsk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={M.dn} stopOpacity="0.4"/>
            <stop offset="100%" stopColor={M.dn} stopOpacity="0.05"/>
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(k => (
          <line key={k} x1="0" y1={H*k} x2={W} y2={H*k}
            stroke="var(--border-soft)" strokeDasharray="2 4"/>
        ))}
        <path d={bidPath} fill="url(#dgBid)" stroke={M.up} strokeWidth="1.4"/>
        <path d={askPath} fill="url(#dgAsk)" stroke={M.dn} strokeWidth="1.4"/>
        {/* mid marker */}
        <line x1={xOf(mid)} y1="0" x2={xOf(mid)} y2={H} stroke="var(--text-dim)" strokeDasharray="3 3" strokeOpacity="0.5"/>
        <text x={xOf(mid)} y="14" fontSize="10" fontFamily="JetBrains Mono,monospace"
          fill="var(--text-mid)" textAnchor="middle">68,420.12</text>
      </svg>
      <div style={{padding:'10px 16px', display:'flex', justifyContent:'space-between',
        fontSize:10, color:M.dim, fontFamily:M.mono}}>
        <span>{xMin.toFixed(0)}</span>
        <span>{mid}</span>
        <span>{xMax.toFixed(0)}</span>
      </div>
    </div>
  );
}

const iconBtn = {
  width:36, height:36, borderRadius:18, background:M.elev,
  border:`1px solid ${M.border}`, color:M.mid,
  display:'flex', alignItems:'center', justifyContent:'center',
};

function OrderRow({ o, ask }) {
  const pct = parseFloat(o.q.replace(',','')) / 3.5;
  return (
    <div style={{
      position:'relative', display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
      padding:'5px 16px', fontSize:12, fontFamily:M.mono, alignItems:'center',
    }}>
      <div style={{
        position:'absolute', right:0, top:0, bottom:0,
        width: `${Math.min(80, pct*60)}%`,
        background: ask ? 'rgba(229,72,77,0.10)' : 'rgba(22,163,107,0.10)',
      }}/>
      <span style={{position:'relative', color: ask ? M.dn : M.up, fontWeight:500}}>{o.p}</span>
      <span style={{position:'relative', textAlign:'right', color:M.text}}>{o.q}</span>
      <span style={{position:'relative', textAlign:'right', color:M.mid}}>{o.t}</span>
    </div>
  );
}

/* ========================================================================
   SCREEN 7 — Long / Short Ratio
   ======================================================================== */
function ScreenLS() {
  const long = 64.2, short = 35.8;
  const exchanges = [
    { ex:'Binance',   color:'#F0B90B', longA:'$1.82B', shortA:'$1.04B', l:63.6, s:36.4},
    { ex:'OKX',       color:'#1E1E1E', longA:'$884M',  shortA:'$526M',  l:62.7, s:37.3},
    { ex:'Bybit',     color:'#F7A600', longA:'$642M',  shortA:'$418M',  l:60.6, s:39.4},
    { ex:'Bitget',    color:'#00CED1', longA:'$386M',  shortA:'$210M',  l:64.8, s:35.2},
    { ex:'HTX',       color:'#3076FF', longA:'$248M',  shortA:'$152M',  l:62.0, s:38.0},
    { ex:'HyperLiquid',color:'#97F0E0',longA:'$184M',  shortA:'$118M',  l:60.9, s:39.1},
  ];
  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus/>
      <MTopBar title="多空比" sub="全市场永续合约 · 4H" right={
        <button style={iconBtn}><Ico d={ICONS.refresh} w={18}/></button>
      }/>

      <div style={{flex:1, overflow:'auto', padding:'14px 16px 100px'}}>
        {/* selector chips */}
        <div style={{display:'flex', gap:8, marginBottom:14}}>
          <span style={{
            height:32, padding:'0 14px', borderRadius:999, background:M.violetGrad, color:'#fff',
            fontSize:13, fontWeight:600, display:'inline-flex', alignItems:'center', gap:6,
          }}>BTC <Ico d={ICONS.caret} w={12} sw={2.4}/></span>
          <span style={{
            height:32, padding:'0 14px', borderRadius:999, background:M.elev, color:M.mid,
            border:`1px solid ${M.border}`, fontSize:13, fontWeight:500,
            display:'inline-flex', alignItems:'center', gap:6,
          }}>4H <Ico d={ICONS.caret} w={12} sw={2.4}/></span>
        </div>

        {/* hero banner */}
        <Card p="20px" style={{marginBottom:14}}>
          <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:14}}>
            <Av sym="₿" bg="linear-gradient(135deg, #F7931A 0%, #C16100 100%)" size={48}/>
            <div style={{flex:1}}>
              <div style={{fontSize:18, fontWeight:700, color:M.text}}>BTC 全市场</div>
              <div style={{fontSize:12, color:M.mid, marginTop:2}}>$8.6B 总持仓 · 4H 数据</div>
            </div>
            <Chip tone="ok">LIVE</Chip>
          </div>
          {/* bar */}
          <div style={{
            height:38, borderRadius:8, display:'flex', overflow:'hidden', position:'relative',
          }}>
            <div style={{
              width:`${long}%`, background:M.up, color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:14, fontWeight:700,
            }}>多 {long}%</div>
            <div style={{
              width:`${short}%`, background:M.dn, color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:14, fontWeight:700,
            }}>空 {short}%</div>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', marginTop:14, fontSize:12}}>
            <div>
              <div style={{color:M.dim}}>多头持仓</div>
              <div style={{color:M.up, fontFamily:M.mono, fontWeight:700, fontSize:16, marginTop:2}}>$5.52B</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{color:M.dim}}>空头持仓</div>
              <div style={{color:M.dn, fontFamily:M.mono, fontWeight:700, fontSize:16, marginTop:2}}>$3.08B</div>
            </div>
          </div>
        </Card>

        {/* exchange list */}
        <div style={{fontSize:13, fontWeight:600, color:M.mid, padding:'8px 4px 10px', display:'flex', alignItems:'center'}}>
          <span>交易所分布</span>
          <span style={{flex:1}}/>
          <span style={{fontSize:11, color:M.dim, fontWeight:500}}>按多头量排序</span>
        </div>
        <Card p="0">
          {exchanges.map((e,i)=>(
            <div key={e.ex} style={{
              padding:'14px 16px',
              borderBottom: i<exchanges.length-1 ? `1px solid ${M.borderSoft}` : 0,
            }}>
              <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:8}}>
                <span style={{fontSize:11, color:M.dim, width:14}}>{i+1}</span>
                <div style={{
                  width:24, height:24, borderRadius:6, background:e.color, color:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight:700, fontSize:11,
                }}>{e.ex[0]}</div>
                <span style={{fontSize:14, fontWeight:600}}>{e.ex}</span>
                <div style={{flex:1}}/>
                <span style={{fontSize:12, color:M.up, fontFamily:M.mono, fontWeight:600}}>{e.longA}</span>
                <span style={{fontSize:10, color:M.dim}}>/</span>
                <span style={{fontSize:12, color:M.dn, fontFamily:M.mono, fontWeight:600}}>{e.shortA}</span>
              </div>
              <div style={{height:8, borderRadius:4, display:'flex', overflow:'hidden'}}>
                <div style={{width:`${e.l}%`, background:M.up}}/>
                <div style={{width:`${e.s}%`, background:M.dn}}/>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', marginTop:5, fontSize:10, color:M.mid, fontFamily:M.mono}}>
                <span>多 {e.l}%</span>
                <span>空 {e.s}%</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
      <MTabBar active="market"/>
    </div>
  );
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

  const [orderType, setOrderType] = React.useState(0);   // 0 限价 / 1 市价 / 2 条件
  const [marginMode, setMarginMode] = React.useState(0); // 0 全仓 / 1 逐仓
  const [leverage, setLeverage] = React.useState(10);
  const [price, setPrice] = React.useState(68420.12);
  const [trigger, setTrigger] = React.useState(68900);
  const [pct, setPct] = React.useState(50);              // % of available used as margin
  const [tpsl, setTpsl] = React.useState(false);
  const [tp, setTp] = React.useState(isBuy ? 72500 : 64500);
  const [sl, setSl] = React.useState(isBuy ? 66800 : 70200);
  const [showLev, setShowLev] = React.useState(false);
  const [showMode, setShowMode] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // computed
  const isMarket = orderType === 1;
  const isCond   = orderType === 2;
  const margin   = (AVAILABLE * pct) / 100;
  const notional = margin * leverage;
  const amount   = price > 0 ? notional / price : 0;
  const fee      = notional * 0.0005;
  const liq      = isBuy
    ? price * (1 - 0.9 / leverage)
    : price * (1 + 0.9 / leverage);

  const fmt = (n, d=2) => n.toLocaleString('en-US', { minimumFractionDigits:d, maximumFractionDigits:d });
  const fmtAmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits:4, maximumFractionDigits:4 });

  // slider drag
  const trackRef = React.useRef(null);
  const dragging = React.useRef(false);
  const setPctFromX = (clientX) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    setPct(Math.round(p));
  };
  React.useEffect(() => {
    const move = (e) => { if (dragging.current) setPctFromX(e.touches ? e.touches[0].clientX : e.clientX); };
    const up   = () => { dragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, {passive:true});
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
    height:46, padding:'0 10px 0 14px', borderRadius:11, background:M.soft,
    border:`1px solid ${focus ? color : M.borderSoft}`,
    display:'flex', alignItems:'center', gap:10, transition:'border-color .15s',
  });
  const inputStyle = {
    flex:1, fontSize:15, color:M.text, fontFamily:M.mono, fontWeight:600,
    background:'transparent', border:0, outline:'none', minWidth:0,
  };

  return (
    <div className="m-sheet-scrim" onClick={close}
      style={{height:'100%', position:'relative', background:'rgba(15,22,35,0.55)', overflow:'hidden'}}>
      <MStatus dark/>
      <div className="m-sheet" onClick={stop} style={{
        position:'absolute', left:0, right:0, bottom:0, top:80,
        background:M.elev, borderRadius:'24px 24px 0 0',
        boxShadow:'0 -16px 48px rgba(15,22,35,0.18)',
        display:'flex', flexDirection:'column',
      }}>
        {/* grabber */}
        <div style={{padding:'10px 0 0', display:'flex', justifyContent:'center'}}>
          <div style={{width:42, height:4, borderRadius:2, background:M.border}}/>
        </div>
        {/* head */}
        <div style={{padding:'12px 20px 6px', display:'flex', alignItems:'center', gap:12}}>
          <Av sym="₿" bg="linear-gradient(135deg, #F7931A 0%, #C16100 100%)" size={36}/>
          <div style={{flex:1}}>
            <div style={{fontSize:17, fontWeight:700, color:M.text}}>
              {isBuy ? '买入 / 做多' : '卖出 / 做空'} BTC
            </div>
            <div style={{fontSize:12, color:M.mid, marginTop:2}}>
              BTC/USDT · 永续 · Binance
            </div>
          </div>
          <button data-action="close-sheet" onClick={close} style={{
            width:32, height:32, borderRadius:16, background:M.soft,
            border:0, color:M.mid, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}><Ico d={ICONS.close} w={16} sw={2}/></button>
        </div>

        {/* leverage + margin mode (popovers) */}
        <div style={{padding:'8px 20px 4px', display:'flex', gap:8, position:'relative'}}>
          <button onClick={()=>{setShowMode(s=>!s); setShowLev(false);}} style={{
            flex:1, height:34, borderRadius:8, background: showMode ? M.violetSoft : M.soft,
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0 12px', fontSize:12, color:M.text, border:0, cursor:'pointer',
          }}>
            <span style={{color:M.mid}}>{MARGIN_MODES[marginMode]}</span>
            <Ico d={ICONS.caret} w={12} sw={2}/>
          </button>
          <button onClick={()=>{setShowLev(s=>!s); setShowMode(false);}} style={{
            flex:1, height:34, borderRadius:8, background: showLev ? M.violetSoft : M.soft,
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0 12px', fontSize:12, color:M.text, fontWeight:600, border:0, cursor:'pointer',
          }}>
            <span>{leverage}×</span>
            <Ico d={ICONS.caret} w={12} sw={2}/>
          </button>

          {showMode && (
            <div style={{
              position:'absolute', top:46, left:20, zIndex:5, width:160,
              background:M.elev, border:`1px solid ${M.border}`, borderRadius:10,
              boxShadow:'0 8px 24px rgba(15,22,35,0.20)', overflow:'hidden',
            }}>
              {MARGIN_MODES.map((m,i)=>(
                <button key={m} onClick={()=>{setMarginMode(i); setShowMode(false);}} style={{
                  display:'block', width:'100%', padding:'10px 12px', textAlign:'left',
                  fontSize:13, color: i===marginMode ? color : M.text,
                  background:'transparent', border:0, cursor:'pointer',
                  fontWeight: i===marginMode ? 600 : 500,
                }}>{m}</button>
              ))}
            </div>
          )}
          {showLev && (
            <div style={{
              position:'absolute', top:46, right:20, zIndex:5, width:200,
              background:M.elev, border:`1px solid ${M.border}`, borderRadius:10,
              boxShadow:'0 8px 24px rgba(15,22,35,0.20)', padding:8,
            }}>
              <div style={{fontSize:11, color:M.mid, padding:'4px 6px 8px'}}>选择杠杆倍数</div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6}}>
                {LEVERAGES.map(L=>(
                  <button key={L} onClick={()=>{setLeverage(L); setShowLev(false);}} style={{
                    height:30, borderRadius:6, fontSize:12, fontWeight:600,
                    background: L===leverage ? color : M.soft,
                    color: L===leverage ? '#fff' : M.text,
                    border:0, cursor:'pointer', fontFamily:M.mono,
                  }}>{L}×</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{flex:1, overflow:'auto', padding:'10px 20px 20px'}}>
          {/* order type tabs */}
          <div style={{display:'flex', gap:14, fontSize:13, fontWeight:500, marginBottom:14, borderBottom:`1px solid ${M.borderSoft}`}}>
            {ORDER_TYPES.map((t,i) => {
              const on = i === orderType;
              return (
                <button key={t} onClick={()=>setOrderType(i)} style={{
                  padding:'8px 0', color: on ? M.text : M.mid, fontWeight: on ? 700 : 500,
                  borderBottom: on ? `2px solid ${color}` : '2px solid transparent',
                  background:'transparent', border:0, borderRadius:0, cursor:'pointer',
                }}>{t}</button>
              );
            })}
          </div>

          {/* trigger price (条件) */}
          {isCond && (
            <>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                <span style={{fontSize:12, color:M.mid}}>触发价</span>
                <span style={{fontSize:11, color:M.dim}}>最新 {fmt(68420.12)}</span>
              </div>
              <div style={fieldBox(false)}>
                <input type="number" inputMode="decimal" value={trigger}
                  onChange={e=>setTrigger(parseFloat(e.target.value)||0)}
                  style={inputStyle}/>
                <span style={{fontSize:11, color:M.dim}}>USDT</span>
              </div>
              <div style={{height:14}}/>
            </>
          )}

          {/* price (only for limit / 条件) */}
          {!isMarket && (
            <>
              <div style={{fontSize:12, color:M.mid, marginBottom:6}}>价格</div>
              <div style={fieldBox(false)}>
                <input type="number" inputMode="decimal" value={price}
                  onChange={e=>setPrice(parseFloat(e.target.value)||0)}
                  style={inputStyle}/>
                <span style={{fontSize:11, color:M.dim}}>USDT</span>
                <div style={{display:'flex', flexDirection:'column'}}>
                  <button onClick={()=>setPrice(p=>+(p+0.1).toFixed(2))}
                    style={{width:24,height:18,background:M.elev,border:`1px solid ${M.border}`,borderRadius:'4px 4px 0 0',color:M.mid,cursor:'pointer',fontSize:10}}>+</button>
                  <button onClick={()=>setPrice(p=>+Math.max(0, p-0.1).toFixed(2))}
                    style={{width:24,height:18,background:M.elev,border:`1px solid ${M.border}`,borderTop:0,borderRadius:'0 0 4px 4px',color:M.mid,cursor:'pointer',fontSize:10}}>−</button>
                </div>
              </div>
              <div style={{display:'flex', gap:6, marginTop:6, marginBottom:14}}>
                {[
                  {l:'最新', v:68420.12},
                  {l:'买一', v:68419.50},
                  {l:'卖一', v:68420.80},
                ].map(o=>(
                  <button key={o.l} onClick={()=>setPrice(o.v)} style={{
                    flex:1, height:24, borderRadius:6, background:M.soft, border:0,
                    fontSize:11, color:M.mid, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                  }}>
                    <span>{o.l}</span>
                    <span style={{fontFamily:M.mono, color:M.text}}>{fmt(o.v)}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {isMarket && (
            <div style={{
              padding:'10px 12px', borderRadius:10, background:M.soft, marginBottom:14,
              display:'flex', alignItems:'center', gap:8, fontSize:12, color:M.mid,
            }}>
              <Ico d={ICONS.bolt || ICONS.shield} w={14} fill={color} sw={0}/>
              市价立即成交 · 参考价 <span style={{fontFamily:M.mono, color:M.text, fontWeight:600}}>{fmt(68420.12)}</span> USDT
            </div>
          )}

          {/* amount */}
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6}}>
            <span style={{fontSize:12, color:M.mid}}>数量</span>
            <span style={{fontSize:11, color:M.dim, fontFamily:M.mono}}>可用 {fmt(AVAILABLE)} USDT</span>
          </div>
          <div style={fieldBox(false)}>
            <input type="number" inputMode="decimal" value={amount.toFixed(4)}
              onChange={e=>{
                const a = parseFloat(e.target.value)||0;
                const m = (a * price) / leverage;
                const p = Math.max(0, Math.min(100, (m / AVAILABLE) * 100));
                setPct(Math.round(p));
              }}
              style={inputStyle}/>
            <span style={{fontSize:11, color:M.dim}}>BTC</span>
          </div>

          {/* % slider — clickable + draggable */}
          <div
            ref={trackRef}
            onMouseDown={(e)=>{ dragging.current = true; setPctFromX(e.clientX); }}
            onTouchStart={(e)=>{ dragging.current = true; setPctFromX(e.touches[0].clientX); }}
            style={{position:'relative', height:48, margin:'14px 0 22px', cursor:'pointer', touchAction:'none', userSelect:'none'}}>
            <div style={{position:'absolute', left:0, right:0, top:15, height:2, background:M.border, borderRadius:1}}/>
            <div style={{position:'absolute', left:0, top:15, height:2, width:`${pct}%`, background:color, borderRadius:1, transition: dragging.current ? 'none' : 'width .12s'}}/>
            {[0,25,50,75,100].map((p) => {
              const filled = p <= pct;
              return (
                <div key={p} onClick={(e)=>{ e.stopPropagation(); setPct(p); }}
                  style={{
                    position:'absolute', left:`${p}%`, top:9, transform:'translateX(-50%)',
                    width:14, height:14, borderRadius:7,
                    background: filled ? color : M.elev,
                    border: `2px solid ${filled ? color : M.border}`,
                    cursor:'pointer',
                }}/>
              );
            })}
            {/* draggable handle */}
            <div style={{
              position:'absolute', left:`${pct}%`, top:4, transform:'translateX(-50%)',
              width:24, height:24, borderRadius:12, background:color,
              border:'3px solid #fff',
              boxShadow:`0 2px 8px ${color}88`,
              transition: dragging.current ? 'none' : 'left .12s',
              pointerEvents:'none',
            }}/>
            {[0,25,50,75,100].map((p) => (
              <span key={p} onClick={(e)=>{ e.stopPropagation(); setPct(p); }} style={{
                position:'absolute', left:`${p}%`, top:32, transform:'translateX(-50%)',
                fontSize:10, color: pct===p ? color : M.dim, fontWeight: pct===p?600:500, fontFamily:M.mono,
                cursor:'pointer',
              }}>{p}%</span>
            ))}
          </div>

          {/* TP / SL toggle + inputs */}
          <div style={{
            display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
            background:M.soft, borderRadius:10, marginBottom: tpsl ? 8 : 14,
            cursor:'pointer',
          }} onClick={()=>setTpsl(t=>!t)}>
            <Ico d={ICONS.shield} w={14} fill={tpsl ? color : M.mid} sw={0}/>
            <span style={{fontSize:12, color:tpsl ? M.text : M.mid, flex:1}}>止盈 / 止损</span>
            <div style={{
              width:32, height:20, borderRadius:10,
              background: tpsl ? color : M.border, position:'relative',
              transition:'background .15s',
            }}>
              <div style={{
                position:'absolute', left: tpsl ? 14 : 2, top:2,
                width:16, height:16, borderRadius:8, background:'#fff',
                boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
                transition:'left .15s',
              }}/>
            </div>
          </div>
          {tpsl && (
            <div style={{display:'flex', gap:8, marginBottom:14}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11, color:M.up, marginBottom:4, fontWeight:600}}>止盈价</div>
                <div style={{...fieldBox(false), height:40, padding:'0 10px'}}>
                  <input type="number" inputMode="decimal" value={tp}
                    onChange={e=>setTp(parseFloat(e.target.value)||0)}
                    style={{...inputStyle, fontSize:13}}/>
                </div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11, color:M.dn, marginBottom:4, fontWeight:600}}>止损价</div>
                <div style={{...fieldBox(false), height:40, padding:'0 10px'}}>
                  <input type="number" inputMode="decimal" value={sl}
                    onChange={e=>setSl(parseFloat(e.target.value)||0)}
                    style={{...inputStyle, fontSize:13}}/>
                </div>
              </div>
            </div>
          )}

          {/* preview rows */}
          <div style={{
            background:M.soft, borderRadius:10, padding:'12px 14px',
            display:'flex', flexDirection:'column', gap:8, marginBottom:12,
          }}>
            <Stat2 label="保证金" v={`${fmt(margin)} USDT`}/>
            <Stat2 label="名义价值" v={`${fmt(notional)} USDT`}/>
            <Stat2 label="预计强平价" v={fmt(liq)} tone={isBuy ? 'dn' : 'up'}/>
            <Stat2 label="手续费 (taker)" v={`${fmt(fee, 2)} USDT`}/>
            {tpsl && (
              <>
                <Stat2 label="止盈预计收益" v={`+${fmt(Math.abs((tp-price)/price)*notional)} USDT`} tone="up"/>
                <Stat2 label="止损预计损失" v={`-${fmt(Math.abs((sl-price)/price)*notional)} USDT`} tone="dn"/>
              </>
            )}
          </div>
        </div>

        {/* sticky bottom action */}
        <div style={{padding:'12px 20px 36px', borderTop:`1px solid ${M.borderSoft}`}}>
          <button
            onClick={()=>{
              if (pct === 0 || submitting) return;
              setSubmitting(true);
              setTimeout(()=>{ setSubmitting(false); close(); }, 700);
            }}
            disabled={pct === 0 || submitting}
            style={{
              width:'100%', height:50, borderRadius:14, border:0,
              background: pct === 0 ? M.border : color,
              color:'#fff', fontSize:16, fontWeight:700,
              cursor: pct === 0 ? 'default' : 'pointer',
              boxShadow: pct === 0 ? 'none' : `0 8px 24px ${color}55`,
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              transition:'background .15s',
            }}>
            {submitting ? (
              <>
                <span style={{
                  width:16, height:16, borderRadius:8,
                  border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff',
                  animation:'qfSpin .8s linear infinite',
                }}/>
                提交中…
              </>
            ) : pct === 0 ? '请选择数量' : (
              <>
                <Ico d={isBuy ? ICONS.arrowU : ICONS.arrowD} w={16} sw={2.4}/>
                {isBuy ? '确认买入' : '确认卖出'} {fmtAmt(amount)} BTC
              </>
            )}
          </button>
          <div style={{textAlign:'center', fontSize:10, color:M.dim, marginTop:8}}>
            提交后由 AI 风控自动检查仓位与最大回撤
          </div>
        </div>
        <style>{`@keyframes qfSpin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  );
}

function Stat2({ label, v, tone }) {
  const c = tone === 'up' ? M.up : tone === 'dn' ? M.dn : M.text;
  return (
    <div style={{display:'flex', justifyContent:'space-between', fontSize:12}}>
      <span style={{color:M.mid}}>{label}</span>
      <span style={{color:c, fontFamily:M.mono, fontWeight:600}}>{v}</span>
    </div>
  );
}

Object.assign(window, { ScreenTradingDetail, ScreenLS, ScreenOrderEntry, OrderRow });

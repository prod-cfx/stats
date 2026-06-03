/* Mobile screens part 4 — Whale Feed, Account / Profile, API Config */

/* ========================================================================
   SCREEN 8 — Whale Feed (实时巨鲸)
   ======================================================================== */

/* exchange brand chip color (small dot only — no logo copy) */
const VENUE = {
  BINANCE:     { c:'#F0B90B' },
  OKX:         { c:'#0B0B0B' },
  HYPERLIQUID: { c:'#22D3EE' },
  BYBIT:       { c:'#F59E0B' },
  COINBASE:    { c:'#2563EB' },
  'COLD WALLET':{ c:'#64748B' },
  FIREBLOCKS:  { c:'#7C5CFF' },
  'ON-CHAIN':  { c:'#7C5CFF' },
};

/* tag styles — kept tonal, not noisy */
const TAG_STYLE = {
  '聪明钱':   { fg:'#7C5CFF', bg:'var(--accent-soft)' },
  '机构':     { fg:'var(--info)', bg:'var(--info-soft)' },
  '新地址':   { fg:'var(--warn)', bg:'var(--warn-soft)' },
  '长期持有': { fg:'var(--text-mid)', bg:'var(--bg-soft)' },
  '巨额':     { fg:'var(--mk-up)', bg:'var(--mk-up-soft)' },
};

/* PC 巨鲸-实时 字段：地址 / 趋势标签 / 币种 / 全仓·逐仓 / 多空 / 杠杆 / 持仓价值 + 数量 / 开盘价 / 胜率 / 成交时间 */
const SYM_COLOR = { BTC:'#F7931A', ETH:'#627EEA', SOL:'#9945FF' };
const TRADER_TAG_BG = 'var(--accent-soft)';
const TRADER_TAG_FG = 'var(--accent)';

const WHALE_TRADES = [
  { ad:'0x95…c60a', trader:'波段交易者', sym:'SOL', mode:'全仓', side:'short', lev:null, value:31421.84,   qty:'375.5000 SOL', open:83.7,   win:48, time:'4 分钟前',  tg:'now', fresh:true },
  { ad:'0xfc…9d9d', trader:'趋势跟踪',   sym:'BTC', mode:'全仓', side:'long',  lev:null, value:22728.9,    qty:'0.3000 BTC',   open:75763,  win:85, time:'5 分钟前',  tg:'now' },
  { ad:'0xe2…55d6', trader:'趋势跟踪',   sym:'BTC', mode:'全仓', side:'long',  lev:null, value:2538787.56, qty:'33.5140 BTC',  open:75753,  win:73, time:'5 分钟前',  tg:'now' },
  { ad:'0x57…494b', trader:'趋势跟踪',   sym:'BTC', mode:'全仓', side:'long',  lev:null, value:25064.53,   qty:'0.3308 BTC',   open:75758,  win:69, time:'5 分钟前',  tg:'now' },
  { ad:'0xe2…55d6', trader:'趋势跟踪',   sym:'BTC', mode:'全仓', side:'long',  lev:null, value:19842.22,   qty:'0.2619 BTC',   open:75751,  win:73, time:'5 分钟前',  tg:'now' },
  { ad:'0xec…2b00', trader:'波段交易者', sym:'BTC', mode:'全仓', side:'short', lev:null, value:75104.65,   qty:'0.9917 BTC',   open:75734,  win:85, time:'7 分钟前',  tg:'15m' },
  { ad:'0xcf…f95f', trader:'趋势跟踪',   sym:'BTC', mode:'全仓', side:'long',  lev:null, value:39674.65,   qty:'0.5238 BTC',   open:75741,  win:83, time:'8 分钟前',  tg:'15m' },
  { ad:'0xec…2b00', trader:'波段交易者', sym:'ETH', mode:'全仓', side:'short', lev:null, value:31513.87,   qty:'15.2138 ETH',  open:2071.4, win:57, time:'9 分钟前',  tg:'15m' },
  { ad:'0x02…2365', trader:'波段交易者', sym:'ETH', mode:'全仓', side:'short', lev:null, value:11445.52,   qty:'5.5265 ETH',   open:2071.4, win:63, time:'9 分钟前',  tg:'15m' },
  { ad:'0xd4…1a91', trader:'波段交易者', sym:'ETH', mode:'全仓', side:'short', lev:null, value:32178.37,   qty:'15.5346 ETH',  open:2071.4, win:72, time:'9 分钟前',  tg:'15m' },
  { ad:'0x95…c293', trader:'波段交易者', sym:'BTC', mode:'全仓', side:'short', lev:null, value:44190.97,   qty:'0.5834 BTC',   open:75746,  win:74, time:'10 分钟前', tg:'1h' },
  { ad:'0x77…bd7e', trader:'波段交易者', sym:'BTC', mode:'全仓', side:'short', lev:null, value:13362.88,   qty:'0.1764 BTC',   open:75749,  win:75, time:'10 分钟前', tg:'1h' },
  { ad:'0x0b…0a7d', trader:'波段交易者', sym:'BTC', mode:'全仓', side:'short', lev:null, value:28502.85,   qty:'0.3763 BTC',   open:75743,  win:74, time:'10 分钟前', tg:'1h' },
];

/* legacy alias kept so anything still importing WHALES_M doesn't blow up */
const WHALES_M = WHALE_TRADES;

const GROUPS = [
  { k:'now', label:'最近 5 分钟', live:true },
  { k:'15m', label:'15 分钟内' },
  { k:'1h',  label:'过去 1 小时' },
];

/* tidy USD formatter for 持仓价值 */
function fmtUsd(n) {
  if (n >= 1_000_000) return '$' + (n/1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function fmtPrice(n) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 });
}

/* mini area sparkline — 60×24, pre-baked path so it reads like a chart */
function FlowSpark({ tone='up' }) {
  const pts = [0,3,2,5,4,7,6,9,11,10,14,16,15,18,22,21,24,28,30,34,38];
  const w = 96, h = 28, max = 38;
  const step = w / (pts.length - 1);
  const line = pts.map((p,i) => `${i===0?'M':'L'}${(i*step).toFixed(1)},${(h - (p/max)*h*0.9 - 2).toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const color = tone === 'up' ? 'var(--mk-up)' : 'var(--mk-dn)';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{display:'block'}}>
      <defs>
        <linearGradient id="fs-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#fs-g)"/>
      <path d={line} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ---- Notifications data + panel ---- */
const WHALE_NOTIFS = [
  {
    id:'n1', kind:'alert', tone:'up', unread:true,
    title:'巨额买入 · BTC',
    body:'Galaxy Digital 在 Binance 买入 842 BTC ($57.6M)',
    meta:'刚刚 · 触发规则「机构 ≥ $50M」',
    addr:'0xa83…b8f2',
    actions:['查看', '跟单'],
  },
  {
    id:'n2', kind:'watch', tone:'up', unread:true,
    title:'监控地址异动',
    body:'Smart Money · 7D 累计净买入 1,204 BTC',
    meta:'2 分钟前 · 监控组「聪明钱」',
    addr:'0x7c1…44a3',
    actions:['查看', '设置'],
  },
  {
    id:'n3', kind:'alert', tone:'dn', unread:true,
    title:'大额卖出 · ETH',
    body:'Cumberland 在 Hyperliquid 卖出 318 ETH ($21.8M)',
    meta:'5 分钟前 · 触发规则「做市商 ≥ $20M」',
    addr:'0x4f9…0e1c',
    actions:['查看'],
  },
  {
    id:'n4', kind:'flow', tone:'up', unread:false,
    title:'净流入突破阈值',
    body:'BTC 1H 净流入 +$284M，超过 24H 平均 2.1×',
    meta:'12 分钟前 · 资金流向',
    actions:['查看图表'],
  },
  {
    id:'n5', kind:'watch', tone:'neutral', unread:false,
    title:'冷钱包激活',
    body:'休眠 412 天的地址转出 512 BTC 至交易所',
    meta:'24 分钟前 · 监控组「长期持有者」',
    addr:'0xb2e…91d7',
    actions:['查看'],
  },
  {
    id:'n6', kind:'system', tone:'neutral', unread:false,
    title:'监控规则已生效',
    body:'新规则「机构净流入 ≥ $50M / 1H」开始监控',
    meta:'1 小时前 · 系统',
    actions:['编辑'],
  },
];

const N_KIND = {
  alert:  { label:'巨鲸预警', icon:'M12 2l10 18H2L12 2zm0 6v6m0 3v.5', accent:'var(--warn)', bg:'var(--warn-soft)' },
  watch:  { label:'监控触发', icon:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', accent:'var(--accent)', bg:'var(--accent-soft)' },
  flow:   { label:'资金流向', icon:'M3 17l6-6 4 4 8-9M21 8h-5M21 8v5', accent:'var(--info)', bg:'var(--info-soft)' },
  system: { label:'系统消息', icon:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5v5l3 2', accent:'var(--text-mid)', bg:'var(--bg-soft)' },
};

function WhaleNotifPanel({ items, tab, setTab, unread, onMarkAll, onClose }) {
  const tabs = ['全部', '巨鲸预警', '监控触发', '系统'];
  const tabKind = { '巨鲸预警':'alert', '监控触发':'watch', '系统':['flow','system'] };
  const filtered = items.filter(n => {
    if (tab === '全部') return true;
    const k = tabKind[tab];
    return Array.isArray(k) ? k.includes(n.kind) : n.kind === k;
  });
  return (
    <React.Fragment>
      {/* scrim */}
      <div
        onClick={onClose}
        className="m-sheet-scrim"
        style={{
          position:'absolute', inset:0, background:M.scrim, zIndex:60,
        }}
      />
      {/* panel — slides down from top */}
      <div
        className="m-notif-panel"
        style={{
          position:'absolute', top:0, left:0, right:0, zIndex:61,
          background:M.elev, borderBottom:`1px solid ${M.border}`,
          borderRadius:'0 0 18px 18px',
          boxShadow:'0 24px 48px -12px rgba(0,0,0,0.28)',
          display:'flex', flexDirection:'column',
          maxHeight:'78%',
          paddingTop:54,
        }}
      >
        {/* header */}
        <div style={{padding:'10px 12px 8px', display:'flex', alignItems:'center', gap:8}}>
          <div style={{flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8}}>
            <div style={{fontSize:15, fontWeight:700, color:M.text, letterSpacing:-0.2}}>
              通知中心
            </div>
            {unread > 0 && (
              <span style={{
                height:18, padding:'0 7px', borderRadius:9,
                background:'var(--danger-soft)', color:'var(--danger)',
                fontSize:11, fontWeight:600, fontFamily:M.mono,
                display:'inline-flex', alignItems:'center',
              }}>{unread} 条未读</span>
            )}
          </div>
          <button
            onClick={onMarkAll}
            disabled={unread===0}
            style={{
              height:26, padding:'0 9px', borderRadius:13,
              background:'transparent', border:`1px solid ${M.border}`,
              color: unread>0 ? M.mid : M.faint,
              fontSize:11, fontWeight:500, cursor: unread>0 ? 'pointer':'default',
              display:'inline-flex', alignItems:'center', gap:4,
            }}>
            <Ico d={ICONS.check} w={11}/> 全部已读
          </button>
          <button
            onClick={onClose}
            style={{
              width:26, height:26, borderRadius:13,
              background:M.soft, border:0, color:M.mid,
              display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0,
            }}>
            <Ico d={ICONS.close} w={13}/>
          </button>
        </div>

        {/* tabs */}
        <div style={{
          padding:'0 16px', display:'flex', gap:6, overflowX:'auto',
          borderBottom:`1px solid ${M.borderSoft}`,
        }}>
          {tabs.map(t => {
            const on = tab === t;
            const count = t === '全部'
              ? items.length
              : items.filter(n => Array.isArray(tabKind[t]) ? tabKind[t].includes(n.kind) : n.kind===tabKind[t]).length;
            return (
              <button key={t} onClick={()=>setTab(t)} style={{
                background:'transparent', border:0, padding:'8px 4px 10px',
                cursor:'pointer', whiteSpace:'nowrap',
                color: on ? M.text : M.mid,
                fontWeight: on ? 700 : 500, fontSize:12,
                borderBottom: on ? `2px solid ${M.violet}` : '2px solid transparent',
                marginBottom:-1,
                display:'inline-flex', alignItems:'center', gap:5,
              }}>
                {t}
                <span style={{
                  fontSize:10, fontFamily:M.mono, color: on ? M.violet : M.faint,
                  fontWeight:600,
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* list */}
        <div style={{flex:1, overflow:'auto'}}>
          {filtered.length === 0 ? (
            <div style={{padding:'36px 16px', textAlign:'center', color:M.dim, fontSize:13}}>
              暂无该类通知
            </div>
          ) : filtered.map(n => {
            const k = N_KIND[n.kind];
            const toneColor = n.tone==='up' ? M.up : n.tone==='dn' ? M.dn : M.mid;
            return (
              <div key={n.id} style={{
                padding:'12px 16px', display:'flex', gap:11,
                borderBottom:`1px solid ${M.borderSoft}`,
                background: n.unread ? 'var(--accent-soft)' : 'transparent',
                position:'relative',
              }}>
                {/* unread dot */}
                {n.unread && (
                  <span style={{
                    position:'absolute', left:6, top:18,
                    width:6, height:6, borderRadius:3, background:M.violet,
                  }}/>
                )}
                {/* kind icon */}
                <div style={{
                  width:32, height:32, flexShrink:0, borderRadius:16,
                  background:k.bg, color:k.accent,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <Ico d={k.icon} w={15}/>
                </div>

                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:2}}>
                    <span style={{
                      fontSize:10, color:k.accent, fontWeight:600, letterSpacing:0.3,
                      textTransform:'uppercase',
                    }}>{k.label}</span>
                    {n.addr && (
                      <span style={{
                        fontSize:10, color:M.faint, fontFamily:M.mono,
                      }}>· {n.addr}</span>
                    )}
                  </div>
                  <div style={{
                    fontSize:13, fontWeight:600, color:M.text, letterSpacing:-0.1,
                    marginBottom:3, lineHeight:1.35,
                  }}>
                    {n.title}
                  </div>
                  <div style={{
                    fontSize:12, color:M.mid, lineHeight:1.45, marginBottom:6,
                  }}>
                    {n.body.split(/(\+[\d,]+\s?\w+|\$[\d.,]+M|-[\d,]+\s?\w+|\d+\.?\d*×)/).map((seg,i) => {
                      if (/^(\+[\d,]+|\$[\d.,]+M|\d+\.?\d*×)/.test(seg) && n.tone === 'up') {
                        return <span key={i} style={{color:M.up, fontFamily:M.mono, fontWeight:600}}>{seg}</span>;
                      }
                      if (/^-[\d,]+/.test(seg) || (n.tone==='dn' && /^\$[\d.,]+M/.test(seg))) {
                        return <span key={i} style={{color:M.dn, fontFamily:M.mono, fontWeight:600}}>{seg}</span>;
                      }
                      return seg;
                    })}
                  </div>
                  <div style={{
                    display:'flex', alignItems:'center', gap:8,
                    fontSize:10, color:M.faint,
                  }}>
                    <span>{n.meta}</span>
                  </div>
                  {n.actions && n.actions.length > 0 && (
                    <div style={{display:'flex', gap:6, marginTop:8}}>
                      {n.actions.map((a, i) => {
                        const primary = i === 0;
                        return (
                          <button key={a} style={{
                            height:26, padding:'0 12px', borderRadius:13,
                            background: primary ? M.text : 'transparent',
                            color: primary ? M.elev : M.mid,
                            border: primary ? 0 : `1px solid ${M.border}`,
                            fontSize:11, fontWeight:600, cursor:'pointer',
                          }}>{a}</button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div style={{
          padding:'10px 16px', borderTop:`1px solid ${M.borderSoft}`,
          display:'flex', alignItems:'center', gap:10, background:M.elev,
          borderRadius:'0 0 18px 18px',
        }}>
          <span style={{fontSize:11, color:M.faint, flex:1}}>
            仅显示最近 24 小时通知
          </span>
          <button style={{
            background:'transparent', border:0, color:M.violet,
            fontSize:12, fontWeight:600, cursor:'pointer',
            display:'inline-flex', alignItems:'center', gap:4,
          }}>
            <Ico d={ICONS.sliders} w={13}/> 通知设置
          </button>
        </div>
      </div>

      <style>{`
        .m-notif-panel { animation: m-slide-down 320ms cubic-bezier(.32,.72,0,1) both; transform-origin: top center; }
        @keyframes m-slide-down {
          from { transform: translateY(-12%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </React.Fragment>
  );
}

function ScreenWhale({ route }) {
  const [tab, setTab] = React.useState('发现');
  const [asset, setAsset] = React.useState('BTC');
  const [notif, setNotif] = React.useState(false);
  const [notifTab, setNotifTab] = React.useState('全部');
  const [notifData, setNotifData] = React.useState(WHALE_NOTIFS);
  // demo overlays — driven by legend route
  const [demoOverlay, setDemoOverlay] = React.useState(null); // 'profile' | 'stats' | null
  const unread = notifData.filter(n => n.unread).length;
  const markAllRead = () => setNotifData(notifData.map(n => ({...n, unread:false})));

  React.useEffect(() => {
    if (!route) { setDemoOverlay(null); setNotif(false); return; }
    const tabMap = { discover:'发现', live:'实时', holdings:'持仓', watch:'监控' };
    if (tabMap[route]) { setTab(tabMap[route]); setNotif(false); setDemoOverlay(null); return; }
    if (route === 'notif')   { setNotif(true);  setDemoOverlay(null); return; }
    if (route === 'profile') { setNotif(false); setDemoOverlay('profile'); return; }
    if (route === 'stats')   { setNotif(false); setDemoOverlay('stats');   return; }
  }, [route]);

  const sampleProfile = React.useMemo(
    () => (window.WHALE_PROFILES || [])[0] || { id:'0x8ba1…ba72' },
    []
  );
  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus/>
      {/* combined header: tabs + bell badge */}
      <div style={{
        background:M.elev, borderBottom:`1px solid ${M.border}`,
        paddingTop:52, display:'flex', alignItems:'stretch',
      }}>
        {/* tab strip */}
        <div style={{
          flex:1, display:'flex', alignItems:'stretch',
          padding:'0 0 0 16px', gap:20,
        }}>
          {['发现','实时','持仓','监控'].map(t => {
            const on = t === tab;
            return (
              <button key={t} onClick={()=>setTab(t)} style={{
                background:'transparent', border:0, padding:'12px 0 0',
                cursor:'pointer', fontFamily:'inherit',
                color: on ? M.text : M.mid,
                fontWeight: on ? 600 : 400, fontSize:14,
                whiteSpace:'nowrap',
                position:'relative',
              }}>
                {t}
                <span style={{
                  display:'block', height:2, borderRadius:2,
                  marginTop:10,
                  background: on ? M.violet : 'transparent',
                }}/>
              </button>
            );
          })}
        </div>

        {/* bell badge */}
        <div style={{
          flexShrink:0, display:'flex', alignItems:'center',
          paddingRight:14, paddingLeft:6, paddingBottom:4,
        }}>
          <button
            onClick={()=>setNotif(true)}
            style={{
              position:'relative', width:36, height:36, borderRadius:18,
              background:'transparent', border:0, cursor:'pointer', padding:0,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke={M.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unread > 0 && (
              <span style={{
                position:'absolute', top:-2, right:-4,
                minWidth:18, height:18, padding:'0 4px', borderRadius:9,
                background:'#E5484D', color:'#fff',
                fontSize:10, fontWeight:700, fontFamily:M.mono,
                display:'flex', alignItems:'center', justifyContent:'center',
                lineHeight:1, border:`1.5px solid ${M.elev}`,
              }}>{unread}</span>
            )}
          </button>
        </div>
      </div>

      {notif && (
        <WhaleNotifPanel
          items={notifData}
          tab={notifTab}
          setTab={setNotifTab}
          unread={unread}
          onMarkAll={markAllRead}
          onClose={()=>setNotif(false)}
        />
      )}

      <div style={{flex:1, overflow:'auto', paddingBottom:100}}>
        {tab === '实时' && <WhaleLive asset={asset} setAsset={setAsset}/>}
        {tab === '发现' && (window.WhaleDiscoverNew ? <window.WhaleDiscoverNew/> : <WhaleDiscover/>)}
        {tab === '持仓' && <WhaleHoldings/>}
        {tab === '监控' && <WhaleWatch/>}
      </div>
      <MTabBar active="whale"/>

      {/* legend-triggered demo overlays */}
      {demoOverlay === 'profile' && window.WhaleProfileDetail && (
        <window.WhaleProfileDetail
          w={sampleProfile}
          onClose={()=>setDemoOverlay(null)}
          onCopy={(t)=>{ try{navigator.clipboard?.writeText(t);}catch(e){} }}
        />
      )}
      {demoOverlay === 'stats' && window.WhaleTradeStats && (
        <window.WhaleTradeStats w={sampleProfile} onClose={()=>setDemoOverlay(null)}/>
      )}

      <style>{`
        @keyframes mw-pulse {
          0%   { box-shadow: 0 0 0 0   var(--mk-up); opacity: 1; }
          70%  { box-shadow: 0 0 0 6px transparent;  opacity: 1; }
          100% { box-shadow: 0 0 0 0   transparent;  opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function HeroStat({ label, v, sub, tone }) {
  const c = tone==='up' ? M.up : tone==='dn' ? M.dn : M.text;
  return (
    <div>
      <div style={{fontSize:10, color:M.dim, letterSpacing:0.4, textTransform:'uppercase', fontWeight:600}}>{label}</div>
      <div style={{fontSize:16, fontWeight:700, color:c, fontFamily:M.mono, marginTop:3, letterSpacing:-0.3}}>{v}</div>
      <div style={{fontSize:10, color:M.faint, marginTop:2, fontFamily:M.mono}}>{sub}</div>
    </div>
  );
}

/* ---- 实时页 币种 chip 条（含搜索，对齐多空比 LSCoinTabs） ---- */
const LIVE_COINS = ['全部','BTC','ETH','SOL','HYPE','XRP','DOGE','BNB','PEPE','WIF','ARB','OP'];
const WHALE_COIN_COLOR = { BTC:'#F7931A', ETH:'#627EEA', SOL:'#9945FF', HYPE:'#16C783', XRP:'#23292F', DOGE:'#C2A633', BNB:'#F0B90B', PEPE:'#3D8E41', WIF:'#C8A06B', ARB:'#28A0F0', OP:'#FF0420' };

function WhaleCoinTabs({ value, onChange }) {
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    if (document.getElementById('whale-coin-tabs-css')) return;
    const s = document.createElement('style');
    s.id = 'whale-coin-tabs-css';
    s.textContent = '.wct-scroll::-webkit-scrollbar { display: none; }';
    document.head.appendChild(s);
  }, []);

  const renderResults = (q, pick) =>
    LIVE_COINS.filter(c => c !== '全部' && c.toLowerCase().includes(q.toLowerCase()))
      .map(c => (
        <SearchResultRow key={c} letter={c.slice(0,1)} color={WHALE_COIN_COLOR[c] || M.violet}
          title={c} sub="/ USDT" onClick={()=>pick(c)}/>
      ));

  return (
    <React.Fragment>
      <div style={{position:'relative', background:M.elev}}>
        <div className="wct-scroll" style={{
          display:'flex', alignItems:'center', gap:4,
          padding:'10px 44px 10px 12px',
          overflowX:'scroll', scrollbarWidth:'none', flexWrap:'nowrap',
        }}>
          {LIVE_COINS.map(c => {
            const on = c === value;
            return (
              <button key={c} onClick={()=>onChange(c)} style={{
                flexShrink:0, cursor:'pointer', padding:'6px 14px',
                border: on ? `1px solid ${M.violet}` : '1px solid transparent',
                background: on ? M.violetSoft : 'transparent',
                color: on ? M.violet : M.mid,
                fontSize:13, fontWeight: on?700:500,
                borderRadius:8, letterSpacing:0.3, fontFamily:M.mono,
              }}>{c}</button>
            );
          })}
        </div>
        {/* 右侧渐变 + 搜索按钮 */}
        <div style={{
          position:'absolute', right:0, top:0, bottom:0,
          display:'flex', alignItems:'center', paddingRight:8,
          background:`linear-gradient(to right, transparent, ${M.elev} 40%)`,
        }}>
          <button aria-label="搜索币种" onClick={()=>setSearching(true)} style={{
            width:32, height:32, padding:0, borderRadius:8,
            border:0, background:M.elev, color:M.mid, cursor:'pointer',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
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
        hot={LIVE_COINS.filter(c => c !== '全部')}
        onPick={onChange}
        renderResults={renderResults}
        emptyText="无匹配币种"
      />
    </React.Fragment>
  );
}

/* ---- 实时 (Live) ---- aligned to PC /zh/whale-tracking/realtime ---- */
function WhaleLive({ asset, setAsset }) {
  // 5s refresh countdown — visual only
  const [tick, setTick] = React.useState(5);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => (t <= 1 ? 5 : t - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // 胜率排序：null(不排序，按时间分组) → 'desc' 降序 → 'asc' 升序 → null
  const [winSort, setWinSort] = React.useState(null);
  const cycleSort = () =>
    setWinSort(winSort === null ? 'desc' : winSort === 'desc' ? 'asc' : null);

  // address click → 复用 发现 tab 的 WhaleProfileDetail
  const [openAddr, setOpenAddr] = React.useState(null);
  const openProfile = (w) => setOpenAddr(w.ad);
  const profileW = React.useMemo(() => {
    if (!openAddr) return null;
    const matched = (window.WHALE_PROFILES || []).find(p => p.id === openAddr);
    if (matched) return matched;
    // synthesize a minimal profile so the detail overlay still renders
    return { id: openAddr };
  }, [openAddr]);

  // 卡片点击 → 交易统计 modal
  const [statsAddr, setStatsAddr] = React.useState(null);
  const openStats = (w) => setStatsAddr(w.ad);
  const statsW = React.useMemo(() => {
    if (!statsAddr) return null;
    const matched = (window.WHALE_PROFILES || []).find(p => p.id === statsAddr);
    if (matched) return matched;
    // synthesize a minimal whale from the trade row so the modal renders without NaN
    const trade = WHALE_TRADES.find(t => t.ad === statsAddr);
    if (!trade) return { id: statsAddr, win:0, trades:0, pnl:'0', pnlPos:false };
    const pnlVal = Math.round(trade.value * (trade.win - 50) / 100);
    return {
      id: statsAddr,
      win: trade.win,
      trades: 24,
      pnl: '$' + Math.abs(pnlVal).toLocaleString('en-US'),
      pnlPos: pnlVal >= 0,
      aum: '$' + Math.round(trade.value).toLocaleString('en-US'),
      aumN: trade.value,
      tags: [trade.trader],
    };
  }, [statsAddr]);

  // copy toast
  const [toast, setToast] = React.useState(null);
  const onCopy = (text) => {
    try { navigator.clipboard?.writeText(text); } catch(e){}
    setToast('地址已复制');
    setTimeout(()=>setToast(null), 1400);
  };

  const filtered = WHALE_TRADES.filter(w => asset === '全部' || w.sym === asset);

  return (
    <React.Fragment>
      {/* 币种 chip 条（含搜索） */}
      <WhaleCoinTabs value={asset} onChange={setAsset}/>

      {/* 关注推送 + 胜率排序 + 秒后更新 — 同一行 */}
      <div style={{
        padding:'8px 16px 10px', background:M.elev,
        display:'flex', alignItems:'center', gap:8,
        borderBottom:`6px solid ${M.bg}`,
      }}>
        <button style={{
          height:30, padding:'0 12px', borderRadius:15,
          border:0, background:M.violet, color:'#fff',
          fontSize:12, fontWeight:600, cursor:'pointer',
          display:'inline-flex', alignItems:'center', gap:6,
        }}>
          <Ico d={ICONS.bell} w={13} sw={2}/>
          <span>关注币种推送</span>
        </button>
        <button
          onClick={cycleSort}
          aria-label={winSort ? `胜率${winSort === 'desc' ? '降序' : '升序'}` : '胜率不排序'}
          style={{
            height:30, padding:'0 12px', borderRadius:16,
            border:`1px solid ${winSort ? M.violet : M.border}`,
            background: winSort ? M.violetSoft : M.elev,
            color: winSort ? M.violet : M.mid,
            fontSize:12, fontWeight:600, cursor:'pointer',
            display:'inline-flex', alignItems:'center', gap:4,
          }}>
          <span>胜率</span>
          {winSort === null ? (
            <svg width="10" height="11" viewBox="0 0 10 11" fill="none" style={{opacity:0.55}}>
              <path d="M3 3.5L3 9M3 9L1.2 7.2M3 9L4.8 7.2M7 7.5L7 2M7 2L8.8 3.8M7 2L5.2 3.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : winSort === 'desc' ? (
            <svg width="9" height="11" viewBox="0 0 9 11" fill="none">
              <path d="M4.5 0v11M4.5 11L1 7.5M4.5 11L8 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="9" height="11" viewBox="0 0 9 11" fill="none">
              <path d="M4.5 11V0M4.5 0L1 3.5M4.5 0L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <span style={{
          marginLeft:'auto',
          display:'inline-flex', alignItems:'center', gap:6, fontSize:11,
          color:M.mid, fontFamily:M.mono,
        }}>
          <span style={{
            width:6, height:6, borderRadius:3, background:M.up,
            animation:'mw-pulse 1.6s ease-out infinite',
          }}/>
          <span><span style={{color:M.text, fontWeight:600}}>{tick}</span> 秒后更新</span>
        </span>
      </div>

      {/* PC-aligned trade rows — time-grouped on mobile for scannability */}
      <div style={{background:M.bg, padding:'4px 0 8px'}}>
        {winSort ? (
          // 排序模式：扁平展示
          <React.Fragment>
            <div style={{
              padding:'12px 16px 8px',
              display:'flex', alignItems:'center', gap:8,
              fontSize:11, color:M.dim, fontWeight:600,
              letterSpacing:0.4, textTransform:'uppercase',
            }}>
              <span>按胜率{winSort === 'desc' ? '降序' : '升序'}</span>
              <span style={{flex:1, height:1, background:M.borderSoft}}/>
              <span style={{fontFamily:M.mono, color:M.mid}}>{filtered.length}</span>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:8, padding:'0 16px'}}>
              {[...filtered]
                .sort((a,b) => winSort === 'desc' ? b.win - a.win : a.win - b.win)
                .map((w,i) => <WhaleRow key={i} w={w} onOpen={openProfile} onStats={openStats} onCopy={onCopy}/>)}
            </div>
          </React.Fragment>
        ) : (
          GROUPS.map(g => {
            const rows = filtered.filter(w => w.tg === g.k);
            if (!rows.length) return null;
            return (
              <React.Fragment key={g.k}>
                <div style={{
                  padding:'14px 16px 8px',
                  display:'flex', alignItems:'center', gap:8,
                  fontSize:11, color:M.dim, fontWeight:600,
                  letterSpacing:0.4, textTransform:'uppercase',
                }}>
                  <span>{g.label}</span>
                  <span style={{flex:1, height:1, background:M.borderSoft}}/>
                  <span style={{fontFamily:M.mono, color:M.mid}}>{rows.length}</span>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:8, padding:'0 16px'}}>
                  {rows.map((w, i) => <WhaleRow key={i} w={w} onOpen={openProfile} onStats={openStats} onCopy={onCopy}/>)}
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* address detail overlay — same as 发现 tab */}
      {profileW && window.WhaleProfileDetail && (
        <window.WhaleProfileDetail
          w={profileW}
          onClose={()=>setOpenAddr(null)}
          onCopy={(t)=>{ try{navigator.clipboard?.writeText(t);}catch(e){} }}
        />
      )}
      {statsW && window.WhaleTradeStats && (
        <window.WhaleTradeStats w={statsW} onClose={()=>setStatsAddr(null)}/>
      )}

      {toast && (
        <div style={{
          position:'absolute', bottom:120, left:'50%', transform:'translateX(-50%)',
          background:'rgba(15,11,34,0.92)', color:'#fff',
          padding:'8px 16px', borderRadius:999, fontSize:12,
          zIndex:80, pointerEvents:'none', fontFamily:'inherit',
        }}>{toast}</div>
      )}
    </React.Fragment>
  );
}

/* ---- 发现 (Discover) ---- */
const SMART_MONEY = [
  { rk:1, ad:'0x88e…3a01', tag:'机构',     pnl:'+$8.4M', win:78, sym:'BTC · ETH' },
  { rk:2, ad:'0x4a1…ff2d', tag:'聪明钱',   pnl:'+$5.2M', win:71, sym:'SOL · AVAX' },
  { rk:3, ad:'0xb2e…91d7', tag:'长期持有', pnl:'+$3.8M', win:66, sym:'BTC' },
  { rk:4, ad:'0x7c1…44a3', tag:'聪明钱',   pnl:'+$2.9M', win:69, sym:'ETH' },
  { rk:5, ad:'0x9e2…cd44', tag:'新地址',   pnl:'+$1.4M', win:62, sym:'PEPE · WIF' },
];
const TRENDING = [
  { sym:'BTC',  net:'+$284M', pct:'+18%', tone:'up', n:42, c:'#F7931A' },
  { sym:'ETH',  net:'+$118M', pct:'+9%',  tone:'up', n:28, c:'#627EEA' },
  { sym:'HYPE', net:'+$22M',  pct:'+12%', tone:'up', n:8,  c:'#22D3EE' },
  { sym:'SOL',  net:'-$42M',  pct:'-4%',  tone:'dn', n:11, c:'#9945FF' },
];
function WhaleDiscover() {
  return (
    <React.Fragment>
      <div style={{padding:'14px 16px 6px', background:M.elev}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
          <div>
            <div style={{fontSize:15, fontWeight:700, color:M.text, letterSpacing:-0.2}}>聪明钱榜</div>
            <div style={{fontSize:11, color:M.dim, marginTop:2}}>过去 7 日盈利前 5 · 链上 + 交易所合并</div>
          </div>
          <span style={{fontSize:11, color:M.violet, fontWeight:600, cursor:'pointer'}}>查看全部 ›</span>
        </div>
        <div style={{border:`1px solid ${M.borderSoft}`, borderRadius:12, overflow:'hidden'}}>
          {SMART_MONEY.map((s, i) => (
            <div key={s.ad} style={{
              display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
              borderBottom: i === SMART_MONEY.length - 1 ? 0 : `1px solid ${M.borderSoft}`,
            }}>
              <div style={{
                width:24, height:24, borderRadius:12,
                background: s.rk <= 3 ? M.violetSoft : M.soft,
                color: s.rk <= 3 ? M.violet : M.mid,
                fontSize:12, fontWeight:700, fontFamily:M.mono,
                display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0,
              }}>{s.rk}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', alignItems:'center', gap:6}}>
                  <span style={{fontSize:13, fontWeight:600, color:M.text, fontFamily:M.mono}}>{s.ad}</span>
                  <span style={{
                    fontSize:10, padding:'2px 6px', borderRadius:4,
                    color:(TAG_STYLE[s.tag]||{}).fg || M.mid,
                    background:(TAG_STYLE[s.tag]||{}).bg || M.soft,
                    fontWeight:600,
                  }}>{s.tag}</span>
                </div>
                <div style={{fontSize:11, color:M.dim, marginTop:3}}>主要持仓 · {s.sym}</div>
              </div>
              <div style={{textAlign:'right', flexShrink:0, minWidth:74}}>
                <div style={{fontSize:13, fontWeight:700, color:M.up, fontFamily:M.mono}}>{s.pnl}</div>
                <div style={{fontSize:10, color:M.dim, marginTop:2, fontFamily:M.mono}}>胜率 {s.win}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:'18px 16px 8px', background:M.elev}}>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10}}>
          <div style={{fontSize:15, fontWeight:700, color:M.text, letterSpacing:-0.2}}>趋势资产</div>
          <span style={{fontSize:11, color:M.dim}}>巨鲸 7D 净增持</span>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
          {TRENDING.map(t => (
            <div key={t.sym} style={{
              border:`1px solid ${M.borderSoft}`, borderRadius:12, padding:'12px',
              background:M.elev,
            }}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                <div style={{
                  width:22, height:22, borderRadius:11, background:t.c, color:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10, fontWeight:700,
                }}>{t.sym[0]}</div>
                <span style={{fontSize:13, fontWeight:600, color:M.text}}>{t.sym}</span>
                <div style={{flex:1}}/>
                <span style={{fontSize:11, color: t.tone==='up' ? M.up : M.dn, fontFamily:M.mono, fontWeight:600}}>{t.pct}</span>
              </div>
              <div style={{fontSize:16, fontWeight:700, color: t.tone==='up' ? M.up : M.dn, fontFamily:M.mono, letterSpacing:-0.3}}>{t.net}</div>
              <div style={{fontSize:10, color:M.dim, marginTop:3, fontFamily:M.mono}}>{t.n} 个巨鲸参与</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:'18px 16px 8px', background:M.elev}}>
        <div style={{fontSize:15, fontWeight:700, color:M.text, letterSpacing:-0.2, marginBottom:10}}>新晋巨鲸</div>
        <div style={{
          border:`1px solid ${M.borderSoft}`, borderRadius:12, padding:'14px',
          display:'flex', alignItems:'center', gap:12,
        }}>
          <div style={{
            width:40, height:40, borderRadius:10, background:M.violetSoft, color:M.violet,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <Ico d={ICONS.spark} w={20}/>
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13, fontWeight:600, color:M.text}}>过去 24H 出现 6 个新巨鲸</div>
            <div style={{fontSize:11, color:M.dim, marginTop:3}}>累计净增持 1,840 BTC · 平均建仓 $42M</div>
          </div>
          <Ico d={ICONS.caretR} w={16}/>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---- 持仓 (Holdings) ---- aligned to PC /zh/whale-tracking/holdings ---- */
/* PC 字段：地址 + 币种 + 全仓 + 杠杆 + 持仓价值 + 数量 + 未实现盈亏 + 保证金 + 开盘价 + 清算价 + 创建时间 */
const WHALE_HOLDINGS = [
  { ad:'0xa5b0…1d41', sym:'ETH',  mode:'全仓', side:'long',  lev:15, value:154806488.12, qty:'70000.67 ETH',    pnl:4395660,  pnlPct:42.59,  margin:15480648.81, open:2148.7,  liq:1631.15,  time:'1120 小时前' },
  { ad:'0x6c85…84f6', sym:'ETH',  mode:'全仓', side:'long',  lev:20, value:110580013.05, qty:'50000.01 ETH',    pnl:9974240,  pnlPct:180.40, margin:11058001.3,  open:2012.11, liq:1460.54,  time:'1120 小时前' },
  { ad:'0x94d3…3814', sym:'BTC',  mode:'全仓', side:'short', lev:40, value:87096799.14,  qty:'1207.97 BTC',     pnl:-3215705, pnlPct:-147.68,margin:8709679.91,  open:69439.9, liq:78246.99, time:'1120 小时前' },
  { ad:'0x0ddf…a902', sym:'BTC',  mode:'全仓', side:'short', lev:3,  value:72102000,     qty:'1000.00 BTC',     pnl:-4109869, pnlPct:-17.10, margin:7210200,     open:67992.1, liq:102591.73,time:'1120 小时前' },
  { ad:'0x082e…ca88', sym:'HYPE', mode:'全仓', side:'long',  lev:5,  value:56567948.63,  qty:'1380042.66 HYPE', pnl:3194019,  pnlPct:28.23,  margin:5656794.86,  open:38.68,   liq:30.4,     time:'1120 小时前' },
  { ad:'0xa183…0482', sym:'BTC',  mode:'全仓', side:'long',  lev:15, value:46294863.15,  qty:'642.08 BTC',      pnl:1513614,  pnlPct:49.04,  margin:4629486.32,  open:69743.6, liq:64742.55, time:'1120 小时前' },
  { ad:'0x7fda…17d1', sym:'ETH',  mode:'全仓', side:'short', lev:15, value:46282925.83,  qty:'20930.19 ETH',    pnl:-2687571, pnlPct:-87.10, margin:4628292.58,  open:2082.89, liq:2943.5,   time:'1120 小时前' },
  { ad:'0xeadc…9d55', sym:'BTC',  mode:'全仓', side:'long',  lev:20, value:36051000,     qty:'500.00 BTC',      pnl:206164,   pnlPct:11.44,  margin:3605100,     open:71689.6, liq:23041.92, time:'1120 小时前' },
  { ad:'0x218a…7da2', sym:'ETH',  mode:'全仓', side:'short', lev:10, value:35937331.2,   qty:'16252.41 ETH',    pnl:-2793047, pnlPct:-77.72, margin:3593733.12,  open:2039.34, liq:2586.85,  time:'1120 小时前' },
  { ad:'0x4a20…3c26', sym:'ETH',  mode:'全仓', side:'long',  lev:20, value:32824500,     qty:'15000.00 ETH',    pnl:376395,   pnlPct:22.93,  margin:3282450,     open:2213.39, liq:2582.64,  time:'1145 小时前' },
  { ad:'0xfd42…3d97', sym:'BTC',  mode:'全仓', side:'long',  lev:20, value:32443650,     qty:'450.00 BTC',      pnl:1044474,  pnlPct:64.39,  margin:3244365,     open:69775.9, liq:51152.13, time:'1120 小时前' },
  { ad:'0xd475…1a91', sym:'ETH',  mode:'全仓', side:'short', lev:15, value:30596060.04,  qty:'13834.98 ETH',    pnl:-779951,  pnlPct:-38.24, margin:3059606,     open:2155.12, liq:3447.63,  time:'1120 小时前' },
];

const DIR_OPTS = [
  { v:'全部',  l:'所有方向' },
  { v:'long',  l:'做多' },
  { v:'short', l:'做空' },
];
const PNL_OPTS = [
  { v:'全部',   l:'所有未实现盈亏' },
  { v:'profit', l:'盈利' },
  { v:'loss',   l:'亏损' },
];

function WhaleHoldings() {
  // PC 顶部筛选：币种 / 方向 / 未实现盈亏  (全部下拉式)
  const [coin, setCoin] = React.useState('全部');
  const [dir,  setDir]  = React.useState('全部');     // '全部' | 'long' | 'short'
  const [pnlFlt, setPnlFlt] = React.useState('全部'); // '全部' | 'profit' | 'loss'
  const [filterOpen, setFilterOpen] = React.useState(null); // 'dir' | 'pnl' | null

  // 排序 — key 直接对应数值字段; 由「更多排序」抽屉设置
  const [sort, setSort] = React.useState({ key:null, dir:null }); // value|pnl|pnlPct|lev|margin|open|liq

  // address click → 详情
  const [openAddr, setOpenAddr] = React.useState(null);
  const openProfile = (w) => setOpenAddr(w.ad);
  const profileW = React.useMemo(() => {
    if (!openAddr) return null;
    return (window.WHALE_PROFILES || []).find(p => p.id === openAddr) || { id: openAddr };
  }, [openAddr]);

  // card body click → 交易统计
  const [statsAddr, setStatsAddr] = React.useState(null);
  const openStats = (w) => setStatsAddr(w.ad);
  const statsW = React.useMemo(() => {
    if (!statsAddr) return null;
    const matched = (window.WHALE_PROFILES || []).find(p => p.id === statsAddr);
    if (matched) return matched;
    const h = WHALE_HOLDINGS.find(t => t.ad === statsAddr);
    if (!h) return { id: statsAddr, win:0, trades:0, pnl:'0', pnlPos:false };
    return {
      id: statsAddr,
      win: Math.max(0, Math.min(100, 50 + Math.round(h.pnlPct / 4))),
      trades: 24,
      pnl: '$' + Math.abs(Math.round(h.pnl)).toLocaleString('en-US'),
      pnlPos: h.pnl >= 0,
      aum: '$' + Math.round(h.value).toLocaleString('en-US'),
      aumN: h.value,
      tags: ['巨鲸'],
    };
  }, [statsAddr]);

  let rows = WHALE_HOLDINGS;
  if (coin !== '全部') rows = rows.filter(r => r.sym === coin);
  if (dir  !== '全部') rows = rows.filter(r => r.side === dir);
  if (pnlFlt === 'profit') rows = rows.filter(r => r.pnl >= 0);
  if (pnlFlt === 'loss')   rows = rows.filter(r => r.pnl <  0);
  if (sort.key && sort.dir) {
    // key === 数值字段名; 创建时间为字符串("1120 小时前")需解析前导数字
    const num = (h) => sort.key === 'time' ? parseFloat(String(h.time)) || 0 : h[sort.key];
    rows = [...rows].sort((a, b) => num(a) - num(b));
    if (sort.dir === 'desc') rows.reverse();
  }

  // copy toast
  const [toast, setToast] = React.useState(null);
  const onCopy = (text) => {
    try { navigator.clipboard?.writeText(text); } catch(e){}
    setToast('地址已复制');
    setTimeout(()=>setToast(null), 1400);
  };

  return (
    <React.Fragment>
      {/* 币种 chip 条（含搜索） */}
      <WhaleCoinTabs value={coin} onChange={setCoin}/>

      {/* 筛选 + 排序 工具条 — 方向/盈亏 筛选 (左) + 更多排序 (右) */}
      <div style={{
        display:'flex', alignItems:'center', gap:16,
        padding:'2px 16px 12px', background:M.elev,
        borderBottom:`6px solid ${M.bg}`,
      }}>
        <WhaleFilterLabel placeholder="方向" options={DIR_OPTS} value={dir}    onClick={()=>setFilterOpen('dir')}/>
        <WhaleFilterLabel placeholder="盈亏" options={PNL_OPTS} value={pnlFlt} onClick={()=>setFilterOpen('pnl')}/>
        <div style={{flex:1}}/>
        <WhaleMoreSort sort={sort} onSet={setSort} opts={[
          {k:'value',  label:'持仓价值'},
          {k:'margin', label:'保证金'},
          {k:'time',   label:'创建时间'},
        ]}/>
      </div>

      {/* holdings cards */}
      <div style={{background:M.bg, padding:'10px 0 12px'}}>
        <div style={{
          padding:'2px 16px 8px',
          display:'flex', alignItems:'center', gap:8,
          fontSize:11, color:M.dim, fontWeight:600,
          letterSpacing:0.4, textTransform:'uppercase',
        }}>
          <span>巨鲸持仓</span>
          <span style={{flex:1, height:1, background:M.borderSoft}}/>
          <span style={{fontFamily:M.mono, color:M.mid}}>{rows.length}</span>
        </div>
        {rows.length === 0 ? (
          <div style={{
            padding:'40px 16px', textAlign:'center',
            fontSize:12, color:M.dim,
          }}>无匹配持仓</div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:8, padding:'0 16px'}}>
            {rows.map((h, i) => (
              <WhaleHoldingCard key={i} h={h} onOpen={openProfile} onStats={openStats} onCopy={onCopy}/>
            ))}
          </div>
        )}
      </div>

      {/* overlays */}
      {profileW && window.WhaleProfileDetail && (
        <window.WhaleProfileDetail
          w={profileW}
          onClose={()=>setOpenAddr(null)}
          onCopy={(t)=>{ try{navigator.clipboard?.writeText(t);}catch(e){} }}
        />
      )}
      {statsW && window.WhaleTradeStats && (
        <window.WhaleTradeStats w={statsW} onClose={()=>setStatsAddr(null)}/>
      )}

      {toast && (
        <div style={{
          position:'absolute', bottom:120, left:'50%', transform:'translateX(-50%)',
          background:'rgba(15,11,34,0.92)', color:'#fff',
          padding:'8px 16px', borderRadius:999, fontSize:12,
          zIndex:80, pointerEvents:'none', fontFamily:'inherit',
        }}>{toast}</div>
      )}

      {/* ─── 筛选 — bottom drawer (方向 / 盈亏) ─── */}
      {filterOpen && (() => {
        const cfg = filterOpen === 'dir'
          ? { title:'持仓方向', options:DIR_OPTS, value:dir,    onChange:setDir }
          : { title:'未实现盈亏', options:PNL_OPTS, value:pnlFlt, onChange:setPnlFlt };
        return (
          <div
            onClick={()=>setFilterOpen(null)}
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
                animation:'m-slide-up .26s cubic-bezier(.2,.8,.2,1)',
              }}>
              <div style={{width:42, height:4, borderRadius:2, background:M.border, margin:'10px auto 0'}}/>
              <div style={{padding:'12px 16px 6px', fontSize:14, fontWeight:700, color:M.text}}>
                {cfg.title}
              </div>
              <div style={{padding:'0 8px 6px'}}>
                {cfg.options.map(o => {
                  const on = o.v === cfg.value;
                  return (
                    <button
                      key={o.v}
                      onClick={()=>{ cfg.onChange(o.v); setFilterOpen(null); }}
                      style={{
                        display:'flex', alignItems:'center', gap:11,
                        width:'100%', padding:'12px 12px',
                        border:0, background:'transparent', cursor:'pointer',
                        fontFamily:'inherit', textAlign:'left',
                      }}>
                      <span style={{
                        flex:1, fontSize:14, fontWeight:600,
                        color: on ? M.violet : M.text,
                      }}>{o.l}</span>
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
                <button onClick={()=>setFilterOpen(null)} style={{
                  width:'100%', height:46, border:0, cursor:'pointer',
                  background:'transparent', color:M.text,
                  fontSize:14, fontWeight:600, fontFamily:'inherit',
                }}>取消</button>
              </div>
            </div>
          </div>
        );
      })()}
    </React.Fragment>
  );
}

/* ---- 内联筛选标签 — 取代下拉胶囊, 点击打开底部抽屉 (方向/盈亏); 选中后显示当前值并高亮 ---- */
function WhaleFilterLabel({ placeholder, options, value, onClick }) {
  const active = value !== '全部';
  const cur = options.find(o => o.v === value);
  const text = active && cur ? cur.l : placeholder;
  return (
    <span onClick={onClick} style={{
      fontSize:11.5, color: active ? M.violet : M.dim, fontWeight: active ? 600 : 500,
      whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:3,
      cursor:'pointer', userSelect:'none', WebkitTapHighlightColor:'transparent',
    }}>
      {text}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.7}}>
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </span>
  );
}

/* ---- 更多排序 — 底部抽屉: 指标 pills + 排序方式 (对齐「最近成交」更多排序) ---- */
function WhaleMoreSort({ sort, onSet, opts }) {
  const [open, setOpen] = React.useState(false);
  const active = opts.some(o => o.k === sort.key) && sort.dir;
  const pickField = (k) => onSet({ key:k, dir: sort.dir || 'desc' });
  const pickDir = (dir) => {
    if (dir == null) { onSet({ key:null, dir:null }); return; }
    onSet({ key: sort.key || opts[0].k, dir });
  };
  return (
    <React.Fragment>
      <span onClick={()=>setOpen(true)} style={{
        fontSize:11.5, color: active ? M.violet : M.dim, fontWeight: active ? 600 : 500,
        whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:3,
        cursor:'pointer', userSelect:'none', WebkitTapHighlightColor:'transparent',
      }}>
        更多排序
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{opacity:0.7, transform: open ? 'rotate(180deg)' : 'none', transition:'transform 160ms'}}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </span>
      {open && (
        <div onClick={()=>setOpen(false)} style={{
          position:'absolute', inset:0, zIndex:90,
          background:'rgba(15,11,34,0.55)', animation:'m-fade-in .18s ease-out',
        }}>
          <div onClick={(e)=>e.stopPropagation()} style={{
            position:'absolute', left:0, right:0, bottom:0,
            background:M.elev, borderRadius:'20px 20px 0 0',
            boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
            padding:'0 20px calc(28px + env(safe-area-inset-bottom))',
            animation:'m-slide-up .26s cubic-bezier(.2,.8,.2,1)',
          }}>
            <div style={{width:42, height:4, borderRadius:2, background:M.border, margin:'10px auto 14px'}}/>
            <div style={{fontSize:14, fontWeight:700, marginBottom:12, color:M.text}}>更多排序</div>

            {/* 指标 — pills */}
            <div style={{fontSize:11, color:M.mid, marginBottom:6}}>指标</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:16}}>
              {opts.map(o => {
                const on = sort.key === o.k;
                return (
                  <button key={o.k} onClick={()=>pickField(o.k)} style={{
                    height:30, padding:'0 14px', borderRadius:999, fontSize:12,
                    fontWeight: on ? 600 : 500, whiteSpace:'nowrap',
                    background: on ? M.violet : M.soft, color: on ? '#fff' : M.text,
                    border:0, cursor:'pointer', fontFamily:'inherit',
                  }}>{o.label}</button>
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
                const on = (d.k == null) ? !sort.dir : sort.dir === d.k;
                return (
                  <button key={String(d.k)} onClick={()=>pickDir(d.k)} style={{
                    height:40, borderRadius:10, padding:'0 8px',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    fontSize:12.5, fontWeight: on ? 600 : 500, fontFamily:'inherit', whiteSpace:'nowrap',
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

            <button onClick={()=>setOpen(false)} style={{
              width:'100%', height:46, marginTop:16, borderRadius:12, border:0,
              background:M.violetGrad, color:'#fff', fontSize:14, fontWeight:600,
              boxShadow:'0 6px 20px rgba(124,92,255,0.32)', cursor:'pointer', fontFamily:'inherit',
            }}>完成</button>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

function WhaleHoldingCard({ h, onOpen, onStats, onCopy }) {
  const isLong = h.side === 'long';
  const sideColor = isLong ? M.up : M.dn;
  const sideSoft  = isLong ? M.upSoft : M.dnSoft;
  const pnlPos = h.pnl >= 0;
  const pnlColor = pnlPos ? M.up : M.dn;
  const symColor = SYM_COLOR[h.sym] || M.mid;
  const handleStats = () => onStats && onStats(h);
  const handleProfile = (e) => { e.stopPropagation(); onOpen && onOpen(h); };
  const handleCopy = (e) => {
    e.stopPropagation();
    if (onCopy) onCopy(h.ad);
    else { try{navigator.clipboard?.writeText(h.ad);}catch(err){} }
  };

  return (
    <div
      onClick={handleStats}
      style={{
        padding:'12px 14px 12px',
        borderRadius:14,
        background:M.elev,
        border:`1px solid ${M.borderSoft}`,
        boxShadow:'0 1px 2px rgba(15,23,42,0.03)',
        cursor:'pointer',
      }}>
      {/* Row 1 — 地址 + 巨鲸标签 / 时间 + 操作 */}
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <span
          onClick={handleProfile}
          style={{
            display:'inline-flex', alignItems:'center', gap:3,
            fontSize:13, fontWeight:600, color:M.violet, fontFamily:M.mono,
            letterSpacing:-0.2,
            borderBottom:`1px dashed ${M.violet}66`,
            padding:'1px 0', cursor:'pointer',
          }}>
          <span>{h.ad}</span>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.7}}>
            <path d="M9 6l6 6-6 6"/>
          </svg>
        </span>
        <button
          aria-label="复制地址"
          onClick={handleCopy}
          style={{
            width:20, height:20, padding:0, borderRadius:5,
            border:0, background:'transparent', color:M.mid, cursor:'pointer',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
          }}>
          <Ico d={ICONS.copy} w={12} sw={1.6}/>
        </button>
        <span style={{
          fontSize:10, padding:'2px 7px', borderRadius:4,
          color:M.violet, background:M.violetSoft,
          fontWeight:600, letterSpacing:0.2,
        }}>巨鲸</span>
        <span style={{
          marginLeft:'auto', fontSize:11, color:M.dim, fontFamily:M.mono,
          whiteSpace:'nowrap',
        }}>{h.time}</span>
        <button
          aria-label="查看 K 线"
          onClick={(e)=>{ e.stopPropagation(); handleStats(); }}
          style={{
            width:24, height:24, padding:0, borderRadius:6,
            border:`1px solid ${M.borderSoft}`, background:M.elev,
            color:M.mid, cursor:'pointer',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
          }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M2 11l3-4 2.5 2 4-6M11.5 3H13v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Row 2 — 币种 · 全仓 · 多/空 · 杠杆 */}
      <div style={{display:'flex', alignItems:'center', gap:6, marginTop:8}}>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:5,
          height:22, padding:'0 8px', borderRadius:11,
          background:M.soft, fontSize:11, fontWeight:600, color:M.text,
        }}>
          <span style={{width:6, height:6, borderRadius:3, background:symColor}}/>
          {h.sym}
        </span>
        <span style={{fontSize:11, color:M.mid, fontWeight:500}}>{h.mode}</span>
        <span style={{
          marginLeft:'auto',
          display:'inline-flex', alignItems:'center',
          height:22, padding:'0 10px', borderRadius:11,
          background:sideSoft, color:sideColor,
          fontSize:11, fontWeight:700, letterSpacing:0.4,
          border:`1px solid ${sideColor}33`,
        }}>{isLong ? '做多' : '做空'}</span>
        <span style={{
          fontSize:11, color:M.text, fontFamily:M.mono, fontWeight:700,
          minWidth:28, textAlign:'right',
        }}>{h.lev}x</span>
      </div>

      {/* Row 3 — 持仓价值 + 未实现盈亏 (2-col headline) */}
      <div style={{
        display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:10,
        marginTop:10, paddingTop:10, borderTop:`1px dashed ${M.borderSoft}`,
      }}>
        <div>
          <div style={{fontSize:10, color:M.dim, letterSpacing:0.3, fontWeight:600}}>持仓价值</div>
          <div style={{
            fontSize:15, fontWeight:700, color:M.text, fontFamily:M.mono,
            marginTop:2, letterSpacing:-0.3, whiteSpace:'nowrap',
          }}>{fmtUsd(h.value)}</div>
          <div style={{
            fontSize:10, color:M.dim, fontFamily:M.mono, marginTop:1, whiteSpace:'nowrap',
          }}>{h.qty}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:10, color:M.dim, letterSpacing:0.3, fontWeight:600}}>未实现盈亏</div>
          <div style={{
            fontSize:15, fontWeight:700, color:pnlColor, fontFamily:M.mono,
            marginTop:2, letterSpacing:-0.3, whiteSpace:'nowrap',
          }}>{pnlPos ? '+' : '−'}{fmtUsd(Math.abs(h.pnl))}</div>
          <div style={{
            fontSize:10, color:pnlColor, fontFamily:M.mono, marginTop:1, fontWeight:600,
          }}>{pnlPos ? '+' : ''}{h.pnlPct.toFixed(2)}%</div>
        </div>
      </div>

      {/* Row 4 — 保证金 / 开盘价 / 清算价 */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8,
        marginTop:10, paddingTop:8, borderTop:`1px solid ${M.borderSoft}`,
      }}>
        <HoldingMicro label="保证金"  v={fmtUsd(h.margin)} align="left"/>
        <HoldingMicro label="开盘价"  v={fmtPrice(h.open)} align="center"/>
        <HoldingMicro label="清算价"  v={fmtPrice(h.liq)} align="right" tone={h.liq && h.open && (isLong ? h.liq < h.open : h.liq > h.open) ? 'dn' : null}/>
      </div>
    </div>
  );
}

function HoldingMicro({ label, v, tone, align = 'left' }) {
  const c = tone === 'up' ? M.up : tone === 'dn' ? M.dn : M.text;
  return (
    <div style={{minWidth:0, textAlign:align}}>
      <div style={{fontSize:10, color:M.dim, letterSpacing:0.3, fontWeight:600}}>{label}</div>
      <div style={{
        fontSize:12, fontWeight:600, color:c, fontFamily:M.mono, marginTop:2,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
      }}>{v}</div>
    </div>
  );
}

/* ---- 监控 (Watch) ---- aligned to PC /zh/whale-tracking/notifications ---- */
/* 三大块：监控地址 / 实时巨鲸推送 / 通知中心
   监控地址数据对齐 PC /zh/whale-tracking/notifications：
   字段 = 别名 + 永续合约总价值 + 未实现盈亏 + 可用保证金 + 保证金使用率 + 持仓
   未交易/0 仓位 地址用 null 表示 → 渲染为 "-" */
const WATCH_ADDRS = [
  { ad:'0xecb6…2b00', fullAd:'0xecb63caa47c7c4e77f60f1ce858cf28dc2b82b00', alias:"q'we",     perpValue:80_120_000, unrealizedPnl:1_880_000,  availMargin:8_870_000, marginUsage:32, positions:84, live:true,  muted:false, threshold:500000 },
  { ad:'0xbc92…5f2a', fullAd:'0xbc927e87a5b9c4d1e2f3a4b5c6d7e8f9a0b15f2a', alias:'挨打的',    perpValue:1_430_000,  unrealizedPnl:2_674.02,   availMargin:529_500,   marginUsage:18, positions:25, live:false, muted:false, threshold:200000 },
  { ad:'0xbbfb…f921', fullAd:'0xbbfb656612345678abcdef9876543210fedcf921', alias:'ahashdah', perpValue:null,       unrealizedPnl:null,       availMargin:null,      marginUsage:null, positions:null, live:false, muted:true, threshold:100000 },
  { ad:'0xd859…453f', fullAd:'0xd8592afca1b2c3d4e5f60718293a4b5c6d7e8453f', alias:'我的',      perpValue:0,          unrealizedPnl:0,           availMargin:0,         marginUsage:0,  positions:0,  live:false, muted:false, threshold:500000 },
];

/* compact USD formatter for the watch-list (large numbers → $80.12M, small → $529.5K) */
function fmtWatchUsd(n) {
  if (n == null) return '-';
  if (n === 0) return '$ 0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return '$ ' + (n/1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (abs >= 1_000)     return '$ ' + (n/1_000).toFixed(1).replace(/\.?0+$/, '') + 'K';
  return '$ ' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
function fmtWatchPnl(n) {
  if (n == null) return '-';
  if (n === 0)  return '$ 0';
  const abs = Math.abs(n);
  const sign = n > 0 ? '+' : '-';
  if (abs >= 1_000_000) return sign + '$' + (abs/1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (abs >= 1_000)     return sign + '$' + (abs/1_000).toFixed(1).replace(/\.?0+$/, '') + 'K';
  return sign + '$' + abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function WhaleWatch() {
  // 4 秒刷新倒计时
  const [tick, setTick] = React.useState(4);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => (t <= 1 ? 4 : t - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // 推送筛选：币种 + 最小持仓阈值
  const [coin, setCoin] = React.useState('BTC');
  const [threshold, setThreshold] = React.useState('500000');
  const thrNum = parseFloat((threshold || '0').replace(/[^0-9.]/g,'')) || 0;

  // 监控地址 + 通知数据
  const [addrs, setAddrs] = React.useState(WATCH_ADDRS);
  const [notifData, setNotifData] = React.useState(WHALE_NOTIFS);
  const unread = notifData.filter(n => n.unread).length;
  const markAllRead = () => setNotifData(notifData.map(n => ({...n, unread:false})));

  // overlays
  const [openAddr, setOpenAddr] = React.useState(null);
  const openProfile = (ad) => setOpenAddr(ad);
  const profileW = React.useMemo(() => {
    if (!openAddr) return null;
    return (window.WHALE_PROFILES || []).find(p => p.id === openAddr) || { id: openAddr };
  }, [openAddr]);

  const [statsAddr, setStatsAddr] = React.useState(null);
  const openStats = (w) => setStatsAddr(w.ad);
  const statsW = React.useMemo(() => {
    if (!statsAddr) return null;
    const matched = (window.WHALE_PROFILES || []).find(p => p.id === statsAddr);
    if (matched) return matched;
    // 监控地址列表里的行 → 用其 perp / pnl 数据构造 stats whale
    const watch = addrs.find(a => a.ad === statsAddr);
    if (watch) {
      const pnlPos = (watch.unrealizedPnl ?? 0) >= 0;
      const pnlAbs = Math.abs(watch.unrealizedPnl ?? 0);
      return {
        id: watch.ad,
        // 用持仓数 × 1.2 估算交易笔数；胜率从未实现盈亏推断
        win: pnlPos ? 62 + Math.min(15, (pnlAbs / 1_000_000) * 5) : 38,
        trades: Math.max(8, Math.round((watch.positions || 0) * 1.2)),
        pnl: '$' + pnlAbs.toLocaleString('en-US', {maximumFractionDigits: pnlAbs > 1000 ? 0 : 2}),
        pnlPos,
        aum: '$' + (watch.perpValue || 0).toLocaleString('en-US'),
        aumN: watch.perpValue || 0,
        tags: watch.alias ? [watch.alias] : [],
      };
    }
    const trade = WHALE_TRADES.find(t => t.ad === statsAddr);
    if (!trade) return { id: statsAddr, win:0, trades:0, pnl:'0', pnlPos:false };
    const pnlVal = Math.round(trade.value * (trade.win - 50) / 100);
    return {
      id: statsAddr, win: trade.win, trades: 24,
      pnl: '$' + Math.abs(pnlVal).toLocaleString('en-US'),
      pnlPos: pnlVal >= 0,
      aum: '$' + Math.round(trade.value).toLocaleString('en-US'),
      aumN: trade.value, tags:[trade.trader],
    };
  }, [statsAddr, addrs]);

  // copy toast
  const [toast, setToast] = React.useState(null);
  const onCopy = (text) => {
    try { navigator.clipboard?.writeText(text); } catch(e){}
    setToast('地址已复制');
    setTimeout(()=>setToast(null), 1400);
  };

  // filtered realtime push feed
  const feed = WHALE_TRADES.filter(t =>
    (coin === '全部' || t.sym === coin) && t.value >= thrNum
  );

  const removeAddr = (ad) => setAddrs(addrs.filter(a => a.ad !== ad));
  const toggleMute = (ad) => setAddrs(addrs.map(a => a.ad === ad ? {...a, muted:!a.muted} : a));

  // 删除确认弹层
  const [pendingRemove, setPendingRemove] = React.useState(null);
  const confirmRemove = () => {
    if (pendingRemove) {
      removeAddr(pendingRemove.ad);
      setToast('监控已移除');
      setTimeout(()=>setToast(null), 1400);
    }
    setPendingRemove(null);
  };

  // 创建/编辑 监控弹层
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createPrefill, setCreatePrefill] = React.useState(null);
  const [editingAddr, setEditingAddr] = React.useState(null);
  const openCreate = (prefill) => { setEditingAddr(null); setCreatePrefill(prefill || null); setCreateOpen(true); };
  const openEdit   = (a)       => { setCreatePrefill(null); setEditingAddr(a); setCreateOpen(true); };
  const handleSubmit = (data) => {
    if (data.mode === 'edit' && data.original) {
      // update existing — keep metrics, swap addr / alias / threshold / channels
      const short = data.addr.length > 12
        ? `${data.addr.slice(0,6)}…${data.addr.slice(-4)}`
        : data.addr;
      setAddrs(addrs.map(a => a.ad === data.original.ad ? {
        ...a,
        ad: short,
        fullAd: data.addr,
        alias: data.alias,
        threshold: data.threshold,
        channels: data.channels,
      } : a));
      setToast('监控已更新');
    } else {
      // create new
      const short = data.addr.length > 12
        ? `${data.addr.slice(0,6)}…${data.addr.slice(-4)}`
        : data.addr;
      setAddrs([
        { ad: short, fullAd: data.addr, alias: data.alias,
          perpValue: 0, unrealizedPnl: 0, availMargin: 0,
          marginUsage: 0, positions: 0, live: true, muted: false,
          threshold: data.threshold, channels: data.channels },
        ...addrs,
      ]);
      setSubTab('监控地址');
      setToast('监控已创建');
    }
    setTimeout(()=>setToast(null), 1400);
  };

  // 子 tab — 用户指定顺序: 实时巨鲸 → 监控地址 → 通知中心
  const [subTab, setSubTab] = React.useState('实时巨鲸');
  const SUB_TABS = [
    { k:'实时巨鲸', cnt: feed.length,    dot:false },
    { k:'监控地址', cnt: addrs.length,   dot:false },
    { k:'通知中心', cnt: notifData.length, dot: unread > 0 },
  ];

  return (
    <React.Fragment>
      {/* segmented sub-tab */}
      <div style={{padding:'4px 16px 12px', background:M.elev}}>
        <div style={{
          display:'flex', gap:4, padding:3, borderRadius:10,
          background:M.soft, border:`1px solid ${M.borderSoft}`,
        }}>
          {SUB_TABS.map(t => {
            const on = t.k === subTab;
            return (
              <button key={t.k} onClick={()=>setSubTab(t.k)} style={{
                flex:1, height:32, padding:'0 4px', borderRadius:8,
                border:0, cursor:'pointer', position:'relative',
                background: on ? M.elev : 'transparent',
                color: on ? M.text : M.mid,
                fontSize:11.5, fontWeight: on ? 600 : 500,
                fontFamily:'inherit', whiteSpace:'nowrap',
                boxShadow: on ? '0 1px 2px rgba(15,23,42,0.06), 0 0 0 1px rgba(15,23,42,0.04)' : 'none',
                display:'inline-flex', alignItems:'center', justifyContent:'center', gap:3,
                transition:'background .15s ease',
              }}>
                <span style={{whiteSpace:'nowrap'}}>{t.k}</span>
                <span style={{
                  fontSize:10.5, fontFamily:M.mono, whiteSpace:'nowrap',
                  color: on ? M.dim : M.faint, fontWeight:500,
                }}>{t.cnt}</span>
                {t.dot && (
                  <span style={{
                    position:'absolute', top:5, right:6,
                    width:6, height:6, borderRadius:3,
                    background:M.dn,
                  }}/>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────── 实时巨鲸 ─────── */}
      {subTab === '实时巨鲸' && (
        <React.Fragment>
          {/* 币种 chip 条 */}
          <WhaleCoinTabs value={coin} onChange={setCoin}/>

          {/* 阈值输入 + 创建监控 */}
          <div style={{
            padding:'8px 16px 10px', background:M.elev,
            display:'grid', gridTemplateColumns:'1fr auto', gap:8,
          }}>
            <div style={{
              display:'flex', alignItems:'center', gap:5,
              height:36, padding:'0 12px', borderRadius:10,
              border:`1px solid ${M.border}`, background:M.elev,
            }}>
              <span style={{fontSize:12, color:M.dim, flexShrink:0}}>≥ $</span>
              <input
                type="text"
                value={threshold}
                onChange={(e)=>setThreshold(e.target.value)}
                style={{
                  flex:1, minWidth:0, border:0, outline:'none',
                  background:'transparent', color:M.text,
                  fontFamily:M.mono, fontSize:12.5, fontWeight:600,
                }}
              />
            </div>
            <button
              onClick={()=>openCreate({ threshold: parseFloat((threshold||'0').replace(/[^\d.]/g,''))||500000, coin })}
              style={{
                height:36, padding:'0 16px', borderRadius:10,
                border:0, background:M.violetGrad, color:'#fff',
                fontSize:12.5, fontWeight:600, cursor:'pointer',
                whiteSpace:'nowrap',
              }}>创建监控</button>
          </div>

          {/* 秒后更新 右对齐 — 置于创建监控下方 */}
          <div style={{
            padding:'0 16px 12px', background:M.elev,
            display:'flex', justifyContent:'flex-end',
          }}>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:5,
              fontSize:11, color:M.mid, fontFamily:M.mono,
            }}>
              <span style={{
                width:6, height:6, borderRadius:3, background:M.up,
                animation:'mw-pulse 1.6s ease-out infinite', flexShrink:0,
              }}/>
              <span style={{color:M.text, fontWeight:600}}>{tick}</span>
              <span style={{fontFamily:'inherit'}}>秒后更新</span>
            </span>
          </div>

          {/* feed cards */}
          <div style={{background:M.bg, padding:'8px 0 12px'}}>
            {feed.length === 0 ? (
              <div style={{
                margin:'4px 16px', padding:'28px 16px', textAlign:'center',
                border:`1px solid ${M.borderSoft}`, borderRadius:12, background:M.elev,
                fontSize:12, color:M.dim,
              }}>无匹配推送</div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:8, padding:'0 16px'}}>
                {feed.map((w, i) => (
                  <WhaleRow key={i} w={w} onOpen={(x)=>openProfile(x.ad)} onStats={openStats} onCopy={onCopy}/>
                ))}
              </div>
            )}
          </div>
        </React.Fragment>
      )}

      {/* ─────── 监控地址 ─────── */}
      {subTab === '监控地址' && (
        <div style={{padding:'14px 16px 12px', background:M.elev}}>
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'flex-end',
            gap:8, marginBottom:10,
          }}>
            <button
              onClick={()=>openCreate()}
              style={{
              height:28, padding:'0 12px', borderRadius:14,
              border:0, background:M.violet, color:'#fff',
              fontSize:12, fontWeight:600, cursor:'pointer',
              display:'inline-flex', alignItems:'center', gap:5,
              whiteSpace:'nowrap', flexShrink:0,
            }}>
              <Ico d={ICONS.plus} w={12} sw={2.2}/>
              <span>创建监控</span>
            </button>
          </div>
          {addrs.length === 0 ? (
            <div style={{
              padding:'28px 16px', textAlign:'center',
              border:`1px solid ${M.borderSoft}`, borderRadius:12, background:M.bg,
              fontSize:12, color:M.dim,
            }}>暂无监控地址</div>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {addrs.map(a => (
                <WatchAddrCard key={a.ad} a={a}
                  onOpen={()=>openProfile(a.ad)}
                  onCopy={()=>onCopy(a.ad)}
                  onRemove={()=>setPendingRemove(a)}
                  onToggleMute={()=>toggleMute(a.ad)}
                  onEdit={()=>openEdit(a)}
                  onTrend={()=>openStats({ ad:a.ad })}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────── 通知中心 ─────── */}
      {subTab === '通知中心' && (
        <div style={{padding:'14px 16px 12px', background:M.elev}}>
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'flex-end',
            gap:8, marginBottom:10,
          }}>
            <button
              onClick={markAllRead}
              disabled={unread === 0}
              style={{
                height:28, padding:'0 12px', borderRadius:14,
                border:`1px solid ${unread > 0 ? M.border : M.borderSoft}`,
                background:'transparent',
                color: unread > 0 ? M.text : M.dim,
                fontSize:12, fontWeight:600,
                cursor: unread > 0 ? 'pointer' : 'default',
                whiteSpace:'nowrap', flexShrink:0,
              }}>全部已读 {unread > 0 && `(${unread})`}</button>
          </div>
          {notifData.length === 0 ? (
            <div style={{
              padding:'28px 16px', textAlign:'center',
              border:`1px solid ${M.borderSoft}`, borderRadius:12, background:M.bg,
              fontSize:12, color:M.dim,
            }}>暂无通知消息</div>
          ) : (
            <div style={{
              border:`1px solid ${M.borderSoft}`, borderRadius:12, overflow:'hidden',
            }}>
              {notifData.map((n, i) => (
                <NotifRow key={n.id} n={n}
                  isLast={i === notifData.length - 1}
                  onClick={()=>{
                    setNotifData(notifData.map(x => x.id === n.id ? {...x, unread:false} : x));
                    if (n.addr) openProfile(n.addr);
                  }}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 创建/编辑 地址监控 弹层 */}
      <CreateMonitorSheet
        open={createOpen}
        prefill={createPrefill}
        editing={editingAddr}
        onClose={()=>{ setCreateOpen(false); setEditingAddr(null); }}
        onSubmit={handleSubmit}
      />

      {/* 移除监控 确认弹层 */}
      <ConfirmRemoveDialog
        target={pendingRemove}
        onCancel={()=>setPendingRemove(null)}
        onConfirm={confirmRemove}
      />

      {/* overlays */}
      {profileW && window.WhaleProfileDetail && (
        <window.WhaleProfileDetail w={profileW} onClose={()=>setOpenAddr(null)} onCopy={onCopy}/>
      )}
      {statsW && window.WhaleTradeStats && (
        <window.WhaleTradeStats w={statsW} onClose={()=>setStatsAddr(null)}/>
      )}
      {toast && (
        <div style={{
          position:'absolute', bottom:120, left:'50%', transform:'translateX(-50%)',
          background:'rgba(15,11,34,0.92)', color:'#fff',
          padding:'8px 16px', borderRadius:999, fontSize:12,
          zIndex:80, pointerEvents:'none', fontFamily:'inherit',
        }}>{toast}</div>
      )}
    </React.Fragment>
  );
}

/* ============= 移除监控 — bottom sheet (slide up) ============= */
function ConfirmRemoveDialog({ target, onCancel, onConfirm }) {
  if (!target) return null;
  const fullAd = target.fullAd || target.ad;
  return (
    <div onClick={onCancel} style={{
      position:'absolute', inset:0, zIndex:78,
      background:'rgba(15,11,34,0.55)',
      display:'flex', alignItems:'flex-end',
      animation:'mw-fade .18s ease-out',
    }}>
      <div onClick={(e)=>e.stopPropagation()} style={{
        width:'100%', background:M.bg,
        borderRadius:'18px 18px 0 0',
        display:'flex', flexDirection:'column',
        boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
        animation:'wd-slide-up .22s ease-out',
        overflow:'hidden',
      }}>
        {/* head: title + X */}
        <div style={{
          padding:'16px 16px 12px', display:'flex', alignItems:'center', gap:10,
          borderBottom:`1px solid ${M.borderSoft}`,
        }}>
          <span style={{
            width:30, height:30, borderRadius:8, flexShrink:0,
            background: `${M.dn}1a`, color: M.dn,
            display:'inline-flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </span>
          <span style={{fontSize:15, fontWeight:700, color:M.text, letterSpacing:-0.2}}>移除地址监控？</span>
          <div style={{flex:1}}/>
          <button onClick={onCancel} aria-label="关闭" style={{
            width:30, height:30, padding:0, borderRadius:8, border:0, background:'transparent',
            cursor:'pointer', color:M.mid,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>

        {/* body */}
        <div style={{padding:'16px 16px 8px'}}>
          <div style={{
            fontSize:13, color:M.mid, lineHeight:1.65,
            wordBreak:'break-all',
          }}>
            将停止接收 <span style={{fontFamily:M.mono, color:M.text, fontWeight:500}}>{fullAd}</span> 的监控通知，之后仍可重新创建。
          </div>
        </div>

        {/* footer */}
        <div style={{
          padding:'12px 16px 22px',
          borderTop:`1px solid ${M.borderSoft}`,
          display:'flex', alignItems:'center', gap:10, background:M.elev,
        }}>
          <button onClick={onCancel} style={{
            flex:1, height:42, borderRadius:10,
            border:`1px solid ${M.border}`, background:M.elev,
            color:M.text, fontSize:13, fontWeight:600, cursor:'pointer',
            fontFamily:'inherit',
          }}>取消</button>
          <button onClick={onConfirm} style={{
            flex:1.4, height:42, borderRadius:10, border:0,
            background:M.dn, color:'#fff',
            fontSize:13, fontWeight:700, cursor:'pointer',
            fontFamily:'inherit',
            boxShadow:`0 6px 14px -8px ${M.dn}`,
          }}>移除监控</button>
        </div>
      </div>
    </div>
  );
}

/* ============= 创建/编辑 地址监控 — bottom sheet ============= */
function CreateMonitorSheet({ open, onClose, onSubmit, prefill, editing }) {
  const mode = editing ? 'edit' : 'create';
  const [addr, setAddr]       = React.useState('');
  const [alias, setAlias]     = React.useState('');
  const [threshold, setThr]   = React.useState('500000');
  const [chWeb, setChWeb]     = React.useState(true);
  const [chMail, setChMail]   = React.useState(true);
  const [chTg, setChTg]       = React.useState(false);
  const tgBound = false; // demo: Telegram not bound

  React.useEffect(() => {
    if (open) {
      if (editing) {
        setAddr(editing.fullAd || editing.ad || '');
        setAlias(editing.alias || '');
        setThr(String(editing.threshold ?? prefill?.threshold ?? '500000'));
        setChWeb(editing.channels?.web ?? true);
        setChMail(editing.channels?.mail ?? true);
        setChTg(editing.channels?.tg ?? false);
      } else {
        setAddr('');
        setAlias('');
        setThr(String(prefill?.threshold ?? '500000'));
        setChWeb(true);
        setChMail(true);
        setChTg(false);
      }
    }
  }, [open, prefill, editing]);

  if (!open) return null;

  const canSubmit = addr.trim().length >= 6;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit && onSubmit({
      mode,
      original: editing || null,
      addr: addr.trim(),
      alias: alias.trim() || null,
      threshold: parseFloat((threshold||'0').replace(/[^\d.]/g,'')) || 0,
      channels: { web: chWeb, mail: chMail, tg: chTg },
    });
    onClose && onClose();
  };

  const Field = ({ label, children }) => (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11, color:M.mid, marginBottom:6, fontWeight:500}}>{label}</div>
      {children}
    </div>
  );
  const inputStyle = {
    width:'100%', height:38, padding:'0 12px',
    borderRadius:8, border:`1px solid ${M.border}`,
    background:M.bg, color:M.text,
    fontSize:13, fontFamily:M.mono, outline:'none',
    boxSizing:'border-box',
  };

  const Check = ({ checked, onChange, disabled }) => (
    <span
      onClick={(e)=>{ e.stopPropagation(); if (!disabled) onChange(!checked); }}
      style={{
        width:18, height:18, borderRadius:4, flexShrink:0,
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        border: `1.5px solid ${disabled ? M.borderSoft : (checked ? M.violet : M.border)}`,
        background: checked && !disabled ? M.violet : (disabled ? M.soft : M.elev),
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      {checked && !disabled && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5L20 7"/>
        </svg>
      )}
    </span>
  );

  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, zIndex:75,
      background:'rgba(15,11,34,0.55)',
      display:'flex', alignItems:'flex-end',
      animation:'mw-fade .18s ease-out',
    }}>
      <div onClick={(e)=>e.stopPropagation()} style={{
        width:'100%', maxHeight:'92%', background:M.bg,
        borderRadius:'18px 18px 0 0', display:'flex', flexDirection:'column',
        boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
        animation:'wd-slide-up .22s ease-out',
        overflow:'hidden',
      }}>
        {/* head */}
        <div style={{
          padding:'16px 16px 12px', display:'flex', alignItems:'center',
          borderBottom:`1px solid ${M.borderSoft}`,
        }}>
          <span style={{fontSize:15, fontWeight:700, color:M.text}}>{mode === 'edit' ? '编辑地址监控' : '创建地址监控'}</span>
          <div style={{flex:1}}/>
          <button onClick={onClose} aria-label="关闭" style={{
            width:30, height:30, padding:0, borderRadius:8, border:0, background:'transparent',
            cursor:'pointer', color:M.mid,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>

        {/* body */}
        <div style={{padding:'16px 16px 8px', overflow:'auto'}}>
          <Field label="地址">
            <input
              autoFocus
              placeholder="0x…"
              value={addr}
              onChange={(e)=>setAddr(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="地址备注">
            <input
              placeholder="可选"
              value={alias}
              onChange={(e)=>setAlias(e.target.value)}
              style={{...inputStyle, fontFamily:'inherit'}}
            />
          </Field>
          <Field label="阈值 (USD)">
            <input
              type="text"
              inputMode="numeric"
              value={threshold}
              onChange={(e)=>setThr(e.target.value)}
              style={inputStyle}
            />
          </Field>

          {/* 通知渠道 */}
          <div style={{
            marginBottom:14, padding:'12px',
            border:`1px solid ${M.borderSoft}`, borderRadius:10, background:M.elev,
          }}>
            <div style={{fontSize:11, color:M.mid, marginBottom:10, fontWeight:600}}>通知渠道</div>
            <div style={{display:'flex', flexDirection:'column', gap:2}}>
              {/* 网页通知 */}
              <label style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 4px', cursor:'pointer',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M.mid}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 19a2 2 0 0 0 4 0"/>
                </svg>
                <span style={{flex:1, fontSize:13, color:M.text}}>网页通知</span>
                <Check checked={chWeb} onChange={setChWeb}/>
              </label>
              {/* 邮箱通知 */}
              <label style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 4px', cursor:'pointer',
                borderTop:`1px solid ${M.borderSoft}`,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M.mid}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2"/>
                  <path d="M3 7l9 6 9-6"/>
                </svg>
                <span style={{flex:1, fontSize:13, color:M.text}}>邮箱通知</span>
                <Check checked={chMail} onChange={setChMail}/>
              </label>
              {/* Telegram */}
              <label style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 4px', cursor: tgBound ? 'pointer' : 'not-allowed',
                borderTop:`1px solid ${M.borderSoft}`, opacity: tgBound ? 1 : 0.7,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M.mid}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
                <span style={{flex:1, fontSize:13, color: tgBound ? M.text : M.dim}}>Telegram 通知</span>
                <Check checked={chTg} onChange={setChTg} disabled={!tgBound}/>
              </label>
            </div>
            {!tgBound && (
              <div style={{
                marginTop:8, paddingTop:8, borderTop:`1px solid ${M.borderSoft}`,
                fontSize:10.5, color:M.dim, lineHeight:1.5,
              }}>请先完成 Telegram 登录/绑定后再开启 Telegram 推送</div>
            )}
          </div>
        </div>

        {/* footer */}
        <div style={{
          padding:'12px 16px 22px',
          borderTop:`1px solid ${M.borderSoft}`,
          display:'flex', alignItems:'center', gap:10, background:M.elev,
        }}>
          <button onClick={onClose} style={{
            flex:1, height:42, borderRadius:10,
            border:`1px solid ${M.border}`, background:M.elev,
            color:M.text, fontSize:13, fontWeight:600, cursor:'pointer',
            fontFamily:'inherit',
          }}>取消</button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              flex:1.4, height:42, borderRadius:10,
              border:0,
              background: canSubmit ? M.violetGrad || M.violet : M.soft,
              color: canSubmit ? '#fff' : M.dim,
              fontSize:13, fontWeight:700, cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily:'inherit',
              boxShadow: canSubmit ? '0 6px 14px -8px rgba(124,92,255,0.6)' : 'none',
            }}>{mode === 'edit' ? '保存' : '创建'}</button>
        </div>
      </div>
      <style>{`@keyframes mw-fade { from{opacity:0} to{opacity:1} }`}</style>
    </div>
  );
}

function WatchAddrCard({ a, onOpen, onCopy, onRemove, onToggleMute, onEdit, onTrend }) {
  const empty = a.perpValue == null;
  const pnlPos = (a.unrealizedPnl ?? 0) > 0;
  const pnlNeg = (a.unrealizedPnl ?? 0) < 0;
  const pnlColor = pnlPos ? M.up : pnlNeg ? M.dn : M.text;
  // usage tone — red >80, amber >50, neutral otherwise
  const usage = a.marginUsage;
  const usageColor = usage == null
    ? M.dim
    : usage >= 80 ? M.dn : usage >= 50 ? M.warn : M.violet;

  const ActionBtn = ({ label, onClick, color, children }) => (
    <button
      aria-label={label}
      onClick={(e)=>{ e.stopPropagation(); onClick && onClick(); }}
      style={{
        width:26, height:26, padding:0, borderRadius:6,
        border:`1px solid ${M.borderSoft}`, background:M.elev,
        color: color || M.mid, cursor:'pointer',
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
      }}>{children}</button>
  );

  return (
    <div style={{
      padding:'12px 12px 10px', borderRadius:12,
      border:`1px solid ${M.borderSoft}`, background:M.elev,
    }}>
      {/* head: 地址 + 复制 + 别名 + actions */}
      <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:10}}>
        <span
          onClick={onOpen}
          style={{
            fontSize:13, fontWeight:600, color:M.violet, fontFamily:M.mono,
            borderBottom:`1px dashed ${M.violet}66`, cursor:'pointer',
            letterSpacing:-0.2, whiteSpace:'nowrap', flexShrink:0,
          }}>{a.ad}</span>
        <button
          onClick={(e)=>{e.stopPropagation(); onCopy && onCopy();}}
          aria-label="复制"
          style={{
            width:18, height:18, padding:0, border:0, background:'transparent',
            color:M.mid, cursor:'pointer', flexShrink:0,
            display:'inline-flex', alignItems:'center', justifyContent:'center',
          }}>
          <Ico d={ICONS.copy} w={11} sw={1.6}/>
        </button>
        {a.live && (
          <span style={{
            width:6, height:6, borderRadius:3, background:M.up,
            animation:'mw-pulse 1.6s ease-out infinite', flexShrink:0,
          }}/>
        )}
        {a.alias && (
          <span style={{
            fontSize:11.5, color:M.mid, fontWeight:500,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            minWidth:0, flex:1,
          }}>{a.alias}</span>
        )}
        {!a.alias && <div style={{flex:1}}/>}
        {/* actions: 趋势 / 静音 / 编辑 / 删除 */}
        <div style={{display:'inline-flex', gap:4, flexShrink:0}}>
          <ActionBtn label="趋势" onClick={onTrend} color={M.violet}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 17l6-6 4 4 6-6M20 9V5h-4"/>
            </svg>
          </ActionBtn>
          <ActionBtn label={a.muted?'取消静音':'静音通知'} onClick={onToggleMute}>
            {a.muted ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 9.5-4.9M18 14V8M21 21L3 3M19 17H3l3-3v-1.5"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 19a2 2 0 0 0 4 0"/>
              </svg>
            )}
          </ActionBtn>
          <ActionBtn label="编辑" onClick={onEdit}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z"/>
            </svg>
          </ActionBtn>
          <ActionBtn label="删除" onClick={onRemove} color={M.dn}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 7h14M10 7V5h4v2M9 7l1 12h4l1-12"/>
            </svg>
          </ActionBtn>
        </div>
      </div>

      {/* hero row: 永续合约总价值 (big) + 未实现盈亏 (right) */}
      <div style={{
        display:'flex', alignItems:'flex-end', justifyContent:'space-between',
        gap:10, paddingTop:10, borderTop:`1px solid ${M.borderSoft}`,
      }}>
        <div style={{minWidth:0, flex:1}}>
          <div style={{fontSize:10, color:M.dim, letterSpacing:0.2, fontWeight:500}}>永续合约总价值</div>
          <div style={{
            fontSize:16, fontWeight:700, color: empty ? M.dim : M.text,
            fontFamily:M.mono, marginTop:2, letterSpacing:-0.3,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>{fmtWatchUsd(a.perpValue)}</div>
        </div>
        <div style={{textAlign:'right', flexShrink:0}}>
          <div style={{fontSize:10, color:M.dim, letterSpacing:0.2, fontWeight:500}}>未实现盈亏</div>
          <div style={{
            fontSize:13, fontWeight:700, color: empty ? M.dim : pnlColor,
            fontFamily:M.mono, marginTop:2, letterSpacing:-0.2,
          }}>{fmtWatchPnl(a.unrealizedPnl)}</div>
        </div>
      </div>

      {/* 3-col footer: 可用保证金 / 保证金使用率 (with bar) / 持仓 */}
      <div style={{
        display:'grid', gridTemplateColumns:'1.1fr 1.2fr 0.6fr', gap:10,
        marginTop:10,
      }}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:10, color:M.dim, letterSpacing:0.2, fontWeight:500}}>可用保证金</div>
          <div style={{
            fontSize:12, fontWeight:600, color: empty ? M.dim : M.text,
            fontFamily:M.mono, marginTop:2,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>{fmtWatchUsd(a.availMargin)}</div>
        </div>
        <div style={{minWidth:0}}>
          <div style={{fontSize:10, color:M.dim, letterSpacing:0.2, fontWeight:500}}>保证金使用率</div>
          <div style={{display:'flex', alignItems:'center', gap:6, marginTop:3}}>
            <span style={{
              fontSize:12, fontWeight:600, color: empty ? M.dim : M.text,
              fontFamily:M.mono, flexShrink:0, minWidth:30,
            }}>{usage == null ? '-' : `${usage}%`}</span>
            {usage != null && (
              <span style={{
                flex:1, height:3, borderRadius:2, background:M.soft, overflow:'hidden',
              }}>
                <span style={{
                  display:'block', height:'100%',
                  width:`${Math.max(2, Math.min(100, usage))}%`,
                  background: usageColor,
                  borderRadius:2,
                }}/>
              </span>
            )}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:10, color:M.dim, letterSpacing:0.2, fontWeight:500}}>持仓</div>
          <div style={{
            fontSize:12, fontWeight:600, color: empty ? M.dim : M.text,
            fontFamily:M.mono, marginTop:2,
          }}>{a.positions == null ? '-' : a.positions}</div>
        </div>
      </div>
    </div>
  );
}

function NotifRow({ n, isLast, onClick }) {
  const k = N_KIND[n.kind] || N_KIND.system;
  return (
    <div
      onClick={onClick}
      style={{
        display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px',
        borderBottom: isLast ? 0 : `1px solid ${M.borderSoft}`,
        background: n.unread ? M.elev : 'transparent',
        cursor:'pointer',
      }}>
      <span style={{
        width:28, height:28, borderRadius:8, background:k.bg, color:k.accent,
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={k.icon}/>
        </svg>
      </span>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <span style={{fontSize:12.5, fontWeight:600, color:M.text}}>{n.title}</span>
          {n.unread && (
            <span style={{width:6, height:6, borderRadius:3, background:M.violet, flexShrink:0}}/>
          )}
        </div>
        <div style={{fontSize:11, color:M.mid, marginTop:3, lineHeight:1.4}}>{n.body}</div>
        <div style={{fontSize:10, color:M.dim, marginTop:4, fontFamily:M.mono}}>{n.meta}</div>
      </div>
    </div>
  );
}

function WhaleRow({ w, onOpen, onStats, onCopy }) {
  const isLong = w.side === 'long';
  const sideColor = isLong ? M.up : M.dn;
  const sideSoft  = isLong ? M.upSoft : M.dnSoft;
  const winColor  = w.win >= 70 ? M.up : w.win >= 50 ? M.warn : M.dn;
  const symColor  = SYM_COLOR[w.sym] || M.mid;
  const handleStats = () => onStats && onStats(w);
  const handleProfile = (e) => { e.stopPropagation(); onOpen && onOpen(w); };
  const handleCopy = (e) => {
    e.stopPropagation();
    if (onCopy) onCopy(w.ad);
    else { try{navigator.clipboard?.writeText(w.ad);}catch(err){} }
  };

  return (
    <div
      onClick={handleStats}
      style={{
        padding:'12px 14px 12px',
        borderRadius:14,
        background:M.elev,
        border:`1px solid ${M.borderSoft}`,
        boxShadow:'0 1px 2px rgba(15,23,42,0.03)',
        cursor:'pointer',
      }}>
      {/* Row 1 — 交易地址 + 复制 + 趋势标签 / 时间 + 操作 */}
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <span
          onClick={handleProfile}
          style={{
            display:'inline-flex', alignItems:'center', gap:3,
            fontSize:13, fontWeight:600, color:M.violet, fontFamily:M.mono,
            letterSpacing:-0.2,
            borderBottom:`1px dashed ${M.violet}66`,
            padding:'1px 0', cursor:'pointer',
          }}>
          <span>{w.ad}</span>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.7}}>
            <path d="M9 6l6 6-6 6"/>
          </svg>
        </span>
        <button
          aria-label="复制地址"
          onClick={handleCopy}
          style={{
            width:20, height:20, padding:0, borderRadius:5,
            border:0, background:'transparent', color:M.mid, cursor:'pointer',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
          }}>
          <Ico d={ICONS.copy} w={12} sw={1.6}/>
        </button>
        {w.trader && (
          <span style={{
            fontSize:10, padding:'2px 7px', borderRadius:4,
            color:TRADER_TAG_FG, background:TRADER_TAG_BG,
            fontWeight:600, letterSpacing:0.2,
          }}>{w.trader}</span>
        )}
        {w.fresh && (
          <span style={{
            width:6, height:6, borderRadius:3, background:M.up,
            animation:'mw-pulse 1.6s ease-out infinite',
          }}/>
        )}
        <span style={{
          marginLeft:'auto', fontSize:11, color:M.dim, fontFamily:M.mono,
          whiteSpace:'nowrap',
        }}>{w.time}</span>
        <button
          aria-label="查看 K 线"
          onClick={(e)=>{ e.stopPropagation(); handleStats(); }}
          style={{
            width:24, height:24, padding:0, borderRadius:6,
            border:`1px solid ${M.borderSoft}`, background:M.elev,
            color:M.mid, cursor:'pointer',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
          }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M2 11l3-4 2.5 2 4-6M11.5 3H13v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Row 2 — 币种 · 全/逐仓 · 多/空胶囊 · 杠杆 */}
      <div style={{display:'flex', alignItems:'center', gap:6, marginTop:8}}>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:5,
          height:22, padding:'0 8px', borderRadius:11,
          background:M.soft, fontSize:11, fontWeight:600, color:M.text,
        }}>
          <span style={{width:6, height:6, borderRadius:3, background:symColor}}/>
          {w.sym}
        </span>
        <span style={{
          fontSize:11, color:M.mid, fontWeight:500,
        }}>{w.mode}</span>

        <span style={{
          marginLeft:'auto',
          display:'inline-flex', alignItems:'center',
          height:22, padding:'0 10px', borderRadius:11,
          background:sideSoft, color:sideColor,
          fontSize:11, fontWeight:700, letterSpacing:0.4,
          border:`1px solid ${sideColor}33`,
        }}>{isLong ? '做多' : '做空'}</span>
        <span style={{
          fontSize:11, color:M.dim, fontFamily:M.mono, minWidth:22, textAlign:'right',
        }}>{w.lev ? `${w.lev}x` : '--'}</span>
      </div>

      {/* Row 3 — 持仓价值 / 开盘价 / 胜率 */}
      <div style={{
        display:'grid', gridTemplateColumns:'1.3fr 1fr 0.7fr', gap:10,
        marginTop:10, paddingTop:10, borderTop:`1px dashed ${M.borderSoft}`,
      }}>
        <div>
          <div style={{fontSize:10, color:M.dim, letterSpacing:0.3, fontWeight:600}}>持仓价值</div>
          <div style={{
            fontSize:15, fontWeight:700, color:M.text, fontFamily:M.mono,
            marginTop:2, letterSpacing:-0.3, whiteSpace:'nowrap',
          }}>{fmtUsd(w.value)}</div>
          <div style={{
            fontSize:10, color:M.dim, fontFamily:M.mono, marginTop:1, whiteSpace:'nowrap',
          }}>{w.qty}</div>
        </div>
        <div>
          <div style={{fontSize:10, color:M.dim, letterSpacing:0.3, fontWeight:600}}>开盘价格</div>
          <div style={{
            fontSize:13, fontWeight:600, color:M.text, fontFamily:M.mono,
            marginTop:2, whiteSpace:'nowrap',
          }}>{fmtPrice(w.open)}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:10, color:M.dim, letterSpacing:0.3, fontWeight:600}}>胜率</div>
          <div style={{
            fontSize:14, fontWeight:700, color:winColor, fontFamily:M.mono, marginTop:2,
          }}>{w.win}%</div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================
   SCREEN 9 — Account / Profile (我的)
   ======================================================================== */
function ScreenAccount() {
  const [lang, setLang] = React.useState('简体中文');
  const [langOpen, setLangOpen] = React.useState(false);
  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus dark/>
      {/* purple header */}
      <div style={{
        background:`
          radial-gradient(360px 240px at 88% 16%, rgba(167,139,250,0.4), transparent 60%),
          radial-gradient(280px 240px at 10% 90%, rgba(124,92,255,0.3), transparent 60%),
          linear-gradient(160deg, #1F0F4A 0%, #2E1A6B 100%)
        `,
        padding:'62px 20px 56px', color:'#fff', position:'relative',
      }}>
        <div style={{display:'flex', alignItems:'center', gap:14}}>
          <div style={{
            width:56, height:56, borderRadius:16, background:'#FFFFFF22',
            border:'1px solid rgba(255,255,255,0.18)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg viewBox="0 0 56 56" width="36" height="36">
              <rect x="8" y="8" width="10" height="10" fill="#A78BFA"/>
              <rect x="22" y="8" width="10" height="10" fill="#7C5CFF"/>
              <rect x="36" y="8" width="10" height="10" fill="#C4B5FD"/>
              <rect x="8" y="22" width="10" height="10" fill="#7C5CFF"/>
              <rect x="22" y="22" width="10" height="10" fill="#5B21B6"/>
              <rect x="36" y="22" width="10" height="10" fill="#A78BFA"/>
              <rect x="8" y="36" width="10" height="10" fill="#C4B5FD"/>
              <rect x="22" y="36" width="10" height="10" fill="#A78BFA"/>
              <rect x="36" y="36" width="10" height="10" fill="#7C5CFF"/>
            </svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:20, fontWeight:700, letterSpacing:-0.2}}>vi***@gmail.com</div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.6)', fontFamily:M.mono, marginTop:4}}>
              UID · cmp42glf60001yxqs0ivc09ff
            </div>
          </div>
          <button style={{
            width:32, height:32, borderRadius:16, background:'rgba(255,255,255,0.12)',
            border:0, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
          }}><Ico d={ICONS.copy} w={14}/></button>
        </div>
        <div style={{display:'flex', gap:8, marginTop:18}}>
          <Chip tone="violet" style={{background:'rgba(255,255,255,0.14)', color:'#DDD6FE', border:'1px solid rgba(255,255,255,0.18)'}}>
            <span style={{width:6, height:6, borderRadius:3, background:'#16C783'}}/>Telegram 已绑定
          </Chip>
          <Chip tone="violet" style={{background:'rgba(255,255,255,0.14)', color:'#DDD6FE', border:'1px solid rgba(255,255,255,0.18)'}}>
            Binance ✓
          </Chip>
        </div>
      </div>

      {/* stat row, sitting overlapped */}
      <div style={{padding:'0 16px', marginTop:-26, position:'relative', zIndex:2}}>
        <Card p="14px 16px" style={{boxShadow:'0 12px 40px rgba(15,22,35,0.10)'}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1px 1fr 1px 1fr', alignItems:'center'}}>
            <AccStat label="活跃策略" v="3"/>
            <div style={{height:32, background:M.borderSoft}}/>
            <AccStat label="累计收益" v="+$8,420" tone="up"/>
            <div style={{height:32, background:M.borderSoft}}/>
            <AccStat label="胜率" v="62.4%"/>
          </div>
        </Card>
      </div>

      <div style={{flex:1, overflow:'auto', padding:'18px 16px 100px'}}>
        <SectionTitle>实盘策略</SectionTitle>
        {(() => {
          const strats = window.__qfLiveStrats || [];
          const active = strats.filter(s => s.status !== 'stopped');
          const running = active.filter(s => s.status === 'running').length;
          const warning = active.filter(s => s.status === 'warning').length;
          const paused  = active.filter(s => s.status === 'paused').length;
          const stopped = strats.filter(s => s.status === 'stopped').length;
          const totalPnl = active.reduce((a,s) => a + (s.totalPnl || 0), 0);
          return (
            <button data-go-live style={{
              width:'100%', padding:'14px 16px', borderRadius:14, border:0,
              background:M.elev, boxShadow:`0 0 0 1px ${M.border} inset`,
              cursor:'pointer', textAlign:'left',
              display:'flex', alignItems:'center', gap:12,
            }}>
              <div style={{
                width:40, height:40, borderRadius:10,
                background:M.violetSoft, color:M.violet, flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Ico d={ICONS.strat} w={18} sw={1.8}/>
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{
                  display:'flex', alignItems:'center', gap:6,
                  fontSize:14, fontWeight:600, color:M.text, marginBottom:3,
                }}>
                  <span style={{whiteSpace:'nowrap'}}>查看实盘策略</span>
                  <span style={{
                    height:18, padding:'0 6px', borderRadius:5, flexShrink:0,
                    background:M.violetSoft, color:M.violet,
                    fontSize:10, fontWeight:700, fontFamily:M.mono,
                    display:'inline-flex', alignItems:'center',
                  }}>{active.length}</span>
                </div>
                <div style={{
                  fontSize:11, color:M.mid,
                  display:'flex', gap:6, alignItems:'center', flexWrap:'wrap',
                }}>
                  {running > 0 && (
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:4,
                      color:M.ok, fontWeight:500, whiteSpace:'nowrap',
                    }}>
                      <span style={{width:6, height:6, borderRadius:3, background:M.ok,
                        boxShadow:'0 0 0 3px rgba(22,199,131,0.18)'}}/>
                      {running} 运行中
                    </span>
                  )}
                  {warning > 0 && <>
                    <span style={{color:M.dim}}>·</span>
                    <span style={{color:M.warn, fontWeight:500, whiteSpace:'nowrap'}}>{warning} 需关注</span>
                  </>}
                  {paused > 0 && <>
                    <span style={{color:M.dim}}>·</span>
                    <span style={{color:M.dim, fontWeight:500, whiteSpace:'nowrap'}}>{paused} 已暂停</span>
                  </>}
                  {stopped > 0 && <>
                    <span style={{color:M.dim}}>·</span>
                    <span style={{color:M.dim, fontWeight:500, whiteSpace:'nowrap'}}>{stopped} 已停止</span>
                  </>}
                </div>
              </div>
              <Ico d={ICONS.caretR} w={14} sw={2}/>
            </button>
          );
        })()}

        <SectionTitle>账户</SectionTitle>
        <Card p="0">
          <Row label="邮箱" v="victor@gmail.com" mono={false}/>
          <Row label="UID" v="cmp42glf60001yxqs0ivc09ff" trunc/>
          <Row label="Telegram" v="@victor_qf" tone="ok" right={<Ico d={ICONS.caretR} w={14} sw={2}/>}/>
          <Row label="安全设置" v="双重认证 · 已开启" right={<Ico d={ICONS.caretR} w={14} sw={2}/>} last/>
        </Card>

        <SectionTitle>交易所 API</SectionTitle>
        <Card p="0">
          <ApiRow ex="Binance"    set on/>
          <ApiRow ex="OKX"             />
          <ApiRow ex="Hyperliquid"     last/>
        </Card>

        <SectionTitle>偏好</SectionTitle>
        <Card p="0">
          <Row label="语言" v={lang} onClick={()=>setLangOpen(true)} right={<Ico d={ICONS.caretR} w={14} sw={2}/>}/>
          <Row label="主题" v="跟随系统" right={<Ico d={ICONS.caretR} w={14} sw={2}/>}/>
          <Row label="推送通知" v="Telegram · 开启" tone="ok" right={<Ico d={ICONS.caretR} w={14} sw={2}/>} last/>
        </Card>

        <button style={{
          marginTop:22, width:'100%', height:46, borderRadius:12,
          background:M.elev, border:`1px solid ${M.border}`,
          color:M.danger, fontSize:14, fontWeight:500,
        }}>退出登录</button>

        <div style={{textAlign:'center', fontSize:10, color:M.dim, marginTop:18, fontFamily:M.mono}}>
          Quantify v1.2.4 · build 2026.05
        </div>
      </div>

      <MTabBar active="me"/>

      {/* 语言选择 — 底部抽屉 (目前支持 简体中文 / English) */}
      {langOpen && (
        <div
          onClick={()=>setLangOpen(false)}
          style={{
            position:'absolute', inset:0, zIndex:85,
            background:'rgba(15,11,34,0.55)', animation:'m-fade-in .18s ease-out',
          }}>
          <div
            onClick={(e)=>e.stopPropagation()}
            style={{
              position:'absolute', left:0, right:0, bottom:0,
              background:M.elev, borderRadius:'20px 20px 0 0',
              boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
              display:'flex', flexDirection:'column',
              animation:'m-slide-up .26s cubic-bezier(.2,.8,.2,1)',
            }}>
            <div style={{width:42, height:4, borderRadius:2, background:M.border, margin:'10px auto 0'}}/>
            <div style={{padding:'12px 16px 6px', fontSize:14, fontWeight:700, color:M.text}}>语言</div>
            <div style={{padding:'0 8px 6px'}}>
              {['简体中文', 'English'].map(o => {
                const on = o === lang;
                return (
                  <button
                    key={o}
                    onClick={()=>{ setLang(o); setLangOpen(false); }}
                    style={{
                      display:'flex', alignItems:'center', gap:11,
                      width:'100%', padding:'12px 12px',
                      border:0, background:'transparent', cursor:'pointer',
                      fontFamily:'inherit', textAlign:'left',
                    }}>
                    <span style={{flex:1, fontSize:14, fontWeight:600, color: on ? M.violet : M.text}}>{o}</span>
                    <span style={{
                      width:20, height:20, borderRadius:'50%', flexShrink:0,
                      background: on ? M.violet : 'transparent',
                      border: `1.5px solid ${on ? M.violet : M.border}`,
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
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
              <button onClick={()=>setLangOpen(false)} style={{
                width:'100%', height:46, border:0, cursor:'pointer',
                background:'transparent', color:M.text,
                fontSize:14, fontWeight:600, fontFamily:'inherit',
              }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function AccStat({ label, v, tone }) {
  const c = tone==='up' ? M.up : M.text;
  return (
    <div style={{textAlign:'center'}}>
      <div style={{fontSize:16, fontWeight:700, color:c, fontFamily:M.mono}}>{v}</div>
      <div style={{fontSize:11, color:M.dim, marginTop:3}}>{label}</div>
    </div>
  );
}
function SectionTitle({ children }) {
  return <div style={{fontSize:12, fontWeight:600, color:M.dim, letterSpacing:0.6, textTransform:'uppercase', margin:'18px 4px 10px'}}>{children}</div>;
}
function Row({ label, v, right, trunc, tone, last, mono, onClick }) {
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:10, padding:'13px 16px',
      borderBottom: last ? 0 : `1px solid ${M.borderSoft}`,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <span style={{fontSize:14, color:M.text, fontWeight:500, flexShrink:0}}>{label}</span>
      <div style={{flex:1}}/>
      <span style={{
        fontSize:13, color: tone==='ok' ? M.ok : M.mid,
        maxWidth: trunc ? 180 : 'none',
        overflow: trunc ? 'hidden' : 'visible',
        textOverflow: trunc ? 'ellipsis' : 'clip',
        whiteSpace:'nowrap',
        fontFamily: mono !== false && (trunc || label==='UID') ? M.mono : M.sans,
      }}>{v}</span>
      {right}
    </div>
  );
}
/* Exchange logo marks — inline SVG, recognizable but simplified */
function ExchangeLogo({ ex, size = 36 }) {
  const map = {
    Binance: {
      bg: '#181A20',
      svg: (
        <svg viewBox="0 0 32 32" width={size*0.72} height={size*0.72}>
          {/* 5-diamond pinwheel — Binance gold on dark */}
          <g fill="#F3BA2F">
            <polygon points="16,6 26,16 16,26 6,16"/>
            <polygon points="16,2 18.5,4.5 16,7 13.5,4.5"/>
            <polygon points="16,25 18.5,27.5 16,30 13.5,27.5"/>
            <polygon points="2,16 4.5,13.5 7,16 4.5,18.5"/>
            <polygon points="25,16 27.5,13.5 30,16 27.5,18.5"/>
          </g>
        </svg>
      ),
    },
    OKX: {
      bg: '#000',
      svg: (
        <svg viewBox="0 0 32 32" width={size*0.66} height={size*0.66}>
          {/* 9-square mark */}
          <g fill="#fff">
            <rect x="3"  y="3"  width="8" height="8"/>
            <rect x="12" y="12" width="8" height="8"/>
            <rect x="3"  y="21" width="8" height="8"/>
            <rect x="21" y="3"  width="8" height="8"/>
            <rect x="21" y="21" width="8" height="8"/>
          </g>
        </svg>
      ),
    },
    Hyperliquid: {
      bg: '#0B3D33',
      svg: (
        <svg viewBox="0 0 32 32" width={size*0.62} height={size*0.62}>
          {/* stylized H — two columns + thick crossbar in mint */}
          <g fill="#7CFFCB">
            <rect x="5"  y="5" width="5" height="22" rx="1"/>
            <rect x="22" y="5" width="5" height="22" rx="1"/>
            <rect x="5"  y="13.5" width="22" height="5"/>
          </g>
        </svg>
      ),
    },
    Bybit: {
      bg: '#F7A600',
      svg: (
        <svg viewBox="0 0 32 32" width={size*0.6} height={size*0.6}>
          <g fill="#1A1A1A">
            <rect x="5" y="6" width="4" height="20"/>
            <rect x="9" y="6" width="11" height="4"/>
            <rect x="9" y="14" width="11" height="4"/>
            <rect x="9" y="22" width="14" height="4"/>
            <rect x="20" y="10" width="4" height="4"/>
            <rect x="23" y="18" width="4" height="4"/>
          </g>
        </svg>
      ),
    },
  };
  const m = map[ex] || { bg: M.soft, svg: (
    <span style={{color:M.text, fontWeight:700, fontSize:size*0.4}}>{ex[0]}</span>
  )};
  return (
    <div style={{
      width:size, height:size, borderRadius:size/3.5, background:m.bg,
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      overflow:'hidden',
    }}>
      {m.svg}
    </div>
  );
}

function ApiRow({ ex, set, on, last }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
      borderBottom: last ? 0 : `1px solid ${M.borderSoft}`,
    }}>
      <ExchangeLogo ex={ex} size={36}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:14, fontWeight:600, color:M.text}}>{ex}</div>
        <div style={{fontSize:11, color: set ? M.ok : M.warn, marginTop:3}}>
          {set ? '已连接 · 读取 + 下单' : '未配置 · 部署策略前请配置'}
        </div>
      </div>
      <button data-ex={ex} style={{
        height:30, padding:'0 12px', borderRadius:8,
        background: set ? M.soft : M.violetSoft,
        color: set ? M.mid : M.violet,
        border:0, fontSize:12, fontWeight:600,
      }}>{set ? '管理' : '连接'}</button>
    </div>
  );
}

/* ========================================================================
   SCREEN 10 — API Config (modal bottom sheet)
   ======================================================================== */
function ScreenApiConfig({ ex = 'Binance' }) {
  // per-exchange auth shape.
  //  · 'key'    Binance/OKX/… → API Key + Secret (+ Passphrase for OKX-family)
  //  · 'wallet' Hyperliquid    → 主钱包地址 + Agent 私钥 (no key/secret at all)
  const API_META = {
    Binance:     { mode:'key',    secretLabel:'Secret',            passphrase:false, testnet:true  },
    OKX:         { mode:'key',    secretLabel:'Secret Key',         passphrase:true,  testnet:false },
    Bitget:      { mode:'key',    secretLabel:'Secret Key',         passphrase:true,  testnet:false },
    KuCoin:      { mode:'key',    secretLabel:'Secret Key',         passphrase:true,  testnet:false },
    Hyperliquid: { mode:'wallet',                                                     testnet:false },
  };
  const meta = API_META[ex] || API_META.Binance;

  // mainnet vs testnet — fundamentally changes which endpoint we hit + allowed amounts
  const [env, setEnv] = React.useState('mainnet');  // 'mainnet' | 'testnet'
  const isTest = env === 'testnet' && meta.testnet;

  return (
    <div className="m-sheet-scrim" style={{height:'100%', position:'relative', background:'rgba(15,22,35,0.55)', overflow:'hidden'}}>
      <MStatus dark/>
      <div className="m-sheet" style={{
        position:'absolute', left:0, right:0, bottom:0, top:160,
        background:M.elev, borderRadius:'24px 24px 0 0',
        boxShadow:'0 -16px 48px rgba(15,22,35,0.18)',
        display:'flex', flexDirection:'column',
      }}>
        <div style={{padding:'10px 0 0', display:'flex', justifyContent:'center'}}>
          <div style={{width:42, height:4, borderRadius:2, background:M.border}}/>
        </div>

        <div style={{padding:'14px 20px 8px', display:'flex', alignItems:'center', gap:12}}>
          <ExchangeLogo ex={ex} size={42}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{
              display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
            }}>
              <span style={{fontSize:17, fontWeight:700, whiteSpace:'nowrap'}}>{ex} API</span>
              {isTest && (
                <span style={{
                  height:18, padding:'0 7px', borderRadius:5,
                  background:'rgba(245,158,11,0.15)', color:M.warn,
                  fontSize:10, fontWeight:700, letterSpacing:0.3,
                  display:'inline-flex', alignItems:'center', whiteSpace:'nowrap',
                }}>TESTNET</span>
              )}
            </div>
            <div style={{fontSize:12, color:M.mid, marginTop:2}}>
              {isTest ? '测试网 · 模拟资金 · 不影响真实账户' : '仅保留读取 + 下单权限'}
            </div>
          </div>
        </div>

        <div style={{flex:1, overflow:'auto', padding:'18px 20px 20px'}}>
          {/* environment toggle — first decision, before keys (only where a testnet exists) */}
          {meta.testnet && (<>
          <CfgLabel>环境</CfgLabel>
          <div style={{
            display:'flex', padding:3, marginBottom:14, borderRadius:11,
            background:M.soft, border:`1px solid ${M.borderSoft}`, gap:3,
          }}>
            {[
              { k:'mainnet', label:'主网',   sub:'真实资金' },
              { k:'testnet', label:'测试网', sub:'模拟资金' },
            ].map(opt => {
              const on = env === opt.k;
              return (
                <button key={opt.k} onClick={() => setEnv(opt.k)} style={{
                  flex:1, padding:'8px 0', borderRadius:8, border:0, cursor:'pointer',
                  background: on ? M.elev : 'transparent',
                  color: on ? (opt.k === 'testnet' ? M.warn : M.violet) : M.mid,
                  fontSize:13, fontWeight: on ? 600 : 500,
                  boxShadow: on ? '0 1px 3px rgba(15,22,35,0.06)' : 'none',
                  transition:'all 140ms',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                }}>
                  <span>{opt.label}</span>
                  <span style={{
                    fontSize:10, fontWeight:500,
                    color: on ? 'currentColor' : M.dim, opacity: on ? 0.7 : 1,
                  }}>{opt.sub}</span>
                </button>
              );
            })}
          </div>
          </>)}

          {/* environment-specific warning */}
          {isTest ? (
            <div style={{
              padding:'12px 14px', background:'rgba(245,158,11,0.10)',
              border:'1px solid rgba(245,158,11,0.22)',
              borderRadius:10,
              display:'flex', gap:10, alignItems:'flex-start', marginBottom:18,
            }}>
              <Ico d={ICONS.shield} w={16} fill={M.warn} sw={0}/>
              <div style={{fontSize:12, color:M.warn, lineHeight:1.55}}>
                请前往 <strong>testnet.binance.vision</strong> 申请独立的测试网密钥(主网密钥不可用)。测试网币每 24h 自动重置,可放心调试策略。
              </div>
            </div>
          ) : (
            <div style={{
              padding:'12px 14px', background:M.warnSoft, borderRadius:10,
              display:'flex', gap:10, alignItems:'flex-start', marginBottom:18,
            }}>
              <Ico d={ICONS.shield} w={16} fill={M.warn} sw={0}/>
              <div style={{fontSize:12, color:M.warn, lineHeight:1.55}}>
                {meta.mode === 'wallet' ? (
                  <><strong>Agent 钱包</strong>仅有下单权限，永远无法转账或提币——主钱包资产始终由你掌控。请勿粘贴主钱包私钥。</>
                ) : (
                  <><strong>必须</strong>在 {ex} 后台关闭「提币」权限。我们的服务端会再校验一次，发现允许提币的密钥会立即拒绝。</>
                )}
              </div>
            </div>
          )}

          {meta.mode === 'wallet' ? (<>
            <CfgInput
              label="主钱包地址"
              required
              value="0x7a3F…b9C2e"
            />
            <CfgInput
              label="Agent 私钥"
              required
              value="••••••••••••••••••••"
            />
            <div style={{
              marginTop:-6, marginBottom:14, fontSize:11, color:M.dim, lineHeight:1.5,
            }}>
              在 Hyperliquid → More → API 中生成 <strong>Agent Wallet</strong>，把它的私钥粘到这里。Agent 私钥只能下单、不能动资产；主钱包地址用于读取持仓。
            </div>
          </>) : (<>
            <CfgInput
              label="API Key"
              required
              value={isTest ? 'tNet_8K9c…3pXqR7Fw' : '3aJ8…BcF9zX1qW4eR7tY'}
            />
            <CfgInput label={meta.secretLabel} required value="••••••••••••••••••••••"/>
            {meta.passphrase && (
              <CfgInput
                label="Passphrase"
                required
                value="••••••••••••"
              />
            )}
            {meta.passphrase && (
              <div style={{
                marginTop:-6, marginBottom:14, fontSize:11, color:M.dim, lineHeight:1.5,
              }}>
                创建 API Key 时由你自行设置的口令，{ex} 不会再次展示。三项缺一不可，否则无法签名下单。
              </div>
            )}
          </>)}
          <CfgInput
            label="备注"
            value={isTest ? '测试网 · 调试策略' : '主账户 · 现货 + 永续'}
          />

          {/* endpoint hint — small, mono, only when testnet */}
          {isTest && (
            <div style={{
              padding:'10px 12px', marginBottom:14,
              background:M.soft, border:`1px solid ${M.borderSoft}`,
              borderRadius:10,
            }}>
              <div style={{fontSize:11, color:M.dim, marginBottom:4, fontWeight:600}}>
                接口域名
              </div>
              <div style={{
                fontFamily:M.mono, fontSize:12, color:M.text, fontWeight:500,
                wordBreak:'break-all',
              }}>
                https://testnet.binance.vision
              </div>
            </div>
          )}

          <CfgLabel>授权权限</CfgLabel>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {meta.mode === 'wallet' ? (<>
              <PermRow label="读取账户与持仓" v="必需" on/>
              <PermRow label="永续 / 现货下单" v="必需" on/>
              <PermRow label="转账 / 提币" v="Agent 无权限" disabled/>
            </>) : (<>
              <PermRow label="读取账户与持仓" v="必需" on/>
              <PermRow label="现货下单" v="必需" on/>
              <PermRow label="合约下单" v="可选" on/>
              <PermRow
                label="提币"
                v={isTest ? '测试网无提币' : '必须关闭'}
                blocked={!isTest}
                disabled={isTest}
              />
            </>)}
          </div>
        </div>

        <div style={{
          padding:'12px 20px 36px', borderTop:`1px solid ${M.borderSoft}`,
          display:'flex', gap:10,
        }}>
          <button style={{
            flex:1, height:46, borderRadius:12, border:`1px solid ${M.border}`,
            background:M.elev, color:M.mid, fontSize:14, fontWeight:500,
          }}>取消</button>
          <button style={{
            flex:2, height:46, borderRadius:12, border:0,
            background: isTest
              ? 'linear-gradient(135deg, #F59E0B, #D97706)'
              : M.violetGrad,
            color:'#fff', fontSize:14, fontWeight:600,
            boxShadow: isTest
              ? '0 6px 20px rgba(245,158,11,0.32)'
              : '0 6px 20px rgba(124,92,255,0.32)',
          }}>
            {isTest ? '保存测试网密钥' : '验证并保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PermRow({ label, v, on, blocked, disabled }) {
  const tone = disabled ? M.dim : (blocked ? M.danger : on ? M.ok : M.dim);
  const bg   = disabled ? M.soft : (blocked ? M.dangerSoft : on ? M.okSoft : M.soft);
  const icon = disabled ? 'M5 12h14' : (blocked ? ICONS.close : ICONS.check);
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
      background:M.soft, borderRadius:10, opacity: disabled ? 0.6 : 1,
    }}>
      <div style={{
        width:24, height:24, borderRadius:6, background:bg, color:tone,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <Ico d={icon} w={14} sw={2.4}/>
      </div>
      <span style={{flex:1, fontSize:13, color: disabled ? M.dim : M.text}}>{label}</span>
      <span style={{fontSize:11, color:tone, fontWeight:600, whiteSpace:'nowrap'}}>{v}</span>
    </div>
  );
}

Object.assign(window, { ScreenWhale, ScreenAccount, ScreenApiConfig, WhaleNotifPanel, WHALE_NOTIFS });

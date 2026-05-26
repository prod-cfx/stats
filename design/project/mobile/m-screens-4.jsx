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

const WHALES_M = [
  { n:'Galaxy Digital',     ad:'0xa83…b8f2', v:'BINANCE',     s:'buy',  amt:'+842',   usd:'$57.6M',  usdN:57.6,  tags:['机构'],         time:'刚刚',   tg:'now',    fresh:true},
  { n:'Smart Money · 7D',   ad:'0x7c1…44a3', v:'ON-CHAIN',    s:'buy',  amt:'+1,204', usd:'$82.4M',  usdN:82.4,  tags:['聪明钱'],       time:'2 分钟', tg:'now'},
  { n:'Cumberland',         ad:'0x4f9…0e1c', v:'HYPERLIQUID', s:'sell', amt:'-318',   usd:'$21.8M',  usdN:21.8,  tags:['机构'],         time:'5 分钟', tg:'now'},
  { n:'早期持有者',          ad:'0xb2e…91d7', v:'COLD WALLET', s:'buy',  amt:'+512',   usd:'$35.0M',  usdN:35.0,  tags:['长期持有'],     time:'12 分钟',tg:'15m'},
  { n:'机构托管 · Fireblocks',ad:'0x88e…3a01', v:'FIREBLOCKS', s:'buy',  amt:'+1,840', usd:'$125.9M', usdN:125.9, tags:['机构','巨额'],  time:'24 分钟',tg:'15m'},
  { n:'Jump Trading',       ad:'0x1aa…ee82', v:'BINANCE',     s:'sell', amt:'-220',   usd:'$15.0M',  usdN:15.0,  tags:['机构'],         time:'38 分钟',tg:'1h'},
  { n:'新地址 · 30 天活跃',  ad:'0x9e2…cd44', v:'BYBIT',       s:'buy',  amt:'+96',    usd:'$6.5M',   usdN:6.5,   tags:['新地址'],       time:'52 分钟',tg:'1h'},
];

const MAX_USD = Math.max(...WHALES_M.map(w => w.usdN));

const GROUPS = [
  { k:'now', label:'最近 5 分钟', live:true },
  { k:'15m', label:'15 分钟内' },
  { k:'1h',  label:'过去 1 小时' },
];

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

function ScreenWhale() {
  const [tab, setTab] = React.useState('实时');
  const [asset, setAsset] = React.useState('BTC');
  const [notif, setNotif] = React.useState(false);
  const [notifTab, setNotifTab] = React.useState('全部');
  const [notifData, setNotifData] = React.useState(WHALE_NOTIFS);
  const unread = notifData.filter(n => n.unread).length;
  const markAllRead = () => setNotifData(notifData.map(n => ({...n, unread:false})));
  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus/>
      <MTopBar title="巨鲸动向" sub="链上 + 交易所" right={
        <div style={{display:'flex', gap:6}}>
          <button style={iconBtn}><Ico d={ICONS.search} w={18}/></button>
          <button onClick={()=>setNotif(true)} style={{...iconBtn, position:'relative'}}>
            <Ico d={ICONS.bell} w={18}/>
            {unread > 0 && (
              <span style={{
                position:'absolute', top:5, right:5,
                minWidth:14, height:14, padding:'0 3px', borderRadius:7,
                background:M.danger, color:'#fff', fontSize:9, fontWeight:700,
                fontFamily:M.mono, display:'flex', alignItems:'center', justifyContent:'center',
                border:`1.5px solid ${M.elev}`, letterSpacing:0,
              }}>{unread}</span>
            )}
          </button>
        </div>
      }/>

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

      {/* tabs */}
      <div style={{padding:'4px 16px 0', background:M.elev, borderBottom:`1px solid ${M.borderSoft}`}}>
        <div style={{display:'flex', gap:20, fontSize:13}}>
          {['发现','实时','持仓','监控'].map(t => {
            const on = t === tab;
            return (
              <button key={t} onClick={()=>setTab(t)} style={{
                background:'transparent', border:0, padding:'10px 0', cursor:'pointer',
                color: on ? M.text : M.mid, fontWeight: on ? 700 : 500, fontSize:13,
                borderBottom: on ? `2px solid ${M.violet}` : '2px solid transparent',
              }}>{t}</button>
            );
          })}
        </div>
      </div>

      <div style={{flex:1, overflow:'auto', paddingBottom:100}}>
        {tab === '实时' && <WhaleLive asset={asset} setAsset={setAsset}/>}
        {tab === '发现' && <WhaleDiscover/>}
        {tab === '持仓' && <WhaleHoldings/>}
        {tab === '监控' && <WhaleWatch/>}
      </div>
      <MTabBar active="whale"/>

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

/* ---- 实时 (Live) ---- */
function WhaleLive({ asset, setAsset }) {
  return (
    <React.Fragment>
      {/* hero net flow card */}
      <div style={{padding:'14px 16px 8px', background:M.elev}}>
        <div style={{
          border:`1px solid ${M.borderSoft}`, borderRadius:14, padding:'14px 14px 12px',
          background:`linear-gradient(180deg, var(--mk-up-soft) 0%, transparent 70%)`,
        }}>
          <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:10, color:M.dim, letterSpacing:0.6, textTransform:'uppercase', fontWeight:600}}>
                BTC 净流入 · 1H
              </div>
              <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:6}}>
                <span style={{fontSize:26, fontWeight:700, color:M.up, fontFamily:M.mono, letterSpacing:-0.5}}>+$284M</span>
                <span style={{fontSize:12, color:M.up, fontFamily:M.mono, fontWeight:600}}>+18.4%</span>
              </div>
              <div style={{fontSize:11, color:M.dim, marginTop:4}}>
                累计 4,128 BTC · 较昨日同期 +62%
              </div>
            </div>
            <div style={{paddingTop:6}}>
              <FlowSpark tone="up"/>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:0, marginTop:14, paddingTop:12, borderTop:`1px solid ${M.borderSoft}`}}>
            <HeroStat label="大额交易" v="42" sub="≥ $1M"/>
            <HeroStat label="活跃巨鲸" v="18" sub="过去 1H"/>
            <HeroStat label="净增持" v="+2,640" sub="BTC" tone="up"/>
          </div>
        </div>
      </div>

      {/* filter strip */}
      <div style={{
        padding:'10px 16px 10px', background:M.elev,
        display:'flex', alignItems:'center', gap:10,
        borderBottom:`6px solid ${M.bg}`,
      }}>
        <div style={{display:'flex', gap:6, flex:1, overflow:'hidden'}}>
          {['BTC','ETH','SOL','全部'].map(a => {
            const on = a === asset;
            return (
              <button key={a} onClick={()=>setAsset(a)} style={{
                height:28, padding:'0 12px', borderRadius:14,
                border: on ? 0 : `1px solid ${M.border}`,
                background: on ? M.text : M.elev,
                color: on ? M.elev : M.mid,
                fontSize:12, fontWeight: on ? 600 : 500, cursor:'pointer',
              }}>{a}</button>
            );
          })}
        </div>
        <button style={{
          height:28, padding:'0 10px 0 8px', borderRadius:14,
          border:`1px solid ${M.border}`, background:M.elev, color:M.mid,
          fontSize:12, fontWeight:500, cursor:'pointer',
          display:'inline-flex', alignItems:'center', gap:4,
        }}>
          <Ico d={ICONS.filter} w={13}/>
          <span>≥ $5M</span>
        </button>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:5, fontSize:11,
          color:M.up, fontWeight:600, fontFamily:M.mono, letterSpacing:0.5,
        }}>
          <span style={{
            width:6, height:6, borderRadius:3, background:M.up,
            boxShadow:`0 0 0 0 var(--mk-up)`, animation:'mw-pulse 1.6s ease-out infinite',
          }}/>
          LIVE
        </span>
      </div>

      {/* time-grouped activity feed */}
      <div style={{background:M.elev}}>
        {GROUPS.map(g => {
          const rows = WHALES_M.filter(w => w.tg === g.k);
          if (!rows.length) return null;
          return (
            <React.Fragment key={g.k}>
              <div style={{
                padding:'12px 16px 6px',
                display:'flex', alignItems:'center', gap:8,
                fontSize:11, color:M.dim, fontWeight:600,
                letterSpacing:0.4, textTransform:'uppercase',
                background:M.elev,
              }}>
                <span>{g.label}</span>
                <span style={{flex:1, height:1, background:M.borderSoft}}/>
                <span style={{fontFamily:M.mono, color:M.mid}}>{rows.length}</span>
              </div>
              {rows.map((w, i) => <WhaleRow key={i} w={w}/>)}
            </React.Fragment>
          );
        })}
      </div>

      {/* watchlist CTA */}
      <div style={{padding:'14px 16px 8px', background:M.elev}}>
        <button style={{
          width:'100%', height:44, borderRadius:12,
          border:`1px dashed ${M.border}`, background:'transparent',
          color:M.mid, fontSize:13, fontWeight:500, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        }}>
          <Ico d={ICONS.plus} w={15} sw={2}/>
          <span>添加地址监控</span>
        </button>
      </div>
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

/* ---- 持仓 (Holdings) ---- */
const EX_FLOW = [
  { ex:'Binance',  net:'-820 BTC', tone:'dn', c:'#F0B90B', bar:78 },
  { ex:'Coinbase', net:'+412 BTC', tone:'up', c:'#2563EB', bar:39 },
  { ex:'OKX',      net:'-186 BTC', tone:'dn', c:'#0B0B0B', bar:18 },
  { ex:'Bybit',    net:'-92 BTC',  tone:'dn', c:'#F59E0B', bar:9 },
];
const HOLDERS = [
  { rk:1, lbl:'MicroStrategy',  amt:'628,914 BTC',  ch:'+8,200',  tone:'up' },
  { rk:2, lbl:'BlackRock IBIT', amt:'582,400 BTC',  ch:'+12,400', tone:'up' },
  { rk:3, lbl:'Mt.Gox 托管',     amt:'141,686 BTC',  ch:'—',       tone:'flat' },
  { rk:4, lbl:'Tesla Inc.',     amt:'9,720 BTC',    ch:'0',       tone:'flat' },
  { rk:5, lbl:'Marathon',       amt:'48,200 BTC',   ch:'+820',    tone:'up' },
];
function WhaleHoldings() {
  const maxBar = Math.max(...EX_FLOW.map(e => e.bar));
  return (
    <React.Fragment>
      <div style={{padding:'14px 16px 6px', background:M.elev}}>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10}}>
          <div>
            <div style={{fontSize:15, fontWeight:700, color:M.text, letterSpacing:-0.2}}>交易所 BTC 余额</div>
            <div style={{fontSize:11, color:M.dim, marginTop:2}}>24H 净变动 · 负值=资金离场</div>
          </div>
          <span style={{fontSize:11, color:M.dim, fontFamily:M.mono}}>24H</span>
        </div>
        <div style={{border:`1px solid ${M.borderSoft}`, borderRadius:12, overflow:'hidden'}}>
          {EX_FLOW.map((e, i) => {
            const w = Math.round((e.bar / maxBar) * 100);
            const isUp = e.tone === 'up';
            return (
              <div key={e.ex} style={{
                padding:'12px 14px',
                borderBottom: i === EX_FLOW.length - 1 ? 0 : `1px solid ${M.borderSoft}`,
              }}>
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <span style={{width:8, height:8, borderRadius:4, background:e.c, flexShrink:0}}/>
                  <span style={{fontSize:13, fontWeight:600, color:M.text, flex:1}}>{e.ex}</span>
                  <span style={{
                    fontSize:13, fontWeight:700, fontFamily:M.mono,
                    color: isUp ? M.up : M.dn, letterSpacing:-0.2,
                  }}>{e.net}</span>
                </div>
                <div style={{
                  marginTop:8, marginLeft:18,
                  height:4, borderRadius:2, background:M.soft, overflow:'hidden',
                }}>
                  <div style={{width:`${w}%`, height:'100%', background: isUp ? M.up : M.dn, opacity:0.85}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{padding:'18px 16px 8px', background:M.elev}}>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10}}>
          <div style={{fontSize:15, fontWeight:700, color:M.text, letterSpacing:-0.2}}>头部地址持仓</div>
          <span style={{fontSize:11, color:M.dim}}>公开标签 · 7D 变化</span>
        </div>
        <div style={{border:`1px solid ${M.borderSoft}`, borderRadius:12, overflow:'hidden'}}>
          {HOLDERS.map((h, i) => (
            <div key={h.rk} style={{
              display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
              borderBottom: i === HOLDERS.length - 1 ? 0 : `1px solid ${M.borderSoft}`,
            }}>
              <span style={{
                fontSize:11, color:M.dim, fontFamily:M.mono, fontWeight:600,
                width:18, textAlign:'center', flexShrink:0,
              }}>{h.rk}</span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:13, fontWeight:600, color:M.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{h.lbl}</div>
                <div style={{fontSize:11, color:M.mid, fontFamily:M.mono, marginTop:2}}>{h.amt}</div>
              </div>
              <span style={{
                fontSize:12, fontWeight:700, fontFamily:M.mono,
                color: h.tone==='up' ? M.up : h.tone==='dn' ? M.dn : M.dim,
                minWidth:64, textAlign:'right', flexShrink:0,
              }}>{h.ch}</span>
            </div>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---- 监控 (Watch) ---- */
const WATCH = [
  { n:'我的关注 · 1', ad:'0xa83…b8f2', last:'+842 BTC · 刚刚',   tone:'up', pnl:'+12.8%', live:true },
  { n:'Cumberland',  ad:'0x4f9…0e1c', last:'-318 BTC · 5 分钟', tone:'dn', pnl:'-3.2%' },
  { n:'冷钱包 · 早期', ad:'0xb2e…91d7', last:'+512 BTC · 12 分钟', tone:'up', pnl:'+24.6%' },
];
const ALERTS = [
  { type:'大额转入', detail:'0xa83…b8f2 → BINANCE · 842 BTC',  time:'刚刚',    tone:'up' },
  { type:'阈值触发', detail:'0x88e…3a01 单笔 ≥ $100M',          time:'24 分钟', tone:'warn' },
  { type:'地址休眠', detail:'0xb2e…91d7 9 年首次活跃',           time:'1 小时',  tone:'info' },
];
function WhaleWatch() {
  return (
    <React.Fragment>
      <div style={{padding:'14px 16px 6px', background:M.elev}}>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10}}>
          <div style={{fontSize:15, fontWeight:700, color:M.text, letterSpacing:-0.2}}>我的监控</div>
          <span style={{fontSize:11, color:M.dim, fontFamily:M.mono}}>{WATCH.length} 个地址</span>
        </div>
        <div style={{border:`1px solid ${M.borderSoft}`, borderRadius:12, overflow:'hidden'}}>
          {WATCH.map((w, i) => {
            const isUp = w.tone === 'up';
            return (
              <div key={w.ad} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                borderBottom: i === WATCH.length - 1 ? 0 : `1px solid ${M.borderSoft}`,
              }}>
                <div style={{
                  width:34, height:34, borderRadius:10, background: isUp ? M.upSoft : M.dnSoft,
                  color: isUp ? M.up : M.dn,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                }}>
                  <Ico d={isUp ? ICONS.arrowU : ICONS.arrowD} w={14} sw={2.4}/>
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    <span style={{fontSize:13, fontWeight:600, color:M.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0}}>{w.n}</span>
                    {w.live && <span style={{width:6, height:6, borderRadius:3, background:M.up, animation:'mw-pulse 1.6s ease-out infinite', flexShrink:0}}/>}
                  </div>
                  <div style={{fontSize:11, color:M.dim, fontFamily:M.mono, marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                    {w.ad} · {w.last}
                  </div>
                </div>
                <div style={{textAlign:'right', flexShrink:0, minWidth:60}}>
                  <div style={{fontSize:13, fontWeight:700, fontFamily:M.mono, color: isUp ? M.up : M.dn, letterSpacing:-0.2}}>{w.pnl}</div>
                  <div style={{fontSize:10, color:M.faint, marginTop:2}}>7D PnL</div>
                </div>
              </div>
            );
          })}
        </div>
        <button style={{
          marginTop:10, width:'100%', height:44, borderRadius:12,
          border:`1px dashed ${M.border}`, background:'transparent',
          color:M.mid, fontSize:13, fontWeight:500, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        }}>
          <Ico d={ICONS.plus} w={15} sw={2}/>
          <span>添加地址监控</span>
        </button>
      </div>

      <div style={{padding:'18px 16px 8px', background:M.elev}}>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10}}>
          <div style={{fontSize:15, fontWeight:700, color:M.text, letterSpacing:-0.2}}>最近告警</div>
          <span style={{fontSize:11, color:M.violet, fontWeight:600, cursor:'pointer'}}>规则 ›</span>
        </div>
        <div style={{border:`1px solid ${M.borderSoft}`, borderRadius:12, overflow:'hidden'}}>
          {ALERTS.map((a, i) => {
            const palette = a.tone === 'up'   ? { fg:M.up,     bg:M.upSoft }
                          : a.tone === 'warn' ? { fg:M.warn,   bg:M.warnSoft }
                          : a.tone === 'info' ? { fg:M.violet, bg:M.violetSoft }
                          : { fg:M.mid, bg:M.soft };
            return (
              <div key={i} style={{
                display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px',
                borderBottom: i === ALERTS.length - 1 ? 0 : `1px solid ${M.borderSoft}`,
              }}>
                <span style={{
                  fontSize:10, padding:'3px 8px', borderRadius:4,
                  color:palette.fg, background:palette.bg, fontWeight:600,
                  flexShrink:0, marginTop:1,
                }}>{a.type}</span>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:12, color:M.text, fontFamily:M.mono, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{a.detail}</div>
                  <div style={{fontSize:10, color:M.dim, marginTop:3}}>{a.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </React.Fragment>
  );
}

function WhaleRow({ w }) {
  const isBuy = w.s === 'buy';
  const venue = VENUE[w.v] || { c:M.mid };
  const barPct = Math.min(100, Math.round((w.usdN / MAX_USD) * 100));
  return (
    <div style={{
      padding:'12px 16px 10px',
      borderBottom:`1px solid ${M.borderSoft}`,
      position:'relative',
    }}>
      <div style={{display:'flex', alignItems:'flex-start', gap:12}}>
        <div style={{
          width:36, height:36, borderRadius:10,
          background: isBuy ? M.upSoft : M.dnSoft,
          color: isBuy ? M.up : M.dn,
          display:'flex', alignItems:'center', justifyContent:'center',
          flexShrink:0,
        }}>
          <Ico d={isBuy ? ICONS.arrowU : ICONS.arrowD} w={16} sw={2.4}/>
        </div>

        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:6, minWidth:0}}>
            <span style={{
              fontSize:14, fontWeight:600, color:M.text,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              minWidth:0,
            }}>{w.n}</span>
            {w.fresh && (
              <span style={{
                width:6, height:6, borderRadius:3, background:M.up, flexShrink:0,
                animation:'mw-pulse 1.6s ease-out infinite',
              }}/>
            )}
          </div>

          <div style={{
            display:'flex', alignItems:'center', gap:6, marginTop:4,
            fontSize:11, color:M.dim, fontFamily:M.mono,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>
            <span>{w.ad}</span>
            <span style={{color:M.faint}}>·</span>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:4,
              fontFamily:M.sans, fontWeight:500, color:M.mid, flexShrink:0,
            }}>
              <span style={{width:6, height:6, borderRadius:3, background:venue.c, flexShrink:0}}/>
              {w.v}
            </span>
          </div>

          {w.tags && w.tags.length > 0 && (
            <div style={{display:'flex', gap:5, marginTop:6, flexWrap:'wrap'}}>
              {w.tags.map(t => {
                const ts = TAG_STYLE[t] || { fg:M.mid, bg:M.soft };
                return (
                  <span key={t} style={{
                    fontSize:10, padding:'2px 7px', borderRadius:4,
                    color:ts.fg, background:ts.bg, fontWeight:600, letterSpacing:0.2,
                  }}>{t}</span>
                );
              })}
            </div>
          )}
        </div>

        <div style={{textAlign:'right', flexShrink:0, minWidth:96, whiteSpace:'nowrap'}}>
          <div style={{
            fontSize:14, fontWeight:700, fontFamily:M.mono,
            color: isBuy ? M.up : M.dn, letterSpacing:-0.2,
            whiteSpace:'nowrap',
          }}>{w.amt} BTC</div>
          <div style={{fontSize:12, color:M.text, fontFamily:M.mono, fontWeight:600, marginTop:2, whiteSpace:'nowrap'}}>{w.usd}</div>
          <div style={{fontSize:10, color:M.dim, marginTop:2, whiteSpace:'nowrap'}}>{w.time}</div>
        </div>
      </div>

      {/* relative-size flow bar */}
      <div style={{
        marginTop:8, marginLeft:48,
        height:3, borderRadius:2, background:M.soft, overflow:'hidden',
      }}>
        <div style={{
          width:`${barPct}%`, height:'100%',
          background: isBuy ? M.up : M.dn, opacity:0.85,
          borderRadius:2,
        }}/>
      </div>
    </div>
  );
}

/* ========================================================================
   SCREEN 9 — Account / Profile (我的)
   ======================================================================== */
function ScreenAccount() {
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
          <Row label="语言" v="简体中文" right={<Ico d={ICONS.caretR} w={14} sw={2}/>}/>
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
function Row({ label, v, right, trunc, tone, last, mono }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'13px 16px',
      borderBottom: last ? 0 : `1px solid ${M.borderSoft}`,
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
function ApiRow({ ex, set, on, last }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
      borderBottom: last ? 0 : `1px solid ${M.borderSoft}`,
    }}>
      <div style={{
        width:36, height:36, borderRadius:10, background:M.soft, color:M.text,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontWeight:700, fontSize:13,
      }}>{ex[0]}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:14, fontWeight:600}}>{ex}</div>
        <div style={{fontSize:11, color: set ? M.ok : M.warn, marginTop:3}}>
          {set ? '已连接 · 读取 + 下单' : '未配置 · 部署策略前请配置'}
        </div>
      </div>
      <button style={{
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
function ScreenApiConfig() {
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
          <div style={{
            width:42, height:42, borderRadius:11, background:'#F0B90B',
            color:'#000', display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:800, fontSize:18,
          }}>B</div>
          <div>
            <div style={{fontSize:17, fontWeight:700}}>Binance API</div>
            <div style={{fontSize:12, color:M.mid, marginTop:2}}>仅保留读取 + 下单权限</div>
          </div>
        </div>

        <div style={{flex:1, overflow:'auto', padding:'18px 20px 20px'}}>
          <div style={{
            padding:'12px 14px', background:M.warnSoft, borderRadius:10,
            display:'flex', gap:10, alignItems:'flex-start', marginBottom:18,
          }}>
            <Ico d={ICONS.shield} w={16} fill={M.warn} sw={0}/>
            <div style={{fontSize:12, color:M.warn, lineHeight:1.55}}>
              <strong>必须</strong>在 Binance 后台关闭「提币」权限。我们的服务端会再校验一次，发现允许提币的密钥会立即拒绝。
            </div>
          </div>

          <CfgInput label="API Key" required value="3aJ8…BcF9zX1qW4eR7tY"/>
          <CfgInput label="Secret" required value="••••••••••••••••••••••"/>
          <CfgInput label="备注" value="主账户 · 现货 + 永续"/>

          <CfgLabel>授权权限</CfgLabel>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            <PermRow label="读取账户与持仓" v="必需" on/>
            <PermRow label="现货下单" v="必需" on/>
            <PermRow label="合约下单" v="可选" on/>
            <PermRow label="提币" v="必须关闭" blocked/>
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
            background:M.violetGrad, color:'#fff', fontSize:14, fontWeight:600,
            boxShadow:'0 6px 20px rgba(124,92,255,0.32)',
          }}>验证并保存</button>
        </div>
      </div>
    </div>
  );
}

function PermRow({ label, v, on, blocked }) {
  const tone = blocked ? M.danger : on ? M.ok : M.dim;
  const bg = blocked ? M.dangerSoft : on ? M.okSoft : M.soft;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
      background:M.soft, borderRadius:10,
    }}>
      <div style={{
        width:24, height:24, borderRadius:6, background:bg, color:tone,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <Ico d={blocked ? ICONS.close : ICONS.check} w={14} sw={2.4}/>
      </div>
      <span style={{flex:1, fontSize:13, color:M.text}}>{label}</span>
      <span style={{fontSize:11, color:tone, fontWeight:600}}>{v}</span>
    </div>
  );
}

Object.assign(window, { ScreenWhale, ScreenAccount, ScreenApiConfig, WhaleNotifPanel, WHALE_NOTIFS });

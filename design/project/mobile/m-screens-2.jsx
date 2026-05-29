/* Mobile screens part 2 — Config sheet, Strategy Marketplace, Market list */

/* ========================================================================
   SCREEN 3 — AI Config (bottom sheet over chat)
   ======================================================================== */
function ScreenAIConfig() {
  // strategy market type — when 合约, show leverage input
  const [market, setMarket] = React.useState('合约');
  return (
    <div className="m-sheet-scrim" style={{height:'100%', position:'relative', background:'rgba(15,22,35,0.55)', overflow:'hidden'}}>
      <MStatus dark/>
      {/* sheet */}
      <div className="m-sheet" style={{
        position:'absolute', left:0, right:0, bottom:0, top:120,
        background:M.elev, borderRadius:'24px 24px 0 0',
        boxShadow:'0 -16px 48px rgba(15,22,35,0.18)',
        display:'flex', flexDirection:'column',
      }}>
        <div style={{padding:'10px 0 0', display:'flex', justifyContent:'center'}}>
          <div style={{width:42, height:4, borderRadius:2, background:M.border}}/>
        </div>
        <div style={{padding:'12px 20px 6px', display:'flex', alignItems:'center'}}>
          <div>
            <div style={{fontSize:17, fontWeight:700, color:M.text}}>回测参数</div>
            <div style={{fontSize:12, color:M.mid, marginTop:2}}>策略参数请通过对话调整</div>
          </div>
          <div style={{flex:1}}/>
          <button data-action="close-sheet" style={{
            width:32, height:32, borderRadius:16, background:M.soft,
            border:0, color:M.mid, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}><Ico d={ICONS.close} w={16} sw={2}/></button>
        </div>

        <div style={{flex:1, overflow:'auto', padding:'14px 20px 20px'}}>
          <CfgLabel>历史回测区间</CfgLabel>
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:18}}>
            {['7D','30D','90D','1Y','自定义'].map(r => {
              const on = r === '30D';
              return (
                <span key={r} style={{
                  height:34, padding:'0 14px', borderRadius:999, fontSize:13, fontWeight:500,
                  display:'inline-flex', alignItems:'center',
                  background: on ? M.violetSoft : M.elev,
                  color: on ? M.violet : M.mid,
                  border:`1px solid ${on ? 'rgba(124,92,255,0.3)' : M.border}`,
                }}>{r}</span>
              );
            })}
          </div>

          <CfgLabel>市场类型</CfgLabel>
          <div style={{
            display:'flex', padding:3, marginBottom:18, borderRadius:11,
            background:M.soft, border:`1px solid ${M.borderSoft}`, gap:3,
          }}>
            {['现货','合约'].map(m => {
              const on = m === market;
              return (
                <button key={m} onClick={() => setMarket(m)} style={{
                  flex:1, height:36, borderRadius:8, border:0, cursor:'pointer',
                  background: on ? M.elev : 'transparent',
                  color: on ? M.violet : M.mid, fontSize:13,
                  fontWeight: on ? 600 : 500,
                  boxShadow: on ? '0 1px 3px rgba(15,22,35,0.06)' : 'none',
                  transition:'all 140ms',
                }}>{m}</button>
              );
            })}
          </div>

          <CfgInput label="初始资金" required value="10000" suffix="USDT"/>
          {market === '合约' && (
            <CfgSelect label="杠杆倍数" required defaultValue="5x"
              options={['1x','2x','3x','5x','10x','20x','50x','100x']}/>
          )}
          <CfgInput label="滑点" required value="5" suffix="bps"/>
          <CfgInput label="手续费" required value="2" suffix="bps"/>
          <CfgSelect label="成交价来源" required defaultValue="收盘价" options={['开盘价','收盘价','中间价']}/>
          <CfgSelect label="允许部分覆盖数据继续回测" required defaultValue="允许" options={['允许','不允许']}/>

          <div style={{
            marginTop:18, padding:'12px 14px', background:M.violetSoft, borderRadius:10,
            display:'flex', gap:10, alignItems:'flex-start',
          }}>
            <Ico d={ICONS.shield} w={16} fill={M.violet} sw={0}/>
            <div style={{fontSize:12, color:M.violet, lineHeight:1.55}}>
              开始回测后，AI 会保留当前对话的策略参数；想换参数请回到对话修改。
            </div>
          </div>
        </div>

        <div style={{
          padding:'12px 20px 36px', borderTop:`1px solid ${M.borderSoft}`,
          display:'flex', gap:10,
        }}>
          <button style={{
            flex:1, height:46, borderRadius:12, border:`1px solid ${M.border}`,
            background:M.elev, fontSize:14, fontWeight:500, color:M.mid,
          }}>收起</button>
          <button style={{
            flex:2, height:46, borderRadius:12, border:0,
            background:M.violetGrad, color:'#fff', fontSize:14, fontWeight:600,
            boxShadow:'0 6px 20px rgba(124,92,255,0.32)',
          }}>确认并开始回测</button>
        </div>
      </div>
    </div>
  );
}
function CfgLabel({ children }) {
  return <div style={{fontSize:12, color:M.mid, marginBottom:8, fontWeight:500}}>{children}</div>;
}
function CfgInput({ label, value, suffix, required }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:12, color:M.mid, marginBottom:6}}>
        {label}{required && <span style={{color:M.danger}}> *</span>}
      </div>
      <div style={{
        height:44, padding:'0 14px', borderRadius:11, background:M.soft,
        border:`1px solid ${M.borderSoft}`, display:'flex', alignItems:'center', gap:10,
      }}>
        <span style={{flex:1, fontSize:14, color:M.text, fontFamily:M.mono}}>{value}</span>
        {suffix && <span style={{fontSize:12, color:M.dim}}>{suffix}</span>}
      </div>
    </div>
  );
}
function CfgSelect({ label, value, defaultValue, options, required }) {
  const [open, setOpen] = React.useState(false);
  const [val, setVal] = React.useState(defaultValue || value);
  const opts = options || [val];
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  return (
    <div style={{marginBottom:14, position:'relative'}} ref={ref}>
      <div style={{fontSize:12, color:M.mid, marginBottom:6}}>
        {label}{required && <span style={{color:M.danger}}> *</span>}
      </div>
      <div
        onClick={() => options && setOpen(o => !o)}
        style={{
          height:44, padding:'0 14px', borderRadius:11, background:M.soft,
          border:`1px solid ${open ? M.violet : M.borderSoft}`,
          display:'flex', alignItems:'center', cursor: options ? 'pointer' : 'default',
          transition:'border-color 120ms',
        }}>
        <span style={{flex:1, fontSize:14, color:M.text}}>{val}</span>
        <span style={{
          display:'flex', transform: open ? 'rotate(180deg)' : 'none',
          transition:'transform 160ms', color:M.mid,
        }}>
          <Ico d={ICONS.caret} w={16} sw={1.8}/>
        </span>
      </div>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:20,
          background:M.elev, borderRadius:11, border:`1px solid ${M.border}`,
          boxShadow:'0 12px 32px rgba(15,22,35,0.18)', overflow:'hidden',
        }}>
          {opts.map((o, i) => {
            const active = o === val;
            return (
              <div
                key={o}
                onClick={() => { setVal(o); setOpen(false); }}
                style={{
                  height:44, padding:'0 14px', display:'flex', alignItems:'center',
                  fontSize:14, color: active ? M.violet : M.text, fontWeight: active ? 500 : 400,
                  background: active ? M.violetSoft : 'transparent', cursor:'pointer',
                  borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
                }}>
                <span style={{flex:1}}>{o}</span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke={M.violet} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12l5 5L20 6"/>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ========================================================================
   SCREEN 4 — STRATEGY MARKETPLACE
   ======================================================================== */
const STRATS = [
  { id:'s1', name:'BTC 网格 · 7D 波段', tag:'网格', tagTone:'info', sym:'BTC', tone:'#F7931A',
    desc:'区间震荡时收益稳定，单次回撤可控。低波动期表现最佳。',
    cagr:47.3, sharpe:2.14, mdd:-9.8, win:62.4, users:4218, pair:'BTC/USDT', period:'30D',
    author:'量化小酌', authorTone:'#7C5CFF', verified:true, status:'hot',
    seed:[100,102,101,104,106,105,108,109,107,112,114,115,118,120,119,123,127,126,130,134,133,138,141,140,145,148,147,152,156,158] },
  { id:'s2', name:'ETH 趋势跟踪 · 4H', tag:'趋势', tagTone:'violet', sym:'ETH', tone:'#627EEA',
    desc:'均线突破开多，跌破止损。趋势行情捕捉率高。',
    cagr:31.6, sharpe:1.78, mdd:-12.4, win:54.1, users:2812, pair:'ETH/USDT', period:'90D',
    author:'CryptoQuant', authorTone:'#06B6D4', verified:true, status:'official',
    seed:[100,99,103,107,104,108,113,109,115,118,116,121,119,125,130,127,133,131,128,134,138,135,141,139,135,140,144,142,138,131] },
  { id:'s3', name:'资金费率套利 · 永续', tag:'套利', tagTone:'ok', sym:'⚡', tone:'#16A36B',
    desc:'抓取负费率窗口对冲套利，市场中性收益。',
    cagr:18.9, sharpe:3.42, mdd:-3.1, win:81.6, users:1124, pair:'多币种', period:'14D',
    author:'Sigma 实验室', authorTone:'#16A36B', verified:true, status:'new',
    seed:[100,100,101,101,102,103,103,104,104,105,106,107,107,108,109,110,111,112,113,114,115,116,117,118,118,119,119,118,119,119] },
  { id:'s4', name:'SOL 均值回归 · 15m', tag:'反转', tagTone:'warn', sym:'SOL', tone:'#9945FF',
    desc:'RSI 触底反弹，目标均线。高频小止盈策略。',
    cagr:22.5, sharpe:1.42, mdd:-8.1, win:58.3, users:962, pair:'SOL/USDT', period:'30D',
    author:'aurora.eth', authorTone:'#F59E0B', verified:false, status:null,
    seed:[100,104,99,103,98,102,97,101,99,103,98,104,100,106,102,108,104,110,106,112,108,114,110,116,112,118,114,120,116,123] },
  { id:'s5', name:'多空对冲 · BTC/ETH', tag:'对冲', tagTone:'info', sym:'⇄', tone:'#0EA5E9',
    desc:'BTC 多 / ETH 空配对交易，β 对冲。',
    cagr:14.8, sharpe:2.86, mdd:-4.2, win:69.2, users:540, pair:'BTC-ETH', period:'90D',
    author:'PairTrader', authorTone:'#0EA5E9', verified:true, status:null,
    seed:[100,101,99,102,103,101,104,105,103,106,107,105,108,110,108,111,112,110,113,114,112,115,116,114,117,118,116,119,120,118] },
  { id:'s6', name:'BNB 高频做市 · 1m', tag:'高频', tagTone:'danger', sym:'BNB', tone:'#F0B90B',
    desc:'毫秒级双边挂单，赚取价差。需 VIP 手续费。',
    cagr:62.4, sharpe:2.65, mdd:-15.2, win:71.0, users:386, pair:'BNB/USDT', period:'7D',
    author:'HFT Pro', authorTone:'#EF4444', verified:true, status:'pro',
    seed:[100,103,106,104,109,112,108,114,119,116,122,127,123,130,135,131,140,145,141,150,156,152,162,168,164,175,181,177,189,196] },
  { id:'s7', name:'DCA 定投 · 月度', tag:'网格', tagTone:'info', sym:'DCA', tone:'#7C5CFF',
    desc:'每月固定金额买入。最简单稳健。',
    cagr:23.8, sharpe:1.18, mdd:-22.4, win:48.5, users:8910, pair:'BTC/USDT', period:'1Y',
    author:'Quantify 官方', authorTone:'#7C5CFF', verified:true, status:'official',
    seed:[100,98,96,99,102,98,95,99,104,102,106,108,105,110,114,111,116,120,118,124,128,125,132,137,134,141,146,143,150,156] },
];

const TAG_FILTERS = ['全部','趋势','网格','套利','反转','对冲','高频'];

/* trending search terms surfaced in the strategy search overlay (empty state) */
const STRAT_TRENDING = ['网格','趋势跟踪','资金费率套利','BTC','低回撤','市场中性','DCA 定投','高频做市'];

/* ---- 策略广场 搜索 — 全屏联合搜索 (策略 / 作者 / 标签) ---- */
function StratSearchOverlay({ open, onClose, onOpenStrat, onPickTag }) {
  const [query, setQuery] = React.useState('');
  const [history, setHistory] = React.useState(['BTC 网格', '资金费率套利', '趋势跟踪']);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (open) { setQuery(''); setTimeout(() => inputRef.current && inputRef.current.focus(), 0); }
  }, [open]);
  if (!open) return null;

  const q = query.trim().toLowerCase();
  const commit = (term) => {
    const t = (term || '').trim();
    if (t) setHistory(h => [t, ...h.filter(x => x !== t)].slice(0, 10));
  };

  // federated matches
  const stratHits = q
    ? STRATS.filter(s => (s.name + s.tag + s.sym + s.pair + s.desc + s.author).toLowerCase().includes(q))
    : [];
  const authorHits = q
    ? [...new Set(STRATS.map(s => s.author))]
        .filter(a => a.toLowerCase().includes(q))
        .map(a => {
          const list = STRATS.filter(s => s.author === a);
          return { name: a, tone: list[0].authorTone, verified: list[0].verified, count: list.length };
        })
    : [];
  const tagHits = q ? TAG_FILTERS.filter(t => t !== '全部' && t.toLowerCase().includes(q)) : [];
  const noResults = q && !stratHits.length && !authorHits.length && !tagHits.length;

  const openStrat = (id) => { commit(query); onOpenStrat(id); onClose(); };
  const pickTag = (t) => { commit(t); onPickTag && onPickTag(t); onClose(); };

  const chipStyle = {
    padding:'7px 14px', borderRadius:999, border:0, background:M.elev,
    color:M.mid, cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:M.sans,
    display:'inline-flex', alignItems:'center', gap:6,
  };
  const sectionLabel = {
    fontSize:11, fontWeight:600, color:M.dim, letterSpacing:0.4,
    textTransform:'uppercase', margin:'18px 0 10px',
  };

  const StratRow = ({ s }) => (
    <div onClick={()=>openStrat(s.id)} style={{
      display:'flex', alignItems:'center', gap:11, padding:'11px 4px',
      borderBottom:`1px solid ${M.borderSoft}`, cursor:'pointer',
    }}>
      <Av sym={s.sym.slice(0,2)} bg={s.tone} size={36}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:3}}>
          <span style={{fontSize:14, fontWeight:600, color:M.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.name}</span>
          <span style={{
            flexShrink:0, fontSize:10, fontWeight:600, color:M.violet,
            background:M.violetSoft, borderRadius:5, padding:'1px 6px',
          }}>{s.tag}</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:12, fontSize:11, fontFamily:M.mono, color:M.dim}}>
          <span style={{color: s.cagr >= 0 ? M.up : M.dn, fontWeight:600}}>CAGR {s.cagr >= 0 ? '+' : ''}{s.cagr}%</span>
          <span>胜率 {s.win}%</span>
          <span>{s.users.toLocaleString()} 跟单</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position:'absolute', inset:0, zIndex:80, background:M.bg, display:'flex', flexDirection:'column' }}>
      <MStatus/>
      {/* input row */}
      <div style={{ padding:'62px 16px 8px', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{
          flex:1, height:38, background:M.elev, border:`1px solid ${M.border}`, borderRadius:999,
          padding:'0 14px', display:'flex', alignItems:'center', gap:8,
        }}>
          <Ico d={ICONS.search} w={16} sw={1.8}/>
          <input
            ref={inputRef}
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="搜索策略 · 币对 · 作者"
            style={{ flex:1, border:0, outline:'none', background:'transparent', fontSize:13, color:M.text, fontFamily:M.sans, minWidth:0 }}
          />
          {query && (
            <button onClick={()=>{ setQuery(''); inputRef.current && inputRef.current.focus(); }} style={{
              border:0, background:M.border, color:M.bg, cursor:'pointer',
              width:16, height:16, borderRadius:8, padding:0, fontSize:11, lineHeight:1,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>×</button>
          )}
        </div>
        <button onClick={onClose} style={{
          border:0, background:'transparent', color:M.mid, cursor:'pointer',
          fontSize:13, fontWeight:500, fontFamily:M.sans, padding:'0 2px',
        }}>取消</button>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'4px 16px 24px' }}>
        {q ? (
          noResults ? (
            <div style={{ padding:'48px 16px', textAlign:'center', color:M.dim, fontSize:14 }}>未找到「{query.trim()}」相关结果</div>
          ) : (
            <React.Fragment>
              {tagHits.length > 0 && (
                <React.Fragment>
                  <div style={sectionLabel}>标签</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {tagHits.map(t => (
                      <button key={t} onClick={()=>pickTag(t)} style={{...chipStyle, background:M.violetSoft, color:M.violet}}>{t} 策略</button>
                    ))}
                  </div>
                </React.Fragment>
              )}
              {authorHits.length > 0 && (
                <React.Fragment>
                  <div style={sectionLabel}>作者 · {authorHits.length}</div>
                  {authorHits.map(a => (
                    <div key={a.name} onClick={()=>setQuery(a.name)} style={{
                      display:'flex', alignItems:'center', gap:11, padding:'10px 4px',
                      borderBottom:`1px solid ${M.borderSoft}`, cursor:'pointer',
                    }}>
                      <Av sym={a.name.slice(0,1)} bg={a.tone} size={32}/>
                      <div style={{flex:1, minWidth:0, display:'flex', alignItems:'center', gap:5}}>
                        <span style={{fontSize:14, fontWeight:600, color:M.text}}>{a.name}</span>
                        {a.verified && <span style={{color:M.violet, display:'flex'}}><Ico d={ICONS.check} w={13} sw={2.6}/></span>}
                      </div>
                      <span style={{fontSize:11, color:M.dim, fontFamily:M.mono}}>{a.count} 个策略</span>
                    </div>
                  ))}
                </React.Fragment>
              )}
              {stratHits.length > 0 && (
                <React.Fragment>
                  <div style={sectionLabel}>策略 · {stratHits.length}</div>
                  {stratHits.map(s => <StratRow key={s.id} s={s}/>)}
                </React.Fragment>
              )}
            </React.Fragment>
          )
        ) : (
          <React.Fragment>
            {/* 热门搜索 */}
            <div style={sectionLabel}>热门搜索</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'10px 10px' }}>
              {STRAT_TRENDING.map((t, i) => (
                <button key={t} onClick={()=>setQuery(t)} style={chipStyle}>
                  {t}
                </button>
              ))}
            </div>

            {/* 搜索历史 */}
            {history.length > 0 && (
              <React.Fragment>
                <div style={{...sectionLabel, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <span>搜索历史</span>
                  <button aria-label="清空搜索历史" onClick={()=>setHistory([])} style={{
                    border:0, background:'transparent', color:M.dim, cursor:'pointer',
                    padding:2, display:'flex', alignItems:'center',
                  }}>
                    <Ico d={ICONS.trash} w={15} sw={1.7}/>
                  </button>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'10px 10px' }}>
                  {history.map(t => <button key={t} onClick={()=>setQuery(t)} style={chipStyle}>{t}</button>)}
                </div>
              </React.Fragment>
            )}

            {/* 猜你想跟 — top strategies by followers */}
            <div style={sectionLabel}>猜你想跟</div>
            {[...STRATS].sort((a,b)=>b.users-a.users).slice(0,3).map(s => <StratRow key={s.id} s={s}/>)}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

const SORT_OPTS = [
  { k:'hot',    label:'热门', fn:(a,b)=>b.users-a.users },
  { k:'cagr',   label:'收益', fn:(a,b)=>b.cagr-a.cagr },
  { k:'sharpe', label:'Sharpe', fn:(a,b)=>b.sharpe-a.sharpe },
  { k:'mdd',    label:'低回撤', fn:(a,b)=>a.mdd-b.mdd },
];
const STATUS_BADGE = {
  hot:      { label:'🔥 热门', bg:'rgba(239,68,68,0.10)', fg:'#EF4444' },
  new:      { label:'NEW',     bg:'rgba(22,163,107,0.12)', fg:'#16A36B' },
  official: { label:'官方',    bg:'rgba(124,92,255,0.12)', fg:'#7C5CFF' },
  pro:      { label:'PRO',     bg:'linear-gradient(135deg,#F59E0B,#EF4444)', fg:'#fff' },
};

function Sparkline({ data, up=true, w=120, h=36 }) {
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/span)*(h-4)-2}`).join(' ');
  const col = up ? M.up : M.dn;
  const last = data[data.length-1], first = data[0];
  const upActual = last >= first;
  const c = upActual ? M.up : M.dn;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{display:'block', overflow:'visible'}}>
      <defs>
        <linearGradient id={`spk${Math.round(data[0]*data.length)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={c} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon fill={`url(#spk${Math.round(data[0]*data.length)})`} points={`0,${h} ${pts} ${w},${h}`}/>
      <polyline fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" points={pts}/>
    </svg>
  );
}

/* smooth bezier path from normalized points */
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.18;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = p2[1] - (p3[1] - p1[1]) * t;
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

/* polished equity curve for the featured hero */
function HeroChart({ data, accent = '#A78BFA' }) {
  const W = 360, H = 132, PAD_T = 14, PAD_B = 6;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    PAD_T + (1 - (v - min) / span) * (H - PAD_T - PAD_B),
  ]);
  const line = smoothPath(pts);
  const area = `${line} L ${W},${H} L 0,${H} Z`;
  const end = pts[pts.length - 1];
  const grid = [0.28, 0.55, 0.82];
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{display:'block', overflow:'visible'}}>
      <defs>
        <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.42"/>
          <stop offset="60%" stopColor={accent} stopOpacity="0.10"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="heroStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={accent} stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#fff" stopOpacity="0.95"/>
        </linearGradient>
        <filter id="heroGlow" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {grid.map((g,i)=>(
        <line key={i} x1="0" x2={W} y1={H*g} y2={H*g}
          stroke="#fff" strokeOpacity="0.06" strokeWidth="1" strokeDasharray="2 5"/>
      ))}
      <path d={area} fill="url(#heroFill)"/>
      <path d={line} fill="none" stroke="url(#heroStroke)" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round" filter="url(#heroGlow)"
        vectorEffect="non-scaling-stroke"/>
      <line x1={end[0]} x2={end[0]} y1={end[1]} y2={H}
        stroke={accent} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 3"/>
      <circle cx={end[0]} cy={end[1]} r="9" fill={accent} opacity="0.22">
        <animate attributeName="r" values="6;11;6" dur="2.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite"/>
      </circle>
      <circle cx={end[0]} cy={end[1]} r="3.4" fill="#fff" stroke={accent} strokeWidth="1.5"/>
    </svg>
  );
}

function ScreenMarket() {
  const [tag, setTag]       = React.useState('全部');
  const [sort, setSort]     = React.useState('hot');
  const [query, setQuery]   = React.useState('');
  const [stars, setStars]   = React.useState({ s1:true, s7:true });
  const [favOnly, setFavOnly] = React.useState(false);
  const [openId, setOpenId] = React.useState(null);
  const [toast, setToast]   = React.useState(null);
  const [showSort, setShowSort] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const stop = (e) => e.stopPropagation();

  const filtered = React.useMemo(() => {
    const sortFn = (SORT_OPTS.find(s=>s.k===sort) || SORT_OPTS[0]).fn;
    return STRATS
      .filter(s => favOnly ? stars[s.id] : (tag === '全部' || s.tag === tag))
      .filter(s => !query.trim() || s.name.toLowerCase().includes(query.toLowerCase())
                                  || s.pair.toLowerCase().includes(query.toLowerCase())
                                  || s.author.toLowerCase().includes(query.toLowerCase()))
      .slice().sort(sortFn);
  }, [tag, sort, query, favOnly, stars]);

  const favCount = React.useMemo(() => STRATS.filter(s => stars[s.id]).length, [stars]);

  const featured = STRATS.find(s => s.id === 's3');

  const fireToast = (msg) => {
    setToast(msg);
    setTimeout(()=>setToast(null), 2400);
  };

  const open = STRATS.find(s => s.id === openId);

  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus/>
      <MTopBar
        compact
        title="策略广场"
        sub="精选策略 · 一键载入对话"
        right={
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <button onClick={(e)=>{stop(e); setSearchOpen(true);}} style={{
              width:36, height:36, borderRadius:18,
              background: query ? M.violetSoft : 'transparent',
              border:0, color: query ? M.violet : M.mid, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', position:'relative',
            }}>
              <Ico d={ICONS.search} w={20} sw={1.8}/>
              {query && <span style={{
                position:'absolute', top:6, right:6, width:7, height:7, borderRadius:4, background:M.violet,
              }}/>}
            </button>
            <button onClick={(e)=>{stop(e); setShowSort(s=>!s);}} style={{
              width:36, height:36, borderRadius:18,
              background: showSort ? M.violetSoft : 'transparent',
              border:0, color: showSort ? M.violet : M.mid, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}><Ico d={ICONS.filter} w={20}/></button>
          </div>
        }
      />

      {/* tag filter */}
      <div style={{padding:'4px 0 6px'}}>
        <div style={{display:'flex', gap:6, overflowX:'auto', padding:'0 16px'}}>
          {/* 收藏 view toggle — lives at the head of the filter row */}
          <button onClick={(e)=>{stop(e); setFavOnly(f=>!f);}} style={{
            height:30, padding:'0 12px', borderRadius:999, fontSize:12, fontWeight:600,
            background: favOnly ? 'rgba(245,158,11,0.14)' : M.elev,
            color: favOnly ? '#F59E0B' : M.mid,
            border: favOnly ? '1px solid rgba(245,158,11,0.32)' : `1px solid ${M.border}`,
            cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
            display:'inline-flex', alignItems:'center', gap:5,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24"
              fill={favOnly ? '#F59E0B' : 'none'}
              stroke={favOnly ? '#F59E0B' : 'currentColor'}
              strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round">
              <path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 18.1 5.9 21l1.2-6.6L2.4 9.9 9 9z"/>
            </svg>
            收藏
          </button>
          {TAG_FILTERS.map(t => {
            const on = !favOnly && t === tag;
            return (
              <button key={t} onClick={(e)=>{stop(e); setFavOnly(false); setTag(t);}} style={{
                height:30, padding:'0 14px', borderRadius:999, fontSize:12, fontWeight:500,
                background: on ? M.text : M.elev, color: on ? M.bg : M.mid,
                border: on ? '0' : `1px solid ${M.border}`,
                cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
                opacity: favOnly ? 0.55 : 1,
              }}>{t}</button>
            );
          })}
        </div>
      </div>

      {/* sort row */}
      <div style={{padding:'6px 16px 4px', display:'flex', alignItems:'center', gap:6}}>
        <span style={{fontSize:11, color:M.dim, marginRight:4}}>排序</span>
        {SORT_OPTS.map(s => {
          const on = s.k === sort;
          return (
            <button key={s.k} onClick={(e)=>{stop(e); setSort(s.k);}} style={{
              height:24, padding:'0 10px', borderRadius:6, fontSize:11, fontWeight:500,
              background: on ? M.violetSoft : 'transparent', color: on ? M.violet : M.mid,
              border:0, cursor:'pointer',
              display:'inline-flex', alignItems:'center', gap:4,
            }}>
              {s.label}
              {on && <Ico d={ICONS.arrowD} w={10} sw={2.4}/>}
            </button>
          );
        })}
        <div style={{flex:1}}/>
        <span style={{fontSize:11, color:M.dim, fontFamily:M.mono}}>{filtered.length} 个</span>
      </div>

      <div style={{flex:1, overflow:'auto', padding:'10px 16px 100px'}}>
        {/* featured hero */}
        {tag === '全部' && !query && !favOnly && featured && (
          <div onClick={(e)=>{stop(e); setOpenId(featured.id);}} style={{
            marginBottom:14, borderRadius:18, position:'relative', overflow:'hidden', cursor:'pointer',
            background:'linear-gradient(135deg, #16122F 0%, #241B52 52%, #14112C 100%)',
            border:'1px solid rgba(167,139,250,0.22)',
            boxShadow:'0 10px 30px rgba(20,12,48,0.45), inset 0 1px 0 rgba(255,255,255,0.06)', color:'#fff',
          }}>
            {/* grid mesh — website signature backdrop, masked to top-right */}
            <div style={{
              position:'absolute', inset:0, pointerEvents:'none',
              backgroundImage:'linear-gradient(rgba(167,139,250,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.13) 1px, transparent 1px)',
              backgroundSize:'22px 22px',
              maskImage:'radial-gradient(120px 110px at 82% 8%, #000 0%, transparent 72%)',
              WebkitMaskImage:'radial-gradient(120px 110px at 82% 8%, #000 0%, transparent 72%)',
            }}/>
            {/* ambient equity curve */}
            <div style={{position:'absolute', left:0, right:0, bottom:0, height:'62%'}}>
              <HeroChart data={featured.seed} accent="#A78BFA"/>
            </div>
            {/* corner accent glow — matches site's radial accent-soft */}
            <div style={{
              position:'absolute', top:-46, right:-34, width:172, height:172, borderRadius:'50%',
              background:'radial-gradient(circle, rgba(139,103,255,0.36) 0%, rgba(124,92,252,0.12) 42%, transparent 72%)',
              pointerEvents:'none',
            }}/>
            {/* faint lower-left counter-glow for depth */}
            <div style={{
              position:'absolute', bottom:-50, left:-40, width:150, height:150, borderRadius:'50%',
              background:'radial-gradient(circle, rgba(103,232,249,0.10) 0%, transparent 70%)', pointerEvents:'none',
            }}/>

            <div style={{position:'relative', padding:'12px 14px 13px'}}>
              {/* header row */}
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:5,
                  padding:'3px 9px', borderRadius:7, background:'rgba(255,255,255,0.16)',
                  fontSize:10, fontWeight:700, letterSpacing:0.6, color:'#fff', backdropFilter:'blur(4px)',
                }}>
                  <span style={{fontSize:11, lineHeight:1}}>★</span>本周推荐
                </span>
              </div>

              {/* title + avatar + view */}
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <Av sym={featured.sym} bg={featured.tone} size={36}/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:16, fontWeight:700, letterSpacing:-0.2, lineHeight:1.2,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{featured.name}</div>
                  <div style={{fontSize:11.5, fontWeight:500, color:'rgba(255,255,255,0.82)', marginTop:3,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    textShadow:'0 1px 3px rgba(10,6,30,0.5)'}}>
                    {featured.author} · 市场中性 · 低回撤
                  </div>
                </div>
                <span style={{
                  flexShrink:0, display:'inline-flex', alignItems:'center', gap:5,
                  padding:'7px 13px', borderRadius:999, background:'rgba(255,255,255,0.14)',
                  border:'1px solid rgba(255,255,255,0.18)', backdropFilter:'blur(6px)',
                  fontSize:11.5, fontWeight:600, color:'#fff',
                }}>查看详情 <Ico d="M5 12h14M13 6l6 6-6 6" w={13} sw={2.2}/></span>
              </div>
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          favOnly ? (
            <div style={{padding:'56px 24px', textAlign:'center'}}>
              <div style={{
                width:56, height:56, borderRadius:28, margin:'0 auto 16px',
                background:'rgba(245,158,11,0.12)', display:'flex',
                alignItems:'center', justifyContent:'center', color:'#F59E0B',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
                  <path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 18.1 5.9 21l1.2-6.6L2.4 9.9 9 9z"/>
                </svg>
              </div>
              <div style={{fontSize:15, fontWeight:600, color:M.text, marginBottom:6}}>还没有收藏的策略</div>
              <div style={{fontSize:12.5, lineHeight:1.6, color:M.dim, maxWidth:240, margin:'0 auto 18px'}}>
                点击策略卡右上角的 ☆ 星标，把感兴趣的策略收藏到这里。
              </div>
              <button onClick={(e)=>{stop(e); setFavOnly(false);}} style={{
                height:38, padding:'0 18px', borderRadius:999, border:0,
                background:M.violetGrad, color:'#fff', fontSize:13, fontWeight:600,
                cursor:'pointer', boxShadow:'0 6px 18px rgba(124,92,255,0.3)',
              }}>去策略广场看看</button>
            </div>
          ) : (
            <div style={{padding:'40px 0', textAlign:'center', color:M.dim, fontSize:13}}>
              没有符合条件的策略
            </div>
          )
        )}

        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          {filtered.map(s => (
            <StratCard
              key={s.id} s={s}
              starred={!!stars[s.id]}
              onStar={(e)=>{stop(e); setStars(p=>({...p, [s.id]: !p[s.id]}));}}
              onOpen={(e)=>{stop(e); setOpenId(s.id);}}
              onLoad={(e)=>{
                stop(e);
                fireToast(`「${s.name}」已载入对话`);
                setTimeout(()=>window.__nav?.go('ai'), 700);
              }}
              onRun={(e)=>{
                stop(e);
                fireToast(`「${s.name}」已启动 · 进入实盘监控`);
                setTimeout(()=>window.__nav?.go('live'), 700);
              }}
            />
          ))}
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div style={{
          position:'absolute', left:'50%', bottom:120, transform:'translateX(-50%)',
          background:'rgba(15,11,34,0.92)', color:'#fff', padding:'10px 16px',
          borderRadius:10, fontSize:12, fontWeight:500, zIndex:60,
          boxShadow:'0 8px 24px rgba(15,11,34,0.32)',
          display:'flex', alignItems:'center', gap:8, maxWidth:'90%',
          animation:'qfToast .25s ease-out',
        }}>
          <span style={{color:'#16C783', display:'flex'}}><Ico d={ICONS.check} w={14} sw={2.4}/></span>
          {toast}
        </div>
      )}

      {/* sort sheet */}
      {showSort && (
        <div onClick={(e)=>{stop(e); setShowSort(false);}}
          style={{position:'absolute', inset:0, background:'rgba(15,11,34,0.55)', zIndex:55}}>
          <div onClick={stop} style={{
            position:'absolute', left:0, right:0, bottom:0,
            background:M.elev, borderRadius:'20px 20px 0 0', padding:'16px 20px 36px',
            boxShadow:'0 -16px 48px rgba(15,11,34,0.2)',
          }}>
            <div style={{width:42, height:4, borderRadius:2, background:M.border, margin:'0 auto 14px'}}/>
            <div style={{fontSize:14, fontWeight:700, marginBottom:12, color:M.text}}>筛选 & 排序</div>
            <div style={{fontSize:11, color:M.mid, marginBottom:6}}>类型</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:14}}>
              {TAG_FILTERS.map(t=>{
                const on = t===tag;
                return (
                  <button key={t} onClick={(e)=>{stop(e); setTag(t);}} style={{
                    height:30, padding:'0 12px', borderRadius:999, fontSize:12,
                    background: on ? M.violet : M.soft, color: on ? '#fff' : M.text,
                    border:0, cursor:'pointer',
                  }}>{t}</button>
                );
              })}
            </div>
            <div style={{fontSize:11, color:M.mid, marginBottom:6}}>排序方式</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6}}>
              {SORT_OPTS.map(s=>{
                const on = s.k===sort;
                return (
                  <button key={s.k} onClick={(e)=>{stop(e); setSort(s.k);}} style={{
                    height:36, borderRadius:8, fontSize:12, fontWeight:500,
                    background: on ? M.violetSoft : M.soft, color: on ? M.violet : M.text,
                    border:0, cursor:'pointer',
                  }}>按 {s.label} 排序</button>
                );
              })}
            </div>
            <button onClick={(e)=>{stop(e); setShowSort(false);}} style={{
              width:'100%', height:46, marginTop:14, borderRadius:12, border:0,
              background:M.violetGrad, color:'#fff', fontSize:14, fontWeight:600,
              boxShadow:'0 6px 20px rgba(124,92,255,0.32)', cursor:'pointer',
            }}>查看 {filtered.length} 个结果</button>
          </div>
        </div>
      )}

      {/* strategy detail */}
      {open && (
        <StratDetail
          s={open}
          starred={!!stars[open.id]}
          onStar={()=>setStars(p=>({...p, [open.id]: !p[open.id]}))}
          onClose={()=>setOpenId(null)}
          onLoad={()=>{
            setOpenId(null);
            fireToast(`「${open.name}」已载入对话`);
            setTimeout(()=>window.__nav?.go('ai'), 700);
          }}
          onRun={()=>{
            setOpenId(null);
            fireToast(`「${open.name}」已启动 · 进入实盘监控`);
            setTimeout(()=>window.__nav?.go('live'), 700);
          }}
        />
      )}

      <StratSearchOverlay
        open={searchOpen}
        onClose={()=>setSearchOpen(false)}
        onOpenStrat={(id)=>setOpenId(id)}
        onPickTag={(t)=>{ setTag(t); setSearchOpen(false); }}
      />

      <MTabBar active="strat"/>
      <style>{`@keyframes qfToast { from{opacity:0; transform:translate(-50%, 6px)} to{opacity:1; transform:translate(-50%, 0)} }`}</style>
      <style>{`@keyframes qfSheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }`}</style>
    </div>
  );
}

function HeroStat({ label, v, hot }) {
  return (
    <div>
      <div style={{fontSize:9, color:'rgba(255,255,255,0.6)', letterSpacing:0.4, textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:15, fontWeight:700, color: hot ? '#7EFFB0' : '#fff', fontFamily:M.mono, marginTop:2}}>{v}</div>
    </div>
  );
}

function StratCard({ s, starred, onStar, onOpen, onLoad, onRun }) {
  const stop = (e)=>e.stopPropagation();
  const badge = s.status ? STATUS_BADGE[s.status] : null;
  const up = s.seed[s.seed.length-1] >= s.seed[0];
  return (
    <div onClick={onOpen} style={{
      background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:14,
      padding:'14px 14px 12px', cursor:'pointer',
      transition:'transform .15s, border-color .15s',
    }}>
      <div style={{display:'flex', gap:10, alignItems:'flex-start', marginBottom:10}}>
        <Av sym={s.sym} bg={s.tone} size={40}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:3}}>
            <span style={{fontSize:14, fontWeight:600, color:M.text,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0, flex:'0 1 auto'}}>{s.name}</span>
            {badge && (
              <span style={{
                flexShrink:0, padding:'2px 6px', borderRadius:4, fontSize:9, fontWeight:700,
                background: badge.bg, color: badge.fg, letterSpacing:0.3,
              }}>{badge.label}</span>
            )}
          </div>
          <div style={{display:'flex', gap:6, alignItems:'center', flexWrap:'wrap'}}>
            <Chip tone={s.tagTone}>{s.tag}</Chip>
            <span style={{fontSize:10.5, color:M.dim, fontFamily:M.mono}}>{s.pair}</span>
            <span style={{fontSize:10.5, color:M.dim}}>· {s.period}</span>
          </div>
        </div>
        <button onClick={onStar} style={{
          width:28, height:28, borderRadius:8, border:0, background:'transparent', cursor:'pointer',
          color: starred ? '#F59E0B' : M.dim, display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24"
            fill={starred ? '#F59E0B' : 'none'}
            stroke={starred ? '#F59E0B' : 'currentColor'}
            strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
            <path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 18.1 5.9 21l1.2-6.6L2.4 9.9 9 9z"/>
          </svg>
        </button>
      </div>

      <div style={{
        display:'flex', alignItems:'center', gap:10, marginBottom:10,
        padding:'8px 10px', background:M.soft, borderRadius:10,
      }}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:10, color:M.dim, letterSpacing:0.4, textTransform:'uppercase'}}>近 {s.period}</div>
          <div style={{display:'flex', alignItems:'baseline', gap:6, marginTop:2}}>
            <span style={{fontSize:18, fontWeight:700, fontFamily:M.mono,
              color: up ? M.up : M.dn}}>{(up?'+':'')}{s.cagr}%</span>
            <span style={{fontSize:11, color:M.dim}}>CAGR</span>
          </div>
        </div>
        <Sparkline data={s.seed} up={up} w={120} h={36}/>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, marginBottom:12}}>
        <MiniStat label="Sharpe" v={s.sharpe.toFixed(2)}/>
        <MiniStat label="回撤" v={`${s.mdd}%`} tone="dn"/>
        <MiniStat label="胜率" v={`${s.win}%`}/>
        <MiniStat label="使用" v={s.users>=1000 ? `${(s.users/1000).toFixed(1)}k` : s.users}/>
      </div>

      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <div style={{
          flex:1, display:'flex', alignItems:'center', gap:6, minWidth:0,
        }}>
          <div style={{
            width:18, height:18, borderRadius:9, background:s.authorTone, flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', fontSize:9, fontWeight:700,
          }}>{s.author[0]}</div>
          <span style={{fontSize:11, color:M.mid, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.author}</span>
          {s.verified && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#3B82F6" style={{flexShrink:0}}>
              <path d="M12 2l2.4 1.8 3 .1 1 2.8 2.2 2L20 12l.6 3.3-2.2 2-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8-2.2-2L4 12l-.6-3.3 2.2-2 1-2.8 3-.1L12 2z"/>
              <path d="M8 12.5l2.6 2.6L16 9.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <button onClick={(e)=>{stop(e); onLoad(e);}} style={{
          height:32, padding:'0 12px', borderRadius:10,
          border:`1px solid ${M.border}`, background:M.elev,
          fontSize:12, fontWeight:500, color:M.text, cursor:'pointer',
          display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
          fontFamily:'inherit',
        }}>
          <Ico d={ICONS.bot} w={12} sw={2.2}/>
          载入对话
        </button>
        <button data-action="run-strat" onClick={(e)=>{stop(e); (onRun || onLoad)(e);}} style={{
          height:32, padding:'0 14px', borderRadius:10, border:0,
          background:M.violetGrad, fontSize:12, fontWeight:600, color:'#fff', cursor:'pointer',
          boxShadow:'0 4px 12px rgba(124,92,255,0.32)',
          display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
          fontFamily:'inherit',
        }}>
          <svg width="9" height="10" viewBox="0 0 9 10" style={{flexShrink:0}}>
            <path d="M0 0 L9 5 L0 10 Z" fill="#fff"/>
          </svg>
          运行
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, v, tone }) {
  const c = tone==='up' ? M.up : tone==='dn' ? M.dn : M.text;
  return (
    <div style={{textAlign:'center'}}>
      <div style={{fontSize:9, color:M.dim, letterSpacing:0.3, textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:12, fontWeight:700, color:c, fontFamily:M.mono, marginTop:2}}>{v}</div>
    </div>
  );
}

function StratDetail({ s, starred, onStar, onClose, onLoad, onRun }) {
  const stop = (e)=>e.stopPropagation();
  const up = s.seed[s.seed.length-1] >= s.seed[0];
  const params = [
    ['策略类型', s.tag],
    ['交易品种', s.pair],
    ['交易周期', s.period],
    ['止损', '2.0%'],
    ['仓位', '100%'],
    ['杠杆', s.tag === '高频' ? '5×' : '1×'],
  ];
  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, background:'rgba(15,11,34,0.55)', zIndex:70,
    }}>
      <div onClick={stop} style={{
        position:'absolute', left:0, right:0, bottom:0, top:48,
        background:M.bg, borderRadius:'20px 20px 0 0', display:'flex', flexDirection:'column',
        boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
        animation:'qfSheetUp .22s ease-out',
      }}>
        {/* head */}
        <div style={{padding:'10px 16px 0', background:M.elev, borderRadius:'20px 20px 0 0'}}>
          <div style={{width:42, height:4, borderRadius:2, background:M.border, margin:'0 auto 14px'}}/>
          <div style={{display:'flex', gap:12, alignItems:'flex-start', marginBottom:14}}>
            <Av sym={s.sym} bg={s.tone} size={48}/>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:16, fontWeight:700, color:M.text}}>{s.name}</div>
              <div style={{display:'flex', gap:6, marginTop:6, alignItems:'center', flexWrap:'wrap'}}>
                <Chip tone={s.tagTone}>{s.tag}</Chip>
                <span style={{fontSize:11, color:M.dim, fontFamily:M.mono}}>{s.pair} · {s.period}</span>
              </div>
            </div>
            <button onClick={onStar} style={{
              width:34, height:34, borderRadius:10, border:0, cursor:'pointer',
              background: starred ? 'rgba(245,158,11,0.12)' : M.soft,
              color: starred ? '#F59E0B' : M.mid,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24"
                fill={starred ? '#F59E0B' : 'none'}
                stroke={starred ? '#F59E0B' : 'currentColor'}
                strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
                <path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 18.1 5.9 21l1.2-6.6L2.4 9.9 9 9z"/>
              </svg>
            </button>
            <button onClick={onClose} style={{
              width:34, height:34, borderRadius:17, border:0, background:M.soft, color:M.mid,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            }}><Ico d={ICONS.close} w={16} sw={2}/></button>
          </div>
        </div>

        {/* body */}
        <div style={{flex:1, overflow:'auto', padding:'14px 16px 100px'}}>
          {/* equity curve */}
          <div style={{
            background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:14,
            padding:'14px 14px 10px', marginBottom:12,
          }}>
            <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:10}}>
              <span style={{fontSize:22, fontWeight:700, fontFamily:M.mono,
                color: up ? M.up : M.dn}}>{(up?'+':'')}{s.cagr}%</span>
              <span style={{fontSize:11, color:M.dim}}>{s.period} 累计收益</span>
              <div style={{flex:1}}/>
              <div style={{display:'flex', gap:4}}>
                {['7D','30D','90D','1Y'].map(p=>(
                  <span key={p} style={{
                    padding:'2px 6px', borderRadius:4, fontSize:10,
                    color: p===s.period ? M.violet : M.dim,
                    background: p===s.period ? M.violetSoft : 'transparent',
                    fontWeight: p===s.period ? 600 : 500, cursor:'pointer',
                  }}>{p}</span>
                ))}
              </div>
            </div>
            <Sparkline data={s.seed} up={up} w={326} h={120}/>
          </div>

          {/* stats grid */}
          <div style={{
            background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:14,
            padding:'12px 14px', marginBottom:12,
            display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12,
          }}>
            <DStat label="Sharpe" v={s.sharpe.toFixed(2)}/>
            <DStat label="最大回撤" v={`${s.mdd}%`} tone="dn"/>
            <DStat label="胜率" v={`${s.win}%`}/>
            <DStat label="盈亏比" v="1.84"/>
            <DStat label="交易次数" v="248"/>
            <DStat label="使用人数" v={s.users>=1000 ? `${(s.users/1000).toFixed(1)}k` : s.users}/>
          </div>

          {/* params */}
          <SectTitle>策略参数</SectTitle>
          <div style={{
            background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:14,
            padding:'8px 14px', marginBottom:12,
          }}>
            {params.map(([k,v],i)=>(
              <div key={k} style={{
                display:'flex', justifyContent:'space-between', padding:'8px 0',
                borderBottom: i < params.length-1 ? `1px solid ${M.borderSoft}` : 'none',
              }}>
                <span style={{fontSize:12, color:M.mid}}>{k}</span>
                <span style={{fontSize:12, color:M.text, fontFamily:M.mono, fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>

          {/* description */}
          <SectTitle>策略说明</SectTitle>
          <div style={{
            background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:14,
            padding:'12px 14px', marginBottom:12,
            fontSize:13, lineHeight:1.6, color:M.text,
          }}>
            {s.desc} 策略基于 {s.tag} 框架，使用历史数据回测验证。建议在熟悉风险参数后再投入资金。
          </div>

          {/* reviews removed */}
        </div>

        {/* sticky bottom */}
        <div style={{
          padding:'12px 16px 36px', borderTop:`1px solid ${M.borderSoft}`,
          background:M.elev, display:'flex', gap:8,
        }}>
          <button style={{
            height:48, padding:'0 16px', borderRadius:12, border:`1px solid ${M.border}`,
            background:M.elev, fontSize:13, fontWeight:500, color:M.mid, cursor:'pointer',
            whiteSpace:'nowrap', fontFamily:'inherit',
          }}>分享</button>
          <button onClick={onLoad} style={{
            height:48, padding:'0 14px', borderRadius:12, border:`1px solid ${M.border}`,
            background:M.elev, fontSize:13, fontWeight:500, color:M.text, cursor:'pointer',
            display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap', fontFamily:'inherit',
          }}>
            <Ico d={ICONS.bot} w={14} sw={2.2}/>
            载入对话
          </button>
          <button data-action="run-strat" onClick={onRun || onLoad} style={{
            flex:1, height:48, borderRadius:12, border:0,
            background:M.violetGrad, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer',
            boxShadow:'0 6px 20px rgba(124,92,255,0.32)',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            fontFamily:'inherit', whiteSpace:'nowrap',
          }}>
            <svg width="11" height="12" viewBox="0 0 9 10">
              <path d="M0 0 L9 5 L0 10 Z" fill="#fff"/>
            </svg>
            运行
          </button>
        </div>
      </div>
    </div>
  );
}

function SectTitle({ children }) {
  return <div style={{fontSize:11, color:M.dim, fontWeight:600, letterSpacing:0.5, textTransform:'uppercase', margin:'4px 4px 8px'}}>{children}</div>;
}
function DStat({ label, v, tone }) {
  const c = tone==='up' ? M.up : tone==='dn' ? M.dn : M.text;
  return (
    <div>
      <div style={{fontSize:10, color:M.dim, letterSpacing:0.4, textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:16, fontWeight:700, color:c, fontFamily:M.mono, marginTop:2}}>{v}</div>
    </div>
  );
}

/* ========================================================================
   SCREEN 5 — MARKET TICKER LIST
   ======================================================================== */
const TICKERS = [
  { sym:'BTC', name:'Bitcoin',  px:'68,420.12', ch:'+2.34%', up:true,  vol:'$42.8B', tone:'#F7931A'},
  { sym:'ETH', name:'Ethereum', px:'3,842.55',  ch:'+1.86%', up:true,  vol:'$18.2B', tone:'#627EEA'},
  { sym:'SOL', name:'Solana',   px:'196.42',    ch:'+4.12%', up:true,  vol:'$3.6B',  tone:'#9945FF'},
  { sym:'BNB', name:'BNB',      px:'612.80',    ch:'-0.42%', up:false, vol:'$1.4B',  tone:'#F0B90B'},
  { sym:'XRP', name:'XRP',      px:'0.6248',    ch:'-1.18%', up:false, vol:'$2.1B',  tone:'#23292F'},
  { sym:'DOGE',name:'Dogecoin', px:'0.1742',    ch:'+3.21%', up:true,  vol:'$1.8B',  tone:'#C2A633'},
  { sym:'TON', name:'Toncoin',  px:'7.42',      ch:'+0.84%', up:true,  vol:'$486M',  tone:'#0098EA'},
  { sym:'AVAX',name:'Avalanche',px:'42.18',     ch:'-2.04%', up:false, vol:'$394M',  tone:'#E84142'},
];

const TICKER_TABS = [
  { k:'fav',    label:'自选' },
  { k:'spot',   label:'现货' },
  { k:'perp',   label:'合约' },
  { k:'gain',   label:'涨幅榜' },
  { k:'lose',   label:'跌幅榜' },
];

function getTickersFor(tab) {
  switch (tab) {
    case 'spot':
      return TICKERS;
    case 'perp':
      // permanent-contracts: show with a small "永续" tag via name override
      return TICKERS.map(t => ({...t, name: t.name + ' · 永续'}));
    case 'gain':
      return [...TICKERS].filter(t=>t.up).sort((a,b)=>parseFloat(b.ch)-parseFloat(a.ch));
    case 'lose':
      return [...TICKERS].filter(t=>!t.up).sort((a,b)=>parseFloat(a.ch)-parseFloat(b.ch));
    case 'fav':
    default:
      return TICKERS.filter(t => ['BTC','ETH','SOL','DOGE'].includes(t.sym));
  }
}

function ScreenTickers() {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [history, setHistory] = React.useState(['BTC','ETH','SOL']);
  const [favs, setFavs] = React.useState(() => new Set(['BTC','ETH','SOL','DOGE']));
  const searchInputRef = React.useRef(null);
  const [tab, setTab] = React.useState('fav');
  const [notif, setNotif] = React.useState(false);
  const [notifTab, setNotifTab] = React.useState('全部');
  const [notifData, setNotifData] = React.useState(() => window.WHALE_NOTIFS || []);
  const unread = notifData.filter(n => n.unread).length;
  const markAllRead = () => setNotifData(notifData.map(n => ({...n, unread:false})));
  const rows = tab === 'fav' ? TICKERS.filter(t => favs.has(t.sym)) : getTickersFor(tab);
  const headerRight = tab === 'gain' ? '24H 涨幅' : tab === 'lose' ? '24H 跌幅' : '24H 涨跌';

  const q = query.trim().toLowerCase();
  const results = q ? TICKERS.filter(t => t.sym.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) : [];
  const trending = [...TICKERS].sort((a,b) => Math.abs(parseFloat(b.ch)) - Math.abs(parseFloat(a.ch))).slice(0, 6);

  React.useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  const openSearch  = () => { setSearchOpen(true); setQuery(''); };
  const closeSearch = () => { setSearchOpen(false); setQuery(''); };
  const recordHistory = (sym) => setHistory(h => [sym, ...h.filter(x => x !== sym)].slice(0, 12));
  const toggleFav = (sym) => setFavs(prev => {
    const n = new Set(prev);
    n.has(sym) ? n.delete(sym) : n.add(sym);
    return n;
  });

  // rich market row used in the search overlay (trending + results)
  const MarketRow = ({ t, rank }) => {
    const faved = favs.has(t.sym);
    return (
      <div data-ticker-row onClick={()=>recordHistory(t.sym)} style={{
        display:'flex', alignItems:'center', gap:11, padding:'11px 4px',
        borderBottom:`1px solid ${M.borderSoft}`, cursor:'pointer',
      }}>
        {rank ? (
          <span style={{
            width:18, textAlign:'center', flexShrink:0,
            fontFamily:M.mono, fontSize:13, fontWeight:700,
            color: rank <= 3 ? M.violet : M.dim,
          }}>{rank}</span>
        ) : (
          <button onClick={(e)=>{e.stopPropagation(); toggleFav(t.sym);}} aria-label="自选" style={{
            border:0, background:'transparent', cursor:'pointer', padding:0, flexShrink:0,
            color: faved ? '#F0B90B' : M.faint, display:'flex', alignItems:'center',
          }}>
            <Ico d={ICONS.star} w={17} sw={1.8} fill={faved ? '#F0B90B' : 'none'}/>
          </button>
        )}
        <Av sym={t.sym.slice(0,1)} bg={t.tone} size={30}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:14, fontWeight:600, color:M.text}}>
            {t.sym}<span style={{fontSize:10, color:M.dim, marginLeft:4, fontWeight:500}}>/ USDT</span>
          </div>
          <div style={{fontSize:11, color:M.dim, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{t.name}</div>
        </div>
        <div style={{textAlign:'right', flexShrink:0}}>
          <div style={{fontFamily:M.mono, fontSize:13, fontWeight:600, color:M.text}}>{t.px}</div>
          <div style={{fontFamily:M.mono, fontSize:11, fontWeight:600, marginTop:2, color: t.up ? M.up : M.dn}}>{t.ch}</div>
        </div>
      </div>
    );
  };
  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus/>
      {window.DataHubHeader ? (
        <window.DataHubHeader
          current="market"
          right={
            <button
              onClick={()=>setNotif(true)}
              style={{
                position:'relative', width:36, height:36, borderRadius:18, background:M.elev,
                border:`1px solid ${M.border}`, color:M.mid, cursor:'pointer', padding:0,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}
            >
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
          }
        />
      ) : (
      <MTopBar title="行情" right={
        <button
          onClick={()=>setNotif(true)}
          style={{
            position:'relative', width:36, height:36, borderRadius:18, background:M.elev,
            border:`1px solid ${M.border}`, color:M.mid, cursor:'pointer', padding:0,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}
        >
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
      }/>
      )}

      {notif && window.WhaleNotifPanel && (
        <window.WhaleNotifPanel
          items={notifData}
          tab={notifTab}
          setTab={setNotifTab}
          unread={unread}
          onMarkAll={markAllRead}
          onClose={()=>setNotif(false)}
        />
      )}

      <div style={{padding:'8px 16px 0'}}>
        <div style={{display:'flex', alignItems:'center', gap:18, fontSize:13, fontWeight:500, color:M.dim}}>
          {TICKER_TABS.map(tt => {
            const active = tt.k === tab;
            return (
              <button
                key={tt.k}
                onClick={()=>setTab(tt.k)}
                style={{
                  background:'transparent', border:0, padding:'0 0 6px', cursor:'pointer',
                  fontSize:13, fontWeight: active ? 600 : 500,
                  color: active ? M.text : M.dim,
                  borderBottom: active ? `2px solid ${M.text}` : '2px solid transparent',
                  fontFamily:'inherit',
                }}
              >{tt.label}</button>
            );
          })}
          <div style={{flex:1}}/>
          <button
            aria-label="搜索"
            onClick={openSearch}
            style={{
              width:30, height:30, marginBottom:4, borderRadius:15, border:0,
              background: 'transparent',
              color: M.mid, cursor:'pointer', padding:0,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
            <Ico d={ICONS.search} w={18} sw={1.8}/>
          </button>
        </div>
      </div>

      <div style={{flex:1, overflow:'auto', background:M.elev, paddingBottom:100}}>
        <div style={{
          display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr', padding:'10px 16px',
          fontSize:11, color:M.dim, borderBottom:`1px solid ${M.borderSoft}`,
        }}>
          <span>名称 / 24H量</span>
          <span style={{textAlign:'right'}}>最新价</span>
          <span style={{textAlign:'right'}}>{headerRight}</span>
        </div>
        {rows.length === 0 ? (
          <div style={{padding:'48px 16px', textAlign:'center', color:M.dim, fontSize:13}}>暂无数据</div>
        ) : rows.map(t => <TickerRow key={t.sym} t={t}/>)}
      </div>

      {searchOpen && (
        <div style={{
          position:'absolute', inset:0, zIndex:60, background:M.bg,
          display:'flex', flexDirection:'column',
        }}>
          <MStatus/>
          {/* search input row */}
          <div style={{
            padding:'62px 16px 8px', display:'flex', alignItems:'center', gap:12,
          }}>
            <div style={{
              flex:1, height:38, background:M.soft, borderRadius:999,
              padding:'0 14px', display:'flex', alignItems:'center', gap:8,
            }}>
              <Ico d={ICONS.search} w={16} sw={1.8}/>
              <input
                ref={searchInputRef}
                value={query}
                onChange={e=>setQuery(e.target.value)}
                placeholder="搜索"
                style={{
                  flex:1, border:0, outline:'none', background:'transparent',
                  fontSize:13, color:M.text, fontFamily:M.sans,
                }}
              />
              {query && (
                <button onClick={()=>{setQuery(''); searchInputRef.current && searchInputRef.current.focus();}} style={{
                  border:0, background:M.border, color:M.bg, cursor:'pointer',
                  width:16, height:16, borderRadius:8, padding:0, fontSize:11, lineHeight:1,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>×</button>
              )}
            </div>
            <button onClick={closeSearch} style={{
              border:0, background:'transparent', color:M.mid, cursor:'pointer',
              fontSize:13, fontWeight:500, fontFamily:M.sans, padding:'0 2px',
            }}>取消</button>
          </div>

          <div style={{flex:1, overflow:'auto', padding:'8px 16px 24px'}}>
            {q ? (
              /* live results — rich market rows */
              results.length ? results.map(t => <MarketRow key={t.sym} t={t}/>) : (
                <div style={{padding:'44px 16px', textAlign:'center', color:M.dim, fontSize:13}}>无匹配币种</div>
              )
            ) : (
              <React.Fragment>
                {/* 搜索历史 */}
                {history.length > 0 && (
                  <React.Fragment>
                    <div style={{display:'flex', alignItems:'center', margin:'6px 0 12px'}}>
                      <div style={{flex:1, fontSize:14, fontWeight:600, color:M.text}}>搜索历史</div>
                      <button aria-label="清空搜索历史" onClick={()=>setHistory([])} style={{
                        border:0, background:'transparent', color:M.dim, cursor:'pointer',
                        padding:4, display:'flex', alignItems:'center',
                      }}>
                        <Ico d={ICONS.trash} w={16} sw={1.7}/>
                      </button>
                    </div>
                    <div style={{display:'flex', flexWrap:'wrap', gap:'10px 10px', marginBottom:6}}>
                      {history.map(c => (
                        <button key={c} onClick={()=>setQuery(c)} style={{
                          minWidth:56, padding:'7px 16px', borderRadius:999, border:0,
                          background:M.elev, color:M.mid, cursor:'pointer',
                          fontSize:13, fontWeight:500, fontFamily:M.sans,
                        }}>{c}</button>
                      ))}
                    </div>
                  </React.Fragment>
                )}

                {/* 热门搜索 — ranked market movers */}
                <div style={{display:'flex', alignItems:'baseline', gap:8, margin:'20px 0 4px'}}>
                  <div style={{fontSize:14, fontWeight:600, color:M.text}}>热门搜索</div>
                  <span style={{fontSize:11, color:M.dim, whiteSpace:'nowrap'}}>· 24H 异动</span>
                </div>
                {trending.map((t, i) => <MarketRow key={t.sym} t={t} rank={i+1}/>)}
              </React.Fragment>
            )}
          </div>
        </div>
      )}

      <MTabBar active="market"/>
    </div>
  );
}

function TickerRow({ t }) {
  return (
    <div data-ticker-row style={{
      display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr', alignItems:'center',
      padding:'12px 16px', borderBottom:`1px solid ${M.borderSoft}`,
      cursor:'pointer',
    }}>
      <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0}}>
        <Av sym={t.sym.slice(0,1)} bg={t.tone} size={32}/>
        <div style={{minWidth:0}}>
          <div style={{fontSize:14, fontWeight:600, color:M.text}}>{t.sym}<span style={{fontSize:10, color:M.dim, marginLeft:4, fontWeight:500}}>/ USDT</span></div>
          <div style={{fontSize:11, color:M.dim, marginTop:1}}>Vol {t.vol}</div>
        </div>
      </div>
      <div style={{textAlign:'right', fontFamily:M.mono, fontSize:14, fontWeight:600, color:M.text}}>{t.px}</div>
      <div style={{display:'flex', justifyContent:'flex-end'}}>
        <span style={{
          height:28, minWidth:70, padding:'0 10px', borderRadius:6,
          background: t.up ? M.up : M.dn, color:'#fff',
          fontFamily:M.mono, fontSize:13, fontWeight:600,
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}>{t.ch}</span>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenAIConfig, ScreenMarket, ScreenTickers, StratCard, TickerRow, STRATS });

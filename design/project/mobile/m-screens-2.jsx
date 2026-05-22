/* Mobile screens part 2 — Config sheet, Strategy Marketplace, Market list */

/* ========================================================================
   SCREEN 3 — AI Config (bottom sheet over chat)
   ======================================================================== */
function ScreenAIConfig() {
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

          <CfgInput label="初始资金" required value="10000" suffix="USDT"/>
          <CfgInput label="滑点" required value="5" suffix="bps"/>
          <CfgInput label="手续费" required value="2" suffix="bps"/>
          <CfgSelect label="成交价来源" required value="逐笔成交价"/>
          <CfgSelect label="允许部分覆盖数据继续回测" required value="是"/>

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
function CfgSelect({ label, value, required }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:12, color:M.mid, marginBottom:6}}>
        {label}{required && <span style={{color:M.danger}}> *</span>}
      </div>
      <div style={{
        height:44, padding:'0 14px', borderRadius:11, background:M.soft,
        border:`1px solid ${M.borderSoft}`, display:'flex', alignItems:'center',
      }}>
        <span style={{flex:1, fontSize:14, color:M.text}}>{value}</span>
        <Ico d={ICONS.caret} w={16} sw={1.8}/>
      </div>
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

// 策略广场页面（设计稿历史命名为 ScreenMarket，已统一改为 ScreenStrategy；
// 旧名作为 alias 在 window 上保留，避免外部脚本/原型 HTML 引用断裂）。
function ScreenStrategy() {
  const [tag, setTag]       = React.useState('全部');
  const [sort, setSort]     = React.useState('hot');
  const [query, setQuery]   = React.useState('');
  const [stars, setStars]   = React.useState({ s1:true, s7:true });
  const [openId, setOpenId] = React.useState(null);
  const [toast, setToast]   = React.useState(null);
  const [showSort, setShowSort] = React.useState(false);
  const stop = (e) => e.stopPropagation();

  const filtered = React.useMemo(() => {
    const sortFn = (SORT_OPTS.find(s=>s.k===sort) || SORT_OPTS[0]).fn;
    return STRATS
      .filter(s => tag === '全部' || s.tag === tag)
      .filter(s => !query.trim() || s.name.toLowerCase().includes(query.toLowerCase())
                                  || s.pair.toLowerCase().includes(query.toLowerCase())
                                  || s.author.toLowerCase().includes(query.toLowerCase()))
      .slice().sort(sortFn);
  }, [tag, sort, query]);

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
        title="策略广场"
        sub="精选策略 · 一键载入对话"
        right={
          <button onClick={(e)=>{stop(e); setShowSort(s=>!s);}} style={{
            width:36, height:36, borderRadius:18, background: showSort ? M.violetSoft : M.elev,
            border:`1px solid ${showSort ? 'transparent' : M.border}`,
            color: showSort ? M.violet : M.mid, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}><Ico d={ICONS.filter} w={18}/></button>
        }
      />

      {/* search */}
      <div style={{padding:'4px 16px 8px'}}>
        <div style={{
          height:38, background:M.elev, border:`1px solid ${M.border}`, borderRadius:12,
          padding:'0 12px', display:'flex', alignItems:'center', gap:8,
        }}>
          <Ico d={ICONS.search} w={16} sw={1.8}/>
          <input
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
            onClick={stop}
            placeholder="搜索策略 · 币对 · 作者"
            style={{
              flex:1, fontSize:13, color:M.text, background:'transparent',
              border:0, outline:'none', minWidth:0,
            }}/>
          {query && (
            <button onClick={(e)=>{stop(e); setQuery('');}} style={{
              width:18, height:18, borderRadius:9, background:M.border, color:M.mid,
              border:0, fontSize:11, cursor:'pointer', lineHeight:1, padding:0,
            }}>×</button>
          )}
        </div>
      </div>

      {/* tag filter */}
      <div style={{padding:'4px 0 6px'}}>
        <div style={{display:'flex', gap:6, overflowX:'auto', padding:'0 16px'}}>
          {TAG_FILTERS.map(t => {
            const on = t === tag;
            return (
              <button key={t} onClick={(e)=>{stop(e); setTag(t);}} style={{
                height:30, padding:'0 14px', borderRadius:999, fontSize:12, fontWeight:500,
                background: on ? M.text : M.elev, color: on ? M.bg : M.mid,
                border: on ? '0' : `1px solid ${M.border}`,
                cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
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
        {tag === '全部' && !query && featured && (
          <div onClick={(e)=>{stop(e); setOpenId(featured.id);}} style={{
            marginBottom:14, padding:'14px 16px', borderRadius:16,
            background:'linear-gradient(135deg, #1A1530 0%, #2B1E5A 100%)',
            color:'#fff', position:'relative', overflow:'hidden', cursor:'pointer',
          }}>
            <div style={{position:'absolute', inset:0, opacity:0.55}}>
              <svg width="100%" height="100%" viewBox="0 0 360 130" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.4"/>
                    <stop offset="100%" stopColor="#A78BFA" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <polygon points="0,90 30,86 60,80 90,78 120,72 150,66 180,58 210,52 240,44 270,38 300,30 330,22 360,16 360,130 0,130" fill="url(#hg)"/>
                <polyline points="0,90 30,86 60,80 90,78 120,72 150,66 180,58 210,52 240,44 270,38 300,30 330,22 360,16" stroke="#A78BFA" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>
            <div style={{position:'relative', display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
              <span style={{
                padding:'3px 8px', borderRadius:6, background:'rgba(255,255,255,0.18)',
                fontSize:10, fontWeight:700, letterSpacing:0.6, color:'#fff',
              }}>本周推荐</span>
              <span style={{fontSize:10, color:'rgba(255,255,255,0.7)'}}>· 市场中性 · 低回撤</span>
            </div>
            <div style={{position:'relative', fontSize:16, fontWeight:700, marginBottom:4}}>{featured.name}</div>
            <div style={{position:'relative', fontSize:11.5, color:'rgba(255,255,255,0.75)', lineHeight:1.5, marginBottom:10}}>{featured.desc}</div>
            <div style={{position:'relative', display:'flex', gap:14}}>
              <HeroStat label="CAGR" v={`+${featured.cagr}%`} hot/>
              <HeroStat label="Sharpe" v={featured.sharpe.toFixed(2)}/>
              <HeroStat label="回撤" v={`${featured.mdd}%`}/>
              <div style={{flex:1}}/>
              <span style={{
                alignSelf:'flex-end', fontSize:11, color:'#fff', opacity:0.8,
              }}>查看 →</span>
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div style={{padding:'40px 0', textAlign:'center', color:M.dim, fontSize:13}}>
            没有符合条件的策略
          </div>
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
        />
      )}

      <MTabBar active="strategy"/>
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

function StratCard({ s, starred, onStar, onOpen, onLoad }) {
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
          height:32, padding:'0 14px', borderRadius:10, border:0,
          background:M.violetGrad, fontSize:12, fontWeight:600, color:'#fff', cursor:'pointer',
          boxShadow:'0 4px 12px rgba(124,92,255,0.32)',
          display:'inline-flex', alignItems:'center', gap:5,
        }}>
          <Ico d={ICONS.bot} w={12} sw={2.2} stroke="#fff"/>
          载入对话
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

function StratDetail({ s, starred, onStar, onClose, onLoad }) {
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
  const reviews = [
    { who:'Alice', tone:'#16A36B', stars:5, text:'已经跑了 3 个月，表现稳定，回撤可控。' },
    { who:'Bob',   tone:'#F59E0B', stars:4, text:'参数需要微调，整体不错。' },
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

          {/* reviews */}
          <SectTitle>用户反馈</SectTitle>
          {reviews.map((r,i)=>(
            <div key={i} style={{
              background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:12,
              padding:'10px 12px', marginBottom:8,
            }}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                <div style={{
                  width:24, height:24, borderRadius:12, background:r.tone, color:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700,
                }}>{r.who[0]}</div>
                <span style={{fontSize:12, fontWeight:500, color:M.text}}>{r.who}</span>
                <div style={{display:'flex', gap:1}}>
                  {[1,2,3,4,5].map(n=>(
                    <span key={n} style={{color: n<=r.stars ? '#F59E0B' : M.border, fontSize:10}}>★</span>
                  ))}
                </div>
              </div>
              <div style={{fontSize:12, color:M.mid, lineHeight:1.5}}>{r.text}</div>
            </div>
          ))}
        </div>

        {/* sticky bottom */}
        <div style={{
          padding:'12px 16px 36px', borderTop:`1px solid ${M.borderSoft}`,
          background:M.elev, display:'flex', gap:8,
        }}>
          <button style={{
            height:48, padding:'0 18px', borderRadius:12, border:`1px solid ${M.border}`,
            background:M.elev, fontSize:13, fontWeight:500, color:M.mid, cursor:'pointer',
          }}>分享</button>
          <button onClick={onLoad} style={{
            flex:1, height:48, borderRadius:12, border:0,
            background:M.violetGrad, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer',
            boxShadow:'0 6px 20px rgba(124,92,255,0.32)',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}>
            <Ico d={ICONS.bot} w={16} sw={2.2} stroke="#fff"/>
            载入到对话
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
  const [tab, setTab] = React.useState('fav');
  const [notif, setNotif] = React.useState(false);
  const [notifTab, setNotifTab] = React.useState('全部');
  const [notifData, setNotifData] = React.useState(() => window.WHALE_NOTIFS || []);
  const unread = notifData.filter(n => n.unread).length;
  const markAllRead = () => setNotifData(notifData.map(n => ({...n, unread:false})));
  const rows = getTickersFor(tab);
  const headerRight = tab === 'gain' ? '24H 涨幅' : tab === 'lose' ? '24H 跌幅' : '24H 涨跌';
  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus/>
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
        {searchOpen && (
          <div style={{
            height:40, background:M.elev, border:`1px solid ${M.border}`, borderRadius:12,
            padding:'0 12px 0 14px', display:'flex', alignItems:'center', gap:8, marginBottom:10,
          }}>
            <Ico d={ICONS.search} w={16} sw={1.8}/>
            <span style={{flex:1, fontSize:13, color:M.faint}}>搜索币种 · BTC, ETH, SOL…</span>
            <button onClick={()=>setSearchOpen(false)} style={{
              width:24, height:24, borderRadius:12, border:0, background:'transparent',
              color:M.mid, cursor:'pointer', fontSize:16, lineHeight:1, padding:0,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>×</button>
          </div>
        )}
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
            onClick={()=>setSearchOpen(v=>!v)}
            style={{
              width:30, height:30, marginBottom:4, borderRadius:15, border:0,
              background: searchOpen ? M.elev : 'transparent',
              color: searchOpen ? M.text : M.mid, cursor:'pointer', padding:0,
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

// ScreenMarket 是 ScreenStrategy 的历史别名，保留以兼容外部直接引用的脚本。
Object.assign(window, { ScreenAIConfig, ScreenStrategy, ScreenMarket: ScreenStrategy, ScreenTickers, StratCard, TickerRow });

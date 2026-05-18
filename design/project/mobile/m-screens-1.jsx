/* Mobile screens for Quantify — composed from m-shell primitives.
   Each screen returns the device-content (status bar + content). */

/* candle chart svg helper */
function MiniChart({ width=358, height=180, up=true }) {
  const seed=[140,142,138,150,146,164,158,170,166,178,172,180,174,196,188];
  const pts = seed.map((v,i)=>`${(i/(seed.length-1))*width},${height-(v-130)*1.6}`).join(' ');
  const col = up ? M.up : M.dn;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{display:'block'}}>
      <defs>
        <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.22"/>
          <stop offset="100%" stopColor={col} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[40,80,120,160].map(y=>(<line key={y} x1="0" y1={y} x2={width} y2={y} stroke={M.borderSoft}/>))}
      <polyline fill="none" stroke={col} strokeWidth="1.8" points={pts}/>
      <polygon fill="url(#ga)" points={`${pts} ${width},${height} 0,${height}`}/>
    </svg>
  );
}

function Candles({ width=358, height=240 }) {
  const N = 30;
  const candles = [];
  let p = 68000;
  const arr = [];
  for (let i=0;i<N;i++){
    const o = p;
    const dir = Math.sin(i*0.6)+0.4*Math.cos(i*1.3);
    const c = o + dir*220 + (i%4===0?180:0);
    const h = Math.max(o,c) + 60 + Math.abs(Math.sin(i*0.4))*120;
    const l = Math.min(o,c) - 40 - Math.abs(Math.cos(i*0.7))*100;
    arr.push({o,c,h,l});
    p = c;
  }
  const min = Math.min(...arr.map(a=>a.l));
  const max = Math.max(...arr.map(a=>a.h));
  const span = max-min;
  const y = v => ((max-v)/span) * (height-30) + 8;
  const cw = (width-32)/N;
  arr.forEach((a,i)=>{
    const x = 16 + i*cw + cw/2;
    const up = a.c >= a.o;
    const col = up ? M.up : M.dn;
    candles.push(
      <g key={i}>
        <line x1={x} x2={x} y1={y(a.h)} y2={y(a.l)} stroke={col} strokeWidth="1"/>
        <rect x={x-cw*0.32} y={Math.min(y(a.o),y(a.c))} width={cw*0.64}
          height={Math.max(2,Math.abs(y(a.o)-y(a.c)))} fill={col}/>
      </g>
    );
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[60,120,180].map(yy=>(<line key={yy} x1="0" x2={width} y1={yy} y2={yy} stroke={M.borderSoft} strokeDasharray="2 4"/>))}
      {candles}
    </svg>
  );
}

/* ========================================================================
   SCREEN 1 — LOGIN
   ======================================================================== */
function ScreenLogin() {
  return (
    <div style={{height:'100%', display:'flex', flexDirection:'column', background:M.elev}}>
      {/* gradient hero — smaller, leaves room for thumb-area actions */}
      <div style={{
        height: 300, position:'relative', overflow:'hidden', flexShrink:0,
        background:`
          radial-gradient(420px 320px at 78% 20%, rgba(167,139,250,0.35), transparent 60%),
          radial-gradient(360px 280px at 18% 78%, rgba(124,92,255,0.30), transparent 60%),
          linear-gradient(160deg, #0F0B22 0%, #1A1240 60%, #271A66 100%)
        `,
      }}>
        <MStatus dark/>
        {/* concentric rings */}
        <svg width="402" height="300" viewBox="0 0 402 300" style={{position:'absolute', inset:0, opacity:0.5}}>
          <defs>
            <linearGradient id="lr" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0"/>
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.4"/>
            </linearGradient>
          </defs>
          {[60,110,170,240,310].map((r,i)=>(<circle key={i} cx="320" cy="40" r={r} stroke="url(#lr)" fill="none" strokeWidth="1"/>))}
        </svg>
        <div style={{position:'absolute', top:62, left:24, right:24, color:'#fff'}}>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:64}}>
            <div style={{
              width:32, height:32, borderRadius:9,
              background:'linear-gradient(180deg,#fff 0%,#DDD6FE 100%)',
              color:'#5B21B6', display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Ico d={['M4 14l5-5 4 4 7-7','M14 6h6v6']} w={16} sw={2.2}/>
            </div>
            <div style={{fontWeight:700, fontSize:16, letterSpacing:-0.2}}>Quantify</div>
          </div>
          <div style={{fontSize:26, fontWeight:700, lineHeight:1.2, letterSpacing:-0.4, marginBottom:8}}>
            把交易想法<br/>变成可回测的策略
          </div>
          <div style={{fontSize:13, color:'#C7C0EE', lineHeight:1.6}}>
            对话生成 · 历史回测 · API 部署
          </div>
        </div>
      </div>

      {/* form — fields up top, spacer below pushes actions to thumb zone */}
      <div style={{flex:1, padding:'24px 24px 0', display:'flex', flexDirection:'column', minHeight:0}}>
        <div style={{fontSize:20, fontWeight:700, letterSpacing:-0.2, marginBottom:4}}>欢迎回来</div>
        <div style={{fontSize:13, color:M.mid, marginBottom:18}}>使用邮箱或 Telegram 继续</div>

        <Field label="邮箱" value="victor@gmail.com"/>
        <div style={{height:12}}/>
        <Field label="密码" value="••••••••••" right={<span style={{fontSize:12, color:M.violet, fontWeight:500}}>忘记?</span>}/>

        {/* spacer pushes the action stack to the bottom thumb zone */}
        <div style={{flex:1, minHeight:16}}/>

        {/* bottom action stack — anchored within easy thumb reach */}
        <div style={{paddingBottom:40}}>
          <button style={{
            width:'100%', height:50, borderRadius:14, border:0,
            background: M.violetGrad, color:'#fff', fontSize:15, fontWeight:600,
            boxShadow:'0 8px 24px rgba(124,92,255,0.32)', cursor:'pointer',
          }}>登录</button>

          <div style={{display:'flex', alignItems:'center', gap:10, margin:'14px 0', color:M.faint, fontSize:11}}>
            <div style={{flex:1, height:1, background:M.border}}/>
            <span>或者</span>
            <div style={{flex:1, height:1, background:M.border}}/>
          </div>

          <button style={{
            width:'100%', height:46, borderRadius:14, border:`1px solid ${M.border}`,
            background:M.elev, fontSize:14, fontWeight:500, color:M.text, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#2AABEE">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.6 8.2-1.9 8.8c-.1.6-.5.8-1 .5l-2.8-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-2.9 5.3-4.8c.2-.2 0-.3-.3-.1L8.5 13.3l-2.9-.9c-.6-.2-.6-.6.1-.9l11.4-4.4c.5-.2 1 .1.5.8z"/>
            </svg>
            通过 Telegram 登录
          </button>

          <div style={{textAlign:'center', fontSize:11, color:M.dim, marginTop:14, lineHeight:1.6}}>
            继续即表示同意 <span style={{color:M.violet}}>服务条款</span> 与 <span style={{color:M.violet}}>隐私政策</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, right, placeholder }) {
  return (
    <div>
      <div style={{fontSize:12, color:M.mid, marginBottom:6}}>{label}</div>
      <div style={{
        height:46, padding:'0 14px', borderRadius:11, background:M.soft,
        border:`1px solid ${M.borderSoft}`, display:'flex', alignItems:'center', gap:10,
      }}>
        <span style={{flex:1, fontSize:14, color: value ? M.text : M.faint}}>{value || placeholder}</span>
        {right}
      </div>
    </div>
  );
}

/* ========================================================================
   SCREEN 2 — AI CHAT (with backtest result bubble)
   ======================================================================== */
/* shared session store — module-level so it survives tab switches */
const QF_GREETING = { who:'bot', kind:'text',
  text: <>告诉我你的交易想法，我会帮你生成策略并回测。<br/>回测最大回撤需 <strong>≤ 20%</strong> 才能一键部署。</> };

if (!window.__qfChatSessions) {
  window.__qfChatSessions = {
    items: [
      {
        id: 's1', title: 'BTC 趋势 · 双均线', pair:'BTC/USDT', timeframe:'15m',
        category:'趋势跟踪', updatedAt:'刚刚',
        backtest: { cagr:'+31.6%', sharpe:'1.78', mdd:'-12.4%' },
        messages: [
          QF_GREETING,
          { who:'user', kind:'text', text:'BTC 15 分钟周期，5 日均线上穿 20 日均线开多，跌破平仓，止损 2%。' },
          { who:'bot',  kind:'params' },
          { who:'user', kind:'text', text:'开始回测，区间 2021-01 至今' },
          { who:'bot',  kind:'result' },
        ],
      },
      {
        id: 's2', title: 'ETH 4H 均值回归', pair:'ETH/USDT', timeframe:'4H',
        category:'反转', updatedAt:'昨天 18:42',
        backtest: { cagr:'+18.2%', sharpe:'1.42', mdd:'-9.1%' },
        messages: [
          QF_GREETING,
          { who:'user', kind:'text', text:'ETH 4 小时 RSI 低于 30 开多，回到 50 平仓，止损 3%。' },
          { who:'bot',  kind:'text', text:<>已识别为 <strong>均值回归</strong> 策略。注意：RSI 阈值需根据波动率动态调整，否则反弹失败率较高。</> },
          { who:'bot',  kind:'text', text:<>初步回测：<strong>CAGR +18.2% · 最大回撤 -9.1%</strong>，可一键部署。需要我细化参数吗？</> },
        ],
      },
      {
        id: 's3', title: 'SOL 网格 · 区间震荡', pair:'SOL/USDT', timeframe:'1H',
        category:'网格', updatedAt:'3 天前',
        backtest: null,
        messages: [
          QF_GREETING,
          { who:'user', kind:'text', text:'SOL 1 小时，140-180 区间内做网格，10 格。' },
          { who:'bot',  kind:'text', text:<>明白。网格策略需要先确认 SOL 当前是否在 <strong>140-180</strong> 区间内运行。我先拉一下最近 30 天数据。</> },
        ],
      },
    ],
    currentId: 's1',
  };
}

function ScreenAIChat() {
  const store = window.__qfChatSessions;
  const [sessions, setSessions] = React.useState(store.items);
  const [currentId, setCurrentId] = React.useState(store.currentId);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [deployFor, setDeployFor]   = React.useState(null); // {cagr,sharpe,mdd} | null
  const [toast, setToast]           = React.useState(null);
  const [draft, setDraft] = React.useState('');
  const [typing, setTyping] = React.useState(false);
  const scrollRef = React.useRef(null);
  const inputRef  = React.useRef(null);

  // sync writes back to module-level store so they survive unmount
  React.useEffect(() => { store.items = sessions; store.currentId = currentId; }, [sessions, currentId]);

  const current = sessions.find(s => s.id === currentId) || sessions[0];
  const msgs = current.messages;
  const setMsgs = (updater) => {
    setSessions(prev => prev.map(s => s.id === current.id
      ? { ...s, messages: typeof updater === 'function' ? updater(s.messages) : updater, updatedAt: '刚刚' }
      : s));
  };

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing, currentId]);

  const replyFor = (q) => {
    const s = q.toLowerCase();
    if (/回测|backtest/i.test(q))
      return <>好的，我会用历史数据跑一次回测。请稍候，结果将以图表与指标卡片返回。</>;
    if (/止损|stop|风控/i.test(q))
      return <>建议止损保持在 <strong>1.5% – 3%</strong> 之间。当前策略止损为 <strong>2%</strong>，可在「参数」中调整。</>;
    if (/部署|deploy|实盘/i.test(q))
      return <>部署到 Binance 需要最大回撤 ≤ 20%。当前为 <strong>-12.4%</strong>，已满足条件，可以点击「一键部署」。</>;
    if (/参数|param|调整/i.test(q))
      return <>你可以点击右上角 <Chip tone="violet">参数</Chip> 修改 fast_ma / slow_ma / 止损 / 仓位等。</>;
    if (s.includes('eth') || s.includes('以太'))
      return <>已切换至 <strong>ETH/USDT · 15m</strong>，要不要也跑一次同样规则的回测？</>;
    return <>明白了，我会基于「{q.slice(0, 24)}{q.length>24?'…':''}」帮你迭代策略。需要我重新跑一次回测吗？</>;
  };

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setMsgs(m => [...m, { who:'user', kind:'text', text: t }]);
    setDraft('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs(m => [...m, { who:'bot', kind:'text', text: replyFor(t) }]);
    }, 850);
  };

  const newSession = () => {
    const id = 's' + Date.now();
    const fresh = {
      id, title:'新方案', pair:'—', timeframe:'—',
      category:'未分类', updatedAt:'刚刚', backtest:null,
      messages: [QF_GREETING],
    };
    setSessions(prev => [fresh, ...prev]);
    setCurrentId(id);
    setDrawerOpen(false);
    setDraft('');
  };

  const deleteSession = (id) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (next.length === 0) {
        const fresh = { id:'s'+Date.now(), title:'新方案', pair:'—', timeframe:'—',
          category:'未分类', updatedAt:'刚刚', backtest:null, messages:[QF_GREETING] };
        setCurrentId(fresh.id);
        return [fresh];
      }
      if (id === currentId) setCurrentId(next[0].id);
      return next;
    });
  };

  const quick = ['再跑一次回测', '把止损改成 1.5%', '换成 ETH 看看', '部署到 Binance'];
  const stop = (e) => e.stopPropagation();

  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus/>
      <MTopBar
        title={current.title}
        sub={`${current.category} · ${current.pair}${current.timeframe!=='—' ? ' · '+current.timeframe : ''}`}
        left={
          <button onClick={(e)=>{stop(e); setDrawerOpen(true);}} style={{
            width:36, height:36, borderRadius:10, background:M.soft,
            color:M.text, border:0, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7"/>
              <path d="M3 4v5h5"/>
              <path d="M12 7v5l3 2"/>
            </svg>
          </button>
        }
        right={
          <div style={{display:'flex', gap:6}}>
            <button onClick={(e)=>{stop(e); newSession();}} style={{
              width:32, height:32, borderRadius:999, background:M.soft, color:M.text,
              border:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9"/>
                <path d="M16 3h6v6"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
            </button>
            <button style={{
              height:32, padding:'0 12px', borderRadius:999, background:M.violetSoft,
              color:M.violet, border:0, fontSize:12, fontWeight:600, cursor:'pointer',
              display:'flex', alignItems:'center', gap:6,
            }}><Ico d={ICONS.sliders} w={14} sw={2}/>参数</button>
          </div>
        }
      />
      <div ref={scrollRef} style={{flex:1, overflow:'auto', padding:'14px 16px 8px'}}>
        {msgs.map((m, i) => {
          if (m.kind === 'text') {
            return <Bubble key={i} user={m.who==='user'}>{m.text}</Bubble>;
          }
          if (m.kind === 'params') {
            return (
              <Bubble key={i}>
                已为你识别为 <Chip tone="violet" style={{margin:'0 2px'}}>趋势跟踪</Chip> 类策略。建议参数：
                <div style={{
                  marginTop:10, padding:'10px 12px', borderRadius:10, background:M.soft,
                  fontFamily:M.mono, fontSize:12, lineHeight:1.7, color:M.text,
                }}>
                  <div><span style={{color:M.dim}}>fast_ma</span> = 5</div>
                  <div><span style={{color:M.dim}}>slow_ma</span> = 20</div>
                  <div><span style={{color:M.dim}}>stop_loss</span> = 2.0%</div>
                  <div><span style={{color:M.dim}}>position</span> = 100%</div>
                </div>
                <div style={{marginTop:10}}>需要我开始回测吗？</div>
              </Bubble>
            );
          }
          if (m.kind === 'result') {
            return (
              <Bubble key={i}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
                  <Chip tone="ok"><span style={{width:6, height:6, borderRadius:3, background:M.ok}}/>回测完成</Chip>
                  <span style={{fontSize:11, color:M.dim}}>2021-01 → 2026-04 · 15m</span>
                </div>
                <div style={{background:M.soft, borderRadius:10, padding:'10px 12px 4px'}}>
                  <MiniChart width={282} height={88} up/>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:10}}>
                  <Stat label="CAGR" v="+31.6%" tone="up"/>
                  <Stat label="Sharpe" v="1.78"/>
                  <Stat label="最大回撤" v="-12.4%" tone="dn"/>
                </div>
                <button
                  onClick={(e)=>{stop(e); setDeployFor({cagr:'+31.6%', sharpe:'1.78', mdd:'-12.4%', pair: current.pair});}}
                  style={{
                  marginTop:12, width:'100%', height:38, borderRadius:10, border:0,
                  background:M.violetGrad, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer',
                  boxShadow:'0 4px 14px rgba(124,92,255,0.28)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                }}><Ico d={ICONS.play} w={14} fill="#fff" sw={0}/> 一键部署</button>
              </Bubble>
            );
          }
          return null;
        })}

        {typing && (
          <div style={{display:'flex', gap:8, marginBottom:14}}>
            <div style={{
              width:30, height:30, borderRadius:8, background:M.violetSoft, color:M.violet,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}><Ico d={ICONS.bot} w={16}/></div>
            <div style={{
              background:M.elev, border:`1px solid ${M.borderSoft}`,
              padding:'12px 14px', borderRadius:'4px 16px 16px 16px',
              display:'flex', alignItems:'center', gap:5,
            }}>
              {[0,1,2].map(k => (
                <span key={k} style={{
                  width:6, height:6, borderRadius:3, background:M.dim,
                  animation:`qfDot 1s ${k*0.15}s infinite ease-in-out`,
                }}/>
              ))}
            </div>
            <style>{`@keyframes qfDot { 0%,80%,100%{opacity:.25; transform:translateY(0)} 40%{opacity:1; transform:translateY(-3px)} }`}</style>
          </div>
        )}
      </div>

      {/* input */}
      <div style={{padding:'8px 16px 88px', background:M.bg, borderTop:`1px solid ${M.borderSoft}`}}>
        {/* quick replies */}
        <div style={{
          display:'flex', gap:6, overflowX:'auto', padding:'6px 0 8px', margin:'0 -16px 0',
          paddingLeft:16, paddingRight:16,
        }}>
          {quick.map(q => (
            <button key={q}
              onClick={(e)=>{ e.stopPropagation(); setDraft(q); inputRef.current?.focus(); }}
              style={{
                flexShrink:0, height:28, padding:'0 12px', borderRadius:999,
                background:M.violetSoft, color:M.violet, border:0,
                fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap',
              }}>{q}</button>
          ))}
        </div>

        <div style={{
          background:M.elev, border:`1px solid ${draft ? M.violet : M.border}`, borderRadius:18,
          padding:'8px 8px 8px 16px', display:'flex', alignItems:'flex-end', gap:8,
          transition:'border-color .15s',
        }}>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e)=>setDraft(e.target.value)}
            onClick={(e)=>e.stopPropagation()}
            onKeyDown={(e)=>{
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="继续追问或要求修改…"
            rows={1}
            style={{
              flex:1, fontSize:14, minHeight:24, maxHeight:96, paddingTop:6, paddingBottom:6,
              color:M.text, background:'transparent', border:0, outline:'none', resize:'none',
              fontFamily:'inherit', lineHeight:1.45,
            }}
          />
          <button
            onClick={(e)=>{ e.stopPropagation(); send(); }}
            disabled={!draft.trim()}
            style={{
              width:34, height:34, borderRadius:10, border:0,
              background: draft.trim() ? M.violetGrad : M.soft,
              color: draft.trim() ? '#fff' : M.faint,
              boxShadow: draft.trim() ? '0 4px 12px rgba(124,92,255,0.32)' : 'none',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor: draft.trim() ? 'pointer' : 'default', flexShrink:0,
              transition:'all .15s',
            }}><Ico d={ICONS.send} w={18} sw={2}/></button>
        </div>
      </div>

      <MTabBar active="ai"/>

      {/* history drawer */}
      {drawerOpen && (
        <div onClick={(e)=>{stop(e); setDrawerOpen(false);}} style={{
          position:'absolute', inset:0, background:'rgba(15,11,34,0.55)', zIndex:70,
          animation:'qfFade .15s ease-out',
        }}>
          <div onClick={stop} style={{
            position:'absolute', left:0, top:0, bottom:0, width:'82%',
            background:M.bg, display:'flex', flexDirection:'column',
            boxShadow:'8px 0 32px rgba(15,11,34,0.32)',
            animation:'qfSlideIn .22s ease-out',
          }}>
            {/* drawer head */}
            <div style={{padding:'52px 16px 12px', borderBottom:`1px solid ${M.borderSoft}`}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:17, fontWeight:700, color:M.text}}>策略方案</div>
                  <div style={{fontSize:11, color:M.dim, marginTop:2}}>每个方案独立上下文 · 互不污染</div>
                </div>
                <button onClick={(e)=>{stop(e); setDrawerOpen(false);}} style={{
                  width:32, height:32, borderRadius:16, background:M.soft, color:M.mid,
                  border:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                }}><Ico d={ICONS.close} w={16} sw={2}/></button>
              </div>
              <button onClick={(e)=>{stop(e); newSession();}} style={{
                width:'100%', height:40, borderRadius:11, border:0,
                background:M.violetGrad, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer',
                boxShadow:'0 4px 14px rgba(124,92,255,0.28)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                新建方案
              </button>
            </div>

            {/* session list */}
            <div style={{flex:1, overflow:'auto', padding:'8px 8px 16px'}}>
              {sessions.map(s => {
                const on = s.id === currentId;
                const preview = lastUserOrBot(s.messages);
                return (
                  <div key={s.id}
                    onClick={(e)=>{stop(e); setCurrentId(s.id); setDrawerOpen(false);}}
                    style={{
                      padding:'10px 12px', borderRadius:10, cursor:'pointer', marginBottom:4,
                      background: on ? M.violetSoft : 'transparent',
                      border: on ? `1px solid rgba(124,92,255,0.3)` : '1px solid transparent',
                      display:'flex', gap:10, alignItems:'flex-start',
                    }}>
                    <div style={{
                      width:32, height:32, borderRadius:8, flexShrink:0,
                      background: on ? M.violet : M.soft,
                      color: on ? '#fff' : M.mid,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}><Ico d={ICONS.bot} w={16}/></div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:3}}>
                        <span style={{
                          fontSize:13, fontWeight:600, color: on ? M.violet : M.text,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                          flex:'0 1 auto', minWidth:0,
                        }}>{s.title}</span>
                        {s.backtest && (
                          <span style={{
                            flexShrink:0, padding:'1px 5px', borderRadius:4, fontSize:9,
                            fontWeight:700, fontFamily:M.mono,
                            background:'rgba(22,199,131,0.12)', color:M.up,
                          }}>{s.backtest.cagr}</span>
                        )}
                      </div>
                      <div style={{
                        fontSize:11, color:M.dim, lineHeight:1.4,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      }}>{preview}</div>
                      <div style={{display:'flex', alignItems:'center', gap:8, marginTop:5}}>
                        <span style={{fontSize:10, color:M.faint, fontFamily:M.mono}}>{s.updatedAt}</span>
                        <span style={{fontSize:10, color:M.dim}}>· {s.messages.length} 条</span>
                      </div>
                    </div>
                    {on && (
                      <button onClick={(e)=>{e.stopPropagation(); deleteSession(s.id);}} style={{
                        width:24, height:24, borderRadius:6, border:0, background:'transparent',
                        color:M.dim, cursor:'pointer', flexShrink:0,
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 7h16M9 7V4h6v3M6 7v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7"/>
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* drawer footer */}
            <div style={{
              padding:'10px 16px 24px', borderTop:`1px solid ${M.borderSoft}`,
              fontSize:11, color:M.dim, display:'flex', alignItems:'center', gap:6,
            }}>
              <Ico d={ICONS.shield} w={12} fill={M.dim} sw={0}/>
              方案之间上下文隔离 · 不会互相干扰
            </div>
          </div>
        </div>
      )}
      {/* deploy modal */}
      {deployFor && (
        <DeployModal
          info={deployFor}
          onClose={()=>setDeployFor(null)}
          onDeployed={(ex)=>{
            setDeployFor(null);
            setMsgs(m => [...m, {
              who:'bot', kind:'text',
              text: <>已成功部署到 <strong>{ex}</strong>。可在「我的 → 实盘策略」查看运行状态与持仓。</>
            }]);
            setToast(`已部署到 ${ex}`);
            setTimeout(()=>setToast(null), 2400);
          }}
        />
      )}

      {toast && (
        <div style={{
          position:'absolute', left:'50%', bottom:120, transform:'translateX(-50%)',
          background:'rgba(15,11,34,0.92)', color:'#fff', padding:'10px 16px',
          borderRadius:10, fontSize:12, fontWeight:500, zIndex:90,
          boxShadow:'0 8px 24px rgba(15,11,34,0.32)',
          display:'flex', alignItems:'center', gap:8, maxWidth:'90%',
          animation:'qfToast .25s ease-out',
        }}>
          <span style={{color:'#16C783', display:'flex'}}><Ico d={ICONS.check} w={14} sw={2.4}/></span>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes qfSlideIn { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        @keyframes qfFade    { from{opacity:0} to{opacity:1} }
        @keyframes qfToast   { from{opacity:0; transform:translate(-50%, 6px)} to{opacity:1; transform:translate(-50%, 0)} }
        @keyframes qfSpin    { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}

/* ---- deploy modal: pick exchange, walk through auth if needed ---- */
const EXCHANGES = [
  { k:'binance',     name:'Binance',     color:'#F0B90B', bg:'#F0B90B', glyph:'B',
    authorized:true,  perms:'读取 + 现货下单 + 永续', tag:'推荐' },
  { k:'okx',         name:'OKX',         color:'#1E1E1E', bg:'#000',    glyph:'O',
    authorized:false, perms:'未授权' },
  { k:'bybit',       name:'Bybit',       color:'#F7A600', bg:'#F7A600', glyph:'B',
    authorized:false, perms:'未授权' },
  { k:'hyperliquid', name:'Hyperliquid', color:'#7CFFCB', bg:'#0B3D33', glyph:'H',
    authorized:false, perms:'未授权', tag:'链上' },
];

function DeployModal({ info, onClose, onDeployed }) {
  const [stage, setStage]   = React.useState('select'); // select | authorize | deploying
  const [target, setTarget] = React.useState(null);
  const [authEx, setAuthEx] = React.useState(null);
  const [agree, setAgree]   = React.useState(false);
  const stop = (e)=>e.stopPropagation();

  const startDeploy = (ex) => {
    setTarget(ex);
    setStage('deploying');
    setTimeout(()=> onDeployed(ex.name), 1800);
  };
  const goAuth = (ex) => { setAuthEx(ex); setStage('authorize'); };

  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, background:'rgba(15,11,34,0.55)', zIndex:85,
      animation:'qfFade .15s ease-out',
    }}>
      <div onClick={stop} style={{
        position:'absolute', left:0, right:0, bottom:0,
        background:M.elev, borderRadius:'20px 20px 0 0',
        boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
        display:'flex', flexDirection:'column', maxHeight:'88%',
        animation:'qfSlideUp .25s cubic-bezier(.2,.8,.2,1)',
      }}>
        <div style={{width:42, height:4, borderRadius:2, background:M.border, margin:'10px auto 0'}}/>

        {stage === 'select' && (
          <>
            <div style={{padding:'14px 20px 6px', display:'flex', alignItems:'center', gap:12}}>
              <div style={{
                width:36, height:36, borderRadius:10, background:M.violetSoft, color:M.violet,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}><Ico d={ICONS.play} w={18} fill={M.violet} sw={0}/></div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:17, fontWeight:700, color:M.text}}>选择部署目标</div>
                <div style={{fontSize:12, color:M.mid, marginTop:2}}>
                  {info.pair} · CAGR {info.cagr} · 回撤 {info.mdd}
                </div>
              </div>
              <button onClick={onClose} style={{
                width:32, height:32, borderRadius:16, background:M.soft, color:M.mid,
                border:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              }}><Ico d={ICONS.close} w={16} sw={2}/></button>
            </div>

            {/* risk check banner */}
            <div style={{
              margin:'8px 20px 12px', padding:'10px 12px', borderRadius:10,
              background:'rgba(22,199,131,0.10)', border:'1px solid rgba(22,199,131,0.20)',
              display:'flex', alignItems:'flex-start', gap:8,
            }}>
              <Ico d={ICONS.shield} w={14} fill={M.ok} sw={0}/>
              <div style={{fontSize:12, color:M.ok, lineHeight:1.5}}>
                风控通过 · 最大回撤 <strong>{info.mdd}</strong>（阈值 ≤ 20%）
              </div>
            </div>

            <div style={{flex:1, overflow:'auto', padding:'0 12px 8px'}}>
              {EXCHANGES.map(ex => (
                <ExchangeRow key={ex.k} ex={ex}
                  onSelect={()=> ex.authorized ? startDeploy(ex) : goAuth(ex)}/>
              ))}
            </div>

            <div style={{
              padding:'10px 20px 28px', borderTop:`1px solid ${M.borderSoft}`,
              display:'flex', alignItems:'center', gap:8,
              fontSize:11, color:M.dim,
            }}>
              <Ico d={ICONS.shield} w={12} fill={M.dim} sw={0}/>
              我们绝不持有你的密钥，签名仅在你的设备完成
            </div>
          </>
        )}

        {stage === 'authorize' && authEx && (
          <>
            <div style={{padding:'14px 20px 6px', display:'flex', alignItems:'center', gap:12}}>
              <button onClick={()=>{ setStage('select'); setAuthEx(null); }} style={{
                width:32, height:32, borderRadius:8, background:M.soft, color:M.mid,
                border:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 6l-6 6 6 6"/>
                </svg>
              </button>
              <div style={{flex:1}}>
                <div style={{fontSize:16, fontWeight:700, color:M.text}}>授权 {authEx.name}</div>
                <div style={{fontSize:11, color:M.mid, marginTop:2}}>3 步完成，全程加密</div>
              </div>
              <button onClick={onClose} style={{
                width:32, height:32, borderRadius:16, background:M.soft, color:M.mid,
                border:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              }}><Ico d={ICONS.close} w={16} sw={2}/></button>
            </div>

            <div style={{flex:1, overflow:'auto', padding:'10px 20px 4px'}}>
              {/* exchange identity */}
              <div style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px',
                background:M.soft, borderRadius:12, marginBottom:14,
              }}>
                <ExGlyph ex={authEx} size={42}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:14, fontWeight:600}}>{authEx.name}</div>
                  <div style={{fontSize:11, color:M.warn, marginTop:2,
                    display:'flex', alignItems:'center', gap:4}}>
                    <span style={{width:6, height:6, borderRadius:3, background:M.warn}}/>
                    未授权 · 无法接收订单
                  </div>
                </div>
              </div>

              {/* steps */}
              <div style={{fontSize:12, color:M.mid, marginBottom:8, fontWeight:500}}>授权步骤</div>
              <Step n={1} title={`在 ${authEx.name} 创建 API Key`} sub="登录交易所 → API 管理 → 创建新密钥"/>
              <Step n={2} title="仅勾选「读取 + 现货/合约下单」" sub="务必关闭「提币」权限，我们会服务端二次校验"/>
              <Step n={3} title="把 API Key / Secret 粘到 Quantify" sub="加密存储在你的设备本地，不会上传"/>

              {/* permission warning */}
              <div style={{
                margin:'14px 0 6px', padding:'12px', borderRadius:10,
                background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.25)',
                display:'flex', alignItems:'flex-start', gap:10,
              }}>
                <Ico d={ICONS.shield} w={16} fill={M.warn} sw={0}/>
                <div style={{fontSize:12, color:M.warn, lineHeight:1.55}}>
                  <strong>必须关闭提币权限</strong>。我们会再校验一次，发现允许提币的密钥会立即拒绝部署。
                </div>
              </div>

              <label onClick={()=>setAgree(a=>!a)} style={{
                display:'flex', alignItems:'flex-start', gap:8, padding:'12px 0',
                cursor:'pointer',
              }}>
                <div style={{
                  width:18, height:18, borderRadius:5, marginTop:1, flexShrink:0,
                  background: agree ? M.violet : 'transparent',
                  border: `1.5px solid ${agree ? M.violet : M.border}`,
                  color:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  {agree && <Ico d={ICONS.check} w={12} sw={3} fill="none"/>}
                </div>
                <span style={{fontSize:12, color:M.mid, lineHeight:1.5}}>
                  我已了解：API 密钥将仅用于按本方案执行交易，可以随时在「我的 → API 管理」撤销。
                </span>
              </label>
            </div>

            <div style={{padding:'10px 20px 28px', borderTop:`1px solid ${M.borderSoft}`, display:'flex', gap:8}}>
              <button onClick={()=>{ setStage('select'); setAuthEx(null); }} style={{
                height:46, padding:'0 16px', borderRadius:12, border:`1px solid ${M.border}`,
                background:M.elev, fontSize:13, fontWeight:500, color:M.mid, cursor:'pointer',
              }}>取消</button>
              <button
                onClick={()=>{
                  if (!agree) return;
                  // open API config sheet; close this modal in the process
                  window.__nav?.sheet?.('api');
                  onClose();
                }}
                disabled={!agree}
                style={{
                  flex:1, height:46, borderRadius:12, border:0,
                  background: agree ? M.violetGrad : M.border, color:'#fff',
                  fontSize:14, fontWeight:600, cursor: agree ? 'pointer' : 'default',
                  boxShadow: agree ? '0 6px 20px rgba(124,92,255,0.32)' : 'none',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
                打开 {authEx.name} 授权页
              </button>
            </div>
          </>
        )}

        {stage === 'deploying' && target && (
          <div style={{padding:'42px 32px 56px', display:'flex', flexDirection:'column', alignItems:'center', gap:14}}>
            <div style={{position:'relative', width:64, height:64}}>
              <ExGlyph ex={target} size={64}/>
              <div style={{
                position:'absolute', inset:-6, borderRadius:'50%',
                border:`2px solid ${M.violetSoft}`, borderTopColor:M.violet,
                animation:'qfSpin .9s linear infinite',
              }}/>
            </div>
            <div style={{fontSize:16, fontWeight:700, marginTop:6, color:M.text}}>正在部署到 {target.name}</div>
            <DeployProgress/>
          </div>
        )}
      </div>
      <style>{`@keyframes qfSlideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }`}</style>
    </div>
  );
}

function ExGlyph({ ex, size=36 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:size/4.5, background:ex.bg,
      color: ex.k === 'okx' ? '#fff' : '#fff',
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      fontWeight:800, fontSize:size*0.5,
      boxShadow: ex.k === 'binance' ? '0 4px 12px rgba(240,185,11,0.28)' : 'none',
    }}>{ex.glyph}</div>
  );
}

function ExchangeRow({ ex, onSelect }) {
  const auth = ex.authorized;
  return (
    <button onClick={onSelect} style={{
      width:'100%', padding:'12px', borderRadius:12, border:0, background:'transparent',
      display:'flex', alignItems:'center', gap:12, cursor:'pointer',
      textAlign:'left',
    }}>
      <ExGlyph ex={ex} size={40}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:3}}>
          <span style={{fontSize:14, fontWeight:600, color:M.text}}>{ex.name}</span>
          {ex.tag && (
            <span style={{
              padding:'1px 6px', borderRadius:4, fontSize:9, fontWeight:700,
              background: ex.tag==='推荐' ? 'rgba(22,199,131,0.12)' : 'rgba(124,92,255,0.12)',
              color: ex.tag==='推荐' ? M.ok : M.violet, letterSpacing:0.3,
            }}>{ex.tag}</span>
          )}
        </div>
        <div style={{
          fontSize:11, color: auth ? M.ok : M.warn, fontWeight:500,
          display:'flex', alignItems:'center', gap:5,
        }}>
          <span style={{
            width:6, height:6, borderRadius:3,
            background: auth ? M.ok : M.warn,
            boxShadow: auth ? '0 0 0 3px rgba(22,199,131,0.18)' : 'none',
          }}/>
          {auth ? `已授权 · ${ex.perms}` : '未授权 · 需先添加 API 密钥'}
        </div>
      </div>
      <div style={{
        height:30, padding:'0 12px', borderRadius:999,
        background: auth ? M.violetGrad : M.soft,
        color: auth ? '#fff' : M.text,
        fontSize:12, fontWeight:600,
        display:'flex', alignItems:'center', gap:5,
        flexShrink:0,
        boxShadow: auth ? '0 4px 12px rgba(124,92,255,0.28)' : 'none',
      }}>
        {auth ? '部署' : '去授权'}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6"/>
        </svg>
      </div>
    </button>
  );
}

function Step({ n, title, sub }) {
  return (
    <div style={{display:'flex', gap:10, padding:'6px 0'}}>
      <div style={{
        width:22, height:22, borderRadius:11, background:M.violetSoft, color:M.violet,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:11, fontWeight:700, flexShrink:0, marginTop:1,
      }}>{n}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:13, fontWeight:500, color:M.text}}>{title}</div>
        <div style={{fontSize:11, color:M.dim, marginTop:2, lineHeight:1.5}}>{sub}</div>
      </div>
    </div>
  );
}

function DeployProgress() {
  const steps = ['校验风控', '推送策略', '启动节点', '订阅行情'];
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(()=>setStep(s => Math.min(steps.length, s+1)), 420);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{width:'100%', maxWidth:260, display:'flex', flexDirection:'column', gap:8, marginTop:8}}>
      {steps.map((s,i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={s} style={{display:'flex', alignItems:'center', gap:10, fontSize:13}}>
            <div style={{
              width:18, height:18, borderRadius:9, flexShrink:0,
              background: done ? M.ok : active ? M.violetSoft : M.soft,
              color: done ? '#fff' : M.violet,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {done ? <Ico d={ICONS.check} w={11} sw={3}/> :
                active ? <span style={{
                  width:8, height:8, borderRadius:4, border:`1.5px solid ${M.violet}`,
                  borderTopColor:'transparent', animation:'qfSpin .8s linear infinite',
                }}/> : null}
            </div>
            <span style={{color: done ? M.text : active ? M.violet : M.dim, fontWeight: active?600:500}}>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

/* derive a one-line preview from a session's messages */
function lastUserOrBot(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.kind === 'text') return typeof m.text === 'string' ? m.text : extractText(m.text);
    if (m.kind === 'result') return '✓ 回测完成 · 可一键部署';
    if (m.kind === 'params') return '已生成策略参数';
  }
  return '新方案';
}
function extractText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node.props && node.props.children) return extractText(node.props.children);
  return '';
}

function Bubble({ user, children }) {
  if (user) return (
    <div style={{display:'flex', justifyContent:'flex-end', marginBottom:14}}>
      <div style={{
        maxWidth:'78%', background:M.violetSoft, padding:'10px 14px',
        borderRadius:'16px 16px 4px 16px', fontSize:13.5, lineHeight:1.55, color:M.text,
      }}>{children}</div>
    </div>
  );
  return (
    <div style={{display:'flex', gap:8, marginBottom:14}}>
      <div style={{
        width:30, height:30, borderRadius:8, background:M.violetSoft, color:M.violet,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}><Ico d={ICONS.bot} w={16}/></div>
      <div style={{
        maxWidth:'82%', background:M.elev, border:`1px solid ${M.borderSoft}`,
        padding:'10px 14px', borderRadius:'4px 16px 16px 16px', fontSize:13.5,
        lineHeight:1.55, color:M.text,
      }}>{children}</div>
    </div>
  );
}

function Stat({ label, v, tone }) {
  const c = tone==='up' ? M.up : tone==='dn' ? M.dn : M.text;
  return (
    <div style={{background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:8, padding:'8px 10px', textAlign:'center'}}>
      <div style={{fontSize:10, color:M.dim, letterSpacing:0.4, textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:14, fontWeight:700, color:c, fontFamily:M.mono, marginTop:2}}>{v}</div>
    </div>
  );
}

Object.assign(window, { ScreenLogin, ScreenAIChat, MiniChart, Candles, Bubble, Stat, Field });

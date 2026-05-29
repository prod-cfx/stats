/* ========================================================================
   SCREEN — 回测 (Backtest) · 两个状态
     · ScreenBacktestRun    回测中 (进度页)
     · ScreenBacktestResult 回测结果 (详情页)
   ======================================================================== */

/* tiny helpers shared by both states ------------------------------------ */
function BtSectTitle({ children, right }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'4px 4px 8px', gap:8,
    }}>
      <div style={{fontSize:12, color:M.mid, fontWeight:600, letterSpacing:0.2, whiteSpace:'nowrap'}}>
        {children}
      </div>
      {right}
    </div>
  );
}

/* === REUSED PRIMITIVES ===================================================
   We import the unified 5-step BtcStepBar from m-screens-btconfig.jsx (loaded
   first, exposed on window). Backtest run + result pages adopt the same step
   bar as confirm / script / btconfig so the whole flow stays aligned. */
const BtcStepBar = window.BtcStepBar;

function BtTopBar({ title, sub, right }) {
  return (
    <MTopBar
      title={title}
      sub={sub}
      onBack
      backTo="confirm"
      right={right}
    />
  );
}

/* === STATE 1 ============================================================
   回测中 — 进度页
   ====================================================================== */
function ScreenBacktestRun() {
  // animated progress for the prototype (counts 0→100, then navs to result)
  const [pct, setPct] = React.useState(38);
  React.useEffect(() => {
    if (pct >= 100) {
      // when running inside the prototype, auto-advance to the result screen
      if (typeof window !== 'undefined' && window.__nav) {
        const t = setTimeout(() => window.__nav.go('btres'), 500);
        return () => clearTimeout(t);
      }
      return;
    }
    const t = setTimeout(() => setPct(p => Math.min(100, p + 2)), 110);
    return () => clearTimeout(t);
  }, [pct]);

  // derived live stats — purely cosmetic, scale with progress
  const totalBars = 52416;
  const processedBars = Math.round(totalBars * pct/100);
  const trades = Math.round(184 * pct/100);
  const wins   = Math.round(102 * pct/100);
  const losses = trades - wins;

  return (
    <div style={{height:'100%', display:'flex', flexDirection:'column', background:M.bg}}>
      <MStatus/>
      <BtTopBar title="回测进行中" sub="BTC 趋势 · 双均线 · 15m"/>
      <BtcStepBar active={3} done={[0,1,2]}/>

      <div style={{flex:1, overflowY:'auto', padding:'12px 16px 100px'}}>
        {/* progress hero */}
        <Card p="22px 18px 20px" style={{marginBottom:14, textAlign:'center'}}>
          <BtRing pct={pct}/>
          <div style={{fontSize:13, color:M.mid, marginTop:14, marginBottom:4}}>
            正在回放历史 K 线
          </div>
          <div style={{fontSize:12, color:M.dim, fontFamily:M.mono}}>
            {/* current "period" being processed (cosmetic) */}
            <BtPeriod pct={pct}/>
          </div>
        </Card>

        {/* live counters */}
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14,
        }}>
          <BtCounter label="已处理 K 线"
            value={processedBars.toLocaleString()}
            sub={`/ ${totalBars.toLocaleString()}`}/>
          <BtCounter label="已生成交易"
            value={trades}
            sub={`胜 ${wins} · 负 ${losses}`}/>
          <BtCounter label="当前最大回撤"
            value={`-${(8.4 * pct/100).toFixed(2)}%`}
            tone={M.danger}/>
          <BtCounter label="当前累计收益"
            value={`+${(31.6 * pct/100).toFixed(2)}%`}
            tone={M.up}/>
        </div>

        {/* live mini equity curve grown to pct */}
        <BtSectTitle>实时净值</BtSectTitle>
        <Card p="12px 12px 6px" style={{marginBottom:14}}>
          <BtLiveCurve pct={pct} width={326} height={120}/>
          <div style={{
            display:'flex', justifyContent:'space-between',
            fontSize:10, color:M.dim, fontFamily:M.mono,
            padding:'0 2px 6px',
          }}>
            <span>2021-01</span>
            <span>2026-05</span>
          </div>
        </Card>

        {/* engine log — gives the page texture */}
        <BtSectTitle>引擎日志</BtSectTitle>
        <Card p="0" style={{marginBottom:14, overflow:'hidden'}}>
          {[
            { t:'09:41:03', m:'载入 BTC/USDT 15m K 线 · 52,416 条', tone:M.mid },
            { t:'09:41:04', m:'索引 fast_MA(5) / slow_MA(20) ... ✓', tone:M.mid },
            { t:'09:41:05', m:'回放开始 · 滑点 5bps · 手续费 2bps', tone:M.mid },
            { t:'09:41:07', m:'触发开多 @ 41,820.50 · 仓位 100%', tone:M.ok },
            { t:'09:41:09', m:'平多 @ 43,108.00 · +3.08%', tone:M.up },
            { t:'09:41:11', m:'触发开多 @ 44,260.00 · 仓位 100%', tone:M.ok },
            { t:'09:41:13', m:'止损触发 @ 43,375.00 · -2.00%', tone:M.danger },
          ].map((l, i, a) => (
            <div key={i} style={{
              padding:'8px 14px', display:'flex', gap:10, alignItems:'baseline',
              borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
              fontFamily:M.mono, fontSize:11,
            }}>
              <span style={{color:M.dim, flexShrink:0}}>{l.t}</span>
              <span style={{color:l.tone, flex:1}}>{l.m}</span>
            </div>
          ))}
        </Card>

        <div style={{
          padding:'10px 14px', background:M.violetSoft, borderRadius:10,
          fontSize:12, color:M.violet, lineHeight:1.6,
          display:'flex', gap:8, alignItems:'flex-start',
        }}>
          <Ico d={ICONS.shield} w={14} fill={M.violet} sw={0}/>
          <span>回测在你设备本地运行,数据与策略均不上传。完成后可继续追问 AI 调整参数。</span>
        </div>
      </div>

      {/* sticky cancel */}
      <div style={{
        position:'absolute', left:0, right:0, bottom:0, zIndex:30,
        padding:'12px 16px 36px',
        background:`linear-gradient(180deg, transparent, ${M.bg} 30%)`,
      }}>
        <button data-back="confirm" style={{
          width:'100%', height:50, borderRadius:14,
          border:`1px solid ${M.border}`, background:M.elev,
          color:M.text, fontSize:14, fontWeight:500, cursor:'pointer',
        }}>取消回测</button>
      </div>
    </div>
  );
}

/* circular progress ring for the running state ------------------------- */
function BtRing({ pct }) {
  const size = 168, sw = 12, r = (size - sw)/2, C = 2*Math.PI*r;
  const off = C * (1 - pct/100);
  return (
    <div style={{
      position:'relative', width:size, height:size, margin:'0 auto',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={M.soft} strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="url(#btGrad)" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={off}
          style={{transition:'stroke-dashoffset 240ms linear'}}/>
        <defs>
          <linearGradient id="btGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="var(--accent-2,#A78BFA)"/>
            <stop offset="100%" stopColor="var(--accent,#7C3AED)"/>
          </linearGradient>
        </defs>
      </svg>
      <div style={{
        position:'absolute', inset:0, display:'flex',
        flexDirection:'column', alignItems:'center', justifyContent:'center',
      }}>
        <div style={{fontFamily:M.mono, fontSize:36, fontWeight:700, color:M.text, lineHeight:1}}>
          {Math.round(pct)}<span style={{fontSize:18, color:M.mid}}>%</span>
        </div>
        <div style={{fontSize:11, color:M.dim, marginTop:6, letterSpacing:0.4}}>
          预计剩余 {Math.max(1, Math.round((100-pct)*0.4))}s
        </div>
      </div>
    </div>
  );
}

function BtPeriod({ pct }) {
  // walk a synthetic month label from 2021-01 → 2026-05
  const months = ['2021-01','2021-08','2022-03','2022-10','2023-05','2023-12','2024-07','2025-02','2025-09','2026-05'];
  const idx = Math.min(months.length-1, Math.floor(pct/100 * months.length));
  return <span>正在回放 · {months[idx]}</span>;
}

function BtCounter({ label, value, sub, tone }) {
  return (
    <div style={{
      padding:'12px 14px', background:M.elev, border:`1px solid ${M.border}`,
      borderRadius:12,
    }}>
      <div style={{fontSize:11, color:M.dim, marginBottom:6}}>{label}</div>
      <div style={{
        fontFamily:M.mono, fontSize:18, fontWeight:700,
        color: tone || M.text, whiteSpace:'nowrap',
      }}>{value}</div>
      {sub && <div style={{fontSize:11, color:M.dim, marginTop:2, fontFamily:M.mono}}>{sub}</div>}
    </div>
  );
}

function BtLiveCurve({ pct, width, height }) {
  // grow the equity line as pct grows — only render up to pct of the seed
  const seed = [100,99,103,107,104,108,113,109,115,118,116,121,119,125,130,127,133,131,128,134,138,135,141,139,135,140,144,142,138,131,135,140,146,142,148,152];
  const n = Math.max(2, Math.round(seed.length * pct/100));
  const cut = seed.slice(0, n);
  const min = Math.min(...seed), max = Math.max(...seed);
  const span = max - min;
  const pts = cut.map((v,i)=> {
    const x = (i/(seed.length-1)) * (width-12) + 6;
    const y = (1 - (v-min)/span) * (height-20) + 10;
    return `${x},${y}`;
  });
  const last = pts[pts.length-1].split(',').map(Number);
  return (
    <svg width={width} height={height} style={{display:'block'}}>
      <defs>
        <linearGradient id="btLive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent,#7C3AED)" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="var(--accent,#7C3AED)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* baseline */}
      {[0.25,0.5,0.75].map(f => (
        <line key={f} x1="6" x2={width-6}
          y1={height*f} y2={height*f}
          stroke={M.borderSoft} strokeDasharray="2 4"/>
      ))}
      <polyline fill="none" stroke="var(--accent,#7C3AED)" strokeWidth="1.8"
        points={pts.join(' ')}/>
      <polygon fill="url(#btLive)"
        points={`${pts.join(' ')} ${last[0]},${height-6} 6,${height-6}`}/>
      {/* leading dot */}
      <circle cx={last[0]} cy={last[1]} r="4"
        fill="var(--accent,#7C3AED)" stroke="#fff" strokeWidth="2"/>
      <circle cx={last[0]} cy={last[1]} r="9"
        fill="var(--accent,#7C3AED)" opacity="0.18">
        <animate attributeName="r" from="4" to="14" dur="1.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.4" to="0" dur="1.4s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}

/* === STATE 2 ============================================================
   回测结果 — 详情页
   ====================================================================== */
function ScreenBacktestResult() {
  const [tab, setTab] = React.useState('overview');

  return (
    <div style={{height:'100%', display:'flex', flexDirection:'column', background:M.bg}}>
      <MStatus/>
      <BtTopBar
        title="回测结果"
        sub="BTC 趋势 · 双均线 · 15m"
        right={
          <button style={{
            width:36, height:36, borderRadius:18, background:M.elev,
            border:`1px solid ${M.border}`, color:M.mid, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Ico d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v14" w={16}/>
          </button>
        }
      />
      {/* still on step 4 — viewing 回测 result; advances to step 5 only when user taps 部署 */}
      <BtcStepBar active={3} done={[0,1,2]}/>

      <div style={{flex:1, overflowY:'auto', padding:'12px 16px 100px'}}>
        {/* hero result */}
        <Card p="18px 16px" style={{marginBottom:14}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
            <Chip tone="ok" style={{whiteSpace:'nowrap'}}>
              <span style={{width:6, height:6, borderRadius:3, background:M.ok, display:'inline-block'}}/>
              回测完成
            </Chip>
            <span style={{fontSize:11, color:M.dim, fontFamily:M.mono}}>2021-01 → 2026-05</span>
            <div style={{flex:1}}/>
            <Chip tone="violet" style={{whiteSpace:'nowrap'}}>可部署</Chip>
          </div>
          <div style={{fontSize:11, color:M.dim, marginBottom:2}}>累计净值</div>
          <div style={{
            display:'flex', alignItems:'baseline', gap:8, marginBottom:14,
          }}>
            <span style={{
              fontFamily:M.mono, fontSize:34, fontWeight:700, color:M.up, letterSpacing:-0.5,
            }}>+312.4%</span>
            <span style={{fontSize:12, color:M.mid, fontFamily:M.mono}}>· CAGR +31.6%</span>
          </div>
          {/* equity curve with drawdown */}
          <BtEquityCurve width={326} height={150}/>
          <div style={{
            display:'flex', justifyContent:'space-between',
            fontSize:10, color:M.dim, fontFamily:M.mono,
            marginTop:6,
          }}>
            <span>2021-01</span>
            <span>2022-09</span>
            <span>2024-05</span>
            <span>2026-05</span>
          </div>
        </Card>

        {/* key stats grid */}
        <BtSectTitle>关键指标</BtSectTitle>
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, marginBottom:14,
          background:M.borderSoft, border:`1px solid ${M.border}`, borderRadius:12,
          overflow:'hidden',
        }}>
          {[
            { k:'CAGR',      v:'+31.6%',  tone:M.up,     sub:'年化复合收益' },
            { k:'Sharpe',    v:'1.78',    tone:M.text,   sub:'风险调整后收益' },
            { k:'最大回撤',   v:'-12.4%',  tone:M.danger, sub:'峰谷最大跌幅' },
            { k:'Calmar',    v:'2.55',    tone:M.text,   sub:'CAGR / |MDD|' },
            { k:'胜率',      v:'55.4%',   tone:M.text,   sub:'盈利交易占比' },
            { k:'盈亏比',     v:'2.04',    tone:M.text,   sub:'平均盈/平均亏' },
            { k:'总交易',    v:'184 笔',  tone:M.text,   sub:'5 年内开仓次数' },
            { k:'平均持仓',   v:'14h 23m', tone:M.text,   sub:'单笔交易时长' },
          ].map(s => (
            <BtStat key={s.k} {...s}/>
          ))}
        </div>

        {/* tabs */}
        <div style={{
          display:'flex', gap:4, padding:3, marginBottom:14,
          background:M.soft, borderRadius:10, border:`1px solid ${M.borderSoft}`,
        }}>
          {[
            ['overview', '月度回报'],
            ['trades',   '交易记录'],
            ['risk',     '风险分析'],
          ].map(([k,l]) => {
            const on = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)} style={{
                flex:1, height:32, borderRadius:7, border:0, cursor:'pointer',
                background: on ? M.elev : 'transparent',
                color: on ? M.violet : M.mid,
                fontSize:12, fontWeight: on ? 600 : 500, whiteSpace:'nowrap',
                boxShadow: on ? '0 1px 3px rgba(15,22,35,0.06)' : 'none',
              }}>{l}</button>
            );
          })}
        </div>

        {tab === 'overview' && <BtMonthlyHeatmap/>}
        {tab === 'trades'   && <BtTradeList/>}
        {tab === 'risk'     && <BtRiskAnalysis/>}

        <div style={{
          marginTop:14, padding:'10px 14px', background:M.violetSoft, borderRadius:10,
          fontSize:12, color:M.violet, lineHeight:1.6,
          display:'flex', gap:8, alignItems:'flex-start',
        }}>
          <Ico d={ICONS.bot} w={14} fill={M.violet} sw={0}/>
          <span>
            <strong style={{fontWeight:600}}>AI 评估:</strong> 该策略最大回撤 12.4% 优于阈值 (20%),可一键部署。建议在牛市加速期降低杠杆。
          </span>
        </div>
      </div>

      {/* sticky deploy */}
      <div style={{
        position:'absolute', left:0, right:0, bottom:0, zIndex:30,
        padding:'12px 16px 36px',
        background:`linear-gradient(180deg, transparent, ${M.bg} 30%)`,
        display:'flex', gap:10,
      }}>
        <button data-back="btconfig" style={{
          flex:1, height:50, borderRadius:14,
          border:`1px solid ${M.border}`, background:M.elev,
          color:M.text, fontSize:14, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap',
        }}>上一步</button>
        <button data-go-deploy style={{
          flex:2, height:50, borderRadius:14, border:0,
          background:M.violetGrad, color:'#fff',
          fontSize:14, fontWeight:600, whiteSpace:'nowrap',
          boxShadow:'0 8px 24px rgba(124,92,255,0.32)', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>
          <Ico d={ICONS.play} w={14} fill="#fff" sw={0}/>
          一键部署到交易所
        </button>
      </div>
    </div>
  );
}

function BtStat({ k, v, sub, tone }) {
  return (
    <div style={{padding:'12px 14px', background:M.elev}}>
      <div style={{fontSize:11, color:M.dim, marginBottom:4}}>{k}</div>
      <div style={{
        fontFamily:M.mono, fontSize:17, fontWeight:700,
        color: tone || M.text, whiteSpace:'nowrap',
      }}>{v}</div>
      <div style={{fontSize:10, color:M.dim, marginTop:2}}>{sub}</div>
    </div>
  );
}

/* equity curve with drawdown shading underneath ------------------------ */
function BtEquityCurve({ width, height }) {
  // synthetic 5y equity curve
  const seed = [
    100,99,103,107,104,108,113,109,115,118,116,121,119,125,130,127,133,131,128,134,
    138,135,141,139,135,140,144,142,138,148,158,166,162,170,168,178,184,180,194,210,
    220,212,228,240,236,254,268,260,282,300,294,312,326,320,346,360,354,376,392,388,412,
  ];
  const N = seed.length;
  const min = 95, max = Math.max(...seed) + 6;
  const span = max - min;
  const x = i => (i/(N-1)) * (width-12) + 6;
  const y = v => (1 - (v-min)/span) * (height-18) + 8;
  const pts = seed.map((v,i)=> `${x(i)},${y(v)}`).join(' ');

  // running peak → drawdown points
  let peak = seed[0];
  const ddPts = seed.map((v,i)=> {
    peak = Math.max(peak, v);
    const dd = v / peak; // 0..1, where 1 = at peak
    return [x(i), y(peak * dd)]; // visualization aid
  });

  return (
    <svg width={width} height={height} style={{display:'block'}}>
      <defs>
        <linearGradient id="btEq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--mk-up,#16C783)" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="var(--mk-up,#16C783)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0.25,0.5,0.75].map(f => (
        <line key={f} x1="6" x2={width-6}
          y1={height*f} y2={height*f}
          stroke={M.borderSoft} strokeDasharray="2 4"/>
      ))}
      <polyline fill="none" stroke="var(--mk-up,#16C783)" strokeWidth="1.8" points={pts}/>
      <polygon fill="url(#btEq)"
        points={`${pts} ${x(N-1)},${height-6} 6,${height-6}`}/>
      {/* drawdown markers — small red ticks at the dip indexes */}
      {[18,28,44].map(i => (
        <g key={i}>
          <circle cx={x(i)} cy={y(seed[i])} r="3" fill="var(--mk-dn,#EA3943)"
            stroke="#fff" strokeWidth="1.5"/>
        </g>
      ))}
    </svg>
  );
}

/* monthly returns heatmap ---------------------------------------------- */
function BtMonthlyHeatmap() {
  // years × 12 months. positive green, negative red. seeded.
  const years = [2021,2022,2023,2024,2025,2026];
  // generate stable pseudo-random values
  const rng = (y, m) => {
    const s = Math.sin(y*31 + m*7) * 1000;
    return Math.round((s - Math.floor(s)) * 24 - 8); // ~[-8, +16]
  };
  const cellColor = (v) => {
    if (v === null) return M.soft;
    if (v > 0) {
      const a = Math.min(1, v/16) * 0.75 + 0.12;
      return `color-mix(in oklab, var(--mk-up,#16C783) ${Math.round(a*100)}%, transparent)`;
    } else {
      const a = Math.min(1, Math.abs(v)/12) * 0.75 + 0.12;
      return `color-mix(in oklab, var(--mk-dn,#EA3943) ${Math.round(a*100)}%, transparent)`;
    }
  };
  return (
    <Card p="14px 14px 12px">
      <div style={{
        display:'grid',
        gridTemplateColumns:'30px repeat(12, 1fr)',
        gap:3, fontFamily:M.mono, fontSize:9, color:M.dim,
        marginBottom:4,
      }}>
        <div/>
        {['1','2','3','4','5','6','7','8','9','10','11','12'].map(m => (
          <div key={m} style={{textAlign:'center'}}>{m}</div>
        ))}
        {years.map(y => (
          <React.Fragment key={y}>
            <div style={{
              display:'flex', alignItems:'center', color:M.mid, fontSize:10,
            }}>{y}</div>
            {[0,1,2,3,4,5,6,7,8,9,10,11].map(m => {
              // cap 2026 to may
              const v = (y === 2026 && m > 4) ? null : rng(y,m);
              return (
                <div key={m} style={{
                  height:22, borderRadius:4,
                  background: cellColor(v),
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:9, fontWeight:600,
                  color: v === null ? M.faint : (v > 0 ? M.up : M.dn),
                }}>
                  {v === null ? '' : (v > 0 ? `+${v}` : v)}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginTop:10, fontSize:10, color:M.dim,
      }}>
        <span>月度 % 收益</span>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <span style={{color:M.dn}}>-15%</span>
          <div style={{
            width:80, height:8, borderRadius:4,
            background:'linear-gradient(90deg, var(--mk-dn,#EA3943), color-mix(in oklab, var(--mk-dn,#EA3943) 20%, transparent), color-mix(in oklab, var(--mk-up,#16C783) 20%, transparent), var(--mk-up,#16C783))',
          }}/>
          <span style={{color:M.up}}>+20%</span>
        </div>
      </div>
    </Card>
  );
}

/* trade list ------------------------------------------------------------ */
function BtTradeList() {
  const trades = [
    { t:'2026-05-12 14:30', side:'多', entry:67420.50, exit:69108.00, pct:+2.50, dur:'4h 12m', win:true },
    { t:'2026-05-10 09:15', side:'多', entry:65800.00, exit:64484.00, pct:-2.00, dur:'1h 48m', win:false },
    { t:'2026-05-08 22:00', side:'多', entry:64200.00, exit:66854.40, pct:+4.13, dur:'18h 30m', win:true },
    { t:'2026-05-06 11:45', side:'多', entry:63500.00, exit:62865.00, pct:-1.00, dur:'45m',     win:false },
    { t:'2026-05-03 19:20', side:'多', entry:61200.00, exit:63916.80, pct:+4.44, dur:'2d 4h',   win:true },
  ];
  return (
    <Card p="0" style={{overflow:'hidden'}}>
      {trades.map((t,i) => (
        <div key={i} style={{
          padding:'12px 14px', display:'flex', alignItems:'center', gap:10,
          borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
        }}>
          <span style={{
            width:24, height:24, borderRadius:6, flexShrink:0,
            background: t.win ? M.upSoft : M.dnSoft,
            color: t.win ? M.up : M.dn,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:10, fontWeight:700,
          }}>{t.side}</span>
          <div style={{flex:1, minWidth:0}}>
            <div style={{
              fontFamily:M.mono, fontSize:12, color:M.text,
              display:'flex', gap:6, whiteSpace:'nowrap',
            }}>
              <span>{t.entry.toLocaleString()}</span>
              <span style={{color:M.dim}}>→</span>
              <span>{t.exit.toLocaleString()}</span>
            </div>
            <div style={{fontSize:10, color:M.dim, marginTop:2, fontFamily:M.mono}}>
              {t.t} · 持仓 {t.dur}
            </div>
          </div>
          <div style={{
            fontFamily:M.mono, fontSize:14, fontWeight:700,
            color: t.win ? M.up : M.dn, whiteSpace:'nowrap',
          }}>
            {t.pct > 0 ? '+' : ''}{t.pct.toFixed(2)}%
          </div>
        </div>
      ))}
    </Card>
  );
}

/* risk analysis -------------------------------------------------------- */
function BtRiskAnalysis() {
  const rows = [
    { k:'最大回撤',    v:'-12.4%',  bar:0.62, tone:M.danger, note:'2022-06 ~ 2022-09 · 持续 92 天' },
    { k:'回撤恢复',    v:'34 天',   bar:0.40, tone:M.warn,   note:'平均回撤恢复时长' },
    { k:'波动率 (年化)', v:'17.8%',  bar:0.45, tone:M.mid,    note:'低于 BTC 自身波动 (28.3%)' },
    { k:'下行偏度',    v:'-0.31',   bar:0.30, tone:M.mid,    note:'分布略偏负,需关注尾部风险' },
    { k:'连续亏损',    v:'5 笔',    bar:0.50, tone:M.warn,   note:'历史最长连亏次数' },
  ];
  return (
    <Card p="14px">
      {rows.map((r,i) => (
        <div key={r.k} style={{
          marginTop: i > 0 ? 14 : 0,
        }}>
          <div style={{
            display:'flex', alignItems:'baseline', justifyContent:'space-between',
            marginBottom:4,
          }}>
            <span style={{fontSize:12, color:M.text, fontWeight:500}}>{r.k}</span>
            <span style={{
              fontFamily:M.mono, fontSize:13, fontWeight:700, color: r.tone,
              whiteSpace:'nowrap',
            }}>{r.v}</span>
          </div>
          <div style={{
            height:4, borderRadius:2, background:M.soft, overflow:'hidden',
          }}>
            <div style={{
              height:'100%', width:`${r.bar*100}%`, background:r.tone, borderRadius:2,
            }}/>
          </div>
          <div style={{fontSize:11, color:M.dim, marginTop:5}}>{r.note}</div>
        </div>
      ))}
    </Card>
  );
}

Object.assign(window, { ScreenBacktestRun, ScreenBacktestResult });

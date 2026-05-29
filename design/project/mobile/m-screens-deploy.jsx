/* ========================================================================
   SCREEN — 一键部署到交易所 (Deploy)
   多步向导:
     1) 选择交易所  → DpSelect
     2) 资金配置    → DpAllocate
     3) 部署中      → DpDeploying
     4) 部署成功    → DpSuccess

   For the canvas, render with `initialStage="select|allocate|deploying|success"`
   to capture each step in its own artboard.
   ======================================================================== */

const DP_EXCHANGES = [
  { k:'binance',     name:'Binance',     glyph:'B', bg:'#181A20', fg:'#F3BA2F',
    authorized:true,  liq:'$78,420.50', perms:'读取 + 现货下单 + 永续', tag:'推荐' },
  { k:'okx',         name:'OKX',         glyph:'O', bg:'#000',    fg:'#fff',
    authorized:true,  liq:'$12,084.20', perms:'读取 + 现货 + 永续', tag:null },
  { k:'bybit',       name:'Bybit',       glyph:'B', bg:'#F7A600', fg:'#1A1A1A',
    authorized:false, liq:null,         perms:'未授权',           tag:null },
  { k:'hyperliquid', name:'Hyperliquid', glyph:'H', bg:'#0B3D33', fg:'#7CFFCB',
    authorized:false, liq:null,         perms:'未授权',           tag:'链上' },
];

/* The unified 5-step BtcStepBar is defined in m-screens-btconfig.jsx (loaded
   first, exposed on window). Deploy uses it at active=4 done=[0,1,2,3] so the
   global progress stays visible across the whole 5-step flow. The internal
   deploy sub-stage (confirm / deploying / success) is conveyed by page content
   — no separate sub-stepper needed. */
const BtcStepBar = window.BtcStepBar;

function ScreenDeploy({ initialStage = 'confirm' } = {}) {
  const [stage, setStage]   = React.useState(
    /* migrate the old 'select'/'allocate' canvas keys to the new 'confirm' */
    initialStage === 'select' || initialStage === 'allocate' ? 'confirm' : initialStage
  );
  const [exKey, setExKey]   = React.useState('binance');
  const [amount, setAmount] = React.useState('10000');
  const [perTrade, setPerTrade] = React.useState(30);
  const [maxDailyLoss, setMaxDailyLoss] = React.useState(5);
  const [notify, setNotify] = React.useState({ open:true, close:true, sl:true });
  const ex = DP_EXCHANGES.find(e => e.k === exKey) || DP_EXCHANGES[0];

  return (
    <div style={{height:'100%', display:'flex', flexDirection:'column', background:M.bg}}>
      <MStatus/>
      <MTopBar
        title="部署策略"
        sub="BTC 趋势 · 双均线 · 15m"
        onBack={stage === 'confirm'}
        backTo="btres"
        right={stage !== 'deploying' && stage !== 'success' && (
          <button data-back="btres" style={{
            height:30, padding:'0 12px', borderRadius:8,
            border:`1px solid ${M.border}`, background:M.elev,
            color:M.mid, fontSize:12, fontWeight:500, cursor:'pointer',
          }}>取消</button>
        )}
      />

      {/* unified 5-step indicator — same shape used on confirm / script /
          btconfig / btrun / btres. Deploy is always step 5 (active=4). */}
      <BtcStepBar active={4} done={[0,1,2,3]}/>

      {stage === 'confirm'   && <DpConfirm ex={ex}
        amount={amount} perTrade={perTrade} maxDailyLoss={maxDailyLoss}
        onDeploy={()=>setStage('deploying')}/>}
      {stage === 'deploying' && <DpDeploying ex={ex} onDone={()=>setStage('success')}/>}
      {stage === 'success'   && <DpSuccess ex={ex} amount={amount}/>}
    </div>
  );
}

/* exchange glyph ------------------------------------------------------- */
const DP_LOGOS = {
  binance: (
    <svg viewBox="0 0 32 32" width="72%" height="72%">
      <g fill="#F3BA2F">
        <polygon points="16,6 26,16 16,26 6,16"/>
        <polygon points="16,2 18.5,4.5 16,7 13.5,4.5"/>
        <polygon points="16,25 18.5,27.5 16,30 13.5,27.5"/>
        <polygon points="2,16 4.5,13.5 7,16 4.5,18.5"/>
        <polygon points="25,16 27.5,13.5 30,16 27.5,18.5"/>
      </g>
    </svg>
  ),
  okx: (
    <svg viewBox="0 0 32 32" width="66%" height="66%">
      <g fill="#fff">
        <rect x="3"  y="3"  width="8" height="8"/>
        <rect x="12" y="12" width="8" height="8"/>
        <rect x="3"  y="21" width="8" height="8"/>
        <rect x="21" y="3"  width="8" height="8"/>
        <rect x="21" y="21" width="8" height="8"/>
      </g>
    </svg>
  ),
  bybit: (
    <svg viewBox="0 0 32 32" width="60%" height="60%">
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
  hyperliquid: (
    <svg viewBox="0 0 32 32" width="62%" height="62%">
      <g fill="#7CFFCB">
        <rect x="5"  y="5" width="5" height="22" rx="1"/>
        <rect x="22" y="5" width="5" height="22" rx="1"/>
        <rect x="5"  y="13.5" width="22" height="5"/>
      </g>
    </svg>
  ),
};

function DpGlyph({ ex, size = 40 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:size/4.5, background:ex.bg,
      color: ex.fg, flexShrink:0, overflow:'hidden',
      display:'flex', alignItems:'center', justifyContent:'center',
      boxShadow: ex.k === 'binance' ? '0 4px 14px rgba(240,185,11,0.28)' : 'none',
    }}>{DP_LOGOS[ex.k] || (
      <span style={{
        color: ex.fg, fontWeight:800, fontSize:size*0.5,
      }}>{ex.glyph}</span>
    )}</div>
  );
}

/* === STAGE 0 (merged): 部署前账单确认 ===================================
   The exchange + capital allocation were already decided in the AI dialogue,
   so this page is a read-only "receipt" the user confirms before deploy. */

const DP_FORM_EXCHANGES = ['OKX','Binance','Bybit','Hyperliquid'];
const DP_FORM_MARKETS   = ['永续','现货','期权'];
const DP_FORM_ACCOUNTS  = {
  OKX:         ['okx-test-api','okx-main-api'],
  Binance:     ['binance-prod','binance-paper'],
  Bybit:       ['bybit-test'],
  Hyperliquid: ['hl-arb'],
};
const DP_FORM_LEVERAGE  = ['1x','2x','3x','5x'];

function DpFormReadonly({ label, value }) {
  const isMonoVal = /api|^[a-z0-9-]+$/i.test(value);
  return (
    <div style={{flex:1, minWidth:0}}>
      <div style={{
        fontSize:11, color:M.mid, marginBottom:6, fontWeight:500,
        display:'inline-flex', alignItems:'center', gap:4,
      }}>
        <span>{label}</span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.55}}>
          <rect x="5" y="10" width="14" height="11" rx="2"/>
          <path d="M8 10V7a4 4 0 0 1 8 0v3"/>
        </svg>
      </div>
      <div style={{
        width:'100%', height:38, padding:'0 10px', borderRadius:8,
        border:`1px dashed ${M.borderSoft}`, background:M.soft,
        color:M.text, fontSize:13, fontWeight:500,
        display:'inline-flex', alignItems:'center',
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        fontFamily: isMonoVal ? M.mono : 'inherit',
        boxSizing:'border-box',
      }}>{value}</div>
    </div>
  );
}

function DpFormField({ label, value, options, onChange }) {
  const [open, setOpen] = React.useState(false);
  const isMonoVal = /api|^[a-z0-9-]+$/i.test(value);
  return (
    <div style={{position:'relative', flex:1, minWidth:0}}>
      <div style={{fontSize:11, color:M.mid, marginBottom:6, fontWeight:500}}>{label}</div>
      <button onClick={()=>setOpen(v=>!v)} style={{
        width:'100%', height:38, padding:'0 10px', borderRadius:8,
        border:`1px solid ${open ? M.violet : M.border}`,
        background: open ? M.violetSoft : M.elev,
        color:M.text, fontSize:13, fontWeight:500,
        display:'inline-flex', alignItems:'center', gap:6,
        cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit',
        textAlign:'left', boxSizing:'border-box',
      }}>
        <span style={{
          flex:1, minWidth:0,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          fontFamily: isMonoVal ? M.mono : 'inherit',
        }}>{value}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition:'transform 160ms', color:M.mid, flexShrink:0,
          }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <React.Fragment>
          <div onClick={()=>setOpen(false)} style={{position:'fixed', inset:0, zIndex:40}}/>
          <div style={{
            position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:41,
            background:M.elev, border:`1px solid ${M.border}`, borderRadius:10,
            boxShadow:'0 14px 32px -10px rgba(15,22,35,0.22)',
            padding:4, display:'flex', flexDirection:'column',
            maxHeight:220, overflowY:'auto',
          }}>
            {/* placeholder header — non-clickable hint */}
            <div style={{
              padding:'8px 12px 6px', fontSize:11.5, color:M.dim,
              fontFamily:'inherit',
            }}>{label}...</div>
            {options.map(o => {
              const on = o === value;
              const oMono = /api|^[a-z0-9-]+$/i.test(o);
              return (
                <button key={o}
                  onClick={()=>{ onChange(o); setOpen(false); }}
                  style={{
                    padding:'9px 10px', border:0, cursor:'pointer',
                    background: on ? M.violetSoft : 'transparent',
                    color: M.text,
                    borderRadius:7, textAlign:'left',
                    fontFamily: oMono ? M.mono : 'inherit',
                    display:'flex', alignItems:'center', gap:8,
                    fontSize:12.5, fontWeight: on ? 600 : 500,
                  }}>
                  <span style={{
                    width:14, flexShrink:0,
                    display:'inline-flex', alignItems:'center', justifyContent:'center',
                    color: on ? M.violet : 'transparent',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7"/>
                    </svg>
                  </span>
                  <span style={{flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{o}</span>
                </button>
              );
            })}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function DpConfirm({ ex, amount, perTrade, maxDailyLoss, onDeploy }) {
  const [fmExchange,   setFmExchange]   = React.useState('OKX');
  const [fmMarketType, setFmMarketType] = React.useState('永续');
  const fmAccounts = DP_FORM_ACCOUNTS[fmExchange] || [];
  const [fmAccount,    setFmAccount]    = React.useState(fmAccounts[0] || 'okx-test-api');
  const [fmLeverage,   setFmLeverage]   = React.useState('1x');
  // demo state: pass / fail
  const [demoFail, setDemoFail] = React.useState(false);
  // re-check (refresh): re-fetch balance + exchange latency after user fixes
  const [rechecking, setRechecking] = React.useState(false);
  const recheckTimer = React.useRef(null);
  React.useEffect(() => () => clearTimeout(recheckTimer.current), []);
  const handleRecheck = React.useCallback(() => {
    if (rechecking) return;
    setRechecking(true);
    recheckTimer.current = setTimeout(() => {
      setRechecking(false);
      setDemoFail(false); // balance topped up + network restored → all checks pass
    }, 1400);
  }, [rechecking]);
  React.useEffect(() => {
    const list = DP_FORM_ACCOUNTS[fmExchange] || [];
    if (list.length && !list.includes(fmAccount)) setFmAccount(list[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmExchange]);
  return (
    <React.Fragment>
      <div style={{flex:1, overflowY:'auto', padding:'10px 16px 130px'}}>
        {/* strategy + risk check */}
        <Card p="14px 16px" style={{marginBottom:12}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{
              width:36, height:36, borderRadius:10, background:M.violetSoft,
              color:M.violet, display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
            }}>
              <Ico d={ICONS.spark} w={18} sw={1.8}/>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:14, fontWeight:700, color:M.text, letterSpacing:-0.2}}>
                BTC 趋势 · 双均线
              </div>
              <div style={{fontSize:11, color:M.dim, marginTop:2, fontFamily:M.mono}}>
                BTC/USDT · 15m · 永续 · 5x
              </div>
            </div>
            <Chip tone="violet" style={{whiteSpace:'nowrap'}}>趋势跟踪</Chip>
          </div>
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8,
            marginTop:12, padding:'10px 0 0', borderTop:`1px dashed ${M.borderSoft}`,
          }}>
            <CfStat label="累计净值"   value="+312.4%" tone={M.up}/>
            <CfStat label="Sharpe"   value="1.78"/>
            <CfStat label="最大回撤"   value="-12.4%"  tone={M.dn}/>
          </div>
        </Card>

        {/* preflight checks — make sure the strategy can actually run */}
        <PreflightChecks ex={ex} amount={amount} failMode={demoFail}
          rechecking={rechecking} onRecheck={handleRecheck}/>

        {/* deploy form — exchange / market / leverage locked from previous step;
            only 选择账户 is editable here */}
        <div style={{
          padding:'14px', borderRadius:14, marginBottom:14,
          background:M.elev, border:`1px solid ${M.borderSoft}`,
        }}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14}}>
            <DpFormReadonly label="交易所"   value={fmExchange}/>
            <DpFormReadonly label="市场类型" value={fmMarketType}/>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
            <DpFormField     label="选择账户" value={fmAccount} options={fmAccounts} onChange={setFmAccount}/>
            <DpFormReadonly label="部署杠杆" value={fmLeverage}/>
          </div>
        </div>

        {/* tiny footnote */}
        <div style={{fontSize:11, color:M.dim, lineHeight:1.6, padding:'0 4px'}}>
          以上信息均由 AI 对话过程中已决定。如需调整,请返回对话或回测设置重新生成。
        </div>
      </div>

      {/* sticky action bar */}
      <div style={{
        position:'absolute', left:0, right:0, bottom:0, zIndex:30,
        padding:'12px 16px 36px',
        background: `linear-gradient(180deg, transparent, ${M.bg} 30%)`,
        display:'flex', gap:10,
      }}>
        {/* demo toggle (top-right of the bar) — design preview only */}
        <button
          onClick={()=>setDemoFail(v=>!v)}
          style={{
            position:'absolute', top:-30, right:16,
            height:24, padding:'0 8px', borderRadius:6,
            border:`1px dashed ${M.borderSoft}`, background:M.elev,
            color:M.dim, fontSize:10, fontWeight:500, cursor:'pointer',
            fontFamily:'inherit', whiteSpace:'nowrap',
          }}>{demoFail ? '演示态:失败 ↺' : '演示态:通过 ↺'}</button>

        <button data-back="btres" style={{
          flex:1, height:50, borderRadius:14,
          border:`1px solid ${M.border}`, background:M.elev,
          color:M.text, fontSize:14, fontWeight:500, cursor:'pointer',
        }}>返回</button>
        <button
          onClick={demoFail ? undefined : onDeploy}
          disabled={demoFail}
          style={{
            flex:2, height:50, borderRadius:14, border:0,
            background: demoFail ? M.soft : M.violetGrad,
            color: demoFail ? M.dim : '#fff',
            fontSize:14.5, fontWeight:600, whiteSpace:'nowrap',
            boxShadow: demoFail ? 'none' : '0 8px 24px rgba(124,92,255,0.32)',
            cursor: demoFail ? 'not-allowed' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            fontFamily:'inherit',
          }}>
          {demoFail ? (
            <React.Fragment>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6L6 18"/>
              </svg>
              检查未通过 · 无法部署
            </React.Fragment>
          ) : (
            <React.Fragment>
              <Ico d={ICONS.shield} w={15} sw={1.8} stroke="#fff"/>
              确认无误,立即部署
            </React.Fragment>
          )}
        </button>
      </div>
    </React.Fragment>
  );
}

function PreflightChecks({ ex, amount, failMode, rechecking, onRecheck }) {
  /* All checks pass in the prototype. Each row shows: status icon + label
     + small value/sub. A failing check uses M.dn (danger). */
  const need = parseInt(amount) || 0;
  const have = parseFloat((ex.liq || '0').replace(/[$,]/g,'')) || 0;
  const margin = have - need;
  // simulate a failing scenario: balance short + latency degraded
  const lowBal = need * 0.74; // 74% of needed
  const checks = failMode ? [
    {
      ok:false,
      title:`${ex.name} API 未绑定`,
      sub:'尚未授权读取/下单权限。点击下方按钮绑定 API 后重新部署。',
      action:'去绑定 API',
      onAction: () => { try { window.__nav?.sheet?.('api'); } catch(e) {} },
    },
    {
      ok:false,
      live:true,
      title:'账户余额不足',
      sub:`可用 $${Math.round(lowBal).toLocaleString()} · 部署需要 $${need.toLocaleString()} · 缺口 $${Math.round(need - lowBal).toLocaleString()}。请到交易所账户充值后重试。`,
    },
    {
      ok:false,
      live:true,
      title:'网络与交易所时延异常',
      sub:'下单延时 850 ms · 数据流间歇中断，请检查网络。',
    },
  ] : [
    {
      ok:true,
      title:`${ex.name} API 已绑定`,
      sub:'读取 + 现货 + 永续 · 未启用提币 (安全)',
    },
    {
      ok:true,
      title:'账户余额充足',
      sub:`可用 $${have.toLocaleString()} · 部署需要 $${need.toLocaleString()} · 余裕 $${margin.toLocaleString()}`,
    },
    {
      ok:true,
      title:'网络与交易所时延正常',
      sub:'下单延时 < 200 ms · 数据流稳定',
    },
  ];
  const passCount = checks.filter(c => c.ok).length;
  const failCount = checks.length - passCount;
  const allPass = failCount === 0;

  // intro scan animation — reveal each check sequentially on mount
  const [scanned, setScanned] = React.useState(0);
  React.useEffect(() => {
    setScanned(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setScanned(n);
      if (n >= checks.length) clearInterval(id);
    }, 560);
    return () => clearInterval(id);
  // eslint-disable-next-line
  }, [failMode, ex.name, amount]);
  const scanning = scanned < checks.length;
  const chipColor = allPass ? M.ok : M.dn;
  const chipBg    = allPass ? (M.okSoft || 'rgba(16,185,129,0.18)') : (M.dnSoft || 'rgba(229,72,77,0.16)');

  return (
    <div style={{
      background:M.elev,
      border:`1px solid ${allPass ? M.borderSoft : (M.dnSoft || 'rgba(229,72,77,0.30)')}`,
      borderRadius:14,
      overflow:'hidden', marginBottom:14,
    }}>
      <div style={{
        padding:'10px 14px', display:'flex', alignItems:'center', gap:8,
        borderBottom:`1px solid ${M.borderSoft}`,
        background: allPass ? M.soft : (M.dnSoft || 'rgba(229,72,77,0.06)'),
      }}>
        <span style={{
          fontSize:10, fontWeight:700,
          color: allPass ? M.dim : M.dn, letterSpacing:1.2, flex:1,
        }}>部署前检查</span>
        {!allPass && onRecheck && (
          <button
            onClick={rechecking ? undefined : onRecheck}
            disabled={rechecking}
            style={{
              display:'inline-flex', alignItems:'center', gap:5,
              height:24, padding:'0 9px', borderRadius:6, marginRight:8,
              border:`1px solid ${M.dn}`, background:'transparent', color:M.dn,
              fontSize:11, fontWeight:600, fontFamily:'inherit',
              cursor: rechecking ? 'default' : 'pointer', whiteSpace:'nowrap',
              opacity: rechecking ? 0.7 : 1,
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={rechecking ? {animation:'qfSpin 0.8s linear infinite'} : undefined}>
              <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
              <path d="M21 3v6h-6"/>
            </svg>
            {rechecking ? '检测中…' : '重新检测'}
          </button>
        )}
        <span style={{
          display:'inline-flex', alignItems:'center', gap:4,
          fontSize:11, fontWeight:600, fontFamily:M.mono,
          padding:'2px 8px', borderRadius:5,
          background: scanning ? M.soft : chipBg, color: scanning ? M.dim : chipColor,
        }}>
          {scanning ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              style={{animation:'qfSpin 0.8s linear infinite'}}>
              <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
            </svg>
          ) : (
            <span style={{
              width:6, height:6, borderRadius:3,
              background: chipColor,
            }}/>
          )}
          {scanning
            ? `检测中 ${scanned}/${checks.length}`
            : (allPass
              ? `${passCount}/${checks.length} 通过`
              : `${failCount}/${checks.length} 未通过`)}
        </span>
      </div>
      {checks.map((c, i) => {
        const recheckActive = rechecking && c.live && !c.ok;
        const introScan = i >= scanned && !recheckActive;
        const checking = recheckActive || introScan;
        return (
        <div key={i} style={{
          padding:'10px 14px', display:'flex', gap:10, alignItems:'flex-start',
          borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
          background: checking ? M.soft : (c.ok ? 'transparent' : (M.dnSoft ? `${M.dnSoft}` : 'rgba(229,72,77,0.04)')),
          transition:'background .2s',
        }}>
          <div style={{
            flexShrink:0, marginTop:2, width:18, height:18, borderRadius:9,
            background: checking ? 'transparent' : (c.ok ? M.ok : M.dn), color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            {checking ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M.dim}
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                style={{animation:'qfSpin 0.8s linear infinite'}}>
                <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
              </svg>
            ) : c.ok ? (
              <Ico d={ICONS.check} w={11} sw={2.6} stroke="#fff"/>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff"
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6L6 18"/>
              </svg>
            )}
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{
              fontSize:12.5, fontWeight:600, lineHeight:1.4,
              color: checking ? M.mid : (c.ok ? M.text : M.dn),
            }}>{recheckActive ? c.title.replace(/不足|异常/,'') + '· 重新检测中' : c.title}</div>
            <div style={{fontSize:11, color: checking ? M.dim : (c.ok ? M.dim : M.mid), marginTop:2, lineHeight:1.5}}>
              {recheckActive ? '正在重新获取最新余额与交易所时延…' : (introScan ? '检测中…' : c.sub)}
            </div>
          </div>
          {c.action && !checking && (
            <button
              onClick={c.onAction}
              style={{
              padding:'4px 10px', borderRadius:7, border:`1px solid ${M.dn}`,
              background:'transparent', color:M.dn,
              fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              flexShrink:0, whiteSpace:'nowrap', marginTop:2,
            }}>{c.action}</button>
          )}
        </div>
        );
      })}
      <style>{`@keyframes qfSpin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function CfStat({ label, value, tone }) {
  return (
    <div style={{minWidth:0}}>
      <div style={{fontSize:10, color:M.dim, marginBottom:3}}>{label}</div>
      <div style={{fontSize:14, fontWeight:700, color:tone || M.text, fontFamily:M.mono,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{value}</div>
    </div>
  );
}

function CfRow({ label, value, sub, suffix, tone, emphasis, last }) {
  return (
    <div style={{
      padding:'12px 16px',
      borderBottom: last ? 'none' : `1px solid ${M.borderSoft}`,
      display:'flex', alignItems:'center', gap:12,
    }}>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:12.5, color:M.mid, fontWeight:500}}>{label}</div>
        {sub && <div style={{fontSize:10.5, color:M.dim, marginTop:2, lineHeight:1.5}}>{sub}</div>}
      </div>
      <div style={{
        display:'flex', alignItems:'baseline', gap:4, flexShrink:0,
      }}>
        <span style={{
          fontFamily:M.mono, fontWeight:700,
          fontSize: emphasis ? 17 : 13.5,
          color: tone || M.text, whiteSpace:'nowrap',
        }}>{value}</span>
        {suffix && (
          <span style={{fontSize:11, color:M.dim, fontWeight:500, whiteSpace:'nowrap'}}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

/* === STAGE 1: 选择交易所 =============================================== */
function DpSelect({ ex, onPick, onNext }) {
  return (
    <>
      <div style={{flex:1, overflowY:'auto', padding:'12px 16px 100px'}}>
        {/* strategy summary */}
        <Card p="14px 16px" style={{marginBottom:14}}>
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            marginBottom:10, gap:8,
          }}>
            <div style={{fontSize:13, fontWeight:600, color:M.text, whiteSpace:'nowrap'}}>
              即将部署的策略
            </div>
            <Chip tone="violet" style={{whiteSpace:'nowrap'}}>趋势跟踪</Chip>
          </div>
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8,
          }}>
            {[
              ['累计净值', '+312.4%', M.up],
              ['Sharpe',  '1.78',    M.text],
              ['最大回撤', '-12.4%',  M.danger],
            ].map(([k,v,c]) => (
              <div key={k} style={{
                padding:'8px 10px', background:M.soft, borderRadius:8,
              }}>
                <div style={{fontSize:10, color:M.dim, marginBottom:3}}>{k}</div>
                <div style={{
                  fontFamily:M.mono, fontSize:14, fontWeight:700, color:c, whiteSpace:'nowrap',
                }}>{v}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* risk gate */}
        <div style={{
          padding:'10px 12px', marginBottom:14, borderRadius:10,
          background:'rgba(22,199,131,0.10)',
          border:'1px solid rgba(22,199,131,0.20)',
          display:'flex', gap:8, alignItems:'flex-start',
        }}>
          <div style={{
            width:18, height:18, borderRadius:9, background:M.ok, flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            marginTop:1,
          }}>
            <Ico d={ICONS.check} w={12} sw={3}/>
          </div>
          <div style={{fontSize:12, color:M.ok, lineHeight:1.55}}>
            <strong style={{fontWeight:600}}>风控通过</strong>
            <span style={{opacity:0.85}}> · 最大回撤 -12.4% 优于阈值 (≤20%),可部署到实盘</span>
          </div>
        </div>

        <div style={{
          padding:'4px 4px 8px',
          fontSize:12, color:M.mid, fontWeight:600,
        }}>选择交易所</div>

        {/* exchange list */}
        <Card p="0" style={{overflow:'hidden', marginBottom:14}}>
          {DP_EXCHANGES.map((e, i) => {
            const on  = e.k === ex.k;
            return (
              <button key={e.k}
                onClick={() => e.authorized && onPick(e.k)}
                disabled={!e.authorized}
                style={{
                  width:'100%', padding:'14px 14px', border:0,
                  background: on ? M.violetSoft : 'transparent',
                  borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
                  display:'flex', alignItems:'center', gap:12,
                  cursor: e.authorized ? 'pointer' : 'default',
                  textAlign:'left', opacity: e.authorized ? 1 : 0.7,
                  transition:'background 140ms',
                }}>
                <DpGlyph ex={e}/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{
                    display:'flex', alignItems:'center', gap:6, marginBottom:3,
                  }}>
                    <span style={{fontSize:14, fontWeight:600, color:M.text}}>{e.name}</span>
                    {e.tag && (
                      <span style={{
                        padding:'1px 6px', borderRadius:4, fontSize:9, fontWeight:700,
                        background: e.tag === '推荐' ? 'rgba(22,199,131,0.12)' : 'rgba(124,92,255,0.12)',
                        color: e.tag === '推荐' ? M.ok : M.violet, letterSpacing:0.3,
                      }}>{e.tag}</span>
                    )}
                  </div>
                  <div style={{
                    fontSize:11, color: e.authorized ? M.mid : M.warn,
                    display:'flex', alignItems:'center', gap:5,
                  }}>
                    <span style={{
                      width:6, height:6, borderRadius:3,
                      background: e.authorized ? M.ok : M.warn,
                    }}/>
                    {e.authorized
                      ? <>{e.perms} · 可用 <span style={{fontFamily:M.mono, color:M.text}}>{e.liq}</span></>
                      : '未授权 · 需先添加 API'}
                  </div>
                </div>
                <div style={{
                  width:20, height:20, borderRadius:10, flexShrink:0,
                  border: `2px solid ${on ? M.violet : M.border}`,
                  background: on ? M.violet : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  {on && <div style={{width:8, height:8, borderRadius:4, background:'#fff'}}/>}
                </div>
              </button>
            );
          })}
        </Card>

        <div style={{
          padding:'10px 0', fontSize:11, color:M.dim, lineHeight:1.6,
          display:'flex', gap:6, alignItems:'flex-start',
        }}>
          <Ico d={ICONS.shield} w={12} sw={1.6}/>
          <span>API 密钥仅在你设备本地签名,不会上传到 Quantify 服务器。</span>
        </div>
      </div>

      <DpBottomBar>
        <button data-back="btres" style={dpSecondaryBtn}>返回</button>
        <button onClick={onNext} style={dpPrimaryBtn}>
          继续
          <Ico d={ICONS.caretR} w={13} sw={2.4}/>
        </button>
      </DpBottomBar>
    </>
  );
}

/* === STAGE 2: 资金配置 ================================================= */
function DpAllocate({ ex, amount, setAmount, perTrade, setPerTrade,
  maxDailyLoss, setMaxDailyLoss, notify, setNotify, onBack, onDeploy }) {
  return (
    <>
      <div style={{flex:1, overflowY:'auto', padding:'12px 16px 100px'}}>
        {/* selected exchange recap */}
        <Card p="12px 14px" style={{marginBottom:14, display:'flex', alignItems:'center', gap:12}}>
          <DpGlyph ex={ex} size={36}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:14, fontWeight:600, color:M.text}}>{ex.name}</div>
            <div style={{fontSize:11, color:M.dim, marginTop:2}}>
              可用 <span style={{fontFamily:M.mono, color:M.text}}>{ex.liq}</span>
            </div>
          </div>
          <Chip tone="ok" style={{whiteSpace:'nowrap'}}>已授权</Chip>
        </Card>

        {/* amount */}
        <div style={{padding:'4px 4px 8px', fontSize:12, color:M.mid, fontWeight:600}}>
          投入金额
        </div>
        <Card p="14px 16px" style={{marginBottom:6}}>
          <div style={{
            display:'flex', alignItems:'baseline', gap:6, marginBottom:10,
            borderBottom: `1px solid ${M.borderSoft}`, paddingBottom:10,
          }}>
            <span style={{fontSize:14, color:M.dim, fontFamily:M.mono}}>$</span>
            <input
              type="text" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g,''))}
              onClick={(e)=>e.stopPropagation()}
              style={{
                flex:1, border:0, outline:0, background:'transparent',
                fontFamily:M.mono, fontSize:28, fontWeight:700, color:M.text,
                padding:0, minWidth:0,
              }}
            />
            <span style={{fontSize:13, color:M.dim, fontFamily:M.mono}}>USDT</span>
          </div>
          <div style={{display:'flex', gap:6}}>
            {['25%','50%','75%','MAX'].map(p => (
              <button key={p}
                onClick={() => {
                  const m = { '25%':2500, '50%':5000, '75%':7500, 'MAX':10000 }[p];
                  setAmount(String(m));
                }}
                style={{
                  flex:1, height:30, borderRadius:8, border:0, cursor:'pointer',
                  background:M.soft, color:M.mid,
                  fontSize:12, fontWeight:600, fontFamily:M.mono,
                }}>{p}</button>
            ))}
          </div>
        </Card>
        <div style={{fontSize:11, color:M.dim, padding:'0 4px 14px'}}>
          建议:首次部署不超过总资金的 30%
        </div>

        {/* per-trade % */}
        <div style={{padding:'4px 4px 8px', fontSize:12, color:M.mid, fontWeight:600}}>
          单笔仓位上限
        </div>
        <Card p="14px 16px" style={{marginBottom:14}}>
          <div style={{
            display:'flex', alignItems:'baseline', justifyContent:'space-between',
            marginBottom:10,
          }}>
            <div style={{fontSize:12, color:M.dim}}>每笔最多占用</div>
            <div style={{
              fontFamily:M.mono, fontSize:20, fontWeight:700, color:M.violet,
            }}>{perTrade}%</div>
          </div>
          <DpSlider value={perTrade} setValue={setPerTrade} min={10} max={100} step={5}/>
          <div style={{
            display:'flex', justifyContent:'space-between',
            fontSize:10, color:M.dim, fontFamily:M.mono, marginTop:6,
          }}>
            <span>10%</span><span>50%</span><span>100%</span>
          </div>
        </Card>

        {/* max daily loss */}
        <div style={{padding:'4px 4px 8px', fontSize:12, color:M.mid, fontWeight:600,
          display:'flex', alignItems:'center', gap:6,
        }}>
          风控开关 · 日内最大亏损
          <Chip tone="warn" style={{whiteSpace:'nowrap', fontSize:9}}>自动暂停</Chip>
        </div>
        <Card p="14px 16px" style={{marginBottom:14}}>
          <div style={{
            display:'flex', alignItems:'baseline', justifyContent:'space-between',
            marginBottom:10,
          }}>
            <div style={{fontSize:12, color:M.dim}}>当日亏损超过</div>
            <div style={{
              fontFamily:M.mono, fontSize:20, fontWeight:700, color:M.danger,
            }}>-{maxDailyLoss}%</div>
          </div>
          <DpSlider value={maxDailyLoss} setValue={setMaxDailyLoss}
            min={1} max={15} step={1} tone="danger"/>
          <div style={{
            display:'flex', justifyContent:'space-between',
            fontSize:10, color:M.dim, fontFamily:M.mono, marginTop:6,
          }}>
            <span>-1%</span><span>-8%</span><span>-15%</span>
          </div>
        </Card>

        {/* notifications */}
        <div style={{padding:'4px 4px 8px', fontSize:12, color:M.mid, fontWeight:600}}>
          通知
        </div>
        <Card p="0" style={{marginBottom:14, overflow:'hidden'}}>
          {[
            ['open',  '开仓时通知',     '推送 + 应用内消息'],
            ['close', '平仓时通知',     '推送 + 应用内消息'],
            ['sl',    '触发止损时通知',  '推送 + 邮件'],
          ].map(([k, label, sub], i) => {
            const on = notify[k];
            return (
              <div key={k} style={{
                padding:'12px 14px',
                borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
                display:'flex', alignItems:'center', gap:12,
              }}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, color:M.text, fontWeight:500}}>{label}</div>
                  <div style={{fontSize:11, color:M.dim, marginTop:2}}>{sub}</div>
                </div>
                <button onClick={() => setNotify({...notify, [k]: !on})}
                  style={{
                    width:42, height:26, borderRadius:13, border:0, padding:0,
                    background: on ? M.violet : M.border, cursor:'pointer',
                    position:'relative', transition:'background 160ms',
                    flexShrink:0,
                  }}>
                  <div style={{
                    position:'absolute', top:3, left: on ? 19 : 3,
                    width:20, height:20, borderRadius:10, background:'#fff',
                    boxShadow:'0 2px 4px rgba(15,11,34,0.22)',
                    transition:'left 160ms',
                  }}/>
                </button>
              </div>
            );
          })}
        </Card>

        {/* disclaimer */}
        <div style={{
          padding:'10px 12px', borderRadius:10,
          background:M.warnSoft,
          fontSize:11, color:M.warn, lineHeight:1.55,
          display:'flex', gap:8, alignItems:'flex-start',
        }}>
          <Ico d={ICONS.shield} w={13} fill={M.warn} sw={0}/>
          <span>
            部署即开始实盘交易。请确认 API 密钥<strong style={{fontWeight:600}}>已关闭提币权限</strong>;
            可在「我的 → API 管理」随时停止策略。
          </span>
        </div>
      </div>

      <DpBottomBar>
        <button onClick={onBack} style={dpSecondaryBtn}>上一步</button>
        <button onClick={onDeploy} style={dpPrimaryBtn}>
          <Ico d={ICONS.play} w={13} fill="#fff" sw={0}/>
          确认部署
        </button>
      </DpBottomBar>
    </>
  );
}

function DpSlider({ value, setValue, min, max, step, tone }) {
  const ref = React.useRef(null);
  const pct = ((value - min) / (max - min)) * 100;
  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0] : e).clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const raw = min + ratio * (max - min);
    setValue(Math.round(raw/step) * step);
  };
  const onPointerDown = (e) => {
    e.preventDefault(); onMove(e);
    const up = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', up);
  };
  const color = tone === 'danger' ? M.danger : M.violet;
  return (
    <div ref={ref} onPointerDown={onPointerDown}
      style={{
        height:24, position:'relative', cursor:'pointer',
        display:'flex', alignItems:'center',
      }}>
      <div style={{
        width:'100%', height:5, borderRadius:3, background:M.soft,
        position:'relative',
      }}>
        <div style={{
          height:'100%', width:`${pct}%`, background:color, borderRadius:3,
        }}/>
      </div>
      <div style={{
        position:'absolute', left:`calc(${pct}% - 11px)`,
        width:22, height:22, borderRadius:11, background:'#fff',
        boxShadow:`0 0 0 2px ${color}, 0 2px 8px rgba(15,11,34,0.18)`,
      }}/>
    </div>
  );
}

/* === STAGE 3: 部署中 =================================================== */
function DpDeploying({ ex, onDone }) {
  const steps = [
    { k:'auth',   label:'校验 API 权限',   sub:'确认未开启提币 · 已启用现货+合约下单' },
    { k:'push',   label:'推送策略到云端',  sub:'加密上传策略参数与风控规则' },
    { k:'node',   label:'启动执行节点',    sub:'分配独立节点 · 同步交易所时间' },
    { k:'feed',   label:'订阅实时行情',    sub:'BTC/USDT 15m · WebSocket 已连接' },
    { k:'ready',  label:'就绪',           sub:'等待首个信号触发' },
  ];
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    if (idx >= steps.length) { onDone && onDone(); return; }
    const t = setTimeout(() => setIdx(i => i + 1), 720);
    return () => clearTimeout(t);
  }, [idx]);

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column',
      padding:'24px 20px 100px', overflow:'hidden',
    }}>
      {/* exchange + spinning ring */}
      <div style={{
        margin:'12px auto 18px', position:'relative',
        width:96, height:96,
      }}>
        <div style={{
          position:'absolute', inset:0, borderRadius:'50%',
          border:`3px solid ${M.violetSoft}`,
          borderTopColor: M.violet,
          animation:'dpSpin 1s linear infinite',
        }}/>
        <div style={{
          position:'absolute', inset:10, borderRadius:'50%',
          background: ex.bg, color: ex.fg,
          display:'flex', alignItems:'center', justifyContent:'center',
          overflow:'hidden',
          boxShadow: ex.k === 'binance' ? '0 8px 24px rgba(240,185,11,0.32)' : 'none',
        }}>{DP_LOGOS[ex.k] || (
          <span style={{fontWeight:800, fontSize:38}}>{ex.glyph}</span>
        )}</div>
        <style>{`@keyframes dpSpin { to { transform: rotate(360deg); } }`}</style>
      </div>

      <div style={{
        textAlign:'center', marginBottom:24,
      }}>
        <div style={{fontSize:18, fontWeight:700, color:M.text, marginBottom:4}}>
          正在部署到 {ex.name}
        </div>
        <div style={{fontSize:12, color:M.dim}}>
          请勿关闭页面,通常需要 3-5 秒
        </div>
      </div>

      {/* steps list */}
      <Card p="0" style={{overflow:'hidden'}}>
        {steps.map((s, i) => {
          const done   = i < idx;
          const active = i === idx;
          const pending = i > idx;
          return (
            <div key={s.k} style={{
              padding:'12px 14px',
              borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
              display:'flex', alignItems:'center', gap:12,
              opacity: pending ? 0.5 : 1,
              transition:'opacity 200ms',
            }}>
              <div style={{
                width:22, height:22, borderRadius:11, flexShrink:0,
                background: done ? M.ok : (active ? M.violetSoft : M.soft),
                color: done ? '#fff' : M.violet,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:700,
              }}>
                {done && <Ico d={ICONS.check} w={12} sw={3}/>}
                {active && (
                  <span style={{
                    width:10, height:10, borderRadius:5,
                    border:`2px solid ${M.violet}`,
                    borderTopColor:'transparent',
                    animation:'dpSpin 0.7s linear infinite',
                  }}/>
                )}
                {pending && <span style={{
                  width:6, height:6, borderRadius:3, background:M.faint,
                }}/>}
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{
                  fontSize:13, fontWeight: active ? 600 : 500,
                  color: active ? M.text : (done ? M.mid : M.dim),
                }}>{s.label}</div>
                <div style={{
                  fontSize:11, color:M.dim, marginTop:2, lineHeight:1.4,
                }}>{s.sub}</div>
              </div>
              {done && (
                <span style={{
                  fontSize:11, color:M.ok, fontWeight:600, fontFamily:M.mono,
                  flexShrink:0,
                }}>OK</span>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* === STAGE 4: 部署成功 ================================================= */
function DpSuccess({ ex, amount }) {
  const id = 'QF-' + Math.floor(Date.now()/1000).toString(36).toUpperCase().slice(-6);
  return (
    <>
      <div style={{flex:1, overflowY:'auto', padding:'12px 16px 100px'}}>
        {/* hero check */}
        <div style={{
          padding:'32px 16px 28px', textAlign:'center',
        }}>
          <div style={{
            width:80, height:80, borderRadius:40, margin:'0 auto 16px',
            background:M.ok, color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 12px 32px rgba(22,199,131,0.36)',
            position:'relative',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff"
                 strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5 9-11"/>
            </svg>
            <div style={{
              position:'absolute', inset:-10, borderRadius:'50%',
              border:`2px solid ${M.ok}`, opacity:0.2,
              animation:'dpPulse 1.6s ease-out infinite',
            }}/>
            <style>{`
              @keyframes dpPulse {
                from { transform: scale(1); opacity:0.3; }
                to   { transform: scale(1.4); opacity:0; }
              }
            `}</style>
          </div>
          <div style={{fontSize:22, fontWeight:700, color:M.text, marginBottom:6, letterSpacing:-0.3}}>
            部署成功
          </div>
          <div style={{fontSize:13, color:M.mid, lineHeight:1.6}}>
            策略已在 {ex.name} 实盘运行<br/>
            首个信号触发后会通过推送提醒你
          </div>
        </div>

        {/* deployment detail */}
        <Card p="0" style={{marginBottom:14, overflow:'hidden'}}>
          {[
            ['策略 ID',  id,                 'mono'],
            ['交易所',   ex.name,            null],
            ['交易对',   'BTC/USDT · 15m',   'mono'],
            ['初始资金', `${Number(amount).toLocaleString()} USDT`, 'mono'],
            ['杠杆',     '5x · 全仓',         'mono'],
            ['启动时间', '2026-05-26 09:41', 'mono'],
            ['状态',     '运行中',            'badge'],
          ].map(([k, v, kind], i) => (
            <div key={k} style={{
              padding:'12px 14px',
              borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
              display:'flex', alignItems:'center', gap:12,
            }}>
              <span style={{fontSize:12, color:M.dim, flex:1}}>{k}</span>
              {kind === 'badge'
                ? <Chip tone="ok" style={{whiteSpace:'nowrap'}}>
                    <span style={{
                      width:6, height:6, borderRadius:3, background:M.ok,
                      display:'inline-block', boxShadow:`0 0 0 3px rgba(22,199,131,0.18)`,
                    }}/>
                    {v}
                  </Chip>
                : <span style={{
                    fontSize:13, fontWeight:600, color:M.text,
                    fontFamily: kind === 'mono' ? M.mono : M.sans,
                    whiteSpace:'nowrap',
                  }}>{v}</span>
              }
            </div>
          ))}
        </Card>

        {/* next steps */}
        <div style={{padding:'4px 4px 8px', fontSize:12, color:M.mid, fontWeight:600}}>
          接下来你可以
        </div>
        {[
          { icon:ICONS.market, title:'查看实盘策略', sub:'在「我的 → 实盘策略」追踪持仓和收益', go:'live' },
          { icon:ICONS.bell,   title:'开启价格通知', sub:'BTC 突破关键位时第一时间收到推送' },
          { icon:ICONS.bot,    title:'继续在 AI 中调优', sub:'随时回到对话调整止损或参数', go:'ai' },
        ].map((row, i) => (
          <button key={i}
            {...(row.go === 'live' ? {'data-go-live': true} : {})}
            {...(row.go === 'ai'   ? {'data-back': 'ai'}    : {})}
            style={{
            width:'100%', padding:'14px 14px', marginBottom:8, border:0,
            background: M.elev,
            borderRadius:12,
            display:'flex', alignItems:'center', gap:12, cursor:'pointer',
            textAlign:'left',
            boxShadow: '0 1px 3px rgba(15,11,34,0.04)',
          }}>
            <div style={{
              width:36, height:36, borderRadius:10, background:M.violetSoft, color:M.violet,
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
            }}>
              <Ico d={row.icon} w={17} sw={1.8}/>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13, color:M.text, fontWeight:600}}>{row.title}</div>
              <div style={{fontSize:11, color:M.dim, marginTop:2}}>{row.sub}</div>
            </div>
            <Ico d={ICONS.caretR} w={14} sw={1.8}/>
          </button>
        ))}
      </div>

      <DpBottomBar>
        <button data-back="ai" style={{...dpPrimaryBtn, flex:1}}>
          完成
        </button>
      </DpBottomBar>
    </>
  );
}

/* shared bottom bar + button styles ------------------------------------ */
function DpBottomBar({ children }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:30,
      padding:'12px 16px 36px',
      background: `linear-gradient(180deg, transparent, ${M.bg} 30%)`,
      display:'flex', gap:10,
    }}>{children}</div>
  );
}
const dpPrimaryBtn = {
  flex:2, height:50, borderRadius:14, border:0,
  background:M.violetGrad, color:'#fff',
  fontSize:14, fontWeight:600, whiteSpace:'nowrap',
  boxShadow:'0 8px 24px rgba(124,92,255,0.32)', cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
};
const dpSecondaryBtn = {
  flex:1, height:50, borderRadius:14,
  border:`1px solid ${M.border}`, background:M.elev,
  color:M.text, fontSize:14, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap',
};

/* canvas-only wrappers — each one anchors at a specific stage ---------- */
function ScreenDeploySelect()    { return <ScreenDeploy initialStage="select"/>; }
function ScreenDeployAllocate()  { return <ScreenDeploy initialStage="allocate"/>; }
function ScreenDeployDeploying() { return <ScreenDeploy initialStage="deploying"/>; }
function ScreenDeploySuccess()   { return <ScreenDeploy initialStage="success"/>; }

Object.assign(window, {
  ScreenDeploy,
  ScreenDeploySelect, ScreenDeployAllocate,
  ScreenDeployDeploying, ScreenDeploySuccess,
});

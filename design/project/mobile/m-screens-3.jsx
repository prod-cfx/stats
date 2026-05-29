/* Mobile screens part 3 — Trading detail, L/S Ratio, Whale Feed, Account, API Config */

/* ========================================================================
   SCREEN 6 — Trading Detail (BTC/USDT)
   ======================================================================== */
const ASKS = [
  {p:'74,240.30', q:'0.8214', t:'60.99K'},
  {p:'74,238.10', q:'1.2480', t:'92.65K'},
  {p:'74,235.40', q:'0.4862', t:'36.10K'},
  {p:'74,231.60', q:'2.1306', t:'158.2K'},
  {p:'74,229.80', q:'0.9012', t:'66.90K'},
];
const BIDS = [
  {p:'74,225.10', q:'1.4820', t:'109.9K'},
  {p:'74,222.40', q:'0.7240', t:'53.74K'},
  {p:'74,219.80', q:'2.8412', t:'210.8K'},
  {p:'74,216.20', q:'0.5408', t:'40.13K'},
  {p:'74,213.50', q:'1.9620', t:'145.6K'},
];
const TRADES = [
  {t:'03:10:02', p:'74,229.80', q:'0.0824', side:'buy'},
  {t:'03:10:01', p:'74,228.30', q:'0.4118', side:'buy'},
  {t:'03:09:59', p:'74,225.10', q:'0.1248', side:'sell'},
  {t:'03:09:57', p:'74,222.40', q:'1.8204', side:'sell'},
  {t:'03:09:55', p:'74,225.10', q:'0.0612', side:'buy'},
  {t:'03:09:53', p:'74,229.80', q:'0.2810', side:'buy'},
  {t:'03:09:51', p:'74,222.40', q:'0.0942', side:'sell'},
  {t:'03:09:48', p:'74,227.10', q:'0.6184', side:'buy'},
  {t:'03:09:45', p:'74,219.80', q:'0.3206', side:'sell'},
  {t:'03:09:42', p:'74,225.10', q:'0.1842', side:'buy'},
  {t:'03:09:39', p:'74,222.40', q:'0.4012', side:'sell'},
  {t:'03:09:36', p:'74,229.80', q:'0.0606', side:'buy'},
];
/* 大额成交 — 与 PC 端「大额成交」对齐：价格 / 数量 / 时间 */
const BIG_TRADES = [
  {p:'73,171.90', q:'1.43700', t:'11:57:43', side:'sell'},
  {p:'73,170.90', q:'1.47800', t:'11:57:43', side:'buy' },
  {p:'73,170.90', q:'2.04400', t:'11:57:43', side:'buy' },
  {p:'73,150.00', q:'1.88400', t:'11:57:37', side:'buy' },
  {p:'73,120.00', q:'1.84800', t:'11:57:33', side:'buy' },
  {p:'73,108.70', q:'1.40000', t:'11:57:32', side:'buy' },
  {p:'73,108.70', q:'1.52100', t:'11:57:29', side:'buy' },
  {p:'73,108.60', q:'1.48200', t:'11:57:23', side:'buy' },
  {p:'73,108.60', q:'1.52100', t:'11:57:23', side:'buy' },
  {p:'73,108.60', q:'1.53700', t:'11:57:23', side:'buy' },
  {p:'73,108.60', q:'1.55500', t:'11:57:23', side:'buy' },
  {p:'73,105.80', q:'2.85900', t:'11:57:21', side:'buy' },
  {p:'73,111.70', q:'2.04400', t:'11:57:21', side:'sell'},
  {p:'73,111.90', q:'2.47100', t:'11:57:21', side:'sell'},
];

const SRC_EXCHANGES = ['Binance', 'OKX'];

function ScreenTradingDetail() {
  const [panel, setPanel] = React.useState('book'); // 'book' | 'trades' | 'depth'
  const [agg, setAgg]     = React.useState(true); // 聚合: cross-exchange merged book (default ON)
  const [exch, setExch]   = React.useState('Binance');
  const [exchOpen, setExchOpen] = React.useState(false);
  const [prec, setPrec]   = React.useState('0.01');
  const [precOpen, setPrecOpen] = React.useState(false);
  const PREC_OPTS = ['0.01','0.1','1','10','100'];
  return (
    <div style={{height:'100%', position:'relative', background:M.bg, overflow:'hidden', display:'flex', flexDirection:'column'}}>
      <MStatus/>
      <MTopBar
        onBack={()=>{}}
        backTo="market"
        title="BTC / USDT"
        sub={agg ? '永续 · 聚合' : `永续 · ${exch}`}
        right={
          <div style={{display:'flex', gap:6}}>
            <button style={iconBtn}><Ico d={ICONS.star} w={18}/></button>
            <button style={iconBtn}><Ico d={ICONS.more} w={18} sw={2.5}/></button>
          </div>
        }
      />
      {/* scrollable region — sits beneath the fixed top bar, above the sticky buy/sell + tab bar */}
      <div style={{flex:1, minHeight:0, overflow:'auto', paddingBottom:158}}>
      <div style={{padding:'12px 16px 10px', background:M.elev}}>
        {/* row 1: price + change */}
        <div style={{display:'flex', alignItems:'baseline', gap:10, minWidth:0, marginBottom:10}}>
          <span style={{fontSize:26, fontWeight:700, color:M.dn, fontFamily:M.mono, letterSpacing:-0.5}}>74,228.30</span>
          <span style={{fontSize:13, color:M.dn, fontFamily:M.mono, fontWeight:600, whiteSpace:'nowrap'}}>−586.40 (−0.79%)</span>
        </div>

        {/* row 2: 指数 / 标记 / 资金费率 / 下次结算 */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10,
          fontSize:10.5, paddingBottom:9, marginBottom:9,
          borderBottom:`1px solid ${M.borderSoft}`,
        }}>
          {[
            { l:'指数价格', v:'67,403.6',  tone:M.text },
            { l:'标记价格', v:'74,217.9',  tone:M.text },
            { l:'资金费率', v:'+0.00%',    tone:M.text },
            { l:'持仓量',   v:'95.82 BTC', tone:M.text },
          ].map(s => (
            <div key={s.l}>
              <div style={{color:M.dim, letterSpacing:0.1}}>{s.l}</div>
              <div style={{color:s.tone, fontFamily:M.mono, fontWeight:600, marginTop:2}}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* row 3: 24h 高 / 低 / 量 */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, fontSize:10.5}}>
          {[
            ['24H 高', '74,555.50'],
            ['24H 低', '74,336.70'],
            ['24H 量', '67.82 BTC'],
          ].map(([l,v]) => (
            <div key={l}>
              <div style={{color:M.dim, letterSpacing:0.1}}>{l}</div>
              <div style={{color:M.text, fontFamily:M.mono, fontWeight:500, marginTop:2}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:M.elev, borderTop:`1px solid ${M.borderSoft}`, padding:'8px 16px 0'}}>
        <div style={{display:'flex', alignItems:'center', gap:12, fontSize:12, fontWeight:500}}>
          {[['1m'],['15m'],['1H',true],['4H'],['1D'],['更多']].map(([t,on])=>(
            <span key={t} style={{
              padding:'6px 0', color: on ? M.text : M.mid, whiteSpace:'nowrap',
              borderBottom: on ? `2px solid ${M.text}` : '2px solid transparent', fontWeight: on ? 700 : 500,
            }}>{t}</span>
          ))}
          <div style={{flex:1}}/>
          <SourcePicker exch={exch} agg={agg} setExch={setExch} setAgg={setAgg} open={exchOpen} setOpen={setExchOpen}/>
        </div>
      </div>

      <div style={{background:M.elev, padding:'4px 0 6px'}}>
        <div style={{padding:'6px 16px', fontFamily:M.mono, fontSize:10, color:M.mid, display:'flex', gap:10}}>
          <span>O <span style={{color:M.text}}>74,227.30</span></span>
          <span>H <span style={{color:M.up}}>74,228.40</span></span>
          <span>L <span style={{color:M.dn}}>74,217.90</span></span>
          <span>C <span style={{color:M.dn}}>74,217.90</span></span>
        </div>
        <Candles width={402} height={200}/>
      </div>

      {/* 24h 累计成交额 / 累计净流入 / 最高 / 最低 — flat row matching header style */}
      <div style={{
        background:M.elev, borderTop:`6px solid ${M.bg}`,
        padding:'14px 16px',
        display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10,
        fontSize:10.5,
      }}>
        {[
          { l:'累计成交额($)', v:'783.09亿',     tone:M.text },
          { l:'累计净流入($)', v:'−39.15亿',     tone:M.dn   },
          { l:'最高',         v:'74,555.50',   tone:M.text },
          { l:'最低',         v:'74,336.70',   tone:M.text },
        ].map(s => (
          <div key={s.l}>
            <div style={{color:M.dim, letterSpacing:0.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{s.l}</div>
            <div style={{color:s.tone, fontFamily:M.mono, fontWeight:600, marginTop:2, fontSize:11, letterSpacing:-0.1}}>{s.v}</div>
          </div>
        ))}
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
        </div>

        {panel === 'book' && <OrderBookPanel agg={agg} prec={prec} setPrec={setPrec} precOpen={precOpen} setPrecOpen={setPrecOpen}/>}
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

      {/* ─── 交易所来源 — bottom drawer ─── */}
      {exchOpen && (
        <div
          onClick={()=>setExchOpen(false)}
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
              数据来源
            </div>
            <div style={{padding:'0 8px 6px'}}>
              {[{ k:'__agg', label:'聚合所有交易所' }, ...SRC_EXCHANGES.map(x=>({ k:x, label:x }))].map(opt => {
                const on = opt.k === '__agg' ? agg : (!agg && opt.k === exch);
                return (
                  <button
                    key={opt.k}
                    onClick={()=>{
                      if (opt.k === '__agg') { setAgg(true); }
                      else { setAgg(false); setExch(opt.k); }
                      setExchOpen(false);
                    }}
                    style={{
                      display:'flex', alignItems:'center', gap:11,
                      width:'100%', padding:'12px 12px',
                      border:0, background:'transparent', cursor:'pointer',
                      fontFamily:'inherit', textAlign:'left',
                    }}>
                    <span style={{
                      flex:1, fontSize:14, fontWeight: opt.k === '__agg' ? 700 : 600,
                      color: on ? M.violet : M.text,
                    }}>{opt.label}</span>
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
              <button onClick={()=>setExchOpen(false)} style={{
                width:'100%', height:46, border:0, cursor:'pointer',
                background:'transparent', color:M.text,
                fontSize:14, fontWeight:600, fontFamily:'inherit',
              }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 价格精度 — bottom drawer ─── */}
      {precOpen && (
        <div
          onClick={()=>setPrecOpen(false)}
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
              价格精度
            </div>
            <div style={{padding:'0 8px 6px'}}>
              {PREC_OPTS.map(o => {
                const on = o === prec;
                return (
                  <button
                    key={o}
                    onClick={()=>{ setPrec(o); setPrecOpen(false); }}
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
              <button onClick={()=>setPrecOpen(false)} style={{
                width:'100%', height:46, border:0, cursor:'pointer',
                background:'transparent', color:M.text,
                fontSize:14, fontWeight:600, fontFamily:'inherit',
              }}>取消</button>
            </div>
          </div>
        </div>
      )}

      <MTabBar active="market"/>
    </div>
  );
}

/* ---- exchange / aggregate picker (single dropdown → opens bottom drawer) ---- */
function SourcePicker({ exch, agg, setExch, setAgg, open, setOpen }) {
  const label = agg ? '聚合' : exch;

  return (
    <div style={{position:'relative', flexShrink:0}}>
      <button
        onClick={()=>setOpen(!open)}
        style={{
          height:26, padding:'0 6px 0 10px', borderRadius:999,
          border:`1px solid ${agg ? 'transparent' : M.border}`,
          background: agg ? M.violetGrad : M.elev,
          color: agg ? '#fff' : M.text,
          display:'inline-flex', alignItems:'center', gap:4, whiteSpace:'nowrap',
          fontSize:11.5, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
          boxShadow: agg ? '0 4px 12px rgba(124,92,255,0.28)' : 'none',
        }}
      >
        <span>{label}</span>
        <svg width="9" height="9" viewBox="0 0 10 10" style={{opacity:0.7, transform: open ? 'rotate(180deg)' : 'none', transition:'transform 120ms'}}>
          <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

/* ---- exchange picker (used in trade detail header) ---- */
function ExchangePicker({ value, onChange, open, setOpen, disabled }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, setOpen]);

  return (
    <div ref={ref} style={{position:'relative', flexShrink:0}}>
      <button
        onClick={()=>!disabled && setOpen(!open)}
        style={{
          height:26, padding:'0 6px 0 10px', borderRadius:999,
          border:`1px solid ${M.border}`,
          background: M.elev,
          color: disabled ? M.dim : M.text,
          opacity: disabled ? 0.5 : 1,
          display:'inline-flex', alignItems:'center', gap:3, whiteSpace:'nowrap',
          fontSize:11.5, fontWeight:600, fontFamily:'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span>{value}</span>
        <svg width="9" height="9" viewBox="0 0 10 10" style={{opacity:0.7, transform: open ? 'rotate(180deg)' : 'none', transition:'transform 120ms'}}>
          <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:50,
          minWidth:140, padding:'6px',
          background:M.elev, border:`1px solid ${M.border}`, borderRadius:12,
          boxShadow:'0 12px 32px rgba(0,0,0,0.35)',
        }}>
          {SRC_EXCHANGES.map(x => {
            const on = x === value;
            return (
              <button key={x} onClick={()=>{ onChange(x); setOpen(false); }} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                width:'100%', padding:'8px 10px', borderRadius:8,
                background: on ? M.soft : 'transparent',
                border:'0', cursor:'pointer', fontFamily:'inherit',
                color: on ? M.text : M.text, fontSize:13, fontWeight: on ? 600 : 500,
              }}>
                <span>{x}</span>
                {on && (
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <path d="M2.5 6.2 L5 8.5 L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---- 聚合 toggle (used in trade detail header) ---- */
function AggToggle({ on, onChange }) {
  return (
    <button onClick={()=>onChange(!on)} style={{
      flexShrink:0, height:26, padding:'0 4px 0 10px', borderRadius:999,
      border:`1px solid ${on ? 'transparent' : M.border}`,
      background: on ? M.violetGrad : M.elev,
      color: on ? '#fff' : M.mid,
      display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
      fontSize:11.5, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
      boxShadow: on ? '0 4px 12px rgba(124,92,255,0.28)' : 'none',
    }}>
      <span>聚合</span>
      <span style={{
        width:18, height:18, borderRadius:'50%',
        background: on ? 'rgba(255,255,255,0.22)' : M.soft,
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        fontSize:9, fontWeight:700, fontFamily:M.mono,
        color: on ? '#fff' : M.dim,
      }}>{on ? '7' : '1'}</span>
    </button>
  );
}

/* ---- order book panel ---- */
function OrderBookPanel({ agg, prec, setPrec, precOpen, setPrecOpen }) {
  const [view, setView] = React.useState('both'); // both | asks | bids

  const showAsks = view !== 'bids';
  const showBids = view !== 'asks';

  // cumulative qty for ask side (from mid outward = ASKS reversed)
  const askRows = ASKS.slice().reverse(); // closest-to-mid first
  let askCum = 0;
  const askWithCum = askRows.map(o => {
    askCum += parseFloat(o.q);
    return { ...o, cum: askCum };
  }).reverse(); // back to top-down (highest price first)

  let bidCum = 0;
  const bidWithCum = BIDS.map(o => {
    bidCum += parseFloat(o.q);
    return { ...o, cum: bidCum };
  });
  const maxCum = Math.max(askCum, bidCum);

  return (
    <React.Fragment>
      {/* toolbar — refresh / view-mode / sort + precision */}
      <div style={{
        padding:'8px 16px', display:'flex', alignItems:'center', gap:6,
        borderBottom:`1px solid ${M.borderSoft}`,
      }}>
        <button title="刷新" style={obIconBtn}>
          <Ico d={ICONS.refresh} w={13} sw={2}/>
        </button>
        {/* view mode 3-state */}
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
                width:26, height:22, padding:0, borderRadius:5,
                border:0, cursor:'pointer',
                background: view === v.k ? M.elev : 'transparent',
                color: view === v.k ? M.violet : M.mid,
                display:'inline-flex', alignItems:'center', justifyContent:'center',
              }}>
              <ObViewIcon kind={v.k}/>
            </button>
          ))}
        </div>
        <button title="排序" style={obIconBtn}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4"/>
          </svg>
        </button>
        <div style={{flex:1}}/>
        {/* precision dropdown — opens bottom drawer */}
        <div style={{position:'relative'}}>
          <button onClick={()=>setPrecOpen(true)} style={{
            height:24, padding:'0 8px', borderRadius:6,
            border:`1px solid ${precOpen ? M.violet : M.border}`,
            background: precOpen ? M.violetSoft : M.elev,
            color: precOpen ? M.violet : M.text,
            fontSize:11, fontWeight:600, fontFamily:M.mono,
            display:'inline-flex', alignItems:'center', gap:4,
            cursor:'pointer',
          }}>
            {prec}
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              style={{transform: precOpen ? 'rotate(180deg)' : 'none', transition:'transform 160ms'}}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* column header */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'minmax(70px,1fr) minmax(60px,1fr) minmax(70px,1fr)',
        gap:8, padding:'6px 16px',
        fontSize:10, color:M.dim, fontFamily:M.mono,
      }}>
        <span>价格(USDT)</span>
        <span style={{textAlign:'right'}}>数量(BTC)</span>
        <span style={{textAlign:'right'}}>委托额($)</span>
      </div>

      <div>
        {showAsks && askWithCum.map((o,i)=>(
          <OrderRow key={'a'+i} o={o} ask maxCum={maxCum}/>
        ))}

        {view === 'both' && (
          <div style={{
            padding:'10px 16px', display:'flex', alignItems:'center', gap:8,
            background: M.soft,
            borderTop:`1px solid ${M.borderSoft}`,
            borderBottom:`1px solid ${M.borderSoft}`,
          }}>
            <span style={{fontSize:18, fontWeight:700, fontFamily:M.mono, color:M.dn, letterSpacing:-0.3}}>
              74,228.30
            </span>
            <span style={{fontSize:11, color:M.dn, fontFamily:M.mono, fontWeight:600}}>−0.79%</span>
            <span style={{fontSize:10.5, color:M.dim, fontFamily:M.mono}}>≈ $74,228.30</span>
          </div>
        )}

        {showBids && bidWithCum.map((o,i)=>(
          <OrderRow key={'b'+i} o={o} maxCum={maxCum}/>
        ))}
      </div>
    </React.Fragment>
  );
}

function ObViewIcon({ kind }) {
  if (kind === 'asks') return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="2" rx="0.5" fill="currentColor" opacity="0.9"/>
      <rect x="2" y="7" width="9"  height="2" rx="0.5" fill="currentColor" opacity="0.7"/>
      <rect x="2" y="11" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.5"/>
    </svg>
  );
  if (kind === 'bids') return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="6"  height="2" rx="0.5" fill="currentColor" opacity="0.5"/>
      <rect x="2" y="7" width="9"  height="2" rx="0.5" fill="currentColor" opacity="0.7"/>
      <rect x="2" y="11" width="12" height="2" rx="0.5" fill="currentColor" opacity="0.9"/>
    </svg>
  );
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="11" height="1.6" rx="0.5" fill="currentColor" opacity="0.85"/>
      <rect x="2" y="6.6" width="8" height="1.6" rx="0.5" fill="currentColor" opacity="0.85"/>
      <rect x="2" y="10.2" width="11" height="1.6" rx="0.5" fill="currentColor" opacity="0.55"/>
    </svg>
  );
}

const obIconBtn = {
  width:24, height:22, padding:0, borderRadius:6,
  border:`1px solid var(--border-soft)`,
  background:'var(--bg-elev)', color:'var(--text-mid)',
  display:'inline-flex', alignItems:'center', justifyContent:'center',
  cursor:'pointer',
};

/* ---- trades panel ---- */
function TradesPanel() {
  const [sub, setSub] = React.useState('latest'); // 'latest' | 'big'
  return (
    <React.Fragment>
      {/* sub-tabs: 最新成交 / 大额成交 */}
      <div style={{
        display:'flex', gap:6, padding:'10px 16px 8px',
        borderBottom:`1px solid ${M.borderSoft}`,
      }}>
        {[['latest','最新成交'], ['big','大额成交']].map(([k,label]) => {
          const on = sub === k;
          return (
            <button key={k} onClick={()=>setSub(k)} style={{
              padding:'6px 12px', borderRadius:999, border:0, cursor:'pointer',
              background: on ? M.soft : 'transparent',
              color: on ? M.text : M.mid,
              fontSize:12, fontWeight: on ? 600 : 500,
              fontFamily: M.sans,
            }}>{label}</button>
          );
        })}
        <div style={{flex:1}}/>
        <button title="排序" style={{
          width:26, height:24, padding:0, borderRadius:6,
          border:`1px solid ${M.borderSoft}`, background:M.elev,
          color:M.mid, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4"/>
          </svg>
        </button>
      </div>

      {sub === 'latest' ? <LatestTradesList/> : <BigTradesList/>}
    </React.Fragment>
  );
}

function LatestTradesList() {
  return (
    <React.Fragment>
      <div style={{
        display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr', padding:'8px 16px 4px',
        fontSize:10, color:M.dim, fontFamily:M.mono,
      }}>
        <span>价格(USDT)</span>
        <span style={{textAlign:'right'}}>数量(BTC)</span>
        <span style={{textAlign:'right'}}>成交时间</span>
      </div>
      <div>
        {TRADES.map((tr,i)=>{
          const up = tr.side === 'buy';
          return (
            <div key={i} style={{
              display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr',
              padding:'7px 16px', fontSize:12, fontFamily:M.mono, alignItems:'center',
            }}>
              <span style={{color: up ? M.up : M.dn, fontWeight:600}}>{tr.p}</span>
              <span style={{textAlign:'right', color:M.text}}>{tr.q}</span>
              <span style={{textAlign:'right', color:M.mid}}>{tr.t}</span>
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

function BigTradesList() {
  return (
    <React.Fragment>
      <div style={{
        display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr', padding:'8px 16px 4px',
        fontSize:10, color:M.dim, fontFamily:M.mono,
      }}>
        <span>价格(USDT)</span>
        <span style={{textAlign:'right'}}>数量(BTC)</span>
        <span style={{textAlign:'right'}}>成交时间</span>
      </div>
      <div>
        {BIG_TRADES.map((tr,i)=>{
          const up = tr.side === 'buy';
          return (
            <div key={i} style={{
              display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr',
              padding:'7px 16px', fontSize:12, fontFamily:M.mono, alignItems:'center',
            }}>
              <span style={{color: up ? M.up : M.dn, fontWeight:600}}>{tr.p}</span>
              <span style={{textAlign:'right', color:M.text}}>{tr.q}</span>
              <span style={{textAlign:'right', color:M.mid}}>{tr.t}</span>
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
    {p:74211,q:0.62},{p:74208,q:1.21},{p:74205,q:0.84},{p:74201,q:2.14},{p:74198,q:1.45},
    {p:74194,q:0.96},{p:74190,q:2.84},{p:74182,q:1.62},{p:74170,q:3.20},
  ]];
  const allAsks = [...ASKS, ...[
    {p:74244,q:1.10},{p:74247,q:0.62},{p:74250,q:1.84},{p:74254,q:0.74},{p:74258,q:2.41},
    {p:74266,q:1.02},{p:74274,q:1.96},{p:74288,q:2.50},{p:74305,q:3.15},
  ]];
  const parse = (o) => ({ p: typeof o.p === 'string' ? parseFloat(o.p.replace(/,/g,'')) : o.p, q: typeof o.q === 'string' ? parseFloat(o.q) : o.q });
  const bids = allBids.map(parse).sort((a,b) => b.p - a.p); // high → low
  const asks = allAsks.map(parse).sort((a,b) => a.p - b.p); // low → high
  let bidCum = 0; const bidPts = bids.map(o => ({ p: o.p, c: (bidCum += o.q) }));
  let askCum = 0; const askPts = asks.map(o => ({ p: o.p, c: (askCum += o.q) }));
  const maxC = Math.max(bidCum, askCum) * 1.1;
  const mid = 74228.30;
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
          fill="var(--text-mid)" textAnchor="middle">74,228.30</text>
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

function OrderRow({ o, ask, maxCum }) {
  const qty = parseFloat(String(o.q).replace(/,/g,''));
  const cum = o.cum ?? qty;
  const w   = maxCum ? Math.min(100, (cum / maxCum) * 100) : 0;
  // 委托额 = 价格 × 数量 (notional). 't' field already encodes this in source data.
  const notional = o.t || '';
  return (
    <div style={{
      position:'relative',
      display:'grid',
      gridTemplateColumns:'minmax(70px,1fr) minmax(60px,1fr) minmax(70px,1fr)',
      gap:8, padding:'5px 16px', fontSize:12, fontFamily:M.mono, alignItems:'center',
    }}>
      {/* depth bar — cumulative, anchored to right */}
      <div style={{
        position:'absolute', right:0, top:0, bottom:0,
        width:`${w}%`,
        background: ask ? 'rgba(229,72,77,0.10)' : 'rgba(22,163,107,0.10)',
        pointerEvents:'none',
      }}/>
      <span style={{position:'relative', color: ask ? M.dn : M.up, fontWeight:600}}>{o.p}</span>
      <span style={{position:'relative', textAlign:'right', color:M.text}}>{o.q}</span>
      <span style={{position:'relative', textAlign:'right', color:M.mid}}>{notional}</span>
    </div>
  );
}

/* ========================================================================
   SCREEN 7 — 交易所多空比 (Long / Short Ratio)
   Aligned to PC /zh/long-short-ratio
   ======================================================================== */
const LS_COINS = ['BTC','ETH','SOL','XRP','DOGE','HYPE','BNB','SUI','ADA','LINK'];
const LS_TFS   = ['5分钟','15分钟','1小时','4小时','24小时'];

/* exchange registry — color + letter for the small badge */
const LS_EX = {
  BIN: { name:'Binance',     letter:'B', color:'#F0B90B', fg:'#000' },
  MEX: { name:'MEXC',        letter:'M', color:'#1D6EFC', fg:'#fff' },
  WBT: { name:'WhiteBIT',    letter:'W', color:'#0E1726', fg:'#fff' },
  OKX: { name:'OKX',         letter:'O', color:'#000000', fg:'#fff' },
  BYB: { name:'Bybit',       letter:'Y', color:'#F7A600', fg:'#000' },
  GT:  { name:'Gate',        letter:'G', color:'#22D3EE', fg:'#000' },
  BG:  { name:'Bitget',      letter:'G', color:'#00D8C9', fg:'#000' },
  CB:  { name:'Coinbase',    letter:'C', color:'#1652F0', fg:'#fff' },
  BIX: { name:'BingX',       letter:'X', color:'#2962FF', fg:'#fff' },
  BTX: { name:'Bitunix',     letter:'B', color:'#0E1726', fg:'#fff' },
  HL:  { name:'Hyperliquid', letter:'H', color:'#34D399', fg:'#000' },
  LB:  { name:'LBank',       letter:'L', color:'#1B1B1B', fg:'#fff' },
  AST: { name:'Aster',       letter:'A', color:'#F59E0B', fg:'#000' },
  LGT: { name:'Lighter',     letter:'L', color:'#A78BFA', fg:'#fff' },
  HTX: { name:'HTX',         letter:'H', color:'#3076FF', fg:'#fff' },
  DER: { name:'Deribit',     letter:'D', color:'#E5484D', fg:'#fff' },
  BMX: { name:'Bitmex',      letter:'B', color:'#1F2937', fg:'#fff' },
  CRP: { name:'Crypto.com',  letter:'C', color:'#003CDA', fg:'#fff' },
  CEX: { name:'CoinEx',      letter:'C', color:'#2EB8AA', fg:'#fff' },
  KRK: { name:'Kraken',      letter:'K', color:'#5841D8', fg:'#fff' },
  KC:  { name:'KuCoin',      letter:'K', color:'#22D896', fg:'#000' },
  BFX: { name:'Bitfinex',    letter:'B', color:'#94A3B8', fg:'#fff' },
  DYX: { name:'dYdX',        letter:'D', color:'#6966FF', fg:'#fff' },
  TXY: { name:'tradeXYZ',    letter:'X', color:'#7C5CFF', fg:'#fff' },
};

/* BTC data — mirrors PC */
const LS_BTC = {
  total: { longPct: 51.65, shortPct: 48.35, longUsd: '23.21亿', shortUsd: '21.73亿' },
  rows: [
    { ex:'BIN', l:53.93, s:46.07, lUsd:'4.69亿',   sUsd:'4亿'      },
    { ex:'MEX', l:50.12, s:49.88, lUsd:'3.56亿',   sUsd:'3.54亿'   },
    { ex:'WBT', l:47.93, s:52.07, lUsd:'2.37亿',   sUsd:'2.57亿'   },
    { ex:'OKX', l:54.91, s:45.09, lUsd:'2.67亿',   sUsd:'2.2亿'    },
    { ex:'BYB', l:56.09, s:43.91, lUsd:'2亿',      sUsd:'1.57亿'   },
    { ex:'GT',  l:51.67, s:48.33, lUsd:'1.78亿',   sUsd:'1.66亿'   },
    { ex:'BG',  l:52.52, s:47.48, lUsd:'1.31亿',   sUsd:'1.18亿'   },
    { ex:'CB',  l:47.20, s:52.80, lUsd:'7576.49万',sUsd:'8475.19万'},
    { ex:'BIX', l:50.40, s:49.60, lUsd:'7937.35万',sUsd:'7812.64万'},
    { ex:'BTX', l:53.89, s:46.11, lUsd:'8027.4万', sUsd:'6867.57万'},
    { ex:'HL',  l:62.48, s:37.52, lUsd:'7381.29万',sUsd:'4431.78万'},
    { ex:'LB',  l:25.87, s:74.13, lUsd:'2359.38万',sUsd:'6759.41万'},
    { ex:'AST', l:49.54, s:50.46, lUsd:'3403.8万', sUsd:'3466.96万'},
    { ex:'LGT', l:51.41, s:48.59, lUsd:'2929.53万',sUsd:'2768.84万'},
    { ex:'HTX', l:49.67, s:50.33, lUsd:'1984.38万',sUsd:'2010.72万'},
    { ex:'DER', l:50.67, s:49.33, lUsd:'1476.63万',sUsd:'1437.48万'},
    { ex:'BMX', l:29.06, s:70.94, lUsd:'845.26万', sUsd:'2063.47万'},
    { ex:'CRP', l:51.37, s:48.63, lUsd:'1333.74万',sUsd:'1262.62万'},
    { ex:'CEX', l:41.79, s:58.21, lUsd:'782.65万', sUsd:'1090.05万'},
    { ex:'KRK', l:58.66, s:41.34, lUsd:'1076.56万',sUsd:'758.8万'  },
    { ex:'KC',  l:62.21, s:37.79, lUsd:'999.23万', sUsd:'607.04万' },
    { ex:'BFX', l:64.04, s:35.96, lUsd:'134.18万', sUsd:'75.35万'  },
    { ex:'DYX', l:42.74, s:57.26, lUsd:'82.87万',  sUsd:'111.01万' },
    { ex:'TXY', l:0,     s:0,     lUsd:'0',        sUsd:'0',      empty:true },
  ],
};

/* Demo data per coin — we ship BTC; everything else falls back to scaled BTC */
const LS_DATA = { BTC: LS_BTC };

function LSExIcon({ k, size=20 }) {
  const e = LS_EX[k];
  if (!e) return null;
  return (
    <span style={{
      width:size, height:size, borderRadius:'50%',
      background:e.color, color:e.fg,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      fontSize: size * 0.5, fontWeight:700,
      fontFamily:'system-ui, -apple-system, sans-serif',
      flexShrink:0,
    }}>{e.letter}</span>
  );
}

/* Coin dropdown — reused mini popover */
function LSPopover({ value, options, onChange, render }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{position:'relative'}}>
      <button onClick={()=>setOpen(v=>!v)} style={{
        height:30, padding:'0 12px', borderRadius:8,
        border:`1px solid ${open ? M.violet : M.borderSoft}`,
        background: open ? M.violetSoft : M.bg,
        color: M.text, fontSize:12, fontWeight:600,
        display:'inline-flex', alignItems:'center', gap:6,
        cursor:'pointer', whiteSpace:'nowrap', fontFamily:render ? 'inherit' : M.mono,
      }}>
        <span>{render ? render(value) : value}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{transform: open ? 'rotate(180deg)' : 'none', transition:'transform 160ms'}}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <React.Fragment>
          <div onClick={()=>setOpen(false)} style={{position:'fixed', inset:0, zIndex:40}}/>
          <div style={{
            position:'absolute', top:34, right:0, zIndex:41, minWidth:96,
            background:M.elev, border:`1px solid ${M.border}`, borderRadius:10,
            boxShadow:'0 14px 32px -10px rgba(15,22,35,0.22)',
            padding:4, display:'flex', flexDirection:'column',
            maxHeight:260, overflowY:'auto',
          }}>
            {options.map(o => {
              const on = o === value;
              return (
                <button key={o} onClick={()=>{onChange(o); setOpen(false);}} style={{
                  padding:'9px 12px', border:0, cursor:'pointer',
                  background: on ? M.violetGrad || M.violet : 'transparent',
                  color: on ? '#fff' : M.text,
                  borderRadius:7, textAlign:'left',
                  fontFamily: render ? 'inherit' : M.mono,
                  display:'flex', alignItems:'center', gap:8,
                  fontSize:12.5, fontWeight: on ? 700 : 500,
                }}>
                  <span style={{flex:1}}>{render ? render(o) : o}</span>
                  {on && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

/* horizontal coin tab strip (image-2 style — flat text with active pill) */
/* horizontal coin tab strip with search */
const LS_COIN_COLOR = { BTC:'#F7931A', ETH:'#627EEA', SOL:'#9945FF', XRP:'#23292F', DOGE:'#C2A633', BNB:'#F0B90B', HYPE:'#16C783', SUI:'#4DA2FF', ADA:'#0033AD', LINK:'#2A5ADA' };
function LSCoinTabs({ value, onChange }) {
  const [searching, setSearching] = React.useState(false);

  /* inject scrollbar-hide rule once */
  React.useEffect(() => {
    if (document.getElementById('ls-coin-tabs-css')) return;
    const s = document.createElement('style');
    s.id = 'ls-coin-tabs-css';
    s.textContent = '.ls-coin-tabs::-webkit-scrollbar { display: none; }';
    document.head.appendChild(s);
  }, []);

  const renderResults = (q, pick) =>
    LS_COINS.filter(c => c.toLowerCase().includes(q.toLowerCase()))
      .map(c => (
        <SearchResultRow key={c} letter={c.slice(0,1)} color={LS_COIN_COLOR[c] || M.violet}
          title={c} sub="/ USDT" onClick={()=>pick(c)}/>
      ));

  return (
    <React.Fragment>
      <div style={{
        position:'relative',
        background:M.elev, borderBottom:`1px solid ${M.borderSoft}`,
      }}>
        {/* scrollable tabs */}
        <div className="ls-coin-tabs" style={{
          display:'flex', alignItems:'center', gap:4,
          padding:'10px 44px 10px 12px', overflowX:'scroll',
          WebkitOverflowScrolling:'touch', scrollbarWidth:'none',
          msOverflowStyle:'none', flexWrap:'nowrap',
        }}>
          {LS_COINS.map(c => {
            const on = c === value;
            return (
              <button key={c} onClick={()=>onChange(c)} style={{
                flexShrink:0, cursor:'pointer',
                padding:'6px 14px',
                border: on ? `1px solid ${M.violet}` : '1px solid transparent',
                background: on ? M.violetSoft : 'transparent',
                color: on ? M.violet : M.mid,
                fontSize:13, fontWeight: on ? 700 : 500,
                borderRadius:8, letterSpacing:0.3,
                fontFamily:M.mono,
              }}>{c}</button>
            );
          })}
        </div>
        {/* sticky search button with fade */}
        <div style={{
          position:'absolute', right:0, top:0, bottom:0,
          display:'flex', alignItems:'center', paddingRight:8,
          background:`linear-gradient(to right, transparent, ${M.elev} 40%)`,
          pointerEvents:'none',
        }}>
          <button aria-label="搜索币种" onClick={()=>setSearching(true)} style={{
            width:32, height:32, padding:0, borderRadius:8,
            border:0, background:M.elev, color:M.mid, cursor:'pointer',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            pointerEvents:'all', flexShrink:0,
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
        hot={LS_COINS}
        onPick={onChange}
        renderResults={renderResults}
        emptyText="无匹配币种"
      />
    </React.Fragment>
  );
}

/* one row in the exchange list — icon + name + USD amounts + split bar */
function LSRow({ rank, r }) {
  const empty = r.empty;
  return (
    <div style={{
      display:'flex', alignItems:'center',
      padding:'12px 14px',
      borderBottom:`1px solid ${M.borderSoft}`,
      background:M.elev,
    }}>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
          <LSExIcon k={r.ex} size={20}/>
          <span style={{
            fontSize:12.5, fontWeight:600, color:M.text,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            flex:1, minWidth:0,
          }}>{LS_EX[r.ex]?.name || r.ex}</span>
          <span style={{display:'inline-flex', flexDirection:'column', alignItems:'flex-end', gap:1, flexShrink:0}}>
            <span style={{fontSize:9.5, color:M.dim}}>做多</span>
            <span style={{fontSize:10.5, fontFamily:M.mono, color:M.up, fontWeight:600}}>US${r.lUsd}</span>
          </span>
          <span style={{display:'inline-flex', flexDirection:'column', alignItems:'flex-end', gap:1, flexShrink:0, minWidth:62}}>
            <span style={{fontSize:9.5, color:M.dim}}>做空</span>
            <span style={{fontSize:10.5, fontFamily:M.mono, color:M.dn, fontWeight:600}}>US${r.sUsd}</span>
          </span>
        </div>
        {empty ? (
          <div style={{height:18, borderRadius:4, background:M.soft, border:`1px dashed ${M.borderSoft}`}}/>
        ) : (
          <div style={{height:18, borderRadius:4, display:'flex', overflow:'hidden', fontSize:10, fontWeight:700, fontFamily:M.mono, color:'#fff'}}>
            <span style={{
              width:`${r.l}%`, background:M.up,
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              minWidth: r.l < 18 ? 'auto' : 0, paddingLeft: r.l < 18 ? 4 : 0,
            }}>{r.l < 8 ? '' : r.l + '%'}</span>
            <span style={{
              width:`${r.s}%`, background:M.dn,
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              minWidth: r.s < 18 ? 'auto' : 0, paddingRight: r.s < 18 ? 4 : 0,
            }}>{r.s < 8 ? '' : r.s + '%'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenLS() {
  const [coin, setCoin] = React.useState('BTC');
  const [tf, setTf] = React.useState('4小时');
  const [tfOpen, setTfOpen] = React.useState(false);
  const data = LS_DATA[coin] || LS_BTC;

  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus/>
      {window.DataHubHeader ? (
        <window.DataHubHeader current="ls"/>
      ) : (
        <MTopBar title="多空比"/>
      )}

      <div style={{flex:1, overflow:'auto', paddingBottom:100}}>
        {/* coin tabs */}
        <LSCoinTabs value={coin} onChange={setCoin}/>

        {/* page title row with timeframe chip on the right */}
        <div style={{padding:'18px 16px 14px', display:'flex', alignItems:'center', gap:8}}>
          <span style={{fontSize:17, fontWeight:700, color:M.text, letterSpacing:-0.2}}>
            交易所 多空比图表
          </span>
          <span aria-label="说明" style={{
            width:18, height:18, borderRadius:'50%',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            color:M.dim, cursor:'pointer',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 8h.01M11 12h1v5h1"/>
            </svg>
          </span>
          <div style={{flex:1}}/>
          <button onClick={()=>setTfOpen(true)} style={{
            height:30, padding:'0 12px', borderRadius:8,
            border:`1px solid ${tfOpen ? M.violet : M.borderSoft}`,
            background: tfOpen ? M.violetSoft : M.bg,
            color: M.text, fontSize:12, fontWeight:600,
            display:'inline-flex', alignItems:'center', gap:6,
            cursor:'pointer', whiteSpace:'nowrap', fontFamily:M.mono,
          }}>
            <span>{tf}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              style={{transform: tfOpen ? 'rotate(180deg)' : 'none', transition:'transform 160ms'}}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>

        {/* total hero card */}
        <div style={{padding:'0 12px 4px'}}>
          <div style={{
            padding:'14px 14px 12px', borderRadius:14,
            background:M.elev, border:`1px solid ${M.borderSoft}`,
          }}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
              <span style={{
                width:30, height:30, borderRadius:'50%',
                background:'#F7931A', color:'#000',
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:700,
              }}>B</span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:14, fontWeight:700, color:M.text, lineHeight:1.1}}>全部</div>
                <div style={{fontSize:11, color:M.dim, marginTop:2}}>{coin} 总计</div>
              </div>
              <div style={{display:'flex', gap:14, fontSize:11, fontFamily:M.mono}}>
                <div style={{textAlign:'right'}}>
                  <div style={{color:M.dim, fontSize:10}}>做多</div>
                  <div style={{color:M.up, fontWeight:700, marginTop:1}}>US${data.total.longUsd}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{color:M.dim, fontSize:10}}>做空</div>
                  <div style={{color:M.dn, fontWeight:700, marginTop:1}}>US${data.total.shortUsd}</div>
                </div>
              </div>
            </div>
            <div style={{
              height:32, borderRadius:6, display:'flex', overflow:'hidden',
              fontSize:13, fontWeight:700, color:'#fff', fontFamily:M.mono,
            }}>
              <div style={{
                width:`${data.total.longPct}%`, background:M.up,
                display:'inline-flex', alignItems:'center', justifyContent:'center',
              }}>{data.total.longPct.toFixed(2)}%</div>
              <div style={{
                width:`${data.total.shortPct}%`, background:M.dn,
                display:'inline-flex', alignItems:'center', justifyContent:'center',
              }}>{data.total.shortPct.toFixed(2)}%</div>
            </div>
          </div>
        </div>

        {/* exchange section label */}
        <div style={{
          padding:'12px 16px 6px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          fontSize:11, color:M.dim, fontFamily:M.mono,
        }}>
          <span>交易所</span>
          <span>持仓占比 (多 VS 空)</span>
        </div>

        {/* exchange list */}
        <div style={{
          margin:'0 12px 16px',
          borderRadius:12, overflow:'hidden',
          border:`1px solid ${M.borderSoft}`,
        }}>
          {data.rows.map((r, i) => (
            <LSRow key={r.ex} rank={i+1} r={r}/>
          ))}
        </div>
      </div>
      <MTabBar active="market"/>

      {/* ─── 时间周期 — bottom drawer ─── */}
      {tfOpen && (
        <div
          onClick={()=>setTfOpen(false)}
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
              时间周期
            </div>
            <div style={{padding:'0 8px 6px'}}>
              {LS_TFS.map(o => {
                const on = o === tf;
                return (
                  <button
                    key={o}
                    onClick={()=>{ setTf(o); setTfOpen(false); }}
                    style={{
                      display:'flex', alignItems:'center', gap:11,
                      width:'100%', padding:'12px 12px',
                      border:0, background:'transparent', cursor:'pointer',
                      fontFamily:'inherit', textAlign:'left',
                    }}>
                    <span style={{
                      flex:1, fontSize:14, fontWeight:600,
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
                onClick={()=>setTfOpen(false)}
                style={{
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
  const [price, setPrice] = React.useState(74228.30);
  const [trigger, setTrigger] = React.useState(74700);
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
                <span style={{fontSize:11, color:M.dim}}>最新 {fmt(74228.30)}</span>
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
                  {l:'最新', v:74228.30},
                  {l:'买一', v:74225.10},
                  {l:'卖一', v:74229.80},
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
              市价立即成交 · 参考价 <span style={{fontFamily:M.mono, color:M.text, fontWeight:600}}>{fmt(74228.30)}</span> USDT
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

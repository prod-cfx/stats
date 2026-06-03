/* ========================================================================
   SCREEN — 回测设置 (BacktestConfig)
   独立步骤:确认策略 → 回测设置 → 回测中
   ======================================================================== */

function ScreenBacktestConfig() {
  const [range, setRange]       = React.useState('30D');
  const [customStart, setCustomStart] = React.useState('2025-12-01');
  const [customEnd,   setCustomEnd]   = React.useState('2026-05-26');
  const [capital, setCapital]   = React.useState('10000');
  const [market, setMarket]     = React.useState('合约');
  const [lev, setLev]           = React.useState('5x');
  const [slip, setSlip]         = React.useState('5');
  const [fee, setFee]           = React.useState('2');
  const [priceSrc, setPriceSrc] = React.useState('收盘价');
  const [partialOk, setPartialOk] = React.useState('允许');

  return (
    <div style={{height:'100%', display:'flex', flexDirection:'column', background:M.bg}}>
      <MStatus/>
      <MTopBar
        title="回测设置"
        sub="设置如何回测这条策略"
        onBack
        backTo="confirm"
      />

      {/* 5-step indicator — same shape used on every step page */}
      <BtcStepBar active={2} done={[0,1]}/>

      <div style={{flex:1, overflowY:'auto', padding:'12px 16px 100px'}}>
        {/* recap strip — reminds user which strategy they're configuring */}
        <div style={{
          padding:'10px 12px', marginBottom:14, borderRadius:10,
          background:M.violetSoft, color:M.violet,
          display:'flex', gap:10, alignItems:'center',
        }}>
          <Ico d={ICONS.spark} w={14} sw={1.8}/>
          <div style={{fontSize:12, flex:1, lineHeight:1.5}}>
            正在为「<strong style={{fontWeight:600}}>BTC 趋势 · 双均线</strong>」配置回测参数
          </div>
        </div>

        {/* 历史区间 */}
        <BtcSectTitle>历史回测区间</BtcSectTitle>
        <Card p="14px 16px" style={{marginBottom:14}}>
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            {['7D','30D','90D','1Y','自定义'].map(r => {
              const on = r === range;
              return (
                <button key={r} onClick={() => setRange(r)} style={{
                  height:34, padding:'0 14px', borderRadius:999,
                  fontSize:13, fontWeight: on ? 600 : 500, cursor:'pointer',
                  whiteSpace:'nowrap',
                  background: on ? M.violetSoft : M.elev,
                  color: on ? M.violet : M.mid,
                  border:`1px solid ${on ? 'rgba(124,92,255,0.3)' : M.border}`,
                }}>{r}</button>
              );
            })}
          </div>

          {range === '自定义' ? (
            <div style={{marginTop:14}}>
              <div style={{
                display:'grid', gridTemplateColumns:'minmax(0,1fr) 14px minmax(0,1fr)',
                gap:8, alignItems:'flex-end',
              }}>
                <BtcDateField label="起始日期" value={customStart} setValue={setCustomStart}/>
                <span style={{
                  height:42, display:'flex', alignItems:'center', justifyContent:'center',
                  color:M.dim,
                }}>
                  <Ico d="M5 12h14M13 6l6 6-6 6" w={12} sw={1.8}/>
                </span>
                <BtcDateField label="结束日期" value={customEnd} setValue={setCustomEnd}/>
              </div>
              <div style={{
                marginTop:10, padding:'8px 10px', borderRadius:8,
                background:M.soft,
                fontSize:11, color:M.mid, fontFamily:M.mono,
                display:'flex', alignItems:'center', gap:8,
              }}>
                <Ico d={ICONS.shield} w={12} sw={1.8}/>
                <span>
                  <span style={{whiteSpace:'nowrap'}}>共 <strong style={{color:M.text}}>{daysBetween(customStart, customEnd)}</strong> 天</span>
                  {' · '}
                  <span style={{whiteSpace:'nowrap'}}>覆盖 <strong style={{color:M.text}}>{Math.round(daysBetween(customStart, customEnd) * 96)}</strong> 根 15m K 线</span>
                </span>
              </div>
            </div>
          ) : (
            <div style={{
              marginTop:10, fontSize:11, color:M.dim, fontFamily:M.mono,
            }}>
              数据范围:{rangeToText(range)}
            </div>
          )}
        </Card>

        {/* 初始资金 */}
        <BtcSectTitle>初始资金</BtcSectTitle>
        <Card p="14px 16px" style={{marginBottom:14}}>
          <div style={{
            display:'flex', alignItems:'baseline', gap:6,
            borderBottom: `1px solid ${M.borderSoft}`, paddingBottom:10,
            marginBottom:10,
          }}>
            <span style={{fontSize:14, color:M.dim, fontFamily:M.mono}}>$</span>
            <input type="text" value={capital}
              onChange={(e) => setCapital(e.target.value.replace(/[^\d.]/g,''))}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex:1, border:0, outline:0, background:'transparent',
                fontFamily:M.mono, fontSize:26, fontWeight:700, color:M.text,
                padding:0, minWidth:0,
              }}/>
            <span style={{fontSize:13, color:M.dim, fontFamily:M.mono}}>USDT</span>
          </div>
          <div style={{display:'flex', gap:6}}>
            {['1k','5k','10k','50k','100k'].map(p => (
              <button key={p} onClick={() => {
                const m = { '1k':1000, '5k':5000, '10k':10000, '50k':50000, '100k':100000 }[p];
                setCapital(String(m));
              }} style={{
                flex:1, height:28, borderRadius:7, border:0, cursor:'pointer',
                background:M.soft, color:M.mid,
                fontSize:12, fontWeight:600, fontFamily:M.mono,
              }}>{p}</button>
            ))}
          </div>
          <div style={{fontSize:11, color:M.dim, marginTop:8}}>
            模拟资金,仅用于本次回测,不影响实盘
          </div>
        </Card>

        {/* 交易市场 + 杠杆 */}
        <BtcSectTitle>交易市场</BtcSectTitle>
        <Card p="14px 16px" style={{marginBottom:14}}>
          <div style={{
            display:'flex', padding:3, borderRadius:10,
            background:M.soft, border:`1px solid ${M.borderSoft}`, gap:3,
            marginBottom: market === '合约' ? 14 : 0,
          }}>
            {['现货','合约'].map(m => {
              const on = m === market;
              return (
                <button key={m} onClick={() => setMarket(m)} style={{
                  flex:1, height:36, borderRadius:8, border:0, cursor:'pointer',
                  background: on ? M.elev : 'transparent',
                  color: on ? M.violet : M.mid,
                  fontSize:13, fontWeight: on ? 600 : 500,
                  boxShadow: on ? '0 1px 3px rgba(15,22,35,0.06)' : 'none',
                }}>{m}</button>
              );
            })}
          </div>
          {market === '合约' && (
            <>
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                marginBottom:10,
              }}>
                <div>
                  <div style={{fontSize:13, color:M.text, fontWeight:500}}>杠杆倍数</div>
                  <div style={{fontSize:11, color:M.dim, marginTop:2}}>
                    回测会同步放大盈亏与资金占用
                  </div>
                </div>
                <div style={{
                  fontFamily:M.mono, fontSize:20, fontWeight:700, color:M.violet,
                  whiteSpace:'nowrap',
                }}>{lev}</div>
              </div>
              <div style={{
                display:'flex', alignItems:'center', gap:8,
              }}>
                <div style={{
                  display:'flex', alignItems:'center', gap:4,
                  flex:1, height:36, padding:'0 12px', borderRadius:9,
                  background:M.soft, border:`1px solid ${M.borderSoft}`,
                }}>
                  <input type="text" inputMode="numeric"
                    value={lev.replace('x','')}
                    placeholder="自定义"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      let n = e.target.value.replace(/[^\d]/g,'');
                      if (n === '') { setLev('x'); return; }
                      n = Math.min(100, parseInt(n,10));
                      setLev(n + 'x');
                    }}
                    style={{
                      flex:1, border:0, outline:0, background:'transparent',
                      fontFamily:M.mono, fontSize:15, fontWeight:700, color:M.text,
                      padding:0, minWidth:0,
                    }}/>
                  <span style={{fontFamily:M.mono, fontSize:13, color:M.dim}}>x</span>
                </div>
                <div style={{fontSize:11, color:M.dim, whiteSpace:'nowrap'}}>
                  最大 100 倍
                </div>
              </div>
              {(parseInt(lev,10) >= 20) && (
                <div style={{
                  marginTop:10, padding:'8px 10px', borderRadius:8,
                  background:M.warnSoft, color:M.warn,
                  fontSize:11, display:'flex', gap:6, alignItems:'flex-start',
                }}>
                  <Ico d={ICONS.shield} w={12} fill={M.warn} sw={0}/>
                  高杠杆会显著放大爆仓风险,请确认风险承受能力
                </div>
              )}
            </>
          )}
        </Card>

        {/* 撮合参数 */}
        <BtcSectTitle right={<span style={{fontSize:11, color:M.dim}}>影响成交模拟</span>}>
          撮合参数
        </BtcSectTitle>
        <Card p="0" style={{overflow:'hidden', marginBottom:14}}>
          <BtcRow label="滑点" hint="按 bps 模拟下单偏离" right={
            <BtcNumInput value={slip} setValue={setSlip} suffix="bps"/>
          }/>
          <BtcRow label="手续费" hint="单边费率(taker)" right={
            <BtcNumInput value={fee} setValue={setFee} suffix="bps"/>
          }/>
          <BtcRow label="成交价来源" hint="K 线内成交价取值" right={
            <BtcSegPicker value={priceSrc} setValue={setPriceSrc}
              options={['开盘价','收盘价','中间价']}/>
          }/>
          <BtcRow label="数据缺失策略" hint="历史数据有缺口时怎么处理" right={
            <BtcSegPicker value={partialOk} setValue={setPartialOk}
              options={['允许','不允许']}/>
          } last/>
        </Card>

        {/* summary recap */}
        <div style={{
          padding:'12px 14px', borderRadius:12, marginBottom:14,
          background:M.elev, border:`1px solid ${M.border}`,
        }}>
          <div style={{fontSize:11, color:M.dim, marginBottom:8, fontWeight:600}}>本次回测设定</div>
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:12,
          }}>
            <BtcKv k="区间"  v={range === '自定义' ? `${customStart} → ${customEnd}` : range}/>
            <BtcKv k="资金"  v={`$${Number(capital||0).toLocaleString()}`}/>
            <BtcKv k="市场"  v={market === '合约' ? `合约 · ${lev}` : '现货'}/>
            <BtcKv k="撮合"  v={`${slip}/${fee} bps · ${priceSrc}`}/>
            <BtcKv k="数据"  v={partialOk === '允许' ? '允许缺口续跑' : '严格要求完整'}/>
          </div>
        </div>
      </div>

      {/* sticky actions */}
      <div style={{
        position:'absolute', left:0, right:0, bottom:0, zIndex:30,
        padding:'12px 16px 36px',
        background:`linear-gradient(180deg, transparent, ${M.bg} 30%)`,
        display:'flex', gap:10,
      }}>
        <button data-back="confirm" style={{
          flex:1, height:50, borderRadius:14,
          border:`1px solid ${M.border}`, background:M.elev,
          color:M.text, fontSize:14, fontWeight:500, cursor:'pointer',
          whiteSpace:'nowrap',
        }}>上一步</button>
        <button data-go-btrun style={{
          flex:2, height:50, borderRadius:14, border:0,
          background:M.violetGrad, color:'#fff',
          fontSize:14, fontWeight:600, whiteSpace:'nowrap',
          boxShadow:'0 8px 24px rgba(124,92,255,0.32)', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>
          <Ico d={ICONS.play} w={14} fill="#fff" sw={0}/>
          开始回测
        </button>
      </div>
    </div>
  );
}

function rangeToText(r) {
  return {
    '7D':'2026-05-19 → 2026-05-26',
    '30D':'2026-04-26 → 2026-05-26',
    '90D':'2026-02-26 → 2026-05-26',
    '1Y':'2025-05-26 → 2026-05-26',
    '自定义':'选择起止日期',
  }[r] || '';
}

/* ===== 5-step indicator bar — used on confirm / btconfig / btrun / btres / dp =====
   Tab-bar–style with mono numbers, full Chinese labels and an accent underline
   for the active step. Done steps swap their number for a check and are tappable
   (via data-back) so the user can jump back to any completed step. */
function BtcStepBar({ active, done = [] }) {
  const steps = [
    { label: '确认策略', back: 'confirm'  },
    { label: '策略脚本', back: 'script'   },
    { label: '回测设置', back: 'btconfig' },
    { label: '回测',     back: 'btres'    },
    { label: '部署',     back: 'deploy'   },
  ];
  return (
    <div style={{
      background: M.bg,
      padding: '0 8px',
      borderBottom: `1px solid ${M.borderSoft}`,
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
    }}>
      {steps.map((s, i) => (
        <BtcStep key={s.label} n={i+1} label={s.label}
          active={i === active} done={done.includes(i)} back={s.back}/>
      ))}
    </div>
  );
}
function BtcStep({ n, label, active, done, back }) {
  const labelColor =
    active ? M.text :
    done   ? M.mid  :
             M.dim;
  const numColor =
    active || done ? M.violet : M.faint;
  const tappable = done;
  const numStr = `0${n}`;
  return (
    <div
      {...(tappable ? { 'data-back': back } : {})}
      style={{
        padding: '11px 4px 9px',
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        cursor: tappable ? 'pointer' : 'default',
        marginBottom: -1, // overlap container's bottom border so active underline replaces it
        borderBottom: `2px solid ${active ? M.violet : 'transparent'}`,
        minWidth: 0,
      }}>
      <span style={{
        fontFamily: M.mono, fontSize: 10, fontWeight: 600,
        color: numColor, letterSpacing: 0.3,
        height: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {done
          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={M.violet}
                 strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5 9-11"/>
            </svg>
          : numStr}
      </span>
      <span style={{
        fontSize: 11.5, fontWeight: active ? 700 : 500,
        color: labelColor, whiteSpace: 'nowrap',
        letterSpacing: -0.1,
      }}>{label}</span>
    </div>
  );
}

/* ---- small composition helpers ---- */
function BtcSectTitle({ children, right }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'4px 4px 8px', gap:8,
    }}>
      <div style={{fontSize:12, color:M.mid, fontWeight:600, whiteSpace:'nowrap'}}>
        {children}
      </div>
      {right}
    </div>
  );
}
function BtcRow({ label, hint, right, last }) {
  return (
    <div style={{
      padding:'12px 14px',
      borderTop: 'none',
      borderBottom: last ? 0 : `1px solid ${M.borderSoft}`,
      display:'flex', alignItems:'center', gap:12,
    }}>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:13, color:M.text, fontWeight:500}}>{label}</div>
        {hint && <div style={{fontSize:11, color:M.dim, marginTop:2}}>{hint}</div>}
      </div>
      {right}
    </div>
  );
}
function BtcNumInput({ value, setValue, suffix }) {
  return (
    <div style={{
      height:34, padding:'0 10px', borderRadius:8, background:M.soft,
      border:`1px solid ${M.borderSoft}`,
      display:'flex', alignItems:'center', gap:6, minWidth:108,
    }}>
      <input type="text" value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g,''))}
        onClick={(e) => e.stopPropagation()}
        style={{
          width:48, border:0, outline:0, background:'transparent',
          fontFamily:M.mono, fontSize:14, fontWeight:600, color:M.text,
          textAlign:'right', padding:0,
        }}/>
      {suffix && <span style={{fontSize:11, color:M.dim, fontFamily:M.mono}}>{suffix}</span>}
    </div>
  );
}
function BtcSegPicker({ value, setValue, options }) {
  return (
    <div style={{display:'inline-flex', gap:3, padding:2,
      background:M.soft, border:`1px solid ${M.borderSoft}`, borderRadius:8,
    }}>
      {options.map(o => {
        const on = o === value;
        return (
          <button key={o} onClick={() => setValue(o)} style={{
            height:28, padding:'0 8px', borderRadius:6, border:0, cursor:'pointer',
            background: on ? M.elev : 'transparent',
            color: on ? M.violet : M.mid,
            fontSize:11.5, fontWeight: on ? 600 : 500, whiteSpace:'nowrap',
            boxShadow: on ? '0 1px 3px rgba(15,22,35,0.06)' : 'none',
          }}>{o}</button>
        );
      })}
    </div>
  );
}
function BtcKv({ k, v }) {
  return (
    <div style={{
      display:'flex', alignItems:'baseline', gap:8,
    }}>
      <span style={{color:M.dim, fontSize:11}}>{k}</span>
      <span style={{
        color:M.text, fontWeight:600, fontFamily:M.mono, fontSize:12,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1,
      }}>{v}</span>
    </div>
  );
}

function BtcDateField({ label, value, setValue }) {
  return (
    <div style={{minWidth:0}}>
      <div style={{fontSize:10, color:M.dim, marginBottom:5}}>{label}</div>
      <div style={{
        height:42, padding:'0 10px', borderRadius:10,
        background:M.soft, border:`1px solid ${M.borderSoft}`,
        display:'flex', alignItems:'center', minWidth:0,
      }}>
        <input type="date" value={value}
          onChange={(e) => setValue(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex:1, width:'100%', border:0, outline:0, background:'transparent',
            fontFamily:M.mono, fontSize:13, fontWeight:600, color:M.text,
            padding:0, minWidth:0, colorScheme:'light',
          }}/>
      </div>
    </div>
  );
}
function daysBetween(a, b) {
  const da = new Date(a), db = new Date(b);
  if (isNaN(da) || isNaN(db)) return 0;
  return Math.max(0, Math.round((db - da) / (1000 * 60 * 60 * 24)));
}

Object.assign(window, { ScreenBacktestConfig, BtcStepBar });

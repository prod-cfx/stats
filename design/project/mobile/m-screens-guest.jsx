/* Mobile screens — Guest landing (未登录默认页) */

function ScreenGuestLanding() {
  return (
    <div style={{
      height:'100%', position:'relative', display:'flex', flexDirection:'column',
      background: M.bg, overflow:'hidden',
    }}>
      <MStatus/>

      <div style={{flex:1, overflow:'auto', paddingBottom:120}}>
        {/* hero — compact, two-column (text left / preview cluster right) */}
        <div style={{
          position:'relative',
          padding:'82px 18px 28px',
          background: M.elev,
          borderBottom: `1px solid ${M.borderSoft}`,
          overflow:'hidden',
        }}>
          {/* soft tinted background washes — subtle, not loud */}
          <div style={{
            position:'absolute', top:-180, left:-80,
            width:360, height:360, borderRadius:'50%',
            background:'radial-gradient(closest-side, rgba(124,92,255,0.12), transparent 70%)',
            pointerEvents:'none',
          }}/>
          <div style={{
            position:'absolute', top:-40, right:-120,
            width:280, height:280, borderRadius:'50%',
            background:'radial-gradient(closest-side, rgba(6,182,212,0.10), transparent 70%)',
            pointerEvents:'none',
          }}/>

          <div style={{position:'relative', display:'flex', alignItems:'flex-start', gap:10}}>
            {/* left column — title + copy */}
            <div style={{flex:'1 1 0', minWidth:0}}>
              <div style={{
                fontSize:19, fontWeight:700, lineHeight:1.35, letterSpacing:-0.2,
                color: M.text,
              }}>
                小白也能用的
              </div>
              <div style={{
                fontSize:19, fontWeight:700, lineHeight:1.35, letterSpacing:-0.2,
                color: M.text, marginTop:2,
              }}>
                <span style={{
                  background:'linear-gradient(90deg, #A78BFA 0%, #06B6D4 100%)',
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                  backgroundClip:'text', color:'transparent',
                }}>AI 量化</span>
                <span style={{marginLeft:6}}>交易工具</span>
              </div>

              <div style={{
                marginTop:10, fontSize:12, lineHeight:1.65, color: M.mid,
                textWrap:'pretty',
              }}>
                描述你的交易想法,AI 自动生成<br/>策略并帮你完成回测部署。
              </div>

              {/* CTA — under description */}
              <button data-action="guest-cta" style={{
                marginTop:16,
                height:38, padding:'0 22px', borderRadius:999, border:0, cursor:'pointer',
                background: M.violetGrad,
                color:'#fff', fontSize:13, fontWeight:600, fontFamily:'inherit',
                whiteSpace:'nowrap',
                display:'inline-flex', alignItems:'center', gap:6,
                boxShadow:'0 8px 18px -10px rgba(124,92,255,0.55)',
              }}>
                立即体验
                <Ico d={ICONS.caretR} w={12} sw={2.4}/>
              </button>
            </div>

            {/* right column — tilted mini strategy cards (echoes 策略广场 vocabulary) */}
            <div style={{
              position:'relative', width:140, height:130, flexShrink:0, marginTop:-2,
            }}>
              {(() => {
                const STRATS = window.STRATS || [];
                const minis = [
                  { s: STRATS[1], x: 2,  y: 0,  r: -8, z: 1 }, // ETH back
                  { s: STRATS[5], x: 28, y: 16, r:  7, z: 2 }, // BNB mid
                  { s: STRATS[0], x: 14, y: 58, r: -4, z: 3 }, // BTC front
                ];
                return minis.map(({s, x, y, r, z}, i) => {
                  if (!s) return null;
                  const seed = s.seed.slice(-12);
                  const min = Math.min(...seed), max = Math.max(...seed), span = max-min || 1;
                  const W = 84, H = 22;
                  const pts = seed.map((v,j)=>`${(j/(seed.length-1))*W},${H-((v-min)/span)*(H-3)-2}`).join(' ');
                  return (
                    <div key={s.id} style={{
                      position:'absolute', left:x, top:y, zIndex:z,
                      width:96, height:64, borderRadius:10,
                      transform:`rotate(${r}deg)`,
                      background: M.elev,
                      border:`1px solid ${M.borderSoft}`,
                      boxShadow:'0 8px 20px -10px rgba(15,11,34,0.35)',
                      padding:'7px 8px 6px',
                      display:'flex', flexDirection:'column', gap:4,
                      overflow:'hidden',
                    }}>
                      {/* head: avatar + symbol */}
                      <div style={{display:'flex', alignItems:'center', gap:5}}>
                        <div style={{
                          width:16, height:16, borderRadius:'50%',
                          background:s.tone, color:'#fff',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:7.5, fontWeight:700, letterSpacing:0.2, fontFamily:M.mono,
                          flexShrink:0,
                        }}>{s.sym.slice(0,3)}</div>
                        <span style={{
                          fontSize:9, fontWeight:600, color:M.text,
                          fontFamily:M.mono, letterSpacing:0.2,
                        }}>{s.pair.split('/')[0]}</span>
                        <span style={{
                          marginLeft:'auto', fontSize:7.5, fontWeight:700,
                          color: M.up, fontFamily: M.mono,
                        }}>+{s.cagr}%</span>
                      </div>
                      {/* sparkline */}
                      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
                        <polyline points={pts} fill="none" stroke={M.up} strokeWidth="1.4"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

        </div>

        {/* section header */}
        <div style={{padding:'18px 16px 8px', display:'flex', alignItems:'center', gap:8}}>
          <div style={{fontSize:16, fontWeight:700, color:M.text, letterSpacing:-0.2, whiteSpace:'nowrap'}}>
            热门策略
          </div>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:4,
            padding:'2px 7px', borderRadius:4, fontSize:10, fontWeight:600,
            background:M.violetSoft, color:M.violet, fontFamily:M.mono,
          }}>HOT</span>
          <div style={{flex:1}}/>
          <button data-action="guest-cta" style={{
            background:'transparent', border:0, color:M.violet, cursor:'pointer',
            fontSize:12, fontFamily:'inherit', fontWeight:500, whiteSpace:'nowrap',
            display:'inline-flex', alignItems:'center', gap:2, padding:0,
          }}>
            查看全部
            <Ico d={ICONS.caretR} w={11} sw={2.4}/>
          </button>
        </div>

        {/* strategy card list — reuse StratCard from m-screens-2.jsx */}
        <div style={{padding:'4px 16px 0', display:'flex', flexDirection:'column', gap:10}}>
          {(window.STRATS || []).slice(0,3).map(s => (
            <window.StratCard
              key={s.id} s={s}
              starred={true}
              onStar={()=>{}} onOpen={()=>{}}
              onLoad={()=>{ window.__nav?.go('login'); }}
            />
          ))}
        </div>

        {/* sign-up footer */}
        <div style={{padding:'18px 16px 0'}}>
          <div style={{
            padding:'14px 16px', borderRadius:14,
            background: `linear-gradient(135deg, ${M.violetSoft}, transparent)`,
            border:`1px solid rgba(124,92,255,0.20)`,
            display:'flex', alignItems:'center', gap:12,
          }}>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13, fontWeight:600, color:M.text}}>登录解锁完整功能</div>
              <div style={{fontSize:11, color:M.mid, marginTop:3, lineHeight:1.5}}>
                AI 对话生成 · 一键回测 · 实盘部署
              </div>
            </div>
            <button data-action="guest-cta" style={{
              height:34, padding:'0 16px', borderRadius:999, border:0, cursor:'pointer',
              background:M.violetGrad, color:'#fff',
              fontSize:12.5, fontWeight:600, fontFamily:'inherit', whiteSpace:'nowrap',
            }}>登录 / 注册</button>
          </div>
        </div>
      </div>

      <MTabBar active="strat"/>
    </div>
  );
}

Object.assign(window, { ScreenGuestLanding });

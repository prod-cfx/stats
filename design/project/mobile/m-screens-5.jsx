/* Mobile screens part 5 — Theme settings screen.
   Mirrors the web Account → 界面主题 picker. */

function ScreenThemeSettings({ theme = 'light', accent = 'violet' }) {
  const themes = [
    { k:'dark',  label:'暗色',  bg:'#1A1530', fg:'#F5F4FB'},
    { k:'pink',  label:'粉红',  bg:'#FFE4EC', fg:'#2A0F1F'},
    { k:'light', label:'白色',  bg:'#FFFFFF', fg:'#0F1623'},
  ];
  const accents = [
    { k:'violet', label:'粉紫', swatch:'linear-gradient(135deg,#A78BFA 0%,#7C3AED 100%)'},
    { k:'cyan',   label:'青蓝', swatch:'linear-gradient(135deg,#67E8F9 0%,#06B6D4 100%)'},
    { k:'amber',  label:'琥珀', swatch:'linear-gradient(135deg,#FBBF24 0%,#D97706 100%)'},
  ];
  return (
    <div style={{height:'100%', position:'relative', background:M.bg, display:'flex', flexDirection:'column'}}>
      <MStatus dark={theme==='dark'}/>
      <MTopBar
        onBack={()=>{}}
        backTo="me"
        title="界面主题"
        sub="此设置会同步到 Web 和 App"
        right={<div style={{
          width:32, height:32, borderRadius:16, background:M.violetSoft,
          color:M.violet, display:'flex', alignItems:'center', justifyContent:'center',
        }}><Ico d={ICONS.palette} w={18}/></div>}
      />

      <div style={{flex:1, overflow:'auto', padding:'18px 16px 100px'}}>
        {/* preview card */}
        <Card p="0" style={{overflow:'hidden', marginBottom:22}}>
          <div style={{
            padding:'18px 18px 14px', background: M.soft,
            borderBottom:`1px solid ${M.borderSoft}`,
            display:'flex', alignItems:'center', gap:12,
          }}>
            <div style={{
              width:40, height:40, borderRadius:10, background:M.violetSoft, color:M.violet,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}><Ico d={ICONS.bot} w={20}/></div>
            <div>
              <div style={{fontSize:14, fontWeight:700, color:M.text}}>预览 · AI 策略助手</div>
              <div style={{fontSize:11, color:M.dim, marginTop:2, fontFamily:M.mono}}>
                {theme} · {accent}
              </div>
            </div>
          </div>
          <div style={{padding:'14px 16px'}}>
            <div style={{
              padding:'8px 12px', borderRadius:'4px 12px 12px 12px',
              background:M.violetSoft, color:M.violet,
              fontSize:13, display:'inline-block', maxWidth:'90%',
            }}>已识别为「趋势跟踪」策略</div>
            <div style={{marginTop:8, display:'flex', justifyContent:'flex-end'}}>
              <div style={{
                padding:'8px 12px', borderRadius:'12px 12px 4px 12px',
                background:M.violetGrad, color:'var(--accent-on)',
                fontSize:13, maxWidth:'90%',
              }}>开始回测</div>
            </div>
          </div>
        </Card>

        {/* 背景主题 */}
        <div style={{fontSize:13, color:M.mid, fontWeight:500, marginBottom:10}}>背景主题</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:24}}>
          {themes.map(t => {
            const on = t.k === theme;
            return (
              <div key={t.k} data-theme-key={t.k} style={{
                position:'relative', borderRadius:14, padding:'22px 0',
                textAlign:'center', fontSize:14, fontWeight:600,
                background: t.bg, color: t.fg, cursor:'pointer',
                border: on ? `2px solid ${M.violet}` : '2px solid transparent',
                boxShadow: on ? `0 0 0 4px ${M.violetRing}` : (t.k==='light' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'),
              }}>{t.label}</div>
            );
          })}
        </div>

        {/* 强调色 */}
        <div style={{fontSize:13, color:M.mid, fontWeight:500, marginBottom:10}}>强调色</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:24}}>
          {accents.map(a => {
            const on = a.k === accent;
            return (
              <div key={a.k} data-accent-key={a.k} style={{
                borderRadius:14, padding:'18px 0', textAlign:'center',
                background: M.elev, cursor:'pointer',
                border: on ? `2px solid ${M.violet}` : `2px solid ${M.border}`,
                boxShadow: on ? `0 0 0 3px ${M.violetRing}` : 'none',
                display:'flex', flexDirection:'column', alignItems:'center', gap:10,
              }}>
                <div style={{
                  width:32, height:32, borderRadius:16, background: a.swatch,
                  boxShadow:'inset 0 -2px 4px rgba(0,0,0,0.10)',
                }}/>
                <div style={{fontSize:14, fontWeight:600, color:M.text}}>{a.label}</div>
              </div>
            );
          })}
        </div>

        {/* extra prefs */}
        <Card p="0">
          <Row label="自动跟随系统" v="关闭" right={<div style={{
            width:36, height:22, borderRadius:11, background:M.border, position:'relative',
          }}><div style={{
            position:'absolute', left:2, top:2, width:18, height:18, borderRadius:9, background:'#fff',
            boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
          }}/></div>}/>
          <Row label="减少动画" v="" right={<div style={{
            width:36, height:22, borderRadius:11, background:M.violet, position:'relative',
          }}><div style={{
            position:'absolute', right:2, top:2, width:18, height:18, borderRadius:9, background:'#fff',
            boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
          }}/></div>} last/>
        </Card>

        <div style={{
          marginTop:18, padding:'12px 14px', background:M.violetSoft, borderRadius:10,
          display:'flex', gap:10, alignItems:'flex-start',
        }}>
          <Ico d={ICONS.shield} w={16} fill={M.violet} sw={0}/>
          <div style={{fontSize:12, color:M.violet, lineHeight:1.55}}>
            主题在 Web 与 App 之间通过你的账号同步，下次登录会自动应用。
          </div>
        </div>
      </div>

      <MTabBar active="me"/>
    </div>
  );
}

Object.assign(window, { ScreenThemeSettings });

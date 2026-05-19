/* Quantify mobile prototype — wires the existing screens into a single
   interactive device. Bottom tab bar navigates, theme picker is live,
   and a side legend lists every reachable screen. */

const { useState, useEffect, useMemo, useCallback } = React;

/* ---- one place to define the screen graph ---- */
const TAB_SCREENS = [
  { k: 'ai',     label: 'AI 量化',  tab: 'ai',     render: () => <ScreenAIChat/> },
  { k: 'market', label: '行情',     tab: 'market', render: () => <ScreenTickers/> },
  { k: 'strat',  label: '策略',     tab: 'strat',  render: () => <ScreenMarket/> },
  { k: 'whale',  label: '巨鲸',     tab: 'whale',  render: () => <ScreenWhale/> },
  { k: 'me',     label: '我的',     tab: 'me',     render: ({ theme, accent }) => <ScreenAccount/> },
];
const SUB_SCREENS = [
  { k: 'trade', label: '交易详情',   under: 'market', render: () => <ScreenTradingDetail/> },
  { k: 'ls',    label: '多空比',     under: 'market', render: () => <ScreenLS/> },
  { k: 'theme', label: '主题设置',   under: 'me',     render: ({theme,accent}) => <ScreenThemeSettings theme={theme} accent={accent}/> },
  { k: 'login', label: '登录',       under: null,     render: () => <ScreenLogin/> },
];
const ALL = [...TAB_SCREENS, ...SUB_SCREENS];

/* ---- override the bottom tab bar so taps actually navigate ---- */
const OriginalTabBar = window.MTabBar;
window.MTabBar = function NavTabBar({ active = 'ai' }) {
  const tabs = [
    {k:'ai',     label:'AI 量化', icon:ICONS.ai},
    {k:'market', label:'行情',    icon:ICONS.market},
    {k:'strat',  label:'策略',    icon:ICONS.strat},
    {k:'whale',  label:'巨鲸',    icon:ICONS.whale},
    {k:'me',     label:'我的',    icon:ICONS.me},
  ];
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:40,
      paddingBottom:24, background: M.tabBlur,
      backdropFilter:'blur(16px) saturate(180%)',
      WebkitBackdropFilter:'blur(16px) saturate(180%)',
      borderTop:`1px solid ${M.borderSoft}`,
    }}>
      <div style={{display:'flex', justifyContent:'space-around', padding:'8px 4px 0'}}>
        {tabs.map(t => {
          const on = t.k === active;
          return (
            <button key={t.k}
              onClick={() => window.__nav?.go(t.k)}
              style={{
                flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                color: on ? M.violet : M.dim, padding:'6px 0',
                background:'transparent', border:0, cursor:'pointer',
              }}>
              <div style={{
                width:42, height:28, borderRadius:14,
                background: on ? M.violetSoft : 'transparent',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Ico d={t.icon} w={20} sw={on ? 2 : 1.7}/>
              </div>
              <div style={{fontSize:10, fontWeight: on ? 600 : 500, letterSpacing:0.2}}>{t.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ---- main app ---- */
function App() {
  const [screen, setScreen]  = useState('ai');
  const [theme, setTheme]    = useState('light');
  const [accent, setAccent]  = useState('violet');
  const [sheet, setSheet]    = useState(null); // 'config' | 'api' | null

  // expose nav to overridden MTabBar + delegated clicks
  useEffect(() => {
    window.__nav = {
      go: (k) => { setScreen(k); setSheet(null); },
      sheet: setSheet,
      setTheme, setAccent,
    };
  }, []);

  // delegated click handler — patches in clicks for things hardcoded
  // inside the existing screen components (theme picker swatches,
  // 参数 button on chat, API row buttons on account, ticker rows).
  const onDeviceClick = useCallback((e) => {
    const txt = (e.target.closest('button,div,span')?.textContent || '').trim();
    // theme picker swatches (theme settings screen)
    const tk = e.target.closest('[data-theme-key]');
    if (tk) { setTheme(tk.dataset.themeKey); return; }
    const ak = e.target.closest('[data-accent-key]');
    if (ak) { setAccent(ak.dataset.accentKey); return; }
    // 参数 button on AI chat
    if (txt === '参数' && screen === 'ai') { setSheet('config'); return; }
    // "收起" or "确认" on config sheet
    if (sheet === 'config' && (txt === '收起' || txt.startsWith('确认'))) { setSheet(null); return; }
    if (sheet === 'api' && (txt === '取消' || txt.startsWith('验证'))) { setSheet(null); return; }
    if ((sheet === 'buy' || sheet === 'sell') && txt.startsWith('确认')) { setSheet(null); return; }
    if (sheet && e.target.closest('[data-action="close-sheet"]')) { setSheet(null); return; }
    // open buy/sell sheets from trade detail
    if (screen === 'trade' && e.target.closest('[data-action="open-buy"]')) { setSheet('buy'); return; }
    if (screen === 'trade' && e.target.closest('[data-action="open-sell"]')) { setSheet('sell'); return; }
    // API row "连接" / "管理" on account
    if (screen === 'me' && (txt === '连接' || txt === '管理')) { setSheet('api'); return; }
    // ticker rows -> trade detail
    if (screen === 'market' && e.target.closest('[data-ticker-row]')) {
      setScreen('trade'); return;
    }
    // back button on trade detail / theme settings
    if (e.target.closest('[data-back]')) {
      const back = e.target.closest('[data-back]').dataset.back || 'market';
      setScreen(back); return;
    }
    // Account → "主题" row navigates to theme settings
    if (screen === 'me') {
      const row = e.target.closest('div');
      if (row && row.textContent && /^\s*主题/.test(row.textContent.trim().split('\n')[0])
          && row.textContent.length < 30) {
        setScreen('theme'); return;
      }
    }
    // 退出登录 on account
    if (screen === 'me' && txt === '退出登录') { setScreen('login'); return; }
    // 登录 button on login screen
    if (screen === 'login' && txt === '登录') { setScreen('ai'); return; }
    // 游客登录 — explore without an account
    if (screen === 'login' && e.target.closest('[data-guest]')) { setScreen('ai'); return; }
  }, [screen, sheet]);

  const current = ALL.find(s => s.k === screen) || TAB_SCREENS[0];

  return (
    <div className="stage">
      <Legend screen={screen} setScreen={setScreen}
              theme={theme} setTheme={setTheme}
              accent={accent} setAccent={setAccent}
              sheet={sheet} setSheet={setSheet}/>

      <div className="device-wrap">
        <div className="device" data-board data-theme={theme} data-accent={accent}
             onClick={onDeviceClick}>
          <div className="island"/>
          <div style={{ width:'100%', height:'100%', overflow:'hidden', position:'relative' }}>
            {current.render({ theme, accent })}
            {sheet && (
              <div style={{ position:'absolute', inset:0, zIndex:80 }}>
                {sheet === 'config' && <ScreenAIConfig/>}
                {sheet === 'api'    && <ScreenApiConfig/>}
                {sheet === 'buy'    && <ScreenOrderEntry side="buy"/>}
                {sheet === 'sell'   && <ScreenOrderEntry side="sell"/>}
              </div>
            )}
          </div>
          <div className="home"/>
        </div>
        <button className="reset" onClick={() => {
          setScreen('ai'); setSheet(null);
        }}>回到首页</button>
      </div>
    </div>
  );
}

/* ---- Left legend with on-device controls ---- */
function Legend({ screen, setScreen, theme, setTheme, accent, setAccent, sheet, setSheet }) {
  return (
    <div className="legend">
      <h1>Quantify Mobile<br/>可交互原型</h1>
      <p>底部 Tab 直接点击切换。在「我的」里可以打开 API 配置、主题设置；在「行情」里点击币种可进入交易详情。</p>

      <div style={{margin:'18px 0 12px'}}>
        <span className="badge"><span className="dot"/>当前 · {screen}</span>
        {sheet && <span className="badge">弹层 · {sheet}</span>}
      </div>

      <LegendGroup title="主屏 (Tab)">
        {TAB_SCREENS.map(s => (
          <PillBtn key={s.k} on={screen === s.k} onClick={()=>{setScreen(s.k); setSheet(null);}}>
            {s.label}
          </PillBtn>
        ))}
      </LegendGroup>

      <LegendGroup title="次级页面">
        {SUB_SCREENS.map(s => (
          <PillBtn key={s.k} on={screen === s.k} onClick={()=>{setScreen(s.k); setSheet(null);}}>
            {s.label}
          </PillBtn>
        ))}
        <PillBtn on={sheet==='config'} onClick={()=>setSheet(sheet==='config' ? null : 'config')}>回测参数 (弹层)</PillBtn>
        <PillBtn on={sheet==='api'} onClick={()=>setSheet(sheet==='api' ? null : 'api')}>API 验证 (弹层)</PillBtn>
        <PillBtn on={sheet==='buy'} onClick={()=>{setScreen('trade'); setSheet(sheet==='buy' ? null : 'buy');}}>买入下单 (弹层)</PillBtn>
        <PillBtn on={sheet==='sell'} onClick={()=>{setScreen('trade'); setSheet(sheet==='sell' ? null : 'sell');}}>卖出下单 (弹层)</PillBtn>
      </LegendGroup>

      <LegendGroup title="背景主题">
        {['dark','pink','light'].map(t => (
          <SwatchBtn key={t} on={theme===t} onClick={()=>setTheme(t)}
            label={({dark:'暗色',pink:'粉红',light:'白色'})[t]}
            bg={({dark:'#1A1530',pink:'#FFE4EC',light:'#FFFFFF'})[t]}
            fg={({dark:'#F5F4FB',pink:'#2A0F1F',light:'#0F1623'})[t]}
          />
        ))}
      </LegendGroup>

      <LegendGroup title="强调色">
        {[
          {k:'violet', label:'粉紫', swatch:'linear-gradient(135deg,#A78BFA,#7C3AED)'},
          {k:'cyan',   label:'青蓝', swatch:'linear-gradient(135deg,#67E8F9,#06B6D4)'},
          {k:'amber',  label:'琥珀', swatch:'linear-gradient(135deg,#FBBF24,#D97706)'},
        ].map(a => (
          <DotBtn key={a.k} on={accent===a.k} onClick={()=>setAccent(a.k)} label={a.label} swatch={a.swatch}/>
        ))}
      </LegendGroup>

      <div className="tip" style={{marginTop:22}}>
        <b>提示</b> · 任何修改都会立刻反映到设备上。点击「<b>我的 → 界面主题</b>」可以体验完整的设置页面。
      </div>
    </div>
  );
}

function LegendGroup({ title, children }) {
  return (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:11, letterSpacing:0.6, textTransform:'uppercase',
        color:'rgba(255,255,255,0.5)', marginBottom:8, fontWeight:500}}>{title}</div>
      <div style={{display:'flex', flexWrap:'wrap', gap:8}}>{children}</div>
    </div>
  );
}
function PillBtn({ on, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      height:32, padding:'0 12px', borderRadius:999, fontSize:12.5, fontWeight:500,
      background: on ? '#fff' : 'rgba(255,255,255,0.08)',
      color: on ? '#0F0B22' : '#fff',
      border: on ? '0' : '1px solid rgba(255,255,255,0.10)',
      cursor:'pointer',
    }}>{children}</button>
  );
}
function SwatchBtn({ on, onClick, label, bg, fg }) {
  return (
    <button onClick={onClick} style={{
      height:38, padding:'0 16px', borderRadius:10, fontSize:12.5, fontWeight:600,
      background: bg, color: fg, cursor:'pointer',
      border: on ? `2px solid #fff` : '2px solid transparent',
      boxShadow: on ? '0 0 0 3px rgba(255,255,255,0.12)' : '0 1px 2px rgba(0,0,0,0.2)',
    }}>{label}</button>
  );
}
function DotBtn({ on, onClick, label, swatch }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:8,
      height:38, padding:'0 14px 0 6px', borderRadius:999, fontSize:12.5, fontWeight:500,
      background: on ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
      color:'#fff', cursor:'pointer',
      border: on ? '1px solid rgba(255,255,255,0.40)' : '1px solid rgba(255,255,255,0.10)',
    }}>
      <span style={{width:24, height:24, borderRadius:12, background:swatch,
        boxShadow:'inset 0 -1px 3px rgba(0,0,0,0.18)'}}/>
      {label}
    </button>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<App/>);

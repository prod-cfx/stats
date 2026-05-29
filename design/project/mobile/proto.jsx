/* Quantify mobile prototype — wires the existing screens into a single
   interactive device. Bottom tab bar navigates, theme picker is live,
   and a side legend lists every reachable screen. */

const { useState, useEffect, useMemo, useCallback } = React;

/* ---- one place to define the screen graph ---- */
const TAB_SCREENS = [
  { k: 'strat',  label: '策略',     tab: 'strat',  render: () => <ScreenMarket/> },
  { k: 'ai',     label: 'AI 量化',  tab: 'ai',     render: () => <ScreenAIChat/> },
  { k: 'market', label: '数据',     tab: 'market', render: () => <ScreenTickers/> },
  { k: 'whale',  label: '巨鲸',     tab: 'whale',  render: () => <ScreenWhale/> },
  { k: 'me',     label: '我的',     tab: 'me',     render: ({ theme, accent }) => <ScreenAccount/> },
];
const SUB_SCREENS = [
  { k: 'trade', label: '交易详情',   under: 'market', render: () => <ScreenTradingDetail/> },
  { k: 'ls',    label: '多空比',     under: 'market', render: () => <ScreenLS/> },
  { k: 'aggord',  label: '聚合挂单', under: 'market', render: () => <ScreenAggOrders/> },
  { k: 'predict', label: '预测市场', under: 'market', render: () => <ScreenPredMarket/> },
  { k: 'cstock',  label: '币股',     under: 'market', render: () => <ScreenCoinStocks/> },
  { k: 'theme', label: '主题设置',   under: 'me',     render: ({theme,accent}) => <ScreenThemeSettings theme={theme} accent={accent}/> },
  { k: 'guest', label: '游客首页',   under: null,     render: () => <ScreenGuestLanding/> },
  { k: 'confirm', label: '确认策略', under: 'ai',     render: () => <ScreenStratConfirm/> },
  { k: 'script',  label: '策略脚本', under: 'ai',     render: () => <ScreenStratScript/> },
  { k: 'btconfig',label: '回测设置', under: 'ai',     render: () => <ScreenBacktestConfig/> },
  { k: 'btrun',   label: '回测中',   under: 'ai',     render: () => <ScreenBacktestRun/> },
  { k: 'btres',   label: '回测结果', under: 'ai',     render: () => <ScreenBacktestResult/> },
  { k: 'deploy',  label: '部署',     under: 'ai',     render: () => <ScreenDeploy/> },
  { k: 'live',    label: '实盘策略', under: 'me',     render: () => <ScreenLiveStrats/> },
  { k: 'liveDetail', label: '策略详情', under: 'me',  render: () => <ScreenLiveStratDetail/> },
  // ---- 巨鲸 子页 / 弹层 ----
  { k: 'w-discover', label: '发现',           under: 'whale', kind:'whale-tab',  render: () => <ScreenWhale route="discover"/> },
  { k: 'w-live',     label: '实时',           under: 'whale', kind:'whale-tab',  render: () => <ScreenWhale route="live"/> },
  { k: 'w-holdings', label: '持仓',           under: 'whale', kind:'whale-tab',  render: () => <ScreenWhale route="holdings"/> },
  { k: 'w-watch',    label: '监控',           under: 'whale', kind:'whale-tab',  render: () => <ScreenWhale route="watch"/> },
  { k: 'w-profile',  label: '巨鲸详情 (弹层)', under: 'whale', kind:'whale-ov',   render: () => <ScreenWhale route="profile"/> },
  { k: 'w-stats',    label: '交易统计 (弹层)', under: 'whale', kind:'whale-ov',   render: () => <ScreenWhale route="stats"/> },
  { k: 'w-notif',    label: '通知中心 (弹层)', under: 'whale', kind:'whale-ov',   render: () => <ScreenWhale route="notif"/> },
];
const ALL = [...TAB_SCREENS, ...SUB_SCREENS];

/* ---- override the bottom tab bar so taps actually navigate ---- */
const OriginalTabBar = window.MTabBar;
window.MTabBar = function NavTabBar({ active = 'ai' }) {
  const tabs = [
    {k:'strat',  label:'策略',    icon:ICONS.strat},
    {k:'ai',     label:'AI 量化', icon:ICONS.ai},
    {k:'market', label:'数据',    icon:ICONS.market},
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

/* ---- Login as a sheet — slim, form-only ---- */
function LoginSheet({ onClose }) {
  const [sent, setSent] = React.useState(false);
  const [secs, setSecs] = React.useState(0);
  React.useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);
  const sendCode = () => { setSent(true); setSecs(58); };

  return (
    <div
      onClick={onClose}
      style={{
        position:'absolute', inset:0,
        background:'rgba(8,10,20,0.45)', backdropFilter:'blur(2px)',
        display:'flex', alignItems:'flex-end',
      }}
    >
      <div
        onClick={(e)=>e.stopPropagation()}
        style={{
          position:'relative', width:'100%', borderRadius:'20px 20px 0 0',
          background: M.elev, paddingBottom:32,
          boxShadow:'0 -16px 40px -10px rgba(0,0,0,0.32)',
        }}
      >
        {/* drag handle */}
        <div style={{
          margin:'10px auto 0', width:40, height:4, borderRadius:2,
          background:M.borderSoft,
        }}/>

        {/* heading */}
        <div style={{padding:'18px 22px 4px', display:'flex', alignItems:'center', gap:10}}>
          <div style={{
            width:34, height:34, borderRadius:10,
            background: M.violetGrad, color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Ico d={['M4 14l5-5 4 4 7-7','M14 6h6v6']} w={16} sw={2.2}/>
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:18, fontWeight:700, color:M.text, letterSpacing:-0.2}}>登录 Quantify</div>
            <div style={{fontSize:12, color:M.dim, marginTop:2}}>邮箱或 Telegram 继续</div>
          </div>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:16, border:0,
            background:M.soft, color:M.mid, cursor:'pointer', padding:0,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Ico d={ICONS.close} w={14} sw={2.2}/>
          </button>
        </div>

        {/* form */}
        <div style={{padding:'14px 22px 0'}}>
          <window.Field label="邮箱" value="victor@gmail.com"/>
          <div style={{height:10}}/>
          <window.Field
            label="验证码"
            value={sent ? '•••' : ''}
            placeholder="6 位验证码"
            right={
              <button
                onClick={sendCode}
                disabled={secs > 0}
                style={{
                  height:30, padding:'0 12px', borderRadius:8, border:`1px solid ${M.borderSoft}`,
                  background: secs > 0 ? 'transparent' : M.elev,
                  color: secs > 0 ? M.faint : M.violet,
                  fontSize:12, fontWeight:500, fontFamily:M.mono,
                  cursor: secs > 0 ? 'default' : 'pointer', whiteSpace:'nowrap',
                }}
              >{secs > 0 ? `${secs}s 后重发` : (sent ? '重新发送' : '发送验证码')}</button>
            }
          />
        </div>

        {/* primary CTA */}
        <div style={{padding:'18px 22px 0'}}>
          <button style={{
            width:'100%', height:48, borderRadius:12, border:0,
            background: M.violetGrad, color:'#fff', fontSize:15, fontWeight:600,
            boxShadow:'0 8px 20px -6px rgba(124,92,255,0.45)', cursor:'pointer',
            fontFamily:'inherit',
          }}>登录</button>
        </div>

        {/* divider */}
        <div style={{
          padding:'14px 22px 0', display:'flex', alignItems:'center', gap:10,
          color:M.faint, fontSize:11,
        }}>
          <div style={{flex:1, height:1, background:M.borderSoft}}/>
          <span>或</span>
          <div style={{flex:1, height:1, background:M.borderSoft}}/>
        </div>

        {/* secondary CTA */}
        <div style={{padding:'12px 22px 0'}}>
          <button style={{
            width:'100%', height:44, borderRadius:12, border:`1px solid ${M.border}`,
            background:M.elev, fontSize:13.5, fontWeight:500, color:M.text, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            fontFamily:'inherit',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#2AABEE">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.6 8.2-1.9 8.8c-.1.6-.5.8-1 .5l-2.8-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-2.9 5.3-4.8c.2-.2 0-.3-.3-.1L8.5 13.3l-2.9-.9c-.6-.2-.6-.6.1-.9l11.4-4.4c.5-.2 1 .1.5.8z"/>
            </svg>
            通过 Telegram 登录
          </button>
        </div>

        {/* agreement */}
        <div style={{
          padding:'14px 22px 0', textAlign:'center', fontSize:11,
          color:M.dim, lineHeight:1.6,
        }}>
          继续即表示同意 <span style={{color:M.violet}}>服务条款</span> 与 <span style={{color:M.violet}}>隐私政策</span>
        </div>
      </div>
    </div>
  );
}

/* ---- main app ---- */
function App() {
  const [screen, setScreen]  = useState('ai');
  const [theme, setTheme]    = useState('light');
  const [accent, setAccent]  = useState('violet');
  const [sheet, setSheet]    = useState(null); // 'config' | 'api' | null
  const [apiEx, setApiEx]    = useState('Binance'); // which exchange the API sheet configures

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
    if (screen === 'me' && (txt === '连接' || txt === '管理')) {
      const exEl = e.target.closest('[data-ex]');
      setApiEx(exEl ? exEl.dataset.ex : 'Binance');
      setSheet('api'); return;
    }
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
    if (screen === 'me' && txt === '退出登录') { setScreen('guest'); return; }
    // guest CTAs → open login as a sheet
    if (e.target.closest('[data-action="guest-cta"]')) { setSheet('login'); return; }
    // 登录 button inside login sheet → close sheet, jump to AI tab
    if (sheet === 'login' && (txt === '登录' || txt.includes('Telegram'))) { setSheet(null); setScreen('ai'); return; }
    // confirm strategy → script generation (next step)
    if (screen === 'confirm' && e.target.closest('[data-go-script]')) { setScreen('script'); return; }
    // script generated → backtest config
    if (screen === 'script' && e.target.closest('[data-go-btconfig]')) { setScreen('btconfig'); return; }
    // backtest config → start running
    if (screen === 'btconfig' && e.target.closest('[data-go-btrun]')) { setScreen('btrun'); return; }
    // 一键部署到交易所 from backtest result
    if (screen === 'btres' && e.target.closest('[data-go-deploy]')) { setScreen('deploy'); return; }
    // me → 查看实盘策略
    if (screen === 'me' && e.target.closest('[data-go-live]')) { setScreen('live'); return; }
    // deploy success → 查看实盘策略
    if (screen === 'deploy' && e.target.closest('[data-go-live]')) { setScreen('live'); return; }
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
                {sheet === 'api'    && <ScreenApiConfig ex={apiEx}/>}
                {sheet === 'buy'    && <ScreenOrderEntry side="buy"/>}
                {sheet === 'sell'   && <ScreenOrderEntry side="sell"/>}
                {sheet === 'login'  && <LoginSheet onClose={()=>setSheet(null)}/>}
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

/* ---- sheets are grouped by which tab they conceptually belong to ---- */
const TAB_SHEETS = {
  ai:     [{ k:'config', label:'回测参数 (弹层)' }],
  market: [
    { k:'buy',  label:'买入下单 (弹层)', goTo:'trade' },
    { k:'sell', label:'卖出下单 (弹层)', goTo:'trade' },
  ],
  me:     [
    { k:'api',   label:'API 验证 (弹层)' },
    { k:'login', label:'登录 (弹层)' },
  ],
};

/* ---- Left legend with on-device controls ---- */
function Legend({ screen, setScreen, theme, setTheme, accent, setAccent, sheet, setSheet }) {
  // which top-tab "owns" the current screen — used to filter the sub-screen pills
  const filterTab = React.useMemo(() => {
    if (TAB_SCREENS.find(t => t.k === screen)) return screen;
    const sub = SUB_SCREENS.find(s => s.k === screen);
    if (sub && sub.under) return sub.under;
    // fallback by sheet
    for (const [tab, sheets] of Object.entries(TAB_SHEETS)) {
      if (sheets.find(sh => sh.k === sheet)) return tab;
    }
    return 'ai';
  }, [screen, sheet]);

  const currentTab = TAB_SCREENS.find(t => t.k === filterTab);
  const tabLabel = currentTab ? currentTab.label : filterTab;
  const subs   = SUB_SCREENS.filter(s => s.under === filterTab);
  const sheets = TAB_SHEETS[filterTab] || [];
  const goToTab = (k) => { setScreen(k); setSheet(null); };

  return (
    <div className="legend">
      <h1>Quantify Mobile<br/>可交互原型</h1>
      <p>选中顶部 Tab，下方会自动列出该 Tab 下的次级页面与弹层；点击直接跳转。</p>

      <div style={{margin:'18px 0 12px'}}>
        <span className="badge"><span className="dot"/>当前 · {screen}</span>
        {sheet && <span className="badge">弹层 · {sheet}</span>}
      </div>

      <LegendGroup title="主屏 (Tab)">
        {TAB_SCREENS.map(s => (
          <PillBtn key={s.k} on={filterTab === s.k} onClick={()=>goToTab(s.k)}>
            {s.label}
          </PillBtn>
        ))}
      </LegendGroup>

      <LegendGroup title={`${tabLabel} · 次级页面`}>
        {subs.length === 0 && (
          <span style={{
            fontSize:12, color:'rgba(255,255,255,0.4)', padding:'6px 0',
          }}>无次级页面</span>
        )}
        {subs.map(s => (
          <PillBtn key={s.k} on={screen === s.k} onClick={()=>{setScreen(s.k); setSheet(null);}}>
            {s.label}
          </PillBtn>
        ))}
      </LegendGroup>

      {sheets.length > 0 && (
        <LegendGroup title={`${tabLabel} · 弹层`}>
          {sheets.map(sh => (
            <PillBtn key={sh.k} on={sheet === sh.k}
              onClick={() => {
                if (sh.goTo) setScreen(sh.goTo);
                setSheet(sheet === sh.k ? null : sh.k);
              }}>
              {sh.label}
            </PillBtn>
          ))}
        </LegendGroup>
      )}

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

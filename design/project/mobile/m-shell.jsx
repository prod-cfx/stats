/* Shared mobile-app primitives: tokens, top bar, tab bar, small UI bits.
   Tokens reference CSS variables defined in tokens.css — each frame on the
   canvas sets data-theme + data-accent on its wrapper to control the look. */

/* one-time CSS for sheet animations + helpers */
if (typeof document !== 'undefined' && !document.getElementById('m-anim-css')) {
  const s = document.createElement('style');
  s.id = 'm-anim-css';
  s.textContent = `
    @keyframes m-slide-up {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    @keyframes m-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .m-sheet-scrim {
      animation: m-fade-in 240ms ease both;
    }
    .m-sheet {
      animation: m-slide-up 360ms cubic-bezier(.32,.72,0,1) both;
      will-change: transform;
    }
  `;
  document.head.appendChild(s);
}

const M = {
  /* surfaces */
  bg:    'var(--bg)',
  elev:  'var(--bg-elev)',
  soft:  'var(--bg-soft)',
  input: 'var(--bg-input)',
  /* text */
  text:  'var(--text)',
  mid:   'var(--text-mid)',
  dim:   'var(--text-dim)',
  faint: 'var(--text-faint)',
  /* lines */
  border:       'var(--border)',
  borderSoft:   'var(--border-soft)',
  borderStrong: 'var(--border-strong)',
  /* accent (legacy names kept for screen code) */
  violet:     'var(--accent)',
  violet2:    'var(--accent-2)',
  violetGrad: 'var(--accent-grad)',
  violetSoft: 'var(--accent-soft)',
  violetRing: 'var(--accent-ring)',
  /* status */
  ok:        'var(--ok)',
  okSoft:    'var(--ok-soft)',
  warn:      'var(--warn)',
  warnSoft:  'var(--warn-soft)',
  danger:    'var(--danger)',
  dangerSoft:'var(--danger-soft)',
  info:      'var(--info)',
  infoSoft:  'var(--info-soft)',
  /* market */
  up:    'var(--mk-up)',
  dn:    'var(--mk-dn)',
  upSoft:'var(--mk-up-soft)',
  dnSoft:'var(--mk-dn-soft)',
  /* surface meta */
  tabBlur: 'var(--tab-blur)',
  scrim:   'var(--scrim)',
  /* font */
  sans: '"Inter","Noto Sans SC","PingFang SC","Hiragino Sans GB",system-ui,sans-serif',
  mono: '"JetBrains Mono","SFMono-Regular",ui-monospace,monospace',
};

/* --- icons (tiny set we re-use) --- */
const Ico = ({ d, w = 18, sw = 1.6, fill = 'none' }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
    {Array.isArray(d) ? d.map((p,i)=>(<path key={i} d={p}/>)) : <path d={d}/>}
  </svg>
);

const ICONS = {
  bot:    'M5 8h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm7-5v3M8.5 13v1M15.5 13v1',
  send:   'M5 12l14-7-3 16-5-6-6-3z',
  plus:   'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm5.5 12.5L21 21',
  sliders:'M4 6h10M18 6h2M4 12h6M14 12h6M4 18h12M18 18h2M14 6a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM16 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0z',
  bell:   'M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 21a2 2 0 0 0 4 0',
  back:   'M15 18l-6-6 6-6',
  ai:     'M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4L12 2z',
  market: 'M4 19h16M6 16V9M10 16V5M14 16v-6M18 16v-9',
  strat:  'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  whale:  'M3 12c4 0 4-4 8-4s4 4 8 4M3 17c4 0 4-4 8-4s4 4 8 4M16 7a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z',
  me:     'M5 20a7 7 0 0 1 14 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  spark:  'M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z',
  copy:   'M9 9h10v10H9zM5 5h10v2M5 5v10h2',
  caret:  'M6 9l6 6 6-6',
  caretR: 'M9 6l6 6-6 6',
  refresh:'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5',
  more:   'M5 12h.01M12 12h.01M19 12h.01',
  filter: 'M3 7h10.5M18.5 7H21M13.5 7a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M3 17h2.5M10.5 17H21M5.5 17a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
  play:   'M6 4l14 8-14 8V4z',
  shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z',
  star:   'M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 18.1 5.9 21l1.2-6.6L2.4 9.9 9 9z',
  check:  'M5 12l5 5 9-11',
  close:  'M6 6l12 12M6 18L18 6',
  arrowD: 'M12 5v14M6 13l6 6 6-6',
  arrowU: 'M12 19V5M18 11l-6-6-6 6',
  palette:'M12 22a10 10 0 1 1 0-20 8 8 0 0 1 8 8c0 2-1.5 3-3 3h-2a2 2 0 0 0-1 4 2 2 0 0 1-2 5z M6 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm4-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  trash:  'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
};

/* --- iOS status bar (light/dark text) --- */
function MStatus({ dark = false, time = '9:41' }) {
  const c = dark ? '#fff' : '#000';
  return (
    <div style={{
      position:'absolute', top:0, left:0, right:0, zIndex:30, height:54,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'18px 32px 0', pointerEvents:'none',
    }}>
      <span style={{ fontFamily:'-apple-system,SF Pro,system-ui', fontWeight:600,
        fontSize:16, color:c, letterSpacing:-0.2 }}>{time}</span>
      <div style={{display:'flex', gap:6, alignItems:'center'}}>
        <svg width="18" height="11" viewBox="0 0 18 11"><g fill={c}>
          <rect x="0"  y="7"   width="3" height="4" rx="0.7"/>
          <rect x="5"  y="4.5" width="3" height="6.5" rx="0.7"/>
          <rect x="10" y="2"   width="3" height="9" rx="0.7"/>
          <rect x="15" y="0"   width="3" height="11" rx="0.7"/>
        </g></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill={c}>
          <path d="M8 2.7C10.1 2.7 12 3.5 13.4 4.9L14.4 3.9C12.8 2.2 10.5 1.1 8 1.1C5.5 1.1 3.2 2.2 1.6 3.9L2.6 4.9C4 3.5 5.9 2.7 8 2.7Z"/>
          <path d="M8 6.1C9.2 6.1 10.4 6.6 11.2 7.4L12.2 6.4C11 5.3 9.6 4.6 8 4.6C6.4 4.6 5 5.3 3.8 6.4L4.8 7.4C5.6 6.6 6.8 6.1 8 6.1Z"/>
          <circle cx="8" cy="9.6" r="1.4"/>
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={c} strokeOpacity="0.4" fill="none"/>
          <rect x="2" y="2" width="18" height="8" rx="1.6" fill={c}/>
          <path d="M23 4v4c.7-.3 1.3-1.1 1.3-2S23.7 4.3 23 4z" fill={c} fillOpacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}

/* --- top app bar --- */
function MTopBar({ title, sub, left, right, onBack, backTo, transparent, dark, compact, style={} }) {
  return (
    <div style={{
      padding: compact ? '58px 16px 9px' : '62px 16px 12px',
      display:'flex', alignItems:'center', gap:10,
      background: transparent ? 'transparent' : (dark ? '#0F0B22' : M.elev),
      borderBottom: transparent ? 'none' : `1px solid ${dark ? 'rgba(255,255,255,0.06)' : M.borderSoft}`,
      position: 'relative', zIndex:5, ...style,
    }}>
      {onBack && (
        <button onClick={typeof onBack === 'function' ? onBack : undefined} data-back={backTo || 'ai'} style={{
          width:36, height:36, border:0, background:'transparent', cursor:'pointer',
          color: dark ? '#fff' : M.text, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <Ico d={ICONS.back} w={22}/>
        </button>
      )}
      {left}
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize: compact ? 14 : 17, fontWeight:700, letterSpacing:-0.2,
          color: dark ? '#fff' : M.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{title}</div>
        {sub && <div style={{fontSize: compact ? 11 : 12, color: dark ? 'rgba(255,255,255,0.6)' : M.dim, marginTop: compact ? 1 : 2,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* --- bottom tab bar --- */
function MTabBar({ active = 'ai' }) {
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
            <div key={t.k} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              color: on ? M.violet : M.dim, padding:'4px 0',
            }}>
              <div style={{
                width:42, height:28, borderRadius:14,
                background: on ? M.violetSoft : 'transparent',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Ico d={t.icon} w={20} sw={on ? 2 : 1.7}/>
              </div>
              <div style={{fontSize:10, fontWeight: on ? 600 : 500, letterSpacing:0.2}}>{t.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --- chip --- */
function Chip({ tone='neutral', children, style={} }) {
  const tones = {
    neutral: { bg: M.soft,        c: M.mid,   bd: M.border },
    ok:      { bg: M.okSoft,      c: M.ok,    bd: 'transparent' },
    warn:    { bg: M.warnSoft,    c: M.warn,  bd: 'transparent' },
    danger:  { bg: M.dangerSoft,  c: M.danger,bd: 'transparent' },
    info:    { bg: M.infoSoft,    c: M.info,  bd: 'transparent' },
    violet:  { bg: M.violetSoft,  c: M.violet,bd: 'transparent' },
    dark:    { bg: 'var(--text)', c: 'var(--bg-elev)',  bd: 'transparent' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'3px 8px', borderRadius:999, fontSize:11, fontWeight:500,
      background:t.bg, color:t.c, border:`1px solid ${t.bd}`, ...style,
    }}>{children}</span>
  );
}

/* --- avatar with initials --- */
function Av({ sym, bg='#F7931A', size=32, mono=false }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:size/2, background:bg, color:'#fff',
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      fontWeight:700, fontSize: Math.round(size*0.42), fontFamily: mono ? M.mono : M.sans,
      flexShrink:0,
    }}>{sym}</div>
  );
}

/* --- card surface --- */
function Card({ children, p='16px', style={} }) {
  return (
    <div style={{
      background: M.elev, border:`1px solid ${M.border}`, borderRadius:14,
      padding: p, ...style,
    }}>{children}</div>
  );
}

/* --- shared full-screen search overlay (行情数据 style) ---
   Pill input + 取消, 热门 chips, 搜索历史 chips with clear.
   props:
     open, onClose, placeholder, hotLabel, hot:[str], onPick(value),
     renderResults(query, pick) -> array of nodes (empty -> emptyText),
     emptyText
*/
function SearchOverlay({ open, onClose, placeholder='搜索', hotLabel='热门币种', hot=[], onPick, renderResults, emptyText='无匹配结果' }) {
  const [query, setQuery] = React.useState('');
  const [history, setHistory] = React.useState(() => hot.slice(0, 3));
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (open) { setQuery(''); setTimeout(() => inputRef.current && inputRef.current.focus(), 0); }
  }, [open]);
  if (!open) return null;
  const q = query.trim();
  const pick = (val) => {
    setHistory(h => [val, ...h.filter(x => x !== val)].slice(0, 12));
    onPick && onPick(val);
    onClose && onClose();
  };
  const results = q && renderResults ? renderResults(q, pick) : [];
  const chipStyle = {
    minWidth:62, padding:'7px 16px', borderRadius:999, border:0,
    background:M.violetSoft, color:M.text, cursor:'pointer',
    fontSize:13, fontWeight:500, fontFamily:M.sans,
  };
  return (
    <div style={{ position:'absolute', inset:0, zIndex:80, background:M.bg, display:'flex', flexDirection:'column' }}>
      <MStatus/>
      {/* input row */}
      <div style={{ padding:'62px 16px 8px', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{
          flex:1, height:38, background:M.soft, borderRadius:999,
          padding:'0 14px', display:'flex', alignItems:'center', gap:8,
        }}>
          <Ico d={ICONS.search} w={16} sw={1.8}/>
          <input
            ref={inputRef}
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder={placeholder}
            style={{ flex:1, border:0, outline:'none', background:'transparent', fontSize:13, color:M.text, fontFamily:M.sans }}
          />
          {query && (
            <button onClick={()=>{ setQuery(''); inputRef.current && inputRef.current.focus(); }} style={{
              border:0, background:M.border, color:M.bg, cursor:'pointer',
              width:16, height:16, borderRadius:8, padding:0, fontSize:11, lineHeight:1,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>×</button>
          )}
        </div>
        <button onClick={onClose} style={{
          border:0, background:'transparent', color:M.mid, cursor:'pointer',
          fontSize:13, fontWeight:500, fontFamily:M.sans, padding:'0 2px',
        }}>取消</button>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'8px 16px 24px' }}>
        {q ? (
          results && results.length ? results : (
            <div style={{ padding:'44px 16px', textAlign:'center', color:M.dim, fontSize:13 }}>{emptyText}</div>
          )
        ) : (
          <React.Fragment>
            {hot.length > 0 && (
              <React.Fragment>
                <div style={{ fontSize:14, fontWeight:600, color:M.text, margin:'8px 0 12px' }}>{hotLabel}</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'10px 10px' }}>
                  {hot.map(c => <button key={c} onClick={()=>pick(c)} style={chipStyle}>{c}</button>)}
                </div>
              </React.Fragment>
            )}
            {history.length > 0 && (
              <React.Fragment>
                <div style={{ display:'flex', alignItems:'center', margin:'26px 0 12px' }}>
                  <div style={{ flex:1, fontSize:14, fontWeight:600, color:M.text }}>搜索历史</div>
                  <button aria-label="清空搜索历史" onClick={()=>setHistory([])} style={{
                    border:0, background:'transparent', color:M.dim, cursor:'pointer',
                    padding:4, display:'flex', alignItems:'center',
                  }}>
                    <Ico d={ICONS.trash} w={16} sw={1.7}/>
                  </button>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'10px 10px' }}>
                  {history.map(c => <button key={c} onClick={()=>pick(c)} style={chipStyle}>{c}</button>)}
                </div>
              </React.Fragment>
            )}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

/* --- shared search result row (avatar + title + sub + right) --- */
function SearchResultRow({ letter, color='#7C5CFF', title, sub, right, onClick }) {
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:10, padding:'10px 4px',
      borderBottom:`1px solid ${M.borderSoft}`, cursor:'pointer',
    }}>
      <Av sym={letter} bg={color} size={28}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:600, color:M.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {title}{sub && <span style={{ fontSize:11, color:M.dim, marginLeft:5, fontWeight:500 }}>{sub}</span>}
        </div>
      </div>
      {right != null && <div style={{ fontFamily:M.mono, fontSize:13, fontWeight:600, color:M.text }}>{right}</div>}
    </div>
  );
}

/* --- segmented control (pill chips) --- */
function Seg({ options, value, size='sm', style={} }) {
  const px = size === 'md' ? 14 : 10;
  const h = size === 'md' ? 32 : 28;
  return (
    <div style={{display:'inline-flex', gap:6, ...style}}>
      {options.map(o => {
        const on = o === value;
        return (
          <span key={o} style={{
            height:h, padding:`0 ${px}px`, borderRadius:999, fontSize:12, fontWeight:500,
            display:'inline-flex', alignItems:'center',
            background: on ? M.violetSoft : M.elev,
            color: on ? M.violet : M.mid,
            border: `1px solid ${on ? 'rgba(124,92,255,0.25)' : M.border}`,
          }}>{o}</span>
        );
      })}
    </div>
  );
}

/* expose */
Object.assign(window, { M, Ico, ICONS, MStatus, MTopBar, MTabBar, Chip, Av, Card, Seg, SearchOverlay, SearchResultRow });

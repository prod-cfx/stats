/* Whale Discover — aligned to PC /zh/whale-tracking/discover
   Components exposed on window:
     - WhaleDiscoverNew      — list page (replaces old 发现 tab)
     - WhaleProfileDetail    — address detail (clicked address)
     - WhaleTradeStats       — trade-stats modal (long-press / stats icon)
*/

/* ============= data: 10 whales matching PC seed ============= */
const WHALE_PROFILES = [
  { id:'0x8ba1...ba72', av:'8B', avBg:'#A78BFA', tier:'$100M+ HYPERUNIT WHALE',
    av_text:'#fff', av_kind:'tier',
    aum:'$1.29亿', aumN:129_000_000,
    pnl:'+$1028万', pnlN:10280000, pnlPos:true,
    trades:42, pos:9, win:73.81,
    tags:['金库管家','多头战神','波段之王'] },
  { id:'0x742d...f44e', av:'74', avBg:'#5EEAD4', avText:'#0F172A', tier:'$10M+ HYPERUNIT WHALE',
    aum:'$8675万', aumN:86_750_000,
    pnl:'+$694万', pnlN:6940000, pnlPos:true,
    trades:28, pos:7, win:64.29,
    tags:['金库管家','多头战神','波段之王'] },
  { id:'0x66f8...2054', av:'66', avBg:'#C7D2FE', avText:'#3730A3', tier:'$10M+ HYPERUNIT WHALE',
    aum:'$5420万', aumN:54_200_000,
    pnl:'-$433.6万', pnlN:-4336000, pnlPos:false,
    trades:19, pos:6, win:47.37,
    tags:['金库管家','聪明交易者','波段之王'] },
  { id:'0x2810...cb16',
    aum:'$3240万', aumN:32_400_000,
    pnl:'+$259.2万', pnlN:2592000, pnlPos:true,
    trades:18, pos:5, win:73.33,
    tags:['金库管家','多头战神','波段之王'] },
  { id:'0xd551...92ff',
    aum:'$425万', aumN:4_250_000,
    pnl:'+$34万', pnlN:340000, pnlPos:true,
    trades:9, pos:2, win:66.67,
    tags:['多头战神'] },
  { id:'0xfe9e...51c8',
    aum:'$1580万', aumN:15_800_000,
    pnl:'+$126.4万', pnlN:1264000, pnlPos:true,
    trades:14, pos:4, win:60,
    tags:['多头战神'] },
  { id:'0x53d2...8a3d',
    aum:'$2105万', aumN:21_050_000,
    pnl:'+$168.4万', pnlN:1684000, pnlPos:true,
    trades:15, pos:5, win:58.33,
    tags:['金库管家','波段之王'] },
  { id:'0x1151...e30f',
    aum:'$675万', aumN:6_750_000,
    pnl:'+$54万', pnlN:540000, pnlPos:true,
    trades:11, pos:3, win:57.14,
    tags:[] },
  { id:'0xbe0e...33e8',
    aum:'$1125万', aumN:11_250_000,
    pnl:'+$90万', pnlN:900000, pnlPos:true,
    trades:12, pos:4, win:55.56,
    tags:[] },
  { id:'0x267b...fdc0',
    aum:'$890万', aumN:8_900_000,
    pnl:'-$71.2万', pnlN:-712000, pnlPos:false,
    trades:8, pos:3, win:37.5,
    tags:['聪明交易者'] },
];

/* ============= AI tag chips (palette from PC) ============= */
const AI_TAG_COLOR = {
  '金库管家':   { fg:'#92400E', bg:'#FEF3C7' },
  '多头战神':   { fg:'#1E40AF', bg:'#DBEAFE' },
  '波段之王':   { fg:'#6D28D9', bg:'#EDE9FE' },
  '聪明交易者': { fg:'#92400E', bg:'#FEF3C7' },
};
function AITagChip({ t }) {
  const c = AI_TAG_COLOR[t] || { fg:M.mid, bg:M.soft };
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:3,
      padding:'2px 7px', borderRadius:4, fontSize:10.5, fontWeight:500,
      color:c.fg, background:c.bg, whiteSpace:'nowrap', lineHeight:1.5,
    }}>
      {t}
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{opacity:0.55}}>
        <circle cx="12" cy="12" r="9" stroke={c.fg} strokeWidth="2"/>
        <path d="M12 8v5M12 16v.5" stroke={c.fg} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </span>
  );
}

/* ============= icons inline (just for this file) ============= */
const ICO_COPY    = 'M9 3h9a2 2 0 0 1 2 2v9M6 7h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z';
const ICO_TREND   = 'M4 17l6-6 4 4 6-6M20 9V5h-4';
const ICO_CHEV_D  = 'M6 9l6 6 6-6';
const ICO_CHEV_U  = 'M18 15l-6-6-6 6';
const ICO_SORTUD  = 'M8 4v12M8 16l-3-3M8 16l3-3M16 20V8M16 8l-3 3M16 8l3 3';
const ICO_FILTER  = 'M3 5h18l-7 8v5l-4 2v-7z';
const ICO_X       = 'M6 6l12 12M18 6L6 18';
const ICO_REFRESH = 'M3 12a9 9 0 0 1 15-6.7l3-3M3 12v-6M3 12l3 3M21 12a9 9 0 0 1-15 6.7l-3 3M21 12v6M21 12l-3-3';
const ICO_BELL_R  = 'M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 19a2 2 0 0 0 4 0';
const ICO_ARROWBK = 'M19 12H5M5 12l7-7M5 12l7 7';

/* ============= small UI atoms ============= */
function WhaleAvatar({ w, size=44 }) {
  if (w.av) {
    return (
      <div style={{
        width:size, height:size, borderRadius:'50%', flexShrink:0,
        background:w.avBg, color:w.avText || '#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize: size>=44?14:12, fontWeight:700, fontFamily:M.mono, letterSpacing:0.5,
      }}>{w.av}</div>
    );
  }
  // fallback: derived hue
  const hash = w.id.split('').reduce((a,c)=>a + c.charCodeAt(0), 0);
  const hue = (hash * 17) % 360;
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:`oklch(0.76 0.13 ${hue})`,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <svg width={size*0.5} height={size*0.5} viewBox="0 0 24 24" fill="#fff" opacity="0.95">
        <path d="M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zm0 10c4.4 0 8 1.8 8 4v2H4v-2c0-2.2 3.6-4 8-4z"/>
      </svg>
    </div>
  );
}

function CopyBtn({ text, onCopy }) {
  return (
    <button onClick={(e)=>{e.stopPropagation(); onCopy && onCopy(text);}} style={{
      width:18, height:18, padding:0, border:0, background:'transparent', cursor:'pointer',
      color: M.dim, display:'inline-flex', alignItems:'center', justifyContent:'center',
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={ICO_COPY}/>
      </svg>
    </button>
  );
}

function TrendBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      width:32, height:32, borderRadius:8, padding:0,
      border:`1px solid ${M.borderSoft}`, background:M.elev, cursor:'pointer',
      color:M.violet, display:'inline-flex', alignItems:'center', justifyContent:'center',
      flexShrink:0,
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={ICO_TREND}/>
      </svg>
    </button>
  );
}

/* ============= top-3 slideshow — one card at a time + dot pager ============= */
function WhaleTopSlideshow({ top3, onOpen, onStats, onCopy }) {
  const scrollerRef = React.useRef(null);
  const [idx, setIdx] = React.useState(0);
  // pointer drag state
  const drag = React.useRef({ active:false, startX:0, startLeft:0, lastX:0, moved:false });

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(i);
  };

  const goTo = (i) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  // autoplay (pause while hovering / touching / dragging)
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      const el = scrollerRef.current;
      if (!el || drag.current.active) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % top3.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, 4500);
    return () => clearInterval(t);
  }, [paused, top3.length]);

  // pointer drag handlers — enable mouse swipe on desktop;
  // touch already works natively via overflow scroll
  const onPointerDown = (e) => {
    // only enable for mouse / pen — let native touch scrolling do its thing
    if (e.pointerType === 'touch') return;
    const el = scrollerRef.current;
    if (!el) return;
    drag.current = {
      active:true,
      startX:e.clientX,
      startLeft:el.scrollLeft,
      lastX:e.clientX,
      moved:false,
    };
    el.setPointerCapture?.(e.pointerId);
    el.style.scrollSnapType = 'none'; // disable snap during drag
    el.style.cursor = 'grabbing';
  };
  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    drag.current.lastX = e.clientX;
    el.scrollLeft = drag.current.startLeft - dx;
  };
  const onPointerEnd = (e) => {
    if (!drag.current.active) return;
    const el = scrollerRef.current;
    drag.current.active = false;
    if (!el) return;
    el.style.cursor = '';
    // decide target slide: by drag distance threshold (>25% of width = next)
    const w = el.clientWidth;
    const dx = drag.current.lastX - drag.current.startX;
    const current = Math.round(drag.current.startLeft / w);
    let target = current;
    if (Math.abs(dx) > w * 0.18) target = current + (dx < 0 ? 1 : -1);
    target = Math.max(0, Math.min(top3.length - 1, target));
    el.style.scrollSnapType = 'x mandatory';
    el.scrollTo({ left: target * w, behavior: 'smooth' });
    // swallow the click that immediately follows a drag
    if (drag.current.moved) {
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener('click', swallow, { capture:true, once:true });
    }
  };

  return (
    <div style={{padding:'10px 0 6px'}}
      onMouseEnter={()=>setPaused(true)}
      onMouseLeave={()=>setPaused(false)}
      onTouchStart={()=>setPaused(true)}
    >
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="wd-noscrollbar"
        style={{
          display:'flex',
          overflowX:'auto',
          scrollSnapType:'x mandatory',
          scrollbarWidth:'none',
          WebkitOverflowScrolling:'touch',
          cursor:'grab',
          userSelect:'none',
        }}
      >
        {top3.map((w, i) => (
          <div key={w.id} style={{
            flex:'0 0 100%',
            scrollSnapAlign:'center',
            padding:'0 16px',
            boxSizing:'border-box',
          }}>
            <WhaleTopCard w={w} onOpen={onOpen} onStats={onStats} onCopy={onCopy}/>
          </div>
        ))}
      </div>

      {/* dot pager */}
      <div style={{
        display:'flex', justifyContent:'center', alignItems:'center', gap:6,
        marginTop:10,
      }}>
        {top3.map((_, i) => {
          const active = i === idx;
          return (
            <button
              key={i}
              onClick={()=>goTo(i)}
              aria-label={`第 ${i+1} 张`}
              style={{
                width: active ? 18 : 6, height:6,
                padding:0, border:0, cursor:'pointer',
                borderRadius:999,
                background: active ? M.text : M.borderSoft,
                transition:'width 220ms ease, background 220ms ease',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ============= top-3 highlight card — premium hero variant ============= */
function WhaleTopCard({ w, onOpen, onStats, onCopy }) {
  const tint = w.avBg || '#7C5CFF';
  // split tier into amount + label so the typography can carry hierarchy
  const tierMatch = /^(\$[\d.]+[A-Z]?\+?)\s+(.+)$/.exec(w.tier || '');
  const tierAmt   = tierMatch ? tierMatch[1] : w.tier;
  const tierWord  = tierMatch ? tierMatch[2] : '';
  return (
    <div
      onClick={()=>onStats(w)}
      role="button"
      tabIndex={0}
      onKeyDown={(e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); onStats(w); } }}
      style={{
        width:'100%', flexShrink:0, boxSizing:'border-box',
        background: `linear-gradient(155deg, ${tint}1c 0%, ${tint}05 40%, ${M.elev} 78%)`,
        border:`1px solid ${tint}33`,
        borderRadius:14,
        padding:'10px 12px 8px',
        position:'relative',
        overflow:'hidden',
        boxShadow:`0 6px 16px -12px ${tint}55`,
        cursor:'pointer',
      }}
    >
      {/* head: avatar + (tier above address) + trend */}
      <div style={{display:'flex', alignItems:'center', gap:9, marginBottom:8}}>
        <WhaleAvatar w={w} size={32}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:5, marginBottom:1}}>
            <button onClick={(e)=>{e.stopPropagation(); onOpen(w);}} style={{
              padding:'2px 4px', border:0, background:'transparent', cursor:'pointer',
              fontSize:13, fontWeight:600, color:M.violet, fontFamily:M.mono, letterSpacing:-0.2,
              borderBottom:`1px dashed ${M.violet}66`,
              display:'inline-flex', alignItems:'center', gap:3,
              borderRadius:0,
            }}>
              <span>{w.id}</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.7}}>
                <path d="M9 6l6 6-6 6"/>
              </svg>
            </button>
            <CopyBtn text={w.id} onCopy={onCopy}/>
          </div>
          <div style={{
            display:'flex', alignItems:'center', gap:5,
            fontFamily:M.mono,
          }}>
            <span style={{
              width:4, height:4, borderRadius:'50%', background:tint,
              boxShadow:`0 0 6px ${tint}`, flexShrink:0,
            }}/>
            <span style={{fontSize:9, fontWeight:700, color:tint, letterSpacing:0.4}}>{tierAmt}</span>
            <span style={{fontSize:8.5, fontWeight:600, color:M.mid, letterSpacing:0.6}}>{tierWord}</span>
          </div>
        </div>
        <TrendBtn onClick={(e)=>{e.stopPropagation(); onStats(w);}}/>
      </div>

      {/* hero AUM — label + pnl chip on header line, number below */}
      <div style={{marginBottom:8}}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:1,
        }}>
          <span style={{fontSize:9.5, color:M.dim, letterSpacing:0.4}}>账户总价值</span>
          <span style={{
            display:'inline-flex', alignItems:'center',
            padding:'1px 5px', borderRadius:4,
            fontSize:10, fontWeight:600, fontFamily:M.mono, whiteSpace:'nowrap',
            color: w.pnlPos ? M.up : M.dn,
            background: w.pnlPos ? `${M.up}1a` : `${M.dn}1a`,
          }}>{w.pnl}</span>
        </div>
        <div style={{
          fontSize:17, fontWeight:700, color:M.text, fontFamily:M.mono,
          letterSpacing:-0.4, lineHeight:1.05, whiteSpace:'nowrap',
        }}>{w.aum}</div>
      </div>

      {/* mini stats */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'3px 4px',
      }}>
        <MiniStatTop label="交易" v={w.trades} align="left"/>
        <MiniStatTop label="胜率" v={`${w.win}%`} tone={w.win >= 60 ? 'up' : null} align="center"/>
        <MiniStatTop label="持仓" v={w.pos} align="right"/>
      </div>
    </div>
  );
}

function MiniStatTop({ label, v, tone, align = 'center' }) {
  const c = tone === 'up' ? M.up : tone === 'dn' ? M.dn : M.text;
  return (
    <div style={{flex:1, textAlign:align}}>
      <div style={{fontSize:9, color:M.dim}}>{label}</div>
      <div style={{fontSize:12, fontWeight:700, color:c, fontFamily:M.mono, marginTop:1, letterSpacing:-0.2}}>{v}</div>
    </div>
  );
}

/* ============= regular list card (matches PC grid card) ============= */
function WhaleListCard({ w, onOpen, onStats, onCopy }) {
  return (
    <div
      onClick={()=>onStats(w)}
      role="button"
      tabIndex={0}
      onKeyDown={(e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); onStats(w); } }}
      style={{
        background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:12,
        padding:'14px', cursor:'pointer',
        transition:'border-color .15s ease, transform .15s ease',
      }}
      onMouseEnter={(e)=>e.currentTarget.style.borderColor = M.border}
      onMouseLeave={(e)=>e.currentTarget.style.borderColor = M.borderSoft}
    >
      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
        <button onClick={(e)=>{e.stopPropagation(); onOpen(w);}} style={{
          padding:'2px 4px', border:0, background:'transparent', cursor:'pointer',
          fontSize:14, fontWeight:600, color:M.violet, fontFamily:M.mono,
          borderBottom:`1px dashed ${M.violet}66`,
          display:'inline-flex', alignItems:'center', gap:3,
          borderRadius:0,
        }}>
          <span>{w.id}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.7}}>
            <path d="M9 6l6 6-6 6"/>
          </svg>
        </button>
        <CopyBtn text={w.id} onCopy={onCopy}/>
        <div style={{flex:1}}/>
        <TrendBtn onClick={(e)=>{e.stopPropagation(); onStats(w);}}/>
      </div>

      <div style={{marginBottom:12}}>
        <div style={{fontSize:11, color:M.dim}}>账户总价值</div>
        <div style={{fontSize:17, fontWeight:700, color:M.text, fontFamily:M.mono, marginTop:2, letterSpacing:-0.3}}>{w.aum}</div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12}}>
        <div style={{textAlign:'left'}}>
          <div style={{fontSize:10, color:M.dim}}>已实现盈亏(1月)</div>
          <div style={{fontSize:13, fontWeight:700, fontFamily:M.mono, marginTop:3,
            color: w.pnlPos ? M.up : M.dn}}>{w.pnl}</div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:10, color:M.dim}}>当前持仓</div>
          <div style={{fontSize:13, fontWeight:600, color:M.text, fontFamily:M.mono, marginTop:3}}>{w.pos}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:10, color:M.dim}}>胜率(1月)</div>
          <div style={{fontSize:13, fontWeight:600, color:M.text, fontFamily:M.mono, marginTop:3}}>{w.win}%</div>
        </div>
      </div>

      <div style={{
        display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
        paddingTop:10, borderTop:`1px solid ${M.borderSoft}`,
      }}>
        <span style={{fontSize:11, color:M.dim, marginRight:2}}>AI标签:</span>
        {w.tags.length === 0
          ? <span style={{fontSize:11, color:M.faint}}>—</span>
          : w.tags.map(t => <AITagChip key={t} t={t}/>)
        }
      </div>
    </div>
  );
}

/* ============= sort bar (chip group) ============= */
// sort shape: { key: string, dir: 'desc' | 'asc' } | null
function SortBar({ sort, onSort }) {
  const opts = [
    { k:'win', label:'胜率' },
    { k:'aum', label:'账户总价值' },
    { k:'pnl', label:'已实现盈亏' },
  ];

  const handleClick = (k) => {
    if (!sort || sort.key !== k) {
      // 新字段 → desc
      onSort({ key: k, dir: 'desc' });
    } else if (sort.dir === 'desc') {
      // desc → asc
      onSort({ key: k, dir: 'asc' });
    } else {
      // asc → null（不排序）
      onSort(null);
    }
  };

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
      padding:'12px 16px 12px', overflowX:'auto',
    }}>
      <span style={{fontSize:12, color:M.mid, flexShrink:0, whiteSpace:'nowrap'}}>排序方式:</span>
      {opts.map(o => {
        const active = sort && sort.key === o.k;
        const dir = active ? sort.dir : null;
        // 激活态药丸为紫色底白字 → 用白色系；未激活 → 用 faint 灰
        const upCol   = active ? (dir==='asc'  ? '#fff' : 'rgba(255,255,255,0.4)') : M.faint;
        const downCol = active ? (dir==='desc' ? '#fff' : 'rgba(255,255,255,0.4)') : M.faint;
        return (
          <button key={o.k} onClick={()=>handleClick(o.k)} style={{
            height:28, padding:'0 12px', borderRadius:999, border:0, cursor:'pointer',
            background: active ? M.violetGrad : 'transparent',
            color: active ? '#fff' : M.mid,
            fontSize:12, fontWeight: active?600:500, fontFamily:'inherit',
            display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap', flexShrink:0,
          }}>
            {o.label}
            <span style={{display:'inline-flex', flexDirection:'column', lineHeight:0, gap:2}}>
              <svg width="7" height="4" viewBox="0 0 8 5" fill={upCol} style={{display:'block'}}>
                <path d="M4 0l4 5H0z"/>
              </svg>
              <svg width="7" height="4" viewBox="0 0 8 5" fill={downCol} style={{display:'block'}}>
                <path d="M4 5L0 0h8z"/>
              </svg>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============= main: 发现 ============= */
function WhaleDiscoverNew() {
  const [sort, setSort] = React.useState({ key:'win', dir:'desc' });
  const [openId, setOpenId] = React.useState(null);
  const [statsId, setStatsId] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  const onCopy = (text) => {
    try { navigator.clipboard?.writeText(text); } catch(e){}
    setToast('地址已复制');
    setTimeout(()=>setToast(null), 1400);
  };

  const sorted = React.useMemo(() => {
    const arr = WHALE_PROFILES.slice();
    if (!sort) return arr;                         // null → 不排序，保持原顺序
    const mul = sort.dir === 'asc' ? 1 : -1;       // desc: 大→小; asc: 小→大
    if (sort.key === 'win') arr.sort((a,b) => mul * (a.win  - b.win));
    if (sort.key === 'aum') arr.sort((a,b) => mul * (a.aumN - b.aumN));
    if (sort.key === 'pnl') arr.sort((a,b) => mul * (a.pnlN - b.pnlN));
    return arr;
  }, [sort]);

  // top 3 always the avatar-badge whales
  const top3 = WHALE_PROFILES.filter(w => w.av);
  const rest = sorted.filter(w => !top3.includes(w));

  const openWhale = (w) => setOpenId(w.id);
  const openStats = (w) => setStatsId(w.id);

  const profile = WHALE_PROFILES.find(w => w.id === openId);
  const statsW  = WHALE_PROFILES.find(w => w.id === statsId);

  return (
    <React.Fragment>
      {/* subtitle */}
      <div style={{padding:'14px 16px 0', background:M.bg}}>
        <div style={{fontSize:12.5, color:M.mid}}>发现最有价值的交易者</div>
      </div>

      {/* top 3 slideshow */}
      <WhaleTopSlideshow top3={top3} onOpen={openWhale} onStats={openStats} onCopy={onCopy}/>

      {/* divider */}
      <div style={{height:1, background:M.borderSoft, margin:'12px 16px 0'}}/>

      {/* sort bar */}
      <SortBar sort={sort} onSort={setSort}/>

      {/* list */}
      <div style={{padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:10}}>
        {sorted.map(w => (
          <WhaleListCard key={w.id} w={w} onOpen={openWhale} onStats={openStats} onCopy={onCopy}/>
        ))}
      </div>

      {/* toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:120, left:'50%', transform:'translateX(-50%)',
          background:'rgba(15,11,34,0.92)', color:'#fff',
          padding:'8px 16px', borderRadius:999, fontSize:12,
          zIndex:80, pointerEvents:'none',
          fontFamily:'inherit',
        }}>{toast}</div>
      )}

      {/* profile detail */}
      {profile && (
        <WhaleProfileDetail w={profile} onClose={()=>setOpenId(null)} onCopy={onCopy}/>
      )}

      {/* trade stats modal */}
      {statsW && (
        <WhaleTradeStats w={statsW} onClose={()=>setStatsId(null)}/>
      )}

      <style>{`.wd-noscrollbar::-webkit-scrollbar{display:none}`}</style>
    </React.Fragment>
  );
}

/* ============= profile detail (full-screen overlay) ============= */
function WhaleProfileDetail({ w, onClose, onCopy }) {
  const [tab, setTab] = React.useState('基本信息');
  const [period, setPeriod] = React.useState('1周');
  const [scope,  setScope]  = React.useState('仅永续合约');
  const [metric, setMetric] = React.useState('总盈亏');
  const [pillOpen, setPillOpen] = React.useState(null); // 'period' | 'scope' | 'metric' | null

  // perpetual breakdown — derived placeholder
  const perpValue = 31_034_500;
  const margin = 90.78;
  const shortPct = 100, longPct = 0;
  const shortVal = perpValue, longVal = 0;
  const roi = -7.63;
  const unrealized = -54885.83;

  return (
    <div style={{
      position:'absolute', inset:0, zIndex:60,
      background: M.bg, display:'flex', flexDirection:'column',
      animation:'wd-slide-up .22s ease-out',
    }}>
      {/* header */}
      <div style={{
        padding:'48px 14px 12px',
        background: M.elev,
        borderBottom:`1px solid ${M.borderSoft}`,
        display:'flex', alignItems:'center', gap:10,
      }}>
        <button onClick={onClose} style={{
          width:32, height:32, borderRadius:8, padding:0, border:0,
          background:'transparent', cursor:'pointer', color:M.text,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICO_ARROWBK}/>
          </svg>
        </button>
        <WhaleAvatar w={w} size={32}/>
        <span style={{fontSize:14, fontWeight:600, color:M.text, fontFamily:M.mono}}>{w.id}</span>
        <CopyBtn text={w.id} onCopy={onCopy}/>
        <div style={{flex:1}}/>
        <button style={{
          height:30, padding:'0 12px', borderRadius:8,
          border:0, cursor:'pointer',
          background:M.violetSoft, color:M.violet,
          fontSize:12, fontWeight:600, fontFamily:'inherit',
          whiteSpace:'nowrap',
        }}>一键监控</button>
        <button style={{
          width:30, height:30, borderRadius:8, padding:0,
          border:`1px solid ${M.border}`, background:M.elev, cursor:'pointer',
          color:M.mid, display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICO_REFRESH}/>
          </svg>
        </button>
      </div>

      <div style={{flex:1, overflow:'auto'}}>
        {/* sticky tab bar */}
        <div style={{
          position:'sticky', top:0, zIndex:10,
          background:M.elev, borderBottom:`1px solid ${M.borderSoft}`,
        }}>
          <div
            ref={(el)=>{
              if (!el) return;
              // auto-scroll the active tab into view
              const active = el.querySelector('[data-active="1"]');
              if (active) {
                const aL = active.offsetLeft;
                const aR = aL + active.offsetWidth;
                const sL = el.scrollLeft;
                const sR = sL + el.clientWidth;
                if (aR > sR) el.scrollLeft = aR - el.clientWidth;
                else if (aL < sL) el.scrollLeft = Math.max(0, aL - 8);
              }
              // bind mouse drag-to-scroll once (lets desktop users drag the row)
              if (!el.dataset.dragBound) {
                el.dataset.dragBound = '1';
                el.addEventListener('mousedown', (e)=>{
                  const startX = e.pageX, startScroll = el.scrollLeft;
                  el._dragMoved = false;
                  el.style.cursor = 'grabbing';
                  const mm = (ev)=>{
                    const dx = ev.pageX - startX;
                    if (Math.abs(dx) > 4) el._dragMoved = true;
                    el.scrollLeft = startScroll - dx;
                  };
                  const mu = ()=>{
                    el.style.cursor = 'grab';
                    document.removeEventListener('mousemove', mm);
                    document.removeEventListener('mouseup', mu);
                  };
                  document.addEventListener('mousemove', mm);
                  document.addEventListener('mouseup', mu);
                });
                // swallow the click that ends a drag so it doesn't switch tabs
                el.addEventListener('click', (e)=>{
                  if (el._dragMoved) { e.stopPropagation(); e.preventDefault(); el._dragMoved = false; }
                }, true);
              }
            }}
            style={{display:'flex', overflowX:'auto', scrollbarWidth:'none', paddingRight:8,
              cursor:'grab', userSelect:'none', WebkitUserSelect:'none'}}
            className="wd-noscrollbar"
          >
            {[
              {k:'基本信息',         label:'基本信息',     cnt:null},
              {k:'现货持仓 (3)',     label:'现货持仓',     cnt:'3'},
              {k:'永续合约持仓 (2)', label:'永续合约持仓', cnt:'2'},
              {k:'挂单 (3)',         label:'挂单',         cnt:'3'},
              {k:'最近成交 (3)',     label:'最近成交',     cnt:'3'},
              {k:'历史委托 (3)',     label:'历史委托',     cnt:'3'},
            ].map(t => {
              const on = t.k === tab;
              return (
                <button key={t.k} data-active={on?'1':'0'} onClick={()=>setTab(t.k)} style={{
                  background:'transparent', border:0, padding:'12px 11px', cursor:'pointer',
                  color: on ? M.violet : M.mid, fontWeight: on?700:500, fontSize:12.5,
                  borderBottom: on ? `2px solid ${M.violet}` : '2px solid transparent',
                  whiteSpace:'nowrap', flexShrink:0, fontFamily:'inherit',
                  display:'inline-flex', alignItems:'center', gap:4,
                }}>
                  <span>{t.label}</span>
                  {t.cnt !== null && (
                    <span style={{
                      fontSize:10.5, fontWeight:600, fontFamily:M.mono,
                      color: on ? M.violet : M.faint,
                    }}>{t.cnt}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 基本信息 tab content */}
        {tab === '基本信息' && <React.Fragment>
          {/* P&L chart — moved to top */}
          <div style={{padding:'12px 12px 16px'}}>
            <div style={{
              background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:12,
              padding:'14px',
            }}>
              <div style={{display:'flex', alignItems:'flex-start', gap:8, marginBottom:10}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:12, color:M.mid}}>{period} 总盈亏（{scope}）</div>
                  <div style={{fontSize:18, fontWeight:700, color:M.dn, fontFamily:M.mono, marginTop:4}}>$ -172.51K</div>
                </div>
              </div>
              <div style={{display:'flex', gap:6, marginBottom:10, flexWrap:'wrap'}}>
                <PillSelect value={period} options={['1天','1周','1月','全部']} onChange={setPeriod}
                  open={pillOpen==='period'} onOpenChange={(o)=>setPillOpen(o?'period':null)}/>
                <PillSelect value={scope}  options={['仅永续合约','永续合约和现货']} onChange={setScope} wide
                  open={pillOpen==='scope'} onOpenChange={(o)=>setPillOpen(o?'scope':null)}/>
                <PillSelect value={metric} options={['总盈亏','账户价值']} onChange={setMetric} accent
                  open={pillOpen==='metric'} onOpenChange={(o)=>setPillOpen(o?'metric':null)}/>
              </div>
              <div style={{height:140, position:'relative'}}>
                {(() => {
                  const axis = [400,300,200,100,0,-100,-200,-300];
                  const top = 400, span = 700; // 400K .. -300K
                  const yPct = v => ((top - v)/span)*100;
                  const fmt  = v => v===0 ? '0' : `${v}K`;
                  // P&L curve points (x:0..276, value in K) — shaped to match the week's run
                  const pts = [
                    [0,0],[20,8],[40,120],[55,230],[75,150],[95,-18],[110,-22],
                    [130,70],[145,8],[165,-58],[185,40],[205,110],[215,88],
                    [230,118],[245,300],[255,178],[262,208],[270,-182],[276,-150],
                  ];
                  const yPx = v => ((top - v)/span)*140;
                  const line = pts.map((p,i)=>`${i?'L':'M'}${p[0]},${yPx(p[1]).toFixed(1)}`).join(' ');
                  const area = `${line} L276,140 L0,140 Z`;
                  return (
                    <React.Fragment>
                      {axis.map((v,i) => (
                        <div key={'g'+i} style={{
                          position:'absolute', left:0, right:30, top:`${yPct(v)}%`, height:0,
                          borderTop:`1px dashed ${v===0?M.border:M.borderSoft}`,
                        }}/>
                      ))}
                      {axis.map((v,i) => (
                        <div key={'l'+i} style={{
                          position:'absolute', right:0, top:`${yPct(v)}%`,
                          fontSize:9, color:M.faint, fontFamily:M.mono, transform:'translateY(-50%)',
                        }}>{fmt(v)}</div>
                      ))}
                      <div style={{position:'absolute', left:0, right:30, top:0, bottom:0}}>
                        <svg width="100%" height="100%" viewBox="0 0 276 140"
                          preserveAspectRatio="none" style={{display:'block'}}>
                          <defs>
                            <linearGradient id="wd-pnl-fill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={M.dn} stopOpacity="0.22"/>
                              <stop offset="100%" stopColor={M.dn} stopOpacity="0"/>
                            </linearGradient>
                          </defs>
                          <path d={area} fill="url(#wd-pnl-fill)"/>
                          <path d={line} fill="none" stroke={M.dn} strokeWidth="2"
                            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
                        </svg>
                      </div>
                    </React.Fragment>
                  );
                })()}
              </div>
            </div>
          </div>
          {/* 4 stat cards — 2x2 grid */}
          <div style={{padding:'12px 12px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            <StatCard
              label="账户总价值" value="$ 3.59M"
              extras={[
                {dot:'#7C5CFF', l:'永续合约', r:'$ 3.54M'},
                {dot:'#16A36B', l:'现货',     r:'$ 43.62K'},
              ]}
              donut={{a:.986, b:.014, ca:'#7C5CFF', cb:'#16A36B'}}/>
            <StatCard
              label="可用保证金" value="$ 404.74K"
              extras={[
                {dot:'#F59E0B', l:'可提取', r:'11.42 %'},
              ]}
              donut={{a:.886, b:.114, ca:'#F59E0B', cb:'#E5E7EB'}}/>
            <StatCard
              label="总持仓价值" value="$ 16.29M"
              extras={[
                {dot:'#F59E0B', l:'杠杆比', r:'5.19x', info:true},
              ]}
              donut={{a:1, b:0, ca:'#F59E0B', cb:'#FEF3C7'}}/>
            <PerfCard/>
          </div>

          {/* perpetual contract value */}
          <div style={{padding:'14px 12px 40px'}}>
            <div style={{
              background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:12,
              padding:'14px',
            }}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <div style={{fontSize:12, color:M.mid}}>永续合约总价值</div>
                <div style={{flex:1}}/>
                <span style={{
                  padding:'3px 8px', borderRadius:6, background:M.soft,
                  color:M.mid, fontSize:10.5, fontWeight:500,
                }}>当前持仓</span>
              </div>
              <div style={{fontSize:22, fontWeight:700, color:M.text, fontFamily:M.mono, marginTop:6, letterSpacing:-0.4}}>
                $ {perpValue.toLocaleString()}
              </div>
              <div style={{marginTop:14}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                  <span style={{fontSize:12, color:M.mid}}>平均保证金使用率</span>
                  <span style={{fontSize:13, fontWeight:600, color:M.text, fontFamily:M.mono}}>{margin} %</span>
                </div>
                <div style={{height:3, borderRadius:2, background:M.soft, marginTop:6, overflow:'hidden'}}>
                  <div style={{width:`${margin}%`, height:'100%', background:'#22D3EE'}}/>
                </div>
              </div>
              <div style={{marginTop:14, paddingTop:14, borderTop:`1px solid ${M.borderSoft}`}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                  <span style={{fontSize:12, color:M.mid}}>方向偏差</span>
                  <span style={{fontSize:13, fontWeight:600, color:M.text}}>中性</span>
                </div>
                <div style={{marginTop:8, display:'flex', flexDirection:'column', gap:8}}>
                  <BiasBar label="多头持仓" v={longPct}  c={M.up}/>
                  <BiasBar label="空头持仓" v={shortPct} c={M.dn}/>
                </div>
              </div>
              <div style={{marginTop:14, paddingTop:14, borderTop:`1px solid ${M.borderSoft}`}}>
                <div style={{fontSize:12, color:M.mid, marginBottom:8}}>仓位分布</div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4}}>
                  <div>
                    <div style={{fontSize:10.5, color:M.dim}}>多头价值</div>
                    <div style={{fontSize:13, fontWeight:700, color:M.text, fontFamily:M.mono, marginTop:2}}>$ {longVal.toLocaleString()}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:10.5, color:M.dim}}>空头价值</div>
                    <div style={{fontSize:13, fontWeight:700, color:M.text, fontFamily:M.mono, marginTop:2}}>$ {shortVal.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{height:3, borderRadius:2, background:M.dn, marginTop:8}}/>
              </div>
              <div style={{marginTop:14, paddingTop:14, borderTop:`1px solid ${M.borderSoft}`,
                display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                <span style={{fontSize:12, color:M.mid}}>投资回报率</span>
                <span style={{fontSize:13, fontWeight:600, color:M.dn, fontFamily:M.mono}}>{roi} %</span>
              </div>
              <div style={{marginTop:6, display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                <span style={{fontSize:12, color:M.mid}}>未实现盈亏</span>
                <span style={{fontSize:13, fontWeight:600, color:M.dn, fontFamily:M.mono}}>$ {unrealized.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
              </div>
            </div>
          </div>

        </React.Fragment>}

        {/* other tabs — table view */}
        {tab !== '基本信息' && (
          <div style={{padding:'12px 12px 16px'}}>
            <TabBody tab={tab}/>
          </div>
        )}
      </div>

      {/* ─── 图表筛选 — bottom drawer (时间 / 范围 / 指标) ─── */}
      {pillOpen && (() => {
        const cfg = pillOpen === 'period'
          ? { title:'时间范围', options:['1天','1周','1月','全部'], value:period, onChange:setPeriod }
          : pillOpen === 'scope'
          ? { title:'统计范围', options:['仅永续合约','永续合约和现货'], value:scope, onChange:setScope }
          : { title:'指标', options:['总盈亏','账户价值'], value:metric, onChange:setMetric };
        return (
          <div
            onClick={()=>setPillOpen(null)}
            style={{
              position:'absolute', inset:0, zIndex:90,
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
                {cfg.title}
              </div>
              <div style={{padding:'0 8px 6px'}}>
                {cfg.options.map(o => {
                  const on = o === cfg.value;
                  return (
                    <button
                      key={o}
                      onClick={()=>{ cfg.onChange(o); setPillOpen(null); }}
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
                <button onClick={()=>setPillOpen(null)} style={{
                  width:'100%', height:46, border:0, cursor:'pointer',
                  background:'transparent', color:M.text,
                  fontSize:14, fontWeight:600, fontFamily:'inherit',
                }}>取消</button>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes wd-slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ============= sub-atoms ============= */
function StatCard({ label, value, extras, donut }) {
  const d = donut || {};
  return (
    <div style={{
      background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:12,
      padding:'12px',
    }}>
      <div style={{fontSize:11, color:M.mid}}>{label}</div>
      <div style={{display:'flex', alignItems:'flex-end', gap:8, marginTop:4}}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:15, fontWeight:700, color:M.text, fontFamily:M.mono, letterSpacing:-0.3,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{value}</div>
        </div>
        {donut && <DonutMini a={d.a} b={d.b} ca={d.ca} cb={d.cb}/>}
      </div>
      <div style={{marginTop:8, display:'flex', flexDirection:'column', gap:5}}>
        {extras.map((e,i) => (
          <div key={i} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:6}}>
            <span style={{display:'inline-flex', alignItems:'center', gap:5, fontSize:10.5, color:M.mid}}>
              <span style={{width:5, height:5, borderRadius:3, background:e.dot, flexShrink:0}}/>
              {e.l}
              {e.info && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" style={{opacity:0.5}}>
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 8v5M12 16v.5" strokeLinecap="round"/>
                </svg>
              )}
            </span>
            <span style={{fontSize:11, color:M.text, fontFamily:M.mono, fontWeight:500}}>{e.r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerfCard() {
  return (
    <div style={{
      background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:12,
      padding:'12px',
    }}>
      <div style={{fontSize:11, color:M.mid}}>交易表现 <span style={{color:M.dim}}>(1周)</span></div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:4}}>
        <div>
          <div style={{fontSize:10, color:M.dim}}>胜率</div>
          <div style={{fontSize:14, fontWeight:700, color:M.text, fontFamily:M.mono, marginTop:2, letterSpacing:-0.3}}>27.71 %</div>
        </div>
        <div>
          <div style={{fontSize:10, color:M.dim}}>最大回撤</div>
          <div style={{fontSize:14, fontWeight:700, color:M.text, fontFamily:M.mono, marginTop:2, letterSpacing:-0.3}}>8202846.96 %</div>
        </div>
      </div>
      <div style={{marginTop:8, display:'flex', flexDirection:'column', gap:5}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <span style={{display:'inline-flex', alignItems:'center', gap:5, fontSize:10.5, color:M.mid}}>
            <span style={{width:5, height:5, borderRadius:3, background:'#F59E0B'}}/>
            已成交订单
          </span>
          <span style={{fontSize:11, color:M.text, fontFamily:M.mono, fontWeight:500}}>2000</span>
        </div>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <span style={{display:'inline-flex', alignItems:'center', gap:5, fontSize:10.5, color:M.mid}}>
            <span style={{width:5, height:5, borderRadius:3, background:'#F59E0B'}}/>
            平仓次数
          </span>
          <span style={{fontSize:11, color:M.text, fontFamily:M.mono, fontWeight:500}}>1025</span>
        </div>
      </div>
    </div>
  );
}

function DonutMini({ a=0.5, b=0.5, ca='#7C5CFF', cb='#16A36B' }) {
  const r = 14, c = 2*Math.PI*r;
  const aLen = c*a, bLen = c*b;
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" style={{flexShrink:0}}>
      <circle cx="21" cy="21" r={r} fill="none" stroke={M.soft} strokeWidth="6"/>
      <circle cx="21" cy="21" r={r} fill="none" stroke={ca} strokeWidth="6"
        strokeDasharray={`${aLen} ${c-aLen}`} strokeDashoffset={c/4} transform="rotate(-90 21 21)" strokeLinecap="butt"/>
      <circle cx="21" cy="21" r={r} fill="none" stroke={cb} strokeWidth="6"
        strokeDasharray={`${bLen} ${c-bLen}`} strokeDashoffset={c/4 - aLen} transform="rotate(-90 21 21)" strokeLinecap="butt"/>
    </svg>
  );
}

function BiasBar({ label, v, c }) {
  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
        <span style={{fontSize:11, color:M.mid}}>{label}</span>
        <span style={{fontSize:12, fontWeight:600, color:c, fontFamily:M.mono}}>{v} %</span>
      </div>
      <div style={{height:2, borderRadius:1, background:M.soft, marginTop:5, overflow:'hidden'}}>
        <div style={{width:`${v}%`, height:'100%', background:c}}/>
      </div>
    </div>
  );
}

function PillSelect({ value, options, onChange, wide, accent, open: openProp, onOpenChange }) {
  const controlled = onOpenChange != null;
  const [openState, setOpenState] = React.useState(false);
  const open = controlled ? openProp : openState;
  const setOpen = controlled ? onOpenChange : setOpenState;
  return (
    <div style={{position:'relative'}}>
      <button onClick={()=>setOpen(!open)} style={{
        height:28, padding:'0 10px', borderRadius:8,
        border:`1px solid ${M.border}`, cursor:'pointer',
        background: accent ? M.violetGrad : M.elev,
        color: accent ? '#fff' : M.text,
        fontSize:11, fontWeight: accent?600:500, fontFamily:'inherit',
        display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
        minWidth: wide?94:64,
      }}>
        <span style={{flex:1, textAlign:'left'}}>{value}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{transform: open ? 'rotate(180deg)' : 'none', transition:'transform 160ms'}}>
          <path d={ICO_CHEV_D}/>
        </svg>
      </button>
      {!controlled && open && (
        <div onClick={()=>setOpen(false)} style={{
          position:'fixed', inset:0, zIndex:5,
        }}/>
      )}
      {!controlled && open && (
        <div style={{
          position:'absolute', top:32, left:0, zIndex:6,
          background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:8,
          boxShadow:'0 8px 20px -8px rgba(15,11,34,0.18)',
          minWidth:'100%', padding:'4px 0',
        }}>
          {options.map(o => (
            <div key={o} onClick={()=>{onChange(o); setOpen(false);}} style={{
              padding:'8px 14px', fontSize:12, cursor:'pointer', whiteSpace:'nowrap',
              color: o === value ? M.violet : M.text,
              fontWeight: o === value ? 600 : 500,
            }}>{o}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabBody({ tab }) {
  // ===== 现货持仓 排序 — 每列三态循环: desc 降序 → asc 升序 → null 不排序 =====
  const [sort, setSort] = React.useState({ key:null, dir:null }); // key: 'value'|'amount'|'price'
  const cycleSort = (key) => setSort(s => {
    if (s.key !== key)      return { key, dir:'desc' };  // 新列默认降序
    if (s.dir === 'desc')   return { key, dir:'asc'  };  // 降序 → 升序
    if (s.dir === 'asc')    return { key:null, dir:null }; // 升序 → 不排序
    return { key, dir:'desc' };
  });
  const sortedSpot = React.useMemo(() => {
    if (!sort.key || !sort.dir) return SPOT_HOLDINGS;
    const num = (v) => parseFloat(String(v).replace(/,/g, ''));
    const getV = (h) => sort.key === 'value' ? h.valueN
                      : sort.key === 'amount' ? num(h.qty)
                      : num(h.price);
    const arr = [...SPOT_HOLDINGS].sort((a, b) => getV(a) - getV(b));
    return sort.dir === 'desc' ? arr.reverse() : arr;
  }, [sort]);

  // ===== 永续合约持仓 排序 / 筛选 =====
  const [perpSort, setPerpSort] = React.useState({ key:null, dir:null }); // value|pnl|entry|mark|liq|margin|funding
  const cyclePerpSort = (key) => setPerpSort(s => {
    if (s.key !== key)    return { key, dir:'desc' };
    if (s.dir === 'desc') return { key, dir:'asc'  };
    if (s.dir === 'asc')  return { key:null, dir:null };
    return { key, dir:'desc' };
  });
  const sortedPerp = React.useMemo(() => {
    if (!perpSort.key || !perpSort.dir) return PERP_HOLDINGS;
    const map = { value:'valueN', pnl:'pnlN', entry:'entryN', mark:'markN',
                  liq:'liqN', margin:'marginN', funding:'fundingN' };
    const f = map[perpSort.key];
    const arr = [...PERP_HOLDINGS].sort((a, b) => a[f] - b[f]);
    return perpSort.dir === 'desc' ? arr.reverse() : arr;
  }, [perpSort]);

  // ===== 挂单 排序 / 筛选 =====
  const [orderSort, setOrderSort] = React.useState({ key:null, dir:null }); // time|value|qty
  const cycleOrderSort = (key) => setOrderSort(s => {
    if (s.key !== key)    return { key, dir:'desc' };
    if (s.dir === 'desc') return { key, dir:'asc'  };
    if (s.dir === 'asc')  return { key:null, dir:null };
    return { key, dir:'desc' };
  });
  const sortedOrders = React.useMemo(() => {
    if (!orderSort.key || !orderSort.dir) return OPEN_ORDERS;
    const map = { time:'timeN', value:'valueN', qty:'qtyN' };
    const f = map[orderSort.key];
    const arr = [...OPEN_ORDERS].sort((a, b) => a[f] - b[f]);
    return orderSort.dir === 'desc' ? arr.reverse() : arr;
  }, [orderSort]);

  // ===== 最近成交 排序 / 筛选 =====
  const [tradeSort, setTradeSort] = React.useState({ key:null, dir:null }); // time|qty|price|pnl|fee|start
  const cycleTradeSort = (key) => setTradeSort(s => {
    if (s.key !== key)    return { key, dir:'desc' };
    if (s.dir === 'desc') return { key, dir:'asc'  };
    if (s.dir === 'asc')  return { key:null, dir:null };
    return { key, dir:'desc' };
  });
  const sortedTrades = React.useMemo(() => {
    if (!tradeSort.key || !tradeSort.dir) return RECENT_TRADES;
    const map = { time:'timeN', qty:'qtyN', price:'priceN', pnl:'pnlN', fee:'feeN', start:'startN' };
    const f = map[tradeSort.key];
    const arr = [...RECENT_TRADES].sort((a, b) => a[f] - b[f]);
    return tradeSort.dir === 'desc' ? arr.reverse() : arr;
  }, [tradeSort]);

  // ===== 历史委托 排序 / 筛选 =====
  const [histSort, setHistSort] = React.useState({ key:null, dir:null }); // time|qty|price
  const cycleHistSort = (key) => setHistSort(s => {
    if (s.key !== key)    return { key, dir:'desc' };
    if (s.dir === 'desc') return { key, dir:'asc'  };
    if (s.dir === 'asc')  return { key:null, dir:null };
    return { key, dir:'desc' };
  });
  const sortedHist = React.useMemo(() => {
    if (!histSort.key || !histSort.dir) return HIST_ORDERS;
    const map = { time:'timeN', qty:'qtyN', price:'priceN' };
    const f = map[histSort.key];
    const arr = [...HIST_ORDERS].sort((a, b) => a[f] - b[f]);
    return histSort.dir === 'desc' ? arr.reverse() : arr;
  }, [histSort]);

  // table headers per tab (match PC) — right-align indicates a numeric/sortable column
  const cfg = {
    '现货持仓 (3)':     { cols:[
      {label:'持仓价值', align:'left', sort:true},
      {label:'金额', align:'right', sort:true},
      {label:'价格', align:'right', sort:true},
      {label:'币种筛选', align:'right'},
    ], empty:'暂无现货持仓' },
    '永续合约持仓 (2)': { cols:[
      {label:'币种', align:'left'},
      {label:'方向', align:'left'},
      {label:'持仓价值', align:'right', sort:true},
      {label:'未实现盈亏', align:'right', sort:true},
      {label:'入场均价', align:'right', sort:true},
      {label:'标记价', align:'right', sort:true},
      {label:'清算价', align:'right', sort:true},
      {label:'保证金', align:'right', sort:true},
      {label:'资金费用', align:'right', sort:true},
      {label:'止盈/止损', align:'right'},
    ], empty:'暂无永续合约持仓' },
    '挂单 (3)':         { cols:[
      {label:'时间', align:'left', sort:true},
      {label:'币种', align:'left'},
      {label:'方向', align:'left'},
      {label:'价值', align:'right', sort:true},
      {label:'数量', align:'right', sort:true},
      {label:'价格', align:'right'},
      {label:'触发条件', align:'right'},
      {label:'状态', align:'right'},
      {label:'订单 ID', align:'right'},
    ], empty:'暂无挂单' },
    '最近成交 (3)':     { cols:[
      {label:'时间', align:'left', sort:true},
      {label:'币种', align:'left'},
      {label:'行为', align:'left'},
      {label:'数量', align:'right', sort:true},
      {label:'起始仓位', align:'right', sort:true},
      {label:'价值', align:'right', sort:true},
      {label:'价格', align:'right', sort:true},
      {label:'已平盈亏', align:'right', sort:true},
      {label:'费用', align:'right', sort:true},
      {label:'交易记录', align:'right'},
    ], empty:'暂无最近成交' },
    '历史委托 (3)':         { cols:[
      {label:'时间', align:'left', sort:true},
      {label:'币种', align:'left'},
      {label:'类型', align:'left'},
      {label:'方向', align:'left'},
      {label:'数量', align:'right', sort:true},
      {label:'价格', align:'right', sort:true},
      {label:'触发条件', align:'right'},
      {label:'执行状态', align:'right'},
      {label:'订单 ID', align:'right'},
    ], empty:'暂无历史委托' },
  };
  const c = cfg[tab] || cfg['现货持仓 (3)'];

  // spot has 5 cols → fits screen width, distribute evenly with flex:1.
  // others have many cols → horizontal scroll with fixed min-widths per column
  // so rows align with headers like a proper table.
  const isSpot = tab === '现货持仓 (3)';
  const isPerp = tab === '永续合约持仓 (2)';
  const isOrder = tab === '挂单 (3)';
  const isTrade = tab === '最近成交 (3)';
  const isHist = tab === '历史委托 (3)';
  const colWidth = 96; // px per column for scrollable tabs

  // 币种筛选 (coin filter) — reset whenever the tab changes
  const [coinFilter, setCoinFilter] = React.useState('全部');
  React.useEffect(() => { setCoinFilter('全部'); }, [tab]);
  const coinOptsOf = (arr) => ['全部', ...Array.from(new Set(arr.map(x => x.sym)))];
  const byCoin = (arr) => coinFilter === '全部' ? arr : arr.filter(x => x.sym === coinFilter);

  // ===== 现货持仓 — summary + compact rows =====
  if (isSpot) {
    return (
      <div style={{background:M.bg}}>
        {/* holdings list */}
        <div style={{background:M.elev}}>
          {/* column header / sort row */}
          <div style={{
            display:'flex', alignItems:'center',
            padding:'11px 16px', borderBottom:`1px solid ${M.borderSoft}`,
          }}>
            <div style={{display:'flex', gap:16, alignItems:'center'}}>
              <SpotSortLabel label="价值" sort state={sort.key==='value' ? sort.dir : null} onClick={()=>cycleSort('value')}/>
              <SpotSortLabel label="金额" sort state={sort.key==='amount' ? sort.dir : null} onClick={()=>cycleSort('amount')}/>
            </div>
            <div style={{flex:1}}/>
            <div style={{display:'flex', gap:16, alignItems:'center'}}>
              <SpotSortLabel label="价格" sort state={sort.key==='price' ? sort.dir : null} onClick={()=>cycleSort('price')}/>
              <CoinFilter value={coinFilter} onChange={setCoinFilter} options={coinOptsOf(SPOT_HOLDINGS)} label="筛选"/>
            </div>
          </div>

          {byCoin(sortedSpot).map((h) => (
            <SpotHoldingRow key={h.sym} h={h}/>
          ))}
        </div>
      </div>
    );
  }

  // ===== 永续合约持仓 — 排序/筛选工具条 + 仓位卡片 =====
  if (isPerp) {
    const ds = (k) => (perpSort.key === k ? perpSort.dir : null);
    return (
      <div style={{background:M.bg}}>
        <div style={{background:M.elev}}>
          {/* toolbar: 数据标签排序 (left) + 币种筛选 / 更多排序 (right) */}
          <div style={{
            display:'flex', alignItems:'center', gap:14,
            padding:'12px 16px', borderBottom:`1px solid ${M.borderSoft}`,
          }}>
            <SpotSortLabel label="持仓价值"  sort state={ds('value')} onClick={()=>cyclePerpSort('value')}/>
            <SpotSortLabel label="未实现盈亏" sort state={ds('pnl')}   onClick={()=>cyclePerpSort('pnl')}/>
            <div style={{flex:1}}/>
            <CoinFilter value={coinFilter} onChange={setCoinFilter} options={coinOptsOf(PERP_HOLDINGS)}/>
            <PerpMoreSort sort={perpSort} onPick={cyclePerpSort} onSet={setPerpSort}/>
          </div>

          {byCoin(sortedPerp).map((h) => (
            <PerpHoldingRow key={h.sym} h={h}/>
          ))}
        </div>
      </div>
    );
  }

  // ===== 挂单 — 排序/筛选工具条 + 挂单卡片 =====
  if (isOrder) {
    const ds = (k) => (orderSort.key === k ? orderSort.dir : null);
    return (
      <div style={{background:M.bg}}>
        <div style={{background:M.elev}}>
          {/* toolbar: 时间/价值 (left sort) · 数量 sort + 币种筛选 (right) */}
          <div style={{
            display:'flex', alignItems:'center', gap:14,
            padding:'12px 16px', borderBottom:`1px solid ${M.borderSoft}`,
          }}>
            <SpotSortLabel label="时间" sort state={ds('time')}  onClick={()=>cycleOrderSort('time')}/>
            <SpotSortLabel label="价值" sort state={ds('value')} onClick={()=>cycleOrderSort('value')}/>
            <div style={{flex:1}}/>
            <SpotSortLabel label="数量" sort state={ds('qty')}   onClick={()=>cycleOrderSort('qty')}/>
            <CoinFilter value={coinFilter} onChange={setCoinFilter} options={coinOptsOf(OPEN_ORDERS)}/>
          </div>

          {byCoin(sortedOrders).map((o) => (
            <OpenOrderRow key={o.id} o={o}/>
          ))}
        </div>
      </div>
    );
  }

  // ===== 最近成交 — 排序/筛选工具条 + 成交卡片 =====
  if (isTrade) {
    const ds = (k) => (tradeSort.key === k ? tradeSort.dir : null);
    return (
      <div style={{background:M.bg}}>
        <div style={{background:M.elev}}>
          {/* toolbar: 时间/数量 (left sort) · 币种筛选 / 更多排序 (right) */}
          <div style={{
            display:'flex', alignItems:'center', gap:14,
            padding:'12px 16px', borderBottom:`1px solid ${M.borderSoft}`,
          }}>
            <SpotSortLabel label="时间" sort state={ds('time')} onClick={()=>cycleTradeSort('time')}/>
            <SpotSortLabel label="数量" sort state={ds('qty')}  onClick={()=>cycleTradeSort('qty')}/>
            <div style={{flex:1}}/>
            <CoinFilter value={coinFilter} onChange={setCoinFilter} options={coinOptsOf(RECENT_TRADES)}/>
            <PerpMoreSort sort={tradeSort} onPick={cycleTradeSort} onSet={setTradeSort} opts={[
              {k:'price', label:'价格'},
              {k:'pnl',   label:'已平盈亏'},
              {k:'fee',   label:'费用'},
              {k:'start', label:'起始仓位'},
            ]}/>
          </div>

          {byCoin(sortedTrades).map((t) => (
            <RecentTradeRow key={t.id} t={t}/>
          ))}
        </div>
      </div>
    );
  }

  // ===== 历史委托 — 排序/筛选工具条 + 委托卡片 =====
  if (isHist) {
    const ds = (k) => (histSort.key === k ? histSort.dir : null);
    return (
      <div style={{background:M.bg}}>
        <div style={{background:M.elev}}>
          {/* toolbar: 时间/数量 (left sort) · 价格 sort + 币种筛选 (right) */}
          <div style={{
            display:'flex', alignItems:'center', gap:14,
            padding:'12px 16px', borderBottom:`1px solid ${M.borderSoft}`,
          }}>
            <SpotSortLabel label="时间" sort state={ds('time')}  onClick={()=>cycleHistSort('time')}/>
            <SpotSortLabel label="数量" sort state={ds('qty')}   onClick={()=>cycleHistSort('qty')}/>
            <div style={{flex:1}}/>
            <SpotSortLabel label="价格" sort state={ds('price')} onClick={()=>cycleHistSort('price')}/>
            <CoinFilter value={coinFilter} onChange={setCoinFilter} options={coinOptsOf(HIST_ORDERS)}/>
          </div>

          {byCoin(sortedHist).map((o) => (
            <HistOrderRow key={o.id} o={o}/>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        className="wd-noscrollbar"
        style={{
          overflowX: 'auto',
          scrollbarWidth:'none',
          borderBottom:`1px solid ${M.borderSoft}`,
        }}
      >
        <div style={{
          display:'flex',
          gap:0,
          padding:'10px 14px',
          minWidth: c.cols.length * colWidth,
        }}>
          {c.cols.map((col) => (
            <span key={col.label} style={{
              flex: `0 0 ${colWidth}px`,
              fontSize:10.5, color:M.dim, whiteSpace:'nowrap', fontWeight:500,
              display:'inline-flex',
              alignItems:'center',
              gap:3,
              justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
            }}>
              {col.label}
              {col.sort && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.55}}>
                  <path d={ICO_SORTUD}/>
                </svg>
              )}
            </span>
          ))}
        </div>
      </div>
      <div style={{padding:'40px 14px 44px', textAlign:'center', fontSize:12, color:M.faint}}>
        {c.empty}
      </div>
    </div>
  );
}

/* ===== 现货持仓 data + atoms ===== */
const SPOT_HOLDINGS = [
  { sym:'HYPE',  c:'#0D9488', share:42.91, qty:'3,310.52',      price:'61.331',   value:'203,037.59', valueN:203037.59, chg:4.21,  chain:'HyperEVM' },
  { sym:'UXPL',  c:'#22C55E', share:29.31, qty:'1,689,043.42',  price:'0.082112', value:'138,690.73', valueN:138690.73, chg:-1.86, chain:'HyperEVM' },
  { sym:'UPUMP', c:'#D946EF', share:27.76, qty:'77,967,561.62', price:'0.00168',  value:'131,351.95', valueN:131351.95, chg:12.93, chain:'Solana' },
];

/* ===== 永续合约持仓 data + atoms ===== */
const PERP_HOLDINGS = [
  { sym:'HYPE', c:'#0D9488', side:'做空', lev:'5x', mode:'全仓',
    value:'12,151,926.69', valueN:12151926.69,
    pnl:'-3,848,973.39',   pnlN:-3848973.39,
    entry:'41.85',         entryN:41.85,
    mark:'61.24',          markN:61.24,
    liq:'179.63',          liqN:179.63,
    margin:'2,430,385.34', marginN:2430385.34,
    funding:'245,194.82',  fundingN:245194.82,
    tpsl:'–/–' },
  { sym:'TON', c:'#65A30D', side:'做空', lev:'2x', mode:'全仓',
    value:'7,889,297.42',  valueN:7889297.42,
    pnl:'1,049,703.17',    pnlN:1049703.17,
    entry:'1.99',          entryN:1.99,
    mark:'1.76',           markN:1.76,
    liq:'6.91',            liqN:6.91,
    margin:'3,944,648.71', marginN:3944648.71,
    funding:'-23,563.13',  fundingN:-23563.13,
    tpsl:'–/–' },
];

/* 更多排序 — dropdown for the extra numeric columns */
function PerpMoreSort({ sort, onPick, onSet, opts }) {
  const [open, setOpen] = React.useState(false);
  opts = opts || [
    { k:'entry',   label:'入场均价' },
    { k:'mark',    label:'标记价' },
    { k:'liq',     label:'清算价' },
    { k:'margin',  label:'保证金' },
    { k:'funding', label:'资金费用' },
  ];
  const active = opts.some(o => o.k === sort.key) && sort.dir;
  const setSort = onSet || (() => {});
  const pickField = (k) => setSort({ key:k, dir: sort.dir || 'desc' });
  const pickDir = (dir) => {
    if (dir == null) { setSort({ key:null, dir:null }); return; }
    setSort({ key: sort.key || opts[0].k, dir });
  };
  return (
    <React.Fragment>
      <span onClick={()=>setOpen(true)} style={{
        fontSize:11, color: active ? M.violet : M.dim, fontWeight: active ? 600 : 500,
        whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:3,
        cursor:'pointer', userSelect:'none', WebkitTapHighlightColor:'transparent',
      }}>
        更多排序
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{opacity:0.7, transform: open ? 'rotate(180deg)' : 'none', transition:'transform 160ms'}}>
          <path d={ICO_CHEV_D}/>
        </svg>
      </span>
      {open && (
        <div onClick={()=>setOpen(false)} style={{
          position:'absolute', inset:0, zIndex:90,
          background:'rgba(15,11,34,0.55)', animation:'m-fade-in .18s ease-out',
        }}>
          <div onClick={(e)=>e.stopPropagation()} style={{
            position:'absolute', left:0, right:0, bottom:0,
            background:M.elev, borderRadius:'20px 20px 0 0',
            boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
            padding:'0 20px calc(28px + env(safe-area-inset-bottom))',
            animation:'m-slide-up .26s cubic-bezier(.2,.8,.2,1)',
          }}>
            <div style={{width:42, height:4, borderRadius:2, background:M.border, margin:'10px auto 14px'}}/>
            <div style={{fontSize:14, fontWeight:700, marginBottom:12, color:M.text}}>更多排序</div>

            {/* 指标 — pills */}
            <div style={{fontSize:11, color:M.mid, marginBottom:6}}>指标</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:16}}>
              {opts.map(o => {
                const on = sort.key === o.k;
                return (
                  <button key={o.k} onClick={()=>pickField(o.k)} style={{
                    height:30, padding:'0 14px', borderRadius:999, fontSize:12,
                    fontWeight: on ? 600 : 500, whiteSpace:'nowrap',
                    background: on ? M.violet : M.soft, color: on ? '#fff' : M.text,
                    border:0, cursor:'pointer', fontFamily:'inherit',
                  }}>{o.label}</button>
                );
              })}
            </div>

            {/* 排序方式 — direction */}
            <div style={{fontSize:11, color:M.mid, marginBottom:6}}>排序方式</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6}}>
              {[
                {k:'asc',  label:'升序', arrow:'↑'},
                {k:'desc', label:'降序', arrow:'↓'},
                {k:null,   label:'不排序', arrow:''},
              ].map(d => {
                const on = (d.k == null) ? !sort.dir : sort.dir === d.k;
                return (
                  <button key={String(d.k)} onClick={()=>pickDir(d.k)} style={{
                    height:40, borderRadius:10, padding:'0 8px',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    fontSize:12.5, fontWeight: on ? 600 : 500, fontFamily:'inherit', whiteSpace:'nowrap',
                    background: on ? M.violetSoft : M.soft,
                    color: on ? M.violet : M.text,
                    border: on ? `1px solid ${M.violet}` : '1px solid transparent',
                    cursor:'pointer',
                  }}>
                    <span>{d.label}</span>
                    {d.arrow && <span style={{fontFamily:M.mono, fontSize:13, fontWeight:700}}>{d.arrow}</span>}
                  </button>
                );
              })}
            </div>

            <button onClick={()=>setOpen(false)} style={{
              width:'100%', height:46, marginTop:16, borderRadius:12, border:0,
              background:M.violetGrad, color:'#fff', fontSize:14, fontWeight:600,
              boxShadow:'0 6px 20px rgba(124,92,255,0.32)', cursor:'pointer', fontFamily:'inherit',
            }}>完成</button>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

/* a single labeled data cell — used in the aligned perp grid */
function PerpCell({ label, value, align, color }) {
  return (
    <div style={{textAlign:align, minWidth:0}}>
      <div style={{fontSize:10.5, color:M.dim, marginBottom:6}}>{label}</div>
      <div style={{
        fontSize:12, fontWeight:600, color: color || M.text, fontFamily:M.mono,
        letterSpacing:-0.3, whiteSpace:'nowrap',
      }}>{value}</div>
    </div>
  );
}

function PerpHoldingRow({ h }) {
  const [press, setPress] = React.useState(false);
  const short = h.side === '做空';
  const sideCol = short ? M.dn : M.up;
  const pnlCol     = h.pnlN     >= 0 ? M.up : M.dn;
  const fundingCol = h.fundingN >= 0 ? M.up : M.dn;
  const sign = (n) => (n >= 0 ? '$ ' : '$ -');
  return (
    <div
      onTouchStart={()=>setPress(true)} onTouchEnd={()=>setPress(false)}
      onMouseDown={()=>setPress(true)} onMouseUp={()=>setPress(false)}
      onMouseLeave={()=>setPress(false)}
      style={{
        background: press ? M.soft : 'transparent',
        borderBottom:`1px solid ${M.borderSoft}`,
        padding:'16px 14px 18px', transition:'background .12s', cursor:'pointer',
      }}>
      {/* 主题 — coin head, NOT grid-aligned */}
      <div style={{display:'flex', alignItems:'center', gap:11, marginBottom:16}}>
        <div style={{
          width:34, height:34, borderRadius:'50%', flexShrink:0,
          background:h.c, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:13, fontWeight:700, fontFamily:M.mono,
          boxShadow:`0 2px 8px ${h.c}33`,
        }}>{h.sym[0]}</div>
        <span style={{fontSize:17, fontWeight:700, color:M.text, letterSpacing:0.2}}>{h.sym}</span>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'3px 9px', borderRadius:6,
          background: short ? M.dnSoft : M.upSoft, color: sideCol,
          fontSize:11.5, fontWeight:600, fontFamily:M.mono, whiteSpace:'nowrap',
        }}>
          <span style={{color:M.mid}}>{h.mode}</span>
          <span>{h.side}</span>
          <span>{h.lev}</span>
        </span>
      </div>

      {/* aligned data grid: col1 left · col2 center · col3 right */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', rowGap:15, columnGap:6}}>
        <PerpCell label="持仓价值"   align="left"   value={`$ ${h.value}`}/>
        <PerpCell label="未实现盈亏" align="center" value={`${sign(h.pnlN)}${h.pnl.replace('-','')}`} color={pnlCol}/>
        <PerpCell label="入场均价"   align="right"  value={`$ ${h.entry}`}/>

        <PerpCell label="标记价格"   align="left"   value={`$ ${h.mark}`}/>
        <PerpCell label="清算价格"   align="center" value={`$ ${h.liq}`}/>
        <PerpCell label="保证金"     align="right"  value={`$ ${h.margin}`}/>

        <PerpCell label="资金费"     align="left"   value={`${sign(h.fundingN)}${h.funding.replace('-','')}`} color={fundingCol}/>
        <div/>
        <PerpCell label="止盈/止损"  align="right"  value={h.tpsl}/>
      </div>
    </div>
  );
}

/* ===== 挂单 data + atoms ===== */
const OPEN_ORDERS = [
  { id:'4471782661', sym:'ZEC', c:'#F4B728', side:'买入', type:'限价',
    time:'26/05/29 12:18', timeN:1748506680,
    value:'1,918.17', valueN:1918.17,
    qty:'3.61', qtyN:3.61,
    trig:'–', status:'开仓' },
  { id:'4471206834', sym:'SOL', c:'#9945FF', side:'卖出', type:'限价',
    time:'26/05/29 11:02', timeN:1748502120,
    value:'42,560.00', valueN:42560.00,
    qty:'215.00', qtyN:215.00,
    trig:'≥ $ 198.00', status:'开仓' },
  { id:'4470991257', sym:'ARB', c:'#2D374B', side:'买入', type:'止损限价',
    time:'26/05/28 22:47', timeN:1748456820,
    value:'8,204.40', valueN:8204.40,
    qty:'12,840.00', qtyN:12840.00,
    trig:'≤ $ 0.639', status:'开仓' },
];

/* a single labeled data cell for 挂单 — optional truncation for long fields */
function OrderCell({ label, value, align, color, truncate }) {
  return (
    <div style={{textAlign:align, minWidth:0}}>
      <div style={{fontSize:10.5, color:M.dim, marginBottom:6}}>{label}</div>
      <div style={{
        fontSize:12, fontWeight:600, color: color || M.text, fontFamily:M.mono,
        letterSpacing:-0.3, whiteSpace:'nowrap',
        ...(truncate ? {overflow:'hidden', textOverflow:'ellipsis'} : {}),
      }}>{value}</div>
    </div>
  );
}

function OpenOrderRow({ o }) {
  const [press, setPress] = React.useState(false);
  const buy = o.side === '买入';
  const sideCol = buy ? M.up : M.dn;
  return (
    <div
      onTouchStart={()=>setPress(true)} onTouchEnd={()=>setPress(false)}
      onMouseDown={()=>setPress(true)} onMouseUp={()=>setPress(false)}
      onMouseLeave={()=>setPress(false)}
      style={{
        background: press ? M.soft : 'transparent',
        borderBottom:`1px solid ${M.borderSoft}`,
        padding:'16px 14px 18px', transition:'background .12s', cursor:'pointer',
      }}>
      {/* 主题 — coin head, NOT grid-aligned */}
      <div style={{display:'flex', alignItems:'center', gap:11, marginBottom:16}}>
        <div style={{
          width:34, height:34, borderRadius:'50%', flexShrink:0,
          background:o.c, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:13, fontWeight:700, fontFamily:M.mono,
          boxShadow:`0 2px 8px ${o.c}33`,
        }}>{o.sym[0]}</div>
        <span style={{fontSize:17, fontWeight:700, color:M.text, letterSpacing:0.2}}>{o.sym}</span>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'3px 9px', borderRadius:6,
          background: buy ? M.upSoft : M.dnSoft, color: sideCol,
          fontSize:11.5, fontWeight:600, fontFamily:M.mono, whiteSpace:'nowrap',
        }}>
          <span>{o.side}</span>
          <span style={{color:M.mid}}>{o.type}</span>
        </span>
      </div>

      {/* aligned data grid: col1 left · col2 center · col3 right */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', rowGap:15, columnGap:6}}>
        <OrderCell label="时间"        align="left"   value={o.time} truncate/>
        <OrderCell label="价值"        align="center" value={`$ ${o.value}`}/>
        <OrderCell label={`数量 (${o.sym})`} align="right" value={o.qty}/>

        <OrderCell label="触发条件"    align="left"   value={o.trig}/>
        <OrderCell label="状态"        align="center" value={o.status}/>
        <OrderCell label="订单 ID"     align="right"  value={o.id} truncate/>
      </div>
    </div>
  );
}

/* ===== 最近成交 data + atoms ===== */
const RECENT_TRADES = [
  { id:'t1', sym:'ZEC', c:'#F4B728', action:'平空', kind:'减仓',
    time:'少于一分钟前', timeN:3,
    qty:'4.69',  qtyN:4.69,  start:'-1,142.75', startN:-1142.75,
    price:'531.75', priceN:531.75, pnl:'71.51', pnlN:71.51,
    fee:'0.29 USDC', feeN:0.29 },
  { id:'t2', sym:'ZEC', c:'#F4B728', action:'平空', kind:'减仓',
    time:'少于一分钟前', timeN:2,
    qty:'2.47',  qtyN:2.47,  start:'-1,145.22', startN:-1145.22,
    price:'531.75', priceN:531.75, pnl:'37.66', pnlN:37.66,
    fee:'0.15 USDC', feeN:0.15 },
  { id:'t3', sym:'ZEC', c:'#F4B728', action:'平空', kind:'减仓',
    time:'少于一分钟前', timeN:1,
    qty:'0.01',  qtyN:0.01,  start:'-1,145.23', startN:-1145.23,
    price:'531.75', priceN:531.75, pnl:'0.15', pnlN:0.15,
    fee:'0.00 USDC', feeN:0.00 },
];

const ICO_SHARE = 'M12 14V4M12 4l-3.2 3.2M12 4l3.2 3.2M6 11.5V18a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 18v-6.5';

function RecentTradeRow({ t }) {
  const [press, setPress] = React.useState(false);
  // 平空 / 开多 = 多头方向(绿); 平多 / 开空 = 空头方向(红)
  const longSide = t.action === '平空' || t.action === '开多';
  const sideCol = longSide ? M.up : M.dn;
  const pnlCol  = t.pnlN >= 0 ? M.up : M.dn;
  const sign = (n) => (n >= 0 ? '$ ' : '$ -');
  return (
    <div
      onTouchStart={()=>setPress(true)} onTouchEnd={()=>setPress(false)}
      onMouseDown={()=>setPress(true)} onMouseUp={()=>setPress(false)}
      onMouseLeave={()=>setPress(false)}
      style={{
        background: press ? M.soft : 'transparent',
        borderBottom:`1px solid ${M.borderSoft}`,
        padding:'16px 14px 18px', transition:'background .12s', cursor:'pointer',
      }}>
      {/* 主题 — coin head, NOT grid-aligned */}
      <div style={{display:'flex', alignItems:'center', gap:11, marginBottom:16}}>
        <div style={{
          width:34, height:34, borderRadius:'50%', flexShrink:0,
          background:t.c, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:13, fontWeight:700, fontFamily:M.mono,
          boxShadow:`0 2px 8px ${t.c}33`,
        }}>{t.sym[0]}</div>
        <span style={{fontSize:17, fontWeight:700, color:M.text, letterSpacing:0.2}}>{t.sym}</span>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'3px 9px', borderRadius:6,
          background: longSide ? M.upSoft : M.dnSoft, color: sideCol,
          fontSize:11.5, fontWeight:600, fontFamily:M.mono, whiteSpace:'nowrap',
        }}>
          <span>{t.action}</span>
          <span style={{color:M.mid}}>{t.kind}</span>
        </span>
        <div style={{flex:1}}/>
        <button onClick={(e)=>e.stopPropagation()} style={{
          width:30, height:30, padding:0, border:0, background:'transparent', cursor:'pointer',
          color:M.dim, display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICO_SHARE}/>
          </svg>
        </button>
      </div>

      {/* aligned data grid: col1 left · col2 center · col3 right */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', rowGap:15, columnGap:6}}>
        <PerpCell label="时间"            align="left"   value={t.time}/>
        <PerpCell label="数量"            align="center" value={`${t.qty} ${t.sym}`}/>
        <PerpCell label={`起始仓位 (${t.sym})`} align="right" value={t.start}/>

        <PerpCell label="价格"     align="left"   value={`$ ${t.price}`}/>
        <PerpCell label="已平盈亏" align="center" value={`${sign(t.pnlN)}${t.pnl.replace('-','')}`} color={pnlCol}/>
        <PerpCell label="费用"     align="right"  value={t.fee}/>
      </div>
    </div>
  );
}

/* ===== 历史委托 data + atoms ===== */
const HIST_ORDERS = [
  { id:'447178382890', sym:'ZEC', c:'#F4B728', side:'买入',
    time:'少于一分钟前', timeN:3, type:'限价',
    qty:'7.2',  qtyN:7.2,  price:'531.74', priceN:531.74,
    trig:'–', status:'挂单' },
  { id:'447178361787', sym:'ZEC', c:'#F4B728', side:'买入',
    time:'少于一分钟前', timeN:2, type:'限价',
    qty:'0',    qtyN:0,    price:'531.70', priceN:531.70,
    trig:'–', status:'撤单' },
  { id:'447177920441', sym:'SOL', c:'#9945FF', side:'卖出',
    time:'3 分钟前', timeN:1, type:'市价',
    qty:'215',  qtyN:215,  price:'198.42', priceN:198.42,
    trig:'–', status:'已成交' },
];

function HistOrderRow({ o }) {
  const [press, setPress] = React.useState(false);
  const buy = o.side === '买入';
  const sideCol = buy ? M.up : M.dn;
  const statusCol = o.status === '已成交' ? M.up
                  : o.status === '撤单'  ? M.dim
                  : M.text;
  return (
    <div
      onTouchStart={()=>setPress(true)} onTouchEnd={()=>setPress(false)}
      onMouseDown={()=>setPress(true)} onMouseUp={()=>setPress(false)}
      onMouseLeave={()=>setPress(false)}
      style={{
        background: press ? M.soft : 'transparent',
        borderBottom:`1px solid ${M.borderSoft}`,
        padding:'16px 14px 18px', transition:'background .12s', cursor:'pointer',
      }}>
      {/* 主题 — coin head, NOT grid-aligned */}
      <div style={{display:'flex', alignItems:'center', gap:11, marginBottom:16}}>
        <div style={{
          width:34, height:34, borderRadius:'50%', flexShrink:0,
          background:o.c, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:13, fontWeight:700, fontFamily:M.mono,
          boxShadow:`0 2px 8px ${o.c}33`,
        }}>{o.sym[0]}</div>
        <span style={{fontSize:17, fontWeight:700, color:M.text, letterSpacing:0.2}}>{o.sym}</span>
        <span style={{
          display:'inline-flex', alignItems:'center',
          padding:'3px 10px', borderRadius:6,
          background: buy ? M.upSoft : M.dnSoft, color: sideCol,
          fontSize:11.5, fontWeight:600, fontFamily:M.mono, whiteSpace:'nowrap',
        }}>{o.side}</span>
      </div>

      {/* aligned data grid: col1 left · col2 center · col3 right */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', rowGap:15, columnGap:6}}>
        <OrderCell label="时间"            align="left"   value={o.time}/>
        <OrderCell label="类型"            align="center" value={o.type}/>
        <OrderCell label={`数量 (${o.sym})`} align="right" value={o.qty}/>

        <OrderCell label="价格"     align="left"   value={`$ ${o.price}`}/>
        <div/>
        <OrderCell label="触发条件" align="right"  value={o.trig}/>

        <OrderCell label="执行状态" align="left"   value={o.status} color={statusCol}/>
        <div/>
        <OrderCell label="订单 ID"  align="right"  value={`# ${o.id}`} truncate/>
      </div>
    </div>
  );
}

/* portfolio summary — total value, 24h change, allocation bar + legend */
function SpotSummary() {
  const total = SPOT_HOLDINGS.reduce((s,h)=>s + h.valueN, 0);
  const dayAbs = SPOT_HOLDINGS.reduce((s,h)=>s + h.valueN * h.chg / 100, 0);
  const prev = total - dayAbs;
  const dayPct = prev > 0 ? (dayAbs / prev) * 100 : 0;
  const up = dayAbs >= 0;
  const col = up ? M.up : M.dn;
  const fmt2 = (n)=> n.toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2});
  const absStr = '$' + Math.abs(dayAbs).toLocaleString('en-US',{maximumFractionDigits:0});

  return (
    <div style={{padding:'18px 16px 16px'}}>
      <div style={{fontSize:12, color:M.dim, marginBottom:7}}>现货总价值</div>
      <div style={{
        fontSize:31, fontWeight:800, color:M.text, fontFamily:M.mono,
        letterSpacing:-0.6, lineHeight:1,
      }}>${fmt2(total)}</div>

      <div style={{display:'flex', alignItems:'center', gap:8, marginTop:10}}>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:5,
          padding:'3px 9px', borderRadius:999,
          background: up ? M.upSoft : M.dnSoft, color:col,
          fontSize:12, fontWeight:700, fontFamily:M.mono,
        }}>
          <span style={{fontSize:9}}>{up ? '▲' : '▼'}</span>
          {(up?'+':'-')}{absStr}
          <span style={{opacity:0.8}}>({up?'+':''}{dayPct.toFixed(2)}%)</span>
        </span>
        <span style={{fontSize:11, color:M.dim}}>近 24 小时</span>
      </div>

      {/* allocation stacked bar */}
      <div style={{
        display:'flex', height:10, borderRadius:999, overflow:'hidden',
        marginTop:18, gap:2, background:M.soft,
      }}>
        {SPOT_HOLDINGS.map(h => (
          <div key={h.sym} style={{width:`${h.share}%`, background:h.c}}/>
        ))}
      </div>

      {/* legend */}
      <div style={{display:'flex', flexWrap:'wrap', gap:'8px 18px', marginTop:12}}>
        {SPOT_HOLDINGS.map(h => (
          <span key={h.sym} style={{display:'inline-flex', alignItems:'center', gap:6}}>
            <span style={{width:9, height:9, borderRadius:3, background:h.c}}/>
            <span style={{fontSize:12, fontWeight:600, color:M.text}}>{h.sym}</span>
            <span style={{fontSize:11.5, color:M.dim, fontFamily:M.mono}}>{h.share.toFixed(2)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CoinFilter({ value, options, onChange, label='币种筛选' }) {
  const [open, setOpen] = React.useState(false);
  const active = value && value !== '全部';
  return (
    <React.Fragment>
      <span onClick={()=>setOpen(true)} style={{
        fontSize:11, color: active ? M.violet : M.dim, fontWeight: active ? 600 : 500,
        whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer',
        userSelect:'none', WebkitTapHighlightColor:'transparent',
      }}>
        {active ? value : label}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{opacity:0.5}}>
          <path d={ICO_FILTER}/>
        </svg>
      </span>
      {open && (
        <div onClick={()=>setOpen(false)} style={{
          position:'absolute', inset:0, zIndex:90,
          background:'rgba(15,11,34,0.55)', animation:'m-fade-in .18s ease-out',
        }}>
          <div onClick={(e)=>e.stopPropagation()} style={{
            position:'absolute', left:0, right:0, bottom:0,
            background:M.elev, borderRadius:'20px 20px 0 0',
            boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
            display:'flex', flexDirection:'column', maxHeight:'72%',
            animation:'m-slide-up .26s cubic-bezier(.2,.8,.2,1)',
          }}>
            <div style={{width:42, height:4, borderRadius:2, background:M.border, margin:'10px auto 0'}}/>
            <div style={{padding:'12px 16px 6px', fontSize:14, fontWeight:700, color:M.text}}>
              币种筛选
            </div>
            <div style={{padding:'0 8px 6px', overflowY:'auto'}}>
              {options.map(o => {
                const on = o === value;
                return (
                  <button
                    key={o}
                    onClick={()=>{ onChange(o); setOpen(false); }}
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
              <button onClick={()=>setOpen(false)} style={{
                width:'100%', height:46, border:0, cursor:'pointer',
                background:'transparent', color:M.text,
                fontSize:14, fontWeight:600, fontFamily:'inherit',
              }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

function SpotSortLabel({ label, sort, filter, state, onClick }) {
  const active = !!state;
  return (
    <span onClick={onClick} style={{
      fontSize:11, color: active ? M.violet : M.dim, fontWeight: active ? 600 : 500,
      whiteSpace:'nowrap',
      display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer',
      userSelect:'none', WebkitTapHighlightColor:'transparent',
    }}>
      {label}
      {sort && (
        <span style={{display:'inline-flex', flexDirection:'column', lineHeight:0, gap:2}}>
          {/* up caret — 升序 */}
          <svg width="7" height="4" viewBox="0 0 8 5" fill="currentColor" style={{
            color: state==='asc' ? M.violet : M.faint,
            opacity: state==='asc' ? 1 : 0.6,
          }}>
            <path d="M4 0l4 5H0z"/>
          </svg>
          {/* down caret — 降序 */}
          <svg width="7" height="4" viewBox="0 0 8 5" fill="currentColor" style={{
            color: state==='desc' ? M.violet : M.faint,
            opacity: state==='desc' ? 1 : 0.6,
          }}>
            <path d="M4 5L0 0h8z"/>
          </svg>
        </span>
      )}
      {filter && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{opacity:0.5}}>
          <path d={ICO_FILTER}/>
        </svg>
      )}
    </span>
  );
}

function SpotHoldingRow({ h }) {
  const [press, setPress] = React.useState(false);
  const up = h.chg >= 0;
  return (
    <div
      onTouchStart={()=>setPress(true)} onTouchEnd={()=>setPress(false)}
      onMouseDown={()=>setPress(true)} onMouseUp={()=>setPress(false)}
      onMouseLeave={()=>setPress(false)}
      style={{
        background: press ? M.soft : 'transparent',
        borderBottom:`1px solid ${M.borderSoft}`,
        padding:'16px 16px 18px', transition:'background .12s', cursor:'pointer',
      }}>
      {/* coin head: logo + symbol + chain + 24h badge */}
      <div style={{display:'flex', alignItems:'center', gap:11, marginBottom:14}}>
        <div style={{
          width:38, height:38, borderRadius:'50%', flexShrink:0,
          background:h.c, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:14, fontWeight:700, fontFamily:M.mono,
          boxShadow:`0 2px 8px ${h.c}33`,
        }}>{h.sym[0]}</div>
        <span style={{fontSize:18, fontWeight:700, color:M.text, letterSpacing:0.2}}>{h.sym}</span>
        <div style={{flex:1}}/>
      </div>

      {/* 资产份额 */}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11, color:M.dim, marginBottom:6}}>资产份额</div>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <span style={{
            fontSize:16, fontWeight:700, color:M.text, fontFamily:M.mono, minWidth:64,
          }}>{h.share.toFixed(2)}%</span>
          <div style={{flex:1, height:7, borderRadius:99, background:M.soft, overflow:'hidden'}}>
            <div style={{
              width:`${h.share}%`, height:'100%', borderRadius:99,
              background:'#7C5CFF',
            }}/>
          </div>
        </div>
      </div>

      {/* 金额 / 价格 / 价值 — labeled */}
      <div style={{display:'grid', gridTemplateColumns:'1.25fr 0.85fr 1fr', gap:10}}>
        <div style={{textAlign:'left', minWidth:0}}>
          <div style={{fontSize:11, color:M.dim, marginBottom:4}}>金额</div>
          <div style={{
            fontSize:12, fontWeight:600, color:M.text, fontFamily:M.mono,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>{h.qty} <span style={{color:M.dim}}>{h.sym}</span></div>
        </div>
        <div style={{textAlign:'center', minWidth:0}}>
          <div style={{fontSize:11, color:M.dim, marginBottom:4}}>价格</div>
          <div style={{
            fontSize:12, fontWeight:600, color:M.text, fontFamily:M.mono,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>$ {h.price}</div>
        </div>
        <div style={{textAlign:'right', minWidth:0}}>
          <div style={{fontSize:11, color:M.dim, marginBottom:4}}>价值</div>
          <div style={{
            fontSize:13, fontWeight:700, color:M.text, fontFamily:M.mono,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>$ {h.value}</div>
        </div>
      </div>
    </div>
  );
}

/* ============= 交易统计 modal (PC double-click) ============= */
function WhaleTradeStats({ w, onClose }) {
  const [period, setPeriod] = React.useState('1周');
  const [subtab, setSubtab] = React.useState('按资产的表现');
  const winRate = w.win;
  const tradesTotal = w.trades;
  const wins = Math.round(tradesTotal * (winRate / 100));
  const losses = tradesTotal - wins;
  // pnl figures — strip the leading sign so the card controls the color, and
  // derive a fee-adjusted figure (~96% of raw pnl) as a realistic placeholder
  const pnlPos = !!w.pnlPos;
  const pnlText = (w.pnl || '').replace(/^[+\-]?\$?/, '');
  const feeAdjText = pnlText.replace(/[\d,]+(\.\d+)?/, (n) => {
    const num = parseFloat(n.replace(/,/g, ''));
    if (!isFinite(num)) return n;
    const reduced = num * 0.96;
    return reduced.toLocaleString('en-US', {
      maximumFractionDigits: reduced >= 1000 ? 0 : 2,
    });
  });

  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, zIndex:70,
      background:'rgba(15,11,34,0.55)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div onClick={(e)=>e.stopPropagation()} style={{
        width:'100%', maxHeight:'88%', background:M.bg,
        borderRadius:'16px 16px 0 0', display:'flex', flexDirection:'column',
        overflow:'hidden', boxShadow:'0 -16px 48px rgba(15,11,34,0.32)',
        animation:'wd-slide-up .22s ease-out',
      }}>
        {/* head */}
        <div style={{padding:'14px 16px 12px', display:'flex', alignItems:'center'}}>
          <span style={{fontSize:15, fontWeight:700, color:M.text}}>交易统计</span>
          <div style={{flex:1}}/>
          <button onClick={onClose} style={{
            width:30, height:30, padding:0, borderRadius:8, border:0, background:'transparent',
            cursor:'pointer', color:M.mid,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICO_X}/>
            </svg>
          </button>
        </div>

        {/* address row */}
        <div style={{padding:'0 16px 12px', display:'flex', alignItems:'center', gap:8}}>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:8,
            padding:'5px 10px 5px 5px', borderRadius:999,
            background:M.soft,
          }}>
            <WhaleAvatar w={w} size={22}/>
            <span style={{fontSize:12, fontWeight:600, color:M.text, fontFamily:M.mono}}>{w.id}</span>
          </span>
          <div style={{flex:1}}/>
          <PillSelect value={period} options={['1天','1周','1月','全部']} onChange={setPeriod}/>
        </div>

        {/* 2 stat cards */}
        <div style={{padding:'0 12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          {/* card 1: win rate */}
          <div style={{
            background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:12,
            padding:'12px', display:'flex', flexDirection:'column', minWidth:0,
          }}>
            <div style={{display:'flex', alignItems:'center', gap:4}}>
              <span style={{fontSize:11, color:M.mid}}>胜率</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:M.faint}}>
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
              </svg>
            </div>
            <div style={{
              fontSize:22, fontWeight:700, color:M.text, fontFamily:M.mono,
              marginTop:4, letterSpacing:-0.4, lineHeight:1,
            }}>{winRate.toFixed(2)}%</div>

            <div style={{
              marginTop:12, paddingTop:10, borderTop:`1px solid ${M.borderSoft}`,
              display:'flex', flexDirection:'column', gap:9,
            }}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:9.5, color:M.dim, letterSpacing:0.2, marginBottom:2}}>
                  已平仓盈亏
                </div>
                <div style={{
                  fontSize:12, fontWeight:700, fontFamily:M.mono,
                  color:M.up, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>{pnlPos ? '+' : ''}${pnlText}</div>
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:9.5, color:M.dim, letterSpacing:0.2, marginBottom:2}}>
                  扣除费用后
                </div>
                <div style={{
                  fontSize:12, fontWeight:700, fontFamily:M.mono,
                  color:M.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>{pnlPos ? '+' : ''}${feeAdjText}</div>
              </div>
            </div>
          </div>

          {/* card 2: trade count */}
          <div style={{
            background:M.elev, border:`1px solid ${M.borderSoft}`, borderRadius:12,
            padding:'12px', display:'flex', flexDirection:'column', minWidth:0,
          }}>
            <div style={{fontSize:11, color:M.mid}}>交易次数</div>
            <div style={{
              fontSize:22, fontWeight:700, color:M.text, fontFamily:M.mono,
              marginTop:4, letterSpacing:-0.4, lineHeight:1,
            }}>{tradesTotal}</div>

            <div style={{
              marginTop:12, paddingTop:10, borderTop:`1px solid ${M.borderSoft}`,
              display:'flex', alignItems:'center', gap:10,
            }}>
              <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:6}}>
                <LegendRow color={M.up} label="盈利" v={wins}/>
                <LegendRow color={M.dn} label="亏损" v={losses}/>
              </div>
              <DonutTwo a={wins} b={losses}/>
            </div>
          </div>
        </div>

        {/* performance breakdown section */}
        <div style={{padding:'16px 16px 0', display:'flex', alignItems:'baseline', justifyContent:'space-between'}}>
          <div style={{fontSize:14, fontWeight:700, color:M.text}}>盈亏表现</div>
        </div>

        <div style={{padding:'10px 16px 0', display:'flex', gap:18, borderBottom:`1px solid ${M.borderSoft}`}}>
          {['按资产的表现','按仓位的表现'].map(t => {
            const on = t === subtab;
            return (
              <button key={t} onClick={()=>setSubtab(t)} style={{
                background:'transparent', border:0, padding:'8px 0', cursor:'pointer',
                color: on ? M.violet : M.mid, fontWeight: on?700:500, fontSize:12,
                borderBottom: on ? `2px solid ${M.violet}` : '2px solid transparent',
                fontFamily:'inherit', whiteSpace:'nowrap',
              }}>{t}</button>
            );
          })}
        </div>

        {/* per-asset / per-position performance list (图一 信息结构) */}
        <div style={{flex:1, overflow:'auto', padding:'4px 16px 20px'}}>
          {tradesTotal === 0 || winRate < 0.01 ? (
            <div style={{padding:'40px 0', textAlign:'center', fontSize:12, color:M.faint}}>
              暂无成交记录
            </div>
          ) : (
            <div style={{
              background:M.elev, border:`1px solid ${M.borderSoft}`,
              borderRadius:14, padding:'2px 14px',
            }}>
              {(subtab === '按资产的表现' ? ASSET_PERF : POS_PERF).map((d,i,arr) => (
                <PerfRow key={(d.sym||'') + (d.side||'') + i} d={d} last={i === arr.length-1}/>
              ))}
            </div>
          )}
        </div>

        <style>{`
          @keyframes wd-slide-up {
            from { transform: translateY(20px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}

/* 按资产的表现 — 每个资产的成交笔数 / 净盈亏 / 费用（图一信息结构） */
const ASSET_PERF = [
  { sym:'ZEC',  glyph:'Z', c:'#ECB244', n:2, pos:true,  pnl:'181,101.72', fee:'3,710.62' },
  { sym:'LIT',  glyph:'L', c:'#A855F7', n:2, pos:true,  pnl:'127,982.60', fee:'935.49'   },
  { sym:'ONDO', glyph:'O', c:'#E0537B', n:1, pos:true,  pnl:'46,312.41',  fee:'309.18'   },
  { sym:'LTC',  glyph:'L', c:'#B6B6BE', n:1, pos:true,  pnl:'5,335.46',   fee:'311.53'   },
  { sym:'BRENTOIL', label:'xyz:BRENTOIL', glyph:'X', c:'#7C5CFF', n:1, pos:false, pnl:'496.25', fee:'24.13' },
  { sym:'XMR',  glyph:'M', c:'#FF6600', n:1, pos:false, pnl:'1,707.61',   fee:'142.80'   },
];
/* 按仓位的表现 — 每个仓位的方向 / 开仓时间 / 规模 / 费用（图三信息结构） */
const POS_PERF = [
  { sym:'XMR',      glyph:'M', c:'#FF6600', side:'做空', time:'8 小时前', pos:true,  pnl:'5,005.31',   size:'0.41 XMR',      fee:'25.03'   },
  { sym:'TSLA',     label:'xyz:TSLA',  glyph:'X', c:'#7C5CFF', side:'做空', time:'约 1 天前', pos:false, pnl:'63,798.34',  size:'1.00 xyz:TSLA', fee:'230.10'  },
  { sym:'BTC',      glyph:'B', c:'#F7931A', side:'做空', time:'约 1 天前', pos:true,  pnl:'580,461.17', size:'0.04 BTC',      fee:'6,237.42' },
  { sym:'CL',       label:'xyz:CL',    glyph:'X', c:'#E0537B', side:'做空', time:'约 2 天前', pos:true,  pnl:'945,883.29', size:'0.10 xyz:CL',   fee:'1,262.61' },
  { sym:'GOLD',     label:'xyz:GOLD',  glyph:'X', c:'#22D3EE', side:'做空', time:'约 4 天前', pos:true,  pnl:'185,428.79', size:'0.01 xyz:GOLD', fee:'7,283.66' },
];

/* "$ +181,101.72" — 美元符 + 空格 + 正负号 + 数字（与图一一致） */
function fmtMoney(pos, num) {
  return `$ ${pos ? '+' : '−'}${num}`;
}

/* 单行：资产 / 仓位的表现 —— 紧凑移动端尺寸，沿用既有暗色主题 token */
function PerfRow({ d, last }) {
  const col   = d.pos ? M.up : M.dn;
  const isPos = !!d.size;                 // 仓位模式：显示 做多/做空 + 时间 + 规模
  const subtitle = isPos ? d.time : `${d.n} 笔交易`;
  return (
    <div style={{padding:'14px 0', borderBottom: last ? 0 : `1px solid ${M.borderSoft}`}}>
      {/* 身份行：图标 + 名称 / 方向 / 副标题 + 头部盈亏 */}
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <div style={{
          width:38, height:38, borderRadius:'50%', background:d.c, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:15, fontWeight:700, fontFamily:M.mono, flexShrink:0,
        }}>{d.glyph || (d.sym || '?')[0]}</div>
        <div style={{minWidth:0, flex:1}}>
          <div style={{display:'flex', alignItems:'center', gap:7}}>
            <span style={{fontSize:15, fontWeight:600, color:M.text, whiteSpace:'nowrap'}}>{d.label || d.sym}</span>
            {d.side && (
              <span style={{
                fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:6, flexShrink:0,
                color: d.side === '做多' ? M.up : M.dn,
                background: d.side === '做多' ? 'var(--mk-up-soft)' : 'var(--mk-dn-soft)',
              }}>{d.side}</span>
            )}
          </div>
          <div style={{fontSize:12, color:M.dim, marginTop:3}}>{subtitle}</div>
        </div>
        <div style={{
          fontSize:16, fontWeight:700, color:col, fontFamily:M.mono,
          whiteSpace:'nowrap', flexShrink:0,
        }}>{fmtMoney(d.pos, d.pnl)}</div>
      </div>
      {/* 指标行：净盈亏(资产) / 规模(仓位)  +  费用（满宽两列） */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:11}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:11.5, color:M.dim, marginBottom:4}}>{isPos ? '规模' : '净盈亏'}</div>
          <div style={{
            fontSize:13.5, fontWeight:600, fontFamily:M.mono, whiteSpace:'nowrap',
            color: isPos ? M.text : col,
          }}>{isPos ? d.size : fmtMoney(d.pos, d.pnl)}</div>
        </div>
        <div style={{minWidth:0, textAlign:'right'}}>
          <div style={{fontSize:11.5, color:M.dim, marginBottom:4}}>费用</div>
          <div style={{fontSize:13.5, fontWeight:600, color:M.up, fontFamily:M.mono, whiteSpace:'nowrap'}}>
            {fmtMoney(true, d.fee)}
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendRow({ color, label, v }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:6, fontSize:11, minWidth:0}}>
      <span style={{
        width:6, height:6, borderRadius:'50%', background:color, flexShrink:0,
      }}/>
      <span style={{color:M.mid, flexShrink:0}}>{label}</span>
      <div style={{flex:1}}/>
      <span style={{
        fontFamily:M.mono, fontWeight:700, color:M.text,
        whiteSpace:'nowrap',
      }}>{v}</span>
    </div>
  );
}

function DonutTwo({ a, b }) {
  const sum = a + b || 1;
  const r = 22, cc = 2*Math.PI*r;
  const aLen = cc * (a/sum);
  const bLen = cc * (b/sum);
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" style={{flexShrink:0}}>
      <circle cx="30" cy="30" r={r} fill="none" stroke={M.dn} strokeWidth="7"
        strokeDasharray={`${bLen} ${cc-bLen}`} strokeDashoffset={cc/4} transform="rotate(0 30 30)"/>
      <circle cx="30" cy="30" r={r} fill="none" stroke={M.up} strokeWidth="7"
        strokeDasharray={`${aLen} ${cc-aLen}`} strokeDashoffset={cc/4 - bLen} transform="rotate(0 30 30)"/>
      <text x="30" y="35" textAnchor="middle"
        style={{fontSize:13, fontWeight:700, fill:M.text, fontFamily:'var(--mono, ui-monospace)'}}>
        {a + b}
      </text>
    </svg>
  );
}

Object.assign(window, { WhaleDiscoverNew, WhaleProfileDetail, WhaleTradeStats, WHALE_PROFILES });

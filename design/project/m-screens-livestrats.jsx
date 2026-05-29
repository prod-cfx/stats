/* ========================================================================
   SCREEN — 实盘策略 (Live Strategies)
   入口:我的 → 实盘策略  /  部署成功 → 查看实盘策略
   ======================================================================== */

/* exchange logo SVG marks — recognizable simplified versions */
function LsExSvg({ ex }) {
  if (ex === 'Binance') return (
    <svg viewBox="0 0 32 32" width="72%" height="72%">
      <g fill="#F3BA2F">
        <polygon points="16,6 26,16 16,26 6,16" />
        <polygon points="16,2 18.5,4.5 16,7 13.5,4.5" />
        <polygon points="16,25 18.5,27.5 16,30 13.5,27.5" />
        <polygon points="2,16 4.5,13.5 7,16 4.5,18.5" />
        <polygon points="25,16 27.5,13.5 30,16 27.5,18.5" />
      </g>
    </svg>);

  if (ex === 'OKX') return (
    <svg viewBox="0 0 32 32" width="66%" height="66%">
      <g fill="#fff">
        <rect x="3" y="3" width="8" height="8" />
        <rect x="12" y="12" width="8" height="8" />
        <rect x="3" y="21" width="8" height="8" />
        <rect x="21" y="3" width="8" height="8" />
        <rect x="21" y="21" width="8" height="8" />
      </g>
    </svg>);

  if (ex === 'Bybit') return (
    <svg viewBox="0 0 32 32" width="60%" height="60%">
      <g fill="#1A1A1A">
        <rect x="5" y="6" width="4" height="20" />
        <rect x="9" y="6" width="11" height="4" />
        <rect x="9" y="14" width="11" height="4" />
        <rect x="9" y="22" width="14" height="4" />
        <rect x="20" y="10" width="4" height="4" />
        <rect x="23" y="18" width="4" height="4" />
      </g>
    </svg>);

  if (ex === 'Hyperliquid') return (
    <svg viewBox="0 0 32 32" width="62%" height="62%">
      <g fill="#7CFFCB">
        <rect x="5" y="5" width="5" height="22" rx="1" />
        <rect x="22" y="5" width="5" height="22" rx="1" />
        <rect x="5" y="13.5" width="22" height="5" />
      </g>
    </svg>);

  return null;
}

const LIVE_STRATS = [
{
  id: 'QF-AY7K2P',
  name: 'BTC 趋势 · 双均线',
  pair: 'BTC/USDT',
  tf: '15m',
  ex: 'Binance',
  exGlyph: 'B', exBg: '#181A20', exFg: '#F3BA2F',
  market: '合约 5x',
  status: 'running', // running | paused | stopped | warning
  runFor: '14 天',
  todayPct: +2.04,
  todayPnl: +204.16,
  totalPct: +18.42,
  totalPnl: +1842.20,
  capital: 10000,
  trades: 47,
  winRate: 55.3,
  spark: [100, 102, 101, 104, 106, 105, 108, 109, 107, 112, 114, 115, 118, 116, 120, 119, 123, 127, 126, 130]
},
{
  id: 'QF-9MX31R',
  name: 'ETH 均值回归 · 4H',
  pair: 'ETH/USDT',
  tf: '4H',
  ex: 'Binance',
  exGlyph: 'B', exBg: '#181A20', exFg: '#F3BA2F',
  market: '现货',
  status: 'running',
  runFor: '32 天',
  todayPct: -0.42,
  todayPnl: -21.50,
  totalPct: +9.12,
  totalPnl: +456.20,
  capital: 5000,
  trades: 23,
  winRate: 60.9,
  spark: [100, 101, 99, 102, 103, 101, 104, 105, 103, 106, 107, 105, 108, 110, 108, 111, 112, 110, 113, 109]
},
{
  id: 'QF-DK4F71',
  name: '资金费率套利',
  pair: '多币种',
  tf: '1H',
  ex: 'OKX',
  exGlyph: 'O', exBg: '#000', exFg: '#fff',
  market: '永续',
  status: 'warning',
  statusNote: '日内亏损接近上限',
  runFor: '7 天',
  todayPct: -3.84,
  todayPnl: -76.80,
  totalPct: +1.04,
  totalPnl: +20.80,
  capital: 2000,
  trades: 156,
  winRate: 72.4,
  spark: [100, 100, 101, 101, 102, 103, 103, 104, 104, 105, 106, 107, 106, 105, 104, 103, 102, 101, 100, 99]
},
{
  id: 'QF-2H8N5W',
  name: 'SOL 网格 · 区间震荡',
  pair: 'SOL/USDT',
  tf: '1H',
  ex: 'Binance',
  exGlyph: 'B', exBg: '#181A20', exFg: '#F3BA2F',
  market: '现货',
  status: 'paused',
  statusNote: '已暂停 · 等待恢复',
  runFor: '21 天',
  todayPct: 0,
  todayPnl: 0,
  totalPct: +12.80,
  totalPnl: +384.00,
  capital: 3000,
  trades: 84,
  winRate: 58.3,
  spark: [100, 104, 99, 103, 98, 102, 97, 101, 99, 103, 98, 104, 100, 106, 102, 108, 104, 110, 113, 112]
},
{
  id: 'QF-5J1RT8',
  name: 'BNB 高频做市',
  pair: 'BNB/USDT',
  tf: '1m',
  ex: 'OKX',
  exGlyph: 'O', exBg: '#000', exFg: '#fff',
  market: '合约 3x',
  status: 'stopped',
  statusNote: '已停止 · 28 天后永久删除',
  deletedAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
  runFor: '11 天',
  todayPct: 0,
  todayPnl: 0,
  totalPct: -4.20,
  totalPnl: -84.00,
  capital: 2000,
  trades: 312,
  winRate: 48.7,
  spark: [100, 102, 99, 101, 98, 100, 97, 99, 96, 98, 95, 97, 94, 96, 93, 95, 94, 96, 95, 96]
}];


/* shared state — survives navigation between list and detail */
if (!window.__qfLiveStrats) {
  window.__qfLiveStrats = LIVE_STRATS.slice();
  window.__qfSelectedStrat = LIVE_STRATS[0].id;
}

/* synthetic position data — running/warning strategies have an open position */
const STRAT_POSITIONS = {
  'QF-AY7K2P': {
    side: '多', pair: 'BTC/USDT',
    entry: 67420.5, current: 67950.2, qty: 0.0742,
    notional: 67420.5 * 0.0742,
    pnl: +39.30, pct: +0.78,
    stop: 66072.0, stopPct: -2.0,
    tp: 69443.0, tpPct: +3.0,
    holdFor: '4h 12m', lev: '5x'
  },
  'QF-DK4F71': {
    side: '空', pair: 'SOL/USDT',
    entry: 142.50, current: 144.20, qty: 14.0,
    notional: 142.50 * 14.0,
    pnl: -23.80, pct: -1.19,
    stop: 147.50, stopPct: -3.5,
    tp: 138.20, tpPct: +3.0,
    holdFor: '42m', lev: '永续'
  }
};
function getPosition(s) {
  if (s.status !== 'running' && s.status !== 'warning') return null;
  return STRAT_POSITIONS[s.id] || null;
}

/* compute days remaining in the 30-day retention window for a deleted strat */
function daysUntilHardDelete(deletedAt) {
  if (!deletedAt) return 30;
  const elapsed = (Date.now() - deletedAt) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(30 - elapsed));
}
function formatDeleteRetention(deletedAt = Date.now()) {
  return `${daysUntilHardDelete(deletedAt)} 天后永久删除`;
}

const LS_FILTERS = [
{ k: 'all', label: '全部' },
{ k: 'running', label: '运行中' },
{ k: 'paused', label: '已暂停' },
{ k: 'warning', label: '需关注' },
{ k: 'stopped', label: '已停止' }];


function useLiveStrats() {
  // forceUpdate via tick whenever the module-level array mutates
  const [, set] = React.useState(0);
  const refresh = React.useCallback(() => set((n) => n + 1), []);
  return { strats: window.__qfLiveStrats, refresh };
}

function ScreenLiveStrats() {
  const { strats, refresh } = useLiveStrats();
  const [filter, setFilter] = React.useState('all');
  const [menuFor, setMenuFor] = React.useState(null); // strat id whose action menu is open
  const [confirmDel, setConfirmDel] = React.useState(null);
  const [closeWithPos, setCloseWithPos] = React.useState(null); // strat being closed with open position

  // 'all' shows everything EXCEPT stopped (stopped lives in its own bucket)
  const list = strats.filter((s) => {
    if (filter === 'all') return s.status !== 'stopped';
    return s.status === filter;
  });

  // aggregates exclude stopped strategies (they no longer contribute)
  const active = strats.filter((s) => s.status !== 'stopped');
  const running = active.filter((s) => s.status === 'running').length;
  const stopped = strats.filter((s) => s.status === 'stopped').length;
  const totalCap = active.reduce((a, s) => a + s.capital, 0);
  const todayPnl = active.reduce((a, s) => a + s.todayPnl, 0);
  const totalPnl = active.reduce((a, s) => a + s.totalPnl, 0);

  const onToggle = (s) => {
    const i = strats.findIndex((x) => x.id === s.id);
    if (i < 0) return;
    if (s.status === 'stopped') {
      // restore — go back to paused so user can review before resuming
      strats[i] = { ...s, status: 'paused', statusNote: '已恢复 · 待开启', deletedAt: undefined };
    } else if (s.status === 'paused' || s.status === 'warning') {
      strats[i] = { ...s, status: 'running', statusNote: undefined };
    } else if (s.status === 'running') {
      strats[i] = { ...s, status: 'paused', statusNote: '已暂停 · 等待恢复' };
    }
    setMenuFor(null);
    refresh();
  };
  const onDelete = (s) => {
    const i = window.__qfLiveStrats.findIndex((x) => x.id === s.id);
    if (i < 0) {setConfirmDel(null);setMenuFor(null);return;}
    if (s.status === 'stopped') {
      // permanent delete from the stopped bucket
      window.__qfLiveStrats.splice(i, 1);
    } else {
      // soft delete — move to stopped, keep history
      window.__qfLiveStrats[i] = {
        ...window.__qfLiveStrats[i],
        status: 'stopped',
        statusNote: `已停止 · ${formatDeleteRetention()}`,
        deletedAt: Date.now(),
        todayPct: 0, todayPnl: 0
      };
    }
    setConfirmDel(null);
    setMenuFor(null);
    refresh();
  };
  const onView = (s) => {
    window.__qfSelectedStrat = s.id;
    setMenuFor(null);
    window.__nav?.go('liveDetail');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: M.bg }}>
      <MStatus />
      <MTopBar
        title="实盘策略"
        sub={`${strats.length} 个策略 · ${running} 运行中`}
        onBack
        backTo="me"
        right={
        <button style={{
          width: 36, height: 36, borderRadius: 18,
          background: M.elev, border: `1px solid ${M.border}`,
          color: M.mid, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <Ico d={ICONS.filter} w={16} sw={1.8} />
          </button>
        } />


      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 100px' }}>
        {/* aggregate summary */}
        <Card p="16px" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: M.dim, marginBottom: 4 }}>总资产 (持仓 + 可用)</div>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14,
            flexWrap: 'wrap'
          }}>
            <span style={{
              fontFamily: M.mono, fontSize: 28, fontWeight: 700,
              color: M.text, letterSpacing: -0.4
            }}>${(totalCap + totalPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <Chip tone={totalPnl >= 0 ? 'ok' : 'danger'} style={{ whiteSpace: 'nowrap' }}>
              {totalPnl >= 0 ? '+' : ''}{(totalPnl / totalCap * 100).toFixed(2)}%
            </Chip>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <LsAggStat
              label="今日盈亏"
              v={`${todayPnl >= 0 ? '+$' : '-$'}${Math.abs(todayPnl).toFixed(2)}`}
              tone={todayPnl >= 0 ? M.up : M.dn} />
            <LsAggStat
              label="累计盈亏"
              v={`${totalPnl >= 0 ? '+$' : '-$'}${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              tone={totalPnl >= 0 ? M.up : M.dn} />
            <LsAggStat
              label="投入本金"
              v={`$${totalCap.toLocaleString()}`}
              tone={M.text} />
          </div>
        </Card>

        {/* filter pills */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto',
          padding: '2px 0 8px', margin: '0 -16px'
        }}>
          <div style={{ width: 14, flexShrink: 0 }} />
          {LS_FILTERS.map((f) => {
            const on = filter === f.k;
            const count = f.k === 'all' ?
            strats.length :
            strats.filter((s) => s.status === f.k).length;
            return (
              <button key={f.k} onClick={() => setFilter(f.k)} style={{
                height: 32, padding: '0 12px', borderRadius: 999, flexShrink: 0,
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: on ? M.violetSoft : M.elev,
                color: on ? M.violet : M.mid,
                border: `1px solid ${on ? 'rgba(124,92,255,0.3)' : M.border}`,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                whiteSpace: 'nowrap'
              }}>
                {f.label}
                <span style={{
                  fontFamily: M.mono, fontSize: 11, fontWeight: 600,
                  color: on ? M.violet : M.dim, opacity: 0.8
                }}>{count}</span>
              </button>);

          })}
          <div style={{ width: 14, flexShrink: 0 }} />
        </div>

        {/* strategy cards */}
        {filter === 'stopped' && list.length > 0 &&
        <div style={{
          padding: '10px 12px', marginBottom: 10, borderRadius: 10,
          background: M.warnSoft, color: M.warn,
          fontSize: 11, lineHeight: 1.55,
          display: 'flex', gap: 8, alignItems: 'flex-start'
        }}>
            <Ico d={ICONS.shield} w={13} fill={M.warn} sw={0} />
            <span>
              已停止策略保留 30 天,期间可随时恢复或导出历史。超期后会自动永久删除。
            </span>
          </div>
        }

        {list.length === 0 ?
        <LsEmptyState filter={filter} /> :

        list.map((s) =>
        <LsStratCard
          key={s.id} s={s}
          onView={() => onView(s)}
          onToggle={() => onToggle(s)}
          onOpenMenu={() => setMenuFor(menuFor === s.id ? null : s.id)}
          menuOpen={menuFor === s.id}
          onAskDelete={() => {
            setMenuFor(null);
            const pos = getPosition(s);
            if (pos) setCloseWithPos(s);else
            setConfirmDel(s);
          }} />

        )
        }

        {list.length > 0 &&
        <button style={{
          width: '100%', height: 46, marginTop: 6, borderRadius: 12,
          border: `1.5px dashed ${M.border}`, background: 'transparent',
          color: M.mid, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}>
            <Ico d={ICONS.plus} w={14} sw={2} />
            从 AI 对话创建新策略
          </button>
        }
      </div>

      <MTabBar active="me" />

      {/* close-with-position sheet — running/warning strats that have a live position */}
      {closeWithPos &&
      <LsCloseWithPositionSheet
        s={closeWithPos}
        position={getPosition(closeWithPos)}
        onCancel={() => setCloseWithPos(null)}
        onConfirm={(mode) => {
          const i = window.__qfLiveStrats.findIndex((x) => x.id === closeWithPos.id);
          if (i < 0) {setCloseWithPos(null);return;}
          const s = window.__qfLiveStrats[i];
          const pos = getPosition(s);
          if (mode === 'natural') {
            // keep running until SL/TP triggers, then auto-stop
            window.__qfLiveStrats[i] = {
              ...s, status: 'running',
              statusNote: '关闭待生效 · 等待止损/止盈触发'
            };
          } else if (mode === 'keep') {
            // stop the bot, position kept on exchange — user handles manually
            window.__qfLiveStrats[i] = {
              ...s, status: 'stopped',
              statusNote: `已停止 · 持仓已转手动 · ${formatDeleteRetention()}`,
              deletedAt: Date.now(),
              todayPct: 0, todayPnl: 0
            };
          } else {
            // market — realize current PnL into total, then stop
            const realized = pos ? pos.pnl : 0;
            window.__qfLiveStrats[i] = {
              ...s, status: 'stopped',
              statusNote: `已停止 · 已平仓 ${realized >= 0 ? '+' : '-'}$${Math.abs(realized).toFixed(2)} · ${formatDeleteRetention()}`,
              deletedAt: Date.now(),
              todayPnl: s.todayPnl + realized,
              totalPnl: s.totalPnl + realized,
              todayPct: 0
            };
          }
          setCloseWithPos(null);
          refresh();
        }} />

      }

      {/* confirm-delete drawer */}
      <LsDeleteSheet
        open={!!confirmDel}
        name={confirmDel?.name}
        stopped={confirmDel?.status === 'stopped'}
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => onDelete(confirmDel)} />

    </div>);

}

/* shared delete confirm — bottom drawer (matches other 移除/删除 sheets) ------- */
function LsDeleteSheet({ open, name, stopped, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div onClick={onCancel} style={{
      position: 'absolute', inset: 0, zIndex: 90,
      background: 'rgba(15,11,34,0.55)',
      display: 'flex', alignItems: 'flex-end',
      animation: 'ls-fade .18s ease-out'
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', background: M.bg,
        borderRadius: '18px 18px 0 0',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -16px 48px rgba(15,11,34,0.32)',
        animation: 'ls-slide-up .22s ease-out',
        overflow: 'hidden'
      }}>
        {/* head */}
        <div style={{
          padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: `1px solid ${M.borderSoft}`
        }}>
          <span style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: M.dangerSoft, color: M.danger,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Ico d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
            w={15} sw={1.8} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: M.text, letterSpacing: -0.2 }}>
            {stopped ? '永久删除策略?' : '删除策略?'}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onCancel} aria-label="关闭" style={{
            width: 30, height: 30, padding: 0, borderRadius: 8, border: 0, background: 'transparent',
            cursor: 'pointer', color: M.mid,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Ico d="M6 6l12 12M18 6L6 18" w={15} sw={1.8} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '14px 16px 6px', height: "100px" }}>
          <div style={{ fontSize: 13, color: M.mid, lineHeight: 1.65 }}>
            {stopped ?
            <>「<strong style={{ color: M.text, fontWeight: 600 }}>{name}</strong>」的历史记录会被
                <strong style={{ color: M.danger, fontWeight: 600 }}> 立即永久删除</strong>,此操作不可撤销。</> :

            <>「<strong style={{ color: M.text, fontWeight: 600 }}>{name}</strong>」会立即停止运行,
                历史记录保留 <strong style={{ color: M.text, fontWeight: 600 }}>30 天</strong>,
                可在「已停止」中找回。</>
            }
          </div>
        </div>

        {/* footer */}
        <div style={{
          padding: '12px 16px 22px',
          borderTop: `1px solid ${M.borderSoft}`,
          display: 'flex', alignItems: 'center', gap: 10, background: M.elev, height: "100px"
        }}>
          <button onClick={onCancel} style={{
            flex: 1, height: 42, borderRadius: 10,
            border: `1px solid ${M.border}`, background: M.elev,
            color: M.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit'
          }}>取消</button>
          <button onClick={onConfirm} style={{
            flex: 1.4, height: 42, borderRadius: 10, border: 0,
            background: M.danger, color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: `0 6px 14px -8px ${M.danger}`
          }}>{stopped ? '永久删除' : '删除策略'}</button>
        </div>
      </div>
      <style>{`
        @keyframes ls-fade { from{opacity:0} to{opacity:1} }
        @keyframes ls-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>);

}

/* aggregate stat ------------------------------------------------------- */
function LsAggStat({ label, v, tone }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: M.dim, marginBottom: 4 }}>{label}</div>
      <div style={{
        fontFamily: M.mono, fontSize: 14, fontWeight: 700,
        color: tone, whiteSpace: 'nowrap'
      }}>{v}</div>
    </div>);

}

/* strategy card -------------------------------------------------------- */
function LsStratCard({ s, onView, onToggle, onOpenMenu, menuOpen, onAskDelete }) {
  const isUp = s.todayPct >= 0;
  const statusInfo = {
    running: { dot: M.ok, label: '运行中', tone: M.ok, bg: M.okSoft },
    paused: { dot: M.dim, label: '已暂停', tone: M.dim, bg: M.soft },
    warning: { dot: M.warn, label: '需关注', tone: M.warn, bg: M.warnSoft },
    stopped: { dot: M.danger, label: '已停止', tone: M.danger, bg: M.dangerSoft }
  }[s.status];
  const canStart = s.status === 'paused' || s.status === 'warning';
  const isStopped = s.status === 'stopped';
  // restore icon (curved back arrow)
  const RESTORE_D = 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5';
  const PAUSE_D = 'M6 4h4v16H6zM14 4h4v16h-4z';
  const TRASH_D = 'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6';

  return (
    <div style={{
      background: M.elev, border: `1px solid ${M.border}`, borderRadius: 14,
      marginBottom: 10, overflow: 'hidden', position: 'relative',
      opacity: isStopped ? 0.72 : 1
    }}>
      {/* clickable content region → detail */}
      <div onClick={onView} style={{ cursor: 'pointer' }}>
      {/* header */}
      <div style={{ padding: '12px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
              width: 36, height: 36, borderRadius: 9, background: s.exBg, color: s.exFg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, overflow: 'hidden'
            }}>
            <LsExSvg ex={s.ex} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3
              }}>
              <span style={{
                  fontSize: 14, fontWeight: 600, color: M.text, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0
                }}>{s.name}</span>
              <span style={{
                  height: 20, padding: '0 7px', borderRadius: 5,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                  background: statusInfo.bg, color: statusInfo.tone,
                  flexShrink: 0
                }}>
                <span style={{
                    width: 5, height: 5, borderRadius: 3, background: statusInfo.dot,
                    boxShadow: s.status === 'running' ?
                    `0 0 0 3px ${statusInfo.dot}33` : 'none'
                  }} />
                {statusInfo.label}
              </span>
            </div>
            <div style={{
                fontSize: 11, color: M.dim, fontFamily: M.mono,
                display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center'
              }}>
              <span style={{ whiteSpace: 'nowrap' }}>{s.pair}</span>
              <span style={{ color: M.faint }}>·</span>
              <span style={{ whiteSpace: 'nowrap' }}>{s.tf}</span>
              <span style={{ color: M.faint }}>·</span>
              <span style={{ whiteSpace: 'nowrap' }}>{s.market}</span>
              <span style={{ color: M.faint }}>·</span>
              <span style={{ whiteSpace: 'nowrap' }}>{s.ex}</span>
            </div>
          </div>
        </div>
      </div>

      {/* perf row — today PnL + sparkline */}
      <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 90px',
          gap: 12, padding: '4px 14px 14px', alignItems: 'center'
        }}>
        <div>
          <div style={{ fontSize: 10, color: M.dim, marginBottom: 3 }}>今日</div>
          <div style={{
              fontFamily: M.mono, fontSize: 16, fontWeight: 700,
              color: s.todayPct === 0 ? M.mid : isUp ? M.up : M.dn,
              whiteSpace: 'nowrap'
            }}>
            {s.todayPct > 0 ? '+' : ''}{s.todayPct.toFixed(2)}%
          </div>
          <div style={{ fontSize: 10, color: M.dim, marginTop: 2, fontFamily: M.mono, whiteSpace: 'nowrap' }}>
            {s.todayPnl >= 0 ? '+' : ''}${Math.abs(s.todayPnl).toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: M.dim, marginBottom: 3 }}>累计</div>
          <div style={{
              fontFamily: M.mono, fontSize: 16, fontWeight: 700,
              color: s.totalPct >= 0 ? M.up : M.dn, whiteSpace: 'nowrap'
            }}>
            {s.totalPct > 0 ? '+' : ''}{s.totalPct.toFixed(2)}%
          </div>
          <div style={{ fontSize: 10, color: M.dim, marginTop: 2, fontFamily: M.mono, whiteSpace: 'nowrap' }}>
            {s.totalPnl >= 0 ? '+' : ''}${Math.abs(s.totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div>
          <LsSpark seed={s.spark} up={s.totalPct >= 0} />
        </div>
      </div>

      {/* status note if any */}
      {s.statusNote &&
        <div style={{
          padding: '8px 14px',
          background: statusInfo.bg,
          color: statusInfo.tone,
          fontSize: 11, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6,
          borderTop: `1px solid ${M.borderSoft}`
        }}>
          <Ico d={ICONS.shield} w={11} sw={1.8} />
          {s.statusNote}
        </div>
        }
      </div>{/* /clickable region */}

      {/* footer — meta + actions */}
      <div style={{
        padding: '10px 14px',
        borderTop: `1px solid ${M.borderSoft}`,
        background: M.soft,
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <div style={{
          flex: 1, fontSize: 10, color: M.dim, fontFamily: M.mono,
          display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', minWidth: 0
        }}>
          <span style={{ whiteSpace: 'nowrap' }}>{s.id}</span>
          <span style={{ color: M.faint }}>·</span>
          <span style={{ whiteSpace: 'nowrap' }}>运行 {s.runFor}</span>
          <span style={{ color: M.faint }}>·</span>
          <span style={{ whiteSpace: 'nowrap' }}>{s.trades} 笔</span>
          <span style={{ color: M.faint }}>·</span>
          <span style={{ whiteSpace: 'nowrap' }}>胜率 {s.winRate}%</span>
        </div>
        <LsActionBtn
          onClick={(e) => {e.stopPropagation();onToggle && onToggle();}}
          icon={isStopped ? RESTORE_D : canStart ? ICONS.play : PAUSE_D}
          tone={canStart || isStopped ? 'ok' : null}
          title={isStopped ? '恢复' : canStart ? '开启' : '暂停'} />

        <LsActionBtn
          onClick={(e) => {e.stopPropagation();onOpenMenu && onOpenMenu();}}
          icon={ICONS.more}
          active={menuOpen}
          title="更多" />

      </div>

      {/* action menu popover */}
      {menuOpen &&
      <>
          <div onClick={(e) => {e.stopPropagation();onOpenMenu && onOpenMenu();}}
        style={{
          position: 'fixed', inset: 0, zIndex: 50, background: 'transparent'
        }} />
          <div style={{
          position: 'absolute', bottom: 50, right: 12, zIndex: 60,
          background: M.elev, borderRadius: 12,
          border: `1px solid ${M.border}`,
          boxShadow: '0 12px 32px rgba(15,11,34,0.18)',
          overflow: 'hidden', minWidth: 172
        }}>
            <LsMenuItem icon="M4 7h12M4 12h16M4 17h10"
          label="查看详情" onClick={onView} />
            <LsMenuItem
            icon={isStopped ? RESTORE_D : canStart ? ICONS.play : PAUSE_D}
            label={isStopped ? '恢复策略' : canStart ? '开启策略' : '暂停策略'}
            tone={canStart || isStopped ? 'ok' : null}
            onClick={onToggle} />
            <LsMenuItem
            icon={TRASH_D}
            label={isStopped ? '永久删除' : '删除策略'}
            tone="danger" onClick={onAskDelete} />
          </div>
        </>
      }
    </div>);

}

function LsActionBtn({ icon, onClick, tone, active, title }) {
  const color = tone === 'ok' ? M.ok : active ? M.violet : M.mid;
  const bg = active ? M.violetSoft : M.elev;
  return (
    <button onClick={onClick} title={title} style={{
      width: 30, height: 30, borderRadius: 7,
      background: bg, border: `1px solid ${active ? 'rgba(124,92,255,0.3)' : M.border}`,
      color, cursor: 'pointer', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <Ico d={icon} w={13} sw={1.8} fill={icon === ICONS.more ? 'currentColor' : 'none'} />
    </button>);

}

function LsMenuItem({ icon, label, onClick, tone }) {
  const color = tone === 'danger' ? M.danger : tone === 'ok' ? M.ok : M.text;
  return (
    <button onClick={(e) => {e.stopPropagation();onClick && onClick();}}
    style={{
      width: '100%', padding: '12px 14px', border: 0,
      background: 'transparent', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 10,
      borderTop: `1px solid ${M.borderSoft}`,
      color, fontSize: 13, fontWeight: 500, textAlign: 'left',
      whiteSpace: 'nowrap'
    }}>
      <Ico d={icon} w={14} sw={1.8} />
      {label}
    </button>);

}

/* sparkline ----------------------------------------------------------- */
function LsSpark({ seed, up }) {
  const w = 88,h = 36;
  const min = Math.min(...seed),max = Math.max(...seed);
  const span = max - min || 1;
  const pts = seed.map((v, i) => {
    const x = i / (seed.length - 1) * (w - 2) + 1;
    const y = (1 - (v - min) / span) * (h - 6) + 3;
    return `${x},${y}`;
  }).join(' ');
  const col = up ? 'var(--mk-up,#16C783)' : 'var(--mk-dn,#EA3943)';
  const last = pts.split(' ').pop().split(',').map(Number);
  return (
    <svg width={w} height={h} style={{ display: 'block', marginLeft: 'auto' }}>
      <defs>
        <linearGradient id={`spk-${up ? 'u' : 'd'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.22" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={col} strokeWidth="1.4" points={pts} />
      <polygon fill={`url(#spk-${up ? 'u' : 'd'})`}
      points={`${pts} ${last[0]},${h - 3} 1,${h - 3}`} />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={col} stroke={M.elev} strokeWidth="1.2" />
    </svg>);

}

/* empty state --------------------------------------------------------- */
function LsEmptyState({ filter }) {
  const isStopped = filter === 'stopped';
  return (
    <div style={{
      padding: '48px 24px', textAlign: 'center',
      background: M.elev, border: `1px dashed ${M.border}`, borderRadius: 14
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 24, margin: '0 auto 14px',
        background: isStopped ? M.soft : M.violetSoft,
        color: isStopped ? M.dim : M.violet,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Ico d={isStopped ?
        'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6' :
        ICONS.strat} w={22} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: M.text, marginBottom: 4 }}>
        {isStopped ? '没有已停止的策略' : '还没有符合的策略'}
      </div>
      <div style={{ fontSize: 12, color: M.mid, lineHeight: 1.6 }}>
        {isStopped ?
        '删除的策略会出现在这里,保留 30 天' :
        '换一个筛选,或在 AI 对话里创建新策略'}
      </div>
    </div>);

}

Object.assign(window, { ScreenLiveStrats, ScreenLiveStratDetail, LIVE_STRATS, LsCloseWithPositionSheet });

/* ========================================================================
   COMPONENT — 关闭策略 (有持仓场景)
   Bottom sheet that asks the user what to do with the open position
   before the strategy is shut down.
   ======================================================================== */
function LsCloseWithPositionSheet({ s, position, onCancel, onConfirm }) {
  const [mode, setMode] = React.useState('market');
  const [showDanger, setShowDanger] = React.useState(false);
  const pos = position;
  const pnlUp = pos.pnl >= 0;

  const modes = [
  {
    k: 'market',
    label: '市价平仓后关闭',
    tag: '推荐',
    desc: '立即按市价单平掉持仓,实现当前盈亏后停止策略。',
    effect:
    <span>
          预计实现盈亏{' '}
          <strong style={{ color: pnlUp ? M.up : M.dn, fontFamily: M.mono }}>
            {pnlUp ? '+' : '-'}${Math.abs(pos.pnl).toFixed(2)}
          </strong>
        </span>

  },
  {
    k: 'natural',
    label: '等待止损/止盈触发',
    desc: '保持运行直到触发止损或止盈,然后自动停止。',
    effect:
    <span style={{ fontFamily: M.mono }}>
          距止损 <strong style={{ color: M.danger }}>{pos.stopPct.toFixed(1)}%</strong>
          {'   '}距止盈 <strong style={{ color: M.up }}>+{pos.tpPct.toFixed(1)}%</strong>
        </span>

  },
  {
    k: 'keep',
    label: '保留持仓,仅停止策略',
    warn: true,
    desc: '策略不再监控,持仓需要你在交易所手动管理。',
    effect:
    <span style={{ color: M.danger }}>
          ⚠ 止损 / 止盈 / 加减仓 等自动指令将立即失效
        </span>

  }];


  const primaryLabel = {
    market: '市价平仓并关闭',
    natural: '保持运行 · 等待平仓',
    keep: '停止策略 · 保留持仓'
  }[mode];
  const isMild = mode === 'natural';

  return (
    <div className="m-sheet-scrim" onClick={onCancel} style={{
      position: 'absolute', inset: 0, zIndex: 95,
      background: 'rgba(15,11,34,0.55)'
    }}>
      <div className="m-sheet" onClick={(e) => e.stopPropagation()} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: M.bg,
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        paddingBottom: 24, maxHeight: '92%', overflowY: 'auto',
        boxShadow: '0 -16px 48px rgba(15,11,34,0.32)'
      }}>
        {/* grab handle */}
        <div style={{
          width: 38, height: 4, borderRadius: 2, background: M.borderStrong,
          margin: '10px auto 4px'
        }} />

        {/* header */}
        <div style={{ padding: '12px 20px 10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, background: M.warnSoft, color: M.warn,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Ico d={ICONS.shield} w={13} sw={1.8} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.text }}>关闭策略</div>
          </div>
          <div style={{ fontSize: 12, color: M.mid, lineHeight: 1.6 }}>
            「<strong style={{ color: M.text }}>{s.name}</strong>」当前有 <strong style={{ color: M.warn }}>1 笔持仓</strong>,
            请选择如何处理后再关闭。
          </div>
        </div>

        {/* position card */}
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{
            background: M.elev, border: `1px solid ${M.border}`, borderRadius: 12,
            padding: '12px 14px'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{
                  height: 20, padding: '0 7px', borderRadius: 5,
                  background: pos.side === '多' ? M.upSoft : M.dnSoft,
                  color: pos.side === '多' ? M.up : M.dn,
                  fontSize: 11, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center'
                }}>{pos.side}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: M.text, whiteSpace: 'nowrap' }}>{pos.pair}</span>
                <span style={{ fontSize: 11, color: M.dim, fontFamily: M.mono, whiteSpace: 'nowrap' }}>
                  ×{pos.qty} · {pos.lev}
                </span>
              </div>
              <div style={{
                fontFamily: M.mono, fontSize: 14, fontWeight: 700,
                color: pnlUp ? M.up : M.dn, whiteSpace: 'nowrap'
              }}>
                {pnlUp ? '+' : ''}{pos.pct.toFixed(2)}%
              </div>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10
            }}>
              {[
              ['入场', '$' + pos.entry.toLocaleString()],
              ['现价', '$' + pos.current.toLocaleString()],
              ['浮动盈亏', (pnlUp ? '+' : '-') + '$' + Math.abs(pos.pnl).toFixed(2),
              pnlUp ? M.up : M.dn]].
              map(([k, v, tone]) =>
              <div key={k}>
                  <div style={{ fontSize: 10, color: M.dim, marginBottom: 3 }}>{k}</div>
                  <div style={{
                  fontFamily: M.mono, fontSize: 13, fontWeight: 600,
                  color: tone || M.text, whiteSpace: 'nowrap'
                }}>{v}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* mode options */}
        <div style={{ padding: '0 16px 12px' }}>
          {modes.map((m) => {
            const on = mode === m.k;
            return (
              <button key={m.k} onClick={() => setMode(m.k)} style={{
                width: '100%', textAlign: 'left', cursor: 'pointer',
                background: on ? M.violetSoft : M.elev,
                border: `1.5px solid ${on ? M.violet : M.border}`,
                borderRadius: 12, padding: '12px 14px',
                marginBottom: 8, display: 'flex', gap: 11,
                alignItems: 'flex-start'
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 9, flexShrink: 0, marginTop: 2,
                  background: on ? M.violet : 'transparent',
                  border: `1.5px solid ${on ? M.violet : M.borderStrong}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {on && <span style={{
                    width: 6, height: 6, borderRadius: 3, background: '#fff'
                  }} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3
                  }}>
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: M.text
                    }}>{m.label}</span>
                    {m.tag &&
                    <span style={{
                      height: 17, padding: '0 6px', borderRadius: 4,
                      background: M.okSoft, color: M.ok,
                      fontSize: 10, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center'
                    }}>{m.tag}</span>
                    }
                  </div>
                  <div style={{
                    fontSize: 11, color: M.mid, lineHeight: 1.55, marginBottom: 5
                  }}>{m.desc}</div>
                  <div style={{
                    fontSize: 11, color: m.warn ? M.danger : M.dim, lineHeight: 1.55
                  }}>{m.effect}</div>
                </div>
              </button>);

          })}
        </div>

        {/* retention note */}
        <div style={{
          margin: '0 16px 14px', padding: '10px 12px',
          background: M.soft, borderRadius: 10, border: `1px solid ${M.borderSoft}`,
          fontSize: 11, color: M.mid, lineHeight: 1.6,
          display: 'flex', gap: 8, alignItems: 'flex-start'
        }}>
          <Ico d="M12 8v4m0 4h.01M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z"
          w={13} sw={1.7} />
          <span>
            关闭后历史记录保留 <strong style={{ color: M.text }}>30 天</strong>,期间可在「已停止」中恢复或导出。
            {' '}
            <button onClick={() => setShowDanger((v) => !v)} style={{
              background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
              color: M.violet, fontSize: 11, fontWeight: 500,
              textDecoration: 'underline', textUnderlineOffset: 2
            }}>{showDanger ? '收起' : '不保留历史?'}</button>
          </span>
        </div>

        {/* danger zone — opt-in permanent delete */}
        {showDanger &&
        <div style={{
          margin: '0 16px 14px', padding: '10px 12px',
          background: M.dangerSoft, borderRadius: 10,
          fontSize: 11, color: M.danger, lineHeight: 1.6
        }}>
            <strong>立即永久删除</strong> · 关闭后将<strong>不</strong>保留 30 天历史。
            通常仅在合规或隐私要求时选择。
            <label style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 6,
            cursor: 'pointer', userSelect: 'none'
          }}>
              <input
              type="checkbox"
              onChange={() => {}}
              style={{ accentColor: 'var(--danger)' }} />
              <span>同时立即永久删除策略历史(不可撤销)</span>
            </label>
          </div>
        }

        {/* buttons */}
        <div style={{
          padding: '4px 16px 0', display: 'flex', gap: 10
        }}>
          <button onClick={onCancel} style={{
            flex: 1, height: 50, borderRadius: 14,
            border: `1px solid ${M.border}`, background: M.elev,
            fontSize: 14, fontWeight: 500, color: M.text, cursor: 'pointer'
          }}>取消</button>
          <button onClick={() => onConfirm(mode)} style={{
            flex: 2, height: 50, borderRadius: 14, border: 0,
            background: isMild ? M.violetGrad : M.danger,
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: isMild ?
            '0 8px 24px rgba(124,92,255,0.32)' :
            '0 8px 24px rgba(234,57,67,0.32)'
          }}>{primaryLabel}</button>
        </div>
      </div>
    </div>);

}

/* ========================================================================
   SCREEN — 策略详情 (LiveStratDetail)
   ======================================================================== */
function ScreenLiveStratDetail() {
  const { strats, refresh } = useLiveStrats();
  const s = strats.find((x) => x.id === window.__qfSelectedStrat) || strats[0];
  const [tab, setTab] = React.useState('overview');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [closeWithPos, setCloseWithPos] = React.useState(false);

  if (!s) {
    // strategy was deleted — bounce back
    React.useEffect(() => {window.__nav?.go('live');}, []);
    return null;
  }

  const statusInfo = {
    running: { dot: M.ok, label: '运行中', tone: M.ok, bg: M.okSoft },
    paused: { dot: M.dim, label: '已暂停', tone: M.dim, bg: M.soft },
    warning: { dot: M.warn, label: '需关注', tone: M.warn, bg: M.warnSoft },
    stopped: { dot: M.danger, label: '已停止', tone: M.danger, bg: M.dangerSoft }
  }[s.status];
  const canStart = s.status === 'paused' || s.status === 'warning';
  const isStopped = s.status === 'stopped';
  const isUp = s.totalPct >= 0;

  const onToggle = () => {
    const i = strats.findIndex((x) => x.id === s.id);
    if (i < 0) return;
    if (isStopped) {
      strats[i] = { ...s, status: 'paused', statusNote: '已恢复 · 待开启', deletedAt: undefined };
    } else if (canStart) {
      strats[i] = { ...s, status: 'running', statusNote: undefined };
    } else {
      strats[i] = { ...s, status: 'paused', statusNote: '已暂停 · 等待恢复' };
    }
    setMenuOpen(false);
    refresh();
  };
  const onDelete = () => {
    const i = window.__qfLiveStrats.findIndex((x) => x.id === s.id);
    if (i < 0) {window.__nav?.go('live');return;}
    if (isStopped) {
      // permanent delete
      window.__qfLiveStrats.splice(i, 1);
      refresh();
      window.__nav?.go('live');
    } else {
      // soft delete
      window.__qfLiveStrats[i] = {
        ...window.__qfLiveStrats[i],
        status: 'stopped',
        statusNote: '已停止 · 30 天后永久删除',
        deletedAt: Date.now(),
        todayPct: 0, todayPnl: 0
      };
      refresh();
      window.__nav?.go('live');
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: M.bg, position: 'relative' }}>
      <MStatus />
      <MTopBar
        title="策略详情"
        sub={s.name}
        onBack
        backTo="live"
        right={
        <button onClick={() => setMenuOpen((o) => !o)} style={{
          width: 36, height: 36, borderRadius: 18,
          background: menuOpen ? M.violetSoft : M.elev,
          border: `1px solid ${menuOpen ? 'rgba(124,92,255,0.3)' : M.border}`,
          color: menuOpen ? M.violet : M.mid, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <Ico d="M12 5h.01M12 12h.01M12 19h.01" w={16} fill="none" sw={2.4} />
          </button>
        } />


      {/* top-right action menu */}
      {menuOpen &&
      <>
          <div onClick={() => setMenuOpen(false)} style={{
          position: 'absolute', inset: 0, zIndex: 50
        }} />
          <div style={{
          position: 'absolute', top: 96, right: 14, zIndex: 60,
          background: M.elev, borderRadius: 12, minWidth: 180,
          border: `1px solid ${M.border}`,
          boxShadow: '0 12px 32px rgba(15,11,34,0.18)', overflow: 'hidden'
        }}>
            <LsMenuItem
            icon={isStopped ?
            'M3 12a9 9 0 1 0 3-6.7M3 4v5h5' :
            canStart ? ICONS.play : 'M6 4h4v16H6zM14 4h4v16h-4z'}
            label={isStopped ? '恢复策略' : canStart ? '开启策略' : '暂停策略'}
            tone={isStopped || canStart ? 'ok' : null}
            onClick={onToggle} />
            <LsMenuItem
            icon="M20 12H4M4 12l6-6M4 12l6 6"
            label="在 AI 中调优"
            onClick={() => window.__nav?.go('ai')} />
            <LsMenuItem
            icon="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
            label={isStopped ? '永久删除' : '删除策略'} tone="danger"
            onClick={() => {
              setMenuOpen(false);
              const pos = getPosition(s);
              if (pos) setCloseWithPos(true);else
              setConfirmDel(true);
            }} />
          </div>
        </>
      }

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 110px' }}>
        {/* hero */}
        <Card p="16px" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11, background: s.exBg, color: s.exFg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, overflow: 'hidden'
            }}>
              <LsExSvg ex={s.ex} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4
              }}>
                <span style={{
                  fontSize: 15, fontWeight: 700, color: M.text,
                  flex: 1, minWidth: 0, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis'
                }}>{s.name}</span>
                <span style={{
                  height: 20, padding: '0 7px', borderRadius: 5,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                  background: statusInfo.bg, color: statusInfo.tone,
                  flexShrink: 0
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: 3, background: statusInfo.dot,
                    boxShadow: s.status === 'running' ? `0 0 0 3px ${statusInfo.dot}33` : 'none'
                  }} />
                  {statusInfo.label}
                </span>
              </div>
              <div style={{
                fontSize: 11, color: M.dim, fontFamily: M.mono,
                display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center'
              }}>
                <span style={{ whiteSpace: 'nowrap' }}>{s.pair}</span>
                <span style={{ color: M.faint }}>·</span>
                <span style={{ whiteSpace: 'nowrap' }}>{s.tf}</span>
                <span style={{ color: M.faint }}>·</span>
                <span style={{ whiteSpace: 'nowrap' }}>{s.market}</span>
                <span style={{ color: M.faint }}>·</span>
                <span style={{ whiteSpace: 'nowrap' }}>{s.ex}</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: M.dim, marginBottom: 4 }}>累计盈亏</div>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14, flexWrap: 'wrap'
          }}>
            <span style={{
              fontFamily: M.mono, fontSize: 30, fontWeight: 700,
              color: isUp ? M.up : M.dn, letterSpacing: -0.4, whiteSpace: 'nowrap'
            }}>
              {s.totalPnl >= 0 ? '+' : ''}${Math.abs(s.totalPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <Chip tone={isUp ? 'ok' : 'danger'} style={{ whiteSpace: 'nowrap' }}>
              {s.totalPct >= 0 ? '+' : ''}{s.totalPct.toFixed(2)}%
            </Chip>
          </div>

          <LsDetailCurve seed={s.spark} up={isUp} width={314} height={120} />

          {s.statusNote &&
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 8,
            background: statusInfo.bg, color: statusInfo.tone,
            fontSize: 11, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6
          }}>
              <Ico d={ICONS.shield} w={11} sw={1.8} />
              {s.statusNote}
            </div>
          }
        </Card>

        {/* tabs */}
        <div style={{
          display: 'flex', gap: 4, padding: 3, marginBottom: 14,
          background: M.soft, borderRadius: 10, border: `1px solid ${M.borderSoft}`
        }}>
          {[
          ['overview', '概览'],
          ['positions', '持仓'],
          ['history', '交易记录'],
          ['params', '参数']].
          map(([k, l]) => {
            const on = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)} style={{
                flex: 1, height: 32, borderRadius: 7, border: 0, cursor: 'pointer',
                background: on ? M.elev : 'transparent',
                color: on ? M.violet : M.mid,
                fontSize: 12, fontWeight: on ? 600 : 500, whiteSpace: 'nowrap',
                boxShadow: on ? '0 1px 3px rgba(15,22,35,0.06)' : 'none'
              }}>{l}</button>);

          })}
        </div>

        {tab === 'overview' && <LsDetailOverview s={s} />}
        {tab === 'positions' && <LsDetailPositions s={s} />}
        {tab === 'history' && <LsDetailHistory s={s} />}
        {tab === 'params' && <LsDetailParams s={s} />}
      </div>

      {/* sticky action — primary depends on status */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30,
        padding: '12px 16px 36px',
        background: `linear-gradient(180deg, transparent, ${M.bg} 30%)`,
        display: 'flex', gap: 10
      }}>
        <button onClick={() => {
          const pos = getPosition(s);
          if (pos) setCloseWithPos(true);else
          setConfirmDel(true);
        }} style={{
          flex: 1, height: 50, borderRadius: 14,
          border: `1px solid ${M.dangerSoft}`, background: M.elev,
          color: M.danger, fontSize: 14, fontWeight: 500, cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}>{isStopped ? '永久删除' : '删除'}</button>
        <button onClick={onToggle} style={{
          flex: 2, height: 50, borderRadius: 14, border: 0,
          background: canStart || isStopped ? M.violetGrad : M.warn, color: '#fff',
          fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
          boxShadow: canStart || isStopped ?
          '0 8px 24px rgba(124,92,255,0.32)' :
          '0 8px 24px rgba(245,158,11,0.32)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}>
          {isStopped ?
          <><Ico d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" w={14} sw={2} /> 恢复策略</> :
          canStart ?
          <><Ico d={ICONS.play} w={14} fill="#fff" sw={0} /> 开启策略</> :
          <><Ico d="M6 4h4v16H6zM14 4h4v16h-4z" w={14} fill="#fff" sw={0} /> 暂停策略</>
          }
        </button>
      </div>

      {/* close-with-position sheet — running/warning strats with a live position */}
      {closeWithPos &&
      <LsCloseWithPositionSheet
        s={s}
        position={getPosition(s)}
        onCancel={() => setCloseWithPos(false)}
        onConfirm={(mode) => {
          const i = window.__qfLiveStrats.findIndex((x) => x.id === s.id);
          if (i < 0) {setCloseWithPos(false);window.__nav?.go('live');return;}
          const cur = window.__qfLiveStrats[i];
          const pos = getPosition(cur);
          if (mode === 'natural') {
            window.__qfLiveStrats[i] = {
              ...cur, status: 'running',
              statusNote: '关闭待生效 · 等待止损/止盈触发'
            };
            setCloseWithPos(false);
            refresh();
          } else if (mode === 'keep') {
            window.__qfLiveStrats[i] = {
              ...cur, status: 'stopped',
              statusNote: `已停止 · 持仓已转手动 · ${formatDeleteRetention()}`,
              deletedAt: Date.now(),
              todayPct: 0, todayPnl: 0
            };
            setCloseWithPos(false);
            refresh();
            window.__nav?.go('live');
          } else {
            const realized = pos ? pos.pnl : 0;
            window.__qfLiveStrats[i] = {
              ...cur, status: 'stopped',
              statusNote: `已停止 · 已平仓 ${realized >= 0 ? '+' : '-'}$${Math.abs(realized).toFixed(2)} · ${formatDeleteRetention()}`,
              deletedAt: Date.now(),
              todayPnl: cur.todayPnl + realized,
              totalPnl: cur.totalPnl + realized,
              todayPct: 0
            };
            setCloseWithPos(false);
            refresh();
            window.__nav?.go('live');
          }
        }} />

      }

      {/* confirm delete drawer */}
      <LsDeleteSheet
        open={!!confirmDel}
        name={s.name}
        stopped={isStopped}
        onCancel={() => setConfirmDel(false)}
        onConfirm={onDelete} />

    </div>);

}

/* generated strategy scripts — one per strategy type, fed to script viewer */
const LS_STRAT_SCRIPTS = {
  '双均线': `// Quantify Strategy · ${'${name}'}
// Deployed 2026-05-12 · v1.0

import { Strategy, MA } from '@quantify/sdk';

export default class BTCTrendMA extends Strategy {
  static SYMBOL    = 'BTC/USDT';
  static TIMEFRAME = '15m';
  static MARKET    = 'futures';
  static LEVERAGE  = 5;

  static FAST_PERIOD = 5;
  static SLOW_PERIOD = 20;
  static STOP_LOSS   = 0.02;
  static POSITION    = 1.0;

  constructor() {
    super();
    this.fast = new MA({ period: BTCTrendMA.FAST_PERIOD });
    this.slow = new MA({ period: BTCTrendMA.SLOW_PERIOD });
  }

  onBar(bar) {
    this.fast.update(bar.close);
    this.slow.update(bar.close);
    if (!this.fast.ready || !this.slow.ready) return;

    if (this.fast.crossAbove(this.slow) && !this.position) {
      return this.openLong({
        size: BTCTrendMA.POSITION,
        stopLoss: bar.close * (1 - BTCTrendMA.STOP_LOSS),
        tag: 'ma_cross_up',
      });
    }
    if (this.position && this.fast.crossBelow(this.slow)) {
      return this.closePosition({ reason: 'ma_cross_down' });
    }
  }
}
`,
  '网格': `// Quantify Strategy · ${'${name}'}
// Deployed · v1.0

import { Strategy, Grid } from '@quantify/sdk';

export default class GridStrategy extends Strategy {
  static SYMBOL      = 'ETH/USDT';
  static TIMEFRAME   = '1h';
  static MARKET      = 'spot';

  static LOWER_PRICE  = 2400;
  static UPPER_PRICE  = 3000;
  static GRID_COUNT   = 10;
  static SIZE_PER_BUY = 0.1;
  static STOP_BREAK   = 0.02;

  constructor() {
    super();
    this.grid = new Grid({
      lower: GridStrategy.LOWER_PRICE,
      upper: GridStrategy.UPPER_PRICE,
      count: GridStrategy.GRID_COUNT,
    });
  }

  onBar(bar) {
    if (bar.close < GridStrategy.LOWER_PRICE * (1 - GridStrategy.STOP_BREAK)) {
      return this.pause({ reason: 'range_break' });
    }
    const buy = this.grid.crossedDown(bar.close);
    if (buy && !this.holdsAt(buy)) {
      return this.openLong({ size: GridStrategy.SIZE_PER_BUY, price: buy });
    }
    const sell = this.grid.crossedUp(bar.close);
    if (sell && this.holdsAt(sell - this.grid.step)) {
      return this.closeAt({ price: sell });
    }
  }
}
`,
  '均值回归': `// Quantify Strategy · ${'${name}'}
// Deployed · v1.0

import { Strategy, RSI } from '@quantify/sdk';

export default class MeanReversion extends Strategy {
  static SYMBOL      = 'ETH/USDT';
  static TIMEFRAME   = '4h';
  static MARKET      = 'spot';

  static RSI_PERIOD  = 14;
  static RSI_LOW     = 30;
  static RSI_EXIT    = 50;
  static STOP_LOSS   = 0.03;

  constructor() {
    super();
    this.rsi = new RSI({ period: MeanReversion.RSI_PERIOD });
  }

  onBar(bar) {
    this.rsi.update(bar.close);
    if (!this.rsi.ready) return;

    if (this.rsi.value < MeanReversion.RSI_LOW && !this.position) {
      return this.openLong({
        stopLoss: bar.close * (1 - MeanReversion.STOP_LOSS),
        tag: 'rsi_oversold',
      });
    }
    if (this.position && this.rsi.value > MeanReversion.RSI_EXIT) {
      return this.closePosition({ reason: 'rsi_recovered' });
    }
  }
}
`,
  '套利': `// Quantify Strategy · ${'${name}'}
// Deployed · v1.0

import { Strategy } from '@quantify/sdk';

export default class FundingArb extends Strategy {
  static UNIVERSE = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
  static THRESHOLD = 0.0003;
  static MAX_NOTIONAL = 2000;

  async onTick() {
    const rates = await this.fetchFundingRates(FundingArb.UNIVERSE);
    for (const r of rates) {
      if (r.rate > FundingArb.THRESHOLD) {
        await this.shortPerpLongSpot({
          symbol: r.symbol,
          notional: FundingArb.MAX_NOTIONAL,
        });
      }
    }
  }
}
`
};

function scriptFor(strat) {
  const m = Object.keys(LS_STRAT_SCRIPTS).find((k) => strat.name.includes(k));
  const t = LS_STRAT_SCRIPTS[m] || LS_STRAT_SCRIPTS['双均线'];
  return t.replace('${name}', strat.name);
}

function fileNameFor(strat) {
  const map = {
    '双均线': 'btc_trend_ma.js',
    '网格': 'grid_range.js',
    '均值回归': 'eth_mean_reversion.js',
    '套利': 'funding_arbitrage.js'
  };
  const m = Object.keys(map).find((k) => strat.name.includes(k));
  return map[m] || 'strategy.js';
}

/* ---- detail tab bodies ---- */
function LsDetailOverview({ s }) {
  const [openSheet, setOpenSheet] = React.useState(null); // 'script' | 'btres' | 'deploy' | null
  return (
    <>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, marginBottom: 14,
        background: M.borderSoft, border: `1px solid ${M.border}`, borderRadius: 12,
        overflow: 'hidden'
      }}>
        {[
        { k: '今日盈亏', v: (s.todayPnl >= 0 ? '+' : '') + '$' + Math.abs(s.todayPnl).toFixed(2),
          tone: s.todayPnl > 0 ? M.up : s.todayPnl < 0 ? M.dn : M.text },
        { k: '今日 %', v: (s.todayPct > 0 ? '+' : '') + s.todayPct.toFixed(2) + '%',
          tone: s.todayPct > 0 ? M.up : s.todayPct < 0 ? M.dn : M.text },
        { k: '累计 %', v: (s.totalPct > 0 ? '+' : '') + s.totalPct.toFixed(2) + '%',
          tone: s.totalPct >= 0 ? M.up : M.dn },
        { k: '投入本金', v: '$' + s.capital.toLocaleString(), tone: M.text },
        { k: '交易笔数', v: s.trades + ' 笔', tone: M.text },
        { k: '胜率', v: s.winRate.toFixed(1) + '%', tone: M.text },
        { k: '运行天数', v: s.runFor, tone: M.text },
        { k: '交易所', v: s.ex, tone: M.text }].
        map((stat) =>
        <div key={stat.k} style={{ padding: '12px 14px', background: M.elev }}>
            <div style={{ fontSize: 11, color: M.dim, marginBottom: 4 }}>{stat.k}</div>
            <div style={{
            fontFamily: M.mono, fontSize: 16, fontWeight: 700,
            color: stat.tone, whiteSpace: 'nowrap'
          }}>{stat.v}</div>
          </div>
        )}
      </div>

      {/* AI advisory */}
      <div style={{
        padding: '12px 14px', borderRadius: 12, marginBottom: 14,
        background: M.violetSoft,
        display: 'flex', gap: 10, alignItems: 'flex-start'
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6, flexShrink: 0,
          background: M.violet, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Ico d={ICONS.bot} w={14} sw={1.8} />
        </div>
        <div style={{ fontSize: 12, color: M.text, lineHeight: 1.65, opacity: 0.92 }}>
          <strong style={{ color: M.violet }}>AI 观察:</strong>{' '}
          {s.status === 'warning' ?
          '近 3 笔交易连续止损,日内已亏损接近设定上限。建议暂停或在对话中调整止损阈值。' :
          s.status === 'paused' ?
          '当前已暂停,持仓已平。开启后会等待下一个开仓信号触发。' :
          '策略运行平稳,近 7 天胜率高于回测均值。波动率上升时可考虑降仓位。'}
        </div>
      </div>

      {/* strategy archive — re-enter the original workflow read-only */}
      <div style={{
        fontSize: 12, color: M.mid, fontWeight: 600, letterSpacing: 0.2,
        padding: '4px 4px 8px', whiteSpace: 'nowrap'
      }}>策略档案</div>
      <Card p="0" style={{ overflow: 'hidden' }}>
        {[
        { k: 'script', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
          label: '策略脚本', sub: `${fileNameFor(s)} · 部署时生成` },
        { k: 'btres', icon: 'M3 17l6-6 4 4 8-8',
          label: '回测记录', sub: '部署前的历史回测结果' },
        { k: 'deploy', icon: 'M5 12l4 4L19 6M3 12a9 9 0 1018 0',
          label: '部署配置', sub: '初始资金 / 仓位 / 风控' }].
        map((row, i) =>
        <button key={row.k} onClick={() => setOpenSheet(row.k)} style={{
          width: '100%', padding: '14px 14px', border: 0,
          background: M.elev, cursor: 'pointer', textAlign: 'left',
          borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
            <div style={{
            width: 34, height: 34, borderRadius: 9, background: M.violetSoft,
            color: M.violet, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
              <Ico d={row.icon} w={16} sw={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: M.text, fontWeight: 600 }}>{row.label}</div>
              <div style={{ fontSize: 11, color: M.dim, marginTop: 2 }}>{row.sub}</div>
            </div>
            <Ico d={ICONS.caretR} w={14} sw={2} />
          </button>
        )}
      </Card>

      {/* sheets */}
      {openSheet === 'script' && <LsScriptSheet s={s} onClose={() => setOpenSheet(null)} />}
      {openSheet === 'btres' && <LsBacktestSheet s={s} onClose={() => setOpenSheet(null)} />}
      {openSheet === 'deploy' && <LsDeploySheet s={s} onClose={() => setOpenSheet(null)} />}
    </>);

}

/* ============ archive sheets — read-only re-entry into the workflow ============ */
function LsSheetShell({ title, sub, onClose, children, footer }) {
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 90,
      background: 'rgba(15,11,34,0.55)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: M.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18,
        maxHeight: '90%', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -24px 64px rgba(15,11,34,0.32)'
      }}>
        {/* drag handle */}
        <div style={{
          width: 40, height: 4, borderRadius: 2, background: M.borderStrong,
          margin: '10px auto 6px'
        }} />
        {/* header */}
        <div style={{
          padding: '10px 16px 14px',
          borderBottom: `1px solid ${M.borderSoft}`,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.text }}>{title}</div>
            {sub && <div style={{ fontSize: 11, color: M.dim, marginTop: 2 }}>{sub}</div>}
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 16, border: 0,
            background: M.soft, color: M.mid, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <Ico d="M6 6l12 12M18 6l-12 12" w={14} sw={2} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
        {footer &&
        <div style={{
          padding: '12px 16px 24px',
          borderTop: `1px solid ${M.borderSoft}`,
          background: M.bg
        }}>{footer}</div>
        }
      </div>
    </div>);

}

function LsScriptSheet({ s, onClose }) {
  const code = scriptFor(s);
  const lines = code.split('\n');
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <LsSheetShell
      title="策略脚本"
      sub={`${fileNameFor(s)} · 只读 · 修改请回到对话调优`}
      onClose={onClose}
      footer={
      <button onClick={copy} style={{
        width: '100%', height: 46, borderRadius: 12, border: 0,
        background: copied ? M.ok : M.violet, color: '#fff',
        fontSize: 14, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
      }}>
          {copied ?
        <><Ico d={ICONS.check} w={14} sw={2.4} fill="none" stroke="#fff" />已复制到剪贴板</> :
        <><Ico d={ICONS.copy} w={14} sw={1.8} />复制脚本</>
        }
        </button>
      }>

      <div style={{ padding: '12px 16px' }}>
        <div style={{
          background: '#1a1530', borderRadius: 12,
          border: `1px solid ${M.border}`, overflow: 'hidden'
        }}>
          <div style={{
            padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.04)',
            borderBottom: '1px solid rgba(255,255,255,0.06)'
          }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: '#FF5F57' }} />
            <span style={{ width: 10, height: 10, borderRadius: 5, background: '#FEBC2E' }} />
            <span style={{ width: 10, height: 10, borderRadius: 5, background: '#28C840' }} />
            <div style={{ flex: 1 }} />
            <span style={{
              fontFamily: M.mono, fontSize: 10, color: 'rgba(255,255,255,0.5)',
              whiteSpace: 'nowrap'
            }}>{fileNameFor(s)}</span>
          </div>
          <pre style={{
            margin: 0, padding: '10px 12px 14px',
            fontFamily: M.mono, fontSize: 11, lineHeight: 1.6,
            color: '#D9D5F0', whiteSpace: 'pre', overflow: 'auto'
          }}>
{lines.map((line, i) =>
            <LsCodeLine key={i} n={i + 1} text={line} />
            )}
          </pre>
        </div>
      </div>
    </LsSheetShell>);

}

/* tiny inline syntax highlighter — keep self-contained so it doesn't conflict
   with the one in confirm screen */
function LsCodeLine({ n, text }) {
  // detect line comment // (ignore if inside string)
  let pre = text,comment = '';
  const idx = text.indexOf('//');
  if (idx >= 0) {
    const before = text.slice(0, idx);
    const dq = (before.match(/"/g) || []).length;
    const sq = (before.match(/'/g) || []).length;
    const bt = (before.match(/`/g) || []).length;
    if (dq % 2 === 0 && sq % 2 === 0 && bt % 2 === 0) {
      pre = before;comment = text.slice(idx);
    }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'baseline' }}>
      <span style={{
        display: 'inline-block', width: 24, textAlign: 'right',
        color: 'rgba(255,255,255,0.25)', fontSize: 10, paddingRight: 10,
        userSelect: 'none', flexShrink: 0
      }}>{n}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        {pre && lsTokenize(pre)}
        {comment && <span style={{ color: '#6B7280', fontStyle: 'italic' }}>{comment}</span>}
      </span>
    </div>);

}
function lsTokenize(s) {
  const KW = /\b(import|from|export|default|class|extends|static|constructor|return|if|else|new|this|true|false|null|undefined|const|let|var|async|await|function|of|in|for)\b/g;
  const STR = /(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  const NUM = /\b(\d+\.?\d*)\b/g;
  const parts = [];
  let last = 0;
  s.replace(STR, (m, _g, idx) => {
    if (idx > last) parts.push({ t: s.slice(last, idx), kind: 'plain' });
    parts.push({ t: m, kind: 'str' });
    last = idx + m.length;
  });
  if (last < s.length) parts.push({ t: s.slice(last), kind: 'plain' });
  return parts.flatMap((p, i) => {
    if (p.kind === 'str') return <span key={i} style={{ color: '#86E1A0' }}>{p.t}</span>;
    let chunks = [];
    let li = 0;
    p.t.replace(KW, (m, _g, idx) => {
      if (idx > li) chunks.push({ t: p.t.slice(li, idx), kind: 'plain' });
      chunks.push({ t: m, kind: 'kw' });
      li = idx + m.length;
    });
    if (li < p.t.length) chunks.push({ t: p.t.slice(li), kind: 'plain' });
    return chunks.flatMap((c, j) => {
      if (c.kind === 'kw') return <span key={`k${i}-${j}`} style={{ color: '#C4B5FD', fontWeight: 600 }}>{c.t}</span>;
      const out = [];
      let lk = 0;
      c.t.replace(NUM, (m, _g, idx) => {
        if (idx > lk) out.push(c.t.slice(lk, idx));
        out.push(<span key={`n${i}-${j}-${idx}`} style={{ color: '#F0B96B' }}>{m}</span>);
        lk = idx + m.length;
      });
      if (lk < c.t.length) out.push(c.t.slice(lk));
      return out;
    });
  });
}

function LsBacktestSheet({ s, onClose }) {
  const cagr = s.totalPct >= 0 ? `+${(s.totalPct * 2.1).toFixed(1)}%` : `${(s.totalPct * 2.1).toFixed(1)}%`;
  const mdd = `-${Math.max(6, Math.abs(s.totalPct) * 0.7).toFixed(1)}%`;
  return (
    <LsSheetShell
      title="回测记录"
      sub="部署前的历史回测结果(只读)"
      onClose={onClose}>
      <div style={{ padding: '12px 16px 24px' }}>
        {/* hero */}
        <div style={{
          padding: '16px', borderRadius: 12,
          background: M.elev, border: `1px solid ${M.border}`,
          marginBottom: 12
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            flexWrap: 'wrap'
          }}>
            <Chip tone="ok" style={{ whiteSpace: 'nowrap' }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: M.ok,
                display: 'inline-block' }} />
              回测完成
            </Chip>
            <span style={{ fontSize: 11, color: M.dim, fontFamily: M.mono }}>
              2021-01 → 2026-05
            </span>
          </div>
          <div style={{ fontSize: 11, color: M.dim, marginBottom: 2 }}>累计净值</div>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14
          }}>
            <span style={{
              fontFamily: M.mono, fontSize: 30, fontWeight: 700,
              color: cagr.startsWith('-') ? M.dn : M.up, letterSpacing: -0.4
            }}>{cagr}</span>
          </div>
          <LsDetailCurve seed={s.spark} up={s.totalPct >= 0} width={326} height={120} />
        </div>

        {/* key stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
          background: M.borderSoft, border: `1px solid ${M.border}`, borderRadius: 12,
          overflow: 'hidden', marginBottom: 12
        }}>
          {[
          { k: 'CAGR', v: cagr, tone: cagr.startsWith('-') ? M.dn : M.up },
          { k: 'Sharpe', v: '1.78', tone: M.text },
          { k: '最大回撤', v: mdd, tone: M.danger },
          { k: 'Calmar', v: '2.55', tone: M.text },
          { k: '胜率', v: s.winRate.toFixed(1) + '%', tone: M.text },
          { k: '盈亏比', v: '2.04', tone: M.text }].
          map((stat) =>
          <div key={stat.k} style={{ padding: '12px 14px', background: M.elev }}>
              <div style={{ fontSize: 11, color: M.dim, marginBottom: 4 }}>{stat.k}</div>
              <div style={{
              fontFamily: M.mono, fontSize: 16, fontWeight: 700,
              color: stat.tone, whiteSpace: 'nowrap'
            }}>{stat.v}</div>
            </div>
          )}
        </div>

        <div style={{
          padding: '10px 12px', borderRadius: 10,
          background: M.violetSoft, color: M.violet, fontSize: 11, lineHeight: 1.6,
          display: 'flex', gap: 8, alignItems: 'flex-start'
        }}>
          <Ico d={ICONS.bot} w={13} fill={M.violet} sw={0} />
          <span>
            该回测用于评估部署前是否满足风控阈值。如需重新回测,请回到对话调优参数。
          </span>
        </div>
      </div>
    </LsSheetShell>);

}

function LsDeploySheet({ s, onClose }) {
  return (
    <LsSheetShell
      title="部署配置"
      sub={`部署时间 · 当前已运行 ${s.runFor}`}
      onClose={onClose}>
      <div style={{ padding: '12px 16px 24px' }}>
        {/* exchange recap */}
        <div style={{
          padding: '12px 14px', borderRadius: 12, marginBottom: 12,
          background: M.elev, border: `1px solid ${M.border}`,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: s.exBg, color: s.exFg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, overflow: 'hidden'
          }}>
            <LsExSvg ex={s.ex} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: M.text }}>{s.ex}</div>
            <div style={{ fontSize: 11, color: M.dim, marginTop: 2 }}>
              {s.market} · 现货下单 + 永续合约权限
            </div>
          </div>
          <Chip tone="ok" style={{ whiteSpace: 'nowrap' }}>已授权</Chip>
        </div>

        {/* fund + risk config */}
        <div style={{
          fontSize: 12, color: M.mid, fontWeight: 600, letterSpacing: 0.2,
          padding: '4px 4px 8px', whiteSpace: 'nowrap'
        }}>资金与风控</div>
        <Card p="0" style={{ overflow: 'hidden', marginBottom: 12 }}>
          {[
          ['初始资金', `$${s.capital.toLocaleString()} USDT`],
          ['市场类型', s.market],
          ['单笔仓位上限', '30%'],
          ['日内亏损上限', '-5%'],
          ['触发策略', '自动暂停 · 等待人工恢复']].
          map(([k, v], i) =>
          <div key={k} style={{
            padding: '12px 14px',
            borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
              <span style={{ fontSize: 12, color: M.dim, flex: 1 }}>{k}</span>
              <span style={{
              fontSize: 13, fontWeight: 600, color: M.text,
              fontFamily: M.mono, whiteSpace: 'nowrap'
            }}>{v}</span>
            </div>
          )}
        </Card>

        {/* notifications */}
        <div style={{
          fontSize: 12, color: M.mid, fontWeight: 600, letterSpacing: 0.2,
          padding: '4px 4px 8px', whiteSpace: 'nowrap'
        }}>通知</div>
        <Card p="0" style={{ overflow: 'hidden' }}>
          {[
          ['开仓时通知', '推送 + 应用内'],
          ['平仓时通知', '推送 + 应用内'],
          ['触发止损通知', '推送 + 邮件']].
          map(([k, v], i) =>
          <div key={k} style={{
            padding: '12px 14px',
            borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
              <span style={{ fontSize: 13, color: M.text, fontWeight: 500, flex: 1 }}>{k}</span>
              <span style={{ fontSize: 11, color: M.dim }}>{v}</span>
              <div style={{
              width: 30, height: 18, borderRadius: 9, background: M.violet,
              position: 'relative', flexShrink: 0
            }}>
                <div style={{
                position: 'absolute', top: 2, right: 2,
                width: 14, height: 14, borderRadius: 7, background: '#fff'
              }} />
              </div>
            </div>
          )}
        </Card>
      </div>
    </LsSheetShell>);

}

function LsDetailPositions({ s }) {
  if (s.status !== 'running' && s.status !== 'warning') {
    return (
      <div style={{
        padding: '42px 20px', textAlign: 'center',
        background: M.elev, border: `1px dashed ${M.border}`, borderRadius: 14
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 22, margin: '0 auto 12px',
          background: M.soft, color: M.dim,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Ico d="M12 4v6l4 2" w={20} sw={1.8} />
        </div>
        <div style={{ fontSize: 13, color: M.text, fontWeight: 600, marginBottom: 4 }}>策略已暂停</div>
        <div style={{ fontSize: 12, color: M.mid }}>持仓已平,等待开启后接收新信号</div>
      </div>);

  }
  // synthetic single position
  const pos = {
    side: '多',
    entry: 67420.5,
    current: 67950.2,
    qty: 0.0742,
    pnl: +39.30,
    pct: +0.78,
    stop: 66072.0,
    stopDist: '-2.0%',
    holdFor: '4h 12m'
  };
  return (
    <Card p="16px">
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            height: 22, padding: '0 8px', borderRadius: 5,
            background: M.upSoft, color: M.up,
            fontSize: 11, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center'
          }}>{pos.side}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: M.text }}>{s.pair}</span>
          <span style={{ fontSize: 11, color: M.dim, fontFamily: M.mono }}>×{pos.qty}</span>
        </div>
        <div style={{
          fontFamily: M.mono, fontSize: 14, fontWeight: 700,
          color: pos.pnl >= 0 ? M.up : M.dn, whiteSpace: 'nowrap'
        }}>
          {pos.pnl >= 0 ? '+' : ''}${Math.abs(pos.pnl).toFixed(2)} · {pos.pct > 0 ? '+' : ''}{pos.pct.toFixed(2)}%
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
        marginBottom: 12
      }}>
        {[
        ['入场价', '$' + pos.entry.toLocaleString()],
        ['当前价', '$' + pos.current.toLocaleString()],
        ['止损价', '$' + pos.stop.toLocaleString()]].
        map(([k, v]) =>
        <div key={k}>
            <div style={{ fontSize: 10, color: M.dim, marginBottom: 3 }}>{k}</div>
            <div style={{
            fontFamily: M.mono, fontSize: 13, fontWeight: 600, color: M.text, whiteSpace: 'nowrap'
          }}>{v}</div>
          </div>
        )}
      </div>

      {/* stop bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: M.dim, marginBottom: 5, gap: 8
        }}>
          <span style={{ color: M.danger, whiteSpace: 'nowrap' }}>止损</span>
          <span style={{ color: M.dim, whiteSpace: 'nowrap' }}>距止损 <strong style={{ color: M.text }}>{pos.stopDist}</strong></span>
          <span style={{ color: M.text, whiteSpace: 'nowrap' }}>持仓 {pos.holdFor}</span>
        </div>
        <div style={{
          height: 4, borderRadius: 2, background: M.soft, overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{ height: '100%', width: '62%', background: M.up, borderRadius: 2 }} />
          <div style={{
            position: 'absolute', top: -4, left: '62%',
            width: 2, height: 12, background: M.text,
            transform: 'translateX(-1px)'
          }} />
        </div>
      </div>
    </Card>);

}

function LsDetailHistory({ s }) {
  const trades = [
  { t: '今天 14:30', side: '多', entry: 67420.5, exit: 67950.2, pct: +0.78, win: true, hold: '4h' },
  { t: '昨天 22:18', side: '多', entry: 66800.0, exit: 67421.4, pct: +0.93, win: true, hold: '2h' },
  { t: '昨天 09:42', side: '多', entry: 66200.0, exit: 64876.0, pct: -2.00, win: false, hold: '45m' },
  { t: '5/24 18:00', side: '多', entry: 65420.0, exit: 66597.6, pct: +1.80, win: true, hold: '12h' },
  { t: '5/23 14:30', side: '多', entry: 64800.0, exit: 65448.0, pct: +1.00, win: true, hold: '3h' },
  { t: '5/22 10:15', side: '多', entry: 65100.0, exit: 63798.0, pct: -2.00, win: false, hold: '1h' }];

  return (
    <Card p="0" style={{ overflow: 'hidden' }}>
      {trades.map((t, i) =>
      <div key={i} style={{
        padding: '12px 14px',
        borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
        display: 'flex', alignItems: 'center', gap: 10
      }}>
          <span style={{
          width: 24, height: 24, borderRadius: 6, flexShrink: 0,
          background: t.win ? M.upSoft : M.dnSoft,
          color: t.win ? M.up : M.dn,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700
        }}>{t.side}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
            fontFamily: M.mono, fontSize: 12, color: M.text,
            display: 'flex', gap: 6, whiteSpace: 'nowrap'
          }}>
              <span>{t.entry.toLocaleString()}</span>
              <span style={{ color: M.dim }}>→</span>
              <span>{t.exit.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 10, color: M.dim, marginTop: 2, fontFamily: M.mono }}>
              {t.t} · 持仓 {t.hold}
            </div>
          </div>
          <div style={{
          fontFamily: M.mono, fontSize: 14, fontWeight: 700,
          color: t.win ? M.up : M.dn, whiteSpace: 'nowrap'
        }}>
            {t.pct > 0 ? '+' : ''}{t.pct.toFixed(2)}%
          </div>
        </div>
      )}
    </Card>);

}

function LsDetailParams({ s }) {
  const params = [
  ['fast_ma', '5', '快速均线周期(K 线根数)'],
  ['slow_ma', '20', '慢速均线周期'],
  ['stop_loss', '2.0%', '单笔最大亏损'],
  ['position', '100%', '每次开仓占用资金'],
  ['leverage', '5x', '杠杆倍数(合约)'],
  ['max_daily', '-5%', '日内亏损停止阈值']];

  return (
    <>
      <Card p="0" style={{ marginBottom: 12, overflow: 'hidden' }}>
        {params.map(([k, v, note], i) =>
        <div key={k} style={{
          padding: '12px 14px',
          borderTop: i > 0 ? `1px solid ${M.borderSoft}` : 'none',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: M.mono, fontSize: 13, color: M.text, fontWeight: 500 }}>{k}</div>
              <div style={{ fontSize: 11, color: M.dim, marginTop: 2 }}>{note}</div>
            </div>
            <div style={{
            fontFamily: M.mono, fontSize: 14, fontWeight: 600, color: M.text,
            whiteSpace: 'nowrap'
          }}>{v}</div>
          </div>
        )}
      </Card>
      <button onClick={() => window.__nav?.go('ai')} style={{
        width: '100%', height: 46, borderRadius: 12,
        border: `1px solid ${M.border}`, background: M.elev,
        color: M.violet, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
      }}>
        <Ico d={ICONS.bot} w={14} sw={1.8} />
        在 AI 对话中调优参数
      </button>
    </>);

}

/* detail equity curve --------------------------------------------------- */
function LsDetailCurve({ seed, up, width, height }) {
  const min = Math.min(...seed),max = Math.max(...seed);
  const span = max - min || 1;
  const pts = seed.map((v, i) => {
    const x = i / (seed.length - 1) * (width - 12) + 6;
    const y = (1 - (v - min) / span) * (height - 20) + 10;
    return `${x},${y}`;
  });
  const last = pts[pts.length - 1].split(',').map(Number);
  const col = up ? 'var(--mk-up,#16C783)' : 'var(--mk-dn,#EA3943)';
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`lsdc-${up ? 'u' : 'd'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.22" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) =>
      <line key={f} x1="6" x2={width - 6}
      y1={height * f} y2={height * f}
      stroke={M.borderSoft} strokeDasharray="2 4" />
      )}
      <polyline fill="none" stroke={col} strokeWidth="1.8" points={pts.join(' ')} />
      <polygon fill={`url(#lsdc-${up ? 'u' : 'd'})`}
      points={`${pts.join(' ')} ${last[0]},${height - 6} 6,${height - 6}`} />
      <circle cx={last[0]} cy={last[1]} r="4" fill={col} stroke="#fff" strokeWidth="2" />
    </svg>);

}
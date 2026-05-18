/* =============================================================
   Quantify2 — product SPA
   Hash-based routing. Vanilla JS render fns.
   ============================================================= */

(function () {
  "use strict";

  // ---------------- state ----------------
  const STATE_KEY = "qf2.state.v1";
  const SESSION_KEY = "qf2.session.v1";
  const THEME_KEY = "qf2.theme.v1";

  const defaultUser = {
    email: "vi***@gmail.com",
    fullEmail: "victor@gmail.com",
    userId: "cmp42glf60001yxqs0ivc09ff",
    avatarSeed: "5b3a2a",
    telegram: { web: false, desktop: true },
    apis: { binance: false, okx: false, hyperliquid: false },
  };

  const loadSession = () => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch { return null; }
  };
  const saveSession = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  const clearSession = () => localStorage.removeItem(SESSION_KEY);

  const loadState = () => {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || "null") || {}; }
    catch { return {}; }
  };
  const saveState = (st) => localStorage.setItem(STATE_KEY, JSON.stringify(st));

  let session = loadSession();   // { user }
  let appState = loadState();    // { conversations, activeId, ... }

  // ---------------- theme ----------------
  const THEMES  = [
    { k: "dark",  label: "暗色" },
    { k: "pink",  label: "粉红" },
    { k: "light", label: "白色" },
  ];
  const ACCENTS = [
    { k: "violet", label: "粉紫" },
    { k: "cyan",   label: "青蓝" },
    { k: "amber",  label: "琥珀" },
  ];
  const loadTheme = () => {
    try { return JSON.parse(localStorage.getItem(THEME_KEY) || "null") || { theme: "light", accent: "violet" }; }
    catch { return { theme: "light", accent: "violet" }; }
  };
  const saveTheme = (t) => localStorage.setItem(THEME_KEY, JSON.stringify(t));
  const applyTheme = (t) => {
    document.documentElement.dataset.theme  = t.theme  || "light";
    document.documentElement.dataset.accent = t.accent || "violet";
  };
  let themeState = loadTheme();
  applyTheme(themeState);

  // ---------------- helpers ----------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") {
        e.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === "style" && typeof v === "object") {
        Object.assign(e.style, v);
      } else if (k in e && typeof v !== "string") {
        e[k] = v;
      } else {
        e.setAttribute(k, v);
      }
    });
    children.flat().forEach((c) => {
      if (c == null || c === false) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  };

  const navigate = (hash) => {
    if (location.hash === hash) {
      render();
    } else {
      location.hash = hash;
    }
  };

  const fmtTime = (d = new Date()) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const copyText = async (text, btn) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    if (btn) {
      const old = btn.dataset.label || btn.textContent;
      btn.dataset.label = old;
      const span = btn.querySelector(".lbl");
      if (span) { span.textContent = "已复制"; setTimeout(() => { span.textContent = old; }, 1200); }
      else { btn.textContent = "已复制"; setTimeout(() => { btn.textContent = old; }, 1200); }
    }
  };

  // ---------------- toast ----------------
  let toastTimer = null;
  const toast = (msg, kind = "info") => {
    let host = $("#toast-host");
    if (!host) {
      host = el("div", {
        id: "toast-host",
        style: {
          position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)",
          zIndex: 200, display: "flex", flexDirection: "column", gap: "8px"
        }
      });
      document.body.appendChild(host);
    }
    const colors = {
      info:   { bg: "#0F1623", fg: "#fff" },
      ok:     { bg: "#16A36B", fg: "#fff" },
      warn:   { bg: "#D98008", fg: "#fff" },
      danger: { bg: "#DC4646", fg: "#fff" },
    };
    const c = colors[kind] || colors.info;
    const t = el("div", {
      class: "toast",
      style: {
        background: c.bg, color: c.fg,
        padding: "10px 16px", borderRadius: "10px",
        fontSize: "13px", boxShadow: "0 12px 40px rgba(15,22,35,0.20)",
        opacity: "0", transform: "translateY(-8px)", transition: "opacity .2s ease, transform .2s ease",
      }
    }, msg);
    host.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = "1"; t.style.transform = "translateY(0)"; });
    setTimeout(() => {
      t.style.opacity = "0"; t.style.transform = "translateY(-8px)";
      setTimeout(() => t.remove(), 220);
    }, 2400);
  };

  // ---------------- icons ----------------
  const icon = (name, size = 16) => {
    const paths = {
      logo:      '<path d="M4 14l5-5 4 4 7-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 6h6v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
      caret:     '<path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      check:     '<path d="M3 8l3 3 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      copy:      '<rect x="5" y="5" width="9" height="9" rx="1.6" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M3 11V3.5C3 3 3 3 3.5 3H10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
      logout:    '<path d="M10 12l3-3-3-3M13 9H5M7 14H3V2h4" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      moon:      '<path d="M14 9.5a6 6 0 0 1-7 -7 6 6 0 1 0 7 7z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      plus:      '<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      pencil:    '<path d="M11 3l2 2-7 7H4v-2l7-7z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>',
      trash:     '<path d="M3 5h10M6 5V3.5C6 3 6 3 6.5 3h3c.5 0 .5 0 .5 .5V5M5 5l.5 8c0 .5 .5 .5 .5 .5h4c0 0 .5 0 .5 -.5L11 5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      bot:       '<rect x="2.5" y="3.5" width="11" height="9" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="6" cy="8" r="1" fill="currentColor"/><circle cx="10" cy="8" r="1" fill="currentColor"/><path d="M8 2v1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
      params:    '<circle cx="5" cy="6" r="1.6" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="11" cy="11" r="1.6" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M2 6h1.4M6.6 6H14M2 11h7.4M12.6 11H14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
      play:      '<path d="M4 3.5v9l8-4.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="currentColor"/>',
      send:      '<path d="M8 3v9M4.5 6.5L8 3l3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      tg:        '<path d="M2 9l13-5.5L13 14l-4.5-3.5L11 8 7 10 2 9z" fill="currentColor"/>',
      shield:    '<path d="M8 1.5l5.5 2.5v4.5C13.5 11.5 11 13.5 8 14.5 5 13.5 2.5 11.5 2.5 8.5V4L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>',
      activity:  '<path d="M2 8h2l2-5 4 10 2-5h2" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      search:    '<circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M14 14l-3.5-3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
      chart:     '<path d="M2 13h12M4 11V6M7 11V3M10 11V8M13 11V5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
      bell:      '<path d="M3.5 11h9l-1-2V6.5a3.5 3.5 0 1 0 -7 0V9l-1 2z M6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round" stroke-linecap="round"/>',
    };
    return `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" aria-hidden="true">${paths[name] || ""}</svg>`;
  };

  // ---------------- avatar (checkerboard like screenshot) ----------------
  const avatarSVG = (seed = "abcd", size = 72) => {
    // deterministic 8x8 checkerboard with brand-ish brown palette like screenshot
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const rand = () => {
      h = (h * 1103515245 + 12345) >>> 0;
      return (h >>> 16) / 65535;
    };
    const palette = ["#5B3A2A", "#7A5538", "#A48462", "#D9C2A0", "#F2E2C9", "#FFFFFF"];
    const N = 8;
    let cells = "";
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N / 2; x++) {
        const c = palette[Math.floor(rand() * palette.length)];
        cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
        cells += `<rect x="${N - 1 - x}" y="${y}" width="1" height="1" fill="${c}"/>`;
      }
    }
    return `<svg viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" width="${size}" height="${size}">${cells}</svg>`;
  };

  // =========================================================
  // TOP BAR
  // =========================================================
  const renderTopbar = () => {
    const route = location.hash.replace(/^#/, "") || "/account";

    const isActive = (m) => route === m || route.startsWith(m + "/") ? "is-active" : "";

    const topbar = el("header", { class: "topbar" });

    // brand
    topbar.appendChild(el("a", {
      class: "brand", href: "#/ai",
      onclick: (e) => { e.preventDefault(); navigate("#/ai"); }
    },
      el("span", { class: "brand-mark", html: icon("logo", 16) }),
      "quantify"
    ));

    // nav
    const nav = el("nav", { class: "topnav" });

    const navItem = (label, target, opts = {}) => {
      const item = el("div", { class: "topnav-item" });
      const link = el("button", {
        class: `topnav-link ${isActive(target)}`,
        onclick: (ev) => {
          ev.stopPropagation();
          if (opts.pop) {
            const open = item.dataset.open === "true";
            $$(".topnav-item").forEach((x) => x.removeAttribute("data-open"));
            if (!open) item.dataset.open = "true";
          } else {
            navigate("#" + target);
          }
        }
      }, label);
      if (opts.pop) {
        link.innerHTML = `${label}<svg viewBox="0 0 12 12" class="caret" width="12" height="12">${icon("caret", 12).match(/<path[^>]*>/)?.[0] || ""}</svg>`;
        const pop = el("div", { class: "topnav-pop" });
        opts.pop.forEach(([lab, href]) => {
          pop.appendChild(el("a", {
            href: "#" + href,
            onclick: (e) => { e.preventDefault(); item.removeAttribute("data-open"); navigate("#" + href); }
          }, lab));
        });
        item.appendChild(link); item.appendChild(pop);
      } else {
        item.appendChild(link);
      }
      return item;
    };

    nav.appendChild(navItem("AI 量化", "/ai"));
    nav.appendChild(navItem("数据", "/data", {
      pop: [
        ["行情数据", "/data/market"],
        ["交易所多空比", "/data/ls"],
        ["聚合挂单", "/data/orderbook"],
        ["预测市场", "/data/predict"],
        ["币股", "/data/equity"],
      ]
    }));
    nav.appendChild(navItem("鲸鱼", "/whale", {
      pop: [
        ["发现", "/whale/discover"],
        ["实时巨鲸", "/whale/feed"],
        ["鲸鱼持仓", "/whale/holdings"],
        ["监控", "/whale/watch"],
      ]
    }));
    nav.appendChild(navItem("策略广场", "/market"));

    topbar.appendChild(nav);

    // right
    const right = el("div", { class: "topbar-right" });

    right.appendChild(el("div", { class: "lang-toggle", role: "tablist" },
      el("button", { class: "is-on" }, "中"),
      el("button", {}, "EN")
    ));

    right.appendChild(el("button", { class: "icon-btn", title: "通知", html: icon("bell", 16) }));

    right.appendChild(el("a", {
      class: "avatar-btn",
      href: "#/account",
      onclick: (e) => { e.preventDefault(); navigate("#/account"); }
    },
      el("span", { class: "av", html: avatarSVG(session.user.avatarSeed, 26) }),
      el("span", {}, session.user.email)
    ));

    topbar.appendChild(right);

    // click outside closes popovers
    document.addEventListener("click", () => {
      $$(".topnav-item[data-open]").forEach((x) => x.removeAttribute("data-open"));
    }, { once: true });

    return topbar;
  };

  // =========================================================
  // LOGIN PAGE
  // =========================================================
  const renderLogin = () => {
    const root = el("div", { class: "login-shell" });

    // hero side
    const hero = el("div", { class: "hero" });
    hero.appendChild(el("div", { class: "login-hero-art", html: `
      <svg viewBox="0 0 600 800" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;">
        <defs>
          <linearGradient id="lp1" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stop-color="#A78BFA" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#A78BFA" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="M0,650 L50,640 L100,620 L150,610 L200,580 L250,560 L300,520 L350,500 L400,460 L450,430 L500,380 L550,360 L600,300"
              fill="none" stroke="#A78BFA" stroke-width="2"/>
        <path d="M0,650 L50,640 L100,620 L150,610 L200,580 L250,560 L300,520 L350,500 L400,460 L450,430 L500,380 L550,360 L600,300 L600,800 L0,800 Z"
              fill="url(#lp1)" opacity="0.4"/>
      </svg>
    ` }));
    hero.appendChild(el("a", { class: "login-hero-brand", href: "#/login" },
      el("span", { class: "brand-mark", html: icon("logo", 16) }),
      "quantify"
    ));
    hero.appendChild(el("div", { class: "login-hero-copy" },
      el("h2", {}, "用一句话，", el("br", {}), "跑一条 AI 量化策略。"),
      el("p", {}, "Quantify 把你的交易想法翻译成可回测、可上线的策略。资金留在你的交易所账户里，永远不离开。"),
      el("div", { class: "login-hero-meta" },
        el("span", { class: "chip" }, el("span", { class: "dot" }), "API 仅读取与下单"),
        el("span", { class: "chip" }, el("span", { class: "dot" }), "对话即策略"),
        el("span", { class: "chip" }, el("span", { class: "dot" }), "Binance · OKX · Hyperliquid"),
      )
    ));
    root.appendChild(hero);

    // form side
    const formWrap = el("div", { class: "login-form-wrap" });
    const form = el("form", { class: "login-form", autocomplete: "off" });

    form.appendChild(el("div", { style: { marginBottom: "26px", display: "flex", alignItems: "center", gap: "10px" } },
      el("span", { class: "brand-mark", html: icon("logo", 16), style: { width: "32px", height: "32px" } }),
      el("span", { style: { fontWeight: "700", fontSize: "16px" } }, "quantify")
    ));

    form.appendChild(el("h1", {}, "登录到 Quantify"));
    form.appendChild(el("p", { class: "sub" }, "用邮箱或 Telegram 登录开始你的第一条策略。"));

    const errEl = el("div", { class: "err" });
    const emailField = el("div", { class: "field" },
      el("label", {}, "邮箱"),
      el("input", { type: "email", required: true, name: "email", placeholder: "you@example.com", value: "victor@gmail.com" })
    );
    const pwField = el("div", { class: "field" },
      el("label", {}, "密码"),
      el("input", { type: "password", required: true, name: "password", placeholder: "至少 8 位", value: "demo-password" })
    );
    form.appendChild(emailField);
    form.appendChild(pwField);
    form.appendChild(errEl);

    form.appendChild(el("button", { type: "submit", class: "btn btn-primary btn-lg btn-block", style: { marginTop: "8px" } },
      "登录"
    ));

    form.appendChild(el("div", { class: "login-divider" }, "或"));

    form.appendChild(el("button", {
      type: "button", class: "login-tg",
      onclick: (ev) => {
        ev.preventDefault();
        loginAs();
      }
    },
      el("span", { html: icon("tg", 18) }),
      "使用 Telegram 登录"
    ));

    form.appendChild(el("p", { class: "login-foot" },
      "继续即代表同意 ",
      el("a", { href: "#", style: { color: "var(--text-mid)", textDecoration: "underline" } }, "服务条款"),
      " 与 ",
      el("a", { href: "#", style: { color: "var(--text-mid)", textDecoration: "underline" } }, "隐私政策"),
      "。"
    ));

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const email = emailField.querySelector("input").value.trim();
      const pw = pwField.querySelector("input").value;
      errEl.textContent = "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = "邮箱格式不正确"; return; }
      if (pw.length < 6) { errEl.textContent = "密码至少 6 位"; return; }
      loginAs({ email: maskEmail(email), fullEmail: email });
    });

    formWrap.appendChild(form);
    root.appendChild(formWrap);
    return root;
  };

  const maskEmail = (e) => {
    const [name, domain] = e.split("@");
    if (!domain) return e;
    const head = name.slice(0, 2);
    return `${head}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`.replace(/\*+/, "***");
  };

  const loginAs = (overrides = {}) => {
    session = { user: { ...defaultUser, ...overrides } };
    saveSession(session);
    navigate("#/account");
  };

  const logout = () => {
    clearSession();
    session = null;
    navigate("#/login");
  };

  // =========================================================
  // ACCOUNT PAGE  (matches pasted-1778677545678-0.png)
  // =========================================================
  const renderAccountPage = () => {
    const u = session.user;
    const page = el("main", { class: "page" });

    // sub-tabs: 账号设置 / AI量化  (matches screenshot)
    const tabs = el("div", { class: "account-tabs" },
      el("button", { class: "is-on" }, "账号设置"),
      el("button", { onclick: () => navigate("#/ai") }, "AI 量化")
    );
    page.appendChild(tabs);

    // profile row
    const profile = el("div", { class: "profile-row" },
      el("div", { class: "profile-av", html: avatarSVG(u.avatarSeed, 76) }),
      el("div", { class: "profile-info" },
        el("h2", {}, "个人中心，", u.email),
        el("div", { class: "uid" },
          el("span", {}, u.userId),
          el("button", {
            title: "复制 UserId",
            onclick: (e) => copyText(u.userId, e.currentTarget),
            html: icon("copy", 14),
          })
        )
      ),
      el("div", { class: "right" },
        el("button", {
          class: "btn",
          onclick: () => logout(),
        },
          el("span", { html: icon("logout", 14) }),
          el("span", { class: "lbl" }, "登出")
        )
      )
    );
    page.appendChild(profile);

    // 账户 section
    page.appendChild(el("h3", { class: "section-title" }, "账户"));

    const accountCard = el("div", { class: "card" });
    accountCard.appendChild(el("div", { class: "account-grid-row" },
      el("div", {},
        el("div", { class: "ag-label" }, "UserId"),
        el("div", { class: "ag-value" }, u.userId)
      ),
      el("button", {
        class: "btn btn-sm",
        onclick: (e) => copyText(u.userId, e.currentTarget),
      }, el("span", { html: icon("copy", 14) }), el("span", { class: "lbl" }, "复制"))
    ));
    accountCard.appendChild(el("div", { class: "account-grid-row" },
      el("div", {},
        el("div", { class: "ag-label" }, "账户登录方式"),
        el("div", { class: "ag-value email" }, u.email)
      ),
      el("span", { class: "chip" }, "主账户")
    ));
    accountCard.appendChild(el("div", { class: "account-grid-row" },
      el("div", {},
        el("div", { class: "ag-label" }, "Telegram 登录"),
        el("div", { class: "ag-value", style: { color: u.telegram.desktop || u.telegram.web ? "var(--ok)" : "var(--warn)" } },
          u.telegram.desktop ? "桌面应用可用" : u.telegram.web ? "网页版可用" : "未配置"
        )
      ),
      el("div", { class: "ag-actions" },
        el("button", {
          class: u.telegram.web ? "chip chip-ok" : "chip",
          onclick: () => { u.telegram.web = !u.telegram.web; saveSession(session); render(); }
        },
          u.telegram.web ? el("span", { html: icon("check", 14) }) : null,
          el("span", {}, u.telegram.web ? "Telegram 网页版" : "Telegram 网页版（未配置）")
        ),
        el("button", {
          class: u.telegram.desktop ? "chip chip-ok" : "chip",
          onclick: () => { u.telegram.desktop = !u.telegram.desktop; saveSession(session); render(); }
        },
          u.telegram.desktop ? el("span", { html: icon("check", 14) }) : null,
          el("span", {}, "Telegram 桌面应用")
        )
      )
    ));
    page.appendChild(accountCard);

    // 界面主题 section
    page.appendChild(el("h3", { class: "section-title" }, "界面主题"));
    page.appendChild(el("p", { class: "muted", style: { marginTop: "-8px", marginBottom: "16px" } },
      "颜色设置会同步应用到 Web 和移动 App。"
    ));
    page.appendChild(renderThemeCard());

    // API section
    page.appendChild(el("h3", { class: "section-title" }, "交易所 API 配置"));
    page.appendChild(el("p", { class: "muted", style: { marginTop: "-8px", marginBottom: "16px" } },
      "配置后会由后端代用户转发到量化服务校验。只有验证成功的凭据才会被保存。"
    ));

    const apis = [
      { key: "binance", name: "Binance API" },
      { key: "okx", name: "OKX API" },
      { key: "hyperliquid", name: "Hyperliquid API" },
    ];
    const apiCard = el("div", { class: "card" });
    apis.forEach((a) => {
      const isSet = !!u.apis[a.key];
      apiCard.appendChild(el("div", { class: `api-row ${isSet ? "is-set" : ""}` },
        el("div", {},
          el("div", { class: "api-name" }, a.name),
          el("div", { class: "api-sub" }, isSet ? "已配置" : "未配置")
        ),
        el("button", {
          class: isSet ? "btn btn-sm" : "btn btn-sm",
          onclick: () => openApiModal(a),
        }, isSet ? "已配置" : "未配置")
      ));
    });
    page.appendChild(apiCard);

    return page;
  };

  const openApiModal = (a) => {
    const u = session.user;
    const back = el("div", { class: "modal-bg" });
    const modal = el("div", { class: "modal" });
    modal.appendChild(el("h3", {}, a.name, " ", u.apis[a.key] ? "（已配置）" : ""));
    modal.appendChild(el("p", { class: "sub" },
      "请粘贴交易所生成的 API Key 与 Secret。我们仅保留 ", el("strong", {}, "读取 + 下单"), " 权限，提币权限会被拒绝。"
    ));
    const kEl = el("input", { class: "input", placeholder: "API Key", value: u.apis[a.key] ? "•••••• ••••••••• ••••" : "" });
    const sEl = el("input", { class: "input", placeholder: "Secret", type: "password", style: { marginTop: "10px" }, value: u.apis[a.key] ? "•••••• ••••••••• ••••" : "" });
    modal.appendChild(el("div", { class: "field" },
      el("label", {}, "API Key"),
      kEl,
      el("label", { style: { marginTop: "12px" } }, "Secret"),
      sEl
    ));
    const foot = el("div", { class: "foot" });
    foot.appendChild(el("button", { class: "btn", onclick: () => back.classList.remove("is-on") }, "取消"));
    if (u.apis[a.key]) {
      foot.appendChild(el("button", {
        class: "btn",
        style: { color: "var(--danger)", borderColor: "var(--danger-soft)" },
        onclick: () => {
          u.apis[a.key] = false; saveSession(session);
          back.classList.remove("is-on");
          setTimeout(() => { back.remove(); render(); }, 200);
          toast(`${a.name} 已断开`, "warn");
        }
      }, "断开"));
    }
    foot.appendChild(el("button", {
      class: "btn btn-primary",
      onclick: () => {
        const k = kEl.value.trim(), s = sEl.value.trim();
        if (!k || !s) { toast("请填写 Key 和 Secret", "warn"); return; }
        u.apis[a.key] = true;
        saveSession(session);
        back.classList.remove("is-on");
        setTimeout(() => { back.remove(); render(); }, 200);
        toast(`${a.name} 已连接（提币权限已拦截）`, "ok");
      }
    }, "验证并保存"));
    modal.appendChild(foot);
    back.appendChild(modal);
    back.addEventListener("click", (e) => { if (e.target === back) { back.classList.remove("is-on"); setTimeout(() => back.remove(), 200); } });
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add("is-on"));
  };

  // -------- theme picker section --------
  const renderThemeCard = () => {
    const card = el("div", { class: "card", style: { padding: "22px 22px 24px" } });

    // 背景主题
    const bgGroup = el("div", { class: "theme-group" },
      el("div", { class: "theme-group-label" }, "背景主题"),
      el("div", { class: "theme-grid" },
        ...THEMES.map((t) => el("div", {
          class: `theme-card bg-${t.k}`,
          role: "button",
          tabindex: "0",
          "aria-pressed": String(themeState.theme === t.k),
          onclick: () => {
            themeState = { ...themeState, theme: t.k };
            saveTheme(themeState); applyTheme(themeState); render();
            toast(`已切换为「${t.label}」主题`, "ok");
          }
        }, t.label))
      )
    );

    // 强调色
    const acGroup = el("div", { class: "theme-group" },
      el("div", { class: "theme-group-label" }, "强调色"),
      el("div", { class: "theme-grid" },
        ...ACCENTS.map((a) => el("div", {
          class: "accent-card",
          role: "button",
          tabindex: "0",
          "aria-pressed": String(themeState.accent === a.k),
          onclick: () => {
            themeState = { ...themeState, accent: a.k };
            saveTheme(themeState); applyTheme(themeState); render();
            toast(`已切换为「${a.label}」`, "ok");
          }
        },
          el("span", { class: `swatch ${a.k}` }),
          el("span", { class: "nm" }, a.label)
        ))
      )
    );

    card.appendChild(bgGroup);
    card.appendChild(acGroup);
    return card;
  };

  // =========================================================
  // AI QUANT
  // =========================================================
  // conversation model
  const ensureAIState = () => {
    if (!appState.ai) {
      appState.ai = {
        conversations: [
          { id: "c1", title: "新对话", updated: Date.now(), messages: [] }
        ],
        activeId: "c1",
        configOpen: false,
        config: { range: "30D", capital: "", slippage: "", fee: "", priceSrc: "", allowPartial: "" },
      };
      saveState(appState);
    }
    return appState.ai;
  };

  const renderAIPage = () => {
    const s = ensureAIState();
    const page = el("main", { class: "page" });

    // page head
    page.appendChild(el("div", { class: "page-head" },
      el("div", {},
        el("h1", {}, "AI 量化"),
        el("p", {}, "对话创建策略、回测评估，达标后再一键部署。")
      ),
      el("div", { class: "actions" },
        el("button", { class: "btn", onclick: () => navigate("#/market") }, "策略广场"),
        el("button", { class: "btn", onclick: () => navigate("#/account") }, "配置交易所 API"),
      )
    ));

    const layout = el("div", { class: "aiq-layout" });

    // -------- sidebar --------
    const side = el("div", { class: "aiq-side" });
    side.appendChild(el("button", {
      class: "aiq-newchat",
      onclick: () => {
        const id = "c" + (s.conversations.length + 1);
        s.conversations.unshift({ id, title: "新对话", updated: Date.now(), messages: [] });
        s.activeId = id;
        saveState(appState);
        render();
      }
    }, "+ 新建会话"));

    const list = el("div", { class: "aiq-conv-list" });
    s.conversations.forEach((c) => {
      const isOn = c.id === s.activeId;
      const updTxt = new Date(c.updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      list.appendChild(el("div", {
        class: `aiq-conv ${isOn ? "is-on" : ""}`,
        onclick: () => { s.activeId = c.id; saveState(appState); render(); }
      },
        el("div", { class: "ttl" },
          el("span", {}, c.title),
          isOn ? el("span", { class: "check", html: icon("check", 14) }) : null
        ),
        el("div", { class: "upd" }, "更新于 " + updTxt),
        el("div", { class: "row" },
          el("button", {
            title: "重命名",
            onclick: (ev) => {
              ev.stopPropagation();
              const t = prompt("新名称", c.title);
              if (t && t.trim()) { c.title = t.trim(); saveState(appState); render(); }
            },
            html: icon("pencil", 14)
          }),
          el("button", {
            title: "删除",
            onclick: (ev) => {
              ev.stopPropagation();
              if (s.conversations.length === 1) { toast("至少保留一个会话", "warn"); return; }
              s.conversations = s.conversations.filter((x) => x.id !== c.id);
              if (s.activeId === c.id) s.activeId = s.conversations[0].id;
              saveState(appState); render();
            },
            html: icon("trash", 14)
          })
        )
      ));
    });
    side.appendChild(list);
    layout.appendChild(side);

    // -------- main --------
    const main = el("div", { class: "aiq-main" });

    const head = el("div", { class: "aiq-main-head" },
      el("span", { class: "aiq-bot-av", html: icon("bot", 18) }),
      el("span", { class: "ttl" }, "AI 策略助手"),
      el("div", { class: "actions" },
        el("button", {
          class: "btn btn-sm",
          onclick: () => { s.configOpen = !s.configOpen; saveState(appState); render(); }
        },
          el("span", { html: icon("params", 14) }),
          "参数配置"
        ),
        el("button", {
          class: "btn btn-sm btn-soft-violet",
          onclick: () => runBacktest()
        },
          el("span", { html: icon("play", 14) }),
          "开始回测"
        ),
      )
    );
    main.appendChild(head);

    // config panel (collapsible)
    if (s.configOpen) main.appendChild(renderAIConfigPanel(s));

    // messages
    const conv = s.conversations.find((x) => x.id === s.activeId);
    const msgs = el("div", { class: "aiq-msgs" });

    // first system greeting
    msgs.appendChild(el("div", { class: "aiq-msg" },
      el("div", { class: "aiq-bot-av", html: icon("bot", 18) }),
      el("div", { class: "bubble" }, "告诉我你的交易想法，我会帮你生成策略并回测。回测最大回撤需要 ≤ 20% 才能一键部署。")
    ));

    conv.messages.forEach((m) => {
      msgs.appendChild(el("div", { class: "aiq-msg " + (m.from === "user" ? "is-user" : "") },
        m.from !== "user" ? el("div", { class: "aiq-bot-av", html: icon("bot", 18) }) : null,
        el("div", { class: "bubble", html: m.html || (m.text || "").replace(/\n/g, "<br/>") })
      ));
    });
    main.appendChild(msgs);

    // input
    const ta = el("textarea", { placeholder: "描述你的交易策略，例如：3 分钟跌 1% 买入，15 分钟涨 2% 卖出…", rows: 1 });
    const send = el("button", { class: "aiq-send is-disabled", disabled: true, html: icon("send", 16) });
    const inputWrap = el("div", { class: "aiq-input-wrap" }, ta, send);

    const autosize = () => {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    };
    ta.addEventListener("input", () => {
      autosize();
      if (ta.value.trim()) { send.classList.remove("is-disabled"); send.disabled = false; }
      else { send.classList.add("is-disabled"); send.disabled = true; }
    });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!send.disabled) send.click();
      }
    });
    send.addEventListener("click", () => {
      const text = ta.value.trim();
      if (!text) return;
      sendUserMessage(text);
    });

    const foot = el("div", { class: "aiq-foot" },
      inputWrap,
      el("div", { class: "fineprint" }, "AI 生成的内容可能不准确，请务必在实盘前进行充分回测。")
    );
    main.appendChild(foot);

    layout.appendChild(main);
    page.appendChild(layout);

    setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 0);

    return page;
  };

  const renderAIConfigPanel = (s) => {
    const c = s.config;
    const ranges = ["7D", "30D", "90D", "1Y", "自定义"];

    const node = el("div", { class: "aiq-config" });
    node.appendChild(el("h3", {}, "回测参数"));
    node.appendChild(el("p", { class: "desc" }, "这里只编辑回测参数；策略参数请通过“返回对话修改”调整。"));

    const grid = el("div", { class: "grid" });

    // range
    grid.appendChild(el("div", { class: "field full" },
      el("label", {}, "历史回测区间"),
      el("div", { class: "seg" },
        ...ranges.map((r) => el("button", {
          type: "button",
          class: r === c.range ? "is-on" : "",
          onclick: () => { c.range = r; saveState(appState); render(); }
        }, r))
      )
    ));

    const inp = (label, key, ph) => el("div", { class: "field" },
      el("label", {}, label, el("span", { style: { color: "var(--danger)" } }, " *")),
      el("input", {
        type: "text", placeholder: ph, value: c[key] || "",
        oninput: (e) => { c[key] = e.target.value; saveState(appState); }
      })
    );
    grid.appendChild(inp("初始资金", "capital", "请输入初始资金，例如 10000"));
    grid.appendChild(inp("滑点 (bps)", "slippage", "请输入滑点，例如 5"));
    grid.appendChild(inp("手续费 (bps)", "fee", "请输入手续费，例如 2"));

    const sel = (label, key, opts) => el("div", { class: "field" },
      el("label", {}, label, el("span", { style: { color: "var(--danger)" } }, " *")),
      el("select", {
        onchange: (e) => { c[key] = e.target.value; saveState(appState); }
      },
        el("option", { value: "" }, "请选择" + label),
        ...opts.map((o) => el("option", { value: o, selected: c[key] === o }, o))
      )
    );
    grid.appendChild(sel("成交价来源", "priceSrc", ["逐笔成交价", "K 线收盘价", "买一/卖一价"]));
    grid.appendChild(sel("允许部分覆盖数据继续跑回测", "allowPartial", ["是", "否"]));

    node.appendChild(grid);

    node.appendChild(el("div", { class: "foot" },
      el("button", { class: "btn", onclick: () => { s.configOpen = false; saveState(appState); render(); } }, "收起"),
      el("button", {
        class: "btn btn-soft-violet",
        onclick: () => {
          if (!c.capital || !c.slippage || !c.fee || !c.priceSrc || !c.allowPartial) {
            toast("请填写所有必填项", "warn"); return;
          }
          toast("回测参数已确认", "ok");
          s.configOpen = false; saveState(appState); render();
        }
      }, "确认参数")
    ));

    return node;
  };

  const sendUserMessage = (text) => {
    const s = ensureAIState();
    const conv = s.conversations.find((x) => x.id === s.activeId);
    conv.messages.push({ from: "user", text, at: Date.now() });
    conv.updated = Date.now();
    if (conv.title === "新对话") conv.title = text.length > 14 ? text.slice(0, 14) + "…" : text;
    saveState(appState); render();

    // simulated AI reply
    setTimeout(() => {
      const reply = generateStrategyReply(text);
      conv.messages.push({ from: "bot", html: reply, at: Date.now() });
      conv.updated = Date.now();
      saveState(appState); render();
    }, 700);
  };

  const generateStrategyReply = (input) => {
    const lower = input.toLowerCase();
    let type = "trend";
    if (/网格|grid|区间/.test(input)) type = "grid";
    else if (/突破|布林|趋势|ma|均线/i.test(input)) type = "trend";
    else if (/rsi|超买|超卖|反转/i.test(input)) type = "reversion";
    else if (/资金费率|套利|funding/i.test(input)) type = "arb";

    const tpl = {
      grid:      { strat: "grid_band", sharpe: "2.14", mdd: "-9.8%", cagr: "+47.3%" },
      trend:     { strat: "trend_follow", sharpe: "1.78", mdd: "-12.4%", cagr: "+31.6%" },
      reversion: { strat: "mean_revert", sharpe: "1.42", mdd: "-8.1%", cagr: "+22.5%" },
      arb:       { strat: "funding_arb", sharpe: "3.42", mdd: "-3.1%", cagr: "+18.9%" },
    }[type];

    return `
      <div style="margin-bottom:10px;">
        已根据你的描述识别为 <strong>${tpl.strat}</strong> 类策略。我建议先用以下配置回测：
      </div>
      <div style="background:var(--bg-soft);border-radius:10px;padding:12px 14px;font-family:var(--font-mono);font-size:12.5px;line-height:1.7;color:var(--text);">
        strategy = ${tpl.strat}(<br/>
        &nbsp;&nbsp;asset = <span style="color:var(--violet)">"BTC/USDT"</span>,<br/>
        &nbsp;&nbsp;tf = <span style="color:var(--violet)">"15m"</span>,<br/>
        &nbsp;&nbsp;risk = <span style="color:var(--violet)">{ max_dd: 0.20, max_lev: 3 }</span><br/>
        )
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <span class="chip chip-ok"><span class="dot"></span>Sharpe ${tpl.sharpe}</span>
        <span class="chip chip-violet"><span class="dot"></span>CAGR ${tpl.cagr}</span>
        <span class="chip">MDD ${tpl.mdd}</span>
      </div>
      <div style="margin-top:12px;color:var(--text-mid);font-size:13px;">
        点击右上角 <strong>开始回测</strong> 看完整曲线。
      </div>
    `;
  };

  const runBacktest = () => {
    const s = ensureAIState();
    const conv = s.conversations.find((x) => x.id === s.activeId);
    if (!conv || conv.messages.length === 0) {
      toast("请先描述你的交易想法", "warn"); return;
    }
    conv.messages.push({
      from: "bot",
      html: `
        <div style="margin-bottom:8px;">已启动回测 · 2021-01 → 2026-04 · BTC/USDT · 15m</div>
        <svg viewBox="0 0 480 140" preserveAspectRatio="none" style="width:100%;height:140px;background:var(--bg-soft);border-radius:10px;">
          <defs>
            <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#7C5CFF" stop-opacity="0.35"/>
              <stop offset="100%" stop-color="#7C5CFF" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="M0,110 L40,108 L80,100 L120,104 L160,88 L200,94 L240,76 L280,82 L320,60 L360,68 L400,44 L440,50 L480,28 L480,140 L0,140 Z" fill="url(#bg1)"/>
          <path d="M0,110 L40,108 L80,100 L120,104 L160,88 L200,94 L240,76 L280,82 L320,60 L360,68 L400,44 L440,50 L480,28" fill="none" stroke="#7C5CFF" stroke-width="2"/>
        </svg>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px;">
          <div class="kv"><div class="l">CAGR</div><div class="v up" style="font-size:18px;">+47.3%</div></div>
          <div class="kv"><div class="l">SHARPE</div><div class="v" style="font-size:18px;">2.14</div></div>
          <div class="kv"><div class="l">MDD</div><div class="v" style="font-size:18px;">-9.8%</div></div>
          <div class="kv"><div class="l">胜率</div><div class="v" style="font-size:18px;">68.4%</div></div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button class="btn btn-sm btn-primary" onclick="window.__qfDeploy()">一键部署到 OKX 模拟盘</button>
          <button class="btn btn-sm" onclick="window.__qfFork()">保存到策略广场</button>
        </div>
      `,
      at: Date.now()
    });
    conv.updated = Date.now();
    saveState(appState); render();
  };
  window.__qfDeploy = () => toast("策略已部署 · 24h 后可查看实盘 PNL", "ok");
  window.__qfFork = () => toast("已保存到策略广场草稿", "ok");

  // =========================================================
  // STRATEGY MARKETPLACE
  // =========================================================
  const STRAT_LIST = [
    { id: "ma", name: "MA 均线交叉", tags: ["趋势跟随", "均线", "OKX 模拟盘"], desc: "短均线上穿长均线做多，跌回长均线下方退出。",
      pair: "BTC-USDT-SWAP / 15m", env: "OKX 模拟盘", market: "永续", pos: "35%", lev: "2x",
      win: 58.14, mdd: 0.78, ret: 1.78 },
    { id: "boll", name: "布林带均值回归", tags: ["均值回归", "布林带", "OKX 模拟盘"], desc: "价格触及布林带外轨后等待回归，中轨附近止盈。",
      pair: "ETH-USDT-SWAP / 15m", env: "OKX 模拟盘", market: "永续", pos: "35%", lev: "2x",
      win: 79.49, mdd: 1.64, ret: 2.8 },
    { id: "range", name: "区间低买高卖", tags: ["区间", "低买高卖", "OKX 模拟盘"], desc: "区间下沿买入，回到区间上沿卖出，适合震荡行情。",
      pair: "BTC-USDT / 15m", env: "OKX 模拟盘", market: "现货", pos: "25%", lev: "无杠杆",
      win: 82.61, mdd: 0.93, ret: 0.67 },
    { id: "rsi", name: "RSI 超买超卖", tags: ["RSI", "反转", "OKX 模拟盘"], desc: "RSI 低位买入、高位退出，适合短周期反转。",
      pair: "ETH-USDT / 15m", env: "OKX 模拟盘", market: "现货", pos: "25%", lev: "无杠杆",
      win: 78.95, mdd: 1.76, ret: 0.89 },
    { id: "brk", name: "突破追踪", tags: ["突破", "趋势", "OKX 模拟盘"], desc: "价格突破近期区间后跟随趋势，跌回区间则退出。",
      pair: "BTC-USDT-SWAP / 15m", env: "OKX 模拟盘", market: "永续", pos: "25%", lev: "2x",
      win: 70.59, mdd: 1.04, ret: 0.78 },
    { id: "macd", name: "MACD 金叉死叉", tags: ["MACD", "动能", "OKX 模拟盘"], desc: "MACD 金叉做多，死叉退出，适合趋势确认。",
      pair: "ETH-USDT-SWAP / 15m", env: "OKX 模拟盘", market: "永续", pos: "35%", lev: "2x",
      win: 58.33, mdd: 1.34, ret: 2.09 },
  ];

  const renderMarketPage = () => {
    const page = el("main", { class: "page-wide" });

    page.appendChild(el("div", { class: "page-head" },
      el("div", {},
        el("h1", {}, "策略广场"),
        el("p", {}, "精选优质策略模版，一键运行或二次开发")
      ),
      el("div", { class: "actions" },
        el("button", { class: "btn", onclick: () => navigate("#/ai") }, "返回 AI 量化"),
      )
    ));
    page.appendChild(el("p", { class: "market-intro" },
      "首次对话可先从推荐策略开始，也可以继续在上面对话自定义。"
    ));

    const grid = el("div", { class: "market-grid" });
    STRAT_LIST.forEach((s) => grid.appendChild(renderStratCard(s)));
    page.appendChild(grid);

    return page;
  };

  const renderStratCard = (s) => {
    return el("article", { class: "strat-card" },
      el("div", { class: "head" },
        el("div", { class: "ico", html: icon("activity", 18) }),
        el("div", {},
          el("h3", {}, s.name),
          el("div", { class: "tags" }, ...s.tags.map((t) => el("span", {}, t)))
        )
      ),
      el("p", { class: "desc" }, s.desc),
      el("div", { class: "meta" },
        el("div", { class: "meta-row" }, el("span", {}, "交易对 / 周期"), el("span", { class: "v" }, s.pair)),
        el("div", { class: "meta-row" }, el("span", {}, "环境"), el("span", { class: "v" }, s.env)),
        el("div", { class: "meta-row" }, el("span", {}, "市场"), el("span", { class: "v" }, s.market)),
        el("div", { class: "meta-row" }, el("span", {}, "仓位 / 杠杆"), el("span", { class: "v" }, `${s.pos} / ${s.lev}`)),
      ),
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("div", { class: "l" }, "胜率"), el("div", { class: "v" }, s.win.toFixed(2) + "%")),
        el("div", { class: "stat" }, el("div", { class: "l" }, "最大回撤"), el("div", { class: "v up" }, s.mdd.toFixed(2) + "%")),
        el("div", { class: "stat" }, el("div", { class: "l" }, "总收益"), el("div", { class: "v" }, "+" + s.ret.toFixed(2) + "%")),
      ),
      el("div", { class: "actions" },
        el("button", {
          class: "btn btn-primary",
          onclick: () => {
            // create a conversation with this strategy
            const aiSt = ensureAIState();
            const id = "c" + (aiSt.conversations.length + 1);
            aiSt.conversations.unshift({
              id, title: s.name, updated: Date.now(),
              messages: [{ from: "user", text: `运行模版：${s.name}` }, { from: "bot", html: generateStrategyReply(s.name) }]
            });
            aiSt.activeId = id;
            saveState(appState);
            navigate("#/ai");
            setTimeout(() => toast(`已载入：${s.name}`, "ok"), 100);
          }
        }, el("span", { html: icon("play", 14) }), "运行"),
        el("button", {
          class: "btn",
          onclick: () => toast("打开编辑器…", "info"),
        }, el("span", { html: icon("pencil", 14) }), "编辑")
      )
    );
  };

  // =========================================================
  // MARKET (行情数据) — terminal-style page
  // =========================================================
  const PAIRS = [
    { sym: "BTCUSDT",  perp: true,  px: 87010,    ch: -0.45,  vol: "59.33亿", color: "#F7931A", letter: "B" },
    { sym: "ETHUSDT",  perp: true,  px: 4850.2,   ch:  1.25,  vol: "21.6亿",  color: "#627EEA", letter: "E" },
    { sym: "SOLUSDT",  perp: true,  px: 145.8,    ch:  5.40,  vol: "1.74亿",  color: "#9945FF", letter: "S" },
    { sym: "XRPUSDT",  perp: true,  px: 1.1,      ch: -2.30,  vol: "5500万",  color: "#23292F", letter: "X" },
    { sym: "BNBUSDT",  perp: true,  px: 620.5,    ch:  0.80,  vol: "9300万",  color: "#F3BA2F", letter: "B" },
    { sym: "DOGEUSDT", perp: true,  px: 0.4,      ch:  8.50,  vol: "3.04亿",  color: "#C2A633", letter: "D" },
    { sym: "ADAUSDT",  perp: true,  px: 0.8,      ch: -1.10,  vol: "3375万",  color: "#0033AD", letter: "A" },
    { sym: "AVAXUSDT", perp: true,  px: 42.6,     ch:  3.20,  vol: "3360万",  color: "#E84142", letter: "A" },
    { sym: "LINKUSDT", perp: true,  px: 18.9,     ch:  0.50,  vol: "2160万",  color: "#2A5ADA", letter: "L" },
    { sym: "DOTUSDT",  perp: true,  px: 8.4,      ch: -0.90,  vol: "2100万",  color: "#E6007A", letter: "D" },
    { sym: "TRXUSDT",  perp: true,  px: 0.22,     ch:  1.10,  vol: "1820万",  color: "#FF060A", letter: "T" },
    { sym: "MATICUSDT",perp: true,  px: 0.74,     ch: -3.40,  vol: "1670万",  color: "#8247E5", letter: "M" },
    { sym: "ATOMUSDT", perp: true,  px: 5.6,      ch:  0.20,  vol: "1380万",  color: "#2E3148", letter: "A" },
    { sym: "LTCUSDT",  perp: true,  px: 88.4,     ch: -1.80,  vol: "1240万",  color: "#345D9D", letter: "L" },
  ];

  const ensureMarketState = () => {
    if (!appState.market) {
      appState.market = { pair: "BTCUSDT", tab: "perp", tf: "1H", agg: true, query: "" };
      saveState(appState);
    }
    return appState.market;
  };

  // generate fake candles, deterministic per pair, last candle = current price
  const genCandles = (seed, n, end) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const rnd = () => { h = (h * 1103515245 + 12345) >>> 0; return ((h >>> 16) / 65535) - 0.5; };
    const candles = [];
    let p = end * (0.92 + Math.abs(rnd()) * 0.04);
    for (let i = 0; i < n; i++) {
      const drift = (end - p) / (n - i || 1);
      const vol = end * 0.004;
      const open = p;
      p = p + drift + rnd() * vol;
      const close = p;
      const high = Math.max(open, close) + Math.abs(rnd()) * vol * 0.8;
      const low  = Math.min(open, close) - Math.abs(rnd()) * vol * 0.8;
      candles.push({ open, high, low, close });
    }
    // last candle clamp to end
    const last = candles[candles.length - 1];
    last.close = end;
    last.high = Math.max(last.high, end);
    last.low = Math.min(last.low, end);
    return candles;
  };

  const renderMarketTradingPage = () => {
    const ms = ensureMarketState();
    const sel = PAIRS.find((p) => p.sym === ms.pair) || PAIRS[0];

    const page = el("main", { class: "market-page" });

    // ---------- top strip ----------
    const top = el("div", { class: "market-topstrip" });
    top.appendChild(el("div", { class: "mk-pair" },
      el("span", { class: "av", style: { background: `linear-gradient(135deg, ${sel.color} 0%, ${sel.color}aa 100%)` } }, sel.letter),
      el("span", { class: "name" }, sel.sym.replace("USDT", "USDT")),
      el("span", {}, " 永续"),
      el("span", { class: "arr", html: icon("caret", 14) })
    ));

    const isDown = sel.ch < 0;
    const pxColor = isDown ? "var(--mk-dn)" : "var(--mk-up)";
    const sellAmt = (sel.px * Math.abs(sel.ch) / 100).toFixed(1);
    top.appendChild(el("div", { class: "mk-price" },
      el("div", { class: "px", style: { color: pxColor } }, formatPx(sel.px)),
      el("div", { class: "ch", style: { color: pxColor } },
        el("span", {}, (sel.ch >= 0 ? "+" : "") + sellAmt),
        el("span", {}, (sel.ch >= 0 ? "+" : "") + sel.ch.toFixed(2) + "%"),
      )
    ));

    const mkStat = (label, val, cls = "") => el("div", { class: "mk-stat" },
      el("div", { class: "l" }, label),
      el("div", { class: "v " + cls }, val)
    );
    top.appendChild(mkStat("指数价格", "$" + formatPx(sel.px * 0.85)));
    top.appendChild(mkStat("标记价格", "$" + formatPx(sel.px)));
    top.appendChild(mkStat("资金费率 ⓘ", "+0.0000%"));
    top.appendChild(mkStat("24小时最低", "$" + formatPx(sel.px * 0.99)));
    top.appendChild(mkStat("24小时最高", "$" + formatPx(sel.px * 1.02)));
    top.appendChild(mkStat("持仓量", "89.36 BTC"));
    top.appendChild(mkStat("24小时量", "63.25 BTC"));
    page.appendChild(top);

    // ---------- body grid ----------
    const body = el("div", { class: "market-body" });

    // -------- left: pair list --------
    const left = el("div", { class: "market-left" });
    left.appendChild(el("div", { class: "mkl-tabs" },
      el("button", {
        class: ms.tab === "perp" ? "is-on" : "",
        onclick: () => { ms.tab = "perp"; saveState(appState); render(); }
      }, "合约"),
      el("button", {
        class: ms.tab === "spot" ? "is-on" : "",
        onclick: () => { ms.tab = "spot"; saveState(appState); render(); }
      }, "现货")
    ));
    left.appendChild(el("div", { class: "mkl-search" },
      el("div", { class: "mkl-search-input" },
        el("span", { html: icon("search", 14) }),
        el("input", {
          placeholder: "搜索", value: ms.query,
          oninput: (e) => { ms.query = e.target.value; saveState(appState); renderPairList(list, ms); }
        })
      )
    ));
    left.appendChild(el("div", { class: "mkl-head" },
      el("span", {}, "币种"),
      el("span", { style: { textAlign: "right" } }, "价格"),
      el("span", { style: { textAlign: "right" } }, "涨跌幅"),
      el("span", { style: { textAlign: "right" } }, "成交额"),
    ));
    const list = el("div", { class: "mkl-list" });
    renderPairList(list, ms);
    left.appendChild(list);
    body.appendChild(left);

    // -------- center: chart --------
    const center = el("div", { class: "market-center" });

    // toolbar
    center.appendChild(el("div", { class: "mkc-toolbar" },
      el("button", { class: "icon-btn-flat", title: "快速操作", html: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none"><path d="M9 2L3 9h4l-1 5 6-7H8l1-5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>' }),
      el("button", { class: "icon-btn-flat", title: "指标", html: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none"><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.4"/><path d="M8 3 L8 8 L11 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' }),
      el("button", { class: "icon-btn-flat", title: "全屏", html: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none"><path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' }),
      el("button", { class: "icon-btn-flat", title: "截图", html: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none"><rect x="2" y="4.5" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="9" r="2" stroke="currentColor" stroke-width="1.4"/><path d="M6 4.5l1-1.5h2l1 1.5" stroke="currentColor" stroke-width="1.4"/></svg>' }),
      el("span", { class: "mkc-agg" },
        el("span", {}, "聚合"),
        el("button", {
          class: "toggle " + (ms.agg ? "is-on" : ""),
          onclick: () => { ms.agg = !ms.agg; saveState(appState); render(); }
        })
      ),
    ));

    // OHLC strip
    const candles = genCandles(sel.sym, 80, sel.px);
    const last = candles[candles.length - 1];
    center.appendChild(el("div", { class: "mkc-ohlc" },
      el("span", {}, "开=", el("span", { class: "v " + (last.open <= last.close ? "up" : "dn") }, formatPx(last.open))),
      el("span", {}, "高=", el("span", { class: "v " + (last.high === Math.max(last.open, last.close) ? "up" : "up") }, formatPx(last.high))),
      el("span", {}, "低=", el("span", { class: "v dn" }, formatPx(last.low))),
      el("span", {}, "收=", el("span", { class: "v " + (last.close >= last.open ? "up" : "dn") }, formatPx(last.close)))
    ));

    // chart
    center.appendChild(el("div", { class: "mkc-chart", html: candleSVG(candles, sel.px) }));

    // bottom timeframes
    center.appendChild(el("div", { class: "mkc-bottombar" },
      el("div", { class: "tfs" },
        ...["3个月", "5天", "1天"].map((t) => el("button", {
          class: ms.tf === t ? "is-on" : "",
          onclick: () => { ms.tf = t; saveState(appState); render(); }
        }, t)),
        el("button", {
          class: "icon-btn-flat",
          title: "保存",
          html: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M3 3h7l3 3v7H3z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>'
        }),
      ),
      el("div", { class: "right" },
        el("span", { class: "mono" }, fmtUTC()),
        el("button", { class: "is-on" }, "%"),
        el("button", {}, "log"),
        el("button", { class: "is-on" }, "自动"),
      )
    ));

    body.appendChild(center);

    // -------- right: order book --------
    const right = el("div", { class: "market-right" });
    right.appendChild(el("div", { class: "mkr-head" },
      el("span", { class: "ttl" },
        el("span", {}, sel.sym),
        el("button", { title: "复制", html: icon("copy", 12), onclick: (e) => copyText(sel.sym, e.currentTarget) })
      ),
      el("span", { class: "agg" }, ms.agg ? "聚合" : "单一")
    ));
    right.appendChild(el("div", { class: "mkr-stats" },
      el("div", { class: "row" }, el("span", { class: "l" }, "累计成交额($):"), el("span", { class: "v" }, "783.09亿")),
      el("div", { class: "row" }, el("span", { class: "l" }, "累计净流入($):"), el("span", { class: "v dn" }, "-39.15亿")),
      el("div", { class: "row" }, el("span", { class: "l" }, "最高:"), el("span", { class: "v" }, "$" + formatPx(sel.px * 1.02))),
      el("div", { class: "row" }, el("span", { class: "l" }, "最低:"), el("span", { class: "v" }, "$" + formatPx(sel.px * 0.99))),
    ));
    right.appendChild(el("div", { class: "mkr-tools" },
      el("button", { class: "icon-btn-flat", title: "刷新", html: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M13 8a5 5 0 1 1 -5 -5M13 3v3h-3" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' }),
      el("button", { class: "icon-btn-flat", title: "排序", html: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M3 5h10M3 8h7M3 11h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' }),
      el("button", { class: "icon-btn-flat", title: "切换", html: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M5 3v10M5 3l-2 2M5 3l2 2M11 13V3M11 13l-2-2M11 13l2-2" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' }),
      el("span", { class: "spacer" }),
      el("select", {},
        el("option", {}, "2位小数"),
        el("option", {}, "1位小数"),
        el("option", {}, "整数")
      )
    ));

    // book
    const book = renderOrderBook(sel);
    right.appendChild(book);
    body.appendChild(right);

    page.appendChild(body);
    return page;
  };

  const formatPx = (n) => {
    if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n >= 1) return n.toFixed(2);
    return n.toFixed(4);
  };

  const fmtUTC = () => {
    const d = new Date();
    const h = String(d.getUTCHours()).padStart(2, "0");
    const m = String(d.getUTCMinutes()).padStart(2, "0");
    const s = String(d.getUTCSeconds()).padStart(2, "0");
    return `${h}:${m}:${s} UTC`;
  };

  const renderPairList = (host, ms) => {
    host.innerHTML = "";
    const q = (ms.query || "").trim().toUpperCase();
    const filtered = PAIRS.filter((p) => !q || p.sym.includes(q));
    filtered.forEach((p) => {
      host.appendChild(el("div", {
        class: "mkl-row " + (p.sym === ms.pair ? "is-on" : ""),
        onclick: () => { ms.pair = p.sym; saveState(appState); render(); }
      },
        el("span", { class: "sym" },
          el("span", {}, p.sym.length > 9 ? p.sym.slice(0, 6) + "…" : p.sym),
          ms.tab === "perp" ? el("span", { class: "perp" }, "永续") : null
        ),
        el("span", { class: "px" }, formatPx(p.px)),
        el("span", { class: "ch " + (p.ch >= 0 ? "up" : "dn") }, (p.ch >= 0 ? "+" : "") + p.ch.toFixed(2) + "%"),
        el("span", { class: "vol" }, p.vol),
      ));
    });
  };

  // candlestick + volume bar SVG renderer
  const candleSVG = (candles, lastPx) => {
    const W = 800, H = 420;
    const padL = 0, padR = 70, padT = 8, padB = 80;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const volH = 60;
    const chartH = innerH - volH - 8;

    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    let maxP = Math.max(...highs);
    let minP = Math.min(...lows);
    const pad = (maxP - minP) * 0.10;
    maxP += pad; minP -= pad;

    const x = (i) => padL + (i + 0.5) * (innerW / candles.length);
    const y = (p) => padT + (1 - (p - minP) / (maxP - minP)) * chartH;
    const cw = (innerW / candles.length) * 0.6;

    let candleEls = "";
    candles.forEach((c, i) => {
      const up = c.close >= c.open;
      const color = up ? "#16A36B" : "#E5484D";
      const cx = x(i);
      candleEls += `<line x1="${cx}" x2="${cx}" y1="${y(c.high)}" y2="${y(c.low)}" stroke="${color}" stroke-width="1"/>`;
      const top = y(Math.max(c.open, c.close));
      const bot = y(Math.min(c.open, c.close));
      candleEls += `<rect x="${cx - cw / 2}" y="${top}" width="${cw}" height="${Math.max(1, bot - top)}" fill="${color}"/>`;
    });

    // volume
    const volMax = Math.max(...candles.map((c) => Math.abs(c.close - c.open)));
    const volY0 = padT + chartH + 8;
    let volEls = "";
    candles.forEach((c, i) => {
      const up = c.close >= c.open;
      const color = up ? "rgba(22,163,107,0.6)" : "rgba(229,72,77,0.6)";
      const h = Math.max(2, (Math.abs(c.close - c.open) / volMax) * volH);
      volEls += `<rect x="${x(i) - cw / 2}" y="${volY0 + volH - h}" width="${cw}" height="${h}" fill="${color}"/>`;
    });

    // price scale (right)
    const ticks = 7;
    let yAxis = "";
    let gridLines = "";
    for (let i = 0; i <= ticks; i++) {
      const t = i / ticks;
      const py = padT + t * chartH;
      const pv = maxP - t * (maxP - minP);
      yAxis += `<text x="${W - padR + 6}" y="${py + 4}" font-size="11" fill="#8A93A6" font-family="JetBrains Mono, monospace">${pv.toFixed(2)}</text>`;
      gridLines += `<line x1="${padL}" x2="${W - padR}" y1="${py}" y2="${py}" stroke="#F3F4F8"/>`;
    }

    // last price line + tag
    const lastIdx = candles.length - 1;
    const lastY = y(lastPx);
    const lastUp = candles[lastIdx].close >= candles[lastIdx].open;
    const lpc = lastUp ? "#16A36B" : "#E5484D";
    const lastTag = `
      <line x1="${padL}" x2="${W - padR}" y1="${lastY}" y2="${lastY}" stroke="${lpc}" stroke-width="1" stroke-dasharray="4 4" opacity="0.6"/>
      <rect x="${W - padR + 2}" y="${lastY - 9}" width="56" height="18" rx="2" fill="${lpc}"/>
      <text x="${W - padR + 10}" y="${lastY + 4}" font-size="11" fill="#fff" font-family="JetBrains Mono, monospace">${formatPx(lastPx)}</text>
    `;
    // crosshair-ish helper line at last candle (vertical)
    const crossX = x(lastIdx);
    const cross = `
      <line x1="${crossX}" x2="${crossX}" y1="${padT}" y2="${padT + chartH}" stroke="${lpc}" stroke-width="1" opacity="0.6"/>
    `;

    return `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;">
        ${gridLines}
        ${candleEls}
        ${volEls}
        ${yAxis}
        ${cross}
        ${lastTag}
      </svg>
    `;
  };

  // order book (asks descending top, mid, bids descending bottom)
  const renderOrderBook = (sel) => {
    const wrap = el("div", { class: "mkr-book" });
    wrap.appendChild(el("div", { class: "colhead" },
      el("span", {}, "价格(USDT)"),
      el("span", { class: "c2" }, "数量(BTC)"),
      el("span", { class: "c3" }, "委托额")
    ));

    // generate asks/bids
    const mid = sel.px;
    const step = sel.px >= 1000 ? 1 : sel.px >= 10 ? 0.01 : 0.0001;
    const isDn = sel.ch < 0;

    let h = 0;
    const seedstr = sel.sym;
    for (let i = 0; i < seedstr.length; i++) h = (h * 31 + seedstr.charCodeAt(i)) >>> 0;
    const rnd = () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 16) / 65535; };

    const askCount = 8, bidCount = 10;
    const asks = [];
    let totA = 0;
    for (let i = askCount; i >= 1; i--) {
      const px = mid + step * i;
      const qty = +(rnd() * 5 + 0.05).toFixed(5);
      const ttl = qty * px;
      totA += ttl;
      asks.push({ px, qty, ttl, cumttl: totA });
    }
    const bids = [];
    let totB = 0;
    for (let i = 1; i <= bidCount; i++) {
      const px = mid - step * i;
      const qty = +(rnd() * 6 + 0.05).toFixed(5);
      const ttl = qty * px;
      totB += ttl;
      bids.push({ px, qty, ttl, cumttl: totB });
    }
    const maxBar = Math.max(totA, totB);

    const rows = el("div", { class: "mkr-rows" });
    asks.forEach((a) => {
      const w = (a.cumttl / maxBar) * 100;
      rows.appendChild(el("div", { class: "mkr-row ask" },
        el("span", { class: "bar", style: { width: w + "%" } }),
        el("span", { class: "px" }, formatPx(a.px)),
        el("span", { class: "qty" }, a.qty.toFixed(5)),
        el("span", { class: "tot" }, formatPx(a.ttl))
      ));
    });

    wrap.appendChild(rows);

    // mid price
    wrap.appendChild(el("div", { class: "mkr-mid" },
      el("span", { class: "px " + (isDn ? "dn" : "up") }, formatPx(mid)),
      el("span", { class: "ch " + (isDn ? "dn" : "up") },
        (sel.ch >= 0 ? "+" : "") + sel.ch.toFixed(2) + "%",
        el("br", {}),
        (sel.ch < 0 ? "-" : "+") + (Math.abs(sel.ch / 100) * sel.px).toFixed(2)
      )
    ));

    // bids
    const rowsB = el("div", { class: "mkr-rows" });
    bids.forEach((b) => {
      const w = (b.cumttl / maxBar) * 100;
      rowsB.appendChild(el("div", { class: "mkr-row bid" },
        el("span", { class: "bar", style: { width: w + "%" } }),
        el("span", { class: "px" }, formatPx(b.px)),
        el("span", { class: "qty" }, b.qty.toFixed(5)),
        el("span", { class: "tot" }, formatPx(b.ttl))
      ));
    });
    wrap.appendChild(rowsB);

    return wrap;
  };

  // =========================================================
  // LONG / SHORT RATIO
  // =========================================================
  const LS_COINS = [
    { sym: "BTC",  color: "#F7931A", letter: "₿",  totalLong: 23.21, totalShort: 21.73 },
    { sym: "ETH",  color: "#627EEA", letter: "Ξ",  totalLong: 8.42,  totalShort: 7.91 },
    { sym: "SOL",  color: "#9945FF", letter: "S",  totalLong: 2.18,  totalShort: 2.05 },
    { sym: "XRP",  color: "#23292F", letter: "X",  totalLong: 1.06,  totalShort: 1.12 },
    { sym: "HYPE", color: "#15B79E", letter: "H",  totalLong: 0.84,  totalShort: 0.91 },
    { sym: "DOGE", color: "#C2A633", letter: "Ð",  totalLong: 1.41,  totalShort: 1.28 },
    { sym: "BNB",  color: "#F3BA2F", letter: "B",  totalLong: 1.92,  totalShort: 1.75 },
  ];

  const LS_EXCHANGES = [
    { name: "Binance", color: "#F3BA2F", textColor: "#000" },
    { name: "MEXC",    color: "#1972F5", textColor: "#fff" },
    { name: "WhiteBIT",color: "#A1AECF", textColor: "#fff" },
    { name: "OKX",     color: "#000",    textColor: "#fff" },
    { name: "Bybit",   color: "#F7A600", textColor: "#000" },
    { name: "Gate",    color: "#2354E6", textColor: "#fff" },
    { name: "Bitget",  color: "#00C7BE", textColor: "#fff" },
    { name: "KuCoin",  color: "#24DC8E", textColor: "#000" },
    { name: "Coinbase",color: "#0052FF", textColor: "#fff" },
    { name: "Kraken",  color: "#5741D9", textColor: "#fff" },
    { name: "Bitfinex",color: "#16A085", textColor: "#fff" },
    { name: "HTX",     color: "#1AAE93", textColor: "#fff" },
  ];

  const LS_PERIODS = ["5分钟", "15分钟", "30分钟", "1小时", "4小时", "12小时", "1天"];

  const ensureLSState = () => {
    if (!appState.ls) {
      appState.ls = { coin: "BTC", period: "4小时", coinOpen: false, periodOpen: false };
      saveState(appState);
    }
    return appState.ls;
  };

  // deterministic per (coin, exchange, period)
  const genExchangeRatios = (coinSym, period) => {
    let seed = coinSym + "::" + period;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const rnd = () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 16) / 65535; };

    return LS_EXCHANGES.map((ex) => {
      // long ratio between 0.42 and 0.60
      const longRatio = 0.42 + rnd() * 0.18;
      const totalAmt = 0.5 + rnd() * 5;  // $亿
      const longAmt = totalAmt * longRatio;
      const shortAmt = totalAmt * (1 - longRatio);
      return {
        name: ex.name, color: ex.color, textColor: ex.textColor,
        longPct: longRatio * 100,
        shortPct: (1 - longRatio) * 100,
        longAmt, shortAmt,
        total: totalAmt
      };
    }).sort((a, b) => b.total - a.total);
  };

  const renderLSPage = () => {
    const s = ensureLSState();
    const coin = LS_COINS.find((c) => c.sym === s.coin) || LS_COINS[0];
    const rows = genExchangeRatios(coin.sym, s.period);

    const page = el("main", { class: "page-wide ls-page" });

    // ---- head with selectors ----
    const head = el("div", { class: "ls-head" },
      el("div", {},
        el("h1", {}, "交易所多空比", coin.sym),
        el("p", {}, "交易所多空持仓人数及持仓量比")
      ),
      el("div", { class: "right" },
        // coin select
        lsSelect({
          value: s.coin,
          open: s.coinOpen,
          options: LS_COINS.map((c) => c.sym),
          onToggle: () => {
            s.coinOpen = !s.coinOpen; s.periodOpen = false; saveState(appState); render();
          },
          onPick: (v) => {
            s.coin = v; s.coinOpen = false; saveState(appState); render();
          }
        }),
        // period select
        lsSelect({
          value: s.period,
          open: s.periodOpen,
          options: LS_PERIODS,
          width: 96,
          onToggle: () => {
            s.periodOpen = !s.periodOpen; s.coinOpen = false; saveState(appState); render();
          },
          onPick: (v) => {
            s.period = v; s.periodOpen = false; saveState(appState); render();
          }
        }),
        el("button", {
          class: "ls-refresh",
          title: "刷新",
          onclick: (e) => {
            const b = e.currentTarget;
            b.classList.add("is-loading");
            setTimeout(() => { saveState(appState); render(); toast("数据已刷新", "ok"); }, 600);
          },
          html: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none"><path d="M13 8a5 5 0 1 1 -5 -5M13 3v3h-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        })
      )
    );
    page.appendChild(head);

    // close popups when clicking elsewhere on page
    page.addEventListener("click", (e) => {
      if (!e.target.closest(".ls-select")) {
        if (s.coinOpen || s.periodOpen) {
          s.coinOpen = false; s.periodOpen = false; saveState(appState); render();
        }
      }
    });

    // ---- aggregate banner ----
    const totLong = coin.totalLong, totShort = coin.totalShort;
    const totSum = totLong + totShort;
    const totLongPct = (totLong / totSum) * 100;
    const totShortPct = (totShort / totSum) * 100;

    const banner = el("div", { class: "ls-banner" },
      el("div", { class: "coin-id" },
        el("span", { class: "av", style: { background: `linear-gradient(135deg, ${coin.color} 0%, ${darken(coin.color)} 100%)` } }, coin.letter),
        el("div", {},
          el("div", { class: "nm" }, coin.sym),
          el("div", { class: "sub" }, "总计")
        )
      ),
      el("div", { class: "lsbar" },
        el("div", { class: "seg-l", style: { width: totLongPct + "%" } }, totLongPct.toFixed(2) + "%"),
        el("div", { class: "seg-s", style: { width: totShortPct + "%" } }, totShortPct.toFixed(2) + "%"),
      ),
      el("div", { class: "amounts" },
        el("div", { class: "row" },
          el("div", { class: "cell" },
            el("div", { class: "l" }, "做多"),
            el("div", { class: "v long" }, "US$" + totLong.toFixed(2) + "亿")
          ),
          el("div", { class: "cell" },
            el("div", { class: "l" }, "做空"),
            el("div", { class: "v short" }, "US$" + totShort.toFixed(2) + "亿")
          )
        )
      )
    );
    page.appendChild(banner);

    // ---- table ----
    const table = el("div", { class: "ls-table" });
    table.appendChild(el("div", { class: "ls-table-head" },
      el("span", {}, ""),
      el("span", {}, "交易所"),
      el("span", { class: "c-center" }, "持仓占比 (多 VS 空)"),
      el("span", { class: "c-right" }, "做多金额"),
      el("span", { class: "c-right" }, "做空金额")
    ));

    rows.forEach((r, i) => {
      const initial = r.name.slice(0, 1).toUpperCase();
      table.appendChild(el("div", { class: "ls-row" },
        el("span", { class: "rank" }, String(i + 1)),
        el("span", { class: "ex" },
          el("span", {
            class: "logo",
            style: { background: r.color, color: r.textColor }
          }, initial),
          el("span", {}, r.name)
        ),
        el("div", { class: "lsbar thin" },
          el("div", { class: "seg-l", style: { width: r.longPct + "%" } }, r.longPct.toFixed(2) + "%"),
          el("div", { class: "seg-s", style: { width: r.shortPct + "%" } }, r.shortPct.toFixed(2) + "%")
        ),
        el("div", { class: "amt" },
          el("div", { class: "l" }, "做多"),
          el("div", { class: "v long" }, "US$" + r.longAmt.toFixed(2) + "亿")
        ),
        el("div", { class: "amt" },
          el("div", { class: "l" }, "做空"),
          el("div", { class: "v short" }, "US$" + r.shortAmt.toFixed(2) + "亿")
        )
      ));
    });
    page.appendChild(table);

    return page;
  };

  const lsSelect = ({ value, open, options, onToggle, onPick, width }) => {
    const sel = el("div", { class: "ls-select " + (open ? "is-open" : "") });
    sel.appendChild(el("button", {
      class: "ls-select-trigger " + (open ? "is-open" : ""),
      style: width ? { minWidth: width + "px" } : null,
      onclick: (ev) => { ev.stopPropagation(); onToggle(); }
    },
      el("span", {}, value),
      el("span", { html: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M4 ' + (open ? "10" : "6") + 'l4 ' + (open ? "-4" : "4") + ' 4 ' + (open ? "4" : "-4") + '" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' })
    ));
    const pop = el("div", { class: "ls-select-pop" });
    options.forEach((o) => {
      pop.appendChild(el("button", {
        class: o === value ? "is-on" : "",
        onclick: (ev) => { ev.stopPropagation(); onPick(o); }
      }, o));
    });
    sel.appendChild(pop);
    return sel;
  };

  const darken = (hex) => {
    // simple darken
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    const f = 0.7;
    return "#" + [r, g, b].map((x) => Math.round(x * f).toString(16).padStart(2, "0")).join("");
  };

  // =========================================================
  // DATA pages
  // =========================================================
  const renderDataPage = (sub) => {
    sub = sub || "market";
    const titles = {
      market:    ["行情数据", "分钟级 OHLCV、Ticks、订单流，按需订阅"],
      ls:        ["交易所多空比", "Binance / OKX / Bybit 大户与全网多空比"],
      orderbook: ["聚合挂单", "全市场盘口深度聚合，±1%/±2% 实时观测"],
      predict:   ["预测市场", "Polymarket 等预测市场赔率聚合"],
      equity:    ["币股", "MicroStrategy 等加密相关股票联动监测"],
    };
    const [t, sub2] = titles[sub] || titles.market;

    const page = el("main", { class: "page" });
    page.appendChild(el("div", { class: "page-head" },
      el("div", {},
        el("h1", {}, t),
        el("p", {}, sub2)
      ),
      el("div", { class: "actions" },
        el("button", { class: "btn btn-sm", onclick: () => navigate("#/data/market") }, "行情"),
        el("button", { class: "btn btn-sm", onclick: () => navigate("#/data/ls") }, "多空比"),
        el("button", { class: "btn btn-sm", onclick: () => navigate("#/data/orderbook") }, "挂单"),
        el("button", { class: "btn btn-sm", onclick: () => navigate("#/data/predict") }, "预测"),
        el("button", { class: "btn btn-sm", onclick: () => navigate("#/data/equity") }, "币股"),
      )
    ));

    // KPI row
    const kpis = el("div", { class: "kvs" },
      el("div", { class: "kv" }, el("div", { class: "l" }, "BTC/USDT"), el("div", { class: "v up" }, "68,420.12")),
      el("div", { class: "kv" }, el("div", { class: "l" }, "24H 变化"), el("div", { class: "v up" }, "+2.34%")),
      el("div", { class: "kv" }, el("div", { class: "l" }, "L/S RATIO"), el("div", { class: "v" }, "1.42")),
      el("div", { class: "kv" }, el("div", { class: "l" }, "OI 24H"), el("div", { class: "v" }, "+8.3%")),
      el("div", { class: "kv" }, el("div", { class: "l" }, "FUNDING"), el("div", { class: "v dn" }, "-0.012%")),
      el("div", { class: "kv" }, el("div", { class: "l" }, "DEPTH ±1%"), el("div", { class: "v" }, "$42.8M")),
    );
    page.appendChild(kpis);

    // chart
    const chart = el("div", { class: "simple-card", style: { marginTop: "20px" } },
      el("div", { class: "flex", style: { alignItems: "center", justifyContent: "space-between", marginBottom: "14px" } },
        el("div", { class: "flex-row" },
          el("span", { style: { fontWeight: 600, fontSize: "15px" } }, "BTC/USDT"),
          el("span", { class: "chip chip-ok" }, "+2.34%")
        ),
        el("div", { class: "seg" },
          el("button", {}, "1m"), el("button", {}, "15m"),
          el("button", { class: "is-on" }, "1H"), el("button", {}, "4H"), el("button", {}, "1D")
        )
      ),
      el("div", { html: `
        <svg viewBox="0 0 800 280" preserveAspectRatio="none" style="width:100%;height:280px;">
          <defs>
            <linearGradient id="dch1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#7C5CFF" stop-opacity="0.28"/>
              <stop offset="100%" stop-color="#7C5CFF" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <g stroke="#EFF1F5">
            <line x1="0" y1="70" x2="800" y2="70"/>
            <line x1="0" y1="140" x2="800" y2="140"/>
            <line x1="0" y1="210" x2="800" y2="210"/>
          </g>
          <path d="M0,220 L40,210 L80,214 L120,200 L160,208 L200,180 L240,188 L280,168 L320,176 L360,150 L400,158 L440,128 L480,140 L520,110 L560,118 L600,86 L640,94 L680,70 L720,80 L760,50 L800,58 L800,280 L0,280 Z" fill="url(#dch1)"/>
          <path d="M0,220 L40,210 L80,214 L120,200 L160,208 L200,180 L240,188 L280,168 L320,176 L360,150 L400,158 L440,128 L480,140 L520,110 L560,118 L600,86 L640,94 L680,70 L720,80 L760,50 L800,58" fill="none" stroke="#7C5CFF" stroke-width="2"/>
        </svg>
      ` })
    );
    page.appendChild(chart);

    return page;
  };

  // =========================================================
  // WHALE pages
  // =========================================================
  const WHALES = [
    { name: "Galaxy Digital", addr: "0xa83…b8f2", venue: "BINANCE", side: "buy", amt: "+842 BTC", time: "14:02:10" },
    { name: "新地址 · 30 天", addr: "0x7c1…44a3", venue: "OKX", side: "sell", amt: "-318 BTC", time: "13:58:42" },
    { name: "Cumberland", addr: "0x4f9…0e1c", venue: "HYPERLIQUID", side: "buy", amt: "+1,204 BTC", time: "13:50:11" },
    { name: "早期巨鲸 · 持币 9 年", addr: "0xb2e…91d7", venue: "COLD WALLET", side: "buy", amt: "+512 BTC", time: "13:31:08" },
    { name: "Jump Trading", addr: "0x1aa…ee82", venue: "BINANCE", side: "sell", amt: "-220 BTC", time: "13:12:55" },
    { name: "Wintermute", addr: "0x9e2…cd44", venue: "BYBIT", side: "buy", amt: "+96 BTC", time: "12:48:30" },
    { name: "0x88e… (机构托管)", addr: "0x88e…3a01", venue: "FIRE BLOCKS", side: "buy", amt: "+1,840 BTC", time: "12:30:01" },
    { name: "Alameda 遗留", addr: "0x342…7b1f", venue: "OKX", side: "sell", amt: "-580 BTC", time: "12:15:42" },
  ];

  const renderWhalePage = (sub) => {
    sub = sub || "feed";
    const titles = {
      discover: ["发现", "聪明钱地址排行榜与最近表现"],
      feed:     ["实时巨鲸", "全链实时大额转账，按交易所流入流出过滤"],
      holdings: ["鲸鱼持仓", "Top 100 地址的当前仓位与历史"],
      watch:    ["监控", "自定义地址监控，Telegram 即时推送"],
    };
    const [t, sub2] = titles[sub] || titles.feed;

    const page = el("main", { class: "page" });
    page.appendChild(el("div", { class: "page-head" },
      el("div", {},
        el("h1", {}, t),
        el("p", {}, sub2)
      ),
      el("div", { class: "actions" },
        el("button", { class: "btn btn-sm", onclick: () => navigate("#/whale/discover") }, "发现"),
        el("button", { class: "btn btn-sm", onclick: () => navigate("#/whale/feed") }, "实时"),
        el("button", { class: "btn btn-sm", onclick: () => navigate("#/whale/holdings") }, "持仓"),
        el("button", { class: "btn btn-sm", onclick: () => navigate("#/whale/watch") }, "监控"),
      )
    ));

    if (sub === "feed" || sub === "discover") {
      const feed = el("div", { class: "card whale-feed" });
      feed.appendChild(el("div", {
        class: "flex",
        style: { padding: "16px 22px", borderBottom: "1px solid var(--border-soft)", alignItems: "center", justifyContent: "space-between" }
      },
        el("div", { class: "flex-row" },
          el("span", { style: { fontWeight: 600 } }, "实时巨鲸 · BTC"),
          el("span", { class: "chip chip-ok" }, el("span", { class: "dot" }), "LIVE")
        ),
        el("div", { class: "seg" }, el("button", { class: "is-on" }, "BTC"), el("button", {}, "ETH"), el("button", {}, "SOL"))
      ));
      WHALES.forEach((w) => {
        feed.appendChild(el("div", { class: "whale-row" },
          el("div", { class: "whale-av" }, "0x"),
          el("div", {},
            el("div", { class: "whale-name" }, w.name),
            el("div", { class: "whale-addr" }, `${w.addr} · ${w.venue} · ${w.time}`)
          ),
          el("span", { class: `whale-side ${w.side}` }, w.side === "buy" ? "BUY" : "SELL"),
          el("span", { class: "whale-amt " + (w.side === "buy" ? "up" : "dn") }, w.amt),
        ));
      });
      page.appendChild(feed);
    } else if (sub === "holdings") {
      const wrap = el("div", { class: "table-wrap" });
      const table = el("table", { class: "t" });
      table.appendChild(el("thead", {}, el("tr", {},
        el("th", {}, "#"), el("th", {}, "地址"), el("th", {}, "余额"), el("th", {}, "7D 变化"), el("th", {}, "30D 变化"), el("th", {}, "标签")
      )));
      const tbody = el("tbody", {});
      const rows = [
        ["1", "0xa83…b8f2", "248,041 BTC", "+1.2%", "+4.4%", "机构 · Galaxy"],
        ["2", "0x4f9…0e1c", "182,930 BTC", "+3.4%", "+8.1%", "做市 · Cumberland"],
        ["3", "0x88e…3a01", "164,210 BTC", "+0.8%", "-1.2%", "机构托管"],
        ["4", "0xb2e…91d7", "118,800 BTC", "0.0%", "0.0%", "冷钱包 · 9 年"],
        ["5", "0x7c1…44a3", "84,221 BTC", "-2.1%", "-5.3%", "新地址 · 30D"],
        ["6", "0x9e2…cd44", "61,400 BTC", "+0.6%", "+2.0%", "做市 · Wintermute"],
      ];
      rows.forEach((r) => tbody.appendChild(el("tr", {}, ...r.map((c, i) => el("td", {
        class: i >= 3 && i <= 4 ? (c.startsWith("+") ? "num up" : c.startsWith("-") ? "num dn" : "num") : (i === 2 ? "num" : "")
      }, c)))));
      table.appendChild(tbody);
      wrap.appendChild(table);
      page.appendChild(wrap);
    } else if (sub === "watch") {
      page.appendChild(el("div", { class: "simple-card" },
        el("h3", { style: { margin: "0 0 6px", fontSize: "16px" } }, "添加监控地址"),
        el("p", { class: "muted", style: { margin: "0 0 16px" } }, "支持 EVM / Solana / Bitcoin 主网。地址有大额转账或交易所充提时，会通过 Telegram 推送。"),
        el("div", { style: { display: "flex", gap: "10px" } },
          el("input", { class: "input", placeholder: "0x… / bc1… / ", style: { flex: 1 } }),
          el("button", { class: "btn btn-primary", onclick: () => toast("地址已加入监控", "ok") }, "添加"),
        )
      ));
    }
    return page;
  };

  // =========================================================
  // ROUTER
  // =========================================================
  const root = () => document.getElementById("app");

  const renderRoute = () => {
    const hash = location.hash.replace(/^#/, "") || (session ? "/account" : "/login");

    if (!session && hash !== "/login") {
      navigate("#/login");
      return el("div", {});
    }
    if (session && hash === "/login") {
      navigate("#/account");
      return el("div", {});
    }

    if (hash === "/login") return renderLogin();
    if (hash === "/account") return renderAccountPage();
    if (hash === "/ai") return renderAIPage();
    if (hash === "/market") return renderMarketPage();
    if (hash.startsWith("/data")) {
      const sub = hash.split("/")[2];
      if (!sub || sub === "market") return renderMarketTradingPage();
      if (sub === "ls") return renderLSPage();
      return renderDataPage(sub);
    }
    if (hash.startsWith("/whale")) {
      const sub = hash.split("/")[2];
      return renderWhalePage(sub);
    }
    return el("div", { class: "page" }, el("h1", {}, "页面不存在"));
  };

  const render = () => {
    const r = root();
    r.innerHTML = "";
    if (!session) {
      r.appendChild(renderLogin());
      return;
    }
    if (location.hash === "" || location.hash === "#" || location.hash === "#/login") {
      // already logged-in, navigate to account
      history.replaceState(null, "", "#/account");
    }
    const shell = el("div", { class: "app" });
    shell.appendChild(renderTopbar());
    shell.appendChild(renderRoute());
    r.appendChild(shell);

    // reveal animation
    setTimeout(() => $$("[data-reveal]").forEach((x) => x.classList.add("is-in")), 50);
  };

  window.addEventListener("hashchange", render);
  window.addEventListener("DOMContentLoaded", () => {
    session = loadSession();
    appState = loadState();
    render();
  });

  // Expose for console / debugging
  window.QF = { state: () => ({ session, appState }), logout, loginAs };

})();

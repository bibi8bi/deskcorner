const 本地日 = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TODAY = 本地日(new Date);
const EMBED = new URLSearchParams(location.search).has("embed");
if (EMBED)
  document.documentElement.classList.add("embed");
const TAB视图 = EMBED && new URLSearchParams(location.search).get("view") === "tab";
const SOLO = new URLSearchParams(location.search).get("solo") === "note";
const 主题序 = ["light", "dark", "eye"];
const 主题符 = { light: "☀", dark: "☾", eye: "护" };
const 主题叫 = { light: "亮色", dark: "暗色", eye: "护眼" };
function 现在主题() {
  const 记 = document.documentElement.getAttribute("data-theme");
  if (主题序.includes(记))
    return 记;
  return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
const 下一主题 = () => 主题序[(主题序.indexOf(现在主题()) + 1) % 主题序.length];
function 同步主题钮() {
  const 现 = 现在主题();
  document.querySelectorAll(".主题钮").forEach((b) => {
    b.textContent = 主题符[现];
    b.title = "现在是" + 主题叫[现] + ",点一下换" + 主题叫[下一主题()];
    b.setAttribute("aria-label", b.title);
  });
}
function 切主题() {
  const 到 = 下一主题();
  document.documentElement.setAttribute("data-theme", 到);
  try {
    localStorage.setItem("ui:主题", 到);
  } catch {}
  同步主题钮();
}
if (window.matchMedia)
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", 同步主题钮);
document.addEventListener("DOMContentLoaded", 同步主题钮);
if (document.readyState !== "loading")
  同步主题钮();
const 锁定来源 = EMBED ? new URLSearchParams(location.search).get("src") || "本机" : null;
const LK源 = 锁定来源 || new URLSearchParams(location.search).get("src") || "本机";
const K = (t) => t.src + ":" + t.id;
const 拆K = (k) => {
  const i = String(k).indexOf(":");
  return { 来源: k.slice(0, i), id: +k.slice(i + 1) };
};
let todos = [];
let 来源集 = [{ key: "本机", 名: "独立待办", 类型: [], 量化: false }];
const 默认源 = () => 来源集[0] && 来源集[0].key || "本机";
let 功能 = { 关联数据: false, AI: false };
function 标无关联() {
  const 无 = !功能.关联数据 || 来源集.every((x) => !(x.类型 || []).length);
  document.documentElement.classList.toggle("无关联", 无);
  document.documentElement.classList.toggle("无AI", !功能.AI);
  if (编器)
    标本条关联(编器.根);
  const q = document.getElementById("q");
  if (q)
    q.placeholder = 无 ? "搜索事项" : "搜索事项、关联数据";
}
function 标本条关联(根) {
  if (!根)
    return;
  const 源 = 编器 && 编器.k ? 拆K(编器.k).来源 : 卡草稿 && 卡草稿.来源 || 默认源();
  根.classList.toggle("本条无关联", !Object.keys(源信息(源).关联字段 || {}).length);
}
const 功能广播 = (() => {
  try {
    return new BroadcastChannel("待办功能");
  } catch (e) {
    return null;
  }
})();
if (功能广播)
  功能广播.onmessage = (e) => {
    if (e.data && typeof e.data === "object") {
      功能 = Object.assign({}, 功能, e.data);
      标无关联();
    }
  };
window.待办开设置 = () => 开设置();
function 开设置(钮) {
  document.getElementById("setMask")?.remove();
  const 有可挂 = 来源集.some((x) => (x.类型 || []).length);
  const 关联说 = "待办上挂别的软件里的任务、客户这些数据";
  const mask = document.createElement("div");
  mask.className = "mask";
  mask.id = "setMask";
  mask.innerHTML = `<div class="modal 设置卡" role="dialog" aria-modal="true" aria-labelledby="setH">
    <div class="mh"><span class="grow" id="setH">设置</span>
      <button class="ic" data-close title="关掉;勾了的已经存上了" aria-label="关闭">✗</button></div>
    <div class="mb">
      <label class="设置项" title="关着:待办上的「关联」钮、关联那一列、按关联筛选都不出;以前挂过的关联不删,再打开就回来">
        <input type="checkbox" data-fn="关联数据"${功能.关联数据 ? " checked" : ""}>
        <span><b>关联数据</b><small>${有可挂 ? 关联说 : "ⓘ 现在没接别的软件,开着也没有能挂的数据"}</small></span></label>
      <label class="设置项" title="关着:AI 拟标题、AI 速记、速记前的原文这些钮和提示都不出;要用得先装好 AI 接入底座">
        <input type="checkbox" data-fn="AI"${功能.AI ? " checked" : ""}>
        <span><b>AI 功能</b><small>AI 拟标题、AI 速记(要先装好 AI 接入底座)</small></span></label>
      <div class="设置说" data-msg aria-live="polite">勾一下就存上了</div>
    </div></div>`;
  document.body.appendChild(mask);
  const 关只藏 = () => {
    管焦点(mask, false);
    mask.remove();
  };
  压上层(mask, "设置", 关只藏);
  const 关 = () => mask._退();
  mask.querySelector("[data-close]").addEventListener("click", 关);
  mask.addEventListener("click", (e) => {
    if (e.target === mask)
      关();
  });
  管焦点(mask, true, () => mask.querySelector("input"));
  const 说 = mask.querySelector("[data-msg]");
  mask.querySelectorAll("[data-fn]").forEach((框) => 框.addEventListener("change", async () => {
    const 键 = 框.dataset.fn, 值 = 框.checked;
    const r = await postJSON("/api/todo/features", { op: "存", 值: { [键]: 值 } });
    if (!r || !r.ok) {
      框.checked = !值;
      说.textContent = `「${键 === "AI" ? "AI 功能" : 键}」没存上,还是原来那样`;
      toast("设置没存上,再勾一次试试", true, { 报错: r && r.error || "接口没回话", 位置: "待办 · 设置 · " + 键 });
      return;
    }
    功能 = Object.assign({}, 功能, r.功能);
    标无关联();
    if (功能广播)
      功能广播.postMessage(功能);
    说.textContent = 键 === "关联数据" && 值 && !有可挂 ? "已打开;还没接别的软件,界面不会变" : `已存:${键 === "AI" ? "AI 功能" : 键}${值 ? "打开" : "关掉"}了`;
  }));
}
let 来源状态 = {};
let 页签 = "全部";
let addStar = 1;
let dCur = null;
let 列表请求序 = 0;
let 详情请求序 = 0, 详情请求目标 = "";
let selected = new Set;
let archView = false;
let visibleIds = [];
let advFilters = [];
let 主视图 = EMBED ? "list" : "home";
let 首页展开key = null, 首页请求序 = 0;
const 宽屏查询 = window.matchMedia("(min-width: 900px) and (orientation: landscape)");
function 显示主面板DOM() {
  const home = document.getElementById("homeView"), list = document.getElementById("listView"), detail = document.getElementById("detailView"), page = document.getElementById("cardPage");
  if (home)
    home.classList.add("hidden");
  if (list)
    list.classList.add("hidden");
  if (detail)
    detail.classList.add("hidden");
  if (page)
    page.classList.add("hidden");
  if (dCur != null) {
    if (detail)
      detail.classList.remove("hidden");
    return;
  }
  if (!EMBED && 主视图 === "home" && !宽屏查询.matches) {
    if (home)
      home.classList.remove("hidden");
  } else {
    if (list)
      list.classList.remove("hidden");
  }
}
let 工作视图们 = [], 当前工作视图 = null, 当前视图基线 = null;
let 应用视图中 = false, 工作视图后台就绪 = false, 视图表单模式 = "new", 视图重命名id = null;
const 状态集 = ["未开始", "进行中", "已完成"];
const tagMeta = {};
const 源名 = (k) => (来源集.find((x) => x.key === k) || {}).名 || k;
const 源信息 = (k) => 来源集.find((x) => x.key === k) || { 类型: [], 量化: false };
function 深链URL(src, type, 键) {
  const 信 = 源信息(src), 深 = 信 && 信.深链;
  const 模 = 深 && typeof 深 === "object" ? 深[type] : 深;
  if (!模 || !(信.类型 || []).includes(type))
    return "";
  return 模.replace("{主机}", location.hostname).replace("{类型}", encodeURIComponent(type)).replace("{键}", encodeURIComponent(键));
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
function jsq(s) {
  return esc(String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
}
function starHTML(lv, 可点 = false) {
  let s = "";
  for (let i = 1;i <= 3; i++) {
    const 灭 = i <= lv ? "" : "off";
    s += 可点 ? `<button type="button" class="${灭}" aria-pressed="${i <= lv}" aria-label="设为 ${i} 星">★</button>` : `<i class="${灭}">★</i>`;
  }
  return s;
}
function isOverdue(t) {
  return t.due && t.due < TODAY && t.status !== "已完成";
}
const 抓图上限毫秒 = 30000;
const AI功能名 = { 速记: "待办 · AI速记", 标题: "待办 · 拟标题" };
async function AI请求(路径, 文) {
  const r = await postJSON(路径, { 文本: 文 }, 0);
  if (!r)
    throw new Error(最近错误 && 最近错误.原文 || "没连上后台");
  if (!r.ok)
    throw new Error(r.error || "AI 这次没跑成");
  return r;
}
async function postJSON(path, obj, 超时毫秒 = 15000) {
  const 控 = 超时毫秒 > 0 ? new AbortController : null;
  let 超时了 = false, 表 = null;
  if (控)
    表 = setTimeout(() => {
      超时了 = true;
      控.abort();
    }, 超时毫秒);
  try {
    const 选项 = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
    if (控)
      选项.signal = 控.signal;
    const r = await fetch(path, 选项);
    const j = await r.json();
    if (j && j.ok === false)
      最近错误 = { 时: Date.now(), 位置: path, 号: j.错误号 || "", 原文: j.原文 || `(后台没回原文;HTTP ${r.status},回的话:${j.error || "空"})` };
    return j;
  } catch (e) {
    console.error("postJSON 失败", path, e);
    最近错误 = { 时: Date.now(), 位置: path, 号: "", 原文: 超时了 ? `超过 ${超时毫秒} 毫秒没回` : String(e && (e.stack || e.message) || e) };
    toast(超时了 ? "等太久了,先停下 —— 网或后台没反应,刚才那一下没做成" : "没发出去 —— 后台服务可能没起,过一下再试", true);
    return null;
  } finally {
    clearTimeout(表);
  }
}
function 数据ID(id) {
  return "DB" + String(id).padStart(4, "0");
}
function ID搜词(q) {
  const m = String(q || "").trim().toLowerCase().match(/^(?:db|#)0*(\d+)$/);
  return m ? "db" + m[1] + " " : "";
}
function ID搜料(id) {
  return " db" + id + " #" + id + " " + 数据ID(id).toLowerCase() + " ";
}
async function 复制ID(id, 钮) {
  const ok = await 复制文本(数据ID(id));
  if (钮) {
    const 原 = 钮.textContent;
    钮.textContent = ok ? "✓ 已复制" : "✗ 复制不了";
    setTimeout(() => {
      钮.textContent = 原;
    }, 1400);
  } else
    toast(ok ? "已复制 " + 数据ID(id) : "复制不了,手动记一下:" + 数据ID(id), !ok);
}
async function 复制文本(txt) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(txt);
      return true;
    }
  } catch (e) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.cssText = "position:fixed;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  }
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ")
    return;
  const el = e.target.closest && e.target.closest('[role="button"][tabindex]');
  if (!el || el.matches("button,a,input,textarea,select"))
    return;
  e.preventDefault();
  el.click();
});
function 目标数没填对(v) {
  return String(v).trim() !== "" && !(Number.isInteger(+v) && +v >= 1);
}
const 焦点来路 = new Map;
const 能停选择器 = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])," + 'textarea:not([disabled]),[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"])';
function 管焦点(罩, 开着, 落点) {
  if (!罩)
    return;
  if (开着) {
    焦点来路.set(罩.id, document.activeElement);
    if (!罩._圈) {
      罩._圈 = (e) => {
        if (e.key !== "Tab")
          return;
        const 能停 = [...罩.querySelectorAll(能停选择器)].filter((el) => el.offsetWidth || el.offsetHeight || el === document.activeElement);
        if (!能停.length)
          return;
        const 头 = 能停[0], 尾 = 能停[能停.length - 1];
        if (e.shiftKey && document.activeElement === 头) {
          e.preventDefault();
          尾.focus();
        } else if (!e.shiftKey && document.activeElement === 尾) {
          e.preventDefault();
          头.focus();
        }
      };
      罩.addEventListener("keydown", 罩._圈);
    }
    if (落点)
      setTimeout(() => {
        const el = typeof 落点 === "function" ? 落点() : 落点;
        if (el && el.focus)
          el.focus();
      }, 40);
  } else {
    const 回 = 焦点来路.get(罩.id);
    焦点来路.delete(罩.id);
    if (回 && 回.focus && document.contains(回))
      回.focus();
  }
}
function 问删({ 屏上, 细说, 钮字 }) {
  return UI确认({ 题: 屏上, 说: 细说, 钮字 });
}
let 最近错误 = null;
function toast(msg, 坏 = false, 配 = {}) {
  if (!坏)
    return UI提示(msg, 配);
  const 近 = 最近错误 && Date.now() - 最近错误.时 < 1e4 ? 最近错误 : null;
  return UI提示(msg, Object.assign({
    错: true,
    报错: 近 ? 近.原文 : "(这一处没有后台原文,屏上那句就是全部线索)",
    位置: (近 ? 近.位置 + " · " : "") + location.pathname + location.search,
    错误号: 近 ? 近.号 : ""
  }, 配));
}
function 节点转扁平(n, pk) {
  const src = n.来源 || 默认源();
  return {
    id: n.id,
    src,
    k: src + ":" + n.id,
    pk,
    matter: n.事项 || "",
    star: n.重要程度 || 1,
    status: n.状态 || "未开始",
    due: n.计划完成时间 || "",
    detail: n.详情 || "",
    imgs: n.图数 || 0,
    files: n.文件数 || 0,
    cmts: n.评论数 || 0,
    ctime: n.创建时间 || "",
    mtime: n.最后修改时间 || n.创建时间 || "",
    mtimeRaw: n.最后修改时间 || "",
    archived: +(n.归档 || 0),
    form: n.形态 || "待办",
    pin: +(n.钉住 || 0),
    target: n.目标数 || 0,
    prog: n.进度 || 0,
    links: (n.关联 || []).map((l) => ({ 关联id: l.关联id, type: l.关联类型, 键: l.关联键, 号: l.号 || "", 格: l.格 || null, text: l.显示文本 || l.关联键, dangling: !!l.悬空 }))
  };
}
function 扁平化(tree) {
  const out = [];
  (tree || []).forEach((t) => {
    out.push(节点转扁平(t, null));
    (t.子 || []).forEach((c) => out.push(节点转扁平(c, (t.来源 || 默认源()) + ":" + t.id)));
  });
  return out;
}
async function loadList() {
  const 本次请求 = ++列表请求序;
  const body = archView ? { 归档: 1 } : {};
  const 软件 = 锁定来源 || (document.getElementById("fSrc") ? document.getElementById("fSrc").value : "");
  body.来源 = 软件 || "*";
  const r = await postJSON("/api/todo/list", body);
  if (本次请求 !== 列表请求序)
    return false;
  if (!r || !r.ok) {
    toast(r && r.error || "加载失败", true);
    return false;
  }
  if (r.功能)
    功能 = Object.assign({}, 功能, r.功能);
  if (r.来源集)
    来源集 = r.来源集;
  if (r.来源集 || r.功能)
    标无关联();
  来源状态 = r.来源状态 || {};
  建软件下拉();
  建关联下拉();
  todos = 扁平化(r.待办);
  render();
  return true;
}
function 建软件下拉() {
  const wrap = document.getElementById("fldSrc"), sel = document.getElementById("fSrc");
  if (!wrap || !sel)
    return;
  if (锁定来源 || 来源集.length < 2) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "";
  const 旧 = sel.value;
  sel.innerHTML = '<option value="">全部</option>' + 来源集.map((x) => `<option value="${esc(x.key)}"${来源状态[x.key] ? " disabled" : ""}>${esc(x.名)}${来源状态[x.key] ? "(这次没读到)" : ""}</option>`).join("");
  sel.value = 旧;
}
function 可选关联类型() {
  const 软件 = 锁定来源 || (document.getElementById("fSrc") ? document.getElementById("fSrc").value : "");
  const 用 = 软件 ? 来源集.filter((x) => x.key === 软件) : 来源集;
  const 归属 = {};
  用.forEach((x) => (x.类型 || []).forEach((t) => {
    (归属[t] = 归属[t] || []).push(x.名);
  }));
  return 归属;
}
function 建关联下拉() {
  const sel = document.getElementById("fLink");
  if (!sel)
    return;
  const 软件 = 锁定来源 || (document.getElementById("fSrc") ? document.getElementById("fSrc").value : "");
  const 归属 = 可选关联类型();
  const 旧 = sel.value;
  sel.innerHTML = '<option value="">全部</option>' + Object.keys(归属).map((t) => {
    const m = tagMeta[t] || { emo: "" };
    const 尾 = 来源集.length > 1 && !软件 ? `(${归属[t].join(" / ")})` : "";
    return `<option value="${esc(t)}">${m.emo} ${esc(t)}${esc(尾)}</option>`;
  }).join("");
  sel.value = [...sel.options].some((o) => o.value === 旧) ? 旧 : "";
}
function render来源状态() {
  let el = document.getElementById("srcNotice");
  const 坏 = Object.keys(来源状态 || {});
  if (!坏.length) {
    if (el)
      el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = "srcNotice";
    el.className = "advchips";
    document.getElementById("advChips").before(el);
  }
  const 好 = 来源集.filter((x) => !来源状态[x.key]).map((x) => x.名).join("和");
  el.innerHTML = 坏.map((k) => `<span class="fchip warn" title="原始报错:${esc(来源状态[k])}">⚠︎ ${esc(源名(k))}的待办这次没读到(库文件位置不对或被移走了)${好 ? " —— 只显示了" + esc(好) + "的" : ""}</span>`).join("");
}
function onArchChange() {
  const want = document.getElementById("fArch").checked;
  if (want !== archView) {
    archView = want;
    selected.clear();
    loadList();
  } else
    render();
}
const 页签集 = ["全部", "今日", "未开始", "进行中", "已完成"];
const 加天 = (ymd, n) => {
  const d = new Date(ymd + "T00:00:00");
  d.setDate(d.getDate() + n);
  return 本地日(d);
};
function 范围截止() {
  const el = document.getElementById("fScope");
  return 加天(TODAY, el ? +el.value || 0 : 0);
}
function 属本页签(t) {
  if (archView)
    return true;
  if (页签 === "全部")
    return true;
  if (页签 === "今日")
    return !!t.due && t.due <= 范围截止() && t.status !== "已完成";
  return t.status === 页签;
}
function 切页签(名) {
  页签 = 名;
  selected.clear();
  render();
}
const 范围名 = { 0: "今日", 2: "近 3 天", 4: "近 5 天", 6: "近 7 天" };
function 点今日(ev, btn) {
  const 点箭头 = ev && ev.target && ev.target.closest && ev.target.closest(".caret");
  if (点箭头 || 页签 === "今日") {
    开范围菜单(btn);
    return;
  }
  切页签("今日");
}
function 开范围菜单(btn) {
  let m = document.getElementById("scopeMenu");
  if (m && !m.hidden && m._btn === btn) {
    m.hidden = true;
    return;
  }
  if (!m) {
    m = document.createElement("div");
    m.id = "scopeMenu";
    m.className = "scope-menu";
    m.setAttribute("role", "menu");
    document.body.appendChild(m);
    document.addEventListener("click", (e) => {
      if (!m.hidden && !m.contains(e.target) && !(m._btn && m._btn.contains(e.target)))
        m.hidden = true;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !m.hidden) {
        m.hidden = true;
        m._btn && m._btn.focus();
      }
    });
  }
  const 现 = +(document.getElementById("fScope")?.value || 0);
  m.innerHTML = Object.entries(范围名).map(([v, 名]) => `<button type="button" role="menuitemradio" aria-checked="${+v === 现}" onclick="选范围(${v})">${+v === 现 ? "● " : "○ "}${名}</button>`).join("");
  m._btn = btn;
  m.hidden = false;
  const r = btn.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - 150)) + scrollX + "px";
  m.style.top = r.bottom + 4 + scrollY + "px";
  m.querySelector('[aria-checked="true"]')?.focus();
}
function 选范围(v) {
  const sc = document.getElementById("fScope");
  if (sc)
    sc.value = String(v);
  const m = document.getElementById("scopeMenu");
  if (m)
    m.hidden = true;
  if (页签 !== "今日")
    切页签("今日");
  else
    render();
}
function 画页签() {
  const 今名 = 范围名[+(document.getElementById("fScope")?.value || 0)] || "今日";
  document.querySelectorAll("[data-tab]").forEach((b) => {
    const 首页 = !!b.closest("#homeTabs");
    b.classList.toggle("active", (首页 || !archView) && b.dataset.tab === 页签);
    if (!首页) {
      b.disabled = archView;
      b.title = archView ? "归档箱里这四个页签不起筛选作用,后面的数字是归档箱里各有几条" : "";
    }
    if (b.dataset.tab === "今日") {
      const n = b.querySelector(".tname");
      if (n)
        n.textContent = 今名;
      if (!(archView && !首页))
        b.title = "点 ▾ 选看几天:今日 / 近 3 天 / 近 5 天 / 近 7 天。逾期没做完的一直都在";
    }
  });
}
function 页签计数() {
  const 截 = 范围截止(), T = tops().filter((t) => 是正式待办(t) && (!lkFilter || lkFilter.ids.has(t.k) || children(t.k).some((c) => lkFilter.ids.has(c.k))));
  const n = {
    "全部": T.length,
    "今日": T.filter((t) => t.due && t.due <= 截 && t.status !== "已完成").length,
    "未开始": T.filter((t) => t.status === "未开始").length,
    "进行中": T.filter((t) => t.status === "进行中").length,
    "已完成": T.filter((t) => t.status === "已完成").length
  };
  页签集.forEach((k) => document.querySelectorAll(`[data-cnt="${k}"]`).forEach((e) => {
    e.textContent = n[k];
  }));
}
function 画本栏说明() {
  const el = document.getElementById("listNote");
  if (!el)
    return;
  el.textContent = archView ? "归档箱:归档过的都在这里,记录不删。上面页签在这儿不筛,只报归档箱里各有几条" : 页签 === "今日" ? "逾期还没做完的一直留在这一栏,不会掉出去" : 页签 === "未开始" ? "没填计划完成时间的正式待办都在这里" : 页签 === "已完成" ? "完成的不会自己消失,归档之后才收起来" : "";
  const ord = document.getElementById("ordNote");
  if (ord)
    ord.textContent = archView ? "" : "逾期 → 今日 → 未排期";
}
function 组序(t) {
  return isOverdue(t) ? 0 : t.due === TODAY ? 1 : !t.due ? 2 : 3;
}
let 表头排序 = null;
const 表头排序取值 = { "创建": (t) => t.ctime || "", "最后修改": (t) => t.mtimeRaw || "" };
function 点表头排序(键) {
  表头排序 = !表头排序 || 表头排序.键 !== 键 ? { 键, 向: -1 } : 表头排序.向 === -1 ? { 键, 向: 1 } : null;
  render();
}
function 画排序标() {
  document.querySelectorAll("table.task-table th[data-sort]").forEach((th) => {
    let s = th.querySelector(".排向");
    if (!s) {
      s = document.createElement("span");
      s.className = "排向";
      th.appendChild(s);
    }
    const 中 = 表头排序 && 表头排序.键 === th.dataset.sort;
    s.textContent = 中 ? 表头排序.向 === -1 ? "↓" : "↑" : "";
    th.setAttribute("aria-sort", 中 ? 表头排序.向 === -1 ? "descending" : "ascending" : "none");
  });
  const ord = document.getElementById("ordNote");
  if (ord && 表头排序)
    ord.textContent = "按" + (表头排序.键 === "创建" ? "创建日期" : "最后修改日期") + (表头排序.向 === -1 ? ",新的在前" : ",旧的在前");
}
function 排序(list) {
  const d = (t) => t.due || "9999-99-99";
  if (表头排序) {
    const 取 = 表头排序取值[表头排序.键], 向 = 表头排序.向;
    return list.slice().sort((a, b) => {
      const x = 取(a), y = 取(b);
      if (!x !== !y)
        return !x ? 1 : -1;
      return (x < y ? -1 : x > y ? 1 : 0) * 向 || a.id - b.id;
    });
  }
  return list.slice().sort((a, b) => 组序(a) - 组序(b) || b.star - a.star || (d(a) < d(b) ? -1 : d(a) > d(b) ? 1 : 0) || a.id - b.id);
}
function passFilter(t) {
  const lk = document.getElementById("fLink").value;
  const q = document.getElementById("q").value.trim().toLowerCase();
  if (!属本页签(t))
    return false;
  if (lk && !(t.links || []).some((l) => l.type === lk))
    return false;
  if (q) {
    const idq = ID搜词(q);
    const 自 = ID搜料(t.id) + t.matter + " " + (t.detail || "") + " " + (t.links || []).map((l) => (l.号 ? l.号 + " " : "") + l.text).join(" ");
    const 子 = children(t.k).map((c) => ID搜料(c.id) + c.matter + " " + (c.detail || "")).join(" ");
    const 料 = (自 + " " + 子).toLowerCase();
    if (!料.includes(q) && !(idq && 料.includes(" " + idq)))
      return false;
  }
  if (!passAdv(t))
    return false;
  return true;
}
const tops = () => todos.filter((t) => !t.pk);
const 是正式待办 = (t) => !!t && t.form !== "便笺";
const children = (k) => todos.filter((t) => t.pk === k);
let 子开合 = {};
function 子展开(k) {
  if (k in 子开合)
    return 子开合[k];
  const q = document.getElementById("q").value.trim().toLowerCase();
  return !!q && children(k).some((c) => {
    const 料 = (ID搜料(c.id) + c.matter + " " + (c.detail || "")).toLowerCase(), idq = ID搜词(q);
    return 料.includes(q) || !!idq && 料.includes(" " + idq);
  });
}
let lkFilter = null;
const LK锁 = () => EMBED && !!lkFilter;
function lk短标(f) {
  if (!f)
    return "";
  const s = String(f.label || f.key || "");
  return s.length > 20 ? s.slice(0, 20) + "…" : s;
}
async function initLkFilter() {
  const p = new URLSearchParams(location.search), raw = p.get("lk");
  if (!raw || !raw.includes("|"))
    return;
  const i = raw.indexOf("|"), type = raw.slice(0, i), key = raw.slice(i + 1);
  const r = await postJSON("/api/todo/by-link", { 来源: LK源, 关联类型: type, 关联键: key });
  if (!r || !r.ok) {
    toast(r && r.error || "lk 参数无效,显示全部", true);
    return;
  }
  lkFilter = {
    type,
    key,
    ids: new Set((r.待办 || []).map((t) => LK源 + ":" + t.id)),
    label: p.get("lkt") || r.待办 && r.待办[0] && r.待办[0].显示文本 || key
  };
  if (LK锁()) {
    const m = tagMeta[type] || { emo: "" };
    const ln = document.getElementById("listNote");
    if (ln) {
      ln.textContent = `${m.emo} 这一行的待办 —— 只显/只动挂在「${lk短标(lkFilter)}」上的,别的待办进不来`;
      ln.title = lkFilter.label;
    }
    const btn = document.getElementById("btnAdd");
    btn.textContent = "＋ 创建待办";
    btn.title = "新建一条并自动挂到本行(不是建全局散待办)";
    const lp = document.createElement("button");
    lp.className = "mini";
    lp.id = "btnLkPick";
    lp.textContent = "\uD83D\uDD17 关联已有待办";
    lp.title = "从全部待办里挑一条挂到本行(可连点多条)";
    lp.addEventListener("click", openLkPick);
    btn.after(lp);
  }
}
function renderLkNotice() {
  let el = document.getElementById("lkNotice");
  if (!lkFilter) {
    if (el)
      el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = "lkNotice";
    el.className = "advchips";
    document.getElementById("advChips").before(el);
  }
  const m = tagMeta[lkFilter.type] || { emo: "" };
  el.innerHTML = `<span class="fchip" title="${esc(lkFilter.label)}">${m.emo} 只看挂在「${esc(lk短标(lkFilter))}」上的待办 · ${lkFilter.ids.size} 条${LK锁() ? " \uD83D\uDD12" : ' <b onclick="clearLk()" tabindex="0" role="button" aria-label="清掉这个筛选,回全部待办" title="清掉,回全部待办">✗</b>'}</span>`;
}
function clearLk() {
  if (LK锁())
    return;
  lkFilter = null;
  const u = new URL(location);
  u.searchParams.delete("lk");
  history.replaceState(null, "", u);
  render();
}
function openLkPick(e) {
  e.stopPropagation();
  const old = document.getElementById("lkPick");
  if (old) {
    old.remove();
    return;
  }
  const pop = document.createElement("div");
  pop.id = "lkPick";
  pop.innerHTML = `<input class="lp-q" placeholder="搜事项 / #ID…(点一条=挂到本行,可连点)">
    <div class="lp-list"></div>
    <div class="lp-foot">挑的是整个待办中心里的待办 · 挂上后它就出现在这张表里</div>`;
  document.body.appendChild(pop);
  const r = e.currentTarget.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - pop.offsetWidth - 8)) + "px";
  pop.style.top = Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 8) + "px";
  const inp = pop.querySelector(".lp-q"), list = pop.querySelector(".lp-list");
  const 画 = () => {
    const q = inp.value.trim().toLowerCase();
    const 平 = [];
    tops().forEach((t) => {
      平.push({ t, sub: false });
      children(t.k).forEach((s) => 平.push({ t: s, sub: true }));
    });
    const hit = 平.filter((x) => !q || (x.t.matter || "").toLowerCase().includes(q) || ID搜料(x.t.id).includes(q) || ID搜词(q) && ID搜料(x.t.id).includes(" " + ID搜词(q)));
    if (!hit.length) {
      list.innerHTML = '<div class="lp-empty">没有匹配的待办(试试清空搜索,或直接「＋ 创建待办」)</div>';
      return;
    }
    list.innerHTML = hit.map((x) => {
      const on = lkFilter.ids.has(x.t.k);
      return `<div class="lp-td ${x.sub ? "sub" : ""} ${on ? "linked" : ""}" data-tid="${esc(x.t.k)}">
        <span class="id">${来源集.length > 1 ? esc(源名(x.t.src)) + " " : ""}${数据ID(x.t.id)}</span><span class="m" title="${esc(x.t.matter || "")}">${esc(x.t.matter || "")}</span>
        <span class="st">${on ? "✓已关联" : esc(x.t.status || "")}</span></div>`;
    }).join("");
    list.querySelectorAll(".lp-td:not(.linked)").forEach((row) => row.addEventListener("click", async () => {
      const tk = row.dataset.tid, one = 拆K(tk);
      const r2 = await postJSON("/api/todo/link/add", { 来源: one.来源, 待办id: one.id, 关联类型: lkFilter.type, 关联键: lkFilter.key, 显示文本: lkFilter.label });
      if (!r2 || !r2.ok) {
        toast(r2 && r2.error || "挂关联失败", true);
        return;
      }
      lkFilter.ids.add(tk);
      toast(r2.已存在 ? `#${one.id} 早就挂着本行了` : `已把 #${one.id} 挂到本行`);
      await loadList();
      画();
    }));
  };
  let 防抖 = null;
  inp.addEventListener("input", () => {
    clearTimeout(防抖);
    防抖 = setTimeout(画, 200);
  });
  pop.addEventListener("click", (ev) => ev.stopPropagation());
  const 关 = () => {
    pop.remove();
    document.removeEventListener("click", 关);
    document.removeEventListener("keydown", 键);
  };
  const 键 = (ev) => {
    if (ev.key === "Escape")
      关();
  };
  setTimeout(() => {
    document.addEventListener("click", 关);
    document.addEventListener("keydown", 键);
  }, 0);
  画();
  inp.focus();
}
const 状态符 = { "未开始": "○", "进行中": "◔", "已完成": "✓" };
function 状态标HTML(st) {
  const cls = st === "进行中" ? "doing" : st === "已完成" ? "done" : "";
  return `<span class="sttag ${cls}">${状态符[st] || ""} ${esc(st)}</span>`;
}
function 状态格HTML(st) {
  return `<td data-col="状态" class="改" data-选项="${状态集.join("|")}" data-值="${esc(st)}">${状态标HTML(st)}</td>`;
}
async function 存状态格(格, 新) {
  const k = 格.closest("tr") && 格.closest("tr").dataset.k;
  if (!k || !状态集.includes(新))
    throw new Error("这一格认不出是哪条待办");
  const t = todos.find((x) => x.k === k);
  if (t)
    t.status = 新;
  const { r, 最新 } = await 排同字段写(k, "状态", 新);
  if (最新 && !(r && r.ok))
    throw new Error(r && r.error || "改状态没成");
  if (最新)
    setTimeout(loadList, 0);
  const 壳 = document.createElement("template");
  壳.innerHTML = 状态标HTML(新);
  return 壳.content.firstElementChild;
}
function 标签态(l, 本源) {
  const m = tagMeta[l.type] || { cls: "", emo: "" };
  const 外链 = 深链URL(本源, l.type, l.键);
  const 可跳 = !l.dangling && !!外链;
  const 截 = (v) => {
    const a = [...String(v)];
    return a.length > 14 ? a.slice(0, 14).join("") + "…" : a.join("");
  };
  const 段 = l.格 ? l.格.filter((g) => g.值 != null && g.值 !== "") : null;
  const 短名 = 段 ? 段.map((g) => 截(g.值)).join(" · ") : 截(l.text || "");
  const 全文 = 段 ? 段.map((g) => String(g.值)).join(" · ") : l.text || "";
  const t = (l.号 ? l.号 + " " : "") + (l.dangling ? `${全文}
关联已悬空(${l.type}被删/改名),不可跳` : 可跳 ? `${全文}
点击开 ${源名(本源)} 里的这一行(新窗口)` : `${l.type}:${全文}
${源名(本源)}没有这一类的单条页面,点了不跳`);
  return {
    m,
    可跳,
    短名,
    全文,
    态类: l.dangling ? "dangling" : 可跳 ? "可跳" : "nolink 不可跳",
    悬浮: 源名(本源) + " · " + t
  };
}
function tagsHTML(links, src) {
  if (!links || !links.length)
    return '<span class="none">—</span>';
  const 本源 = src || 默认源();
  return '<div class="tags">' + links.map((l) => {
    const s = 标签态(l, 本源);
    return `<span class="tag ${s.m.cls} ${s.态类}"${s.可跳 ? ' tabindex="0" role="button"' : ""} title="${esc(s.悬浮)}" onclick="jumpTag(event,'${jsq(l.type)}','${jsq(l.键)}',${!!l.dangling},'${jsq(本源)}')"><span class="tag-src">${esc(源名(本源))}</span>${关联号HTML(l)}${s.m.emo} ${esc(s.短名)}${s.可跳 ? '<span class="跳记">↗</span>' : ""}</span>`;
  }).join("") + "</div>";
}
function 关联号HTML(l) {
  return l.号 ? `<span class="tag-id" title="数据 ID(${esc(l.type)})">${esc(l.号)}</span>` : `<span class="tag-id none-id" title="这一类数据还没有数据 ID,先写类型名">${esc(l.type)}</span>`;
}
async function jumpTag(e, type, 键, dangling, src) {
  e.stopPropagation();
  if (dangling) {
    toast("该关联已悬空,不能跳", true);
    return;
  }
  {
    const u = 深链URL(src, type, 键);
    if (u) {
      window.open(u, "_blank", "noopener");
      return;
    }
    toast(`这是${源名(src)}里的「${type}」,${源名(src)}还没给过能从外面打开的地址`, true);
    return;
  }
}
function progHTML(t) {
  const 信 = 源信息(t.src);
  if (!t.target || !信.量化)
    return "";
  const pct = Math.min(100, Math.round((t.prog || 0) / t.target * 100));
  return `<div class="tprog" title="进度 = 这条待办已挂的「${esc(信.计数类型 || "")}」关联数 ÷ 目标数"><div class="tprog-fill" style="width:${pct}%"></div><span class="tprog-txt">${t.prog || 0}/${t.target}(${pct}%)</span></div>`;
}
function 首页正文首行(t) {
  return String(t && t.detail || "").split(/\r?\n/).map((x) => x.trim()).find(Boolean) || "没有正文";
}
function 首页日期文(t) {
  if (!t || !t.due)
    return "未排期";
  if (t.due < TODAY && t.status !== "已完成")
    return "逾期 · " + t.due.slice(5);
  if (t.due === TODAY)
    return "今天";
  return t.due.slice(5);
}
function 首页待办们() {
  const 全 = 排序(tops().filter((t) => 是正式待办(t) && !t.archived));
  return 页签 === "已完成" ? 全 : 全.filter((t) => 属本页签(t));
}
function renderHome() {
  const box = document.getElementById("homeRows");
  if (!box || EMBED)
    return;
  const list = 首页待办们();
  const date = document.getElementById("homeDate"), count = document.getElementById("homeCount");
  if (date)
    date.textContent = `${TODAY} · 周${"日一二三四五六"[new Date(TODAY + "T00:00:00").getDay()]}`;
  if (count)
    count.textContent = `${list.length} 条`;
  const 活根 = 编器 && 编器.根 && 编器.根.closest && 编器.根.closest("#homeRows");
  if (首页展开key && 活根)
    return;
  if (!list.length) {
    box.innerHTML = `<div class="astra-home-empty"><span>现在没有待办。</span><button class="主钮" onclick="openCard()">＋ 新建一条</button></div>`;
    return;
  }
  box.innerHTML = list.map((t) => {
    const 开 = 首页展开key === t.k;
    return `<article class="astra-home-row${t.status === "已完成" ? " done" : ""}" data-home-k="${esc(t.k)}">
      <button class="astra-home-open" type="button" onclick="展开首页('${esc(t.k)}')" aria-expanded="${开 ? "true" : "false"}">
        <span class="astra-home-copy"><span class="astra-home-title">${esc(t.matter)}</span><span class="astra-home-excerpt">${esc(首页正文首行(t))}</span></span>
        <span class="astra-home-meta"><span class="stars" aria-label="重要程度 ${t.star} 星">${starHTML(t.star)}</span><span>${esc(首页日期文(t))}</span></span>
      </button>
      ${开 ? '<div class="astra-home-loading" data-home-editor>正在打开正文…</div>' : ""}
    </article>`;
  }).join("");
}
function 首页编辑状态(文, 坏) {
  const el = document.getElementById("homeSaveState");
  if (!el)
    return;
  el.textContent = 文 || "";
  el.classList.toggle("坏", !!坏);
}
async function 保存首页正文() {
  if (!首页展开key || !编器 || String(正文落点() || "") !== String(首页展开key))
    return true;
  首页编辑状态(块脏 ? "保存中…" : "已保存");
  if (块脏) {
    const ok = await 存块();
    if (!ok) {
      首页编辑状态("正文没存上，仍留在这里", true);
      return false;
    }
  }
  await 强存历史();
  首页编辑状态("已保存");
  return true;
}
async function 结束首页编辑(刷新 = true) {
  if (!首页展开key)
    return true;
  if (!await 保存首页正文())
    return false;
  首页请求序++;
  关编器();
  清撤销队列();
  首页展开key = null;
  当前详情数据 = null;
  if (刷新)
    await loadList();
  else
    renderHome();
  return true;
}
async function 保存并收起首页() {
  return await 结束首页编辑(true);
}
async function 展开首页(k) {
  const key = String(k || "");
  if (!key || key === 首页展开key)
    return;
  if (首页展开key && !await 结束首页编辑(true))
    return;
  首页展开key = key;
  const 序 = ++首页请求序;
  renderHome();
  const det = await postJSON("/api/prod/todo/detail", 拆K(key));
  if (序 !== 首页请求序 || 首页展开key !== key)
    return;
  if (!det || !det.ok) {
    首页展开key = null;
    renderHome();
    toast(det && det.error || "正文打不开", true);
    return;
  }
  const root = document.querySelector("[data-home-editor]");
  if (!root || 首页展开key !== key)
    return;
  当前详情数据 = det;
  卡宿 = "home";
  卡草稿 = null;
  root.className = "astra-home-editor";
  root.innerHTML = `<div class="home-editor-top">
      <button class="addbtn" data-add="text" title="接一段文字">＋ 文字</button>
      <button class="addbtn" data-add="img" title="从电脑里选一张图插进正文">\uD83D\uDDBC 图片</button>
      <button class="addbtn" data-undo disabled>↶ 撤销</button>
      <button class="addbtn" data-redo disabled>↷ 还原</button>
      <button class="addbtn" data-history>\uD83D\uDD50 历史</button>
      <button class="addbtn" data-ai速记 title="整理当前正文">✨ AI 速记</button>
    </div>
    <div class="dsec"><div class="doc" data-doc></div></div>
    <div class="home-editor-foot"><span class="home-editor-state" id="homeSaveState">已保存</span>
      <button class="次钮" type="button" onclick="打开首页详情()">完整详情</button>
      <button class="主钮" type="button" onclick="保存并收起首页()">保存并收起</button></div>`;
  开编器(root, 卡详情初块(det), key, det.文件 || []);
  重置撤销队列();
}
async function 打开首页详情() {
  const key = 首页展开key;
  if (!key)
    return;
  if (!await 保存首页正文())
    return;
  首页请求序++;
  关编器();
  清撤销队列();
  首页展开key = null;
  当前详情数据 = null;
  await loadList();
  主视图 = "home";
  await openDetail(key, true);
}
async function 显示首页() {
  if (EMBED)
    return await 显示完整列表();
  if (卡宿 === "note" && 编器 && 卡形态 === "page") {
    if (!await closeNote())
      return false;
  }
  if (首页展开key && !await 结束首页编辑(true))
    return false;
  if (archView) {
    archView = false;
    const a = document.getElementById("fArch");
    if (a)
      a.checked = false;
    await loadList();
  }
  const 旧 = 主视图;
  主视图 = "home";
  if (dCur != null) {
    const ok = await 显列表(false);
    if (ok !== true) {
      主视图 = 旧;
      return false;
    }
  } else
    显示主面板DOM();
  renderHome();
  return true;
}
async function 显示完整列表() {
  if (卡宿 === "note" && 编器 && 卡形态 === "page") {
    if (!await closeNote())
      return false;
  }
  if (首页展开key && !await 结束首页编辑(true))
    return false;
  const 旧 = 主视图;
  主视图 = "list";
  if (dCur != null) {
    const ok = await 显列表(false);
    if (ok !== true) {
      主视图 = 旧;
      return false;
    }
  } else
    显示主面板DOM();
  return true;
}
async function 打开便笺页(k) {
  if (EMBED)
    return await openNote(k);
  if (卡宿 === "note" && 编器 && 卡形态 === "page" && !k) {
    return true;
  }
  if (卡宿 === "note" && 编器 && 卡形态 === "page" && k && String(正文落点() || "") !== String(k)) {
    if (await 便笺立刻存() === false)
      return false;
    await 强存历史();
  }
  if (首页展开key && !await 结束首页编辑(true))
    return false;
  if (dCur != null) {
    const ok = await 显列表(false);
    if (ok !== true)
      return false;
  }
  if (archView) {
    archView = false;
    const a = document.getElementById("fArch");
    if (a)
      a.checked = false;
    await loadList();
  }
  const key = k || ((便笺们()[0] || {}).k || "");
  await openNote(key || undefined);
  if (!编器 || 卡宿 !== "note")
    return false;
  切卡形态("page");
  return true;
}
async function 新建便笺页() {
  if (卡宿 === "note" && 编器 && 卡形态 === "page") {
    if (await 便笺立刻存() === false)
      return false;
    await 强存历史();
  }
  if (首页展开key && !await 结束首页编辑(true))
    return false;
  if (dCur != null) {
    const ok = await 显列表(false);
    if (ok !== true)
      return false;
  }
  await openNote();
  if (!编器 || 卡宿 !== "note")
    return false;
  切卡形态("page");
  return true;
}
async function 新建当前() {
  if (卡宿 === "note" && 编器 && 卡形态 === "page")
    return await 新建便笺页();
  if (首页展开key && !await 结束首页编辑(true))
    return false;
  await openCard();
  return true;
}
function rowHTML(t, 是子, lk上下文) {
  const k = t.k;
  const od = isOverdue(t);
  const 子们 = 是子 ? [] : children(k);
  const ctx = archView && !t.archived || !!lk上下文;
  const chk = ctx ? `<td class="cchk"><span class="chk-na ctx-mark" title="${lk上下文 ? "上下文:这一行本身没挂在这条数据上,勾不上 —— 列出来只是让底下那条挂着的子待办看得出是谁的" : "上下文:本行没归档,勾不上 —— 列出来只是让底下那条已归档的子待办看得出是谁的"}">上下文</span></td>` : `<td class="cchk"><input type="checkbox" ${selected.has(k) ? "checked" : ""} onclick="event.stopPropagation();toggleSel('${k}',this.checked)"></td>`;
  const openD = `onclick="event.stopPropagation();${t.form === "便笺" ? "打开便笺页" : "openDetail"}('${k}')"`;
  const 开 = `${t.form === "便笺" ? "打开便笺页" : "openDetail"}('${k}')`;
  const 完 = 子们.filter((c) => c.status === "已完成").length;
  const 收放 = 子们.length ? `<button class="subtog" title="底下挂着 ${子们.length} 条子待办,做完 ${完} 条(点这里${子展开(k) ? "收起" : "展开"})"
         aria-expanded="${子展开(k)}" onclick="event.stopPropagation();收放子('${k}')">${子展开(k) ? "▾" : "▸"}${子们.length}</button>` : "";
  const 是子标 = 是子 ? '<span class="subis" title="这一行是上面那条待办的子待办">└</span>' : "";
  const 加子 = 是子 || archView || ctx ? "" : `<button class="addsub" title="给「${esc(t.matter)}」加一条子待办(只能加一层)" onclick="event.stopPropagation();openCard('${k}')">＋</button>`;
  return `<tr data-k="${esc(k)}" data-src="${esc(t.src)}" class="${是子 ? "subr " : ""}${selected.has(k) ? "sel 选中 " : ""}${t.status === "已完成" ? "done " : ""}${ctx ? "ctx " : ""}">
      ${chk}
      <td class="cid" ${openD} title="点一下打开详情"><span class="编号 可点" role="button" tabindex="0"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${开}}">${数据ID(t.id)}</span></td>
      <td class="cstar" data-col="重要"><span class="stars" role="group" aria-label="重要程度 ${t.star} 星" title="重要程度 ${t.star} 星(点一下改)" onclick="event.stopPropagation();setStar('${k}',event)">${starHTML(t.star, true)}</span></td>
      <td class="cmatter" ${openD} title="点一下打开详情"><span class="task-title" title="${esc(t.matter)}&#10;点一下打开详情">${esc(t.matter)}</span></td>
      <td class="csub" data-col="子待办">${是子标}${收放}</td>
      <td class="caddsub" data-col="加子待办">${加子}</td>
      <td class="cprog" data-col="进度">${progHTML(t)}</td>
      <td class="cfile" data-col="附件" ${openD}>${附件HTML(t)}</td>
      <td data-col="关联标签">${tagsHTML(t.links, t.src)}</td>
      <td class="cdue ${od ? "od" : ""}" data-col="计划完成">${t.due ? esc(t.due) + (od ? '<div class="late">! 逾期</div>' : "") : '<span class="none">—</span>'}</td>
      ${状态格HTML(t.status)}
      ${日期格("创建", t.ctime, "创建")}${日期格("最后修改", t.mtimeRaw, "修改")}
    </tr>`;
}
function 日期格(列, 值, 词) {
  const v = String(值 || "");
  if (!v)
    return `<td class="cctime" data-col="${列}" title="这条数据当时没记${词}时间"><span class="none">—</span></td>`;
  return `<td class="cctime" data-col="${列}" title="${esc(v.slice(0, 16))}">${esc(v.slice(0, 10))}</td>`;
}
function render() {
  const lab = document.getElementById("todayLabel");
  if (lab)
    lab.textContent = `${TODAY} · 周${"日一二三四五六"[new Date(TODAY).getUTCDay()]}`;
  const addBtn = document.getElementById("btnAdd");
  if (addBtn)
    addBtn.style.display = archView ? "none" : "";
  画页签();
  页签计数();
  画本栏说明();
  const tb = document.getElementById("tb");
  let rows = "", shown = 0, 顶层数 = 0;
  visibleIds = [];
  排序(tops()).forEach((t) => {
    if (!是正式待办(t))
      return;
    if (!passFilter(t))
      return;
    const 自挂 = !lkFilter || lkFilter.ids.has(t.k);
    const 子挂 = !!lkFilter && !自挂 && children(t.k).some((c) => lkFilter.ids.has(c.k));
    if (lkFilter && !自挂 && !子挂)
      return;
    rows += rowHTML(t, false, 子挂);
    shown++;
    顶层数++;
    if (自挂 && !(archView && !t.archived))
      visibleIds.push(t.k);
    if (!子展开(t.k) && !子挂)
      return;
    排序(children(t.k)).forEach((c) => {
      rows += rowHTML(c, true);
      shown++;
      if (!(archView && !c.archived))
        visibleIds.push(c.k);
    });
  });
  const 空钮 = `<button class="主钮" onclick="openCard()" title="新建一条待办 —— 打开的小窗跟顶上工具条那颗新建钮的是同一个">＋ 新建一条</button>`;
  tb.innerHTML = rows || (TAB视图 ? 子标签空表() : "") || `<tr><td colspan="13"><div class="空">${archView ? '<p class="空话">归档箱是空的</p>' : `<p class="空话">${页签 === "今日" ? "今天没有要盯的,清爽 ✓" : "这一栏没有待办"}</p>` + 空钮}</div></td></tr>`;
  const cntEl = document.getElementById("cnt");
  cntEl.textContent = `${顶层数} 条${shown > 顶层数 ? `(含子待办共 ${shown})` : ""}${archView ? "(归档箱)" : ""}`;
  cntEl.title = "子待办跟着它的父待办一起显示、一起展开";
  应用隐藏列();
  if (!主表列宽 && window.UI列宽 && 主表)
    主表列宽 = UI列宽(主表, { 键: "待办主表" });
  if (主表格改)
    主表格改.刷();
  画排序标();
  renderChips();
  renderLkNotice();
  render来源状态();
  updateBulkBar();
  同步工作视图状态();
  if (!EMBED && !archView)
    renderHome();
  if (TAB视图)
    画子标签条(顶层数);
}
function 附件HTML(t) {
  const 段 = [];
  if (t.imgs)
    段.push(`<span class="fcnt" title="这条待办上一共 ${t.imgs} 张图片(评论里的不算,点开详情看)">\uD83D\uDDBC ${t.imgs}</span>`);
  if (t.files)
    段.push(`<span class="fcnt" title="挂着 ${t.files} 个文件(点开详情看)">\uD83D\uDCCE ${t.files}</span>`);
  return 段.join("");
}
function 收放子(k) {
  子开合[k] = !子展开(k);
  render();
}
const 列可隐 = ["重要", "子待办", "加子待办", "进度", "附件", "状态", "计划完成", "关联标签", "创建", "最后修改"];
let 隐藏列;
const 默认藏 = ["进度"];
try {
  const v4 = localStorage.getItem("待办_隐藏列v4");
  if (v4)
    隐藏列 = new Set(JSON.parse(v4));
  else {
    const v3 = localStorage.getItem("待办_隐藏列v3"), v2 = localStorage.getItem("待办_隐藏列v2");
    隐藏列 = new Set(v3 ? JSON.parse(v3) : v2 ? [...JSON.parse(v2), "进度"] : 默认藏);
    隐藏列.delete("创建");
    localStorage.setItem("待办_隐藏列v4", JSON.stringify([...隐藏列]));
  }
} catch (e) {
  隐藏列 = new Set(默认藏);
}
const ckSvg = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="M20 6 9 17l-5-5"/></svg>';
function 应用隐藏列() {
  列可隐.forEach((f) => {
    const hide = 隐藏列.has(f);
    document.querySelectorAll(`[data-col="${f}"]`).forEach((el) => {
      el.style.display = hide ? "none" : "";
    });
  });
}
function 建列菜单() {
  document.getElementById("colMenu").innerHTML = '<div class="mtitle">显示/隐藏列</div>' + 列可隐.map((f) => `<label data-col-item="${f}"><span class="box ${隐藏列.has(f) ? "" : "on"}">${ckSvg}</span> ${f === "重要" ? "★ 重要" : f}</label>`).join("") + (主表列宽 ? '<button type="button" class="小钮 次钮" data-col-reset title="表头右边缘拖过的列宽全部回到出厂宽(只在这台设备上记着)">恢复默认列宽</button>' : "");
}
function toggleColMenu(e) {
  e.stopPropagation();
  const m = document.getElementById("colMenu");
  if (m.classList.contains("open")) {
    m.classList.remove("open");
    return;
  }
  建列菜单();
  m.classList.add("open");
  const 列钮 = document.getElementById("colBtn"), 表钮 = document.getElementById("tabToolBtn");
  const r = (列钮.offsetParent || !表钮 ? 列钮 : 表钮).getBoundingClientRect();
  m.style.position = "fixed";
  m.style.top = r.bottom + 6 + "px";
  m.style.left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - m.offsetWidth - 8)) + "px";
}
document.getElementById("colMenu").addEventListener("click", (e) => {
  e.stopPropagation();
  if (e.target.closest("[data-col-reset]")) {
    主表列宽.恢复();
    toast("已恢复默认列宽");
    return;
  }
  const lab = e.target.closest("label[data-col-item]");
  if (!lab)
    return;
  const f = lab.dataset.colItem;
  if (隐藏列.has(f))
    隐藏列.delete(f);
  else
    隐藏列.add(f);
  try {
    localStorage.setItem("待办_隐藏列v4", JSON.stringify([...隐藏列]));
  } catch (e) {}
  lab.querySelector(".box").classList.toggle("on");
  应用隐藏列();
});
document.addEventListener("click", () => document.getElementById("colMenu").classList.remove("open"));
document.querySelectorAll("table.task-table th[data-sort]").forEach((th) => th.addEventListener("click", () => 点表头排序(th.dataset.sort)));
const 主表 = document.querySelector("table.task-table");
let 主表列宽 = null;
const 主表格改 = window.UI格改 && 主表 ? UI格改(主表, { 存: 存状态格 }) : null;
function toggleSel(k, on) {
  if (on)
    selected.add(k);
  else
    selected.delete(k);
  const tr = document.querySelector(`#tb tr[data-k="${k}"]`);
  if (tr) {
    tr.classList.toggle("sel", on);
    tr.classList.toggle("选中", on);
  }
  updateBulkBar();
}
function toggleSelAll(on) {
  if (on)
    visibleIds.forEach((k) => selected.add(k));
  else
    selected.clear();
  render();
}
const 选中来源 = () => [...new Set([...selected].map((k) => 拆K(k).来源))];
const 选中ids = () => [...selected].map((k) => {
  const o = 拆K(k);
  return { 来源: o.来源, id: o.id };
});
function clearSel() {
  selected.clear();
  render();
}
function updateBulkBar() {
  const bar = document.getElementById("bulkBar"), swap = document.getElementById("barSwap");
  const n = selected.size;
  if (swap)
    swap.classList.toggle("已勾", !!n);
  const all = document.getElementById("selAll");
  if (all) {
    const 中 = visibleIds.filter((k) => selected.has(k)).length;
    all.checked = 中 > 0 && 中 === visibleIds.length;
    all.indeterminate = 中 > 0 && 中 < visibleIds.length;
  }
  bar.innerHTML = `<span class="已选">已选 ${n} 条</span>
    <button class="mini" type="button" onclick="bulkArchive(${archView ? 0 : 1})">${archView ? "还原" : "归档"}</button>
    <button class="mini" type="button" onclick="openBulkDue(this)">改计划完成</button>
    <button class="mini" type="button" onclick="bulkDel()">删除</button>
    <button class="mini 取消" type="button" onclick="clearSel()">取消选择</button>`;
}
async function bulkDel() {
  const ks = [...selected];
  if (!ks.length)
    return;
  if (!await 问删({
    屏上: `删掉这 ${ks.length} 条待办?`,
    细说: `删了先进回收站,能还原:子待办、评论、图、附件跟着一起进去,留 10 天。
只是想从列表里收起来的话,用「归档」那颗。`,
    钮字: `删掉这 ${ks.length} 条`
  }))
    return;
  const r = await postJSON("/api/todo/del", { ids: 选中ids() });
  if (!r || !r.ok) {
    toast(r && r.error || "删不掉", true);
    return;
  }
  if (dCur && ks.includes(dCur))
    closeDetail();
  删完提示(`已删 ${r.删数} 条${r.删子数 ? `(连 ${r.删子数} 条子待办)` : ""},在回收站里`, r.回收ids);
  selected.clear();
  await loadList();
}
function 回收站体(体) {
  return 锁定来源 ? Object.assign({ 来源: 锁定来源 }, 体) : 体;
}
function 回收站错(r) {
  return new Error(r && r.error || 最近错误 && 最近错误.原文 || "没连上后台");
}
async function 刷回收站数() {
  const 计们 = document.querySelectorAll(".回收站钮 .计");
  if (!计们.length)
    return;
  try {
    const r = await (await fetch("/api/todo/trash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(回收站体({ op: "list" }))
    })).json();
    if (r && r.ok) {
      计们.forEach((计) => {
        计.textContent = r.条们.length;
      });
      const 首 = document.getElementById("homeTrash");
      if (首)
        首.hidden = !r.条们.length;
    }
  } catch (e) {}
}
async function 还原回收(条, 单条) {
  const r = await postJSON("/api/todo/trash", Object.assign({ op: "restore", 来源: 条.来源, 回收id: 条.回收id }, 单条 ? { id: 条.id } : {}));
  if (!r || !r.ok)
    throw 回收站错(r);
  await loadList();
  if (dCur)
    refreshDetail();
  刷回收站数();
  return r;
}
function 开回收站(钮) {
  UI回收站({
    名: "待办",
    钮: 钮 || document.getElementById("btnTrash"),
    取: async () => {
      const r = await postJSON("/api/todo/trash", 回收站体({ op: "list" }));
      if (!r || !r.ok)
        throw 回收站错(r);
      return { 条们: r.条们, 说: r.说 };
    },
    还原: async (条, 批) => {
      const r = await 还原回收(条, !!批);
      const 多 = (r.连主待办 || []).length ? `,连它的主待办「${r.连主待办.join("」「")}」一起回来了` : r.回顶层 ? ",它原来的主待办已经清掉了,放回了顶层" : "";
      if (多)
        setTimeout(() => toast(`「${条.名字}」已还原${多}`), 0);
    }
  });
}
function 删完提示(句, 回收们) {
  toast(句, false, { 动作: { 字: "↶ 撤销", 做: async () => {
    let 坏 = 0;
    for (const x of 回收们 || []) {
      try {
        await 还原回收(x, false);
      } catch (e) {
        坏++;
      }
    }
    if (坏)
      toast("撤销没全成 —— 去「回收站」里找回来", true);
    else
      toast("已撤销,放回原处了");
  } } });
  刷回收站数();
}
async function bulkArchive(to) {
  const n = selected.size;
  if (!n)
    return;
  if (to && !await UI确认({ 题: `归档这 ${n} 条?`, 说: `任何状态都能归档,子待办跟着一起收。
勾上「显示归档」能看回来,也能还原。`, 钮字: `归档 ${n} 条`, 危: false }))
    return;
  const r = await postJSON("/api/todo/archive", { ids: 选中ids(), 归档: to });
  if (!r || !r.ok) {
    toast(r && r.error || "操作失败", true);
    return;
  }
  toast((to ? "已归档 " : "已还原 ") + r.改数 + " 条(含级联子)");
  selected.clear();
  await loadList();
}
function openBulkDue(anchor) {
  document.querySelectorAll(".duepop").forEach((n) => n.remove());
  const pop = document.createElement("div");
  pop.className = "duepop";
  pop.innerHTML = `<label>统一改计划完成(${selected.size} 条)</label>
    <input type="date" value="${TODAY}">
    <div class="dp-foot"><button class="次钮" data-clr>清空日期</button><button class="主钮" data-ok>确定</button></div>`;
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8)) + "px";
  pop.style.top = window.scrollY + r.bottom + 6 + "px";
  pop.addEventListener("click", (e) => e.stopPropagation());
  const doSet = async (v) => {
    const r2 = await postJSON("/api/todo/batch", { ids: 选中ids(), 列: "计划完成时间", 值: v });
    if (!r2 || !r2.ok) {
      toast(r2 && r2.error || "批量改失败", true);
      return;
    }
    toast(`已改 ${r2.改数} 条计划完成 → ${v || "(空)"}`);
    pop.remove();
    await loadList();
  };
  pop.querySelector("[data-ok]").addEventListener("click", () => {
    const v = pop.querySelector("input").value;
    if (!v) {
      toast("没选日期(要清空用「清空日期」)", true);
      return;
    }
    doSet(v);
  });
  pop.querySelector("[data-clr]").addEventListener("click", () => doSet(""));
  setTimeout(() => document.addEventListener("click", function h() {
    pop.remove();
    document.removeEventListener("click", h);
  }, { once: true }), 0);
}
const advFields = {
  "事项": { type: "text", get: (t) => t.matter },
  "详情": { type: "text", get: (t) => t.detail },
  "状态": { type: "enum", opts: 状态集, get: (t) => t.status },
  "形态": { type: "enum", opts: ["待办", "便笺"], get: (t) => t.form },
  "重要程度": { type: "num", opts: [1, 2, 3], get: (t) => t.star },
  "计划完成": { type: "date", get: (t) => t.due },
  "创建": { type: "date", get: (t) => (t.ctime || "").slice(0, 10) },
  "最后修改": { type: "date", get: (t) => (t.mtimeRaw || "").slice(0, 10) },
  "关联类型": { type: "arr", get opts() {
    return Object.keys(可选关联类型());
  }, get: (t) => (t.links || []).map((l) => l.type) },
  "关联文本": { type: "text", get: (t) => (t.links || []).map((l) => l.text).join(" ") },
  "逾期": { type: "bool", get: (t) => isOverdue(t) }
};
const advOps = {
  text: ["包含", "不包含", "等于", "为空", "非空"],
  enum: ["等于", "不等于", "为空", "非空"],
  num: [">", "≥", "<", "≤", "=", "为空", "非空"],
  date: ["早于", "晚于", "等于", "为空", "非空"],
  arr: ["含", "不含", "为空", "非空"],
  bool: ["是", "否"]
};
const 运算需值 = (op) => !["为空", "非空", "是", "否"].includes(op);
function evalCond(t, c, 字段们) {
  const f = (字段们 || advFields)[c.field];
  if (!f)
    return true;
  const v = f.get(t);
  const empty = f.type === "arr" ? !(v && v.length) : v === "" || v == null;
  if (c.op === "为空")
    return empty;
  if (c.op === "非空")
    return !empty;
  if (c.op === "是")
    return !!v;
  if (c.op === "否")
    return !v;
  if (empty)
    return false;
  const cv = c.val;
  if (f.type === "text") {
    const hay = String(v).toLowerCase(), nd = String(cv).toLowerCase();
    return c.op === "包含" ? hay.includes(nd) : c.op === "不包含" ? !hay.includes(nd) : hay === nd;
  }
  if (f.type === "enum")
    return c.op === "等于" ? String(v) === String(cv) : String(v) !== String(cv);
  if (f.type === "num") {
    const a = +v, b = +cv;
    return c.op === ">" ? a > b : c.op === "≥" ? a >= b : c.op === "<" ? a < b : c.op === "≤" ? a <= b : a === b;
  }
  if (f.type === "date")
    return c.op === "早于" ? v < cv : c.op === "晚于" ? v > cv : v === cv;
  if (f.type === "arr")
    return c.op === "含" ? v.includes(cv) : !v.includes(cv);
  return true;
}
function passAdv(t) {
  if (!advFilters.length)
    return true;
  let res = evalCond(t, advFilters[0]);
  for (let i = 1;i < advFilters.length; i++)
    res = advFilters[i].conj === "或" ? res || evalCond(t, advFilters[i]) : res && evalCond(t, advFilters[i]);
  return res;
}
let advDraft = [];
function 行筛选HTML(c, i) {
  const f = advFields[c.field], ops = advOps[f.type];
  let valCtl = "";
  if (运算需值(c.op)) {
    if (f.opts)
      valCtl = `<select data-v>${f.opts.map((o) => `<option ${String(o) === String(c.val) ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    else if (f.type === "date")
      valCtl = `<input type="date" data-v value="${esc(c.val || "")}">`;
    else
      valCtl = `<input type="text" data-v value="${esc(c.val || "")}" placeholder="值…">`;
  }
  return `<div class="advrow" data-i="${i}">
    ${i ? `<select data-conj>${["且", "或"].map((o) => `<option ${o === c.conj ? "selected" : ""}>${o}</option>`).join("")}</select>` : '<span class="advfirst">当</span>'}
    <select data-f>${Object.keys(advFields).map((k) => `<option ${k === c.field ? "selected" : ""}>${k}</option>`).join("")}</select>
    <select data-op>${ops.map((o) => `<option ${o === c.op ? "selected" : ""}>${o}</option>`).join("")}</select>
    ${valCtl}
    <button class="op-link op-del" data-x title="删本条">✗</button></div>`;
}
function 画adv行() {
  const box = document.getElementById("advRows");
  box.innerHTML = advDraft.map(行筛选HTML).join("") || '<div class="none" style="padding:6px 2px">还没有条件 → 点「＋ 加条件」</div>';
  box.querySelectorAll(".advrow").forEach((row) => {
    const i = +row.dataset.i, c = advDraft[i];
    const conj = row.querySelector("[data-conj]");
    if (conj)
      conj.addEventListener("change", () => {
        c.conj = conj.value;
      });
    row.querySelector("[data-f]").addEventListener("change", (e) => {
      c.field = e.target.value;
      const f = advFields[c.field];
      c.op = advOps[f.type][0];
      c.val = f.opts ? String(f.opts[0]) : "";
      画adv行();
    });
    row.querySelector("[data-op]").addEventListener("change", (e) => {
      c.op = e.target.value;
      画adv行();
    });
    const v = row.querySelector("[data-v]");
    if (v)
      v.addEventListener("input", () => {
        c.val = v.value;
      });
    if (v && v.tagName === "SELECT")
      c.val = v.value;
    row.querySelector("[data-x]").addEventListener("click", () => {
      advDraft.splice(i, 1);
      if (advDraft.length)
        advDraft[0].conj = "且";
      画adv行();
    });
  });
}
let adv基线 = null;
function openAdv() {
  adv基线 = { src: document.getElementById("fSrc")?.value || "", lk: document.getElementById("fLink")?.value || "" };
  advDraft = advFilters.length ? advFilters.map((c) => Object.assign({}, c)) : [{ conj: "且", field: "事项", op: "包含", val: "" }];
  画adv行();
  const m = document.getElementById("advMask");
  m.classList.remove("hidden");
  管焦点(m, true, () => m.querySelector("[data-f]"));
}
function closeAdv(应用了) {
  if (!应用了 && adv基线) {
    const src = document.getElementById("fSrc"), lk = document.getElementById("fLink");
    if (src)
      src.value = adv基线.src;
    建关联下拉();
    if (lk)
      lk.value = adv基线.lk;
  }
  adv基线 = null;
  const m = document.getElementById("advMask");
  管焦点(m, false);
  m.classList.add("hidden");
}
function advAddRow() {
  advDraft.push({ conj: "且", field: "事项", op: "包含", val: "" });
  画adv行();
}
function advApply() {
  advFilters = advDraft.filter((c) => !运算需值(c.op) || String(c.val || "").trim() !== "").map((c) => Object.assign({}, c, { val: typeof c.val === "string" ? c.val.trim() : c.val }));
  const 换软件 = !!adv基线 && (document.getElementById("fSrc")?.value || "") !== adv基线.src;
  closeAdv(true);
  if (换软件) {
    selected.clear();
    loadList();
  } else
    render();
}
function advClearAll() {
  advFilters = [];
  const src = document.getElementById("fSrc"), lk = document.getElementById("fLink");
  const 换软件 = !!(src && src.value);
  if (src)
    src.value = "";
  if (lk)
    lk.value = "";
  if (换软件) {
    建关联下拉();
    selected.clear();
    loadList();
  } else
    render();
}
function 去掉软件筛选() {
  const s = document.getElementById("fSrc");
  if (s)
    s.value = "";
  建关联下拉();
  selected.clear();
  loadList();
}
function 去掉关联筛选() {
  const s = document.getElementById("fLink");
  if (s)
    s.value = "";
  render();
}
function advDelChip(i) {
  advFilters.splice(i, 1);
  if (advFilters.length)
    advFilters[0].conj = "且";
  render();
}
function renderChips() {
  const box = document.getElementById("advChips");
  const srcV = 锁定来源 ? "" : document.getElementById("fSrc")?.value || "";
  const lkV = document.getElementById("fLink")?.value || "";
  const 签 = (字, 点) => `<span class="筛签">${字}<button type="button" onclick="${点}" aria-label="去掉这条筛选条件" title="去掉这条">✗</button></span>`;
  const 片 = [];
  if (srcV)
    片.push(签(`软件 = ${esc(源名(srcV))}`, "去掉软件筛选()"));
  if (lkV)
    片.push(签(`关联 = ${esc(lkV)}`, "去掉关联筛选()"));
  advFilters.forEach((c, i) => {
    片.push((i ? `<span class="conj">${esc(c.conj)}</span>` : "") + 签(`${esc(c.field)} ${esc(c.op)}${运算需值(c.op) ? " " + esc(c.val) : ""}`, `advDelChip(${i})`));
  });
  box.hidden = !片.length;
  box.innerHTML = 片.length ? "已筛:" + 片.join("") + `<button class="清空" type="button" onclick="advClearAll()">清空</button>` : "";
}
const 视图深拷 = (x) => JSON.parse(JSON.stringify(x));
const 视图允许页签 = new Set(["今日", "未开始", "进行中", "已完成", "全部"]);
const 视图允许范围 = new Set([0, 2, 4, 6]);
function 当前工作视图配置(保存搜索词 = false) {
  const q = (document.getElementById("q")?.value || "").trim();
  const tab = archView ? "全部" : 视图允许页签.has(页签) ? 页签 : "全部";
  return {
    schema_version: 1,
    membership: {
      tab,
      scope_days: tab === "今日" ? +document.getElementById("fScope")?.value || 0 : 0,
      source: 锁定来源 || document.getElementById("fSrc")?.value || "",
      relation_type: document.getElementById("fLink")?.value || "",
      archive: !!archView,
      advanced: advFilters.map((c) => ({ conj: c.conj || "且", field: c.field, op: c.op, val: c.val == null ? "" : String(c.val) })),
      search: { include: !!(保存搜索词 && q), text: 保存搜索词 && q ? q : "" }
    },
    sort: { kind: "default", label: "逾期 → 今日 → 未排期 → 后续日期" }
  };
}
function 视图比较态(cfg) {
  const m = cfg && cfg.membership || {}, s = m.search || {};
  const tab = m.archive ? "全部" : m.tab || "全部";
  return {
    tab,
    scope_days: tab === "今日" ? +m.scope_days || 0 : 0,
    source: m.source || "",
    relation_type: m.relation_type || "",
    archive: !!m.archive,
    advanced: (m.advanced || []).map((c) => ({ conj: c.conj || "且", field: c.field, op: c.op, val: c.val == null ? "" : String(c.val) })),
    search_text: s.include ? String(s.text || "").trim() : "",
    sort: cfg && cfg.sort && cfg.sort.kind || "default"
  };
}
function 当前视图比较态() {
  const cfg = 当前工作视图配置(true);
  return 视图比较态(cfg);
}
function 视图关系类型集(source) {
  const 用 = source ? 来源集.filter((x) => x.key === source) : 来源集;
  return new Set(用.flatMap((x) => x.类型 || []));
}
function 校验工作视图配置(cfg) {
  if (!cfg || cfg.schema_version !== 1 || !cfg.membership)
    return "这份视图配置格式不对";
  const m = cfg.membership;
  if (!视图允许页签.has(m.tab))
    return `视图里的状态范围「${m.tab || ""}」现在不认识`;
  if (!视图允许范围.has(+m.scope_days || 0))
    return "视图里的动态日期范围现在不认识";
  if (m.source && !来源集.some((x) => x.key === m.source))
    return `视图里的软件「${m.source}」现在不存在`;
  const 关联可选 = 视图关系类型集(m.source || "");
  if (m.relation_type && !关联可选.has(m.relation_type))
    return `视图里的关联类型「${m.relation_type}」现在不可用`;
  if (!Array.isArray(m.advanced) || m.advanced.length > 50)
    return "这份视图的高级筛选条件格式不对";
  for (const c of m.advanced) {
    const f = advFields[c.field];
    if (!f)
      return `视图里的筛选字段「${c.field || ""}」现在不存在`;
    if (!advOps[f.type].includes(c.op))
      return `「${c.field}」的筛选方式「${c.op || ""}」现在不可用`;
    if (运算需值(c.op) && String(c.val || "").trim() === "")
      return `「${c.field}」缺少筛选值`;
    if (f.type === "date" && 运算需值(c.op) && !/^\d{4}-\d{2}-\d{2}$/.test(String(c.val)))
      return `「${c.field}」里的固定日期格式不对`;
    if (c.field === "关联类型" && 运算需值(c.op) && !关联可选.has(String(c.val)))
      return `高级筛选里的关联类型「${c.val}」现在不可用`;
    if (c.field !== "关联类型" && Array.isArray(f.opts) && 运算需值(c.op) && !f.opts.map(String).includes(String(c.val)))
      return `「${c.field}」里的值「${c.val}」现在不可用`;
  }
  if (cfg.sort && cfg.sort.kind && cfg.sort.kind !== "default")
    return "这份视图的排序方式现在不认识";
  return "";
}
function 工作视图摘要(cfg) {
  if (!cfg || !cfg.membership)
    return "配置读不出来";
  const m = cfg.membership, bits = [];
  if (m.archive)
    bits.push("归档箱");
  else if (m.tab === "今日") {
    const d = +m.scope_days || 0;
    bits.push(d === 0 ? "今日（动态）" : `近 ${d + 1} 天（动态）`);
  } else if (m.tab && m.tab !== "全部")
    bits.push(m.tab);
  if (m.source)
    bits.push(`软件：${源名(m.source)}`);
  if (m.relation_type)
    bits.push(`关联：${m.relation_type}`);
  (m.advanced || []).forEach((c) => {
    const 固定 = ["计划完成", "创建"].includes(c.field) && 运算需值(c.op) ? "（固定日期）" : "";
    bits.push(`${c.field} ${c.op}${运算需值(c.op) ? " " + c.val : ""}${固定}`);
  });
  if (m.search && m.search.include && m.search.text)
    bits.push(`搜索“${m.search.text}”`);
  return bits.join(" · ") || "全部未归档待办";
}
const 内置工作视图 = [
  {
    key: "undated",
    名称: "未排期待办",
    说明: "未完成的正式待办，且没有计划完成日期",
    配置: () => ({ schema_version: 1, membership: {
      tab: "全部",
      scope_days: 0,
      source: "",
      relation_type: "",
      archive: false,
      advanced: [
        { conj: "且", field: "形态", op: "等于", val: "待办" },
        { conj: "且", field: "计划完成", op: "为空", val: "" },
        { conj: "且", field: "状态", op: "不等于", val: "已完成" }
      ],
      search: { include: false, text: "" }
    }, sort: { kind: "default", label: "逾期 → 今日 → 未排期 → 后续日期" } })
  }
];
function 设置工作视图条件(cfg) {
  const m = cfg.membership || {}, sc = document.getElementById("fScope"), src = document.getElementById("fSrc");
  页签 = m.archive ? "全部" : m.tab;
  if (sc)
    sc.value = String(视图允许范围.has(+m.scope_days || 0) ? +m.scope_days || 0 : 0);
  if (src)
    src.value = m.source || "";
  建关联下拉();
  const lk = document.getElementById("fLink");
  if (lk)
    lk.value = m.relation_type || "";
  archView = !!m.archive;
  const ac = document.getElementById("fArch");
  if (ac)
    ac.checked = archView;
  advFilters = (m.advanced || []).map((c) => ({ conj: c.conj || "且", field: c.field, op: c.op, val: c.val == null ? "" : String(c.val) }));
  const q = document.getElementById("q");
  if (q) {
    q.value = m.search && m.search.include ? String(m.search.text || "") : "";
    快搜清钮(q);
  }
  selected.clear();
}
function 收起工作视图面板() {
  const p = document.getElementById("workViewPanel"), b = document.getElementById("viewToggle");
  if (!p || !b)
    return;
  p.hidden = true;
  b.setAttribute("aria-expanded", "false");
}
function 展开工作视图面板() {
  const p = document.getElementById("workViewPanel"), b = document.getElementById("viewToggle");
  if (!p || !b)
    return;
  p.hidden = false;
  b.setAttribute("aria-expanded", "true");
  画工作视图列表();
  同步保存搜索提示();
  同步工作视图状态();
}
function toggleWorkViews() {
  if (EMBED)
    return;
  const p = document.getElementById("workViewPanel");
  if (!p)
    return;
  if (p.hidden) {
    收起视图表单();
    展开工作视图面板();
  } else
    收起工作视图面板();
}
function 回临时筛选() {
  当前工作视图 = null;
  当前视图基线 = null;
  收起工作视图面板();
  render();
}
function 收起视图表单() {
  const f = document.getElementById("viewForm"), add = document.getElementById("viewAddBtn");
  if (f)
    f.hidden = true;
  if (add)
    add.hidden = false;
  准备工作视图表单("new");
}
function 亮出视图表单() {
  const f = document.getElementById("viewForm"), add = document.getElementById("viewAddBtn");
  if (f)
    f.hidden = false;
  if (add)
    add.hidden = true;
}
function 打开新建视图表单() {
  准备工作视图表单("new");
  亮出视图表单();
  document.getElementById("viewName")?.focus();
}
document.addEventListener("click", (e) => {
  const w = document.getElementById("workViews"), p = document.getElementById("workViewPanel");
  if (e.target.closest && e.target.closest("#viewTemp"))
    return;
  if (w && p && !p.hidden && !w.contains(e.target) && e.target.isConnected)
    收起工作视图面板();
});
document.addEventListener("keydown", (e) => {
  const p = document.getElementById("workViewPanel");
  if (e.key === "Escape" && p && !p.hidden) {
    收起工作视图面板();
    document.getElementById("viewToggle")?.focus();
  }
});
async function 应用工作视图配置(meta, cfg) {
  const why = 校验工作视图配置(cfg);
  if (why) {
    toast(why, true);
    return false;
  }
  const 旧cfg = 当前工作视图配置(true), 旧meta = 当前工作视图, 旧基线 = 当前视图基线;
  const 旧lk = lkFilter, 旧地址 = String(location.href), 清lk = !!lkFilter && !LK锁();
  if (清lk) {
    lkFilter = null;
    const u = new URL(location.href);
    u.searchParams.delete("lk");
    u.searchParams.delete("lkt");
    history.replaceState(null, "", u);
  }
  应用视图中 = true;
  设置工作视图条件(cfg);
  const ok = await loadList();
  if (!ok) {
    设置工作视图条件(旧cfg);
    if (清lk) {
      lkFilter = 旧lk;
      history.replaceState(null, "", 旧地址);
    }
    await loadList();
    当前工作视图 = 旧meta;
    当前视图基线 = 旧基线;
    应用视图中 = false;
    render();
    return false;
  }
  当前工作视图 = Object.assign({}, meta, { 临时: false });
  当前视图基线 = 视图深拷(cfg);
  应用视图中 = false;
  render();
  收起工作视图面板();
  return true;
}
async function 打开内置工作视图(key) {
  const v = 内置工作视图.find((x) => x.key === key);
  if (!v)
    return;
  await 应用工作视图配置({ kind: "builtin", key: v.key, 名称: v.名称 }, v.配置());
}
async function 打开保存工作视图(id) {
  const v = 工作视图们.find((x) => +x.id === +id);
  if (!v)
    return toast("这份视图已经不在列表里", true);
  if (!v.配置)
    return toast(v.失效原因 || "这份视图配置读不出来", true);
  await 应用工作视图配置({ kind: "saved", id: +v.id, 名称: v.名称 }, v.配置);
}
function 同步工作视图状态() {
  const root = document.getElementById("workViews");
  if (!root)
    return;
  if (EMBED) {
    root.hidden = true;
    return;
  }
  const label = document.getElementById("viewCurrent"), tag = document.getElementById("viewTemp");
  const upd = document.getElementById("viewUpdateQuick");
  let 临时 = false;
  if (当前工作视图 && 当前视图基线 && !应用视图中) {
    临时 = JSON.stringify(当前视图比较态()) !== JSON.stringify(视图比较态(当前视图基线));
    当前工作视图.临时 = 临时;
  }
  if (label)
    label.textContent = 当前工作视图 ? 当前工作视图.名称 : "临时筛选";
  if (tag)
    tag.hidden = !临时;
  if (upd)
    upd.hidden = !临时 || !当前工作视图 || 当前工作视图.kind !== "saved";
  const p = document.getElementById("workViewPanel");
  if (p && !p.hidden)
    同步保存搜索提示();
}
async function 还原工作视图() {
  if (!当前工作视图 || !当前视图基线)
    return;
  await 应用工作视图配置(Object.assign({}, 当前工作视图, { 临时: false }), 当前视图基线);
}
function 同步保存搜索提示() {
  const cb = document.getElementById("viewSaveSearch"), tx = document.getElementById("viewSaveSearchText");
  if (!cb || !tx)
    return;
  const q = (document.getElementById("q")?.value || "").trim();
  if (!q) {
    cb.checked = false;
    cb.disabled = true;
    tx.textContent = "当前没有顶部搜索词";
  } else {
    cb.disabled = false;
    tx.textContent = `同时保存搜索词「${q.length > 22 ? q.slice(0, 22) + "…" : q}」`;
  }
}
function 准备工作视图表单(mode = "new") {
  视图表单模式 = mode;
  const name = document.getElementById("viewName"), btn = document.getElementById("viewSaveBtn");
  const cancel = document.getElementById("viewFormCancel"), cb = document.getElementById("viewSaveSearch");
  const hint = document.getElementById("viewFormHint");
  if (!name || !btn || !cancel || !cb || !hint)
    return;
  name.readOnly = false;
  cb.checked = false;
  name.hidden = false;
  if (mode === "update" && 当前工作视图?.kind === "saved") {
    name.value = 当前工作视图.名称;
    name.readOnly = true;
    btn.textContent = "更新";
    cb.checked = !!当前视图基线?.membership?.search?.include;
    hint.textContent = `把现在的条件写回「${当前工作视图.名称}」;搜索词只有勾上才存。`;
  } else if (mode === "saveas") {
    name.value = 当前工作视图 ? `${当前工作视图.名称} 副本` : "";
    btn.textContent = "另存";
    cb.checked = !!当前视图基线?.membership?.search?.include;
    hint.textContent = "另存一份新视图;列显示与列宽只留在这台设备。";
  } else {
    视图表单模式 = "new";
    name.value = "";
    btn.textContent = "保存";
    hint.textContent = "保存筛选条件和默认排序;列显示与列宽只留在这台设备。";
  }
  同步保存搜索提示();
}
function 打开更新视图表单() {
  if (!当前工作视图 || 当前工作视图.kind !== "saved")
    return;
  展开工作视图面板();
  准备工作视图表单("update");
  亮出视图表单();
  document.getElementById("viewSaveBtn")?.focus();
}
function 打开另存视图表单() {
  展开工作视图面板();
  准备工作视图表单("saveas");
  亮出视图表单();
  const n = document.getElementById("viewName");
  if (n) {
    n.focus();
    n.select();
  }
}
async function 刷新工作视图列表() {
  const r = await postJSON("/api/todo/views", { 操作: "列出" });
  if (!r || !r.ok) {
    工作视图后台就绪 = false;
    工作视图们 = [];
    画工作视图列表();
    return false;
  }
  工作视图后台就绪 = true;
  工作视图们 = r.视图 || [];
  if (当前工作视图?.kind === "saved") {
    const now = 工作视图们.find((x) => +x.id === +当前工作视图.id);
    if (now)
      当前工作视图.名称 = now.名称;
  }
  画工作视图列表();
  同步工作视图状态();
  return true;
}
async function 初始化工作视图() {
  const root = document.getElementById("workViews");
  if (!root || EMBED) {
    if (root)
      root.hidden = true;
    return;
  }
  画工作视图列表();
  await 刷新工作视图列表();
}
function 画工作视图列表() {
  const built = document.getElementById("viewBuiltins"), list = document.getElementById("viewList");
  if (!built || !list)
    return;
  const 当前内置 = 当前工作视图?.kind === "builtin" ? 当前工作视图.key : "";
  built.innerHTML = `<button class="项${当前工作视图 ? "" : " 当前"}" type="button" ${当前工作视图 ? "" : 'aria-current="true"'} onclick="回临时筛选()"
      title="不套任何保存的视图,按你手上现在的条件看">临时筛选</button>` + 内置工作视图.map((v) => `<button class="项${当前内置 === v.key ? " 当前" : ""}" type="button" ${当前内置 === v.key ? 'aria-current="true"' : ""}
      onclick="打开内置工作视图('${v.key}')" title="${esc(v.说明)}">${esc(v.名称)}</button>`).join("");
  if (!工作视图后台就绪) {
    list.innerHTML = '<div class="view-empty">存视图的服务没连上;内置那几条照常能用</div>';
    return;
  }
  const q = (document.getElementById("viewSearch")?.value || "").trim().toLowerCase();
  const arr = 工作视图们.filter((v) => !q || String(v.名称 || "").toLowerCase().includes(q));
  if (!arr.length) {
    list.innerHTML = `<div class="view-empty">${q ? "没有匹配的保存视图" : "还没有保存视图"}</div>`;
    return;
  }
  list.innerHTML = arr.map((v) => {
    if (+视图重命名id === +v.id)
      return `<div class="viewitem view-rename">
      <input id="viewRename-${v.id}" maxlength="80" value="${esc(v.名称)}" aria-label="新的视图名称">
      <button class="小钮" type="button" onclick="保存工作视图重命名(${+v.id})">保存</button>
      <button class="小钮" type="button" onclick="取消工作视图重命名()">取消</button>
    </div>`;
    const active = 当前工作视图?.kind === "saved" && +当前工作视图.id === +v.id;
    const summary = v.配置 ? 工作视图摘要(v.配置) : v.失效原因 || "配置读不出来";
    return `<div class="viewitem">
      <button class="项${active ? " 当前" : ""}" type="button" ${v.配置 ? `onclick="打开保存工作视图(${+v.id})"` : "disabled"} ${active ? 'aria-current="true"' : ""}
              title="${esc(summary)} · 排序:逾期 → 今日 → 未排期 → 后续日期">${esc(v.名称)}</button>
      <button class="vi-op" type="button" onclick="开始工作视图重命名(${+v.id})" aria-label="重命名「${esc(v.名称)}」" title="重命名">✎</button>
      <button class="vi-op" type="button" onclick="删除保存工作视图(${+v.id})" aria-label="删除「${esc(v.名称)}」" title="删除这份视图(待办不删)">✗</button>
    </div>`;
  }).join("");
}
function 开始工作视图重命名(id) {
  视图重命名id = +id;
  画工作视图列表();
  const n = document.getElementById(`viewRename-${+id}`);
  if (n) {
    n.focus();
    n.select();
  }
}
function 取消工作视图重命名() {
  视图重命名id = null;
  画工作视图列表();
}
async function 保存工作视图重命名(id) {
  if (!工作视图后台就绪)
    return toast("保存视图后台还没就绪", true);
  const n = document.getElementById(`viewRename-${+id}`), 名称 = (n?.value || "").trim();
  if (!名称)
    return toast("视图名称不能为空", true);
  const r = await postJSON("/api/todo/views", { 操作: "重命名", id: +id, 名称 });
  if (!r || !r.ok)
    return toast(r && r.error || "重命名没成功", true);
  if (当前工作视图?.kind === "saved" && +当前工作视图.id === +id)
    当前工作视图.名称 = r.视图.名称;
  视图重命名id = null;
  await 刷新工作视图列表();
  toast("视图已重命名");
}
async function 删除保存工作视图(id) {
  if (!工作视图后台就绪)
    return toast("保存视图后台还没就绪", true);
  const v = 工作视图们.find((x) => +x.id === +id);
  if (!v)
    return;
  if (!await UI确认({ 题: `删除视图「${v.名称}」?`, 说: "只删这份视图配置,不会删除任何待办。", 钮字: "删除视图" }))
    return;
  const r = await postJSON("/api/todo/views", { 操作: "删除", id: +id });
  if (!r || !r.ok)
    return toast(r && r.error || "删除视图没成功", true);
  if (当前工作视图?.kind === "saved" && +当前工作视图.id === +id) {
    当前工作视图 = null;
    当前视图基线 = null;
  }
  await 刷新工作视图列表();
  render();
  toast("已删除视图，待办没有删除");
}
async function 提交工作视图() {
  if (!工作视图后台就绪)
    return toast("保存视图后台还没就绪", true);
  const name = document.getElementById("viewName"), cb = document.getElementById("viewSaveSearch");
  const 名称 = (name?.value || "").trim();
  if (视图表单模式 !== "update" && !名称)
    return toast("先给这份视图起个名字", true);
  const 是更新 = 视图表单模式 === "update";
  const cfg = 当前工作视图配置(!!cb?.checked);
  let r;
  if (是更新) {
    if (!当前工作视图 || 当前工作视图.kind !== "saved")
      return toast("当前不是可更新的保存视图", true);
    r = await postJSON("/api/todo/views", { 操作: "更新", id: 当前工作视图.id, 配置: cfg });
  } else {
    r = await postJSON("/api/todo/views", { 操作: "新建", 名称, 配置: cfg });
  }
  if (!r || !r.ok)
    return toast(r && r.error || "保存视图没成功", true);
  const v = r.视图;
  await 刷新工作视图列表();
  const ok = await 应用工作视图配置({ kind: "saved", id: +v.id, 名称: v.名称 }, v.配置);
  if (ok) {
    收起视图表单();
    toast(是更新 ? "视图已更新" : "视图已保存");
  }
}
const 字段写尾 = new Map, 字段写最新 = new Map;
let 字段写序 = 0;
async function 排同字段写(k, 列, 值) {
  const key = String(k) + "\x00" + String(列), 号 = ++字段写序;
  字段写最新.set(key, 号);
  const 前 = 字段写尾.get(key) || Promise.resolve();
  const 请求 = 前.catch(() => null).then(async () => {
    const one = 拆K(k);
    try {
      return await postJSON("/api/todo/edit", { 来源: one.来源, id: one.id, 列, 值 });
    } catch (e) {
      return { ok: false, error: e && e.message || "保存失败" };
    }
  });
  const 尾 = 请求.then(() => null, () => null);
  字段写尾.set(key, 尾);
  const r = await 请求;
  const 最新 = 字段写最新.get(key) === 号;
  if (最新 && 字段写尾.get(key) === 尾) {
    字段写尾.delete(key);
    字段写最新.delete(key);
  }
  return { r, 最新 };
}
async function setStatus(k, v) {
  const t = todos.find((x) => x.k === k);
  if (t)
    t.status = v;
  const { r, 最新 } = await 排同字段写(k, "状态", v);
  if (!最新)
    return;
  if (r && r.ok)
    toast("状态→" + v);
  else
    toast(r && r.error || "改状态失败", true);
  await loadList();
}
async function setStar(k, e) {
  const i = e.target.closest("i,button");
  if (!i)
    return;
  const 星盒 = e.currentTarget, lv = [...星盒.children].indexOf(i) + 1;
  星盒.innerHTML = starHTML(lv, true);
  星盒.setAttribute("aria-label", `重要程度 ${lv} 星`);
  星盒.title = `重要程度 ${lv} 星(点一下改)`;
  const t = todos.find((x) => x.k === k);
  if (t)
    t.star = lv;
  const { r, 最新 } = await 排同字段写(k, "重要程度", lv);
  if (!最新)
    return;
  if (r && r.ok)
    toast("★" + lv);
  else
    toast(r && r.error || "改重要度失败", true);
  await loadList();
}
async function 转成待办(k) {
  if (!k)
    return false;
  const { 来源, id } = 拆K(k);
  const r = await postJSON("/api/todo/edit", { 来源, id, 列: "形态", 值: "待办" });
  if (!r || !r.ok) {
    toast(r && r.error || "转不过去", true);
    return false;
  }
  toast(`#${id} 已转成待办,编号没变`);
  await loadList();
  if (dCur === k)
    refreshDetail();
  return true;
}
let 卡形态 = "sm";
let 卡宿 = "card";
let 卡草稿 = null;
let 卡保存中 = false;
let 卡载入序 = 0, 卡载入目标 = "";
function 新卡载入(目标) {
  卡载入目标 = String(目标 || "");
  return ++卡载入序;
}
function 卡载入有效(序, 目标) {
  return 序 === 卡载入序 && 卡载入目标 === String(目标 || "");
}
function 作废卡载入() {
  卡载入序++;
  卡载入目标 = "";
}
const 窗形KEY = { card: "todo.待办.窗口形态", note: "todo.便笺.窗口形态" };
function 读窗形(宿) {
  try {
    const v = localStorage.getItem(窗形KEY[宿]);
    return ["sm", "lg", "page"].includes(v) ? v : "sm";
  } catch {
    return "sm";
  }
}
function 记窗形(宿, 到) {
  if (SOLO)
    return;
  try {
    localStorage.setItem(窗形KEY[宿], ["sm", "lg", "page"].includes(到) ? 到 : "sm");
  } catch {}
}
function 默认窗形(宿) {
  if (SOLO)
    return "sm";
  return 读窗形(宿);
}
function 卡存态(状态, 文案) {
  const el = document.getElementById("cardSaveState");
  if (!el)
    return;
  const 字 = 状态 === "好" ? "✓" : 状态 === "挂" ? "✗" : "";
  if (!字) {
    el.textContent = 文案;
    return;
  }
  const 符 = document.createElement("i");
  符.className = "符";
  符.textContent = 字;
  el.replaceChildren(符, " " + 文案);
}
function 标卡有改动() {
  if (卡宿 === "card" && 卡草稿 && 卡草稿._已有)
    卡存态("", "有修改未保存");
}
function 画卡归档钮() {
  const box = document.getElementById("cardArch"), b = document.getElementById("cardArchBtn");
  if (!box || !b)
    return;
  const 归 = !!box.checked;
  b.textContent = 归 ? "已归档 ✓" : "归档";
  b.classList.toggle("on", 归);
  b.setAttribute("aria-pressed", 归 ? "true" : "false");
  b.title = 归 ? "这条已经归档:列表里默认看不见(勾「显示归档」能看回来)。点一下取消归档,放回列表" : "归档=从列表里收起来,记录一个字不删;再点一下就取消归档";
}
function 卡保存账() {
  if (!卡草稿)
    return null;
  if (!卡草稿._保存账)
    卡草稿._保存账 = { 正文待补: false, 项: {} };
  return 卡草稿._保存账;
}
function 记卡待补(键, path, body, 文案) {
  const 账 = 卡保存账();
  if (账)
    账.项[键] = { path, body: Object.assign({}, body), 文案 };
}
function 清卡待补(键) {
  const 账 = 卡保存账();
  if (账)
    delete 账.项[键];
}
function 保存失败说(果) {
  return (果 && 果.失败项 || []).join(" · ") + (果 && 果.末错 ? `(${果.末错})` : "");
}
function 追加保存失败(果, 文案) {
  果.败 = (果.败 || 0) + 1;
  if (!Array.isArray(果.失败项))
    果.失败项 = [];
  if (!果.失败项.includes(文案))
    果.失败项.push(文案);
  果.说 = 保存失败说(果);
}
async function 跑卡待补项(果, 键, path, body, 文案) {
  const r = await postJSON(path, body);
  if (r && r.ok) {
    清卡待补(键);
    return r;
  }
  记卡待补(键, path, body, 文案);
  追加保存失败(果, 文案);
  return r;
}
function 新草稿(形态) {
  return {
    来源: 锁定来源 || document.getElementById("fSrc") && document.getElementById("fSrc").value || 默认源(),
    父id: null,
    父文: "",
    星: 1,
    形态: 形态 || "待办",
    链接: [],
    文件: []
  };
}
function 卡盒() {
  return document.getElementById(卡宿 === "note" ? "noteBox" : "cardBox");
}
function 卡罩() {
  return document.getElementById(卡宿 === "note" ? "noteMask" : "cardMask");
}
let 编器暂存 = null;
async function 压下详情正文(仍有效) {
  const 活 = typeof 仍有效 === "function" ? 仍有效 : () => true;
  编器暂存 = null;
  if (dCur == null || 编器)
    return true;
  if (块脏) {
    const 存成 = await 存块();
    if (!活())
      return false;
    if (!存成) {
      toast("父待办的正文没存上,先没给你开这个窗 —— 免得等下还回来的是旧的", true);
      return false;
    }
  }
  await 强存历史();
  if (!活())
    return false;
  清撤销队列();
  编器暂存 = { 块, 块文件, 块脏, 块版, 选块: new Set(选块), 卡宿 };
  return true;
}
function 弹回详情正文() {
  if (!编器暂存)
    return;
  ({ 块, 块文件, 块脏, 块版, 卡宿 } = 编器暂存);
  选块.clear();
  编器暂存.选块.forEach((b) => 选块.add(b));
  编器暂存 = null;
}
async function openCard(父k) {
  const 载目标 = "new:" + String(父k || ""), 载序 = 新卡载入(载目标);
  if (!await 压下详情正文(() => 卡载入有效(载序, 载目标)))
    return;
  if (!卡载入有效(载序, 载目标))
    return;
  卡重试中 = false;
  卡保存中 = false;
  卡宿 = "card";
  当前详情数据 = null;
  卡草稿 = 新草稿("待办");
  const box = document.getElementById("cardBox");
  if (父k) {
    const p = todos.find((x) => x.k === 父k);
    const one = 拆K(父k);
    卡草稿.父id = one.id;
    卡草稿.来源 = one.来源;
    卡草稿.父文 = p ? p.matter : 数据ID(one.id);
  }
  document.getElementById("cardTitle").textContent = 父k ? "建子待办" : "建待办";
  const hint = document.getElementById("cardSubHint");
  if (父k) {
    hint.textContent = `挂在「${卡草稿.父文}」底下(限一层,子待办下面不再有子待办)`;
    hint.className = "sf-note";
  } else {
    hint.textContent = "";
    hint.className = "hidden";
  }
  document.getElementById("cardMatter").textContent = "";
  document.getElementById("cardStatus").value = "未开始";
  document.getElementById("cardDate").value = "";
  document.getElementById("cardArch").checked = false;
  画卡归档钮();
  document.getElementById("cardStars").innerHTML = starHTML(1, true);
  const tw = document.getElementById("cardTargetWrap"), tg = document.getElementById("cardTarget");
  if (tg)
    tg.value = "";
  if (tw)
    tw.style.display = 源信息(卡草稿.来源).量化 ? "" : "none";
  开编器(box, [{ type: "text", text: "" }]);
  画卡关联();
  画卡附件();
  画卡子待办();
  画卡评论();
  画卡元信息();
  重置撤销队列();
  切卡形态(默认窗形("card"));
  卡存态("", "尚未保存");
  压卡层();
  管焦点(卡罩(), 卡形态 !== "page");
  setTimeout(() => {
    const el = 文档元素();
    const f = el && el.querySelector("[contenteditable]");
    if (f)
      f.focus();
  }, 40);
}
function 卡详情初块(det) {
  const 初 = (det.块 || []).map((b) => Object.assign({}, b));
  const 已引 = new Set(初.filter((b) => b.type === "img").map((b) => b.附件id));
  (det.详情图 || []).forEach((a) => {
    if (!已引.has(a.id))
      初.push({ type: "img", 附件id: a.id });
  });
  return 初.length ? 初 : [{ type: "text", text: "" }];
}
async function openTodo(k) {
  const key = String(k), 载目标 = "todo:" + key, 载序 = 新卡载入(载目标);
  if (!await 压下详情正文(() => 卡载入有效(载序, 载目标)))
    return;
  if (!卡载入有效(载序, 载目标))
    return;
  卡重试中 = false;
  卡保存中 = false;
  卡宿 = "card";
  const one = 拆K(key);
  const det = await postJSON("/api/prod/todo/detail", one);
  if (!卡载入有效(载序, 载目标))
    return;
  if (!det || !det.ok) {
    toast(det && det.error || "这条待办打不开", true);
    return;
  }
  当前详情数据 = det;
  const t = det.待办 || {};
  卡草稿 = 新草稿("待办");
  卡草稿.来源 = one.来源;
  卡草稿.星 = +(t.重要程度 || 1);
  卡草稿._已有 = true;
  卡草稿._原 = {
    事项: t.事项 || "",
    状态: t.状态 || "未开始",
    星: +(t.重要程度 || 1),
    日期: t.计划完成时间 || "",
    归档: +(t.归档 || 0),
    目标数: t.目标数 || ""
  };
  const box = document.getElementById("cardBox");
  document.getElementById("cardTitle").textContent = "待办 #" + one.id;
  document.getElementById("cardMatter").textContent = t.事项 || "";
  document.getElementById("cardStatus").value = t.状态 || "未开始";
  document.getElementById("cardDate").value = t.计划完成时间 || "";
  document.getElementById("cardArch").checked = !!t.归档;
  画卡归档钮();
  document.getElementById("cardStars").innerHTML = starHTML(卡草稿.星, true);
  const hint = document.getElementById("cardSubHint");
  hint.textContent = "";
  hint.className = "hidden";
  const tw = document.getElementById("cardTargetWrap"), tg = document.getElementById("cardTarget");
  if (tg)
    tg.value = t.目标数 || "";
  if (tw)
    tw.style.display = 源信息(one.来源).量化 ? "" : "none";
  开编器(box, 卡详情初块(det), key, det.文件 || []);
  画卡关联();
  画卡附件();
  画卡子待办();
  画卡评论();
  画卡元信息();
  重置撤销队列();
  切卡形态(默认窗形("card"));
  卡存态("好", "已保存");
  压卡层();
  管焦点(卡罩(), 卡形态 !== "page");
}
async function openNote(k) {
  关两栏();
  const key = String(k || ""), 载目标 = "note:" + key, 载序 = 新卡载入(载目标);
  if (编器 && 正文落点() && 正文落点() !== key) {
    await 强存历史();
    if (!卡载入有效(载序, 载目标))
      return;
    清撤销队列();
  }
  if (!await 压下详情正文(() => 卡载入有效(载序, 载目标)))
    return;
  if (!卡载入有效(载序, 载目标))
    return;
  卡重试中 = false;
  卡宿 = "note";
  关便笺搜索(false, true);
  const box = document.getElementById("noteBox");
  if (k) {
    const one = 拆K(key);
    const det = await postJSON("/api/prod/todo/detail", one);
    if (!卡载入有效(载序, 载目标))
      return;
    if (!det || !det.ok) {
      toast(det && det.error || "这条便笺打不开", true);
      return;
    }
    当前详情数据 = det;
    卡草稿 = 新草稿("便笺");
    卡草稿.来源 = one.来源;
    const 初 = (det.块 || []).map((b) => Object.assign({}, b));
    const 已引 = new Set(初.filter((b) => b.type === "img").map((b) => b.附件id));
    (det.详情图 || []).forEach((a) => {
      if (!已引.has(a.id))
        初.push({ type: "img", 附件id: a.id });
    });
    开编器(box, 初.length ? 初 : [{ type: "text", text: "" }], key, det.文件 || []);
    装标题栏((det.待办 || {}).事项 || (todos.find((x) => x.k === String(k)) || {}).matter || "");
  } else {
    当前详情数据 = null;
    卡草稿 = 新草稿("便笺");
    开编器(box, [{ type: "text", text: "" }]);
    装标题栏("");
  }
  画便笺关联();
  存态("", "改了自己会存,不用点保存");
  画便笺列表();
  画便笺创建日();
  盯便笺底栏();
  装列表拖线();
  绑便笺大窗动作();
  重置撤销队列();
  切卡形态(默认窗形("note"));
  压卡层();
  管焦点(卡罩(), 卡形态 !== "page");
  setTimeout(() => {
    const el = 文档元素();
    const f = el && el.querySelector("[contenteditable]");
    if (f)
      f.focus();
  }, 40);
}
function 装标题栏(值) {
  const ti = document.getElementById("noteTitleIn");
  if (!ti)
    return;
  const v = (值 || "").trim();
  ti.dataset.auto = !v || v === 便笺默认名() || v === 正文第一行() ? "1" : "";
  ti.dataset.k = 编器 && 编器.k || "";
  ti.value = v;
  if (ti.dataset.auto === "1") {
    ti.value = "";
    刷自动标题();
  }
  刷便笺顶栏();
  if (!ti._bd) {
    ti._bd = 1;
    ti.addEventListener("input", () => {
      ti.dataset.auto = ti.value.trim() ? "" : "1";
      刷便笺顶栏();
      排便笺自动存();
    });
    ti.addEventListener("blur", () => {
      if (ti.dataset.auto === "1")
        刷自动标题();
    });
    ti.addEventListener("blur", () => 便笺立刻存());
    ti.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.isComposing)
        return;
      e.preventDefault();
      const el = 文档元素();
      const f = el && el.querySelector("[contenteditable]");
      if (f)
        f.focus();
    });
  }
  装AI拟标题(ti.closest("[data-ai-title-root]"), () => 块转文(块), async (标题) => {
    ti.value = 标题;
    ti.dispatchEvent(new Event("input", { bubbles: true }));
    return await 便笺立刻存() !== false;
  });
}
function 标题值() {
  const ti = document.getElementById("noteTitleIn");
  if (!ti || ti.dataset.auto === "1")
    return "";
  return (ti.value || "").trim().slice(0, 200);
}
function 便笺默认名() {
  const k = 编器 && 编器.k, t = k ? todos.find((x) => x.k === k) : null;
  const m = String(t && t.ctime || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = new Date;
  const 日 = m ? m[1] + m[2] + m[3] : "" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  const 文 = 块.filter((b) => !["img", "file"].includes(b.type || "text")).length ? 块转文(块).replace(/\[(图|文件)\]/g, " ").replace(/\s+/g, " ").trim() : "";
  const 头 = Array.from(文 || 正文第一行()).slice(0, 10).join("").trim();
  return 头 ? 日 + " " + 头 : "";
}
function 刷自动标题() {
  刷便笺顶栏();
  const ti = document.getElementById("noteTitleIn");
  if (!ti || ti.dataset.auto !== "1")
    return;
  if (document.activeElement === ti)
    return;
  ti.value = 便笺默认名();
}
function 刷便笺顶栏() {
  const el = document.getElementById("noteTitle");
  if (!el || 卡宿 !== "note" || !编器)
    return;
  const 名 = 标题值() || 便笺默认名() || "便笺";
  el.textContent = 名;
  el.title = 名;
}
function 画便笺创建日() {
  const el = document.getElementById("noteCtime");
  if (!el)
    return;
  const k = 编器 && 编器.k;
  const t = k ? todos.find((x) => x.k === k) : null;
  const 全 = String(t && t.ctime || "");
  const 日 = 全.slice(0, 10);
  el.hidden = !/^\d{4}-\d{2}-\d{2}$/.test(日);
  el.textContent = el.hidden ? "" : "建于 " + 日;
  el.title = el.hidden ? "" : "创建于 " + 全.slice(0, 16);
  const 号 = document.getElementById("noteIdBox");
  if (!号)
    return;
  const id = k ? 拆K(k).id : null;
  号.hidden = !id;
  号.innerHTML = id ? `<span class="编号">${数据ID(id)}</span><button class="次钮 id-copy" type="button"
    onclick="复制ID(${+id}, this)" title="复制:把 ${数据ID(id)} 复制走" aria-label="复制数据 ID">⧉</button>` : "";
}
function 刷便笺大窗动作() {
  const 归 = document.querySelector("#noteBox [data-note-archive]");
  const 转 = document.querySelector("#noteBox [data-note-to-todo]");
  const k = 正文落点(), cur = k ? todos.find((x) => x.k === k) : null;
  const 已归 = cur ? +cur.archived : +(当前详情数据 && 当前详情数据.待办 && 当前详情数据.待办.归档 || 0);
  if (归)
    归.textContent = 已归 ? "取消归档" : "归档便笺";
  if (转)
    转.disabled = !k;
}
function 绑便笺大窗动作() {
  const 归 = document.querySelector("#noteBox [data-note-archive]");
  const 转 = document.querySelector("#noteBox [data-note-to-todo]");
  if (归 && !归._bd) {
    归._bd = 1;
    归.addEventListener("click", async () => {
      if (await 便笺立刻存() === false)
        return;
      const k = 正文落点();
      if (!k) {
        toast("先写一点内容,便笺建出来后才能归档", true);
        return;
      }
      const cur = todos.find((x) => x.k === k);
      const 已归 = cur ? +cur.archived : +(当前详情数据 && 当前详情数据.待办 && 当前详情数据.待办.归档 || 0);
      const 到 = !已归;
      if (到 && !await UI确认({ 题: "归档这张便笺?", 说: `它会从便笺列表里收起来,一个字不删;
勾上「显示归档」随时看回来。`, 钮字: "归档", 危: false }))
        return;
      const one = 拆K(k);
      const r = await postJSON("/api/todo/archive", { ids: [{ 来源: one.来源, id: one.id }], 归档: 到 ? 1 : 0 });
      if (!r || !r.ok) {
        toast(r && r.error || "归档失败", true);
        return;
      }
      if (当前详情数据 && 当前详情数据.待办)
        当前详情数据.待办.归档 = 到 ? 1 : 0;
      toast(到 ? "便笺已归档" : "便笺已恢复");
      await loadList();
      刷便笺大窗动作();
      画便笺列表();
    });
  }
  if (转 && !转._bd) {
    转._bd = 1;
    转.addEventListener("click", async () => {
      if (await 便笺立刻存() === false)
        return;
      const k = 正文落点();
      if (!k) {
        toast("先写一点内容,便笺建出来后才能转成待办", true);
        return;
      }
      if (!await 转成待办(k))
        return;
      const 整页便笺 = 卡形态 === "page";
      closeCard();
      if (整页便笺) {
        主视图 = "home";
        await openDetail(k, true);
      } else
        await openTodo(k);
    });
  }
  刷便笺大窗动作();
}
function 画便笺关联() {
  if (卡宿 !== "note")
    return;
  if (暂存态()) {
    画卡关联();
    return;
  }
  const box = 编器根().querySelector("[data-cardlinks]");
  if (!box)
    return;
  const cur = todos.find((x) => x.k === 正文落点()) || { links: [] };
  box.innerHTML = (cur.links || []).map((l) => 关联chipHTML(l, cur.src)).join("") || '<span class="emptyline" style="padding:0">还没挂关联数据</span>';
  box.querySelectorAll("[data-dellink]").forEach((x) => x.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!await UI确认({ 题: "移除这个关联?", 说: "只拆掉这条待办和它的挂钩,挂的那个东西本身不动。", 钮字: "移除关联" }))
      return;
    const r = await postJSON("/api/todo/link/del", { 来源: 拆K(正文落点()).来源, id: +x.dataset.dellink });
    if (!r || !r.ok) {
      toast(r && r.error || "移除失败", true);
      return;
    }
    await loadList();
    画便笺关联();
    推撤销快照();
  }));
}
const 便笺展KEY = "todo.便笺.列表展开";
const 便笺折叠露 = 5;
try {
  localStorage.removeItem("todo.便笺.钉住");
} catch {}
async function 切钉(k) {
  const t = todos.find((x) => x.k === k);
  if (!t)
    return;
  const 到 = t.pin ? 0 : 1;
  t.pin = 到;
  画便笺列表();
  const { r, 最新 } = await 排同字段写(k, "钉住", 到);
  if (!最新)
    return;
  if (!r || !r.ok) {
    toast(r && r.error || "没存上,这下钉不住", true);
    await loadList();
  }
}
function 便笺们() {
  return todos.filter((t) => t.form === "便笺" && !t.pk).sort((a, b) => {
    const pa = a.pin ? 1 : 0, pb = b.pin ? 1 : 0;
    if (pa !== pb)
      return pb - pa;
    return String(b.mtime || b.ctime || "").localeCompare(String(a.mtime || a.ctime || ""));
  }).slice(0, 20);
}
function 画便笺列表() {
  const box = document.getElementById("noteTabs");
  if (!box)
    return;
  const 整页 = !!box.closest("#cardPage");
  const 展 = 整页 || localStorage.getItem(便笺展KEY) === "1";
  const 全 = 便笺们(), 此 = 正文落点();
  let 非钉 = 0, 藏 = 0;
  const 片 = 全.map((t) => {
    const p = !!t.pin;
    if (!展 && !p) {
      非钉++;
      if (非钉 > 便笺折叠露) {
        藏++;
        return "";
      }
    }
    const 名 = t.matter || "(空便笺)";
    return `<span class="ntab${t.k === 此 ? " on" : ""}${p ? " pin" : ""}" data-notek="${esc(t.k)}"
      title="${esc(名)}(${数据ID(t.id)} · 最近改于 ${esc((t.mtime || t.ctime || "").slice(0, 16))})&#10;点一下在这个窗里接着改它"
      ><span class="nt">${esc(名)}</span><span class="np" data-pink="${esc(t.k)}"
      title="${p ? "取消钉住:不再排在最前面(手机和别的电脑上也跟着取消)" : "钉住:一直排在最前面,收起来的时候也看得见(手机和别的电脑上也一样)"}"><svg class="线标" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l-1 5 3 3H7l3-3-1-5z"/><path d="M12 12v8"/></svg></span></span>`;
  }).join("");
  const 更多 = !整页 && (藏 || 展) ? `<button class="ntmore" data-notemore title="${展 ? "收起来:只留最近 5 条和钉住的" : "展开:把最近写过的都列出来(最多 20 条)"}">${展 ? "收起 ▴" : `还有 ${藏} 条 ▾`}</button>` : "";
  box.innerHTML = 片 + 更多;
  box.querySelectorAll("[data-notek]").forEach((el) => el.addEventListener("click", (e) => {
    if (e.target.closest("[data-pink]"))
      return;
    if (el.dataset.notek === 正文落点())
      return;
    保存便笺再走(() => openNote(el.dataset.notek));
  }));
  box.querySelectorAll("[data-pink]").forEach((el) => el.addEventListener("click", (e) => {
    e.stopPropagation();
    切钉(el.dataset.pink);
  }));
  const more = box.querySelector("[data-notemore]");
  if (more)
    more.addEventListener("click", () => {
      try {
        localStorage.setItem(便笺展KEY, 展 ? "0" : "1");
      } catch {}
      画便笺列表();
    });
}
const 找 = { 词: "", 中: [], 当前: -1, T: 0, 范围: "本", 全中: [], 全当前: -1 };
const 能高亮 = typeof CSS !== "undefined" && !!CSS.highlights && typeof Highlight === "function";
function 便笺开着() {
  const box = document.getElementById("noteBox");
  return 卡宿 === "note" && !!编器 && !!box && box.getClientRects().length > 0;
}
function 算命中() {
  找.中 = [];
  const doc = document.querySelector("#noteBox [data-doc]");
  const 词 = 找.词.toLowerCase();
  if (doc && 词) {
    const w = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT, { acceptNode: (n) => {
      const p = n.parentElement;
      return p && p.closest(".bbody") && !p.closest(".imbar,.imw") && p.getClientRects().length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    } });
    for (let n = w.nextNode();n; n = w.nextNode()) {
      const 文 = n.data.toLowerCase();
      for (let i = 文.indexOf(词);i >= 0; i = 文.indexOf(词, i + 词.length)) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 词.length);
        找.中.push(r);
      }
    }
  }
  找.当前 = 找.中.length ? Math.min(Math.max(找.当前, 0), 找.中.length - 1) : -1;
}
function 画命中(滚) {
  if (!能高亮)
    return;
  CSS.highlights.set("note-find", new Highlight(...找.中.filter((_, i) => i !== 找.当前)));
  const 此 = 找.中[找.当前];
  if (此)
    CSS.highlights.set("note-find-cur", new Highlight(此));
  else
    CSS.highlights.delete("note-find-cur");
  const cnt = document.getElementById("noteFindCnt");
  if (cnt)
    cnt.textContent = !找.词 ? "" : 找.中.length ? `${找.当前 + 1}/${找.中.length}` : "无结果";
  if (滚 && 此)
    此.startContainer.parentElement.scrollIntoView({ block: "center" });
}
function 搜便笺(词) {
  找.词 = 词 || "";
  找.当前 = 0;
  if (找.范围 === "全")
    return 搜全部便笺(找.词);
  算命中();
  画命中(true);
}
function 便笺现字() {
  return [...document.querySelectorAll("#noteBox [data-doc] .bbody")].map((el) => el.innerText || "").join(`
`);
}
function 命中句(文, i, n) {
  const 头 = 文.lastIndexOf(`
`, i - 1) + 1, 尾0 = 文.indexOf(`
`, i + n), 尾 = 尾0 < 0 ? 文.length : 尾0;
  const 起 = Math.max(头, i - 18), 止 = Math.min(尾, Math.max(i + n + 30, 起 + 48));
  return { 前: (起 > 头 ? "…" : "") + 文.slice(起, i), 中: 文.slice(i, i + n), 后: 文.slice(i + n, 止) + (止 < 尾 ? "…" : "") };
}
function 搜全部便笺(词) {
  const 框 = document.getElementById("noteFindHits"), cnt = document.getElementById("noteFindCnt");
  if (能高亮) {
    CSS.highlights.delete("note-find");
    CSS.highlights.delete("note-find-cur");
  }
  const q = 词.trim().toLowerCase(), 此 = 正文落点();
  找.全中 = [];
  找.全当前 = -1;
  if (q) {
    for (const t of todos) {
      if (t.form !== "便笺" || t.pk)
        continue;
      const 名 = t.matter || "(空便笺)", 文 = t.k === 此 ? 便笺现字() : t.detail || "";
      const i = 文.toLowerCase().indexOf(q);
      if (i < 0 && !名.toLowerCase().includes(q))
        continue;
      找.全中.push({ k: t.k, 名, 此: t.k === 此, pin: !!t.pin, 时: String(t.mtime || t.ctime || ""), 句: i >= 0 ? 命中句(文, i, q.length) : null });
    }
    找.全中.sort((a, b) => +b.pin - +a.pin || b.时.localeCompare(a.时));
    if (找.全中.length)
      找.全当前 = 0;
  }
  if (cnt)
    cnt.textContent = !q ? "" : 找.全中.length ? `${找.全中.length} 张` : "无结果";
  if (!框)
    return;
  框.hidden = !q;
  框.innerHTML = !q ? "" : !找.全中.length ? '<div class="notefind-无">所有便笺里都没有这个词</div>' : 找.全中.map((x, j) => `<button type="button" class="notefind-hit${j === 找.全当前 ? " cur" : ""}" role="option" data-hit="${j}"
        title="打开「${esc(x.名)}」,跳到第一处命中"><b>${esc(x.名)}${x.此 ? " <em>· 正开着</em>" : ""}</b><span>${x.句 ? `${esc(x.句.前)}<mark>${esc(x.句.中)}</mark>${esc(x.句.后)}` : "<em>(标题里有,正文里没有)</em>"}</span></button>`).join("");
}
function 跳全部命中(方向) {
  if (!找.全中.length)
    return;
  找.全当前 = (找.全当前 + 方向 + 找.全中.length) % 找.全中.length;
  document.querySelectorAll("#noteFindHits .notefind-hit").forEach((b, j) => b.classList.toggle("cur", j === 找.全当前));
  document.querySelector("#noteFindHits .notefind-hit.cur")?.scrollIntoView({ block: "nearest" });
}
function 设搜索范围(范) {
  找.范围 = 范 === "全" ? "全" : "本";
  const 选 = document.getElementById("noteFindScope"), 入 = document.getElementById("noteFindIn"), 框 = document.getElementById("noteFindHits");
  if (选)
    选.value = 找.范围;
  if (入) {
    入.placeholder = 找.范围 === "全" ? "搜索全部便笺…" : "搜索本便笺…";
    入.setAttribute("aria-label", 找.范围 === "全" ? "在所有便笺的标题和正文里查找" : "在这张便笺的正文里查找");
  }
  if (框 && 找.范围 === "本") {
    框.hidden = true;
    框.innerHTML = "";
  }
}
function 开全部命中(j) {
  const 项 = 找.全中[j];
  if (!项)
    return;
  const 词 = document.getElementById("noteFindIn")?.value || "";
  const 回本 = () => {
    设搜索范围("本");
    开便笺搜索(词);
  };
  if (项.此)
    return 回本();
  保存便笺再走(async () => {
    await openNote(项.k);
    if (正文落点() === 项.k)
      回本();
  });
}
function 跳命中(方向) {
  if (找.范围 === "全")
    return 跳全部命中(方向);
  if (!找.中.length)
    return;
  找.当前 = (找.当前 + 方向 + 找.中.length) % 找.中.length;
  画命中(true);
}
function 快搜清钮(框) {
  const 清 = 框.closest(".快搜")?.querySelector(".快搜-清");
  if (清)
    清.hidden = !框.value;
}
window.addEventListener("keydown", (e) => {
  if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey)
    return;
  const 在 = document.activeElement;
  if (在 && (在.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(在.tagName)))
    return;
  if (!(window.UI叠层 && UI叠层.深度() > 0))
    return;
  e.stopPropagation();
  const 入 = document.getElementById("noteFindIn");
  if (入 && 入.offsetParent !== null) {
    e.preventDefault();
    入.focus();
    入.select();
  }
}, true);
function 开便笺搜索(预设词) {
  const bar = document.getElementById("noteFind"), 入 = document.getElementById("noteFindIn");
  if (!bar || !入)
    return;
  if (两栏.开) {
    关两栏();
    排便笺自动存(0);
  }
  const 选 = typeof 预设词 === "string" ? 预设词 : String(getSelection() || "");
  if (选 && 选.length <= 100 && !选.includes(`
`)) {
    入.value = 选;
    快搜清钮(入);
  }
  const 行 = bar.closest(".notetitle-row"), 标 = 行 && 行.querySelector("input.notetitle");
  if (bar.hidden) {
    设搜索范围("本");
    const 高 = 标 && 标.offsetHeight;
    bar.style.height = 高 ? 高 + "px" : "";
  }
  if (行)
    行.classList.add("找中");
  bar.hidden = false;
  入.focus();
  入.select();
  搜便笺(入.value);
}
function 关便笺搜索(回正文, 清词) {
  const bar = document.getElementById("noteFind");
  if (!bar)
    return;
  const 开着 = !bar.hidden;
  bar.hidden = true;
  bar.closest(".notetitle-row")?.classList.remove("找中");
  设搜索范围("本");
  找.词 = "";
  找.中 = [];
  找.当前 = -1;
  找.全中 = [];
  找.全当前 = -1;
  if (能高亮) {
    CSS.highlights.delete("note-find");
    CSS.highlights.delete("note-find-cur");
  }
  const cnt = document.getElementById("noteFindCnt");
  if (cnt)
    cnt.textContent = "";
  if (清词) {
    const 入 = document.getElementById("noteFindIn");
    if (入) {
      入.value = "";
      快搜清钮(入);
    }
  }
  if (回正文 && 开着)
    document.querySelector('#noteBox [data-doc] [contenteditable="true"]')?.focus();
}
document.getElementById("noteNewBtn")?.addEventListener("click", () => 保存便笺再走(() => openNote()));
(function 装便笺搜索() {
  const box = document.getElementById("noteBox"), bar = document.getElementById("noteFind");
  const 入 = document.getElementById("noteFindIn"), 钮 = document.getElementById("noteFindBtn");
  if (!box || !bar || !入 || !能高亮)
    return;
  if (钮) {
    钮.hidden = false;
    钮.addEventListener("click", 开便笺搜索);
  }
  入.addEventListener("input", () => 搜便笺(入.value));
  document.getElementById("noteFindScope")?.addEventListener("change", (e) => {
    设搜索范围(e.target.value);
    if (找.范围 === "本")
      找.全中 = [];
    搜便笺(入.value);
    入.focus();
  });
  document.getElementById("noteFindHits")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-hit]");
    if (b)
      开全部命中(+b.dataset.hit);
  });
  入.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && 找.范围 === "全") {
      e.preventDefault();
      开全部命中(找.全当前);
    } else if (e.key === "ArrowDown" && 找.范围 === "全") {
      e.preventDefault();
      跳全部命中(1);
    } else if (e.key === "ArrowUp" && 找.范围 === "全") {
      e.preventDefault();
      跳全部命中(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      跳命中(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      关便笺搜索(true);
    }
  });
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("[data-find]");
    if (!b)
      return;
    if (b.dataset.find === "x")
      关便笺搜索(true);
    else
      跳命中(+b.dataset.find);
  });
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key !== "f" && e.key !== "F")
      return;
    if (!便笺开着())
      return;
    e.preventDefault();
    开便笺搜索();
  });
  new MutationObserver((ms) => {
    if (!找.词 || 找.范围 === "全" || ms.every((m) => (m.target.parentElement || m.target).closest?.("#noteFind")))
      return;
    clearTimeout(找.T);
    找.T = setTimeout(() => {
      算命中();
      画命中(false);
    }, 120);
  }).observe(box, { subtree: true, childList: true, characterData: true });
})();
const 便笺列表高KEY = "todo.便笺.列表高";
const 列表高下限 = 34, 列表高上限 = 240;
let 便笺列表高 = 0;
function 读列表高() {
  let v = 0;
  try {
    v = +(localStorage.getItem(便笺列表高KEY) || 0);
  } catch {}
  return v ? Math.min(列表高上限, Math.max(列表高下限, v)) : 0;
}
function 落列表高(px) {
  便笺列表高 = Math.min(列表高上限, Math.max(列表高下限, Math.round(px)));
  const box = document.getElementById("noteTabs");
  if (box)
    box.style.setProperty("--ntabs-h", 便笺列表高 + "px");
  const bar = document.getElementById("noteTabsResize");
  if (bar)
    bar.setAttribute("aria-valuenow", String(便笺列表高));
  try {
    localStorage.setItem(便笺列表高KEY, String(便笺列表高));
  } catch {}
}
function 复原列表高() {
  便笺列表高 = 0;
  document.getElementById("noteTabs")?.style.removeProperty("--ntabs-h");
  document.getElementById("noteTabsResize")?.removeAttribute("aria-valuenow");
  try {
    localStorage.removeItem(便笺列表高KEY);
  } catch {}
}
function 装列表拖线() {
  const bar = document.getElementById("noteTabsResize");
  if (!bar)
    return;
  const 存过 = 读列表高();
  if (存过)
    落列表高(存过);
  if (bar._bd)
    return;
  bar._bd = 1;
  bar.setAttribute("aria-valuemin", String(列表高下限));
  bar.setAttribute("aria-valuemax", String(列表高上限));
  bar.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const box = document.getElementById("noteTabs");
    const 缩 = 壳缩(), 起y = e.clientY, 起高 = box ? box.getBoundingClientRect().height / 缩 : 便笺列表高 || 44;
    try {
      bar.setPointerCapture(e.pointerId);
    } catch (_) {}
    const move = (ev) => 落列表高(起高 + (ev.clientY - 起y) / 缩);
    const up = () => {
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
  });
  bar.addEventListener("dblclick", 复原列表高);
  bar.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowDown" ? 16 : e.key === "ArrowUp" ? -16 : 0;
    if (!d)
      return;
    e.preventDefault();
    const box2 = document.getElementById("noteTabs");
    落列表高((便笺列表高 || (box2 ? box2.getBoundingClientRect().height / 壳缩() : 44)) + d);
  });
}
function 壳缩() {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--壳缩"));
  return v > 0 ? v : 1;
}
let 盯提示位 = null;
function 盯便笺底栏() {
  const 栏 = document.querySelector("#noteBox .notefoot");
  if (!栏 || 盯提示位 || typeof ResizeObserver !== "function")
    return;
  const 量 = () => document.documentElement.style.setProperty("--便笺底栏高", Math.max(0, Math.round((innerHeight - 栏.getBoundingClientRect().top) / 壳缩())) + "px");
  盯提示位 = new ResizeObserver(量);
  盯提示位.observe(栏);
  盯提示位.observe(document.getElementById("noteBox"));
  addEventListener("resize", 量);
  量();
}
const 外观KEY = "ui:便笺外观", 底图KEY = "ui:便笺底图";
const 外观字体 = {
  yahei: '"Microsoft YaHei", "PingFang SC", sans-serif',
  mono: '"JetBrains Mono", "Cascadia Code", Consolas, "Microsoft YaHei", monospace',
  song: '"Songti SC", SimSun, "宋体", serif',
  kai: '"Kaiti SC", KaiTi, "楷体", serif'
};
const AA门槛 = 4.5;
const 图浓度上限 = 1;
const 图铺法表 = { fill: null, fit: ["contain", "no-repeat"], stretch: ["100% 100%", "no-repeat"], tile: ["auto", "repeat"], center: ["auto", "no-repeat"] };
const 图对齐表 = ["center", "top", "bottom", "left", "right"];
const 对齐用得上 = (法) => 法 === "fill" || 法 === "fit";
const 外观变量 = [
  "--bg",
  "--面",
  "--面2",
  "--surface",
  "--surface-2",
  "--字",
  "--text",
  "--次",
  "--muted",
  "--弱",
  "--faint",
  "--蓝",
  "--accent",
  "--蓝浅",
  "--accent-soft",
  "--蓝深",
  "--边",
  "--border-strong",
  "--线",
  "--border",
  "--便笺边宽",
  "--便笺透",
  "--便笺标题栏",
  "--便笺标题栏字",
  "--便笺标题栏次",
  "--便笺当前签",
  "--便笺当前签字",
  "--便笺字体",
  "--便笺羽化",
  "--便笺圆角"
];
const 夹图浓度 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" && v != null ? Math.min(图浓度上限, Math.max(0, Math.round(n * 100) / 100)) : 0.15;
};
function 读外观() {
  let a = null;
  try {
    a = JSON.parse(localStorage.getItem(外观KEY) || "null");
  } catch {}
  a = a && typeof a === "object" ? a : {};
  return {
    当前: String(a.当前 || ""),
    内置改: a.内置改 && typeof a.内置改 === "object" ? a.内置改 : {},
    自定义: Array.isArray(a.自定义) ? a.自定义.filter((t) => t && t.id && 主题序.includes(t.底) && t.色) : [],
    图浓度: 夹图浓度(a.图浓度),
    图铺法: Object.hasOwn(图铺法表, a.图铺法) ? a.图铺法 : "fill",
    图对齐: 图对齐表.includes(a.图对齐) ? a.图对齐 : "center"
  };
}
function 存外观() {
  try {
    localStorage.setItem(外观KEY, JSON.stringify(外观));
    return true;
  } catch (e) {
    toast("外观没存上:这台机器的浏览器存储满了或被关了", true, { 报错: String(e && e.message || e), 位置: "便笺外观 · 存设置" });
    return false;
  }
}
function 读底图() {
  try {
    const v = JSON.parse(localStorage.getItem(底图KEY) || "null");
    return v && v.址 ? v : null;
  } catch {
    return null;
  }
}
let 外观 = 读外观();
let 底图 = 读底图();
let 外观草稿 = null;
let 外观开前 = null;
let 外观缩放钟 = 0;
const 是内置主题 = (id) => 主题序.includes(id);
const 找自定义 = (id) => 外观.自定义.find((t) => t.id === id);
const 主题底 = (id) => 是内置主题(id) ? id : (找自定义(id) || {}).底;
let 转色板 = null;
function 转hex(v) {
  转色板 = 转色板 || document.createElement("canvas").getContext("2d");
  转色板.fillStyle = "#000000";
  转色板.fillStyle = String(v || "").trim() || "#000000";
  const f = 转色板.fillStyle;
  if (f[0] === "#")
    return f;
  const m = f.match(/[\d.]+/g);
  return m ? "#" + m.slice(0, 3).map((x) => Math.round(+x).toString(16).padStart(2, "0")).join("") : "#000000";
}
const hex转rgb = (h) => {
  const n = parseInt(String(h).slice(1), 16) || 0;
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
const 透色 = (h, a) => `rgba(${hex转rgb(h).join(", ")}, ${a})`;
const 混色 = (a, p, b) => `color-mix(in srgb, ${a} ${p}%, ${b})`;
function 相对亮度(rgb) {
  const s = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}
function 对比度(a, b) {
  const l1 = 相对亮度(a), l2 = 相对亮度(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function 最差对比(bg, tx, p) {
  const 底 = hex转rgb(bg), 字 = hex转rgb(tx), 叠 = (图) => 底.map((v, i) => (1 - p) * v + p * 图[i]);
  const 白 = 对比度(叠([255, 255, 255]), 字), 黑 = 对比度(叠([0, 0, 0]), 字);
  return 白 <= 黑 ? { 比: 白, 处: "白" } : { 比: 黑, 处: "黑" };
}
function 保AA最大浓度(bg, tx) {
  let 最 = 0;
  for (let i = 0;i <= 图浓度上限 * 100; i++) {
    if (最差对比(bg, tx, i / 100).比 >= AA门槛)
      最 = i / 100;
    else
      break;
  }
  return 最;
}
function 内置底色() {
  const s = getComputedStyle(document.documentElement), 取 = (n) => 转hex(s.getPropertyValue(n));
  return {
    bg: 取("--bg"),
    text: 取("--text"),
    accent: 取("--蓝"),
    border: 取("--边"),
    dragBar: 取("--surface"),
    tabActive: 取("--蓝"),
    tabText: "",
    bgOpacity: 1,
    borderOpacity: 1,
    borderW: 1,
    borderFeather: 0,
    radius: 0,
    font: "system"
  };
}
function 主题色(id) {
  const 基 = 内置底色();
  if (是内置主题(id))
    return { ...基, ...外观.内置改[id] || {} };
  const 自 = 找自定义(id);
  return { ...基, ...自 ? 自.色 : {} };
}
function 签两色(tk) {
  if (String(tk.tabActive).toLowerCase() !== String(内置底色().tabActive).toLowerCase()) {
    const 签 = hex转rgb(tk.tabActive);
    return { 底: tk.tabActive, 自动: 对比度(签, hex转rgb(tk.bg)) >= 对比度(签, hex转rgb(tk.text)) ? tk.bg : tk.text };
  }
  const box = document.getElementById("noteBox"), s = getComputedStyle(box || document.documentElement);
  return { 底: 转hex(s.getPropertyValue("--蓝")), 自动: 转hex(s.getPropertyValue("--反字")) };
}
function 生效主题() {
  const 底 = 现在主题(), 自 = 找自定义(外观.当前);
  return 自 && 自.底 === 底 ? 自.id : 底;
}
function 设主题底(v) {
  const r = document.documentElement;
  if (v)
    r.setAttribute("data-theme", v);
  else
    r.removeAttribute("data-theme");
  同步主题钮();
}
function 套色(tk) {
  const box = document.getElementById("noteBox");
  if (!box)
    return;
  const st = box.style, 基 = 内置底色(), 设 = (n, v) => st.setProperty(n, v);
  外观变量.forEach((n) => st.removeProperty(n));
  const 改 = (k) => tk[k] != null && String(tk[k]).toLowerCase() !== String(基[k]).toLowerCase();
  if (改("bg") || 改("text")) {
    设("--bg", tk.bg);
    设("--面", 混色(tk.text, 6, tk.bg));
    设("--面2", 混色(tk.text, 10, tk.bg));
    设("--surface", "var(--面)");
    设("--surface-2", "var(--面2)");
    设("--字", tk.text);
    设("--text", tk.text);
    设("--次", 混色(tk.text, 72, tk.bg));
    设("--muted", "var(--次)");
    设("--弱", 混色(tk.text, 62, tk.bg));
    设("--faint", "var(--弱)");
  }
  if (改("accent") || 改("bg")) {
    设("--蓝", tk.accent);
    设("--accent", "var(--蓝)");
    设("--蓝浅", 混色(tk.accent, 14, tk.bg));
    设("--accent-soft", "var(--蓝浅)");
    设("--蓝深", 混色(tk.accent, 80, tk.text));
  }
  const 边改 = 改("border") || 改("borderOpacity") || 改("borderW");
  if (边改 || 改("bg")) {
    const 边 = 透色(tk.border, tk.borderOpacity);
    设("--边", 边);
    设("--border-strong", "var(--边)");
    设("--线", 混色(边, 55, tk.bg));
    设("--border", "var(--线)");
  }
  if (边改)
    设("--便笺边宽", tk.borderW + "px");
  box.classList.toggle("外观边", 边改);
  const 透 = 改("bgOpacity");
  if (透)
    设("--便笺透", Math.round(tk.bgOpacity * 100) + "%");
  box.classList.toggle("外观底透", 透);
  if (改("borderFeather"))
    设("--便笺羽化", tk.borderFeather + "px");
  box.classList.toggle("外观羽化", 改("borderFeather"));
  if (改("radius"))
    设("--便笺圆角", tk.radius + "px");
  box.classList.toggle("外观圆角", 改("radius"));
  document.documentElement.classList.toggle("窗透明", 透 && tk.bgOpacity < 1 || tk.borderOpacity < 1 && tk.borderW > 0 || 改("radius"));
  box.classList.toggle("外观栏", 改("dragBar"));
  if (改("dragBar")) {
    设("--便笺标题栏", tk.dragBar);
    const 栏 = hex转rgb(tk.dragBar), 够 = (c) => 对比度(栏, hex转rgb(c)) >= AA门槛;
    const 字 = 够(tk.text) ? tk.text : 够(tk.bg) ? tk.bg : 对比度(栏, [0, 0, 0]) >= 对比度(栏, [255, 255, 255]) ? "#000000" : "#ffffff";
    const 浅 = "#" + hex转rgb(字).map((v, i) => Math.round(v * 0.8 + 栏[i] * 0.2).toString(16).padStart(2, "0")).join("");
    设("--便笺标题栏字", 字);
    设("--便笺标题栏次", 够(浅) ? 浅 : 字);
  }
  box.classList.toggle("外观签", 改("tabActive"));
  box.classList.toggle("外观签字", 改("tabText"));
  if (改("tabActive"))
    设("--便笺当前签", tk.tabActive);
  if (改("tabActive") || 改("tabText"))
    设("--便笺当前签字", tk.tabText || 签两色(tk).自动);
  box.classList.toggle("外观字", !!外观字体[tk.font]);
  if (外观字体[tk.font])
    设("--便笺字体", 外观字体[tk.font]);
  套底图(tk);
  if (透)
    盯底栏高(box);
}
let 盯底栏 = null;
function 盯底栏高(box) {
  const 栏 = box.querySelector(".notefoot");
  if (!栏)
    return;
  const 量 = () => box.style.setProperty("--便笺底栏高", 栏.offsetHeight + "px");
  量();
  if (盯底栏 || typeof ResizeObserver !== "function")
    return;
  盯底栏 = new ResizeObserver(量);
  盯底栏.observe(栏);
}
function 套底图(tk) {
  const box = document.getElementById("noteBox");
  if (!box)
    return;
  box.classList.toggle("有底图", !!底图);
  const 铺 = 底图 && 图铺法表[外观.图铺法];
  if (铺) {
    box.style.setProperty("--便笺图尺寸", 铺[0]);
    box.style.setProperty("--便笺图铺", 铺[1]);
  } else {
    box.style.removeProperty("--便笺图尺寸");
    box.style.removeProperty("--便笺图铺");
  }
  if (底图 && 对齐用得上(外观.图铺法) && 外观.图对齐 !== "center")
    box.style.setProperty("--便笺图位", 外观.图对齐);
  else
    box.style.removeProperty("--便笺图位");
  if (!底图) {
    box.style.removeProperty("--便笺底图");
    box.style.removeProperty("--便笺图罩");
    return;
  }
  box.style.setProperty("--便笺底图", `url("${底图.址}")`);
  box.style.setProperty("--便笺图罩", 透色((tk || 主题色(生效主题())).bg, 1 - 外观.图浓度));
}
function 套外观() {
  套色(外观草稿 ? 外观草稿.tk : 主题色(生效主题()));
}
new MutationObserver(() => {
  if (外观草稿)
    return;
  const 自 = 找自定义(外观.当前);
  if (自 && 自.底 !== 现在主题()) {
    外观.当前 = 现在主题();
    存外观();
  }
  套外观();
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
const 外观框 = () => document.getElementById("noteLook");
const 外观控件 = () => document.querySelectorAll("#noteLook [data-tk]");
function 填主题下拉() {
  const sel = document.getElementById("lkTheme");
  sel.innerHTML = "";
  const 加 = (v, 字) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = 字;
    sel.appendChild(o);
  };
  主题序.forEach((id) => 加(id, 主题叫[id] + "(内置)"));
  外观.自定义.forEach((t) => 加(t.id, t.名));
  sel.value = 外观草稿.id;
  const 内 = 是内置主题(外观草稿.id);
  document.getElementById("lkReset").disabled = !内;
  document.getElementById("lkDelete").disabled = 内;
}
function 填外观控件(tk) {
  外观控件().forEach((el) => {
    const k = el.dataset.tk;
    el.value = el.type === "range" && /Opacity$/.test(k) ? Math.round(tk[k] * 100) : tk[k];
  });
  刷外观读数(tk);
}
function 读外观控件() {
  const tk = { ...外观草稿.tk };
  外观控件().forEach((el) => {
    const k = el.dataset.tk;
    tk[k] = el.type === "range" ? /Opacity$/.test(k) ? +el.value / 100 : +el.value : el.dataset.auto ? "" : el.value;
  });
  return tk;
}
function 刷外观读数(tk) {
  document.querySelectorAll("#noteLook [data-val]").forEach((el) => {
    const k = el.dataset.val;
    el.textContent = /Opacity$/.test(k) ? Math.round(tk[k] * 100) + "%" : k === "borderW" ? (+tk[k]).toFixed(1) + "px" : tk[k] + "px";
  });
  const 签字格 = document.querySelector('#noteLook [data-tk="tabText"]');
  if (签字格) {
    签字格.dataset.auto = tk.tabText ? "" : "1";
    if (!tk.tabText)
      签字格.value = 签两色(tk).自动;
  }
  刷对比(tk);
}
function 屏上字色(tk) {
  const box = document.getElementById("noteBox");
  if (!box)
    return tk.text;
  return 转hex(getComputedStyle(box.querySelector("[data-doc] .bk-text .btext") || box).color);
}
function 刷对比(tk) {
  const el = document.getElementById("lkContrast");
  if (!el)
    return;
  const 签 = 签两色(tk), 签对 = 对比度(hex转rgb(签.底), hex转rgb(tk.tabText || 签.自动)), 签比 = Math.round(签对 * 10) / 10, 签警 = 签对 < AA门槛;
  tk = { ...tk, text: 屏上字色(tk) };
  let 字, 长, 警;
  if (底图) {
    const w = 最差对比(tk.bg, tk.text, 外观.图浓度), 比 = Math.round(w.比 * 10) / 10;
    警 = w.比 < AA门槛;
    const 顶 = Math.round(保AA最大浓度(tk.bg, tk.text) * 100);
    字 = 警 ? `⚠ 最差 ${比}:1,浓度建议 ≤ ${顶}%` : `最差 ${比}:1 · 过 AA`;
    长 = `正文字色压在「背景色 + 背景图」上,最差处(图片纯${w.处}的地方)对比 ${比}:1;WCAG AA 正文门槛 ${AA门槛}:1。` + (警 ? `图片浓度调到 ${顶}% 以下才过。` : "");
  } else {
    const 比 = Math.round(对比度(hex转rgb(tk.bg), hex转rgb(tk.text)) * 10) / 10;
    警 = 比 < AA门槛;
    字 = 警 ? `⚠ ${比}:1,低于 AA ${AA门槛}:1` : `${比}:1 · 过 AA`;
    长 = `屏上正文的字色压在背景色上对比 ${比}:1;WCAG AA 正文门槛 ${AA门槛}:1。没设背景图,对比度只由这两个颜色决定。`;
  }
  if (签警)
    字 = 警 ? `${字.replace(/,.*$/, "").replace(/^⚠ (?!最差)/, "⚠ 正文 ")} · 标签字 ${签比}:1` : `⚠ 标签字 ${签比}:1,低于 AA ${AA门槛}:1`;
  长 += `上排当前标签的字压在标签底色上对比 ${签比}:1` + (签警 ? `,低于 ${AA门槛}:1 —— 「标签字色」换深一点或浅一点。` : "。");
  el.textContent = 字;
  el.title = 长;
  el.classList.toggle("警", 警 || 签警);
}
function 刷底图行() {
  document.getElementById("lkBgName").textContent = 底图 ? 底图.名 : "未设置";
  document.getElementById("lkBgClear").disabled = !底图;
  const sl = document.getElementById("lkBgImgOp");
  sl.value = Math.round(外观.图浓度 * 100);
  sl.disabled = !底图;
  document.getElementById("lkBgImgVal").textContent = Math.round(外观.图浓度 * 100) + "%";
  const 铺 = document.getElementById("lkBgFit");
  铺.value = 外观.图铺法;
  铺.disabled = !底图;
  const 齐 = document.getElementById("lkBgAlign");
  齐.value = 外观.图对齐;
  齐.disabled = !底图 || !对齐用得上(外观.图铺法);
  齐.title = !底图 ? "没设背景图时不能选" : 齐.disabled ? "拉伸、平铺、居中用不上对齐;契合度换成填充或适应才能选" : "";
}
function 刷标签区行() {
  const sl = document.getElementById("lkBarH"), 现 = 便笺列表高 || Math.round((document.getElementById("noteTabs")?.getBoundingClientRect().height || 44) / 壳缩());
  sl.value = Math.min(列表高上限, Math.max(列表高下限, 现));
  document.getElementById("lkBarHVal").textContent = 便笺列表高 ? 便笺列表高 + "px" : "自然";
}
const 有壳缩放 = () => typeof window.壳缩放 === "function";
function 刷缩放行(新) {
  const 有 = 有壳缩放();
  document.querySelectorAll("#lkZoomRow [data-zoom]").forEach((b) => {
    b.disabled = !有;
  });
  document.getElementById("lkZoomVal").textContent = 有 ? Math.round((typeof 新 === "number" ? 新 : 壳缩()) * 100) + "%" : "—";
  const 注 = document.getElementById("lkZoomHint");
  注.textContent = 有 ? "也可 Ctrl+滚轮 / Ctrl±" : "浏览器里用 Ctrl+滚轮";
  注.title = 有 ? "" : "整窗缩放要外壳程序支持;在浏览器里开这张页时,用浏览器自带的缩放";
}
function 外观缩放(动作) {
  if (!有壳缩放())
    return;
  let 新;
  try {
    新 = window.壳缩放(动作 === "0" ? "复位" : Math.round((壳缩() + (动作 === "+" ? 0.1 : -0.1)) * 100) / 100);
  } catch (e) {
    toast("缩放没调成:这里没有外壳程序", true, { 报错: String(e && e.message || e), 位置: "便笺外观 · 整窗缩放" });
    return;
  }
  刷缩放行(新);
}
function 开外观() {
  外观 = 读外观();
  外观开前 = document.documentElement.getAttribute("data-theme");
  const id = 生效主题();
  外观草稿 = { id, tk: 主题色(id) };
  填主题下拉();
  填外观控件(外观草稿.tk);
  刷底图行();
  刷标签区行();
  刷缩放行();
  外观框().hidden = false;
  document.getElementById("lkTheme").focus();
  clearInterval(外观缩放钟);
  外观缩放钟 = setInterval(() => {
    if (有壳缩放())
      刷缩放行();
  }, 500);
}
function 关外观() {
  外观框().hidden = true;
  外观草稿 = null;
  clearInterval(外观缩放钟);
  套外观();
  document.getElementById("noteLookBtn")?.focus();
}
function 外观取消() {
  if (外观开前 !== document.documentElement.getAttribute("data-theme"))
    设主题底(外观开前);
  外观 = 读外观();
  关外观();
}
function 外观保存() {
  const { id, tk } = 外观草稿;
  if (是内置主题(id)) {
    const 基 = 内置底色(), 差 = {};
    Object.keys(tk).forEach((k) => {
      if (String(tk[k]).toLowerCase() !== String(基[k]).toLowerCase())
        差[k] = tk[k];
    });
    if (Object.keys(差).length)
      外观.内置改[id] = 差;
    else
      delete 外观.内置改[id];
  } else {
    const 自 = 找自定义(id);
    if (自)
      自.色 = { ...tk };
  }
  外观.当前 = id;
  try {
    localStorage.setItem("ui:主题", 主题底(id));
  } catch {}
  if (存外观())
    关外观();
}
function 外观换主题(id) {
  const 底 = 主题底(id);
  if (!底)
    return;
  设主题底(底);
  外观草稿 = { id, tk: 主题色(id) };
  填主题下拉();
  套色(外观草稿.tk);
  填外观控件(外观草稿.tk);
}
function 外观另存() {
  const 框 = document.getElementById("lkNewName"), 底 = 主题底(外观草稿.id);
  const 名 = 框.value.trim().slice(0, 30) || "自定义 " + (外观.自定义.length + 1);
  const id = "c" + Date.now().toString(36);
  外观.自定义.push({ id, 名, 底, 色: { ...外观草稿.tk } });
  外观.当前 = id;
  if (!存外观()) {
    外观.自定义.pop();
    return;
  }
  try {
    localStorage.setItem("ui:主题", 底);
  } catch {}
  外观开前 = 底;
  外观草稿.id = id;
  框.value = "";
  填主题下拉();
  toast("已另存为「" + 名 + "」");
}
function 外观恢复默认() {
  const id = 外观草稿.id;
  if (!是内置主题(id))
    return;
  delete 外观.内置改[id];
  存外观();
  外观草稿.tk = 内置底色();
  套色(外观草稿.tk);
  填外观控件(外观草稿.tk);
}
function 外观删除() {
  const 自 = 找自定义(外观草稿.id);
  if (!自)
    return;
  外观.自定义 = 外观.自定义.filter((t) => t !== 自);
  外观.当前 = 自.底;
  存外观();
  外观开前 = 自.底;
  外观换主题(自.底);
  toast("已删掉「" + 自.名 + "」");
}
async function 选了底图(f) {
  const 坏 = (句, e) => {
    document.getElementById("lkBgName").textContent = 句;
    toast(句, true, { 报错: String(e && (e.message || e.name) || e || 句), 位置: "便笺外观 · 背景图 · " + f.name });
  };
  if (!/^image\/(png|jpeg|webp|gif|bmp)$/i.test(f.type) && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name))
    return 坏("格式不认:只收 png / jpg / webp / gif / bmp");
  if (f.size > 8 * 1024 * 1024)
    return 坏("图太大:" + (f.size / 1048576).toFixed(1) + "MB,上限 8MB");
  let 址;
  try {
    const 图 = await createImageBitmap(f);
    const 比 = Math.min(1, 1600 / Math.max(图.width, 图.height));
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(图.width * 比));
    cv.height = Math.max(1, Math.round(图.height * 比));
    cv.getContext("2d").drawImage(图, 0, 0, cv.width, cv.height);
    址 = cv.toDataURL("image/webp", 0.82);
    if (!址.startsWith("data:image/webp"))
      址 = cv.toDataURL("image/jpeg", 0.82);
  } catch (e) {
    return 坏("这张图没读出来,换一张试试", e);
  }
  try {
    localStorage.setItem(底图KEY, JSON.stringify({ 名: f.name, 址 }));
  } catch (e) {
    return 坏("图存不下:这台机器的浏览器存储满了", e);
  }
  底图 = { 名: f.name, 址 };
  套外观();
  刷底图行();
  刷对比(外观草稿 ? 外观草稿.tk : 主题色(生效主题()));
}
function 清底图() {
  try {
    localStorage.removeItem(底图KEY);
  } catch {}
  底图 = null;
  套外观();
  刷底图行();
  if (外观草稿)
    刷对比(外观草稿.tk);
}
(function 装外观面板() {
  const 框 = 外观框();
  if (!框)
    return;
  document.getElementById("noteLookBtn")?.addEventListener("click", 开外观);
  document.getElementById("lkTheme").addEventListener("change", (e) => 外观换主题(e.target.value));
  外观控件().forEach((el) => el.addEventListener("input", () => {
    if (el.dataset.auto)
      el.dataset.auto = "";
    外观草稿.tk = 读外观控件();
    套色(外观草稿.tk);
    刷外观读数(外观草稿.tk);
  }));
  框.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => 外观缩放(b.dataset.zoom)));
  document.getElementById("lkBgPick").addEventListener("click", () => document.getElementById("lkBgFile").click());
  document.getElementById("lkBgFile").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (f)
      选了底图(f);
  });
  document.getElementById("lkBgClear").addEventListener("click", 清底图);
  const 浓 = document.getElementById("lkBgImgOp");
  浓.addEventListener("input", () => {
    外观.图浓度 = 夹图浓度(+浓.value / 100);
    document.getElementById("lkBgImgVal").textContent = Math.round(外观.图浓度 * 100) + "%";
    套底图(外观草稿 && 外观草稿.tk);
    刷对比(外观草稿.tk);
  });
  浓.addEventListener("change", 存外观);
  document.getElementById("lkBgFit").addEventListener("change", (e) => {
    外观.图铺法 = e.target.value;
    套底图(外观草稿 && 外观草稿.tk);
    刷底图行();
    存外观();
  });
  document.getElementById("lkBgAlign").addEventListener("change", (e) => {
    外观.图对齐 = e.target.value;
    套底图(外观草稿 && 外观草稿.tk);
    存外观();
  });
  const 高 = document.getElementById("lkBarH");
  高.addEventListener("input", () => {
    落列表高(+高.value);
    刷标签区行();
  });
  document.getElementById("lkBarHAuto").addEventListener("click", () => {
    复原列表高();
    刷标签区行();
  });
  document.getElementById("lkNewName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      外观另存();
    }
  });
  document.getElementById("lkSaveAs").addEventListener("click", 外观另存);
  document.getElementById("lkReset").addEventListener("click", 外观恢复默认);
  document.getElementById("lkDelete").addEventListener("click", 外观删除);
  document.getElementById("lkCancel").addEventListener("click", 外观取消);
  document.getElementById("lkSave").addEventListener("click", 外观保存);
  框.addEventListener("mousedown", (e) => {
    if (e.target === 框)
      外观取消();
  });
  套外观();
})();
const 两栏 = { 开: false, 原块: [], 开时: null, 版: "", T: 0, 挂起: false };
const 两栏拦 = "[data-add],[data-undo],[data-redo],[data-history],[data-ai速记]";
function 两栏开着() {
  return 两栏.开 && 卡宿 === "note" && !!编器;
}
function 两栏源() {
  return encodeURIComponent(正文落点() ? 拆K(正文落点()).来源 : 卡草稿 ? 卡草稿.来源 : 默认源());
}
function 两栏选项() {
  const 图单 = (当前详情数据 || {}).详情图 || [], 见过 = [...两栏.原块, ...块];
  const 图有 = new Set([...图单.map((a) => +a.id), ...见过.filter((b) => b.type === "img" && b.附件id).map((b) => +b.附件id)]);
  const 文有 = new Set([...块文件.map((f) => +f.id), ...见过.filter((b) => b.type === "file" && b.附件id).map((b) => +b.附件id)]);
  const 源 = 两栏源();
  return {
    图址: (id) => 图URL(id),
    文件址: (id) => `/api/todo/file?id=${id}&src=${源}`,
    图名: (id) => (图单.find((a) => +a.id === +id) || {}).原名 || "",
    文件名: (id) => (块文件.find((f) => +f.id === +id) || {}).原名 || "",
    图在: (id) => 图有.has(+id),
    文件在: (id) => 文有.has(+id),
    原块: (两栏.开时 || {}).占 || []
  };
}
function 两栏说(字, 细) {
  const el = document.getElementById("noteMdMsg");
  if (!el)
    return;
  el.textContent = 字 || "";
  el.title = 细 || "";
}
const 两栏常说 = ["停手自己会存", "改完停手 0.3 秒,右边预览跟着变,正文自己存;撤销用 Ctrl+Z。点标题栏「Markdown」切回块编辑"];
function 两栏按报说(报, md) {
  const 没认 = 报.外图 + 报.外文件 + 报.失效占位;
  if (没认)
    return 两栏说(`有 ${没认} 行没认出,当字留着`, `${报.外图 + 报.外文件} 个图 / 文件网址不是这张便笺的,${报.失效占位} 个占位号对不上原来的块 —— 这几行按普通文字存,不会悄悄丢。要插图 / 文件请切回块编辑用底栏的钮`);
  const 占 = (String(md).match(/^[ \t]*<!--\s*占位\s*#\d+/gm) || []).length;
  if (占)
    return 两栏说(`${占} 处占位,回块编辑里改`, "<!-- 占位 #… --> 那几行是日期块、还没存进库的图 / 文件这类 Markdown 写不出来的东西。别改号;整行删掉 = 删掉那一块;切回块编辑原样还原");
  两栏说(...两栏常说);
}
function 同步两栏(强制) {
  if (!两栏开着())
    return;
  clearTimeout(两栏.T);
  两栏.T = 0;
  const ta = document.getElementById("noteMdIn");
  if (!ta)
    return;
  const md = ta.value;
  if (md === 两栏.版) {
    if (两栏.挂起) {
      两栏.挂起 = false;
      两栏说(...两栏常说);
    }
    return;
  }
  if (!强制 && 首次落库中) {
    两栏.T = setTimeout(() => 同步两栏(false), 300);
    return;
  }
  const { 块: 新, 报 } = 块MD.原文回块(md, 两栏.开时, 两栏选项());
  画两栏预览(md);
  const 新图 = new Set(新.filter((b) => b.type === "img" && b.附件id && !b.暂 && !b.待抓).map((b) => +b.附件id));
  if (!强制 && 块.some((b) => b.type === "img" && b.附件id && !b.暂 && !b.待抓 && !新图.has(+b.附件id))) {
    两栏.挂起 = true;
    两栏说("少了已存的图,切回时才算数", "左边删掉(或剪走)了已经存进库的图那一行。存正文时会把没人引用的图删掉,所以先不存这一版:粘回来就接着自动存;切回块编辑或关窗时按左边现在的样子算(那张图就删了)");
    return;
  }
  两栏.挂起 = false;
  const 用过 = new Set;
  报.还原.forEach(([n, nb]) => {
    const o = 两栏.开时.占[n];
    if (!o || 用过.has(o))
      return;
    用过.add(o);
    ["层", "组", "组收起"].forEach((k) => {
      if (k in nb)
        o[k] = nb[k];
      else
        delete o[k];
    });
    新[新.indexOf(nb)] = o;
  });
  块 = 新;
  两栏.版 = md;
  记脏();
  排便笺自动存();
  两栏按报说(报, md);
}
async function 开两栏() {
  if (两栏.开 || 卡宿 !== "note" || !编器)
    return;
  if (便笺存承 || 块.some((b) => b.暂 || b.待抓 || b.暂文))
    await 便笺立刻存();
  if (两栏.开 || 卡宿 !== "note" || !编器)
    return;
  if (!document.getElementById("noteFind")?.hidden)
    关便笺搜索(false, true);
  关AI预览();
  理层();
  选块.clear();
  两栏.原块 = 块.slice();
  两栏.开时 = 块MD.块转原文(块, 两栏选项());
  const md = 两栏.开时.md;
  Object.assign(两栏, { 开: true, 版: md, 挂起: false });
  const ta = document.getElementById("noteMdIn"), btn = document.getElementById("noteMdBtn");
  ta.value = md;
  document.getElementById("noteBox").classList.add("md两栏");
  document.getElementById("noteMd").hidden = false;
  if (btn) {
    btn.setAttribute("aria-pressed", "true");
    btn.title = "切回块编辑(左边改的先存进正文)";
  }
  画两栏预览(md);
  两栏按报说({ 外图: 0, 外文件: 0, 失效占位: 0 }, md);
  ta.focus();
  ta.setSelectionRange(0, 0);
  ta.scrollTop = 0;
  try {
    if (typeof window.壳加宽 === "function")
      window.壳加宽(true);
  } catch (e) {}
}
function 关两栏(只复位) {
  if (!两栏.开)
    return;
  if (!只复位)
    同步两栏(true);
  clearTimeout(两栏.T);
  Object.assign(两栏, { 开: false, 原块: [], 开时: null, 版: "", T: 0, 挂起: false });
  document.getElementById("noteBox")?.classList.remove("md两栏");
  const md = document.getElementById("noteMd");
  if (md)
    md.hidden = true;
  const ta = document.getElementById("noteMdIn");
  if (ta)
    ta.value = "";
  const v = document.getElementById("noteMdView");
  if (v)
    v.replaceChildren();
  const btn = document.getElementById("noteMdBtn");
  if (btn) {
    btn.setAttribute("aria-pressed", "false");
    btn.title = "Markdown 两栏:左边改正文的 Markdown 原文,右边实时看效果;再点一下切回块编辑";
  }
  if (!只复位 && 编器) {
    画块();
    刷撤销钮();
  }
  try {
    if (typeof window.壳加宽 === "function")
      window.壳加宽(false);
  } catch (e) {}
}
function 画两栏预览(md) {
  const v = document.getElementById("noteMdView");
  if (!v)
    return;
  v.innerHTML = 块MD预览HTML(块MD.MD转块(md, Object.assign(两栏选项(), { 记行: true })).块);
}
function 预览定位() {
  if (!两栏开着())
    return;
  const v = document.getElementById("noteMdView"), ta = document.getElementById("noteMdIn"), sel = getSelection();
  if (!v || !ta || !sel || sel.isCollapsed || !sel.rangeCount)
    return;
  const 块元 = (n) => {
    const e = n && (n.nodeType === 1 ? n : n.parentElement);
    const x = e && e.closest("[data-l]");
    return x && v.contains(x) ? x : null;
  };
  const a = 块元(sel.anchorNode), b = 块元(sel.focusNode);
  if (!a || !b)
    return;
  const [a1, a2] = a.dataset.l.split("-").map(Number), [b1, b2] = b.dataset.l.split("-").map(Number);
  const 行 = ta.value.split(`
`), 起行 = Math.min(a1, b1), 止行 = Math.min(Math.max(a2, b2), 行.length - 1);
  if (!(起行 >= 0) || 起行 > 止行)
    return;
  let s = 0;
  for (let k = 0;k < 起行; k++)
    s += 行[k].length + 1;
  let e = s;
  for (let k = 起行;k <= 止行; k++)
    e += 行[k].length + 1;
  e--;
  const 字 = sel.toString().trim(), j = 字 ? ta.value.slice(s, e).indexOf(字) : -1;
  if (j >= 0) {
    s += j;
    e = s + 字.length;
  }
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(s, e);
  框滚到(ta, s);
}
function 框滚到(ta, 位) {
  const cs = getComputedStyle(ta), d = document.createElement("div"), m = document.createElement("span");
  ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "wordSpacing", "tabSize", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "overflowWrap", "wordBreak"].forEach((k) => {
    d.style[k] = cs[k];
  });
  Object.assign(d.style, { position: "absolute", visibility: "hidden", left: "-99999px", top: "0", boxSizing: "border-box", border: "0", whiteSpace: "pre-wrap", width: ta.clientWidth + "px" });
  d.textContent = ta.value.slice(0, 位);
  m.textContent = "\u200b";
  d.appendChild(m);
  document.body.appendChild(d);
  const y = m.offsetTop;
  d.remove();
  if (ta.scrollHeight > ta.clientHeight + 1) {
    ta.scrollTop = Math.max(0, y - ta.clientHeight / 3);
    return;
  }
  for (let p = ta.parentElement;p; p = p.parentElement) {
    if (p.scrollHeight <= p.clientHeight + 1 || !/(auto|scroll)/.test(getComputedStyle(p).overflowY))
      continue;
    const 缩 = ta.getBoundingClientRect().height / ta.offsetHeight || 1;
    p.scrollTop += (ta.getBoundingClientRect().top - p.getBoundingClientRect().top) / 缩 + y - p.clientHeight / 3;
    return;
  }
}
function 块MD预览HTML(bs) {
  let i = 0;
  const 一层 = (lv) => {
    let 出 = "", 序 = 0;
    while (i < bs.length && 层of(bs[i]) >= lv) {
      const b = bs[i++];
      序 = (b.type || "text") === "ol" ? 序 + 1 : 0;
      const 子 = i < bs.length && 层of(bs[i]) > lv ? 一层(lv + 1) : "";
      const h = 预览一块(b, 序, 子);
      出 += b.原行 ? h.replace(/^<([a-z][a-z0-9]*)/i, `<$1 data-l="${b.原行[0]}-${b.原行[1]}"`) : h;
    }
    return 出;
  };
  return 一层(0);
}
function 预览一块(b, 序, 子) {
  const t = b.type || "text", 内 = md行内(b.text || ""), 下 = 子 ? `<div class="md-sub">${子}</div>` : "";
  const 列 = (标, 类) => `<div class="md-li${类 || ""}"><span class="md-mk">${标}</span><div class="md-tx">${内 || "<br>"}</div></div>` + 下;
  if (t === "h") {
    const n = [1, 2, 3].includes(b.级) ? b.级 : 2;
    return `<h${n}>${内 || "<br>"}</h${n}>` + 下;
  }
  if (t === "ul")
    return 列("•");
  if (t === "ol")
    return 列(序 + ".");
  if (t === "todo")
    return 列(`<input type="checkbox" disabled${b.勾 ? " checked" : ""} aria-label="${b.勾 ? "已勾" : "没勾"}">`, b.勾 ? " done" : "");
  if (t === "quote")
    return `<blockquote>${内 || "<br>"}</blockquote>` + 下;
  if (t === "hr")
    return "<hr>" + 下;
  if (t === "code")
    return `<pre>${b.lang ? `<span class="md-lang">${esc(b.lang)}</span>` : ""}<code>${码预览HTML(b.text || "", b.lang)}</code></pre>` + 下;
  if (t === "fold")
    return `<details${b.展开 ? " open" : ""}><summary>${md行内(b.标题 || "") || "折叠"}</summary><div class="md-sub">${b.text ? `<p>${内}</p>` : ""}${子}</div></details>`;
  if (t === "table") {
    const 行 = Array.isArray(b.行) ? b.行 : [], 起 = b.原行 ? b.原行[0] : -1;
    const 号 = (j) => {
      const n = 起 + (b.表头 && j ? j + 1 : j);
      return 起 >= 0 ? ` data-l="${n}-${n}"` : "";
    };
    return `<table>${行.map((r, j) => `<tr${号(j)}>${(r || []).map((c) => {
      const g = b.表头 && !j ? "th" : "td";
      return `<${g}>${md行内(String(c == null ? "" : c))}</${g}>`;
    }).join("")}</tr>`).join("")}</table>` + 下;
  }
  if (t === "img") {
    const 名 = (((当前详情数据 || {}).详情图 || []).find((a) => +a.id === +b.附件id) || {}).原名 || "";
    return `<div class="md-img al-${["center", "right"].includes(b.al) ? b.al : "left"}"><img src="${esc(图源(b) || "")}" alt="${esc(名)}"${b.w ? ` style="width:${+b.w}px"` : ""}></div>` + 下;
  }
  if (t === "file") {
    const f = b.暂文 || 块文件.find((x) => +x.id === +b.附件id);
    if (!f)
      return '<div><span class="md-file missing">✗ 这个附件已经被删掉了</span></div>' + 下;
    const 字 = `\uD83D\uDCC4 ${esc(f.原名 || "附件")}${f.字节 != null ? " · " + esc(大小人话(f.字节)) : ""}`;
    return `<div>${b.暂文 ? `<span class="md-file" title="还没存进库">${字}</span>` : `<a class="md-file" href="/api/todo/file?id=${+b.附件id}&src=${两栏源()}" download="${esc(f.原名 || "")}" title="下载">${字}</a>`}</div>` + 下;
  }
  if (t === "date")
    return `<div><span class="md-date" title="日期块">${esc(b.日期 || "")}${b.时间 ? " " + esc(b.时间) : ""}</span></div>` + 下;
  return `<p>${内 || "<br>"}</p>` + 下;
}
function 码预览HTML(文, 语) {
  const g = 码语法(语);
  if (!g)
    return esc(文);
  let 出 = "";
  const 段 = (s, 类) => {
    出 += 类 ? `<span class="tk-${类}">${esc(s)}</span>` : esc(s);
  };
  (function 铺(词们, 外类) {
    for (const t of 词们) {
      if (typeof t === "string") {
        段(t, 外类);
        continue;
      }
      const 类 = 码色类[t.type] || [].concat(t.alias || []).map((a) => 码色类[a]).find(Boolean) || 外类;
      if (typeof t.content === "string")
        段(t.content, 类);
      else
        铺([].concat(t.content), 类);
    }
  })(window.Prism.tokenize(文, g), "");
  return 出;
}
const md安全链 = (u) => /^(https?:|mailto:|\/api\/)/i.test(u);
function md行内(s) {
  const 存 = [], 留 = (h) => "\x00" + (存.push(h) - 1) + "\x01";
  const 链 = (u, 字) => `<a href="${esc(u)}" target="_blank" rel="noopener">${字}</a>`;
  let x = String(s || "").replace(/[\u0000\u0001]/g, "");
  x = x.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (m, q, c) => 留(`<code>${esc(c)}</code>`));
  x = x.replace(/!?\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, 字, u) => md安全链(u) ? 留(链(u, md强调(esc(字)) || esc(u))) : m);
  x = x.replace(/https?:\/\/[^\s<>"'\u0000\u0001]+[^\s<>"'.,;:!?)\]\u0000\u0001]/g, (u) => 留(链(u, esc(u))));
  return md强调(esc(x)).replace(/\u0000(\d+)\u0001/g, (m, n) => 存[+n]);
}
const md强调 = (h) => h.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>").replace(/__(?=\S)([\s\S]*?\S)__/g, "<strong>$1</strong>").replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<del>$1</del>").replace(/(^|[^*\w])\*(?=\S)([^*\n]*?[^\s*])\*(?![*\w])/g, "$1<em>$2</em>").replace(/(^|[^_\w])_(?=\S)([^_\n]*?[^\s_])_(?![_\w])/g, "$1<em>$2</em>");
(function 装两栏() {
  const btn = document.getElementById("noteMdBtn"), ta = document.getElementById("noteMdIn");
  if (!btn || !ta || !window.块MD) {
    if (btn)
      btn.hidden = true;
    return;
  }
  btn.addEventListener("click", async () => {
    if (!两栏.开) {
      await 开两栏();
      return;
    }
    关两栏();
    if (块脏)
      排便笺自动存(0);
    const el = 文档元素();
    el && el.querySelector("[contenteditable]")?.focus();
  });
  ta.addEventListener("input", () => {
    clearTimeout(两栏.T);
    两栏.T = setTimeout(() => 同步两栏(false), 300);
  });
  document.getElementById("noteMdStd")?.addEventListener("click", async () => {
    if (!两栏开着())
      return;
    const 选 = 两栏选项(), 标 = 块MD.块转标准MD(块MD.原文回块(ta.value, 两栏.开时, 选).块, { ...选, 站点: location.origin });
    if (!标) {
      两栏说("正文是空的,没东西可复制");
      return;
    }
    if (!await 复制文本(标)) {
      两栏说("没复制成,见提示条", "剪贴板没写进去;上一次的「已复制」不算数");
      toast("没复制成:浏览器不让写剪贴板,再点一次试试", true, { 报错: "剪贴板写入和 execCommand(copy) 都没成功", 位置: "便笺 · Markdown 两栏 · 复制为标准 Markdown" });
      return;
    }
    两栏说("已复制标准 Markdown", "标准写法已在剪贴板里(" + 标.split(`
`).length + " 行),贴进 Typora、Obsidian 这些软件格式不乱;左边原文没变");
  });
  const v = document.getElementById("noteMdView");
  v?.addEventListener("mouseup", () => setTimeout(预览定位, 0));
  v?.addEventListener("touchend", () => setTimeout(预览定位, 0));
  document.querySelector("#noteBox .notefoot")?.addEventListener("click", (e) => {
    if (!两栏开着())
      return;
    const b = e.target.closest(两栏拦);
    if (!b)
      return;
    e.preventDefault();
    e.stopImmediatePropagation();
    toast(b.matches("[data-undo],[data-redo]") ? "两栏开着:左边撤销用 Ctrl+Z,这颗切回块编辑再用" : "两栏开着:先点标题栏「Markdown」切回块编辑再用这颗");
  }, true);
})();
async function 保存便笺再走(下一步) {
  关两栏();
  if (await 便笺立刻存() === false) {
    存态("挂", "这一条没存上,先没切走 —— 点「再试一次」,或者把字复制出去");
    toast("当前这张便笺没存上,先没给你切走", true);
    return;
  }
  await 强存历史();
  下一步();
}
async function 同步便笺事项() {
  const k = 正文落点();
  if (!k)
    return null;
  刷自动标题();
  const 该是 = 标题值() || 便笺默认名();
  if (!该是)
    return null;
  const cur = todos.find((x) => x.k === k);
  if (cur && cur.matter === 该是)
    return null;
  const r = await postJSON("/api/todo/edit", Object.assign(拆K(k), { 列: "事项", 值: 该是 }));
  return !!(r && r.ok);
}
function 开编器(根, 初始块, k, 文件列表) {
  编器 = { 根, k: k || null };
  标本条关联(根);
  块 = 初始块.map((b) => Object.assign({}, b));
  块文件 = (文件列表 || []).map((f) => Object.assign({}, f));
  选块.clear();
  块脏 = false;
  画块();
  const docEl = 文档元素();
  if (docEl) {
    绑框选(docEl);
  }
  根.querySelectorAll("[data-add]").forEach((b) => {
    if (b._bd)
      return;
    b._bd = 1;
    b.addEventListener("click", () => {
      if (b.dataset.add === "img") {
        图落点 = null;
        document.getElementById("dFilePick").click();
        return;
      }
      if (b.dataset.add === "file") {
        文件落点 = null;
        document.getElementById("dBlockFilePick").click();
        return;
      }
      块.push({ type: "text", text: "" });
      画块();
      存块();
      const last = 根.querySelector("[data-doc] .block:last-child .btext");
      if (last)
        last.focus();
    });
  });
  根.querySelectorAll("[data-cardlinkadd]").forEach((b) => {
    if (b._bd)
      return;
    b._bd = 1;
    b.addEventListener("click", () => 开关联选择器(b));
  });
  const fp = 根.querySelector("[data-cardfilepick]");
  if (fp && !fp._bd) {
    fp._bd = 1;
    fp.addEventListener("change", async (e) => {
      for (const f of e.target.files)
        await 上传文件(f);
      e.target.value = "";
      画卡附件();
    });
  }
  const sa = 根.querySelector("[data-cardsubadd]");
  if (sa && !sa._bd) {
    sa._bd = 1;
    sa.addEventListener("click", () => {
      if (卡草稿 && 卡草稿._已有)
        return;
      toast(编器 && 编器.k ? "这张卡已经进库了 —— 先补齐保存失败项" : "这张卡还没保存 —— 先点「保存」,存下来之后就能加子待办了", true);
    });
  }
  根.querySelectorAll("[data-ai速记]").forEach((b) => {
    if (!b._aibd) {
      b._aibd = 1;
      b.addEventListener("click", () => 开AI速记(b));
    }
  });
  绑撤销历史(根);
}
function 关编器() {
  编器 = null;
  块 = [];
  块文件 = [];
  选块.clear();
  块脏 = false;
}
function 切卡形态(到) {
  const box = 卡盒(), mask = 卡罩(), page = document.getElementById("cardPage");
  if (到 === "page") {
    if (box.parentElement !== page)
      page.appendChild(box);
    page.classList.remove("hidden");
    mask.classList.add("hidden");
    document.getElementById("listView").classList.add("hidden");
    const home = document.getElementById("homeView");
    if (home)
      home.classList.add("hidden");
    document.getElementById("detailView").classList.add("hidden");
    box.classList.remove("sm");
    box.classList.add("lg");
  } else {
    if (box.parentElement !== mask)
      mask.appendChild(box);
    page.classList.add("hidden");
    if (dCur == null)
      显示主面板DOM();
    mask.classList.remove("hidden");
    box.classList.toggle("sm", 到 === "sm");
    box.classList.toggle("lg", 到 === "lg");
  }
  卡形态 = 到;
  记窗形(卡宿, 到);
  摆卡核心属性();
  刷卡钮();
  if (卡宿 === "note")
    画便笺列表();
  window.scrollTo(0, 0);
}
function 摆卡核心属性() {
  if (卡宿 !== "card")
    return;
  const 小 = 卡形态 === "sm";
  const 对 = [
    ["cardStatusBox", 小 ? "cardStatusSlotSm" : "cardStatusSlotLg"],
    ["cardStarsBox", 小 ? "cardStarsSlotSm" : "cardStarsSlotLg"],
    ["cardDueBox", 小 ? "cardDueSlotSm" : "cardDueSlotLg"]
  ];
  对.forEach(([盒, 槽id]) => {
    const box = document.getElementById(盒), 槽 = document.getElementById(槽id);
    if (box && 槽 && box.parentElement !== 槽)
      槽.appendChild(box);
  });
}
function 摆便笺页头钮() {
  const 组 = document.getElementById("noteHeadActs"), box = document.getElementById("noteBox");
  if (!组 || !box)
    return;
  const 整页 = box.parentElement && box.parentElement.id === "cardPage";
  const 去 = 整页 ? box.querySelector(".notetitle-row") : box.querySelector(".mh");
  if (去 && 组.parentElement !== 去)
    去.appendChild(组);
  const 号 = document.getElementById("noteIdBox"), 存 = document.getElementById("noteSaveState"), 题 = document.getElementById("noteTitle");
  if (号 && 存 && 题) {
    if (整页) {
      if (号.nextElementSibling !== 存)
        存.before(号);
    } else if (号.nextElementSibling !== 题)
      题.before(号);
  }
}
function 刷卡钮() {
  摆便笺页头钮();
  const 整 = document.getElementById(卡宿 === "note" ? "noteFull" : "cardFull");
  if (整) {
    整.textContent = 卡形态 === "page" ? "⤡" : "⤢";
    const 说明 = 卡形态 === "page" ? "还原" : "放大";
    整.title = 说明;
    整.setAttribute("aria-label", 说明);
  }
  const ft = document.getElementById("cardFoot");
  if (ft && 卡宿 === "card" && 卡草稿 && 卡草稿._已有) {
    ft.innerHTML = `<button class="次钮" onclick="请求关闭待办()">关闭</button>
      <button class="主钮" ${卡保存中 ? 'disabled aria-busy="true"' : ""} onclick="保存已有待办()">${卡保存中 ? "保存中…" : "保存"}</button>`;
    return;
  }
  if (ft && 卡宿 === "card") {
    const 已建 = !!(编器 && 编器.k);
    const 失败项 = 卡草稿 && Array.isArray(卡草稿._保存失败项) ? 卡草稿._保存失败项 : [];
    const 失败HTML = 失败项.map((x) => `<span class="emptyline" title="保存失败；右侧按钮只补没存上的项目"><i class="符">&#10007;</i> ${esc(x)}</span>`).join("");
    const 次钮 = 已建 ? '<button class="次钮" onclick="请求关闭待办()">先这样,关掉</button>' : '<button class="次钮" onclick="请求关闭待办()">取消</button>';
    const 动作 = 已建 ? "重试没存上的()" : "submitCard()";
    const 字 = 卡保存中 ? "保存中…" : 已建 ? "重试没存上的" : "保存";
    ft.innerHTML = `${失败HTML}${次钮}
      <button class="主钮" ${卡保存中 ? 'disabled aria-busy="true"' : ""} onclick="${动作}">${字}</button>`;
  }
}
function 大窗没更宽() {
  const box = 卡盒();
  if (!box || !box.offsetWidth)
    return false;
  const 小宽 = box.offsetWidth;
  box.classList.remove("sm");
  box.classList.add("lg");
  const 大宽 = box.offsetWidth;
  box.classList.remove("lg");
  box.classList.add("sm");
  return 大宽 < 小宽 + 100;
}
function 下一卡形态() {
  if (卡形态 === "sm")
    切卡形态(大窗没更宽() ? "page" : "lg");
  else if (卡形态 === "lg")
    切卡形态("page");
  else
    切卡形态("sm");
}
let 卡层 = null, 卡层直接关 = false;
function 压卡层() {
  const box = 卡盒();
  if (SOLO || !window.UI叠层 || !box)
    return;
  if (卡层 === box && box.getClientRects().length)
    return;
  卡层 = box;
  const 名 = 卡宿 === "note" ? (document.getElementById("noteTitle")?.textContent || "便笺").trim() : 卡草稿 && 卡草稿._已有 ? document.getElementById("cardTitle").textContent : "新建待办";
  UI叠层.压(box, { 名, 关: 卡层被退, 钮位: ".mh", 叉全关: false });
}
function 卡层被退() {
  卡层 = null;
  if (卡宿 === "note") {
    closeNote().then((关了) => {
      if (!关了 && 编器)
        压卡层();
    });
    return;
  }
  if (卡层直接关) {
    closeCard();
    return;
  }
  请求关闭待办().then((关了) => {
    if (!关了 && 编器)
      压卡层();
  });
}
async function 叠层全关() {
  if (待办有未保存() && !await UI确认({ 题: "底下待办窗里的改动还没存", 说: "全关会把没存的改动一起丢掉。想留住就点取消,回去点「保存」。", 钮字: "全关,不存了" }))
    return;
  卡层直接关 = true;
  try {
    UI叠层.全关();
  } finally {
    卡层直接关 = false;
  }
}
function 压上层(mask, 名, 关) {
  if (!window.UI叠层) {
    mask._退 = 关;
    return;
  }
  UI叠层.压(mask, { 名, 关, 钮位: ".mh", 叉全关: false });
  mask._退 = () => UI叠层.退();
}
function closeCard() {
  作废卡载入();
  const 压着 = 卡层;
  卡层 = null;
  const box = 卡盒(), mask = 卡罩();
  管焦点(mask, false);
  if (box.parentElement !== mask)
    mask.appendChild(box);
  document.getElementById("cardPage").classList.add("hidden");
  mask.classList.add("hidden");
  if (压着 && window.UI叠层)
    UI叠层.退();
  if (dCur == null)
    显示主面板DOM();
  else
    document.getElementById("detailView").classList.remove("hidden");
  关两栏(true);
  关编器();
  卡草稿 = null;
  卡重试中 = false;
  卡保存中 = false;
  清撤销队列();
  弹回详情正文();
  if (dCur != null)
    重置撤销队列();
}
function 待办有未保存() {
  if (卡宿 !== "card" || !卡草稿 || !编器)
    return false;
  if (卡保存中 || 卡重试中 || (卡草稿._保存失败项 || []).length)
    return true;
  const 账 = 卡草稿._保存账;
  if (账 && (账.正文待补 || Object.keys(账.项 || {}).length))
    return true;
  if (!卡草稿._已有 && 编器.k)
    return true;
  const tg = document.getElementById("cardTarget");
  const 现 = {
    事项: (document.getElementById("cardMatter").textContent || "").trim(),
    状态: document.getElementById("cardStatus").value,
    星: +(卡草稿.星 || 1),
    日期: document.getElementById("cardDate").value || "",
    归档: document.getElementById("cardArch").checked ? 1 : 0,
    目标数: tg ? String(tg.value || "") : ""
  };
  if (卡草稿._已有) {
    const 原 = 卡草稿._原 || {};
    return !!(块脏 || 现.事项 !== (原.事项 || "") || 现.状态 !== (原.状态 || "未开始") || 现.星 !== +(原.星 || 1) || 现.日期 !== (原.日期 || "") || 现.归档 !== +(原.归档 || 0) || 现.目标数 !== String(原.目标数 || ""));
  }
  return !!(块脏 || 现.事项 || 现.状态 !== "未开始" || 现.星 !== 1 || 现.日期 || 现.归档 || 现.目标数 || (卡草稿.链接 || []).length || (卡草稿.文件 || []).length);
}
function 问待办关闭() {
  return new Promise((定) => {
    const d = document.createElement("dialog");
    d.className = "askdel";
    d.innerHTML = `<form method="dialog">
      <h3>有修改还没保存</h3>
      <p class="askwhy">继续编辑不会丢内容；放弃修改会丢掉这次未保存的改动。</p>
      <div class="askbtns">
        <button value="stay" class="次钮" data-stay>继续编辑</button>
        <button value="discard" class="危钮 askgo">✗ 放弃修改</button>
        <button value="save" class="主钮">保存并关闭</button>
      </div></form>`;
    document.body.appendChild(d);
    d.addEventListener("keydown", (e) => {
      if (e.key === "Escape")
        e.stopPropagation();
    });
    d.addEventListener("close", () => {
      const v = d.returnValue || "stay";
      d.remove();
      定(v);
    }, { once: true });
    d.showModal();
    d.querySelector("[data-stay]").focus();
  });
}
async function 请求关闭待办() {
  if (卡宿 !== "card") {
    closeCard();
    return true;
  }
  if (卡保存中) {
    toast("正在保存,存完再关 —— 这次修改还留在窗里");
    return false;
  }
  if (!待办有未保存()) {
    closeCard();
    return true;
  }
  const 选择 = await 问待办关闭();
  if (选择 === "stay")
    return false;
  if (选择 === "discard") {
    closeCard();
    return true;
  }
  if (选择 !== "save")
    return false;
  if (卡草稿 && 卡草稿._已有) {
    if (!await 保存已有待办())
      return false;
    closeCard();
    return true;
  }
  await submitCard();
  return !编器;
}
async function closeNote() {
  关两栏();
  let 果 = await 便笺立刻存();
  if (果 !== false && (便笺存T || 块脏))
    果 = await 便笺立刻存();
  if (果 === false) {
    存态("挂", "没存上,窗先不关 —— 点「再试一次」;真不要了下面那颗「关掉」会再问一次");
    if (!await 问删({
      屏上: "这张便笺没存上,还是要关掉?",
      细说: "关掉之后写的字就没了,恢复不了。想留住就点取消,回去点「再试一次」。",
      钮字: "不要了,关掉"
    }))
      return false;
  }
  await 强存历史();
  关便笺搜索(false, true);
  closeCard();
  if (SOLO)
    独窗关();
  return true;
}
function 独窗关(提示) {
  document.getElementById("soloDoneMsg").textContent = 提示 || "便笺存好了,可以关掉这个窗口";
  window.close();
  setTimeout(() => {
    document.getElementById("soloDone").hidden = false;
  }, 150);
}
async function 独窗去列表() {
  关两栏();
  if (await 便笺立刻存() === false)
    return;
  window.open("待办.html", "_blank");
  await closeNote();
}
async function 独窗再写() {
  document.getElementById("soloDone").hidden = true;
  history.replaceState(null, "", location.pathname + "?solo=note");
  await 独窗开();
}
async function 独窗开() {
  const qs = new URLSearchParams(location.search), id = qs.get("id");
  await openNote(id ? (qs.get("src") || 默认源()) + ":" + id : undefined);
  if (!编器 || 卡宿 !== "note")
    独窗关("这张便笺打不开(可能已被删掉),可以关掉这个窗口");
}
function 草稿链接转标准(l) {
  return {
    type: l.类型 || l.type || l.关联类型,
    键: l.k != null ? l.k : l.键 != null ? l.键 : l.关联键,
    text: l.文本 || l.显示文本 || l.text || "",
    号: l.号,
    dangling: false,
    格: null,
    关联id: null
  };
}
function 卡关联chipHTML(l, i) {
  return 关联chipHTML(草稿链接转标准(l), 卡草稿 && 卡草稿.来源 || 默认源(), i);
}
function 画卡关联() {
  const 根 = 编器根();
  if (!根)
    return;
  if (卡草稿 && 卡草稿._已有) {
    const cur = todos.find((x) => x.k === 正文落点()) || { links: [] };
    根.querySelectorAll("[data-cardlinks]").forEach((box) => {
      box.innerHTML = (cur.links || []).map((l) => 关联chipHTML(l, cur.src)).join("") || '<span class="emptyline" style="padding:0">还没挂关联数据</span>';
      box.querySelectorAll("[data-dellink]").forEach((x) => x.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!await UI确认({ 题: "移除这个关联?", 说: "只拆掉这条待办和它的挂钩,挂的那个东西本身不动。", 钮字: "移除关联" }))
          return;
        const r = await postJSON("/api/todo/link/del", { 来源: 拆K(正文落点()).来源, id: +x.dataset.dellink });
        if (!r || !r.ok) {
          toast(r && r.error || "移除失败", true);
          return;
        }
        await loadList();
        画卡关联();
      }));
    });
    return;
  }
  根.querySelectorAll("[data-cardlinks]").forEach((box) => {
    box.innerHTML = 卡草稿 && 卡草稿.链接.length ? 卡草稿.链接.map(卡关联chipHTML).join("") : '<span class="emptyline" style="padding:0">还没挂关联数据</span>';
    box.querySelectorAll("[data-delcardlink]").forEach((x) => x.addEventListener("click", (e) => {
      e.stopPropagation();
      卡草稿.链接.splice(+x.dataset.delcardlink, 1);
      画卡关联();
      推撤销快照();
    }));
  });
}
function 画卡附件() {
  const 根 = 编器根();
  if (!根)
    return;
  const box = 根.querySelector("[data-cardfilelist]");
  if (!box)
    return;
  const 清单 = 暂存态() ? 卡草稿 && 卡草稿.文件 || [] : 块文件;
  box.innerHTML = 清单.length ? 清单.map((f, i) => `<div class="frow"><span>\uD83D\uDCC4 ${esc(f.原名)}</span>
        <span class="fmeta">${大小人话(f.字节)}${暂存态() ? " · 存卡时进库" : ""}</span>
        <span class="fx" data-delcardfile="${i}" title="不要这个附件了">✗</span></div>`).join("") : '<span class="emptyline" style="padding:0">还没有附件</span>';
  box.querySelectorAll("[data-delcardfile]").forEach((x) => x.addEventListener("click", async () => {
    const i = +x.dataset.delcardfile, f = 清单[i];
    if (!f)
      return;
    if (暂存态()) {
      卡草稿.文件.splice(i, 1);
      画卡附件();
      推撤销快照();
      return;
    }
    if (!await 问删({ 屏上: "删掉这个附件?", 细说: `「${f.原名 || "附件"}」从库里删掉;删完马上点「↶ 撤销」还能拿回来。`, 钮字: "删掉附件" }))
      return;
    await 缓存当前附件(new Set([+f.id]));
    const one = 拆K(正文落点());
    const r = await postJSON("/api/todo/file", { 来源: one.来源, op: "del", id: +f.id });
    if (!r || !r.ok) {
      toast(r && r.error || "删附件失败", true);
      return;
    }
    块文件.splice(i, 1);
    if (当前详情数据)
      当前详情数据.文件 = 块文件.map((v) => Object.assign({}, v));
    画卡附件();
    推撤销快照();
    loadList();
  }));
}
async function 卡里进入待办(k) {
  if (卡草稿 && 卡草稿._已有 && !await 保存已有待办())
    return;
  closeCard();
  await openTodo(k);
}
async function 卡里新建子待办() {
  const 父 = 正文落点();
  if (!(卡草稿 && 卡草稿._已有) || !父) {
    toast("先把这张待办保存下来,再加子待办", true);
    return;
  }
  const cur = todos.find((x) => x.k === 父);
  if (cur && cur.pk) {
    toast("子待办只允许一层", true);
    return;
  }
  if (!await 保存已有待办())
    return;
  closeCard();
  await openCard(父);
}
function 画卡子待办() {
  const 根 = 编器根();
  if (!根)
    return;
  const box = 根.querySelector("[data-cardsublist]");
  if (!box)
    return;
  const summaryRow = 根.querySelector("[data-cardsubsummary-row]");
  const summary = 根.querySelector("[data-cardsubsummary]");
  const 已有 = !!(卡草稿 && 卡草稿._已有 && 正文落点());
  const cur = 已有 ? todos.find((x) => x.k === 正文落点()) : null;
  const 可拆 = !!(已有 && cur && !cur.pk);
  const 子项 = 可拆 ? children(正文落点()) : [];
  const 做完 = 子项.filter((c) => c.status === "已完成").length;
  if (summaryRow)
    summaryRow.classList.toggle("on", 可拆);
  if (summary)
    summary.textContent = `${做完}/${子项.length}`;
  const cnt = 根.querySelector("[data-cardsubcnt]");
  if (cnt)
    cnt.textContent = `${做完}/${子项.length}`;
  if (!已有) {
    box.innerHTML = 编器 && 编器.k ? '<div class="emptyline">这张卡已建好 —— 先补齐保存失败项。</div>' : '<div class="emptyline">先保存这张待办,再添加子待办。</div>';
  } else if (!可拆) {
    box.innerHTML = '<div class="emptyline">子待办只允许一层。</div>';
  } else {
    box.innerHTML = 子项.length ? 子项.map(子行HTML).join("") : '<div class="emptyline">还没有子待办。</div>';
    box.querySelectorAll("[data-openk]").forEach((x) => x.addEventListener("click", () => 卡里进入待办(x.dataset.openk)));
    box.querySelectorAll("[data-subck]").forEach((ck) => ck.addEventListener("change", async (e) => {
      const k = ck.dataset.subck, 宿key = String(正文落点() || ""), 到 = e.target.checked ? "已完成" : "未开始";
      const c = todos.find((x) => x.k === k);
      if (c)
        c.status = 到;
      const { r, 最新 } = await 排同字段写(k, "状态", 到);
      if (!最新)
        return;
      if (!r || !r.ok)
        toast(r && r.error || "改不动", true);
      await loadList();
      if (String(正文落点() || "") === 宿key)
        画卡子待办();
    }));
    box.querySelectorAll("[data-subdel]").forEach((x) => x.addEventListener("click", async () => {
      const one = 拆K(x.dataset.subdel);
      if (!await 问删({ 屏上: "删掉这条子待办?", 细说: "删了先进回收站,能还原:正文、评论和附件跟着一起进去,留 10 天。", 钮字: "删掉子待办" }))
        return;
      const r = await postJSON("/api/todo/del", { 来源: one.来源, id: one.id });
      if (!r || !r.ok) {
        toast(r && r.error || "删不掉", true);
        return;
      }
      删完提示("已删这条子待办,在回收站里", [{ 来源: one.来源, 回收id: r.回收id }]);
      await loadList();
      画卡子待办();
    }));
  }
  const 进 = 根.querySelector("[data-cardopenfirst]");
  if (进 && !进._bd) {
    进._bd = 1;
    进.addEventListener("click", () => {
      const k = children(正文落点())[0];
      if (k)
        卡里进入待办(k.k);
      else
        toast("还没有子待办");
    });
  }
  const 新小 = 根.querySelector("[data-cardsubadd-sm]");
  if (新小 && !新小._bd) {
    新小._bd = 1;
    新小.addEventListener("click", 卡里新建子待办);
  }
  const 新大 = 根.querySelector("[data-cardsubadd]");
  if (新大 && !新大._bd2) {
    新大._bd2 = 1;
    新大.addEventListener("click", () => {
      if (卡草稿 && 卡草稿._已有)
        卡里新建子待办();
    });
  }
}
function 画卡元信息() {
  const 根 = 编器根();
  if (!根)
    return;
  const box = 根.querySelector("[data-cardmeta]");
  const 已有 = !!(卡草稿 && 卡草稿._已有 && 正文落点());
  if (box) {
    box.style.display = 已有 ? "" : "none";
    if (已有) {
      const t = 当前详情数据 && 当前详情数据.待办 || {};
      const one = 拆K(正文落点());
      box.innerHTML = `<div class="g2"><div><span class="sl">创建时间</span><span class="sv ctime">${esc(t.创建时间 || "—")}</span></div><div><span class="sl">编号</span><span class="sv ctime">#${one.id}</span></div></div>`;
    }
  }
}
async function 刷卡评论数据() {
  const k = 正文落点();
  if (!(卡草稿 && 卡草稿._已有) || !k)
    return false;
  const det = await postJSON("/api/prod/todo/detail", 拆K(k));
  if (!det || !det.ok)
    return false;
  当前详情数据 = det;
  画卡评论();
  画卡元信息();
  return true;
}
function 画卡评论() {
  const 根 = 编器根();
  if (!根)
    return;
  const box = 根.querySelector("[data-cardcmt]");
  if (!box)
    return;
  if (!(卡草稿 && 卡草稿._已有 && 正文落点())) {
    box.innerHTML = '<div class="sf-h"><b>评论</b></div><div class="sf-note" style="margin:0">这张卡还没保存,存下来之后才能写评论。</div>';
    return;
  }
  const 清单 = 当前详情数据 && 当前详情数据.评论 || [];
  box.innerHTML = `<div class="sf-h"><b>评论 <span class="cnt">${清单.length}</span></b></div>
    <div style="margin-top:6px"><textarea class="cmtbox" data-cardcmttext rows="2" placeholder="写评论…(Ctrl+Enter 添加)"></textarea>
      <div class="foot" style="margin-top:6px"><button class="主钮" data-cardcmtsubmit disabled>添加</button></div></div>
    <div style="margin-top:10px">${清单.map(评论HTML).join("") || '<div class="emptyline" style="padding:6px 0">还没有评论</div>'}</div>`;
  box.querySelectorAll("[data-delcmt]").forEach((x) => x.addEventListener("click", async () => {
    if (!await 问删({ 屏上: "删掉这条评论?", 细说: "评论里带的图和附件会一起删,恢复不了。", 钮字: "删掉评论" }))
      return;
    const r = await postJSON("/api/prod/todo/comment", { 来源: 拆K(正文落点()).来源, op: "del", id: +x.dataset.delcmt });
    if (!r || !r.ok) {
      toast(r && r.error || "删评论失败", true);
      return;
    }
    await 刷卡评论数据();
  }));
  绑评论改(box, 拆K(正文落点()).来源, 刷卡评论数据);
  const 输入 = box.querySelector("[data-cardcmttext]"), 提交 = box.querySelector("[data-cardcmtsubmit]");
  const 刷 = () => {
    提交.disabled = !输入.value.trim();
  };
  const 发 = async () => {
    const v = 输入.value.trim();
    if (!v)
      return;
    const one = 拆K(正文落点());
    const r = await postJSON("/api/prod/todo/comment", { 来源: one.来源, op: "add", 待办id: one.id, 内容: v });
    if (!r || !r.ok) {
      toast(r && r.error || "评论失败", true);
      return;
    }
    await 刷卡评论数据();
  };
  输入.addEventListener("input", 刷);
  输入.addEventListener("keydown", (e) => {
    if (评论提交键(e)) {
      e.preventDefault();
      发();
    }
  });
  提交.addEventListener("click", 发);
}
async function 保存已有待办() {
  if (!(卡草稿 && 卡草稿._已有 && 编器 && 编器.k))
    return false;
  if (卡保存中)
    return false;
  const k = 编器.k, one = 拆K(k), 原 = 卡草稿._原 || {};
  const 事项 = (document.getElementById("cardMatter").textContent || "").trim();
  if (!事项) {
    toast("事项不能为空", true);
    return false;
  }
  const tg = document.getElementById("cardTarget");
  if (tg && 目标数没填对(tg.value)) {
    toast("目标数要填 1 或更大的整数 —— 不做量化就把它空着", true);
    tg.focus();
    return false;
  }
  const 现 = {
    事项,
    状态: document.getElementById("cardStatus").value,
    星: +(卡草稿.星 || 1),
    日期: document.getElementById("cardDate").value || "",
    归档: document.getElementById("cardArch").checked ? 1 : 0,
    目标数: tg && 源信息(one.来源).量化 ? tg.value ? +tg.value : "" : 原.目标数
  };
  卡保存中 = true;
  卡存态("", "保存中…");
  刷卡钮();
  let 好 = true;
  const 改 = async (列, 值) => {
    const r = await postJSON("/api/todo/edit", { 来源: one.来源, id: one.id, 列, 值 });
    if (!r || !r.ok) {
      好 = false;
      toast(r && r.error || `${列}没存上`, true);
    }
  };
  try {
    if (现.事项 !== 原.事项)
      await 改("事项", 现.事项);
    if (现.状态 !== 原.状态)
      await 改("状态", 现.状态);
    if (现.星 !== +原.星)
      await 改("重要程度", 现.星);
    if (现.日期 !== (原.日期 || ""))
      await 改("计划完成时间", 现.日期);
    if (源信息(one.来源).量化 && String(现.目标数 || "") !== String(原.目标数 || ""))
      await 改("目标数", 现.目标数);
    if (现.归档 !== +原.归档) {
      const r = await postJSON("/api/todo/archive", { ids: [{ 来源: one.来源, id: one.id }], 归档: 现.归档 });
      if (!r || !r.ok) {
        好 = false;
        toast(r && r.error || "归档状态没存上", true);
      }
    }
    if (块脏 && !await 存块())
      好 = false;
    if (!好) {
      卡存态("挂", "还有内容没存上");
      return false;
    }
    卡草稿._原 = Object.assign({}, 现);
    卡存态("好", "已保存");
    if (当前详情数据 && 当前详情数据.待办)
      Object.assign(当前详情数据.待办, { 事项: 现.事项, 状态: 现.状态, 重要程度: 现.星, 计划完成时间: 现.日期, 归档: 现.归档, 目标数: 现.目标数 });
    await loadList();
    if (!现.归档) {
      画卡关联();
      画卡子待办();
    }
    return true;
  } finally {
    卡保存中 = false;
    刷卡钮();
  }
}
function 记首次落库附件平移(果, 暂存件, id, 附件, 是图) {
  const 键 = 暂存件 && 暂存件.撤销附件键;
  if (!键 || !id)
    return;
  果.撤销附件平移.push({ 键, id: +id, 附件: Object.assign({}, 附件 || {}, { id: +id }), 是图: !!是图 });
}
async function 落卡进库(来源, id, 强制正文 = true) {
  const 果 = { 图败: 0, 文件败: 0, 正文败: 0, 附件败: 0, 关联败: 0, 末错: "", 撤销附件平移: [], 失败项: [] };
  const 账 = 卡保存账();
  let 正文需写 = !!强制正文 || !!(账 && 账.正文待补) || !!块脏;
  const 记 = (键, e) => {
    果[键]++;
    果.末错 = e || 果.末错 || "没说原因";
  };
  for (const b of 块) {
    if (b.type === "file" && b.暂文) {
      const f = b.暂文;
      const r = await postJSON("/api/todo/file", {
        来源,
        op: "add",
        待办id: id,
        评论id: null,
        base64: f.base64,
        mime: f.mime,
        原名: f.原名
      });
      if (r && r.ok) {
        b.附件id = r.文件.id;
        块文件.push(r.文件);
        附件撤销缓存.set(+r.文件.id, { base64: f.base64, mime: f.mime, 原名: f.原名, 是图: false });
        记首次落库附件平移(果, b, r.文件.id, r.文件, false);
        delete b.暂文;
        delete b.撤销附件键;
        正文需写 = true;
      } else {
        记("文件败", r && r.error || "文件存不进去");
      }
      continue;
    }
    if (b.type !== "img")
      continue;
    if (b.暂) {
      const 暂图 = b.暂;
      const aid = await 上传图(b.暂, id, null, 来源);
      if (aid) {
        b.附件id = aid;
        附件撤销缓存.set(+aid, { base64: String(暂图.dataURL || "").split(",")[1] || "", mime: 暂图.mime, 原名: 暂图.原名, 是图: true });
        记首次落库附件平移(果, b, aid, { id: aid, mime: 暂图.mime, 原名: 暂图.原名 }, true);
        delete b.暂;
        delete b.撤销附件键;
        正文需写 = true;
      } else {
        记("图败", "图存不进去");
      }
    } else if (b.待抓) {
      const r = await postJSON("/api/todo/img", { 来源, op: "fetch", 待办id: id, url: b.待抓 }, 抓图上限毫秒);
      if (r && r.ok) {
        b.附件id = r.图.id;
        记首次落库附件平移(果, b, r.图.id, r.图, true);
        delete b.待抓;
        delete b.撤销附件键;
        正文需写 = true;
      } else {
        记("图败", r && r.error || "后台没抓下来");
      }
    }
  }
  if (正文需写) {
    const 剩 = 块.filter((b) => !((b.type === "img" || b.type === "file") && !b.附件id));
    const 本版 = 块版;
    const r = await postJSON("/api/todo/blocks", { 来源, id, 块: 剩.map(净一块) });
    if (!r || !r.ok) {
      if (账)
        账.正文待补 = true;
      记("正文败", r && r.error || "正文没存上");
      toast(r && r.error || "正文没存上", true);
    } else if (块版 === 本版) {
      if (账)
        账.正文待补 = false;
      块脏 = false;
    } else if (账)
      账.正文待补 = true;
  }
  const 待传 = 卡草稿 && 卡草稿.文件 || [];
  const 传成 = new Set;
  for (const f of 待传) {
    const r2 = await postJSON("/api/todo/file", { 来源, op: "add", 待办id: id, 评论id: null, base64: f.base64, mime: f.mime, 原名: f.原名 });
    if (r2 && r2.ok) {
      传成.add(f);
      块文件.push(r2.文件);
      附件撤销缓存.set(+r2.文件.id, { base64: f.base64, mime: f.mime, 原名: f.原名, 是图: false });
      记首次落库附件平移(果, f, r2.文件.id, r2.文件, false);
    } else
      记("附件败", r2 && r2.error || `附件「${f.原名}」没进去`);
  }
  if (卡草稿)
    卡草稿.文件 = 待传.filter((f) => !传成.has(f));
  const 待挂 = 卡草稿 && 卡草稿.链接 || [];
  const 挂成 = new Set;
  for (const l of 待挂) {
    const r3 = await postJSON("/api/todo/link/add", { 来源, 待办id: id, 关联类型: l.类型, 关联键: l.k, 显示文本: l.文本 });
    if (r3 && r3.ok)
      挂成.add(l);
    else
      记("关联败", r3 && r3.error || `关联「${l.文本}」没挂上`);
  }
  if (卡草稿)
    卡草稿.链接 = 待挂.filter((l) => !挂成.has(l));
  果.败 = 果.图败 + 果.文件败 + 果.正文败 + 果.附件败 + 果.关联败;
  果.失败项 = [
    果.正文败 && "正文没存上",
    果.图败 && `${果.图败} 张图没进去`,
    果.文件败 && `${果.文件败} 个正文文件没进去`,
    果.附件败 && `${果.附件败} 个附件没进去`,
    果.关联败 && `${果.关联败} 条关联没挂上`
  ].filter(Boolean);
  果.说 = 保存失败说(果);
  return 果;
}
function 正文第一行() {
  for (const b of 块) {
    let t = "";
    if (b.type === "file") {
      const f = b.暂文 || 块文件.find((x) => +x.id === +b.附件id);
      t = f && f.原名 || "[文件]";
    } else if (b.type === "table") {
      t = (Array.isArray(b.行) ? b.行.flat() : []).map((x) => String(x == null ? "" : x).trim()).find(Boolean) || "";
    } else if (b.type === "date") {
      t = (b.日期 || "") + (b.时间 ? " " + b.时间 : "");
    } else if (b.type !== "img" && b.type !== "hr") {
      t = String(b.标题 || b.text || "").trim();
    }
    if (t)
      return t.split(`
`)[0].trim().slice(0, 200);
  }
  return "";
}
async function submitCard() {
  if (!卡草稿 || 卡保存中)
    return;
  if (编器 && 编器.k)
    return 重试没存上的();
  const 便 = 卡草稿.形态 === "便笺";
  const 事项 = 便 ? 标题值() || 便笺默认名() : (document.getElementById("cardMatter").textContent || "").trim() || 正文第一行();
  if (!事项 && !便) {
    toast("事项和正文不能都空着", true);
    return;
  }
  if (便 && !事项 && !正文第一行()) {
    toast("便笺标题和正文不能都空着", true);
    return;
  }
  const 落 = 卡草稿.来源;
  const body = { 来源: 落, 详情: 块转文(块), 形态: 卡草稿.形态 };
  if (事项)
    body.事项 = 事项;
  if (卡草稿.父id)
    body.父id = 卡草稿.父id;
  if (!便) {
    body.状态 = document.getElementById("cardStatus").value;
    body.重要程度 = 卡草稿.星;
    const tg = document.getElementById("cardTarget");
    if (tg && 目标数没填对(tg.value)) {
      toast("目标数要填 1 或更大的整数 —— 不做量化就把它空着", true);
      tg.focus();
      return;
    }
    if (tg && tg.value && 源信息(落).量化)
      body.目标数 = +tg.value;
  }
  卡保存中 = true;
  卡草稿._保存失败项 = [];
  刷卡钮();
  try {
    const r = await postJSON("/api/todo/add", body);
    if (!r || !r.ok) {
      toast(r && r.error || "添加失败", true);
      return;
    }
    编器.k = 落 + ":" + r.id;
    const 落果 = await 落卡进库(落, r.id, true);
    if (!便) {
      const due = document.getElementById("cardDate").value;
      if (due)
        await 跑卡待补项(落果, "日期", "/api/todo/edit", { 来源: 落, id: r.id, 列: "计划完成时间", 值: due }, "计划完成时间没存上");
      else
        清卡待补("日期");
      if (document.getElementById("cardArch").checked) {
        await 跑卡待补项(落果, "归档", "/api/todo/archive", { ids: [{ 来源: 落, id: r.id }], 归档: 1 }, "没归成档");
      } else
        清卡待补("归档");
    }
    let 挂上 = false;
    if (LK锁() && !卡草稿.父id) {
      const 自动体 = { 来源: 落, 待办id: r.id, 关联类型: lkFilter.type, 关联键: lkFilter.key, 显示文本: lkFilter.label };
      const r2 = await 跑卡待补项(落果, "自动关联", "/api/todo/link/add", 自动体, "没自动挂到本行");
      挂上 = !!(r2 && r2.ok);
      if (挂上)
        lkFilter.ids.add(落 + ":" + r.id);
    } else
      清卡待补("自动关联");
    const 父 = 卡草稿.父id;
    const 叫法 = 便 ? "便笺" : 父 ? "子待办" : "待办";
    if (落果.败) {
      卡宿 = "card";
      卡重试中 = true;
      卡草稿._保存失败项 = 落果.失败项.slice();
      清撤销队列();
      const 标 = document.getElementById("cardTitle");
      if (标) {
        const 符 = document.createElement("i");
        符.className = "符";
        符.textContent = "✗";
        标.replaceChildren(符, ` ${叫法} #${r.id} 已建 —— 还有几步没存上`);
      }
      画卡关联();
      画卡附件();
      toast(`已建${叫法} #${r.id},但 ${落果.说} —— 窗先不关,点「重试没存上的」补齐`, true);
      await loadList();
      return;
    }
    卡重试中 = false;
    closeCard();
    toast([`已${便 ? "记" : "建"}${叫法} #${r.id}`, 挂上 ? "自动挂到本行" : ""].filter(Boolean).join(" · "));
    await loadList();
    if (dCur != null)
      refreshDetail();
  } finally {
    卡保存中 = false;
    if (卡草稿)
      刷卡钮();
  }
}
async function 重试没存上的() {
  if (!编器 || !编器.k) {
    toast("这张卡还没建出来,点「保存」", true);
    return;
  }
  if (卡保存中)
    return;
  卡保存中 = true;
  刷卡钮();
  try {
    const one = 拆K(编器.k);
    const 落果 = await 落卡进库(one.来源, one.id, false);
    const 账 = 卡保存账();
    const 待补 = 账 ? Object.entries(Object.assign({}, 账.项)) : [];
    for (const [键, 项] of 待补) {
      const r = await 跑卡待补项(落果, 键, 项.path, 项.body, 项.文案);
      if (r && r.ok && 键 === "自动关联")
        lkFilter.ids.add(one.来源 + ":" + one.id);
    }
    if (卡草稿)
      卡草稿._保存失败项 = 落果.失败项.slice();
    画卡关联();
    画卡附件();
    if (落果.败) {
      toast("还是有没存上的:" + 落果.说, true);
      return;
    }
    卡重试中 = false;
    toast(`补齐了 —— #${one.id} 这下全存上了`);
    closeCard();
    await loadList();
    if (dCur != null)
      refreshDetail();
  } finally {
    卡保存中 = false;
    if (卡草稿)
      刷卡钮();
  }
}
const 便笺存延时 = 700;
let 便笺存T = null, 便笺存承 = null, 便笺再存 = false, 首次落库中 = false;
let 存态展开 = false;
function 存态(态, 说) {
  const el = document.getElementById("noteSaveState");
  if (!el)
    return;
  if (态 !== "存中" && 态 !== "挂")
    存态展开 = false;
  const 开着 = 存态展开;
  el.classList.remove("has-fail", "展开");
  el.classList.add("截留钮");
  const 题 = (s) => {
    el.title = s;
    const z = el.querySelector(".截一行");
    if (z)
      z.title = s;
  };
  if (态 === "存中") {
    el.innerHTML = '<i class="符 转">&#10227;</i> <span class="截一行">正在存…</span>';
    题("正在存这张便笺");
    return;
  }
  if (态 === "好") {
    const t = new Date().toISOString();
    el.innerHTML = `<i class="符 好">&#10003;</i> <span class="截一行">已自动存</span> <time data-相对 datetime="${t}"></time>`;
    UI格式.刷(el);
    题("已自动存 " + el.querySelector("time").title);
    return;
  }
  if (态 === "挂") {
    const 已记 = 卡草稿 && Array.isArray(卡草稿._保存失败项) ? 卡草稿._保存失败项.filter(Boolean) : [];
    const 项 = 已记.length ? 已记 : [说 || "不知道为什么"];
    el.classList.remove("截留钮");
    el.removeAttribute("title");
    el.classList.add("has-fail");
    el.classList.toggle("展开", 开着);
    el.innerHTML = `<button type="button" class="savefail-head" aria-controls="noteSaveFailItems"><i class="符 坏">&#10007;</i>` + `<span class="截一行">没存上</span><span class="项数">${项.length} 项</span></button>` + `<span class="savefail-items" id="noteSaveFailItems">` + 项.map((x) => `<span class="savefail-item">${esc(x)}</span>`).join("") + "</span>";
    const 头 = el.firstElementChild;
    const 头题 = `没存上的 ${项.length} 项:
` + 项.map((x) => "· " + x).join(`
`) + `
点「没存上」这几个字:在底栏逐项展开 / 收起;右边那颗钮只补这几项`;
    头.title = 头题;
    头.querySelector(".截一行").title = 头题;
    头.setAttribute("aria-expanded", String(开着));
    头.addEventListener("mousedown", (e) => e.preventDefault());
    头.addEventListener("click", () => {
      存态展开 = el.classList.toggle("展开");
      头.setAttribute("aria-expanded", String(存态展开));
    });
    const b = document.createElement("button");
    b.className = "retry";
    b.type = "button";
    b.innerHTML = '<span class="retry-长">只</span>重试<span class="retry-长">没存上的</span>';
    b.setAttribute("aria-label", "只重试没存上的");
    b.title = "只重试没存上的那几项,已经存上的不再重发";
    b.addEventListener("click", () => 便笺立刻存());
    el.appendChild(b);
    return;
  }
  el.innerHTML = '<span class="截一行"></span>';
  el.firstChild.textContent = 说 || "改了自己会存,不用点保存";
  题(el.textContent);
}
function 排便笺自动存(delay) {
  if (卡宿 !== "note")
    return;
  clearTimeout(便笺存T);
  便笺存T = setTimeout(() => 便笺立刻存(), delay == null ? 便笺存延时 : delay);
}
function 便笺还有失败项() {
  if (!卡草稿)
    return false;
  const 账 = 卡草稿._保存账;
  return !!(卡重试中 || (卡草稿._保存失败项 || []).length || 账 && (账.正文待补 || Object.keys(账.项 || {}).length) || (卡草稿.链接 || []).length || (卡草稿.文件 || []).length);
}
function 便笺失败明细(果) {
  const out = [];
  if (果 && 果.正文败)
    out.push("正文");
  块.filter((b) => b.type === "img" && (b.暂 || b.待抓)).forEach((b, i) => out.push(`正文图片 ${i + 1}`));
  块.filter((b) => b.type === "file" && b.暂文).forEach((b) => out.push(`正文文件：${b.暂文 && b.暂文.原名 || "未命名"}`));
  (卡草稿 && 卡草稿.文件 || []).forEach((f) => out.push(`附件：${f.原名 || "未命名"}`));
  (卡草稿 && 卡草稿.链接 || []).forEach((l) => out.push(`关联：${l.文本 || l.显示文本 || l.k || l.关联键 || "未命名"}`));
  const 账 = 卡草稿 && 卡草稿._保存账;
  if (账)
    Object.values(账.项 || {}).forEach((x) => {
      if (x && x.文案 && !out.includes(x.文案))
        out.push(x.文案);
    });
  return out.length ? out : (果 && 果.失败项 || []).slice();
}
async function 重试便笺没存上的() {
  if (!编器 || !编器.k || !卡草稿)
    return false;
  const one = 拆K(编器.k);
  const 落果 = await 落卡进库(one.来源, one.id, false);
  const 账 = 卡保存账();
  const 待补 = 账 ? Object.entries(Object.assign({}, 账.项)) : [];
  for (const [键, 项] of 待补)
    await 跑卡待补项(落果, 键, 项.path, 项.body, 项.文案);
  卡草稿._保存失败项 = 便笺失败明细(落果);
  if (落果.败) {
    卡重试中 = true;
    存态("挂", 落果.说);
    return false;
  }
  const 变 = await 同步便笺事项();
  if (变 === false) {
    卡重试中 = true;
    卡草稿._保存失败项 = ["标题没存上"];
    存态("挂", "标题没存上");
    return false;
  }
  卡重试中 = false;
  卡草稿._保存失败项 = [];
  await loadList();
  画便笺关联();
  画便笺列表();
  画便笺创建日();
  排历史快照();
  存态("好");
  return true;
}
function 标题框归属对() {
  const ti = document.getElementById("noteTitleIn");
  return !ti || (ti.dataset.k || "") === String(编器 && 编器.k || "");
}
function 便笺立刻存() {
  if (卡宿 !== "note" || !编器)
    return Promise.resolve("空");
  if (!标题框归属对())
    return Promise.resolve("空");
  if (两栏.开)
    同步两栏(false);
  clearTimeout(便笺存T);
  便笺存T = null;
  if (便笺存承) {
    便笺再存 = true;
    return 便笺存承;
  }
  const 跑 = (async () => {
    存态("存中");
    刷自动标题();
    try {
      if (暂存态())
        return await 新便笺落库();
      return 便笺还有失败项() ? await 重试便笺没存上的() : await 老便笺落盘();
    } finally {
      便笺存承 = null;
      if (便笺再存) {
        便笺再存 = false;
        排便笺自动存(0);
      }
    }
  })();
  便笺存承 = 跑;
  return 跑;
}
async function 新便笺落库() {
  if (!卡草稿)
    return false;
  const 标 = 标题值(), 一 = 正文第一行();
  if (!标 && !一) {
    存态("", "写点什么它就自己存了");
    return "空";
  }
  const 落 = 卡草稿.来源;
  const body = { 来源: 落, 详情: 块转文(块), 形态: "便笺" };
  if (标 || 一)
    body.事项 = 标 || 便笺默认名() || 一;
  立即推撤销快照();
  首次落库中 = true;
  const r = await postJSON("/api/todo/add", body);
  if (!r || !r.ok) {
    首次落库中 = false;
    if (卡草稿)
      卡草稿._保存失败项 = [r && r.error || "建不出这条便笺"];
    存态("挂", r && r.error || "建不出这条便笺");
    return false;
  }
  if (卡草稿)
    卡草稿._保存失败项 = [];
  const 本版 = 块版;
  const 落果 = await 落卡进库(落, r.id);
  编器.k = 落 + ":" + r.id;
  document.getElementById("noteTitleIn").dataset.k = 编器.k;
  if (块版 === 本版)
    块脏 = false;
  else
    排便笺自动存(0);
  刷便笺顶栏();
  await loadList();
  画便笺关联();
  画便笺列表();
  画便笺创建日();
  if (落果.败) {
    首次落库中 = false;
    卡重试中 = true;
    清撤销队列();
    if (卡草稿)
      卡草稿._保存失败项 = 便笺失败明细(落果);
    存态("挂", 落果.说);
    return false;
  }
  首次落库中 = false;
  卡重试中 = false;
  if (卡草稿)
    卡草稿._保存失败项 = [];
  const 待补缓存 = new Set(落果.撤销附件平移.filter((x) => x.是图 && !附件撤销缓存.has(+x.id)).map((x) => +x.id));
  if (待补缓存.size)
    await 缓存当前附件(待补缓存);
  平移首次落库撤销历史(落果.撤销附件平移);
  排历史快照();
  存态("好");
  return true;
}
async function 老便笺落盘() {
  if (块脏 && !await 存块()) {
    存态("挂", "正文没存上");
    return false;
  }
  const 变 = await 同步便笺事项();
  if (变 === false) {
    存态("挂", "标题没存上");
    return false;
  }
  if (变) {
    await loadList();
    画便笺列表();
  }
  存态("好");
  return true;
}
function setCardStar(e) {
  const i = e.target.closest("i,button");
  if (!i || !卡草稿)
    return;
  卡草稿.星 = [...e.currentTarget.children].indexOf(i) + 1;
  e.currentTarget.innerHTML = starHTML(卡草稿.星, true);
  标卡有改动();
}
let 块 = [];
let 块文件 = [];
let 块脏 = false;
let 块版 = 0;
let 当前详情数据 = null;
let 撤销队列 = [], 撤销位 = -1, 撤销T = null, 历史T = null, 正在套快照 = false, 撤销附件序 = 0;
let 附件撤销缓存 = new Map;
let 卡重试中 = false;
function 深拷(v) {
  return JSON.parse(JSON.stringify(v == null ? null : v));
}
function 当前标题() {
  if (编器 && 卡宿 === "note")
    return (标题值() || 便笺默认名() || "未命名待办").slice(0, 200);
  if (编器 && 卡宿 === "card") {
    const el = document.getElementById("cardMatter");
    return (el && el.textContent.trim() || 正文第一行() || "未命名待办").slice(0, 200);
  }
  const el = document.querySelector("#dBody [data-fld-matter]");
  return (el && el.textContent.trim() || "未命名待办").slice(0, 200);
}
function 当前关联快照() {
  if (暂存态())
    return 深拷(卡草稿 && 卡草稿.链接 || []);
  const cur = todos.find((x) => x.k === 正文落点());
  return 深拷(cur && cur.links || []);
}
function 当前附件快照() {
  if (暂存态())
    return 深拷(卡草稿 && 卡草稿.文件 || []);
  const det = 当前详情数据 || {};
  const 图ids = new Set(块.filter((b) => b.type === "img" && b.附件id).map((b) => +b.附件id));
  const 图 = (det.详情图 || []).filter((a) => 图ids.has(+a.id));
  const 已有 = new Set(图.map((a) => +a.id));
  for (const id of 图ids)
    if (!已有.has(id)) {
      const c = 附件撤销缓存.get(id);
      图.push({ id, 原名: c && c.原名 || "图片", mime: c && c.mime || "image/png" });
    }
  const 文件 = [...det.文件 || []];
  for (const f of 块文件 || [])
    if (!文件.some((x) => +x.id === +f.id))
      文件.push(f);
  return 深拷([...文件, ...图]);
}
function blob转base64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader;
    fr.onload = () => resolve(String(fr.result || "").split(",")[1] || "");
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
async function 缓存当前附件(只要ids) {
  const k = 正文落点();
  if (!k)
    return;
  const one = 拆K(k), 图ids = new Set(块.filter((b) => b.type === "img").map((b) => +b.附件id));
  const det = 当前详情数据 || {}, 合 = [...det.文件 || [], ...det.详情图 || [], ...当前附件快照()];
  const 项 = 合.filter((a, i) => a && a.id && (!只要ids || 只要ids.has(+a.id)) && 合.findIndex((x) => +x.id === +a.id) === i && !附件撤销缓存.has(+a.id));
  await Promise.all(项.map(async (a) => {
    const 是图 = 图ids.has(+a.id) || String(a.mime || "").startsWith("image/");
    const url = 是图 ? `/api/prod/todo/img?id=${a.id}&src=${encodeURIComponent(one.来源)}` : `/api/todo/file?id=${a.id}&src=${encodeURIComponent(one.来源)}`;
    try {
      const r = await fetch(url);
      if (!r.ok)
        return;
      const blob = await r.blob(), base64 = await blob转base64(blob);
      if (!base64)
        return;
      附件撤销缓存.set(+a.id, { base64, mime: a.mime || blob.type || "application/octet-stream", 原名: a.原名 || (是图 ? "图片" : "附件"), 是图 });
    } catch (_) {}
  }));
}
function 当前整条快照() {
  if (暂存态()) {
    const 给键 = (x) => {
      if (x && !x.撤销附件键)
        x.撤销附件键 = "u" + ++撤销附件序;
    };
    块.forEach((b) => {
      if (b.type === "img" && (b.暂 || b.待抓) || b.type === "file" && b.暂文)
        给键(b);
    });
    (卡草稿 && 卡草稿.文件 || []).forEach(给键);
  }
  return { 标题: 当前标题(), 块: 深拷(暂存态() ? 块 : 块.map(净一块)), 关联: 当前关联快照(), 附件清单: 当前附件快照() };
}
function 平移首次落库快照(s, 附件对应, 已存关联) {
  const 对应 = new Map((附件对应 || []).map((x) => [String(x.键 || ""), x]));
  const 按id = new Map((附件对应 || []).filter((x) => x.id).map((x) => [+x.id, x]));
  const 文件清单 = [], 图片清单 = [], 已收 = new Set;
  const 收附件 = (a, 是图) => {
    if (!a || !a.id || 已收.has(+a.id))
      return;
    已收.add(+a.id);
    (是图 ? 图片清单 : 文件清单).push(深拷(a));
  };
  const 新块 = (s && s.块 || []).map((b) => {
    const x = 深拷(b), m = 对应.get(String(x.撤销附件键 || ""));
    if (m)
      x.附件id = +m.id;
    delete x.撤销附件键;
    delete x.暂;
    delete x.暂文;
    delete x.待抓;
    const 净 = 净一块(x), a = 按id.get(+净.附件id);
    if (a)
      收附件(Object.assign({}, a.附件 || {}, { id: +a.id }), b.type === "img" || a.是图);
    return 净;
  });
  for (const a of s && s.附件清单 || []) {
    const m = 对应.get(String(a.撤销附件键 || "")) || 按id.get(+a.id);
    if (m)
      收附件(Object.assign({}, m.附件 || {}, { id: +m.id }), m.是图);
    else if (a.id)
      收附件(a, String(a.mime || "").startsWith("image/"));
  }
  const 关联键 = (l) => String(l.type || l.类型 || l.关联类型 || "") + "|" + String(l.key || l.键 || l.k || l.关联键 || "");
  const 已存 = new Map((已存关联 || []).map((l) => [关联键(l), l]));
  const 关联 = (s && s.关联 || []).map((l) => 深拷(已存.get(关联键(l)) || l));
  return { 标题: String(s && s.标题 || "未命名待办"), 块: 新块, 关联, 附件清单: [...文件清单, ...图片清单] };
}
function 快照串(s) {
  return JSON.stringify(s, (k, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v);
}
function 刷撤销钮() {
  const root = 编器根();
  if (!root)
    return;
  root.querySelectorAll("[data-undo]").forEach((b) => {
    b.disabled = 撤销位 <= 0 && !撤销T;
  });
  root.querySelectorAll("[data-redo]").forEach((b) => {
    b.disabled = !!撤销T || 撤销位 < 0 || 撤销位 >= 撤销队列.length - 1;
  });
  root.querySelectorAll("[data-history]").forEach((b) => {
    b.disabled = !正文落点() || 卡重试中;
  });
}
function 清撤销队列() {
  clearTimeout(撤销T);
  clearTimeout(历史T);
  撤销T = 历史T = null;
  撤销队列 = [];
  撤销位 = -1;
  附件撤销缓存.clear();
  刷撤销钮();
}
function 重置撤销队列() {
  clearTimeout(撤销T);
  撤销T = null;
  if (卡重试中) {
    撤销队列 = [];
    撤销位 = -1;
    刷撤销钮();
    return;
  }
  撤销队列 = [当前整条快照()];
  撤销位 = 0;
  刷撤销钮();
}
function 推撤销快照(delay = 0) {
  if (正在套快照 || 卡重试中 || 首次落库中)
    return;
  clearTimeout(撤销T);
  撤销T = setTimeout(() => {
    撤销T = null;
    if (!记一版撤销快照())
      刷撤销钮();
  }, delay);
  刷撤销钮();
}
function 记一版撤销快照() {
  const s = 当前整条快照();
  if (撤销位 >= 0 && 快照串(撤销队列[撤销位]) === 快照串(s))
    return false;
  撤销队列 = 撤销队列.slice(0, 撤销位 + 1);
  撤销队列.push(s);
  if (撤销队列.length > 50)
    撤销队列.shift();
  撤销位 = 撤销队列.length - 1;
  刷撤销钮();
  排历史快照();
  return true;
}
function 立即推撤销快照() {
  if (正在套快照 || 卡重试中 || 首次落库中)
    return;
  clearTimeout(撤销T);
  撤销T = null;
  记一版撤销快照();
}
function 平移首次落库撤销历史(附件对应) {
  clearTimeout(撤销T);
  撤销T = null;
  const 位 = 撤销位, 已存关联 = 当前关联快照();
  撤销队列 = 撤销队列.map((s) => 平移首次落库快照(s, 附件对应, 已存关联));
  撤销位 = Math.min(Math.max(位, 0), 撤销队列.length - 1);
  记一版撤销快照();
  刷撤销钮();
}
function 排历史快照() {
  clearTimeout(历史T);
  历史T = null;
  if (!正文落点())
    return;
  历史T = setTimeout(() => 强存历史(), 120000);
}
async function 强存历史() {
  clearTimeout(历史T);
  历史T = null;
  const k = 正文落点();
  if (!k)
    return true;
  const r = await postJSON("/api/todo/history/save", Object.assign(拆K(k), {
    快照: 当前整条快照(),
    摘要: 当前标题().slice(0, 40)
  }));
  if (!r || !r.ok) {
    toast(r && r.error || "历史快照没存上", true);
    return false;
  }
  return true;
}
async function 同步关联快照(目标) {
  if (暂存态()) {
    if (卡草稿)
      卡草稿.链接 = 深拷(目标 || []);
    return;
  }
  const k = 正文落点();
  if (!k)
    return;
  const one = 拆K(k), cur = (todos.find((x) => x.k === k) || {}).links || [];
  const key = (l) => String(l.type || l.类型 || l.关联类型) + "|" + String(l.键 || l.k || l.关联键);
  const 要 = new Map((目标 || []).map((l) => [key(l), l]));
  let 好 = true;
  for (const l of cur)
    if (!要.has(key(l)) && l.关联id) {
      const r = await postJSON("/api/todo/link/del", { 来源: one.来源, id: +l.关联id });
      if (!r || !r.ok)
        好 = false;
    }
  const 有 = new Set(cur.map(key));
  for (const l of 目标 || [])
    if (!有.has(key(l))) {
      const r = await postJSON("/api/todo/link/add", {
        来源: one.来源,
        待办id: one.id,
        关联类型: l.type || l.类型 || l.关联类型,
        关联键: l.键 || l.k || l.关联键,
        显示文本: l.text || l.文本 || l.显示文本 || ""
      });
      if (!r || !r.ok)
        好 = false;
    }
  return 好;
}
async function 同步附件快照(当前, 目标, 目标块) {
  const k = 正文落点();
  if (!k)
    return { ok: true, 映射: new Map };
  const one = 拆K(k), 当前ids = new Set((当前 || []).map((a) => +a.id).filter(Boolean));
  const 目标ids = new Set((目标 || []).map((a) => +a.id).filter(Boolean));
  const 缺 = (目标 || []).filter((a) => a && a.id && !当前ids.has(+a.id));
  for (const a of 缺)
    if (!附件撤销缓存.get(+a.id)) {
      toast(`「${a.原名 || "附件"}」的字节已不在本次撤销缓存里,没有强行还原`, true);
      return { ok: false, 映射: new Map };
    }
  let 好 = true;
  const 映射 = new Map, 新增 = [];
  for (const a of 缺) {
    const c = 附件撤销缓存.get(+a.id), 是图 = c.是图 || String(c.mime || "").startsWith("image/") || (目标块 || []).some((b) => b.type === "img" && +b.附件id === +a.id);
    const r = await postJSON(是图 ? "/api/prod/todo/img" : "/api/todo/file", {
      来源: one.来源,
      op: "add",
      待办id: one.id,
      评论id: null,
      base64: c.base64,
      mime: c.mime,
      原名: c.原名
    });
    const newid = 是图 ? r && r.图 && r.图.id : r && r.文件 && r.文件.id;
    if (!r || !r.ok || !newid) {
      好 = false;
      break;
    }
    映射.set(+a.id, +newid);
    附件撤销缓存.set(+newid, c);
    新增.push({ id: +newid, 是图 });
  }
  if (!好) {
    for (const a of 新增)
      await postJSON(a.是图 ? "/api/prod/todo/img" : "/api/todo/file", { 来源: one.来源, op: "del", id: a.id });
    return { ok: false, 映射: new Map };
  }
  for (const a of 当前 || [])
    if (a && a.id && !目标ids.has(+a.id)) {
      const 是图 = String(a.mime || "").startsWith("image/") || 块.some((b) => b.type === "img" && +b.附件id === +a.id);
      const r = await postJSON(是图 ? "/api/prod/todo/img" : "/api/todo/file", { 来源: one.来源, op: "del", id: +a.id });
      if (!r || !r.ok)
        好 = false;
    }
  if (!好)
    toast("附件恢复只完成了一部分,页面没有冒充成功,请刷新后重试", true);
  return { ok: 好, 映射 };
}
async function 套整条快照(s) {
  if (!s || typeof s !== "object")
    return false;
  正在套快照 = true;
  try {
    const 题 = String(s.标题 || "未命名待办").slice(0, 200);
    const 目标块 = 深拷(Array.isArray(s.块) ? s.块 : [{ type: "text", text: "" }]);
    const 原附件 = 当前附件快照();
    const 写题 = () => {
      if (编器 && 卡宿 === "note")
        document.getElementById("noteTitleIn").value = 题;
      else if (编器 && 卡宿 === "card")
        document.getElementById("cardMatter").textContent = 题;
      else {
        const el = document.querySelector("#dBody [data-fld-matter]");
        if (el)
          el.textContent = 题;
      }
    };
    if (暂存态()) {
      块 = 目标块;
      写题();
      if (卡草稿) {
        卡草稿.链接 = 深拷(s.关联 || []);
        卡草稿.文件 = 深拷(s.附件清单 || []);
      }
      画块();
      画卡关联();
      画卡附件();
      return true;
    }
    const k = 正文落点(), one = 拆K(k);
    const 附件果 = await 同步附件快照(原附件, s.附件清单 || [], 目标块);
    if (!附件果.ok)
      return false;
    目标块.forEach((b) => {
      if (b.附件id && 附件果.映射.has(+b.附件id))
        b.附件id = 附件果.映射.get(+b.附件id);
    });
    const 最终附件 = (s.附件清单 || []).map((a) => Object.assign({}, a, 附件果.映射.has(+a.id) ? { id: 附件果.映射.get(+a.id) } : {}));
    const 最终图ids = new Set(目标块.filter((b) => b.type === "img" && b.附件id).map((b) => +b.附件id));
    块文件 = 最终附件.filter((a) => !最终图ids.has(+a.id) && !String(a.mime || "").startsWith("image/"));
    if (当前详情数据) {
      当前详情数据.文件 = 块文件.map((v) => Object.assign({}, v));
      当前详情数据.详情图 = 最终附件.filter((a) => 最终图ids.has(+a.id) || String(a.mime || "").startsWith("image/"));
    }
    块 = 目标块;
    写题();
    const a = await postJSON("/api/todo/edit", Object.assign(one, { 列: "事项", 值: 题 }));
    const b = await postJSON("/api/todo/blocks", Object.assign(one, { 块: 块.map(净一块) }));
    const c = await 同步关联快照(s.关联 || []);
    if (!a || !a.ok || !b || !b.ok || !c) {
      toast("撤销内容没能完整存上", true);
      return false;
    }
    块脏 = false;
    await loadList();
    if (dCur != null) {
      const det = await postJSON("/api/prod/todo/detail", 拆K(dCur));
      if (det && det.ok)
        renderDetailBody(det);
    } else {
      画块();
      画便笺关联();
      画卡附件();
    }
    return true;
  } finally {
    正在套快照 = false;
    刷撤销钮();
  }
}
async function 走撤销(方向, 回焦) {
  if (正在套快照)
    return;
  if (撤销T)
    立即推撤销快照();
  const 到 = 撤销位 + 方向;
  if (到 < 0 || 到 >= 撤销队列.length) {
    刷撤销钮();
    return;
  }
  const a = 回焦 ? document.activeElement : null;
  const 题框 = a && a.matches("#noteTitleIn,#cardMatter,[data-fld-matter]") ? a.id || "matter" : "";
  const 原块 = a && !题框 && a.closest("[data-doc] .block[data-idx]");
  const 焦 = 原块 ? { idx: +原块.dataset.idx, fld: a.dataset.fld } : null;
  if (await 套整条快照(撤销队列[到])) {
    撤销位 = 到;
    刷撤销钮();
    排历史快照();
    if (题框) {
      const el = 题框 === "matter" ? document.querySelector("#dBody [data-fld-matter]") : document.getElementById(题框);
      if (el) {
        el.focus();
        if (el.setSelectionRange)
          el.setSelectionRange(el.value.length, el.value.length);
      }
    } else if (焦 && 块[焦.idx])
      聚焦块(焦.idx, 焦.fld);
  }
}
async function 开历史浮层() {
  const k = 正文落点();
  if (!k)
    return;
  const r = await postJSON("/api/todo/history/list", 拆K(k));
  if (!r || !r.ok) {
    toast(r && r.error || "历史列表没取到", true);
    return;
  }
  const mask = document.createElement("div");
  mask.className = "mask";
  mask.id = "historyMask";
  mask.innerHTML = `<div class="modal sm"><div class="mh"><b class="grow">\uD83D\uDD50 修改历史</b><button class="ic" data-close>✗</button></div>
    <div class="mb"><div class="history-grid"><div data-history-list></div><pre data-history-preview>点一条看预览</pre></div></div>
    <div class="foot"><span class="grow sf-note">恢复前会先保存当前版</span><button class="主钮" data-restore disabled>恢复这一版</button></div></div>`;
  document.body.appendChild(mask);
  let hid = null;
  const list = mask.querySelector("[data-history-list]"), pre = mask.querySelector("[data-history-preview]"), restore = mask.querySelector("[data-restore]");
  list.innerHTML = (r.版本 || []).map((v) => `<button class="history-row" data-hid="${v.id}"><b>${esc(v.时间 || "")}</b><span>${esc(v.摘要 || "无摘要")}</span></button>`).join("") || '<div class="emptyline">还没有历史快照</div>';
  const 关 = () => mask.remove();
  mask.querySelector("[data-close]").onclick = 关;
  mask.onclick = (e) => {
    if (e.target === mask)
      关();
  };
  list.querySelectorAll("[data-hid]").forEach((b) => b.onclick = async () => {
    const one = await postJSON("/api/todo/history/one", Object.assign(拆K(k), { 历史id: +b.dataset.hid }));
    if (!one || !one.ok) {
      toast(one && one.error || "这一版取不到", true);
      return;
    }
    hid = +b.dataset.hid;
    restore.disabled = false;
    try {
      pre.textContent = JSON.stringify(typeof one.快照 === "string" ? JSON.parse(one.快照) : one.快照, null, 2);
    } catch {
      pre.textContent = String(one.快照 || "");
    }
  });
  restore.onclick = async () => {
    if (!hid || !await UI确认({ 题: "恢复到这一版?", 说: "当前这一版会先存进历史,可以再恢复回来。", 钮字: "恢复这一版", 危: false }))
      return;
    const out = await postJSON("/api/todo/history/restore", Object.assign(拆K(k), { 历史id: hid }));
    if (!out || !out.ok) {
      toast(out && out.error || "恢复失败", true);
      return;
    }
    关();
    toast(out.缺附件数 ? `已恢复这一版；${out.缺附件数} 个已永久删除的附件块没有写回，避免出现坏图或坏文件` : "已恢复这一版");
    await loadList();
    if (dCur != null)
      await refreshDetail();
    else {
      const det = await postJSON("/api/prod/todo/detail", 拆K(k));
      if (det && det.ok) {
        块 = 深拷(det.块 || []);
        装标题栏((det.待办 || {}).事项 || "");
        画块();
        画便笺关联();
      }
    }
    重置撤销队列();
  };
}
function 绑撤销历史(根) {
  if (!根)
    return;
  根.querySelectorAll("[data-undo]").forEach((b) => {
    if (!b._histbd) {
      b._histbd = 1;
      b.onclick = () => 走撤销(-1);
    }
  });
  根.querySelectorAll("[data-redo]").forEach((b) => {
    if (!b._histbd) {
      b._histbd = 1;
      b.onclick = () => 走撤销(1);
    }
  });
  根.querySelectorAll("[data-history]").forEach((b) => {
    if (!b._histbd) {
      b._histbd = 1;
      b.onclick = 开历史浮层;
    }
  });
  const title = 根.querySelector("#noteTitleIn,#cardMatter,[data-fld-matter]");
  if (title && !title._histbd) {
    title._histbd = 1;
    title.addEventListener("input", () => 推撤销快照(500));
  }
  刷撤销钮();
}
function 记脏() {
  块脏 = true;
  块版++;
  刷新AI标题钮(true);
  推撤销快照(500);
  标卡有改动();
}
const 图URL = (aid) => "/api/prod/todo/img?id=" + aid + "&src=" + encodeURIComponent(正文落点() ? 拆K(正文落点()).来源 : 卡草稿 ? 卡草稿.来源 : 默认源());
function stSelDetailHTML(st) {
  const cls = st === "进行中" ? "doing" : st === "已完成" ? "done" : "";
  return `<select class="stsel ${cls}" data-fld-st>` + 状态集.map((o) => `<option ${o === st ? "selected" : ""}>${o}</option>`).join("") + `</select>`;
}
function 详情URL(k) {
  const qs = new URLSearchParams(location.search);
  if (k == null)
    qs.delete("td");
  else {
    const o = 拆K(k);
    qs.set("td", o.id);
    qs.set("src", o.来源);
  }
  const q = qs.toString();
  return location.pathname + (q ? "?" + q : "");
}
function 新详情请求(目标) {
  详情请求目标 = String(目标 || "");
  return ++详情请求序;
}
function 详情请求有效(序, 目标) {
  return 序 === 详情请求序 && 详情请求目标 === String(目标 || "");
}
function 作废详情请求() {
  详情请求序++;
  详情请求目标 = "";
}
let 待继续详情导航 = null;
function 清详情导航失败() {
  待继续详情导航 = null;
  const el = document.getElementById("detailNavFail");
  if (el) {
    el.classList.add("hidden");
    el.innerHTML = "";
  }
}
function 恢复当前详情URL() {
  const url = dCur == null ? 详情URL(null) : 详情URL(dCur);
  if (location.pathname + location.search !== url)
    history.pushState({ td: dCur, restore: true }, "", url);
}
function 显详情导航失败(继续动作) {
  待继续详情导航 = 继续动作;
  const el = document.getElementById("detailNavFail");
  if (!el)
    return;
  const id = dCur == null ? "" : 数据ID(拆K(dCur).id);
  el.classList.remove("hidden");
  el.innerHTML = `<div class="detail-save-msg"><b><i class="符 坏">&#10007;</i> 正文没存上，仍停在 ${esc(id || "当前待办")}</b><br>目标页面没有打开，地址栏也保持当前待办。</div>
    <div class="detail-save-acts"><button class="主钮" data-nav-retry>重试保存并继续</button><button class="次钮" data-nav-stay>继续编辑</button></div>`;
  el.querySelector("[data-nav-stay]").addEventListener("click", () => 清详情导航失败());
  el.querySelector("[data-nav-retry]").addEventListener("click", async (e) => {
    const 动作 = 待继续详情导航;
    if (!动作)
      return;
    const b = e.currentTarget;
    b.disabled = true;
    b.textContent = "正在重试…";
    const ok = await 动作();
    if (ok === true)
      清详情导航失败();
    else if (b.isConnected) {
      b.disabled = false;
      b.textContent = "重试保存并继续";
    }
  });
}
async function 详情离开前(仍有效) {
  if (块脏) {
    const 好 = await 存块();
    if (仍有效 && !仍有效())
      return null;
    if (!好)
      return false;
  }
  await 强存历史();
  if (仍有效 && !仍有效())
    return null;
  return true;
}
async function openDetail(k, 推历史, 来自历史 = false) {
  const key = String(k), 请求序 = 新详情请求(key);
  if (dCur != null && dCur !== key) {
    const 可走 = await 详情离开前(() => 详情请求有效(请求序, key));
    if (可走 == null)
      return null;
    if (!可走) {
      if (来自历史)
        恢复当前详情URL();
      显详情导航失败(() => openDetail(key, true, false));
      return false;
    }
  }
  const one = 拆K(key);
  const det = await postJSON("/api/prod/todo/detail", { 来源: one.来源, id: one.id });
  if (!详情请求有效(请求序, key))
    return null;
  if (!det || !det.ok) {
    if (来自历史)
      恢复当前详情URL();
    toast(det && det.error || "打开失败", true);
    return false;
  }
  if (dCur != null && dCur !== key)
    清撤销队列();
  dCur = key;
  document.getElementById("listView").classList.add("hidden");
  const home = document.getElementById("homeView");
  if (home)
    home.classList.add("hidden");
  document.getElementById("detailView").classList.remove("hidden");
  document.getElementById("cardPage").classList.add("hidden");
  if (推历史 !== false)
    history.pushState({ td: dCur }, "", 详情URL(dCur));
  清详情导航失败();
  renderDetailBody(det);
  重置撤销队列();
  window.scrollTo(0, 0);
  return true;
}
async function 显列表(推历史, 来自历史 = false) {
  const 目标 = "__list__", 请求序 = 新详情请求(目标);
  if (dCur != null) {
    const 可走 = await 详情离开前(() => 详情请求有效(请求序, 目标));
    if (可走 == null)
      return null;
    if (!可走) {
      if (来自历史)
        恢复当前详情URL();
      显详情导航失败(() => 显列表(true, false));
      return false;
    }
  }
  dCur = null;
  清撤销队列();
  清详情导航失败();
  document.getElementById("detailView").classList.add("hidden");
  显示主面板DOM();
  if (推历史 !== false)
    history.pushState({ td: null }, "", 详情URL(null));
  window.scrollTo(0, 0);
  return true;
}
function closeDetail() {
  显列表();
}
window.addEventListener("popstate", async (e) => {
  const qs = new URLSearchParams(location.search), td = qs.get("td");
  const 层 = e.state && e.state.UI叠层 != null;
  if (层 && (td ? (qs.get("src") || LK源) + ":" + td : null) === (dCur == null ? null : String(dCur)))
    return;
  if (td)
    await openDetail((qs.get("src") || LK源) + ":" + td, false, true);
  else
    await 显列表(false, true);
});
async function refreshDetail() {
  if (dCur == null)
    return;
  const key = String(dCur), 请求序 = 新详情请求(key);
  if (块脏) {
    const 存成 = await 存块();
    if (!详情请求有效(请求序, key) || dCur !== key)
      return;
    if (!存成) {
      toast("正文没存上,先不刷新详情 —— 免得把没存上的字冲掉", true);
      return;
    }
  }
  await loadList();
  if (!详情请求有效(请求序, key) || dCur !== key)
    return;
  const det = await postJSON("/api/prod/todo/detail", 拆K(key));
  if (!详情请求有效(请求序, key) || dCur !== key)
    return;
  if (!det || !det.ok)
    return;
  renderDetailBody(det);
  推撤销快照();
}
function 净一块(b) {
  const o = _净块身(b);
  const g = String(b.组 || "").trim().slice(0, 32);
  if (g)
    o.组 = g;
  if (g && b.组收起)
    o.组收起 = true;
  const lv = 层of(b);
  if (lv)
    o.层 = lv;
  return o;
}
function _净块身(b) {
  const t = b.type || "text";
  if (t === "img") {
    const o = { type: "img", 附件id: b.附件id };
    if (b.w)
      o.w = b.w;
    if (b.al)
      o.al = b.al;
    return o;
  }
  if (t === "hr")
    return { type: "hr" };
  if (t === "quote")
    return { type: "quote", text: b.text || "" };
  if (t === "file")
    return { type: "file", 附件id: b.附件id };
  if (t === "table")
    return { type: "table", 表头: !!b.表头, 行: (Array.isArray(b.行) ? b.行 : []).map((r) => (Array.isArray(r) ? r : []).map((v) => String(v == null ? "" : v))) };
  if (t === "date") {
    const o = { type: "date", 日期: b.日期 || "" };
    if (b.时间)
      o.时间 = b.时间;
    return o;
  }
  if (t === "h")
    return { type: "h", text: b.text || "", 级: b.级 || 2 };
  if (t === "todo")
    return { type: "todo", text: b.text || "", 勾: !!b.勾 };
  if (t === "code") {
    const o = { type: "code", text: b.text || "" };
    if (b.lang)
      o.lang = b.lang;
    return o;
  }
  if (t === "fold")
    return { type: "fold", 标题: b.标题 || "", text: b.text || "", 展开: !!b.展开 };
  if (t === "ul" || t === "ol")
    return { type: t, text: b.text || "" };
  return { type: "text", text: b.text || "" };
}
async function 存块(显提示) {
  理层();
  if (暂存态()) {
    块脏 = false;
    推撤销快照();
    if (卡宿 === "note")
      排便笺自动存(0);
    return true;
  }
  const 落 = 正文落点();
  if (落 == null)
    return false;
  const 现图 = new Set(块.filter((b) => b.type === "img").map((b) => +b.附件id));
  const 会删图 = new Set(((当前详情数据 || {}).详情图 || []).map((a) => +a.id).filter((id) => !现图.has(id)));
  if (会删图.size)
    await 缓存当前附件(会删图);
  const 本版 = 块版;
  const r = await postJSON("/api/todo/blocks", Object.assign(拆K(落), { 块: 块.map(净一块) }));
  if (!r || !r.ok) {
    toast(r && r.error || "正文保存失败", true);
    return false;
  }
  if (块版 === 本版) {
    块脏 = false;
  } else if (卡宿 === "note") {
    排便笺自动存(0);
  }
  if (当前详情数据) {
    const ids = new Set(块.filter((b) => b.type === "img").map((b) => +b.附件id));
    当前详情数据.详情图 = (当前详情数据.详情图 || []).filter((a) => ids.has(+a.id));
  }
  推撤销快照();
  if (显提示)
    toast("正文已存 ✓");
  return true;
}
function 图HTML(a) {
  return `<span class="thumb"><img data-看图 src="${图URL(a.id)}" alt="${esc(a.原名 || "")}"><span class="delimg" data-delimg="${a.id}" title="删图">✗</span></span>`;
}
function 评论HTML(c) {
  const 改过 = c.改过时间 ? ` <span class="cedited" title="改过:${esc(c.改过时间)}">✎ 改过</span>` : "";
  return `<div class="cmt" data-cmt="${c.id}">
    <div class="ct"><span title="${esc(c.创建时间 || "")}">${esc((c.创建时间 || "").slice(0, 16))}</span>${改过}<span class="cacts"><button type="button" class="cx ce" data-editcmt="${c.id}" title="在原位改这条评论">✎ 改</button><button type="button" class="cx" data-delcmt="${c.id}" title="删掉这条评论,带的图和文件一起删">删除</button></span></div>
    <div class="cbody">${esc(c.内容 || "")}</div>
    ${c.图 && c.图.length ? `<div class="imgrow" data-看图组>${c.图.map(图HTML).join("")}</div>` : ""}
    ${c.文件 && c.文件.length ? c.文件.map(文件行HTML).join("") : ""}</div>`;
}
function 评论提交键(e) {
  return e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.isComposing;
}
function 绑评论改(根, 来源, 刷新) {
  根.querySelectorAll("[data-editcmt]").forEach((x) => x.addEventListener("click", () => {
    const cmt = x.closest(".cmt"), 体 = cmt && cmt.querySelector(".cbody");
    if (!体 || cmt.querySelector("[data-cmtedit]"))
      return;
    const { textContent: 原文, innerHTML: 原HTML } = 体;
    体.innerHTML = `<textarea class="cmtbox" data-cmtedit rows="3"></textarea>
      <div class="foot" style="margin-top:6px"><button class="次钮" type="button" data-cmtcancel>取消</button><button class="主钮" type="button" data-cmtsave>保存</button></div>`;
    const 框 = 体.querySelector("[data-cmtedit]"), 存 = 体.querySelector("[data-cmtsave]");
    框.value = 原文;
    框.focus();
    const 刷 = () => {
      存.disabled = !框.value.trim();
    };
    const 保存 = async () => {
      const v = 框.value.trim();
      if (!v)
        return;
      if (v === 原文.trim()) {
        体.innerHTML = 原HTML;
        return;
      }
      const r = await postJSON("/api/prod/todo/comment", { 来源, op: "edit", id: +x.dataset.editcmt, 内容: v });
      if (!r || !r.ok) {
        toast(r && r.error || "改评论失败", true);
        return;
      }
      刷新();
    };
    框.addEventListener("input", 刷);
    框.addEventListener("keydown", (e) => {
      if (评论提交键(e)) {
        e.preventDefault();
        保存();
      }
    });
    存.addEventListener("click", 保存);
    体.querySelector("[data-cmtcancel]").addEventListener("click", () => {
      体.innerHTML = 原HTML;
    });
  }));
}
function 大小人话(b) {
  return b == null ? "" : b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(1) + " MB";
}
function 文件行HTML(f) {
  const 落 = 正文落点();
  return `<div class="frow"><a href="/api/todo/file?id=${f.id}&src=${encodeURIComponent(落 ? 拆K(落).来源 : 默认源())}" download title="下载 ${esc(f.原名 || "")}">\uD83D\uDCC4 ${esc(f.原名 || "附件")}</a>
    <span class="fmeta">${大小人话(f.字节)} · ${esc((f.创建时间 || "").slice(0, 16))}</span>
    <span class="fx" data-delfile="${f.id}" title="删附件">✗</span></div>`;
}
function 读速记原文(raw) {
  if (!raw)
    return null;
  try {
    const x = JSON.parse(raw);
    return x && typeof x === "object" && Array.isArray(x.块) ? x : null;
  } catch {
    return null;
  }
}
function 速记原文HTML(t) {
  const x = 读速记原文(t.速记原文);
  if (!x)
    return "";
  const 时间 = String(x.时间 || "");
  const 短时 = 时间.length >= 16 ? 时间.slice(5, 16) : 时间;
  return `<div class="sf ai-original">
    <div class="sf-h"><b>速记前的原文</b><button class="次钮" data-ai-restore>换回这一版</button></div>
    <details><summary title="点开看速记前那一版(改于 ${esc(时间)})">点开看原文${短时 ? ` · ${esc(短时)}` : ""}</summary>
      <div class="ai-original-text">${esc(块转文(x.块))}</div></details>
  </div>`;
}
async function 读文件数据(f) {
  if (f.size > 20 * 1024 * 1024) {
    toast(`「${f.name}」超 20MB 上限,不收`, true);
    return null;
  }
  const dataURL = await new Promise((res) => {
    const fr = new FileReader;
    fr.onload = () => res(fr.result);
    fr.onerror = () => res(null);
    fr.readAsDataURL(f);
  });
  if (!dataURL) {
    toast("读文件失败", true);
    return null;
  }
  return { base64: String(dataURL).split(",")[1] || "", mime: f.type || "application/octet-stream", 原名: f.name, 字节: f.size };
}
async function 上传文件(f, 评论id) {
  if (!评论id && 编器 && !编器.根.querySelector("[data-cardfilelist]"))
    return 读文件入块(f);
  const d = await 读文件数据(f);
  if (!d)
    return false;
  if (暂存态()) {
    卡草稿.文件.push(d);
    推撤销快照();
    toast(`已加附件:${f.name}(存卡的时候一起进库)`);
    return true;
  }
  const one = 拆K(正文落点());
  const r = await postJSON("/api/todo/file", {
    来源: one.来源,
    op: "add",
    待办id: one.id,
    评论id: 评论id || null,
    base64: d.base64,
    mime: d.mime,
    原名: d.原名
  });
  if (!r || !r.ok) {
    toast(r && r.error || "传附件失败", true);
    return false;
  }
  if (r.文件 && r.文件.id) {
    附件撤销缓存.set(+r.文件.id, { base64: d.base64, mime: d.mime, 原名: d.原名, 是图: false });
    if (!评论id) {
      块文件.push(Object.assign({}, r.文件));
      if (当前详情数据)
        当前详情数据.文件 = 块文件.map((v) => Object.assign({}, v));
      推撤销快照();
    }
  }
  toast("已加附件:" + f.name);
  return true;
}
function 关联chipHTML(l, src, 草稿序号) {
  const 本源 = src || 默认源();
  const s = 标签态(l, 本源);
  const 名 = `${s.m.emo} ${s.短名}`.trim();
  const 跳 = `${s.可跳 ? ' tabindex="0" role="button"' : ""} onclick="jumpTag(event,'${jsq(l.type)}','${jsq(l.键)}',${!!l.dangling},'${jsq(本源)}')"`;
  const 删 = 草稿序号 == null ? `data-dellink="${l.关联id}"` : `data-delcardlink="${草稿序号}"`;
  return `<span class="tag chipedit ${s.m.cls} ${s.态类}"${跳} title="${esc(s.悬浮)}"><span class="tag-src">${esc(源名(本源))}</span>${关联号HTML(l)}<span class="chip-name">${esc(名)}${s.可跳 ? '<span class="跳记">↗</span>' : ""}</span><span class="tx" ${删} title="移除关联">✗</span></span>`;
}
function 子行HTML(c) {
  const 完 = c.status === "已完成";
  const od = isOverdue(c);
  return `<div class="subrow ${完 ? "done" : ""}">
    <input class="sck" type="checkbox" ${完 ? "checked" : ""} data-subck="${esc(c.k)}"
      title="${完 ? "取消完成" : "标记这条做完了"}">
    <span class="sid 编号 可点" data-openk="${esc(c.k)}" role="button" tabindex="0" title="打开这条子待办"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">${数据ID(c.id)}</span>
    <span class="sname" data-openk="${esc(c.k)}" title="${esc(c.matter)} · 打开这条子待办">${esc(c.matter)}</span>
    <span class="stars" title="重要程度 ${c.star} 星">${starHTML(c.star)}</span>
    <span class="sdue ${od ? "od" : ""}" title="计划完成时间">${c.due ? esc(c.due) + (od ? " !" : "") : "—"}</span>
    <span class="sx" data-subdel="${esc(c.k)}" title="删掉这条子待办">✗</span>
  </div>`;
}
function renderDetailBody(det) {
  当前详情数据 = det;
  const t = det.待办;
  const one = 拆K(dCur);
  const cur = todos.find((x) => x.k === dCur) || { links: [] };
  块 = (det.块 || []).map((b) => Object.assign({}, b));
  块文件 = (det.文件 || []).map((f) => Object.assign({}, f));
  const 已引 = new Set(块.filter((b) => b.type === "img").map((b) => b.附件id));
  (det.详情图 || []).forEach((a) => {
    if (!已引.has(a.id))
      块.push({ type: "img", 附件id: a.id });
  });
  if (!块.length)
    块.push({ type: "text", text: "" });
  块脏 = false;
  选块.clear();
  const 是便笺 = (t.形态 || "待办") === "便笺";
  const 是子 = !!(cur && cur.pk);
  const 子项 = 是子 ? [] : children(dCur);
  const 做完 = 子项.filter((c) => c.status === "已完成").length;
  const 形态名 = 是便笺 ? "便笺" : 是子 ? "子待办" : 子项.length ? "待办(带 " + 子项.length + " 条子待办)" : "待办";
  const 源前缀 = !锁定来源 && 来源集.length > 1 ? esc(源名(one.来源)) + " · " : "";
  const 量化 = 源信息(one.来源).量化;
  document.getElementById("dCrumb").innerHTML = `<a data-back title="回待办列表">待办</a><span class="sep">/</span>` + `<span>${源前缀}${形态名} · ${数据ID(t.id)}</span>` + (EMBED ? `<span class="sep">/</span><a href="待办.html?src=${encodeURIComponent(one.来源)}&td=${t.id}" target="_blank" rel="noopener" title="在完整的待办中心里打开这一条">在待办中心打开 ↗</a>` : "");
  document.getElementById("dBody").innerHTML = `
    <div class="dgrid">
      <div class="dmain">
        <div class="dhead">
          <div class="dtitle-row" data-ai-title-root>
            <h1 class="dtitle" contenteditable="true" spellcheck="false" data-fld-matter
              title="这就是事项本身,点一下直接改;改完点别处或按回车就存"></h1>
            <button class="aititle-btn" type="button" data-ai-title aria-label="AI 拟标题"
              title="按当前正文拟一个标题;拟好先给你看,点「采用」才会替换">✦</button>
            <button class="addbtn" data-add="text" title="接一段文字">＋ 文字</button>
            <button class="addbtn" data-add="img" title="从电脑里选一张图插进正文">\uD83D\uDDBC 图片</button>
            <button class="addbtn" data-undo disabled title="撤回这条待办的上一步修改">↶ 撤销</button>
            <button class="addbtn" data-redo disabled title="还原刚才撤销的修改">↷ 还原</button>
            <button class="addbtn" data-history title="看这条待办一个月内的修改快照">\uD83D\uDD50 历史</button>
            <button class="addbtn" data-ai速记 title="把上面这段随手记的话,整理成有小标题、有条目的笔记。整理稿先给你看,点了「采用」才会替换,图片不会丢">✨ AI 速记</button>
          </div>
          <div class="aititle-result" data-ai-title-result aria-live="polite"></div>
        </div>
        <div class="dsec">
          <div class="doc" data-doc></div>
        </div>

      </div>

      <aside class="dside">
        <div class="dresize" role="separator" aria-orientation="vertical" tabindex="0"
          title="横着拖这条线,改右边那栏的宽窄;点中它按 ← → 也能调"></div>
        <div class="sf sf-acts">
          <div class="dacts act3row">
            <button class="次钮 act3 arch${t.归档 ? " on" : ""}" data-arch title="${t.归档 ? "取消归档:这条重新出现在待办列表里" : "归档后这条不再出现在列表里,记录全保留,列表页勾「显示归档」能看回来"}">${t.归档 ? "已归档 ✓" : "归档"}</button>
          </div>
        </div>
        <div class="sf">
          <div class="sf-h"><b>属性</b><span class="form-tag">${形态名}${是便笺 ? ' <button class="次钮" data-tonormal title="转成普通待办:编号、正文、附件、评论全保留,只是不再算便笺">转成待办</button>' : ""}</span></div>
          <div class="g2">
            <div><span class="sl">状态</span>${stSelDetailHTML(t.状态)}</div>
            <div><span class="sl">重要程度</span><span class="stars" role="group" aria-label="重要程度,点第几颗就是几星" data-fld-star title="点第几颗就是几星(三颗满)">${starHTML(t.重要程度, true)}</span></div>
          </div>
          <div style="margin-top:12px"><span class="sl">计划完成时间</span>
            <input type="date" data-fld-due value="${esc(t.计划完成时间 || "")}" title="打算哪天做完;空着=没排期"></div>
          <div class="g2" style="margin-top:12px">
            <div><span class="sl">创建时间</span><span class="sv ctime">${(t.创建时间 || "—").split(" ").map(esc).join("<br>")}</span></div>
            <div><span class="sl">最后修改时间</span><span class="sv ctime">${(t.最后修改时间 || "—").split(" ").map(esc).join("<br>")}</span></div>
            <div title="这条待办的数据 ID,新建时自动发的,不会变;搜索框里打它能直接找到这条"><span class="sl">ID</span><span class="sv ctime"><span class="编号">${数据ID(t.id)}</span>
              <button class="次钮 id-copy" type="button" onclick="复制ID(${+t.id}, this)" title="把 ${数据ID(t.id)} 复制走">⧉ 复制</button></span></div>
          </div>
          ${量化 ? `<div style="margin-top:12px"><span class="sl">目标数(量化 · 可选)</span>
            <input type="number" min="1" data-fld-target value="${esc(t.目标数 || "")}"
              title="量化任务目标(如 100);进度=已挂的「${esc(源信息(one.来源).计数类型 || "")}」关联数;清空=撤掉量化"></div>` : ""}
          ${量化 && t.目标数 ? `<div style="margin-top:12px"><span class="sl">进度</span><span class="sv ctime">${cur && cur.prog || 0} / ${esc(t.目标数)}</span></div>` : ""}
        </div>

        <div class="sf card-sub">
          <div class="sf-h"><b>子待办 <span class="cnt">${做完}/${子项.length}</span></b>
            <button class="次钮" data-addsub title="给这条待办拆一件小事出来(只能拆一层,子待办底下不再有子待办)">＋ 新建</button></div>
          ${子项.length ? `<div class="subbar" title="${做完} / ${子项.length} 条做完了"><b style="width:${Math.round(做完 / 子项.length * 100)}%"></b></div>` : ""}
          ${子项.length ? 子项.map(子行HTML).join("") : '<div class="emptyline">还没有子待办 —— 一件大事拆成几件小事,点上面那颗「＋ 新建」。</div>'}
        </div>

        <div class="sf">
          <div class="sf-h"><b>关联数据</b>${Object.keys(源信息(one.来源).关联字段 || {}).length ? `<button class="次钮" data-linkadd title="从${esc(源名(one.来源))}的数据里搜着挑,挂到这条待办上">关联</button>` : ""}</div>
          <div class="sf-note">这条待办挂着的关联数据</div>
          <div class="chips" data-linkedit>${(cur.links || []).map((l) => 关联chipHTML(l, cur.src || one.来源)).join("") || '<span class="emptyline" style="padding:0">还没挂关联数据</span>'}</div>
        </div>

        <div class="sf">
          <div class="sf-h"><b>附件</b><label class="次钮" title="PDF / Excel / CSV 这类非图文件;图片请用正文里的「\uD83D\uDDBC 图片」">添加文件<input type="file" multiple data-filepick hidden></label></div>
          <div class="sf-note">非图文件,点名字下载</div>
          <div data-filelist>${(det.文件 || []).map(文件行HTML).join("") || '<span class="emptyline" style="padding:0">还没有附件</span>'}</div>
        </div>

        <div class="sf">
          <div class="sf-h"><b>评论 <span class="cnt">${(det.评论 || []).length}</span></b></div>
          <div style="margin-top:6px">
            <textarea class="cmtbox" data-cmttext rows="2" placeholder="写评论…(Ctrl+Enter 添加)"></textarea>
            <div class="imgrow" data-stageimgs><label class="addimg" style="width:auto;padding:0 10px" title="给评论加图 / 文件(图片自动归评论图,其余当文件)">\uD83D\uDCCE 加图 / 文件<input type="file" multiple data-stagefile hidden></label></div>
            <div data-stagefiles></div>
            <div class="foot" style="margin-top:6px"><button class="主钮" data-cmtsubmit>添加</button></div>
          </div>
          <div data-cmtlist style="margin-top:10px">${(det.评论 || []).map(评论HTML).join("") || '<div class="emptyline" style="padding:6px 0">还没有评论</div>'}</div>
        </div>
        ${速记原文HTML(t)}
      </aside>
    </div>`;
  document.querySelector("#dBody .dtitle").textContent = t.事项 || "";
  画块();
  bindDetail(det);
}
let 编器 = null;
function 编器根() {
  return 编器 && 编器.根 || document.getElementById("dBody");
}
function 文档元素() {
  const r = 编器根();
  return r ? r.querySelector("[data-doc]") : null;
}
function 暂存态() {
  return !!编器 && !编器.k;
}
function 正文落点() {
  return 编器 ? 编器.k || null : dCur;
}
function 编器在() {
  return !!编器 || dCur != null;
}
function 图源(b) {
  if (b && b.暂)
    return b.暂.dataURL;
  if (b && b.待抓)
    return b.待抓;
  return 图URL(b && b.附件id);
}
let 可见块 = [];
let 选块 = new Set;
const 层of = (b) => Math.max(0, Math.min(6, +(b && b.层) || 0));
function 落层(锚) {
  if (!锚)
    return 0;
  if (锚.type === "fold") {
    锚.展开 = true;
    return Math.min(6, 层of(锚) + 1);
  }
  return 层of(锚);
}
function 跟着落点(nb, 锚) {
  const lv = 落层(锚);
  if (lv)
    nb.层 = lv;
  if (锚 && 锚.组 && !nb.组)
    nb.组 = 锚.组;
  return nb;
}
function 新组名() {
  return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function 今天字串() {
  const d = new Date, 两 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${两(d.getMonth() + 1)}-${两(d.getDate())}`;
}
function 当前时间字串() {
  const d = new Date, 两 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${两(d.getMonth() + 1)}-${两(d.getDate())} ${两(d.getHours())}:${两(d.getMinutes())}:${两(d.getSeconds())}`;
}
function 理层() {
  let 上 = -1;
  块.forEach((b) => {
    const lv = Math.max(0, Math.min(层of(b), 上 + 1));
    if (lv)
      b.层 = lv;
    else
      delete b.层;
    上 = lv;
  });
}
function 后代尾(i) {
  const lv = 层of(块[i]);
  let j = i + 1;
  while (j < 块.length && 层of(块[j]) > lv)
    j++;
  return j;
}
function 含后代(objs) {
  const 出 = new Set;
  objs.forEach((b) => {
    const i = 块.indexOf(b);
    if (i < 0)
      return;
    出.add(b);
    const 尾 = 后代尾(i);
    for (let j = i + 1;j < 尾; j++)
      出.add(块[j]);
  });
  return 块.filter((b) => 出.has(b));
}
let 块菜单 = null;
function 删块(idx) {
  const b = 块[idx];
  if (!b)
    return;
  const 走 = 含后代([b]);
  走.forEach((x) => {
    const i = 块.indexOf(x);
    if (i >= 0)
      块.splice(i, 1);
  });
  if (!块.length)
    块.push({ type: "text", text: "" });
  选块.clear();
  关块菜单();
  画块();
  存块();
  toast(走.length > 1 ? `已删这一块和它底下的 ${走.length - 1} 块` : b.type === "img" ? "已删块(图块连图一起清)" : "已删块");
}
function 关块菜单() {
  if (块菜单)
    块菜单.remove();
  块菜单 = null;
  document.removeEventListener("mousedown", 块菜单外关);
}
function 块菜单外关(e) {
  if (块菜单 && !块菜单.contains(e.target) && !e.target.closest(".bh.grip"))
    关块菜单();
}
function 开块菜单(grip, idx) {
  关块菜单();
  const box = document.createElement("div");
  box.id = "_blockMenu";
  box.className = "menu open blockmenu";
  box.style.position = "fixed";
  box.innerHTML = '<button type="button" data-block-add>在下面加一块</button>' + (块[idx] && 块[idx].type === "img" ? '<button type="button" data-block-copyimg>复制图片</button>' : "") + '<button type="button" data-block-del>删除这一块</button>';
  document.body.appendChild(box);
  const r = grip.getBoundingClientRect();
  box.style.left = Math.max(8, Math.min(r.right + 4, innerWidth - box.offsetWidth - 8)) + "px";
  box.style.top = Math.max(8, Math.min(r.bottom + 2, innerHeight - box.offsetHeight - 8)) + "px";
  box.querySelector("[data-block-add]").addEventListener("click", () => {
    const b = 块[idx];
    if (!b) {
      关块菜单();
      return;
    }
    const nb = { type: "text", text: "" };
    if (层of(b))
      nb.层 = 层of(b);
    if (b.组)
      nb.组 = b.组;
    块.splice(idx + 1, 0, nb);
    关块菜单();
    画块();
    存块();
    聚焦块(idx + 1);
  });
  box.querySelector("[data-block-del]").addEventListener("click", () => 删块(idx));
  const 复制图 = box.querySelector("[data-block-copyimg]");
  if (复制图)
    复制图.addEventListener("click", () => 复制图块(块[idx]));
  块菜单 = box;
  setTimeout(() => document.addEventListener("mousedown", 块菜单外关), 0);
}
async function 复制图块(b) {
  try {
    const res = await fetch(图源(b));
    if (!res.ok)
      throw new Error("图片没取到");
    let blob = await res.blob();
    if (blob.type !== "image/png") {
      const bm = await createImageBitmap(blob), cv = document.createElement("canvas");
      cv.width = bm.width;
      cv.height = bm.height;
      cv.getContext("2d").drawImage(bm, 0, 0);
      blob = await new Promise((ok, no) => cv.toBlob((x) => x ? ok(x) : no(new Error("转 png 没成")), "image/png"));
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    toast("图片已复制");
    关块菜单();
  } catch (_) {
    toast("这张图没复制成(浏览器不让写剪贴板)", true);
  }
}
function 开图菜单(e, b) {
  关块菜单();
  const box = document.createElement("div");
  box.id = "_blockMenu";
  box.className = "menu open blockmenu";
  box.style.position = "fixed";
  box.innerHTML = (卡宿 === "note" && window.UI看图 ? '<button type="button" data-img-view>查看大图</button>' : "") + '<button type="button" data-img-copy>复制图片</button>' + '<button type="button" data-img-del>删除图片</button>';
  document.body.appendChild(box);
  const 缩 = 壳缩(), 宽 = box.getBoundingClientRect().width, 高 = box.getBoundingClientRect().height;
  box.style.left = Math.max(8, Math.min(e.clientX, innerWidth - 宽 - 8)) / 缩 + "px";
  box.style.top = Math.max(8, Math.min(e.clientY, innerHeight - 高 - 8)) / 缩 + "px";
  const 看 = box.querySelector("[data-img-view]");
  if (看)
    看.addEventListener("click", () => {
      关块菜单();
      UI看图.开([{ src: new URL(图源(b), location.href).href, 名: "便笺里的图" }]);
    });
  box.querySelector("[data-img-copy]").addEventListener("click", () => 复制图块(b));
  box.querySelector("[data-img-del]").addEventListener("click", () => {
    const i = 块.indexOf(b);
    if (i >= 0)
      删块(i);
    else
      关块菜单();
  });
  块菜单 = box;
  setTimeout(() => document.addEventListener("mousedown", 块菜单外关), 0);
}
let 键选图回 = null;
function 选中图块(b, 回) {
  const a = document.activeElement;
  if (a && a.isContentEditable && a.blur)
    a.blur();
  const sel = getSelection();
  if (sel)
    sel.removeAllRanges();
  选块 = new Set([b]);
  键选图回 = 回 || null;
  刷选中标();
}
function 画块() {
  const docEl = 文档元素();
  if (!docEl)
    return;
  理层();
  docEl.innerHTML = "";
  可见块 = [];
  let 序 = 0, 段容 = null, 段名 = "", 段宿 = null;
  const 折叠栈 = [];
  块.forEach((b, idx) => {
    序 = b.type === "ol" ? 序 + 1 : 0;
    while (折叠栈.length && 层of(b) <= 折叠栈[折叠栈.length - 1].层)
      折叠栈.pop();
    const 父折 = 折叠栈.length ? 折叠栈[折叠栈.length - 1] : null;
    const 宿 = 父折 ? 父折.kids : docEl;
    const 真可见 = 折叠栈.every((x) => x.展开) && !b.组收起;
    const el = document.createElement("div");
    el.className = "block bk-" + (b.type || "text") + (b.type === "todo" && b.勾 ? " done" : "") + (选块.has(b) ? " selblk" : "");
    el.dataset.idx = idx;
    const 相对层 = Math.max(0, 层of(b) - (父折 ? 父折.层 + 1 : 0));
    if (相对层)
      el.style.marginLeft = 相对层 * 22 + "px";
    const handles = document.createElement("div");
    handles.className = "bhandles";
    handles.innerHTML = `<span class="bh grip" title="单击打开块菜单;拖动排序。拖到折叠块 / 勾选行 / 序号行 / 圆点行的正中间,就塞进那一条底下">⠿</span>`;
    const body = document.createElement("div");
    body.className = "bbody";
    画一块(b, idx, body, docEl, 序);
    绑拖排序(handles.querySelector(".grip"), el, idx, docEl);
    el.appendChild(handles);
    el.appendChild(body);
    const g = String(b.组 || "");
    if (g) {
      if (!段容 || 段名 !== g || 段宿 !== 宿) {
        段容 = 建段容器(宿, g, docEl);
        段名 = g;
        段宿 = 宿;
      }
      段容.querySelector(".gbody").appendChild(el);
    } else {
      段容 = null;
      段名 = "";
      段宿 = null;
      宿.appendChild(el);
    }
    if (真可见)
      可见块.push({ idx, el, b });
    if (b.type === "fold") {
      const fold = body.querySelector(".bkfold");
      const kids = document.createElement("div");
      kids.className = "bkfold-kids";
      kids.hidden = !b.展开;
      fold.appendChild(kids);
      折叠栈.push({ 层: 层of(b), kids, 展开: !!b.展开 });
      段容 = null;
      段名 = "";
      段宿 = null;
    }
  });
  docEl.querySelectorAll(".bgroup").forEach((box) => {
    const 同组 = 块.filter((x) => String(x.组 || "") === box.dataset.g), n = 同组.length;
    const 摘 = 同组.map((x) => x.text || x.标题 || "").find(Boolean) || "";
    box.querySelector(".gname").textContent = `一段 · ${n} 块${同组.some((x) => x.组收起) && 摘 ? " · " + 摘.slice(0, 18) : ""}`;
  });
}
function 建段容器(宿, g, docEl) {
  const box = document.createElement("div");
  box.className = "bgroup";
  box.dataset.g = g;
  const head = document.createElement("div");
  head.className = "ghead";
  const 同组 = 块.filter((x) => String(x.组 || "") === g), 收 = 同组.some((x) => x.组收起);
  head.innerHTML = `<button class="gfold" data-gfold type="button" title="收起或展开这一段">${收 ? "▶" : "▼"}</button>` + `<span class="gh grip" title="按住这里拖,整段一起搬。拖到折叠块 / 勾选行 / 序号行的正中间,整段就塞进那一条底下">⠿</span>` + `<span class="gname" title="这几块圈成了一段:同一次粘进来的,或者你敲 / 选了「整段」。拖段头上那个 ⠿ 能整段搬走"></span>` + `<button class="gx" type="button" title="拆开之后这几块各归各的,一个字都不会变">拆开</button>`;
  const gb = document.createElement("div");
  gb.className = "gbody";
  gb.hidden = 收;
  box.appendChild(head);
  box.appendChild(gb);
  宿.appendChild(box);
  head.querySelector(".gx").addEventListener("click", (ev) => {
    ev.stopPropagation();
    块.forEach((x) => {
      if (String(x.组 || "") === g) {
        delete x.组;
        delete x.组收起;
      }
    });
    画块();
    存块();
    toast("这一段拆开了,内容一个字没动");
  });
  head.querySelector("[data-gfold]").addEventListener("click", (ev) => {
    ev.stopPropagation();
    const 到 = !块.find((x) => String(x.组 || "") === g)?.组收起;
    块.forEach((x) => {
      if (String(x.组 || "") === g)
        x.组收起 = 到;
    });
    画块();
    存块();
  });
  绑段拖(head.querySelector(".gh"), g, docEl);
  return box;
}
function 表格矩形(b) {
  let 行 = Array.isArray(b.行) ? b.行.slice(0, 50) : [];
  if (!行.length)
    行 = [[""]];
  const 列数 = Math.max(1, Math.min(10, Array.isArray(行[0]) ? 行[0].length : 0));
  b.行 = 行.map((r) => {
    const 一行 = (Array.isArray(r) ? r : []).slice(0, 列数).map((v) => String(v == null ? "" : v).slice(0, 500));
    while (一行.length < 列数)
      一行.push("");
    return 一行;
  });
  return b.行;
}
let 外拖 = null;
const 松名 = (n) => String(n || "").replace(/[^\p{L}\p{N}]/gu, "");
function 交壳拖出(e, 址, 名) {
  if (!(window.壳拖出 && window.壳拖出(址, 名)))
    return false;
  e.preventDefault();
  外拖 = { 名: 松名(名), 时: Date.now() };
  框起 = null;
  交出时 = Date.now();
  return true;
}
let 交出时 = 0;
window.addEventListener("pointerdown", () => {
  交出时 = 0;
}, true);
window.addEventListener("click", (e) => {
  if (!交出时 || Date.now() - 交出时 > 2000)
    return;
  交出时 = 0;
  e.preventDefault();
  e.stopPropagation();
}, true);
const 图扩 = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/gif": "gif", "image/webp": "webp" };
function 图拖出名(aid) {
  const a = ((当前详情数据 || {}).详情图 || []).find((x) => +x.id === +aid) || 附件撤销缓存.get(+aid) || {};
  const 名 = String(a.原名 || "").trim();
  if (/\.[A-Za-z0-9]{2,5}$/.test(名))
    return 名;
  return (名 || "便笺图片") + "." + (图扩[a.mime] || "png");
}
function 画文件块(b, body) {
  const f = b.暂文 || 块文件.find((x) => +x.id === +b.附件id);
  const line = document.createElement("div");
  line.className = "bkfile";
  if (!f) {
    const 符 = document.createElement("i");
    符.className = "符";
    符.textContent = "✗";
    line.classList.add("missing");
    line.replaceChildren(符, " 这个附件已经被删掉了");
    line.title = "附件记录已经不在了;单击左边的 ⠿，可从菜单删除这一块";
    body.appendChild(line);
    return;
  }
  const info = document.createElement("span");
  info.textContent = `\uD83D\uDCC4 ${f.原名 || "附件"} · ${大小人话(f.字节)}`;
  const down = document.createElement("a");
  down.textContent = "下载";
  down.download = f.原名 || "";
  down.title = `下载 ${f.原名 || "附件"}`;
  down.href = b.暂文 ? `data:${f.mime || "application/octet-stream"};base64,${f.base64 || ""}` : `/api/todo/file?id=${b.附件id}&src=${encodeURIComponent(拆K(正文落点()).来源)}`;
  if (!b.暂文) {
    const 址 = new URL(down.href, location.href).href, 名 = String(f.原名 || "附件").replace(/[:\r\n]/g, "_");
    line.draggable = true;
    down.draggable = false;
    line.title = "按住拖到桌面或微信里,就是这个文件";
    line.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      if (交壳拖出(e, 址, f.原名 || "附件"))
        return;
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("DownloadURL", `${f.mime || "application/octet-stream"}:${名}:${址}`);
    });
  }
  line.appendChild(info);
  line.appendChild(down);
  body.appendChild(line);
}
function 画表格块(b, body) {
  const 行 = 表格矩形(b), wrap = document.createElement("div");
  wrap.className = "bktable-wrap 表框";
  const 表框外 = document.createElement("div");
  表框外.className = "表框外";
  表框外.appendChild(wrap);
  const tools = document.createElement("div");
  tools.className = "bktable-tools";
  const 表头钮 = document.createElement("button");
  表头钮.type = "button";
  表头钮.textContent = (b.表头 ? "✓ " : "○ ") + "第一行当表头";
  表头钮.title = b.表头 ? "第一行现在是表头;点一下改回普通行" : "第一行现在是普通行;点一下把它设成表头";
  表头钮.setAttribute("aria-pressed", b.表头 ? "true" : "false");
  表头钮.addEventListener("click", () => {
    b.表头 = !b.表头;
    画块();
    存块();
  });
  const 加列 = document.createElement("button");
  加列.type = "button";
  加列.textContent = "＋ 列";
  加列.disabled = 行[0].length >= 10;
  加列.title = 加列.disabled ? "最多 10 列" : "在右边添加一列";
  加列.addEventListener("click", () => {
    行.forEach((r) => r.push(""));
    画块();
    存块();
  });
  const 改表格 = document.createElement("button");
  改表格.type = "button";
  改表格.className = "bktable-edit";
  const 画改表格 = () => {
    wrap.classList.toggle("bktable-editing", !!b._改表格);
    改表格.textContent = b._改表格 ? "✓ 改完" : "✎ 改表格";
    改表格.setAttribute("aria-pressed", b._改表格 ? "true" : "false");
  };
  改表格.addEventListener("click", () => {
    b._改表格 = !b._改表格;
    画改表格();
  });
  tools.appendChild(表头钮);
  tools.appendChild(加列);
  tools.appendChild(改表格);
  wrap.appendChild(tools);
  画改表格();
  const table = document.createElement("table");
  table.className = "bktable";
  const 列头 = document.createElement("thead"), 控制行 = document.createElement("tr");
  const 空头 = document.createElement("th");
  空头.className = "bktable-rowctl";
  控制行.appendChild(空头);
  行[0].forEach((_, c) => {
    const th = document.createElement("th"), del = document.createElement("button");
    del.type = "button";
    del.className = "bktable-delete";
    del.textContent = "✗ 列";
    del.disabled = 行[0].length <= 1;
    del.title = del.disabled ? "只剩一列,不能再删" : `删除第 ${c + 1} 列`;
    del.addEventListener("click", () => {
      行.forEach((r) => r.splice(c, 1));
      画块();
      存块();
    });
    th.appendChild(del);
    控制行.appendChild(th);
  });
  列头.appendChild(控制行);
  table.appendChild(列头);
  const tbody = document.createElement("tbody");
  行.forEach((r, ri) => {
    const tr = document.createElement("tr"), ctl = document.createElement("td"), del = document.createElement("button");
    del.type = "button";
    del.className = "bktable-delete";
    del.textContent = "✗ 行";
    del.disabled = 行.length <= 1;
    del.title = del.disabled ? "只剩一行,不能再删" : `删除第 ${ri + 1} 行`;
    del.addEventListener("click", () => {
      行.splice(ri, 1);
      画块();
      存块();
    });
    ctl.className = "bktable-rowctl";
    ctl.appendChild(del);
    tr.appendChild(ctl);
    r.forEach((v, ci) => {
      const cell = document.createElement(b.表头 && ri === 0 ? "th" : "td");
      cell.className = "bkcell";
      cell.contentEditable = "true";
      cell.spellcheck = false;
      cell.textContent = v;
      cell.addEventListener("input", () => {
        b.行[ri][ci] = cell.innerText.slice(0, 500);
        记脏();
        if (卡宿 === "note")
          排便笺自动存();
      });
      cell.addEventListener("blur", () => {
        if (卡宿 === "note") {
          便笺立刻存();
          return;
        }
        if (块脏)
          存块();
      });
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          return;
        }
        if (e.key !== "Tab")
          return;
        e.preventDefault();
        const 格 = [...wrap.querySelectorAll(".bkcell")], i = 格.indexOf(cell), n = i + (e.shiftKey ? -1 : 1);
        if (n >= 0 && n < 格.length)
          格[n].focus();
      });
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  const 加行 = document.createElement("button");
  加行.type = "button";
  加行.className = "bktable-addrow";
  加行.textContent = "＋ 行";
  加行.disabled = 行.length >= 50;
  加行.title = 加行.disabled ? "最多 50 行" : "在下面添加一行";
  加行.addEventListener("click", () => {
    行.push(Array(行[0].length).fill(""));
    画块();
    存块();
  });
  wrap.appendChild(加行);
  body.appendChild(表框外);
}
const 码色类 = {
  keyword: "kw",
  boolean: "kw",
  important: "kw",
  atrule: "kw",
  rule: "kw",
  builtin: "kw",
  "class-name": "kw",
  string: "str",
  char: "str",
  "attr-value": "str",
  "template-string": "str",
  regex: "str",
  url: "str",
  inserted: "str",
  comment: "com",
  prolog: "com",
  doctype: "com",
  cdata: "com",
  number: "num",
  constant: "num",
  symbol: "num",
  entity: "num",
  tag: "tag",
  selector: "tag",
  "attr-name": "tag",
  property: "tag",
  deleted: "tag",
  title: "tag",
  punctuation: "op",
  operator: "op"
};
const 码语别名 = { "c++": "cpp", golang: "go", node: "javascript", vue: "markup", shell: "bash", zsh: "bash", ps: "bash", text: "", txt: "", plain: "" };
const 码高亮名 = ["kw", "str", "com", "num", "tag", "op"];
function 码语法(名) {
  const P = window.Prism;
  if (!P || !P.languages)
    return null;
  let k = String(名 || "").trim().toLowerCase();
  if (!k)
    return null;
  if (k in 码语别名)
    k = 码语别名[k];
  const g = k && P.languages[k];
  return g && typeof g === "object" ? g : null;
}
function 码块范围(pre, 收) {
  const g = 码语法(pre.dataset.lang);
  if (!g)
    return;
  const 段 = [], 文 = 可编字(pre, null, 段);
  if (!段.length || 文.length > 200000)
    return;
  const 落 = (a, z, 类) => {
    for (const x of 段) {
      const 头 = x.起, 尾 = x.起 + x.n.data.length;
      if (尾 <= a || 头 >= z)
        continue;
      const r = document.createRange();
      r.setStart(x.n, Math.max(a, 头) - 头);
      r.setEnd(x.n, Math.min(z, 尾) - 头);
      收[类].push(r);
    }
  };
  let 位 = 0;
  (function 铺(词们, 外类) {
    for (const t of 词们) {
      if (typeof t === "string") {
        if (外类)
          落(位, 位 + t.length, 外类);
        位 += t.length;
        continue;
      }
      const 类 = 码色类[t.type] || [].concat(t.alias || []).map((a) => 码色类[a]).find(Boolean) || 外类;
      if (typeof t.content === "string") {
        if (类)
          落(位, 位 + t.content.length, 类);
        位 += t.content.length;
      } else
        铺([].concat(t.content), 类);
    }
  })(window.Prism.tokenize(文, g), "");
}
function 刷代码高亮() {
  if (!能高亮)
    return;
  const 收 = {};
  码高亮名.forEach((k) => {
    收[k] = [];
  });
  document.querySelectorAll(".bkcode[data-lang]").forEach((pre) => {
    if (pre.dataset.lang && pre.isConnected)
      码块范围(pre, 收);
  });
  码高亮名.forEach((k) => {
    if (!收[k].length) {
      CSS.highlights.delete("code-" + k);
      return;
    }
    const h = new Highlight(...收[k]);
    h.priority = -1;
    CSS.highlights.set("code-" + k, h);
  });
}
let 码高亮T = 0;
function 排代码高亮() {
  clearTimeout(码高亮T);
  码高亮T = setTimeout(刷代码高亮, 60);
}
function 画一块(b, idx, body, docEl, 序) {
  const t = b.type || "text";
  if (t === "img")
    return 画图块(b, body, docEl);
  if (t === "file")
    return 画文件块(b, body);
  if (t === "table")
    return 画表格块(b, body);
  if (t === "hr") {
    const hr = document.createElement("hr");
    hr.className = "bkhr";
    hr.title = "分隔线 —— 要删它就单击左边的 ⠿，再选「删除这一块」";
    body.appendChild(hr);
    return;
  }
  if (t === "code") {
    const 头 = document.createElement("div");
    头.className = "bkcode-头";
    const lang = document.createElement("input");
    lang.className = "bklang";
    lang.placeholder = "语言(可以不填)";
    lang.value = b.lang || "";
    lang.title = "填 js / ts / py / html / css / json / sql / sh 这类语言名,代码就按它上色;空着不上色";
    const pre = document.createElement("div");
    pre.className = "bkcode";
    pre.title = "代码原样保留空格和换行;回车 = 换行,不会新起一块";
    pre.dataset.lang = b.lang || "";
    lang.addEventListener("input", () => {
      pre.dataset.lang = lang.value.trim();
      排代码高亮();
    });
    lang.addEventListener("change", () => {
      b.lang = lang.value.trim();
      存块();
    });
    const 复 = document.createElement("button");
    复.type = "button";
    复.className = "bkcopy";
    复.textContent = "⧉ 复制";
    复.title = "把这段代码原样复制走(不带颜色)";
    复.addEventListener("mousedown", (e) => e.preventDefault());
    复.addEventListener("click", async (e) => {
      e.stopPropagation();
      const 成 = await 复制文本(b.text != null ? String(b.text) : pre.innerText);
      复.textContent = 成 ? "已复制" : "复制失败";
      clearTimeout(复._T);
      复._T = setTimeout(() => {
        复.textContent = "⧉ 复制";
      }, 2000);
    });
    绑可编(pre, b, "text", idx);
    pre.addEventListener("input", 排代码高亮);
    头.appendChild(lang);
    头.appendChild(复);
    body.appendChild(头);
    body.appendChild(pre);
    排代码高亮();
    return;
  }
  if (t === "fold") {
    const box = document.createElement("div");
    box.className = "bkfold";
    const h = document.createElement("div");
    h.className = "bkfold-h";
    const tri = document.createElement("span");
    tri.className = "bkfold-t";
    const 内 = document.createElement("div");
    内.className = "bkfold-b";
    const 刷三角 = () => {
      tri.textContent = b.展开 ? "▾" : "▸";
      tri.title = b.展开 ? "点一下收起来 —— 连塞进它底下的那些块一起收" : "点一下展开(里面还有内容)";
      内.hidden = !b.展开;
    };
    const ti = document.createElement("div");
    ti.className = "bkfold-title";
    绑可编(ti, b, "标题", idx);
    绑可编(内, b, "text", idx);
    刷三角();
    tri.addEventListener("click", () => {
      b.展开 = !b.展开;
      画块();
      存块();
    });
    h.appendChild(tri);
    h.appendChild(ti);
    box.appendChild(h);
    box.appendChild(内);
    body.appendChild(box);
    return;
  }
  if (t === "h") {
    const el = document.createElement("div");
    el.className = "bkh lv" + (b.级 || 2);
    el.title = ["", "一级标题(最大)", "二级标题", "三级标题(最小)"][b.级 || 2];
    绑可编(el, b, "text", idx);
    body.appendChild(el);
    return;
  }
  if (t === "quote") {
    const el = document.createElement("div");
    el.className = "bkquote";
    绑可编(el, b, "text", idx);
    body.appendChild(el);
    return;
  }
  if (t === "date") {
    const line = document.createElement("div");
    line.className = "bkdate";
    const 日期 = document.createElement("input");
    日期.type = "date";
    日期.value = b.日期 || "";
    const 时间 = document.createElement("input");
    时间.type = "time";
    时间.value = b.时间 || "";
    const 说 = document.createElement("span");
    说.textContent = "正文里记个日子";
    说.title = "这是正文里的一个日子,跟右边属性里的「计划完成时间」是两回事,不影响这条待办到没到期";
    日期.addEventListener("change", () => {
      b.日期 = 日期.value;
      存块();
    });
    时间.addEventListener("change", () => {
      if (时间.value)
        b.时间 = 时间.value;
      else
        delete b.时间;
      存块();
    });
    line.appendChild(日期);
    line.appendChild(时间);
    line.appendChild(说);
    body.appendChild(line);
    return;
  }
  if (t === "ul" || t === "ol" || t === "todo") {
    const line = document.createElement("div");
    line.className = "bkline";
    if (t === "todo") {
      const ck = document.createElement("input");
      ck.type = "checkbox";
      ck.className = "bkck";
      ck.checked = !!b.勾;
      ck.title = "打勾 = 这一行做完了(只是正文里的一行,不影响这条待办本身的状态)";
      ck.addEventListener("change", () => {
        b.勾 = ck.checked;
        画块();
        存块();
      });
      line.appendChild(ck);
    } else {
      const m = document.createElement("span");
      m.className = "bkmark";
      m.textContent = t === "ol" ? 序 + "." : "·";
      line.appendChild(m);
    }
    const tx = document.createElement("div");
    tx.className = "bktext";
    tx.title = "回车 = 下面接一条同样的;内容空着再按回车 = 退回普通文字";
    绑可编(tx, b, "text", idx);
    line.appendChild(tx);
    body.appendChild(line);
    return;
  }
  const tx = document.createElement("div");
  tx.className = "btext";
  绑可编(tx, b, "text", idx);
  body.appendChild(tx);
}
function 画图块(b, body, docEl) {
  const wrap = document.createElement("div");
  wrap.className = "bimgwrap al-" + (b.al || "left") + (b.w ? " sized" : "");
  if (b.w)
    wrap.style.width = b.w + "px";
  const bar = document.createElement("div");
  bar.className = "imbar";
  bar.innerHTML = ["left", "center", "right"].map((al, i) => `<span class="ib${(b.al || "left") === al ? " on" : ""}" data-al="${al}">${["左", "中", "右"][i]}</span>`).join("");
  const fig = document.createElement("div");
  fig.className = "bimg";
  fig.innerHTML = `<img src="${图源(b)}" alt="" draggable="false"><span class="rz" title="拖动改大小"></span>`;
  if (window.壳拖出 && b.附件id && !b.暂 && !b.待抓) {
    const 图 = fig.querySelector("img");
    图.draggable = true;
    图.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      if (!交壳拖出(e, new URL(图源(b), location.href).href, 图拖出名(b.附件id)))
        e.preventDefault();
    });
  }
  bar.querySelectorAll(".ib").forEach((ib) => ib.addEventListener("click", (ev) => {
    ev.stopPropagation();
    b.al = ib.dataset.al;
    画块();
    存块();
  }));
  if (卡宿 === "note") {
    const img = fig.querySelector("img");
    img.setAttribute("data-看图", "");
    img.setAttribute("data-看图名", "便笺里的图");
    img.title = "点击查看大图";
    const 看 = document.createElement("button");
    看.type = "button";
    看.className = "ib 看大图";
    看.textContent = "⤢";
    看.title = "查看大图";
    看.setAttribute("aria-label", "查看大图");
    看.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (window.UI看图)
        UI看图.开([{ src: img.currentSrc || img.src, 名: "便笺里的图" }]);
    });
    bar.appendChild(看);
  }
  fig.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    选中图块(b);
    开图菜单(ev, b);
  });
  fig.querySelector("img").addEventListener("error", () => {
    fig.innerHTML = `<div style="border:1px dashed var(--border-strong);border-radius:8px;padding:14px;font-size:var(--f2);color:var(--muted)">\uD83D\uDDBC 图没加载出来${b.待抓 ? "(原网页那张,保存时后台再去抓一次)" : `(附件 ${b.附件id})`}</div>`;
  });
  const wlabel = document.createElement("div");
  wlabel.className = "imw";
  const setW = () => {
    wlabel.textContent = "宽 " + Math.round(fig.getBoundingClientRect().width) + "px · " + { left: "左", center: "中", right: "右" }[b.al || "left"] + "对齐";
  };
  wrap.appendChild(bar);
  wrap.appendChild(fig);
  wrap.appendChild(wlabel);
  body.appendChild(wrap);
  setW();
  fig._setW = setW;
  wrap._setW = setW;
  fig.querySelector("img").addEventListener("load", setW);
  绑拖角(fig.querySelector(".rz"), wrap, b, docEl);
}
function 绑可编(el, b, 字段, idx) {
  el.contentEditable = "true";
  el.spellcheck = false;
  el.dataset.fld = 字段;
  el.textContent = b[字段] || "";
  el.addEventListener("input", () => {
    b[字段] = 可编字(el);
    记脏();
    斜杠跟输入(el);
    if (卡宿 === "note")
      排便笺自动存();
  });
  el.addEventListener("blur", () => {
    关斜杠();
    if (卡宿 === "note") {
      便笺立刻存();
      return;
    }
    if (块脏)
      存块(true);
  });
  el.addEventListener("keydown", (e) => 块键盘(e, b, idx, el, 字段));
  return el;
}
const _行级 = /^(DIV|P|LI|PRE|BLOCKQUOTE|H[1-6])$/;
function 可编字(el, 标, 段) {
  let 文 = "", 待换 = false, 位 = -1;
  const 换 = () => {
    if (待换) {
      文 += `
`;
      待换 = false;
    }
  };
  const 占位BR = (c) => {
    for (let n = c;n !== el; n = n.parentNode) {
      let s = n.nextSibling;
      while (s && s.nodeType === 3 && !s.data)
        s = s.nextSibling;
      if (s)
        return s.nodeType === 1 && _行级.test(s.nodeName);
      if (n.parentNode === el || _行级.test(n.parentNode.nodeName))
        return true;
    }
    return true;
  };
  (function 走(n) {
    const 子 = n.childNodes;
    for (let i = 0;i <= 子.length; i++) {
      if (标 && 位 < 0 && 标.n === n && 标.o === i) {
        换();
        位 = 文.length;
      }
      if (i === 子.length)
        break;
      const c = 子[i];
      if (c.nodeType === 3) {
        if (标 && 位 < 0 && 标.n === c) {
          if (c.data)
            换();
          位 = 文.length + 标.o;
        }
        if (c.data) {
          换();
          if (段)
            段.push({ n: c, 起: 文.length });
          文 += c.data;
        }
      } else if (c.nodeName === "BR") {
        if (!占位BR(c)) {
          换();
          文 += `
`;
        }
      } else if (c.nodeType === 1) {
        if (!_行级.test(c.nodeName)) {
          走(c);
          continue;
        }
        if (待换 || 文 && !文.endsWith(`
`))
          文 += `
`;
        待换 = false;
        走(c);
        待换 = true;
      }
    }
  })(el);
  return 标 ? 位 : 文;
}
function 块内光标(el) {
  const s = getSelection();
  if (!s || !s.rangeCount)
    return -1;
  const r0 = s.getRangeAt(0);
  if (!el.contains(r0.startContainer))
    return -1;
  return 可编字(el, { n: r0.startContainer, o: r0.startOffset });
}
function 聚焦块(i, 字段, 开头) {
  const docEl = 文档元素();
  if (!docEl)
    return;
  const 选 = 字段 ? `[contenteditable][data-fld="${字段}"]` : "[contenteditable]";
  const el = docEl.querySelector(`.block[data-idx="${i}"] ${选}`);
  if (!el)
    return;
  el.focus();
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(!!开头);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}
function 改缩进(idx, d, 字段) {
  const b = 块[idx];
  if (!b)
    return;
  const 上限 = idx === 0 ? 0 : Math.min(6, 层of(块[idx - 1]) + 1);
  const 新 = Math.max(0, Math.min(层of(b) + d, 上限));
  if (新 === 层of(b)) {
    toast(d > 0 ? "再往里缩就跳级了 —— 上面那一条还没这么深" : "已经顶格了", true);
    return;
  }
  const 差 = 新 - 层of(b), 尾 = 后代尾(idx);
  for (let j = idx;j < 尾; j++) {
    const lv = Math.max(0, Math.min(6, 层of(块[j]) + 差));
    if (lv)
      块[j].层 = lv;
    else
      delete 块[j].层;
  }
  画块();
  存块();
  聚焦块(idx, 字段);
}
const _续同类 = { ul: 1, ol: 1, todo: 1 };
function 新同类(b) {
  return b.type === "todo" ? { type: "todo", text: "", 勾: false } : { type: b.type, text: "" };
}
function 块键盘(e, b, idx, el, 字段) {
  if (斜杠键(e))
    return;
  if (e.key === "/") {
    斜杠开(el, b, idx);
    return;
  }
  if (e.key === "Tab") {
    e.preventDefault();
    改缩进(idx, e.shiftKey ? -1 : 1, 字段);
    return;
  }
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    if (_续同类[b.type] || b.type === "h" || b.type === "quote") {
      e.preventDefault();
      if (_续同类[b.type] && !(b[字段] || "").trim()) {
        const 退 = { type: "text", text: "" };
        if (层of(b))
          退.层 = 层of(b);
        if (b.组)
          退.组 = b.组;
        块[idx] = 退;
        画块();
        存块();
        聚焦块(idx);
        return;
      }
      const 续 = _续同类[b.type] ? 新同类(b) : { type: "text", text: "" };
      if (层of(b))
        续.层 = 层of(b);
      if (b.组)
        续.组 = b.组;
      块.splice(idx + 1, 0, 续);
      画块();
      存块();
      聚焦块(idx + 1);
      return;
    }
  }
  if (e.key === "Backspace" && 块内光标(el) === 0 && !(b[字段] || "").length && _续同类[b.type]) {
    e.preventDefault();
    const 退 = { type: "text", text: "" };
    if (层of(b))
      退.层 = 层of(b);
    if (b.组)
      退.组 = b.组;
    块[idx] = 退;
    画块();
    存块();
    聚焦块(idx);
    return;
  }
  if ((e.key === "Backspace" || e.key === "Delete") && getSelection().isCollapsed) {
    const 前 = e.key === "Backspace", 位 = 块内光标(el), i = 可见块.findIndex((v) => v.b === b);
    const 邻 = i >= 0 && 可见块[i + (前 ? -1 : 1)];
    if (邻 && 邻.b.type === "img" && 位 === (前 ? 0 : 可编字(el).replace(/\n$/, "").length)) {
      e.preventDefault();
      e.stopPropagation();
      if (前 && !(b[字段] || "").length && 块.length > 1 && (b.type === "text" || b.type === "h" || b.type === "quote")) {
        块.splice(idx, 1);
        画块();
        存块();
        选中图块(邻.b);
      } else
        选中图块(邻.b, { b, fld: 字段, 头: 前 });
      return;
    }
  }
  if (e.key === "Backspace" && !(b[字段] || "").length && 块.length > 1 && 块内光标(el) === 0 && (b.type === "text" || b.type === "h" || b.type === "quote")) {
    e.preventDefault();
    块.splice(idx, 1);
    画块();
    存块();
    聚焦块(Math.max(0, idx - 1));
  }
}
const 斜杠项 = [
  { 键: "text", 名: "普通文字", 说: "一段话", 造: () => ({ type: "text", text: "" }) },
  { 键: "h1", 名: "一级标题", 说: "最大的那档标题", 造: () => ({ type: "h", text: "", 级: 1 }) },
  { 键: "h2", 名: "二级标题", 说: "中间那档", 造: () => ({ type: "h", text: "", 级: 2 }) },
  { 键: "h3", 名: "三级标题", 说: "最小的那档", 造: () => ({ type: "h", text: "", 级: 3 }) },
  { 键: "ul", 名: "无序列表", 说: "并列的几条,前面带圆点", 造: () => ({ type: "ul", text: "" }) },
  { 键: "ol", 名: "有序列表", 说: "带 1. 2. 3. 的序号", 造: () => ({ type: "ol", text: "" }) },
  { 键: "todo", 名: "待办勾选", 说: "正文里能打勾的一行", 造: () => ({ type: "todo", text: "", 勾: false }) },
  { 键: "code", 名: "代码段", 说: "等宽字,空格换行原样留住", 造: () => ({ type: "code", text: "" }) },
  { 键: "fold", 名: "折叠块", 说: "点标题才展开的一段", 造: () => ({ type: "fold", 标题: "", text: "", 展开: true }) },
  { 键: "quote", 名: "引用", 说: "左边带竖线的一段原话", 造: () => ({ type: "quote", text: "" }) },
  { 键: "file", 名: "文件", 说: "从这台电脑里选一份", 造: null },
  { 键: "table", 名: "表格", 说: "先放一个两列两行的表格", 造: () => ({ type: "table", 表头: true, 行: [["", ""], ["", ""]] }) },
  { 键: "date", 名: "日期", 说: "正文里记一个日子", 造: () => ({ type: "date", 日期: 今天字串() }) },
  {
    键: "group",
    名: "整段",
    说: "开一段,接下来写的几块圈成一坨,能整坨搬走",
    造: () => ({ type: "text", text: "", 组: 新组名() })
  },
  { 键: "hr", 名: "分隔线", 说: "一条横线,把上下分开", 造: () => ({ type: "hr" }) },
  { 键: "img", 名: "图片", 说: "从这台电脑里选一张", 造: null }
];
const 斜杠用量KEY = "todo.斜杠用量";
function 读斜杠用量() {
  try {
    const x = JSON.parse(localStorage.getItem(斜杠用量KEY) || "{}");
    return x && typeof x === "object" && !Array.isArray(x) ? x : {};
  } catch {
    return {};
  }
}
function 斜杠用数(x) {
  if (typeof x === "number")
    return { n: Math.max(0, x), t: 0 };
  return x && typeof x === "object" ? { n: Math.max(0, +x.n || 0), t: Math.max(0, +x.t || 0) } : { n: 0, t: 0 };
}
function 记斜杠用量(k) {
  const 用量 = 读斜杠用量(), 旧 = 斜杠用数(用量[k]);
  用量[k] = { n: 旧.n + 1, t: Date.now() };
  try {
    localStorage.setItem(斜杠用量KEY, JSON.stringify(用量));
  } catch {}
}
let 斜杠态 = null;
function _点外关菜单(e) {
  if (e.target.closest && e.target.closest(".slash"))
    return;
  关斜杠();
}
function 斜杠开(el, b, idx) {
  setTimeout(() => {
    const 位 = 块内光标(el);
    if (位 < 1)
      return;
    const 文 = 可编字(el);
    if (文[位 - 1] !== "/")
      return;
    const 前 = 位 >= 2 ? 文[位 - 2] : `
`;
    if (!/[\s\n]/.test(前))
      return;
    斜杠态 = { el, b, idx, 起: 位 - 1, 词: "", 选: 0 };
    画斜杠();
  }, 0);
}
function 关斜杠() {
  const old = document.getElementById("_slash");
  if (old)
    old.remove();
  document.removeEventListener("mousedown", _点外关菜单);
  斜杠态 = null;
}
function 画斜杠() {
  const st = 斜杠态;
  if (!st)
    return;
  const old = document.getElementById("_slash");
  if (old)
    old.remove();
  const box = document.createElement("div");
  box.className = "slash";
  box.id = "_slash";
  box.style.position = "fixed";
  document.body.appendChild(box);
  const r = (st.锚 || st.el).getBoundingClientRect();
  box.style.left = Math.max(8, Math.min(r.left, innerWidth - 250)) + "px";
  box.style.top = Math.min(r.bottom + 4, innerHeight - 300) + "px";
  st.box = box;
  刷斜杠();
}
function 刷斜杠() {
  const st = 斜杠态;
  if (!st || !st.box)
    return;
  const q = (st.词 || "").toLowerCase();
  const 用量 = 读斜杠用量();
  const 原位 = new Map(斜杠项.map((x, i) => [x.键, i]));
  const 命 = 斜杠项.filter((x) => !q || x.名.includes(q) || x.键.includes(q) || x.说.includes(q)).slice().sort((a, b) => {
    const aa = 斜杠用数(用量[a.键]), bb = 斜杠用数(用量[b.键]);
    if (aa.n !== bb.n)
      return bb.n - aa.n;
    if (aa.n && aa.t !== bb.t)
      return bb.t - aa.t;
    return 原位.get(a.键) - 原位.get(b.键);
  });
  st.命 = 命;
  if (!命.length) {
    st.box.innerHTML = `<div class="sempty">没有叫「${esc(st.词)}」的块 —— 接着打字就行,按 Esc 关掉这个菜单</div>`;
    return;
  }
  if (st.选 >= 命.length)
    st.选 = 0;
  st.box.innerHTML = 命.map((x, i) => `<div class="si" data-i="${i}" aria-selected="${i === st.选}"><b>${esc(x.名)}</b><i>${esc(x.说)}</i></div>`).join("");
  st.box.querySelectorAll(".si").forEach((d) => {
    d.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      选斜杠(命[+d.dataset.i]);
    });
  });
}
function 斜杠键(e) {
  const st = 斜杠态;
  if (!st || !st.box)
    return false;
  if (e.key === "Escape") {
    e.preventDefault();
    关斜杠();
    return true;
  }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const n = (st.命 || []).length;
    if (!n)
      return true;
    st.选 = (st.选 + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
    刷斜杠();
    return true;
  }
  if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    const x = (st.命 || [])[st.选];
    if (x)
      选斜杠(x);
    else
      关斜杠();
    return true;
  }
  return false;
}
function 斜杠跟输入(el) {
  const st = 斜杠态;
  if (!st || st.el !== el)
    return;
  const 文 = 可编字(el);
  if (文[st.起] !== "/") {
    关斜杠();
    return;
  }
  const 位 = 块内光标(el);
  if (位 < st.起 + 1) {
    关斜杠();
    return;
  }
  const 词 = 文.slice(st.起 + 1, 位);
  if (/\s/.test(词) || 词.length > 10) {
    关斜杠();
    return;
  }
  st.词 = 词;
  st.选 = 0;
  刷斜杠();
}
function 选斜杠(x) {
  const st = 斜杠态;
  if (!st)
    return;
  记斜杠用量(x.键);
  const { el, b, idx } = st;
  const 字段 = el.dataset.fld || "text";
  const 文 = 可编字(el);
  const 剩 = 文.slice(0, st.起) + 文.slice(st.起 + 1 + (st.词 || "").length);
  关斜杠();
  b[字段] = 剩;
  if (x.键 === "img") {
    el.textContent = 剩;
    记脏();
    存块();
    挑图前记落点(idx + 1, 落层(b), b.组);
    return;
  }
  if (x.键 === "file") {
    el.textContent = 剩;
    记脏();
    if (!暂存态())
      存块();
    挑文件前记落点(idx + 1, 落层(b), b.组);
    return;
  }
  const nb = x.造();
  const 就地 = !剩.trim() && (b.type === "text" || b.type === "h" || _续同类[b.type]) && 字段 === "text";
  if (就地) {
    if (层of(b))
      nb.层 = 层of(b);
    if (b.组 && !nb.组)
      nb.组 = b.组;
    块[idx] = nb;
  } else
    块.splice(idx + 1, 0, 跟着落点(nb, b));
  画块();
  存块();
  const 落 = 就地 ? idx : idx + 1;
  聚焦块(落, nb.type === "fold" ? "标题" : nb.type === "table" ? null : "text");
}
function 绑拖角(handle, fig, b, docEl) {
  let startX, startW;
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startW = fig.getBoundingClientRect().width;
    fig.classList.add("sized");
    handle.setPointerCapture(e.pointerId);
    const move = (ev) => {
      let w = Math.max(80, Math.min(docEl.getBoundingClientRect().width, startW + (ev.clientX - startX)));
      fig.style.width = w + "px";
      b.w = Math.round(w);
      if (fig._setW)
        fig._setW();
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      存块();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  });
}
const 能装东西 = { fold: 1, todo: 1, ol: 1, ul: 1 };
function 搬块(取, 落) {
  if (!取.length)
    return false;
  const 取集 = new Set(取);
  const 进 = 落.进 || null;
  const 锚 = 进 || 落.后 || null;
  if (锚 && 取集.has(锚))
    return false;
  取.forEach((b) => {
    const g = String(b.组 || "");
    if (g && 块.some((x) => !取集.has(x) && String(x.组 || "") === g))
      delete b.组;
  });
  const 底 = Math.min(...取.map(层of));
  const 基 = 进 ? Math.min(6, 层of(锚) + 1) : 锚 ? 层of(锚) : 0;
  取.forEach((b) => {
    const lv = Math.max(0, Math.min(6, 基 + (层of(b) - 底)));
    if (lv)
      b.层 = lv;
    else
      delete b.层;
  });
  取.forEach((b) => {
    const i = 块.indexOf(b);
    if (i >= 0)
      块.splice(i, 1);
  });
  块.splice(锚 ? 块.indexOf(锚) + 1 : 0, 0, ...取);
  if (进 && 锚.type === "fold")
    锚.展开 = true;
  return true;
}
function 开拖(源, 取们, docEl, e, 首移) {
  e.preventDefault();
  e.stopPropagation();
  const 取 = 含后代(取们());
  if (!取.length)
    return;
  const 取集 = new Set(取);
  let 落 = null, 动过 = false, 最后点 = { clientX: e.clientX, clientY: e.clientY }, 自动滚帧 = 0;
  try {
    源.setPointerCapture(e.pointerId);
  } catch (_) {}
  const line = document.createElement("div");
  line.className = "dropline";
  const 清 = () => docEl.querySelectorAll(".block.dropin").forEach((n) => n.classList.remove("dropin"));
  可见块.forEach((v) => {
    if (取集.has(v.b))
      v.el.classList.add("dragging");
  });
  const 滚容 = (() => {
    let n = docEl;
    while (n && n !== document.body) {
      if (n.scrollHeight > n.clientHeight + 4)
        return n;
      n = n.parentElement;
    }
    return document.scrollingElement;
  })();
  const move = (ev) => {
    最后点 = { clientX: ev.clientX, clientY: ev.clientY };
    动过 = true;
    清();
    line.remove();
    落 = null;
    const 行 = 可见块.filter((v) => !取集.has(v.b));
    const 命中 = [];
    for (const v of 行) {
      if (!能装东西[v.b.type])
        continue;
      const 靶 = v.b.type === "fold" ? v.b.展开 ? v.el.querySelector(".bkfold") : v.el.querySelector(".bkfold-h") : v.el;
      const r = 靶.getBoundingClientRect();
      const 边 = Math.min(8, r.height * 0.3);
      if (ev.clientY > r.top + 边 && ev.clientY < r.bottom - 边 && ev.clientX > r.left)
        命中.push(v);
    }
    const 最深 = 命中.reduce((选, v) => !选 || 层of(v.b) >= 层of(选.b) ? v : 选, null);
    if (最深) {
      落 = { 进: 最深.b };
      最深.el.classList.add("dropin");
      return;
    }
    let 前 = null, 前el = null, 锚el = null;
    for (const v of 行) {
      const 靶 = v.b.type === "fold" ? v.el.querySelector(".bkfold-h") : v.el;
      const r = 靶.getBoundingClientRect();
      if (ev.clientY < r.top + r.height / 2) {
        锚el = v.el;
        break;
      }
      前 = v.b;
      前el = v.el;
    }
    落 = { 后: 前 };
    if (锚el)
      锚el.parentElement.insertBefore(line, 锚el);
    else if (前el)
      前el.parentElement.insertBefore(line, 前el.nextSibling);
    else
      docEl.prepend(line);
  };
  const 自动滚 = () => {
    if (!滚容)
      return;
    const r = 滚容 === document.scrollingElement ? { top: 0, bottom: innerHeight } : 滚容.getBoundingClientRect();
    let d = 0;
    if (最后点.clientY < r.top + 40)
      d = -(4 + 14 * Math.max(0, Math.min(1, (r.top + 40 - 最后点.clientY) / 40)));
    else if (最后点.clientY > r.bottom - 40)
      d = 4 + 14 * Math.max(0, Math.min(1, (最后点.clientY - (r.bottom - 40)) / 40));
    if (d) {
      滚容.scrollTop += d;
      move(最后点);
    }
    自动滚帧 = requestAnimationFrame(自动滚);
  };
  自动滚帧 = requestAnimationFrame(自动滚);
  const 收拖 = (要落) => {
    源.removeEventListener("pointermove", move);
    源.removeEventListener("pointerup", up);
    源.removeEventListener("pointercancel", cancel);
    cancelAnimationFrame(自动滚帧);
    try {
      源.releasePointerCapture(e.pointerId);
    } catch (_) {}
    line.remove();
    清();
    docEl.querySelectorAll(".block.dragging").forEach((n) => n.classList.remove("dragging"));
    if (要落 && 动过 && 落 && 搬块(取, 落)) {
      画块();
      存块();
    }
  };
  const up = () => 收拖(true), cancel = () => 收拖(false);
  源.addEventListener("pointermove", move);
  源.addEventListener("pointerup", up);
  源.addEventListener("pointercancel", cancel);
  if (首移)
    move(首移);
}
function 绑拖排序(grip, el, idx, docEl) {
  const 取们 = () => {
    const b = 块[idx];
    return b && 选块.has(b) ? 块.filter((x) => 选块.has(x)) : b ? [b] : [];
  };
  grip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0)
      return;
    e.preventDefault();
    e.stopPropagation();
    关块菜单();
    const { clientX: 起x, clientY: 起y } = e;
    try {
      grip.setPointerCapture(e.pointerId);
    } catch (_) {}
    const 清 = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", cancel);
    };
    const 选当前 = () => {
      const b = 块[idx];
      if (!b || 选块.has(b))
        return;
      选块.clear();
      选块.add(b);
      刷选中标();
    };
    const move = (ev) => {
      if (Math.hypot(ev.clientX - 起x, ev.clientY - 起y) <= 4)
        return;
      清();
      选当前();
      开拖(grip, 取们, docEl, e, ev);
    };
    const up = () => {
      清();
      try {
        grip.releasePointerCapture(e.pointerId);
      } catch (_) {}
      const b = 块[idx];
      if (!b)
        return;
      选块.clear();
      选块.add(b);
      刷选中标();
      开块菜单(grip, idx);
    };
    const cancel = () => {
      清();
      try {
        grip.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", cancel);
  });
}
function 绑段拖(gh, g, docEl) {
  gh.addEventListener("pointerdown", (e) => 开拖(gh, () => 块.filter((x) => String(x.组 || "") === g), docEl, e));
}
let 框起 = null, 框接管 = false;
const 刷选中标 = () => 可见块.forEach((v) => v.el.classList.toggle("selblk", 选块.has(v.b)));
function 绑框选(docEl) {
  docEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0)
      return;
    if (e.target.closest(".bh, .gh, .gx, button, input, .rz, .imbar, .bkfold-t"))
      return;
    框起 = { x: e.clientX, y: e.clientY, el: e.target.closest(".block") };
    框接管 = false;
    键选图回 = null;
    if (选块.size) {
      选块.clear();
      刷选中标();
    }
    const v = e.target.closest(".bimg") && 可见块.find((x) => x.el === 框起.el);
    if (v && v.b.type === "img")
      选中图块(v.b);
  });
}
{
  const 标 = 刷选中标;
  document.addEventListener("pointermove", (e) => {
    if (!框起 || !(e.buttons & 1) || !可见块.length)
      return;
    if (Math.abs(e.clientY - 框起.y) < 6 && Math.abs(e.clientX - 框起.x) < 6)
      return;
    const 现 = [...可见块].reverse().find((v) => {
      const r = v.el.getBoundingClientRect();
      return e.clientY >= r.top && e.clientY <= r.bottom;
    });
    if (!框接管) {
      if (框起.el && 现 && 现.el === 框起.el)
        return;
      框接管 = true;
      const sel = getSelection();
      if (sel)
        sel.removeAllRanges();
      const a = document.activeElement;
      if (a && a.blur)
        a.blur();
    }
    const i0 = 框起.el ? 可见块.findIndex((v) => v.el === 框起.el) : e.clientY < 框起.y ? 可见块.length - 1 : 0;
    const i1 = 现 ? 可见块.indexOf(现) : e.clientY < 框起.y ? 0 : 可见块.length - 1;
    if (i0 < 0 || i1 < 0)
      return;
    选块 = new Set(可见块.slice(Math.min(i0, i1), Math.max(i0, i1) + 1).map((v) => v.b));
    标();
  });
  document.addEventListener("pointerup", () => {
    框起 = null;
    框接管 = false;
  });
}
function 块全局键(e) {
  if (!编器在())
    return;
  if (两栏开着())
    return;
  const a = document.activeElement;
  const 编辑中 = !!(a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)));
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.isComposing && /^[zy]$/i.test(e.key)) {
    const 正文里 = !编辑中 || a.closest("[data-doc]") || a.matches("#noteTitleIn,#cardMatter,[data-fld-matter]");
    if (!正文里 || document.querySelector("dialog[open],#historyMask"))
      return;
    e.preventDefault();
    走撤销(/y/i.test(e.key) || e.shiftKey ? 1 : -1, 编辑中);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A") && a && a.isContentEditable) {
    const el = a, sel = getSelection();
    const 已全选 = sel && sel.toString().length >= (el.innerText || "").trim().length && sel.toString().length > 0;
    if (已全选) {
      e.preventDefault();
      sel.removeAllRanges();
      el.blur();
      选块 = new Set(可见块.map((v) => v.b));
      画块();
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A") && !编辑中 && 卡宿 === "note" && 可见块.length && !document.querySelector("dialog[open]")) {
    e.preventDefault();
    const sel = getSelection();
    if (sel)
      sel.removeAllRanges();
    选块 = new Set(可见块.map((v) => v.b));
    刷选中标();
    return;
  }
  if (!选块.size || 编辑中)
    return;
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    const 走 = 含后代([...选块]);
    走.forEach((b) => {
      const i = 块.indexOf(b);
      if (i >= 0)
        块.splice(i, 1);
    });
    if (!块.length)
      块.push({ type: "text", text: "" });
    const 回 = 键选图回;
    键选图回 = null;
    选块.clear();
    画块();
    存块();
    toast(走.length === 1 && 走[0].type === "img" ? "已删图片" : `删了 ${走.length} 块`);
    if (回 && 块.includes(回.b))
      聚焦块(块.indexOf(回.b), 回.fld, 回.头);
  } else if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
    e.preventDefault();
    复制文本(块转文(块.filter((b) => 选块.has(b))));
  }
}
document.addEventListener("keydown", 块全局键);
function 块转文(bs) {
  const 段 = [];
  let 序 = 0;
  bs.forEach((b) => {
    const t = b.type || "text";
    const 文 = (b.text || "").trim();
    序 = t === "ol" ? 序 + 1 : 0;
    if (t === "img") {
      段.push("[图]");
      return;
    }
    if (t === "file") {
      段.push("[文件]");
      return;
    }
    if (t === "table") {
      const 表 = (Array.isArray(b.行) ? b.行 : []).filter((行) => (Array.isArray(行) ? 行 : []).some((格) => String(格 == null ? "" : 格).trim())).map((行) => (Array.isArray(行) ? 行 : []).map((格) => String(格 == null ? "" : 格)).join(" | "));
      if (表.length)
        段.push(表.join(`
`));
      return;
    }
    if (t === "date") {
      const 日 = b.日期 || "";
      if (日)
        段.push(日 + (b.时间 ? " " + b.时间 : ""));
      return;
    }
    if (t === "hr") {
      段.push("———");
      return;
    }
    if (t === "fold") {
      段.push([(b.标题 || "").trim(), 文].filter(Boolean).join(`
`));
      return;
    }
    if (t === "todo") {
      段.push((b.勾 ? "[x] " : "[ ] ") + 文);
      return;
    }
    if (t === "ul") {
      if (文)
        段.push("· " + 文);
      return;
    }
    if (t === "ol") {
      段.push(序 + ". " + 文);
      return;
    }
    if (文)
      段.push(文);
  });
  return 段.filter(Boolean).join(`
`);
}
function 画AI标题状态(框, 类, 符号, 屏上话, 详细话) {
  框.className = "aititle-result" + (类 ? " " + 类 : "");
  框.dataset.kind = 类 || "";
  框.title = 详细话 || 屏上话 || "";
  框.innerHTML = 屏上话 ? `<span class="mark">${符号}</span><span class="proposal">${esc(屏上话)}</span>` : "";
}
function 刷新AI标题钮(正文变了) {
  document.querySelectorAll("[data-ai-title-root]").forEach((根) => {
    if (根._aiTitleRefresh)
      根._aiTitleRefresh(正文变了);
  });
}
function 装AI拟标题(根, 取正文, 采用标题) {
  if (!根)
    return;
  const 钮 = 根.querySelector("[data-ai-title]");
  const 框 = 根.parentElement.querySelector("[data-ai-title-result]");
  if (!钮 || !框)
    return;
  根._aiTitleText = 取正文;
  根._aiTitleUse = 采用标题;
  根._aiTitleRefresh = (正文变了) => {
    const 空 = !String(根._aiTitleText() || "").trim();
    钮.disabled = 空 || 钮.dataset.busy === "1";
    钮.title = 空 ? "正文是空的,先写正文才能让 AI 拟标题" : "按当前正文拟一个标题;拟好先给你看,点「采用」才会替换";
    if (!空 && (正文变了 || 框.dataset.kind === "empty"))
      画AI标题状态(框, "", "", "");
  };
  if (!钮._bd) {
    钮._bd = 1;
    钮.addEventListener("click", async () => {
      const 原文 = String(根._aiTitleText() || "").trim();
      if (!原文) {
        根._aiTitleRefresh();
        return;
      }
      画AI标题状态(框, "", "", "");
      const 干 = () => AI请求("/api/todo/ai-title", 原文);
      let 承;
      if (window.UI调用) {
        let 等位 = 框.nextElementSibling;
        if (!等位 || !等位.classList.contains("aititle-wait")) {
          等位 = document.createElement("div");
          等位.className = "aititle-wait";
          框.after(等位);
        }
        承 = UI调用.跑(钮, { 动作: "拟标题", 功能名: AI功能名.标题, 行位: 等位 }, 干);
      } else {
        钮.disabled = true;
        承 = 干();
      }
      钮.dataset.busy = "1";
      钮.classList.add("busy");
      钮.innerHTML = '<i class="符 转" aria-hidden="true">&#10227;</i>';
      钮.title = "正在按正文拟标题…";
      let r = null, 错 = null;
      try {
        r = await 承;
      } catch (e) {
        错 = e;
      }
      钮.dataset.busy = "";
      钮.classList.remove("busy");
      钮.textContent = "✦";
      根._aiTitleRefresh();
      if (错) {
        if (!window.UI调用)
          画AI标题状态(框, "err", "✗", "这次没拟出来，请再试", 错.message);
        return;
      }
      if (String(根._aiTitleText() || "").trim() !== 原文) {
        画AI标题状态(框, "err", "✗", "正文已变化，请重新拟");
        return;
      }
      根._aiTitleCandidate = r.标题;
      框.className = "aititle-result";
      框.dataset.kind = "proposal";
      框.title = "这是 AI 按当前正文拟的标题;采用之前原标题不会改变";
      框.innerHTML = `<span class="mark">✓</span><span class="proposal">${esc(r.标题)}</span>
        <span class="actions"><button class="次钮" type="button" data-ai-title-use>采用</button>
        <button class="次钮" type="button" data-ai-title-no>不要</button></span>`;
      const 牌 = window.UI模型牌 && UI模型牌.画(r.回执);
      if (牌)
        框.querySelector(".actions").before(牌);
    });
    框.addEventListener("click", async (e) => {
      if (e.target.closest("[data-ai-title-no]")) {
        根._aiTitleCandidate = "";
        画AI标题状态(框, "", "", "");
        return;
      }
      if (!e.target.closest("[data-ai-title-use]") || !根._aiTitleCandidate)
        return;
      const 存上 = await 根._aiTitleUse(根._aiTitleCandidate);
      if (存上 === false) {
        画AI标题状态(框, "err", "✗", "标题没存上，请再试");
        return;
      }
      根._aiTitleCandidate = "";
      画AI标题状态(框, "", "✓", "已采用标题");
    });
  }
  根._aiTitleRefresh();
}
function 块预览HTML(bs) {
  let 序 = 0;
  return bs.map((b) => {
    const t = b.type || "text";
    const 文 = esc(b.text || "");
    序 = t === "ol" ? 序 + 1 : 0;
    if (t === "hr")
      return '<hr class="bkhr">';
    if (t === "h")
      return `<div class="p" style="font-weight:700;font-size:var(--f${b.级 === 1 ? "5" : b.级 === 3 ? "3" : "4"})">${文}</div>`;
    if (t === "todo")
      return `<div class="p">${b.勾 ? "☑" : "☐"} ${文}</div>`;
    if (t === "ul")
      return `<div class="p">· ${文}</div>`;
    if (t === "ol")
      return `<div class="p">${序}. ${文}</div>`;
    if (t === "code")
      return `<pre class="bkcode" style="margin:0 0 7px">${文}</pre>`;
    if (t === "fold")
      return `<div class="p">▸ <b>${esc(b.标题 || "")}</b><br><span style="color:var(--muted)">${文}</span></div>`;
    return `<div class="p">${文}</div>`;
  }).join("");
}
async function 开AI速记(btn) {
  if (!正文落点())
    return;
  const 文 = 块转文(块);
  if (!文.trim()) {
    toast("正文还是空的 —— 先随手写几句(或粘一段进来),再点 AI 速记", true);
    return;
  }
  const 干 = () => AI请求("/api/todo/ai-note", 文);
  let r;
  if (btn && window.UI调用) {
    try {
      r = await UI调用.跑(btn, { 动作: "整理", 功能名: AI功能名.速记 }, 干);
    } catch (e) {
      return;
    }
  } else {
    try {
      r = await 干();
    } catch (e) {
      toast(e.message || "AI 速记这次没跑成", true);
      return;
    }
  }
  画AI预览(文, r.块 || [], r.提示 || "", r.回执);
}
function 关AI预览() {
  const m = document.getElementById("_aimask");
  if (m) {
    m.remove();
    return true;
  }
  return false;
}
function 画AI预览(原文, 新块, 提示, 回执) {
  关AI预览();
  const 保留块 = 块.filter((b) => ["img", "file", "table", "date"].includes(b.type));
  const m = document.createElement("div");
  m.className = "aimask";
  m.id = "_aimask";
  m.innerHTML = `<div class="aibox">
    <div class="aih"><b>AI 速记 · 整理稿先看一眼</b>
      <span class="次钮" data-aiclose title="关掉,正文一个字不动">✗ 关掉</span></div>
    <div class="aiw">
      <div class="aicol"><h4>你原来写的</h4><div class="aibody">${esc(原文)}</div></div>
      <div class="aicol"><h4>AI 整理成这样(${新块.length} 块)</h4><div class="aibody">${块预览HTML(新块)}</div></div>
    </div>
    <div class="aif">
      <span class="ainote" title="AI 不生成图片、文件、表格和日期块;采用整理稿时,这些原块会接在新正文后面">${提示 ? esc(提示) + " · " : ""}点「采用」才会替换正文,不点就什么都没变。${保留块.length ? `另保留 ${保留块.length} 个非 AI 块。` : ""}</span>
      <span><button class="次钮" data-aiclose>取消</button>
        <button class="主钮" data-aiuse title="用整理稿替换正文;不满意还能撤(下面那行文字块照旧能改)">采用,替换正文</button></span>
    </div></div>`;
  const 牌 = window.UI模型牌 && UI模型牌.画(回执);
  if (牌)
    m.querySelector(".aih b").after(牌);
  if (window.UI调用) {
    const 史位 = document.createElement("div");
    史位.className = "aihist";
    m.querySelector(".aif").before(史位);
    UI调用.历史(史位, { 网址: "/api/model-badge/history?软件=" + encodeURIComponent("待办") });
  }
  document.body.appendChild(m);
  m.addEventListener("click", async (e) => {
    if (e.target === m || e.target.closest("[data-aiclose]")) {
      关AI预览();
      return;
    }
    if (e.target.closest("[data-aiuse]")) {
      const one = 拆K(正文落点());
      const 原文包 = JSON.stringify({ 时间: 当前时间字串(), 块: 块.map(净一块) });
      const 留原文 = await postJSON("/api/todo/edit", { 来源: one.来源, id: one.id, 列: "速记原文", 值: 原文包 });
      if (!留原文 || !留原文.ok) {
        toast(留原文 && 留原文.error || "速记前的原文没存上,正文没有替换", true);
        return;
      }
      块 = 新块.concat(保留块);
      关AI预览();
      画块();
      if (await 存块())
        toast("已换成整理稿" + (保留块.length ? ` · ${保留块.length} 个非 AI 块接在后面` : ""));
    }
  });
}
const 抓图上限 = 12;
function 绝对网址(src) {
  if (/^(https?:|data:)/i.test(src))
    return src;
  if (/^\/\//.test(src))
    return "https:" + src;
  return null;
}
const 像MD原文 = (t) => /^ {0,3}(#{1,6}[ \t]|>|[-*+][ \t]|\d{1,9}[.)][ \t]|\|.*\||```|~~~|(-{3,}|\*{3,}|_{3,})[ \t]*$)/m.test(t);
function 拆网页片(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,noscript,svg,head,title,iframe").forEach((n) => n.remove());
  const 出 = [];
  let 缓 = "";
  const 冲 = () => {
    const s = 缓.replace(/[ \t ]+/g, " ").replace(/\n{3,}/g, `

`).trim();
    if (s)
      出.push({ t: "text", text: s });
    缓 = "";
  };
  const 收行 = (n) => ({
    文: (n.textContent || "").replace(/\s+/g, " ").trim(),
    图: [...n.querySelectorAll("img")].map((im) => im.getAttribute("src")).filter(Boolean)
  });
  const 标题级 = { H1: 1, H2: 2, H3: 3, H4: 3, H5: 3, H6: 3 };
  const 块级 = new Set([
    "P",
    "DIV",
    "SECTION",
    "ARTICLE",
    "BLOCKQUOTE",
    "MAIN",
    "ASIDE",
    "HEADER",
    "FOOTER",
    "FIGURE",
    "FIGCAPTION",
    "DD",
    "DT",
    "DL",
    "ADDRESS",
    "FORM",
    "NAV"
  ]);
  const 走表 = (table) => {
    [...table.querySelectorAll("tr")].forEach((tr) => {
      const 行 = [...tr.children].map((td) => (td.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" ｜ ");
      if (行)
        出.push({ t: "text", text: 行 });
    });
    [...table.querySelectorAll("img")].map((im) => im.getAttribute("src")).filter(Boolean).forEach((s) => 出.push({ t: "img", src: s }));
  };
  const 走 = (node, 有序) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        缓 += n.nodeValue;
        continue;
      }
      if (n.nodeType !== 1)
        continue;
      const tag = n.tagName;
      if (tag === "IMG") {
        冲();
        const s = n.getAttribute("src");
        if (s)
          出.push({ t: "img", src: s });
        continue;
      }
      if (tag === "BR") {
        缓 += `
`;
        continue;
      }
      if (tag === "HR") {
        冲();
        出.push({ t: "hr" });
        continue;
      }
      if (标题级[tag]) {
        冲();
        const { 文, 图 } = 收行(n);
        if (文)
          出.push({ t: "h", 级: 标题级[tag], text: 文 });
        图.forEach((s) => 出.push({ t: "img", src: s }));
        continue;
      }
      if (tag === "PRE") {
        冲();
        const 文 = (n.textContent || "").replace(/\s+$/, "");
        if (文.trim())
          出.push({ t: "code", text: 文 });
        continue;
      }
      if (tag === "LI") {
        冲();
        const { 文, 图 } = 收行(n);
        if (文)
          出.push({ t: 有序 ? "ol" : "ul", text: 文 });
        图.forEach((s) => 出.push({ t: "img", src: s }));
        continue;
      }
      if (tag === "OL" || tag === "UL") {
        冲();
        走(n, tag === "OL");
        continue;
      }
      if (tag === "TABLE") {
        冲();
        走表(n);
        continue;
      }
      const 是块 = 块级.has(tag);
      if (是块)
        冲();
      走(n, 有序);
      if (是块)
        冲();
    }
  };
  走(doc.body, false);
  冲();
  return 出;
}
async function 一张图进库(src, 本地文件, one) {
  if (本地文件) {
    const d = await 读dataURL(本地文件);
    if (!d)
      return { 错: "这张图读不出来" };
    const aid = await 上传图(d, one.id, null);
    return aid ? { aid } : { 错: "这张图存不进去" };
  }
  const u = 绝对网址(src);
  if (!u)
    return { 错: "这张图是相对地址,剪贴板里没带原网页地址,拼不出来" };
  if (/^data:image\//i.test(u)) {
    const mime = (u.match(/^data:([^;,]+)/) || [])[1] || "image/png";
    const aid = await 上传图({ dataURL: u, mime, 原名: "网页内嵌图" }, one.id, null);
    return aid ? { aid } : { 错: "内嵌图存不进去" };
  }
  const r = await postJSON("/api/todo/img", { 来源: one.来源, op: "fetch", 待办id: one.id, url: u }, 抓图上限毫秒);
  return r && r.ok ? { aid: r.图.id } : { 错: r && r.error || "后台没抓下来" };
}
async function 网页片入块(片, 本地图们, at) {
  const one = 暂存态() ? null : 拆K(正文落点());
  const 图数 = 片.filter((x) => x.t === "img").length;
  const 本地 = 本地图们.length && 本地图们.length === 图数 ? 本地图们.slice() : [];
  let 位 = at == null || at > 块.length ? 块.length : at;
  const 段名 = 新组名();
  const 起层 = 落层(位 > 0 ? 块[位 - 1] : null);
  const 记 = (nb) => {
    nb.组 = 段名;
    if (起层)
      nb.层 = 起层;
    return nb;
  };
  let 文成 = 0, 图成 = 0, 图败 = 0, 图略 = 0, 抓过 = 0, 末错 = "";
  if (图数 > 本地.length)
    toast(`正在把 ${图数 - 本地.length} 张图从原网页拉下来…`);
  for (const it of 片) {
    if (it.t === "img") {
      const f = 本地.shift();
      if (暂存态()) {
        if (f) {
          const d = await 读dataURL(f);
          if (d) {
            块.splice(位++, 0, 记({ type: "img", al: "left", 暂: d }));
            图成++;
          } else {
            图败++;
            末错 = "这张图读不出来";
          }
        } else {
          const u = 绝对网址(it.src);
          if (u && /^data:image\//i.test(u)) {
            const mime = (u.match(/^data:([^;,]+)/) || [])[1] || "image/png";
            块.splice(位++, 0, 记({ type: "img", al: "left", 暂: { dataURL: u, mime, 原名: "网页内嵌图" } }));
            图成++;
          } else if (u) {
            块.splice(位++, 0, 记({ type: "img", al: "left", 待抓: u }));
            图成++;
          } else {
            图败++;
            末错 = "这张图是相对地址,剪贴板里没带原网页地址,拼不出来";
          }
        }
        continue;
      }
      if (!f && 抓过 >= 抓图上限) {
        图略++;
        continue;
      }
      if (!f && !/^data:/i.test(it.src || ""))
        抓过++;
      const r = await 一张图进库(it.src, f, one);
      if (r.aid) {
        块.splice(位++, 0, 记({ type: "img", 附件id: r.aid, al: "left" }));
        图成++;
      } else {
        图败++;
        末错 = r.错 || 末错;
      }
      continue;
    }
    块.splice(位++, 0, 记(it.t === "h" ? { type: "h", text: it.text, 级: it.级 } : it.t === "hr" ? { type: "hr" } : it.t === "code" ? { type: "code", text: it.text } : it.t === "ul" || it.t === "ol" ? { type: it.t, text: it.text } : { type: "text", text: it.text }));
    文成++;
  }
  const 前 = at != null ? at - 1 : -1;
  if (前 >= 0 && 块[前] && 块[前].type === "text" && !(块[前].text || "").trim())
    块.splice(前, 1);
  const 这段 = 块.filter((b) => b.组 === 段名);
  if (这段.length < 2)
    这段.forEach((b) => delete b.组);
  画块();
  await 存块();
  if (图成 && !暂存态())
    loadList();
  const 话 = [`已粘 ${文成} 块`];
  if (图成)
    话.push(暂存态() ? `图 ${图成} 张(存卡时一起进库)` : `图 ${图成} 张`);
  if (文成 + 图成 >= 2)
    话.push("圈成了一段(拖段头上那个 ⠿ 整段搬)");
  if (图略)
    话.push(`还有 ${图略} 张没拉(一次最多 ${抓图上限} 张)`);
  if (图败)
    话.push(`${图败} 张没拉下来:${末错}`);
  toast(话.join(" · "));
}
function 加图块(附件id, at, 额外) {
  const b = Object.assign({ type: "img", al: "left" }, 附件id ? { 附件id } : {}, 额外 || {});
  if (at == null || at >= 块.length)
    块.push(b);
  else
    块.splice(at, 0, b);
  画块();
  存块();
  toast(暂存态() ? "已加图(存卡的时候一起进库) · 拖右下角圆点改大小" : "已加图 · 拖右下角圆点改大小");
}
let 图落点 = null;
function 挑图前记落点(at, 层, 组) {
  图落点 = { at, 层: 层 || 0, 组: 组 || "" };
  document.getElementById("dFilePick").click();
}
let 文件落点 = null;
function 挑文件前记落点(at, 层, 组) {
  文件落点 = { at, 层: 层 || 0, 组: 组 || "" };
  document.getElementById("dBlockFilePick").click();
}
async function 读文件入块(f, at, 落) {
  if (!f)
    return false;
  if ((f.type || "").startsWith("image/")) {
    toast("图片请用「图片」块", true);
    return false;
  }
  const d = await 读文件数据(f);
  if (!d)
    return false;
  const b = { type: "file" };
  if (落 && 落.层)
    b.层 = 落.层;
  if (落 && 落.组)
    b.组 = 落.组;
  if (暂存态())
    b.暂文 = d;
  else {
    const one = 拆K(正文落点());
    const r = await postJSON("/api/todo/file", {
      来源: one.来源,
      op: "add",
      待办id: one.id,
      评论id: null,
      base64: d.base64,
      mime: d.mime,
      原名: d.原名
    });
    if (!r || !r.ok) {
      toast(r && r.error || "传文件失败", true);
      return false;
    }
    b.附件id = r.文件.id;
    块文件.push(r.文件);
    附件撤销缓存.set(+r.文件.id, { base64: d.base64, mime: d.mime, 原名: d.原名, 是图: false });
    loadList();
  }
  if (at == null || at >= 块.length)
    块.push(b);
  else
    块.splice(at, 0, b);
  画块();
  await 存块();
  toast(暂存态() && 卡宿 !== "note" ? "已加文件(存卡的时候一起进库)" : "已加文件");
  return true;
}
async function 读图上传(f, at, 落) {
  if (!f || !f.type || !f.type.startsWith("image/"))
    return false;
  const d = await 读dataURL(f);
  if (!d)
    return false;
  const 额 = {};
  if (落 && 落.层)
    额.层 = 落.层;
  if (落 && 落.组)
    额.组 = 落.组;
  if (暂存态()) {
    加图块(null, at, Object.assign({ 暂: d }, 额));
    return true;
  }
  const 落点 = 拆K(正文落点());
  const aid = await 上传图(d, 落点.id, null, 落点.来源);
  if (aid) {
    附件撤销缓存.set(+aid, { base64: String(d.dataURL || "").split(",")[1] || "", mime: d.mime, 原名: d.原名, 是图: true });
    加图块(aid, at, 额);
    loadList();
  }
  return !!aid;
}
function 焦点块后() {
  const a = document.activeElement;
  const el = a && a.closest ? a.closest(".block") : null;
  return el ? +el.dataset.idx + 1 : undefined;
}
async function 外链图入库(uri, at) {
  if (暂存态()) {
    加图块(null, at, { 待抓: uri });
    return;
  }
  const one = 拆K(正文落点());
  const r = await 一张图进库(uri, null, one);
  if (!r.aid) {
    toast("这张图没拉下来:" + (r.错 || "不知道为什么"), true);
    return;
  }
  加图块(r.aid, at);
  loadList();
}
const 右栏宽KEY = "todo.右栏宽";
function 读右栏宽() {
  let v = 0;
  try {
    v = +(localStorage.getItem(右栏宽KEY) || 0);
  } catch {}
  return v ? Math.max(200, Math.min(520, v)) : 300;
}
function 落右栏宽(px, 要存 = true, 根 = document.getElementById("dBody")) {
  const w = Math.max(200, Math.min(520, Math.round(px)));
  const grid = 根 && 根.querySelector(".dgrid");
  const bar = 根 && 根.querySelector(".dresize");
  if (grid)
    grid.style.setProperty("--dside-w", w + "px");
  if (bar)
    bar.setAttribute("aria-valuenow", String(w));
  if (要存) {
    try {
      localStorage.setItem(右栏宽KEY, String(w));
    } catch {}
  }
  return w;
}
function 装右栏拖线(根) {
  const bar = 根 && 根.querySelector(".dresize");
  if (!bar)
    return;
  bar.setAttribute("aria-valuemin", "200");
  bar.setAttribute("aria-valuemax", "520");
  let 当前 = 落右栏宽(读右栏宽(), false, 根);
  bar.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const 起x = e.clientX, 起宽 = 当前;
    try {
      bar.setPointerCapture(e.pointerId);
    } catch (_) {}
    const move = (ev) => {
      当前 = 落右栏宽(起宽 + 起x - ev.clientX, false, 根);
    };
    const up = () => {
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      try {
        bar.releasePointerCapture(e.pointerId);
      } catch (_) {}
      当前 = 落右栏宽(当前, true, 根);
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
  });
  bar.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowLeft" ? 16 : e.key === "ArrowRight" ? -16 : 0;
    if (!d)
      return;
    e.preventDefault();
    当前 = 落右栏宽(当前 + d, true, 根);
  });
}
function bindDetail(det) {
  const body = document.getElementById("dBody");
  if (!body)
    return;
  绑撤销历史(body);
  const t = det.待办;
  const docEl = body.querySelector("[data-doc]");
  if (docEl)
    绑框选(docEl);
  装右栏拖线(body);
  const 改 = async (列, 值) => {
    const r = await postJSON("/api/todo/edit", Object.assign(拆K(dCur), { 列, 值 }));
    if (!r || !r.ok) {
      toast(r && r.error || "保存失败", true);
      return false;
    }
    return true;
  };
  const mi = body.querySelector("[data-fld-matter]");
  mi.addEventListener("blur", async () => {
    const v = mi.textContent.trim();
    if (v === (t.事项 || ""))
      return;
    if (!v) {
      mi.textContent = t.事项 || "";
      toast("事项不能为空", true);
      return;
    }
    if (await 改("事项", v)) {
      t.事项 = v;
      loadList();
    }
  });
  mi.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      mi.blur();
    }
  });
  装AI拟标题(mi.closest("[data-ai-title-root]"), () => 块转文(块), async (标题) => {
    mi.textContent = 标题;
    if (!await 改("事项", 标题))
      return false;
    t.事项 = 标题;
    loadList();
    return true;
  });
  const st = body.querySelector("[data-fld-st]");
  st.addEventListener("change", async () => {
    const key = String(dCur), v = st.value;
    st.className = "stsel " + (v === "进行中" ? "doing" : v === "已完成" ? "done" : "");
    t.状态 = v;
    const { r, 最新 } = await 排同字段写(key, "状态", v);
    if (!最新 || dCur !== key)
      return;
    if (r && r.ok)
      await loadList();
    else {
      toast(r && r.error || "状态没存上", true);
      await refreshDetail();
    }
  });
  const star = body.querySelector("[data-fld-star]");
  star.addEventListener("click", async (e) => {
    const i = e.target.closest("i,button");
    if (!i)
      return;
    const key = String(dCur), lv = [...star.children].indexOf(i) + 1;
    t.重要程度 = lv;
    star.innerHTML = starHTML(lv, true);
    star.setAttribute("aria-label", `重要程度 ${lv} 星`);
    const { r, 最新 } = await 排同字段写(key, "重要程度", lv);
    if (!最新 || dCur !== key)
      return;
    if (r && r.ok)
      await loadList();
    else {
      toast(r && r.error || "重要程度没存上", true);
      await refreshDetail();
    }
  });
  const due = body.querySelector("[data-fld-due]");
  due.addEventListener("change", async () => {
    const key = String(dCur), v = due.value;
    t.计划完成时间 = v;
    const { r, 最新 } = await 排同字段写(key, "计划完成时间", v);
    if (!最新 || dCur !== key)
      return;
    if (r && r.ok)
      await loadList();
    else {
      toast(r && r.error || "计划完成时间没存上", true);
      await refreshDetail();
    }
  });
  const tgt = body.querySelector("[data-fld-target]");
  if (tgt)
    tgt.addEventListener("change", async () => {
      if (目标数没填对(tgt.value)) {
        toast("目标数要填 1 或更大的整数 —— 清空这个框 = 撤掉量化", true);
        tgt.value = t.目标数 || "";
        tgt.focus();
        return;
      }
      const key = String(dCur), v = tgt.value;
      t.目标数 = v ? +v : null;
      const { r, 最新 } = await 排同字段写(key, "目标数", v);
      if (!最新 || dCur !== key)
        return;
      if (!r || !r.ok)
        toast(r && r.error || "目标数没存上", true);
      await refreshDetail();
    });
  const ai速记钮 = body.querySelector("[data-ai速记]");
  if (ai速记钮)
    ai速记钮.addEventListener("click", () => 开AI速记(ai速记钮));
  body.querySelectorAll("[data-add]").forEach((btn) => btn.addEventListener("click", () => {
    if (btn.dataset.add === "text") {
      块.push({ type: "text", text: "" });
      画块();
      存块();
      const last = body.querySelector("[data-doc] .block:last-child .btext");
      if (last)
        last.focus();
    } else {
      图落点 = null;
      document.getElementById("dFilePick").click();
    }
  }));
  const fpick = body.querySelector("[data-filepick]");
  if (fpick)
    fpick.addEventListener("change", async (e) => {
      for (const f of e.target.files) {
        if (f.type && f.type.startsWith("image/")) {
          if (await 读图上传(f))
            toast("图片已按图片块插进正文(附件区只收非图)");
        } else
          await 上传文件(f);
      }
      e.target.value = "";
      refreshDetail();
    });
  body.querySelectorAll("[data-delfile]").forEach((x) => x.addEventListener("click", async () => {
    if (!await 问删({ 屏上: "删掉这个附件?", 细说: "文件本身从库里删掉,恢复不了。", 钮字: "删掉附件" }))
      return;
    await 缓存当前附件(new Set([+x.dataset.delfile]));
    const r = await postJSON("/api/todo/file", { 来源: 拆K(dCur).来源, op: "del", id: +x.dataset.delfile });
    if (r && r.ok)
      refreshDetail();
    else
      toast(r && r.error || "删附件失败", true);
  }));
  body.querySelectorAll("[data-delimg]").forEach((x) => x.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    if (!await 问删({ 屏上: "删掉这张图?", 细说: "图片本身存在库里,删了就没有了,恢复不了。", 钮字: "删掉这张图" }))
      return;
    const r = await postJSON("/api/prod/todo/img", { 来源: 拆K(dCur).来源, op: "del", id: +x.dataset.delimg });
    if (r && r.ok)
      refreshDetail();
    else
      toast(r && r.error || "删图失败", true);
  }));
  body.querySelectorAll("[data-dellink]").forEach((x) => x.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!await UI确认({ 题: "移除这个关联?", 说: "只拆掉这条待办和它的挂钩,挂的那个东西本身不动。", 钮字: "移除关联" }))
      return;
    const r = await postJSON("/api/todo/link/del", { 来源: 拆K(dCur).来源, id: +x.dataset.dellink });
    if (r && r.ok) {
      toast("已移除关联");
      refreshDetail();
    } else
      toast(r && r.error || "移除失败", true);
  }));
  const 挂钮 = body.querySelector("[data-linkadd]");
  if (挂钮)
    挂钮.addEventListener("click", (e) => {
      e.stopPropagation();
      开关联选择器(e.currentTarget);
    });
  body.querySelectorAll("[data-delcmt]").forEach((x) => x.addEventListener("click", async () => {
    if (!await 问删({ 屏上: "删掉这条评论?", 细说: "评论里带的图跟着一起删,都恢复不了。", 钮字: "删掉这条评论" }))
      return;
    const r = await postJSON("/api/prod/todo/comment", { 来源: 拆K(dCur).来源, op: "del", id: +x.dataset.delcmt });
    if (r && r.ok)
      refreshDetail();
    else
      toast(r && r.error || "删评论失败", true);
  }));
  绑评论改(body, 拆K(dCur).来源, refreshDetail);
  const 暂存 = [];
  const stagebox = body.querySelector("[data-stageimgs]");
  const 画暂存 = () => {
    stagebox.querySelectorAll(".thumb.stage").forEach((n) => n.remove());
    暂存.forEach((s, i) => {
      const div = document.createElement("div");
      div.className = "thumb stage";
      div.innerHTML = `<img src="${s.dataURL}"><span class="delimg">✗</span>`;
      div.querySelector(".delimg").addEventListener("click", () => {
        暂存.splice(i, 1);
        画暂存();
      });
      stagebox.insertBefore(div, stagebox.firstChild);
    });
  };
  const 暂存文件 = [];
  const filestage = body.querySelector("[data-stagefiles]");
  const 画暂存文件 = () => {
    filestage.innerHTML = 暂存文件.map((f, i) => `<span class="fstage">\uD83D\uDCC4 <span class="fn">${esc(f.name)}</span><b data-i="${i}" title="移除">✗</b></span>`).join("");
    filestage.querySelectorAll("b[data-i]").forEach((b) => b.addEventListener("click", () => {
      暂存文件.splice(+b.dataset.i, 1);
      画暂存文件();
    }));
  };
  body.querySelector("[data-stagefile]").addEventListener("change", async (e) => {
    for (const f of e.target.files) {
      if (f.type && f.type.startsWith("image/")) {
        const d = await 读dataURL(f);
        if (d) {
          暂存.push(d);
          toast("图片已归到评论图");
        }
      } else
        暂存文件.push(f);
    }
    e.target.value = "";
    画暂存();
    画暂存文件();
  });
  const 评论框 = body.querySelector("[data-cmttext]");
  const 评论按钮 = body.querySelector("[data-cmtsubmit]");
  const 刷评论按钮 = () => {
    评论按钮.disabled = !评论框.value.trim();
  };
  const 提交评论 = async () => {
    const v = 评论框.value.trim();
    if (!v)
      return;
    const one = 拆K(dCur);
    const r = await postJSON("/api/prod/todo/comment", { 来源: one.来源, op: "add", 待办id: one.id, 内容: v });
    if (!r || !r.ok) {
      toast(r && r.error || "评论失败", true);
      return;
    }
    for (const s of 暂存)
      await 上传图(s, one.id, r.新id);
    for (const f of 暂存文件)
      await 上传文件(f, r.新id);
    refreshDetail();
  };
  评论框.addEventListener("input", 刷评论按钮);
  刷评论按钮();
  评论按钮.addEventListener("click", 提交评论);
  评论框.addEventListener("keydown", (e) => {
    if (评论提交键(e)) {
      e.preventDefault();
      提交评论();
    }
  });
  document.querySelectorAll("#detailView [data-back]").forEach((a) => a.addEventListener("click", () => 显列表()));
  document.querySelectorAll("#detailView [data-openk]").forEach((a) => a.addEventListener("click", () => openDetail(a.dataset.openk)));
  const 加子钮 = body.querySelector("[data-addsub]");
  if (加子钮)
    加子钮.addEventListener("click", () => openCard(dCur));
  body.querySelectorAll("[data-subck]").forEach((ck) => ck.addEventListener("change", async (e) => {
    const 详情key = String(dCur), k = ck.dataset.subck, one = 拆K(k);
    const 到 = e.target.checked ? "已完成" : "未开始";
    const c = todos.find((x) => x.k === k);
    if (c)
      c.status = 到;
    const { r, 最新 } = await 排同字段写(k, "状态", 到);
    if (!最新 || dCur !== 详情key)
      return;
    if (r && r.ok)
      toast(`#${one.id} → ${到}`);
    else
      toast(r && r.error || "改不动", true);
    await loadList();
    if (dCur === 详情key)
      refreshDetail();
  }));
  body.querySelectorAll("[data-subdel]").forEach((x) => x.addEventListener("click", async () => {
    const k = x.dataset.subdel, one = 拆K(k);
    const c = todos.find((y) => y.k === k);
    if (!await 问删({
      屏上: "删掉这条子待办?",
      细说: `「${c ? c.matter : 数据ID(one.id)}」连评论、附件、正文先进回收站,留 10 天,能还原。
想留在列表里只是收起来,用「归档」。`,
      钮字: "删掉这条子待办"
    }))
      return;
    const r = await postJSON("/api/todo/del", { 来源: one.来源, id: one.id });
    if (!r || !r.ok) {
      toast(r && r.error || "删不掉", true);
      return;
    }
    删完提示(`已删 ${数据ID(one.id)},在回收站里`, [{ 来源: one.来源, 回收id: r.回收id }]);
    await loadList();
    refreshDetail();
  }));
  const 切归档 = async (to) => {
    const 挂着 = children(dCur).length;
    if (to && !await UI确认({ 题: "归档这条待办?", 说: `${挂着 ? `底下那 ${挂着} 条子待办会跟着一起收起来。
` : ""}它会从列表里收起来,记录一个字不删;
列表页勾上「显示归档」随时看回来。`, 钮字: "归档", 危: false })) {
      return;
    }
    const r = await postJSON("/api/todo/archive", { ids: [{ 来源: 拆K(dCur).来源, id: 拆K(dCur).id }], 归档: to ? 1 : 0 });
    if (!r || !r.ok) {
      toast(r && r.error || "操作失败", true);
      return;
    }
    toast((to ? "已归档 " : "已还原 ") + r.改数 + " 条" + (挂着 ? "(含底下的子待办)" : ""));
    await loadList();
    refreshDetail();
  };
  body.querySelector("[data-arch]").addEventListener("click", () => 切归档(!t.归档));
  const 换回钮 = body.querySelector("[data-ai-restore]");
  if (换回钮)
    换回钮.addEventListener("click", async () => {
      const 原文 = 读速记原文(t.速记原文);
      if (!原文) {
        toast("速记前的原文读不出来,正文没有替换", true);
        return;
      }
      if (!await 问删({
        屏上: "换回速记前那一版?",
        细说: "当前这版整理稿会被替换,换回后找不回来。",
        钮字: "换回这一版"
      }))
        return;
      const 原块 = JSON.parse(JSON.stringify(原文.块));
      const 现图 = new Set((det.详情图 || []).map((x) => +x.id));
      const 缺图 = 原块.filter((x) => x.type === "img" && !现图.has(+x.附件id)).length;
      if (缺图) {
        toast(`有 ${缺图} 块图找不回来了,正文没有替换`, true);
        return;
      }
      const 当前块 = JSON.parse(JSON.stringify(块));
      块 = 原块;
      画块();
      if (!await 存块()) {
        块 = 当前块;
        画块();
        return;
      }
      const one = 拆K(dCur);
      const 清 = await postJSON("/api/todo/edit", { 来源: one.来源, id: one.id, 列: "速记原文", 值: "" });
      if (!清 || !清.ok) {
        toast(清 && 清.error || "正文换回了,但原文记录没清掉", true);
        await refreshDetail();
        return;
      }
      toast("已换回速记前那一版");
      await refreshDetail();
    });
  const 转钮 = body.querySelector("[data-tonormal]");
  if (转钮)
    转钮.addEventListener("click", () => 转成待办(dCur));
}
function 开关联选择器(anchor) {
  document.getElementById("lkMask") && document.getElementById("lkMask").remove();
  const 草稿态 = 暂存态();
  const 来源 = 草稿态 ? 卡草稿 && 卡草稿.来源 || 默认源() : 拆K(正文落点()).来源;
  const 字段表 = 源信息(来源).关联字段 || {};
  const 类别 = Object.keys(字段表);
  if (!类别.length) {
    toast(`${源名(来源)}的待办这一版还没有可挑的数据`, true);
    return;
  }
  let 类型 = 类别[0], q = "", 防抖T, 序 = 0, 本页 = [];
  let 设置 = {}, 格改过 = false;
  const 选 = new Map;
  const 小字 = () => 源名(来源);
  const mask = document.createElement("div");
  mask.className = "mask";
  mask.id = "lkMask";
  mask.innerHTML = `<div class="modal">
    <div class="mh"><span class="grow">添加关联数据 · ${esc(源名(来源))}</span>
      <button class="ic lkset-btn" data-lkset title="设置这一类数据:挑选时显示哪几列、待办格子里显示哪几列,可拖顺序">⋯ 列设置</button>
      <button class="ic" data-x title="全关:这一层连底下的待办窗一起关,不挂任何东西">✗</button></div>
    <div class="mb"><div class="lkgrid">
      <div class="lkrail">${类别.map((t) => `<div class="reltab${t === 类型 ? " on" : ""}" data-t="${esc(t)}">${(tagMeta[t] || {}).emo || ""} ${esc(t)}<small>${esc(小字(t))}</small></div>`).join("")}</div>
      <div class="lkbody">
        <input class="lksearch" placeholder="搜名称、编号…">
        <div class="lkfil"></div>
        <div class="lklist"></div>
        <div class="sf-note" style="margin:8px 0 0">可勾选的记录 · 可多选</div>
      </div>
    </div>
    <div class="lkset" hidden></div>
    <div class="prop-foot">
      <span class="picked">已选 <b data-n>0</b> 项</span>
      <span class="fbtns"><button class="次钮" data-close>取消</button>
        <button class="主钮" data-go disabled title="先在右边勾上要挂的记录">添加 0 项</button></span>
      <div class="钮旁说明">右边勾一条记录,「添加」才点得动</div>
    </div></div></div>`;
  document.body.appendChild(mask);
  const 关只藏 = () => {
    管焦点(mask, false);
    mask.remove();
    if (格改过) {
      if (dCur != null)
        refreshDetail();
      else
        loadList();
    }
  };
  压上层(mask, "挂关联", 关只藏);
  const 关 = () => mask._退();
  mask._关 = 关;
  mask.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", 关));
  mask.querySelector("[data-x]").addEventListener("click", 叠层全关);
  mask.addEventListener("click", (e) => {
    if (e.target === mask)
      关();
  });
  管焦点(mask, true, () => mask.querySelector(".lksearch input") || mask.querySelector("[data-close]"));
  const listEl = mask.querySelector(".lklist"), search = mask.querySelector(".lksearch");
  const filEl = mask.querySelector(".lkfil");
  const nEl = mask.querySelector("[data-n]"), go = mask.querySelector("[data-go]");
  const setEl = mask.querySelector(".lkset");
  const 已挂 = () => 草稿态 ? 卡草稿 ? 卡草稿.链接.map((l) => ({ type: l.类型, 键: l.k })) : [] : (todos.find((x) => x.k === 正文落点()) || {}).links || [];
  const 刷底 = () => {
    nEl.textContent = 选.size;
    go.disabled = !选.size;
    go.textContent = `添加 ${选.size} 项`;
  };
  const 字段名 = (t, k) => (字段表[t].字段.find((f) => f.键 === k) || {}).名 || k;
  const 挑列 = (t) => 设置[t] && 设置[t].挑 || 字段表[t].挑;
  const 格列 = (t) => 设置[t] && 设置[t].格 || 字段表[t].格;
  const 值串 = (v) => v == null ? "" : String(v);
  const 筛上限 = 3;
  let 筛 = [];
  function 筛字段() {
    const out = {};
    (字段表[类型].字段 || []).forEach((f) => {
      const 名 = out[f.名] ? `${f.名}(${f.键})` : f.名;
      out[名] = { type: "text", get: (x) => (x.f || {})[f.键] };
    });
    return out;
  }
  const 筛过 = (x, 表) => 筛.every((c) => evalCond(x, c, 表));
  function 报筛数(总, 剩, 藏选) {
    const el = filEl.querySelector("[data-fc]");
    if (!el)
      return;
    el.textContent = !筛.length || 剩 === 总 && !藏选 ? "" : `搜到 ${总} 条,筛后 ${剩} 条` + (藏选 ? ` · 已选含 ${藏选} 项被筛掉` : "");
  }
  function 画筛() {
    const 表 = 筛字段(), 名单 = Object.keys(表);
    const 行 = 筛.map((c, i) => {
      const 值控 = 运算需值(c.op) ? `<input type="text" data-v value="${esc(c.val || "")}" placeholder="值…">` : "";
      return `<div class="advrow lkfrow" data-i="${i}">
        <span class="advfirst">${i ? "且" : "当"}</span>
        <select data-f title="按哪一列筛">${名单.map((k) => `<option ${k === c.field ? "selected" : ""}>${esc(k)}</option>`).join("")}</select>
        <select data-op title="怎么比">${advOps.text.map((o) => `<option ${o === c.op ? "selected" : ""}>${o}</option>`).join("")}</select>
        ${值控}
        <button type="button" class="op-link op-del" data-x title="删掉这一条筛选">✗</button></div>`;
    }).join("");
    const 尾 = 筛.length < 筛上限 ? `<button type="button" class="小钮" data-add title="再加一条筛选条件,最多 ${筛上限} 条">＋ 筛选</button>` : `<span class="fnote">最多 ${筛上限} 条筛选</span>`;
    filEl.innerHTML = 行 + `<div class="lkfoot">${尾}<span class="fnote" data-fc></span></div>`;
    filEl.querySelectorAll(".lkfrow").forEach((row) => {
      const i = +row.dataset.i, c = 筛[i];
      row.querySelector("[data-f]").addEventListener("change", (e) => {
        c.field = e.target.value;
        画筛();
        画表();
      });
      row.querySelector("[data-op]").addEventListener("change", (e) => {
        c.op = e.target.value;
        if (!运算需值(c.op))
          c.val = "";
        画筛();
        画表();
      });
      const v = row.querySelector("[data-v]");
      if (v)
        v.addEventListener("input", () => {
          c.val = v.value;
          画表();
        });
      row.querySelector("[data-x]").addEventListener("click", () => {
        筛.splice(i, 1);
        画筛();
        画表();
      });
    });
    const add = filEl.querySelector("[data-add]");
    if (add)
      add.addEventListener("click", () => {
        筛.push({ field: 名单[0], op: "包含", val: "" });
        画筛();
        画表();
        const 末 = filEl.querySelector(".lkfrow:last-of-type [data-v]");
        if (末)
          末.focus();
      });
  }
  function 画表() {
    const 筛表 = 筛字段();
    const 显 = 筛.length ? 本页.filter((x) => 筛过(x, 筛表)) : 本页;
    const 藏选 = 筛.length ? [...选.values()].filter((v) => v.类型 === 类型 && !显.some((x) => x.k === v.k)).length : 0;
    报筛数(本页.length, 显.length, 藏选);
    if (!本页.length) {
      listEl.innerHTML = '<div class="emptyline">没搜到 —— 换个词?</div>';
      return;
    }
    if (!显.length) {
      listEl.innerHTML = `<div class="emptyline">筛选把这 ${本页.length} 条都滤掉了 —— 放宽一条?</div>`;
      return;
    }
    const 列 = 挑列(类型), 有号 = 显.some((x) => x.号);
    listEl.innerHTML = `<table class="lktab"><thead><tr><th class="lk-ck"></th>${有号 ? "<th>ID</th>" : ""}${列.map((k) => `<th data-colk="${esc(k)}">${esc(字段名(类型, k))}</th>`).join("")}</tr></thead><tbody>` + 显.map((x) => {
      const i = 本页.indexOf(x);
      const 挂过 = 已挂().some((l) => l.type === 类型 && l.键 === x.k);
      const f = x.f || {};
      return `<tr class="lktr${挂过 ? " 挂过" : ""}" data-i="${i}"${挂过 ? ' title="已经挂在这条待办上了"' : ""}>
          <td class="lk-ck"><input type="checkbox" data-i="${i}" ${挂过 ? "disabled" : ""} ${选.has(类型 + "|" + x.k) ? "checked" : ""}>${挂过 ? "<small>已挂</small>" : ""}</td>
          ${有号 ? `<td class="lk-id">${esc(x.号 || "")}</td>` : ""}
          ${列.map((k) => `<td title="${esc(值串(f[k]))}">${esc(值串(k === "名称" ? f[k] || x.t : f[k]))}</td>`).join("")}</tr>`;
    }).join("") + "</tbody></table>";
    listEl.querySelectorAll("input[data-i]").forEach((c) => c.addEventListener("change", () => {
      const x = 本页[+c.dataset.i], key = 类型 + "|" + x.k;
      if (c.checked)
        选.set(key, { 类型, k: x.k, t: x.t, 号: x.号 });
      else
        选.delete(key);
      刷底();
    }));
    listEl.querySelectorAll("tr.lktr").forEach((tr) => tr.addEventListener("click", (e) => {
      if (e.target.closest("input"))
        return;
      const c = tr.querySelector("input");
      if (!c || c.disabled)
        return;
      c.checked = !c.checked;
      c.dispatchEvent(new Event("change"));
    }));
  }
  async function 拉() {
    const my = ++序;
    listEl.innerHTML = '<div class="emptyline"><i class="符 转">&#10227;</i> 搜索中…</div>';
    const res = await postJSON("/api/todo/link/search", { 来源, 类型, q });
    if (my !== 序 || !mask.isConnected)
      return;
    if (!res || !res.ok) {
      listEl.innerHTML = `<div class="emptyline"><i class="符 坏">&#10007;</i> ${esc(String(res && res.error || "搜索失败"))} <button type="button" class="小钮" title="按同一个词再搜一次">重试</button></div>`;
      listEl.querySelector("button").onclick = 拉;
      return;
    }
    本页 = res.items || [];
    if (res.设置 && res.设置.挑)
      设置[类型] = res.设置;
    画表();
  }
  let 段态 = null;
  function 建段态() {
    const 全 = 字段表[类型].字段.map((f) => f.键);
    const 排 = (开) => [...开.map((k) => ({ k, on: true })), ...全.filter((k) => !开.includes(k)).map((k) => ({ k, on: false }))];
    段态 = { 挑: 排(挑列(类型)), 格: 排(格列(类型)) };
  }
  const 段名 = { 挑: "挑选时显示", 格: "格子里显示" };
  const 段说明 = { 挑: "这个挑选框右边表格里显示哪几列、什么顺序", 格: "待办列表「关联标签」格里,软件名和 ID 后面接哪几列,按顺序用「 · 」连起来" };
  function 画设置() {
    setEl.innerHTML = `<div class="ls-h"><b>${esc(类型)} · 列设置</b>
        <button type="button" class="小钮" data-lsreset title="这一类的两段都回到默认列">恢复默认</button>
        <button type="button" class="ic" data-lsclose title="收起列设置" aria-label="收起">✗</button></div>` + ["挑", "格"].map((sec) => `<div class="ls-sec" data-sec="${sec}"><div class="ls-t" title="${esc(段说明[sec])}">${段名[sec]}</div>` + 段态[sec].map((r, i) => `<div class="ls-row${r.on ? "" : " off"}" draggable="true" data-sec="${sec}" data-i="${i}" data-k="${esc(r.k)}">
          <span class="ls-drag" title="按住拖动,改顺序" aria-hidden="true">⠿</span>
          <span class="ls-name">${esc(字段名(类型, r.k))}</span>
          <span class="ls-mv"><button type="button" data-mv="-1" title="往前挪一位" aria-label="上移" ${i ? "" : "disabled"}>↑</button><button type="button" data-mv="1" title="往后挪一位" aria-label="下移" ${i < 段态[sec].length - 1 ? "" : "disabled"}>↓</button></span>
          <button type="button" class="ls-eye" data-eye aria-pressed="${r.on}" title="${r.on ? "显示中,点一下藏起" : "藏着,点一下显示"}">${r.on ? "\uD83D\uDC41" : "⊘"}</button>
        </div>`).join("") + "</div>").join("") + '<div class="ls-note" title="改完马上存进待办库,每类一份;两段各至少留一列">拖 ⠿ 或点 ↑↓ 改顺序 · 点 \uD83D\uDC41 显示或藏起</div>';
    setEl.querySelector("[data-lsclose]").onclick = () => {
      setEl.hidden = true;
    };
    setEl.querySelector("[data-lsreset]").onclick = () => 存设置("reset");
    setEl.querySelectorAll(".ls-row").forEach((row) => {
      const sec = row.dataset.sec, i = +row.dataset.i;
      row.querySelector("[data-eye]").onclick = () => {
        const 开数 = 段态[sec].filter((r) => r.on).length;
        if (段态[sec][i].on && 开数 <= 1) {
          toast(`${段名[sec]}至少留一列`, true);
          return;
        }
        段态[sec][i].on = !段态[sec][i].on;
        存设置("set");
      };
      row.querySelectorAll("[data-mv]").forEach((b) => b.onclick = () => 挪(sec, i, i + +b.dataset.mv));
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", sec + "|" + i);
        row.classList.add("拖中");
      });
      row.addEventListener("dragend", () => row.classList.remove("拖中"));
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        row.classList.add("落点");
      });
      row.addEventListener("dragleave", () => row.classList.remove("落点"));
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("落点");
        const [s2, i2] = (e.dataTransfer.getData("text/plain") || "").split("|");
        if (s2 !== sec)
          return;
        挪(sec, +i2, i);
      });
    });
  }
  function 挪(sec, 从, 到) {
    const 列 = 段态[sec];
    if (从 === 到 || 到 < 0 || 到 >= 列.length || 从 < 0 || 从 >= 列.length)
      return;
    const [r] = 列.splice(从, 1);
    列.splice(到, 0, r);
    存设置("set");
  }
  async function 存设置(op) {
    const 体 = { 来源, op, 类型 };
    if (op === "set") {
      体.挑 = 段态.挑.filter((r) => r.on).map((r) => r.k);
      体.格 = 段态.格.filter((r) => r.on).map((r) => r.k);
    }
    const 旧格 = JSON.stringify(格列(类型));
    const r = await postJSON("/api/todo/link/cols", 体);
    if (!r || !r.ok) {
      toast(r && r.error || "列设置没存上,再试一次", true);
      建段态();
      画设置();
      return;
    }
    设置 = r.设置 || {};
    if (JSON.stringify(格列(类型)) !== 旧格)
      格改过 = true;
    建段态();
    画设置();
    画表();
  }
  mask.querySelector("[data-lkset]").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!setEl.hidden) {
      setEl.hidden = true;
      return;
    }
    建段态();
    画设置();
    setEl.hidden = false;
  });
  mask.querySelectorAll(".reltab").forEach((tb) => tb.addEventListener("click", () => {
    mask.querySelectorAll(".reltab").forEach((z) => z.classList.remove("on"));
    tb.classList.add("on");
    类型 = tb.dataset.t;
    本页 = [];
    筛 = [];
    画筛();
    if (!setEl.hidden) {
      建段态();
      画设置();
    }
    拉();
    search.focus();
  }));
  search.addEventListener("input", () => {
    q = search.value.trim();
    clearTimeout(防抖T);
    防抖T = setTimeout(拉, 250);
  });
  go.addEventListener("click", async () => {
    go.disabled = true;
    go.textContent = "添加中…";
    if (草稿态) {
      选.forEach((v) => 卡草稿.链接.push({ 类型: v.类型, k: v.k, 文本: v.t, 号: v.号 }));
      关();
      toast(`已挂 ${选.size} 项(存卡的时候一起挂上去)`);
      画卡关联();
      推撤销快照();
      return;
    }
    const one = 拆K(正文落点());
    let 成 = 0;
    for (const v of 选.values()) {
      const r2 = await postJSON("/api/todo/link/add", { 来源: one.来源, 待办id: one.id, 关联类型: v.类型, 关联键: v.k, 显示文本: v.t });
      if (r2 && r2.ok)
        成++;
    }
    格改过 = false;
    关();
    toast(`已挂 ${成} 项`);
    if (dCur != null)
      refreshDetail();
    else {
      await loadList();
      if (卡宿 === "note")
        画便笺关联();
      else
        画卡关联();
      推撤销快照();
    }
  });
  postJSON("/api/todo/link/cols", { 来源, op: "get" }).then((r) => {
    if (r && r.ok && mask.isConnected) {
      设置 = Object.assign(r.设置 || {}, 设置);
      if (本页.length)
        画表();
    }
  });
  画筛();
  拉();
  search.focus();
}
function 读dataURL(file) {
  return new Promise((res) => {
    if (!file.type.startsWith("image/")) {
      toast("只收图片", true);
      res(null);
      return;
    }
    const fr = new FileReader;
    fr.onload = () => res({ dataURL: fr.result, mime: file.type, 原名: file.name });
    fr.onerror = () => res(null);
    fr.readAsDataURL(file);
  });
}
async function 上传图(s, 待办id, 评论id, 来源) {
  const b64 = String(s.dataURL).split(",")[1] || "";
  const r = await postJSON("/api/prod/todo/img", { 来源: 来源 || (dCur ? 拆K(dCur).来源 : 默认源()), op: "add", 待办id, 评论id: 评论id || null, base64: b64, mime: s.mime, 原名: s.原名 });
  if (!r || !r.ok) {
    toast(r && r.error || "传图失败", true);
    return null;
  }
  return r.图.id;
}
document.getElementById("cardMatter").addEventListener("keydown", (e) => {
  if (e.key !== "Enter")
    return;
  if (卡宿 === "card" && 卡草稿 && 卡草稿._已有) {
    if (e.isComposing)
      return;
    e.preventDefault();
    const el = 文档元素(), f = el && el.querySelector("[contenteditable]");
    if (f)
      f.focus();
    return;
  }
  e.preventDefault();
  submitCard();
});
document.getElementById("cardMask").addEventListener("click", (e) => {
  if (e.target.id === "cardMask")
    请求关闭待办();
});
document.getElementById("noteMask").addEventListener("click", (e) => {
  if (e.target.id === "noteMask")
    closeNote();
});
document.getElementById("cardStars").addEventListener("click", setCardStar);
document.getElementById("cardMatter").addEventListener("input", 标卡有改动);
document.getElementById("cardStatus").addEventListener("change", 标卡有改动);
document.getElementById("cardDate").addEventListener("change", 标卡有改动);
document.getElementById("cardTarget").addEventListener("input", 标卡有改动);
document.getElementById("cardArch").addEventListener("change", 标卡有改动);
document.getElementById("cardArch").addEventListener("change", 画卡归档钮);
document.getElementById("cardArchBtn").addEventListener("click", () => {
  const box = document.getElementById("cardArch");
  box.checked = !box.checked;
  box.dispatchEvent(new Event("change", { bubbles: true }));
});
document.getElementById("cardFull").addEventListener("click", 下一卡形态);
document.getElementById("noteFull").addEventListener("click", 下一卡形态);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (document.querySelector("dialog[open]"))
      return;
    if (document.getElementById("aiMask") || document.getElementById("lkMask"))
      return;
    const 接 = () => e.preventDefault();
    if (document.getElementById("noteLook")?.hidden === false) {
      外观取消();
      return 接();
    }
    if (关AI预览())
      return 接();
    if (斜杠态) {
      关斜杠();
      return 接();
    }
    if (块菜单) {
      关块菜单();
      return 接();
    }
    if (document.getElementById("noteFind")?.hidden === false) {
      关便笺搜索(true);
      return 接();
    }
    if (选块.size) {
      选块.clear();
      画块();
      return 接();
    }
    const duepop = document.querySelector(".duepop");
    if (duepop) {
      duepop.remove();
      return 接();
    }
    if (!document.getElementById("advMask").classList.contains("hidden")) {
      closeAdv();
      return 接();
    }
    if (编器 && 卡形态 === "page") {
      切卡形态(卡宿 === "note" ? "sm" : "lg");
      return 接();
    }
    if (编器) {
      (卡宿 === "note" ? closeNote : 请求关闭待办)();
      return 接();
    }
    if (dCur != null) {
      显列表();
      return;
    }
  }
});
document.getElementById("dFilePick").addEventListener("change", (e) => {
  const 落 = 图落点;
  图落点 = null;
  if (编器在() && e.target.files[0])
    读图上传(e.target.files[0], 落 ? 落.at : undefined, 落);
  e.target.value = "";
});
document.getElementById("dBlockFilePick").addEventListener("change", (e) => {
  const 落 = 文件落点;
  文件落点 = null;
  if (编器在() && e.target.files[0])
    读文件入块(e.target.files[0], 落 ? 落.at : undefined, 落);
  e.target.value = "";
});
document.addEventListener("paste", async (e) => {
  if (e.target.closest && e.target.closest("#noteMd")) {
    const 有字 = !!(e.clipboardData && e.clipboardData.getData("text/plain"));
    if (!有字 && [...e.clipboardData && e.clipboardData.items || []].some((i) => i.kind === "file")) {
      e.preventDefault();
      toast("两栏里贴不了图 / 文件:切回块编辑再贴", true);
    }
    return;
  }
  if (!编器在())
    return;
  const cd = e.clipboardData;
  if (!cd)
    return;
  const 落 = e.target.closest ? e.target.closest("[contenteditable]") : null;
  const 文件图 = [...cd.items || []].filter((i) => i.kind === "file" && (i.type || "").startsWith("image/")).map((i) => i.getAsFile()).filter(Boolean);
  const html = cd.getData("text/html") || "";
  const 纯文 = cd.getData("text/plain") || "";
  if (落 && (落.classList.contains("bkcode") || 落.classList.contains("dtitle") || 落.classList.contains("cardmatter") || 落.classList.contains("bkcell"))) {
    e.preventDefault();
    document.execCommand("insertText", false, 落.classList.contains("bkcode") ? 纯文 : 纯文.replace(/\s+/g, " ").trim());
    return;
  }
  if (html.trim()) {
    let 片 = [];
    try {
      片 = 拆网页片(html);
    } catch (err) {
      片 = [];
    }
    const 有图 = 片.some((x) => x.t === "img");
    if (!有图 && 片.every((x) => x.t === "text") && 纯文.includes(`
`) && (像MD原文(纯文) || /white-space:\s*pre/i.test(html))) {
      e.preventDefault();
      await 网页片入块(纯文.replace(/\r\n?/g, `
`).replace(/\n$/, "").split(`
`).map((text) => ({ t: "text", text })), [], 焦点块后());
      return;
    }
    const 有结构 = 片.some((x) => x.t !== "text") || 片.length > 1;
    if (片.length && (有图 || 有结构)) {
      e.preventDefault();
      await 网页片入块(片, 文件图, 焦点块后());
      return;
    }
  }
  if (文件图.length) {
    e.preventDefault();
    let at = 焦点块后();
    for (const f of 文件图) {
      await 读图上传(f, at);
      if (at != null)
        at++;
    }
    return;
  }
  if (落 && 纯文.includes(`
`) && 像MD原文(纯文)) {
    e.preventDefault();
    await 网页片入块(纯文.replace(/\r\n?/g, `
`).replace(/\n$/, "").split(`
`).map((text) => ({ t: "text", text })), [], 焦点块后());
    return;
  }
  if (落) {
    e.preventDefault();
    document.execCommand("insertText", false, 纯文);
  }
});
document.addEventListener("dragover", (e) => {
  if (编器在())
    e.preventDefault();
});
document.addEventListener("drop", async (e) => {
  if (e.target.closest && e.target.closest("#noteMd")) {
    if ((e.dataTransfer && e.dataTransfer.files || []).length) {
      e.preventDefault();
      toast("两栏里拖不进图 / 文件:切回块编辑再拖", true);
    }
    return;
  }
  if (!编器在())
    return;
  e.preventDefault();
  const 拖回 = 外拖, 落件 = e.dataTransfer && e.dataTransfer.files || [];
  外拖 = null;
  if (拖回 && Date.now() - 拖回.时 < 60000 && 落件.length === 1 && 松名(落件[0].name) === 拖回.名)
    return;
  let got = false, hadFile = false;
  for (const f of e.dataTransfer && e.dataTransfer.files || []) {
    if (f.type && f.type.startsWith("image/")) {
      await 读图上传(f);
      got = true;
    } else if (f.name) {
      if (await 上传文件(f))
        hadFile = true;
      got = true;
    }
  }
  if (hadFile && !暂存态())
    refreshDetail();
  if (hadFile && 暂存态())
    画卡附件();
  if (got)
    return;
  const html = e.dataTransfer && e.dataTransfer.getData("text/html") || "";
  if (html.trim()) {
    let 片 = [];
    try {
      片 = 拆网页片(html);
    } catch (err) {
      片 = [];
    }
    if (片.length) {
      await 网页片入块(片, [], undefined);
      return;
    }
  }
  const uri = (e.dataTransfer && e.dataTransfer.getData("text/uri-list") || "").split(`
`)[0];
  if (uri && /^(https?:|data:image)/.test(uri)) {
    外链图入库(uri);
    return;
  }
  const 纯文 = (e.dataTransfer && e.dataTransfer.getData("text/plain") || "").replace(/\r\n?/g, `
`);
  if (!纯文.trim())
    return;
  const 编 = e.target.closest ? e.target.closest('[contenteditable]:not([contenteditable="false"]),textarea,input:is([type=text],[type=search],:not([type]))') : null;
  if (!编) {
    await 网页片入块([{ t: "text", text: 纯文.trim() }], [], undefined);
    return;
  }
  编.focus();
  const 点 = 落点光标(e.clientX, e.clientY);
  if (点 && 编.contains(点.startContainer)) {
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(点);
  }
  document.execCommand("insertText", false, 编.matches("input,.dtitle,.cardmatter,.bkcell") ? 纯文.replace(/\s+/g, " ").trim() : 纯文);
});
function 落点光标(x, y) {
  if (document.caretRangeFromPoint)
    return document.caretRangeFromPoint(x, y);
  const p = document.caretPositionFromPoint && document.caretPositionFromPoint(x, y);
  if (!p)
    return null;
  const r = document.createRange();
  r.setStart(p.offsetNode, p.offset);
  r.collapse(true);
  return r;
}
function 装子标签视图() {
  const bar = document.getElementById("listBar");
  if (!bar)
    return;
  const lead = document.createElement("span");
  lead.className = "tb-lead";
  lead.id = "tabCount";
  const sel = document.createElement("select");
  sel.id = "tabState";
  sel.className = "tab-state";
  sel.title = "按状态看:全部 / 今日到期(含逾期)/ 未开始 / 进行中 / 已完成;最后一项「归档箱」看归档过的";
  sel.setAttribute("aria-label", "按状态看");
  sel.addEventListener("change", () => {
    const v = sel.value, 进归档 = v === "归档箱";
    if (!进归档)
      页签 = v;
    const fa = document.getElementById("fArch");
    if (fa.checked !== 进归档) {
      fa.checked = 进归档;
      onArchChange();
    } else {
      selected.clear();
      render();
    }
  });
  const 搜 = bar.querySelector(".search2");
  const 搜钮 = document.createElement("button");
  搜钮.type = "button";
  搜钮.className = "mini tab-搜钮";
  搜钮.id = "tabSearchBtn";
  搜钮.textContent = "\uD83D\uDD0D";
  搜钮.title = "搜索事项、关联数据";
  搜钮.setAttribute("aria-label", "搜索");
  搜钮.addEventListener("click", () => {
    搜.classList.remove("收");
    排子标签工具();
    搜.querySelector("input").focus();
  });
  搜.querySelector("input").addEventListener("blur", () => {
    setTimeout(() => {
      定搜索框收放();
      排子标签工具();
    }, 0);
  });
  const 表钮 = document.createElement("button");
  表钮.type = "button";
  表钮.className = "mini tab-表钮";
  表钮.id = "tabToolBtn";
  表钮.innerHTML = '⚙<span class="tab-长"> 表格</span> ▾';
  表钮.title = "高级筛选、列显示、回收站(一行放不下时收在这里)";
  表钮.setAttribute("aria-label", "表格:高级筛选、列显示、回收站");
  表钮.setAttribute("aria-haspopup", "menu");
  表钮.addEventListener("click", 开子标签表格菜单);
  const add = document.getElementById("btnAdd");
  add.innerHTML = '＋ <span class="tab-长">创建待办</span><span class="tab-短">新建</span>';
  add.setAttribute("aria-label", "创建待办");
  bar.prepend(lead);
  lead.after(sel);
  sel.after(搜钮);
  搜钮.after(搜);
  document.getElementById("colBtn").closest(".toolwrap").after(表钮);
  const pick = document.getElementById("btnLkPick");
  if (pick) {
    pick.textContent = "关联已有";
    add.after(pick);
  }
  document.getElementById("tb").addEventListener("click", (e) => {
    const td = e.target.closest("td.cchk");
    if (!td || e.target.matches("input"))
      return;
    const box = td.querySelector("input[type=checkbox]");
    if (box && !box.disabled) {
      e.stopPropagation();
      box.click();
    }
  });
  const th = document.querySelector('th[data-col="计划完成"]');
  if (th)
    th.title = "排序:逾期 → 今日 → 未排期 → 往后的日子;同一组里重要程度高的在前";
  if (typeof ResizeObserver === "function") {
    let w = bar.clientWidth;
    new ResizeObserver(() => {
      if (bar.clientWidth !== w) {
        w = bar.clientWidth;
        排子标签工具();
      }
    }).observe(bar);
    new ResizeObserver(发子标签高度).observe(document.body);
  }
  new MutationObserver(发子标签高度).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden", "style"] });
}
function 定搜索框收放() {
  const 搜 = document.querySelector("#listBar .search2");
  if (!搜)
    return;
  const 条数 = +(document.getElementById("tabCount")?.dataset.n || 0);
  搜.classList.toggle("收", 条数 <= 10 && !搜.querySelector("input").value && document.activeElement !== 搜.querySelector("input"));
}
function 画子标签条(顶层数) {
  const lead = document.getElementById("tabCount");
  if (!lead)
    return;
  lead.dataset.n = 顶层数;
  lead.textContent = `共 ${顶层数} 条${archView ? "(归档箱)" : ""}`;
  const sel = document.getElementById("tabState");
  const 数 = (k) => document.querySelector(`[data-cnt="${k}"]`)?.textContent || "0";
  const 今名 = 范围名[+(document.getElementById("fScope")?.value || 0)] || "今日";
  sel.innerHTML = 页签集.map((k) => `<option value="${k}">${k === "今日" ? 今名 : k}${archView ? "" : " " + 数(k)}</option>`).join("") + '<option value="归档箱">归档箱</option>';
  sel.value = archView ? "归档箱" : 页签;
  定搜索框收放();
  排子标签工具();
  发子标签高度();
}
function 子标签空表() {
  const 有挂 = lkFilter && lkFilter.ids.size > 0;
  const 话 = archView ? "归档箱是空的" : !有挂 ? "还没有挂在这里的待办" : "没有符合条件的待办";
  return `<tr><td colspan="13"><div class="空 tab-空"><p class="空话">${话}</p></div></td></tr>`;
}
function 排子标签工具() {
  const bar = document.getElementById("listBar");
  if (!bar || !bar.clientWidth)
    return;
  bar.classList.remove("收工具", "收关联", "收字", "换行");
  const 搜 = bar.querySelector(".search2");
  const 挤 = () => {
    const L = bar.getBoundingClientRect().left, lead = document.getElementById("tabCount");
    return bar.scrollWidth > bar.clientWidth + 1 || [...bar.children].some((c) => c.offsetWidth && c.getBoundingClientRect().left < L - 1) || lead && lead.scrollWidth > lead.clientWidth + 1 || 搜 && 搜.offsetWidth && 搜.offsetWidth < 120;
  };
  if (挤())
    bar.classList.add("收工具");
  if (挤() && document.getElementById("btnLkPick"))
    bar.classList.add("收关联");
  if (挤())
    bar.classList.add("收字");
  if (挤())
    bar.classList.add("换行");
}
function 开子标签表格菜单(e) {
  e.stopPropagation();
  let m = document.getElementById("tabToolMenu");
  if (m && !m.hidden) {
    m.hidden = true;
    return;
  }
  if (!m) {
    m = document.createElement("div");
    m.id = "tabToolMenu";
    m.className = "scope-menu";
    m.setAttribute("role", "menu");
    document.body.appendChild(m);
    document.addEventListener("click", (ev) => {
      if (!m.hidden && !m.contains(ev.target))
        m.hidden = true;
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !m.hidden) {
        m.hidden = true;
        document.getElementById("tabToolBtn").focus();
      }
    });
  }
  const bar = document.getElementById("listBar");
  m.innerHTML = '<button type="button" role="menuitem" data-a="adv">高级筛选</button>' + '<button type="button" role="menuitem" data-a="cols">列显示</button>' + (bar.classList.contains("收关联") ? '<button type="button" role="menuitem" data-a="pick">关联已有待办</button>' : "") + `<button type="button" role="menuitem" data-a="trash">回收站 ${esc(document.querySelector("#btnTrash .计")?.textContent || "")}</button>`;
  m.onclick = (ev) => {
    const a = ev.target.closest("[data-a]")?.dataset.a;
    if (!a)
      return;
    m.hidden = true;
    if (a === "adv")
      openAdv();
    else if (a === "cols")
      toggleColMenu(ev);
    else if (a === "pick")
      openLkPick({ stopPropagation() {}, currentTarget: document.getElementById("tabToolBtn") });
    else if (a === "trash")
      开回收站();
  };
  m.hidden = false;
  const r = e.currentTarget.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + scrollX + "px";
  m.style.top = r.bottom + 4 + scrollY + "px";
}
let _上次高 = 0, _高排队 = false;
function 发子标签高度() {
  if (!TAB视图 || window.parent === window || _高排队)
    return;
  _高排队 = true;
  requestAnimationFrame(() => {
    _高排队 = false;
    const 可见 = (el) => !el.hidden && !el.classList.contains("hidden") && getComputedStyle(el).display !== "none";
    let h = 0;
    for (const el of document.body.children) {
      if (!可见(el))
        continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.position === "absolute") {
        if (el.classList.contains("mask")) {
          const 块 = el.firstElementChild || el;
          h = Math.max(h, 块.scrollHeight + 48, 520);
        } else if (!el.classList.contains("提示栈") && el.offsetHeight) {
          h = Math.max(h, el.getBoundingClientRect().bottom + scrollY + 8);
        }
        continue;
      }
      h = Math.max(h, el.getBoundingClientRect().bottom + scrollY + (parseFloat(cs.marginBottom) || 0));
    }
    const 列单 = document.getElementById("colMenu");
    if (列单 && 列单.classList.contains("open"))
      h = Math.max(h, 列单.getBoundingClientRect().bottom + 8);
    h = Math.ceil(h);
    if (!h || Math.abs(h - _上次高) < 2)
      return;
    _上次高 = h;
    window.parent.postMessage({ type: "todo:height", h }, "*");
  });
}
宽屏查询.addEventListener("change", () => {
  if (dCur != null || 卡宿 === "note" && 编器 && 卡形态 === "page" || 首页展开key)
    return;
  显示主面板DOM();
  renderHome();
});
const _boot = (async () => {
  显示主面板DOM();
  await initLkFilter();
  if (TAB视图)
    装子标签视图();
  await loadList();
  刷回收站数();
  await 初始化工作视图();
  const qs = new URLSearchParams(location.search), td = qs.get("td");
  const 起始视图 = EMBED || lkFilter ? "list" : "home";
  if (SOLO) {
    主视图 = 起始视图;
    await 独窗开();
  } else if (td) {
    主视图 = 起始视图;
    await openDetail((qs.get("src") || 默认源()) + ":" + td, false);
  } else {
    主视图 = 起始视图;
    显示主面板DOM();
    renderHome();
  }
})();

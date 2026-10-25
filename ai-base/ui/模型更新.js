function 创建模型更新页(root, request, copy, 选项 = {}) {
  let preview = { 行: [], 更新: [], 刷新: [] }, busy = false, filter = "有新版", 家们 = {}, 档序 = [];
  let choices = new Map, selected = new Set, held = new Set, manual = new Set, receipt = null, 改 = null, 等画 = 0;
  let 勾快照 = new Set;
  let 表控 = null, 骨 = null;
  const 关档 = "关";
  const filters = [
    ["有新版", "有新版"],
    ["清单里没有当前模型", "清单里没有现在用的模型"],
    ["已固定", "不再提示新版"]
  ];
  const 列们 = [
    ["ID", 76, "这一行功能的编号:建的时候程序发的,改名、挪先后都不变;删掉的号不再发。"],
    ["功能", 260, "这条功能叫什么;缩进带「备选」的是首选连不上时顺着换的模型"],
    ["供应商", 130, "这一行拨给哪一家"],
    ["现在用", 150, "库里现在存着的模型"],
    ["换成", 210, "选一个新模型,勾上这一行再点「应用」才真换"],
    ["推理强度", 140, "模型想多久再答,low / medium / high 这类档。点格里 ✎ 改,点格外就存,不用点应用"],
    ["状态", 230, "跟这一家的模型清单比出来的结果"],
    ["不再提示新版", 120, "打开后检查更新不再推荐这行换新"]
  ];
  const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "text")
        e.textContent = v;
      else if (k === "class")
        e.className = v;
      else if (k.startsWith("on"))
        e.addEventListener(k.slice(2), v);
      else if (["checked", "disabled", "indeterminate", "value"].includes(k))
        e[k] = v;
      else
        e.setAttribute(k, v);
    }
    for (const child of children)
      if (child != null)
        e.appendChild(child);
    return e;
  };
  const button = (text, onclick, attrs = {}) => el("button", { type: "button", class: "mini", text, onclick, disabled: busy, ...attrs });
  const matches = (r, f = filter) => r.状态 === f;
  const visible = () => preview.行.filter((r) => matches(r) || held.has(r.功能名));
  const blocked = (r) => r.不提新版 || r.状态 === "拨不动";
  const pickable = (r) => !blocked(r) && r.可选模型.includes(choices.get(r.功能名));
  const picks = () => preview.行.filter((r) => selected.has(r.功能名) && pickable(r)).map((r) => ({ 功能名: r.功能名, 新模型: choices.get(r.功能名) }));
  function 档情(r) {
    const 家 = 家们[r.供应商];
    const 情 = 家 && 家.模型档位 && 家.模型档位[r.旧模型];
    if (情 && 情.来源 === "不吃这一格")
      return null;
    return { 清单: (情 ? 情.档们 : 家 && 家.强度档) || [], 认准: !!情 && 情.来源 === "接口自报" };
  }
  function receive(p, reset = false) {
    preview = p;
    if (reset)
      manual.clear();
    const oldChoices = choices, oldSelected = new Set(selected);
    choices = new Map;
    selected.clear();
    for (const r of p.行) {
      const old = oldChoices.get(r.功能名);
      const target = manual.has(r.功能名) && old && r.可选模型.includes(old) ? old : r.新模型 || (r.可选模型.includes(r.旧模型) ? r.旧模型 : "");
      choices.set(r.功能名, target);
      if (pickable(r) && (manual.has(r.功能名) && oldChoices.has(r.功能名) ? oldSelected.has(r.功能名) : r.状态 === "有新版"))
        selected.add(r.功能名);
    }
    if (reset)
      held.clear();
    勾快照 = new Set(selected);
    render();
  }
  function error(action, url, raw) {
    const original = raw?.stack || raw?.message || String(raw);
    const name = original.match(/「([^」]+)」/);
    const text = name && action === "应用" ? `${name[1].length > 10 ? name[1].slice(0, 10) + "…" : name[1]}没换成，请检查设置` : `${action}未完成，复制报错`;
    return { bad: true, text, full: `${text}
原始报错:${original}
接口:${url}
时间:${new Date().toISOString()}
错误号:UPDATES-${Date.now().toString(36)}` };
  }
  async function operate(action, data) {
    if (busy)
      return;
    const url = action === "effort" ? "/api/effort" : "/api/model-updates/" + action;
    const name = { check: "检查", apply: "应用", undo: "撤回", fixed: "设置", effort: "推理强度" }[action];
    busy = true;
    receipt = { text: action === "apply" ? "正在核对推理档位…" : `正在${name === "推理强度" ? "存推理强度" : name}…` };
    render();
    try {
      const result = await request(url, data);
      if (!result.成了)
        throw new Error(result.说 || result.错 || "接口未返回结果");
      if (action === "apply") {
        for (const r of data.选中) {
          const name = result.改名?.[r.功能名] || r.功能名;
          selected.delete(r.功能名);
          selected.delete(name);
          choices.delete(r.功能名);
          choices.set(name, r.新模型);
          manual.add(name);
        }
      }
      if (action === "fixed") {
        held.add(data.功能名);
        manual.add(data.功能名);
      }
      receipt = { text: action === "apply" ? result.数量 ? `已换 ${result.数量} 条，可撤回` : "没有需要更换的模型" : action === "undo" ? `已撤回 ${result.数量} 条` : action === "check" ? "模型清单检查完成" : action === "effort" ? `「${data.功能名}」推理强度改成 ${data.用力 === 关档 ? "关闭" : data.用力}` : "设置已保存" };
      if (action === "effort") {
        const s = await request("/api/state");
        收状态(s);
        receive(s.模型更新);
      } else
        receive(result.模型更新, action === "undo");
      if (["apply", "undo", "effort", "fixed"].includes(action) && 选项.改完)
        选项.改完();
    } catch (e) {
      receipt = error(name, url, e);
    } finally {
      busy = false;
      render();
    }
  }
  async function showApply() {
    if (busy || !preview.指纹 || !picks().length)
      return;
    const 选 = picks();
    const 行 = 选.map((p) => {
      const r = preview.行.find((x) => x.功能名 === p.功能名);
      return p.功能名 + ":" + (r?.旧模型 || "—") + " → " + p.新模型;
    });
    if (!await UI确认({ 题: `应用选中的 ${选.length} 条?`, 说: `先核对推理档位,可能耗一点额度。
` + 行.join(`
`), 钮字: "应用", 危: false }))
      return;
    operate("apply", { 指纹: preview.指纹, 选中: 选 });
  }
  async function 问了再(题, 说, 钮字, 干) {
    if (await UI确认({ 题, 说, 钮字, 危: false }))
      干();
  }
  async function 存劲(name, 用力) {
    if (busy)
      throw Object.assign(new Error("busy"), { 人话: "上一步还没完,稍后再点格子外面" });
    busy = true;
    try {
      const result = await request("/api/effort", { 功能名: name, 用力 });
      if (!result.成了)
        throw new Error(result.说 || result.错 || "接口未返回结果");
    } finally {
      busy = false;
    }
    receipt = { text: `「${name}」推理强度改成 ${用力 === 关档 ? "关闭" : 用力}` };
    try {
      const s = await request("/api/state");
      收状态(s);
      receive(s.模型更新);
    } catch (e) {
      receipt = error("载入", "/api/state", e);
      render();
    }
    if (选项.改完)
      选项.改完();
    return 用力 === 关档 ? "关闭" : 用力;
  }
  function status(r) {
    const texts = {
      "有新版": "↑ 有新版 " + r.新模型,
      "已是最新": "= 已是最新",
      "客户端定版本": "⊙ 版本由 Claude 客户端定",
      "清单里没有当前模型": "⚠ 清单里没有现在用的模型",
      "已固定": "■ 已固定",
      "拨不动": "✗ 拨不动:" + r.原因
    };
    return el("span", {
      text: texts[r.状态] || r.状态,
      class: "状态 " + ({ "有新版": "新版", "清单里没有当前模型": "警告", "拨不动": "错误" }[r.状态] || "灰"),
      title: r.状态 === "客户端定版本" ? "模型填的是 sonnet / opus 这种简称，具体版本由本机 claude 命令行决定，它升级了这里就跟着新" : r.原因 || texts[r.状态]
    });
  }
  function 强度格(r) {
    const 情 = 档情(r), name = r.功能名;
    if (!情)
      return el("td", { text: "—", "data-值": "", title: "这个模型不吃推理强度这一格" });
    const 全 = [关档, ...档序, ...情.清单.filter((x) => x !== 关档 && !档序.includes(x))].filter((v) => v === 关档 || 情.清单.includes(v) || v === r.用力);
    if (r.用力 && !全.includes(r.用力))
      全.push(r.用力);
    const 值 = r.用力 || 关档;
    return el("td", {
      class: "改",
      "data-值": 值,
      "data-选项": 全.join("|"),
      "data-test": "effort:" + name,
      "aria-label": name + " 推理强度",
      title: "模型想多久再答。指到格子上点右边 ✎ 改,点格子外面就存,不用点应用;「关」= 关闭" + (情.认准 ? "" : "(这几档是候选,还没探过)"),
      text: 值 === 关档 ? "关闭" : 值
    });
  }
  function 建骨架() {
    const 回执位 = el("div"), 筛选条 = el("div", { class: "更新筛选", role: "group", "aria-label": "模型状态筛选" });
    const 时 = el("span", { class: "数说" });
    const 检查钮 = button("检查更新", () => operate("check", {}), { title: "去各家拉最新模型清单，不改任何设置" });
    const 撤回钮 = button("撤回上一次", () => 问了再(`撤回上一次换的 ${preview.撤回数量} 条?`, "这几行换回上一次应用之前的模型。", "撤回", () => operate("undo", { 令牌: preview.撤回令牌 })));
    const 宽钮 = button("恢复默认列宽", () => {}, { title: "表头右边缘能拖宽拖窄,这台电脑记着;点这颗放回原样" });
    检查钮.className += " 表页动作";
    撤回钮.className += " 表页动作";
    宽钮.className += " 表页动作";
    const 列组 = el("colgroup"), 头行 = el("tr");
    for (const [名, 宽, 解] of 列们) {
      列组.appendChild(el("col", { style: `width:${宽}px` }));
      头行.appendChild(el("th", { text: 名, title: 解, class: 名 === "不再提示新版" ? "居中" : "" }));
    }
    const 体 = el("tbody"), 表 = el("table", { class: "更新表 紧" }, 列组, el("thead", {}, 头行), 体);
    const 框 = el("div", { class: "表框" }, 表);
    const 壳 = el("section", { class: "表壳" }, el("div", { class: "表名" }, el("h2", { class: "题", text: "GPT 模型更新" }), 时), el("div", { class: "表身" }, el("div", { class: "表框外", style: "--表框底:var(--bg)" }, 框)));
    const 对话位 = el("div");
    root.textContent = "";
    root.append(el("p", {
      class: "说明",
      text: "勾选要换的功能，选好模型，点应用",
      title: "「换成」那一格选好、勾上那一行,点「应用选中的 N 条」才真换;推理强度点格里 ✎ 改、点格外就存。已是最新的、Claude 简称(sonnet / opus)的功能在「按供应商看功能」里看。"
    }), 回执位, 筛选条, 壳, 对话位);
    骨 = { 回执位, 筛选条, 时, 检查钮, 撤回钮, 体, 表, 对话位 };
    if (typeof window !== "undefined" && window.装表格)
      表控 = window.装表格({
        表,
        勾选列宽: 44,
        存键: "模型更新-2",
        单位: "条",
        导出名: "GPT模型更新",
        选中集: selected,
        行键: (tr) => tr.dataset.键,
        可勾行: (tr) => {
          const r = preview.行.find((x) => x.功能名 === tr.dataset.键);
          return !!r && !busy && pickable(r);
        },
        已选数: () => picks().length,
        勾变: () => {
          for (const r of preview.行)
            if (selected.has(r.功能名) !== 勾快照.has(r.功能名))
              manual.add(r.功能名);
          勾快照 = new Set(selected);
        },
        加钮们: [检查钮, 撤回钮, 宽钮],
        批量们: [{ 名: () => `应用选中的 ${picks().length} 条`, 悬浮: "先核对推理档位,再整批换成「换成」那一格选的模型", 干: showApply }],
        报: (话) => {
          receipt = { text: 话 };
          画回执();
        },
        手机表: { 角色: { 号: ["ID"], 名: ["功能"], 态: ["状态"], 数: ["供应商", "现在用", "换成"] }, 键: "aibase-模型更新" }
      });
    if (window.UI列宽)
      UI列宽(表, { 键: "aibase-更新表-2", 钮: 宽钮 });
    if (window.UI格改)
      改 = UI格改(表, { 存: (格, 新) => 存劲(格.closest("tr").dataset.键, 新) });
  }
  function 画回执() {
    const 位 = 骨.回执位;
    位.textContent = "";
    if (receipt) {
      const r = el("div", { role: "status", "aria-live": "polite", class: receipt.bad ? "更新回执 错误" : "更新回执", text: (receipt.bad ? "✗ " : "✓ ") + receipt.text });
      if (receipt.full)
        r.appendChild(button("⧉ 复制报错", () => copy(receipt.full), { disabled: false }));
      位.appendChild(r);
    }
    for (const r of preview.刷新 || [])
      if (r.错) {
        const msg = error("清单检查", "/api/model-updates/check", r.供应商 + `
` + r.错);
        位.appendChild(el("div", { class: "更新回执 错误" }, el("span", { text: "✗ 清单未取到，请重试检查更新", title: r.供应商 }), button("⧉ 复制报错", () => copy(msg.full), { disabled: false })));
      }
  }
  function render() {
    if (!骨)
      建骨架();
    const scroller = 骨.表.parentElement, scrollLeft = scroller?.scrollLeft || 0;
    画回执();
    骨.时.textContent = "上次检查：" + (preview.上次检查 || "尚未检查");
    骨.检查钮.disabled = busy;
    骨.撤回钮.disabled = busy || !preview.撤回令牌;
    骨.撤回钮.textContent = preview.撤回令牌 ? `撤回 ${preview.撤回数量} 条` : "撤回上一次";
    骨.撤回钮.title = preview.撤回令牌 ? "相关功能后来改过时不能撤回" : "暂无可撤回操作；服务重启后撤不了";
    骨.筛选条.textContent = "";
    for (const [key, label] of filters)
      骨.筛选条.appendChild(button(label + " " + preview.行.filter((r) => matches(r, key)).length, () => {
        filter = key;
        held.clear();
        render();
      }, { "aria-pressed": String(filter === key), title: "只看这一类;勾过的行换了筛选也还勾着" }));
    if (骨.体.querySelector("td.改中")) {
      clearTimeout(等画);
      等画 = setTimeout(render, 300);
      return;
    }
    const shown = visible();
    骨.体.textContent = "";
    if (!shown.length)
      骨.体.appendChild(el("tr", { class: "无行" }, el("td", { colspan: String(列们.length) }, el("div", { class: "空" }, el("p", { class: "空话", text: filter === "有新版" ? "没有新版，其余功能按供应商看" : "当前筛选没有功能" }), button("去按供应商看功能", () => document.querySelector('[data-去块="按供应商"]')?.click(), { title: "已是最新的、Claude 简称的功能都在那一格,按供应商列" })))));
    for (const r of shown) {
      const name = r.功能名;
      const select = el("select", {
        "data-test": "target:" + name,
        "aria-label": name + " 换成",
        disabled: busy || blocked(r),
        onchange: (e) => {
          manual.add(name);
          choices.set(name, e.target.value);
          e.target.value !== r.旧模型 ? selected.add(name) : selected.delete(name);
          render();
        }
      });
      if (!choices.get(name))
        select.appendChild(el("option", { value: "", text: "请选择模型", disabled: true }));
      for (const model of r.可选模型)
        select.appendChild(el("option", { value: model, text: model }));
      select.value = choices.get(name);
      const feature = el("td", { class: r.父功能 ? "备选功能" : "", title: name, "data-值": name });
      if (r.父功能)
        feature.appendChild(el("span", { class: "tag t灰 备选标签", text: "备选", title: "首选连不上时顺着换的模型" }));
      feature.appendChild(el("span", { text: r.父功能 && name.startsWith(r.父功能 + " · ") ? name.slice(r.父功能.length + 3) : name }));
      const 状 = status(r);
      骨.体.appendChild(el("tr", { "data-键": name }, el("td", { class: "号格", "data-值": r.ID || "", text: r.ID || "—" }), feature, el("td", { text: r.供应商 }), el("td", { text: r.旧模型 || "—" }), el("td", { "data-值": choices.get(name) || "" }, select), 强度格(r), el("td", { "data-值": 状.textContent }, 状), el("td", { class: "居中", "data-值": r.不提新版 ? "是" : "否" }, button(r.不提新版 ? "■ 是" : "否", () => 问了再(r.不提新版 ? `「${name}」重新提示新版?` : `「${name}」不再提示新版?`, r.不提新版 ? "下次检查更新,有新版会推荐这一行换新。" : "检查更新不再推荐这一行换新,随时能改回来。", r.不提新版 ? "重新提示" : "不再提示", () => operate("fixed", { 功能名: name, 不提新版: !r.不提新版 })), { role: "switch", "aria-checked": String(r.不提新版), "aria-label": name + " 不再提示新版", "data-test": "fixed:" + name, title: "打开后检查更新不再推荐这行换新" }))));
    }
    if (表控)
      表控.重扫();
    if (改)
      改.刷();
    if (scroller)
      scroller.scrollLeft = scrollLeft;
  }
  function 收状态(s) {
    家们 = Object.fromEntries((s.供应商 || []).map((x) => [x.名, x]));
    档序 = s.档序 || [];
  }
  async function load() {
    busy = true;
    render();
    try {
      const s = await request("/api/state");
      收状态(s);
      receive(s.模型更新);
    } catch (e) {
      receipt = error("载入", "/api/state", e);
    } finally {
      busy = false;
      render();
    }
  }
  return { 接收: receive, 载入: load, 收状态 };
}
if (typeof window !== "undefined" && document.getElementById("模型更新页")) {
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      if (ok)
        area.remove();
      else {
        area.setAttribute("aria-label", "报错全文，请手动复制");
        area.focus();
      }
    }
  };
  const request = async (url, data) => {
    const response = await fetch(url, data === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.说 || result.错 || `HTTP ${response.status}`);
    return result;
  };
  window.模型更新页 = 创建模型更新页(document.getElementById("模型更新页"), request, copy, { 改完: () => window.dispatchEvent(new Event("底座改了")) });
}

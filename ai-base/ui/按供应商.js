function 创建按供应商页(root) {
  const 选中 = new Set;
  let 态 = null, 当前家 = "", 回执 = null, 表控 = null, 骨 = null, 改 = null, 等画 = 0;
  const 存键 = "aibase_按家";
  try {
    当前家 = localStorage.getItem(存键) || "";
  } catch (e) {}
  const 列们 = [
    ["ID", 76, "这一行功能的编号:建的时候程序发的,改名、挪先后都不变;删掉的号不再发。"],
    ["功能", 250, "这条功能叫什么(接入的软件报的就是这个名字)"],
    ["位置", 90, "首选 = 平时拨的那个;备选 = 首选连不上时顺着往下换的"],
    ["种类", 70, "文本 / 生图"],
    ["模型", 230, "这一行用这一家的哪个模型,点格里 ✎ 改、点格外就存"],
    ["推理强度", 150, "模型想多久再答,low / medium / high 这类档,点格里 ✎ 改、点格外就存"],
    ["启用", 90, "停用 = 接入的软件那边暂时看不见这一行,行还留着"],
    ["状态", 230, "现在拨不拨得动;拨不动写原因"]
  ];
  const 族名 = (f) => f.父功能 || f.功能名;
  const 族行们 = (名) => 态.功能.filter((f) => 族名(f) === 名);
  const 位置 = (f) => {
    const i = 族行们(族名(f)).indexOf(f);
    return i <= 0 ? "首选" : "备选 " + i;
  };
  const 家 = () => 态.供应商.find((s) => s.名 === 当前家);
  const 行们 = () => 态.功能.filter((f) => f.主用供应商 === 当前家);
  const 去掉自定义 = (选) => {
    const o = 选.querySelector('option[value="' + CSS.escape(自定义) + '"]');
    if (o)
      o.remove();
  };
  function 复制(文) {
    if (navigator.clipboard)
      return navigator.clipboard.writeText(文).catch(() => 老法(文));
    老法(文);
  }
  function 老法(文) {
    const t = document.createElement("textarea");
    t.value = 文;
    document.body.appendChild(t);
    t.select();
    try {
      document.execCommand("copy");
    } catch (e) {}
    t.remove();
  }
  function 记错(短, 原, 口) {
    回执 = { 坏: true, 话: 短, 全: 短 + `
原始报错:` + 原 + `
接口:` + 口 + `
时间:` + new Date().toISOString() + `
错误号:BYPROV-` + Date.now().toString(36) };
  }
  let 队 = Promise.resolve();
  function 写(口, 数据, 成话, 短, 格改) {
    const 这条 = 队.then(() => 真写(口, 数据, 成话, 短, 格改));
    队 = 这条.catch(() => {});
    return 这条;
  }
  async function 真写(口, 数据, 成话, 短, 格改) {
    try {
      const 结 = await 打(口, 数据);
      if (!结.成了) {
        if (格改)
          throw Object.assign(new Error(结.说 || 结.错 || "接口没说原因"), { 人话: 短.replace(/,复制报错$/, "") });
        记错(短, 结.说 || 结.错 || "接口没说原因", 口);
        画();
        return false;
      }
      回执 = { 坏: false, 话: 成话 + (结.说 && 口 === "/api/addpreset" ? "(" + 结.说 + ")" : "") };
      window.dispatchEvent(new Event("底座改了"));
      return true;
    } catch (e) {
      if (格改)
        throw e.人话 ? e : Object.assign(e instanceof Error ? e : new Error(String(e)), { 人话: 短.replace(/,复制报错$/, "") });
      记错(短, String(e && e.stack || e), 口);
      画();
      return false;
    }
  }
  function 建骨架() {
    const 回执位 = el("div", {});
    const 家选 = el("select", { "aria-label": "挑一家供应商", title: "挑一家,下面列出拨给它的功能行" });
    家选.addEventListener("change", () => {
      当前家 = 家选.value;
      选中.clear();
      try {
        localStorage.setItem(存键, 当前家);
      } catch (e) {}
      画(态);
    });
    const 家况 = el("div", {});
    const 宽钮 = el("button", { 类: "mini", type: "button", 文: "恢复默认列宽", title: "表头右边缘能拖宽拖窄,这台电脑记着;点这颗放回原样" });
    const 加钮 = el("button", {
      类: "主钮",
      type: "button",
      文: "＋ 添加功能行",
      title: "把某条功能的首选或备选换成 / 加上这一家的模型;那条功能原来有模型在用的,窗里会先说清换掉哪个"
    });
    加钮.addEventListener("click", () => 开添加窗());
    const 列组 = el("colgroup", {}), 头行 = el("tr", {});
    for (const [名, 宽, 解] of 列们) {
      列组.appendChild(el("col", { style: "width:" + 宽 + "px" }));
      头行.appendChild(el("th", { 文: 名, title: 解, 类: 名 === "启用" ? "居中" : "" }));
    }
    const 体 = el("tbody", {});
    const 表 = el("table", { 类: "供应商功能表 紧" }, 列组, el("thead", {}, 头行), 体);
    const 空位 = el("div", {});
    const 壳 = el("section", { 类: "表壳" }, el("div", { 类: "表名" }, el("h2", { 类: "题", 文: "按供应商看功能" }), 家选), el("div", { 类: "表身" }, 家况, 空位, el("div", { 类: "表框外", style: "--表框底:var(--bg)" }, el("div", { 类: "表框" }, 表))));
    const 窗位 = el("div", {});
    root.textContent = "";
    root.classList.add("按家块");
    root.append(el("p", {
      类: "说明",
      文: "挑一家,看哪些功能在用它",
      title: "一行 = 功能表里的一行(首选或某个备选)。模型、推理强度点格里 ✎ 改、点格外就存,启用一点就存;「＋ 添加功能行」给别的功能挂上这一家。"
    }), 回执位, 壳, 窗位);
    骨 = { 回执位, 家选, 家况, 体, 表, 空位, 窗位 };
    if (window.装表格)
      表控 = window.装表格({
        表,
        勾选列宽: 44,
        存键: "按供应商-2",
        单位: "条",
        导出名: "按供应商看功能",
        选中集: 选中,
        行键: (tr) => tr.dataset.键,
        已选数: () => [...选中].filter((n) => 态.功能.some((f) => f.功能名 === n)).length,
        加钮们: [加钮, 宽钮],
        批量们: [
          { 名: "启用", 悬浮: "勾上的这几行,接入的软件那边重新能选", 干: () => 批启用(true) },
          { 名: "停用", 悬浮: "勾上的这几行,接入的软件那边暂时看不见;行还留着,随时再启用", 要当心: true, 干: () => 批启用(false) }
        ],
        报: (话) => {
          回执 = { 坏: false, 话 };
          画回执();
        }
      });
    if (window.UI列宽)
      UI列宽(表, { 键: "aibase-供应商功能表-2", 钮: 宽钮 });
    if (window.UI格改)
      改 = UI格改(表, { 存: (格, 新) => 格._存(新) });
  }
  async function 批启用(开) {
    const 名们 = [...选中].filter((n) => 态.功能.some((f) => f.功能名 === n));
    let 成 = 0;
    for (const n of 名们) {
      try {
        const 结 = await 打("/api/enable", { 功能名: n, 开 });
        if (结.成了)
          成++;
      } catch (e) {}
    }
    选中.clear();
    回执 = 成 === 名们.length ? { 坏: false, 话: (开 ? "启用" : "停用") + "了 " + 成 + " 行" } : {
      坏: true,
      话: (开 ? "启用" : "停用") + "只成了 " + 成 + " / " + 名们.length + " 行",
      全: (开 ? "启用" : "停用") + "只成了 " + 成 + " / " + 名们.length + ` 行
接口:/api/enable
行:` + 名们.join("、") + `
时间:` + new Date().toISOString()
    };
    window.dispatchEvent(new Event("底座改了"));
  }
  function 画回执() {
    const 位 = 骨.回执位;
    位.textContent = "";
    if (!回执)
      return;
    const 条 = el("div", { 类: 回执.坏 ? "更新回执 错误" : "更新回执", role: "status" }, document.createTextNode((回执.坏 ? "✗ " : "✓ ") + 回执.话));
    if (回执.全) {
      const 钮 = el("button", { 类: "mini", type: "button", 文: "⧉ 复制报错" });
      const 全 = 回执.全;
      钮.addEventListener("click", () => 复制(全));
      条.appendChild(钮);
    }
    位.appendChild(条);
  }
  const 能选值 = (选, 现) => {
    去掉自定义(选);
    const 值们 = [...选.options].filter((o) => !o.disabled && o.value).map((o) => o.value);
    if (现 && !值们.includes(现))
      值们.unshift(现);
    return 值们.join("|");
  };
  function 模型格(f, 那家) {
    const 草 = document.createElement("select");
    画模型选项(草, 那家, f.主用模型, null);
    const 格 = el("td", {
      类: "改",
      "data-值": f.主用模型 || "",
      "data-选项": 能选值(草, f.主用模型),
      "data-test": "model:" + f.功能名,
      "aria-label": f.功能名 + " 模型",
      title: "这一行用这一家的哪个模型。指到格子上点右边 ✎ 换,点格子外面就存",
      文: f.主用模型 || "—"
    });
    格._存 = (新) => 写("/api/route", { 功能名: f.功能名, 供应商: 当前家, 模型: 新 }, "「" + 族名(f) + "」" + 位置(f) + "换成 " + 新, "模型没换成,复制报错", true);
    return 格;
  }
  function 强度格(f, 那家) {
    const 情 = 那家 && 那家.模型档位 && 那家.模型档位[f.主用模型] || null;
    if (f.种类 === "生图" || 情 && 情.来源 === "不吃这一格")
      return el("td", { "data-值": "", 文: "—", title: f.种类 === "生图" ? "生图没有推理强度这一格" : "这个模型不吃推理强度这一格" });
    const 草 = document.createElement("select");
    const 值 = f.用力 || 关档;
    画强度选项(草, (情 ? 情.档们 : 那家 && 那家.强度档) || [], 值, null, !!情 && 情.来源 === "接口自报");
    const 格 = el("td", {
      类: "改",
      "data-值": 值,
      "data-选项": 能选值(草, 值),
      "data-test": "effort:" + f.功能名,
      "aria-label": f.功能名 + " 推理强度",
      title: "模型想多久再答。指到格子上点右边 ✎ 改,点格子外面就存;「关」= 关闭",
      文: 值 === 关档 ? "关闭" : 值
    });
    格._存 = (新) => 写("/api/effort", { 功能名: f.功能名, 用力: 新 }, "「" + 族名(f) + "」" + 位置(f) + "推理强度改成 " + (新 === 关档 ? "关闭" : 新), "推理强度没存上,复制报错", true).then(() => 新 === 关档 ? "关闭" : 新);
    return 格;
  }
  function 启用格(f) {
    const 钮 = el("button", {
      类: "mini 开关",
      type: "button",
      role: "switch",
      "aria-checked": String(f.启用),
      "aria-label": f.功能名 + " 启用",
      文: f.启用 ? "● 开" : "○ 停",
      title: f.启用 ? "点一下停用:接入的软件那边暂时看不见这一行" : "点一下启用"
    });
    钮.addEventListener("click", () => 写("/api/enable", { 功能名: f.功能名, 开: !f.启用 }, "「" + f.功能名 + "」" + (f.启用 ? "停用了" : "启用了"), (f.启用 ? "停用" : "启用") + "没成,复制报错"));
    return el("td", { 类: "居中", "data-值": f.启用 ? "开" : "停" }, 钮);
  }
  function 画(新态) {
    if (新态)
      态 = 新态;
    if (!态)
      return;
    if (!骨)
      建骨架();
    画回执();
    const 家们 = 态.供应商;
    const 数 = (名) => 态.功能.filter((f) => f.主用供应商 === 名).length;
    if (!家们.some((s) => s.名 === 当前家))
      当前家 = (家们.find((s) => 数(s.名)) || 家们[0] || {}).名 || "";
    骨.家选.textContent = "";
    for (const s of 家们)
      骨.家选.appendChild(el("option", { value: s.名, 文: s.名 + "(" + 数(s.名) + " 条)" }));
    骨.家选.value = 当前家;
    const 那家 = 家();
    骨.家况.textContent = "";
    if (那家 && 那家.拨不动理由)
      骨.家况.appendChild(el("div", {
        类: "更新回执 错误",
        文: "✗ 这一家现在拨不动:" + 短话(那家.拨不动理由, 40),
        title: 那家.拨不动理由
      }));
    const 行 = 行们();
    for (const k of [...选中])
      if (!行.some((f) => f.功能名 === k))
        选中.delete(k);
    骨.空位.textContent = "";
    if (!行.length)
      骨.空位.appendChild(el("div", { 类: "空" }, el("p", { 类: "空话", 文: 那家 ? "还没有功能用这一家" : "还没有供应商" }), 那家 ? (() => {
        const b = el("button", { 类: "mini", type: "button", 文: "＋ 添加功能行" });
        b.addEventListener("click", () => 开添加窗());
        return b;
      })() : null));
    if (骨.体.querySelector("td.改中")) {
      clearTimeout(等画);
      等画 = setTimeout(() => 画(), 300);
      return;
    }
    骨.体.textContent = "";
    for (const f of 行) {
      const 显示 = f.父功能 && f.功能名.startsWith(f.父功能 + " · ") ? f.父功能 : f.功能名;
      const 状 = f.拨不动理由 ? "✗ 拨不动:" + 短话(f.拨不动理由, 24) : f.启用 ? "可用" : "○ 停用中";
      骨.体.appendChild(el("tr", { "data-键": f.功能名 }, el("td", { 类: "号格", "data-值": f.ID || "", 文: f.ID || "—" }), el("td", { "data-值": 显示, title: f.功能名, 文: 显示 }), el("td", { 文: 位置(f) }), el("td", { 文: f.种类 || "文本" }), 模型格(f, 那家), 强度格(f, 那家), 启用格(f), el("td", { "data-值": 状, title: f.拨不动理由 || "", 文: 状, 类: f.拨不动理由 ? "态坏" : "" })));
    }
    if (表控)
      表控.重扫();
    if (改)
      改.刷();
  }
  function 开添加窗() {
    const 那家 = 家();
    if (!那家)
      return;
    const 族们 = [...new Set(态.功能.map(族名))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    const 功选 = el("select", { "aria-label": "给哪条功能添加", id: "按家-功能" });
    const 分组 = new Map;
    for (const n of 族们) {
      const 项目 = n.split(" · ")[0];
      if (!分组.has(项目))
        分组.set(项目, el("optgroup", { label: 项目 }));
      const 首 = 族行们(n)[0];
      分组.get(项目).appendChild(el("option", { value: n, 文: n + (首 ? "(首选:" + 首.主用供应商 + " / " + 首.主用模型 + ")" : "") }));
    }
    功选.append(...分组.values());
    const 首钮 = el("input", { type: "radio", name: "按家-位", value: "首选" });
    const 备钮 = el("input", { type: "radio", name: "按家-位", value: "备选" });
    备钮.checked = true;
    const 换选 = el("select", { "aria-label": "换掉哪个备选", id: "按家-换" });
    const 换行 = el("div", {}, el("label", { for: "按家-换", 文: "已满 3 个,换掉哪个备选" }), 换选);
    const 模选 = el("select", { "aria-label": "用这一家的哪个模型", id: "按家-模型" });
    画模型选项(模选, 那家, "", null);
    去掉自定义(模选);
    const 提醒 = el("div", { role: "status" });
    const 定钮 = el("button", { 类: "主钮", type: "button", 文: "确定添加" });
    const 关钮 = el("button", { 类: "mini", type: "button", 文: "取消" });
    const 窗回执 = el("div", {});
    const 窗 = el("dialog", { "aria-label": "添加功能行" }, el("h2", { 文: "给功能添加「" + 当前家 + "」的模型" }), el("label", { for: "按家-功能", 文: "功能" }), 功选, el("label", { 文: "放在" }), el("div", { 类: "位选" }, el("label", { title: "换掉这条功能平时拨的那个模型" }, 首钮, document.createTextNode("首选(主)")), el("label", { title: "首选连不上时顺着往下换的那几个" }, 备钮, document.createTextNode("备选(次)"))), 换行, el("label", { for: "按家-模型", 文: "模型" }), 模选, 提醒, 窗回执, el("div", {}, 定钮, 关钮));
    const 族 = () => 族行们(功选.value);
    const 算 = () => {
      const 行 = 族(), 首 = 行[0], 备们 = 行.slice(1), 当首 = 首钮.checked;
      const 满 = 行.length >= 3;
      换行.hidden = 当首 || !满;
      if (!换行.hidden) {
        const 旧 = 换选.value;
        换选.textContent = "";
        备们.forEach((f, i) => 换选.appendChild(el("option", { value: f.功能名, 文: "备选 " + (i + 1) + ":" + f.主用供应商 + " / " + f.主用模型 })));
        if (备们.some((f) => f.功能名 === 旧))
          换选.value = 旧;
      }
      const 新 = 当前家 + " / " + (模选.value || "(还没选模型)");
      const 撞 = 行.find((f) => f.主用供应商 === 当前家 && f.主用模型 === 模选.value);
      提醒.textContent = "";
      提醒.className = "";
      let 能 = !!模选.value && !撞;
      if (撞) {
        提醒.className = "换掉提醒";
        提醒.textContent = "⚠ 「" + 功选.value + "」的" + 位置(撞) + "已经是 " + 新 + ",不用再加";
      } else if (当首 && 首) {
        提醒.className = "换掉提醒";
        提醒.textContent = "⚠ 「" + 功选.value + "」现在首选用 " + 首.主用供应商 + " / " + 首.主用模型 + ",添加后首选换成 " + 新 + ",原来那个不保留。要留着就改选「备选」。";
      } else if (!当首 && 满) {
        const 掉 = 备们.find((f) => f.功能名 === 换选.value);
        提醒.className = "换掉提醒";
        提醒.textContent = 掉 ? "⚠ 「" + 功选.value + "」已有 3 个模型(上限),添加后" + 位置(掉) + " " + 掉.主用供应商 + " / " + 掉.主用模型 + " 换成 " + 新 : "⚠ 这条功能已满 3 个且没有备选可换";
        能 = 能 && !!掉;
      } else if (!当首) {
        提醒.textContent = "会加成「" + 功选.value + "」的备选 " + 行.length + ",首选和原有备选都不动。";
      }
      定钮.disabled = !能;
    };
    for (const x of [功选, 首钮, 备钮, 换选, 模选])
      x.addEventListener("change", 算);
    if (骨.体.querySelector("tr")) {
      const 勾 = [...选中][0];
      const f = 态.功能.find((x) => x.功能名 === 勾);
      if (f)
        功选.value = 族名(f);
    }
    算();
    关钮.addEventListener("click", () => 窗.close());
    窗.addEventListener("close", () => 窗.remove());
    定钮.addEventListener("click", async () => {
      const 行 = 族(), 名 = 功选.value, 模 = 模选.value;
      let 成;
      if (首钮.checked)
        成 = await 写("/api/route", { 功能名: 行[0].功能名, 供应商: 当前家, 模型: 模 }, "「" + 名 + "」首选换成 " + 当前家 + " / " + 模, "首选没换成,复制报错");
      else if (行.length >= 3)
        成 = await 写("/api/route", { 功能名: 换选.value, 供应商: 当前家, 模型: 模 }, "「" + 名 + "」备选换成 " + 当前家 + " / " + 模, "备选没换成,复制报错");
      else
        成 = await 写("/api/addpreset", { 功能名: 名, 供应商: 当前家, 模型: 模 }, "「" + 名 + "」加了备选 " + 当前家 + " / " + 模, "备选没加上,复制报错");
      if (成)
        窗.close();
      else {
        窗回执.textContent = "";
        窗回执.appendChild(骨.回执位.firstChild.cloneNode(true));
        窗回执.querySelector("button")?.addEventListener("click", () => 复制(回执.全));
      }
    });
    骨.窗位.appendChild(窗);
    窗.showModal();
  }
  return { 画 };
}
if (typeof window !== "undefined" && document.getElementById("按供应商页"))
  window.按供应商页 = 创建按供应商页(document.getElementById("按供应商页"));
